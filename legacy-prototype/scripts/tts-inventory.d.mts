export interface TtsClip {
  id: string;
  baseId: string;
  category: string;
  text: string;
  pinyin: string;
  voice: string;
  rate: string;
  pitch: string;
}

export interface TtsInventory {
  clips: TtsClip[];
  variants: Record<string, {
    slots: string[];
    byBinding: Record<string, string>;
  }>;
  words: Record<string, string>;
  wordAudioMap: Record<string, string>;
  warnings: string[];
  categories: Record<string, number>;
}

export function bindingKey(
  names: string[],
  binding: Record<string, { id: string }>
): string;

export function buildWordAudioMap(
  words: Array<Record<string, unknown>>,
  existing?: Record<string, string>,
): {
  current: Record<string, string>;
  retained: Record<string, string>;
};

export function buildTtsInventory(input: {
  words: Array<Record<string, unknown>>;
  scenes: Array<Record<string, unknown>>;
  world: Record<string, unknown>;
  voices: Record<string, unknown>;
  ambient?: unknown;
  wordAudioMap?: Record<string, string>;
}): TtsInventory;
