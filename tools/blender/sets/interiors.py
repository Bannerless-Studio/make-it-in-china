#!/usr/bin/env python3
"""Interiors set: rented room, tea house, noodle shop seating + wall pieces.

    blender -b --python tools/blender/sets/interiors.py

Outputs assets/interiors/*.glb, manifest.json, sheet.png (true scale, all),
plus sheet_furniture.png / sheet_small.png (true scale, subsets, for review).
Idempotent: every GLB in the output dir is deleted and rebuilt.

Frames (Blender, metres, Z up, front = -Y):
* props / furniture: base z=0, bbox centred in X/Y.
* wall pieces (boards, clock, fan, window, calendar, poster): same, the back
  face (+Y side) is the wall side; anchor ``wall_mount`` is its centre.
* shells: open front edge on the y=0 plane, interior extends to +Y, footprint
  centred in X, floor base z=0. The +X side is fully open so the fixed
  front-right camera sees inside; the full-height +X wall is exported as a
  SEPARATE GLB ``<shell>_wall_x.glb`` sharing the shell origin (place both at
  the same transform; the game hides the wall while the camera looks in).
Geometry is built in Blender axes; the manifest is written in glTF axes
(x, y, z) -> (x, z, -y) via lib/manifest.py (``rot_z_deg`` -> ``rot_y_deg``).
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from mathutils import Vector  # noqa: E402

from lib import build as B  # noqa: E402
from lib import export, manifest as M, sheet  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
OUT = os.path.join(ROOT, "assets", "interiors")
PI = math.pi

TRI_BUDGET = 800
SHELL_BUDGET = {"room_shell": 800, "tea_house_shell": 1500, "noodle_shop_shell": 1500}
WALL_TRIS = 300          # budget for each hideable side-wall GLB
BEV = 0.008              # default hard-edge bevel so outlines catch

# per-asset records (name -> dict) filled while building; used by shells + manifest
REC = {}


# ==========================================================================
# small shared helpers
# ==========================================================================
def bx(size, loc, material, bev=BEV, **kw):
    """Box with a 1-segment bevel (bev=0 -> plain 12-tri box)."""
    if bev:
        kw["bevel"] = bev
    return B.box(size, loc=loc, material=material, **kw)


def cyl(r, h, loc, material, verts=8, rt=None, **kw):
    return B.cylinder(r, h, verts=verts, radius_top=rt, loc=loc, material=material, **kw)


def legs4(xs, ys, h, r, material, verts=6, rt=None, z0=0.0):
    return [cyl(r, h, (x, y, z0 + h / 2), material, verts, rt) for x in xs for y in ys]


def shift_anchor(a, d):
    """Shift every point in an anchor structure by vector d.
    Points are 3-tuples/lists of numbers, or the 'pos' of a dict."""
    if isinstance(a, dict):
        out = {}
        for k, v in a.items():
            if k in ("size", "normal", "facing", "rot_z_deg", "asset", "note", "external"):
                out[k] = v
            else:
                out[k] = shift_anchor(v, d)
        return out
    if isinstance(a, (list, tuple)):
        if len(a) == 3 and all(isinstance(x, (int, float)) for x in a):
            return [round(a[i] + d[i], 4) for i in range(3)]
        return [shift_anchor(x, d) for x in a]
    return a


def finish(parts, name, anchors=None, shell=False, extra=None):
    """Join parts, set origin (props: base centre; shells: front edge y=0),
    shift anchors into the final frame and record the asset."""
    obj = B.join(parts, name)
    B.bake(obj)
    lo, hi = B.bbox(obj)
    cx = (lo.x + hi.x) / 2
    cy = lo.y if shell else (lo.y + hi.y) / 2
    d = (-cx, -cy, -lo.z)
    B.translate_mesh(obj, d)
    obj.location = (0, 0, 0)
    lo, hi = B.bbox(obj)
    anchors = shift_anchor(anchors or {}, d)
    if not shell and "wall_mount" not in anchors and extra and extra.get("wall_piece"):
        anchors["wall_mount"] = [0.0, round(hi.y, 4), round((lo.z + hi.z) / 2, 4)]
    REC[name] = {"name": name, "file": name + ".glb", "size_m": [round(v, 3) for v in (hi - lo)],
                 "anchors": anchors, "extra": extra or {}}
    if shell:
        REC[name]["wall_spec"] = dict(LAST_WALL, shift=d)
    return obj


def text_face(x, y, z, w, h):
    """Blank board text face on a -Y facing board front."""
    return {"pos": [x, y, z], "size": [round(w, 3), round(h, 3)], "normal": [0, -1, 0]}


# ==========================================================================
# rented room
# ==========================================================================
def make_bed_single(length=1.9, width=0.9):
    """Single bed, long axis along X, headboard at -X. Mattress, sheet,
    folded blanket at the foot, pillow at the head."""
    B.clear_scene()
    L, W = length, width
    p = []
    p.append(bx((L, W, .1), (0, 0, .30), "wood_dark", .012))                 # frame rail
    p += legs4((-L / 2 + .06, L / 2 - .06), (-W / 2 + .06, W / 2 - .06), .26, .04, "wood_dark", 6)
    p.append(bx((.07, W + .02, .85), (-L / 2 + .035, 0, .425), "wood_dark", .015))   # headboard
    p.append(bx((.07, W + .02, .55), (L / 2 - .035, 0, .275), "wood_dark", .015))    # footboard
    p.append(B.rounded_box((L - .16, W - .06, .16), radius=.03, segments=1,
                           loc=(0, 0, .43), material="cloth_white"))        # mattress
    p.append(bx((L - .5, W - .02, .03), (.12, 0, .52), "sky_blue", .01))     # sheet top
    # folded blanket: stacked slab with a rounded fold edge, foot end
    p.append(B.rounded_box((.42, W - .1, .12), radius=.04, segments=1,
                           loc=(L / 2 - .34, 0, .57), material="work_blue"))
    p.append(bx((.44, W - .06, .02), (L / 2 - .33, 0, .64), "navy", .006))   # fold band
    p.append(B.rounded_box((.3, .56, .11), radius=.045, segments=2,
                           loc=(-L / 2 + .28, 0, .565), material="paper"))   # pillow
    return finish(p, "bed_single", {
        "sleep": [0.0, 0.0, 0.52], "head": [-L / 2 + .28, 0.0, .6],
        "sit": [0.0, -W / 2 + .05, .5]})


def make_desk_small(w=1.0, d=0.5, h=0.75):
    B.clear_scene()
    p = [bx((w, d, .035), (0, 0, h - .0175), "wood", .01)]
    p += legs4((-w / 2 + .04, w / 2 - .04), (-d / 2 + .04, d / 2 - .04), h - .035, .025, "wood_dark", 6,
               rt=.022)
    p.append(bx((w - .1, .02, .12), (0, d / 2 - .04, h - .1), "wood_dark", 0))   # back apron
    # drawer box under the right half + chunky knob
    p.append(bx((.42, d - .08, .13), (w / 2 - .27, 0, h - .1), "wood_dark", .008))
    p.append(bx((.4, .02, .11), (w / 2 - .27, -d / 2 + .03, h - .1), "wood", .006))
    p.append(cyl(.022, .04, (w / 2 - .27, -d / 2 + .005, h - .1), "metal", 8, rot=(PI / 2, 0, 0)))
    return finish(p, "desk_small", {"top": [0.0, 0.0, h], "user_stand": [0.0, -d / 2 - .35, 0.0]})


def make_chair_wood(seat=0.42, sh=0.45, back_h=0.9, colour="wood", dark="wood_dark"):
    """Wooden chair, sitter faces -Y, back on +Y."""
    B.clear_scene()
    s = seat
    p = [bx((s, s, .04), (0, 0, sh - .02), colour, .01)]
    xs, ys = (-s / 2 + .03, s / 2 - .03), (-s / 2 + .03, s / 2 - .03)
    for x in xs:
        p.append(bx((.04, .04, sh - .04), (x, ys[0], (sh - .04) / 2), dark, .006))
        p.append(bx((.04, .04, back_h), (x, ys[1], back_h / 2), dark, .006))   # rear legs rise into back
    p.append(bx((s - .02, .03, .12), (0, ys[1], back_h - .08), colour, .01))    # top rail
    p.append(bx((s - .06, .025, .06), (0, ys[1], back_h - .3), colour, .006))   # mid rail
    p.append(bx((s - .06, .02, .025), (0, ys[0], .16), dark, 0))               # stretchers
    p.append(bx((s - .06, .02, .025), (0, ys[1], .16), dark, 0))
    return finish(p, "chair_wood", {"seat": [0.0, 0.0, sh], "front": [0.0, -s / 2 - .2, 0.0]})


def make_wardrobe(w=0.9, d=0.55, h=1.8):
    B.clear_scene()
    p = [bx((w, d, .08), (0, 0, .04), "wood_dark", .01)]                   # plinth
    p.append(bx((w - .04, d - .04, h - .16), (0, .01, .08 + (h - .16) / 2), "wood_dark", .01))  # carcass
    p.append(bx((w + .04, d + .03, .08), (0, 0, h - .04), "wood_dark", .015))   # cornice
    dh = h - .22
    dz = .1 + dh / 2
    for sgn in (-1, 1):                                                   # two doors, gap between
        x = sgn * (w / 4 - .003)
        p.append(bx((w / 2 - .035, .03, dh), (x, -d / 2 + .005, dz), "wood", .01))
        p.append(bx((w / 2 - .12, .012, dh - .16), (x, -d / 2 - .012, dz), "wood_dark", .004))   # inset panel line
        p.append(bx((.025, .05, .2), (sgn * .045, -d / 2 - .03, dz + .05), "metal", .008))       # handle
    return finish(p, "wardrobe", {"open_stand": [0.0, -d / 2 - .45, 0.0]})


def make_fan_wall(r=0.2):
    """Round cage fan on a wall bracket: wall plate (+Y), arm, motor, cage
    (front+back rings, spokes), 3 blades. Tilted a little downward."""
    B.clear_scene()
    p = [bx((.12, .03, .16), (0, .26, .5), "cloth_white", .008)]               # wall plate
    p.append(cyl(.018, .16, (0, .18, .5), "cloth_white", 6, rot=(PI / 2, 0, 0)))  # bracket arm
    p.append(cyl(.03, .05, (0, .12, .5), "cloth_white", 8, rot=(PI / 2, 0, 0)))   # knuckle
    fan = []
    fan.append(B.capsule(.06, .14, segments=8, cap_rings=2, rot=(PI / 2, 0, 0), loc=(0, .12, .5),
                         material="cloth_white"))                                # motor (points -Y)
    for y, mn in ((-.03, .012), (-.1, .012)):
        fan.append(B.torus(r, mn, 16, 4, rot=(PI / 2, 0, 0), loc=(0, y, .5), material="cloth_white"))
    fan.append(B.torus(r * .45, .008, 10, 4, rot=(PI / 2, 0, 0), loc=(0, -.115, .5), material="cloth_white"))
    for i in range(8):                                                       # cage spokes (front + side)
        a = 2 * PI * i / 8
        c, s = math.cos(a), math.sin(a)
        fan.append(B.tube([(c * r * .45, -.115, .5 + s * r * .45), (c * r * .98, -.105, .5 + s * r * .98),
                           (c * r, -.03, .5 + s * r)], .006, 4, material="cloth_white", smooth=False))
    fan.append(cyl(.035, .03, (0, -.075, .5), "sky_blue", 8, rot=(PI / 2, 0, 0)))  # hub
    for i in range(3):
        a = 2 * PI * i / 3 + .3
        fan.append(bx((.07, .01, r * .8), (math.cos(a) * r * .45, -.068, .5 + math.sin(a) * r * .45),
                      "sky_blue", 0, rot=(0, -a + PI / 2, 0)))
    B.rotate_about(fan, (0, .12, .5), (math.radians(-12), 0, 0))
    return finish(p + fan, "fan_wall", extra={"wall_piece": True, "mount_height_m": 2.0})


def make_phone_charger_on_desk():
    """Phone lying on the desk with its charger brick + cable. Tiny."""
    B.clear_scene()
    p = [B.rounded_box((.075, .15, .01), radius=.006, segments=1, loc=(0, 0, .005), material="charcoal")]
    p.append(bx((.062, .13, .003), (0, .002, .0105), "glass", 0))
    p.append(bx((.045, .045, .03), (.16, .06, .015), "cloth_white", .005))   # charger brick
    p.append(B.tube([(0, -.075, .005), (0, -.1, .004), (.07, -.1, .004), (.12, .0, .004), (.16, .035, .01)],
                    .004, 4, material="cloth_white", smooth=False))
    return finish(p, "phone_charger_on_desk")


def make_window_grille_panel(w=1.0, h=1.2, t=0.1):
    """Interior window piece: frame, glass, anti-theft grille bars, sill."""
    B.clear_scene()
    f = .06
    p = [bx((w, t * .6, f), (0, 0, f / 2), "cloth_white", .008), bx((w, t * .6, f), (0, 0, h - f / 2), "cloth_white", .008),
         bx((f, t * .6, h), (-w / 2 + f / 2, 0, h / 2), "cloth_white", .008),
         bx((f, t * .6, h), (w / 2 - f / 2, 0, h / 2), "cloth_white", .008),
         bx((.03, t * .5, h - 2 * f), (0, 0, h / 2), "cloth_white", 0)]           # mullion
    p.append(bx((w - 2 * f, .01, h - 2 * f), (0, .02, h / 2), "glass", 0))
    p.append(bx((w + .08, t, .04), (0, -t * .2, -.0), "concrete", .008))       # sill
    for i in range(1, 6):                                                     # grille verticals
        x = -w / 2 + w * i / 6
        p.append(bx((.018, .018, h - .1), (x, -.05, h / 2), "slate", 0))
    for z in (h * .33, h * .66):
        p.append(bx((w - .08, .018, .018), (0, -.05, z), "slate", 0))
    return finish(p, "window_grille_panel", extra={"wall_piece": True, "mount_height_m": 0.9})


# ==========================================================================
# tea house
# ==========================================================================
def make_table_round(dia=0.9, h=0.75):
    B.clear_scene()
    r = dia / 2
    p = [cyl(r, .045, (0, 0, h - .0225), "wood_dark", 16, bevel=.01)]
    p.append(cyl(r - .03, .05, (0, 0, h - .07), "wood", 12))                  # apron
    p.append(cyl(.05, h - .09, (0, 0, (h - .09) / 2), "wood_dark", 8))         # pedestal
    for a in (0, PI / 2):
        p.append(bx((.62, .07, .05), (0, 0, .025), "wood_dark", .01, rot=(0, 0, a + PI / 4)))
    seats = [[round(math.cos(a) * (r + .3), 3), round(math.sin(a) * (r + .3), 3), 0.0]
             for a in (-PI / 2, 0, PI / 2, PI)]
    return finish(p, "table_round", {"top": [0.0, 0.0, h], "seat_slots": seats})


def make_stool_wood(h=0.45):
    B.clear_scene()
    p = [cyl(.17, .045, (0, 0, h - .0225), "wood", 12, bevel=.008)]
    for i in range(4):
        a = PI / 4 + i * PI / 2
        c, s = math.cos(a), math.sin(a)
        p.append(B.tube([(c * .15, s * .15, 0), (c * .1, s * .1, h - .04)], .02, 5,
                        material="wood_dark", smooth=False))
    p.append(B.torus(.12, .012, 8, 4, loc=(0, 0, .16), material="wood_dark"))   # stretcher ring
    return finish(p, "stool_wood", {"seat": [0.0, 0.0, h]})


def make_tea_set_tray(tw=0.35, td=0.25):
    """Tray with a round clay teapot and two cups."""
    B.clear_scene()
    p = [B.rounded_box((tw, td, .02), radius=.008, segments=1, loc=(0, 0, .01), material="wood_dark")]
    for sx in (-1, 1):
        p.append(bx((.02, td, .03), (sx * (tw / 2 - .01), 0, .025), "wood_dark", .004))
    for sy in (-1, 1):
        p.append(bx((tw, .02, .03), (0, sy * (td / 2 - .01), .025), "wood_dark", .004))
    px, pz = -.06, .02
    p.append(B.lathe([(0, pz), (.05, pz), (.068, pz + .035), (.066, pz + .07), (.04, pz + .095), (0, pz + .1)],
                     12, material="brick", loc=(px, .01, 0)))                           # pot body
    p.append(cyl(.012, .02, (px, .01, pz + .105), "brick", 6))                         # lid knob
    p.append(B.tube([(px - .06, .01, pz + .04), (px - .1, .01, pz + .07), (px - .115, .01, pz + .095)],
                    [.012, .009, .007], 5, material="brick"))                          # spout
    p.append(B.tube([(px + .06, .01, pz + .075), (px + .1, .01, pz + .07), (px + .1, .01, pz + .035),
                     (px + .062, .01, pz + .03)], .008, 5, material="brick"))           # handle
    for cx, cy in ((.08, -.05), (.1, .055)):
        p.append(cyl(.026, .04, (cx, cy, pz + .02), "cloth_white", 10, rt=.032))
        p.append(cyl(.026, .006, (cx, cy, pz + .037), "wood", 10))                   # tea surface
    return finish(p, "tea_set_tray", {"pot": [px, .01, .12]})


def make_lattice_screen(w=1.2, h=1.8, t=0.05):
    """Folding-style wooden lattice screen: frame, paper backing, grid, feet."""
    B.clear_scene()
    f = .06
    fz = .08
    p = [bx((w, t, f), (0, 0, fz + f / 2), "wood_dark", .01), bx((w, t, f), (0, 0, h - f / 2), "wood_dark", .01)]
    for sx in (-1, 1):
        p.append(bx((f, t, h), (sx * (w / 2 - f / 2), 0, h / 2), "wood_dark", .01))
        p.append(bx((.08, .32, .06), (sx * (w / 2 - f / 2), 0, .03), "wood_dark", .01))   # feet
    iz0, iz1 = fz + f, h - f
    p.append(bx((w - 2 * f, .008, iz1 - iz0), (0, .01, (iz0 + iz1) / 2), "paper", 0))
    nx, nz = 5, 8
    for i in range(1, nx):
        x = -w / 2 + f + (w - 2 * f) * i / nx
        p.append(bx((.02, t * .7, iz1 - iz0), (x, 0, (iz0 + iz1) / 2), "wood", 0))
    for j in range(1, nz):
        z = iz0 + (iz1 - iz0) * j / nz
        p.append(bx((w - 2 * f, t * .7, .02), (0, 0, z), "wood", 0))
    return finish(p, "lattice_screen")


def make_bench_wood(L=1.5, d=0.35, h=0.45):
    B.clear_scene()
    p = [bx((L, d, .05), (0, 0, h - .025), "wood", .012)]
    for sx in (-1, 1):
        x = sx * (L / 2 - .15)
        p.append(bx((.06, d - .06, h - .05), (x, 0, (h - .05) / 2), "wood_dark", .008))
        p.append(bx((.08, d - .02, .05), (x, 0, .025), "wood_dark", .008))    # foot
    p.append(bx((L - .36, .04, .06), (0, 0, .15), "wood_dark", .006))         # stretcher
    return finish(p, "bench_wood", {"seat_left": [-L / 4, 0.0, h], "seat_right": [L / 4, 0.0, h]})


def make_plant_bamboo_pot(h=1.4):
    B.clear_scene()
    p = [B.lathe([(.13, 0), (.19, .32), (.21, .34), (.21, .38), (0.0, .38)], 10, material="brick", smooth=False)]
    p.append(cyl(.18, .02, (0, 0, .37), "khaki_brown", 10))                     # soil
    stalks = [(.05, .02, h - .05, .02), (-.06, .04, h - .25, -.03), (.0, -.07, h - .4, .04), (-.04, -.02, h - .55, 0)]
    for x, y, top, lean in stalks:
        z0 = .36
        tip = (x + lean * 3, y, top)
        p.append(B.tube([(x, y, z0), tip], .014, 6, material="leaf_green", smooth=False))
        for k in (1, 2, 3):                                                    # nodes
            t = k / 4
            p.append(cyl(.019, .016, (x + (tip[0] - x) * t, y, z0 + (top - z0) * t), "straw", 6))
        # leaf clusters: flattened spiky ellipsoids near the top and mid
        for zz, n, ln in ((top, 5, .24), (top - .3, 3, .2)):
            if zz < .6:
                continue
            f = (zz - z0) / (top - z0)
            base = Vector((x + (tip[0] - x) * f, y, zz))
            for k in range(n):
                a = 2 * PI * k / n + x * 20
                dvec = Vector((math.cos(a), math.sin(a), -.35 if k % 2 else .15)).normalized()
                c = base + dvec * ln / 2
                p.append(B.cone(.03, ln, verts=4, loc=tuple(c), rot=B.aim(tuple(dvec)), scale=(1, .22, 1),
                                material="leaf_dark"))
    return finish(p, "plant_bamboo_pot")


# ==========================================================================
# noodle shop seating
# ==========================================================================
def make_table_square(s=0.7, h=0.75):
    B.clear_scene()
    p = [bx((s, s, .03), (0, 0, h - .015), "formica", .006)]
    p.append(bx((s + .01, s + .01, .025), (0, 0, h - .04), "metal", .004))    # steel edge band
    p.append(bx((s - .1, s - .1, .04), (0, 0, h - .07), "metal", 0))          # frame
    for x in (-s / 2 + .06, s / 2 - .06):
        for y in (-s / 2 + .06, s / 2 - .06):
            p.append(cyl(.018, h - .07, (x, y, (h - .07) / 2), "metal", 6))
            p.append(cyl(.025, .02, (x, y, .01), "charcoal", 6))               # foot caps
    return finish(p, "table_square", {
        "top": [0.0, 0.0, h], "caddy": [s / 2 - .12, s / 2 - .1, h],
        "seat_slots": [[0.0, -s / 2 - .25, 0.0], [0.0, s / 2 + .25, 0.0]]})


def make_chopstick_holder():
    """Steel chopstick tube with a fan of wooden chopsticks."""
    B.clear_scene()
    p = [cyl(.035, .11, (0, 0, .055), "metal", 8, rt=.04)]
    p.append(cyl(.03, .005, (0, 0, .108), "charcoal", 8))
    for i in range(7):
        a = 2 * PI * i / 7
        r = .018 if i else 0
        top = (math.cos(a) * r * 2.2, math.sin(a) * r * 2.2, .23 - (i % 3) * .01)
        p.append(B.tube([(math.cos(a) * r * .5, math.sin(a) * r * .5, .02), top], .0045, 4,
                        material="wood", smooth=False))
    return finish(p, "chopstick_holder")


def make_napkin_box():
    B.clear_scene()
    p = [B.rounded_box((.18, .1, .08), radius=.008, segments=1, loc=(0, 0, .04), material="paper")]
    p.append(bx((.182, .102, .025), (0, 0, .03), "lantern_red", 0))               # printed band
    p.append(bx((.1, .012, .004), (0, 0, .081), "charcoal", 0))                   # slot
    p.append(B.loft([(.075, .025, .006), (.1, .03, .012, 0, .005), (.115, .02, .004, 0, .012)], 6,
                    material="cloth_white", smooth=False))                        # tissue tuft
    return finish(p, "napkin_box")


def make_board(name, w, h, face, frame="wood", thick=0.03, hook=True, text_extra=None):
    """Blank wall board: backing, raised frame, blank face, optional hook+cord.
    text_face = the blank face (front, -Y)."""
    B.clear_scene()
    fr = .04
    p = [bx((w, thick, h), (0, 0, h / 2), frame, .008)]
    p.append(bx((w - 2 * fr, .006, h - 2 * fr), (0, -thick / 2 - .002, h / 2), face, 0))
    for sx in (-1, 1):
        p.append(bx((fr, .012, h), (sx * (w / 2 - fr / 2), -thick / 2 - .004, h / 2), frame, .004))
    for sz in (0, 1):
        p.append(bx((w, .012, fr), (0, -thick / 2 - .004, fr / 2 + sz * (h - fr)), frame, .004))
    if hook:
        p.append(B.tube([(-w * .3, 0, h - .02), (0, .005, h + .12), (w * .3, 0, h - .02)], .005, 4,
                        material="charcoal", smooth=False))
        p.append(cyl(.012, .03, (0, .01, h + .12), "metal", 6, rot=(PI / 2, 0, 0)))
    anchors = {"text_face": text_face(0, -thick / 2 - .006, h / 2, w - 2 * fr, h - 2 * fr)}
    anchors.update(text_extra or {})
    return finish(p, name, anchors, extra={"wall_piece": True, "mount_height_m": 1.6})


def make_menu_board_wall():
    return make_board("menu_board_wall", 1.0, 0.6, "paper", frame="wood_dark", hook=False)


# ==========================================================================
# common wall pieces + mat
# ==========================================================================
def make_mat_floor(w=1.0, d=0.6):
    B.clear_scene()
    p = [B.rounded_box((w, d, .015), radius=.006, segments=1, loc=(0, 0, .0075), material="charcoal")]
    p.append(bx((w - .12, d - .12, .006), (0, 0, .016), "red", 0))
    return finish(p, "mat_floor", {"centre": [0.0, 0.0, .02]})


def make_calendar_wall(w=0.34, h=0.5):
    """Hanging wall calendar: red header band, paper pages, nail + string."""
    B.clear_scene()
    hh = .12
    p = [bx((w, .01, h - hh), (0, 0, (h - hh) / 2), "paper", .003)]
    p.append(bx((w - .01, .006, h - hh - .01), (0, -.007, (h - hh) / 2 + .003), "cloth_white", 0))   # page edge
    p.append(bx((w + .01, .018, hh), (0, 0, h - hh / 2), "lantern_red", .005))
    p.append(cyl(.006, w + .03, (0, -.004, h), "charcoal", 6, rot=(0, PI / 2, 0)))   # binding bar
    p.append(B.tube([(-w * .3, .004, h), (0, .006, h + .07), (w * .3, .004, h)], .003, 4,
                    material="charcoal", smooth=False))
    face = h - hh - .03
    return finish(p, "calendar_wall", {
        "text_face": text_face(0, -.011, (h - hh) / 2, w - .04, face),
        "text_header": text_face(0, -.01, h - hh / 2, w - .02, hh - .02)},
        extra={"wall_piece": True, "mount_height_m": 1.4})


def make_clock_wall(r=0.16):
    """Faceless wall clock: rim, blank dial, two hands, centre cap."""
    B.clear_scene()
    rot = (PI / 2, 0, 0)
    p = [cyl(r, .045, (0, 0, r), "red", 16, rot=rot, bevel=.008)]
    p.append(cyl(r - .02, .006, (0, -.024, r), "paper", 16, rot=rot))
    for ang, ln, w, y in ((.35, .72, .007, -.03), (-2.2, .48, .011, -.034)):      # minute, hour (from 12, cw)
        tip = (math.sin(ang) * r * ln, y, r + math.cos(ang) * r * ln)
        p.append(B.tube([(0, y, r), tip], w, 4, material="charcoal", smooth=False))
    p.append(cyl(.014, .012, (0, -.035, r), "charcoal", 8, rot=rot))
    return finish(p, "clock_wall", extra={"wall_piece": True, "mount_height_m": 2.0})


def make_poster_blank(w=0.5, h=0.7):
    """Blank poster: red border print, paper field, 4 tape corners."""
    B.clear_scene()
    p = [bx((w, .006, h), (0, 0, h / 2), "lantern_red", 0)]
    p.append(bx((w - .06, .004, h - .14), (0, -.004, h / 2 - .03), "paper", 0))
    for sx in (-1, 1):
        for sz in (0, 1):
            p.append(bx((.06, .003, .03), (sx * (w / 2 - .01), -.005, .015 + sz * (h - .03)), "straw", 0,
                        rot=(0, sx * (.6 if sz else -.6), 0)))
    return finish(p, "poster_blank", {
        "text_face": text_face(0, -.007, h / 2 - .03, w - .08, h - .16),
        "text_header": text_face(0, -.004, h - .045, w - .06, .06)},
        extra={"wall_piece": True, "mount_height_m": 1.2})


# ==========================================================================
# shells
# ==========================================================================
def wall_run(axis, a0, a1, c, t, bands, openings=(), bev=0):
    """Straight wall from a0..a1 along ``axis`` ('x' or 'y'), centred on the
    other axis at ``c``, thickness t. ``bands`` = [(z0, z1, colour)] stacked
    paint bands; ``openings`` = [(oa0, oa1, oz0, oz1)] doors/windows."""
    cuts = sorted({a0, a1} | {v for o in openings for v in o[:2] if a0 < v < a1})
    parts = []
    for u0, u1 in zip(cuts, cuts[1:]):
        mid = (u0 + u1) / 2
        holes = [(o[2], o[3]) for o in openings if o[0] <= mid <= o[1]]
        for z0, z1, colour in bands:
            segs = [(z0, z1)]
            for hz0, hz1 in holes:
                nxt = []
                for s0, s1 in segs:
                    if hz1 <= s0 or hz0 >= s1:
                        nxt.append((s0, s1))
                        continue
                    if s0 < hz0:
                        nxt.append((s0, hz0))
                    if hz1 < s1:
                        nxt.append((hz1, s1))
                segs = nxt
            for s0, s1 in segs:
                if s1 - s0 < 1e-4:
                    continue
                L, zc = u1 - u0, (s0 + s1) / 2
                if axis == "x":
                    parts.append(bx((L, t, s1 - s0), ((u0 + u1) / 2, c, zc), colour, bev))
                else:
                    parts.append(bx((t, L, s1 - s0), (c, (u0 + u1) / 2, zc), colour, bev))
    return parts


def door_leaf(x, y_face, w, h, z0, colour="wood_dark", handle="metal"):
    """Closed door leaf set into a back-wall opening (face toward -Y) + frame trim."""
    p = [bx((w - .02, .05, h - .01), (x, y_face + .03, z0 + (h - .01) / 2), colour, .01)]
    p.append(bx((w - .2, .012, h * .35), (x, y_face + .002, z0 + h * .68), "wood", 0))    # panel
    p.append(bx((w - .2, .012, h * .3), (x, y_face + .002, z0 + h * .25), "wood", 0))
    p.append(cyl(.03, .05, (x + w / 2 - .12, y_face - .01, z0 + 1.0), handle, 8, rot=(PI / 2, 0, 0)))
    return p + door_frame(x, y_face, w, h, z0)


def door_frame(x, y_face, w, h, z0, colour="wood"):
    ft = .06
    return [bx((ft, .04, h + ft), (x - w / 2 - ft / 2 + .01, y_face - .01, z0 + (h + ft) / 2), colour, .008),
            bx((ft, .04, h + ft), (x + w / 2 + ft / 2 - .01, y_face - .01, z0 + (h + ft) / 2), colour, .008),
            bx((w + 2 * ft - .02, .04, ft), (x, y_face - .01, z0 + h + ft / 2 - .01), colour, .008)]


def shell_box(W, D, H, t, floor_colour, bands, back_openings, floor_t=0.06, left_openings=()):
    """Floor + left wall (full), back wall (with openings); +X side open
    (its wall is built separately by ``side_wall``). Front open at y=0.
    Returns parts and the floor-top z; records the wall spec in LAST_WALL."""
    p = [bx((W, D, floor_t), (0, D / 2, floor_t / 2), floor_colour, .01)]
    z0 = floor_t
    bands_abs = [(z0 + a, min(z0 + b, H), c) for a, b, c in bands if z0 + a < H]
    # back wall spans the full width, side walls stop at it
    p += wall_run("x", -W / 2, W / 2, D - t / 2, t, bands_abs, back_openings)
    p += wall_run("y", 0, D - t, -W / 2 + t / 2, t, bands_abs, left_openings)
    LAST_WALL.clear()
    LAST_WALL.update(W=W, D=D, H=H, t=t, z0=z0, bands=bands_abs)
    # skirting on the inside of left + back
    p.append(bx((.02, D - t, .1), (-W / 2 + t + .01, (D - t) / 2, z0 + .05), "wood_dark", .004))
    p.append(bx((W - 2 * t, .02, .1), (0, D - t - .01, z0 + .05), "wood_dark", .004))
    return p, z0


LAST_WALL = {}


def side_wall(spec, name):
    """Full-height +X side wall for a shell (same frame as the shell), with the
    shell's paint bands and inside skirting. Returns (obj, height_m)."""
    B.clear_scene()
    W, D, t, z0 = spec["W"], spec["D"], spec["t"], spec["z0"]
    p = wall_run("y", 0, D - t, W / 2 - t / 2, t, spec["bands"])
    p.append(bx((.02, D - t, .1), (W / 2 - t - .01, (D - t) / 2, z0 + .05), "wood_dark", .004))
    obj = B.join(p, name)
    B.bake(obj)
    B.translate_mesh(obj, spec["shift"])
    obj.location = (0, 0, 0)
    return obj, round(spec["H"] - z0, 3)


