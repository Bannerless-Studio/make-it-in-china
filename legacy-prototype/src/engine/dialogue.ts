import type { Exchange, Scene } from '../content/types';
import { beginAction, buyEntry, credit, penalize, settleRent } from './economy';
import { evidence, meet, wordState } from './learner';
import { endActivity, grantItem, newActivity, recordCompletion, scheduled } from './progress';
import { fillExchange, validateScene } from './slots';
import { CommandError, ContentError, type DialogueFrame, type Emit, type GameContent, type GameState, type PurchaseMode } from './types';

export function getScene(content: GameContent, id: string): Scene {
  const scene = content.scenes.find(scene => scene.id === id);
  if (!scene) throw new ContentError(`Unknown scene: ${id}`);
  return scene;
}
export function available(state: GameState, content: GameContent): Scene[] {
  if (state.dialogue) return [];
  return content.scenes.filter(scene => {
    if (scene.kind === 'consequence') return false;
    if (!scheduled(state, content, scene)) return false;
    try { validateScene(scene, content, state); fillExchange({ ...state }, scene, scene.exchanges[0], {}, content); return true; }
    catch (error) { if (error instanceof CommandError || error instanceof ContentError) return false; throw error; }
  });
}
function present(state: GameState, content: GameContent, frame: DialogueFrame, emit: Emit, refill = true) {
  const scene = getScene(content, frame.sceneId);
  if (refill) {
    frame.exchange = fillExchange(state, scene, scene.exchanges[frame.index], frame.bindings, content);
    frame.newWords = [...new Set(frame.exchange.line.words.filter(word => wordState(state, word) === 'unseen'))];
  }
  state.dialogue = frame;
  meet(state, frame.exchange.line.words, frame.exchange.line, scene.location, emit);
  emit('exchange', { sceneId: scene.id, exchange: frame.exchange, newWords: frame.newWords });
}
export function enter(state: GameState, content: GameContent, scene: Scene, emit: Emit, consequence = false, purchase: PurchaseMode = 'buy') {
  if (!consequence && scene.kind === 'consequence') throw new CommandError('Consequences are entered only through onWrong.');
  validateScene(scene, content, state);
  if (!consequence) {
    state.activity = newActivity(state, scene);
    beginAction(state, scene, emit);
    buyEntry(state, scene, purchase, emit);
  }
  const frame: DialogueFrame = { sceneId: scene.id, index: 0, bindings: {}, attempts: {}, exchange: scene.exchanges[0], newWords: [] };
  emit('sceneStart', { sceneId: scene.id });
  present(state, content, frame, emit);
}
function finish(state: GameState, scene: Scene, emit: Emit, abandoned = false) {
  let reward = abandoned || scene.kind === 'consequence' ? 0 : (scene.reward ?? 0);
  const purchase = scene.purchase;
  // The tool is employer-owned until one whole price is withheld: no partial charge, no free item.
  const withheld = !abandoned && purchase?.mode === 'withhold-first-reward' && !state.progress.inventory[purchase.itemId] && reward >= purchase.price;
  if (withheld) { reward -= purchase!.price; grantItem(state, purchase!.itemId); }
  if (!abandoned) recordCompletion(state, scene);
  credit(state, reward, 'reward', emit);
  if (withheld) emit('transaction', { reason: 'withhold', requested: purchase!.price, amount: -purchase!.price, balance: state.wallet, itemId: purchase!.itemId });
  settleRent(state, emit);
  emit('sceneEnd', { sceneId: scene.id, reward, ...(abandoned ? { abandoned: true } : {}) });
  return reward;
}
function resume(state: GameState, content: GameContent, frame: DialogueFrame, emit: Emit) {
  const mode = frame.returnMode; delete frame.returnMode;
  const target = frame.pendingNext; delete frame.pendingNext;
  if (mode === 'advance') { advance(state, content, frame, target, emit); return; }
  if (target && target !== frame.exchange.id) {
    const scene = getScene(content, frame.sceneId), index = scene.exchanges.findIndex(exchange => exchange.id === target);
    if (index < 0) { finish(state, scene, emit, true); endActivity(state, emit, 0, true); enter(state, content, getScene(content, target), emit); return; }
    frame.index = index; present(state, content, frame, emit);
  } else present(state, content, frame, emit, false);
}
function advance(state: GameState, content: GameContent, frame: DialogueFrame, target: string | undefined, emit: Emit) {
  const scene = getScene(content, frame.sceneId);
  if (target) {
    const index = scene.exchanges.findIndex(item => item.id === target);
    if (index >= 0) frame.index = index;
    else {
      const reward = finish(state, scene, emit);
      endActivity(state, emit, reward, false);
      enter(state, content, getScene(content, target), emit);
      return;
    }
  } else frame.index++;
  if (frame.index < scene.exchanges.length) { present(state, content, frame, emit); return; }
  const reward = finish(state, scene, emit);
  const parent = state.returns.pop();
  if (parent) { resume(state, content, parent, emit); return; }
  state.dialogue = null;
  endActivity(state, emit, reward, false);
}
function continueAfterCorrect(state: GameState, content: GameContent, frame: DialogueFrame, exchange: Exchange, emit: Emit) {
  const guided = exchange.guidedConsequence;
  if (guided && state.activity && !state.activity.guidedVisited.includes(exchange.id)) {
    state.activity.guidedVisited.push(exchange.id);
    if (state.returns.length >= 32) throw new ContentError('Consequence nesting exceeds 32 scenes; sleep to exit.');
    state.returns.push(frame);
    enter(state, content, getScene(content, guided), emit, true);
    return;
  }
  resume(state, content, frame, emit);
}
export function answer(state: GameState, content: GameContent, index: number, emit: Emit): boolean {
  const frame = state.dialogue;
  if (!frame) throw new CommandError('No active dialogue.');
  if (state.pendingWorldTask) throw new CommandError(`Finish the pending task first: ${state.pendingWorldTask.taskId}`);
  const scene = getScene(content, frame.sceneId), exchange = frame.exchange;
  const reply = exchange.replies[index];
  if (!Number.isInteger(index) || !reply) throw new CommandError(`Invalid reply index: ${index}`);
  const correct = reply.correct === true;
  emit('reply', { sceneId: scene.id, exchangeId: exchange.id, index, correct, action: reply.action, ...(reply.check === undefined ? {} : { check: reply.check }) });
  const assisted = new Set(state.activity?.assistedByExchange[exchange.id] ?? []);
  const spoken = [...exchange.line.words, ...(reply.words ?? [])];
  meet(state, exchange.line.words, exchange.line, scene.location, emit);
  meet(state, reply.words ?? [], reply, scene.location, emit);
  // Exposure meets every word; only tested words carry evidence, and assisted ones never promote.
  const tested = (exchange.tests ?? spoken).filter(word => spoken.includes(word));
  evidence(state, correct ? tested.filter(word => !assisted.has(word)) : tested, correct ? 'correct' : 'wrong', emit);
  frame.pendingNext = reply.next;
  if (!correct) {
    const attempts = frame.attempts[exchange.id] = (frame.attempts[exchange.id] ?? 0) + 1;
    const consequence = exchange.onWrong ? getScene(content, exchange.onWrong) : undefined;
    penalize(state, scene.id, exchange.id, emit, consequence);
    const hint = exchange.hint ?? exchange.line;
    if (attempts >= 2) emit('hint', { sceneId: scene.id, exchangeId: exchange.id, attempts, line: hint, simplified: hint.en });
    frame.returnMode = 'retry';
    if (consequence) {
      if (state.returns.length >= 32) throw new ContentError('Consequence nesting exceeds 32 scenes; sleep to exit.');
      state.returns.push(frame); enter(state, content, consequence, emit, true);
    } else resume(state, content, frame, emit);
    return false;
  }
  frame.returnMode = 'advance';
  const task = exchange.taskAfterCorrect;
  if (task) {
    state.pendingWorldTask = { taskId: task.taskId, parentSceneId: scene.id, exchangeId: exchange.id, targetTriggerId: task.targetTriggerId, propId: task.propId };
    return true;
  }
  continueAfterCorrect(state, content, frame, exchange, emit);
  return true;
}
export function completeTask(state: GameState, content: GameContent, taskId: string, emit: Emit) {
  const task = state.pendingWorldTask;
  if (!task) throw new CommandError('No pending world task.');
  if (task.taskId !== taskId) throw new CommandError(`Unknown world task: ${taskId}`);
  const frame = state.dialogue;
  if (!frame || frame.sceneId !== task.parentSceneId || frame.exchange.id !== task.exchangeId) throw new CommandError('Pending task lost its activity.');
  state.pendingWorldTask = null;
  continueAfterCorrect(state, content, frame, frame.exchange, emit);
}
export function abandonAll(state: GameState, emit: Emit): number {
  const frames = [...(state.dialogue ? [state.dialogue] : []), ...[...state.returns].reverse()];
  for (const frame of frames) emit('sceneEnd', { sceneId: frame.sceneId, reward: 0, abandoned: true });
  state.dialogue = null; state.returns = []; state.pendingWorldTask = null;
  endActivity(state, emit, 0, true);
  return frames.length;
}
