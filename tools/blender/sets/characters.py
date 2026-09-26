#!/usr/bin/env python3
"""Characters set: 12 faceless humans, 3 recolours, 3 pets, 11 held props.

    blender -b --python tools/blender/sets/characters.py

Outputs assets/characters/*.glb, manifest.json (glTF axes) + sheet.png. Idempotent.

Everything is parametrised: a character is one row in SPEC (build, height,
colours, sleeve type, hair, headwear, outfit features); ``make_human`` turns a
row into parts using shared functions (Body proportions, arm/leg/torso, hair
styles, HEADWEAR builders, OUTFIT builders). Front = -Y. Arms are built in
T-pose along X and then lowered about the shoulder into the relaxed rest pose
(``rest_arms``, ~15 deg from the body, wider when the torso/outfit needs it).

Rig stage (lib/rig.py): every human gets the shared st-human-v1 skeleton
(Mixamo names, Left = +X = character's left) built from the Body joint points,
rigid-bound (each vertex 1.0 on one bone) and baked clips idle / walk / talk /
carry_idle / carry_walk; pets get Root/Spine/Head/Tail + idle.

Height convention: ``height`` is the top of the (bare) head. Headwear sits on
top and is not counted, so every human shares one skeleton proportion set
(elderly stoop and kid proportions excepted).
"""
import math
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from mathutils import Euler, Matrix, Vector  # noqa: E402

from lib import build as B  # noqa: E402
from lib import export, manifest as M, rig, sheet  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
OUT = os.path.join(ROOT, "assets", "characters")
PI = math.pi
FRONT = -PI / 2          # loft theta pointing at -Y (the character's front)

# Faceless rule: any part whose name contains one of these tokens fails the build.
FORBIDDEN_FEATURES = {"eye", "eyes", "nose", "mouth", "lip", "lips", "brow", "eyebrow",
                      "beard", "moustache", "face", "ear", "ears", "pupil", "teeth"}
# Parts allowed to touch the head of a human. Pets additionally allow "ear".
HEAD_ATTACHMENT_ROLES = {"hair", "headwear"}


# ==========================================================================
# proportions
# ==========================================================================
BUILDS = {
    #            hip   waist chest shoulder depth limb
    "thin":    dict(hip=.92, waist=.86, chest=.88, shoulder=.90, depth=.88, limb=.86),
    "average": dict(hip=1.0, waist=1.0, chest=1.0, shoulder=1.0, depth=1.0, limb=1.0),
    "stocky":  dict(hip=1.14, waist=1.24, chest=1.2, shoulder=1.12, depth=1.26, limb=1.16),
    "broad":   dict(hip=1.04, waist=1.08, chest=1.26, shoulder=1.36, depth=1.16, limb=1.2),
    "plump":   dict(hip=1.3, waist=1.42, chest=1.24, shoulder=1.06, depth=1.44, limb=1.12),
}

# Reference proportions in metres. torso rings: (z, rx, ry, width key).
ADULT = dict(
    h=1.70, head=(.215, .205, .22), head_z=1.48, neck_r=.062, neck=(1.20, 1.36),
    torso=[(.585, .09, .07, "hip"), (.62, .158, .118, "hip"), (.68, .17, .125, "hip"),
           (.83, .162, .124, "waist"), (.98, .178, .13, "chest"), (1.10, .193, .125, "shoulder"),
           (1.18, .176, .108, "shoulder"), (1.235, .115, .082, "neck"), (1.255, .065, .058, "neck")],
    sh_x=.15, sh_z=1.115, arm_len=.40, arm_r=(.07, .057), hand=(.12, .04, .062),
    leg_x=.095, leg=[(.70, .093), (.37, .079), (.11, .069)], shoe=(.135, .245, .1),
)
KID = dict(
    h=1.10, head=(.168, .16, .17), head_z=.93, neck_r=.047, neck=(.70, .80),
    torso=[(.35, .065, .05, "hip"), (.375, .115, .088, "hip"), (.42, .126, .094, "hip"),
           (.52, .126, .097, "waist"), (.62, .132, .1, "chest"), (.68, .138, .094, "shoulder"),
           (.72, .122, .082, "shoulder"), (.75, .082, .062, "neck"), (.765, .048, .044, "neck")],
    sh_x=.108, sh_z=.672, arm_len=.25, arm_r=(.047, .04), hand=(.1, .03, .046),
    leg_x=.062, leg=[(.44, .062), (.24, .053), (.075, .047)], shoe=(.1, .175, .075),
)


class Body:
    """Anchor points + torso profile for one character (height, build, kid)."""

    TORSO_EXP = 2.6

    def __init__(self, height, build, kid=False):
        P = KID if kid else ADULT
        b = BUILDS[build]
        k = height / P["h"]
        self.k, self.b, self.kid, self.height = k, b, kid, height
        self.head_r = tuple(v * k for v in P["head"])
        self.R = self.head_r[2]
        self.head_c = Vector((0, 0, P["head_z"] * k))
        self.neck_r = P["neck_r"] * k * (b["limb"] ** .5)
        self.neck = tuple(v * k for v in P["neck"])
        nk = b["shoulder"] ** .5
        self.ctrl = [(z * k, rx * k * (nk if key == "neck" else b[key]), ry * k * (b["depth"] ** (.6 if key == "neck" else 1)))
                     for z, rx, ry, key in P["torso"]]
        self.dense = B.catmull(self.ctrl, 5)
        self.hip_full = self.ctrl[2]
        self.sh = Vector((P["sh_x"] * k * b["shoulder"], 0, P["sh_z"] * k))
        self.arm_len = P["arm_len"] * k
        self.arm_r = tuple(v * k * b["limb"] for v in P["arm_r"])
        self.hand = tuple(v * k * (b["limb"] ** .5) for v in P["hand"])
        self.leg_x = P["leg_x"] * k * b["hip"]
        self.leg = [(z * k, r * k * b["limb"]) for z, r in P["leg"]]
        self.shoe = tuple(v * k * (b["limb"] ** .4) for v in P["shoe"])

    # -- torso surface ------------------------------------------------------
    def profile(self, z):
        """(rx, ry) of the torso at height z; below the full-hip ring it stays at
        hip width (so aprons/coats hang straight), above the top it clamps."""
        if z <= self.hip_full[0]:
            return self.hip_full[1], self.hip_full[2]
        pts = self.dense
        for (z0, x0, y0), (z1, x1, y1) in zip(pts, pts[1:]):
            if z0 <= z <= z1:
                t = (z - z0) / max(z1 - z0, 1e-9)
                return x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        return pts[-1][1], pts[-1][2]

    def rings(self, z0, z1, inflate=0.0, n=6, flare=None):
        """Loft rings following the torso between z0 (bottom) and z1 (top),
        pushed out by ``inflate``; ``flare(z) -> extra radius`` for skirts."""
        out = []
        for i in range(n + 1):
            z = z0 + (z1 - z0) * i / n
            rx, ry = self.profile(z)
            e = inflate + (flare(z) if flare else 0.0)
            out.append((z, rx + e, ry + e))
        return out

    def surface(self, theta, z, inflate=0.0):
        """Point on the torso surface at angle theta (FRONT = -pi/2), height z."""
        rx, ry = self.profile(z)
        x, y = B._superellipse(theta, rx + inflate, ry + inflate, self.TORSO_EXP)
        return Vector((x, y, z))

    @property
    def torso_bottom(self):
        return self.ctrl[0][0]

    @property
    def torso_top(self):
        return self.ctrl[-1][0]


# ==========================================================================
# figure bookkeeping (faceless + tri checks)
# ==========================================================================
class Figure:
    """Collects parts with a role so the faceless rule can be verified."""

    def __init__(self, name, body=None):
        self.name, self.body, self.parts = name, body, []

    def add(self, obj, role):
        obj["role"] = role
        self.parts.append(obj)
        return obj

    def add_all(self, objs, role):
        for o in objs:
            self.add(o, role)
        return objs

    def by_role(self, role):
        return [p for p in self.parts if p["role"] == role]


def tokens(name):
    return set(name.lower().replace(".", "_").replace("-", "_").split("_"))


def assert_faceless(fig, allow_ears=False):
    """Hard no-face rule. Exactly one head part, a single smooth closed shell;
    nothing named like a facial feature; only hair/headwear (and animal ears
    for pets) attached to the head."""
    heads = fig.by_role("head")
    assert len(heads) == 1, "%s: expected exactly one head part, got %d" % (fig.name, len(heads))
    forbidden = FORBIDDEN_FEATURES - ({"ear", "ears"} if allow_ears else set())
    bad = [p.name for p in fig.parts if tokens(p.name) & forbidden]
    assert not bad, "%s: facial-feature parts present: %s" % (fig.name, bad)
    allowed = HEAD_ATTACHMENT_ROLES | ({"animal_ear"} if allow_ears else set())
    attached = sorted({p["role"] for p in fig.parts if p["role"] in allowed})
    head = heads[0]
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(head.data)
    islands = _islands(bm)
    boundary = sum(1 for e in bm.edges if e.is_boundary)
    bm.free()
    assert islands == 1 and boundary == 0, "%s: head is not one closed smooth shell (islands=%d open=%d)" % (
        fig.name, islands, boundary)
    print("FACELESS OK %s head_parts=1 head_islands=1 open_edges=0 head_attachments=%s forbidden_features=0"
          % (fig.name, attached))


def _islands(bm):
    bm.verts.index_update()
    seen, count = set(), 0
    for v in bm.verts:
        if v.index in seen:
            continue
        count += 1
        stack = [v]
        while stack:
            x = stack.pop()
            if x.index in seen:
                continue
            seen.add(x.index)
            stack.extend(e.other_vert(x) for e in x.link_edges)
    return count


# ==========================================================================
# body parts (shared by all humans)
# ==========================================================================
def head(fig, body, skin):
    """The blank head: one smooth closed superellipsoid. No features, ever."""
    rx, ry, rz = body.head_r
    fig.add(B.sphere((rx, ry, rz), segments=16, rings=10, exponent=2.25, material=skin,
                     loc=body.head_c, name="head_blank"), "head")
    fig.add(B.cylinder(body.neck_r, body.neck[1] - body.neck[0], verts=10, material=skin,
                       loc=(0, 0, sum(body.neck) / 2), name="neck"), "body")


def torso(fig, body, colour, quilt=0):
    """Tapered chunky torso lofted from the build profile. ``quilt`` = number of
    padded-jacket puffs (0 = plain)."""
    rings = B.catmull(body.ctrl, 2) if quilt else list(body.ctrl)
    if quilt:
        # padded-jacket puffs baked into the ring radii (reads in silhouette)
        z0, z1 = body.ctrl[1][0], body.ctrl[-3][0]
        out = []
        for z, rx, ry in rings:
            u = (z - z0) / (z1 - z0)
            f = 1 + .07 * math.sin(PI * u * quilt) ** 2 if 0 <= u <= 1 else 1.0
            out.append((z, rx * f, ry * f))
        rings = out
    fig.add(B.loft(rings, segments=16, exponent=Body.TORSO_EXP, material=colour, name="torso"), "body")


