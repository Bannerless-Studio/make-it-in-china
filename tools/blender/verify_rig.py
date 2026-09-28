#!/usr/bin/env python3
"""Verify the rigged character GLBs (run after sets/characters.py).

    blender -b --python tools/blender/verify_rig.py [-- --extra OUT_DIR | --check-only]

For every character in assets/characters/manifest.json that has a ``rig``
block (15 humans + 3 pets) it checks, from the raw GLB JSON/binary AND a
Blender re-import:

* exactly one skin, one skinned mesh node, armature present on import;
* bone / joint names exactly the st-human-v1 (or st-pet-v1) set;
* clip names exactly idle, walk, talk, carry_idle, carry_walk (pets: idle);
* every clip's duration == manifest (24 fps), all channels same length;
* loops: first == last keyframe on every channel;
* attachment bones (RightHandGrip, LeftHandGrip, HeadTop): rest frame local
  +Y = world up and +Z = character front (glTF axes);
* walk: measured stance foot speed x cycle == manifest stride_m, planted foot
  stays on its rest height.

Prints one ``OK <name> ...`` line per character, then renders
assets/characters/sheet_pose.png (rest pose, 15 humans) and sheet_walk.png
(walk frame 12). ``--extra DIR`` also renders talk / carry_walk review sheets
into DIR. Exits 1 on the first failure.
"""
import json
import math
import os
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402
from mathutils import Matrix, Quaternion, Vector  # noqa: E402

from lib import ASSETS, rig, sheet  # noqa: E402
from lib import build as B  # noqa: E402

DIR = os.path.join(ASSETS, "characters")
COMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def read_glb(path):
    data = open(path, "rb").read()
    magic, _, _ = struct.unpack("<III", data[:12])
    assert magic == 0x46546C67, path
    jl, jt = struct.unpack("<II", data[12:20])
    j = json.loads(data[20:20 + jl])
    bl = struct.unpack("<I", data[20 + jl:24 + jl])[0]
    binary = data[28 + jl:28 + jl + bl]
    return j, binary


def accessor(j, binary, i):
    a = j["accessors"][i]
    assert a["componentType"] == 5126, a
    bv = j["bufferViews"][a["bufferView"]]
    n = COMP[a["type"]]
    off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = bv.get("byteStride", 4 * n)
    return [struct.unpack_from("<%df" % n, binary, off + k * stride) for k in range(a["count"])]


def node_mat(n):
    if "matrix" in n:
        m = n["matrix"]
        return Matrix([m[0:4], m[4:8], m[8:12], m[12:16]]).transposed()
    t = Vector(n.get("translation", (0, 0, 0)))
    x, y, z, w = n.get("rotation", (0, 0, 0, 1))
    s = n.get("scale", (1, 1, 1))
    S = Matrix.Diagonal((s[0], s[1], s[2], 1))
    return Matrix.Translation(t) @ Quaternion((w, x, y, z)).to_matrix().to_4x4() @ S


def check_json(name, path, entry):
    j, binary = read_glb(path)
    r = entry["rig"]
    human = r["skeleton"] == rig.HUMAN_SKELETON
    bones = rig.HUMAN_BONE_NAMES if human else rig.PET_BONE_NAMES
    clips = list(rig.HUMAN_CLIPS if human else rig.PET_CLIPS)
    assert len(j.get("skins", [])) == 1, "%s: skins=%d" % (name, len(j.get("skins", [])))
    skinned = [n for n in j["nodes"] if "mesh" in n and "skin" in n]
    assert len(skinned) == 1 and len(j["meshes"]) == 1, "%s: skinned mesh nodes=%d meshes=%d" % (
        name, len(skinned), len(j["meshes"]))
    joints = sorted(j["nodes"][i]["name"] for i in j["skins"][0]["joints"])
    assert joints == sorted(bones), "%s: joints %s" % (name, joints)
    anims = {a["name"]: a for a in j.get("animations", [])}
    assert sorted(anims) == sorted(clips), "%s: clips %s" % (name, sorted(anims))
    assert sorted(r["clips"]) == sorted(clips), name
    durs = {}
    for c in clips:
        a = anims[c]
        ends = set()
        for ch in a["channels"]:
            smp = a["samplers"][ch["sampler"]]
            t = [x[0] for x in accessor(j, binary, smp["input"])]
            ends.add(round(t[-1], 5))
            assert abs(t[0]) < 1e-6, "%s/%s starts at %.4f" % (name, c, t[0])
            if r["loop"][c]:
                v = accessor(j, binary, smp["output"])
                d = max(abs(p - q) for p, q in zip(v[0], v[-1]))
                assert d < 1e-4, "%s/%s channel %s/%s first != last (%.2e)" % (
                    name, c, j["nodes"][ch["target"]["node"]]["name"], ch["target"]["path"], d)
        assert len(ends) == 1, "%s/%s channel lengths differ %s" % (name, c, ends)
        dur = ends.pop()
        assert abs(dur - r["clip_durations_s"][c]) < 1e-3, "%s/%s duration %.3f vs %.3f" % (
            name, c, dur, r["clip_durations_s"][c])
        durs[c] = dur
    # rest world matrices of the attachment bones (glTF axes)
    parent = {}
    for i, n in enumerate(j["nodes"]):
        for ch in n.get("children", []):
            parent[ch] = i

    def world(i):
        m = node_mat(j["nodes"][i])
        while i in parent:
            i = parent[i]
            m = node_mat(j["nodes"][i]) @ m
        return m
    frames = {}
    for i, n in enumerate(j["nodes"]):
        if n.get("name") in ("RightHandGrip", "LeftHandGrip", "HeadTop"):
            w = world(i).to_3x3().normalized()
            ya, za = w.col[1], w.col[2]
            assert ya.dot(Vector((0, 1, 0))) > .999 and za.dot(Vector((0, 0, 1))) > .999, (
                "%s: %s frame +Y=%s +Z=%s" % (name, n["name"], tuple(ya), tuple(za)))
            frames[n["name"]] = tuple(round(v, 3) for v in world(i).translation)
    return durs, frames, human


