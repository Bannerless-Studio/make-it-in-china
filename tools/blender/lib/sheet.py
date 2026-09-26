"""Labelled contact sheet renderer (Workbench, flat colour + outline + cavity).

Fixed high three-quarter orthographic camera from the front-right (front of
every asset is -Y). Two layout modes:

* true scale (default, for prop sets): no per-object scaling, so relative
  sizes are visible; the grid cell is sized from the largest asset.
* fit (characters): each asset is scaled to fit its cell (``fit_height`` m
  tall at most), so small things are readable next to big ones.

CLI (via tools/blender/render_sheet.py or any script calling ``main``):
    --dir DIR  --out PNG  [--cols N] [--cell METRES] [--true-scale | --fit]
"""
import argparse
import math
import os
import sys

import bpy
from mathutils import Vector

from . import build

ELEVATION = math.radians(42)   # camera pitch above the ground plane
AZIMUTH = math.radians(36)     # camera yaw to the right of straight-on-front


def _setup_scene(out_png, resolution):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x, scene.render.resolution_y = resolution
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = out_png
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    sh = scene.display.shading
    sh.light = "STUDIO"
    sh.studio_light = "paint.sl"
    sh.color_type = "MATERIAL"
    sh.show_shadows = True
    sh.shadow_intensity = 0.35
    sh.show_cavity = True
    sh.cavity_type = "WORLD"
    sh.curvature_ridge_factor = 1.2
    sh.curvature_valley_factor = 1.0
    sh.show_object_outline = True
    sh.object_outline_color = (0.08, 0.07, 0.07)
    sh.background_type = "VIEWPORT"
    sh.background_color = (0.80, 0.79, 0.76)
    scene.display.render_aa = "16"
    if scene.world is None:
        scene.world = bpy.data.worlds.new("sheet_world")
    scene.world.color = (0.55, 0.53, 0.49)
    return scene


def _pose_meshes(new, meshes, pose):
    """Freeze skinned meshes at ``pose`` = (clip_name, frame); no-op if unrigged."""
    arms = [o for o in new if o.type == "ARMATURE"]
    if not arms:
        return
    arm = arms[0]
    ad = arm.animation_data or arm.animation_data_create()
    clip, frame = pose
    # the glTF importer keeps each animation as an NLA track named after the clip
    acts = {t.name: t.strips[0].action for t in ad.nla_tracks if t.strips}
    if ad.action is not None:
        acts.setdefault(ad.action.name.split("_" + arm.name)[0], ad.action)
    act = acts.get(clip)
    if act is None:
        raise RuntimeError("clip %r not found for %s (%s)" % (clip, arm.name, sorted(acts)))
    for t in list(ad.nla_tracks):
        ad.nla_tracks.remove(t)
    ad.action = act
    scene = bpy.context.scene
    scene.frame_set(int(act.frame_range[0]) + frame)
    dg = bpy.context.evaluated_depsgraph_get()
    for o in meshes:
        ev = o.evaluated_get(dg)
        me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
        o.modifiers.clear()
        o.data = me


