"""
Galeria em "salas" num ziguezague (L por enquanto, vira S quando somar
mais paradas): cada obra fica numa parede de FUNDO, perpendicular ao
trecho de corredor que leva ate ela -- a camera chega andando reto na
direcao da propria obra, entao ela sempre aparece de frente, cheia na
tela. Nada de quadro em parede LATERAL (esse era o bug da versao 1:
via tudo de esguelha).

Roda headless: blender.exe --background --python full_gallery.py
"""
import bpy
import math
import os
import time
from mathutils import Vector

ROOT = r"C:\Users\lucas\Desktop\Nova pasta"
ASSETS = os.path.join(ROOT, "public", "assets")

LEG_LENGTH = 6.0
HOLD_DIST = 3.0
CORR_HALF_W = 1.2
WALL_HEIGHT = 2.6

# cada perna: origem (x,y) + direcao unitaria (x,y) pra onde a camera anda
# nela. direcao alterna (0,-1) / (1,0) / (0,-1) ... formando o ziguezague.
LEGS = [
    {"origin": (0.0, 6.0), "dir": (0.0, -1.0), "image": "salvator-mundi.jpg"},
    {"origin": (0.6, -0.6), "dir": (1.0, 0.0), "image": "gioconda_only.jpeg"},
]


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


def new_material(name):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    return mat, mat.node_tree


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

mat_floor, nt_floor = new_material("FloorMat")
bsdf_floor = nt_floor.nodes["Principled BSDF"]
bsdf_floor.inputs["Base Color"].default_value = (0.012, 0.012, 0.014, 1)
bsdf_floor.inputs["Roughness"].default_value = 0.15

mat_ceil, nt_ceil = new_material("CeilMat")
bsdf_ceil = nt_ceil.nodes["Principled BSDF"]
bsdf_ceil.inputs["Base Color"].default_value = (0.006, 0.006, 0.007, 1)
bsdf_ceil.inputs["Roughness"].default_value = 0.6

mat_wall, nt_wall = new_material("WallMat")
bsdf_w = nt_wall.nodes["Principled BSDF"]
bsdf_w.inputs["Base Color"].default_value = (0.008, 0.008, 0.009, 1)
bsdf_w.inputs["Roughness"].default_value = 0.28

mat_backdrop, nt_backdrop = new_material("BackdropMat")
bsdf_bd = nt_backdrop.nodes["Principled BSDF"]
bsdf_bd.inputs["Base Color"].default_value = (0.01, 0.01, 0.011, 1)
bsdf_bd.inputs["Roughness"].default_value = 0.4

mat_ped, nt_ped = new_material("PedestalMat")
bsdf_p = nt_ped.nodes["Principled BSDF"]
bsdf_p.inputs["Base Color"].default_value = (0.01, 0.01, 0.011, 1)
bsdf_p.inputs["Roughness"].default_value = 0.25

mat_frame, nt_frame = new_material("FrameMat")
bsdf_f = nt_frame.nodes["Principled BSDF"]
bsdf_f.inputs["Base Color"].default_value = (0.09, 0.07, 0.035, 1)
bsdf_f.inputs["Roughness"].default_value = 0.32
bsdf_f.inputs["Metallic"].default_value = 0.9


def build_orb_material():
    mat_orb, nt_orb = new_material("OrbMat")
    nodes = nt_orb.nodes
    links = nt_orb.links
    for n in list(nodes):
        nodes.remove(n)
    out = nodes.new("ShaderNodeOutputMaterial")
    emit = nodes.new("ShaderNodeEmission")
    glass = nodes.new("ShaderNodeBsdfGlass")
    mix = nodes.new("ShaderNodeMixShader")
    fresnel = nodes.new("ShaderNodeFresnel")
    emit.inputs["Color"].default_value = (1.0, 0.42, 0.08, 1)
    emit.inputs["Strength"].default_value = 6.0
    glass.inputs["Roughness"].default_value = 0.02
    glass.inputs["IOR"].default_value = 1.45
    fresnel.inputs["IOR"].default_value = 1.45
    links.new(fresnel.outputs["Fac"], mix.inputs["Fac"])
    links.new(emit.outputs["Emission"], mix.inputs[1])
    links.new(glass.outputs["BSDF"], mix.inputs[2])
    links.new(mix.outputs["Shader"], out.inputs["Surface"])
    return mat_orb


