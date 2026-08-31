import { AlertTriangle, Check, Info, RefreshCw, ShieldAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { alertFilters } from '../data/alerts.js'
import { deleteAlert, getAlerts, markAlertAsRead, wsService } from '../services/api.js'
import './Alerts.css'

function normalizeWsAlert(alert) {
  const sev = alert.severity || 'Medium'
  return {
    id: alert.alert_id || alert.id,
    shipment: alert.shipment_id || alert.shipment,
    severity: sev[0].toUpperCase() + sev.slice(1).toLowerCase(),
    type: alert.type,
    title: alert.title,
    message: alert.message,
    action: alert.recommended_action || alert.action,
    time: new Date(alert.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    timestamp: alert.timestamp || new Date().toISOString(),
    read: Boolean(alert.read),
  }
}

const severityIcons = { Critical: ShieldAlert, High: AlertTriangle, Medium: AlertTriangle, Information: Info }
function Alerts() {
  const [filter, setFilter] = useState('All'); const [alerts, setAlerts] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  const load = async () => { setLoading(true); setError(''); try { setAlerts(await getAlerts()) } catch (err) { setError(err.message) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])

  useEffect(() => {
    const unsubCreated = wsService.subscribe('alert.created', (data) => {
      const normalized = normalizeWsAlert(data)
      setAlerts((current) => {
        if (current.some((a) => a.id === normalized.id)) return current
        return [normalized, ...current]
      })
    })

    const unsubUpdated = wsService.subscribe('alert.updated', (data) => {
      const normalized = normalizeWsAlert(data)
      setAlerts((current) => current.map((a) => a.id === normalized.id ? { ...a, ...normalized } : a))
    })

    const unsubDeleted = wsService.subscribe('alert.deleted', (data) => {
      const alertId = data.alert_id || data.id
      if (!alertId) return
      setAlerts((current) => current.filter((a) => a.id !== alertId))
    })

    return () => {
      unsubCreated()
      unsubUpdated()
      unsubDeleted()
    }
  }, [])

  const markRead = async (id) => { try { const updated = await markAlertAsRead(id); setAlerts((current) => current.map((alert) => alert.id === id ? updated : alert)) } catch (err) { setError(err.message) } }
  const remove = async (id) => { try { await deleteAlert(id); setAlerts((current) => current.filter((alert) => alert.id !== id)) } catch (err) { setError(err.message) } }
  if (loading) return <div className="page-loading"><RefreshCw size={20} className="loading-spin" /> Loading alerts...</div>
  const visibleAlerts = alerts.filter(({ severity }) => filter === 'All' || severity === filter)
  return <div className="alerts-page"><section className="page-intro"><div><span className="eyebrow">Network monitoring</span><h1>Alerts</h1><p>Prioritized signals from across your supply chain.</p></div><span className="demo-note"><span /> Backend data</span></section>{error && <div className="inline-error"><AlertTriangle size={15} /> {error}<button onClick={load}>Retry</button></div>}<section className="alert-filter-bar"><div className="alert-tabs">{alertFilters.map((option) => <button className={filter === option ? 'selected' : ''} onClick={() => setFilter(option)} key={option}>{option}<span>{option === 'All' ? alerts.length : alerts.filter(({ severity }) => severity === option).length}</span></button>)}</div><span className="alert-summary">{alerts.filter(({ read }) => !read).length} unread alerts</span></section><section className="alerts-table-panel"><div className="alerts-table-head"><span className="eyebrow">Live alert feed</span><span>Backend data</span></div><div className="alerts-table-wrap"><table className="alerts-table"><thead><tr><th>Time</th><th>Shipment</th><th>Severity</th><th>Message</th><th>Recommended Action</th><th aria-label="Read status" /><th aria-label="Delete alert" /></tr></thead><tbody>{visibleAlerts.map(({ id, time, shipment, severity, message, action, read: isRead }) => { const Icon = severityIcons[severity]; return <tr className={isRead ? 'read' : ''} key={id}><td>{time}</td><td><strong>{shipment}</strong></td><td><span className={`severity ${severity.toLowerCase()}`}><Icon size={13} /> {severity}</span></td><td>{message}</td><td><span className="recommended-action">{action}</span></td><td>{!isRead && <button className="read-button" onClick={() => markRead(id)}><Check size={13} /> Mark read</button>}</td><td><button className="read-button" onClick={() => remove(id)}>Delete</button></td></tr> })}</tbody></table>{visibleAlerts.length === 0 && <div className="empty-alerts">No alerts in this category.</div>}</div></section></div>
}
export default Alerts
