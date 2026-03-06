import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'
import { fileStatusMeta } from '../../constants'

/**
 * FilesList — shared list component for all three file categories.
 * Expects props: category = 'EXPORT' | 'IMPORT' | 'LOCAL'
 */
export default function FilesList({ category }) {
  const { t } = useLanguage()
  const [files, setFiles]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [search, setSearch]   = useState('')
  const [status, setStatus]   = useState('')

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ category })
    if (status) params.set('status', status)
    if (search) params.set('search', search)
    api.get(`/files?${params}`)
      .then(setFiles)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [category, status, search])

  const clientName = (c) => {
    if (!c) return '—'
    return c.clientType === 'INDIVIDUAL'
      ? `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.name
      : c.name
  }

  const prefix = { EXPORT: '/files/export', IMPORT: '/files/import', LOCAL: '/files/local' }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{t(`movingFiles.${category.toLowerCase()}Title`)}</div>
          <div className="page-subtitle">{files.length > 0 ? `${files.length} ${t('movingFiles.filesLabel')}` : ''}</div>
        </div>
        <Link to={`${prefix[category]}/new`} className="btn btn-primary">+ {t('movingFiles.newFile')}</Link>
      </div>

      <div className="card card-body" style={{ marginBottom: 16 }}>
        <div className="toolbar">
          <input
            className="search-input"
            placeholder={t('movingFiles.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="filter-select" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">{t('movingFiles.allStatuses')}</option>
            <option value="OPEN">{t('fileStatuses.OPEN')}</option>
            <option value="CLOSED">{t('fileStatuses.CLOSED')}</option>
          </select>
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
                    <th>{t('movingFiles.attachments')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map(f => {
                    const sm = fileStatusMeta(f.status, t)
                    return (
                      <tr key={f.id}>
                        <td><strong>{f.fileNumber}</strong></td>
                        <td>{clientName(f.client)}</td>
                        <td>
                          <span className="badge" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
                        </td>
                        {category !== 'LOCAL' && (
                          <td>
                            {f.job
                              ? <Link to={`/jobs/${f.job.id}`} style={{ color: 'var(--primary)' }}>{f.job.jobNumber}</Link>
                              : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{t('movingFiles.noJob')}</span>}
                          </td>
                        )}
                        <td>{f._count?.attachments ?? 0}</td>
                        <td className="td-actions">
                          <Link to={`${prefix[category]}/${f.id}`} className="btn btn-ghost btn-sm">{t('common.view')}</Link>
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
