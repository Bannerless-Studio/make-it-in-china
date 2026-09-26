#!/usr/bin/env python3
"""Street mock-up: real buildings on real road tiles, dressed with street
props, job props and characters, placed ONLY through manifest anchors.

    blender -b --python-exit-code 1 --python tools/blender/mockup.py

Outputs assets/street_mockup.png (2400x1350, the game's fixed high
three-quarter camera framed on the noodle-shop block), assets/
street_mockup_wide.png (whole street) and assets/street_mockup.glb (the scene,
linked instances). This is the integration test for the library: it asserts
mount spans (lantern string, laundry poles), crate slots, the scale hook and
that nothing placed on the ground floats or sinks (downward ray-casts).

Layout (Blender, Z up; the street runs along X, camera on the -Y side):
road y in [-2, 2] (surface 0.05), far pavement y in [2, 4], near pavement
y in [-4, -2] (surface 0.18). Far buildings face -Y with their facade on
y = 4 (set back if a dock/awning would overhang the kerb); near-side items
are rotated 180 degrees so their fronts face the road.
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

from lib import build as B  # noqa: E402
from lib import mounts, sheet  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
ASSETS = os.path.join(ROOT, "assets")
OUT_PNG = os.path.join(ASSETS, "street_mockup.png")
OUT_WIDE = os.path.join(ASSETS, "street_mockup_wide.png")
OUT_GLB = os.path.join(ASSETS, "street_mockup.glb")
RES = (2400, 1350)
PI = math.pi

PAVE_Z = 0.18          # pavement_straight surface_z
KERB_Y = 2.0           # far kerb line (near kerb at -2)
FACADE_Y = 4.0         # back edge of the far pavement
BG = (0.93, 0.85, 0.72)

MAN = {}
for _s in ("characters", "buildings", "street", "props", "interiors"):
    with open(os.path.join(ASSETS, _s, "manifest.json")) as _fh:
        for _e in json.load(_fh):
            if not _e.get("external"):
                MAN[(_s, _e["name"])] = _e


def g2b(p):
    """glTF asset-space point -> Blender asset-space vector."""
    return Vector((p[0], -p[2], p[1]))


def facing_rot(f, base_rot=0.0):
    """Z rotation so a -Y-facing asset looks along glTF facing ``f`` of a
    parent rotated by ``base_rot``."""
    d = Vector((f[0], -f[2]))
    return base_rot + math.atan2(d.x, -d.y)


class Mockup:
    def __init__(self):
        B.clear_scene()
        self.masters = {}
        self.placed = []          # (obj, set, name, ground_check)
        self.coll = bpy.context.scene.collection

    def master(self, s, name):
        key = (s, name)
        if key not in self.masters:
            assert key in MAN, "not in any manifest: %s/%s" % key
            o = sheet._import_glb(os.path.join(ASSETS, s, MAN[key]["file"]))
            self.coll.objects.unlink(o)
            self.masters[key] = o
        return self.masters[key]

    def place(self, s, name, loc, rot_z=0.0, rot=None, ground=True):
        """Linked instance of an asset at ``loc`` (Blender world). ``ground``:
        verify it stands on something (feet-origin assets on the ground)."""
        o = self.master(s, name).copy()
        o.name = name
        self.coll.objects.link(o)
        o.location = Vector(loc)
        o.rotation_euler = rot if rot is not None else (0.0, 0.0, rot_z)
        self.placed.append((o, s, name, ground))
        return o

    @staticmethod
    def world(parent, p):
        """World position of glTF anchor point ``p`` on placed object ``parent``."""
        bpy.context.view_layer.update()
        return parent.matrix_world @ g2b(p)

    @staticmethod
    def anchors(s, name):
        return MAN[(s, name)]["anchors"]


# --------------------------------------------------------------------------
# layout
# --------------------------------------------------------------------------
def lay_street(m, n_tiles=7, crossing_index=4):
    x0 = -(n_tiles - 1) * 4.0
    for i in range(n_tiles):
        x = x0 + i * 8.0
        m.place("buildings", "road_crossing" if i == crossing_index else "road_straight", (x, 0, 0), ground=False)
        m.place("buildings", "pavement_straight", (x, 3.0, 0), ground=False)          # kerb (+z) -> -Y road side
        m.place("buildings", "pavement_straight", (x, -3.0, 0), rot_z=PI, ground=False)
    half = n_tiles * 4.0
    # flat forecourt beyond both pavements so set-backs and gaps read as ground
    for y0, y1 in ((FACADE_Y, FACADE_Y + 2.6), (-FACADE_Y - 2.0, -FACADE_Y)):
        g = B.box((2 * half + 24, y1 - y0, PAVE_Z), material="paving", loc=(0, (y0 + y1) / 2, PAVE_Z / 2),
                  name="forecourt")
        m.placed.append((g, "mockup", "forecourt", False))
    # extra road + pavements beyond the tile run so the wide shot has no hard edge
    for sx in (-1, 1):
        g = B.box((12, 4, .05), material="asphalt", loc=(sx * (half + 6), 0, .025), name="road_ext")
        m.placed.append((g, "mockup", "road_ext", False))
        for sy in (-1, 1):
            g = B.box((12, 2, PAVE_Z), material="paving", loc=(sx * (half + 6), sy * 3, PAVE_Z / 2), name="pave_ext")
            m.placed.append((g, "mockup", "pave_ext", False))
    return x0 - 4.0, half


FAR_ROW = ["district_gate", "tea_house", "rented_room", "noodle_shop", "fruit_stall", "supermarket",
           "filler_phone_shop", "bus_stop", "warehouse"]


def lay_far_row(m, x_start):
    """Buildings left to right along the far pavement; returns name -> object."""
    out, x = {}, x_start
    for name in FAR_ROW:
        mo = m.master("buildings", name)
        lo, hi = B.bbox(mo)
        overhang = -lo.y                                   # protrusion toward the street
        y = max(FACADE_Y, KERB_Y + .1 + overhang)
        if name == "bus_stop":
            y = KERB_Y + .35 + overhang                    # shelter stands on the pavement at the kerb
        o = m.place("buildings", name, (x - lo.x, y, PAVE_Z), ground=False)
        out[name] = o
        x += (hi.x - lo.x) + .15
    return out


def hang_pair(m, s, name, parent, pair, span, key_l, key_r):
    """Hang a two-point asset (origin = left point) on a {left,right} anchor
    pair and assert the asset's right point lands on the right anchor."""
    L, R = m.world(parent, pair["left"]), m.world(parent, pair["right"])
    d = R - L
    rot = math.atan2(d.y, d.x)
    o = m.place(s, name, L, rot_z=rot, ground=False)
    a = m.anchors(s, name)
    got = m.world(o, a[key_r])
    err = (got - R).length
    assert err < mounts.SPAN_TOL, "%s on %s: right end off by %.3f m" % (name, parent.name, err)
    print("ANCHOR %-16s on %-12s %s->%s span %.3f m err %.4f" % (name, parent.name, key_l, key_r, d.length, err))
    return o


