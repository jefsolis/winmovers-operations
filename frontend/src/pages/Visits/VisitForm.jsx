import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { api } from '../../api'
import { getVisitStatuses, getServiceTypes, getVisitBookerRoles } from '../../constants'
import { useLanguage } from '../../i18n'
import ClientLookup from '../../components/ClientLookup'
import AgentLookup from '../../components/AgentLookup'
import QuickCreateAgentModal from '../../components/QuickCreateAgentModal'
import QuickCreateCorporateClientModal from '../../components/QuickCreateCorporateClientModal'

const EMPTY_IND = { clientId: '', name: '', phone: '', email: '' }
const EMPTY_CORP = { clientId: '', name: '' }

const EMPTY = {
  status: 'SCHEDULED',
  indClient: { ...EMPTY_IND },
  corpClient: { ...EMPTY_CORP },
  assignedToId: '',
  serviceType: '',
  language: 'ES',
  scheduledDate: '',
  bookerRole: '', originAgentId: 'WINMOVERS', destAgent: { agentId: '', name: '' },
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
  const BOOKER_ROLES    = getVisitBookerRoles()

  const [form, setForm]       = useState(EMPTY)
  const [staffMembers, setStaffMembers] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)
  const errorRef = useRef(null)
  const [agentModalOpen, setAgentModalOpen]   = useState(false)
  const [agentModalName, setAgentModalName]   = useState('')
  const [corpModalOpen, setCorpModalOpen]     = useState(false)
  const [corpModalName, setCorpModalName]     = useState('')

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [error])

  useEffect(() => {
    const tasks = [
      api.get('/staff?canBeAssignedToVisit=true').then(setStaffMembers).catch(() => {}),
    ]
    if (isEdit) {
      tasks.push(
        api.get(`/visits/${id}`).then(v => {
          const indName = v.prospectName
            || [v.client?.firstName, v.client?.lastName].filter(Boolean).join(' ')
            || v.client?.name || ''
          setForm({
            status:        v.status,
            indClient: {
              clientId: v.clientId           || '',
              name:     indName,
              phone:    v.prospectPhone      || v.client?.phone || '',
              email:    v.prospectEmail      || v.client?.email || '',
            },
            corpClient: {
              clientId: v.corporateClientId  || '',
              name:     v.corporateClient?.name || '',
            },
            assignedToId:       v.assignedToId       || '',
            serviceType:        v.serviceType        || '',
            language:      v.language      || 'ES',
            scheduledDate: v.scheduledDate ? new Date(v.scheduledDate).toISOString().slice(0, 16) : '',
            bookerRole:    v.bookerRole    || '',
            originAgentId: 'WINMOVERS',
            destAgent:   { agentId: v.destAgentId || '', name: v.destAgent?.name || '' },
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

  const field = (name, type = 'text') => ({
    type,
    className: 'form-control',
    value: form[name],
    onChange: e => set(name, e.target.value),
  })

  const handleSubmit = async e => {
    e.preventDefault()
    const errs = []
    if (!form.serviceType)                                    errs.push(t('visits.validation.serviceType'))
    if (!form.scheduledDate)                                  errs.push(t('visits.validation.scheduledDate'))
    if (!form.assignedToId)                                   errs.push(t('visits.validation.assignedTo'))
    if (!form.indClient.clientId && !form.indClient.name?.trim()) errs.push(t('visits.validation.nameOrClient'))
    if (errs.length) { setError(errs.join('\n')); return }
    setSaving(true); setError(null)
    try {
      // Auto-create individual client if new name was entered
      let clientId = form.indClient.clientId
      if (!clientId && form.indClient.name.trim()) {
        const parts = form.indClient.name.trim().split(/\s+/)
        const newCl = await api.post('/clients', {
          clientType: 'INDIVIDUAL',
          firstName:  parts[0],
          lastName:   parts.slice(1).join(' ') || null,
          phone:      form.indClient.phone || null,
          email:      form.indClient.email || null,
        })
        clientId = newCl.id
      }
      // Auto-create corporate client if new name was entered
      let corporateClientId = form.corpClient.clientId
      if (!corporateClientId && form.corpClient.name.trim()) {
        const newCorp = await api.post('/clients', {
          clientType: 'CORPORATE',
          name:       form.corpClient.name.trim(),
        })
        corporateClientId = newCorp.id
      }
      const payload = {
        prospectName:  form.indClient.name  || null,
        prospectPhone: form.indClient.phone || null,
        prospectEmail: form.indClient.email || null,
        clientId:           clientId           || null,
        corporateClientId:  corporateClientId  || null,
        assignedToId:       form.assignedToId  || null,
        status:        form.status,
        serviceType:   form.serviceType   || null,
        language:      form.language      || 'ES',
        scheduledDate: form.scheduledDate ? new Date(form.scheduledDate).toISOString() : null,
        bookerRole:    form.bookerRole    || null,
        originAgentId: (form.originAgentId === 'WINMOVERS' ? null : form.originAgentId) || null,
        destAgentId:   (form.destAgent.agentId   === 'WINMOVERS' ? null : form.destAgent.agentId)   || null,
        originAddress: form.originAddress || null,
        originCity:    form.originCity    || null,
        originCountry: form.originCountry || null,
        destAddress:   form.destAddress   || null,
        destCity:      form.destCity      || null,
        destCountry:   form.destCountry   || null,
        observations:  form.observations  || null,
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
              <label className="form-label">{t('visits.linkedClient')}</label>
              <ClientLookup
                clientType="INDIVIDUAL"
                value={form.indClient}
                onChange={val => set('indClient', val)}
                showContact={false}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('visits.prospectPhone')}</label>
              <input
                className="form-control"
                value={form.indClient.phone || ''}
                readOnly={Boolean(form.indClient.clientId)}
                onChange={e => set('indClient', { ...form.indClient, phone: e.target.value })}
                placeholder="+57 300 000 0000"
                style={form.indClient.clientId ? { background: 'var(--input-bg)' } : undefined}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('visits.prospectEmail')}</label>
              <input
                className="form-control"
                value={form.indClient.email || ''}
                readOnly={Boolean(form.indClient.clientId)}
                onChange={e => set('indClient', { ...form.indClient, email: e.target.value })}
                type="email"
                style={form.indClient.clientId ? { background: 'var(--input-bg)' } : undefined}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('visits.companyClient')}</label>
              <ClientLookup
                clientType="CORPORATE"
                value={form.corpClient}
                onChange={val => set('corpClient', val)}
                showContact={false}
                noResultsText={t('clients.noResultsNewCompany')}
                onCreateNew={name => { setCorpModalName(name); setCorpModalOpen(true) }}
              />
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
              <label className="form-label">{t('visits.assignedTo')} <span style={{ color: 'var(--danger, #dc3545)' }}>*</span></label>
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
            <div className="form-group">
              <label className="form-label">{t('visits.bookerRole')}</label>
              <select className="form-control" value={form.bookerRole} onChange={e => {
                const role = e.target.value
                setForm(prev => ({
                  ...prev, bookerRole: role,
                  ...(role === 'BOOKER' || role === 'DA' ? { destAgent: { agentId: 'WINMOVERS', name: t('movingFiles.winmoversOption') } } : {}),
                }))
              }}>
                <option value="">{t('common.none')}</option>
                {BOOKER_ROLES.map(r => <option key={r} value={r}>{t(`visits.bookerRoles.${r}`)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('visits.originAgent')}</label>
              <input className="form-control" value={t('movingFiles.winmoversOption')} readOnly style={{ background: 'var(--bg-secondary, #f8f9fa)', cursor: 'default' }} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('visits.destAgent')}</label>
              <AgentLookup
                value={form.destAgent}
                onChange={val => set('destAgent', val)}
                allowWinMovers
                onCreateNew={name => { setAgentModalName(name); setAgentModalOpen(true) }}
              />
            </div>
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
      <QuickCreateAgentModal
        open={agentModalOpen}
        onClose={() => setAgentModalOpen(false)}
        initialName={agentModalName}
        onCreated={agent => {
          set('destAgent', { agentId: agent.id, name: agent.name })
          setAgentModalOpen(false)
        }}
      />
      <QuickCreateCorporateClientModal
        open={corpModalOpen}
        onClose={() => setCorpModalOpen(false)}
        initialName={corpModalName}
        onCreated={client => {
          set('corpClient', { clientId: client.id, name: client.name })
          setCorpModalOpen(false)
        }}
      />
    </>
  )
}
