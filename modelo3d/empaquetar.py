"""
Proyecto 5 · Empaqueta el modelo de Blender para el simulador web.

    python modelo3d/empaquetar.py

Lee modelo3d/salida/ (lo que genera construir_modelo.py) y escribe vendor/pendulo_modelo.js:
un solo archivo JavaScript con la geometría comprimida y las texturas embebidas.
Va en un <script> normal para que el HTML siga abriendo con doble clic (file://),
sin servidor y sin internet: un .glb externo no se puede cargar desde file://.
"""
import base64
import io
import json
import os

from PIL import Image, ImageFilter, ImageOps

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.join(AQUI, "salida")
DESTINO = os.path.join(AQUI, "..", "vendor", "pendulo_modelo.js")


def data_uri(img, formato, **opciones):
    buf = io.BytesIO()
    img.save(buf, formato, **opciones)
    tipo = "jpeg" if formato == "JPEG" else formato.lower()
    return f"data:image/{tipo};base64," + base64.b64encode(buf.getvalue()).decode("ascii"), buf.tell()


# Atlas horneado: JPEG de calidad alta (la madera pierde poco y pesa 5-8 veces menos que PNG)
atlas = Image.open(os.path.join(SALIDA, "atlas.png")).convert("RGB")
atlas_uri, atlas_bytes = data_uri(atlas, "JPEG", quality=86, optimize=True, progressive=True, subsampling=0)

# Sombra del piso: el AO horneado tiene grano. Se suaviza, se invierte (oscuro = opaco)
# y se reduce a 256 x 128: es una sombra difusa, no necesita más.
ao = Image.open(os.path.join(SALIDA, "ao_piso.png")).convert("L")
ao = ao.filter(ImageFilter.GaussianBlur(4))
alpha = ImageOps.invert(ao).point(lambda v: min(255, int(v * 1.25)))
alpha = alpha.resize((256, 128), Image.LANCZOS)
sombra_uri, sombra_bytes = data_uri(alpha, "PNG", optimize=True)

with open(os.path.join(SALIDA, "geometria.json"), encoding="utf-8") as f:
    geo = json.load(f)
geo["texturas"] = {"atlas": atlas_uri, "sombra": sombra_uri}

js = ("/* Proyecto 5 · Modelo 3D del péndulo (Blender 5.2 → modelo3d/construir_modelo.py).\n"
      "   Generado por modelo3d/empaquetar.py: no editar a mano. */\n"
      "window.PENDULO_MODELO=" + json.dumps(geo, separators=(",", ":")) + ";\n")
with open(DESTINO, "w", encoding="utf-8") as f:
    f.write(js)

tris = sum(m["tris"] for m in geo["mallas"].values())
print(f"atlas JPEG: {atlas_bytes/1024:.0f} KB · sombra PNG: {sombra_bytes/1024:.0f} KB")
print(f"triángulos en total: {tris}")
print(f"vendor/pendulo_modelo.js: {os.path.getsize(DESTINO)/1024:.0f} KB")
