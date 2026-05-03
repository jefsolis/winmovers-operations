import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'
import { fileStatusMeta, getFileProgressionStatuses, stripFilePrefix } from '../../constants'
import FileAttachments from './FileAttachments'
import AuditHistory from '../../components/AuditHistory'

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
  const [voidModalOpen, setVoidModalOpen] = useState(false)
  const [voidNote, setVoidNote] = useState('')

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
    if (!window.confirm(t('movingFiles.deleteConfirm', { num: stripFilePrefix(file?.fileNumber) }))) return
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

  const handleSetStatus = async (newStatus) => {
    setClosing(true)
    try {
      const updated = await api.put(`/files/${id}`, { status: newStatus })
      setFile(updated)
    } catch (e) { alert(e.message) } finally { setClosing(false) }
  }

  const handleVoid = async () => {
    if (!voidNote.trim()) return
    setClosing(true)
    try {
      const appendedNotes = (file.notes ? file.notes + '\n---\n' : '') + t('movingFiles.voidFile') + ': ' + voidNote.trim()
      const updated = await api.put(`/files/${id}`, { status: 'VOID', notes: appendedNotes })
      setFile(updated)
      setVoidModalOpen(false)
      setVoidNote('')
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

  const _shipMode  = file.shipmentMode
  const _shipModes  = _shipMode ? _shipMode.split(',').filter(Boolean) : []
  const _isAir    = _shipModes.length === 1 && _shipModes[0] === 'AIR'
  const _isSea    = _shipModes.length === 1 && _shipModes[0] === 'SEA'
  const _navLabel = _isAir ? t('movingFiles.aerolinea') : _isSea ? t('movingFiles.naviera') : `${t('movingFiles.naviera')} / ${t('movingFiles.aerolinea')}`
  const _vapLabel = _isAir ? t('movingFiles.vuelo')     : _isSea ? t('movingFiles.vapor')   : `${t('movingFiles.vapor')} / ${t('movingFiles.vuelo')}`
  const _formatModes = (raw) => raw ? raw.split(',').filter(Boolean).map(m => t(`modes.${m}`)).join(' + ') : '—'
  const _formatLoadType = (raw) => raw ? raw.split(',').filter(Boolean).map(m => t(`loadTypes.${m}`)).join(' + ') : '—'

  const requiredFieldsList = file.category === 'IMPORT' ? [
    { label: t('movingFiles.etd'),           done: Boolean(file.etd) },
    { label: t('movingFiles.eta'),           done: Boolean(file.eta) },
    { label: _navLabel,                      done: Boolean(file.navieraAerolinea) },
    { label: t('movingFiles.puertoEntrada'), done: Boolean(file.puertoEntrada) },
    { label: t('movingFiles.oblHastaCiudad'),done: Boolean(file.oblHastaCiudad) },
    { label: t('movingFiles.fechaLlegada'),  done: Boolean(file.fechaLlegada) },
    { label: t('movingFiles.trasladoBodega'),done: file.anticipado || Boolean(file.fechaTrasladoBodega) },
    { label: t('movingFiles.fechaTraslado'), done: Boolean(file.fechaTraslado) },
    { label: t('movingFiles.fechaEntrega'),  done: Boolean(file.fechaEntrega) },
  ] : file.category === 'EXPORT' ? [
    { label: t('movingFiles.etd'),           done: Boolean(file.etd) },
    { label: t('movingFiles.eta'),           done: Boolean(file.eta) },
    { label: _navLabel,                      done: Boolean(file.navieraAerolinea) },
    { label: _vapLabel,                      done: Boolean(file.vaporVuelo) },
    { label: t('movingFiles.guiaObl'),       done: Boolean(file.guiaObl) },
    { label: t('movingFiles.puertoSalida'),  done: Boolean(file.puertoSalida) },
    { label: t('movingFiles.puertoLlegada'), done: Boolean(file.puertoLlegada) },
  ] : []
  const allFieldsDone = requiredFieldsList.every(f => f.done)
  const canClose = allRequiredDone && allFieldsDone

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
            <div className="page-title">{stripFilePrefix(file.fileNumber)}</div>
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
          {file.status !== 'CLOSED' && file.status !== 'VOID' ? (
            <>
              {file.category !== 'LOCAL' && (
                <select
                  value={file.status}
                  onChange={e => handleSetStatus(e.target.value)}
                  disabled={closing}
                  style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 13, cursor: 'pointer' }}
                >
                  {getFileProgressionStatuses(file.category, t).map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              )}
              {file.category === 'LOCAL' && (
                <button
                  className="btn btn-secondary"
                  onClick={() => setExceptionModalOpen(true)}
                  disabled={closing}
                >
                  {t('movingFiles.exceptionCloseTitle')}
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setVoidModalOpen(true)} disabled={closing}>
                {t('movingFiles.voidFile')}
              </button>
              <button
                onClick={handleClose}
                disabled={closing || !canClose}
                style={{
                  padding: '6px 14px', borderRadius: 6, border: 'none', cursor: canClose ? 'pointer' : 'not-allowed',
                  background: canClose ? '#16a34a' : 'var(--surface-2, #e2e8f0)',
                  color: canClose ? '#fff' : 'var(--text-muted)',
                  fontWeight: 600, fontSize: 13, transition: 'background 0.2s',
                }}
                title={canClose ? '' : t('movingFiles.closeDisabledHint')}
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
        <button style={tabStyle('history')} onClick={() => setActiveTab('history')}>
          {t('audit.historyTab')}
        </button>
      </div>

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <>
          <div className="card card-body" style={{ marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '12px 20px' }}>

              <InfoRow label={t('movingFiles.fileNumber')}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{stripFilePrefix(file.fileNumber)}</span>
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
                const _smArr = shipMode ? shipMode.split(',').filter(Boolean) : []
                const isAir = _smArr.length === 1 && _smArr[0] === 'AIR'
                const isSea = _smArr.length === 1 && _smArr[0] === 'SEA'
                const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB', { timeZone: 'UTC' }) : '\u2014'
                const destAddr = [file.destAddress || job?.destAddress, file.destCity || job?.destCity, file.destCountry || job?.destCountry].filter(Boolean).join(', ') || '\u2014'
                const origCountry = file.originCountry || job?.originCountry || '\u2014'
                const navieraLabel = isAir ? t('movingFiles.aerolinea') : isSea ? t('movingFiles.naviera') : `${t('movingFiles.naviera')} / ${t('movingFiles.aerolinea')}`
                return (<>
                  <InfoRow label={t('common.name')}>{clientName}</InfoRow>
                  <InfoRow label={t('movingFiles.destAddress')}>{destAddr}</InfoRow>
                  <InfoRow label={t('movingFiles.company')}>{company || '\u2014'}</InfoRow>
                  <InfoRow label={t('jobs.originCountry')}>{origCountry}</InfoRow>
                  <InfoRow label={t('movingFiles.originAgent')}>{originAgentName}</InfoRow>                  <InfoRow label={t('movingFiles.coordinator')}>{file.coordinator?.name || '—'}</InfoRow>                  <InfoRow label={t('movingFiles.clientPhone')}>{clientPhone || '\u2014'}</InfoRow>
                  <InfoRow label={t('movingFiles.shipmentMode')}>{_formatModes(shipMode)}</InfoRow>
                  <InfoRow label={t('movingFiles.loadType')}>{_formatLoadType(file.loadType)}</InfoRow>
                  <InfoRow label={t('movingFiles.serviceType')}>{file.serviceType ? t(`serviceTypes.${file.serviceType}`) : '\u2014'}</InfoRow>
                  <InfoRow label={t('movingFiles.etd')}>{fmt(file.etd)}</InfoRow>
                  <InfoRow label={t('movingFiles.eta')}>{fmt(file.eta)}</InfoRow>
                  <InfoRow label={navieraLabel}>{file.navieraAerolinea || '\u2014'}</InfoRow>
                  <InfoRow label={t('movingFiles.puertoEntrada')}>{file.puertoEntrada || '\u2014'}</InfoRow>
                  <InfoRow label={t('movingFiles.oblHastaCiudad')}>{file.oblHastaCiudad || '\u2014'}</InfoRow>
                  <InfoRow label={t('movingFiles.fechaLlegada')}>{fmt(file.fechaLlegada)}</InfoRow>
                  <InfoRow label={t('movingFiles.trasladoBodega')}>
                    {file.anticipado
                      ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('movingFiles.anticipado')}</span>
                      : (file.fechaTrasladoBodega || '\u2014')}
                  </InfoRow>
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
                const _smArr2 = shipMode ? shipMode.split(',').filter(Boolean) : []
                const isAir = _smArr2.length === 1 && _smArr2[0] === 'AIR'
                const isSea = _smArr2.length === 1 && _smArr2[0] === 'SEA'
                const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB', { timeZone: 'UTC' }) : '\u2014'
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
                  <InfoRow label={t('movingFiles.destAgent')}>{destAgentName}</InfoRow>                  <InfoRow label={t('movingFiles.coordinator')}>{job?.coordinator?.name || '—'}</InfoRow>                  <InfoRow label={t('movingFiles.shipmentMode')}>{_formatModes(shipMode)}</InfoRow>
                  <InfoRow label={t('movingFiles.loadType')}>{_formatLoadType(file.loadType)}</InfoRow>
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
                      {_formatModes(file.shipmentMode)}
                    </InfoRow>
                  )}
                  {file.loadType && (
                    <InfoRow label={t('movingFiles.loadType')}>
                      {_formatLoadType(file.loadType)}
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

          {/* Ready to Close card — all categories while active */}
          {file.status !== 'CLOSED' && file.status !== 'VOID' && (
            <div className="card card-body" style={{
              marginBottom: 20,
              border: `1.5px solid ${canClose ? '#16a34a' : '#f59e0b'}`,
            }}>
              <div style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: canClose ? '#16a34a' : '#92400e', marginBottom: 14 }}>
                {t('movingFiles.readyToClose')}
              </div>

              {/* Attachments row */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: allRequiredDone ? '#16a34a' : '#ef4444', fontWeight: 700 }}>{allRequiredDone ? '\u2713' : '\u2717'}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{t('movingFiles.requiredDocs')}</span>
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: allRequiredDone ? '#16a34a' : '#b45309' }}>
                    {attachmentPct !== null ? `${attachmentPct}%` : '\u2014'}
                  </span>
                </div>
                {attachmentPct !== null && (
                  <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${attachmentPct}%`, background: allRequiredDone ? '#16a34a' : '#f59e0b', borderRadius: 3, transition: 'width 0.3s' }} />
                  </div>
                )}
              </div>

              {/* Required fields — only for IMPORT/EXPORT */}
              {requiredFieldsList.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 10 }}>
                  {t('movingFiles.requiredFields')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '6px 16px' }}>
                  {requiredFieldsList.map(f => (
                    <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13 }}>
                      <span style={{ color: f.done ? '#16a34a' : '#ef4444', fontWeight: 700, flexShrink: 0 }}>{f.done ? '\u2713' : '\u2717'}</span>
                      <span style={{ color: f.done ? 'var(--text)' : '#ef4444', fontWeight: f.done ? 400 : 600 }}>{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              )}

              <div style={{ marginTop: 14, textAlign: 'right' }}>
                <Link to={`${back}/${id}/edit`} className="btn btn-ghost btn-sm">{t('common.edit')}</Link>
              </div>
            </div>
          )}
        </>
      )}

      {/* Attachments Tab — always mounted for allRequiredDone tracking */}
      <div style={{ display: activeTab === 'attachments' ? 'block' : 'none' }}>
        <div className="card card-body">
          <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 16 }}>
            {t('files.title')}
          </div>
          <FileAttachments fileId={id} fileCategory={file.category} fechaEntrega={file.fechaEntrega} job={file.job} bookerRole={file.bookerRole} onStatusChange={handleStatusChange} onAllRequiredDone={setAllRequiredDone} onPctChange={setAttachmentPct} />
        </div>
      </div>

      {/* History Tab */}
      {activeTab === 'history' && (
        <AuditHistory entityType="MovingFile" entityId={id} />
      )}

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

      {/* Void File Modal */}
      {voidModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card card-body" style={{ width: 420, padding: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{t('movingFiles.voidTitle')}</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{t('movingFiles.voidHint')}</p>
            <label style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
              {t('movingFiles.voidNotes')}
            </label>
            <textarea
              className="form-control"
              rows={3}
              value={voidNote}
              onChange={e => setVoidNote(e.target.value)}
              style={{ marginBottom: 16, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setVoidModalOpen(false); setVoidNote('') }} disabled={closing}>
                {t('common.cancel')}
              </button>
              <button
                className="btn btn-danger"
                onClick={handleVoid}
                disabled={closing || !voidNote.trim()}
              >
                {closing ? t('common.saving') : t('movingFiles.voidConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
