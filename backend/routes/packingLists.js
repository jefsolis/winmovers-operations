const router = require('express').Router()
const { getPrisma } = require('../db')
const { logAudit } = require('../audit')
const {
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  BlobServiceClient,
} = require('@azure/storage-blob')
const { v4: uuidv4 } = require('uuid')
const { getDownloadUrl } = require('../storage/azure')

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
const containerName = process.env.AZURE_STORAGE_CONTAINER || 'job-files'

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseCredentials() {
  const accountName = connectionString?.match(/AccountName=([^;]+)/)?.[1]
  const accountKey  = connectionString?.match(/AccountKey=([^;]+)/)?.[1]
  if (!accountName || !accountKey) throw new Error('Invalid AZURE_STORAGE_CONNECTION_STRING')
  return { accountName, accountKey }
}

async function getNextListNumber() {
  const last = await getPrisma().packingList.findFirst({
    where: { listNumber: { startsWith: 'PL-' } },
    orderBy: { listNumber: 'desc' },
  })
  if (!last) return 'PL-0001'
  const num = parseInt(last.listNumber.replace('PL-', ''), 10)
  return `PL-${String(num + 1).padStart(4, '0')}`
}

function lockExpiry() {
  return new Date(Date.now() + 4 * 60 * 60 * 1000)
}

function normalizeStatus(status) {
  if (status === 'COMPLETE') return 'CLOSED'
  return status
}

function getSyncVisibilityState(list) {
  if (list.status === 'ACTIVE' && list.lockedByDeviceId) return 'SYNC_IN_PROGRESS'
  return 'IN_SYNC'
}

