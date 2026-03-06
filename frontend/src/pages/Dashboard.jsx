import React, { useEffect, useState } from 'react'
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

const ACTIVITY_COLORS = { visits: '#0d9488', quotes: '#8b5cf6', jobs: '#2563eb' }

const ActivityTooltip = ({ active, payload, label: month }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{month}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.fill, marginBottom: 2 }}>{p.name}: {p.value}</div>
      ))}
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

function clientName(obj) {
  if (!obj) return '—'
  return obj.clientType === 'INDIVIDUAL'
    ? `${obj.firstName || ''} ${obj.lastName || ''}`.trim() || obj.name
    : obj.name
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

  const {
    totalJobs, activeJobs, totalClients,
    jobsByStatus, jobsByType, jobsByMode, jobsByMonth, recentJobs,
    openVisits, pendingQuotes, conversionRate,
    pipeline, upcomingVisits, pendingQuotesList,
  } = data

  const monthData  = (jobsByMonth || []).map(d => ({ ...d, month: fmtMonth(d.month) }))
  const statusData = jobsByStatus.map(s => ({ name: statusMeta(s.status, t).label, value: s.count, key: s.status }))
  const modeData   = (jobsByMode || []).map(m => ({ name: t(`modes.${m.mode}`), value: m.count, key: m.mode }))
  const typeData   = jobsByType.map(tp => ({ name: t(`types.${tp.type}`), value: tp.count, key: tp.type }))

  const hasMonthData = monthData.some(d => (d.jobs || 0) + (d.visits || 0) + (d.quotes || 0) > 0)
  const hasModeData  = modeData.length > 0

  const visitsLabel = t('nav.visits')
  const quotesLabel = t('nav.quotes')
  const jobsLabel   = t('nav.jobs')
  const PieTooltip = makePieTooltip(jobsLabel)

  const pipelineSteps = [
    { label: t('dashboard.pipelineVisits'), value: pipeline?.visits ?? 0, color: '#6366f1' },
    { label: t('dashboard.pipelineQuoted'),   value: pipeline?.quoted  ?? 0, color: '#3b82f6' },
    { label: t('dashboard.pipelineAccepted'), value: pipeline?.accepted ?? 0, color: '#10b981' },
    { label: t('dashboard.pipelineJobs'),     value: pipeline?.jobs    ?? 0, color: '#2563eb' },
  ]

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{t('dashboard.title')}</div>
          <div className="page-subtitle">{t('dashboard.subtitle')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/visits/new" className="btn btn-primary">{t('visits.newVisit')}</Link>
          <Link to="/jobs/new" className="btn btn-secondary">{t('jobs.newJob')}</Link>
        </div>
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
          <div className="kpi-label">{t('dashboard.openVisits')}</div>
          <div className="kpi-value" style={{ color: '#f59e0b' }}>{openVisits ?? 0}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{t('dashboard.pendingQuotes')}</div>
          <div className="kpi-value" style={{ color: '#8b5cf6' }}>{pendingQuotes ?? 0}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">
            {t('dashboard.conversionRate')}
            <span className="kpi-info" data-tooltip={t('dashboard.conversionRateTooltip')}>i</span>
          </div>
          <div className="kpi-value" style={{ color: conversionRate != null ? '#16a34a' : 'var(--text-muted)' }}>
            {conversionRate != null ? `${conversionRate}%` : t('dashboard.noData')}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{t('dashboard.totalClients')}</div>
          <div className="kpi-value">{totalClients}</div>
        </div>
      </div>

      {/* Sales pipeline funnel */}
      <div className="card card-body" style={{ marginBottom: 20 }}>
        <div className="section-label" style={{ marginBottom: 16 }}>{t('dashboard.pipeline')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap' }}>
          {pipelineSteps.map((step, i) => (
            <React.Fragment key={step.label}>
              <div style={{
                flex: 1, minWidth: 100, textAlign: 'center',
                background: `${step.color}14`, border: `1.5px solid ${step.color}44`,
                borderRadius: 10, padding: '14px 8px',
              }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: step.color }}>{step.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{step.label}</div>
              </div>
              {i < pipelineSteps.length - 1 && (
                <div style={{ fontSize: 20, color: 'var(--border)', padding: '0 6px', flexShrink: 0 }}>→</div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Upcoming visits + Pending quotes row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

        {/* Upcoming scheduled visits */}
        <div className="card">
          <div className="card-body" style={{ paddingBottom: 0 }}>
            <div className="section-label">{t('dashboard.upcomingVisits')}</div>
          </div>
          {(upcomingVisits || []).length === 0
            ? <div style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {t('dashboard.noUpcomingVisits')}
              </div>
            : <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>{t('dashboard.visitDate')}</th>
                      <th>{t('dashboard.prospect')}</th>
                      <th>{t('dashboard.serviceType')}</th>
                      <th>{t('dashboard.assignee')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(upcomingVisits || []).map(v => (
                      <tr key={v.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                          <Link to={`/visits/${v.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                            {new Date(v.scheduledDate).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </Link>
                        </td>
                        <td style={{ fontSize: 13 }}>
                          {v.client ? clientName(v.client) : v.prospectName || '—'}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {v.serviceType ? t(`serviceTypes.${v.serviceType}`) : '—'}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {v.assignedTo ? v.assignedTo.name : <span style={{ fontStyle: 'italic' }}>{t('visits.unassigned')}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          }
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
            <Link to="/visits" style={{ fontSize: 12, color: 'var(--primary)' }}>{t('visits.allVisits')} →</Link>
          </div>
        </div>

        {/* Quotes awaiting decision */}
        <div className="card">
          <div className="card-body" style={{ paddingBottom: 0 }}>
            <div className="section-label">{t('dashboard.pendingQuotesList')}</div>
          </div>
          {(pendingQuotesList || []).length === 0
            ? <div style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {t('dashboard.noPendingQuotes')}
              </div>
            : <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>{t('dashboard.quoteNumber')}</th>
                      <th>{t('dashboard.prospect')}</th>
                      <th>{t('dashboard.amount')}</th>
                      <th>{t('dashboard.validUntil')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pendingQuotesList || []).map(q => {
                      const isExpiringSoon = q.validUntil && new Date(q.validUntil) - new Date() < 3 * 24 * 60 * 60 * 1000
                      const prospectLabel = q.visit?.client
                        ? clientName(q.visit.client)
                        : q.visit?.prospectName || '—'
                      return (
                        <tr key={q.id}>
                          <td>
                            <Link to={`/quotes/${q.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>{q.quoteNumber}</Link>
                          </td>
                          <td style={{ fontSize: 13 }}>{prospectLabel}</td>
                          <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                            {q.totalAmount != null ? `${q.currency || ''} ${Number(q.totalAmount).toLocaleString()}`.trim() : '—'}
                          </td>
                          <td style={{ fontSize: 13, whiteSpace: 'nowrap', color: isExpiringSoon ? '#ef4444' : 'var(--text-muted)', fontWeight: isExpiringSoon ? 600 : 400 }}>
                            {q.validUntil ? new Date(q.validUntil).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
          }
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
            <Link to="/quotes" style={{ fontSize: 12, color: 'var(--primary)' }}>{t('quotes.allQuotes')} →</Link>
          </div>
        </div>
      </div>

      {/* Monthly bar chart */}
      <div className="card card-body" style={{ marginBottom: 20 }}>
        <div className="section-label" style={{ marginBottom: 16 }}>{t('dashboard.jobsPerMonth')}</div>
        {!hasMonthData
          ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('dashboard.noJobs')}</p>
          : <>
              <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                {[['visits', visitsLabel], ['quotes', quotesLabel], ['jobs', jobsLabel]].map(([key, label]) => (
                  <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: ACTIVITY_COLORS[key], display: 'inline-block' }} />
                    {label}
                  </span>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barCategoryGap="30%" barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ActivityTooltip />} cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="visits" name={visitsLabel} fill={ACTIVITY_COLORS.visits} radius={[3, 3, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="quotes" name={quotesLabel} fill={ACTIVITY_COLORS.quotes} radius={[3, 3, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="jobs"   name={jobsLabel}   fill={ACTIVITY_COLORS.jobs}   radius={[3, 3, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </>}
      </div>

      {/* Status + Mode + Type row */}
      <div className="chart-grid" style={{ display: 'grid', gridTemplateColumns: hasModeData ? '1fr 1fr 1fr' : '1fr 1fr', gap: 16, marginBottom: 20 }}>

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
                      <td>{job.client ? (job.client.clientType === 'INDIVIDUAL' ? [`${job.client.firstName || ''}`, `${job.client.lastName || ''}`].filter(Boolean).join(' ') || job.client.name : job.client.name) : '—'}</td>
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

