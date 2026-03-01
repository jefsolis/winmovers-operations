const BASE = '/api'

export async function apiFetch(path, { method = 'GET', body } = {}) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(`${BASE}${path}`, opts)
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({ error: res.statusText }))
  if (!res.ok) throw new Error(data.error || res.statusText)
  return data
}

export const api = {
  get:    (path)       => apiFetch(path),
  post:   (path, body) => apiFetch(path, { method: 'POST', body }),
  put:    (path, body) => apiFetch(path, { method: 'PUT', body }),
  delete: (path)       => apiFetch(path, { method: 'DELETE' })
}
