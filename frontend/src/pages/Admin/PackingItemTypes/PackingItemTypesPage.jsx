import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../../api'
import { useLanguage } from '../../../i18n'

// Parse a single CSV line respecting quoted fields
function parseCsvLine(line) {
  const result = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur.trim())
  return result
}

export default function PackingItemTypesPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const csvInputRef = useRef(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)   // null | 'new' | item object
  const [form, setForm] = useState({ nameEs: '', nameEn: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [importMsg, setImportMsg] = useState('')  // success/error from CSV import
  const [importing, setImporting] = useState(false)
  const [search, setSearch] = useState('')

  const displayed = search.trim()
    ? items.filter(item => {
        const q = search.trim().toLowerCase()
        return item.nameEs.toLowerCase().includes(q) || item.nameEn.toLowerCase().includes(q)
      })
    : items

  async function load() {
    setLoading(true)
    try {
      const data = await api.get('/packing-item-types/all')
      setItems(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function startNew() {
    setEditing('new')
    setForm({ nameEs: '', nameEn: '' })
    setError('')
  }

  function startEdit(item) {
    setEditing(item)
    setForm({ nameEs: item.nameEs, nameEn: item.nameEn })
    setError('')
  }

  function cancel() {
    setEditing(null)
    setError('')
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.nameEs.trim()) { setError(t('packingItemTypes.nameEsRequired')); return }
    if (!form.nameEn.trim()) { setError(t('packingItemTypes.nameEnRequired')); return }
    setSaving(true)
    setError('')
    try {
      if (editing === 'new') {
        await api.post('/packing-item-types', form)
      } else {
        await api.put(`/packing-item-types/${editing.id}`, form)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      setEditing(null)
      await load()
    } catch {
      setError('Save failed.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(item) {
    if (!window.confirm(t('packingItemTypes.deactivateConfirm'))) return
    await api.patch(`/packing-item-types/${item.id}/deactivate`)
    await load()
  }

  function handleCsvChange(e) {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''   // reset so same file can be re-selected
    const reader = new FileReader()
    reader.onload = async (ev) => {
      setImporting(true)
      setImportMsg('')
      try {
        const text = ev.target.result
        const lines = text.split(/\r?\n/).filter(l => l.trim())
        // Skip header row
        const dataRows = lines.slice(1)
        const valid = dataRows
          .map(l => parseCsvLine(l))
          .filter(cols => cols.length >= 2 && cols[0] && cols[1])
          .map(cols => ({ nameEs: cols[0], nameEn: cols[1] }))

        if (valid.length === 0) {
          setImportMsg('error:' + t('packingItemTypes.importNoRows'))
          return
        }

        let count = 0
        for (const row of valid) {
          try {
            await api.post('/packing-item-types', row)
            count++
          } catch { /* skip duplicates / validation errors */ }
        }

        setImportMsg('ok:' + t('packingItemTypes.importSuccess', { count }))
        await load()
      } catch (err) {
        setImportMsg('error:' + t('packingItemTypes.importError', { msg: err.message }))
      } finally {
        setImporting(false)
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  if (loading) return <div className="loading"><div className="spinner" /></div>

  return (
    <div className="page-content" style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <button onClick={() => navigate('/admin')} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0, marginBottom: 8 }}>
            ← {t('common.back')}
          </button>
          <h1 className="page-title">{t('packingItemTypes.title')}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>{t('packingItemTypes.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* CSV import */}
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={handleCsvChange}
          />
          <button
            className="btn btn-outline-secondary"
            onClick={() => csvInputRef.current.click()}
            disabled={importing}
            title={t('packingItemTypes.importCsvHint')}
          >
            {importing ? '⏳' : '📥'} {t('packingItemTypes.importCsv')}
          </button>
          {editing === null && (
            <button className="btn btn-primary" onClick={startNew}>{t('packingItemTypes.newItem')}</button>
          )}
        </div>
      </div>

      {/* CSV import feedback */}
      {importMsg && (
        <div
          className={importMsg.startsWith('ok:') ? 'alert alert-success' : 'alert alert-danger'}
          style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span>{importMsg.slice(3)}</span>
          <button onClick={() => setImportMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}

      {saved && <div className="alert alert-success" style={{ marginBottom: 16 }}>{t('packingItemTypes.saved')}</div>}

      {editing !== null && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body">
            <h5 style={{ marginBottom: 16 }}>
              {editing === 'new' ? t('packingItemTypes.createItem') : t('packingItemTypes.editItem')}
            </h5>
            <form onSubmit={handleSave}>
              {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
              {/* Side-by-side inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label className="form-label">{t('packingItemTypes.nameEs')}</label>
                  <input
                    className="form-control"
                    value={form.nameEs}
                    onChange={e => setForm(f => ({ ...f, nameEs: e.target.value }))}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="form-label">{t('packingItemTypes.nameEn')}</label>
                  <input
                    className="form-control"
                    value={form.nameEn}
                    onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? t('common.saving') : t('common.save')}
                </button>
                <button type="button" className="btn btn-secondary" onClick={cancel}>{t('common.cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {/* Search bar */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <input
              className="form-control"
              placeholder={t('packingItemTypes.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ maxWidth: 320 }}
            />
          </div>
          {displayed.length === 0 ? (
            <p style={{ padding: 16, color: 'var(--text-muted)' }}>
              {search.trim() ? t('common.noResults') : t('packingItemTypes.empty')}
            </p>
          ) : (
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>{t('packingItemTypes.nameEs')}</th>
                  <th>{t('packingItemTypes.nameEn')}</th>
                  <th style={{ width: 80 }}>{t('packingItemTypes.active')}</th>
                  <th style={{ width: 150 }}></th>
                </tr>
              </thead>
              <tbody>
                {displayed.map(item => (
                  <tr key={item.id} style={{ opacity: item.active ? 1 : 0.5 }}>
                    <td>{item.nameEs}</td>
                    <td>{item.nameEn}</td>
                    <td style={{ color: item.active ? 'var(--success, #16a34a)' : 'var(--text-muted)' }}>
                      {item.active ? '✓' : t('packingItemTypes.inactive')}
                    </td>
                    <td>
                      <button className="btn btn-sm btn-outline-secondary" style={{ marginRight: 6 }} onClick={() => startEdit(item)}>
                        {t('packingItemTypes.editItem')}
                      </button>
                      {item.active && (
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeactivate(item)}>
                          {t('packingItemTypes.deactivate')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
