"""25's 3D table props. Run: blender -b -P assets.py -- [names...]

Each builder makes the model, then renders N frames into $OUT/<name>/<i>.png.
Styled like soft, glossy toys: rounded edges, clear coat, brand lime/pink.
"""
import math
import random
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, __import__("os").path.dirname(__file__))
from rig import (assign, camera, frame_to, hexc, lathe, link, mat, mesh_obj, render, reset, smooth)

LIME = hexc("#C1EF62")
PINK = hexc("#F27DA6")
SKY = hexc("#7EB8F0")
SUN = hexc("#F5C451")
CREAM = hexc("#F5F1FA")
INK = hexc("#17151F")


def cube(name, size=(1, 1, 1), loc=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return o


def cyl(name, r, depth, loc=(0, 0, 0), verts=64):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, vertices=verts)
    o = bpy.context.active_object
    o.name = name
    return o


def sphere(name, r, loc=(0, 0, 0), seg=48):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=seg, ring_count=seg // 2)
    o = bpy.context.active_object
    o.name = name
    smooth(o)
    return o


def group(objs, name="g"):
    root = bpy.data.objects.new(name, None)
    link(root)
    for o in objs:
        o.parent = root
    return root


# ---------------------------------------------------------------- paddle
def paddle():
    reset()
    red = mat("rubber", hexc("#E5484D"), rough=0.55, coat=0.1)
    black = mat("rubberb", INK, rough=0.6)
    wood = mat("wood", hexc("#C98B4F"), rough=0.45, coat=0.35)
    blade = cyl("blade", 1.0, 0.12)
    smooth(blade, bevel=0.05)
    assign(blade, red)
    back = cyl("back", 1.0, 0.06, loc=(0, 0, -0.09))
    smooth(back, bevel=0.03)
    assign(back, black)
    handle = cube("handle", (0.42, 1.15, 0.3), loc=(0, -1.38, -0.04))
    smooth(handle, bevel=0.1, subsurf=1)
    assign(handle, wood)
    collar = cube("collar", (0.5, 0.26, 0.2), loc=(0, -0.82, -0.04))
    smooth(collar, bevel=0.08)
    assign(collar, wood)
    g = group([blade, back, handle, collar])
    g.rotation_euler = (math.radians(70), 0, math.radians(-20))
    cam = camera(elev=62, azim=20)
    # Swing: three wrist angles.
    poses = [(-28, -10), (0, 0), (26, 12)]
    g.rotation_euler = (math.radians(70), math.radians(poses[0][1]), math.radians(-20 + poses[0][0]))
    frame_to(cam, [blade, handle], margin=1.55)
    for i, (rz, ry) in enumerate(poses):
        g.rotation_euler = (math.radians(70), math.radians(ry), math.radians(-20 + rz))
        render("paddle", i)


# ---------------------------------------------------------------- ball
def ball():
    reset()
    m = mat("ball", hexc("#FFFFFF"), rough=0.2, coat=0.7)
    b = sphere("ball", 1.0)
    assign(b, m)
    cam = camera()
    frame_to(cam, [b], margin=1.12)
    render("ball", 0)


# ---------------------------------------------------------------- dice
def dice():
    reset()
    body = mat("die", LIME, rough=0.3, coat=0.5)
    pip = mat("pip", INK, rough=0.4)
    d = cube("die", (2, 2, 2))
    smooth(d, bevel=0.32, seg=6)
    assign(d, body)
    pips = []
    faces = {
        (0, 0, 1): [(0, 0)],
        (0, 0, -1): [(-0.5, -0.5), (-0.5, 0), (-0.5, 0.5), (0.5, -0.5), (0.5, 0), (0.5, 0.5)],
        (1, 0, 0): [(-0.5, -0.5), (0.5, 0.5)],
        (-1, 0, 0): [(-0.5, -0.5), (0.5, -0.5), (-0.5, 0.5), (0.5, 0.5), (0, 0)],
        (0, 1, 0): [(-0.5, -0.5), (0, 0), (0.5, 0.5)],
        (0, -1, 0): [(-0.5, -0.5), (0.5, -0.5), (-0.5, 0.5), (0.5, 0.5)],
    }
    for n, spots in faces.items():
        n = Vector(n)
        a = Vector((1, 0, 0)) if abs(n.x) < 0.9 else Vector((0, 1, 0))
        u = n.cross(a).normalized()
        v = n.cross(u).normalized()
        for su, sv in spots:
            loc = n * 1.0 + u * su + v * sv
            p = cyl("pip", 0.17, 0.05, loc=tuple(loc), verts=32)
            p.rotation_euler = n.to_track_quat("Z", "Y").to_euler()
            smooth(p, bevel=0.02, seg=3)
            assign(p, pip)
            pips.append(p)
    g = group([d, *pips])
    cam = camera(elev=55, azim=35)
    frame_to(cam, [d], margin=1.5)
    rots = [(0, 0, 0), (35, 20, 15), (90, 0, 30), (140, 40, 60), (180, 90, 20), (250, 120, 80)]
    for i, r in enumerate(rots):
        g.rotation_euler = tuple(math.radians(x) for x in r)
        render("dice", i)


