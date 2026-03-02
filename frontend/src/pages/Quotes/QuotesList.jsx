import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { quoteStatusMeta, getQuoteStatuses, formatDate } from '../../constants'
import { useLanguage } from '../../i18n'

export default function QuotesList() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const QUOTE_STATUSES = getQuoteStatuses(t)

  const [quotes, setQuotes]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState('')

  const load = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    api.get(`/quotes?${params}`).then(data => {
      const filtered = search
        ? data.filter(q =>
            q.quoteNumber.toLowerCase().includes(search.toLowerCase()) ||
            q.visit?.visitNumber?.toLowerCase().includes(search.toLowerCase()) ||
            q.visit?.prospectName?.toLowerCase().includes(search.toLowerCase()) ||
            q.visit?.client?.name?.toLowerCase().includes(search.toLowerCase())
          )
        : data
      setQuotes(filtered)
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [statusFilter]) // eslint-disable-line
  const handleSearch = e => { e.preventDefault(); load() }

  const handleDelete = async (q) => {
    if (!window.confirm(t('quotes.deleteConfirm', { num: q.quoteNumber }))) return
    await api.delete(`/quotes/${q.id}`)
    setQuotes(prev => prev.filter(x => x.id !== q.id))
  }

  const clientName = (q) => {
    if (q.visit?.client?.name) return q.visit.client.name
    if (q.visit?.prospectName) return q.visit.prospectName
    return '—'
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{t('quotes.title')}</div>
          <div className="page-subtitle">{t('quotes.subtitle')}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card card-body" style={{ marginBottom: 16 }}>
        <div className="toolbar">
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, flex: 1 }}>
            <input
              className="form-control search-input"
              placeholder={t('quotes.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary">{t('common.search')}</button>
          </form>
          <select className="form-control" style={{ width: 170 }} value={statusFilter} onChange={e => setStatus(e.target.value)}>
            <option value="">{t('quotes.allStatuses')}</option>
            {QUOTE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {loading
        ? <div className="loading"><div className="spinner" /> {t('common.loading')}</div>
        : quotes.length === 0
          ? <div className="empty-state">
              <div className="empty-state-icon">💬</div>
              <div className="empty-state-title">{t('quotes.empty')}</div>
              <div className="empty-state-desc">{t('quotes.emptyHint')}</div>
            </div>
          : <div className="card">
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>{t('quotes.quoteNumber')}</th>
                      <th>{t('quotes.linkedVisit')}</th>
                      <th>{t('visits.prospectName')}</th>
                      <th>{t('quotes.totalAmount')}</th>
                      <th>{t('quotes.validUntil')}</th>
                      <th>{t('jobs.status')}</th>
                      <th>{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.map(q => {
                      const m = quoteStatusMeta(q.status, t)
                      const amount = q.totalAmount != null
                        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: q.currency || 'USD' }).format(q.totalAmount)
                        : '—'
                      return (
                        <tr key={q.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/quotes/${q.id}`)}>
                          <td><strong>{q.quoteNumber}</strong></td>
                          <td>
                            {q.visit && (
                              <Link to={`/visits/${q.visit.id}`} onClick={e => e.stopPropagation()} style={{ color: 'var(--primary)' }}>
                                {q.visit.visitNumber}
                              </Link>
                            )}
                          </td>
                          <td>{clientName(q)}</td>
                          <td>{amount}</td>
                          <td>{formatDate(q.validUntil)}</td>
                          <td><span className="badge" style={{ background: m.bg, color: m.color }}>{m.label}</span></td>
                          <td onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <Link to={`/quotes/${q.id}`} className="btn btn-secondary btn-sm">{t('common.edit')}</Link>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(q)}>{t('common.delete')}</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
      }
    </>
  )
}
