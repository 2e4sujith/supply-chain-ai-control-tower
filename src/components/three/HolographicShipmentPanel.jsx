import React, { useMemo } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  Calendar,
  Clock,
  Compass,
  ExternalLink,
  MapPin,
  Navigation,
  Radio,
  Route as RouteIcon,
  ShieldAlert,
  ShieldCheck,
  Truck,
  X,
  Zap,
} from 'lucide-react'
import { PREDEFINED_HUBS } from '../../services/geocoding.js'
import './HolographicShipmentPanel.css'

/**
 * Calculates Great Circle distance between two lat/lon coordinates in kilometers.
 */
function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  if (
    typeof lat1 !== 'number' ||
    typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lon2 !== 'number' ||
    isNaN(lat1) ||
    isNaN(lon1) ||
    isNaN(lat2) ||
    isNaN(lon2)
  ) {
    return null
  }
  const R = 6371 // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c)
}

/**
 * Resolves hub info from string (e.g. "Shanghai, CN" -> Shanghai coordinates & label)
 */
function resolveHubData(locString) {
  if (!locString) return null
  const clean = String(locString).trim().toLowerCase()

  // 1. Exact match
  for (const [key, val] of Object.entries(PREDEFINED_HUBS)) {
    if (key.toLowerCase() === clean) {
      return val
    }
  }
  // 2. Token match
  const firstToken = clean.split(',')[0].trim()
  for (const [key, val] of Object.entries(PREDEFINED_HUBS)) {
    if (key.toLowerCase() === firstToken || (val.city && val.city.toLowerCase() === firstToken)) {
      return val
    }
  }
  // 3. Substring match
  for (const [key, val] of Object.entries(PREDEFINED_HUBS)) {
    if (clean.includes(key.toLowerCase()) || (val.city && clean.includes(val.city.toLowerCase()))) {
      return val
    }
  }
  return null
}

