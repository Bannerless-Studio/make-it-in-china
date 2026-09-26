import type { Scene } from '../content/types';
import { grantItem } from './progress';
import { CommandError, type Emit, type GameState, type TransactionReason } from './types';

export const PENALTY_CAP = 5;
export function spend(state: GameState, amount: number, reason?: TransactionReason, emit?: Emit, itemId?: string) {
  const paid = Math.min(Math.max(0, amount), state.wallet);
  state.wallet -= paid;
  if (reason && emit && amount > 0) emit('transaction', { reason, requested: amount, amount: -paid, balance: state.wallet, ...(itemId === undefined ? {} : { itemId }) });
  return paid;
}
export function credit(state: GameState, amount: number, reason: TransactionReason, emit: Emit, itemId?: string) {
  if (amount <= 0) return;
  state.wallet += amount;
  emit('transaction', { reason, requested: amount, amount, balance: state.wallet, ...(itemId === undefined ? {} : { itemId }) });
}
export function beginAction(state: GameState, scene: Scene, emit?: Emit) {
  if (['job', 'errand', 'mentor'].includes(scene.kind)) {
    if (state.actionSlots === 0) throw new CommandError('No action slots left; sleep to start a new day.');
    state.actionSlots--;
  }
  if (scene.cost) spend(state, scene.cost, 'cost', emit);
}
export function buyEntry(state: GameState, scene: Scene, mode: 'buy' | 'look', emit: Emit) {
  const purchase = scene.purchase;
  if (!state.activity || !purchase) return;
  if (purchase.mode === 'withhold-first-reward') {
    state.activity.pendingPurchase = { itemId: purchase.itemId, price: purchase.price, mode: 'buy', charged: false };
    return;
  }
  if (mode === 'buy') {
    if (state.wallet < purchase.price) throw new CommandError(`Not enough money for ${purchase.itemId}; look instead.`);
    spend(state, purchase.price, 'purchase', emit, purchase.itemId);
    grantItem(state, purchase.itemId);
  }
  state.activity.pendingPurchase = { itemId: purchase.itemId, price: purchase.price, mode, charged: mode === 'buy' };
}
export function penalize(state: GameState, sceneId: string, exchangeId: string, emit: Emit, consequence?: Scene) {
  const activity = state.activity, key = `${sceneId}/${exchangeId}`;
  if (activity?.penalizedExchangeIds.includes(key)) return;
  activity?.penalizedExchangeIds.push(key);
  if (state.rules.wrongPenalty === 'action') { state.actionSlots = Math.max(0, state.actionSlots - 1); return; }
  let amount = Math.max(1, Math.min(PENALTY_CAP, consequence?.cost ?? state.rules.wrongPenalty));
  if (activity) amount = Math.min(amount, Math.max(0, PENALTY_CAP - activity.penaltyTotal));
  if (!amount) return;
  // The cap counts money actually taken, so an empty wallet never eats the allowance.
  if (activity) activity.penaltyTotal += spend(state, amount, 'penalty', emit);
  else spend(state, amount, 'penalty', emit);
}
export function settleRent(state: GameState, emit?: Emit) {
  if (state.rentDue && state.wallet >= state.rules.rentCost) {
    spend(state, state.rules.rentCost, 'rent', emit); state.rentDue = false; state.graceUntil = null;
  }
}
export function nextDay(state: GameState, emit: Emit) {
  state.day++; state.actionSlots = state.rules.actionSlots; spend(state, state.rules.foodCost, 'food', emit);
  if (state.day % 7 === 0) { state.rentDue = true; state.graceUntil = state.day + state.rules.graceDays; }
  settleRent(state, emit);
  if (state.day % 7 === 0 && state.rentDue) emit('rentDue', { amount: state.rules.rentCost, graceUntil: state.graceUntil! });
  if (state.rentDue && state.day >= state.graceUntil!) state.graceUntil = state.day + state.rules.graceDays;
}
