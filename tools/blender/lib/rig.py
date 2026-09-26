"""Procedural rigging + baked animation clips (Blender 4.2, headless-safe).

Chunky low-poly characters are rigged with RIGID weights: every vertex has
weight 1.0 on exactly one bone. Limb meshes are continuous lofts, so bending
shears the segment next to a joint instead of opening a gap.

Pipeline (see sets/characters.py):

    arm = build_armature(name, bone_specs)      # edit-mode bones from joint points
    bind_rigid(mesh, arm, labels)               # labels[i] = bone for vertex i
    sk = Skeleton(arm)                          # rest data for FK / IK maths
    bake_clip(arm, sk, "walk", frames, pose_fn) # one action per clip, pushed to NLA

Pose functions return ``(R, hips_offset)``: ``R[bone]`` is a Quaternion
rotation expressed in ARMATURE axes (Blender: X = character's left, -Y = front,
Z = up), applied about the bone head, relative to its parent's posed frame.
``bake_clip`` converts to bone-local quaternions. ``Skeleton.fk`` / ``ik2``
give posed joint positions and analytic two-bone IK (planted feet, carry hands).

Export with ``lib.export.export_glb(mesh, path, armature=arm)``: skins +
every action as a named glTF animation. Clips start at frame 0, so glTF clip
duration = last_frame / fps and loops have first == last frame.
"""
import math

import bpy
from mathutils import Matrix, Quaternion, Vector

FPS = 24
PI = math.pi
HUMAN_SKELETON = "st-human-v1"
PET_SKELETON = "st-pet-v1"

# Mixamo-like human skeleton: (name, parent). Left = character's left = +X.
HUMAN_BONES = [
    ("Hips", None), ("Spine", "Hips"), ("Chest", "Spine"), ("Neck", "Chest"), ("Head", "Neck"),
    ("LeftShoulder", "Chest"), ("LeftArm", "LeftShoulder"), ("LeftForeArm", "LeftArm"), ("LeftHand", "LeftForeArm"),
    ("RightShoulder", "Chest"), ("RightArm", "RightShoulder"), ("RightForeArm", "RightArm"),
    ("RightHand", "RightForeArm"),
    ("LeftUpLeg", "Hips"), ("LeftLeg", "LeftUpLeg"), ("LeftFoot", "LeftLeg"),
    ("RightUpLeg", "Hips"), ("RightLeg", "RightUpLeg"), ("RightFoot", "RightLeg"),
]
# Attachment leaf bones (non-deforming, no vertices) for held props / speech bubbles.
HUMAN_ATTACH = [("LeftHandGrip", "LeftHand"), ("RightHandGrip", "RightHand"), ("HeadTop", "Head")]
HUMAN_BONE_NAMES = [n for n, _ in HUMAN_BONES + HUMAN_ATTACH]
GRIP_BONES = ["RightHandGrip", "LeftHandGrip"]
PET_BONES = [("Root", None), ("Spine", "Root"), ("Head", "Spine"), ("Tail", "Spine")]
PET_BONE_NAMES = [n for n, _ in PET_BONES]

HUMAN_CLIPS = ("idle", "walk", "talk", "carry_idle", "carry_walk")
PET_CLIPS = ("idle",)


# --------------------------------------------------------------------------
# armature build + rigid bind
# --------------------------------------------------------------------------
def build_armature(name, specs, data_name=None):
    """specs: list of dicts {name, head, tail, parent, deform=True, align_z=None}
    in parent-first order (Blender armature space == world, object at origin).
    ``align_z`` rolls the bone so its local Z axis points along that vector."""
    data = bpy.data.armatures.new(data_name or name)
    arm = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(arm)
    for o in bpy.context.scene.objects:
        o.select_set(False)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    ebs = {}
    for s in specs:
        eb = data.edit_bones.new(s["name"])
        eb.head = Vector(s["head"])
        eb.tail = Vector(s["tail"])
        if s.get("align_z") is not None:
            eb.align_roll(Vector(s["align_z"]))
        eb.use_deform = s.get("deform", True)
        ebs[s["name"]] = eb
    for s in specs:
        if s.get("parent"):
            ebs[s["name"]].parent = ebs[s["parent"]]
            ebs[s["name"]].use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
    return arm


