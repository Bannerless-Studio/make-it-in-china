import { describe, expect, it } from 'vitest';
import { Box3, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import {
  addGroundDecals,
  buildStreet,
  createSkyline,
  CROSSING_X,
  DOOR_FRONTS,
  DRAINS,
  fogTintedGrey,
  KERB_Z,
  MANHOLES,
  ROAD_HALF,
} from '../../src/render/street';
import { DAY_PALETTES } from '../../src/render/daylight';
import { BUILDINGS } from '../../src/render/buildings';

function meshes(root: Group): Mesh[] {
  const found: Mesh[] = [];
  root.traverse(object => {
    if (object instanceof Mesh) found.push(object);
  });
  return found;
}

function named(root: Group, name: string): Mesh | undefined {
  return meshes(root).find(mesh => mesh.name === name);
}

describe('street ground detail', () => {
  it('keeps every added ground marking inside three extra draws', () => {
    const group = new Group();
    buildStreet(group);
    const paint = named(group, 'road-paint');
    expect(paint).toBeDefined();
    const decals = addGroundDecals(group, [
      { x: 19.2, z: -3.55, w: 1.5, d: 0.55, yaw: 0.35 },
      { x: -12, z: -5, w: 1.9, d: 0.66 },
      { x: 4, z: 5, w: 1.05, d: 1.05, round: true },
    ]);
    expect(decals).not.toBeNull();
    const surfaceDraws = meshes(group).filter(mesh => (
      mesh.name === 'road-paint' || mesh.name === 'ground-decals'
    ));
    expect(surfaceDraws.length).toBeLessThanOrEqual(3);
  });

  it('paints a zebra crossing across the road at the noodle shop', () => {
    const group = new Group();
    buildStreet(group);
    const paint = named(group, 'road-paint');
    const noodle = BUILDINGS.find(building => building.id === 'noodle');
    expect(noodle?.cx).toBe(CROSSING_X);
    const bounds = new Box3().setFromObject(paint!);
    const size = bounds.getSize(new Vector3());
    expect(size.z).toBeGreaterThan(ROAD_HALF * 2 - 0.6);
    expect(bounds.min.x).toBeLessThan(CROSSING_X);
    expect(bounds.max.x).toBeGreaterThan(CROSSING_X);
  });

  it('carries ironwork and contact shadows in a single merged decal mesh', () => {
    const group = new Group();
    const decals = addGroundDecals(group, [{ x: 0, z: 0, w: 1, d: 1 }]);
    expect(decals).not.toBeNull();
    const color = decals!.geometry.getAttribute('color');
    expect(color.itemSize).toBe(4);
    expect(color.count).toBe(decals!.geometry.getAttribute('position').count);
    expect(decals!.material).toBeInstanceOf(MeshBasicMaterial);
    expect((decals!.material as MeshBasicMaterial).transparent).toBe(true);
    expect(DRAINS.length).toBeGreaterThanOrEqual(8);
    expect(MANHOLES.length).toBeGreaterThanOrEqual(3);
  });

  it('places a kerb ramp on the kerb in front of every street door', () => {
    const ramped = DOOR_FRONTS.filter(door => door.kerbZ !== null);
    expect(ramped.length).toBeGreaterThanOrEqual(6);
    for (const door of ramped) {
      expect(Math.abs(door.kerbZ!)).toBe(KERB_Z);
      const building = BUILDINGS.find(item => item.id === door.id);
      expect(building).toBeDefined();
      expect(Math.abs(building!.cx - door.x)).toBeLessThan(2.2);
    }
  });

  it('keeps the district ground shade merged with the decals rather than its own draw', () => {
    const group = new Group();
    buildStreet(group);
    addGroundDecals(group, []);
    expect(named(group, 'ground-shade')).toBeUndefined();
    expect(named(group, 'ground-decals')).toBeDefined();
  });
});

describe('skyline tinting', () => {
  it('draws two fog-tinted grey tones plus one lit-window layer', () => {
    const group = new Group();
    const skyline = createSkyline(group);
    const layers = meshes(group).filter(mesh => mesh.name.startsWith('skyline'));
    expect(layers.length).toBe(3);
    for (const layer of layers) expect(layer.castShadow).toBe(false);
    expect(skyline.near.material).toBeInstanceOf(MeshBasicMaterial);
    expect(skyline.far.material).toBeInstanceOf(MeshBasicMaterial);
  });

  it('desaturates the evening skyline instead of letting the sun saturate it', () => {
    const group = new Group();
    const skyline = createSkyline(group);
    skyline.setTone(DAY_PALETTES.evening.fog, DAY_PALETTES.evening.skylineLit);
    const evening = (skyline.near.material as MeshBasicMaterial).color.clone();
    const hsl = { h: 0, s: 0, l: 0 };
    evening.getHSL(hsl);
    expect(hsl.s).toBeLessThan(0.16);
    expect(skyline.windows.visible).toBe(true);

    skyline.setTone(DAY_PALETTES.midday.fog, DAY_PALETTES.midday.skylineLit);
    const midday = (skyline.near.material as MeshBasicMaterial).color.clone();
    expect(midday.getHex()).not.toBe(evening.getHex());
    expect(skyline.windows.visible).toBe(false);
  });

  it('keeps the two skyline tones distinct after tinting', () => {
    for (const phase of Object.values(DAY_PALETTES)) {
      const near = fogTintedGrey(0x8b949c, phase.fog);
      const far = fogTintedGrey(0xa3acb3, phase.fog);
      expect(near.getHex()).not.toBe(far.getHex());
    }
  });
});
