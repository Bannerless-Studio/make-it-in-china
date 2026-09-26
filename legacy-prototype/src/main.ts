import './style.css';
import scenesSource from '../content/phase1/scenes.json?raw';
import wordsSource from '../content/phase1/words.json?raw';
import worldSource from '../content/phase1/world.json?raw';
import type { Npc, Scene, TimeSlot, Word, World } from './content/types';
import { CommandError, createGame, type GameState } from './engine';
import { startScene } from './render/scene';
import { createBubble } from './ui/bubble';
import { createHud } from './ui/hud';
import { createNotebook } from './ui/notebook';
import { createUiShell } from './ui/shell';
import { describeChoices } from './ui/activityAvailability';
import { AudioManager } from './audio/manager';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('Missing #app root');
const appRoot: HTMLDivElement = root;

const scenes = JSON.parse(scenesSource) as Scene[];
const words = JSON.parse(wordsSource) as Word[];
const world = JSON.parse(worldSource) as World;
const jobs = scenes.filter(scene => scene.kind === 'job');
const activities = scenes.filter(scene => scene.kind !== 'consequence');
const starterWords = Object.fromEntries((jobs[0]?.requires ?? []).map(word => [word, 'met' as const]));
const SAVE_KEY = 'make-it-in-china.save.v1';
const UI_STATE_KEY = 'make-it-in-china.ui.v1';
let saved: string | null = null;
try { saved = localStorage.getItem(SAVE_KEY); } catch { /* storage unavailable */ }

type UiState = {
  completedOn: Record<string, number>;
  greetedOn: Record<string, number>;
  safePose?: [number, number, number];
};

function emptyUiState(): UiState {
  return { completedOn: {}, greetedOn: {} };
}

function parseSafePose(value: unknown): [number, number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 3) return undefined;
  const pose = value.map(item => (typeof item === 'number' && Number.isFinite(item) ? item : NaN));
  if (pose.some(item => Number.isNaN(item))) return undefined;
  return [pose[0], pose[1], pose[2]];
}

function loadUiState(): UiState {
  try {
    const value = JSON.parse(localStorage.getItem(UI_STATE_KEY) ?? '');
    if (!value || typeof value !== 'object') return emptyUiState();
    const completedOn = Object.fromEntries(
      Object.entries(value.completedOn ?? {}).filter((entry): entry is [string, number] => (
        typeof entry[1] === "number" && Number.isInteger(entry[1]) && entry[1] > 0
      )),
    );
    const greetedOn = Object.fromEntries(
      Object.entries(value.greetedOn ?? {}).filter((entry): entry is [string, number] => (
        typeof entry[1] === "number" && Number.isInteger(entry[1]) && entry[1] > 0
      )),
    );
    const safePose = parseSafePose(value.safePose);
    return { completedOn, greetedOn, ...(safePose ? { safePose } : {}) };
  } catch {
    return emptyUiState();
  }
}

function randomSeed(): number {
  try {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  } catch {
    return Date.now() >>> 0;
  }
}

let activeNpcId: string | null = null;
let nearNpc: string | null = null;
let greetingOpen = false;
let gateCardDismissed = false;
let pendingCommandError: string | null = null;
let bubble: ReturnType<typeof createBubble> | undefined;
let sceneHandle: Awaited<ReturnType<typeof startScene>> | undefined;
const audio = new AudioManager();
await audio.ready();

function showMessage(hanzi: string, en?: string, npcId = activeNpcId ?? nearNpc ?? undefined): void {
  const npc = world.npcs.find(item => item.id === npcId);
  activeNpcId = npc?.id ?? null;
  greetingOpen = true;
  if (bubble) bubble.message(hanzi, en, npc);
  else pendingCommandError = hanzi;
}

function guardGame<T>(action: () => T, fallback: T): T {
  try {
    return action();
  } catch (error) {
    if (error instanceof CommandError) {
      showMessage(error.message);
      return fallback;
    }
    throw error;
  }
}

