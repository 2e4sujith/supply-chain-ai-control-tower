import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './DemoMap.css'
import {
  Route,
  Anchor,
  Train,
  Truck,
  Plane,
  ZoomIn,
  ZoomOut,
  LocateFixed,
  Crosshair,
  Layers,
  AlertCircle,
  Loader2,
  Zap,
} from 'lucide-react'
import {
  resolvePredefinedHub,
  geocodeAddress,
  normalizeLocationQuery,
} from '../services/geocoding.js'

// In-memory global cache for OSRM road geometry segments
const osrmGeometryCache = new Map()

/**
 * Validate geographic coordinate bounds and detect swapped values
 */
export function validateCoordinate(lat, lon, label = 'Point') {
  if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
    return { valid: false, lat: null, lon: null, error: `${label}: Missing or invalid coordinate` }
  }
  // Detect swapped coordinates (latitude out of [-90, 90] but longitude within [-90, 90])
  if (Math.abs(lat) > 90 && Math.abs(lon) <= 90) {
    console.warn(`[DemoMap] Swapped coordinates detected for ${label}: (${lat}, ${lon}). Auto-correcting to (${lon}, ${lat}).`)
    return { valid: true, lat: lon, lon: lat, swapped: true }
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return { valid: false, lat: null, lon: null, error: `${label}: Coordinate out of bounds (${lat}, ${lon})` }
  }
  return { valid: true, lat, lon }
}

