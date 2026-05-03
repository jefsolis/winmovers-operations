const router = require('express').Router()
const { getPrisma } = require('../db')
const { logAudit } = require('../audit')
const { getDownloadUrl } = require('../storage/azure')

async function generateQuoteNumber() {
  const year = new Date().getFullYear()
  const prefix = `QUO-${year}-`
  const last = await getPrisma().quote.findFirst({
    where: { quoteNumber: { startsWith: prefix } },
    orderBy: { quoteNumber: 'desc' },
    select: { quoteNumber: true },
  })
  const lastNum = last ? parseInt(last.quoteNumber.slice(prefix.length), 10) : 0
  const seed = await getPrisma().systemSetting.findUnique({ where: { key: 'counter.QUOTE' } })
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

// GET one (includes full visit for pre-fill + creator signature)
router.get('/:id', async (req, res, next) => {
  try {
    const quote = await getPrisma().quote.findUnique({
      where: { id: req.params.id },
      include: {
        visit: { include: { client: true, corporateClient: true } },
        job:   { select: { id: true, jobNumber: true } },
      },
    })
    if (!quote) return res.status(404).json({ error: 'Not found' })

    // Attach the creator's signature data (looked up by name)
    let creator = null
    if (quote.creatorName) {
      const staff = await getPrisma().staffMember.findFirst({
        where: { name: quote.creatorName, isActive: true },
        select: { emailSignature: true, signatureImagePath: true },
      })
      if (staff) {
        creator = {
          name: quote.creatorName,
          emailSignature: staff.emailSignature || null,
          signatureImageUrl: staff.signatureImagePath
            ? await getDownloadUrl(staff.signatureImagePath)
            : null,
        }
      }
    }

    res.json({ ...quote, creator })
  } catch (err) { next(err) }
})

// POST create — also marks the linked visit as QUOTED
router.post('/', async (req, res, next) => {
  try {
    const { visitId, status, totalAmount, currency, validUntil, notes, language, content, creatorName } = req.body
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
        language: language || 'EN',
        content: content || null,
        creatorName: creatorName || null,
      },
    })
    logAudit(req, 'Quote', quote.id, 'CREATE', null, quote)
    res.status(201).json(quote)
  } catch (err) { next(err) }
})

// PUT update
router.put('/:id', async (req, res, next) => {
  try {
    const { status, totalAmount, currency, validUntil, notes, language, content, creatorName } = req.body
    const before = await getPrisma().quote.findUnique({ where: { id: req.params.id } })
    const quote = await getPrisma().quote.update({
      where: { id: req.params.id },
      data: {
        status,
        totalAmount: totalAmount !== undefined ? (totalAmount ? parseFloat(totalAmount) : null) : undefined,
        currency: currency || undefined,
        validUntil: validUntil !== undefined ? toDate(validUntil) : undefined,
        notes: notes !== undefined ? notes : undefined,
        language: language || undefined,
        content: content !== undefined ? content : undefined,
        creatorName: creatorName !== undefined ? creatorName : undefined,
      },
    })
    // When a quote is rejected, close its linked visit
    if (status === 'REJECTED' && quote.visitId) {
      await getPrisma().visit.update({ where: { id: quote.visitId }, data: { status: 'CLOSED' } })
    }
    logAudit(req, 'Quote', req.params.id, 'UPDATE', before, quote)
    res.json(quote)
  } catch (err) { next(err) }
})

// DELETE
router.delete('/:id', async (req, res, next) => {
  try {
    const before = await getPrisma().quote.findUnique({ where: { id: req.params.id } })
    await getPrisma().quote.delete({ where: { id: req.params.id } })
    logAudit(req, 'Quote', req.params.id, 'DELETE', before, null)
    res.json({ ok: true })
  } catch (err) { next(err) }
})

module.exports = router
