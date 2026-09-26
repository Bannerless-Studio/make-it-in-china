import {
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  Vector3,
} from 'three';
import { PALETTE } from './constants';
import { GeomBatch } from './geom';
import { makeMesh, toonMaterial } from './toon';

export function tagLamp(mesh: Mesh): Mesh {
  mesh.userData.lamp = true;
  return mesh;
}

export function highestMesh(root: Object3D): Mesh | null {
  let best: Mesh | null = null;
  let bestY = -Infinity;
  const world = new Vector3();
  root.traverse(object => {
    if (!(object instanceof Mesh) || object.name.endsWith('-outline')) return;
    object.getWorldPosition(world);
    if (world.y > bestY) {
      bestY = world.y;
      best = object;
    }
  });
  return best;
}

let lanternIndex = 0;

export function addLantern(batch: GeomBatch, parent: Object3D, x: number, y: number, z: number): Mesh {
  const glow = makeMesh(new SphereGeometry(0.2, 10, 8), PALETTE.ochre);
  const lampMat = toonMaterial(PALETTE.ochre, PALETTE.terracotta);
  lampMat.emissiveIntensity = 0;
  glow.material = lampMat;
  glow.position.set(x, y, z);
  glow.userData.lantern = { x, y, z, phase: (lanternIndex += 1) * 1.7 };
  tagLamp(glow);
  parent.add(glow);
  batch.cylinder(0.08, 0.1, 0.08, 8, PALETTE.wood, x, y + 0.22, z);
  batch.box(0.04, 0.14, 0.04, PALETTE.terracotta, x, y - 0.28, z);
  return glow;
}

export function lantern(parent: Object3D, x: number, y: number, z: number): Mesh {
  const batch = new GeomBatch();
  const glow = addLantern(batch, parent, x, y, z);
  batch.flush(parent);
  return glow;
}

export function lampPost(): Group {
  const group = new Group();
  const pole = makeMesh(new CylinderGeometry(0.06, 0.08, 2.8, 8), PALETTE.slate);
  pole.position.y = 1.4;
  const arm = makeMesh(new BoxGeometry(0.08, 0.08, 0.55), PALETTE.slate);
  arm.position.set(0, 2.72, 0.2);
  const head = makeMesh(new CylinderGeometry(0.12, 0.14, 0.18, 8), PALETTE.ochre);
  const headMat = toonMaterial(PALETTE.ochre, PALETTE.terracotta);
  headMat.emissiveIntensity = 0;
  head.material = headMat;
  head.position.set(0, 2.58, 0.42);
  tagLamp(head);
  group.add(pole, arm, head);
  return group;
}

export function benchMesh(): Group {
  const group = new Group();
  const batch = new GeomBatch();
  batch.box(1.6, 0.08, 0.42, PALETTE.wood, 0, 0.42, 0);
  batch.box(1.6, 0.32, 0.08, PALETTE.wood, 0, 0.62, -0.18);
  batch.box(0.08, 0.42, 0.42, PALETTE.wood, -0.7, 0.21, 0);
  batch.box(0.08, 0.42, 0.42, PALETTE.wood, 0.7, 0.21, 0);
  batch.flush(group);
  return group;
}

export function bushMesh(): Group {
  const group = new Group();
  const batch = new GeomBatch();
  batch.sphere(0.42, PALETTE.sage, 0, 0.45, 0, 8, 6);
  batch.sphere(0.28, PALETTE.olive, 0.22, 0.55, 0.08, 8, 6);
  batch.sphere(0.22, PALETTE.sage, -0.18, 0.62, -0.1, 8, 6);
  batch.flush(group);
  return group;
}

export function addTree(batch: GeomBatch, x: number, z: number, scale = 1): void {
  batch.cylinder(0.08 * scale, 0.12 * scale, 1.1 * scale, 8, PALETTE.wood, x, 0.55 * scale, z);
  batch.sphere(0.7 * scale, PALETTE.sage, x, 1.45 * scale, z, 8, 6);
  batch.sphere(0.45 * scale, PALETTE.olive, x + 0.35 * scale, 1.55 * scale, z + 0.1 * scale, 8, 6);
  batch.sphere(0.38 * scale, PALETTE.sage, x - 0.28 * scale, 1.7 * scale, z - 0.12 * scale, 8, 6);
}

