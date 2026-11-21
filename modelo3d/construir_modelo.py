"""
Proyecto 5 · Modelo 3D del péndulo para el simulador web.

Se ejecuta con Blender 5.2 en modo consola (no abre ventana):

    "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup ^
        --python modelo3d/construir_modelo.py

Qué hace:
  1. Construye el soporte (base de nogal, columnas, viga, brazos, rodamientos, tornillos)
     y las piezas móviles (eje, varilla y pesa).
  2. Hornea (bake) la luz del estudio en una textura de 1024 px para las piezas fijas
     y la sombra de contacto sobre el piso. En el navegador esas piezas ya no calculan luz.
  3. Exporta la geometría comprimida a modelo3d/salida/geometria.json y las texturas en PNG.
     Después, modelo3d/empaquetar.py arma vendor/pendulo_modelo.js para el HTML.

Coordenadas: el simulador (Three.js) usa Y hacia arriba. Blender usa Z hacia arriba.
La función B(x, y, z) convierte una posición del simulador a Blender: (x, -z, y).
"""
import bpy
import math
import os
import json
import base64
import array
from mathutils import Vector

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.join(AQUI, "salida")
os.makedirs(SALIDA, exist_ok=True)

PIVOT_Y = 2.65          # altura del pivote en el simulador [m]
RIGS_X = (-1.5, 1.5)    # péndulo real (izquierda) y lineal (derecha)
ATLAS = 1024            # resolución de la textura horneada
SUELO = -0.30           # altura del piso


def B(x, y, z):
    """Posición del simulador (Y arriba) -> Blender (Z arriba)."""
    return Vector((x, -z, y))


# ---------------------------------------------------------------------------
# 0. Escena vacía
# ---------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"


def usar_gpu():
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for tipo in ("OPTIX", "CUDA"):
            try:
                prefs.compute_device_type = tipo
                prefs.get_devices()
                devs = [d for d in prefs.devices if d.type == tipo]
                if devs:
                    for d in prefs.devices:
                        d.use = d.type == tipo
                    scene.cycles.device = "GPU"
                    print("[modelo] Cycles con GPU:", tipo, [d.name for d in devs])
                    return
            except Exception:
                pass
    except Exception as e:
        print("[modelo] sin GPU:", e)
    scene.cycles.device = "CPU"
    print("[modelo] Cycles con CPU")


usar_gpu()


# ---------------------------------------------------------------------------
# 1. Materiales (los del bake y los de la vista previa)
# ---------------------------------------------------------------------------
def nodos(mat):
    try:
        mat.use_nodes = True
    except Exception:
        pass
    return mat.node_tree.nodes, mat.node_tree.links


def mat_principled(nombre, color, metal=0.0, rough=0.5):
    m = bpy.data.materials.new(nombre)
    n, _ = nodos(m)
    p = n.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Metallic"].default_value = metal
    p.inputs["Roughness"].default_value = rough
    return m


