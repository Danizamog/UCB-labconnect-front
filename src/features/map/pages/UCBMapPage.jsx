import { useEffect, useMemo, useRef, useState } from 'react'
import { COLISEO_GEOJSON } from '../data/coliseoGeoData'
import './UCBMapPage.css'

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function detectQualityProfile() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  const effectiveType = (connection?.effectiveType || '').toLowerCase()
  const saveData = Boolean(connection?.saveData)
  const memory = Number(navigator.deviceMemory || 4)
  const cores = Number(navigator.hardwareConcurrency || 4)

  if (saveData || effectiveType.includes('2g')) {
    return { label: 'Lite', antialias: false, pixelRatioCap: 1, maxFps: 24, spacingFactor: 1.9 }
  }
  if (effectiveType.includes('3g') || memory <= 4 || cores <= 4) {
    return { label: 'Baja', antialias: false, pixelRatioCap: 1, maxFps: 30, spacingFactor: 1.75 }
  }
  if (memory <= 8 || cores <= 8) {
    return { label: 'Media', antialias: false, pixelRatioCap: 1.5, maxFps: 45, spacingFactor: 1.65 }
  }
  return { label: 'Alta', antialias: true, pixelRatioCap: 2, maxFps: 60, spacingFactor: 1.55 }
}

function signedArea(ring) {
  let area = 0
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x1, y1] = ring[index]
    const [x2, y2] = ring[index + 1]
    area += x1 * y2 - x2 * y1
  }
  return area / 2
}

function rotateRingStart(ring) {
  if (ring.length < 4) {
    return ring
  }

  let bestIndex = 0
  for (let index = 1; index < ring.length - 1; index += 1) {
    const [bestLon, bestLat] = ring[bestIndex]
    const [lon, lat] = ring[index]
    if (lat > bestLat || (Math.abs(lat - bestLat) < 1e-10 && lon < bestLon)) {
      bestIndex = index
    }
  }

  const openRing = ring.slice(0, -1)
  const rotated = [...openRing.slice(bestIndex), ...openRing.slice(0, bestIndex)]
  rotated.push(rotated[0])
  return rotated
}

function normalizeRingOrder(coords) {
  if (!Array.isArray(coords) || coords.length < 3) {
    return []
  }
  const ring = coords
    .map((point) => (Array.isArray(point) && point.length >= 2 ? [Number(point[0]), Number(point[1])] : null))
    .filter((point) => Number.isFinite(point?.[0]) && Number.isFinite(point?.[1]))
    .filter((point, index, array) => {
      if (index === 0) {
        return true
      }
      const [prevLon, prevLat] = array[index - 1]
      const [lon, lat] = point
      return Math.abs(prevLon - lon) > 1e-10 || Math.abs(prevLat - lat) > 1e-10
    })

  if (ring.length < 3) {
    return []
  }

  const [startLon, startLat] = ring[0]
  const [endLon, endLat] = ring[ring.length - 1]
  const isClosed = Math.abs(startLon - endLon) < 1e-8 && Math.abs(startLat - endLat) < 1e-8
  if (!isClosed) {
    ring.push([startLon, startLat])
  }

  const clockwiseRing = signedArea(ring) < 0 ? ring : [...ring].reverse()
  return rotateRingStart(clockwiseRing)
}

function buildBlocksFromGeoJSON(featureCollection) {
  const features = Array.isArray(featureCollection?.features) ? featureCollection.features : []

  const blocks = features
    .map((feature, index) => {
      const ring = normalizeRingOrder(feature?.geometry?.coordinates)
      if (ring.length < 4) {
        return null
      }

      return {
        id: index + 1,
        name: feature?.properties?.name || `Bloque ${index + 1}`,
        description: 'Molde 3D generado desde coordenadas GeoJSON.',
        ring,
        height: 10 + (index % 4) * 4,
      }
    })
    .filter(Boolean)

  return blocks
}

function getCenter(blocks) {
  const allPoints = blocks.flatMap((block) => block.ring)
  if (allPoints.length === 0) {
    return { latitude: -16.5225, longitude: -68.1118 }
  }
  const sum = allPoints.reduce(
    (acc, [lon, lat]) => ({ latitude: acc.latitude + lat, longitude: acc.longitude + lon }),
    { latitude: 0, longitude: 0 },
  )
  return {
    latitude: sum.latitude / allPoints.length,
    longitude: sum.longitude / allPoints.length,
  }
}

