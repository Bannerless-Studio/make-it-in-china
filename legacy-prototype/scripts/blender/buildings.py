"""Eight district building shells. Parametric three.js fallbacks already ship."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import PALETTE, argv_out, box, cylinder, export_glb, mat, reset_scene

WALL = 3.2
LIP = 0.6


def shell(prefix: str, sx: float, sz: float, wall_hex: int, trim_hex: int) -> list:
    plaster = mat(f"{prefix}_wall", wall_hex)
    trim = mat(f"{prefix}_trim", trim_hex)
    paving = mat(f"{prefix}_floor", PALETTE["paving"])
    wood = mat(f"{prefix}_wood", PALETTE["wood"])
    objects = [
        box(f"{prefix}_floor", (sx, 0.06, sz), (0, 0.03, 0), paving),
        box(f"{prefix}_n", (sx, WALL, 0.3), (0, WALL / 2, -sz / 2), plaster),
        box(f"{prefix}_s_l", (sx / 2 - 1.2, WALL, 0.3), (-(sx / 4 + 0.6), WALL / 2, sz / 2), plaster),
        box(f"{prefix}_s_r", (sx / 2 - 1.2, WALL, 0.3), (sx / 4 + 0.6, WALL / 2, sz / 2), plaster),
        box(f"{prefix}_w", (0.3, WALL, sz), (-sx / 2, WALL / 2, 0), plaster),
        box(f"{prefix}_e", (0.3, WALL, sz), (sx / 2, WALL / 2, 0), plaster),
        box(f"{prefix}_roof", (sx + LIP, 0.22, sz + LIP), (0, WALL + 0.16, 0), trim),
        box(f"{prefix}_jamb_l", (0.12, 2.6, 0.12), (-1.2, 1.3, sz / 2), wood),
        box(f"{prefix}_jamb_r", (0.12, 2.6, 0.12), (1.2, 1.3, sz / 2), wood),
        box(f"{prefix}_sign", (2.2, 0.55, 0.1), (0, 2.55, sz / 2 + 0.2), wood),
    ]
    return objects


def tiled_roof(prefix: str, sx: float, sz: float, color: int) -> list:
    tile = mat(f"{prefix}_tile", color)
    objects = []
    for i in range(4):
        objects.append(
            box(
                f"{prefix}_tile{i}",
                (sx + LIP - i * 1.4, 0.1, sz + LIP - i * 1.4),
                (0, WALL + 0.12 + i * 0.14, 0),
                tile,
            )
        )
    return objects


def build_all(out: Path) -> None:
    specs = [
        ("building_room", 8, 8, PALETTE["plaster"], PALETTE["slate"], "room"),
        ("building_noodle", 10, 8, PALETTE["plaster"], PALETTE["terracotta"], "noodle"),
        ("building_shop", 10, 8, PALETTE["sage"], PALETTE["olive"], "shop"),
        ("building_warehouse", 10, 8, PALETTE["teal"], PALETTE["slate"], "warehouse"),
        ("building_tea", 10, 8, PALETTE["wood"], PALETTE["umber"], "tea"),
        ("building_bus", 8, 4, PALETTE["slate"], PALETTE["slate"], "bus"),
        ("building_fruit", 8, 4, PALETTE["ochre"], PALETTE["wood"], "fruit"),
        ("building_gate", 2, 8, PALETTE["slate"], PALETTE["wood"], "gate"),
    ]
    for name, sx, sz, wall, trim, kind in specs:
        reset_scene()
        objects = shell(name, sx, sz, wall, trim)
        if kind in {"noodle", "tea"}:
            objects.extend(tiled_roof(name, sx, sz, PALETTE["terracotta"]))
        if kind == "noodle":
            ochre = mat(f"{name}_awning", PALETTE["ochre"])
            objects.append(box(f"{name}_awning", (4.2, 0.08, 1.3), (0, 2.4, sz / 2 + 0.5), ochre))
            objects.append(cylinder(f"{name}_vent", 0.16, 0.7, (3.2, WALL + 0.7, -1.4), mat(f"{name}_vent", PALETTE["slate"]), 8))
        if kind == "warehouse":
            slate = mat(f"{name}_roll", PALETTE["slate"])
            for i in range(8):
                objects.append(box(f"{name}_slat{i}", (2.2, 0.22, 0.08), (0, 0.28 + i * 0.26, -sz / 2 - 0.12), slate))
        if kind == "room":
            slate = mat(f"{name}_balcony", PALETTE["slate"])
            objects.append(box(f"{name}_balcony", (2.4, 0.12, 0.9), (0, 1.7, sz / 2 + 0.15), slate))
        if kind == "gate":
            plaster = mat(f"{name}_clinic", PALETTE["plaster"])
            objects.append(box(f"{name}_clinic", (1.8, 2.5, 0.18), (-0.55, 1.25, -3.05), plaster))
        if kind == "fruit":
            ochre = mat(f"{name}_canopy", PALETTE["ochre"])
            objects.append(box(f"{name}_canopy", (6.8, 0.08, 2.2), (0, 2.5, 0), ochre))
        export_glb(out / f"{name}.glb", objects)


if __name__ == "__main__":
    build_all(argv_out())
