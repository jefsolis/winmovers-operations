import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { statusMeta, formatDate } from '../constants'
import { useLanguage } from '../i18n'

export default function Dashboard() {
  const { t } = useLanguage()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/dashboard')
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading"><div className="spinner" /> {t('common.loading')}</div>
  if (error)   return <div className="alert alert-error">{error}</div>

  const { totalJobs, activeJobs, totalClients, totalContacts, jobsByStatus, jobsByType, recentJobs } = data

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{t('dashboard.title')}</div>
          <div className="page-subtitle">{t('dashboard.subtitle')}</div>
        </div>
        <Link to="/jobs/new" className="btn btn-primary">+ New Job</Link>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">{t('dashboard.totalJobs')}</div>
          <div className="kpi-value">{totalJobs}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{t('dashboard.activeJobs')}</div>
          <div className="kpi-value" style={{ color: '#2563eb' }}>{activeJobs}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{t('dashboard.totalClients')}</div>
          <div className="kpi-value">{totalClients}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{t('dashboard.totalContacts')}</div>
          <div className="kpi-value">{totalContacts}</div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card card-body">
          <div className="section-label">{t('dashboard.byStatus')}</div>
          {jobsByStatus.length === 0
            ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('dashboard.noJobs')}</p>
            : <div className="status-list">
                {jobsByStatus.map(({ status, count }) => {
                  const m = statusMeta(status)
                  return (
                    <div key={status} className="status-row">
                      <span className="badge" style={{ background: m.bg, color: m.color }}>{m.label}</span>
                      <span className="status-count">{count}</span>
                    </div>
                  )
                })}
              </div>
          }
        </div>

        <div className="card card-body">
          <div className="section-label">{t('dashboard.byType')}</div>
          {jobsByType.length === 0
            ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('dashboard.noJobs')}</p>
            : <div className="status-list">
                {jobsByType.map(({ type, count }) => (
                  <div key={type} className="status-row">
                    <span>{type === 'INTERNATIONAL' ? "🌍 Int'l" : '🏠 Domestic'}</span>
                    <span className="status-count">{count}</span>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>

      {recentJobs.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-body" style={{ paddingBottom: 0 }}>
            <div className="section-label">{t('dashboard.recentJobs')}</div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>{t('dashboard.jobNumber')}</th><th>{t('dashboard.shipper')}</th><th>{t('dashboard.route')}</th><th>{t('jobs.status')}</th><th>{t('dashboard.moveDate')}</th></tr>
              </thead>
              <tbody>
                {recentJobs.map(job => {
                  const m = statusMeta(job.status)
                  return (
                    <tr key={job.id} className="recent-job-row">
                      <td><Link to={`/jobs/${job.id}/edit`} style={{ color: 'var(--primary)', fontWeight: 600 }}>{job.jobNumber}</Link></td>
                      <td>{job.contact ? `${job.contact.firstName} ${job.contact.lastName}` : '—'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{[job.originCity, job.destCity].filter(Boolean).join(' → ') || '—'}</td>
                      <td><span className="badge" style={{ background: m.bg, color: m.color }}>{m.label}</span></td>
                      <td style={{ color: 'var(--text-muted)' }}>{formatDate(job.moveDate)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
