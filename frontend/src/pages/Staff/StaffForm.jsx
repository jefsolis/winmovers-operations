import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'

const EMPTY = { name: '', email: '', phone: '', isActive: true }

export default function StaffForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const { t } = useLanguage()

  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const errorRef = useRef(null)

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [error])

  useEffect(() => {
    if (!isEdit) return
    api.get(`/staff/${id}`)
      .then(m => setForm({ name: m.name, email: m.email, phone: m.phone || '', isActive: m.isActive }))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id]) // eslint-disable-line

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const field = (name, type = 'text') => ({
    type,
    className: 'form-control',
    value: form[name],
    onChange: e => set(name, e.target.value),
  })

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.name.trim()) { setError(t('staff.name') + ' is required.'); return }
    if (!form.email.trim()) { setError(t('staff.email') + ' is required.'); return }
    setSaving(true); setError(null)
    try {
      if (isEdit) {
        await api.put(`/staff/${id}`, form)
        navigate('/staff')
      } else {
        await api.post('/staff', form)
        navigate('/staff')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading"><div className="spinner" /> {t('common.loading')}</div>

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{isEdit ? t('staff.editStaffMember') : t('staff.newStaffMember')}</div>
          <div className="page-subtitle">{t('staff.subtitle')}</div>
        </div>
        <Link to="/staff" className="btn btn-secondary">{t('common.cancel')}</Link>
      </div>

      {error && (
        <div ref={errorRef} className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card card-body" style={{ marginBottom: 16 }}>
          <div className="section-label">{t('staff.title')}</div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">{t('staff.name')} <span style={{ color: '#ef4444' }}>*</span></label>
              <input {...field('name')} placeholder={t('staff.namePlaceholder')} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('staff.email')} <span style={{ color: '#ef4444' }}>*</span></label>
              <input {...field('email', 'email')} placeholder={t('staff.emailPlaceholder')} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('staff.phone')}</label>
              <input {...field('phone', 'tel')} placeholder={t('staff.phonePlaceholder')} />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 24 }}>
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive}
                onChange={e => set('isActive', e.target.checked)}
              />
              <label htmlFor="isActive" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>
                {t('staff.isActive')}
              </label>
            </div>
          </div>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? t('common.saving') : isEdit ? t('staff.saveStaffMember') : t('staff.createStaffMember')}
          </button>
          <Link to="/staff" className="btn btn-secondary">{t('common.cancel')}</Link>
        </div>
      </form>
    </>
  )
}
