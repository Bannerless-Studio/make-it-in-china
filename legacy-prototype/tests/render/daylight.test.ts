import { describe, expect, it } from 'vitest';
import {
  DAY_PALETTES,
  lerpPalette,
  paletteForSlot,
  phaseForSlot,
  shadowStretch,
  sunElevation,
} from '../../src/render/daylight';

describe('day-slot palettes', () => {
  it('maps engine slots onto the four ART lighting phases', () => {
    expect(phaseForSlot('M')).toBe('morning');
    expect(phaseForSlot('A1')).toBe('morning');
    expect(phaseForSlot('A2')).toBe('midday');
    expect(phaseForSlot('A3')).toBe('afternoon');
    expect(phaseForSlot('A4')).toBe('evening');
    expect(phaseForSlot('E')).toBe('evening');
  });

  it('keeps ART sky, fog, and sun values for each phase', () => {
    expect(paletteForSlot('M')).toMatchObject({
      sky: 0xdce9e7,
      fogNear: 28,
      fogFar: 82,
      sun: 0xfff0cf,
      lampEmissive: 0,
    });
    expect(paletteForSlot('A2')).toMatchObject({
      sky: DAY_PALETTES.midday.sky,
      fogNear: 34,
      fogFar: 90,
      lampEmissive: 0,
    });
    expect(paletteForSlot('A3').fogNear).toBe(26);
    expect(paletteForSlot('E')).toMatchObject({
      sky: 0xb6c0d2,
      fogNear: 20,
      fogFar: 66,
      lampEmissive: 0.25,
    });
  });

  it('separates the four slots by sky gradient and light level', () => {
    const tops = new Set(Object.values(DAY_PALETTES).map(palette => palette.skyTop));
    const bottoms = new Set(Object.values(DAY_PALETTES).map(palette => palette.skyBottom));
    expect(tops.size).toBe(4);
    expect(bottoms.size).toBe(4);
    expect(DAY_PALETTES.evening.sunIntensity).toBeLessThan(DAY_PALETTES.morning.sunIntensity);
    expect(DAY_PALETTES.evening.hemiIntensity).toBeLessThan(DAY_PALETTES.afternoon.hemiIntensity);
    expect(DAY_PALETTES.evening.lampEmissive).toBeGreaterThan(0);
    expect(DAY_PALETTES.evening.sunDir[1]).toBeLessThan(DAY_PALETTES.midday.sunDir[1]);
  });

  it('interpolates sky, fog range, sun direction, and lamp emissive', () => {
    const mid = lerpPalette(DAY_PALETTES.morning, DAY_PALETTES.evening, 0.5);
    expect(mid.fogNear).toBeCloseTo(24);
    expect(mid.fogFar).toBeCloseTo(74);
    expect(mid.lampEmissive).toBeCloseTo(0.125);
    expect(mid.sunDir[0]).toBeCloseTo(1.5);
    expect(mid.sunDir[1]).toBeCloseTo(5);
    expect(mid.sunIntensity).toBeCloseTo(1.45);
    expect(lerpPalette(DAY_PALETTES.morning, DAY_PALETTES.evening, 0).sky).toBe(DAY_PALETTES.morning.sky);
    expect(lerpPalette(DAY_PALETTES.morning, DAY_PALETTES.evening, 1).sky).toBe(DAY_PALETTES.evening.sky);
  });

  it('prints and separates the four ART slot light values', () => {
    const rows = (['M', 'A2', 'A3', 'E'] as const).map(slot => {
      const palette = paletteForSlot(slot);
      return {
        slot,
        sky: `#${palette.sky.toString(16).padStart(6, '0')}`,
        skyTop: `#${palette.skyTop.toString(16).padStart(6, '0')}`,
        skyBottom: `#${palette.skyBottom.toString(16).padStart(6, '0')}`,
        fog: `#${palette.fog.toString(16).padStart(6, '0')}`,
        sun: `#${palette.sun.toString(16).padStart(6, '0')}`,
        sunIntensity: palette.sunIntensity,
        sunElevationDeg: Math.round((sunElevation(palette) * 180) / Math.PI),
        shadowStretch: Number(shadowStretch(palette).toFixed(2)),
        hemiSky: `#${palette.hemiSky.toString(16).padStart(6, '0')}`,
        hemiGround: `#${palette.hemiGround.toString(16).padStart(6, '0')}`,
        hemiIntensity: palette.hemiIntensity,
        lampEmissive: palette.lampEmissive,
        windowGlow: palette.windowGlow,
      };
    });
    console.table(rows);

    const morning = DAY_PALETTES.morning;
    const midday = DAY_PALETTES.midday;
    const afternoon = DAY_PALETTES.afternoon;
    const evening = DAY_PALETTES.evening;

    expect(sunElevation(morning)).toBeLessThan(sunElevation(midday) - 0.5);
    expect(shadowStretch(morning)).toBeGreaterThan(shadowStretch(midday) * 3);
    expect(sunElevation(evening)).toBeLessThan(sunElevation(morning));
    expect(morning.sunDir[0]).toBeLessThan(0);
    expect(afternoon.sunDir[0]).toBeGreaterThan(0);
    expect(evening.sunDir[0]).toBeGreaterThan(0);
    expect(midday.sunIntensity).toBeGreaterThan(morning.sunIntensity);
    expect(midday.hemiIntensity).toBeGreaterThan(morning.hemiIntensity);
    expect(new Set([morning, midday, afternoon, evening].map(p => p.sunIntensity)).size).toBe(4);
    expect(new Set([morning, midday, afternoon, evening].map(p => p.hemiIntensity)).size).toBe(4);
  });

  it('keeps the evening fog desaturated instead of the amber horizon', () => {
    expect(DAY_PALETTES.evening.fog).toBe(0xb6c0d2);
    expect(DAY_PALETTES.evening.fog).not.toBe(DAY_PALETTES.evening.skyBottom);
    for (const phase of ['morning', 'midday', 'afternoon'] as const) {
      expect(DAY_PALETTES[phase].fog).toBe(DAY_PALETTES[phase].sky);
    }
  });

  it('lights windows and skyline dots only in the evening phase', () => {
    for (const phase of ['morning', 'midday', 'afternoon'] as const) {
      expect(DAY_PALETTES[phase].windowGlow).toBe(0);
      expect(DAY_PALETTES[phase].skylineLit).toBe(0);
      expect(DAY_PALETTES[phase].lampEmissive).toBe(0);
    }
    expect(DAY_PALETTES.evening.windowGlow).toBeGreaterThan(0.5);
    expect(DAY_PALETTES.evening.skylineLit).toBeGreaterThan(0.5);
    expect(DAY_PALETTES.evening.lampEmissive).toBe(0.25);
  });
});