def mat_nogal():
    """Madera de nogal procedimental: anillos deformados + poro fino."""
    m = bpy.data.materials.new("Nogal")
    n, l = nodos(m)
    p = n.get("Principled BSDF")
    tc = n.new("ShaderNodeTexCoord")
    mp = n.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (0.35, 2.2, 1.0)   # vetas a lo largo de X
    l.new(tc.outputs["Object"], mp.inputs["Vector"])

    noise = n.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 2.2
    noise.inputs["Detail"].default_value = 6.0
    l.new(mp.outputs["Vector"], noise.inputs["Vector"])

    wave = n.new("ShaderNodeTexWave")
    wave.wave_type = "RINGS"
    wave.rings_direction = "X"
    wave.inputs["Scale"].default_value = 3.2
    wave.inputs["Distortion"].default_value = 9.0
    wave.inputs["Detail"].default_value = 3.0
    wave.inputs["Detail Scale"].default_value = 1.4
    l.new(mp.outputs["Vector"], wave.inputs["Vector"])

    fino = n.new("ShaderNodeTexNoise")              # poro fino de la madera
    fino.inputs["Scale"].default_value = 140.0
    fino.inputs["Detail"].default_value = 2.0
    mp2 = n.new("ShaderNodeMapping")
    mp2.inputs["Scale"].default_value = (0.08, 3.0, 3.0)
    l.new(tc.outputs["Object"], mp2.inputs["Vector"])
    l.new(mp2.outputs["Vector"], fino.inputs["Vector"])

    mezcla = n.new("ShaderNodeMath")
    mezcla.operation = "MULTIPLY_ADD"
    mezcla.inputs[1].default_value = 0.8
    l.new(wave.outputs["Fac"], mezcla.inputs[0])
    l.new(noise.outputs["Fac"], mezcla.inputs[2])

    ramp = n.new("ShaderNodeValToRGB")
    e = ramp.color_ramp.elements
    e[0].position, e[0].color = 0.25, (0.085, 0.040, 0.020, 1)
    e[1].position, e[1].color = 0.95, (0.30, 0.155, 0.075, 1)
    mid = e.new(0.6)
    mid.color = (0.19, 0.095, 0.045, 1)
    l.new(mezcla.outputs["Value"], ramp.inputs["Fac"])

    poro = n.new("ShaderNodeMix")
    poro.data_type = "RGBA"
    poro.blend_type = "MULTIPLY"
    poro.inputs["Factor"].default_value = 0.35
    l.new(ramp.outputs["Color"], poro.inputs["A"])
    l.new(fino.outputs["Fac"], poro.inputs["B"])
    l.new(poro.outputs["Result"], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = 0.42
    return m


NOGAL = mat_nogal()
GRAFITO = mat_principled("Grafito", (0.055, 0.065, 0.080), metal=0.0, rough=0.55)
NEGRO = mat_principled("Zocalo", (0.018, 0.020, 0.024), metal=0.0, rough=0.7)
ACERO = mat_principled("Acero", (0.62, 0.64, 0.67), metal=1.0, rough=0.28)
LATON = mat_principled("Laton", (0.90, 0.62, 0.22), metal=1.0, rough=0.18)
VIOLETA = mat_principled("Violeta", (0.62, 0.22, 0.75), metal=0.85, rough=0.25)


# ---------------------------------------------------------------------------
# 2. Ayudas de modelado
# ---------------------------------------------------------------------------
def activar(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def biselar(obj, ancho, segs=3, angulo=40):
    activar(obj)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    m = obj.modifiers.new("Bisel", "BEVEL")
    m.width = ancho
    m.segments = segs
    m.limit_method = "ANGLE"
    m.angle_limit = math.radians(angulo)
    bpy.ops.object.modifier_apply(modifier=m.name)
    return obj


def caja(nombre, centro, tam, mat, bisel=0.0, segs=3):
    """centro y tam en coordenadas del simulador (x, y, z)."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=B(*centro))
    o = bpy.context.active_object
    o.name = nombre
    o.scale = (tam[0], tam[2], tam[1])
    o.data.materials.append(mat)
    if bisel:
        biselar(o, bisel, segs)
    else:
        activar(o)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return o


def cilindro(nombre, centro, radio, largo, eje, mat, lados=32, bisel=0.0, segs=2):
    """eje: 'y' (vertical en el simulador) o 'z' (hacia la cámara)."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=lados, radius=radio, depth=largo, location=B(*centro))
    o = bpy.context.active_object
    o.name = nombre
    if eje == "z":
        o.rotation_euler = (math.radians(90), 0, 0)
    o.data.materials.append(mat)
    if bisel:
        biselar(o, bisel, segs)
    else:
        activar(o)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return o


def suavizar(obj, angulo=32):
    activar(obj)
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angulo))
    except Exception:
        bpy.ops.object.shade_smooth()


