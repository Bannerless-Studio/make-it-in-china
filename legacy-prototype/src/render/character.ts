import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  Bone,
  Box3,
  BoxGeometry,
  BufferAttribute,
  CapsuleGeometry,
  Color,
  ColorRepresentation,
  CylinderGeometry,
  Euler,
  Group,
  Mesh,
  MeshToonMaterial,
  Object3D,
  Quaternion,
  SkinnedMesh,
  SphereGeometry,
  Vector3,
} from 'three';
import type { LoadedScenes } from './assets';
import { cloneModel } from './assets';
import {
  BLEND_LOCO,
  BLEND_TALK,
  CAPSULE_HEIGHT,
  CLIP_MAP,
  FAR_ANIM_HZ,
  HEAD_HEIGHT,
  IDLE_SPEED,
  LOD1_DISTANCE,
  PALETTE,
  RUN_ENTER_SPEED,
  RUN_EXIT_SPEED,
  WALK_RATE_MAX,
  WALK_RATE_MIN,
  WALK_RATE_REF,
} from './constants';
import { GeomBatch } from './geom';
import { makeMesh, styleLoadedScene, toonMaterial } from './toon';

const _euler = new Euler();
const _micro = new Quaternion();

export type LocoState = 'idle' | 'walk' | 'run' | 'talk';

export interface CharacterAccessories {
  headwear?: string;
  prop?: string;
  bag?: boolean;
  width?: number;
}

export interface Character {
  group: Group;
  head: Object3D | null;
  update(delta: number, speed: number, talking: boolean, viewDistance?: number): void;
  headWorld(target: Vector3): Vector3;
  setDetail(near: boolean): void;
}

interface Outfit {
  width: number;
  skin: number;
  jacket: number;
  trousers: number;
  shoes?: number;
  hat?: 'cap' | 'cook' | 'straw';
  prop?: string;
  bag?: boolean;
  bagColor?: number;
  apron?: number;
  scarf?: number;
  sleeves?: number;
  plain?: boolean;
}

const DEFAULT_SHOES = 0x4a3f36;

const OUTFITS: Record<string, Outfit> = {
  player: {
    width: 1,
    skin: PALETTE.skinA,
    jacket: PALETTE.plaster,
    trousers: PALETTE.slate,
    bag: true,
    bagColor: PALETTE.wood,
  },
  landlord: {
    width: 1.05,
    skin: PALETTE.skinB,
    jacket: PALETTE.slate,
    trousers: PALETTE.teal,
    hat: 'cap',
    sleeves: PALETTE.ochre,
  },
  mentor: {
    width: 1,
    skin: PALETTE.skinA,
    jacket: PALETTE.umber,
    trousers: PALETTE.slate,
    prop: 'book',
    scarf: PALETTE.plaster,
  },
  cook: {
    width: 1.12,
    skin: PALETTE.skinB,
    jacket: PALETTE.paper,
    trousers: PALETTE.teal,
    hat: 'cook',
    prop: 'towel',
    apron: PALETTE.terracotta,
  },
  warehouse_boss: {
    width: 1.1,
    skin: PALETTE.skinA,
    jacket: PALETTE.teal,
    trousers: PALETTE.slate,
    prop: 'clipboard',
    sleeves: PALETTE.ochre,
  },
  delivery_boss: {
    width: 0.92,
    skin: PALETTE.skinB,
    jacket: PALETTE.olive,
    trousers: PALETTE.teal,
    prop: 'parcel',
    bag: true,
    bagColor: PALETTE.wood,
  },
  fruit_seller: {
    width: 1.08,
    skin: PALETTE.skinA,
    jacket: PALETTE.clay,
    trousers: PALETTE.slate,
    hat: 'straw',
    apron: PALETTE.paper,
  },
  shopkeeper: {
    width: 0.95,
    skin: PALETTE.skinB,
    jacket: PALETTE.periwinkle,
    trousers: PALETTE.teal,
    prop: 'basket',
  },
  customer: {
    width: 1.06,
    skin: PALETTE.skinA,
    jacket: PALETTE.plum,
    trousers: PALETTE.slate,
    prop: 'bag',
    bag: true,
    bagColor: PALETTE.paper,
  },
  ped_a: {
    plain: true,
    width: 0.98,
    skin: PALETTE.skinB,
    jacket: PALETTE.teal,
    trousers: PALETTE.slate,
    bag: true,
    bagColor: PALETTE.umber,
  },
  ped_b: {
    plain: true,
    width: 1.04,
    skin: PALETTE.skinA,
    jacket: PALETTE.olive,
    trousers: PALETTE.teal,
  },
  ped_c: {
    plain: true,
    width: 0.94,
    skin: PALETTE.skinB,
    jacket: PALETTE.periwinkle,
    trousers: PALETTE.slate,
  },
  ped_d: {
    plain: true,
    width: 1.02,
    skin: PALETTE.skinA,
    jacket: PALETTE.clay,
    trousers: PALETTE.teal,
    bag: true,
    bagColor: PALETTE.wood,
  },
  cyclist: {
    plain: true,
    width: 0.96,
    skin: PALETTE.skinB,
    jacket: PALETTE.umber,
    trousers: PALETTE.slate,
  },
};

