import { useEffect, useState } from 'react'

const POLL_INTERVAL_MS  = 5 * 60 * 1000  // 5 minutes
const DISMISSED_KEY     = 'winmovers_dismissed_build'
const CURRENT_BUILD_ID  = import.meta.env.VITE_BUILD_ID || 'dev'

export default function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    // If the env is dev we skip polling entirely (no meaningful build IDs)
    if (CURRENT_BUILD_ID === 'dev') return

    let timerId

    async function check() {
      if (document.visibilityState === 'hidden') return
      try {
        const res = await fetch('/api/version', { cache: 'no-store' })
        if (!res.ok) return
        const { buildId } = await res.json()
        if (buildId && buildId !== 'dev' && buildId !== CURRENT_BUILD_ID) {
          const dismissed = sessionStorage.getItem(DISMISSED_KEY)
          if (dismissed !== buildId) {
            setUpdateAvailable(true)
          }
        }
      } catch {
        // Network errors are silently ignored
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') check()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    timerId = setInterval(check, POLL_INTERVAL_MS)
    // Initial check after a short delay so it doesn't compete with page load
    const initial = setTimeout(check, 10_000)

    return () => {
      clearInterval(timerId)
      clearTimeout(initial)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  function dismiss() {
    setUpdateAvailable(false)
    // Remember dismissal per-version for the browser session
    sessionStorage.setItem(DISMISSED_KEY, CURRENT_BUILD_ID)
  }

  return { updateAvailable, dismiss }
}
