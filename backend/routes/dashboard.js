const router = require('express').Router()
const { getPrisma } = require('../db')

router.get('/', async (req, res, next) => {
  try {
    const p = getPrisma()
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11)
    twelveMonthsAgo.setDate(1)
    twelveMonthsAgo.setHours(0, 0, 0, 0)

    const [
      totalJobs, totalClients, totalContacts,
      byStatus, byType, byMode, recentJobs, monthlyJobs, monthlyVisits, monthlyQuotes,
      totalVisits, visitsByStatus,
      quotesByStatus,
      upcomingVisits, pendingQuotesList,
    ] = await Promise.all([
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
      }),
      p.visit.findMany({
        where: { createdAt: { gte: twelveMonthsAgo } },
        select: { createdAt: true }
      }),
      p.quote.findMany({
        where: { createdAt: { gte: twelveMonthsAgo } },
        select: { createdAt: true }
      }),
      // Visits
      p.visit.count(),
      p.visit.groupBy({ by: ['status'], _count: { id: true } }),
      // Quotes
      p.quote.groupBy({ by: ['status'], _count: { id: true } }),
      // Upcoming scheduled visits (next 5 by scheduledDate)
      p.visit.findMany({
        where: { status: 'SCHEDULED' },
        orderBy: { scheduledDate: 'asc' },
        take: 5,
        include: {
          client:     { select: { name: true, firstName: true, lastName: true, clientType: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      }),
      // SENT quotes expiring soonest
      p.quote.findMany({
        where: { status: 'SENT' },
        orderBy: { validUntil: 'asc' },
        take: 5,
        include: {
          visit: { select: { prospectName: true, client: { select: { name: true, firstName: true, lastName: true, clientType: true } } } },
        },
      }),
    ])

    const activeStatuses = ['SURVEY', 'QUOTATION', 'BOOKING', 'PRE_MOVE', 'IN_TRANSIT']
    const activeJobs = byStatus
      .filter(s => activeStatuses.includes(s.status))
      .reduce((sum, s) => sum + s._count.id, 0)

    // Visit stats
    const openVisitStatuses = ['SCHEDULED', 'COMPLETED']
    const openVisits = visitsByStatus
      .filter(s => openVisitStatuses.includes(s.status))
      .reduce((sum, s) => sum + s._count.id, 0)

    // Quote stats
    const quotesMap = Object.fromEntries(quotesByStatus.map(s => [s.status, s._count.id]))
    const pendingQuotes = (quotesMap['DRAFT'] || 0) + (quotesMap['SENT'] || 0)
    const acceptedQuotes = quotesMap['ACCEPTED'] || 0
    const rejectedQuotes = quotesMap['REJECTED'] || 0
    const decidedQuotes = acceptedQuotes + rejectedQuotes
    const conversionRate = decidedQuotes > 0 ? Math.round((acceptedQuotes / decidedQuotes) * 100) : null

    // Pipeline counts
    const totalQuoted = visitsByStatus.find(s => s.status === 'QUOTED')?._count.id || 0

    // Build last 12 months buckets (jobs + visits + quotes)
    const monthKeys = []
    for (let i = 0; i < 12; i++) {
      const d = new Date()
      d.setMonth(d.getMonth() - (11 - i))
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    const jobsMap    = Object.fromEntries(monthKeys.map(k => [k, 0]))
    const visitsMap  = Object.fromEntries(monthKeys.map(k => [k, 0]))
    const quotesMap2 = Object.fromEntries(monthKeys.map(k => [k, 0]))
    const toKey = dt => { const d = new Date(dt); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }
    for (const j of monthlyJobs)   { const k = toKey(j.createdAt);   if (k in jobsMap)    jobsMap[k]++ }
    for (const v of monthlyVisits) { const k = toKey(v.createdAt);   if (k in visitsMap)  visitsMap[k]++ }
    for (const q of monthlyQuotes) { const k = toKey(q.createdAt);   if (k in quotesMap2) quotesMap2[k]++ }
    const activityByMonth = monthKeys.map(month => ({
      month,
      jobs:    jobsMap[month],
      visits:  visitsMap[month],
      quotes:  quotesMap2[month],
    }))
    const jobsByMonth = activityByMonth // keep backward-compat key name

    res.json({
      totalJobs,
      activeJobs,
      totalClients,
      totalContacts,
      jobsByStatus: byStatus.map(s => ({ status: s.status, count: s._count.id })),
      jobsByType: byType.map(t => ({ type: t.type, count: t._count.id })),
      jobsByMode: byMode.filter(m => m.shipmentMode).map(m => ({ mode: m.shipmentMode, count: m._count.id })),
      jobsByMonth,
      recentJobs,
      // Visits & quotes
      totalVisits,
      openVisits,
      pendingQuotes,
      acceptedQuotes,
      rejectedQuotes,
      conversionRate,
      // Pipeline funnel: total visits → quoted → accepted quote → jobs
      pipeline: {
        visits: totalVisits,
        quoted: totalQuoted,
        accepted: acceptedQuotes,
        jobs: totalJobs,
      },
      upcomingVisits,
      pendingQuotesList,
    })
  } catch (err) { next(err) }
})

module.exports = router

