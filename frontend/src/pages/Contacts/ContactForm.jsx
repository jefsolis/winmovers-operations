import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'

const EMPTY = { firstName: '', lastName: '', email: '', phone: '', clientId: '' }

export default function ContactForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const { t } = useLanguage()

  const [form, setForm] = useState(EMPTY)
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/clients').then(setClients).catch(() => {})
    if (!isEdit) return
    api.get(`/contacts/${id}`)
      .then(c => setForm({
        firstName: c.firstName, lastName: c.lastName,
        email: c.email || '', phone: c.phone || '',
        clientId: c.clientId || ''
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
    if (!form.firstName.trim() || !form.lastName.trim()) { setError('First and last name are required'); return }
    setSaving(true); setError(null)
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email || null,
        phone: form.phone || null,
        clientId: form.clientId || null
      }
      if (isEdit) await api.put(`/contacts/${id}`, payload)
      else await api.post('/contacts', payload)
      navigate('/contacts')
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  if (loading) return <div className="loading"><div className="spinner" /> {t('common.loading')}</div>

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{isEdit ? t('contacts.editContact') : t('contacts.newContactTitle')}</div>
          <div className="page-subtitle">{t('contacts.backSubtitle')}</div>
        </div>
        <Link to="/contacts" className="btn btn-ghost">{t('contacts.backToContacts')}</Link>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card card-body">
        <form onSubmit={handleSubmit}>

          <div className="form-section">
            <div className="form-section-title">{t('contacts.personalDetails')}</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">{t('contacts.firstName')} *</label>
                <input {...field('firstName')} required placeholder={t('contacts.firstNamePlaceholder')} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('contacts.lastName')} *</label>
                <input {...field('lastName')} required placeholder={t('contacts.lastNamePlaceholder')} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('common.email')}</label>
                <input {...field('email')} type="email" placeholder={t('contacts.emailPlaceholder')} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('common.phone')}</label>
                <input {...field('phone')} placeholder={t('contacts.phonePlaceholder')} />
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">{t('contacts.association')}</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">{t('contacts.corporateClient')}</label>
                <select className="form-control" value={form.clientId} onChange={e => setForm(prev => ({ ...prev, clientId: e.target.value }))}>
                  <option value="">{t('contacts.independentClient')}</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <Link to="/contacts" className="btn btn-ghost">{t('common.cancel')}</Link>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t('common.saving') : isEdit ? t('common.save') : t('contacts.createContact')}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
