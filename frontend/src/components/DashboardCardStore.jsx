import { useEffect } from 'react'
import { DASHBOARD_CARDS } from '../dashboardCards'
import { useLanguage } from '../i18n'

function Toggle({ checked, disabled, onChange }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      title={disabled ? undefined : undefined}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked && !disabled ? '#2563eb' : '#cbd5e1',
        padding: 2, transition: 'background 0.2s',
        display: 'flex', alignItems: 'center', flexShrink: 0,
      }}
    >
      <span style={{
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        transform: (checked && !disabled) ? 'translateX(20px)' : 'translateX(0)',
        transition: 'transform 0.2s', display: 'block',
      }} />
    </button>
  )
}

export default function DashboardCardStore({ isVisible, toggle, reset, onClose }) {
  const { t } = useLanguage()

  // Close on Escape
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.35)',
          zIndex: 1000,
        }}
      />

      {/* Drawer panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 420, maxWidth: '100vw',
        background: '#fff', zIndex: 1001,
        boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{t('dashboard.store.title')}</div>
            <button
              onClick={onClose}
              style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1, padding: '0 2px' }}
            >
              ×
            </button>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {t('dashboard.store.subtitle')}
          </div>
        </div>

        {/* Card list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 24px' }}>
          {DASHBOARD_CARDS.map(card => (
            <div
              key={card.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 14,
                padding: '14px 0',
                borderBottom: '1px solid var(--border)',
                opacity: card.comingSoon ? 0.6 : 1,
              }}
            >
              <Toggle
                checked={isVisible(card.id)}
                disabled={Boolean(card.comingSoon)}
                onChange={() => !card.comingSoon && toggle(card.id)}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{t(card.titleKey)}</span>
                  {card.comingSoon && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, letterSpacing: 0.3,
                      background: '#eff6ff', color: '#2563eb',
                      border: '1px solid #bfdbfe', borderRadius: 8,
                      padding: '1px 6px',
                    }}>
                      {t('dashboard.store.comingSoon')}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {t(card.descKey)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <button
            onClick={reset}
            className="btn btn-secondary btn-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            {t('dashboard.store.resetBtn')}
          </button>
          <button onClick={onClose} className="btn btn-primary">
            {t('dashboard.store.done')}
          </button>
        </div>
      </div>
    </>
  )
}
