import { useEffect, useRef, useState, useMemo } from 'react'
import {
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Info,
  X,
  Network,
  Activity,
  ShieldCheck,
  ArrowRight,
  Compass,
  Radio,
  Sliders
} from 'lucide-react'
import './Network3DVisual.css'

// 33 representative logistics hubs in 4 distinct regional clusters (North America, Europe, India, Asia-Pacific)
export const NETWORK_NODES_3D = [
  // ==========================================
  // CLUSTER 1: North America Trunk (0 - 9)
  // Far West / Left hemisphere (X: -335 to -155)
  // ==========================================
  {
    id: 'LAX',
    name: 'Los Angeles',
    country: 'US',
    x: -310, y: 30, z: -50,
    group: 'na',
    radius: 7.5,
    isGateway: true,
    riskScore: 65,
    riskLevel: 'High',
    type: 'Pacific Gateway Mega-Port',
    region: 'North American Network',
    modality: 'Deepwater Maritime & Intermodal Rail',
    insight: 'Primary Pacific gateway handling 40% of container imports. High structural congestion; GCN model recommends dynamic diversion via Seattle Great Circle corridor.'
  },
  {
    id: 'LGB',
    name: 'Long Beach',
    country: 'US',
    x: -290, y: 75, z: -25,
    group: 'na',
    radius: 6.0,
    isGateway: false,
    riskScore: 88,
    riskLevel: 'Critical',
    type: 'San Pedro Bay Container Terminal',
    region: 'North American Network',
    modality: 'Automated Container Terminal',
    insight: 'Berth turnaround delays exceeding 72h. Multi-hop cascading backpressure impacts Chicago-bound rail manifests.'
  },
  {
    id: 'OAK',
    name: 'Oakland',
    country: 'US',
    x: -335, y: -20, z: -70,
    group: 'na',
    radius: 5.5,
    isGateway: false,
    riskScore: 48,
    riskLevel: 'Medium',
    type: 'Northern California Port',
    region: 'North American Network',
    modality: 'Maritime & Agricultural Export Depot',
    insight: 'Key agricultural export terminal with balanced throughput. Stable 1-hop buffer to West Coast maritime trunks.'
  },
  {
    id: 'SEA',
    name: 'Seattle',
    country: 'US',
    x: -320, y: -105, z: -95,
    group: 'na',
    radius: 6.0,
    isGateway: false,
    riskScore: 38,
    riskLevel: 'Low',
    type: 'Pacific Northwest Intermodal',
    region: 'North American Network',
    modality: 'Great Circle Maritime & Northern Rail',
    insight: 'Low-congestion alternative gateway. 18% lower transit latency for trans-Pacific electronics shipments.'
  },
  {
    id: 'CHI',
    name: 'Chicago',
    country: 'US',
    x: -220, y: -50, z: 20,
    group: 'na',
    radius: 7.0,
    isGateway: true,
    riskScore: 72,
    riskLevel: 'High',
    type: 'Continental Rail & Logistics Crossroads',
    region: 'North American Network',
    modality: 'Class-I Intermodal Rail Interchange',
    insight: "North America's highest volume rail junction. High seasonal weather sensitivity with significant downstream shock transmission."
  },
  {
    id: 'DAL',
    name: 'Dallas',
    country: 'US',
    x: -245, y: 35, z: -5,
    group: 'na',
    radius: 5.5,
    isGateway: false,
    riskScore: 32,
    riskLevel: 'Low',
    type: 'Inland Distribution Center',
    region: 'North American Network',
    modality: 'Interstate Highway & Air Cargo',
    insight: 'Central inland distribution anchor. High on-time fulfillment rates across southern domestic freight corridors.'
  },
  {
    id: 'HOU',
    name: 'Houston',
    country: 'US',
    x: -225, y: 85, z: 35,
    group: 'na',
    radius: 6.0,
    isGateway: false,
    riskScore: 46,
    riskLevel: 'Medium',
    type: 'Gulf Petrochemical Gateway',
    region: 'North American Network',
    modality: 'Deepwater Channel & Pipeline Depot',
    insight: 'Gulf Coast heavy industrial port. Moderate vulnerability to tropical weather disruptions and channel draft restrictions.'
  },
  {
    id: 'NYC',
    name: 'New York',
    country: 'US',
    x: -155, y: -65, z: 85,
    group: 'na',
    radius: 7.0,
    isGateway: true,
    riskScore: 56,
    riskLevel: 'Medium',
    type: 'East Coast Mega-Port & Air Cargo',
    region: 'North American Network',
    modality: 'JFK Air Cargo & NY/NJ Marine Terminals',
    insight: 'Atlantic maritime gateway with high urban throughput. Serves dense northeastern consumer consumption grid.'
  },
  {
    id: 'SAV',
    name: 'Savannah',
    country: 'US',
    x: -175, y: 35, z: 75,
    group: 'na',
    radius: 5.5,
    isGateway: false,
    riskScore: 36,
    riskLevel: 'Low',
    type: 'Southeast Container Terminal',
    region: 'North American Network',
    modality: 'Deepwater Container Port & CSX/NS Rail',
    insight: 'Fast-growing Southeast logistics corridor. Demonstrates strong buffer capacity during Northeast weather surges.'
  },
  {
    id: 'TOR',
    name: 'Toronto',
    country: 'CA',
    x: -185, y: -110, z: 50,
    group: 'na',
    radius: 6.0,
    isGateway: false,
    riskScore: 28,
    riskLevel: 'Low',
    type: 'Great Lakes Rail Terminal',
    region: 'North American Network',
    modality: 'CN/CP Rail & Trans-Border Trucking',
    insight: 'Cross-border manufacturing supply link. Highly stable bilateral automotive and equipment supply flows.'
  },

  // ==========================================
  // CLUSTER 2: European Network (10 - 16)
  // Center-North / Upper Hemisphere (X: -140 to -10, Y: -165 to -35)
  // ==========================================
  {
    id: 'RTM',
    name: 'Rotterdam',
    country: 'NL',
    x: -70, y: -140, z: 140,
    group: 'europe',
    radius: 7.5,
    isGateway: true,
    riskScore: 76,
    riskLevel: 'High',
    type: 'European Mainport Gateway',
    region: 'European Network',
    modality: 'Deepwater Maritime & Rhine Barge Hub',
    insight: 'Main European container gateway with high river-rail feeder dependency. Congestion cascades into Frankfurt air cargo and Antwerp terminals.'
  },
  {
    id: 'ANR',
    name: 'Antwerp',
    country: 'BE',
    x: -115, y: -105, z: 105,
    group: 'europe',
    radius: 6.0,
    isGateway: false,
    riskScore: 45,
    riskLevel: 'Medium',
    type: 'Chemical & Container Port',
    region: 'European Network',
    modality: 'Inland Scheldt Port & Rail Hub',
    insight: 'Leading European chemical port cluster. High throughput efficiency with robust multimodal rail connections.'
  },
  {
    id: 'HAM',
    name: 'Hamburg',
    country: 'DE',
    x: -30, y: -165, z: 160,
    group: 'europe',
    radius: 6.5,
    isGateway: false,
    riskScore: 58,
    riskLevel: 'Medium',
    type: 'Elbe River Port & Rail Hub',
    region: 'European Network',
    modality: 'Tidal River Port & Scandinavian Rail Gateway',
    insight: 'Central Baltic and Scandinavian rail nexus. Subject to seasonal Elbe navigational draft constraints.'
  },
  {
    id: 'FRA',
    name: 'Frankfurt',
    country: 'DE',
    x: -20, y: -95, z: 95,
    group: 'europe',
    radius: 7.0,
    isGateway: true,
    riskScore: 44,
    riskLevel: 'Medium',
    type: 'Air Cargo Mega-Hub & Central Rail',
    region: 'European Network',
    modality: 'Global Airport Hub & Deutsche Bahn Freight',
    insight: 'Core European air cargo junction. Handles high-value pharma, precision machinery, and urgent transshipments.'
  },
  {
    id: 'LON',
    name: 'London',
    country: 'GB',
    x: -140, y: -155, z: 145,
    group: 'europe',
    radius: 6.5,
    isGateway: false,
    riskScore: 39,
    riskLevel: 'Low',
    type: 'UK Distribution & Gateway',
    region: 'European Network',
    modality: 'London Gateway & Channel Intermodal',
    insight: 'UK island distribution hub. Customs clearance buffer maintains high predictability across channel corridors.'
  },
  {
    id: 'GOA',
    name: 'Genoa',
    country: 'IT',
    x: -10, y: -40, z: 70,
    group: 'europe',
    radius: 5.5,
    isGateway: false,
    riskScore: 35,
    riskLevel: 'Low',
    type: 'Mediterranean Deepwater Terminal',
    region: 'European Network',
    modality: 'Ligurian Sea Maritime & Alpine Rail',
    insight: 'Southern European maritime gate. Connects Mediterranean maritime shipping lanes directly to northern industrial Italy.'
  },
  {
    id: 'VLC',
    name: 'Valencia',
    country: 'ES',
    x: -75, y: -35, z: 50,
    group: 'europe',
    radius: 5.5,
    isGateway: false,
    riskScore: 30,
    riskLevel: 'Low',
    type: 'Iberian Maritime Transshipment',
    region: 'European Network',
    modality: 'Western Mediterranean Container Port',
    insight: 'Strategic transshipment hub for western Mediterranean. Reliable weather profile and consistent vessel scheduling.'
  },

  // ==========================================
  // CLUSTER 3: India Regional Network (17 - 24)
  // Center-South / Lower Hemisphere (X: -60 to 85, Y: -10 to 165)
  // Focus: NH 16 Corridor & Gateway Ports
  // ==========================================
  {
    id: 'BOM',
    name: 'Mumbai',
    country: 'IN',
    x: -60, y: 60, z: 60,
    group: 'india',
    radius: 7.5,
    isGateway: true,
    riskScore: 22,
    riskLevel: 'Low',
    type: 'Primary West Coast Gateway (JNPT)',
    region: 'India Regional Network',
    modality: 'JNPT Maritime Port & Dedicated Freight Corridor (DFC)',
    insight: "India's premier maritime container port. Direct feeder for the Western Dedicated Freight Corridor linking western ports to northern manufacturing hubs."
  },
  {
    id: 'DEL',
    name: 'Delhi NCR',
    country: 'IN',
    x: -20, y: -10, z: 80,
    group: 'india',
    radius: 6.5,
    isGateway: true,
    riskScore: 26,
    riskLevel: 'Low',
    type: 'Northern Multimodal Logistics Park',
    region: 'India Regional Network',
    modality: 'Inland Container Depot (ICD Tughlakabad) & Air Cargo',
    insight: 'Northern industrial consumption center. Serves high-density automotive and consumer electronics supply chains.'
  },
  {
    id: 'HYD',
    name: 'Hyderabad',
    country: 'IN',
    x: 0, y: 45, z: 100,
    group: 'india',
    radius: 6.5,
    isGateway: false,
    riskScore: 24,
    riskLevel: 'Low',
    type: 'Air Cargo & Central Pharma Corridor',
    region: 'India Regional Network',
    modality: 'RGIA Air Cargo & Central Highway Nexus',
    insight: 'Global pharmaceutical and vaccine export node with temperature-controlled air freight and high SLA reliability.'
  },
  {
    id: 'BZA',
    name: 'Vijayawada',
    country: 'IN',
    x: 35, y: 75, z: 140,
    group: 'india',
    radius: 7.0,
    isGateway: true,
    riskScore: 16,
    riskLevel: 'Low',
    type: 'Inland Rail & Road Junction (NH 16)',
    region: 'India Regional Network',
    modality: 'NH 16 Highway Corridor & SCR Rail Division',
    insight: 'Core multimodal junction on NH 16 economic corridor. Consolidates freight moving between Kolkata, Chennai, and Hyderabad with low delay probability.'
  },
  {
    id: 'GNT',
    name: 'Guntur',
    country: 'IN',
    x: 10, y: 110, z: 130,
    group: 'india',
    radius: 5.5,
    isGateway: false,
    riskScore: 18,
    riskLevel: 'Low',
    type: 'Agricultural & Freight Terminal',
    region: 'India Regional Network',
    modality: 'Regional Highway & Agritech Depot',
    insight: 'High-volume agricultural commodity terminal. Smooth 1-hop consolidation to Vijayawada railhead and Chennai port.'
  },
  {
    id: 'NLR',
    name: 'Nellore',
    country: 'IN',
    x: 50, y: 135, z: 110,
    group: 'india',
    radius: 5.5,
    isGateway: false,
    riskScore: 15,
    riskLevel: 'Low',
    type: 'NH 16 Expressway Logistics Hub',
    region: 'India Regional Network',
    modality: 'Krishnapatnam Port Feeder & NH 16 Expressway',
    insight: 'Strategic coastal expressway transit hub. Direct feeder access to Krishnapatnam deepwater port and Chennai industrial belt.'
  },
  {
    id: 'MAA',
    name: 'Chennai',
    country: 'IN',
    x: 85, y: 165, z: 95,
    group: 'india',
    radius: 7.0,
    isGateway: true,
    riskScore: 32,
    riskLevel: 'Low',
    type: 'Automotive & Deepwater Port',
    region: 'India Regional Network',
    modality: 'Chennai & Ennore Ports & Southern Railway',
    insight: 'Southern automotive and industrial manufacturing cluster. Key maritime transshipment link to Malacca Strait corridors.'
  },
  {
    id: 'VTZ',
    name: 'Visakhapatnam',
    country: 'IN',
    x: 85, y: 45, z: 160,
    group: 'india',
    radius: 6.0,
    isGateway: false,
    riskScore: 28,
    riskLevel: 'Low',
    type: 'Bay of Bengal Deepwater Port',
    region: 'India Regional Network',
    modality: 'Deepwater Port & Coastal Economic Corridor',
    insight: 'Eastern naval and heavy industrial port. Direct bulk mineral and petroleum transshipment hub along the Bay of Bengal.'
  },

  // ==========================================
  // CLUSTER 4: Asia-Pacific Network (25 - 32)
  // Far East / Right hemisphere (X: 175 to 365)
  // ==========================================
  {
    id: 'SHA',
    name: 'Shanghai',
    country: 'CN',
    x: 250, y: -45, z: -35,
    group: 'asia',
    radius: 8.0,
    isGateway: true,
    riskScore: 85,
    riskLevel: 'Critical',
    type: 'Mega Maritime Port (Yangshan)',
    region: 'Asia-Pacific Network',
    modality: 'Yangshan Deepwater Automated Terminal',
    insight: "World's busiest container hub. Heavy vessel queues trigger cascading delays across Trans-Pacific and European corridors."
  },
  {
    id: 'SZX',
    name: 'Shenzhen',
    country: 'CN',
    x: 220, y: 25, z: -10,
    group: 'asia',
    radius: 6.5,
    isGateway: false,
    riskScore: 50,
    riskLevel: 'Medium',
    type: 'Pearl River Delta Maritime Gateway',
    region: 'Asia-Pacific Network',
    modality: 'Yantian Container Port & High-Tech Air Freight',
    insight: 'Global high-tech hardware export capital. Rapid turnarounds with high sensitivity to transshipment bottlenecks.'
  },
  {
    id: 'NGB',
    name: 'Ningbo',
    country: 'CN',
    x: 290, y: -15, z: -15,
    group: 'asia',
    radius: 6.0,
    isGateway: false,
    riskScore: 42,
    riskLevel: 'Medium',
    type: 'Deepwater Container Terminal',
    region: 'Asia-Pacific Network',
    modality: 'Zhoushan Port Complex & Rail Terminal',
    insight: 'Major deep-sea bulk and container facility. Provides valuable overflow relief for neighboring Shanghai berths.'
  },
  {
    id: 'HKG',
    name: 'Hong Kong',
    country: 'HK',
    x: 190, y: 60, z: 15,
    group: 'asia',
    radius: 6.5,
    isGateway: false,
    riskScore: 34,
    riskLevel: 'Low',
    type: 'Global Air & Sea Transshipment',
    region: 'Asia-Pacific Network',
    modality: 'HKIA World Air Hub & Kwai Tsing Terminal',
    insight: "World's busiest air cargo airport. Rapid customs and express transshipment corridor across APAC and India."
  },
  {
    id: 'SIN',
    name: 'Singapore',
    country: 'SG',
    x: 175, y: 135, z: 70,
    group: 'asia',
    radius: 7.5,
    isGateway: true,
    riskScore: 68,
    riskLevel: 'High',
    type: 'Global Maritime Straits Hub',
    region: 'Asia-Pacific Network',
    modality: 'Tuas Mega Port & Strait of Malacca Anchor',
    insight: 'Indo-Pacific maritime crossroads. Strategic transshipment bottleneck connecting Asia, India, and European ocean corridors.'
  },
  {
    id: 'SGN',
    name: 'Ho Chi Minh',
    country: 'VN',
    x: 230, y: 95, z: 40,
    group: 'asia',
    radius: 5.5,
    isGateway: false,
    riskScore: 40,
    riskLevel: 'Medium',
    type: 'Manufacturing Port Gateway',
    region: 'Asia-Pacific Network',
    modality: 'Cai Mep Deepwater Terminal',
    insight: 'Rapidly expanding Southeast Asian electronics and apparel manufacturing hub with direct US West Coast sailings.'
  },
  {
    id: 'PUS',
    name: 'Busan',
    country: 'KR',
    x: 320, y: -90, z: -70,
    group: 'asia',
    radius: 6.0,
    isGateway: false,
    riskScore: 48,
    riskLevel: 'Medium',
    type: 'Transshipment Hub of Northeast Asia',
    region: 'Asia-Pacific Network',
    modality: 'Busan New Port Deepwater Berths',
    insight: 'Premier Northeast Asian transshipment center. Crucial link for feeder cargo from Northern China, Russia, and Japan.'
  },
  {
    id: 'TYO',
    name: 'Tokyo',
    country: 'JP',
    x: 365, y: -60, z: -110,
    group: 'asia',
    radius: 6.5,
    isGateway: true,
    riskScore: 27,
    riskLevel: 'Low',
    type: 'High-Tech Cargo Gateway',
    region: 'Asia-Pacific Network',
    modality: 'Narita Air Cargo & Yokohama Port',
    insight: 'Precision robotics, automotive parts, and high-value semiconductor supply chain gateway with ultra-high schedule reliability.'
  }
]

