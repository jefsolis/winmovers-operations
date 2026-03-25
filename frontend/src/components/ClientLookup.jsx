import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { api } from '../api'
import { useLanguage } from '../i18n'

function getDisplayName(c) {
  if (!c) return ''
  if (c.clientType === 'INDIVIDUAL') {
    return [c.firstName, c.lastName].filter(Boolean).join(' ') || c.name || ''
  }
  return c.name || ''
}

export default function ClientLookup({
  value = { clientId: '', name: '', phone: '', email: '' },
  onChange,
  clientType,
  showContact = true,
  placeholder,
  required = false,
  hintText,
  noResultsText,
  onCreateNew,
}) {
  const { t } = useLanguage()
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState(null)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)
  const debounceRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (
        inputRef.current && !inputRef.current.contains(e.target) &&
        (!dropdownRef.current || !dropdownRef.current.contains(e.target))
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Position dropdown via fixed coords when it opens
  useLayoutEffect(() => {
    if (open && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect()
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 2,
        left: rect.left,
        width: rect.width,
        zIndex: 200,
        background: 'var(--card-bg, white)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        maxHeight: 260,
        overflowY: 'auto',
      })
    } else {
      setDropdownStyle(null)
    }
  }, [open])

  // Search when name changes (debounced)
  useEffect(() => {
    if (value.clientId) return
    const q = (value.name || '').trim()
    clearTimeout(debounceRef.current)
    if (q.length < 2) {
      setResults([])
      setOpen(false)
      setHasSearched(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        let url = `/clients?search=${encodeURIComponent(q)}`
        if (clientType) url += `&clientType=${clientType}`
        const data = await api.get(url)
        setResults(data)
        setOpen(true)
        setHasSearched(true)
      } catch { /* ignore network errors */ }
      finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [value.name, value.clientId]) // eslint-disable-line

  const handleNameChange = (e) => {
    onChange({ clientId: null, name: e.target.value, phone: value.phone || '', email: value.email || '' })
  }

  const handleSelect = (c) => {
    setOpen(false)
    setResults([])
    setHasSearched(false)
    onChange({ clientId: c.id, name: getDisplayName(c), phone: c.phone || '', email: c.email || '' })
  }

  const handleClear = () => {
    setOpen(false)
    setResults([])
    setHasSearched(false)
    onChange({ clientId: null, name: '', phone: '', email: '' })
  }

  const isSelected = Boolean(value.clientId)
  const nameVal = value.name || ''
  const showNewHint = !isSelected && hasSearched && results.length === 0 && !searching && nameVal.trim().length >= 2

  return (
    <>
      <input
        ref={inputRef}
        className="form-control"
        value={nameVal}
        onChange={handleNameChange}
        onFocus={() => { if (results.length > 0 && !isSelected) setOpen(true) }}
        placeholder={placeholder || t('clients.lookupPlaceholder')}
        readOnly={isSelected}
        required={required}
        style={isSelected ? { background: 'var(--input-bg)' } : undefined}
      />
      {isSelected && (
        <button
          type="button"
          onClick={handleClear}
          style={{
            display: 'block', fontSize: 11, color: 'var(--text-muted)',
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '2px 0', textAlign: 'left',
          }}
        >✕ {t('common.clear')}</button>
      )}
      {searching && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>…</span>
      )}
      {showNewHint && !onCreateNew && (
        <div style={{ fontSize: 11, color: 'var(--text-accent, #2563eb)', marginTop: 2 }}>
          ✦ {hintText || t('clients.willBeCreated')}
        </div>
      )}
      {showNewHint && onCreateNew && (
        <div style={{ fontSize: 11, marginTop: 2 }}>
          <button
            type="button"
            onClick={() => onCreateNew(nameVal)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-accent, #2563eb)', padding: 0, fontSize: 11 }}
          >
            {hintText || t('clients.addDetailsCreate')}
          </button>
        </div>
      )}

      {/* Dropdown — fixed position, anchored to input via getBoundingClientRect */}
      {open && dropdownStyle && (
        <div ref={dropdownRef} style={dropdownStyle}>
          {results.length > 0 ? results.map(c => (
            <div
              key={c.id}
              onMouseDown={() => handleSelect(c)}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg, #f0f4ff)' }}
              onMouseLeave={e => { e.currentTarget.style.background = '' }}
              style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 14 }}
            >
              <div style={{ fontWeight: 500 }}>{getDisplayName(c)}</div>
              {(c.phone || c.email) && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {[c.phone, c.email].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
          )) : (
            <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {noResultsText || t('clients.noResultsNew')}
            </div>
          )}
        </div>
      )}

      {/* Phone + Email sub-fields */}
      {showContact && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          <div>
            <label className="form-label" style={{ fontSize: 12, marginBottom: 3 }}>{t('common.phone')}</label>
            <input
              className="form-control"
              value={value.phone || ''}
              readOnly={isSelected}
              onChange={e => onChange({ ...value, clientId: null, phone: e.target.value })}
              placeholder="+57 300 000 0000"
              style={isSelected ? { background: 'var(--input-bg)' } : undefined}
            />
          </div>
          <div>
            <label className="form-label" style={{ fontSize: 12, marginBottom: 3 }}>{t('common.email')}</label>
            <input
              className="form-control"
              value={value.email || ''}
              readOnly={isSelected}
              onChange={e => onChange({ ...value, clientId: null, email: e.target.value })}
              type="email"
              placeholder="email@example.com"
              style={isSelected ? { background: 'var(--input-bg)' } : undefined}
            />
          </div>
        </div>
      )}
    </>
  )
}
