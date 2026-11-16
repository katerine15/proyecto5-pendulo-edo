"""Genera los modelos 3D de alta precisión con relieves mecánicos y horológicos para el dashboard.

Uso (desde la raíz del proyecto, sin abrir la interfaz de Blender):
    "C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe" -b --factory-startup ^
        -P assets/blender/build_pendulum.py -- frontend/public/models/pendulo.glb assets/blender/pendulo.blend frontend/public/models/resorte.glb

Nodos exportados en pendulo.glb:
  - Frame (pórtico A-frame con columnas estriadas, anillos torneados, bridas empernadas, base escalonada con regla en relieve y nivel de burbuja)
  - Arm (varilla con nervaduras, horquilla de áncora, lenteja con bajorrelieves concéntricos, cinturón de latón remachado, tuerca moleteada y aguja)
  - Dial (goniómetro de doble arco con puentes radiales, remaches cada 30° y marcas en relieve de 3 alturas cada 2° / 10° / 30°)
  - EscapeWheel (rueda de escape de latón con dientes biselados, brazos calados y tambor central en relieve)
  - ClockDial (esfera horológica escalonada con bisel perlado de 60 cuentas, 12 índices en alto relieve y subesfera interior)
  - ClockHand (manecilla tipo Breguet con contrapeso anular y punta lanceolada)

Nodos exportados en resorte.glb:
  - SpringFrame (pórtico con columnas cromadas, soportes bridados con pernos, cabezal nervado y escala vernier en relieve)
  - SpringCoil (resorte helicoidal 3D real con espiras de asiento superior/inferior)
  - DamperCylinder (cilindro hidráulico con 9 aletas disipadoras en relieve, tapa de retén y horquilla inferior)
  - MassAssembly (bloque de masa fresado con cavidades laterales en bajorrelieve, pernos hexagonales, cojinetes de bronce y aguja vernier)
"""
import bmesh
import math
import os
import sys
import bpy

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ROOT_DIR = "F:/aps/pendulo-dashboard" if os.path.exists("F:/aps/pendulo-dashboard") else "."
OUT_GLB = argv[0] if argv else os.path.join(ROOT_DIR, "frontend/public/models/pendulo.glb")
OUT_BLEND = argv[1] if len(argv) > 1 else os.path.join(ROOT_DIR, "assets/blender/pendulo.blend")
OUT_SPRING_GLB = argv[2] if len(argv) > 2 else os.path.join(os.path.dirname(OUT_GLB) or ".", "resorte.glb")

ROD = 3.0          # m (longitud visual base de la varilla)
BAR_HALF = 6.4     # semiancho del pórtico principal


def clear_scene():
    """Limpia objetos y mallas sin descargar addons activos (seguro para MCP y CLI)."""
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)


def make_material(name, color, metallic, roughness, alpha=1.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    if b:
        b.inputs["Base Color"].default_value = (*color, 1.0)
        b.inputs["Metallic"].default_value = metallic
        b.inputs["Roughness"].default_value = roughness
        if "Specular IOR Level" in b.inputs:
            b.inputs["Specular IOR Level"].default_value = 0.65
        if "Coat Weight" in b.inputs and metallic < 0.5:
            b.inputs["Coat Weight"].default_value = 0.25
            b.inputs["Coat Roughness"].default_value = 0.15
        if "Alpha" in b.inputs and alpha < 1.0:
            b.inputs["Alpha"].default_value = alpha
    return m


def make_palette():
    return (
        make_material("Steel", (0.72, 0.76, 0.81), 1.0, 0.20),
        make_material("DarkSteel", (0.11, 0.14, 0.18), 0.92, 0.34),
        make_material("Wood", (0.36, 0.21, 0.11), 0.0, 0.44),
        make_material("Brass", (0.88, 0.68, 0.26), 1.0, 0.20),
        make_material("Copper", (0.78, 0.42, 0.24), 1.0, 0.25),
        make_material("Bob", (0.84, 0.85, 0.88), 0.88, 0.20),
        make_material("Dial", (0.92, 0.94, 0.96), 0.05, 0.48),
        make_material("Glass", (0.52, 0.92, 0.74), 0.1, 0.08, alpha=0.65),
    )


def finish(obj, mat, name, bevel=0.0, smooth=True):
    obj.name = name
    obj.data.name = f"{name}_Mesh"
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    if bevel > 0:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        mod.limit_method = "ANGLE"
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def cylinder(name, mat, radius, depth, loc, rot=(0, 0, 0), bevel=0.0, verts=48, smooth=True):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, location=loc, rotation=rot, vertices=verts)
    return finish(bpy.context.active_object, mat, name, bevel, smooth=smooth)


def cone(name, mat, r1, r2, depth, loc, rot=(0, 0, 0), verts=36):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rot, vertices=verts)
    return finish(bpy.context.active_object, mat, name, 0.0)


def sphere(name, mat, radius, loc, scale=(1, 1, 1), segs=48, rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=loc, segments=segs, ring_count=rings)
    o = bpy.context.active_object
    if scale != (1, 1, 1):
        o.scale = scale
        bpy.ops.object.transform_apply(scale=True)
    return finish(o, mat, name, 0.0, smooth=True)


def box(name, mat, size, loc, rot=(0, 0, 0), bevel=0.0, smooth=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, mat, name, bevel, smooth=smooth)


def torus(name, mat, major_r, minor_r, loc, rot=(0, 0, 0), segs=48, ring_segs=16):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_r, minor_radius=minor_r, location=loc, rotation=rot,
        major_segments=segs, minor_segments=ring_segs,
    )
    return finish(bpy.context.active_object, mat, name, 0.0, smooth=True)


