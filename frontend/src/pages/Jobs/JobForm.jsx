import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom'
import { api } from '../../api'
import { getJobStatuses, getJobTypes, getShipmentModes, getClientTypes, REQUIRED_FILE_CATEGORIES, getFileCategories } from '../../constants'
import { useLanguage } from '../../i18n'

const EMPTY = {
  type: 'INTERNATIONAL', status: 'SURVEY',
  clientId: '', contactId: '',
  originAgentId: '', destAgentId: '', customsAgentId: '',
  originCity: '', originCountry: '', destCity: '', destCountry: '',
  callDate: '', surveyDate: '', packDate: '', moveDate: '', deliveryDate: '',
  volumeCbm: '', weightKg: '', shipmentMode: '', notes: ''
}

function toInputDate(v) {
  if (!v) return ''
  return new Date(v).toISOString().slice(0, 10)
}

function toInputDateTime(v) {
  if (!v) return ''
  return new Date(v).toISOString().slice(0, 16)
}

export default function JobForm() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const fromQuoteId = !isEdit ? searchParams.get('fromQuote') : null
  const { t } = useLanguage()
  const JOB_STATUSES = getJobStatuses(t)
  const JOB_TYPES = getJobTypes(t)
  const SHIPMENT_MODES = getShipmentModes(t)
  const CLIENT_TYPES = getClientTypes(t)

  const [form, setForm] = useState(EMPTY)
  const [clients, setClients] = useState([])
  const [contacts, setContacts] = useState([])
  const [agents, setAgents] = useState([])
  const [linkedQuoteId, setLinkedQuoteId] = useState(null)
  const [availableQuotes, setAvailableQuotes] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const errorRef = useRef(null)

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [error])

  useEffect(() => {
    const tasks = [
      api.get('/clients').then(setClients).catch(() => {}),
      api.get('/contacts').then(setContacts).catch(() => {}),
      api.get('/agents').then(setAgents).catch(() => {})
    ]
    if (isEdit) {
      tasks.push(
        api.get(`/jobs/${id}`).then(job => {
          setForm({
            type: job.type, status: job.status,
            clientId: job.clientId || '', contactId: job.contactId || '',
            originAgentId: job.originAgentId || '', destAgentId: job.destAgentId || '', customsAgentId: job.customsAgentId || '',
            originCity: job.originCity || '', originCountry: job.originCountry || '',
            destCity: job.destCity || '', destCountry: job.destCountry || '',
            callDate: toInputDate(job.callDate),
            surveyDate: toInputDateTime(job.surveyDate), packDate: toInputDate(job.packDate),
            moveDate: toInputDate(job.moveDate), deliveryDate: toInputDate(job.deliveryDate),
            volumeCbm: job.volumeCbm ?? '', weightKg: job.weightKg ?? '',
            shipmentMode: job.shipmentMode || '', notes: job.notes || '',
            jobNumber: job.jobNumber || ''
          })
        }).catch(e => setError(e.message)).finally(() => setLoading(false))
      )
    } else if (fromQuoteId) {
      // Pre-fill from an accepted quote
      tasks.push(
        api.get(`/quotes/${fromQuoteId}`).then(q => {
          const v = q.visit
          setForm(prev => ({
            ...prev,
            clientId:     v?.clientId  || '',
            contactId:    v?.contactId || '',
            originCity:   v?.originCity    || '',
            originCountry: v?.originCountry || '',
            destCity:     v?.destCity    || '',
            destCountry:  v?.destCountry  || '',
            notes:        v?.observations  || '',
          }))
        }).catch(() => {})
      )
    }
    if (!isEdit && !fromQuoteId) {
      tasks.push(
        api.get('/quotes').then(qs => {
          setAvailableQuotes(qs.filter(q => q.status === 'ACCEPTED' && !q.job))
        }).catch(() => {})
      )
    }
    Promise.all(tasks)
  }, [id]) // eslint-disable-line

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const handleClientChange = (clientId) => {
    setForm(prev => ({ ...prev, clientId, contactId: '' }))
  }

  const handleQuoteLink = async (quoteId) => {
    setLinkedQuoteId(quoteId || null)
    if (!quoteId) { setForm(EMPTY); return }
    try {
      const q = await api.get(`/quotes/${quoteId}`)
      const v = q.visit
      setForm(prev => ({
        ...prev,
        clientId:      v?.clientId      || '',
        contactId:     v?.contactId     || '',
        originCity:    v?.originCity    || '',
        originCountry: v?.originCountry || '',
        destCity:      v?.destCity      || '',
        destCountry:   v?.destCountry   || '',
        notes:         v?.observations  || '',
      }))
    } catch { /* ignore */ }
  }

  const filteredContacts = form.clientId
    ? contacts.filter(c => c.clientId === form.clientId)
    : contacts
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
      // Pre-check: if setting status to CLOSED, verify all required files are attached
      if (isEdit && form.status === 'CLOSED') {
        const files = await api.get(`/jobs/${id}/files`)
        const attached = new Set(files.map(f => f.category))
        const FILE_CATS = getFileCategories(t)
        const missing = REQUIRED_FILE_CATEGORIES.filter(c => !attached.has(c))
        if (missing.length > 0) {
          const labels = missing.map(c => FILE_CATS.find(x => x.value === c)?.label || c)
          setError(`${t('files.closedBlocked')}\n• ${labels.join('\n• ')}`)
          setSaving(false)
          return
        }
      }
      const payload = {
        ...form,
        clientId:  form.clientId  || null,
        contactId: form.contactId || null,
        originAgentId: form.originAgentId || null,
        destAgentId: form.destAgentId || null,
        customsAgentId: form.customsAgentId || null,
        shipmentMode: form.shipmentMode || null,
        volumeCbm: form.volumeCbm === '' ? null : form.volumeCbm,
        weightKg:  form.weightKg  === '' ? null : form.weightKg,
        callDate:     form.callDate     || null,
        surveyDate:   form.surveyDate   || null,
        packDate:     form.packDate     || null,
        moveDate:     form.moveDate     || null,
        deliveryDate: form.deliveryDate || null
      }
      if (isEdit) {
        await api.put(`/jobs/${id}`, payload)
      } else {
        const created = await api.post('/jobs', payload)
        // Link the originating quote to this job
        const quoteToLink = fromQuoteId || linkedQuoteId
        if (quoteToLink) await api.put(`/quotes/${quoteToLink}`, { jobId: created.id })
      }
      navigate('/jobs')
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  if (loading) return <div className="loading"><div className="spinner" /> {t('common.loading')}</div>

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{isEdit ? t('jobs.editJob') : t('jobs.newJobTitle')}</div>
          <div className="page-subtitle">{isEdit ? (form.jobNumber || '…') : t('jobs.autoAssigned')}</div>
        </div>
        <Link to="/jobs" className="btn btn-ghost">{t('jobs.backToJobs')}</Link>
      </div>

      {error && <div ref={errorRef} className="alert alert-error" style={{ marginBottom: 16, whiteSpace: 'pre-line' }}>{error}</div>}

      <div className="card card-body">
        <form onSubmit={handleSubmit}>

          {/* Link to Quote — only on new jobs not already coming from a quote */}
          {!isEdit && !fromQuoteId && (
            <div className="form-section">
              <div className="form-section-title">{t('jobs.linkToQuote')}</div>
              <div className="form-grid">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">{t('jobs.selectQuote')}</label>
                  <select className="form-control" value={linkedQuoteId || ''} onChange={e => handleQuoteLink(e.target.value)}>
                    <option value="">{t('jobs.noLinkedQuote')}</option>
                    {availableQuotes.map(q => {
                      const clientName = q.visit?.client?.name || q.visit?.prospectName || ''
                      return (
                        <option key={q.id} value={q.id}>
                          {q.quoteNumber}{clientName ? ` — ${clientName}` : ''}
                        </option>
                      )
                    })}
                  </select>
                  {availableQuotes.length === 0 && (
                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>{t('jobs.noAcceptedQuotes')}</div>
                  )}
                  {linkedQuoteId && (
                    <div style={{ marginTop: 6, fontSize: 13, color: 'var(--success, #16a34a)' }}>✓ {t('jobs.quotePreFilled')}</div>
                  )}
                </div>
              </div>
            </div>
          )}

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
                <select className="form-control" value={form.clientId} onChange={e => handleClientChange(e.target.value)}>
                  <option value="">{t('common.none')}</option>
                  {clients.map(c => {
                    const typeLabel = CLIENT_TYPES.find(ct => ct.value === c.clientType)?.label || c.clientType
                    return <option key={c.id} value={c.id}>{c.name} ({typeLabel})</option>
                  })}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('jobs.shipperContact')}</label>
                <select className="form-control" value={form.contactId} onChange={e => set('contactId', e.target.value)}
                  disabled={!form.clientId}>
                  <option value="">{form.clientId ? t('common.none') : t('jobs.selectClientFirst')}</option>
                  {filteredContacts.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('jobs.originAgent')}</label>
                <select className="form-control" value={form.originAgentId} onChange={e => set('originAgentId', e.target.value)}>
                  <option value="">{t('common.none')}</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name} {a.city ? `(${a.city})` : ''}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('jobs.destAgent')}</label>
                <select className="form-control" value={form.destAgentId} onChange={e => set('destAgentId', e.target.value)}>
                  <option value="">{t('common.none')}</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name} {a.city ? `(${a.city})` : ''}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('jobs.customsAgent')}</label>
                <select className="form-control" value={form.customsAgentId} onChange={e => set('customsAgentId', e.target.value)}>
                  <option value="">{t('common.none')}</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name} {a.city ? `(${a.city})` : ''}</option>)}
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
                <label className="form-label">{t('jobs.callDate')}</label>
                <input {...field('callDate', 'date')} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('jobs.surveyDate')}</label>
                <input {...field('surveyDate', 'datetime-local')} />
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

          {error && (
            <div className="alert alert-error" style={{ marginBottom: 12, whiteSpace: 'pre-line', fontSize: 13 }}>
              {error}
            </div>
          )}
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
