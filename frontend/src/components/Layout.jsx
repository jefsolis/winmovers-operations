import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useLanguage } from '../i18n'
import { useMsal } from '@azure/msal-react'
import { useCurrentStaff } from '../hooks/useCurrentStaff'

export default function Layout() {
  const { t, toggleLang } = useLanguage()
  const [open, setOpen] = useState(false)
  const { instance, accounts } = useMsal()
  const user = accounts[0]
  const displayName = user?.name || user?.username || ''
  const currentStaff = useCurrentStaff()
  const isAdmin = currentStaff?.role === 'ADMIN'

  const handleLogout = () => instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin })

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
    ...(isAdmin ? [{ to: '/admin', label: t('nav.admin'), icon: '⚙️' }] : []),
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
          {displayName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '6px 4px', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                color: 'var(--sidebar-text)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, flexShrink: 0,
              }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: 12, color: 'var(--sidebar-text)', opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {displayName}
              </span>
              <button
                onClick={handleLogout}
                title={t('nav.signOut')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sidebar-text)', opacity: 0.7, padding: '2px 4px', flexShrink: 0, display: 'flex', alignItems: 'center' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="main-content">
        <div className="topbar">
          <button className="hamburger" onClick={() => setOpen(true)}>☰</button>
          <span className="topbar-brand">🚚 WinMovers</span>
          <div className="topbar-user" style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            {displayName && (
              <span style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                👤 {displayName}
              </span>
            )}
            <button className="btn-lang" onClick={toggleLang}>🌐 {t('nav.language')}</button>
            <button className="btn-lang" onClick={handleLogout} title="Sign out">🚪</button>
          </div>
        </div>
        <div className="page-wrapper">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
