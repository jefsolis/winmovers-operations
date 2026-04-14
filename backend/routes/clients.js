const router = require('express').Router()
const { getPrisma } = require('../db')

// GET all
router.get('/', async (req, res, next) => {
  try {
    const { search, clientType } = req.query
    const where = {}
    if (clientType === 'INDIVIDUAL') where.clientType = 'INDIVIDUAL'
    else if (clientType === 'CORPORATE') where.clientType = 'CORPORATE'
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { country: { contains: search, mode: 'insensitive' } },
      ]
    }
    const clients = await getPrisma().client.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { jobs: true } },
        movingFiles: { where: { status: 'OPEN' }, select: { id: true, fileNumber: true, category: true } },
        corporateMovingFiles: { where: { status: 'OPEN' }, select: { id: true, fileNumber: true, category: true } },
      }
    })
    res.json(clients)
  } catch (err) { next(err) }
})

// GET one
router.get('/:id', async (req, res, next) => {
  try {
    const client = await getPrisma().client.findUnique({
      where: { id: req.params.id },
      include: {}
    })
    if (!client) return res.status(404).json({ error: 'Not found' })
    res.json(client)
  } catch (err) { next(err) }
})

// POST create
router.post('/', async (req, res, next) => {
  try {
    const { clientType = 'CORPORATE', firstName, lastName, email, phone, address, country, notes } = req.body
    let name = req.body.name
    if (clientType === 'INDIVIDUAL') name = [firstName, lastName].filter(Boolean).join(' ')
    if (!name) return res.status(400).json({ error: 'name is required' })
    const client = await getPrisma().client.create({
      data: { clientType, name, firstName: firstName || null, lastName: lastName || null, email, phone, address, country, notes }
    })
    res.status(201).json(client)
  } catch (err) { next(err) }
})

// PATCH — partial update (phone / email only)
router.patch('/:id', async (req, res, next) => {
  try {
    const updates = {}
    if ('phone' in req.body) updates.phone = req.body.phone || null
    if ('email' in req.body) updates.email = req.body.email || null
    const client = await getPrisma().client.update({ where: { id: req.params.id }, data: updates })
    res.json(client)
  } catch (err) { next(err) }
})

// PUT update
router.put('/:id', async (req, res, next) => {
  try {
    const { clientType, firstName, lastName, email, phone, address, country, notes } = req.body
    let name = req.body.name
    if (clientType === 'INDIVIDUAL') name = [firstName, lastName].filter(Boolean).join(' ')
    const client = await getPrisma().client.update({
      where: { id: req.params.id },
      data: { clientType, name, firstName: firstName || null, lastName: lastName || null, email, phone, address, country, notes }
    })
    res.json(client)
  } catch (err) { next(err) }
})

// DELETE
router.delete('/:id', async (req, res, next) => {
  try {
    await getPrisma().client.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) { next(err) }
})

module.exports = router
