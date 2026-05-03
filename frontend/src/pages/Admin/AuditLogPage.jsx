import { useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'

const ACTION_COLORS = {
  CREATE: { bg: '#dcfce7', color: '#16a34a' },
  UPDATE: { bg: '#dbeafe', color: '#1d4ed8' },
  DELETE: { bg: '#fee2e2', color: '#dc2626' },
}

const ENTITY_TYPES = ['Job', 'Visit', 'Quote', 'MovingFile', 'Client', 'Agent', 'StaffMember']
const ACTIONS      = ['CREATE', 'UPDATE', 'DELETE']
const PAGE_SIZE    = 50

function entityLink(entityType, entityId, t, entry) {
  switch (entityType) {
    case 'Job':         return <Link to={`/jobs/${entityId}`}           style={{ color: 'var(--primary)' }}>{entityId.slice(0, 8)}…</Link>
    case 'Visit':       return <Link to={`/visits/${entityId}`}         style={{ color: 'var(--primary)' }}>{entityId.slice(0, 8)}…</Link>
    case 'Quote':       return <Link to={`/quotes/${entityId}`}         style={{ color: 'var(--primary)' }}>{entityId.slice(0, 8)}…</Link>
    case 'Client':      return <Link to={`/clients/${entityId}/edit`}   style={{ color: 'var(--primary)' }}>{entityId.slice(0, 8)}…</Link>
    case 'Agent':       return <Link to={`/agents/${entityId}/edit`}    style={{ color: 'var(--primary)' }}>{entityId.slice(0, 8)}…</Link>
    case 'StaffMember': return <Link to={`/staff/${entityId}/edit`}     style={{ color: 'var(--primary)' }}>{entityId.slice(0, 8)}…</Link>
    case 'MovingFile': {
      const category = (entry?.after?.category || entry?.before?.category || '').toLowerCase()
      const path = category ? `/files/${category}/${entityId}` : null
      return path
        ? <Link to={path} style={{ color: 'var(--primary)' }}>{entityId.slice(0, 8)}…</Link>
        : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{entityId.slice(0, 8)}…</span>
    }
    default:            return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{entityId.slice(0, 8)}… {t('audit.deletedRecord')}</span>
  }
}

function entityTypeLabel(entityType, t) {
  const map = {
    Job: t('audit.entityJob'),
    Visit: t('audit.entityVisit'),
    Quote: t('audit.entityQuote'),
    MovingFile: t('audit.entityMovingFile'),
    Client: t('audit.entityClient'),
    Agent: t('audit.entityAgent'),
    StaffMember: t('audit.entityStaff'),
  }
  return map[entityType] || entityType
}

export default function AuditLogPage() {
  const { t } = useLanguage()

  const [filters, setFilters] = useState({ entityType: '', action: '', userId: '', from: '', to: '' })
  const [applied, setApplied] = useState({})
  const [entries, setEntries] = useState([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [searched, setSearched] = useState(false)
  const [staffList, setStaffList] = useState([])

  useEffect(() => {
    api.get('/staff?includeInactive=true').then(data => setStaffList(data)).catch(() => {})
  }, [])

  const buildParams = useCallback((f, p) => {
    const params = new URLSearchParams({ page: p, limit: PAGE_SIZE })
    if (f.entityType) params.set('entityType', f.entityType)
    if (f.action)     params.set('action', f.action)
    if (f.userId)     params.set('userId', f.userId)
    if (f.from)       params.set('from', f.from)
    if (f.to)         params.set('to', f.to)
    return params.toString()
  }, [])

  const fetchPage = useCallback(async (f, p) => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get(`/audit?${buildParams(f, p)}`)
      setEntries(data.entries || [])
      setTotal(data.total || 0)
      setPage(p)
      setApplied(f)
      setSearched(true)
    } catch (err) {
      setError(err.message || 'Error loading audit log')
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  const handleApply = (e) => {
    e.preventDefault()
    fetchPage(filters, 1)
  }

  const handleClear = () => {
    const empty = { entityType: '', action: '', userId: '', from: '', to: '' }
    setFilters(empty)
    setEntries([])
    setTotal(0)
    setSearched(false)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const pageFrom   = (page - 1) * PAGE_SIZE + 1
  const pageTo     = Math.min(page * PAGE_SIZE, total)

  const inputStyle = { padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 13, color: 'var(--text)', minWidth: 130 }
  const labelStyle = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '.04em', marginBottom: 3, display: 'block' }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{t('audit.logTitle')}</div>
          <div className="page-subtitle">{t('audit.logSubtitle')}</div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card card-body" style={{ marginBottom: 16 }}>
        <form onSubmit={handleApply} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 16px', alignItems: 'flex-end' }}>
          <div>
            <label style={labelStyle}>{t('audit.filterEntityType')}</label>
            <select style={inputStyle} value={filters.entityType} onChange={e => setFilters(f => ({ ...f, entityType: e.target.value }))}>
              <option value="">{t('audit.filterAll')}</option>
              {ENTITY_TYPES.map(et => <option key={et} value={et}>{entityTypeLabel(et, t)}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>{t('audit.filterAction')}</label>
            <select style={inputStyle} value={filters.action} onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}>
              <option value="">{t('audit.filterAll')}</option>
              {ACTIONS.map(a => <option key={a} value={a}>{t(`audit.action${a.charAt(0) + a.slice(1).toLowerCase()}`)}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>{t('audit.filterUser')}</label>
            <select style={{ ...inputStyle, minWidth: 160 }} value={filters.userId} onChange={e => setFilters(f => ({ ...f, userId: e.target.value }))}>
              <option value="">{t('audit.filterAll')}</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>{t('audit.filterFrom')}</label>
            <input type="date" style={inputStyle} value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>{t('audit.filterTo')}</label>
            <input type="date" style={inputStyle} value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>{t('audit.filterApply')}</button>
            <button type="button" className="btn btn-ghost" onClick={handleClear}>{t('audit.filterClear')}</button>
          </div>
        </form>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

      {loading && (
        <div className="loading" style={{ padding: '24px 0' }}>
          <div className="spinner" /> {t('common.loading')}
        </div>
      )}

      {!loading && searched && (
        <>
          {entries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 14 }}>
              {t('audit.noEntries')}
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                {t('audit.pagination').replace('{{from}}', pageFrom).replace('{{to}}', pageTo).replace('{{total}}', total)}
              </div>
              <div className="card" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2, #f1f5f9)', borderBottom: '2px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('audit.colTimestamp')}</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>{t('audit.colUser')}</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>{t('audit.colAction')}</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>{t('audit.colEntity')}</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>{t('audit.colEntityId')}</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>{t('audit.colChangedFields')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => {
                      const ac  = ACTION_COLORS[entry.action] || ACTION_COLORS.UPDATE
                      const ts  = new Date(entry.createdAt)
                      const when = ts.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      return (
                        <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{when}</td>
                          <td style={{ padding: '8px 12px' }}>{entry.userName || <em style={{ color: 'var(--text-muted)' }}>—</em>}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: ac.bg, color: ac.color }}>
                              {entry.action === 'CREATE' ? t('audit.actionCreate') : entry.action === 'UPDATE' ? t('audit.actionUpdate') : t('audit.actionDelete')}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px' }}>{entityTypeLabel(entry.entityType, t)}</td>
                          <td style={{ padding: '8px 12px' }}>{entityLink(entry.entityType, entry.entityId, t, entry)}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
                            {entry.changedKeys?.length > 0 ? entry.changedKeys.join(', ') : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
                  <button className="btn btn-ghost" disabled={page <= 1} onClick={() => fetchPage(applied, page - 1)}>←</button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    // Show pages around current
                    let p
                    if (totalPages <= 7) {
                      p = i + 1
                    } else if (page <= 4) {
                      p = i + 1 <= 5 ? i + 1 : totalPages - (6 - i)
                    } else if (page >= totalPages - 3) {
                      p = totalPages - 6 + i
                    } else {
                      const offsets = [-3, -2, -1, 0, 1, 2, 3]
                      p = page + offsets[i]
                    }
                    return (
                      <button
                        key={p}
                        className={`btn ${p === page ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ minWidth: 36 }}
                        onClick={() => fetchPage(applied, p)}
                      >
                        {p}
                      </button>
                    )
                  })}
                  <button className="btn btn-ghost" disabled={page >= totalPages} onClick={() => fetchPage(applied, page + 1)}>→</button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  )
}
