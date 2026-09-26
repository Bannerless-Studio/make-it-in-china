import { describe, expect, it } from 'vitest';
import {
  checkStrictContent,
  legacyCoverageScenes,
  strictRuleNumbers,
} from '../scripts/check-level-rules.mjs';

type Data = Record<string, any>;

const starter = ['你', '好', '我', '是', '这', '那', '一', '二', '三', '四'];

function makeFixture(): { words: Data[]; scenes: Data[]; world: Data } {
  const generated = Array.from({ length: 140 }, (_, index) => String.fromCodePoint(0x3400 + index));
  const ids = [...starter, ...generated];
  const words = ids.map((hanzi, index) => ({
    hanzi,
    pinyin: index < starter.length
      ? ['nǐ', 'hǎo', 'wǒ', 'shì', 'zhè', 'nà', 'yī', 'èr', 'sān', 'sì'][index]
      : 'ā',
    en: `word ${index}`,
    hsk: 1,
  }));
  const groups: string[][] = [starter];
  let cursor = starter.length;
  for (let sceneIndex = 1; sceneIndex <= 22; sceneIndex += 1) {
    const count = sceneIndex <= 4 ? 8 : 6;
    groups.push(ids.slice(cursor, cursor + count));
    cursor += count;
  }
  groups.push([], []);

  const scenes = groups.map((introduced, sceneIndex) => {
    const chunks = introduced.length === 0
      ? [[], []]
      : Array.from({ length: Math.ceil(introduced.length / 2) }, (_, index) =>
        introduced.slice(index * 2, index * 2 + 2)
      );
    const familiar = sceneIndex === 0
      ? []
      : [
        ...starter,
        ...(groups[sceneIndex - 2] ?? []).filter((word) => !starter.includes(word)),
        ...(groups[sceneIndex - 1] ?? []).filter((word) => !starter.includes(word)),
      ];
    const share = Math.max(1, Math.ceil(familiar.length / chunks.length));
    const exchanges = chunks.map((chunk, exchangeIndex) => {
      const recontextualized = familiar.slice(exchangeIndex * share, (exchangeIndex + 1) * share);
      while (familiar.length > 0 && recontextualized.length < 14 - chunk.length) {
        recontextualized.push(familiar[recontextualized.length % familiar.length]);
      }
      const lineWords = [...recontextualized, ...chunk];
      const id = `s${sceneIndex}_e${exchangeIndex + 1}`;
      return {
        id,
        introduces: chunk,
        tests: [],
        line: {
          hanzi: lineWords.join(''),
          pinyin: 'nǐ hǎo',
          en: 'Fixture line.',
          audio: `${id}_line`,
          words: lineWords,
        },
        replies: [
          {
            id: `${id}_r1`,
            hanzi: '你',
            pinyin: 'nǐ',
            en: 'You.',
            audio: `${id}_r1_audio`,
            words: ['你'],
            action: 'first',
            correct: true,
          },
          {
            id: `${id}_r2`,
            hanzi: '好',
            pinyin: 'hǎo',
            en: 'Good.',
            audio: `${id}_r2_audio`,
            words: ['好'],
            action: 'second',
            correct: true,
          },
        ],
      };
    });
    return {
      id: `s${sceneIndex}`,
      phase: 1,
      location: 'room',
      npc: 'npc',
      kind: 'story',
      requires: [],
      introduces: introduced,
      exchanges,
      curriculumIndex: sceneIndex,
      minDay: 1,
      afterScenes: sceneIndex === 0 ? [] : [`s${sceneIndex - 1}`],
      allowedSlots: ['E'],
      repeatable: false,
    };
  });
  return {
    words,
    scenes,
    world: { phase: 1, locations: [{ id: 'room', signs: [] }], npcs: [{ id: 'npc' }], slotPools: [] },
  };
}

function failuresFor(data: ReturnType<typeof makeFixture>, rule: number, ambient: Data[] = []) {
  return checkStrictContent(data.words, data.scenes, data.world, null, ambient).issues
    .filter((issue) => issue.rule === rule);
}

function ambientLine(overrides: Data = {}): Data {
  return {
    id: 'amb_001',
    location: 'room',
    speaker: 'npc',
    hanzi: '你好',
    pinyin: 'nǐ hǎo',
    en: 'Hello.',
    words: ['你', '好'],
    audio: 'amb_001',
    ...overrides,
  };
}

function stripFromScene(scene: Data, word: string) {
  for (const exchange of scene.exchanges) {
    exchange.line.words = exchange.line.words.filter((token: string) => token !== word);
    exchange.line.hanzi = exchange.line.words.join('');
  }
}

