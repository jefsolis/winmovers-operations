import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { api } from '../../api'

const EMPTY = { name: '', accountNum: '', email: '', phone: '', address: '', country: '', notes: '' }

export default function ClientForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

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

  if (loading) return <div className="loading"><div className="spinner" /> Loading...</div>

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{isEdit ? 'Edit Client' : 'New Client'}</div>
          <div className="page-subtitle">Corporate account details</div>
        </div>
        <Link to="/clients" className="btn btn-ghost">← Back to Clients</Link>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card card-body">
        <form onSubmit={handleSubmit}>

          <div className="form-section">
            <div className="form-section-title">Company Details</div>
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Company Name *</label>
                <input {...field('name')} required placeholder="e.g. Acme Corporation" />
              </div>
              <div className="form-group">
                <label className="form-label">Account Number</label>
                <input {...field('accountNum')} placeholder="e.g. ACC-0001" />
              </div>
              <div className="form-group">
                <label className="form-label">Country</label>
                <input {...field('country')} placeholder="e.g. United States" />
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">Contact Information</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Email</label>
                <input {...field('email')} type="email" placeholder="info@company.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input {...field('phone')} placeholder="+1 555 000 0000" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Address</label>
                <input {...field('address')} placeholder="Street, City, State, ZIP" />
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">Notes</div>
            <div className="form-group">
              <textarea className="form-control" {...field('notes')} placeholder="Internal notes about this client…" />
            </div>
          </div>

          <div className="form-actions">
            <Link to="/clients" className="btn btn-ghost">Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
