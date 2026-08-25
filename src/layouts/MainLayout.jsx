import {
  Activity,
  Bell,
  BrainCircuit,
  CircleUserRound,
  Command,
  LayoutDashboard,
  Map,
  Package,
  Search,
  Settings,
  TriangleAlert,
} from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
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
  const currentPage = navigation.find(({ path }) => location.pathname.startsWith(path))?.label ?? 'Dashboard'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Command size={17} /></span><span>SupplyChain <strong>AI</strong></span></div>
        <div className="sidebar-label">Workspace</div>
        <nav aria-label="Primary navigation">
          {navigation.map(({ label, path, icon: Icon }) => (
            <NavLink className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} end to={path} key={path} title={label}>
              <Icon size={17} /> <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile"><CircleUserRound size={30} /><span><strong>Operations team</strong><small>Admin workspace</small></span></div>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="page-heading"><span className="eyebrow">Operations / Overview</span><h2>{currentPage}</h2></div>
          <div className="topbar-actions">
            <label className="search-box"><Search size={16} /><span className="sr-only">Search</span><input type="search" placeholder="Search workspace" /></label>
            <span className="demo-badge">DEMO MODE</span>
            <button className="icon-button" aria-label="Notifications"><Bell size={18} /><span className="notification-dot" /></button>
            <div className="top-profile"><CircleUserRound size={30} /><span><strong>Alex Morgan</strong><small>Operations</small></span></div>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  )
}

export default MainLayout