function toXZ(lon, lat, center, spacingFactor) {
  const centerLatRad = (center.latitude * Math.PI) / 180
  const x = (lon - center.longitude) * 111320 * Math.cos(centerLatRad) * spacingFactor
  const z = -(lat - center.latitude) * 110540 * spacingFactor
  return [x, z]
}

function UCBMapPage() {
  const [error, setError] = useState('')
  const [selectedBlockId, setSelectedBlockId] = useState(null)
  const [webglSupported] = useState(() => supportsWebGL())
  const containerRef = useRef(null)
  const engineRef = useRef(null)
  const quality = useMemo(() => detectQualityProfile(), [])
  const blocks = useMemo(() => buildBlocksFromGeoJSON(COLISEO_GEOJSON), [])
  const selectedBlock = useMemo(() => blocks.find((block) => block.id === selectedBlockId) || blocks[0] || null, [blocks, selectedBlockId])

  useEffect(() => {
    if (!selectedBlockId && blocks.length > 0) {
      setSelectedBlockId(blocks[0].id)
    }
  }, [blocks, selectedBlockId])

  useEffect(() => {
    if (!webglSupported || !containerRef.current || engineRef.current) {
      return
    }

    let disposed = false
    let frameId = 0

    const initialize = async () => {
      const THREE = await import('three')
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
      if (disposed || !containerRef.current) {
        return
      }

      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0xf4f7fb)

      const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 5000)
      camera.position.set(140, 160, 170)

      const renderer = new THREE.WebGLRenderer({ antialias: quality.antialias, alpha: false })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatioCap))
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
      containerRef.current.appendChild(renderer.domElement)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.08
      controls.minDistance = 30
      controls.maxDistance = 1000
      controls.maxPolarAngle = Math.PI * 0.48

      scene.add(new THREE.AmbientLight(0xffffff, 0.8))
      const directional = new THREE.DirectionalLight(0xffffff, 0.6)
      directional.position.set(140, 200, 60)
      scene.add(directional)

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(1400, 1400),
        new THREE.MeshStandardMaterial({ color: 0xe6edf6, roughness: 0.95, metalness: 0.02 }),
      )
      ground.rotation.x = -Math.PI / 2
      scene.add(ground)
      scene.add(new THREE.GridHelper(1200, 48, 0x94a3b8, 0xcbd5e1))

      const blocksGroup = new THREE.Group()
      scene.add(blocksGroup)
      const clickableMeshes = new Map()

      const raycaster = new THREE.Raycaster()
      const pointer = new THREE.Vector2()
      const onPointerDown = (event) => {
        const rect = renderer.domElement.getBoundingClientRect()
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
        raycaster.setFromCamera(pointer, camera)
        const intersections = raycaster.intersectObjects([...clickableMeshes.values()], false)
        const id = Number(intersections[0]?.object?.userData?.blockId)
        if (Number.isFinite(id)) {
          setSelectedBlockId(id)
        }
      }
      renderer.domElement.addEventListener('pointerdown', onPointerDown)

      const onResize = () => {
        if (!containerRef.current) {
          return
        }
        const { clientWidth, clientHeight } = containerRef.current
        camera.aspect = clientWidth / Math.max(clientHeight, 1)
        camera.updateProjectionMatrix()
        renderer.setSize(clientWidth, clientHeight)
      }
      window.addEventListener('resize', onResize)
      onResize()

      let lastTime = 0
      const minDelta = Math.round(1000 / quality.maxFps)
      const animate = (time = 0) => {
        if (disposed) {
          return
        }
        frameId = requestAnimationFrame(animate)
        if (time - lastTime >= minDelta) {
          controls.update()
          renderer.render(scene, camera)
          lastTime = time
        }
      }
      animate()

      engineRef.current = {
        THREE,
        camera,
        controls,
        renderer,
        blocksGroup,
        clickableMeshes,
        dispose: () => {
          disposed = true
          cancelAnimationFrame(frameId)
          window.removeEventListener('resize', onResize)
          renderer.domElement.removeEventListener('pointerdown', onPointerDown)
          blocksGroup.children.forEach((object) => {
            object.traverse((child) => {
              child.geometry?.dispose?.()
              if (Array.isArray(child.material)) {
                child.material.forEach((material) => material?.dispose?.())
              } else {
                child.material?.dispose?.()
              }
            })
          })
          renderer.dispose()
          renderer.domElement.parentElement?.removeChild(renderer.domElement)
          engineRef.current = null
        },
      }
    }

    initialize().catch((err) => {
      if (!disposed) {
        setError(err?.message || 'No se pudo iniciar el render 3D.')
      }
    })

    return () => {
      disposed = true
      engineRef.current?.dispose?.()
    }
  }, [quality, webglSupported])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) {
      return
    }

    const { THREE, blocksGroup, clickableMeshes, controls, camera } = engine
    clickableMeshes.clear()
    while (blocksGroup.children.length > 0) {
      const object = blocksGroup.children.pop()
      object.traverse((child) => {
        child.geometry?.dispose?.()
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material?.dispose?.())
        } else {
          child.material?.dispose?.()
        }
      })
    }

    if (blocks.length === 0) {
      return
    }

    const center = getCenter(blocks)
    let maxDistance = 0

    blocks.forEach((block) => {
      const pointsXZ = block.ring.map(([lon, lat]) => toXZ(lon, lat, center, quality.spacingFactor))
      const shape = new THREE.Shape(pointsXZ.map(([x, z]) => new THREE.Vector2(x, z)))
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: block.height, bevelEnabled: false, steps: 1 })
      geometry.rotateX(-Math.PI / 2)

      const isSelected = selectedBlock?.id === block.id
      const color = isSelected ? 0x1d4ed8 : 0x64748b

      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({ color, roughness: 0.58, metalness: 0.16 }),
      )
      mesh.userData.blockId = block.id
      blocksGroup.add(mesh)
      clickableMeshes.set(block.id, mesh)

      const topLinePoints = pointsXZ.map(([x, z]) => new THREE.Vector3(x, block.height + 0.05, z))
      const topOutline = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(topLinePoints),
        new THREE.LineBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.7 }),
      )
      blocksGroup.add(topOutline)

      pointsXZ.forEach(([x, z]) => {
        maxDistance = Math.max(maxDistance, Math.sqrt(x * x + z * z))
      })
    })

    const safeDistance = Math.max(maxDistance * 1.75, 180)
    camera.position.set(safeDistance * 0.75, safeDistance * 0.85, safeDistance)
    controls.target.set(0, 8, 0)
    controls.update()
  }, [blocks, quality.spacingFactor, selectedBlock?.id])

  return (
    <section className="ucb-map-page" aria-label="Mapa UCB 3D">
      <header className="ucb-map-header">
        <p className="ucb-map-kicker">Campus UCB</p>
        <h2>Molde 3D de bloques (sin mapa base)</h2>
        <p>Usando tus coordenadas GeoJSON del coliseo, renderizado directo en Three.js.</p>
        <p>Navegación del mapa 3D habilitada.</p>
        <p className="ucb-map-quality">
          Calidad automática: <strong>{quality.label}</strong>
        </p>
      </header>

      {error ? <p className="ucb-map-error">{error}</p> : null}
      {!webglSupported ? <p className="ucb-map-error">Tu navegador no soporta WebGL para esta vista 3D.</p> : null}

      <div className="ucb-map-layout">
        <article className="ucb-map-frame-card">
          <div className="ucb-map-canvas" ref={containerRef} role="img" aria-label="Molde 3D de bloques UCB" />
        </article>

        <aside className="ucb-map-buildings">
          {blocks.map((block) => {
            const isActive = block.id === selectedBlock?.id
            return (
              <button
                key={block.id}
                type="button"
                className={`ucb-map-building-card${isActive ? ' is-active' : ''}`}
                onClick={() => setSelectedBlockId(block.id)}
              >
                <div className="ucb-map-building-top">
                  <strong>{block.name}</strong>
                  <span className="ucb-map-badge ok">3D</span>
                </div>
                <p>{block.description}</p>
                <small>Altura: {block.height}m · Vértices: {block.ring.length - 1}</small>
              </button>
            )
          })}
        </aside>
      </div>
    </section>
  )
}

export default UCBMapPage