# ---------------------------------------------------------------- flame
def flame():
    reset()
    outer = mat("flame_o", hexc("#FF5A1F"), rough=0.4, emit=hexc("#FF4A10"), emit_strength=1.6)
    inner = mat("flame_i", hexc("#FFC23A"), rough=0.4, emit=hexc("#FFB020"), emit_strength=2.2)
    frames = 4
    cam = camera(elev=78, azim=10)
    objs = []
    for i in range(frames):
        for o in list(bpy.context.scene.objects):
            if o.type == "MESH":
                bpy.data.objects.remove(o, do_unlink=True)
        random.seed(i * 7 + 3)
        def teardrop(name, h, w, m, wob):
            prof = []
            for k in range(25):
                t = k / 24
                r = w * math.sin(math.pi * t) ** 0.9 * (1 - t) ** 0.35
                prof.append((max(r, 0.0001), t * h))
            o = lathe(name, prof, steps=40)
            for v in o.data.vertices:
                z = v.co.z / h
                v.co.x += math.sin(z * 5 + i * 1.7) * wob * z
                v.co.y += math.cos(z * 4 + i) * wob * 0.6 * z
            assign(o, m)
            smooth(o, subsurf=1)
            return o
        o = teardrop("outer", 2.6 + 0.15 * math.sin(i * 1.6), 1.0, outer, 0.32)
        n = teardrop("inner", 1.5 + 0.12 * math.cos(i * 1.3), 0.55, inner, 0.18)
        n.location = (0.05, -0.32, 0.05)
        objs = [o, n]
        if i == 0:
            frame_to(cam, [o], margin=1.25)
        render("flame", i)


BUILDERS = {"paddle": paddle, "ball": ball, "dice": dice, "flame": flame}

def clear_meshes():
    for o in list(bpy.context.scene.objects):
        if o.type in ("MESH", "CURVE", "EMPTY"):
            bpy.data.objects.remove(o, do_unlink=True)


def cone(name, r1, r2, depth, loc=(0, 0, 0), verts=64):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth, location=loc, vertices=verts)
    o = bpy.context.active_object
    o.name = name
    return o