def bind_rigid(mesh, arm, labels):
    """Parent ``mesh`` to ``arm`` with an Armature modifier; vertex i gets weight
    1.0 on bone ``labels[i]`` (rigid skinning)."""
    assert len(labels) == len(mesh.data.vertices), (len(labels), len(mesh.data.vertices))
    names = [b.name for b in arm.data.bones if b.use_deform]
    missing = sorted(set(labels) - set(names))
    assert not missing, "labels reference unknown/non-deform bones: %s" % missing
    groups = {n: mesh.vertex_groups.new(name=n) for n in names}
    by_bone = {}
    for i, n in enumerate(labels):
        by_bone.setdefault(n, []).append(i)
    for n, idx in by_bone.items():
        groups[n].add(idx, 1.0, "REPLACE")
    mesh.parent = arm
    mesh.matrix_parent_inverse = Matrix.Identity(4)
    mod = mesh.modifiers.new("rig", "ARMATURE")
    mod.object = arm
    mod.use_vertex_groups = True
    return {n: len(v) for n, v in by_bone.items()}


# --------------------------------------------------------------------------
# rest data + forward / inverse kinematics in armature space
# --------------------------------------------------------------------------
class Skeleton:
    """Rest-pose data of an armature for pose maths."""

    def __init__(self, arm):
        self.arm = arm
        self.order = [b.name for b in arm.data.bones]          # parents come first
        self.parent = {b.name: (b.parent.name if b.parent else None) for b in arm.data.bones}
        self.head = {b.name: b.head_local.copy() for b in arm.data.bones}
        self.tail = {b.name: b.tail_local.copy() for b in arm.data.bones}
        self.rest_q = {b.name: b.matrix_local.to_quaternion() for b in arm.data.bones}
        self.rest3 = {b.name: b.matrix_local.to_3x3() for b in arm.data.bones}
        self.root = next(n for n in self.order if self.parent[n] is None)

    def dir(self, a, b):
        """Unit rest direction from bone a's head to bone b's head."""
        return (self.head[b] - self.head[a]).normalized()

    def length(self, a, b):
        return (self.head[b] - self.head[a]).length

    def fk(self, R, offset=None):
        """Posed motion matrices P[bone] (armature space: rest -> posed)."""
        P = {}
        for n in self.order:
            h = self.head[n]
            D = Matrix.Translation(h) @ R.get(n, Quaternion()).to_matrix().to_4x4() @ Matrix.Translation(-h)
            p = self.parent[n]
            if p is None:
                P[n] = Matrix.Translation(offset or Vector()) @ D
            else:
                P[n] = P[p] @ D
        return P

    def pos(self, P, bone, point=None):
        """Posed position of ``point`` (default: bone head) carried by ``bone``."""
        return P[bone] @ (self.head[bone] if point is None else Vector(point))


def swing(d, f, angle):
    """Rotation turning unit direction ``d`` towards ``f`` by ``angle`` (radians)
    about the axis d x f (a hinge perpendicular to both)."""
    ax = Vector(d).cross(Vector(f))
    if ax.length < 1e-9:
        return Quaternion()
    return Quaternion(ax.normalized(), angle)


def axis(v, angle):
    return Quaternion(Vector(v).normalized(), angle)


def ik2(sk, R, upper, lower, end, target, hint, end_abs=None, offset=None):
    """Analytic two-bone IK. Sets R[upper], R[lower] (and R[end] when
    ``end_abs`` = wanted absolute rotation of the end bone) so the head of
    ``end`` reaches ``target``, bending towards ``hint``. Parents of ``upper``
    must already be set in R."""
    P = sk.fk(R, offset)
    parent = sk.parent[upper]
    Ap = P[parent].to_quaternion()
    root = P[parent] @ sk.head[upper]
    L1, L2 = sk.length(upper, lower), sk.length(lower, end)
    d = Vector(target) - root
    dist = max(min(d.length, (L1 + L2) * 0.9995), abs(L1 - L2) * 1.001 + 1e-6)
    u = d.normalized()
    ca = max(-1.0, min(1.0, (L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist)))
    sa = math.sqrt(max(0.0, 1 - ca * ca))
    w = Vector(hint) - u * Vector(hint).dot(u)
    w = w.normalized() if w.length > 1e-9 else Vector((0, -1, 0))
    mid = root + (u * ca + w * sa) * L1
    tip = root + u * dist
    A1 = sk.dir(upper, lower).rotation_difference((mid - root).normalized())
    cur = A1 @ sk.dir(lower, end)
    A2 = cur.rotation_difference((tip - mid).normalized()) @ A1
    R[upper] = Ap.inverted() @ A1
    R[lower] = A1.inverted() @ A2
    if end_abs is not None:
        R[end] = A2.inverted() @ end_abs
    return A2


def absolute(sk, R, bone, offset=None):
    """Absolute (armature-axes) rotation of ``bone`` for pose R."""
    return sk.fk(R, offset)[bone].to_quaternion()


