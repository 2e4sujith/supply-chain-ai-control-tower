import {
  Activity,
  Bell,
  BrainCircuit,
  Check,
  CircleUserRound,
  Command,
  LayoutDashboard,
  Map,
  Package,
  Search,
  Settings,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { getAlerts, getSettings, markAlertAsRead, wsService } from '../services/api.js'
import './MainLayout.css'

const navigation = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Shipments', path: '/shipments', icon: Package },
  { label: 'Live Map', path: '/map', icon: Map },
  { label: 'Alerts', path: '/alerts', icon: TriangleAlert },
  { label: 'Analytics', path: '/analytics', icon: Activity },
  { label: 'AI Insights', path: '/ai-insights', icon: BrainCircuit },
  { label: 'Settings', path: '/settings', icon: Settings },
]

function MainLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [liveConnected, setLiveConnected] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [userProfile, setUserProfile] = useState({
    display_name: 'Alex Morgan',
    role: 'Operations Administrator',
    workspace: 'North America Operations',
    compact_density: false,
  })
  const [unreadAlerts, setUnreadAlerts] = useState([])
  const [isNotifOpen, setIsNotifOpen] = useState(false)

  const currentPage = navigation.find(({ path }) => location.pathname.startsWith(path))?.label ?? 'Dashboard'

  // Load User Settings & Alerts
  const loadUserData = async () => {
    try {
      const s = await getSettings()
      if (s) {
        setUserProfile({
          display_name: s.display_name || 'Alex Morgan',
          role: s.role || 'Operations Administrator',
          workspace: s.workspace || 'North America Operations',
          compact_density: Boolean(s.compact_density),
        })
        if (s.compact_density) {
          document.body.classList.add('compact-density')
        } else {
          document.body.classList.remove('compact-density')
        }
      }
    } catch {
      // Fallback
    }

    try {
      const alerts = await getAlerts()
      setUnreadAlerts(alerts.filter((a) => !a.read))
    } catch {
      // Fallback
    }
  }

  useEffect(() => {
    loadUserData()
    wsService.connect()

    const unsubStatus = wsService.subscribe('connection.status', ({ connected }) => {
      setLiveConnected(connected)
    })

    const unsubSettings = wsService.subscribe('settings.updated', (data) => {
      if (data) {
        setUserProfile({
          display_name: data.display_name || 'Alex Morgan',
          role: data.role || 'Operations Administrator',
          workspace: data.workspace || 'North America Operations',
          compact_density: Boolean(data.compact_density),
        })
      }
    })

    const unsubAlertCreated = wsService.subscribe('alert.created', (data) => {
      setUnreadAlerts((prev) => [data, ...prev])
    })

    const unsubAlertUpdated = wsService.subscribe('alert.updated', (data) => {
      if (data.read) {
        setUnreadAlerts((prev) => prev.filter((a) => a.id !== (data.alert_id || data.id)))
      }
    })

    return () => {
      unsubStatus()
      unsubSettings()
      unsubAlertCreated()
      unsubAlertUpdated()
      wsService.disconnect()
    }
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/shipments?search=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  const handleMarkRead = async (id, e) => {
    e.stopPropagation()
    try {
      await markAlertAsRead(id)
      setUnreadAlerts((prev) => prev.filter((a) => a.id !== id))
    } catch {
      // Fail silently
    }
  }

  return (
    <div className={`app-shell ${userProfile.compact_density ? 'compact-mode' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><Command size={17} /></span>
          <span>SupplyChain <strong>AI</strong></span>
        </div>
        <div className="sidebar-label">Workspace</div>
        <nav aria-label="Primary navigation">
          {navigation.map(({ label, path, icon: Icon }) => (
            <NavLink className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} end to={path} key={path} title={label}>
              <Icon size={17} /> <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile">
            <CircleUserRound size={30} />
            <span>
              <strong>{userProfile.display_name}</strong>
              <small>{userProfile.workspace}</small>
            </span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="page-heading">
            <span className="eyebrow">Operations / Overview</span>
            <h2>{currentPage}</h2>
          </div>

          <div className="topbar-actions">
            <form className="search-box" onSubmit={handleSearch}>
              <Search size={16} />
              <span className="sr-only">Search workspace</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search shipments, routes..."
              />
            </form>

            <span className={`live-connection-badge ${liveConnected ? 'connected' : 'disconnected'}`} title="Real-time WebSocket connection status">
              <span className="live-dot" />
              {liveConnected ? 'LIVE STREAM' : 'OFFLINE'}
            </span>

            {/* Notifications Bell & Dropdown */}
            <div className="notifications-dropdown-container">
              <button
                type="button"
                className="icon-button"
                aria-label="Notifications"
                onClick={() => setIsNotifOpen(!isNotifOpen)}
              >
                <Bell size={18} />
                {unreadAlerts.length > 0 && <span className="notification-dot" />}
              </button>

              {isNotifOpen && (
                <div className="notifications-dropdown">
                  <div className="notifications-header">
                    <strong>Operational Alerts</strong>
                    <span className="badge">{unreadAlerts.length} unread</span>
                    <button type="button" className="close-notif-btn" onClick={() => setIsNotifOpen(false)}>
                      <X size={14} />
                    </button>
                  </div>

                  <div className="notifications-list">
                    {unreadAlerts.length === 0 ? (
                      <div className="empty-notifs">No unread alerts across the network.</div>
                    ) : (
                      unreadAlerts.slice(0, 5).map((alert) => (
                        <div className="notif-item" key={alert.id || alert.alert_id}>
                          <div className={`notif-severity ${(alert.severity || 'Medium').toLowerCase()}`} />
                          <div className="notif-content">
                            <span className="notif-shipment">{alert.shipment || alert.shipment_id}</span>
                            <p className="notif-message">{alert.message || alert.title}</p>
                          </div>
                          <button
                            type="button"
                            className="mark-read-quick-btn"
                            title="Mark as read"
                            onClick={(e) => handleMarkRead(alert.id || alert.alert_id, e)}
                          >
                            <Check size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="notifications-footer">
                    <button
                      type="button"
                      onClick={() => {
                        setIsNotifOpen(false)
                        navigate('/alerts')
                      }}
                    >
                      View All Alerts ({unreadAlerts.length}) →
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="top-profile" onClick={() => navigate('/settings')} style={{ cursor: 'pointer' }} title="Open Profile Settings">
              <CircleUserRound size={30} />
              <span>
                <strong>{userProfile.display_name}</strong>
                <small>{userProfile.role}</small>
              </span>
            </div>
          </div>
        </header>

        <Outlet />
      </main>
    </div>
  )
}

export default MainLayout
