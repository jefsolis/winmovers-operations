const router = require('express').Router()
const { getPrisma } = require('../db')

/**
 * GET /api/audit
 * Query params:
 *   entityType, entityId  — required together for per-record History tab
 *   action, userId, userName, from, to  — optional admin filters
 *   page (1-based), limit (max 200)
 *
 * When entityType + entityId are both provided → per-record query (any authenticated user).
 * When either is omitted → admin-level query returning all records with optional filters.
 */
router.get('/', async (req, res, next) => {
  try {
    const { entityType, entityId, action, userId, userName, from, to, page = '1', limit = '50' } = req.query
    const take = Math.min(parseInt(limit, 10) || 50, 200)
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take

    const where = {}
    if (entityType) where.entityType = entityType
    if (entityId)   where.entityId   = entityId
    if (action)     where.action     = action
    if (userId)     where.userId     = userId
    if (userName)   where.userName   = { contains: userName, mode: 'insensitive' }
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to) {
        // Date inputs give "YYYY-MM-DD" which parses as midnight UTC.
        // Advance by one day and use < so the full selected day is included.
        const toDate = new Date(to)
        toDate.setUTCDate(toDate.getUTCDate() + 1)
        where.createdAt.lt = toDate
      }
    }

    // Job history is combined with the history of any ScheduleEntry linked to that job
    // (jobId lives inside the before/after JSON snapshot, not as its own AuditLog column).
    if (entityType === 'Job' && entityId) {
      const scheduleWhere = {
        entityType: 'ScheduleEntry',
        ...(action   ? { action } : {}),
        ...(userId   ? { userId } : {}),
        ...(userName ? { userName: { contains: userName, mode: 'insensitive' } } : {}),
        ...(where.createdAt ? { createdAt: where.createdAt } : {}),
        OR: [
          { before: { path: ['jobId'], equals: entityId } },
          { after:  { path: ['jobId'], equals: entityId } },
        ],
      }
      const [jobEntries, scheduleEntries] = await Promise.all([
        getPrisma().auditLog.findMany({ where, orderBy: { createdAt: 'desc' } }),
        getPrisma().auditLog.findMany({ where: scheduleWhere, orderBy: { createdAt: 'desc' } }),
      ])
      const combined = [...jobEntries, ...scheduleEntries]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(e => ({ ...e, source: e.entityType === 'ScheduleEntry' ? 'Schedule' : 'Job' }))
      const total = combined.length
      const entries = combined.slice(skip, skip + take)
      return res.json({ total, entries })
    }

    const [total, entries] = await Promise.all([
      getPrisma().auditLog.count({ where }),
      getPrisma().auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
    ])

    res.json({ total, entries: entries.map(e => ({ ...e, source: e.entityType === 'ScheduleEntry' ? 'Schedule' : e.entityType })) })
  } catch (err) { next(err) }
})

module.exports = router
