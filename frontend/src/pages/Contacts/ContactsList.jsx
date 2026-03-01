import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'

export default function ContactsList() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = () => {
    setLoading(true)
    const q = search ? `?search=${encodeURIComponent(search)}` : ''
    api.get(`/contacts${q}`)
      .then(setContacts)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, []) // eslint-disable-line

  const handleSearch = e => {
    e.preventDefault()
    load()
  }

  const handleDelete = async contact => {
    const name = `${contact.firstName} ${contact.lastName}`
    if (!window.confirm(`Delete contact "${name}"? This cannot be undone.`)) return
    try {
      await api.delete(`/contacts/${contact.id}`)
      setContacts(prev => prev.filter(c => c.id !== contact.id))
    } catch (e) { alert(e.message) }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Contacts</div>
          <div className="page-subtitle">Manage shipper and point-of-contact records</div>
        </div>
        <Link to="/contacts/new" className="btn btn-primary">+ New Contact</Link>
      </div>

      <div className="card">
        <div className="toolbar">
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
            <input
              className="search-input"
              placeholder="Search name, email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button type="submit" className="btn btn-ghost">Search</button>
          </form>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /> Loading…</div>
        ) : contacts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👤</div>
            <div className="empty-state-title">No contacts yet</div>
            <Link to="/contacts/new" className="btn btn-primary" style={{ marginTop: 12 }}>Add First Contact</Link>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Client</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(c => (
                  <tr key={c.id}>
                    <td><strong>{c.firstName} {c.lastName}</strong></td>
                    <td>{c.email || '—'}</td>
                    <td>{c.phone || '—'}</td>
                    <td>{c.client?.name || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td>
                      <Link to={`/contacts/${c.id}/edit`} className="btn btn-ghost btn-sm">Edit</Link>
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
