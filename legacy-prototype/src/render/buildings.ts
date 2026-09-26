import { Group, Mesh, Object3D } from 'three';
import { DOOR_HEIGHT, DOOR_WIDTH, PALETTE, ROOF_LIP, WALL_HEIGHT } from './constants';
import { GeomBatch } from './geom';
import {
  addLantern,
  addApples,
  addBed,
  addChair,
  addCounter,
  addCrate,
  addRoundTable,
  addShelf,
  addTable,
  makeSteam,
} from './props';

export interface BuildingParts {
  fade: Object3D[];
  lamps: Mesh[];
  steam: Mesh[];
}

type Door = 'north' | 'south' | 'east' | 'west';

const LOWER = 1.55;
const SPLIT = LOWER;

function doorJambs(sx: number, sz: number, door: Door): { length: number; jamb: number } {
  const length = door === 'north' || door === 'south' ? sx : sz;
  return { length, jamb: length / 2 - DOOR_WIDTH / 2 };
}

function wallExtents(cx: number, cz: number, sx: number, sz: number) {
  return {
    northZ: cz - sz / 2,
    southZ: cz + sz / 2,
    westX: cx - sx / 2,
    eastX: cx + sx / 2,
  };
}

type Facing = 'north' | 'south' | 'east' | 'west';

export interface WindowGlow {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  axis: 'x' | 'z';
}

const glows: WindowGlow[] = [];

export function takeWindowGlows(): WindowGlow[] {
  const collected = glows.slice();
  glows.length = 0;
  return collected;
}

function addGlow(x: number, y: number, z: number, w: number, h: number, facing: Facing): void {
  const flat = facing === 'north' || facing === 'south';
  const sign = facing === 'south' || facing === 'east' ? 1 : -1;
  glows.push({
    x: flat ? x : x + sign * 0.05,
    y,
    z: flat ? z + sign * 0.05 : z,
    w: w * 0.88,
    h: h * 0.82,
    axis: flat ? 'z' : 'x',
  });
}

function addWindow(
  batch: GeomBatch,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  facing: Facing,
  pane: number = PALETTE.paper,
  frame: number = PALETTE.wood,
): void {
  const out = 0.18;
  const flat = facing === 'north' || facing === 'south';
  const sign = facing === 'south' || facing === 'east' ? 1 : -1;
  const px = flat ? x : x + out * sign;
  const pz = flat ? z + out * sign : z;
  const fw = flat ? w : 0.06;
  const fd = flat ? 0.06 : w;
  addGlow(px, y, pz, w, h, facing);
  batch.box(fw, h, fd, pane, px, y, pz);
  batch.box(flat ? w + 0.16 : 0.08, 0.1, flat ? 0.08 : w + 0.16, frame, px, y + h / 2 + 0.05, pz);
  batch.box(flat ? w + 0.16 : 0.08, 0.1, flat ? 0.08 : w + 0.16, frame, px, y - h / 2 - 0.05, pz);
  batch.box(flat ? 0.08 : 0.08, h, flat ? 0.08 : 0.08, frame, px, y, pz);
}

