import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom'
import { api } from '../../api'
import { CURRENCIES } from '../../constants'
import { useLanguage } from '../../i18n'

const daysFromNow = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

const EMPTY = {
  visitId: '',
  status: 'DRAFT',
  totalAmount: '',
  currency: 'USD',
  validUntil: '',
  notes: '',
}

export default function QuoteForm() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const { t } = useLanguage()

  const [form, setForm]       = useState({ ...EMPTY, visitId: searchParams.get('visitId') || '', validUntil: daysFromNow(30) })
  const [visit, setVisit]     = useState(null)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)
  const errorRef = useRef(null)

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [error])

  // Load existing quote for edit, or load visit for "new from visitId"
  useEffect(() => {
    if (isEdit) {
      api.get(`/quotes/${id}`).then(q => {
        setForm({
          visitId:     q.visitId,
          status:      q.status,
          totalAmount: q.totalAmount ?? '',
          currency:    q.currency || 'USD',
          validUntil:  q.validUntil ? new Date(q.validUntil).toISOString().slice(0, 10) : '',
          notes:       q.notes || '',
        })
        if (q.visit) setVisit(q.visit)
      }).catch(e => setError(e.message)).finally(() => setLoading(false))
    } else if (form.visitId) {
      api.get(`/visits/${form.visitId}`).then(setVisit).catch(() => {})
    }
  }, [id]) // eslint-disable-line

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const handleSubmit = async e => {
    e.preventDefault()
    setSaving(true); setError(null)
    if (!form.visitId) { setError('visitId is required'); setSaving(false); return }
    try {
      const payload = {
        ...form,
        totalAmount: form.totalAmount !== '' ? parseFloat(form.totalAmount) : null,
        validUntil: form.validUntil || null,
      }
      if (isEdit) {
        await api.put(`/quotes/${id}`, payload)
        navigate(`/quotes/${id}`)
      } else {
        const created = await api.post('/quotes', payload)
        navigate(`/quotes/${created.id}`)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading"><div className="spinner" /> {t('common.loading')}</div>

  const visitName = visit?.client?.name || visit?.prospectName || visit?.visitNumber || form.visitId

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{isEdit ? t('quotes.editQuote') : t('quotes.newQuoteTitle')}</div>
          <div className="page-subtitle">{isEdit ? t('quotes.backSubtitle') : t('quotes.autoAssigned')}</div>
        </div>
        <Link to={isEdit ? `/quotes/${id}` : (form.visitId ? `/visits/${form.visitId}` : '/quotes')} className="btn btn-secondary">{t('common.cancel')}</Link>
      </div>

      {error && <div ref={errorRef} className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="card card-body" style={{ marginBottom: 16 }}>
          <div className="section-label">{t('quotes.quoteDetails')}</div>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-muted)' }}>{t('common.allFieldsOptional')}</p>

          {/* Linked visit — readonly */}
          <div className="form-group">
            <label className="form-label">{t('quotes.linkedVisit')}</label>
            {visit
              ? <div style={{ padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 8, fontSize: 14 }}>
                  <Link to={`/visits/${visit.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>{visit.visitNumber}</Link>
                  {visitName !== visit.visitNumber && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>— {visitName}</span>}
                </div>
              : <input className="form-control" value={form.visitId} readOnly placeholder="Visit ID" />
            }
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">{t('quotes.totalAmount')}</label>
              <input
                type="number" min="0" step="0.01" className="form-control"
                value={form.totalAmount} onChange={e => set('totalAmount', e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('quotes.currency')}</label>
              <select className="form-control" value={form.currency} onChange={e => set('currency', e.target.value)}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('quotes.validUntil')}</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="date" className="form-control" style={{ flex: 1, minWidth: 140 }}
                  value={form.validUntil} onChange={e => set('validUntil', e.target.value)}
                />
                {[30, 60, 90].map(n => (
                  <button
                    key={n} type="button"
                    className={`btn btn-sm${form.validUntil === daysFromNow(n) ? ' btn-primary' : ' btn-secondary'}`}
                    style={{ whiteSpace: 'nowrap' }}
                    onClick={() => set('validUntil', daysFromNow(n))}
                  >+{n}d</button>
                ))}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('common.notes')}</label>
            <textarea
              className="form-control" rows={4}
              value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder={t('quotes.notesPlaceholder')}
            />
          </div>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? t('common.saving') : isEdit ? t('common.save') : t('quotes.createQuote')}
          </button>
          <Link to={isEdit ? `/quotes/${id}` : (form.visitId ? `/visits/${form.visitId}` : '/quotes')} className="btn btn-secondary">{t('common.cancel')}</Link>
        </div>
      </form>
    </>
  )
}