def _import_glb(path, pose=None):
    """Import a GLB as ONE joined mesh (rest / bind pose). ``pose`` =
    (clip, frame) freezes a rigged character at that animation frame."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    # the importer adds a bone-display sphere mesh for armatures: not asset geometry
    shapes = {pb.custom_shape for o in new if o.type == "ARMATURE" for pb in o.pose.bones if pb.custom_shape}
    meshes = [o for o in new if o.type == "MESH" and o not in shapes]
    if not meshes:
        raise RuntimeError("No mesh in %s" % path)
    name = os.path.splitext(os.path.basename(path))[0]
    bpy.context.view_layer.update()
    if pose is not None:
        _pose_meshes(new, meshes, pose)
    for o in meshes:
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
    others = [o for o in new if o not in meshes]
    obj = build.join(meshes, name)
    for o in others:
        bpy.data.objects.remove(o, do_unlink=True)
    for m in obj.data.materials:
        if m and m.use_nodes:
            bsdf = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
            if bsdf:
                m.diffuse_color = tuple(bsdf.inputs["Base Color"].default_value)
    return obj


def _label(text, loc, size, max_width, camera, ink):
    curve = bpy.data.curves.new("label_" + text, "FONT")
    curve.body = text.replace("_", " ")
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.size = size
    curve.extrude = 0.002
    curve.materials.append(ink)
    obj = bpy.data.objects.new("label_" + text, curve)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    forward = camera.matrix_world.to_quaternion() @ Vector((0, 0, 1))
    obj.rotation_euler = forward.to_track_quat("Z", "Y").to_euler()
    bpy.context.view_layer.update()
    if obj.dimensions.x > max_width:
        f = max_width / obj.dimensions.x
        obj.scale = (f, f, f)
    return obj


def render_sheet(glb_dir, out_png, cell_size_m=None, cols=6, true_scale=True, fit_height=1.8,
                 resolution=(1920, 1080), files=None, pose=None):
    """Render every ``*.glb`` in ``glb_dir`` (sorted, or ``files``) to ``out_png``.

    cell_size_m  grid pitch across the screen (auto if None).
    cols         grid columns.
    true_scale   True = keep real sizes; False = fit each asset to its cell.
    fit_height   fit-mode max height per asset (metres).
    pose         (clip, frame) to freeze rigged GLBs at an animation frame
                 (None = rest / bind pose).
    Returns the number of assets rendered.
    """
    names = files or sorted(n for n in os.listdir(glb_dir) if n.lower().endswith(".glb"))
    if not names:
        raise RuntimeError("No GLBs in %s" % glb_dir)
    build.clear_scene()
    scene = _setup_scene(out_png, resolution)
    objs = [_import_glb(os.path.join(glb_dir, n), pose) for n in names]

    dims = []
    for o in objs:
        build.set_origin_feet(o, centre_xy=True)
        lo, hi = build.bbox(o)
        dims.append(hi - lo)
    if true_scale:
        foot = max(max(d.x, d.y) for d in dims)
        cell = cell_size_m or foot * 1.25 + 0.05
        row_h = max(d.z for d in dims)
    else:
        cell = cell_size_m or 2.2
        for o, d in zip(objs, dims):
            s = min(fit_height / max(d.z, 1e-6), cell * 0.82 / max(d.x, d.y, 1e-6))
            build.scale_mesh(o, s)
        dims = [build.bbox(o)[1] - build.bbox(o)[0] for o in objs]
        row_h = max(d.z for d in dims)

    right = Vector((math.cos(AZIMUTH), math.sin(AZIMUTH), 0))
    away = Vector((-math.sin(AZIMUTH), math.cos(AZIMUTH), 0))
    view_dir = away * math.cos(ELEVATION) - Vector((0, 0, math.sin(ELEVATION)))  # camera look direction
    label_size = cell * 0.12
    depth = max(max(d.x, d.y) for d in dims)
    row_pitch = (row_h * math.cos(ELEVATION) + label_size * 2.2) / math.sin(ELEVATION) + depth * 0.55

    cam_data = bpy.data.cameras.new("sheet_cam")
    cam_data.type = "ORTHO"
    cam_data.clip_end = 1000
    camera = bpy.data.objects.new("sheet_cam", cam_data)
    scene.collection.objects.link(camera)
    camera.location = -view_dir * 80
    camera.rotation_euler = view_dir.to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera
    bpy.context.view_layer.update()

    ink = bpy.data.materials.new("label_ink")
    ink.diffuse_color = (0.05, 0.05, 0.06, 1)
    rows = (len(objs) + cols - 1) // cols
    labels = []
    for i, (o, d) in enumerate(zip(objs, dims)):
        c, r = i % cols, i // cols
        pos = right * ((c - (cols - 1) / 2) * cell) + away * (((rows - 1) / 2 - r) * row_pitch)
        o.location = pos
        lpos = pos - away * (depth * 0.5 + label_size * 0.9)
        lpos.z = 0.01
        labels.append(_label(o.name, lpos, label_size, cell * 0.95, camera, ink))
    bpy.context.view_layer.update()

    inv = camera.matrix_world.inverted()
    pts = []
    for o in objs:
        M = o.matrix_world
        vs = o.data.vertices
        step = max(1, len(vs) // 400)
        pts += [inv @ (M @ vs[k].co) for k in range(0, len(vs), step)]
    for lb in labels:
        pts += [inv @ (lb.matrix_world @ Vector(c)) for c in lb.bound_box]
    xs, ys = [p.x for p in pts], [p.y for p in pts]
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    q = camera.matrix_world.to_quaternion()
    camera.location += (q @ Vector((1, 0, 0))) * cx + (q @ Vector((0, 1, 0))) * cy
    aspect = resolution[0] / resolution[1]
    cam_data.ortho_scale = max(w, h * aspect) * 1.08

    os.makedirs(os.path.dirname(os.path.abspath(out_png)), exist_ok=True)
    bpy.ops.render.render(write_still=True)
    print("SHEET glbs=%d mode=%s output=%s" % (len(objs), "true-scale" if true_scale else "fit", out_png))
    return len(objs)


def main(argv=None, default_dir=None, default_out=None, default_true_scale=True, default_cols=6):
    """CLI entry: parse args after ``--`` and call render_sheet()."""
    if argv is None:
        argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser(prog="render_sheet")
    ap.add_argument("--dir", default=default_dir)
    ap.add_argument("--out", default=None)
    ap.add_argument("--cols", type=int, default=default_cols)
    ap.add_argument("--cell", type=float, default=None)
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--true-scale", dest="true_scale", action="store_true")
    g.add_argument("--fit", dest="true_scale", action="store_false")
    ap.set_defaults(true_scale=default_true_scale)
    a = ap.parse_args(argv)
    if not a.dir:
        ap.error("--dir is required")
    out = a.out or default_out or os.path.join(a.dir, "sheet.png")
    return render_sheet(os.path.abspath(a.dir), os.path.abspath(out), a.cell, a.cols, a.true_scale)
