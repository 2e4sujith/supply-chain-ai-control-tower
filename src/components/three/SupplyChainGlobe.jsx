import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import {
  latLonToVector3,
  createArcSpline,
  calculateCameraDistance,
  createStarfield,
  createEarthShaderMaterial,
  createAtmosphereShaderMaterial,
  createProceduralEarthTexture,
} from './mathUtils.js'
import SceneFallback from './SceneFallback.jsx'
import { PREDEFINED_HUBS } from '../../services/geocoding.js'
import {
  RotateCcw,
  Play,
  Pause,
  MapPin,
  Route as RouteIcon,
  ShieldAlert,
} from 'lucide-react'
import './SupplyChainGlobe.css'

export default function SupplyChainGlobe({
  shipments = [],
  selectedShipmentId = null,
  onSelectShipment,
  compact = false,
  height = '490px',
  title = 'Global Logistics Digital Twin',
  subtitle = 'Real-time Multimodal Corridors & Satellite Telemetry',
}) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)

  // Interactive UI State
  const [autoRotate, setAutoRotate] = useState(true)
  const [showRings, setShowRings] = useState(true)
  const [hoveredInfo, setHoveredInfo] = useState(null)
  const [webGlSupported, setWebGlSupported] = useState(true)
  const [initError, setInitError] = useState(null)
  const [activeFilter, setActiveFilter] = useState('ALL') // 'ALL', 'CRITICAL'

  // Internal Three.js persistent refs
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const rendererRef = useRef(null)
  const globeGroupRef = useRef(null)
  const cloudsMeshRef = useRef(null)
  const routesGroupRef = useRef(null)
  const hubsGroupRef = useRef(null)
  const particlesRef = useRef([])
  const animFrameRef = useRef(null)
  const defaultDistRef = useRef(5.5)

  // Drag interaction state
  const isDraggingRef = useRef(false)
  const previousMousePositionRef = useRef({ x: 0, y: 0 })
  const rotationVelocityRef = useRef({ x: 0, y: 0.0015 })
  const userInteractedTimeoutRef = useRef(null)

  // Check WebGL availability
  const checkWebGL = useCallback(() => {
    try {
      const testCanvas = document.createElement('canvas')
      return Boolean(
        window.WebGLRenderingContext &&
          (testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl'))
      )
    } catch {
      return false
    }
  }, [])

  // Resolve hub coordinates safely
  const resolveCoord = useCallback((locName) => {
    if (!locName) return null
    const clean = String(locName).trim().toLowerCase()

    // 1. Exact match in PREDEFINED_HUBS
    for (const [key, val] of Object.entries(PREDEFINED_HUBS)) {
      if (key.toLowerCase() === clean) {
        return { lat: val.lat, lon: val.lon, name: val.city || key, country: val.country }
      }
    }

    // 2. Token match (e.g. "Shanghai, CN" -> "Shanghai")
    const firstToken = clean.split(',')[0].trim()
    for (const [key, val] of Object.entries(PREDEFINED_HUBS)) {
      if (key.toLowerCase() === firstToken || (val.city && val.city.toLowerCase() === firstToken)) {
        return { lat: val.lat, lon: val.lon, name: val.city || key, country: val.country }
      }
    }

    // 3. Substring match
    for (const [key, val] of Object.entries(PREDEFINED_HUBS)) {
      if (clean.includes(key.toLowerCase()) || (val.city && clean.includes(val.city.toLowerCase()))) {
        return { lat: val.lat, lon: val.lon, name: val.city || key, country: val.country }
      }
    }

    return null
  }, [])

  // Initialize Three.js scene
  useEffect(() => {
    if (!checkWebGL()) {
      setWebGlSupported(false)
      return
    }

    const container = containerRef.current
    if (!container) return

    const width = container.clientWidth || 800
    const heightPx = container.clientHeight || 460
    const aspect = width / heightPx

    // 1. Scene
    const scene = new THREE.Scene()
    sceneRef.current = scene

    // 2. Camera: Calculate optimal framing distance so Earth is centered with zero clipping
    const optimalDist = calculateCameraDistance(aspect, 42, 2.75, 1.16)
    defaultDistRef.current = optimalDist

    const elevationAngle = 0.20 // ~11.5 deg elevation looking at Northern Hemisphere trade corridors
    const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 150)
    camera.position.set(
      0,
      optimalDist * Math.sin(elevationAngle),
      optimalDist * Math.cos(elevationAngle)
    )
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    // 3. Renderer
    let renderer
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.current,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      })
      renderer.setSize(width, heightPx, false)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setClearColor(0x000000, 0)
      rendererRef.current = renderer
    } catch (err) {
      console.warn('WebGL init error:', err)
      setInitError('Unable to initialize WebGL context.')
      return
    }

    // 4. Lighting: Natural solar daylight + soft rim lighting
    const sunDirection = new THREE.Vector3(3.5, 3.0, 6.0)

    const ambientLight = new THREE.AmbientLight(0x223854, 2.0)
    scene.add(ambientLight)

    const sunLight = new THREE.DirectionalLight(0xfff6ea, 2.2)
    sunLight.position.copy(sunDirection)
    scene.add(sunLight)

    const rimLight = new THREE.DirectionalLight(0x25d9f8, 1.2)
    rimLight.position.set(-6, -2, -4)
    scene.add(rimLight)

    // 5. Background Starfield
    const starfield = createStarfield(800, 35)
    scene.add(starfield)

    // 6. Globe Parent Group
    const globeGroup = new THREE.Group()
    // Initial orientation: brings transpacific and Asian-American corridors (Shanghai -> Long Beach) into prime front view
    globeGroup.rotation.x = 0.18
    globeGroup.rotation.y = 1.45
    scene.add(globeGroup)
    globeGroupRef.current = globeGroup

    // 7. Base Earth Sphere with Real NASA Blue Marble + Night City Lights
    const earthRadius = 2.0
    const earthGeometry = new THREE.SphereGeometry(earthRadius, 64, 64)

    const textureLoader = new THREE.TextureLoader()
    const dayTexture = textureLoader.load(
      '/textures/earth_day.jpg',
      () => {},
      undefined,
      (err) => console.warn('Day texture load error, using fallback:', err)
    )
    dayTexture.colorSpace = THREE.SRGBColorSpace

    const earthMaterial = new THREE.MeshStandardMaterial({
      map: dayTexture,
      roughness: 0.68,
      metalness: 0.12,
    })

    const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial)
    globeGroup.add(earthMesh)

    // 8. Realistic Cloud Layer (floating just above the surface)
    const cloudsTexture = textureLoader.load(
      '/textures/earth_clouds.png',
      () => {},
      undefined,
      () => {}
    )
    const cloudsGeometry = new THREE.SphereGeometry(earthRadius * 1.008, 64, 64)
    const cloudsMaterial = new THREE.MeshStandardMaterial({
      alphaMap: cloudsTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const cloudsMesh = new THREE.Mesh(cloudsGeometry, cloudsMaterial)
    globeGroup.add(cloudsMesh)
    cloudsMeshRef.current = cloudsMesh

    // 9. Outer Atmospheric Fresnel Halo Shell
    const atmosphereGeometry = new THREE.SphereGeometry(earthRadius * 1.032, 48, 48)
    const atmosphereMaterial = createAtmosphereShaderMaterial()
    const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial)
    globeGroup.add(atmosphereMesh)

    // 10. Corridors & Hubs Groups
    const routesGroup = new THREE.Group()
    globeGroup.add(routesGroup)
    routesGroupRef.current = routesGroup

    const hubsGroup = new THREE.Group()
    globeGroup.add(hubsGroup)
    hubsGroupRef.current = hubsGroup

    // 11. Responsive Resize Observer: Dynamically reframes camera & updates renderer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect
        if (w > 0 && h > 0 && cameraRef.current && rendererRef.current) {
          const newAspect = w / h
          cameraRef.current.aspect = newAspect

          // Recompute camera framing distance to keep Earth centered without edge clipping
          const newDist = calculateCameraDistance(newAspect, 42, 2.75, 1.16)
          defaultDistRef.current = newDist

          // Preserve current zoom ratio if user zoomed in/out
          const currentLen = cameraRef.current.position.length()
          const dir = cameraRef.current.position.clone().normalize()
          const ratio = currentLen / (defaultDistRef.current || newDist)
          const targetDist = newDist * Math.min(Math.max(ratio, 0.7), 1.6)

          cameraRef.current.position.copy(dir.multiplyScalar(targetDist))
          cameraRef.current.lookAt(0, 0, 0)
          cameraRef.current.updateProjectionMatrix()

          rendererRef.current.setSize(w, h, false)
        }
      }
    })
    resizeObserver.observe(container)

    // 12. Animation Loop
    let clock = new THREE.Clock()
    const animate = () => {
      const delta = Math.min(clock.getDelta(), 0.1) // clamp delta to prevent large jumps
      const elapsedTime = clock.getElapsedTime()

      // Continuous Earth & Cloud Rotation
      if (globeGroupRef.current) {
        if (!isDraggingRef.current) {
          if (autoRotate) {
            globeGroupRef.current.rotation.y += 0.0022
          } else {
            // Apply subtle inertia damping
            globeGroupRef.current.rotation.y += rotationVelocityRef.current.y
            globeGroupRef.current.rotation.x += rotationVelocityRef.current.x
            rotationVelocityRef.current.x *= 0.92
            rotationVelocityRef.current.y *= 0.92
          }
        }
      }

      // Cloud layer revolves slightly faster for living atmospheric motion
      if (cloudsMeshRef.current) {
        cloudsMeshRef.current.rotation.y += 0.0004
      }

      // Animate shipment particles along curves strictly from origin -> destination
      particlesRef.current.forEach((p) => {
        if (p.curve && p.mesh) {
          p.t = (p.t + p.speed * delta) % 1.0
          const pos = p.curve.getPointAt(p.t)
          p.mesh.position.copy(pos)
        }
      })

      // Pulsate Hub Rings
      if (hubsGroupRef.current) {
        hubsGroupRef.current.children.forEach((child) => {
          if (child.userData.isRing) {
            const scale = 1.0 + Math.sin(elapsedTime * 3.5 + child.userData.offset) * 0.35
            child.scale.set(scale, scale, scale)
            if (child.material) {
              child.material.opacity = Math.max(0.2, 0.85 - (scale - 1.0) * 1.6)
            }
          }
        })
      }

      renderer.render(scene, camera)
      animFrameRef.current = requestAnimationFrame(animate)
    }
    animate()

    // 13. Cleanup on unmount
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      resizeObserver.disconnect()
      if (userInteractedTimeoutRef.current) clearTimeout(userInteractedTimeoutRef.current)

      // Dispose Three.js objects
      earthGeometry.dispose()
      if (earthMaterial.dispose) earthMaterial.dispose()
      dayTexture.dispose()
      cloudsGeometry.dispose()
      cloudsMaterial.dispose()
      cloudsTexture.dispose()
      atmosphereGeometry.dispose()
      atmosphereMaterial.dispose()
      starfield.geometry.dispose()
      starfield.material.dispose()

      if (routesGroupRef.current) routesGroupRef.current.clear()
      if (hubsGroupRef.current) hubsGroupRef.current.clear()
      if (rendererRef.current) rendererRef.current.dispose()
    }
  }, [checkWebGL, autoRotate])

  // Build Hubs and Shipping Corridors when shipments or filters change
  useEffect(() => {
    const routesGroup = routesGroupRef.current
    const hubsGroup = hubsGroupRef.current
    if (!routesGroup || !hubsGroup) return

    // Clear old children
    while (routesGroup.children.length > 0) {
      const obj = routesGroup.children[0]
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) obj.material.dispose()
      routesGroup.remove(obj)
    }

    while (hubsGroup.children.length > 0) {
      const obj = hubsGroup.children[0]
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) obj.material.dispose()
      hubsGroup.remove(obj)
    }

    particlesRef.current = []

    const earthRadius = 2.0
    const hubLocationMap = new Map()

    // 1. Filter shipments based on activeFilter
    const filteredShipments = shipments.filter((s) => {
      if (activeFilter === 'CRITICAL') {
        return s.risk === 'Critical' || s.risk === 'High' || (s.riskScore && s.riskScore >= 50)
      }
      return true
    })

    // 2. Iterate filtered shipments to create 3D corridors & hub markers
    filteredShipments.forEach((shipment, idx) => {
      const originCoord = resolveCoord(shipment.origin)
      const destCoord = resolveCoord(shipment.destination)

      if (!originCoord || !destCoord) return

      // Track hubs for marker generation
      const oKey = `${originCoord.lat.toFixed(2)},${originCoord.lon.toFixed(2)}`
      if (!hubLocationMap.has(oKey)) {
        hubLocationMap.set(oKey, {
          ...originCoord,
          hasCritical: shipment.risk === 'Critical' || shipment.risk === 'High',
        })
      }
      const dKey = `${destCoord.lat.toFixed(2)},${destCoord.lon.toFixed(2)}`
      if (!hubLocationMap.has(dKey)) {
        hubLocationMap.set(dKey, {
          ...destCoord,
          hasCritical: shipment.risk === 'Critical' || shipment.risk === 'High',
        })
      }

      // 3D Spherical positions anchored accurately to globe surface
      const pStart = latLonToVector3(originCoord.lat, originCoord.lon, earthRadius)
      const pEnd = latLonToVector3(destCoord.lat, destCoord.lon, earthRadius)

      // Create elevated Catmull-Rom arc
      const curve = createArcSpline(pStart, pEnd, earthRadius, 60)
      const points = curve.getPoints(60)
      const curveGeometry = new THREE.BufferGeometry().setFromPoints(points)

      // Verified ML risk color-coding
      const isSelected = selectedShipmentId === shipment.id
      let colorHex = 0x25d9f8 // Electric Cyan (Normal)
      if (shipment.risk === 'Critical' || (shipment.riskScore && shipment.riskScore >= 75)) {
        colorHex = 0xf43f5e // Critical Red
      } else if (shipment.risk === 'High' || (shipment.riskScore && shipment.riskScore >= 50)) {
        colorHex = 0xf59e0b // Amber Warning
      }

      if (isSelected) {
        colorHex = 0xffffff // White highlight for selected
      }

      const lineMaterial = new THREE.LineBasicMaterial({
        color: colorHex,
        linewidth: isSelected ? 3 : 1.5,
        transparent: true,
        opacity: isSelected ? 0.95 : 0.65,
      })

      const lineMesh = new THREE.Line(curveGeometry, lineMaterial)
      lineMesh.userData = { shipmentId: shipment.id, shipment }
      routesGroup.add(lineMesh)

      // Dynamic Animated Shipment Particle moving Origin -> Destination
      const particleGeometry = new THREE.SphereGeometry(isSelected ? 0.038 : 0.024, 12, 12)
      const particleMaterial = new THREE.MeshBasicMaterial({
        color: isSelected ? 0xffffff : colorHex,
      })
      const particleMesh = new THREE.Mesh(particleGeometry, particleMaterial)
      routesGroup.add(particleMesh)

      particlesRef.current.push({
        mesh: particleMesh,
        curve,
        t: (idx * 0.15) % 1.0,
        speed: 0.14 + (idx % 4) * 0.035,
      })
    })

    // 3. Render Hub Markers & Pulsing Rings
    hubLocationMap.forEach((hub) => {
      const pos = latLonToVector3(hub.lat, hub.lon, earthRadius * 1.008)

      // Base Pin Sphere
      const hubGeom = new THREE.SphereGeometry(0.028, 16, 16)
      const hubMat = new THREE.MeshBasicMaterial({
        color: hub.hasCritical ? 0xf43f5e : 0x25d9f8,
      })
      const hubMesh = new THREE.Mesh(hubGeom, hubMat)
      hubMesh.position.copy(pos)
      hubMesh.userData = { hubName: hub.name, country: hub.country, isHub: true }
      hubsGroup.add(hubMesh)

      // Pulsing Ring Wave
      if (showRings) {
        const ringGeom = new THREE.RingGeometry(0.035, 0.052, 24)
        const ringMat = new THREE.MeshBasicMaterial({
          color: hub.hasCritical ? 0xf43f5e : 0x25d9f8,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.7,
        })
        const ringMesh = new THREE.Mesh(ringGeom, ringMat)
        ringMesh.position.copy(pos)
        ringMesh.lookAt(new THREE.Vector3(0, 0, 0)) // Orient tangent to globe surface
        ringMesh.userData = { isRing: true, offset: Math.random() * 5 }
        hubsGroup.add(ringMesh)
      }
    })
  }, [shipments, selectedShipmentId, activeFilter, showRings, resolveCoord])

  // Mouse & Touch Interaction Handlers
  const handlePointerDown = (e) => {
    isDraggingRef.current = true
    previousMousePositionRef.current = { x: e.clientX, y: e.clientY }
    if (userInteractedTimeoutRef.current) {
      clearTimeout(userInteractedTimeoutRef.current)
    }
  }

  const handlePointerMove = (e) => {
    const container = containerRef.current
    if (!container) return

    // 1. Drag Rotation
    if (isDraggingRef.current && globeGroupRef.current) {
      const deltaX = e.clientX - previousMousePositionRef.current.x
      const deltaY = e.clientY - previousMousePositionRef.current.y

      globeGroupRef.current.rotation.y += deltaX * 0.005
      globeGroupRef.current.rotation.x += deltaY * 0.005

      // Clamp vertical pitch to avoid gimbal flipping
      globeGroupRef.current.rotation.x = Math.max(
        -Math.PI / 2.3,
        Math.min(Math.PI / 2.3, globeGroupRef.current.rotation.x)
      )

      rotationVelocityRef.current = { x: deltaY * 0.0008, y: deltaX * 0.0008 }
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY }
    }

    // 2. Raycasting for Tooltip Hover
    if (!isDraggingRef.current && cameraRef.current && sceneRef.current) {
      const rect = container.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1

      const raycaster = new THREE.Raycaster()
      raycaster.params.Line = { threshold: 0.08 }
      raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current)

      const routeIntersects = raycaster.intersectObjects(
        routesGroupRef.current ? routesGroupRef.current.children : []
      )
      const hubIntersects = raycaster.intersectObjects(
        hubsGroupRef.current ? hubsGroupRef.current.children : []
      )

      if (hubIntersects.length > 0 && hubIntersects[0].object.userData.isHub) {
        const u = hubIntersects[0].object.userData
        setHoveredInfo({
          type: 'HUB',
          name: u.hubName,
          country: u.country,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        })
      } else if (routeIntersects.length > 0 && routeIntersects[0].object.userData.shipment) {
        const s = routeIntersects[0].object.userData.shipment
        setHoveredInfo({
          type: 'SHIPMENT',
          id: s.id,
          origin: s.origin,
          destination: s.destination,
          risk: s.risk,
          riskScore: s.riskScore,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        })
      } else {
        setHoveredInfo(null)
      }
    }
  }

  const handlePointerUp = () => {
    isDraggingRef.current = false
  }

  // Click on hub or corridor
  const handleClick = (e) => {
    const container = containerRef.current
    if (!container || !cameraRef.current) return

    const rect = container.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1

    const raycaster = new THREE.Raycaster()
    raycaster.params.Line = { threshold: 0.1 }
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current)

    const routeIntersects = raycaster.intersectObjects(
      routesGroupRef.current ? routesGroupRef.current.children : []
    )

    if (routeIntersects.length > 0 && routeIntersects[0].object.userData.shipmentId) {
      const sId = routeIntersects[0].object.userData.shipmentId
      if (onSelectShipment) {
        onSelectShipment(sId)
      }
    }
  }

  // Smooth Wheel Zoom along camera direction vector
  const handleWheel = (e) => {
    if (!cameraRef.current) return
    e.preventDefault()

    const currentLen = cameraRef.current.position.length()
    const zoomDelta = e.deltaY * 0.0035
    const newLen = Math.max(3.6, Math.min(9.5, currentLen + zoomDelta))

    const dir = cameraRef.current.position.clone().normalize()
    cameraRef.current.position.copy(dir.multiplyScalar(newLen))
    cameraRef.current.lookAt(0, 0, 0)
  }

  // Reset Camera View to optimal centering
  const resetCamera = () => {
    if (cameraRef.current && globeGroupRef.current) {
      const optimalDist = defaultDistRef.current || 5.5
      const elevationAngle = 0.20
      cameraRef.current.position.set(
        0,
        optimalDist * Math.sin(elevationAngle),
        optimalDist * Math.cos(elevationAngle)
      )
      cameraRef.current.lookAt(0, 0, 0)
      cameraRef.current.updateProjectionMatrix()

      globeGroupRef.current.rotation.set(0.18, 1.45, 0)
      rotationVelocityRef.current = { x: 0, y: 0.0015 }
    }
  }

  // Fallback rendering if WebGL fails
  if (!webGlSupported || initError) {
    return (
      <SceneFallback
        message={initError || 'WebGL is not supported on this device/browser.'}
        isError={true}
        onRetry={() => {
          setInitError(null)
          setWebGlSupported(true)
        }}
      />
    )
  }

  return (
    <div className={`supply-chain-globe-wrapper ${compact ? 'compact' : ''}`} style={{ height }}>
      {/* 3D Header Toolbar */}
      <div className="globe-toolbar">
        <div>
          <span className="globe-eyebrow">
            <span className="live-indicator-dot" /> 3D SATELLITE DIGITAL TWIN
          </span>
          <h3 className="globe-title">{title}</h3>
          {!compact && <p className="globe-subtitle">{subtitle}</p>}
        </div>

        <div className="globe-controls-row">
          {/* Quick Risk Filters */}
          <div className="filter-pill-group">
            <button
              type="button"
              className={`pill-btn ${activeFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setActiveFilter('ALL')}
            >
              All ({shipments.length})
            </button>
            <button
              type="button"
              className={`pill-btn critical ${activeFilter === 'CRITICAL' ? 'active' : ''}`}
              onClick={() => setActiveFilter('CRITICAL')}
            >
              <ShieldAlert size={12} /> High-Risk
            </button>
          </div>

          {/* View Toggles */}
          <div className="action-buttons-group">
            <button
              type="button"
              className={`icon-action-btn ${autoRotate ? 'active' : ''}`}
              onClick={() => setAutoRotate(!autoRotate)}
              title={autoRotate ? 'Pause Rotation' : 'Auto Rotate'}
            >
              {autoRotate ? <Pause size={13} /> : <Play size={13} />}
            </button>
            <button
              type="button"
              className="icon-action-btn"
              onClick={resetCamera}
              title="Reset View"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div
        ref={containerRef}
        className="globe-canvas-container"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={handleClick}
        onWheel={handleWheel}
      >
        <canvas ref={canvasRef} className="globe-canvas" />

        {/* Hover Tooltip Card */}
        {hoveredInfo && (
          <div
            className="globe-tooltip-card"
            style={{
              left: `${Math.min(window.innerWidth - 240, hoveredInfo.x + 16)}px`,
              top: `${Math.min(380, hoveredInfo.y + 16)}px`,
            }}
          >
            {hoveredInfo.type === 'HUB' ? (
              <>
                <div className="tooltip-tag">
                  <MapPin size={11} /> LOGISTICS HUB
                </div>
                <strong>{hoveredInfo.name}</strong>
                <span>Country: {hoveredInfo.country || 'Global'}</span>
              </>
            ) : (
              <>
                <div className="tooltip-tag">
                  <RouteIcon size={11} /> SHIPMENT CORRIDOR
                </div>
                <strong>{hoveredInfo.id}</strong>
                <span>{hoveredInfo.origin} → {hoveredInfo.destination}</span>
                <div className="tooltip-risk-row">
                  <span className={`risk-pill ${String(hoveredInfo.risk).toLowerCase()}`}>
                    {hoveredInfo.risk} Risk ({hoveredInfo.riskScore}/100)
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Bottom Status Overlay */}
        <div className="globe-overlay-status">
          <div className="stat-pill">
            <span className="dot cyan" />
            <span>Active Corridors: <strong>{shipments.length}</strong></span>
          </div>
          <div className="stat-pill">
            <span className="dot purple" />
            <span>Navigation: <strong>Drag to rotate · Scroll to zoom · Click corridor to inspect</strong></span>
          </div>
        </div>
      </div>
    </div>
  )
}
