import React from 'react'
import { createRoot } from 'react-dom/client'
import { MsalProvider } from '@azure/msal-react'
import { msalInstance } from './auth/tokenHelper'
import AuthGuard from './auth/AuthGuard'
import App from './App'

msalInstance.initialize().then(() => {
  return msalInstance.handleRedirectPromise()
}).then(() => {
  // Clear any stale MSAL interaction lock left over from an aborted redirect
  // or a Vite HMR module reload. Safe to clear here because handleRedirectPromise()
  // has already finished processing any legitimate redirect response.
  Object.keys(window.sessionStorage)
    .filter(k => k.includes('interaction.status'))
    .forEach(k => window.sessionStorage.removeItem(k))

  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <AuthGuard>
          <App />
        </AuthGuard>
      </MsalProvider>
    </React.StrictMode>
  )
})
