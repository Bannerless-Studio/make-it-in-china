import {
  BackSide,
  Box3,
  BufferGeometry,
  Color,
  ColorRepresentation,
  DataTexture,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  NearestFilter,
  Object3D,
  RedFormat,
  SkinnedMesh,
  UnsignedByteType,
  Vector3,
} from 'three';
import { DEGENERATE_THICKNESS, OUTLINE_COLOR, OUTLINE_EXPANSION, SMALL_PROP_HULL } from './constants';

const gradient = new DataTexture(
  new Uint8Array([70, 165, 255]),
  3,
  1,
  RedFormat,
  UnsignedByteType,
);
gradient.minFilter = NearestFilter;
gradient.magFilter = NearestFilter;
gradient.generateMipmaps = false;
gradient.needsUpdate = true;

const _size = new Vector3();
const _box = new Box3();

const OUTLINE_PX = 0.0016;
const OUTLINE_MIN = 0.004;

function extrudeChunk(normalExpr: string): string {
  return `#include <begin_vertex>
float outlineDepth = - ( modelViewMatrix * vec4( transformed, 1.0 ) ).z;
float outlineWidth = clamp( outlineDepth * ${OUTLINE_PX.toFixed(5)}, ${OUTLINE_MIN.toFixed(4)}, ${OUTLINE_EXPANSION.toFixed(4)} );
transformed += normalize( ${normalExpr} ) * outlineWidth;`;
}

function hullable(geometry: BufferGeometry): boolean {
  if (!geometry.getAttribute('normal')) return false;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return false;
  box.getSize(_size);
  if (Math.max(_size.x, _size.y, _size.z) < SMALL_PROP_HULL) return false;
  return Math.min(_size.x, _size.y, _size.z) >= DEGENERATE_THICKNESS;
}

function outlineMaterial(skinned: boolean): MeshBasicMaterial {
  const material = new MeshBasicMaterial({
    color: OUTLINE_COLOR,
    side: BackSide,
    fog: true,
  });
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      extrudeChunk(skinned ? 'objectNormal' : 'normal'),
    );
  };
  material.customProgramCacheKey = () => (skinned ? 'outline-skinned' : 'outline-static');
  return material;
}

function addStaticOutline(mesh: Mesh): void {
  if (mesh.userData.outline || !hullable(mesh.geometry)) return;
  const outline = new Mesh(mesh.geometry, outlineMaterial(false));
  outline.name = `${mesh.name || 'mesh'}-outline`;
  outline.renderOrder = -1;
  outline.castShadow = false;
  outline.receiveShadow = false;
  mesh.add(outline);
  mesh.userData.outline = outline;
}

function addSkinnedOutline(mesh: SkinnedMesh): void {
  if (mesh.userData.outline || !hullable(mesh.geometry)) return;
  const outline = new SkinnedMesh(mesh.geometry, outlineMaterial(true));
  outline.name = `${mesh.name || 'skinned'}-outline`;
  outline.bind(mesh.skeleton, mesh.bindMatrix);
  outline.renderOrder = mesh.renderOrder - 1;
  outline.frustumCulled = false;
  outline.castShadow = false;
  outline.receiveShadow = false;
  mesh.add(outline);
  mesh.userData.outline = outline;
}

export function makeMesh(
  geometry: BufferGeometry,
  color: ColorRepresentation,
  toon = true,
): Mesh {
  const material = toon
    ? new MeshToonMaterial({ color, gradientMap: gradient })
    : new MeshLambertMaterial({ color });
  const mesh = new Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (toon) addStaticOutline(mesh);
  return mesh;
}

export function toonMaterial(color: ColorRepresentation, emissive?: ColorRepresentation): MeshToonMaterial {
  const material = new MeshToonMaterial({ color, gradientMap: gradient });
  if (emissive !== undefined) {
    material.emissive = new Color(emissive);
    material.emissiveIntensity = 0.25;
  }
  return material;
}

function sourceColor(material: Material): Color {
  if (
    material instanceof MeshBasicMaterial
    || material instanceof MeshLambertMaterial
    || material instanceof MeshStandardMaterial
    || material instanceof MeshToonMaterial
  ) {
    return material.color.clone();
  }
  return new Color(0xb8a78d);
}

function flatMaterial(material: Material, color?: ColorRepresentation): Material {
  const base = color === undefined ? sourceColor(material) : new Color(color);
  const replacement = new MeshToonMaterial({ color: base, gradientMap: gradient });
  replacement.name = material.name;
  return replacement;
}

export function styleLoadedScene(
  root: Object3D,
  toon = true,
  color?: ColorRepresentation,
): void {
  const meshes: Mesh[] = [];
  root.traverse(object => {
    if (object instanceof Mesh) meshes.push(object);
  });

  for (const mesh of meshes) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const replacements = materials.map(material => flatMaterial(material, color));
    mesh.material = Array.isArray(mesh.material) ? replacements : replacements[0];
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (!toon) continue;
    if (mesh instanceof SkinnedMesh) addSkinnedOutline(mesh);
    else addStaticOutline(mesh);
  }
}

export function worldSize(root: Object3D): Vector3 {
  _box.setFromObject(root).getSize(_size);
  return _size.clone();
}
