import { useEffect, useState } from 'react'
import { api } from '../api'
import { useLanguage } from '../i18n'

/**
 * QuickCreateCorporateClientModal — create a new CORPORATE client from a lookup context.
 * Props:
 *  open        – boolean
 *  onClose     – () => void
 *  initialName – string  (company name typed by user)
 *  onCreated   – (newClient) => void
 */
export default function QuickCreateCorporateClientModal({ open, onClose, initialName = '', onCreated }) {
  const { t } = useLanguage()
  const [form, setForm] = useState({ name: '', country: '', email: '', phone: '', address: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  useEffect(() => {
    if (open) {
      setForm({ name: initialName, country: '', email: '', phone: '', address: '' })
      setError(null)
    }
  }, [open]) // eslint-disable-line

  if (!open) return null

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.name.trim()) { setError(t('clients.nameRequired')); return }
    setSaving(true); setError(null)
    try {
      const newClient = await api.post('/clients', {
        clientType: 'CORPORATE',
        name:    form.name.trim(),
        country: form.country || null,
        email:   form.email   || null,
        phone:   form.phone   || null,
        address: form.address || null,
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
      <div className="card card-body" style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="page-title" style={{ marginBottom: 16 }}>{t('clients.quickCreateCorporateTitle')}</div>
        {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('clients.companyName')} *</label>
            <input
              className="form-control"
              required
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder={t('clients.namePlaceholder')}
            />
          </div>
          <div className="form-grid" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">{t('common.country')}</label>
              <input className="form-control" value={form.country} onChange={e => set('country', e.target.value)} placeholder={t('clients.countryPlaceholder')} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('common.email')}</label>
              <input className="form-control" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('common.phone')}</label>
              <input className="form-control" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div className="form-group form-full">
              <label className="form-label">{t('common.address')}</label>
              <input className="form-control" value={form.address} onChange={e => set('address', e.target.value)} placeholder={t('clients.addressPlaceholder')} />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t('common.saving') : t('clients.createCorporate')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