def arm(fig, body, sleeve_colour, skin, sleeve="long", cuff=None, guard=None, quilt=0):
    """Right arm in T-pose along +X (mirrored for the left). sleeve: long | short
    | rolled | none. cuff: colour of a cuff band. guard: sleeve-guard colour."""
    L = body.arm_len
    r0, r1 = body.arm_r

    def r(u):
        return r0 + (r1 - r0) * max(0.0, min(1.0, u / L))

    parts = []
    rot = (0, PI / 2, 0)                     # local +Z -> world +X
    loc = body.sh
    us = {"long": L * .94, "short": L * .36, "rolled": L * .5, "none": 0.0}[sleeve]
    if us > 0:
        rings = [(-.03 * body.k, 0, 0), (-.02 * body.k, r0 * .8, r0 * .8), (0, r0, r0)]
        if quilt:
            for i in range(1, quilt * 2 + 1):
                u = us * i / (quilt * 2)
                f = 1.1 if i % 2 else .98
                rings.append((u, r(u) * f, r(u) * f))
        else:
            rings.append((us * .5, r(us * .5), r(us * .5)))
        end = r(us) * (1.06 if sleeve in ("short",) else 1.0)
        rings.append((us - .002, end, end))
        if sleeve == "rolled":
            rings[-1] = (us - .045 * body.k, end, end)
            rings += [(us - .04 * body.k, end * 1.2, end * 1.2), (us, end * 1.2, end * 1.2)]
        parts.append(B.loft(rings, segments=10, material=sleeve_colour, rot=rot, loc=loc, name="sleeve"))
        if cuff and sleeve == "long":
            parts.append(B.loft([(us - .045 * body.k, r(us) * 1.08, r(us) * 1.08), (us + .004, r(us) * 1.08, r(us) * 1.08)],
                                segments=10, material=cuff, rot=rot, loc=loc, name="cuff"))
    eu = elbow_u(body, sleeve)
    if us < L:
        a = max(us - .04 * body.k, 0)
        rr = [(a, r(a) * .84, r(a) * .84), (L + .01 * body.k, r(L) * .84, r(L) * .84)]
        if a + .02 * body.k < eu < L:           # joint ring so the elbow bends in place
            rr.insert(1, (eu, r(eu) * .84, r(eu) * .84))
        parts.append(B.loft(rr, segments=8, material=skin, rot=rot, loc=loc, name="forearm"))
    if guard:
        a, b2 = L * .5, L * .93
        g = [(a, r(a) + .012 * body.k), (a + .012 * body.k, r(a) + .02 * body.k), (a + .025 * body.k, r(a) + .008 * body.k),
             (b2 - .025 * body.k, r(b2) + .008 * body.k), (b2 - .012 * body.k, r(b2) + .02 * body.k), (b2, r(b2) + .012 * body.k)]
        parts.append(B.loft([(u, q, q) for u, q in g], segments=8, material=guard, rot=rot, loc=loc,
                            name="sleeve_guard"))
    # mitten hand: flat (palm down), wide front-back, rounded tip
    hl, ht, hw = body.hand
    h0 = L - .01 * body.k
    hand = [(h0, ht * .75, hw * .75), (h0 + hl * .3, ht, hw), (h0 + hl * .7, ht * .95, hw * .95),
            (h0 + hl * .92, ht * .7, hw * .7), (h0 + hl, 0, 0)]
    parts.append(B.loft(hand, segments=8, material=skin, rot=rot, loc=loc, name="hand_mitten"))
    base = loc + Vector((h0 + hl * .32, -hw * .55, 0))
    parts.append(B.capsule(ht * .58, hl * .45, segments=6, cap_rings=2, material=skin,
                           loc=base, rot=B.aim((.55, -1, .15)), name="hand_thumb"))
    fig.elbow_u = eu
    for p in parts:
        fig.add(p, "body")
        m = fig.add(B.mirror_x(p, name=p.name + "_l"), "body")
        p["limb"], p["side"] = "arm", 1          # +X = the character's LEFT (faces -Y)
        m["limb"], m["side"] = "arm", -1


def elbow_u(body, sleeve):
    """Distance of the elbow joint from the shoulder along the arm (sits on a
    sleeve/forearm ring so rigid skinning bends at a ring)."""
    return body.arm_len * {"long": .47, "short": .5, "rolled": .52, "none": .5}[sleeve]


def leg(fig, body, colour, shoe, style="straight", boot=None):
    """Right leg + shoe (mirrored). style: straight | wide. boot: shaft colour."""
    (zt, rt), (zk, rk), (za, ra) = body.leg
    sh_l, sh_w, sh_h = body.shoe[1], body.shoe[0], body.shoe[2]
    zb = sh_h * .7
    if style == "wide":
        rings = [(zt + .04 * body.k, 0, 0), (zt + .03 * body.k, rt * .8, rt * .8), (zt, rt * 1.05, rt * 1.05),
                 (zk, rt * 1.02, rt * 1.02), (zb + .02 * body.k, rt * 1.1, rt * 1.1), (zb, rt * 1.1, rt * 1.1)]
    else:
        rings = [(zt + .04 * body.k, 0, 0), (zt + .03 * body.k, rt * .8, rt * .8), (zt, rt, rt), (zk, rk, rk),
                 (za, ra, ra), (zb, ra * .98, ra * .98)]
    parts = [B.loft(rings, segments=9, material=colour, loc=(body.leg_x, 0, 0), name="leg")]
    parts.append(B.rounded_box((sh_w, sh_l, sh_h), radius=sh_h * .4, segments=1, material=shoe, smooth_angle=math.radians(50),
                               loc=(body.leg_x, -sh_l * .16, sh_h / 2), name="shoe"))
    if boot:
        bz = zk * .72
        parts.append(B.loft([(sh_h * .6, ra * 1.3, ra * 1.3), (bz - .015 * body.k, ra * 1.32, ra * 1.32),
                             (bz, ra * 1.42, ra * 1.42), (bz + .012 * body.k, ra * 1.42, ra * 1.42)],
                            segments=8, material=boot, loc=(body.leg_x, 0, 0), name="boot_shaft"))
    for p in parts:
        fig.add(p, "body")
        m = fig.add(B.mirror_x(p, name=p.name + "_l"), "body")
        p["limb"], p["side"] = "leg", 1
        m["limb"], m["side"] = "leg", -1


# ==========================================================================
# rest pose + rig (rigid weights, joint points from Body)
# ==========================================================================
REST_ARM_MIN = math.radians(15)          # relaxed A: arms ~15 deg off the body
REST_ARM_MAX = math.radians(38)
REST_ARM_OUT = .10                        # max outward shoulder shift (x k) before the angle grows
REST_ARM_SINK = .012                      # arm may rest this far (x k) into belly/outfit (chunky builds)


def _world_verts(p):
    M = p.matrix_basis
    return [M @ v.co for v in p.data.vertices]


def _arm_rot(body, side, a, dx=0.0):
    """Matrix lowering the T-pose arm on ``side`` (+1 = +X) to hang ``a`` rad off
    vertical about the shoulder point, then shifting it ``dx`` outward."""
    piv = Vector((side * body.sh.x, 0, body.sh.z))
    return (Matrix.Translation(piv + Vector((side * dx, 0, 0))) @ Matrix.Rotation(side * (PI / 2 - a), 4, "Y")
            @ Matrix.Translation(-piv))


def shoulder(body, side, dx):
    """Shoulder joint (bone head) of the lowered arm."""
    return Vector((side * (body.sh.x + dx), 0, body.sh.z))


def rest_arms(fig, body):
    """Lower both T-pose arms to the relaxed-A bind pose: hang 15 deg off
    vertical, shifting the shoulder joint outward (<= REST_ARM_OUT) until the
    arm below the shoulder cap clears torso, outfit and legs by 6 mm (binned
    side-profile test); only if that is not enough does the angle grow.
    Returns {side: (angle_rad, dx_m)}."""
    k = body.k
    zmax = body.sh.z - .08 * k
    zb, yb = .02 * k, .03 * k
    others = [p for p in fig.parts if p.get("limb") != "arm" and p["role"] in ("body", "outfit")]
    angles = {}
    for side in (1, -1):
        prof = {}
        for p in others:
            for q in _world_verts(p):
                if side * q.x > 0 and q.z < zmax + zb:
                    key = (round(q.z / zb), round(q.y / yb))
                    prof[key] = max(prof.get(key, -1.0), side * q.x)
        arms = [p for p in fig.parts if p.get("limb") == "arm" and p["side"] == side]
        pts = [q for p in arms for q in _world_verts(p)]
        def clear(a, dx):
            M = _arm_rot(body, side, a, dx)
            for q in pts:
                r = M @ q
                if r.z > zmax:
                    continue
                zi, yi = round(r.z / zb), round(r.y / yb)
                m = max(prof.get((zi + i, yi + j), -1.0) for i in (-1, 0, 1) for j in (-1, 0, 1))
                if side * r.x < m - REST_ARM_SINK * k:
                    return False
            return True
        steps = [REST_ARM_MIN + math.radians(i) for i in range(int(math.degrees(REST_ARM_MAX - REST_ARM_MIN)) + 1)]
        a, dx = next(((a, i * .005 * k) for a in steps for i in range(int(REST_ARM_OUT / .005) + 1)
                      if clear(a, i * .005 * k)), (REST_ARM_MAX, REST_ARM_OUT * k))
        angles[side] = (a, dx)
    both = max(angles.values())                    # symmetric pose: the side needing more wins
    for side in (1, -1):
        angles[side] = both
        M = _arm_rot(body, side, *both)
        for p in fig.parts:
            if p.get("limb") == "arm" and p["side"] == side:
                p.matrix_basis = M @ p.matrix_basis
    return angles


WHOLE_PART_PREFIXES = ("backpack", "tote_bag", "belt", "coat_button", "jacket_button", "epaulette", "name_tag",
                       "polo", "cardigan_pocket", "uniform_tie_knot", "collar", "hood_down", "trim_")


def _side_name(side):
    return "Left" if side > 0 else "Right"


def human_levels(body):
    """Heights of the torso joints (pre-stoop, build space)."""
    k = body.k
    return dict(hips=body.leg[0][0], spine=body.ctrl[3][0] - .02 * k, chest=body.ctrl[4][0] - .04 * k,
                neck=body.neck[0], head=body.head_c.z - .82 * body.R, top=body.head_c.z + body.R)


def human_labels(fig, body, angles):
    """Rigid weights: one bone name per vertex, in fig.parts / join order.
    Head, hair, headwear -> Head; limbs split at the elbow / knee / ankle
    rings; torso + outfit by height (small trim pieces and backpacks whole by
    their centre)."""
    lv = human_levels(body)
    (zt, _), (zk, _), (za, _) = body.leg
    eps = 1e-4 * body.k

    def torso_bone(z):
        return "Chest" if z >= lv["chest"] else "Spine" if z >= lv["spine"] else "Hips"
    labels = []
    for p in fig.parts:
        vs = _world_verts(p)
        role, limb = p["role"], p.get("limb")
        nm = p.name.lower()
        if role in ("head", "hair") or (role == "headwear" and not nm.startswith("hood_down")):
            labels += ["Head"] * len(vs)
        elif limb == "arm":
            S = _side_name(p["side"])
            if nm.startswith("hand_"):
                labels += [S + "Hand"] * len(vs)
                continue
            a, dx = angles[p["side"]]
            piv = shoulder(body, p["side"], dx)
            d = Vector((p["side"] * math.sin(a), 0, -math.cos(a)))
            labels += [S + ("Arm" if (q - piv).dot(d) < fig.elbow_u - eps else "ForeArm") for q in vs]
        elif limb == "leg":
            S = _side_name(p["side"])
            labels += [S + ("UpLeg" if q.z >= zk - eps else "Leg" if q.z >= za - eps else "Foot") for q in vs]
        elif nm == "neck":
            labels += ["Neck"] * len(vs)
        elif nm.startswith(WHOLE_PART_PREFIXES):
            zc = sum(q.z for q in vs) / len(vs)
            labels += [torso_bone(zc)] * len(vs)
        else:
            labels += [torso_bone(q.z) for q in vs]
    return labels


