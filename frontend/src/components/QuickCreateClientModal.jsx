import { useEffect, useState } from 'react'
import { api } from '../api'
import { getClientTypes } from '../constants'
import { useLanguage } from '../i18n'

/**
 * Reusable modal to quickly create a client pre-filled with prospect data.
 * Props:
 *  open          – boolean
 *  onClose       – () => void
 *  initialName   – string
 *  initialPhone  – string
 *  initialEmail  – string
 *  onCreated     – (newClient) => void
 */
export default function QuickCreateClientModal({ open, onClose, initialName = '', initialPhone = '', initialEmail = '', onCreated }) {
  const { t } = useLanguage()
  const CLIENT_TYPES = getClientTypes(t)

  const [form, setForm]   = useState({ name: '', clientType: 'CORPORATE', phone: '', email: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  // Reset form with prospect values whenever modal opens
  useEffect(() => {
    if (open) {
      setForm({ name: initialName, clientType: 'CORPORATE', phone: initialPhone, email: initialEmail })
      setError(null)
    }
  }, [open]) // eslint-disable-line

  if (!open) return null

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true); setError(null)
    try {
      const newClient = await api.post('/clients', {
        name:       form.name.trim(),
        clientType: form.clientType,
        email:      form.email  || null,
        phone:      form.phone  || null,
      })
      onCreated(newClient)
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
      <div className="card card-body" style={{ width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="page-title" style={{ marginBottom: 16 }}>{t('visits.quickCreateClient')}</div>
        {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('clients.clientType')}</label>
            <select className="form-control" value={form.clientType} onChange={e => set('clientType', e.target.value)}>
              {CLIENT_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t('clients.companyName')} *</label>
            <input className="form-control" required value={form.name} onChange={e => set('name', e.target.value)} placeholder={t('clients.namePlaceholder')} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('visits.prospectPhone')}</label>
            <input className="form-control" value={form.phone} onChange={e => set('phone', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('visits.prospectEmail')}</label>
            <input className="form-control" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t('common.saving') : t('clients.createClient')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
