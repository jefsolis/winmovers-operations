import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'
import { SURVEY_ROOM_ITEMS, SURVEY_CARTON_ITEMS, SURVEY_COLUMN_ROOMS } from '../../constants'

const ALL_ROOMS = Object.keys(SURVEY_ROOM_ITEMS)
const sk = (room, desc) => `${room}::${desc}`

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

  const [surveyDate, setSurveyDate]     = useState('')
  const [surveyorName, setSurveyorName] = useState('')
  const [notes, setNotes]               = useState('')
  const [weightFactor, setWeightFactor] = useState('6')

  const [qtys, setQtys] = useState({})
  const [cfs,  setCfs]  = useState({})

  useEffect(() => {
    const load = async () => {
      try {
        if (isEdit) {
          const survey = await api.get(`/surveys/${id}`)
          setSurveyDate(survey.surveyDate ? survey.surveyDate.slice(0, 10) : '')
          setSurveyorName(survey.surveyorName || '')
          setNotes(survey.notes || '')
          setWeightFactor(String(survey.cubeWeightFactor ?? 6))
          setVisit(survey.visit)
          const savedQtys = {}, savedCfs = {}
          for (const item of survey.items) {
            const key = sk(item.room, item.description)
            savedQtys[key] = String(item.qty)
            savedCfs[key]  = String(item.cfPerItem)
          }
          setQtys(savedQtys)
          setCfs(savedCfs)
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

  const getQty = (room, desc) => Math.max(0, parseInt(qtys[sk(room, desc)]) || 0)
  const getCf  = (room, desc) => {
    const override = cfs[sk(room, desc)]
    if (override !== undefined) return parseFloat(override) || 0
    const master = room === 'CARTONS'
      ? SURVEY_CARTON_ITEMS.find(i => i.description === desc)
      : SURVEY_ROOM_ITEMS[room]?.find(i => i.description === desc)
    return master?.cfPerItem ?? 0
  }

  const setQty = (room, desc, val) => setQtys(p => ({ ...p, [sk(room, desc)]: val }))
  const setCf  = (room, desc, val) => setCfs(p =>  ({ ...p, [sk(room, desc)]: val }))

  const roomTotal    = (room) => (room === 'CARTONS' ? SURVEY_CARTON_ITEMS : SURVEY_ROOM_ITEMS[room] || [])
    .reduce((s, i) => s + getQty(room, i.description) * getCf(room, i.description), 0)
  const colTotal     = (idx) => SURVEY_COLUMN_ROOMS[idx].reduce((s, r) => s + roomTotal(r), 0)
  const cartonsTotal = roomTotal('CARTONS')
  const grandTotal   = ALL_ROOMS.reduce((s, r) => s + roomTotal(r), 0) + cartonsTotal
  const estWeight    = grandTotal * (parseFloat(weightFactor) || 6)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!visitId) { setError('No linked visit.'); return }
    setSaving(true)
    setError(null)
    try {
      const items = []
      for (const room of [...ALL_ROOMS, 'CARTONS']) {
        const masterList = room === 'CARTONS' ? SURVEY_CARTON_ITEMS : SURVEY_ROOM_ITEMS[room]
        for (const master of masterList) {
          const qty = getQty(room, master.description)
          if (qty > 0) {
            items.push({ room, description: master.description, qty, cfPerItem: getCf(room, master.description) })
          }
        }
      }
      const payload = {
        visitId,
        surveyDate:       surveyDate || null,
        surveyorName:     surveyorName || null,
        notes:            notes || null,
        cubeWeightFactor: parseFloat(weightFactor) || 6,
        items,
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
  const origin        = [visit?.originAddress, visit?.originCity, visit?.originCountry].filter(Boolean).join(', ')
  const dest          = [visit?.destCity, visit?.destCountry].filter(Boolean).join(', ')
  const originCountry = visit?.originCountry || ''
  const destCountry   = visit?.destCountry   || ''
  const assignedToName = visit?.assignedTo?.name || ''

  // Shared micro-styles
  const hdrCell = (align = 'left') => ({
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
    color: 'var(--text-muted)', textAlign: align, padding: '3px 4px', letterSpacing: '.04em',
  })
  const dataCell = (align = 'left', extra = {}) => ({
    fontSize: 12, padding: '2px 4px', textAlign: align,
    borderBottom: '1px solid var(--border)', ...extra,
  })
  const numInput = (bg = 'var(--surface)') => ({
    width: '100%', textAlign: 'center', padding: '1px 2px',
    border: '1px solid var(--border)', borderRadius: 3, fontSize: 12,
    background: bg, color: 'var(--text)',
  })
  const COL_GRID = { display: 'grid', gridTemplateColumns: '1fr 46px 46px 54px' }
  const CART_GRID = { display: 'grid', gridTemplateColumns: '1fr 54px 54px 62px' }
  const roomHdr = {
    background: '#1c1c1c', color: '#fff', padding: '3px 6px',
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em',
  }

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

        {/* ── Printable area ── */}
        <div>

        {/*  Letterhead  */}
        <div className="card card-body" style={{ marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottom: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
            <img src="/winmovers-logo.jpg" alt="WinMovers" style={{ height: 64, objectFit: 'contain' }} />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 15, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text)' }}>Non-Binding Estimate</div>
              <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-muted)' }}>Table of Measurements in Cubic Feet</div>
            </div>
          </div>
        </div>

        {/*  Shipper info  */}
        <div className="card card-body" style={{ marginBottom: 10, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }} className="chart-grid">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Name of Shipper</label>
              <input className="form-control" type="text" value={clientName || ''} readOnly
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{t('surveys.surveyDate')}</label>
              <input className="form-control" type="date" value={surveyDate}
                onChange={e => setSurveyDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Shipping From</label>
              <input className="form-control" type="text" value={originCountry} readOnly
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Shipping To</label>
              <input className="form-control" type="text" value={destCountry} readOnly
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Created by</label>
              <input className="form-control" type="text" value={assignedToName} readOnly
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }} />
            </div>
          </div>
        </div>

        {/*  4-column inventory grid  */}
        <div style={{ overflowX: 'auto', marginBottom: 10 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, minmax(200px, 1fr))',
            border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', minWidth: 800,
          }}>
            {SURVEY_COLUMN_ROOMS.map((colRooms, colIdx) => (
              <div key={colIdx} style={{ borderRight: colIdx < 3 ? '1px solid var(--border)' : 'none' }}>

                {/* Column sub-header */}
                <div style={{ ...COL_GRID, background: 'var(--surface-2)', borderBottom: '2px solid var(--border)' }}>
                  <div style={hdrCell()}>Article</div>
                  <div style={hdrCell('center')}>No. Pcs</div>
                  <div style={hdrCell('center')}>Cube</div>
                  <div style={hdrCell('right')}>Total</div>
                </div>

                {/* Rooms */}
                {colRooms.map(room => (
                  <div key={room}>
                    <div style={roomHdr}>{t(`surveys.rooms.${room}`)}</div>
                    {SURVEY_ROOM_ITEMS[room].map(item => {
                      const qty = getQty(room, item.description)
                      const cf  = getCf(room, item.description)
                      const tot = qty * cf
                      return (
                        <div key={item.description} style={{ ...COL_GRID, opacity: qty === 0 ? 0.45 : 1 }}>
                          <div style={dataCell()}>{item.description}</div>
                          <div style={dataCell('center', { padding: '1px 2px' })}>
                            <input type="number" min="0"
                              value={qtys[sk(room, item.description)] ?? ''}
                              placeholder="0"
                              onChange={e => setQty(room, item.description, e.target.value)}
                              style={numInput()}
                            />
                          </div>
                          <div style={dataCell('center', { padding: '1px 2px' })}>
                            <input type="number" min="0" step="0.5"
                              value={cfs[sk(room, item.description)] ?? item.cfPerItem}
                              onChange={e => setCf(room, item.description, e.target.value)}
                              style={numInput('var(--surface-2)')}
                            />
                          </div>
                          <div style={dataCell('right', {
                            fontWeight: qty > 0 ? 600 : 400,
                            color: qty > 0 ? 'var(--text)' : 'var(--text-muted)',
                          })}>
                            {tot > 0 ? tot.toFixed(1) : ''}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}

                {/* Column total row */}
                <div style={{ ...COL_GRID, background: 'var(--surface-2)', borderTop: '2px solid var(--border)' }}>
                  <div style={{ padding: '3px 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', gridColumn: '1 / 4', color: 'var(--text-muted)', letterSpacing: '.04em' }}>
                    {t(`surveys.col${colIdx + 1}Total`)}
                  </div>
                  <div style={{ padding: '3px 6px', fontSize: 12, fontWeight: 700, color: 'var(--primary)', textAlign: 'right' }}>
                    {colTotal(colIdx).toFixed(1)}
                  </div>
                </div>

              </div>
            ))}
          </div>
        </div>

        {/*  Cartons + Totals  */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10, alignItems: 'start' }}>

          {/* Cartons */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={roomHdr}>{t('surveys.rooms.CARTONS')}</div>
            <div style={{ ...CART_GRID, background: 'var(--surface-2)', borderBottom: '2px solid var(--border)' }}>
              <div style={hdrCell()}>Carton</div>
              <div style={hdrCell('center')}>No. Pcs</div>
              <div style={hdrCell('center')}>Cube</div>
              <div style={hdrCell('right')}>Total</div>
            </div>
            {SURVEY_CARTON_ITEMS.map(item => {
              const qty = getQty('CARTONS', item.description)
              const cf  = getCf('CARTONS', item.description)
              const tot = qty * cf
              return (
                <div key={item.description} style={{ ...CART_GRID, opacity: qty === 0 ? 0.45 : 1 }}>
                  <div style={dataCell()}>{item.description}</div>
                  <div style={dataCell('center', { padding: '1px 2px' })}>
                    <input type="number" min="0"
                      value={qtys[sk('CARTONS', item.description)] ?? ''}
                      placeholder="0"
                      onChange={e => setQty('CARTONS', item.description, e.target.value)}
                      style={numInput()}
                    />
                  </div>
                  <div style={dataCell('center', { padding: '1px 2px' })}>
                    <input type="number" min="0" step="0.5"
                      value={cfs[sk('CARTONS', item.description)] ?? item.cfPerItem}
                      onChange={e => setCf('CARTONS', item.description, e.target.value)}
                      style={numInput('var(--surface-2)')}
                    />
                  </div>
                  <div style={dataCell('right', {
                    fontWeight: qty > 0 ? 600 : 400,
                    color: qty > 0 ? 'var(--text)' : 'var(--text-muted)',
                  })}>
                    {tot > 0 ? tot.toFixed(1) : ''}
                  </div>
                </div>
              )
            })}
            <div style={{ ...CART_GRID, background: 'var(--surface-2)', borderTop: '2px solid var(--border)' }}>
              <div style={{ padding: '3px 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', gridColumn: '1 / 4', color: 'var(--text-muted)', letterSpacing: '.04em' }}>
                {t('surveys.totalCartons')}
              </div>
              <div style={{ padding: '3px 6px', fontSize: 12, fontWeight: 700, color: 'var(--primary)', textAlign: 'right' }}>
                {cartonsTotal.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Totals */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', background: 'var(--surface-2)', borderBottom: '2px solid var(--border)', padding: '4px 8px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '.04em' }}>Totals</div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '.04em' }}>Total Cube</div>
            </div>
            {[0, 1, 2, 3].map(idx => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '5px 8px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>{t(`surveys.col${idx + 1}Total`)}</span>
                <strong>{colTotal(idx).toFixed(1)}</strong>
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '5px 8px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('surveys.totalCartons')}</span>
              <strong>{cartonsTotal.toFixed(1)}</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '5px 8px', borderBottom: '2px solid var(--border)', fontSize: 13 }}>
              <strong>Total Cube</strong>
              <strong style={{ color: 'var(--primary)' }}>{grandTotal.toFixed(1)}</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '5px 8px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('surveys.cubeWeightFactor')}</span>
              <strong>{parseFloat(weightFactor) || 6}</strong>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr auto', padding: '8px 10px',
              background: '#1c1c1c', borderRadius: '0 0 8px 8px',
            }}>
              <strong style={{ color: '#fff', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                {t('surveys.estimatedWeight')}
              </strong>
              <strong style={{ color: '#fff', fontSize: 16 }}>
                {estWeight.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} lbs
              </strong>
            </div>
          </div>

        </div>{/* end cartons + totals grid */}

        </div>{/* end printable area */}

        {/*  Notes  */}
        <div className="card card-body" style={{ marginBottom: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('common.notes')}</label>
            <textarea className="form-control" rows={2} value={notes}
              onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        {error && <div style={{ color: 'var(--danger)', marginBottom: 12, fontSize: 13 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginBottom: 32 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? t('common.saving') : isEdit ? t('common.save') : t('surveys.createSurvey')}
          </button>
          <Link to={isEdit ? `/surveys/${id}` : (visitId ? `/visits/${visitId}` : '/visits')} className="btn btn-secondary">
            {t('common.cancel')}
          </Link>
        </div>

      </form>
    </>
  )
}
