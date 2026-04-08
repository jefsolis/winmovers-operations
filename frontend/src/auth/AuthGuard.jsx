import { useEffect } from 'react'
import { useMsal, useIsAuthenticated } from '@azure/msal-react'
import { InteractionStatus } from '@azure/msal-browser'
import { loginRequest } from './msalConfig'

// Module-level flag — immune to React StrictMode double-invoking effects
let loginInitiated = false

/**
 * Wraps the entire app. If the user is not authenticated and no interaction
 * is in progress, triggers the redirect login flow automatically.
 */
export default function AuthGuard({ children }) {
  const { instance, inProgress } = useMsal()
  const isAuthenticated = useIsAuthenticated()

  useEffect(() => {
    if (!isAuthenticated && inProgress === InteractionStatus.None && !loginInitiated) {
      loginInitiated = true
      instance.loginRedirect(loginRequest).catch(err => {
        if (err.errorCode === 'interaction_in_progress') {
          // Another call already started the redirect — this is fine, stay silent
          return
        }
        // Real failure: allow a future retry
        loginInitiated = false
        console.error(err)
      })
    }
  }, [isAuthenticated, inProgress, instance])

  if (!isAuthenticated) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', flexDirection: 'column', gap: 16,
        fontFamily: 'sans-serif', color: '#475569',
      }}>
        <div style={{ fontSize: 40 }}>🚚</div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>WinMovers Operations</div>
        <div style={{ fontSize: 14 }}>Redirecting to login…</div>
      </div>
    )
  }

  return children
}