def human_joints(body, angles, elbow):
    """Named joint points (pre-stoop build space). Values are (point, rigid_arm_side|None)."""
    k, lv = body.k, human_levels(body)
    J = {n: (Vector((0, 0, lv[n])), None) for n in ("hips", "spine", "chest", "neck", "head", "top")}
    (zt, _), (zk, _), (za, _) = body.leg
    hl, ht, hw = body.hand
    h0 = body.arm_len - .01 * k
    for side in (1, -1):
        S = _side_name(side)
        a, dx = angles[side]
        sh = shoulder(body, side, dx)
        d = Vector((side * math.sin(a), 0, -math.cos(a)))
        palm = Vector((-side * math.cos(a), 0, -math.sin(a)))
        J[S + "_clav"] = (Vector((side * .035 * k, 0, body.sh.z)), side)
        J[S + "_sh"] = (sh, side)
        J[S + "_elbow"] = (sh + d * elbow, side)
        J[S + "_wrist"] = (sh + d * h0, side)
        J[S + "_tip"] = (sh + d * (h0 + hl), side)
        J[S + "_grip"] = (sh + d * (h0 + .45 * hl) + palm * ht * .7, side)
        x = side * body.leg_x
        J[S + "_hip"] = (Vector((x, 0, zt)), None)
        J[S + "_knee"] = (Vector((x, 0, zk)), None)
        J[S + "_ankle"] = (Vector((x, 0, za)), None)
        J[S + "_toe"] = (Vector((x, -body.shoe[1] * .55, body.shoe[2] * .35)), None)
    return J


def human_bone_specs(J, k):
    """st-human-v1 bone list from final joint points (Blender axes)."""
    up = Vector((0, 0, 1))
    B_ = [("Hips", "hips", "spine"), ("Spine", "spine", "chest"), ("Chest", "chest", "neck"),
          ("Neck", "neck", "head"), ("Head", "head", "top")]
    for S in ("Left", "Right"):
        B_ += [(S + "Shoulder", S + "_clav", S + "_sh"), (S + "Arm", S + "_sh", S + "_elbow"),
               (S + "ForeArm", S + "_elbow", S + "_wrist"), (S + "Hand", S + "_wrist", S + "_tip")]
    for S in ("Left", "Right"):
        B_ += [(S + "UpLeg", S + "_hip", S + "_knee"), (S + "Leg", S + "_knee", S + "_ankle"),
               (S + "Foot", S + "_ankle", S + "_toe")]
    parents = dict(rig.HUMAN_BONES + rig.HUMAN_ATTACH)
    specs = [dict(name=n, head=J[h], tail=J[t], parent=parents[n]) for n, h, t in B_]
    for S in ("Left", "Right"):
        g = J[S + "_grip"]
        specs.append(dict(name=S + "HandGrip", head=g, tail=g + up * .06 * k, parent=S + "Hand", deform=False,
                          align_z=(0, -1, 0)))
    specs.append(dict(name="HeadTop", head=J["top"], tail=J["top"] + up * .08 * k, parent="Head", deform=False,
                      align_z=(0, -1, 0)))
    assert [s["name"] for s in specs] and sorted(s["name"] for s in specs) == sorted(rig.HUMAN_BONE_NAMES)
    return specs


# ==========================================================================
# hair (silhouette caps only -- never facial features)
# ==========================================================================
def _hair_shell(body, colour, front_z, back_z, inflate=1.06, top=1.06, exponent=2.25, modulate=None,
                segments=14, rings=8, name="hair_cap"):
    rx, ry, rz = body.head_r
    s = B.sphere((rx * inflate, ry * inflate, rz * top), segments=segments, rings=rings, exponent=exponent,
                 modulate=modulate, material=colour, name=name)
    # hairline plane through (y=-ry, z=front_z*R) and (y=+ry, z=back_z*R)
    R = body.R
    p0 = Vector((0, -ry, front_z * R))
    p1 = Vector((0, ry, back_z * R))
    d = (p1 - p0).normalized()
    n = Vector((0, -d.z, d.y))           # perpendicular in the YZ plane, pointing up
    if n.z < 0:
        n = -n
    B.cut(s, p0, n)
    s.location = body.head_c
    return s


def hair(fig, body, style, colour):
    """Hair styles: short | bob | bun | flat_top | perm | side_tufts | under_hat | none."""
    if style in (None, "none"):
        return
    R = body.R
    c = body.head_c
    parts = []
    if style == "short":
        parts.append(_hair_shell(body, colour, .5, -.42))
    elif style == "flat_top":
        parts.append(_hair_shell(body, colour, .52, -.35, top=1.02, exponent=3.0))
    elif style == "bob":
        parts.append(_hair_shell(body, colour, .30, -.62, inflate=1.09, top=1.07))
    elif style == "bun":
        parts.append(_hair_shell(body, colour, .48, -.45))
        parts.append(B.sphere(R * .36, segments=10, rings=6, material=colour,
                              loc=c + Vector((0, R * .78, R * .52)), name="hair_bun"))
    elif style == "perm":
        def curls(theta, t):
            return 1 + .07 * math.cos(6 * theta) * abs(math.sin(t * PI * 3.0))
        parts.append(_hair_shell(body, colour, .5, -.35, inflate=1.13, top=1.14, modulate=curls,
                                 segments=18, rings=10, name="hair_perm"))
    elif style == "side_tufts":
        parts.append(_hair_shell(body, colour, -.12, -.55, inflate=1.05, name="hair_fringe_back"))
        for sx in (1, -1):
            parts.append(B.sphere((R * .2, R * .3, R * .22), segments=8, rings=5, material=colour,
                                  loc=c + Vector((sx * R * .9, R * .12, -R * .02)), name="hair_tuft"))
    elif style == "under_hat":
        parts.append(_hair_shell(body, colour, 1.1, -.5, top=.9, name="hair_under_hat"))
    else:
        raise ValueError("unknown hair style %r" % style)
    fig.add_all(parts, "hair")


# ==========================================================================
# headwear -- each builder(body, colour, accent) -> list of parts. All are
# shaped around the head centre so they fit any Body. Also used standalone
# (chef_hat prop) by passing a Body.
# ==========================================================================
def _dome(rx, ry, rz, z0, segments=16, rings=5, exponent=2.0, **kw):
    """Upper half-ellipsoid, flat bottom at z0 (hidden inside the head)."""
    rs = []
    p = 2.0 / exponent
    for i in range(rings + 1):
        a = (PI / 2) * i / rings
        f = abs(math.cos(a)) ** p if i < rings else 0.0
        rs.append((z0 + rz * math.sin(a) ** p, rx * f, ry * f))
    return B.loft(rs, segments=segments, exponent=exponent, **kw)


def _bill(width, reach, back, thickness, curve, **kw):
    """D-shaped cap bill in the XY plane pointing -Y; ``curve`` bends the sides
    down. back = y of the straight rear edge (inside the head)."""
    pts = []
    n = 10
    for i in range(n + 1):
        a = PI * i / n
        pts.append((-width / 2 * math.cos(a), back - reach * math.sin(a) ** .8))
    obj = B.extrude_profile(pts, thickness, **kw)
    B.deform(obj, lambda v: Vector((v.x, v.y, v.z - curve * (2 * v.x / width) ** 2)))
    return obj


def _place(parts, body, tilt=0.0):
    """Move head-local parts to the head centre, optionally tilting forward."""
    M = Matrix.Translation(body.head_c) @ Euler((tilt, 0, 0)).to_matrix().to_4x4()
    for p in parts:
        p.matrix_basis = M @ p.matrix_basis
    return parts


def hat_chef(body, colour="cloth_white", accent=None):
    """Tall pleated paper chef hat: band + mushrooming pleated crown."""
    R = body.R
    prof = [(.28, 1.0), (.66, 1.02), (.70, .96), (.95, 1.1), (1.35, 1.22), (1.70, 1.25), (1.92, 1.1),
            (2.05, .75), (2.1, 0)]
    rings = [(z * R, r * R, r * R * .97) for z, r in prof]

    def pleats(theta, t):
        return 1 + (.045 * math.cos(12 * theta) if 0.25 < t < 0.9 else 0.0)
    crown = B.loft(rings, segments=20, modulate=pleats, material=colour, name="headwear_chef_hat")
    return _place([crown], body)


def hat_flat_cap(body, colour="khaki_brown", accent=None):
    """Newsboy flat cap: low crown pushed forward + short stiff bill."""
    R = body.R
    rings = [(.22 * R, 1.04 * R, 1.0 * R, 0, 0), (.50 * R, 1.12 * R, 1.14 * R, 0, -.06 * R),
             (.70 * R, 1.06 * R, 1.12 * R, 0, -.14 * R), (.84 * R, .78 * R, .84 * R, 0, -.16 * R),
             (.9 * R, 0, 0, 0, -.14 * R)]
    crown = B.loft(rings, segments=16, material=colour, name="headwear_flat_cap")
    bill = _bill(1.3 * R, .42 * R, -.7 * R, .07 * R, .06 * R, material=colour, name="headwear_flat_cap_bill",
                 loc=(0, -.12 * R, .3 * R), rot=(.32, 0, 0))
    return _place([crown, bill], body, tilt=.14)


def hat_hard_hat(body, colour="yellow", accent=None):
    """Construction hard hat: dome, centre ridge, full brim with front peak."""
    R = body.R
    dome = _dome(1.1 * R, 1.12 * R, .98 * R, .2 * R, segments=18, rings=6, material=colour,
                 name="headwear_hard_hat")
    ridge_pts = [(0, -1.14 * R * math.sin(a), .2 * R + 1.0 * R * math.cos(a))
                 for a in [math.radians(d) for d in range(-72, 73, 18)]]
    ridge = B.tube(ridge_pts, .1 * R, segments=6, material=colour, name="headwear_hard_hat_ridge")
    brim = B.loft([(.16 * R, 1.3 * R, 1.42 * R, 0, -.1 * R), (.26 * R, 1.3 * R, 1.42 * R, 0, -.1 * R)],
                  segments=18, material=colour, name="headwear_hard_hat_brim", smooth_angle=math.radians(60))
    return _place([dome, ridge, brim], body, tilt=.05)