function shell(
  staticBatch: GeomBatch,
  fadeBatch: GeomBatch,
  cx: number,
  cz: number,
  sx: number,
  sz: number,
  wall: number,
  trim: number,
  door: Door,
    windowGap = false,
): void {
  const t = 0.3;
  const { northZ, southZ, westX, eastX } = wallExtents(cx, cz, sx, sz);
  staticBatch.box(sx - 0.04, 0.06, sz - 0.04, PALETTE.paving, cx, 0.03, cz);
  const { jamb } = doorJambs(sx, sz, door);
  const lower = (x: number, z: number, w: number, d: number, color = wall) => {
    staticBatch.box(w, LOWER, d, color, x, LOWER / 2, z);
  };
  const upper = (x: number, z: number, w: number, d: number, color = wall) => {
    fadeBatch.box(w, WALL_HEIGHT - SPLIT, d, color, x, SPLIT + (WALL_HEIGHT - SPLIT) / 2, z);
  };
  const splitWall = (x: number, z: number, w: number, d: number, color = wall) => {
    lower(x, z, w, d, color);
    upper(x, z, w, d, color);
  };

  if (door !== 'north') splitWall(cx, northZ, sx, t);
  else {
    splitWall(cx - (DOOR_WIDTH / 2 + jamb / 2), northZ, jamb, t);
    splitWall(cx + (DOOR_WIDTH / 2 + jamb / 2), northZ, jamb, t);
    fadeBatch.box(DOOR_WIDTH, WALL_HEIGHT - DOOR_HEIGHT, t, wall, cx, DOOR_HEIGHT + (WALL_HEIGHT - DOOR_HEIGHT) / 2, northZ);
  }
  if (door !== 'south') splitWall(cx, southZ, sx, t);
  else {
    splitWall(cx - (DOOR_WIDTH / 2 + jamb / 2), southZ, jamb, t);
    splitWall(cx + (DOOR_WIDTH / 2 + jamb / 2), southZ, jamb, t);
    fadeBatch.box(DOOR_WIDTH, WALL_HEIGHT - DOOR_HEIGHT, t, wall, cx, DOOR_HEIGHT + (WALL_HEIGHT - DOOR_HEIGHT) / 2, southZ);
    if (windowGap) {
      addWindow(fadeBatch, cx - sx * 0.28, 2.2, southZ, 1.9, 1.1, 'south');
      staticBatch.box(2.1, 0.12, t + 0.24, PALETTE.wood, cx - sx * 0.28, 1.55, southZ);
    }
  }
  if (door !== 'west') splitWall(westX, cz, t, sz);
  else {
    splitWall(westX, cz - (DOOR_WIDTH / 2 + jamb / 2), t, jamb);
    splitWall(westX, cz + (DOOR_WIDTH / 2 + jamb / 2), t, jamb);
    fadeBatch.box(t, WALL_HEIGHT - DOOR_HEIGHT, DOOR_WIDTH, wall, westX, DOOR_HEIGHT + (WALL_HEIGHT - DOOR_HEIGHT) / 2, cz);
  }
  if (door !== 'east') splitWall(eastX, cz, t, sz);
  else {
    splitWall(eastX, cz - (DOOR_WIDTH / 2 + jamb / 2), t, jamb);
    splitWall(eastX, cz + (DOOR_WIDTH / 2 + jamb / 2), t, jamb);
    fadeBatch.box(t, WALL_HEIGHT - DOOR_HEIGHT, DOOR_WIDTH, wall, eastX, DOOR_HEIGHT + (WALL_HEIGHT - DOOR_HEIGHT) / 2, cz);
  }

  const doorZ = door === 'south' ? southZ : door === 'north' ? northZ : cz;
  const doorX = door === 'east' ? eastX : door === 'west' ? westX : cx;
  const frameW = door === 'east' || door === 'west' ? t + 0.1 : DOOR_WIDTH + 0.22;
  const frameD = door === 'east' || door === 'west' ? DOOR_WIDTH + 0.22 : t + 0.1;
  staticBatch.box(frameW, 0.16, frameD, trim, doorX, DOOR_HEIGHT + 0.08, doorZ);
  if (door === 'south' || door === 'north') {
    staticBatch.box(0.12, DOOR_HEIGHT, 0.12, PALETTE.wood, doorX - DOOR_WIDTH / 2, DOOR_HEIGHT / 2, doorZ);
    staticBatch.box(0.12, DOOR_HEIGHT, 0.12, PALETTE.wood, doorX + DOOR_WIDTH / 2, DOOR_HEIGHT / 2, doorZ);
  } else {
    staticBatch.box(0.12, DOOR_HEIGHT, 0.12, PALETTE.wood, doorX, DOOR_HEIGHT / 2, doorZ - DOOR_WIDTH / 2);
    staticBatch.box(0.12, DOOR_HEIGHT, 0.12, PALETTE.wood, doorX, DOOR_HEIGHT / 2, doorZ + DOOR_WIDTH / 2);
  }
  const boardZ = doorZ + (door === 'south' ? 0.22 : door === 'north' ? -0.22 : 0);
  const boardX = door === 'east' ? doorX - 0.22 : door === 'west' ? doorX + 0.22 : doorX;
  staticBatch.box(Math.min(2.4, sx * 0.42), 0.55, 0.1, PALETTE.wood, boardX, 2.55, boardZ);
}

function tiledRoof(fade: GeomBatch, cx: number, cz: number, sx: number, sz: number, color: number, peak = 0.55): void {
  const steps = 4;
  for (let i = 0; i < steps; i += 1) {
    const t = i / steps;
    fade.box(
      sx + ROOF_LIP - t * 1.4,
      0.1,
      sz + ROOF_LIP - t * 1.4,
      color,
      cx,
      WALL_HEIGHT + 0.12 + i * 0.14,
      cz,
    );
  }
  fade.box(sx * 0.35, 0.16, sz * 0.35, color, cx, WALL_HEIGHT + peak, cz);
}

