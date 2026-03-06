const router = require('express').Router()
const { getPrisma } = require('../db')

// GET all
router.get('/', async (req, res, next) => {
  try {
    const { search } = req.query
    const where = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { country: { contains: search, mode: 'insensitive' } },
      ]
    } : {}
    const clients = await getPrisma().client.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { jobs: true } } }
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
    const { clientType = 'CORPORATE', firstName, lastName, accountNum, email, phone, address, country, notes } = req.body
    let name = req.body.name
    if (clientType === 'INDIVIDUAL') name = [firstName, lastName].filter(Boolean).join(' ')
    if (!name) return res.status(400).json({ error: 'name is required' })
    const client = await getPrisma().client.create({
      data: { clientType, name, firstName: firstName || null, lastName: lastName || null, accountNum: accountNum || undefined, email, phone, address, country, notes }
    })
    res.status(201).json(client)
  } catch (err) { next(err) }
})

// PUT update
router.put('/:id', async (req, res, next) => {
  try {
    const { clientType, firstName, lastName, accountNum, email, phone, address, country, notes } = req.body
    let name = req.body.name
    if (clientType === 'INDIVIDUAL') name = [firstName, lastName].filter(Boolean).join(' ')
    const client = await getPrisma().client.update({
      where: { id: req.params.id },
      data: { clientType, name, firstName: firstName || null, lastName: lastName || null, accountNum: accountNum || undefined, email, phone, address, country, notes }
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
