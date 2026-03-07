import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'
import { fileStatusMeta, statusMeta } from '../../constants'
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
  const [activeTab, setActiveTab] = useState('summary')

  const load = () => {
    setLoading(true)
    api.get(`/files/${id}`)
      .then(setFile)
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

  if (loading) return <div className="loading"><div className="spinner" /> {t('common.loading')}</div>
  if (error)   return <div className="alert alert-error">{error}</div>
  if (!file)   return null

  const sm    = fileStatusMeta(file.status, t)
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
            <span className="badge" style={{ background: sm.bg, color: sm.color, fontSize: 13 }}>{sm.label}</span>
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

              <InfoRow label={t('movingFiles.category')}>
                {t(`movingFiles.${file.category.toLowerCase()}Title`)}
              </InfoRow>

              <InfoRow label={t('movingFiles.status')}>
                <span className="badge" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
              </InfoRow>

              <InfoRow label={t('common.name')}>{clientName}</InfoRow>

              {file.corporateClient && (
                <InfoRow label={t('movingFiles.corporateClient')}>{file.corporateClient.name}</InfoRow>
              )}

              {file.bookerRole && (
                <InfoRow label={t('movingFiles.bookerRole')}>
                  {t(`movingFiles.bookerRoles.${file.bookerRole}`) || file.bookerRole}
                </InfoRow>
              )}

              <InfoRow label={t('movingFiles.originAgent')}>{originAgentName}</InfoRow>
              <InfoRow label={t('movingFiles.destAgent')}>{destAgentName}</InfoRow>

              {file.serviceType && (
                <InfoRow label={t('movingFiles.serviceType')}>
                  {t(`serviceTypes.${file.serviceType}`) || file.serviceType}
                </InfoRow>
              )}

              {file.shipmentMode && (
                <InfoRow label={t('movingFiles.shipmentMode')}>
                  {t(`shipmentModes.${file.shipmentMode}`) || file.shipmentMode}
                </InfoRow>
              )}

              {(file.volumeCbm != null) && (
                <InfoRow label={t('movingFiles.volumeCbm')}>{file.volumeCbm} CBM</InfoRow>
              )}

              {(file.weightKg != null) && (
                <InfoRow label={t('movingFiles.weightKg')}>{file.weightKg} Kg</InfoRow>
              )}

              {file.job ? (
                <InfoRow label={t('movingFiles.linkedJob')}>
                  <Link to={`/jobs/${file.job.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                    {file.job.jobNumber}
                  </Link>
                  {' '}
                  <span className="badge" style={{ ...statusMeta(file.job.status, t), fontSize: 11 }}>
                    {statusMeta(file.job.status, t).label}
                  </span>
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
          <FileAttachments fileId={id} fileCategory={file.category} onStatusChange={handleStatusChange} onAllRequiredDone={setAllRequiredDone} />
        </div>
      </div>
    </>
  )
}