type Region = 'skin' | 'jacket' | 'trousers' | 'shoes';

const BONE_REGIONS: Array<[RegExp, Region]> = [
  [/(foot|ball|toe)/i, 'shoes'],
  [/(thigh|calf|shin|knee)/i, 'trousers'],
  [/(head|skull|face|jaw|neck|hand|index|middle|pinky|ring|thumb|lowerarm)/i, 'skin'],
  [/(upperarm|clavicle|spine|chest|pelvis|root)/i, 'jacket'],
];

const BARE_HEAD = /head|skull|face/i;

function regionOf(bone: string): Region {
  for (const [pattern, region] of BONE_REGIONS) {
    if (pattern.test(bone)) return region;
  }
  return 'jacket';
}

function regionColors(outfit: Outfit): Record<Region, Color> {
  return {
    skin: new Color(outfit.skin),
    jacket: new Color(outfit.jacket),
    trousers: new Color(outfit.trousers),
    shoes: new Color(outfit.shoes ?? DEFAULT_SHOES),
  };
}

export function paintOutfitGeometry(root: Object3D, outfit: Outfit): void {
  const palette = regionColors(outfit);
  root.traverse(object => {
    if (!(object instanceof SkinnedMesh)) return;
    const source = object.geometry;
    const index = source.getAttribute('skinIndex');
    const weight = source.getAttribute('skinWeight');
    const position = source.getAttribute('position');
    if (!index || !weight || !position) return;
    const geometry = source.clone();
    const bones = object.skeleton?.bones ?? [];
    const colors = new Float32Array(position.count * 3);
    for (let vertex = 0; vertex < position.count; vertex += 1) {
      let best = 0;
      let bestWeight = -1;
      for (let slot = 0; slot < 4; slot += 1) {
        const value = weight.getComponent(vertex, slot);
        if (value > bestWeight) {
          bestWeight = value;
          best = index.getComponent(vertex, slot);
        }
      }
      const bone = bones[best]?.name ?? '';
      const color = palette[regionOf(bone)];
      colors[vertex * 3] = color.r;
      colors[vertex * 3 + 1] = color.g;
      colors[vertex * 3 + 2] = color.b;
    }
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    object.geometry = geometry;
  });
}

function enableVertexColors(root: Object3D): void {
  root.traverse(object => {
    if (!(object instanceof SkinnedMesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!(material instanceof MeshToonMaterial)) continue;
      material.vertexColors = true;
      material.color.setHex(0xffffff);
      material.needsUpdate = true;
    }
  });
}

const strippedCache = new WeakMap<AnimationClip[], Map<string, AnimationClip>>();

function isRootBone(name: string): boolean {
  const bone = name.split('.')[0]?.split('[')[0] ?? name;
  return /^(root|hips|pelvis|armature|ual_root)$/i.test(bone);
}

