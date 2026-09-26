import { describe, expect, it } from 'vitest';
import { ContentError, createGame } from '../../src/engine';
import { content, exchange, phaseOne, slotted, unbound, withConsequence } from '../fixtures/engine';

describe('scene-scoped slots', () => {
  it('prefers shaky over met and known, substitutes all three text fields', () => {
    const game = createGame(content(slotted()), { initialWords: { 一: 'met', 二: 'shaky', 三: 'known' } }); game.start('job');
    const ex = game.state().dialogue!.exchange;
    expect(ex.line).toMatchObject({ hanzi: '二杯子', pinyin: 'èr bēizi', en: 'two cups', words: ['杯子', '二'] });
    expect(ex.replies[0]).toMatchObject({ hanzi: '二', pinyin: 'èr', en: 'two', words: ['杯子', '二'] });
    game.reply(0); expect(game.state().words['二'].state).toBe('known');
  });
  it('falls back to met before known', () => {
    const game = createGame(content(slotted()), { initialWords: { 一: 'known', 二: 'met' } }); game.start('job');
    expect(game.state().dialogue!.bindings.n.hanzi).toBe('二');
  });
  it('can reuse known words when no met or shaky word is eligible', () => {
    const game = createGame(content(slotted()), { initialWords: { 一: 'known', 二: 'known' } }); game.start('job');
    expect(game.state().dialogue!.bindings.n.hanzi).toBe('一');
  });
  it('never chooses an unseen word outside introduces', () => {
    const game = createGame(content(slotted())); const before = game.state();
    expect(() => game.start('job')).toThrow(ContentError); expect(game.state()).toEqual(before);
  });
  it('allows an unseen word explicitly introduced by the exchange, with its fixed alternative', () => {
    const first = slotted(); first.exchanges[0].introduces = ['二', '三'];
    const game = createGame(content(first)); game.start('job');
    expect(game.state().dialogue!.bindings.n.hanzi).toBe('三'); expect(game.state().words['三'].state).toBe('met');
  });
  it('ignores scene-level introduces for pool eligibility', () => {
    const first = slotted(); first.introduces.push('三');
    expect(() => createGame(content(first)).start('job')).toThrow(ContentError);
  });
  it('refuses a value whose fixed wrong alternative is still unseen', () => {
    const game = createGame(content(slotted()), { initialWords: { 三: 'met' } });
    expect(game.availableScenes()).toEqual([]);
    expect(() => game.start('job')).toThrow(ContentError);
  });
  it('requires eligibility for every word in a pool value', () => {
    const data = content(slotted()); data.world.slotPools[0].values[0].words.push('陌生');
    const game = createGame(data, { initialWords: { 一: 'shaky', 二: 'met', 三: 'met' } }); game.start('job');
    expect(game.state().dialogue!.bindings.n.hanzi).toBe('三');
  });
  it('reuses bindings in later lines and replies', () => {
    const first = slotted(), later = exchange('e2'); later.line.hanzi = '{n}'; later.replies[0].hanzi = '{n}'; first.exchanges.push(later);
    const game = createGame(content(first), { initialWords: { 一: 'met', 二: 'met' } }); game.start('job');
    const bound = game.state().dialogue!.bindings.n.hanzi; game.reply(0);
    expect(game.state().dialogue!.exchange.line.hanzi).toBe(bound); expect(game.state().dialogue!.exchange.replies[0].hanzi).toBe(bound);
    expect(game.state().dialogue!.exchange.replies[0].words).toContain(bound);
  });
  it('rebinds a later declaration using its new pool', () => {
    const first = slotted(), later = exchange('e2'); later.slots = { n: 'other' }; later.line.hanzi = '{n}'; first.exchanges.push(later);
    const data = content(first); data.world.slotPools.push({ id: 'other', values: [data.world.slotPools[0].values[1]] });
    const game = createGame(data, { initialWords: { 一: 'shaky', 二: 'met' } }); game.start('job');
    expect(game.state().dialogue!.bindings.n.hanzi).toBe('一'); game.reply(0); expect(game.state().dialogue!.bindings.n.hanzi).toBe('二');
  });
  it.each(['hanzi', 'pinyin', 'en'] as const)('rejects an unbound reply %s at start', field => {
    const data = unbound(); data.scenes[0].exchanges[0].replies[0].hanzi = '好'; data.scenes[0].exchanges[0].replies[0][field] = '{missing}';
    expect(() => createGame(data).start('job')).toThrow(ContentError);
  });
  it('pre-scans later exchanges and consequences before charging an action', () => {
    const data = withConsequence(); data.scenes[1].exchanges[0].line.hanzi = '{later}';
    const game = createGame(data); expect(() => game.start('job')).toThrow(ContentError); expect(game.state().actionSlots).toBe(4);
  });
  it.each(['hanzi', 'pinyin', 'en'] as const)('rejects unbound line %s in a later exchange at start', field => {
    const first = slotted(), later = exchange('later'); later.line[field] = '{missing}'; first.exchanges.push(later);
    expect(() => createGame(content(first), { initialWords: { 一: 'met' } }).start('job')).toThrow(ContentError);
  });
  it('rejects forward routes that skip a required binding at start', () => {
    const first = slotted(), early = exchange('early'), last = exchange('last');
    early.replies[0].next = 'last'; last.line.hanzi = '{n}'; first.exchanges.unshift(early); first.exchanges.push(last);
    expect(() => createGame(content(first), { initialWords: { 一: 'met' } }).start('job')).toThrow(ContentError);
  });
  it('never tags a placeholder-free reply with words it does not say', () => {
    const first = slotted(); first.exchanges[0].replies[0] = exchange().replies[0];
    const game = createGame(content(first), { initialWords: { 一: 'met', 二: 'met' } }); game.start('job');
    const bound = game.state().dialogue!.bindings.n.hanzi;
    expect(game.state().dialogue!.exchange.line.words).toContain(bound);
    expect(game.state().dialogue!.exchange.replies[0].words).not.toContain(bound);
    expect(game.state().dialogue!.exchange.replies[1].words).toEqual(['杯子']);
  });
  it('does not permit a later binding to satisfy an earlier placeholder', () => {
    const first = slotted(); first.exchanges.unshift({ ...exchange('early'), line: { ...exchange().line, hanzi: '{n}' } });
    expect(() => createGame(content(first)).start('job')).toThrow(ContentError);
  });
  it('produces the same sequence for equal seeds without mutating content', () => {
    const data = content(slotted()), before = structuredClone(data);
    const opts = { seed: 923, initialWords: { 一: 'met', 二: 'met', 三: 'met' } } as const;
    const first = createGame(data, opts), second = createGame(data, opts);
    for (let i = 0; i < 4; i++) { first.start('job'); second.start('job'); expect(first.state().dialogue).toEqual(second.state().dialogue); first.reply(0); second.reply(0); }
    expect(data).toEqual(before);
  });
});

