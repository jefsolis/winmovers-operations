import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { api } from '../../api'
import { JOB_STATUSES, JOB_TYPES, SHIPMENT_MODES } from '../../constants'

const EMPTY = {
  type: 'INTERNATIONAL', status: 'SURVEY',
  clientId: '', contactId: '',
  originCity: '', originCountry: '', destCity: '', destCountry: '',
  surveyDate: '', packDate: '', moveDate: '', deliveryDate: '',
  volumeCbm: '', weightKg: '', shipmentMode: '', notes: ''
}

function toInputDate(v) {
  if (!v) return ''
  return new Date(v).toISOString().slice(0, 10)
}

export default function JobForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form, setForm] = useState(EMPTY)
  const [clients, setClients] = useState([])
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const tasks = [
      api.get('/clients').then(setClients).catch(() => {}),
      api.get('/contacts').then(setContacts).catch(() => {})
    ]
    if (isEdit) {
      tasks.push(
        api.get(`/jobs/${id}`).then(job => {
          setForm({
            type: job.type, status: job.status,
            clientId: job.clientId || '', contactId: job.contactId || '',
            originCity: job.originCity || '', originCountry: job.originCountry || '',
            destCity: job.destCity || '', destCountry: job.destCountry || '',
            surveyDate: toInputDate(job.surveyDate), packDate: toInputDate(job.packDate),
            moveDate: toInputDate(job.moveDate), deliveryDate: toInputDate(job.deliveryDate),
            volumeCbm: job.volumeCbm ?? '', weightKg: job.weightKg ?? '',
            shipmentMode: job.shipmentMode || '', notes: job.notes || ''
          })
        }).catch(e => setError(e.message)).finally(() => setLoading(false))
      )
    }
    Promise.all(tasks)
  }, [id]) // eslint-disable-line

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))
  const field = (name, type = 'text') => ({
    type,
    className: 'form-control',
    value: form[name],
    onChange: e => set(name, e.target.value)
  })

  const handleSubmit = async e => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const payload = {
        ...form,
        clientId:  form.clientId  || null,
        contactId: form.contactId || null,
        shipmentMode: form.shipmentMode || null,
        volumeCbm: form.volumeCbm === '' ? null : form.volumeCbm,
        weightKg:  form.weightKg  === '' ? null : form.weightKg,
        surveyDate:   form.surveyDate   || null,
        packDate:     form.packDate     || null,
        moveDate:     form.moveDate     || null,
        deliveryDate: form.deliveryDate || null
      }
      if (isEdit) {
        await api.put(`/jobs/${id}`, payload)
      } else {
        await api.post('/jobs', payload)
      }
      navigate('/jobs')
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  if (loading) return <div className="loading"><div className="spinner" /> Loading...</div>

  const jobNumber = isEdit && form._jobNumber ? form._jobNumber : (isEdit ? '…' : 'Auto-assigned')

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{isEdit ? 'Edit Job' : 'New Job'}</div>
          <div className="page-subtitle">{isEdit ? `Job #${id.slice(-6)}` : 'Job number will be auto-assigned'}</div>
        </div>
        <Link to="/jobs" className="btn btn-ghost">← Back to Jobs</Link>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card card-body">
        <form onSubmit={handleSubmit}>

          {/* Basic Info */}
          <div className="form-section">
            <div className="form-section-title">Basic Information</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Type *</label>
                <select className="form-control" value={form.type} onChange={e => set('type', e.target.value)} required>
                  {JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-control" value={form.status} onChange={e => set('status', e.target.value)}>
                  {JOB_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Shipment Mode</label>
                <select className="form-control" value={form.shipmentMode} onChange={e => set('shipmentMode', e.target.value)}>
                  <option value="">— Select —</option>
                  {SHIPMENT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Parties */}
          <div className="form-section">
            <div className="form-section-title">Parties</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Corporate Client</label>
                <select className="form-control" value={form.clientId} onChange={e => set('clientId', e.target.value)}>
                  <option value="">— None —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Shipper (Contact)</label>
                <select className="form-control" value={form.contactId} onChange={e => set('contactId', e.target.value)}>
                  <option value="">— None —</option>
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Route */}
          <div className="form-section">
            <div className="form-section-title">Route</div>
            <div className="form-grid cols-3">
              <div className="form-group">
                <label className="form-label">Origin City</label>
                <input {...field('originCity')} placeholder="e.g. New York" />
              </div>
              <div className="form-group">
                <label className="form-label">Origin Country</label>
                <input {...field('originCountry')} placeholder="e.g. USA" />
              </div>
              <div className="form-group" style={{ visibility: 'hidden' }} />
              <div className="form-group">
                <label className="form-label">Destination City</label>
                <input {...field('destCity')} placeholder="e.g. London" />
              </div>
              <div className="form-group">
                <label className="form-label">Destination Country</label>
                <input {...field('destCountry')} placeholder="e.g. UK" />
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="form-section">
            <div className="form-section-title">Dates</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Survey Date</label>
                <input {...field('surveyDate', 'date')} />
              </div>
              <div className="form-group">
                <label className="form-label">Pack Date</label>
                <input {...field('packDate', 'date')} />
              </div>
              <div className="form-group">
                <label className="form-label">Move / Load Date</label>
                <input {...field('moveDate', 'date')} />
              </div>
              <div className="form-group">
                <label className="form-label">Delivery Date</label>
                <input {...field('deliveryDate', 'date')} />
              </div>
            </div>
          </div>

          {/* Cargo */}
          <div className="form-section">
            <div className="form-section-title">Cargo</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Volume (CBM)</label>
                <input {...field('volumeCbm', 'number')} placeholder="0.00" step="0.01" min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Weight (KG)</label>
                <input {...field('weightKg', 'number')} placeholder="0.00" step="0.01" min="0" />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="form-section">
            <div className="form-section-title">Notes</div>
            <div className="form-group">
              <textarea className="form-control" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any additional notes…" />
            </div>
          </div>

          <div className="form-actions">
            <Link to="/jobs" className="btn btn-ghost">Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Job'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