// 55 Freight Corridors (pair of node indices)
// Divided into clean intra-regional clusters and inter-continental trade bridges
export const NETWORK_EDGES_3D = [
  // --- North America Intra-Cluster (0 - 9) ---
  [0, 1], [0, 2], [2, 3], [0, 4], [0, 5], [5, 6], [6, 8], [4, 5], [4, 7], [4, 9], [7, 8], [7, 9],

  // --- Europe Intra-Cluster (10 - 16) ---
  [10, 11], [10, 12], [10, 13], [10, 14], [13, 12], [13, 11], [13, 15], [15, 16], [11, 14],

  // --- India Intra-Cluster (17 - 24: NH 16 Focus) ---
  [17, 18], [17, 19], [17, 23], [18, 19], [19, 20], [20, 21], [21, 22], [22, 23], [20, 22], [20, 24], [24, 23],

  // --- Asia-Pacific Intra-Cluster (25 - 32) ---
  [25, 27], [25, 26], [26, 28], [28, 29], [29, 30], [26, 30], [25, 31], [31, 32], [25, 32],

  // --- Inter-Continental Trade Corridors (Bridges) ---
  // Trans-Pacific Corridors (Asia <-> North America)
  [25, 0],  // Shanghai <-> Los Angeles
  [32, 0],  // Tokyo <-> Los Angeles
  [31, 3],  // Busan <-> Seattle
  [26, 1],  // Shenzhen <-> Long Beach

  // Asia - India Ocean Corridors
  [29, 23], // Singapore <-> Chennai
  [29, 17], // Singapore <-> Mumbai
  [28, 24], // Hong Kong <-> Visakhapatnam

  // India - Europe Corridors (Suez / Mediterranean / Air)
  [17, 10], // Mumbai <-> Rotterdam
  [17, 15], // Mumbai <-> Genoa
  [18, 13], // Delhi <-> Frankfurt

  // Trans-Atlantic Corridors (Europe <-> North America)
  [10, 7],  // Rotterdam <-> New York
  [14, 7],  // London <-> New York
  [12, 4],  // Hamburg <-> Chicago
  [11, 8]   // Antwerp <-> Savannah
]

