import { describe, expect, it } from 'vitest';
import { normalizePreferences } from '../../src/ui/preferences';

describe('UI preferences', () => {
  it('uses the design defaults for missing settings', () => {
    expect(normalizePreferences(undefined)).toEqual({
      pinyin: false,
      textSize: 100,
    });
  });

  it('accepts supported persisted values', () => {
    expect(normalizePreferences({ pinyin: true, textSize: 150 })).toEqual({
      pinyin: true,
      textSize: 150,
    });
  });

  it('rejects malformed and unsupported persisted values', () => {
    expect(normalizePreferences({ pinyin: 'yes', textSize: 200 })).toEqual({
      pinyin: false,
      textSize: 100,
    });
  });
});