export function rentedRoom(parent: Group, cx: number, cz: number, shared?: GeomBatch): BuildingParts {
  const fadeGroup = new Group();
  const staticBatch = shared ?? new GeomBatch();
  const fadeBatch = new GeomBatch();
  shell(staticBatch, fadeBatch, cx, cz, 8, 8, PALETTE.plaster, PALETTE.slate, 'south');
  const lx = cx - 2.6;
  staticBatch.box(2.9, 0.1, 1.0, PALETTE.slate, cx, 2.95, cz + 4.25);
  staticBatch.box(0.1, 0.5, 0.1, PALETTE.wood, cx - 1.3, 2.68, cz + 4.6);
  staticBatch.box(0.1, 0.5, 0.1, PALETTE.wood, cx + 1.3, 2.68, cz + 4.6);
  staticBatch.box(0.08, 0.5, 0.08, PALETTE.wood, lx - 1.05, 1.9, cz + 4.5);
  staticBatch.box(0.08, 0.5, 0.08, PALETTE.wood, lx + 1.05, 1.9, cz + 4.5);
  staticBatch.box(2.2, 0.04, 0.04, PALETTE.ink, lx, 2.05, cz + 4.6);
  staticBatch.box(0.35, 0.45, 0.04, PALETTE.paper, lx - 0.55, 1.82, cz + 4.6);
  staticBatch.box(0.3, 0.5, 0.04, PALETTE.slate, lx, 1.8, cz + 4.6);
  staticBatch.box(0.28, 0.4, 0.04, PALETTE.terracotta, lx + 0.5, 1.85, cz + 4.6);
  addWindow(fadeBatch, cx + 2.5, 2.1, cz + 4, 1.2, 0.9, 'south', PALETTE.slate);
  fadeBatch.box(8.6, 0.22, 8.6, PALETTE.slate, cx, WALL_HEIGHT + 0.18, cz);
  fadeBatch.box(4.2, 0.16, 4.2, PALETTE.umber, cx, WALL_HEIGHT + 0.38, cz);
  addBed(staticBatch, cx - 2.1, cz - 1.4);
  addTable(staticBatch, cx + 2, cz, 1.1, 0.7);
  addChair(staticBatch, cx + 2, cz + 0.85, Math.PI);
  if (!shared) staticBatch.flush(parent, { doubleSide: true });
  fadeBatch.flush(fadeGroup, { doubleSide: true });
  parent.add(fadeGroup);
  return { fade: [fadeGroup], lamps: [], steam: [] };
}

export function noodleShop(parent: Group, cx: number, cz: number, shared?: GeomBatch): BuildingParts {
  const fadeGroup = new Group();
  const staticBatch = shared ?? new GeomBatch();
  const fadeBatch = new GeomBatch();
  const lamps: Mesh[] = [];
  shell(staticBatch, fadeBatch, cx, cz, 10, 8, PALETTE.plaster, PALETTE.terracotta, 'south');
  staticBatch.box(4.2, 0.08, 1.3, PALETTE.ochre, cx, 2.86, cz + 4.55);
  staticBatch.box(4.2, 0.08, 1.3, PALETTE.terracotta, cx, 2.78, cz + 4.6);
  for (const x of [-1.9, 1.9]) {
    staticBatch.box(0.08, 2.76, 0.08, PALETTE.wood, cx + x, 1.38, cz + 4.4);
  }
  addWindow(fadeBatch, cx - 3.4, 2.15, cz + 4, 1.6, 1.0, 'south');
  addWindow(fadeBatch, cx + 3.4, 2.15, cz + 4, 1.6, 1.0, 'south');
  tiledRoof(fadeBatch, cx, cz, 10, 8, PALETTE.terracotta, 0.62);
  fadeBatch.cylinder(0.16, 0.2, 0.7, 8, PALETTE.slate, cx + 3.2, WALL_HEIGHT + 0.7, cz - 1.4);
  addCounter(staticBatch, cx, cz - 2.6, 6.4, 1.0);
  addTable(staticBatch, cx - 2.6, cz + 0.4, 1.4, 1.4);
  addTable(staticBatch, cx + 2.4, cz + 0.4, 1.4, 1.4);
  lamps.push(addLantern(staticBatch, parent, cx - 1.6, 2.15, cz + 4.7));
  lamps.push(addLantern(staticBatch, parent, cx + 1.6, 2.15, cz + 4.7));
  if (!shared) staticBatch.flush(parent, { doubleSide: true });
  fadeBatch.flush(fadeGroup, { doubleSide: true });
  parent.add(fadeGroup);
  const steam = makeSteam(fadeGroup, cx + 3.2, WALL_HEIGHT + 1.05, cz - 1.4, 6);
  return { fade: [fadeGroup], lamps, steam };
}