/**
 * Calculate compass bearing between two geographic points (in degrees 0..360)
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180
  const toDeg = (r) => (r * 180) / Math.PI
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2))
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1))
  const brng = toDeg(Math.atan2(y, x))
  return (brng + 360) % 360
}

// Key-free OpenStreetMap & CARTO Basemap Tile URLs
const TILE_PROVIDERS = {
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    subdomains: 'abc'
  },
  voyager: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd'
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd'
  }
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(Math.max(0, a)), Math.sqrt(Math.max(0, 1 - a)))
  return R * c
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

function getGeodesicSegment(lat1, lon1, lat2, lon2, numPoints = 16) {
  const toRad = (d) => (d * Math.PI) / 180
  const toDeg = (r) => (r * 180) / Math.PI

  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(Math.max(0, a)), Math.sqrt(Math.max(0, 1 - a)))
  const distKm = R * c

  const phi1 = toRad(lat1),
    lambda1 = toRad(lon1)
  const phi2 = toRad(lat2),
    lambda2 = toRad(lon2)
  const deltaLambda = lambda2 - lambda1
  const d = Math.acos(
    Math.max(
      -1,
      Math.min(1, Math.sin(phi1) * Math.sin(phi2) + Math.cos(phi1) * Math.cos(phi2) * Math.cos(deltaLambda))
    )
  )

  if (isNaN(d) || d < 0.0001) {
    return [
      [lat1, lon1],
      [lat2, lon2],
    ]
  }

  const points = []
  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints
    const A = Math.sin((1 - f) * d) / Math.sin(d)
    const B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(phi1) * Math.cos(lambda1) + B * Math.cos(phi2) * Math.cos(lambda2)
    const y = A * Math.cos(phi1) * Math.sin(lambda1) + B * Math.cos(phi2) * Math.sin(lambda2)
    const z = A * Math.sin(phi1) + B * Math.sin(phi2)
    const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))
    const lon = toDeg(Math.atan2(y, x))
    points.push([lat, lon])
  }
  return points
}

// Fetch real road-following coordinates from backend geometry registry or public OSRM service with caching & timeout
async function fetchOsrmSegment(lat1, lon1, lat2, lon2, originName, destName, signal) {
  const cacheKey = `${lat1.toFixed(4)},${lon1.toFixed(4)}_${lat2.toFixed(4)},${lon2.toFixed(4)}`
  if (osrmGeometryCache.has(cacheKey)) {
    return osrmGeometryCache.get(cacheKey)
  }

  // 1. Try backend road geometry endpoint first (precomputed 38 verified corridors, 0ms)
  try {
    const backendRes = await fetch('/api/routes/geometry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: originName || '',
        destination: destName || '',
        origin_lat: lat1,
        origin_lon: lon1,
        dest_lat: lat2,
        dest_lon: lon2,
      }),
      signal,
    })
    if (backendRes.ok) {
      const data = await backendRes.json()
      if (data?.coordinates && data.coordinates.length > 2) {
        osrmGeometryCache.set(cacheKey, data.coordinates)
        return data.coordinates
      }
    }
  } catch (_e) {
    // Continue to OSRM fallback
  }

  // 2. Direct OSRM public service fallback
  const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`
  try {
    const res = await fetch(url, { signal })
    if (res.ok) {
      const data = await res.json()
      if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates?.length) {
        const coords = data.routes[0].geometry.coordinates
        const latLngs = coords.map(([lon, lat]) => [lat, lon])
        if (latLngs.length > 2) {
          osrmGeometryCache.set(cacheKey, latLngs)
          return latLngs
        }
      }
    }
  } catch (_err) {
    // Fallback
  }
  return null
}

function getSegmentMode(nodeA, nodeB, routeSegments) {
  if (routeSegments && Array.isArray(routeSegments) && routeSegments.length > 0) {
    const seg = routeSegments.find(
      (s) =>
        (normalizeLocationQuery(s.origin).toLowerCase() === normalizeLocationQuery(nodeA).toLowerCase() &&
          normalizeLocationQuery(s.destination).toLowerCase() === normalizeLocationQuery(nodeB).toLowerCase()) ||
        (normalizeLocationQuery(s.origin).toLowerCase() === normalizeLocationQuery(nodeB).toLowerCase() &&
          normalizeLocationQuery(s.destination).toLowerCase() === normalizeLocationQuery(nodeA).toLowerCase())
    )
    if (seg?.mode) return seg.mode
  }
  return null
}

// Synchronous baseline builder using predefined hubs or cached coordinates
function buildSynchronousRoutePolyline(nodesWithCoords, routeSegments) {
  if (!nodesWithCoords || nodesWithCoords.length < 2) return []

  const validNodes = nodesWithCoords
    .filter((n) => n && n.coord && typeof n.coord.lat === 'number' && typeof n.coord.lon === 'number')
    .map((n) => {
      const v = validateCoordinate(n.coord.lat, n.coord.lon, n.name)
      return v.valid ? { ...n, coord: { ...n.coord, lat: v.lat, lon: v.lon } } : null
    })
    .filter(Boolean)

  if (validNodes.length < 2) return []

  const fullPoints = []
  for (let i = 0; i < validNodes.length - 1; i++) {
    const n1 = validNodes[i]
    const n2 = validNodes[i + 1]
    const p1 = n1.coord
    const p2 = n2.coord
    const distKm = calculateDistanceKm(p1.lat, p1.lon, p2.lat, p2.lon)
    const explicitMode = getSegmentMode(n1.name, n2.name, routeSegments)

    const cacheKey = `${p1.lat.toFixed(4)},${p1.lon.toFixed(4)}_${p2.lat.toFixed(4)},${p2.lon.toFixed(4)}`
    const isRoadCandidate = explicitMode === 'Road' || (!explicitMode && distKm < 800)

    let segmentPoints = null
    if (isRoadCandidate && osrmGeometryCache.has(cacheKey)) {
      segmentPoints = osrmGeometryCache.get(cacheKey)
    } else {
      segmentPoints = getGeodesicSegment(p1.lat, p1.lon, p2.lat, p2.lon, 16)
    }

    if (i > 0 && segmentPoints.length > 0) {
      segmentPoints = segmentPoints.slice(1)
    }
    fullPoints.push(...segmentPoints)
  }
  return fullPoints
}

// Asynchronous multimodal route geometry builder (fetches OSRM for road corridors)
async function buildAsynchronousRoutePolyline(nodesWithCoords, routeSegments, signal) {
  if (!nodesWithCoords || nodesWithCoords.length < 2) return { points: [], hasRoad: false }

  const validNodes = nodesWithCoords
    .filter((n) => n && n.coord && typeof n.coord.lat === 'number' && typeof n.coord.lon === 'number')
    .map((n) => {
      const v = validateCoordinate(n.coord.lat, n.coord.lon, n.name)
      return v.valid ? { ...n, coord: { ...n.coord, lat: v.lat, lon: v.lon } } : null
    })
    .filter(Boolean)

  if (validNodes.length < 2) return { points: [], hasRoad: false }

  let hasRoadSegments = false
  const segmentPromises = []

  for (let i = 0; i < validNodes.length - 1; i++) {
    const n1 = validNodes[i]
    const n2 = validNodes[i + 1]
    const p1 = n1.coord
    const p2 = n2.coord
    const distKm = calculateDistanceKm(p1.lat, p1.lon, p2.lat, p2.lon)
    const explicitMode = getSegmentMode(n1.name, n2.name, routeSegments)

    const isRoad =
      explicitMode === 'Road' ||
      (!explicitMode && distKm < 800 && explicitMode !== 'Ocean' && explicitMode !== 'Air')

    if (isRoad) {
      hasRoadSegments = true
      segmentPromises.push(
        fetchOsrmSegment(p1.lat, p1.lon, p2.lat, p2.lon, n1.name, n2.name, signal).then((roadPts) => {
          if (roadPts && roadPts.length >= 2) return roadPts
          return getGeodesicSegment(p1.lat, p1.lon, p2.lat, p2.lon, 16)
        })
      )
    } else {
      // Ocean, Air, Rail, or Long Crossings -> Geodesic Great Circle
      segmentPromises.push(
        Promise.resolve(getGeodesicSegment(p1.lat, p1.lon, p2.lat, p2.lon, 20))
      )
    }
  }

  const resolvedSegments = await Promise.all(segmentPromises)
  const fullPoints = []
  for (let i = 0; i < resolvedSegments.length; i++) {
    let seg = resolvedSegments[i]
    if (i > 0 && seg.length > 0) {
      seg = seg.slice(1)
    }
    fullPoints.push(...seg)
  }
  return { points: fullPoints, hasRoad: hasRoadSegments }
}

function fitMapToRoute(map, coords, animate = true) {
  if (!map || !coords || coords.length === 0) return

  const normalized = coords
    .map((c) => {
      if (Array.isArray(c) && c.length >= 2 && typeof c[0] === 'number' && typeof c[1] === 'number') {
        const val = validateCoordinate(c[0], c[1])
        return val.valid ? [val.lat, val.lon] : null
      }
      if (c && typeof c.lat === 'number' && typeof c.lon === 'number') {
        const val = validateCoordinate(c.lat, c.lon)
        return val.valid ? [val.lat, val.lon] : null
      }
      return null
    })
    .filter(Boolean)

  if (normalized.length === 0) return

  if (normalized.length === 1) {
    map.flyTo(normalized[0], 11, { animate, duration: 0.6 })
    return
  }

  const bounds = L.latLngBounds(normalized)
  map.fitBounds(bounds, {
    padding: [50, 50],
    maxZoom: 13,
    animate,
    duration: 0.7,
  })
}

/**
 * Returns distinct visual styling, colors, and labels for the 3 Route Objectives
 */
