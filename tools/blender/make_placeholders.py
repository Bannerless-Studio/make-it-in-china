#!/usr/bin/env python3
"""Generate faceless, low-poly grey-box characters and detached props as GLBs."""
import os

import bpy
from mathutils import Vector


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR = os.path.join(ROOT, "assets", "placeholders")

# Deliberately muted, readable flat colours. Values are linear Blender RGB.
COLOURS = {
    "skin": (0.53, 0.38, 0.27, 1), "skin_light": (0.72, 0.56, 0.41, 1),
    "grey": (0.30, 0.32, 0.34, 1), "dark": (0.055, 0.065, 0.08, 1),
    "white": (0.82, 0.80, 0.73, 1), "apron": (0.12, 0.13, 0.14, 1),
    "orange": (0.9, 0.30, 0.055, 1), "yellow": (0.95, 0.64, 0.04, 1),
    "blue": (0.075, 0.22, 0.43, 1), "green": (0.24, 0.43, 0.23, 1),
    "red": (0.67, 0.06, 0.055, 1), "purple": (0.36, 0.16, 0.43, 1),
    "jeans": (0.08, 0.19, 0.33, 1), "brown": (0.25, 0.105, 0.045, 1),
    "cat": (0.76, 0.25, 0.045, 1), "dog": (0.38, 0.16, 0.065, 1),
    "pigeon": (0.29, 0.32, 0.35, 1), "pigeon_dark": (0.17, 0.20, 0.23, 1),
    "metal": (0.27, 0.30, 0.32, 1), "paper": (0.92, 0.87, 0.68, 1),
}
MATERIALS = {}


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.materials, bpy.data.meshes, bpy.data.curves, bpy.data.cameras, bpy.data.lights):
        for item in list(collection):
            collection.remove(item)
    MATERIALS.clear()


def material(name):
    if name not in MATERIALS:
        mat = bpy.data.materials.new(name)
        mat.diffuse_color = COLOURS[name]
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = COLOURS[name]
        bsdf.inputs["Roughness"].default_value = 1.0
        bsdf.inputs["Metallic"].default_value = 0.0
        MATERIALS[name] = mat
    return MATERIALS[name]


def finish_part(obj, name, colour, parts):
    obj.name = name
    obj.data.materials.append(material(colour))
    parts.append(obj)
    return obj


def sphere(name, loc, scale, colour, parts, segments=8, rings=4):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=loc)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish_part(obj, name, colour, parts)


def cylinder(name, loc, radius, depth, colour, parts, vertices=8, rotation=None, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rotation or (0, 0, 0))
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish_part(obj, name, colour, parts)


def cone(name, loc, radius1, radius2, depth, colour, parts, vertices=8, rotation=None, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=loc, rotation=rotation or (0, 0, 0))
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish_part(obj, name, colour, parts)


def cube(name, loc, scale, colour, parts, rotation=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rotation or (0, 0, 0))
    obj = bpy.context.object
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish_part(obj, name, colour, parts)


def torus(name, loc, major, minor, colour, parts, rotation=(0, 0, 0), scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=8, minor_segments=4, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish_part(obj, name, colour, parts)


def join_export(name, parts, target_height=None):
    if not parts:
        raise RuntimeError("No parts for %s" % name)
    bpy.ops.object.select_all(action="DESELECT")
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = name
    # Position mesh data so its floor is origin. This remains true after glTF export.
    low_z = min(vertex.co.z for vertex in obj.data.vertices)
    for vertex in obj.data.vertices:
        vertex.co.z -= low_z
    obj.location = (0, 0, 0)
    if target_height is not None:
        height = max(vertex.co.z for vertex in obj.data.vertices)
        if height <= 1e-8:
            raise RuntimeError("Cannot size flat placeholder %s" % name)
        factor = target_height / height
        for vertex in obj.data.vertices:
            vertex.co *= factor
    obj.data.update()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.data.calc_loop_triangles()
    if len(obj.data.loop_triangles) > 1500:
        raise RuntimeError("%s exceeds placeholder budget: %d triangles" % (name, len(obj.data.loop_triangles)))
    os.makedirs(OUT_DIR, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT_DIR, name + ".glb"), export_format="GLB", use_selection=True,
        export_apply=True, export_animations=False, export_cameras=False, export_lights=False,
        export_yup=True,
    )
    return len(obj.data.loop_triangles)