def dress_noodle(m, shop):
    a = m.anchors("buildings", "noodle_shop")
    hang_pair(m, "street", "lantern_string", shop, a["lantern_string_hooks"], mounts.LANTERN_STRING_SPAN,
              "hook_left", "hook_right")
    for h in a["lantern_hooks"]:
        m.place("street", "lantern", m.world(shop, h), ground=False)
    ct = a["counter_top"]
    top = m.world(shop, ct["pos"])
    m.place("street", "steamer_stack", top + Vector((1.2, 0, 0)))
    m.place("props", "bowl_noodles", top + Vector((.2, -.05, 0)))
    m.place("props", "bowl_noodles", top + Vector((-.25, -.05, 0)))
    front = m.world(shop, [0, 0, 0])
    m.place("street", "sign_aboard", front + Vector((2.9, -1.35, 0)), rot_z=math.radians(-15))
    tbl = m.place("street", "table_folding", front + Vector((-2.65, -1.25, 0)))
    for sp in m.anchors("street", "table_folding")["seats"][:2]:
        m.place("street", "stool_plastic", m.world(tbl, sp))
    m.place("props", "bowl_soup", m.world(tbl, m.anchors("street", "table_folding")["top"]["pos"]))
    m.place("characters", "cook", m.world(shop, a["npc_stand"]["pos"]), facing_rot(a["npc_stand"]["facing"]))
    m.place("characters", "player", m.world(shop, a["player_stand"]["pos"]),
            facing_rot(a["player_stand"]["facing"]))
    m.place("characters", "cat", front + Vector((3.15, -.55, 0)), rot_z=math.radians(-60))


