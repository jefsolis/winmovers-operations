import { getAccessToken, triggerLoginRedirect } from './auth/tokenHelper'

const BASE = '/api'

async function authHeaders() {
  const token = await getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function apiFetch(path, { method = 'GET', body } = {}) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }
  }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(`${BASE}${path}`, opts)
  if (res.status === 204) return null
  if (res.status === 401) {
    triggerLoginRedirect()
    throw new Error('Session expired. Redirecting to login…')
  }
  const data = await res.json().catch(() => ({ error: res.statusText }))
  if (!res.ok) throw new Error(data.error || res.statusText)
  return data
}

export async function apiUpload(path, formData) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    body: formData,
    headers: await authHeaders(),
  })
  const data = await res.json().catch(() => ({ error: res.statusText }))
  if (!res.ok) throw new Error(data.error || res.statusText)
  return data
}

export const api = {
  get:    (path)       => apiFetch(path),
  post:   (path, body) => apiFetch(path, { method: 'POST', body }),
  put:    (path, body) => apiFetch(path, { method: 'PUT', body }),
  patch:  (path, body) => apiFetch(path, { method: 'PATCH', body }),
  delete: (path)       => apiFetch(path, { method: 'DELETE' }),
  upload: (path, formData) => apiUpload(path, formData),
}