# --------------------------------------------------------------------------
# baking
# --------------------------------------------------------------------------
def _to_local(sk, name, q):
    rq = sk.rest_q[name]
    return rq.inverted() @ q @ rq


def bake_clip(arm, sk, name, frames, pose_fn, bones=None, loop=True):
    """Key ``frames`` + 1 frames (0..frames) of ``pose_fn(phase in [0,1))`` into
    a new action ``name`` (quaternion per bone, location on the root) and push
    it to its own NLA track. For loops the last frame is a copy of frame 0."""
    old = bpy.data.actions.get(name)
    if old is not None:
        bpy.data.actions.remove(old)
    bones = bones or [n for n in sk.order if arm.data.bones[n].use_deform]
    samples = []
    for f in range(frames + 1):
        if loop and f == frames:
            samples.append(samples[0])
            continue
        R, off = pose_fn(f / frames)
        loc = sk.rest3[sk.root].inverted() @ (off or Vector())
        qs = {}
        for n in bones:
            q = _to_local(sk, n, R.get(n, Quaternion()))
            if samples and samples[-1][0][n].dot(q) < 0:       # keep quaternion hemisphere continuous
                q = -q
            qs[n] = q
        samples.append((qs, loc))
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    act.id_root = "OBJECT"
    n_keys = len(samples)

    def curve(path, index, group, values):
        fc = act.fcurves.new(path, index=index, action_group=group)
        fc.keyframe_points.add(n_keys)
        co = []
        for f, v in enumerate(values):
            co += [float(f), float(v)]
        fc.keyframe_points.foreach_set("co", co)
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"
        fc.update()

    for n in bones:
        path = 'pose.bones["%s"].rotation_quaternion' % n
        for i in range(4):
            curve(path, i, n, [s[0][n][i] for s in samples])
    for i in range(3):
        curve('pose.bones["%s"].location' % sk.root, i, sk.root, [s[1][i] for s in samples])
    act.use_frame_range = True
    act.frame_start, act.frame_end = 0, frames
    ad = arm.animation_data or arm.animation_data_create()
    track = ad.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, 0, act)
    strip.name = name
    track.mute = True
    ad.action = None
    return {"name": name, "frames": frames, "duration_s": frames / FPS, "loop": loop}