let game = createGame(
  { scenes, words, world },
  { initialWords: starterWords, ...(!saved ? { seed: randomSeed() } : {}) },
);
if (saved) {
  const savedString: string = saved;
  try {
    const imported = guardGame(() => {
      game.importString(savedString);
      return true;
    }, false);
    if (!imported) throw new Error('Save rejected.');
  } catch {
    saved = null;
    try {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(UI_STATE_KEY);
    } catch { /* storage unavailable */ }
    game = createGame(
      { scenes, words, world },
      { initialWords: starterWords, seed: randomSeed() },
    );
  }
}

let uiState = saved ? loadUiState() : emptyUiState();
if (!saved) {
  try { localStorage.removeItem(UI_STATE_KEY); } catch { /* storage unavailable */ }
}

function completionDays(): Record<string, number> {
  return Object.fromEntries(guardGame(() => game.events(), [])
    .flatMap(event => (
      event.type === 'sceneEnd' && !event.data.abandoned
        ? [[event.data.sceneId, event.day] as const]
        : []
    )));
}

uiState.completedOn = { ...uiState.completedOn, ...completionDays() };

function persistUiState(): void {
  try {
    localStorage.setItem(UI_STATE_KEY, JSON.stringify(uiState));
  } catch {
    // The loop remains playable when storage is disabled or full.
  }
}

let previousWallet = guardGame(() => game.state().wallet, 0);
let suppressWalletToast = false;
const newWords = new Set<string>();
const completed = () => new Set(Object.keys(uiState.completedOn));
const nextJob = (state: GameState, npcId: string): { scene: Scene; review: boolean } | undefined => {
  const npcJobs = jobs.filter(scene => scene.npc === npcId);
  const done = completed();
  const available = new Set(guardGame(() => game.availableScenes(), []).map(scene => scene.id));
  const firstTime = npcJobs.find(scene => !done.has(scene.id) && available.has(scene.id));
  if (firstTime) return { scene: firstTime, review: false };
  if (!npcJobs.length || npcJobs.some(scene => !done.has(scene.id))) return undefined;
  const scene = npcJobs
    .filter(scene => available.has(scene.id) && uiState.completedOn[scene.id] !== state.day)
    .sort((left, right) => (
      uiState.completedOn[left.id] - uiState.completedOn[right.id]
      || jobs.indexOf(left) - jobs.indexOf(right)
    ))[0];
  return scene ? { scene, review: true } : undefined;
};
const nextActivity = (state: GameState, npcId: string): { scene: Scene; review: boolean } | undefined => {
  const done = completed();
  const available = new Set(guardGame(() => game.availableScenes(), []).map(scene => scene.id));
  const firstTime = activities.find(scene => (
    scene.npc === npcId && available.has(scene.id) && !done.has(scene.id)
  ));
  return firstTime ? { scene: firstTime, review: false } : nextJob(state, npcId);
};

function jobVerb(scene: Scene): string {
  const verb = scene.id.match(/^p\d+_.+_([^_]+)_\d+$/)?.[1]?.replaceAll('_', ' ') ?? 'work';
  return verb === 'dishwasher' ? '洗碗 shift' : verb;
}

function jobObjective(scene: Scene, review: boolean): string {
  const location = world.locations.find(item => item.id === scene.location);
  return `today: ${jobVerb(scene)} at ${location?.name ?? scene.location}${review ? ' (review)' : ''}`;
}

const objective = (state: GameState) => {
  const active = state.dialogue && jobs.find(scene => scene.id === state.dialogue?.sceneId);
  if (active) return jobObjective(active, completed().has(active.id));
  if (state.actionSlots === 0) return 'today: rest';
  const choices = [...new Set(jobs.map(scene => scene.npc))]
    .flatMap(npcId => {
      const choice = nextJob(state, npcId);
      return choice ? [choice] : [];
    });
  const next = choices.find(choice => !choice.review)
    ?? choices.sort((left, right) => (
      uiState.completedOn[left.scene.id] - uiState.completedOn[right.scene.id]
      || jobs.indexOf(left.scene) - jobs.indexOf(right.scene)
    ))[0];
  if (!next) return 'today: shifts complete';
  return jobObjective(next.scene, next.review);
};

