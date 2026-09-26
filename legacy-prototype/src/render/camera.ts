import { PerspectiveCamera, Vector3 } from 'three';
import type { Aabb, CollisionWorld, Hull } from './motion';
import {
  CAMERA_DISTANCE,
  CAMERA_FAR,
  CAMERA_FOOT_SCREEN,
  CAMERA_FOV,
  CAMERA_FOV_RUN,
  CAMERA_LOOKAHEAD,
  CAMERA_NEAR,
  CAMERA_PITCH_DEFAULT,
  CAMERA_PITCH_INTERIOR,
  CAMERA_PITCH_MAX,
  CAMERA_PITCH_MIN,
  CAMERA_TARGET_Y,
  LAMBDA_AIM,
  LAMBDA_FOV,
  LAMBDA_LOOKAHEAD,
  LAMBDA_OCCLUDE_EXTEND,
  LAMBDA_POSITION,
  LAMBDA_YAW,
  OCCLUDE_MAX,
  OCCLUDE_MIN,
  OCCLUDE_RADIUS,
  OCCLUDE_SKIN,
  RECENTER_IDLE,
  RUN_ENTER_SPEED,
  RUN_SPEED,
  WALK_SPEED,
  expSmooth,
} from './constants';

export interface FollowCamera {
  camera: PerspectiveCamera;
  yaw: number;
  readonly pitch: number;
  readonly lookAhead: number;
  snap(): void;
  update(
    dt: number,
    player: Vector3,
    travelYaw: number,
    orbitYawDelta: number,
    orbitPitchDelta: number,
    world: CollisionWorld,
    width: number,
    height: number,
    speed?: number,
  ): void;
}

export function lookAheadFor(speed: number): number {
  return CAMERA_LOOKAHEAD * Math.min(1, Math.max(0, speed / WALK_SPEED));
}

export function fovFor(speed: number): number {
  const t = Math.min(1, Math.max(0, (speed - RUN_ENTER_SPEED) / (RUN_SPEED - RUN_ENTER_SPEED)));
  return CAMERA_FOV + (CAMERA_FOV_RUN - CAMERA_FOV) * t;
}

const _min = new Vector3();
const _max = new Vector3();