def add_headwear(kind, h, head_z, parts):
    if not kind:
        return
    colour = "white" if kind == "tall_hat" else "yellow" if kind == "hard_hat" else "brown"
    if kind == "tall_hat":
        cone("headwear_tall_hat", (0, 0, head_z + h * .16), h * .105, h * .075, h * .23, colour, parts)
    elif kind == "flat_cap":
        cylinder("headwear_flat_cap", (0, 0, head_z + h * .12), h * .14, h * .045, "grey", parts, scale=(1, 1, .65))
    elif kind == "hard_hat":
        sphere("headwear_hard_hat", (0, 0, head_z + h * .115), (h * .145, h * .14, h * .07), colour, parts)
        cylinder("headwear_hard_hat_brim", (0, -h * .09, head_z + h * .09), h * .115, h * .025, colour, parts, scale=(1, .55, 1))
    elif kind == "cap":
        sphere("headwear_cap_dome", (0, 0, head_z + h * .105), (h * .14, h * .13, h * .065), "yellow", parts)
        cube("headwear_cap_brim", (0, -h * .14, head_z + h * .09), (h * .16, h * .11, h * .025), "yellow", parts)
    elif kind == "straw_hat":
        cone("headwear_straw_hat", (0, 0, head_z + h * .13), h * .19, h * .07, h * .10, "paper", parts)
        cylinder("headwear_straw_hat_brim", (0, 0, head_z + h * .09), h * .24, h * .022, "paper", parts)
    elif kind == "visor":
        cube("headwear_visor_brim", (0, -h * .15, head_z + h * .09), (h * .24, h * .13, h * .03), "purple", parts)
    elif kind == "hood":
        torus("headwear_hood", (0, 0, head_z), h * .14, h * .045, "grey", parts, rotation=(1.5708, 0, 0), scale=(1, 1, 1.15))
    else:
        raise ValueError("Unknown headwear: %s" % kind)


def make_human(name, h, build, torso, legs, headwear=None, stoop=False, backpack=False):
    clear_scene()
    parts = []
    width = {"thin": .82, "average": 1.0, "stocky": 1.17, "broad": 1.27, "plump": 1.31}[build]
    leg_radius = h * .058 * (1.08 if build in {"stocky", "plump"} else 1)
    leg_depth = h * .43
    torso_z = h * .55
    head_z = h * .84
    # These are the only head geometry parts. No feature meshes, decals, or textures
    # are permitted by the no-face rule.
    head_parts = [sphere("blank_featureless_head", (0, 0, head_z), (h * .135, h * .13, h * .135), "skin_light", parts)]
    if len(head_parts) != 1 or any("face" in obj.name.lower() for obj in head_parts):
        raise RuntimeError("Faceless head verification failed for %s" % name)
    torso_rotation = (0, .14 if stoop else 0, 0)
    cylinder("torso", (0, .025 if stoop else 0, torso_z), h * .155 * width, h * .34, torso, parts, scale=(1, .83, 1), rotation=torso_rotation)
    for x in (-h * .078 * width, h * .078 * width):
        cylinder("leg", (x, 0, leg_depth / 2), leg_radius, leg_depth, legs, parts)
    # T-pose arms intentionally stay straight and clear of the body for later Mixamo use.
    arm_length = h * .36
    for x in (-h * (.155 * width + arm_length / 2), h * (.155 * width + arm_length / 2)):
        cylinder("t_pose_arm", (x, 0, h * .66), h * .052, arm_length, torso, parts, rotation=(0, 1.5708, 0))
    if backpack:
        cube("backpack", (0, h * .14, h * .58), (h * .25, h * .10, h * .28), "dark", parts)
    add_headwear(headwear, h, head_z, parts)
    return join_export(name, parts, h)


def make_cat():
    clear_scene(); parts = []; h = .35
    sphere("blank_cat_head", (0, -.08, .25), (.10, .09, .10), "cat", parts, 8, 4)
    sphere("cat_body", (0, .06, .16), (.13, .19, .12), "cat", parts, 8, 4)
    # Ears are silhouette geometry, not facial features.
    cone("cat_ear_left", (-.06, -.08, .35), .045, 0, .11, "cat", parts, 4)
    cone("cat_ear_right", (.06, -.08, .35), .045, 0, .11, "cat", parts, 4)
    for x in (-.075, .075):
        cylinder("cat_stub_leg", (x, .06, .055), .038, .11, "cat", parts, 6)
    torus("cat_curled_tail", (.12, .15, .16), .09, .025, "cat", parts, rotation=(1.5708, 0, 0))
    return join_export("cat", parts, .35)


def make_dog():
    clear_scene(); parts = []
    sphere("blank_dog_head", (0, -.18, .27), (.12, .11, .11), "dog", parts, 8, 4)
    sphere("dog_body", (0, .07, .20), (.15, .22, .12), "dog", parts, 8, 4)
    for x in (-.07, .07):
        cone("dog_floppy_ear", (x, -.18, .24), .045, .03, .14, "dog", parts, 6, rotation=(.35, 0, 0))
    for x in (-.10, .10):
        for y in (-.01, .16):
            cylinder("dog_leg", (x, y, .08), .035, .16, "dog", parts, 6)
    torus("dog_curled_tail", (0, .26, .26), .085, .025, "dog", parts, rotation=(1.5708, 0, 0))
    return join_export("dog", parts, .4)


