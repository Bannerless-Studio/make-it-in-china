"""ART §7 signboard: bevelled board, wood rails, text_anchor, no font geometry."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import PALETTE, argv_out, box, export_glb, mat, reset_scene


def build(out: Path) -> None:
    reset_scene()
    wood = mat("sign_wood", PALETTE["wood"])
    ink = mat("sign_ink", PALETTE["ink"])
    objects = [
        box("board", (2.4, 0.65, 0.12), (0, 0.325, 0), wood),
        box("rail_l", (0.05, 0.7, 0.14), (-1.15, 0.35, 0), wood),
        box("rail_r", (0.05, 0.7, 0.14), (1.15, 0.35, 0), wood),
        box("face", (2.2, 0.5, 0.02), (0, 0.33, 0.07), ink),
    ]
    bpy = __import__("bpy")
    anchor = bpy.data.objects.new("text_anchor", None)
    anchor.location = (0, 0.33, 0.08)
    bpy.context.collection.objects.link(anchor)
    objects.append(anchor)
    export_glb(out / "signboard.glb", objects)


if __name__ == "__main__":
    build(argv_out())
