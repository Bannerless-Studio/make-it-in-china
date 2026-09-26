import { describe, expect, it } from 'vitest';
import { createGame, decodeSave, decodeText, encodeSave, EVENT_LIMIT, loadJSON, migrateV1, SaveError, UnsupportedSaveVersionError } from '../../src/engine';
import { content, slotted, withConsequence } from '../fixtures/engine';
import { V1_OPEN_CONSEQUENCE, V1_PLAIN } from '../fixtures/save-v1';

describe('versioned saves', () => {
  it('round-trips JSON and base64 including Unicode and instrumentation', () => {
    const game = createGame(content()); game.start('job'); game.tapWord('杯子');
    expect(loadJSON(game.saveJSON())).toEqual(game.state()); expect(JSON.parse(game.saveJSON()).v).toBe(2);
    const resumed = createGame(content()); resumed.importString(game.exportString()); expect(resumed.state()).toEqual(game.state());
    resumed.reply(0); game.reply(0); expect(resumed.state()).toEqual(game.state());
  });
  it('restores a mid-consequence return stack', () => {
    const game = createGame(withConsequence()); game.start('job'); game.reply(1);
    const resumed = createGame(withConsequence()); resumed.importString(game.exportString()); resumed.reply(0);
    expect(resumed.state().dialogue!.sceneId).toBe('job'); expect(resumed.state().dialogue!.attempts.e1).toBe(1);
    expect(resumed.state().wallet).toBe(18);
  });
  it('restores RNG and tuning rules for identical future choices', () => {
    const data = content(slotted()), game = createGame(data, { seed: 42, foodCost: 0, initialWords: { 一: 'met', 二: 'met', 三: 'met' } });
    game.start('job'); game.reply(0); const resumed = createGame(data); resumed.importString(game.exportString());
    game.start('job'); resumed.start('job'); expect(resumed.state()).toEqual(game.state());
  });
  it('throws a typed error for unknown save versions', () => {
    try { loadJSON('{"v":3}'); throw new Error('Expected version rejection'); }
    catch (error) { expect(error).toBeInstanceOf(UnsupportedSaveVersionError); expect((error as UnsupportedSaveVersionError).version).toBe(3); }
  });
  it.each(['{', 'null', '[]', '{"v":2}', '{"v":2,"wallet":-1}'])('rejects malformed JSON/state %s', json => {
    expect(() => loadJSON(json)).toThrow(SaveError);
  });
  it('rejects invalid base64 without replacing the current state', () => {
    const game = createGame(content()); const before = game.state();
    expect(() => game.importString('%%%')).toThrow(SaveError); expect(game.state()).toEqual(before);
  });
  it('rejects structurally invalid saved frames', () => {
    const game = createGame(content()); game.start('job'); const state = game.state(); state.dialogue!.exchange.line.words = null as never;
    expect(() => game.importString(encodeSave(state))).toThrow(SaveError);
  });
  it('rejects a hand-edited save whose open dialogue has no activity', () => {
    const game = createGame(content()); game.start('job');
    const state = game.state(); state.activity = null;
    expect(() => game.importString(encodeSave(state))).toThrow(SaveError);
    expect(game.state().activity).not.toBeNull();
  });
  it('rejects a pending world task that does not match the open exchange', () => {
    const game = createGame(content()); game.start('job');
    const state = game.state();
    state.pendingWorldTask = { taskId: 't', parentSceneId: 'job', exchangeId: 'nope', targetTriggerId: 'gate', propId: 'parcel' };
    expect(() => game.importString(encodeSave(state))).toThrow(SaveError);
    state.pendingWorldTask = { taskId: 't', parentSceneId: 'other', exchangeId: 'e1', targetTriggerId: 'gate', propId: 'parcel' };
    expect(() => game.importString(encodeSave(state))).toThrow(SaveError);
  });
  it('rejects a saved exchange index inconsistent with content', () => {
    const game = createGame(content()); game.start('job'); const state = game.state(); state.dialogue!.index = 99;
    expect(() => game.importString(encodeSave(state))).toThrow(SaveError);
  });
  it('caps loaded and newly appended events at 2000 while preserving order', () => {
    const game = createGame(content(), { initialWords: { 杯子: 'met' } }), state = loadJSON(game.saveJSON());
    state.events = Array.from({ length: EVENT_LIMIT + 5 }, (_, i) => ({ type: 'day' as const, day: 1, seq: 1, data: { day: i + 1, rentDue: false, graceUntil: null } }));
    const loaded = loadJSON(JSON.stringify(state)); expect(loaded.events).toHaveLength(EVENT_LIMIT); expect(loaded.events[0].data).toMatchObject({ day: 6 });
    game.importString(encodeSave(state)); game.tapWord('杯子'); const events = game.events();
    expect(events).toHaveLength(EVENT_LIMIT); expect(events[0].data).toMatchObject({ day: 7 }); expect(events.at(-1)?.type).toBe('word');
    const resumed = createGame(content()); resumed.importString(game.exportString()); expect(resumed.events()).toEqual(events);
  });
  it.each([{ actionSlots: 0 }, { foodCost: -1 }, { decayDays: 0 }, { graceDays: 0 }, { wrongPenalty: 6 }])('rejects invalid tuning %j', options => {
    expect(() => createGame(content(), options)).toThrow(/Invalid option:/);
  });
});

