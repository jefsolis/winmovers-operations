const { getPrisma } = require('../db')

// General schedule access: BODEGA/ADMIN or staff with canAccessSchedule
async function requireScheduleAccess(req, res, next) {
  try {
    const oid = req.user?.oid
    if (!oid) return res.status(403).json({ error: 'Forbidden' })
    const staff = await getPrisma().staffMember.findUnique({ where: { azureOid: oid } })
    if (!staff || (!staff.canAccessSchedule && staff.role !== 'ADMIN' && staff.role !== 'BODEGA')) {
      return res.status(403).json({ error: 'No tienes acceso a la Bitácora.' })
    }
    req.staff = staff
    next()
  } catch (err) { next(err) }
}

// Scheduling Manager: can configure capacity and resolve overbooked days.
// Self-contained (resolves req.staff itself) so it can be used standalone,
// not just chained after requireScheduleAccess.
async function requireScheduleManager(req, res, next) {
  try {
    let staff = req.staff
    if (!staff) {
      const oid = req.user?.oid
      if (!oid) return res.status(403).json({ error: 'Forbidden' })
      staff = await getPrisma().staffMember.findUnique({ where: { azureOid: oid } })
      req.staff = staff
    }
    if (!staff || (!staff.canManageSchedule && staff.role !== 'ADMIN')) {
      return res.status(403).json({ error: 'No tienes permiso para administrar la capacidad de la Bitácora.' })
    }
    next()
  } catch (err) { next(err) }
}

module.exports = { requireScheduleAccess, requireScheduleManager, isScheduleManager }

// Non-middleware check for use inside handlers that only need to gate a single
// field (e.g. a job's crew size) rather than the whole route.
async function isScheduleManager(req) {
  let staff = req.staff
  if (!staff) {
    const oid = req.user?.oid
    if (!oid) return false
    staff = await getPrisma().staffMember.findUnique({ where: { azureOid: oid } })
    req.staff = staff
  }
  return Boolean(staff && (staff.canManageSchedule || staff.role === 'ADMIN'))
}
