import * as THREE from 'three'

/**
 * Materiales de péndulo clásico para los modelos .glb.
 *
 * Los modelos de Blender traen todos los materiales con el valor por defecto (gris claro, sin metal ni texturas), pero con
 * nombres útiles. Aquí se reemplazan por nombre: nogal para la base, latón pulido, acero cepillado, hierro oscuro, cobre y
 * vidrio. Las texturas se dibujan con código (sin descargas, sin pesar en el modelo) y son siempre iguales (ruido con semilla).
 *
 * La lenteja ("Bob") no se pinta aquí a propósito: cada escena la tiñe de azul (lineal) o rojo (real) para identificarla.
 */

// ───────── Ruido determinista ─────────
function mulberry(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Ruido de valor 2D suavizado, con una rejilla pequeña repetible. */
function makeNoise(seed: number, size = 64) {
  const rnd = mulberry(seed)
  const grid = Float32Array.from({ length: size * size }, () => rnd())
  const at = (x: number, y: number) => grid[((y % size) + size) % size * size + (((x % size) + size) % size)]
  const smooth = (t: number) => t * t * (3 - 2 * t)
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y)
    const fx = smooth(x - xi), fy = smooth(y - yi)
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1)
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
  }
}

function canvasTexture(w: number, h: number, paint: (img: ImageData) => void, srgb: boolean, aniso: number): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(w, h)
  paint(img)
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = aniso
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  tex.needsUpdate = true
  return tex
}

const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

/** Nogal oscuro: vetas largas con anillos irregulares y fibra fina. */
function woodTexture(aniso: number) {
  const n = makeNoise(11), n2 = makeNoise(29)
  const dark = hex('#3b2112'), mid = hex('#6a3f21'), light = hex('#8e5b32')
  return canvasTexture(512, 512, (img) => {
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const warp = n(x * 0.012, y * 0.045) * 5.5 + n(x * 0.03, y * 0.1) * 1.2
        const u = y * 0.055 + warp
        const ring = 0.5 + 0.5 * Math.sin(u * Math.PI * 2)
        const fiber = n2(x * 0.55, y * 0.03)
        const t = Math.min(1, Math.max(0, 0.18 + ring * 0.55 + (fiber - 0.5) * 0.3))
        const col = t < 0.5 ? dark.map((d, i) => d + (mid[i] - d) * (t * 2)) : mid.map((m, i) => m + (light[i] - m) * ((t - 0.5) * 2))
        const k = (y * 512 + x) * 4
        img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255
      }
    }
  }, true, aniso)
}

/** Mapa de rugosidad de metal cepillado: vetas finas en una dirección. */
function brushedRoughness(aniso: number, base: number, spread: number, seed: number) {
  const n = makeNoise(seed)
  return canvasTexture(512, 512, (img) => {
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const streak = n(x * 0.006, y * 1.6) * 0.65 + n(x * 0.02, y * 5.0) * 0.35
        const v = Math.min(1, Math.max(0, base + (streak - 0.5) * spread))
        const g = Math.round(v * 255), k = (y * 512 + x) * 4
        img.data[k] = g; img.data[k + 1] = g; img.data[k + 2] = g; img.data[k + 3] = 255
      }
    }
  }, false, aniso)
}

export interface ClassicSet {
  textured: Map<string, THREE.Material>
  plain: Map<string, THREE.Material>
}

let cached: ClassicSet | null = null

/** Conjunto de materiales, creado una vez y compartido por todas las escenas. */
export function classicMaterials(aniso = 4): ClassicSet {
  if (cached) return cached
  const wood = woodTexture(aniso)
  const brushedBrass = brushedRoughness(aniso, 0.9, 0.34, 3)
  const brushedSteel = brushedRoughness(aniso, 0.9, 0.5, 5)
  const brushedIron = brushedRoughness(aniso, 0.92, 0.3, 7)

  const std = (p: THREE.MeshStandardMaterialParameters, name: string) => {
    const m = new THREE.MeshStandardMaterial(p)
    m.name = name
    return m
  }
  const textured = new Map<string, THREE.Material>([
    ['Wood', std({ color: 0xffffff, map: wood, roughness: 0.62, metalness: 0.02 }, 'Wood')],
    ['Brass', std({ color: 0xd2a84e, metalness: 1, roughness: 0.34, roughnessMap: brushedBrass }, 'Brass')],
    ['Copper', std({ color: 0xb8683a, metalness: 1, roughness: 0.4, roughnessMap: brushedBrass }, 'Copper')],
    ['Bronze', std({ color: 0xb5823a, metalness: 1, roughness: 0.3 }, 'Bronze')], // espiral del resorte
    ['Steel', std({ color: 0xc3cad2, metalness: 1, roughness: 0.34, roughnessMap: brushedSteel }, 'Steel')],
    ['DarkSteel', std({ color: 0x343a42, metalness: 0.9, roughness: 0.42, roughnessMap: brushedIron }, 'DarkSteel')],
    ['Dial', std({ color: 0xf2ead2, metalness: 0, roughness: 0.62 }, 'Dial')], // esfera de esmalte color marfil
    ['Bob', std({ color: 0xffffff, metalness: 0.72, roughness: 0.22 }, 'Bob')], // cada escena la tiñe
    ['Glass', new THREE.MeshPhysicalMaterial({
      name: 'Glass', color: 0xdcefff, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.2, clearcoat: 1,
      clearcoatRoughness: 0.03, depthWrite: false,
    })],
  ])
  for (const m of textured.values()) m.userData.shared = true
  // Variante sin mapas para mallas sin coordenadas UV (el resorte helicoidal).
  const plain = new Map<string, THREE.Material>()
  for (const [name, m] of textured) {
    const c = m.clone() as THREE.MeshStandardMaterial
    c.map = null
    c.roughnessMap = null
    c.userData.shared = true
    plain.set(name, c)
  }
  cached = { textured, plain }
  return cached
}

/**
 * Libera geometrías y materiales propios de una escena al desmontarla,
 * respetando los materiales compartidos cacheados (userData.shared === true).
 */
export function disposeSceneObject(root: THREE.Object3D): void {
  root.traverse((o) => {
    const obj = o as THREE.Mesh & THREE.Sprite
    obj.geometry?.dispose?.()
    const mat = obj.material as THREE.Material | THREE.Material[] | undefined
    const disposeMat = (m: THREE.Material) => {
      if (m.userData?.shared) return
      const sp = m as THREE.SpriteMaterial
      if (sp.map && !sp.map.userData?.shared) sp.map.dispose()
      m.dispose()
    }
    if (Array.isArray(mat)) mat.forEach(disposeMat)
    else if (mat) disposeMat(mat)
  })
}

/** Piezas que se pintan por el nombre de la malla y no por el de su material. */
const SPECIAL: Record<string, string> = { SpringCoil: 'Bronze' }

/** Reemplaza los materiales por nombre. Devuelve cuántas mallas se pintaron. */
export function applyClassicMaterials(root: THREE.Object3D, aniso = 4): number {
  const { textured, plain } = classicMaterials(aniso)
  let n = 0
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || Array.isArray(mesh.material)) return
    const name = SPECIAL[mesh.name] ?? (mesh.material as THREE.Material).name
    const hasUv = !!mesh.geometry.getAttribute('uv')
    const replacement = (hasUv ? textured : plain).get(name)
    if (replacement) {
      mesh.material = replacement
      mesh.castShadow = true
      mesh.receiveShadow = true
      if (name === 'Glass') { mesh.castShadow = false; mesh.renderOrder = 2 }
      n++
    }
  })
  return n
}