def trim_back(W, D, t, z, h, openings, colour):
    """Thin paint/tile trim line on the inside of the back wall, broken at openings."""
    return wall_run("x", -W / 2 + t, W / 2 - t, D - t - .012, .024, [(z, z + h, colour)], openings)


def wall_slot(asset, wall, along, z, W, D, t, z0):
    """Furniture slot for a wall-hung asset: origin position such that its
    back face touches the inner wall face. wall in {'back','left','right'}."""
    d = REC[asset]["size_m"][1]
    zc = round(z0 + z, 3)
    if wall == "back":
        return {"asset": asset, "pos": [along, round(D - t - d / 2, 3), zc], "rot_z_deg": 0}
    if wall == "left":
        return {"asset": asset, "pos": [round(-W / 2 + t + d / 2, 3), along, zc], "rot_z_deg": 90}
    return {"asset": asset, "pos": [round(W / 2 - t - d / 2, 3), along, zc], "rot_z_deg": -90}


def make_room_shell(W=3.5, D=3.0, H=2.6, t=0.12):
    """Rented room: concrete floor, green dado + plaster walls, door on the
    back wall, cut-away right wall, window opening on the left wall."""
    B.clear_scene()
    dw, dh, dx = .9, 2.05, 0.0
    bands = [(0, 1.0, "dado_green"), (1.0, H, "plaster")]
    p, z0 = shell_box(W, D, H, t, "concrete", bands, [(dx - dw / 2, dx + dw / 2, .06, .06 + dh)],
                      left_openings=[(1.4, 2.4, .06 + 1.0, .06 + 2.2)])
    p += door_leaf(dx, D - t, dw, dh, z0)
    # left-wall window opening: frame reveal + dim glass so it reads from inside
    p.append(bx((.02, 1.0, 1.2), (-W / 2 + .04, 1.9, z0 + 1.6), "glass", 0))
    p.append(bx((.14, 1.08, .05), (-W / 2 + t / 2 + .02, 1.9, z0 + .98), "concrete", .008))
    p += trim_back(W, D, t, z0 + 1.0, .03, [(dx - dw / 2, dx + dw / 2, .06, .06 + dh)], "plaster")
    wy = D - t
    anchors = {
        "door": {"pos": [dx, round(wy - .45, 3), z0], "facing": [0, -1, 0]},
        "entrance": {"pos": [0.0, 0.2, z0], "facing": [0, 1, 0]},
        "npc_stand": {"pos": [-.3, round(wy - .7, 3), z0], "facing": [0, -1, 0]},        # landlord just inside the door
        "player_stand": {"pos": [0.3, 1.1, z0], "facing": [0, 1, 0]},
        "floor_top_z": z0,
        "furniture_slots": [
            {"asset": "bed_single", "pos": [round(-W / 2 + t + .47, 3), round(wy - .97, 3), z0], "rot_z_deg": -90},
            {"asset": "wardrobe", "pos": [round(W / 2 - t - .47, 3), round(wy - .3, 3), z0], "rot_z_deg": 0},
            {"asset": "desk_small", "pos": [round(W / 2 - t - .27, 3), 1.05, z0], "rot_z_deg": -90},
            {"asset": "chair_wood", "pos": [round(W / 2 - t - .75, 3), 1.05, z0], "rot_z_deg": 90},
            {"asset": "phone_charger_on_desk", "pos": [round(W / 2 - t - .27, 3), 1.2, round(z0 + .75, 3)],
             "rot_z_deg": 0},
            {"asset": "mat_floor", "pos": [dx, round(wy - .45, 3), z0], "rot_z_deg": 0},
            wall_slot("fan_wall", "back", -1.0, 1.95, W, D, t, z0),
            wall_slot("window_grille_panel", "left", 1.9, .9, W, D, t, z0),
            wall_slot("calendar_wall", "back", .9, 1.3, W, D, t, z0),
            wall_slot("clock_wall", "left", .6, 1.9, W, D, t, z0),
            wall_slot("poster_blank", "left", 1.0, 1.1, W, D, t, z0),
        ]}
    return finish(p, "room_shell", anchors, shell=True,
                  extra={"hideable_walls": [{"side": "+x"}]})


