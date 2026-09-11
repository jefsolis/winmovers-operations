import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'
import { fileStatusMeta, getFileStatuses, getFileProgressionStatuses, stripFilePrefix, scheduleMeta, effectiveCoordinator } from '../../constants'

/**
 * FilesList — shared list component for all three file categories.
 * Expects props: category = 'EXPORT' | 'IMPORT' | 'LOCAL'
 */
export default function FilesList({ category }) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [files, setFiles]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [search, setSearch]       = useState('')
  const [showClosed, setShowClosed] = useState(false)
  const [selectedStatuses, setSelectedStatuses] = useState(new Set())
  const [visibilityFilter, setVisibilityFilter] = useState('active') // active | deleted | all
  const [coordinators, setCoordinators] = useState([])
  const eligibleIds = new Set(coordinators.map(s => s.id))
  const coordinatorFilter = searchParams.get('coordinator') || ''

  const setCoordinatorFilter = (value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set('coordinator', value)
    else next.delete('coordinator')
    setSearchParams(next, { replace: true })
  }

  const handleDelete = async (id, fileNumber) => {
    if (!window.confirm(t('movingFiles.deleteConfirm', { num: fileNumber }))) return
    try {
      await api.delete(`/files/${id}`)
      setFiles(prev => prev.filter(f => f.id !== id))
    } catch (e) { alert(e.message) }
  }

  const handleStatusChange = async (id, newStatus) => {
    try {
      await api.put(`/files/${id}`, { status: newStatus })
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: newStatus } : f))
    } catch (e) { alert(e.message) }
  }

  const handleRestore = async (id) => {
    if (!window.confirm(t('movingFiles.restoreConfirm'))) return
    try {
      await api.post(`/files/${id}/restore`)
      setFiles(prev => prev.map(f => f.id === id ? { ...f, deletedAt: null, deletedByOid: null, deletedByName: null, status: f.status === 'VOID' ? 'OPEN' : f.status } : f))
      if (visibilityFilter === 'deleted') {
        setFiles(prev => prev.filter(f => f.id !== id))
      }
    } catch (e) { alert(e.message) }
  }

  // Guarded so a deep link (?coordinator=…) survives mount and is only cleared when the category changes.
  const prevCategory = useRef(category)
  useEffect(() => {
    if (prevCategory.current === category) return
    prevCategory.current = category
    setSearch('')
    setSelectedStatuses(new Set())
    setVisibilityFilter('active')
    setCoordinatorFilter('')
  }, [category])

  useEffect(() => {
    api.get('/staff?canCoordinateFiles=true')
      .then(setCoordinators)
      .catch(() => setCoordinators([]))
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ category })
    if (search) params.set('search', search)
    if (visibilityFilter === 'deleted') params.set('onlyDeleted', 'true')
    if (visibilityFilter === 'all') params.set('includeDeleted', 'true')
    api.get(`/files?${params}`)
      .then(setFiles)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [category, search, visibilityFilter])

  const clientName = (c) => {
    if (!c) return '—'
    return c.clientType === 'INDIVIDUAL'
      ? `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.name
      : c.name
  }

  const TERMINAL = ['CLOSED', 'VOID']
  const allStatuses = getFileStatuses(t)
  const progressionKeys = getFileProgressionStatuses(category, t).map(s => s.value)
  const chipStatuses = allStatuses.filter(s => progressionKeys.includes(s.value) || TERMINAL.includes(s.value))

  const matchesCoordinator = (f) => {
    if (!coordinatorFilter) return true
    const c = effectiveCoordinator(f)
    if (coordinatorFilter === 'unassigned') return !c
    return c?.id === coordinatorFilter
  }

  // Show-closed filtering must apply regardless of whether a status chip is selected,
  // otherwise a file matching search/status can be hidden from the default view yet appear once filtered.
  const baseFiles = (visibilityFilter === 'deleted' || visibilityFilter === 'all')
    ? files
    : (showClosed ? files : files.filter(f => !TERMINAL.includes(f.status)))

  // Each chip row counts the other row's selection, so the two never contradict each other.
  const statusFiltered = selectedStatuses.size > 0
    ? baseFiles.filter(f => selectedStatuses.has(f.status))
    : baseFiles

  const countByStatus = {}
  baseFiles.filter(matchesCoordinator).forEach(f => { countByStatus[f.status] = (countByStatus[f.status] || 0) + 1 })

  // Coordinator chips: only people actually holding files in the current view, plus the unassigned group.
  const coordinatorChips = (() => {
    const byId = new Map()
    let unassigned = 0
    statusFiltered.forEach(f => {
      const c = effectiveCoordinator(f)
      if (!c) { unassigned++; return }
      const entry = byId.get(c.id) || { value: c.id, name: c.name, isActive: eligibleIds.has(c.id), count: 0 }
      entry.count++
      byId.set(c.id, entry)
    })
    const chips = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
    return [...chips, { value: 'unassigned', name: t('movingFiles.coordinatorUnassigned'), isActive: true, count: unassigned }]
  })()

  const toggleStatus = (status) => {
    setSelectedStatuses(prev => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  const displayed = statusFiltered.filter(matchesCoordinator)

  const prefix = { EXPORT: '/files/export', IMPORT: '/files/import', LOCAL: '/files/local', WAREHOUSE: '/files/warehouse' }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{t(`movingFiles.${category.toLowerCase()}Title`)}</div>
          <div className="page-subtitle">{displayed.length > 0 ? `${displayed.length} ${t('movingFiles.filesLabel')}` : ''}</div>
        </div>
        {category !== 'EXPORT' && category !== 'LOCAL' && (
          <Link to={`${prefix[category]}/new`} className="btn btn-primary">{t('movingFiles.newFile')}</Link>
        )}
      </div>

      <div className="card card-body" style={{ marginBottom: 16 }}>
        <div className="toolbar">
          <input
            className="search-input"
            placeholder={t('movingFiles.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            {[
              { key: 'active', label: t('movingFiles.activeOnly') },
              { key: 'deleted', label: t('movingFiles.deletedOnly') },
              { key: 'all', label: t('movingFiles.allRecords') },
            ].map(v => (
              <button
                key={v.key}
                type="button"
                onClick={() => setVisibilityFilter(v.key)}
                style={{
                  padding: '5px 10px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  background: visibilityFilter === v.key ? 'var(--primary)' : 'transparent',
                  color: visibilityFilter === v.key ? '#fff' : 'var(--text)',
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={showClosed}
              onChange={e => setShowClosed(e.target.checked)}
              disabled={visibilityFilter !== 'active'}
              style={{ cursor: 'pointer' }}
            />
            {t('movingFiles.showClosed')}
          </label>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, alignItems: 'center' }}>
          {chipStatuses.map(s => {
            const meta = fileStatusMeta(s.value, t)
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
                  background: active ? meta.bg : '#fff',
                  color: active ? meta.color : '#64748b',
                  fontWeight: active ? 700 : 500, fontSize: 12, cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                {s.label}
                <span style={{
                  background: active ? 'rgba(0,0,0,0.15)' : '#e2e8f0',
                  color: active ? meta.color : '#475569',
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

        {(coordinatorChips.some(c => c.count > 0) || coordinatorFilter) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginRight: 2 }}>
              {t('movingFiles.coordinatorFilter')}:
            </span>
            {coordinatorChips.map(c => {
              const active = coordinatorFilter === c.value
              return (
                <button
                  key={c.value}
                  onClick={() => setCoordinatorFilter(active ? '' : c.value)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '4px 10px', borderRadius: 6,
                    border: active ? '1.5px solid #334155' : '1.5px solid #e2e8f0',
                    background: active ? '#334155' : '#f8fafc',
                    color: active ? '#fff' : '#475569',
                    fontWeight: active ? 700 : 500, fontSize: 12, cursor: 'pointer',
                    fontStyle: c.value === 'unassigned' ? 'italic' : 'normal',
                    transition: 'all 0.12s',
                  }}
                >
                  {c.isActive ? c.name : `${c.name} ${t('movingFiles.coordinatorInactive')}`}
                  <span style={{
                    background: active ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
                    color: active ? '#fff' : '#475569',
                    borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 700,
                  }}>{c.count}</span>
                </button>
              )
            })}
            {coordinatorFilter && (
              <button
                onClick={() => setCoordinatorFilter('')}
                style={{ padding: '4px 10px', borderRadius: 6, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
              >
                × {t('common.filterClear')}
              </button>
            )}
          </div>
        )}

        {loading && <div className="loading"><div className="spinner" /></div>}
        {error   && <div className="alert alert-error">{error}</div>}

        {!loading && !error && (
          displayed.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📁</div>
              <h3>{t('movingFiles.empty')}</h3>
              <p>{t('movingFiles.emptyHint')}</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('movingFiles.fileNumber')}</th>
                    <th>{t('common.name')}</th>
                    <th>{t('movingFiles.status')}</th>
                    {category !== 'LOCAL' && <th>{t('movingFiles.linkedJob')}</th>}
                    <th>{t('movingFiles.coordinator')}</th>
                    <th>{t('movingFiles.attachments')}</th>
                    <th></th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map(f => {
                    const sm = fileStatusMeta(f.status, t)
                    const scm = scheduleMeta(f.scheduled, t)
                    const progressionStatuses = getFileProgressionStatuses(category, t)
                    const isDeleted = Boolean(f.deletedAt)
                    const coord = effectiveCoordinator(f)
                    const canChangeStatus = category !== 'LOCAL' && f.status !== 'CLOSED' && f.status !== 'VOID' && !isDeleted
                    return (
                      <tr key={f.id} style={isDeleted ? { opacity: 0.78, background: '#f8fafc' } : undefined}>
                          <td><Link to={`${prefix[category]}/${f.id}`} style={{ color: 'var(--primary)', fontWeight: 700 }}>{stripFilePrefix(f.fileNumber)}</Link></td>
                        <td>{clientName(f.client)}</td>
                        <td>
                          {canChangeStatus ? (
                            <select
                              value={f.status}
                              onChange={e => handleStatusChange(f.id, e.target.value)}
                              style={{
                                padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)',
                                background: sm.bg, color: sm.color,
                                fontWeight: 600, fontSize: 12, cursor: 'pointer', outline: 'none',
                              }}
                            >
                              {progressionStatuses.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </select>
                          ) : (
                            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                              <span className="badge" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
                              {isDeleted && <span className="badge" style={{ background: '#fee2e2', color: '#991b1b' }}>{t('movingFiles.deletedTag')}</span>}
                            </span>
                          )}
                        </td>
                        {category !== 'LOCAL' && (
                          <td>
                            {f.job
                              ? <Link to={`/jobs/${f.job.id}`} style={{ color: 'var(--primary)' }}>{f.job.jobNumber}</Link>
                              : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{t('movingFiles.noJob')}</span>}
                          </td>
                        )}
                        <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                          {coord ? coord.name : t('movingFiles.coordinatorUnassigned')}
                        </td>
                        <td>{f._count?.attachments ?? 0}</td>
                        <td style={{ textAlign: 'center' }}>
                          <scm.Icon
                            size={18}
                            color={scm.color}
                            title={scm.label}
                            style={{ cursor: f.scheduled ? 'pointer' : 'default' }}
                            onClick={() => { if (f.scheduled) navigate(`/schedule?date=${f.nextScheduleDate}`) }}
                          />
                        </td>
                        <td className="td-actions">
                          <Link to={`${prefix[category]}/${f.id}${isDeleted ? '?includeDeleted=true' : ''}`} className="btn btn-ghost btn-sm">{t('common.view')}</Link>
                          {isDeleted ? (
                            <button className="btn btn-secondary btn-sm" onClick={() => handleRestore(f.id)}>{t('movingFiles.restoreFile')}</button>
                          ) : (
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(f.id, f.fileNumber)}>{t('common.delete')}</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </>
  )
}
