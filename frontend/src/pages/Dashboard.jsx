import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LabelList
} from 'recharts'
import { api } from '../api'
import { formatDate, stripFilePrefix } from '../constants'
import { useLanguage } from '../i18n'
import { useDashboardLayout } from '../hooks/useDashboardLayout'
import DashboardCardStore from '../components/DashboardCardStore'

const MODE_COLORS  = { ROAD: '#6366f1', SEA: '#0ea5e9', AIR: '#f59e0b', COMBINED: '#10b981' }
const TYPE_COLORS  = { EXPORT: '#0ea5e9', IMPORT: '#8b5cf6', INTERNATIONAL: '#2563eb', DOMESTIC: '#16a34a' }
const COMPLETION_COLORS = {
  none:     '#ef4444',
  low:      '#f97316',
  mid:      '#eab308',
  complete: '#16a34a',
}

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtMonth(key) {
  const [, m] = key.split('-')
  return MONTH_ABBR[parseInt(m, 10) - 1]
}

const ACTIVITY_COLORS = { visits: '#0d9488', quotes: '#8b5cf6', jobs: '#2563eb' }
const POUND_COLORS = { packed: '#0ea5e9', unpacked: '#f97316', local: '#16a34a' }

function toInputMonth(value) {
  const d = new Date(value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function defaultPoundsRange() {
  const year = new Date().getFullYear()
  return {
    from: `${year}-01`,
    to: `${year}-12`,
  }
}

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
  const { t, lang } = useLanguage()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [poundData, setPoundData] = useState(null)
  const [poundLoading, setPoundLoading] = useState(true)
  const [poundError, setPoundError] = useState(null)
  const [poundTab, setPoundTab] = useState('packed')
  const [poundRange, setPoundRange] = useState(defaultPoundsRange)

  // Dashboard layout — must be here (before early returns) to satisfy Rules of Hooks
  const { isVisible, toggle, hiddenCards, reset } = useDashboardLayout()
  const [storeOpen, setStoreOpen] = useState(false)
  const [noInvoiceTab, setNoInvoiceTab] = useState(() => localStorage.getItem('winmovers_noinvoice_tab') || 'EXPORT')

  useEffect(() => {
    api.get('/dashboard')
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!poundRange.from || !poundRange.to) return
    if (poundRange.from > poundRange.to) {
      setPoundError(t('dashboard.poundsInvalidRange'))
      setPoundData(null)
      setPoundLoading(false)
      return
    }
    setPoundLoading(true)
    setPoundError(null)
    api.get(`/dashboard/pounds?from=${encodeURIComponent(poundRange.from)}&to=${encodeURIComponent(poundRange.to)}`)
      .then(setPoundData)
      .catch(e => setPoundError(e.message))
      .finally(() => setPoundLoading(false))
  }, [poundRange.from, poundRange.to, t])

  if (loading) return <div className="loading"><div className="spinner" /> {t('common.loading')}</div>
  if (error)   return <div className="alert alert-error">{error}</div>

  const {
    totalJobs, activeJobs, totalClients,
    jobsByStatus, jobsByType, jobsByMode, jobsByMonth, recentJobs,
    openVisits, pendingQuotes, conversionRate,
    pipeline, upcomingVisits, pendingQuotesList,
    filesByCompletion,
    exportNoInvoiceRecent, exportNoInvoiceOld,
    importNoInvoiceRecent, importNoInvoiceOld,
    localNoInvoiceRecent, localNoInvoiceOld,
    deliveryDocAlerts,
    myAppointments,
    myCoordinations,
  } = data

  const monthData  = (jobsByMonth || []).map(d => ({ ...d, month: fmtMonth(d.month) }))
  const modeData   = (jobsByMode || []).map(m => ({ name: t(`modes.${m.mode}`), value: m.count, key: m.mode }))
  const typeData   = jobsByType.map(tp => ({ name: t(`types.${tp.type}`), value: tp.count, key: tp.type }))

  const hasMonthData = monthData.some(d => (d.jobs || 0) + (d.visits || 0) + (d.quotes || 0) > 0)
  const hasModeData  = modeData.length > 0

  // Pre-compute chart grid visibility
  const showChartFC  = isVisible('files_completion')
  const showChartBM  = isVisible('jobs_by_mode') && hasModeData
  const showChartBT  = isVisible('jobs_by_type')
  const chartGridCols = [showChartFC, showChartBM, showChartBT].filter(Boolean).length

  const visitsLabel = t('nav.visits')
  const quotesLabel = t('nav.quotes')
  const jobsLabel   = t('nav.jobs')
  const PieTooltip = makePieTooltip(jobsLabel)
  const poundTabs = [
    { key: 'packed', label: t('dashboard.poundsPackedTab') },
    { key: 'unpacked', label: t('dashboard.poundsUnpackedTab') },
    { key: 'local', label: t('dashboard.poundsLocalTab') },
  ]
  const poundsSeriesLabel = {
    packed: t('dashboard.poundsPackedTab'),
    unpacked: t('dashboard.poundsUnpackedTab'),
    local: t('dashboard.poundsLocalTab'),
  }
  const isLocalPoundTab = poundTab === 'local'
  const poundValueUnit = isLocalPoundTab ? t('dashboard.poundsLocalUnit') : t('dashboard.poundsUnit')
  const poundJobsKey = poundTab === 'packed' ? 'packedJobs' : poundTab === 'unpacked' ? 'unpackedJobs' : 'localJobs'
  const poundCountUnit = poundTab === 'packed'
    ? t('dashboard.poundsPackedCountUnit')
    : poundTab === 'unpacked'
      ? t('dashboard.poundsUnpackedCountUnit')
      : t('dashboard.poundsLocalUnit')
  const poundsChartData = (poundData?.months || []).map(d => ({
    ...d,
    monthLabel: new Date(`${d.month}-01T00:00:00Z`).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US', { month: 'short', timeZone: 'UTC' }),
  }))
  const hasPoundData = poundsChartData.some(d =>
    Number(d.packed || 0) > 0 ||
    Number(d.unpacked || 0) > 0 ||
    Number(d.local || 0) > 0 ||
    Number(d.packedJobs || 0) > 0 ||
    Number(d.unpackedJobs || 0) > 0 ||
    Number(d.localJobs || 0) > 0
  )
  const poundTotals = poundData?.totals || {}

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
          <button className="btn btn-secondary" onClick={() => setStoreOpen(true)} title={t('dashboard.store.customize')}>
            ⚙️ {t('dashboard.store.customize')}
          </button>
        </div>
      </div>

      {/* KPI cards */}
      {isVisible('kpi') && (
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
      )}

      {/* Sales pipeline funnel */}
      {isVisible('pipeline') && (
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
      )}

      {/* Upcoming visits + Pending quotes row */}
      {(isVisible('upcoming_visits') || isVisible('pending_quotes')) && (
      <div style={{ display: 'grid', gridTemplateColumns: (isVisible('upcoming_visits') && isVisible('pending_quotes')) ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 20 }}>

        {/* Upcoming scheduled visits */}
        {isVisible('upcoming_visits') && (
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
        )}

        {/* Quotes awaiting decision */}
        {isVisible('pending_quotes') && (
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
        )}
      </div>
      )}

      {/* Files without invoice — tabbed (Export / Import / Local) */}
      {isVisible('files_no_invoice') && (
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ paddingBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="section-label">{t('dashboard.filesNoInvoiceTitle')}</div>
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              {[
                { key: 'EXPORT', label: t('types.EXPORT') },
                { key: 'IMPORT', label: t('types.IMPORT') },
                { key: 'LOCAL',  label: 'Local' },
              ].map(({ key, label }) => (
                <button key={key} type="button"
                  onClick={() => { setNoInvoiceTab(key); localStorage.setItem('winmovers_noinvoice_tab', key) }}
                  style={{
                    padding: '4px 14px', border: 'none', cursor: 'pointer', fontSize: 12,
                    background: noInvoiceTab === key ? 'var(--primary)' : 'transparent',
                    color: noInvoiceTab === key ? '#fff' : 'var(--text)',
                  }}
                >{label}</button>
              ))}
            </div>
          </div>
        </div>
        {(() => {
          const tabRoute = noInvoiceTab === 'EXPORT' ? '/files/export' : noInvoiceTab === 'IMPORT' ? '/files/import' : '/files/local'
          const recent = noInvoiceTab === 'EXPORT' ? (exportNoInvoiceRecent || []) : noInvoiceTab === 'IMPORT' ? (importNoInvoiceRecent || []) : (localNoInvoiceRecent || [])
          const old    = noInvoiceTab === 'EXPORT' ? (exportNoInvoiceOld    || []) : noInvoiceTab === 'IMPORT' ? (importNoInvoiceOld    || []) : (localNoInvoiceOld    || [])
          const renderRows = (items, color) => items.map(f => {
            const days = Math.floor((Date.now() - new Date(f.createdAt)) / 86400000)
            const cname = f.client
              ? (f.client.clientType === 'INDIVIDUAL'
                  ? `${f.client.firstName || ''} ${f.client.lastName || ''}`.trim() || f.client.name
                  : f.client.name)
              : '—'
            return (
              <tr key={f.id}>
                <td><Link to={`${tabRoute}/${f.id}`} style={{ color, fontWeight: 600 }}>{stripFilePrefix(f.fileNumber)}</Link></td>
                <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{cname}</td>
                <td style={{ textAlign: 'right', fontSize: 13, color, ...(color === '#dc2626' ? { fontWeight: 600 } : {}) }}>{days}</td>
              </tr>
            )
          })
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid var(--border)' }}>
              <div style={{ borderRight: '1px solid var(--border)' }}>
                <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{t('dashboard.filesNoInvoiceRecent')}</span>
                  {recent.length > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 12, padding: '1px 8px' }}>{recent.length}</span>
                  )}
                </div>
                {recent.length === 0
                  ? <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('dashboard.filesNoInvoiceNone')}</div>
                  : <div className="table-wrapper"><table><thead><tr>
                      <th>{t('dashboard.fileNumber')}</th>
                      <th>{t('dashboard.client')}</th>
                      <th style={{ textAlign: 'right' }}>{t('dashboard.daysOld')}</th>
                    </tr></thead><tbody>{renderRows(recent, 'var(--primary)')}</tbody></table></div>
                }
              </div>
              <div style={old.length > 0 ? { background: '#fff5f5' } : {}}>
                <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', background: old.length > 0 ? '#fff5f5' : 'var(--surface-2)' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: old.length > 0 ? '#dc2626' : 'var(--text-muted)' }}>{t('dashboard.filesNoInvoiceOld')}</span>
                  {old.length > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, padding: '1px 8px' }}>{old.length}</span>
                  )}
                </div>
                {old.length === 0
                  ? <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('dashboard.filesNoInvoiceNone')}</div>
                  : <div className="table-wrapper"><table><thead><tr>
                      <th>{t('dashboard.fileNumber')}</th>
                      <th>{t('dashboard.client')}</th>
                      <th style={{ textAlign: 'right' }}>{t('dashboard.daysOld')}</th>
                    </tr></thead><tbody>{renderRows(old, '#dc2626')}</tbody></table></div>
                }
              </div>
            </div>
          )
        })()}
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
          <Link
            to={noInvoiceTab === 'EXPORT' ? '/files/export' : noInvoiceTab === 'IMPORT' ? '/files/import' : '/files/local'}
            style={{ fontSize: 12, color: 'var(--primary)' }}
          >
            {noInvoiceTab === 'EXPORT' ? t('movingFiles.exportTitle') : noInvoiceTab === 'IMPORT' ? t('movingFiles.importTitle') : t('movingFiles.localTitle')} →
          </Link>
        </div>
      </div>
      )}

      {/* Delivery document alerts */}
      {isVisible('delivery_doc_alerts') && (
      <div className="card" style={{ marginBottom: 20, ...(deliveryDocAlerts?.some(f => f.missingDocs.some(d => d.overdue)) ? { border: '1.5px solid #fca5a5' } : {}) }}>
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>⚠️ {t('dashboard.deliveryDocAlertsTitle')}</span>
            {(deliveryDocAlerts || []).length > 0 && (
              <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, padding: '1px 8px' }}>
                {(deliveryDocAlerts || []).length}
              </span>
            )}
          </div>
        </div>
        {!(deliveryDocAlerts || []).length
          ? <div style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('dashboard.deliveryDocAlertsNone')}</div>
          : <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>{t('dashboard.fileNumber')}</th>
                    <th>{t('dashboard.client')}</th>
                    <th>{t('dashboard.fechaEntrega')}</th>
                    <th>{t('dashboard.missingDoc')}</th>
                    <th>{t('dashboard.dueIn')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(deliveryDocAlerts || []).flatMap(f => {
                    const cname = f.client
                      ? (f.client.clientType === 'INDIVIDUAL'
                          ? `${f.client.firstName || ''} ${f.client.lastName || ''}`.trim() || f.client.name
                          : f.client.name)
                      : '—'
                    const entregaFmt = f.fechaEntrega
                      ? new Date(f.fechaEntrega).toLocaleDateString('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'
                    const route = f.category === 'EXPORT' ? '/files/export' : '/files/import'
                    return f.missingDocs.map((doc, di) => {
                      const dueDate   = new Date(doc.dueDate)
                      const daysLeft  = Math.ceil((dueDate - Date.now()) / 86400000)
                      const docLabel  = t(`files.categories.${doc.cat}`)
                      return (
                        <tr key={`${f.id}-${doc.cat}`} style={{ background: doc.overdue ? '#fff5f5' : undefined }}>
                          {di === 0 && (
                            <>
                              <td rowSpan={f.missingDocs.length}>
                                <Link to={`${route}/${f.id}`} style={{ color: doc.overdue ? '#dc2626' : 'var(--primary)', fontWeight: 600 }}>{stripFilePrefix(f.fileNumber)}</Link>
                              </td>
                              <td rowSpan={f.missingDocs.length} style={{ fontSize: 13 }}>{cname}</td>
                              <td rowSpan={f.missingDocs.length} style={{ fontSize: 13, color: 'var(--text-muted)' }}>{entregaFmt}</td>
                            </>
                          )}
                          <td>
                            <span className="badge" style={{ fontSize: 11, background: '#ede9fe', color: '#5b21b6' }}>{docLabel}</span>
                          </td>
                          <td style={{ fontSize: 13, fontWeight: 600, color: doc.overdue ? '#dc2626' : daysLeft <= 1 ? '#d97706' : 'var(--text)', whiteSpace: 'nowrap' }}>
                            {doc.overdue
                              ? `⚠ ${t('files.overdue')}`
                              : `${daysLeft} ${t('dashboard.days')}`
                            }
                          </td>
                        </tr>
                      )
                    })
                  })}
                </tbody>
              </table>
            </div>
        }
      </div>
      )}

      {/* Monthly bar chart */}
      {isVisible('activity_chart') && (
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
      )}

      {/* Pound report */}
      {isVisible('pound_report') && (
      <div className="card card-body" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <div className="section-label" style={{ marginBottom: 0 }}>{t('dashboard.poundsTitle')}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {t('dashboard.poundsFrom')}
              <input
                type="month"
                className="form-control"
                style={{ marginTop: 4, minWidth: 150 }}
                value={poundRange.from}
                onChange={e => setPoundRange(prev => ({ ...prev, from: e.target.value }))}
              />
            </label>
            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {t('dashboard.poundsTo')}
              <input
                type="month"
                className="form-control"
                style={{ marginTop: 4, minWidth: 150 }}
                value={poundRange.to}
                onChange={e => setPoundRange(prev => ({ ...prev, to: e.target.value }))}
              />
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 12, width: 'fit-content' }}>
          {poundTabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setPoundTab(tab.key)}
              style={{
                padding: '6px 14px',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                background: poundTab === tab.key ? 'var(--primary)' : 'transparent',
                color: poundTab === tab.key ? '#fff' : 'var(--text)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {poundLoading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('common.loading')}</p>
        ) : poundError ? (
          <p style={{ color: '#dc2626', fontSize: 13 }}>{poundError}</p>
        ) : !hasPoundData ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('dashboard.poundsNoData')}</p>
        ) : (
          <>
            {!isLocalPoundTab && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <span className="badge" style={{ background: '#eef2ff', color: '#1d4ed8', border: '1px solid #c7d2fe', fontWeight: 600 }}>
                  {t('dashboard.poundsTotalLbs')}: {Number(poundTotals[poundTab] || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} {t('dashboard.poundsUnit')}
                </span>
                <span className="badge" style={{ background: '#ecfeff', color: '#0f766e', border: '1px solid #99f6e4', fontWeight: 600 }}>
                  {t('dashboard.poundsTotalCount')}: {Number(poundTotals[poundJobsKey] || 0).toLocaleString()} {poundCountUnit}
                </span>
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: POUND_COLORS[poundTab], display: 'inline-block' }} />
              {poundsSeriesLabel[poundTab]} ({poundValueUnit})
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={poundsChartData} margin={{ top: 24, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={[0, (max) => Math.ceil((Number(max) || 0) * 1.15)]}
                  tickFormatter={v => Number(v).toLocaleString()}
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const row = payload[0]?.payload || {}
                    const jobsCount = Number(row[poundJobsKey] || 0)
                    const value = Number(payload[0]?.value || 0)
                    return (
                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
                        <div style={{ color: payload[0]?.fill || '#334155' }}>
                          {poundsSeriesLabel[poundTab]}: {isLocalPoundTab
                            ? `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${t('dashboard.poundsLocalUnit')}`
                            : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${t('dashboard.poundsUnit')}`}
                        </div>
                        {!isLocalPoundTab && (
                          <div style={{ color: '#0f766e' }}>
                            {t('dashboard.poundsTotalCount')}: {jobsCount.toLocaleString()} {poundCountUnit}
                          </div>
                        )}
                      </div>
                    )
                  }}
                />
                <Bar dataKey={poundTab} name={poundsSeriesLabel[poundTab]} fill={POUND_COLORS[poundTab]} radius={[4, 4, 0, 0]} maxBarSize={36}>
                  <LabelList
                    dataKey={poundTab}
                    content={(props) => {
                      const { x, y, width, value, index } = props
                      if (x == null || y == null || width == null || value == null) return null
                      const row = poundsChartData[index] || {}
                      const jobsCount = Number(row[poundJobsKey] || 0)
                      const lbText = `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${isLocalPoundTab ? poundValueUnit : t('dashboard.poundsUnit')}`
                      const barColor = POUND_COLORS[poundTab]
                      if (isLocalPoundTab) {
                        return (
                          <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={10}>
                            <tspan fontWeight="700" fill={barColor}>{lbText}</tspan>
                          </text>
                        )
                      }
                      return (
                        <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={10}>
                          <tspan fontWeight="700" fill={barColor}>{lbText}</tspan>
                          <tspan fontWeight="400" fill="#0f766e">{` (${jobsCount.toLocaleString()} ${poundCountUnit})`}</tspan>
                        </text>
                      )
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </div>
      )}

      {/* Status + Mode + Type row */}
      {chartGridCols > 0 && (
      <div className="chart-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${chartGridCols}, 1fr)`, gap: 16, marginBottom: 20 }}>

        {/* Files completion chart */}
        {showChartFC && (<div className="card card-body">
          <div className="section-label" style={{ marginBottom: 12 }}>{t('dashboard.filesByCompletion') || 'Files Completion'}</div>
          {(!filesByCompletion || filesByCompletion.every(b => b.count === 0))
            ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('dashboard.noFiles') || 'No open files'}</p>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                {filesByCompletion.map(b => {
                  const total = filesByCompletion.reduce((s, x) => s + x.count, 0)
                  const pct = total > 0 ? Math.round((b.count / total) * 100) : 0
                  const color = COMPLETION_COLORS[b.bucket]
                  const labels = { none: t('dashboard.completion0') || '0% — Not started', low: t('dashboard.completion1to50') || '1–50%', mid: t('dashboard.completion51to99') || '51–99%', complete: t('dashboard.completion100') || '100% — Ready to close' }
                  return (
                    <div key={b.bucket}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                        <span style={{ color: 'var(--text-muted)' }}>{labels[b.bucket]}</span>
                        <span style={{ fontWeight: 700, color }}>{b.count} files</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 6, background: 'var(--surface-2, #e2e8f0)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 6, transition: 'width 0.4s' }} />
                      </div>
                    </div>
                  )
                })}
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {filesByCompletion.reduce((s, x) => s + x.count, 0)} {t('dashboard.openFilesTotal') || 'open files'}
                </div>
              </div>
            )
          }
        </div>)}

        {/* Mode donut */}
        {showChartBM && (
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
        {showChartBT && (<div className="card card-body">
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
                        <span>{d.key === 'EXPORT' ? `📦 ${d.name}` : d.key === 'IMPORT' ? `🚢 ${d.name}` : d.key === 'INTERNATIONAL' ? `🌍 ${d.name}` : `🏠 ${d.name}`}</span>
                      </span>
                      <span className="status-count">{d.value}</span>
                    </Link>
                  ))}
                </div>
              </>
          }
        </div>)}

      </div>
      )}

      {/* Recent jobs */}
      {isVisible('recent_jobs') && recentJobs.length > 0 && (
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
                  <th>{t('jobs.type')}</th>
                  <th>{t('dashboard.moveDate')}</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map(job => {
                  return (
                    <tr key={job.id} className="recent-job-row">
                      <td><Link to={`/jobs/${job.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>{job.jobNumber}</Link></td>
                      <td>{job.client ? (job.client.clientType === 'INDIVIDUAL' ? [`${job.client.firstName || ''}`, `${job.client.lastName || ''}`].filter(Boolean).join(' ') || job.client.name : job.client.name) : '—'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{[job.originCity, job.destCity].filter(Boolean).join(' → ') || '—'}</td>
                      <td><span style={{ fontSize: 13 }}>{job.type === 'EXPORT' ? `📦 ${t('types.EXPORT')}` : job.type === 'IMPORT' ? `🚢 ${t('types.IMPORT')}` : job.type === 'INTERNATIONAL' ? `🌍 ${t('types.INTERNATIONAL')}` : `🏠 ${t('types.DOMESTIC')}`}</span></td>
                      <td style={{ color: 'var(--text-muted)' }}>{formatDate(job.moveDate)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* My Appointments + My Coordinations row */}
      {(isVisible('my_appointments') || isVisible('my_coordinations')) && (
      <div style={{ display: 'grid', gridTemplateColumns: (isVisible('my_appointments') && isVisible('my_coordinations')) ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 20 }}>

        {/* My upcoming visits */}
        {isVisible('my_appointments') && (
        <div className="card">
          <div className="card-body" style={{ paddingBottom: 0 }}>
            <div className="section-label">{t('dashboard.myAppointmentsTitle')}</div>
          </div>
          {!(myAppointments || []).length
            ? <div style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('dashboard.myAppointmentsNone')}</div>
            : <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>{t('dashboard.visitDate')}</th>
                      <th>{t('dashboard.prospect')}</th>
                      <th>{t('dashboard.serviceType')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(myAppointments || []).map(v => {
                      const name = v.client
                        ? clientName(v.client)
                        : v.corporateClient?.name || v.prospectName || '—'
                      return (
                        <tr key={v.id}>
                          <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                            <Link to={`/visits/${v.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                              {new Date(v.scheduledDate).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </Link>
                          </td>
                          <td style={{ fontSize: 13 }}>{name}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {v.serviceType ? t(`serviceTypes.${v.serviceType}`) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
          }
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
            <Link to="/visits" style={{ fontSize: 12, color: 'var(--primary)' }}>{t('visits.allVisits')} →</Link>
          </div>
        </div>
        )}

        {/* My coordinated files */}
        {isVisible('my_coordinations') && (
        <div className="card">
          <div className="card-body" style={{ paddingBottom: 0 }}>
            <div className="section-label">{t('dashboard.myCoordinationsTitle')}</div>
          </div>
          {!(myCoordinations || []).length
            ? <div style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('dashboard.myCoordinationsNone')}</div>
            : <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>{t('dashboard.fileNumber')}</th>
                      <th>{t('dashboard.client')}</th>
                      <th>{t('movingFiles.category')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(myCoordinations || []).map(f => {
                      const name = f.corporateClient?.name || (f.client ? clientName(f.client) : '—')
                      const route = f.category === 'EXPORT' ? '/files/export' : f.category === 'IMPORT' ? '/files/import' : '/files/local'
                      const catColors = { EXPORT: { bg: '#dbeafe', color: '#1e40af' }, IMPORT: { bg: '#ede9fe', color: '#5b21b6' }, LOCAL: { bg: '#dcfce7', color: '#166534' } }
                      const catStyle = catColors[f.category] || {}
                      return (
                        <tr key={f.id}>
                          <td>
                            <Link to={`${route}/${f.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                              {f.fileNumber}
                            </Link>
                          </td>
                          <td style={{ fontSize: 13 }}>{name}</td>
                          <td>
                            <span className="badge" style={{ fontSize: 11, background: catStyle.bg, color: catStyle.color }}>
                              {t(`movingFiles.${f.category.toLowerCase()}Short`)}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
          }
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
            <Link to="/files/export" style={{ fontSize: 12, color: 'var(--primary)' }}>{t('movingFiles.exportTitle')} →</Link>
          </div>
        </div>
        )}
      </div>
      )}

      {storeOpen && (
        <DashboardCardStore
          isVisible={isVisible}
          toggle={toggle}
          reset={reset}
          onClose={() => setStoreOpen(false)}
        />
      )}
    </>
  )
}