def make_tea_house_shell(W=6.0, D=5.0, H=3.0, t=0.15):
    """Tea house: dark plank floor, plaster walls with a wood wainscot and top
    beam, counter along the back with a tea-jar shelf, back doorway."""
    B.clear_scene()
    dw, dh, dx = 1.0, 2.1, 1.9
    bands = [(0, .9, "wood"), (.9, H - .25, "plaster"), (H - .25, H, "wood_dark")]
    p, z0 = shell_box(W, D, H, t, "wood_dark", bands, [(dx - dw / 2, dx + dw / 2, .06, .06 + dh)])
    wy = D - t
    p += door_frame(dx, wy, dw, dh, z0)
    p.append(bx((dw - .04, .02, dh - .02), (dx, D - .03, z0 + dh / 2), "charcoal", 0))   # dark back room
    # hanging curtain half in the doorway
    for sx in (-1, 1):
        p.append(bx((dw / 2 - .03, .015, .6), (dx + sx * dw / 4, wy - .02, z0 + dh - .3), "navy", .004))
    # floor planks: a few strips of lighter wood
    for i in range(5):
        x = -W / 2 + W * (i + .5) / 5
        p.append(bx((.05, D - t - .05, .006), (x, (D - t) / 2, z0 + .003), "wood", 0))
    # counter along the back: body + top + front panel
    cL, cD, cH, cx = 3.2, .6, 1.0, -.9
    cy = wy - 1.05
    p.append(bx((cL, cD, cH - .05), (cx, cy, z0 + (cH - .05) / 2), "wood", .012))
    p.append(bx((cL + .08, cD + .08, .05), (cx, cy, z0 + cH - .025), "wood_dark", .012))
    for i in range(4):
        p.append(bx((cL / 4 - .12, .02, cH - .3), (cx - cL / 2 + cL * (i + .5) / 4, cy - cD / 2 - .005, z0 + .5),
                    "wood_dark", 0))
    p.append(bx((cL + .1, .05, .1), (cx, cy - cD / 2 + .02, z0 + .05), "wood_dark", .004))   # kick
    # tea jar shelf on the back wall behind the counter
    p.append(bx((2.6, .28, .05), (cx, wy - .14, z0 + 1.55), "wood_dark", .01))
    for i, col in enumerate(("lantern_red", "straw", "brick", "leaf_green", "straw", "lantern_red")):
        x = cx - 1.1 + i * .44
        p.append(cyl(.08, .22, (x, wy - .14, z0 + 1.685), col, 8))
        p.append(cyl(.06, .04, (x, wy - .14, z0 + 1.815), "wood_dark", 8))
    anchors = {
        "door": {"pos": [dx, round(wy - .5, 3), z0], "facing": [0, -1, 0]},
        "entrance": {"pos": [0.0, 0.3, z0], "facing": [0, 1, 0]},
        "npc_stand": {"pos": [cx, round(wy - .45, 3), z0], "facing": [0, -1, 0]},                 # behind the counter
        "player_stand": {"pos": [cx, round(cy - cD / 2 - .45, 3), z0], "facing": [0, 1, 0]},     # in front of the counter
        "counter_top": [cx, round(cy, 3), round(z0 + cH, 3)],
        "floor_top_z": z0,
        "furniture_slots": [
            {"asset": "table_round", "pos": [-1.4, 1.5, z0], "rot_z_deg": 0},
            {"asset": "stool_wood", "pos": [-1.4, .75, z0], "rot_z_deg": 0},
            {"asset": "stool_wood", "pos": [-.65, 1.5, z0], "rot_z_deg": 0},
            {"asset": "stool_wood", "pos": [-2.15, 1.5, z0], "rot_z_deg": 0},
            {"asset": "tea_set_tray", "pos": [-1.4, 1.5, round(z0 + .75, 3)], "rot_z_deg": 0},
            {"asset": "table_round", "pos": [1.2, 1.4, z0], "rot_z_deg": 0},
            {"asset": "stool_wood", "pos": [1.2, .65, z0], "rot_z_deg": 0},
            {"asset": "stool_wood", "pos": [1.95, 1.4, z0], "rot_z_deg": 0},
            {"asset": "bench_wood", "pos": [round(-W / 2 + t + .2, 3), 2.3, z0], "rot_z_deg": 90},
            {"asset": "lattice_screen", "pos": [.15, 2.2, z0], "rot_z_deg": 90},
            {"asset": "plant_bamboo_pot", "pos": [round(-W / 2 + t + .3, 3), .5, z0], "rot_z_deg": 0},
            {"asset": "plant_bamboo_pot", "pos": [round(W / 2 - t - .3, 3), round(wy - .3, 3), z0], "rot_z_deg": 0},
            wall_slot("menu_board_wall", "left", 3.6, 1.5, W, D, t, z0),
            wall_slot("clock_wall", "back", dx, 2.35, W, D, t, z0),
            wall_slot("calendar_wall", "left", 1.2, 1.3, W, D, t, z0),
        ]}
    return finish(p, "tea_house_shell", anchors, shell=True,
                  extra={"hideable_walls": [{"side": "+x"}]})


