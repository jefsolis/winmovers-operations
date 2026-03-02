const express = require('express')
const router  = express.Router({ mergeParams: true }) // expose :jobId from parent
const multer  = require('multer')
const { PrismaClient } = require('@prisma/client')
const storage = require('../storage/azure')

const prisma = new PrismaClient()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
})

// GET /api/jobs/:jobId/files
router.get('/', async (req, res, next) => {
  try {
    const files = await prisma.jobFile.findMany({
      where: { jobId: req.params.jobId },
      orderBy: { uploadedAt: 'desc' },
    })
    res.json(files)
  } catch (e) { next(e) }
})

// POST /api/jobs/:jobId/files  (multipart/form-data: file + category)
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    const { jobId } = req.params
    const { category = 'OTHER' } = req.body
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    // Verify job exists
    const job = await prisma.job.findUnique({ where: { id: jobId } })
    if (!job) return res.status(404).json({ error: 'Job not found' })

    const storagePath = await storage.uploadFile(
      jobId,
      req.file.originalname,
      req.file.buffer,
      req.file.mimetype
    )

    const file = await prisma.jobFile.create({
      data: {
        jobId,
        category,
        filename: req.file.originalname,
        storagePath,
        sizeBytes: req.file.size,
      },
    })
    res.status(201).json(file)
  } catch (e) { next(e) }
})

// GET /api/jobs/:jobId/files/:fileId/download  → returns { url: '...' } SAS URL
router.get('/:fileId/download', async (req, res, next) => {
  try {
    const file = await prisma.jobFile.findFirst({
      where: { id: req.params.fileId, jobId: req.params.jobId },
    })
    if (!file) return res.status(404).json({ error: 'File not found' })
    const url = await storage.getDownloadUrl(file.storagePath)
    res.json({ url })
  } catch (e) { next(e) }
})

// DELETE /api/jobs/:jobId/files/:fileId
router.delete('/:fileId', async (req, res, next) => {
  try {
    const file = await prisma.jobFile.findFirst({
      where: { id: req.params.fileId, jobId: req.params.jobId },
    })
    if (!file) return res.status(404).json({ error: 'File not found' })
    await storage.deleteFile(file.storagePath)
    await prisma.jobFile.delete({ where: { id: file.id } })
    res.json({ success: true })
  } catch (e) { next(e) }
})

module.exports = router