function stripRootMotion(clip: AnimationClip): AnimationClip {
  const copy = clip.clone();
  copy.name = clip.name;
  for (const track of copy.tracks) {
    if (!isRootBone(track.name)) continue;
    if (track.name.endsWith('.position') || track.name.endsWith('[position]')) {
      const values = track.values;
      for (let i = 0; i < values.length; i += 3) {
        values[i] = 0;
        values[i + 2] = 0;
      }
    }
  }
  return copy;
}

function clipMapFor(clips: AnimationClip[]): Map<string, AnimationClip> {
  const cached = strippedCache.get(clips);
  if (cached) return cached;
  const byName = new Map<string, AnimationClip>();
  for (const clip of clips) byName.set(clip.name, stripRootMotion(clip));
  strippedCache.set(clips, byName);
  return byName;
}

function mappedClip(clips: Map<string, AnimationClip>, role: keyof typeof CLIP_MAP): AnimationClip | undefined {
  return clips.get(CLIP_MAP[role]);
}

export function makeHead(toon: boolean, color: ColorRepresentation = PALETTE.skinA): Mesh {
  const head = makeMesh(new SphereGeometry(HEAD_HEIGHT / 2, 10, 8), color, toon);
  head.position.y = 1.88;
  return head;
}

function fallbackCharacter(toon: boolean, outfit: Outfit): Character {
  const group = new Group();
  const body = makeMesh(new CapsuleGeometry(0.28 * outfit.width, 0.72, 4, 8), outfit.jacket, toon);
  body.position.y = 1.08;
  const head = makeHead(toon, outfit.skin);
  group.add(body, head);
  const limbs: Mesh[] = [];
  for (const x of [-0.16 * outfit.width, 0.16 * outfit.width]) {
    const leg = makeMesh(new BoxGeometry(0.16, 0.62, 0.18), outfit.trousers, toon);
    leg.position.set(x, 0.32, 0);
    limbs.push(leg);
    group.add(leg);
  }
  for (const x of [-0.38 * outfit.width, 0.38 * outfit.width]) {
    const arm = makeMesh(new BoxGeometry(0.12, 0.58, 0.12), outfit.sleeves ?? outfit.skin, toon);
    arm.position.set(x, 1.18, 0);
    limbs.push(arm);
    group.add(arm);
  }
  if (outfit.apron) {
    const apron = makeMesh(new BoxGeometry(0.34 * outfit.width, 0.42, 0.08), outfit.apron, toon);
    apron.position.set(0, 1.05, 0.16);
    group.add(apron);
  }
  if (outfit.hat) head.add(hatMesh(outfit.hat));
  addBackAttachments(group, outfit, {});
  let elapsed = 0;
  return {
    group,
    head,
    update(delta, speed) {
      elapsed += delta;
      const walking = speed > IDLE_SPEED;
      const swing = walking ? Math.sin(elapsed * (speed > RUN_ENTER_SPEED ? 14 : 10)) * 0.48 : 0;
      limbs[0].rotation.x = swing;
      limbs[1].rotation.x = -swing;
      limbs[2].rotation.x = -swing;
      limbs[3].rotation.x = swing;
      if (walking) {
        head.rotation.set(0, 0, 0);
        return;
      }
      head.rotation.y = Math.sin(elapsed * 0.6) * 0.14;
      head.rotation.x = Math.sin(elapsed * 0.9 + 1.1) * 0.05;
      limbs[2].rotation.z = Math.sin(elapsed * 0.8) * 0.03;
      limbs[3].rotation.z = -Math.sin(elapsed * 0.8 + 0.6) * 0.03;
    },
    headWorld(target) {
      return head.getWorldPosition(target);
    },
    setDetail(near) {
      setHullVisible(group, near);
    },
  };
}

function findBone(root: Object3D, pattern: RegExp): Bone | undefined {
  let match: Bone | undefined;
  root.traverse(object => {
    if (!match && object instanceof Bone && pattern.test(object.name)) match = object;
  });
  return match;
}

function removeFacialFeatures(root: Object3D): void {
  const featureName = /eye|brow|mouth|teeth|tongue|lash|iris|pupil|nose|face/i;
  root.traverse(object => {
    if (object instanceof Mesh && featureName.test(object.name)) object.visible = false;
  });
}

