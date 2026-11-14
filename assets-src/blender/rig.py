"""Shared studio rig for 25's 3D assets (Blender 4, Cycles, headless).

Soft warm key light, cool fill, faint lime rim, 3/4 camera, transparent
background. Every asset script builds geometry, then calls render_frames().
"""
import math
import os
import bpy
from mathutils import Vector

OUT = os.environ.get("OUT", "/tmp/25-assets")
SIZE = int(os.environ.get("SIZE", "256"))
SAMPLES = int(os.environ.get("SAMPLES", "96"))


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = SAMPLES
    sc.cycles.use_adaptive_sampling = True
    try:
        sc.cycles.use_denoising = True
        sc.cycles.denoiser = "OPENIMAGEDENOISE"
    except Exception:
        sc.cycles.use_denoising = False
    sc.render.film_transparent = True
    sc.render.resolution_x = SIZE
    sc.render.resolution_y = SIZE
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    # Standard keeps our brand colours punchy (Filmic/AgX wash them out).
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.view_settings.exposure = -0.35
    world = bpy.data.worlds.new("w")
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.11, 0.10, 0.13, 1)
    bg.inputs[1].default_value = 0.7
    _lights()


def _area(name, loc, energy, color, size):
    d = bpy.data.lights.new(name, "AREA")
    d.energy = energy
    d.color = color
    d.size = size
    o = bpy.data.objects.new(name, d)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    direction = Vector((0, 0, 0)) - Vector(loc)
    o.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return o


def _lights():
    _area("key", (3.5, -4.0, 5.5), 900, (1.0, 0.93, 0.84), 4.0)
    _area("fill", (-5.0, -2.5, 2.0), 260, (0.78, 0.86, 1.0), 5.0)
    _area("rim", (-1.5, 5.0, 3.5), 520, (0.82, 1.0, 0.55), 2.5)
    _area("top", (0, 0, 7), 180, (1, 1, 1), 6.0)


def mat(name, color, rough=0.35, metal=0.0, coat=0.25, trans=0.0, emit=None, emit_strength=0.0, alpha=1.0, sss=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    for key, val in (("Coat Weight", coat), ("Transmission Weight", trans), ("Subsurface Weight", sss)):
        if key in p.inputs:
            p.inputs[key].default_value = val
    if emit is not None:
        p.inputs["Emission Color"].default_value = (*emit, 1)
        p.inputs["Emission Strength"].default_value = emit_strength
    if alpha < 1:
        p.inputs["Alpha"].default_value = alpha
        m.blend_method = "BLEND"
    return m


def hexc(h):
    h = h.lstrip("#")
    srgb = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb)


def smooth(o, bevel=0.0, subsurf=0, seg=4):
    bpy.context.view_layer.objects.active = o
    if bevel:
        b = o.modifiers.new("bevel", "BEVEL")
        b.width = bevel
        b.segments = seg
        b.limit_method = "ANGLE"
    if subsurf:
        s = o.modifiers.new("sub", "SUBSURF")
        s.levels = subsurf
        s.render_levels = subsurf
    try:
        for poly in o.data.polygons:
            poly.use_smooth = True
    except Exception:
        pass
    return o


def assign(o, m):
    o.data.materials.clear()
    o.data.materials.append(m)
    return o


def link(o):
    bpy.context.scene.collection.objects.link(o)
    return o


def mesh_obj(name, verts, faces):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    return link(o)


def lathe(name, profile, steps=48):
    """Revolve a (r, z) profile around Z into a closed-ish mesh."""
    verts, faces = [], []
    n = len(profile)
    for s in range(steps):
        a = 2 * math.pi * s / steps
        for r, z in profile:
            verts.append((r * math.cos(a), r * math.sin(a), z))
    for s in range(steps):
        s2 = (s + 1) % steps
        for i in range(n - 1):
            faces.append((s * n + i, s2 * n + i, s2 * n + i + 1, s * n + i + 1))
    o = mesh_obj(name, verts, faces)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def camera(elev=58, azim=32, dist=10):
    cam = bpy.data.cameras.new("cam")
    cam.type = "ORTHO"
    o = bpy.data.objects.new("cam", cam)
    link(o)
    e, a = math.radians(elev), math.radians(azim)
    o.location = (dist * math.sin(e) * math.sin(a), -dist * math.sin(e) * math.cos(a), dist * math.cos(e))
    o.rotation_euler = (Vector((0, 0, 0)) - o.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = o
    return o


def frame_to(cam, objs, margin=1.18):
    """Fit the orthographic camera around these objects (in camera space)."""
    bpy.context.view_layer.update()
    inv = cam.matrix_world.inverted()
    xs, ys = [], []
    for o in objs:
        dg = bpy.context.evaluated_depsgraph_get()
        ev = o.evaluated_get(dg)
        for c in ev.bound_box:
            p = inv @ (ev.matrix_world @ Vector(c))
            xs.append(p.x)
            ys.append(p.y)
    w = max(xs) - min(xs)
    h = max(ys) - min(ys)
    cam.data.ortho_scale = max(w, h) * margin
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    cam.data.shift_x = cx / cam.data.ortho_scale
    cam.data.shift_y = cy / cam.data.ortho_scale


def render(name, frame):
    os.makedirs(os.path.join(OUT, name), exist_ok=True)
    sc = bpy.context.scene
    sc.render.filepath = os.path.join(OUT, name, f"{frame}.png")
    bpy.ops.render.render(write_still=True)