# --------------------------------------------------------------------------
# human clips
# --------------------------------------------------------------------------
class HumanMotion:
    """Clip generators for the shared human skeleton. ``height`` scales every
    distance (stride, bob, sway) so the kid uses the same code."""

    def __init__(self, sk, height):
        self.sk = sk
        self.k = height / 1.7
        self.step = 0.30 * self.k          # foot travel during one stance (= one step)
        self.stride = 2 * self.step        # distance per 1 s cycle (2 steps)
        self.lift = 0.075 * self.k
        self.leg_len = {s: sk.length(s + "UpLeg", s + "Leg") + sk.length(s + "Leg", s + "Foot")
                        for s in ("Left", "Right")}
        self.ankle = {s: sk.head[s + "Foot"].copy() for s in ("Left", "Right")}
        self.arm_dir = {s: sk.dir(s + "Arm", s + "ForeArm") for s in ("Left", "Right")}
        self.fore_dir = {s: sk.dir(s + "ForeArm", s + "Hand") for s in ("Left", "Right")}
        self.side = {"Left": 1.0, "Right": -1.0}
        self.fwd = Vector((0, -1, 0))
        self.up = Vector((0, 0, 1))

    # -- building blocks ------------------------------------------------------
    def torso(self, R, lean=0.0, hips_yaw=0.0, hips_roll=0.0, spine_yaw=0.0, chest_yaw=0.0, chest_pitch=0.0,
              neck_pitch=0.0, head_pitch=0.0, head_yaw=0.0):
        up, f = self.up, self.fwd
        R["Hips"] = axis((0, 0, 1), hips_yaw) @ axis((0, 1, 0), hips_roll)
        R["Spine"] = axis((0, 0, 1), spine_yaw) @ swing(up, f, lean * .5)
        R["Chest"] = axis((0, 0, 1), chest_yaw) @ swing(up, f, lean * .5 + chest_pitch)
        R["Neck"] = swing(up, f, neck_pitch)
        R["Head"] = axis((0, 0, 1), head_yaw) @ swing(up, f, head_pitch)

    def legs_planted(self, R, off, targets=None, foot_abs=None):
        """IK both legs so the ankles sit at ``targets`` (default: rest ankles)."""
        for s in ("Left", "Right"):
            tgt = (targets or {}).get(s, self.ankle[s])
            fa = (foot_abs or {}).get(s, Quaternion())
            ik2(self.sk, R, s + "UpLeg", s + "Leg", s + "Foot", tgt, self.fwd + Vector((0, 0, .15)),
                end_abs=fa, offset=off)

    def arm_hang(self, R, s, fwd_swing=0.0, out=0.0, elbow=0.0, shrug=0.0):
        """FK arm: swing forward (+) / back (-) in the sagittal plane, out = abduction,
        elbow = forward forearm bend."""
        d = self.arm_dir[s]
        R[s + "Shoulder"] = axis((0, 1, 0), -self.side[s] * shrug)
        R[s + "Arm"] = swing(d, self.fwd, fwd_swing) @ axis((0, 1, 0), -self.side[s] * out)
        R[s + "ForeArm"] = swing(self.fore_dir[s], self.fwd, elbow)
        R[s + "Hand"] = Quaternion()

    def arms_carry(self, R, off, bob=0.0):
        """Forearms up in front of the chest, palms facing in (holding a box)."""
        sk = self.sk
        P = sk.fk(R, off)
        for s in ("Left", "Right"):
            sh = sk.head[s + "Arm"]
            ry = self.front_ry
            rest_t = Vector((self.side[s] * max(abs(sh.x) * .92, .12 * self.k), -(ry + .075 * self.k),
                             sh.z - .16 * self.k + bob))
            tgt = P["Chest"] @ rest_t
            hint = Vector((self.side[s] * .9, .7, -1.0))
            R[s + "Shoulder"] = axis(self.fwd, 0.0)
            chest_q = P["Chest"].to_quaternion()
            hand_abs = chest_q @ self.fore_dir[s].rotation_difference((self.fwd + Vector((0, 0, .2))).normalized())
            ik2(sk, R, s + "Arm", s + "ForeArm", s + "Hand", tgt, chest_q @ hint, end_abs=hand_abs, offset=off)

    # -- clips ----------------------------------------------------------------
    def idle(self, ph, carry=False):
        k, R = self.k, {}
        w = 2 * math.pi * ph
        breath = math.sin(2 * w)
        off = Vector((.011 * k * math.sin(w), 0, -.012 * k - .002 * k * breath))
        self.torso(R, lean=math.radians(1.0), hips_roll=math.radians(1.2) * math.sin(w),
                   spine_yaw=math.radians(1.0) * math.sin(w + .6),
                   chest_pitch=-math.radians(1.3) * breath, head_yaw=math.radians(5) * math.sin(w + 1.1),
                   head_pitch=math.radians(1.5) * math.sin(2 * w + .5), neck_pitch=math.radians(1.0))
        if carry:
            self.arms_carry(R, off, bob=.004 * k * breath)
        else:
            for s in ("Left", "Right"):
                self.arm_hang(R, s, fwd_swing=math.radians(2.0) * math.sin(w + (0 if s == "Left" else PI)),
                              elbow=math.radians(8), shrug=math.radians(1.2) * breath)
        self.legs_planted(R, off)
        return R, off

    def _walk_feet(self, ph):
        targets, feet = {}, {}
        for s, lag in (("Left", 0.0), ("Right", 0.5)):
            psi = (ph + lag) % 1.0
            a = self.ankle[s]
            if psi < 0.5:                                   # stance: planted, sliding back linearly
                y = -self.step / 2 + self.step * psi / 0.5
                z = a.z
                pitch = 0.0
            else:                                           # swing: lift and bring forward
                u = (psi - 0.5) / 0.5
                y = self.step / 2 - self.step * (0.5 - 0.5 * math.cos(PI * u))
                z = a.z + self.lift * math.sin(PI * u)
                pitch = math.radians(25) * math.sin(PI * u) * (u - 0.4)     # toe down at lift-off, up at strike
            targets[s] = Vector((a.x, a.y + y, z))
            feet[s] = swing(self.fwd, self.up, pitch)
        return targets, feet

    def walk(self, ph, carry=False):
        k, R = self.k, {}
        w = 2 * math.pi * ph
        c2 = math.cos(2 * w)
        off = Vector((.014 * k * math.sin(w), 0, -.014 * k - .02 * k * (0.5 + 0.5 * c2)))
        tw = 0.35 if carry else 1.0
        self.torso(R, lean=math.radians(2.5 if carry else 4.0), hips_yaw=-math.radians(6) * math.cos(w) * tw,
                   hips_roll=-math.radians(2.5) * math.sin(w), spine_yaw=math.radians(3) * math.cos(w) * tw,
                   chest_yaw=math.radians(6) * math.cos(w) * tw, chest_pitch=-math.radians(4 if carry else 0),
                   head_yaw=-math.radians(3) * math.cos(w) * tw, head_pitch=math.radians(1.5) * c2)
        if carry:
            self.arms_carry(R, off, bob=.004 * k * c2)
        else:
            for s in ("Left", "Right"):
                # left arm forward when the right leg is forward (ph = .5)
                sw = math.radians(20) * (-math.cos(w) if s == "Left" else math.cos(w))
                self.arm_hang(R, s, fwd_swing=sw, out=math.radians(1.5),
                              elbow=math.radians(10) + .7 * max(0.0, sw))
        targets, feet = self._walk_feet(ph)
        self.legs_planted(R, off, targets, feet)
        return R, off

    def talk(self, ph):
        k, R = self.k, {}
        w = 2 * math.pi * ph
        off = Vector((.006 * k * math.sin(w), 0, -.012 * k))
        nod = math.sin(3 * w)
        self.torso(R, lean=math.radians(3), hips_roll=math.radians(.8) * math.sin(w),
                   chest_yaw=math.radians(4) + math.radians(2) * math.sin(w),
                   head_pitch=math.radians(6) * nod + math.radians(2), head_yaw=math.radians(-6) + math.radians(4) * math.sin(w),
                   neck_pitch=math.radians(2) * nod)
        self.arm_hang(R, "Left", fwd_swing=math.radians(3), elbow=math.radians(10))
        beat = math.sin(4 * w)
        self.arm_hang(R, "Right", fwd_swing=math.radians(14) + math.radians(5) * math.sin(2 * w),
                      out=math.radians(6), elbow=math.radians(88) + math.radians(12) * beat)
        # open palm turned up + wrist flick on the beats
        R["RightHand"] = axis(self.fore_dir["Right"], math.radians(-65)) @ swing(
            self.fore_dir["Right"], self.up, math.radians(12) * beat)
        self.legs_planted(R, off)
        return R, off

    def clips(self):
        return {
            "idle": (4 * FPS, self.idle),
            "walk": (FPS, self.walk),
            "talk": (2 * FPS, self.talk),
            "carry_idle": (4 * FPS, lambda ph: self.idle(ph, carry=True)),
            "carry_walk": (FPS, lambda ph: self.walk(ph, carry=True)),
        }


