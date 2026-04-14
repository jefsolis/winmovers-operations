import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'
import { clientTypeMeta } from '../../constants'

const FILE_PATH = { EXPORT: 'export', IMPORT: 'import', LOCAL: 'local' }

export default function ClientsList() {
  const { t } = useLanguage()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = () => {
    setLoading(true)
    const q = search ? `?search=${encodeURIComponent(search)}` : ''
    api.get(`/clients${q}`)
      .then(setClients)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, []) // eslint-disable-line

  const handleSearch = e => {
    e.preventDefault()
    load()
  }

  const handleDelete = async client => {
    if (!window.confirm(t('clients.deleteConfirm', { name: client.name }))) return
    try {
      await api.delete(`/clients/${client.id}`)
      setClients(prev => prev.filter(c => c.id !== client.id))
    } catch (e) { alert(e.message) }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{t('clients.title')}</div>
          <div className="page-subtitle">{t('clients.subtitle')}</div>
        </div>
        <Link to="/clients/new" className="btn btn-primary">{t('clients.newClient')}</Link>
      </div>

      <div className="card">
        <div className="toolbar">
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
            <input
              className="search-input"
              placeholder={t('clients.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button type="submit" className="btn btn-ghost">Search</button>
          </form>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /> {t('common.loading')}</div>
        ) : clients.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏢</div>
            <div className="empty-state-title">{t('clients.empty')}</div>
            <Link to="/clients/new" className="btn btn-primary" style={{ marginTop: 12 }}>{t('clients.newClient')}</Link>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>{t('clients.companyName')}</th>
                  <th>{t('clients.clientType')}</th>
                  <th>{t('clients.openFiles')}</th>
                  <th>{t('common.email')}</th>
                  <th>{t('common.phone')}</th>
                  <th>{t('common.country')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => {
                  const typeBadge = clientTypeMeta(c.clientType, t)
                  return (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td>
                    <td>
                      <span style={{ background: typeBadge.bg, color: typeBadge.color, padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                        {typeBadge.label}
                      </span>
                    </td>
                    <td>
                      {(() => {
                        const files = [...(c.movingFiles || []), ...(c.corporateMovingFiles || [])]
                        if (!files.length) return <span style={{ color: 'var(--text-muted)' }}>—</span>
                        return (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {files.map(f => (
                              <Link
                                key={f.id}
                                to={`/files/${FILE_PATH[f.category]}/${f.id}`}
                                className="badge"
                                style={{ background: '#e0f2fe', color: '#0369a1', textDecoration: 'none', fontSize: 11, fontWeight: 600 }}
                              >
                                {f.fileNumber}
                              </Link>
                            ))}
                          </div>
                        )
                      })()}
                    </td>
                    <td>{c.email || '—'}</td>
                    <td>{c.phone || '—'}</td>
                    <td>{c.country || '—'}</td>
                    <td>
                      <Link to={`/clients/${c.id}/edit`} className="btn btn-ghost btn-sm">{t('common.edit')}</Link>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c)}>{t('common.delete')}</button>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
