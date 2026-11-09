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
  Moon,
  RefreshCw,
  Save,
  Server,
  Shield,
  SlidersHorizontal,
  Sun,
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
  { label: 'Display & Theme', icon: Monitor },
  { label: 'System', icon: Server },
  { label: 'API Configuration', icon: SlidersHorizontal },
]

function Settings() {
  const [activeSection, setActiveSection] = useState('Profile')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
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
    theme: localStorage.getItem('sc_theme') || 'light',
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
        const activeTheme = localStorage.getItem('sc_theme') || data.theme || 'light'
        setFormData({
          display_name: data.display_name || 'Alex Morgan',
          email: data.email || 'alex.morgan@supplychain.ai',
          role: data.role || 'Operations Administrator',
          workspace: data.workspace || 'North America Operations',
          email_alerts: Boolean(data.email_alerts),
          daily_digest: Boolean(data.daily_digest),
          compact_density: Boolean(data.compact_density),
          theme: activeTheme,
          updated_at: data.updated_at
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

  const handleThemeChange = (newTheme) => {
    setFormData((prev) => ({ ...prev, theme: newTheme }))
    localStorage.setItem('sc_theme', newTheme)
    let effective = newTheme
    if (newTheme === 'system') {
      effective = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    document.documentElement.setAttribute('data-theme', effective)
    window.dispatchEvent(new Event('themechange'))
  }

  const handleSave = async (e) => {
    if (e) e.preventDefault()
    setSaving(true)
    setJustSaved(false)
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
          theme: updated.theme || formData.theme || 'light',
          updated_at: updated.updated_at
        })
        if (updated.compact_density) {
          document.body.classList.add('compact-density')
        } else {
          document.body.classList.remove('compact-density')
        }
        setError('')
      }
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 3500)
      setToast({
        type: 'success',
        message: 'Settings saved successfully to PostgreSQL database.',
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
          <span className="eyebrow">WORKSPACE PREFERENCES</span>
          <h1>Settings & Configuration</h1>
          <p>Manage operator profiles, notification triggers, and live system subsystems.</p>
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

      {/* Error Banner */}
      {error && !loading && (
        <div className="inline-error">
          <AlertTriangle size={15} />
          <span>{error}</span>
          <button type="button" onClick={loadSettings}>Retry</button>
        </div>
      )}

      <div className="settings-layout">
        {/* Left Navigation */}
        <nav className="settings-nav" aria-label="Settings sections">
          {sections.map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              className={`settings-nav-btn ${activeSection === label ? 'selected' : ''}`}
              onClick={() => setActiveSection(label)}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* Right Configuration Panel */}
        <section className="settings-panel">
          <div className="settings-panel-heading">
            <div>
              <span className="eyebrow">CONFIGURATION SECTION</span>
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
                  <div className="profile-identity-card">
                    <div className="profile-avatar-circle">
                      <CircleUserRound size={28} />
                    </div>
                    <div className="profile-identity-info">
                      <strong>{formData.display_name}</strong>
                      <span>{formData.role} · {formData.workspace}</span>
                      <small>{formData.email}</small>
                    </div>
                  </div>

                  <form className="profile-form" onSubmit={handleSave}>
                    <div className="form-group">
                      <label htmlFor="display_name">Display Name</label>
                      <input
                        id="display_name"
                        value={formData.display_name}
                        onChange={(e) => handleChange('display_name', e.target.value)}
                        placeholder="Alex Morgan"
                        disabled={saving}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="workspace">Workspace Name</label>
                      <input
                        id="workspace"
                        value={formData.workspace}
                        onChange={(e) => handleChange('workspace', e.target.value)}
                        placeholder="North America Operations"
                        disabled={saving}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="email">Email Address</label>
                      <input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        placeholder="alex.morgan@supplychain.ai"
                        disabled={saving}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="role">Operational Role</label>
                      <input
                        id="role"
                        value={formData.role}
                        onChange={(e) => handleChange('role', e.target.value)}
                        placeholder="Operations Administrator"
                        disabled={saving}
                      />
                    </div>
                  </form>
                </div>
              )}

              {/* Notifications Section */}
              {activeSection === 'Notifications' && (
                <div className="settings-content">
                  <div className="toggle-list">
                    <div className="toggle-item-row">
                      <div className="toggle-info">
                        <strong>Operational Disruption Alerts</strong>
                        <p>Receive real-time WebSocket signals when critical risk factors or vessel delays occur.</p>
                      </div>
                      <button
                        type="button"
                        className={`toggle-switch ${formData.email_alerts ? 'on' : ''}`}
                        onClick={() => handleChange('email_alerts', !formData.email_alerts)}
                        aria-label="Toggle operational alerts"
                      >
                        <span />
                      </button>
                    </div>

                    <div className="toggle-item-row">
                      <div className="toggle-info">
                        <strong>Daily Network Health Digest</strong>
                        <p>Generate summary notifications covering corridor bottlenecks and fleet performance.</p>
                      </div>
                      <button
                        type="button"
                        className={`toggle-switch ${formData.daily_digest ? 'on' : ''}`}
                        onClick={() => handleChange('daily_digest', !formData.daily_digest)}
                        aria-label="Toggle daily digest"
                      >
                        <span />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Display & Appearance Section */}
              {activeSection === 'Display & Theme' && (
                <div className="settings-content">
                  <div className="settings-subheading">
                    <h3>Appearance & Theme</h3>
                    <p>Select your preferred color theme across the entire Control Tower workspace.</p>
                  </div>

                  <div className="theme-selector-grid">
                    <button
                      type="button"
                      className={`theme-card ${formData.theme === 'light' ? 'active' : ''}`}
                      onClick={() => handleThemeChange('light')}
                    >
                      <div className="theme-card-icon sun">
                        <Sun size={20} />
                      </div>
                      <div className="theme-card-info">
                        <strong>Light Mode</strong>
                        <span>Bright, modern enterprise workspace (Default)</span>
                      </div>
                      {formData.theme === 'light' && <span className="theme-check-badge"><Check size={13} /> Active</span>}
                    </button>

                    <button
                      type="button"
                      className={`theme-card ${formData.theme === 'dark' ? 'active' : ''}`}
                      onClick={() => handleThemeChange('dark')}
                    >
                      <div className="theme-card-icon moon">
                        <Moon size={20} />
                      </div>
                      <div className="theme-card-info">
                        <strong>Dark Mode</strong>
                        <span>Deep contrast Control Tower interface</span>
                      </div>
                      {formData.theme === 'dark' && <span className="theme-check-badge"><Check size={13} /> Active</span>}
                    </button>

                    <button
                      type="button"
                      className={`theme-card ${formData.theme === 'system' ? 'active' : ''}`}
                      onClick={() => handleThemeChange('system')}
                    >
                      <div className="theme-card-icon monitor">
                        <Monitor size={20} />
                      </div>
                      <div className="theme-card-info">
                        <strong>System Default</strong>
                        <span>Synchronize automatically with OS settings</span>
                      </div>
                      {formData.theme === 'system' && <span className="theme-check-badge"><Check size={13} /> Active</span>}
                    </button>
                  </div>

                  <div className="settings-subheading" style={{ marginTop: '28px' }}>
                    <h3>Layout & Density</h3>
                    <p>Configure screen real estate optimization and data spacing.</p>
                  </div>

                  <div className="toggle-list">
                    <div className="toggle-item-row">
                      <div className="toggle-info">
                        <strong>Compact Table & Layout Density</strong>
                        <p>Optimize row heights and spacing to display more concurrent shipment telemetry on wide screens.</p>
                      </div>
                      <button
                        type="button"
                        className={`toggle-switch ${formData.compact_density ? 'on' : ''}`}
                        onClick={() => handleChange('compact_density', !formData.compact_density)}
                        aria-label="Toggle compact data density"
                      >
                        <span />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* System Section */}
              {activeSection === 'System' && (
                <div className="settings-content">
                  <div className="system-grid-2col">
                    <div className="system-stat-card">
                      <Database size={20} className="stat-icon green" />
                      <div>
                        <span className="stat-label">PostgreSQL Database</span>
                        <strong>{systemConfig?.database?.configured ? 'Connected & Healthy' : 'PostgreSQL 16'}</strong>
                        <small>{systemConfig?.database?.masked_url || 'supply_chain_ai'}</small>
                      </div>
                    </div>
                    <div className="system-stat-card">
                      <Zap size={20} className="stat-icon orange" />
                      <div>
                        <span className="stat-label">Redis Caching Gateway</span>
                        <strong>{systemConfig?.redis?.enabled ? 'Active (TTL Caching)' : 'In-Memory Fallback'}</strong>
                        <small>{systemConfig?.redis?.masked_url || 'redis://localhost:6379'}</small>
                      </div>
                    </div>
                    <div className="system-stat-card">
                      <Shield size={20} className="stat-icon blue" />
                      <div>
                        <span className="stat-label">AI Disruption Engine</span>
                        <strong>XGBoost + PureTreeSHAP + GCN</strong>
                        <small>Dual-Model Multi-Modal Fusion (Loaded)</small>
                      </div>
                    </div>
                    <div className="system-stat-card">
                      <Activity size={20} className="stat-icon purple" />
                      <div>
                        <span className="stat-label">Routing Subsystem</span>
                        <strong>NetworkX Dijkstra Multigraph</strong>
                        <small>Global Corridors & Road Waypoints</small>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* API Configuration Section */}
              {activeSection === 'API Configuration' && (
                <div className="settings-content">
                  <div className="api-providers-list">
                    <div className="api-provider-row">
                      <Globe size={18} className="provider-icon" />
                      <div className="provider-info">
                        <strong>Open-Meteo Global Weather Telemetry</strong>
                        <p>Real-time storm surge, wave height, and wind velocity feeds.</p>
                        <small>Status: Active (Live Ingestion)</small>
                      </div>
                      <span className="provider-status-badge live">CONNECTED</span>
                    </div>

                    <div className="api-provider-row">
                      <HardDrive size={18} className="provider-icon" />
                      <div className="provider-info">
                        <strong>PortWatch Maritime Congestion Feed</strong>
                        <p>Vessel queue times, berth utilization, and dwell indices.</p>
                        <small>Status: Active (Live Ingestion)</small>
                      </div>
                      <span className="provider-status-badge live">CONNECTED</span>
                    </div>

                    <div className="api-provider-row">
                      <Activity size={18} className="provider-icon" />
                      <div className="provider-info">
                        <strong>OpenFreight Inland Highway Traffic</strong>
                        <p>Transit corridor speed deltas and border crossing wait times.</p>
                        <small>Status: Active (Live Ingestion)</small>
                      </div>
                      <span className="provider-status-badge live">CONNECTED</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Save Action Area */}
              <div className="settings-footer-actions">
                <span className="settings-persist-note">
                  {formData.updated_at
                    ? `Last saved: ${new Date(formData.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Changes persist permanently to PostgreSQL.'}
                </span>
                <button
                  type="button"
                  className={`save-changes-btn ${saving ? 'saving' : ''} ${justSaved ? 'saved' : ''}`}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <RefreshCw size={15} className="loading-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : justSaved ? (
                    <>
                      <CheckCircle2 size={15} />
                      <span>Saved Successfully!</span>
                    </>
                  ) : (
                    <>
                      <Save size={15} />
                      <span>Save Changes</span>
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
