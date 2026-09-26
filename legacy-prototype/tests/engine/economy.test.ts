import { describe, expect, it } from 'vitest';
import { CommandError, ContentError, createGame } from '../../src/engine';
import { content, scene, withConsequence } from '../fixtures/engine';

describe('economy and day cycle', () => {
  it.each(['job', 'errand', 'mentor'] as const)('%s consumes one slot', kind => {
    const game = createGame(content(scene({ kind }))); game.start('job'); expect(game.state().actionSlots).toBe(3);
  });
  it.each(['story'] as const)('%s does not consume a slot', kind => {
    const game = createGame(content(scene({ kind }))); game.start('job'); expect(game.state().actionSlots).toBe(4);
  });
  it('blocks a fifth action and restores the default four on sleep', () => {
    const game = createGame(content()); for (let i = 0; i < 4; i++) { game.start('job'); game.reply(0); }
    expect(game.state().actionSlots).toBe(0); expect(() => game.start('job')).toThrow(CommandError);
    game.sleep(); expect(game.state().day).toBe(2); expect(game.state().actionSlots).toBe(4); game.start('job');
  });
  it('supports configurable daily slots and charges daily food', () => {
    const game = createGame(content(), { wallet: 10, actionSlots: 2, foodCost: 3 }); game.sleep();
    expect(game.state()).toMatchObject({ day: 2, wallet: 7, actionSlots: 2 });
  });
  it('floors wallet at zero for wrong replies, scene costs, and food', () => {
    const game = createGame(content(scene({ cost: 5, reward: 0 })), { wallet: 1 }); game.start('job');
    expect(game.state().wallet).toBe(0); game.reply(1); expect(game.state().wallet).toBe(0); game.reply(0); game.sleep(); expect(game.state().wallet).toBe(0);
  });
  it.each([[0, 19], [1, 19], [2, 18], [100, 15]])('caps consequence cost %s to a single 1–5 yuan penalty', (cost, wallet) => {
    const data = withConsequence(); data.scenes[1].cost = cost; const game = createGame(data); game.start('job'); game.reply(1);
    expect(game.state().wallet).toBe(wallet); game.reply(0);
    expect(game.state().wallet).toBe(wallet);
  });
  it('can charge one action slot instead of any yuan and never goes below zero', () => {
    const game = createGame(withConsequence(), { wrongPenalty: 'action', actionSlots: 1 }); game.start('job'); game.reply(1);
    expect(game.state()).toMatchObject({ wallet: 20, actionSlots: 0 }); game.reply(0); game.reply(1);
    expect(game.state()).toMatchObject({ wallet: 20, actionSlots: 0 });
  });
  it('charges rent on day seven, after food', () => {
    const game = createGame(content(), { wallet: 50, foodCost: 2, rentCost: 20 });
    for (let i = 0; i < 5; i++) game.sleep(); expect(game.state().wallet).toBe(40); game.sleep();
    expect(game.state()).toMatchObject({ day: 7, wallet: 18, rentDue: false, graceUntil: null });
  });
  it('keeps insufficient rent in the wallet and grants renewable grace without debt', () => {
    const game = createGame(content(), { wallet: 5, foodCost: 0, rentCost: 20, graceDays: 3 });
    for (let i = 0; i < 6; i++) game.sleep();
    expect(game.state()).toMatchObject({ wallet: 5, rentDue: true, graceUntil: 10 });
    for (let i = 0; i < 3; i++) game.sleep(); expect(game.state()).toMatchObject({ wallet: 5, rentDue: true, graceUntil: 13 });
    for (let i = 0; i < 4; i++) game.sleep(); expect(game.state()).toMatchObject({ day: 14, wallet: 5, rentDue: true, graceUntil: 17 });
  });
  it('settles outstanding rent when wages become sufficient, charging only one rent', () => {
    const game = createGame(content(scene({ reward: 20 })), { wallet: 5, foodCost: 0 });
    for (let i = 0; i < 13; i++) game.sleep(); game.start('job'); game.reply(0);
    expect(game.state()).toMatchObject({ wallet: 5, rentDue: false, graceUntil: null });
  });
  it('rejects negative content money amounts', () => {
    expect(() => createGame(content(scene({ reward: -100 }))).start('job')).toThrow(ContentError);
    expect(() => createGame(content(scene({ cost: -100 }))).start('job')).toThrow(ContentError);
  });
});
