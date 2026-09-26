import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import {
  CYCLE_ROUTE,
  PEDESTRIAN_ROUTES,
  poseAt,
  routeLength,
  spawnCrowd,
  yieldOffset,
} from '../../src/render/crowd';
import {
  CROWD_ANIM_CUTOFF,
  CROWD_SPEED,
  CROWD_YIELD_RADIUS,
  LOD1_DISTANCE,
} from '../../src/render/constants';
import { KERB_Z, ROAD_HALF } from '../../src/render/street';

describe('background crowd routes', () => {
  it('runs three to four pedestrian loops at the TDD npc walking speed', () => {
    expect(PEDESTRIAN_ROUTES.length).toBeGreaterThanOrEqual(3);
    expect(PEDESTRIAN_ROUTES.length).toBeLessThanOrEqual(4);
    for (const route of PEDESTRIAN_ROUTES) {
      expect(route.speed).toBe(CROWD_SPEED);
      expect(routeLength(route.points)).toBeGreaterThan(10);
    }
  });

  it('keeps pedestrian lanes on the pavement except where they use the crossing', () => {
    for (const route of PEDESTRIAN_ROUTES) {
      for (const [x, z] of route.points) {
        expect(Math.abs(x)).toBeLessThan(29);
        if (Math.abs(z) < KERB_Z) {
          expect(Math.abs(x + 8)).toBeLessThan(2.2);
        } else {
          expect(Math.abs(z)).toBeGreaterThan(ROAD_HALF);
          expect(Math.abs(z)).toBeLessThan(8);
        }
      }
    }
  });

  it('keeps the cyclist loop on the road surface', () => {
    for (const [, z] of CYCLE_ROUTE.points) {
      expect(Math.abs(z)).toBeLessThan(ROAD_HALF);
    }
    expect(CYCLE_ROUTE.speed).toBeGreaterThan(CROWD_SPEED);
  });

  it('walks the loop and wraps back to the start', () => {
    const route = PEDESTRIAN_ROUTES[0];
    const total = routeLength(route.points);
    const start = poseAt(route.points, 0);
    const wrapped = poseAt(route.points, total);
    expect(wrapped.x).toBeCloseTo(start.x, 4);
    expect(wrapped.z).toBeCloseTo(start.z, 4);
    const stepped = poseAt(route.points, CROWD_SPEED);
    expect(Math.hypot(stepped.x - start.x, stepped.z - start.z)).toBeCloseTo(CROWD_SPEED, 3);
  });

  it('yields sideways only when the player is close, and away from them', () => {
    const pose = poseAt(PEDESTRIAN_ROUTES[0].points, 4);
    expect(yieldOffset(pose, pose.x + 10, pose.z, 0)).toBe(0);
    expect(yieldOffset(pose, pose.x, pose.z + CROWD_YIELD_RADIUS, 0)).toBe(0);
    const pushed = yieldOffset(pose, pose.x, pose.z + 0.4, 0);
    expect(Math.abs(pushed)).toBeGreaterThan(0);
    const mirrored = yieldOffset(pose, pose.x, pose.z - 0.4, 0);
    expect(Math.sign(pushed)).toBe(-Math.sign(mirrored));
  });

  it('moves every walker without entering the npc talk set', () => {
    const crowd = spawnCrowd(true, new Map());
    expect(crowd.walkers).toBe(PEDESTRIAN_ROUTES.length + 1);
    const player = new Vector3(0, 0, 40);
    const eye = new Vector3(0, 6, 40);
    const before = crowd.group.children.map(child => child.position.clone());
    for (let step = 0; step < 60; step += 1) crowd.update(1 / 60, player, eye);
    const after = crowd.group.children.map(child => child.position.clone());
    after.forEach((position, index) => {
      expect(position.distanceTo(before[index])).toBeGreaterThan(0.3);
      expect(position.y).toBe(0);
    });
  });

  it('thins the crowd on the phone quality path', () => {
    const crowd = spawnCrowd(true, new Map(), true);
    expect(crowd.walkers).toBe(2);
  });

  it('drops hulls past LOD1 and stops animating past the far cutoff', () => {
    expect(CROWD_ANIM_CUTOFF).toBeGreaterThan(LOD1_DISTANCE);
    const crowd = spawnCrowd(true, new Map());
    const player = new Vector3(0, 0, 0);
    const near = crowd.group.children[0];
    crowd.update(1 / 60, player, new Vector3(0, 2, 0));
    crowd.update(1 / 60, player, new Vector3(near.position.x, 2, near.position.z));
    let hullsOn = 0;
    near.traverse(object => {
      const hull = object.userData.outline;
      if (hull) hullsOn += hull.visible ? 1 : 0;
    });
    crowd.update(1 / 60, player, new Vector3(0, 2, 60));
    let hullsOff = 0;
    near.traverse(object => {
      const hull = object.userData.outline;
      if (hull) hullsOff += hull.visible ? 1 : 0;
    });
    expect(hullsOn).toBeGreaterThan(0);
    expect(hullsOff).toBe(0);
  });
});
