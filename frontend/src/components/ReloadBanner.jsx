import { useLanguage } from '../i18n'
import useVersionCheck from '../hooks/useVersionCheck'

export default function ReloadBanner() {
  const { t } = useLanguage()
  const { updateAvailable, dismiss } = useVersionCheck()

  if (!updateAvailable) return null

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 12,
      background: '#1e293b', color: '#f8fafc',
      padding: '12px 20px', borderRadius: 10,
      boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
      fontSize: 14, whiteSpace: 'nowrap',
    }}>
      <span>🔄 {t('common.versionBannerMessage')}</span>
      <button
        onClick={() => window.location.reload()}
        style={{
          background: 'var(--primary, #2563eb)', color: '#fff', border: 'none',
          borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
        }}
      >
        {t('common.versionBannerReload')}
      </button>
      <button
        onClick={dismiss}
        style={{
          background: 'transparent', color: '#94a3b8', border: 'none',
          cursor: 'pointer', fontSize: 13, padding: '5px 4px',
        }}
        aria-label={t('common.versionBannerDismiss')}
      >
        ✕
      </button>
    </div>
  )
}
