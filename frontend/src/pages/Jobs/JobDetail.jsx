import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'
import { statusMeta, typeMeta, formatDate, REQUIRED_FILE_CATEGORIES } from '../../constants'
import JobFiles from './JobFiles'

export default function JobDetail() {
  const { id } = useParams()
  const { t }  = useLanguage()

  const [job, setJob]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab]          = useState('overview') // 'overview' | 'files'
  const [fileCount, setFileCount]       = useState(null)
  const [allRequiredDone, setAllRequiredDone] = useState(false)
  const [closing, setClosing]           = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get(`/jobs/${id}`),
      api.get(`/jobs/${id}/files`),
    ])
      .then(([j, files]) => {
        setJob(j)
        setFileCount(files.length)
        const bycat = {}
        files.forEach(f => { if (!bycat[f.category]) bycat[f.category] = []; bycat[f.category].push(f) })
        setAllRequiredDone(REQUIRED_FILE_CATEGORIES.every(c => bycat[c]?.length))
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  const TERMINAL = ['DELIVERED', 'CLOSED', 'CANCELLED']

  const closeJob = async () => {
    if (!window.confirm(t('jobs.closeJobConfirm'))) return
    setClosing(true)
    try {
      const updated = await api.patch(`/jobs/${id}/status`, { status: 'CLOSED' })
      setJob(updated)
    } catch (e) {
      alert(e.message)
    } finally {
      setClosing(false)
    }
  }

  if (loading) return <div className="loading"><div className="spinner" /> {t('common.loading')}</div>
  if (error)   return <div className="alert alert-error">{error}</div>
  if (!job)    return null

  const sm = statusMeta(job.status, t)
  const tm = typeMeta(job.type, t)
  const route = [job.originCity, job.originCountry].filter(Boolean).join(', ')
    + (job.destCity || job.destCountry
      ? ' → ' + [job.destCity, job.destCountry].filter(Boolean).join(', ')
      : '')

  const Field = ({ label, value }) => (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 500 }}>
        {value || <span style={{ color: 'var(--text-muted)' }}>—</span>}
      </div>
    </div>
  )

  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
        {title}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '12px 20px' }}>
        {children}
      </div>
    </div>
  )

  const clientName = job.client
    ? (job.client.clientType === 'INDIVIDUAL'
        ? `${job.client.firstName || ''} ${job.client.lastName || ''}`.trim() || job.client.name
        : job.client.name)
    : null

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="page-title">{job.jobNumber}</div>
            <span className="badge" style={{ background: sm.bg, color: sm.color, fontSize: 13 }}>{sm.label}</span>
            <span className="badge" style={{ background: job.type === 'INTERNATIONAL' ? '#eff6ff' : '#f0fdf4', color: job.type === 'INTERNATIONAL' ? '#1e40af' : '#166534', fontSize: 13 }}>{tm.label}</span>
          </div>
          {route && <div className="page-subtitle">{route}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/jobs" className="btn btn-ghost">{t('jobs.backToJobs')}</Link>
          <Link to={`/jobs/${id}/edit`} className="btn btn-primary">{t('jobs.editJob')}</Link>
          {allRequiredDone && !TERMINAL.includes(job.status) && (
            <button className="btn btn-success" onClick={closeJob} disabled={closing}>
              {closing ? t('common.saving') : t('jobs.closeJob')}
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        {[
          { key: 'overview', label: t('files.overview') },
          { key: 'files',    label: `${t('files.title')}${fileCount !== null ? ` (${fileCount})` : ''}` },
        ].map(tb => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            style={{
              padding: '8px 20px',
              background: 'none',
              border: 'none',
              borderBottom: tab === tb.key ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -2,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: tab === tb.key ? 600 : 400,
              color: tab === tb.key ? 'var(--primary)' : 'var(--text-muted)',
            }}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="card" style={{ padding: '20px 24px' }}>
          <Section title={t('jobs.parties')}>
            <Field label={t('jobs.corporateClient')} value={clientName} />
            <Field label={t('jobs.shipperContact')} value={job.contact ? `${job.contact.firstName} ${job.contact.lastName}` : null} />
            <Field label={t('jobs.originAgent')} value={job.originAgent?.name} />
            <Field label={t('jobs.destAgent')} value={job.destAgent?.name} />
            <Field label={t('jobs.customsAgent')} value={job.customsAgent?.name} />
          </Section>

          <Section title={t('jobs.route_section')}>
            <Field label={t('jobs.originCity')} value={job.originCity} />
            <Field label={t('jobs.originCountry')} value={job.originCountry} />
            <Field label={t('jobs.destCity')} value={job.destCity} />
            <Field label={t('jobs.destCountry')} value={job.destCountry} />
            <Field label={t('jobs.shipmentMode')} value={job.shipmentMode ? t(`modes.${job.shipmentMode}`) : null} />
          </Section>

          <Section title={t('jobs.dates')}>
            <Field label={t('jobs.callDate')} value={formatDate(job.callDate)} />
            <Field label={t('jobs.surveyDate')} value={job.surveyDate ? new Date(job.surveyDate).toLocaleString('en-GB') : null} />
            <Field label={t('jobs.packDate')} value={formatDate(job.packDate)} />
            <Field label={t('jobs.moveDate_label')} value={formatDate(job.moveDate)} />
            <Field label={t('jobs.deliveryDate')} value={formatDate(job.deliveryDate)} />
          </Section>

          <Section title={t('jobs.cargo')}>
            <Field label={t('jobs.volumeCbm')} value={job.volumeCbm != null ? `${job.volumeCbm} CBM` : null} />
            <Field label={t('jobs.weightKg')} value={job.weightKg != null ? `${job.weightKg} KG` : null} />
          </Section>

          {job.notes && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                {t('common.notes')}
              </div>
              <p style={{ fontSize: 14, color: 'var(--text)', margin: 0, whiteSpace: 'pre-line' }}>{job.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Files tab */}
      {tab === 'files' && (
        <JobFiles jobId={id} onCountChange={setFileCount} onRequiredStatusChange={setAllRequiredDone} />
      )}
    </>
  )
}
