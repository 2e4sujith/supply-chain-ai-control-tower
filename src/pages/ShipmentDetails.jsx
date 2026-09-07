import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  History,
  Info,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Truck,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getPredictionHistory, getShipment, predictRisk } from '../services/api.js'
import './ShipmentDetails.css'

function formatFactorValue(feature, value) {
  if (value === null || value === undefined) return '--'
  if (typeof value === 'number') {
    if (feature.includes('pct') || feature.includes('score') || feature.includes('factor') || feature.includes('risk')) {
      if (value <= 1.0) return `${Math.round(value * 100)}%`
    }
    if (feature.includes('index')) return `${Number(value).toFixed(1)}/100`
    if (feature.includes('km')) return `${Number(value).toLocaleString()} km`
    if (feature.includes('hours')) return `${Number(value).toFixed(1)} hrs`
    return Number(value).toFixed(1)
  }
  return String(value).replace(/_/g, ' ')
}

function formatTimestamp(isoString) {
  if (!isoString) return 'Just now'
  try {
    const d = new Date(isoString)
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return isoString
  }
}

function ShipmentDetails() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [shipment, setShipment] = useState(null)
  const [error, setError] = useState('')
  const [riskResult, setRiskResult] = useState(null)
  const [riskError, setRiskError] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const loadShipmentAndRisk = async () => {
    setError('')
    try {
      const data = await getShipment(id)
      setShipment(data)
      runRiskAnalysis(data.id)
      loadHistory(data.id)
    } catch (err) {
      setError(
        err.message === 'The requested resource was not found.'
          ? 'Shipment not found.'
          : err.message
      )
    }
  }

  const runRiskAnalysis = async (shipmentId) => {
    const sid = shipmentId || shipment?.id || id
    if (!sid) return
    setAnalyzing(true)
    setRiskError('')
    try {
      const res = await predictRisk(sid)
      setRiskResult(res)
      loadHistory(sid)
    } catch (err) {
      setRiskError(err.message || 'Unable to load AI risk analysis.')
    } finally {
      setAnalyzing(false)
    }
  }

  const loadHistory = async (shipmentId) => {
    const sid = shipmentId || shipment?.id || id
    if (!sid) return
    setLoadingHistory(true)
    try {
      const hist = await getPredictionHistory(sid, 15)
      setHistory(Array.isArray(hist) ? hist : [])
    } catch {
      setHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    loadShipmentAndRisk()
  }, [id])

  if (!shipment && !error) {
    return (
      <div className="page-loading">
        <RefreshCw size={20} className="loading-spin" /> Loading shipment details...
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-error">
        <AlertTriangle size={22} />
        <h1>{error}</h1>
        <p>We could not load this shipment from the backend.</p>
        <button className="primary-button" onClick={loadShipmentAndRisk}>
          <RefreshCw size={15} /> Retry
        </button>
      </div>
    )
  }

  const activeScore = riskResult ? riskResult.risk_score : shipment.riskScore
  const activeLevel = (riskResult ? riskResult.risk_level : shipment.risk).toUpperCase()
  const activeProb = riskResult
    ? (riskResult.disruption_probability * 100).toFixed(1)
    : `${activeScore}.0`
  const activeModel = riskResult ? riskResult.model_name : 'XGBoost (Disruption Risk v1.0)'

  const topRiskFactors = riskResult?.top_risk_factors || []
  const protectiveFactors = riskResult?.protective_factors || []

  return (
    <div className="detail-page">
      <div className="detail-top-nav">
        <button className="back-button" onClick={() => navigate('/shipments')}>
          <ArrowLeft size={16} /> Back to shipments
        </button>
        <button
          className="refresh-prediction-btn"
          onClick={() => runRiskAnalysis(shipment.id)}
          disabled={analyzing}
          title="Run real-time ML risk inference"
        >
          <RefreshCw size={13} className={analyzing ? 'loading-spin' : ''} />
          {analyzing ? 'Analyzing shipment risk...' : 'Re-analyze AI Risk'}
        </button>
      </div>

      <section className="detail-intro">
        <div>
          <span className="eyebrow">Shipment details & telemetry</span>
          <h1>{shipment.id}</h1>
          <p>
            {shipment.origin} <span>to</span> {shipment.destination}
          </p>
        </div>
        <div className="intro-badges">
          <span className={`shipment-status large ${shipment.status.toLowerCase().replace(' ', '-')}`}>
            {shipment.status}
          </span>
        </div>
      </section>

      {riskError && (
        <div className="inline-error risk-alert">
          <AlertTriangle size={16} />
          <div>
            <strong>Unable to load AI risk analysis</strong>
            <p>{riskError}</p>
          </div>
          <button onClick={() => runRiskAnalysis(shipment.id)}>Retry</button>
        </div>
      )}

      <section className="detail-grid">
        {/* Current Location & Route */}
        <article className="detail-card location-card">
          <div className="card-title">
            <MapPin size={17} />
            <h2>Current Location</h2>
          </div>
          <strong>{shipment.currentLocation}</strong>
          <p>Last updated {shipment.lastUpdated}</p>
          <div className="route-line">
            <span className="route-point start" />
            <span />
            <span className="route-point end" />
          </div>
          <div className="route-labels">
            <span>{shipment.origin}</span>
            <span>{shipment.destination}</span>
          </div>
        </article>

        {/* Shipment Info */}
        <article className="detail-card">
          <div className="card-title">
            <Truck size={17} />
            <h2>Shipment Information</h2>
          </div>
          <dl>
            <div>
              <dt>ETA</dt>
              <dd>{shipment.eta}</dd>
            </div>
            <div>
              <dt>Priority Level</dt>
              <dd>{shipment.priority}</dd>
            </div>
            <div>
              <dt>Risk Tier</dt>
              <dd>
                <span className={`shipment-risk ${activeLevel.toLowerCase()}`}>
                  <span />
                  {activeLevel}
                </span>
              </dd>
            </div>
            <div>
              <dt>Last Updated</dt>
              <dd>{shipment.lastUpdated}</dd>
            </div>
          </dl>
        </article>

        {/* AI Disruption Risk Card */}
        <article className="detail-card risk-score-card">
          <div className="card-title">
            <ShieldCheck size={17} />
            <h2>AI Disruption Risk</h2>
          </div>
          <div className="score-row">
            <strong>{activeScore}</strong>
            <span>/ 100</span>
            <span className={`risk-badge ${activeLevel.toLowerCase()}`}>
              {activeLevel}
            </span>
          </div>
          <div className="score-track">
            <span
              className={`track-fill ${activeLevel.toLowerCase()}`}
              style={{ width: `${Math.min(100, Math.max(5, activeScore))}%` }}
            />
          </div>

          <div className="ml-meta-grid">
            <div className="ml-meta-item">
              <span className="meta-label">Disruption Probability</span>
              <strong className="meta-val">{activeProb}%</strong>
            </div>
            <div className="ml-meta-item">
              <span className="meta-label">Predictive Engine</span>
              <strong className="meta-val">{activeModel.split(' ')[0]}</strong>
            </div>
          </div>
        </article>
      </section>

      {/* SHAP Risk Explanation: Why is this shipment at risk? */}
      <section className="shap-section">
        <div className="section-header">
          <div className="header-title">
            <TrendingUp size={19} className="risk-header-icon" />
            <div>
              <h2>Why is this shipment at risk?</h2>
              <p>Top factors identified by TreeSHAP explainability increasing disruption probability</p>
            </div>
          </div>
          <span className="model-tag">
            <Sparkles size={12} /> {activeModel}
          </span>
        </div>

        {topRiskFactors.length > 0 ? (
          <div className="factors-grid">
            {topRiskFactors.map((factor, idx) => (
              <div className="factor-card risk-driver" key={factor.feature || idx}>
                <div className="factor-card-top">
                  <div className="factor-name-wrap">
                    <span className="factor-rank">#{idx + 1}</span>
                    <strong className="factor-name">{factor.display_name}</strong>
                  </div>
                  <span className={`factor-badge ${factor.magnitude.toLowerCase()}`}>
                    {factor.magnitude}
                  </span>
                </div>

                <div className="factor-metrics">
                  <div className="metric-pill">
                    <span className="metric-lbl">Current Metric</span>
                    <span className="metric-val">{formatFactorValue(factor.feature, factor.value)}</span>
                  </div>
                  <div className="impact-indicator up">
                    <TrendingUp size={14} />
                    <span>Increases Risk (+{factor.shap_value.toFixed(2)})</span>
                  </div>
                </div>

                <p className="factor-desc">{factor.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-adverse-factors">
            <CheckCircle2 size={18} />
            <div>
              <strong>No adverse risk drivers detected</strong>
              <p>Transit corridor conditions and carrier operational metrics are within safe thresholds.</p>
            </div>
          </div>
        )}
      </section>

      {/* Protective Factors (Only rendered if protective factors exist) */}
      {protectiveFactors.length > 0 && (
        <section className="shap-section protective-section">
          <div className="section-header">
            <div className="header-title">
              <TrendingDown size={19} className="protective-header-icon" />
              <div>
                <h2>Protective Factors</h2>
                <p>Operational buffers and corridor conditions mitigating disruption risk</p>
              </div>
            </div>
          </div>

          <div className="factors-grid">
            {protectiveFactors.map((factor, idx) => (
              <div className="factor-card protective-buffer" key={factor.feature || idx}>
                <div className="factor-card-top">
                  <div className="factor-name-wrap">
                    <strong className="factor-name">{factor.display_name}</strong>
                  </div>
                  <span className="factor-badge buffer">
                    BUFFER
                  </span>
                </div>

                <div className="factor-metrics">
                  <div className="metric-pill">
                    <span className="metric-lbl">Current Metric</span>
                    <span className="metric-val">{formatFactorValue(factor.feature, factor.value)}</span>
                  </div>
                  <div className="impact-indicator down">
                    <TrendingDown size={14} />
                    <span>Reduces Risk ({factor.shap_value.toFixed(2)})</span>
                  </div>
                </div>

                <p className="factor-desc">{factor.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* AI Decision Summary Banner */}
      <section className="ai-insight">
        <div className="ai-label">
          <ShieldCheck size={16} /> AI DISRUPTION RISK INTELLIGENCE
        </div>
        <h2>Risk Assessment for {shipment.id}</h2>
        <p>
          {riskResult
            ? `The XGBoost prediction model classifies this ${shipment.priority} shipment as ${activeLevel} risk (${activeProb}% disruption probability) based on route telemetry, congestion indicators, and carrier reliability scoring.`
            : `Click 'Re-analyze AI Risk' to evaluate real-time corridor metrics with the trained XGBoost model.`}
        </p>
      </section>

      {/* Prediction History Section */}
      <section className="history-section">
        <div className="section-header">
          <div className="header-title">
            <History size={19} className="history-header-icon" />
            <div>
              <h2>Prediction History & Audit Log</h2>
              <p>Persistent historical risk evaluations recorded in PostgreSQL (newest first)</p>
            </div>
          </div>
          <span className="history-count">
            {history.length} {history.length === 1 ? 'evaluation' : 'evaluations'}
          </span>
        </div>

        {loadingHistory && history.length === 0 ? (
          <div className="history-loading">
            <RefreshCw size={15} className="loading-spin" /> Loading prediction logs...
          </div>
        ) : history.length > 0 ? (
          <div className="history-table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Risk Score</th>
                  <th>Risk Tier</th>
                  <th>Disruption Probability</th>
                  <th>Model Engine</th>
                  <th>Drivers Identified</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="time-cell">
                        <Clock size={13} />
                        <span>{formatTimestamp(item.prediction_timestamp)}</span>
                      </div>
                    </td>
                    <td>
                      <strong>{item.risk_score}</strong>/100
                    </td>
                    <td>
                      <span className={`risk-badge mini ${item.risk_level.toLowerCase()}`}>
                        {item.risk_level}
                      </span>
                    </td>
                    <td>{(item.disruption_probability * 100).toFixed(1)}%</td>
                    <td>
                      <span className="model-chip">{item.model_name.split(' ')[0]}</span>
                    </td>
                    <td>
                      <span className="factors-summary">
                        {item.top_risk_factors?.length || 0} risk / {item.protective_factors?.length || 0} buffer
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="history-empty">
            <Info size={16} />
            <p>No previous prediction records saved for this shipment yet. Run an analysis above to log the first evaluation.</p>
          </div>
        )}
      </section>
    </div>
  )
}

export default ShipmentDetails

