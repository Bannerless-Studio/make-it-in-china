import { describe, expect, it } from 'vitest';
import { createGame, PENALTY_CAP } from '../../src/engine';
import { phaseOne } from '../fixtures/engine';

describe('real Phase 1 job and consequence sites', () => {
  for (const scene of phaseOne().scenes.filter(scene => scene.kind === 'job')) {
    it(`${scene.id}: completes each consequence route and resumes without losing bindings`, () => {
      const data = phaseOne();
      // Route coverage only: every dictionary word is already met so slot pools are never the subject.
      const initialWords = Object.fromEntries((data.words ?? []).map(word => [word.hanzi, 'met' as const]));
      const game = createGame(data, { wallet: 100, initialWords, seed: 13, day: scene.minDay ?? 1,
        progress: { completedOn: Object.fromEntries((scene.afterScenes ?? []).map(id => [id, 1])) } });
      game.start(scene.id);
      for (const exchange of scene.exchanges) {
        const frame = game.state().dialogue!;
        expect(frame.exchange.id).toBe(exchange.id);
        const wrong = exchange.replies.findIndex(reply => reply.correct === false);
        if (wrong >= 0) {
          expect(game.reply(wrong)).toBe(false);
          const consequence = data.scenes.find(item => item.id === exchange.onWrong)!;
          expect(game.state().dialogue!.sceneId).toBe(consequence.id);
          for (const retry of consequence.exchanges) game.reply(retry.replies.findIndex(reply => reply.correct));
          expect(game.state().dialogue!.exchange).toEqual(frame.exchange);
          expect(game.state().dialogue!.bindings).toEqual(frame.bindings);
        }
        expect(game.reply(exchange.replies.findIndex(reply => reply.correct))).toBe(true);
        if (exchange.taskAfterCorrect) {
          expect(game.state().pendingWorldTask?.taskId).toBe(exchange.taskAfterCorrect.taskId);
          expect(() => game.reply(0)).toThrow(/pending task/);
          game.completeWorldTask(exchange.taskAfterCorrect.taskId);
        }
      }
      let room = PENALTY_CAP;
      const spent = scene.exchanges
        .filter(exchange => exchange.replies.some(reply => reply.correct === false))
        .reduce((sum, exchange) => {
          const cost = Math.max(1, Math.min(PENALTY_CAP, data.scenes.find(item => item.id === exchange.onWrong)?.cost ?? 1));
          const charged = Math.min(cost, room); room -= charged; return sum + charged;
        }, 0);
      const withheld = scene.purchase?.mode === 'withhold-first-reward' ? Math.min(scene.purchase.price, scene.reward ?? 0) : 0;
      expect(game.state()).toMatchObject({ dialogue: null, actionSlots: 3, wallet: 100 + (scene.reward ?? 0) - withheld - spent });
      expect(game.state().returns).toEqual([]);
      expect(game.state().progress.completedCount[scene.id]).toBe(1);
      if (withheld) expect(game.state().progress.inventory[scene.purchase!.itemId]).toBe(1);
    });
  }
});
