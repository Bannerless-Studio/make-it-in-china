import {
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshToonMaterial,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { TimeSlot } from '../content/types';
import { createSky } from './street';
import {
  DAY_TRANSITION,
  DAY_TRANSITION_REDUCED,
  PALETTE,
  SHADOW_GRAZE_BIAS,
  SHADOW_MAP,
  SHADOW_NORMAL_BIAS,
  SHADOW_SPAN,
} from './constants';

export interface DayPalette {
  sky: number;
  fog: number;
  fogNear: number;
  fogFar: number;
  fogDensity: number;
  sun: number;
  hemiSky: number;
  hemiGround: number;
  shadowTint: number;
  sunDir: [number, number, number];
  lampEmissive: number;
  skyTop: number;
  skyBottom: number;
  sunIntensity: number;
  hemiIntensity: number;
  windowGlow: number;
  skylineLit: number;
}

export const DAY_PALETTES = {
  morning: {
    sky: 0xdce9e7,
    fog: 0xdce9e7,
    fogNear: 28,
    fogFar: 82,
    fogDensity: 0.01,
    sun: 0xfff0cf,
    hemiSky: 0xe8f1ea,
    hemiGround: 0xb6a489,
    shadowTint: 0x7d939b,
    sunDir: [-21, 6.5, -8] as [number, number, number],
    lampEmissive: 0,
    skyTop: 0x9dc3d6,
    skyBottom: 0xdce9e7,
    sunIntensity: 1.75,
    hemiIntensity: 1.25,
    windowGlow: 0,
    skylineLit: 0,
  },
  midday: {
    sky: 0xd5e8ef,
    fog: 0xd5e8ef,
    fogNear: 34,
    fogFar: 90,
    fogDensity: 0.008,
    sun: 0xfff8e6,
    hemiSky: 0xe6f1f6,
    hemiGround: 0xc0ad8e,
    shadowTint: 0x788e9b,
    sunDir: [-4, 26, -5] as [number, number, number],
    lampEmissive: 0,
    skyTop: 0x7fb4dd,
    skyBottom: 0xd5e8ef,
    sunIntensity: 2.35,
    hemiIntensity: 1.45,
    windowGlow: 0,
    skylineLit: 0,
  },
  afternoon: {
    sky: 0xe9ddc7,
    fog: 0xe9ddc7,
    fogNear: 26,
    fogFar: 76,
    fogDensity: 0.012,
    sun: 0xffdca8,
    hemiSky: 0xf3e6cd,
    hemiGround: 0xba9e7d,
    shadowTint: 0x8f8989,
    sunDir: [18, 11, -7] as [number, number, number],
    lampEmissive: 0,
    skyTop: 0xc19b82,
    skyBottom: 0xf1e4cd,
    sunIntensity: 1.95,
    hemiIntensity: 1.1,
    windowGlow: 0,
    skylineLit: 0,
  },
  evening: {
    sky: 0xb6c0d2,
    fog: 0xb6c0d2,
    fogNear: 20,
    fogFar: 66,
    fogDensity: 0.016,
    sun: 0xf2bc87,
    hemiSky: 0xd5dbea,
    hemiGround: 0x9a897e,
    shadowTint: 0x6c758f,
    sunDir: [24, 3.5, -3] as [number, number, number],
    lampEmissive: 0.25,
    skyTop: 0x414c6e,
    skyBottom: 0xc99c7e,
    sunIntensity: 1.15,
    hemiIntensity: 0.65,
    windowGlow: 0.85,
    skylineLit: 0.9,
  },
} satisfies Record<string, DayPalette>;

export type DayPhase = keyof typeof DAY_PALETTES;

export function phaseForSlot(slot: TimeSlot): DayPhase {
  if (slot === 'M' || slot === 'A1') return 'morning';
  if (slot === 'A2') return 'midday';
  if (slot === 'A3') return 'afternoon';
  return 'evening';
}

export function paletteForSlot(slot: TimeSlot): DayPalette {
  return DAY_PALETTES[phaseForSlot(slot)];
}

export function lerpPalette(from: DayPalette, to: DayPalette, t: number): DayPalette {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  const mix = (a: number, b: number) => new Color(a).lerp(new Color(b), u).getHex();
  return {
    sky: mix(from.sky, to.sky),
    fog: mix(from.fog, to.fog),
    fogNear: from.fogNear + (to.fogNear - from.fogNear) * u,
    fogFar: from.fogFar + (to.fogFar - from.fogFar) * u,
    fogDensity: from.fogDensity + (to.fogDensity - from.fogDensity) * u,
    sun: mix(from.sun, to.sun),
    hemiSky: mix(from.hemiSky, to.hemiSky),
    hemiGround: mix(from.hemiGround, to.hemiGround),
    shadowTint: mix(from.shadowTint, to.shadowTint),
    sunDir: [
      from.sunDir[0] + (to.sunDir[0] - from.sunDir[0]) * u,
      from.sunDir[1] + (to.sunDir[1] - from.sunDir[1]) * u,
      from.sunDir[2] + (to.sunDir[2] - from.sunDir[2]) * u,
    ],
    lampEmissive: from.lampEmissive + (to.lampEmissive - from.lampEmissive) * u,
    skyTop: mix(from.skyTop, to.skyTop),
    skyBottom: mix(from.skyBottom, to.skyBottom),
    sunIntensity: from.sunIntensity + (to.sunIntensity - from.sunIntensity) * u,
    hemiIntensity: from.hemiIntensity + (to.hemiIntensity - from.hemiIntensity) * u,
    windowGlow: from.windowGlow + (to.windowGlow - from.windowGlow) * u,
    skylineLit: from.skylineLit + (to.skylineLit - from.skylineLit) * u,
  };
}

export function sunElevation(palette: DayPalette): number {
  const [x, y, z] = palette.sunDir;
  return Math.atan2(y, Math.hypot(x, z));
}

export function shadowStretch(palette: DayPalette): number {
  const elevation = Math.max(0.08, sunElevation(palette));
  return Math.min(4, 1 / Math.tan(elevation));
}

export function transitionDuration(): number {
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return DAY_TRANSITION_REDUCED;
  }
  return DAY_TRANSITION;
}