function importSave(save: string): void {
  if (!save) throw new Error('Paste a save string first.');
  suppressWalletToast = true;
  let imported = false;
  try {
    imported = guardGame(() => {
      game.importString(save);
      return true;
    }, false);
  } finally {
    suppressWalletToast = false;
    previousWallet = guardGame(() => game.state().wallet, previousWallet);
  }
  if (!imported) throw new Error('Save could not be imported.');
  uiState = { completedOn: completionDays(), greetedOn: {} };
  persistUiState();
  restoreNewWords();
  render();
}

function resetLocalGame(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(UI_STATE_KEY);
  } catch {
    return;
  }
  location.reload();
}

function sleepUntilMorning(): void {
  const slept = guardGame(() => {
    game.sleep();
    return true;
  }, false);
  if (!slept) return;
  const state = guardGame(() => game.state(), null);
  if (!state) return;
  hud.toast(`第${state.day}天`);
  render();
}

const ui = createUiShell(root, {
  hasSave: saved !== null,
  audio,
  onNewGame: resetLocalGame,
  onResetSave: resetLocalGame,
  onExport: () => guardGame(() => game.exportString(), ''),
  onImport: importSave,
  onSleep: sleepUntilMorning,
  onAbandon: () => {
    guardGame(() => { game.abandon(); return undefined; }, undefined);
  },
  getState: () => guardGame(() => game.state(), null),
  getEvents: () => guardGame(() => game.events(), []),
});
const hud = createHud(
  root,
  () => ui.openSleep(),
  () => {
    if (notebook.isOpen()) notebook.toggle();
    ui.openPause();
  },
  audio,
);
const mentorScenes = scenes.filter(scene => scene.kind === 'mentor');
const notebook = createNotebook(
  root,
  words,
  world.locations,
  word => guardGame(() => game.tapWord(word), undefined),
  audio,
  mentorScenes,
  world.npcs,
);
bubble = createBubble(
  root,
  words,
  index => {
    newWords.clear();
    guardGame(() => {
      game.reply(index);
      return undefined;
    }, undefined);
  },
  word => guardGame(() => game.tapWord(word), undefined),
  () => {
    greetingOpen = false;
    render();
  },
  audio,
  (assistedWords, reason) => guardGame(() => { game.markAssisted(assistedWords, reason); return undefined; }, undefined),
);

function restoreNewWords(): void {
  newWords.clear();
  const state = guardGame(() => game.state(), null);
  if (!state) return;
  if (!state.dialogue) return;
  for (const word of state.dialogue.exchange.line.words) {
    if (state.words[word]?.firstSeen?.audio === state.dialogue.exchange.line.audio) newWords.add(word);
  }
}

function timeSlotOf(): TimeSlot {
  const slots = guardGame(() => game.state().actionSlots, 4);
  if (slots >= 4) return 'M';
  if (slots === 3) return 'A1';
  if (slots === 2) return 'A2';
  if (slots === 1) return 'A3';
  return 'E';
}

function render(): void {
  const state = guardGame(() => game.state(), null);
  if (!state || !bubble) return;
  const scene = state.dialogue ? scenes.find(item => item.id === state.dialogue!.sceneId) : undefined;
  const npc = scene ? world.npcs.find(item => item.id === scene.npc) : undefined;
  if (state.dialogue) greetingOpen = false;
  activeNpcId = npc?.id ?? (greetingOpen ? activeNpcId : null);
  if (state.dialogue || !greetingOpen) bubble.render(state.dialogue, npc, newWords);
  hud.render(state, objective(state));
  notebook.render(state);
  sceneHandle?.setSpeakingNpc(activeNpcId);
  sceneHandle?.setTimeSlot(timeSlotOf());
  const gate = guardGame(() => game.queryGate(), null);
  const claimed = state.progress.gateReachedDay !== null;
  hud.setGateBadge(claimed);
  if (gate?.open && !claimed && !gateCardDismissed) {
    ui.showGate(gate, () => {
      guardGame(() => { game.claimGate(); return undefined; }, undefined);
    }, () => { gateCardDismissed = true; });
  } else ui.hideGate();
}

