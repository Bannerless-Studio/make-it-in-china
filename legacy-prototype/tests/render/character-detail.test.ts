import { describe, expect, it } from 'vitest';
import {
  AnimationClip,
  Box3,
  Group,
  Mesh,
  MeshToonMaterial,
  QuaternionKeyframeTrack,
  Vector3,
  VectorKeyframeTrack,
} from 'three';
import { addBackAttachments, clipIsStatic, makeCharacter, makeHead } from '../../src/render/character';
import { PALETTE } from '../../src/render/constants';

function attachments(group: Group): Mesh[] {
  const found: Mesh[] = [];
  group.traverse(object => {
    if (object instanceof Mesh && object.name === 'back-attachment') found.push(object);
  });
  return found;
}

describe('character attachment readability', () => {
  it('hangs the player satchel behind the upright root so it reads from behind', () => {
    const group = new Group();
    addBackAttachments(group, {
      width: 1,
      skin: PALETTE.skinA,
      jacket: PALETTE.plaster,
      trousers: PALETTE.slate,
      bag: true,
      bagColor: PALETTE.wood,
    }, {});
    const parts = attachments(group);
    expect(parts.length).toBeGreaterThan(0);
    const bounds = new Box3().setFromObject(group);
    const center = bounds.getCenter(new Vector3());
    expect(center.z).toBeLessThan(-0.1);
    expect(bounds.max.z).toBeLessThan(0);
    expect(center.y).toBeGreaterThan(0.8);
    expect(center.y).toBeLessThan(1.6);
  });

  it('gives apron and parcel outfits a back-facing tie or load', () => {
    const apron = new Group();
    addBackAttachments(apron, {
      width: 1.12,
      skin: PALETTE.skinB,
      jacket: PALETTE.paper,
      trousers: PALETTE.teal,
      apron: PALETTE.terracotta,
    }, {});
    expect(attachments(apron).length).toBeGreaterThan(0);
    expect(new Box3().setFromObject(apron).max.z).toBeLessThan(0);

    const parcel = new Group();
    addBackAttachments(parcel, {
      width: 0.92,
      skin: PALETTE.skinB,
      jacket: PALETTE.olive,
      trousers: PALETTE.teal,
      prop: 'parcel',
    }, {});
    expect(attachments(parcel).length).toBeGreaterThan(0);
  });

  it('merges back attachments per colour instead of one draw each', () => {
    const group = new Group();
    addBackAttachments(group, {
      width: 1,
      skin: PALETTE.skinA,
      jacket: PALETTE.plaster,
      trousers: PALETTE.slate,
      bag: true,
      bagColor: PALETTE.wood,
    }, {});
    expect(attachments(group).length).toBe(1);
  });
});

describe('blank head tone', () => {
  it('uses the ART blank skin tone, not white plastic', () => {
    const head = makeHead(true);
    const material = head.material as MeshToonMaterial;
    expect(material.color.getHex()).toBe(PALETTE.skinA);
    expect(material.color.getHex()).not.toBe(0xffffff);
    expect(makeHead(true, PALETTE.skinB).material).toBeDefined();
  });

  it('paints the fallback head with the outfit skin tone', () => {
    const character = makeCharacter(true, new Map(), 0xe7d6ba, { bag: true }, 'player');
    const material = (character.head as Mesh).material as MeshToonMaterial;
    expect(material.color.getHex()).toBe(PALETTE.skinA);
    const npc = makeCharacter(true, new Map(), 0x526d82, {}, 'landlord');
    expect(((npc.head as Mesh).material as MeshToonMaterial).color.getHex()).toBe(PALETTE.skinB);
  });
});

describe('idle micro motion', () => {
  it('detects a static clip so procedural motion only fills a dead pose', () => {
    const still = new AnimationClip('still', 1, [
      new VectorKeyframeTrack('Head.position', [0, 1], [0, 0, 0, 0, 0, 0]),
    ]);
    const moving = new AnimationClip('moving', 1, [
      new QuaternionKeyframeTrack('Head.quaternion', [0, 1], [0, 0, 0, 1, 0, 0.3, 0, 0.95]),
    ]);
    expect(clipIsStatic(still)).toBe(true);
    expect(clipIsStatic(moving)).toBe(false);
    expect(clipIsStatic(undefined)).toBe(true);
  });

  it('moves the blank head while standing and rests it while walking', () => {
    const character = makeCharacter(true, new Map(), 0xe7d6ba, { bag: true }, 'player');
    const head = character.head as Mesh;
    character.update(0.4, 0, false, 0);
    const idlePose = head.rotation.y;
    character.update(0.4, 0, false, 0);
    expect(head.rotation.y).not.toBe(idlePose);
    character.update(0.1, 2.4, false, 0);
    expect(head.rotation.y).toBe(0);
    expect(head.rotation.x).toBe(0);
  });
});
