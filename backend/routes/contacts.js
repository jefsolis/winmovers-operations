const router = require('express').Router()
const { getPrisma } = require('../db')

// GET all
router.get('/', async (req, res, next) => {
  try {
    const { search, clientId } = req.query
    const where = {}
    if (clientId) where.clientId = clientId
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    }
    const contacts = await getPrisma().contact.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { client: { select: { id: true, name: true } } }
    })
    res.json(contacts)
  } catch (err) { next(err) }
})

// GET one
router.get('/:id', async (req, res, next) => {
  try {
    const contact = await getPrisma().contact.findUnique({
      where: { id: req.params.id },
      include: { client: true }
    })
    if (!contact) return res.status(404).json({ error: 'Not found' })
    res.json(contact)
  } catch (err) { next(err) }
})

// POST create
router.post('/', async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, clientId } = req.body
    if (!firstName || !lastName) return res.status(400).json({ error: 'firstName and lastName are required' })
    const contact = await getPrisma().contact.create({
      data: { firstName, lastName, email, phone, clientId: clientId || undefined }
    })
    res.status(201).json(contact)
  } catch (err) { next(err) }
})

// PUT update
router.put('/:id', async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, clientId } = req.body
    const contact = await getPrisma().contact.update({
      where: { id: req.params.id },
      data: { firstName, lastName, email, phone, clientId: clientId || null }
    })
    res.json(contact)
  } catch (err) { next(err) }
})

// DELETE
router.delete('/:id', async (req, res, next) => {
  try {
    await getPrisma().contact.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) { next(err) }
})

module.exports = router
