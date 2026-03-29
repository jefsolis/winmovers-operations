import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useLanguage } from '../i18n'

export default function Layout() {
  const { t, toggleLang } = useLanguage()
  const [open, setOpen] = useState(false)

  const nav = [
    { to: '/dashboard', label: t('nav.dashboard'), icon: '⬛' },
    { to: '/visits',    label: t('nav.visits'),    icon: '📅' },
    { to: '/quotes',    label: t('nav.quotes'),    icon: '💬' },
    { to: '/jobs',            label: t('nav.jobs'),        icon: '📦' },
    { to: '/files/export',   label: t('nav.exportFiles'), icon: '📤' },
    { to: '/files/import',   label: t('nav.importFiles'), icon: '📥' },
    { to: '/files/local',    label: t('nav.localFiles'),  icon: '🏠' },
    { to: '/clients',        label: t('nav.clients'),     icon: '🏢' },
    { to: '/agents',    label: t('nav.agents'),    icon: '🤝' },
    { to: '/staff',     label: t('nav.staff'),     icon: '👷' },
    { to: '/admin',     label: t('nav.admin'),     icon: '⚙️' },
  ]

  return (
    <div className="app-shell">
      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}

      <aside className={`sidebar${open ? ' sidebar--open' : ''}`}>
        <div className="sidebar-logo">
          <span className="logo-icon">🚚</span>
          <div>
            <div className="logo-title">WinMovers</div>
            <div className="logo-sub">Operations</div>
          </div>
          <button className="sidebar-close" onClick={() => setOpen(false)}>✕</button>
        </div>
        <nav className="sidebar-nav">
          {nav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              onClick={() => setOpen(false)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="btn-lang" onClick={toggleLang}>🌐 {t('nav.language')}</button>
        </div>
      </aside>

      <main className="main-content">
        <div className="topbar">
          <button className="hamburger" onClick={() => setOpen(true)}>☰</button>
          <span className="topbar-brand">🚚 WinMovers</span>
          <button className="btn-lang" onClick={toggleLang}>🌐 {t('nav.language')}</button>
        </div>
        <div className="page-wrapper">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
