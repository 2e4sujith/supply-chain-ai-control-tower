import { useEffect, useRef, useState, useMemo } from 'react'
import { Sparkles, Play, Pause, RotateCcw, ZoomIn, ZoomOut, Info } from 'lucide-react'
import './Network3DVisual.css'

// 33 representative logistics hubs in 3D cluster topology with risk scores & hub types
const NETWORK_NODES_3D = [
  // Cluster 1: East & Southeast Asia
  { name: 'Shanghai', country: 'CN', x: -125, y: -30, z: -80, group: 'asia', radius: 7, riskScore: 88, riskLevel: 'Critical', type: 'Mega Maritime Port', region: 'Asia-Pacific Direct' },
  { name: 'Shenzhen', country: 'CN', x: -145, y: -10, z: -65, group: 'asia', radius: 6, riskScore: 52, riskLevel: 'Medium', type: 'Maritime Gateway', region: 'Asia-Pacific Direct' },
  { name: 'Ningbo', country: 'CN', x: -115, y: -15, z: -70, group: 'asia', radius: 5.5, riskScore: 44, riskLevel: 'Medium', type: 'Container Terminal', region: 'Asia-Pacific Direct' },
  { name: 'Hong Kong', country: 'HK', x: -155, y: 0, z: -55, group: 'asia', radius: 6, riskScore: 36, riskLevel: 'Low', type: 'Air & Sea Transshipment', region: 'Asia-Pacific Direct' },
  { name: 'Busan', country: 'KR', x: -95, y: -55, z: -95, group: 'asia', radius: 5.5, riskScore: 54, riskLevel: 'Medium', type: 'Maritime Hub', region: 'Asia-Pacific Direct' },
  { name: 'Tokyo', country: 'JP', x: -70, y: -45, z: -110, group: 'asia', radius: 6, riskScore: 28, riskLevel: 'Low', type: 'High-Tech Cargo Gateway', region: 'Asia-Pacific Direct' },
  { name: 'Singapore', country: 'SG', x: -170, y: 55, z: -30, group: 'asia', radius: 7, riskScore: 69, riskLevel: 'High', type: 'Global Maritime Straits Hub', region: 'Asia-Pacific Direct' },
  { name: 'Ho Chi Minh', country: 'VN', x: -160, y: 30, z: -45, group: 'asia', radius: 5, riskScore: 42, riskLevel: 'Medium', type: 'Manufacturing Port', region: 'Asia-Pacific Direct' },

  // Cluster 2: South Asia / India Regional Corridor (NH 16)
  { name: 'Vijayawada', country: 'IN', x: -65, y: 40, z: 35, group: 'india', radius: 7.5, riskScore: 14, riskLevel: 'Low', type: 'Inland Rail & Road Junction (NH 16)', region: 'India Regional Gateway' },
  { name: 'Guntur', country: 'IN', x: -75, y: 48, z: 30, group: 'india', radius: 5.5, riskScore: 18, riskLevel: 'Low', type: 'Freight Terminal', region: 'India Regional Gateway' },
  { name: 'Nellore', country: 'IN', x: -55, y: 65, z: 40, group: 'india', radius: 5.5, riskScore: 16, riskLevel: 'Low', type: 'NH 16 Expressway Hub', region: 'India Regional Gateway' },
  { name: 'H Junction', country: 'IN', x: -60, y: 35, z: 38, group: 'india', radius: 5, riskScore: 12, riskLevel: 'Low', type: 'Highway Freight Junction', region: 'India Regional Gateway' },
  { name: 'Chennai', country: 'IN', x: -48, y: 72, z: 48, group: 'india', radius: 6.5, riskScore: 35, riskLevel: 'Low', type: 'Deepwater Port & Auto Hub', region: 'India Regional Gateway' },
  { name: 'Hyderabad', country: 'IN', x: -90, y: 25, z: 25, group: 'india', radius: 6.5, riskScore: 22, riskLevel: 'Low', type: 'Air Cargo & Tech Corridor', region: 'India Regional Gateway' },
  { name: 'Mumbai', country: 'IN', x: -110, y: 32, z: 55, group: 'india', radius: 7, riskScore: 18, riskLevel: 'Low', type: 'Primary West Coast Gateway', region: 'India Regional Gateway' },
  { name: 'Visakhapatnam', country: 'IN', x: -40, y: 32, z: 36, group: 'india', radius: 5.5, riskScore: 25, riskLevel: 'Low', type: 'Bay of Bengal Deep Port', region: 'India Regional Gateway' },

  // Cluster 3: Europe Corridor
  { name: 'Rotterdam', country: 'NL', x: 65, y: -85, z: 95, group: 'europe', radius: 7, riskScore: 78, riskLevel: 'High', type: 'European Mainport Gateway', region: 'European Intermodal' },
  { name: 'Antwerp', country: 'BE', x: 55, y: -78, z: 88, group: 'europe', radius: 5.5, riskScore: 48, riskLevel: 'Medium', type: 'Chemical & Container Hub', region: 'European Intermodal' },
  { name: 'Hamburg', country: 'DE', x: 88, y: -100, z: 105, group: 'europe', radius: 6.5, riskScore: 62, riskLevel: 'High', type: 'Elbe River Port & Rail Hub', region: 'European Intermodal' },
  { name: 'Frankfurt', country: 'DE', x: 72, y: -70, z: 80, group: 'europe', radius: 6.5, riskScore: 47, riskLevel: 'Medium', type: 'Air Cargo Mega-Hub', region: 'European Intermodal' },
  { name: 'Genoa', country: 'IT', x: 80, y: -48, z: 72, group: 'europe', radius: 5, riskScore: 38, riskLevel: 'Low', type: 'Mediterranean Port', region: 'European Intermodal' },
  { name: 'Valencia', country: 'ES', x: 48, y: -40, z: 65, group: 'europe', radius: 5.5, riskScore: 32, riskLevel: 'Low', type: 'Iberian Maritime Terminal', region: 'European Intermodal' },
  { name: 'London', country: 'GB', x: 40, y: -95, z: 105, group: 'europe', radius: 6.5, riskScore: 41, riskLevel: 'Medium', type: 'Distribution Center', region: 'European Intermodal' },

  // Cluster 4: North America Trunk
  { name: 'Los Angeles', country: 'US', x: 120, y: 15, z: -95, group: 'na', radius: 7, riskScore: 65, riskLevel: 'High', type: 'Pacific Gateway Complex', region: 'North America Trunk' },
  { name: 'Long Beach', country: 'US', x: 125, y: 22, z: -92, group: 'na', radius: 7, riskScore: 91, riskLevel: 'Critical', type: 'San Pedro Bay Port', region: 'North America Trunk' },
  { name: 'Oakland', country: 'US', x: 112, y: -8, z: -102, group: 'na', radius: 5.5, riskScore: 54, riskLevel: 'Medium', type: 'Northern California Port', region: 'North America Trunk' },
  { name: 'Seattle', country: 'US', x: 105, y: -40, z: -110, group: 'na', radius: 6, riskScore: 42, riskLevel: 'Medium', type: 'Pacific Northwest Gateway', region: 'North America Trunk' },
  { name: 'Chicago', country: 'US', x: 160, y: -24, z: -32, group: 'na', radius: 6.5, riskScore: 72, riskLevel: 'High', type: 'Continental Rail Crossroads', region: 'North America Trunk' },
  { name: 'New York', country: 'US', x: 182, y: -32, z: 16, group: 'na', radius: 7, riskScore: 58, riskLevel: 'Medium', type: 'East Coast Mega-Port', region: 'North America Trunk' },
  { name: 'Savannah', country: 'US', x: 175, y: 8, z: 0, group: 'na', radius: 5.5, riskScore: 39, riskLevel: 'Low', type: 'Southeast Container Terminal', region: 'North America Trunk' },
  { name: 'Houston', country: 'US', x: 152, y: 32, z: -40, group: 'na', radius: 6.5, riskScore: 45, riskLevel: 'Medium', type: 'Gulf Petrochemical Gateway', region: 'North America Trunk' },
  { name: 'Dallas', country: 'US', x: 144, y: 20, z: -48, group: 'na', radius: 5.5, riskScore: 34, riskLevel: 'Low', type: 'Inland Logistics Center', region: 'North America Trunk' },
  { name: 'Toronto', country: 'CA', x: 172, y: -45, z: 0, group: 'na', radius: 6, riskScore: 29, riskLevel: 'Low', type: 'Great Lakes Rail Terminal', region: 'North America Trunk' },
]

