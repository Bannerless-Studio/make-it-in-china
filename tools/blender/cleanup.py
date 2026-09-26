#!/usr/bin/env python3
"""Turn a Rodin-style GLB, glTF, FBX, or OBJ into a game-ready flat-colour GLB.

Run with Blender, not system Python:
  blender -b --python tools/blender/cleanup.py -- --in model.fbx --out model.glb
"""
import argparse
import os
import sys

import bpy
import bmesh
from mathutils import Vector


def arguments():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--in", dest="input", required=True, help="GLB, glTF, FBX, or OBJ")
    parser.add_argument("--out", required=True, help="Output .glb path")
    parser.add_argument("--height", type=float, default=1.7, help="Target height in metres")
    parser.add_argument("--tris", type=int, default=5000, help="Maximum triangle count")
    parser.add_argument("--keep-textures", action="store_true", help="Do not flatten image textures")
    opts = parser.parse_args(argv)
    if opts.height <= 0 or opts.tris <= 0:
        parser.error("--height and --tris must be positive")
    if not opts.out.lower().endswith(".glb"):
        parser.error("--out must end in .glb")
    return opts


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.materials, bpy.data.meshes, bpy.data.images):
        for item in list(datablocks):
            datablocks.remove(item)


def import_model(path):
    extension = os.path.splitext(path)[1].lower()
    if extension in {".glb", ".gltf"}:
        bpy.ops.import_scene.gltf(filepath=path)
    elif extension == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path)
    elif extension == ".obj":
        # Blender 4.x's bundled OBJ importer replaces import_scene.obj.
        bpy.ops.wm.obj_import(filepath=path)
    else:
        raise ValueError("Unsupported input extension: %s" % extension)


def mesh_triangles(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def join_meshes():
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("The imported file contains no mesh objects")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = "cleaned_asset"
    # Geometry operations below occur in local coordinates.
    # Apply location too: imports may carry an object-level offset (for example a
    # source Suzanne placed at z=1). Bounding and origin normalisation must operate
    # on the world-positioned mesh, then deliberately place its feet at z=0.
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


def weld_and_recalculate(obj):
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()


def flatten_materials(obj):
    for material in obj.data.materials:
        if material is None:
            continue
        material.use_nodes = True
        nodes = material.node_tree.nodes
        principled = next((node for node in nodes if node.type == "BSDF_PRINCIPLED"), None)
        if principled is None:
            principled = nodes.new("ShaderNodeBsdfPrincipled")
        image_nodes = [node for node in nodes if node.type == "TEX_IMAGE" and node.image]
        if image_nodes:
            # The first image is the base colour in normal Rodin exports.  If a
            # material has several maps, averaging all their RGBs avoids retaining
            # any detailed texture while still producing a representative colour.
            colours = [mean_image_rgb(node.image) for node in image_nodes]
            mean = tuple(sum(colour[i] for colour in colours) / len(colours) for i in range(3))
            principled.inputs["Base Color"].default_value = (*mean, 1.0)
            for node in image_nodes:
                nodes.remove(node)
        principled.inputs["Roughness"].default_value = 1.0
        principled.inputs["Metallic"].default_value = 0.0
        specular = principled.inputs.get("Specular IOR Level") or principled.inputs.get("Specular")
        if specular:
            specular.default_value = 0.0


def mean_image_rgb(image):
    pixels = image.pixels
    channels = image.channels
    pixel_count = image.size[0] * image.size[1]
    # At most roughly 16k samples, evenly spread through large source images.
    step = max(1, pixel_count // 16384)
    red = green = blue = 0.0
    samples = 0
    for index in range(0, pixel_count, step):
        offset = index * channels
        red += pixels[offset]
        green += pixels[offset + 1] if channels > 1 else pixels[offset]
        blue += pixels[offset + 2] if channels > 2 else pixels[offset]
        samples += 1
    return (red / samples, green / samples, blue / samples)


def local_bounds(obj):
    vertices = obj.data.vertices
    low = Vector((min(v.co.x for v in vertices), min(v.co.y for v in vertices), min(v.co.z for v in vertices)))
    high = Vector((max(v.co.x for v in vertices), max(v.co.y for v in vertices), max(v.co.z for v in vertices)))
    return low, high


def centre_and_scale(obj, target_height):
    low, high = local_bounds(obj)
    current_height = high.z - low.z
    if current_height <= 1e-8:
        raise RuntimeError("Cannot scale a mesh with zero height")
    scale = target_height / current_height
    # Translate after scale so the final bottom is exactly z=0 and the XY bounding
    # box is centred on the object origin.
    offset = Vector((-(low.x + high.x) * 0.5, -(low.y + high.y) * 0.5, -low.z))
    for vertex in obj.data.vertices:
        vertex.co = (vertex.co + offset) * scale
    obj.data.update()


def decimate_to(obj, limit):
    before = mesh_triangles(obj)
    if before <= limit:
        return before
    modifier = obj.modifiers.new("triangle_budget", "DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = max(0.001, min(1.0, limit / before))
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    # The collapse ratio is normally sufficient. Reduce in small bounded passes if
    # triangulation after the modifier leaves the count over the requested budget.
    after = mesh_triangles(obj)
    attempts = 0
    while after > limit and attempts < 3:
        modifier = obj.modifiers.new("triangle_budget_retry", "DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = max(0.001, limit / after)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        after = mesh_triangles(obj)
        attempts += 1
    return after


def export_glb(obj, path):
    directory = os.path.dirname(os.path.abspath(path))
    os.makedirs(directory, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=os.path.abspath(path), export_format="GLB", use_selection=True,
        export_apply=True, export_animations=False, export_cameras=False,
        export_lights=False, export_yup=True,
    )


def main():
    opts = arguments()
    input_path = os.path.abspath(opts.input)
    if not os.path.isfile(input_path):
        raise FileNotFoundError(input_path)
    clear_scene()
    import_model(input_path)
    obj = join_meshes()
    before = mesh_triangles(obj)
    weld_and_recalculate(obj)
    if not opts.keep_textures:
        flatten_materials(obj)
    after = decimate_to(obj, opts.tris)
    # Collapse decimation can shift an extreme vertex slightly. Normalise after it
    # so the exported asset, rather than an intermediate mesh, has the requested
    # height and feet exactly on the origin plane.
    centre_and_scale(obj, opts.height)
    low, high = local_bounds(obj)
    size = high - low
    export_glb(obj, opts.out)
    print("CLEANUP input=%s tris=%d->%d materials=%d bbox=%.4f,%.4f,%.4f" % (
        input_path, before, after, len(obj.data.materials), size.x, size.y, size.z))


if __name__ == "__main__":
    main()
