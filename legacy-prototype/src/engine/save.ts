import { emptyProgress, spentSlotLabel } from './progress';
import type { GameState, Progress } from './types';

export class SaveError extends Error { override name = 'SaveError'; }
export class UnsupportedSaveVersionError extends SaveError {
  override name = 'UnsupportedSaveVersionError';
  constructor(public readonly version: unknown) { super(`Unsupported save version: ${String(version)}`); }
}
export const EVENT_LIMIT = 2000;
export const SAVE_VERSION = 2;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const integer = (value: unknown): value is number => number(value) && Number.isSafeInteger(value);
const strings = (value: unknown) => Array.isArray(value) && value.every(item => typeof item === 'string');
const counters = (value: unknown, max = Number.MAX_SAFE_INTEGER) => record(value) && Object.values(value).every(item => integer(item) && item <= max);
function text(value: unknown): boolean {
  return record(value) && typeof value.hanzi === 'string' && ['pinyin', 'en', 'audio'].every(key => value[key] === undefined || typeof value[key] === 'string') && (value.words === undefined || strings(value.words));
}
function frame(value: unknown): boolean {
  // Older saves have no retained first-appearance markers; do not invent any.
  if (record(value) && !Object.hasOwn(value, 'newWords')) value.newWords = [];
  if (!record(value) || typeof value.sceneId !== 'string' || !integer(value.index) || !record(value.bindings) || !record(value.attempts) || !strings(value.newWords) || (value.pendingNext !== undefined && typeof value.pendingNext !== 'string') || (value.returnMode !== undefined && !['retry', 'advance'].includes(String(value.returnMode)))) return false;
  const ex = value.exchange;
  return Object.values(value.attempts).every(integer) && Object.values(value.bindings).every(item => text(item) && record(item) && strings(item.words)) &&
    record(ex) && typeof ex.id === 'string' && text(ex.line) && record(ex.line) && strings(ex.line.words) && typeof ex.line.audio === 'string' &&
    Array.isArray(ex.replies) && ex.replies.every(reply => text(reply) && record(reply) && typeof reply.action === 'string');
}
function progress(value: unknown): boolean {
  return record(value) && counters(value.completedOn) && counters(value.completedCount) && counters(value.inventory, 99) &&
    strings(value.mentorTopics) && (value.gateReachedDay === null || integer(value.gateReachedDay)) && typeof value.onboardingWaived === 'boolean';
}
function activity(value: unknown): boolean {
  return value === null || (record(value) && typeof value.parentSceneId === 'string' &&
    ['M', 'A1', 'A2', 'A3', 'A4', 'E'].includes(String(value.slotLabel)) &&
    integer(value.penaltyTotal) && value.penaltyTotal <= 5 && strings(value.penalizedExchangeIds) && strings(value.guidedVisited) &&
    record(value.assistedByExchange) && Object.values(value.assistedByExchange).every(strings) &&
    (value.pendingPurchase === null || (record(value.pendingPurchase) && typeof value.pendingPurchase.itemId === 'string' &&
      integer(value.pendingPurchase.price) && ['buy', 'look'].includes(String(value.pendingPurchase.mode)) && typeof value.pendingPurchase.charged === 'boolean')));
}
function worldTask(value: unknown): boolean {
  return value === null || (record(value) && ['taskId', 'parentSceneId', 'exchangeId', 'targetTriggerId', 'propId'].every(key => typeof value[key] === 'string'));
}
export function saveJSON(state: GameState): string { return JSON.stringify({ ...state, events: state.events.slice(-EVENT_LIMIT) }); }
function parse(json: string): Record<string, unknown> {
  let value: unknown;
  try { value = JSON.parse(json); } catch { throw new SaveError('Invalid save JSON.'); }
  if (!record(value)) throw new SaveError('Save must be an object.');
  return value;
}
function core(value: Record<string, unknown>): boolean {
  const rules = value.rules;
  const validRules = record(rules) && ['actionSlots', 'foodCost', 'rentCost', 'graceDays', 'decayDays'].every(key => integer(rules[key])) &&
    Number(rules.actionSlots) > 0 && Number(rules.graceDays) > 0 && Number(rules.decayDays) > 0 &&
    (rules.wrongPenalty === 'action' || (integer(rules.wrongPenalty) && rules.wrongPenalty >= 1 && rules.wrongPenalty <= 5));
  const firstSeen = (seen: unknown) => seen === undefined || (record(seen) && ['location', 'sentence'].every(key => typeof seen[key] === 'string') && (seen.audio === undefined || typeof seen.audio === 'string'));
  const validWords = record(value.words) && Object.values(value.words).every(word => record(word) &&
    ['unseen', 'met', 'shaky', 'known'].includes(String(word.state)) && integer(word.lastSeen) && word.lastSeen <= Number(value.day) &&
    firstSeen(word.firstSeen));
  const eventNames = ['sceneStart', 'exchange', 'reply', 'hint', 'word', 'sceneEnd', 'rentDue', 'day', 'change', 'transaction', 'assisted', 'gate', 'activityEnd'];
  return validRules && validWords && number(value.wallet) && integer(value.day) && Number(value.day) >= 1 &&
    integer(value.actionSlots) && Number(value.actionSlots) <= Number((rules as Record<string, unknown>).actionSlots) &&
    integer(value.rng) && Number(value.rng) <= 4294967295 && typeof value.rentDue === 'boolean' &&
    (value.graceUntil === null || integer(value.graceUntil)) && (value.rentDue === (value.graceUntil !== null)) &&
    (value.dialogue === null || frame(value.dialogue)) && Array.isArray(value.returns) && value.returns.every(frame) &&
    !(value.dialogue === null && value.returns.length > 0) && Array.isArray(value.events) &&
    value.events.every(event => record(event) && eventNames.includes(String(event.type)) && integer(event.day) && (event.seq === undefined || integer(event.seq)) && record(event.data));
}
export function loadJSON(json: string): GameState {
  const value = parse(json);
  if (value.v !== SAVE_VERSION) throw new UnsupportedSaveVersionError(value.v);
  const task = value.pendingWorldTask as Record<string, unknown> | null;
  const dialogue = value.dialogue as Record<string, unknown> | null;
  const taskMatchesDialogue = task === null || (!!dialogue && task.parentSceneId === dialogue.sceneId &&
    task.exchangeId === (dialogue.exchange as Record<string, unknown>).id);
  if (!core(value) || !integer(value.commandSeq) || !progress(value.progress) || !activity(value.activity) || !worldTask(value.pendingWorldTask) ||
    !taskMatchesDialogue || (value.dialogue !== null && value.activity === null)) throw new SaveError('Malformed save state.');
  const state = value as unknown as GameState;
  state.events = state.events.slice(-EVENT_LIMIT);
  return state;
}
export function migrateV1(json: string, options: { starterWords?: string[] } = {}): GameState {
  const value = parse(json);
  if (value.v !== 1) throw new UnsupportedSaveVersionError(value.v);
  if (!core(value)) throw new SaveError('Malformed save state.');
  const words = value.words as Record<string, { state: string }>;
  const starter = options.starterWords ?? [];
  const waived = starter.length > 0 && starter.every(word => words[word] && words[word].state !== 'unseen');
  const progressState: Progress = { ...emptyProgress(), onboardingWaived: waived };
  const frames = [...(value.returns as unknown[]), ...(value.dialogue ? [value.dialogue] : [])] as { sceneId: string }[];
  const parent = frames[0];
  // v1 events predate the command sequence: number them in order so later commands stay monotonic.
  const events = (value.events as Record<string, unknown>[]).map((event, index) => ({ ...event, seq: index + 1 }));
  const slots = value as unknown as GameState;
  const migrated = { ...value, v: SAVE_VERSION, commandSeq: events.length, events, progress: progressState,
    // A migrated activity keeps its spent slot and starts its penalty cap fresh; v1 kept no per-activity ledger.
    activity: parent ? { parentSceneId: parent.sceneId, slotLabel: spentSlotLabel(slots), penaltyTotal: 0, penalizedExchangeIds: [], assistedByExchange: {}, pendingPurchase: null, guidedVisited: [] } : null,
    pendingWorldTask: null };
  return loadJSON(JSON.stringify(migrated));
}
export function encodeSave(state: GameState): string {
  const bytes = new TextEncoder().encode(saveJSON(state));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
export function decodeText(encoded: string): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(encoded), char => char.charCodeAt(0))); }
  catch { throw new SaveError('Invalid base64 save.'); }
}
export function decodeSave(encoded: string): GameState {
  return loadJSON(decodeText(encoded));
}