def unir(nombre, objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = nombre
    return o


def tornillo(centro, eje="y", r=0.016):
    """Cabeza hexagonal con bisel."""
    return cilindro("tornillo", centro, r, 0.012, eje, ACERO, lados=6, bisel=0.003, segs=1)


# ---------------------------------------------------------------------------
# 3. Soporte fijo
# ---------------------------------------------------------------------------
horneadas = []      # piezas que se hornean (luz guardada en la textura)
metal = []          # piezas metálicas fijas (brillo en tiempo real)

BASE_Y = -0.14      # base de 14 cm: cara superior en y = -0.07
BASE_Z = -0.10
horneadas.append(caja("base", (0, BASE_Y, BASE_Z), (6.2, 0.14, 1.5), NOGAL, bisel=0.022, segs=4))
horneadas.append(caja("zocalo", (0, -0.235, BASE_Z), (6.0, 0.05, 1.32), NEGRO, bisel=0.006, segs=1))

# Filete de latón incrustado en el frente de la base
metal.append(caja("filete", (0, -0.069, BASE_Z + 0.60), (5.9, 0.006, 0.018), LATON, bisel=0.002, segs=1))

# Patas niveladoras
for x in (-2.85, 2.85):
    for z in (BASE_Z - 0.55, BASE_Z + 0.55):
        metal.append(cilindro("pata", (x, -0.28, z), 0.075, 0.04, "y", ACERO, lados=24, bisel=0.008))

COL_X, COL_Z = 2.75, -0.35
VIGA_Y = 2.72
for sx in (-1, 1):
    x = sx * COL_X
    alto = (VIGA_Y + 0.07) - (-0.07)
    horneadas.append(caja("columna", (x, -0.07 + alto / 2, COL_Z), (0.13, alto, 0.13), GRAFITO, bisel=0.014, segs=3))
    horneadas.append(caja("brida", (x, -0.055, COL_Z), (0.32, 0.03, 0.32), GRAFITO, bisel=0.008, segs=2))
    for dx in (-0.11, 0.11):
        for dz in (-0.11, 0.11):
            metal.append(tornillo((x + dx, -0.034, COL_Z + dz)))

horneadas.append(caja("viga", (0, VIGA_Y, COL_Z), (5.9, 0.14, 0.14), GRAFITO, bisel=0.016, segs=3))
# Ranura frontal de la viga (perfil de aluminio)
horneadas.append(caja("ranura", (0, VIGA_Y, COL_Z + 0.072), (5.6, 0.035, 0.008), NEGRO))

for x in RIGS_X:
    # Brazo que sale de la viga hacia el plano de oscilación
    horneadas.append(caja("brazo", (x, VIGA_Y, -0.215), (0.10, 0.10, 0.27), GRAFITO, bisel=0.012, segs=3))
    # Caja del rodamiento (eje hacia la cámara)
    metal.append(cilindro("rodamiento", (x, PIVOT_Y, -0.06), 0.088, 0.075, "z", ACERO, lados=40, bisel=0.01, segs=2))
    metal.append(cilindro("pista", (x, PIVOT_Y, -0.018), 0.062, 0.012, "z", LATON, lados=40, bisel=0.003, segs=1))
    for k in range(3):
        a = math.radians(90 + 120 * k)
        metal.append(tornillo((x + 0.072 * math.cos(a), PIVOT_Y + 0.072 * math.sin(a), -0.02), eje="z", r=0.011))

for o in horneadas + metal:
    suavizar(o, 35)

estatico = unir("Soporte_horneado", horneadas)
metalico = unir("Soporte_metal", metal)

# ---------------------------------------------------------------------------
# 4. Piezas móviles (una sola vez; el simulador las copia para los dos péndulos)
#    Origen = pivote. La varilla mide 1 m hacia abajo y el simulador la escala por L.
# ---------------------------------------------------------------------------
eje = cilindro("eje", (0, 0, 0.012), 0.026, 0.08, "z", ACERO, lados=24, bisel=0.004)
tuerca = cilindro("tuerca", (0, 0, 0.055), 0.04, 0.022, "z", ACERO, lados=6, bisel=0.004, segs=1)
abrazadera = caja("abrazadera", (0, -0.035, 0.01), (0.062, 0.1, 0.044), ACERO, bisel=0.008, segs=2)
for o in (eje, tuerca, abrazadera):
    suavizar(o, 35)
cubo = unir("Eje", [eje, tuerca, abrazadera])

bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.011, depth=1.0, location=B(0, -0.5, 0))
varilla = bpy.context.active_object
varilla.name = "Varilla"
varilla.data.materials.append(ACERO)
activar(varilla)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
suavizar(varilla, 60)

bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=22, radius=0.19, location=B(0, 0, 0))
esfera = bpy.context.active_object
esfera.data.materials.append(LATON)
collar = cilindro("collar", (0, 0.205, 0), 0.042, 0.075, "y", LATON, lados=28, bisel=0.008)
banda = cilindro("banda", (0, 0, 0), 0.1925, 0.022, "y", LATON, lados=40, bisel=0.004, segs=1)
for o in (esfera, collar, banda):
    suavizar(o, 40)
pesa = unir("Pesa", [esfera, collar, banda])

# El origen de cada pieza móvil queda en el pivote (0, 0, 0), y no tapan nada en el horneado
for o in (cubo, varilla, pesa):
    activar(o)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.hide_render = True

# ---------------------------------------------------------------------------
# 5. Piso para la sombra de contacto
# ---------------------------------------------------------------------------
bpy.ops.mesh.primitive_plane_add(size=1, location=B(0, SUELO, BASE_Z))
piso = bpy.context.active_object
piso.name = "Piso"
piso.scale = (8.4, 3.4, 1)
activar(piso)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
piso.data.materials.append(mat_principled("Piso", (0.5, 0.5, 0.5), rough=0.9))

# ---------------------------------------------------------------------------
# 6. Estudio de luces (solo para hornear y para la vista previa)
# ---------------------------------------------------------------------------
world = bpy.data.worlds.new("Estudio")
scene.world = world
wn, _ = nodos(world)
bg = wn.get("Background")
bg.inputs["Color"].default_value = (0.10, 0.12, 0.16, 1)
bg.inputs["Strength"].default_value = 0.35


def luz_area(nombre, pos_sim, objetivo_sim, energia, tam, color=(1, 1, 1)):
    d = bpy.data.lights.new(nombre, "AREA")
    d.shape = "RECTANGLE"
    d.size, d.size_y = tam
    d.energy = energia
    d.color = color
    o = bpy.data.objects.new(nombre, d)
    scene.collection.objects.link(o)
    o.location = B(*pos_sim)
    o.rotation_euler = (B(*objetivo_sim) - o.location).to_track_quat("-Z", "Y").to_euler()
    return o


luz_area("Clave", (3.5, 6.0, 4.5), (0, 1.0, 0), 800, (4.0, 3.0), (1.0, 0.95, 0.88))
luz_area("Relleno", (-5.0, 3.0, 3.0), (0, 1.2, 0), 220, (3.0, 3.0), (0.82, 0.9, 1.0))
luz_area("Cenital", (0, 7.0, 0), (0, 0, 0), 330, (6.0, 2.0))
luz_area("Contra", (0, 3.5, -5.0), (0, 1.5, 0), 200, (6.0, 2.0), (0.9, 0.85, 1.0))

# ---------------------------------------------------------------------------
# 7. UV y horneado
# ---------------------------------------------------------------------------
def uv_atlas(obj, margen=0.012):
    activar(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(50), island_margin=margen)
    try:
        bpy.ops.uv.pack_islands(rotate=True, margin=margen)
    except Exception as e:
        print("[modelo] pack_islands:", e)
    bpy.ops.object.mode_set(mode="OBJECT")


