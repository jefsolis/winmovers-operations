import { useEffect, useState } from 'react'
import { api } from '../api'
import { useLanguage } from '../i18n'

/**
 * QuickCreateAgentModal — create a new agent from a lookup context.
 * Props:
 *  open        – boolean
 *  onClose     – () => void
 *  initialName – string  (agent name typed by user)
 *  onCreated   – (newAgent) => void
 */
export default function QuickCreateAgentModal({ open, onClose, initialName = '', onCreated }) {
  const { t } = useLanguage()
  const [form, setForm] = useState({ name: '', country: '', city: '', email: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  useEffect(() => {
    if (open) {
      setForm({ name: initialName, country: '', city: '', email: '', phone: '' })
      setError(null)
    }
  }, [open]) // eslint-disable-line

  if (!open) return null

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.name.trim()) { setError(t('agents.nameRequired')); return }
    setSaving(true); setError(null)
    try {
      const newAgent = await api.post('/agents', {
        name:    form.name.trim(),
        country: form.country || null,
        city:    form.city    || null,
        email:   form.email   || null,
        phone:   form.phone   || null,
      })
      onCreated(newAgent)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="card card-body" style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="page-title" style={{ marginBottom: 16 }}>{t('agents.newAgentTitle')}</div>
        {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('common.name')} *</label>
            <input
              className="form-control"
              required
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder={t('agents.namePlaceholder')}
            />
          </div>
          <div className="form-grid" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">{t('common.country')}</label>
              <input className="form-control" value={form.country} onChange={e => set('country', e.target.value)} placeholder="e.g. France" />
            </div>
            <div className="form-group">
              <label className="form-label">{t('common.city')}</label>
              <input className="form-control" value={form.city} onChange={e => set('city', e.target.value)} placeholder="e.g. Paris" />
            </div>
            <div className="form-group">
              <label className="form-label">{t('common.email')}</label>
              <input className="form-control" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('common.phone')}</label>
              <input className="form-control" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t('common.saving') : t('agents.createAgent')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
