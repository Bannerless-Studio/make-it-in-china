import {
  BackSide,
  BufferGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BUILDINGS } from './buildings';
import {
  DECAL_CONTACT,
  DECAL_DOORWAY,
  DECAL_IRON,
  DECAL_SHADE,
  DECAL_WEAR,
  PALETTE,
  SKYLINE_FAR,
  SKYLINE_NEAR,
  SKYLINE_SATURATION,
  SKYLINE_TINT,
} from './constants';
import { GeomBatch } from './geom';
import { addPlanter, addTree } from './props';
import { makeMesh, toonMaterial } from './toon';

export const ROAD_COLOR = 0xa9977c;
export const PAVING_COLOR = 0xd8cab0;
export const KERB_COLOR = 0xbfb096;

export const CROSSING_X = -8;
export const CROSSING_HALF = 2.2;
export const ROAD_HALF = 4;
export const KERB_Z = 4.2;

export interface ContactSpot {
  x: number;
  z: number;
  w: number;
  d: number;
  yaw?: number;
  round?: boolean;
  alpha?: number;
}

export interface DoorFront {
  id: string;
  x: number;
  z: number;
  kerbZ: number | null;
}

export const DOOR_FRONTS: DoorFront[] = [
  { id: 'room', x: -24, z: -6.1, kerbZ: -KERB_Z },
  { id: 'noodle', x: -8, z: -6.1, kerbZ: -KERB_Z },
  { id: 'fruit', x: 8, z: -7.4, kerbZ: -KERB_Z },
  { id: 'shop', x: 22, z: -6.1, kerbZ: -KERB_Z },
  { id: 'bus', x: -24, z: 7.3, kerbZ: KERB_Z },
  { id: 'warehouse', x: -8, z: 6.1, kerbZ: KERB_Z },
  { id: 'tea', x: 8, z: 6.1, kerbZ: KERB_Z },
  { id: 'gate', x: 26.6, z: 0, kerbZ: null },
];

export const DRAINS: Array<[number, number]> = [
  [-18, 3.9],
  [-6, 3.9],
  [6, 3.9],
  [18, 3.9],
  [-21, -3.9],
  [-3, -3.9],
  [11, -3.9],
  [21, -3.9],
];

export const MANHOLES: Array<[number, number]> = [
  [-15.5, -1.7],
  [1.5, 1.8],
  [17.5, -1.4],
];

function hash(i: number): number {
  const value = Math.sin(i * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function tiledPaving(): Mesh {
  const tiles: BufferGeometry[] = [];
  const colors: number[] = [];
  const base = new Color(PAVING_COLOR);
  const shade = new Color();
  let index = 0;
  for (const z0 of [-8, 4.4]) {
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 58; column += 1) {
        const tile = new PlaneGeometry(0.94, 1.14);
        tile.rotateX(-Math.PI / 2);
        tile.translate(-28.5 + column, 0.015, z0 + 0.6 + row * 1.2);
        tiles.push(tile);
        const jitter = 0.92 + hash(index) * 0.16;
        shade.copy(base).multiplyScalar(jitter);
        for (let vertex = 0; vertex < 4; vertex += 1) colors.push(shade.r, shade.g, shade.b);
        index += 1;
      }
    }
  }
  const merged = mergeGeometries(tiles, false);
  for (const tile of tiles) tile.dispose();
  if (!merged) throw new Error('paving merge failed');
  merged.setAttribute('color', new Float32BufferAttribute(colors, 3));
  const mesh = makeMesh(merged, 0xffffff);
  (mesh.material as MeshToonMaterial).vertexColors = true;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

export interface Sky {
  mesh: Mesh;
  setColors(top: number, bottom: number): void;
}

export function createSky(parent: Object3D): Sky {
  const material = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new Color(0xb8d3e8) },
      bottomColor: { value: new Color(0xdce9e7) },
    },
    vertexShader: `
varying float vHeight;
void main() {
  vec4 world = modelMatrix * vec4( position, 1.0 );
  vHeight = normalize( world.xyz ).y;
  gl_Position = projectionMatrix * viewMatrix * world;
}`,
    fragmentShader: `
uniform vec3 topColor;
uniform vec3 bottomColor;
varying float vHeight;
void main() {
  float t = clamp( ( vHeight + 0.12 ) / 0.62, 0.0, 1.0 );
  gl_FragColor = vec4( mix( bottomColor, topColor, t * t ), 1.0 );
}`,
  });
  const mesh = new Mesh(new SphereGeometry(95, 24, 16), material);
  mesh.name = 'sky';
  mesh.renderOrder = -20;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return {
    mesh,
    setColors(top, bottom) {
      (material.uniforms.topColor.value as Color).setHex(top);
      (material.uniforms.bottomColor.value as Color).setHex(bottom);
    },
  };
}

