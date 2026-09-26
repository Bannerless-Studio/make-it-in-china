"""ART §7 steamer: 12-sided cylinder, stepped rim, lid slats, lid pivot."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import PALETTE, argv_out, box, cylinder, export_glb, mat, reset_scene


def build(out: Path) -> None:
    reset_scene()
    wood = mat("steam_wood", PALETTE["wood"])
    ochre = mat("steam_ochre", PALETTE["ochre"])
    objects = [
        cylinder("body", 0.22, 0.14, (0, 0.07, 0), ochre, 12),
        cylinder("rim", 0.24, 0.03, (0, 0.15, 0), wood, 12),
    ]
    for i in range(6):
        slat = box(f"slat_{i}", (0.4, 0.03, 0.06), (0, 0.18, 0), wood)
        slat.rotation_euler[2] = i * 0.5236
        objects.append(slat)
    export_glb(out / "steamer.glb", objects)


if __name__ == "__main__":
    build(argv_out())