function showBubbleActions(
  hanzi: string,
  en: string | undefined,
  npcId: string | undefined,
  actions: { label: string; primary?: boolean; onClick: () => void }[],
): void {
  const npc = world.npcs.find(item => item.id === npcId);
  activeNpcId = npc?.id ?? activeNpcId ?? null;
  greetingOpen = true;
  bubble?.message(hanzi, en, npc, actions);
}

function attemptStart(sceneId: string): void {
  const scene = scenes.find(item => item.id === sceneId);
  const state = guardGame(() => game.state(), null);
  if (scene?.purchase?.mode === 'withhold-first-reward' && state && !state.progress.inventory[scene.purchase.itemId]) {
    const price = scene.purchase.price;
    showBubbleActions(
      `¥${price} withheld`,
      `First pay withholds ¥${price} for the carry strap.`,
      scene.npc,
      [
        { label: 'Continue', primary: true, onClick: () => {
          newWords.clear();
          guardGame(() => game.start(sceneId), undefined);
        } },
        { label: 'Cancel', onClick: () => { greetingOpen = false; render(); } },
      ],
    );
    return;
  }
  newWords.clear();
  try {
    game.start(sceneId);
  } catch (error) {
    if (!(error instanceof CommandError)) throw error;
    if (scene?.purchase?.mode === 'optional-entry') {
      showBubbleActions(
        'Not enough money',
        `¥${scene.purchase.price} needed for ${scene.purchase.itemId.replaceAll('_', ' ')}.`,
        scene.npc,
        [
          { label: 'Just look', primary: true, onClick: () => {
            newWords.clear();
            guardGame(() => game.start(sceneId, { purchase: 'look' }), undefined);
          } },
          { label: 'Cancel', onClick: () => { greetingOpen = false; render(); } },
        ],
      );
      return;
    }
    showMessage(error.message, undefined, scene?.npc);
  }
}

function maybeStartDialogue(): void {
  if (!nearNpc) return;
  const npcId = nearNpc;
  const state = guardGame(() => game.state(), null);
  if (!state || state.dialogue) return;
  if (!activities.some(scene => scene.npc === npcId)) {
    if (uiState.greetedOn[npcId] !== state.day) {
      uiState.greetedOn[npcId] = state.day;
      persistUiState();
      showMessage('你好。', 'Hello.', npcId);
    }
    return;
  }
  const availableIds = new Set(guardGame(() => game.availableScenes(), []).map(scene => scene.id));
  const choices = describeChoices(scenes, state, availableIds, npcId);
  const startable = choices.filter(choice => choice.available);
  if (!startable.length) {
    if (state.actionSlots === 0) {
      showMessage('今天没有工作了。明天再来。', 'No more work today. Come back tomorrow.', npcId);
    } else if (choices.some(choice => choice.reason === "You don't know these words yet")) {
      showMessage('你还不认识这些字。', "You don't know these words yet.", npcId);
    } else {
      showMessage('今天做完了。', undefined, npcId);
    }
    return;
  }
  if (startable.length === 1) {
    attemptStart(startable[0].id);
    return;
  }
  const npc: Npc | undefined = world.npcs.find(item => item.id === npcId);
  if (!npc) {
    attemptStart(startable[0].id);
    return;
  }
  greetingOpen = true;
  activeNpcId = npc.id;
  bubble?.choices(
    npc,
    choices,
    id => { greetingOpen = false; attemptStart(id); },
    () => { greetingOpen = false; render(); },
  );
}

