const router = require('express').Router()
const { getPrisma } = require('../db')
const { logAudit } = require('../audit')
const { requireScheduleAccess, requireScheduleManager } = require('../middleware/schedulePermissions')
const {
  getScheduleSetting,
  setScheduleSetting,
  getRemainingCapacityForSpan,
  checkCapacityForSpan,
  findClosestAvailableSpan,
} = require('../services/scheduleCapacity')

router.use(requireScheduleAccess)

// ── Shared include ────────────────────────────────────────────────────────────
const ENTRY_INCLUDE = {
  job:        { select: { id: true, jobNumber: true, type: true, quoteTo: true, companyName: true, personalCount: true, client: { select: { name: true } } } },
  assignedTo: { select: { id: true, name: true } },
}

function daysBetweenInclusive(start, end) {
  return Math.round((end - start) / 86400000) + 1
}

// ── GET/PUT capacity settings ─────────────────────────────────────────────────
router.get('/settings', async (req, res, next) => {
  try {
    const setting = await getScheduleSetting()
    res.json(setting)
  } catch (err) { next(err) }
})

router.put('/settings', requireScheduleManager, async (req, res, next) => {
  try {
    const { dailyWorkerCapacity } = req.body
    const value = Number(dailyWorkerCapacity)
    if (!Number.isInteger(value) || value <= 0) {
      return res.status(400).json({ error: 'La capacidad diaria debe ser un número entero mayor que cero.' })
    }
    const before = await getScheduleSetting()
    const setting = await setScheduleSetting(value, req.staff.id)
    logAudit(req, 'ScheduleSetting', setting.id, 'UPDATE', before, setting)
    res.json(setting)
  } catch (err) { next(err) }
})

// ── GET capacity for a span ────────────────────────────────────────────────────
// GET /api/schedule/capacity?date=YYYY-MM-DD&days=N&workersRequired=W
router.get('/capacity', async (req, res, next) => {
  try {
    const { date, days, workersRequired } = req.query
    if (!date) return res.status(400).json({ error: 'La fecha es requerida.' })
    const span = await getRemainingCapacityForSpan(date, days || 1)
    const workers = workersRequired != null ? Number(workersRequired) : null
    const fits = workers != null ? span.days.every(d => d.remaining >= workers) : null
    res.json({ ...span, fits, workersRequired: workers })
  } catch (err) { next(err) }
})

// GET /api/schedule/capacity/suggestions?date=YYYY-MM-DD&days=N&workersRequired=W
router.get('/capacity/suggestions', async (req, res, next) => {
  try {
    const { date, days, workersRequired } = req.query
    if (!date) return res.status(400).json({ error: 'La fecha es requerida.' })
    if (!workersRequired) return res.status(400).json({ error: 'El número de trabajadores requeridos es necesario.' })
    const suggestions = await findClosestAvailableSpan(date, days || 1, Number(workersRequired))
    res.json({ requested: { date, days: Number(days) || 1, workersRequired: Number(workersRequired) }, suggestions })
  } catch (err) { next(err) }
})

// ── GET entries needing attention (overbooked/overridden) ─────────────────────
router.get('/attention', async (req, res, next) => {
  try {
    const entries = await getPrisma().scheduleEntry.findMany({
      where: { needsAttention: true },
      include: ENTRY_INCLUDE,
      orderBy: [{ startDate: 'asc' }],
    })
    res.json(entries)
  } catch (err) { next(err) }
})

// ── GET range ────────────────────────────────────────────────────────────────
// GET /api/schedule?from=2026-05-01&to=2026-05-31
router.get('/', async (req, res, next) => {
  try {
    const { from, to } = req.query
    const where = {}
    if (from || to) {
      where.AND = []
      if (from) where.AND.push({ endDate: { gte: new Date(from + 'T00:00:00.000Z') } })
      if (to)   where.AND.push({ startDate: { lte: new Date(to + 'T23:59:59.999Z') } })
    }
    const entries = await getPrisma().scheduleEntry.findMany({
      where,
      include: ENTRY_INCLUDE,
      orderBy: [{ startDate: 'asc' }, { time: 'asc' }],
    })
    res.json(entries)
  } catch (err) { next(err) }
})

// ── GET one ───────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const entry = await getPrisma().scheduleEntry.findUnique({
      where: { id: req.params.id },
      include: ENTRY_INCLUDE,
    })
    if (!entry) return res.status(404).json({ error: 'Not found' })
    res.json(entry)
  } catch (err) { next(err) }
})

