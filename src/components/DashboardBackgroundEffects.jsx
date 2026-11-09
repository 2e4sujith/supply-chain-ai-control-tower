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

    // Respect reduced motion
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

    // Handle tab visibility to pause animation when not visible
    const handleVisibilityChange = () => {
      isVisible = !document.hidden
      if (isVisible && !animationId) {
        render()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Generate fixed abstract logistics network nodes
    const nodeCount = 14
    const nodes = []
    const width = canvas.parentElement?.clientWidth || window.innerWidth
    const height = canvas.parentElement?.clientHeight || window.innerHeight

    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: (0.05 + (i * 0.9) / nodeCount + (Math.sin(i * 1.5) * 0.08)) * width,
        y: (0.1 + ((i * 3) % 7) * 0.12 + Math.cos(i) * 0.05) * height,
        baseX: (0.05 + (i * 0.9) / nodeCount + (Math.sin(i * 1.5) * 0.08)) * width,
        baseY: (0.1 + ((i * 3) % 7) * 0.12 + Math.cos(i) * 0.05) * height,
        radius: 2 + (i % 3) * 1.2,
        driftSpeed: 0.0008 + (i % 4) * 0.0004,
        driftPhase: i * 0.8,
        colorTone: i % 4 === 0 ? '#0284c7' : i % 4 === 1 ? '#7c3aed' : i % 4 === 2 ? '#10b981' : '#38bdf8',
      })
    }

    // Connect nodes into abstract network corridors
    const corridors = [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],
      [1, 6], [6, 7], [7, 8], [8, 9],
      [2, 7], [4, 9], [9, 10], [10, 11], [11, 12], [12, 13],
      [5, 10], [6, 11]
    ]

    // Animated data flow particles
    const particles = corridors.map(([fromIdx, toIdx], idx) => ({
      from: fromIdx,
      to: toIdx,
      progress: (idx * 0.23) % 1.0,
      speed: 0.0018 + (idx % 3) * 0.0008,
      color: idx % 3 === 0 ? '#38bdf8' : idx % 3 === 1 ? '#a855f7' : '#34d399',
    }))

    let time = 0

    const render = () => {
      if (!isVisible) {
        animationId = null
        return
      }

      time += 0.015
      const currentWidth = canvas.parentElement?.clientWidth || window.innerWidth
      const currentHeight = canvas.parentElement?.clientHeight || window.innerHeight

      ctx.clearRect(0, 0, currentWidth, currentHeight)

      // Check current theme
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
      const lineAlpha = isDark ? 0.12 : 0.06
      const nodeAlpha = isDark ? 0.4 : 0.25

      // Update node positions with gentle micro-drift
      nodes.forEach((n) => {
        n.x = n.baseX + Math.sin(time * n.driftSpeed * 100 + n.driftPhase) * 12
        n.y = n.baseY + Math.cos(time * n.driftSpeed * 100 + n.driftPhase) * 8
      })

      // 1. Draw connecting trade corridor lines
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

      // 2. Draw trade corridor hubs
      nodes.forEach((n) => {
        // Soft outer halo
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.radius * 2, 0, Math.PI * 2)
        ctx.fillStyle = n.colorTone
        ctx.globalAlpha = nodeAlpha * 0.35
        ctx.fill()

        // Core dot
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2)
        ctx.fillStyle = n.colorTone
        ctx.globalAlpha = nodeAlpha
        ctx.fill()
        ctx.globalAlpha = 1.0
      })

      // 3. Draw moving data flow particles
      particles.forEach((p) => {
        p.progress += p.speed
        if (p.progress >= 1.0) {
          p.progress = 0
        }

        const n1 = nodes[p.from]
        const n2 = nodes[p.to]
        if (!n1 || !n2) return

        const px = n1.x + (n2.x - n1.x) * p.progress
        const py = n1.y + (n2.y - n1.y) * p.progress

        // Glowing packet dot
        ctx.beginPath()
        ctx.arc(px, py, 2.5, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.shadowColor = p.color
        ctx.shadowBlur = 8
        ctx.globalAlpha = isDark ? 0.75 : 0.45
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

      {/* Abstract Logistics Network & Flow Canvas */}
      <canvas ref={canvasRef} className="dashboard-bg-canvas" />
    </div>
  )
}
