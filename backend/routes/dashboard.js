const router = require('express').Router()
const { getPrisma } = require('../db')

function toMonthKey(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function toInputDate(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toInputMonth(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function buildMonthKeys(start, end) {
  const keys = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const last = new Date(end.getFullYear(), end.getMonth(), 1)
  while (cursor <= last) {
    keys.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`)
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return keys
}

function parseDateRange(fromRaw, toRaw) {
  const now = new Date()
  const fallbackTo = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  const fallbackFrom = new Date(now.getFullYear(), now.getMonth() - 11, 1, 0, 0, 0, 0)

  const parsedFrom = fromRaw ? new Date(`${fromRaw}T00:00:00`) : null
  const parsedTo = toRaw ? new Date(`${toRaw}T23:59:59.999`) : null
  const isValid = parsedFrom && parsedTo && !Number.isNaN(parsedFrom.getTime()) && !Number.isNaN(parsedTo.getTime()) && parsedFrom <= parsedTo

  return {
    from: isValid ? parsedFrom : fallbackFrom,
    to: isValid ? parsedTo : fallbackTo,
  }
}

function parseMonthRange(fromRaw, toRaw) {
  const now = new Date()
  const fallbackFrom = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
  const fallbackTo = new Date(now.getFullYear(), 11 + 1, 0, 23, 59, 59, 999)

  const monthPattern = /^\d{4}-\d{2}$/
  const isFromValid = monthPattern.test(String(fromRaw || ''))
  const isToValid = monthPattern.test(String(toRaw || ''))

  if (!isFromValid || !isToValid) {
    return { from: fallbackFrom, to: fallbackTo }
  }

  const parsedFrom = new Date(`${fromRaw}-01T00:00:00`)
  const parsedTo = new Date(`${toRaw}-01T00:00:00`)
  if (Number.isNaN(parsedFrom.getTime()) || Number.isNaN(parsedTo.getTime()) || parsedFrom > parsedTo) {
    return { from: fallbackFrom, to: fallbackTo }
  }

  return {
    from: new Date(parsedFrom.getFullYear(), parsedFrom.getMonth(), 1, 0, 0, 0, 0),
    to: new Date(parsedTo.getFullYear(), parsedTo.getMonth() + 1, 0, 23, 59, 59, 999),
  }
}

router.get('/pounds', async (req, res, next) => {
  try {
    const p = getPrisma()
    const { fromRaw, toRaw } = { fromRaw: req.query.from, toRaw: req.query.to }
    const { from, to } = parseMonthRange(fromRaw, toRaw)

    const monthKeys = buildMonthKeys(from, to)
    const totalsByMonth = Object.fromEntries(monthKeys.map(k => [k, {
      packed: 0,
      unpacked: 0,
      local: 0,
      packedJobs: 0,
      unpackedJobs: 0,
      localJobs: 0,
    }]))

    const [files, localJobs] = await Promise.all([
      p.movingFile.findMany({
        where: {
          createdAt: { gte: from, lte: to },
          category: { in: ['EXPORT', 'IMPORT'] },
          deletedAt: null,
        },
        select: { createdAt: true, category: true, weightKg: true },
      }),
      p.job.findMany({
        where: {
          createdAt: { gte: from, lte: to },
          type: { in: ['EXPORT', 'IMPORT', 'DOMESTIC', 'LOCAL'] },
        },
        select: { createdAt: true, type: true },
      }),
    ])

    for (const f of files) {
      const key = toMonthKey(f.createdAt)
      if (!totalsByMonth[key]) continue
      if (f.category === 'EXPORT') {
        totalsByMonth[key].packedJobs += 1
        if (f.weightKg == null) continue
        totalsByMonth[key].packed += Number(f.weightKg || 0)
      } else if (f.category === 'IMPORT') {
        totalsByMonth[key].unpackedJobs += 1
        if (f.weightKg == null) continue
        totalsByMonth[key].unpacked += Number(f.weightKg || 0)
      }
    }

    for (const j of localJobs) {
      const key = toMonthKey(j.createdAt)
      if (!totalsByMonth[key]) continue
      if (j.type === 'DOMESTIC' || j.type === 'LOCAL') {
        totalsByMonth[key].local += 1
        totalsByMonth[key].localJobs += 1
      }
    }

    const months = monthKeys.map(month => ({
      month,
      packed: Number(totalsByMonth[month].packed.toFixed(2)),
      unpacked: Number(totalsByMonth[month].unpacked.toFixed(2)),
      local: totalsByMonth[month].local,
      packedJobs: totalsByMonth[month].packedJobs,
      unpackedJobs: totalsByMonth[month].unpackedJobs,
      localJobs: totalsByMonth[month].localJobs,
    }))

    const totals = months.reduce((acc, m) => {
      acc.packed += m.packed
      acc.unpacked += m.unpacked
      acc.local += m.local
      acc.packedJobs += m.packedJobs
      acc.unpackedJobs += m.unpackedJobs
      acc.localJobs += m.localJobs
      return acc
    }, {
      packed: 0,
      unpacked: 0,
      local: 0,
      packedJobs: 0,
      unpackedJobs: 0,
      localJobs: 0,
    })

    res.json({
      from: toInputMonth(from),
      to: toInputMonth(to),
      months,
      totals: {
        packed: Number(totals.packed.toFixed(2)),
        unpacked: Number(totals.unpacked.toFixed(2)),
        local: totals.local,
        packedJobs: totals.packedJobs,
        unpackedJobs: totals.unpackedJobs,
        localJobs: totals.localJobs,
      },
    })
  } catch (err) {
    next(err)
  }
})

router.get('/', async (req, res, next) => {
  try {
    const p = getPrisma()
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11)
    twelveMonthsAgo.setDate(1)
    twelveMonthsAgo.setHours(0, 0, 0, 0)

    const oid = req.user?.oid ?? null
    const myAppointmentsQuery = oid
      ? p.visit.findMany({
          where: {
            status: 'SCHEDULED',
            scheduledDate: { gte: new Date() },
            assignedTo: { azureOid: oid },
          },
          orderBy: { scheduledDate: 'asc' },
          take: 20,
          select: {
            id: true, visitNumber: true, scheduledDate: true, status: true,
            serviceType: true, prospectName: true, originAddress: true, originCity: true,
            client: { select: { name: true, firstName: true, lastName: true, clientType: true } },
            corporateClient: { select: { name: true } },
          },
        })
      : Promise.resolve([])

    const myCoordinationsQuery = oid
      ? p.movingFile.findMany({
          where: { status: 'OPEN', deletedAt: null, coordinator: { azureOid: oid } },
          orderBy: [{ category: 'asc' }, { fileNumber: 'asc' }],
          take: 50,
          select: {
            id: true, fileNumber: true, category: true, status: true, createdAt: true,
            client: { select: { name: true, firstName: true, lastName: true, clientType: true } },
            corporateClient: { select: { name: true } },
          },
        })
      : Promise.resolve([])

    const [
      totalJobs, totalClients,
      byStatus, byType, byMode, recentJobs, monthlyJobs, monthlyVisits, monthlyQuotes,
      totalVisits, visitsByStatus,
      quotesByStatus,
      upcomingVisits, pendingQuotesList,
      openFilesWithAttachments,
      openLocalFiles,
      openExportFiles,
      openImportFiles,
      deliveryDocFiles,
      myAppointments,
      myCoordinations,
    ] = await Promise.all([
      p.job.count(),
      p.client.count(),
      p.job.groupBy({ by: ['status'], _count: { id: true } }),
      p.job.groupBy({ by: ['type'], _count: { id: true } }),
      p.job.groupBy({ by: ['shipmentMode'], _count: { id: true } }),
      p.job.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { name: true, firstName: true, lastName: true, clientType: true } }
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
        select: {
          id: true, visitNumber: true, scheduledDate: true, status: true,
          serviceType: true, prospectName: true,
          client:     { select: { name: true, firstName: true, lastName: true, clientType: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      }),
      // SENT quotes expiring soonest
      p.quote.findMany({
        where: { status: 'SENT' },
        orderBy: { validUntil: 'asc' },
        take: 5,
        select: {
          id: true, quoteNumber: true, validUntil: true, status: true,
          visit: { select: { prospectName: true, client: { select: { name: true, firstName: true, lastName: true, clientType: true } } } },
        },
      }),
      // Open files with their attachment categories for completion calculation
      p.movingFile.findMany({
        where: { status: 'OPEN', deletedAt: null },
        select: {
          id: true,
          category: true,
          bookerRole: true,
          attachments: { select: { category: true } },
        },
      }),
      // Open LOCAL files (for no-invoice cards)
      p.movingFile.findMany({
        where: { status: 'OPEN', category: 'LOCAL', deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, fileNumber: true, createdAt: true,
          client:          { select: { name: true, firstName: true, lastName: true, clientType: true } },
          corporateClient: { select: { name: true, firstName: true, lastName: true, clientType: true } },
          attachments: { select: { category: true } },
        },
      }),
      // Open EXPORT files (for no-invoice card)
      p.movingFile.findMany({
        where: { status: 'OPEN', category: 'EXPORT', deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, fileNumber: true, createdAt: true,
          client:          { select: { name: true, firstName: true, lastName: true, clientType: true } },
          corporateClient: { select: { name: true, firstName: true, lastName: true, clientType: true } },
          attachments: { select: { category: true } },
        },
      }),
      // Open IMPORT files (for no-invoice card)
      p.movingFile.findMany({
        where: { status: 'OPEN', category: 'IMPORT', deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, fileNumber: true, createdAt: true,
          client:          { select: { name: true, firstName: true, lastName: true, clientType: true } },
          corporateClient: { select: { name: true, firstName: true, lastName: true, clientType: true } },
          attachments: { select: { category: true } },
        },
      }),
      // IMPORT files where fechaEntrega has passed (delivery doc alerts)
      p.movingFile.findMany({
        where: {
          status: { notIn: ['CLOSED', 'VOID'] },
          category: 'IMPORT',
          fechaEntrega: { not: null, lt: new Date() },
          deletedAt: null,
        },
        orderBy: { fechaEntrega: 'asc' },
        select: {
          id: true, fileNumber: true, category: true, fechaEntrega: true,
          client:          { select: { name: true, firstName: true, lastName: true, clientType: true } },
          corporateClient: { select: { name: true } },
          attachments: { select: { category: true } },
        },
      }),
      myAppointmentsQuery,
      myCoordinationsQuery,
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

    // Files completion buckets
    const REQUIRED_DOCS = {
      EXPORT: ['SURVEY_REPORT','QUOTATION','WORK_ORDER','PRE_ADVICE','SHIPPING_INSTRUCTIONS','TRANSPORT_DOCUMENT','SIGNED_PACKING_LIST','INVOICE','DELIVERY_CONFIRMATION'],
      IMPORT: ['QUOTATION','WORK_ORDER','SHIPPING_INSTRUCTIONS','TRANSPORT_DOCUMENT','INVOICE','TARIFF_REPLY_EMAIL','DELIVERY_DOCS_EMAIL','DELIVERY_INFO_EMAIL','DELIVERY_REPORT'],
      LOCAL:  ['INVOICE'],
    }
    const completionBuckets = { none: 0, low: 0, mid: 0, high: 0, complete: 0 }
    for (const file of openFilesWithAttachments) {
      const required = (REQUIRED_DOCS[file.category] || []).filter(cat => {
        if (file.category === 'EXPORT' && cat === 'DELIVERY_CONFIRMATION') return file.bookerRole === 'BOOKER'
        return true
      })
      if (required.length === 0) continue
      const attached = new Set(file.attachments.map(a => a.category))
      const pct = Math.round((required.filter(r => attached.has(r)).length / required.length) * 100)
      if      (pct === 0)   completionBuckets.none++
      else if (pct <= 50)   completionBuckets.low++
      else if (pct <= 99)   completionBuckets.mid++
      else                  completionBuckets.complete++
    }
    const filesByCompletion = [
      { bucket: 'none',     label: '0%',        count: completionBuckets.none },
      { bucket: 'low',      label: '1–50%',     count: completionBuckets.low },
      { bucket: 'mid',      label: '51–99%',    count: completionBuckets.mid },
      { bucket: 'complete', label: '100%',      count: completionBuckets.complete },
    ]

    // Local files without invoice
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const localNoInvoice = openLocalFiles.filter(
      f => !f.attachments.some(a => a.category === 'INVOICE')
    ).map(f => ({
      id: f.id,
      fileNumber: f.fileNumber,
      createdAt: f.createdAt,
      client: f.corporateClient || f.client || null,
    }))
    const localNoInvoiceRecent = localNoInvoice.filter(f => new Date(f.createdAt) >= thirtyDaysAgo).reverse()
    const localNoInvoiceOld    = localNoInvoice.filter(f => new Date(f.createdAt) <  thirtyDaysAgo)

    // Export files without invoice
    const exportNoInvoice = openExportFiles
      .filter(f => !f.attachments.some(a => a.category === 'INVOICE'))
      .map(f => ({ id: f.id, fileNumber: f.fileNumber, createdAt: f.createdAt, client: f.corporateClient || f.client || null }))
    const exportNoInvoiceRecent = exportNoInvoice.filter(f => new Date(f.createdAt) >= thirtyDaysAgo).reverse()
    const exportNoInvoiceOld    = exportNoInvoice.filter(f => new Date(f.createdAt) <  thirtyDaysAgo)

    // Import files without invoice
    const importNoInvoice = openImportFiles
      .filter(f => !f.attachments.some(a => a.category === 'INVOICE'))
      .map(f => ({ id: f.id, fileNumber: f.fileNumber, createdAt: f.createdAt, client: f.corporateClient || f.client || null }))
    const importNoInvoiceRecent = importNoInvoice.filter(f => new Date(f.createdAt) >= thirtyDaysAgo).reverse()
    const importNoInvoiceOld    = importNoInvoice.filter(f => new Date(f.createdAt) <  thirtyDaysAgo)

    // Delivery doc alerts — files past fechaEntrega missing TARIFF_REPLY_EMAIL or DELIVERY_DOCS_EMAIL
    const now = Date.now()
    const deliveryDocAlerts = deliveryDocFiles
      .map(f => {
        const attached = new Set(f.attachments.map(a => a.category))
        const entrega  = new Date(f.fechaEntrega)
        const missingDocs = []
        if (!attached.has('DELIVERY_DOCS_EMAIL')) {
          const due = new Date(entrega.getTime() + 3 * 86400000)
          missingDocs.push({ cat: 'DELIVERY_DOCS_EMAIL', dueDate: due.toISOString(), overdue: now > due.getTime() })
        }
        if (missingDocs.length === 0) return null
        return {
          id: f.id,
          fileNumber: f.fileNumber,
          category: f.category,
          fechaEntrega: f.fechaEntrega,
          client: f.corporateClient || f.client || null,
          missingDocs,
        }
      })
      .filter(Boolean)

    res.json({
      totalJobs,
      activeJobs,
      totalClients,
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
      filesByCompletion,
      localNoInvoiceRecent,
      localNoInvoiceOld,
      exportNoInvoiceRecent,
      exportNoInvoiceOld,
      importNoInvoiceRecent,
      importNoInvoiceOld,
      deliveryDocAlerts,
      myAppointments,
      myCoordinations,
    })
  } catch (err) { next(err) }
})

module.exports = router

