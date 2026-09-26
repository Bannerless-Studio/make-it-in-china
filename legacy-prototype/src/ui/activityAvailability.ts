import type { Scene } from '../content/types';
import { currentSlots, type GameState } from '../engine';

export interface ActivityChoice {
  id: string;
  kind: Scene['kind'];
  reward?: number;
  price?: number;
  review: boolean;
  available: boolean;
  reason?: string;
}

export function unmetReason(scene: Scene, state: GameState): string | undefined {
  if (scene.minDay !== undefined && state.day < scene.minDay) return `Opens on day ${scene.minDay}`;
  if (scene.afterScenes?.some(id => !Object.hasOwn(state.progress.completedOn, id))) return 'Continue the story first';
  if (scene.repeatable === false && Object.hasOwn(state.progress.completedOn, scene.id)) return 'Already done';
  if (scene.allowedSlots?.length && !scene.allowedSlots.some(label => currentSlots(state).includes(label))) return 'Wrong time of day';
  if (scene.requires.some(word => (state.words[word]?.state ?? 'unseen') === 'unseen')) return "You don't know these words yet";
  if (['job', 'errand', 'mentor'].includes(scene.kind) && state.actionSlots === 0) return 'No action slots left';
  return undefined;
}

// Filters to one NPC's non-consequence scenes; unavailable rows carry the closest derivable reason
// because the engine only exposes a pass/fail availability check, not a reason code.
export function describeChoices(scenes: Scene[], state: GameState, availableIds: Set<string>, npcId: string): ActivityChoice[] {
  return scenes
    .filter(scene => scene.npc === npcId && scene.kind !== 'consequence')
    .map(scene => {
      const available = availableIds.has(scene.id);
      return {
        id: scene.id,
        kind: scene.kind,
        reward: scene.reward,
        price: scene.purchase?.price ?? scene.cost,
        review: Object.hasOwn(state.progress.completedOn, scene.id),
        available,
        reason: available ? undefined : (unmetReason(scene, state) ?? 'Not available right now'),
      };
    });
}
