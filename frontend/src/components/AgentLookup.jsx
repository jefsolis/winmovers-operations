import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { api } from '../api'
import { useLanguage } from '../i18n'

/**
 * AgentLookup — typeahead search for agents.
 * Props:
 *  value        – { agentId: string, name: string }  (agentId can be '' | 'WINMOVERS' | UUID)
 *  onChange     – (newValue: { agentId, name }) => void
 *  allowWinMovers – boolean  show "WinMovers" as a pinned first option in the dropdown
 *  onCreateNew  – (name: string) => void  called when user wants to create a new agent
 *  required     – boolean
 */
export default function AgentLookup({
  value = { agentId: '', name: '' },
  onChange,
  allowWinMovers = false,
  onCreateNew,
  required = false,
}) {
  const { t } = useLanguage()
  const [results, setResults]       = useState([])
  const [open, setOpen]             = useState(false)
  const [searching, setSearching]   = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState(null)
  const inputRef    = useRef(null)
  const dropdownRef = useRef(null)
  const debounceRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = e => {
      if (
        inputRef.current && !inputRef.current.contains(e.target) &&
        (!dropdownRef.current || !dropdownRef.current.contains(e.target))
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Position dropdown via fixed coords
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

  // Debounced search
  useEffect(() => {
    if (value.agentId) return
    const q = (value.name || '').trim()
    clearTimeout(debounceRef.current)
    if (q.length < 2) {
      setResults([]); setOpen(false); setHasSearched(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await api.get(`/agents?search=${encodeURIComponent(q)}`)
        setResults(data)
        setOpen(true)
        setHasSearched(true)
      } catch { /* ignore */ }
      finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [value.name, value.agentId]) // eslint-disable-line

  const isSelected  = Boolean(value.agentId)
  const nameVal     = value.name || ''
  const showNoResults = !isSelected && hasSearched && results.length === 0 && !searching && nameVal.trim().length >= 2

  const handleSelect = a => {
    setOpen(false); setResults([]); setHasSearched(false)
    onChange({ agentId: a.id, name: a.name })
  }

  const handleSelectWinMovers = () => {
    setOpen(false); setResults([]); setHasSearched(false)
    onChange({ agentId: 'WINMOVERS', name: t('movingFiles.winmoversOption') })
  }

  const handleClear = () => {
    setOpen(false); setResults([]); setHasSearched(false)
    onChange({ agentId: '', name: '' })
  }

  return (
    <>
      <input
        ref={inputRef}
        className="form-control"
        value={nameVal}
        onChange={e => onChange({ agentId: '', name: e.target.value })}
        onFocus={() => { if ((results.length > 0 || allowWinMovers) && !isSelected) setOpen(true) }}
        placeholder={t('agents.lookupPlaceholder')}
        readOnly={isSelected}
        required={required && !isSelected}
        style={isSelected ? { background: 'var(--input-bg)' } : undefined}
      />

      {isSelected && (
        <button
          type="button"
          onClick={handleClear}
          style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', textAlign: 'left' }}
        >
          ✕ {t('common.clear')}
        </button>
      )}

      {searching && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>…</span>
      )}

      {showNoResults && !onCreateNew && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          {t('agents.noResults')}
        </div>
      )}

      {showNoResults && onCreateNew && (
        <div style={{ fontSize: 11, marginTop: 2 }}>
          <button
            type="button"
            onClick={() => { setOpen(false); onCreateNew(nameVal) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-accent, #2563eb)', padding: 0, fontSize: 11 }}
          >
            {t('agents.createNew')}
          </button>
        </div>
      )}

      {/* Dropdown */}
      {open && dropdownStyle && (
        <div ref={dropdownRef} style={dropdownStyle}>
          {allowWinMovers && (
            <div
              onMouseDown={handleSelectWinMovers}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg, #f0f4ff)' }}
              onMouseLeave={e => { e.currentTarget.style.background = '' }}
              style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 14, fontWeight: 600 }}
            >
              {t('movingFiles.winmoversOption')}
            </div>
          )}
          {results.map(a => (
            <div
              key={a.id}
              onMouseDown={() => handleSelect(a)}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg, #f0f4ff)' }}
              onMouseLeave={e => { e.currentTarget.style.background = '' }}
              style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 14 }}
            >
              <div style={{ fontWeight: 500 }}>{a.name}</div>
              {(a.city || a.country) && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {[a.city, a.country].filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          ))}
          {results.length === 0 && !allowWinMovers && (
            <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {t('agents.noResults')}
            </div>
          )}
        </div>
      )}
    </>
  )
}
