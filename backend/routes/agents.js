const router = require('express').Router()
const { getPrisma } = require('../db')
const { logAudit } = require('../audit')

// GET all
router.get('/', async (req, res, next) => {
  try {
    const { search } = req.query
    const where = {}
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { country: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }
    const agents = await getPrisma().agent.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { _count: { select: { originJobs: true, destJobs: true, customsJobs: true } } }
    })
    res.json(agents)
  } catch (err) { next(err) }
})

// GET one
router.get('/:id', async (req, res, next) => {
  try {
    const agent = await getPrisma().agent.findUnique({ where: { id: req.params.id } })
    if (!agent) return res.status(404).json({ error: 'Not found' })
    res.json(agent)
  } catch (err) { next(err) }
})

// POST create
router.post('/', async (req, res, next) => {
  try {
    const { name, country, city, email, phone, notes } = req.body
    if (!name) return res.status(400).json({ error: 'name is required' })
    const agent = await getPrisma().agent.create({
      data: { name, country: country || null, city: city || null, email: email || null, phone: phone || null, notes: notes || null }
    })
    logAudit(req, 'Agent', agent.id, 'CREATE', null, agent)
    res.status(201).json(agent)
  } catch (err) { next(err) }
})

// PUT update
router.put('/:id', async (req, res, next) => {
  try {
    const { name, country, city, email, phone, notes } = req.body
    const before = await getPrisma().agent.findUnique({ where: { id: req.params.id } })
    const agent = await getPrisma().agent.update({
      where: { id: req.params.id },
      data: { name, country: country || null, city: city || null, email: email || null, phone: phone || null, notes: notes || null }
    })
    logAudit(req, 'Agent', req.params.id, 'UPDATE', before, agent)
    res.json(agent)
  } catch (err) { next(err) }
})

// DELETE
router.delete('/:id', async (req, res, next) => {
  try {
    const before = await getPrisma().agent.findUnique({ where: { id: req.params.id } })
    await getPrisma().agent.delete({ where: { id: req.params.id } })
    logAudit(req, 'Agent', req.params.id, 'DELETE', before, null)
    res.status(204).end()
  } catch (err) { next(err) }
})

module.exports = router