// 58 Freight Corridors (pairs of node indices)
const NETWORK_EDGES_3D = [
  // Asia internal
  [0, 1], [0, 2], [1, 3], [0, 4], [4, 5], [1, 6], [6, 7], [3, 7], [0, 5],
  // Trans-Pacific
  [0, 24], [5, 26], [4, 25], [1, 23], [3, 23],
  // India corridor (NH 16 focus)
  [8, 9], [8, 10], [9, 10], [8, 11], [10, 12], [8, 12], [8, 13], [13, 14], [8, 15],
  // Asia-India ocean
  [6, 12], [6, 14], [7, 8],
  // Middle-East / Europe
  [14, 16], [12, 16], [16, 17], [16, 18], [16, 19], [17, 19], [19, 18], [16, 22], [19, 20], [20, 21],
  // Trans-Atlantic
  [16, 28], [22, 28], [19, 32], [18, 28], [21, 29],
  // North America inland
  [23, 24], [23, 25], [25, 26], [23, 31], [31, 30], [30, 27], [27, 28], [28, 32], [28, 29], [27, 31], [24, 30],
]

// Precompute degree and neighbors map for every node
const NODE_NEIGHBORS = Array.from({ length: NETWORK_NODES_3D.length }, () => [])
NETWORK_EDGES_3D.forEach(([u, v]) => {
  if (u < NETWORK_NODES_3D.length && v < NETWORK_NODES_3D.length) {
    NODE_NEIGHBORS[u].push(v)
    NODE_NEIGHBORS[v].push(u)
  }
})

