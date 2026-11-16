import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { energyHeight, phaseCurveLinear, phaseCurveReal, stateAt } from '../../core-ts/analysis'
import { useStore } from '../../state/store'
import { applyClassicMaterials, disposeSceneObject } from './classicMaterials'

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

/**
 * Escena 3D interactiva para la vista Laboratorio:
 * 1) modo 'paisaje': Superficie 3D de energía E(θ, ω) real frente a paraboloide lineal con esferas en vivo.
 * 2) modo 'euler': Dos péndulos 3D (pendulo.glb) lado a lado: Euler explícito (gana energía y se acelera solo) vs Euler simpléctico (acotado).
 */
export function LabStage3D({ mode }: { mode: 'paisaje' | 'euler' }) {
  const host = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const el = host.current
    if (!el) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    } catch {
      setFailed(true)
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.outputColorSpace = THREE.SRGBColorSpace
    el.appendChild(renderer.domElement)
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;cursor:grab'

    const scene = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environmentIntensity = 0.9

    const key = new THREE.DirectionalLight(0xfffaf0, 2.3)
    key.position.set(-5, 8, 9)
    key.castShadow = true
    scene.add(key)

    const rim = new THREE.DirectionalLight(0xdbeafe, 1.2)
    rim.position.set(6, 5, -6)
    scene.add(rim)

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 120)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.07

    let disposed = false
    let raf = 0

    const col = () => ({
      lin: cssVar('--lin') || '#1d4ed8',
      real: cssVar('--real') || '#c62828',
      bad: cssVar('--bad') || '#8f1d5b',
      warn: cssVar('--warn') || '#8a5a00',
      grid: cssVar('--grid-strong') || '#94a3b8',
    })

    // Objetos del modo 'paisaje'
    const landscapeGroup = new THREE.Group()
    let realOrbitLine: THREE.Line | null = null
    let linOrbitLine: THREE.Line | null = null
    let realBall: THREE.Mesh | null = null
    let linBall: THREE.Mesh | null = null
    let meshLinWireMat: THREE.MeshBasicMaterial | null = null
    let rebuildOrbits: (() => void) | null = null

    // Objetos del modo 'euler'
    const eulerGroup = new THREE.Group()
    let armEuler: THREE.Object3D | null = null
    let armSymp: THREE.Object3D | null = null
    let clockEuler: THREE.Object3D | null = null
    let clockSymp: THREE.Object3D | null = null
    let eulerState = { u: Math.PI / 3, v: 0 }
    let sympState = { u: Math.PI / 3, v: 0 }
    let accum = 0
    let lastNow = performance.now()
    let prevT = useStore.getState().t

    const resetIntegrators = () => {
      const { theta0Deg, side } = useStore.getState()
      const th0 = THREE.MathUtils.degToRad(theta0Deg) * side
      eulerState = { u: th0, v: 0 }
      sympState = { u: th0, v: 0 }
      accum = 0
    }
    resetIntegrators()

    if (mode === 'paisaje') {
      scene.add(landscapeGroup)
      const NX = 60, NZ = 44
      const geomReal = new THREE.BufferGeometry()
      const geomLin = new THREE.BufferGeometry()
      const posReal = new Float32Array((NX + 1) * (NZ + 1) * 3)
      const posLin = new Float32Array((NX + 1) * (NZ + 1) * 3)
      const colorsReal = new Float32Array((NX + 1) * (NZ + 1) * 3)
      const indices: number[] = []

      const cLow = new THREE.Color(col().lin)
      const cHigh = new THREE.Color(col().real)
      const cTmp = new THREE.Color()

      let pIdx = 0
      for (let iz = 0; iz <= NZ; iz++) {
        const wNorm = -1 + (2 * iz) / NZ // [-1, 1] -> ω / ω_max
        const zCoord = wNorm * 3.2
        for (let ix = 0; ix <= NX; ix++) {
          const thRad = -Math.PI + (2 * Math.PI * ix) / NX
          const xCoord = (thRad / Math.PI) * 4.5
          const eReal = energyHeight(thRad, wNorm, 'real')
          const eLin = Math.min(2.4, energyHeight(thRad, wNorm, 'linear'))
          posReal.set([xCoord, eReal, zCoord], pIdx * 3)
          posLin.set([xCoord, eLin, zCoord], pIdx * 3)
          const tCol = Math.max(0, Math.min(1, (eReal + 1.4) / 3.2))
          cTmp.copy(cLow).lerp(cHigh, tCol)
          colorsReal.set([cTmp.r, cTmp.g, cTmp.b], pIdx * 3)
          pIdx++
        }
      }
      for (let iz = 0; iz < NZ; iz++) {
        for (let ix = 0; ix < NX; ix++) {
          const a = iz * (NX + 1) + ix
          const b = a + 1
          const c = a + (NX + 1)
          const d = c + 1
          indices.push(a, c, b, b, c, d)
        }
      }
      geomReal.setIndex(indices)
      geomReal.setAttribute('position', new THREE.BufferAttribute(posReal, 3))
      geomReal.setAttribute('color', new THREE.BufferAttribute(colorsReal, 3))
      geomReal.computeVertexNormals()

      geomLin.setIndex(indices)
      geomLin.setAttribute('position', new THREE.BufferAttribute(posLin, 3))
      geomLin.computeVertexNormals()

      const meshReal = new THREE.Mesh(
        geomReal,
        new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.4, metalness: 0.15, transparent: true, opacity: 0.88 }),
      )
      meshLinWireMat = new THREE.MeshBasicMaterial({ color: col().grid, wireframe: true, transparent: true, opacity: 0.28 })
      const meshLinWire = new THREE.Mesh(geomLin, meshLinWireMat)
      landscapeGroup.add(meshReal, meshLinWire)

      realBall = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 24), new THREE.MeshStandardMaterial({ color: col().real, roughness: 0.2, metalness: 0.6 }))
      linBall = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 24), new THREE.MeshStandardMaterial({ color: col().lin, roughness: 0.2, metalness: 0.6 }))
      landscapeGroup.add(realBall, linBall)

      const disposeLine = (line: THREE.Line | null) => {
        if (!line) return
        landscapeGroup.remove(line)
        line.geometry.dispose()
        ;(line.material as THREE.Material).dispose()
      }

      rebuildOrbits = () => {
        const { theta0Deg, side, L, g } = useStore.getState()
        const wMax = (2 * Math.sqrt(g / L) * 180) / Math.PI
        const cr = phaseCurveReal(theta0Deg, L, g)
        const cl = phaseCurveLinear(theta0Deg, L, g)

        disposeLine(realOrbitLine)
        disposeLine(linOrbitLine)

        const makeLine = (xs: number[], ys: number[], isReal: boolean, color: string) => {
          const pts: THREE.Vector3[] = []
          for (let i = 0; i < xs.length; i++) {
            const thRad = THREE.MathUtils.degToRad(xs[i] * side)
            const wNorm = (ys[i] * side) / wMax
            const xC = (thRad / Math.PI) * 4.5
            const zC = wNorm * 3.2
            // misma energía en todos los puntos de la órbita ⇒ misma altura (se eleva 0.04 sobre la superficie para que se vea)
            const yC = energyHeight(thRad, wNorm, isReal ? 'real' : 'linear') + 0.04
            pts.push(new THREE.Vector3(xC, yC, zC))
          }
          const gLine = new THREE.BufferGeometry().setFromPoints(pts)
          return new THREE.Line(gLine, new THREE.LineBasicMaterial({ color }))
        }
        realOrbitLine = makeLine(cr.x, cr.y, true, col().real)
        linOrbitLine = makeLine(cl.x, cl.y, false, col().lin)
        landscapeGroup.add(realOrbitLine, linOrbitLine)
        if (realBall) (realBall.material as THREE.MeshStandardMaterial).color.set(col().real)
        if (linBall) (linBall.material as THREE.MeshStandardMaterial).color.set(col().lin)
        meshLinWireMat?.color.set(col().grid)
      }
      rebuildOrbits()
    } else {
      scene.add(eulerGroup)
      new GLTFLoader().load('/models/pendulo.glb', (gltf) => {
        if (disposed) return
        const root = gltf.scene
        applyClassicMaterials(root, renderer.capabilities.getMaxAnisotropy())
        const frame = root.getObjectByName('Frame')!
        const armT = root.getObjectByName('Arm')!
        const dialT = root.getObjectByName('Dial')!
        const cdialT = root.getObjectByName('ClockDial')
        const chandT = root.getObjectByName('ClockHand')
        root.remove(armT, dialT)
        if (cdialT) root.remove(cdialT)
        if (chandT) root.remove(chandT)
        eulerGroup.add(frame)

        const c = col()
        for (const side of ['euler', 'symp'] as const) {
          const gSide = new THREE.Group()
          gSide.position.x = side === 'euler' ? -2.5 : 2.5
          const arm = armT.clone(true)
          const dial = dialT.clone(true)
          const cdial = cdialT ? cdialT.clone(true) : null
          const chand = chandT ? chandT.clone(true) : null
          const tint = side === 'euler' ? c.bad : c.lin
          arm.traverse((o) => {
            const m = o as THREE.Mesh
            if (m.isMesh && m.name === 'Bob') {
              const mat = (m.material as THREE.MeshStandardMaterial).clone()
              mat.color.set(tint)
              m.material = mat
            }
          })
          gSide.add(dial, arm)
          if (cdial) gSide.add(cdial)
          if (chand) gSide.add(chand)
          eulerGroup.add(gSide)
          if (side === 'euler') { armEuler = arm; clockEuler = chand } else { armSymp = arm; clockSymp = chand }
        }
      }, undefined, () => { if (!disposed) setFailed(true) })
    }

    const fit = () => {
      const w = el.clientWidth, h = el.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      if (mode === 'paisaje') {
        camera.position.set(5.8, 4.4, 8.2)
        controls.target.set(0, -0.2, 0)
      } else {
        const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
        const dist = Math.max(14.6 / (2 * tan * camera.aspect), 7.6 / (2 * tan))
        camera.position.set(1.5, -0.8, dist)
        controls.target.set(0, -1.75, 0)
      }
      controls.update()
    }
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    fit()

    const unsub = useStore.subscribe((s, p) => {
      const paramChanged = s.theta0Deg !== p.theta0Deg || s.side !== p.side || s.L !== p.L || s.g !== p.g
      if (paramChanged) resetIntegrators()
      if (paramChanged || s.theme !== p.theme) rebuildOrbits?.()
    })

    const tick = (now = performance.now()) => {
      raf = requestAnimationFrame(tick)
      const dtReal = Math.min(0.05, Math.max(0, (now - lastNow) / 1000))
      lastNow = now
      controls.update()
      const { t, theta0Deg, side, L, g, playing, speed } = useStore.getState()
      if (t < prevT - 0.1 || (t === 0 && prevT > 0.05)) resetIntegrators()
      prevT = t

      if (mode === 'paisaje' && realBall && linBall) {
        const st = stateAt(t, { theta0Deg, L, g })
        const wMax = (2 * Math.sqrt(g / L) * 180) / Math.PI
        const setBall = (ball: THREE.Mesh, pt: { x: number; y: number }, isReal: boolean) => {
          const thRad = THREE.MathUtils.degToRad(pt.x * side)
          const wNorm = (pt.y * side) / wMax
          const xC = (thRad / Math.PI) * 4.5
          const zC = wNorm * 3.2
          const yC = energyHeight(thRad, wNorm, isReal ? 'real' : 'linear') + 0.08
          ball.position.set(xC, yC, zC)
        }
        setBall(realBall, st.real, true)
        setBall(linBall, st.lin, false)
      } else if (mode === 'euler' && armEuler && armSymp) {
        if (playing) {
          const w2 = g / L
          const H = 0.028 // Paso fijo deliberado para apreciar cómo Euler explícito inyecta energía
          accum = Math.min(accum + dtReal * speed, H * 4)
          while (accum >= H) {
            accum -= H
            // Euler explícito: u_{n+1} = u_n + h v_n, v_{n+1} = v_n - h w^2 sin(u_n)
            const uE = eulerState.u + H * eulerState.v
            const vE = eulerState.v - H * w2 * Math.sin(eulerState.u)
            eulerState = { u: uE, v: vE }
            // Euler simpléctico: actualiza primero v y usa esa velocidad para u
            const vS = sympState.v - H * w2 * Math.sin(sympState.u)
            const uS = sympState.u + H * vS
            sympState = { u: uS, v: vS }
          }
        }
        armEuler.rotation.z = eulerState.u
        armSymp.rotation.z = sympState.u
        if (clockEuler) clockEuler.rotation.z = -eulerState.v * 0.35
        if (clockSymp) clockSymp.rotation.z = -sympState.v * 0.35
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
      disposeSceneObject(scene)
      pmrem.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [mode])

  if (failed) return null
  return <div ref={host} className="h-full w-full" aria-hidden />
}
