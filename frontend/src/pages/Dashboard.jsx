import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { api } from '../api'
import { statusMeta, formatDate } from '../constants'
import { useLanguage } from '../i18n'

const MODE_COLORS  = { ROAD: '#6366f1', SEA: '#0ea5e9', AIR: '#f59e0b', COMBINED: '#10b981' }
const TYPE_COLORS  = { INTERNATIONAL: '#2563eb', DOMESTIC: '#16a34a' }
const STATUS_COLORS = {
  SURVEY: '#94a3b8', QUOTATION: '#3b82f6', BOOKING: '#8b5cf6',
  PRE_MOVE: '#f59e0b', IN_TRANSIT: '#eab308', DELIVERED: '#22c55e',
  CLOSED: '#10b981', CANCELLED: '#ef4444',
}

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtMonth(key) {
  const [, m] = key.split('-')
  return MONTH_ABBR[parseInt(m, 10) - 1]
}

const makeBarTooltip = (label) => ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{payload[0].payload.month}</div>
      <div style={{ color: '#2563eb' }}>{payload[0].value} {label}</div>
    </div>
  )
}

const makePieTooltip = (label) => ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
      <div style={{ fontWeight: 600 }}>{payload[0].name}</div>
      <div style={{ color: '#64748b' }}>{payload[0].value} {label}</div>
    </div>
  )
}

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

  const { totalJobs, activeJobs, totalClients, totalContacts,
          jobsByStatus, jobsByType, jobsByMode, jobsByMonth, recentJobs } = data

  const monthData   = (jobsByMonth || []).map(d => ({ ...d, month: fmtMonth(d.month) }))
  const statusData  = jobsByStatus.map(s => ({ name: statusMeta(s.status, t).label, value: s.count, key: s.status }))
  const modeData    = (jobsByMode || []).map(m => ({ name: t(`modes.${m.mode}`), value: m.count, key: m.mode }))
  const typeData    = jobsByType.map(tp => ({ name: t(`types.${tp.type}`), value: tp.count, key: tp.type }))

  const hasMonthData = monthData.some(d => d.count > 0)
  const hasModeData  = modeData.length > 0

  const jobsLabel  = t('nav.jobs')
  const BarTooltip = makeBarTooltip(jobsLabel)
  const PieTooltip = makePieTooltip(jobsLabel)

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{t('dashboard.title')}</div>
          <div className="page-subtitle">{t('dashboard.subtitle')}</div>
        </div>
        <Link to="/jobs/new" className="btn btn-primary">{t('jobs.newJob')}</Link>
      </div>

      {/* KPI cards */}
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

      {/* Monthly bar chart */}
      <div className="card card-body" style={{ marginBottom: 20 }}>
        <div className="section-label" style={{ marginBottom: 16 }}>{t('dashboard.jobsPerMonth')}</div>
        {!hasMonthData
          ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('dashboard.noJobs')}</p>
          : <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={BarTooltip} cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
        }
      </div>

      {/* Status + Mode + Type row */}
      <div style={{ display: 'grid', gridTemplateColumns: hasModeData ? '1fr 1fr 1fr' : '1fr 1fr', gap: 16, marginBottom: 20 }}>

        {/* Status donut */}
        <div className="card card-body">
          <div className="section-label" style={{ marginBottom: 8 }}>{t('dashboard.byStatus')}</div>
          {jobsByStatus.length === 0
            ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('dashboard.noJobs')}</p>
            : <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                         innerRadius={50} outerRadius={78} paddingAngle={2}>
                      {statusData.map(d => (
                        <Cell key={d.key} fill={STATUS_COLORS[d.key] || '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip content={PieTooltip} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="status-list" style={{ marginTop: 4 }}>
                  {jobsByStatus.map(({ status, count }) => {
                    const m = statusMeta(status, t)
                    return (
                      <Link key={status} to={`/jobs?status=${status}`} className="status-row status-row-link">
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[status] || '#94a3b8', flexShrink: 0 }} />
                          <span className="badge" style={{ background: m.bg, color: m.color }}>{m.label}</span>
                        </span>
                        <span className="status-count">{count}</span>
                      </Link>
                    )
                  })}
                </div>
              </>
          }
        </div>

        {/* Mode donut */}
        {hasModeData && (
          <div className="card card-body">
            <div className="section-label" style={{ marginBottom: 8 }}>{t('dashboard.byMode')}</div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={modeData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                     innerRadius={50} outerRadius={78} paddingAngle={2}>
                  {modeData.map(d => (
                    <Cell key={d.key} fill={MODE_COLORS[d.key] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip content={PieTooltip} />
              </PieChart>
            </ResponsiveContainer>
            <div className="status-list" style={{ marginTop: 4 }}>
              {modeData.map(d => (
                <Link key={d.key} to={`/jobs?mode=${d.key}`} className="status-row status-row-link">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: MODE_COLORS[d.key] || '#94a3b8', flexShrink: 0 }} />
                    <span>{d.name}</span>
                  </span>
                  <span className="status-count">{d.value}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Type donut */}
        <div className="card card-body">
          <div className="section-label" style={{ marginBottom: 8 }}>{t('dashboard.byType')}</div>
          {typeData.length === 0
            ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('dashboard.noJobs')}</p>
            : <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                         innerRadius={50} outerRadius={78} paddingAngle={2}>
                      {typeData.map(d => (
                        <Cell key={d.key} fill={TYPE_COLORS[d.key] || '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip content={PieTooltip} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="status-list" style={{ marginTop: 4 }}>
                  {typeData.map(d => (
                    <Link key={d.key} to={`/jobs?type=${d.key}`} className="status-row status-row-link">
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_COLORS[d.key] || '#94a3b8', flexShrink: 0 }} />
                        <span>{d.key === 'INTERNATIONAL' ? `🌍 ${d.name}` : `🏠 ${d.name}`}</span>
                      </span>
                      <span className="status-count">{d.value}</span>
                    </Link>
                  ))}
                </div>
              </>
          }
        </div>

      </div>

      {/* Recent jobs */}
      {recentJobs.length > 0 && (
        <div className="card">
          <div className="card-body" style={{ paddingBottom: 0 }}>
            <div className="section-label">{t('dashboard.recentJobs')}</div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('dashboard.jobNumber')}</th>
                  <th>{t('dashboard.shipper')}</th>
                  <th>{t('dashboard.route')}</th>
                  <th>{t('jobs.status')}</th>
                  <th>{t('dashboard.moveDate')}</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map(job => {
                  const m = statusMeta(job.status, t)
                  return (
                    <tr key={job.id} className="recent-job-row">
                      <td><Link to={`/jobs/${job.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>{job.jobNumber}</Link></td>
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

