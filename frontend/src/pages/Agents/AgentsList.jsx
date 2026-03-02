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

  useEffect(() => { load() }, []) // eslint-disable-line

  const handleSearch = e => { e.preventDefault(); load() }

  const handleDelete = async agent => {
    if (!window.confirm(t('agents.deleteConfirm', { name: agent.name }))) return
    try {
      await api.delete(`/agents/${agent.id}`)
      setAgents(prev => prev.filter(a => a.id !== agent.id))
    } catch (e) { alert(e.message) }
  }

  const typeLabel = (type) => t(`agents.agentTypes.${type}`) || type

  const typeBg = { ORIGIN: '#dbeafe', DESTINATION: '#dcfce7', CUSTOMS: '#fef3c7', OTHER: '#f1f5f9' }
  const typeColor = { ORIGIN: '#1e40af', DESTINATION: '#166534', CUSTOMS: '#92400e', OTHER: '#475569' }

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
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
            <input
              className="search-input"
              placeholder={t('agents.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button type="submit" className="btn btn-ghost">{t('common.search')}</button>
          </form>
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
                  <th>{t('agents.agentType')}</th>
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
                      <td><strong>{a.name}</strong>{a.city ? <span style={{ color: '#64748b', fontWeight: 400 }}> — {a.city}</span> : ''}</td>
                      <td>
                        <span style={{ background: typeBg[a.agentType] || '#f1f5f9', color: typeColor[a.agentType] || '#475569', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                          {typeLabel(a.agentType)}
                        </span>
                      </td>
                      <td>{a.country || '—'}</td>
                      <td>{a.email || '—'}</td>
                      <td>{a.phone || '—'}</td>
                      <td>{totalJobs}</td>
                      <td>
                        <Link to={`/agents/${a.id}/edit`} className="btn btn-ghost btn-sm">{t('common.edit')}</Link>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(a)}>{t('common.delete')}</button>
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
