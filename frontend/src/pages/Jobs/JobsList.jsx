import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { typeMeta, formatDate, getJobTypes } from '../../constants'
import { useLanguage } from '../../i18n'

export default function JobsList() {
  const { t } = useLanguage()
  const [searchParams] = useSearchParams()
  const JOB_TYPES = getJobTypes(t)
  const TERMINAL = ['DELIVERED', 'CLOSED', 'CANCELLED']

  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [showClosed, setShowClosed] = useState(false)
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const [selectedTypes, setSelectedTypes] = useState(() => new Set(searchParams.get('type') ? [searchParams.get('type')] : []))
  const typeMenuRef = useRef(null)

  useEffect(() => {
    if (!showTypeMenu) return
    const close = (e) => { if (typeMenuRef.current && !typeMenuRef.current.contains(e.target)) setShowTypeMenu(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showTypeMenu])

  const load = () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (search)       p.set('search', search)
    api.get(`/jobs?${p}`)
      .then(setJobs)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [search]) // eslint-disable-line

  const countByType = {}
  jobs.forEach(job => { countByType[job.type] = (countByType[job.type] || 0) + 1 })

  const toggleType = (value) => {
    setSelectedTypes(prev => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  const displayed = selectedTypes.size > 0
    ? jobs.filter(job => selectedTypes.has(job.type))
    : (!showClosed ? jobs.filter(j => !TERMINAL.includes(j.status)) : jobs)

  const handleDelete = async (id, jobNumber) => {
    if (!window.confirm(t('jobs.deleteConfirm', { num: jobNumber }))) return
    try {
      await api.delete(`/jobs/${id}`)
      setJobs(prev => prev.filter(j => j.id !== id))
    } catch (e) { alert(e.message) }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{t('jobs.title')}</div>
          <div className="page-subtitle">{jobs.length === 1 ? t('jobs.subtitle_one') : t('jobs.subtitle_other', { n: jobs.length })}</div>
        </div>
        <div ref={typeMenuRef} style={{ position: 'relative' }}>
          <button className="btn btn-primary" onClick={() => setShowTypeMenu(v => !v)}>
            + {t('jobs.newDirectJob')} ▾
          </button>
          {showTypeMenu && (
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 50,
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 180, padding: '4px 0',
            }}>
              {JOB_TYPES.filter(tp => ['EXPORT', 'IMPORT', 'DOMESTIC'].includes(tp.value)).map(tp => (
                <Link
                  key={tp.value}
                  to={`/jobs/new?direct=true&type=${tp.value}`}
                  onClick={() => setShowTypeMenu(false)}
                  style={{ display: 'block', padding: '9px 16px', color: '#1e293b', textDecoration: 'none', fontSize: 14 }}
                >
                  {tp.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="toolbar">
        <input
          className="search-input"
          placeholder={t('jobs.searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} />
          {t('common.showClosed')}
        </label>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, alignItems: 'center' }}>
        {JOB_TYPES.filter(tp => tp.value !== 'INTERNATIONAL').map(tp => {
          const active = selectedTypes.has(tp.value)
          const count = countByType[tp.value] || 0
          const meta = typeMeta(tp.value, t)
          return (
            <button
              key={tp.value}
              onClick={() => toggleType(tp.value)}
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
              {tp.label}
              <span style={{
                background: active ? 'rgba(0,0,0,0.15)' : '#e2e8f0',
                color: active ? meta.color : '#475569',
                borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 700,
              }}>{count}</span>
            </button>
          )
        })}
        {selectedTypes.size > 0 && (
          <button
            onClick={() => setSelectedTypes(new Set())}
            style={{ padding: '4px 10px', borderRadius: 20, border: '1.5px solid #d1d5db', background: '#fff', color: '#64748b', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
          >
            × {t('common.filterClear')}
          </button>
        )}
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        <div className="table-wrapper">
          {loading
            ? <div className="loading"><div className="spinner" /> {t('common.loading')}</div>
            : jobs.length === 0
              ? <div className="empty-state">
                  <div className="empty-state-icon">📦</div>
                  <div className="empty-state-title">{t('jobs.empty')}</div>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>{t('jobs.emptyHint')}</p>
                </div>
              : <table>
                  <thead>
                    <tr>
                      <th>{t('jobs.jobNumber')}</th>
                      <th>{t('jobs.client')}</th>
                      <th>{t('jobs.type')}</th>
                      <th>{t('jobs.route')}</th>
                      <th>{t('jobs.serviceDate')}</th>
                      <th>{t('movingFiles.coordinator')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map(job => {
                      const tm = typeMeta(job.type, t)
                      return (
                        <tr key={job.id}>
                          <td><Link to={`/jobs/${job.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>{job.jobNumber}</Link></td>
                          <td style={{ color: 'var(--text-muted)' }}>{job.client?.name || '—'}</td>
                          <td><span className="badge" style={{ background: tm.bg, color: tm.color }}>{tm.label}</span></td>
                          <td style={{ color: 'var(--text-muted)' }}>{[job.originCity, job.destCity].filter(Boolean).join(' → ') || '—'}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{formatDate(job.serviceDate)}</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{job.coordinator?.name || '—'}</td>
                          <td className="td-actions">
                            <Link to={`/jobs/${job.id}/edit`} className="btn btn-ghost btn-sm">{t('common.edit')}</Link>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(job.id, job.jobNumber)}>{t('common.delete')}</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
          }
        </div>
      </div>
    </>
  )
}