export function fruitStall(parent: Group, cx: number, cz: number, shared?: GeomBatch): BuildingParts {
  const staticBatch = shared ?? new GeomBatch();
  staticBatch.box(6.4, 0.9, 1.6, PALETTE.wood, cx, 0.45, cz);
  for (const x of [-2.5, 2.5]) {
    for (const z of [-0.65, 0.65]) staticBatch.box(0.1, 2.45, 0.1, PALETTE.wood, cx + x, 1.22, cz + z);
  }
  const stripes = [PALETTE.ochre, PALETTE.paper, PALETTE.ochre, PALETTE.terracotta, PALETTE.ochre];
  stripes.forEach((color, index) => {
    staticBatch.box(6.9 / stripes.length, 0.08, 2.25, color, cx - 2.76 + index * 1.38, 2.5, cz);
  });
  staticBatch.box(1.15, 0.55, 0.85, PALETTE.clay, cx - 1.7, 1.15, cz + 0.12);
  staticBatch.box(1.15, 0.55, 0.85, PALETTE.terracotta, cx, 1.15, cz + 0.12);
  staticBatch.box(1.15, 0.55, 0.85, PALETTE.ochre, cx + 1.7, 1.15, cz + 0.12);
  addApples(staticBatch, cx - 1.7, 1.52, cz + 0.12);
  addApples(staticBatch, cx, 1.52, cz + 0.12);
  addApples(staticBatch, cx + 1.7, 1.52, cz + 0.12);
  for (const x of [-1.7, 0, 1.7]) {
    staticBatch.box(0.05, 0.3, 0.32, PALETTE.paper, cx + x, 1.06, cz - 0.6, 0, 0, 0.35);
  }
  staticBatch.cylinder(0.24, 0.2, 0.12, 10, PALETTE.slate, cx + 2.6, 0.96, cz - 0.3);
  staticBatch.box(0.18, 0.26, 0.04, PALETTE.paper, cx + 2.6, 1.15, cz - 0.3);
  addGlow(cx, 2.3, cz + 1.16, 5.6, 0.34, 'south');
  staticBatch.cylinder(0.3, 0.24, 0.26, 10, PALETTE.wood, cx - 2.7, 1.03, cz - 0.3);
  if (!shared) staticBatch.flush(parent, { doubleSide: true });
  return { fade: [], lamps: [], steam: [] };
}

export function shop(parent: Group, cx: number, cz: number, shared?: GeomBatch): BuildingParts {
  const fadeGroup = new Group();
  const staticBatch = shared ?? new GeomBatch();
  const fadeBatch = new GeomBatch();
  shell(staticBatch, fadeBatch, cx, cz, 10, 8, PALETTE.sage, PALETTE.olive, 'south', true);
  fadeBatch.box(10.6, 0.24, 8.6, PALETTE.olive, cx, WALL_HEIGHT + 0.18, cz);
  fadeBatch.box(5.5, 0.14, 4.2, PALETTE.wood, cx, WALL_HEIGHT + 0.36, cz);
  addShelf(staticBatch, cx - 2.8, cz - 0.2);
  addShelf(staticBatch, cx + 2.8, cz - 0.2);
  addShelf(staticBatch, cx - 2.6, cz + 3.55);
  addCounter(staticBatch, cx, cz - 2.4, 2.8, 0.8);
  staticBatch.box(0.1, 0.1, 1.1, PALETTE.wood, cx + 3.6, 2.9, cz + 4.5);
  staticBatch.box(0.9, 0.7, 0.08, PALETTE.olive, cx + 3.6, 2.5, cz + 4.95);
  staticBatch.cylinder(0.3, 0.24, 0.26, 10, PALETTE.wood, cx + 1.9, 0.13, cz + 3.4);
  staticBatch.cylinder(0.3, 0.24, 0.26, 10, PALETTE.sage, cx + 2.6, 0.13, cz + 3.4);
  if (!shared) staticBatch.flush(parent, { doubleSide: true });
  fadeBatch.flush(fadeGroup, { doubleSide: true });
  parent.add(fadeGroup);
  return { fade: [fadeGroup], lamps: [], steam: [] };
}