def add_box(name, loc, scale, mat, bevel=None):
    bpy.ops.mesh.primitive_cube_add(size=1)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    ob.location = loc
    ob.data.materials.append(mat)
    if bevel:
        bpy.ops.object.modifier_add(type='BEVEL')
        ob.modifiers["Bevel"].width = bevel[0]
        ob.modifiers["Bevel"].segments = bevel[1]
    return ob


def build_leg(index, origin2d, direction2d, image_file):
    dx, dy = direction2d
    lat = (-dy, dx)  # perpendicular (lateral) unitario
    theta = math.atan2(-dx, dy)  # alinha +Y local com (dx,dy)

    def at(dist, lat_off=0.0, z=0.0):
        return (
            origin2d[0] + dx * dist + lat[0] * lat_off,
            origin2d[1] + dy * dist + lat[1] * lat_off,
            z,
        )

    # --- piso e teto do trecho ---
    floor = add_box(f"Floor_{index}", at(LEG_LENGTH / 2, 0, -0.05),
                     (CORR_HALF_W * 2, LEG_LENGTH, 0.1), mat_floor)
    floor.rotation_euler = (0, 0, theta)

    ceil = add_box(f"Ceil_{index}", at(LEG_LENGTH / 2, 0, WALL_HEIGHT + 0.05),
                    (CORR_HALF_W * 2, LEG_LENGTH, 0.1), mat_ceil)
    ceil.rotation_euler = (0, 0, theta)

    # --- paredes ripadas dos dois lados (nao fecham o fim -- a sala
    # termina numa parede curta so atras do quadro, deixando aberto
    # pros lados pra camera virar pro proximo trecho) ---
    for side_sign in (-1, 1):
        bpy.ops.mesh.primitive_cube_add(size=1)
        lath = bpy.context.active_object
        lath.name = f"Lath_{index}_{side_sign}"
        lath.scale = (0.045, 0.035, WALL_HEIGHT)
        bpy.ops.object.transform_apply(scale=True)
        bpy.ops.object.modifier_add(type='BEVEL')
        lath.modifiers["Bevel"].width = 0.012
        lath.modifiers["Bevel"].segments = 3
        lath.data.materials.append(mat_wall)
        arr = lath.modifiers.new("Array", 'ARRAY')
        arr.count = int((LEG_LENGTH - 0.6) / 0.07)
        arr.use_relative_offset = True
        arr.relative_offset_displace = (0, 1.55, 0)
        lath.location = at(0, side_sign * CORR_HALF_W, WALL_HEIGHT / 2)
        lath.rotation_euler = (0, 0, theta)

    # --- pedestal + orbe: um pouco antes do quadro, puxado pra lateral
    # pra nao tapar a pintura no enquadramento de frente ---
    ped_side = -1 if index % 2 == 0 else 1
    ped_loc = at(LEG_LENGTH - 1.5, ped_side * 0.7, 0.45)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.3, depth=0.9, vertices=48)
    pedestal = bpy.context.active_object
    pedestal.name = f"Pedestal_{index}"
    pedestal.location = ped_loc
    pedestal.data.materials.append(mat_ped)
    bpy.ops.object.modifier_add(type='BEVEL')
    pedestal.modifiers["Bevel"].width = 0.01
    pedestal.modifiers["Bevel"].segments = 2

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.13, segments=48, ring_count=32)
    orb = bpy.context.active_object
    orb.name = f"Orb_{index}"
    orb.location = (ped_loc[0], ped_loc[1], ped_loc[2] + 0.45 + 0.13)
    orb.data.materials.append(build_orb_material())

    # --- quadro na parede de FUNDO, de frente pra camera que chega ---
    img_path = os.path.join(ASSETS, image_file)
    img = bpy.data.images.load(img_path)
    iw, ih = img.size
    aspect = ih / iw
    painting_w = 1.15
    painting_h = painting_w * aspect
    border = 0.05

    end_point = at(LEG_LENGTH, 0, 1.15)
    empty = bpy.data.objects.new(f"PaintingRig_{index}", None)
    bpy.context.collection.objects.link(empty)
    empty.location = end_point
    empty.rotation_euler = (0, 0, theta)

    # parede de fundo curta -- so o suficiente pra encostar o quadro,
    # nao fecha o corredor inteiro (deixa aberto pros lados).
    # A CAUSA do padrao de aneis/diagonal no preview: a caixa tem 0.06
    # de espessura (+-0.03 do centro) e eu só afastava o CENTRO 0.03 da
    # tela -- a face da frente do backdrop ficava exatamente coincidente
    # com a tela (z-fighting: Cycles amostra ora uma superficie ora
    # outra por pixel, gerando aquele bandeamento em aneis). Preciso do
    # centro afastado o suficiente pra sobrar folga DEPOIS de descontar
    # a meia-espessura.
    backdrop_thickness = 0.06
    backdrop = add_box(
        f"Backdrop_{index}", at(LEG_LENGTH + backdrop_thickness / 2 + 0.05, 0, 1.15),
        (painting_w + 0.5, backdrop_thickness, painting_h + 0.5), mat_backdrop,
    )
    backdrop.rotation_euler = (0, 0, theta)

    bpy.ops.mesh.primitive_plane_add(size=1)
    canvas = bpy.context.active_object
    canvas.name = f"Canvas_{index}"
    canvas.scale = (painting_w, painting_h, 1)
    bpy.ops.object.transform_apply(scale=True)
    canvas.rotation_euler = (math.radians(90), 0, 0)
    canvas.location = (0, 0, 0)
    canvas.parent = empty

    mat_canvas, nt_canvas = new_material(f"CanvasMat_{index}")
    bsdf_c = nt_canvas.nodes["Principled BSDF"]
    tex = nt_canvas.nodes.new("ShaderNodeTexImage")
    tex.image = img
    nt_canvas.links.new(tex.outputs["Color"], bsdf_c.inputs["Base Color"])
    # bem fosco e sem especular -- com roughness baixo o spot refletia
    # como um disco especular na tela, e o falloff/raio do spot virava
    # aneis concentricos visiveis por cima da pintura (visto no preview)
    bsdf_c.inputs["Roughness"].default_value = 0.92
    if "Specular IOR Level" in bsdf_c.inputs:
        bsdf_c.inputs["Specular IOR Level"].default_value = 0.0
    canvas.data.materials.append(mat_canvas)

    def add_frame_bar(local_loc, local_scale):
        bpy.ops.mesh.primitive_cube_add(size=1)
        bar = bpy.context.active_object
        bar.scale = local_scale
        bpy.ops.object.transform_apply(scale=True)
        bar.location = local_loc
        bar.data.materials.append(mat_frame)
        bar.parent = empty

    add_frame_bar((0, 0, painting_h / 2 + border / 2), (painting_w / 2 + border, border / 2, border / 2))
    add_frame_bar((0, 0, -(painting_h / 2 + border / 2)), (painting_w / 2 + border, border / 2, border / 2))
    add_frame_bar((-(painting_w / 2 + border / 2), 0, 0), (border / 2, border / 2, painting_h / 2))
    add_frame_bar((painting_w / 2 + border / 2, 0, 0), (border / 2, border / 2, painting_h / 2))

    # --- luzes: spot quente na obra, aro frio no pedestal ---
    # afastado e num angulo mais raso (~25 graus) pra cobrir a tela
    # inteira por igual -- perto demais e quase em cima so acende um
    # canto e o resto morre no falloff do cone (visto no preview v1)
    key_loc = at(LEG_LENGTH - 2.3, 0, WALL_HEIGHT - 0.5)
    bpy.ops.object.light_add(type='SPOT', location=key_loc)
    key = bpy.context.active_object
    key.name = f"Key_{index}"
    key.data.energy = 2600
    key.data.spot_size = math.radians(75)
    key.data.spot_blend = 0.5
    key.data.color = (1.0, 0.82, 0.62)
    look_at(key, end_point)

    rim_loc = at(LEG_LENGTH - 2.0, -ped_side * 1.4, 1.8)
    bpy.ops.object.light_add(type='AREA', location=rim_loc)
    rim = bpy.context.active_object
    rim.name = f"Rim_{index}"
    rim.data.energy = 260
    rim.data.color = (0.35, 0.75, 1.0)
    rim.data.size = 1.3
    look_at(rim, (ped_loc[0], ped_loc[1], ped_loc[2] + 0.5))

    entry = at(0, 0, 1.35)
    hold_pos = at(LEG_LENGTH - HOLD_DIST, 0, 1.35)
    return {
        "entry": entry, "hold_pos": hold_pos, "target": end_point,
        "end_point": end_point, "lateral": lat, "origin": origin2d,
    }


