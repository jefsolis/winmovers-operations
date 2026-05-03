import { useEffect, useState } from 'react'
import { api } from '../../api'

import { useLanguage } from '../../i18n'

export default function AdminPage() {
  const { t } = useLanguage()
  const [counters, setCounters] = useState([])
  const [values, setValues]     = useState({})
  const [version, setVersion]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState(null)

  // Purge state
  const [purgeInfo, setPurgeInfo]     = useState(null)   // { count, retentionDays, cutoff }
  const [purgeChecking, setPurgeChecking] = useState(false)
  const [purging, setPurging]         = useState(false)
  const [purgeResult, setPurgeResult] = useState(null)
  const [purgeError, setPurgeError]   = useState(null)

  const checkPurge = async () => {
    setPurgeChecking(true)
    setPurgeError(null)
    setPurgeResult(null)
    try {
      const data = await api.get('/admin/audit/purge')
      setPurgeInfo(data)
    } catch (e) {
      setPurgeError(e.message)
    } finally {
      setPurgeChecking(false)
    }
  }

  const handlePurge = async () => {
    if (!purgeInfo || purgeInfo.count === 0) return
    const cutoffStr = new Date(purgeInfo.cutoff).toLocaleDateString()
    if (!window.confirm(
      t('admin.purgeConfirm')
        .replace('{{count}}', purgeInfo.count)
        .replace('{{cutoff}}', cutoffStr)
    )) return
    setPurging(true)
    setPurgeError(null)
    try {
      const data = await api.post('/admin/audit/purge')
      setPurgeResult(data.purgedCount)
      setPurgeInfo(null)
    } catch (e) {
      setPurgeError(e.message)
    } finally {
      setPurging(false)
    }
  }

  useEffect(() => {
    api.get('/admin/version').then(setVersion).catch(() => {})
    api.get('/admin/counters')
      .then(data => {
        setCounters(data)
        const init = {}
        data.forEach(c => { init[c.key] = String(c.effectiveNext) })
        setValues(init)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      await api.put('/admin/counters', values)
      // Refresh to show updated effective next
      const data = await api.get('/admin/counters')
      setCounters(data)
      const updated = {}
      data.forEach(c => { updated[c.key] = String(c.effectiveNext) })
      setValues(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading"><div className="spinner" /></div>

  return (
    <div className="page-content" style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">{t('admin.title')}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>{t('admin.subtitle')}</p>
      </div>

      {version && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body" style={{ padding: '14px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 10 }}>
              {t('admin.versionSection')}
            </div>
            <div style={{ display: 'flex', gap: 32, fontSize: 14 }}>
              <div><span style={{ color: 'var(--text-muted)' }}>{t('admin.buildVersion')}:</span> <strong>{version.build}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>{t('admin.buildCommit')}:</span> <code>{version.commit}</code></div>
              <div><span style={{ color: 'var(--text-muted)' }}>{t('admin.buildDate')}:</span> {new Date(version.date).toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}
      {saved && <div className="alert alert-success" style={{ marginBottom: 16 }}>{t('admin.saved')}</div>}

      <form onSubmit={handleSave}>
        <div className="card">
          <div className="card-body">
            <div style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 16 }}>
              {t('admin.countersSection')}
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>{t('admin.countersHint')}</p>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, color: 'var(--text-muted)' }}>{t('admin.sequence')}</th>
                  <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 600, color: 'var(--text-muted)' }}>{t('admin.lastUsed')}</th>
                  <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 600, color: 'var(--text-muted)' }}>{t('admin.nextNumber')}</th>
                </tr>
              </thead>
              <tbody>
                {counters.map(c => (
                  <tr key={c.key} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ fontWeight: 500 }}>{t(`admin.counterLabels.${c.key.replace('counter.', '')}`)}</div>
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      {c.lastUsed ?? '—'}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="form-control"
                        style={{ width: 100, textAlign: 'center', margin: '0 auto', display: 'block' }}
                        value={values[c.key] ?? ''}
                        onChange={e => setValues(prev => ({ ...prev, [c.key]: e.target.value }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>

      {/* Audit Log Purge */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-body">
          <div style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 10 }}>
            {t('admin.purgeSection')}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{t('admin.purgeHint')}</p>

          {purgeError && <div className="alert alert-error" style={{ marginBottom: 12, fontSize: 13 }}>{purgeError}</div>}
          {purgeResult != null && (
            <div className="alert alert-success" style={{ marginBottom: 12, fontSize: 13 }}>
              {t('admin.purgeSuccess').replace('{{count}}', purgeResult)}
            </div>
          )}

          {purgeInfo && (
            <div style={{ display: 'flex', gap: 32, fontSize: 13, marginBottom: 16, flexWrap: 'wrap' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>{t('admin.purgeRetentionLabel')}: </span>
                <strong>{t('admin.purgeRetentionDays').replace('{{days}}', purgeInfo.retentionDays)}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>{t('admin.purgeCutoffLabel')}: </span>
                <strong>{new Date(purgeInfo.cutoff).toLocaleDateString()}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>{t('admin.purgeEligibleLabel')}: </span>
                <strong style={{ color: purgeInfo.count > 0 ? '#dc2626' : 'inherit' }}>
                  {purgeInfo.count > 0
                    ? t('admin.purgeEligibleCount').replace('{{count}}', purgeInfo.count)
                    : t('admin.purgeNoneEligible')}
                </strong>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={checkPurge} disabled={purgeChecking || purging}>
              {purgeChecking ? t('common.loading') : t('admin.purgeCheckButton')}
            </button>
            {purgeInfo && purgeInfo.count > 0 && (
              <button className="btn btn-danger" onClick={handlePurge} disabled={purging}>
                {purging ? t('common.saving') : t('admin.purgeButton')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