// Precompute degree and neighbors map for every node
const NODE_NEIGHBORS = Array.from({ length: NETWORK_NODES_3D.length }, () => [])
NETWORK_EDGES_3D.forEach(([u, v]) => {
  if (u < NETWORK_NODES_3D.length && v < NETWORK_NODES_3D.length) {
    NODE_NEIGHBORS[u].push(v)
    NODE_NEIGHBORS[v].push(u)
  }
})

// Region metadata
const REGION_CONFIG = {
  all: { label: 'All Networks', color: '#38bdf8' },
  india: { label: 'India Regional Network', short: 'India (NH 16)', color: '#34d399', badgeClass: 'india' },
  asia: { label: 'Asia-Pacific Network', short: 'Asia-Pacific', color: '#38bdf8', badgeClass: 'asia' },
  europe: { label: 'European Network', short: 'Europe', color: '#c084fc', badgeClass: 'europe' },
  na: { label: 'North American Network', short: 'North America', color: '#fbbf24', badgeClass: 'na' }
}

export default function Network3DVisual() {
  const canvasRef = useRef(null)
  const [isRotating, setIsRotating] = useState(true)
  const [zoomLevel, setZoomLevel] = useState(1.0)
  const [hoveredNode, setHoveredNode] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [selectedRegion, setSelectedRegion] = useState('all')

  const hoveredIndexRef = useRef(null)
  const selectedIndexRef = useRef(null)
  const projectedNodesRef = useRef([])
  const zoomLevelRef = useRef(1.0)
  const selectedRegionRef = useRef('all')
  const anglesRef = useRef({ targetY: 0.22, targetX: -0.16 })

  // Keep refs in sync for 60fps render loop
  useEffect(() => {
    zoomLevelRef.current = zoomLevel
  }, [zoomLevel])

  useEffect(() => {
    selectedRegionRef.current = selectedRegion
  }, [selectedRegion])

  useEffect(() => {
    selectedIndexRef.current = selectedNode
      ? NETWORK_NODES_3D.findIndex((n) => n.name === selectedNode.name)
      : null
  }, [selectedNode])

  const handleReset = () => {
    setZoomLevel(1.0)
    setSelectedRegion('all')
    setSelectedNode(null)
    setIsRotating(true)
    anglesRef.current = { targetY: 0.22, targetX: -0.16 }
  }

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(1.7, Number((prev + 0.15).toFixed(2))))
  }

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(0.65, Number((prev - 0.15).toFixed(2))))
  }

  const handleSelectNeighbor = (neighborIndex) => {
    const node = NETWORK_NODES_3D[neighborIndex]
    if (node) {
      setSelectedNode(node)
      setIsRotating(false)
    }
  }

  const handleRegionClick = (regionKey) => {
    setSelectedRegion(regionKey)
    if (regionKey === 'india') {
      anglesRef.current = { targetY: 0.08, targetX: -0.12 }
    } else if (regionKey === 'asia') {
      anglesRef.current = { targetY: -0.35, targetX: -0.14 }
    } else if (regionKey === 'europe') {
      anglesRef.current = { targetY: 0.38, targetX: -0.22 }
    } else if (regionKey === 'na') {
      anglesRef.current = { targetY: 0.65, targetX: -0.14 }
    } else {
      anglesRef.current = { targetY: 0.22, targetX: -0.16 }
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let animationId = null
    let angleY = anglesRef.current.targetY
    let angleX = anglesRef.current.targetX
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
        anglesRef.current.targetY += dx * 0.0065
        anglesRef.current.targetX += dy * 0.0065
        anglesRef.current.targetX = Math.max(-0.85, Math.min(0.85, anglesRef.current.targetX))
      } else {
        const rect = canvas.getBoundingClientRect()
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top
        let found = null
        for (const node of projectedNodesRef.current) {
          const dist = Math.hypot(node.px - mx, node.py - my)
          // Hit radius accounts for node scale and padding
          if (dist < Math.max(14, node.radius * node.scale + 12)) {
            found = node
            break
          }
        }
        hoveredIndexRef.current = found ? found.index : null
        setHoveredNode(found ? NETWORK_NODES_3D[found.index] : null)
        canvas.style.cursor = found ? 'pointer' : isDragging ? 'grabbing' : 'grab'
      }
    }

    const onMouseUp = () => {
      isDragging = false
    }

    const onClick = (e) => {
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      let clicked = null

      for (const node of projectedNodesRef.current) {
        const dist = Math.hypot(node.px - mx, node.py - my)
        if (dist < Math.max(14, node.radius * node.scale + 12)) {
          clicked = node
          break
        }
      }

      if (clicked) {
        setSelectedNode(NETWORK_NODES_3D[clicked.index])
        setIsRotating(false) // pause orbit while inspecting
      } else {
        // Clicked outside on canvas background: close inspector
        setSelectedNode(null)
      }
    }

    const onWheel = (e) => {
      e.preventDefault()
      const delta = e.deltaY < 0 ? 0.08 : -0.08
      setZoomLevel((prev) => Math.max(0.65, Math.min(1.7, Number((prev + delta).toFixed(2)))))
    }

    canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('click', onClick)
    canvas.addEventListener('wheel', onWheel, { passive: false })

    // ==========================================
    // 60FPS 3D RENDER LOOP
    // ==========================================
    const render = () => {
      pulseTime += 0.02

      // Presentation-grade slow auto-orbit
      if (!isDragging && isRotating && !selectedIndexRef.current) {
        anglesRef.current.targetY += 0.0006
      }

      // Smooth inertia damping
      angleY += (anglesRef.current.targetY - angleY) * 0.085
      angleX += (anglesRef.current.targetX - angleX) * 0.085

      const rect = canvas.getBoundingClientRect()
      const width = rect.width
      const height = rect.height
      const cx = width / 2
      const cy = height / 2

      // Spatial focal length calibrated for wide quad-cluster separation
      const cameraDistance = 640
      const fov = 580 * zoomLevelRef.current

      ctx.clearRect(0, 0, width, height)

      // Trigonometric cache
      const cosY = Math.cos(angleY), sinY = Math.sin(angleY)
      const cosX = Math.cos(angleX), sinX = Math.sin(angleX)

      // Project 3D nodes to 2D screen coordinates
      const activeFilter = selectedRegionRef.current
      const activeHoverIndex = hoveredIndexRef.current
      const activeSelectIndex = selectedIndexRef.current

      const projectedNodes = NETWORK_NODES_3D.map((node, index) => {
        // Rotate around Y-axis
        const x1 = node.x * cosY - node.z * sinY
        const z1 = node.z * cosY + node.x * sinY

        // Rotate around X-axis
        const y1 = node.y * cosX - z1 * sinX
        const z2 = z1 * cosX + node.y * sinX

        const scale = fov / (cameraDistance + z2)
        const px = cx + x1 * scale
        const py = cy + y1 * scale

        const isFiltered = activeFilter === 'all' || node.group === activeFilter
        const isHovered = activeHoverIndex === index
        const isSelected = activeSelectIndex === index
        const isNeighborOfActive =
          (activeHoverIndex !== null && NODE_NEIGHBORS[activeHoverIndex].includes(index)) ||
          (activeSelectIndex !== null && NODE_NEIGHBORS[activeSelectIndex].includes(index))

        return {
          ...node,
          index,
          px,
          py,
          scale,
          zDepth: z2,
          isFiltered,
          isHovered,
          isSelected,
          isNeighborOfActive
        }
      })

      projectedNodesRef.current = projectedNodes

      // Determine focus state
      const hasActiveSelection = activeSelectIndex !== null || activeHoverIndex !== null
      const focusIndex = activeSelectIndex !== null ? activeSelectIndex : activeHoverIndex

      // ----------------------------------------------------
      // 1. Render Freight Corridors (Lines)
      // ----------------------------------------------------
      NETWORK_EDGES_3D.forEach(([i1, i2]) => {
        const p1 = projectedNodes[i1]
        const p2 = projectedNodes[i2]
        if (!p1 || !p2) return

        const isConnectedToFocus =
          hasActiveSelection && (i1 === focusIndex || i2 === focusIndex)
        const isInterClusterBridge = p1.group !== p2.group
        const isRegionalMatch =
          activeFilter === 'all' || (p1.group === activeFilter && p2.group === activeFilter)

        ctx.beginPath()
        ctx.moveTo(p1.px, p1.py)
        ctx.lineTo(p2.px, p2.py)

        if (isConnectedToFocus) {
          // Highlighted active GCN connection
          ctx.strokeStyle = activeSelectIndex !== null ? '#fbbf24' : '#38bdf8'
          ctx.lineWidth = 2.6
          ctx.shadowColor = activeSelectIndex !== null ? '#fbbf24' : '#38bdf8'
          ctx.shadowBlur = 12
          ctx.stroke()
          ctx.shadowBlur = 0

          // Glowing energy pulse moving along active corridor
          const pulseOffset = (pulseTime * 0.8 + (i1 + i2) * 0.15) % 1
          const pulseX = p1.px + (p2.px - p1.px) * pulseOffset
          const pulseY = p1.py + (p2.py - p1.py) * pulseOffset

          ctx.beginPath()
          ctx.arc(pulseX, pulseY, 3, 0, Math.PI * 2)
          ctx.fillStyle = '#ffffff'
          ctx.shadowColor = activeSelectIndex !== null ? '#fbbf24' : '#38bdf8'
          ctx.shadowBlur = 8
          ctx.fill()
          ctx.shadowBlur = 0
        } else {
          // Base corridor styling
          let edgeAlpha = 0.22
          if (hasActiveSelection) {
            edgeAlpha = 0.05 // Dim unrelated edges to reduce clutter
          } else if (!isRegionalMatch && activeFilter !== 'all') {
            edgeAlpha = 0.06
          } else if (isInterClusterBridge) {
            edgeAlpha = 0.28
          }

          // Depth falloff
          const avgDepth = (p1.zDepth + p2.zDepth) / 2
          const depthFactor = Math.max(0.3, Math.min(1.1, 1 - avgDepth * 0.0015))
          const finalAlpha = Math.max(0.04, edgeAlpha * depthFactor)

          if (isInterClusterBridge) {
            // Inter-continental trade bridge: dashed / cyber cyan
            ctx.strokeStyle = `rgba(56, 189, 248, ${finalAlpha * 1.3})`
            ctx.lineWidth = Math.max(1, 1.4 * ((p1.scale + p2.scale) / 2))
            ctx.setLineDash([4, 4])
            ctx.stroke()
            ctx.setLineDash([])

            // Periodic ambient packet gliding across continents
            if (!hasActiveSelection) {
              const ambientPulse = (pulseTime * 0.25 + (i1 * 3 + i2)) % 1
              const ax = p1.px + (p2.px - p1.px) * ambientPulse
              const ay = p1.py + (p2.py - p1.py) * ambientPulse
              ctx.beginPath()
              ctx.arc(ax, ay, 1.8, 0, Math.PI * 2)
              ctx.fillStyle = `rgba(56, 189, 248, ${finalAlpha * 2})`
              ctx.fill()
            }
          } else {
            // Regional intra-cluster connection: subtle tinted solid line
            const grpColor =
              p1.group === 'india'
                ? `rgba(52, 211, 153, ${finalAlpha * 1.2})`
                : p1.group === 'europe'
                ? `rgba(192, 132, 252, ${finalAlpha * 1.1})`
                : p1.group === 'na'
                ? `rgba(251, 191, 36, ${finalAlpha * 1.1})`
                : `rgba(56, 189, 248, ${finalAlpha})`

            ctx.strokeStyle = grpColor
            ctx.lineWidth = Math.max(0.9, 1.3 * ((p1.scale + p2.scale) / 2))
            ctx.stroke()
          }
        }
      })

      // ----------------------------------------------------
      // 2. Render 3D Logistics Hub Nodes (Back-to-Front Occlusion)
      // ----------------------------------------------------
      const sortedNodes = [...projectedNodes].sort((a, b) => b.zDepth - a.zDepth)

      sortedNodes.forEach((node) => {
        const isDimmed =
          (hasActiveSelection && !node.isHovered && !node.isSelected && !node.isNeighborOfActive) ||
          (!node.isFiltered && activeFilter !== 'all')

        const baseAlpha = isDimmed ? 0.18 : 1.0
        const depthAlpha = Math.max(0.35, Math.min(1.0, 0.9 - node.zDepth * 0.0016)) * baseAlpha

        const isHighlighted = node.isHovered || node.isSelected
        const scaleMult = isHighlighted ? 1.45 : node.isNeighborOfActive ? 1.2 : node.isGateway ? 1.1 : 0.95
        const nodeRadius = Math.max(3.2, node.radius * node.scale * scaleMult)

        // Color thematic mapping
        let primaryColor = '#38bdf8'
        let glowColor = 'rgba(56, 189, 248, 0.8)'

        if (node.group === 'india') {
          primaryColor = '#34d399'
          glowColor = 'rgba(52, 211, 153, 0.8)'
        } else if (node.group === 'europe') {
          primaryColor = '#c084fc'
          glowColor = 'rgba(192, 132, 252, 0.8)'
        } else if (node.group === 'na') {
          primaryColor = '#fbbf24'
          glowColor = 'rgba(251, 191, 36, 0.8)'
        }

        // Pulse ring on selected or hovered node
        if (isHighlighted) {
          const pulseR = nodeRadius + (Math.sin(pulseTime * 4) + 1) * 4.5
          ctx.beginPath()
          ctx.arc(node.px, node.py, pulseR, 0, Math.PI * 2)
          ctx.strokeStyle = node.isSelected ? 'rgba(251, 191, 36, 0.85)' : 'rgba(56, 189, 248, 0.85)'
          ctx.lineWidth = 1.8
          ctx.stroke()
        } else if (node.isGateway && !isDimmed) {
          // Subtle breathing beacon on primary gateway hubs
          const beaconR = nodeRadius + (Math.sin(pulseTime * 2 + node.index) + 1) * 2
          ctx.beginPath()
          ctx.arc(node.px, node.py, beaconR, 0, Math.PI * 2)
          ctx.strokeStyle = primaryColor
          ctx.globalAlpha = 0.22 * depthAlpha
          ctx.lineWidth = 1
          ctx.stroke()
          ctx.globalAlpha = 1.0
        }

        // Radial Glow
        if (!isDimmed) {
          const glowRadius = nodeRadius * (isHighlighted ? 3.2 : 2.2)
          const glow = ctx.createRadialGradient(node.px, node.py, 0, node.px, node.py, glowRadius)
          glow.addColorStop(0, glowColor)
          glow.addColorStop(1, 'rgba(0,0,0,0)')

          ctx.fillStyle = glow
          ctx.globalAlpha = depthAlpha
          ctx.beginPath()
          ctx.arc(node.px, node.py, glowRadius, 0, Math.PI * 2)
          ctx.fill()
          ctx.globalAlpha = 1.0
        }

        // Solid Hub Core
        ctx.beginPath()
        ctx.arc(node.px, node.py, nodeRadius, 0, Math.PI * 2)
        ctx.fillStyle = isHighlighted ? '#ffffff' : primaryColor
        ctx.globalAlpha = depthAlpha
        ctx.fill()

        ctx.strokeStyle = isHighlighted ? (node.isSelected ? '#fbbf24' : '#38bdf8') : '#0b1120'
        ctx.lineWidth = isHighlighted ? 2.2 : 1.2
        ctx.stroke()
        ctx.globalAlpha = 1.0

        // ==========================================
        // 3. Clean Text Labels (Uncluttered Rules)
        // Show ONLY:
        // - Major Gateway hubs by default
        // - Hovered / Selected node
        // - Immediate 1-hop neighbors of active hub
        // - When region is explicitly filtered
        // ==========================================
        const shouldShowLabel =
          isHighlighted ||
          node.isNeighborOfActive ||
          (node.isGateway && !isDimmed) ||
          (activeFilter === node.group && !isDimmed)

        if (shouldShowLabel && !isDimmed) {
          const labelText = node.isGateway ? `★ ${node.name}` : node.name
          ctx.font = isHighlighted
            ? 'bold 12px "JetBrains Mono", monospace'
            : node.isGateway
            ? '600 10.5px "JetBrains Mono", monospace'
            : '500 9.5px "JetBrains Mono", monospace'

          const textWidth = ctx.measureText(labelText).width
          const labelX = node.px + nodeRadius + 6
          const labelY = node.py + 4

          // Subtle dark pill background for guaranteed legibility
          ctx.fillStyle = isHighlighted
            ? 'rgba(11, 16, 28, 0.95)'
            : 'rgba(11, 16, 28, 0.75)'
          ctx.fillRect(labelX - 4, labelY - 11, textWidth + 8, 15)

          ctx.strokeStyle = isHighlighted
            ? (node.isSelected ? '#fbbf24' : '#38bdf8')
            : 'rgba(255, 255, 255, 0.12)'
          ctx.lineWidth = 1
          ctx.strokeRect(labelX - 4, labelY - 11, textWidth + 8, 15)

          ctx.fillStyle = isHighlighted
            ? '#ffffff'
            : node.isNeighborOfActive
            ? '#38bdf8'
            : `rgba(241, 245, 249, ${Math.max(0.65, depthAlpha)})`
          ctx.fillText(labelText, labelX, labelY)
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
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [isRotating])

  // Selected hub neighbors data
  const selectedNodeNeighbors = useMemo(() => {
    if (!selectedNode) return []
    const idx = NETWORK_NODES_3D.findIndex((n) => n.name === selectedNode.name)
    if (idx === -1) return []
    return NODE_NEIGHBORS[idx].map((neighborIdx) => ({
      index: neighborIdx,
      ...NETWORK_NODES_3D[neighborIdx]
    }))
  }, [selectedNode])

  const getRiskBadgeClass = (score) => {
    if (score > 75) return 'critical'
    if (score > 50) return 'high'
    if (score > 30) return 'medium'
    return 'low'
  }

  return (
    <div className="network-3d-card" aria-label="3D Graph Neural Network Topology Visualizer">
      {/* Header Bar */}
      <div className="network-3d-header">
        <div className="network-3d-title-group">
          <span className="network-3d-pill">
            <Sparkles size={12} /> 3D GCN TOPOLOGY
          </span>
          <div className="network-3d-headings">
            <span className="network-3d-title">Global Multimodal Freight Graph</span>
            <span className="network-3d-subtitle">
              4 Regional Clusters · N=33 Logistics Hubs · E=55 Corridors · GCN Laplacian
            </span>
          </div>
        </div>

        {/* Region Filter Buttons */}
        <div className="network-3d-region-filters" role="group" aria-label="Filter freight network by geographic cluster">
          {Object.entries(REGION_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              type="button"
              className={`region-filter-btn ${selectedRegion === key ? 'active' : ''} ${cfg.badgeClass || ''}`}
              onClick={() => handleRegionClick(key)}
            >
              {key !== 'all' && <span className={`filter-dot ${cfg.badgeClass}`} />}
              <span>{cfg.short || cfg.label}</span>
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="network-3d-actions">
          <button
            type="button"
            className={`network-3d-btn ${isRotating ? 'active' : ''}`}
            onClick={() => setIsRotating(!isRotating)}
            title={isRotating ? 'Pause Continuous Rotation' : 'Resume Gentle Orbit'}
          >
            {isRotating ? <Pause size={13} /> : <Play size={13} />}
            <span>{isRotating ? 'Orbiting' : 'Paused'}</span>
          </button>

          <button
            type="button"
            className="network-3d-btn"
            onClick={handleZoomIn}
            title="Zoom In"
            aria-label="Zoom in"
          >
            <ZoomIn size={13} />
          </button>

          <button
            type="button"
            className="network-3d-btn"
            onClick={handleZoomOut}
            title="Zoom Out"
            aria-label="Zoom out"
          >
            <ZoomOut size={13} />
          </button>

          <button
            type="button"
            className="network-3d-btn reset-btn"
            onClick={handleReset}
            title="Reset Perspective, Zoom, and Selection"
          >
            <RotateCcw size={13} />
            <span>Reset View</span>
          </button>

          <span className="network-3d-zoom-badge">
            {Math.round(zoomLevel * 100)}%
          </span>
        </div>
      </div>

      {/* Main 3D Canvas Stage */}
      <div className="network-3d-canvas-wrapper">
        <canvas ref={canvasRef} className="network-3d-canvas" />

        {/* Instructions Hint */}
        <div className="network-3d-hint">
          <Compass size={12} /> Drag to rotate · Scroll to zoom · Click any hub to open deep telemetry
        </div>

        {/* Hover Tooltip (Only when not inspecting side panel) */}
        {hoveredNode && !selectedNode && (
          <div className="network-3d-floating-inspector">
            <div className="inspector-header">
              <span className={`inspector-dot ${hoveredNode.group}`} />
              <div className="inspector-title-row">
                <strong>{hoveredNode.name}</strong>
                <span className="inspector-country-badge">{hoveredNode.country}</span>
              </div>
            </div>
            <div className="inspector-body">
              <span className="inspector-type">{hoveredNode.type}</span>
              <div className="inspector-stats">
                <span className={`inspector-risk-tag ${getRiskBadgeClass(hoveredNode.riskScore)}`}>
                  Risk: {hoveredNode.riskScore}/100 ({hoveredNode.riskLevel})
                </span>
                <span className="inspector-degree-tag">
                  {NODE_NEIGHBORS[NETWORK_NODES_3D.findIndex((n) => n.name === hoveredNode.name)].length} Routes
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Deep Logistics Hub Telemetry Panel (Slides in on Click) */}
        {selectedNode && (
          <aside className="hub-telemetry-panel" aria-label="Logistics Hub Deep Telemetry">
            <div className="telemetry-header">
              <div className="telemetry-badge-row">
                <span className={`telemetry-region-pill ${selectedNode.group}`}>
                  <Radio size={10} className="pulse-icon" /> {selectedNode.region}
                </span>
                <button
                  type="button"
                  className="telemetry-close-btn"
                  onClick={() => setSelectedNode(null)}
                  title="Close Hub Telemetry"
                  aria-label="Close"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="telemetry-hub-title-row">
                <h2>{selectedNode.name}</h2>
                <span className="telemetry-code">{selectedNode.id} · {selectedNode.country}</span>
              </div>
              <span className="telemetry-type">{selectedNode.type}</span>
            </div>

            <div className="telemetry-body">
              {/* Risk Telemetry Metric Card */}
              <div className="telemetry-metric-card">
                <div className="metric-row-top">
                  <span className="metric-label">Network Disruption Score</span>
                  <span className={`metric-risk-pill ${getRiskBadgeClass(selectedNode.riskScore)}`}>
                    {selectedNode.riskLevel.toUpperCase()} RISK
                  </span>
                </div>
                <div className="metric-score-bar-wrap">
                  <div
                    className={`metric-score-fill ${getRiskBadgeClass(selectedNode.riskScore)}`}
                    style={{ width: `${selectedNode.riskScore}%` }}
                  />
                </div>
                <div className="metric-row-meta">
                  <span className="score-val">{selectedNode.riskScore} <span className="score-max">/100</span></span>
                  <span className="score-desc">GCN Spectral Eigenvector Centrality</span>
                </div>
              </div>

              {/* Modality & Infrastructure */}
              <div className="telemetry-info-box">
                <span className="info-box-title">Multimodal Infrastructure</span>
                <p className="info-box-text">{selectedNode.modality}</p>
              </div>

              {/* GCN Topological Insights */}
              <div className="telemetry-insight-box">
                <div className="insight-box-title">
                  <ShieldCheck size={13} />
                  <span>Cognitive GCN Topological Assessment</span>
                </div>
                <p className="insight-box-text">{selectedNode.insight}</p>
              </div>

              {/* Connected Freight Corridors (Neighbors) */}
              <div className="telemetry-neighbors-section">
                <div className="neighbors-header">
                  <Network size={13} />
                  <span>Connected Corridors ({selectedNodeNeighbors.length})</span>
                </div>
                <div className="neighbors-list">
                  {selectedNodeNeighbors.map((neighbor) => (
                    <button
                      key={neighbor.name}
                      type="button"
                      className="neighbor-pill"
                      onClick={() => handleSelectNeighbor(neighbor.index)}
                      title={`Jump to ${neighbor.name} (${neighbor.region})`}
                    >
                      <span className={`neighbor-dot ${neighbor.group}`} />
                      <span className="neighbor-name">{neighbor.name}</span>
                      <span className={`neighbor-risk ${getRiskBadgeClass(neighbor.riskScore)}`}>
                        {neighbor.riskScore}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="telemetry-footer">
              <button
                type="button"
                className="telemetry-action-btn"
                onClick={() => handleRegionClick(selectedNode.group)}
              >
                <span>Filter {REGION_CONFIG[selectedNode.group]?.short || 'Region'}</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* Explanatory description required for presentations */}
      <div className="network-3d-explanation">
        <Info size={16} className="explanation-icon" />
        <p>
          <strong>Global Multimodal Supply Chain Network Topology (4 Geographic Clusters):</strong>{' '}
          The 3D graph visualizes <strong>N=33 logistics hubs</strong> and <strong>E=55 multimodal freight corridors</strong> grouped into India Regional (NH 16 focus), Asia-Pacific, European, and North American networks. Major gateway hubs (★) anchor inter-continental trade corridors. Hover or click any hub to inspect GCN neighborhood feature aggregation and propagation risk scores.
        </p>
      </div>

      {/* Visual Legend Bar */}
      <div className="network-3d-legend">
        <span className="n3d-legend-item">
          <span className="n3d-dot india" /> India Regional (NH 16 Corridor)
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
        <span className="n3d-legend-item">
          <span className="n3d-star">★</span> Major Gateway Hub
        </span>
        <span className="n3d-legend-item">
          <span className="n3d-dash" /> Inter-Continental Bridge
        </span>
      </div>
    </div>
  )
}
