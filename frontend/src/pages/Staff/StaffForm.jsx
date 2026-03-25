import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'

const EMPTY = {
  name: '', email: '', phone: '', isActive: true,
  canBeAssignedToVisit: true, canCreateQuotes: false, canBeCreatorInWorkOrder: false, canCoordinateFiles: false,
  role: '',
}

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
      .then(m => setForm({
        name: m.name, email: m.email, phone: m.phone || '', isActive: m.isActive,
        canBeAssignedToVisit:    m.canBeAssignedToVisit,
        canCreateQuotes:         m.canCreateQuotes,
        canBeCreatorInWorkOrder: m.canBeCreatorInWorkOrder,
        canCoordinateFiles:      m.canCoordinateFiles,
        role: m.role || '',
      }))
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
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isEdit ? t('staff.editStaffMember') : t('staff.newStaffMember')}
            {isEdit && !loading && (
              <span className="badge" style={{
                fontSize: 12, fontWeight: 500, verticalAlign: 'middle',
                background: form.isActive ? '#dcfce7' : '#f1f5f9',
                color: form.isActive ? '#16a34a' : '#64748b',
              }}>
                {form.isActive ? t('staff.isActive') : t('staff.inactive')}
              </span>
            )}
          </div>
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
          </div>
        </div>

        <div className="card card-body" style={{ marginBottom: 16 }}>
          <div className="section-label">{t('staff.permissionsSection')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            {[
              ['canBeAssignedToVisit',    t('staff.canBeAssignedToVisit')],
              ['canCreateQuotes',         t('staff.canCreateQuotes')],
              ['canBeCreatorInWorkOrder', t('staff.canBeCreatorInWorkOrder')],
              ['canCoordinateFiles',      t('staff.canCoordinateFiles')],
            ].map(([key, label]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={e => set(key, e.target.checked)}
                />
                {label}
              </label>
            ))}
          </div>
          <div className="form-group" style={{ marginTop: 16, maxWidth: 240 }}>
            <label className="form-label">{t('staff.role')}</label>
            <select className="form-control" value={form.role} onChange={e => set('role', e.target.value)}>
              <option value="">{t('staff.roleNone')}</option>
              <option value="ADMIN">{t('staff.roleAdmin')}</option>
              <option value="STAFF">{t('staff.roleStaff')}</option>
            </select>
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
