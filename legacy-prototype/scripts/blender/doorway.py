"""ART §7 doorway: frame, leaves, clinic panel, bell and plaque sockets."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import PALETTE, argv_out, box, export_glb, mat, reset_scene, sphere


def build(out: Path) -> None:
    reset_scene()
    wood = mat("door_wood", PALETTE["wood"])
    slate = mat("door_slate", PALETTE["slate"])
    plaster = mat("door_plaster", PALETTE["plaster"])
    ochre = mat("door_bell", PALETTE["ochre"])
    objects = [
        box("post_l", (0.18, 2.6, 0.18), (-1.2, 1.3, 0), wood),
        box("post_r", (0.18, 2.6, 0.18), (1.2, 1.3, 0), wood),
        box("lintel", (2.58, 0.18, 0.18), (0, 2.69, 0), wood),
        box("leaf_l", (0.6, 2.4, 0.08), (-0.6, 1.2, 0.02), wood),
        box("leaf_r", (0.6, 2.4, 0.08), (0.6, 1.2, 0.02), wood),
        box("clinic_door", (1.2, 2.2, 0.08), (3.2, 1.1, 0), plaster),
        box("clinic_frame", (1.4, 2.4, 0.12), (3.2, 1.2, -0.04), slate),
        sphere("bell", 0.07, (3.85, 1.35, 0.08), ochre, 8),
    ]
    bpy = __import__("bpy")
    plaque = bpy.data.objects.new("plaque_anchor", None)
    plaque.location = (0, 2.9, 0.12)
    bpy.context.collection.objects.link(plaque)
    objects.append(plaque)
    export_glb(out / "doorway.glb", objects)
    reset_scene()
    wood = mat("leaf_wood", PALETTE["wood"])
    export_glb(out / "gate_leaf.glb", [box("gate_leaf", (0.6, 2.4, 0.08), (0, 1.2, 0), wood)])
    reset_scene()
    plaster = mat("clinic_plaster", PALETTE["plaster"])
    export_glb(out / "clinic_door.glb", [box("clinic_door", (1.2, 2.2, 0.08), (0, 1.1, 0), plaster)])


if __name__ == "__main__":
    build(argv_out())