def fluted_column(name, mat, base_r, flute_depth, flutes, height, loc, rot=(0, 0, 0), rings_z=24):
    """Columna con estrías longitudinales en relieve real (estilo instrumento clásico)."""
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    bm = bmesh.new()
    verts_per_ring = flutes * 4
    ring_list = []
    for iz in range(rings_z + 1):
        v_z = (iz / rings_z - 0.5) * height
        # desvanecer las estrías cerca de los extremos para transición limpia al capitel/base
        edge_fade = math.sin(min(1.0, min(iz / 2.5, (rings_z - iz) / 2.5)) * math.pi / 2.0)
        row = []
        for iv in range(verts_per_ring):
            ang = (iv / verts_per_ring) * 2.0 * math.pi
            wave = math.cos(ang * flutes)
            r = base_r + flute_depth * edge_fade * wave
            row.append(bm.verts.new((r * math.cos(ang), r * math.sin(ang), v_z)))
        ring_list.append(row)
    for iz in range(rings_z):
        r0, r1 = ring_list[iz], ring_list[iz + 1]
        for iv in range(verts_per_ring):
            ivn = (iv + 1) % verts_per_ring
            bm.faces.new((r0[iv], r0[ivn], r1[ivn], r1[iv]))
    bm.faces.new(ring_list[0][::-1])
    bm.faces.new(ring_list[-1])
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = loc
    obj.rotation_euler = rot
    bpy.context.collection.objects.link(obj)
    return finish(obj, mat, name, 0.0, smooth=True)


def knurled_cylinder(name, mat, base_r, ridge_h, ridges, depth, loc, rot=(0, 0, 0)):
    """Tuerca o rueda moleteada con dientes periféricos en relieve."""
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    bm = bmesh.new()
    n_v = ridges * 2
    bot_ring, top_ring = [], []
    for i in range(n_v):
        ang = (i / n_v) * 2.0 * math.pi
        r = base_r + (ridge_h if i % 2 == 0 else -ridge_h * 0.4)
        x, y = r * math.cos(ang), r * math.sin(ang)
        bot_ring.append(bm.verts.new((x, y, -depth / 2)))
        top_ring.append(bm.verts.new((x, y, depth / 2)))
    for i in range(n_v):
        inext = (i + 1) % n_v
        bm.faces.new((bot_ring[i], bot_ring[inext], top_ring[inext], top_ring[i]))
    bm.faces.new(bot_ring[::-1])
    bm.faces.new(top_ring)
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = loc
    obj.rotation_euler = rot
    bpy.context.collection.objects.link(obj)
    return finish(obj, mat, name, 0.0, smooth=False)


def relief_bob_mesh(name, mat, radius, loc):
    """Lenteja esferoidal con anillos latitudinales en bajorrelieve y escalones torneados."""
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    bm = bmesh.new()
    rings = 48
    segs = 64
    ring_verts = []
    pole_bot = bm.verts.new((0, 0, -radius))
    for ir in range(1, rings):
        phi = -math.pi / 2 + (ir / rings) * math.pi
        z = radius * math.sin(phi)
        r_base = radius * math.cos(phi)
        # Bajorrelieves concéntricos torneados a distintas latitudes
        lat_deg = abs(math.degrees(phi))
        relief = 0.0
        if 18 <= lat_deg <= 26 or 38 <= lat_deg <= 46 or 58 <= lat_deg <= 65:
            relief = -0.014 * math.sin(((lat_deg - 18) % 20) / 8.0 * math.pi)
        elif 28 <= lat_deg <= 34 or 48 <= lat_deg <= 54:
            relief = 0.008
        r = max(0.005, r_base + relief)
        row = []
        for iseg in range(segs):
            th = (iseg / segs) * 2.0 * math.pi
            # Achatamiento sutil en Y para perfil de lenteja de relojería con gran relieve frontal
            row.append(bm.verts.new((r * math.cos(th), r * math.sin(th) * 0.82, z)))
        ring_verts.append(row)
    pole_top = bm.verts.new((0, 0, radius))

    # Caras polo inferior
    first_row = ring_verts[0]
    for iseg in range(segs):
        inext = (iseg + 1) % segs
        bm.faces.new((pole_bot, first_row[inext], first_row[iseg]))
    # Caras intermedias
    for ir in range(len(ring_verts) - 1):
        r0, r1 = ring_verts[ir], ring_verts[ir + 1]
        for iseg in range(segs):
            inext = (iseg + 1) % segs
            bm.faces.new((r0[iseg], r0[inext], r1[inext], r1[iseg]))
    # Caras polo superior
    last_row = ring_verts[-1]
    for iseg in range(segs):
        inext = (iseg + 1) % segs
        bm.faces.new((last_row[iseg], last_row[inext], pole_top))

    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = loc
    bpy.context.collection.objects.link(obj)
    return finish(obj, mat, name, 0.0, smooth=True)


def arc_strip(name, mat, r_in, r_out, y_pos, y_thick, deg_start=-170, deg_end=170, step=3):
    """Construye un arco sólido en el plano X-Z (0° hacia -Z)."""
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    bm = bmesh.new()
    angles = [math.radians(a) for a in range(deg_start, deg_end + 1, step)]
    rings = []
    for th in angles:
        s, c = math.sin(th), -math.cos(th)
        v0 = bm.verts.new((s * r_in, y_pos - y_thick / 2, c * r_in))
        v1 = bm.verts.new((s * r_out, y_pos - y_thick / 2, c * r_out))
        v2 = bm.verts.new((s * r_out, y_pos + y_thick / 2, c * r_out))
        v3 = bm.verts.new((s * r_in, y_pos + y_thick / 2, c * r_in))
        rings.append((v0, v1, v2, v3))
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        bm.faces.new((a[0], a[1], b[1], b[0]))
        bm.faces.new((a[1], a[2], b[2], b[1]))
        bm.faces.new((a[2], a[3], b[3], b[2]))
        bm.faces.new((a[3], a[0], b[0], b[3]))
    bm.faces.new(rings[0][::-1])
    bm.faces.new(rings[-1])
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return finish(obj, mat, name, 0.0, smooth=True)


