import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom'
import { api } from '../../api'
import { getJobStatuses, getJobTypes, getShipmentModes, REQUIRED_FILE_CATEGORIES, getFileCategories } from '../../constants'
import { useLanguage } from '../../i18n'
import JobDocument from './JobDocument'

const EMPTY = {
  type: 'INTERNATIONAL', status: 'SURVEY', shipmentMode: '',
  clientId: '', contactId: '',
  originAddress: '', originCity: '', originCountry: '',
  destAddress: '', destCity: '', destCountry: '',
  notes: '',
  serviceDate: '', serviceTime: '',
  clientPhone: '', clientHomePhone: '',
  companyName: '', companyPhone: '',
  serviceDetails: '', materials: '',
  quoteTo: '', creatorName: '',
}

function toInputDate(v) {
  if (!v) return ''
  return new Date(v).toISOString().slice(0, 10)
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

  const [form, setForm] = useState(EMPTY)
  const [language, setLanguage] = useState('EN')
  const [clients, setClients] = useState([])
  const [contacts, setContacts] = useState([])
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
    ]
    if (isEdit) {
      tasks.push(
        api.get(`/jobs/${id}`).then(job => {
          setForm({
            type: job.type, status: job.status, shipmentMode: job.shipmentMode || '',
            clientId: job.clientId || '', contactId: job.contactId || '',
            originAddress: job.originAddress || '', originCity: job.originCity || '', originCountry: job.originCountry || '',
            destAddress: job.destAddress || '', destCity: job.destCity || '', destCountry: job.destCountry || '',
            notes: job.notes || '',
            jobNumber: job.jobNumber || '',
            serviceDate: toInputDate(job.serviceDate),
            serviceTime: job.serviceTime || '',
            clientPhone: job.clientPhone || '',
            clientHomePhone: job.clientHomePhone || '',
            companyName: job.companyName || '',
            companyPhone: job.companyPhone || '',
            serviceDetails: job.serviceDetails || '',
            materials: job.materials || '',
            quoteTo: job.quoteTo || '',
            creatorName: job.creatorName || '',
          })
          setLanguage(job.language || 'EN')
        }).catch(e => setError(e.message)).finally(() => setLoading(false))
      )
    } else if (fromQuoteId) {
      tasks.push(
        api.get(`/quotes/${fromQuoteId}`).then(q => {
          const v = q.visit
          setForm(prev => ({
            ...prev,
            clientId:      v?.clientId      || '',
            contactId:     v?.contactId     || '',
            originAddress: v?.originAddress || '',
            originCity:    v?.originCity    || '',
            originCountry: v?.originCountry || '',
            destAddress:   v?.destAddress   || '',
            destCity:      v?.destCity      || '',
            destCountry:   v?.destCountry   || '',
            notes:         v?.observations  || '',
          }))
          setLanguage(q.language || 'EN')
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
    const client = clients.find(c => c.id === clientId)
    const autoCompany = client
      ? (client.clientType === 'CORPORATE' || client.clientType === 'BROKER'
          ? client.name
          : `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.name)
      : ''
    setForm(prev => ({ ...prev, clientId, contactId: '', companyName: autoCompany || prev.companyName }))
  }

  const handleContactChange = (contactId) => {
    const contact = contacts.find(c => c.id === contactId)
    setForm(prev => ({ ...prev, contactId, clientPhone: contact?.phone || prev.clientPhone }))
  }

  const handleQuoteLink = async (quoteId) => {
    setLinkedQuoteId(quoteId || null)
    if (!quoteId) { setForm(EMPTY); return }
    try {
      const q = await api.get(`/quotes/${quoteId}`)
      const v = q.visit
      setForm(prev => ({
        ...prev,
        clientId: v?.clientId || '', contactId: v?.contactId || '',
        originAddress: v?.originAddress || '', originCity: v?.originCity || '', originCountry: v?.originCountry || '',
        destAddress: v?.destAddress || '', destCity: v?.destCity || '', destCountry: v?.destCountry || '',
        notes: v?.observations || '',
      }))
    } catch { /* ignore */ }
  }

  const filteredContacts = form.clientId
    ? contacts.filter(c => c.clientId === form.clientId)
    : contacts

  const handleSubmit = async e => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      if (isEdit && form.status === 'CLOSED') {
        const files = await api.get(`/jobs/${id}/files`)
        const attached = new Set(files.map(f => f.category))
        const FILE_CATS = getFileCategories(t)
        const missing = REQUIRED_FILE_CATEGORIES.filter(c => !attached.has(c))
        if (missing.length > 0) {
          const labels = missing.map(c => FILE_CATS.find(x => x.value === c)?.label || c)
          setError(`${t('files.closedBlocked')}\n- ${labels.join('\n- ')}`)
          setSaving(false); return
        }
      }
      const quoteToLink = fromQuoteId || linkedQuoteId
      const payload = {
        ...form,
        clientId: form.clientId || null,
        contactId: form.contactId || null,
        shipmentMode: form.shipmentMode || null,
        quoteId: !isEdit ? (quoteToLink || null) : undefined,
        language,
      }
      if (isEdit) { await api.put(`/jobs/${id}`, payload) }
      else        { await api.post('/jobs', payload) }
      navigate('/jobs')
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  if (loading) return <div className="loading"><div className="spinner" /> {t('common.loading')}</div>

  const resolvedJobNumber   = isEdit ? (form.jobNumber || '...') : t('jobs.autoAssigned')
  const resolvedCreatedDate = new Date().toLocaleDateString('en-GB')

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{isEdit ? t('jobs.editJob') : t('jobs.newJobTitle')}</div>
          <div className="page-subtitle">{isEdit ? (form.jobNumber || '...') : t('jobs.autoAssigned')}</div>
        </div>
        <Link to="/jobs" className="btn btn-ghost">{t('jobs.backToJobs')}</Link>
      </div>

      {error && <div ref={errorRef} className="alert alert-error" style={{ marginBottom: 16, whiteSpace: 'pre-line' }}>{error}</div>}

      <div className="card card-body">
        <form onSubmit={handleSubmit}>

          {!isEdit && !fromQuoteId && (
            <div className="form-section">
              <div className="form-section-title">{t('jobs.linkToQuote')}</div>
              <div className="form-group">
                <label className="form-label">{t('jobs.selectQuote')}</label>
                <select className="form-control" value={linkedQuoteId || ''} onChange={e => handleQuoteLink(e.target.value)}>
                  <option value="">{t('jobs.noLinkedQuote')}</option>
                  {availableQuotes.map(q => {
                    const cn = q.visit?.client?.name || q.visit?.prospectName || ''
                    return <option key={q.id} value={q.id}>{q.quoteNumber}{cn ? ` - ${cn}` : ''}</option>
                  })}
                </select>
                {availableQuotes.length === 0 && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>{t('jobs.noAcceptedQuotes')}</div>}
                {linkedQuoteId && <div style={{ marginTop: 6, fontSize: 13, color: 'var(--success, #16a34a)' }}>✓ {t('jobs.quotePreFilled')}</div>}
              </div>
            </div>
          )}

          <div className="form-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div className="form-section-title" style={{ marginBottom: 0 }}>{t('jobs.workOrderDetails')}</div>
              <div className="lang-toggle">
                <button type="button" className={`lang-toggle-btn${language === 'EN' ? ' active' : ''}`} onClick={() => setLanguage('EN')}>EN</button>
                <button type="button" className={`lang-toggle-btn${language === 'ES' ? ' active' : ''}`} onClick={() => setLanguage('ES')}>ES</button>
              </div>
            </div>
            <JobDocument
              editMode
              language={language}
              form={form}
              onFormChange={set}
              clients={clients}
              filteredContacts={filteredContacts}
              onClientChange={handleClientChange}
              onContactChange={handleContactChange}
              resolvedJobNumber={resolvedJobNumber}
              resolvedCreatedDate={resolvedCreatedDate}
            />
          </div>

          <div className="form-section">
            <div className="form-section-title">{t('common.notes')}</div>
            <div className="form-group">
              <textarea className="form-control" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder={t('common.notes') + '...'} />
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title" style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('jobs.basicInfo')}</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">{t('jobs.jobType')}</label>
                <select className="form-control" value={form.type} onChange={e => set('type', e.target.value)} required>
                  {JOB_TYPES.map(jt => <option key={jt.value} value={jt.value}>{jt.label}</option>)}
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

          {error && <div className="alert alert-error" style={{ marginBottom: 12, whiteSpace: 'pre-line', fontSize: 13 }}>{error}</div>}
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
