const router = require('express').Router()
const { getPrisma } = require('../db')
const { searchAzureUsers } = require('../services/graph')

// GET /me — returns the StaffMember linked to the current logged-in user (by azureOid)
router.get('/me', async (req, res, next) => {
  try {
    const oid = req.user?.oid
    if (!oid) return res.json(null)
    const member = await getPrisma().staffMember.findUnique({ where: { azureOid: oid } })
    res.json(member ?? null)
  } catch (err) { next(err) }
})

// GET /azure-users?q= — must be registered BEFORE /:id
router.get('/azure-users', async (req, res, next) => {
  try {
    const { q } = req.query
    if (!q || q.trim().length < 2) return res.json([])
    const users = await searchAzureUsers(q.trim())
    res.json(users)
  } catch (err) {
    // Surface Graph API errors as 502 with the message so the frontend can show it
    if (err.message?.includes('Graph')) return res.status(502).json({ error: err.message })
    next(err)
  }
})

// GET all
router.get('/', async (req, res, next) => {
  try {
    const { includeInactive, canBeAssignedToVisit, canCreateQuotes, canBeCreatorInWorkOrder, canCoordinateFiles } = req.query
    const where = includeInactive === 'true' ? {} : { isActive: true }
    if (canBeAssignedToVisit    === 'true') where.canBeAssignedToVisit    = true
    if (canCreateQuotes         === 'true') where.canCreateQuotes         = true
    if (canBeCreatorInWorkOrder === 'true') where.canBeCreatorInWorkOrder = true
    if (canCoordinateFiles      === 'true') where.canCoordinateFiles      = true
    const members = await getPrisma().staffMember.findMany({
      where,
      orderBy: { name: 'asc' },
    })
    res.json(members)
  } catch (err) { next(err) }
})

// GET one
router.get('/:id', async (req, res, next) => {
  try {
    const member = await getPrisma().staffMember.findUnique({
      where: { id: req.params.id },
      include: {
        visits: {
          take: 10,
          orderBy: { scheduledDate: 'desc' },
          select: { id: true, visitNumber: true, status: true, scheduledDate: true, prospectName: true },
        },
      },
    })
    if (!member) return res.status(404).json({ error: 'Not found' })
    res.json(member)
  } catch (err) { next(err) }
})

// POST create
router.post('/', async (req, res, next) => {
  try {
    const { name, email, phone, isActive,
            canBeAssignedToVisit, canCreateQuotes, canBeCreatorInWorkOrder,
            canCoordinateFiles, role, azureOid } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required.' })
    if (!email?.trim()) return res.status(400).json({ error: 'Email is required.' })
    const member = await getPrisma().staffMember.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone || null,
        isActive: isActive !== false,
        canBeAssignedToVisit:    canBeAssignedToVisit    !== false && Boolean(canBeAssignedToVisit    ?? true),
        canCreateQuotes:         Boolean(canCreateQuotes),
        canBeCreatorInWorkOrder: Boolean(canBeCreatorInWorkOrder),
        canCoordinateFiles:      Boolean(canCoordinateFiles),
        role: role || null,
        azureOid: azureOid || null,
      },
    })
    res.status(201).json(member)
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A staff member with that email already exists.' })
    next(err)
  }
})

// PUT update
router.put('/:id', async (req, res, next) => {
  try {
    const { name, email, phone, isActive,
            canBeAssignedToVisit, canCreateQuotes, canBeCreatorInWorkOrder,
            canCoordinateFiles, role, azureOid } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required.' })
    if (!email?.trim()) return res.status(400).json({ error: 'Email is required.' })
    const member = await getPrisma().staffMember.update({
      where: { id: req.params.id },
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone || null,
        isActive: isActive !== false,
        canBeAssignedToVisit:    Boolean(canBeAssignedToVisit),
        canCreateQuotes:         Boolean(canCreateQuotes),
        canBeCreatorInWorkOrder: Boolean(canBeCreatorInWorkOrder),
        canCoordinateFiles:      Boolean(canCoordinateFiles),
        role: role || null,
        azureOid: azureOid || null,
      },
    })
    res.json(member)
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A staff member with that email already exists.' })
    next(err)
  }
})

// DELETE
router.delete('/:id', async (req, res, next) => {
  try {
    await getPrisma().staffMember.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

module.exports = router
