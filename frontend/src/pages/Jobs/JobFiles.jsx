import { useEffect, useRef, useState } from 'react'
import { api } from '../../api'
import { useLanguage } from '../../i18n'
import { fileCategoryMeta, formatFileSize, getFileCategories } from '../../constants'

export default function JobFiles({ jobId, onCountChange }) {
  const { t } = useLanguage()
  const FILE_CATS = getFileCategories(t)

  const [files, setFiles]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)
  const [category, setCategory]   = useState('OTHER')
  const [catFilter, setCatFilter] = useState('')
  const [error, setError]         = useState(null)
  const fileInputRef = useRef(null)

  const load = () => {
    setLoading(true)
    api.get(`/jobs/${jobId}/files`)
      .then(data => {
        setFiles(data)
        onCountChange?.(data.length)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [jobId]) // eslint-disable-line

  const handleUpload = async () => {
    const file = fileInputRef.current?.files[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('category', category)
      const created = await api.upload(`/jobs/${jobId}/files`, form)
      setFiles(prev => {
        const next = [created, ...prev]
        onCountChange?.(next.length)
        return next
      })
      fileInputRef.current.value = ''
      setCategory('OTHER')
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
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

  const displayed = catFilter ? files.filter(f => f.category === catFilter) : files

  return (
    <div>
      {/* Upload bar */}
      <div className="card" style={{ marginBottom: 16, padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '0 0 auto' }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              {t('files.chooseFile')}
            </label>
            <input
              ref={fileInputRef}
              type="file"
              style={{ fontSize: 13 }}
            />
          </div>
          <div style={{ flex: '0 0 200px' }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              {t('files.category')}
            </label>
            <select
              className="filter-select"
              style={{ width: '100%' }}
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              {FILE_CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? t('files.uploading') : t('files.upload')}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

      {/* Category filter */}
      {files.length > 0 && (
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <select className="filter-select" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="">{t('files.allCategories')}</option>
            {FILE_CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      )}

      <div className="card">
        <div className="table-wrapper">
          {loading
            ? <div className="loading"><div className="spinner" /> {t('common.loading')}</div>
            : displayed.length === 0
              ? <div className="empty-state">
                  <div className="empty-state-icon">📎</div>
                  <div className="empty-state-title">{t('files.noFiles')}</div>
                </div>
              : <table>
                  <thead>
                    <tr>
                      <th>{t('files.category')}</th>
                      <th>File</th>
                      <th>{t('files.size')}</th>
                      <th>{t('files.uploadedAt')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map(f => {
                      const cm = fileCategoryMeta(f.category, t)
                      return (
                        <tr key={f.id}>
                          <td>
                            <span className="badge" style={{ background: cm.bg, color: cm.color }}>
                              {cm.label}
                            </span>
                          </td>
                          <td style={{ fontWeight: 500 }}>{f.filename}</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{formatFileSize(f.sizeBytes)}</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                            {new Date(f.uploadedAt).toLocaleDateString('en-GB', {
                              day: '2-digit', month: 'short', year: 'numeric',
                            })}
                          </td>
                          <td className="td-actions">
                            <button className="btn btn-ghost btn-sm" onClick={() => handleDownload(f)}>
                              {t('files.download')}
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(f)}>
                              {t('common.delete')}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
          }
        </div>
      </div>
    </div>
  )
}