describe('slot binding against real content', () => {
  const met = (words: string[]) => Object.fromEntries(words.map(word => [word, 'met' as const]));
  const startSecondShift = (seed: number) => {
    const data = phaseOne();
    const scene = data.scenes.find(item => item.id === 'p1_noodle_dishwasher_02')!;
    const game = createGame(data, { seed, initialWords: met([...scene.requires, '一', '二', '三', '四', '请', '水', '茶', '喝', '做']),
      progress: { completedOn: { p1_arrival_00: 1, p1_noodle_dishwasher_01: 1 } } });
    game.start('p1_noodle_dishwasher_02');
    while (game.state().dialogue!.exchange.id !== 'p1_noodle_dishwasher_02_e4') {
      game.reply(game.state().dialogue!.exchange.replies.findIndex(reply => reply.correct));
    }
    return game;
  };
  it('never binds a count that a later exchange still has to introduce', () => {
    for (const seed of [1, 2, 3, 7, 13, 42, 923]) {
      const bound = startSecondShift(seed).state().dialogue!.bindings.cup_count;
      expect(['六', '八'], `seed ${seed}`).not.toContain(bound.hanzi);
      expect(['一', '二', '三', '四'], `seed ${seed}`).toContain(bound.hanzi);
    }
  });
  it('tags the filled line by segmenting its text, in spoken order', () => {
    const dictionary = [...(phaseOne().words ?? [])].map(word => word.hanzi).sort((left, right) => right.length - left.length);
    const segment = (hanzi: string) => {
      const words: string[] = [];
      for (let index = 0; index < hanzi.length;) {
        const match = dictionary.find(word => hanzi.startsWith(word, index));
        if (!match) { index++; continue; }
        words.push(match); index += match.length;
      }
      return words;
    };
    const frame = startSecondShift(1).state().dialogue!;
    expect(frame.exchange.line.words).toEqual(segment(frame.exchange.line.hanzi));
    expect(frame.exchange.line.words[0]).toBe(frame.bindings.cup_count.words[0]);
    for (const reply of frame.exchange.replies) expect(reply.words).toEqual(segment(reply.hanzi));
  });
  it('binds two slots on one pool to different values', () => {
    const data = phaseOne();
    const scene = data.scenes.find(item => item.id === 'p1_noodle_dishwasher_01')!;
    for (const seed of [1, 5, 11, 97]) {
      const game = createGame(data, { seed, initialWords: met([...scene.requires, '一', '二', '三', '四', '十', '工作', '碗', '个']),
        progress: { completedOn: { p1_arrival_00: 1 } } });
      game.start('p1_noodle_dishwasher_01');
      while (game.state().dialogue!.exchange.id !== 'p1_noodle_dishwasher_01_e4') {
        game.reply(game.state().dialogue!.exchange.replies.findIndex(reply => reply.correct));
      }
      const { cup_count: cup, bowl_count: bowl } = game.state().dialogue!.bindings;
      expect(cup.id, `seed ${seed}`).not.toBe(bowl.id);
    }
  });
  it('finds the single permitted tuple whatever the seed', () => {
    const job = slotted(); job.exchanges[0].replies[1].hanzi = '一';
    for (let seed = 1; seed <= 30; seed++) {
      const game = createGame(content(job), { seed, initialWords: { 一: 'met', 二: 'met' } });
      game.start('job');
      expect(game.state().dialogue!.bindings.n.hanzi, `seed ${seed}`).toBe('二');
    }
  });
});
