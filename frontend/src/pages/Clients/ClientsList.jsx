import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'

export default function ClientsList() {
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
    if (!window.confirm(`Delete client "${client.name}"? This cannot be undone.`)) return
    try {
      await api.delete(`/clients/${client.id}`)
      setClients(prev => prev.filter(c => c.id !== client.id))
    } catch (e) { alert(e.message) }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Clients</div>
          <div className="page-subtitle">Manage corporate accounts</div>
        </div>
        <Link to="/clients/new" className="btn btn-primary">+ New Client</Link>
      </div>

      <div className="card">
        <div className="toolbar">
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
            <input
              className="search-input"
              placeholder="Search name, email, country…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button type="submit" className="btn btn-ghost">Search</button>
          </form>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /> Loading…</div>
        ) : clients.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏢</div>
            <div className="empty-state-title">No clients yet</div>
            <Link to="/clients/new" className="btn btn-primary" style={{ marginTop: 12 }}>Add First Client</Link>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Company Name</th>
                  <th>Account #</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Country</th>
                  <th>Actions</th>
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
                      <Link to={`/clients/${c.id}/edit`} className="btn btn-ghost btn-sm">Edit</Link>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c)}>Delete</button>
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