def make_pigeon():
    clear_scene(); parts = []
    sphere("pigeon_round_body", (0, 0, .16), (.11, .14, .14), "pigeon", parts, 8, 4)
    sphere("blank_pigeon_head", (0, -.10, .27), (.07, .065, .07), "pigeon", parts, 8, 4)
    cone("pigeon_wing_left", (-.10, .02, .17), .10, .025, .19, "pigeon_dark", parts, 6, rotation=(0, .75, 0))
    cone("pigeon_wing_right", (.10, .02, .17), .10, .025, .19, "pigeon_dark", parts, 6, rotation=(0, -.75, 0))
    for x in (-.035, .035): cylinder("pigeon_leg", (x, 0, .035), .012, .07, "brown", parts, 5)
    return join_export("pigeon", parts, .25)


def make_prop(name):
    clear_scene(); parts = []
    if name == "chef_hat":
        cylinder("hat_base", (0, 0, .04), .13, .08, "white", parts)
        sphere("hat_puff", (0, 0, .14), (.16, .16, .12), "white", parts)
    elif name == "ladle":
        cylinder("ladle_handle", (0, 0, .25), .022, .50, "brown", parts, 8)
        sphere("ladle_bowl", (0, 0, .52), (.09, .09, .055), "metal", parts, 8, 4)
    elif name == "clipboard":
        cube("clipboard_board", (0, 0, .20), (.25, .035, .38), "brown", parts)
        cube("clipboard_paper", (0, -.021, .20), (.20, .012, .28), "paper", parts)
        cube("clipboard_clip", (0, -.04, .37), (.10, .025, .035), "metal", parts)
    elif name == "delivery_bag":
        cube("delivery_bag_box", (0, 0, .18), (.36, .24, .36), "yellow", parts)
        torus("delivery_bag_handle", (0, 0, .40), .10, .025, "dark", parts, rotation=(1.5708, 0, 0), scale=(1.3, 1, 1))
    elif name == "hanging_scale":
        cylinder("scale_bar", (0, 0, .48), .025, .44, "metal", parts, 8, rotation=(0, 1.5708, 0))
        cylinder("scale_hook", (0, 0, .33), .015, .27, "metal", parts, 6)
        cone("scale_pan", (0, 0, .12), .17, .10, .07, "metal", parts, 8)
    elif name == "key_ring":
        torus("key_ring_loop", (0, 0, .16), .09, .018, "metal", parts, rotation=(1.5708, 0, 0))
        for x in (-.04, .04): cube("key", (x, 0, .035), (.025, .015, .13), "metal", parts)
    elif name == "trolley":
        cube("trolley_bed", (0, 0, .10), (.48, .34, .06), "metal", parts)
        for x in (-.18, .18):
            for y in (-.12, .12): torus("trolley_wheel", (x, y, .045), .05, .016, "dark", parts, rotation=(1.5708, 0, 0))
        for x in (-.18, .18): cylinder("trolley_handle", (x, .12, .43), .018, .65, "metal", parts, 6, rotation=(.35, 0, 0))
    else:
        raise ValueError(name)
    return join_export(name, parts)


HUMANS = [
    ("player", 1.7, "average", "grey", "jeans", "hood", False, True),
    ("cook", 1.7, "stocky", "white", "dark", "tall_hat", False, False),
    ("old_wang", 1.7, "thin", "grey", "brown", "flat_cap", True, False),
    ("landlord", 1.62, "stocky", "dark", "brown", None, False, False),
    ("warehouse_boss", 1.76, "broad", "orange", "blue", "hard_hat", False, False),
    ("courier", 1.7, "thin", "yellow", "dark", "cap", False, False),
    ("fruit_seller", 1.62, "plump", "green", "brown", "straw_hat", False, False),
    ("clerk", 1.7, "average", "red", "dark", None, False, False),
    ("customer_a", 1.7, "thin", "white", "jeans", None, False, False),
    ("customer_b", 1.58, "plump", "purple", "purple", "visor", False, False),
    ("kid", 1.1, "average", "yellow", "red", "hood", False, True),
    ("bus_driver", 1.7, "average", "blue", "dark", "cap", False, False),
]


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    counts = {}
    for values in HUMANS:
        counts[values[0]] = make_human(*values)
    counts["cat"] = make_cat()
    counts["dog"] = make_dog()
    counts["pigeon"] = make_pigeon()
    for prop in ("chef_hat", "ladle", "clipboard", "delivery_bag", "hanging_scale", "key_ring", "trolley"):
        counts[prop] = make_prop(prop)
    print("PLACEHOLDERS characters=15 props=7 output=%s" % OUT_DIR)
    print("TRI_COUNTS " + " ".join("%s=%d" % item for item in sorted(counts.items())))


if __name__ == "__main__":
    main()
