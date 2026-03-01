const router = require('express').Router()
const { getPrisma } = require('../db')

async function generateJobNumber() {
  const year = new Date().getFullYear()
  const count = await getPrisma().job.count()
  return `WM-${year}-${String(count + 1).padStart(4, '0')}`
}

function toDate(val) {
  if (!val) return null
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

// GET all
router.get('/', async (req, res, next) => {
  try {
    const { status, type, search } = req.query
    const where = {}
    if (status) where.status = status
    if (type) where.type = type
    if (search) {
      where.OR = [
        { jobNumber: { contains: search, mode: 'insensitive' } },
        { originCity: { contains: search, mode: 'insensitive' } },
        { destCity: { contains: search, mode: 'insensitive' } },
        { originCountry: { contains: search, mode: 'insensitive' } },
        { destCountry: { contains: search, mode: 'insensitive' } },
        { contact: { firstName: { contains: search, mode: 'insensitive' } } },
        { contact: { lastName: { contains: search, mode: 'insensitive' } } },
        { client: { name: { contains: search, mode: 'insensitive' } } }
      ]
    }
    const jobs = await getPrisma().job.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { contact: { select: { id: true, firstName: true, lastName: true } }, client: { select: { id: true, name: true } } }
    })
    res.json(jobs)
  } catch (err) { next(err) }
})

// GET one
router.get('/:id', async (req, res, next) => {
  try {
    const job = await getPrisma().job.findUnique({
      where: { id: req.params.id },
      include: { contact: true, client: true }
    })
    if (!job) return res.status(404).json({ error: 'Not found' })
    res.json(job)
  } catch (err) { next(err) }
})

// POST create
router.post('/', async (req, res, next) => {
  try {
    const {
      type, status, clientId, contactId,
      originCity, originCountry, destCity, destCountry,
      surveyDate, packDate, moveDate, deliveryDate,
      volumeCbm, weightKg, shipmentMode, notes
    } = req.body
    if (!type) return res.status(400).json({ error: 'type is required' })
    const jobNumber = await generateJobNumber()
    const job = await getPrisma().job.create({
      data: {
        jobNumber,
        type,
        status: status || 'SURVEY',
        clientId: clientId || null,
        contactId: contactId || null,
        originCity, originCountry, destCity, destCountry,
        surveyDate: toDate(surveyDate),
        packDate: toDate(packDate),
        moveDate: toDate(moveDate),
        deliveryDate: toDate(deliveryDate),
        volumeCbm: volumeCbm ? parseFloat(volumeCbm) : null,
        weightKg: weightKg ? parseFloat(weightKg) : null,
        shipmentMode, notes
      }
    })
    res.status(201).json(job)
  } catch (err) { next(err) }
})

// PUT update
router.put('/:id', async (req, res, next) => {
  try {
    const {
      type, status, clientId, contactId,
      originCity, originCountry, destCity, destCountry,
      surveyDate, packDate, moveDate, deliveryDate,
      volumeCbm, weightKg, shipmentMode, notes
    } = req.body
    const job = await getPrisma().job.update({
      where: { id: req.params.id },
      data: {
        type, status,
        clientId: clientId || null,
        contactId: contactId || null,
        originCity, originCountry, destCity, destCountry,
        surveyDate: toDate(surveyDate),
        packDate: toDate(packDate),
        moveDate: toDate(moveDate),
        deliveryDate: toDate(deliveryDate),
        volumeCbm: volumeCbm ? parseFloat(volumeCbm) : null,
        weightKg: weightKg ? parseFloat(weightKg) : null,
        shipmentMode, notes
      }
    })
    res.json(job)
  } catch (err) { next(err) }
})

// DELETE
router.delete('/:id', async (req, res, next) => {
  try {
    await getPrisma().job.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) { next(err) }
})

module.exports = router