function hatMesh(kind: NonNullable<Outfit['hat']>): Object3D {
  const group = new Group();
  const batch = new GeomBatch();
  if (kind === 'straw') {
    batch.cylinder(0.28, 0.28, 0.04, 12, PALETTE.ochre, 0, 0.16, 0);
    batch.cylinder(0.12, 0.14, 0.1, 10, PALETTE.ochre, 0, 0.23, 0);
  } else if (kind === 'cook') {
    batch.cylinder(0.12, 0.14, 0.16, 10, PALETTE.paper, 0, 0.2, 0);
  } else {
    batch.cylinder(0.13, 0.15, 0.08, 12, PALETTE.slate, 0, 0.16, 0);
  }
  for (const mesh of batch.flush(group)) mesh.name = 'hat';
  return group;
}

function propMesh(kind: string, toon: boolean): Mesh {
  if (kind === 'book' || kind === 'clipboard') {
    const prop = makeMesh(new BoxGeometry(0.16, 0.22, 0.04), PALETTE.wood, toon);
    prop.position.set(0, 0.08, 0.06);
    return prop;
  }
  if (kind === 'towel') {
    const prop = makeMesh(new BoxGeometry(0.08, 0.18, 0.04), PALETTE.terracotta, toon);
    prop.position.set(0, 0.06, 0.05);
    return prop;
  }
  if (kind === 'parcel') {
    const prop = makeMesh(new BoxGeometry(0.18, 0.14, 0.12), PALETTE.olive, toon);
    prop.position.set(0, 0.06, 0.08);
    return prop;
  }
  if (kind === 'basket') {
    const prop = makeMesh(new CylinderGeometry(0.1, 0.08, 0.12, 8), PALETTE.wood, toon);
    prop.position.set(0, 0.04, 0.07);
    return prop;
  }
  if (kind === 'bag') {
    const prop = makeMesh(new BoxGeometry(0.14, 0.18, 0.08), PALETTE.paper, toon);
    prop.position.set(0, 0.05, 0.06);
    return prop;
  }
  const prop = makeMesh(new BoxGeometry(0.12, 0.16, 0.06), PALETTE.wood, toon);
  prop.position.set(0, 0.06, 0.06);
  return prop;
}