def hat_courier_cap(body, colour="yellow", accent="navy"):
    """Baseball-style courier cap: dome, button, long curved bill (accent)."""
    R = body.R
    dome = _dome(1.07 * R, 1.05 * R, .9 * R, .18 * R, segments=16, rings=5, material=colour,
                 name="headwear_courier_cap")
    button = B.sphere(.12 * R, segments=8, rings=4, material=colour, loc=(0, 0, 1.06 * R),
                      name="headwear_courier_cap_button")
    bill = _bill(1.45 * R, .95 * R, -.6 * R, .06 * R, .14 * R, material=accent or colour,
                 name="headwear_courier_cap_bill", loc=(0, 0, .24 * R), rot=(.12, 0, 0))
    return _place([dome, button, bill], body, tilt=.06)


def hat_school_cap(body, colour="red", accent=None):
    """Kid's round school cap: soft dome with a short all-round turned-down brim."""
    R = body.R
    dome = _dome(1.08 * R, 1.06 * R, .95 * R, .2 * R, segments=16, rings=5, material=colour,
                 name="headwear_school_cap")
    brim = B.loft([(.34 * R, 1.02 * R, 1.0 * R), (.17 * R, 1.48 * R, 1.5 * R, 0, -.1 * R),
                   (.12 * R, 1.44 * R, 1.46 * R, 0, -.1 * R), (.28 * R, 1.0 * R, .98 * R)],
                  segments=16, closed=True, material=colour, name="headwear_school_cap_brim")
    return _place([dome, brim], body, tilt=.08)


def hat_straw(body, colour="straw", accent="red"):
    """Wide woven straw sun hat: domed crown, drooping wavy brim, ribbon band."""
    R = body.R
    crown = B.lathe([(1.0 * R, .3 * R), (1.02 * R, .62 * R), (.94 * R, .95 * R), (.7 * R, 1.12 * R), (0, 1.18 * R)],
                    segments=16, material=colour, name="headwear_straw_hat")

    def wave(theta, t):
        return 1 + .025 * math.cos(10 * theta) * (1 if 0.2 < t < 0.8 else 0)   # even count: mirror-symmetric in x
    brim = B.loft([(.40 * R, .98 * R, .98 * R), (.34 * R, 1.6 * R, 1.6 * R), (.14 * R, 2.2 * R, 2.2 * R),
                   (.08 * R, 2.22 * R, 2.22 * R), (.26 * R, 1.6 * R, 1.6 * R), (.33 * R, .98 * R, .98 * R)],
                  segments=20, closed=True, modulate=wave, material=colour, name="headwear_straw_hat_brim")
    band = B.loft([(.36 * R, 1.035 * R, 1.035 * R), (.56 * R, 1.045 * R, 1.045 * R)], segments=16,
                  material=accent or colour, name="headwear_straw_hat_band")
    return _place([crown, brim, band], body, tilt=.04)


def hat_sun_visor(body, colour="pink", accent=None):
    """Auntie sun visor: big curved front shade sitting at the hairline."""
    R = body.R
    # The elastic band is hidden under hair; only the big shade reads at game scale.
    shade = _bill(1.7 * R, 1.15 * R, -.72 * R, .05 * R, .12 * R, material=colour, name="headwear_sun_visor",
                  loc=(0, 0, .58 * R), rot=(.06, 0, 0))
    return _place([shade], body)


def hat_peaked(body, colour="navy", accent="charcoal"):
    """Bus-driver peaked uniform cap: band, wide flat crown, shiny short visor, badge."""
    R = body.R
    crown = B.loft([(.3 * R, 1.04 * R, 1.0 * R), (.62 * R, 1.06 * R, 1.03 * R, 0, -.02 * R),
                    (.95 * R, 1.3 * R, 1.26 * R, 0, -.08 * R), (1.06 * R, 1.32 * R, 1.28 * R, 0, -.08 * R),
                    (1.12 * R, 1.12 * R, 1.08 * R, 0, -.08 * R), (1.14 * R, 0, 0, 0, -.08 * R)],
                   segments=18, material=colour, name="headwear_peaked_cap", smooth_angle=math.radians(40))
    visor = _bill(1.2 * R, .55 * R, -.75 * R, .05 * R, 0.0, material=accent or "charcoal",
                  name="headwear_peaked_cap_visor", loc=(0, 0, .44 * R), rot=(.22, 0, 0))
    badge = B.rounded_box((.28 * R, .06 * R, .2 * R), radius=.025 * R, segments=1, material="yellow",
                          loc=(0, -1.07 * R, .55 * R), name="headwear_peaked_cap_badge")
    return _place([crown, visor, badge], body, tilt=.04)


def hood_down(body, colour, accent=None):
    """Hood lying down behind the neck: a thick collar roll + fabric lump on the back."""
    zc = body.torso_top - .05 * body.k
    rx, ry = body.profile(zc)
    pts, rad = [], []
    for i in range(13):
        a = math.radians(-35 + 250 * i / 12)          # from front-right around the back to front-left
        pts.append((math.cos(a) * rx * .78, math.sin(a) * ry * .95 + .01 * body.k,
                    zc + .03 * body.k * math.sin(a)))
        rad.append(.034 * body.k + .03 * body.k * max(0.0, math.sin(a)))
    roll = B.tube(pts, rad, segments=6, material=colour, name="hood_down_roll")
    zb = body.sh.z - .08 * body.k
    lump = B.sphere((.13 * body.k * body.b["shoulder"], .05 * body.k, .1 * body.k), segments=10, rings=5,
                    material=colour, loc=(0, body.profile(zb)[1] + .01 * body.k, zb), name="hood_down_back")
    return [roll, lump]


HEADWEAR = {
    "chef_hat": hat_chef,
    "flat_cap": hat_flat_cap,
    "hard_hat": hat_hard_hat,
    "courier_cap": hat_courier_cap,
    "school_cap": hat_school_cap,
    "straw_hat": hat_straw,
    "sun_visor": hat_sun_visor,
    "peaked_cap": hat_peaked,
    "hood_down": hood_down,
    "none": None,
}


# ==========================================================================
# outfit features -- builder(fig, body, **params); every builder follows the
# torso profile so it fits every build.
# ==========================================================================
def _shell(body, z0, z1, colour, inflate, arc=None, n=6, flare=None, thickness=None, name="shell", modulate=None):
    kw = dict(material=colour, name=name, modulate=modulate)
    if arc is not None:
        kw.update(arc=arc, thickness=thickness or .01 * body.k)
    else:
        kw.update(cap_start=False, cap_end=False, thickness=thickness)
    return B.loft(body.rings(z0, z1, inflate, n, flare), segments=14 if arc is None else 12,
                  exponent=Body.TORSO_EXP, **kw)


def _on_surface(body, theta, z, size, colour, inflate=0.0, name="patch", radius=None):
    """Small rounded block sitting on the torso surface facing outward."""
    p = body.surface(theta, z, inflate + size[1] * .3)
    return B.rounded_box(size, radius=radius or min(size) * .35, segments=1, material=colour, loc=p,
                         rot=(0, 0, theta + PI / 2), name=name)


def outfit_apron(fig, body, colour, top=None, bottom=None, strap=True):
    """Front apron: narrow bib + wide skirt panel hanging past the hips, waist
    tie and neck strap."""
    k = body.k
    zw = body.ctrl[3][0]
    top = top if top is not None else body.ctrl[4][0] + .05 * k
    bottom = bottom if bottom is not None else body.leg[1][0] + .04 * k
    d = .014 * k
    skirt = _shell(body, bottom, zw, colour, d, arc=(FRONT - 1.15, FRONT + 1.15), n=5,
                   flare=lambda z: .03 * k * max(0.0, (zw - z) / (zw - bottom)) ** 1.5, name="apron_skirt")
    bib = _shell(body, zw - .02 * k, top, colour, d, arc=(FRONT - .62, FRONT + .62), n=3, name="apron_bib")
    tie = _shell(body, zw - .02 * k, zw + .02 * k, colour, d + .004 * k, name="apron_tie")
    parts = [skirt, bib, tie]
    if strap:
        zt = top
        pts = [body.surface(FRONT - .55, zt, d), body.surface(FRONT - .9, body.torso_top - .04 * k, d + .004 * k),
               Vector((0, body.profile(body.torso_top - .06 * k)[1] + .02 * k, body.torso_top - .02 * k)),
               body.surface(FRONT + PI + .9, body.torso_top - .04 * k, d + .004 * k), body.surface(FRONT + .55, zt, d)]
        parts.append(B.tube(pts, .012 * k, segments=5, material=colour, name="apron_strap"))
    fig.add_all(parts, "outfit")


def outfit_vest(fig, body, colour, gap=0.0, stripes=(), stripe_colour="metal", bottom=None, top=None):
    """Vest shell over the shirt. gap>0 opens the front (radians each side).
    stripes: heights (0..1 up the vest) of reflective bands."""
    k = body.k
    z0 = bottom if bottom is not None else body.ctrl[1][0] + .01 * k
    z1 = top if top is not None else body.sh.z + .05 * k
    arc = (FRONT + gap, FRONT + 2 * PI - gap) if gap else None
    parts = [_shell(body, z0, z1, colour, .012 * k, arc=arc, n=6, name="vest")]
    for u in stripes:
        zc = z0 + (z1 - z0) * u
        parts.append(_shell(body, zc - .022 * k, zc + .022 * k, stripe_colour, .024 * k, arc=arc, n=1,
                            name="vest_stripe"))
    fig.add_all(parts, "outfit")


def outfit_cardigan(fig, body, colour, gap=.2):
    """Open-front knitted cardigan (long, below the hips) with patch pockets."""
    k = body.k
    z0 = body.torso_bottom - .03 * k
    parts = [_shell(body, z0, body.sh.z + .05 * k, colour, .013 * k, arc=(FRONT + gap, FRONT + 2 * PI - gap),
                    n=7, name="cardigan")]
    for sx in (1, -1):
        parts.append(_on_surface(body, FRONT + sx * .75, z0 + .1 * k, (.075 * k, .02 * k, .07 * k), colour,
                                 .013 * k, name="cardigan_pocket"))
    fig.add_all(parts, "outfit")


def outfit_bands(fig, body, colour, collar=True, hem=True, yoke=False):
    """Contrast trim bands: stand collar, hem band, shoulder yoke (courier)."""
    k = body.k
    parts = []
    if hem:
        z0 = body.ctrl[1][0]
        parts.append(_shell(body, z0 - .005 * k, z0 + .05 * k, colour, .008 * k, n=1, name="trim_hem"))
    if yoke:
        zy = body.ctrl[5][0]
        parts.append(_shell(body, zy - .06 * k, zy - .015 * k, colour, .008 * k, n=1, name="trim_yoke"))
    if collar:
        parts += collar_stand(body, colour)
    fig.add_all(parts, "outfit")


def collar_stand(body, colour, height=.05):
    k = body.k
    z = body.neck[0] + .02 * k
    r = body.neck_r * 1.35
    return [B.loft([(z, r, r * .95), (z + height * k, r * 1.05, r), (z + height * k + .004 * k, r * .9, r * .86)],
                   segments=12, cap_start=False, cap_end=False, thickness=.01 * k, material=colour,
                   name="collar")]


