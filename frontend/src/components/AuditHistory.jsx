import { useEffect, useState, useRef } from 'react'
import { api } from '../api'
import { useLanguage } from '../i18n'

const ACTION_COLORS = {
  CREATE: { bg: '#dcfce7', color: '#16a34a' },
  UPDATE: { bg: '#dbeafe', color: '#1d4ed8' },
  DELETE: { bg: '#fee2e2', color: '#dc2626' },
}

function formatValue(v) {
  if (v === null || v === undefined) return <em style={{ color: 'var(--text-muted)' }}>—</em>
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function DiffTable({ changedKeys, before, after, t }) {
  if (!changedKeys || changedKeys.length === 0) return null
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 8 }}>
      <thead>
        <tr style={{ background: 'var(--surface-2, #f1f5f9)' }}>
          <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600 }}>{t('audit.changedFields')}</th>
          <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600 }}>{t('audit.before')}</th>
          <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600 }}>{t('audit.after')}</th>
        </tr>
      </thead>
      <tbody>
        {changedKeys.map((key) => (
          <tr key={key} style={{ borderTop: '1px solid var(--border)' }}>
            <td style={{ padding: '4px 8px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{key}</td>
            <td style={{ padding: '4px 8px', wordBreak: 'break-all' }}>
              {formatValue(before?.[key])}
            </td>
            <td style={{ padding: '4px 8px', wordBreak: 'break-all' }}>
              {formatValue(after?.[key])}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * AuditHistory
 * Props: entityType (string), entityId (string)
 *
 * Lazy-loaded — only fetches on first render.
 */
export default function AuditHistory({ entityType, entityId }) {
  const { t } = useLanguage()
  const [entries, setEntries] = useState([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const loaded = useRef(false)

  useEffect(() => {
    if (!entityType || !entityId) return
    if (loaded.current) return
    loaded.current = true
    setLoading(true)
    api.get(`/audit?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}&limit=100`)
      .then(data => {
        setEntries(data.entries || [])
        setTotal(data.total || 0)
      })
      .catch(err => setError(err.message || 'Error loading history'))
      .finally(() => setLoading(false))
  }, [entityType, entityId])

  if (loading) {
    return (
      <div className="loading" style={{ fontSize: 14, padding: '24px 0' }}>
        <div className="spinner" /> {t('common.loading')}
      </div>
    )
  }

  if (error) {
    return <div className="alert alert-error" style={{ fontSize: 13 }}>{error}</div>
  }

  if (entries.length === 0) {
    return (
      <div style={{ fontSize: 14, color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' }}>
        {t('audit.noHistory')}
      </div>
    )
  }

  const actionLabel = (action) => {
    if (action === 'CREATE') return t('audit.actionCreate')
    if (action === 'UPDATE') return t('audit.actionUpdate')
    if (action === 'DELETE') return t('audit.actionDelete')
    return action
  }

  return (
    <div style={{ maxWidth: 900 }}>
      {total > entries.length && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          Showing {entries.length} of {total} entries
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {entries.map((entry) => {
          const ac = ACTION_COLORS[entry.action] || ACTION_COLORS.UPDATE
          const ts = new Date(entry.createdAt)
          const when = ts.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          return (
            <div key={entry.id} className="card" style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: entry.action === 'UPDATE' && entry.changedKeys?.length > 0 ? 6 : 0 }}>
                <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: ac.bg, color: ac.color }}>
                  {actionLabel(entry.action)}
                </span>
                {entry.userName && (
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {t('audit.by')} <strong style={{ color: 'var(--text)' }}>{entry.userName}</strong>
                  </span>
                )}
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {t('audit.at')} {when}
                </span>
              </div>
              {entry.action === 'UPDATE' && (
                <DiffTable
                  changedKeys={entry.changedKeys}
                  before={entry.before}
                  after={entry.after}
                  t={t}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
