import type { AnimationClip, Group } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

export const MODEL_MANIFEST = {
  mannequin: {
    url: '/models/character/UAL1_Standard.glb',
    source: 'Quaternius Universal Animation Library Standard',
  },
  'building-a': {
    url: '/models/buildings/building-a.glb',
    source: 'Kenney City Kit (Commercial)',
  },
  'building-b': {
    url: '/models/buildings/building-b.glb',
    source: 'Kenney City Kit (Commercial)',
  },
  'building-c': {
    url: '/models/buildings/building-c.glb',
    source: 'Kenney City Kit (Commercial)',
  },
  awning: {
    url: '/models/buildings/detail-awning.glb',
    source: 'Kenney City Kit (Commercial)',
  },
  streetlight: {
    url: '/models/street/streetlight.glb',
    source: 'KayKit City Builder Bits 1.0 Free',
  },
  bench: {
    url: '/models/street/bench.glb',
    source: 'KayKit City Builder Bits 1.0 Free',
  },
  'box-a': {
    url: '/models/street/box_A.glb',
    source: 'KayKit City Builder Bits 1.0 Free',
  },
  bush: {
    url: '/models/street/bush.glb',
    source: 'KayKit City Builder Bits 1.0 Free',
  },
  'bowl-broth': {
    url: '/models/food/bowl-broth.glb',
    source: 'Kenney Food Kit',
  },
  chopstick: {
    url: '/models/food/chopstick.glb',
    source: 'Kenney Food Kit',
  },
  'cup-tea': {
    url: '/models/food/cup-tea.glb',
    source: 'Kenney Food Kit',
  },
  steamer: {
    url: '/models/food/steamer.glb',
    source: 'Kenney Food Kit',
  },
  pot: {
    url: '/models/food/pot.glb',
    source: 'Kenney Food Kit',
  },
} as const;

export type ModelId = keyof typeof MODEL_MANIFEST;
export type LoadedScenes = Map<ModelId, Group>;

const loader = new GLTFLoader();
const clips = new Map<ModelId, AnimationClip[]>();
const failures = new Set<ModelId>();
const scenes: LoadedScenes = new Map();
const settled = new Set<ModelId>();
const listeners = new Set<(id: ModelId, scene: Group | null) => void>();
let cache: Promise<LoadedScenes> | undefined;

function beginLoading(): Promise<LoadedScenes> {
  if (cache) return cache;
  cache = Promise.all(
    (Object.entries(MODEL_MANIFEST) as [ModelId, (typeof MODEL_MANIFEST)[ModelId]][])
      .map(async ([id, asset]) => {
        try {
          const gltf = await loader.loadAsync(import.meta.env.BASE_URL.replace(/\/$/, '') + asset.url);
          clips.set(id, gltf.animations);
          scenes.set(id, gltf.scene);
        } catch (error) {
          if (!failures.has(id)) {
            failures.add(id);
            console.warn(`Model "${id}" could not be loaded; using its primitive fallback.`, error);
          }
        } finally {
          settled.add(id);
          for (const listener of listeners) listener(id, scenes.get(id) ?? null);
        }
      }),
  ).then(() => scenes);
  return cache;
}

export function loadAll(
  onSettled?: (id: ModelId, scene: Group | null) => void,
): Promise<LoadedScenes> {
  if (onSettled) {
    listeners.add(onSettled);
    for (const id of settled) onSettled(id, scenes.get(id) ?? null);
  }
  const loading = beginLoading();
  return onSettled ? loading.finally(() => listeners.delete(onSettled)) : loading;
}

export function cloneModel(
  scenes: LoadedScenes,
  id: ModelId,
): { scene: Group; animations: AnimationClip[] } | null {
  const source = scenes.get(id);
  if (!source) return null;
  return {
    scene: cloneSkeleton(source) as Group,
    animations: clips.get(id) ?? [],
  };
}
