import { describe, expect, it } from 'vitest';
import type { Scene, Word } from '../../src/content/types';
import { CommandError, createGame, currentSlots, GATE_WORDS, type GameContent } from '../../src/engine';
import { content, exchange, scene } from '../fixtures/engine';

const job = (overrides: Partial<Scene> = {}): Scene => scene({ exchanges: [exchange(), exchange('e2')], ...overrides });
const story = (overrides: Partial<Scene> = {}): Scene => job({ kind: 'story', reward: 0, ...overrides });

describe('scene availability', () => {
  it('honours minDay', () => {
    const game = createGame(content(job({ minDay: 3 })));
    expect(game.availableScenes()).toEqual([]);
    expect(() => game.start('job')).toThrow(CommandError);
    game.sleep(); game.sleep();
    expect(game.state().day).toBe(3);
    expect(game.availableScenes().map(item => item.id)).toEqual(['job']);
  });
  it('honours afterScenes and counts only successful completions', () => {
    const data = content(story({ id: 'intro' }), job({ afterScenes: ['intro'] }));
    const game = createGame(data);
    expect(game.availableScenes().map(item => item.id)).toEqual(['intro']);
    game.start('intro'); game.abandon();
    expect(game.availableScenes().map(item => item.id)).toEqual(['intro']);
    game.start('intro'); game.reply(0); game.reply(0);
    expect(game.state().progress.completedOn.intro).toBe(1);
    expect(game.availableScenes().map(item => item.id)).toContain('job');
  });
  it('honours allowedSlots against the derived slot of the day', () => {
    const data = content(job({ id: 'evening', allowedSlots: ['E'] }), job({ id: 'late', allowedSlots: ['A4'] }), job({ allowedSlots: ['A1'] }));
    const game = createGame(data, { actionSlots: 4 });
    expect(currentSlots(game.state())).toEqual(['M', 'A1']);
    expect(game.availableScenes().map(item => item.id)).toEqual(['job']);
    game.start('job'); game.reply(0); game.reply(0);
    expect(currentSlots(game.state())).toEqual(['A2']);
    expect(game.availableScenes()).toEqual([]);
    expect(() => game.start('late')).toThrow(/not available/);
    expect(game.state().dialogue).toBeNull();
  });
  it('opens A4 scenes on the fourth action and E scenes once slots are spent', () => {
    const data = content(job({ id: 'evening', kind: 'story', allowedSlots: ['E'] }), job({ id: 'late', allowedSlots: ['A4'] }), job());
    const game = createGame(data, { actionSlots: 2 });
    expect(game.availableScenes().map(item => item.id)).toEqual(['job']);
    game.start('job'); game.reply(0); game.reply(0);
    game.start('job'); game.reply(0); game.reply(0);
    expect(currentSlots(game.state())).toEqual(['E']);
    expect(game.availableScenes().map(item => item.id)).toEqual(['evening']);
  });
  it('blocks a second run of a non-repeatable scene and allows repeat shifts the same day', () => {
    const data = content(job({ id: 'once', repeatable: false }), job({ repeatable: true }));
    const game = createGame(data);
    game.start('once'); game.reply(0); game.reply(0);
    expect(game.availableScenes().map(item => item.id)).toEqual(['job']);
    expect(() => game.start('once')).toThrow(/not available/);
    for (let run = 0; run < 3; run++) { game.start('job'); game.reply(0); game.reply(0); }
    expect(game.state().progress.completedCount.job).toBe(3);
    expect(game.state().wallet).toBe(20 + 8 * 4);
  });
  it('keeps v1 content without scheduling metadata unrestricted', () => {
    const game = createGame(content());
    for (let run = 0; run < 3; run++) { game.start('job'); game.reply(0); }
    expect(game.state().actionSlots).toBe(1);
    expect(game.availableScenes().map(item => item.id)).toEqual(['job']);
  });
  it('lets a migrated onboarding waiver stand in for the curriculum-zero prerequisite', () => {
    const data = content(story({ id: 'intro', curriculumIndex: 0 }), job({ afterScenes: ['intro'] }));
    const waived = createGame(data, { progress: { onboardingWaived: true } });
    expect(waived.availableScenes().map(item => item.id)).toContain('job');
    const fresh = createGame(data);
    expect(fresh.availableScenes().map(item => item.id)).toEqual(['intro']);
  });
  it('rejects an unavailable start atomically and never lists consequences', () => {
    const data = content(job({ minDay: 5 }), scene({ id: 'wrong', kind: 'consequence', exchanges: [exchange()] }));
    const game = createGame(data), before = game.state();
    expect(game.availableScenes()).toEqual([]);
    expect(() => game.start('job')).toThrow(/not available/);
    expect(() => game.start('wrong')).toThrow(CommandError);
    expect(game.state()).toEqual(before);
  });
});

