const router = require('express').Router()
const { getPrisma } = require('../db')

router.get('/', async (req, res, next) => {
  try {
    const p = getPrisma()
    const [totalJobs, totalClients, totalContacts, byStatus, byType, recentJobs] = await Promise.all([
      p.job.count(),
      p.client.count(),
      p.contact.count(),
      p.job.groupBy({ by: ['status'], _count: { id: true } }),
      p.job.groupBy({ by: ['type'], _count: { id: true } }),
      p.job.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          contact: { select: { firstName: true, lastName: true } },
          client: { select: { name: true } }
        }
      })
    ])

    const activeStatuses = ['SURVEY', 'QUOTATION', 'BOOKING', 'PRE_MOVE', 'IN_TRANSIT']
    const activeJobs = byStatus
      .filter(s => activeStatuses.includes(s.status))
      .reduce((sum, s) => sum + s._count.id, 0)

    res.json({
      totalJobs,
      activeJobs,
      totalClients,
      totalContacts,
      jobsByStatus: byStatus.map(s => ({ status: s.status, count: s._count.id })),
      jobsByType: byType.map(t => ({ type: t.type, count: t._count.id })),
      recentJobs
    })
  } catch (err) { next(err) }
})

module.exports = router
