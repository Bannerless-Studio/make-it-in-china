export interface AudioManifest {
  clips: Record<string, { url: string; text?: string; bytes?: number }>;
  variants: Record<string, { slots?: string[]; byBinding: Record<string, string> }>;
  words: Record<string, string>;
}

export interface AudioSettings {
  master: number;
  speech: number;
  muted: boolean;
}

export interface AudioState {
  playing: boolean;
  lastId: string | null;
  contextState: AudioContextState | 'unavailable';
}

export type PlayResult = 'completed' | 'cancelled' | 'missing' | 'blocked' | 'muted';

type ManagerOptions = {
  baseUrl?: string;
  manifest?: AudioManifest;
  storage?: Storage | null;
  contextFactory?: () => AudioContext;
  onMissing?: (id: string) => void;
};

type CurrentPlayback = {
  source: AudioBufferSourceNode;
  finish: (result: PlayResult) => void;
};

declare global {
  interface Window {
    __audioState?: AudioState;
  }
}

const CACHE_LIMIT = 16 * 1024 * 1024;
const SETTINGS_KEY = 'make-it-in-china.audio.v1';
const EMPTY_MANIFEST: AudioManifest = { clips: {}, variants: {}, words: {} };

function clampVolume(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function defaultContextFactory(): AudioContext {
  const Context = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) throw new Error('Web Audio is unavailable');
  return new Context();
}

export class AudioManager {
  private readonly baseUrl: string;
  private readonly storage: Storage | null;
  private readonly contextFactory: () => AudioContext;
  private readonly missingCallback?: (id: string) => void;
  private readonly missingIds = new Set<string>();
  private readonly listeners = new Set<(state: AudioState) => void>();
  private readonly decoded = new Map<string, { buffer: AudioBuffer; bytes: number }>();
  private readonly manifestPromise: Promise<AudioManifest>;
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private speechGain: GainNode | null = null;
  private current: CurrentPlayback | null = null;
  private cacheBytes = 0;
  private token = 0;
  private lastId: string | null = null;
  private settingsValue: AudioSettings;
  private gestureTarget: Window | null = null;

  constructor(options: ManagerOptions = {}) {
    this.baseUrl = options.baseUrl ?? import.meta.env.BASE_URL;
    this.storage = options.storage === undefined ? defaultStorage() : options.storage;
    this.contextFactory = options.contextFactory ?? defaultContextFactory;
    this.missingCallback = options.onMissing;
    this.settingsValue = this.loadSettings();
    this.manifestValue = options.manifest ?? null;
    this.manifestPromise = options.manifest
      ? Promise.resolve(options.manifest)
      : this.loadManifest();
    if (typeof window !== 'undefined') {
      this.gestureTarget = window;
      window.addEventListener('pointerdown', this.handleGesture, { passive: true, capture: true });
      window.addEventListener('touchstart', this.handleGesture, { passive: true, capture: true });
      window.addEventListener('keydown', this.handleGesture);
    }
    this.publishState();
  }

  private readonly handleGesture = (): void => {
    void this.unlock();
  };

  private removeGestureListeners(): void {
    if (!this.gestureTarget) return;
    this.gestureTarget.removeEventListener('pointerdown', this.handleGesture, true);
    this.gestureTarget.removeEventListener('touchstart', this.handleGesture, true);
    this.gestureTarget.removeEventListener('keydown', this.handleGesture);
    this.gestureTarget = null;
  }

  private loadSettings(): AudioSettings {
    try {
      const parsed = JSON.parse(this.storage?.getItem(SETTINGS_KEY) ?? '');
      return {
        master: clampVolume(parsed?.master, 1),
        speech: clampVolume(parsed?.speech, 1),
        muted: parsed?.muted === true,
      };
    } catch {
      return { master: 1, speech: 1, muted: false };
    }
  }

  private persistSettings(): void {
    try {
      this.storage?.setItem(SETTINGS_KEY, JSON.stringify(this.settingsValue));
    } catch {
      // Audio controls remain usable when storage is unavailable.
    }
  }