def bake_human(arm, height, front_ry):
    """Bake all five human clips. Returns (clip infos, motion)."""
    sk = Skeleton(arm)
    m = HumanMotion(sk, height)
    m.front_ry = front_ry
    out = []
    for name in HUMAN_CLIPS:
        frames, fn = m.clips()[name]
        out.append(bake_clip(arm, sk, name, frames, fn))
    return out, m


def measure_stride(arm, sk, motion, action_name="walk"):
    """Evaluate the baked walk in Blender and return (stride_m, max_foot_slip_m).
    stride = distance the body travels per cycle for planted feet = foot speed
    during stance * cycle length."""
    ad = arm.animation_data
    prev = ad.action
    for t in ad.nla_tracks:
        t.mute = True
    ad.action = bpy.data.actions[action_name]
    act = ad.action
    n = int(act.frame_end)
    scene = bpy.context.scene
    ys = []
    for f in range(n + 1):
        scene.frame_set(f)
        ys.append(arm.pose.bones["LeftFoot"].head.copy())
    ad.action = prev
    scene.frame_set(0)
    for pb in arm.pose.bones:
        pb.rotation_quaternion = Quaternion()
        pb.location = Vector()
    # stance of the left foot: frames 0 .. n/2 (planted, z at rest ankle)
    half = n // 2
    stance = ys[:half + 1]
    speed = (stance[-1].y - stance[0].y) / (half / FPS)
    z0 = sk.head["LeftFoot"].z
    slip = max(abs(p.z - z0) for p in stance)
    return speed * (n / FPS), slip


# --------------------------------------------------------------------------
# pets
# --------------------------------------------------------------------------
def bake_pet(arm, tail_amp=math.radians(18)):
    sk = Skeleton(arm)
    up = Vector((0, 0, 1))

    def idle(ph):
        w = 2 * math.pi * ph
        R = {"Root": Quaternion(),
             "Spine": swing(up, Vector((0, -1, 0)), math.radians(1.8) * math.sin(2 * w)),
             "Head": axis((0, 0, 1), math.radians(7) * math.sin(w)) @ axis((1, 0, 0), math.radians(3) * math.sin(2 * w + .7)),
             "Tail": axis((0, 0, 1), tail_amp * math.sin(2 * w))}
        return R, Vector()
    return [bake_clip(arm, sk, "idle", 2 * FPS, idle)]