def make_noodle_shop_shell(W=6.0, D=5.0, H=2.9, t=0.15):
    """Noodle shop: concrete floor, white tile dado + plaster walls, kitchen
    pass-through window with steel ledge and a curtained kitchen doorway,
    both backed by a dark kitchen panel."""
    B.clear_scene()
    pw, pz0, pz1, pxc = 1.8, 1.0, 1.65, -.9
    dw, dh, dx = .9, 2.05, 1.7
    bands = [(0, 1.2, "cloth_white"), (1.2, H, "plaster")]
    p, z0 = shell_box(W, D, H, t, "concrete", bands,
                      [(pxc - pw / 2, pxc + pw / 2, .06 + pz0, .06 + pz1), (dx - dw / 2, dx + dw / 2, .06, .06 + dh)])
    wy = D - t
    # dark kitchen behind both openings (recessed at the outer face)
    p.append(bx((pw - .02, .02, pz1 - pz0 - .02), (pxc, D - .02, z0 + (pz0 + pz1) / 2), "charcoal", 0))
    p.append(bx((dw - .02, .02, dh - .02), (dx, D - .02, z0 + dh / 2), "charcoal", 0))
    # pass-through ledge (steel), sticks out both sides, + a tile line
    p.append(bx((pw + .2, t + .25, .05), (pxc, D - (t + .25) / 2, z0 + pz0 - .025), "metal", .008))
    p.append(bx((pw + .2, .03, .08), (pxc, wy - .015, z0 + pz1 + .04), "metal", .006))    # header
    p += trim_back(W, D, t, z0 + 1.2, .04, [(pxc - pw / 2, pxc + pw / 2, .06 + pz0, .06 + pz1),
                                          (dx - dw / 2, dx + dw / 2, .06, .06 + dh)], "navy")
    # split curtain in the kitchen doorway
    p += door_frame(dx, wy, dw, dh, z0, colour="metal")
    for sx in (-1, 1):
        p.append(bx((dw / 2 - .03, .015, .75), (dx + sx * dw / 4, wy - .02, z0 + dh - .375), "lantern_red", .004))
    anchors = {
        "door": {"pos": [dx, round(wy - .5, 3), z0], "facing": [0, -1, 0]},
        "entrance": {"pos": [0.0, 0.3, z0], "facing": [0, 1, 0]},
        "pass_window": [pxc, round(wy - .05, 3), round(z0 + pz0, 3)],
        "npc_stand": {"pos": [pxc, round(wy - .55, 3), z0], "facing": [0, -1, 0]},                # server at the pass-through
        "player_stand": {"pos": [0.0, 1.2, z0], "facing": [0, 1, 0]},
        "floor_top_z": z0,
        "furniture_slots": [
            {"asset": "table_square", "pos": [-1.8, 1.2, z0], "rot_z_deg": 0},
            {"asset": "table_square", "pos": [-.3, 1.2, z0], "rot_z_deg": 0},
            {"asset": "table_square", "pos": [1.2, 1.2, z0], "rot_z_deg": 0},
            {"asset": "table_square", "pos": [-1.8, 2.7, z0], "rot_z_deg": 0},
            {"asset": "stool_plastic", "external": "street", "pos": [-1.8, .6, z0], "rot_z_deg": 0},
            {"asset": "stool_plastic", "external": "street", "pos": [-1.8, 1.8, z0], "rot_z_deg": 0},
            {"asset": "stool_plastic", "external": "street", "pos": [-.3, .6, z0], "rot_z_deg": 0},
            {"asset": "stool_plastic", "external": "street", "pos": [-.3, 1.8, z0], "rot_z_deg": 0},
            {"asset": "stool_plastic", "external": "street", "pos": [1.2, .6, z0], "rot_z_deg": 0},
            {"asset": "stool_plastic", "external": "street", "pos": [1.2, 1.8, z0], "rot_z_deg": 0},
            {"asset": "chopstick_holder", "pos": [-1.57, 1.45, round(z0 + .75, 3)], "rot_z_deg": 0},
            {"asset": "napkin_box", "pos": [-1.75, 1.47, round(z0 + .75, 3)], "rot_z_deg": 0},
            {"asset": "mat_floor", "pos": [0.0, .4, z0], "rot_z_deg": 0},
            wall_slot("menu_board_wall", "left", 2.5, 1.55, W, D, t, z0),
            wall_slot("poster_blank", "back", 0.2, 1.3, W, D, t, z0),
            wall_slot("clock_wall", "back", pxc, 2.15, W, D, t, z0),
            wall_slot("calendar_wall", "left", 1.0, 1.35, W, D, t, z0),
            wall_slot("fan_wall", "left", 3.8, 2.05, W, D, t, z0),
        ]}
    return finish(p, "noodle_shop_shell", anchors, shell=True,
                  extra={"hideable_walls": [{"side": "+x"}]})