export function busStop(parent: Group, cx: number, cz: number, shared?: GeomBatch): BuildingParts {
  const fadeGroup = new Group();
  const staticBatch = shared ?? new GeomBatch();
  const fadeBatch = new GeomBatch();
  staticBatch.box(7.2, 0.08, 3.4, PALETTE.paving, cx, 0.04, cz);
  staticBatch.box(7.2, 2.35, 0.16, PALETTE.slate, cx, 1.18, cz + 1.62);
  staticBatch.box(0.14, 2.35, 3.2, PALETTE.slate, cx - 3.5, 1.18, cz);
  staticBatch.box(0.14, 2.35, 3.2, PALETTE.slate, cx + 3.5, 1.18, cz);
  staticBatch.box(1.5, 1.9, 0.08, PALETTE.slate, cx + 2.3, 1.1, cz - 0.4);
  staticBatch.box(1.2, 1.5, 0.05, PALETTE.paper, cx + 2.3, 1.15, cz - 0.46);
  addGlow(cx + 2.3, 1.15, cz - 0.52, 1.2, 1.5, 'north');
  staticBatch.box(1.1, 0.06, 0.03, PALETTE.slate, cx + 2.3, 1.62, cz - 0.5);
  staticBatch.box(1.1, 0.06, 0.03, PALETTE.slate, cx + 2.3, 1.42, cz - 0.5);
  staticBatch.box(2.6, 0.08, 0.44, PALETTE.wood, cx - 1.6, 0.44, cz + 1.1);
  staticBatch.box(2.6, 0.34, 0.08, PALETTE.wood, cx - 1.6, 0.64, cz + 1.4);
  for (const x of [-2.7, -0.5]) {
    staticBatch.box(0.1, 0.44, 0.4, PALETTE.slate, cx + x, 0.22, cz + 1.1);
  }
  staticBatch.cylinder(0.06, 0.06, 2.2, 8, PALETTE.slate, cx - 3.2, 1.1, cz - 1.3);
  staticBatch.box(0.9, 0.34, 0.05, PALETTE.ochre, cx - 2.85, 2.05, cz - 1.3);
  staticBatch.box(0.9, 0.34, 0.05, PALETTE.paper, cx - 2.85, 1.66, cz - 1.3);
  fadeBatch.box(7.6, 0.12, 3.9, PALETTE.slate, cx, 2.58, cz);
  fadeBatch.box(7.8, 0.08, 0.18, PALETTE.ochre, cx, 2.68, cz);
  if (!shared) staticBatch.flush(parent, { doubleSide: true });
  fadeBatch.flush(fadeGroup);
  parent.add(fadeGroup);
  return { fade: [fadeGroup], lamps: [], steam: [] };
}