def outfit_polo(fig, body, colour, tag="cloth_white"):
    """Polo: turned-down collar with points, button placket, chest pocket, name tag."""
    k = body.k
    parts = collar_stand(body, colour, .035)
    zc = body.torso_top - .06 * k
    for sx in (1, -1):
        pts = [(0, 0), (.07 * k, .012 * k), (.035 * k, -.075 * k)]
        pts = [(sx * x, y) for x, y in pts]
        p = body.surface(FRONT + sx * .28, zc, .012 * k)
        parts.append(B.extrude_profile(pts, .012 * k, material=colour, name="polo_collar_point",
                                       loc=(sx * .01 * k, p.y, zc + .012 * k), rot=(PI / 2 - .35, 0, 0)))
    parts.append(_on_surface(body, FRONT, zc - .07 * k, (.035 * k, .012 * k, .1 * k), colour, .004 * k,
                             name="polo_placket"))
    parts.append(_on_surface(body, FRONT - .55, body.ctrl[4][0] + .02 * k, (.07 * k, .014 * k, .075 * k), colour,
                             .004 * k, name="polo_pocket"))
    if tag:
        parts.append(_on_surface(body, FRONT + .55, body.ctrl[4][0] + .04 * k, (.085 * k, .014 * k, .035 * k), tag,
                                 .006 * k, name="name_tag"))
    fig.add_all(parts, "outfit")


def outfit_hoodie(fig, body, colour, string="cloth_white"):
    """Hoodie details: kangaroo pocket + drawstrings (hood itself = headwear)."""
    k = body.k
    z0 = body.ctrl[2][0] + .01 * k
    parts = [_shell(body, z0, z0 + .13 * k, colour, .012 * k, arc=(FRONT - .75, FRONT + .75), n=2,
                    name="hoodie_pocket")]
    for sx in (1, -1):
        a = body.surface(FRONT + sx * .22, body.torso_top - .05 * k, .01 * k)
        b = body.surface(FRONT + sx * .2, body.ctrl[4][0] - .02 * k, .012 * k)
        parts.append(B.tube([a, b], .009 * k, segments=4, material=string, name="hoodie_string"))
    fig.add_all(parts, "outfit")


def outfit_coat(fig, body, colour, bottom, flare=.06, buttons="navy"):
    """Long coat skirt from the waist to ``bottom`` flaring out (raincoat)."""
    k = body.k
    zw = body.ctrl[3][0]
    parts = [_shell(body, bottom, zw, colour, .012 * k, n=5,
                    flare=lambda z: flare * k * max(0.0, (zw - z) / (zw - bottom)) ** 1.3, name="coat_skirt")]
    zs = [body.ctrl[4][0], body.ctrl[3][0], body.ctrl[2][0]]
    for z in zs:
        parts.append(B.sphere(.022 * k, segments=8, rings=4, material=buttons,
                              loc=body.surface(FRONT, z, .016 * k), name="coat_button"))
    fig.add_all(parts, "outfit")


def outfit_chef_jacket(fig, body, colour, buttons="charcoal"):
    """Chef jacket: stand collar + double-breasted button rows above the apron bib."""
    k = body.k
    parts = collar_stand(body, colour, .045)
    for sx in (1, -1):
        for z in (body.ctrl[5][0] - .02 * k, body.ctrl[5][0] - .075 * k):
            parts.append(B.sphere(.016 * k, segments=6, rings=3, material=buttons,
                                  loc=body.surface(FRONT + sx * .42, z, .004 * k), name="jacket_button"))
    fig.add_all(parts, "outfit")


def outfit_belt(fig, body, colour, buckle="metal", keys=False):
    """Belt band at the waist; optional key ring clipped on the right hip."""
    k = body.k
    z = body.ctrl[2][0] + .01 * k
    parts = [_shell(body, z - .022 * k, z + .022 * k, colour, .01 * k, n=1, name="belt")]
    parts.append(_on_surface(body, FRONT, z, (.06 * k, .014 * k, .05 * k), buckle, .01 * k, name="belt_buckle"))
    if keys:
        p = body.surface(FRONT + 1.05, z - .03 * k, .03 * k)
        parts.append(B.torus(.03 * k, .006 * k, 10, 4, material="metal", loc=p, rot=(PI / 2, 0, .5),
                             name="belt_key_ring"))
        for i, a in enumerate((-.35, .1, .5)):
            parts.append(B.rounded_box((.016 * k, .006 * k, .06 * k), radius=.003 * k, segments=1,
                                       material="metal" if i != 1 else "yellow",
                                       loc=p + Vector((.02 * k * a, -.004 * k, -.05 * k)), rot=(0, a * .6, .5),
                                       name="belt_key"))
    fig.add_all(parts, "outfit")


def outfit_tie(fig, body, colour, epaulettes=True):
    """Uniform: tie as a narrow strip following the shirt front + shoulder boards."""
    k = body.k
    ztop, zbot = body.torso_top - .025 * k, body.ctrl[3][0] + .01 * k
    parts = [_shell(body, zbot, ztop, colour, .006 * k, arc=(FRONT - .13, FRONT + .13), n=4,
                    flare=lambda z: 0.0, name="uniform_tie")]
    parts.append(B.sphere((.022 * k, .014 * k, .02 * k), segments=8, rings=4, material=colour,
                          loc=body.surface(FRONT, ztop - .005 * k, .01 * k), name="uniform_tie_knot"))
    if epaulettes:
        for sx in (1, -1):
            parts.append(B.rounded_box((.11 * k * body.b["shoulder"], .06 * k, .018 * k), radius=.006 * k, segments=1,
                                       material=colour, loc=(sx * body.sh.x * .88, 0, body.sh.z + body.arm_r[0] * .95),
                                       rot=(0, -sx * .25, 0), name="epaulette"))
    fig.add_all(parts, "outfit")


def outfit_backpack(fig, body, colour, accent="charcoal", scale=1.0):
    """Backpack on the back with shoulder straps and a front pocket."""
    k = body.k * scale
    zc = (body.ctrl[3][0] + body.sh.z) / 2
    _, ry = body.profile(zc)
    w, d, h = .24 * k * body.b["shoulder"] ** .5, .1 * k, .3 * k
    y = ry + d / 2 - .005
    parts = [B.rounded_box((w, d, h), radius=.035 * k, segments=1, material=colour, loc=(0, y, zc), name="backpack")]
    parts.append(B.rounded_box((w * .7, d * .5, h * .42), radius=.025 * k, segments=1, material=accent,
                               loc=(0, y + d * .5, zc - h * .2), name="backpack_pocket"))
    for sx in (1, -1):
        x = sx * w * .3
        pts = [Vector((x, y - d * .3, zc + h * .4)),
               Vector((x, body.profile(body.torso_top - .06 * body.k)[1] * .5, body.torso_top - .015 * body.k)),
               body.surface(FRONT + sx * .55, body.torso_top - .07 * body.k, .012 * body.k),
               body.surface(FRONT + sx * .6, body.ctrl[4][0] - .03 * body.k, .014 * body.k)]
        parts.append(B.tube(pts, .016 * body.k, segments=5, material=accent, name="backpack_strap"))
    fig.add_all(parts, "outfit")


def outfit_tote(fig, body, colour, strap="khaki_brown"):
    """Canvas tote hanging at the right hip from a strap over the right shoulder."""
    k = body.k
    zc = body.ctrl[2][0] - .02 * k
    rx, _ = body.profile(zc)
    x = rx + .045 * k
    bag = B.rounded_box((.05 * k, .26 * k, .27 * k), radius=.02 * k, segments=2, material=colour,
                        loc=(x, 0, zc), name="tote_bag")
    top = zc + .135 * k
    pts = [Vector((x, -.09 * k, top)), body.surface(FRONT + .35, body.ctrl[5][0], .015 * k),
           Vector((body.sh.x * .75, 0, body.torso_top - .005 * k)),
           body.surface(FRONT + PI - .35, body.ctrl[5][0], .015 * k), Vector((x, .09 * k, top))]
    fig.add_all([bag, B.tube(pts, .012 * k, segments=5, material=strap, name="tote_strap")], "outfit")


OUTFITS = {
    "apron": outfit_apron,
    "vest": outfit_vest,
    "cardigan": outfit_cardigan,
    "bands": outfit_bands,
    "polo": outfit_polo,
    "hoodie": outfit_hoodie,
    "coat": outfit_coat,
    "chef_jacket": outfit_chef_jacket,
    "belt": outfit_belt,
    "tie": outfit_tie,
    "backpack": outfit_backpack,
    "tote": outfit_tote,
    "collar": lambda fig, body, colour: fig.add_all(collar_stand(body, colour), "outfit"),
    "hood": lambda fig, body, colour: fig.add_all(hood_down(body, colour), "outfit"),
}


# ==========================================================================
# character spec table (docs/asset-list.md). ``signature`` = the dominant
# torso colour seen from the game camera (outer layer: vest/apron/cardigan);
# (headwear shape, signature) must be unique across humans.
# ==========================================================================
def H(name, height, build, skin, hair, torso, legs, shoes, headwear, outfit=(), sleeve="long", sleeves=None,
      signature=None, cuff=None, guard=None, quilt=0, leg_style="straight", boot=None, kid=False, stoop=0.0):
    return dict(name=name, height=height, build=build, skin=skin, hair=hair, torso=torso, legs=legs, shoes=shoes,
                headwear=headwear, outfit=list(outfit), sleeve=sleeve, sleeves=sleeves or torso,
                signature=signature or torso, cuff=cuff, guard=guard, quilt=quilt, leg_style=leg_style,
                boot=boot, kid=kid, stoop=stoop)


