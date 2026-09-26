import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/engine';
import { describeChoices, unmetReason } from '../../src/ui/activityAvailability';
import { content, scene } from '../fixtures/engine';

describe('describeChoices', () => {
  it('marks a single available scene as available with no reason', () => {
    const data = content(scene());
    const game = createGame(data);
    const available = new Set(game.availableScenes().map(item => item.id));
    const choices = describeChoices(data.scenes, game.state(), available, 'cook');
    expect(choices).toEqual([
      { id: 'job', kind: 'job', reward: 8, price: undefined, review: false, available: true, reason: undefined },
    ]);
  });

  it('derives a locked-by-words reason when requires are unmet', () => {
    const data = content(scene({ requires: ['未见'] }));
    const game = createGame(data);
    const available = new Set(game.availableScenes().map(item => item.id));
    const [choice] = describeChoices(data.scenes, game.state(), available, 'cook');
    expect(choice.available).toBe(false);
    expect(choice.reason).toBe("You don't know these words yet");
  });

  it('derives a minDay reason before the scene opens', () => {
    const data = content(scene({ minDay: 3 }));
    const game = createGame(data);
    const state = game.state();
    expect(unmetReason(data.scenes[0], state)).toBe('Opens on day 3');
  });

  it('derives a wrong-slot reason outside allowedSlots', () => {
    const data = content(scene({ allowedSlots: ['E'] }));
    const game = createGame(data, { actionSlots: 4 });
    const state = game.state();
    expect(unmetReason(data.scenes[0], state)).toBe('Wrong time of day');
  });

  it('marks a repeatable scene done today as review, not unavailable', () => {
    const data = content(scene({ repeatable: true }));
    const game = createGame(data, { actionSlots: 4 });
    game.start('job'); game.reply(0);
    const available = new Set(game.availableScenes().map(item => item.id));
    const [choice] = describeChoices(data.scenes, game.state(), available, 'cook');
    expect(choice.available).toBe(true);
    expect(choice.review).toBe(true);
  });

  it('excludes consequence scenes and other NPCs', () => {
    const data = content(scene({ npc: 'cook' }), scene({ id: 'other', npc: 'landlord' }));
    const game = createGame(data);
    const available = new Set(game.availableScenes().map(item => item.id));
    expect(describeChoices(data.scenes, game.state(), available, 'cook').map(item => item.id)).toEqual(['job']);
  });
});
