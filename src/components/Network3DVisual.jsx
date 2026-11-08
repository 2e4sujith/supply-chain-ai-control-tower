import { useEffect, useRef, useState } from 'react'
import { Sparkles, Activity } from 'lucide-react'
import './Network3DVisual.css'

// 33 representative logistics hubs in 3D cluster topology
const NETWORK_NODES_3D = [
  // Cluster 1: East & Southeast Asia
  { name: 'Shanghai', x: -80, y: -20, z: -50, group: 'asia', radius: 4.5 },
  { name: 'Shenzhen', x: -95, y: -5, z: -40, group: 'asia', radius: 4 },
  { name: 'Ningbo', x: -75, y: -10, z: -45, group: 'asia', radius: 3.5 },
  { name: 'Hong Kong', x: -100, y: 0, z: -35, group: 'asia', radius: 4 },
  { name: 'Busan', x: -60, y: -35, z: -60, group: 'asia', radius: 3.5 },
  { name: 'Tokyo', x: -45, y: -30, z: -70, group: 'asia', radius: 4 },
  { name: 'Singapore', x: -110, y: 35, z: -20, group: 'asia', radius: 4.5 },
  { name: 'Ho Chi Minh', x: -105, y: 20, z: -30, group: 'asia', radius: 3 },

  // Cluster 2: South Asia / India Regional Corridor
  { name: 'Vijayawada', x: -40, y: 25, z: 20, group: 'india', radius: 5 },
  { name: 'Guntur', x: -46, y: 30, z: 18, group: 'india', radius: 3.5 },
  { name: 'Nellore', x: -35, y: 40, z: 25, group: 'india', radius: 3.5 },
  { name: 'H Junction', x: -38, y: 22, z: 22, group: 'india', radius: 3 },
  { name: 'Chennai', x: -30, y: 45, z: 30, group: 'india', radius: 4 },
  { name: 'Hyderabad', x: -55, y: 15, z: 15, group: 'india', radius: 4 },
  { name: 'Mumbai', x: -70, y: 20, z: 35, group: 'india', radius: 4.5 },
  { name: 'Visakhapatnam', x: -25, y: 20, z: 22, group: 'india', radius: 3.5 },

  // Cluster 3: Europe Corridor
  { name: 'Rotterdam', x: 40, y: -55, z: 60, group: 'europe', radius: 4.5 },
  { name: 'Antwerp', x: 35, y: -50, z: 55, group: 'europe', radius: 3.5 },
  { name: 'Hamburg', x: 55, y: -65, z: 65, group: 'europe', radius: 4 },
  { name: 'Frankfurt', x: 45, y: -45, z: 50, group: 'europe', radius: 4 },
  { name: 'Genoa', x: 50, y: -30, z: 45, group: 'europe', radius: 3 },
  { name: 'Valencia', x: 30, y: -25, z: 40, group: 'europe', radius: 3.5 },
  { name: 'London', x: 25, y: -60, z: 65, group: 'europe', radius: 4 },

  // Cluster 4: North America
  { name: 'Los Angeles', x: 75, y: 10, z: -60, group: 'na', radius: 4.5 },
  { name: 'Long Beach', x: 78, y: 14, z: -58, group: 'na', radius: 4.5 },
  { name: 'Oakland', x: 70, y: -5, z: -65, group: 'na', radius: 3.5 },
  { name: 'Seattle', x: 65, y: -25, z: -70, group: 'na', radius: 4 },
  { name: 'Chicago', x: 100, y: -15, z: -20, group: 'na', radius: 4 },
  { name: 'New York', x: 115, y: -20, z: 10, group: 'na', radius: 4.5 },
  { name: 'Savannah', x: 110, y: 5, z: 0, group: 'na', radius: 3.5 },
  { name: 'Houston', x: 95, y: 20, z: -25, group: 'na', radius: 4 },
  { name: 'Dallas', x: 90, y: 12, z: -30, group: 'na', radius: 3.5 },
  { name: 'Toronto', x: 108, y: -28, z: 0, group: 'na', radius: 4 },
]