def preparar_bake(obj, imagen):
    """Pone un nodo de imagen activo (sin conectar) en cada material del objeto."""
    for slot in obj.material_slots:
        n, _ = nodos(slot.material)
        for viejo in [x for x in n if x.name == "BakeTarget"]:
            n.remove(viejo)
        t = n.new("ShaderNodeTexImage")
        t.name = "BakeTarget"
        t.image = imagen
        n.active = t


def quitar_bake(obj):
    for slot in obj.material_slots:
        n, _ = nodos(slot.material)
        for viejo in [x for x in n if x.name == "BakeTarget"]:
            n.remove(viejo)


def quitar_caras_ocultas(obj):
    """Borra las caras que miran hacia abajo: nunca se ven y gastarían textura."""
    import bmesh
    activar(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)  # local = mundo
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.normal_update()
    # Hacia abajo, o la tapa del zócalo (queda debajo de la base, a la altura y = -0.21)
    abajo = [f for f in bm.faces if f.normal.z < -0.7 or
             (f.normal.z > 0.7 and abs(f.calc_center_median().z - (-0.21)) < 0.004)]
    bmesh.ops.delete(bm, geom=abajo, context="FACES")
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    print(f"[modelo] caras ocultas borradas: {len(abajo)}")


quitar_caras_ocultas(estatico)
uv_atlas(estatico)

scene.cycles.samples = 768
scene.cycles.use_denoising = False
bake = scene.render.bake
bake.margin = 12
bake.use_pass_direct = True
bake.use_pass_indirect = True
bake.use_pass_diffuse = True
bake.use_pass_glossy = False
bake.use_pass_transmission = False
bake.use_pass_emit = True

img = bpy.data.images.new("atlas", ATLAS, ATLAS, alpha=False, float_buffer=True)
preparar_bake(estatico, img)
activar(estatico)
print("[modelo] horneando soporte…")
bpy.ops.object.bake(type="COMBINED")
quitar_bake(estatico)
img.filepath_raw = os.path.join(SALIDA, "atlas.png")
img.file_format = "PNG"
img.save()

# Sombra de contacto en el piso: AO horneado sobre un plano
ao = bpy.data.images.new("ao_piso", 512, 256, alpha=False, float_buffer=True)
preparar_bake(piso, ao)
activar(piso)
world.light_settings.distance = 0.9
scene.cycles.samples = 512
print("[modelo] horneando sombra del piso…")
bpy.ops.object.bake(type="AO")
quitar_bake(piso)
ao.filepath_raw = os.path.join(SALIDA, "ao_piso.png")
ao.file_format = "PNG"
ao.save()


# ---------------------------------------------------------------------------
# 8. Exportar geometría comprimida (Y arriba, como el simulador)
# ---------------------------------------------------------------------------
def b64(arr):
    return base64.b64encode(arr.tobytes()).decode("ascii")


