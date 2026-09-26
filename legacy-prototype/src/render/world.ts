import {
  Box3,
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { World, WorldMesh } from '../content/types';
import type { LoadedScenes, ModelId } from './assets';
import { cloneModel } from './assets';
import { BUILDINGS, takeWindowGlows } from './buildings';
import {
  BLOB_ALPHA,
  BLOB_RADIUS,
  PALETTE,
  SIGN_MAX_DISTANCE,
  SIGN_MAX_VISIBLE,
  SIGN_NEAR_DISTANCE,
  type PaletteRole,
} from './constants';
import { createDaylight, type Daylight, type DayPalette } from './daylight';
import {
  bicycle,
  fallbackProp,
  highestMesh,
  tagLamp,
  tickLanterns,
  tickSteam,
  addCrate,
} from './props';
import { GeomBatch } from './geom';
import { addGroundDecals, buildStreet, type ContactSpot, type Skyline } from './street';
import { styleLoadedScene, makeMesh, toonMaterial } from './toon';

export type { Daylight };
export { createDaylight };

export interface BuildingVolume {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  roof: Object3D[];
}

export interface District {
  group: Group;
  volumes: BuildingVolume[];
  signs: HTMLElement[];
  lamps: Mesh[];
  skyline: Skyline;
  setDayTone(palette: DayPalette): void;
  setInterior(player: Vector3, dt: number): void;
  projectSigns(camera: PerspectiveCamera, width: number, height: number): void;
  refreshProps(): void;
  update(dt: number): void;
}

const PROP_LIMITS: Record<string, Vector3> = {
  streetlight: new Vector3(0.8, 3.2, 0.8),
  bench: new Vector3(2.1, 1, 0.8),
  'box-a': new Vector3(0.7, 0.7, 0.7),
  bush: new Vector3(1.4, 1.1, 1.4),
  awning: new Vector3(3.6, 0.7, 1.2),
  'bowl-broth': new Vector3(0.32, 0.2, 0.32),
  chopstick: new Vector3(0.08, 0.05, 0.5),
  'cup-tea': new Vector3(0.22, 0.28, 0.22),
  steamer: new Vector3(0.4, 0.32, 0.4),
  pot: new Vector3(0.4, 0.34, 0.4),
};

const BUILDING_OWNED = new Set(['awning']);

const CONTACT_FOOTPRINTS: Record<string, { w: number; d: number; round?: boolean }> = {
  bench: { w: 1.9, d: 0.66 },
  'box-a': { w: 0.88, d: 0.72 },
  bush: { w: 1.05, d: 1.05, round: true },
  streetlight: { w: 0.5, d: 0.5, round: true },
};

function windowGlowMesh(parent: Object3D): Mesh | null {
  const glows = takeWindowGlows();
  if (!glows.length) return null;
  const quads: BufferGeometry[] = [];
  for (const glow of glows) {
    const quad = new PlaneGeometry(glow.w, glow.h);
    if (glow.axis === 'x') quad.rotateY(Math.PI / 2);
    quad.translate(glow.x, glow.y, glow.z);
    quads.push(quad);
  }
  const merged = quads.length === 1 ? quads[0] : mergeGeometries(quads, false);
  if (quads.length > 1) for (const quad of quads) quad.dispose();
  if (!merged) return null;
  const mesh = new Mesh(merged, new MeshBasicMaterial({
    color: PALETTE.ochre,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: DoubleSide,
  }));
  mesh.name = 'window-glow';
  mesh.renderOrder = 1;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.visible = false;
  parent.add(mesh);
  return mesh;
}

function paletteColor(role: string | undefined): number {
  if (role && role in PALETTE) return PALETTE[role as PaletteRole];
  return PALETTE.plaster;
}

function fitModel(model: Object3D, limits: Vector3): void {
  const bounds = new Box3().setFromObject(model);
  const size = bounds.getSize(new Vector3());
  if (size.x <= 0 || size.y <= 0 || size.z <= 0) return;
  const scale = Math.min(limits.x / size.x, limits.y / size.y, limits.z / size.z);
  const center = bounds.getCenter(new Vector3());
  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
}

function loadProp(assets: LoadedScenes, mesh: WorldMesh): Object3D {
  const id = mesh.asset as ModelId | undefined;
  const color = paletteColor(mesh.palette);
  const limits = (id && PROP_LIMITS[id]) || new Vector3(1, 1, 1);
  const loaded = id ? cloneModel(assets, id) : null;
  if (loaded) {
    styleLoadedScene(loaded.scene, true, color);
    const wrapper = new Group();
    wrapper.add(loaded.scene);
    fitModel(loaded.scene, limits);
    wrapper.position.set(mesh.position[0], mesh.position[1], mesh.position[2]);
    wrapper.rotation.y = mesh.yaw;
    wrapper.scale.set(mesh.scale[0], mesh.scale[1], mesh.scale[2]);
    if (id === 'streetlight') {
      const head = highestMesh(wrapper);
      if (head) tagLamp(head);
    }
    return wrapper;
  }
  const fallback = fallbackProp(id ?? '', color);
  fallback.position.set(mesh.position[0], mesh.position[1], mesh.position[2]);
  fallback.rotation.y = mesh.yaw;
  fallback.scale.set(mesh.scale[0], mesh.scale[1], mesh.scale[2]);
  return fallback;
}

function makeSignLayer(root: HTMLElement, signs: NonNullable<World['signs']>): HTMLElement[] {
  return signs.map(sign => {
    const el = document.createElement('div');
    el.className = `world-sign ${sign.fontRole}`;
    el.dataset.id = sign.id;
    el.textContent = sign.text;
    root.append(el);
    return el;
  });
}

export function blobShadow(): Mesh {
  const shadow = new Mesh(
    new CircleGeometry(BLOB_RADIUS, 16),
    new MeshBasicMaterial({
      color: 0x171717,
      transparent: true,
      opacity: BLOB_ALPHA,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  shadow.castShadow = false;
  shadow.receiveShadow = false;
  shadow.renderOrder = -2;
  return shadow;
}

export function buildDistrict(
  scene: Scene,
  world: World,
  assets: LoadedScenes,
  overlay: HTMLElement,
): District {
  const group = new Group();
  scene.add(group);
  const street = buildStreet(group);

  const lamps: Mesh[] = [];
  const steam: Mesh[] = [];
  const volumes: BuildingVolume[] = [];
  const shellBatch = new GeomBatch();
  for (const building of BUILDINGS) {
    const parts = building.build(group, building.cx, building.cz, shellBatch);
    lamps.push(...parts.lamps);
    steam.push(...parts.steam);
    volumes.push({
      id: building.id,
      minX: building.cx - building.sx / 2,
      maxX: building.cx + building.sx / 2,
      minZ: building.cz - building.sz / 2,
      maxZ: building.cz + building.sz / 2,
      roof: parts.fade,
    });
  }

  shellBatch.flush(group, { doubleSide: true });
  const windowGlow = windowGlowMesh(group);

  const bike = bicycle();
  bike.position.set(19.2, 0, -3.55);
  bike.rotation.y = 0.35;
  group.add(bike);

  const propRoot = new Group();
  group.add(propRoot);
  const propSwaps: WorldMesh[] = (world.meshes ?? []).filter(mesh => (
    mesh.kind === 'prop' && !BUILDING_OWNED.has(mesh.asset ?? '')
  ));
  const BATCHABLE = new Set(['bush', 'bench', 'box-a', 'streetlight', 'bowl-broth', 'cup-tea', 'pot', 'steamer', 'chopstick']);
  const buildingLamps = lamps.slice();
  function clearPropLamps(): void {
    lamps.length = 0;
    lamps.push(...buildingLamps);
  }
  function spawnAllProps(): void {
    while (propRoot.children.length) propRoot.remove(propRoot.children[0]);
    clearPropLamps();
    const batch = new GeomBatch();
    for (const mesh of propSwaps) {
      const id = mesh.asset;
      const loaded = id ? cloneModel(assets, id as ModelId) : null;
      if (loaded || !id || !BATCHABLE.has(id)) {
        const node = loadProp(assets, mesh);
        propRoot.add(node);
        node.traverse(object => {
          if (object instanceof Mesh && object.userData.lamp) lamps.push(object);
        });
        continue;
      }
      const [x, y, z] = mesh.position;
      const yaw = mesh.yaw;
      if (id === 'bush') {
        batch.sphere(0.42, PALETTE.sage, x, y + 0.45, z, 8, 6);
        batch.sphere(0.28, PALETTE.olive, x + 0.22, y + 0.55, z + 0.08, 8, 6);
        batch.sphere(0.22, PALETTE.sage, x - 0.18, y + 0.62, z - 0.1, 8, 6);
      } else if (id === 'bench') {
        batch.box(1.6, 0.08, 0.42, PALETTE.wood, x, y + 0.42, z, yaw);
        batch.box(1.6, 0.32, 0.08, PALETTE.wood, x, y + 0.62, z, yaw);
        batch.box(0.08, 0.42, 0.42, PALETTE.wood, x, y + 0.21, z, yaw);
      } else if (id === 'box-a') {
        addCrate(batch, x, y, z, paletteColor(mesh.palette));
      } else if (id === 'streetlight') {
        batch.cylinder(0.06, 0.08, 2.8, 8, PALETTE.slate, x, y + 1.4, z);
        batch.box(0.08, 0.08, 0.55, PALETTE.slate, x, y + 2.72, z + 0.2, yaw);
        const headMat = toonMaterial(PALETTE.ochre, PALETTE.terracotta);
        headMat.emissiveIntensity = 0;
        const head = makeMesh(new CylinderGeometry(0.12, 0.14, 0.18, 8), PALETTE.ochre);
        head.material = headMat;
        head.position.set(x, y + 2.58, z + 0.42);
        tagLamp(head);
        propRoot.add(head);
        lamps.push(head);
      } else if (id === 'chopstick') {
        batch.box(0.08, 0.05, 0.5, paletteColor(mesh.palette), x, y, z, yaw);
      } else {
        const radius = id === 'cup-tea' ? 0.1 : 0.16;
        const height = id === 'cup-tea' ? 0.22 : 0.2;
        batch.cylinder(radius * 0.9, radius, height, 10, paletteColor(mesh.palette), x, y + height / 2, z);
      }
    }
    batch.flush(propRoot);
  }
  spawnAllProps();

  const contacts: ContactSpot[] = [{ x: 19.2, z: -3.55, w: 1.5, d: 0.55, yaw: 0.35 }];
  for (const mesh of propSwaps) {
    const footprint = CONTACT_FOOTPRINTS[mesh.asset ?? ''];
    if (!footprint) continue;
    contacts.push({
      x: mesh.position[0],
      z: mesh.position[2],
      w: footprint.w,
      d: footprint.d,
      yaw: mesh.yaw,
      round: footprint.round,
    });
  }
  addGroundDecals(group, contacts);

  const lanterns = lamps.filter(lamp => lamp.userData.lantern);
  let elapsed = 0;
  let indoors = false;
  let glowLevel = 0;

  const signs = makeSignLayer(overlay, world.signs ?? []);
  const signScratch = new Vector3();
  const interiors = new Map<string, number>();

  return {
    group,
    volumes,
    signs,
    lamps,
    skyline: street.skyline,
    setDayTone(palette) {
      street.skyline.setTone(palette.fog, palette.skylineLit);
      glowLevel = palette.windowGlow;
      if (windowGlow) {
        (windowGlow.material as MeshBasicMaterial).opacity = glowLevel;
        windowGlow.visible = glowLevel > 0.02 && !indoors;
      }
    },
    setInterior(player, dt) {
      let anyInside = false;
      for (const volume of volumes) {
        const inside = player.x > volume.minX && player.x < volume.maxX
          && player.z > volume.minZ && player.z < volume.maxZ;
        if (inside) anyInside = true;
        const current = interiors.get(volume.id) ?? 1;
        const target = inside ? 0 : 1;
        const next = current + (target - current) * Math.min(1, dt / 0.15);
        interiors.set(volume.id, next);
        for (const roof of volume.roof) {
          roof.traverse(object => {
            if (!(object instanceof Mesh)) return;
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            for (const material of materials) {
              if (!('opacity' in material)) continue;
              material.transparent = next < 0.99;
              material.opacity = next;
              material.depthWrite = next > 0.2;
            }
          });
          roof.visible = next > 0.02;
        }
      }
      indoors = anyInside;
      if (windowGlow) windowGlow.visible = glowLevel > 0.02 && !indoors;
    },
    projectSigns(camera, width, height) {
      const ranked = (world.signs ?? []).map((sign, index) => {
        signScratch.set(sign.position[0], sign.position[1], sign.position[2]);
        const distance = camera.position.distanceTo(signScratch);
        return { sign, index, distance };
      }).sort((a, b) => a.distance - b.distance);
      const visible = new Set(
        ranked
          .filter(item => item.distance <= SIGN_MAX_DISTANCE)
          .slice(0, SIGN_MAX_VISIBLE)
          .map(item => item.index),
      );
      for (const { sign, index, distance } of ranked) {
        const el = signs[index];
        signScratch.set(sign.position[0], sign.position[1], sign.position[2]).project(camera);
        const onScreen = signScratch.z >= -1 && signScratch.z <= 1
          && signScratch.x >= -1.1 && signScratch.x <= 1.1
          && signScratch.y >= -1.1 && signScratch.y <= 1.1;
        const show = visible.has(index) && onScreen;
        el.classList.toggle('off', !show);
        if (!show) continue;
        el.style.left = `${(signScratch.x * 0.5 + 0.5) * width}px`;
        el.style.top = `${(-signScratch.y * 0.5 + 0.5) * height}px`;
        const size = distance <= SIGN_NEAR_DISTANCE ? 32 : Math.max(18, 48 - distance * 1.6);
        el.style.fontSize = `${Math.min(48, size)}px`;
      }
    },
    refreshProps() {
      spawnAllProps();
    },
    update(dt) {
      elapsed += dt;
      tickSteam(steam, dt);
      tickLanterns(lanterns, elapsed);
    },
  };
}

export type DistrictHandle = ReturnType<typeof buildDistrict>;
