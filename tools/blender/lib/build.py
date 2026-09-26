"""Procedural modelling helpers shared by every asset set.

Conventions
-----------
* Blender units = metres, Z up, **front = -Y** (exports to glTF +Z forward, +Y up).
* Every primitive returns a new mesh *object* ("part") linked to the scene, with
  one palette material. Parts keep their placement in the object transform
  (``loc``/``rot``/``scale`` kwargs); ``join()`` bakes transforms and merges.
* Data API + bmesh only (no bpy.ops) so everything is headless-safe.

Common keyword arguments accepted by every primitive (``**kw``):
    material   palette colour name (see palette.py), default "metal"
    name       object name (default: primitive name)
    loc        (x, y, z) location, default origin
    rot        (x, y, z) Euler XYZ radians
    scale      (x, y, z) or scalar
    smooth     True -> smooth shading with sharp edges above ``smooth_angle``
    smooth_angle  radians, default 50 degrees
    bevel      bevel width in metres applied to edges sharper than 30 degrees
    bevel_segments  bevel segments (default 1)
    thickness  for open surfaces (loft with ``arc``): solidify outward by this
"""
import math

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

from . import palette

DEFAULT_SMOOTH_ANGLE = math.radians(50)


# --------------------------------------------------------------------------
# scene + materials
# --------------------------------------------------------------------------
def clear_scene():
    """Delete every object and orphan datablock (meshes, materials, cameras,
    armatures, actions, ...)."""
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.curves, bpy.data.cameras,
                 bpy.data.lights, bpy.data.images, bpy.data.fonts, bpy.data.armatures, bpy.data.actions):
        for item in list(coll):
            if coll is bpy.data.fonts and item.users:
                continue
            coll.remove(item)
    for coll in list(bpy.data.collections):
        bpy.data.collections.remove(coll)


def mat(name):
    """Get or create the flat material for palette colour ``name``.

    Sets both the Principled base colour (exported to glTF) and the viewport
    diffuse colour (used by Workbench contact sheets). Roughness 0.9, no metal.
    """
    m = bpy.data.materials.get(name)
    if m is not None:
        return m
    rgba = palette.colour(name)
    m = bpy.data.materials.new(name)
    m.diffuse_color = rgba
    m.roughness = 0.9
    m.metallic = 0.0
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = 0.9
    bsdf.inputs["Metallic"].default_value = 0.0
    return m


# --------------------------------------------------------------------------
# internal bmesh plumbing
# --------------------------------------------------------------------------
def _bevel_bm(bm, width, segments=1, angle=math.radians(30)):
    edges = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > angle]
    if edges and width > 0:
        bmesh.ops.bevel(bm, geom=edges, offset=width, offset_type="OFFSET", segments=segments,
                        profile=0.5, affect="EDGES", clamp_overlap=True)


def _shade_bm(bm, smooth, angle=DEFAULT_SMOOTH_ANGLE):
    for f in bm.faces:
        f.smooth = bool(smooth)
    if smooth:
        for e in bm.edges:
            if len(e.link_faces) == 2:
                e.smooth = e.calc_face_angle(0.0) <= angle
            else:
                e.smooth = True


def _as_vec3(v):
    if isinstance(v, (int, float)):
        return Vector((v, v, v))
    return Vector(v)


def _finish(bm, kw, default_name, default_smooth=False):
    """Turn a bmesh into a scene object applying the common kwargs."""
    thickness = kw.get("thickness")
    if thickness:
        bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=-thickness)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-6)
    if kw.get("bevel"):
        _bevel_bm(bm, kw["bevel"], kw.get("bevel_segments", 1))
    _shade_bm(bm, kw.get("smooth", default_smooth), kw.get("smooth_angle", DEFAULT_SMOOTH_ANGLE))
    name = kw.get("name", default_name)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat(kw.get("material", "metal")))
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = Vector(kw.get("loc", (0, 0, 0)))
    obj.rotation_euler = Euler(kw.get("rot", (0, 0, 0)), "XYZ")
    obj.scale = _as_vec3(kw.get("scale", 1.0))
    return obj


def _superellipse(theta, rx, ry, exponent):
    c, s = math.cos(theta), math.sin(theta)
    p = 2.0 / exponent
    return (rx * math.copysign(abs(c) ** p, c), ry * math.copysign(abs(s) ** p, s))


