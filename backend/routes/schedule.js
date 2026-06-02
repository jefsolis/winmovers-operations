const router = require('express').Router()
const { getPrisma } = require('../db')
const { logAudit } = require('../audit')

// ── Permission middleware ─────────────────────────────────────────────────────
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

router.use(requireScheduleAccess)

// ── Shared include ────────────────────────────────────────────────────────────
const ENTRY_INCLUDE = {
  job:        { select: { id: true, jobNumber: true, type: true, quoteTo: true, companyName: true, client: { select: { name: true } } } },
  assignedTo: { select: { id: true, name: true } },
}

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
    const { startDate, endDate, date, time, taskType, description, notes, assignedToId, jobId } = req.body
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

    const { startDate, endDate, date, time, taskType, description, notes, assignedToId, jobId } = req.body

    if (time && !/^\d{2}:\d{2}$/.test(time)) return res.status(400).json({ error: 'Formato de hora inválido (HH:MM).' })

    const resolvedStartInput = startDate || date
    const resolvedEndInput = endDate || resolvedStartInput
    const beforeStart = before.startDate || before.date
    const beforeEnd = before.endDate || before.date
    const nextStart = resolvedStartInput ? new Date(resolvedStartInput + 'T00:00:00.000Z') : beforeStart
    const nextEnd = resolvedEndInput ? new Date(resolvedEndInput + 'T00:00:00.000Z') : beforeEnd
    if (nextStart > nextEnd) return res.status(400).json({ error: 'La fecha final no puede ser menor que la fecha inicial.' })

    const rangeChanged = nextStart.getTime() !== beforeStart.getTime() || nextEnd.getTime() !== beforeEnd.getTime()

    const data = {
      date:         nextStart,
      startDate:    nextStart,
      endDate:      nextEnd,
      time:         time !== undefined ? (time || null) : before.time,
      taskType:     taskType    || before.taskType,
      description:  description?.trim() || before.description,
      notes:        notes !== undefined ? (notes || null) : before.notes,
      assignedToId: assignedToId !== undefined ? (assignedToId || null) : before.assignedToId,
      jobId:        jobId !== undefined ? (jobId || null) : before.jobId,
      rangeManuallyAdjusted: before.isAutoGenerated && rangeChanged ? true : before.rangeManuallyAdjusted,
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