export function tree(parent: Object3D, x: number, z: number, scale = 1): void {
  const batch = new GeomBatch();
  addTree(batch, x, z, scale);
  batch.flush(parent);
}

export function addPlanter(batch: GeomBatch, x: number, z: number, sx: number, sz: number): void {
  batch.box(sx, 0.55, sz, PALETTE.sage, x, 0.28, z);
  batch.box(sx * 0.72, 0.28, sz * 0.72, PALETTE.olive, x, 0.68, z);
}

export function planter(parent: Object3D, x: number, z: number, sx: number, sz: number): void {
  const batch = new GeomBatch();
  addPlanter(batch, x, z, sx, sz);
  batch.flush(parent);
}

export function bicycle(): Group {
  const group = new Group();
  const batch = new GeomBatch();
  const wheel = (x: number) => {
    batch.cylinder(0.32, 0.32, 0.05, 12, PALETTE.ink, x, 0.32, 0, 0, Math.PI / 2);
    batch.cylinder(0.06, 0.06, 0.06, 8, PALETTE.slate, x, 0.32, 0, 0, Math.PI / 2);
  };
  wheel(-0.45);
  wheel(0.5);
  batch.box(0.9, 0.05, 0.05, PALETTE.slate, 0.05, 0.55, 0);
  batch.box(0.05, 0.42, 0.05, PALETTE.slate, -0.2, 0.52, 0);
  batch.box(0.05, 0.38, 0.05, PALETTE.slate, 0.35, 0.5, 0);
  batch.box(0.22, 0.05, 0.12, PALETTE.terracotta, -0.15, 0.78, 0);
  batch.box(0.28, 0.04, 0.04, PALETTE.slate, 0.48, 0.78, 0);
  batch.flush(group);
  return group;
}

export function addBed(batch: GeomBatch, x: number, z: number): void {
  batch.box(2.1, 0.38, 1.15, PALETTE.wood, x, 0.22, z);
  batch.box(2.0, 0.14, 1.05, PALETTE.slate, x, 0.46, z);
  batch.box(0.5, 0.16, 0.9, PALETTE.paper, x - 0.7, 0.58, z);
}

export function addTable(batch: GeomBatch, x: number, z: number, w = 1.2, d = 0.7): void {
  batch.box(w, 0.08, d, PALETTE.wood, x, 0.7, z);
  for (const dx of [-w * 0.4, w * 0.4]) {
    for (const dz of [-d * 0.35, d * 0.35]) {
      batch.box(0.07, 0.66, 0.07, PALETTE.wood, x + dx, 0.33, z + dz);
    }
  }
}

export function addChair(batch: GeomBatch, x: number, z: number, yaw = 0): void {
  batch.box(0.42, 0.08, 0.42, PALETTE.wood, x, 0.42, z, yaw);
  batch.box(0.42, 0.4, 0.07, PALETTE.wood, x, 0.64, z, yaw);
}

export function addRoundTable(batch: GeomBatch, x: number, z: number): void {
  batch.cylinder(0.62, 0.62, 0.08, 12, PALETTE.wood, x, 0.68, z);
  batch.cylinder(0.08, 0.1, 0.64, 8, PALETTE.wood, x, 0.32, z);
}

export function addShelf(batch: GeomBatch, x: number, z: number, yaw = 0): void {
  batch.box(1.8, 1.7, 0.38, PALETTE.wood, x, 0.85, z, yaw);
  batch.box(1.7, 0.06, 0.36, PALETTE.sage, x, 0.45, z, yaw);
  batch.box(1.7, 0.06, 0.36, PALETTE.sage, x, 0.9, z, yaw);
  batch.box(1.7, 0.06, 0.36, PALETTE.ochre, x, 1.35, z, yaw);
}

export function addCounter(batch: GeomBatch, x: number, z: number, w: number, d: number): void {
  batch.box(w, 0.9, d, PALETTE.wood, x, 0.45, z);
  batch.box(w + 0.08, 0.06, d + 0.08, PALETTE.umber, x, 0.92, z);
}

