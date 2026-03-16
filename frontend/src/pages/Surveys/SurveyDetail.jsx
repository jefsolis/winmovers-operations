import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'
import { formatDate, SURVEY_ROOM_ITEMS, SURVEY_CARTON_ITEMS, SURVEY_COLUMN_ROOMS } from '../../constants'

function Field({ label, value }) {
  return (
    <div className="form-group" style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: 'var(--text)' }}>{value || '—'}</div>
    </div>
  )
}

export default function SurveyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [survey, setSurvey] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/surveys/${id}`)
      .then(setSurvey)
      .catch(() => navigate('/visits'))
      .finally(() => setLoading(false))
  }, [id]) // eslint-disable-line

  const handleDelete = async () => {
    if (!window.confirm(t('surveys.deleteConfirm', { num: survey.surveyNumber }))) return
    await api.delete(`/surveys/${id}`)
    navigate(`/visits/${survey.visitId}`)
  }

  if (loading) return <div className="loading"><div className="spinner" /> {t('common.loading')}</div>
  if (!survey) return null

  const visit = survey.visit
  const clientName = visit?.client?.name || visit?.corporateClient?.name || visit?.prospectName
  const phone      = visit?.prospectPhone || visit?.client?.phone
  const origin     = [visit?.originAddress, visit?.originCity, visit?.originCountry].filter(Boolean).join(', ')
  const dest       = [visit?.destCity, visit?.destCountry].filter(Boolean).join(', ')

  // Build a fast lookup: room → description → item
  const itemMap = {}
  for (const item of survey.items) {
    if (!itemMap[item.room]) itemMap[item.room] = {}
    itemMap[item.room][item.description] = item
  }

  // Totals
  const roomTotal = (room) => {
    const master = room === 'CARTONS' ? SURVEY_CARTON_ITEMS : (SURVEY_ROOM_ITEMS[room] || [])
    return master.reduce((s, i) => {
      const saved = itemMap[room]?.[i.description]
      return s + (saved ? saved.totalCf || 0 : 0)
    }, 0)
  }
  // Also count any custom items saved (not in master list)
  const roomCustomTotal = (room) => {
    if (!itemMap[room]) return 0
    const masterDescs = new Set((room === 'CARTONS' ? SURVEY_CARTON_ITEMS : SURVEY_ROOM_ITEMS[room] || []).map(i => i.description))
    return Object.values(itemMap[room]).filter(i => !masterDescs.has(i.description)).reduce((s, i) => s + (i.totalCf || 0), 0)
  }

  const colTotal = (idx) => SURVEY_COLUMN_ROOMS[idx].reduce((s, r) => s + roomTotal(r) + roomCustomTotal(r), 0)
  const cartonsTotal = roomTotal('CARTONS') + roomCustomTotal('CARTONS')
  const ALL_ROOMS    = Object.keys(SURVEY_ROOM_ITEMS)
  const itemsTotal   = ALL_ROOMS.reduce((s, r) => s + roomTotal(r) + roomCustomTotal(r), 0)
  const grandTotal   = itemsTotal + cartonsTotal
  const weightFactor = survey.cubeWeightFactor ?? 6
  const estWeight    = grandTotal * weightFactor

  // Grid layout styles (mirrors SurveyForm)
  const COL_GRID  = { display: 'grid', gridTemplateColumns: '1fr 46px 46px 54px' }
  const CART_GRID = { display: 'grid', gridTemplateColumns: '1fr 54px 54px 62px' }
  const roomHdr   = { background: '#1c1c1c', color: '#fff', padding: '3px 6px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }
  const hdrCell   = (align = 'left') => ({ padding: '4px 6px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-muted)', textAlign: align, borderBottom: '1px solid var(--border)' })
  const dataCell  = (align = 'left', extra = {}) => ({ padding: '3px 6px', fontSize: 12, textAlign: align, borderBottom: '1px solid var(--border)', ...extra })

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">{survey.surveyNumber}</div>
          <div className="page-subtitle">{t('surveys.title')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {visit && <Link to={`/visits/${visit.id}`} className="btn btn-secondary">{t('surveys.backToVisit')}</Link>}
          <Link to={`/surveys/${id}/edit`} className="btn btn-secondary">{t('common.edit')}</Link>
          <button className="btn btn-danger" onClick={handleDelete}>{t('common.delete')}</button>
        </div>
      </div>

      {/* Info cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }} className="chart-grid">
        <div className="card card-body">
          <div className="section-label" style={{ marginBottom: 12 }}>{t('surveys.surveyInfo')}</div>
          <Field label={t('surveys.surveyNumber')} value={survey.surveyNumber} />
          <Field label={t('surveys.surveyDate')}   value={formatDate(survey.surveyDate)} />
          <Field label={t('surveys.surveyorName')} value={survey.surveyorName} />
          {visit && (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 2 }}>{t('surveys.linkedVisit')}</div>
              <Link to={`/visits/${visit.id}`} style={{ fontSize: 14, color: 'var(--primary)' }}>{visit.visitNumber}</Link>
            </div>
          )}
        </div>
        <div className="card card-body">
          <div className="section-label" style={{ marginBottom: 12 }}>{t('surveys.clientInfo')}</div>
          <Field label={t('surveys.clientName')}  value={clientName} />
          <Field label={t('surveys.phone')}        value={phone} />
          <Field label={t('surveys.origin')}       value={origin} />
          <Field label={t('surveys.destination')}  value={dest} />
        </div>
      </div>

      {/* Item Inventory — 4-column grid matching SurveyForm layout */}
      <div className="card card-body" style={{ padding: '12px 12px 0', marginBottom: 16, overflow: 'hidden' }}>
        <div className="section-label" style={{ marginBottom: 12 }}>{t('surveys.itemInventory')}</div>
        {survey.items.length === 0
          ? <p style={{ fontSize: 13, color: 'var(--text-muted)', paddingBottom: 12 }}>{t('surveys.noItems')}</p>
          : (
            <>
              {/* 4-column room grid */}
              <div style={{ overflowX: 'auto', marginBottom: 12 }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(4, minmax(200px, 1fr))',
                  border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', minWidth: 800,
                }}>
                  {SURVEY_COLUMN_ROOMS.map((colRooms, colIdx) => (
                    <div key={colIdx} style={{ borderRight: colIdx < 3 ? '1px solid var(--border)' : 'none' }}>
                      {/* Sub-header */}
                      <div style={{ ...COL_GRID, background: 'var(--surface-2)', borderBottom: '2px solid var(--border)' }}>
                        <div style={hdrCell()}>{t('surveys.article')}</div>
                        <div style={hdrCell('center')}>{t('surveys.qty')}</div>
                        <div style={hdrCell('center')}>{t('surveys.cfPerItem')}</div>
                        <div style={hdrCell('right')}>{t('surveys.totalCfCol')}</div>
                      </div>
                      {/* Rooms */}
                      {colRooms.map(room => {
                        const masterDescs = new Set(SURVEY_ROOM_ITEMS[room].map(i => i.description))
                        const customItems = Object.values(itemMap[room] || {}).filter(i => !masterDescs.has(i.description))
                        return (
                          <div key={room}>
                            <div style={roomHdr}>{t(`surveys.rooms.${room}`)}</div>
                            {SURVEY_ROOM_ITEMS[room].map(item => {
                              const saved = itemMap[room]?.[item.description]
                              const qty = saved?.qty || 0
                              const cf  = saved?.cfPerItem ?? item.cfPerItem
                              const tot = qty * cf
                              return (
                                <div key={item.description} style={{ ...COL_GRID, opacity: qty === 0 ? 0.45 : 1 }}>
                                  <div style={dataCell()}>{item.description}</div>
                                  <div style={dataCell('center')}>{qty || ''}</div>
                                  <div style={dataCell('center', { color: 'var(--text-muted)' })}>{cf.toFixed(1)}</div>
                                  <div style={dataCell('right', { fontWeight: qty > 0 ? 600 : 400, color: qty > 0 ? 'var(--text)' : 'var(--text-muted)' })}>
                                    {tot > 0 ? tot.toFixed(1) : ''}
                                  </div>
                                </div>
                              )
                            })}
                            {customItems.map(item => {
                              const qty = item.qty || 0
                              return (
                                <div key={item.description} style={{ ...COL_GRID, opacity: qty === 0 ? 0.45 : 1 }}>
                                  <div style={dataCell()}>{item.description}</div>
                                  <div style={dataCell('center')}>{qty || ''}</div>
                                  <div style={dataCell('center', { color: 'var(--text-muted)' })}>{(item.cfPerItem || 0).toFixed(1)}</div>
                                  <div style={dataCell('right', { fontWeight: qty > 0 ? 600 : 400 })}>
                                    {(item.totalCf || 0) > 0 ? (item.totalCf || 0).toFixed(1) : ''}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                      {/* Column total */}
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

              {/* Cartons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12, alignItems: 'start' }}>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={roomHdr}>{t('surveys.rooms.CARTONS')}</div>
                  <div style={{ ...CART_GRID, background: 'var(--surface-2)', borderBottom: '2px solid var(--border)' }}>
                    <div style={hdrCell()}>{t('surveys.article')}</div>
                    <div style={hdrCell('center')}>{t('surveys.qty')}</div>
                    <div style={hdrCell('center')}>{t('surveys.cfPerItem')}</div>
                    <div style={hdrCell('right')}>{t('surveys.totalCfCol')}</div>
                  </div>
                  {SURVEY_CARTON_ITEMS.map(item => {
                    const saved = itemMap['CARTONS']?.[item.description]
                    const qty = saved?.qty || 0
                    const cf  = saved?.cfPerItem ?? item.cfPerItem
                    const tot = qty * cf
                    return (
                      <div key={item.description} style={{ ...CART_GRID, opacity: qty === 0 ? 0.45 : 1 }}>
                        <div style={dataCell()}>{item.description}</div>
                        <div style={dataCell('center')}>{qty || ''}</div>
                        <div style={dataCell('center', { color: 'var(--text-muted)' })}>{cf.toFixed(1)}</div>
                        <div style={dataCell('right', { fontWeight: qty > 0 ? 600 : 400 })}>
                          {tot > 0 ? tot.toFixed(1) : ''}
                        </div>
                      </div>
                    )
                  })}
                  {/* carton total */}
                  <div style={{ ...CART_GRID, background: 'var(--surface-2)', borderTop: '2px solid var(--border)' }}>
                    <div style={{ padding: '3px 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', gridColumn: '1 / 4', color: 'var(--text-muted)', letterSpacing: '.04em' }}>
                      {t('surveys.totalCartons')}
                    </div>
                    <div style={{ padding: '3px 6px', fontSize: 12, fontWeight: 700, color: 'var(--primary)', textAlign: 'right' }}>
                      {cartonsTotal.toFixed(1)}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )
        }
      </div>

      {/* Totals summary */}
      <div className="card card-body" style={{ marginBottom: 16 }}>
        <div className="section-label" style={{ marginBottom: 12 }}>{t('surveys.totalsSection')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, maxWidth: 360 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '2px solid var(--border)' }}>
            <strong>{t('surveys.grandTotal')}</strong>
            <strong style={{ color: 'var(--primary)', fontSize: 15 }}>{grandTotal.toFixed(1)} CF</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('surveys.cubeWeightFactor')}</span>
            <strong>{weightFactor}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: 'var(--surface-2)', marginTop: 4 }}>
            <strong style={{ fontSize: 14 }}>{t('surveys.estimatedWeight')}</strong>
            <strong style={{ fontSize: 16, color: 'var(--primary)' }}>{estWeight.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} lbs</strong>
          </div>
        </div>
      </div>

      {/* Notes */}
      {survey.notes && (
        <div className="card card-body">
          <div className="section-label" style={{ marginBottom: 8 }}>{t('common.notes')}</div>
          <p style={{ fontSize: 14, color: 'var(--text)', whiteSpace: 'pre-wrap', margin: 0 }}>{survey.notes}</p>
        </div>
      )}
    </>
  )
}