SPEC = [
    H("player", 1.7, "average", "skin_mid", ("short", "hair_black"), "cloth_grey", "denim", "cloth_white",
      ("hood_down", "cloth_grey"), [("hoodie", {"colour": "cloth_grey"}),
                                    ("backpack", {"colour": "navy", "accent": "charcoal", "scale": .9})],
      cuff="cloth_grey"),
    H("cook", 1.7, "stocky", "skin_tan", ("under_hat", "hair_black"), "cloth_white", "charcoal", "charcoal",
      ("chef_hat", "cloth_white"), [("chef_jacket", {"colour": "cloth_white"}), ("apron", {"colour": "charcoal"})],
      sleeve="rolled"),
    H("old_wang", 1.6, "thin", "skin_light", ("side_tufts", "hair_grey"), "cloth_white", "khaki_brown", "charcoal",
      ("flat_cap", "slate"), [("cardigan", {"colour": "cloth_oat"})], sleeves="cloth_oat", signature="cloth_oat",
      stoop=.24),
    H("landlord", 1.62, "stocky", "skin_mid", ("flat_top", "hair_black"), "cloth_white", "khaki_brown", "charcoal",
      ("none", None), [("vest", {"colour": "charcoal", "gap": .34, "bottom": .75}),
                       ("belt", {"colour": "khaki_brown", "keys": True})],
      sleeve="rolled", signature="charcoal"),
    H("warehouse_boss", 1.7, "broad", "skin_tan", ("under_hat", "hair_black"), "work_blue", "charcoal",
      "khaki_brown", ("hard_hat", "yellow"),
      [("vest", {"colour": "hivis_orange", "stripes": (.28, .6), "stripe_colour": "metal"})],
      sleeve="rolled", signature="hivis_orange"),
    H("courier", 1.7, "thin", "skin_mid", ("under_hat", "hair_black"), "yellow", "charcoal", "charcoal",
      ("courier_cap", "yellow", "yellow"), [("bands", {"colour": "navy", "yoke": True})], cuff="navy"),
    H("fruit_seller", 1.7, "plump", "skin_tan", ("under_hat", "hair_black"), "cloth_white", "charcoal", "charcoal",
      ("straw_hat", "straw", "red"), [("apron", {"colour": "leaf_green", "top": None})],
      guard="pink", signature="leaf_green"),
    H("clerk", 1.7, "average", "skin_light", ("bob", "hair_black"), "red", "charcoal", "charcoal", ("none", None),
      [("polo", {"colour": "red", "tag": "cloth_white"})], sleeve="short"),
    H("customer_a", 1.7, "thin", "skin_mid", ("short", "hair_black"), "cloth_white", "denim", "cloth_white",
      ("none", None), [("tote", {"colour": "paper"})], sleeve="short"),
    H("customer_b", 1.7, "plump", "skin_light", ("perm", "hair_black"), "purple", "charcoal", "charcoal",
      ("sun_visor", "pink"), [("collar", {"colour": "purple"})], quilt=4, leg_style="wide"),
    H("kid", 1.1, "average", "skin_mid", ("under_hat", "hair_black"), "yellow", "denim", "red", ("school_cap", "red"),
      [("coat", {"colour": "yellow", "bottom": None, "buttons": "navy"}), ("hood", {"colour": "yellow"}),
       ("backpack", {"colour": "navy", "accent": "red", "scale": .72})], boot="red", kid=True),
    H("bus_driver", 1.7, "average", "skin_mid", ("under_hat", "hair_black"), "sky_blue", "navy", "charcoal",
      ("peaked_cap", "navy", "navy"), [("tie", {"colour": "navy"})], sleeve="short"),
]
RECOLOURS = {"customer_a_khaki": "khaki_brown", "customer_a_green": "leaf_green", "customer_a_blue": "work_blue"}
HEAD_TOP = {}              # name -> measured bare-head top (m above feet), filled by make_human
RIG = {}                   # name -> armature + clip info, filled by make_human / _finish_pet
HUMAN_TRIS = (800, 2500)
PET_TRIS = 1200
PROP_TRIS = 400


def assert_distinct(spec):
    """No two humans share a (headwear shape, torso signature colour) pair."""
    pairs = [(s["headwear"][0], s["signature"]) for s in spec]
    pairs += [("none", c) for c in RECOLOURS.values()]
    dupes = sorted({p for p in pairs if pairs.count(p) > 1})
    assert not dupes, "duplicate (headwear, torso) pairs: %s" % dupes
    print("DISTINCT OK %d humans + %d recolours, all (headwear, torso) pairs unique: %s"
          % (len(spec), len(RECOLOURS), ", ".join("%s/%s" % p for p in pairs)))


def make_human(spec, torso_override=None, out_name=None):
    """Build one human from a SPEC row -> joined object (not yet exported)."""
    B.clear_scene()
    name = out_name or spec["name"]
    torso_c = torso_override or spec["torso"]
    sleeves_c = torso_override if torso_override and spec["sleeves"] == spec["torso"] else spec["sleeves"]
    body = Body(spec["height"] / (math.cos(spec["stoop"] * .55) if spec["stoop"] else 1.0), spec["build"],
                kid=spec["kid"])
    fig = Figure(name, body)
    head(fig, body, spec["skin"])
    torso(fig, body, torso_c, quilt=spec["quilt"])
    arm(fig, body, sleeves_c, spec["skin"], spec["sleeve"], cuff=spec["cuff"], guard=spec["guard"],
        quilt=2 if spec["quilt"] else 0)
    leg(fig, body, spec["legs"], spec["shoes"], spec["leg_style"], boot=spec["boot"])
    hair(fig, body, *spec["hair"])
    hw = spec["headwear"]
    if HEADWEAR[hw[0]]:
        fig.add_all(HEADWEAR[hw[0]](body, hw[1], *(hw[2:] or [None])), "headwear")
    for key, params in spec["outfit"]:
        params = dict(params)
        if key == "coat" and params.get("bottom") is None:
            params["bottom"] = body.leg[1][0] - .02 * body.k
        if params.get("colour") == spec["torso"] and torso_override:
            params["colour"] = torso_override
        OUTFITS[key](fig, body, **params)
    assert_faceless(fig)
    angles = rest_arms(fig, body)                   # relaxed-A bind pose
    labels = human_labels(fig, body, angles)
    joints = human_joints(body, angles, fig.elbow_u)
    if spec["stoop"]:
        z0, z1, A = body.ctrl[2][0], body.ctrl[5][0], spec["stoop"]

        def stoop(v, zref=None):
            """Bend the upper body forward about the waist; arms (zref = shoulder
            height) follow the shoulder rigidly so they still hang straight."""
            dz = v.z - z0
            f = min(max(((zref if zref is not None else v.z) - z0) / (z1 - z0), 0.0), 1.0)
            if f <= 0:
                return v
            a = A * f * f * (3 - 2 * f)
            p = Vector((v.x, v.y, dz))
            p = Matrix.Rotation(a, 3, "X") @ p
            return Vector((p.x, p.y, p.z + z0))
        for p in fig.parts:
            if p.get("limb") == "arm":
                B.deform(p, lambda v: stoop(v, body.sh.z))
            else:
                B.deform(p, stoop)
        joints = {n: (stoop(v, body.sh.z) if side else stoop(v), side) for n, (v, side) in joints.items()}
    head_part = fig.by_role("head")[0]
    B.bake(head_part)
    head_top = B.bbox(head_part)[1].z
    obj = B.join(fig.parts, name)
    sc = spec["height"] / head_top
    B.scale_mesh(obj, sc)
    feet = B.bbox(obj)[0].z
    B.set_origin_feet(obj, centre_xy=False)
    HEAD_TOP[name] = spec["height"] - feet     # measured bare-head top above the feet
    J = {n: v * sc - Vector((0, 0, feet)) for n, (v, _) in joints.items()}
    rigobj = rig.build_armature(name + "_rig", human_bone_specs(J, spec["height"] / 1.7), rig.HUMAN_SKELETON)
    counts = rig.bind_rigid(obj, rigobj, labels)
    front_ry = max(body.profile(z)[1] for z in (body.ctrl[3][0], body.ctrl[4][0])) * sc
    clips, motion = rig.bake_human(rigobj, spec["height"], front_ry)
    stride, slip = rig.measure_stride(rigobj, motion.sk, motion)
    assert abs(stride - motion.stride) < .01 * motion.stride, "%s stride %.3f vs %.3f" % (name, stride, motion.stride)
    assert slip < 1e-3, "%s planted foot lifts %.4f m" % (name, slip)
    RIG[name] = dict(arm=rigobj, clips=clips, stride=stride, step=motion.step,
                     rest_arm_deg={S: round(math.degrees(angles[sd][0]), 1) for S, sd in (("Left", 1), ("Right", -1))},
                     shoulder_out_m={S: round(angles[sd][1] * sc, 3) for S, sd in (("Left", 1), ("Right", -1))},
                     bones_weighted=len(counts))
    return obj, spec["height"]


def check_human(obj, height, name):
    tris = B.tri_count(obj)
    lo, hi = B.bbox(obj)
    assert HUMAN_TRIS[0] <= tris <= HUMAN_TRIS[1], "%s tris %d outside %s" % (name, tris, HUMAN_TRIS)
    assert abs(lo.z) < 1e-4, "%s feet not at z=0" % name
    assert abs(lo.x + hi.x) < .01, "%s not centred in x" % name
    return tris, hi.z


# ==========================================================================
# pets (faceless: head is one smooth shell; ears/tails are silhouette only)
# ==========================================================================
PET_ROOT_TOKENS = {"leg", "paw", "foot", "haunch"}      # stay on the ground (Root)


def pet_labels(fig):
    """Rigid pet weights: head + ears -> Head, tail -> Tail, legs/paws -> Root,
    everything else (body, neck, wings) -> Spine."""
    out = []
    for p in fig.parts:
        t = tokens(p.name)
        b = ("Head" if p["role"] in ("head", "animal_ear") else "Tail" if "tail" in t
             else "Root" if t & PET_ROOT_TOKENS else "Spine")
        out += [b] * len(p.data.vertices)
    return out


def rig_pet(obj, labels, height, tail_amp):
    """Root/Spine/Head/Tail from the bound vertex groups of the finished mesh."""
    vs = [v.co.copy() for v in obj.data.vertices]
    grp = {}
    for v, b in zip(vs, labels):
        grp.setdefault(b, []).append(v)

    def centre(b):
        return sum(grp[b], Vector()) / len(grp[b])
    sc, hc = centre("Spine"), centre("Head")
    head_h = max(v.z for v in grp["Head"]) - min(v.z for v in grp["Head"])
    tail = grp["Tail"]
    base = min(tail, key=lambda v: (v - sc).length)
    tip = max(tail, key=lambda v: (v - base).length)
    neck = sc.lerp(hc, .7)
    up = Vector((0, 0, 1))
    specs = [dict(name="Root", head=Vector(), tail=up * .3 * height, parent=None),
             dict(name="Spine", head=sc, tail=neck, parent="Root"),
             dict(name="Head", head=neck, tail=hc + up * head_h * .5, parent="Spine"),
             dict(name="Tail", head=base, tail=tip, parent="Spine")]
    arm = rig.build_armature(obj.name + "_rig", specs, rig.PET_SKELETON)
    rig.bind_rigid(obj, arm, labels)
    RIG[obj.name] = dict(arm=arm, clips=rig.bake_pet(arm, tail_amp))


def _finish_pet(fig, height, tail_amp=math.radians(18)):
    assert_faceless(fig, allow_ears=True)
    labels = pet_labels(fig)
    obj = B.join(fig.parts, fig.name)
    B.set_origin_feet(obj, centre_xy=True)
    top = B.bbox(obj)[1].z
    B.scale_mesh(obj, height / top)
    rig_pet(obj, labels, height, tail_amp)
    return obj


def make_cat():
    """Ginger street cat sitting upright, tail curled round its feet, white paws."""
    B.clear_scene()
    fig = Figure("cat")
    c, w = "ginger", "cloth_white"
    fig.add(B.loft([(0.0, .05, .06, 0, .02), (.02, .085, .1, 0, .02), (.07, .095, .11, 0, .015),
                    (.13, .078, .084, 0, -.006), (.19, .06, .06, 0, -.026), (.22, .045, .045, 0, -.03),
                    (.235, 0, 0, 0, -.03)], segments=12, material=c, name="cat_body"), "body")
    for sx in (1, -1):
        fig.add(B.sphere((.05, .075, .055), segments=10, rings=5, material=c, loc=(sx * .06, .04, .05),
                         name="cat_haunch"), "body")
        fig.add(B.capsule(.02, .15, segments=6, cap_rings=2, material=c, loc=(sx * .03, -.06, .0),
                          rot=B.aim((0, .12, 1)), name="cat_foreleg"), "body")
        fig.add(B.sphere((.024, .032, .016), segments=8, rings=4, material=w, loc=(sx * .03, -.072, .012),
                         name="cat_paw"), "body")
        ear = B.cone(.036, .07, verts=3, material=c, rot=(0, 0, PI / 2), name="cat_ear")
        B.bake(ear)
        ear.location = (sx * .04, -.03, .33)
        ear.rotation_euler = (-.1, sx * -.3, 0)
        fig.add(ear, "animal_ear")
    fig.add(B.sphere((.072, .064, .062), segments=14, rings=8, exponent=2.2, material=c, loc=(0, -.035, .268),
                     name="cat_head_blank"), "head")
    pts, rad = [], []
    for i in range(10):
        a = math.radians(95 - 160 * i / 9)
        rr = .115 + .01 * i / 9
        pts.append((math.cos(a) * rr, .025 + math.sin(a) * rr, .018 + .02 * max(0, (i - 6) / 3)))
        rad.append(.02 - .008 * i / 9)
    fig.add(B.tube(pts, rad, segments=6, material=c, name="cat_tail"), "body")
    return _finish_pet(fig, .35, tail_amp=math.radians(9))


