import type { WordState } from '../content/types';
import type { Emit, GameState, WordProgress } from './types';

const levels: WordState[] = ['unseen', 'met', 'shaky', 'known'];
export function wordState(state: GameState, word: string): WordState { return state.words[word]?.state ?? 'unseen'; }
export function meet(state: GameState, words: string[], line?: { hanzi: string; audio?: string }, location?: string, emit?: Emit) {
  for (const word of new Set(words)) {
    const prior = state.words[word];
    const entry: WordProgress = prior ?? { state: 'unseen', lastSeen: state.day };
    state.words[word] = entry;
    entry.lastSeen = state.day;
    if (!entry.firstSeen && line && location) entry.firstSeen = { location, sentence: line.hanzi, ...(line.audio === undefined ? {} : { audio: line.audio }) };
    if (entry.state === 'unseen') { entry.state = 'met'; emit?.('word', { word, state: 'met', reason: 'seen' }); }
  }
}
export function evidence(state: GameState, words: string[], reason: 'correct' | 'wrong' | 'tap', emit: Emit) {
  meet(state, words);
  for (const word of new Set(words)) {
    const entry = state.words[word];
    entry.state = levels[Math.max(1, Math.min(3, levels.indexOf(entry.state) + (reason === 'correct' ? 1 : -1)))];
    emit('word', { word, state: entry.state, reason });
  }
}
export function decay(state: GameState, emit: Emit) {
  for (const [word, entry] of Object.entries(state.words)) {
    if (entry.state === 'known' && state.day - entry.lastSeen >= state.rules.decayDays) {
      entry.state = 'shaky'; emit('word', { word, state: 'shaky', reason: 'decay' });
    }
  }
}