# ==========================================================================
# driver
# ==========================================================================
PROPS = (make_bed_single, make_desk_small, make_chair_wood, make_wardrobe, make_fan_wall,
         make_phone_charger_on_desk, make_window_grille_panel,
         make_table_round, make_stool_wood, make_tea_set_tray, make_lattice_screen, make_bench_wood,
         make_plant_bamboo_pot,
         make_table_square, make_chopstick_holder, make_napkin_box, make_menu_board_wall,
         make_mat_floor, lambda: make_calendar_wall(), make_clock_wall, make_poster_blank)
SHELLS = (make_room_shell, make_tea_house_shell, make_noodle_shop_shell)
EXTERNAL = [{"name": "stool_plastic", "file": "../street/stool_plastic.glb", "external": "street",
             "note": "red plastic stool from the street set; not duplicated here", "tris": None,
             "size_m": None, "anchors": {}}]
BOARDS = ("menu_board_wall", "calendar_wall", "poster_blank")


def export_side_wall(shell_name, rec, shell_entry):
    """Build + export the hideable +X wall of a shell; link it from the shell
    entry (``hideable_walls``) and return the wall's own manifest entry."""
    wname = shell_name + "_wall_x"
    obj, height = side_wall(rec["wall_spec"], wname)
    tris = B.tri_count(obj)
    assert tris <= WALL_TRIS, "%s tris %d > %d" % (wname, tris, WALL_TRIS)
    lo, hi = B.bbox(obj)
    W, z0 = rec["wall_spec"]["W"], rec["wall_spec"]["z0"]
    assert abs(hi.x - W / 2) < 1e-4 and abs(lo.y) < 1e-4, "%s not flush with shell edge" % wname
    assert abs(lo.z - z0) < 1e-4 and abs(hi.z - rec["wall_spec"]["H"]) < 1e-4, "%s not full height" % wname
    info = export.export_glb(obj, os.path.join(OUT, wname + ".glb"))
    shell_entry["hideable_walls"] = [{"side": "+x", "file": wname + ".glb", "name": wname, "height_m": height,
                                      "note": "same origin as the shell; hide while the camera looks in"}]
    print("ASSET %-22s tris=%4d/%4d hideable wall of %s, height %.2f m" % (wname, info["tris"], WALL_TRIS,
                                                                        shell_name, height))
    return {"name": wname, "file": wname + ".glb", "tris": info["tris"], "budget": WALL_TRIS,
            "size_m": [round(v, 3) for v in (hi - lo)], "origin": "shell", "wall_of": shell_name,
            "anchors": {}}


