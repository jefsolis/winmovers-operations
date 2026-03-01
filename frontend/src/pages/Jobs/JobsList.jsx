import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { statusMeta, typeMeta, formatDate, JOB_STATUSES, JOB_TYPES } from '../../constants'

export default function JobsList() {
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
    if (!window.confirm(`Delete job ${jobNumber}?`)) return
    try {
      await api.delete(`/jobs/${id}`)
      setJobs(prev => prev.filter(j => j.id !== id))
    } catch (e) { alert(e.message) }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Jobs</div>
          <div className="page-subtitle">{jobs.length} job{jobs.length !== 1 ? 's' : ''}</div>
        </div>
        <Link to="/jobs/new" className="btn btn-primary">+ New Job</Link>
      </div>

      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Search jobs, shippers, cities…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {JOB_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        <div className="table-wrap">
          {loading
            ? <div className="loading"><div className="spinner" /> Loading...</div>
            : jobs.length === 0
              ? <div className="empty-state">
                  <div className="empty-state-icon">📦</div>
                  <h3>No jobs found</h3>
                  <p>Try adjusting filters or <Link to="/jobs/new" style={{ color: 'var(--primary)' }}>create a new job</Link>.</p>
                </div>
              : <table>
                  <thead>
                    <tr>
                      <th>Job #</th>
                      <th>Shipper</th>
                      <th>Client</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Route</th>
                      <th>Move Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map(job => {
                      const sm = statusMeta(job.status)
                      const tm = typeMeta(job.type)
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
                            <Link to={`/jobs/${job.id}/edit`} className="btn btn-ghost btn-sm">Edit</Link>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(job.id, job.jobNumber)}>Del</button>
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
