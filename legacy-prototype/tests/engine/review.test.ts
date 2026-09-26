import { describe, expect, it, vi } from 'vitest';
import { CommandError, ContentError, createGame, loadJSON } from '../../src/engine';
import { content, exchange, scene, slotted, withConsequence } from '../fixtures/engine';
import { fillExchange } from '../../src/engine/slots';

const linked = () => {
  const first = scene(); first.exchanges[0].replies[0].next = 'target';
  return content(first, scene({ id: 'target', kind: 'story', reward: 3 }));
};
const replyWord = () => {
  const data = content(); data.scenes[0].exchanges[0].replies[1] = { hanzi: '不', pinyin: 'bù', en: 'no', words: ['不'], action: 'no', correct: false };
  return data;
};
describe('R1 engine regressions', () => {
  it('B1: rejects an ineligible later pool before consuming an action', () => {
    const job = slotted(); job.exchanges.unshift(exchange('intro'));
    const game = createGame(content(job)), before = game.state();
    expect(game.availableScenes()).toEqual([]); expect(() => game.start('job')).toThrow(ContentError); expect(game.state()).toEqual(before);
  });
  it('B1: rejects a locked cross-scene destination up front', () => {
    const data = linked(); data.scenes[1].requires = ['茶']; const game = createGame(data);
    expect(game.availableScenes()).toEqual([]); expect(() => game.start('job')).toThrow(CommandError);
  });
  it('B1: budgets action slots across cross-scene routes', () => {
    const data = linked(); data.scenes[1].kind = 'job'; const game = createGame(data, { actionSlots: 1 });
    expect(game.availableScenes().map(scene => scene.id)).toEqual(['target']); expect(() => game.start('job')).toThrow(CommandError);
  });
  it('B1: sleep abandons a dialogue without wages and still advances the day', () => {
    const game = createGame(content()); game.start('job'); game.sleep();
    expect(game.state()).toMatchObject({ day: 2, wallet: 18, dialogue: null, returns: [], actionSlots: 4 });
    expect(game.events().find(event => event.type === 'sceneEnd')?.data).toEqual({ sceneId: 'job', reward: 0, abandoned: true });
  });
  it('B1: sleep abandons both a consequence and its suspended parent', () => {
    const game = createGame(withConsequence()); game.start('job'); game.reply(1); game.sleep();
    expect(game.events().filter(event => event.type === 'sceneEnd').map(event => event.data)).toEqual([
      { sceneId: 'wrong', reward: 0, abandoned: true }, { sceneId: 'job', reward: 0, abandoned: true },
    ]); expect(game.state()).toMatchObject({ dialogue: null, returns: [], wallet: 16 });
  });
  it('B1: listings are empty during dialogue and exclude exhausted actions', () => {
    const game = createGame(content(), { actionSlots: 1 }); game.start('job'); expect(game.availableScenes()).toEqual([]);
    game.reply(0); expect(game.availableScenes()).toEqual([]);
  });
  it('S1: consequences cannot be listed or started directly even with met prerequisites', () => {
    const game = createGame(withConsequence(), { initialWords: { 未见: 'met' } });
    expect(game.availableScenes().map(scene => scene.id)).toEqual(['job']); expect(() => game.start('wrong')).toThrow(CommandError);
    expect(game.state().wallet).toBe(20);
  });
  it.each([undefined, 'reply-no'])('S2: reply notebook attribution preserves optional audio %s', audio => {
    const data = replyWord(); data.scenes[0].exchanges[0].replies[1].audio = audio;
    const game = createGame(data); game.start('job'); game.reply(1);
    expect(game.state().words['不'].firstSeen).toEqual({ location: 'shop', sentence: '不', ...(audio ? { audio } : {}) });
    const restored = createGame(data); restored.importString(game.exportString()); expect(restored.state().words['不']).toEqual(game.state().words['不']);
  });
  it('S3: unseen reply words can be tapped, meeting them before lowering evidence', () => {
    const game = createGame(replyWord()); game.start('job'); game.tapWord('不');
    expect(game.state().words['不']).toMatchObject({ state: 'met', firstSeen: { sentence: '不' } });
    expect(game.events().flatMap(event => event.type === 'word' && event.data.word === '不' ? [event.data.reason] : [])).toEqual(['seen', 'tap']);
  });
  it('S3: unrelated unseen words are still rejected', () => {
    const game = createGame(replyWord()); game.start('job'); expect(() => game.tapWord('陌生')).toThrow(CommandError);
  });
  it('S4: day 14 re-arms grace with one outstanding week and emits rentDue', () => {
    const game = createGame(content(), { wallet: 5, foodCost: 0, rentCost: 20, graceDays: 10 });
    for (let i = 1; i < 14; i++) game.sleep();
    expect(game.state()).toMatchObject({ wallet: 5, rentDue: true, graceUntil: 24 });
    expect(game.events().filter(event => event.type === 'rentDue').map(event => event.data)).toEqual([
      { amount: 20, graceUntil: 17 }, { amount: 20, graceUntil: 24 },
    ]);
  });
  it('S5: cross-scene routing pays and emits sceneEnd before target sceneStart', () => {
    const game = createGame(linked()); game.start('job'); game.reply(0);
    expect(game.state()).toMatchObject({ wallet: 28, dialogue: { sceneId: 'target' } });
    expect(game.events().filter(event => event.type === 'sceneStart' || event.type === 'sceneEnd').map(event => [event.type, event.data.sceneId])).toEqual([
      ['sceneStart', 'job'], ['sceneEnd', 'job'], ['sceneStart', 'target'],
    ]);
  });
  it('S8: state snapshots do not clone analytics; events() is isolated', () => {
    const game = createGame(content()); game.start('job'); const spy = vi.spyOn(globalThis, 'structuredClone');
    game.state(); expect(spy.mock.calls.every(([value]) => !value || typeof value !== 'object' || !Object.hasOwn(value, 'events'))).toBe(true); spy.mockRestore();
    const events = game.events(); events.length = 0; expect(game.events().length).toBeGreaterThan(0);
  });
  it('S8: legacy state.events remains lazily available for the existing main entrypoint', () => {
    const game = createGame(content()); game.start('job'); const snapshot = game.state();
    expect(Object.getOwnPropertyDescriptor(snapshot, 'events')?.get).toBeTypeOf('function');
    expect(snapshot.events).toEqual(game.events()); snapshot.events.length = 0; expect(game.events().length).toBeGreaterThan(0);
  });
  it('S9: newWords lives in frames and exchange payloads and survives import', () => {
    const game = createGame(content()); game.start('job'); expect(game.state().dialogue!.newWords).toEqual(['杯子']);
    expect(game.events().find(event => event.type === 'exchange')?.data).toMatchObject({ newWords: ['杯子'] });
    const restored = createGame(content()); restored.importString(game.exportString()); expect(restored.state().dialogue!.newWords).toEqual(['杯子']);
    restored.reply(0); restored.start('job'); expect(restored.state().dialogue!.newWords).toEqual([]);
  });
  it('S9: gloss returns a detached content word or undefined', () => {
    const data = content(); data.words = [{ hanzi: '杯子', pinyin: 'bēizi', en: 'cup', hsk: 1 }]; const game = createGame(data);
    expect(game.gloss('杯子')).toEqual(data.words[0]); game.gloss('杯子')!.en = 'changed'; expect(game.gloss('杯子')!.en).toBe('cup'); expect(game.gloss('missing')).toBeUndefined();
  });
  it('review S9: wrong next resumes at the named exchange after a consequence', () => {
    const data = withConsequence(); data.scenes[0].exchanges[0].replies[1].next = 'e2';
    const game = createGame(data); game.start('job'); game.reply(1); game.reply(0); expect(game.state().dialogue!.exchange.id).toBe('e2');
  });
  it('distinct fill: rejects identical static replies at start', () => {
    const data = content(); data.scenes[0].exchanges[0].replies[1].hanzi = '好';
    const game = createGame(data); expect(game.availableScenes()).toEqual([]); expect(() => game.start('job')).toThrow(/e1/);
  });
  it('distinct fill: repicks a colliding number deterministically', () => {
    const job = slotted(); job.exchanges[0].replies[1].hanzi = '一';
    const game = createGame(content(job), { seed: 1, initialWords: { 一: 'met', 二: 'met', 三: 'met' } }); game.start('job');
    expect(game.state().dialogue!.exchange.replies.map(reply => reply.hanzi)).toEqual(['二', '一']);
  });
  it('distinct fill: fails fast when only a colliding pool value is eligible', () => {
    const job = slotted(); job.exchanges[0].replies[1].hanzi = '一';
    const game = createGame(content(job), { initialWords: { 一: 'met' } }); expect(game.availableScenes()).toEqual([]);
    expect(() => game.start('job')).toThrow(ContentError);
  });
  it('distinct fill: catches inherited slot collisions before the binding is presented', () => {
    const job = slotted(), later = exchange('later'); later.replies[0].hanzi = '{n}个'; later.replies[1].hanzi = '一个'; job.exchanges.push(later);
    const game = createGame(content(job), { seed: 1, initialWords: { 一: 'met', 二: 'met', 三: 'met' } });
    game.start('job'); expect(game.state().dialogue!.bindings.n.hanzi).toBe('二'); game.reply(0);
    expect(game.state().dialogue!.exchange.replies.map(reply => reply.hanzi)).toEqual(['二个', '一个']);
  });
  it('N RNG: pins the first seed-one draw to the shipped LCG', () => {
    const game = createGame(content(slotted()), { seed: 1, initialWords: { 一: 'met', 二: 'met', 三: 'met' } }); game.start('job');
    expect(game.state().rng).toBe(1015568748); expect(game.state().dialogue!.bindings.n.hanzi).toBe('一');
  });
  it('save schema contains retained newWords and events independently of state snapshots', () => {
    const game = createGame(content()); game.start('job'); const saved = loadJSON(game.saveJSON());
    expect(saved.dialogue!.newWords).toEqual(['杯子']); expect(saved.events).toEqual(game.events());
  });
  it('distinct fill: refuses without a draw when no permitted tuple is distinct', () => {
    const job = slotted(); job.exchanges[0].replies = ['{n}', '一', '二', '三'].map((hanzi, index) => ({ hanzi, action: 'choose', correct: index === 0 }));
    const data = content(job), game = createGame(data, { initialWords: { 一: 'met', 二: 'met', 三: 'met' } });
    const state = loadJSON(game.saveJSON());
    expect(() => fillExchange(state, job, job.exchanges[0], {}, data)).toThrow(/No distinct slot values for e1/);
    expect(state.rng).toBe(1);
    expect(game.availableScenes()).toEqual([]); expect(() => game.start('job')).toThrow(ContentError);
  });
  it('N introduction: values introduced by the exchange get a turn before already-known values', () => {
    const job = slotted(); job.exchanges[0].introduces = ['二', '三'];
    const game = createGame(content(job), { initialWords: { 一: 'known' } }); game.start('job');
    expect(['二', '三']).toContain(game.state().dialogue!.bindings.n.hanzi);
  });
  it('N nesting: caps consequence chains and sleep remains an escape', () => {
    const data = withConsequence(); data.scenes[1].exchanges[0].onWrong = 'wrong';
    const game = createGame(data); game.start('job'); for (let i = 0; i < 32; i++) game.reply(1);
    expect(() => game.reply(1)).toThrow(/nesting/); expect(game.state().returns).toHaveLength(32);
    game.sleep(); expect(game.state()).toMatchObject({ dialogue: null, returns: [], day: 2 });
  });
  it('S9: saved consequence returns retain parent newWords', () => {
    const data = withConsequence(), game = createGame(data); game.start('job'); game.reply(1);
    const restored = createGame(data); restored.importString(game.exportString()); restored.reply(0);
    expect(restored.state().dialogue!.newWords).toEqual(['杯子']);
  });
  it('review S9: wrong next routes directly when no consequence is declared', () => {
    const job = scene({ exchanges: [exchange(), exchange('e2')] }); job.exchanges[0].replies[1].next = 'e2';
    const game = createGame(content(job)); game.start('job'); expect(game.reply(1)).toBe(false);
    expect(game.state().dialogue!.exchange.id).toBe('e2');
  });
  it('S2: correct reply-only words use reply attribution without replacing line origins', () => {
    const data = replyWord(); data.scenes[0].exchanges[0].replies[1].correct = true;
    const game = createGame(data); game.start('job'); game.reply(1);
    expect(game.state().words['不']).toMatchObject({ state: 'shaky', firstSeen: { sentence: '不' } });
    expect(game.state().words['杯子'].firstSeen).toEqual({ location: 'shop', sentence: '杯子', audio: 'cup' });
  });
  it('loads older v1 dialogue saves that predate newWords', () => {
    const game = createGame(content()); game.start('job'); const legacy = JSON.parse(game.saveJSON()); delete legacy.dialogue.newWords;
    expect(loadJSON(JSON.stringify(legacy)).dialogue!.newWords).toEqual([]);
  });
});
