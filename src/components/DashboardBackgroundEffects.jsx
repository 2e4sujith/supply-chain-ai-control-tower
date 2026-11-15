import { useEffect, useRef } from 'react'
import './DashboardBackgroundEffects.css'

export default function DashboardBackgroundEffects() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let animationId = null
    let isVisible = true

    // Respect user's reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      return
    }

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect() || canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = (rect.width || window.innerWidth) * dpr
      canvas.height = (rect.height || window.innerHeight) * dpr
      ctx.scale(dpr, dpr)
    }

    resize()
    window.addEventListener('resize', resize)

    const handleVisibilityChange = () => {
      isVisible = !document.hidden
      if (isVisible && !animationId) {
        render()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const width = canvas.parentElement?.clientWidth || window.innerWidth
    const height = canvas.parentElement?.clientHeight || window.innerHeight

    // 1. Generate abstract trade corridor nodes
    const nodeCount = 12
    const nodes = []
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        baseX: (0.06 + (i * 0.88) / nodeCount + Math.sin(i * 1.6) * 0.06) * width,
        baseY: (0.12 + ((i * 3) % 7) * 0.12 + Math.cos(i) * 0.05) * height,
        x: 0,
        y: 0,
        radius: 2.2 + (i % 3) * 1.1,
        driftSpeed: 0.0006 + (i % 4) * 0.0003,
        driftPhase: i * 0.9,
        colorTone: i % 4 === 0 ? '#0284c7' : i % 4 === 1 ? '#7c3aed' : i % 4 === 2 ? '#10b981' : '#38bdf8',
      })
    }

    // Connect nodes into logistics trade corridors
    const corridors = [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],
      [1, 6], [6, 7], [7, 8], [8, 9],
      [2, 7], [4, 9], [9, 10], [10, 11],
      [5, 10], [6, 11]
    ]

    // Animated data flow packets
    const dataPackets = corridors.map(([fromIdx, toIdx], idx) => ({
      from: fromIdx,
      to: toIdx,
      progress: (idx * 0.22) % 1.0,
      speed: 0.0012 + (idx % 3) * 0.0006,
      color: idx % 3 === 0 ? '#38bdf8' : idx % 3 === 1 ? '#c084fc' : '#34d399',
    }))

    // 2. Floating 3D Supply Chain Objects (Isometric Cargo Containers & Packages)
    const floatingSupplyObjects = [
      // Isometric Cargo Containers
      { type: 'container', baseX: width * 0.08, baseY: height * 0.22, L: 20, S: 10, H: 14, color: '#0284c7', phase: 0.2, speed: 0.0007 },
      { type: 'container', baseX: width * 0.92, baseY: height * 0.18, L: 22, S: 11, H: 15, color: '#7c3aed', phase: 1.5, speed: 0.0006 },
      { type: 'container', baseX: width * 0.86, baseY: height * 0.58, L: 20, S: 10, H: 14, color: '#10b981', phase: 2.8, speed: 0.0008 },
      { type: 'container', baseX: width * 0.12, baseY: height * 0.72, L: 24, S: 12, H: 16, color: '#38bdf8', phase: 3.9, speed: 0.0005 },
      { type: 'container', baseX: width * 0.48, baseY: height * 0.90, L: 19, S: 9, H: 13, color: '#f59e0b', phase: 4.7, speed: 0.0007 },

      // Isometric Logistics Package Cubes
      { type: 'package', baseX: width * 0.25, baseY: height * 0.15, size: 8, height: 9, color: '#0284c7', phase: 0.8, speed: 0.0009 },
      { type: 'package', baseX: width * 0.78, baseY: height * 0.35, size: 9, height: 10, color: '#fbbf24', phase: 2.1, speed: 0.0008 },
      { type: 'package', baseX: width * 0.04, baseY: height * 0.48, size: 8, height: 9, color: '#a855f7', phase: 3.4, speed: 0.0010 },
      { type: 'package', baseX: width * 0.65, baseY: height * 0.78, size: 9, height: 10, color: '#34d399', phase: 4.5, speed: 0.0008 },
      { type: 'package', baseX: width * 0.38, baseY: height * 0.42, size: 7, height: 8, color: '#38bdf8', phase: 5.2, speed: 0.0009 },
    ]

    let time = 0

    // Render an Isometric 3D Cargo Container
    const drawContainer = (x, y, L, S, H, baseColor, alpha) => {
      // Top face (illuminated)
      ctx.beginPath()
      ctx.moveTo(x, y - H)
      ctx.lineTo(x + L, y - H - S)
      ctx.lineTo(x, y - H - 2 * S)
      ctx.lineTo(x - L, y - H - S)
      ctx.closePath()
      ctx.fillStyle = baseColor
      ctx.globalAlpha = alpha * 1.35
      ctx.fill()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'
      ctx.lineWidth = 0.8
      ctx.stroke()

      // Left face (medium tone)
      ctx.beginPath()
      ctx.moveTo(x - L, y - H - S)
      ctx.lineTo(x, y - H)
      ctx.lineTo(x, y)
      ctx.lineTo(x - L, y - S)
      ctx.closePath()
      ctx.fillStyle = baseColor
      ctx.globalAlpha = alpha * 0.95
      ctx.fill()
      ctx.stroke()

      // Corrugation lines on left face
      ctx.beginPath()
      const c1x = x - L * 0.66
      const c1y = y - H - S * 0.33
      ctx.moveTo(c1x, c1y)
      ctx.lineTo(c1x, c1y + H)
      const c2x = x - L * 0.33
      const c2y = y - H + S * 0.33
      ctx.moveTo(c2x, c2y)
      ctx.lineTo(c2x, c2y + H)
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)'
      ctx.lineWidth = 0.8
      ctx.stroke()

      // Right face (shaded)
      ctx.beginPath()
      ctx.moveTo(x, y - H)
      ctx.lineTo(x + L, y - H - S)
      ctx.lineTo(x + L, y - S)
      ctx.lineTo(x, y)
      ctx.closePath()
      ctx.fillStyle = '#0f172a'
      ctx.globalAlpha = alpha * 0.4
      ctx.fill()
      ctx.fillStyle = baseColor
      ctx.globalAlpha = alpha * 0.7
      ctx.fill()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
      ctx.stroke()

      ctx.globalAlpha = 1.0
    }

    // Render an Isometric 3D Logistics Package Cube
    const drawPackage = (x, y, S, H, baseColor, alpha) => {
      // Top face
      ctx.beginPath()
      ctx.moveTo(x, y - H)
      ctx.lineTo(x + S, y - H - S * 0.5)
      ctx.lineTo(x, y - H - S)
      ctx.lineTo(x - S, y - H - S * 0.5)
      ctx.closePath()
      ctx.fillStyle = baseColor
      ctx.globalAlpha = alpha * 1.2
      ctx.fill()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'
      ctx.lineWidth = 0.6
      ctx.stroke()

      // Left face
      ctx.beginPath()
      ctx.moveTo(x - S, y - H - S * 0.5)
      ctx.lineTo(x, y - H)
      ctx.lineTo(x, y)
      ctx.lineTo(x - S, y - S * 0.5)
      ctx.closePath()
      ctx.fillStyle = baseColor
      ctx.globalAlpha = alpha * 0.85
      ctx.fill()
      ctx.stroke()

      // Right face
      ctx.beginPath()
      ctx.moveTo(x, y - H)
      ctx.lineTo(x + S, y - H - S * 0.5)
      ctx.lineTo(x + S, y - S * 0.5)
      ctx.lineTo(x, y)
      ctx.closePath()
      ctx.fillStyle = '#0f172a'
      ctx.globalAlpha = alpha * 0.35
      ctx.fill()
      ctx.fillStyle = baseColor
      ctx.globalAlpha = alpha * 0.65
      ctx.fill()
      ctx.stroke()

      ctx.globalAlpha = 1.0
    }

    // Main 60FPS Render Loop
    const render = () => {
      if (!isVisible) {
        animationId = null
        return
      }

      time += 0.014
      const currentWidth = canvas.parentElement?.clientWidth || window.innerWidth
      const currentHeight = canvas.parentElement?.clientHeight || window.innerHeight

      ctx.clearRect(0, 0, currentWidth, currentHeight)

      const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
      const lineAlpha = isDark ? 0.12 : 0.06
      const nodeAlpha = isDark ? 0.35 : 0.22
      const objectAlpha = isDark ? 0.20 : 0.12

      // 1. Update & Draw Trade Corridor Connecting Lines
      nodes.forEach((n) => {
        n.x = n.baseX + Math.sin(time * n.driftSpeed * 100 + n.driftPhase) * 14
        n.y = n.baseY + Math.cos(time * n.driftSpeed * 100 + n.driftPhase) * 10
      })

      corridors.forEach(([u, v]) => {
        const n1 = nodes[u]
        const n2 = nodes[v]
        if (!n1 || !n2) return

        ctx.beginPath()
        ctx.moveTo(n1.x, n1.y)
        ctx.lineTo(n2.x, n2.y)
        ctx.strokeStyle = isDark ? `rgba(56, 189, 248, ${lineAlpha})` : `rgba(2, 132, 199, ${lineAlpha})`
        ctx.lineWidth = 1
        ctx.stroke()
      })

      // 2. Draw Floating 3D Supply Chain Objects (Containers & Packages)
      floatingSupplyObjects.forEach((obj) => {
        const bobX = obj.baseX + Math.sin(time * obj.speed * 100 + obj.phase) * 18
        const bobY = obj.baseY + Math.cos(time * obj.speed * 85 + obj.phase) * 14

        if (obj.type === 'container') {
          drawContainer(bobX, bobY, obj.L, obj.S, obj.H, obj.color, objectAlpha)
        } else {
          drawPackage(bobX, bobY, obj.size, obj.height, obj.color, objectAlpha)
        }
      })

      // 3. Draw Trade Corridor Hub Nodes
      nodes.forEach((n) => {
        // Soft outer halo
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.radius * 2.2, 0, Math.PI * 2)
        ctx.fillStyle = n.colorTone
        ctx.globalAlpha = nodeAlpha * 0.3
        ctx.fill()

        // Core dot
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2)
        ctx.fillStyle = n.colorTone
        ctx.globalAlpha = nodeAlpha
        ctx.fill()
        ctx.globalAlpha = 1.0
      })

      // 4. Draw Moving Glowing Data Flow Packets
      dataPackets.forEach((p) => {
        p.progress += p.speed
        if (p.progress >= 1.0) {
          p.progress = 0
        }

        const n1 = nodes[p.from]
        const n2 = nodes[p.to]
        if (!n1 || !n2) return

        const px = n1.x + (n2.x - n1.x) * p.progress
        const py = n1.y + (n2.y - n1.y) * p.progress

        ctx.beginPath()
        ctx.arc(px, py, 2.4, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.shadowColor = p.color
        ctx.shadowBlur = 8
        ctx.globalAlpha = isDark ? 0.70 : 0.40
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1.0
      })

      animationId = requestAnimationFrame(render)
    }

    render()

    return () => {
      if (animationId) cancelAnimationFrame(animationId)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return (
    <div className="dashboard-bg-effects-container" aria-hidden="true">
      {/* Soft Blurred Ambient Light Orbs */}
      <div className="ambient-orb orb-cyan" />
      <div className="ambient-orb orb-purple" />
      <div className="ambient-orb orb-green" />
      <div className="ambient-orb orb-blue" />

      {/* Abstract 3D Supply Chain & Flow Canvas */}
      <canvas ref={canvasRef} className="dashboard-bg-canvas" />
    </div>
  )
}
