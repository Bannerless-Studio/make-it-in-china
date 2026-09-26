import { abandonAll, answer, available, completeTask, enter, getScene } from './dialogue';
import { nextDay, settleRent } from './economy';
import { decay, evidence, meet } from './learner';
import { emptyProgress, gateStatus, scheduled } from './progress';
import { decodeSave, decodeText, encodeSave, EVENT_LIMIT, loadJSON, migrateV1, SaveError, saveJSON, UnsupportedSaveVersionError } from './save';
import { validateScene } from './slots';
import { CommandError, type AssistReason, type Emit, type GameContent, type GameEvent, type GameEvents, type GameOptions, type GameState, type GateStatus, type PurchaseMode } from './types';

export function createGame(input: GameContent, opts: GameOptions = {}) {
  const content = structuredClone(input);
  const rules = { actionSlots: opts.actionSlots ?? 4, foodCost: opts.foodCost ?? 2, rentCost: opts.rentCost ?? 20,
    graceDays: opts.graceDays ?? 3, decayDays: opts.decayDays ?? 3, wrongPenalty: opts.wrongPenalty ?? 1 };
  for (const [name, value] of Object.entries({ ...rules, wallet: opts.wallet ?? 20, seed: opts.seed ?? 1, day: opts.day ?? 1 })) {
    if (name === 'wrongPenalty' && value === 'action') continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (name !== 'wallet' && !Number.isInteger(value)) || (['actionSlots', 'graceDays', 'decayDays', 'wrongPenalty', 'day'].includes(name) && value === 0) || (name === 'wrongPenalty' && value > 5) || (name === 'seed' && value > 4294967295)) throw new CommandError(`Invalid option: ${name}`);
  }
  const day = opts.day ?? 1;
  let current: GameState = loadJSON(JSON.stringify({ v: 2, wallet: opts.wallet ?? 20, day, actionSlots: rules.actionSlots,
    rentDue: false, graceUntil: null, rules, rng: opts.seed ?? 1, commandSeq: 0,
    words: Object.fromEntries(Object.entries(opts.initialWords ?? {}).map(([word, state]) => [word, { state, lastSeen: day }])),
    dialogue: null, returns: [], events: [], progress: { ...emptyProgress(), ...opts.progress }, activity: null, pendingWorldTask: null }));
  const listeners = new Map<keyof GameEvents, Set<(data: never) => void>>();
  const notify = (event: GameEvent) => { for (const callback of [...(listeners.get(event.type) ?? [])]) callback(structuredClone(event.data) as never); };
  function command<T>(action: (state: GameState, emit: Emit) => T): T {
    const { events, ...core } = current;
    const state: GameState = { ...structuredClone(core), events: [...events] }, pending: GameEvent[] = [];
    state.commandSeq++;
    const emit: Emit = (type, data) => {
      const event = structuredClone({ type, day: state.day, seq: state.commandSeq, data }) as GameEvent;
      state.events.push(event); pending.push(event);
    };
    const result = action(state, emit);
    state.events = state.events.slice(-EVENT_LIMIT); current = state;
    for (const event of pending) notify(event);
    notify({ type: 'change', day: state.day, seq: state.commandSeq, data: {} });
    return result;
  }
  const starterWords = () => content.scenes.find(scene => scene.curriculumIndex === 0)?.introduces ?? [];
  return {
    start(sceneId: string, options: { purchase?: PurchaseMode } = {}) { return command((state, emit) => {
      if (state.dialogue) throw new CommandError('Finish the current dialogue first.');
      const scene = getScene(content, sceneId);
      if (scene.kind !== 'consequence' && !scheduled(state, content, scene)) throw new CommandError(`Scene is not available today: ${sceneId}`);
      enter(state, content, scene, emit, false, options.purchase ?? 'buy');
    }); },
    reply(index: number) { return command((state, emit) => answer(state, content, index, emit)); },
    completeWorldTask(taskId: string) { return command((state, emit) => completeTask(state, content, taskId, emit)); },
    abandon() { return command((state, emit) => {
      if (!state.dialogue) throw new CommandError('No activity to abandon.');
      abandonAll(state, emit);
    }); },
    markAssisted(words: string[], reason: AssistReason) { return command((state, emit) => {
      const frame = state.dialogue, activity = state.activity;
      if (!frame || !activity) throw new CommandError('No active exchange to mark assisted.');
      const known = new Set([frame.exchange.line, ...frame.exchange.replies, ...(frame.exchange.hint ? [frame.exchange.hint] : [])].flatMap(text => text.words ?? []));
      const marked = [...new Set(words)];
      for (const word of marked) if (!known.has(word)) throw new CommandError(`Word is not in the current exchange: ${word}`);
      const current = activity.assistedByExchange[frame.exchange.id] ?? [];
      activity.assistedByExchange[frame.exchange.id] = [...new Set([...current, ...marked])];
      emit('assisted', { sceneId: frame.sceneId, exchangeId: frame.exchange.id, words: marked, reason });
    }); },
    recordExposure(words: string[], source: string) { return command((state, emit) => {
      if (!source) throw new CommandError('Exposure needs a source.');
      const dictionary = content.words;
      const marked = [...new Set(words)];
      for (const word of marked) {
        if (dictionary?.length && !dictionary.some(entry => entry.hanzi === word)) throw new CommandError(`Unknown word: ${word}`);
        meet(state, [word], { hanzi: word }, source, emit);
      }
    }); },
    tapWord(word: string) { return command((state, emit) => {
      const frame = state.dialogue;
      const source = frame && [frame.exchange.line, ...frame.exchange.replies].find(text => text.words?.includes(word));
      if (source) meet(state, [word], source, getScene(content, frame!.sceneId).location, emit);
      else if (!Object.hasOwn(state.words, word) || state.words[word].state === 'unseen') throw new CommandError(`Word has not been met: ${word}`);
      evidence(state, [word], 'tap', emit);
    }); },
    sleep() { return command((state, emit) => {
      abandonAll(state, emit);
      nextDay(state, emit); decay(state, emit);
      emit('day', { day: state.day, rentDue: state.rentDue, graceUntil: state.graceUntil });
    }); },
    queryGate: (): GateStatus => gateStatus(current, content),
    claimGate() { return command((state, emit) => {
      if (state.progress.gateReachedDay !== null) return state.progress.gateReachedDay;
      settleRent(state, emit);
      const status = gateStatus(state, content);
      if (status.met < status.total || status.savings < status.target) throw new CommandError('Gate requirements are not met yet.');
      state.progress.gateReachedDay = state.day;
      emit('gate', { ...status, open: true, claimed: true });
      return state.day;
    }); },
    availableScenes: () => structuredClone(available(current, content)),
    state: (): GameState => {
      const { events, ...core } = current, snapshot = structuredClone(core);
      // Compatibility for main.ts: copy analytics only when the legacy property is read.
      return Object.defineProperty(snapshot, 'events', { enumerable: true, configurable: true, get: () => structuredClone(events) }) as GameState;
    },
    events: () => structuredClone(current.events),
    gloss: (word: string) => structuredClone(content.words?.find(entry => entry.hanzi === word)),
    on<K extends keyof GameEvents>(event: K, callback: (data: GameEvents[K]) => void): () => void {
      const callbacks = listeners.get(event) ?? new Set(); listeners.set(event, callbacks);
      callbacks.add(callback as (data: never) => void);
      return () => { callbacks.delete(callback as (data: never) => void); };
    },
    exportString: () => encodeSave(current),
    importString(encoded: string) {
      let state: GameState;
      try { state = decodeSave(encoded); }
      catch (error) {
        if (!(error instanceof UnsupportedSaveVersionError) || error.version !== 1) throw error;
        state = migrateV1(decodeText(encoded), { starterWords: starterWords() });
      }
      for (const frame of [...state.returns, ...(state.dialogue ? [state.dialogue] : [])]) {
        const scene = getScene(content, frame.sceneId); validateScene(scene, content);
        if (scene.exchanges[frame.index]?.id !== frame.exchange.id) throw new SaveError('Save dialogue does not match content.');
      }
      current = state; notify({ type: 'change', day: current.day, seq: current.commandSeq, data: {} });
    },
    saveJSON: () => saveJSON(current),
  };
}
export type Game = ReturnType<typeof createGame>;