describe('penalty cap', () => {
  const penalised = (cost: number, exchanges = 4): GameContent => {
    const scenes = Array.from({ length: exchanges }, (_, index) => exchange(`e${index + 1}`));
    for (const item of scenes) item.onWrong = 'wrong';
    return content(scene({ exchanges: scenes }), scene({ id: 'wrong', kind: 'consequence', cost, exchanges: [exchange('retry')] }));
  };
  it('charges only the first miss of an exchange', () => {
    const game = createGame(penalised(2)); game.start('job');
    game.reply(1); expect(game.state().wallet).toBe(18);
    game.reply(0); game.reply(1); expect(game.state().wallet).toBe(18);
    expect(game.state().activity).toMatchObject({ parentSceneId: 'job', slotLabel: 'A1', penaltyTotal: 2, penalizedExchangeIds: ['job/e1'] });
  });
  it('caps the whole parent activity at five yuan', () => {
    const game = createGame(penalised(2)); game.start('job');
    for (let index = 0; index < 4; index++) { game.reply(1); game.reply(0); game.reply(0); }
    expect(game.state().activity).toBeNull();
    expect(game.state().wallet).toBe(20 - 5 + 8);
    const penalties = game.events().filter(event => event.type === 'transaction' && event.data.reason === 'penalty');
    expect(penalties.map(event => event.type === 'transaction' && event.data.amount)).toEqual([-2, -2, -1]);
  });
  it('keeps the first-miss ledger per scene so a consequence never spends the parent entry', () => {
    const game = createGame(penalised(2)); game.start('job');
    game.reply(1);
    expect(game.state().activity!.penalizedExchangeIds).toEqual(['job/e1']);
    expect(game.state().dialogue!.sceneId).toBe('wrong');
    expect(currentSlots(game.state())).toEqual(['A1']);
    game.reply(0);
    expect(game.state().activity!.penaltyTotal).toBe(2);
  });
  it('freezes the slot label for the whole activity', () => {
    const game = createGame(content()); game.start('job');
    expect(game.state().actionSlots).toBe(3);
    expect(currentSlots(game.state())).toEqual(['A1']);
    game.reply(0);
    expect(currentSlots(game.state())).toEqual(['A2']);
  });
  it('starts a fresh cap for the next activity', () => {
    const game = createGame(penalised(5)); game.start('job');
    game.reply(1); game.reply(0);
    for (let index = 0; index < 4; index++) game.reply(0);
    expect(game.state().wallet).toBe(20 - 5 + 8);
    game.start('job'); game.reply(1);
    expect(game.state().wallet).toBe(20 - 5 + 8 - 5);
  });
});

describe('scene purchases', () => {
  const shop = (mode: 'optional-entry' | 'withhold-first-reward', price: number, reward = 0): GameContent =>
    content(job({ kind: 'errand', reward, purchase: { itemId: 'fruit_portion', price, mode } }));
  it('charges an optional entry once and grants the item', () => {
    const game = createGame(shop('optional-entry', 3)); game.start('job');
    expect(game.state().wallet).toBe(17);
    expect(game.state().progress.inventory.fruit_portion).toBe(1);
    expect(game.state().activity!.pendingPurchase).toEqual({ itemId: 'fruit_portion', price: 3, mode: 'buy', charged: true });
    game.reply(0); game.reply(0);
    expect(game.state().wallet).toBe(17);
  });
  it('refuses an unaffordable buy without spending a slot and enters look mode on request', () => {
    const game = createGame(shop('optional-entry', 3), { wallet: 2 }), before = game.state();
    expect(() => game.start('job')).toThrow(/Not enough money/);
    expect(game.state()).toEqual(before);
    game.start('job', { purchase: 'look' });
    expect(game.state()).toMatchObject({ wallet: 2, actionSlots: 3 });
    expect(game.state().progress.inventory.fruit_portion).toBeUndefined();
    expect(game.state().activity!.pendingPurchase).toMatchObject({ mode: 'look', charged: false });
  });
  it('looks without charging even when the money is there', () => {
    const game = createGame(shop('optional-entry', 3)); game.start('job', { purchase: 'look' });
    expect(game.state().wallet).toBe(20);
    expect(game.state().progress.inventory.fruit_portion).toBeUndefined();
  });
  it('withholds the price from the first reward only, and never for an abandoned run', () => {
    const data = shop('withhold-first-reward', 6, 14);
    data.scenes[0].repeatable = true;
    const game = createGame(data);
    game.start('job'); game.abandon();
    expect(game.state()).toMatchObject({ wallet: 20, actionSlots: 3 });
    expect(game.state().progress.inventory.fruit_portion).toBeUndefined();
    game.start('job'); game.reply(0); game.reply(0);
    expect(game.state().wallet).toBe(28);
    expect(game.state().progress.inventory.fruit_portion).toBe(1);
    game.start('job'); game.reply(0); game.reply(0);
    expect(game.state().wallet).toBe(42);
  });
  it('never takes the wallet negative, charges partly, or hands out a free item', () => {
    const game = createGame(shop('withhold-first-reward', 20, 8), { wallet: 0 });
    game.start('job'); game.reply(0); game.reply(0);
    expect(game.state().wallet).toBe(8);
    expect(game.state().progress.inventory.fruit_portion).toBeUndefined();
  });
});