export function addBackAttachments(
  group: Group,
  outfit: Outfit,
  extras: CharacterAccessories,
): void {
  const wearsBag = outfit.bag || extras.bag;
  if (!wearsBag && !outfit.apron && !outfit.prop) return;
  const batch = new GeomBatch();
  const back = -0.17 * outfit.width;
  if (wearsBag) {
    const color = outfit.bagColor ?? PALETTE.wood;
    batch.box(0.28 * outfit.width, 0.32, 0.13, color, 0, 1.06, back - 0.05);
    batch.box(0.3 * outfit.width, 0.05, 0.14, color, 0, 0.9, back - 0.05);
    batch.box(0.07, 0.56, 0.06, color, 0.1 * outfit.width, 1.34, back + 0.02, 0, 0, 0.42);
  }
  if (outfit.apron) {
    batch.box(0.34 * outfit.width, 0.05, 0.05, outfit.apron, 0, 1.18, back);
    batch.box(0.06, 0.4, 0.05, outfit.apron, -0.12 * outfit.width, 1.38, back, 0, 0, -0.3);
    batch.box(0.06, 0.4, 0.05, outfit.apron, 0.12 * outfit.width, 1.38, back, 0, 0, 0.3);
  }
  if (outfit.prop === 'parcel') {
    batch.box(0.26, 0.2, 0.16, PALETTE.olive, 0, 1.12, back - 0.09);
    batch.box(0.27, 0.04, 0.17, PALETTE.paper, 0, 1.22, back - 0.09);
  }
  for (const mesh of batch.flush(group)) {
    mesh.name = 'back-attachment';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
}

function enforceSkinTone(root: Object3D, skin: number): void {
  root.traverse(object => {
    if (!(object instanceof Mesh) || object instanceof SkinnedMesh) return;
    if (!BARE_HEAD.test(object.name) || object.name.endsWith('-outline')) return;
    object.material = toonMaterial(skin);
  });
}

export function clipIsStatic(clip: AnimationClip | undefined): boolean {
  if (!clip) return true;
  for (const track of clip.tracks) {
    const values = track.values;
    const stride = track.getValueSize();
    if (values.length <= stride) continue;
    for (let component = 0; component < stride; component += 1) {
      const first = values[component];
      for (let frame = 1; frame < values.length / stride; frame += 1) {
        if (Math.abs(values[frame * stride + component] - first) > 1e-3) return false;
      }
    }
  }
  return true;
}

function setHullVisible(root: Object3D, visible: boolean): void {
  root.traverse(object => {
    const hull = object.userData.outline as Object3D | undefined;
    if (hull) hull.visible = visible;
  });
}

function addAccessories(root: Object3D, toon: boolean, outfit: Outfit, extras: CharacterAccessories): void {
  const hat = outfit.hat
    ?? (extras.headwear?.includes('straw') ? 'straw'
      : extras.headwear?.includes('cook') || extras.headwear?.includes('white') ? 'cook'
        : extras.headwear ? 'cap' : undefined);
  if (hat) {
    const head = findBone(root, /head/i);
    if (head) head.add(hatMesh(hat));
  }
  const chest = findBone(root, /(spine|chest|torso)/i);
  if (chest && !outfit.plain) {
    const kit = new GeomBatch();
    kit.box(0.42 * outfit.width, 0.48, 0.26, outfit.jacket, 0, 0.12, 0.02);
    if (outfit.apron) kit.box(0.36 * outfit.width, 0.46, 0.08, outfit.apron, 0, -0.08, 0.16);
    if (outfit.sleeves) {
      for (const x of [-0.24 * outfit.width, 0.24 * outfit.width]) {
        kit.box(0.1, 0.16, 0.12, outfit.sleeves, x, 0.18, 0.02);
      }
    }
    if (outfit.scarf) kit.cylinder(0.14, 0.16, 0.1, 10, outfit.scarf, 0, 0.32, 0);
    for (const mesh of kit.flush(chest)) mesh.name = 'chest-kit';
  }
  const propKind = outfit.prop ?? extras.prop;
  if (propKind) {
    const hand = findBone(root, /(right.*hand|hand.*right|hand_r|r_hand|hand\.r)/i);
    if (hand) hand.add(propMesh(propKind, toon));
  }
}

function normalizeCharacter(model: Group, width: number): void {
  const bounds = new Box3().setFromObject(model);
  const size = bounds.getSize(new Vector3());
  if (!Number.isFinite(size.y) || size.y <= 0) return;
  const scale = CAPSULE_HEIGHT / size.y;
  const center = bounds.getCenter(new Vector3());
  model.scale.set(scale * width, scale, scale);
  model.position.set(-center.x * scale * width, -bounds.min.y * scale, -center.z * scale);
}

function blendTime(from: LocoState, to: LocoState): number {
  if (from === 'talk' || to === 'talk') return BLEND_TALK;
  return BLEND_LOCO;
}

function nextState(speed: number, talking: boolean, current: LocoState): LocoState {
  if (talking) return 'talk';
  if (current === 'run') {
    if (speed < IDLE_SPEED) return 'idle';
    if (speed < RUN_EXIT_SPEED) return 'walk';
    return 'run';
  }
  if (speed < IDLE_SPEED) return 'idle';
  if (speed > RUN_ENTER_SPEED) return 'run';
  return 'walk';
}

function playMachine(
  mixer: AnimationMixer,
  clips: Map<string, AnimationClip>,
): { update(delta: number, speed: number, talking: boolean, far: boolean): void } {
  const actions = {
    idle: mappedClip(clips, 'idle'),
    walk: mappedClip(clips, 'walk'),
    run: mappedClip(clips, 'run'),
    talk: mappedClip(clips, 'talk'),
  };
  const played = new Map<LocoState, AnimationAction>();
  function action(state: LocoState): AnimationAction | undefined {
    const clip = actions[state] ?? actions.idle;
    if (!clip) return undefined;
    let current = played.get(state);
    if (!current) {
      current = mixer.clipAction(clip);
      current.enabled = true;
      played.set(state, current);
    }
    return current;
  }
  let state: LocoState = 'idle';
  let active = action('idle');
  active?.play();
  let animBank = 0;
  return {
    update(delta, speed, talking, far) {
      if (far) {
        animBank += delta;
        if (animBank < 1 / FAR_ANIM_HZ) return;
        delta = animBank;
        animBank = 0;
      }
      const next = nextState(speed, talking, state);
      const incoming = action(next);
      if (incoming && incoming !== active) {
        incoming.reset().play();
        incoming.setEffectiveWeight(1);
        if (active) active.crossFadeTo(incoming, blendTime(state, next), true);
        else incoming.fadeIn(blendTime(state, next));
        active = incoming;
        state = next;
      }
      if (active && (state === 'walk' || state === 'run')) {
        const ref = state === 'run' ? 4 : WALK_RATE_REF;
        active.setEffectiveTimeScale(Math.min(WALK_RATE_MAX, Math.max(WALK_RATE_MIN, speed / ref)));
      } else {
        active?.setEffectiveTimeScale(1);
      }
      mixer.update(delta);
    },
  };
}

export function makeCharacter(
  toon: boolean,
  assets: LoadedScenes,
  color: ColorRepresentation = PALETTE.terracotta,
  accessories: CharacterAccessories = {},
  id = 'player',
): Character {
  const outfit = OUTFITS[id] ?? {
    width: accessories.width ?? 1,
    skin: PALETTE.skinA,
    jacket: typeof color === 'number' ? color : PALETTE.plaster,
    trousers: PALETTE.slate,
  };
  const loaded = cloneModel(assets, 'mannequin');
  if (!loaded) return fallbackCharacter(toon, outfit);

  const group = new Group();
  paintOutfitGeometry(loaded.scene, outfit);
  styleLoadedScene(loaded.scene, toon);
  enableVertexColors(loaded.scene);
  removeFacialFeatures(loaded.scene);
  normalizeCharacter(loaded.scene, outfit.width);
  addAccessories(loaded.scene, toon, outfit, accessories);
  group.add(loaded.scene);

  addBackAttachments(group, outfit, accessories);
  enforceSkinTone(loaded.scene, outfit.skin);

  const clips = clipMapFor(loaded.animations);
  const mixer = new AnimationMixer(loaded.scene);
  const controls = playMachine(mixer, clips);
  const head = findBone(loaded.scene, /head/i) ?? null;
  const hands = [
    findBone(loaded.scene, /(hand_l|left.*hand|hand.*left|hand\.l)/i),
    findBone(loaded.scene, /(hand_r|right.*hand|hand.*right|hand\.r)/i),
  ];
  const fallbackHead = new Vector3(0, 1.55, 0);
  const micro = clipIsStatic(mappedClip(clips, 'idle'));
  const restHead = head?.quaternion.clone() ?? null;
  const restHands = hands.map(bone => bone?.quaternion.clone() ?? null);
  let elapsed = 0;
  let detailed = true;

  return {
    group,
    head,
    update(delta, speed, talking, viewDistance = 0) {
      const far = id !== 'player' && viewDistance >= LOD1_DISTANCE;
      controls.update(delta, speed, talking, far);
      if (!micro || far) return;
      elapsed += delta;
      if (speed > IDLE_SPEED) return;
      if (head && restHead) {
        _euler.set(Math.sin(elapsed * 0.9 + 1.1) * 0.045, Math.sin(elapsed * 0.6) * 0.12, 0);
        head.quaternion.copy(restHead).multiply(_micro.setFromEuler(_euler));
      }
      hands.forEach((bone, index) => {
        const rest = restHands[index];
        if (!bone || !rest) return;
        const sign = index === 0 ? 1 : -1;
        _euler.set(Math.sin(elapsed * 0.75 + index) * 0.05 * sign, 0, 0);
        bone.quaternion.copy(rest).multiply(_micro.setFromEuler(_euler));
      });
    },
    headWorld(target) {
      if (head) return head.getWorldPosition(target);
      return group.localToWorld(target.copy(fallbackHead));
    },
    setDetail(near) {
      if (near === detailed) return;
      detailed = near;
      setHullVisible(group, near);
    },
  };
}

export { CLIP_MAP };
