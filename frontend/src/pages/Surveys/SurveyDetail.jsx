import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'
import { formatDate } from '../../constants'

function Field({ label, value }) {
  return (
    <div className="form-group" style={{ marginBottom: 12 }}>
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
  const oa         = visit?.originAgent?.name
  const da         = visit?.destAgent?.name

  // Group items by room
  const grouped = {}
  for (const item of survey.items) {
    if (!grouped[item.room]) grouped[item.room] = []
    grouped[item.room].push(item)
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
          {visit && (
            <Link to={`/visits/${visit.id}`} className="btn btn-secondary">{t('surveys.backToVisit')}</Link>
          )}
          <Link to={`/surveys/${id}/edit`} className="btn btn-secondary">{t('common.edit')}</Link>
          <button className="btn btn-danger" onClick={handleDelete}>{t('common.delete')}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }} className="chart-grid">
        {/* Survey Info */}
        <div className="card card-body">
          <div className="section-label" style={{ marginBottom: 12 }}>{t('surveys.surveyInfo')}</div>
          <Field label={t('surveys.surveyNumber')} value={survey.surveyNumber} />
          <Field label={t('surveys.surveyDate')}   value={formatDate(survey.surveyDate)} />
          <Field label={t('surveys.surveyorName')} value={survey.surveyorName} />
          <Field label={t('surveys.totalCf')}      value={survey.totalCf != null ? `${survey.totalCf.toFixed(1)} CF` : null} />
          {visit && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 4 }}>{t('surveys.linkedVisit')}</div>
              <Link to={`/visits/${visit.id}`} style={{ fontSize: 14, color: 'var(--primary)' }}>{visit.visitNumber}</Link>
            </div>
          )}
        </div>

        {/* Client Info */}
        <div className="card card-body">
          <div className="section-label" style={{ marginBottom: 12 }}>{t('surveys.clientInfo')}</div>
          <Field label={t('surveys.clientName')}  value={clientName} />
          <Field label={t('surveys.phone')}        value={phone} />
          <Field label={t('surveys.origin')}       value={origin} />
          <Field label={t('surveys.destination')}  value={dest} />
          <Field label={t('surveys.oa')}           value={oa} />
          <Field label={t('surveys.da')}           value={da} />
        </div>
      </div>

      {/* Item Inventory */}
      <div className="card card-body" style={{ marginBottom: 16 }}>
        <div className="section-label" style={{ marginBottom: 16 }}>{t('surveys.itemInventory')}</div>

        {Object.keys(grouped).length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('surveys.noItems')}</p>
        ) : (
          Object.entries(grouped).map(([room, roomItems]) => {
            const roomTotal = roomItems.reduce((s, i) => s + (i.totalCf || 0), 0)
            return (
              <div key={room} style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, padding: '4px 12px', background: 'var(--surface-2)', borderRadius: 6 }}>
                    {t(`surveys.rooms.${room}`)}
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {roomTotal.toFixed(1)} CF
                  </span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                        {t('surveys.description')}
                      </th>
                      <th style={{ textAlign: 'center', padding: '6px 8px', width: 70, fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                        {t('surveys.qty')}
                      </th>
                      <th style={{ textAlign: 'center', padding: '6px 8px', width: 110, fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                        {t('surveys.cfPerItem')}
                      </th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', width: 100, fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                        {t('surveys.totalCfCol')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomItems.map(item => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '6px 8px' }}>{item.description || '—'}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>{item.qty}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>{item.cfPerItem.toFixed(1)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>
                          {(item.totalCf || 0).toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })
        )}

        {/* Grand Total */}
        {Object.keys(grouped).length > 0 && (
          <div style={{ marginTop: 8, padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid var(--border)' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{t('surveys.grandTotal')}</span>
            <span style={{ fontWeight: 700, fontSize: 22, color: 'var(--primary)' }}>
              {(survey.totalCf || 0).toFixed(1)} CF
            </span>
          </div>
        )}
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
