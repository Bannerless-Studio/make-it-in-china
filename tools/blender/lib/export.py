"""The single GLB export path for every asset set."""
import os

import bpy
from mathutils import Vector

from . import build


def export_glb(obj_or_objs, path, quiet=False, armature=None):
    """Export one object (or a list, exported together) to a binary glTF.

    Applies modifiers + transforms first, exports +Y up, normals + materials
    only (no UVs, animation, skins, morphs, lights or cameras). Prints
    ``EXPORT name tris=N bbox=x,y,z`` with the bbox size in glTF axes
    (x, y = up, z = depth). Returns a dict with name/tris/bbox/path.

    ``armature``: rigged export (lib/rig.py). The mesh keeps its Armature
    modifier (bind pose = rest pose), the armature is exported with it and every
    action on the armature (NLA strips) becomes a named glTF animation,
    sampled per frame (24 fps), all bones exported (attachment leaf bones too).
    """
    objs = obj_or_objs if isinstance(obj_or_objs, (list, tuple)) else [obj_or_objs]
    if armature is None:
        for o in objs:
            build.apply_all(o)
    else:
        for o in objs:
            assert o.parent is armature and any(m.type == "ARMATURE" for m in o.modifiers), o.name
            build.bake(o)
    bpy.context.view_layer.update()
    for o in bpy.context.scene.objects:
        if o is not None:
            o.select_set(False)
    for o in objs:
        o.select_set(True)
    if armature is not None:
        armature.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    rigged = armature is not None
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, export_apply=True,
        export_yup=True, export_animations=rigged, export_cameras=False, export_lights=False,
        export_skins=rigged, export_morph=False, export_texcoords=False, export_normals=True,
        export_materials="EXPORT", export_extras=False, export_attributes=False,
        **(dict(export_animation_mode="ACTIONS", export_force_sampling=True, export_frame_step=1,
                export_optimize_animation_size=False, export_anim_slide_to_zero=False,
                export_def_bones=False, export_leaf_bone=False, export_rest_position_armature=True,
                export_reset_pose_bones=True, export_anim_single_armature=True, export_influence_nb=4)
           if rigged else {}),
    )
    tris = sum(build.tri_count(o) for o in objs)
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        a, b = build.bbox(o)
        lo = Vector(tuple(min(x, y) for x, y in zip(lo, a)))
        hi = Vector(tuple(max(x, y) for x, y in zip(hi, b)))
    size = hi - lo
    name = os.path.splitext(os.path.basename(path))[0]
    if not quiet:
        print("EXPORT %s tris=%d bbox=%.3f,%.3f,%.3f" % (name, tris, size.x, size.z, size.y))
    return {"name": name, "tris": tris, "bbox": (size.x, size.z, size.y), "path": path,
            "min": tuple(lo), "max": tuple(hi)}
