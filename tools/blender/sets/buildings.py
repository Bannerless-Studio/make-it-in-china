#!/usr/bin/env python3
"""Buildings set: 8 Phase 1 location fronts, 3 filler facades, 6 street tiles.

    blender -b --python tools/blender/sets/buildings.py

Outputs assets/buildings/*.glb, assets/buildings/manifest.json and
assets/buildings/sheet.png (true scale). Idempotent.

Buildings are shells: facade + 1.5 m return walls + back wall + roof cap,
hollow inside. Front face of the facade on the y=0 plane (Blender), footprint
centred in X, base z=0; awnings/steps/docks protrude to -Y (towards the street).
Every building carries blank sign geometry (paper-coloured faces) and named
anchors (sign centres, door, NPC/player stand points, hooks) in manifest.json.

Manifest coordinates are glTF (what the game loads): x right, y up, z towards
the street / viewer (= -Blender Y). Normals/facings use the same axes.

Street tiles tile exactly: edges at +-half size, no bevel on tiling edges.
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
OUT = os.path.join(ROOT, "assets", "buildings")
PI = math.pi

T = 0.2          # wall thickness
RET = 1.5        # return-wall depth (facade front at y=0, back wall ends at y=RET)
BUILDING_TRIS = 6000
TILE_TRIS = 200
EPS = 1e-4


# ==========================================================================
# asset accumulator + anchors
# ==========================================================================
class P(tuple):
    """A position anchor (Blender coords); shifted with the mesh at finish."""


class D(tuple):
    """A direction (normal / facing) anchor; rotated to glTF, never shifted."""


def pt(x, y, z):
    return P((float(x), float(y), float(z)))


FRONT_N = D((0.0, -1.0, 0.0))     # faces the street
BACK_N = D((0.0, 1.0, 0.0))       # faces the building


class Asset:
    def __init__(self, name, kind="building"):
        B.clear_scene()
        self.name, self.kind = name, kind
        self.parts, self.anchors = [], {}

    def add(self, *items):
        for it in items:
            if isinstance(it, (list, tuple)):
                self.parts.extend(i for i in it if i is not None)
            elif it is not None:
                self.parts.append(it)

    def finish(self, centre=True):
        obj = B.join(self.parts, self.name)
        B.bake(obj)
        lo, hi = B.bbox(obj)
        shift = Vector((-(lo.x + hi.x) / 2, 0.0, -lo.z)) if centre else Vector((0, 0, 0))
        B.translate_mesh(obj, shift)
        self.shift = shift
        return obj


def _conv(v, shift):
    if isinstance(v, P):
        p = Vector(v) + shift
        return [round(p.x, 3) + 0.0, round(p.z, 3) + 0.0, round(-p.y, 3) + 0.0]
    if isinstance(v, D):
        return [round(v[0], 3) + 0.0, round(v[2], 3) + 0.0, round(-v[1], 3) + 0.0]
    if isinstance(v, dict):
        return {k: _conv(x, shift) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_conv(x, shift) for x in v]
    if isinstance(v, float):
        return round(v, 3)
    return v


# ==========================================================================
# primitive helpers (extent-based, so layouts read like floor plans)
# ==========================================================================
def span(x0, x1, z0, z1, y0, y1, mat, bevel=0.0):
    """Axis-aligned box from extents x0..x1, z0..z1, y0..y1."""
    kw = dict(material=mat, loc=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    if bevel:
        kw["bevel"] = bevel
    return B.box((abs(x1 - x0), abs(y1 - y0), abs(z1 - z0)), **kw)


def prism_yz(points_yz, x0, x1, mat, bevel=0.0):
    """Extrude a (y, z) side profile along X from x0 to x1 (awnings, roofs, steps)."""
    kw = dict(material=mat, loc=((x0 + x1) / 2, 0, 0), rot=(PI / 2, 0, PI / 2))
    if bevel:
        kw["bevel"] = bevel
    return B.extrude_profile(points_yz, abs(x1 - x0), **kw)


def prism_xz(points_xz, y0, y1, mat, bevel=0.0):
    """Extrude an (x, z) front profile along Y from y0 to y1 (arches, gables)."""
    kw = dict(material=mat, loc=(0, (y0 + y1) / 2, 0), rot=(PI / 2, 0, 0))
    if bevel:
        kw["bevel"] = bevel
    return B.extrude_profile(points_xz, abs(y1 - y0), **kw)


def rod(p0, p1, r, mat, verts=6):
    """Straight round bar between two points."""
    a, b = Vector(p0), Vector(p1)
    d = b - a
    return B.cylinder(r, d.length, verts=verts, material=mat, loc=tuple((a + b) / 2),
                      rot=B.aim(tuple(d)), smooth=False)


def disc_front(cx, y, cz, r, depth, mat, verts=12):
    """Cylinder whose axis points at the street (-Y)."""
    return B.cylinder(r, depth, verts=verts, material=mat, loc=(cx, y, cz),
                      rot=B.aim((0, -1, 0)), smooth=False)


def frame_rect(x0, x1, z0, z1, f, y0, y1, mat, bevel=0.015, bottom=True):
    """Four (or three) bars around a rectangle; outer extents given."""
    out = [span(x0, x1, z1 - f, z1, y0, y1, mat, bevel),
           span(x0, x0 + f, z0, z1 - f, y0, y1, mat, bevel),
           span(x1 - f, x1, z0, z1 - f, y0, y1, mat, bevel)]
    if bottom:
        out.append(span(x0 + f, x1 - f, z0, z0 + f, y0, y1, mat, bevel))
    return out


def wall_with_holes(x0, x1, z0, z1, y0, y1, holes, mat):
    """A flat wall slab with rectangular openings, as a minimal set of boxes.
    holes: (hx0, hx1, hz0, hz1); clipped to the wall; unbevelled so the
    strips read as one surface."""
    hs = [(max(h[0], x0), min(h[1], x1), max(h[2], z0), min(h[3], z1)) for h in holes]
    hs = [h for h in hs if h[1] - h[0] > EPS and h[3] - h[2] > EPS]
    xs = sorted({x0, x1} | {h[0] for h in hs} | {h[1] for h in hs})
    strips = []
    for a, b in zip(xs, xs[1:]):
        m = (a + b) / 2
        cuts = tuple(sorted((h[2], h[3]) for h in hs if h[0] < m < h[1]))
        if strips and strips[-1][2] == cuts:
            strips[-1][1] = b
        else:
            strips.append([a, b, cuts])
    parts = []
    for a, b, cuts in strips:
        z = z0
        for c0, c1 in cuts:
            if c0 > z + EPS:
                parts.append(span(a, b, z, c0, y0, y1, mat))
            z = max(z, c1)
        if z < z1 - EPS:
            parts.append(span(a, b, z, z1, y0, y1, mat))
    return parts


def corrugated(p0, p1, z0, z1, thick, mat, pitch=0.3, amp=0.07, outward=(0, -1)):
    """Corrugated sheet wall along the line p0->p1 (plan XY), ribs vertical,
    trapezoid ridges bulging towards ``outward``. One extrusion along Z."""
    a, b, n = Vector((*p0, 0)), Vector((*p1, 0)), Vector((*outward, 0)).normalized()
    L = (b - a).length
    u = (b - a).normalized()
    k = max(1, round(L / pitch))
    step = L / k
    front = []
    for i in range(k):
        s = i * step
        for fr, h in ((0.0, 0), (0.2, 1), (0.55, 1), (0.75, 0)):
            front.append(a + u * (s + fr * step) + n * (amp * h))
    front.append(b)
    back = [b - n * thick, a - n * thick]
    pts = [(v.x, v.y) for v in front + back]
    return B.extrude_profile(pts, z1 - z0, material=mat, loc=(0, 0, (z0 + z1) / 2))


def slats(x0, x1, z0, z1, y, mat, pitch=0.16, amp=0.03, thick=0.04):
    """Roller-shutter curtain: horizontal ribs as one extruded (y, z) profile."""
    k = max(1, round((z1 - z0) / pitch))
    step = (z1 - z0) / k
    pts = []
    for i in range(k):
        zz = z0 + i * step
        pts += [(y, zz), (y - amp, zz + step * 0.15), (y - amp, zz + step * 0.85)]
    pts += [(y, z1), (y + thick, z1), (y + thick, z0)]
    return prism_yz(pts, x0, x1, mat)


# ==========================================================================
# building components (shared by every building)
# ==========================================================================
def shell(a, W, bands, holes=(), depth=RET, back_mat="plaster", floor=True, H=None):
    """Facade (per-storey bands of (z0, z1, material)) with holes, two return
    walls, back wall and an interior floor slab. Hollow inside."""
    H = H or bands[-1][1]
    for z0, z1, m in bands:
        a.add(wall_with_holes(-W / 2, W / 2, z0, z1, 0, T, holes, m))
        a.add(span(-W / 2, -W / 2 + T, z0, z1, T, depth, m),
              span(W / 2 - T, W / 2, z0, z1, T, depth, m))
    a.add(span(-W / 2 + T, W / 2 - T, 0, H, depth - T, depth, back_mat))
    if floor:
        a.add(span(-W / 2 + T, W / 2 - T, 0, 0.03, T, depth - T, "concrete"))


def window(a, cx, z0, w, h, frame="wood", glass="glass", grille=False, mullion=True, sill="concrete"):
    """Framed window on the facade; returns its wall hole."""
    x0, x1, z1, f = cx - w / 2, cx + w / 2, z0 + h, 0.08
    a.add(frame_rect(x0, x1, z0, z1, f, -0.05, 0.12, frame, bottom=not sill))
    a.add(span(x0 + f, x1 - f, z0, z1 - f, 0.1, 0.13, glass))
    if mullion:
        a.add(span(cx - 0.03, cx + 0.03, z0 + f, z1 - f, -0.02, 0.1, frame))
    if sill:
        a.add(span(x0 - 0.08, x1 + 0.08, z0 - 0.08, z0 + 0.02, -0.14, 0.12, sill, bevel=0.02))
    if grille:
        yb = -0.34
        a.add(span(x0 - 0.06, x1 + 0.06, z1, z1 + 0.05, yb - 0.04, 0, "slate", bevel=0.012))
        a.add(span(x0 - 0.06, x1 + 0.06, z0 + 0.02, z0 + 0.07, yb - 0.04, -0.14, "slate"))
        n = max(3, round(w / 0.16))
        for i in range(n + 1):
            x = x0 - 0.03 + (w + 0.06) * i / n
            a.add(span(x - 0.013, x + 0.013, z0 + 0.07, z1, yb - 0.013, yb + 0.013, "slate"))
        for zz in (z0 + h * 0.5, z1 - 0.06):
            a.add(span(x0 - 0.04, x1 + 0.04, zz - 0.015, zz + 0.015, yb - 0.02, yb + 0.02, "slate"))
            for x in (x0 - 0.04, x1 + 0.04):
                a.add(span(x - 0.015, x + 0.015, zz - 0.015, zz + 0.015, yb, 0, "slate"))
    return (x0, x1, z0, z1)


def door(a, cx, w, h, leaf="slate", frame="concrete", z0=0.0, leaves=1, glass_top=False,
         handle="metal", f=0.09):
    """Framed recessed door; returns its wall hole and records nothing."""
    x0, x1 = cx - w / 2, cx + w / 2
    a.add(frame_rect(x0 - f, x1 + f, z0, z0 + h + f, f, -0.05, 0.12, frame, bottom=False))
    lw = w / leaves
    for i in range(leaves):
        lx0 = x0 + i * lw + (0.01 if leaves > 1 else 0)
        lx1 = x0 + (i + 1) * lw - (0.01 if leaves > 1 else 0)
        a.add(span(lx0, lx1, z0, z0 + h, 0.1, 0.15, leaf, bevel=0.012))
        if glass_top:
            a.add(span(lx0 + 0.1, lx1 - 0.1, z0 + h * 0.5, z0 + h - 0.12, 0.08, 0.1, "glass"))
        hx = lx1 - 0.12 if i == 0 else lx0 + 0.12
        a.add(span(hx - 0.025, hx + 0.025, z0 + 0.95, z0 + 1.15, 0.03, 0.1, handle, bevel=0.01))
    return (x0, x1, z0, z0 + h)


def ac_unit(a, cx, z0, y=0.0):
    """Split-AC outdoor unit on two L brackets, fan grille to the street."""
    a.add(span(cx - 0.4, cx + 0.4, z0, z0 + 0.55, y - 0.34, y - 0.04, "tile_white", bevel=0.035))
    a.add(disc_front(cx + 0.1, y - 0.345, z0 + 0.275, 0.2, 0.02, "slate", verts=12))
    a.add(disc_front(cx + 0.1, y - 0.36, z0 + 0.275, 0.05, 0.02, "metal", verts=8))
    for i in range(3):
        zz = z0 + 0.14 + i * 0.12
        a.add(span(cx - 0.34, cx - 0.16, zz, zz + 0.04, y - 0.355, y - 0.33, "cloth_grey"))
    for x in (cx - 0.3, cx + 0.3):
        a.add(span(x - 0.025, x + 0.025, z0 - 0.05, z0, y - 0.36, y, "slate"))
        a.add(rod((x, y - 0.3, z0 - 0.03), (x, y, z0 - 0.35), 0.018, "slate", verts=4))
    a.add(rod((cx + 0.42, y - 0.12, z0 + 0.12), (cx + 0.42, y, z0 + 0.12), 0.025, "cloth_white", verts=6))


def sign(a, key, cx, cz, w, h, yf, rim=0.07, rim_mat="lantern_red", face="paper", depth=0.1,
         bevel=0.02):
    """Blank sign board: paper face (front at yf) inside a chunky rim. Records
    anchors[key] = {pos (face centre), size [w, h], normal}."""
    a.add(span(cx - w / 2, cx + w / 2, cz - h / 2, cz + h / 2, yf, yf + depth, face))
    a.add(frame_rect(cx - w / 2 - rim, cx + w / 2 + rim, cz - h / 2 - rim, cz + h / 2 + rim, rim,
                     yf - 0.035, yf + depth, rim_mat, bevel))
    a.anchors[key] = {"pos": pt(cx, yf, cz), "size": [round(w, 3), round(h, 3)], "normal": FRONT_N}


def light_box(a, key, cx, cz, w, h, y_wall=0.0, depth=0.3, rim_mat="tile_white"):
    """Illuminated box sign standing off the facade; blank paper face."""
    a.add(span(cx - w / 2 - 0.05, cx + w / 2 + 0.05, cz - h / 2 - 0.05, cz + h / 2 + 0.05,
               y_wall - depth + 0.02, y_wall, rim_mat, bevel=0.025))
    sign(a, key, cx, cz, w, h, y_wall - depth, rim=0.06, rim_mat=rim_mat, depth=0.03)


def tile_roof(a, x0, x1, y_eave, z_eave, y_ridge, z_ridge, th=0.12, pitch=0.3, fascia="wood_dark",
              ridge=True, upturn=True, roll_mat="roof_tile"):
    """Chinese tiled roof slope: slab + tile rolls down the slope + fascia,
    optional ridge beam with upturned ends."""
    dy, dz = y_ridge - y_eave, z_ridge - z_eave
    a.add(prism_yz([(y_eave, z_eave), (y_ridge, z_ridge), (y_ridge, z_ridge + th),
                    (y_eave, z_eave + th)], x0, x1, "roof_tile"))
    nrm = Vector((0, -dz, dy)).normalized()
    k = max(2, round((x1 - x0) / pitch))
    for i in range(k):
        x = x0 + (x1 - x0) * (i + 0.5) / k
        p0 = Vector((x, y_eave - 0.04, z_eave + th)) + nrm * 0.03
        p1 = Vector((x, y_ridge, z_ridge + th)) + nrm * 0.03
        a.add(rod(tuple(p0), tuple(p1), 0.06, roll_mat, verts=6))
    a.add(span(x0 - 0.02, x1 + 0.02, z_eave - 0.1, z_eave + th - 0.02, y_eave - 0.06, y_eave + 0.12,
               fascia, bevel=0.02))
    if ridge:
        a.add(span(x0 - 0.05, x1 + 0.05, z_ridge + th - 0.04, z_ridge + th + 0.2,
                   y_ridge - 0.22, y_ridge + 0.02, "slate", bevel=0.04))
        if upturn:
            for s in (-1, 1):
                xe = x1 if s > 0 else x0
                a.add(B.box((0.5, 0.22, 0.16), material="slate", bevel=0.03,
                            loc=(xe + s * 0.12, y_ridge - 0.1, z_ridge + th + 0.2),
                            rot=(0, -s * 0.55, 0)))


def pitched_roof(a, W, H, depth=RET, over=0.45, rise=0.6, side=0.15, wall_mat="plaster", **kw):
    """Tile roof resting on the facade top, ridge above the back wall; fills
    the gables and back wall up to the slab. Returns (z_eave, z_ridge)."""
    slope = rise / (depth + over)
    z_eave = H - over * slope
    z_ridge = H + depth * slope
    tile_roof(a, -W / 2 - side, W / 2 + side, -over, z_eave, depth, z_ridge, **kw)
    for x0 in (-W / 2, W / 2 - T):
        a.add(prism_yz([(T, H), (depth, H), (depth, z_ridge), (T, H + T * slope)], x0, x0 + T, wall_mat))
    a.add(span(-W / 2 + T, W / 2 - T, H, z_ridge, depth - T, depth, wall_mat))
    return z_eave, z_ridge


def flat_roof(a, W, H, depth=RET, mat="concrete", lip=0.08, th=0.16):
    """Flat roof slab / parapet coping covering the whole shell."""
    a.add(span(-W / 2 - lip, W / 2 + lip, H, H + th, -lip, depth + 0.02, mat, bevel=0.03))


def band(a, W, z0, z1, mat, out=0.06):
    """Horizontal facade band (floor line / cornice), full width."""
    a.add(span(-W / 2 - 0.02, W / 2 + 0.02, z0, z1, -out, T, mat, bevel=0.02))


def stand(a, npc, player, door_pos):
    """npc_stand / player_stand / door anchors (positions at floor level)."""
    a.anchors["door"] = {"pos": pt(*door_pos), "facing": FRONT_N}
    a.anchors["npc_stand"] = {"pos": pt(*npc), "facing": FRONT_N}
    a.anchors["player_stand"] = {"pos": pt(*player), "facing": BACK_N}


def hook(a, x, y, z, key_list):
    """Small metal lantern hook hanging down from (x, y, z); anchor = hook eye."""
    a.add(rod((x, y, z + 0.02), (x, y, z - 0.14), 0.018, "metal", verts=6))
    a.add(B.torus(0.04, 0.012, 8, 4, material="metal", loc=(x, y, z - 0.18), rot=(PI / 2, 0, 0)))
    key_list.append(pt(x, y, z - 0.22))


# ==========================================================================
# buildings
# ==========================================================================
def make_noodle_shop():
    """6 m, 2 storeys (3.2 + 2.8). Open ground front + counter, red awning,
    hanging sign above it, two upper windows with AC units, tiled roof."""
    a = Asset("noodle_shop")
    W, G, H = 6.0, 3.2, 6.0
    holes = [(-2.7, 2.7, 0.03, 3.0)]
    holes.append(window(a, -1.3, 4.15, 1.1, 1.2))
    holes.append(window(a, 1.3, 4.15, 1.1, 1.2))
    shell(a, W, [(0, G, "tile_white"), (G, H, "plaster")], holes, back_mat="cloth_oat")
    # corner piers in brick up the ground floor
    for s in (-1, 1):
        a.add(span(s * 3.03, s * 2.68, 0, 3.05, -0.06, 0.22, "brick", bevel=0.02))
    # counter facing the street (door gap on the right)
    a.add(span(-2.55, 0.9, 0.03, 0.95, 0.25, 0.7, "tile_white", bevel=0.03))
    a.add(span(-2.55, 0.9, 0.62, 0.74, 0.235, 0.26, "red"))
    a.add(span(-2.62, 0.97, 0.95, 1.03, 0.18, 0.76, "metal", bevel=0.02))
    a.add(span(-2.5, -1.9, 1.03, 1.2, 0.35, 0.6, "straw", bevel=0.02))   # stacked bowls/tray on top
    # awning across full width
    a.add(prism_yz([(0.0, 3.08), (0.0, 3.18), (-0.95, 2.86), (-0.95, 2.76)], -3.08, 3.08, "red"))
    a.add(span(-3.08, 3.08, 2.56, 2.82, -0.99, -0.92, "red", bevel=0.015))
    a.add(span(-3.09, 3.09, 2.63, 2.68, -1.0, -0.95, "cloth_white"))
    for s in (-1, 1):
        a.add(rod((s * 2.95, 0.0, 2.5), (s * 2.95, -0.9, 2.79), 0.03, "metal"))
    a.anchors["lantern_hooks"] = []
    for s in (-1, 1):
        hook(a, s * 2.6, -0.96, 2.56, a.anchors["lantern_hooks"])
    # lantern-string hook pair under the awning soffit, over the counter, spaced
    # exactly the street lantern_string span; hung high so lanterns clear heads
    string_hooks = []
    x0 = -2.1
    for x in (x0, x0 + mounts.LANTERN_STRING_SPAN):
        hook(a, x, -0.5, 2.91, string_hooks)
    a.anchors["lantern_string_hooks"] = {"left": string_hooks[0], "right": string_hooks[1]}
    # hanging sign above the awning, on two stand-off brackets
    for x in (-1.6, 1.6):
        a.add(span(x - 0.04, x + 0.04, 3.45, 3.75, -0.2, 0.0, "slate"))
    sign(a, "sign_main", 0, 3.62, 4.2, 0.62, -0.3, rim_mat="lantern_red")
    for s in (-1, 1):
        ac_unit(a, s * 2.45, 4.4)
    pitched_roof(a, W, H)
    stand(a, npc=(-0.8, 1.0, 0.03), player=(-0.8, -1.0, 0), door_pos=(1.85, 0.0, 0))
    a.anchors["counter_top"] = {"pos": pt(-0.8, 0.47, 1.03), "size": [3.5, 0.55]}
    return a


def make_rented_room():
    """3-storey walk-up, 7 m x 9.5 m. Stairwell door + blank number plate,
    6 grilled windows, 3 AC units, laundry pole brackets, ground shutter,
    plaster walls, concrete plinth, flat roof with parapet."""
    a = Asset("rented_room")
    W, H = 7.0, 9.34
    holes = [door(a, 2.3, 1.0, 2.2, leaf="slate")]
    holes.append((-3.0, 0.6, 0.45, 2.85))                              # shutter bay
    for sill in (3.9, 7.0):
        for cx in (-2.3, 0.0, 2.3):
            holes.append(window(a, cx, sill, 1.2, 1.4, frame="metal", grille=True))
    shell(a, W, [(0, 3.1, "tile_white"), (3.1, H, "plaster")], holes)
    a.add(slats(-3.0, 0.6, 0.45, 2.85, 0.1, "metal"))
    a.add(span(-3.1, 0.7, 2.85, 3.05, -0.18, 0.1, "slate", bevel=0.02))  # shutter box
    a.add(span(-3.0, 0.6, 0.45, 0.55, 0.02, 0.1, "slate"))              # bottom bar
    a.add(span(-1.35, -1.05, 0.5, 0.6, -0.02, 0.02, "charcoal"))        # padlock hasp
    a.add(span(-3.52, 3.52, 0, 0.45, -0.07, T, "concrete", bevel=0.03))  # plinth
    band(a, W, 3.05, 3.2, "concrete")
    band(a, W, 6.15, 6.3, "concrete")
    # stairwell canopy + blank number plate above it
    a.add(span(1.6, 3.0, 2.38, 2.48, -0.55, 0.0, "concrete", bevel=0.02))
    sign(a, "number_plate", 2.3, 2.72, 0.42, 0.26, -0.06, rim=0.035, rim_mat="cloth_white",
         face="work_blue", depth=0.05)
    a.anchors["sign_main"] = dict(a.anchors["number_plate"])
    ac_unit(a, -1.15, 4.3)
    ac_unit(a, 1.15, 4.3)
    ac_unit(a, 1.15, 7.4)
    # laundry pole brackets (the street set's laundry_pole_bar, LAUNDRY_POLE_SPAN apart);
    # anchor = rest point on top of each cradle block (pole underside)
    a.anchors["laundry_pole_mounts"] = []
    for cx, top in ((0.0, 8.4), (0.0, 5.3)):
        ends = []
        for x in (cx - mounts.LAUNDRY_POLE_SPAN / 2, cx + mounts.LAUNDRY_POLE_SPAN / 2):
            z = top + 0.25
            a.add(span(x - 0.03, x + 0.03, z - 0.03, z + 0.03, -0.62, 0.0, "slate"))
            a.add(rod((x, -0.55, z), (x, 0.0, z - 0.4), 0.018, "slate", verts=4))
            a.add(span(x - 0.035, x + 0.035, z + 0.03, z + 0.1, -0.62, -0.55, "slate"))  # pole cradle
            ends.append(pt(x, -0.585, z + 0.1))
        a.anchors["laundry_pole_mounts"].append({"left": ends[0], "right": ends[1]})
    flat_roof(a, W, H, mat="concrete")
    stand(a, npc=(1.4, -0.7, 0), player=(1.4, -1.9, 0), door_pos=(2.3, 0.0, 0))
    return a


def make_fruit_stall():
    """3.5 m stall: striped tarp roof on 4 poles (2.3 m), 3 tilted crate racks
    in front, blank header + price-board slot, hanging-scale hook."""
    a = Asset("fruit_stall")
    W, Dp, Hp = 3.5, 1.6, 2.3
    xs = (-W / 2 + 0.05, W / 2 - 0.05)
    for x in xs:
        for y in (0.0, Dp):
            a.add(B.cylinder(0.035, Hp, verts=6, material="metal", loc=(x, y, Hp / 2)))
            a.add(B.cylinder(0.08, 0.04, verts=6, material="slate", loc=(x, y, 0.02)))
    # top frame beams
    for y in (0.0, Dp):
        a.add(span(xs[0], xs[1], Hp - 0.05, Hp, y - 0.025, y + 0.025, "metal"))
    for x in xs:
        a.add(span(x - 0.025, x + 0.025, Hp - 0.05, Hp, 0, Dp, "metal"))
    # tarp: shallow gable, alternating stripes along X
    k = 7
    ym, zp = Dp / 2, Hp + 0.28
    for i in range(k):
        x0 = -W / 2 - 0.15 + (W + 0.3) * i / k
        x1 = -W / 2 - 0.15 + (W + 0.3) * (i + 1) / k
        m = "work_blue" if i % 2 == 0 else "cloth_white"
        a.add(prism_yz([(-0.25, Hp - 0.05), (ym, zp), (ym, zp + 0.04), (-0.25, Hp - 0.01)], x0, x1, m))
        a.add(prism_yz([(ym, zp), (Dp + 0.25, Hp - 0.05), (Dp + 0.25, Hp - 0.01), (ym, zp + 0.04)], x0, x1, m))
        a.add(span(x0, x1, Hp - 0.3, Hp - 0.02, -0.28, -0.25, m))   # front valance
    # blank header board on the front beam
    sign(a, "sign_main", 0, Hp - 0.16, 1.9, 0.2, -0.33, rim=0.04, rim_mat="leaf_green", depth=0.04)
    # three tilted crate racks in front (crates come from the props set)
    tilt = math.radians(32)
    a.anchors["crate_slots"] = []
    for cx in (-1.15, 0.0, 1.15):
        w = 1.0
        # legs
        for x in (cx - 0.45, cx + 0.45):
            a.add(span(x - 0.03, x + 0.03, 0, 0.55, -0.95, -0.89, "wood"))
            a.add(span(x - 0.03, x + 0.03, 0, 1.0, -0.2, -0.14, "wood"))
            a.add(span(x - 0.025, x + 0.025, 0.25, 0.3, -0.95, -0.14, "wood"))
        # tilted board + front lip
        yc, zc = -0.55, 0.78
        a.add(B.box((w, 0.9, 0.05), material="wood", bevel=0.012, loc=(cx, yc, zc), rot=(tilt, 0, 0)))
        a.add(B.box((w, 0.05, 0.16), material="red", bevel=0.01,
                    loc=(cx, yc - 0.45 * math.cos(tilt) + 0.01, zc - 0.45 * math.sin(tilt) + 0.07),
                    rot=(tilt, 0, 0)))
        a.anchors["crate_slots"].append({"pos": pt(cx, yc, zc + 0.03), "tilt_deg": 32.0,
                                         "size": [1.0, 0.9]})
    # back table under the tarp
    a.add(span(-1.4, 1.4, 0.75, 0.8, 1.15, 1.55, "wood", bevel=0.015))
    for x in (-1.3, 1.3):
        a.add(span(x - 0.03, x + 0.03, 0, 0.75, 1.2, 1.5, "wood"))
    # price-board slot clipped to the front-left pole
    a.add(span(xs[0] + 0.03, xs[0] + 0.1, 1.3, 1.7, -0.05, 0.03, "slate"))
    sign(a, "price_board", xs[0] + 0.38, 1.5, 0.46, 0.34, -0.06, rim=0.04, rim_mat="wood", depth=0.03)
    # hanging-scale hook on the front beam
    a.add(rod((0.9, 0.0, Hp - 0.05), (0.9, 0.0, Hp - 0.35), 0.015, "metal", verts=6))
    a.add(B.torus(0.05, 0.012, 8, 4, material="metal", loc=(0.9, 0.0, Hp - 0.4), rot=(PI / 2, 0, 0)))
    a.anchors["scale_hook"] = pt(0.9, 0.0, Hp - 0.45)
    stand(a, npc=(0.0, 0.8, 0), player=(0.0, -1.8, 0), door_pos=(0.0, 0.0, 0))
    return a


def make_supermarket():
    """6 m single storey 3.5 m: glass front with door, light-box sign,
    freezer chest inside, step."""
    a = Asset("supermarket")
    W, H = 6.0, 3.38
    holes = [(-2.7, 2.7, 0.2, 2.72)]
    shell(a, W, [(0, H, "tile_white")], holes, back_mat="cloth_white")
    # aluminium front: mullions + transom; side bays unglazed below the
    # transom so the interior (freezer, shelves) reads (flag: game glass shader)
    for x in (-2.7, -1.55, 1.55, 2.7):
        a.add(span(x - 0.05, x + 0.05, 0.2, 2.72, -0.02, 0.12, "metal", bevel=0.01))
    a.add(span(-2.72, 2.72, 0.16, 0.26, -0.02, 0.12, "metal", bevel=0.01))
    a.add(span(-2.72, 2.72, 2.14, 2.24, -0.02, 0.12, "metal", bevel=0.01))
    a.add(span(-2.7, 2.7, 2.24, 2.68, 0.08, 0.1, "glass"))
    # sliding double door, glazed
    a.add(frame_rect(-1.55, 1.55, 0.2, 2.2, 0.08, -0.01, 0.1, "metal", bottom=False))
    for x0, x1 in ((-1.47, -0.01), (0.01, 1.47)):
        a.add(frame_rect(x0, x1, 0.2, 2.14, 0.06, 0.0, 0.07, "metal"))
        a.add(span(x0 + 0.06, x1 - 0.06, 0.26, 2.08, 0.02, 0.05, "glass"))
    for x in (-0.12, 0.12):
        a.add(span(x - 0.025, x + 0.025, 0.85, 1.35, -0.04, 0.0, "slate", bevel=0.01))
    # interior: freezer chest (left bay) + shelf unit (right bay)
    a.add(span(-2.45, -1.4, 0.03, 0.8, 0.45, 1.05, "tile_white", bevel=0.03))
    a.add(span(-2.42, -1.43, 0.8, 0.86, 0.48, 1.02, "glass"))
    a.add(span(-2.47, -1.38, 0.62, 0.68, 0.43, 1.07, "work_blue"))
    a.add(span(1.7, 2.65, 0.03, 1.9, 0.95, 1.28, "metal", bevel=0.02))
    for i, m in enumerate(("red", "yellow", "leaf_green", "sky_blue")):
        z = 0.25 + i * 0.42
        a.add(span(1.75, 2.6, z, z + 0.3, 0.85, 1.2, m, bevel=0.015))
    light_box(a, "sign_main", 0, 3.02, 5.4, 0.46, rim_mat="red")
    flat_roof(a, W, H, mat="concrete", th=0.12)
    a.add(span(-1.3, 1.3, 0, 0.15, -0.45, 0.0, "concrete", bevel=0.02))  # step
    stand(a, npc=(1.6, -0.55, 0), player=(0.3, -1.4, 0), door_pos=(0.0, 0.0, 0.15))
    return a


def make_bus_stop():
    """Shelter 3 x 1.2 m, bench, pole with blank vertical route board, kerb
    block with yellow stripe."""
    a = Asset("bus_stop")
    Wd, Dp, Hr = 3.0, 1.2, 2.4
    for x in (-Wd / 2 + 0.05, Wd / 2 - 0.05):
        for y in (0.05, Dp - 0.05):
            a.add(span(x - 0.05, x + 0.05, 0, Hr, y - 0.05, y + 0.05, "slate", bevel=0.012))
    a.add(prism_yz([(-0.2, Hr + 0.05), (Dp + 0.1, Hr + 0.14), (Dp + 0.1, Hr + 0.26), (-0.2, Hr + 0.17)],
                   -Wd / 2 - 0.12, Wd / 2 + 0.12, "tile_white", bevel=0.02))
    a.add(span(-Wd / 2 - 0.12, Wd / 2 + 0.12, Hr - 0.05, Hr + 0.07, -0.21, -0.1, "work_blue", bevel=0.015))
    # back glass panel + ad frame, one side panel
    a.add(frame_rect(-Wd / 2 + 0.1, Wd / 2 - 0.1, 0.3, Hr - 0.05, 0.06, Dp - 0.08, Dp - 0.02, "slate", 0.008))
    a.add(span(-Wd / 2 + 0.16, Wd / 2 - 0.16, 0.36, Hr - 0.11, Dp - 0.06, Dp - 0.04, "glass"))
    a.add(frame_rect(Wd / 2 - 0.08, Wd / 2 - 0.02, 0.3, Hr - 0.05, 0.06, 0.1, Dp - 0.1, "slate", 0.008))
    a.add(span(Wd / 2 - 0.06, Wd / 2 - 0.04, 0.36, Hr - 0.11, 0.1, Dp - 0.1, "glass"))
    # bench
    a.add(span(-1.0, 1.0, 0.42, 0.47, Dp - 0.5, Dp - 0.12, "wood", bevel=0.015))
    a.add(span(-1.0, 1.0, 0.62, 0.78, Dp - 0.14, Dp - 0.1, "wood", bevel=0.012))
    for x in (-0.85, 0.85):
        a.add(span(x - 0.03, x + 0.03, 0, 0.42, Dp - 0.45, Dp - 0.17, "slate"))
    a.anchors["seats"] = [pt(x, Dp - 0.3, 0.47) for x in (-0.6, 0.0, 0.6)]
    # route pole + blank vertical route board (0.5 x 0.9)
    px = Wd / 2 + 0.45
    a.add(B.cylinder(0.045, 2.7, verts=8, material="metal", loc=(px, 0.1, 1.35)))
    a.add(B.cylinder(0.12, 0.05, verts=8, material="slate", loc=(px, 0.1, 0.025)))
    a.add(B.cylinder(0.06, 0.08, verts=8, material="slate", loc=(px, 0.1, 2.74)))
    sign(a, "sign_main", px, 2.05, 0.5, 0.9, 0.02, rim=0.04, rim_mat="work_blue", depth=0.03)
    a.anchors["route_board"] = dict(a.anchors["sign_main"])
    # kerb-edge block with yellow stripe
    a.add(span(-Wd / 2 - 0.3, px + 0.3, 0, 0.12, -0.75, -0.4, "concrete"))
    a.add(span(-Wd / 2 - 0.3, px + 0.3, 0.12, 0.135, -0.75, -0.6, "yellow"))
    stand(a, npc=(0.4, 0.45, 0), player=(px - 0.4, -0.2, 0), door_pos=(0.0, 0.0, 0))
    return a


def make_warehouse():
    """9 m x 5 m corrugated-panel shed: half-open roller door, 1 m loading
    dock with steps, blank sign over the door."""
    a = Asset("warehouse")
    W, H = 9.0, 4.75
    zc = 0.4                                   # concrete plinth top
    dx0, dx1, dz0, dz1 = -1.8, 1.8, 1.0, 3.6   # roller door opening
    cw = lambda p0, p1, z0, z1, out: a.add(corrugated(p0, p1, z0, z1, 0.12, "work_blue", outward=out))
    cw((-W / 2, 0.08), (dx0, 0.08), zc, H, (0, -1))
    cw((dx1, 0.08), (W / 2, 0.08), zc, H, (0, -1))
    cw((dx0, 0.08), (dx1, 0.08), dz1, H, (0, -1))
    a.add(span(dx0, dx1, zc, dz0, 0.0, 0.2, "concrete"))
    for s in (-1, 1):
        x = s * (W / 2 - 0.08)
        cw((x, 0.2), (x, RET), zc, H, (s, 0))
    a.add(span(-W / 2, W / 2, zc, H, RET - 0.12, RET, "charcoal"))          # dark interior back
    a.add(span(-W / 2 + 0.1, W / 2 - 0.1, 0, dz0, 0.2, RET - 0.12, "slate"))  # interior floor at dock level
    a.add(span(-W / 2 - 0.02, W / 2 + 0.02, 0, zc, 0.0, RET + 0.02, "concrete", bevel=0.02))
    # corner trims + top flashing + flat roof
    for s in (-1, 1):
        a.add(span(s * (W / 2 + 0.04), s * (W / 2 - 0.12), zc, H, -0.04, 0.12, "metal", bevel=0.015))
    a.add(span(-W / 2 - 0.1, W / 2 + 0.1, H, H + 0.25, -0.12, RET + 0.05, "metal", bevel=0.03))
    # roller door: guides, roller box, curtain half down, bottom bar + handle
    for x in (dx0 - 0.06, dx1 + 0.06):
        a.add(span(x - 0.07, x + 0.07, dz0, dz1, -0.12, 0.1, "slate", bevel=0.012))
    a.add(span(dx0 - 0.15, dx1 + 0.15, dz1, dz1 + 0.3, -0.3, 0.05, "metal", bevel=0.03))
    a.add(slats(dx0, dx1, 2.35, dz1, 0.05, "metal", pitch=0.14))
    a.add(span(dx0, dx1, 2.27, 2.37, -0.02, 0.1, "slate", bevel=0.01))
    a.add(span(-0.2, 0.2, 2.21, 2.27, -0.05, 0.0, "slate"))
    # sign over the door
    sign(a, "sign_main", 0, 4.24, 3.8, 0.5, -0.2, rim=0.07, rim_mat="navy", depth=0.08)
    # loading dock + bumpers + yellow edge, steps down on the right
    a.add(span(-3.2, 2.4, 0, 1.0, -2.0, 0.0, "concrete", bevel=0.03))
    a.add(span(-3.2, 2.4, 0.96, 1.005, -2.0, -1.85, "yellow"))
    for x in (-2.4, -0.6, 1.2):
        a.add(span(x - 0.15, x + 0.15, 0.45, 0.85, -2.1, -1.98, "charcoal", bevel=0.02))
    for i in range(3):
        top = 1.0 - (i + 1) * 0.333
        a.add(span(2.4 + i * 0.35, 2.4 + (i + 1) * 0.35, 0, top, -1.7, -0.3, "concrete", bevel=0.015))
    a.add(rod((2.4, -1.72, 1.0), (2.4, -1.72, 1.9), 0.03, "yellow"))
    a.add(rod((3.45, -1.72, 0.0), (3.45, -1.72, 0.9), 0.03, "yellow"))
    a.add(rod((2.4, -1.72, 1.9), (3.45, -1.72, 0.9), 0.03, "yellow"))
    # side personnel door on the left
    a.add(span(-3.95, -3.05, zc, 2.3, -0.1, 0.02, "slate", bevel=0.015))
    a.add(span(-3.25, -3.19, 1.3, 1.45, -0.15, -0.1, "metal"))
    stand(a, npc=(-0.6, -1.2, 1.0), player=(-0.6, -2.7, 0), door_pos=(0.0, 0.0, 1.0))
    a.anchors["personnel_door"] = {"pos": pt(-3.5, -0.1, 0.0), "facing": FRONT_N}
    a.anchors["dock_top_z"] = 1.0
    return a


def lattice(a, x0, x1, z0, z1, y, pitch=0.2, bar=0.035, mat="wood_dark", backing="paper", rim=0.07):
    """Wooden lattice screen over a paper backing, with rim."""
    a.add(span(x0, x1, z0, z1, y + 0.03, y + 0.06, backing))
    a.add(frame_rect(x0, x1, z0, z1, rim, y - 0.03, y + 0.06, mat, 0.012))
    nx = max(1, round((x1 - x0 - 2 * rim) / pitch))
    nz = max(1, round((z1 - z0 - 2 * rim) / pitch))
    for i in range(1, nx):
        x = x0 + rim + (x1 - x0 - 2 * rim) * i / nx
        a.add(span(x - bar / 2, x + bar / 2, z0 + rim, z1 - rim, y, y + 0.03, mat))
    for j in range(1, nz):
        z = z0 + rim + (z1 - z0 - 2 * rim) * j / nz
        a.add(span(x0 + rim, x1 - rim, z - bar / 2, z + bar / 2, y, y + 0.03, mat))


def make_tea_house():
    """6 m, 2 storeys: dark-wood lattice front, red double doors, small tiled
    eave over the entrance, blank plaque + vertical sign, round moon window."""
    a = Asset("tea_house")
    W, G, H = 6.0, 3.2, 6.4
    holes = [(-2.7, 2.7, 0.0, 2.9)]
    shell(a, W, [(0, G, "plaster"), (G, H, "plaster")], holes, back_mat="wood_dark")
    # wooden structure: posts, top beam, floor beam
    for x in (-2.85, -0.9, 0.9, 2.85):
        a.add(span(x - 0.13, x + 0.13, 0, 3.1, -0.08, 0.2, "wood_dark", bevel=0.02))
    a.add(span(-3.02, 3.02, 2.85, 3.3, -0.1, 0.2, "wood_dark", bevel=0.02))
    for s in (-1, 1):
        x0, x1 = sorted((s * 2.72, s * 1.03))
        a.add(span(x0, x1, 0.0, 0.45, -0.02, 0.18, "wood_dark", bevel=0.015))
        lattice(a, x0, x1, 0.45, 2.85, 0.0)
    # red double doors with brass rings
    a.add(span(-0.77, 0.77, 2.4, 2.85, 0.0, 0.18, "wood_dark"))
    for x0, x1 in ((-0.77, -0.01), (0.01, 0.77)):
        a.add(span(x0, x1, 0.0, 2.4, 0.06, 0.14, "red", bevel=0.015))
        for z0, z1 in ((0.3, 1.1), (1.3, 2.2)):
            a.add(span(x0 + 0.12, x1 - 0.12, z0, z1, 0.03, 0.06, "lantern_red", bevel=0.012))
    for x in (-0.15, 0.15):
        a.add(B.torus(0.07, 0.015, 10, 4, material="yellow", loc=(x, 0.02, 1.2), rot=(PI / 2, 0, 0)))
    a.add(span(-1.0, 1.0, 0.0, 0.08, -0.4, 0.0, "concrete", bevel=0.015))   # door sill step
    # small tiled eave over the entrance
    tile_roof(a, -1.35, 1.35, -0.8, 2.95, 0.0, 3.35, th=0.08, pitch=0.25, fascia="lantern_red",
              ridge=False)
    # blank vertical sign on the right door post
    sign(a, "sign_vertical", 1.18, 1.65, 0.42, 1.3, -0.2, rim=0.06, rim_mat="wood_dark", depth=0.08)
    # upper floor: plaque, moon window, two small lattice windows
    sign(a, "sign_main", 0, 3.95, 2.2, 0.5, -0.12, rim=0.08, rim_mat="wood_dark")
    cz, r = 5.3, 0.62
    a.add(disc_front(0, -0.01, cz, r, 0.04, "paper", verts=20))
    for i in range(-2, 3):
        d = i * 0.24
        c = math.sqrt(max(r * r - d * d, 0.0)) - 0.02
        a.add(span(d - 0.02, d + 0.02, cz - c, cz + c, -0.06, -0.02, "wood_dark"))
        a.add(span(-c, c, cz + d - 0.02, cz + d + 0.02, -0.06, -0.02, "wood_dark"))
    a.add(B.torus(r + 0.03, 0.07, 20, 6, material="wood_dark", loc=(0, -0.05, cz), rot=(PI / 2, 0, 0)))
    for cx in (-2.0, 2.0):
        lattice(a, cx - 0.45, cx + 0.45, 4.7, 5.8, -0.06, pitch=0.18, rim=0.08)
        a.add(span(cx - 0.55, cx + 0.55, 4.6, 4.7, -0.14, 0.05, "wood_dark", bevel=0.015))
    for x in (-2.95, 2.95):
        a.add(span(x - 0.08, x + 0.08, 3.3, H, -0.05, 0.2, "wood_dark", bevel=0.015))
    pitched_roof(a, W, H, over=0.5, rise=0.65, side=0.25, fascia="lantern_red")
    a.anchors["lantern_hooks"] = []
    for s in (-1, 1):
        hook(a, s * 1.2, -0.84, 2.87, a.anchors["lantern_hooks"])
    stand(a, npc=(-1.6, -0.6, 0), player=(-1.6, -1.9, 0), door_pos=(0.0, 0.0, 0.08))
    return a


def make_district_gate():
    """6 m x 5 m arched gateway: two pillars, closed iron gate, blank plaque,
    small tiled cap. The locked gate to the Phase 2 district."""
    a = Asset("district_gate")
    W, Dp = 6.0, 0.8
    pw, spring, crown, top = 0.8, 2.85, 3.35, 4.1
    xi = W / 2 - pw
    for s in (-1, 1):
        x0, x1 = sorted((s * W / 2, s * xi))
        a.add(span(x0, x1, 0.35, top, 0, Dp, "brick", bevel=0.03))
        a.add(span(x0 - 0.06, x1 + 0.06, 0, 0.35, -0.06, Dp + 0.06, "concrete", bevel=0.03))
        a.add(span(x0 - 0.04, x1 + 0.04, 2.72, 2.86, -0.04, Dp + 0.04, "concrete", bevel=0.02))
    # arched lintel: flat top, segmental arch underside
    n = 10
    half = xi
    R = (half * half + (crown - spring) ** 2) / (2 * (crown - spring))
    zc = crown - R
    arch = [(half - 2 * half * i / n, zc + math.sqrt(R * R - (half - 2 * half * i / n) ** 2))
            for i in range(n + 1)]
    prof = [(xi, spring - 0.001)] + arch[1:-1] + [(-xi, spring - 0.001), (-xi, top), (xi, top)]
    a.add(prism_xz(prof, 0.02, Dp - 0.02, "brick"))
    a.add(span(-W / 2 - 0.08, W / 2 + 0.08, top, top + 0.15, -0.08, Dp + 0.08, "concrete", bevel=0.03))
    tile_roof(a, -W / 2 - 0.25, W / 2 + 0.25, -0.25, top + 0.1, Dp / 2, top + 0.45, th=0.1,
              pitch=0.3, fascia="lantern_red", ridge=True, upturn=True)
    tile_roof(a, W / 2 + 0.25, -W / 2 - 0.25, Dp + 0.25, top + 0.1, Dp / 2, top + 0.45, th=0.1,
              pitch=0.6, fascia="lantern_red", ridge=False)
    # blank plaque over the arch
    sign(a, "sign_main", 0, 3.7, 1.7, 0.44, -0.14, rim=0.08, rim_mat="yellow")
    # closed iron gate: two leaves of bars, rails, spear tips, padlock
    yg = Dp / 2
    nb = 22
    for i in range(nb + 1):
        x = -xi + 0.08 + (2 * xi - 0.16) * i / nb
        zt = min(spring - 0.1, zc + math.sqrt(max(R * R - x * x, 0)) - 0.15)
        a.add(span(x - 0.022, x + 0.022, 0.05, zt, yg - 0.022, yg + 0.022, "charcoal"))
        a.add(B.cone(0.045, 0.14, verts=4, material="charcoal", loc=(x, yg, zt + 0.07)))
    for z in (0.15, 1.2, 2.45):
        a.add(span(-xi + 0.02, xi - 0.02, z - 0.04, z + 0.04, yg - 0.035, yg + 0.035, "charcoal", bevel=0.01))
    for x in (-xi + 0.05, -0.03, 0.03, xi - 0.05):
        a.add(span(x - 0.03, x + 0.03, 0.05, 2.52, yg - 0.035, yg + 0.035, "charcoal"))
    a.add(span(-0.1, 0.1, 1.0, 1.22, yg - 0.1, yg - 0.04, "yellow", bevel=0.015))   # padlock body
    a.add(B.torus(0.06, 0.014, 8, 4, material="metal", loc=(0, yg - 0.07, 1.26), rot=(PI / 2, 0, 0)))
    stand(a, npc=(2.1, -0.8, 0), player=(0.0, -1.6, 0), door_pos=(0.0, yg, 0))
    return a


def make_filler_shutter():
    """5 m 2-storey closed shop: roller shutter down, blank sign."""
    a = Asset("filler_shutter")
    W, G, H = 5.0, 3.2, 6.0
    holes = [(-2.1, 2.1, 0.1, 2.7)]
    holes.append(window(a, -1.2, 4.1, 1.1, 1.3, frame="metal"))
    holes.append(window(a, 1.2, 4.1, 1.1, 1.3, frame="metal"))
    shell(a, W, [(0, G, "tile_white"), (G, H, "brick")], holes, floor=False)
    a.add(slats(-2.1, 2.1, 0.1, 2.7, 0.08, "metal"))
    a.add(span(-2.1, 2.1, 0.1, 0.2, 0.0, 0.08, "slate"))
    a.add(span(-2.2, 2.2, 2.7, 2.92, -0.16, 0.08, "slate", bevel=0.02))
    for x in (-2.15, 2.15):
        a.add(span(x - 0.05, x + 0.05, 0.1, 2.7, -0.04, 0.1, "slate"))
    sign(a, "sign_main", 0, 3.28, 4.2, 0.5, -0.12, rim=0.07, rim_mat="red")
    ac_unit(a, 0.0, 4.5)
    band(a, W, 5.8, 6.0, "concrete")
    flat_roof(a, W, H)
    stand(a, npc=(-1.0, -0.6, 0), player=(-1.0, -1.8, 0), door_pos=(0.0, 0.0, 0))
    return a


def make_filler_phone_shop():
    """4 m 2-storey phone shop: glass front, blank light box, bright trim."""
    a = Asset("filler_phone_shop")
    W, G, H = 4.0, 3.2, 6.0
    trim = "hivis_orange"
    holes = [(-1.75, 1.75, 0.15, 2.55)]
    holes.append(window(a, 0.0, 4.1, 1.8, 1.3, frame="metal"))
    shell(a, W, [(0, G, "tile_white"), (G, H, "plaster")], holes, floor=False)
    a.add(frame_rect(-1.8, 1.8, 0.1, 2.6, 0.08, -0.04, 0.12, trim, 0.015))
    a.add(span(-1.72, 1.72, 0.18, 2.52, 0.08, 0.1, "glass"))
    a.add(span(0.25, 0.33, 0.18, 2.52, -0.02, 0.1, trim))
    a.add(frame_rect(0.33, 1.72, 0.18, 2.3, 0.05, 0.0, 0.07, "metal", bottom=False))   # glass door
    a.add(span(0.45, 0.5, 1.0, 1.5, -0.03, 0.0, "slate"))
    for x0, x1 in ((-1.55, -1.0), (-0.85, -0.3)):                                   # poster panels
        a.add(span(x0, x1, 1.1, 2.0, 0.05, 0.08, "sky_blue"))
    light_box(a, "sign_main", 0, 2.93, 3.6, 0.42, rim_mat=trim)
    a.add(span(-2.02, 2.02, 0.0, 0.12, -0.06, T, trim))
    ac_unit(a, 1.45, 4.4)
    band(a, W, 5.8, 6.0, trim, out=0.04)
    flat_roof(a, W, H)
    stand(a, npc=(-0.8, -0.6, 0), player=(-0.8, -1.8, 0), door_pos=(1.0, 0.0, 0))
    return a


def make_filler_tailor():
    """4 m 2-storey tailor: wooden front, blank vertical sign, display window
    with an empty clothes rail."""
    a = Asset("filler_tailor")
    W, G, H = 4.0, 3.2, 6.0
    holes = [(-1.75, 0.15, 0.8, 2.6)]
    holes.append(door(a, 1.05, 0.9, 2.2, leaf="wood", frame="wood_dark", glass_top=True))
    holes.append(window(a, -0.7, 4.0, 1.4, 1.3, frame="wood_dark"))
    shell(a, W, [(0, G, "wood"), (G, H, "plaster")], holes, back_mat="cloth_oat", floor=False)
    for x in (-1.9, 0.35, 1.9):                                           # wooden pilasters
        a.add(span(x - 0.1, x + 0.1, 0, 3.0, -0.06, 0.1, "wood_dark", bevel=0.015))
    a.add(span(-2.02, 2.02, 2.8, 3.1, -0.1, 0.1, "wood_dark", bevel=0.02))
    # display window: frame, sill, empty rail inside on two uprights
    a.add(frame_rect(-1.8, 0.2, 0.75, 2.65, 0.07, -0.04, 0.1, "wood_dark", 0.012))
    a.add(span(-1.85, 0.25, 0.68, 0.8, -0.14, 0.12, "wood_dark", bevel=0.015))
    for x in (-1.4, -0.2):
        a.add(rod((x, 0.8, 0.8), (x, 0.8, 2.15), 0.02, "metal"))
    a.add(rod((-1.5, 0.8, 2.15), (-0.1, 0.8, 2.15), 0.02, "metal"))
    for x in (-1.2, -0.8, -0.4):
        a.add(rod((x, 0.8, 2.17), (x, 0.8, 2.05), 0.008, "metal", verts=4))
        a.add(rod((x - 0.2, 0.8, 1.97), (x, 0.8, 2.05), 0.01, "wood", verts=4))
        a.add(rod((x + 0.2, 0.8, 1.97), (x, 0.8, 2.05), 0.01, "wood", verts=4))
    a.add(span(-1.75, 0.15, 0.78, 0.8, 0.2, 1.3, "cloth_oat"))     # display floor
    # blank vertical sign on the upper storey
    sign(a, "sign_main", 1.3, 4.55, 0.6, 1.8, -0.12, rim=0.07, rim_mat="wood_dark")
    a.anchors["sign_vertical"] = dict(a.anchors["sign_main"])
    band(a, W, 5.8, 6.0, "wood_dark", out=0.05)
    flat_roof(a, W, H, mat="roof_tile")
    stand(a, npc=(0.0, -0.6, 0), player=(0.0, -1.8, 0), door_pos=(1.05, 0.0, 0))
    return a


# ==========================================================================
# street tiles (exact tiling: edges at +-half size, no bevel on tiling edges)
# ==========================================================================
ROAD = (8.0, 4.0, 0.05)       # x along the street, y across, thickness
PAVE = (8.0, 2.0, 0.18)       # pavement slab top; kerb stands 0.2
KERB_H, KERB_W = 0.2, 0.2


def make_road(crossing=False):
    name = "road_crossing" if crossing else "road_straight"
    a = Asset(name, kind="tile")
    L, Wd, th = ROAD
    a.add(span(-L / 2, L / 2, 0, th, -Wd / 2, Wd / 2, "asphalt"))
    if crossing:
        for i in range(6):
            x = -2.25 + i * 0.9
            a.add(span(x - 0.22, x + 0.22, th, th + 0.01, -1.6, 1.6, "cloth_white"))
    else:
        for x0 in (-3.0, 1.0):
            a.add(span(x0, x0 + 2.0, th, th + 0.006, -0.06, 0.06, "cloth_white"))
    a.anchors = {"surface_z": th, "tile_size": [L, Wd], "runs_along": "x"}
    return a


def make_pavement():
    a = Asset("pavement_straight", kind="tile")
    L, Wd, th = PAVE
    y_k = -Wd / 2 + KERB_W
    a.add(span(-L / 2, L / 2, 0, th - 0.02, y_k, Wd / 2, "paving"))
    for i in range(8):
        x0 = -L / 2 + i * 1.0
        a.add(span(x0 + 0.015, x0 + 0.985, th - 0.02, th, y_k + 0.015, Wd / 2 - 0.015, "paving"))
    a.add(span(-L / 2, L / 2, 0, KERB_H, -Wd / 2, y_k, "concrete"))
    a.anchors = {"surface_z": th, "kerb_top_z": KERB_H, "kerb_side": "+z", "tile_size": [L, Wd]}
    return a


def make_pavement_corner():
    a = Asset("pavement_corner", kind="tile")
    S, th = 2.0, PAVE[2]
    h = S / 2
    y_k, x_k = -h + KERB_W, h - KERB_W
    a.add(span(-h, x_k, 0, th - 0.02, y_k, h, "paving"))
    for i in range(2):
        for j in range(2):
            x0 = -h + i * (x_k + h) / 2
            x1 = -h + (i + 1) * (x_k + h) / 2
            y0 = y_k + j * (h - y_k) / 2
            y1 = y_k + (j + 1) * (h - y_k) / 2
            a.add(span(x0 + 0.015, x1 - 0.015, th - 0.02, th, y0 + 0.015, y1 - 0.015, "paving"))
    a.add(span(-h, h, 0, KERB_H, -h, y_k, "concrete"))
    a.add(span(x_k, h, 0, KERB_H, y_k, h, "concrete"))
    a.anchors = {"surface_z": th, "kerb_top_z": KERB_H, "kerb_sides": ["+z", "+x"], "tile_size": [S, S]}
    return a


def make_manhole():
    a = Asset("manhole", kind="tile")
    a.add(B.cylinder(0.4, 0.02, verts=16, material="slate", loc=(0, 0, 0.01), smooth=False))
    a.add(B.cylinder(0.33, 0.012, verts=16, material="charcoal", loc=(0, 0, 0.026), smooth=False))
    for i in range(3):
        y = (i - 1) * 0.18
        c = math.sqrt(0.3 ** 2 - y * y)
        a.add(span(-c, c, 0.032, 0.04, y - 0.025, y + 0.025, "slate"))
    a.anchors = {"surface_z": 0.04}
    return a


def make_drain_grate():
    """Flat kerb-side drain grate 0.5 x 0.9 m: frame + 7 bars."""
    a = Asset("drain_grate", kind="tile")
    x, y = 0.25, 0.45
    a.add(span(-x + 0.05, x - 0.05, 0, 0.01, -y + 0.05, y - 0.05, "charcoal"))
    a.add(span(-x, x, 0, 0.03, -y, -y + 0.05, "slate"), span(-x, x, 0, 0.03, y - 0.05, y, "slate"),
          span(-x, -x + 0.05, 0, 0.03, -y + 0.05, y - 0.05, "slate"),
          span(x - 0.05, x, 0, 0.03, -y + 0.05, y - 0.05, "slate"))
    for i in range(7):
        yy = -y + 0.05 + (2 * y - 0.1) * (i + 0.5) / 7
        a.add(span(-x + 0.05, x - 0.05, 0.005, 0.025, yy - 0.02, yy + 0.02, "slate"))
    a.anchors = {"surface_z": 0.03}
    return a


# ==========================================================================
# checks + main
# ==========================================================================
BUILDINGS = [  # (fn, nominal width, nominal height incl. roof (range), tri budget)
    (make_noodle_shop, 6.0, (6.0, 7.2), BUILDING_TRIS),
    (make_rented_room, 7.0, (9.4, 9.6), BUILDING_TRIS),
    (make_fruit_stall, 3.5, (2.3, 2.8), 2500),
    (make_supermarket, 6.0, (3.45, 3.6), BUILDING_TRIS),
    (make_bus_stop, 3.0, (2.6, 2.9), 2000),
    (make_warehouse, 9.0, (4.95, 5.05), BUILDING_TRIS),
    (make_tea_house, 6.0, (6.0, 7.4), BUILDING_TRIS),
    (make_district_gate, 6.0, (4.9, 5.1), 3000),
    (make_filler_shutter, 5.0, (6.0, 6.3), BUILDING_TRIS),
    (make_filler_phone_shop, 4.0, (6.0, 6.3), BUILDING_TRIS),
    (make_filler_tailor, 4.0, (6.0, 6.3), BUILDING_TRIS),
]
TILES = [
    (lambda: make_road(False), (8.0, 4.0)),
    (lambda: make_road(True), (8.0, 4.0)),
    (make_pavement, (8.0, 2.0)),
    (make_pavement_corner, (2.0, 2.0)),
    (make_manhole, (0.8, 0.8)),
    (make_drain_grate, (0.5, 0.9)),
]
REQUIRED = ("sign_main", "door", "npc_stand", "player_stand")


def check_building(a, obj, width, hrange, budget):
    t = B.tri_count(obj)
    lo, hi = B.bbox(obj)
    size = hi - lo
    assert t <= budget, "%s tris %d > %d" % (a.name, t, budget)
    assert abs(lo.z) < 1e-5, "%s base z %.4f" % (a.name, lo.z)
    assert abs(lo.x + hi.x) < 1e-4, "%s not centred in X" % a.name
    assert hrange[0] - 0.01 <= size.z <= hrange[1] + 0.01, "%s height %.3f not in %s" % (a.name, size.z, hrange)
    assert width - 0.05 <= size.x <= width + 1.4, "%s width %.3f vs %.1f" % (a.name, size.x, width)
    for k in REQUIRED:
        assert k in a.anchors, "%s missing anchor %s" % (a.name, k)
    # mount pairs must match the span of the street asset that hangs from them
    if "lantern_string_hooks" in a.anchors:
        h = a.anchors["lantern_string_hooks"]
        mounts.check_pair(h["left"], h["right"], mounts.LANTERN_STRING_SPAN, a.name + " lantern_string_hooks")
    for m in a.anchors.get("laundry_pole_mounts", []):
        mounts.check_pair(m["left"], m["right"], mounts.LAUNDRY_POLE_SPAN, a.name + " laundry_pole_mounts")
    return t, size


def check_tile(a, obj, xy):
    t = B.tri_count(obj)
    lo, hi = B.bbox(obj)
    assert t <= TILE_TRIS, "%s tris %d > %d" % (a.name, t, TILE_TRIS)
    assert abs(lo.z) < 1e-6, "%s base z %.5f" % (a.name, lo.z)
    for axis, full in zip("xy", xy):
        l, h = getattr(lo, axis), getattr(hi, axis)
        assert abs(l + full / 2) < 1e-5 and abs(h - full / 2) < 1e-5, \
            "%s %s edges %.5f..%.5f != +-%.3f" % (a.name, axis, l, h, full / 2)
    return t, hi - lo


def edge_profile(obj, axis, side):
    """Set of vertex cross-section coords lying on the tile's min/max edge."""
    lo, hi = B.bbox(obj)
    i = "xyz".index(axis)
    e = hi[i] if side > 0 else lo[i]
    return {tuple(round(v.co[j], 5) for j in range(3) if j != i)
            for v in obj.data.vertices if abs(v.co[i] - e) < 1e-6}


