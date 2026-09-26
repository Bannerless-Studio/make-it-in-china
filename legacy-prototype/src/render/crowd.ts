import { Group, Vector3 } from 'three';
import type { LoadedScenes } from './assets';
import { makeCharacter, type Character } from './character';
import {
  CROWD_ANIM_CUTOFF,
  CROWD_SPEED,
  CROWD_YIELD_PUSH,
  CROWD_YIELD_RADIUS,
  CYCLIST_SPEED,
  LOD1_DISTANCE,
} from './constants';
import { bicycle } from './props';

export type RoutePoint = [number, number];

export interface Route {
  id: string;
  outfit: string;
  speed: number;
  start: number;
  points: RoutePoint[];
}

export const PEDESTRIAN_ROUTES: Route[] = [
  {
    id: 'ped_a',
    outfit: 'ped_a',
    speed: CROWD_SPEED,
    start: 0.05,
    points: [[-26, -5.2], [25, -5.2], [25, -6.5], [-26, -6.5]],
  },
  {
    id: 'ped_b',
    outfit: 'ped_b',
    speed: CROWD_SPEED,
    start: 0.32,
    points: [[24, 5.2], [-23, 5.2], [-23, 6.5], [24, 6.5]],
  },
  {
    id: 'ped_c',
    outfit: 'ped_c',
    speed: CROWD_SPEED,
    start: 0.58,
    points: [
      [-14.5, -5.6], [-8.6, -5.6], [-8.6, 5.6], [2, 5.6],
      [2, 6.7], [-7.4, 6.7], [-7.4, -6.7], [-14.5, -6.7],
    ],
  },
  {
    id: 'ped_d',
    outfit: 'ped_d',
    speed: CROWD_SPEED,
    start: 0.77,
    points: [[20, -6.5], [6, -6.5], [6, -5.3], [20, -5.3]],
  },
];

export const CYCLE_ROUTE: Route = {
  id: 'cyclist',
  outfit: 'cyclist',
  speed: CYCLIST_SPEED,
  start: 0.4,
  points: [
    [-22, -2.4], [22, -2.4], [23.6, -1.1], [23.6, 1.1],
    [22, 2.4], [-22, 2.4], [-23.6, 1.1], [-23.6, -1.1],
  ],
};

export function routeLength(points: RoutePoint[]): number {
  let total = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    total += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return total;
}

export interface RoutePose {
  x: number;
  z: number;
  yaw: number;
  dirX: number;
  dirZ: number;
}

export function poseAt(points: RoutePoint[], distance: number): RoutePose {
  const total = routeLength(points);
  let remaining = ((distance % total) + total) % total;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const length = Math.hypot(dx, dz);
    if (remaining <= length || i === points.length - 1) {
      const t = length > 1e-6 ? Math.min(1, remaining / length) : 0;
      const dirX = length > 1e-6 ? dx / length : 0;
      const dirZ = length > 1e-6 ? dz / length : 1;
      return {
        x: a[0] + dx * t,
        z: a[1] + dz * t,
        yaw: Math.atan2(dirX, dirZ),
        dirX,
        dirZ,
      };
    }
    remaining -= length;
  }
  return { x: points[0][0], z: points[0][1], yaw: 0, dirX: 0, dirZ: 1 };
}

export function yieldOffset(
  pose: RoutePose,
  playerX: number,
  playerZ: number,
  current: number,
): number {
  const dx = pose.x - playerX;
  const dz = pose.z - playerZ;
  const distance = Math.hypot(dx, dz);
  if (distance >= CROWD_YIELD_RADIUS) return 0;
  const side = dx * pose.dirZ - dz * pose.dirX;
  const away = side === 0 ? (current >= 0 ? 1 : -1) : Math.sign(side);
  const strength = 1 - distance / CROWD_YIELD_RADIUS;
  return away * CROWD_YIELD_PUSH * strength;
}

interface Walker {
  route: Route;
  character: Character;
  group: Group;
  travelled: number;
  offset: number;
  yaw: number;
  bike: Group | null;
}

export interface Crowd {
  group: Group;
  walkers: number;
  update(dt: number, player: Vector3, eye: Vector3): void;
}

function makeWalker(route: Route, toon: boolean, assets: LoadedScenes): Walker {
  const character = makeCharacter(toon, assets, 0xb8a78d, {}, route.outfit);
  const group = new Group();
  group.name = `crowd-${route.id}`;
  group.add(character.group);
  let bike: Group | null = null;
  if (route.id === 'cyclist') {
    bike = bicycle();
    bike.rotation.y = -Math.PI / 2;
    group.add(bike);
    character.group.position.y = 0.42;
    character.group.rotation.x = -0.16;
  }
  return {
    route,
    character,
    group,
    travelled: route.start * routeLength(route.points),
    offset: 0,
    yaw: 0,
    bike,
  };
}

export function spawnCrowd(toon: boolean, assets: LoadedScenes, reduced = false): Crowd {
  const group = new Group();
  group.name = 'crowd';
  const routes = reduced ? PEDESTRIAN_ROUTES.slice(0, 2) : PEDESTRIAN_ROUTES;
  const walkers = [
    ...routes.map(route => makeWalker(route, toon, assets)),
    ...(reduced ? [] : [makeWalker(CYCLE_ROUTE, toon, assets)]),
  ];
  for (const walker of walkers) group.add(walker.group);

  return {
    group,
    walkers: walkers.length,
    update(dt, player, eye) {
      for (const walker of walkers) {
        const pose = poseAt(walker.route.points, walker.travelled);
        const wanted = yieldOffset(pose, player.x, player.z, walker.offset);
        walker.offset += (wanted - walker.offset) * Math.min(1, dt * 3.2);
        const perpX = pose.dirZ;
        const perpZ = -pose.dirX;
        const x = pose.x + perpX * walker.offset;
        const z = pose.z + perpZ * walker.offset;
        const blocked = Math.hypot(x - player.x, z - player.z) < 0.7;
        const speed = blocked ? walker.route.speed * 0.25 : walker.route.speed;
        walker.travelled += speed * dt;
        walker.group.position.set(x, 0, z);
        walker.yaw += ((pose.yaw - walker.yaw + Math.PI * 3) % (Math.PI * 2) - Math.PI)
          * Math.min(1, dt * 6);
        walker.group.rotation.y = walker.yaw;
        const view = Math.hypot(eye.x - x, eye.z - z);
        walker.character.setDetail(view < LOD1_DISTANCE);
        if (view >= CROWD_ANIM_CUTOFF) continue;
        walker.character.update(dt, walker.bike ? 0 : speed, false, view);
      }
    },
  };
}
