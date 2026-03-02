const router = require('express').Router()
const { getPrisma } = require('../db')

async function generateQuoteNumber() {
  const year = new Date().getFullYear()
  const count = await getPrisma().quote.count()
  return `QUO-${year}-${String(count + 1).padStart(4, '0')}`
}

function toDate(val) {
  if (!val) return null
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

// GET all
router.get('/', async (req, res, next) => {
  try {
    const { status, visitId } = req.query
    const where = {}
    if (status)  where.status  = status
    if (visitId) where.visitId = visitId
    const quotes = await getPrisma().quote.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        visit: {
          select: {
            id: true, visitNumber: true, prospectName: true,
            client: { select: { id: true, name: true } },
          },
        },
        job: { select: { id: true, jobNumber: true } },
      },
    })
    res.json(quotes)
  } catch (err) { next(err) }
})

// GET one (includes full visit for pre-fill)
router.get('/:id', async (req, res, next) => {
  try {
    const quote = await getPrisma().quote.findUnique({
      where: { id: req.params.id },
      include: {
        visit: { include: { client: true, contact: true } },
        job:   { select: { id: true, jobNumber: true } },
      },
    })
    if (!quote) return res.status(404).json({ error: 'Not found' })
    res.json(quote)
  } catch (err) { next(err) }
})

// POST create — also marks the linked visit as QUOTED
router.post('/', async (req, res, next) => {
  try {
    const { visitId, status, totalAmount, currency, validUntil, notes } = req.body
    if (!visitId) return res.status(400).json({ error: 'visitId is required' })
    const quoteNumber = await generateQuoteNumber()
    // Mark visit as QUOTED
    await getPrisma().visit.update({ where: { id: visitId }, data: { status: 'QUOTED' } })
    const quote = await getPrisma().quote.create({
      data: {
        quoteNumber,
        visitId,
        status: status || 'DRAFT',
        totalAmount: totalAmount ? parseFloat(totalAmount) : null,
        currency: currency || 'USD',
        validUntil: toDate(validUntil),
        notes: notes || null,
      },
    })
    res.status(201).json(quote)
  } catch (err) { next(err) }
})

// PUT update
router.put('/:id', async (req, res, next) => {
  try {
    const { status, totalAmount, currency, validUntil, notes, jobId } = req.body
    const quote = await getPrisma().quote.update({
      where: { id: req.params.id },
      data: {
        status,
        totalAmount: totalAmount !== undefined ? (totalAmount ? parseFloat(totalAmount) : null) : undefined,
        currency: currency || undefined,
        validUntil: validUntil !== undefined ? toDate(validUntil) : undefined,
        notes: notes !== undefined ? notes : undefined,
        jobId: jobId !== undefined ? jobId : undefined,
      },
    })
    res.json(quote)
  } catch (err) { next(err) }
})

// DELETE
router.delete('/:id', async (req, res, next) => {
  try {
    await getPrisma().quote.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

module.exports = router