export function warehouse(parent: Group, cx: number, cz: number, shared?: GeomBatch): BuildingParts {
  const fadeGroup = new Group();
  const staticBatch = shared ?? new GeomBatch();
  const fadeBatch = new GeomBatch();
  shell(staticBatch, fadeBatch, cx, cz, 10, 8, PALETTE.teal, PALETTE.slate, 'north');
  const doorZ = cz - 4;
  const frontZ = doorZ - 0.22;

  fadeBatch.box(10.8, 0.2, 8.5, PALETTE.slate, cx, WALL_HEIGHT + 0.16, cz);
  for (let i = 0; i < 6; i += 1) {
    fadeBatch.box(10.6, 0.05, 0.35, PALETTE.teal, cx, WALL_HEIGHT + 0.28, cz - 3.2 + i * 1.15);
  }
  fadeBatch.box(2.2, 0.5, 1.2, PALETTE.slate, cx + 3.1, WALL_HEIGHT + 0.5, cz + 1.4);
  fadeBatch.box(2.4, 0.08, 1.4, PALETTE.ochre, cx + 3.1, WALL_HEIGHT + 0.78, cz + 1.4);

  staticBatch.cylinder(0.26, 0.26, 2.7, 10, PALETTE.slate, cx, 2.86, frontZ, 0, 0, Math.PI / 2);
  for (let i = 0; i < 3; i += 1) {
    staticBatch.box(2.5, 0.08, 0.1, PALETTE.slate, cx, 2.66 - i * 0.14, frontZ + 0.06);
  }
  for (const x of [-1.32, 1.32]) {
    staticBatch.box(0.14, 2.75, 0.14, PALETTE.slate, cx + x, 1.38, frontZ);
  }
  staticBatch.box(3.4, 0.12, 1.8, PALETTE.paving, cx, -0.01, doorZ - 1.3);
  staticBatch.box(3.4, 0.08, 0.12, PALETTE.ochre, cx, 0.12, doorZ - 2.2);

  for (let i = 0; i < 4; i += 1) {
    addWindow(fadeBatch, cx - 3.9 + i * 2.6, 2.75, doorZ, 1.2, 0.6, 'north', PALETTE.paper, PALETTE.slate);
  }
  addWindow(fadeBatch, cx + 5, 2.75, cz - 1.6, 1.4, 0.6, 'east', PALETTE.paper, PALETTE.slate);
  addWindow(fadeBatch, cx + 5, 2.75, cz + 1.6, 1.4, 0.6, 'east', PALETTE.paper, PALETTE.slate);

  const awningX = cx - 5.2;
  staticBatch.box(1.5, 0.08, 5.2, PALETTE.ochre, awningX - 0.6, 2.62, cz);
  staticBatch.box(1.5, 0.08, 5.2, PALETTE.terracotta, awningX - 0.62, 2.54, cz + 0.06);
  for (const z of [-2.2, 2.2]) {
    staticBatch.box(0.1, 2.5, 0.1, PALETTE.wood, awningX - 1.28, 1.25, cz + z);
  }
  addCrate(staticBatch, awningX - 0.75, 0, cz - 1.1, PALETTE.umber);
  addCrate(staticBatch, awningX - 0.75, 0.52, cz - 1.1, PALETTE.wood);
  addCrate(staticBatch, awningX - 0.75, 0, cz + 0.9, PALETTE.wood);

  addCrate(staticBatch, cx + 2.6, 0, cz + 1.6);
  addCrate(staticBatch, cx + 2.6, 0.52, cz + 1.6);
  addCrate(staticBatch, cx + 2.6, 1.04, cz + 1.6, PALETTE.umber);
  addCrate(staticBatch, cx + 3.5, 0, cz + 0.7, PALETTE.umber);
  addCrate(staticBatch, cx - 3.2, 0, cz + 2, PALETTE.umber);
  addCrate(staticBatch, cx - 3.2, 0.52, cz + 2, PALETTE.wood);
  staticBatch.box(2.2, 0.12, 1.4, PALETTE.wood, cx - 3.2, 0.06, cz + 2);
  addShelf(staticBatch, cx - 3.6, cz - 2.2);

  if (!shared) staticBatch.flush(parent, { doubleSide: true });
  fadeBatch.flush(fadeGroup, { doubleSide: true });
  parent.add(fadeGroup);
  return { fade: [fadeGroup], lamps: [], steam: [] };
}

export function teaHouse(parent: Group, cx: number, cz: number, shared?: GeomBatch): BuildingParts {
  const fadeGroup = new Group();
  const staticBatch = shared ?? new GeomBatch();
  const fadeBatch = new GeomBatch();
  const lamps: Mesh[] = [];
  shell(staticBatch, fadeBatch, cx, cz, 10, 8, PALETTE.wood, PALETTE.umber, 'north');
  tiledRoof(fadeBatch, cx, cz, 10, 8, PALETTE.terracotta, 0.72);
  fadeBatch.box(0.2, 0.55, 0.2, PALETTE.umber, cx, WALL_HEIGHT + 0.95, cz);
  for (const x of [-2.6, 2.6]) {
    for (let row = 0; row < 5; row += 1) {
      staticBatch.box(1.4, 0.04, 0.04, PALETTE.umber, cx + x, 1.15 + row * 0.22, cz - 4.02);
    }
    for (let col = 0; col < 5; col += 1) {
      staticBatch.box(0.04, 1.05, 0.04, PALETTE.umber, cx + x - 0.56 + col * 0.28, 1.6, cz - 4.02);
    }
  }
  staticBatch.cylinder(0.1, 0.1, 2.7, 8, PALETTE.wood, cx - 3.6, 1.35, cz - 4.6);
  staticBatch.cylinder(1.6, 1.75, 0.12, 12, PALETTE.ochre, cx - 3.6, 2.72, cz - 4.6);
  addWindow(fadeBatch, cx + 3.6, 2.3, cz - 4, 1.6, 0.9, 'north', PALETTE.paper, PALETTE.umber);
  addRoundTable(staticBatch, cx - 1.8, cz);
  addRoundTable(staticBatch, cx + 1.8, cz + 0.4);
  addChair(staticBatch, cx - 1.8, cz + 1.0, Math.PI);
  addChair(staticBatch, cx + 1.8, cz - 0.6, 0);
  lamps.push(addLantern(staticBatch, parent, cx - 1.8, 2.2, cz - 4.35));
  lamps.push(addLantern(staticBatch, parent, cx + 1.8, 2.2, cz - 4.35));
  if (!shared) staticBatch.flush(parent, { doubleSide: true });
  fadeBatch.flush(fadeGroup, { doubleSide: true });
  parent.add(fadeGroup);
  return { fade: [fadeGroup], lamps, steam: [] };
}

