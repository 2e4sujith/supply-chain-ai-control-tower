import { MapPin, Navigation, Route, Anchor, Train, Truck, Plane } from 'lucide-react'

// Known supply chain node coordinates (lat, lon)
const NODE_COORDINATES = {
  Shanghai: { lat: 31.23, lon: 121.47, label: 'Shanghai Port' },
  Ningbo: { lat: 29.87, lon: 121.54, label: 'Ningbo Port' },
  Shenzhen: { lat: 22.54, lon: 114.06, label: 'Shenzhen Hub' },
  Busan: { lat: 35.18, lon: 129.08, label: 'Busan Port' },
  Tokyo: { lat: 35.68, lon: 139.65, label: 'Tokyo Cargo Hub' },
  Hong_Kong: { lat: 22.32, lon: 114.17, label: 'Hong Kong Gateway' },
  Singapore: { lat: 1.35, lon: 103.82, label: 'Singapore Hub' },
  Ho_Chi_Minh_City: { lat: 10.82, lon: 106.63, label: 'Cat Lai Hub' },
  Malacca_Strait: { lat: 2.50, lon: 101.50, label: 'Malacca Strait' },
  Mumbai: { lat: 18.96, lon: 72.83, label: 'JNPT Mumbai' },
  Dubai: { lat: 25.20, lon: 55.27, label: 'Jebel Ali Dubai' },
  Suez_Canal: { lat: 30.59, lon: 32.57, label: 'Suez Canal' },
  Rotterdam: { lat: 51.92, lon: 4.48, label: 'Port of Rotterdam' },
  Hamburg: { lat: 53.55, lon: 9.99, label: 'Port of Hamburg' },
  Antwerp: { lat: 51.22, lon: 4.40, label: 'Port of Antwerp' },
  Frankfurt: { lat: 50.11, lon: 8.68, label: 'Frankfurt Intermodal' },
  Long_Beach: { lat: 33.77, lon: -118.19, label: 'Port of Long Beach' },
  Los_Angeles: { lat: 34.05, lon: -118.24, label: 'Los Angeles Hub' },
  Oakland: { lat: 37.80, lon: -122.27, label: 'Port of Oakland' },
  Seattle: { lat: 47.61, lon: -122.33, label: 'Port of Seattle' },
  Chicago: { lat: 41.88, lon: -87.63, label: 'Chicago BNSF Rail' },
  Dallas: { lat: 32.78, lon: -96.80, label: 'DFW Logistics' },
  Atlanta: { lat: 33.75, lon: -84.39, label: 'Atlanta Hub' },
  Phoenix: { lat: 33.45, lon: -112.07, label: 'Phoenix Hub' },
  Oklahoma_City: { lat: 35.47, lon: -97.52, label: 'Oklahoma City Hub' },
  Toronto: { lat: 43.65, lon: -79.38, label: 'Toronto Intermodal' },
  Monterrey: { lat: 25.69, lon: -100.32, label: 'Monterrey Gateway' },
  Mexico_City: { lat: 19.43, lon: -99.13, label: 'Mexico City Hub' },
  Panama_Canal: { lat: 9.08, lon: -79.68, label: 'Panama Canal' },
  Sydney: { lat: -33.87, lon: 151.21, label: 'Sydney Botany' },
}

function normalizeNodeName(name) {
  if (!name) return ''
  const clean = name.split(',')[0].trim().replace(/\s+/g, '_')
  const aliases = {
    LA: 'Los_Angeles',
    'L.A.': 'Los_Angeles',
    LAX: 'Los_Angeles',
    HK: 'Hong_Kong',
    HKG: 'Hong_Kong',
    SZX: 'Shenzhen',
    PVG: 'Shanghai',
    SHA: 'Shanghai',
    DFW: 'Dallas',
    ORD: 'Chicago',
    FRA: 'Frankfurt',
    ATL: 'Atlanta',
    SEA: 'Seattle',
    OAK: 'Oakland',
    LGB: 'Long_Beach',
    RTM: 'Rotterdam',
    HAM: 'Hamburg',
    ANR: 'Antwerp',
    SIN: 'Singapore',
    PUS: 'Busan',
    BOM: 'Mumbai',
    DXB: 'Dubai',
    SYD: 'Sydney',
    YYZ: 'Toronto',
    MEX: 'Mexico_City',
    MTY: 'Monterrey',
    OKC: 'Oklahoma_City',
    PHX: 'Phoenix',
    Ho_Chi_Minh: 'Ho_Chi_Minh_City',
    HCM: 'Ho_Chi_Minh_City',
  }
  return aliases[clean] || clean
}

