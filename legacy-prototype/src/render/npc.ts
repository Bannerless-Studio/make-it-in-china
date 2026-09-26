import { Group, Vector3 } from 'three';
import type { Npc, TimeSlot, World } from '../content/types';
import type { LoadedScenes } from './assets';
import { makeCharacter, type Character } from './character';
import { ARRIVAL_OFFSETS, LOD1_DISTANCE, NPC_WALK_SPEED, TALK_RANGE } from './constants';
import { findWaypointPath, nearestWaypoint } from './navigation';
import { turnToward } from './motion';

export interface NpcActor {
  id: string;
  name: string;
  label: string;
  group: Group;
  character: Character;
  update(
    dt: number,
    player: Vector3,
    talkingId: string | null,
    slot: TimeSlot,
    world: World,
    viewDistance: number,
  ): void;
}

export function queryNpcSchedule(
  world: World,
  npcId: string,
  slot: TimeSlot,
): { waypointId: string } | null {
  const waypointId = world.schedules?.[npcId]?.[slot];
  if (!waypointId) return null;
  return { waypointId };
}

function waypointPosition(world: World, id: string): { x: number; z: number } | null {
  const node = world.waypoints?.find(item => item.id === id);
  if (!node) return null;
  return { x: node.position[0], z: node.position[1] };
}

function offsetFor(index: number): [number, number] {
  return ARRIVAL_OFFSETS[index % ARRIVAL_OFFSETS.length];
}

export function npcAnchor(
  world: World,
  npcId: string,
  slot: TimeSlot,
  index: number,
): { x: number; z: number } | null {
  const schedule = queryNpcSchedule(world, npcId, slot);
  if (!schedule) return null;
  const goal = waypointPosition(world, schedule.waypointId);
  if (!goal) return null;
  const shift = offsetFor(index);
  return { x: goal.x + shift[0], z: goal.z + shift[1] };
}

export function makeNpc(
  npc: Npc,
  toon: boolean,
  assets: LoadedScenes,
  index: number,
): NpcActor {
  const color = Number.parseInt(npc.color.slice(1), 16);
  const character = makeCharacter(toon, assets, color, {
    headwear: npc.headwear,
    prop: npc.prop,
  }, npc.id);
  const group = character.group;
  let path: Array<{ x: number; z: number }> = [];
  let currentSlot: TimeSlot | null = null;
  let yaw = 0;
  const scratch = new Vector3();

  function retarget(world: World, slot: TimeSlot): void {
    const schedule = queryNpcSchedule(world, npc.id, slot);
    const goalId = schedule?.waypointId;
    if (!goalId) return;
    const goal = waypointPosition(world, goalId);
    if (!goal) return;
    const shift = offsetFor(index);
    const dest = { x: goal.x + shift[0], z: goal.z + shift[1] };
    if (currentSlot === null) {
      group.position.set(dest.x, 0, dest.z);
      path = [];
      currentSlot = slot;
      return;
    }
    if (currentSlot === slot) return;
    const fromId = nearestWaypoint(world.waypoints ?? [], group.position.x, group.position.z);
    if (!fromId || !world.waypoints) {
      group.position.set(dest.x, 0, dest.z);
      path = [];
      currentSlot = slot;
      return;
    }
    const ids = findWaypointPath(world.waypoints, fromId, goalId);
    path = ids.map(id => {
      const node = waypointPosition(world, id)!;
      return { x: node.x, z: node.z };
    });
    path.push(dest);
    while (path.length > 1
      && Math.hypot(path[0].x - group.position.x, path[0].z - group.position.z) < 0.05) {
      path.shift();
    }
    currentSlot = slot;
  }

  return {
    id: npc.id,
    name: npc.name,
    label: npc.label,
    group,
    character,
    update(dt, player, talkingId, slot, world, viewDistance) {
      retarget(world, slot);
      const talking = talkingId === npc.id;
      let speed = 0;
      if (!talking && path.length) {
        let budget = NPC_WALK_SPEED * dt;
        let moved = 0;
        while (budget > 1e-6 && path.length) {
          const target = path[0];
          scratch.set(target.x - group.position.x, 0, target.z - group.position.z);
          const dist = Math.hypot(scratch.x, scratch.z);
          if (dist <= 1e-6) {
            path.shift();
            continue;
          }
          yaw = turnToward(yaw, Math.atan2(scratch.x, scratch.z), dt);
          if (dist <= budget) {
            group.position.set(target.x, 0, target.z);
            path.shift();
            budget -= dist;
            moved += dist;
            continue;
          }
          group.position.x += (scratch.x / dist) * budget;
          group.position.z += (scratch.z / dist) * budget;
          moved += budget;
          budget = 0;
        }
        speed = moved / Math.max(dt, 1e-4);
      }
      const dx = player.x - group.position.x;
      const dz = player.z - group.position.z;
      const near = Math.hypot(dx, dz) <= TALK_RANGE;
      if ((near || talking) && !path.length) {
        yaw = turnToward(yaw, Math.atan2(dx, dz), dt);
      }
      group.rotation.y = yaw;
      character.setDetail(talking || viewDistance < LOD1_DISTANCE);
      character.update(dt, speed, talking, viewDistance);
    },
  };
}

export function spawnNpcs(world: World, toon: boolean, assets: LoadedScenes): NpcActor[] {
  return world.npcs.map((npc, index) => makeNpc(npc, toon, assets, index));
}