describe('v1 to v2 migration', () => {
  it('rejects a v1 envelope through the strict loaders', () => {
    for (const load of [() => decodeSave(V1_PLAIN), () => loadJSON(decodeText(V1_PLAIN))]) {
      try { load(); throw new Error('Expected version rejection'); }
      catch (error) { expect(error).toBeInstanceOf(UnsupportedSaveVersionError); expect((error as UnsupportedSaveVersionError).version).toBe(1); }
    }
  });
  it('imports a captured v1 export, preserving wallet, day, words and the open exchange', () => {
    const game = createGame(content());
    game.importString(V1_PLAIN);
    expect(game.state()).toMatchObject({ v: 2, wallet: 20, day: 1, actionSlots: 3, rng: 7, commandSeq: 4, pendingWorldTask: null });
    expect(game.events().map(event => event.seq)).toEqual([1, 2, 3, 4]);
    expect(game.state().words['杯子']).toEqual({ state: 'met', lastSeen: 1, firstSeen: { location: 'shop', sentence: '杯子', audio: 'cup' } });
    expect(game.state().dialogue).toMatchObject({ sceneId: 'job', index: 0, exchange: { id: 'e1' } });
    expect(game.state().progress).toEqual({ completedOn: {}, completedCount: {}, inventory: {}, mentorTopics: [], gateReachedDay: null, onboardingWaived: false });
    expect(game.state().activity).toMatchObject({ parentSceneId: 'job', slotLabel: 'A1', penaltyTotal: 0 });
    expect(game.events().at(-1)!.seq).toBeLessThan(game.state().commandSeq + 1);
    expect(JSON.parse(game.saveJSON()).v).toBe(2);
    game.reply(0);
    expect(game.state().wallet).toBe(28);
  });
  it('keeps a mid-consequence v1 stack playable and pays no replay wage', () => {
    const game = createGame(withConsequence());
    game.importString(V1_OPEN_CONSEQUENCE);
    expect(game.state()).toMatchObject({ wallet: 18, actionSlots: 3 });
    expect(game.state().dialogue!.sceneId).toBe('wrong');
    expect(game.state().returns.map(frame => frame.sceneId)).toEqual(['job']);
    game.reply(0);
    expect(game.state().dialogue!.sceneId).toBe('job');
    expect(game.state().wallet).toBe(18);
  });
  it('re-imports its own v2 output without paying twice', () => {
    const game = createGame(content());
    game.importString(V1_PLAIN);
    const migrated = game.exportString();
    game.importString(migrated); game.importString(migrated);
    expect(game.state().wallet).toBe(20);
    expect(game.state().progress.completedCount).toEqual({});
  });
  it('waives onboarding only when every starter word is already met', () => {
    const json = decodeText(V1_PLAIN);
    expect(migrateV1(json, { starterWords: ['杯子'] }).progress.onboardingWaived).toBe(true);
    expect(migrateV1(json, { starterWords: ['杯子', '碗'] }).progress.onboardingWaived).toBe(false);
    expect(migrateV1(json).progress.onboardingWaived).toBe(false);
  });
});