export interface DayTarget {
  setDayTone(palette: DayPalette): void;
}

export interface Daylight {
  sun: DirectionalLight;
  hemi: HemisphereLight;
  slot(): TimeSlot;
  setSlot(slot: TimeSlot): void;
  apply(slot: TimeSlot): void;
  attach(target: DayTarget | null): void;
  palette(): DayPalette;
  update(dt: number, player: Vector3, lamps: Mesh[]): void;
}

function paintLamps(lamps: Mesh[], intensity: number): void {
  for (const lamp of lamps) {
    lamp.traverse(object => {
      if (!(object instanceof Mesh) || !object.userData.lamp) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!(material instanceof MeshToonMaterial)) continue;
        material.emissive.setHex(PALETTE.ochre);
        material.emissiveIntensity = intensity;
      }
    });
  }
}

export function createDaylight(
  scene: Scene,
  renderer: WebGLRenderer,
  mobile: boolean,
  slot: TimeSlot = 'M',
): Daylight {
  const start = paletteForSlot(slot);
  const sky = createSky(scene);
  sky.setColors(start.skyTop, start.skyBottom);
  scene.background = new Color(start.sky);
  scene.fog = new Fog(start.sky, start.fogNear, start.fogFar);
  renderer.setClearColor(start.sky, 1);
  const hemi = new HemisphereLight(start.hemiSky, start.hemiGround, start.hemiIntensity);
  scene.add(hemi);
  const sun = new DirectionalLight(start.sun, start.sunIntensity);
  sun.position.set(...start.sunDir);
  if (!mobile) {
    sun.castShadow = true;
    sun.target.position.set(0, 0, 0);
    scene.add(sun.target);
    sun.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 45;
    sun.shadow.camera.left = -SHADOW_SPAN / 2;
    sun.shadow.camera.right = SHADOW_SPAN / 2;
    sun.shadow.camera.top = SHADOW_SPAN / 2;
    sun.shadow.camera.bottom = -SHADOW_SPAN / 2;
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.02;
  }
  scene.add(sun);

  let activeSlot: TimeSlot = slot;
  let from = start;
  let to = start;
  let elapsed = 0;
  let duration = transitionDuration();
  let current = start;

  let target: DayTarget | null = null;

  function commit(palette: DayPalette, player: Vector3, lamps: Mesh[]): void {
    current = palette;
    (scene.background as Color).setHex(palette.skyBottom);
    const fog = scene.fog;
    if (fog instanceof Fog) {
      fog.color.setHex(palette.fog);
      fog.near = palette.fogNear;
      fog.far = palette.fogFar;
    }
    renderer.setClearColor(palette.skyBottom, 1);
    hemi.color.setHex(palette.hemiSky);
    hemi.groundColor.setHex(palette.hemiGround);
    hemi.intensity = palette.hemiIntensity;
    sun.color.setHex(palette.sun);
    sun.intensity = palette.sunIntensity;
    sky.setColors(palette.skyTop, palette.skyBottom);
    sky.mesh.position.set(player.x, 0, player.z);
    sun.position.set(
      player.x + palette.sunDir[0],
      palette.sunDir[1],
      player.z + palette.sunDir[2],
    );
    if (!mobile) {
      sun.target.position.copy(player);
      sun.target.updateMatrixWorld();
      const graze = 1 - Math.sin(Math.max(0.05, sunElevation(palette)));
      sun.shadow.normalBias = SHADOW_NORMAL_BIAS + graze * SHADOW_GRAZE_BIAS;
    }
    paintLamps(lamps, palette.lampEmissive);
    target?.setDayTone(palette);
  }

  return {
    sun,
    hemi,
    slot() { return activeSlot; },
    palette() { return current; },
    attach(next) {
      target = next;
      target?.setDayTone(current);
    },
    setSlot(next) {
      const wanted = paletteForSlot(next);
      activeSlot = next;
      if (wanted === to) return;
      from = current;
      to = wanted;
      elapsed = 0;
      duration = transitionDuration();
    },
    apply(next) {
      activeSlot = next;
      const palette = paletteForSlot(next);
      from = palette;
      to = palette;
      elapsed = duration;
      current = palette;
    },
    update(dt, player, lamps) {
      elapsed += dt;
      const t = duration <= 0 ? 1 : Math.min(1, elapsed / duration);
      commit(t >= 1 ? to : lerpPalette(from, to, t), player, lamps);
    },
  };
}
