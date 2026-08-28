import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams, useLocation, Link } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'
import JobDocument from './JobDocument'
import { useCurrentStaff } from '../../hooks/useCurrentStaff'
import QuickCreateClientModal from '../../components/QuickCreateClientModal'
import QuickCreateCorporateClientModal from '../../components/QuickCreateCorporateClientModal'
import AgentLookup from '../../components/AgentLookup'
import LocationPicker from '../../components/LocationPicker'

const EMPTY = {
  type: 'IMPORT', status: 'SURVEY',
  clientId: '',
  corporateClientId: '',
  originAddress: '', originWarehouse: '', originCity: '', originCountry: '',
  destAddress: '', destCity: '', destCountry: '',
  serviceLatitude: null, serviceLongitude: null,
  notes: '',
  serviceDate: '', serviceTime: '',
  clientPhone: '', clientHomePhone: '',
  companyName: '', companyPhone: '',
  serviceDetails: '', materials: '',
  volumeCbm: '', weightKg: '',
  quoteTo: '', creatorName: '',
  contacto: '', bultos: '', personalCount: '', transbordo: null, coordinatorId: '',
  daysToComplete: '',
}

function toInputDate(v) {
  if (!v) return ''
  return new Date(v).toISOString().slice(0, 10)
}

export default function JobForm() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const isEdit = Boolean(id)
  const fromQuoteId  = !isEdit ? searchParams.get('fromQuote') : null
  const fromFileId   = !isEdit ? searchParams.get('fromFile')  : null
  const fromVisitId  = !isEdit ? searchParams.get('fromVisit') : null
  const fromType     = !isEdit ? searchParams.get('type')      : null
  const isDirect     = !isEdit ? searchParams.get('direct') === 'true' : false
  const { t } = useLanguage()

  const [form, setForm] = useState(() => ({ ...EMPTY, type: fromType || EMPTY.type }))
  const [language] = useState('ES')
  const [destAgent, setDestAgent] = useState({ agentId: '', name: '' })
  const autoFilledQuoteTo = useRef(null) // tracks last value auto-filled into quoteTo
  const [clients, setClients] = useState([])
  const [staffMembers, setStaffMembers] = useState([])
  const [coordinatorStaff, setCoordinatorStaff] = useState([])
  const [linkedQuoteId, setLinkedQuoteId] = useState(null)
  const [linkedVisitId, setLinkedVisitId] = useState(null)
  const [availableQuotes, setAvailableQuotes] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [scheduleWarning, setScheduleWarning] = useState(location.state?.scheduleWarning || null)
  const [showOverride, setShowOverride] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const errorRef = useRef(null)
  const [clientModalOpen, setClientModalOpen] = useState(false)
  const [corpModalOpen, setCorpModalOpen]     = useState(false)
  const currentStaff = useCurrentStaff()
  const isScheduleManager = Boolean(currentStaff?.canManageSchedule || currentStaff?.role === 'ADMIN')

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
            clientId:          job.clientId          || '',
            corporateClientId: job.corporateClientId  || '',
            originAddress: job.originAddress || '', originWarehouse: job.originWarehouse || '', originCity: job.originCity || '', originCountry: job.originCountry || '',
            destAddress: job.destAddress || '', destCity: job.destCity || '', destCountry: job.destCountry || '',
            serviceLatitude: job.serviceLatitude ?? null,
            serviceLongitude: job.serviceLongitude ?? null,
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
            daysToComplete:  job.daysToComplete  ?? '',
          })
          // load existing destAgent — do NOT update autoFilledQuoteTo (preserve saved quoteTo)
          setDestAgent({ agentId: job.destAgentId || '', name: job.destAgent?.name || '' })
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
          const agentName = f.destAgent?.name || ''
          // agent name takes priority over client name for quoteTo
          const autoQuoteTo = agentName || indName || corpName
          if (autoQuoteTo) autoFilledQuoteTo.current = autoQuoteTo
          if (f.destAgentId) setDestAgent({ agentId: f.destAgentId, name: agentName })
          setForm(prev => ({
            ...prev,
            type:              fromType || 'IMPORT',
            clientId:          f.clientId          || '',
            corporateClientId: f.corporateClientId || '',
            companyName:       f.corporateClient?.name || '',
            clientPhone: f.client?.phone || '',
            quoteTo:     autoQuoteTo,
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
          const clientQuoteTo = v?.client?.name
            || (v?.client ? `${v.client.firstName || ''} ${v.client.lastName || ''}`.trim() : '')
            || v?.prospectName || ''
          const agentQuoteTo = v?.destAgent?.name || ''
          const autoQuoteTo = agentQuoteTo || clientQuoteTo
          if (autoQuoteTo) autoFilledQuoteTo.current = autoQuoteTo
          if (v?.destAgentId) setDestAgent({ agentId: v.destAgentId, name: agentQuoteTo })
          const autoCompany = v?.corporateClient?.name || ''
          let jobType = 'IMPORT'
          if (v?.serviceType === 'LOCAL_MOVE') jobType = 'DOMESTIC'
          else if (['DOOR_TO_PORT', 'DOOR_TO_DOOR'].includes(v?.serviceType)) jobType = 'EXPORT'
          else if (v?.serviceType === 'PORT_TO_DOOR') jobType = 'IMPORT'
          setForm(prev => ({
            ...prev,
            type:              jobType,
            clientId:          v?.clientId          || '',
            corporateClientId: v?.corporateClientId || '',
            companyName:       v?.corporateClient?.name || prev.companyName,
            companyPhone:      v?.corporateClient?.phone || prev.companyPhone,
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
            const agentName = v.destAgent?.name || ''
            // agent name takes priority over client name for quoteTo
            const autoQuoteTo = agentName || clientName
            if (autoQuoteTo) autoFilledQuoteTo.current = autoQuoteTo
            if (v.destAgentId) setDestAgent({ agentId: v.destAgentId, name: agentName })
            setForm(prev => ({
              ...prev,
              type:              'EXPORT',
              clientId:          v.clientId          || '',
              corporateClientId: v.corporateClientId || '',
              companyName:       v.corporateClient?.name || '',
              companyPhone:      v.corporateClient?.phone || '',
              originAddress: v.originAddress || '',
              originCity:    v.originCity    || '',
              originCountry: v.originCountry || '',
              destAddress:   v.destAddress   || '',
              destCity:      v.destCity      || '',
              destCountry:   v.destCountry   || '',
              notes:         v.observations  || '',
              clientPhone:   v.client?.phone || '',
              quoteTo:       autoQuoteTo,
            }))
          }).catch(() => {})
        )
      } else {
        // Direct job (no visit/quote): use type from URL param, fall back to EXPORT
        if (isDirect) setForm(prev => ({ ...prev, type: fromType || 'EXPORT' }))
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
    const autoPhone   = client?.phone || ''
    const autoQuoteTo = client
      ? (client.name || `${client.firstName || ''} ${client.lastName || ''}`.trim() || '')
      : ''
    // Track so destAgent auto-fill can detect whether user manually changed this
    if (autoQuoteTo) autoFilledQuoteTo.current = autoQuoteTo
    setForm(prev => ({
      ...prev,
      clientId,
      clientPhone: autoPhone   || prev.clientPhone,
      quoteTo:     autoQuoteTo || prev.quoteTo,
    }))
  }

  const handleDestAgentChange = (newAgent) => {
    if (newAgent.agentId && newAgent.name) {
      // Selecting an agent: auto-fill quoteTo only if blank or still showing an auto-filled value
      if (!form.quoteTo || form.quoteTo === autoFilledQuoteTo.current) {
        set('quoteTo', newAgent.name)
        autoFilledQuoteTo.current = newAgent.name
      }
    } else {
      // Clearing the agent: revert quoteTo to client name if it still shows the agent-auto-filled value
      if (form.quoteTo === autoFilledQuoteTo.current) {
        const client = clients.find(c => c.id === form.clientId)
        const clientName = client
          ? (client.name || `${client.firstName || ''} ${client.lastName || ''}`.trim() || '')
          : ''
        set('quoteTo', clientName)
        autoFilledQuoteTo.current = clientName
      }
    }
    setDestAgent(newAgent)
  }

  const handleCorpClientChange = (corpClientId) => {
    const client = clients.find(c => c.id === corpClientId)
    setForm(prev => ({
      ...prev,
      corporateClientId: corpClientId || '',
      companyName:  client?.name  || prev.companyName,
      companyPhone: client?.phone || prev.companyPhone,
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
        clientId:          v?.clientId          || '',
        corporateClientId: v?.corporateClientId || '',
        companyName:       v?.corporateClient?.name || prev.companyName,
        originAddress: v?.originAddress || '', originCity: v?.originCity || '', originCountry: v?.originCountry || '',
        destAddress: v?.destAddress || '', destCity: v?.destCity || '', destCountry: v?.destCountry || '',
        notes: v?.observations || '',
        clientPhone: autoPhone   || prev.clientPhone,
        quoteTo:     autoQuoteTo || prev.quoteTo,
      }))
    } catch { /* ignore */ }
  }

  const handleSubmit = async (e, override) => {
    e.preventDefault()
    setSaving(true); setError(null)
    if (!override) setScheduleWarning(null)
    try {
      const quoteToLink = fromQuoteId || linkedQuoteId
      const payload = {
        ...form,
        destAgentId:       destAgent.agentId || null,
        clientId:          form.clientId          || null,
        corporateClientId: form.corporateClientId  || null,
        quoteId: !isEdit ? (quoteToLink || null) : undefined,
        visitId: (!isEdit && (fromVisitId || linkedVisitId)) ? (fromVisitId || linkedVisitId) : undefined,
        movingFileId: (!isEdit && fromFileId) ? fromFileId : undefined,
        language,
        ...(override ? { forceScheduleOverride: true, scheduleOverrideReason: overrideReason.trim() } : {}),
      }
      if (isEdit) {
        const saved = await api.put(`/jobs/${id}`, payload)
        if (saved?.scheduleWarning) {
          setScheduleWarning(saved.scheduleWarning)
        } else {
          setShowOverride(false)
          navigate(`/jobs/${id}`)
        }
      } else {
        const created = await api.post('/jobs', payload)
        if (created?.scheduleWarning) {
          // Route to the edit form (not the 'new' form) so a resubmit does not create a duplicate job,
          // and carry the warning through navigation so the user actually sees it.
          navigate(`/jobs/${created.id}/edit`, { replace: true, state: { scheduleWarning: created.scheduleWarning } })
        } else {
          navigate(`/jobs/${created.id}`)
        }
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

          {!isEdit && !fromQuoteId && !fromFileId && !isDirect && (
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
              onCorpClientChange={handleCorpClientChange}
              onCreateNewClient={!isEdit ? () => setClientModalOpen(true) : undefined}
              onCreateNewCorp={!isEdit ? () => setCorpModalOpen(true) : undefined}
              resolvedJobNumber={resolvedJobNumber}
              resolvedCreatedDate={resolvedCreatedDate}
              staffMembers={staffMembers}
              coordinatorStaff={coordinatorStaff}
            />
          </div>

          <div className="form-section">
            <div className="form-section-title">{t('jobs.serviceCoordinates')}</div>
            <LocationPicker
              latitude={form.serviceLatitude}
              longitude={form.serviceLongitude}
              onChange={(latitude, longitude) => {
                set('serviceLatitude', latitude)
                set('serviceLongitude', longitude)
              }}
            />
          </div>

          {form.type !== 'IMPORT' && (
            <div className="form-section">
              <div className="form-section-title">{t('jobs.parties')}</div>
              <div className="form-group">
                <label className="form-label">{t('jobs.destAgent')}</label>
                <AgentLookup
                  value={destAgent}
                  onChange={handleDestAgentChange}
                />
              </div>
            </div>
          )}

          <div className="form-section">
            <div className="form-section-title">{t('jobs.schedulingSection')}</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t('jobs.personalCount')}</label>
                {isScheduleManager ? (
                  <input type="number" min="1" className="form-control" value={form.personalCount}
                    onChange={e => set('personalCount', e.target.value)} placeholder={t('jobs.personalCountPlaceholder')} />
                ) : (
                  <div className="form-control" style={{ background:'#f8fafc', color:'#475569' }}>
                    {form.personalCount || '—'} <span style={{ fontSize:11, color:'#94a3b8' }}>({t('schedule.managerOnly')})</span>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">{t('jobs.daysToComplete')}</label>
                <input type="number" min="1" className="form-control" value={form.daysToComplete}
                  onChange={e => set('daysToComplete', e.target.value)} placeholder="1" />
              </div>
            </div>
            {scheduleWarning && (
              <div className="alert alert-error" style={{ marginTop: 8, fontSize: 13 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  {scheduleWarning.code === 'MISSING_WORKERS_REQUIRED' ? t('schedule.workersRequiredMissing')
                    : scheduleWarning.code === 'OVERRIDE_REASON_REQUIRED' ? t('schedule.overrideReasonRequired')
                    : t('schedule.noCapacityMessage')}
                </div>
                {scheduleWarning.suggestions?.length > 0 && (
                  <>
                    <div>{t('schedule.suggestedDates')}:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                      {scheduleWarning.suggestions.map(s => (
                        <button key={s.startDate} type="button" className="btn btn-ghost" style={{ fontSize: 12 }}
                          onClick={() => { set('serviceDate', s.startDate); setScheduleWarning(null); setShowOverride(false) }}>
                          {t('schedule.useSuggestedDate')}: {s.startDate === s.endDate ? s.startDate : `${s.startDate} → ${s.endDate}`}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {scheduleWarning.code !== 'MISSING_WORKERS_REQUIRED' && !showOverride && (
                  <button type="button" className="btn" style={{ marginTop: 10, background: '#fef3c7', color: '#92400e', border: 'none', fontSize: 12 }}
                    onClick={() => setShowOverride(true)}>
                    {t('schedule.overrideAction')}
                  </button>
                )}
                {showOverride && (
                  <div style={{ marginTop: 10 }}>
                    <label className="form-label">{t('schedule.overrideReasonLabel')} *</label>
                    <textarea className="form-control" rows={2} value={overrideReason}
                      onChange={e => setOverrideReason(e.target.value)} placeholder={t('schedule.overrideReasonPlaceholder')} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button type="button" className="btn btn-ghost" onClick={() => setShowOverride(false)}>{t('common.cancel')}</button>
                      <button type="button" className="btn btn-primary" disabled={saving}
                        onClick={e => {
                          if (!overrideReason.trim()) { setError(t('schedule.overrideReasonRequired')); return }
                          handleSubmit(e, true)
                        }}>
                        {saving ? t('common.saving') : t('schedule.overrideAction')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
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
      <QuickCreateClientModal
        open={clientModalOpen}
        onClose={() => setClientModalOpen(false)}
        onCreated={newClient => {
          setClients(prev => [...prev, newClient])
          handleClientChange(newClient.id)
          setClientModalOpen(false)
        }}
      />
      <QuickCreateCorporateClientModal
        open={corpModalOpen}
        onClose={() => setCorpModalOpen(false)}
        onCreated={newClient => {
          setClients(prev => [...prev, newClient])
          handleCorpClientChange(newClient.id)
          setCorpModalOpen(false)
        }}
      />
    </>
  )
}