# --------------------------------------------------------------------------
# primitives
# --------------------------------------------------------------------------
def loft(rings, segments=12, exponent=2.0, arc=None, closed=False, cap_start=True, cap_end=True,
         modulate=None, **kw):
    """Skin a sequence of cross-section rings along +Z. The workhorse primitive.

    rings     list of (z, rx, ry[, ox, oy]); rx/ry are the semi-axes of an
              ellipse/superellipse at height z, centred at (ox, oy). A ring with
              rx == ry == 0 is a pole (rounded tip).
    segments  vertices per ring.
    exponent  superellipse exponent: 2 = ellipse, 3-4 = rounded box section.
    arc       (a0, a1) radians -> open partial surface (e.g. an apron sheet,
              an open-front vest). theta=0 is +X, -pi/2 is the front (-Y).
    closed    connect last ring back to first (torus-like tubes); no caps.
    modulate  f(theta, t) -> radial factor; t = ring index / (n-1). Used for
              pleats, quilting, perm curls.
    Default smooth shading.
    """
    bm = bmesh.new()
    if arc is None:
        thetas = [2 * math.pi * i / segments for i in range(segments)]
    else:
        thetas = [arc[0] + (arc[1] - arc[0]) * i / segments for i in range(segments + 1)]
    n = len(rings)
    grid = []
    for ri, ring in enumerate(rings):
        z, rx, ry = ring[0], ring[1], ring[2]
        ox, oy = (ring[3], ring[4]) if len(ring) >= 5 else (0.0, 0.0)
        if rx <= 1e-7 and ry <= 1e-7:
            grid.append([bm.verts.new((ox, oy, z))])
            continue
        t = ri / max(1, n - 1)
        row = []
        for th in thetas:
            x, y = _superellipse(th, rx, ry, exponent)
            if modulate:
                f = modulate(th, t)
                x, y = x * f, y * f
            row.append(bm.verts.new((ox + x, oy + y, z)))
        grid.append(row)
    m = len(thetas)
    wrap = arc is None
    pairs = list(zip(range(n - 1), range(1, n)))
    if closed:
        pairs.append((n - 1, 0))
    for a, b in pairs:
        ra, rb = grid[a], grid[b]
        cols = m if wrap else m - 1
        for j in range(cols):
            j2 = (j + 1) % m
            if len(ra) == 1 and len(rb) == 1:
                continue
            if len(ra) == 1:
                bm.faces.new((ra[0], rb[j2], rb[j]))
            elif len(rb) == 1:
                bm.faces.new((ra[j], ra[j2], rb[0]))
            else:
                bm.faces.new((ra[j], ra[j2], rb[j2], rb[j]))
    if wrap and not closed:
        if cap_start and len(grid[0]) > 1:
            bm.faces.new(list(reversed(grid[0])))
        if cap_end and len(grid[-1]) > 1:
            bm.faces.new(grid[-1])
    kw.setdefault("smooth", True)
    return _finish(bm, kw, "loft")


def lathe(profile, segments=12, **kw):
    """Revolve a profile of (radius, z) points around Z (bottom to top).

    r == 0 at an end makes a closed pole. Accepts loft kwargs (exponent,
    modulate, arc) and the common kwargs.
    """
    return loft([(z, r, r) for r, z in profile], segments=segments, **kw)


def sphere(radius, segments=12, rings=8, exponent=2.0, **kw):
    """UV-style sphere/ellipsoid centred on loc. ``radius`` scalar or (rx, ry, rz)."""
    rx, ry, rz = (radius, radius, radius) if isinstance(radius, (int, float)) else radius
    p = 2.0 / exponent
    rs = []
    for i in range(rings + 1):
        phi = -math.pi / 2 + math.pi * i / rings
        s, c = math.sin(phi), math.cos(phi)
        z = rz * math.copysign(abs(s) ** p, s)
        f = abs(c) ** p if 0 < i < rings else 0.0
        rs.append((z, rx * f, ry * f))
    kw.setdefault("name", "sphere")
    return loft(rs, segments=segments, exponent=exponent, **kw)


