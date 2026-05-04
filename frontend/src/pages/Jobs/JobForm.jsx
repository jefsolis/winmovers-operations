import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'
import JobDocument from './JobDocument'
import { useCurrentStaff } from '../../hooks/useCurrentStaff'

const EMPTY = {
  type: 'IMPORT', status: 'SURVEY',
  clientId: '',
  originAddress: '', originCity: '', originCountry: '',
  destAddress: '', destCity: '', destCountry: '',
  notes: '',
  serviceDate: '', serviceTime: '',
  clientPhone: '', clientHomePhone: '',
  companyName: '', companyPhone: '',
  serviceDetails: '', materials: '',
  volumeCbm: '', weightKg: '',
  quoteTo: '', creatorName: '',
  contacto: '', bultos: '', personalCount: '', transbordo: null, coordinatorId: '',
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
  const fromQuoteId  = !isEdit ? searchParams.get('fromQuote') : null
  const fromFileId   = !isEdit ? searchParams.get('fromFile')  : null
  const fromVisitId  = !isEdit ? searchParams.get('fromVisit') : null
  const fromType     = !isEdit ? searchParams.get('type')      : null
  const { t } = useLanguage()

  const [form, setForm] = useState(EMPTY)
  const [language] = useState('ES')
  const [clients, setClients] = useState([])
  const [staffMembers, setStaffMembers] = useState([])
  const [coordinatorStaff, setCoordinatorStaff] = useState([])
  const [linkedQuoteId, setLinkedQuoteId] = useState(null)
  const [linkedVisitId, setLinkedVisitId] = useState(null)
  const [availableQuotes, setAvailableQuotes] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const errorRef = useRef(null)
  const currentStaff = useCurrentStaff()

  // Auto-fill creatorName for new records once staff list + current user are known
  useEffect(() => {
    if (!isEdit && currentStaff?.canBeCreatorInWorkOrder) {
      setForm(prev => prev.creatorName ? prev : { ...prev, creatorName: currentStaff.name })
    }
  }, [currentStaff, isEdit])

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [error])

  useEffect(() => {
    const tasks = [
      api.get('/clients').then(setClients).catch(() => {}),
      api.get('/staff?canBeCreatorInWorkOrder=true').then(setStaffMembers).catch(() => {}),
      api.get('/staff?canCoordinateFiles=true').then(setCoordinatorStaff).catch(() => {}),
    ]
    if (isEdit) {
      tasks.push(
        api.get(`/jobs/${id}`).then(job => {
          setForm({
            type: job.type, status: job.status,
            clientId: job.clientId || '',
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
            volumeCbm: job.volumeCbm ?? '',
            weightKg: job.weightKg ?? '',
            quoteTo: job.quoteTo || '',
            creatorName: job.creatorName || '',
            contacto:      job.contacto      || '',
            bultos:        job.bultos        ?? '',
            personalCount: job.personalCount ?? '',
            transbordo:    job.transbordo    ?? null,
            coordinatorId: job.coordinatorId  || '',
          })
        }).catch(e => setError(e.message)).finally(() => setLoading(false))
      )
    } else if (fromFileId) {
      tasks.push(
        api.get(`/files/${fromFileId}`).then(f => {
          const indName = f.client
            ? (f.client.clientType === 'INDIVIDUAL'
                ? `${f.client.firstName || ''} ${f.client.lastName || ''}`.trim() || f.client.name
                : f.client.name)
            : ''
          const corpName = f.corporateClient?.name || ''
          setForm(prev => ({
            ...prev,
            type:        fromType || 'IMPORT',
            clientId:    f.clientId     || '',
            companyName: corpName       || '',
            clientPhone: f.client?.phone || '',
            quoteTo:     indName || corpName,
            volumeCbm:   f.volumeCbm ?? '',
            weightKg:    f.weightKg  ?? '',
            notes:       f.notes     || '',
            coordinatorId: (fromType === 'IMPORT' || (!fromType && f.category === 'IMPORT')) ? (f.coordinatorId || '') : prev.coordinatorId,
            originAddress: f.originAddress || '',
            originCity:    f.originCity    || '',
            originCountry: f.originCountry || '',
            destAddress:   f.destAddress   || '',
            destCity:      f.destCity      || '',
            destCountry:   f.destCountry   || '',
          }))
        }).catch(() => {})
      )
    } else if (fromQuoteId) {
      tasks.push(
        api.get(`/quotes/${fromQuoteId}`).then(q => {
          const v = q.visit
          if (v?.id) setLinkedVisitId(v.id)
          const autoPhone   = v?.client?.phone || v?.contact?.phone || ''
          const autoQuoteTo = v?.client?.name
            || (v?.client ? `${v.client.firstName || ''} ${v.client.lastName || ''}`.trim() : '')
            || v?.prospectName || ''
          const autoCompany = v?.corporateClient?.name || ''
          let jobType = 'IMPORT'
          if (v?.serviceType === 'LOCAL_MOVE') jobType = 'DOMESTIC'
          else if (['DOOR_TO_PORT', 'DOOR_TO_DOOR'].includes(v?.serviceType)) jobType = 'EXPORT'
          else if (v?.serviceType === 'PORT_TO_DOOR') jobType = 'IMPORT'
          setForm(prev => ({
            ...prev,
            type:          jobType,
            clientId:      v?.clientId      || '',
            companyName:   autoCompany      || prev.companyName,
            originAddress: v?.originAddress || '',
            originCity:    v?.originCity    || '',
            originCountry: v?.originCountry || '',
            destAddress:   v?.destAddress   || '',
            destCity:      v?.destCity      || '',
            destCountry:   v?.destCountry   || '',
            notes:         v?.observations  || '',
            clientPhone:   autoPhone   || prev.clientPhone,
            quoteTo:       autoQuoteTo || prev.quoteTo,
          }))
        }).catch(() => {})
      )
    }
    if (!isEdit && !fromQuoteId && !fromFileId) {
      if (fromVisitId) {
        tasks.push(
          api.get(`/visits/${fromVisitId}`).then(v => {
            const clientName = v.client
              ? (v.client.clientType === 'INDIVIDUAL'
                  ? `${v.client.firstName || ''} ${v.client.lastName || ''}`.trim() || v.client.name
                  : v.client.name)
              : v.prospectName || ''
            setForm(prev => ({
              ...prev,
              type:          'EXPORT',
              clientId:      v.clientId      || '',
              originAddress: v.originAddress || '',
              originCity:    v.originCity    || '',
              originCountry: v.originCountry || '',
              destAddress:   v.destAddress   || '',
              destCity:      v.destCity      || '',
              destCountry:   v.destCountry   || '',
              notes:         v.observations  || '',
              clientPhone:   v.client?.phone || '',
              quoteTo:       clientName,
            }))
          }).catch(() => {})
        )
      } else {
        tasks.push(
          api.get('/quotes').then(qs => {
            setAvailableQuotes(qs.filter(q => q.status === 'ACCEPTED' && !q.job))
          }).catch(() => {})
        )
      }
    }
    Promise.all(tasks)
  }, [id]) // eslint-disable-line

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const handleClientChange = (clientId) => {
    const client = clients.find(c => c.id === clientId)
    const isCorporate = client && client.clientType === 'CORPORATE'
    const autoCompany = isCorporate ? client.name : ''   // don't fill Company for INDIVIDUAL clients
    const autoPhone   = client?.phone || ''
    const autoQuoteTo = client
      ? (client.name || `${client.firstName || ''} ${client.lastName || ''}`.trim() || '')
      : ''
    setForm(prev => ({
      ...prev,
      clientId,
      companyName: autoCompany || (isCorporate ? prev.companyName : ''),
      clientPhone: autoPhone   || prev.clientPhone,
      quoteTo:     autoQuoteTo || prev.quoteTo,
    }))
  }

  const handleQuoteLink = async (quoteId) => {
    setLinkedQuoteId(quoteId || null)
    if (!quoteId) { setForm(EMPTY); return }
    try {
      const q = await api.get(`/quotes/${quoteId}`)
      const v = q.visit
      const autoPhone   = v?.client?.phone || ''
      const autoQuoteTo = v?.client?.name
        || (v?.client ? `${v.client.firstName || ''} ${v.client.lastName || ''}`.trim() : '')
        || v?.prospectName || ''
      setForm(prev => ({
        ...prev,
        clientId: v?.clientId || '',
        originAddress: v?.originAddress || '', originCity: v?.originCity || '', originCountry: v?.originCountry || '',
        destAddress: v?.destAddress || '', destCity: v?.destCity || '', destCountry: v?.destCountry || '',
        notes: v?.observations || '',
        clientPhone: autoPhone   || prev.clientPhone,
        quoteTo:     autoQuoteTo || prev.quoteTo,
      }))
    } catch { /* ignore */ }
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const quoteToLink = fromQuoteId || linkedQuoteId
      const payload = {
        ...form,
        clientId: form.clientId || null,
        quoteId: !isEdit ? (quoteToLink || null) : undefined,
        visitId: (!isEdit && (fromVisitId || linkedVisitId)) ? (fromVisitId || linkedVisitId) : undefined,
        movingFileId: (!isEdit && fromFileId) ? fromFileId : undefined,
        language,
      }
      if (isEdit) {
        await api.put(`/jobs/${id}`, payload)
        navigate(`/jobs/${id}`)
      } else {
        const created = await api.post('/jobs', payload)
        navigate(`/jobs/${created.id}`)
      }
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

          {!isEdit && !fromQuoteId && !fromFileId && (
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
            <div className="form-section-title">{t('jobs.workOrderDetails')}</div>
            <JobDocument
              editMode

              form={form}
              onFormChange={set}
              clients={clients}
              onClientChange={handleClientChange}
              resolvedJobNumber={resolvedJobNumber}
              resolvedCreatedDate={resolvedCreatedDate}
              staffMembers={staffMembers}
              coordinatorStaff={coordinatorStaff}
            />
          </div>

          <div className="form-section">
            <div className="form-section-title">{t('common.notes')}</div>
            <div className="form-group">
              <textarea className="form-control" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder={t('common.notes') + '...'} />
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
