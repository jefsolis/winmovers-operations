import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { api } from '../../api'

const EMPTY = { firstName: '', lastName: '', email: '', phone: '', clientId: '' }

export default function ContactForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

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

  if (loading) return <div className="loading"><div className="spinner" /> Loading...</div>

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{isEdit ? 'Edit Contact' : 'New Contact'}</div>
          <div className="page-subtitle">Shipper or point-of-contact record</div>
        </div>
        <Link to="/contacts" className="btn btn-ghost">← Back to Contacts</Link>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card card-body">
        <form onSubmit={handleSubmit}>

          <div className="form-section">
            <div className="form-section-title">Personal Details</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">First Name *</label>
                <input {...field('firstName')} required placeholder="John" />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name *</label>
                <input {...field('lastName')} required placeholder="Smith" />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input {...field('email')} type="email" placeholder="john.smith@email.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input {...field('phone')} placeholder="+1 555 000 0000" />
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">Association</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Corporate Client</label>
                <select className="form-control" value={form.clientId} onChange={e => setForm(prev => ({ ...prev, clientId: e.target.value }))}>
                  <option value="">— Independent / No Client —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <Link to="/contacts" className="btn btn-ghost">Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Contact'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
