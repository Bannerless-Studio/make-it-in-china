#!/usr/bin/env python3
"""Street dressing set: 23 Chinese street props (lanterns, blank signs, awnings,
stools, poles, bikes, bins, trees, red door ...).

    blender -b --python tools/blender/sets/street.py

Outputs assets/street/*.glb, assets/street/manifest.json,
assets/street/sheet.png (true scale, all props) and
assets/street/sheet_detail.png (true scale, small props only). Idempotent.

Origins: ground props have base at z=0, centred. Wall/hanging props keep a
mount origin (documented per asset in the manifest ``mount`` field):
lantern/lantern_string/sign_hanging hang from origin (everything below z=0),
wall props (sign_vertical, sign_lightbox, awning*, ac_unit, red_door) have the
wall plane at Blender y=0 with the prop in front of it (-Y).

Manifest anchors are in glTF / three.js asset space: metres, +Y up, front of
the asset = +Z, relative to the asset origin (Blender (x, y, z) -> (x, z, -y)).
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from mathutils import Vector  # noqa: E402

from lib import build as B  # noqa: E402
from lib import export, manifest as M, mounts, sheet  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
OUT = os.path.join(ROOT, "assets", "street")
PI = math.pi

DEFAULT_TRIS = 800
TRI_BUDGET = {"lantern_string": 2500, "power_pole": 1200, "bicycle": 1500,
              "scooter_delivery": 1500, "tree_street": 900}
# expected main dimension per asset (Blender axis, metres) checked to +-12 %
EXPECT = {
    "lantern": ("x", .36), "lantern_string": ("x", 3.0), "steamer_stack": ("z", .45),
    "sign_hanging": ("x", 1.6), "sign_vertical": ("z", 1.6), "sign_aboard": ("z", .9),
    "sign_lightbox": ("x", 2.0), "awning": ("x", 4.0), "awning_small": ("x", 2.0),
    "stool_plastic": ("z", .45), "table_folding": ("x", 1.2), "ac_unit": ("x", .8),
    "power_pole": ("z", 7.0), "street_lamp": ("z", 5.0), "bicycle": ("x", 1.8),
    "scooter_delivery": ("x", 1.7), "bin_public": ("z", 1.0), "planter_pot": ("z", .9),
    "tree_street": ("z", 4.0), "bollard": ("z", .9), "laundry_pole": ("z", 2.2),
    "laundry_pole_bar": ("x", mounts.LAUNDRY_POLE_SPAN + .3),
    "water_urn": ("z", 1.1), "red_door": ("z", 2.6),
}
SMALL = ["lantern", "steamer_stack", "sign_hanging", "sign_vertical", "sign_aboard",
         "stool_plastic", "table_folding", "ac_unit", "bollard", "bin_public",
         "planter_pot", "water_urn"]


# ==========================================================================
# shared helpers
# ==========================================================================
def V(*a):
    return Vector(a[0] if len(a) == 1 else a)


def rod(p0, p1, r, material="metal", seg=6, **kw):
    """Round bar between two points."""
    return B.tube([tuple(p0), tuple(p1)], r, segments=seg, material=material, **kw)


def bar(p0, p1, w, d, material="metal", **kw):
    """Rectangular bar from p0 to p1 (w across local X, d across local Y)."""
    p0, p1 = V(p0), V(p1)
    length = (p1 - p0).length
    return B.box((w, d, length), material=material, loc=tuple((p0 + p1) / 2),
                 rot=B.aim(p1 - p0), **kw)


def sag(p0, p1, droop, n=6):
    """Points of a cord hanging between p0 and p1 with mid-span ``droop``."""
    p0, p1 = V(p0), V(p1)
    return [tuple(p0 + (p1 - p0) * (i / n) - V(0, 0, droop * 4 * (i / n) * (1 - i / n)))
            for i in range(n + 1)]


def stub(p0, direction, length, droop, n=5):
    """Half-span wire leaving a support: slope flattens toward the free end."""
    p0, d = V(p0), V(direction).normalized()
    return [tuple(p0 + d * (length * i / n) - V(0, 0, droop * (2 * i / n - (i / n) ** 2)))
            for i in range(n + 1)]


def chain(top, length, link=.018, wire=.0055, material="metal"):
    """Vertical chain of alternating torus links hanging down from ``top``."""
    top = V(top)
    pitch = link * 2.6
    n = max(2, int(round(length / pitch)))
    parts = []
    for i in range(n):
        z = top.z - link * 1.4 - i * pitch
        parts.append(B.torus(link, wire, 6, 3, material=material, smooth=False,
                             loc=(top.x, top.y, z), scale=(1, 1.45, 1),
                             rot=(PI / 2, 0, PI / 2 * (i % 2))))
    return parts


def hook_ring(top, r=.022, wire=.007, material="metal", seg=8):
    """Small ring in the XZ plane whose top touches ``top`` (hanging hook eye)."""
    top = V(top)
    return B.torus(r, wire, seg, 4, material=material, smooth=False,
                   loc=(top.x, top.y, top.z - r - wire), rot=(PI / 2, 0, 0))


def framed_board(w, h, t, face, frame, fw=.05, loc=(0, 0, 0)):
    """Blank board in the XZ plane (front -Y) with a raised frame. Returns
    (parts, inner (w, h))."""
    x, y, z = loc
    parts = [B.box((w - fw, t, h - fw), material=face, loc=(x, y, z))]
    ft = t + .02
    for sx in (-1, 1):
        parts.append(B.rounded_box((fw, ft, h), radius=.008, segments=1, material=frame,
                                   loc=(x + sx * (w - fw) / 2, y, z)))
    for sz in (-1, 1):
        parts.append(B.rounded_box((w - 2 * fw + .002, ft, fw), radius=.008, segments=1,
                                   material=frame, loc=(x, y, z + sz * (h - fw) / 2)))
    return parts, (w - 2 * fw, h - 2 * fw)


def text_face(pos, size, normal, colour):
    return {"pos": tuple(pos), "size": [round(size[0], 3), round(size[1], 3)],
            "normal": tuple(normal), "face_colour": colour}


def move(parts, offset):
    for p in parts:
        p.location = p.location + V(offset)
    return parts


class Asset:
    """One prop: joined object + anchors (Blender coords) + origin rule."""

    def __init__(self, name, parts, origin="feet", mount=None, anchors=None):
        self.obj = B.join(parts, name)
        self.name, self.origin, self.mount = name, origin, mount
        self.anchors = anchors or {}
        if origin == "feet":                   # re-centre and shift anchors by the same offset
            lo, hi = B.bbox(self.obj)
            off = V(-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z)
            B.set_origin_feet(self.obj)
            self.anchors = shift_anchors(self.anchors, off)


def shift_anchors(a, off):
    if isinstance(a, list):
        return [shift_anchors(x, off) for x in a]
    if isinstance(a, dict):
        return {k: (tuple(V(v) + off) if k == "pos" else shift_anchors(v, off)) for k, v in a.items()}
    return a


# ==========================================================================
# 1-2 lanterns
# ==========================================================================
def lantern_parts(top, h=.4, segs=16, rings=7):
    """Red ribbed paper lantern hanging from ``top`` (top of hook ring).
    h = hook + caps + body height; gold tassel hangs below."""
    k = h / .4
    x, y, z0 = top
    parts = [hook_ring(top, .022 * k, .007 * k, "metal", 8)]
    cap_top = z0 - .05 * k
    parts.append(B.cylinder(.08 * k, .035 * k, verts=segs, radius_top=.065 * k, material="gold",
                            loc=(x, y, cap_top - .0175 * k)))
    body_top = cap_top - .03 * k
    body_h = .29 * k
    ctrl = [(.07, 0), (.14, .045), (.18, .12), (.18, .17), (.14, .245), (.07, .29)]
    prof = B.catmull(ctrl, 2)[:: max(1, (len(B.catmull(ctrl, 2)) - 1) // (rings - 1))]
    if prof[-1] != ctrl[-1]:
        prof.append(ctrl[-1])
    lobes = segs // 2
    parts.append(B.lathe([(r * k, z * k) for r, z in prof], segments=segs, material="lantern_red",
                         loc=(x, y, body_top - body_h),
                         modulate=lambda th, t: 1 - .055 * (0.5 - 0.5 * math.cos(lobes * th))))
    cap_bot = body_top - body_h
    parts.append(B.cylinder(.065 * k, .03 * k, verts=segs, radius_top=.08 * k, material="gold",
                            loc=(x, y, cap_bot - .005 * k)))
    tz = cap_bot - .02 * k
    parts.append(B.sphere(.022 * k, segments=6, rings=4, material="gold", loc=(x, y, tz - .02 * k)))
    parts.append(B.cone(.04 * k, .14 * k, verts=8, radius_top=.012 * k, material="gold",
                        loc=(x, y, tz - .04 * k - .07 * k), rot=(PI, 0, 0)))
    return parts


def make_lantern():
    parts = lantern_parts((0, 0, 0))
    return Asset("lantern", parts, origin="hang",
                 mount="origin = top of hook ring; lantern hangs straight down (-Y glTF) from a "
                       "lantern_hook anchor",
                 anchors={"hook": {"pos": (0, 0, 0)}})


def make_lantern_string(span=mounts.LANTERN_STRING_SPAN, n=5, droop=.35):
    cord = sag((0, 0, -.05), (span, 0, -.05), droop, n=10)
    parts = [B.tube(cord, .008, segments=5, material="lantern_red"),
             hook_ring((0, 0, 0), .022, .007, "metal", 8),
             hook_ring((span, 0, 0), .022, .007, "metal", 8)]
    for i in range(n):
        t = (i + .5) / n
        cx = span * t
        cz = -.05 - droop * 4 * t * (1 - t)
        drop = .12 + .06 * (1 - abs(2 * t - 1))        # middle lanterns hang a bit lower
        parts.append(rod((cx, 0, cz), (cx, 0, cz - drop), .005, "gold", seg=4))
        parts += lantern_parts((cx, 0, cz - drop + .01), h=.32, segs=10, rings=5)
    return Asset("lantern_string", parts, origin="hang_left",
                 mount="origin = left end hook top; right end hook at +%.1f m X; cord sags %.2f m"
                       % (span, droop),
                 anchors={"hook_left": {"pos": (0, 0, 0)}, "hook_right": {"pos": (span, 0, 0)}})


# ==========================================================================
# 3 steamer stack
# ==========================================================================
def make_steamer_stack(tiers=3, r=.2, tier_h=.11):
    parts = []
    for i in range(tiers):
        z0 = i * tier_h
        parts.append(B.cylinder(r - .012, tier_h - .004, verts=12, material="straw",
                                loc=(0, 0, z0 + tier_h / 2)))
        for zb in (z0 + .012, z0 + tier_h - .012):
            parts.append(B.cylinder(r, .024, verts=12, material="bamboo_dark", loc=(0, 0, zb)))
    zl = tiers * tier_h
    parts.append(B.cylinder(r, .024, verts=12, material="bamboo_dark", loc=(0, 0, zl + .012)))
    parts.append(B.lathe([(r - .01, zl + .02), (r - .035, zl + .05), (r * .62, zl + .08),
                          (r * .3, zl + .097), (.03, zl + .1)], segments=12, material="straw"))
    parts.append(B.cylinder(.035, .025, verts=8, material="bamboo_dark", loc=(0, 0, zl + .102)))
    return Asset("steamer_stack", parts)


# ==========================================================================
# 4-7 blank signs
# ==========================================================================
def make_sign_hanging(w=1.6, h=.5, t=.05, drop=.25):
    zc = -drop - h / 2
    parts, inner = framed_board(w, h, t, "paper", "wood", loc=(0, 0, zc))
    for sx in (-1, 1):
        x = sx * (w / 2 - .2)
        parts.append(hook_ring((x, 0, 0), .02, .006, "metal", 8))
        parts += chain((x, 0, -.035), drop - .045)
        parts.append(B.box((.04, t + .03, .03), material="metal", loc=(x, 0, -drop + .005)))
    face = text_face((0, -t / 2 - .001, zc), inner, (0, -1, 0), "paper")
    return Asset("sign_hanging", parts, origin="hang",
                 mount="origin = midpoint between the two chain tops (chains at x=+-%.1f m); "
                       "board hangs below, face toward front" % (w / 2 - .2),
                 anchors={"text_face": face,
                          "chain_tops": [{"pos": (-(w / 2 - .2), 0, 0)}, {"pos": (w / 2 - .2, 0, 0)}]})


def make_sign_vertical(w=.4, h=1.6, t=.05, standoff=.12):
    parts, inner = framed_board(w, h, t, "lantern_red", "gold", fw=.045)
    B.rotate_about(parts, (0, 0, 0), (0, 0, PI / 2))           # board now in YZ plane, face +X
    move(parts, (0, -(standoff + w / 2), 0))
    parts.append(B.rounded_box((.12, .03, h * .95), radius=.008, segments=1, material="slate",
                               loc=(0, -.015, 0)))
    for sz in (-1, 1):
        z = sz * (h / 2 - .12)
        parts.append(bar((0, -.02, z), (0, -(standoff + .02), z), .04, .03, "slate"))
        parts.append(bar((0, -.02, z - sz * .2), (0, -standoff * .9, z), .025, .02, "slate"))
    yc = -(standoff + w / 2)
    ax = t / 2 + .001
    return Asset("sign_vertical", parts, origin="wall",
                 mount="origin = centre of the wall plate on the wall plane; board projects "
                       "%.2f-%.2f m out from the wall (+Z glTF), faces point along +-X"
                       % (standoff, standoff + w),
                 anchors={"text_face": text_face((ax, yc, 0), (inner[0], inner[1]), (1, 0, 0), "lantern_red"),
                          "text_face_back": text_face((-ax, yc, 0), (inner[0], inner[1]), (-1, 0, 0),
                                                      "lantern_red")})


def make_sign_aboard(w=.6, h=.9, t=.035, spread=.36):
    theta = math.atan2(spread / 2, h)
    L = h / math.cos(theta)
    parts = []
    face = None
    for side in (-1, 1):                      # -1 = front panel (leans back, bottom toward -Y)
        ps, inner = framed_board(w, L, t, "charcoal", "wood", fw=.045)
        B.rotate_about(ps, (0, 0, 0), (side * theta, 0, 0))
        move(ps, (0, side * spread / 4, h / 2))
        parts += ps
        if side == -1:
            n = V(0, -math.cos(theta), math.sin(theta))
            c = V(0, -spread / 4, h / 2) + n * (t / 2 + .001)
            face = text_face(c, inner, n, "charcoal")
    parts.append(B.cylinder(.018, w - .02, verts=8, material="metal", loc=(0, 0, h - .01),
                            rot=(0, PI / 2, 0)))
    zs = .3
    ys = (spread / 2) * (1 - zs / h) - .01
    for sx in (-1, 1):
        parts.append(rod((sx * (w / 2 - .06), -ys, zs), (sx * (w / 2 - .06), ys, zs), .006, "metal", 4))
    return Asset("sign_aboard", parts, anchors={"text_face": face})


def make_sign_lightbox(w=2.0, h=.6, d=.18):
    parts = [B.rounded_box((w, d, h), radius=.03, segments=2, material="red", loc=(0, -d / 2, 0)),
             B.box((w - .12, .012, h - .12), material="paper", loc=(0, -d - .004, 0))]
    for sx in (-1, 1):
        parts.append(B.box((.08, .04, .16), material="metal", loc=(sx * (w / 2 - .25), -.02, h / 2 + .06)))
        parts.append(bar((sx * (w / 2 - .25), -.02, h / 2 + .13), (sx * (w / 2 - .25), -d * .6, h / 2),
                         .025, .02, "metal"))
    return Asset("sign_lightbox", parts, origin="wall",
                 mount="origin = centre of the box back on the wall plane; box projects %.2f m (+Z glTF)" % d,
                 anchors={"text_face": text_face((0, -d - .011, 0), (w - .12, h - .12), (0, -1, 0), "paper")})


# ==========================================================================
# 8 awnings
# ==========================================================================
def make_awning(width=4.0, name="awning", stripe=.25, depth=1.1, fall=.45, valance=.25):
    n = max(2, int(round(width / stripe)))
    sw = width / n
    # profile (px, py) = (-Z, Y) extruded along X: slope + front valance
    prof = [(0, 0), (fall, -depth), (fall + valance, -depth), (fall + valance, -depth + .03),
            (fall + .02, -depth + .03), (.035, 0)]
    parts = []
    for i in range(n):
        xc = -width / 2 + sw * (i + .5)
        m = "red" if i % 2 == 0 else "cloth_white"
        parts.append(B.extrude_profile(prof, sw, material=m, loc=(xc, 0, 0), rot=(0, PI / 2, 0)))
        scal = [(sw / 2 * math.cos(a), -.09 * math.sin(a)) for a in (0, PI / 4, PI / 2, 3 * PI / 4, PI)]
        parts.append(B.extrude_profile(scal, .03, material=m, rot=(PI / 2, 0, 0),
                                       loc=(xc, -depth + .015, -fall - valance + .001)))
    parts.append(B.box((width + .04, .05, .06), material="slate", loc=(0, -.025, -.03)))
    for sx in (-1, 1):
        x = sx * (width / 2 - .05)
        parts.append(rod((x, -.02, -fall - .45), (x, -depth + .05, -fall + .03), .018, "slate"))
        parts.append(B.box((.06, .03, .12), material="slate", loc=(x, -.015, -fall - .45)))
    front = {"pos": (0, -depth - .001, -fall - valance / 2), "size": [round(width, 3), valance],
             "normal": (0, -1, 0), "face_colour": "red"}
    return Asset(name, parts, origin="wall",
                 mount="origin = top edge where awning meets the wall (wall mount line), centred X; "
                       "slopes %.2f m out (+Z glTF) and %.2f m down, valance to %.2f m below origin"
                       % (depth, fall, fall + valance + .09),
                 anchors={"valance_face": front})


def make_awning_small():
    return make_awning(2.0, "awning_small")


# ==========================================================================
# 9-10 stool, table
# ==========================================================================
def make_stool_plastic(h=.45, top=.3, colour="red"):
    parts = [B.rounded_box((top, top, .05), radius=.015, segments=2, material=colour, loc=(0, 0, h - .025)),
             B.rounded_box((top - .03, top - .03, .05), radius=.01, segments=1, material=colour,
                           loc=(0, 0, h - .07))]
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(B.tube([(sx * .11, sy * .11, h - .06), (sx * .15, sy * .15, 0)], [.024, .018],
                                segments=6, material=colour))
    zs = .15
    f = .15 - .04 * (zs / (h - .06))
    for a in range(4):
        c, s = [(1, 0), (0, 1), (-1, 0), (0, -1)][a]
        p = V(c * f, s * f, zs)
        q = V(-s, c, 0) * f
        parts.append(bar(p - q, p + q, .025, .02, colour))
    return Asset("stool_plastic", parts, anchors={"seat": {"pos": (0, 0, h)}})


def make_table_folding(w=1.2, d=.6, h=.75):
    parts = [B.rounded_box((w, d, .035), radius=.012, segments=2, material="wood", loc=(0, 0, h - .0175))]
    for sy in (-1, 1):
        parts.append(B.box((w - .1, .02, .05), material="metal", loc=(0, sy * (d / 2 - .04), h - .06)))
    for sx in (-1, 1):
        x = sx * (w / 2 - .12)
        for sy in (-1, 1):
            parts.append(rod((x, sy * (d / 2 - .05), .02), (x, -sy * (d / 2 - .06), h - .04), .016, "metal"))
            parts.append(B.cylinder(.022, .03, verts=6, material="charcoal", loc=(x, sy * (d / 2 - .05), .015)))
        parts.append(B.cylinder(.022, .06, verts=8, material="charcoal", loc=(x, 0, (h - .02) / 2),
                                rot=(0, PI / 2, 0)))
    parts.append(rod((-(w / 2 - .12), 0, (h - .02) / 2), (w / 2 - .12, 0, (h - .02) / 2), .013, "metal"))
    return Asset("table_folding", parts,
                 anchors={"top": {"pos": (0, 0, h), "size": [w, d]},
                          "seats": [{"pos": (0, -d / 2 - .35, 0)}, {"pos": (0, d / 2 + .35, 0)}]})


# ==========================================================================
# 11 AC unit
# ==========================================================================
def make_ac_unit(w=.8, d=.28, h=.55, gap=.06, lift=.3):
    yc, zc = -(gap + d / 2), lift + h / 2
    yf = -(gap + d)
    parts = [B.rounded_box((w, d, h), radius=.03, segments=2, material="cloth_white", loc=(0, yc, zc))]
    fx = -w / 2 + .24
    parts.append(B.cylinder(.2, .02, verts=14, material="charcoal", loc=(fx, yf - .005, zc), rot=(PI / 2, 0, 0)))
    parts.append(B.torus(.2, .014, 14, 4, material="cloth_grey", smooth=False, loc=(fx, yf - .012, zc),
                         rot=(PI / 2, 0, 0)))
    for dz in (-.12, -.06, 0, .06, .12):
        half = math.sqrt(max(.0, .2 ** 2 - dz ** 2))
        parts.append(B.box((2 * half, .012, .012), material="cloth_grey", loc=(fx, yf - .016, zc + dz)))
    parts.append(B.cylinder(.04, .02, verts=8, material="cloth_grey", loc=(fx, yf - .02, zc), rot=(PI / 2, 0, 0)))
    for i in range(4):
        parts.append(B.box((.2, .012, .02), material="cloth_grey", loc=(w / 2 - .17, yf - .004, zc - .12 + i * .08)))
    for sx in (-1, 1):
        x = sx * (w / 2 - .12)
        parts.append(B.box((.05, .02, .36), material="slate", loc=(x, -.01, lift - .12)))
        parts.append(B.box((.05, gap + d + .02, .04), material="slate", loc=(x, -(gap + d + .02) / 2, lift - .02)))
        parts.append(bar((x, -.03, .02), (x, -(gap + d * .85), lift - .03), .035, .02, "slate"))
    pipe = B.catmull([(w / 2 - .01, yc + .06, zc - .1), (w / 2 + .05, yc + .06, zc - .1),
                      (w / 2 + .05, -.045, zc - .05), (w / 2 + .05, -.022, zc - .05)], 2)
    parts.append(B.tube(pipe, .022, segments=6, material="cloth_white"))
    return Asset("ac_unit", parts, origin="wall",
                 mount="origin = wall plane at the bottom of the bracket wall plates, centred on the unit; "
                       "unit sits %.2f-%.2f m in front of the wall (+Z glTF), top at %.2f m"
                       % (gap, gap + d, lift + h))


# ==========================================================================
# 12-13 power pole, street lamp
# ==========================================================================
def insulator(base, material="cloth_white"):
    x, y, z = base
    ps = [B.cylinder(.012, .05, verts=6, material="slate", loc=(x, y, z + .025))]
    for i in range(3):
        ps.append(B.cylinder(.055 - i * .006, .028, verts=8, material=material, loc=(x, y, z + .05 + i * .04)))
    return ps, (x, y, z + .15)


def make_power_pole(h=6.85, arm_z=6.55, arm=1.8, reach=1.0):
    parts = [B.cylinder(.15, h, verts=8, radius_top=.1, material="concrete", loc=(0, 0, h / 2)),
             B.cylinder(.19, .25, verts=8, radius_top=.155, material="concrete", loc=(0, 0, .125)),
             B.box((.09, arm, .09), material="slate", loc=(0, 0, arm_z), bevel=.01)]
    for sy in (-1, 1):
        parts.append(bar((0, sy * .1, arm_z - .45), (0, sy * .55, arm_z - .04), .04, .03, "slate"))
    parts.append(B.box((.3, .3, .1), material="slate", loc=(0, 0, arm_z - .02)))
    tops = []
    for y, z in ((-arm / 2 + .12, arm_z + .045), (arm / 2 - .12, arm_z + .045), (0, h)):
        ps, top = insulator((0, y, z))
        parts += ps
        tops.append(top)
    ends = []
    for tp in tops:
        for sx in (-1, 1):
            pts = stub(tp, (sx, 0, 0), reach, .18)
            parts.append(B.tube(pts, .012, segments=4, material="charcoal"))
            ends.append({"pos": pts[-1]})
    bz = 5.0                                     # lower telecom bundle, clamped to the pole front
    parts.append(B.box((.16, .06, .16), material="slate", loc=(0, -.16, bz)))
    for sx in (-1, 1):
        for dy, dz in ((-.2, 0), (-.235, -.03), (-.2, -.055)):
            pts = stub((0, dy, bz + dz), (sx, 0, 0), reach, .28 + .03 * dz)
            parts.append(B.tube(pts, .014, segments=4, material="charcoal"))
    parts.append(B.box((.26, .02, .4), material="paper", loc=(0, -.155, 2.1)))   # blank flyer plate
    return Asset("power_pole", parts,
                 anchors={"wire_ends": ends, "flyer_face": text_face((0, -.166, 2.1), (.26, .4), (0, -1, 0), "paper")})


def make_street_lamp(h=5.0, reach=1.25):
    top = h - .5
    parts = [B.cylinder(.16, .5, verts=8, radius_top=.09, material="slate", loc=(0, 0, .25), bevel=.01),
             B.cylinder(.075, top - .5, verts=8, radius_top=.055, material="slate", loc=(0, 0, .5 + (top - .5) / 2)),
             B.cylinder(.09, .08, verts=8, material="slate", loc=(0, 0, 1.2))]
    arm = B.catmull([(0, 0, top - .1), (0, -.08, top + .3), (0, -.45, h - .08), (0, -reach, h - .1)], 3)
    parts.append(B.tube(arm, .035, segments=6, material="slate"))
    hy = -reach - .16
    parts.append(B.rounded_box((.36, .66, .12), radius=.035, segments=2, material="slate", loc=(0, hy, h - .15)))
    parts.append(B.box((.27, .54, .03), material="glass", loc=(0, hy, h - .222)))
    return Asset("street_lamp", parts, anchors={"light": {"pos": (0, hy, h - .24)}})


# ==========================================================================
# 14-15 bicycle, delivery scooter
# ==========================================================================
def wheel(x, r, tyre, rim_mat="metal", segs=16, spokes=3, z=None):
    z = r if z is None else z
    ps = [B.torus(r - tyre, tyre, segs, 4, material="charcoal", loc=(x, 0, z), rot=(PI / 2, 0, 0)),
          B.torus(r - 2 * tyre - .008, .01, segs, 3, material=rim_mat, smooth=False, loc=(x, 0, z), rot=(PI / 2, 0, 0)),
          B.cylinder(.03, .08, verts=8, material=rim_mat, loc=(x, 0, z), rot=(PI / 2, 0, 0))]
    for i in range(spokes):
        a = PI * i / spokes
        rr = r - 2 * tyre - .01
        ps.append(bar((x - rr * math.cos(a), 0, z - rr * math.sin(a)),
                      (x + rr * math.cos(a), 0, z + rr * math.sin(a)), .008, .008, rim_mat))
    return ps


def make_bicycle(r=.34, frame="work_blue"):
    ra, fa = V(-.53, 0, r), V(.53, 0, r)
    bb = V(-.04, 0, .3)
    st = V(-.2, 0, .83)
    ht_top, ht_bot = V(.4, 0, .9), V(.45, 0, .72)
    parts = wheel(ra.x, r, .028) + wheel(fa.x, r, .028)
    for p0, p1 in ((bb, st), (bb, ht_bot), (st, ht_top), (bb, ra), (st, ra), (ht_top, ht_bot)):
        parts.append(rod(p0, p1, .024 if (p0, p1) != (ht_top, ht_bot) else .032, frame))
    for sy in (-1, 1):
        parts.append(rod(ht_bot + V(0, sy * .035, 0), fa + V(0, sy * .035, 0), .016, frame))
    stem = V(.38, 0, 1.04)
    parts.append(rod(ht_top, stem, .018, "metal"))
    parts.append(B.tube([(.3, -.3, 1.08), (.36, -.26, 1.05), (.38, 0, 1.04), (.36, .26, 1.05), (.3, .3, 1.08)],
                        .016, segments=6, material="metal"))
    for sy in (-1, 1):
        parts.append(B.cylinder(.022, .1, verts=6, material="charcoal", loc=(.3, sy * .28, 1.08), rot=(PI / 2, 0, 0)))
    parts.append(rod(st, st + V(-.03, 0, .1), .016, "metal"))
    parts.append(B.rounded_box((.26, .14, .06), radius=.025, segments=1, material="charcoal", loc=(-.24, 0, .96)))
    # front basket on the head tube, rear rack
    bx, bz = .66, .9
    parts.append(B.box((.3, .36, .02), material="metal", loc=(bx, 0, bz)))
    for sx, sy, wx, wy in ((-1, 0, .02, .36), (1, 0, .02, .36), (0, -1, .3, .02), (0, 1, .3, .02)):
        parts.append(B.box((wx, wy, .2), material="metal", loc=(bx + sx * .14, sy * .17, bz + .1)))
    parts.append(bar(ht_top + V(.02, 0, -.05), V(bx - .1, 0, bz), .03, .03, "metal"))
    parts.append(B.box((.36, .16, .02), material="metal", loc=(-.58, 0, .74)))
    for sy in (-1, 1):
        parts.append(rod((-.72, sy * .07, .74), ra + V(0, sy * .05, 0), .01, "metal", 4))
    # mudguards
    for ax in (ra, fa):
        arc = [(ax.x + (r + .02) * math.cos(a), 0, ax.z + (r + .02) * math.sin(a))
               for a in [PI * (0.15 + 0.7 * i / 6) for i in range(7)]]
        parts.append(B.tube(arc, .03, segments=4, material=frame))
    # crank, pedals, chain guard, kickstand
    parts.append(B.cylinder(.08, .02, verts=10, material="metal", loc=(bb.x, -.06, bb.z), rot=(PI / 2, 0, 0)))
    for s in (-1, 1):
        pe = bb + V(s * .15, s * .1, 0)
        parts.append(rod(bb + V(0, s * .08, 0), pe, .012, "metal", 4))
        parts.append(B.box((.1, .07, .025), material="charcoal", loc=tuple(pe + V(0, s * .04, 0))))
    parts.append(B.rounded_box((.55, .02, .1), radius=.02, segments=1, material=frame,
                               loc=((bb.x + ra.x) / 2, -.06, (bb.z + ra.z) / 2 + .01),
                               rot=(0, -math.atan2(ra.z - bb.z, ra.x - bb.x), 0)))
    parts.append(rod(bb + V(-.12, .05, 0), V(-.34, .16, .0), .012, "metal", 4))
    return Asset("bicycle", parts, anchors={"seat": {"pos": (-.24, 0, .99)}})


def make_scooter_delivery(r=.22, body="cloth_white"):
    ra, fa = V(-.55, 0, r), V(.56, 0, r)
    parts = []
    for ax in (ra, fa):
        parts += [B.torus(r - .065, .065, 14, 4, material="charcoal", loc=tuple(ax), rot=(PI / 2, 0, 0)),
                  B.cylinder(.1, .11, verts=10, material="metal", loc=tuple(ax), rot=(PI / 2, 0, 0))]
    parts.append(B.rounded_box((.55, .3, .07), radius=.02, segments=1, material="charcoal", loc=(.08, 0, .3)))
    parts.append(B.rounded_box((.72, .34, .3), radius=.07, segments=2, material=body, loc=(-.38, 0, .48)))
    parts.append(B.rounded_box((.44, .28, .08), radius=.035, segments=2, material="charcoal", loc=(-.24, 0, .66)))
    shield = B.rounded_box((.12, .42, .55), radius=.04, segments=2, material=body, loc=(.41, 0, .6))
    B.rotate_about(shield, (.41, 0, .6), (0, math.radians(-14), 0))
    parts.append(shield)
    parts.append(rod(fa, (.48, 0, 1.0), .03, "metal"))
    for sy in (-1, 1):
        parts.append(rod(fa + V(0, sy * .07, 0), (.52, sy * .05, .6), .018, "metal"))
    arc = [(fa.x + (r + .03) * math.cos(a), 0, fa.z + (r + .03) * math.sin(a))
           for a in [PI * (0.12 + 0.6 * i / 5) for i in range(6)]]
    parts.append(B.tube(arc, .04, segments=5, material=body))
    parts.append(B.rounded_box((.2, .32, .15), radius=.04, segments=2, material=body, loc=(.5, 0, .99)))
    parts.append(B.cylinder(.055, .03, verts=10, material="yellow", loc=(.6, 0, .98), rot=(0, PI / 2, 0)))
    parts.append(B.tube([(.42, -.34, 1.06), (.46, -.14, 1.04), (.46, .14, 1.04), (.42, .34, 1.06)],
                        .016, segments=6, material="charcoal"))
    for sy in (-1, 1):
        parts.append(B.cylinder(.024, .1, verts=6, material="charcoal", loc=(.42, sy * .3, 1.06), rot=(PI / 2, 0, 0)))
        parts.append(rod((.46, sy * .2, 1.05), (.44, sy * .26, 1.24), .008, "metal", 4))
        parts.append(B.rounded_box((.02, .08, .05), radius=.01, segments=1, material="charcoal", loc=(.44, sy * .27, 1.26)))
    # rear rack + insulated delivery box
    parts.append(B.box((.46, .36, .03), material="slate", loc=(-.72, 0, .66)))
    parts.append(B.rounded_box((.44, .44, .4), radius=.04, segments=2, material="yellow", loc=(-.72, 0, .88)))
    parts.append(B.rounded_box((.46, .46, .05), radius=.02, segments=1, material="charcoal", loc=(-.72, 0, 1.06)))
    parts.append(B.box((.06, .03, .04), material="red", loc=(-.75, 0, .5)))
    parts.append(B.box((.03, .1, .05), material="red", loc=(-.745, 0, .52)))
    face = text_face((-.72, -.221, .86), (.34, .24), (0, -1, 0), "yellow")
    return Asset("scooter_delivery", parts, anchors={"seat": {"pos": (-.24, 0, .7)}, "box_side": face})


# ==========================================================================
# 16-19 bin, planter, tree, bollard
# ==========================================================================
def make_bin_public(h=1.0):
    parts = [B.box((.96, .44, .05), material="slate", loc=(0, 0, .025), bevel=.01),
             B.rounded_box((1.0, .48, .04), radius=.015, segments=1, material="slate", loc=(0, 0, h - .02))]
    for sx in (-1, 1):
        parts.append(B.box((.04, .06, h - .06), material="slate", loc=(sx * .48, 0, (h - .02) / 2)))
    anchors = {}
    for sx, col, key in ((-1, "work_blue", "label_left"), (1, "cloth_grey", "label_right")):
        x = sx * .225
        parts.append(B.rounded_box((.4, .38, .72), radius=.03, segments=2, material=col, loc=(x, 0, .41)))
        parts.append(B.rounded_box((.42, .4, .1), radius=.03, segments=2, material=col, loc=(x, 0, .82)))
        parts.append(B.box((.26, .02, .06), material="charcoal", loc=(x, -.195, .8)))
        parts.append(B.box((.28, .012, .14), material="cloth_white", loc=(x, -.193, .56)))
        anchors[key] = text_face((x, -.2, .56), (.28, .14), (0, -1, 0), "cloth_white")
    return Asset("bin_public", parts, anchors=anchors)


def make_planter_pot():
    parts = [B.lathe([(.16, 0), (.18, .03), (.23, .33), (.265, .335), (.27, .4), (.225, .4)],
                     segments=12, material="clay", smooth=True),
             B.cylinder(.225, .02, verts=12, material="khaki_brown", loc=(0, 0, .385))]
    lump = lambda th, t: 1 + .07 * math.cos(3 * th + 1.3) * math.sin(PI * t)  # noqa: E731
    parts.append(B.sphere((.31, .3, .27), segments=10, rings=6, material="leaf_green", loc=(0, 0, .63),
                          modulate=lump))
    parts.append(B.sphere(.15, segments=8, rings=5, material="canopy_green", loc=(-.17, -.12, .58)))
    parts.append(B.sphere(.13, segments=8, rings=5, material="leaf_green", loc=(.16, -.14, .74)))
    return Asset("planter_pot", parts)


def make_tree_street(h=4.0, grate=1.2):
    parts = [B.cylinder(.13, 2.5, verts=8, radius_top=.085, material="khaki_brown", loc=(0, 0, 1.25))]
    for d in ((.5, -.2, .6), (-.45, .1, .7), (.05, .45, .65)):
        parts.append(B.tube([(0, 0, 1.9), tuple(V(0, 0, 1.9) + V(d) * .9)], [.06, .03], segments=5,
                            material="khaki_brown"))
    lump = lambda th, t: 1 + .06 * math.cos(4 * th) * math.sin(PI * t)  # noqa: E731
    parts.append(B.sphere((1.2, 1.15, .95), segments=12, rings=7, material="leaf_green",
                          loc=(0, 0, h - .95), modulate=lump))
    for x, y, z, rad in ((.75, -.35, 2.55, .6), (-.8, -.2, 2.65, .58), (0, .7, 2.6, .55)):
        parts.append(B.sphere(rad, segments=8, rings=5, material="canopy_green", loc=(x, y, z)))
    parts.append(B.box((grate - .1, grate - .1, .02), material="khaki_brown", loc=(0, 0, .01)))
    for sx, sy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        if sx:
            parts.append(B.box((.08, grate, .05), material="slate", loc=(sx * (grate - .08) / 2, 0, .025)))
        else:
            parts.append(B.box((grate - .16, .08, .05), material="slate", loc=(0, sy * (grate - .08) / 2, .025)))
    for s in (-1, 1):
        parts.append(B.box((grate - .16, .035, .03), material="slate", loc=(0, s * .3, .03)))
        parts.append(B.box((.035, grate - .16, .03), material="slate", loc=(s * .3, 0, .03)))
    return Asset("tree_street", parts)


def make_bollard(h=.9, r=.1):
    parts = [B.cylinder(.14, .04, verts=10, material="slate", loc=(0, 0, .02)),
             B.cylinder(r, h - .08, verts=10, material="slate", loc=(0, 0, .04 + (h - .08) / 2)),
             B.lathe([(r, h - .04), (r * .8, h - .01), (0, h)], segments=10, material="slate")]
    for z in (h - .2, h - .34):
        parts.append(B.cylinder(r + .006, .07, verts=10, material="yellow", loc=(0, 0, z)))
    return Asset("bollard", parts)


# ==========================================================================
# 20-22 laundry pole, water urn, red door
# ==========================================================================
def garment(points, colour, x, top_z, depth=.018):
    return B.extrude_profile(points, depth, material=colour, loc=(x, 0, top_z), rot=(PI / 2, 0, 0))


def laundry_line(pz, span, cx=0.0):
    """Bamboo pole (span + 0.3 m long, centred on cx at height pz) with node
    bands, a shirt on a hanger, trousers, a towel and yellow pegs. Shared by
    the standing rack and the wall-mounted bar."""
    parts = [B.cylinder(.025, span + .3, verts=8, material="straw", loc=(cx, 0, pz), rot=(0, PI / 2, 0))]
    for x in (-.7, -.1, .5, 1.05):
        parts.append(B.cylinder(.03, .025, verts=8, material="bamboo_dark", loc=(cx + x, 0, pz),
                                rot=(0, PI / 2, 0)))
    shirt = [(-.08, 0), (-.04, -.035), (.04, -.035), (.08, 0), (.27, -.08), (.21, -.22), (.15, -.18),
             (.15, -.6), (-.15, -.6), (-.15, -.18), (-.21, -.22), (-.27, -.08)]
    trousers = [(-.18, 0), (.18, 0), (.2, -.85), (.04, -.85), (0, -.28), (-.04, -.85), (-.2, -.85)]
    towel = [(-.2, 0), (.2, 0), (.2, -.62), (.1, -.6), (0, -.63), (-.1, -.6), (-.2, -.62)]
    hz = pz - .04
    x = cx - .6
    parts.append(B.tube([(x, 0, pz + .03), (x + .02, 0, pz + .01), (x, 0, hz - .02), (x - .19, 0, hz - .1),
                         (x + .19, 0, hz - .1), (x, 0, hz - .02)], .006, segments=4, material="metal"))
    parts.append(garment(shirt, "cloth_white", x, hz - .09))
    parts.append(garment(trousers, "denim", cx + .15, pz - .01))
    parts.append(garment(towel, "pink", cx + .75, pz - .01))
    for x in (.02, .28, .6, .9):
        parts.append(B.box((.02, .03, .05), material="yellow", loc=(cx + x, 0, pz - .02)))
    return parts


def make_laundry_pole_bar(span=mounts.LAUNDRY_POLE_SPAN, r=.025):
    """Wall-mounted laundry pole (no legs) for building ``laundry_pole_mounts``:
    origin = left rest point (underside of the pole on the left cradle), right
    rest point at +span X; pole overhangs 0.15 m each end, laundry below."""
    parts = laundry_line(r, span, cx=span / 2)
    return Asset("laundry_pole_bar", parts, origin="rest_left",
                 mount="origin = left rest point (pole underside) on laundry_pole_mounts.left; right rest "
                       "point at +%.1f m X on laundry_pole_mounts.right" % span,
                 anchors={"rest_left": {"pos": (0, 0, 0)}, "rest_right": {"pos": (span, 0, 0)}})


def make_laundry_pole(h=2.2, span=2.0):
    """Free-standing laundry rack: two slate A-legs + the shared laundry line."""
    pz = h - .1
    parts = laundry_line(pz, span)
    for sx in (-1, 1):
        x = sx * span / 2
        parts.append(rod((x, 0, 0.03), (x, 0, h - .04), .02, "slate"))
        parts.append(B.box((.06, .55, .04), material="slate", loc=(x, 0, .02)))
        for sy in (-1, 1):
            parts.append(rod((x, 0, h - .14), (x, sy * .07, h), .012, "slate", 4))
    return Asset("laundry_pole", parts)


def make_water_urn(h=1.1):
    parts = []
    for z in (.2, .6):
        parts.append(B.rounded_box((.55, .45, .03), radius=.01, segments=1, material="metal", loc=(0, 0, z)))
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(rod((sx * .25, sy * .2, .07), (sx * .25, sy * .2, .6), .015, "slate"))
            parts.append(B.cylinder(.045, .03, verts=8, material="charcoal", loc=(sx * .25, sy * .2, .045),
                                    rot=(PI / 2, 0, 0)))
            parts.append(B.box((.02, .02, .04), material="slate", loc=(sx * .25, sy * .2, .075)))
    parts.append(B.tube([(.25, -.2, .6), (.33, -.2, .9), (.33, .2, .9), (.25, .2, .6)], .014, segments=6,
                        material="slate"))
    zb = .615
    parts.append(B.lathe([(.16, zb), (.2, zb + .03), (.2, zb + .36), (.17, zb + .41), (.12, zb + .43)],
                         segments=12, material="metal"))
    parts.append(B.lathe([(.125, zb + .43), (.12, zb + .45), (.07, zb + .47), (0, zb + .475)], segments=12,
                         material="slate"))
    parts.append(B.sphere(.022, segments=6, rings=4, material="charcoal", loc=(0, 0, h - .015)))
    parts.append(B.tube([(0, -.19, zb + .12), (0, -.26, zb + .12), (0, -.28, zb + .09)], .018, segments=6,
                        material="metal"))
    parts.append(B.box((.035, .05, .03), material="red", loc=(0, -.25, zb + .16)))
    parts.append(B.box((.025, .012, .2), material="glass", loc=(.09, -.18, zb + .24), rot=(0, 0, math.radians(25))))
    for sx in (-1, 1):
        parts.append(B.tube([(sx * .19, 0, zb + .34), (sx * .26, 0, zb + .33), (sx * .26, 0, zb + .25),
                             (sx * .2, 0, zb + .24)], .013, segments=4, material="charcoal"))
    for x in (-.14, -.06, .02):
        parts.append(B.cylinder(.028, .07, verts=8, radius_top=.034, material="paper", loc=(x, -.08, .25)))
    return Asset("water_urn", parts, anchors={"tap": {"pos": (0, -.28, zb + .07)},
                                              "cup_shelf": {"pos": (0, 0, .215)}})


def make_red_door(w=2.4, h=2.6, opening=1.5, door_h=2.1, sill=.12):
    post_w = (w - opening) / 2
    lintel_z = sill + door_h + .03
    parts = [B.box((opening, .16, sill), material="khaki_brown", loc=(0, -.08, sill / 2), bevel=.01)]
    for sx in (-1, 1):
        parts.append(B.box((post_w, .1, lintel_z), material="khaki_brown", loc=(sx * (w - post_w) / 2, -.05, lintel_z / 2),
                           bevel=.012))
    parts.append(B.box((w, .12, h - lintel_z), material="khaki_brown", loc=(0, -.06, (h + lintel_z) / 2), bevel=.012))
    lw = opening / 2 - .004
    for sx in (-1, 1):
        cx = sx * opening / 4
        parts.append(B.box((lw, .05, door_h), material="door_red", loc=(cx, -.035, sill + door_h / 2), bevel=.006))
        for i in range(3):
            for j in range(5):
                parts.append(B.cone(.022, .02, verts=6, material="gold", rot=(PI / 2, 0, 0),
                                    loc=(cx + (i - 1) * lw * .28, -.07, sill + .45 + j * .34)))
        kx = sx * .13
        parts.append(B.cylinder(.07, .015, verts=8, material="gold", loc=(kx, -.066, sill + 1.0), rot=(PI / 2, 0, 0)))
        parts.append(B.torus(.05, .01, 8, 3, material="gold", smooth=False, loc=(kx, -.078, sill + .95),
                             rot=(PI / 2, 0, 0)))
    anchors = {}
    cw, ch = .3, 1.7
    for sx, key in ((-1, "couplet_left"), (1, "couplet_right")):
        x = sx * (w - post_w) / 2
        parts.append(B.box((cw, .012, ch), material="lantern_red", loc=(x, -.106, .3 + ch / 2)))
        anchors[key] = text_face((x, -.113, .3 + ch / 2), (cw, ch), (0, -1, 0), "lantern_red")
    tz = (h + lintel_z) / 2
    parts.append(B.box((1.0, .012, .24), material="lantern_red", loc=(0, -.126, tz)))
    anchors["couplet_top"] = text_face((0, -.133, tz), (1.0, .24), (0, -1, 0), "lantern_red")
    anchors["door"] = {"pos": (0, -.3, 0), "facing": (0, -1, 0)}
    return Asset("red_door", parts, origin="wall",
                 mount="origin = wall plane at door threshold, centred; surround projects 0.16 m (+Z glTF)",
                 anchors=anchors)


BUILDERS = [make_lantern, make_lantern_string, make_steamer_stack, make_sign_hanging, make_sign_vertical,
            make_sign_aboard, make_sign_lightbox, make_awning, make_awning_small, make_stool_plastic,
            make_table_folding, make_ac_unit, make_power_pole, make_street_lamp, make_bicycle,
            make_scooter_delivery, make_bin_public, make_planter_pot, make_tree_street, make_bollard,
            make_laundry_pole, make_laundry_pole_bar, make_water_urn, make_red_door]
SIGNS = {"sign_hanging", "sign_vertical", "sign_aboard", "sign_lightbox"}
NEEDS_MOUNT = {"lantern", "lantern_string", "laundry_pole_bar", "awning", "awning_small", "ac_unit", "sign_hanging",
               "sign_vertical", "sign_lightbox"}


# ==========================================================================
# checks + manifest
# ==========================================================================
FRAME = M.FRAME   # glTF: metres, +Y up, front +Z, relative to asset origin


def gl(v):
    """Blender (x, y, z) -> glTF (x, z, -y), rounded."""
    x, y, z = v
    return [round(x, 4), round(z, 4), round(-y + 0.0, 4)]


def anchors_to_gltf(a):
    if isinstance(a, list):
        return [anchors_to_gltf(x) for x in a]
    if isinstance(a, dict):
        return {k: (gl(v) if k in ("pos", "normal", "facing") else anchors_to_gltf(v)) for k, v in a.items()}
    return a


def check(asset):
    obj, n = asset.obj, asset.name
    tris = B.tri_count(obj)
    budget = TRI_BUDGET.get(n, DEFAULT_TRIS)
    assert tris <= budget, "%s tris %d > %d" % (n, tris, budget)
    lo, hi = B.bbox(obj)
    eps = 2e-3
    if asset.origin == "feet":
        assert abs(lo.z) < 1e-4, "%s base z=%.4f" % (n, lo.z)
        assert abs(lo.x + hi.x) < eps and abs(lo.y + hi.y) < eps, "%s not centred" % n
    elif asset.origin == "hang":
        assert abs(hi.z) < eps and abs(lo.x + hi.x) < eps, "%s hang origin off (top %.4f)" % (n, hi.z)
    elif asset.origin == "hang_left":
        assert abs(hi.z) < eps and -.05 < lo.x < 0, "%s left hook origin off top=%.4f lox=%.4f" % (n, hi.z, lo.x)
    elif asset.origin == "rest_left":
        span = asset.anchors["rest_right"]["pos"][0]
        assert abs(lo.x + .15) < eps and abs(hi.x - span - .15) < eps, \
            "%s rest origin off lo.x=%.4f hi.x=%.4f" % (n, lo.x, hi.x)
    elif asset.origin == "wall":
        assert -.01 < hi.y < eps and abs(lo.x + hi.x) < .2, "%s wall plane off (max y %.4f)" % (n, hi.y)
    else:
        raise AssertionError(asset.origin)
    axis, want = EXPECT[n]
    got = getattr(hi - lo, axis)
    assert abs(got - want) / want <= .12, "%s %s=%.3f expected %.2f" % (n, axis, got, want)
    if n in SIGNS:
        assert "text_face" in asset.anchors, n
    if n in NEEDS_MOUNT:
        assert asset.mount, n
    return tris


def main():
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith(".glb") or f in ("manifest.json", "sheet.png", "sheet_detail.png"):
            os.remove(os.path.join(OUT, f))
    manifest, report = [], []
    for fn in BUILDERS:
        B.clear_scene()
        asset = fn()
        tris = check(asset)
        info = export.export_glb(asset.obj, os.path.join(OUT, asset.name + ".glb"))
        assert info["tris"] == tris
        entry = {"name": asset.name, "file": asset.name + ".glb", "tris": tris,
                 "size_m": [round(v, 3) for v in info["bbox"]],
                 "origin": asset.origin, "frame": FRAME, "anchors": anchors_to_gltf(asset.anchors)}
        if asset.mount:
            entry["mount"] = asset.mount
        manifest.append(entry)
        report.append("%-17s tris=%5d/%-5d size=%s origin=%s" % (
            asset.name, tris, TRI_BUDGET.get(asset.name, DEFAULT_TRIS),
            ",".join("%.2f" % v for v in info["bbox"]), asset.origin))
    assert len(manifest) == 24, len(manifest)
    manifest = M.write(OUT, manifest)
    print("SUMMARY %d GLBs in %s" % (len(manifest), OUT))
    for line in report:
        print("ASSET " + line)
    order = [e["file"] for e in manifest]
    sheet.render_sheet(OUT, os.path.join(OUT, "sheet.png"), cols=8, true_scale=True, files=order)
    sheet.render_sheet(OUT, os.path.join(OUT, "sheet_detail.png"), cols=6, true_scale=True,
                       files=[n + ".glb" for n in SMALL])


if __name__ == "__main__":
    main()
