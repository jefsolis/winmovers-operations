/**
 * Microsoft Graph API helpers — used for Azure AD user search and app role lookup.
 * Authenticates via client credentials (app-only) using AZURE_CLIENT_SECRET.
 */

// ── Token cache ───────────────────────────────────────────────────────────────
let _token = null
let _tokenExpiry = 0

async function getGraphToken() {
  if (_token && Date.now() < _tokenExpiry - 30_000) return _token

  const params = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     process.env.AZURE_CLIENT_ID,
    client_secret: process.env.AZURE_CLIENT_SECRET,
    scope:         'https://graph.microsoft.com/.default',
  })

  const res = await fetch(
    `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params }
  )
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Graph token request failed (${res.status}): ${body}`)
  }
  const data = await res.json()
  _token = data.access_token
  _tokenExpiry = Date.now() + data.expires_in * 1000
  return _token
}

async function graphGet(path) {
  const token = await getGraphToken()
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${token}`, ConsistencyLevel: 'eventual' },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Graph API ${res.status}: ${body}`)
  }
  return res.json()
}

// ── Service principal / app roles cache ──────────────────────────────────────
// Populated on first use, lives for the process lifetime.
let _spId = null
let _appRoleMap = null   // { roleId: roleValue }  e.g. { 'guid': 'Admin' }

async function ensureSpCached() {
  if (_spId) return
  const clientId = process.env.AZURE_CLIENT_ID
  const data = await graphGet(
    `/servicePrincipals?$filter=appId eq '${clientId}'&$select=id,appRoles`
  )
  const sp = data.value?.[0]
  if (!sp) throw new Error('Service principal not found for this app in the tenant')
  _spId = sp.id
  _appRoleMap = Object.fromEntries((sp.appRoles ?? []).map(r => [r.id, r.value]))
}

/**
 * Returns the App Role value (e.g. 'Admin', 'Coordinator') assigned to a user
 * in this app, or null if they have no role.
 */
async function getUserAdRole(userId) {
  try {
    await ensureSpCached()
    const data = await graphGet(`/users/${userId}/appRoleAssignments`)
    const assignment = (data.value ?? []).find(a => a.resourceId === _spId)
    return assignment ? (_appRoleMap[assignment.appRoleId] ?? null) : null
  } catch {
    return null
  }
}

/**
 * Search Azure AD users by display name or email prefix.
 * Returns [{ id, displayName, email, adRole }]
 *
 * Requires Application permissions: User.Read.All, Application.Read.All
 */
async function searchAzureUsers(query) {
  // Escape single quotes to prevent OData injection
  const safe = query.replace(/'/g, "''")
  // $search does substring matching on displayName and mail (requires ConsistencyLevel + $count)
  const search = `"displayName:${safe}" OR "mail:${safe}"`
  const path = `/users?$search=${encodeURIComponent(search)}&$select=id,displayName,mail,userPrincipalName&$top=10&$count=true`

  const data = await graphGet(path)
  const users = data.value ?? []

  // Fetch each user's app role in parallel
  const roles = await Promise.all(users.map(u => getUserAdRole(u.id)))

  return users.map((u, i) => ({
    id:          u.id,
    displayName: u.displayName,
    email:       u.mail || u.userPrincipalName,
    adRole:      roles[i],   // e.g. 'Admin', 'Coordinator', or null
  }))
}

/**
 * Send an email via Microsoft Graph on behalf of the AZURE_MAIL_FROM mailbox.
 *
 * @param {object} opts
 * @param {string|string[]} opts.to           - Recipient address(es)
 * @param {string}          opts.subject      - Email subject
 * @param {string}          opts.html         - HTML body
 * @param {string}          [opts.replyTo]    - Reply-to address (coordinator's email)
 * @param {string}          [opts.replyToName]- Reply-to display name
 *
 * Requires Application permission: Mail.Send (admin consented)
 */
async function sendMail({ to, subject, html, replyTo, replyToName, _attachments }) {
  const from = process.env.AZURE_MAIL_FROM
  if (!from) throw new Error('AZURE_MAIL_FROM is not configured')

  const toAddresses = (Array.isArray(to) ? to : [to]).map(addr => ({
    emailAddress: { address: addr },
  }))

  const message = {
    subject,
    body:         { contentType: 'HTML', content: html },
    from:         { emailAddress: { address: from } },
    toRecipients: toAddresses,
  }

  if (replyTo) {
    message.replyTo = [{ emailAddress: { address: replyTo, name: replyToName || replyTo } }]
  }

  if (_attachments?.length) {
    message.attachments = _attachments
  }

  const token = await getGraphToken()
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, saveToSentItems: true }),
    }
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`sendMail failed (${res.status}): ${body}`)
  }
}

module.exports = { searchAzureUsers, sendMail }
