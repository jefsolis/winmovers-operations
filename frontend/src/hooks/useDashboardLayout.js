import { useState, useEffect } from 'react'
import { DASHBOARD_CARDS } from '../dashboardCards'
import { api } from '../api'

const STORAGE_KEY = 'winmovers_dashboard_layout'

// --- Storage layer ---
// localStorage is used as the immediate/offline store.
// On mount the hook fetches the server-persisted layout and overrides localStorage.
// Every toggle/reset is saved to both localStorage and the server.

function loadHidden() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed.hiddenCards) ? parsed.hiddenCards : null
  } catch { return null }
}

function saveHidden(hiddenCards) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ hiddenCards }))
  } catch {}
}

// --- Hook ---

export function useDashboardLayout() {
  const [hiddenCards, setHiddenCards] = useState(() => {
    const saved = loadHidden()
    // If never saved: hide cards that are defaultVisible: false
    return saved ?? DASHBOARD_CARDS.filter(c => !c.defaultVisible).map(c => c.id)
  })

  // On mount: load server-persisted layout (overrides localStorage).
  // Deferred via setTimeout to ensure it runs outside any React render/effect
  // phase — prevents MSAL from dispatching token events while React is still
  // committing (which causes "Cannot update MsalProvider while rendering Dashboard").
  useEffect(() => {
    const t = setTimeout(() => {
      api.get('/staff/me/dashboard-layout')
        .then(data => {
          if (Array.isArray(data?.hiddenCards)) {
            setHiddenCards(data.hiddenCards)
            saveHidden(data.hiddenCards)
          }
        })
        .catch(() => {}) // silent — keep localStorage state if request fails
    }, 0)
    return () => clearTimeout(t)
  }, [])

  const isVisible = id => !hiddenCards.includes(id)

  const toggle = id => {
    setHiddenCards(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      saveHidden(next)
      setTimeout(() => api.put('/staff/me/dashboard-layout', { hiddenCards: next }).catch(() => {}), 0)
      return next
    })
  }

  const reset = () => {
    const defaults = DASHBOARD_CARDS.filter(c => !c.defaultVisible).map(c => c.id)
    saveHidden(defaults)
    setTimeout(() => api.put('/staff/me/dashboard-layout', { hiddenCards: defaults }).catch(() => {}), 0)
    setHiddenCards(defaults)
  }

  return { isVisible, toggle, hiddenCards, reset }
}
