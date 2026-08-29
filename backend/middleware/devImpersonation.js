const { getPrisma } = require('../db')

const IMPERSONATION_HEADER = 'x-dev-impersonate-staff-id'

function isDevImpersonationEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.DEV_IMPERSONATION_ENABLED === 'true'
}

async function devImpersonationMiddleware(req, _res, next) {
  if (!isDevImpersonationEnabled()) return next()

  const staffId = req.headers[IMPERSONATION_HEADER]
  if (!staffId || Array.isArray(staffId)) return next()

  try {
    const staff = await getPrisma().staffMember.findFirst({
      where: { id: staffId, isActive: true },
      select: { id: true, azureOid: true, name: true, email: true },
    })
    if (!staff) return next()

    req.actualUser = req.user
    req.user = {
      ...req.user,
      oid: staff.azureOid || `dev-impersonation:${staff.id}`,
      name: staff.name,
      email: staff.email,
    }
    req.devImpersonatingStaffId = staff.id
    next()
  } catch (err) { next(err) }
}

module.exports = { devImpersonationMiddleware, isDevImpersonationEnabled, IMPERSONATION_HEADER }