function sphereHitsBox(
  origin: Vector3,
  dir: Vector3,
  maxDist: number,
  radius: number,
  box: Aabb,
): number | null {
  _min.set(box.minX - radius, box.minY - radius, box.minZ - radius);
  _max.set(box.maxX + radius, box.maxY + radius, box.maxZ + radius);
  let tmin = 0;
  let tmax = maxDist;
  for (const axis of ['x', 'y', 'z'] as const) {
    const originA = origin[axis];
    const dirA = dir[axis];
    const minA = _min[axis];
    const maxA = _max[axis];
    if (Math.abs(dirA) < 1e-8) {
      if (originA < minA || originA > maxA) return null;
      continue;
    }
    let t1 = (minA - originA) / dirA;
    let t2 = (maxA - originA) / dirA;
    if (t1 > t2) {
      const swap = t1;
      t1 = t2;
      t2 = swap;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  if (tmax < 0) return null;
  if (tmin < 0) return 0;
  return tmin <= maxDist ? tmin : null;
}

function wrapYaw(yaw: number): number {
  let value = yaw;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

function shortest(from: number, to: number): number {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

const _foot = new Vector3();

export function footOffsetY(
  camera: PerspectiveCamera,
  foot: Vector3,
  height: number,
): number {
  const tan = Math.tan((camera.fov * Math.PI) / 360);
  const local = camera.worldToLocal(_foot.copy(foot));
  const depth = -local.z;
  const slope = depth > 0.05 ? local.y / depth : 0;
  const wanted = 1 - 2 * CAMERA_FOOT_SCREEN;
  return (height * (wanted * tan - slope)) / (2 * tan);
}

function roofOf(hull: Hull): Aabb {
  return {
    minX: hull.minX,
    maxX: hull.maxX,
    minY: hull.maxY - 0.5,
    maxY: hull.maxY + 0.15,
    minZ: hull.minZ,
    maxZ: hull.maxZ,
  };
}

export function occludedEyeDistance(
  origin: Vector3,
  dir: Vector3,
  maxDist: number,
  world: CollisionWorld,
  skipHull: Hull | null,
): number {
  let blocked = maxDist;
  const consider = (box: Aabb) => {
    const hit = sphereHitsBox(origin, dir, blocked, OCCLUDE_RADIUS, box);
    if (hit === null) return;
    blocked = Math.min(blocked, Math.max(0, hit - OCCLUDE_SKIN));
  };
  for (const box of world.boxes) consider(box);
  for (const hull of world.hulls) {
    if (skipHull && hull.id === skipHull.id) continue;
    consider(hull);
  }
  if (skipHull) consider(roofOf(skipHull));
  return Math.min(OCCLUDE_MAX, Math.max(OCCLUDE_MIN, blocked));
}

export function createFollowCamera(): FollowCamera {
  const camera = new PerspectiveCamera(CAMERA_FOV, 1, CAMERA_NEAR, CAMERA_FAR);
  const currentPos = new Vector3();
  const currentTarget = new Vector3();
  const desiredEye = new Vector3();
  const look = new Vector3();
  const toEye = new Vector3();
  let yaw = 0;
  let pitch = CAMERA_PITCH_DEFAULT;
  let distance = CAMERA_DISTANCE;
  let idle = 0;
  let initialized = false;
  let lead = 0;
  let fov = CAMERA_FOV;

  return {
    camera,
    get yaw() { return yaw; },
    set yaw(value: number) { yaw = value; },
    get pitch() { return pitch; },
    get lookAhead() { return lead; },
    snap() { initialized = false; },
    update(dt, player, travelYaw, orbitYawDelta, orbitPitchDelta, world, width, height, speed = 0) {
      if (orbitYawDelta !== 0 || orbitPitchDelta !== 0) idle = 0;
      else idle += dt;
      yaw = wrapYaw(yaw + orbitYawDelta);
      pitch = Math.min(CAMERA_PITCH_MAX, Math.max(CAMERA_PITCH_MIN, pitch + orbitPitchDelta));
      if (idle > RECENTER_IDLE) {
        yaw += shortest(yaw, travelYaw) * expSmooth(LAMBDA_YAW, dt);
        pitch += (CAMERA_PITCH_DEFAULT - pitch) * expSmooth(LAMBDA_YAW, dt);
      }

      lead += (lookAheadFor(speed) - lead) * expSmooth(LAMBDA_LOOKAHEAD, dt);
      fov += (fovFor(speed) - fov) * expSmooth(LAMBDA_FOV, dt);
      camera.fov = fov;
      const target = look.set(
        player.x + Math.sin(travelYaw) * lead,
        player.y + CAMERA_TARGET_Y,
        player.z + Math.cos(travelYaw) * lead,
      );
      const inside = world.hulls.find(hull => (
        player.x > hull.minX && player.x < hull.maxX && player.z > hull.minZ && player.z < hull.maxZ
      )) ?? null;
      const usePitch = inside ? Math.max(pitch, CAMERA_PITCH_INTERIOR) : pitch;
      const cosP = Math.cos(usePitch);
      desiredEye.set(
        target.x - Math.sin(yaw) * cosP * CAMERA_DISTANCE,
        target.y + Math.sin(usePitch) * CAMERA_DISTANCE,
        target.z - Math.cos(yaw) * cosP * CAMERA_DISTANCE,
      );
      toEye.copy(desiredEye).sub(target);
      const desiredDist = toEye.length();
      const dir = toEye.normalize();
      const allowed = occludedEyeDistance(target, dir, desiredDist, world, inside);
      if (allowed < distance) distance = allowed;
      else distance += (allowed - distance) * expSmooth(LAMBDA_OCCLUDE_EXTEND, dt);

      const eye = desiredEye.copy(target).addScaledVector(dir, distance);
      if (!initialized) {
        currentPos.copy(eye);
        currentTarget.copy(target);
        initialized = true;
      } else {
        currentPos.lerp(eye, expSmooth(LAMBDA_POSITION, dt));
        currentTarget.lerp(target, expSmooth(LAMBDA_AIM, dt));
      }
      toEye.copy(currentPos).sub(target);
      const smoothed = toEye.length();
      if (smoothed > 1e-4) {
        const pulled = occludedEyeDistance(target, toEye.normalize(), smoothed, world, inside);
        currentPos.copy(target).addScaledVector(toEye, pulled);
      }
      camera.up.set(0, 1, 0);
      camera.position.copy(currentPos);
      camera.lookAt(currentTarget);
      camera.aspect = width / Math.max(1, height);
      camera.updateMatrixWorld(true);
      const fullH = Math.max(1, height);
      camera.setViewOffset(width, fullH, 0, footOffsetY(camera, player, fullH), width, fullH);
      camera.updateProjectionMatrix();
    },
  };
}
