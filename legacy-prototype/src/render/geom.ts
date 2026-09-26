import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  MeshToonMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeMesh } from './toon';

const _m = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3(1, 1, 1);
const _p = new Vector3();
const _e = new Euler();

export interface FlushOptions {
  outline?: boolean;
  doubleSide?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

const _tint = new Color();

export class GeomBatch {
  private parts: BufferGeometry[] = [];
  private colors: number[] = [];

  box(
    w: number,
    h: number,
    d: number,
    color: number,
    x: number,
    y: number,
    z: number,
    ry = 0,
    rx = 0,
    rz = 0,
  ): this {
    return this.geo(new BoxGeometry(w, h, d), color, x, y, z, rx, ry, rz);
  }

  cylinder(
    top: number,
    bottom: number,
    h: number,
    segments: number,
    color: number,
    x: number,
    y: number,
    z: number,
    ry = 0,
    rx = 0,
    rz = 0,
  ): this {
    return this.geo(new CylinderGeometry(top, bottom, h, segments), color, x, y, z, rx, ry, rz);
  }

  sphere(
    radius: number,
    color: number,
    x: number,
    y: number,
    z: number,
    widthSegs = 8,
    heightSegs = 6,
  ): this {
    return this.geo(new SphereGeometry(radius, widthSegs, heightSegs), color, x, y, z, 0, 0, 0);
  }

  geo(
    geometry: BufferGeometry,
    color: number,
    x: number,
    y: number,
    z: number,
    rx: number,
    ry: number,
    rz: number,
  ): this {
    _p.set(x, y, z);
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _m.compose(_p, _q, _s);
    geometry.applyMatrix4(_m);
    _tint.setHex(color);
    const vertices = geometry.getAttribute('position').count;
    for (let vertex = 0; vertex < vertices; vertex += 1) {
      this.colors.push(_tint.r, _tint.g, _tint.b);
    }
    this.parts.push(geometry);
    return this;
  }

  flush(parent: Object3D, options: FlushOptions = {}): Mesh[] {
    const outline = options.outline !== false;
    if (!this.parts.length) return [];
    const merged = this.parts.length === 1 ? this.parts[0] : mergeGeometries(this.parts, false);
    if (this.parts.length > 1) {
      for (const geometry of this.parts) geometry.dispose();
    }
    const colors = this.colors;
    this.parts = [];
    this.colors = [];
    if (!merged) return [];
    merged.setAttribute('color', new Float32BufferAttribute(colors, 3));
    const mesh = makeMesh(merged, 0xffffff, outline);
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (material instanceof MeshToonMaterial || material instanceof MeshLambertMaterial) {
        material.vertexColors = true;
      }
      if (options.doubleSide) material.side = DoubleSide;
    }
    if (options.castShadow === false) mesh.castShadow = false;
    if (options.receiveShadow === false) mesh.receiveShadow = false;
    parent.add(mesh);
    return [mesh];
  }
}
