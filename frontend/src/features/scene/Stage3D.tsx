import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { dragRelease } from '../../lib/drag'
import { sample } from '../../lib/sample'
import { type CameraPreset, T_MAX, useStore } from '../../state/store'
import { applyClassicMaterials, disposeSceneObject } from './classicMaterials'
import { RopeVisual, splitArm } from './ropeVisual'

/**
 * Escena 3D interactiva de alta precisión.
 * Carga pendulo.glb (pórtico estriado, brazo con lenteja en relieve, rueda de escape, reloj comparador y goniómetro),
 * permite orbitar la cámara, arrastrar las lentejas en 3D para fijar θ₀, y muestra vectores dinámicos y atraso horológico.
 */
const PIVOT_X = 2.5
const ROD = 3.0
const TRAIL = 64
const TRAIL_DT = 0.008 // s de simulación entre puntos de la estela
const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

function labelSprite(text: string, color: string): THREE.Sprite {
  const c = document.createElement('canvas')
  c.width = 256; c.height = 128
  const g = c.getContext('2d')!
  g.font = '600 62px "Archivo Variable", system-ui, sans-serif'
  g.fillStyle = color
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(text, 128, 68)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }))
  sp.scale.set(0.8, 0.4, 1)
  return sp
}

function makeVectorArrow(color: string): THREE.Group {
  const g = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.3 })
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 16), mat)
  shaft.position.y = 0.5
  shaft.name = 'shaft'
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.18, 20), mat)
  head.position.y = 1.0
  head.name = 'head'
  g.add(shaft, head)
  return g
}

function setArrow(arrow: THREE.Group, origin: THREE.Vector3, dirAngleZ: number, magnitude: number) {
  const len = Math.min(1.6, Math.max(0.0, Math.abs(magnitude)))
  if (len < 0.03) {
    arrow.visible = false
    return
  }
  arrow.visible = true
  arrow.position.copy(origin)
  const sign = magnitude >= 0 ? 1 : -1
  // vector tangente al arco: (cos(th)*sign, sin(th)*sign, 0)
  const tx = Math.cos(dirAngleZ) * sign
  const ty = Math.sin(dirAngleZ) * sign
  arrow.rotation.z = Math.atan2(ty, tx) - Math.PI / 2
  const shaft = arrow.getObjectByName('shaft') as THREE.Mesh
  const head = arrow.getObjectByName('head') as THREE.Mesh
  shaft.scale.set(1, len, 1)
  shaft.position.y = len * 0.5
  head.position.y = len
}

interface Rig {
  kind: 'lin' | 'real'
  group: THREE.Group
  armRigid: THREE.Object3D
  armRope: THREE.Object3D | null
  bobMeshRigid: THREE.Mesh
  bobMeshRope: THREE.Mesh | null
  bobMats: THREE.MeshStandardMaterial[]
  escapeWheel: THREE.Object3D | null
  clockHand: THREE.Object3D | null
  handMat: THREE.MeshStandardMaterial | null
  exactArm: THREE.Group | null
  forceArrow: THREE.Group
  velArrow: THREE.Group
  trail: THREE.Line
  trailPos: Float32Array
  release: THREE.Mesh
  dial: THREE.Object3D
  dialMat: THREE.MeshStandardMaterial | null
  labels: THREE.Sprite[]
  rope: RopeVisual | null
}

