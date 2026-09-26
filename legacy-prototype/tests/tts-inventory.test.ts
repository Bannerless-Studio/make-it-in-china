import { describe, expect, it } from 'vitest';
import {
  buildTtsInventory,
  buildWordAudioMap,
} from '../scripts/tts-inventory.mjs';

const voices = {
  cook: { voice: 'cook-voice', rate: '-10%', pitch: '+2Hz' },
  player: { voice: 'player-voice', rate: '-10%', pitch: '+0Hz' },
  system: { voice: 'system-voice', rate: '-15%', pitch: '+0Hz' },
};

const world = {
  npcs: [{ id: 'cook' }],
  slotPools: [{
    id: 'number_1_10',
    values: [
      { id: 'n01', hanzi: '一', pinyin: 'yī' },
      { id: 'n02', hanzi: '二', pinyin: 'èr' },
      { id: 'n03', hanzi: '三', pinyin: 'sān' },
      { id: 'n04', hanzi: '四', pinyin: 'sì' },
      { id: 'n05', hanzi: '五', pinyin: 'wǔ' },
      { id: 'n06', hanzi: '六', pinyin: 'liù' },
      { id: 'n07', hanzi: '七', pinyin: 'qī' },
      { id: 'n08', hanzi: '八', pinyin: 'bā' },
      { id: 'n09', hanzi: '九', pinyin: 'jiǔ' },
      { id: 'n10', hanzi: '十', pinyin: 'shí' },
    ],
  }],
};

describe('TTS inventory', () => {
  it('orders S01 pair variants by slot name and excludes equal values', () => {
    const inventory = buildTtsInventory({
      words: [{ hanzi: '杯子', pinyin: 'bēizi' }],
      world,
      voices,
      scenes: [{
        npc: 'cook',
        exchanges: [{
          id: 'p1_noodle_dishwasher_01_e4',
          slots: {
            cup_count: 'number_1_10',
            bowl_count: 'number_1_10',
          },
          line: {
            audio: 'p1_noodle_dishwasher_01_e4',
            hanzi: '{cup_count}杯子，{bowl_count}碗。',
            pinyin: '{cup_count} bēizi, {bowl_count} wǎn.',
          },
          replies: [{
            audio: 'p1_noodle_dishwasher_01_e4_r1',
            hanzi: '{cup_count}个。',
            pinyin: '{cup_count} gè.',
            correct: true,
          }],
        }],
      }],
    });

    const lineVariant = inventory.variants.p1_noodle_dishwasher_01_e4;
    expect(lineVariant.slots).toEqual(['bowl_count', 'cup_count']);
    expect(Object.keys(lineVariant.byBinding)).toHaveLength(90);
    expect(lineVariant.byBinding['bowl_count=n01|cup_count=n02'])
      .toBe('p1_noodle_dishwasher_01_e4__v000');
    expect(inventory.clips.find((clip) => clip.id.endsWith('__v000'))?.text)
      .toBe('二杯子，一碗。');
    expect(inventory.variants.p1_noodle_dishwasher_01_e4_r1.slots)
      .toEqual(['cup_count']);
  });

  it('uses fixed authored IDs, maps dictionary order, and warns on missing audio', () => {
    const inventory = buildTtsInventory({
      words: [
        { hanzi: '爱', pinyin: 'ài' },
        { hanzi: '杯子', pinyin: 'bēizi' },
      ],
      world,
      voices,
      scenes: [{
        npc: 'cook',
        exchanges: [{
          id: 'fixed_e1',
          line: { audio: 'fixed_e1', hanzi: '杯子。', pinyin: 'Bēizi.' },
          replies: [
            { audio: 'fixed_e1_r1', hanzi: '杯子。', pinyin: 'Bēizi.', correct: true },
            { hanzi: '爱。', pinyin: 'Ài.', correct: false },
          ],
        }],
      }],
    });

    expect(inventory.clips.map((clip) => clip.id)).toEqual([
      'fixed_e1',
      'fixed_e1_r1',
      'word_001',
      'word_002',
    ]);
    expect(inventory.words).toEqual({ 爱: 'word_001', 杯子: 'word_002' });
    expect(inventory.warnings).toEqual([
      'fixed_e1_r2 replies has no audio id; skipped',
      'fixed_e1 has no hint; skipped',
    ]);
  });

  it('retains word clip IDs across reorder and appends new dictionary words', () => {
    const mapping = buildWordAudioMap(
      [
        { hanzi: '杯子' },
        { hanzi: '爱' },
        { hanzi: '茶' },
      ],
      { 爱: 'word_001', 杯子: 'word_002' },
    );
    expect(mapping.current).toEqual({
      杯子: 'word_002',
      爱: 'word_001',
      茶: 'word_003',
    });
    expect(mapping.retained).toEqual({
      爱: 'word_001',
      杯子: 'word_002',
      茶: 'word_003',
    });
  });

  it('rejects a slot-pool value without an authored stable ID', () => {
    expect(() => buildTtsInventory({
      words: [],
      scenes: [],
      world: {
        ...world,
        slotPools: [{ id: 'size', values: [{ hanzi: '大', pinyin: 'dà' }] }],
      },
      voices,
    })).toThrow('missing a stable id');
  });

  it('inventories optional ambient and system speech with their owners', () => {
    const inventory = buildTtsInventory({
      words: [],
      scenes: [],
      world: {
        ...world,
        systemLines: [{ id: 'system_ready', text: '好。', pinyin: 'Hǎo.' }],
      },
      voices,
      ambient: {
        lines: [{ id: 'amb_01', hanzi: '杯子。', pinyin: 'Bēizi.', npc: 'cook' }],
      },
    });

    expect(inventory.clips).toMatchObject([
      { id: 'amb_01', category: 'ambient', voice: 'cook-voice' },
      { id: 'system_ready', category: 'system', voice: 'system-voice' },
    ]);
  });
});
