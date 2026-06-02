import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { quoteStatusMeta, getQuoteStatuses, formatDate } from '../../constants'
import { useLanguage } from '../../i18n'

export default function QuotesList() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const QUOTE_STATUSES = getQuoteStatuses(t)

  const TERMINAL = ['REJECTED']

  const [quotes, setQuotes]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [showClosed, setShowClosed] = useState(false)
  const [selectedStatuses, setSelectedStatuses] = useState(new Set())

  const load = () => {
    setLoading(true)
    const params = new URLSearchParams()
    api.get(`/quotes?${params}`).then(data => {
      if (!Array.isArray(data)) { setQuotes([]); setLoading(false); return }
      const filtered = search
        ? data.filter(q =>
            q.quoteNumber.toLowerCase().includes(search.toLowerCase()) ||
            q.visit?.visitNumber?.toLowerCase().includes(search.toLowerCase()) ||
            q.visit?.prospectName?.toLowerCase().includes(search.toLowerCase()) ||
            q.visit?.client?.name?.toLowerCase().includes(search.toLowerCase()) ||
            q.movingFile?.fileNumber?.toLowerCase().includes(search.toLowerCase())
          )
        : data
      setQuotes(filtered)
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [search]) // eslint-disable-line

  const countByStatus = {}
  quotes.forEach(q => { countByStatus[q.status] = (countByStatus[q.status] || 0) + 1 })

  const toggleStatus = (status) => {
    setSelectedStatuses(prev => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  const displayed = selectedStatuses.size > 0
    ? quotes.filter(q => selectedStatuses.has(q.status))
    : (!showClosed ? quotes.filter(q => !TERMINAL.includes(q.status)) : quotes)

  const handleDelete = async (q) => {
    if (!window.confirm(t('quotes.deleteConfirm', { num: q.quoteNumber }))) return
    await api.delete(`/quotes/${q.id}`)
    setQuotes(prev => prev.filter(x => x.id !== q.id))
  }

  const clientName = (q) => {
    if (q.visit?.client?.name) return q.visit.client.name
    if (q.visit?.prospectName) return q.visit.prospectName
    if (q.movingFile?.client) {
      const c = q.movingFile.client
      return c.firstName ? `${c.firstName} ${c.lastName || ''}`.trim() : c.name
    }
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
          <input
            className="form-control search-input"
            placeholder={t('quotes.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} />
            {t('common.showClosed')}
          </label>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12, alignItems: 'center' }}>
          {QUOTE_STATUSES.map(s => {
            const active = selectedStatuses.has(s.value)
            const count = countByStatus[s.value] || 0
            return (
              <button
                key={s.value}
                onClick={() => toggleStatus(s.value)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 20,
                  border: active ? 'none' : '1.5px solid #d1d5db',
                  background: active ? '#dbeafe' : '#fff',
                  color: active ? '#1e40af' : '#64748b',
                  fontWeight: active ? 700 : 500, fontSize: 12, cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                {s.label}
                <span style={{
                  background: active ? 'rgba(0,0,0,0.15)' : '#e2e8f0',
                  color: active ? '#1e40af' : '#475569',
                  borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 700,
                }}>{count}</span>
              </button>
            )
          })}
          {selectedStatuses.size > 0 && (
            <button
              onClick={() => setSelectedStatuses(new Set())}
              style={{ padding: '4px 10px', borderRadius: 20, border: '1.5px solid #d1d5db', background: '#fff', color: '#64748b', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
            >
              × {t('common.filterClear')}
            </button>
          )}
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
                      <th>{t('common.type')}</th>
                      <th>{t('quotes.reference')}</th>
                      <th>{t('visits.prospectName')}</th>
                      <th>{t('quotes.totalAmount')}</th>
                      <th>{t('quotes.validUntil')}</th>
                      <th>{t('jobs.status')}</th>
                      <th>{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map(q => {
                      const m = quoteStatusMeta(q.status, t)
                      const amount = q.totalAmount != null
                        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: q.currency || 'USD' }).format(q.totalAmount)
                        : '—'
                      return (
                        <tr key={q.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/quotes/${q.id}`)}>
                          <td><strong>{q.quoteNumber}</strong></td>
                          <td>
                            {q.movingFileId
                              ? <span className="badge" style={{ background: '#dbeafe', color: '#1e40af' }}>{t('quotes.typeImport')}</span>
                              : <span className="badge" style={{ background: '#dcfce7', color: '#166534' }}>{t('quotes.typeExport')}</span>
                            }
                          </td>
                          <td>
                            {q.visit && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                <span className="badge" style={{ background: '#f0fdf4', color: '#166534', fontSize: 10, padding: '1px 5px' }}>{t('quotes.visitBadge')}</span>
                                <Link to={`/visits/${q.visit.id}`} onClick={e => e.stopPropagation()} style={{ color: 'var(--primary)' }}>
                                  {q.visit.visitNumber}
                                </Link>
                              </span>
                            )}
                            {q.movingFile && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: 10, padding: '1px 5px' }}>{t('quotes.typeImport')}</span>
                                <Link to={`/files/import/${q.movingFile.id}`} onClick={e => e.stopPropagation()} style={{ color: 'var(--primary)' }}>
                                  {q.movingFile.fileNumber}
                                </Link>
                              </span>
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
