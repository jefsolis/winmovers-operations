import { useEffect, useRef, useState } from 'react'
import { api } from '../../api'
import { useLanguage } from '../../i18n'
import { fileCategoryMeta, formatFileSize, getFileCategories, REQUIRED_ATTACHMENTS } from '../../constants'

/**
 * FileAttachments — attachment manager for a MovingFile.
 * Props:
 *   fileId       String   id of the MovingFile
 *   fileCategory String   EXPORT | IMPORT | LOCAL
 *   onStatusChange fn(status)   called when file auto-closes or re-opens
 */
export default function FileAttachments({ fileId, fileCategory, onStatusChange, onAllRequiredDone }) {
  const { t } = useLanguage()
  const FILE_CATS   = getFileCategories(t)
  const requiredCats = REQUIRED_ATTACHMENTS[fileCategory] || []

  const [attachments, setAttachments]   = useState([])
  const [loading, setLoading]           = useState(true)
  const [uploading, setUploading]       = useState(null)
  const [error, setError]               = useState(null)
  const fileInputRef                    = useRef(null)
  const pendingCategoryRef              = useRef(null)

  // Notify parent when all required docs are uploaded
  const allRequiredDone = requiredCats.length === 0 ||
    requiredCats.every(cat => attachments.some(a => a.category === cat))
  useEffect(() => {
    if (!loading) onAllRequiredDone?.(allRequiredDone)
  }, [allRequiredDone, loading]) // eslint-disable-line

  const load = () => {
    setLoading(true)
    api.get(`/files/${fileId}/attachments`)
      .then(data => setAttachments(data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { if (fileId) load() }, [fileId]) // eslint-disable-line

  const triggerUpload = (category) => {
    const replaceIds = category !== 'OTHER'
      ? attachments.filter(f => f.category === category).map(f => f.id)
      : []
    pendingCategoryRef.current = { category, replaceIds }
    fileInputRef.current.value = ''
    fileInputRef.current.click()
  }

  const handleFileChosen = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const { category, replaceIds } = pendingCategoryRef.current
    setUploading(category)
    setError(null)
    try {
      if (replaceIds.length) {
        await Promise.all(replaceIds.map(id => api.delete(`/files/${fileId}/attachments/${id}`)))
        setAttachments(prev => prev.filter(f => !replaceIds.includes(f.id)))
      }
      const form = new FormData()
      form.append('file', file)
      form.append('category', category)
      const created = await api.upload(`/files/${fileId}/attachments`, form)
      setAttachments(prev => [created, ...prev.filter(f => !replaceIds.includes(f.id))])
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(null)
      pendingCategoryRef.current = null
    }
  }

  const handleDownload = async (att) => {
    try {
      const { url } = await api.get(`/files/${fileId}/attachments/${att.id}/download`)
      window.open(url, '_blank', 'noopener')
    } catch (e) { alert(e.message) }
  }

  const handleDelete = async (att) => {
    if (!window.confirm(t('files.deleteConfirm', { name: att.filename }))) return
    try {
      await api.delete(`/files/${fileId}/attachments/${att.id}`)
      setAttachments(prev => prev.filter(x => x.id !== att.id))
    } catch (e) { alert(e.message) }
  }

  if (loading) return <div className="loading"><div className="spinner" /></div>

  const byCategory = {}
  attachments.forEach(f => {
    if (!byCategory[f.category]) byCategory[f.category] = []
    byCategory[f.category].push(f)
  })

  const checklist = requiredCats.map(catVal => {
    const meta  = FILE_CATS.find(c => c.value === catVal) || { value: catVal, label: catVal, bg: '#e2e8f0', color: '#475569' }
    const items = byCategory[catVal] || []
    const done  = items.length > 0
    return { ...meta, items, done }
  })

  // OTHER uploads (not in required list)
  const otherItems = attachments.filter(f => !requiredCats.includes(f.category) || f.category === 'OTHER')

  const requiredDone  = checklist.filter(c => c.done).length
  const requiredTotal = checklist.length
  const requiredPct   = requiredTotal > 0 ? Math.round((requiredDone / requiredTotal) * 100) : 0

  return (
    <div>
      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileChosen} />

      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

      {/* Required checklist */}
      {checklist.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          {/* Progress bar */}
          <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>
                {t('files.requiredProgress', { done: requiredDone, total: requiredTotal })}
              </div>
              <div style={{ height: 8, borderRadius: 99, background: 'var(--surface-2, #f1f5f9)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${requiredPct}%`,
                  background: requiredDone === requiredTotal ? 'var(--success, #16a34a)' : 'var(--primary)',
                  borderRadius: 99,
                  transition: 'width 0.3s',
                }} />
              </div>
            </div>
            <div style={{ fontSize: 22, lineHeight: 1 }}>{requiredDone === requiredTotal ? '✅' : '📋'}</div>
          </div>
          <div className="section-label" style={{ marginBottom: 12 }}>{t('files.required')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {checklist.map(cat => (
              <div key={cat.value}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', borderRadius: 6,
                  border: `1px solid ${cat.done ? '#bbf7d0' : '#e2e8f0'}`,
                  background: cat.done ? '#f0fdf4' : '#fff',
                }}
              >
                <span style={{ fontSize: 16 }}>{cat.done ? '✅' : '⬜'}</span>
                <span className="badge" style={{ background: cat.bg, color: cat.color, fontSize: 11, whiteSpace: 'nowrap' }}>{cat.label}</span>
                {cat.items.map(att => (
                  <span key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDownload(att)}>
                      ⬇ {att.filename} ({formatFileSize(att.sizeBytes)})
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(att)}>✕</button>
                  </span>
                ))}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => triggerUpload(cat.value)}
                  disabled={uploading === cat.value}
                  style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}
                >
                  {uploading === cat.value ? '…' : cat.done ? t('files.replace') : t('files.upload')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other / extra attachments */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="section-label">{t('files.otherDocs')}</div>
          <button className="btn btn-ghost btn-sm" onClick={() => triggerUpload('OTHER')} disabled={uploading === 'OTHER'}>
            {uploading === 'OTHER' ? '…' : `+ ${t('files.upload')}`}
          </button>
        </div>
        {otherItems.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('files.noOtherDocs')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {otherItems.map(att => {
              const meta = FILE_CATS.find(c => c.value === att.category) || { label: att.category, bg: '#e2e8f0', color: '#475569' }
              return (
                <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6 }}>
                  <span className="badge" style={{ background: meta.bg, color: meta.color, fontSize: 11 }}>{meta.label}</span>
                  <span style={{ flex: 1, fontSize: 13 }}>{att.filename}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatFileSize(att.sizeBytes)}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDownload(att)}>⬇</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(att)}>✕</button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
