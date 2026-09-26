#!/usr/bin/env python3
"""Render a labelled contact sheet for a GLB directory (thin wrapper over lib.sheet).

    blender -b --python tools/blender/render_sheet.py                      # assets/placeholders, fit mode
    blender -b --python tools/blender/render_sheet.py -- --dir assets/characters --fit --cols 7
    blender -b --python tools/blender/render_sheet.py -- --dir assets/props --true-scale
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from lib import sheet  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
PLACEHOLDERS = os.path.join(ROOT, "assets", "placeholders")

if __name__ == "__main__":
    sheet.main(default_dir=PLACEHOLDERS, default_true_scale=False, default_cols=6)
