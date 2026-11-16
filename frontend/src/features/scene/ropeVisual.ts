import * as THREE from 'three'
import { RopeChain } from '../../core-ts/rope'

export const ROPE_Z = 0.16 // profundidad del plano de oscilación del brazo en el modelo
const SEGMENTS = 22
const ROPE_R = 0.03
const ROD_Y_MIN = -2.65     // por debajo: herrajes de la lenteja
const ROD_Y_MAX = -0.22     // por encima: pinza del pivote
const ROD_RADIUS = 0.06     // la varilla y sus manguitos son más delgados que esto

/**
 * Prepara el brazo del modelo para usar una cuerda:
 *  - quita la varilla (acero, manguitos de latón y anillos de cobre, todos de radio < 0.06 entre el pivote y la lenteja);
 *  - pasa los herrajes de la lenteja a la propia lenteja, para que se muevan con ella cuando la cuerda se afloja.
 * Se hace una sola vez sobre la plantilla, antes de clonar los brazos.
 */
export function splitArm(arm: THREE.Object3D): void {
  if (arm.userData.ropeReady) return
  arm.userData.ropeReady = true
  const bob = arm.getObjectByName('Bob') as THREE.Mesh | undefined
  const toDetach: THREE.Mesh[] = []
  arm.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh && m !== bob && m.geometry.getIndex()) toDetach.push(m)
  })
  for (const mesh of toDetach) {
    const geo = mesh.geometry
    const pos = geo.getAttribute('position')
    const idx = geo.getIndex()!
    const keep: number[] = [], fix: number[] = []
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i), b = idx.getX(i + 1), c = idx.getX(i + 2)
      const cy = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3
      const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3
      const cz = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3
      if (cy <= ROD_Y_MIN) { fix.push(a, b, c); continue }
      if (cy < ROD_Y_MAX && Math.hypot(cx, cz) < ROD_RADIUS) continue // varilla: se descarta
      keep.push(a, b, c)
    }
    const rest = geo.clone()
    rest.setIndex(keep)
    mesh.geometry = rest
    if (fix.length && bob) {
      const g2 = geo.clone()
      g2.setIndex(fix)
      g2.translate(0, 3, 0) // de coordenadas del brazo a coordenadas de la lenteja (que cuelga en y = −3)
      const piece = new THREE.Mesh(g2, mesh.material)
      piece.name = 'BobFitting'
      piece.castShadow = true
      piece.receiveShadow = true
      bob.add(piece)
    }
  }
}

/** Textura de cáñamo: hebras trenzadas en diagonal. */
function ropeTexture(aniso: number): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 64; c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = '#a98f5c'
  g.fillRect(0, 0, 64, 64)
  for (let k = -2; k < 6; k++) {
    g.strokeStyle = k % 2 ? '#7a6238' : '#cdb680'
    g.lineWidth = 9
    g.beginPath()
    g.moveTo(-8, k * 16 + 10); g.lineTo(72, k * 16 - 22)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = aniso
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

let ropeMaterial: THREE.MeshStandardMaterial | null = null
const getRopeMaterial = (aniso: number) => {
  if (!ropeMaterial) {
    ropeMaterial = new THREE.MeshStandardMaterial({ map: ropeTexture(aniso), roughness: 0.9, metalness: 0 })
    ropeMaterial.userData.shared = true
  }
  return ropeMaterial
}

/** La cuerda de un péndulo: cadena de Verlet dibujada con cilindros instanciados. */
export class RopeVisual {
  private chain: RopeChain
  private mesh: THREE.InstancedMesh
  private lastT = 0
  private carry = 0
  private tmp = new THREE.Object3D()

  constructor(parent: THREE.Object3D, length: number, aniso = 4) {
    this.chain = new RopeChain(SEGMENTS, length)
    const geo = new THREE.CylinderGeometry(ROPE_R, ROPE_R, 1, 8, 1, true)
    this.mesh = new THREE.InstancedMesh(geo, getRopeMaterial(aniso), SEGMENTS)
    this.mesh.castShadow = true
    this.mesh.frustumCulled = false
    parent.add(this.mesh)
    this.chain.reset(0, 0, 0, -length)
    this.write()
  }

  setVisible(visible: boolean) {
    this.mesh.visible = visible
  }

  /**
   * @param dt        segundos reales desde el cuadro anterior (0 si está en pausa)
   * @param gravity   gravedad en unidades de escena por s² (g·ROD/L)
   * @param bx, by    posición de la lenteja respecto del pivote
   * @param t         tiempo de la simulación; un salto grande (reinicio, bucle) endereza la cuerda
   */
  update(dt: number, gravity: number, bx: number, by: number, t: number, forceReset = false) {
    if (forceReset || t < this.lastT - 0.05 || Math.abs(t - this.lastT) > 0.5) {
      this.chain.reset(0, 0, bx, by)
      this.carry = 0
    }
    this.lastT = t
    this.carry += Math.min(dt, 1 / 20)
    const h = 1 / 120
    while (this.carry >= h) { this.chain.step(h, gravity, 0, 0, bx, by); this.carry -= h }
    if (dt === 0) this.chain.step(1e-6, 0, 0, 0, bx, by, 8, 1) // en pausa: solo mantener los extremos
    this.write()
  }

  private write() {
    const { x, y } = this.chain
    for (let i = 0; i < SEGMENTS; i++) {
      const dx = x[i + 1] - x[i], dy = y[i + 1] - y[i]
      this.tmp.position.set((x[i] + x[i + 1]) / 2, (y[i] + y[i + 1]) / 2, ROPE_Z)
      this.tmp.rotation.set(0, 0, Math.atan2(-dx, dy))
      this.tmp.scale.set(1, Math.hypot(dx, dy) * 1.02, 1)
      this.tmp.updateMatrix()
      this.mesh.setMatrixAt(i, this.tmp.matrix)
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }
}
