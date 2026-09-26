import type { Exchange, Line, Scene, SlotPool, TimeSlot, Word, WordState } from '../content/types';

export interface GameContent { scenes: Scene[]; world: { slotPools: SlotPool[] }; words?: Word[] }
export interface WordProgress {
  state: WordState; lastSeen: number;
  firstSeen?: { location: string; sentence: string; audio?: string };
}
export interface Progress {
  completedOn: Record<string, number>; completedCount: Record<string, number>;
  inventory: Record<string, number>; mentorTopics: string[];
  gateReachedDay: number | null; onboardingWaived: boolean;
}
export type PurchaseMode = 'buy' | 'look';
export interface PendingPurchase { itemId: string; price: number; mode: PurchaseMode; charged: boolean }
export interface Activity {
  parentSceneId: string; slotLabel: TimeSlot; penaltyTotal: number;
  penalizedExchangeIds: string[]; assistedByExchange: Record<string, string[]>;
  pendingPurchase: PendingPurchase | null; guidedVisited: string[];
}
export interface WorldTask { taskId: string; parentSceneId: string; exchangeId: string; targetTriggerId: string; propId: string }
export interface GateStatus { met: number; total: number; savings: number; target: number; open: boolean }
export type AssistReason = 'pinyin-default' | 'hint' | 'gloss';
export type TransactionReason = 'reward' | 'penalty' | 'purchase' | 'withhold' | 'food' | 'rent' | 'cost';
export interface GameOptions {
  seed?: number; wallet?: number; actionSlots?: number; foodCost?: number;
  rentCost?: number; graceDays?: number; decayDays?: number;
  wrongPenalty?: number | 'action'; initialWords?: Record<string, WordState>;
  day?: number; progress?: Partial<Progress>;
}
export type Rules = Required<Omit<GameOptions, 'initialWords' | 'seed' | 'wallet' | 'day' | 'progress'>>;
export type Bindings = Record<string, SlotPool['values'][number]>;
export interface DialogueFrame {
  sceneId: string; index: number; bindings: Bindings;
  attempts: Record<string, number>; exchange: Exchange; newWords: string[]; pendingNext?: string;
  returnMode?: 'retry' | 'advance';
}
export interface GameEvents {
  sceneStart: { sceneId: string };
  exchange: { sceneId: string; exchange: Exchange; newWords: string[] };
  reply: { sceneId: string; exchangeId: string; index: number; correct: boolean; action: string; check?: string };
  hint: { sceneId: string; exchangeId: string; attempts: number; line: Line; simplified: string };
  word: { word: string; state: WordState; reason: 'seen' | 'correct' | 'wrong' | 'tap' | 'decay' };
  sceneEnd: { sceneId: string; reward: number; abandoned?: boolean };
  rentDue: { amount: number; graceUntil: number };
  day: { day: number; rentDue: boolean; graceUntil: number | null };
  change: Record<string, never>;
  transaction: { reason: TransactionReason; requested: number; amount: number; balance: number; itemId?: string };
  assisted: { sceneId: string; exchangeId: string; words: string[]; reason: AssistReason };
  gate: { met: number; total: number; savings: number; target: number; open: boolean; claimed: boolean };
  activityEnd: { sceneId: string; slotLabel: TimeSlot; reward: number; penaltyTotal: number; abandoned: boolean };
}
export type GameEvent = { [K in keyof GameEvents]: { type: K; day: number; seq: number; data: GameEvents[K] } }[keyof GameEvents];
export interface GameState {
  v: 2; wallet: number; day: number; actionSlots: number;
  rentDue: boolean; graceUntil: number | null; rules: Rules; rng: number; commandSeq: number;
  words: Record<string, WordProgress>; dialogue: DialogueFrame | null;
  returns: DialogueFrame[]; events: GameEvent[];
  progress: Progress; activity: Activity | null; pendingWorldTask: WorldTask | null;
}
export type Emit = <K extends keyof GameEvents>(type: K, data: GameEvents[K]) => void;
export class ContentError extends Error { override name = 'ContentError'; }
export class CommandError extends Error { override name = 'CommandError'; }
