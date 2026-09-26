import { describe, it, expect } from 'vitest';
import { BackSide, BoxGeometry, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { makeMesh } from '../../src/render/toon';
import { OUTLINE_COLOR, PALETTE } from '../../src/render/constants';

function outlineOf(mesh: Mesh): Mesh | undefined {
  return mesh.children.find(child => child instanceof Mesh) as Mesh | undefined;
}

describe('toon outline hulls', () => {
  it('never scales a hull away from an off-origin thin roof slab', () => {
    const roof = new BoxGeometry(8.6, 0.22, 8.6);
    roof.translate(-24, 3.38, -11);
    const mesh = makeMesh(roof, PALETTE.slate);
    const outline = outlineOf(mesh);
    expect(outline).toBeDefined();
    expect(outline!.scale.toArray()).toEqual([1, 1, 1]);
    expect(outline!.position.toArray()).toEqual([0, 0, 0]);
    expect(outline!.geometry).toBe(mesh.geometry);
    const material = outline!.material as MeshBasicMaterial;
    expect(material.side).toBe(BackSide);
    expect(material.color.getHex()).toBe(OUTLINE_COLOR);
  });

  it('skips hulls on small props and on zero-thickness planes', () => {
    const small = makeMesh(new BoxGeometry(0.1, 0.1, 0.1), PALETTE.wood);
    expect(outlineOf(small)).toBeUndefined();
    const plane = new PlaneGeometry(58, 3.6);
    plane.rotateX(-Math.PI / 2);
    const ground = makeMesh(plane, PALETTE.paving);
    expect(outlineOf(ground)).toBeUndefined();
  });
});