def dress_fruit(m, stall):
    a = m.anchors("buildings", "fruit_stall")
    crates = ("crate_apples", "crate_oranges", "crate_bananas")
    for slot, crate in zip(a["crate_slots"], crates):
        e = MAN[("props", crate)]
        w, d = e["size_m"][0], e["size_m"][2]
        nx, nd = int(slot["size"][0] // w), int(slot["size"][1] // d)
        assert nx >= 1 and nd >= 1, "slot %s too small for %s" % (slot["size"], crate)
        t = math.radians(slot["tilt_deg"])
        base = m.world(stall, slot["pos"])
        for i in range(nx):
            for j in range(nd):
                u = (i - (nx - 1) / 2) * (w + .02)
                v = (j - (nd - 1) / 2) * (d + .03)       # along the slope, + = up/back
                p = base + Vector((u, v * math.cos(t), v * math.sin(t)))
                m.place("props", crate, p, rot=(t, 0, 0), ground=False)
        print("ANCHOR crate_slot %s x%d (%dx%d) tilt %.0f" % (crate, nx * nd, nx, nd, slot["tilt_deg"]))
    hook = m.world(stall, a["scale_hook"])
    m.place("characters", "hanging_scale", hook, ground=False)
    print("ANCHOR hanging_scale on scale_hook at %.2f,%.2f,%.2f" % tuple(hook))
    m.place("characters", "fruit_seller", m.world(stall, a["npc_stand"]["pos"]), facing_rot(a["npc_stand"]["facing"]))


def dress_rented(m, bld):
    for pair in m.anchors("buildings", "rented_room")["laundry_pole_mounts"]:
        hang_pair(m, "street", "laundry_pole_bar", bld, pair, mounts.LAUNDRY_POLE_SPAN, "rest_left", "rest_right")
    a = m.anchors("buildings", "rented_room")
    m.place("characters", "landlord", m.world(bld, a["npc_stand"]["pos"]), facing_rot(a["npc_stand"]["facing"]))


def dress_tea(m, bld):
    for h in m.anchors("buildings", "tea_house")["lantern_hooks"]:
        m.place("street", "lantern", m.world(bld, h), ground=False)
    front = m.world(bld, [0, 0, 0])
    m.place("street", "planter_pot", front + Vector((-3.0, -.5, 0)))
    m.place("street", "water_urn", front + Vector((2.9, -.45, 0)))


def dress_warehouse(m, wh):
    a = m.anchors("buildings", "warehouse")
    dock = m.world(wh, a["npc_stand"]["pos"])               # on the dock top
    assert abs(dock.z - (wh.location.z + a["dock_top_z"])) < 1e-3
    m.place("props", "box_stack", dock + Vector((1.9, .1, 0)), rot_z=math.radians(8))
    m.place("props", "hand_truck", dock + Vector((1.0, -.25, 0)), rot_z=math.radians(-25))
    m.place("props", "box_medium", dock + Vector((2.8, -.1, 0)))
    m.place("characters", "warehouse_boss", dock, facing_rot(a["npc_stand"]["facing"]))


def dress_bus_stop(m, bs):
    a = m.anchors("buildings", "bus_stop")
    m.place("characters", "old_wang", m.world(bs, a["npc_stand"]["pos"]), facing_rot(a["npc_stand"]["facing"]))
    front = m.world(bs, [0, 0, 0])
    for dx, dy, r in ((-.6, -.9, 30), (-.25, -1.1, -40), (.35, -.8, 100)):
        m.place("characters", "pigeon", front + Vector((dx, dy, 0)), rot_z=math.radians(r))


def dress_supermarket(m, sm):
    a = m.anchors("buildings", "supermarket")
    m.place("characters", "clerk", m.world(sm, a["npc_stand"]["pos"]), facing_rot(a["npc_stand"]["facing"]))
    front = m.world(sm, [0, 0, 0])
    m.place("characters", "customer_b", front + Vector((-1.6, -1.2, 0)), rot_z=-PI / 2)    # walking toward -X
    m.place("characters", "shopping_trolley", front + Vector((-1.25, -1.05, .9)), rot_z=-PI / 2, ground=False)


def near_side(m, noodle_x):
    """Near pavement (items rotated to face the road)."""
    y_mid, y_kerb = -3.0, -2.45
    # filler buildings at the far-left end so they don't hide the noodle block
    x = -27.8
    for name in ("filler_shutter", "filler_tailor"):
        mo = m.master("buildings", name)
        lo, hi = B.bbox(mo)
        m.place("buildings", name, (x + hi.x, -FACADE_Y, PAVE_Z), rot_z=PI, ground=False)
        x += hi.x - lo.x + .15
    z = PAVE_Z
    for dx in (-9.0, 3.5, 13.0):
        m.place("street", "tree_street", (noodle_x + dx, y_mid - .3, z))
    for dx in (-5.5, 7.5, 18.0):
        m.place("street", "street_lamp", (noodle_x + dx, y_kerb, z), rot_z=PI)
    poles = [m.place("street", "power_pole", (noodle_x + dx, y_kerb - .1, z)) for dx in (-17.0, -4.0)]
    wires(m, poles)
    m.place("street", "bin_public", (noodle_x - 2.0, y_mid - .6, z), rot_z=PI)
    for dx in (-2.2, -1.4, -0.6):
        m.place("street", "bollard", (noodle_x + dx, y_kerb, z))
    m.place("street", "scooter_delivery", (noodle_x + 1.5, y_mid + .1, z), rot_z=PI)
    m.place("street", "bicycle", (noodle_x + 5.0, y_mid, z), rot_z=PI)
    m.place("characters", "courier", (noodle_x + 1.6, y_mid - .6, z), rot_z=PI * .8)
    for dx in (-3.6, -3.0, 9.4):
        m.place("street", "planter_pot", (noodle_x + dx, y_mid - .6, z))
    m.place("characters", "kid", (noodle_x + 10.5, y_mid + .2, z), rot_z=PI / 2)           # walking toward +X
    m.place("characters", "customer_a_khaki", (noodle_x - 7.0, y_mid, z), rot_z=PI / 2)


def wires(m, poles):
    """Cables between two power poles, end to end on matching wire_ends."""
    ends = m.anchors("street", "power_pole")["wire_ends"]
    a, b = poles
    parts = []
    for e in ends:
        if e[0] < 0:
            continue
        p0 = m.world(a, e)
        p1 = m.world(b, [-e[0], e[1], e[2]])
        n = 10
        pts = [p0.lerp(p1, i / n) - Vector((0, 0, .6 * 4 * (i / n) * (1 - i / n))) for i in range(n + 1)]
        parts.append(B.tube([tuple(p) for p in pts], .015, segments=4, material="charcoal", name="wire"))
    w = B.join(parts, "power_wires")
    m.placed.append((w, "mockup", "power_wires", False))


# --------------------------------------------------------------------------
# checks
# --------------------------------------------------------------------------
def ground_check(m):
    """Every ground-placed instance: hide it, cast rays down from above its
    base at 5 footprint points and require support within 3 cm (catches both
    floating and sunk placements; coplanar supports such as a dock top count)."""
    scene = bpy.context.scene
    bad, n = [], 0
    for o, s, name, ground in m.placed:
        if not ground:
            continue
        n += 1
        lo, hi = B.bbox(o)
        base = o.location.z if MAN.get((s, name), {}).get("origin", "feet") == "feet" else lo.z
        o.hide_viewport = True
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        best = None
        for fx, fy in ((.5, .5), (.3, .5), (.7, .5), (.5, .3), (.5, .7)):
            org = Vector((lo.x + (hi.x - lo.x) * fx, lo.y + (hi.y - lo.y) * fy, base + .4))
            hit, loc, _nrm, _i, _ob, _mx = scene.ray_cast(dg, org, Vector((0, 0, -1)), distance=2.0)
            if hit:
                gap = base - loc.z
                best = gap if best is None or abs(gap) < abs(best) else best
        o.hide_viewport = False
        if best is None or abs(best) > .03:
            bad.append("%s/%s at %.2f,%.2f base %.3f gap %s" % (s, name, o.location.x, o.location.y, base,
                                                               "none" if best is None else "%.3f" % best))
    bpy.context.view_layer.update()
    print("GROUNDCHECK %d grounded instances, %d floating/sunk" % (n, len(bad)))
    for b in bad:
        print("  FLOAT " + b)
    assert not bad, "floating/sunk instances: %s" % bad


# --------------------------------------------------------------------------
# camera + render
# --------------------------------------------------------------------------
def setup_camera(scene):
    away = Vector((-math.sin(sheet.AZIMUTH), math.cos(sheet.AZIMUTH), 0))
    view = away * math.cos(sheet.ELEVATION) - Vector((0, 0, math.sin(sheet.ELEVATION)))
    cd = bpy.data.cameras.new("mockup_cam")
    cd.type = "ORTHO"
    cd.clip_end = 2000
    cam = bpy.data.objects.new("mockup_cam", cd)
    scene.collection.objects.link(cam)
    cam.rotation_euler = view.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    return cam, view


def frame(cam, view, objs, margin=1.06, target=None):
    """Point the ortho camera at the given objects' vertices (fit + centre)."""
    cam.location = (target or Vector((0, 0, 0))) - view * 200
    bpy.context.view_layer.update()
    inv = cam.matrix_world.inverted()
    pts = []
    for o in objs:
        M = o.matrix_world
        vs = o.data.vertices
        step = max(1, len(vs) // 300)
        pts += [inv @ (M @ vs[k].co) for k in range(0, len(vs), step)]
    xs, ys = [p.x for p in pts], [p.y for p in pts]
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    q = cam.matrix_world.to_quaternion()
    cam.location += (q @ Vector((1, 0, 0))) * ((max(xs) + min(xs)) / 2) + (q @ Vector((0, 1, 0))) * ((max(ys) + min(ys)) / 2)
    cam.data.ortho_scale = max(w, h * RES[0] / RES[1]) * margin


def render(scene, path):
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("RENDER %s" % path)


def export_scene(m, path):
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o, *_ in m.placed:
        o.select_set(True)
    bpy.context.view_layer.objects.active = m.placed[0][0]
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=False,
                              export_yup=True, export_animations=False, export_cameras=False,
                              export_lights=False, export_skins=False, export_morph=False,
                              export_texcoords=False, export_normals=True, export_materials="EXPORT",
                              export_extras=False, export_attributes=False)
    print("EXPORT street_mockup instances=%d unique_assets=%d -> %s" % (len(m.placed), len(m.masters), path))


def build():
    m = Mockup()
    x_start, half = lay_street(m)
    row = lay_far_row(m, x_start + .3)
    dress_tea(m, row["tea_house"])
    dress_rented(m, row["rented_room"])
    dress_noodle(m, row["noodle_shop"])
    dress_fruit(m, row["fruit_stall"])
    dress_supermarket(m, row["supermarket"])
    dress_bus_stop(m, row["bus_stop"])
    dress_warehouse(m, row["warehouse"])
    near_side(m, row["noodle_shop"].location.x)
    ground_check(m)
    return m, row


def main():
    m, row = build()
    scene = sheet._setup_scene(OUT_PNG, RES)
    scene.display.shading.background_color = BG
    scene.world.color = BG
    scene.display.shading.shadow_intensity = 0.3
    cam, view = setup_camera(scene)
    # framed shot: the noodle-shop block (noodle shop + its neighbours' edges + pavement in front)
    nx = row["noodle_shop"].location.x
    block = [o for o, s, n, _g in m.placed
             if n in ("noodle_shop", "fruit_stall") or (abs(o.location.x - nx) < 6.5 and abs(o.location.y) < 4.5
                                                        and n not in ("road_straight", "road_crossing",
                                                                      "pavement_straight", "forecourt",
                                                                      "tree_street", "power_pole", "power_wires"))]
    frame(cam, view, block, margin=1.04)
    render(scene, OUT_PNG)
    everything = [o for o, s, n, _g in m.placed if n not in ("forecourt", "road_ext", "pave_ext")]
    frame(cam, view, everything, margin=1.02)
    render(scene, OUT_WIDE)
    export_scene(m, OUT_GLB)
    print("MOCKUP instances=%d assets=%d" % (len(m.placed), len(m.masters)))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback
        traceback.print_exc()
        sys.exit(1)
