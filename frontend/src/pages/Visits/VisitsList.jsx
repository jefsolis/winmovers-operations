import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { visitStatusMeta, getVisitStatuses } from '../../constants'
import { useLanguage } from '../../i18n'
import { formatDateTime } from '../../constants'

export default function VisitsList() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const VISIT_STATUSES = getVisitStatuses(t)

  const TERMINAL = ['CLOSED']

  const [visits, setVisits]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [showClosed, setShowClosed] = useState(false)
  const [selectedStatuses, setSelectedStatuses] = useState(new Set())

  const load = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search)       params.set('search', search)
    api.get(`/visits?${params}`).then(d => setVisits(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [search]) // eslint-disable-line

  const handleDelete = async (v) => {
    if (!window.confirm(t('visits.deleteConfirm', { num: v.visitNumber }))) return
    await api.delete(`/visits/${v.id}`)
    setVisits(prev => prev.filter(x => x.id !== v.id))
  }

  const countByStatus = {}
  visits.forEach(v => { countByStatus[v.status] = (countByStatus[v.status] || 0) + 1 })

  const toggleStatus = (status) => {
    setSelectedStatuses(prev => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  const displayed = selectedStatuses.size > 0
    ? visits.filter(v => selectedStatuses.has(v.status))
    : (!showClosed ? visits.filter(v => !TERMINAL.includes(v.status)) : visits)

  const displayName = (v) => {
    if (v.client) return v.client.name
    if (v.contact) return `${v.contact.firstName} ${v.contact.lastName}`
    return v.prospectName || '—'
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{t('visits.title')}</div>
          <div className="page-subtitle">{t('visits.subtitle')}</div>
        </div>
        <Link to="/visits/new" className="btn btn-primary">{t('visits.newVisit')}</Link>
      </div>

      {/* Toolbar */}
      <div className="card card-body" style={{ marginBottom: 16 }}>
        <div className="toolbar">
          <input
            className="form-control search-input"
            placeholder={t('visits.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} />
            {t('common.showClosed')}
          </label>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12, alignItems: 'center' }}>
          {VISIT_STATUSES.map(s => {
            const active = selectedStatuses.has(s.value)
            const count = countByStatus[s.value] || 0
            return (
              <button
                key={s.value}
                onClick={() => toggleStatus(s.value)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 20,
                  border: active ? 'none' : '1.5px solid #d1d5db',
                  background: active ? '#dbeafe' : '#fff',
                  color: active ? '#1e40af' : '#64748b',
                  fontWeight: active ? 700 : 500, fontSize: 12, cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                {s.label}
                <span style={{
                  background: active ? 'rgba(0,0,0,0.15)' : '#e2e8f0',
                  color: active ? '#1e40af' : '#475569',
                  borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 700,
                }}>{count}</span>
              </button>
            )
          })}
          {selectedStatuses.size > 0 && (
            <button
              onClick={() => setSelectedStatuses(new Set())}
              style={{ padding: '4px 10px', borderRadius: 20, border: '1.5px solid #d1d5db', background: '#fff', color: '#64748b', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
            >
              × {t('common.filterClear')}
            </button>
          )}
        </div>
      </div>

      {loading
        ? <div className="loading"><div className="spinner" /> {t('common.loading')}</div>
        : visits.length === 0
          ? <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">{t('visits.empty')}</div>
              <div className="empty-state-desc">{t('visits.emptyHint')}</div>
            </div>
          : <div className="card">
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>{t('visits.visitNumber')}</th>
                      <th>{t('visits.prospectName')}</th>
                      <th>{t('visits.serviceType')}</th>
                      <th>{t('common.country')}</th>
                      <th>{t('visits.scheduledDate')}</th>
                      <th>{t('visits.assignedTo')}</th>
                      <th>{t('jobs.status')}</th>
                      <th>{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map(v => {
                      const m = visitStatusMeta(v.status, t)
                      const serviceLabel = v.serviceType ? t(`serviceTypes.${v.serviceType}`) : '—'
                      const route = [v.originCountry, v.destCountry].filter(Boolean).join(' → ') || '—'
                      return (
                        <tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/visits/${v.id}`)}>
                          <td><strong>{v.visitNumber}</strong></td>
                          <td>{displayName(v)}</td>
                          <td>{serviceLabel}</td>
                          <td>{route}</td>
                          <td>{formatDateTime(v.scheduledDate)}</td>
                          <td style={{ fontSize: 13, color: v.assignedTo ? 'var(--text)' : 'var(--text-muted)', fontStyle: v.assignedTo ? 'normal' : 'italic' }}>
                            {v.assignedTo ? v.assignedTo.name : t('visits.unassigned')}
                          </td>
                          <td><span className="badge" style={{ background: m.bg, color: m.color }}>{m.label}</span></td>
                          <td onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <Link to={`/visits/${v.id}/edit`} className="btn btn-secondary btn-sm">{t('common.edit')}</Link>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(v)}>{t('common.delete')}</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
      }
    </>
  )
}
