import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'

const CATEGORY_ROUTES = { EXPORT: '/files/export', IMPORT: '/files/import', LOCAL: '/files/local' }

export default function FileForm() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate  = useNavigate()
  const { t }     = useLanguage()
  const isEdit    = Boolean(id)

  // When coming from /files/export/new, /files/import/new, /files/local/new
  // the URL will include ?category=EXPORT etc.
  const defaultCategory = searchParams.get('category') || 'EXPORT'

  const [form, setForm]       = useState({ category: defaultCategory, clientId: '', notes: '' })
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)

  useEffect(() => {
    api.get('/clients').then(setClients).catch(() => {})
    if (isEdit) {
      api.get(`/files/${id}`)
        .then(f => setForm({ category: f.category, clientId: f.clientId || '', notes: f.notes || '' }))
        .catch(e => setError(e.message))
        .finally(() => setLoading(false))
    }
  }, [id]) // eslint-disable-line

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const payload = { ...form, clientId: form.clientId || null }
      if (isEdit) {
        await api.put(`/files/${id}`, payload)
        navigate(`${CATEGORY_ROUTES[form.category]}/${id}`)
      } else {
        const created = await api.post('/files', payload)
        navigate(`${CATEGORY_ROUTES[form.category]}/${created.id}`)
      }
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  if (loading) return <div className="loading"><div className="spinner" /> {t('common.loading')}</div>

  const back = CATEGORY_ROUTES[form.category] || '/files/export'

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">
            {isEdit ? t('movingFiles.editFile') : t('movingFiles.newFile')}
          </div>
          {!isEdit && (
            <div className="page-subtitle">{t('movingFiles.numberAutoAssigned')}</div>
          )}
        </div>
        <Link to={back} className="btn btn-ghost">{t('movingFiles.backToFiles')}</Link>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card card-body">
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <div className="form-grid">
              {/* Category — read-only on edit */}
              <div className="form-group">
                <label className="form-label">{t('movingFiles.category')}</label>
                {isEdit ? (
                  <div className="form-control" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>
                    {t(`movingFiles.${form.category.toLowerCase()}Title`)}
                  </div>
                ) : (
                  <select className="form-control" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} required>
                    <option value="EXPORT">{t('movingFiles.exportTitle')}</option>
                    <option value="IMPORT">{t('movingFiles.importTitle')}</option>
                    <option value="LOCAL">{t('movingFiles.localTitle')}</option>
                  </select>
                )}
              </div>

              {/* Client */}
              <div className="form-group">
                <label className="form-label">{t('movingFiles.client')}</label>
                <select className="form-control" value={form.clientId} onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))}>
                  <option value="">{t('common.none')}</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.clientType === 'INDIVIDUAL'
                        ? `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.name
                        : c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div className="form-group form-full">
                <label className="form-label">{t('common.notes')}</label>
                <textarea className="form-control" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} />
              </div>
            </div>
          </div>

          <div className="form-actions">
            <Link to={back} className="btn btn-ghost">{t('common.cancel')}</Link>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t('common.saving') : isEdit ? t('common.save') : t('movingFiles.createFile')}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
