const tenantId  = import.meta.env.VITE_AZURE_TENANT_ID
const clientId  = import.meta.env.VITE_AZURE_CLIENT_ID

export const msalConfig = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    silentRedirectUri: `${window.location.origin}/blank.html`,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
}

// Scopes requested when acquiring a token for the backend API
export const apiScopes = [`api://${clientId}/access_as_user`]

// Scopes used for the initial login (openid profile email)
export const loginRequest = {
  scopes: ['openid', 'profile', 'email', ...apiScopes],
}
