import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'
import { statusMeta, typeMeta, formatDate, REQUIRED_FILE_CATEGORIES } from '../../constants'
import JobFiles from './JobFiles'
import JobDocument from './JobDocument'

export default function JobDetail() {
  const { id } = useParams()
  const { t }  = useLanguage()
  const docRef    = useRef(null)
  const headerRef = useRef(null)

  const [job, setJob]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab]          = useState('workorder') // 'workorder' | 'overview' | 'files'
  const [fileCount, setFileCount]       = useState(null)
  const [allRequiredDone, setAllRequiredDone] = useState(false)
  const [closing, setClosing]           = useState(false)
  const [exporting, setExporting]       = useState(false)

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

  const exportPDF = async () => {
    if (!docRef.current || !headerRef.current) return
    setExporting(true)
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])
      const captureOpts = { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false }
      const [headerCanvas, docCanvas] = await Promise.all([
        html2canvas(headerRef.current, captureOpts),
        html2canvas(docRef.current,    captureOpts),
      ])
      const pdf   = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const mTop = 30, mSide = 28, mBottom = 30, gap = 8
      const contentW    = pageW - mSide * 2
      const headerPt    = (headerCanvas.height / headerCanvas.width) * contentW
      const contentStartY = mTop + headerPt + gap
      const slicePtH    = pageH - contentStartY - mBottom
      const docPxW      = docCanvas.width
      const docPxH      = docCanvas.height
      const slicePxH    = Math.round((slicePtH / contentW) * docPxW)
      const headerDataUrl = headerCanvas.toDataURL('image/jpeg', 0.95)
      let page = 0, offsetPx = 0
      while (offsetPx < docPxH) {
        if (page > 0) pdf.addPage()
        pdf.addImage(headerDataUrl, 'JPEG', mSide, mTop, contentW, headerPt)
        const thisSlicePx = Math.min(slicePxH, docPxH - offsetPx)
        const sliceCanvas = document.createElement('canvas')
        sliceCanvas.width  = docPxW
        sliceCanvas.height = thisSlicePx
        const ctx = sliceCanvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, docPxW, thisSlicePx)
        ctx.drawImage(docCanvas, 0, offsetPx, docPxW, thisSlicePx, 0, 0, docPxW, thisSlicePx)
        const slicePtActual = (thisSlicePx / slicePxH) * slicePtH
        pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', mSide, contentStartY, contentW, slicePtActual)
        offsetPx += thisSlicePx
        page++
      }
      pdf.save(`${job?.jobNumber || 'OT'}.pdf`)
    } catch (e) { console.error(e) }
    finally { setExporting(false) }
  }

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
          <button className="btn btn-secondary" onClick={exportPDF} disabled={exporting}>
            {exporting ? '…' : t('jobs.exportPDF')}
          </button>
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
          { key: 'workorder', label: t('jobs.workOrder') },
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

      {/* Work Order tab */}
      {tab === 'workorder' && (
        <JobDocument ref={docRef} headerRef={headerRef} job={job} language={job.language || 'EN'} />
      )}

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="card" style={{ padding: '20px 24px' }}>
          {job.quote && (
            <Section title={t('jobs.linkedQuote')}>
              <Field
                label={t('quotes.quoteNumber')}
                value={<Link to={`/quotes/${job.quote.id}`} style={{ color: 'var(--primary)' }}>{job.quote.quoteNumber}</Link>}
              />
              {job.quote.visit && (
                <>
                  <Field
                    label={t('visits.visitNumber')}
                    value={<Link to={`/visits/${job.quote.visit.id}`} style={{ color: 'var(--primary)' }}>{job.quote.visit.visitNumber}</Link>}
                  />
                  <Field label={t('visits.serviceType')} value={job.quote.visit.serviceType ? t(`serviceTypes.${job.quote.visit.serviceType}`) : null} />
                  <Field label={t('visits.scheduledDate')} value={job.quote.visit.scheduledDate ? new Date(job.quote.visit.scheduledDate).toLocaleString('en-GB') : null} />
                </>
              )}
            </Section>
          )}

          <Section title={t('jobs.parties')}>
            <Field label={t('jobs.corporateClient')} value={clientName} />
            <Field label={t('jobs.shipperContact')} value={job.contact ? `${job.contact.firstName} ${job.contact.lastName}` : null} />
            <Field label={t('jobs.originAgent')} value={job.originAgent?.name} />
            <Field label={t('jobs.destAgent')} value={job.destAgent?.name} />
            <Field label={t('jobs.customsAgent')} value={job.customsAgent?.name} />
          </Section>

          <Section title={t('jobs.route_section')}>
            <Field label={t('jobs.originAddress')} value={job.originAddress} />
            <Field label={t('jobs.originCity')} value={job.originCity} />
            <Field label={t('jobs.originCountry')} value={job.originCountry} />
            <Field label={t('jobs.destAddress')} value={job.destAddress} />
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