def helical_spring(name, mat, radius=0.38, wire_r=0.048, turns=9.5, height=1.55, z_top=2.0, segs_per_turn=32, cs_segs=16):
    """Crea una malla helicoidal 3D real con origen en (0, 0, z_top) para escalar en Z/Y."""
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    bm = bmesh.new()
    total_segs = int(turns * segs_per_turn)
    rings = []
    for i in range(total_segs + 1):
        u = i / total_segs
        ang = u * turns * 2.0 * math.pi
        z_local = -u * height
        cx = radius * math.cos(ang)
        cy = radius * math.sin(ang)
        cz = z_local
        tx = -radius * turns * 2.0 * math.pi * math.sin(ang)
        ty = radius * turns * 2.0 * math.pi * math.cos(ang)
        tz = -height
        t_len = math.sqrt(tx * tx + ty * ty + tz * tz)
        tx, ty, tz = tx / t_len, ty / t_len, tz / t_len
        nx, ny, nz = -math.cos(ang), -math.sin(ang), 0.0
        bx = ty * nz - tz * ny
        by = tz * nx - tx * nz
        bz = tx * ny - ty * nx
        ring = []
        for j in range(cs_segs):
            phi = (j / cs_segs) * 2.0 * math.pi
            cp, sp = math.cos(phi), math.sin(phi)
            vx = cx + wire_r * (cp * nx + sp * bx)
            vy = cy + wire_r * (cp * ny + sp * by)
            vz = cz + wire_r * (cp * nz + sp * bz)
            ring.append(bm.verts.new((vx, vy, vz)))
        rings.append(ring)
    for i in range(len(rings) - 1):
        r0, r1 = rings[i], rings[i + 1]
        for j in range(cs_segs):
            jn = (j + 1) % cs_segs
            bm.faces.new((r0[j], r0[jn], r1[jn], r1[j]))
    bm.faces.new(rings[0][::-1])
    bm.faces.new(rings[-1])
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = (0, 0, z_top)
    bpy.context.collection.objects.link(obj)
    return finish(obj, mat, name, 0.0, smooth=True)


def join_into(objs, name, origin=(0, 0, 0)):
    """Une una lista de objetos malla en un único objeto limpio para optimizar y conservar el relieve."""
    for o in objs:
        for mod in list(o.modifiers):
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    merged = bpy.context.active_object
    merged.name = name
    bpy.context.scene.cursor.location = origin
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    return merged


def parent_keep_world(children, parent_obj):
    inv = parent_obj.matrix_world.inverted()
    for c in children:
        c.parent = parent_obj
        c.matrix_parent_inverse = inv


