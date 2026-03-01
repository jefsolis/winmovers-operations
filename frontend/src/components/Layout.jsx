import { NavLink, Outlet } from 'react-router-dom'

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: '⬛' },
  { to: '/jobs',      label: 'Jobs',      icon: '📦' },
  { to: '/clients',   label: 'Clients',   icon: '🏢' },
  { to: '/contacts',  label: 'Contacts',  icon: '👤' }
]

export default function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="logo-icon">🚚</span>
          <div>
            <div className="logo-title">WinMovers</div>
            <div className="logo-sub">Operations</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {nav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <div className="page-wrapper">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