const _hsl = { h: 0, s: 0, l: 0 };

export function fogTintedGrey(base: number, fog: number, mix = SKYLINE_TINT): Color {
  const color = new Color(base).lerp(new Color(fog), mix);
  color.getHSL(_hsl);
  color.setHSL(_hsl.h, _hsl.s * SKYLINE_SATURATION, _hsl.l);
  return color;
}

export interface Skyline {
  near: Mesh;
  far: Mesh;
  windows: Mesh;
  setTone(fog: number, lit: number): void;
}

export function createSkyline(parent: Object3D): Skyline {
  const nearBatch = new GeomBatch();
  const farBatch = new GeomBatch();
  const litQuads: BufferGeometry[] = [];

  const addLitWindows = (
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    facing: number,
    seed: number,
  ): void => {
    const rows = Math.max(1, Math.floor(h / 2.4));
    const columns = Math.max(1, Math.floor(w / 1.3));
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        if (hash(seed * 31 + row * 7 + column * 3) < 0.62) continue;
        const quad = new PlaneGeometry(0.34, 0.44);
        if (facing !== 0) quad.rotateY(facing);
        const px = facing === 0
          ? x - w / 2 + 0.65 + column * 1.3
          : x + (facing > 0 ? 1 : -1) * 0.02;
        const pz = facing === 0
          ? z + 1.15
          : z - w / 2 + 0.65 + column * 1.3;
        quad.translate(px, y - h / 2 + 1.4 + row * 2.4, pz);
        litQuads.push(quad);
      }
    }
  };

  const row = (z: number, seed: number) => {
    let x = -46;
    let i = 0;
    while (x < 46) {
      const w = 2.4 + ((i * 17 + seed) % 5) * 0.55;
      const h = 6.5 + ((i * 13 + seed * 3) % 8) * 1.6;
      const d = 2.2 + (i % 3) * 0.4;
      const batch = i % 2 ? nearBatch : farBatch;
      batch.box(w, h, d, 0xffffff, x, h / 2 - 0.2, z);
      if (Math.abs(x) < 30) addLitWindows(w, h, x, h / 2 - 0.2, z + (z < 0 ? d / 2 : -d / 2), 0, seed + i);
      x += w + 0.8;
      i += 1;
    }
  };
  row(-34, 2);
  row(34, 5);
  let x = -40;
  let i = 0;
  while (x < 40) {
    const w = 2.2 + (i % 4) * 0.5;
    const h = 6.2 + (i % 7) * 1.4;
    (i % 2 ? nearBatch : farBatch).box(w, h, 2.0, 0xffffff, -38, h / 2 - 0.2, x);
    (i % 2 ? farBatch : nearBatch).box(w, h * 0.85, 2.0, 0xffffff, 38, h * 0.42, x);
    x += w + 1.1;
    i += 1;
  }

  const flat = (batch: GeomBatch, name: string): Mesh => {
    const holder = new Group();
    const meshes = batch.flush(holder, { outline: false, receiveShadow: false, castShadow: false });
    const geometries = meshes.map(mesh => mesh.geometry);
    const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
    if (!merged) throw new Error('skyline merge failed');
    const mesh = new Mesh(merged, new MeshBasicMaterial({ color: 0x8b949c, fog: true }));
    mesh.name = name;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    parent.add(mesh);
    return mesh;
  };

  const near = flat(nearBatch, 'skyline-near');
  const far = flat(farBatch, 'skyline-far');

  const litMerged = litQuads.length ? mergeGeometries(litQuads, false) : null;
  for (const quad of litQuads) quad.dispose();
  const windows = new Mesh(
    litMerged ?? new PlaneGeometry(0.01, 0.01),
    new MeshBasicMaterial({
      color: PALETTE.ochre,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
      side: DoubleSide,
    }),
  );
  windows.name = 'skyline-windows';
  windows.castShadow = false;
  windows.receiveShadow = false;
  windows.visible = false;
  windows.renderOrder = 1;
  parent.add(windows);

  return {
    near,
    far,
    windows,
    setTone(fog, lit) {
      (near.material as MeshBasicMaterial).color.copy(fogTintedGrey(SKYLINE_NEAR, fog));
      (far.material as MeshBasicMaterial).color.copy(fogTintedGrey(SKYLINE_FAR, fog));
      const material = windows.material as MeshBasicMaterial;
      material.opacity = lit;
      windows.visible = lit > 0.02;
    },
  };
}

