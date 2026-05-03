const router = require('express').Router()
const { getPrisma } = require('../db')

const COUNTERS = [
  { key: 'counter.EXPORT',      label: 'Export Files (E-####-YYYY)',         prefix: 'E',  model: 'movingFile', field: 'fileNumber',  startsWith: 'E-' },
  { key: 'counter.IMPORT',      label: 'Import Files (DF-####-YYYY)',        prefix: 'DF', model: 'movingFile', field: 'fileNumber',  startsWith: 'DF-' },
  { key: 'counter.LOCAL',       label: 'Local Files (M-####-YYYY)',          prefix: 'M',  model: 'movingFile', field: 'fileNumber',  startsWith: 'M-' },
  { key: 'counter.IMPORT_JOB',  label: 'Import Work Orders (D-####-YYYY)',  prefix: null, model: 'job',        field: 'jobNumber',   startsWith: 'D-' },
  { key: 'counter.VISIT',       label: 'Visits (VIS-YYYY-####)',             prefix: null, model: 'visit',      field: 'visitNumber', startsWith: `VIS-${new Date().getFullYear()}-` },
  { key: 'counter.QUOTE',       label: 'Quotes (QUO-YYYY-####)',             prefix: null, model: 'quote',      field: 'quoteNumber', startsWith: `QUO-${new Date().getFullYear()}-` },
]

// GET /api/admin/version
router.get('/version', (req, res) => {
  res.json({
    build:  process.env.BUILD_NUMBER || 'dev',
    commit: (process.env.GIT_SHA || 'unknown').substring(0, 7),
    date:   process.env.BUILD_DATE || new Date().toISOString(),
  })
})

// GET /api/admin/counters
router.get('/counters', async (req, res, next) => {
  try {
    const db = getPrisma()
    const results = await Promise.all(COUNTERS.map(async (c) => {
      // Last actually-used number
      const last = await db[c.model].findFirst({
        where: { [c.field]: { startsWith: c.startsWith } },
        orderBy: { [c.field]: 'desc' },
        select: { [c.field]: true },
      })
      let lastNum = 0
      if (last) {
        const val = last[c.field]
        if (c.model === 'movingFile') {
          const parts = val.split('-')
          lastNum = parseInt(parts[1], 10) || 0
        } else {
          lastNum = parseInt(val.slice(c.startsWith.length), 10) || 0
        }
      }

      // Configured seed
      const setting = await db.systemSetting.findUnique({ where: { key: c.key } })
      const seedNext = setting ? parseInt(setting.value, 10) : null

      const effectiveNext = Math.max(lastNum + 1, seedNext || 1)
      return { key: c.key, label: c.label, lastUsed: lastNum || null, seedNext, effectiveNext }
    }))
    res.json(results)
  } catch (err) { next(err) }
})

// PUT /api/admin/counters
router.put('/counters', async (req, res, next) => {
  try {
    const updates = req.body // { 'counter.EXPORT': 50, 'counter.IMPORT': 12, ... }
    const db = getPrisma()
    await Promise.all(
      Object.entries(updates).map(([key, value]) => {
        const num = parseInt(value, 10)
        if (isNaN(num) || num < 1) return null
        return db.systemSetting.upsert({
          where:  { key },
          update: { value: String(num) },
          create: { key, value: String(num) },
        })
      }).filter(Boolean)
    )
    res.json({ ok: true })
  } catch (err) { next(err) }
})

const DEFAULT_RETENTION_DAYS = 730 // 2 years

/**
 * GET /api/admin/audit/purge?dryRun=true
 * Returns the count of entries that would be purged.
 */
router.get('/audit/purge', async (req, res, next) => {
  try {
    const retentionDays = parseInt(process.env.AUDIT_RETENTION_DAYS || DEFAULT_RETENTION_DAYS, 10)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - retentionDays)
    const count = await getPrisma().auditLog.count({ where: { createdAt: { lt: cutoff } } })
    res.json({ count, retentionDays, cutoff })
  } catch (err) { next(err) }
})

/**
 * POST /api/admin/audit/purge
 * Deletes AuditLog entries older than AUDIT_RETENTION_DAYS and writes a meta-audit entry.
 */
router.post('/audit/purge', async (req, res, next) => {
  try {
    const retentionDays = parseInt(process.env.AUDIT_RETENTION_DAYS || DEFAULT_RETENTION_DAYS, 10)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - retentionDays)

    const { count } = await getPrisma().auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } })

    // Write a meta-audit entry so the purge itself is on record
    await getPrisma().auditLog.create({
      data: {
        entityType: 'AuditLog',
        entityId:   'purge',
        action:     'DELETE',
        userId:     req.user?.oid   || null,
        userName:   req.user?.name  || null,
        after:      { purgedCount: count, retentionDays, cutoff: cutoff.toISOString() },
        changedKeys: [],
      },
    })

    res.json({ purgedCount: count, retentionDays, cutoff })
  } catch (err) { next(err) }
})

module.exports = router