def tube(name, pts, radius, m):
    """A soft round tube along points (steam, eyes, streamers)."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = 6
    cu.use_fill_caps = True
    sp = cu.splines.new("NURBS")
    sp.points.add(len(pts) - 1)
    for p, c in zip(sp.points, pts):
        p.co = (*c, 1)
    sp.order_u = min(4, len(pts))
    sp.use_endpoint_u = True
    o = bpy.data.objects.new(name, cu)
    link(o)
    o.data.materials.append(m)
    return o


# ---------------------------------------------------------------- glasses (cheers)
def glasses():
    reset()
    glass = mat("glass", (1, 1, 1), rough=0.04, trans=1.0, coat=0.0)
    glass.node_tree.nodes["Principled BSDF"].inputs["IOR"].default_value = 1.45
    fizz = mat("fizz", hexc("#F3CF62"), rough=0.15, trans=0.55, coat=0.3)
    drop = mat("drop", hexc("#F7DA7A"), rough=0.1, trans=0.5)
    cam = camera(elev=72, azim=0)
    poses = [1.35, 0.95, 0.62, 0.62]
    for i, gap in enumerate(poses):
        clear_meshes()
        objs = []
        for side in (-1, 1):
            prof = [(0.0, 0.0), (0.55, 0.0), (0.55, 0.05), (0.07, 0.1), (0.06, 1.1), (0.12, 1.3), (0.3, 1.8), (0.4, 2.3), (0.42, 2.7)]
            g = lathe("flute", prof, 48)
            mod = g.modifiers.new("thick", "SOLIDIFY")
            mod.thickness = 0.03
            assign(g, glass)
            liq = lathe("liq", [(0.0, 1.35), (0.13, 1.35), (0.29, 1.8), (0.37, 2.15), (0.0, 2.15)], 40)
            assign(liq, fizz)
            root = group([g, liq], "glass")
            root.location = (side * gap, 0, 0)
            root.rotation_euler = (0, math.radians(-side * (18 if i < 2 else 26)), 0)
            objs += [g, liq]
        if i == 3:
            random.seed(5)
            for k in range(9):
                a = random.uniform(-2.4, -0.7)
                rr = random.uniform(0.15, 0.55)
                d = sphere("drop", random.uniform(0.04, 0.08), loc=(math.cos(a) * rr * 2.2, 0, 2.95 + math.sin(-a) * rr))
                assign(d, drop)
        if i == 0:
            frame_to(cam, objs, margin=1.25)
        render("cheers", i)


# ---------------------------------------------------------------- hands
SKIN = hexc("#F2BC94")


def hand(name, m, mirror=1):
    palm = cube(name + "_palm", (0.95, 0.32, 1.0), loc=(0, 0, 0))
    smooth(palm, bevel=0.14, subsurf=2)
    parts = [palm]
    for k, (x, h) in enumerate([(-0.33, 0.62), (-0.11, 0.72), (0.11, 0.7), (0.32, 0.58)]):
        f = cube(name + f"_f{k}", (0.2, 0.26, h), loc=(x, 0, 0.5 + h / 2))
        smooth(f, bevel=0.09, subsurf=2)
        parts.append(f)
    th = cube(name + "_thumb", (0.22, 0.26, 0.55), loc=(0.55 * mirror, 0, 0.0))
    th.rotation_euler = (0, math.radians(-38 * mirror), 0)
    smooth(th, bevel=0.09, subsurf=2)
    parts.append(th)
    for o in parts:
        assign(o, m)
    return group(parts, name)


def highfive():
    reset()
    skin = mat("skin", SKIN, rough=0.45, coat=0.1, sss=0.15)
    spark = mat("spark", SUN, rough=0.3, emit=SUN, emit_strength=1.5)
    cam = camera(elev=80, azim=0)
    gaps = [1.6, 1.15, 0.72, 0.72]
    for i, gap in enumerate(gaps):
        clear_meshes()
        hl = hand("L", skin, mirror=1)
        hr = hand("R", skin, mirror=-1)
        hl.location = (-gap, 0, 0)
        hl.rotation_euler = (0, math.radians(18 if i < 2 else 8), 0)
        hr.location = (gap, 0, 0)
        hr.rotation_euler = (0, math.radians(-18 if i < 2 else -8), 0)
        if i == 3:
            for k in range(6):
                a = k / 6 * 2 * math.pi
                s = star("sp", 0.22, loc=(math.cos(a) * 0.95, -0.4, 1.4 + math.sin(a) * 0.75))
                assign(s, spark)
        if i == 0:
            frame_to(cam, [o for o in bpy.context.scene.objects if o.type == "MESH"], margin=1.15)
        render("highfive", i)


def wave():
    reset()
    skin = mat("skin", SKIN, rough=0.45, coat=0.1, sss=0.15)
    cam = camera(elev=82, azim=8)
    angles = [-22, 4, 24, 4]
    for i, a in enumerate(angles):
        clear_meshes()
        h = hand("H", skin, mirror=1)
        h.rotation_euler = (0, math.radians(a), 0)
        h.location = (0, 0, 0)
        if i == 0:
            frame_to(cam, [o for o in bpy.context.scene.objects if o.type == "MESH"], margin=1.5)
        render("wave", i)


# ---------------------------------------------------------------- star / sparkle
def star(name, r, loc=(0, 0, 0), inner=0.28, depth=0.35):
    verts = [(0, 0, depth * r), (0, 0, -depth * r)]
    ring = []
    for k in range(8):
        a = k / 8 * 2 * math.pi + math.pi / 2
        rr = r if k % 2 == 0 else r * inner
        ring.append((math.cos(a) * rr, 0, math.sin(a) * rr))
    # lay it in the XZ plane facing -Y: swap so the front/back points are on Y
    verts = [(0, -depth * r, 0), (0, depth * r, 0)] + ring
    faces = []
    for k in range(8):
        a, b = 2 + k, 2 + (k + 1) % 8
        faces.append((0, a, b))
        faces.append((1, b, a))
    o = mesh_obj(name, verts, faces)
    o.location = loc
    return o


def sparkle():
    reset()
    gold = mat("gold", SUN, rough=0.18, metal=0.6, coat=0.6, emit=SUN, emit_strength=0.6)
    cam = camera(elev=88, azim=0)
    for i, (sc, rot) in enumerate([(0.6, 0), (1.0, 12), (0.8, 24)]):
        clear_meshes()
        s = star("star", 1.0 * sc)
        s.rotation_euler = (0, math.radians(rot), 0)
        assign(s, gold)
        s2 = star("star2", 0.38 * sc, loc=(0.95, -0.1, 0.8))
        assign(s2, gold)
        if i == 0:
            big = star("tmp", 1.0)
            frame_to(cam, [big], margin=1.5)
            bpy.data.objects.remove(big, do_unlink=True)
        render("sparkle", i)


# ---------------------------------------------------------------- paper plane
def plane():
    reset()
    paper = mat("paper", CREAM, rough=0.55, coat=0.0, sss=0.05)
    fold = mat("fold", hexc("#E4DDEE"), rough=0.6)
    cam = camera(elev=62, azim=25)
    v = [(0, 1.7, 0.05), (-1.15, -1.0, 0.18), (0, -1.0, 0.05), (1.15, -1.0, 0.18), (0, -0.85, -0.42)]
    for i, bank in enumerate([-12, 0, 12]):
        clear_meshes()
        wings = mesh_obj("wings", v, [(0, 1, 2), (0, 2, 3)])
        keel = mesh_obj("keel", v, [(0, 2, 4), (0, 4, 2)])
        for o, m in ((wings, paper), (keel, fold)):
            sol = o.modifiers.new("t", "SOLIDIFY")
            sol.thickness = 0.03
            assign(o, m)
        g = group([wings, keel])
        g.rotation_euler = (math.radians(14), math.radians(bank), math.radians(-35))
        if i == 0:
            frame_to(cam, [wings, keel], margin=1.35)
        render("plane", i)


# ---------------------------------------------------------------- kulhad chai
def chai():
    reset()
    clay = mat("clay", hexc("#C0623B"), rough=0.7, coat=0.05)
    tea = mat("tea", hexc("#B9773F"), rough=0.25, coat=0.4)
    foam = mat("foam", hexc("#E8C9A0"), rough=0.6)
    steam = mat("steam", (1, 1, 1), rough=0.8, alpha=0.32, emit=(1, 1, 1), emit_strength=0.4)
    cam = camera(elev=60, azim=20)
    for i in range(4):
        clear_meshes()
        cup = lathe("cup", [(0.0, 0.0), (0.46, 0.0), (0.52, 0.12), (0.66, 1.25), (0.7, 1.32)], 56)
        sol = cup.modifiers.new("t", "SOLIDIFY")
        sol.thickness = 0.07
        smooth(cup, subsurf=1)
        assign(cup, clay)
        top = cyl("tea", 0.63, 0.04, loc=(0, 0, 1.14))
        assign(top, tea)
        rim = lathe("foam", [(0.4, 1.165), (0.6, 1.165), (0.62, 1.18)], 48)
        assign(rim, foam)
        for k, x in enumerate((-0.22, 0.2)):
            ph = i * 0.9 + k * 2.1
            pts = [(x + 0.18 * math.sin(ph + t * 2.4), 0, 1.35 + t * 1.3) for t in [n / 6 for n in range(7)]]
            tube("steam", pts, 0.07 - k * 0.015, steam)
        if i == 0:
            frame_to(cam, [cup, *[o for o in bpy.context.scene.objects if o.name.startswith("steam")]], margin=1.2)
        render("chai", i)


# ---------------------------------------------------------------- speech bubble
def bubble():
    reset()
    shell = mat("bubble", CREAM, rough=0.28, coat=0.6)
    dot = mat("dot", LIME, rough=0.3, coat=0.4)
    cam = camera(elev=86, azim=0)
    for i in range(3):
        clear_meshes()
        b = sphere("b", 1.0)
        b.scale = (1.45, 0.55, 1.0)
        assign(b, shell)
        t = cone("tail", 0.32, 0.0, 0.7, loc=(-0.85, 0, -0.85))
        t.rotation_euler = (0, math.radians(-145), 0)
        smooth(t, subsurf=1)
        assign(t, shell)
        for k in range(3):
            d = sphere("d", 0.17, loc=(-0.5 + k * 0.5, -0.5, 0.0 + (0.12 if k == i else 0)))
            assign(d, dot if k <= i else mat("dim", hexc("#C9C2D4"), rough=0.4))
        if i == 0:
            frame_to(cam, [b, t], margin=1.2)
        render("whisper", i)


# ---------------------------------------------------------------- laughing face
def laugh():
    reset()
    face = mat("face", SUN, rough=0.32, coat=0.5)
    dark = mat("dark", hexc("#3A2418"), rough=0.4)
    tongue = mat("tongue", hexc("#F27D8A"), rough=0.4)
    tear = mat("tear", hexc("#8FD0FF"), rough=0.08, trans=0.6, coat=0.6)
    cam = camera(elev=88, azim=0)
    for i, sq in enumerate([1.0, 0.92]):
        clear_meshes()
        f = sphere("face", 1.0)
        f.scale = (1.0 / sq ** 0.5, 1.0, sq)
        assign(f, face)
        for side in (-1, 1):
            tube("eye", [(side * 0.55, -0.9, 0.22), (side * 0.38, -0.97, 0.38), (side * 0.2, -0.9, 0.22)], 0.07, dark)
            t = sphere("tear", 0.13, loc=(side * 0.72, -0.72, 0.05 - i * 0.1))
            t.scale = (0.8, 0.6, 1.3)
            assign(t, tear)
        m = sphere("mouth", 0.5, loc=(0, -0.82, -0.3 * sq))
        m.scale = (1.05, 0.45, 0.62)
        assign(m, dark)
        tg = sphere("tongue", 0.26, loc=(0, -0.97, -0.5 * sq))
        tg.scale = (1.2, 0.5, 0.6)
        assign(tg, tongue)
        if i == 0:
            frame_to(cam, [f], margin=1.45)
        render("laugh", i)


# ---------------------------------------------------------------- party popper
def popper():
    reset()
    a = mat("pa", PINK, rough=0.35, coat=0.5)
    b = mat("pb", LIME, rough=0.35, coat=0.5)
    gold = mat("pg", SUN, rough=0.25, metal=0.4, coat=0.5)
    cols = [mat("c1", PINK, 0.4), mat("c2", LIME, 0.4), mat("c3", SKY, 0.4), mat("c4", SUN, 0.4), mat("c5", CREAM, 0.4)]
    cam = camera(elev=70, azim=20)
    random.seed(11)
    bits = [(random.uniform(-0.7, 0.7), random.uniform(0.5, 1.0), random.uniform(-0.3, 0.3), random.random() * 6.28, random.choice(cols)) for _ in range(22)]
    # The confetti burst itself is drawn in code (crisper, easy to time).
    for i in range(2):
        clear_meshes()
        parts = []
        n = 6
        for k in range(n):
            r1 = 0.08 + 0.5 * k / n
            r2 = 0.08 + 0.5 * (k + 1) / n
            c = cone("seg", r1, r2, 1.6 / n, loc=(0, 0, 0.8 / n + k * 1.6 / n))
            assign(c, a if k % 2 == 0 else b)
            parts.append(c)
        rim = lathe("rim", [(0.56, 1.58), (0.62, 1.62), (0.56, 1.66)], 48)
        assign(rim, gold)
        parts.append(rim)
        g = group(parts, "popper")
        g.rotation_euler = (0, math.radians(28 + i * 8), 0)
        g.scale = (1, 1, 1 - i * 0.06)
        if i == 0:
            frame_to(cam, parts, margin=1.3)
        render("popper", i)


# ---------------------------------------------------------------- party hat
def partyhat():
    reset()
    a = mat("ha", PINK, rough=0.35, coat=0.5)
    b = mat("hb", LIME, rough=0.35, coat=0.5)
    pom = mat("pom", SUN, rough=0.7)
    cam = camera(elev=70, azim=20)
    for i, tilt in enumerate([-8, 8]):
        clear_meshes()
        parts = []
        n = 6
        for k in range(n):
            r1 = 0.75 * (1 - k / n)
            r2 = 0.75 * (1 - (k + 1) / n)
            c = cone("seg", r1, r2, 1.9 / n, loc=(0, 0, 0.95 / n + k * 1.9 / n))
            smooth(c)
            assign(c, a if k % 2 == 0 else b)
            parts.append(c)
        p = sphere("pom", 0.2, loc=(0, 0, 1.95))
        assign(p, pom)
        parts.append(p)
        g = group(parts, "hat")
        g.rotation_euler = (0, math.radians(tilt), 0)
        if i == 0:
            frame_to(cam, parts, margin=1.25)
        render("partyhat", i)


# ---------------------------------------------------------------- cake
def cake():
    reset()
    sponge = mat("sponge", hexc("#F3D9B1"), rough=0.6)
    icing = mat("icing", PINK, rough=0.3, coat=0.6)
    candle = mat("candle", LIME, rough=0.3, coat=0.5)
    fl = mat("fl", hexc("#FFB020"), rough=0.4, emit=hexc("#FF9A10"), emit_strength=2.0)
    cam = camera(elev=60, azim=25)
    for i in range(2):
        clear_meshes()
        base = cyl("base", 1.0, 0.75, loc=(0, 0, 0.375))
        smooth(base, bevel=0.06)
        assign(base, sponge)
        top = cyl("icing", 1.04, 0.22, loc=(0, 0, 0.82))
        smooth(top, bevel=0.1)
        assign(top, icing)
        for k in range(10):
            a = k / 10 * 2 * math.pi
            d = sphere("drip", 0.12, loc=(math.cos(a) * 1.02, math.sin(a) * 1.02, 0.66))
            d.scale = (1, 1, 1.6)
            assign(d, icing)
        c = cyl("candle", 0.09, 0.6, loc=(0, 0, 1.22))
        assign(c, candle)
        f = sphere("flame", 0.12, loc=(0.02 * (1 if i else -1), 0, 1.66))
        f.scale = (0.8, 0.8, 1.7 + 0.25 * i)
        assign(f, fl)
        if i == 0:
            frame_to(cam, [base, top, f], margin=1.2)
        render("cake", i)


# ---------------------------------------------------------------- camera (Drop)
def camera_prop():
    reset()
    body = mat("body", LIME, rough=0.3, coat=0.6)
    dark = mat("dark", INK, rough=0.25, coat=0.4)
    lens = mat("lens", hexc("#2A3550"), rough=0.05, coat=1.0, metal=0.2)
    cam = camera(elev=62, azim=28)
    b = cube("body", (2.2, 1.0, 1.5), loc=(0, 0, 0.75))
    smooth(b, bevel=0.28, seg=6)
    assign(b, body)
    t = cube("top", (0.7, 0.6, 0.35), loc=(-0.45, 0, 1.55))
    smooth(t, bevel=0.12, seg=4)
    assign(t, body)
    r = cyl("ring", 0.55, 0.3, loc=(0, -0.62, 0.72))
    r.rotation_euler = (math.radians(90), 0, 0)
    smooth(r, bevel=0.06)
    assign(r, dark)
    g = cyl("glass", 0.38, 0.1, loc=(0, -0.78, 0.72))
    g.rotation_euler = (math.radians(90), 0, 0)
    smooth(g, bevel=0.04)
    assign(g, lens)
    s = cyl("shutter", 0.14, 0.12, loc=(0.6, 0, 1.55))
    smooth(s, bevel=0.03)
    assign(s, dark)
    frame_to(cam, [b, t, r], margin=1.2)
    render("camera", 0)


# ---------------------------------------------------------------- ballot box (Polls)
def ballot():
    reset()
    box = mat("box", PINK, rough=0.32, coat=0.6)
    dark = mat("slot", INK, rough=0.4)
    paper = mat("paper", CREAM, rough=0.55)
    tick = mat("tick", LIME, rough=0.3)
    cam = camera(elev=60, azim=28)
    b = cube("box", (1.8, 1.4, 1.4), loc=(0, 0, 0.7))
    smooth(b, bevel=0.18, seg=5)
    assign(b, box)
    s = cube("slot", (1.0, 0.16, 0.05), loc=(0, 0, 1.41))
    smooth(s, bevel=0.04)
    assign(s, dark)
    p = cube("paper", (0.8, 0.03, 0.75), loc=(0, 0, 1.75))
    p.rotation_euler = (0, 0, math.radians(8))
    smooth(p, bevel=0.02)
    assign(p, paper)
    tube("tick", [(-0.22, -0.05, 1.78), (-0.06, -0.05, 1.62), (0.24, -0.05, 1.98)], 0.045, tick)
    frame_to(cam, [b, p], margin=1.2)
    render("ballot", 0)


BUILDERS.update({
    "cheers": glasses, "highfive": highfive, "wave": wave, "sparkle": sparkle, "plane": plane,
    "chai": chai, "whisper": bubble, "laugh": laugh, "popper": popper, "partyhat": partyhat,
    "cake": cake, "camera": camera_prop, "ballot": ballot,
})


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else list(BUILDERS)
    for name in args:
        BUILDERS[name]()