export function Stage3D({ onFail, onPivots }: { onFail: () => void; onPivots: (xPct: { lin: number; real: number }) => void }) {
  const host = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [draggingAngle, setDraggingAngle] = useState<number | null>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    } catch {
      onFail()
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.08
    renderer.outputColorSpace = THREE.SRGBColorSpace
    el.appendChild(renderer.domElement)
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;cursor:grab'

    const scene = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.035).texture
    scene.environmentIntensity = 0.95

    // Iluminación de estudio de 3 puntos para acentuar los relieves y estrías del modelo 3D
    const key = new THREE.DirectionalLight(0xfffaf0, 2.5)
    key.position.set(-5.5, 8.5, 9.5)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    Object.assign(key.shadow.camera, { left: -9.5, right: 9.5, top: 6.5, bottom: -6.5, near: 1, far: 32 })
    key.shadow.radius = 4
    key.shadow.bias = -0.0003
    scene.add(key)

    const rim = new THREE.DirectionalLight(0xdbeafe, 1.35)
    rim.position.set(7.5, 5.0, -7.0)
    scene.add(rim)

    const underFill = new THREE.DirectionalLight(0xfef3c7, 0.65)
    underFill.position.set(0, -6.0, 5.0)
    scene.add(underFill)

    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 120)
    const defaultTarget = new THREE.Vector3(0, -1.75, 0)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.maxDistance = 42
    controls.minDistance = 4.5
    controls.maxPolarAngle = Math.PI * 0.62
    controls.target.copy(defaultTarget)

    const rigs: Rig[] = []
    let disposed = false
    let raf = 0
    let lastNow = performance.now()

    // Interpolación suave de presets de cámara
    const camGoalPos = new THREE.Vector3()
    const camGoalTarget = new THREE.Vector3().copy(defaultTarget)
    let camTransition = 0

    const colors = () => ({
      lin: cssVar('--lin') || '#1d4ed8',
      real: cssVar('--real') || '#c62828',
      exact: cssVar('--exact') || '#2b2b2b',
      warn: cssVar('--warn') || '#8a5a00',
      muted: cssVar('--muted') || '#566679',
    })

    let lastLinPct = -1
    let lastRealPct = -1
    const updateHudPivots = () => {
      const pct = (x: number) => (new THREE.Vector3(x, -0.35, 0).project(camera).x * 0.5 + 0.5) * 100
      const lin = Math.min(88, Math.max(12, pct(-PIVOT_X)))
      const real = Math.min(88, Math.max(12, pct(PIVOT_X)))
      if (Math.abs(lin - lastLinPct) > 0.05 || Math.abs(real - lastRealPct) > 0.05) {
        lastLinPct = lin
        lastRealPct = real
        onPivots({ lin, real })
      }
    }

    const computePresetPose = (preset: CameraPreset) => {
      const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
      const baseDist = Math.max(14.8 / (2 * tan * camera.aspect), 7.8 / (2 * tan))
      if (preset === 'frontal') {
        return { pos: new THREE.Vector3(0, -1.75, baseDist * 1.02), target: new THREE.Vector3(0, -1.75, 0) }
      }
      if (preset === 'reloj') {
        return { pos: new THREE.Vector3(0.5, 0.55, baseDist * 0.52), target: new THREE.Vector3(0, 0.32, 0) }
      }
      if (preset === 'superior') {
        return { pos: new THREE.Vector3(0, 5.2, baseDist * 0.72), target: new THREE.Vector3(0, -1.9, 0) }
      }
      return { pos: new THREE.Vector3(1.85, -0.65, baseDist), target: new THREE.Vector3(0, -1.75, 0) }
    }

    const applyCameraPreset = (preset: CameraPreset, instant = false) => {
      const { pos, target } = computePresetPose(preset)
      if (instant) {
        camera.position.copy(pos)
        controls.target.copy(target)
        controls.update()
        updateHudPivots()
      } else {
        camGoalPos.copy(pos)
        camGoalTarget.copy(target)
        camTransition = 1
      }
    }

    const fit = () => {
      const w = el.clientWidth, h = el.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      applyCameraPreset(useStore.getState().cameraPreset, true)
    }
    const ro = new ResizeObserver(fit)
    ro.observe(el)

    new GLTFLoader().load('/models/pendulo.glb', (gltf) => {
      if (disposed) return
      const root = gltf.scene
      applyClassicMaterials(root, renderer.capabilities.getMaxAnisotropy()) // nogal, latón, acero, cobre y vidrio
      const frame = root.getObjectByName('Frame')!
      const armRigidT = root.getObjectByName('Arm')!
      const armRopeT = armRigidT.clone(true)
      splitArm(armRopeT) // prepara versión sin varilla y con herrajes en la lenteja para el modo cuerda
      const dialT = root.getObjectByName('Dial')!
      const escT = root.getObjectByName('EscapeWheel')
      const cdialT = root.getObjectByName('ClockDial')
      const chandT = root.getObjectByName('ClockHand')
      root.remove(armRigidT, dialT)
      if (escT) root.remove(escT)
      if (cdialT) root.remove(cdialT)
      if (chandT) root.remove(chandT)
      scene.add(frame)

      const floor = new THREE.Mesh(new THREE.PlaneGeometry(44, 24), new THREE.ShadowMaterial({ opacity: 0.24 }))
      floor.rotation.x = -Math.PI / 2
      floor.position.y = -4.38
      floor.receiveShadow = true
      scene.add(floor)
      frame.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true } })

      const prepBob = (armObj: THREE.Object3D, mats: THREE.MeshStandardMaterial[]): THREE.Mesh => {
        let found!: THREE.Mesh
        armObj.traverse((o) => {
          const m = o as THREE.Mesh
          if (!m.isMesh) return
          m.castShadow = true
          m.receiveShadow = true
          if (m.name === 'Bob') {
            found = m
            const mat = (m.material as THREE.MeshStandardMaterial).clone()
            mat.metalness = 0.72
            mat.roughness = 0.22
            m.material = mat
            mats.push(mat)
          }
        })
        return found
      }

      const col = colors()
      for (const kind of ['lin', 'real'] as const) {
        const x = kind === 'lin' ? -PIVOT_X : PIVOT_X
        const group = new THREE.Group()
        group.position.x = x

        const bobMats: THREE.MeshStandardMaterial[] = []
        const armRigid = armRigidT.clone(true)
        const bobMeshRigid = prepBob(armRigid, bobMats)

        const armRope = kind === 'real' ? armRopeT.clone(true) : null
        const bobMeshRope = armRope ? prepBob(armRope, bobMats) : null
        if (armRope) armRope.visible = false

        // Rueda de escape y reloj comparador horológico sobre el pivote
        const escapeWheel = escT ? escT.clone(true) : null
        const clockDial = cdialT ? cdialT.clone(true) : null
        const clockHand = chandT ? chandT.clone(true) : null
        let handMat: THREE.MeshStandardMaterial | null = null
        if (clockHand) {
          clockHand.traverse((o) => {
            const m = o as THREE.Mesh
            if (!m.isMesh) return
            m.castShadow = true
            if (Array.isArray(m.material)) {
              m.material = m.material.map((mat) => {
                const std = mat as THREE.MeshStandardMaterial
                if (std.name === 'Bob') {
                  handMat = std.clone()
                  return handMat
                }
                return std
              })
            } else if ((m.material as THREE.MeshStandardMaterial).name === 'Bob') {
              handMat = (m.material as THREE.MeshStandardMaterial).clone()
              m.material = handMat
            }
          })
        }
        if (escapeWheel) group.add(escapeWheel)
        if (clockDial) group.add(clockDial)
        if (clockHand) group.add(clockHand)

        const dial = dialT.clone(true)
        let dialMat: THREE.MeshStandardMaterial | null = null
        dial.traverse((o) => {
          const m = o as THREE.Mesh
          if (!m.isMesh) return
          if (!dialMat) dialMat = (m.material as THREE.MeshStandardMaterial).clone()
          m.material = dialMat
        })
        group.add(dial, armRigid)
        if (armRope) group.add(armRope)
        const rope = kind === 'real' ? new RopeVisual(group, ROD, renderer.capabilities.getMaxAnisotropy()) : null
        rope?.setVisible(false)

        // Fantasma de la solución exacta elíptica sobre el péndulo real
        let exactArm: THREE.Group | null = null
        if (kind === 'real') {
          exactArm = new THREE.Group()
          exactArm.position.copy(armRigid.position)
          const exRing = new THREE.Mesh(
            new THREE.TorusGeometry(0.39, 0.016, 14, 48),
            new THREE.MeshBasicMaterial({ color: col.exact, transparent: true, opacity: 0.75 }),
          )
          exRing.position.set(0, -ROD, 0)
          exactArm.add(exRing)
          group.add(exactArm)
        }

        // Vectores 3D de fuerza restauradora tangencial y velocidad angular
        const forceArrow = makeVectorArrow(col[kind])
        const velArrow = makeVectorArrow(col.warn)
        group.add(forceArrow, velArrow)

        const labels: THREE.Sprite[] = []
        for (let a = -150; a <= 150; a += 30) {
          if (a === 0) continue
          const sp = labelSprite(`${Math.abs(a)}°`, col.muted)
          const th = THREE.MathUtils.degToRad(a)
          sp.position.set(Math.sin(th) * (ROD + 1.02), -Math.cos(th) * (ROD + 1.02), -0.14)
          group.add(sp)
          labels.push(sp)
        }

        const trailPos = new Float32Array(TRAIL * 3)
        const tg = new THREE.BufferGeometry()
        tg.setAttribute('position', new THREE.BufferAttribute(trailPos, 3))
        tg.setDrawRange(0, 0)
        const trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: col[kind], transparent: true, opacity: 0.68 }))
        trail.frustumCulled = false
        group.add(trail)

        const release = new THREE.Mesh(
          new THREE.TorusGeometry(0.14, 0.022, 14, 40),
          new THREE.MeshBasicMaterial({ color: col[kind] }),
        )
        group.add(release)
        scene.add(group)
        rigs.push({
          kind, group, armRigid, armRope, bobMeshRigid, bobMeshRope, bobMats,
          escapeWheel, clockHand, handMat, exactArm, forceArrow, velArrow,
          trail, trailPos, release, dial, dialMat, labels, rope,
        })
      }
      applyTheme()
      setReady(true)
      fit()
    }, undefined, () => { if (!disposed) onFail() })

    function applyTheme() {
      const col = colors()
      const dark = useStore.getState().theme === 'dark'
      for (const r of rigs) {
        for (const bm of r.bobMats) bm.color.set(col[r.kind])
        r.handMat?.color.set(col[r.kind])
        r.dialMat?.color.set(dark ? '#7b8ba0' : '#d5ccb4')
        ;(r.trail.material as THREE.LineBasicMaterial).color.set(col[r.kind])
        ;(r.release.material as THREE.MeshBasicMaterial).color.set(col[r.kind])
        r.forceArrow.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) ((o as THREE.Mesh).material as THREE.MeshStandardMaterial).color.set(col[r.kind])
        })
        r.velArrow.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) ((o as THREE.Mesh).material as THREE.MeshStandardMaterial).color.set(col.warn)
        })
      }
    }

    const rebuildLabels = () => {
      const col = colors()
      for (const r of rigs) {
        for (const sp of r.labels) r.group.remove(sp)
        r.labels.length = 0
        for (let a = -150; a <= 150; a += 30) {
          if (a === 0) continue
          const sp = labelSprite(`${Math.abs(a)}°`, col.muted)
          const th = THREE.MathUtils.degToRad(a)
          sp.position.set(Math.sin(th) * (ROD + 1.02), -Math.cos(th) * (ROD + 1.02), -0.14)
          r.group.add(sp)
          r.labels.push(sp)
        }
      }
    }

    // ───────────── Interacción 3D: Arrastrar lenteja con el puntero para cambiar θ₀ ─────────────
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.16)
    const hitPoint = new THREE.Vector3()
    let activeDragRig: Rig | null = null
    let wasPlayingBeforeDrag = false

    const updatePointer = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }

    const activeBobs = () => {
      const ropeOn = useStore.getState().ropeMode
      return rigs.map((r) => (r.kind === 'real' && ropeOn && r.bobMeshRope ? r.bobMeshRope : r.bobMeshRigid))
    }

    const onPointerDown = (e: PointerEvent) => {
      if (rigs.length === 0) return
      updatePointer(e)
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(activeBobs(), false)
      if (hits.length > 0) {
        const hitMesh = hits[0].object
        activeDragRig = rigs.find((r) => r.bobMeshRigid === hitMesh || r.bobMeshRope === hitMesh) ?? null
        if (activeDragRig) {
          controls.enabled = false
          wasPlayingBeforeDrag = useStore.getState().playing
          useStore.getState().setPlaying(false)
          useStore.getState().reset()
          renderer.domElement.style.cursor = 'grabbing'
          renderer.domElement.setPointerCapture(e.pointerId)
        }
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      updatePointer(e)
      raycaster.setFromCamera(pointer, camera)
      if (activeDragRig) {
        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          const localX = hitPoint.x - activeDragRig.group.position.x
          const localY = hitPoint.y
          // ángulo con signo: se puede soltar a los dos lados y por encima de la horizontal (hasta ±170°)
          const { magnitudeDeg, side } = dragRelease(localX, localY)
          setDraggingAngle(side * magnitudeDeg)
          useStore.getState().set({ theta0Deg: magnitudeDeg, side })
        }
        return
      }
      const hits = raycaster.intersectObjects(activeBobs(), false)
      renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : 'grab'
    }

    const onPointerUp = (e: PointerEvent) => {
      if (activeDragRig) {
        activeDragRig = null
        setDraggingAngle(null)
        controls.enabled = true
        if (wasPlayingBeforeDrag) useStore.getState().setPlaying(true)
        renderer.domElement.style.cursor = 'grab'
        try { renderer.domElement.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
      }
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerup', onPointerUp)
    renderer.domElement.addEventListener('pointercancel', onPointerUp)

    const unsub = useStore.subscribe((s, p) => {
      if (s.theme !== p.theme) requestAnimationFrame(() => { applyTheme(); rebuildLabels() })
      if (s.cameraPreset !== p.cameraPreset) applyCameraPreset(s.cameraPreset, false)
      if (s.theta0Deg !== p.theta0Deg || s.side !== p.side || s.L !== p.L || s.g !== p.g || s.ropeMode !== p.ropeMode) {
        for (const r of rigs) r.trail.geometry.setDrawRange(0, 0)
      }
    })

    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (camTransition > 0.005) {
        camera.position.lerp(camGoalPos, 0.14)
        controls.target.lerp(camGoalTarget, 0.14)
        if (camera.position.distanceTo(camGoalPos) < 0.03) camTransition = 0
      }
      controls.update()
      updateHudPivots()

      const { sim, t, theta0Deg, side, L, g, playing, speed, showTrail, showDial, showExact, showVectors, ropeMode } = useStore.getState()
      const nowMs = performance.now()
      const dtReal = Math.min(0.1, (nowMs - lastNow) / 1000)
      lastNow = nowMs
      if (sim) {
        for (const r of rigs) {
          r.trail.visible = showTrail
          r.dial.visible = showDial
          for (const sp of r.labels) sp.visible = showDial
          const arr = r.kind === 'lin' ? sim.thetaLinearDeg : sim.thetaRealDeg
          const degNow = activeDragRig ? side * theta0Deg : sample(arr, t, T_MAX)
          const th = THREE.MathUtils.degToRad(degNow)

          const useRope = r.kind === 'real' && ropeMode && !!r.armRope && !!r.rope
          r.armRigid.visible = !useRope
          r.armRigid.rotation.z = th
          if (r.armRope) {
            r.armRope.visible = useRope
            r.armRope.rotation.z = th
          }

          // Cuerda (solo en modo cuerda para el péndulo real); en varilla rígida la distancia siempre es L
          const rNow = useRope && sim.ropeR && !activeDragRig ? sample(sim.ropeR, t, T_MAX) : 1
          const bx = Math.sin(th) * ROD * rNow, by = -Math.cos(th) * ROD * rNow
          if (useRope && r.bobMeshRope && r.rope) {
            r.bobMeshRope.position.y = -ROD * rNow
            r.rope.setVisible(true)
            r.rope.update(playing ? dtReal * speed : 0, (g * ROD) / L, bx, by, t, !!activeDragRig)
          } else {
            r.rope?.setVisible(false)
          }

          // Rueda de escape y reloj comparador: giran según los ciclos completados (t / T)
          const period = r.kind === 'lin' ? sim.T0 : sim.TReal
          const cycles = activeDragRig ? 0 : t / Math.max(0.1, period)
          if (r.escapeWheel) {
            r.escapeWheel.rotation.z = -cycles * (Math.PI * 2) / 12 + Math.sin(th) * 0.04
          }
          if (r.clockHand) {
            // 1 vuelta completa cada 6 oscilaciones para lectura clara del atraso horológico
            r.clockHand.rotation.z = -cycles * (Math.PI * 2) / 6
          }

          // Fantasma de la solución exacta elíptica
          if (r.exactArm) {
            r.exactArm.visible = showExact && !activeDragRig
            const thEx = THREE.MathUtils.degToRad(sample(sim.thetaExactDeg, t, T_MAX))
            r.exactArm.rotation.z = thEx
          }

          // Vectores dinámicos 3D (fuerza restauradora tangencial / caída libre y velocidad)
          if (showVectors) {
            const bobPos = new THREE.Vector3(bx, by, 0.34)
            const slackFall = useRope && rNow < 0.999
            if (slackFall) {
              setArrow(r.forceArrow, bobPos, -Math.PI / 2, 0.65)
            } else {
              const restoringMag = r.kind === 'lin' ? -th * 0.65 : -Math.sin(th) * 0.65
              setArrow(r.forceArrow, bobPos, th, restoringMag)
            }
            const dt = 0.015
            const omegaRad = t + dt <= T_MAX
              ? THREE.MathUtils.degToRad((sample(arr, t + dt, T_MAX) - degNow) / dt)
              : THREE.MathUtils.degToRad((degNow - sample(arr, Math.max(0, t - dt), T_MAX)) / dt)
            setArrow(r.velArrow, bobPos, th, activeDragRig ? 0 : omegaRad * 0.22)
          } else {
            r.forceArrow.visible = false
            r.velArrow.visible = false
          }

          // Estela por tiempo simulado
          let n = 0
          for (let k = 0; k < TRAIL; k++) {
            const tk = t - (TRAIL - 1 - k) * TRAIL_DT
            if (tk < 0) continue
            const a = THREE.MathUtils.degToRad(sample(arr, tk, T_MAX))
            const rk = r.kind === 'real' && sim.ropeR ? sample(sim.ropeR, tk, T_MAX) : 1
            r.trailPos.set([Math.sin(a) * ROD * rk, -Math.cos(a) * ROD * rk, 0.16], n * 3)
            n++
          }
          r.trail.geometry.setDrawRange(0, n)
          r.trail.geometry.attributes.position.needsUpdate = true
          const a0 = THREE.MathUtils.degToRad(side * theta0Deg)
          r.release.position.set(Math.sin(a0) * (ROD + 0.62), -Math.cos(a0) * (ROD + 0.62), -0.14)
        }
      }
      renderer.render(scene, camera)
    }
    tick()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      unsub()
      ro.disconnect()
      controls.dispose()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('pointercancel', onPointerUp)
      disposeSceneObject(scene)
      pmrem.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div ref={host} className="relative h-full w-full" data-ready={ready} aria-hidden>
      {draggingAngle !== null && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border px-3.5 py-1 text-xs font-semibold shadow-sm"
          style={{ background: 'var(--paper)', borderColor: 'var(--rule)', color: 'var(--ink)' }}>
          Soltar desde θ₀ = {draggingAngle}°
        </div>
      )}
    </div>
  )
}