export function gateClinic(parent: Group, cx: number, cz: number, shared?: GeomBatch): BuildingParts {
  const fadeGroup = new Group();
  const staticBatch = shared ?? new GeomBatch();
  const fadeBatch = new GeomBatch();
  staticBatch.box(0.7, 4.3, 0.7, PALETTE.slate, cx - 0.15, 2.15, cz - 3.3);
  staticBatch.box(0.7, 4.3, 0.7, PALETTE.slate, cx - 0.15, 2.15, cz + 3.3);
  staticBatch.box(0.16, 3.05, 2.7, PALETTE.wood, cx, 1.52, cz - 1.25);
  staticBatch.box(0.16, 3.05, 2.7, PALETTE.wood, cx, 1.52, cz + 1.25);
  staticBatch.box(1.9, 0.22, 0.7, PALETTE.wood, cx - 0.15, 3.55, cz);
  staticBatch.box(1.8, 2.5, 0.18, PALETTE.plaster, cx - 0.55, 1.25, cz - 3.05);
  staticBatch.box(0.9, 2.05, 0.1, PALETTE.wood, cx - 0.68, 1.05, cz - 3.05);
  addGlow(cx - 0.68, 1.35, cz - 3.16, 0.8, 1.1, 'north');
  staticBatch.sphere(0.07, PALETTE.ochre, cx - 0.78, 1.35, cz - 2.55, 8, 6);
  staticBatch.sphere(0.07, PALETTE.ochre, cx - 0.78, 1.35, cz + 2.4, 8, 6);
  staticBatch.box(1.4, 0.08, 0.9, PALETTE.paving, cx - 1.1, 0.05, cz - 3);
  staticBatch.box(1.4, 0.08, 0.9, PALETTE.paving, cx - 1.1, 0.05, cz + 2.4);
  fadeBatch.box(1.1, 0.2, 7.4, PALETTE.slate, cx - 0.15, 4.35, cz);
  if (!shared) staticBatch.flush(parent, { doubleSide: true });
  fadeBatch.flush(fadeGroup);
  parent.add(fadeGroup);
  return { fade: [fadeGroup], lamps: [], steam: [] };
}

export const BUILDINGS = [
  { id: 'room', location: 'rented_room', cx: -24, cz: -11, sx: 8, sz: 8, build: rentedRoom },
  { id: 'noodle', location: 'noodle_shop', cx: -8, cz: -11, sx: 10, sz: 8, build: noodleShop },
  { id: 'fruit', location: 'fruit_stall', cx: 8, cz: -9, sx: 8, sz: 4, build: fruitStall },
  { id: 'shop', location: 'supermarket', cx: 22, cz: -11, sx: 10, sz: 8, build: shop },
  { id: 'bus', location: 'bus_stop', cx: -24, cz: 9, sx: 8, sz: 4, build: busStop },
  { id: 'warehouse', location: 'warehouse', cx: -8, cz: 11, sx: 10, sz: 8, build: warehouse },
  { id: 'tea', location: 'tea_house', cx: 8, cz: 11, sx: 10, sz: 8, build: teaHouse },
  { id: 'gate', location: 'phase2_gate', cx: 29, cz: 0, sx: 2, sz: 8, build: gateClinic },
] as const;