guardGame(() => game.on('word', event => {
  if (event.reason === 'seen') newWords.add(event.word);
}), () => {});
guardGame(() => game.on('rentDue', event => {
  ui.showRent(event.amount, event.graceUntil);
}), () => {});
guardGame(() => game.on('sceneEnd', event => {
  if (!event.abandoned) {
    uiState.completedOn[event.sceneId] = guardGame(() => game.state().day, 1);
  }
}), () => {});
guardGame(() => game.on('change', () => {
  const wallet = guardGame(() => game.state().wallet, previousWallet);
  if (!suppressWalletToast) hud.walletChange(wallet - previousWallet);
  previousWallet = wallet;
  try {
    localStorage.setItem(SAVE_KEY, guardGame(() => game.exportString(), ''));
    ui.markSaveAvailable();
  } catch {
    // The loop remains playable when storage is disabled or full.
  }
  persistUiState();
  render();
}), () => {});

restoreNewWords();
render();
const restoredState = guardGame(() => game.state(), null);
if (restoredState?.rentDue && restoredState.graceUntil !== null) {
  ui.showRent(restoredState.rules.rentCost, restoredState.graceUntil);
}
if (pendingCommandError) {
  const message = pendingCommandError;
  pendingCommandError = null;
  showMessage(message);
}

declare global {
  interface Window {
    __debug: {
      position(): [number, number, number];
      teleport(x: number, z: number): void;
      snapToNpc(id: string): boolean;
      yaw(): number;
      setTimeSlot(slot: TimeSlot): void;
      timeSlot(): TimeSlot | null;
      day(): number;
      fps(): number;
      draws(): number;
    };
  }
}

window.__debug = {
  position() {
    const pose = sceneHandle?.getPose();
    return pose ? [pose.x, 0, pose.z] : [0, 0, 0];
  },
  teleport(x, z) {
    const pose = sceneHandle?.getPose();
    sceneHandle?.setPose(x, z, pose?.yaw ?? 0);
  },
  snapToNpc(id) {
    return sceneHandle?.snapToNpc(id) ?? false;
  },
  yaw() {
    return sceneHandle?.getYaw() ?? 0;
  },
  setTimeSlot(slot) {
    sceneHandle?.setTimeSlot(slot);
  },
  draws() {
    return sceneHandle?.draws() ?? 0;
  },
  timeSlot() {
    return sceneHandle?.getTimeSlot() ?? null;
  },
  day() {
    return guardGame(() => game.state().day, 0);
  },
  fps() {
    return sceneHandle?.fps() ?? 0;
  },
};

const restoredDialogue = guardGame(() => game.state().dialogue, null);
const restoredScene = restoredDialogue
  ? scenes.find(item => item.id === restoredDialogue.sceneId)
  : undefined;

startScene(root, world, {
  isLocked() {
    return !!guardGame(() => game.state().dialogue, null)
      || greetingOpen
      || notebook.isOpen()
      || ui.isOpen();
  },
  onTalk() {
    maybeStartDialogue();
  },
  onMenu() {
    if (!ui.isOpen()) notebook.toggle();
  },
  onNearNpc(id) {
    nearNpc = id;
  },
  onNpcPosition(id: string, x: number, y: number, visible: boolean) {
    if (activeNpcId === id) bubble?.anchor(x, y, visible);
  },
  onSafePose(x, z, yaw) {
    uiState.safePose = [x, z, yaw];
    persistUiState();
  },
}, {
  pose: uiState.safePose,
  snapNpc: restoredScene?.npc,
  timeSlot: timeSlotOf(),
}).then(handle => {
  sceneHandle = handle;
  sceneHandle.setSpeakingNpc(activeNpcId);
  sceneHandle.setTimeSlot(timeSlotOf());
}).catch(error => showFatal(error));

function showFatal(error: unknown): void {
  const fatal = document.createElement('p');
  fatal.id = 'fatal';
  fatal.textContent = (error instanceof Error ? error.message : 'WebGL unavailable').replace(/\s+/g, ' ');
  appRoot.querySelector('#fatal')?.remove();
  appRoot.append(fatal);
}