function addSlotFixture(data: ReturnType<typeof makeFixture>, values: Data[]) {
  data.world.slotPools.push({ id: 'number_1_10', values });
  const exchange = data.scenes[1].exchanges[0];
  exchange.slots = { count: 'number_1_10' };
  exchange.line.hanzi += '{count}';
  exchange.line.pinyin += ' {count}';
  exchange.line.en += ' {count}';
  return exchange;
}

function addWrongReplyFixture(data: ReturnType<typeof makeFixture>) {
  const exchange = data.scenes[0].exchanges[0];
  exchange.replies[1].correct = false;
  exchange.onWrong = 'tutorial_wrong';
  exchange.hint = {
    hanzi: '好',
    pinyin: 'hǎo',
    en: 'Good.',
    audio: 'tutorial_hint',
    words: ['好'],
  };
  data.scenes.push({
    id: 'tutorial_wrong',
    phase: 1,
    location: 'room',
    npc: 'npc',
    kind: 'consequence',
    requires: [],
    introduces: [],
    cost: 0,
    exchanges: [{
      id: 'tutorial_wrong_e1',
      introduces: [],
      tests: [],
      line: {
        hanzi: '好',
        pinyin: 'hǎo',
        en: 'Good.',
        audio: 'tutorial_wrong_e1',
        words: ['好'],
      },
      replies: [{
        id: 'tutorial_wrong_e1_r1',
        hanzi: '好',
        pinyin: 'hǎo',
        en: 'Good.',
        audio: 'tutorial_wrong_e1_r1',
        words: ['好'],
        action: 'retry',
        correct: true,
      }],
    }],
  });
  return { exchange, consequence: data.scenes.at(-1)! };
}