def make_dog():
    """Small tan dog standing: chunky barrel body, big head, floppy darker ears,
    tail curled up over the rump."""
    B.clear_scene()
    fig = Figure("dog")
    c, d = "dog_tan", "khaki_brown"
    fig.add(B.loft([(0, 0, 0), (.02, .062, .064), (.07, .078, .08), (.17, .08, .085), (.23, .074, .08),
                    (.26, 0, 0)], segments=12, material=c, rot=(PI / 2, 0, 0), loc=(0, .13, .18),
                   name="dog_body"), "body")
    for sx in (1, -1):
        for y in (-.08, .085):
            fig.add(B.capsule(.03, .16, segments=6, cap_rings=2, material=c, loc=(sx * .052, y, 0),
                              name="dog_leg"), "body")
        fig.add(B.sphere((.02, .04, .066), segments=8, rings=5, material=d, loc=(sx * .072, -.1, .3),
                         rot=(.2, sx * -.3, 0), name="dog_ear"), "animal_ear")
    fig.add(B.capsule(.048, .09, segments=8, cap_rings=2, material=c, loc=(0, -.09, .2),
                      rot=B.aim((0, -.35, 1)), name="dog_neck"), "body")
    fig.add(B.loft([(0, 0, 0), (.015, .068, .068), (.055, .078, .075), (.095, .062, .055, 0, -.012),
                    (.13, .04, .034, 0, -.026), (.148, 0, 0, 0, -.026)], segments=12, material=c,
                   rot=(PI / 2, 0, 0), loc=(0, -.07, .315), name="dog_head_blank"), "head")
    pts = [(0, .12, .235), (0, .148, .28), (0, .152, .32), (0, .128, .345), (0, .104, .332), (0, .108, .306)]
    fig.add(B.tube(pts, [.024, .022, .019, .016, .014, .012], segments=6, material=c, name="dog_tail"), "body")
    return _finish_pet(fig, .4)


def make_pigeon():
    """Grey pigeon: round chest-up body, small head, slate wings, tail wedge."""
    B.clear_scene()
    fig = Figure("pigeon")
    g, s = "cloth_grey", "slate"
    fig.add(B.loft([(0, 0, 0), (.03, .05, .045), (.09, .07, .07), (.15, .066, .07), (.2, .042, .05), (.225, 0, 0)],
                   segments=12, material=g, rot=(PI / 2 - .38, 0, 0), loc=(0, .1, .085), name="pigeon_body"), "body")
    fig.add(B.sphere((.042, .042, .036), segments=10, rings=5, material="leaf_green", loc=(0, -.066, .175),
                     name="pigeon_neck_sheen"), "body")
    fig.add(B.sphere((.036, .046, .038), segments=12, rings=6, exponent=2.1, material=g, loc=(0, -.09, .215),
                     name="pigeon_head_blank"), "head")
    for sx in (1, -1):
        fig.add(B.sphere((.024, .088, .045), segments=10, rings=5, material=s, loc=(sx * .056, .025, .125),
                         rot=(-.32, 0, sx * .06), name="pigeon_wing"), "body")
        fig.add(B.cylinder(.006, .06, verts=5, material="red", loc=(sx * .022, -.005, .03), name="pigeon_leg"), "body")
        fig.add(B.box((.012, .035, .006), material="red", loc=(sx * .022, -.018, .003), name="pigeon_foot"), "body")
    fig.add(B.extrude_profile([(-.025, 0), (.025, 0), (.04, .1), (-.04, .1)], .014, material=s,
                              loc=(0, .1, .1), rot=(-.25, 0, 0), name="pigeon_tail"), "body")
    return _finish_pet(fig, .25, tail_amp=math.radians(10))


# ==========================================================================
# held props (origin = grip point; worn props origin = base centre)
# ==========================================================================
def prop_chef_hat():
    """Spare chef hat, same builder as the cook's. Origin at the hat's base centre."""
    B.clear_scene()
    body = Body(1.7, "stocky")
    parts = hat_chef(body, "cloth_white")
    obj = B.join(parts, "chef_hat")
    B.set_origin_feet(obj, centre_xy=True)
    return obj


def prop_ladle():
    """Soup ladle, bowl down; wooden grip at the top is the origin."""
    B.clear_scene()
    bowl = B.lathe([(0, -.045), (.04, -.038), (.058, -.018), (.063, 0), (.056, .002), (.05, -.012), (.035, -.027),
                    (0, -.033)], segments=12, material="metal", loc=(0, -.035, -.36), name="ladle_bowl")
    shaft = B.tube([(0, 0, .02), (0, 0, -.3), (0, -.015, -.34), (0, -.035, -.36)], .007, segments=6,
                   material="metal", name="ladle_shaft")
    grip = B.capsule(.014, .13, segments=8, cap_rings=2, material="wood", loc=(0, 0, -.065), name="ladle_grip")
    hook = B.tube([(0, 0, .06), (0, -.012, .075), (0, -.024, .066)], .005, segments=5, material="metal",
                  name="ladle_hook")
    obj = B.join([bowl, shaft, grip, hook], "ladle")
    return B.set_origin(obj, (0, 0, 0))


def prop_clipboard():
    """Clipboard with paper and clip, standing in XZ facing -Y. Origin = left-edge grip."""
    B.clear_scene()
    board = B.rounded_box((.23, .012, .32), radius=.006, segments=1, material="wood", name="clip_board")
    paper = B.box((.19, .004, .25), material="paper", loc=(0, -.008, -.015), name="clip_paper")
    lines = [B.box((.13, .002, .008), material="slate", loc=(-.01, -.0105, .06 - i * .045), name="clip_line")
             for i in range(4)]
    clip = B.rounded_box((.09, .018, .035), radius=.006, segments=1, material="metal", loc=(0, -.01, .145),
                         name="clip_clip")
    obj = B.join([board, paper, clip] + lines, "clipboard")
    return B.set_origin(obj, (-.105, 0, 0))


def prop_delivery_bag():
    """Insulated delivery bag (yellow, navy bands). Origin = top of the handle."""
    B.clear_scene()
    box = B.rounded_box((.38, .26, .34), radius=.035, segments=2, material="yellow", loc=(0, 0, .17),
                        name="bag_box")
    band = B.rounded_box((.39, .27, .05), radius=.012, segments=1, material="navy", loc=(0, 0, .25), name="bag_band")
    lid = B.rounded_box((.36, .24, .02), radius=.008, segments=1, material="navy", loc=(0, 0, .345), name="bag_lid")
    handle = B.tube([(-.08, 0, .35), (-.07, 0, .41), (0, 0, .425), (.07, 0, .41), (.08, 0, .35)], .012, segments=6,
                    material="charcoal", name="bag_handle")
    obj = B.join([box, band, lid, handle], "delivery_bag")
    return B.set_origin(obj, (0, 0, .425))


def prop_hanging_scale():
    """Chinese steelyard (gancheng): wooden beam, hanging cord (grip = origin),
    sliding weight and a brass-coloured pan on three strings."""
    B.clear_scene()
    parts = [B.capsule(.012, .52, segments=6, cap_rings=1, radius_end=.008, material="wood", loc=(-.1, 0, -.1),
                       rot=(0, PI / 2, 0), name="scale_beam")]
    parts.append(B.tube([(0, 0, 0), (0, 0, -.1)], .004, segments=4, material="paper", name="scale_cord"))
    parts.append(B.torus(.018, .004, 8, 4, material="paper", loc=(0, 0, .012), rot=(PI / 2, 0, 0),
                         name="scale_loop"))
    parts.append(B.tube([(.3, 0, -.1), (.3, 0, -.16)], .003, segments=4, material="paper", name="scale_weight_cord"))
    parts.append(B.cylinder(.022, .04, verts=8, radius_top=.016, material="slate", loc=(.3, 0, -.18),
                            name="scale_weight"))
    parts.append(B.lathe([(0, -.012), (.06, -.006), (.085, .01), (.08, .012), (.055, .0), (0, -.004)], segments=12,
                         material="metal", loc=(-.08, 0, -.34), name="scale_pan"))
    for i in range(3):
        a = 2 * PI * i / 3 + .3
        parts.append(B.tube([(-.08, 0, -.1), (-.08 + .078 * math.cos(a), .078 * math.sin(a), -.33)], .0025,
                            segments=3, material="paper", name="scale_string"))
    obj = B.join(parts, "hanging_scale")
    return B.set_origin(obj, (0, 0, .03))


def prop_key_ring():
    """Key ring with three keys and a tag. Origin = top of the ring."""
    B.clear_scene()
    parts = [B.torus(.024, .0035, 12, 4, material="metal", rot=(PI / 2, 0, 0), name="keys_ring")]
    pivot = Vector((0, 0, -.024))                      # keys hang from the bottom of the ring
    for a, col in ((-.45, "metal"), (0.0, "yellow"), (.45, "metal")):
        d = Vector((-math.sin(a), 0, -math.cos(a)))
        parts.append(B.cylinder(.011, .004, verts=8, material=col, loc=pivot + d * .012, rot=(PI / 2, 0, 0),
                                name="keys_bow"))
        parts.append(B.box((.007, .003, .045), material=col, loc=pivot + d * .045, rot=(0, a, 0), name="keys_blade"))
        parts.append(B.box((.006, .003, .008), material=col, loc=pivot + d * .058 + Vector((math.cos(a), 0, -math.sin(a))) * .006,
                           rot=(0, a, 0), name="keys_bit"))
    parts.append(B.rounded_box((.022, .004, .032), radius=.003, segments=1, material="red",
                               loc=(.03, 0, -.02), rot=(0, -.5, 0), name="keys_tag"))
    obj = B.join(parts, "key_ring")
    return B.set_origin(obj, (0, 0, .0275))


