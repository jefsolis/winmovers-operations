import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'

export default function AgentsList() {
  const { t } = useLanguage()
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = () => {
    setLoading(true)
    const q = search ? `?search=${encodeURIComponent(search)}` : ''
    api.get(`/agents${q}`)
      .then(setAgents)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [search]) // eslint-disable-line

  const handleDelete = async agent => {
    if (!window.confirm(t('agents.deleteConfirm', { name: agent.name }))) return
    try {
      await api.delete(`/agents/${agent.id}`)
      setAgents(prev => prev.filter(a => a.id !== agent.id))
    } catch (e) { alert(e.message) }
  }


  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{t('agents.title')}</div>
          <div className="page-subtitle">{t('agents.subtitle')}</div>
        </div>
        <Link to="/agents/new" className="btn btn-primary">{t('agents.newAgent')}</Link>
      </div>

      <div className="card">
        <div className="toolbar">
          <input
            className="search-input"
            placeholder={t('agents.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /> {t('common.loading')}</div>
        ) : agents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🤝</div>
            <div className="empty-state-title">{t('agents.empty')}</div>
            <Link to="/agents/new" className="btn btn-primary" style={{ marginTop: 12 }}>{t('agents.newAgent')}</Link>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>{t('common.name')}</th>
                  <th>{t('common.country')}</th>
                  <th>{t('common.email')}</th>
                  <th>{t('common.phone')}</th>
                  <th>{t('agents.jobs')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {agents.map(a => {
                  const totalJobs = (a._count?.originJobs || 0) + (a._count?.destJobs || 0) + (a._count?.customsJobs || 0)
                  return (
                    <tr key={a.id}>
                      <td>
                        <strong>{a.name}</strong>
                        {a.isSystem && <span className="badge" style={{ marginLeft: 8, background: '#e0f2fe', color: '#0369a1' }}>System</span>}
                        {a.city ? <span style={{ color: '#64748b', fontWeight: 400 }}> — {a.city}</span> : ''}
                      </td>
                      <td>{a.country || '—'}</td>
                      <td>{a.email || '—'}</td>
                      <td>{a.phone || '—'}</td>
                      <td>{totalJobs}</td>
                      <td>
                        {a.isSystem ? (
                          <span style={{ color: '#64748b', fontSize: 12 }}>Protected</span>
                        ) : (
                          <>
                            <Link to={`/agents/${a.id}/edit`} className="btn btn-ghost btn-sm">{t('common.edit')}</Link>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(a)}>{t('common.delete')}</button>
                          </>
                        )}
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
