import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { api } from '../../api'
import { JOB_STATUSES, JOB_TYPES, SHIPMENT_MODES } from '../../constants'
import { useLanguage } from '../../i18n'

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
  const { t } = useLanguage()

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

  if (loading) return <div className="loading"><div className="spinner" /> {t('common.loading')}</div>

  const jobNumber = isEdit && form._jobNumber ? form._jobNumber : (isEdit ? '…' : 'Auto-assigned')

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{isEdit ? t('jobs.editJob') : t('jobs.newJobTitle')}</div>
          <div className="page-subtitle">{isEdit ? `Job #${id.slice(-6)}` : t('jobs.autoAssigned')}</div>
        </div>
        <Link to="/jobs" className="btn btn-ghost">{t('jobs.backToJobs')}</Link>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card card-body">
        <form onSubmit={handleSubmit}>

          {/* Basic Info */}
          <div className="form-section">
          <div className="form-section-title">{t('jobs.basicInfo')}</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">{t('jobs.jobType')} *</label>
                <select className="form-control" value={form.type} onChange={e => set('type', e.target.value)} required>
                  {JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('jobs.jobStatus')}</label>
                <select className="form-control" value={form.status} onChange={e => set('status', e.target.value)}>
                  {JOB_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('jobs.shipmentMode')}</label>
                <select className="form-control" value={form.shipmentMode} onChange={e => set('shipmentMode', e.target.value)}>
                  <option value="">{t('common.select')}</option>
                  {SHIPMENT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Parties */}
          <div className="form-section">
          <div className="form-section-title">{t('jobs.parties')}</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">{t('jobs.corporateClient')}</label>
                <select className="form-control" value={form.clientId} onChange={e => set('clientId', e.target.value)}>
                  <option value="">{t('common.none')}</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('jobs.shipperContact')}</label>
                <select className="form-control" value={form.contactId} onChange={e => set('contactId', e.target.value)}>
                  <option value="">{t('common.none')}</option>
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Route */}
          <div className="form-section">
          <div className="form-section-title">{t('jobs.route_section')}</div>
            <div className="form-grid cols-3">
              <div className="form-group">
                <label className="form-label">{t('jobs.originCity')}</label>
                <input {...field('originCity')} placeholder={t('jobs.originPlaceholder')} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('jobs.originCountry')}</label>
                <input {...field('originCountry')} placeholder="e.g. USA" />
              </div>
              <div className="form-group" style={{ visibility: 'hidden' }} />
              <div className="form-group">
                <label className="form-label">{t('jobs.destCity')}</label>
                <input {...field('destCity')} placeholder={t('jobs.destPlaceholder')} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('jobs.destCountry')}</label>
                <input {...field('destCountry')} placeholder="e.g. UK" />
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="form-section">
          <div className="form-section-title">{t('jobs.dates')}</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">{t('jobs.surveyDate')}</label>
                <input {...field('surveyDate', 'date')} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('jobs.packDate')}</label>
                <input {...field('packDate', 'date')} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('jobs.moveDate_label')}</label>
                <input {...field('moveDate', 'date')} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('jobs.deliveryDate')}</label>
                <input {...field('deliveryDate', 'date')} />
              </div>
            </div>
          </div>

          {/* Cargo */}
          <div className="form-section">
          <div className="form-section-title">{t('jobs.cargo')}</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">{t('jobs.volumeCbm')}</label>
                <input {...field('volumeCbm', 'number')} placeholder="0.00" step="0.01" min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">{t('jobs.weightKg')}</label>
                <input {...field('weightKg', 'number')} placeholder="0.00" step="0.01" min="0" />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="form-section">
          <div className="form-section-title">{t('common.notes')}</div>
            <div className="form-group">
              <textarea className="form-control" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder={t('common.notes') + '…'} />
            </div>
          </div>

          <div className="form-actions">
            <Link to="/jobs" className="btn btn-ghost">{t('common.cancel')}</Link>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t('common.saving') : isEdit ? t('common.save') : t('jobs.createJob')}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