def build_pendulum_scene(materials):
    STEEL, DARK, WOOD, BRASS, COPPER, ENAMEL, DIAL_MAT, GLASS = materials

    # ───────────── 1. Soporte de Laboratorio con Relieves (Frame) ─────────────
    frame = bpy.data.objects.new("Frame", None)
    bpy.context.collection.objects.link(frame)
    parts = [
        # Doble viga superior con nervaduras y bridas de unión
        cylinder("TopBar", STEEL, 0.086, BAR_HALF * 2 + 0.5, (0, 0, 0), rot=(0, math.pi / 2, 0)),
        cylinder("TopBridge", DARK, 0.062, BAR_HALF * 2 + 0.3, (0, 0.06, 0.40), rot=(0, math.pi / 2, 0)),
        box("TopTrussSpine", DARK, (BAR_HALF * 2 - 0.4, 0.04, 0.14), (0, 0.03, 0.20), bevel=0.01),
        # Columnas laterales estriadas (16 estrías en relieve) + puntales traseros
        fluted_column("PostL", DARK, 0.125, 0.012, 16, 4.55, (-BAR_HALF, 0, -1.9)),
        fluted_column("PostR", DARK, 0.125, 0.012, 16, 4.55, (BAR_HALF, 0, -1.9)),
        cylinder("StrutL", STEEL, 0.062, 4.62, (-BAR_HALF + 0.20, 0.36, -1.92), rot=(0.14, 0, 0)),
        cylinder("StrutR", STEEL, 0.062, 4.62, (BAR_HALF - 0.20, 0.36, -1.92), rot=(0.14, 0, 0)),
        # Columna central estriada con anillos de latón y placa de instrumento con 4 remaches
        fluted_column("CenterPost", DARK, 0.072, 0.008, 12, 4.2, (0, 0.22, -2.05)),
        torus("CenterRingTop", BRASS, 0.082, 0.018, (0, 0.22, -0.35)),
        torus("CenterRingMid", BRASS, 0.082, 0.018, (0, 0.22, -2.05)),
        torus("CenterRingBot", BRASS, 0.088, 0.022, (0, 0.22, -3.95)),
        box("CenterPlaqueBack", DARK, (1.24, 0.06, 0.44), (0, 0.16, -3.55), bevel=0.015),
        box("CenterPlaqueFace", BRASS, (1.12, 0.065, 0.34), (0, 0.15, -3.55), bevel=0.01),
        # Base óptica de madera noble en 3 escalones moldurados + rieles T-slot en bajorrelieve
        box("BasePlinthBot", WOOD, (BAR_HALF * 2 + 2.1, 2.05, 0.12), (0, 0.05, -4.34), bevel=0.025),
        box("BasePlinthMid", WOOD, (BAR_HALF * 2 + 1.85, 1.86, 0.18), (0, 0.05, -4.22), bevel=0.03),
        box("BaseTopDeck", DARK, (BAR_HALF * 2 + 1.5, 1.52, 0.04), (0, 0.05, -4.12), bevel=0.008),
        box("InlayFront", BRASS, (BAR_HALF * 2 + 0.9, 0.08, 0.045), (0, -0.84, -4.11), bevel=0.006),
        box("InlayTrack1", STEEL, (BAR_HALF * 2 + 0.8, 0.05, 0.03), (0, -0.22, -4.10)),
        box("InlayTrack2", STEEL, (BAR_HALF * 2 + 0.8, 0.05, 0.03), (0, -0.10, -4.10)),
        # Nivel de burbuja central con bisel moleteado y cápsula
        knurled_cylinder("SpiritLevelBezel", BRASS, 0.18, 0.01, 24, 0.08, (0, -0.52, -4.09)),
        cylinder("SpiritBubble", GLASS, 0.13, 0.09, (0, -0.52, -4.09)),
        torus("SpiritCenterMark", BRASS, 0.045, 0.008, (0, -0.52, -4.045)),
    ]

    # Costillas verticales en la viga superior (relieve de celosía)
    for rx in range(-6, 7):
        if rx == 0:
            continue
        parts.append(box(f"TrussRib_{rx}", BRASS if rx % 2 == 0 else STEEL, (0.045, 0.11, 0.38), (rx * 1.0, 0.03, 0.19), bevel=0.006))

    # Regla graduada en relieve sobre el borde frontal de latón
    for mx in range(-60, 61, 2):
        x_p = mx * 0.1
        is_major = mx % 10 == 0
        parts.append(box(
            f"RulerTick_{mx}", DARK,
            (0.016 if is_major else 0.009, 0.03, 0.035 if is_major else 0.018),
            (x_p, -0.875, -4.105),
        ))

    # Capiteles torneados, anillos ornamentales, bridas con 6 pernos hexagonales y patas moleteadas
    for cx in (-BAR_HALF, BAR_HALF):
        parts.append(cylinder(f"Cap_{cx}", BRASS, 0.175, 0.16, (cx, 0, 0.42), bevel=0.025))
        parts.append(torus(f"CapRing_{cx}", BRASS, 0.155, 0.028, (cx, 0, 0.22)))
        parts.append(torus(f"CollarTop_{cx}", BRASS, 0.145, 0.024, (cx, 0, -0.45)))
        parts.append(torus(f"CollarMid_{cx}", BRASS, 0.145, 0.024, (cx, 0, -1.95)))
        parts.append(torus(f"CollarBot_{cx}", BRASS, 0.155, 0.028, (cx, 0, -3.55)))
        parts.append(cylinder(f"BasePedestal_{cx}", DARK, 0.24, 0.28, (cx, 0, -3.98), bevel=0.02))
        parts.append(cylinder(f"BaseFlange_{cx}", BRASS, 0.29, 0.09, (cx, 0, -4.08), bevel=0.015))
        # 6 pernos hexagonales alrededor de cada brida de columna
        for b_i in range(6):
            ba = (b_i / 6.0) * 2.0 * math.pi
            bx, by = cx + 0.23 * math.cos(ba), 0.23 * math.sin(ba)
            parts.append(cylinder(f"Bolt_{cx}_{b_i}", STEEL, 0.026, 0.06, (bx, by, -4.02), verts=6, smooth=False))
        for fy in (-0.74, 0.82):
            parts.append(knurled_cylinder(f"FootWheel_{cx}_{fy}", BRASS, 0.20, 0.014, 20, 0.09, (cx * 1.03, fy, -4.43)))
            parts.append(cylinder(f"FootPad_{cx}_{fy}", DARK, 0.23, 0.06, (cx * 1.03, fy, -4.50), bevel=0.01))

    # Estaciones de pivote (x = -2.5 y x = +2.5): chumaceras con pernos, arandelas de cobre y plomada torneada
    for px in (-2.5, 2.5):
        parts.append(box(f"PivotBlock_{px}", DARK, (0.46, 0.36, 0.58), (px, 0.02, 0.18), bevel=0.025))
        parts.append(box(f"PivotCapPlate_{px}", BRASS, (0.50, 0.38, 0.08), (px, 0.02, 0.49), bevel=0.012))
        parts.append(cylinder(f"BearingOuter_{px}", BRASS, 0.175, 0.38, (px, -0.02, 0), rot=(math.pi / 2, 0, 0), bevel=0.015))
        parts.append(cylinder(f"BearingRace_{px}", COPPER, 0.135, 0.41, (px, -0.02, 0), rot=(math.pi / 2, 0, 0), bevel=0.008))
        for sx in (-0.18, 0.18):
            parts.append(cylinder(f"PillowBolt_{px}_{sx}", STEEL, 0.028, 0.10, (px + sx, 0.02, 0.55), verts=6, smooth=False))
        # Plomada inferior torneada sobre pedestal
        parts.append(cylinder(f"PlumbPedestal_{px}", DARK, 0.12, 0.10, (px, -0.16, -4.06), bevel=0.01))
        parts.append(torus(f"PlumbRing_{px}", BRASS, 0.08, 0.016, (px, -0.16, -4.00)))
        parts.append(cone(f"ZeroPlumb_{px}", BRASS, 0.065, 0.004, 0.24, (px, -0.16, -3.88), rot=(math.pi, 0, 0)))

    merged_frame = join_into(parts, "FrameMesh", origin=(0, 0, 0))
    parent_keep_world([merged_frame], frame)

    # ───────────── 2. Brazo móvil con Relieves (Arm): origen en el pivote (0, -0.16, 0) ─────────────
    arm = bpy.data.objects.new("Arm", None)
    bpy.context.collection.objects.link(arm)
    arm.location = (0, -0.16, 0)

    arm_parts = [
        # Varilla principal estriada/compensada con manguitos de latón espaciados
        cylinder("Rod", STEEL, 0.025, ROD, (0, -0.16, -ROD / 2)),
        cylinder("PivotCap", STEEL, 0.145, 0.25, (0, -0.16, 0), rot=(math.pi / 2, 0, 0), bevel=0.02),
        torus("PivotBezel", BRASS, 0.145, 0.020, (0, -0.27, 0), rot=(math.pi / 2, 0, 0)),
        cylinder("PivotNut", BRASS, 0.082, 0.31, (0, -0.16, 0), rot=(math.pi / 2, 0, 0), bevel=0.01, verts=6, smooth=False),
        cylinder("PivotCenterPin", COPPER, 0.038, 0.34, (0, -0.16, 0), rot=(math.pi / 2, 0, 0), bevel=0.006),
        # Horquilla del áncora de escape esculpida sobre el pivote
        box("AnchorStem", BRASS, (0.048, 0.038, 0.30), (0, -0.11, 0.17), bevel=0.008),
        box("AnchorArmL", BRASS, (0.28, 0.038, 0.044), (-0.12, -0.11, 0.31), rot=(0, 0.42, 0), bevel=0.006),
        box("AnchorArmR", BRASS, (0.28, 0.038, 0.044), (0.12, -0.11, 0.31), rot=(0, -0.42, 0), bevel=0.006),
        box("PalletRubyL", COPPER, (0.028, 0.044, 0.08), (-0.23, -0.11, 0.38), rot=(0, -0.25, 0)),
        box("PalletRubyR", COPPER, (0.028, 0.044, 0.08), (0.23, -0.11, 0.38), rot=(0, 0.25, 0)),
        # Casquillo superior escalonado, tuerca micrométrica moleteada y aguja escalonada
        cylinder("BobColletTop", BRASS, 0.055, 0.12, (0, -0.16, -ROD + 0.42), bevel=0.01),
        cylinder("BobColletBase", BRASS, 0.095, 0.08, (0, -0.16, -ROD + 0.34), bevel=0.012),
        cylinder("BobBottomCollar", BRASS, 0.092, 0.07, (0, -0.16, -ROD - 0.32), bevel=0.01),
        knurled_cylinder("RatingNut", BRASS, 0.082, 0.010, 18, 0.09, (0, -0.16, -ROD - 0.39)),
        knurled_cylinder("LockNut", STEEL, 0.062, 0.008, 14, 0.05, (0, -0.16, -ROD - 0.46)),
        cone("BobPointer", BRASS, 0.034, 0.003, 0.22, (0, -0.16, -ROD - 0.56), rot=(math.pi, 0, 0)),
    ]
    # Manguitos decorativos a lo largo de la varilla para dar relieve visual al girar
    for rz in (-0.65, -1.35, -2.05):
        arm_parts.append(cylinder(f"RodSleeve_{rz}", BRASS, 0.038, 0.09, (0, -0.16, rz), bevel=0.008))
        arm_parts.append(torus(f"RodRing_{rz}", COPPER, 0.039, 0.009, (0, -0.16, rz)))

    # Lenteja principal ("Bob") con surcos concéntricos en relieve (mantiene nombre "Bob" para que Stage3D la tiña)
    bob_obj = relief_bob_mesh("Bob", ENAMEL, 0.33, (0, -0.16, -ROD))

    # Cinturón ecuatorial de latón, biseles frontales/traseros y 16 remaches esféricos en relieve
    arm_parts.append(torus("BobRing", BRASS, 0.10, 0.028, (0, -0.16, -ROD + 0.35), segs=36, ring_segs=14))
    arm_parts.append(torus("BobBelt", BRASS, 0.332, 0.022, (0, -0.16, -ROD), rot=(math.pi / 2, 0, 0), segs=64, ring_segs=16))
    arm_parts.append(torus("BobFrontMedallion", BRASS, 0.14, 0.016, (0, -0.40, -ROD), rot=(math.pi / 2, 0, 0), segs=48, ring_segs=12))
    arm_parts.append(cylinder("BobCenterBoss", BRASS, 0.065, 0.54, (0, -0.16, -ROD), rot=(math.pi / 2, 0, 0), bevel=0.01))
    for st_i in range(16):
        sa = (st_i / 16.0) * 2.0 * math.pi
        sx = 0.342 * math.cos(sa)
        sz = -ROD + 0.342 * math.sin(sa)
        arm_parts.append(sphere(f"BobStud_{st_i}", BRASS, 0.022, (sx, -0.16, sz), segs=16, rings=10))

    arm_hardware = join_into(arm_parts, "ArmHardware", origin=(0, -0.16, 0))
    parent_keep_world([bob_obj, arm_hardware], arm)

    # ───────────── 3. Rueda de Escape y Reloj Horológico con Relieve (EscapeWheel, ClockDial, ClockHand) ─────────────
    CLOCK_Z = 0.68
    CLOCK_R = 0.38

    escape_wheel = bpy.data.objects.new("EscapeWheel", None)
    bpy.context.collection.objects.link(escape_wheel)
    escape_wheel.location = (0, -0.09, CLOCK_Z)
    esc_objs = [
        torus("EscRim", BRASS, CLOCK_R * 0.64, 0.022, (0, -0.09, CLOCK_Z), rot=(math.pi / 2, 0, 0), segs=48, ring_segs=12),
        torus("EscInnerRim", COPPER, CLOCK_R * 0.42, 0.014, (0, -0.09, CLOCK_Z), rot=(math.pi / 2, 0, 0), segs=36, ring_segs=10),
        cylinder("EscHub", BRASS, 0.068, 0.06, (0, -0.09, CLOCK_Z), rot=(math.pi / 2, 0, 0), bevel=0.008),
    ]
    for s_idx in range(6):
        ang = s_idx * math.pi / 3.0
        esc_objs.append(box(f"EscSpoke_{s_idx}", BRASS, (CLOCK_R * 1.24, 0.020, 0.024), (0, -0.09, CLOCK_Z), rot=(0, ang, 0), bevel=0.004))
    for t_idx in range(24):
        ang = (t_idx / 24.0) * 2.0 * math.pi
        tx = math.sin(ang) * (CLOCK_R * 0.69)
        tz = CLOCK_Z - math.cos(ang) * (CLOCK_R * 0.69)
        esc_objs.append(box(f"EscTooth_{t_idx}", BRASS, (0.018, 0.022, 0.065), (tx, -0.09, tz), rot=(0, -ang + 0.28, 0)))
    esc_merged = join_into(esc_objs, "EscapeWheelMesh", origin=(0, -0.09, CLOCK_Z))
    parent_keep_world([esc_merged], escape_wheel)

    clock_dial = bpy.data.objects.new("ClockDial", None)
    bpy.context.collection.objects.link(clock_dial)
    clock_dial.location = (0, -0.05, CLOCK_Z)
    cdial_objs = [
        torus("ClockBezelOuter", BRASS, CLOCK_R + 0.02, 0.026, (0, -0.05, CLOCK_Z), rot=(math.pi / 2, 0, 0), segs=64, ring_segs=16),
        torus("ClockBezelInner", STEEL, CLOCK_R * 0.72, 0.012, (0, -0.055, CLOCK_Z), rot=(math.pi / 2, 0, 0), segs=48, ring_segs=12),
        cylinder("ClockBack", DARK, CLOCK_R, 0.026, (0, -0.03, CLOCK_Z), rot=(math.pi / 2, 0, 0), verts=64),
        cylinder("ClockChapterRing", DIAL_MAT, CLOCK_R * 0.96, 0.014, (0, -0.042, CLOCK_Z), rot=(math.pi / 2, 0, 0), verts=64),
    ]
    # 12 índices horarios en alto relieve + 24 perlas perimetrales
    for h_idx in range(12):
        ang = (h_idx / 12.0) * 2.0 * math.pi
        major = h_idx % 3 == 0
        r_m = CLOCK_R * 0.83
        hx = math.sin(ang) * r_m
        hz = CLOCK_Z + math.cos(ang) * r_m
        cdial_objs.append(box(
            f"ClockTick_{h_idx}", BRASS if major else DARK,
            (0.030 if major else 0.016, 0.024, 0.082 if major else 0.048),
            (hx, -0.058, hz), rot=(0, ang, 0), bevel=0.003,
        ))
    for b_idx in range(24):
        ang = (b_idx / 24.0) * 2.0 * math.pi
        bx = math.sin(ang) * (CLOCK_R + 0.02)
        bz = CLOCK_Z + math.cos(ang) * (CLOCK_R + 0.02)
        cdial_objs.append(sphere(f"ClockBead_{b_idx}", BRASS, 0.012, (bx, -0.072, bz), segs=10, rings=8))
    cdial_merged = join_into(cdial_objs, "ClockDialMesh", origin=(0, -0.05, CLOCK_Z))
    parent_keep_world([cdial_merged], clock_dial)

    clock_hand = bpy.data.objects.new("ClockHand", None)
    bpy.context.collection.objects.link(clock_hand)
    clock_hand.location = (0, -0.13, CLOCK_Z)
    hand_objs = [
        cylinder("HandHub", BRASS, 0.046, 0.045, (0, -0.13, CLOCK_Z), rot=(math.pi / 2, 0, 0), bevel=0.006),
        torus("HandCounterweight", BRASS, 0.048, 0.010, (0, -0.13, CLOCK_Z - 0.08), rot=(math.pi / 2, 0, 0)),
        box("HandShaft", ENAMEL, (0.028, 0.020, CLOCK_R * 0.80), (0, -0.13, CLOCK_Z + CLOCK_R * 0.28), bevel=0.004),
        torus("HandBreguetMoon", ENAMEL, 0.036, 0.010, (0, -0.13, CLOCK_Z + CLOCK_R * 0.55), rot=(math.pi / 2, 0, 0)),
        cone("HandTip", ENAMEL, 0.038, 0.004, 0.10, (0, -0.13, CLOCK_Z + CLOCK_R * 0.74)),
    ]
    chand_merged = join_into(hand_objs, "ClockHandMesh", origin=(0, -0.13, CLOCK_Z))
    parent_keep_world([chand_merged], clock_hand)

    # ───────────── 4. Transportador (Dial): doble riel en relieve, puentes radiales y marcas de 3 niveles ─────────────
    dial_objs = [
        arc_strip("DialRailOuter", DIAL_MAT, ROD + 0.61, ROD + 0.665, 0.14, 0.030, -170, 170, 3),
        arc_strip("DialRailMid", DIAL_MAT, ROD + 0.47, ROD + 0.495, 0.145, 0.020, -170, 170, 3),
        arc_strip("DialRailInner", DIAL_MAT, ROD + 0.32, ROD + 0.355, 0.14, 0.026, -170, 170, 3),
    ]
    R = ROD + 0.62
    for a in range(-170, 171, 2):
        major = a % 30 == 0
        med = a % 10 == 0
        length = 0.30 if major else (0.16 if med else 0.065)
        thick = 0.038 if major else (0.022 if med else 0.011)
        depth_y = 0.034 if major else (0.026 if med else 0.018)
        th = math.radians(a)
        x, z = math.sin(th) * (R - length / 2), -math.cos(th) * (R - length / 2)
        dial_objs.append(box(f"Tick{a}", DIAL_MAT, (thick, depth_y, length), (x, 0.14, z), rot=(0, math.pi - th, 0)))

    dial = join_into(dial_objs, "Dial", origin=(0, 0, 0))
    return frame, arm, dial, escape_wheel, clock_dial, clock_hand