// ── POST /api/packing-lists/upload-token ─────────────────────────────────────
// Must be registered before /:id routes to avoid param capture
router.post('/upload-token', async (req, res, next) => {
  try {
    const { packingListId, filename, contentType } = req.body
    if (!packingListId || !filename) {
      return res.status(400).json({ error: 'packingListId and filename are required' })
    }
    const { accountName, accountKey } = parseCredentials()
    const { StorageSharedKeyCredential } = require('@azure/storage-blob')
    const credential = new StorageSharedKeyCredential(accountName, accountKey)
    const year = new Date().getUTCFullYear()
    const blobName = `packing/${year}/${packingListId}/${uuidv4()}-${filename}`
    const sasToken = generateBlobSASQueryParameters(
      {
        containerName,
        blobName,
        permissions: BlobSASPermissions.parse('rcw'),
        expiresOn: new Date(Date.now() + 60 * 60 * 1000),
        contentType: contentType || 'application/octet-stream',
      },
      credential
    ).toString()
    const sasUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}?${sasToken}`
    res.json({ sasUrl, blobPath: blobName })
  } catch (err) { next(err) }
})

// ── GET /api/packing-lists?movingFileId= ─────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { movingFileId } = req.query
    const where = movingFileId ? { movingFileId, deletedAt: null } : { deletedAt: null }
    const lists = await getPrisma().packingList.findMany({
      where,
      include: {
        _count: { select: { packages: true } },
        packages: {
          include: {
            _count: { select: { items: true, photos: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    const result = lists.map(l => ({
      id: l.id,
      listNumber: l.listNumber,
      movingFileId: l.movingFileId,
      operatorName: l.operatorName,
      status: normalizeStatus(l.status),
      reviewLanguage: l.reviewLanguage,
      lockedByDeviceId: l.lockedByDeviceId,
      lockExpiresAt: l.lockExpiresAt,
      packageCount: l._count.packages,
      itemCount: l.packages.reduce((sum, p) => sum + p._count.items, 0),
      photoCount: l.packages.reduce((sum, p) => sum + p._count.photos, 0),
      syncVisibilityState: getSyncVisibilityState(l),
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    }))
    res.json(result)
  } catch (err) { next(err) }
})

// ── POST /api/packing-lists ───────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { movingFileId, operatorName, deviceId } = req.body
    if (!movingFileId) return res.status(400).json({ error: 'movingFileId is required' })
    if (!operatorName?.trim()) return res.status(400).json({ error: 'operatorName is required' })
    if (!deviceId) return res.status(400).json({ error: 'deviceId is required' })

    const existingLinked = await getPrisma().packingList.findFirst({
      where: {
        movingFileId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    })
    if (existingLinked) {
      return res.status(409).json({
        error: 'A packing list already exists for this file',
        packingListId: existingLinked.id,
        listNumber: existingLinked.listNumber,
      })
    }

    const duplicateWindowStart = new Date(Date.now() - 90 * 1000)
    const recentCandidate = await getPrisma().packingList.findFirst({
      where: {
        movingFileId,
        operatorName: operatorName.trim(),
        status: 'ACTIVE',
        deletedAt: null,
        lockedByDeviceId: deviceId,
        createdAt: { gte: duplicateWindowStart },
      },
      include: { _count: { select: { packages: true } } },
      orderBy: { createdAt: 'desc' },
    })

    if (recentCandidate && recentCandidate._count.packages === 0) {
      return res.status(200).json({
        id: recentCandidate.id,
        listNumber: recentCandidate.listNumber,
        lockedByDeviceId: recentCandidate.lockedByDeviceId,
        lockExpiresAt: recentCandidate.lockExpiresAt,
      })
    }

    const listNumber = await getNextListNumber()
    const now = new Date()
    const list = await getPrisma().packingList.create({
      data: {
        listNumber,
        movingFileId,
        operatorName: operatorName.trim(),
        status: 'ACTIVE',
        lockedByDeviceId: deviceId,
        lockedAt: now,
        lockExpiresAt: lockExpiry(),
      },
    })
    logAudit(req, 'PackingList', list.id, 'CREATE', null, list)
    res.status(201).json({
      id: list.id,
      listNumber: list.listNumber,
      lockedByDeviceId: list.lockedByDeviceId,
      lockExpiresAt: list.lockExpiresAt,
    })
  } catch (err) { next(err) }
})

// ── GET /api/packing-lists/:id ────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const list = await getPrisma().packingList.findUnique({
      where: { id: req.params.id },
      include: {
        packages: {
          include: {
            items: {
              include: {
                packingItemType: {
                  select: { id: true, nameEs: true, nameEn: true, active: true },
                },
              },
            },
            photos: true,
          },
        },
      },
    })
    if (!list || list.deletedAt) return res.status(404).json({ error: 'Packing list not found' })

    let signatureDownloadUrl = null
    if (list.signatureUrl) {
      try {
        signatureDownloadUrl = await getDownloadUrl(list.signatureUrl)
      } catch {
        signatureDownloadUrl = null
      }
    }

    const packagesWithPhotoUrls = await Promise.all(
      list.packages.map(async (pkg) => {
        const photos = await Promise.all(
          pkg.photos.map(async (photo) => {
            let downloadUrl = null
            if (photo.blobPath) {
              try {
                downloadUrl = await getDownloadUrl(photo.blobPath)
              } catch {
                downloadUrl = null
              }
            }
            return {
              ...photo,
              downloadUrl,
            }
          })
        )
        return {
          ...pkg,
          photos,
        }
      })
    )

    res.json({
      ...list,
      signatureUrl: signatureDownloadUrl,
      packages: packagesWithPhotoUrls,
      status: normalizeStatus(list.status),
      syncVisibilityState: getSyncVisibilityState(list),
    })
  } catch (err) { next(err) }
})

// ── PUT /api/packing-lists/:id ────────────────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  try {
    const { deviceId, operatorName, packages: pkgsPayload } = req.body
    if (!deviceId) return res.status(400).json({ error: 'deviceId is required' })

    const list = await getPrisma().packingList.findUnique({ where: { id: req.params.id } })
    if (!list || list.deletedAt) return res.status(404).json({ error: 'Packing list not found' })
    if (list.lockedByDeviceId && list.lockedByDeviceId !== deviceId && list.lockExpiresAt > new Date()) {
      return res.status(409).json({ error: 'Locked by another device', lockedByDeviceId: list.lockedByDeviceId, lockExpiresAt: list.lockExpiresAt })
    }
    if (normalizeStatus(list.status) === 'CLOSED' || list.status === 'COMPLETE_PENDING_SYNC') {
      return res.status(409).json({ error: 'Packing list is not editable in current state' })
    }

    // Full-replace packages / items / photos in a transaction
    const updated = await getPrisma().$transaction(async (tx) => {
      // Delete packages not in payload
      const payloadPkgIds = (pkgsPayload || []).map(p => p.id).filter(Boolean)
      await tx.package.deleteMany({
        where: { packingListId: req.params.id, id: { notIn: payloadPkgIds } },
      })

      // Upsert packages
      for (const pkg of pkgsPayload || []) {
        await tx.package.upsert({
          where: { id: pkg.id },
          create: { id: pkg.id, packingListId: req.params.id, barcode: pkg.barcode },
          update: { barcode: pkg.barcode },
        })

        // Delete items not in payload
        const payloadItemIds = (pkg.items || []).map(i => i.id).filter(Boolean)
        await tx.packageItem.deleteMany({
          where: { packageId: pkg.id, id: { notIn: payloadItemIds } },
        })
        const payloadPhotoIds = (pkg.photos || []).map(p => p.id).filter(Boolean)
        await tx.packagePhoto.deleteMany({
          where: { packageId: pkg.id, id: { notIn: payloadPhotoIds } },
        })
        for (const item of pkg.items || []) {
          if (!item.packingItemTypeId && !item.customName) {
            throw Object.assign(new Error('Each package item must include packingItemTypeId or customName'), { status: 400 })
          }
          await tx.packageItem.upsert({
            where: { id: item.id },
            create: {
              id: item.id,
              packageId: pkg.id,
              packingItemTypeId: item.packingItemTypeId || null,
              customName: item.customName || null,
              quantity: item.quantity ?? 1,
              note: item.note || null,
            },
            update: {
              packingItemTypeId: item.packingItemTypeId || null,
              customName: item.customName || null,
              quantity: item.quantity ?? 1,
              note: item.note || null,
            },
          })
        }

        // Upsert photos (only those with blobPath — not yet uploaded photos are not sent)
        for (const photo of pkg.photos || []) {
          if (!photo.blobPath) continue
          await tx.packagePhoto.upsert({
            where: { id: photo.id },
            create: { id: photo.id, packageId: pkg.id, blobPath: photo.blobPath },
            update: { blobPath: photo.blobPath },
          })
        }
      }

      // Renew lock and update operator name
      return tx.packingList.update({
        where: { id: req.params.id },
        data: {
          status: 'ACTIVE',
          operatorName: operatorName?.trim() || list.operatorName,
          lockedByDeviceId: deviceId,
          lockedAt: new Date(),
          lockExpiresAt: lockExpiry(),
          completionLastError: null,
        },
      })
    })

    res.json({ id: updated.id, updatedAt: updated.updatedAt, lockExpiresAt: updated.lockExpiresAt })
  } catch (err) {
    if (err?.status === 400) return res.status(400).json({ error: err.message })
    next(err)
  }
})

// ── PATCH /api/packing-lists/:id/claim-lock ───────────────────────────────────
router.patch('/:id/claim-lock', async (req, res, next) => {
  try {
    const { deviceId } = req.body
    if (!deviceId) return res.status(400).json({ error: 'deviceId is required' })

    const now = new Date()
    const claimed = await getPrisma().$transaction(async (tx) => {
      const existing = await tx.packingList.findUnique({ where: { id: req.params.id } })
      if (!existing || existing.deletedAt) throw Object.assign(new Error('Not found'), { status: 404 })
      if (existing.lockedByDeviceId && existing.lockedByDeviceId !== deviceId && existing.lockExpiresAt > now) {
        throw Object.assign(new Error('Locked'), { status: 409, lockedByDeviceId: existing.lockedByDeviceId, lockExpiresAt: existing.lockExpiresAt })
      }
        if (normalizeStatus(existing.status) === 'CLOSED' || existing.status === 'COMPLETE_PENDING_SYNC') {
          throw Object.assign(new Error('Packing list is not editable in current state'), { status: 409 })
        }
      const before = { ...existing }
      const updated = await tx.packingList.update({
        where: { id: req.params.id },
        data: { lockedByDeviceId: deviceId, lockedAt: now, lockExpiresAt: lockExpiry() },
      })
      return { updated, before }
    })

    logAudit(req, 'PackingList', req.params.id, 'UPDATE', claimed.before, claimed.updated)
    res.json({
      lockedByDeviceId: claimed.updated.lockedByDeviceId,
      lockedAt: claimed.updated.lockedAt,
      lockExpiresAt: claimed.updated.lockExpiresAt,
    })
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: err.message })
    if (err.status === 409 && err.lockedByDeviceId) return res.status(409).json({ error: 'Locked by another device', lockedByDeviceId: err.lockedByDeviceId, lockExpiresAt: err.lockExpiresAt })
    if (err.status === 409) return res.status(409).json({ error: err.message })
    next(err)
  }
})

// ── PATCH /api/packing-lists/:id/complete ─────────────────────────────────────
router.patch('/:id/complete', async (req, res, next) => {
  try {
    const { deviceId, signatureUrl, signatureDeclined, signatureDeclineNote, reviewLanguage } = req.body
    if (!deviceId) return res.status(400).json({ error: 'deviceId is required' })
    if (!reviewLanguage || !['ES', 'EN'].includes(reviewLanguage)) {
      return res.status(400).json({ error: 'reviewLanguage must be ES or EN' })
    }

    const list = await getPrisma().packingList.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { packages: true } }, movingFile: { include: { client: true, corporateClient: true } } },
    })
    if (!list || list.deletedAt) return res.status(404).json({ error: 'Packing list not found' })
    if (normalizeStatus(list.status) === 'CLOSED') {
      return res.json({ id: list.id, status: 'CLOSED', listNumber: list.listNumber })
    }
    if (list.lockedByDeviceId && list.lockedByDeviceId !== deviceId && list.lockExpiresAt > new Date()) {
      return res.status(409).json({ error: 'Locked by another device' })
    }
    if (list._count.packages === 0) {
      return res.status(400).json({ error: 'Cannot complete a packing list with no packages' })
    }
    if (signatureDeclined && !signatureDeclineNote?.trim()) {
      return res.status(400).json({ error: 'signatureDeclineNote is required when signature is declined' })
    }

    const before = { ...list }
    const updated = await getPrisma().packingList.update({
      where: { id: req.params.id },
      data: {
        status: 'CLOSED',
        reviewLanguage,
        completionRequestedAt: list.completionRequestedAt || new Date(),
        completionConfirmedAt: new Date(),
        completionLastError: null,
        signatureUrl: signatureUrl || null,
        signatureDeclined: !!signatureDeclined,
        signatureDeclineNote: signatureDeclineNote || null,
        lockedByDeviceId: null,
        lockedAt: null,
        lockExpiresAt: null,
      },
    })
    logAudit(req, 'PackingList', req.params.id, 'UPDATE', before, updated)

    // Fire-and-forget confirmation email
    const clientEmail = list.movingFile?.client?.email || list.movingFile?.corporateClient?.email
    if (clientEmail) {
      setImmediate(async () => {
        try {
          const { sendMail } = require('../services/graph')
          await sendMail({
            to: clientEmail,
            subject: `Lista de Empaque ${list.listNumber} – WinMovers`,
            html: `<p>Estimado cliente,</p>
<p>Su lista de empaque <strong>${list.listNumber}</strong> ha sido completada el ${new Date().toLocaleDateString('es-ES')}.</p>
<p>Operador: ${list.operatorName}</p>
<p>Gracias por confiar en WinMovers.</p>`,
          })
        } catch (e) {
          console.error('[packingLists] email error:', e.message)
        }
      })
    }

    res.json({ id: updated.id, status: updated.status, listNumber: updated.listNumber })
  } catch (err) { next(err) }
})

// ── PATCH /api/packing-lists/:id/soft-delete ─────────────────────────────────
router.patch('/:id/soft-delete', async (req, res, next) => {
  try {
    const before = await getPrisma().packingList.findUnique({ where: { id: req.params.id } })
    if (!before || before.deletedAt) return res.status(404).json({ error: 'Packing list not found' })

    const updated = await getPrisma().packingList.update({
      where: { id: req.params.id },
      data: {
        deletedAt: new Date(),
        deletedByOid: req.user?.oid || null,
        deletedByName: req.user?.name || null,
        lockedByDeviceId: null,
        lockedAt: null,
        lockExpiresAt: null,
      },
    })

    logAudit(req, 'PackingList', updated.id, 'DELETE', before, updated)
    // Mirror a lightweight entry on the parent file so File history shows packing list removal events.
    logAudit(
      req,
      'MovingFile',
      updated.movingFileId,
      'UPDATE',
      {
        packingListEvent: null,
        packingListId: updated.id,
      },
      {
        packingListEvent: 'SOFT_DELETE',
        packingListId: updated.id,
        deletedAt: updated.deletedAt,
      }
    )
    res.json({ id: updated.id, deletedAt: updated.deletedAt })
  } catch (err) { next(err) }
})

module.exports = router
