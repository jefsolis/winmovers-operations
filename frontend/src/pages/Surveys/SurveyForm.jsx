import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'

const ROOM_OPTIONS = [
  'LIVING_ROOM', 'DINING_ROOM', 'KITCHEN',
  'MASTER_BEDROOM', 'BEDROOM_2', 'BEDROOM_3',
  'STUDY_OFFICE', 'GARAGE', 'GARDEN', 'OTHER',
]

function newItem(room = 'LIVING_ROOM') {
  return { _key: Math.random(), room, description: '', qty: 1, cfPerItem: 0, totalCf: 0 }
}

export default function SurveyForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { t } = useLanguage()
  const isEdit = Boolean(id)

  const [visit, setVisit] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)

  // Form state
  const [surveyDate, setSurveyDate]       = useState('')
  const [surveyorName, setSurveyorName]   = useState('')
  const [notes, setNotes]                 = useState('')
  const [items, setItems]                 = useState([newItem()])

  useEffect(() => {
    const load = async () => {
      try {
        if (isEdit) {
          const survey = await api.get(`/surveys/${id}`)
          setSurveyDate(survey.surveyDate ? survey.surveyDate.slice(0, 10) : '')
          setSurveyorName(survey.surveyorName || '')
          setNotes(survey.notes || '')
          setItems(survey.items.map(i => ({ ...i, _key: Math.random() })))
          setVisit(survey.visit)
        } else {
          const visitId = searchParams.get('visitId')
          if (visitId) {
            const v = await api.get(`/visits/${visitId}`)
            setVisit(v)
            setSurveyDate(new Date().toISOString().slice(0, 10))
          }
        }
      } catch {
        navigate('/visits')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id]) // eslint-disable-line

  const visitId = visit?.id || searchParams.get('visitId')

  const updateItem = (key, field, value) => {
    setItems(prev => prev.map(item => {
      if (item._key !== key) return item
      const updated = { ...item, [field]: value }
      const qty = field === 'qty'       ? parseFloat(value) || 0 : parseFloat(item.qty) || 0
      const cf  = field === 'cfPerItem' ? parseFloat(value) || 0 : parseFloat(item.cfPerItem) || 0
      updated.totalCf = qty * cf
      return updated
    }))
  }

  const addItem = (room) => setItems(prev => [...prev, newItem(room)])

  const removeItem = (key) => setItems(prev => prev.filter(i => i._key !== key))

  const grandTotal = items.reduce((s, i) => s + ((parseFloat(i.qty) || 0) * (parseFloat(i.cfPerItem) || 0)), 0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!visitId) { setError('No linked visit.'); return }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        visitId,
        surveyDate: surveyDate || null,
        surveyorName,
        notes,
        items: items.map(({ room, description, qty, cfPerItem }) => ({
          room, description,
          qty: parseInt(qty) || 1,
          cfPerItem: parseFloat(cfPerItem) || 0,
        })),
      }
      if (isEdit) {
        await api.put(`/surveys/${id}`, payload)
        navigate(`/surveys/${id}`)
      } else {
        const created = await api.post('/surveys', payload)
        navigate(`/surveys/${created.id}`)
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Error saving survey.')
      setSaving(false)
    }
  }

  if (loading) return <div className="loading"><div className="spinner" /> {t('common.loading')}</div>

  const clientName = visit?.client?.name || visit?.corporateClient?.name || visit?.prospectName
  const phone      = visit?.prospectPhone || visit?.client?.phone
  const origin     = [visit?.originAddress, visit?.originCity, visit?.originCountry].filter(Boolean).join(', ')
  const dest       = [visit?.destCity, visit?.destCountry].filter(Boolean).join(', ')
  const oa         = visit?.originAgent?.name
  const da         = visit?.destAgent?.name

  // Group items by room for display
  const roomsUsed = [...new Set(items.map(i => i.room))]

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{isEdit ? t('surveys.editSurvey') : t('surveys.title')}</div>
          {!isEdit && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('surveys.autoAssigned')}</div>}
        </div>
        {visitId && (
          <Link to={isEdit ? `/surveys/${id}` : `/visits/${visitId}`} className="btn btn-secondary">
            {t('surveys.backToVisit')}
          </Link>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        {/* Survey Info */}
        <div className="card card-body" style={{ marginBottom: 16 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>{t('surveys.surveyInfo')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="chart-grid">
            <div className="form-group">
              <label className="form-label">{t('surveys.surveyDate')}</label>
              <input className="form-control" type="date" value={surveyDate} onChange={e => setSurveyDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('surveys.surveyorName')}</label>
              <input className="form-control" type="text" value={surveyorName}
                placeholder={t('surveys.surveyorPlaceholder')}
                onChange={e => setSurveyorName(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Client Info (read-only prefill from visit) */}
        <div className="card card-body" style={{ marginBottom: 16 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>{t('surveys.clientInfo')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="chart-grid">
            <div className="form-group">
              <label className="form-label">{t('surveys.clientName')}</label>
              <input className="form-control" type="text" value={clientName || ''} readOnly
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('surveys.phone')}</label>
              <input className="form-control" type="text" value={phone || ''} readOnly
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('surveys.origin')}</label>
              <input className="form-control" type="text" value={origin || ''} readOnly
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('surveys.destination')}</label>
              <input className="form-control" type="text" value={dest || ''} readOnly
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('surveys.oa')}</label>
              <input className="form-control" type="text" value={oa || ''} readOnly
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('surveys.da')}</label>
              <input className="form-control" type="text" value={da || ''} readOnly
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }} />
            </div>
          </div>
        </div>

        {/* Item Inventory */}
        <div className="card card-body" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="section-label">{t('surveys.itemInventory')}</div>
          </div>

          {roomsUsed.map(room => {
            const roomItems = items.filter(i => i.room === room)
            return (
              <div key={room} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', padding: '4px 10px', background: 'var(--surface-2)', borderRadius: 6 }}>
                    {t(`surveys.rooms.${room}`)}
                  </div>
                  <button type="button" className="btn btn-secondary btn-sm"
                    onClick={() => addItem(room)}>
                    {t('surveys.addItem')}
                  </button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                        {t('surveys.description')}
                      </th>
                      <th style={{ textAlign: 'center', padding: '4px 6px', width: 70, fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                        {t('surveys.qty')}
                      </th>
                      <th style={{ textAlign: 'center', padding: '4px 6px', width: 100, fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                        {t('surveys.cfPerItem')}
                      </th>
                      <th style={{ textAlign: 'center', padding: '4px 6px', width: 90, fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                        {t('surveys.totalCfCol')}
                      </th>
                      <th style={{ width: 36 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {roomItems.map(item => (
                      <tr key={item._key} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '4px 6px' }}>
                          <input className="form-control" style={{ height: 32, fontSize: 13 }}
                            type="text" value={item.description}
                            onChange={e => updateItem(item._key, 'description', e.target.value)} />
                        </td>
                        <td style={{ padding: '4px 6px' }}>
                          <input className="form-control" style={{ height: 32, fontSize: 13, textAlign: 'center' }}
                            type="number" min="1" value={item.qty}
                            onChange={e => updateItem(item._key, 'qty', e.target.value)} />
                        </td>
                        <td style={{ padding: '4px 6px' }}>
                          <input className="form-control" style={{ height: 32, fontSize: 13, textAlign: 'center' }}
                            type="number" min="0" step="0.5" value={item.cfPerItem}
                            onChange={e => updateItem(item._key, 'cfPerItem', e.target.value)} />
                        </td>
                        <td style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 600 }}>
                          {((parseFloat(item.qty) || 0) * (parseFloat(item.cfPerItem) || 0)).toFixed(1)}
                        </td>
                        <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                          <button type="button"
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
                            onClick={() => removeItem(item._key)}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}

          {/* Add Room Section */}
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('surveys.addRoom')}:</span>
            {ROOM_OPTIONS.filter(r => !roomsUsed.includes(r)).map(room => (
              <button key={room} type="button" className="btn btn-secondary btn-sm"
                onClick={() => addItem(room)}>
                + {t(`surveys.rooms.${room}`)}
              </button>
            ))}
          </div>

          {/* Grand Total */}
          <div style={{ marginTop: 20, padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{t('surveys.grandTotal')}</span>
            <span style={{ fontWeight: 700, fontSize: 20, color: 'var(--primary)' }}>{grandTotal.toFixed(1)} CF</span>
          </div>
        </div>

        {/* Notes */}
        <div className="card card-body" style={{ marginBottom: 16 }}>
          <div className="form-group">
            <label className="form-label">{t('common.notes')}</label>
            <textarea className="form-control" rows={3} value={notes}
              onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? t('common.saving') : isEdit ? t('common.save') : t('surveys.createSurvey')}
          </button>
          {visitId && (
            <Link to={isEdit ? `/surveys/${id}` : `/visits/${visitId}`} className="btn btn-secondary">
              {t('common.cancel')}
            </Link>
          )}
        </div>
      </form>
    </>
  )
}
