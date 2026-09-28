"""Player-only silhouette and material refinement, before the shared rig stage.

No textures or runtime effects; the shared skeleton and clips remain authoritative.
"""
import bpy
from lib import build as B


def soften_joints(obj, joints):
    """Blend knee/elbow support rings to remove rigid creases during movement."""
    for side in ("Left", "Right"):
        for upper, lower, start, hinge, width in (
            ("UpLeg", "Leg", "_hip", "_knee", .065),
            ("Arm", "ForeArm", "_sh", "_elbow", .055),
        ):
            a, b = obj.vertex_groups[side + upper], obj.vertex_groups[side + lower]
            joint = joints[side + hinge]
            axis = (joints[side + start] - joint).normalized()
            for v in obj.data.vertices:
                if not any(g.group in (a.index, b.index) for g in v.groups):
                    continue
                distance = (v.co - joint).dot(axis)
                if abs(distance) >= width:
                    continue
                t = (distance / width + 1) * .5
                t = t * t * (3 - 2 * t)
                a.add([v.index], t, "REPLACE")
                b.add([v.index], 1 - t, "REPLACE")


def polish(fig, body, hair_shell):
    k = body.k
    # Replace broad silhouettes instead of applying subdivision to the whole rig.
    replace = {"head_blank", "torso", "hair_cap", "shoe", "shoe_l", "leg", "leg_l", "hoodie_pocket"}
    for p in list(fig.parts):
        if p.name in replace:
            fig.parts.remove(p)
            bpy.data.objects.remove(p, do_unlink=True)
    fig.add(B.sphere(body.head_r, segments=24, rings=14, exponent=2.25,
                     material="skin_mid", loc=body.head_c, name="head_blank"), "head")
    fig.add(hair_shell(body, "mc_hair", .50, -.42, segments=28, rings=14,
                       top=1.08, name="hair_cap"), "hair")
    # Keep the sweatshirt outside the hips all the way to its hem.
    # The generic tapered shirt intersects the tops of the player's jeans.
    controls = [(body.ctrl[1][0] - .008 * k, .163 * k, .124 * k),
                (body.ctrl[1][0], .170 * k, .130 * k)] + list(body.ctrl[2:])
    rings = B.catmull(controls, 2)
    fig.add(B.loft(rings, segments=24, exponent=body.TORSO_EXP,
                   material="mc_fleece", name="torso"), "body")
    # Tonal ribbed hem: a shaped band with rounded transitions, no bright outline.
    def surface(z):
        for a, b in zip(rings, rings[1:]):
            if a[0] <= z <= b[0]:
                t = (z - a[0]) / (b[0] - a[0])
                return (a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)
        return body.profile(z)
    z = body.ctrl[1][0]
    hem = []
    for dz, inflate in ((-.004, .002), (.004, .006), (.035, .006), (.044, .002)):
        rx, ry = surface(z + dz * k)
        hem.append((z + dz * k, rx + inflate * k, ry + inflate * k))
    fig.add(B.loft(hem, segments=24, exponent=body.TORSO_EXP,
                   material="mc_rib", name="trim_hem"), "outfit")
    pocket = []
    for i in range(4):
        zp = body.ctrl[2][0] + (.015 + .12 * i / 3) * k
        rx, ry = surface(zp)
        pocket.append((zp, rx + .006 * k, ry + .009 * k))
    fig.add(B.loft(pocket, segments=14, exponent=body.TORSO_EXP,
                   arc=(-2.30, -.84), thickness=.004 * k,
                   material="mc_fleece", name="hoodie_pocket"), "outfit")
    (zt, rt), (zk, rk), (za, ra) = body.leg
    sw, sl, sh = body.shoe
    for side in (-1, 1):
        x = side * body.leg_x
        rings = [(sh * .7, ra * .94, ra), (za, ra, ra),
                 (zk - .035 * k, rk * .97, rk), (zk, rk, rk),
                 (zk + .045 * k, rk * 1.04, rk * 1.02),
                 (zt, rt * .78, rt * .90), (zt + .03 * k, rt * .62, rt * .72),
                 (zt + .04 * k, 0, 0)]
        parts = [B.loft(rings, segments=14, material="mc_denim", loc=(x, 0, 0), name="leg")]
        # Two soft layers give sneakers a readable sole and upper at game scale.
        parts.append(B.rounded_box((sw, sl, sh * .30), radius=sh * .13,
                      segments=3, material="mc_ivory", loc=(x, -sl * .16, sh * .15), name="shoe_sole"))
        parts.append(B.rounded_box((sw * .94, sl * .94, sh * .75), radius=sh * .29,
                      segments=3, material="mc_ivory", loc=(x, -sl * .14, sh * .61), name="shoe_upper"))
        parts.append(B.rounded_box((sw * .50, sl * .24, sh * .14), radius=sh * .06,
                      segments=2, material="mc_rib", loc=(x, sl * .16, sh * .82), name="shoe_collar"))
        for p in parts:
            p["limb"], p["side"] = "leg", side
            fig.add(p, "body")
    remap = {"cloth_grey": "mc_fleece", "denim": "mc_denim", "navy": "mc_pack",
             "charcoal": "mc_pack", "cloth_white": "mc_ivory", "hair_black": "mc_hair"}
    for p in fig.parts:
        for slot in p.material_slots:
            if slot.material and slot.material.name in remap:
                slot.material = B.mat(remap[slot.material.name])
        if p.name.startswith("cuff"):
            p.data.materials.clear()
            p.data.materials.append(B.mat("mc_rib"))
        # Smooth only small rounded fabric pieces; preserve limb ring positions.
        if p.name.startswith("hood_down") or p.name in ("backpack", "backpack_pocket"):
            mod = p.modifiers.new("Soft fabric edges", "SUBSURF")
            mod.levels = mod.render_levels = 1
            B.apply_all(p)
    for name, roughness in (("mc_fleece", .88), ("mc_rib", .94), ("mc_denim", .90),
                            ("mc_pack", .83), ("mc_ivory", .66), ("mc_hair", .58)):
        m = B.mat(name)
        m.roughness = roughness
        m.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = roughness