STOP_INFO = []
for i, leg in enumerate(LEGS):
    STOP_INFO.append(build_leg(i, leg["origin"], leg["dir"], leg["image"]))

# ---------- luz de preenchimento geral ----------
bpy.ops.object.light_add(type='AREA', location=(0, 0, WALL_HEIGHT - 0.1))
fill = bpy.context.active_object
fill.data.energy = 250
fill.data.color = (0.55, 0.6, 0.7)
fill.data.size = 10.0
fill.data.shape = 'SQUARE'

# ---------- camera animada ----------
FPS = 24
HOLD_SEC = 1.8
TRANS_SEC = 2.2
HOLD_F = round(HOLD_SEC * FPS)
TRANS_F = round(TRANS_SEC * FPS)

bpy.ops.object.camera_add(location=(0, 0, 1.35))
cam = bpy.context.active_object
cam.data.lens = 32
scene.camera = cam

cam_target = bpy.data.objects.new("CamTarget", None)
bpy.context.collection.objects.link(cam_target)
track = cam.constraints.new(type='TRACK_TO')
track.target = cam_target
track.track_axis = 'TRACK_NEGATIVE_Z'
track.up_axis = 'UP_Y'

bpy.context.preferences.edit.keyframe_new_interpolation_type = 'BEZIER'
bpy.context.preferences.edit.keyframe_new_handle_type = 'AUTO_CLAMPED'


