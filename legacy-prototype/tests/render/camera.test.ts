import { describe, it, expect } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import type { World } from '../../src/content/types';
import {
  CAMERA_DISTANCE,
  CAMERA_FOOT_SCREEN,
  CAMERA_FOV,
  CAMERA_FOV_RUN,
  CAMERA_LOOKAHEAD,
  CAMERA_PITCH,
  CAMERA_PITCH_DEFAULT,
  CAPSULE_HEIGHT,
  RUN_ENTER_SPEED,
  RUN_SPEED,
  WALK_SPEED,
} from '../../src/render/constants';
import {
  createFollowCamera,
  fovFor,
  lookAheadFor,
  occludedEyeDistance,
} from '../../src/render/camera';
import { collidersFromWorld, containingHull } from '../../src/render/motion';
import worldJSON from '../../content/phase1/world.json?raw';

const world = collidersFromWorld(JSON.parse(worldJSON) as World);

function dirFrom(yaw: number, pitch: number): Vector3 {
  const cosP = Math.cos(pitch);
  return new Vector3(-Math.sin(yaw) * cosP, Math.sin(pitch), -Math.cos(yaw) * cosP).normalize();
}

describe('camera occlusion against building hulls', () => {
  it('pulls the eye in before it enters 家 when orbiting from the street', () => {
    const origin = new Vector3(-24, 1, -5);
    const dir = dirFrom(0, CAMERA_PITCH);
    const allowed = occludedEyeDistance(origin, dir, CAMERA_DISTANCE, world, null);
    expect(allowed).toBeLessThan(4);
    const eye = origin.clone().addScaledVector(dir, allowed);
    const hull = containingHull(-24, -11, world.hulls)!;
    const inside = eye.x > hull.minX && eye.x < hull.maxX && eye.z > hull.minZ && eye.z < hull.maxZ
      && eye.y < hull.maxY;
    expect(inside).toBe(false);
  });

  it('clamps below the roof when the player is inside a room', () => {
    const origin = new Vector3(-24, 1, -11);
    const hull = containingHull(-24, -11, world.hulls);
    expect(hull).not.toBeNull();
    const dir = dirFrom(Math.PI, CAMERA_PITCH);
    const allowed = occludedEyeDistance(origin, dir, CAMERA_DISTANCE, world, hull);
    expect(allowed).toBeLessThan(CAMERA_DISTANCE);
    const eye = origin.clone().addScaledVector(dir, allowed);
    expect(eye.y).toBeLessThan((hull?.maxY ?? 4) + 0.01);
  });
});

describe('default follow framing', () => {
  const empty = { boxes: [], hulls: [], boundary: { minX: -60, maxX: 60, minZ: -40, maxZ: 40 } };
  const width = 1280;
  const height = 720;

  function settled() {
    const follow = createFollowCamera();
    const player = new Vector3(0, 0, 0);
    for (let i = 0; i < 120; i += 1) {
      follow.update(1 / 60, player, 0, 0, 0, empty, width, height);
    }
    follow.camera.updateMatrixWorld(true);
    return follow;
  }

  function screenY(camera: PerspectiveCamera, point: Vector3): number {
    const projected = point.clone().project(camera);
    return (1 - projected.y) / 2;
  }

  it('keeps the player feet near the ART 64% line with a 16-26% body', () => {
    const follow = settled();
    const foot = screenY(follow.camera, new Vector3(0, 0, 0));
    const head = screenY(follow.camera, new Vector3(0, CAPSULE_HEIGHT, 0));
    expect(foot).toBeGreaterThan(CAMERA_FOOT_SCREEN - 0.03);
    expect(foot).toBeLessThan(CAMERA_FOOT_SCREEN + 0.03);
    expect(foot - head).toBeGreaterThan(0.15);
    expect(foot - head).toBeLessThan(0.26);
  });

  it('shows sky above the horizon at the default pitch', () => {
    const follow = settled();
    const top = new Vector3(0, 0.999, 0.5).unproject(follow.camera).sub(follow.camera.position).normalize();
    expect(top.y).toBeGreaterThan(0);
    expect(follow.camera.position.y).toBeLessThan(5);
    expect(follow.pitch).toBeCloseTo(CAMERA_PITCH_DEFAULT, 3);
  });
});

describe('camera comfort while moving', () => {
  it('leads the aim by 0.6 m at walking speed and not at all while standing', () => {
    expect(lookAheadFor(0)).toBe(0);
    expect(lookAheadFor(WALK_SPEED)).toBeCloseTo(CAMERA_LOOKAHEAD, 5);
    expect(lookAheadFor(RUN_SPEED)).toBeCloseTo(CAMERA_LOOKAHEAD, 5);
    expect(lookAheadFor(WALK_SPEED / 2)).toBeCloseTo(CAMERA_LOOKAHEAD / 2, 5);
  });

  it('widens to 48 degrees only once running', () => {
    expect(fovFor(0)).toBe(CAMERA_FOV);
    expect(fovFor(WALK_SPEED)).toBe(CAMERA_FOV);
    expect(fovFor(RUN_SPEED)).toBe(CAMERA_FOV_RUN);
    expect(fovFor(RUN_ENTER_SPEED + 0.2)).toBeGreaterThan(CAMERA_FOV);
    expect(fovFor(RUN_ENTER_SPEED + 0.2)).toBeLessThan(CAMERA_FOV_RUN);
  });

  it('smooths the lead and the field of view instead of snapping', () => {
    const follow = createFollowCamera();
    const player = new Vector3(0, 0, 0);
    follow.update(1 / 60, player, 0, 0, 0, world, 1280, 720, RUN_SPEED);
    expect(follow.lookAhead).toBeGreaterThan(0);
    expect(follow.lookAhead).toBeLessThan(CAMERA_LOOKAHEAD);
    expect(follow.camera.fov).toBeGreaterThan(CAMERA_FOV);
    expect(follow.camera.fov).toBeLessThan(CAMERA_FOV_RUN);

    for (let step = 0; step < 240; step += 1) {
      follow.update(1 / 60, player, 0, 0, 0, world, 1280, 720, RUN_SPEED);
    }
    expect(follow.lookAhead).toBeCloseTo(CAMERA_LOOKAHEAD, 2);
    expect(follow.camera.fov).toBeCloseTo(CAMERA_FOV_RUN, 2);

    for (let step = 0; step < 240; step += 1) {
      follow.update(1 / 60, player, 0, 0, 0, world, 1280, 720, 0);
    }
    expect(follow.lookAhead).toBeCloseTo(0, 2);
    expect(follow.camera.fov).toBeCloseTo(CAMERA_FOV, 2);
  });

  it('leads along the travel heading, not the orbit heading', () => {
    const follow = createFollowCamera();
    const player = new Vector3(0, 0, 0);
    for (let step = 0; step < 240; step += 1) {
      follow.update(1 / 60, player, Math.PI / 2, 0, 0, world, 1280, 720, WALK_SPEED);
    }
    expect(follow.lookAhead).toBeCloseTo(CAMERA_LOOKAHEAD, 2);
    expect(follow.camera.position.x).toBeLessThan(0);
  });
});
