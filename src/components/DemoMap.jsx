import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Route,
  Anchor,
  Train,
  Truck,
  Plane,
  ZoomIn,
  ZoomOut,
  LocateFixed,
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

  if (distKm < 350) {
    return [
      [lat1, lon1],
      [lat2, lon2],
    ]
  }

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

// Fetch real road-following coordinates from public OSRM service with caching & timeout
async function fetchOsrmSegment(lat1, lon1, lat2, lon2, signal) {
  const cacheKey = `${lat1.toFixed(4)},${lon1.toFixed(4)}_${lat2.toFixed(4)},${lon2.toFixed(4)}`
  if (osrmGeometryCache.has(cacheKey)) {
    return osrmGeometryCache.get(cacheKey)
  }

  const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`
  try {
    const res = await fetch(url, { signal })
    if (!res.ok) return null
    const data = await res.json()
    if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates?.length) {
      const latLngs = data.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon])
      osrmGeometryCache.set(cacheKey, latLngs)
      return latLngs
    }
  } catch (_err) {
    return null
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

  const validNodes = nodesWithCoords.filter((n) => n && n.coord && typeof n.coord.lat === 'number')
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

  const validNodes = nodesWithCoords.filter((n) => n && n.coord && typeof n.coord.lat === 'number')
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
        fetchOsrmSegment(p1.lat, p1.lon, p2.lat, p2.lon, signal).then((roadPts) => {
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

  if (coords.length === 1) {
    map.flyTo([coords[0].lat, coords[0].lon], 11, { animate, duration: 0.6 })
    return
  }

  const lats = coords.map((c) => c.lat)
  const lons = coords.map((c) => c.lon)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)

  const latSpan = maxLat - minLat
  const lonSpan = maxLon - minLon
  const maxSpan = Math.max(latSpan, lonSpan)

  const bounds = L.latLngBounds(coords.map((c) => [c.lat, c.lon]))

  let targetMaxZoom = 4
  if (maxSpan < 0.3) {
    targetMaxZoom = 13
  } else if (maxSpan < 0.8) {
    targetMaxZoom = 11
  } else if (maxSpan < 1.8) {
    targetMaxZoom = 9
  } else if (maxSpan < 5.0) {
    targetMaxZoom = 8
  } else if (maxSpan < 15.0) {
    targetMaxZoom = 6
  } else {
    targetMaxZoom = 4
  }

  map.fitBounds(bounds, {
    padding: [50, 50],
    maxZoom: targetMaxZoom,
    animate,
    duration: 0.7,
  })
}

function DemoMap({
  shipment,
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
  const [isRoadLoading, setIsRoadLoading] = useState(false)
  const [hasRealRoadGeometry, setHasRealRoadGeometry] = useState(false)
  const [resolvedNodeMap, setResolvedNodeMap] = useState({})

  // 1. Raw Node Names for paths
  const rawRecommendedNames = useMemo(() => {
    return route?.recommended_route || (alternativeRoute ? ['Shanghai', 'Oakland', 'Los_Angeles', 'Long_Beach'] : null)
  }, [route?.recommended_route, alternativeRoute])

  const rawCurrentNames = useMemo(() => {
    return (
      route?.current_route ||
      [
        shipment?.origin?.split(',')[0] || 'Shanghai',
        shipment?.currentLocation && !shipment.currentLocation.toLowerCase().includes('in transit')
          ? shipment.currentLocation.split(',')[0]
          : null,
        shipment?.destination?.split(',')[0] || 'Long_Beach',
      ].filter(Boolean)
    )
  }, [route?.current_route, shipment])

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
    if (originLocation && originLocation.lat) return originLocation
    return getNodeCoord(shipment?.origin || rawCurrentNames[0])
  }, [originLocation, getNodeCoord, shipment?.origin, rawCurrentNames])

  const destCoord = useMemo(() => {
    if (destinationLocation && destinationLocation.lat) return destinationLocation
    return getNodeCoord(shipment?.destination || rawCurrentNames[rawCurrentNames.length - 1])
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

  // Polyline Geometry Points State (Dual-phase: synchronous baseline + async OSRM upgrade)
  const [geometryPoints, setGeometryPoints] = useState(() => ({
    current: buildSynchronousRoutePolyline(currentNodesWithCoords, route?.segments),
    recommended: recNodesWithCoords ? buildSynchronousRoutePolyline(recNodesWithCoords, route?.segments) : null,
  }))

  // Asynchronous OSRM Road Geometry Fetching Effect
  useEffect(() => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3500)

    let isMounted = true
    setIsRoadLoading(true)

    // Phase 1: Set synchronous baseline immediately
    const syncCurrent = buildSynchronousRoutePolyline(currentNodesWithCoords, route?.segments)
    const syncRec = recNodesWithCoords ? buildSynchronousRoutePolyline(recNodesWithCoords, route?.segments) : null
    setGeometryPoints({ current: syncCurrent, recommended: syncRec })

    // Phase 2: Fetch high-precision OSRM road geometry
    async function resolveHighPrecisionGeometry() {
      try {
        const [currentRes, recRes] = await Promise.all([
          buildAsynchronousRoutePolyline(currentNodesWithCoords, route?.segments, controller.signal),
          recNodesWithCoords
            ? buildAsynchronousRoutePolyline(recNodesWithCoords, route?.segments, controller.signal)
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
  }, [currentNodesWithCoords, recNodesWithCoords, route?.segments])

  // Initialize Leaflet Map Instance Once
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
        scrollWheelZoom: false, // Normal mouse scrolling scrolls webpage!
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

    const tileLayer = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }
    )
    tileLayer.addTo(map)

    const layersGroup = L.layerGroup().addTo(map)
    layersGroupRef.current = layersGroup
    mapInstanceRef.current = map

    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom())
    })

    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize()
      }
    })
    resizeObserver.observe(mapContainerRef.current)

    return () => {
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

    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer)
      }
    })

    let url = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
    let attr =
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>'

    if (style === 'dark') {
      url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    } else if (style === 'osm') {
      url = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
      attr = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
    }

    L.tileLayer(url, {
      attribution: attr,
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)
  }, [])

  // User explicitly clicks Fit Route
  const handleFitRoute = useCallback(() => {
    const map = mapInstanceRef.current
    if (!map) return

    const coordsToFit = []
    if (origCoord && origCoord.lat) coordsToFit.push(origCoord)
    if (destCoord && destCoord.lat) coordsToFit.push(destCoord)
    if (currentNodesWithCoords) {
      currentNodesWithCoords.forEach((n) => {
        if (n.coord && n.coord.lat) coordsToFit.push(n.coord)
      })
    }

    if (coordsToFit.length > 0) {
      fitMapToRoute(map, coordsToFit, true)
    }
  }, [origCoord, destCoord, currentNodesWithCoords])

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

    // 1. Draw Clean Route Polylines (Differentiating Optimal Route vs Alternative Route)
    if (isIdenticalRoute) {
      // Single Optimal Route
      if (currentPolylinePoints && currentPolylinePoints.length >= 2) {
        const singleGlow = L.polyline(currentPolylinePoints, {
          color: '#10b981',
          weight: 8,
          opacity: 0.22,
          lineCap: 'round',
          lineJoin: 'round',
        })
        group.addLayer(singleGlow)

        const singleLine = L.polyline(currentPolylinePoints, {
          color: '#059669',
          weight: 4.5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        })
        singleLine.bindTooltip(
          `Optimal Route · ${criterion ? criterion.replace('_', ' ').toUpperCase() : 'OPTIMAL'}`,
          { sticky: true, className: 'ct-route-tooltip optimal' }
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
        baselineLine.bindTooltip('Alternative Route (Baseline Corridor)', {
          sticky: true,
          className: 'ct-route-tooltip',
        })
        group.addLayer(baselineLine)
      }

      // Optimal Dijkstra Recommended Route (Dominant vibrant emerald line)
      if (recPolylinePoints && recPolylinePoints.length >= 2) {
        const recGlow = L.polyline(recPolylinePoints, {
          color: '#10b981',
          weight: 8,
          opacity: 0.25,
          lineCap: 'round',
          lineJoin: 'round',
        })
        group.addLayer(recGlow)

        const recLine = L.polyline(recPolylinePoints, {
          color: '#059669',
          weight: 5,
          opacity: 0.98,
          lineCap: 'round',
          lineJoin: 'round',
        })
        recLine.bindTooltip(
          `Optimal Route · ${criterion ? criterion.replace('_', ' ').toUpperCase() : 'DIJKSTRA RECOMMENDED'}`,
          { sticky: true, className: 'ct-route-tooltip optimal' }
        )
        group.addLayer(recLine)
      }
    }

    // 2. Place Clean Professional Markers
    const totalNodes = displayedNodeItems.length

    displayedNodeItems.forEach((item, idx) => {
      const coord = item.coord
      if (!coord || typeof coord.lat !== 'number') return

      validCoords.push(coord)

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

      const marker = L.marker([coord.lat, coord.lon], { icon: customIcon })

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
            <div><strong>GPS:</strong> ${coord.lat.toFixed(4)}°N, ${Math.abs(coord.lon).toFixed(4)}°${coord.lon >= 0 ? 'E' : 'W'}</div>
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
    const liveLocObj = currentLocationObj || getNodeCoord(shipment?.currentLocation)
    if (liveLocObj && liveLocObj.lat && shipment?.currentLocation && !shipment.currentLocation.toLowerCase().includes('delivered')) {
      validCoords.push(liveLocObj)

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

      const liveShipmentMarker = L.marker([liveLocObj.lat, liveLocObj.lon], {
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
            <p>${liveLocObj.fullAddress || liveLocObj.label || shipment.currentLocation}</p>
          </div>
          <div class="popup-details">
            <div><strong>Destination ETA:</strong> ${shipment.eta || 'On Schedule'}</div>
            <div><strong>Priority:</strong> ${shipment.priority || 'Standard'}</div>
            <div><strong>AI Disruption Risk:</strong> ${shipment.risk || 'LOW'} (${shipment.riskScore || 20}/100)</div>
            <div><strong>GPS:</strong> ${liveLocObj.lat.toFixed(4)}°N, ${Math.abs(liveLocObj.lon).toFixed(4)}°${liveLocObj.lon >= 0 ? 'E' : 'W'}</div>
          </div>
        </div>
      `)
      group.addLayer(liveShipmentMarker)
    }

    // 4. Smart Camera Zoom
    const currentKey = `${shipment?.id || ''}_${(displayedNodeItems || []).map((d) => d.name).join('-')}_${criterion || ''}`
    if (validCoords.length > 0 && lastFitKeyRef.current !== currentKey) {
      lastFitKeyRef.current = currentKey
      fitMapToRoute(map, validCoords, true)
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
    currentLocationObj,
    getNodeCoord,
  ])

  return (
    <div className="demo-map real-leaflet-map" aria-label="Live Supply Chain Geographic Route Map">
      {/* Real Geographic Leaflet Map Canvas */}
      <div ref={mapContainerRef} className="leaflet-map-canvas" />

      {/* Top Left Status Badge */}
      <div className="map-badge">
        <span className="map-live-dot" />
        {route?.algorithm ? 'NETWORKX DIJKSTRA MAP' : 'LIVE ROUTE VIEW'}
        {criterion && (
          <span className="criterion-indicator">
            · {criterion.replace('_', ' ').toUpperCase()}
          </span>
        )}
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
          title="Fit Route to View"
          onClick={handleFitRoute}
        >
          <LocateFixed size={14} />
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

      {/* Location Resolution Warning */}
      {(!origCoord || !destCoord) && (
        <div className="unresolved-location-banner">
          <AlertCircle size={13} />
          <span>
            Geocoding notice:{' '}
            {!origCoord ? `Origin "${shipment?.origin}"` : ''}
            {!origCoord && !destCoord ? ' and ' : ''}
            {!destCoord ? `Destination "${shipment?.destination}"` : ''} Location could not be resolved.
          </span>
        </div>
      )}

      {/* Map Legend */}
      <div className="map-legend">
        <span>
          <i className="legend-current" /> Optimal Route
        </span>
        {!isIdenticalRoute && (
          <span>
            <i className="legend-alt" /> Alternative Route
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
