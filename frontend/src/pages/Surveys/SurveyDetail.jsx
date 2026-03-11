import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'
import { formatDate, SURVEY_ROOM_ITEMS, SURVEY_CARTON_ITEMS, SURVEY_COLUMN_ROOMS } from '../../constants'

const ALL_ROOMS = Object.keys(SURVEY_ROOM_ITEMS)

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
  const itemsTotal   = ALL_ROOMS.reduce((s, r) => s + roomTotal(r) + roomCustomTotal(r), 0)
  const grandTotal   = itemsTotal + cartonsTotal
  const weightFactor = survey.cubeWeightFactor ?? 6
  const estWeight    = grandTotal * weightFactor

  const cellStyle = { padding: '4px 8px', borderBottom: '1px solid var(--border)', fontSize: 13 }
  const thStyle   = (align = 'left', w) => ({ textAlign: align, padding: '5px 8px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', width: w, borderBottom: '2px solid var(--border)' })

  const renderRoomTable = (room) => {
    const master = room === 'CARTONS' ? SURVEY_CARTON_ITEMS : (SURVEY_ROOM_ITEMS[room] || [])
    const filledItems = master.filter(i => (itemMap[room]?.[i.description]?.qty || 0) > 0)
    // Custom items not in master
    const masterDescs = new Set(master.map(i => i.description))
    const customItems = Object.values(itemMap[room] || {}).filter(i => !masterDescs.has(i.description) && (i.qty || 0) > 0)

    if (filledItems.length === 0 && customItems.length === 0) return null

    const rTotal = (room === 'CARTONS' ? cartonsTotal : roomTotal(room) + roomCustomTotal(room))

    return (
      <div key={room} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 13, padding: '3px 10px', background: 'var(--surface-2)', borderRadius: 6 }}>
            {t(`surveys.rooms.${room}`)}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>{rTotal.toFixed(1)} CF</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle('left')}>{t('surveys.article')}</th>
              <th style={thStyle('center', 80)}>{t('surveys.qty')}</th>
              <th style={thStyle('center', 80)}>{t('surveys.cfPerItem')}</th>
              <th style={thStyle('right', 90)}>{t('surveys.totalCfCol')}</th>
            </tr>
          </thead>
          <tbody>
            {filledItems.map(masterItem => {
              const saved = itemMap[room][masterItem.description]
              return (
                <tr key={masterItem.description}>
                  <td style={cellStyle}>{masterItem.description}</td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{saved.qty}</td>
                  <td style={{ ...cellStyle, textAlign: 'center', color: 'var(--text-muted)' }}>{saved.cfPerItem.toFixed(1)}</td>
                  <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 600 }}>{(saved.totalCf || 0).toFixed(1)}</td>
                </tr>
              )
            })}
            {customItems.map(item => (
              <tr key={item.description}>
                <td style={cellStyle}>{item.description}</td>
                <td style={{ ...cellStyle, textAlign: 'center' }}>{item.qty}</td>
                <td style={{ ...cellStyle, textAlign: 'center', color: 'var(--text-muted)' }}>{item.cfPerItem.toFixed(1)}</td>
                <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 600 }}>{(item.totalCf || 0).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

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

      {/* Item Inventory */}
      <div className="card card-body" style={{ marginBottom: 16 }}>
        <div className="section-label" style={{ marginBottom: 16 }}>{t('surveys.itemInventory')}</div>
        {survey.items.length === 0
          ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('surveys.noItems')}</p>
          : (
            <>
              {ALL_ROOMS.map(room => renderRoomTable(room))}
              {renderRoomTable('CARTONS')}
            </>
          )
        }
      </div>

      {/* Totals */}
      <div className="card card-body" style={{ marginBottom: 16 }}>
        <div className="section-label" style={{ marginBottom: 12 }}>{t('surveys.totalsSection')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 13, maxWidth: 360 }}>
          {[0, 1, 2, 3].map(idx => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t(`surveys.col${idx + 1}Total`)}</span>
              <strong>{colTotal(idx).toFixed(1)}</strong>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('surveys.totalCartons')}</span>
            <strong>{cartonsTotal.toFixed(1)}</strong>
          </div>
          <div />
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '2px solid var(--border)', gridColumn: '1 / -1' }}>
            <strong>{t('surveys.grandTotal')}</strong>
            <strong style={{ color: 'var(--primary)', fontSize: 15 }}>{grandTotal.toFixed(1)} CF</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', gridColumn: '1 / -1' }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('surveys.cubeWeightFactor')}</span>
            <strong>{weightFactor}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: 'var(--surface-2)', gridColumn: '1 / -1', marginTop: 4 }}>
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
