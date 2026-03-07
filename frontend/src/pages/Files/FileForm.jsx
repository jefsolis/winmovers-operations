import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'
import { getFileServiceTypes, getShipmentModes, getFileBookerRoles } from '../../constants'

const CATEGORY_ROUTES = { EXPORT: '/files/export', IMPORT: '/files/import', LOCAL: '/files/local' }

const EMPTY_NEW_CLIENT = { firstName: '', lastName: '', email: '', phone: '' }

export default function FileForm() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate  = useNavigate()
  const { t }     = useLanguage()
  const isEdit    = Boolean(id)

  const defaultCategory = searchParams.get('category') || 'EXPORT'

  const [form, setForm] = useState({
    category: defaultCategory,
    clientId: '',
    newClient: { ...EMPTY_NEW_CLIENT },
    notes: '',
    serviceType: '',
    shipmentMode: '',
    volumeCbm: '',
    weightKg: '',
    bookerRole: '',
    originAgentId: '',
    destAgentId: '',
  })
  const [clients, setClients] = useState([])
  const [agents, setAgents]   = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)

  const FILE_SERVICE_TYPES = getFileServiceTypes(t)
  const SHIPMENT_MODES     = getShipmentModes(t)
  const BOOKER_ROLES       = getFileBookerRoles()

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))
  const setNc = (field, value) => setForm(prev => ({ ...prev, newClient: { ...prev.newClient, [field]: value } }))

  useEffect(() => {
    api.get('/clients').then(setClients).catch(() => {})
    api.get('/agents').then(setAgents).catch(() => {})
    if (isEdit) {
      api.get(`/files/${id}`)
        .then(f => setForm(prev => ({
          ...prev,
          category:      f.category,
          clientId:      f.clientId      || '',
          notes:         f.notes         || '',
          serviceType:   f.serviceType   || '',
          shipmentMode:  f.shipmentMode  || '',
          volumeCbm:     f.volumeCbm     ?? '',
          weightKg:      f.weightKg      ?? '',
          bookerRole:    f.bookerRole    || '',
          originAgentId: f.originAgentId || '',
          destAgentId:   f.destAgentId   || '',
        })))
        .catch(e => setError(e.message))
        .finally(() => setLoading(false))
    }
  }, [id]) // eslint-disable-line

  const newClientMode = form.clientId === '__new__'
  const category = form.category

  const handleBookerRoleChange = (role) => {
    setForm(prev => ({
      ...prev,
      bookerRole: role,
      ...(role === 'BOOKER' ? { originAgentId: 'WINMOVERS', destAgentId: 'WINMOVERS' } :
          role === 'OA'     ? { originAgentId: 'WINMOVERS' } :
          role === 'DA'     ? { destAgentId:   'WINMOVERS' } : {}),
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const payload = {
        category:      form.category,
        notes:         form.notes         || null,
        serviceType:   form.serviceType   || null,
        shipmentMode:  form.shipmentMode  || null,
        volumeCbm:     form.volumeCbm !== '' ? parseFloat(form.volumeCbm) : null,
        weightKg:      form.weightKg  !== '' ? parseFloat(form.weightKg)  : null,
        bookerRole:    form.bookerRole    || null,
        originAgentId: (form.originAgentId === 'WINMOVERS' ? null : form.originAgentId) || null,
        destAgentId:   (form.destAgentId   === 'WINMOVERS' ? null : form.destAgentId)   || null,
      }
      if (newClientMode) {
        payload.newClient = { ...form.newClient, clientType: 'INDIVIDUAL' }
      } else {
        payload.clientId = form.clientId || null
      }
      if (isEdit) {
        await api.put(`/files/${id}`, payload)
        navigate(`${CATEGORY_ROUTES[category]}/${id}`)
      } else {
        const created = await api.post('/files', payload)
        navigate(`${CATEGORY_ROUTES[category]}/${created.id}`)
      }
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  if (loading) return <div className="loading"><div className="spinner" /> {t('common.loading')}</div>

  const back = CATEGORY_ROUTES[category] || '/files/export'

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">
            {isEdit ? t('movingFiles.editFile') : t('movingFiles.newFile')}
          </div>
          {!isEdit && (
            <div className="page-subtitle">{t('movingFiles.numberAutoAssigned')}</div>
          )}
        </div>
        <Link to={back} className="btn btn-ghost">{t('movingFiles.backToFiles')}</Link>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card card-body">
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <div className="form-grid">

              {/* Client selector */}
              <div className="form-group">
                <label className="form-label">{t('movingFiles.client')}</label>
                <select
                  className="form-control"
                  value={form.clientId}
                  onChange={e => set('clientId', e.target.value)}
                >
                  <option value="">{t('common.none')}</option>
                  <option value="__new__">— {t('movingFiles.newClientInline')} —</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.clientType === 'INDIVIDUAL'
                        ? `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.name
                        : c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Service Type — only for IMPORT files */}
              {category === 'IMPORT' && (
                <div className="form-group">
                  <label className="form-label">{t('movingFiles.serviceType')}</label>
                  <select className="form-control" value={form.serviceType} onChange={e => set('serviceType', e.target.value)}>
                    <option value="">{t('common.select')}</option>
                    {FILE_SERVICE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              )}

              {/* Shipment Mode */}
              <div className="form-group">
                <label className="form-label">{t('movingFiles.shipmentMode')}</label>
                <select className="form-control" value={form.shipmentMode} onChange={e => set('shipmentMode', e.target.value)}>
                  <option value="">{t('common.select')}</option>
                  {SHIPMENT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>

              {/* Volume */}
              <div className="form-group">
                <label className="form-label">{t('movingFiles.volumeCbm')}</label>
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.volumeCbm}
                  onChange={e => set('volumeCbm', e.target.value)}
                />
              </div>

              {/* Weight */}
              <div className="form-group">
                <label className="form-label">{t('movingFiles.weightKg')}</label>
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.weightKg}
                  onChange={e => set('weightKg', e.target.value)}
                />
              </div>

              {/* Booker Role */}
              <div className="form-group">
                <label className="form-label">{t('movingFiles.bookerRole')}</label>
                <select
                  className="form-control"
                  value={form.bookerRole}
                  onChange={e => handleBookerRoleChange(e.target.value)}
                >
                  <option value="">{t('common.none')}</option>
                  {BOOKER_ROLES.map(r => <option key={r} value={r}>{t(`movingFiles.bookerRoles.${r}`)}</option>)}
                </select>
              </div>

              {/* Origin Agent */}
              <div className="form-group">
                <label className="form-label">{t('movingFiles.originAgent')}</label>
                <select className="form-control" value={form.originAgentId} onChange={e => set('originAgentId', e.target.value)}>
                  <option value="">— {t('common.none')} —</option>
                  <option value="WINMOVERS">{t('movingFiles.winmoversOption')}</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              {/* Destination Agent */}
              <div className="form-group">
                <label className="form-label">{t('movingFiles.destAgent')}</label>
                <select className="form-control" value={form.destAgentId} onChange={e => set('destAgentId', e.target.value)}>
                  <option value="">— {t('common.none')} —</option>
                  <option value="WINMOVERS">{t('movingFiles.winmoversOption')}</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              {/* Notes */}
              <div className="form-group form-full">
                <label className="form-label">{t('common.notes')}</label>
                <textarea className="form-control" value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} />
              </div>

            </div>
          </div>

          {/* Inline new client fields */}
          {newClientMode && (
            <div className="form-section" style={{ marginTop: 16, padding: '12px 0 0', borderTop: '1px solid var(--border)' }}>
              <div className="section-label" style={{ marginBottom: 8 }}>{t('movingFiles.newClientSection')}</div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">{t('clients.firstName')}</label>
                  <input className="form-control" value={form.newClient.firstName} onChange={e => setNc('firstName', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('clients.lastName')}</label>
                  <input className="form-control" value={form.newClient.lastName} onChange={e => setNc('lastName', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('clients.email')}</label>
                  <input className="form-control" type="email" value={form.newClient.email} onChange={e => setNc('email', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('clients.phone')}</label>
                  <input className="form-control" value={form.newClient.phone} onChange={e => setNc('phone', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          <div className="form-actions">
            <Link to={back} className="btn btn-ghost">{t('common.cancel')}</Link>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t('common.saving') : isEdit ? t('common.save') : t('movingFiles.createFile')}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
