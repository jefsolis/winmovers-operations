import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'
import { fileStatusMeta } from '../../constants'
import FileAttachments from './FileAttachments'

const CATEGORY_ROUTES = { EXPORT: '/files/export', IMPORT: '/files/import', LOCAL: '/files/local' }

function InfoRow({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500 }}>{children}</div>
    </div>
  )
}

export default function FileDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useLanguage()

  const [file, setFile]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [deleting, setDeleting]       = useState(false)
  const [closing, setClosing]         = useState(false)
  const [allRequiredDone, setAllRequiredDone] = useState(false)
  const [attachmentPct, setAttachmentPct]     = useState(null)
  const [activeTab, setActiveTab] = useState('summary')
  const [exceptionModalOpen, setExceptionModalOpen] = useState(false)
  const [exceptionNote, setExceptionNote] = useState('')

  const load = () => {
    setLoading(true)
    api.get(`/files/${id}`)
      .then(f => {
        setFile(f)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id]) // eslint-disable-line

  const handleDelete = async () => {
    if (!window.confirm(t('movingFiles.deleteConfirm', { num: file?.fileNumber }))) return
    setDeleting(true)
    try {
      await api.delete(`/files/${id}`)
      navigate(CATEGORY_ROUTES[file.category] || '/files/export')
    } catch (e) { alert(e.message); setDeleting(false) }
  }

  const handleStatusChange = (newStatus) => {
    setFile(prev => prev ? { ...prev, status: newStatus } : prev)
  }

  const handleClose = async () => {
    if (!window.confirm(t('movingFiles.closeConfirm'))) return
    setClosing(true)
    try {
      const updated = await api.put(`/files/${id}`, { status: 'CLOSED' })
      setFile(updated)
    } catch (e) { alert(e.message) } finally { setClosing(false) }
  }

  const handleReopen = async () => {
    setClosing(true)
    try {
      const updated = await api.put(`/files/${id}`, { status: 'OPEN' })
      setFile(updated)
    } catch (e) { alert(e.message) } finally { setClosing(false) }
  }

  const handleExceptionClose = async () => {
    if (!exceptionNote.trim()) return
    setClosing(true)
    try {
      const appendedNotes = (file.notes ? file.notes + '\n---\n' : '') + t('movingFiles.exceptionClose') + ': ' + exceptionNote.trim()
      const updated = await api.put(`/files/${id}`, { status: 'CLOSED', notes: appendedNotes })
      setFile(updated)
      setExceptionModalOpen(false)
      setExceptionNote('')
    } catch (e) { alert(e.message) } finally { setClosing(false) }
  }

  if (loading) return <div className="loading"><div className="spinner" /> {t('common.loading')}</div>
  if (error)   return <div className="alert alert-error">{error}</div>
  if (!file)   return null

  const sm    = fileStatusMeta(file.status, t)
  const statusLabel = file.status === 'OPEN' && attachmentPct !== null
    ? `${sm.label} (${attachmentPct}%)`
    : sm.label
  const back  = CATEGORY_ROUTES[file.category] || '/files/export'
  const clientName = file.client
    ? (file.client.clientType === 'INDIVIDUAL'
        ? `${file.client.firstName || ''} ${file.client.lastName || ''}`.trim() || file.client.name
        : file.client.name)
    : '\u2014'

  const fileBookerRole  = file.bookerRole
  const winmovers       = t('movingFiles.winmoversOption')
  const originAgentName = file.originAgent?.name
    || (fileBookerRole === 'OA' || fileBookerRole === 'BOOKER' ? winmovers : '\u2014')
  const destAgentName   = file.destAgent?.name
    || (fileBookerRole === 'DA' || fileBookerRole === 'BOOKER' ? winmovers : '\u2014')

  const tabStyle = (tab) => ({
    padding: '8px 18px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: activeTab === tab ? 700 : 400,
    borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
    background: 'transparent',
    color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)',
    fontSize: 14,
  })

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="page-title">{file.fileNumber}</div>
            <span className="badge" style={{ background: sm.bg, color: sm.color, fontSize: 13 }}>{statusLabel}</span>
            <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: 13 }}>
              {t(`movingFiles.${file.category.toLowerCase()}Title`)}
            </span>
          </div>
          <div className="page-subtitle">{clientName}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to={back} className="btn btn-ghost">{t('movingFiles.backToFiles')}</Link>
          <Link to={`${back}/${id}/edit`} className="btn btn-primary">{t('common.edit')}</Link>
          {file.status !== 'CLOSED' ? (
            <>
              {file.category === 'LOCAL' && (
                <button
                  className="btn btn-secondary"
                  onClick={() => setExceptionModalOpen(true)}
                  disabled={closing}
                >
                  {t('movingFiles.exceptionCloseTitle')}
                </button>
              )}
              <button
                onClick={handleClose}
                disabled={closing || !allRequiredDone}
                style={{
                  padding: '6px 14px', borderRadius: 6, border: 'none', cursor: allRequiredDone ? 'pointer' : 'not-allowed',
                  background: allRequiredDone ? '#16a34a' : 'var(--surface-2, #e2e8f0)',
                  color: allRequiredDone ? '#fff' : 'var(--text-muted)',
                  fontWeight: 600, fontSize: 13, transition: 'background 0.2s',
                }}
                title={allRequiredDone ? '' : t('movingFiles.closeDisabledHint')}
              >
                {closing ? t('common.saving') : t('movingFiles.closeFile')}
              </button>
            </>
          ) : (
            <button className="btn btn-ghost" onClick={handleReopen} disabled={closing}>
              {closing ? t('common.saving') : t('movingFiles.reopenFile')}
            </button>
          )}
          <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? t('common.saving') : t('common.delete')}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        <button style={tabStyle('summary')}   onClick={() => setActiveTab('summary')}>
          {t('movingFiles.summaryTab')}
        </button>
        <button style={tabStyle('attachments')} onClick={() => setActiveTab('attachments')}>
          {t('movingFiles.attachmentsTab')}
        </button>
      </div>

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <>
          <div className="card card-body" style={{ marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '12px 20px' }}>

              <InfoRow label={t('movingFiles.fileNumber')}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{file.fileNumber}</span>
              </InfoRow>

              <InfoRow label={t('movingFiles.status')}>
                <span className="badge" style={{ background: sm.bg, color: sm.color }}>{statusLabel}</span>
              </InfoRow>

              {/* IMPORT-specific layout */}
              {file.category === 'IMPORT' && (() => {
                const job = file.job
                const company = file.corporateClient?.name || job?.companyName || null
                const clientPhone = file.client?.phone || file.client?.homePhone || job?.clientPhone || null
                const shipMode = file.shipmentMode || job?.shipmentMode
                const isAir = shipMode === 'AIR'
                const isSea = shipMode === 'SEA'
                const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '\u2014'
                const destAddr = [file.destAddress || job?.destAddress, file.destCity || job?.destCity, file.destCountry || job?.destCountry].filter(Boolean).join(', ') || '\u2014'
                const origAddr = [file.originAddress || job?.originAddress, file.originCity || job?.originCity, file.originCountry || job?.originCountry].filter(Boolean).join(', ') || '\u2014'
                const navieraLabel = isAir ? t('movingFiles.aerolinea') : isSea ? t('movingFiles.naviera') : `${t('movingFiles.naviera')} / ${t('movingFiles.aerolinea')}`
                return (<>
                  <InfoRow label={t('common.name')}>{clientName}</InfoRow>
                  <InfoRow label={t('movingFiles.destAddress')}>{destAddr}</InfoRow>
                  <InfoRow label={t('movingFiles.company')}>{company || '\u2014'}</InfoRow>
                  <InfoRow label={t('jobs.originAddress')}>{origAddr}</InfoRow>
                  <InfoRow label={t('movingFiles.originAgent')}>{originAgentName}</InfoRow>
                  <InfoRow label={t('movingFiles.clientPhone')}>{clientPhone || '\u2014'}</InfoRow>
                  <InfoRow label={t('movingFiles.shipmentMode')}>{shipMode ? t(`modes.${shipMode}`) : '\u2014'}</InfoRow>
                  <InfoRow label={t('movingFiles.serviceType')}>{file.serviceType ? t(`serviceTypes.${file.serviceType}`) : '\u2014'}</InfoRow>
                  <InfoRow label={t('movingFiles.etd')}>{fmt(file.etd)}</InfoRow>
                  <InfoRow label={t('movingFiles.eta')}>{fmt(file.eta)}</InfoRow>
                  <InfoRow label={navieraLabel}>{file.navieraAerolinea || '\u2014'}</InfoRow>
                  <InfoRow label={t('movingFiles.puertoEntrada')}>{file.puertoEntrada || '\u2014'}</InfoRow>
                  <InfoRow label={t('movingFiles.oblHastaCiudad')}>{file.oblHastaCiudad || '\u2014'}</InfoRow>
                  <InfoRow label={t('movingFiles.fechaLlegada')}>{fmt(file.fechaLlegada)}</InfoRow>
                  <InfoRow label={t('movingFiles.trasladoBodega')}>{fmt(file.fechaTrasladoBodega)}</InfoRow>
                  <InfoRow label={t('movingFiles.fechaTraslado')}>{fmt(file.fechaTraslado)}</InfoRow>
                  <InfoRow label={t('movingFiles.fechaEntrega')}>{fmt(file.fechaEntrega)}</InfoRow>
                </>)
              })()}

              {/* EXPORT-specific layout */}
              {file.category === 'EXPORT' && (() => {
                const job = file.job
                const company = file.corporateClient?.name || job?.companyName || null
                const clientPhone = file.client?.phone || file.client?.homePhone || job?.clientPhone || null
                const shipMode = file.shipmentMode || job?.shipmentMode
                const isAir = shipMode === 'AIR'
                const isSea = shipMode === 'SEA'
                const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '\u2014'
                const origAddr = [file.originAddress || job?.originAddress, file.originCity || job?.originCity, file.originCountry || job?.originCountry].filter(Boolean).join(', ') || '\u2014'
                const destAddr = [file.destAddress || job?.destAddress, file.destCity || job?.destCity, file.destCountry || job?.destCountry].filter(Boolean).join(', ') || '\u2014'
                const navieraLabel = isAir ? t('movingFiles.aerolinea') : isSea ? t('movingFiles.naviera') : `${t('movingFiles.naviera')} / ${t('movingFiles.aerolinea')}`
                const vaporLabel = isAir ? t('movingFiles.vuelo') : isSea ? t('movingFiles.vapor') : `${t('movingFiles.vapor')} / ${t('movingFiles.vuelo')}`
                return (<>
                  <InfoRow label={t('common.name')}>{clientName}</InfoRow>
                  <InfoRow label={t('jobs.originAddress')}>{origAddr}</InfoRow>
                  <InfoRow label={t('movingFiles.clientPhone')}>{clientPhone || '\u2014'}</InfoRow>
                  <InfoRow label={t('movingFiles.company')}>{company || '\u2014'}</InfoRow>
                  <InfoRow label={t('movingFiles.destAddress')}>{destAddr}</InfoRow>
                  <InfoRow label={t('movingFiles.destAgent')}>{destAgentName}</InfoRow>
                  <InfoRow label={t('movingFiles.shipmentMode')}>{shipMode ? t(`modes.${shipMode}`) : '\u2014'}</InfoRow>
                  <InfoRow label={t('movingFiles.serviceType')}>{file.serviceType ? t(`serviceTypes.${file.serviceType}`) : '\u2014'}</InfoRow>
                  <InfoRow label={t('movingFiles.etd')}>{fmt(file.etd)}</InfoRow>
                  <InfoRow label={t('movingFiles.eta')}>{fmt(file.eta)}</InfoRow>
                  <InfoRow label={navieraLabel}>{file.navieraAerolinea || '\u2014'}</InfoRow>
                  <InfoRow label={vaporLabel}>{file.vaporVuelo || '\u2014'}</InfoRow>
                  <InfoRow label={t('movingFiles.guiaObl')}>{file.guiaObl || '\u2014'}</InfoRow>
                  <InfoRow label={t('movingFiles.puertoSalida')}>{file.puertoSalida || '\u2014'}</InfoRow>
                  <InfoRow label={t('movingFiles.puertoLlegada')}>{file.puertoLlegada || '\u2014'}</InfoRow>
                  <InfoRow label={t('movingFiles.destPhone')}>{file.destPhone || '\u2014'}</InfoRow>
                </>)
              })()}

              {/* LOCAL-specific layout */}
              {file.category === 'LOCAL' && (
                <>
                  <InfoRow label={t('common.name')}>{clientName}</InfoRow>
                  {file.serviceType && (
                    <InfoRow label={t('movingFiles.serviceType')}>
                      {t(`serviceTypes.${file.serviceType}`) || file.serviceType}
                    </InfoRow>
                  )}
                  {file.shipmentMode && (
                    <InfoRow label={t('movingFiles.shipmentMode')}>
                      {t(`modes.${file.shipmentMode}`) || file.shipmentMode}
                    </InfoRow>
                  )}
                  {file.volumeCbm != null && (
                    <InfoRow label={t('movingFiles.volumeCbm')}>{file.volumeCbm} CBM</InfoRow>
                  )}
                  {file.weightKg != null && (
                    <InfoRow label={t('movingFiles.weightKg')}>{file.weightKg} Kg</InfoRow>
                  )}
                </>
              )}

              {/* Linked Job */}
              {file.job ? (
                <InfoRow label={t('movingFiles.linkedJob')}>
                  <Link to={`/jobs/${file.job.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                    {file.job.jobNumber}
                  </Link>
                </InfoRow>
              ) : file.category !== 'LOCAL' ? (
                <InfoRow label={t('movingFiles.linkedJob')}>
                  <Link to={`/jobs/new?fromFile=${id}&type=${file.category}`} className="btn btn-ghost btn-sm">
                    + {t('movingFiles.createJobForFile')}
                  </Link>
                </InfoRow>
              ) : null}

            </div>

            {file.notes && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{t('common.notes')}</div>
                <p style={{ fontSize: 14, margin: 0, whiteSpace: 'pre-line' }}>{file.notes}</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Attachments Tab — always mounted for allRequiredDone tracking */}
      <div style={{ display: activeTab === 'attachments' ? 'block' : 'none' }}>
        <div className="card card-body">
          <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 16 }}>
            {t('files.title')}
          </div>
          <FileAttachments fileId={id} fileCategory={file.category} onStatusChange={handleStatusChange} onAllRequiredDone={setAllRequiredDone} onPctChange={setAttachmentPct} />
        </div>
      </div>

      {/* Exception Close Modal */}
      {exceptionModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card card-body" style={{ width: 420, padding: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{t('movingFiles.exceptionCloseTitle')}</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{t('movingFiles.exceptionCloseHint')}</p>
            <label style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
              {t('movingFiles.exceptionCloseNotes')}
            </label>
            <textarea
              className="form-control"
              rows={3}
              value={exceptionNote}
              onChange={e => setExceptionNote(e.target.value)}
              style={{ marginBottom: 16, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setExceptionModalOpen(false); setExceptionNote('') }} disabled={closing}>
                {t('common.cancel')}
              </button>
              <button
                className="btn btn-danger"
                onClick={handleExceptionClose}
                disabled={closing || !exceptionNote.trim()}
              >
                {closing ? t('common.saving') : t('movingFiles.exceptionCloseConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
