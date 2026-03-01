import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { statusMeta, typeMeta, formatDate, getJobStatuses, getJobTypes } from '../../constants'
import { useLanguage } from '../../i18n'

export default function JobsList() {
  const { t } = useLanguage()
  const JOB_STATUSES = getJobStatuses(t)
  const JOB_TYPES = getJobTypes(t)
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const load = () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (search)       p.set('search', search)
    if (statusFilter) p.set('status', statusFilter)
    if (typeFilter)   p.set('type', typeFilter)
    api.get(`/jobs?${p}`)
      .then(setJobs)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [search, statusFilter, typeFilter]) // eslint-disable-line

  const handleDelete = async (id, jobNumber) => {
    if (!window.confirm(t('jobs.deleteConfirm', { num: jobNumber }))) return
    try {
      await api.delete(`/jobs/${id}`)
      setJobs(prev => prev.filter(j => j.id !== id))
    } catch (e) { alert(e.message) }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{t('jobs.title')}</div>
          <div className="page-subtitle">{jobs.length === 1 ? t('jobs.subtitle_one') : t('jobs.subtitle_other', { n: jobs.length })}</div>
        </div>
        <Link to="/jobs/new" className="btn btn-primary">{t('jobs.newJob')}</Link>
      </div>

      <div className="toolbar">
        <input
          className="search-input"
          placeholder={t('jobs.searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">{t('jobs.allStatuses')}</option>
          {JOB_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">{t('jobs.allTypes')}</option>
          {JOB_TYPES.map(tp => <option key={tp.value} value={tp.value}>{tp.label}</option>)}
        </select>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        <div className="table-wrapper">
          {loading
            ? <div className="loading"><div className="spinner" /> {t('common.loading')}</div>
            : jobs.length === 0
              ? <div className="empty-state">
                  <div className="empty-state-icon">📦</div>
                  <div className="empty-state-title">{t('jobs.empty')}</div>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>{t('jobs.emptyHint')}</p>
                </div>
              : <table>
                  <thead>
                    <tr>
                      <th>{t('jobs.jobNumber')}</th>
                      <th>{t('jobs.shipper')}</th>
                      <th>{t('jobs.client')}</th>
                      <th>{t('jobs.type')}</th>
                      <th>{t('jobs.status')}</th>
                      <th>{t('jobs.route')}</th>
                      <th>{t('jobs.moveDate')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map(job => {
                      const sm = statusMeta(job.status, t)
                      const tm = typeMeta(job.type, t)
                      return (
                        <tr key={job.id}>
                          <td><Link to={`/jobs/${job.id}/edit`} style={{ color: 'var(--primary)', fontWeight: 600 }}>{job.jobNumber}</Link></td>
                          <td>{job.contact ? `${job.contact.firstName} ${job.contact.lastName}` : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{job.client?.name || '—'}</td>
                          <td><span className="badge" style={{ background: job.type === 'INTERNATIONAL' ? '#eff6ff' : '#f0fdf4', color: job.type === 'INTERNATIONAL' ? '#1e40af' : '#166534' }}>{tm.label}</span></td>
                          <td><span className="badge" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span></td>
                          <td style={{ color: 'var(--text-muted)' }}>{[job.originCity, job.destCity].filter(Boolean).join(' → ') || '—'}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{formatDate(job.moveDate)}</td>
                          <td className="td-actions">
                            <Link to={`/jobs/${job.id}/edit`} className="btn btn-ghost btn-sm">{t('common.edit')}</Link>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(job.id, job.jobNumber)}>{t('common.delete')}</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
          }
        </div>
      </div>
    </>
  )
}
