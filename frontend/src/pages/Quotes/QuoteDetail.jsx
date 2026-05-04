import { useEffect, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { getAccessToken } from '../../auth/tokenHelper'
import { quoteStatusMeta, visitStatusMeta, formatDate } from '../../constants'
import { useLanguage } from '../../i18n'
import QuickCreateClientModal from '../../components/QuickCreateClientModal'
import AuditHistory from '../../components/AuditHistory'
import QuoteDocument from './QuoteDocument'
import { buildDefaultSections, buildVarsFromVisit, SECTION_KEYS, LOCAL_SECTION_KEYS } from './quoteTemplates'

export default function QuoteDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const docRef    = useRef(null)
  const headerRef = useRef(null)
  const footerRef = useRef(null)

  const [quote, setQuote]       = useState(null)
  const [sections, setSections] = useState({})
  const [loading, setLoading]   = useState(true)
  const [acting, setActing]     = useState(false)
  const [exporting, setExporting] = useState(false)
  const [signatureDataUrl, setSignatureDataUrl] = useState(null)
  const [interceptPending, setInterceptPending] = useState(false)
  const [showCreateClient, setShowCreateClient] = useState(false)
  const [activeTab, setActiveTab] = useState('document')

  const load = () => api.get(`/quotes/${id}`)
    .then(q => {
      setQuote(q)
      if (q.content) {
        try { setSections(JSON.parse(q.content)) } catch { buildFallback(q) }
      } else {
        buildFallback(q)
      }
    })
    .catch(() => navigate('/quotes'))
    .finally(() => setLoading(false))

  const buildFallback = (q) => {
    const lang = q.language || 'EN'
    const m = { totalAmount: q.totalAmount, currency: q.currency, validUntil: q.validUntil ? new Date(q.validUntil).toISOString().slice(0, 10) : '', creatorName: q.creatorName }
    const isImp = Boolean(q.movingFileId)
    setSections(buildDefaultSections(lang, buildVarsFromVisit(q.visit, m, lang), q.visit?.serviceType, q.serviceMode || 'SEA_ROAD', isImp ? 'IMPORT' : 'EXPORT'))
  }

  useEffect(() => { load() }, [id]) // eslint-disable-line

  // Pre-fetch signature via backend proxy (avoids CORS issues with Azure Blob URLs)
  useEffect(() => {
    if (!quote?.creator?.signatureImageUrl) { setSignatureDataUrl(null); return }
    let cancelled = false
    getAccessToken().then(token => {
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      return fetch(`/api/quotes/${id}/creator-signature`, { headers })
    })
      .then(r => r.ok ? r.blob() : null)
      .then(blob => blob ? new Promise(resolve => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.readAsDataURL(blob)
      }) : null)
      .then(dataUrl => { if (!cancelled) setSignatureDataUrl(dataUrl) })
      .catch(() => { if (!cancelled) setSignatureDataUrl(null) })
    return () => { cancelled = true }
  }, [id, quote?.creator?.signatureImageUrl]) // eslint-disable-line

  const setStatus = async (status) => {
    setActing(true)
    await api.put(`/quotes/${id}`, { status })
    await load()
    setActing(false)
  }

  const handleConvertToJob = () => {
    if (isImport) {
      // Import quote: pre-fill job from the linked file, also link this quote
      navigate(`/jobs/new?fromFile=${movingFile.id}&type=IMPORT&fromQuote=${id}`)
    } else {
      if (!visit?.clientId) { setInterceptPending(true) }
      else { navigate(`/jobs/new?fromQuote=${id}`) }
    }
  }

  const handleClientCreated = async (newClient) => {
    if (visit?.id) await api.put(`/visits/${visit.id}`, { clientId: newClient.id })
    setShowCreateClient(false)
    navigate(`/jobs/new?fromQuote=${id}`)
  }

  const buildPDF = async () => {
    if (!docRef.current || !headerRef.current || !footerRef.current) return null
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ])
    const captureOpts = { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false }
    const [headerCanvas, footerCanvas, docCanvas] = await Promise.all([
      html2canvas(headerRef.current, captureOpts),
      html2canvas(footerRef.current, captureOpts),
      html2canvas(docRef.current, captureOpts),
    ])

    const pdf   = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()

    const mTop    = 30
    const mSide   = 28
    const mBottom = 16
    const gap     = 8

    const contentW      = pageW - mSide * 2
    const headerPt      = (headerCanvas.height / headerCanvas.width) * contentW
    const footerPt      = (footerCanvas.height / footerCanvas.width) * contentW
    const contentStartY = mTop + headerPt + gap
    const footerY       = pageH - mBottom - footerPt
    const slicePtH      = footerY - gap - contentStartY

    const docPxW   = docCanvas.width
    const docPxH   = docCanvas.height
    const slicePxH = Math.round((slicePtH / contentW) * docPxW)

    const headerDataUrl = headerCanvas.toDataURL('image/jpeg', 0.95)
    const footerDataUrl = footerCanvas.toDataURL('image/jpeg', 0.95)

    let page     = 0
    let offsetPx = 0

    while (offsetPx < docPxH) {
      if (page > 0) pdf.addPage()

      pdf.addImage(headerDataUrl, 'JPEG', mSide, mTop, contentW, headerPt)
      pdf.addImage(footerDataUrl, 'JPEG', mSide, footerY, contentW, footerPt)

      const thisSlicePx = Math.min(slicePxH, docPxH - offsetPx)
      const sliceCanvas = document.createElement('canvas')
      sliceCanvas.width  = docPxW
      sliceCanvas.height = thisSlicePx
      const ctx = sliceCanvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, docPxW, thisSlicePx)
      ctx.drawImage(docCanvas, 0, offsetPx, docPxW, thisSlicePx, 0, 0, docPxW, thisSlicePx)

      const thisSlicePt = (thisSlicePx / docPxW) * contentW
      pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', mSide, contentStartY, contentW, thisSlicePt)

      offsetPx += slicePxH
      page++
    }

    return pdf
  }

  const exportPDF = async () => {
    setExporting(true)
    try {
      const pdf = await buildPDF()
      if (pdf) pdf.save(`${quote.quoteNumber || 'quote'}.pdf`)
    } catch (err) {
      console.error('PDF export error', err)
    } finally {
      setExporting(false)
    }
  }

  const printPDF = async () => {
    setExporting(true)
    try {
      const pdf = await buildPDF()
      if (!pdf) return
      pdf.autoPrint()
      const blob = pdf.output('blob')
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (err) {
      console.error('PDF print error', err)
    } finally {
      setExporting(false)
    }
  }

  if (loading) return <div className="loading"><div className="spinner" /> {t('common.loading')}</div>
  if (!quote)  return null

  const qm = quoteStatusMeta(quote.status, t)
  const visit = quote.visit
  const vm = visit ? visitStatusMeta(visit.status, t) : null
  const movingFile = quote.movingFile || null
  const isImport = Boolean(movingFile)

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {quote.quoteNumber}
            <span className="badge" style={{ background: qm.bg, color: qm.color, fontSize: 12 }}>{qm.label}</span>
            {quote.language && (
              <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', fontSize: 11 }}>{quote.language}</span>
            )}
          </div>
          <div className="page-subtitle">{t('quotes.backSubtitle')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to="/quotes" className="btn btn-secondary btn-sm">{t('quotes.backToQuotes')}</Link>
          <Link to={`/quotes/${id}/edit`} className="btn btn-secondary btn-sm">{t('common.edit')}</Link>
          <button className="btn btn-secondary btn-sm" onClick={printPDF} disabled={exporting}>
            🖨 {t('common.print')}
          </button>
          <button className="btn btn-primary btn-sm" onClick={exportPDF} disabled={exporting}>
            {exporting ? '…' : `📥 ${t('quotes.downloadPdf')}`}
          </button>
        </div>
      </div>

      {/* Status actions */}
      <div className="card card-body" style={{ marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', marginRight: 4 }}>{t('visits.statusSection')}:</span>
        {quote.status === 'DRAFT' && (
          <button className="btn btn-primary btn-sm" disabled={acting} onClick={() => setStatus('SENT')}>
            {t('quotes.markSent')}
          </button>
        )}
        {quote.status === 'SENT' && (
          <>
            <button className="btn btn-primary btn-sm" disabled={acting} onClick={() => setStatus('ACCEPTED')}>
              {t('quotes.accept')}
            </button>
            <button className="btn btn-danger btn-sm" disabled={acting} onClick={() => setStatus('REJECTED')}>
              {t('quotes.reject')}
            </button>
          </>
        )}
        {quote.status === 'ACCEPTED' && !quote.job && (
          <button className="btn btn-primary btn-sm" onClick={handleConvertToJob}>{t('quotes.convertToJob')}</button>
        )}
        {quote.job && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('quotes.jobCreated')}:</span>
            <Link to={`/jobs/${quote.job.id}`} className="btn btn-secondary btn-sm">
              {t('quotes.viewJob')} — {quote.job.jobNumber}
            </Link>
          </div>
        )}
        {/* Linked visit or import file badge */}
        {visit && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('quotes.fromVisit')}:</span>
            <Link to={`/visits/${visit.id}`} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {visit.visitNumber}
              {vm && <span className="badge" style={{ background: vm.bg, color: vm.color, fontSize: 10 }}>{vm.label}</span>}
            </Link>
          </div>
        )}
        {isImport && movingFile && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('quotes.linkedFile')}:</span>
            <Link to={`/files/import/${movingFile.id}`} className="btn btn-secondary btn-sm">
              {movingFile.fileNumber}
            </Link>
          </div>
        )}
      </div>

      {interceptPending && (
        <div className="card card-body" style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', borderLeft: '4px solid #f59e0b' }}>
          <span style={{ flex: 1, minWidth: 200, fontSize: 14 }}>{t('quotes.noClientWarning')}</span>
          <button className="btn btn-primary btn-sm" onClick={() => { setInterceptPending(false); setShowCreateClient(true) }}>
            {t('quotes.createClientFirst')}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => { setInterceptPending(false); navigate(`/jobs/new?fromQuote=${id}`) }}>
            {t('quotes.continueWithoutClient')}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setInterceptPending(false)}>{t('common.cancel')}</button>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 16 }}>
        {[
          { key: 'document', label: t('quotes.documentTab') },
          { key: 'history',  label: t('audit.historyTab') },
        ].map(tb => (
          <button
            key={tb.key}
            onClick={() => setActiveTab(tb.key)}
            style={{
              padding: '8px 20px', background: 'none', border: 'none',
              borderBottom: activeTab === tb.key ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -2, cursor: 'pointer', fontSize: 14,
              fontWeight: activeTab === tb.key ? 600 : 400,
              color: activeTab === tb.key ? 'var(--primary)' : 'var(--text-muted)',
            }}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {activeTab === 'history' && <AuditHistory entityType="Quote" entityId={id} />}

      {/* Document view */}
      {activeTab === 'document' && (
      <div className="quote-document-wrapper">
        <QuoteDocument
          ref={docRef}
          headerRef={headerRef}
          footerRef={footerRef}
          sections={sections}
          editMode={false}
          language={quote.language || 'EN'}
          quoteNumber={quote.quoteNumber}
          sectionKeys={visit?.serviceType === 'LOCAL_MOVE' ? LOCAL_SECTION_KEYS : SECTION_KEYS}
          creator={quote.creator || null}
          signatureDataUrl={signatureDataUrl}
        />
      </div>
      )}

      <QuickCreateClientModal
        open={showCreateClient}
        onClose={() => setShowCreateClient(false)}
        initialName={visit?.prospectName || ''}
        initialPhone={visit?.prospectPhone || ''}
        initialEmail={visit?.prospectEmail || ''}
        onCreated={handleClientCreated}
      />
    </>
  )
}
