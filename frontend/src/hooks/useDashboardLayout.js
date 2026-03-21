import { useState } from 'react'
import { DASHBOARD_CARDS } from '../dashboardCards'

const STORAGE_KEY = 'winmovers_dashboard_layout'

// --- Storage layer ---
// Future: replace these two functions with API calls (GET/PUT /api/me/dashboard-layout)
// once user authentication exists. The hook interface will stay identical.

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
    // If never saved: hide cards that are defaultVisible: false (e.g. my_appointments)
    return saved ?? DASHBOARD_CARDS.filter(c => !c.defaultVisible).map(c => c.id)
  })

  const isVisible = id => !hiddenCards.includes(id)

  const toggle = id => {
    setHiddenCards(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      saveHidden(next)
      return next
    })
  }

  const reset = () => {
    const defaults = DASHBOARD_CARDS.filter(c => !c.defaultVisible).map(c => c.id)
    saveHidden(defaults)
    setHiddenCards(defaults)
  }

  return { isVisible, toggle, hiddenCards, reset }
}
