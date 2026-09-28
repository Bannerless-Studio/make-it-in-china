"""Rebuild only the polished player, updating its manifest entry and preview.

blender -b --python-exit-code 1 --python tools/blender/build_player.py
"""
import json
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from sets import characters as C
from lib import export, sheet, rig, manifest

bpy.context.scene.render.fps = rig.FPS
spec = next(s for s in C.SPEC if s["name"] == "player")
obj, height = C.make_human(spec)
C.check_human(obj, height, "player")
r = C.RIG["player"]
info = export.export_glb(obj, os.path.join(C.OUT, "player.glb"), armature=r["arm"])
path = os.path.join(C.OUT, "manifest.json")
with open(path) as f:
    entries = json.load(f)
entry = next(e for e in entries if e["name"] == "player")
entry.update(tris=info["tris"], size_m=[round(v, 3) for v in info["bbox"]], rig=C.rig_manifest("player", r))
entry["anchors"]["top"] = [0, round(info["bbox"][1], 4), 0]
with open(path, "w") as f:
    json.dump(entries, f, indent=1)
    f.write("\n")
manifest.build_index(os.path.join(C.ROOT, "assets"))
from verify_rig import check_json, check_blender
glb = os.path.join(C.OUT, "player.glb")
durations, frames, human = check_json("player", glb, entry)
check_blender("player", glb, entry, human)
print("PLAYER VERIFIED: skin, skeleton, grips, loops, stride, clips", durations)
sheet.render_sheet(C.OUT, os.path.join(C.ROOT, "shots", "mc-polish", "player-after.png"),
                   cols=1, true_scale=False, files=["player.glb"], resolution=(1000, 1000))
