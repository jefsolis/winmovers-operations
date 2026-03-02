import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { visitStatusMeta, getVisitStatuses } from '../../constants'
import { useLanguage } from '../../i18n'
import { formatDate } from '../../constants'

export default function VisitsList() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const VISIT_STATUSES = getVisitStatuses(t)

  const [visits, setVisits]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState('')

  const load = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search)       params.set('search', search)
    if (statusFilter) params.set('status', statusFilter)
    api.get(`/visits?${params}`).then(setVisits).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [statusFilter]) // eslint-disable-line
  const handleSearch = e => { e.preventDefault(); load() }

  const handleDelete = async (v) => {
    if (!window.confirm(t('visits.deleteConfirm', { num: v.visitNumber }))) return
    await api.delete(`/visits/${v.id}`)
    setVisits(prev => prev.filter(x => x.id !== v.id))
  }

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
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, flex: 1 }}>
            <input
              className="form-control search-input"
              placeholder={t('visits.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary">{t('common.search')}</button>
          </form>
          <select className="form-control" style={{ width: 170 }} value={statusFilter} onChange={e => setStatus(e.target.value)}>
            <option value="">{t('visits.allStatuses')}</option>
            {VISIT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
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
                      <th>{t('jobs.status')}</th>
                      <th>{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.map(v => {
                      const m = visitStatusMeta(v.status, t)
                      const serviceLabel = v.serviceType ? t(`serviceTypes.${v.serviceType}`) : '—'
                      const route = [v.originCountry, v.destCountry].filter(Boolean).join(' → ') || '—'
                      return (
                        <tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/visits/${v.id}`)}>
                          <td><strong>{v.visitNumber}</strong></td>
                          <td>{displayName(v)}</td>
                          <td>{serviceLabel}</td>
                          <td>{route}</td>
                          <td>{formatDate(v.scheduledDate)}</td>
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
