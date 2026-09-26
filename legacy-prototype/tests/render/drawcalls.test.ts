import { describe, expect, it } from 'vitest';
import { Group, Mesh, MeshToonMaterial, Object3D, Scene } from 'three';
import { GeomBatch } from '../../src/render/geom';
import type { World } from '../../src/content/types';
import { buildDistrict } from '../../src/render/world';
import { buildStreet, addGroundDecals } from '../../src/render/street';
import { PEDESTRIAN_ROUTES } from '../../src/render/crowd';
import worldJSON from '../../content/phase1/world.json?raw';

const world = JSON.parse(worldJSON) as World;

const DRAW_BUDGET = 190;

function fakeElement(): HTMLElement {
  const children: unknown[] = [];
  return {
    className: '',
    textContent: '',
    dataset: {} as DOMStringMap,
    style: {} as CSSStyleDeclaration,
    classList: { toggle: () => false },
    append: (...nodes: unknown[]) => children.push(...nodes),
  } as unknown as HTMLElement;
}

function withDocument<T>(run: () => T): T {
  const previous = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = { createElement: () => fakeElement() };
  try {
    return run();
  } finally {
    (globalThis as { document?: unknown }).document = previous;
  }
}

function drawUnits(root: Object3D): number {
  let draws = 0;
  root.traverse(object => {
    if (!(object instanceof Mesh) || !object.visible) return;
    draws += Array.isArray(object.material) ? object.material.length : 1;
  });
  return draws;
}

describe('spawn draw-call budget', () => {
  it('keeps the static district plus characters and crowd inside the round-2 budget', () => {
    const scene = new Scene();
    const district = withDocument(() => buildDistrict(scene, world, new Map(), fakeElement()));
    const staticDraws = drawUnits(district.group);

    const skyDome = 1;
    const body = 3;
    const blob = 1;
    const kit = 2;
    const namedAccessories = [4, 4, 4, 8, 4, 6, 6, 4, 6];
    const cyclistBike = 4;

    expect(namedAccessories.length).toBe(1 + world.npcs.length);
    const namedCast = namedAccessories.reduce(
      (sum, accessories) => sum + body + blob + accessories,
      0,
    );
    const crowdWalkers = PEDESTRIAN_ROUTES.length + 1;
    const bagCarriers = 2;
    const crowd = crowdWalkers * (body + blob) + bagCarriers * kit + cyclistBike;
    const total = staticDraws + skyDome + namedCast + crowd;

    console.table([{
      staticDistrict: staticDraws,
      skyDome,
      playerAndNpcs: namedCast,
      crowd,
      total,
      budget: DRAW_BUDGET,
    }]);

    expect(staticDraws).toBeLessThanOrEqual(90);
    expect(total).toBeLessThanOrEqual(DRAW_BUDGET);
  });

  it('adds no more than two ground-surface draws over the bare street', () => {
    const bare = new Group();
    buildStreet(bare);
    const before = drawUnits(bare);
    addGroundDecals(bare, [{ x: 0, z: 0, w: 1, d: 1 }]);
    expect(drawUnits(bare) - before).toBe(1);

    const surfaces = new Set<string>();
    bare.traverse(object => {
      if (object instanceof Mesh && (object.name === 'road-paint' || object.name === 'ground-decals')) {
        surfaces.add(object.name);
      }
    });
    expect(surfaces.size).toBe(2);
  });
});

describe('batch merging', () => {
  it('collapses many colours into one vertex-coloured draw plus its hull', () => {
    const group = new Group();
    const batch = new GeomBatch();
    batch.box(1, 1, 1, 0xc65d3b, 0, 0.5, 0);
    batch.box(1, 1, 1, 0x526d82, 2, 0.5, 0);
    batch.box(1, 1, 1, 0x6d8963, 4, 0.5, 0);
    const meshes = batch.flush(group);
    expect(meshes.length).toBe(1);
    expect(drawUnits(group)).toBe(2);

    const material = meshes[0].material as MeshToonMaterial;
    expect(material.vertexColors).toBe(true);
    expect(material.color.getHex()).toBe(0xffffff);

    const color = meshes[0].geometry.getAttribute('color');
    expect(color.itemSize).toBe(3);
    expect(color.count).toBe(meshes[0].geometry.getAttribute('position').count);
    const swatches = new Set<string>();
    for (let vertex = 0; vertex < color.count; vertex += 1) {
      swatches.add([0, 1, 2].map(c => color.getComponent(vertex, c).toFixed(4)).join(','));
    }
    expect(swatches.size).toBe(3);
  });
});
