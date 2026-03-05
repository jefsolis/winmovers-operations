import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { api } from '../../api'
import { getVisitStatuses, getServiceTypes } from '../../constants'
import { useLanguage } from '../../i18n'

const EMPTY = {
  status: 'SCHEDULED',
  prospectName: '', prospectPhone: '', prospectEmail: '',
  clientId: '', contactId: '', assignedToId: '',
  serviceType: '',
  language: 'EN',
  scheduledDate: '',
  originAddress: '', originCity: '', originCountry: '',
  destAddress: '',   destCity: '',   destCountry: '',
  observations: '',
}

export default function VisitForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const { t } = useLanguage()
  const VISIT_STATUSES  = getVisitStatuses(t)
  const SERVICE_TYPES   = getServiceTypes(t)

  const [form, setForm]       = useState(EMPTY)
  const [clients, setClients] = useState([])
  const [contacts, setContacts] = useState([])
  const [staffMembers, setStaffMembers] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)
  const errorRef = useRef(null)

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [error])

  useEffect(() => {
    const tasks = [
      api.get('/clients').then(setClients).catch(() => {}),
      api.get('/contacts').then(setContacts).catch(() => {}),
      api.get('/staff').then(setStaffMembers).catch(() => {}),
    ]
    if (isEdit) {
      tasks.push(
        api.get(`/visits/${id}`).then(v => {
          setForm({
            status:        v.status,
            prospectName:  v.prospectName  || '',
            prospectPhone: v.prospectPhone || '',
            prospectEmail: v.prospectEmail || '',
            clientId:      v.clientId      || '',
            contactId:     v.contactId     || '',
            assignedToId:  v.assignedToId  || '',
            serviceType:   v.serviceType   || '',
            language:      v.language      || 'EN',
            scheduledDate: v.scheduledDate ? new Date(v.scheduledDate).toISOString().slice(0, 16) : '',
            originAddress: v.originAddress || '',
            originCity:    v.originCity    || '',
            originCountry: v.originCountry || '',
            destAddress:   v.destAddress   || '',
            destCity:      v.destCity      || '',
            destCountry:   v.destCountry   || '',
            observations:  v.observations  || '',
          })
        }).catch(e => setError(e.message)).finally(() => setLoading(false))
      )
    }
    Promise.all(tasks)
  }, [id]) // eslint-disable-line

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const filteredContacts = form.clientId
    ? contacts.filter(c => c.clientId === form.clientId)
    : contacts

  const field = (name, type = 'text') => ({
    type,
    className: 'form-control',
    value: form[name],
    onChange: e => set(name, e.target.value),
  })

  const handleSubmit = async e => {
    e.preventDefault()
    const errs = []
    if (!form.serviceType)                         errs.push(t('visits.validation.serviceType'))
    if (!form.scheduledDate)                       errs.push(t('visits.validation.scheduledDate'))
    if (!form.clientId && !form.prospectName?.trim()) errs.push(t('visits.validation.nameOrClient'))
    if (errs.length) { setError(errs.join('\n')); return }
    setSaving(true); setError(null)
    try {
      const payload = {
        ...form,
        clientId:      form.clientId      || null,
        contactId:     form.contactId     || null,
        assignedToId:  form.assignedToId  || null,
        scheduledDate: form.scheduledDate ? new Date(form.scheduledDate).toISOString() : null,
      }
      if (isEdit) {
        await api.put(`/visits/${id}`, payload)
        navigate(`/visits/${id}`)
      } else {
        const created = await api.post('/visits', payload)
        navigate(`/visits/${created.id}`)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading"><div className="spinner" /> {t('common.loading')}</div>

  const Req = () => <span style={{ color: '#ef4444', marginLeft: 2 }} title="Required">*</span>

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{isEdit ? t('visits.editVisit') : t('visits.newVisitTitle')}</div>
          <div className="page-subtitle">{isEdit ? form.visitNumber || t('visits.backSubtitle') : t('visits.autoAssigned')}</div>
        </div>
        <Link to={isEdit ? `/visits/${id}` : '/visits'} className="btn btn-secondary">{t('common.cancel')}</Link>
      </div>

      {error && <div ref={errorRef} className="alert alert-error" style={{ marginBottom: 16, whiteSpace: 'pre-line' }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        {/* Prospect / Client Info */}
        <div className="card card-body" style={{ marginBottom: 16 }}>
          <div className="section-label">{t('visits.prospectInfo')}</div>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-muted)' }}>{t('visits.requiredLegend')}</p>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">{t('visits.prospectName')}</label>
              <input {...field('prospectName')} placeholder="e.g. María García" />
            </div>
            <div className="form-group">
              <label className="form-label">{t('visits.prospectPhone')}</label>
              <input {...field('prospectPhone')} placeholder="+57 300 000 0000" />
            </div>
            <div className="form-group">
              <label className="form-label">{t('visits.prospectEmail')}</label>
              <input {...field('prospectEmail')} type="email" />
            </div>
            <div className="form-group">
              <label className="form-label">{t('visits.linkedClient')}</label>
              <select className="form-control" value={form.clientId} onChange={e => {
                const selectedId = e.target.value
                const client = clients.find(c => c.id === selectedId)
                setForm(prev => ({
                  ...prev,
                  clientId: selectedId,
                  contactId: '',
                  ...(client ? {
                    prospectName:  client.name || [client.firstName, client.lastName].filter(Boolean).join(' ') || prev.prospectName,
                    prospectPhone: client.phone || prev.prospectPhone,
                    prospectEmail: client.email || prev.prospectEmail,
                  } : {}),
                }))
              }}>
                <option value="">{t('common.none')}</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name || `${c.firstName} ${c.lastName}`}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('visits.linkedContact')}</label>
              <select className="form-control" value={form.contactId} onChange={e => set('contactId', e.target.value)}>
                <option value="">{t('common.none')}</option>
                {filteredContacts.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Visit Info */}
        <div className="card card-body" style={{ marginBottom: 16 }}>
          <div className="section-label">{t('visits.visitNumber')}</div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">{t('visits.scheduledDate')}<Req /></label>
              <input {...field('scheduledDate', 'datetime-local')} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('visits.serviceType')}<Req /></label>
              <select className="form-control" value={form.serviceType} onChange={e => set('serviceType', e.target.value)}>
                <option value="">{t('common.select')}</option>
                {SERVICE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('visits.clientLanguage')}</label>
              <select className="form-control" value={form.language} onChange={e => set('language', e.target.value)}>
                <option value="EN">English</option>
                <option value="ES">Español</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('visits.assignedTo')}</label>
              <select className="form-control" value={form.assignedToId} onChange={e => set('assignedToId', e.target.value)}>
                <option value="">{t('visits.unassigned')}</option>
                {staffMembers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {isEdit && (
              <div className="form-group">
                <label className="form-label">{t('jobs.status')}</label>
                <select className="form-control" value={form.status} onChange={e => set('status', e.target.value)}>
                  {VISIT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Origin */}
        <div className="card card-body" style={{ marginBottom: 16 }}>
          <div className="section-label">{t('visits.originInfo')}</div>
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">{t('visits.originAddress')}</label>
              <input {...field('originAddress')} placeholder="e.g. Av. El Dorado # 83-15" />
            </div>
            <div className="form-group">
              <label className="form-label">{t('jobs.originCity')}</label>
              <input {...field('originCity')} placeholder={t('jobs.originPlaceholder')} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('jobs.originCountry')}</label>
              <input {...field('originCountry')} placeholder="e.g. Colombia" />
            </div>
          </div>
        </div>

        {/* Destination */}
        <div className="card card-body" style={{ marginBottom: 16 }}>
          <div className="section-label">{t('visits.destInfo')}</div>
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">{t('visits.destAddress')}</label>
              <input {...field('destAddress')} placeholder="e.g. 42 Rue de la Paix" />
            </div>
            <div className="form-group">
              <label className="form-label">{t('jobs.destCity')}</label>
              <input {...field('destCity')} placeholder={t('jobs.destPlaceholder')} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('jobs.destCountry')}</label>
              <input {...field('destCountry')} placeholder="e.g. France" />
            </div>
          </div>
        </div>

        {/* Observations */}
        <div className="card card-body" style={{ marginBottom: 16 }}>
          <div className="section-label">{t('visits.observations')}</div>
          <div className="form-group">
            <textarea
              className="form-control"
              rows={4}
              value={form.observations}
              onChange={e => set('observations', e.target.value)}
              placeholder={t('visits.observationsPlaceholder')}
            />
          </div>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16, whiteSpace: 'pre-line' }}>{error}</div>}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? t('common.saving') : isEdit ? t('common.save') : t('visits.createVisit')}
          </button>
          <Link to={isEdit ? `/visits/${id}` : '/visits'} className="btn btn-secondary">{t('common.cancel')}</Link>
        </div>
      </form>
    </>
  )
}
