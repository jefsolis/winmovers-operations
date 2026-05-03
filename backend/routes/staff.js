const router = require('express').Router()
const { logAudit } = require('../audit')
const { getPrisma } = require('../db')
const { searchAzureUsers } = require('../services/graph')
const multer  = require('multer')
const storage = require('../storage/azure')

const signatureUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') cb(null, true)
    else cb(new Error('Only PNG and JPEG images are allowed'))
  },
})

// GET /me — returns the StaffMember linked to the current logged-in user (by azureOid)
router.get('/me', async (req, res, next) => {
  try {
    const oid = req.user?.oid
    if (!oid) return res.json(null)
    const member = await getPrisma().staffMember.findUnique({ where: { azureOid: oid } })
    if (!member) return res.json(null)
    let signatureImageUrl = null
    if (member.signatureImagePath) {
      try { signatureImageUrl = await storage.getDownloadUrl(member.signatureImagePath) } catch (_) {}
    }
    res.json({ ...member, signatureImageUrl })
  } catch (err) { next(err) }
})

// POST /me/signature-image — upload or replace the user's signature image
router.post('/me/signature-image', signatureUpload.single('file'), async (req, res, next) => {
  try {
    const oid = req.user?.oid
    if (!oid) return res.status(401).json({ error: 'Not authenticated' })
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    const member = await getPrisma().staffMember.findUnique({ where: { azureOid: oid }, select: { id: true, signatureImagePath: true } })
    if (!member) return res.status(404).json({ error: 'No staff record linked to this account' })
    // Delete previous blob if it exists and extension differs (png vs jpg)
    if (member.signatureImagePath && member.signatureImagePath !== `signatures/${member.id}${req.file.mimetype === 'image/png' ? '.png' : '.jpg'}`) {
      try { await storage.deleteFile(member.signatureImagePath) } catch (_) {}
    }
    const blobPath = await storage.uploadSignatureImage(member.id, req.file.buffer, req.file.mimetype)
    await getPrisma().staffMember.update({ where: { id: member.id }, data: { signatureImagePath: blobPath } })
    const signatureImageUrl = await storage.getDownloadUrl(blobPath)
    res.json({ signatureImagePath: blobPath, signatureImageUrl })
  } catch (err) { next(err) }
})

// DELETE /me/signature-image — remove the user's signature image
router.delete('/me/signature-image', async (req, res, next) => {
  try {
    const oid = req.user?.oid
    if (!oid) return res.status(401).json({ error: 'Not authenticated' })
    const member = await getPrisma().staffMember.findUnique({ where: { azureOid: oid }, select: { id: true, signatureImagePath: true } })
    if (!member) return res.status(404).json({ error: 'No staff record linked to this account' })
    if (member.signatureImagePath) {
      try { await storage.deleteFile(member.signatureImagePath) } catch (_) {}
      await getPrisma().staffMember.update({ where: { id: member.id }, data: { signatureImagePath: null } })
    }
    res.status(204).end()
  } catch (err) { next(err) }
})

// GET /me/dashboard-layout — returns persisted hidden-card list for current user
router.get('/me/dashboard-layout', async (req, res, next) => {
  try {
    const oid = req.user?.oid
    if (!oid) return res.json({ hiddenCards: null })
    const member = await getPrisma().staffMember.findUnique({
      where: { azureOid: oid },
      select: { dashboardLayout: true },
    })
    res.json(member?.dashboardLayout ?? { hiddenCards: null })
  } catch (err) { next(err) }
})

// PUT /me/dashboard-layout — persists hidden-card list for current user
router.put('/me/dashboard-layout', async (req, res, next) => {
  try {
    const oid = req.user?.oid
    if (!oid) return res.status(204).end()
    const { hiddenCards } = req.body
    if (!Array.isArray(hiddenCards)) return res.status(400).json({ error: 'hiddenCards must be an array' })
    await getPrisma().staffMember.updateMany({
      where: { azureOid: oid },
      data: { dashboardLayout: { hiddenCards } },
    })
    res.status(204).end()
  } catch (err) { next(err) }
})

// PUT /me/profile — lets the current user update their own self-service fields
router.put('/me/profile', async (req, res, next) => {
  try {
    const oid = req.user?.oid
    if (!oid) return res.status(401).json({ error: 'Not authenticated' })
    const { emailSignature } = req.body
    const updated = await getPrisma().staffMember.updateMany({
      where: { azureOid: oid },
      data: { emailSignature: emailSignature || null },
    })
    if (updated.count === 0) return res.status(404).json({ error: 'No staff record linked to this account' })
    res.status(204).end()
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
            canCoordinateFiles, role, azureOid, emailSignature } = req.body
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
        emailSignature: emailSignature || null,
      },
    })
    logAudit(req, 'StaffMember', member.id, 'CREATE', null, member)
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
            canCoordinateFiles, role, azureOid, emailSignature } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required.' })
    if (!email?.trim()) return res.status(400).json({ error: 'Email is required.' })
    const before = await getPrisma().staffMember.findUnique({ where: { id: req.params.id } })
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
        emailSignature: emailSignature || null,
      },
    })
    logAudit(req, 'StaffMember', req.params.id, 'UPDATE', before, member)
    res.json(member)
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A staff member with that email already exists.' })
    next(err)
  }
})

// DELETE
router.delete('/:id', async (req, res, next) => {
  try {
    const before = await getPrisma().staffMember.findUnique({ where: { id: req.params.id } })
    await getPrisma().staffMember.delete({ where: { id: req.params.id } })
    logAudit(req, 'StaffMember', req.params.id, 'DELETE', before, null)
    res.json({ ok: true })
  } catch (err) { next(err) }
})

module.exports = router
