const jwt = require('jsonwebtoken')
const jwksClient = require('jwks-rsa')

const tenantId = process.env.AZURE_TENANT_ID
const clientId = process.env.AZURE_CLIENT_ID

const client = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
  cache: true,
  cacheMaxAge: 86400000, // 24 hours
})

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err)
    callback(null, key.getPublicKey())
  })
}

module.exports = function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization']
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' })
  }
  const token = authHeader.slice(7)

  jwt.verify(
    token,
    getKey,
    {
      audience: `api://${clientId}`,
      issuer: [
        `https://login.microsoftonline.com/${tenantId}/v2.0`,
        `https://sts.windows.net/${tenantId}/`,
      ],
      algorithms: ['RS256'],
    },
    (err, decoded) => {
      if (err) {
        console.error('JWT verification failed:', err.message)
        return res.status(401).json({ error: 'Unauthorized' })
      }
      // Attach user info to request for use in route handlers
      req.user = {
        oid:   decoded.oid,
        name:  decoded.name,
        email: decoded.preferred_username || decoded.email,
        roles: decoded.roles || [],
      }
      next()
    }
  )
}