// 58 Freight Corridors (pairs of node indices)
const NETWORK_EDGES_3D = [
  // Asia internal
  [0, 1], [0, 2], [1, 3], [0, 4], [4, 5], [1, 6], [6, 7], [3, 7], [0, 5],
  // Trans-Pacific
  [0, 24], [5, 26], [4, 25], [1, 23], [3, 23],
  // India corridor
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

export default function Network3DVisual() {
  const canvasRef = useRef(null)
  const [hoveredNode, setHoveredNode] = useState(null)
  const [isRotating, setIsRotating] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let animationId = null
    let angleY = 0.4
    let angleX = -0.25
    let targetAngleY = 0.4
    let targetAngleX = -0.25
    let isDragging = false
    let lastMouseX = 0
    let lastMouseY = 0
    let pulseTime = 0

    // Handle high-DPI displays
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
        targetAngleY += dx * 0.008
        targetAngleX += dy * 0.008
        targetAngleX = Math.max(-0.9, Math.min(0.9, targetAngleX))
      }
    }

    const onMouseUp = () => {
      isDragging = false
    }

    canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    // Main 3D Render Loop
    const render = () => {
      pulseTime += 0.03

      if (!isDragging && isRotating) {
        targetAngleY += 0.004
      }

      // Smooth damping interpolation
      angleY += (targetAngleY - angleY) * 0.1
      angleX += (targetAngleX - angleX) * 0.1

      const rect = canvas.getBoundingClientRect()
      const width = rect.width
      const height = rect.height
      const cx = width / 2
      const cy = height / 2
      const focalLength = 260

      ctx.clearRect(0, 0, width, height)

      // Trigonometric cache
      const cosY = Math.cos(angleY), sinY = Math.sin(angleY)
      const cosX = Math.cos(angleX), sinX = Math.sin(angleX)

      // Project 3D nodes to 2D
      const projectedNodes = NETWORK_NODES_3D.map((node, index) => {
        // Rotate around Y
        const x1 = node.x * cosY - node.z * sinY
        const z1 = node.z * cosY + node.x * sinY

        // Rotate around X
        const y1 = node.y * cosX - z1 * sinX
        const z2 = z1 * cosX + node.y * sinX

        const scale = focalLength / (focalLength + z2 + 160)
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

      // Sort edges and nodes by depth for correct 3D perspective occluding
      // 1. Draw 3D Corridor Edges with gradient depth
      NETWORK_EDGES_3D.forEach(([i1, i2]) => {
        const p1 = projectedNodes[i1]
        const p2 = projectedNodes[i2]
        if (!p1 || !p2) return

        const avgDepth = (p1.zDepth + p2.zDepth) / 2
        // Closer nodes = brighter, farther nodes = subtle
        const alpha = Math.max(0.12, Math.min(0.65, 0.4 - avgDepth * 0.002))

        ctx.beginPath()
        ctx.moveTo(p1.px, p1.py)
        ctx.lineTo(p2.px, p2.py)

        // Color based on region connectivity
        const isIndiaCorridor = p1.group === 'india' || p2.group === 'india'
        ctx.strokeStyle = isIndiaCorridor
          ? `rgba(56, 189, 248, ${alpha * 1.3})`
          : `rgba(99, 102, 241, ${alpha})`
        ctx.lineWidth = Math.max(1, 1.8 * ((p1.scale + p2.scale) / 2))
        ctx.stroke()
      })

      // 2. Draw 3D Nodes (sorted back to front)
      const sortedNodes = [...projectedNodes].sort((a, b) => b.zDepth - a.zDepth)

      sortedNodes.forEach((node) => {
        const nodeRadius = Math.max(2.5, node.radius * node.scale)
        const depthAlpha = Math.max(0.35, Math.min(1.0, 0.8 - node.zDepth * 0.003))

        // Pulse wave effect for key hubs
        if (node.group === 'india' || node.name === 'Shanghai' || node.name === 'Rotterdam' || node.name === 'Los Angeles') {
          const pulseR = nodeRadius + (Math.sin(pulseTime + node.index) + 1) * 3
          ctx.beginPath()
          ctx.arc(node.px, node.py, pulseR, 0, Math.PI * 2)
          ctx.strokeStyle = node.group === 'india' ? `rgba(16, 185, 129, 0.25)` : `rgba(56, 189, 248, 0.2)`
          ctx.lineWidth = 1
          ctx.stroke()
        }

        // Outer glow
        const glow = ctx.createRadialGradient(node.px, node.py, 0, node.px, node.py, nodeRadius * 2.2)
        if (node.group === 'india') {
          glow.addColorStop(0, `rgba(16, 185, 129, ${depthAlpha * 0.9})`)
          glow.addColorStop(1, 'rgba(16, 185, 129, 0)')
        } else if (node.group === 'europe') {
          glow.addColorStop(0, `rgba(168, 85, 247, ${depthAlpha * 0.8})`)
          glow.addColorStop(1, 'rgba(168, 85, 247, 0)')
        } else if (node.group === 'na') {
          glow.addColorStop(0, `rgba(245, 158, 11, ${depthAlpha * 0.8})`)
          glow.addColorStop(1, 'rgba(245, 158, 11, 0)')
        } else {
          glow.addColorStop(0, `rgba(56, 189, 248, ${depthAlpha * 0.9})`)
          glow.addColorStop(1, 'rgba(56, 189, 248, 0)')
        }

        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(node.px, node.py, nodeRadius * 2.2, 0, Math.PI * 2)
        ctx.fill()

        // Inner solid core
        ctx.beginPath()
        ctx.arc(node.px, node.py, nodeRadius, 0, Math.PI * 2)
        ctx.fillStyle = node.group === 'india' ? '#34d399' : node.group === 'europe' ? '#c084fc' : node.group === 'na' ? '#fbbf24' : '#38bdf8'
        ctx.fill()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1
        ctx.stroke()

        // Label on larger/front nodes
        if (node.zDepth < 20) {
          ctx.font = '9px "JetBrains Mono", monospace'
          ctx.fillStyle = `rgba(226, 232, 240, ${depthAlpha})`
          ctx.fillText(node.name, node.px + nodeRadius + 4, node.py + 3)
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
    }
  }, [isRotating])

  return (
    <div className="network-3d-card" aria-label="3D Graph Neural Network Topology Visualizer">
      <div className="network-3d-header">
        <div className="network-3d-title-group">
          <span className="network-3d-pill">
            <Sparkles size={11} /> 3D GCN TOPOLOGY
          </span>
          <span className="network-3d-subtitle">N=33 Logistics Hubs · E=58 Corridors</span>
        </div>
        <button
          type="button"
          className={`network-3d-toggle ${isRotating ? 'active' : ''}`}
          onClick={() => setIsRotating(!isRotating)}
          title={isRotating ? 'Pause Rotation' : 'Resume Rotation'}
        >
          <Activity size={12} /> {isRotating ? 'Auto-Orbit' : 'Paused'}
        </button>
      </div>

      <div className="network-3d-canvas-wrapper">
        <canvas ref={canvasRef} className="network-3d-canvas" />
        <div className="network-3d-hint">Drag mouse to orbit 3D graph in real-time</div>
      </div>

      <div className="network-3d-legend">
        <span className="n3d-legend-item">
          <span className="n3d-dot india" /> India Regional (Vijayawada-Nellore)
        </span>
        <span className="n3d-legend-item">
          <span className="n3d-dot asia" /> Asia Trans-Pacific
        </span>
        <span className="n3d-legend-item">
          <span className="n3d-dot europe" /> European Intermodal
        </span>
        <span className="n3d-legend-item">
          <span className="n3d-dot na" /> North America Trunk
        </span>
      </div>
    </div>
  )
}
