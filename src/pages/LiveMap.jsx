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
  BrainCircuit,
  Network,
  Cpu,
  GitBranch,
  X,
  Play,
  Lightbulb
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { getAlternativeRoute, getShipments, predictRisk, predictGNNRisk, simulateWhatIf } from '../services/api.js'
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
  const [gnnRisk, setGnnRisk] = useState(null)
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

  // What-If Simulation Drawer State
  const [isWhatIfOpen, setIsWhatIfOpen] = useState(false)
  const [simMode, setSimMode] = useState('Ocean')
  const [simWeather, setSimWeather] = useState(35)
  const [simPort, setSimPort] = useState(60)
  const [simCustoms, setSimCustoms] = useState(0.25)
  const [simPriority, setSimPriority] = useState('Standard')
  const [simSlaDelta, setSimSlaDelta] = useState(0)
  const [simAvoidNodes, setSimAvoidNodes] = useState([])
  const [whatIfResult, setWhatIfResult] = useState(null)
  const [isSimulating, setIsSimulating] = useState(false)

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

  // Address Resolution Hook
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

  // Route Continuous Monitoring Hook
  useEffect(() => {
    if (!shipment?.id || !monitoringActive) return

    let isMounted = true
    let pollingTimer = null

    const checkRouteTelemetrics = async (isManual = false) => {
      if (!isMounted) return
      if (!isManual) setIsPolling(true)

      try {
        const [latestRoute, latestGnn] = await Promise.all([
          getAlternativeRoute(shipment.id, criterion),
          predictGNNRisk({ shipment_id: shipment.id }).catch(() => null)
        ])

        if (!isMounted) return
        setLastChecked(new Date())
        if (latestGnn) setGnnRisk(latestGnn)

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
      const [result, gnnRes] = await Promise.all([
        predictRisk(shipment.id),
        predictGNNRisk({ shipment_id: shipment.id }).catch(() => null)
      ])
      setRisk(result)
      if (gnnRes) setGnnRisk(gnnRes)
      setFeedback(`Dual-Model Analyzed: XGBoost ${result.risk_score}/100 | GNN ${gnnRes ? gnnRes.risk_score : 'N/A'}/100`)
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

  const runWhatIfSimulation = async () => {
    setIsSimulating(true)
    try {
      const payload = {
        shipment_id: shipment?.id,
        origin: shipment?.origin,
        destination: shipment?.destination,
        simulated_mode: simMode,
        weather_severity: Number(simWeather),
        port_congestion: Number(simPort),
        customs_risk: Number(simCustoms),
        priority_level: simPriority,
        sla_days_delta: Number(simSlaDelta),
        avoid_nodes: simAvoidNodes
      }
      const res = await simulateWhatIf(payload)
      setWhatIfResult(res)
    } catch (err) {
      console.error('What-If simulation failed:', err)
    } finally {
      setIsSimulating(false)
    }
  }

  const applyWhatIfRoute = () => {
    if (!whatIfResult?.simulated) return
    const sim = whatIfResult.simulated
    const formattedRoute = {
      shipment_id: shipment?.id,
      origin: whatIfResult.origin,
      destination: whatIfResult.destination,
      current_route: whatIfResult.baseline.path,
      recommended_route: sim.path,
      total_distance_km: sim.total_distance_km,
      estimated_time_hours: sim.estimated_time_hours,
      total_cost: sim.effective_cost,
      average_risk_weight: sim.fused_risk_score / 50.0,
      route_risk_level: sim.fused_risk_tier,
      transport_modes: sim.transport_modes,
      reason: whatIfResult.recommendation,
      algorithm: 'NETWORKX_DIJKSTRA_WHAT_IF',
      route_geometry: sim.route_geometry,
      ml_risk_score: sim.fused_risk_score,
      ml_risk_level: sim.fused_risk_tier,
      external_disruptions_considered: true
    }
    setRoute(formattedRoute)
    setIsWhatIfOpen(false)
    setFeedback(`Applied simulated scenario route: ${sim.path.join(' → ')}`)
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
      {/* Page Header */}
      <section className="map-page-intro">
        <div>
          <span className="eyebrow">NETWORK VISIBILITY & ROUTING</span>
          <h1>Live Map & Route Optimization</h1>
          <p>Real-time multimodal topology, risk-aware corridor analysis, and Dijkstra shortest path routing.</p>
        </div>
        <span className="live-tag">
          <BrainCircuit size={13} /> LIVE TELEMETRY
        </span>
      </section>

      {/* Clean Control Toolbar Above Map */}
      <div className="map-toolbar">
        {/* Control 1: Shipment Selector */}
        <div className="toolbar-item">
          <span className="toolbar-label">Shipment</span>
          <select
            className="toolbar-select"
            value={selectedId}
            onChange={(event) => {
              setSelectedId(event.target.value)
              setFeedback('')
              setRoute(null)
              setRisk(null)
              setGnnRisk(null)
              setWhatIfResult(null)
            }}
          >
            {shipments.map(({ id, origin, destination }) => (
              <option key={id} value={id}>
                {id} · {origin.split(',')[0]} → {destination.split(',')[0]}
              </option>
            ))}
          </select>
        </div>

        {/* Control 2: Route Objective Selector */}
        <div className="toolbar-item">
          <span className="toolbar-label">Route Objective</span>
          <div className="objective-pills">
            <button
              type="button"
              className={`obj-pill ${criterion === 'risk_adjusted' ? 'active' : ''}`}
              onClick={() => handleCriterionChange('risk_adjusted')}
            >
              <ShieldAlert size={12} /> Risk-Adjusted
            </button>
            <button
              type="button"
              className={`obj-pill ${criterion === 'time' ? 'active' : ''}`}
              onClick={() => handleCriterionChange('time')}
            >
              <Zap size={12} /> Fastest Time
            </button>
            <button
              type="button"
              className={`obj-pill ${criterion === 'distance' ? 'active' : ''}`}
              onClick={() => handleCriterionChange('distance')}
            >
              <Compass size={12} /> Shortest
            </button>
          </div>
        </div>

        {/* Control 3: What-If Simulator Button */}
        <button
          type="button"
          className={`what-if-btn ${isWhatIfOpen ? 'open' : ''}`}
          onClick={() => {
            setIsWhatIfOpen(!isWhatIfOpen)
            if (!whatIfResult) runWhatIfSimulation()
          }}
        >
          <Sliders size={14} /> What-If Scenario
        </button>
      </div>

      {error && (
        <div className="inline-error">
          <AlertTriangle size={15} /> {error}
          <button onClick={load}>Retry</button>
        </div>
      )}

      {/* What-If Simulation Drawer Modal */}
      {isWhatIfOpen && (
        <div className="what-if-drawer">
          <div className="what-if-header">
            <div className="what-if-title">
              <Sliders size={18} />
              <div>
                <strong>Operational What-If Scenario Simulator</strong>
                <p>Simulate mode shifts, weather surges, port congestion, customs inspections, and SLA tolerances in real-time.</p>
              </div>
            </div>
            <button type="button" className="close-drawer-btn" onClick={() => setIsWhatIfOpen(false)}>
              <X size={18} />
            </button>
          </div>

          <div className="what-if-body">
            {/* Left Controls */}
            <div className="what-if-controls">
              <div className="control-group">
                <label>Transport Mode</label>
                <div className="mode-select-row">
                  {['Road', 'Rail', 'Air', 'Ocean'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`mode-btn ${simMode === m ? 'active' : ''}`}
                      onClick={() => setSimMode(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="control-group">
                <label>
                  Weather Severity Index: <strong>{simWeather}/100</strong>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={simWeather}
                  onChange={(e) => setSimWeather(Number(e.target.value))}
                />
              </div>

              <div className="control-group">
                <label>
                  Port Congestion Index: <strong>{simPort}/100</strong>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={simPort}
                  onChange={(e) => setSimPort(Number(e.target.value))}
                />
              </div>

              <div className="control-group">
                <label>
                  Customs Inspection Risk: <strong>{(simCustoms * 100).toFixed(0)}%</strong>
                </label>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={simCustoms}
                  onChange={(e) => setSimCustoms(Number(e.target.value))}
                />
              </div>

              <div className="control-group">
                <label>
                  SLA Window Adjustment: <strong>{simSlaDelta >= 0 ? `+${simSlaDelta}` : simSlaDelta} Days</strong>
                </label>
                <input
                  type="range"
                  min="-3"
                  max="5"
                  value={simSlaDelta}
                  onChange={(e) => setSimSlaDelta(Number(e.target.value))}
                />
              </div>

              <div className="control-group">
                <label>Avoid Bottleneck Hubs</label>
                <div className="avoid-chips">
                  {['Tokyo', 'Long_Beach', 'Oakland', 'Chicago', 'Rotterdam', 'Dubai'].map((h) => {
                    const isAvoided = simAvoidNodes.includes(h)
                    return (
                      <button
                        key={h}
                        type="button"
                        className={`avoid-chip ${isAvoided ? 'avoided' : ''}`}
                        onClick={() => {
                          if (isAvoided) setSimAvoidNodes(simAvoidNodes.filter(n => n !== h))
                          else setSimAvoidNodes([...simAvoidNodes, h])
                        }}
                      >
                        {isAvoided ? '✖ ' : '+ '} {h}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button
                type="button"
                className="run-sim-btn"
                onClick={runWhatIfSimulation}
                disabled={isSimulating}
              >
                <Play size={14} /> {isSimulating ? 'Simulating Dijkstra & ML...' : 'Run Scenario Simulation'}
              </button>
            </div>

            {/* Right Comparison Results */}
            <div className="what-if-results">
              {whatIfResult ? (
                <div>
                  <div className="sim-delta-banner">
                    <div className="delta-stat">
                      <span>Risk Impact</span>
                      <strong className={whatIfResult.delta.risk_score_delta <= 0 ? 'good' : 'bad'}>
                        {whatIfResult.delta.risk_score_delta <= 0 ? '↓ ' : '↑ '}
                        {Math.abs(whatIfResult.delta.risk_score_delta)} pts
                      </strong>
                    </div>
                    <div className="delta-stat">
                      <span>Transit Duration</span>
                      <strong>
                        {whatIfResult.delta.time_delta_hours >= 0 ? `+${whatIfResult.delta.time_delta_hours}` : whatIfResult.delta.time_delta_hours} hrs
                      </strong>
                    </div>
                    <div className="delta-stat">
                      <span>Distance Variance</span>
                      <strong>
                        {whatIfResult.delta.distance_delta_km >= 0 ? `+${whatIfResult.delta.distance_delta_km}` : whatIfResult.delta.distance_delta_km} km
                      </strong>
                    </div>
                  </div>

                  <div className="sim-paths-grid">
                    <div className="sim-path-card baseline">
                      <span className="sim-badge base">BASELINE ROUTE</span>
                      <div className="sim-path-str">{whatIfResult.baseline.path.join(' → ')}</div>
                      <div className="sim-stats-mini">
                        <span>Time: {whatIfResult.baseline.estimated_time_hours}h</span>
                        <span>Risk: {whatIfResult.baseline.fused_risk_score}/100</span>
                      </div>
                    </div>

                    <div className="sim-path-card simulated">
                      <span className="sim-badge sim">SIMULATED OPTIMAL</span>
                      <div className="sim-path-str">{whatIfResult.simulated.path.join(' → ')}</div>
                      <div className="sim-stats-mini">
                        <span>Time: {whatIfResult.simulated.estimated_time_hours}h</span>
                        <span>Risk: {whatIfResult.simulated.fused_risk_score}/100 ({whatIfResult.simulated.fused_risk_tier})</span>
                      </div>
                    </div>
                  </div>

                  <div className="sim-rec-box">
                    <Lightbulb size={16} />
                    <p>{whatIfResult.recommendation}</p>
                  </div>

                  <div className="sim-actions">
                    <button type="button" className="apply-sim-btn" onClick={applyWhatIfRoute}>
                      <Check size={14} /> Apply Simulated Route to Live Map
                    </button>
                  </div>
                </div>
              ) : (
                <div className="sim-placeholder">
                  <Sliders size={32} />
                  <p>Adjust parameters and click <strong>Run Scenario Simulation</strong> to evaluate cognitive risk and route variance.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main 2-Column Map Workspace */}
      <section className="map-workspace">
        {/* Left: Actual Leaflet Map (approx 68% width) */}
        <div className="map-col-left">
          <DemoMap
            shipment={shipment}
            route={route}
            criterion={criterion}
            alternativeRoute={Boolean(route)}
            originLocation={originLocation}
            destinationLocation={destinationLocation}
            currentLocationObj={currentLocationObj}
          />
        </div>

        {/* Right: Shipment & Routing Action Panel (approx 32% width) */}
        <aside className="map-info-panel">
          <div className="map-panel-heading">
            <div>
              <span className="eyebrow">ACTIVE SHIPMENT</span>
              <h2>{shipment.id}</h2>
            </div>
            <span className={`map-risk ${getRiskBadgeClass(risk?.risk_level ?? shipment.risk)}`}>
              {risk?.risk_level ?? shipment.risk}
            </span>
          </div>

          <div className="map-status-card">
            <span className="status-check">
              <Check size={14} />
            </span>
            <div>
              <strong>{shipment.status}</strong>
              <small>{shipment.priority || 'Standard'} Priority · ETA {shipment.eta}</small>
            </div>
          </div>

          {/* Dual Model Disruption Badges */}
          <div className="dual-risk-strip">
            <div className="dual-risk-item">
              <span className="strip-label"><Cpu size={10} /> XGBoost Disruption</span>
              <strong className="strip-score">{risk?.risk_score ?? shipment.riskScore}/100</strong>
              <small>{risk?.risk_level ?? shipment.risk}</small>
            </div>
            <div className="dual-risk-item gnn-strip">
              <span className="strip-label"><Network size={10} /> GCN Network Risk</span>
              <strong className="strip-score">{gnnRisk?.risk_score ?? 68}/100</strong>
              <small>{gnnRisk?.risk_level ?? 'High'}</small>
            </div>
          </div>

          {/* Clean Origin -> Destination Summary */}
          <div className="route-endpoints-card">
            <div className="endpoint-item">
              <span className="endpoint-tag org">ORIGIN</span>
              <strong className="endpoint-name">{shipment.origin?.split(',')[0]}</strong>
              <span className="endpoint-sub">{shipment.origin}</span>
            </div>
            <div className="endpoint-arrow">↓</div>
            <div className="endpoint-item">
              <span className="endpoint-tag dst">DESTINATION</span>
              <strong className="endpoint-name">{shipment.destination?.split(',')[0]}</strong>
              <span className="endpoint-sub">{shipment.destination}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="map-actions">
            <button
              type="button"
              onClick={findRoute}
              disabled={Boolean(actionLoading)}
              className="primary-map-action"
            >
              <Route size={14} />
              {actionLoading === 'route' ? 'Calculating...' : 'Find Alternative Route'}
            </button>
            <div className="action-btn-row">
              <button type="button" onClick={runRisk} disabled={Boolean(actionLoading)}>
                <ShieldAlert size={13} /> {actionLoading === 'risk' ? 'Analyzing...' : 'Analyze Risk'}
              </button>
              <button type="button" onClick={track}>
                <LocateFixed size={13} /> Coordinates
              </button>
            </div>
          </div>

          {/* Dynamic Safer Route Recommendation Banner */}
          {pendingRecommendation && (
            <div className="new-safer-route-alert">
              <div className="safer-alert-header">
                <div className="safer-alert-title">
                  <Zap size={14} />
                  <strong>NEW SAFER ROUTE DETECTED</strong>
                </div>
                <span className="safer-risk-reduction">
                  ↓ {pendingRecommendation.riskReduction > 0 ? `${pendingRecommendation.riskReduction.toFixed(2)}x` : 'Improved'} Safer
                </span>
              </div>
              <p className="safer-alert-reason">{pendingRecommendation.reason}</p>
              <div className="safer-alert-actions">
                <button
                  type="button"
                  className="apply-safer-btn"
                  onClick={() => {
                    setRoute(pendingRecommendation.newRoute)
                    setPendingRecommendation(null)
                  }}
                >
                  <Check size={12} /> Apply Route
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

          {/* Route Calculation Result */}
          {route && (
            <div className="route-result-card">
              <div className="route-result-header">
                <span className="route-title">
                  <Route size={12} /> {(route.recommended_route || []).join(' → ')}
                </span>
              </div>
              <div className="route-stats-grid">
                <div className="route-stat">
                  <span>Distance</span>
                  <strong>{route.total_distance_km ? `${Math.round(route.total_distance_km).toLocaleString()} km` : '—'}</strong>
                </div>
                <div className="route-stat">
                  <span>Time</span>
                  <strong>{route.total_time_hours ? `${Math.round(route.total_time_hours)}h` : '—'}</strong>
                </div>
                <div className="route-stat">
                  <span>Risk Level</span>
                  <strong className="green-txt">{route.route_risk_level || 'LOW'}</strong>
                </div>
              </div>
            </div>
          )}
        </aside>
      </section>
    </div>
  )
}

export default LiveMap
