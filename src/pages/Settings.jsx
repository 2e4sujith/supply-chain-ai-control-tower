import {
  Activity,
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  CircleUserRound,
  Database,
  Globe,
  HardDrive,
  Monitor,
  RefreshCw,
  Server,
  Shield,
  SlidersHorizontal,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  getSettings,
  getSystemConfig,
  getSystemMetrics,
  getSystemVersion,
  updateSettings,
} from '../services/api.js'
import './Settings.css'

const sections = [
  { label: 'Profile', icon: CircleUserRound },
  { label: 'Notifications', icon: Bell },
  { label: 'Display', icon: Monitor },
  { label: 'System', icon: Server },
  { label: 'API Configuration', icon: SlidersHorizontal },
]

function Settings() {
  const [activeSection, setActiveSection] = useState('Profile')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(null)

  const [formData, setFormData] = useState({
    display_name: 'Alex Morgan',
    email: 'alex.morgan@supplychain.ai',
    role: 'Operations Administrator',
    workspace: 'North America Operations',
    email_alerts: true,
    daily_digest: false,
    compact_density: false,
    theme: 'dark',
  })

  const [systemConfig, setSystemConfig] = useState(null)
  const [systemVersion, setSystemVersion] = useState(null)
  const [systemMetrics, setSystemMetrics] = useState(null)

  const loadSettings = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getSettings()
      if (data) {
        setFormData({
          display_name: data.display_name || 'Alex Morgan',
          email: data.email || 'alex.morgan@supplychain.ai',
          role: data.role || 'Operations Administrator',
          workspace: data.workspace || 'North America Operations',
          email_alerts: Boolean(data.email_alerts),
          daily_digest: Boolean(data.daily_digest),
          compact_density: Boolean(data.compact_density),
          theme: data.theme || 'dark',
        })
        if (data.compact_density) {
          document.body.classList.add('compact-density')
        } else {
          document.body.classList.remove('compact-density')
        }
        setError('')
      }
    } catch (err) {
      console.warn('Could not load settings from backend:', err)
      setError(err.message || 'Unable to connect to settings service.')
    } finally {
      setLoading(false)
    }
  }

  const loadSystemData = async () => {
    try {
      const [cfg, ver, met] = await Promise.all([
        getSystemConfig().catch(() => null),
        getSystemVersion().catch(() => null),
        getSystemMetrics().catch(() => null),
      ])
      setSystemConfig(cfg)
      setSystemVersion(ver)
      setSystemMetrics(met)
    } catch {
      // Ignore system load failures
    }
  }

  useEffect(() => {
    loadSettings()
    loadSystemData()
  }, [])

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setToast(null)
    try {
      const updated = await updateSettings(formData)
      if (updated) {
        setFormData({
          display_name: updated.display_name,
          email: updated.email,
          role: updated.role,
          workspace: updated.workspace,
          email_alerts: Boolean(updated.email_alerts),
          daily_digest: Boolean(updated.daily_digest),
          compact_density: Boolean(updated.compact_density),
          theme: updated.theme || 'dark',
        })
        if (updated.compact_density) {
          document.body.classList.add('compact-density')
        } else {
          document.body.classList.remove('compact-density')
        }
        setError('')
      }
      setToast({
        type: 'success',
        message: 'Successfully changed',
      })
      setTimeout(() => setToast(null), 4000)

    } catch (err) {
      setError(err.message || 'Failed to save settings to backend.')
    } finally {
      setSaving(false)
    }
  }

  const current = sections.find(({ label }) => label === activeSection)

  return (
    <div className="settings-page">
      <section className="page-intro">
        <div>
          <span className="eyebrow">Workspace preferences</span>
          <h1>Settings</h1>
          <p>Configure your control tower workspace, notification triggers, and operational profiles.</p>
        </div>
        <span className="demo-note">
          <span /> PostgreSQL Backed
        </span>
      </section>

      {/* Success Toast */}
      {toast && toast.type === 'success' && (
        <div className="settings-toast success">
          <CheckCircle2 size={16} />
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {/* Single clean Error Banner with Retry */}
      {error && !loading && (
        <div className="inline-error">
          <AlertTriangle size={15} />
          <span>{error}</span>
          <button type="button" onClick={loadSettings}>Retry</button>
        </div>
      )}

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {sections.map(({ label, icon: Icon }) => (
            <button
              className={activeSection === label ? 'selected' : ''}
              onClick={() => setActiveSection(label)}
              key={label}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>

        <section className="settings-panel">
          <div className="settings-panel-heading">
            <div>
              <span className="eyebrow">Configuration</span>
              <h2>{current.label}</h2>
            </div>
            <span className="settings-demo">LIVE PERSISTENCE</span>
          </div>

          {loading ? (
            <div className="settings-loading">
              <RefreshCw size={18} className="loading-spin" /> Loading settings...
            </div>
          ) : (
            <>
              {/* Profile Section */}
              {activeSection === 'Profile' && (
                <div className="settings-content">
                  <div className="profile-block">
                    <CircleUserRound size={48} />
                    <div>
                      <strong>{formData.display_name}</strong>
                      <span>{formData.role}</span>
                      <small>{formData.email}</small>
                    </div>
                  </div>
                  <div className="settings-fields">
                    <label>
                      Display name
                      <input
                        value={formData.display_name}
                        onChange={(e) => handleChange('display_name', e.target.value)}
                        placeholder="Alex Morgan"
                        disabled={saving}
                      />
                    </label>
                    <label>
                      Workspace Name
                      <input
                        value={formData.workspace}
                        onChange={(e) => handleChange('workspace', e.target.value)}
                        placeholder="North America Operations"
                        disabled={saving}
                      />
                    </label>
                    <label>
                      Email address
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        placeholder="alex.morgan@supplychain.ai"
                        disabled={saving}
                      />
                    </label>
                    <label>
                      Operational Role
                      <input
                        value={formData.role}
                        onChange={(e) => handleChange('role', e.target.value)}
                        placeholder="Operations Administrator"
                        disabled={saving}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Notifications Section */}
              {activeSection === 'Notifications' && (
                <div className="settings-content">
                  <div className="setting-row">
                    <div>
                      <strong>Operational Disruption Alerts</strong>
                      <p>Receive real-time WebSocket signals when critical risk factors or vessel delays occur.</p>
                    </div>
                    <button
                      type="button"
                      className={`toggle ${formData.email_alerts ? 'on' : ''}`}
                      onClick={() => handleChange('email_alerts', !formData.email_alerts)}
                      aria-label="Toggle operational alerts"
                    >
                      <span />
                    </button>
                  </div>
                  <div className="setting-row">
                    <div>
                      <strong>Daily Network Health Digest</strong>
                      <p>Generate summary notifications covering corridor bottlenecks and fleet performance.</p>
                    </div>
                    <button
                      type="button"
                      className={`toggle ${formData.daily_digest ? 'on' : ''}`}
                      onClick={() => handleChange('daily_digest', !formData.daily_digest)}
                      aria-label="Toggle daily digest"
                    >
                      <span />
                    </button>
                  </div>
                </div>
              )}

              {/* Display Section */}
              {activeSection === 'Display' && (
                <div className="settings-content">
                  <div className="setting-row">
                    <div>
                      <strong>Compact Table & Layout Density</strong>
                      <p>Optimize row heights and spacing to show more concurrent shipment telemetry on wide screens.</p>
                    </div>
                    <button
                      type="button"
                      className={`toggle ${formData.compact_density ? 'on' : ''}`}
                      onClick={() => handleChange('compact_density', !formData.compact_density)}
                      aria-label="Toggle compact data density"
                    >
                      <span />
                    </button>
                  </div>
                  <div className="setting-row">
                    <div>
                      <strong>Color Theme</strong>
                      <p>Control Tower theme: Dark Glassmorphic Operations Mode (Active).</p>
                    </div>
                    <span className="theme-badge">Dark Mode (Default)</span>
                  </div>
                </div>
              )}

              {/* System Section */}
              {activeSection === 'System' && (
                <div className="settings-content system-section">
                  <div className="system-grid">
                    <div className="system-stat-card">
                      <Database size={18} className="stat-icon green" />
                      <div>
                        <span className="stat-label">PostgreSQL Database</span>
                        <strong>{systemConfig?.database?.configured ? 'Connected & Healthy' : 'PostgreSQL 16'}</strong>
                        <small>{systemConfig?.database?.masked_url || 'supply_chain_ai'}</small>
                      </div>
                    </div>
                    <div className="system-stat-card">
                      <Zap size={18} className="stat-icon orange" />
                      <div>
                        <span className="stat-label">Redis Caching Gateway</span>
                        <strong>{systemConfig?.redis?.enabled ? 'Active (TTL Caching)' : 'In-Memory Fallback'}</strong>
                        <small>{systemConfig?.redis?.masked_url || 'redis://localhost:6379'}</small>
                      </div>
                    </div>
                    <div className="system-stat-card">
                      <Shield size={18} className="stat-icon blue" />
                      <div>
                        <span className="stat-label">AI Disruption Engine</span>
                        <strong>XGBoost + PureTreeSHAP</strong>
                        <small>Canonical Model v1.0 (Loaded)</small>
                      </div>
                    </div>
                    <div className="system-stat-card">
                      <Activity size={18} className="stat-icon purple" />
                      <div>
                        <span className="stat-label">Routing Subsystem</span>
                        <strong>NetworkX Dijkstra Multigraph</strong>
                        <small>Global Corridors & Waypoints</small>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* API Configuration Section */}
              {activeSection === 'API Configuration' && (
                <div className="settings-content api-section">
                  <div className="api-providers-list">
                    <div className="api-provider-row">
                      <Globe size={18} className="provider-icon" />
                      <div className="provider-info">
                        <strong>Open-Meteo Global Weather Telemetry</strong>
                        <p>Real-time storm surge, wave height, and wind velocity feeds.</p>
                        <small>Status: Active (Mock Fallback Enabled)</small>
                      </div>
                      <span className="provider-status live">CONNECTED</span>
                    </div>

                    <div className="api-provider-row">
                      <HardDrive size={18} className="provider-icon" />
                      <div className="provider-info">
                        <strong>PortWatch Maritime Congestion Feed</strong>
                        <p>Vessel queue times, berth utilization, and dwell indices.</p>
                        <small>Status: Active (Mock Fallback Enabled)</small>
                      </div>
                      <span className="provider-status live">CONNECTED</span>
                    </div>

                    <div className="api-provider-row">
                      <Activity size={18} className="provider-icon" />
                      <div className="provider-info">
                        <strong>OpenFreight Inland Corridor Highway Traffic</strong>
                        <p>Transit corridor speed deltas and border crossing wait times.</p>
                        <small>Status: Active (Mock Fallback Enabled)</small>
                      </div>
                      <span className="provider-status live">CONNECTED</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Action Area: Text on Left, Button on Right */}
              <div className="settings-actions">
                <span className="settings-persist-note">
                  {formData.updated_at
                    ? `Last saved: ${new Date(formData.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Changes persist permanently to PostgreSQL.'}
                </span>
                <button
                  type="button"
                  className="primary-save-btn"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <RefreshCw size={13} className="loading-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Check size={13} /> Save changes
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

export default Settings
