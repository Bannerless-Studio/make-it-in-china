import { Vector2, Vector3 } from 'three';
import type { DoorSide, World, WorldCollider } from '../content/types';
import {
  ACCEL,
  BRAKE,
  CAPSULE_RADIUS,
  COLLISION_ITERATIONS,
  DOOR_WIDTH,
  ROOF_LIP,
  RUN_SPEED,
  TURN_RATE,
  WALK_SPEED,
  WALL_HEIGHT,
  WALL_SKIN,
} from './constants';

export interface Aabb {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface Hull extends Aabb {
  id: string;
}

export interface Boundary {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CollisionWorld {
  boxes: Aabb[];
  hulls: Hull[];
  boundary: Boundary;
}

const _delta = new Vector2();
const _next = new Vector2();
const _slide = new Vector2();
const OPEN_IDS = new Set(['fruit_stall', 'bus_stop', 'phase2_gate']);

export function boxFromCenter(
  cx: number,
  cy: number,
  cz: number,
  hx: number,
  hy: number,
  hz: number,
): Aabb {
  return {
    minX: cx - hx,
    maxX: cx + hx,
    minY: cy - hy,
    maxY: cy + hy,
    minZ: cz - hz,
    maxZ: cz + hz,
  };
}

export function hullFromFootprint(
  id: string,
  cx: number,
  cz: number,
  sx: number,
  sz: number,
  height = WALL_HEIGHT + ROOF_LIP,
): Hull {
  return { id, ...boxFromCenter(cx, height / 2, cz, sx / 2, height / 2, sz / 2) };
}

function doorSideFromYaw(yaw?: number): DoorSide {
  if (yaw === undefined) return 'south';
  const tau = Math.PI * 2;
  const wrapped = ((yaw % tau) + tau) % tau;
  if (wrapped > Math.PI * 0.25 && wrapped <= Math.PI * 0.75) return 'east';
  if (wrapped > Math.PI * 0.75 && wrapped <= Math.PI * 1.25) return 'north';
  if (wrapped > Math.PI * 1.25 && wrapped <= Math.PI * 1.75) return 'west';
  return 'south';
}

export function wallBoxesForRoom(
  cx: number,
  cz: number,
  sx: number,
  sz: number,
  door: DoorSide,
  doorWidth = DOOR_WIDTH,
  thickness = 0.3,
  height = WALL_HEIGHT,
): Aabb[] {
  const hx = sx / 2;
  const hz = sz / 2;
  const hy = height / 2;
  const northZ = cz - hz;
  const southZ = cz + hz;
  const westX = cx - hx;
  const eastX = cx + hx;
  const jamb = (door === 'north' || door === 'south' ? sx : sz) / 2 - doorWidth / 2;
  const boxes: Aabb[] = [];
  const segment = (x: number, z: number, w: number, d: number) => {
    boxes.push(boxFromCenter(x, hy, z, w / 2, hy, d / 2));
  };
  if (door !== 'north') segment(cx, northZ, sx, thickness);
  else {
    segment(cx - (doorWidth / 2 + jamb / 2), northZ, jamb, thickness);
    segment(cx + (doorWidth / 2 + jamb / 2), northZ, jamb, thickness);
  }
  if (door !== 'south') segment(cx, southZ, sx, thickness);
  else {
    segment(cx - (doorWidth / 2 + jamb / 2), southZ, jamb, thickness);
    segment(cx + (doorWidth / 2 + jamb / 2), southZ, jamb, thickness);
  }
  if (door !== 'west') segment(westX, cz, thickness, sz);
  else {
    segment(westX, cz - (doorWidth / 2 + jamb / 2), thickness, jamb);
    segment(westX, cz + (doorWidth / 2 + jamb / 2), thickness, jamb);
  }
  if (door !== 'east') segment(eastX, cz, thickness, sz);
  else {
    segment(eastX, cz - (doorWidth / 2 + jamb / 2), thickness, jamb);
    segment(eastX, cz + (doorWidth / 2 + jamb / 2), thickness, jamb);
  }
  return boxes;
}

function expandRoomWalls(collider: WorldCollider): Aabb[] {
  const center = collider.center ?? [0, 0, 0];
  const size = collider.size ?? [8, 8];
  return wallBoxesForRoom(
    center[0],
    center[2],
    size[0],
    size[1],
    collider.doorSide ?? 'south',
    collider.doorWidth ?? DOOR_WIDTH,
    collider.thickness ?? 0.3,
    collider.height ?? WALL_HEIGHT,
  );
}

function keyOf(x: number, z: number): string {
  return `${x.toFixed(2)},${z.toFixed(2)}`;
}

export function collidersFromWorld(world: World): CollisionWorld {
  const boxes: Aabb[] = [];
  const hulls: Hull[] = [];
  let boundary: Boundary = world.bounds
    ? {
      minX: world.bounds.min[0],
      maxX: world.bounds.max[0],
      minZ: world.bounds.min[2],
      maxZ: world.bounds.max[2],
    }
    : { minX: -30, maxX: 30, minZ: -20, maxZ: 20 };
  const roomCenters = new Set<string>();

  for (const collider of world.colliders ?? []) {
    if (collider.shape === 'boundary' && collider.min && collider.max) {
      boundary = {
        minX: collider.min[0],
        maxX: collider.max[0],
        minZ: collider.min[1],
        maxZ: collider.max[1],
      };
      continue;
    }
    if (collider.shape === 'roomWalls') {
      boxes.push(...expandRoomWalls(collider));
      const center = collider.center ?? [0, 0, 0];
      const size = collider.size ?? [8, 8];
      const location = world.locations.find(item => item.footprint
        && Math.abs(item.footprint.center[0] - center[0]) < 0.05
        && Math.abs(item.footprint.center[1] - center[2]) < 0.05);
      hulls.push(hullFromFootprint(
        location?.id ?? collider.id,
        center[0],
        center[2],
        size[0],
        size[1],
        (collider.height ?? WALL_HEIGHT) + ROOF_LIP,
      ));
      roomCenters.add(keyOf(center[0], center[2]));
      continue;
    }
    if (collider.shape === 'box' && collider.center && collider.half) {
      boxes.push(boxFromCenter(
        collider.center[0],
        collider.center[1],
        collider.center[2],
        collider.half[0],
        collider.half[1],
        collider.half[2],
      ));
    }
  }

  for (const location of world.locations) {
    const footprint = location.footprint;
    if (!footprint) continue;
    const [cx, cz] = footprint.center;
    const [sx, sz] = footprint.size;
    if (!hulls.some(hull => Math.abs((hull.minX + hull.maxX) / 2 - cx) < 0.05
      && Math.abs((hull.minZ + hull.maxZ) / 2 - cz) < 0.05)) {
      hulls.push(hullFromFootprint(location.id, cx, cz, sx, sz));
    }
    if (OPEN_IDS.has(location.id) || roomCenters.has(keyOf(cx, cz))) continue;
    boxes.push(...wallBoxesForRoom(
      cx,
      cz,
      sx,
      sz,
      location.door ? doorSideFromYaw(location.door.yaw) : 'south',
    ));
    roomCenters.add(keyOf(cx, cz));
  }

  return { boxes, hulls, boundary };
}

export function overlapExpanded(x: number, z: number, radius: number, box: Aabb): boolean {
  return x > box.minX - radius
    && x < box.maxX + radius
    && z > box.minZ - radius
    && z < box.maxZ + radius;
}

function resolveBox(x: number, z: number, radius: number, box: Aabb): { x: number; z: number; nx: number; nz: number } | null {
  const left = x - (box.minX - radius);
  const right = (box.maxX + radius) - x;
  const north = z - (box.minZ - radius);
  const south = (box.maxZ + radius) - z;
  if (left <= 0 || right <= 0 || north <= 0 || south <= 0) return null;
  const min = Math.min(left, right, north, south);
  if (min === left) return { x: box.minX - radius - WALL_SKIN, z, nx: -1, nz: 0 };
  if (min === right) return { x: box.maxX + radius + WALL_SKIN, z, nx: 1, nz: 0 };
  if (min === north) return { x, z: box.minZ - radius - WALL_SKIN, nx: 0, nz: -1 };
  return { x, z: box.maxZ + radius + WALL_SKIN, nx: 0, nz: 1 };
}

function sweepBox(
  ox: number,
  oz: number,
  dx: number,
  dz: number,
  radius: number,
  box: Aabb,
): { t: number; nx: number; nz: number } | null {
  if (overlapExpanded(ox, oz, radius, box)) {
    const resolved = resolveBox(ox, oz, radius, box);
    if (!resolved) return null;
    if (dx * resolved.nx + dz * resolved.nz > 1e-8) return null;
    return { t: 0, nx: resolved.nx, nz: resolved.nz };
  }
  const minX = box.minX - radius;
  const maxX = box.maxX + radius;
  const minZ = box.minZ - radius;
  const maxZ = box.maxZ + radius;
  let tEnter = 0;
  let tExit = 1;
  let nx = 0;
  let nz = 0;
  if (Math.abs(dx) < 1e-12) {
    if (ox <= minX || ox >= maxX) return null;
  } else {
    const t1 = (minX - ox) / dx;
    const t2 = (maxX - ox) / dx;
    const tNear = Math.min(t1, t2);
    const tFar = Math.max(t1, t2);
    if (tNear > tEnter) {
      tEnter = tNear;
      nx = t1 < t2 ? -1 : 1;
      nz = 0;
    }
    tExit = Math.min(tExit, tFar);
    if (tEnter > tExit) return null;
  }
  if (Math.abs(dz) < 1e-12) {
    if (oz <= minZ || oz >= maxZ) return null;
  } else {
    const t1 = (minZ - oz) / dz;
    const t2 = (maxZ - oz) / dz;
    const tNear = Math.min(t1, t2);
    const tFar = Math.max(t1, t2);
    if (tNear > tEnter) {
      tEnter = tNear;
      nx = 0;
      nz = t1 < t2 ? -1 : 1;
    }
    tExit = Math.min(tExit, tFar);
    if (tEnter > tExit) return null;
  }
  if (tEnter < 0 || tEnter > 1) return null;
  return { t: tEnter, nx, nz };
}

function sweep(
  fromX: number,
  fromZ: number,
  dx: number,
  dz: number,
  radius: number,
  boxes: Aabb[],
): { t: number; nx: number; nz: number } | null {
  let best: { t: number; nx: number; nz: number } | null = null;
  for (const box of boxes) {
    const hit = sweepBox(fromX, fromZ, dx, dz, radius, box);
    if (!hit) continue;
    if (!best || hit.t < best.t) best = hit;
  }
  return best;
}

function pushOut(x: number, z: number, radius: number, boxes: Aabb[]): { x: number; z: number } {
  let px = x;
  let pz = z;
  for (let i = 0; i < COLLISION_ITERATIONS; i += 1) {
    let moved = false;
    for (const box of boxes) {
      if (!overlapExpanded(px, pz, radius, box)) continue;
      const resolved = resolveBox(px, pz, radius, box);
      if (!resolved) continue;
      px = resolved.x;
      pz = resolved.z;
      moved = true;
    }
    if (!moved) break;
  }
  return { x: px, z: pz };
}

export function clampBoundary(
  x: number,
  z: number,
  radius: number,
  boundary: Boundary,
): { x: number; z: number } {
  return {
    x: Math.min(boundary.maxX - radius, Math.max(boundary.minX + radius, x)),
    z: Math.min(boundary.maxZ - radius, Math.max(boundary.minZ + radius, z)),
  };
}

export function containingHull(x: number, z: number, hulls: Hull[]): Hull | null {
  for (const hull of hulls) {
    if (x > hull.minX && x < hull.maxX && z > hull.minZ && z < hull.maxZ) return hull;
  }
  return null;
}

export function isWalkable(x: number, z: number, radius: number, world: CollisionWorld): boolean {
  const clamped = clampBoundary(x, z, radius + WALL_SKIN, world.boundary);
  if (Math.abs(clamped.x - x) > 1e-4 || Math.abs(clamped.z - z) > 1e-4) return false;
  for (const box of world.boxes) {
    if (overlapExpanded(x, z, radius, box)) return false;
  }
  return true;
}

export function isStreetPose(x: number, z: number, radius: number, world: CollisionWorld): boolean {
  return isWalkable(x, z, radius, world) && !containingHull(x, z, world.hulls);
}

export function moveCapsule(
  position: Vector3,
  delta: Vector2,
  radius: number,
  world: CollisionWorld,
): Vector3 {
  const freed = pushOut(position.x, position.z, radius, world.boxes);
  position.x = freed.x;
  position.z = freed.z;
  _delta.copy(delta);
  for (let i = 0; i < COLLISION_ITERATIONS; i += 1) {
    if (_delta.lengthSq() < 1e-8) break;
    const hit = sweep(position.x, position.z, _delta.x, _delta.y, radius, world.boxes);
    if (!hit) {
      position.x += _delta.x;
      position.z += _delta.y;
      break;
    }
    position.x += _delta.x * hit.t;
    position.z += _delta.y * hit.t;
    const remaining = 1 - hit.t;
    if (remaining <= 0.001) break;
    _slide.set(-hit.nz, hit.nx);
    const along = _delta.dot(_slide);
    _delta.copy(_slide).multiplyScalar(along * remaining);
  }
  const unstuck = pushOut(position.x, position.z, radius, world.boxes);
  const clamped = clampBoundary(unstuck.x, unstuck.z, radius + WALL_SKIN, world.boundary);
  position.x = clamped.x;
  position.z = clamped.z;
  position.y = 0;
  return position;
}

export interface MotionState {
  velocity: Vector2;
  yaw: number;
}

function shortestYaw(from: number, to: number): number {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

export function stepMotion(
  position: Vector3,
  motion: MotionState,
  move: Vector2,
  run: boolean,
  cameraYaw: number,
  dt: number,
  world: CollisionWorld,
  locked: boolean,
): number {
  const speed = run ? RUN_SPEED : WALK_SPEED;
  _next.set(0, 0);
  if (!locked && move.lengthSq() > 0) {
    const sin = Math.sin(cameraYaw);
    const cos = Math.cos(cameraYaw);
    const ax = move.x;
    const az = move.y;
    _next.set(-ax * cos + az * sin, ax * sin + az * cos).multiplyScalar(speed);
  }
  const desired = _next;
  const deltaV = desired.clone().sub(motion.velocity);
  if (desired.lengthSq() < 1e-6) {
    const current = motion.velocity.length();
    const drop = BRAKE * dt;
    if (drop >= current) motion.velocity.set(0, 0);
    else motion.velocity.multiplyScalar((current - drop) / current);
  } else {
    const maxStep = ACCEL * dt;
    if (deltaV.length() <= maxStep) motion.velocity.copy(desired);
    else motion.velocity.addScaledVector(deltaV.normalize(), maxStep);
  }
  const travel = motion.velocity.clone().multiplyScalar(dt);
  moveCapsule(position, travel, CAPSULE_RADIUS, world);
  const moving = motion.velocity.length();
  if (moving > 0.04) {
    const backing = !locked && move.y < 0 && Math.abs(move.x) < 0.3;
    const facing = backing ? -1 : 1;
    const targetYaw = Math.atan2(facing * motion.velocity.x, facing * motion.velocity.y);
    const yawDelta = shortestYaw(motion.yaw, targetYaw);
    const maxYaw = TURN_RATE * dt;
    motion.yaw += Math.max(-maxYaw, Math.min(maxYaw, yawDelta));
  }
  return moving;
}

export function turnToward(yaw: number, targetYaw: number, dt: number): number {
  const delta = shortestYaw(yaw, targetYaw);
  const maxYaw = TURN_RATE * dt;
  return yaw + Math.max(-maxYaw, Math.min(maxYaw, delta));
}

export { CAPSULE_RADIUS };
