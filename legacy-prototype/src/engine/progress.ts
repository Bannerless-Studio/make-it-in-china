import type { Scene, TimeSlot } from '../content/types';
import { wordState } from './learner';
import type { Activity, Emit, GameContent, GameState, GateStatus, Progress } from './types';

export const GATE_WORDS = 150;
export const GATE_SAVINGS = 150;
const SLOT_ACTIONS: TimeSlot[] = ['A1', 'A2', 'A3', 'A4'];
const consumes = (scene: Scene) => ['job', 'errand', 'mentor'].includes(scene.kind);

export function emptyProgress(): Progress {
  return { completedOn: {}, completedCount: {}, inventory: {}, mentorTopics: [], gateReachedDay: null, onboardingWaived: false };
}
function actionLabel(state: GameState): TimeSlot {
  const used = Math.max(0, state.rules.actionSlots - state.actionSlots);
  return SLOT_ACTIONS[Math.min(used, SLOT_ACTIONS.length - 1)];
}
export function spentSlotLabel(state: GameState): TimeSlot {
  const used = Math.max(0, state.rules.actionSlots - state.actionSlots);
  return used <= 0 ? 'M' : SLOT_ACTIONS[Math.min(used - 1, SLOT_ACTIONS.length - 1)];
}
export function currentSlots(state: GameState): TimeSlot[] {
  // An open activity freezes the clock: opening hours follow its label, never the decremented budget.
  if (state.activity) return [state.activity.slotLabel];
  const used = state.rules.actionSlots - state.actionSlots;
  const labels: TimeSlot[] = [];
  if (used <= 0) labels.push('M');
  if (state.actionSlots > 0) labels.push(actionLabel(state));
  else labels.push('E');
  return labels;
}
export function slotLabelFor(state: GameState, scene: Scene): TimeSlot {
  if (consumes(scene)) return actionLabel(state);
  const allowed = scene.allowedSlots ?? [];
  const now = currentSlots(state);
  return now.find(label => allowed.includes(label)) ?? now[now.length - 1];
}
function completedAfter(state: GameState, content: GameContent, sceneId: string): boolean {
  if (Object.hasOwn(state.progress.completedOn, sceneId)) return true;
  // A migrated v1 learner who already met the starter words satisfies only the onboarding prerequisite.
  if (!state.progress.onboardingWaived) return false;
  return content.scenes.find(scene => scene.id === sceneId)?.curriculumIndex === 0;
}
export function scheduled(state: GameState, content: GameContent, scene: Scene): boolean {
  if (scene.minDay !== undefined && state.day < scene.minDay) return false;
  if (scene.afterScenes?.some(id => !completedAfter(state, content, id))) return false;
  if (scene.repeatable === false && Object.hasOwn(state.progress.completedOn, scene.id)) return false;
  if (scene.allowedSlots?.length && !scene.allowedSlots.some(label => currentSlots(state).includes(label))) return false;
  return true;
}
export function newActivity(state: GameState, scene: Scene): Activity {
  return { parentSceneId: scene.id, slotLabel: slotLabelFor(state, scene), penaltyTotal: 0,
    penalizedExchangeIds: [], assistedByExchange: {}, pendingPurchase: null, guidedVisited: [] };
}
export function recordCompletion(state: GameState, scene: Scene) {
  // Ordinary mix-ups leave no progress; S11-style curriculum consequences are numbered scenes and do.
  if (scene.kind === 'consequence' && scene.curriculumIndex === undefined) return;
  if (!Object.hasOwn(state.progress.completedOn, scene.id)) state.progress.completedOn[scene.id] = state.day;
  state.progress.completedCount[scene.id] = (state.progress.completedCount[scene.id] ?? 0) + 1;
  if (scene.kind === 'mentor' && !state.progress.mentorTopics.includes(scene.id)) state.progress.mentorTopics.push(scene.id);
}
export function grantItem(state: GameState, itemId: string) {
  state.progress.inventory[itemId] = Math.min(99, (state.progress.inventory[itemId] ?? 0) + 1);
}
export function endActivity(state: GameState, emit: Emit, reward: number, abandoned: boolean) {
  const activity = state.activity;
  state.activity = null;
  if (!activity) return;
  emit('activityEnd', { sceneId: activity.parentSceneId, slotLabel: activity.slotLabel, reward, penaltyTotal: activity.penaltyTotal, abandoned });
}
export function metCount(state: GameState, content: GameContent): number {
  const dictionary = content.words;
  if (!dictionary?.length) return Object.values(state.words).filter(entry => entry.state !== 'unseen').length;
  return dictionary.filter(word => word.hsk === 1 && !word.bonus && wordState(state, word.hanzi) !== 'unseen').length;
}
export function gateStatus(state: GameState, content: GameContent): GateStatus {
  const met = metCount(state, content);
  return { met, total: GATE_WORDS, savings: state.wallet, target: GATE_SAVINGS,
    open: state.progress.gateReachedDay !== null || (met >= GATE_WORDS && state.wallet >= GATE_SAVINGS) };
}
