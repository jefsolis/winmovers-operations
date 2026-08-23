const router = require('express').Router()
const { getPrisma } = require('../db')
const { logAudit } = require('../audit')

const forbidBodegaWrite = (req, res, next) => {
  if (req.user?.role === 'BODEGA') return res.status(403).json({ error: 'Forbidden' })
  next()
}

// GET /api/packing-item-types — active items only
router.get('/', async (req, res, next) => {
  try {
    const items = await getPrisma().packingItemType.findMany({
      where: { active: true },
      orderBy: { nameEs: 'asc' },
    })
    res.json(items)
  } catch (err) { next(err) }
})

// GET /api/packing-item-types/all — all items (admin)
router.get('/all', async (req, res, next) => {
  try {
    const items = await getPrisma().packingItemType.findMany({
      orderBy: { nameEs: 'asc' },
    })
    res.json(items)
  } catch (err) { next(err) }
})

// POST /api/packing-item-types
router.post('/', forbidBodegaWrite, async (req, res, next) => {
  try {
    const { nameEs, nameEn } = req.body
    if (!nameEs?.trim()) return res.status(400).json({ error: 'nameEs is required' })
    if (!nameEn?.trim()) return res.status(400).json({ error: 'nameEn is required' })
    const item = await getPrisma().packingItemType.create({
      data: { nameEs: nameEs.trim(), nameEn: nameEn.trim() },
    })
    logAudit(req, 'PackingItemType', item.id, 'CREATE', null, item)
    res.status(201).json(item)
  } catch (err) { next(err) }
})

// PUT /api/packing-item-types/:id
router.put('/:id', forbidBodegaWrite, async (req, res, next) => {
  try {
    const { nameEs, nameEn } = req.body
    const before = await getPrisma().packingItemType.findUnique({ where: { id: req.params.id } })
    const item = await getPrisma().packingItemType.update({
      where: { id: req.params.id },
      data: { nameEs: nameEs?.trim(), nameEn: nameEn?.trim() },
    })
    logAudit(req, 'PackingItemType', item.id, 'UPDATE', before, item)
    res.json(item)
  } catch (err) { next(err) }
})

// PATCH /api/packing-item-types/:id/deactivate
router.patch('/:id/deactivate', forbidBodegaWrite, async (req, res, next) => {
  try {
    const before = await getPrisma().packingItemType.findUnique({ where: { id: req.params.id } })
    const item = await getPrisma().packingItemType.update({
      where: { id: req.params.id },
      data: { active: false },
    })
    logAudit(req, 'PackingItemType', item.id, 'UPDATE', before, item)
    res.json(item)
  } catch (err) { next(err) }
})

module.exports = router