def main():
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith(".glb"):
            os.remove(os.path.join(OUT, f))
    manifest = []
    for fn in PROPS + SHELLS:
        obj = fn()
        name = obj.name
        rec = REC[name]
        budget = SHELL_BUDGET.get(name, TRI_BUDGET)
        tris = B.tri_count(obj)
        assert tris <= budget, "%s tris %d > %d" % (name, tris, budget)
        lo, hi = B.bbox(obj)
        assert abs(lo.z) < 1e-4, "%s base z=%.4f" % (name, lo.z)
        assert abs(lo.x + hi.x) < 1e-3, "%s not centred in X" % name
        if name in SHELL_BUDGET:
            assert abs(lo.y) < 1e-4, "%s front not on y=0" % name
            for k in ("door", "npc_stand", "player_stand", "furniture_slots"):
                assert k in rec["anchors"], "%s missing anchor %s" % (name, k)
        else:
            assert abs(lo.y + hi.y) < 1e-3, "%s not centred in Y" % name
        if name in BOARDS:
            assert "text_face" in rec["anchors"], name
        info = export.export_glb(obj, os.path.join(OUT, name + ".glb"))
        entry = {"name": name, "file": rec["file"], "tris": info["tris"], "size_m": rec["size_m"],
                 "budget": budget, "anchors": rec["anchors"]}
        entry.update({k: v for k, v in rec["extra"].items()})
        entry["origin"] = "shell" if name in SHELL_BUDGET else ("wall_piece" if rec["extra"].get("wall_piece")
                                                                 else "feet")
        manifest.append(entry)
        print("ASSET %-22s tris=%4d/%4d size=%.3f x %.3f x %.3f" % ((name, info["tris"], budget) + tuple(rec["size_m"])))
        if name in SHELL_BUDGET:
            manifest.append(export_side_wall(name, rec, entry))
    glbs = sorted(f for f in os.listdir(OUT) if f.endswith(".glb"))
    assert len(glbs) == len(PROPS) + 2 * len(SHELLS), glbs
    manifest += EXTERNAL
    M.write(OUT, manifest, blender_frame=True)
    print("MANIFEST entries=%d glbs=%d" % (len(manifest), len(glbs)))
    furn = [n + ".glb" for n in REC if n not in SHELL_BUDGET]
    shells = [n + ".glb" for n in SHELL_BUDGET]
    # shells first: the lib places labels by the deepest asset, so tall shells in
    # a lower row would cover the labels of the row above.
    sheet.render_sheet(OUT, os.path.join(OUT, "sheet.png"), cell_size_m=8.6, cols=6, true_scale=True,
                       files=shells + furn)
    sheet.render_sheet(OUT, os.path.join(OUT, "sheet_furniture.png"), cols=7, true_scale=True, files=furn)
    small = [n + ".glb" for n, r in REC.items() if max(r["size_m"]) < 0.8]
    sheet.render_sheet(OUT, os.path.join(OUT, "sheet_small.png"), cols=5, true_scale=True, files=small)
    sheet.render_sheet(OUT, os.path.join(OUT, "sheet_shells.png"), cols=3, true_scale=True, files=shells)


if __name__ == "__main__":
    try:
        main()
    except Exception:                      # blender -b --python exits 0 on errors; force non-zero
        import traceback
        traceback.print_exc()
        sys.exit(1)
