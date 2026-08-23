const { getPrisma } = require('../db')

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function isReadOnlyMethod(method) {
  return READ_METHODS.has(method)
}

function pathMatches(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

module.exports = async function accessControlMiddleware(req, res, next) {
  try {
    const oid = req.user?.oid
    if (!oid) return next()

    const currentStaff = await getPrisma().staffMember.findUnique({
      where: { azureOid: oid },
      select: { role: true },
    })

    req.currentStaff = currentStaff || null

    if (currentStaff?.role !== 'BODEGA') return next()

    const pathname = req.path || ''

    // Always allow session/self endpoints needed by the app shell.
    if (pathMatches(pathname, '/staff/me')) return next()

    // Bodega: Schedule module allowed.
    if (pathMatches(pathname, '/schedule')) return next()

    // Bodega: full access to packing lists (primary workflow for warehouse staff).
    if (pathMatches(pathname, '/packing-lists')) return next()

    // Bodega: Jobs module read-only.
    if (pathMatches(pathname, '/jobs') && isReadOnlyMethod(req.method)) return next()

    // Bodega: allow reading staff list/details (needed by Schedule assignee selector).
    if (pathMatches(pathname, '/staff') && isReadOnlyMethod(req.method)) return next()

    return res.status(403).json({ error: 'Forbidden: your role does not have access to this resource.' })
  } catch (err) {
    return next(err)
  }
}