class DecalBatch {
  private parts: BufferGeometry[] = [];
  private colors: number[] = [];

  private push(geometry: BufferGeometry, color: number, alpha: number): void {
    const tint = new Color(color);
    const count = geometry.getAttribute('position').count;
    for (let vertex = 0; vertex < count; vertex += 1) {
      this.colors.push(tint.r, tint.g, tint.b, alpha);
    }
    this.parts.push(geometry);
  }

  rect(
    w: number,
    d: number,
    x: number,
    z: number,
    color: number,
    alpha: number,
    yaw = 0,
    y = 0.022,
  ): this {
    const quad = new PlaneGeometry(w, d);
    quad.rotateX(-Math.PI / 2);
    if (yaw) quad.rotateY(yaw);
    quad.translate(x, y, z);
    this.push(quad, color, alpha);
    return this;
  }

  disc(radius: number, x: number, z: number, color: number, alpha: number, y = 0.024, segments = 14): this {
    const circle = new CircleGeometry(radius, segments);
    circle.rotateX(-Math.PI / 2);
    circle.translate(x, y, z);
    this.push(circle, color, alpha);
    return this;
  }

  flush(parent: Object3D, name: string): Mesh | null {
    if (!this.parts.length) return null;
    const merged = this.parts.length === 1 ? this.parts[0] : mergeGeometries(this.parts, false);
    if (this.parts.length > 1) for (const part of this.parts) part.dispose();
    if (!merged) return null;
    merged.setAttribute('color', new Float32BufferAttribute(this.colors, 4));
    const mesh = new Mesh(merged, new MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    }));
    mesh.name = name;
    mesh.renderOrder = -3;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    parent.add(mesh);
    this.parts = [];
    this.colors = [];
    return mesh;
  }
}

function roadPaint(parent: Object3D): Mesh {
  const parts: BufferGeometry[] = [];
  const bar = (w: number, d: number, x: number, z: number) => {
    const quad = new PlaneGeometry(w, d);
    quad.rotateX(-Math.PI / 2);
    quad.translate(x, 0.028, z);
    parts.push(quad);
  };
  for (let x = -26; x <= 26; x += 4) {
    if (Math.abs(x - CROSSING_X) <= CROSSING_HALF + 0.6) continue;
    bar(1.6, 0.14, x, 0);
  }
  for (let i = 0; i < 6; i += 1) {
    bar(0.42, ROAD_HALF * 2 - 0.5, CROSSING_X - 1.75 + i * 0.7, 0);
  }
  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!merged) throw new Error('road paint merge failed');
  const mesh = new Mesh(merged, toonMaterial(PALETTE.paper));
  mesh.name = 'road-paint';
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.renderOrder = -4;
  parent.add(mesh);
  return mesh;
}

function kerbRamps(batch: GeomBatch): void {
  for (const door of DOOR_FRONTS) {
    if (door.kerbZ === null) continue;
    const sign = door.kerbZ > 0 ? -1 : 1;
    const steps: Array<[number, number]> = [[0.11, 0.055], [0.08, 0.04], [0.05, 0.025]];
    steps.forEach(([height, y], index) => {
      batch.box(2.0, height, 0.2, KERB_COLOR, door.x, y, door.kerbZ! + sign * (0.1 + index * 0.2));
    });
  }
}

