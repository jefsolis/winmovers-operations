import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'
import { fileStatusMeta, statusMeta } from '../../constants'
import FileAttachments from './FileAttachments'

const CATEGORY_ROUTES = { EXPORT: '/files/export', IMPORT: '/files/import', LOCAL: '/files/local' }

export default function FileDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useLanguage()

  const [file, setFile]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [deleting, setDeleting] = useState(false)

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

  if (loading) return <div className="loading"><div className="spinner" /> {t('common.loading')}</div>
  if (error)   return <div className="alert alert-error">{error}</div>
  if (!file)   return null

  const sm    = fileStatusMeta(file.status, t)
  const back  = CATEGORY_ROUTES[file.category] || '/files/export'
  const clientName = file.client
    ? (file.client.clientType === 'INDIVIDUAL'
        ? `${file.client.firstName || ''} ${file.client.lastName || ''}`.trim() || file.client.name
        : file.client.name)
    : '—'

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
          <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? t('common.saving') : t('common.delete')}
          </button>
        </div>
      </div>

      {/* Info card */}
      <div className="card card-body" style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '12px 20px' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{t('movingFiles.fileNumber')}</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{file.fileNumber}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{t('movingFiles.category')}</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{t(`movingFiles.${file.category.toLowerCase()}Title`)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{t('common.name')}</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{clientName}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{t('movingFiles.status')}</div>
            <span className="badge" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
          </div>
          {file.job && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{t('movingFiles.linkedJob')}</div>
              <Link to={`/jobs/${file.job.id}`} style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 14 }}>
                {file.job.jobNumber}
              </Link>
              {' '}
              <span className="badge" style={{ ...statusMeta(file.job.status, t), fontSize: 11 }}>
                {statusMeta(file.job.status, t).label}
              </span>
            </div>
          )}
          {!file.job && file.category !== 'LOCAL' && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{t('movingFiles.linkedJob')}</div>
              <Link to={`/jobs/new?fromFile=${id}&type=${file.category}`} className="btn btn-ghost btn-sm">
                + {t('movingFiles.createJobForFile')}
              </Link>
            </div>
          )}
        </div>
        {file.notes && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{t('common.notes')}</div>
            <p style={{ fontSize: 14, margin: 0, whiteSpace: 'pre-line' }}>{file.notes}</p>
          </div>
        )}
      </div>

      {/* Attachments */}
      <div className="card card-body">
        <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 16 }}>
          {t('files.title')}
        </div>
        <FileAttachments fileId={id} fileCategory={file.category} onStatusChange={handleStatusChange} />
      </div>
    </>
  )
}