describe('guided consequence', () => {
  const guided = (): GameContent => {
    const first = exchange(), second = exchange('e2');
    first.guidedConsequence = 'detour';
    return content(scene({ exchanges: [first, second] }), scene({ id: 'detour', kind: 'consequence', cost: 3, exchanges: [exchange('d1')] }));
  };
  it('enters the consequence once, free of penalty and slots, then resumes the next exchange', () => {
    const game = createGame(guided()); game.start('job');
    expect(game.reply(0)).toBe(true);
    expect(game.state().dialogue!.sceneId).toBe('detour');
    expect(game.state()).toMatchObject({ wallet: 20, actionSlots: 3 });
    expect(game.state().activity!.guidedVisited).toEqual(['e1']);
    game.reply(0);
    expect(game.state().dialogue!.exchange.id).toBe('e2');
    game.reply(0);
    expect(game.state()).toMatchObject({ dialogue: null, wallet: 28, actionSlots: 3 });
  });
  it('survives an export in the middle of the detour', () => {
    const game = createGame(guided()); game.start('job'); game.reply(0);
    const resumed = createGame(guided()); resumed.importString(game.exportString());
    resumed.reply(0);
    expect(resumed.state().dialogue!.exchange.id).toBe('e2');
  });
});

describe('world tasks', () => {
  const delivery = (): GameContent => {
    const first = exchange();
    first.taskAfterCorrect = { taskId: 'gate_delivery', targetTriggerId: 'gate', propId: 'parcel' };
    return content(scene({ exchanges: [first, exchange('e2')] }));
  };
  it('holds the activity open until the task completes', () => {
    const game = createGame(delivery()); game.start('job'); game.reply(0);
    expect(game.state().pendingWorldTask).toEqual({ taskId: 'gate_delivery', parentSceneId: 'job', exchangeId: 'e1', targetTriggerId: 'gate', propId: 'parcel' });
    expect(game.state().dialogue!.exchange.id).toBe('e1');
    expect(() => game.reply(0)).toThrow(/pending task/);
    expect(() => game.completeWorldTask('other')).toThrow(/Unknown world task/);
    game.completeWorldTask('gate_delivery');
    expect(game.state().pendingWorldTask).toBeNull();
    expect(game.state().dialogue!.exchange.id).toBe('e2');
    expect(() => game.completeWorldTask('gate_delivery')).toThrow(/No pending world task/);
    game.reply(0);
    expect(game.state()).toMatchObject({ dialogue: null, wallet: 28, actionSlots: 3 });
  });
  it('persists across a save and clears on sleep', () => {
    const game = createGame(delivery()); game.start('job'); game.reply(0);
    const resumed = createGame(delivery()); resumed.importString(game.exportString());
    expect(resumed.state().pendingWorldTask?.taskId).toBe('gate_delivery');
    resumed.sleep();
    expect(resumed.state()).toMatchObject({ pendingWorldTask: null, dialogue: null, day: 2, wallet: 18 });
  });
});

