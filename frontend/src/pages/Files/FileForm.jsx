import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'
import { getFileServiceTypes, getShipmentModes, getFileBookerRoles } from '../../constants'
import ClientLookup from '../../components/ClientLookup'

const CATEGORY_ROUTES = { EXPORT: '/files/export', IMPORT: '/files/import', LOCAL: '/files/local' }

export default function FileForm() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const { pathname }  = useLocation()
  const navigate  = useNavigate()
  const { t }     = useLanguage()
  const isEdit    = Boolean(id)

  const defaultCategory = searchParams.get('category')
    || (pathname.includes('/import') ? 'IMPORT' : pathname.includes('/local') ? 'LOCAL' : 'EXPORT')

  const [form, setForm] = useState({
    category: defaultCategory,
    indClient: { clientId: '', name: '', phone: '', email: '' },
    corpClient: { clientId: '', name: '' },
    notes: '',
    serviceType: '',
    shipmentMode: '',
    volumeCbm: '',
    weightKg: '',
    bookerRole: '',
    originAgentId: '',
    destAgentId: defaultCategory === 'IMPORT' ? 'WINMOVERS' : '',
    // Shipping fields
    originAddress: '', originCity: '', originCountry: '',
    destAddress: '', destCity: '', destCountry: '',
    etd: '', eta: '',
    navieraAerolinea: '',
    vaporVuelo: '',
    guiaObl: '',
    puertoSalida: '',
    puertoLlegada: '',
    destPhone: '',
    puertoEntrada: '',
    oblHastaCiudad: '',
    fechaLlegada: '',
    fechaTrasladoBodega: '',
    fechaTraslado: '',
    fechaEntrega: '',
  })
  const [clients, setClients] = useState([]) // eslint-disable-line
  const [agents, setAgents]   = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)

  const FILE_SERVICE_TYPES = getFileServiceTypes(t)
  const SHIPMENT_MODES     = getShipmentModes(t)
  const BOOKER_ROLES       = getFileBookerRoles()

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  useEffect(() => {
    api.get('/agents').then(setAgents).catch(() => {})
    if (isEdit) {
      api.get(`/files/${id}`)
        .then(f => {
          const toDate = (v) => v ? new Date(v).toISOString().substring(0, 10) : ''
          const indName = f.client
            ? ([f.client.firstName, f.client.lastName].filter(Boolean).join(' ') || f.client.name || '')
            : ''
          setForm(prev => ({
            ...prev,
            category:      f.category,
            indClient: {
              clientId: f.clientId           || '',
              name:     indName,
              phone:    f.client?.phone      || '',
              email:    f.client?.email      || '',
            },
            corpClient: {
              clientId: f.corporateClientId  || '',
              name:     f.corporateClient?.name || '',
            },
            notes:              f.notes              || '',
            serviceType:   f.serviceType   || '',
            shipmentMode:  f.shipmentMode  || '',
            volumeCbm:     f.volumeCbm     ?? '',
            weightKg:      f.weightKg      ?? '',
            bookerRole:    f.bookerRole    || '',
            originAgentId: f.originAgentId || '',
            destAgentId:   f.category === 'IMPORT' ? 'WINMOVERS' : (f.destAgentId || ''),
            originAddress: f.originAddress || '',
            originCity:    f.originCity    || '',
            originCountry: f.originCountry || '',
            destAddress:   f.destAddress   || '',
            destCity:      f.destCity      || '',
            destCountry:   f.destCountry   || '',
            etd:              toDate(f.etd),
            eta:              toDate(f.eta),
            navieraAerolinea: f.navieraAerolinea    || '',
            vaporVuelo:       f.vaporVuelo           || '',
            guiaObl:          f.guiaObl              || '',
            puertoSalida:     f.puertoSalida         || '',
            puertoLlegada:    f.puertoLlegada        || '',
            destPhone:        f.destPhone            || '',
            puertoEntrada:    f.puertoEntrada        || '',
            oblHastaCiudad:   f.oblHastaCiudad       || '',
            fechaLlegada:         toDate(f.fechaLlegada),
            fechaTrasladoBodega:  f.fechaTrasladoBodega  || '',
            fechaTraslado:        toDate(f.fechaTraslado),
            fechaEntrega:         toDate(f.fechaEntrega),
          }))
        })
        .catch(e => setError(e.message))
        .finally(() => setLoading(false))
    }
  }, [id]) // eslint-disable-line

  const newClientMode = false // kept for safety, no longer used
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
        category:           form.category,
        clientId:           clientId          || null,
        corporateClientId:  corporateClientId || null,
        notes:              form.notes             || null,
        serviceType:   form.serviceType   || null,
        shipmentMode:  form.shipmentMode  || null,
        volumeCbm:     form.volumeCbm !== '' ? parseFloat(form.volumeCbm) : null,
        weightKg:      form.weightKg  !== '' ? parseFloat(form.weightKg)  : null,
        bookerRole:    form.bookerRole    || null,
        originAgentId: (form.originAgentId === 'WINMOVERS' ? null : form.originAgentId) || null,
        destAgentId:   (form.destAgentId   === 'WINMOVERS' ? null : form.destAgentId)   || null,
        originAddress: form.originAddress || null,
        originCity:    form.originCity    || null,
        originCountry: form.originCountry || null,
        destAddress:   form.destAddress   || null,
        destCity:      form.destCity      || null,
        destCountry:   form.destCountry   || null,
        etd:              form.etd              || null,
        eta:              form.eta              || null,
        navieraAerolinea: form.navieraAerolinea || null,
        vaporVuelo:       form.vaporVuelo       || null,
        guiaObl:          form.guiaObl          || null,
        puertoSalida:     form.puertoSalida     || null,
        puertoLlegada:    form.puertoLlegada    || null,
        destPhone:        form.destPhone        || null,
        puertoEntrada:    form.puertoEntrada    || null,
        oblHastaCiudad:   form.oblHastaCiudad   || null,
        fechaLlegada:         form.fechaLlegada         || null,
        fechaTrasladoBodega:  form.fechaTrasladoBodega  || null,
        fechaTraslado:        form.fechaTraslado        || null,
        fechaEntrega:         form.fechaEntrega         || null,
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

              {/* Individual Client */}
              <div className="form-group">
                <label className="form-label">{t('movingFiles.client')}</label>
                <ClientLookup
                  clientType="INDIVIDUAL"
                  value={form.indClient}
                  onChange={val => set('indClient', val)}
                  showContact={false}
                />
              </div>

              {/* Phone */}
              <div className="form-group">
                <label className="form-label">{t('common.phone')}</label>
                <input
                  className="form-control"
                  value={form.indClient.phone || ''}
                  readOnly={Boolean(form.indClient.clientId)}
                  onChange={e => set('indClient', { ...form.indClient, phone: e.target.value })}
                  placeholder="+57 300 000 0000"
                  style={form.indClient.clientId ? { background: 'var(--input-bg)' } : undefined}
                />
              </div>

              {/* Email */}
              <div className="form-group">
                <label className="form-label">{t('common.email')}</label>
                <input
                  className="form-control"
                  value={form.indClient.email || ''}
                  readOnly={Boolean(form.indClient.clientId)}
                  onChange={e => set('indClient', { ...form.indClient, email: e.target.value })}
                  type="email"
                  style={form.indClient.clientId ? { background: 'var(--input-bg)' } : undefined}
                />
              </div>

              {/* Corporate Client */}
              <div className="form-group">
                <label className="form-label">{t('movingFiles.corporateClient')}</label>
                <ClientLookup
                  clientType="CORPORATE"
                  value={form.corpClient}
                  onChange={val => set('corpClient', val)}
                  showContact={false}
                  hintText={t('clients.willBeCreatedCompany')}
                  noResultsText={t('clients.noResultsNewCompany')}
                />
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
                  <option value="">{t('common.none')}</option>
                  <option value="WINMOVERS">{t('movingFiles.winmoversOption')}</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              {/* Destination Agent */}
              <div className="form-group">
                <label className="form-label">{t('movingFiles.destAgent')}</label>
                {form.category === 'IMPORT' ? (
                  <input className="form-control" value={t('movingFiles.winmoversOption')} readOnly style={{ background: 'var(--bg-secondary, #f8f9fa)', cursor: 'default' }} />
                ) : (
                  <select className="form-control" value={form.destAgentId} onChange={e => set('destAgentId', e.target.value)}>
                    <option value="">{t('common.none')}</option>
                    <option value="WINMOVERS">{t('movingFiles.winmoversOption')}</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                )}
              </div>

              {/* Notes */}
              <div className="form-group form-full">
                <label className="form-label">{t('common.notes')}</label>
                <textarea className="form-control" value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} />
              </div>

            </div>
          </div>

          {/* Address fields — IMPORT/EXPORT only */}
          {(category === 'IMPORT' || category === 'EXPORT') && (
            <div className="form-section" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div className="section-label" style={{ marginBottom: 12 }}>{t('movingFiles.addressSection') || 'Addresses'}</div>
              <div className="form-grid">

                <div className="form-group">
                  <label className="form-label">{t('jobs.originAddress')}</label>
                  <input className="form-control" value={form.originAddress} onChange={e => set('originAddress', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('jobs.originCity')}</label>
                  <input className="form-control" value={form.originCity} onChange={e => set('originCity', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('jobs.originCountry')}</label>
                  <input className="form-control" value={form.originCountry} onChange={e => set('originCountry', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('movingFiles.destAddress')}</label>
                  <input className="form-control" value={form.destAddress} onChange={e => set('destAddress', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('jobs.destCity')}</label>
                  <input className="form-control" value={form.destCity} onChange={e => set('destCity', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('jobs.destCountry')}</label>
                  <input className="form-control" value={form.destCountry} onChange={e => set('destCountry', e.target.value)} />
                </div>

              </div>
            </div>
          )}
          {(category === 'IMPORT' || category === 'EXPORT') && (
            <div className="form-section" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div className="section-label" style={{ marginBottom: 12 }}>{t('movingFiles.shippingDetails') || 'Shipping Details'}</div>
              <div className="form-grid">

                <div className="form-group">
                  <label className="form-label">{t('movingFiles.etd')}</label>
                  <input className="form-control" type="date" value={form.etd} onChange={e => set('etd', e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">{t('movingFiles.eta')}</label>
                  <input className="form-control" type="date" value={form.eta} onChange={e => set('eta', e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">{t('movingFiles.naviera')} / {t('movingFiles.aerolinea')}</label>
                  <input className="form-control" value={form.navieraAerolinea} onChange={e => set('navieraAerolinea', e.target.value)} />
                </div>

                {category === 'EXPORT' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">{t('movingFiles.vapor')} / {t('movingFiles.vuelo')}</label>
                      <input className="form-control" value={form.vaporVuelo} onChange={e => set('vaporVuelo', e.target.value)} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">{t('movingFiles.guiaObl')}</label>
                      <input className="form-control" value={form.guiaObl} onChange={e => set('guiaObl', e.target.value)} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">{t('movingFiles.puertoSalida')}</label>
                      <input className="form-control" value={form.puertoSalida} onChange={e => set('puertoSalida', e.target.value)} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">{t('movingFiles.puertoLlegada')}</label>
                      <input className="form-control" value={form.puertoLlegada} onChange={e => set('puertoLlegada', e.target.value)} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">{t('movingFiles.destPhone')}</label>
                      <input className="form-control" value={form.destPhone} onChange={e => set('destPhone', e.target.value)} />
                    </div>
                  </>
                )}

                {category === 'IMPORT' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">{t('movingFiles.puertoEntrada')}</label>
                      <input className="form-control" value={form.puertoEntrada} onChange={e => set('puertoEntrada', e.target.value)} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">{t('movingFiles.oblHastaCiudad')}</label>
                      <input className="form-control" value={form.oblHastaCiudad} onChange={e => set('oblHastaCiudad', e.target.value)} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">{t('movingFiles.fechaLlegada')}</label>
                      <input className="form-control" type="date" value={form.fechaLlegada} onChange={e => set('fechaLlegada', e.target.value)} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">{t('movingFiles.trasladoBodega')}</label>
                      <input className="form-control" type="text" value={form.fechaTrasladoBodega} onChange={e => set('fechaTrasladoBodega', e.target.value)} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">{t('movingFiles.fechaTraslado')}</label>
                      <input className="form-control" type="date" value={form.fechaTraslado} onChange={e => set('fechaTraslado', e.target.value)} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">{t('movingFiles.fechaEntrega')}</label>
                      <input className="form-control" type="date" value={form.fechaEntrega} onChange={e => set('fechaEntrega', e.target.value)} />
                    </div>
                  </>
                )}

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