export function addCrate(batch: GeomBatch, x: number, y: number, z: number, color: number = PALETTE.wood): void {
  batch.box(0.7, 0.5, 0.55, color, x, y + 0.25, z);
  batch.box(0.74, 0.06, 0.59, PALETTE.umber, x, y + 0.52, z);
}

export function addApples(batch: GeomBatch, x: number, y: number, z: number): void {
  const colors = [PALETTE.terracotta, PALETTE.ochre, PALETTE.clay, PALETTE.olive];
  let i = 0;
  for (const dx of [-0.18, 0, 0.18]) {
    for (const dz of [-0.12, 0.12]) {
      batch.sphere(0.08, colors[i % colors.length], x + dx, y, z + dz, 8, 6);
      i += 1;
    }
  }
}

export function makeSteam(parent: Object3D, x: number, y: number, z: number, count = 6): Mesh[] {
  const meshes: Mesh[] = [];
  for (let i = 0; i < count; i += 1) {
    const puff = new Mesh(
      new PlaneGeometry(0.2, 0.32),
      new MeshBasicMaterial({
        color: PALETTE.paper,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        fog: true,
        side: DoubleSide,
      }),
    );
    puff.position.set(x, y, z);
    puff.castShadow = false;
    puff.receiveShadow = false;
    puff.renderOrder = 2;
    puff.userData.steam = { phase: i * 0.85, x, y, z };
    parent.add(puff);
    meshes.push(puff);
  }
  return meshes;
}

export function tickLanterns(lanterns: Mesh[], elapsed: number): void {
  for (const lantern of lanterns) {
    const anchor = lantern.userData.lantern as
      | { x: number; y: number; z: number; phase: number }
      | undefined;
    if (!anchor) continue;
    const swing = Math.sin(elapsed * 0.9 + anchor.phase);
    lantern.position.set(
      anchor.x + swing * 0.035,
      anchor.y - Math.abs(swing) * 0.006,
      anchor.z + Math.cos(elapsed * 0.62 + anchor.phase) * 0.018,
    );
    lantern.rotation.z = swing * 0.07;
  }
}

export function tickSteam(meshes: Mesh[], dt: number): void {
  for (const mesh of meshes) {
    const steam = mesh.userData.steam as { phase: number; x: number; y: number; z: number };
    steam.phase += dt * 0.65;
    const t = steam.phase % 1;
    mesh.position.set(steam.x + Math.sin(steam.phase * 4) * 0.1, steam.y + t * 0.95, steam.z);
    const material = mesh.material;
    if (material instanceof MeshBasicMaterial) material.opacity = 0.28 * (1 - t);
  }
}

export function fallbackProp(asset: string, color: number): Object3D {
  if (asset === 'streetlight') return lampPost();
  if (asset === 'bench') return benchMesh();
  if (asset === 'bush') return bushMesh();
  if (asset === 'box-a') {
    const group = new Group();
    const batch = new GeomBatch();
    addCrate(batch, 0, 0, 0, color);
    batch.flush(group);
    return group;
  }
  if (asset === 'awning') {
    const group = new Group();
    const batch = new GeomBatch();
    batch.box(3.4, 0.08, 1.1, PALETTE.ochre, 0, 0.2, 0);
    batch.box(3.4, 0.08, 1.1, PALETTE.terracotta, 0, 0.12, 0.02);
    batch.flush(group);
    return group;
  }
  const limits: Record<string, Vector3> = {
    'bowl-broth': new Vector3(0.32, 0.2, 0.32),
    chopstick: new Vector3(0.08, 0.05, 0.5),
    'cup-tea': new Vector3(0.22, 0.28, 0.22),
    steamer: new Vector3(0.4, 0.32, 0.4),
    pot: new Vector3(0.4, 0.34, 0.4),
  };
  const size = limits[asset] ?? new Vector3(0.6, 0.6, 0.6);
  if (asset === 'bowl-broth' || asset === 'cup-tea' || asset === 'pot' || asset === 'steamer') {
    const dish = makeMesh(new CylinderGeometry(size.x * 0.45, size.x * 0.5, size.y, 10), color);
    dish.position.y = size.y / 2;
    return dish;
  }
  const box = makeMesh(new BoxGeometry(size.x, size.y, size.z), color);
  box.position.y = size.y / 2;
  return box;
}
