import {
  AlertTriangle,
  Check,
  Compass,
  LocateFixed,
  RefreshCw,
  Route,
  ShieldAlert,
  Sliders,
  TrendingDown,
  Truck,
  Zap,
  Loader2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { getAlternativeRoute, getShipments, predictRisk } from '../services/api.js'
import DemoMap from '../components/DemoMap.jsx'
import { geocodeAddress } from '../services/geocoding.js'
import './LiveMap.css'

function LiveMap() {
  const [shipments, setShipments] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [criterion, setCriterion] = useState('risk_adjusted')
  const [feedback, setFeedback] = useState('')
  const [route, setRoute] = useState(null)
  const [risk, setRisk] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [error, setError] = useState('')

  // Geocoded structured address state for current shipment endpoints
  const [originLocation, setOriginLocation] = useState(null)
  const [destinationLocation, setDestinationLocation] = useState(null)
  const [currentLocationObj, setCurrentLocationObj] = useState(null)
  const [addressLoading, setAddressLoading] = useState(false)

  // Continuous Real-Time Disruption & Route Monitoring
  const [monitoringActive, setMonitoringActive] = useState(true)
  const [lastChecked, setLastChecked] = useState(null)
  const [pendingRecommendation, setPendingRecommendation] = useState(null)
  const [isPolling, setIsPolling] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const loaded = await getShipments()
      setShipments(loaded)
      setSelectedId((current) => current || loaded[0]?.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const shipment = shipments.find(({ id }) => id === selectedId) ?? shipments[0]

  // Address Resolution Hook: Resolves Origin, Destination, and Current Location whenever shipment changes
  useEffect(() => {
    if (!shipment?.origin || !shipment?.destination) return

    const controller = new AbortController()
    let isMounted = true
    setAddressLoading(true)

    async function resolveAddresses() {
      try {
        const [orig, dest, curr] = await Promise.all([
          geocodeAddress(shipment.origin, controller.signal),
          geocodeAddress(shipment.destination, controller.signal),
          shipment.currentLocation && !shipment.currentLocation.toLowerCase().includes('in transit')
            ? geocodeAddress(shipment.currentLocation, controller.signal)
            : Promise.resolve(null),
        ])

        if (!isMounted) return

        setOriginLocation(orig)
        setDestinationLocation(dest)
        setCurrentLocationObj(curr)
      } catch (_err) {
        // Safe fallback
      } finally {
        if (isMounted) {
          setAddressLoading(false)
        }
      }
    }

    resolveAddresses()

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [shipment?.id, shipment?.origin, shipment?.destination, shipment?.currentLocation])

  // Route Continuous Monitoring & Telemetry Re-evaluation Hook
  useEffect(() => {
    if (!shipment?.id || !monitoringActive) return

    let isMounted = true
    let pollingTimer = null

    const checkRouteTelemetrics = async (isManual = false) => {
      if (!isMounted) return
      if (!isManual) setIsPolling(true)

      try {
        const latestRoute = await getAlternativeRoute(shipment.id, criterion)
        if (!isMounted) return
        setLastChecked(new Date())

        setRoute((activeRoute) => {
          if (!activeRoute) {
            return latestRoute
          }

          const currentPathStr = (activeRoute.recommended_route || []).join(' → ')
          const newPathStr = (latestRoute.recommended_route || []).join(' → ')
          const currentRisk = activeRoute.route_risk_after ?? activeRoute.average_risk_weight ?? 1.0
          const newRisk = latestRoute.route_risk_after ?? latestRoute.average_risk_weight ?? 1.0
          const currentCost = activeRoute.total_cost ?? 0
          const newCost = latestRoute.total_cost ?? 0

          const pathDiffers = currentPathStr !== newPathStr
          const isStrictlySafer =
            pathDiffers &&
            (newRisk < currentRisk - 0.005 ||
              (latestRoute.is_strictly_safer && newRisk <= currentRisk) ||
              (criterion === 'risk_adjusted' && newCost < currentCost - 0.1))

          if (isStrictlySafer) {
            setPendingRecommendation({
              newRoute: latestRoute,
              previousRouteRisk: currentRisk,
              newRouteRisk: newRisk,
              riskReduction: Math.max(0, currentRisk - newRisk),
              reason: latestRoute.decision_reason || latestRoute.reason,
              newPath: latestRoute.recommended_route,
              previousPath: activeRoute.recommended_route,
            })
            return activeRoute
          } else {
            return latestRoute
          }
        })
      } catch (err) {
        console.warn('Continuous route telemetry check failed:', err)
      } finally {
        if (isMounted) setIsPolling(false)
      }
    }

    checkRouteTelemetrics(true)

    pollingTimer = setInterval(() => {
      checkRouteTelemetrics(false)
    }, 15000)

    return () => {
      isMounted = false
      if (pollingTimer) clearInterval(pollingTimer)
    }
  }, [shipment?.id, criterion, monitoringActive])

  if (loading) {
    return (
      <div className="page-loading">
        <RefreshCw size={20} className="loading-spin" /> Loading map shipments...
      </div>
    )
  }

  if (error && shipments.length === 0) {
    return (
      <div className="page-error">
        <AlertTriangle size={22} />
        <h1>Unable to load live map.</h1>
        <p>{error}</p>
        <button className="primary-button" onClick={load}>
          <RefreshCw size={15} /> Retry
        </button>
      </div>
    )
  }

  const handleCriterionChange = async (newCriterion) => {
    setCriterion(newCriterion)
    setPendingRecommendation(null)
    if (!shipment?.id) return
    setActionLoading('route')
    setError('')
    try {
      const latestRoute = await getAlternativeRoute(shipment.id, newCriterion)
      setRoute(latestRoute)
      setFeedback(`Dijkstra optimal route calculated under ${newCriterion.replace('_', ' ')} criterion`)
    } catch (err) {
      console.warn('Failed to calculate route for criterion:', err)
    } finally {
      setActionLoading('')
    }
  }

  const runRisk = async () => {
    setActionLoading('risk')
    setError('')
    try {
      const result = await predictRisk(shipment.id)
      setRisk(result)
      setFeedback(`Risk analyzed: Score ${result.risk_score}/100 (${result.risk_level}) via XGBoost`)
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  const findRoute = async () => {
    setActionLoading('route')
    setError('')
    try {
      const result = await getAlternativeRoute(shipment.id, criterion)
      setRoute(result)
      setFeedback(`Dijkstra optimal route calculated under ${criterion.replace('_', ' ')} criterion`)
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  const track = () => {
    setFeedback(`Tracking shipment ${shipment.id} active coordinates`)
  }

  const getRiskBadgeClass = (riskLevel) => {
    switch (riskLevel?.toUpperCase()) {
      case 'CRITICAL':
        return 'critical'
      case 'HIGH':
        return 'high'
      case 'MEDIUM':
        return 'medium'
      case 'LOW':
      default:
        return 'low'
    }
  }

  return (
    <div className="live-map-page">
      <section className="map-page-intro">
        <div>
          <span className="eyebrow">Network visibility & routing</span>
          <h1>Live Map & Route Optimization</h1>
          <p>Real-time multimodal topology, risk-aware corridor analysis, and Dijkstra shortest path routing.</p>
        </div>

        <div className="map-controls-header-group">
          {/* Shipment Selector */}
          <label className="map-selector">
            <span className="selector-prefix">Shipment:</span>
            <span className="sr-only">Select shipment</span>
            <select
              value={selectedId}
              onChange={(event) => {
                setSelectedId(event.target.value)
                setFeedback('')
                setRoute(null)
                setRisk(null)
              }}
            >
              {shipments.map(({ id, origin, destination }) => (
                <option key={id} value={id}>
                  {id} · {origin.split(',')[0]} to {destination.split(',')[0]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error && (
        <div className="inline-error">
          <AlertTriangle size={15} /> {error}
          <button onClick={load}>Retry</button>
        </div>
      )}

      <section className="map-workspace">
        <DemoMap
          shipment={shipment}
          route={route}
          criterion={criterion}
          alternativeRoute={Boolean(route)}
          originLocation={originLocation}
          destinationLocation={destinationLocation}
          currentLocationObj={currentLocationObj}
        />

        <aside className="map-info-panel">
          <div className="map-panel-heading">
            <div>
              <span className="eyebrow">Selected shipment</span>
              <h2>{shipment.id}</h2>
            </div>
            <span className={`map-risk ${getRiskBadgeClass(risk?.risk_level ?? shipment.risk)}`}>
              <span /> {risk?.risk_level ?? shipment.risk}
            </span>
          </div>

          <div className="map-status">
            <span className="status-check">
              <Check size={14} />
            </span>
            <div>
              <strong>{shipment.status}</strong>
              <small>Route status · {shipment.priority || 'Standard'} Priority</small>
            </div>
          </div>

          {/* Guaranteed Address Display + Geographic Coordinate Resolution */}
          <div className="shipment-locations-section">
            {/* ORIGIN */}
            <div className="location-item origin-item">
              <div className="location-item-header">
                <span className="location-badge org-badge">ORIGIN</span>
                {addressLoading && <Loader2 size={10} className="loading-spin" />}
              </div>
              <div className="location-raw-name">{shipment.origin}</div>
              {originLocation && typeof originLocation.lat === 'number' ? (
                <div className="location-resolved-meta">
                  <span className="resolved-text">📍 {originLocation.fullAddress || originLocation.label}</span>
                  <span className="gps-text">
                    GPS: {originLocation.lat.toFixed(4)}°N, {Math.abs(originLocation.lon).toFixed(4)}°{originLocation.lon >= 0 ? 'E' : 'W'}
                  </span>
                </div>
              ) : (
                <div className="location-unresolved-meta">
                  <span>⚠️ Map coordinates unavailable</span>
                </div>
              )}
            </div>

            {/* DESTINATION */}
            <div className="location-item dest-item">
              <div className="location-item-header">
                <span className="location-badge dst-badge">DESTINATION</span>
                {addressLoading && <Loader2 size={10} className="loading-spin" />}
              </div>
              <div className="location-raw-name">{shipment.destination}</div>
              {destinationLocation && typeof destinationLocation.lat === 'number' ? (
                <div className="location-resolved-meta">
                  <span className="resolved-text">📍 {destinationLocation.fullAddress || destinationLocation.label}</span>
                  <span className="gps-text">
                    GPS: {destinationLocation.lat.toFixed(4)}°N, {Math.abs(destinationLocation.lon).toFixed(4)}°{destinationLocation.lon >= 0 ? 'E' : 'W'}
                  </span>
                </div>
              ) : (
                <div className="location-unresolved-meta">
                  <span>⚠️ Map coordinates unavailable</span>
                </div>
              )}
            </div>

            {/* CURRENT LOCATION */}
            <div className="location-item telemetry-item">
              <div className="location-item-header">
                <span className="location-badge live-badge">CURRENT LOCATION</span>
              </div>
              <div className="location-raw-name">{shipment.currentLocation}</div>
              {currentLocationObj && typeof currentLocationObj.lat === 'number' ? (
                <div className="location-resolved-meta">
                  <span className="resolved-text">📡 {currentLocationObj.fullAddress || currentLocationObj.label}</span>
                  <span className="gps-text">
                    GPS: {currentLocationObj.lat.toFixed(4)}°N, {Math.abs(currentLocationObj.lon).toFixed(4)}°{currentLocationObj.lon >= 0 ? 'E' : 'W'}
                  </span>
                </div>
              ) : (
                <div className="location-unresolved-meta">
                  <span>📡 Telemetry Sector: {shipment.currentLocation}</span>
                </div>
              )}
            </div>
          </div>

          <dl className="map-details">
            <div>
              <dt>Estimated ETA</dt>
              <dd>{shipment.eta}</dd>
            </div>
            <div>
              <dt>AI Disruption Risk Score</dt>
              <dd className="risk-score-dd">
                <strong>{risk?.risk_score ?? shipment.riskScore}</strong> / 100
                <small> ({risk?.risk_level ?? shipment.risk})</small>
              </dd>
            </div>
          </dl>

          {/* Criterion Selection Tabs */}
          <div className="routing-criterion-selector">
            <span className="criterion-label">
              <Sliders size={12} /> Optimization Objective:
            </span>
            <div className="criterion-pill-group">
              <button
                type="button"
                className={`criterion-pill ${criterion === 'risk_adjusted' ? 'active' : ''}`}
                onClick={() => handleCriterionChange('risk_adjusted')}
              >
                <ShieldAlert size={12} /> Risk-Adjusted
              </button>
              <button
                type="button"
                className={`criterion-pill ${criterion === 'time' ? 'active' : ''}`}
                onClick={() => handleCriterionChange('time')}
              >
                <Zap size={12} /> Fastest Time
              </button>
              <button
                type="button"
                className={`criterion-pill ${criterion === 'distance' ? 'active' : ''}`}
                onClick={() => handleCriterionChange('distance')}
              >
                <Compass size={12} /> Shortest
              </button>
            </div>
          </div>

          {/* Route Continuous Monitoring Status Bar */}
          <div className="monitoring-status-bar">
            <div className="monitoring-status-indicator">
              <span className={`pulse-dot ${monitoringActive ? 'active' : 'paused'}`} />
              <span className="monitoring-status-text">
                {monitoringActive ? 'Continuous Route Monitoring' : 'Monitoring Paused'}
              </span>
              {isPolling && <RefreshCw size={10} className="loading-spin polling-icon" />}
            </div>
            <div className="monitoring-meta">
              <span className="last-checked">
                {lastChecked ? `${lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Live'}
              </span>
              <button
                type="button"
                className="monitoring-toggle-btn"
                onClick={() => setMonitoringActive(!monitoringActive)}
                title={monitoringActive ? 'Pause Auto-Monitoring' : 'Resume Auto-Monitoring'}
              >
                {monitoringActive ? 'Pause' : 'Resume'}
              </button>
            </div>
          </div>

          <div className="map-actions">
            <button
              onClick={findRoute}
              disabled={Boolean(actionLoading)}
              className="primary-map-action"
            >
              <Route size={15} />
              {actionLoading === 'route' ? 'Calculating Dijkstra path...' : 'Find Alternative Route'}
            </button>
            <button onClick={runRisk} disabled={Boolean(actionLoading)}>
              <ShieldAlert size={15} />
              {actionLoading === 'risk' ? 'Analyzing risk...' : 'Analyze Risk (XGBoost)'}
            </button>
            <button onClick={track}>
              <LocateFixed size={15} /> Live Coordinates
            </button>
          </div>

          {/* Dynamic Safer Route Auto-Recommendation Banner */}
          {pendingRecommendation && (
            <div className="new-safer-route-alert">
              <div className="safer-alert-header">
                <div className="safer-alert-title">
                  <Zap size={14} className="safer-alert-pulse" />
                  <strong>NEW SAFER ROUTE DETECTED</strong>
                </div>
                <span className="safer-risk-reduction">
                  ↓ {pendingRecommendation.riskReduction > 0 ? `${pendingRecommendation.riskReduction.toFixed(2)}x` : 'Improved'} Safer
                </span>
              </div>

              <p className="safer-alert-reason">
                {pendingRecommendation.reason}
              </p>

              <div className="safer-route-path-diff">
                <div className="diff-item">
                  <span className="diff-tag">Current:</span>
                  <span className="diff-path">{pendingRecommendation.previousPath?.join(' → ')}</span>
                  <span className="diff-risk">({pendingRecommendation.previousRouteRisk?.toFixed(2)}x)</span>
                </div>
                <div className="diff-item new">
                  <span className="diff-tag">Safer:</span>
                  <span className="diff-path">{pendingRecommendation.newPath?.join(' → ')}</span>
                  <span className="diff-risk">({pendingRecommendation.newRouteRisk?.toFixed(2)}x)</span>
                </div>
              </div>

              <div className="safer-alert-actions">
                <button
                  type="button"
                  className="apply-safer-btn"
                  onClick={() => {
                    setRoute(pendingRecommendation.newRoute)
                    setPendingRecommendation(null)
                    setFeedback(`Applied safer route recommendation: ${pendingRecommendation.newPath?.join(' → ')}`)
                  }}
                >
                  <Check size={12} /> Apply New Route
                </button>
                <button
                  type="button"
                  className="dismiss-safer-btn"
                  onClick={() => setPendingRecommendation(null)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Real Dijkstra Route Optimization Information Card */}
          {route && (
            <div className={`route-result-card ${criterion === 'risk_adjusted' ? 'risk-adjusted-mode' : ''}`}>
              <div className="route-result-header">
                <div className="route-header-title">
                  <Route size={14} className="route-header-icon" />
                  <strong>
                    {criterion === 'risk_adjusted'
                      ? 'REAL-TIME RISK-AWARE OPTIMAL ROUTE'
                      : criterion === 'distance'
                      ? 'SHORTEST DISTANCE OPTIMAL ROUTE'
                      : 'FASTEST TIME OPTIMAL ROUTE'}
                  </strong>
                </div>

                <div className="route-header-badges">
                  {route.is_mock_fallback_used ? (
                    <span className="telemetry-badge mock" title="Mock fallback data used">MOCK</span>
                  ) : (
                    <span className="telemetry-badge live" title="Live telemetry data used">LIVE</span>
                  )}
                  <span className={`route-risk-badge ${getRiskBadgeClass(route.route_risk_level || 'LOW')}`}>
                    {route.route_risk_level || 'LOW'} RISK
                  </span>
                </div>
              </div>

              {/* Dynamic Risk Comparison Section */}
              {criterion === 'risk_adjusted' && route.route_risk_before !== undefined && (
                <div className="route-risk-intel-banner">
                  <div className="intel-header">
                    <span className="intel-title">
                      <ShieldAlert size={12} /> ML Risk: {route.ml_risk_score ?? (risk?.risk_score ?? shipment.riskScore)}/100 — {route.ml_risk_level ?? (risk?.risk_level ?? shipment.risk)}
                    </span>
                  </div>

                  <div className="risk-comparison-grid">
                    <div className="risk-compare-box">
                      <span className="risk-compare-label">Baseline Route Risk</span>
                      <strong className="risk-compare-val before">
                        {route.route_risk_before ? `${route.route_risk_before.toFixed(2)}x` : '1.00x'}
                      </strong>
                    </div>
                    <div className="risk-compare-divider">→</div>
                    <div className="risk-compare-box recommended">
                      <span className="risk-compare-label">Optimal Route Risk</span>
                      <strong className="risk-compare-val after">
                        {route.route_risk_after ? `${route.route_risk_after.toFixed(2)}x` : `${route.average_risk_weight?.toFixed(2)}x`}
                      </strong>
                      {route.route_risk_after && route.route_risk_before && route.route_risk_after < route.route_risk_before - 0.005 ? (
                        <span className="risk-reduction-pill">↓ {(route.route_risk_before - route.route_risk_after).toFixed(2)}x safer</span>
                      ) : (
                        <span className="risk-neutral-pill">Optimal Resilient Path</span>
                      )}
                    </div>
                  </div>

                  {/* Disruption Counts Summary */}
                  {route.external_disruptions_considered && (
                    <div className="live-disruptions-summary">
                      <div className="disruption-count-item">
                        <span className="disruption-icon">⛅</span>
                        <span>Weather: <strong>{route.weather_disruption_count || 0}</strong></span>
                      </div>
                      <div className="disruption-count-item">
                        <span className="disruption-icon">⚓</span>
                        <span>Port: <strong>{route.port_disruption_count || 0}</strong></span>
                      </div>
                      <div className="disruption-count-item">
                        <span className="disruption-icon">🚚</span>
                        <span>Traffic: <strong>{route.traffic_disruption_count || 0}</strong></span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="route-comparison">
                <div className="route-comparison-row">
                  <span className="route-label current-lbl">Primary Corridor:</span>
                  <span className="route-path-str current-str">
                    {route.current_route.join(' → ')}
                  </span>
                </div>
                <div className="route-comparison-row">
                  <span className="route-label recommended-lbl">Optimal Path:</span>
                  <span className="route-path-str recommended-str">
                    {route.recommended_route.join(' → ')}
                  </span>
                </div>
              </div>

              <div className="route-metrics-grid">
                <div className="route-metric-box">
                  <dt>Distance</dt>
                  <dd>{route.total_distance_km ? `${route.total_distance_km.toLocaleString()} km` : 'Calculated'}</dd>
                </div>
                <div className="route-metric-box">
                  <dt>Est. Duration</dt>
                  <dd>{route.estimated_time_hours ? `${route.estimated_time_hours} hrs` : 'Standard'}</dd>
                </div>
                <div className="route-metric-box">
                  <dt>Risk Factor</dt>
                  <dd>{route.average_risk_weight ? `${route.average_risk_weight}x` : '1.00x'}</dd>
                </div>
                <div className="route-metric-box">
                  <dt>Dijkstra Cost</dt>
                  <dd>{route.total_cost ? route.total_cost.toFixed(1) : 'Optimal'}</dd>
                </div>
              </div>

              {route.transport_modes && route.transport_modes.length > 0 && (
                <div className="route-modes-row">
                  <span className="modes-label">Modes:</span>
                  {route.transport_modes.map((mode) => (
                    <span key={mode} className="mode-pill">
                      {mode}
                    </span>
                  ))}
                </div>
              )}

              {/* Decision Reason Box */}
              <div className="route-reason-box">
                <TrendingDown size={13} className="reason-icon" />
                <p>{route.decision_reason || route.reason}</p>
              </div>

              {/* Data Sources Footer */}
              {route.data_sources && route.data_sources.length > 0 && (
                <div className="route-sources-footer">
                  <span className="sources-label">Sources:</span>
                  <span className="sources-list">{route.data_sources.join(' • ')}</span>
                </div>
              )}

              {route.segments && route.segments.length > 0 && (
                <div className="route-corridors-list">
                  <span className="corridors-title">Segment Corridors ({route.segments.length})</span>
                  <div className="corridor-items">
                    {route.segments.map((seg, idx) => (
                      <div key={`${seg.origin}-${seg.destination}-${idx}`} className="corridor-item">
                        <span className="corridor-hop">{idx + 1}</span>
                        <div className="corridor-info">
                          <strong>
                            {seg.origin} → {seg.destination}
                          </strong>
                          <small>
                            {seg.mode} · {seg.distance_km} km · {seg.base_time_hours} hrs · Risk {seg.risk_weight}x
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="route-algorithm-tag">
                <span>Algorithm:</span> <strong>{route.algorithm || 'NETWORKX_DIJKSTRA'}</strong>
              </div>
            </div>
          )}

          {feedback && (
            <div className="map-feedback">
              <Check size={14} /> {feedback}
            </div>
          )}

          <div className="map-panel-note">
            <Truck size={15} />
            <p>Full real-world address resolution powered by OpenStreetMap with NetworkX Dijkstra routing.</p>
          </div>
        </aside>
      </section>
    </div>
  )
}

export default LiveMap
