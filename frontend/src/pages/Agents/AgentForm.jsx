import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'

const EMPTY = { name: '', country: '', city: '', email: '', phone: '', notes: '' }

export default function AgentForm() {
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
    api.get(`/agents/${id}`)
      .then(a => setForm({
        name: a.name,
        country: a.country || '', city: a.city || '',
        email: a.email || '', phone: a.phone || '',
        notes: a.notes || ''
      }))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id]) // eslint-disable-line

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))
  const field = name => ({
    className: 'form-control',
    value: form[name],
    onChange: e => set(name, e.target.value)
  })

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Agent name is required'); return }
    setSaving(true); setError(null)
    try {
      const payload = {
        ...form,
        country: form.country || null, city: form.city || null,
        email: form.email || null, phone: form.phone || null, notes: form.notes || null
      }
      if (isEdit) await api.put(`/agents/${id}`, payload)
      else await api.post('/agents', payload)
      navigate('/agents')
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  if (loading) return <div className="loading"><div className="spinner" /> {t('common.loading')}</div>

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{isEdit ? t('agents.editAgent') : t('agents.newAgentTitle')}</div>
          <div className="page-subtitle">{t('agents.backSubtitle')}</div>
        </div>
        <Link to="/agents" className="btn btn-ghost">{t('agents.backToAgents')}</Link>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card card-body">
        <form onSubmit={handleSubmit}>

          <div className="form-section">
            <div className="form-section-title">{t('agents.agentDetails')}</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">{t('common.name')} *</label>
                <input {...field('name')} required placeholder={t('agents.namePlaceholder')} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('common.country')}</label>
                <input {...field('country')} placeholder="e.g. United States" />
              </div>
              <div className="form-group">
                <label className="form-label">City</label>
                <input {...field('city')} placeholder="e.g. Miami" />
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">{t('agents.contactInfo')}</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">{t('common.email')}</label>
                <input {...field('email')} type="email" placeholder="agent@company.com" />
              </div>
              <div className="form-group">
                <label className="form-label">{t('common.phone')}</label>
                <input {...field('phone')} placeholder="+1 555 000 0000" />
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">{t('common.notes')}</div>
            <div className="form-group">
              <textarea className="form-control" {...field('notes')} placeholder="Internal notes…" />
            </div>
          </div>

          <div className="form-actions">
            <Link to="/agents" className="btn btn-ghost">{t('common.cancel')}</Link>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t('common.saving') : isEdit ? t('common.save') : t('agents.createAgent')}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
