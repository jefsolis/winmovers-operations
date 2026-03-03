const router = require('express').Router()
const { getPrisma } = require('../db')

// GET all
router.get('/', async (req, res, next) => {
  try {
    const { includeInactive } = req.query
    const where = includeInactive === 'true' ? {} : { isActive: true }
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
    const { name, email, phone, isActive } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required.' })
    if (!email?.trim()) return res.status(400).json({ error: 'Email is required.' })
    const member = await getPrisma().staffMember.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone || null,
        isActive: isActive !== false,
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
    const { name, email, phone, isActive } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required.' })
    if (!email?.trim()) return res.status(400).json({ error: 'Email is required.' })
    const member = await getPrisma().staffMember.update({
      where: { id: req.params.id },
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone || null,
        isActive: isActive !== false,
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