describe('assistance, exposure, abandon and the gate', () => {
  it('abandons without reward, keeps the spent slot and the day', () => {
    const game = createGame(content()), ends: unknown[] = [];
    game.on('sceneEnd', event => ends.push(event));
    game.start('job'); game.abandon();
    expect(game.state()).toMatchObject({ dialogue: null, returns: [], activity: null, day: 1, wallet: 20, actionSlots: 3 });
    expect(ends).toEqual([{ sceneId: 'job', reward: 0, abandoned: true }]);
    expect(game.events().at(-1)?.type).toBe('activityEnd');
    expect(() => game.abandon()).toThrow(CommandError);
  });
  it('suppresses upward evidence for assisted words in the same exchange', () => {
    const game = createGame(content(), { initialWords: { 杯子: 'met' } });
    game.start('job'); game.markAssisted(['杯子'], 'hint'); game.reply(0);
    expect(game.state().words['杯子'].state).toBe('met');
    expect(game.events().filter(event => event.type === 'assisted').map(event => event.data)).toEqual([
      { sceneId: 'job', exchangeId: 'e1', words: ['杯子'], reason: 'hint' },
    ]);
    expect(game.state().activity).toBeNull();
    const fresh = createGame(content(), { initialWords: { 杯子: 'met' } });
    fresh.start('job'); fresh.reply(0);
    expect(fresh.state().words['杯子'].state).toBe('shaky');
  });
  it('rejects assistance for words outside the exchange', () => {
    const game = createGame(content()); game.start('job');
    expect(() => game.markAssisted(['陌生'], 'gloss')).toThrow(CommandError);
  });
  it('records ambient exposure without correctness and validates the dictionary', () => {
    const data = content();
    data.words = [{ hanzi: '杯子', pinyin: 'bēizi', en: 'cup', hsk: 1 }];
    const game = createGame(data);
    game.recordExposure(['杯子'], 'street_sign');
    expect(game.state().words['杯子']).toMatchObject({ state: 'met', firstSeen: { location: 'street_sign', sentence: '杯子' } });
    game.recordExposure(['杯子'], 'street_sign');
    expect(game.state().words['杯子'].state).toBe('met');
    expect(() => game.recordExposure(['陌生'], 'street_sign')).toThrow(CommandError);
  });
  it('reports the gate and records the milestone once', () => {
    const words: Word[] = Array.from({ length: GATE_WORDS }, (_, index) => ({ hanzi: `w${index}`, pinyin: 'x', en: 'x', hsk: 1 }));
    const data = content(); data.words = [...words, { hanzi: '碗', pinyin: 'wǎn', en: 'bowl', hsk: 1, bonus: true }];
    const short = createGame(data, { wallet: 200, initialWords: Object.fromEntries(words.slice(0, 149).map(word => [word.hanzi, 'met' as const])) });
    expect(short.queryGate()).toEqual({ met: 149, total: 150, savings: 200, target: 150, open: false });
    expect(() => short.claimGate()).toThrow(CommandError);
    const met = Object.fromEntries(words.map(word => [word.hanzi, 'met' as const]));
    const poor = createGame(data, { wallet: 149, initialWords: met });
    expect(poor.queryGate().open).toBe(false);
    const game = createGame(data, { wallet: 150, initialWords: met });
    expect(game.queryGate()).toMatchObject({ met: 150, savings: 150, open: true });
    expect(game.claimGate()).toBe(1);
    expect(game.state().progress.gateReachedDay).toBe(1);
    expect(game.events().filter(event => event.type === 'gate')).toHaveLength(1);
    game.sleep();
    expect(game.queryGate().open).toBe(true);
    expect(game.claimGate()).toBe(1);
  });
});

describe('durable progress hygiene', () => {
  it('records curriculum scenes and leaves ordinary consequences out of progress', () => {
    const data = content(scene({ exchanges: [(() => { const first = exchange(); first.onWrong = 'wrong'; return first; })()] }),
      scene({ id: 'wrong', kind: 'consequence', cost: 1, exchanges: [exchange('retry')] }));
    const game = createGame(data); game.start('job'); game.reply(1); game.reply(0); game.reply(0);
    expect(game.state().progress.completedOn).toEqual({ job: 1 });
    expect(game.state().progress.completedCount).toEqual({ job: 1 });
  });
  it('never debits savings when the gate milestone is claimed', () => {
    const words: Word[] = Array.from({ length: GATE_WORDS }, (_, index) => ({ hanzi: `w${index}`, pinyin: 'x', en: 'x', hsk: 1 }));
    const data = content(); data.words = words;
    const game = createGame(data, { wallet: 400, rentCost: 20, initialWords: Object.fromEntries(words.map(word => [word.hanzi, 'met' as const])) });
    game.claimGate();
    expect(game.state()).toMatchObject({ wallet: 400, rentDue: false });
  });
});

describe('engine events', () => {
  it('keeps the nine original names, adds four, and numbers every command', () => {
    const game = createGame(content(scene({ reward: 8, purchase: { itemId: 'fruit_portion', price: 2, mode: 'optional-entry' } })));
    const seen: string[] = [];
    for (const name of ['sceneStart', 'exchange', 'reply', 'hint', 'word', 'sceneEnd', 'rentDue', 'day', 'change', 'transaction', 'assisted', 'gate', 'activityEnd'] as const) {
      game.on(name, () => seen.push(name));
    }
    game.start('job'); game.markAssisted(['杯子'], 'pinyin-default'); game.reply(1); game.reply(1); game.reply(0); game.sleep();
    expect(new Set(seen)).toEqual(new Set(['sceneStart', 'exchange', 'reply', 'hint', 'word', 'sceneEnd', 'day', 'change', 'transaction', 'assisted', 'activityEnd']));
    const events = game.events();
    expect(events.every(event => event.day >= 1 && Number.isInteger(event.seq))).toBe(true);
    expect(events.map(event => event.seq)).toEqual([...events.map(event => event.seq)].sort((left, right) => left - right));
    expect(new Set(events.filter(event => event.type === 'sceneStart').map(event => event.seq)).size).toBe(1);
    expect(events.at(-1)?.seq).toBe(6);
  });
});