def capsule(radius, length, segments=10, cap_rings=3, radius_end=None, **kw):
    """Tapered capsule along +Z from z=0 to z=length (origin at the base end).

    radius at the base, ``radius_end`` at the tip (default = radius). Rotate
    with ``rot`` to aim it (e.g. rot=(0, pi/2, 0) points it along +X).
    """
    r0 = radius
    r1 = radius if radius_end is None else radius_end
    rs = []
    for i in range(cap_rings + 1):
        a = -math.pi / 2 + (math.pi / 2) * i / cap_rings
        rs.append((r0 + r0 * math.sin(a), r0 * math.cos(a), r0 * math.cos(a)))
    for i in range(cap_rings + 1):
        a = (math.pi / 2) * i / cap_rings
        rs.append((length - r1 + r1 * math.sin(a), r1 * math.cos(a), r1 * math.cos(a)))
    rs[0] = (0.0, 0.0, 0.0)
    rs[-1] = (length, 0.0, 0.0)
    kw.setdefault("name", "capsule")
    return loft(rs, segments=segments, **kw)


def cylinder(radius, depth, verts=12, radius_top=None, **kw):
    """Capped cylinder / frustum centred on loc, axis Z. Flat-shaded sides+caps
    unless smooth=True (then caps stay sharp)."""
    rt = radius if radius_top is None else radius_top
    kw.setdefault("smooth", True)
    kw.setdefault("smooth_angle", math.radians(60))
    kw.setdefault("name", "cylinder")
    return loft([(-depth / 2, radius, radius), (depth / 2, rt, rt)], segments=verts, **kw)


def cone(radius, depth, verts=12, radius_top=0.0, **kw):
    """Cone centred on loc (base at -depth/2). radius_top > 0 gives a frustum."""
    if radius_top <= 0:
        kw.setdefault("name", "cone")
        kw.setdefault("smooth", False)
        return loft([(-depth / 2, radius, radius), (depth / 2, 0.0, 0.0)], segments=verts, **kw)
    return cylinder(radius, depth, verts, radius_top=radius_top, **kw)


