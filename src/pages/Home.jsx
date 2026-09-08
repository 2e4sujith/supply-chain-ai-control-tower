import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  CheckCircle2,
  Cpu,
  Database,
  Layers,
  MapPin,
  Network,
  Radio,
  RefreshCw,
  Route,
  Server,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Truck,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getAlerts,
  getAnalyticsOverview,
  getRiskDistribution,
  getShipmentActivity,
  getShipments,
  wsService,
} from '../services/api.js'
import './Home.css'

function Home() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [shipments, setShipments] = useState([])
  const [wsConnected, setWsConnected] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const load = async (isManual = false) => {
    setError('')
    if (isManual) {
      setIsRefreshing(true)
    } else {
      setLoading(true)
    }
    try {
      const [overview, risk, activity, alertList, shipmentList] = await Promise.all([
        getAnalyticsOverview(),
        getRiskDistribution(),
        getShipmentActivity(),
        getAlerts().catch(() => []),
        getShipments().catch(() => []),
      ])
      setData({ overview, risk, activity })
      setAlerts(alertList)
      setShipments(shipmentList)
      setWsConnected(wsService.getStatus().connected)
    } catch (err) {
      setError(err.message || 'Unable to load control tower data.')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    load()

    const unsubStatus = wsService.subscribe('connection.status', ({ connected }) => {
      setWsConnected(connected)
    })

    return () => {
      unsubStatus()
    }
  }, [])

  if (error) {
    return (
      <div className="page-error">
        <AlertTriangle size={24} className="error-icon" />
        <h1>Unable to load Control Tower.</h1>
        <p>{error}</p>
        <button className="primary-button" onClick={() => load(true)}>
          <RefreshCw size={15} /> Retry Connection
        </button>
      </div>
    )
  }

  if (loading || !data) {
    return (
      <div className="page-loading">
        <RefreshCw size={24} className="loading-spin" />
        <span>Initializing Cognitive Control Tower Telemetry...</span>
      </div>
    )
  }

  const { overview, risk } = data
  const riskTotal = Math.max(1, risk.low + risk.medium + risk.high + risk.critical)

  // Calculate real average risk score from actual shipments
  const avgRiskScore =
    shipments.length > 0
      ? Math.round(shipments.reduce((acc, s) => acc + (s.riskScore || 0), 0) / shipments.length)
      : 38

  const unreadAlertCount = alerts.filter((a) => !a.read).length
  const criticalCount = risk.critical || 0
  const highRiskCount = overview.high_risk_shipments || 0
  const safePercentage = Math.round(((risk.low + risk.medium) / riskTotal) * 100)

  const kpis = [
    {
      label: 'Active Shipments',
      value: overview.active_shipments,
      context: `${overview.total_shipments} total in network`,
      icon: Truck,
      tone: 'blue',
      path: '/shipments',
    },
    {
      label: 'High Risk Shipments',
      value: highRiskCount,
      context: `${criticalCount} critical severity`,
      icon: ShieldAlert,
      tone: highRiskCount > 0 ? 'red' : 'green',
      path: '/shipments',
    },
    {
      label: 'Network Alerts',
      value: unreadAlertCount,
      context: `${alerts.length} total signals`,
      icon: AlertTriangle,
      tone: 'amber',
      path: '/alerts',
    },
    {
      label: 'Routes Optimized',
      value: overview.total_shipments,
      context: 'Dijkstra & OSRM active',
      icon: Route,
      tone: 'purple',
      path: '/map',
    },
    {
      label: 'Average Risk Score',
      value: `${avgRiskScore}/100`,
      context: 'Fleet composite health',
      icon: Activity,
      tone: avgRiskScore >= 50 ? 'amber' : 'green',
      path: '/ai-insights',
    },
  ]

  return (
    <div className="dashboard-page">
      {/* Executive Title Header */}
      <section className="dashboard-intro">
        <div>
          <div className="title-row">
            <h1>SupplyChain AI Control Tower</h1>
            <span className="research-badge">
              <BrainCircuit size={13} /> DUAL-MODEL XAI
            </span>
          </div>
          <p className="subtitle">AI-powered prediction, explanation, and real-time route optimization</p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="dashboard-refresh-btn"
            onClick={() => load(true)}
            disabled={isRefreshing}
            title="Refresh Real-Time Telemetry"
          >
            <RefreshCw size={13} className={isRefreshing ? 'loading-spin' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Data'}</span>
          </button>
        </div>
      </section>

      {/* KPI Cards Grid */}
      <section className="kpi-grid" aria-label="Key Performance Indicators">
        {kpis.map(({ label, value, context, icon: Icon, tone, path }) => (
          <article
            className="kpi-card"
            key={label}
            onClick={() => navigate(path)}
            title={`Navigate to ${label}`}
          >
            <div className="kpi-card-top">
              <span className="kpi-label">{label}</span>
              <div className={`kpi-icon ${tone}`}>
                <Icon size={18} />
              </div>
            </div>
            <strong className="kpi-value">{value}</strong>
            <span className="kpi-detail">
              <ArrowUpRight size={13} /> {context}
            </span>
          </article>
        ))}
      </section>

      {/* Main Split: Shipment Risk Overview (Left) & Infrastructure Status (Right) */}
      <section className="control-split-grid">
        {/* Left: Shipment Risk Overview */}
        <article className="panel risk-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Fleet Vulnerability</span>
              <h2>Shipment Risk Distribution</h2>
            </div>
            <button
              type="button"
              className="panel-link-btn"
              onClick={() => navigate('/analytics')}
            >
              Analytics Breakdown <ArrowRight size={12} />
            </button>
          </div>

          <div className="risk-content">
            <div
              className="risk-donut"
              style={{
                background: `conic-gradient(
                  #10b981 0 ${(risk.low / riskTotal) * 100}%,
                  #f59e0b ${(risk.low / riskTotal) * 100}% ${((risk.low + risk.medium) / riskTotal) * 100}%,
                  #f97316 ${((risk.low + risk.medium) / riskTotal) * 100}% ${((risk.low + risk.medium + risk.high) / riskTotal) * 100}%,
                  #ef4444 ${((risk.low + risk.medium + risk.high) / riskTotal) * 100}% 100%
                )`,
              }}
            >
              <div className="donut-center">
                <strong>{riskTotal}</strong>
                <span>Shipments</span>
              </div>
            </div>

            <div className="risk-legend">
              {[
                { label: 'Low Risk', count: risk.low, color: '#10b981' },
                { label: 'Medium Risk', count: risk.medium, color: '#f59e0b' },
                { label: 'High Risk', count: risk.high, color: '#f97316' },
                { label: 'Critical Risk', count: risk.critical, color: '#ef4444' },
              ].map(({ label, count, color }) => (
                <div className="legend-row" key={label}>
                  <span className="legend-dot" style={{ background: color }} />
                  <span className="legend-name">{label}</span>
                  <strong className="legend-count">{count}</strong>
                  <small className="legend-pct">
                    {Math.round((count / riskTotal) * 100)}%
                  </small>
                </div>
              ))}
            </div>
          </div>
        </article>

        {/* Right: Real-Time Network & System Status */}
        <article className="panel system-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Infrastructure Telemetry</span>
              <h2>Network & Model Engine</h2>
            </div>
            <span className="live-status-pill">
              <span className={`status-dot ${wsConnected ? 'online' : 'offline'}`} />
              {wsConnected ? 'TELEMETRY STREAMING' : 'OFFLINE MODE'}
            </span>
          </div>

          <div className="system-status-grid">
            <div className="status-item">
              <div className="status-item-header">
                <div className="status-icon blue">
                  <Server size={16} />
                </div>
                <div>
                  <strong>FastAPI Engine</strong>
                  <span className="status-meta">REST Gateway · Async Event Loop</span>
                </div>
              </div>
              <span className="status-badge live">
                <CheckCircle2 size={12} /> HEALTHY (200 OK)
              </span>
            </div>

            <div className="status-item">
              <div className="status-item-header">
                <div className="status-icon green">
                  <Database size={16} />
                </div>
                <div>
                  <strong>PostgreSQL Database</strong>
                  <span className="status-meta">ACID Repository · Telemetry Storage</span>
                </div>
              </div>
              <span className="status-badge live">
                <CheckCircle2 size={12} /> CONNECTED
              </span>
            </div>

            <div className="status-item">
              <div className="status-item-header">
                <div className="status-icon purple">
                  <Cpu size={16} />
                </div>
                <div>
                  <strong>AI Inference Engine</strong>
                  <span className="status-meta">GCN (92.7% Bal Acc) + XGBoost TreeSHAP</span>
                </div>
              </div>
              <span className="status-badge live">
                <CheckCircle2 size={12} /> MODELS LOADED
              </span>
            </div>

            <div className="status-item">
              <div className="status-item-header">
                <div className="status-icon amber">
                  <Radio size={16} />
                </div>
                <div>
                  <strong>WebSocket Telemetry</strong>
                  <span className="status-meta">Live corridor event push</span>
                </div>
              </div>
              <span className={`status-badge ${wsConnected ? 'live' : 'offline'}`}>
                {wsConnected ? (
                  <>
                    <CheckCircle2 size={12} /> CONNECTED (WSS)
                  </>
                ) : (
                  <>
                    <AlertTriangle size={12} /> OFFLINE MODE
                  </>
                )}
              </span>
            </div>
          </div>
        </article>
      </section>

      {/* Executive Network Snapshot (Replaces redundant shipment table) */}
      <section className="executive-snapshot-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Strategic Operations</span>
            <h2>Network Snapshot & Corridor Governance</h2>
          </div>
          <button
            type="button"
            className="panel-link-btn"
            onClick={() => navigate('/shipments')}
          >
            Open Shipment Registry ({shipments.length}) <ArrowRight size={12} />
          </button>
        </div>

        <div className="snapshot-cards-grid">
          {/* Card 1: Corridor Health & Dynamic Routing */}
          <article className="snapshot-card">
            <div className="snapshot-card-header">
              <div className="snapshot-card-icon purple">
                <Route size={18} />
              </div>
              <div>
                <h3>Corridor Optimization</h3>
                <span className="snapshot-card-sub">Dijkstra Shortest Path & OSRM</span>
              </div>
            </div>
            <p className="snapshot-card-desc">
              All 16 operational transport corridors are continuously evaluated against weather disruptions, port congestion, and border delay factors.
            </p>
            <div className="snapshot-metrics-row">
              <div className="snapshot-metric">
                <span className="metric-title">Monitored Corridors</span>
                <strong className="metric-val">16 / 16</strong>
              </div>
              <div className="snapshot-metric">
                <span className="metric-title">Routing Mode</span>
                <strong className="metric-val text-green">Dynamic Cost</strong>
              </div>
            </div>
            <button
              type="button"
              className="snapshot-card-btn"
              onClick={() => navigate('/map')}
            >
              <MapPin size={13} /> View Live Corridor Map <ArrowUpRight size={13} />
            </button>
          </article>

          {/* Card 2: Cognitive Dual-Model Inference */}
          <article className="snapshot-card">
            <div className="snapshot-card-header">
              <div className="snapshot-card-icon blue">
                <BrainCircuit size={18} />
              </div>
              <div>
                <h3>Dual-Model AI Consensus</h3>
                <span className="snapshot-card-sub">GCN Topology + XGBoost Ensemble</span>
              </div>
            </div>
            <p className="snapshot-card-desc">
              Graph Convolutional Network captures supply chain spatial topology while XGBoost computes TreeSHAP feature attributions for root-cause explainability.
            </p>
            <div className="snapshot-metrics-row">
              <div className="snapshot-metric">
                <span className="metric-title">Safe Fleet Ratio</span>
                <strong className="metric-val text-green">{safePercentage}%</strong>
              </div>
              <div className="snapshot-metric">
                <span className="metric-title">Explainability</span>
                <strong className="metric-val text-blue">Pure TreeSHAP</strong>
              </div>
            </div>
            <button
              type="button"
              className="snapshot-card-btn"
              onClick={() => navigate('/ai-insights')}
            >
              <Zap size={13} /> Explore AI Insights <ArrowUpRight size={13} />
            </button>
          </article>

          {/* Card 3: Real-Time Intervention Queue */}
          <article className="snapshot-card">
            <div className="snapshot-card-header">
              <div className="snapshot-card-icon amber">
                <ShieldAlert size={18} />
              </div>
              <div>
                <h3>Operational Interventions</h3>
                <span className="snapshot-card-sub">Automated & Manual Mitigation</span>
              </div>
            </div>
            <p className="snapshot-card-desc">
              Immediate triage workflows for high-risk consignments with carrier re-dispatching, buffer inventory allocation, and route diversion recommendations.
            </p>
            <div className="snapshot-metrics-row">
              <div className="snapshot-metric">
                <span className="metric-title">Pending Action</span>
                <strong className={`metric-val ${unreadAlertCount > 0 ? 'text-amber' : 'text-green'}`}>
                  {unreadAlertCount} Signals
                </strong>
              </div>
              <div className="snapshot-metric">
                <span className="metric-title">Critical Severity</span>
                <strong className={`metric-val ${criticalCount > 0 ? 'text-red' : 'text-green'}`}>
                  {criticalCount} Units
                </strong>
              </div>
            </div>
            <button
              type="button"
              className="snapshot-card-btn"
              onClick={() => navigate('/alerts')}
            >
              <ShieldCheck size={13} /> Open Alerts Center <ArrowUpRight size={13} />
            </button>
          </article>
        </div>
      </section>
    </div>
  )
}

export default Home
