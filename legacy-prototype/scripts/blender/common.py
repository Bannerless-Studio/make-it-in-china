"""Shared bpy helpers for Phase 1 ART palette exports."""
from __future__ import annotations

import sys
from pathlib import Path

import bpy

PALETTE = {
    "ink": 0x171717,
    "paper": 0xFFF7E7,
    "plaster": 0xE7D6BA,
    "paving": 0xCBBCA6,
    "wood": 0x936C4C,
    "terracotta": 0xC65D3B,
    "sage": 0x6D8963,
    "slate": 0x526D82,
    "ochre": 0xD7AD55,
    "teal": 0x455A64,
    "umber": 0x8D6E63,
    "olive": 0x5B7C4D,
    "clay": 0xB56A3D,
}

REPO = Path(__file__).resolve().parents[2]


def argv_out() -> Path:
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if "--out" in args:
        return Path(args[args.index("--out") + 1])
    return REPO / "public" / "models" / "generated"


def srgb(hex_color: int) -> tuple[float, float, float, float]:
    return (
        ((hex_color >> 16) & 255) / 255.0,
        ((hex_color >> 8) & 255) / 255.0,
        (hex_color & 255) / 255.0,
        1.0,
    )


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name: str, hex_color: int) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = srgb(hex_color)
        bsdf.inputs["Metallic"].default_value = 0.0
        bsdf.inputs["Roughness"].default_value = 1.0
        if "Specular IOR Level" in bsdf.inputs:
            bsdf.inputs["Specular IOR Level"].default_value = 0.0
    return material


def assign(obj: bpy.types.Object, material: bpy.types.Material) -> None:
    if obj.data.materials:
        obj.data.materials[0] = material
    else:
        obj.data.materials.append(material)


def box(name: str, size: tuple[float, float, float], location: tuple[float, float, float], material: bpy.types.Material) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    assign(obj, material)
    return obj


def cylinder(name: str, radius: float, depth: float, location: tuple[float, float, float], material: bpy.types.Material, vertices: int = 12) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.active_object
    obj.name = name
    assign(obj, material)
    return obj


def sphere(name: str, radius: float, location: tuple[float, float, float], material: bpy.types.Material, segments: int = 12) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=8, radius=radius, location=location)
    obj = bpy.context.active_object
    obj.name = name
    assign(obj, material)
    return obj


def apply_and_weld(obj: bpy.types.Object) -> None:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.quads_convert_to_tris()
    bpy.ops.object.mode_set(mode="OBJECT")


def export_glb(path: Path, objects: list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        if obj.type == "MESH":
            apply_and_weld(obj)
        obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_cameras=False,
        export_extras=False,
    )
