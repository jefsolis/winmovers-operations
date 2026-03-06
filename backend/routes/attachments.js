const express = require('express')
const router  = express.Router({ mergeParams: true })
const multer  = require('multer')
const { getPrisma }          = require('../db')
const storage                = require('../storage/azure')
const { checkAutoClose }     = require('./movingFiles')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })

// GET /api/files/:fileId/attachments
router.get('/', async (req, res, next) => {
  try {
    const items = await getPrisma().attachment.findMany({
      where: { fileId: req.params.fileId },
      orderBy: { uploadedAt: 'desc' },
    })
    res.json(items)
  } catch (e) { next(e) }
})

// POST /api/files/:fileId/attachments
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    const { fileId } = req.params
    const { category = 'OTHER' } = req.body
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    const mf = await getPrisma().movingFile.findUnique({ where: { id: fileId } })
    if (!mf) return res.status(404).json({ error: 'File not found' })

    const storagePath = await storage.uploadFile(fileId, req.file.originalname, req.file.buffer, req.file.mimetype)
    const att = await getPrisma().attachment.create({
      data: { fileId, category, filename: req.file.originalname, storagePath, sizeBytes: req.file.size },
    })

    // Auto-close the file if all required attachments are now present
    await checkAutoClose(fileId, mf.category)

    res.status(201).json(att)
  } catch (e) { next(e) }
})

// GET /api/files/:fileId/attachments/:attId/download
router.get('/:attId/download', async (req, res, next) => {
  try {
    const att = await getPrisma().attachment.findFirst({
      where: { id: req.params.attId, fileId: req.params.fileId },
    })
    if (!att) return res.status(404).json({ error: 'Not found' })
    const url = await storage.getDownloadUrl(att.storagePath)
    res.json({ url })
  } catch (e) { next(e) }
})

// DELETE /api/files/:fileId/attachments/:attId
router.delete('/:attId', async (req, res, next) => {
  try {
    const att = await getPrisma().attachment.findFirst({
      where: { id: req.params.attId, fileId: req.params.fileId },
    })
    if (!att) return res.status(404).json({ error: 'Not found' })
    await storage.deleteFile(att.storagePath)
    await getPrisma().attachment.delete({ where: { id: att.id } })
    // Re-open the file if it was closed and a required attachment was deleted
    const mf = await getPrisma().movingFile.findUnique({ where: { id: req.params.fileId } })
    if (mf?.status === 'CLOSED') {
      await getPrisma().movingFile.update({ where: { id: req.params.fileId }, data: { status: 'OPEN' } })
    }
    res.json({ success: true })
  } catch (e) { next(e) }
})

module.exports = router