def key_both(frame, pos, target):
    cam.location = pos
    cam.keyframe_insert(data_path="location", frame=frame)
    cam_target.location = target
    cam_target.keyframe_insert(data_path="location", frame=frame)


def swing_waypoint(info, next_info):
    ep = info["end_point"]
    lat = info["lateral"]
    delta = (next_info["origin"][0] - ep[0], next_info["origin"][1] - ep[1])
    proj = delta[0] * lat[0] + delta[1] * lat[1]
    sign = 1.0 if proj >= 0 else -1.0
    swing = CORR_HALF_W + 1.0
    return (
        ep[0] + lat[0] * swing * sign,
        ep[1] + lat[1] * swing * sign,
        1.4,
    )


frame = 1
for i, info in enumerate(STOP_INFO):
    if i == 0:
        key_both(frame, info["entry"], info["target"])
    key_both(frame + HOLD_F, info["hold_pos"], info["target"])
    frame += HOLD_F
    if i < len(STOP_INFO) - 1:
        nxt = STOP_INFO[i + 1]
        mid_frame = frame + TRANS_F // 2
        waypoint = swing_waypoint(info, nxt)
        # olhando pro meio do caminho enquanto desvia -- nao trava
        # mirando pra pintura que ja ficou nem pra proxima ainda distante
        mid_target = (
            (info["target"][0] + nxt["target"][0]) / 2,
            (info["target"][1] + nxt["target"][1]) / 2,
            1.2,
        )
        key_both(mid_frame, waypoint, mid_target)
        frame += TRANS_F
        key_both(frame, nxt["entry"], nxt["target"])

scene.frame_start = 1
scene.frame_end = frame

# ---------- world ----------
world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = (0.003, 0.003, 0.004, 1)
bg.inputs["Strength"].default_value = 1.0

# ---------- render settings ----------
scene.render.engine = 'CYCLES'
scene.cycles.device = 'GPU'
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'CUDA'
prefs.get_devices()
for d in prefs.devices:
    d.use = True
scene.cycles.samples = 180
scene.cycles.use_denoising = True
# o orbe de vidro perto do pedestal refrata a luz forte da obra e forma
# uma caustica real (anel de luz focada) na tela -- sem isso desligado
# ela aparece como um corte diagonal com aneis concentricos por cima da
# pintura (visto no preview, presente com spot OU sun, mudar o material
# da tela nao mudou nada -- e a luz chegando, nao o material recebendo)
scene.cycles.caustics_reflective = False
scene.cycles.caustics_refractive = False
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Punchy'

scene.render.fps = FPS
seq_dir = os.path.join(ROOT, "blender", "renders", "sequence")
os.makedirs(seq_dir, exist_ok=True)
scene.render.filepath = os.path.join(seq_dir, "frame_")
scene.render.image_settings.file_format = 'PNG'

t0 = time.time()
bpy.ops.render.render(animation=True)
print("RENDER_SECONDS:", time.time() - t0)
print("FRAMES:", scene.frame_start, "-", scene.frame_end)
print("DONE:", seq_dir)
