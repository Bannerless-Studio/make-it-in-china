"""ART §7 fruit stall: counter, posts, striped canopy, crate/price sockets."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import PALETTE, argv_out, box, export_glb, mat, reset_scene


def build(out: Path) -> None:
    reset_scene()
    wood = mat("stall_wood", PALETTE["wood"])
    ochre = mat("stall_ochre", PALETTE["ochre"])
    paper = mat("stall_paper", PALETTE["paper"])
    terracotta = mat("stall_terracotta", PALETTE["terracotta"])
    objects = [
        box("counter", (2.8, 0.9, 0.8), (0, 0.45, 0), wood),
        box("post_0", (0.08, 2.5, 0.08), (-1.3, 1.25, -0.7), wood),
        box("post_1", (0.08, 2.5, 0.08), (1.3, 1.25, -0.7), wood),
        box("post_2", (0.08, 2.5, 0.08), (-1.3, 1.25, 0.7), wood),
        box("post_3", (0.08, 2.5, 0.08), (1.3, 1.25, 0.7), wood),
    ]
    stripes = [ochre, paper, ochre, terracotta, ochre, ochre]
    width = 3.2 / len(stripes)
    for i, material in enumerate(stripes):
        objects.append(box(f"canopy_{i}", (width, 0.08, 1.6), (-1.6 + width / 2 + i * width, 2.52, 0), material))
    bpy_empty = __import__("bpy")
    for i, x in enumerate((-0.8, 0.0, 0.8)):
        empty = bpy_empty.data.objects.new(f"crate_socket_{i}", None)
        empty.location = (x, 0.95, 0.1)
        bpy_empty.context.collection.objects.link(empty)
        objects.append(empty)
        anchor = bpy_empty.data.objects.new(f"price_anchor_{i}", None)
        anchor.location = (x, 1.35, 0.45)
        bpy_empty.context.collection.objects.link(anchor)
        objects.append(anchor)
    export_glb(out / "fruit_stall.glb", objects)


if __name__ == "__main__":
    build(argv_out())
