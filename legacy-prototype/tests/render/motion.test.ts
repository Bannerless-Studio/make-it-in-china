import { describe, it, expect } from 'vitest';
import { Vector2, Vector3 } from 'three';
import type { World } from '../../src/content/types';
import {
  CAPSULE_RADIUS,
  SIM_DT,
  WALK_SPEED,
} from '../../src/render/constants';
import {
  clampBoundary,
  collidersFromWorld,
  containingHull,
  isWalkable,
  moveCapsule,
  stepMotion,
  wallBoxesForRoom,
  type CollisionWorld,
  type MotionState,
} from '../../src/render/motion';
import worldJSON from '../../content/phase1/world.json?raw';

const phaseWorld = JSON.parse(worldJSON) as World;

function drive(
  x: number,
  z: number,
  worldX: number,
  worldZ: number,
  seconds: number,
  world: CollisionWorld,
  run = false,
): Vector3 {
  const position = new Vector3(x, 0, z);
  const cameraYaw = Math.atan2(worldX, worldZ);
  const motion: MotionState = { velocity: new Vector2(), yaw: cameraYaw };
  const move = new Vector2(0, 1);
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps; i += 1) {
    stepMotion(position, motion, move, run, cameraYaw, SIM_DT, world, false);
  }
  return position;
}

describe('room wall expansion', () => {
  it('keeps a door-width gap and solid jambs on the door side', () => {
    const walls = wallBoxesForRoom(-24, -11, 8, 8, 'south');
    const atDoor = walls.some(box => (
      -24 > box.minX - 0.05 && -24 < box.maxX + 0.05
      && -7 > box.minZ - 0.05 && -7 < box.maxZ + 0.05
    ));
    const atWestJamb = walls.some(box => (
      -26.6 > box.minX && -26.6 < box.maxX
      && -7 > box.minZ - 0.2 && -7 < box.maxZ + 0.2
    ));
    const atNorth = walls.some(box => (
      -24 > box.minX && -24 < box.maxX
      && -15 > box.minZ - 0.2 && -15 < box.maxZ + 0.2
    ));
    expect(atDoor).toBe(false);
    expect(atWestJamb).toBe(true);
    expect(atNorth).toBe(true);
  });
});

describe('phase 1 district collision', () => {
  const world = collidersFromWorld(phaseWorld);

  it('builds wall boxes from every enclosed footprint plus authored colliders', () => {
    expect(world.boxes.length).toBeGreaterThan(20);
    expect(world.hulls.length).toBe(8);
    expect(world.boundary).toEqual({ minX: -30, maxX: 30, minZ: -20, maxZ: 20 });
  });

  it('stops a west-of-door approach at the 家 south wall instead of entering', () => {
    const after = drive(-25.4, -5, 0, -1, 3, world);
    expect(after.z).toBeGreaterThan(-7.2);
    expect(after.z).toBeLessThan(-5.5);
    expect(after.x).toBeCloseTo(-25.4, 0);
  });

  it('lets the player enter 家 through the doorway and then stops at the far wall', () => {
    const after = drive(-24, -5, 0, -1, 8, world);
    expect(after.z).toBeLessThan(-7.5);
    expect(after.z).toBeGreaterThan(-15.2 + CAPSULE_RADIUS);
  });

  it('blocks the closed gate and fruit counter boxes', () => {
    const gate = drive(27, 0, 1, 0, 4, world);
    expect(gate.x).toBeLessThan(29);
    const fruit = drive(8, -6.5, 0, -1, 3, world);
    expect(fruit.z).toBeGreaterThan(-9.5);
  });

  it('clamps the capsule inside the district boundary', () => {
    const position = new Vector3(0, 0, -19.5);
    moveCapsule(position, new Vector2(0, -4), CAPSULE_RADIUS, world);
    const clamped = clampBoundary(position.x, position.z, CAPSULE_RADIUS, world.boundary);
    expect(position.z).toBe(clamped.z);
    expect(position.z).toBeGreaterThan(world.boundary.minZ);
  });

  it('treats street cells as walkable and wall interiors as not', () => {
    expect(isWalkable(-24, 0, CAPSULE_RADIUS, world)).toBe(true);
    expect(isWalkable(-26.6, -7, CAPSULE_RADIUS, world)).toBe(false);
    expect(containingHull(-24, -11, world.hulls)?.id).toBe('rented_room');
    expect(containingHull(-24, 0, world.hulls)).toBeNull();
  });

  it('does not tunnel a thin wall at run speed over a long tick', () => {
    const after = drive(-27, -5, 0, -1, 2, world, true);
    expect(after.z).toBeGreaterThan(-8);
    expect(WALK_SPEED).toBeGreaterThan(1);
  });
});