  private assetUrl(path: string): string {
    if (/^(?:https?:)?\/\//u.test(path)) return path;
    const base = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
    return `${base}${path.replace(/^\//u, '')}`;
  }

  private async fetchWithRetry(url: string): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Audio request failed: ${response.status}`);
        return response;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  private async loadManifest(): Promise<AudioManifest> {
    try {
      const response = await this.fetchWithRetry(this.assetUrl('audio/manifest.json'));
      const value = await response.json() as Partial<AudioManifest>;
      if (!value.clips || !value.variants || !value.words) return EMPTY_MANIFEST;
      return value as AudioManifest;
    } catch {
      return EMPTY_MANIFEST;
    }
  }

  private reportMissing(id: string): void {
    if (this.missingIds.has(id)) return;
    this.missingIds.add(id);
    this.missingCallback?.(id);
  }

  private publishState(): void {
    const state = this.state();
    if (typeof window !== 'undefined') window.__audioState = state;
    for (const listener of this.listeners) listener(state);
  }

  private applyVolumes(): void {
    if (this.masterGain) {
      this.masterGain.gain.value = this.settingsValue.muted ? 0 : this.settingsValue.master;
    }
    if (this.speechGain) this.speechGain.gain.value = this.settingsValue.speech;
  }

  private remember(id: string, buffer: AudioBuffer): void {
    const bytes = buffer.length * buffer.numberOfChannels * 4;
    if (bytes > CACHE_LIMIT) return;
    const previous = this.decoded.get(id);
    if (previous) this.cacheBytes -= previous.bytes;
    this.decoded.delete(id);
    while (this.cacheBytes + bytes > CACHE_LIMIT) {
      const oldest = this.decoded.entries().next().value as [string, { bytes: number }] | undefined;
      if (!oldest) break;
      this.decoded.delete(oldest[0]);
      this.cacheBytes -= oldest[1].bytes;
    }
    this.decoded.set(id, { buffer, bytes });
    this.cacheBytes += bytes;
  }

  private cached(id: string): AudioBuffer | undefined {
    const entry = this.decoded.get(id);
    if (!entry) return undefined;
    this.decoded.delete(id);
    this.decoded.set(id, entry);
    return entry.buffer;
  }

  private async bufferFor(id: string, url: string): Promise<AudioBuffer> {
    const cached = this.cached(id);
    if (cached) return cached;
    if (!this.context) throw new Error('AudioContext is locked');
    const response = await this.fetchWithRetry(this.assetUrl(url));
    const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
    this.remember(id, buffer);
    return buffer;
  }

  async unlock(): Promise<boolean> {
    try {
      if (!this.context) {
        this.context = this.contextFactory();
        this.masterGain = this.context.createGain();
        this.speechGain = this.context.createGain();
        this.speechGain.connect(this.masterGain);
        this.masterGain.connect(this.context.destination);
        this.applyVolumes();
      }
      if (this.context.state === 'suspended') await this.context.resume();
      this.removeGestureListeners();
      this.publishState();
      return this.context.state === 'running';
    } catch {
      this.publishState();
      return false;
    }
  }

  resolve(baseId: string, bindings: Record<string, { id: string }>): string {
    const manifest = this.manifestSnapshot();
    const variant = manifest?.variants[baseId];
    if (!variant) return baseId;
    const names = variant.slots?.length
      ? [...variant.slots].sort()
      : Object.keys(bindings).sort();
    const key = names.map(name => `${name}=${bindings[name]?.id ?? ''}`).join('|');
    return variant.byBinding[key] ?? baseId;
  }

  word(hanzi: string): string | undefined {
    return this.manifestSnapshot()?.words[hanzi];
  }

  sentence(baseId: string, text: string): string {
    const manifest = this.manifestSnapshot();
    if (!manifest) return baseId;
    const variant = manifest.variants[baseId];
    return Object.values(variant?.byBinding ?? {})
      .find(id => manifest.clips[id]?.text === text) ?? baseId;
  }

  private manifestValue: AudioManifest | null = null;

  private manifestSnapshot(): AudioManifest | null {
    return this.manifestValue;
  }

  async ready(): Promise<void> {
    this.manifestValue = await this.manifestPromise;
  }

  async play(
    id: string,
    options: { interrupt?: boolean; onStart?: () => void } = {},
  ): Promise<PlayResult> {
    await this.ready();
    const token = ++this.token;
    if (options.interrupt !== false) this.stopCurrent('cancelled');
    this.lastId = id;
    this.publishState();
    if (this.settingsValue.muted) return 'muted';
    if (this.context?.state === 'suspended') {
      try {
        await this.context.resume();
      } catch {
        return 'blocked';
      }
    }
    if (!this.context || this.context.state !== 'running') return 'blocked';
    const clip = this.manifestValue?.clips[id];
    if (!clip) {
      this.reportMissing(id);
      return 'missing';
    }
    let buffer: AudioBuffer;
    try {
      buffer = await this.bufferFor(id, clip.url);
    } catch {
      if (token === this.token) this.reportMissing(id);
      return token === this.token ? 'missing' : 'cancelled';
    }
    if (token !== this.token || !this.context || !this.speechGain) return 'cancelled';
    let source: AudioBufferSourceNode;
    try {
      source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.speechGain);
    } catch {
      return 'blocked';
    }
    return new Promise(resolve => {
      let settled = false;
      const finish = (result: PlayResult): void => {
        if (settled) return;
        settled = true;
        source.onended = null;
        source.disconnect();
        if (this.current?.source === source) this.current = null;
        this.publishState();
        resolve(result);
      };
      this.current = { source, finish };
      source.onended = () => finish('completed');
      try {
        source.start();
      } catch {
        finish('blocked');
        return;
      }
      options.onStart?.();
      this.publishState();
    });
  }

  private stopCurrent(result: PlayResult): void {
    const active = this.current;
    if (!active) return;
    this.current = null;
    active.finish(result);
    try {
      active.source.stop();
    } catch {
      // A source may already have ended between the state check and stop.
    }
  }

  stop(): void {
    this.token += 1;
    this.stopCurrent('cancelled');
  }

  subscribe(listener: (state: AudioState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state());
    return () => this.listeners.delete(listener);
  }

  state(): AudioState {
    return {
      playing: this.current !== null,
      lastId: this.lastId,
      contextState: this.context?.state ?? 'unavailable',
    };
  }

  settings(): AudioSettings {
    return { ...this.settingsValue };
  }

  setVolumes(values: Partial<Pick<AudioSettings, 'master' | 'speech'>>): void {
    this.settingsValue = {
      ...this.settingsValue,
      master: clampVolume(values.master, this.settingsValue.master),
      speech: clampVolume(values.speech, this.settingsValue.speech),
    };
    this.applyVolumes();
    this.persistSettings();
  }

  setMuted(muted: boolean): void {
    this.settingsValue = { ...this.settingsValue, muted };
    this.applyVolumes();
    this.persistSettings();
    this.publishState();
  }

  toggleMuted(): boolean {
    this.setMuted(!this.settingsValue.muted);
    return this.settingsValue.muted;
  }

  dispose(): void {
    this.removeGestureListeners();
    this.stop();
    this.decoded.clear();
    this.cacheBytes = 0;
    void this.context?.close();
    this.context = null;
    this.masterGain = null;
    this.speechGain = null;
    this.publishState();
  }
}
