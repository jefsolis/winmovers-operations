const router = require('express').Router()
const { getPrisma } = require('../db')

const REQUIRED_FILE_CATEGORIES = [
  'SURVEY_REPORT', 'QUOTATION', 'INSURANCE_INVENTORY', 'SIGNED_QUOTATION',
  'WORK_ORDER', 'PRE_ADVICE', 'SHIPPING_INSTRUCTIONS', 'TRANSPORT_DOCUMENT',
  'INSURANCE_CERTIFICATE', 'SIGNED_PACKING_LIST', 'INVOICE', 'DELIVERY_CONFIRMATION'
]

async function generateJobNumber() {
  const year = new Date().getFullYear()
  const prefix = `WM-${year}-`
  const last = await getPrisma().job.findFirst({
    where: { jobNumber: { startsWith: prefix } },
    orderBy: { jobNumber: 'desc' },
    select: { jobNumber: true },
  })
  const next = last ? parseInt(last.jobNumber.slice(prefix.length), 10) + 1 : 1
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
      include: { contact: { select: { id: true, firstName: true, lastName: true } }, client: { select: { id: true, name: true } }, originAgent: { select: { id: true, name: true } }, destAgent: { select: { id: true, name: true } }, customsAgent: { select: { id: true, name: true } } }
    })
    res.json(jobs)
  } catch (err) { next(err) }
})

// GET one
router.get('/:id', async (req, res, next) => {
  try {
    const job = await getPrisma().job.findUnique({
      where: { id: req.params.id },
      include: {
        contact: true, client: true,
        originAgent: true, destAgent: true, customsAgent: true,
        quote: { select: { id: true, quoteNumber: true, visit: { select: { id: true, visitNumber: true, serviceType: true, scheduledDate: true } } } },
      }
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
      originAgentId, destAgentId, customsAgentId,
      originAddress, originCity, originCountry,
      destAddress, destCity, destCountry,
      callDate, surveyDate, packDate, moveDate, deliveryDate,
      volumeCbm, weightKg, shipmentMode, notes, quoteId,
      serviceDate, serviceTime, clientPhone, clientHomePhone,
      companyName, companyPhone, serviceDetails, materials, quoteTo, creatorName, language
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
        originAgentId: originAgentId || null,
        destAgentId: destAgentId || null,
        customsAgentId: customsAgentId || null,
        originAddress, originCity, originCountry,
        destAddress, destCity, destCountry,
        callDate: toDate(callDate),
        surveyDate: toDate(surveyDate),
        packDate: toDate(packDate),
        moveDate: toDate(moveDate),
        deliveryDate: toDate(deliveryDate),
        volumeCbm: volumeCbm ? parseFloat(volumeCbm) : null,
        weightKg: weightKg ? parseFloat(weightKg) : null,
        shipmentMode, notes,
        serviceDate: serviceDate ? new Date(serviceDate) : null,
        serviceTime: serviceTime || null,
        clientPhone: clientPhone || null,
        clientHomePhone: clientHomePhone || null,
        companyName: companyName || null,
        companyPhone: companyPhone || null,
        serviceDetails: serviceDetails || null,
        materials: materials || null,
        quoteTo: quoteTo || null,
        creatorName: creatorName || null,
        language: language || 'EN',
        quoteId: quoteId || null,
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
      originAgentId, destAgentId, customsAgentId,
      originAddress, originCity, originCountry,
      destAddress, destCity, destCountry,
      callDate, surveyDate, packDate, moveDate, deliveryDate,
      volumeCbm, weightKg, shipmentMode, notes, quoteId,
      serviceDate, serviceTime, clientPhone, clientHomePhone,
      companyName, companyPhone, serviceDetails, materials, quoteTo, creatorName, language
    } = req.body

    // Validate CLOSED status: all required document categories must be attached
    if (status === 'CLOSED') {
      const files = await getPrisma().jobFile.findMany({ where: { jobId: req.params.id } })
      const attached = new Set(files.map(f => f.category))
      const missing = REQUIRED_FILE_CATEGORIES.filter(c => !attached.has(c))
      if (missing.length > 0) {
        return res.status(422).json({
          error: 'MISSING_REQUIRED_FILES',
          missing
        })
      }
    }
    const job = await getPrisma().job.update({
      where: { id: req.params.id },
      data: {
        type, status,
        clientId: clientId || null,
        contactId: contactId || null,
        originAgentId: originAgentId || null,
        destAgentId: destAgentId || null,
        customsAgentId: customsAgentId || null,
        originAddress, originCity, originCountry,
        destAddress, destCity, destCountry,
        callDate: toDate(callDate),
        surveyDate: toDate(surveyDate),
        packDate: toDate(packDate),
        moveDate: toDate(moveDate),
        deliveryDate: toDate(deliveryDate),
        volumeCbm: volumeCbm ? parseFloat(volumeCbm) : null,
        weightKg: weightKg ? parseFloat(weightKg) : null,
        shipmentMode, notes,
        serviceDate: serviceDate !== undefined ? (serviceDate ? new Date(serviceDate) : null) : undefined,
        serviceTime: serviceTime !== undefined ? (serviceTime || null) : undefined,
        clientPhone: clientPhone !== undefined ? (clientPhone || null) : undefined,
        clientHomePhone: clientHomePhone !== undefined ? (clientHomePhone || null) : undefined,
        companyName: companyName !== undefined ? (companyName || null) : undefined,
        companyPhone: companyPhone !== undefined ? (companyPhone || null) : undefined,
        serviceDetails: serviceDetails !== undefined ? (serviceDetails || null) : undefined,
        materials: materials !== undefined ? (materials || null) : undefined,
        quoteTo: quoteTo !== undefined ? (quoteTo || null) : undefined,
        creatorName: creatorName !== undefined ? (creatorName || null) : undefined,
        language: language !== undefined ? (language || 'EN') : undefined,
        quoteId: quoteId !== undefined ? (quoteId || null) : undefined,
      }
    })
    res.json(job)
  } catch (err) { next(err) }
})

// PATCH status only
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body
    if (!status) return res.status(400).json({ error: 'status is required' })

    if (status === 'CLOSED') {
      const files = await getPrisma().jobFile.findMany({ where: { jobId: req.params.id } })
      const attached = new Set(files.map(f => f.category))
      const missing = REQUIRED_FILE_CATEGORIES.filter(c => !attached.has(c))
      if (missing.length > 0) {
        return res.status(422).json({ error: 'MISSING_REQUIRED_FILES', missing })
      }
    }

    const job = await getPrisma().job.update({
      where: { id: req.params.id },
      data: { status },
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