function getModeIcon(mode) {
  switch (mode?.toLowerCase()) {
    case 'ocean':
      return <Anchor size={12} />
    case 'rail':
      return <Train size={12} />
    case 'air':
      return <Plane size={12} />
    case 'road':
    default:
      return <Truck size={12} />
  }
}

function DemoMap({ shipment, route, alternativeRoute }) {
  // If route is supplied, extract the real Dijkstra path nodes
  const recommendedPath = route?.recommended_route || (alternativeRoute ? ['Shanghai', 'Oakland', 'Los_Angeles', 'Long_Beach'] : null)
  const currentPath = route?.current_route || [shipment?.origin?.split(',')[0] || 'Origin', shipment?.currentLocation?.split(',')[0] || 'Current', shipment?.destination?.split(',')[0] || 'Destination']
  
  // Format primary coordinates display
  const origClean = normalizeNodeName(shipment?.origin)
  const origCoord = NODE_COORDINATES[origClean] || { lat: 31.23, lon: 121.47 }
  const destClean = normalizeNodeName(shipment?.destination)
  const destCoord = NODE_COORDINATES[destClean] || { lat: 34.05, lon: -118.24 }

  // Map nodes to visual points
  const waypoints = recommendedPath
    ? recommendedPath.map((nodeName, idx) => {
        const clean = normalizeNodeName(nodeName)
        const coord = NODE_COORDINATES[clean]
        const total = recommendedPath.length
        const pct = idx / (total - 1 || 1)
        
        // Compute interpolated position for SVG canvas (viewBox 800 x 520)
        let x = 110 + pct * 580
        let y = 390 - Math.sin(pct * Math.PI) * 160 + (idx % 2 === 1 ? 25 : -15)
        
        if (idx === 0) { x = 120; y = 405; }
        if (idx === total - 1) { x = 690; y = 115; }

        return {
          id: nodeName,
          name: coord?.label || nodeName.replace(/_/g, ' '),
          x,
          y,
          isOrigin: idx === 0,
          isDestination: idx === total - 1,
          isWaypoint: idx > 0 && idx < total - 1,
          lat: coord?.lat,
          lon: coord?.lon,
        }
      })
    : null

  // Generate SVG curve path through waypoints
  const generateSvgPath = (pts) => {
    if (!pts || pts.length < 2) return ''
    if (pts.length === 2) {
      return `M ${pts[0].x} ${pts[0].y} Q ${(pts[0].x + pts[1].x) / 2} ${(pts[0].y + pts[1].y) / 2 - 40} ${pts[1].x} ${pts[1].y}`
    }
    let d = `M ${pts[0].x} ${pts[0].y}`
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i]
      const p1 = pts[i + 1]
      const mx = (p0.x + p1.x) / 2
      const my = (p0.y + p1.y) / 2
      d += ` Q ${p0.x + 30} ${p0.y - 20}, ${mx} ${my} T ${p1.x} ${p1.y}`
    }
    return d
  }

  const recommendedSvgD = waypoints ? generateSvgPath(waypoints) : 'M 125 405 C 255 430, 375 390, 478 320 S 635 170, 705 105'
  const currentSvgD = 'M 125 405 C 245 352, 290 285, 408 254 S 625 168, 705 105'

  return (
    <div className="demo-map" aria-label="Live Supply Chain Route Map">
      <div className="map-badge">
        <span className="map-live-dot" />
        {route?.algorithm ? `NETWORKX DIJKSTRA MAP` : `LIVE ROUTE VIEW`}
      </div>

      <div className="map-coordinates">
        GPS TELEMETRY
        <span>
          LAT {origCoord.lat.toFixed(2)}° N / LNG {Math.abs(origCoord.lon).toFixed(2)}° {origCoord.lon >= 0 ? 'E' : 'W'}
        </span>
      </div>

      {/* Background Landmass Contours */}
      <div className="map-land land-one" />
      <div className="map-land land-two" />
      <div className="map-land land-three" />

      {/* SVG Route Geometry Layer */}
      <svg className="route-layer" viewBox="0 0 800 520" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="recRouteGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#31845d" />
            <stop offset="50%" stopColor="#e39a65" />
            <stop offset="100%" stopColor="#2e7e8a" />
          </linearGradient>
          <filter id="routeGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="glow" />
            <feComposite in="SourceGraphic" in2="glow" operator="over" />
          </filter>
        </defs>

        {/* Hazard / Disruption Risk Zone */}
        <path
          className="risk-zone"
          d="M 440 100 C 505 65, 585 90, 620 150 C 650 210, 605 272, 535 275 C 468 278, 413 232, 425 170 Z"
        />

        {/* Current / Baseline Route */}
        <path className="route-shadow" d={currentSvgD} />
        <path
          className={`route-current${route || alternativeRoute ? ' route-dimmed' : ''}`}
          d={currentSvgD}
        />

        {/* Dynamic Dijkstra Optimized Route */}
        {(route || alternativeRoute) && (
          <>
            <path
              className="route-shadow"
              d={recommendedSvgD}
              stroke="rgba(227, 154, 101, 0.25)"
              strokeWidth="12"
            />
            <path
              className="route-alternative route-highlighted"
              d={recommendedSvgD}
              stroke="url(#recRouteGrad)"
              filter="url(#routeGlow)"
            />
          </>
        )}
      </svg>

      {/* Waypoint Markers on Canvas */}
      {waypoints ? (
        waypoints.map((wp, idx) => (
          <div
            key={wp.id}
            className={`map-marker dynamic-waypoint ${wp.isOrigin ? 'marker-origin' : wp.isDestination ? 'marker-destination' : 'marker-intermediate'}`}
            style={{ left: `${(wp.x / 800) * 100}%`, top: `${(wp.y / 520) * 100}%` }}
          >
            {wp.isOrigin ? (
              <>
                <MapPin size={17} />
                <span>{wp.name}</span>
              </>
            ) : wp.isDestination ? (
              <>
                <MapPin size={17} />
                <span>{wp.name}</span>
              </>
            ) : (
              <div className="intermediate-node-pill">
                <span className="node-dot" />
                <span className="node-label">{wp.name}</span>
              </div>
            )}
          </div>
        ))
      ) : (
        <>
          <div className="map-marker marker-origin">
            <MapPin size={17} />
            <span>{shipment?.origin?.split(',')[0] || 'Origin'}</span>
          </div>
          <div className="map-marker marker-current">
            <span className="pulse-marker">
              <Navigation size={14} />
            </span>
            <span>{shipment?.currentLocation?.split(',')[0] || 'In Transit'}</span>
          </div>
          <div className="map-marker marker-destination">
            <MapPin size={17} />
            <span>{shipment?.destination?.split(',')[0] || 'Destination'}</span>
          </div>
        </>
      )}

      {/* Risk Area Tag */}
      <div className="map-risk-zone">
        <span /> Weather / Congestion Hazard Zone
      </div>

      {/* Map Legend */}
      <div className="map-legend">
        <span>
          <i className="legend-current" /> Primary Corridor
        </span>
        <span>
          <i className="legend-alt" /> Dijkstra Recommended Route
        </span>
        <span>
          <i className="legend-risk" /> High-Risk Zone
        </span>
      </div>

      {/* Map Scale & Corridor Modes Footer */}
      <div className="map-scale">
        <Route size={14} />
        {shipment?.origin?.split(',')[0]}
        <span>→</span>
        {route?.transport_modes?.map((m) => (
          <span key={m} className="mode-badge" title={`Transport Mode: ${m}`}>
            {getModeIcon(m)} {m}
          </span>
        ))}
        <span>→</span>
        {shipment?.destination?.split(',')[0]}
      </div>
    </div>
  )
}

export default DemoMap