def tiling_check(obj, axis="x"):
    """Place a copy one tile-length along ``axis`` and assert the shared edge
    has no gap/overlap and the cross-section extents match."""
    lo, hi = B.bbox(obj)
    i = "xyz".index(axis)
    L = hi[i] - lo[i]
    lo2 = lo.copy()
    hi2 = hi.copy()
    lo2[i] += L
    hi2[i] += L
    gap = lo2[i] - hi[i]
    assert abs(gap) < 1e-6, "%s tiling gap %.6f" % (obj.name, gap)
    for j in range(3):
        if j != i:
            assert abs(lo2[j] - lo[j]) < 1e-9 and abs(hi2[j] - hi[j]) < 1e-9
    # every vertex on the +edge must have a partner on the -edge (profile matches)
    plus, minus = edge_profile(obj, axis, +1), edge_profile(obj, axis, -1)
    assert plus == minus, "%s edge profiles differ (%d vs %d verts)" % (obj.name, len(plus), len(minus))
    print("TILECHECK %s x2 along %s: A.max=%.4f B.min=%.4f gap=%.6f edge-profile verts=%d match"
          % (obj.name, axis, hi[i], lo2[i], gap, len(plus)))


def main():
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith(".glb") or f in ("sheet.png", "manifest.json"):
            os.remove(os.path.join(OUT, f))
    manifest, order, report, edges = [], [], [], {}

    def ship(a, obj, tris, size):
        info = export.export_glb(obj, os.path.join(OUT, a.name + ".glb"))
        assert info["tris"] == tris
        order.append(a.name + ".glb")
        manifest.append({"name": a.name, "kind": a.kind, "file": a.name + ".glb", "tris": tris,
                         "size_m": [round(size.x, 3), round(size.z, 3), round(size.y, 3)],
                         "origin": "facade" if a.kind == "building" else "feet",
                         "anchors": _conv(a.anchors, a.shift)})
        report.append("%-18s %-8s tris=%5d size(w,h,d)=%.2f x %.2f x %.2f"
                      % (a.name, a.kind, tris, size.x, size.z, size.y))

    for fn, width, hrange, budget in BUILDINGS:
        a = fn()
        obj = a.finish(centre=True)
        tris, size = check_building(a, obj, width, hrange, budget)
        ship(a, obj, tris, size)
    for fn, xy in TILES:
        a = fn()
        obj = a.finish(centre=False)
        tris, size = check_tile(a, obj, xy)
        if a.name in ("road_straight", "road_crossing", "pavement_straight"):
            tiling_check(obj, "x")
        if a.name in ("road_straight", "pavement_straight"):
            edges[a.name] = edge_profile(obj, "x", +1)
        if a.name == "road_crossing":
            assert edge_profile(obj, "x", -1) == edges["road_straight"], "crossing/road edge mismatch"
            print("TILECHECK road_straight(+x) meets road_crossing(-x): edge profiles match")
        if a.name == "pavement_corner":
            assert edge_profile(obj, "x", -1) == edges["pavement_straight"], "corner/pavement edge mismatch"
            print("TILECHECK pavement_straight(+x) meets pavement_corner(-x): edge profiles match")
        ship(a, obj, tris, size)
    assert len(order) == 17, len(order)
    M.write(OUT, manifest)
    print("SUMMARY %d GLBs in %s" % (len(order), OUT))
    for line in report:
        print("ASSET " + line)
    sheet.render_sheet(OUT, os.path.join(OUT, "sheet.png"), cols=6, true_scale=True, files=order,
                       resolution=(2400, 1500))


if __name__ == "__main__":
    main()
