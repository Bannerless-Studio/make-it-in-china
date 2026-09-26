"""One manifest convention for every asset set (see docs/asset-conventions.md).

Every ``assets/<set>/manifest.json`` is a list of entries::

    {name, file, tris, size_m:[x, y_up, z_depth], origin, frame: "gltf", anchors:{...}, ...set extras}

All positions are metres in **glTF / three.js asset axes** relative to the
asset origin: x right, y up, +z = asset front (towards the street / camera).
Blender (x, y, z) maps to glTF (x, z, -y).

Anchor value shapes (normalised by ``normalise_anchors``):

* point            ``[x, y, z]``   (a ``{pos}``-only dict is flattened to this)
* stand            ``{pos, facing}``  keys ``door``, ``entrance``, ``*_door``,
                   ``*_stand``; ``facing`` = unit xz direction a character
                   standing there looks (defaults to "towards the asset origin").
* face             ``{pos, size:[w, h], normal[, face_colour]}`` blank faces for
                   game text (sign_main, text_face, label_face, price_tag, ...).
* slots            list of points or ``{asset, pos, rot_y_deg}`` dicts.
* scalar           ``*_z`` heights (``floor_top_z``, ``dock_top_z``) = float glTF y.

Set scripts call ``write(out_dir, entries, ...)``; ``build_index`` concatenates
every set into ``assets/index.json``.
"""
import json
import math
import os

FRAME = "gltf"
KEEP_KEYS = ("size", "tilt_deg", "asset", "note", "external", "face_colour", "side", "height_m")
SETS = ("characters", "buildings", "street", "props", "interiors")


def _is_pt(v):
    return isinstance(v, (list, tuple)) and len(v) == 3 and all(isinstance(x, (int, float)) for x in v)


def _is_stand_key(k):
    return k in ("door", "entrance") or k.endswith("_stand") or k.endswith("_door")


def b2g(p):
    """Blender point/vector (x, y, z) -> glTF (x, z, -y)."""
    return [p[0], p[2], -p[1] if p[1] else 0.0]


def to_gltf(a):
    """Recursively convert a Blender-frame anchor structure to glTF axes.
    ``rot_z_deg`` (about Blender +Z) becomes ``rot_y_deg`` (about glTF +Y,
    same sign: the axis map is a proper rotation). ``*_z`` scalars are heights
    and already mean glTF y."""
    if isinstance(a, dict):
        out = {}
        for k, v in a.items():
            if k in KEEP_KEYS:
                out[k] = v
            elif k == "rot_z_deg":
                out["rot_y_deg"] = v
            else:
                out[k] = to_gltf(v)
        return out
    if _is_pt(a):
        return b2g(a)
    if isinstance(a, (list, tuple)):
        return [to_gltf(x) for x in a]
    return a


def size_to_gltf(s):
    """Blender bbox size (x, y, z) -> glTF [x, y_up, z_depth]."""
    return [s[0], s[2], s[1]]


def _toward_origin(p):
    x, z = -p[0], -p[2]
    n = math.hypot(x, z)
    if n < 1e-6:
        return [0.0, 0.0, 1.0]
    return [x / n, 0.0, z / n]


def normalise_anchors(anchors):
    """Apply the shape rules above (idempotent)."""
    out = {}
    for k, v in anchors.items():
        if isinstance(v, dict) and set(v) == {"pos"}:
            v = v["pos"]
        elif isinstance(v, list) and v and all(isinstance(d, dict) and set(d) == {"pos"} for d in v):
            v = [d["pos"] for d in v]
        if _is_stand_key(k):
            if _is_pt(v):
                v = {"pos": list(v), "facing": _toward_origin(v)}
            elif isinstance(v, dict) and "facing" not in v:
                v = dict(v, facing=_toward_origin(v["pos"]))
        if k.endswith("_z") and _is_pt(v):
            v = v[1]
        out[k] = v
    return out


def _round(v, nd=4):
    if isinstance(v, float):
        r = round(v, nd)
        return 0.0 if r == 0 else r
    if isinstance(v, dict):
        return {k: _round(x, nd) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_round(x, nd) for x in v]
    return v


def validate(entry):
    """Raise AssertionError if an entry breaks the convention."""
    n = entry.get("name")
    assert n and entry.get("file"), entry
    assert entry.get("frame") == FRAME, n
    if entry.get("external"):
        return
    assert isinstance(entry.get("size_m"), list) and len(entry["size_m"]) == 3, n
    assert isinstance(entry.get("anchors"), dict), n

    def walk(key, v):
        if isinstance(v, dict):
            if "normal" in v:
                assert _is_pt(v["normal"]) and abs(math.hypot(*v["normal"]) - 1) < 1e-3, (n, key, v)
                assert _is_pt(v["pos"]) and len(v["size"]) == 2, (n, key, v)
            if _is_stand_key(key):
                assert _is_pt(v["pos"]) and _is_pt(v["facing"]), (n, key, v)
            for k, x in v.items():
                walk(k, x)
        elif isinstance(v, list) and not _is_pt(v):
            for x in v:
                walk(key, x)
    for k, v in entry["anchors"].items():
        walk(k, v)


def write(out_dir, entries, origin_default="feet", blender_frame=False):
    """Normalise, validate and write ``out_dir/manifest.json``. Returns entries.

    blender_frame=True converts anchors and ``size_m`` from Blender axes."""
    done = []
    for e in entries:
        e = dict(e)
        if blender_frame and not e.get("external"):
            e["anchors"] = to_gltf(e.get("anchors", {}))
            e["size_m"] = size_to_gltf(e["size_m"])
            for k in ("hideable_walls",):
                if k in e:
                    e[k] = to_gltf(e[k])
        e.setdefault("origin", origin_default)
        e["frame"] = FRAME
        e["anchors"] = normalise_anchors(e.get("anchors") or {})
        e = _round(e)
        validate(e)
        done.append(e)
    with open(os.path.join(out_dir, "manifest.json"), "w") as fh:
        json.dump(done, fh, indent=1)
    print("MANIFEST %s entries=%d frame=%s" % (os.path.basename(out_dir.rstrip("/")), len(done), FRAME))
    return done


def build_index(assets_dir, sets=SETS):
    """Concatenate every set manifest into ``assets/index.json``.
    Adds ``set`` and ``path`` (relative to assets/); skips ``external``
    cross-references (the owning set already lists the asset)."""
    assets, counts = [], {}
    for s in sets:
        with open(os.path.join(assets_dir, s, "manifest.json")) as fh:
            m = json.load(fh)
        for e in m:
            if e.get("external"):
                continue
            validate(e)
            assets.append(dict({"set": s, "path": s + "/" + e["file"]}, **e))
            c = counts.setdefault(s, [0, 0])
            c[0] += 1
            c[1] += e.get("tris") or 0
    for a in assets:
        assert os.path.exists(os.path.join(assets_dir, a["path"])), a["path"]
    index = {"frame": FRAME, "axes": "metres; x right, y up, +z = asset front; relative to asset origin",
             "sets": {s: {"count": c[0], "tris": c[1]} for s, c in counts.items()}, "assets": assets}
    with open(os.path.join(assets_dir, "index.json"), "w") as fh:
        json.dump(index, fh, indent=1)
    print("INDEX assets=%d sets=%d -> %s" % (len(assets), len(counts), os.path.join(assets_dir, "index.json")))
    return index
