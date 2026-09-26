"""Shared procedural asset library for Make It in China (Blender 4.2, bpy/bmesh only).

Modules:
    palette  one named, limited colour palette (linear RGB), shared by every set.
    build    scene reset, materials, bmesh primitives (box, rounded_box, cylinder,
             cone, sphere, capsule, loft, lathe, torus, tube, extrude_profile),
             join, origin, shading, bevel, transforms, deform, tri counts.
    export   export_glb(): the single GLB export path (+Y up, no anim/lights/cams).
    sheet    render_sheet(): labelled Workbench contact sheet from a GLB dir.

Set scripts live in tools/blender/sets/ and import this package with:

    import os, sys
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    from lib import build as B, export, sheet, palette
"""
import os

from . import palette, build, export, sheet  # noqa: F401

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
ASSETS = os.path.join(ROOT, "assets")
