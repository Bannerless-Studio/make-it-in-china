import { describe, expect, it } from 'vitest';
import { AudioManager, type AudioManifest } from '../../src/audio/manager';

const manifest: AudioManifest = {
  clips: {
    base: { url: 'audio/base.opus', text: '你好。' },
    base__v000: { url: 'audio/base__v000.opus', text: '两个杯子。' },
    word_001: { url: 'audio/word_001.opus', text: '杯子' },
  },
  variants: {
    base: {
      slots: ['amount', 'item'],
      byBinding: { 'amount=two|item=cup': 'base__v000' },
    },
  },
  words: { 杯子: 'word_001' },
};

describe('AudioManager manifest resolution', () => {
  it('resolves variants from sorted stable binding ids', () => {
    const manager = new AudioManager({ manifest, storage: null });
    expect(manager.resolve('base', {
      item: { id: 'cup' },
      amount: { id: 'two' },
    })).toBe('base__v000');
  });

  it('falls back to the base id and resolves word ids', () => {
    const manager = new AudioManager({ manifest, storage: null });
    expect(manager.resolve('fixed', {})).toBe('fixed');
    expect(manager.word('杯子')).toBe('word_001');
    expect(manager.word('没有')).toBeUndefined();
  });

  it('recovers a stored slotted sentence by its rendered text', () => {
    const manager = new AudioManager({ manifest, storage: null });
    expect(manager.sentence('base', '两个杯子。')).toBe('base__v000');
  });
});
