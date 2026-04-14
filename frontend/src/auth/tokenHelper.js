import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser'
import { msalConfig, apiScopes } from './msalConfig'

// Shared instance — initialized in main.jsx before the app mounts
const msalInstance = new PublicClientApplication(msalConfig)

/**
 * Silently acquires an access token for the backend API.
 * Falls back to redirect if interaction is required.
 */
export async function getAccessToken() {
  const accounts = msalInstance.getAllAccounts()
  if (!accounts.length) return null
  try {
    const result = await msalInstance.acquireTokenSilent({
      scopes: apiScopes,
      account: accounts[0],
    })
    return result.accessToken
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      msalInstance.acquireTokenRedirect({ scopes: apiScopes })
    }
    return null
  }
}

let _redirectInProgress = false

export function triggerLoginRedirect() {
  if (_redirectInProgress) return
  _redirectInProgress = true
  const accounts = msalInstance.getAllAccounts()
  const promise = accounts.length
    ? msalInstance.acquireTokenRedirect({ scopes: apiScopes })
    : msalInstance.loginRedirect()
  promise.catch(err => {
    if (err?.errorCode !== 'interaction_in_progress') console.error(err)
    _redirectInProgress = false
  })
}

export { msalInstance }