def build_spring_scene(materials):
    STEEL, DARK, WOOD, BRASS, COPPER, ENAMEL, DIAL_MAT, GLASS = materials

    # ───────────── 1. Pórtico Masa-Resorte con Relieves (SpringFrame) ─────────────
    sframe = bpy.data.objects.new("SpringFrame", None)
    bpy.context.collection.objects.link(sframe)
    COL_X = 1.18
    f_parts = [
        box("SpringBasePlinth", WOOD, (3.6, 1.95, 0.16), (0, 0, -2.28), bevel=0.025),
        box("SpringBaseTop", WOOD, (3.35, 1.75, 0.16), (0, 0, -2.14), bevel=0.025),
        box("SpringBasePlate", DARK, (2.85, 1.38, 0.09), (0, 0, -2.03), bevel=0.015),
        box("SpringTopBeam", DARK, (2.95, 0.62, 0.26), (0, 0, 2.13), bevel=0.025),
        box("SpringTopCrown", BRASS, (2.45, 0.44, 0.07), (0, 0, 2.29), bevel=0.012),
        cylinder("SpringTopMount", BRASS, 0.48, 0.12, (0, 0, 1.98), bevel=0.015),
        torus("SpringMountRim", COPPER, 0.44, 0.022, (0, 0, 1.92)),
        cylinder("GuideRodL", STEEL, 0.058, 4.18, (-COL_X, 0, 0.04)),
        cylinder("GuideRodR", STEEL, 0.058, 4.18, (COL_X, 0, 0.04)),
        box("ScaleBar", DARK, (0.11, 0.06, 3.28), (COL_X + 0.36, -0.2, 0.0), bevel=0.008),
        box("ScaleBrassStrip", BRASS, (0.05, 0.068, 3.22), (COL_X + 0.34, -0.2, 0.0), bevel=0.004),
    ]
    # Costillas superiores y bridas de columna con pernos
    for rx in (-0.85, -0.45, 0.45, 0.85):
        f_parts.append(box(f"TopRib_{rx}", BRASS, (0.05, 0.66, 0.22), (rx, 0, 2.13), bevel=0.006))
    for cx in (-COL_X, COL_X):
        f_parts.append(cylinder(f"RodBaseFlange_{cx}", BRASS, 0.16, 0.11, (cx, 0, -1.96), bevel=0.012))
        f_parts.append(cylinder(f"RodTopFlange_{cx}", BRASS, 0.16, 0.11, (cx, 0, 1.96), bevel=0.012))
        for b_i in range(4):
            ba = (b_i / 4.0) * 2.0 * math.pi + math.pi / 4
            f_parts.append(cylinder(f"RodBolt_{cx}_{b_i}", STEEL, 0.022, 0.06, (cx + 0.115 * math.cos(ba), 0.115 * math.sin(ba), -1.90), verts=6, smooth=False))
    for k in range(-16, 17):
        z_t = k * 0.09
        major = k % 4 == 0
        f_parts.append(box(
            f"ScaleTick_{k}", BRASS if k == 0 else DIAL_MAT,
            (0.18 if major else 0.10, 0.075, 0.024 if major else 0.012),
            (COL_X + 0.27, -0.21, z_t),
        ))
    sframe_merged = join_into(f_parts, "SpringFrameMesh", origin=(0, 0, 0))
    parent_keep_world([sframe_merged], sframe)

    # ───────────── 2. Resorte helicoidal 3D (SpringCoil) con origen en (0, 0, 2.0) ─────────────
    scoil = helical_spring("SpringCoil", STEEL, radius=0.39, wire_r=0.048, turns=9.5, height=1.55, z_top=2.0)

    # ───────────── 3. Cilindro Hidráulico Aletado (DamperCylinder) ─────────────
    dcyl = bpy.data.objects.new("DamperCylinder", None)
    bpy.context.collection.objects.link(dcyl)
    dc_parts = [
        cylinder("DamperBody", DARK, 0.23, 1.26, (0, 0, -1.42), bevel=0.015),
        cylinder("DamperCap", BRASS, 0.275, 0.11, (0, 0, -0.78), bevel=0.015),
        torus("DamperSeal", COPPER, 0.12, 0.024, (0, 0, -0.72)),
        cylinder("DamperBase", BRASS, 0.31, 0.11, (0, 0, -1.98), bevel=0.015),
    ]
    # 9 aletas disipadoras de calor en relieve alrededor del cilindro amortiguador
    for fi in range(9):
        fz = -1.84 + fi * 0.115
        dc_parts.append(cylinder(f"DamperFin_{fi}", STEEL if fi % 2 == 0 else DARK, 0.285, 0.032, (0, 0, fz), bevel=0.005))
    dcyl_merged = join_into(dc_parts, "DamperCylinderMesh", origin=(0, 0, -1.42))
    parent_keep_world([dcyl_merged], dcyl)

    # ───────────── 4. Bloque de Masa Fresado con Relieves (MassAssembly), origen en (0, 0, 0) ─────────────
    mass = bpy.data.objects.new("MassAssembly", None)
    bpy.context.collection.objects.link(mass)
    mass.location = (0, 0, 0)

    # Mantenemos "MassBlock" como hijo directo para que SpringStage3D pueda teñirlo por régimen
    mass_block = box("MassBlock", ENAMEL, (1.86, 0.94, 0.76), (0, 0, 0), bevel=0.045)

    m_parts = [
        # Marcos y nervaduras en relieve sobre las caras frontal y trasera del bloque de masa
        box("MassFrontFrameTop", BRASS, (1.56, 0.98, 0.065), (0, 0, 0.28), bevel=0.008),
        box("MassFrontFrameBot", BRASS, (1.56, 0.98, 0.065), (0, 0, -0.28), bevel=0.008),
        box("MassBelt", BRASS, (1.92, 0.99, 0.09), (0, 0, 0), bevel=0.012),
        box("MassRecessL", DARK, (0.58, 0.97, 0.36), (-0.44, 0, 0), bevel=0.01),
        box("MassRecessR", DARK, (0.58, 0.97, 0.36), (0.44, 0, 0), bevel=0.01),
        cylinder("MassCenterMedallion", BRASS, 0.18, 1.01, (0, 0, 0), rot=(math.pi / 2, 0, 0), bevel=0.015),
        cylinder("MassTopSeat", BRASS, 0.46, 0.09, (0, 0, 0.42), bevel=0.012),
        cylinder("MassBotFlange", BRASS, 0.22, 0.08, (0, 0, -0.41), bevel=0.01),
        # Cojinetes lineales de bronce con anillos retenedores en ambos extremos
        cylinder("SleeveL", BRASS, 0.125, 0.92, (-COL_X, 0, 0), bevel=0.015),
        cylinder("SleeveR", BRASS, 0.125, 0.92, (COL_X, 0, 0), bevel=0.015),
        torus("SleeveRingLT", COPPER, 0.128, 0.018, (-COL_X, 0, 0.36)),
        torus("SleeveRingLB", COPPER, 0.128, 0.018, (-COL_X, 0, -0.36)),
        torus("SleeveRingRT", COPPER, 0.128, 0.018, (COL_X, 0, 0.36)),
        torus("SleeveRingRB", COPPER, 0.128, 0.018, (COL_X, 0, -0.36)),
        cylinder("DamperPiston", STEEL, 0.070, 1.38, (0, 0, -0.96)),
        cone("MassPointer", BRASS, 0.055, 0.005, 0.30, (COL_X + 0.09, -0.21, 0), rot=(0, math.pi / 2, 0)),
    ]
    # 8 pernos hexagonales frontales en las esquinas del bloque de masa
    for bx in (-0.76, -0.18, 0.18, 0.76):
        for bz in (-0.28, 0.28):
            m_parts.append(cylinder(f"MassBolt_{bx}_{bz}", STEEL, 0.028, 1.03, (bx, 0, bz), rot=(math.pi / 2, 0, 0), verts=6, smooth=False))

    mass_hw = join_into(m_parts, "MassHardware", origin=(0, 0, 0))
    parent_keep_world([mass_block, mass_hw], mass)

    return sframe, scoil, dcyl, mass


