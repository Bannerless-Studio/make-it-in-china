export type TextSize = 100 | 125 | 150;

export interface UiPreferences {
  pinyin: boolean;
  textSize: TextSize;
}

const STORAGE_KEY = 'make-it-in-china.preferences.v1';
const TEXT_SIZES: TextSize[] = [100, 125, 150];

export function normalizePreferences(value: unknown): UiPreferences {
  const source = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};
  return {
    pinyin: source.pinyin === true,
    textSize: TEXT_SIZES.includes(source.textSize as TextSize)
      ? source.textSize as TextSize
      : 100,
  };
}

export function loadPreferences(storage: Storage | null = safeStorage()): UiPreferences {
  try {
    return normalizePreferences(JSON.parse(storage?.getItem(STORAGE_KEY) ?? ''));
  } catch {
    return normalizePreferences(undefined);
  }
}

export function savePreferences(preferences: UiPreferences, storage: Storage | null = safeStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    return;
  }
}

export function applyPreferences(preferences: UiPreferences): void {
  document.documentElement.dataset.pinyin = String(preferences.pinyin);
  document.documentElement.dataset.textSize = String(preferences.textSize);
  document.dispatchEvent(new CustomEvent('ui-preferences-change'));
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
