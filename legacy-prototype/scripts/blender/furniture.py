"""Parked bicycle, drains, and interior furniture primitives."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import PALETTE, argv_out, box, cylinder, export_glb, mat, reset_scene


def bicycle(out: Path) -> None:
    reset_scene()
    ink = mat("bike_ink", PALETTE["ink"])
    slate = mat("bike_slate", PALETTE["slate"])
    terracotta = mat("bike_seat", PALETTE["terracotta"])
    objects = [
        cylinder("wheel_r", 0.32, 0.05, (-0.45, 0.32, 0), ink, 12),
        cylinder("wheel_f", 0.32, 0.05, (0.5, 0.32, 0), ink, 12),
        box("frame", (0.9, 0.05, 0.05), (0.05, 0.55, 0), slate),
        box("seat_post", (0.05, 0.42, 0.05), (-0.2, 0.52, 0), slate),
        box("fork", (0.05, 0.38, 0.05), (0.35, 0.5, 0), slate),
        box("seat", (0.22, 0.05, 0.12), (-0.15, 0.78, 0), terracotta),
        box("bars", (0.28, 0.04, 0.04), (0.48, 0.78, 0), slate),
    ]
    objects[0].rotation_euler[0] = 1.5708
    objects[1].rotation_euler[0] = 1.5708
    export_glb(out / "bicycle.glb", objects)


def furniture(out: Path) -> None:
    reset_scene()
    wood = mat("furn_wood", PALETTE["wood"])
    slate = mat("furn_slate", PALETTE["slate"])
    objects = [
        box("bed", (2.1, 0.38, 1.15), (0, 0.22, 0), wood),
        box("quilt", (2.0, 0.14, 1.05), (0, 0.46, 0), slate),
        box("table", (1.2, 0.08, 0.7), (2.4, 0.7, 0), wood),
        box("chair", (0.42, 0.08, 0.42), (2.4, 0.42, 0.85), wood),
        box("drain", (0.7, 0.04, 0.35), (0, 0.02, 2.5), slate),
    ]
    export_glb(out / "furniture.glb", objects)


if __name__ == "__main__":
    dest = argv_out()
    bicycle(dest)
    furniture(dest)
