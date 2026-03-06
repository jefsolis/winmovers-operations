import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { visitStatusMeta, quoteStatusMeta, formatDate, formatDateTime } from '../../constants'
import { useLanguage } from '../../i18n'
import QuickCreateClientModal from '../../components/QuickCreateClientModal'

function Field({ label, value }) {
  return (
    <div className="form-group" style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: 'var(--text)' }}>{value || '—'}</div>
    </div>
  )
}

export default function VisitDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [visit, setVisit]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing]   = useState(false)
  const [showCreateClient, setShowCreateClient] = useState(false)

  const load = () => api.get(`/visits/${id}`).then(setVisit).catch(() => navigate('/visits')).finally(() => setLoading(false))
  useEffect(() => { load() }, [id]) // eslint-disable-line

  const setStatus = async (status) => {
    setActing(true)
    await api.put(`/visits/${id}`, { ...visit, status })
    await load()
    setActing(false)
  }

  const handleClientCreated = async (newClient) => {
    await api.put(`/visits/${id}`, {
      status:            visit.status,
      clientId:          newClient.id,
      corporateClientId: visit.corporateClientId,
      assignedToId:      visit.assignedToId,
      prospectName:      visit.prospectName,
      prospectPhone:     visit.prospectPhone,
      prospectEmail:     visit.prospectEmail,
      originAddress:     visit.originAddress,
      originCity:        visit.originCity,
      originCountry:     visit.originCountry,
      destAddress:       visit.destAddress,
      destCity:          visit.destCity,
      destCountry:       visit.destCountry,
      serviceType:       visit.serviceType,
      scheduledDate:     visit.scheduledDate,
      observations:      visit.observations,
      language:          visit.language,
    })
    setShowCreateClient(false)
    await load()
  }

  if (loading) return <div className="loading"><div className="spinner" /> {t('common.loading')}</div>
  if (!visit)  return null

  const sm = visitStatusMeta(visit.status, t)
  const clientName = visit.client?.name
    || (visit.contact ? `${visit.contact.firstName} ${visit.contact.lastName}` : null)
    || visit.prospectName

  const downloadIcs = () => {
    const pad = n => String(n).padStart(2, '0')
    const toIcsDate = (d) => {
      const dt = new Date(d)
      // Floating time (no Z) — preserves the wall-clock time the user entered
      return [
        dt.getFullYear(),
        pad(dt.getMonth() + 1),
        pad(dt.getDate()),
        'T',
        pad(dt.getHours()),
        pad(dt.getMinutes()),
        pad(dt.getSeconds()),
      ].join('')
    }
    const escape = s => (s || '').replace(/[\\;,]/g, c => '\\' + c).replace(/\n/g, '\\n')
    const fold = (line) => {
      const chunks = []
      while (line.length > 75) { chunks.push(line.slice(0, 75)); line = ' ' + line.slice(75) }
      chunks.push(line)
      return chunks.join('\r\n')
    }

    const start = visit.scheduledDate ? new Date(visit.scheduledDate) : new Date()
    const end   = new Date(start.getTime() + 90 * 60 * 1000) // +90 min
    const now   = new Date()

    const location = [
      visit.originAddress,
      visit.originCity,
      visit.originCountry,
    ].filter(Boolean).join(', ')

    const descParts = [
      clientName          ? `${t('visits.prospectName')}: ${clientName}` : null,
      visit.prospectPhone ? `${t('visits.prospectPhone')}: ${visit.prospectPhone}` : null,
      visit.prospectEmail ? `${t('visits.prospectEmail')}: ${visit.prospectEmail}` : null,
      visit.serviceType   ? `${t('visits.serviceType')}: ${t(`serviceTypes.${visit.serviceType}`)}` : null,
      location            ? `${t('visits.originInfo')}: ${location}` : null,
      (visit.destCity || visit.destCountry) ? `${t('visits.destInfo')}: ${[visit.destCity, visit.destCountry].filter(Boolean).join(', ')}` : null,
      visit.assignedTo    ? `${t('visits.assignedTo')}: ${visit.assignedTo.name}` : null,
      visit.observations  ? `${t('visits.observations')}: ${visit.observations}` : null,
    ].filter(x => x !== null).join('\n')

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//WinMovers//Operations//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      fold(`UID:${visit.id}@winmovers-operations`),
      fold(`DTSTAMP:${toIcsDate(now)}`),
      fold(`DTSTART:${toIcsDate(start)}`),
      fold(`DTEND:${toIcsDate(end)}`),
      fold(`SUMMARY:${escape(`${visit.visitNumber} \u2013 ${clientName || 'Visit'}`)}`),
      fold(`DESCRIPTION:${escape(descParts)}`),
      location ? fold(`LOCATION:${escape(location)}`) : null,
      visit.assignedTo?.email ? fold(`ATTENDEE;CN=${escape(visit.assignedTo.name)}:mailto:${visit.assignedTo.email}`) : null,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n')

    const blob = new Blob([lines], { type: 'text/calendar;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${visit.visitNumber}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {visit.visitNumber}
            <span className="badge" style={{ background: sm.bg, color: sm.color, fontSize: 12 }}>{sm.label}</span>
          </div>
          <div className="page-subtitle">{t('visits.backSubtitle')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to="/visits" className="btn btn-secondary">{t('visits.backToVisits')}</Link>
          <Link to={`/visits/${id}/edit`} className="btn btn-secondary">{t('common.edit')}</Link>
          {visit.scheduledDate && (
            <button className="btn btn-secondary" onClick={downloadIcs}>📅 {t('visits.downloadIcs')}</button>
          )}
        </div>
      </div>

      {/* Status actions */}
      <div className="card card-body" style={{ marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', marginRight: 4 }}>{t('visits.statusSection')}:</span>
        {visit.status === 'SCHEDULED' && (
          <button className="btn btn-primary btn-sm" disabled={acting} onClick={() => setStatus('COMPLETED')}>
            {t('visits.markCompleted')}
          </button>
        )}
        {visit.status === 'COMPLETED' && visit.quotes.length === 0 && (
          <Link to={`/quotes/new?visitId=${id}`} className="btn btn-primary btn-sm">{t('visits.createQuote')}</Link>
        )}
        {(visit.status === 'QUOTED' || visit.status === 'CLOSED') && visit.quotes.length > 0 && (
          <Link to={`/quotes/${visit.quotes[0].id}`} className="btn btn-primary btn-sm">{t('visits.viewQuote')}</Link>
        )}
        {(visit.status === 'SCHEDULED' || visit.status === 'COMPLETED') && (
          <button className="btn btn-danger btn-sm" disabled={acting} onClick={() => setStatus('CLOSED')}>
            {t('visits.closeLost')}
          </button>
        )}
        {!visit.clientId && (
          <button className="btn btn-secondary btn-sm" onClick={() => setShowCreateClient(true)}>
            {t('visits.createClientFromProspect')}
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="chart-grid">
        {/* Prospect / Client info */}
        <div className="card card-body">
          <div className="section-label" style={{ marginBottom: 12 }}>{t('visits.prospectInfo')}</div>
          <Field label={t('visits.prospectName')}  value={clientName} />
          <Field label={t('visits.prospectPhone')} value={visit.prospectPhone || visit.contact?.phone || visit.client?.phone} />
          <Field label={t('visits.prospectEmail')} value={visit.prospectEmail || visit.contact?.email || visit.client?.email} />
          {visit.corporateClient && (
            <Field label={t('visits.companyClient')} value={visit.corporateClient.name} />
          )}          {visit.client && (
            <div style={{ marginTop: 8 }}>
              <Link to={`/clients/${visit.client.id}/edit`} className="btn btn-secondary btn-sm">{t('clients.editClient')}</Link>
            </div>
          )}
        </div>

        {/* Visit info */}
        <div className="card card-body">
          <div className="section-label" style={{ marginBottom: 12 }}>{t('visits.visitNumber')}</div>
          <Field label={t('visits.scheduledDate')} value={formatDateTime(visit.scheduledDate)} />
          <Field label={t('visits.serviceType')}   value={visit.serviceType ? t(`serviceTypes.${visit.serviceType}`) : null} />
          <Field
            label={t('visits.assignedTo')}
            value={visit.assignedTo
              ? <span>{visit.assignedTo.name}<span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 6 }}>{visit.assignedTo.email}</span></span>
              : t('visits.unassigned')
            }
          />
        </div>

        {/* Origin */}
        <div className="card card-body">
          <div className="section-label" style={{ marginBottom: 12 }}>{t('visits.originInfo')}</div>
          <Field label={t('visits.originAddress')} value={visit.originAddress} />
          <Field label={t('jobs.originCity')}      value={visit.originCity} />
          <Field label={t('jobs.originCountry')}   value={visit.originCountry} />
        </div>

        {/* Destination */}
        <div className="card card-body">
          <div className="section-label" style={{ marginBottom: 12 }}>{t('visits.destInfo')}</div>
          <Field label={t('visits.destAddress')} value={visit.destAddress} />
          <Field label={t('jobs.destCity')}      value={visit.destCity} />
          <Field label={t('jobs.destCountry')}   value={visit.destCountry} />
        </div>
      </div>

      {/* Observations */}
      {visit.observations && (
        <div className="card card-body" style={{ marginTop: 16 }}>
          <div className="section-label" style={{ marginBottom: 8 }}>{t('visits.observations')}</div>
          <p style={{ fontSize: 14, color: 'var(--text)', whiteSpace: 'pre-wrap', margin: 0 }}>{visit.observations}</p>
        </div>
      )}

      {/* Quotes */}
      <div className="card card-body" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="section-label">{t('visits.quotes')}</div>
          {visit.status === 'COMPLETED' && (
            <Link to={`/quotes/new?visitId=${id}`} className="btn btn-primary btn-sm">{t('visits.createQuote')}</Link>
          )}
        </div>
        {visit.quotes.length === 0
          ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('visits.noQuotes')}</p>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visit.quotes.map(q => {
                const qm = quoteStatusMeta(q.status, t)
                return (
                  <div key={q.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <strong style={{ fontSize: 14 }}>{q.quoteNumber}</strong>
                      <span className="badge" style={{ background: qm.bg, color: qm.color }}>{qm.label}</span>
                      {q.job && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>→ {q.job.jobNumber}</span>}
                    </div>
                    <Link to={`/quotes/${q.id}`} className="btn btn-secondary btn-sm">{t('visits.viewQuote')}</Link>
                  </div>
                )
              })}
            </div>
        }
      </div>
      <QuickCreateClientModal
        open={showCreateClient}
        onClose={() => setShowCreateClient(false)}
        initialName={visit.prospectName || ''}
        initialPhone={visit.prospectPhone || ''}
        initialEmail={visit.prospectEmail || ''}
        onCreated={handleClientCreated}
      />
    </>
  )
}
