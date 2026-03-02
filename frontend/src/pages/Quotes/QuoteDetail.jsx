import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { quoteStatusMeta, visitStatusMeta, formatDate } from '../../constants'
import { useLanguage } from '../../i18n'

function Field({ label, value }) {
  return (
    <div className="form-group" style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: 'var(--text)' }}>{value || '—'}</div>
    </div>
  )
}

export default function QuoteDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [quote, setQuote]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing]   = useState(false)

  const load = () => api.get(`/quotes/${id}`).then(setQuote).catch(() => navigate('/quotes')).finally(() => setLoading(false))
  useEffect(() => { load() }, [id]) // eslint-disable-line

  const setStatus = async (status) => {
    setActing(true)
    await api.put(`/quotes/${id}`, { status })
    await load()
    setActing(false)
  }

  if (loading) return <div className="loading"><div className="spinner" /> {t('common.loading')}</div>
  if (!quote)  return null

  const qm = quoteStatusMeta(quote.status, t)
  const amount = quote.totalAmount != null
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: quote.currency || 'USD' }).format(quote.totalAmount)
    : '—'

  const visit = quote.visit
  const visitName = visit?.client?.name || visit?.prospectName || visit?.visitNumber
  const vm = visit ? visitStatusMeta(visit.status, t) : null

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {quote.quoteNumber}
            <span className="badge" style={{ background: qm.bg, color: qm.color, fontSize: 12 }}>{qm.label}</span>
          </div>
          <div className="page-subtitle">{t('quotes.backSubtitle')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to="/quotes" className="btn btn-secondary">{t('quotes.backToQuotes')}</Link>
          <Link to={`/quotes/${id}/edit`} className="btn btn-secondary">{t('common.edit')}</Link>
        </div>
      </div>

      {/* Status actions */}
      <div className="card card-body" style={{ marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', marginRight: 4 }}>{t('visits.statusSection')}:</span>
        {quote.status === 'DRAFT' && (
          <button className="btn btn-primary btn-sm" disabled={acting} onClick={() => setStatus('SENT')}>
            {t('quotes.markSent')}
          </button>
        )}
        {quote.status === 'SENT' && (
          <>
            <button className="btn btn-primary btn-sm" disabled={acting} onClick={() => setStatus('ACCEPTED')}>
              {t('quotes.accept')}
            </button>
            <button className="btn btn-danger btn-sm" disabled={acting} onClick={() => setStatus('REJECTED')}>
              {t('quotes.reject')}
            </button>
          </>
        )}
        {quote.status === 'ACCEPTED' && !quote.job && (
          <Link to={`/jobs/new?fromQuote=${id}`} className="btn btn-primary btn-sm">{t('quotes.convertToJob')}</Link>
        )}
        {quote.job && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('quotes.jobCreated')}:</span>
            <Link to={`/jobs/${quote.job.id}`} className="btn btn-secondary btn-sm">
              {t('quotes.viewJob')} — {quote.job.jobNumber}
            </Link>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="chart-grid">
        {/* Quote details */}
        <div className="card card-body">
          <div className="section-label" style={{ marginBottom: 12 }}>{t('quotes.quoteDetails')}</div>
          <Field label={t('quotes.totalAmount')} value={amount} />
          <Field label={t('quotes.currency')}    value={quote.currency} />
          <Field label={t('quotes.validUntil')}  value={formatDate(quote.validUntil)} />
          {quote.notes && (
            <div className="form-group">
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 2 }}>{t('common.notes')}</div>
              <p style={{ fontSize: 14, color: 'var(--text)', whiteSpace: 'pre-wrap', margin: 0 }}>{quote.notes}</p>
            </div>
          )}
        </div>

        {/* Linked visit */}
        {visit && (
          <div className="card card-body">
            <div className="section-label" style={{ marginBottom: 12 }}>{t('quotes.fromVisit')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Link to={`/visits/${visit.id}`} style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 15 }}>{visit.visitNumber}</Link>
              {vm && <span className="badge" style={{ background: vm.bg, color: vm.color }}>{vm.label}</span>}
            </div>
            <Field label={t('visits.prospectName')}  value={visitName} />
            <Field label={t('visits.scheduledDate')} value={formatDate(visit.scheduledDate)} />
            <Field label={t('visits.serviceType')}   value={visit.serviceType ? t(`serviceTypes.${visit.serviceType}`) : null} />
            <Field label={t('jobs.route')}
              value={[
                [visit.originCity, visit.originCountry].filter(Boolean).join(', '),
                [visit.destCity, visit.destCountry].filter(Boolean).join(', '),
              ].filter(Boolean).join(' → ')} />
          </div>
        )}
      </div>
    </>
  )
}