def check_blender(name, path, entry, human):
    B.clear_scene()
    bpy.ops.import_scene.gltf(filepath=path)
    arms = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
    assert len(arms) == 1, "%s: armatures=%d" % (name, len(arms))
    shapes = {pb.custom_shape for pb in arms[0].pose.bones if pb.custom_shape}   # importer bone-display sphere
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH" and o not in shapes]
    assert len(meshes) == 1 and meshes[0].parent == arms[0], "%s: mesh not parented to armature %s" % (
        name, [(m.name, m.parent and m.parent.name) for m in meshes])
    assert any(m.type == "ARMATURE" and m.object is arms[0] for m in meshes[0].modifiers), name
    arm = arms[0]
    names = sorted(b.name for b in arm.data.bones)
    want = sorted(rig.HUMAN_BONE_NAMES if human else rig.PET_BONE_NAMES)
    assert names == want, "%s: bones %s" % (name, names)
    groups = {g.name for g in meshes[0].vertex_groups}
    # NPCs remain rigid. The hero blends only adjacent knee/elbow bones.
    allowed_pairs = {frozenset((s + a, s + b)) for s in ("Left", "Right")
                     for a, b in (("UpLeg", "Leg"), ("Arm", "ForeArm"))}
    for v in meshes[0].data.vertices:
        influences = [g for g in v.groups if g.weight > 1e-6]
        ws = [g.weight for g in influences]
        assert 1 <= len(ws) <= (2 if name == "player" else 1) and abs(sum(ws) - 1) < 1e-3, (
            "%s: vertex %d weights %s" % (name, v.index, ws))
        if len(ws) == 2:
            pair = frozenset(meshes[0].vertex_groups[g.group].name for g in influences)
            assert pair in allowed_pairs, "%s: unexpected blended bones %s" % (name, pair)
    stride = None
    if human:
        ad = arm.animation_data
        act = next(t.strips[0].action for t in ad.nla_tracks if t.name == "walk")
        for t in list(ad.nla_tracks):
            ad.nla_tracks.remove(t)
        ad.action = act
        n = int(act.frame_range[1] - act.frame_range[0])
        f0 = int(act.frame_range[0])
        pts = []
        for f in range(n + 1):
            bpy.context.scene.frame_set(f0 + f)
            pts.append((arm.matrix_world @ arm.pose.bones["LeftFoot"].head).copy())
        half = n // 2
        speed = (pts[half].y - pts[0].y) / (half / rig.FPS)
        stride = speed * n / rig.FPS
        lift = max(abs(p.z - pts[0].z) for p in pts[:half + 1])
        assert abs(stride - entry["rig"]["stride_m"]) < .01, "%s: stride %.3f vs manifest %.3f" % (
            name, stride, entry["rig"]["stride_m"])
        assert lift < 2e-3, "%s: planted foot moves %.4f m vertically" % (name, lift)
        # stance speed constant (no foot sliding against the ground)
        v = [(pts[i + 1].y - pts[i].y) for i in range(half)]
        assert max(v) - min(v) < 1e-3, "%s: stance foot speed varies %s" % (name, (min(v), max(v)))
    return len(groups), stride


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    extra = argv[argv.index("--extra") + 1] if "--extra" in argv else None
    bpy.context.scene.render.fps = rig.FPS
    man = json.load(open(os.path.join(DIR, "manifest.json")))
    rigged = [e for e in man if e.get("rig")]
    assert len(rigged) == 18, "expected 15 humans + 3 pets rigged, got %d" % len(rigged)
    humans = []
    for e in rigged:
        path = os.path.join(DIR, e["file"])
        durs, frames, human = check_json(e["name"], path, e)
        ngroups, stride = check_blender(e["name"], path, e, human)
        if human:
            humans.append(e["file"])
        print("OK %-17s %-11s bones=%d weighted=%d clips: %s%s" % (
            e["name"], e["rig"]["skeleton"], len(rig.HUMAN_BONE_NAMES if human else rig.PET_BONE_NAMES), ngroups,
            ", ".join("%s %.3fs%s" % (c, durs[c], "" if e["rig"]["loop"][c] else " once") for c in e["rig"]["clips"]),
            (" stride=%.3fm (manifest %.3f) grip_r=%s head_top=%s" % (
                stride, e["rig"]["stride_m"], frames["RightHandGrip"], frames["HeadTop"])) if human else ""))
    assert len(humans) == 15, len(humans)
    print("VERIFY_RIG OK %d characters (15 humans, 3 pets)" % len(rigged))
    if "--check-only" in argv:
        return
    kw = dict(cols=8, true_scale=True, files=humans, resolution=(2400, 1200))
    sheet.render_sheet(DIR, os.path.join(DIR, "sheet_pose.png"), **kw)
    sheet.render_sheet(DIR, os.path.join(DIR, "sheet_walk.png"), pose=("walk", 12), **kw)
    if extra:
        for clip, f in (("walk", 6), ("talk", 12), ("carry_walk", 6), ("carry_idle", 0), ("idle", 24)):
            sheet.render_sheet(DIR, os.path.join(extra, "sheet_%s_%d.png" % (clip, f)), pose=(clip, f), **kw)


if __name__ == "__main__":
    try:
        main()
    except BaseException as e:
        if isinstance(e, SystemExit) and not e.code:
            raise
        import traceback
        traceback.print_exc()
        sys.exit(1)
