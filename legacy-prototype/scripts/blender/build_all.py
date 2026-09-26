"""Deterministic batch entry. Seed 17. Orchestrator-only; runtime does not need the GLBs."""
from __future__ import annotations

import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import buildings
import doorway
import fruit_stall
import furniture
import lantern
import signboard
import steamer
from common import argv_out

random.seed(17)


def main() -> None:
    out = argv_out()
    buildings.build_all(out)
    furniture.bicycle(out)
    furniture.furniture(out)
    lantern.build(out)
    fruit_stall.build(out)
    doorway.build(out)
    steamer.build(out)
    signboard.build(out)


if __name__ == "__main__":
    main()