export function addGroundDecals(parent: Object3D, contacts: ContactSpot[]): Mesh | null {
  const decals = new DecalBatch();

  for (const z of [-1.6, 1.6]) {
    decals.rect(56, 1.5, 0, z, 0x2b2a26, DECAL_WEAR, 0, 0.02);
  }
  decals.rect(4.8, ROAD_HALF * 2, CROSSING_X, 0, 0x2b2a26, DECAL_WEAR * 0.8, 0, 0.02);

  for (const door of DOOR_FRONTS) {
    decals.rect(3.0, 1.9, door.x, door.z, 0x2b2a26, DECAL_DOORWAY, 0, 0.021);
    if (door.kerbZ !== null) {
      const sign = door.kerbZ > 0 ? -1 : 1;
      decals.rect(2.4, 1.4, door.x, door.kerbZ + sign * 0.9, 0x2b2a26, DECAL_WEAR, 0, 0.021);
    }
  }

  const band = 0.9;
  for (const building of BUILDINGS) {
    const hx = building.sx / 2;
    const hz = building.sz / 2;
    const strips: Array<[number, number, number, number]> = [
      [building.sx + band * 2, band, building.cx, building.cz - hz - band / 2],
      [building.sx + band * 2, band, building.cx, building.cz + hz + band / 2],
      [band, building.sz, building.cx - hx - band / 2, building.cz],
      [band, building.sz, building.cx + hx + band / 2, building.cz],
    ];
    for (const [w, d, x, z] of strips) {
      decals.rect(w, d, x, z, 0x2b2a26, DECAL_SHADE, 0, 0.019);
    }
  }

  for (const [x, z] of MANHOLES) {
    decals.disc(0.36, x, z, 0x3d3b36, DECAL_IRON, 0.025);
    decals.disc(0.24, x, z, 0x2b2a26, DECAL_IRON * 0.7, 0.026, 12);
  }

  for (const [x, z] of DRAINS) {
    decals.rect(0.72, 0.36, x, z, 0x3d3b36, DECAL_IRON, 0, 0.025);
    for (let i = 0; i < 3; i += 1) {
      decals.rect(0.6, 0.05, x, z - 0.1 + i * 0.1, 0x171717, DECAL_IRON, 0, 0.026);
    }
  }

  for (const spot of contacts) {
    const alpha = spot.alpha ?? DECAL_CONTACT;
    if (spot.round) decals.disc(Math.max(spot.w, spot.d) / 2, spot.x, spot.z, 0x2b2a26, alpha, 0.023);
    else decals.rect(spot.w, spot.d, spot.x, spot.z, 0x2b2a26, alpha, spot.yaw ?? 0, 0.023);
  }

  return decals.flush(parent, 'ground-decals');
}

export interface StreetHandle {
  skyline: Skyline;
}

export function buildStreet(parent: Group): StreetHandle {
  const ground = new GeomBatch();
  ground.box(60, 0.04, 40, 0xbfae92, 0, -0.02, 0);
  ground.flush(parent, { outline: false, castShadow: false });

  const road = new GeomBatch();
  road.box(58, 0.03, 8.0, ROAD_COLOR, 0, 0.01, 0);
  road.flush(parent, { outline: false, castShadow: false });

  const kerbs = new GeomBatch();
  for (const z of [-KERB_Z, KERB_Z]) {
    kerbs.box(58, 0.14, 0.4, KERB_COLOR, 0, 0.05, z);
  }
  kerbRamps(kerbs);
  kerbs.flush(parent, { outline: false });

  parent.add(tiledPaving());
  roadPaint(parent);

  const greenery = new GeomBatch();
  const hedgePosts: Array<[number, number, number, number]> = [
    [-29.2, 0, 1.2, 38],
    [29.2, 0, 1.2, 38],
    [0, -19.2, 56, 1.2],
    [0, 19.2, 56, 1.2],
  ];
  for (const [x, z, sx, sz] of hedgePosts) {
    greenery.box(sx, 0.55, sz, PALETTE.sage, x, 0.28, z);
    greenery.box(sx * 0.78, 0.32, sz * 0.78, PALETTE.olive, x, 0.7, z);
  }
  addPlanter(greenery, -18, -19.2, 2.4, 1.2);
  addPlanter(greenery, 18, 19.2, 2.4, 1.2);
  addPlanter(greenery, -6, -19.2, 2.4, 1.2);
  addPlanter(greenery, 6, 19.2, 2.4, 1.2);
  addTree(greenery, -27.4, -16.6, 1.05);
  addTree(greenery, 27.2, -16.4, 0.92);
  addTree(greenery, -27.2, 16.5, 1.1);
  addTree(greenery, 26.8, 16.2, 0.88);
  greenery.flush(parent);

  return { skyline: createSkyline(parent) };
}