describe('strict content checker', () => {
  it('counts curriculum-indexed consequences in legacy coverage with a v1 fallback', () => {
    const indexed = [
      { id: 'regular', kind: 'story', curriculumIndex: 0 },
      { id: 'guided', kind: 'consequence', curriculumIndex: 1 },
      { id: 'ordinary', kind: 'consequence' },
    ];
    expect(legacyCoverageScenes(indexed).map((scene: any) => scene.id))
      .toEqual(['regular', 'guided']);
    expect(legacyCoverageScenes([
      { id: 'regular', kind: 'story' },
      { id: 'guided', kind: 'consequence' },
      { id: 'ordinary', kind: 'consequence' },
    ]).map((scene: any) => scene.id))
      .toEqual(['regular']);
  });

  it('passes every implemented strict rule for a complete fixture', () => {
    const data = makeFixture();
    for (const rule of strictRuleNumbers) expect(failuresFor(data, rule), `rule ${rule}`).toEqual([]);
  });

  it('fails rule 1 for off-list Han', () => {
    const data = makeFixture();
    data.scenes[0].exchanges[0].line.hanzi += '陌';
    data.scenes[0].exchanges[0].line.words.push('陌');
    expect(failuresFor(data, 1).length).toBeGreaterThan(0);
  });

  it('fails rule 2 above two actually unseen words', () => {
    const data = makeFixture();
    const exchange = data.scenes[1].exchanges[0];
    const extra = data.scenes[1].exchanges[1].introduces[0];
    exchange.introduces.push(extra);
    exchange.line.hanzi += extra;
    exchange.line.words.push(extra);
    expect(failuresFor(data, 2).some((issue) => issue.siteId === 's1/s1_e1/line')).toBe(true);
  });

  it('accepts a slot when its requested and fixed alternative values are eligible', () => {
    const data = makeFixture();
    addSlotFixture(data, [
      { id: 'n01', hanzi: '一', pinyin: 'yī', en: 'one', words: ['一'] },
      { id: 'n02', hanzi: '二', pinyin: 'èr', en: 'two', words: ['二'] },
    ]);
    expect(failuresFor(data, 2).some((issue) => issue.siteId === 's1/s1_e1/line')).toBe(false);
  });

  it('fails rule 2 when a slot has no eligible requested/alternative pair', () => {
    const data = makeFixture();
    const unseen = data.scenes[2].introduces.slice(0, 2);
    addSlotFixture(data, [
      { id: 'n01', hanzi: unseen[0], pinyin: 'ā', en: 'first', words: [unseen[0]] },
      { id: 'n02', hanzi: unseen[1], pinyin: 'ā', en: 'second', words: [unseen[1]] },
    ]);
    expect(failuresFor(data, 2).some((issue) =>
      issue.siteId === 's1/s1_e1/line' && issue.message.includes('no slot value')
    )).toBe(true);
  });

  it('attributes guided consequence novelty to its own route-ordered exchanges', () => {
    const data = makeFixture();
    const parent = data.scenes[1].exchanges[0];
    const afterGuided = data.scenes[1].exchanges[1];
    const guided = data.scenes[2];
    const guidedWord = guided.exchanges[0].introduces[0];
    parent.guidedConsequence = guided.id;
    guided.kind = 'consequence';
    guided.cost = 0;
    for (const exchange of guided.exchanges) {
      exchange.line.words = [...starter, ...exchange.introduces];
      exchange.line.hanzi = exchange.line.words.join('');
    }
    afterGuided.line.hanzi += guidedWord;
    afterGuided.line.words.push(guidedWord);

    const result = checkStrictContent(data.words, data.scenes, data.world);
    expect(result.exchangeNovelty.get('s1/s1_e1')).toEqual(parent.introduces);
    expect(result.exchangeNovelty.get('s2/s2_e1')).toEqual(guided.exchanges[0].introduces);
    expect(result.issues.some((issue) =>
      issue.rule === 2
      && issue.siteId === 's1/s1_e1/line'
      && issue.message.includes(guidedWord)
    )).toBe(false);
    expect(result.issues.some((issue) =>
      issue.rule === 2
      && issue.siteId === 's1/s1_e2/line'
      && issue.message.includes(`unseen word "${guidedWord}"`)
    )).toBe(false);
  });

  it('fails rule 3 for a post-segmentation tag mismatch', () => {
    const data = makeFixture();
    data.scenes[0].exchanges[0].line.words.pop();
    expect(failuresFor(data, 3).length).toBeGreaterThan(0);
  });

  it('fails rule 4 when the HSK1 target is incomplete', () => {
    const data = makeFixture();
    data.words.pop();
    expect(failuresFor(data, 4).some((issue) => issue.siteId === 'coverage:target')).toBe(true);
  });

  it('fails rule 5 when reply audio is missing', () => {
    const data = makeFixture();
    delete data.scenes[0].exchanges[0].replies[0].audio;
    expect(failuresFor(data, 5).some((issue) => issue.siteId === 's0/s0_e1/r1')).toBe(true);
  });

  it('fails rule 5 when the exported word-audio map omits a dictionary word', () => {
    const data = makeFixture();
    const issues = checkStrictContent(data.words, data.scenes, data.world, {}).issues;
    expect(issues.some((issue) =>
      issue.rule === 5 && issue.siteId === `word:${data.words[0].hanzi}`
    )).toBe(true);
  });

  it('fails rule 6 for an unbound placeholder', () => {
    const data = makeFixture();
    data.scenes[0].exchanges[0].line.hanzi += '{missing}';
    expect(failuresFor(data, 6).some((issue) => issue.siteId === 's0/s0_e1/line')).toBe(true);
  });

  it('fails rule 7 for duplicate rendered choices', () => {
    const data = makeFixture();
    data.scenes[0].exchanges[0].replies[1].hanzi = '你';
    data.scenes[0].exchanges[0].replies[1].words = ['你'];
    expect(failuresFor(data, 7).length).toBeGreaterThan(0);
  });

  it('validates wrong-reply hints, onWrong targets, and tutorial consequence cost', () => {
    const data = makeFixture();
    const { exchange, consequence } = addWrongReplyFixture(data);
    expect(failuresFor(data, 5).some((issue) => issue.siteId === 's0/s0_e1/hint')).toBe(false);
    expect(failuresFor(data, 6).some((issue) => issue.siteId === 's0/s0_e1/line')).toBe(false);
    expect(failuresFor(data, 7).some((issue) => issue.siteId === 's0/s0_e1/r2')).toBe(false);
    expect(failuresFor(data, 14).some((issue) => issue.siteId === 'scene:tutorial_wrong')).toBe(false);

    delete exchange.hint;
    consequence.cost = 1;
    expect(failuresFor(data, 5).some((issue) => issue.siteId === 's0/s0_e1/hint')).toBe(true);
    expect(failuresFor(data, 14).some((issue) =>
      issue.siteId === 'scene:tutorial_wrong' && issue.message.includes('cost must be 0')
    )).toBe(true);

    exchange.onWrong = 'missing_consequence';
    expect(failuresFor(data, 6).some((issue) => issue.message.includes('does not exist'))).toBe(true);
    expect(failuresFor(data, 7).some((issue) => issue.siteId === 's0/s0_e1/r2')).toBe(true);
  });

  it('fails rule 10 when the canonical route has no correct reply', () => {
    const data = makeFixture();
    for (const reply of data.scenes[0].exchanges[0].replies) reply.correct = false;
    expect(failuresFor(data, 10).some((issue) => issue.siteId === 's0/s0_e1/line')).toBe(true);
  });

  it('fails rule 11 below eighty percent familiarity', () => {
    const data = makeFixture();
    for (const scene of data.scenes.slice(1)) {
      for (const exchange of scene.exchanges) {
        const repeated = exchange.introduces.flatMap((word: string) => Array(80).fill(word));
        exchange.line.words = [...repeated, ...exchange.line.words];
        exchange.line.hanzi = exchange.line.words.join('');
      }
    }
    expect(failuresFor(data, 11).length).toBeGreaterThan(0);
  });

  it('fails rule 15 for an over-long line, hint, or reply', () => {
    const data = makeFixture();
    const { exchange } = addWrongReplyFixture(data);
    exchange.line.words = Array.from({ length: 15 }, () => '你');
    exchange.line.hanzi = exchange.line.words.join('');
    exchange.hint.words = Array.from({ length: 11 }, () => '好');
    exchange.hint.hanzi = exchange.hint.words.join('');
    exchange.replies[0].words = Array.from({ length: 9 }, () => '我');
    exchange.replies[0].hanzi = exchange.replies[0].words.join('');
    const issues = failuresFor(data, 15);
    expect(issues.map((issue) => issue.siteId)).toEqual(
      expect.arrayContaining(['s0/s0_e1/line', 's0/s0_e1/hint', 's0/s0_e1/r1']),
    );
    expect(issues.find((issue) => issue.siteId === 's0/s0_e1/line')?.message)
      .toBe('15 syllables; the line limit is 14');
  });

  it('counts a placeholder as two syllables and exempts numeric slot replies', () => {
    const data = makeFixture();
    const exchange = addSlotFixture(data, [
      { id: 'n01', hanzi: '一', pinyin: 'yī', en: 'one', words: ['一'] },
      { id: 'n02', hanzi: '二', pinyin: 'èr', en: 'two', words: ['二'] },
    ]);
    exchange.replies[0].hanzi = '{count}我我我我我我我';
    exchange.replies[0].pinyin = '{count} wǒ';
    exchange.replies[0].words = Array.from({ length: 7 }, () => '我');
    expect(failuresFor(data, 15).some((issue) => issue.siteId === 's1/s1_e1/r1')).toBe(false);

    data.world.slotPools[0].values[0] = { id: 'n01', hanzi: '好', pinyin: 'hǎo', en: 'good', words: ['好'] };
    expect(failuresFor(data, 15).some((issue) =>
      issue.siteId === 's1/s1_e1/r1' && issue.message === '9 syllables; the reply limit is 8'
    )).toBe(true);
  });

  it('fails rule 15 for an over-long ambient line', () => {
    const data = makeFixture();
    const ambient = [ambientLine({
      hanzi: '你你你你你好好好好',
      words: Array.from({ length: 9 }, (_, index) => (index < 5 ? '你' : '好')),
    })];
    expect(failuresFor(data, 15, ambient).some((issue) =>
      issue.siteId === 'ambient:amb_001' && issue.message === '9 syllables; the ambient limit is 8'
    )).toBe(true);
  });

  it('validates ambient metadata and counts it as scene coverage', () => {
    const data = makeFixture();
    const word = data.scenes[1].introduces[0];
    stripFromScene(data.scenes[3], word);
    expect(failuresFor(data, 4).some((issue) => issue.siteId === `coverage:${word}`)).toBe(true);

    const ambient = [ambientLine({ hanzi: word, words: [word] })];
    expect(failuresFor(data, 4, ambient).some((issue) => issue.siteId === `coverage:${word}`)).toBe(false);

    const elsewhere = [ambientLine({ hanzi: word, words: [word], location: 'street' })];
    expect(failuresFor(data, 4, elsewhere).some((issue) => issue.siteId === `coverage:${word}`)).toBe(true);
    expect(failuresFor(data, 14, elsewhere).some((issue) =>
      issue.siteId === 'ambient:amb_001' && issue.message.includes('unknown location')
    )).toBe(true);

    const mistagged = [ambientLine({ hanzi: word, words: [] })];
    expect(failuresFor(data, 3, mistagged).some((issue) => issue.siteId === 'ambient:amb_001')).toBe(true);
  });

  it('fails rule 14 for an unstable reply ID', () => {
    const data = makeFixture();
    data.scenes[0].exchanges[0].replies[0].id = 'unstable';
    expect(failuresFor(data, 14).some((issue) => issue.siteId === 's0/s0_e1/r1')).toBe(true);
  });

  it('fails rule 14 for duplicate stable IDs within a slot pool', () => {
    const data = makeFixture();
    data.world.slotPools.push({
      id: 'size',
      values: [
        { id: 'same', hanzi: '一', pinyin: 'yī', en: 'one', words: ['一'] },
        { id: 'same', hanzi: '二', pinyin: 'èr', en: 'two', words: ['二'] },
      ],
    });
    expect(failuresFor(data, 14).some((issue) =>
      issue.siteId === 'pool:size/1' && issue.message.includes('duplicate slot value ID')
    )).toBe(true);
  });
});