// ── POST create (manual entries only) ────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { startDate, endDate, date, time, taskType, description, notes, assignedToId, jobId, personalCount, forceOverride, overrideReason } = req.body
    const resolvedStartDate = startDate || date
    const resolvedEndDate = endDate || resolvedStartDate
    if (!resolvedStartDate) return res.status(400).json({ error: 'La fecha inicial es requerida.' })
    if (!taskType)    return res.status(400).json({ error: 'El tipo de tarea es requerido.' })
    if (!description?.trim()) return res.status(400).json({ error: 'La descripción es requerida.' })
    if (!time)        return res.status(400).json({ error: 'La hora es requerida.' })
    if (!/^\d{2}:\d{2}$/.test(time)) return res.status(400).json({ error: 'Formato de hora inválido (HH:MM).' })

    const start = new Date(resolvedStartDate + 'T00:00:00.000Z')
    const end = new Date(resolvedEndDate + 'T00:00:00.000Z')
    if (start > end) return res.status(400).json({ error: 'La fecha final no puede ser menor que la fecha inicial.' })

    let needsAttention = false
    let resolvedOverrideReason = null
    let resolvedPersonalCount = null

    if (jobId) {
      const job = await getPrisma().job.findUnique({ where: { id: jobId }, select: { personalCount: true } })
      if (!job?.personalCount) {
        return res.status(400).json({ error: 'Este trabajo necesita el número de trabajadores requeridos antes de poder agendarse.', code: 'MISSING_WORKERS_REQUIRED' })
      }
      const span = daysBetweenInclusive(start, end)
      const { fits } = await checkCapacityForSpan(start, span, job.personalCount)
      if (!fits) {
        if (!forceOverride) {
          const suggestions = await findClosestAvailableSpan(start, span, job.personalCount)
          return res.status(409).json({ error: 'No hay espacio en la Bitácora para este trabajo esa fecha (o fechas).', suggestions })
        }
        if (!overrideReason?.trim()) {
          return res.status(400).json({ error: 'Debes indicar un motivo para agendar este trabajo fuera de la capacidad disponible.' })
        }
        needsAttention = true
        resolvedOverrideReason = overrideReason.trim()
      }
    } else if (personalCount != null && personalCount !== '') {
      resolvedPersonalCount = parseInt(personalCount, 10)
      const span = daysBetweenInclusive(start, end)
      const { fits } = await checkCapacityForSpan(start, span, resolvedPersonalCount)
      if (!fits) {
        if (!forceOverride) {
          const suggestions = await findClosestAvailableSpan(start, span, resolvedPersonalCount)
          return res.status(409).json({ error: 'No hay espacio en la Bitácora para esta entrada esa fecha (o fechas).', suggestions })
        }
        if (!overrideReason?.trim()) {
          return res.status(400).json({ error: 'Debes indicar un motivo para agendar esta entrada fuera de la capacidad disponible.' })
        }
        needsAttention = true
        resolvedOverrideReason = overrideReason.trim()
      }
    }

    const entry = await getPrisma().scheduleEntry.create({
      data: {
        date:        start,
        startDate:   start,
        endDate:     end,
        time:        time        || null,
        taskType,
        description: description.trim(),
        notes:       notes       || null,
        assignedToId: assignedToId || null,
        jobId:        jobId        || null,
        personalCount: jobId ? null : resolvedPersonalCount,
        needsAttention,
        overrideReason: resolvedOverrideReason,
      },
      include: ENTRY_INCLUDE,
    })
    logAudit(req, 'ScheduleEntry', entry.id, 'CREATE', null, entry)
    res.status(201).json(entry)
  } catch (err) { next(err) }
})

