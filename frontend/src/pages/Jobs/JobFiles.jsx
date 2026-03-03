import { useEffect, useRef, useState } from 'react'
import { api } from '../../api'
import { useLanguage } from '../../i18n'
import { fileCategoryMeta, formatFileSize, getFileCategories, REQUIRED_FILE_CATEGORIES } from '../../constants'

export default function JobFiles({ jobId, onCountChange, onRequiredStatusChange }) {
  const { t } = useLanguage()
  const FILE_CATS = getFileCategories(t)

  const [files, setFiles]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [uploading, setUploading]     = useState(null) // category being uploaded
  const [error, setError]             = useState(null)
  const fileInputRef                  = useRef(null)
  const pendingCategoryRef            = useRef(null)

  const load = () => {
    setLoading(true)
    api.get(`/jobs/${jobId}/files`)
      .then(data => { setFiles(data); onCountChange?.(data.length) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [jobId]) // eslint-disable-line

  // Trigger a hidden file input for a given category
  const triggerUpload = (category) => {
    // For required categories: capture existing IDs so Replace deletes them first.
    // For OTHER: always add (never replace all other files).
    const replaceIds = category !== 'OTHER'
      ? files.filter(f => f.category === category).map(f => f.id)
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
      // Delete existing files for this category first (Replace behaviour)
      if (replaceIds.length) {
        await Promise.all(replaceIds.map(id => api.delete(`/jobs/${jobId}/files/${id}`)))
        setFiles(prev => prev.filter(f => !replaceIds.includes(f.id)))
      }
      const form = new FormData()
      form.append('file', file)
      form.append('category', category)
      const created = await api.upload(`/jobs/${jobId}/files`, form)
      setFiles(prev => {
        const next = [created, ...prev.filter(f => !replaceIds.includes(f.id))]
        onCountChange?.(next.length)
        return next
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(null)
      pendingCategoryRef.current = null
    }
  }

  const handleDownload = async (f) => {
    try {
      const { url } = await api.get(`/jobs/${jobId}/files/${f.id}/download`)
      window.open(url, '_blank', 'noopener')
    } catch (e) { alert(e.message) }
  }

  const handleDelete = async (f) => {
    if (!window.confirm(t('files.deleteConfirm', { name: f.filename }))) return
    try {
      await api.delete(`/jobs/${jobId}/files/${f.id}`)
      setFiles(prev => {
        const next = prev.filter(x => x.id !== f.id)
        onCountChange?.(next.length)
        return next
      })
    } catch (e) { alert(e.message) }
  }

  // Notify parent whenever required-docs completion status changes
  useEffect(() => {
    const bycat = {}
    files.forEach(f => { if (!bycat[f.category]) bycat[f.category] = []; bycat[f.category].push(f) })
    const done = REQUIRED_FILE_CATEGORIES.filter(c => bycat[c]?.length).length
    onRequiredStatusChange?.(done === REQUIRED_FILE_CATEGORIES.length)
  }, [files]) // eslint-disable-line

  // Group files by category (multiple per category allowed)
  const byCategory = {}
  files.forEach(f => {
    if (!byCategory[f.category]) byCategory[f.category] = []
    byCategory[f.category].push(f)
  })

  const otherFiles = byCategory['OTHER'] || []
  const requiredDone = REQUIRED_FILE_CATEGORIES.filter(c => byCategory[c]?.length).length

  if (loading) return <div className="loading"><div className="spinner" /> {t('common.loading')}</div>

  return (
    <div>
      {/* Hidden shared file input */}
      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileChosen} />

      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

      {/* Progress summary */}
      <div className="card card-body" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
            {t('files.requiredProgress', { done: requiredDone, total: REQUIRED_FILE_CATEGORIES.length })}
          </div>
          <div style={{ height: 8, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${(requiredDone / REQUIRED_FILE_CATEGORIES.length) * 100}%`,
              background: requiredDone === REQUIRED_FILE_CATEGORIES.length ? 'var(--success, #16a34a)' : 'var(--primary)',
              borderRadius: 99,
              transition: 'width 0.3s',
            }} />
          </div>
        </div>
        <div style={{ fontSize: 22, lineHeight: 1 }}>
          {requiredDone === REQUIRED_FILE_CATEGORIES.length ? '✅' : '📋'}
        </div>
      </div>

      {/* Required documents checklist */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>
          {t('files.requiredDocuments')}
        </div>
        {REQUIRED_FILE_CATEGORIES.map(catValue => {
          const cm = fileCategoryMeta(catValue, t)
          const catFiles = byCategory[catValue] || []
          const isUploading = uploading === catValue
          return (
            <div key={catValue} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 18px', borderBottom: '1px solid var(--border)',
              background: catFiles.length ? 'transparent' : 'transparent',
            }}>
              {/* Status dot */}
              <span style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                background: catFiles.length ? 'var(--success, #16a34a)' : 'var(--border)',
              }} />
              {/* Category label */}
              <span style={{ minWidth: 200, fontSize: 13, fontWeight: 500 }}>
                <span className="badge" style={{ background: cm.bg, color: cm.color }}>{cm.label}</span>
              </span>
              {/* Files or placeholder */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {catFiles.length === 0
                  ? <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('files.notUploaded')}</span>
                  : catFiles.map(f => (
                      <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>📄 {f.filename}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatFileSize(f.sizeBytes)}</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDownload(f)}>{t('files.download')}</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(f)}>{t('common.delete')}</button>
                      </div>
                    ))
                }
              </div>
              {/* Attach button */}
              <button
                className="btn btn-secondary btn-sm"
                style={{ flexShrink: 0 }}
                disabled={isUploading}
                onClick={() => triggerUpload(catValue)}
              >
                {isUploading ? t('files.uploading') : catFiles.length ? t('files.replace') : t('files.attach')}
              </button>
            </div>
          )
        })}
      </div>

      {/* Other documents */}
      <div className="card">
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{t('files.otherDocuments')}</span>
          <button
            className="btn btn-secondary btn-sm"
            disabled={uploading === 'OTHER'}
            onClick={() => triggerUpload('OTHER')}
          >
            {uploading === 'OTHER' ? t('files.uploading') : t('files.addOther')}
          </button>
        </div>
        {otherFiles.length === 0
          ? <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {t('files.noOtherFiles')}
            </div>
          : otherFiles.map(f => (
              <div key={f.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 18px', borderBottom: '1px solid var(--border)',
                flexWrap: 'wrap',
              }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>📄 {f.filename}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatFileSize(f.sizeBytes)}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => handleDownload(f)}>{t('files.download')}</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(f)}>{t('common.delete')}</button>
              </div>
            ))
        }
      </div>
    </div>
  )
}
