const router = require('express').Router()
const { getPrisma } = require('../db')
const { notifyVisitAssigned } = require('../services/notifications')

async function generateVisitNumber() {
  const year = new Date().getFullYear()
  const prefix = `VIS-${year}-`
  const last = await getPrisma().visit.findFirst({
    where: { visitNumber: { startsWith: prefix } },
    orderBy: { visitNumber: 'desc' },
    select: { visitNumber: true },
  })
  const lastNum = last ? parseInt(last.visitNumber.slice(prefix.length), 10) : 0
  const seed = await getPrisma().systemSetting.findUnique({ where: { key: 'counter.VISIT' } })
  const seedNum = seed ? parseInt(seed.value, 10) - 1 : 0
  const next = Math.max(lastNum, seedNum) + 1
  return `${prefix}${String(next).padStart(4, '0')}`
}

function toDate(val) {
  if (!val) return null
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

// GET all
router.get('/', async (req, res, next) => {
  try {
    const { status, search } = req.query
    const where = {}
    if (status) where.status = status
    if (search) {
      where.OR = [
        { visitNumber:   { contains: search, mode: 'insensitive' } },
        { prospectName:  { contains: search, mode: 'insensitive' } },
        { prospectEmail: { contains: search, mode: 'insensitive' } },
        { originCity:    { contains: search, mode: 'insensitive' } },
        { destCity:      { contains: search, mode: 'insensitive' } },
        { client: { name: { contains: search, mode: 'insensitive' } } },
      ]
    }
    const visits = await getPrisma().visit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        client:           { select: { id: true, name: true } },
        corporateClient:  { select: { id: true, name: true } },
        assignedTo:       { select: { id: true, name: true, email: true } },
        originAgent:      { select: { id: true, name: true } },
        destAgent:        { select: { id: true, name: true } },
        quotes:           { select: { id: true, quoteNumber: true, status: true } },
      },
    })
    res.json(visits)
  } catch (err) { next(err) }
})

// GET one
router.get('/:id', async (req, res, next) => {
  try {
    const visit = await getPrisma().visit.findUnique({
      where: { id: req.params.id },
      include: {
        client:          true,
        corporateClient: true,
        assignedTo:      true,
        originAgent:     { select: { id: true, name: true } },
        destAgent:       { select: { id: true, name: true } },
        quotes:          { include: { job: { select: { id: true, jobNumber: true } } } },
        jobs:            { select: { id: true, jobNumber: true } },
        survey:          { select: { id: true, surveyNumber: true, totalCf: true, surveyDate: true } },
      },
    })
    if (!visit) return res.status(404).json({ error: 'Not found' })
    res.json(visit)
  } catch (err) { next(err) }
})

// POST create
router.post('/', async (req, res, next) => {
  try {
    const {
      status, clientId, corporateClientId, assignedToId,
      prospectName, prospectPhone, prospectEmail,
      originAddress, originCity, originCountry,
      destAddress, destCity, destCountry,
      serviceType, scheduledDate, observations, language,
      bookerRole, originAgentId, destAgentId,
    } = req.body
    const errs = []
    if (!serviceType)                         errs.push('Service type is required.')
    if (!scheduledDate)                       errs.push('Scheduled date is required.')
    if (!clientId && !prospectName?.trim())   errs.push('Please enter a prospect name or select a linked client.')
    if (errs.length) return res.status(400).json({ error: errs.join(' ') })
    const visitNumber = await generateVisitNumber()
    const visit = await getPrisma().visit.create({
      data: {
        visitNumber,
        status: status || 'SCHEDULED',
        clientId: clientId || null,
        corporateClientId: corporateClientId || null,
        assignedToId: assignedToId || null,
        prospectName:  prospectName  || null,
        prospectPhone: prospectPhone || null,
        prospectEmail: prospectEmail || null,
        originAddress: originAddress || null,
        originCity: originCity || null,
        originCountry: originCountry || null,
        destAddress: destAddress || null,
        destCity: destCity || null,
        destCountry: destCountry || null,
        serviceType: serviceType || null,
        scheduledDate: toDate(scheduledDate),
        observations: observations || null,
        language: language || 'EN',
        bookerRole: bookerRole || null,
        originAgentId: originAgentId || null,
        destAgentId: destAgentId || null,
      },
      include: { assignedTo: { select: { id: true, name: true, email: true } }, client: { select: { id: true, name: true, phone: true, email: true } }, corporateClient: { select: { id: true, name: true, phone: true, email: true } } },
    })
    // Fire-and-forget calendar invite to assignee
    if (assignedToId) notifyVisitAssigned(visit, 'created')
    res.status(201).json(visit)
  } catch (err) { next(err) }
})

// PUT update
router.put('/:id', async (req, res, next) => {
  try {
    const {
      status, clientId, corporateClientId, assignedToId,
      prospectName, prospectPhone, prospectEmail,
      originAddress, originCity, originCountry,
      destAddress, destCity, destCountry,
      serviceType, scheduledDate, observations, language,
      bookerRole, originAgentId, destAgentId,
    } = req.body

    // Fetch previous state to detect assignee / date changes
    const prev = await getPrisma().visit.findUnique({ where: { id: req.params.id }, select: { assignedToId: true, scheduledDate: true } })

    const visit = await getPrisma().visit.update({
      where: { id: req.params.id },
      data: {
        status,
        clientId: clientId || null,
        corporateClientId: corporateClientId || null,
        assignedToId: assignedToId || null,
        prospectName:  prospectName  || null,
        prospectPhone: prospectPhone || null,
        prospectEmail: prospectEmail || null,
        originAddress: originAddress || null,
        originCity: originCity || null,
        originCountry: originCountry || null,
        destAddress: destAddress || null,
        destCity: destCity || null,
        destCountry: destCountry || null,
        serviceType: serviceType || null,
        scheduledDate: toDate(scheduledDate),
        observations: observations || null,
        language: language || 'EN',
        bookerRole: bookerRole !== undefined ? (bookerRole || null) : undefined,
        originAgentId: originAgentId !== undefined ? (originAgentId || null) : undefined,
        destAgentId: destAgentId !== undefined ? (destAgentId || null) : undefined,
      },
      include: { assignedTo: { select: { id: true, name: true, email: true } }, client: { select: { id: true, name: true, phone: true, email: true } }, corporateClient: { select: { id: true, name: true, phone: true, email: true } } },
    })

    // Notify when assignee changed OR scheduled date changed (and someone is assigned)
    const assigneeChanged = assignedToId && assignedToId !== prev?.assignedToId
    const dateChanged     = scheduledDate && toDate(scheduledDate)?.getTime() !== prev?.scheduledDate?.getTime()
    if (assignedToId && (assigneeChanged || dateChanged)) {
      notifyVisitAssigned(visit, 'updated')
    }

    res.json(visit)
  } catch (err) { next(err) }
})

// DELETE
router.delete('/:id', async (req, res, next) => {
  try {
    await getPrisma().visit.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

module.exports = router