def exportar(obj, con_uv):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = ev.to_mesh()
    me.calc_loop_triangles()
    uvl = me.uv_layers.active.data if (con_uv and me.uv_layers.active) else None
    nrm = me.corner_normals
    mw = obj.matrix_world
    mn = mw.to_3x3().inverted().transposed()

    claves, verts, idx = {}, [], []
    for tri in me.loop_triangles:
        for li in tri.loops:
            v = me.vertices[me.loops[li].vertex_index]
            p = mw @ v.co
            n = (mn @ nrm[li].vector).normalized()
            P = (p.x, p.z, -p.y)           # Blender -> simulador
            N = (n.x, n.z, -n.y)
            U = (uvl[li].uv[0], uvl[li].uv[1]) if uvl else (0.0, 0.0)
            k = (round(P[0], 5), round(P[1], 5), round(P[2], 5),
                 round(N[0], 2), round(N[1], 2), round(N[2], 2),
                 round(U[0], 5), round(U[1], 5))
            i = claves.get(k)
            if i is None:
                i = len(verts)
                claves[k] = i
                verts.append((P, N, U))
            idx.append(i)
    ev.to_mesh_clear()

    mn_ = [min(v[0][a] for v in verts) for a in range(3)]
    mx_ = [max(v[0][a] for v in verts) for a in range(3)]
    rng = [max(mx_[a] - mn_[a], 1e-6) for a in range(3)]

    pos = array.array("H", [int(round((v[0][a] - mn_[a]) / rng[a] * 65535)) for v in verts for a in range(3)])
    nor = array.array("b", [int(round(max(-1, min(1, v[1][a])) * 127)) for v in verts for a in range(3)])
    tipo = "H" if len(verts) < 65536 else "I"
    ind = array.array(tipo, idx)
    out = {"n": len(verts), "min": mn_, "rng": rng, "pos": b64(pos), "nor": b64(nor),
           "idx": b64(ind), "i32": tipo == "I", "tris": len(idx) // 3}
    if con_uv:
        out["uv"] = b64(array.array("H", [int(round(max(0, min(1, v[2][a])) * 65535))
                                          for v in verts for a in range(2)]))
    print(f"[modelo] {obj.name}: {len(verts)} vértices, {len(idx)//3} triángulos")
    return out


geo = {
    "pivotY": PIVOT_Y, "rigsX": list(RIGS_X), "sueloY": SUELO,
    "mallas": {
        "soporte": exportar(estatico, True),
        "metal": exportar(metalico, False),
        "eje": exportar(cubo, False),
        "varilla": exportar(varilla, False),
        "pesa": exportar(pesa, False),
        "piso": exportar(piso, True),
    },
}
with open(os.path.join(SALIDA, "geometria.json"), "w", encoding="utf-8") as f:
    json.dump(geo, f)

# ---------------------------------------------------------------------------
# 9. Vista previa en Blender (referencia de cómo debe verse) y archivo .blend
# ---------------------------------------------------------------------------
hm = bpy.data.materials.new("Horneado")
n, l = nodos(hm)
for x in list(n):
    n.remove(x)
t = n.new("ShaderNodeTexImage")
t.image = img
em = n.new("ShaderNodeEmission")
outn = n.new("ShaderNodeOutputMaterial")
l.new(t.outputs["Color"], em.inputs["Color"])
l.new(em.outputs["Emission"], outn.inputs["Surface"])
estatico.data.materials.clear()
estatico.data.materials.append(hm)

for x, mat, grados in ((RIGS_X[0], LATON, 35), (RIGS_X[1], VIOLETA, 24)):
    a = math.radians(grados)
    for fuente in (cubo, varilla, pesa):
        c = fuente.copy()
        c.data = fuente.data.copy()
        c.hide_render = False
        scene.collection.objects.link(c)
        if fuente is pesa:
            c.data.materials.clear()
            c.data.materials.append(mat)
            c.location = B(x + math.sin(a), PIVOT_Y - math.cos(a), 0)
        else:
            c.location = B(x, PIVOT_Y, 0)
            c.rotation_euler = (0, -a, 0)
for fuente in (cubo, varilla, pesa, piso):
    fuente.hide_render = True

cam_d = bpy.data.cameras.new("Camara")
cam_d.sensor_fit = "VERTICAL"
cam_d.angle_y = math.radians(42)        # el mismo campo de visión que el simulador
cam = bpy.data.objects.new("Camara", cam_d)
scene.collection.objects.link(cam)
cam.location = B(0.52, 2.55, 6.5)
cam.rotation_euler = (B(0, 1.5, 0) - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam
scene.render.resolution_x, scene.render.resolution_y = 1280, 720
scene.cycles.samples = 96
scene.cycles.use_denoising = True
scene.render.filepath = os.path.join(SALIDA, "vista_previa.png")
bpy.ops.render.render(write_still=True)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(AQUI, "pendulo.blend"))
print("[modelo] listo:", SALIDA)
