import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import type { World } from '../../src/content/types';
import { makeNpc, npcAnchor, queryNpcSchedule } from '../../src/render/npc';
import { NPC_WALK_SPEED } from '../../src/render/constants';
import worldJSON from '../../content/phase1/world.json?raw';

const world = JSON.parse(worldJSON) as World;

function actorFor(id: string) {
  const index = world.npcs.findIndex(npc => npc.id === id);
  return { actor: makeNpc(world.npcs[index], true, new Map(), index), index };
}

describe('scheduled npcs walk between slot anchors', () => {
  it('gives all eight npcs a waypoint for every slot', () => {
    expect(world.npcs.length).toBe(8);
    for (const npc of world.npcs) {
      for (const slot of ['M', 'A1', 'A2', 'A3', 'A4', 'E'] as const) {
        const schedule = queryNpcSchedule(world, npc.id, slot);
        expect(schedule, `${npc.id} ${slot}`).not.toBeNull();
        const node = world.waypoints?.find(item => item.id === schedule!.waypointId);
        expect(node, `${npc.id} ${slot} waypoint`).toBeDefined();
      }
    }
  });

  it('spawns on the first slot anchor without a walk', () => {
    const { actor, index } = actorFor('landlord');
    const player = new Vector3(0, 0, 40);
    actor.update(0, player, null, 'M', world, 40);
    const anchor = npcAnchor(world, 'landlord', 'M', index)!;
    expect(actor.group.position.x).toBeCloseTo(anchor.x, 5);
    expect(actor.group.position.z).toBeCloseTo(anchor.z, 5);
  });

  it('walks rather than teleports when the slot changes', () => {
    const { actor, index } = actorFor('landlord');
    const player = new Vector3(0, 0, 40);
    actor.update(0, player, null, 'M', world, 40);
    const from = actor.group.position.clone();
    const goal = npcAnchor(world, 'landlord', 'A3', index)!;
    expect(Math.hypot(goal.x - from.x, goal.z - from.z)).toBeGreaterThan(4);

    actor.update(1 / 60, player, null, 'A3', world, 40);
    const firstStep = actor.group.position.distanceTo(from);
    expect(firstStep).toBeGreaterThan(0);
    expect(firstStep).toBeLessThanOrEqual(NPC_WALK_SPEED / 60 + 1e-6);
    for (let step = 0; step < 29; step += 1) {
      actor.update(1 / 60, player, null, 'A3', world, 40);
    }
    const halfSecond = actor.group.position.distanceTo(from);
    expect(halfSecond).toBeLessThanOrEqual(NPC_WALK_SPEED * 0.5 + 1e-6);
    expect(Math.hypot(goal.x - actor.group.position.x, goal.z - actor.group.position.z))
      .toBeGreaterThan(1);

    let travelled = 0;
    let previous = actor.group.position.clone();
    for (let step = 0; step < 60 * 60; step += 1) {
      actor.update(1 / 60, player, null, 'A3', world, 40);
      travelled += actor.group.position.distanceTo(previous);
      previous = actor.group.position.clone();
      if (Math.hypot(goal.x - previous.x, goal.z - previous.z) < 1e-6) break;
    }
    expect(previous.x).toBeCloseTo(goal.x, 4);
    expect(previous.z).toBeCloseTo(goal.z, 4);
    expect(travelled).toBeGreaterThan(Math.hypot(goal.x - from.x, goal.z - from.z) - 1e-6);
  });

  it('holds position while the player is talking to it', () => {
    const { actor } = actorFor('cook');
    const player = new Vector3(0, 0, 40);
    actor.update(0, player, null, 'M', world, 40);
    const before = actor.group.position.clone();
    for (let step = 0; step < 120; step += 1) {
      actor.update(1 / 60, player, 'cook', 'A2', world, 40);
    }
    expect(actor.group.position.distanceTo(before)).toBe(0);
  });
});