def main():
    os.makedirs(os.path.dirname(os.path.abspath(OUT_GLB)), exist_ok=True)
    mats = make_palette()

    # 1) Construir y exportar pendulo.glb
    clear_scene()
    build_pendulum_scene(mats)
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB, export_format="GLB", export_apply=True, export_yup=True,
        export_cameras=False, export_lights=False, export_materials="EXPORT",
    )

    # 2) Construir y exportar resorte.glb
    clear_scene()
    build_spring_scene(mats)
    bpy.ops.export_scene.gltf(
        filepath=OUT_SPRING_GLB, export_format="GLB", export_apply=True, export_yup=True,
        export_cameras=False, export_lights=False, export_materials="EXPORT",
    )

    # 3) Escena combinada en Blender con los DOS péndulos (Lineal azul en x=-2.5 y Real rojo en x=+2.5) + Masa-Resorte
    clear_scene()
    frame, arm_real, dial_real, esc_real, cdial_real, chand_real = build_pendulum_scene(mats)
    MAT_LIN = make_material("BobLinear", (0.11, 0.31, 0.85), 0.88, 0.18)
    MAT_REAL = make_material("BobReal", (0.78, 0.16, 0.16), 0.88, 0.18)

    def clone_hierarchy(root_obj, dx, suffix, tint_mat):
        new_root = root_obj.copy()
        if new_root.data:
            new_root.data = new_root.data.copy()
        new_root.name = f"{root_obj.name}_{suffix}"
        bpy.context.collection.objects.link(new_root)
        new_root.location.x += dx
        for ch in list(root_obj.children):
            c_copy = ch.copy()
            if c_copy.data:
                c_copy.data = c_copy.data.copy()
            c_copy.name = f"{ch.name}_{suffix}"
            bpy.context.collection.objects.link(c_copy)
            c_copy.parent = new_root
            c_copy.matrix_parent_inverse = ch.matrix_parent_inverse.copy()
            if ch.name in ("Bob", "ClockHandMesh"):
                c_copy.data.materials.clear()
                c_copy.data.materials.append(tint_mat)
        return new_root

    arm_lin = clone_hierarchy(arm_real, -2.5, "Linear", MAT_LIN)
    dial_lin = clone_hierarchy(dial_real, -2.5, "Linear", MAT_LIN)
    esc_lin = clone_hierarchy(esc_real, -2.5, "Linear", MAT_LIN)
    cdial_lin = clone_hierarchy(cdial_real, -2.5, "Linear", MAT_LIN)
    chand_lin = clone_hierarchy(chand_real, -2.5, "Linear", MAT_LIN)

    for r_obj in (arm_real, dial_real, esc_real, cdial_real, chand_real):
        r_obj.location.x += 2.5
        for ch in r_obj.children:
            if ch.name in ("Bob", "ClockHandMesh"):
                ch.data.materials.clear()
                ch.data.materials.append(MAT_REAL)

    sframe, scoil, dcyl, mass = build_spring_scene(mats)
    for root_o in (sframe, scoil, dcyl, mass):
        root_o.location.x += 10.5
    for ch in mass.children:
        if ch.name == "MassBlock":
            ch.data.materials.clear()
            ch.data.materials.append(MAT_LIN)

    # Animar ambos péndulos en el timeline de Blender (360 cuadros a 30 fps = 12 s, θ₀ = 90°)
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 360
    T0_VAL = 2.0061
    TREAL_VAL = 2.3679
    for f in range(1, 361, 2):
        t = (f - 1) / 30.0
        th_lin = (math.pi / 2.0) * math.cos(2.0 * math.pi * t / T0_VAL)
        th_real = (math.pi / 2.0) * math.cos(2.0 * math.pi * t / TREAL_VAL)
        arm_lin.rotation_euler = (0, th_lin, 0)
        arm_lin.keyframe_insert(data_path="rotation_euler", frame=f)
        arm_real.rotation_euler = (0, th_real, 0)
        arm_real.keyframe_insert(data_path="rotation_euler", frame=f)

        esc_lin.rotation_euler = (0, -2.0 * math.pi * (t / T0_VAL), 0)
        esc_lin.keyframe_insert(data_path="rotation_euler", frame=f)
        esc_real.rotation_euler = (0, -2.0 * math.pi * (t / TREAL_VAL), 0)
        esc_real.keyframe_insert(data_path="rotation_euler", frame=f)

        chand_lin.rotation_euler = (0, -2.0 * math.pi * (t / T0_VAL) * 0.25, 0)
        chand_lin.keyframe_insert(data_path="rotation_euler", frame=f)
        chand_real.rotation_euler = (0, -2.0 * math.pi * (t / TREAL_VAL) * 0.25, 0)
        chand_real.keyframe_insert(data_path="rotation_euler", frame=f)

        z_m = 0.68 * math.exp(-0.22 * t) * math.cos(3.4 * t)
        mass.location.z = z_m
        mass.keyframe_insert(data_path="location", frame=f)
        scoil.scale.z = (1.55 - z_m) / 1.55
        scoil.keyframe_insert(data_path="scale", frame=f)
    bpy.context.scene.frame_set(1)

    cam_data = bpy.data.cameras.get("LabCamera") or bpy.data.cameras.new("LabCamera")
    cam_data.lens = 38
    cam_obj = bpy.data.objects.new("LabCamera", cam_data)
    cam_obj.location = (2.8, -19.5, -1.3)
    cam_obj.rotation_euler = (math.radians(88), 0, 0)
    bpy.context.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj

    light_data = bpy.data.lights.get("KeyLight") or bpy.data.lights.new("KeyLight", type="AREA")
    light_data.energy = 1600
    light_data.size = 7.0
    light_obj = bpy.data.objects.new("KeyLight", light_data)
    light_obj.location = (-5.0, -9.0, 6.5)
    light_obj.rotation_euler = (math.radians(52), 0, math.radians(-28))
    bpy.context.collection.objects.link(light_obj)

    try:
        for window in bpy.context.window_manager.windows:
            for area in window.screen.areas:
                if area.type == "VIEW_3D":
                    for space in area.spaces:
                        if space.type == "VIEW_3D":
                            space.shading.type = "MATERIAL"
                            space.shading.show_cavity = True
                            space.shading.cavity_type = "BOTH"
    except Exception:
        pass

    if OUT_BLEND:
        os.makedirs(os.path.dirname(os.path.abspath(OUT_BLEND)), exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)


if __name__ == "__main__":
    main()
