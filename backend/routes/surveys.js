const router = require('express').Router()
const { getPrisma } = require('../db')

async function generateSurveyNumber() {
  const year = new Date().getFullYear()
  const prefix = `SVY-${year}-`
  const last = await getPrisma().surveyCubicFeet.findFirst({
    where: { surveyNumber: { startsWith: prefix } },
    orderBy: { surveyNumber: 'desc' },
    select: { surveyNumber: true },
  })
  const next = last ? parseInt(last.surveyNumber.slice(prefix.length), 10) + 1 : 1
  return `${prefix}${String(next).padStart(4, '0')}`
}

function toDate(val) {
  if (!val) return null
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

// GET all (optionally filter by visitId)
router.get('/', async (req, res, next) => {
  try {
    const { visitId } = req.query
    const where = {}
    if (visitId) where.visitId = visitId
    const surveys = await getPrisma().surveyCubicFeet.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        visit: {
          select: {
            id: true, visitNumber: true, prospectName: true,
            client: { select: { id: true, name: true } },
          },
        },
        items: { orderBy: [{ room: 'asc' }, { id: 'asc' }] },
      },
    })
    res.json(surveys)
  } catch (err) { next(err) }
})

// GET one
router.get('/:id', async (req, res, next) => {
  try {
    const survey = await getPrisma().surveyCubicFeet.findUnique({
      where: { id: req.params.id },
      include: {
        visit: {
          include: {
            client: true,
            corporateClient: true,
            originAgent: { select: { id: true, name: true } },
            destAgent:   { select: { id: true, name: true } },
          },
        },
        items: { orderBy: [{ room: 'asc' }, { id: 'asc' }] },
      },
    })
    if (!survey) return res.status(404).json({ error: 'Not found' })
    res.json(survey)
  } catch (err) { next(err) }
})

// POST create
router.post('/', async (req, res, next) => {
  try {
    const { visitId, surveyDate, surveyorName, notes, items = [] } = req.body
    if (!visitId) return res.status(400).json({ error: 'visitId is required' })

    const surveyNumber = await generateSurveyNumber()

    // Calculate total CF from items
    const totalCf = items.reduce((sum, item) => {
      const qty = parseInt(item.qty) || 1
      const cf  = parseFloat(item.cfPerItem) || 0
      return sum + qty * cf
    }, 0)

    const survey = await getPrisma().surveyCubicFeet.create({
      data: {
        surveyNumber,
        visitId,
        surveyDate:   toDate(surveyDate),
        surveyorName: surveyorName || null,
        totalCf,
        notes:        notes || null,
        items: {
          create: items.map(item => ({
            room:        item.room || 'OTHER',
            description: item.description || '',
            qty:         parseInt(item.qty) || 1,
            cfPerItem:   parseFloat(item.cfPerItem) || 0,
            totalCf:     (parseInt(item.qty) || 1) * (parseFloat(item.cfPerItem) || 0),
          })),
        },
      },
      include: {
        items: { orderBy: [{ room: 'asc' }, { id: 'asc' }] },
      },
    })
    res.status(201).json(survey)
  } catch (err) { next(err) }
})

// PUT update (replaces all items)
router.put('/:id', async (req, res, next) => {
  try {
    const { surveyDate, surveyorName, notes, items = [] } = req.body

    const totalCf = items.reduce((sum, item) => {
      const qty = parseInt(item.qty) || 1
      const cf  = parseFloat(item.cfPerItem) || 0
      return sum + qty * cf
    }, 0)

    // Delete existing items and re-create
    await getPrisma().surveyItem.deleteMany({ where: { surveyId: req.params.id } })

    const survey = await getPrisma().surveyCubicFeet.update({
      where: { id: req.params.id },
      data: {
        surveyDate:   toDate(surveyDate),
        surveyorName: surveyorName || null,
        totalCf,
        notes:        notes || null,
        items: {
          create: items.map(item => ({
            room:        item.room || 'OTHER',
            description: item.description || '',
            qty:         parseInt(item.qty) || 1,
            cfPerItem:   parseFloat(item.cfPerItem) || 0,
            totalCf:     (parseInt(item.qty) || 1) * (parseFloat(item.cfPerItem) || 0),
          })),
        },
      },
      include: {
        items: { orderBy: [{ room: 'asc' }, { id: 'asc' }] },
        visit: {
          include: {
            client: true,
            corporateClient: true,
            originAgent: { select: { id: true, name: true } },
            destAgent:   { select: { id: true, name: true } },
          },
        },
      },
    })
    res.json(survey)
  } catch (err) { next(err) }
})

// DELETE
router.delete('/:id', async (req, res, next) => {
  try {
    await getPrisma().surveyCubicFeet.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) { next(err) }
})

module.exports = router
