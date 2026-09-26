import { describe, expect, it } from 'vitest';
import { CommandError, ContentError, createGame } from '../../src/engine';
import { content, exchange, scene, slotted, withConsequence } from '../fixtures/engine';

describe('dialogue routing and events', () => {
  it('runs exchanges to completion and pays the reward once', () => {
    const game = createGame(content()), ends: string[] = [];
    game.on('sceneEnd', event => ends.push(event.sceneId)); game.start('job');
    expect(game.reply(0)).toBe(true); expect(game.state().dialogue).toBeNull(); expect(game.state().wallet).toBe(28);
    expect(ends).toEqual(['job']); expect(() => game.reply(0)).toThrow(CommandError); expect(game.state().wallet).toBe(28);
  });
  it('routes wrong replies into locked consequences and returns to the same exchange', () => {
    const game = createGame(withConsequence()); game.start('job'); expect(game.reply(1)).toBe(false);
    expect(game.state().dialogue!.sceneId).toBe('wrong'); expect(game.state().wallet).toBe(18);
    game.reply(0); expect(game.state().dialogue!.exchange.id).toBe('e1');
    expect(game.state().wallet).toBe(18); expect(game.state().actionSlots).toBe(3);
    game.reply(0); expect(game.state().dialogue!.exchange.id).toBe('e2'); game.reply(0); expect(game.state().wallet).toBe(26);
  });
  it('preserves slots, RNG, and miss counts through consequence retries', () => {
    const data = withConsequence(); data.scenes[0] = slotted(); data.scenes[0].exchanges[0].onWrong = 'wrong';
    const game = createGame(data, { initialWords: { 一: 'met', 二: 'met' } }); game.start('job');
    const first = game.state(); game.reply(1); game.reply(0);
    expect(game.state().dialogue!.exchange).toEqual(first.dialogue!.exchange); expect(game.state().rng).toBe(first.rng);
    expect(game.state().dialogue!.attempts.e1).toBe(1);
  });
  it('emits a hint on the second miss of the same exchange, surviving a save', () => {
    const game = createGame(withConsequence()); game.start('job'); game.reply(1); game.reply(0);
    const resumed = createGame(withConsequence()); resumed.importString(game.exportString());
    const hints: number[] = []; resumed.on('hint', event => { hints.push(event.attempts); expect(event.simplified).toBe('cup'); });
    resumed.reply(1); expect(hints).toEqual([2]); resumed.reply(0); resumed.reply(1); expect(hints).toEqual([2, 3]);
  });
  it('tracks misses separately for different exchanges', () => {
    const game = createGame(withConsequence()); game.start('job'); game.reply(1); game.reply(0); game.reply(0); game.reply(1);
    expect(game.events().filter(event => event.type === 'hint')).toHaveLength(0);
  });
  it('retries in place without an onWrong route', () => {
    const game = createGame(content()); game.start('job'); game.reply(1); game.reply(1);
    expect(game.state().dialogue!.exchange.id).toBe('e1'); expect(game.events().filter(event => event.type === 'hint')).toHaveLength(1);
  });
  it('uses correct as authoritative and logs opaque checks unchanged', () => {
    const data = content(); data.scenes[0].exchanges[0].replies[0].check = 'unknown_future_check';
    const game = createGame(data); game.start('job'); expect(game.reply(0)).toBe(true);
    expect(game.events().find(event => event.type === 'reply')?.data).toMatchObject({ correct: true, check: 'unknown_future_check' });
  });
  it('does not infer correctness from a check or missing correct flag', () => {
    const data = content(); delete data.scenes[0].exchanges[0].replies[0].correct; data.scenes[0].exchanges[0].replies[0].check = 'count_and_table';
    const game = createGame(data); game.start('job'); expect(game.reply(0)).toBe(false);
  });
  it('supports explicit next exchange and next scene routes', () => {
    const first = exchange(); first.replies[0].next = 'last'; const last = exchange('last'); last.replies[0].next = 'end';
    const game = createGame(content(scene({ exchanges: [first, exchange('skip'), last] }), scene({ id: 'end', kind: 'story' })));
    game.start('job'); game.reply(0); expect(game.state().dialogue!.exchange.id).toBe('last');
    game.reply(0); expect(game.state().dialogue!.sceneId).toBe('end');
  });
  it.each([-1, 2, 0.5, NaN])('rejects invalid reply %s atomically', index => {
    const game = createGame(content()); game.start('job'); const before = game.state();
    expect(() => game.reply(index)).toThrow(CommandError); expect(game.state()).toEqual(before);
  });
  it('rejects unknown scenes and missing onWrong routes as content errors', () => {
    expect(() => createGame(content()).start('missing')).toThrow(ContentError);
    const data = content(); data.scenes[0].exchanges[0].onWrong = 'missing'; expect(() => createGame(data).start('job')).toThrow(ContentError);
  });
  it('keeps snapshots, available scenes, and emitted payloads isolated from mutations', () => {
    const game = createGame(content()); game.on('exchange', event => { event.exchange.line.hanzi = 'changed'; });
    game.availableScenes()[0].reward = 1000; game.start('job'); const copy = game.state(); copy.wallet = -1;
    expect(game.state().dialogue!.exchange.line.hanzi).toBe('杯子'); expect(game.state().wallet).toBe(20);
    expect(game.events().find(event => event.type === 'exchange')?.data).toMatchObject({ exchange: { line: { hanzi: '杯子' } } });
  });
  it('unsubscribes listeners and emits change after commands commit', () => {
    const game = createGame(content()), slots: number[] = []; const off = game.on('change', () => slots.push(game.state().actionSlots));
    game.start('job'); off(); game.reply(0); expect(slots).toEqual([3]);
  });
  it('prevents starting another scene during a dialogue', () => {
    const game = createGame(content()); game.start('job'); const before = game.state();
    expect(() => game.start('job')).toThrow(CommandError); expect(game.state()).toEqual(before);
  });
});
