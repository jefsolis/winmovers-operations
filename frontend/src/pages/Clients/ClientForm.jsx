import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'

const EMPTY = { name: '', accountNum: '', email: '', phone: '', address: '', country: '', notes: '' }

export default function ClientForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const { t } = useLanguage()

  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isEdit) return
    api.get(`/clients/${id}`)
      .then(c => setForm({
        name: c.name, accountNum: c.accountNum || '',
        email: c.email || '', phone: c.phone || '',
        address: c.address || '', country: c.country || '',
        notes: c.notes || ''
      }))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id]) // eslint-disable-line

  const field = name => ({
    className: 'form-control',
    value: form[name],
    onChange: e => setForm(prev => ({ ...prev, [name]: e.target.value }))
  })

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Company name is required'); return }
    setSaving(true); setError(null)
    try {
      const payload = { ...form, accountNum: form.accountNum || null, email: form.email || null, phone: form.phone || null, address: form.address || null, country: form.country || null, notes: form.notes || null }
      if (isEdit) await api.put(`/clients/${id}`, payload)
      else await api.post('/clients', payload)
      navigate('/clients')
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  if (loading) return <div className="loading"><div className="spinner" /> {t('common.loading')}</div>

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{isEdit ? t('clients.editClient') : t('clients.newClientTitle')}</div>
          <div className="page-subtitle">{t('clients.backSubtitle')}</div>
        </div>
        <Link to="/clients" className="btn btn-ghost">{t('clients.backToClients')}</Link>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card card-body">
        <form onSubmit={handleSubmit}>

          <div className="form-section">
            <div className="form-section-title">{t('clients.companyDetails')}</div>
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">{t('clients.companyName')} *</label>
                <input {...field('name')} required placeholder={t('clients.namePlaceholder')} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('clients.accountNum')}</label>
                <input {...field('accountNum')} placeholder={t('clients.accountNumPlaceholder')} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('common.country')}</label>
                <input {...field('country')} placeholder={t('clients.countryPlaceholder')} />
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">{t('clients.contactInfo')}</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">{t('common.email')}</label>
                <input {...field('email')} type="email" placeholder="info@company.com" />
              </div>
              <div className="form-group">
                <label className="form-label">{t('common.phone')}</label>
                <input {...field('phone')} placeholder="+1 555 000 0000" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">{t('common.address')}</label>
                <input {...field('address')} placeholder={t('clients.addressPlaceholder')} />
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">{t('common.notes')}</div>
            <div className="form-group">
              <textarea className="form-control" {...field('notes')} placeholder={t('clients.notesPlaceholder')} />
            </div>
          </div>

          <div className="form-actions">
            <Link to="/clients" className="btn btn-ghost">{t('common.cancel')}</Link>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t('common.saving') : isEdit ? t('common.save') : t('clients.createClient')}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
