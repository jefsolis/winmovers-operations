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

    const [total, entries] = await Promise.all([
      getPrisma().auditLog.count({ where }),
      getPrisma().auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
    ])

    res.json({ total, entries })
  } catch (err) { next(err) }
})

module.exports = router
