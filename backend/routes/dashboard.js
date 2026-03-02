const router = require('express').Router()
const { getPrisma } = require('../db')

router.get('/', async (req, res, next) => {
  try {
    const p = getPrisma()
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11)
    twelveMonthsAgo.setDate(1)
    twelveMonthsAgo.setHours(0, 0, 0, 0)

    const [totalJobs, totalClients, totalContacts, byStatus, byType, byMode, recentJobs, monthlyJobs] = await Promise.all([
      p.job.count(),
      p.client.count(),
      p.contact.count(),
      p.job.groupBy({ by: ['status'], _count: { id: true } }),
      p.job.groupBy({ by: ['type'], _count: { id: true } }),
      p.job.groupBy({ by: ['shipmentMode'], _count: { id: true } }),
      p.job.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          contact: { select: { firstName: true, lastName: true } },
          client: { select: { name: true } }
        }
      }),
      p.job.findMany({
        where: { createdAt: { gte: twelveMonthsAgo } },
        select: { createdAt: true }
      })
    ])

    const activeStatuses = ['SURVEY', 'QUOTATION', 'BOOKING', 'PRE_MOVE', 'IN_TRANSIT']
    const activeJobs = byStatus
      .filter(s => activeStatuses.includes(s.status))
      .reduce((sum, s) => sum + s._count.id, 0)

    // Build last 12 months buckets
    const monthMap = {}
    for (let i = 0; i < 12; i++) {
      const d = new Date()
      d.setMonth(d.getMonth() - (11 - i))
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthMap[key] = 0
    }
    for (const job of monthlyJobs) {
      const d = new Date(job.createdAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (key in monthMap) monthMap[key]++
    }
    const jobsByMonth = Object.entries(monthMap).map(([month, count]) => ({ month, count }))

    res.json({
      totalJobs,
      activeJobs,
      totalClients,
      totalContacts,
      jobsByStatus: byStatus.map(s => ({ status: s.status, count: s._count.id })),
      jobsByType: byType.map(t => ({ type: t.type, count: t._count.id })),
      jobsByMode: byMode.filter(m => m.shipmentMode).map(m => ({ mode: m.shipmentMode, count: m._count.id })),
      jobsByMonth,
      recentJobs
    })
  } catch (err) { next(err) }
})

module.exports = router

