"""
Galeria em "salas" num ziguezague (L por enquanto, vira S quando somar
mais paradas): cada obra fica numa parede de FUNDO, perpendicular ao
trecho de corredor que leva ate ela -- a camera chega andando reto na
direcao da propria obra, entao ela sempre aparece de frente, cheia na
tela. Nada de quadro em parede LATERAL (esse era o bug da versao 1:
via tudo de esguelha).

Roda headless: blender.exe --background --python full_gallery.py
Preview rapido (frames-chave, 50%, 32 samples, em renders/preview_lobby):
  GALLERY_MODE=preview blender.exe --background --python full_gallery.py
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
    # -1 = sempre a DIREITA da tela pra camera que chega (lateral e
    # (-dy, dx)): a legenda da obra fica no canto esquerdo, e com o orbe
    # alternando de lado ele caia bem atras dela na parada da Gioconda
    ped_side = -1
    # (mais perto do quadro e mais pro lado do que na v1: na parada a 3m
    # do quadro o orbe ficava gigante no meio da tela, atras da legenda)
    ped_loc = at(LEG_LENGTH - 1.0, ped_side * 0.85, 0.45)
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


# ---------- saguao de entrada ----------
# A intro da galeria (o que o Hero dissolve no fim do mergulho) faz parte
# do MESMO render: um atrio rebaixado atravessado por uma passarela no
# nivel do corredor. Os guarda-corpos ripados da passarela ficam em
# x=+-CORR_HALF_W, exatamente onde ficam as paredes ripadas do corredor:
# quando a camera passa pela porta no fundo do atrio, eles "crescem" e
# viram as paredes -- o saguao e o corredor sao um espaco so, sem emenda.
# A camera anda em -Y; o corredor da perna 0 comeca em y=6 (DOOR_Y).
DOOR_Y = LEGS[0]["origin"][1]
WALL_T = 0.3
LOBBY_HALF_W = 6.5
LOBBY_DEPTH = 13.0
LOBBY_BACK_Y = DOOR_Y + WALL_T + LOBBY_DEPTH
SUNKEN_Z = -1.6        # piso do atrio, abaixo da passarela
LOBBY_TOP = 7.6
MEZZ_Z = 3.4           # laje do mezanino lateral
MEZZ_INNER_X = 3.9
RAIL_H = 1.0

mat_concrete, nt_conc = new_material("ConcreteMat")
bsdf_conc = nt_conc.nodes["Principled BSDF"]
bsdf_conc.inputs["Base Color"].default_value = (0.032, 0.029, 0.026, 1)
bsdf_conc.inputs["Roughness"].default_value = 0.75
# textura leve de concreto: ruido modulando o cinza, sem bump (custa
# pouco no Cycles e tira o "plastico liso" das paredes grandes)
noise = nt_conc.nodes.new("ShaderNodeTexNoise")
noise.inputs["Scale"].default_value = 3.5
noise.inputs["Detail"].default_value = 8.0
ramp = nt_conc.nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].color = (0.022, 0.020, 0.018, 1)
ramp.color_ramp.elements[1].color = (0.045, 0.041, 0.037, 1)
nt_conc.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
nt_conc.links.new(ramp.outputs["Color"], bsdf_conc.inputs["Base Color"])

mat_vitrine_bg, nt_vbg = new_material("VitrineBgMat")
nt_vbg.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.11, 0.105, 0.098, 1)
nt_vbg.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.9

mat_lamp, nt_lamp = new_material("LampMat")
for n in list(nt_lamp.nodes):
    nt_lamp.nodes.remove(n)
lamp_out = nt_lamp.nodes.new("ShaderNodeOutputMaterial")
lamp_em = nt_lamp.nodes.new("ShaderNodeEmission")
lamp_em.inputs["Color"].default_value = (1.0, 0.86, 0.66, 1)
lamp_em.inputs["Strength"].default_value = 40.0
nt_lamp.links.new(lamp_em.outputs["Emission"], lamp_out.inputs["Surface"])


def box_span(name, x0, x1, y0, y1, z0, z1, mat):
    """caixa alinhada aos eixos pelos limites -- mais legivel que centro+escala"""
    return add_box(name, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
                   (x1 - x0, y1 - y0, z1 - z0), mat)


def image_plane(name, image_file, w, h, loc, facing, emission=0.0):
    """plano com a imagem em object-fit: cover (recorta o excesso no
    centro, via Mapping nos UVs). facing: 'y-' olha pra -Y... na pratica
    so usamos 'y+' (parede do fundo, olhando pra camera que chega) e
    'x+'/'x-' (paredes laterais)"""
    img = bpy.data.images.load(os.path.join(ASSETS, image_file), check_existing=True)
    iw, ih = img.size
    img_aspect, plane_aspect = iw / ih, w / h
    if img_aspect > plane_aspect:
        su, sv = plane_aspect / img_aspect, 1.0
    else:
        su, sv = 1.0, img_aspect / plane_aspect
    bpy.ops.mesh.primitive_plane_add(size=1)
    pl = bpy.context.active_object
    pl.name = name
    pl.scale = (w, h, 1)
    bpy.ops.object.transform_apply(scale=True)
    rot_z = {"y+": 0.0, "x+": -math.pi / 2, "x-": math.pi / 2}[facing]
    pl.rotation_euler = (math.radians(90), 0, rot_z + (math.pi if facing == "y+" else 0))
    pl.location = loc
    mat, nt = new_material(f"{name}Mat")
    bsdf = nt.nodes["Principled BSDF"]
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    uv = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (su, sv, 1)
    mapping.inputs["Location"].default_value = ((1 - su) / 2, (1 - sv) / 2, 0)
    nt.links.new(uv.outputs["UV"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], tex.inputs["Vector"])
    # PNGs com fundo transparente (os estudos a pena): compoe sobre
    # pergaminho, senao o Cycles le a transparencia como preto
    paper = nt.nodes.new("ShaderNodeMix")
    paper.data_type = 'RGBA'
    paper.inputs["A"].default_value = (0.36, 0.28, 0.17, 1)
    nt.links.new(tex.outputs["Alpha"], paper.inputs["Factor"])
    # (img.channels e sempre 4 no Blender, ate pra JPG -- decide pelo
    # formato: so os estudos .png sao recortados com transparencia)
    if image_file.lower().endswith(".png"):
        # estudo recortado: o PNG guarda o traco como branco + alpha, entao
        # o alpha vira tinta sepia sobre o pergaminho (como no papel real)
        paper.inputs["B"].default_value = (0.045, 0.028, 0.015, 1)
    else:
        nt.links.new(tex.outputs["Color"], paper.inputs["B"])
    color_out = paper.outputs["Result"]
    nt.links.new(color_out, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.9
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.0
    if emission > 0:
        # painel retroiluminado: a propria imagem emite
        nt.links.new(color_out, bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = emission
    pl.data.materials.append(mat)
    return pl


def lath_run(name, x, y_start, y_len, z0, height):
    """fileira de ripas igual as paredes do corredor (mesma secao, mesmo
    passo), correndo em -Y a partir de y_start"""
    bpy.ops.mesh.primitive_cube_add(size=1)
    lath = bpy.context.active_object
    lath.name = name
    lath.scale = (0.045, 0.035, height)
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.modifier_add(type='BEVEL')
    lath.modifiers["Bevel"].width = 0.012
    lath.modifiers["Bevel"].segments = 3
    lath.data.materials.append(mat_wall)
    arr = lath.modifiers.new("Array", 'ARRAY')
    arr.count = int(y_len / 0.0543)
    arr.use_relative_offset = True
    arr.relative_offset_displace = (0, -1.55, 0)
    lath.location = (x, y_start, z0 + height / 2)
    return lath


def build_lobby():
    wall_front = DOOR_Y + WALL_T  # face da parede do fundo voltada pro atrio

    # --- parede do fundo, com a porta do corredor (vao 2*CORR_HALF_W x WALL_HEIGHT) ---
    box_span("DoorWall_L", -LOBBY_HALF_W, -CORR_HALF_W, DOOR_Y, wall_front, SUNKEN_Z, LOBBY_TOP, mat_concrete)
    box_span("DoorWall_R", CORR_HALF_W, LOBBY_HALF_W, DOOR_Y, wall_front, SUNKEN_Z, LOBBY_TOP, mat_concrete)
    box_span("DoorWall_Top", -CORR_HALF_W, CORR_HALF_W, DOOR_Y, wall_front, WALL_HEIGHT, LOBBY_TOP, mat_concrete)
    box_span("DoorWall_Sill", -CORR_HALF_W, CORR_HALF_W, DOOR_Y, wall_front, SUNKEN_Z, -0.1, mat_concrete)

    # --- casca do atrio: laterais, parede de tras, teto, piso rebaixado ---
    box_span("LobbySide_L", -LOBBY_HALF_W - WALL_T, -LOBBY_HALF_W, DOOR_Y, LOBBY_BACK_Y, SUNKEN_Z, LOBBY_TOP, mat_concrete)
    box_span("LobbySide_R", LOBBY_HALF_W, LOBBY_HALF_W + WALL_T, DOOR_Y, LOBBY_BACK_Y, SUNKEN_Z, LOBBY_TOP, mat_concrete)
    box_span("LobbyBack", -LOBBY_HALF_W, LOBBY_HALF_W, LOBBY_BACK_Y, LOBBY_BACK_Y + WALL_T, SUNKEN_Z, LOBBY_TOP, mat_concrete)
    box_span("LobbyCeil", -LOBBY_HALF_W, LOBBY_HALF_W, DOOR_Y, LOBBY_BACK_Y, LOBBY_TOP, LOBBY_TOP + 0.2, mat_ceil)
    box_span("SunkenFloor", -LOBBY_HALF_W, LOBBY_HALF_W, wall_front, LOBBY_BACK_Y, SUNKEN_Z - 0.1, SUNKEN_Z, mat_floor)

    # --- passarela no nivel do corredor (z=0), com guarda-corpos ripados ---
    # comeca em DOOR_Y (nao na face do atrio) pra cobrir tambem o chao
    # dentro da espessura da parede, onde o piso do corredor ainda nao chegou
    box_span("Bridge", -CORR_HALF_W, CORR_HALF_W, DOOR_Y, LOBBY_BACK_Y, -0.35, 0.0, mat_floor)
    for side in (-1, 1):
        # testeira escura na borda da passarela (o "degrau" visto de cima)
        box_span(f"BridgeEdge_{side}", side * CORR_HALF_W - 0.04, side * CORR_HALF_W + 0.04,
                 wall_front, LOBBY_BACK_Y, -0.35, 0.02, mat_wall)
        lath_run(f"Rail_{side}", side * CORR_HALF_W, LOBBY_BACK_Y - 0.4,
                 LOBBY_BACK_Y - 0.4 - wall_front, 0.0, RAIL_H)

    # --- mezaninos laterais com luminarias embutidas por baixo ---
    for side in (-1, 1):
        x_in, x_out = side * MEZZ_INNER_X, side * LOBBY_HALF_W
        box_span(f"Mezz_{side}", min(x_in, x_out), max(x_in, x_out), wall_front, LOBBY_BACK_Y,
                 MEZZ_Z, MEZZ_Z + 0.35, mat_concrete)
        # guarda-corpo de vidro escuro = faixa solida baixa, le como vidro fume
        box_span(f"MezzRail_{side}", x_in - 0.03, x_in + 0.03, wall_front, LOBBY_BACK_Y,
                 MEZZ_Z + 0.35, MEZZ_Z + 1.3, mat_backdrop)
        for k, y in enumerate((wall_front + 1.5, wall_front + 4.5, wall_front + 7.5, wall_front + 10.5)):
            x_l = side * (MEZZ_INNER_X + 0.6)
            bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=0.02, location=(x_l, y, MEZZ_Z - 0.01))
            bpy.context.active_object.data.materials.append(mat_lamp)
            bpy.ops.object.light_add(type='SPOT', location=(x_l, y, MEZZ_Z - 0.05))
            spot = bpy.context.active_object
            spot.data.energy = 420
            spot.data.spot_size = math.radians(60)
            spot.data.spot_blend = 0.8
            spot.data.color = (1.0, 0.84, 0.64)
            look_at(spot, (side * LOBBY_HALF_W, y, SUNKEN_Z + 0.9))

    # --- vitrines no nivel rebaixado, nas paredes laterais ---
    vitrine_imgs = ["estudo-salvator.jpg", "sketch-flyer2.jpg", "sketch-vitruvian.png",
                    "last-supper.jpg", "sketch-flyer.png", "estudo-salvator.jpg"]
    for side in (-1, 1):
        for k, yc in enumerate((wall_front + 2.6, wall_front + 6.5, wall_front + 10.4)):
            x_wall = side * LOBBY_HALF_W
            facing = "x+" if side < 0 else "x-"
            # fundo claro da vitrine, colado na parede
            box_span(f"VitBg_{side}_{k}", min(x_wall, x_wall - side * 0.04), max(x_wall, x_wall - side * 0.04),
                     yc - 1.4, yc + 1.4, SUNKEN_Z + 0.5, SUNKEN_Z + 2.4, mat_vitrine_bg)
            for j, dy in enumerate((-0.75, 0.0, 0.75)):
                img = vitrine_imgs[(k * 3 + j + (0 if side < 0 else 2)) % len(vitrine_imgs)]
                image_plane(f"VitImg_{side}_{k}_{j}", img, 0.55, 0.7,
                            (x_wall - side * 0.05, yc + dy, SUNKEN_Z + 1.5), facing)
            bpy.ops.object.light_add(type='AREA', location=(x_wall - side * 0.5, yc, SUNKEN_Z + 2.35))
            vl = bpy.context.active_object
            vl.data.energy = 90
            vl.data.size = 2.4
            vl.data.color = (1.0, 0.9, 0.76)
            look_at(vl, (x_wall, yc, SUNKEN_Z + 1.2))

    # --- vitrines na parede do fundo, ladeando a porta (a fileira de
    # baixo do print de referencia) ---
    back_imgs = [("sketch-vitruvian.png", "estudo-salvator.jpg"), ("last-supper.jpg", "sketch-flyer.png")]
    for side in (-1, 1):
        for k, (x0, x1) in enumerate(((1.9, 3.7), (4.2, 6.1))):
            xa, xb = sorted((side * x0, side * x1))
            box_span(f"BackVitBg_{side}_{k}", xa, xb, wall_front, wall_front + 0.04,
                     -1.0, 1.3, mat_vitrine_bg)
            xm = (xa + xb) / 2
            for j, img in enumerate(back_imgs[k]):
                dx = (j - 0.5) * 0.85
                image_plane(f"BackVitImg_{side}_{k}_{j}", img, 0.65, 0.8,
                            (xm + dx, wall_front + 0.05, 0.25), "y+")
            bpy.ops.object.light_add(type='AREA', location=(xm, wall_front + 0.5, 1.25))
            bl = bpy.context.active_object
            bl.data.energy = 70
            bl.data.size = 1.8
            bl.data.color = (1.0, 0.9, 0.76)
            look_at(bl, (xm, wall_front, 0.0))

    # fita de led quente no pe dos guarda-corpos: lambe as ripas de baixo
    # pra cima e desenha duas linhas de fuga apontando pra porta
    for side in (-1, 1):
        strip = box_span(f"LedStrip_{side}", side * (CORR_HALF_W - 0.06) - 0.01, side * (CORR_HALF_W - 0.06) + 0.01,
                         wall_front, LOBBY_BACK_Y - 0.4, 0.0, 0.015, mat_lamp)
        bpy.ops.object.light_add(type='AREA', location=(side * (CORR_HALF_W - 0.1), (wall_front + LOBBY_BACK_Y) / 2, 0.03))
        led = bpy.context.active_object
        led.data.shape = 'RECTANGLE'
        led.data.size = 0.05
        led.data.size_y = LOBBY_BACK_Y - wall_front
        led.data.energy = 160
        led.data.color = (1.0, 0.78, 0.5)
        led.rotation_euler = (0, math.radians(-side * 70), 0)

    # --- paineis retroiluminados no alto da parede do fundo (as obras
    # vistas de longe, antes da caminhada ate cada uma) ---
    panel_y = wall_front + 0.02
    panel_z = WALL_HEIGHT + 0.55 + 1.15
    for x, img in ((2.75, "gioconda_only.jpeg"), (0.0, "sketch-vitruvian.png"), (-2.75, "sketch-flyer.png")):
        image_plane(f"Panel_{img}", img, 2.1, 2.1, (x, panel_y, panel_z), "y+", emission=0.55)

    # --- pontos de luz nos cantos altos (as "estrelas" do print de referencia) ---
    for x in (-5.4, 5.4):
        for y in (wall_front + 3.0, LOBBY_BACK_Y - 2.5):
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.05, location=(x, y, LOBBY_TOP - 0.15))
            bpy.context.active_object.data.materials.append(mat_lamp)

    # luz de ambiente do atrio, quente e suave, pra o concreto ler
    bpy.ops.object.light_add(type='AREA', location=(0, (wall_front + LOBBY_BACK_Y) / 2, LOBBY_TOP - 0.3))
    amb = bpy.context.active_object
    amb.data.energy = 1500
    amb.data.size = 9.0
    amb.data.color = (1.0, 0.88, 0.72)

    # rasante quente na parede do fundo, por baixo dos paineis (onde vai o
    # titulo em DOM) -- da volume ao concreto e emoldura a porta
    bpy.ops.object.light_add(type='SPOT', location=(0, wall_front + 4.0, 1.0))
    wash = bpy.context.active_object
    wash.data.energy = 600
    wash.data.spot_size = math.radians(70)
    wash.data.spot_blend = 0.9
    wash.data.color = (1.0, 0.82, 0.6)
    look_at(wash, (0, wall_front, WALL_HEIGHT + 0.4))

    start = (0.0, LOBBY_BACK_Y - 1.2, 2.3)
    start_target = (0.0, wall_front, 2.55)
    return {"start": start, "start_target": start_target}


LOBBY = build_lobby()


# ---------- saida: o ultimo trecho, sem obra e sem luz ----------
# Espelho da entrada: la uma porta acesa puxa a camera pra dentro; aqui,
# depois da ultima obra, a camera faz o mesmo giro dos outros trechos e
# entra num corredor que nao leva a nada iluminado -- a luz da obra fica
# pra tras e a imagem afunda no escuro. O site solta o pin ja na cor de
# fundo da secao seguinte (--ink), entao o fim do video VIRA a pagina.
EXIT_LEN = 7.0


def build_exit(last_leg):
    ldx, ldy = last_leg["dir"]
    # o proximo trecho do ziguezague: alterna a direcao como os outros
    dx, dy = (0.0, -1.0) if ldx != 0 else (1.0, 0.0)
    end = (last_leg["origin"][0] + ldx * LEG_LENGTH, last_leg["origin"][1] + ldy * LEG_LENGTH)

    def mix(a_ld, a_d, base=end):
        return (base[0] + a_ld * ldx + a_d * dx, base[1] + a_ld * ldy + a_d * dy)

    # as ripas comecam 1.4m pra dentro da direcao nova: deixa livre a
    # diagonal por onde a camera corta, por tras do painel da ultima obra
    origin = mix(0.6, 1.4)
    lat = (-dy, dx)
    theta = math.atan2(-dx, dy)

    def at(dist, lat_off=0.0, z=0.0):
        return (origin[0] + dx * dist + lat[0] * lat_off,
                origin[1] + dy * dist + lat[1] * lat_off, z)

    floor = add_box("Floor_exit", at(EXIT_LEN / 2, 0, -0.05), (CORR_HALF_W * 2, EXIT_LEN, 0.1), mat_floor)
    floor.rotation_euler = (0, 0, theta)
    ceil = add_box("Ceil_exit", at(EXIT_LEN / 2, 0, WALL_HEIGHT + 0.05), (CORR_HALF_W * 2, EXIT_LEN, 0.1), mat_ceil)
    ceil.rotation_euler = (0, 0, theta)
    for side_sign in (-1, 1):
        bpy.ops.mesh.primitive_cube_add(size=1)
        lath = bpy.context.active_object
        lath.name = f"Lath_exit_{side_sign}"
        lath.scale = (0.045, 0.035, WALL_HEIGHT)
        bpy.ops.object.transform_apply(scale=True)
        bpy.ops.object.modifier_add(type='BEVEL')
        lath.modifiers["Bevel"].width = 0.012
        lath.modifiers["Bevel"].segments = 3
        lath.data.materials.append(mat_wall)
        arr = lath.modifiers.new("Array", 'ARRAY')
        arr.count = int(EXIT_LEN / 0.0543)
        arr.use_relative_offset = True
        arr.relative_offset_displace = (0, 1.55, 0)
        lath.location = at(0, side_sign * CORR_HALF_W, WALL_HEIGHT / 2)
        lath.rotation_euler = (0, 0, theta)
    turn = mix(-1.1, 0.55)
    turn_target = mix(1.0, 2.9)
    return {"turn": (turn[0], turn[1], 1.37), "turn_target": (turn_target[0], turn_target[1], 1.25),
            "entry": at(0.8, 0, 1.35), "deep": at(EXIT_LEN + 4, 0, 1.2),
            "final": at(EXIT_LEN - 1.2, 0, 1.35)}


EXIT = build_exit(LEGS[-1])

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
# saguao: um respiro parado no enquadramento de abertura (o frame que o
# Hero dissolve), depois a caminhada pela passarela ate a porta
LOBBY_HOLD_F = round(1.0 * FPS)
LOBBY_WALK_F = round(4.2 * FPS)
EXIT_WALK_F = round(2.2 * FPS)

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
key_both(frame, LOBBY["start"], LOBBY["start_target"])
frame += LOBBY_HOLD_F
key_both(frame, LOBBY["start"], LOBBY["start_target"])
frame += LOBBY_WALK_F
# janelas de parada de cada obra, em frames -- exportadas em JSON pra
# GallerySection nao precisar de numeros magicos copiados daqui
STOPS = []
for i, info in enumerate(STOP_INFO):
    if i == 0:
        key_both(frame, info["entry"], info["target"])
    STOPS.append([frame, frame + HOLD_F])
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

# saida: vira pra direita (a ultima obra sai pela esquerda do quadro),
# corta por tras do painel dela e segue reto pro escuro
key_both(frame + TRANS_F // 2, EXIT["turn"], EXIT["turn_target"])
frame += TRANS_F
key_both(frame, EXIT["entry"], EXIT["deep"])
exit_frame = frame
frame += EXIT_WALK_F
key_both(frame, EXIT["final"], EXIT["deep"])

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
# 128 + denoiser: no preview em 100% nao da pra distinguir de 180, e
# corta ~30% de um render que ja passa de 4h na 1050 Ti
scene.cycles.samples = 128
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
scene.render.image_settings.file_format = 'PNG'

# GALLERY_MODE=preview: poucos frames-chave, baixa resolucao e poucos
# samples -- pra validar enquadramento em minutos antes do render de horas
MODE = os.environ.get("GALLERY_MODE", "full")
timing = {"fps": FPS, "frames": scene.frame_end, "lobbyHoldEnd": 1 + LOBBY_HOLD_F,
          "doorFrame": 1 + LOBBY_HOLD_F + LOBBY_WALK_F, "stops": STOPS,
          "exitFrame": exit_frame}
print("TIMING:", timing)

if MODE == "inspect":
    for f in [int(x) for x in os.environ.get("GALLERY_FRAMES", "1").split(",")]:
        scene.frame_set(f)
        print("CAM", f, tuple(round(v, 2) for v in cam.matrix_world.translation),
              "TGT", tuple(round(v, 2) for v in cam_target.matrix_world.translation))
elif MODE == "preview":
    scene.cycles.samples = int(os.environ.get("GALLERY_SAMPLES", "32"))
    scene.render.resolution_percentage = int(os.environ.get("GALLERY_PCT", "50"))
    preview_dir = os.path.join(ROOT, "blender", "renders", "preview_lobby")
    os.makedirs(preview_dir, exist_ok=True)
    env_frames = os.environ.get("GALLERY_FRAMES")
    if env_frames:
        frames = [int(f) for f in env_frames.split(",")]
    else:
        door = timing["doorFrame"]
        frames = [1, 1 + LOBBY_HOLD_F + LOBBY_WALK_F // 3, 1 + LOBBY_HOLD_F + 2 * LOBBY_WALK_F // 3,
                  door - 8, door, door + 12, STOPS[0][1], STOPS[-1][1],
                  STOPS[-1][1] + TRANS_F // 2, exit_frame, exit_frame + EXIT_WALK_F // 2, scene.frame_end]
    t0 = time.time()
    for f in sorted(set(frames)):
        if f > scene.frame_end:
            continue
        scene.frame_set(f)
        scene.render.filepath = os.path.join(preview_dir, f"f{f:04d}.png")
        bpy.ops.render.render(write_still=True)
    print("RENDER_SECONDS:", time.time() - t0)
    print("DONE:", preview_dir)
else:
    import json
    seq_dir = os.path.join(ROOT, "blender", "renders", os.environ.get("GALLERY_SEQ_DIR", "sequence_v2"))
    os.makedirs(seq_dir, exist_ok=True)
    scene.render.filepath = os.path.join(seq_dir, "frame_")
    # a GallerySection importa esse JSON: as janelas das legendas e o
    # fade final saem do mesmo calculo que posicionou a camera
    with open(os.path.join(ROOT, "src", "components", "sections", "gallery-timing.json"), "w") as fh:
        json.dump(timing, fh, indent=2)
    t0 = time.time()
    bpy.ops.render.render(animation=True)
    print("RENDER_SECONDS:", time.time() - t0)
    print("FRAMES:", scene.frame_start, "-", scene.frame_end)
    print("DONE:", seq_dir)