export function getRouteStyling(criterion) {
  switch (criterion) {
    case 'distance':
      return {
        lineColor: '#0284c7',
        glowColor: '#38bdf8',
        arrowFill: '#38bdf8',
        arrowStroke: '#075985',
        title: 'Shortest Distance Route (Dijkstra Min-km)',
        badgeClass: 'shortest',
        objectiveLabel: 'Shortest Route',
        colorHex: '#0284c7',
      }
    case 'time':
      return {
        lineColor: '#d97706',
        glowColor: '#fbbf24',
        arrowFill: '#fbbf24',
        arrowStroke: '#78350f',
        title: 'Fastest Transit Route (Dijkstra Min-hrs)',
        badgeClass: 'fastest',
        objectiveLabel: 'Fastest Route',
        colorHex: '#d97706',
      }
    case 'risk_adjusted':
    default:
      return {
        lineColor: '#059669',
        glowColor: '#10b981',
        arrowFill: '#34d399',
        arrowStroke: '#064e3b',
        title: 'Risk-Adjusted Resilient Route (Safest Corridor)',
        badgeClass: 'risk-adjusted',
        objectiveLabel: 'Risk-Adjusted Route',
        colorHex: '#059669',
      }
  }
}

function DemoMap({
  shipment,
  allShipments = [],
  onSelectShipment,
  route,
  criterion,
  alternativeRoute,
  originLocation,
  destinationLocation,
  currentLocationObj,
}) {
  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const layersGroupRef = useRef(null)
  const lastFitKeyRef = useRef('')
  const [currentZoom, setCurrentZoom] = useState(4)
  const [mapStyle, setMapStyle] = useState('voyager')
  const [showAllShipments, setShowAllShipments] = useState(true)
  const [isRoadLoading, setIsRoadLoading] = useState(false)
  const [hasRealRoadGeometry, setHasRealRoadGeometry] = useState(false)
  const [resolvedNodeMap, setResolvedNodeMap] = useState({})
  const routeStyle = useMemo(() => getRouteStyling(criterion), [criterion])

  // 1. Raw Node Names for paths
  const rawRecommendedNames = useMemo(() => {
    if (route && (!route.shipment_id || !shipment?.id || route.shipment_id === shipment.id)) {
      if (route.recommended_route && Array.isArray(route.recommended_route) && route.recommended_route.length >= 2) {
        return route.recommended_route
      }
    }
    return null
  }, [route?.recommended_route, route?.shipment_id, shipment?.id])

  const rawCurrentNames = useMemo(() => {
    if (route && (!route.shipment_id || !shipment?.id || route.shipment_id === shipment.id)) {
      if (route.current_route && Array.isArray(route.current_route) && route.current_route.length >= 2) {
        return route.current_route
      }
    }
    const origin = shipment?.origin
    const dest = shipment?.destination
    if (!origin || !dest) return []
    const curr = shipment?.currentLocation &&
      !shipment.currentLocation.toLowerCase().includes('in transit') &&
      !shipment.currentLocation.toLowerCase().includes('delivered')
        ? shipment.currentLocation
        : null
    return [origin, curr, dest].filter(Boolean)
  }, [route?.current_route, route?.shipment_id, shipment?.origin, shipment?.destination, shipment?.currentLocation, shipment?.id])

  // 2. Geocode any node names that are not yet resolved
  useEffect(() => {
    const controller = new AbortController()
    let isMounted = true

    const allNames = Array.from(new Set([...(rawRecommendedNames || []), ...(rawCurrentNames || [])]))

    async function resolveAllNodes() {
      const newMap = { ...resolvedNodeMap }
      let updated = false

      // Inject explicitly passed origin, destination, and current location objects if available
      if (originLocation && originLocation.lat) {
        const origKey = normalizeLocationQuery(shipment?.origin || rawCurrentNames[0] || '').toLowerCase()
        if (!newMap[origKey]) {
          newMap[origKey] = originLocation
          updated = true
        }
      }

      if (destinationLocation && destinationLocation.lat) {
        const destKey = normalizeLocationQuery(shipment?.destination || rawCurrentNames[rawCurrentNames.length - 1] || '').toLowerCase()
        if (!newMap[destKey]) {
          newMap[destKey] = destinationLocation
          updated = true
        }
      }

      for (const name of allNames) {
        const key = normalizeLocationQuery(name).toLowerCase()
        if (!newMap[key]) {
          // Try predefined hub first
          const predefined = resolvePredefinedHub(name)
          if (predefined) {
            newMap[key] = predefined
            updated = true
          } else {
            // Geocode via Nominatim
            const geo = await geocodeAddress(name, controller.signal)
            if (geo) {
              newMap[key] = geo
              updated = true
            }
          }
        }
      }

      if (isMounted && updated) {
        setResolvedNodeMap(newMap)
      }
    }

    resolveAllNodes()

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [rawRecommendedNames, rawCurrentNames, originLocation, destinationLocation, shipment])

  // Helper to get resolved coordinate for any node name
  const getNodeCoord = useCallback(
    (name) => {
      if (!name) return null
      const key = normalizeLocationQuery(name).toLowerCase()
      if (resolvedNodeMap[key]) return resolvedNodeMap[key]
      return resolvePredefinedHub(name)
    },
    [resolvedNodeMap]
  )

  const origCoord = useMemo(() => {
    if (originLocation && originLocation.lat) {
      const val = validateCoordinate(originLocation.lat, originLocation.lon, 'Origin Location')
      if (val.valid) return { ...originLocation, lat: val.lat, lon: val.lon }
    }
    const rawName = shipment?.origin || rawCurrentNames?.[0]
    const coord = getNodeCoord(rawName)
    if (coord && typeof coord.lat === 'number') {
      const val = validateCoordinate(coord.lat, coord.lon, rawName || 'Origin')
      if (val.valid) return { ...coord, lat: val.lat, lon: val.lon }
    }
    return null
  }, [originLocation, getNodeCoord, shipment?.origin, rawCurrentNames])

  const destCoord = useMemo(() => {
    if (destinationLocation && destinationLocation.lat) {
      const val = validateCoordinate(destinationLocation.lat, destinationLocation.lon, 'Destination Location')
      if (val.valid) return { ...destinationLocation, lat: val.lat, lon: val.lon }
    }
    const rawName = shipment?.destination || rawCurrentNames?.[rawCurrentNames.length - 1]
    const coord = getNodeCoord(rawName)
    if (coord && typeof coord.lat === 'number') {
      const val = validateCoordinate(coord.lat, coord.lon, rawName || 'Destination')
      if (val.valid) return { ...coord, lat: val.lat, lon: val.lon }
    }
    return null
  }, [destinationLocation, getNodeCoord, shipment?.destination, rawCurrentNames])

  // Prepare node arrays with coordinates
  const currentNodesWithCoords = useMemo(() => {
    return (rawCurrentNames || []).map((name) => ({ name, coord: getNodeCoord(name) }))
  }, [rawCurrentNames, getNodeCoord])

  const recNodesWithCoords = useMemo(() => {
    if (!rawRecommendedNames) return null
    return rawRecommendedNames.map((name) => ({ name, coord: getNodeCoord(name) }))
  }, [rawRecommendedNames, getNodeCoord])

  // Check if routes are identical
  const isIdenticalRoute = useMemo(() => {
    if (!rawRecommendedNames || !rawCurrentNames) return true
    if (rawRecommendedNames.length !== rawCurrentNames.length) return false
    return rawRecommendedNames.every(
      (node, i) => normalizeLocationQuery(node).toLowerCase() === normalizeLocationQuery(rawCurrentNames[i]).toLowerCase()
    )
  }, [rawRecommendedNames, rawCurrentNames])

  // Polyline Geometry Points State (Dual-phase: backend route_geometry + async OSRM upgrade)
  const isMatchingShipment = Boolean(
    route && (!route.shipment_id || !shipment?.id || route.shipment_id === shipment.id)
  )

  const [geometryPoints, setGeometryPoints] = useState(() => {
    const backendGeo = isMatchingShipment && route?.route_geometry && route.route_geometry.length > 2 ? route.route_geometry : null
    const segs = isMatchingShipment ? route?.segments : null
    return {
      current: buildSynchronousRoutePolyline(currentNodesWithCoords, segs),
      recommended: backendGeo || (recNodesWithCoords ? buildSynchronousRoutePolyline(recNodesWithCoords, segs) : null),
    }
  })

  // Asynchronous OSRM Road Geometry Fetching / Syncing Effect
  useEffect(() => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3500)

    let isMounted = true

    const isMatch = Boolean(
      route && (!route.shipment_id || !shipment?.id || route.shipment_id === shipment.id)
    )
    const activeRouteGeo = isMatch && route?.route_geometry && route.route_geometry.length > 2 ? route.route_geometry : null
    const activeSegments = isMatch ? route?.segments : null

    // If backend provided high-precision road route_geometry (length >= 2)
    if (activeRouteGeo) {
      setHasRealRoadGeometry(true)
      setIsRoadLoading(false)
      const syncCurrent = buildSynchronousRoutePolyline(currentNodesWithCoords, activeSegments)
      setGeometryPoints({
        current: isIdenticalRoute ? activeRouteGeo : syncCurrent,
        recommended: activeRouteGeo,
      })
      return () => {
        clearTimeout(timeoutId)
        controller.abort()
      }
    }

    setIsRoadLoading(true)

    // Phase 1: Set synchronous baseline immediately
    const syncCurrent = buildSynchronousRoutePolyline(currentNodesWithCoords, activeSegments)
    const syncRec = recNodesWithCoords ? buildSynchronousRoutePolyline(recNodesWithCoords, activeSegments) : null
    setGeometryPoints({ current: syncCurrent, recommended: syncRec })

    // Phase 2: Fetch high-precision OSRM road geometry if backend didn't supply it
    async function resolveHighPrecisionGeometry() {
      try {
        const [currentRes, recRes] = await Promise.all([
          buildAsynchronousRoutePolyline(currentNodesWithCoords, activeSegments, controller.signal),
          recNodesWithCoords
            ? buildAsynchronousRoutePolyline(recNodesWithCoords, activeSegments, controller.signal)
            : Promise.resolve(null),
        ])

        if (!isMounted) return

        const hasRoad = currentRes.hasRoad || (recRes && recRes.hasRoad)
        setHasRealRoadGeometry(hasRoad)

        setGeometryPoints({
          current: currentRes.points.length >= 2 ? currentRes.points : syncCurrent,
          recommended: recRes && recRes.points.length >= 2 ? recRes.points : syncRec,
        })
      } catch (_err) {
        // Retain synchronous baseline on error
      } finally {
        if (isMounted) {
          setIsRoadLoading(false)
        }
      }
    }

    resolveHighPrecisionGeometry()

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [currentNodesWithCoords, recNodesWithCoords, route?.segments, route?.route_geometry, route?.shipment_id, shipment?.id, isIdenticalRoute])

  // Initialize Leaflet Map Instance with Key-Free OpenStreetMap Tiles
  useEffect(() => {
    if (!mapContainerRef.current) return
    if (mapInstanceRef.current) return

    // Clear any stale leaflet DOM id if remounting rapidly
    if (mapContainerRef.current._leaflet_id) {
      mapContainerRef.current._leaflet_id = null
    }

    let map = null
    try {
      map = L.map(mapContainerRef.current, {
        center: [20, 78],
        zoom: 4,
        minZoom: 2,
        maxZoom: 18,
        zoomControl: false,
        scrollWheelZoom: false,
        doubleClickZoom: true,
        touchZoom: true,
        boxZoom: true,
        attributionControl: true,
        worldCopyJump: true,
      })
    } catch (err) {
      console.warn('Leaflet initialization warning:', err)
      return
    }

    // Initialize default Tile Layer (Voyager / OSM)
    const provider = TILE_PROVIDERS[mapStyle] || TILE_PROVIDERS.voyager || TILE_PROVIDERS.osm
    const tileLayer = L.tileLayer(provider.url, {
      attribution: provider.attribution,
      subdomains: provider.subdomains || 'abc',
      maxZoom: 19,
    })
    tileLayer.addTo(map)

    const layersGroup = L.layerGroup().addTo(map)
    layersGroupRef.current = layersGroup
    mapInstanceRef.current = map

    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom())
    })

    // Invalidate size immediately and after layout settles
    map.invalidateSize()
    const t1 = setTimeout(() => map && map.invalidateSize(), 100)
    const t2 = setTimeout(() => map && map.invalidateSize(), 400)

    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize()
      }
    })
    resizeObserver.observe(mapContainerRef.current)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      resizeObserver.disconnect()
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove()
        } catch (_err) {
          // ignore
        }
        mapInstanceRef.current = null
      }
      layersGroupRef.current = null
    }
  }, [])

  // Handle Tile Style Switch
  const switchMapStyle = useCallback((style) => {
    const map = mapInstanceRef.current
    if (!map) return
    setMapStyle(style)

    const provider = TILE_PROVIDERS[style] || TILE_PROVIDERS.osm

    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer)
      }
    })

    const newTileLayer = L.tileLayer(provider.url, {
      attribution: provider.attribution,
      subdomains: provider.subdomains || 'abc',
      maxZoom: 19,
    })
    newTileLayer.addTo(map)
  }, [])

  // User explicitly clicks Fit Route
  const handleFitRoute = useCallback(() => {
    const map = mapInstanceRef.current
    if (!map) return

    const coordsToFit = []
    if (geometryPoints?.recommended && geometryPoints.recommended.length >= 2) {
      coordsToFit.push(...geometryPoints.recommended)
    } else if (geometryPoints?.current && geometryPoints.current.length >= 2) {
      coordsToFit.push(...geometryPoints.current)
    } else {
      if (origCoord && origCoord.lat) coordsToFit.push(origCoord)
      if (destCoord && destCoord.lat) coordsToFit.push(destCoord)
      if (currentNodesWithCoords) {
        currentNodesWithCoords.forEach((n) => {
          if (n.coord && n.coord.lat) coordsToFit.push(n.coord)
        })
      }
    }

    if (coordsToFit.length > 0) {
      fitMapToRoute(map, coordsToFit, true)
    }
  }, [geometryPoints, origCoord, destCoord, currentNodesWithCoords])

  // User explicitly clicks Center / Fit on Active Live Shipment
  const handleFitShipment = useCallback(() => {
    const map = mapInstanceRef.current
    if (!map) return
    const liveLoc = currentLocationObj || getNodeCoord(shipment?.currentLocation) || origCoord
    if (liveLoc && typeof liveLoc.lat === 'number') {
      map.flyTo([liveLoc.lat, liveLoc.lon], 9, { animate: true, duration: 0.8 })
    }
  }, [currentLocationObj, getNodeCoord, shipment?.currentLocation, origCoord])

  // Update Map Layers (Polylines, Markers, Radar Pulse)
  useEffect(() => {
    const map = mapInstanceRef.current
    const group = layersGroupRef.current
    if (!map || !group) return

    group.clearLayers()

    const currentPolylinePoints = geometryPoints.current
    const recPolylinePoints = geometryPoints.recommended

    const displayedNodeItems = recNodesWithCoords || currentNodesWithCoords
    const validCoords = []
    const hasValidEndpoints = Boolean(
      origCoord && typeof origCoord.lat === 'number' &&
      destCoord && typeof destCoord.lat === 'number' &&
      validateCoordinate(origCoord.lat, origCoord.lon).valid &&
      validateCoordinate(destCoord.lat, destCoord.lon).valid
    )

    // 1. Draw Clean Route Polylines (Differentiating Optimal Route vs Alternative Route)
    if (hasValidEndpoints) {
      if (isIdenticalRoute) {
        // Single Optimal Route
        if (currentPolylinePoints && currentPolylinePoints.length >= 2) {
          const singleGlow = L.polyline(currentPolylinePoints, {
            color: routeStyle.glowColor,
            weight: 9,
            opacity: 0.28,
            lineCap: 'round',
            lineJoin: 'round',
          })
          group.addLayer(singleGlow)

          const singleLine = L.polyline(currentPolylinePoints, {
            color: routeStyle.lineColor,
            weight: 5.2,
            opacity: 0.98,
            lineCap: 'round',
            lineJoin: 'round',
          })
          singleLine.bindTooltip(
            `${routeStyle.title} · ${route?.total_distance_km ? `${Math.round(route.total_distance_km).toLocaleString()} km` : ''} ${route?.estimated_time_hours ? `· ${Math.round(route.estimated_time_hours)} hrs` : ''}`,
            { sticky: true, className: `ct-route-tooltip ${routeStyle.badgeClass}` }
          )
          group.addLayer(singleLine)
        }
      } else {
        // Alternative Baseline Corridor (subtle dashed line)
        if (currentPolylinePoints && currentPolylinePoints.length >= 2) {
          const baselineLine = L.polyline(currentPolylinePoints, {
            color: '#64748b',
            weight: 3,
            dashArray: '6, 6',
            opacity: 0.75,
            lineCap: 'round',
            lineJoin: 'round',
          })
          baselineLine.bindTooltip('Alternative Baseline Corridor', {
            sticky: true,
            className: 'ct-route-tooltip',
          })
          group.addLayer(baselineLine)
        }

        // Selected Objective Route (Dominant vibrant line in criterion color)
        if (recPolylinePoints && recPolylinePoints.length >= 2) {
          const recGlow = L.polyline(recPolylinePoints, {
            color: routeStyle.glowColor,
            weight: 9.5,
            opacity: 0.32,
            lineCap: 'round',
            lineJoin: 'round',
          })
          group.addLayer(recGlow)

          const recLine = L.polyline(recPolylinePoints, {
            color: routeStyle.lineColor,
            weight: 5.5,
            opacity: 0.98,
            lineCap: 'round',
            lineJoin: 'round',
          })
          recLine.bindTooltip(
            `★ ${routeStyle.title} · ${route?.total_distance_km ? `${Math.round(route.total_distance_km).toLocaleString()} km` : ''} ${route?.estimated_time_hours ? `· ${Math.round(route.estimated_time_hours)} hrs` : ''}`,
            { sticky: true, className: `ct-route-tooltip ${routeStyle.badgeClass} optimal` }
          )
          group.addLayer(recLine)
        }
      }

      // 1b. Draw Direction Indicators along Route Polylines (Origin -> Destination)
      const activeRoutePts = (recPolylinePoints && recPolylinePoints.length >= 2)
        ? recPolylinePoints
        : currentPolylinePoints
      if (activeRoutePts && activeRoutePts.length >= 4) {
        const arrowStep = Math.max(4, Math.floor(activeRoutePts.length / 6))
        for (let i = Math.floor(arrowStep / 2); i < activeRoutePts.length - 1; i += arrowStep) {
          const p1 = activeRoutePts[i]
          const p2 = activeRoutePts[i + 1]
          if (p1 && p2 && p1.length >= 2 && p2.length >= 2) {
            const brng = calculateBearing(p1[0], p1[1], p2[0], p2[1])
            const arrowIcon = L.divIcon({
              className: 'ct-route-arrow-marker',
              html: `
                <div class="route-arrow-wrapper" style="transform: rotate(${brng}deg);">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2 L22 22 L12 17 L2 22 Z" fill="${routeStyle.arrowFill}" stroke="${routeStyle.arrowStroke}" stroke-width="1.5"/>
                  </svg>
                </div>
              `,
              iconSize: [12, 12],
              iconAnchor: [6, 6],
            })
            const arrowMarker = L.marker([p1[0], p1[1]], { icon: arrowIcon, interactive: false })
            group.addLayer(arrowMarker)
          }
        }
      }
    }

    // 2. Place Clean Professional Markers
    const totalNodes = displayedNodeItems.length

    displayedNodeItems.forEach((item, idx) => {
      const coord = item.coord
      if (!coord || typeof coord.lat !== 'number') return

      const val = validateCoordinate(coord.lat, coord.lon, item.name)
      if (!val.valid) return

      const finalLat = val.lat
      const finalLon = val.lon
      validCoords.push({ lat: finalLat, lon: finalLon })

      const isOrigin = idx === 0
      const isDestination = idx === totalNodes - 1
      const isIntermediate = !isOrigin && !isDestination

      let iconHtml = ''
      let iconClass = ''

      if (isOrigin) {
        iconClass = 'ct-marker origin-marker'
        iconHtml = `
          <div class="marker-pin origin">
            <div class="marker-badge">ORG</div>
            <div class="marker-dot"></div>
          </div>
        `
      } else if (isDestination) {
        iconClass = 'ct-marker dest-marker'
        iconHtml = `
          <div class="marker-pin dest">
            <div class="marker-badge">DST</div>
            <div class="marker-dot"></div>
          </div>
        `
      } else {
        iconClass = 'ct-marker intermediate-marker'
        iconHtml = `
          <div class="waypoint-dot-marker" title="${coord.label || item.name}">
            <span class="waypoint-inner-dot"></span>
          </div>
        `
      }

      const customIcon = L.divIcon({
        className: iconClass,
        html: iconHtml,
        iconSize: isIntermediate ? [16, 16] : [36, 36],
        iconAnchor: isIntermediate ? [8, 8] : [18, 32],
        popupAnchor: [0, -28],
      })

      const marker = L.marker([finalLat, finalLon], { icon: customIcon })

      const fullAddr = coord.fullAddress || `${coord.city || item.name}, ${coord.state || ''} ${coord.country || ''}`.trim()
      const popupHtml = `
        <div class="ct-map-popup">
          <div class="popup-header">
            <span class="popup-type-tag">${coord.type || 'Logistics Hub'}</span>
            <span class="popup-region-tag">${coord.country || 'Global'}</span>
          </div>
          <h4 class="popup-title">${coord.label || item.name.replace(/_/g, ' ')}</h4>
          <div class="popup-address-block">
            <strong>Full Address:</strong>
            <p>${fullAddr}</p>
          </div>
          <div class="popup-details">
            ${coord.city ? `<div><strong>City:</strong> ${coord.city}</div>` : ''}
            ${coord.state ? `<div><strong>State/Region:</strong> ${coord.state}</div>` : ''}
            <div><strong>GPS:</strong> ${finalLat.toFixed(4)}°N, ${Math.abs(finalLon).toFixed(4)}°${finalLon >= 0 ? 'E' : 'W'}</div>
            <div class="popup-role-badge ${isOrigin ? 'org' : isDestination ? 'dst' : 'mid'}">
              ${isOrigin ? '🟢 Shipment Origin' : isDestination ? '🔵 Delivery Destination' : '⚪ Transit Waypoint'}
            </div>
          </div>
        </div>
      `
      marker.bindPopup(popupHtml, { className: 'ct-leaflet-popup' })
      marker.bindTooltip(coord.label || item.name.replace(/_/g, ' '), {
        direction: 'top',
        offset: isIntermediate ? [0, -8] : [0, -18],
        className: 'ct-node-tooltip',
      })

      group.addLayer(marker)
    })

    // 3. Active Live Shipment Position Pulse Marker
    const rawLiveLoc = currentLocationObj || getNodeCoord(shipment?.currentLocation)
    if (rawLiveLoc && typeof rawLiveLoc.lat === 'number' && shipment?.currentLocation && !shipment.currentLocation.toLowerCase().includes('delivered')) {
      const valLive = validateCoordinate(rawLiveLoc.lat, rawLiveLoc.lon, shipment.id)
      if (valLive.valid) {
        validCoords.push({ lat: valLive.lat, lon: valLive.lon })

        const shipIcon = L.divIcon({
          className: 'ct-shipment-radar-marker',
          html: `
            <div class="shipment-radar-pulse">
              <div class="radar-wave"></div>
              <div class="radar-core">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 17l10-10 10 10M12 7v10"/></svg>
              </div>
              <span class="radar-label">${shipment.id}</span>
            </div>
          `,
          iconSize: [110, 32],
          iconAnchor: [55, 16],
        })

        const liveShipmentMarker = L.marker([valLive.lat, valLive.lon], {
          icon: shipIcon,
          zIndexOffset: 1000,
        })

        liveShipmentMarker.bindPopup(`
          <div class="ct-map-popup active-vessel">
            <div class="popup-header">
              <span class="popup-type-tag active-live">LIVE TELEMETRY</span>
              <span class="popup-status-badge">${shipment.status || 'IN TRANSIT'}</span>
            </div>
            <h4 class="popup-title">${shipment.id}</h4>
            <div class="popup-address-block">
              <strong>Current Telemetry Sector:</strong>
              <p>${rawLiveLoc.fullAddress || rawLiveLoc.label || shipment.currentLocation}</p>
            </div>
            <div class="popup-details">
              <div><strong>Destination ETA:</strong> ${shipment.eta || 'On Schedule'}</div>
              <div><strong>Priority:</strong> ${shipment.priority || 'Standard'}</div>
              <div><strong>AI Disruption Risk:</strong> ${shipment.risk || 'LOW'} (${shipment.riskScore || 20}/100)</div>
              <div><strong>GPS:</strong> ${valLive.lat.toFixed(4)}°N, ${Math.abs(valLive.lon).toFixed(4)}°${valLive.lon >= 0 ? 'E' : 'W'}</div>
            </div>
          </div>
        `)
        group.addLayer(liveShipmentMarker)
      }
    }

    // 4. Network-Wide Shipments Overlay (Distinguishable Shipment States & Risk Levels)
    if (showAllShipments && allShipments && Array.isArray(allShipments)) {
      allShipments.forEach((s) => {
        if (s.id === shipment?.id) return // Active shipment already has pulse marker
        const sLoc = getNodeCoord(s.currentLocation) || getNodeCoord(s.origin)
        if (!sLoc || typeof sLoc.lat !== 'number') return
        const valS = validateCoordinate(sLoc.lat, sLoc.lon, s.id)
        if (!valS.valid) return

        const riskLevel = (s.risk || 'LOW').toUpperCase()
        const riskColor =
          riskLevel === 'CRITICAL'
            ? '#ef4444'
            : riskLevel === 'HIGH'
            ? '#f97316'
            : riskLevel === 'MEDIUM'
            ? '#eab308'
            : '#10b981'

        const otherIcon = L.divIcon({
          className: 'ct-other-shipment-marker',
          html: `<div class="other-shipment-dot" style="background: ${riskColor}; box-shadow: 0 0 8px ${riskColor};" title="${s.id}"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        })

        const otherMarker = L.marker([valS.lat, valS.lon], { icon: otherIcon })
        otherMarker.bindTooltip(
          `<strong>${s.id}</strong><br/>${s.origin?.split(',')[0]} → ${s.destination?.split(',')[0]}<br/>Status: ${s.status}<br/>Risk: <span style="color:${riskColor};font-weight:700;">${riskLevel}</span>`,
          { direction: 'top', offset: [0, -8], className: 'ct-node-tooltip' }
        )
        otherMarker.on('click', () => {
          if (onSelectShipment) onSelectShipment(s.id)
        })
        group.addLayer(otherMarker)
      })
    }

    // 5. Smart Camera Zoom
    const currentKey = `${shipment?.id || ''}_${(displayedNodeItems || []).map((d) => d.name).join('-')}_${criterion || ''}_${(recPolylinePoints || []).length}_${showAllShipments}_${hasValidEndpoints}`
    if (lastFitKeyRef.current !== currentKey) {
      lastFitKeyRef.current = currentKey
      if (hasValidEndpoints) {
        const pointsToFit = (recPolylinePoints && recPolylinePoints.length >= 2)
          ? recPolylinePoints
          : (currentPolylinePoints && currentPolylinePoints.length >= 2)
          ? currentPolylinePoints
          : validCoords
        if (pointsToFit && pointsToFit.length > 0) {
          fitMapToRoute(map, pointsToFit, true)
        }
      }
    }
  }, [
    geometryPoints,
    recNodesWithCoords,
    currentNodesWithCoords,
    isIdenticalRoute,
    origCoord,
    destCoord,
    route,
    criterion,
    alternativeRoute,
    shipment,
    allShipments,
    showAllShipments,
    onSelectShipment,
    currentLocationObj,
    getNodeCoord,
  ])

  return (
    <div className="demo-map real-leaflet-map" aria-label="Live Supply Chain Geographic Route Map">
      {/* Real Geographic Leaflet Map Canvas */}
      <div ref={mapContainerRef} className="leaflet-map-canvas" />

      {/* Top Left Status Badge */}
      <div className={`map-badge ${routeStyle.badgeClass || ''}`}>
        <span
          className="map-live-dot"
          style={{
            background: routeStyle.glowColor || '#10b981',
            boxShadow: `0 0 8px ${routeStyle.glowColor || '#10b981'}`,
          }}
        />
        <span className="map-badge-title">
          {routeStyle.objectiveLabel || (route?.algorithm ? 'NETWORKX DIJKSTRA MAP' : 'LIVE ROUTE VIEW')}
        </span>
        {route?.total_distance_km ? (
          <span className="map-badge-metric">
            · {Math.round(route.total_distance_km).toLocaleString()} km
          </span>
        ) : null}
        {(route?.total_time_hours || route?.estimated_time_hours) ? (
          <span className="map-badge-metric">
            · {Math.round(route.total_time_hours || route.estimated_time_hours)} hrs
          </span>
        ) : null}
        {isRoadLoading ? (
          <span className="map-geo-status loading">
            <Loader2 size={10} className="loading-spin" /> Road Geometry
          </span>
        ) : hasRealRoadGeometry ? (
          <span className="map-geo-status ready">
            <Zap size={10} /> Road Geometry
          </span>
        ) : null}
      </div>

      {/* Top Right GPS Telemetry Overlay */}
      <div className="map-coordinates">
        GPS TELEMETRY
        <span>
          {origCoord && origCoord.lat ? (
            <>
              LAT {origCoord.lat.toFixed(2)}° N / LNG {Math.abs(origCoord.lon).toFixed(2)}°{' '}
              {origCoord.lon >= 0 ? 'E' : 'W'}
            </>
          ) : (
            'CORRIDOR TELEMETRY'
          )}{' '}
          · ZOOM {currentZoom}X
        </span>
      </div>

      {/* Floating Control Tower Map Actions Toolbar */}
      <div className="map-floating-controls">
        <button
          type="button"
          className="map-control-btn"
          title="Fit Route Corridor to View"
          onClick={handleFitRoute}
        >
          <LocateFixed size={14} />
        </button>
        <button
          type="button"
          className="map-control-btn"
          title="Center on Active Shipment"
          onClick={handleFitShipment}
        >
          <Crosshair size={14} />
        </button>
        <button
          type="button"
          className={`map-control-btn ${showAllShipments ? 'active' : ''}`}
          title="Toggle Fleet Shipment Markers Overlay"
          onClick={() => setShowAllShipments(!showAllShipments)}
        >
          <Layers size={14} />
        </button>
        <button
          type="button"
          className="map-control-btn"
          title="Zoom In"
          onClick={() => mapInstanceRef.current?.zoomIn()}
        >
          <ZoomIn size={14} />
        </button>
        <button
          type="button"
          className="map-control-btn"
          title="Zoom Out"
          onClick={() => mapInstanceRef.current?.zoomOut()}
        >
          <ZoomOut size={14} />
        </button>
        <div className="map-style-toggles">
          <button
            type="button"
            className={`map-style-btn ${mapStyle === 'voyager' ? 'active' : ''}`}
            title="Logistics Control Tower View"
            onClick={() => switchMapStyle('voyager')}
          >
            Voyager
          </button>
          <button
            type="button"
            className={`map-style-btn ${mapStyle === 'dark' ? 'active' : ''}`}
            title="Dark Operations Room View"
            onClick={() => switchMapStyle('dark')}
          >
            Dark
          </button>
          <button
            type="button"
            className={`map-style-btn ${mapStyle === 'osm' ? 'active' : ''}`}
            title="OpenStreetMap Standard"
            onClick={() => switchMapStyle('osm')}
          >
            OSM
          </button>
        </div>
      </div>

      {/* Location Resolution Warning / Clean Fallback Message */}
      {(!origCoord || !destCoord) && shipment && (
        <div className="unresolved-location-banner error-state">
          <AlertCircle size={15} />
          <div className="unresolved-text">
            <strong>Route Coordinates Unresolved</strong>
            <p>
              {!origCoord && !destCoord
                ? `Coordinates for both Origin "${shipment.origin}" and Destination "${shipment.destination}" are currently unavailable.`
                : !origCoord
                ? `Origin coordinates for "${shipment.origin}" could not be resolved.`
                : `Destination coordinates for "${shipment.destination}" could not be resolved.`}
              {' '}Fallback global route suppressed to maintain real map fidelity.
            </p>
          </div>
        </div>
      )}

      {/* Map Legend */}
      <div className="map-legend">
        <span>
          <i
            className="legend-current"
            style={{
              background: routeStyle.lineColor,
              boxShadow: `0 0 8px ${routeStyle.glowColor}`,
            }}
          />{' '}
          {routeStyle.objectiveLabel}
        </span>
        {!isIdenticalRoute && (
          <span>
            <i className="legend-alt" /> Baseline Corridor
          </span>
        )}
        <span>
          <span className="legend-node-dot" /> Logistics Hub
        </span>
        <span>
          <span className="legend-live-dot" /> Live Shipment
        </span>
      </div>

      {/* Map Scale & Corridor Modes Footer */}
      <div className="map-scale">
        <Route size={14} />
        {origCoord?.label || shipment?.origin?.split(',')[0] || 'Origin'}
        <span>→</span>
        {route?.transport_modes?.map((m) => (
          <span key={m} className="mode-badge" title={`Transport Mode: ${m}`}>
            {getModeIcon(m)} {m}
          </span>
        ))}
        {route?.total_distance_km && (
          <span className="corridor-stat">{Math.round(route.total_distance_km).toLocaleString()} km</span>
        )}
        {route?.total_time_hours && (
          <span className="corridor-stat">{Math.round(route.total_time_hours)} hrs</span>
        )}
        <span>→</span>
        {destCoord?.label || shipment?.destination?.split(',')[0] || 'Destination'}
      </div>
    </div>
  )
}

export default DemoMap