def prop_shopping_trolley():
    """Auntie's two-wheel shopping trolley (tartan-red bag on a steel frame).
    Origin = centre of the handle grip."""
    B.clear_scene()
    parts = [B.rounded_box((.32, .2, .46), radius=.04, segments=1, material="red", loc=(0, .02, .42),
                           name="trolley_bag")]
    for z in (.3, .5):
        parts.append(B.box((.325, .205, .03), material="navy", loc=(0, .02, z), name="trolley_bag_stripe"))
    parts.append(B.rounded_box((.34, .22, .05), radius=.015, segments=1, material="navy", loc=(0, .02, .67),
                               name="trolley_bag_lid"))
    for sx in (1, -1):
        parts.append(B.tube([(sx * .15, .13, .1), (sx * .15, .14, .7), (sx * .15, .15, .9)], .011, segments=6,
                            material="metal", name="trolley_rail"))
        parts.append(B.cylinder(.085, .035, verts=12, material="charcoal", loc=(sx * .19, .13, .085),
                                rot=(0, PI / 2, 0), name="trolley_wheel"))
        parts.append(B.cylinder(.03, .04, verts=6, material="metal", loc=(sx * .19, .13, .085), rot=(0, PI / 2, 0),
                                name="trolley_hub"))
    parts.append(B.cylinder(.016, .34, verts=8, material="charcoal", loc=(0, .15, .9), rot=(0, PI / 2, 0),
                            name="trolley_grip"))
    parts.append(B.box((.3, .14, .015), material="metal", loc=(0, .03, .19), name="trolley_foot"))
    parts.append(B.tube([(-.19, .13, .085), (.19, .13, .085)], .008, segments=5, material="metal", name="trolley_axle"))
    obj = B.join(parts, "shopping_trolley")
    return B.set_origin(obj, (0, .15, .9))


def prop_smartphone():
    """Smartphone upright, screen facing -Y. Origin = centre (grip)."""
    B.clear_scene()
    shell = B.rounded_box((.075, .01, .15), radius=.008, segments=2, material="charcoal", name="phone_shell")
    screen = B.box((.064, .002, .128), material="glass", loc=(0, -.005, .004), name="phone_screen")
    obj = B.join([shell, screen], "smartphone")
    return B.set_origin(obj, (0, 0, 0))


def prop_folding_fan(ribs=9, r_in=.07, r_out=.23, spread=math.radians(62)):
    """Old Wang's open paper folding fan in the XZ plane, face toward -Y.
    Alternating paper/straw pleats (slight zig-zag), dark guard sticks, brass
    rivet. Origin = rivet at the bottom of the sticks (grip)."""
    B.clear_scene()
    parts = []
    n = ribs - 1
    for i in range(n):
        a0 = -spread + 2 * spread * i / n
        a1 = -spread + 2 * spread * (i + 1) / n
        pts = [(r * math.sin(a), r * math.cos(a)) for r, a in ((r_in, a0), (r_out, a0), (r_out, a1), (r_in, a1))]
        parts.append(B.extrude_profile(pts, .004, material="paper" if i % 2 == 0 else "straw",
                                       loc=(0, .0025 if i % 2 else -.0025, 0), rot=(PI / 2, 0, 0),
                                       name="fan_pleat"))
    for i in range(ribs):
        a = -spread + 2 * spread * i / n
        guard = i in (0, n)
        w, L = (.012, r_out + .01) if guard else (.006, r_in + .01)
        parts.append(B.box((w, .007, L), material="wood_dark", loc=(math.sin(a) * L / 2, -.006 if guard else 0,
                                                                   math.cos(a) * L / 2), rot=(0, a, 0),
                           name="fan_rib"))
    parts.append(B.cylinder(.012, .016, verts=8, material="gold", rot=(PI / 2, 0, 0), name="fan_rivet"))
    obj = B.join(parts, "folding_fan")
    return B.set_origin(obj, (0, 0, 0))


def prop_barcode_scanner():
    """Clerk's handheld barcode scanner gun, nose pointing -Y. Charcoal head,
    slate grip, red scan window, yellow trigger. Origin = middle of the grip."""
    B.clear_scene()
    head = B.rounded_box((.07, .17, .06), radius=.014, segments=2, material="charcoal", loc=(0, -.03, .075),
                         name="scan_head")
    nose = B.rounded_box((.085, .03, .075), radius=.012, segments=1, material="charcoal", loc=(0, -.115, .075),
                         name="scan_nose")
    window = B.box((.062, .006, .045), material="lantern_red", loc=(0, -.132, .075), name="scan_window")
    grip = B.rounded_box((.045, .05, .13), radius=.014, segments=2, material="slate", loc=(0, .02, 0),
                         rot=(math.radians(-14), 0, 0), name="scan_grip")
    trig = B.rounded_box((.02, .025, .035), radius=.006, segments=1, material="yellow", loc=(0, -.025, .03),
                         name="scan_trigger")
    obj = B.join([head, nose, window, grip, trig], "barcode_scanner")
    return B.set_origin(obj, (0, .02, 0))


def prop_umbrella_closed(length=.88):
    """Furled umbrella: pleated navy canopy, metal ferrule + tip, J-hook wood
    handle, strap band. Hangs vertically; origin = grip on the handle's
    straight part (the crook curls toward +X at the top)."""
    B.clear_scene()
    z_tip, z_top = -length + .1, -.12
    rings = [(z_tip + .07, .004, .004), (z_tip + .16, .036, .036), (z_tip + .45, .042, .042),
             (z_top - .05, .024, .024), (z_top, .01, .01)]
    canopy = B.loft(rings, segments=12, material="navy", smooth=False,
                    modulate=lambda th, t: 1.0 + (.18 if int(round(th / (2 * PI) * 12)) % 2 else 0) * (1 - t * .5),
                    name="umb_canopy")
    band = B.cylinder(.04, .03, verts=12, material="charcoal", loc=(0, 0, z_tip + .38), name="umb_strap")
    ferrule = B.cylinder(.006, .1, verts=6, radius_top=.004, material="metal", loc=(0, 0, z_tip + .03),
                         name="umb_ferrule")
    tip = B.cylinder(.009, .02, verts=6, material="metal", loc=(0, 0, z_tip - .01), name="umb_tip")
    shaft = B.cylinder(.007, .08, verts=6, material="metal", loc=(0, 0, z_top + .02), name="umb_shaft")
    crook = B.tube([(0, 0, z_top + .05), (0, 0, .03), (.012, 0, .07), (.045, 0, .085), (.075, 0, .07),
                    (.082, 0, .035)], .015, segments=8, material="wood", name="umb_handle")
    obj = B.join([canopy, band, ferrule, tip, shaft, crook], "umbrella_closed")
    return B.set_origin(obj, (0, 0, 0))


PROPS = [prop_chef_hat, prop_ladle, prop_clipboard, prop_delivery_bag, prop_hanging_scale, prop_key_ring,
         prop_shopping_trolley, prop_smartphone, prop_folding_fan, prop_barcode_scanner, prop_umbrella_closed]
# who uses which held prop (manifest ``used_by``)
PROP_USERS = {"chef_hat": ["cook"], "ladle": ["cook"], "clipboard": ["warehouse_boss"],
              "delivery_bag": ["courier"], "hanging_scale": ["fruit_seller"], "key_ring": ["landlord"],
              "shopping_trolley": ["customer_b"], "smartphone": ["player"], "folding_fan": ["old_wang"],
              "barcode_scanner": ["clerk"], "umbrella_closed": []}


# ==========================================================================
# main
# ==========================================================================
def rig_manifest(name, r):
    """Manifest ``rig`` block (the contract with the game's AnimationMixer)."""
    clips = r["clips"]
    out = {"skeleton": rig.HUMAN_SKELETON if "stride" in r else rig.PET_SKELETON,
           "clips": [c["name"] for c in clips],
           "clip_durations_s": {c["name"]: round(c["duration_s"], 4) for c in clips},
           "loop": {c["name"]: c["loop"] for c in clips}, "fps": rig.FPS}
    if "stride" in r:
        out.update(stride_m=round(r["stride"], 4), step_m=round(r["step"], 4), walk_cycle_s=1.0,
                   walk_speed_mps=round(r["stride"] / 1.0, 4), grip_bones=list(rig.GRIP_BONES), head_top_bone="HeadTop",
                   attach_frame="bone local +Y = world up and +Z = character front in the rest pose (glTF node axes)",
                   rest_arm_deg=r["rest_arm_deg"])
    if "shoulder_out_m" in r:
        out["shoulder_out_m"] = r["shoulder_out_m"]
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith(".glb") or f in ("sheet.png", "manifest.json"):
            os.remove(os.path.join(OUT, f))
    assert_distinct(SPEC)
    order, report, entries = [], [], []

    bpy.context.scene.render.fps = rig.FPS

    def ship(obj, kind, extra="", anchors=None, origin="feet"):
        r = RIG.get(obj.name)
        info = export.export_glb(obj, os.path.join(OUT, obj.name + ".glb"), armature=r["arm"] if r else None)
        order.append(obj.name + ".glb")
        lo, hi = B.bbox(obj)
        entries.append({"name": obj.name, "kind": kind, "file": obj.name + ".glb", "tris": info["tris"],
                        "size_m": [round(v, 3) for v in info["bbox"]], "origin": origin,
                        "anchors": anchors if anchors is not None else {"top": [0.0, round(hi.z, 4), 0.0]}})
        if r:
            entries[-1]["rig"] = rig_manifest(obj.name, r)
        report.append("%-18s %-7s tris=%4d height=%.3f %s" % (obj.name, kind, info["tris"], info["bbox"][1], extra))
        return info

    for spec in SPEC:
        obj, h = make_human(spec)
        tris, top = check_human(obj, h, spec["name"])
        head_top = HEAD_TOP[spec["name"]]
        assert abs(head_top - spec["height"]) < 1e-3, "%s head top %.3f != %.2f" % (spec["name"], head_top,
                                                                                    spec["height"])
        ship(obj, "human", "head_top=%.3f (spec %.2f)" % (head_top, spec["height"]),
             anchors={"head_top": [0.0, round(head_top, 4), 0.0], "top": [0.0, round(top, 4), 0.0]})
    base = next(s for s in SPEC if s["name"] == "customer_a")
    for rname, colour in RECOLOURS.items():
        obj, h = make_human(base, torso_override=colour, out_name=rname)
        tris, top = check_human(obj, h, rname)
        ship(obj, "recolour", "head_top=%.3f torso=%s" % (HEAD_TOP[rname], colour),
             anchors={"head_top": [0.0, round(HEAD_TOP[rname], 4), 0.0], "top": [0.0, round(top, 4), 0.0]})
    for fn, h in ((make_cat, .35), (make_dog, .4), (make_pigeon, .25)):
        obj = fn()
        t = B.tri_count(obj)
        assert t <= PET_TRIS, "%s tris %d > %d" % (obj.name, t, PET_TRIS)
        top = B.bbox(obj)[1].z
        assert abs(top - h) / h <= .02, "%s height %.3f vs %.2f" % (obj.name, top, h)
        ship(obj, "pet", "(spec %.2f)" % h)
    for fn in PROPS:
        obj = fn()
        t = B.tri_count(obj)
        assert t <= PROP_TRIS, "%s tris %d > %d" % (obj.name, t, PROP_TRIS)
        worn = obj.name == "chef_hat"
        ship(obj, "prop", "origin=grip" if not worn else "origin=base", origin="feet" if worn else "grip",
             anchors={"grip": [0.0, 0.0, 0.0]} if not worn else {})
        entries[-1]["used_by"] = PROP_USERS[obj.name]
    assert len(order) == 29, len(order)
    M.write(OUT, entries)
    print("SUMMARY %d GLBs in %s" % (len(order), OUT))
    for line in report:
        print("ASSET " + line)
    sheet.render_sheet(OUT, os.path.join(OUT, "sheet.png"), cols=7, true_scale=False, files=order)


if __name__ == "__main__":
    main()