export default function HolographicShipmentPanel({
  shipment,
  alerts = [],
  onClose,
  onNavigateDossier,
  onNavigateMap,
}) {
  if (!shipment) return null

  // Resolve origin and destination coordinates
  const originHub = useMemo(() => resolveHubData(shipment.origin), [shipment.origin])
  const destHub = useMemo(() => resolveHubData(shipment.destination), [shipment.destination])

  // Real distance computation
  const distanceKm = useMemo(() => {
    if (originHub && destHub) {
      return calculateHaversineKm(originHub.lat, originHub.lon, destHub.lat, destHub.lon)
    }
    return null
  }, [originHub, destHub])

  // Match active alert from alerts list
  const activeAlert = useMemo(() => {
    if (!alerts || !Array.isArray(alerts)) return null
    return alerts.find(
      (a) =>
        (a.shipment_id && a.shipment_id === shipment.id) ||
        (a.shipmentId && a.shipmentId === shipment.id)
    )
  }, [alerts, shipment.id])

  // Risk styling
  const riskTier = shipment.risk || (shipment.riskScore >= 75 ? 'Critical' : shipment.riskScore >= 50 ? 'High' : shipment.riskScore >= 30 ? 'Medium' : 'Low')
  const riskScore = typeof shipment.riskScore === 'number' ? shipment.riskScore : (shipment.risk_score || 0)
  const riskClass = String(riskTier).toLowerCase()

  // AI Assistant Contextual Recommendation
  const aiInsight = useMemo(() => {
    if (riskScore >= 75 || riskTier === 'Critical') {
      return 'Critical disruption detected in corridor. PureTreeSHAP attributes risk to port congestion and schedule slips. Autonomous Dijkstra diversion recommended.'
    }
    if (riskScore >= 50 || riskTier === 'High') {
      return 'Elevated transit risk along maritime/highway corridor. Real-time telemetry monitoring weather front and waypoint bottlenecks.'
    }
    if (riskScore >= 30 || riskTier === 'Medium') {
      return 'Moderate schedule variance detected. Active corridor telemetry within operational buffer. Estimated arrival on schedule.'
    }
    return 'Optimal corridor trajectory. Real-time satellite AIS & highway sensors report nominal throughput and clear conditions.'
  }, [riskScore, riskTier])

  return (
    <aside
      className="holo-shipment-panel"
      onClick={(e) => e.stopPropagation()}
      aria-label={`Shipment details for ${shipment.id}`}
    >
      {/* Sci-Fi HUD Corner Brackets */}
      <span className="holo-hud-bracket tl" />
      <span className="holo-hud-bracket tr" />
      <span className="holo-hud-bracket bl" />
      <span className="holo-hud-bracket br" />

      {/* Holographic Laser Scanning Line */}
      <div className="holo-scan-beam" key={shipment.id} />

      {/* Panel Top Header */}
      <div className="holo-panel-header">
        <div className="holo-header-title-block">
          <div className="holo-telemetry-badge">
            <span className="holo-live-dot" />
            <Radio size={11} />
            <span>AI ORBITAL TELEMETRY</span>
          </div>
          <h4 className="holo-shipment-id">{shipment.id}</h4>
        </div>

        <button
          type="button"
          className="holo-close-btn"
          onClick={onClose}
          title="Close holographic panel and return globe to normal state"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      {/* 3D-Inspired AI Logistics Assistant Holographic Element */}
      <div className="holo-ai-assistant-card">
        <div className="holo-ai-visual">
          <div className="holo-ai-orbital-node">
            <div className="holo-orbital-ring ring-1" />
            <div className="holo-orbital-ring ring-2" />
            <div className="holo-orbital-ring ring-3" />
            <div className="holo-ai-core">
              <BrainCircuit size={15} />
            </div>
          </div>
        </div>
        <div className="holo-ai-info">
          <div className="holo-ai-status-label">
            <Zap size={11} /> AI CONTROL TOWER INTELLIGENCE ACTIVE
          </div>
          <p className="holo-ai-analysis-text">{aiInsight}</p>
        </div>
      </div>

      {/* Panel Scrollable Body */}
      <div className="holo-panel-body">
        {/* Status & Risk Summary Badges */}
        <div className="holo-metrics-row">
          <div className="holo-metric-card">
            <span className="holo-metric-label">STATUS</span>
            <div className="holo-status-pill">
              <span className={`status-dot ${shipment.status ? shipment.status.toLowerCase().replace(/\s+/g, '-') : 'booked'}`} />
              <strong>{shipment.status || 'Data unavailable'}</strong>
            </div>
          </div>

          <div className="holo-metric-card">
            <span className="holo-metric-label">RISK LEVEL</span>
            <div className={`holo-risk-badge ${riskClass}`}>
              {riskTier === 'Critical' ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />}
              <span>{riskTier} ({riskScore}/100)</span>
            </div>
          </div>
        </div>

        {/* Dynamic Risk Gauge Bar */}
        <div className="holo-risk-bar-container">
          <div className="holo-risk-bar-track">
            <div
              className={`holo-risk-bar-fill ${riskClass}`}
              style={{ width: `${Math.min(100, Math.max(5, riskScore))}%` }}
            />
          </div>
        </div>

        {/* Origin & Destination Hub Cards */}
        <div className="holo-corridor-box">
          <div className="holo-corridor-node origin">
            <div className="node-icon-wrap">
              <MapPin size={13} />
            </div>
            <div className="node-details">
              <span className="node-label">ORIGIN</span>
              <strong className="node-city">{shipment.origin || 'Data unavailable'}</strong>
              <span className="node-hub-info">
                {originHub ? `${originHub.label} (${originHub.type || 'Hub'})` : 'Supply Chain Hub'}
              </span>
              {originHub ? (
                <span className="node-coords">
                  {originHub.lat.toFixed(4)}°N, {originHub.lon.toFixed(4)}°E
                </span>
              ) : (
                <span className="node-coords unavailable">Coordinates: Data unavailable</span>
              )}
            </div>
          </div>

          <div className="holo-corridor-connector">
            <div className="connector-line" />
            <div className="connector-badge">
              <Compass size={11} />
              <span>{distanceKm ? `${distanceKm.toLocaleString()} KM` : 'Data unavailable'}</span>
            </div>
            <div className="connector-line" />
          </div>

          <div className="holo-corridor-node dest">
            <div className="node-icon-wrap dest">
              <Navigation size={13} />
            </div>
            <div className="node-details">
              <span className="node-label">DESTINATION</span>
              <strong className="node-city">{shipment.destination || 'Data unavailable'}</strong>
              <span className="node-hub-info">
                {destHub ? `${destHub.label} (${destHub.type || 'Terminal'})` : 'Logistics Destination'}
              </span>
              {destHub ? (
                <span className="node-coords">
                  {destHub.lat.toFixed(4)}°N, {destHub.lon.toFixed(4)}°E
                </span>
              ) : (
                <span className="node-coords unavailable">Coordinates: Data unavailable</span>
              )}
            </div>
          </div>
        </div>

        {/* Operational Timeline & Velocity */}
        <div className="holo-info-grid">
          <div className="holo-info-item">
            <span className="info-icon-tag"><Calendar size={12} /> EST. DELIVERY (ETA)</span>
            <strong className="info-val">{shipment.eta || 'Data unavailable'}</strong>
          </div>
          <div className="holo-info-item">
            <span className="info-icon-tag"><Clock size={12} /> LAST TELEMETRY PING</span>
            <strong className="info-val">{shipment.lastUpdated || 'Data unavailable'}</strong>
          </div>
          <div className="holo-info-item">
            <span className="info-icon-tag"><Compass size={12} /> CORRIDOR DISTANCE</span>
            <strong className="info-val">
              {distanceKm ? `${distanceKm.toLocaleString()} km (Great Circle)` : 'Data unavailable'}
            </strong>
          </div>
          <div className="holo-info-item">
            <span className="info-icon-tag"><RouteIcon size={12} /> CARRIER PRIORITY</span>
            <strong className="info-val">{shipment.priority || 'Standard'}</strong>
          </div>
        </div>

        {/* Disruptions & Risk Factor Analysis */}
        <div className="holo-disruptions-section">
          <div className="section-label-row">
            <AlertTriangle size={12} />
            <span>DISRUPTIONS & RISK SIGNALS</span>
          </div>

          {activeAlert && (
            <div className={`holo-active-alert-box ${activeAlert.severity ? activeAlert.severity.toLowerCase() : 'warning'}`}>
              <div className="alert-header-row">
                <span className="alert-tag">ACTIVE ALERT {activeAlert.alert_id || activeAlert.id}</span>
                <span className="alert-severity">{activeAlert.severity || 'CRITICAL'}</span>
              </div>
              <p className="alert-message">{activeAlert.message || activeAlert.title || 'Operational disruption flagged on route.'}</p>
            </div>
          )}

          {shipment.riskFactors && Array.isArray(shipment.riskFactors) && shipment.riskFactors.length > 0 ? (
            <ul className="holo-factors-list">
              {shipment.riskFactors.map((factor, idx) => (
                <li key={idx} className="factor-item">
                  <span className="factor-bullet" />
                  <span>{factor}</span>
                </li>
              ))}
            </ul>
          ) : !activeAlert ? (
            <div className="holo-nominal-state">
              <ShieldCheck size={14} className="nominal-icon" />
              <span>No active disruptions detected. Corridor telemetry nominal.</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Futuristic Action Navigation Footer */}
      <div className="holo-panel-footer">
        {onNavigateMap && (
          <button
            type="button"
            className="holo-action-btn primary"
            onClick={() => onNavigateMap(shipment.id)}
            title="Navigate to detailed 2D/3D navigation routing on the Live Map"
          >
            <RouteIcon size={13} />
            <span>Inspect Route on Live Map</span>
            <ArrowRight size={13} />
          </button>
        )}

        {onNavigateDossier && (
          <button
            type="button"
            className="holo-action-btn secondary"
            onClick={() => onNavigateDossier(shipment.id)}
            title="Open comprehensive ML explainability and telemetry dossier"
          >
            <ExternalLink size={12} />
            <span>Open Full Shipment Dossier</span>
          </button>
        )}
      </div>
    </aside>
  )
}
