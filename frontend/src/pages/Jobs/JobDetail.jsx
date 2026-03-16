import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'
import { statusMeta, typeMeta, formatDate } from '../../constants'
import JobDocument from './JobDocument'
import DamageReport, { EMPTY_DR } from '../Files/DamageReport'
import ServiceEvaluation, { EMPTY_SE } from '../Files/ServiceEvaluation'

export default function JobDetail() {
  const { id } = useParams()
  const { t }  = useLanguage()
  const docRef    = useRef(null)
  const headerRef = useRef(null)

  const [job, setJob]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab]          = useState('overview') // 'overview' | 'workorder' | 'damage' | 'evaluation'
  const [closing, setClosing]           = useState(false)
  const [exporting, setExporting]       = useState(false)
  const [importFiles, setImportFiles]   = useState(null)  // null = not loaded
  const [selectedFileId, setSelectedFileId] = useState('')
  const [linkingSaving, setLinkingSaving]   = useState(false)
  const [drData, setDrData]   = useState(EMPTY_DR)
  const [seData, setSeData]   = useState(EMPTY_SE)
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get(`/jobs/${id}`)
      .then(j => {
        setJob(j)
        if (j.movingFile?.damageReportData) {
          try { setDrData(JSON.parse(j.movingFile.damageReportData)) } catch {}
        }
        if (j.movingFile?.evaluationData) {
          try { setSeData(JSON.parse(j.movingFile.evaluationData)) } catch {}
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  const TERMINAL = ['DELIVERED', 'CLOSED', 'CANCELLED']

  const loadImportFiles = () => {
    if (importFiles !== null) return
    api.get('/files?category=IMPORT').then(setImportFiles).catch(() => setImportFiles([]))
  }

  const saveDR = async () => {
    if (!job?.movingFile?.id) return
    setSaving(true)
    try {
      await api.put(`/files/${job.movingFile.id}`, { damageReportData: JSON.stringify(drData) })
    } catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  const saveSE = async () => {
    if (!job?.movingFile?.id) return
    setSaving(true)
    try {
      await api.put(`/files/${job.movingFile.id}`, { evaluationData: JSON.stringify(seData) })
    } catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  const handleLinkFile = async () => {
    if (!selectedFileId) return
    setLinkingSaving(true)
    try {
      const updated = await api.patch(`/jobs/${id}/moving-file`, { movingFileId: selectedFileId })
      setJob(prev => ({ ...prev, movingFile: updated.movingFile }))
      setImportFiles(null)
      setSelectedFileId('')
    } catch (e) { alert(e.message) }
    finally { setLinkingSaving(false) }
  }

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
          {!TERMINAL.includes(job.status) && (
            <button className="btn btn-success" onClick={closeJob} disabled={closing}>
              {closing ? t('common.saving') : t('jobs.closeJob')}
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        {[
          { key: 'overview',    label: t('files.overview') },
          { key: 'workorder',   label: t('jobs.workOrder') },
          ...(job.type === 'IMPORT' ? [
            { key: 'damage',     label: t('movingFiles.damageReportTab') },
            { key: 'evaluation', label: t('movingFiles.evaluationTab') },
          ] : []),
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

      {/* Damage Report tab (IMPORT only) */}
      {tab === 'damage' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setDrData(EMPTY_DR)}>
              {t('common.reset')}
            </button>
            <button className="btn btn-primary" onClick={saveDR} disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
            <button className="btn btn-secondary" onClick={exportPDF} disabled={exporting}>
              {exporting ? '…' : t('jobs.exportPDF')}
            </button>
          </div>
          <DamageReport
            ref={docRef}
            headerRef={headerRef}
            file={{ job, client: job.client }}
            editMode
            data={drData}
            onChange={setDrData}
          />
        </>
      )}

      {/* Service Evaluation tab (IMPORT only) */}
      {tab === 'evaluation' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setSeData(EMPTY_SE)}>
              {t('common.reset')}
            </button>
            <button className="btn btn-primary" onClick={saveSE} disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
            <button className="btn btn-secondary" onClick={exportPDF} disabled={exporting}>
              {exporting ? '…' : t('jobs.exportPDF')}
            </button>
          </div>
          <ServiceEvaluation
            ref={docRef}
            headerRef={headerRef}
            file={{ job, client: job.client }}
            editMode
            data={seData}
            onChange={setSeData}
          />
        </>
      )}

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="card" style={{ padding: '20px 24px' }}>
          {/* Linked File */}
          <Section title={t('movingFiles.linkedJob')}>
            {job.movingFile ? (
              <Field
                label={t('movingFiles.fileNumber')}
                value={
                  <Link
                    to={`/files/${job.movingFile.category.toLowerCase()}/${job.movingFile.id}`}
                    style={{ color: 'var(--primary)' }}
                  >
                    {job.movingFile.fileNumber}
                  </Link>
                }
              />
            ) : (
              <div style={{ gridColumn: '1/-1' }}>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 8px' }}>
                  {t('movingFiles.noJob')}
                </p>
                {importFiles === null ? (
                  <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={loadImportFiles}>
                    {t('movingFiles.linkToFile')}
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                      className="form-control"
                      style={{ maxWidth: 260 }}
                      value={selectedFileId}
                      onChange={e => setSelectedFileId(e.target.value)}
                    >
                      <option value="">{t('common.select')}</option>
                      {importFiles.map(f => {
                        const cn = f.client
                          ? (f.client.clientType === 'INDIVIDUAL'
                              ? `${f.client.firstName || ''} ${f.client.lastName || ''}`.trim()
                              : f.client.name)
                          : ''
                        return <option key={f.id} value={f.id}>{f.fileNumber}{cn ? ` — ${cn}` : ''}</option>
                      })}
                    </select>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: 13 }}
                      disabled={!selectedFileId || linkingSaving}
                      onClick={handleLinkFile}
                    >
                      {linkingSaving ? t('common.saving') : t('movingFiles.linkFile')}
                    </button>
                    <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => { setImportFiles(null); setSelectedFileId('') }}>
                      {t('common.cancel')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </Section>

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
            <Field label={t('jobs.originAgent')} value={job.type === 'IMPORT' ? (job.movingFile?.originAgent?.name || job.originAgent?.name) : job.originAgent?.name} />
            <Field label={t('jobs.destAgent')} value={job.type === 'IMPORT' ? (job.movingFile?.destAgent?.name || job.destAgent?.name) : job.destAgent?.name} />
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

      {/* Files tab was removed — attachments available via file detail page */}
    </>
  )
}
