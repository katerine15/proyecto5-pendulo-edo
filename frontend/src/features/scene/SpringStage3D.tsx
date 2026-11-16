import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { type SpringParams, exactSolution, omegaN } from '../../core-ts/springMass'
import { cForZeta } from '../../models/spring'
import { T_MAX, useStore } from '../../state/store'
import { applyClassicMaterials, disposeSceneObject } from './classicMaterials'

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

interface SpringRig {
  group: THREE.Group
  coil: THREE.Object3D
  mass: THREE.Object3D
  massMat: THREE.MeshStandardMaterial | null
  eqLine: THREE.Line
  zetaOverride?: number
  colorKey: 'lin' | 'ok' | 'real'
}

export function SpringStage3D({
  params, compareThree, onChangeX0,
}: {
  params: SpringParams
  compareThree: boolean
  onChangeX0?: (x0: number) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const badge = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const paramsRef = useRef(params)
  paramsRef.current = params
  const compareRef = useRef(compareThree)
  compareRef.current = compareThree
  const onChangeX0Ref = useRef(onChangeX0)
  onChangeX0Ref.current = onChangeX0
  const fitRef = useRef<(() => void) | null>(null)

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
    renderer.toneMappingExposure = 1.08
    renderer.outputColorSpace = THREE.SRGBColorSpace
    el.appendChild(renderer.domElement)
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;cursor:grab'

    const scene = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.035).texture
    scene.environmentIntensity = 0.95

    const key = new THREE.DirectionalLight(0xfffaf0, 2.4)
    key.position.set(-5, 7, 8)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    scene.add(key)

    const rim = new THREE.DirectionalLight(0xdbeafe, 1.3)
    rim.position.set(6, 4, -6)
    scene.add(rim)

    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.target.set(0, 0.3, 0)

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 20), new THREE.ShadowMaterial({ opacity: 0.22 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -2.36
    floor.receiveShadow = true
    scene.add(floor)

    let disposed = false
    let raf = 0
    const singleRig: SpringRig[] = []
    const tripleRigs: SpringRig[] = []
    const trailBuf = new Float32Array(120 * 3)
    const trailGeom = new THREE.BufferGeometry()
    trailGeom.setAttribute('position', new THREE.BufferAttribute(trailBuf, 3))
    const trailMat = new THREE.LineBasicMaterial({ color: '#1d4ed8', transparent: true, opacity: 0.72 })
    const singleTrail = new THREE.Line(trailGeom, trailMat)
    singleTrail.frustumCulled = false
    scene.add(singleTrail)
    const trailHistory: number[] = []
    let lastTrailT = -1

    const colors = () => ({
      lin: cssVar('--lin') || '#1d4ed8',
      ok: cssVar('--ok') || '#17663f',
      real: cssVar('--real') || '#c62828',
      grid: cssVar('--grid-strong') || '#94a3b8',
    })

    const fit = () => {
      const w = el.clientWidth, h = el.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      const wide = compareRef.current ? 12.6 : 5.4
      const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
      const dist = Math.max(wide / (2 * tan * camera.aspect), 5.6 / (2 * tan))
      camera.position.set(1.5, 1.0, dist)
      controls.target.set(0, 0.3, 0)
      controls.update()
    }
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    fitRef.current = fit

    const makeInstance = (
      sframeT: THREE.Object3D, coilT: THREE.Object3D, dcylT: THREE.Object3D, massT: THREE.Object3D,
      xPos: number, colorKey: 'lin' | 'ok' | 'real', zetaOverride?: number,
    ): SpringRig => {
      const group = new THREE.Group()
      group.position.x = xPos
      const frame = sframeT.clone(true)
      const coil = coilT.clone(true)
      const dcyl = dcylT.clone(true)
      const mass = massT.clone(true)
      let massMat: THREE.MeshStandardMaterial | null = null
      for (const part of [frame, coil, dcyl, mass]) {
        part.traverse((o) => {
          const m = o as THREE.Mesh
          if (!m.isMesh) return
          m.castShadow = true
          m.receiveShadow = true
          if (m.name === 'MassBlock') {
            massMat = (m.material as THREE.MeshStandardMaterial).clone()
            massMat.metalness = 0.72
            massMat.roughness = 0.24
            m.material = massMat
          }
        })
      }
      const eqGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.95, 0, 0.36),
        new THREE.Vector3(0.95, 0, 0.36),
      ])
      const eqLine = new THREE.Line(eqGeom, new THREE.LineBasicMaterial({ color: colors().grid, transparent: true, opacity: 0.45 }))
      group.add(frame, coil, dcyl, mass, eqLine)
      scene.add(group)
      return { group, coil, mass, massMat, eqLine, zetaOverride, colorKey }
    }

    const applyColors = () => {
      const col = colors()
      for (const r of [...singleRig, ...tripleRigs]) {
        r.massMat?.color.set(col[r.colorKey])
        ;(r.eqLine.material as THREE.LineBasicMaterial).color.set(col.grid)
      }
      trailMat.color.set(col.lin)
    }

    new GLTFLoader().load('/models/resorte.glb', (gltf) => {
      if (disposed) return
      const root = gltf.scene
      applyClassicMaterials(root, renderer.capabilities.getMaxAnisotropy())
      const sframeT = root.getObjectByName('SpringFrame')!
      const coilT = root.getObjectByName('SpringCoil')!
      const dcylT = root.getObjectByName('DamperCylinder')!
      const massT = root.getObjectByName('MassAssembly')!

      singleRig.push(makeInstance(sframeT, coilT, dcylT, massT, 0, 'lin'))
      tripleRigs.push(
        makeInstance(sframeT, coilT, dcylT, massT, -3.7, 'real', 0.3),
        makeInstance(sframeT, coilT, dcylT, massT, 0, 'ok', 1.0),
        makeInstance(sframeT, coilT, dcylT, massT, 3.7, 'lin', 1.5),
      )
      applyColors()
      fit()
    }, undefined, () => { if (!disposed) setFailed(true) })

    const unsub = useStore.subscribe((s, p) => {
      if (s.theme !== p.theme) requestAnimationFrame(applyColors)
    })

    // Arrastre directo de la masa en modo 1 Rig para fijar desplazamiento inicial x₀
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
    const dragHit = new THREE.Vector3()
    let dragging = false
    let wasPlaying = false
    let dragYVis = 0

    const toNdc = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
    }

    const onDown = (e: PointerEvent) => {
      if (compareRef.current || !singleRig[0]) return
      toNdc(e)
      raycaster.setFromCamera(ndc, camera)
      if (!raycaster.intersectObject(singleRig[0].mass, true).length) return
      dragging = true
      wasPlaying = useStore.getState().playing
      useStore.getState().setPlaying(false)
      useStore.getState().setT(0)
      trailHistory.length = 0
      controls.enabled = false
      renderer.domElement.setPointerCapture(e.pointerId)
      renderer.domElement.style.cursor = 'grabbing'
      onMove(e)
    }

    const onMove = (e: PointerEvent) => {
      toNdc(e)
      raycaster.setFromCamera(ndc, camera)
      if (!dragging) {
        if (!compareRef.current && singleRig[0]) {
          const hit = raycaster.intersectObject(singleRig[0].mass, true).length > 0
          renderer.domElement.style.cursor = hit ? 'ns-resize' : 'grab'
        } else {
          renderer.domElement.style.cursor = 'grab'
        }
        return
      }
      if (!raycaster.ray.intersectPlane(dragPlane, dragHit)) return
      const yClamp = Math.max(-0.72, Math.min(0.72, dragHit.y))
      dragYVis = yClamp
      const x0 = Math.round(((yClamp / 0.72) * 2) * 20) / 20
      onChangeX0Ref.current?.(x0)
      if (badge.current) {
        badge.current.style.opacity = '1'
        badge.current.textContent = `x₀ = ${x0.toFixed(2)} m`
      }
    }

    const onUp = (e: PointerEvent) => {
      if (!dragging) return
      dragging = false
      controls.enabled = true
      renderer.domElement.style.cursor = 'grab'
      if (renderer.domElement.hasPointerCapture(e.pointerId)) {
        renderer.domElement.releasePointerCapture(e.pointerId)
      }
      if (badge.current) badge.current.style.opacity = '0'
      if (wasPlaying) useStore.getState().setPlaying(true)
    }

    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('pointerup', onUp)
    renderer.domElement.addEventListener('pointercancel', onUp)

    const tick = () => {
      raf = requestAnimationFrame(tick)
      controls.update()
      const { t } = useStore.getState()
      const p = paramsRef.current
      const isTriple = compareRef.current
      const tSim = t % T_MAX
      const ampRef = Math.max(0.05, Math.abs(p.x0), Math.abs(p.v0) / Math.max(0.1, omegaN(p)))

      for (const r of singleRig) r.group.visible = !isTriple
      for (const r of tripleRigs) r.group.visible = isTriple
      singleTrail.visible = !isTriple

      const activeList = isTriple ? tripleRigs : singleRig
      for (const r of activeList) {
        const pLocal = r.zetaOverride !== undefined ? { ...p, c: cForZeta(r.zetaOverride, p) } : p
        const xVal = exactSolution(tSim, pLocal)
        // Normalización visual a ±0.68 m para que tanto x₀ = 0.05 m (bache Guía) como x₀ = 1 m se aprecien con claridad
        const yVis = dragging && !isTriple ? dragYVis : Math.max(-0.72, Math.min(0.72, (xVal / ampRef) * 0.62))
        r.mass.position.y = yVis
        const restHeight = 1.55
        const topSeatOffset = 0.42
        const currentSpringLen = Math.max(0.25, 2.0 - (yVis + topSeatOffset))
        r.coil.scale.y = currentSpringLen / restHeight

        if (!isTriple) {
          if (Math.abs(tSim - lastTrailT) > 0.015 || tSim < lastTrailT - 0.1) {
            if (tSim < lastTrailT - 0.1) trailHistory.length = 0
            lastTrailT = tSim
            trailHistory.push(yVis)
            if (trailHistory.length > 120) trailHistory.shift()
          }
          const n = trailHistory.length
          for (let i = 0; i < n; i++) {
            const age = (n - 1 - i) * 0.015
            trailBuf[i * 3] = 0.72 + age
            trailBuf[i * 3 + 1] = trailHistory[i]
            trailBuf[i * 3 + 2] = 0.25
          }
          trailGeom.setDrawRange(0, n)
          trailGeom.attributes.position.needsUpdate = true
        }
      }
      renderer.render(scene, camera)
    }
    tick()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointermove', onMove)
      renderer.domElement.removeEventListener('pointerup', onUp)
      renderer.domElement.removeEventListener('pointercancel', onUp)
      unsub()
      fitRef.current = null
      ro.disconnect()
      controls.dispose()
      disposeSceneObject(scene)
      pmrem.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  useEffect(() => {
    // Reencuadrar cuando cambia entre modo individual y comparador de 3 regímenes
    fitRef.current?.()
  }, [compareThree])

  if (failed) return null
  return (
    <div ref={host} className="relative h-full w-full" aria-hidden>
      <div
        ref={badge}
        className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full border border-[var(--grid-strong)] bg-[var(--paper)]/90 px-3 py-1 font-mono text-xs font-medium text-[var(--ink)] opacity-0 transition-opacity"
      />
    </div>
  )
}
