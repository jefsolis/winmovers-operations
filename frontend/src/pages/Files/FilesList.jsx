import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'
import { fileStatusMeta, getFileStatuses, getFileProgressionStatuses, stripFilePrefix } from '../../constants'

/**
 * FilesList — shared list component for all three file categories.
 * Expects props: category = 'EXPORT' | 'IMPORT' | 'LOCAL'
 */
export default function FilesList({ category }) {
  const { t } = useLanguage()
  const [files, setFiles]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [search, setSearch]       = useState('')
  const [showClosed, setShowClosed] = useState(false)
  const [selectedStatuses, setSelectedStatuses] = useState(new Set())

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

  useEffect(() => {
    setSelectedStatuses(new Set())
  }, [category])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ category })
    if (search) params.set('search', search)
    api.get(`/files?${params}`)
      .then(setFiles)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [category, search])

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

  const countByStatus = {}
  files.forEach(f => { countByStatus[f.status] = (countByStatus[f.status] || 0) + 1 })

  const toggleStatus = (status) => {
    setSelectedStatuses(prev => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  const displayed = selectedStatuses.size > 0
    ? files.filter(f => selectedStatuses.has(f.status))
    : (!showClosed ? files.filter(f => !TERMINAL.includes(f.status)) : files)

  const prefix = { EXPORT: '/files/export', IMPORT: '/files/import', LOCAL: '/files/local' }

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
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={showClosed}
              onChange={e => setShowClosed(e.target.checked)}
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

        {loading && <div className="loading"><div className="spinner" /></div>}
        {error   && <div className="alert alert-error">{error}</div>}

        {!loading && !error && (
          files.length === 0 ? (
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
                    {category !== 'LOCAL' && <th>{t('movingFiles.coordinator')}</th>}
                    <th>{t('movingFiles.attachments')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map(f => {
                    const sm = fileStatusMeta(f.status, t)
                    const progressionStatuses = getFileProgressionStatuses(category, t)
                    const canChangeStatus = category !== 'LOCAL' && f.status !== 'CLOSED' && f.status !== 'VOID'
                    return (
                      <tr key={f.id}>
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
                            <span className="badge" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
                          )}
                        </td>
                        {category !== 'LOCAL' && (
                          <td>
                            {f.job
                              ? <Link to={`/jobs/${f.job.id}`} style={{ color: 'var(--primary)' }}>{f.job.jobNumber}</Link>
                              : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{t('movingFiles.noJob')}</span>}
                          </td>
                        )}
                        {category !== 'LOCAL' && (
                          <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                            {f.coordinator?.name || (category === 'EXPORT' ? f.job?.coordinator?.name : null) || '—'}
                          </td>
                        )}
                        <td>{f._count?.attachments ?? 0}</td>
                        <td className="td-actions">
                          <Link to={`${prefix[category]}/${f.id}`} className="btn btn-ghost btn-sm">{t('common.view')}</Link>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(f.id, f.fileNumber)}>{t('common.delete')}</button>
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
