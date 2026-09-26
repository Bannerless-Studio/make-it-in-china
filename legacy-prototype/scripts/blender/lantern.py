"""ART §7 lantern: lathed body, caps, tassels, hanging socket. No text or point light."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import PALETTE, argv_out, box, cylinder, export_glb, mat, reset_scene, sphere


def build(out: Path) -> None:
    reset_scene()
    ochre = mat("lantern_body", PALETTE["ochre"])
    wood = mat("lantern_wood", PALETTE["wood"])
    terracotta = mat("lantern_tassel", PALETTE["terracotta"])
    body = sphere("lantern_body", 0.22, (0, 0.21, 0), ochre, 12)
    body.scale = (1.0, 0.95, 1.0)
    objects = [
        body,
        cylinder("cap_top", 0.12, 0.04, (0, 0.44, 0), wood, 8),
        cylinder("cap_bottom", 0.12, 0.04, (0, 0.02, 0), wood, 8),
        box("tassel_0", (0.03, 0.15, 0.03), (0.08, -0.08, 0.08), terracotta),
        box("tassel_1", (0.03, 0.15, 0.03), (-0.08, -0.08, 0.08), terracotta),
        box("tassel_2", (0.03, 0.15, 0.03), (0.08, -0.08, -0.08), terracotta),
        box("tassel_3", (0.03, 0.15, 0.03), (-0.08, -0.08, -0.08), terracotta),
    ]
    export_glb(out / "lantern.glb", objects)


if __name__ == "__main__":
    build(argv_out())