// ── PUT update ────────────────────────────────────────────────────────────────
// System-linked entries (jobId): only time, notes, assignedToId are writable
// Manual entries: all fields writable
router.put('/:id', async (req, res, next) => {
  try {
    const before = await getPrisma().scheduleEntry.findUnique({ where: { id: req.params.id } })
    if (!before) return res.status(404).json({ error: 'Not found' })

    const { startDate, endDate, date, time, taskType, description, notes, assignedToId, jobId, personalCount, forceOverride, overrideReason } = req.body

    if (time && !/^\d{2}:\d{2}$/.test(time)) return res.status(400).json({ error: 'Formato de hora inválido (HH:MM).' })

    const resolvedStartInput = startDate || date
    const resolvedEndInput = endDate || resolvedStartInput
    const beforeStart = before.startDate || before.date
    const beforeEnd = before.endDate || before.date
    const nextStart = resolvedStartInput ? new Date(resolvedStartInput + 'T00:00:00.000Z') : beforeStart
    const nextEnd = resolvedEndInput ? new Date(resolvedEndInput + 'T00:00:00.000Z') : beforeEnd
    if (nextStart > nextEnd) return res.status(400).json({ error: 'La fecha final no puede ser menor que la fecha inicial.' })

    const rangeChanged = nextStart.getTime() !== beforeStart.getTime() || nextEnd.getTime() !== beforeEnd.getTime()
    const resolvedJobId = jobId !== undefined ? (jobId || null) : before.jobId

    let needsAttention = before.needsAttention
    let resolvedOverrideReason = before.overrideReason
    let resolvedPersonalCount = before.personalCount

    if (resolvedJobId) {
      resolvedPersonalCount = null
      const job = await getPrisma().job.findUnique({ where: { id: resolvedJobId }, select: { personalCount: true } })
      if (!job?.personalCount) {
        return res.status(400).json({ error: 'Este trabajo necesita el número de trabajadores requeridos antes de poder agendarse.', code: 'MISSING_WORKERS_REQUIRED' })
      }
      const span = daysBetweenInclusive(nextStart, nextEnd)
      const { fits } = await checkCapacityForSpan(nextStart, span, job.personalCount, req.params.id)
      if (fits) {
        needsAttention = false
        resolvedOverrideReason = null
      } else if (forceOverride) {
        if (!overrideReason?.trim()) {
          return res.status(400).json({ error: 'Debes indicar un motivo para agendar este trabajo fuera de la capacidad disponible.' })
        }
        needsAttention = true
        resolvedOverrideReason = overrideReason.trim()
      } else if (!before.needsAttention) {
        const suggestions = await findClosestAvailableSpan(nextStart, span, job.personalCount, req.params.id)
        return res.status(409).json({ error: 'No hay espacio en la Bitácora para este trabajo esa fecha (o fechas).', suggestions })
      }
      // else: already flagged and still over capacity with no new override — keep the existing flag/reason
    } else {
      resolvedPersonalCount = personalCount !== undefined ? (personalCount != null && personalCount !== '' ? parseInt(personalCount, 10) : null) : before.personalCount
      if (resolvedPersonalCount != null) {
        const span = daysBetweenInclusive(nextStart, nextEnd)
        const { fits } = await checkCapacityForSpan(nextStart, span, resolvedPersonalCount, req.params.id)
        if (fits) {
          needsAttention = false
          resolvedOverrideReason = null
        } else if (forceOverride) {
          if (!overrideReason?.trim()) {
            return res.status(400).json({ error: 'Debes indicar un motivo para agendar esta entrada fuera de la capacidad disponible.' })
          }
          needsAttention = true
          resolvedOverrideReason = overrideReason.trim()
        } else if (!before.needsAttention) {
          const suggestions = await findClosestAvailableSpan(nextStart, span, resolvedPersonalCount, req.params.id)
          return res.status(409).json({ error: 'No hay espacio en la Bitácora para esta entrada esa fecha (o fechas).', suggestions })
        }
      } else {
        needsAttention = false
        resolvedOverrideReason = null
      }
    }

    const data = {
      date:         nextStart,
      startDate:    nextStart,
      endDate:      nextEnd,
      time:         time !== undefined ? (time || null) : before.time,
      taskType:     taskType    || before.taskType,
      description:  description?.trim() || before.description,
      notes:        notes !== undefined ? (notes || null) : before.notes,
      assignedToId: assignedToId !== undefined ? (assignedToId || null) : before.assignedToId,
      jobId:        resolvedJobId,
      personalCount: resolvedPersonalCount,
      rangeManuallyAdjusted: before.isAutoGenerated && rangeChanged ? true : before.rangeManuallyAdjusted,
      needsAttention,
      overrideReason: resolvedOverrideReason,
    }

    const entry = await getPrisma().scheduleEntry.update({
      where: { id: req.params.id },
      data,
      include: ENTRY_INCLUDE,
    })
    logAudit(req, 'ScheduleEntry', req.params.id, 'UPDATE', before, entry)
    res.json(entry)
  } catch (err) { next(err) }
})

// ── PUT resolve (Scheduling Manager clears needsAttention once capacity allows) ──
router.put('/:id/resolve', requireScheduleManager, async (req, res, next) => {
  try {
    const before = await getPrisma().scheduleEntry.findUnique({ where: { id: req.params.id } })
    if (!before) return res.status(404).json({ error: 'Not found' })
    if (!before.needsAttention) return res.json(before)

    const start = before.startDate || before.date
    const end = before.endDate || before.date
    const span = daysBetweenInclusive(start, end)
    const requiredWorkers = before.jobId
      ? (await getPrisma().job.findUnique({ where: { id: before.jobId }, select: { personalCount: true } }))?.personalCount || 0
      : (before.personalCount || 0)
    const { fits } = await checkCapacityForSpan(start, span, requiredWorkers, req.params.id)
    if (!fits) {
      return res.status(409).json({ error: 'El día todavía excede la capacidad disponible; libera más trabajadores antes de resolver.' })
    }

    const entry = await getPrisma().scheduleEntry.update({
      where: { id: req.params.id },
      data: { needsAttention: false },
      include: ENTRY_INCLUDE,
    })
    logAudit(req, 'ScheduleEntry', req.params.id, 'UPDATE', before, entry)
    res.json(entry)
  } catch (err) { next(err) }
})

// ── DELETE ────────────────────────────────────────────────────────────────────
// Any entry can be deleted — the linked Job is NOT affected
router.delete('/:id', async (req, res, next) => {
  try {
    const entry = await getPrisma().scheduleEntry.findUnique({ where: { id: req.params.id } })
    if (!entry) return res.status(404).json({ error: 'Not found' })
    await getPrisma().scheduleEntry.delete({ where: { id: req.params.id } })
    logAudit(req, 'ScheduleEntry', req.params.id, 'DELETE', entry, null)
    res.status(204).send()
  } catch (err) { next(err) }
})

module.exports = router