def box(size, **kw):
    """Axis-aligned box centred on loc; ``size`` = (x, y, z) full extents. Flat."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    sx, sy, sz = _as_vec3(size)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    kw.setdefault("name", "box")
    return _finish(bm, kw, "box")


def rounded_box(size, radius=0.02, segments=2, **kw):
    """Box with every edge bevelled by ``radius`` (Kenney-style chunky block)."""
    kw["bevel"] = radius
    kw["bevel_segments"] = segments
    kw.setdefault("name", "rounded_box")
    kw.setdefault("smooth", True)
    kw.setdefault("smooth_angle", math.radians(35))
    return box(size, **kw)


def torus(major, minor, major_segments=12, minor_segments=6, **kw):
    """Torus in the XY plane centred on loc (ring around Z)."""
    rs = []
    for j in range(minor_segments):
        a = -math.pi / 2 - 2 * math.pi * j / minor_segments
        r = major + minor * math.cos(a)
        rs.append((minor * math.sin(a), r, r))
    kw.setdefault("name", "torus")
    return loft(rs, segments=major_segments, closed=True, **kw)


def tube(points, radius, segments=6, closed=False, cap=True, **kw):
    """Sweep a circular section along a polyline (straps, handles, tails, wire).

    points  list of (x, y, z); radius scalar or list (one per point, tapers).
    closed  loop the path (rings, key rings).
    """
    pts = [Vector(p) for p in points]
    n = len(pts)
    radii = radius if isinstance(radius, (list, tuple)) else [radius] * n
    tangents = []
    for i in range(n):
        if closed:
            t = pts[(i + 1) % n] - pts[i - 1]
        else:
            t = pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]
        tangents.append(t.normalized())
    ref = Vector((0, 0, 1)) if abs(tangents[0].z) < 0.9 else Vector((1, 0, 0))
    normal = tangents[0].cross(ref).normalized()
    bm = bmesh.new()
    rows = []
    for i in range(n):
        t = tangents[i]
        normal = (normal - t * normal.dot(t))
        if normal.length < 1e-6:
            normal = t.orthogonal()
        normal.normalize()
        bi = t.cross(normal)
        row = []
        for j in range(segments):
            a = 2 * math.pi * j / segments
            row.append(bm.verts.new(pts[i] + (normal * math.cos(a) + bi * math.sin(a)) * radii[i]))
        rows.append(row)
    pairs = list(zip(range(n - 1), range(1, n)))
    if closed:
        pairs.append((n - 1, 0))
    for a, b in pairs:
        for j in range(segments):
            j2 = (j + 1) % segments
            bm.faces.new((rows[a][j], rows[a][j2], rows[b][j2], rows[b][j]))
    if cap and not closed:
        bm.faces.new(list(reversed(rows[0])))
        bm.faces.new(rows[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    kw.setdefault("smooth", True)
    return _finish(bm, kw, "tube")


def extrude_profile(points, depth, **kw):
    """Extrude a 2D polygon ((x, y) list, any winding) along Z, centred on z=0.

    For signs/awnings/boards: rot=(pi/2, 0, 0) stands the profile up in the XZ
    plane (profile y -> world z) with the thickness along Y. Flat shaded.
    """
    area = sum(points[i][0] * points[(i + 1) % len(points)][1] -
               points[(i + 1) % len(points)][0] * points[i][1] for i in range(len(points)))
    pts = points if area > 0 else list(reversed(points))
    bm = bmesh.new()
    lo = [bm.verts.new((x, y, -depth / 2)) for x, y in pts]
    hi = [bm.verts.new((x, y, depth / 2)) for x, y in pts]
    bm.faces.new(list(reversed(lo)))
    bm.faces.new(hi)
    k = len(pts)
    for i in range(k):
        j = (i + 1) % k
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    kw.setdefault("name", "extrusion")
    return _finish(bm, kw, "extrusion")


def catmull(points, samples=4):
    """Catmull-Rom resample of a list of equal-length numeric tuples.

    Handy for smooth loft/lathe profiles from a few control rings. Returns
    ``(len(points)-1)*samples + 1`` tuples passing through every control point.
    """
    out = []
    P = [points[0]] + list(points) + [points[-1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for s in range(samples):
            t = s / samples
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 +
                                    (-a + 3 * b - 3 * c + d) * t3)
                             for a, b, c, d in zip(p0, p1, p2, p3)))
    out.append(tuple(points[-1]))
    return out


# --------------------------------------------------------------------------
# object-level operations
# --------------------------------------------------------------------------
def bake(obj):
    """Apply the object transform into the mesh (object ends at identity)."""
    m = obj.matrix_basis.copy()
    if m != Matrix.Identity(4):
        obj.data.transform(m)
        if m.determinant() < 0:
            _reverse(obj.data)
        obj.matrix_basis = Matrix.Identity(4)
    return obj


def _reverse(me):
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()


def duplicate(obj, loc=None, rot=None, scale=None, mirror_x=False, name=None):
    """Copy a part (new mesh data). Optionally set transform or mirror across X=0
    (mirroring is baked, so windings stay correct)."""
    me = obj.data.copy()
    new = bpy.data.objects.new(name or obj.name, me)
    bpy.context.scene.collection.objects.link(new)
    new.matrix_basis = obj.matrix_basis.copy()
    if loc is not None:
        new.location = loc
    if rot is not None:
        new.rotation_euler = Euler(rot, "XYZ")
    if scale is not None:
        new.scale = _as_vec3(scale)
    if mirror_x:
        new.matrix_basis = Matrix.Scale(-1, 4, (1, 0, 0)) @ new.matrix_basis
        bake(new)
    return new


def mirror_x(obj, name=None):
    """Mirrored copy of ``obj`` across the X=0 plane (for left/right limbs)."""
    return duplicate(obj, mirror_x=True, name=name)


def rotate_about(objs, pivot, rot):
    """Rotate parts (list or single) about world ``pivot`` by Euler ``rot``."""
    objs = objs if isinstance(objs, (list, tuple)) else [objs]
    p = Vector(pivot)
    R = Euler(rot, "XYZ").to_matrix().to_4x4()
    M = Matrix.Translation(p) @ R @ Matrix.Translation(-p)
    for o in objs:
        o.matrix_basis = M @ o.matrix_basis
    return objs


def join(parts, name):
    """Merge parts into ONE new mesh object (transforms baked, materials merged
    by name, one slot per colour). The input objects are deleted."""
    parts = [p for p in parts if p is not None]
    mats, index = [], {}
    bm = bmesh.new()
    for p in parts:
        me = p.data.copy()
        M = p.matrix_basis.copy()
        me.transform(M)
        if M.determinant() < 0:
            _reverse(me)
        remap = []
        for m in me.materials:
            if m.name not in index:
                index[m.name] = len(mats)
                mats.append(m)
            remap.append(index[m.name])
        for poly in me.polygons:
            poly.material_index = remap[poly.material_index] if remap else 0
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    out = bpy.data.meshes.new(name)
    bm.to_mesh(out)
    bm.free()
    for m in mats:
        out.materials.append(m)
    for p in parts:
        data = p.data
        bpy.data.objects.remove(p, do_unlink=True)
        if data.users == 0:
            bpy.data.meshes.remove(data)
    obj = bpy.data.objects.new(name, out)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def apply_all(obj):
    """Apply all modifiers (via the evaluated mesh) and the object transform."""
    if obj.modifiers:
        dg = bpy.context.evaluated_depsgraph_get()
        ev = obj.evaluated_get(dg)
        me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
        old = obj.data
        obj.modifiers.clear()
        obj.data = me
        if old.users == 0:
            bpy.data.meshes.remove(old)
    return bake(obj)


def bbox(obj):
    """(min, max) Vectors of a mesh object including its own transform (no parents)."""
    M = obj.matrix_basis
    vs = [M @ v.co for v in obj.data.vertices]
    return (Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs))),
            Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs))))


def translate_mesh(obj, offset):
    """Move mesh data by ``offset`` (object origin stays)."""
    obj.data.transform(Matrix.Translation(Vector(offset)))
    obj.data.update()


def set_origin_feet(obj, centre_xy=True):
    """Bake transform; put the lowest point at z=0 and (optionally) centre the
    bounding box on x=y=0. Object location ends at the world origin."""
    bake(obj)
    lo, hi = bbox(obj)
    cx, cy = ((lo.x + hi.x) / 2, (lo.y + hi.y) / 2) if centre_xy else (0.0, 0.0)
    translate_mesh(obj, (-cx, -cy, -lo.z))
    obj.location = (0, 0, 0)
    return obj


def set_origin(obj, point):
    """Bake transform and move mesh so world ``point`` becomes the origin
    (grip points for hand props, hinge points, ...)."""
    bake(obj)
    translate_mesh(obj, -Vector(point))
    obj.location = (0, 0, 0)
    return obj


def scale_mesh(obj, factor, pivot=(0, 0, 0)):
    """Uniformly scale mesh data about ``pivot``."""
    p = Vector(pivot)
    obj.data.transform(Matrix.Translation(p) @ Matrix.Scale(factor, 4) @ Matrix.Translation(-p))
    obj.data.update()
    return obj


def deform(obj, fn):
    """Apply ``fn(Vector) -> Vector`` to every vertex (bends, stoops, droops)."""
    bake(obj)
    for v in obj.data.vertices:
        v.co = fn(v.co.copy())
    obj.data.update()
    return obj


def tri_count(obj):
    """Triangles after triangulation (what the GLB will contain)."""
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def flat_shade(obj):
    """Flat-shade every face."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    _shade_bm(bm, False)
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def smooth_shade(obj, angle=DEFAULT_SMOOTH_ANGLE):
    """Smooth shading, keeping edges sharper than ``angle`` hard."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    _shade_bm(bm, True, angle)
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def bevel(obj, width, segments=1, angle=math.radians(30)):
    """Bevel every edge sharper than ``angle`` on an existing part (in place)."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    _bevel_bm(bm, width, segments, angle)
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def aim(direction):
    """Euler rotation that turns local +Z (the axis of loft/capsule/cylinder)
    to point along ``direction``. Pass as ``rot=aim((1, 0, 0))``."""
    d = Vector(direction).normalized()
    return tuple(Vector((0, 0, 1)).rotation_difference(d).to_euler("XYZ"))


def cut(obj, plane_co, plane_no, fill=False):
    """Slice a part with a plane (object-local coords) and delete everything on
    the side *opposite* ``plane_no``. ``fill`` caps the opening with n-gons.
    Used for hair shells (hairline), cut-away domes, open crates."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
    bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-6, plane_co=Vector(plane_co),
                           plane_no=Vector(plane_no), clear_inner=True)
    if fill:
        boundary = [e for e in bm.edges if e.is_boundary]
        bmesh.ops.holes_fill(bm, edges=boundary, sides=0)
    smooth = any(f.smooth for f in bm.faces)
    _shade_bm(bm, smooth)
    bm.to_mesh(obj.data)
    bm.free()
    return obj