type Approach = {
  id: string;
  start: Vector3;
  inward: Vector2;
  plane: number;
  axis: 'x' | 'z';
  sign: number;
};

function approaches(offset = 0): Approach[] {
  return phaseWorld.locations.flatMap(location => {
    const footprint = location.footprint;
    const door = location.door;
    if (!footprint || !door) return [];
    const [cx, cz] = footprint.center;
    const [sx, sz] = footprint.size;
    const outward = new Vector2(door.position[0] - cx, door.position[2] - cz);
    const axis: 'x' | 'z' = Math.abs(outward.x) > Math.abs(outward.y) ? 'x' : 'z';
    const sign = Math.sign(axis === 'x' ? outward.x : outward.y);
    const plane = (axis === 'x' ? cx : cz) + sign * (axis === 'x' ? sx : sz) / 2;
    const inward = new Vector2(axis === 'x' ? -sign : 0, axis === 'z' ? -sign : 0);
    const start = axis === 'x'
      ? new Vector3(plane + sign * 1.8, 0, cz + offset)
      : new Vector3(cx + offset, 0, plane + sign * 1.8);
    return [{ id: location.id, start, inward, plane, axis, sign }];
  });
}

function walk(from: Vector3, inward: Vector2, world: CollisionWorld, seconds = 4): Vector3 {
  const position = from.clone();
  const yaw = Math.atan2(inward.x, inward.y);
  const motion: MotionState = { velocity: new Vector2(), yaw };
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps; i += 1) {
    stepMotion(position, motion, new Vector2(0, 1), false, yaw, SIM_DT, world, false);
  }
  return position;
}

describe('every door admits the player', () => {
  const world = collidersFromWorld(phaseWorld);

  it('sweeps a capsule through each door opening in world.json', () => {
    const blocked: string[] = [];
    for (const door of approaches()) {
      if (door.id === 'phase2_gate') continue;
      const after = walk(door.start, door.inward, world);
      const reached = door.axis === 'x' ? after.x : after.z;
      const crossed = door.sign > 0 ? reached < door.plane - 0.3 : reached > door.plane + 0.3;
      if (!crossed) blocked.push(`${door.id} stopped at ${reached.toFixed(2)} (door plane ${door.plane})`);
    }
    expect(blocked).toEqual([]);
  });

  it('keeps the phase 2 gate closed until it opens', () => {
    const gate = approaches().find(door => door.id === 'phase2_gate')!;
    const after = walk(gate.start, gate.inward, world);
    expect(after.x).toBeLessThan(28.7 - CAPSULE_RADIUS);
  });

  it('blocks the wall beside each door', () => {
    const open = new Set(['fruit_stall', 'bus_stop', 'phase2_gate']);
    const leaks: string[] = [];
    for (const door of approaches(3)) {
      if (open.has(door.id)) continue;
      const after = walk(door.start, door.inward, world);
      const reached = door.axis === 'x' ? after.x : after.z;
      const crossed = door.sign > 0 ? reached < door.plane : reached > door.plane;
      if (crossed) leaks.push(`${door.id} passed through the wall to ${reached.toFixed(2)}`);
    }
    expect(leaks).toEqual([]);
  });
});
