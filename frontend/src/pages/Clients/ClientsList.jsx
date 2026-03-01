import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'

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
                  <th>{t('clients.accountNum')}</th>
                  <th>{t('common.email')}</th>
                  <th>{t('common.phone')}</th>
                  <th>{t('common.country')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.accountNum || '—'}</td>
                    <td>{c.email || '—'}</td>
                    <td>{c.phone || '—'}</td>
                    <td>{c.country || '—'}</td>
                    <td>
                      <Link to={`/clients/${c.id}/edit`} className="btn btn-ghost btn-sm">{t('common.edit')}</Link>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c)}>{t('common.delete')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
