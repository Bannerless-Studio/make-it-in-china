#!/usr/bin/env python3
"""Job props + food + shop goods: porter boxes, dishwasher kitchenware,
delivery items, fruit and shop goods.

    blender -b --python tools/blender/sets/props.py

Outputs assets/props/*.glb, assets/props/manifest.json, assets/props/sheet.png
(true scale) and assets/props/sheet_small.png (fit mode, small items only).
Idempotent: old GLBs are deleted first.

Manifest anchors are in glTF / three.js axes (x right, y up, z toward the
asset's front), metres, relative to the asset origin (base centre, z=0).
Points are [x, y, z]; text faces are {pos, size:[w, h], normal}.
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from mathutils import Matrix, Vector  # noqa: E402

from lib import build as B  # noqa: E402
from lib import export, manifest as M, sheet  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
OUT = os.path.join(ROOT, "assets", "props")
PI = math.pi

DEFAULT_BUDGET = 500
BUDGET = {"hand_truck": 900, "sink_double": 900, "counter_noodle": 1500, "egg_tray": 900,
          "crate_apples": 900, "crate_oranges": 900, "crate_bananas": 900, "shelf_unit": 2000}
# Size-class assertion (height in metres, +-5%): the porter job teaches 大/小.
HEIGHT_CHECK = {"box_small": .3, "box_medium": .5, "box_large": .8}
SMALL_SHEET_MAX = 0.35      # items whose largest dimension <= this go on sheet_small.png


# ==========================================================================
# helpers
# ==========================================================================
def place(parts, loc=(0, 0, 0), rz=0.0):
    """Rotate parts about the origin by rz (Z) then move them by loc."""
    M = Matrix.Translation(Vector(loc)) @ Matrix.Rotation(rz, 4, "Z")
    for p in parts:
        p.matrix_basis = M @ p.matrix_basis
    return parts


def gl(v):
    """Blender (x, y, z) -> glTF (x, z, -y), rounded."""
    return [round(v[0], 4), round(v[2], 4), round(-v[1], 4)]


def text_face(pos, size, normal=(0, -1, 0)):
    return {"pos": pos, "size": size, "normal": normal}


def finish(parts, name, anchors=None, fit=None):
    """Join parts, put base at z=0 centred in XY, move anchors with the mesh.

    fit: optional target for the largest dimension (uniform scale; only for
    anchor-free props where the brief gives one overall size)."""
    obj = B.join(parts, name)
    lo, hi = B.bbox(obj)
    off = Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))
    B.translate_mesh(obj, off)
    if fit:
        assert not anchors, name
        d = hi - lo
        B.scale_mesh(obj, fit / max(d))
    out = {}
    for k, a in (anchors or {}).items():
        if isinstance(a, dict):
            out[k] = {"pos": gl(Vector(a["pos"]) + off), "size": [round(s, 4) for s in a["size"]],
                      "normal": gl(Vector(a["normal"]))}
        else:
            out[k] = gl(Vector(a) + off)
    return obj, out


def band(profile_fn, z0, z1, inflate=.0015, segs=12, material="work_blue"):
    """Thin open ring hugging a lathed surface between z0 and z1 (bowl rims,
    bottle labels, bag stripes). profile_fn(z) -> radius."""
    return B.loft([(z0, profile_fn(z0) + inflate, profile_fn(z0) + inflate),
                   (z1, profile_fn(z1) + inflate, profile_fn(z1) + inflate)],
                  segments=segs, cap_start=False, cap_end=False, material=material, name="band")


def interp(profile, z):
    """Radius of a (r, z) profile at height z (outer, monotonic-z part)."""
    for (r0, z0), (r1, z1) in zip(profile, profile[1:]):
        if z0 <= z <= z1 and z1 > z0:
            return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    return profile[-1][0]


# ==========================================================================
# porter
# ==========================================================================
def cardboard_box(w, d, h, loc=(0, 0, 0), rz=0.0):
    """Cardboard box parts: body, tape strip over the top and down front/back,
    shipping label on the front. Returns (parts, label text_face local)."""
    parts = [B.rounded_box((w, d, h), radius=min(.012, h * .04), segments=1, material="cardboard",
                           loc=(0, 0, h / 2), name="box")]
    tw = max(.05, w * .16)
    parts.append(B.box((tw, d + .004, .004), material="straw", loc=(0, 0, h + .001), name="tape"))
    for s in (-1, 1):
        parts.append(B.box((tw, .004, h * .28), material="straw", loc=(0, s * (d / 2 + .001), h - h * .14),
                           name="tape"))
    lw, lh = w * .34, h * .22
    lx, lz = -w * .22, h * .42
    parts.append(B.box((lw, .004, lh), material="paper", loc=(lx, -d / 2 - .001, lz), name="label"))
    # printed "this way up" bar under the label: chunky detail that separates box sizes
    parts.append(B.box((lw * .8, .003, h * .03), material="charcoal", loc=(lx, -d / 2 - .002, lz - lh * .75),
                       name="print"))
    place(parts, loc, rz)
    return parts


BOX_SIZES = {"box_small": (.32, .28, .3), "box_medium": (.5, .42, .5), "box_large": (.8, .64, .8)}


def make_box(name):
    w, d, h = BOX_SIZES[name]
    B.clear_scene()
    parts = cardboard_box(w, d, h)
    anchors = {"label_face": text_face((-w * .22, -d / 2 - .004, h * .42), (w * .34, h * .22)),
               "top": (0, 0, h + .003)}
    return finish(parts, name, anchors)


def make_box_small():
    return make_box("box_small")


def make_box_medium():
    return make_box("box_medium")


def make_box_large():
    return make_box("box_large")


def make_box_stack():
    B.clear_scene()
    L, M, S = BOX_SIZES["box_large"], BOX_SIZES["box_medium"], BOX_SIZES["box_small"]
    parts = cardboard_box(*L)
    parts += cardboard_box(*M, loc=(.06, .03, L[2] + .004), rz=math.radians(14))
    parts += cardboard_box(*S, loc=(-.02, .05, L[2] + M[2] + .008), rz=math.radians(-22))
    return finish(parts, "box_stack", {"top": (-.02, .05, L[2] + M[2] + S[2] + .01)})


def slat_crate(w, d, h, n_slats=2, lid=False, slat="wood", post="khaki_brown"):
    """Wooden slatted crate parts (open top unless lid)."""
    parts = []
    ps = .045
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(B.box((ps, ps, h), material=post, loc=(sx * (w / 2 - ps / 2), sy * (d / 2 - ps / 2), h / 2),
                               name="post"))
    pitch = h / n_slats
    sh = pitch * .64
    for i in range(n_slats):
        z = pitch * (i + .5) + pitch * .1
        for s in (-1, 1):
            parts.append(B.box((w - .01, .02, sh), material=slat, loc=(0, s * (d / 2 - .008), z), name="slat"))
            parts.append(B.box((.02, d - .03, sh), material=slat, loc=(s * (w / 2 - .008), 0, z), name="slat"))
    parts.append(B.box((w - .02, d - .02, .02), material=slat, loc=(0, 0, .012), name="floor"))
    if lid:
        for i in range(3):
            y = (i - 1) * d / 3
            parts.append(B.box((w, d / 3 * .82, .022), material=slat, loc=(0, y, h + .011), name="lid"))
    return parts


def make_crate_wood():
    B.clear_scene()
    w, d, h = .5, .4, .36
    parts = slat_crate(w, d, h, n_slats=3, lid=True)
    return finish(parts, "crate_wood", {"top": (0, 0, h + .022)})


def make_hand_truck():
    B.clear_scene()
    parts = []
    X = .18
    frame = [(-X, .03, .06), (-X, .07, .9), (-X, .11, 1.1), (-X * .75, .12, 1.18),
             (X * .75, .12, 1.18), (X, .11, 1.1), (X, .07, .9), (X, .03, .06)]
    parts.append(B.tube(frame, .017, segments=6, material="red", name="frame"))
    for z in (.38, .7):
        y = .03 + (.07 - .03) * (z - .06) / (.9 - .06)
        parts.append(B.tube([(-X, y, z), (X, y, z)], .012, segments=6, material="red", name="bar"))
    # grips at the top corners
    for s in (-1, 1):
        parts.append(B.tube([(s * X, .102, 1.05), (s * X, .114, 1.14)], .024, segments=6,
                            material="charcoal", name="grip"))
    # nose plate (toe) sticks forward (-Y) on the ground
    parts.append(B.box((.42, .24, .014), material="metal", loc=(0, -.09, .007), bevel=.004, name="nose"))
    parts.append(B.box((.42, .02, .1), material="metal", loc=(0, .03, .05), name="nose_back"))
    # wheels behind
    for s in (-1, 1):
        parts.append(B.cylinder(.12, .065, verts=12, material="charcoal", loc=(s * .245, .12, .12),
                                rot=(0, PI / 2, 0), name="wheel"))
        parts.append(B.cylinder(.055, .075, verts=8, material="metal", loc=(s * .245, .12, .12),
                                rot=(0, PI / 2, 0), name="hub"))
        parts.append(B.tube([(s * X, .05, .14), (s * .24, .12, .12)], .012, segments=6, material="red",
                            name="strut"))
    parts.append(B.tube([(-.25, .12, .12), (.25, .12, .12)], .012, segments=6, material="metal", name="axle"))
    return finish(parts, "hand_truck", {"load_plate": (0, -.09, .014), "handle": (0, .12, 1.18)})


def make_pallet():
    B.clear_scene()
    parts = []
    W, D = 1.2, 1.0
    for i in range(7):
        y = -D / 2 + .06 + i * (D - .12) / 6
        parts.append(B.box((W, .1, .022), material="wood", loc=(0, y, .133), name="deck"))
    for x in (-.55, 0, .55):
        parts.append(B.box((.1, D, .022), material="wood", loc=(x, 0, .111), name="stringer"))
        for y in (-.45, 0, .45):
            parts.append(B.box((.1, .1, .078), material="khaki_brown", loc=(x, y, .061), name="block"))
    for y in (-.45, 0, .45):
        parts.append(B.box((W, .1, .022), material="wood", loc=(0, y, .011), name="base"))
    return finish(parts, "pallet", {"top": (0, 0, .144)})


def make_sack_rice():
    B.clear_scene()
    rings = [(0, .19, .13), (.04, .235, .165), (.22, .235, .165), (.36, .21, .145), (.45, .13, .095),
             (.5, .045, .04), (.52, .055, .048), (.565, .1, .08), (.6, .085, .065), (.6, 0, 0)]
    fray = lambda th, t: 1 + (.22 * math.cos(5 * th) if t > .8 else 0)  # noqa: E731
    parts = [B.loft(rings, segments=12, exponent=3, modulate=fray, material="paper", name="sack")]
    parts.append(B.torus(.05, .015, 10, 5, material="khaki_brown", loc=(0, 0, .505), name="twine"))
    # printed red band around the belly
    def rx(z):
        for a, b in zip(rings, rings[1:]):
            if a[0] <= z <= b[0]:
                t = (z - a[0]) / (b[0] - a[0])
                return a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t
    (x0, y0), (x1, y1) = rx(.14), rx(.25)
    parts.append(B.loft([(.14, x0 + .004, y0 + .004), (.25, x1 + .004, y1 + .004)], segments=12, exponent=3,
                        cap_start=False, cap_end=False, material="red", name="print"))
    return finish(parts, "sack_rice", {"grip": (0, 0, .505)})


# ==========================================================================
# dishwasher / kitchen
# ==========================================================================
def bowl_parts(r=.08, h=.07, segs=12, colour="cloth_white", rim="work_blue", loc=(0, 0, 0)):
    """Hollow porcelain bowl with a blue band under the rim. Returns (parts, inner_z)."""
    t = .006
    prof = [(0, 0), (r * .45, 0), (r * .45, .01), (r * .7, h * .28), (r * .93, h * .62), (r, h),
            (r - t, h), (r * .93 - t, h * .62), (r * .66, h * .3), (0, h * .28)]
    outer = prof[1:6]
    parts = [B.lathe(prof, segments=segs, material=colour, smooth_angle=math.radians(70), name="bowl")]
    zb = h * .8
    parts.append(band(lambda z: interp(outer, z), zb, zb + h * .1, segs=segs, material=rim))
    place(parts, loc)
    return parts, h * .28


def noodles_parts(r=.08, h=.07, strands=3, loc=(0, 0, 0), segs=12):
    """Broth disc + wavy noodle strands + scallion bits sitting in a bowl."""
    zl = h * .8
    parts = [B.cylinder(r * .86, .004, verts=segs, material="broth", loc=(0, 0, zl), name="broth")]
    for i in range(strands):
        a0 = i * 2 * PI / strands
        pts = []
        for k in range(6):
            a = a0 + k * .6
            rr = r * (.2 + .45 * k / 5)
            pts.append((rr * math.cos(a), rr * math.sin(a), zl + .006 + .004 * math.sin(k * 1.7)))
        parts.append(B.tube(pts, .0055, segments=4, material="straw", name="noodle"))
    for i in range(3):
        a = .9 + i * 2.1
        parts.append(B.box((.012, .008, .004), material="leaf_green", rot=(0, 0, a),
                           loc=(r * .4 * math.cos(a), r * .4 * math.sin(a), zl + .012), name="scallion"))
    place(parts, loc)
    return parts


def chopstick_parts(length=.24, loc=(0, 0, 0), rz=0.0, lying=True, gap=.012):
    """Pair of wood chopsticks with red-lacquered tops, along +Y (tips at +Y)."""
    parts = []
    for s in (-1, 1):
        x = s * gap / 2
        parts.append(B.cylinder(.0048, length * .8, verts=5, radius_top=.0028, material="wood",
                                loc=(x, length * .1, 0), rot=(-PI / 2, 0, 0), name="stick"))
        parts.append(B.cylinder(.005, length * .2, verts=5, radius_top=.0048, material="lantern_red",
                                loc=(x, -length * .4, 0), rot=(-PI / 2, 0, 0), name="stick_top"))
    place(parts, loc, rz)
    return parts


def spoon_parts(loc=(0, 0, 0), rz=0.0, tilt=0.0):
    """Chinese porcelain soup spoon: shallow scoop + flat handle rising at +Y."""
    parts = [B.lathe([(0, 0), (.016, .002), (.022, .012), (.019, .013), (0, .005)], segments=8,
                     material="cloth_white", scale=(1, 1.4, 1), loc=(0, -.012, 0), name="scoop")]
    parts.append(B.box((.013, .065, .006), material="cloth_white", loc=(0, .045, .02),
                       rot=(math.radians(22), 0, 0), bevel=.002, name="handle"))
    B.rotate_about(parts, (0, 0, 0), (tilt, 0, 0))
    place(parts, loc, rz)
    return parts


def make_bowl_empty():
    B.clear_scene()
    parts, _ = bowl_parts()
    return finish(parts, "bowl_empty")


def make_bowl_noodles():
    B.clear_scene()
    parts, _ = bowl_parts()
    parts += noodles_parts()
    parts += chopstick_parts(loc=(.03, 0, .076), rz=math.radians(-70))
    return finish(parts, "bowl_noodles")


def make_bowl_soup():
    B.clear_scene()
    r, h = .08, .07
    parts, _ = bowl_parts(r, h)
    parts.append(B.cylinder(r * .86, .004, verts=12, material="broth", loc=(0, 0, h * .8), name="broth"))
    parts += spoon_parts(loc=(-.012, -.02, h * .8 + .002), rz=math.radians(-35), tilt=math.radians(10))
    return finish(parts, "bowl_soup")


def make_cup_glass():
    B.clear_scene()
    prof = [(0, 0), (.029, 0), (.035, .09), (.031, .09), (.026, .008), (0, .008)]
    parts = [B.lathe(prof, segments=12, material="glass", name="glass")]
    parts.append(B.cylinder(.031, .003, verts=12, material="sky_blue", loc=(0, 0, .055), name="water"))
    return finish(parts, "cup_glass")


def make_teacup():
    B.clear_scene()
    prof = [(0, 0), (.018, 0), (.02, .006), (.032, .04), (.035, .052), (.03, .052), (.027, .04),
            (.015, .01), (0, .01)]
    parts = [B.lathe(prof, segments=12, material="cloth_white", name="cup")]
    parts.append(B.cylinder(.029, .003, verts=12, material="straw", loc=(0, 0, .04), name="tea"))
    parts.append(band(lambda z: interp(prof[1:5], z), .03, .036, segs=12, material="work_blue"))
    return finish(parts, "teacup")


def make_teapot():
    B.clear_scene()
    body = [(0, 0), (.05, 0), (.055, .006), (.074, .04), (.077, .06), (.064, .09), (.036, .104), (0, .104)]
    parts = [B.lathe(body, segments=12, material="brick", name="pot")]
    parts.append(B.lathe([(0, .1), (.04, .1), (.037, .11), (.014, .117), (0, .118)], segments=12,
                         material="brick", name="lid"))
    parts.append(B.sphere(.013, 8, 5, material="brick", loc=(0, 0, .128), name="knob"))
    parts.append(B.tube([(-.06, 0, .035), (-.09, 0, .06), (-.105, 0, .09), (-.115, 0, .105)],
                        [.016, .012, .009, .008], segments=6, material="brick", name="spout"))
    parts.append(B.tube([(.064, 0, .085), (.1, 0, .088), (.112, 0, .06), (.1, 0, .03), (.068, 0, .028)],
                        .008, segments=6, material="brick", name="handle"))
    return finish(parts, "teapot", fit=.18)


def make_kettle():
    B.clear_scene()
    body = [(0, 0), (.1, 0), (.106, .012), (.1, .12), (.075, .16), (.04, .172), (0, .172)]
    parts = [B.lathe(body, segments=12, material="metal", name="kettle")]
    parts.append(B.sphere((.018, .018, .012), 8, 4, material="charcoal", loc=(0, 0, .178), name="knob"))
    parts.append(B.tube([(-.068, 0, .15), (-.06, 0, .205), (0, 0, .238), (.06, 0, .205), (.068, 0, .15)],
                        .011, segments=6, material="charcoal", name="handle"))
    parts.append(B.tube([(-.09, 0, .05), (-.14, 0, .1), (-.165, 0, .14)], [.022, .014, .01], segments=6,
                        material="metal", name="spout"))
    return finish(parts, "kettle")


def make_chopsticks():
    B.clear_scene()
    parts = chopstick_parts(rz=0.0)
    B.rotate_about(parts, (0, 0, 0), (0, 0, math.radians(8)))
    return finish(parts, "chopsticks")


def make_spoon():
    B.clear_scene()
    return finish(spoon_parts(), "spoon")


def tray_parts(w=.4, d=.3, colour="khaki_brown"):
    parts = [B.rounded_box((w, d, .012), radius=.004, segments=1, material=colour, loc=(0, 0, .006),
                           name="tray")]
    rh, rt = .028, .016
    for s in (-1, 1):
        parts.append(B.box((w, rt, rh), material=colour, loc=(0, s * (d / 2 - rt / 2), rh / 2), bevel=.004,
                           name="rim"))
        parts.append(B.box((rt, d - 2 * rt, rh), material=colour, loc=(s * (w / 2 - rt / 2), 0, rh / 2),
                           bevel=.004, name="rim"))
    return parts


def make_tray():
    B.clear_scene()
    return finish(tray_parts(), "tray", {"top": (0, 0, .012)})


def make_dish_rack():
    B.clear_scene()
    parts = []
    W, D = .5, .28
    parts.append(B.box((W, D, .01), material="slate", loc=(0, 0, .005), name="drip"))
    for s in (-1, 1):
        parts.append(B.box((W, .018, .018), material="metal", loc=(0, s * (D / 2 - .02), .02), name="rail"))
        parts.append(B.box((.018, D - .04, .018), material="metal", loc=(s * (W / 2 - .01), 0, .02),
                           name="rail"))
    xs = [-.2, -.1, 0, .1, .2]
    for x in xs:
        for y in (-.07, .07):
            parts.append(B.box((.008, .008, .13), material="metal", loc=(x, y, .09), name="tine"))
    # 4 plates standing in the slots between tines
    for x in (-.15, -.05, .05, .15):
        parts.append(B.cylinder(.1, .012, verts=10, radius_top=.088, material="cloth_white",
                                loc=(x, 0, .128), rot=(0, PI / 2, 0), name="plate"))
        parts.append(B.cylinder(.101, .004, verts=10, material="work_blue", loc=(x - .004, 0, .128),
                                rot=(0, PI / 2, 0), name="plate_rim"))
    return finish(parts, "dish_rack")


def make_wok_on_burner():
    B.clear_scene()
    parts = [B.rounded_box((.38, .38, .12), radius=.015, segments=1, material="slate", loc=(0, 0, .06),
                           name="burner")]
    parts.append(B.box((.3, .006, .04), material="charcoal", loc=(0, -.192, .06), name="dial_panel"))
    for x in (-.08, .08):
        parts.append(B.cylinder(.018, .02, verts=8, material="metal", loc=(x, -.2, .06), rot=(PI / 2, 0, 0),
                                name="dial"))
    parts.append(B.torus(.07, .014, 10, 4, material="metal", loc=(0, 0, .128), name="ring"))
    for a in range(4):
        th = a * PI / 2 + PI / 4
        parts.append(B.box((.1, .018, .03), material="charcoal", rot=(0, 0, th),
                           loc=(.1 * math.cos(th), .1 * math.sin(th), .135), name="prong"))
    wok = [(0, 0), (.08, .006), (.15, .04), (.18, .09), (.174, .092), (.144, .044), (.077, .012), (0, .008)]
    z0 = .15
    parts.append(B.lathe(wok, segments=12, material="charcoal", loc=(0, 0, z0), name="wok"))
    parts.append(B.tube([(.17, 0, z0 + .085), (.24, 0, z0 + .11), (.3, 0, z0 + .13)], .014, segments=6,
                        material="metal", name="neck"))
    parts.append(B.tube([(.26, 0, z0 + .118), (.34, 0, z0 + .148)], .02, segments=6, material="wood",
                        name="handle"))
    # food in the wok
    for i, (c, a) in enumerate((("leaf_green", .4), ("red", 2.3), ("straw", 4.1), ("leaf_green", 5.3))):
        parts.append(B.box((.04, .025, .014), material=c, rot=(0, 0, a * 1.3),
                           loc=(.055 * math.cos(a), .055 * math.sin(a), z0 + .02 + .004 * i), name="food"))
    return finish(parts, "wok_on_burner")


def make_sink_double():
    B.clear_scene()
    parts = []
    W, D, H = 1.2, .6, .85
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(B.cylinder(.025, .1, verts=6, material="slate", loc=(sx * .55, sy * .25, .05),
                                    name="leg"))
    parts.append(B.box((W, D, .5), material="metal", loc=(0, 0, .35), bevel=.006, name="cabinet"))
    wt = .04
    zc, hw = .6 + .125, .25
    for s in (-1, 1):
        parts.append(B.box((W, wt, hw), material="metal", loc=(0, s * (D / 2 - wt / 2), zc), bevel=.006,
                           name="wall"))
    for x in (-(W / 2 - wt / 2), 0, W / 2 - wt / 2):
        parts.append(B.box((wt, D - 2 * wt, hw), material="metal", loc=(x, 0, zc), bevel=.006, name="wall"))
    for s in (-1, 1):
        cx = s * W / 4
        parts.append(B.box((W / 2 - 1.5 * wt, D - 2 * wt, .006), material="slate", loc=(cx, 0, .603),
                           name="basin_floor"))
        parts.append(B.cylinder(.025, .004, verts=8, material="charcoal", loc=(cx, 0, .608), name="drain"))
    parts.append(B.box((W / 2 - 1.5 * wt, D - 2 * wt, .005), material="glass", loc=(W / 4, 0, .69),
                       name="water"))
    # backsplash + gooseneck taps
    parts.append(B.box((W, .03, .2), material="metal", loc=(0, D / 2 - .015, H + .1), bevel=.005,
                       name="splash"))
    for s in (-1, 1):
        x = s * W / 4
        parts.append(B.tube([(x, .26, H), (x, .26, 1.0), (x, .22, 1.06), (x, .15, 1.06), (x, .12, 1.0)],
                            .013, segments=6, material="metal", name="tap"))
        for dx in (-.06, .06):
            parts.append(B.box((.035, .03, .03), material="red" if dx < 0 else "work_blue",
                               loc=(x + dx, .25, H + .03), bevel=.004, name="valve"))
    # cabinet doors: centre gap + chunky handles
    parts.append(B.box((.012, .006, .44), material="slate", loc=(0, -D / 2 - .002, .35), name="door_gap"))
    for s in (-1, 1):
        parts.append(B.box((.02, .025, .16), material="charcoal", loc=(s * .06, -D / 2 - .012, .42),
                           bevel=.005, name="handle"))
    anchors = {"worker_stand": (0, -.55, 0), "basin_left": (-W / 4, 0, .61), "basin_right": (W / 4, 0, .61)}
    return finish(parts, "sink_double", anchors)


def make_counter_noodle():
    B.clear_scene()
    parts = []
    W, D, H = 2.4, .6, .92
    parts.append(B.box((W, D, H - .1), material="wood", loc=(0, 0, .1 + (H - .1) / 2), name="body"))
    parts.append(B.box((W - .02, D - .02, .1), material="charcoal", loc=(0, .01, .05), name="kick"))
    parts.append(B.box((W + .08, D + .1, .05), material="metal", loc=(0, 0, H + .025), bevel=.008, name="top"))
    parts.append(B.box((W, .012, .12), material="lantern_red", loc=(0, -D / 2 - .006, H - .1), name="trim"))
    # vertical front battens (panelled front)
    for i in range(1, 6):
        x = -W / 2 + i * W / 6
        parts.append(B.box((.03, .014, H - .28), material="khaki_brown", loc=(x, -D / 2 - .007, .1 + (H - .28) / 2 + .02),
                           name="batten"))
    # pass-through shelf on posts
    zs = 1.4
    for x in (-1.12, 0, 1.12):
        parts.append(B.box((.05, .05, zs - H - .05), material="metal", loc=(x, 0, (H + .05 + zs) / 2), name="post"))
    parts.append(B.box((W, .32, .04), material="metal", loc=(0, 0, zs + .02), bevel=.008, name="shelf"))
    parts.append(B.box((W, .012, .05), material="lantern_red", loc=(0, -.166, zs + .02), name="shelf_trim"))
    bowls = []
    for x in (-.7, 0, .7):
        bp, _ = bowl_parts(segs=10, loc=(x, 0, zs + .04))
        parts += bp
        parts += noodles_parts(strands=2, segs=10, loc=(x, 0, zs + .04))
        bowls.append((x, 0, zs + .04))
    anchors = {"npc_stand": (0, .85, 0), "player_stand": (0, -.85, 0), "pass_shelf": (0, 0, zs + .04),
               "front_panel": text_face((0, -D / 2 - .013, H - .1), (W, .12))}
    for i, b in enumerate(bowls):
        anchors["bowl_%d" % (i + 1)] = b
    return finish(parts, "counter_noodle", anchors)


# ==========================================================================
# delivery
# ==========================================================================
def make_takeaway_box():
    B.clear_scene()
    parts = [B.loft([(0, .085, .062), (.058, .098, .073)], segments=16, exponent=5, material="cloth_white",
                    smooth=False, name="tub")]
    parts.append(B.loft([(.056, .102, .077), (.07, .1, .075), (.08, .088, .064)], segments=16, exponent=5,
                        material="glass", smooth=False, name="lid"))
    parts.append(B.box((.03, .16, .004), material="red", loc=(0, 0, .081), name="seal"))
    return finish(parts, "takeaway_box", {"top": (0, 0, .082)})


def make_takeaway_bag():
    B.clear_scene()
    rings = [(0, .09, .05), (.02, .115, .07), (.14, .125, .075), (.2, .1, .06), (.235, .055, .032),
             (.25, .02, .016)]
    parts = [B.loft(rings, segments=12, exponent=3, material="cloth_white", name="bag")]
    parts.append(B.loft([(.07, .122, .0735), (.11, .1255, .0765)], segments=12, exponent=3,
                        cap_start=False, cap_end=False, material="red", name="stripe"))
    parts.append(B.sphere((.028, .022, .02), 8, 4, material="cloth_white", loc=(0, 0, .258), name="knot"))
    for s in (-1, 1):
        parts.append(B.tube([(0, 0, .262), (s * .035, 0, .285), (s * .06, 0, .292), (s * .055, 0, .27),
                             (s * .02, 0, .255)], .007, segments=5, material="cloth_white", name="ear"))
    return finish(parts, "takeaway_bag", {"grip": (0, 0, .27)})


def make_door_plate():
    B.clear_scene()
    parts = [B.rounded_box((.2, .014, .1), radius=.006, segments=1, material="navy", loc=(0, 0, .05),
                           name="plate")]
    parts.append(B.box((.176, .004, .076), material="cloth_white", loc=(0, -.008, .05), name="face"))
    for sx in (-1, 1):
        parts.append(B.cylinder(.004, .004, verts=6, material="metal", loc=(sx * .094, -.008, .05),
                                rot=(PI / 2, 0, 0), name="screw"))
    return finish(parts, "door_plate", {"text_face": text_face((0, -.0102, .05), (.176, .076)),
                                        "mount": (0, .007, .05)})


# ==========================================================================
# fruit and goods
# ==========================================================================
def make_apple():
    B.clear_scene()
    prof = [(0, .008), (.022, 0), (.037, .014), (.041, .036), (.037, .06), (.022, .073), (.007, .067), (0, .064)]
    parts = [B.lathe(prof, segments=10, material="red", name="apple")]
    parts.append(B.tube([(0, 0, .062), (.003, 0, .088)], .0035, segments=4, material="khaki_brown", name="stem"))
    parts.append(B.sphere((.015, .006, .003), 6, 3, material="leaf_green", loc=(.013, 0, .082),
                          rot=(0, -.4, 0), name="leaf"))
    return finish(parts, "apple")


def make_orange():
    B.clear_scene()
    parts = [B.sphere((.042, .042, .039), 10, 6, material="hivis_orange", loc=(0, 0, .039), name="orange")]
    parts.append(B.cylinder(.008, .006, verts=5, material="leaf_green", loc=(0, 0, .079), name="calyx"))
    parts.append(B.sphere((.013, .006, .003), 6, 3, material="leaf_green", loc=(.012, 0, .081), rot=(0, -.3, 0),
                          name="leaf"))
    return finish(parts, "orange")


def make_tomato():
    B.clear_scene()
    parts = [B.sphere((.036, .036, .029), 10, 6, material="red", loc=(0, 0, .029),
                      modulate=lambda th, t: 1 + .06 * math.cos(5 * th), name="tomato")]
    star = []
    for i in range(10):
        a = i * PI / 5
        rr = .02 if i % 2 == 0 else .007
        star.append((rr * math.cos(a), rr * math.sin(a)))
    parts.append(B.extrude_profile(star, .004, material="leaf_green", loc=(0, 0, .058), name="calyx"))
    parts.append(B.cylinder(.003, .012, verts=4, material="leaf_green", loc=(0, 0, .064), name="stem"))
    return finish(parts, "tomato")


def banana_parts(length=.18, loc=(0, 0, 0), rz=0.0, radius=.017, segs=5, tips=True, n=5):
    """One curved banana along +X from the crown at the origin, tip curling up."""
    pts, radii = [], []
    for k in range(n + 1):
        t = k / n
        pts.append((length * t, 0, .5 * radius + .045 * length / .18 * t * t))
        radii.append(radius * (.45 + .55 * math.sin(PI * min(.95, .12 + t * .83))))
    parts = [B.tube(pts, radii, segments=segs, cap=True, material="yellow", name="banana")]
    if tips:
        parts.append(B.tube([pts[-1], (pts[-1][0] + .008, 0, pts[-1][2] + .006)], radii[-1] * .9, segments=4,
                            material="charcoal", name="tip"))
    place(parts, loc, rz)
    return parts


def bunch_parts(n=5, length=.18, loc=(0, 0, 0), rz=0.0, tips=True, segs=5, steps=5, radius=.017):
    parts = []
    for i in range(n):
        a = (i - (n - 1) / 2) * .24
        layer = .016 if i % 2 else 0.0
        parts += banana_parts(length * (1 - .06 * abs(i - (n - 1) / 2)), loc=(0, 0, layer), rz=a, tips=tips,
                              segs=segs, n=steps, radius=radius)
    parts.append(B.tube([(.01, 0, .012), (-.02, 0, .02), (-.04, 0, .04)], [.014, .011, .009], segments=segs,
                        material="khaki_brown", name="crown"))
    place(parts, loc, rz)
    return parts


def make_banana_bunch():
    B.clear_scene()
    return finish(bunch_parts(), "banana_bunch")


def make_watermelon_slice():
    B.clear_scene()
    R, half, T = .22, math.radians(35), .06
    n = 8
    angs = [-PI / 2 - half + 2 * half * i / n for i in range(n + 1)]

    def arc(rr):
        return [(rr * math.cos(a), R + rr * math.sin(a)) for a in angs]
    rot = (PI / 2, 0, 0)
    parts = [B.extrude_profile([(0, R)] + arc(.8 * R), T, material="red", rot=rot, name="flesh")]
    for (r0, r1, c) in ((.8 * R, .88 * R, "paper"), (.88 * R, R, "dark_green")):
        a, b = arc(r0), arc(r1)
        for i in range(n):
            parts.append(B.extrude_profile([a[i], a[i + 1], b[i + 1], b[i]], T, material=c, rot=rot, name="rind"))
    for (x, z) in ((-.03, .1), (.025, .09), (0, .14), (-.012, .06), (.035, .045)):
        for s in (-1, 1):
            parts.append(B.box((.007, .004, .011), material="charcoal", loc=(x, s * (T / 2 + .001), z), name="seed"))
    return finish(parts, "watermelon_slice")


def make_cabbage():
    B.clear_scene()
    rc = .08
    parts = [B.sphere((rc * .9, rc * .9, rc), 10, 6, material="leaf_pale", loc=(0, 0, rc), name="heart")]
    for k in range(4):
        rings = []
        for i, phi in enumerate((-80, -40, -5, 20)):
            p = math.radians(phi)
            rr = (rc + .006) * math.cos(p) * (1 + .45 * (i / 3) ** 2)
            rings.append((rc * .88 + (rc + .006) * math.sin(p), rr, rr))
        parts.append(B.loft(rings, segments=4, arc=(-.85, .85), thickness=.004, material="leaf_green",
                            rot=(0, 0, k * PI / 2 + .3), name="leaf"))
    return finish(parts, "cabbage")


def plate_parts(r=.08, loc=(0, 0, 0), rim="navy", segs=12):
    prof = [(0, 0), (r * .62, 0), (r * .95, r * .15), (r, r * .2), (r * .94, r * .21), (r * .6, r * .08), (0, r * .08)]
    parts = [B.lathe(prof, segments=segs, material="cloth_white", name="plate")]
    parts.append(band(lambda z: interp(prof[1:4], z), r * .15, r * .195, segs=segs, material=rim))
    place(parts, loc)
    return parts, r * .08


def make_bao_bun():
    B.clear_scene()
    parts, zt = plate_parts(.075)
    prof = [(0, 0), (.045, .002), (.05, .016), (.043, .036), (.022, .05), (0, .054)]
    parts.append(B.lathe(prof, segments=12, material="paper", loc=(0, 0, zt),
                         modulate=lambda th, t: 1 + .06 * math.cos(8 * th) * t, name="bun"))
    parts.append(B.sphere(.005, 6, 3, material="lantern_red", loc=(0, 0, zt + .054), name="dot"))
    return finish(parts, "bao_bun")


def dumpling_part(loc, rz):
    d = B.sphere((.032, .02, .019), 6, 4, material="paper", name="dumpling")
    B.deform(d, lambda v: Vector((v.x, v.y + 5 * v.x * v.x, v.z + .018)))
    crest = B.tube([(x, 5 * x * x + .002, .035) for x in (-.026, 0, .026)], .0055, segments=4,
                   material="paper", name="crest")
    parts = [d, crest]
    place(parts, loc, rz)
    return parts


def make_dumpling_plate():
    B.clear_scene()
    parts, zt = plate_parts(.12, segs=10)
    for i in range(6):
        x, y = (i % 3 - 1) * .07, (-.035 if i < 3 else .035)
        parts += dumpling_part((x, y, zt), 0.0)
    return finish(parts, "dumpling_plate")


def make_bottle_water():
    B.clear_scene()
    prof = [(0, 0), (.03, 0), (.032, .012), (.032, .165), (.022, .197), (.012, .213), (.012, .225), (0, .225)]
    parts = [B.lathe(prof, segments=10, material="glass", name="bottle")]
    parts.append(band(lambda z: interp(prof[1:4], z), .08, .135, inflate=.0015, segs=10, material="sky_blue"))
    parts.append(B.cylinder(.0145, .026, verts=10, material="navy", loc=(0, 0, .237), name="cap"))
    return finish(parts, "bottle_water")


def make_milk_carton():
    B.clear_scene()
    w, hb = .07, .145
    parts = [B.box((w, w, hb), material="cloth_white", loc=(0, 0, hb / 2), name="carton")]
    parts.append(B.extrude_profile([(-w / 2, 0), (w / 2, 0), (0, .035)], w, material="cloth_white",
                                   rot=(PI / 2, 0, PI / 2), loc=(0, 0, hb), name="gable"))
    parts.append(B.box((w, .008, .018), material="cloth_white", loc=(0, 0, hb + .035 + .007), name="fin"))
    parts.append(B.box((w + .003, w + .003, .05), material="work_blue", loc=(0, 0, .055), name="band"))
    return finish(parts, "milk_carton", {"text_face": text_face((0, -w / 2 - .002, .055), (w, .05))})


def make_tea_box():
    B.clear_scene()
    parts = [B.rounded_box((.1, .07, .125), radius=.005, segments=1, material="dark_green", loc=(0, 0, .0625),
                           name="tin")]
    parts.append(B.rounded_box((.104, .074, .026), radius=.004, segments=1, material="yellow", loc=(0, 0, .137),
                               name="lid"))
    parts.append(B.box((.06, .004, .07), material="paper", loc=(0, -.036, .065), name="label"))
    return finish(parts, "tea_box", {"text_face": text_face((0, -.0382, .065), (.06, .07))})


def make_egg_tray():
    B.clear_scene()
    cols, rows, p = 6, 5, .05
    W, D = cols * p + .02, rows * p + .02
    parts = [B.box((W, D, .03), material="concrete", loc=(0, 0, .015), name="tray")]
    for i in range(cols):
        for j in range(rows):
            x, y = (i - (cols - 1) / 2) * p, (j - (rows - 1) / 2) * p
            parts.append(B.loft([(.03, .021, .021), (.05, .017, .017), (.064, 0, 0)], segments=8, cap_start=False,
                                material="egg_shell", loc=(x, y, 0), name="egg"))
    return finish(parts, "egg_tray", {"top": (0, 0, .064)})


def make_rice_bag():
    B.clear_scene()
    rings = [(0, .15, .06), (.02, .165, .085), (.26, .165, .082), (.42, .16, .055), (.48, .16, .014),
             (.5, .155, .006)]
    parts = [B.loft(rings, segments=16, exponent=4, material="cloth_white", name="bag")]
    parts.append(B.box((.2, .006, .17), material="red", loc=(0, -.084, .2), name="label"))
    parts.append(B.box((.14, .006, .05), material="paper", loc=(0, -.088, .2), name="label_text"))
    parts.append(B.box((.33, .004, .03), material="leaf_green", loc=(0, -.083, .06), name="stripe"))
    parts.append(B.box((.08, .006, .022), material="charcoal", loc=(0, -.02, .46), name="handle_slot"))
    return finish(parts, "rice_bag", {"text_face": text_face((0, -.0915, .2), (.14, .05)), "grip": (0, 0, .46)})


def fruit_sphere(colour, r, loc):
    return B.sphere((r, r, r * .92), 6, 4, material=colour, loc=loc, smooth=True, smooth_angle=math.radians(80),
                    name="fruit")


def make_display_crate(name, fruit):
    B.clear_scene()
    w, d, h = .5, .38, .2
    parts = slat_crate(w, d, h, n_slats=2)
    parts.append(B.box((w - .04, d - .04, .02), material="khaki_brown", loc=(0, 0, h * .62), name="fill_floor"))
    zf = h * .62 + .01
    if fruit == "banana":
        for i, y in enumerate((-.095, 0, .095)):
            parts += bunch_parts(4, .21, loc=(-.11 + .03 * (i % 2), y, zf), rz=(.12 if i % 2 else -.12), tips=False,
                                 segs=5, steps=4, radius=.021)
    else:
        colour, r = {"apple": ("red", .046), "orange": ("hivis_orange", .047)}[fruit]
        for i in range(4):
            for j in range(3):
                x, y = (i - 1.5) * .105, (j - 1) * .105
                parts.append(fruit_sphere(colour, r, (x, y, zf + r * .92)))
        for (x, y) in ((-.1, -.05), (0, -.05), (.1, -.05), (-.05, .05), (.05, .05)):
            parts.append(fruit_sphere(colour, r, (x, y, zf + r * .92 + r * 1.3)))
        if fruit == "apple":
            for (x, y) in ((-.1, -.05), (.05, .05)):
                parts.append(B.box((.005, .005, .016), material="khaki_brown",
                                   loc=(x, y, zf + r * .92 + r * 2.2 + .006), name="stem"))
    # price tag board on a stick in the back corner
    tz = h + .16
    parts.append(B.box((.012, .012, .2), material="wood", loc=(.19, .14, h + .06), name="tag_stick"))
    parts.append(B.box((.13, .01, .085), material="paper", loc=(.19, .13, tz), bevel=.003, name="tag"))
    anchors = {"price_tag": text_face((.19, .13 - .0055, tz), (.13, .085)), "top": (0, 0, zf + .09)}
    return finish(parts, name, anchors)


def make_crate_apples():
    return make_display_crate("crate_apples", "apple")


def make_crate_oranges():
    return make_display_crate("crate_oranges", "orange")


def make_crate_bananas():
    return make_display_crate("crate_bananas", "banana")


def make_shelf_unit():
    B.clear_scene()
    parts = []
    W, D, H = 1.0, .4, 1.8
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(B.box((.035, .035, H), material="slate", loc=(sx * (W / 2 - .0175), sy * (D / 2 - .0175), H / 2),
                               name="upright"))
    parts.append(B.box((W - .03, .01, H - .1), material="plaster", loc=(0, D / 2 - .01, H / 2 + .02), name="back"))
    levels = [.12, .56, 1.0, 1.44]
    for z in levels + [H - .02]:
        parts.append(B.box((W, D, .025), material="metal", loc=(0, 0, z), name="shelf"))
    for z in levels:
        parts.append(B.box((W, .006, .035), material="lantern_red", loc=(0, -D / 2 - .003, z - .005), name="price_strip"))
    top = [z + .0125 for z in levels]
    # shelf 1: big cardboard boxes
    for i, x in enumerate((-.32, 0, .32)):
        parts.append(B.box((.28, .3, .3 - .04 * (i % 2)), material="cardboard", loc=(x, .02, top[0] + .15 - .02 * (i % 2)),
                           name="goods_box"))
        parts.append(B.box((.08, .004, .06), material="paper", loc=(x - .06, -.132, top[0] + .12), name="goods_label"))
    # shelf 2: bottles in three colours
    for i in range(7):
        x = -.39 + i * .13
        c = ("sky_blue", "leaf_green", "red")[i % 3]
        parts.append(B.cylinder(.035, .2, verts=6, material=c, loc=(x, -.04, top[1] + .1), name="bottle"))
        parts.append(B.cylinder(.015, .06, verts=6, material="navy", loc=(x, -.04, top[1] + .23), name="neck"))
    # shelf 3: small coloured boxes
    for i in range(6):
        x = -.4 + i * .16
        c = ("red", "yellow", "work_blue")[i % 3]
        hh = .18 + .06 * (i % 2)
        parts.append(B.box((.13, .22, hh), material=c, loc=(x, 0, top[2] + hh / 2), name="goods_box"))
        parts.append(B.box((.07, .004, .05), material="paper", loc=(x, -.112, top[2] + hh * .55), name="goods_label"))
    # shelf 4: jars / tins
    for i in range(5):
        x = -.36 + i * .18
        c = ("dark_green", "yellow", "brick")[i % 3]
        parts.append(B.cylinder(.055, .16, verts=8, material=c, loc=(x, 0, top[3] + .08), name="jar"))
        parts.append(B.cylinder(.057, .03, verts=8, material="cloth_white", loc=(x, 0, top[3] + .175), name="jar_lid"))
    anchors = {"customer_stand": (0, -.8, 0)}
    for i, z in enumerate(levels):
        anchors["shelf_%d" % (i + 1)] = (0, 0, z + .0125)
        anchors["price_strip_%d" % (i + 1)] = text_face((0, -D / 2 - .0065, z - .005), (W, .035))
    return finish(parts, "shelf_unit", anchors)


def make_freezer_chest():
    B.clear_scene()
    parts = []
    W, D, H = 1.2, .65, .8
    parts.append(B.box((W - .04, D - .04, .06), material="charcoal", loc=(0, 0, .03), name="plinth"))
    parts.append(B.rounded_box((W, D, H - .06), radius=.03, segments=2, material="cloth_white",
                               loc=(0, 0, .06 + (H - .06) / 2), name="body"))
    rt = .04
    for s in (-1, 1):
        parts.append(B.box((W, rt, .035), material="metal", loc=(0, s * (D / 2 - rt / 2), H + .0175), bevel=.006,
                           name="lid_frame"))
        parts.append(B.box((rt, D - 2 * rt, .035), material="metal", loc=(s * (W / 2 - rt / 2), 0, H + .0175),
                           bevel=.006, name="lid_frame"))
    pw = (W - 2 * rt) / 2 + .04
    for i, s in enumerate((-1, 1)):
        z = H + .012 + .012 * i
        parts.append(B.box((pw, D - 2 * rt, .01), material="glass", loc=(s * (pw / 2 - .02), 0, z), name="pane"))
        parts.append(B.box((.1, .03, .02), material="charcoal", loc=(s * (pw - .1), -D / 2 + rt + .03, z + .012),
                           bevel=.004, name="pane_handle"))
    parts.append(B.box((W - .2, .006, .14), material="work_blue", loc=(0, -D / 2 - .002, .55), name="sign_band"))
    parts.append(B.box((.2, .006, .12), material="slate", loc=(W / 2 - .2, -D / 2 - .002, .2), name="grille"))
    anchors = {"sign_face": text_face((0, -D / 2 - .0055, .55), (W - .2, .14)), "customer_stand": (0, -.8, 0),
               "lid_top": (0, 0, H + .035)}
    return finish(parts, "freezer_chest", anchors)


# ==========================================================================
MAKERS = [
    # porter
    make_box_small, make_box_medium, make_box_large, make_crate_wood, make_hand_truck, make_pallet,
    make_sack_rice, make_box_stack,
    # dishwasher
    make_bowl_empty, make_bowl_noodles, make_bowl_soup, make_cup_glass, make_teacup, make_teapot, make_kettle,
    make_chopsticks, make_spoon, make_tray, make_dish_rack, make_wok_on_burner, make_sink_double,
    make_counter_noodle,
    # delivery
    make_takeaway_box, make_takeaway_bag, make_door_plate,
    # fruit + goods
    make_apple, make_banana_bunch, make_orange, make_watermelon_slice, make_cabbage, make_tomato, make_bao_bun,
    make_dumpling_plate, make_bottle_water, make_milk_carton, make_tea_box, make_egg_tray, make_rice_bag,
    make_crate_apples, make_crate_oranges, make_crate_bananas, make_shelf_unit, make_freezer_chest,
]


def main():
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith(".glb"):
            os.remove(os.path.join(OUT, f))
    manifest, failures = [], []
    for fn in MAKERS:
        obj, anchors = fn()
        name = obj.name
        tris = B.tri_count(obj)
        lo, hi = B.bbox(obj)
        budget = BUDGET.get(name, DEFAULT_BUDGET)
        if tris > budget:
            failures.append("%s tris %d > %d" % (name, tris, budget))
        if abs(lo.z) > 1e-4 or abs(lo.x + hi.x) > 1e-3 or abs(lo.y + hi.y) > 1e-3:
            failures.append("%s not base-centred: lo=%s hi=%s" % (name, tuple(lo), tuple(hi)))
        if name in HEIGHT_CHECK:
            want = HEIGHT_CHECK[name]
            if abs(hi.z - want) > want * .05:
                failures.append("%s height %.3f != %.2f +-5%%" % (name, hi.z, want))
        res = export.export_glb(obj, os.path.join(OUT, name + ".glb"))
        manifest.append({"name": name, "file": name + ".glb", "tris": res["tris"], "budget": budget,
                         "size_m": [round(v, 3) for v in res["bbox"]], "anchors": anchors})
    manifest = M.write(OUT, manifest)
    print("PROPS count=%d total_tris=%d" % (len(manifest), sum(m["tris"] for m in manifest)))
    if failures:
        raise SystemExit("PROPS FAILED:\n  " + "\n  ".join(failures))
    small = [m["file"] for m in manifest if max(m["size_m"]) <= SMALL_SHEET_MAX]
    sheet.render_sheet(OUT, os.path.join(OUT, "sheet.png"), cols=9, true_scale=True,
                       files=[m["file"] for m in manifest])
    sheet.render_sheet(OUT, os.path.join(OUT, "sheet_small.png"), cols=8, true_scale=False, fit_height=1.6,
                       files=small)
    print("PROPS OK glbs=%d small_sheet=%d" % (len(manifest), len(small)))


if __name__ == "__main__":
    try:
        main()
    except SystemExit as e:
        print(e)
        sys.exit(1)
