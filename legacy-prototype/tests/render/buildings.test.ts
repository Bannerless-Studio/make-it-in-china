import { describe, it, expect } from 'vitest';
import { Box3, Group, Mesh, Triangle, Vector3 } from 'three';
import type { World } from '../../src/content/types';
import { BUILDINGS } from '../../src/render/buildings';
import { GeomBatch } from '../../src/render/geom';
import { CAPSULE_HEIGHT, DOOR_WIDTH } from '../../src/render/constants';
import worldJSON from '../../content/phase1/world.json?raw';

const phaseWorld = JSON.parse(worldJSON) as World;

function district(): Group {
  const group = new Group();
  const shell = new GeomBatch();
  for (const building of BUILDINGS) building.build(group, building.cx, building.cz, shell);
  shell.flush(group, { doubleSide: true });
  return group;
}

function corridor(id: string): Box3 | null {
  const location = phaseWorld.locations.find(item => item.id === id);
  if (!location?.footprint || !location.door) return null;
  const [cx, cz] = location.footprint.center;
  const [dx, , dz] = location.door.position;
  const alongX = Math.abs(dx - cx) > Math.abs(dz - cz);
  const half = DOOR_WIDTH / 2 - 0.1;
  const reach = 0.7;
  return new Box3(
    new Vector3(
      alongX ? dx - reach : dx - half,
      0.06,
      alongX ? dz - half : dz - reach,
    ),
    new Vector3(
      alongX ? dx + reach : dx + half,
      CAPSULE_HEIGHT + 0.2,
      alongX ? dz + half : dz + reach,
    ),
  );
}

describe('door corridors stay clear of decoration', () => {
  const group = district();

  it('leaves a walkable 2.4 m opening at every building door', () => {
    const blocked: string[] = [];
    for (const building of BUILDINGS) {
      const box = corridor(
        BUILDINGS.find(item => item.id === building.id)!.location,
      );
      if (!box) continue;
      const a = new Vector3();
      const b = new Vector3();
      const c = new Vector3();
      const triangle = new Triangle();
      let hits = 0;
      group.traverse(object => {
        if (!(object instanceof Mesh) || object.name.endsWith('-outline')) return;
        const position = object.geometry.getAttribute('position');
        const index = object.geometry.getIndex();
        const count = index ? index.count : position.count;
        for (let i = 0; i < count; i += 3) {
          const ia = index ? index.getX(i) : i;
          const ib = index ? index.getX(i + 1) : i + 1;
          const ic = index ? index.getX(i + 2) : i + 2;
          a.fromBufferAttribute(position, ia);
          b.fromBufferAttribute(position, ib);
          c.fromBufferAttribute(position, ic);
          triangle.set(a, b, c);
          if (box.intersectsTriangle(triangle)) hits += 1;
        }
      });
      if (hits > 0) blocked.push(`${building.id} has ${hits} triangles in its door corridor`);
    }
    expect(blocked).toEqual([]);
  });
});