export default function Network3DVisual() {
  const canvasRef = useRef(null)
  const [isRotating, setIsRotating] = useState(true)
  const [zoomLevel, setZoomLevel] = useState(1.0)
  const [hoveredNode, setHoveredNode] = useState(null)
  const hoveredIndexRef = useRef(null)
  const projectedNodesRef = useRef([])
  const zoomLevelRef = useRef(1.0)

  // Keep ref in sync
  useEffect(() => {
    zoomLevelRef.current = zoomLevel
  }, [zoomLevel])

  const handleReset = () => {
    setZoomLevel(1.0)
    setIsRotating(true)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let animationId = null
    let angleY = 0.4
    let angleX = -0.22
    let targetAngleY = 0.4
    let targetAngleX = -0.22
    let isDragging = false
    let lastMouseX = 0
    let lastMouseY = 0
    let pulseTime = 0

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    const onMouseDown = (e) => {
      isDragging = true
      lastMouseX = e.clientX
      lastMouseY = e.clientY
    }

    const onMouseMove = (e) => {
      if (isDragging) {
        const dx = e.clientX - lastMouseX
        const dy = e.clientY - lastMouseY
        lastMouseX = e.clientX
        lastMouseY = e.clientY
        targetAngleY += dx * 0.007
        targetAngleX += dy * 0.007
        targetAngleX = Math.max(-0.95, Math.min(0.95, targetAngleX))
      } else {
        const rect = canvas.getBoundingClientRect()
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top
        let found = null
        for (const node of projectedNodesRef.current) {
          const dist = Math.hypot(node.px - mx, node.py - my)
          if (dist < Math.max(12, node.radius * node.scale + 10)) {
            found = node
            break
          }
        }
        hoveredIndexRef.current = found ? found.index : null
        setHoveredNode(found ? NETWORK_NODES_3D[found.index] : null)
        canvas.style.cursor = found ? 'pointer' : 'grab'
      }
    }

    const onMouseUp = () => {
      isDragging = false
    }

    const onWheel = (e) => {
      e.preventDefault()
      const delta = e.deltaY < 0 ? 0.08 : -0.08
      setZoomLevel((prev) => Math.max(0.65, Math.min(1.85, Number((prev + delta).toFixed(2)))))
    }

    canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })

    // Main 3D Render Loop
    const render = () => {
      pulseTime += 0.025

      // Dignified, very slow presentation orbit (0.0006 rad/frame instead of 0.004)
      if (!isDragging && isRotating) {
        targetAngleY += 0.0006
      }

      // Smooth damping interpolation
      angleY += (targetAngleY - angleY) * 0.08
      angleX += (targetAngleX - angleX) * 0.08

      const rect = canvas.getBoundingClientRect()
      const width = rect.width
      const height = rect.height
      const cx = width / 2
      const cy = height / 2
      const baseFocal = 320 * zoomLevelRef.current

      ctx.clearRect(0, 0, width, height)

      // Trigonometric cache
      const cosY = Math.cos(angleY), sinY = Math.sin(angleY)
      const cosX = Math.cos(angleX), sinX = Math.sin(angleX)

      // Project 3D nodes to 2D screen coordinates
      const projectedNodes = NETWORK_NODES_3D.map((node, index) => {
        // Rotate around Y-axis
        const x1 = node.x * cosY - node.z * sinY
        const z1 = node.z * cosY + node.x * sinY

        // Rotate around X-axis
        const y1 = node.y * cosX - z1 * sinX
        const z2 = z1 * cosX + node.y * sinX

        const scale = baseFocal / (baseFocal + z2 + 220)
        const px = cx + x1 * scale
        const py = cy + y1 * scale

        return {
          ...node,
          index,
          px,
          py,
          scale,
          zDepth: z2,
        }
      })

      projectedNodesRef.current = projectedNodes
      const activeHoverIndex = hoveredIndexRef.current

      // 1. Draw 3D Corridors / Edges with depth sorting
      NETWORK_EDGES_3D.forEach(([i1, i2]) => {
        const p1 = projectedNodes[i1]
        const p2 = projectedNodes[i2]
        if (!p1 || !p2) return

        const avgDepth = (p1.zDepth + p2.zDepth) / 2
        const isHoverConnected =
          activeHoverIndex !== null && (i1 === activeHoverIndex || i2 === activeHoverIndex)

        ctx.beginPath()
        ctx.moveTo(p1.px, p1.py)
        ctx.lineTo(p2.px, p2.py)

        if (isHoverConnected) {
          // Highlighted active connection
          ctx.strokeStyle = '#38bdf8'
          ctx.lineWidth = 2.8
          ctx.shadowColor = '#38bdf8'
          ctx.shadowBlur = 10
          ctx.stroke()
          ctx.shadowBlur = 0
        } else {
          // Base edge with depth alpha
          const dimAlpha = activeHoverIndex !== null ? 0.08 : 0.28
          const alpha = Math.max(0.08, Math.min(0.65, dimAlpha - avgDepth * 0.001))
          const isIndiaLink = p1.group === 'india' && p2.group === 'india'

          ctx.strokeStyle = isIndiaLink
            ? `rgba(52, 211, 153, ${alpha * 1.5})`
            : `rgba(99, 102, 241, ${alpha})`
          ctx.lineWidth = Math.max(1, 1.8 * ((p1.scale + p2.scale) / 2))
          ctx.stroke()
        }
      })

      // 2. Draw 3D Nodes (sorted back to front for realistic occlusion)
      const sortedNodes = [...projectedNodes].sort((a, b) => b.zDepth - a.zDepth)

      sortedNodes.forEach((node) => {
        const isHovered = activeHoverIndex === node.index
        const isNeighbor = activeHoverIndex !== null && NODE_NEIGHBORS[activeHoverIndex].includes(node.index)
        const nodeRadius = Math.max(3.5, (node.radius * (isHovered ? 1.45 : isNeighbor ? 1.15 : 1.0)) * node.scale)
        const depthAlpha = Math.max(0.4, Math.min(1.0, 0.85 - node.zDepth * 0.002))

        // Pulse wave effect on key hubs or hovered hub
        if (isHovered || node.group === 'india' || node.name === 'Shanghai' || node.name === 'Rotterdam' || node.name === 'Long Beach') {
          const pulseR = nodeRadius + (Math.sin(pulseTime * 2 + node.index) + 1) * (isHovered ? 6 : 3.5)
          ctx.beginPath()
          ctx.arc(node.px, node.py, pulseR, 0, Math.PI * 2)
          ctx.strokeStyle = isHovered
            ? 'rgba(56, 189, 248, 0.8)'
            : node.group === 'india'
            ? 'rgba(52, 211, 153, 0.35)'
            : 'rgba(56, 189, 248, 0.25)'
          ctx.lineWidth = isHovered ? 2 : 1
          ctx.stroke()
        }

        // Outer glow
        const glow = ctx.createRadialGradient(node.px, node.py, 0, node.px, node.py, nodeRadius * 2.8)
        if (isHovered) {
          glow.addColorStop(0, 'rgba(56, 189, 248, 0.95)')
          glow.addColorStop(1, 'rgba(56, 189, 248, 0)')
        } else if (node.group === 'india') {
          glow.addColorStop(0, `rgba(52, 211, 153, ${depthAlpha * 0.9})`)
          glow.addColorStop(1, 'rgba(52, 211, 153, 0)')
        } else if (node.group === 'europe') {
          glow.addColorStop(0, `rgba(192, 132, 252, ${depthAlpha * 0.85})`)
          glow.addColorStop(1, 'rgba(192, 132, 252, 0)')
        } else if (node.group === 'na') {
          glow.addColorStop(0, `rgba(251, 191, 36, ${depthAlpha * 0.85})`)
          glow.addColorStop(1, 'rgba(251, 191, 36, 0)')
        } else {
          glow.addColorStop(0, `rgba(56, 189, 248, ${depthAlpha * 0.9})`)
          glow.addColorStop(1, 'rgba(56, 189, 248, 0)')
        }

        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(node.px, node.py, nodeRadius * 2.8, 0, Math.PI * 2)
        ctx.fill()

        // Inner solid core
        ctx.beginPath()
        ctx.arc(node.px, node.py, nodeRadius, 0, Math.PI * 2)
        ctx.fillStyle = isHovered
          ? '#ffffff'
          : node.group === 'india'
          ? '#34d399'
          : node.group === 'europe'
          ? '#c084fc'
          : node.group === 'na'
          ? '#fbbf24'
          : '#38bdf8'
        ctx.fill()
        ctx.strokeStyle = isHovered ? '#38bdf8' : '#ffffff'
        ctx.lineWidth = isHovered ? 2 : 1
        ctx.stroke()

        // Text label: on hovered, key hubs, or front nodes
        if (isHovered || isNeighbor || node.zDepth < 30 || node.group === 'india') {
          ctx.font = isHovered
            ? 'bold 12px "JetBrains Mono", monospace'
            : isNeighbor
            ? '600 10px "JetBrains Mono", monospace'
            : '9px "JetBrains Mono", monospace'
          ctx.fillStyle = isHovered
            ? '#ffffff'
            : isNeighbor
            ? '#38bdf8'
            : `rgba(226, 232, 240, ${depthAlpha})`
          ctx.fillText(node.name, node.px + nodeRadius + 6, node.py + 4)
        }

        // Floating HUD card on hovered node
        if (isHovered) {
          const hudW = 210
          const hudH = 74
          const hudX = Math.min(width - hudW - 14, Math.max(14, node.px + nodeRadius + 14))
          const hudY = Math.max(14, Math.min(height - hudH - 14, node.py - hudH / 2))

          ctx.fillStyle = 'rgba(11, 16, 28, 0.96)'
          ctx.strokeStyle = '#38bdf8'
          ctx.lineWidth = 1.5
          ctx.shadowColor = 'rgba(56, 189, 248, 0.4)'
          ctx.shadowBlur = 12
          ctx.beginPath()
          if (ctx.roundRect) {
            ctx.roundRect(hudX, hudY, hudW, hudH, 8)
          } else {
            ctx.rect(hudX, hudY, hudW, hudH)
          }
          ctx.fill()
          ctx.stroke()
          ctx.shadowBlur = 0

          // Header: Name & Flag
          ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif'
          ctx.fillStyle = '#ffffff'
          ctx.fillText(`${node.name} (${node.country})`, hudX + 10, hudY + 18)

          // Type
          ctx.font = '10px system-ui, sans-serif'
          ctx.fillStyle = '#94a3b8'
          ctx.fillText(node.type, hudX + 10, hudY + 34)

          // Risk badge
          const riskColor = node.riskScore > 75 ? '#f43f5e' : node.riskScore > 45 ? '#fbbf24' : '#34d399'
          ctx.font = 'bold 10px "JetBrains Mono", monospace'
          ctx.fillStyle = riskColor
          ctx.fillText(`Risk: ${node.riskScore}/100 (${node.riskLevel})`, hudX + 10, hudY + 50)

          // Connected corridors
          ctx.font = '10px "JetBrains Mono", monospace'
          ctx.fillStyle = '#38bdf8'
          ctx.fillText(`${NODE_NEIGHBORS[node.index].length} Connected Corridors`, hudX + 10, hudY + 65)
        }
      })

      animationId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', resizeCanvas)
      canvas.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [isRotating])

  return (
    <div className="network-3d-card" aria-label="3D Graph Neural Network Topology Visualizer">
      <div className="network-3d-header">
        <div className="network-3d-title-group">
          <span className="network-3d-pill">
            <Sparkles size={12} /> 3D GCN TOPOLOGY
          </span>
          <div className="network-3d-headings">
            <span className="network-3d-title">Global Multimodal Freight Graph</span>
            <span className="network-3d-subtitle">N=33 Logistics Hubs · E=58 Corridors · GCN Spectral Laplacian</span>
          </div>
        </div>

        <div className="network-3d-actions">
          <button
            type="button"
            className={`network-3d-btn ${isRotating ? 'active' : ''}`}
            onClick={() => setIsRotating(!isRotating)}
            title={isRotating ? 'Pause Continuous Rotation' : 'Resume Gentle Orbit'}
          >
            {isRotating ? <Pause size={13} /> : <Play size={13} />}
            <span>{isRotating ? 'Orbit Active' : 'Orbit Paused'}</span>
          </button>

          <button
            type="button"
            className="network-3d-btn"
            onClick={handleReset}
            title="Reset Perspective and Zoom"
          >
            <RotateCcw size={13} />
            <span>Reset View</span>
          </button>

          <span className="network-3d-zoom-badge">
            {Math.round(zoomLevel * 100)}%
          </span>
        </div>
      </div>

      <div className="network-3d-canvas-wrapper">
        <canvas ref={canvasRef} className="network-3d-canvas" />

        <div className="network-3d-hint">
          Drag mouse to orbit · Scroll wheel to zoom · Hover over any hub to inspect
        </div>

        {hoveredNode && (
          <div className="network-3d-floating-inspector">
            <div className="inspector-header">
              <span className={`inspector-dot ${hoveredNode.group}`} />
              <strong>{hoveredNode.name} Logistics Terminal</strong>
            </div>
            <div className="inspector-body">
              <span>{hoveredNode.region} · {hoveredNode.type}</span>
              <div className="inspector-stats">
                <span className={`inspector-risk-tag ${hoveredNode.riskLevel.toLowerCase()}`}>
                  Risk Score: {hoveredNode.riskScore}/100 ({hoveredNode.riskLevel})
                </span>
                <span className="inspector-degree-tag">
                  {NODE_NEIGHBORS[NETWORK_NODES_3D.findIndex((n) => n.name === hoveredNode.name)].length} Linked Routes
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Explanatory description required for presentations */}
      <div className="network-3d-explanation">
        <Info size={15} className="explanation-icon" />
        <p>
          <strong>Interactive 3D representation of supply chain hubs and their network connections used for GCN-based risk analysis.</strong>{' '}
          Node colors represent regional freight clusters; lines represent active multimodal transport corridors. Hovering highlights local neighbor subgraphs used during Spectral Graph Convolution feature aggregation.
        </p>
      </div>

      <div className="network-3d-legend">
        <span className="n3d-legend-item">
          <span className="n3d-dot india" /> India Regional Highway (NH 16 Corridor)
        </span>
        <span className="n3d-legend-item">
          <span className="n3d-dot asia" /> Asia-Pacific Maritime Gateway
        </span>
        <span className="n3d-legend-item">
          <span className="n3d-dot europe" /> European Intermodal & Rail Network
        </span>
        <span className="n3d-legend-item">
          <span className="n3d-dot na" /> North America Trunk Logistics
        </span>
      </div>
    </div>
  )
}
