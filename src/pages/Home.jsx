import { AlertTriangle, ArrowUpRight, Clock3, Package, RefreshCw, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAnalyticsOverview, getRiskDistribution, getShipmentActivity } from '../services/api.js'
import './Home.css'

function Home() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const load = async () => {
    setError('')
    try {
      const [overview, risk, activity] = await Promise.all([
        getAnalyticsOverview(),
        getRiskDistribution(),
        getShipmentActivity(),
      ])
      setData({ overview, risk, activity })
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (error) {
    return (
      <div className="page-error">
        <AlertTriangle size={22} />
        <h1>Unable to load dashboard.</h1>
        <p>{error}</p>
        <button className="primary-button" onClick={load}>
          <RefreshCw size={15} /> Retry
        </button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="page-loading">
        <RefreshCw size={20} className="loading-spin" /> Loading dashboard...
      </div>
    )
  }

  const { overview, risk, activity } = data
  const metrics = [
    {
      label: 'Total Shipments',
      value: overview.total_shipments,
      detail: 'From live register',
      icon: Package,
      tone: 'blue',
      path: '/shipments',
    },
    {
      label: 'Active Shipments',
      value: overview.active_shipments,
      detail: 'Currently moving',
      icon: Truck,
      tone: 'green',
      path: '/shipments',
    },
    {
      label: 'High Risk',
      value: overview.high_risk_shipments,
      detail: 'Requires attention',
      icon: AlertTriangle,
      tone: 'red',
      path: '/alerts',
    },
    {
      label: 'On-Time Delivery',
      value: `${overview.on_time_delivery}%`,
      detail: 'Current performance',
      icon: Clock3,
      tone: 'orange',
      path: '/analytics',
    },
  ]

  const riskTotal = Math.max(1, risk.low + risk.medium + risk.high + risk.critical)
  const bars = activity.map(({ shipments }) => shipments)
  const maxBar = Math.max(...bars, 1)

  return (
    <div className="dashboard-page">
      <section className="dashboard-intro">
        <div>
          <span className="eyebrow">Network command center</span>
          <h1>Supply Chain Overview</h1>
          <p>Monitor shipments, disruption risk and operational performance.</p>
        </div>
        <span className="demo-note">
          <span /> PostgreSQL backend
        </span>
      </section>

      <section className="kpi-grid">
        {metrics.map(({ label, value, detail, icon: Icon, tone, path }) => (
          <article
            className="kpi-card"
            key={label}
            onClick={() => navigate(path)}
            style={{ cursor: 'pointer' }}
            title={`View ${label}`}
          >
            <div className={`kpi-icon ${tone}`}>
              <Icon size={19} />
            </div>
            <span className="kpi-label">{label}</span>
            <strong>{value}</strong>
            <span className="kpi-detail">
              <ArrowUpRight size={13} /> {detail}
            </span>
          </article>
        ))}
      </section>

      <section className="chart-grid">
        <article
          className="panel risk-panel"
          onClick={() => navigate('/analytics')}
          style={{ cursor: 'pointer' }}
          title="Open Risk Analytics"
        >
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Current exposure</span>
              <h2>Risk Overview</h2>
            </div>
            <span className="panel-menu">Live data →</span>
          </div>
          <div className="risk-content">
            <div
              className="risk-donut"
              style={{
                background: `conic-gradient(#77bd91 0 ${(risk.low / riskTotal) * 100}%, #e4b35e ${
                  (risk.low / riskTotal) * 100
                }% ${((risk.low + risk.medium) / riskTotal) * 100}%, #e17763 ${
                  ((risk.low + risk.medium) / riskTotal) * 100
                }% ${((risk.low + risk.medium + risk.high) / riskTotal) * 100}%, #a94d4d ${
                  ((risk.low + risk.medium + risk.high) / riskTotal) * 100
                }% 100%)`,
              }}
            >
              <div>
                <strong>{riskTotal}</strong>
                <span>shipments</span>
              </div>
            </div>
            <div className="risk-legend">
              {[
                ['Low', risk.low, 'low'],
                ['Medium', risk.medium, 'medium'],
                ['High', risk.high, 'high'],
                ['Critical', risk.critical, 'critical'],
              ].map(([label, count, tone]) => (
                <div className="legend-row" key={label}>
                  <span className={`legend-dot ${tone}`} />
                  <span>{label}</span>
                  <strong>{count}</strong>
                  <small>{Math.round((count / riskTotal) * 100)}%</small>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article
          className="panel activity-panel"
          onClick={() => navigate('/analytics')}
          style={{ cursor: 'pointer' }}
          title="Open Shipment Activity Analytics"
        >
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Volume tracking</span>
              <h2>Shipment Activity</h2>
            </div>
            <span className="panel-menu">Live data →</span>
          </div>
          <div className="activity-chart">
            <div className="chart-gridlines">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="bars">
              {bars.map((value, index) => (
                <span className="bar" style={{ height: `${(value / maxBar) * 100}%` }} key={index} />
              ))}
            </div>
            <div className="chart-labels">
              {activity.map(({ timestamp }) => (
                <span key={timestamp}>{timestamp}</span>
              ))}
            </div>
          </div>
        </article>
      </section>
    </div>
  )
}

export default Home
