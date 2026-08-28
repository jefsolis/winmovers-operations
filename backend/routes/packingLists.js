const router = require('express').Router()
const { getPrisma } = require('../db')
const { logAudit } = require('../audit')
const {
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  BlobServiceClient,
} = require('@azure/storage-blob')
const { v4: uuidv4, validate: uuidValidate } = require('uuid')
const { getDownloadUrl, deleteFile } = require('../storage/azure')

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

function normalizeProgressStatus(list) {
  if (['CLOSED', 'COMPLETE'].includes(list.status)) return 'COMPLETED'
  return list.progressStatus || 'NOT_STARTED'
}

function formatAddress(...parts) {
  return parts.filter(part => part && String(part).trim()).join(', ') || null
}

function getServiceContext(movingFile) {
  const client = movingFile.client || movingFile.corporateClient || movingFile.job?.client || movingFile.job?.corporateClient
  const job = movingFile.job
  return {
    clientId: client?.id || null,
    clientName: client?.name || job?.companyName || null,
    phone: client?.phone || job?.clientPhone || job?.clientHomePhone || job?.companyPhone || null,
    address: formatAddress(movingFile.originAddress, movingFile.originCity, movingFile.originCountry)
      || formatAddress(job?.originAddress, job?.originCity, job?.originCountry)
      || client?.address
      || null,
    serviceLatitude: job?.serviceLatitude ?? null,
    serviceLongitude: job?.serviceLongitude ?? null,
    jobType: job?.type || movingFile.category,
    fileNumber: movingFile.fileNumber,
    category: movingFile.category,
  }
}

const LOCATION_UNAVAILABLE_REASONS = ['PERMISSION_DENIED', 'SERVICES_DISABLED', 'TIMEOUT', 'UNSUPPORTED', 'ERROR']

// Location is evidence, never a gate: unusable input degrades to ERROR instead of rejecting the stage.
function parseStageLocation(raw) {
  if (!raw || typeof raw !== 'object') return null

  // Check if both latitude and longitude are actually present (not null/undefined)
  // before attempting to convert them to numbers; this prevents Number(null) = 0 from
  // being interpreted as valid coordinates.
  const hasRawCoordinates = raw.latitude != null && raw.longitude != null

  if (hasRawCoordinates) {
    const latitude = Number(raw.latitude)
    const longitude = Number(raw.longitude)
    const isValidCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude)
      && latitude >= -90 && latitude <= 90
      && longitude >= -180 && longitude <= 180

    if (isValidCoordinates) {
      const accuracy = Number(raw.accuracy)
      const capturedAt = raw.capturedAt ? new Date(raw.capturedAt) : null
      return {
        latitude,
        longitude,
        locationAccuracy: Number.isFinite(accuracy) ? accuracy : null,
        locationCapturedAt: capturedAt && !Number.isNaN(capturedAt.getTime()) ? capturedAt : null,
        locationUnavailableReason: null,
      }
    }
  }

  // No valid coordinates: store the unavailable reason if present, otherwise ERROR
  const reason = LOCATION_UNAVAILABLE_REASONS.includes(raw.unavailableReason) ? raw.unavailableReason : 'ERROR'
  return {
    latitude: null,
    longitude: null,
    locationAccuracy: null,
    locationCapturedAt: null,
    locationUnavailableReason: reason,
  }
}

function serializeStageLocation(row) {
  if (!row) return null
  if (row.latitude === null && row.longitude === null && !row.locationUnavailableReason) return null
  return {
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    accuracy: row.locationAccuracy ?? null,
    capturedAt: row.locationCapturedAt ?? null,
    unavailableReason: row.locationUnavailableReason ?? null,
  }
}

const movingFileContextInclude = {
  client: true,
  corporateClient: true,
  job: { include: { client: true, corporateClient: true } },
}

async function serializeTransition(transition) {
  if (!transition) return null
  let signatureUrl = null
  if (transition.signatureUrl) {
    try {
      signatureUrl = await getDownloadUrl(transition.signatureUrl)
    } catch {
      signatureUrl = null
    }
  }
  return { ...transition, signatureUrl, location: serializeStageLocation(transition) }
}

async function getMissingBarcodeCountForList(packingListId, tx = getPrisma()) {
  const count = await tx.package.count({
    where: {
      packingListId,
      OR: [
        { barcodeState: 'MISSING' },
        { barcode: null },
        { barcode: '' },
      ],
    },
  })
  return count
}

async function serializeWorkdayEvent(event) {
  if (!event) return null
  let clientSignatureUrl = null
  let crewLeaderSignatureUrl = null
  if (event.signaturePair?.clientSignatureBlobPath) {
    try {
      clientSignatureUrl = await getDownloadUrl(event.signaturePair.clientSignatureBlobPath)
    } catch {
      clientSignatureUrl = null
    }
  }
  if (event.signaturePair?.crewLeaderSignatureBlobPath) {
    try {
      crewLeaderSignatureUrl = await getDownloadUrl(event.signaturePair.crewLeaderSignatureBlobPath)
    } catch {
      crewLeaderSignatureUrl = null
    }
  }
  return {
    id: event.id,
    workdayIndex: event.workdayIndex,
    eventType: event.eventType,
    fromProgressStatus: event.fromProgressStatus,
    toProgressStatus: event.toProgressStatus,
    occurredAt: event.occurredAt,
    confirmedAt: event.confirmedAt,
    actorName: event.actorName,
    observations: event.observations,
    location: serializeStageLocation(event),
    signatures: event.signaturePair ? {
      clientSignatureUrl,
      crewLeaderSignatureUrl,
      clientSignerName: event.signaturePair.clientSignerName,
      crewLeaderName: event.signaturePair.crewLeaderName,
      language: event.signaturePair.signatureLanguage,
    } : null,
  }
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
        movingFile: { include: movingFileContextInclude },
        progressTransitions: { orderBy: { confirmedAt: 'desc' }, take: 1 },
        packages: {
          include: {
            _count: { select: { items: true, photos: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    const result = await Promise.all(lists.map(async l => ({
      id: l.id,
      listNumber: l.listNumber,
      movingFileId: l.movingFileId,
      operatorName: l.operatorName,
      status: normalizeStatus(l.status),
      progressStatus: normalizeProgressStatus(l),
      pendingProgressStatus: null,
      serviceContext: getServiceContext(l.movingFile),
      latestTransition: await serializeTransition(l.progressTransitions[0]),
      reviewLanguage: l.reviewLanguage,
      lockedByDeviceId: l.lockedByDeviceId,
      lockExpiresAt: l.lockExpiresAt,
      packageCount: l._count.packages,
      itemCount: l.packages.reduce((sum, p) => sum + p._count.items, 0),
      photoCount: l.packages.reduce((sum, p) => sum + p._count.photos, 0),
      syncVisibilityState: getSyncVisibilityState(l),
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    })))
    res.json(result)
  } catch (err) { next(err) }
})

// ── POST /api/packing-lists ───────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { movingFileId, operatorName, deviceId, location } = req.body
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
        progressStatus: 'NOT_STARTED',
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
        ...(parseStageLocation(location) || {}),
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
        movingFile: { include: movingFileContextInclude },
        progressTransitions: { orderBy: { confirmedAt: 'asc' } },
        workdayEvents: {
          include: { signaturePair: true },
          orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
        },
        satisfactionResponse: true,
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

    const workdayHistory = await Promise.all(list.workdayEvents.map(serializeWorkdayEvent))
    const missingBarcodeCount = await getMissingBarcodeCountForList(list.id)
    const ingressEgressOps = await getPrisma().packingIngressEgressOperation.findMany({
      where: { packingListId: list.id },
      include: { boxScans: true },
      orderBy: { createdAt: 'asc' },
    })
    const orderedPackagesForIngressEgress = await getOrderedPackagesForList(list.id)
    const ingressEgressOperations = await Promise.all(
      ingressEgressOps.map(op => serializeIngressEgressOperation(op, orderedPackagesForIngressEgress))
    )

    res.json({
      ...list,
      progressStatus: normalizeProgressStatus(list),
      pendingProgressStatus: null,
      completionBlockedReason: missingBarcodeCount > 0 ? 'MISSING_BOX_BARCODES' : null,
      creationLocation: serializeStageLocation(list),
      workdayHistory,
      ingressEgressOperations,
      serviceContext: getServiceContext(list.movingFile),
      latestTransition: await serializeTransition(list.progressTransitions.at(-1)),
      progressTransitions: await Promise.all(list.progressTransitions.map(serializeTransition)),
      signatureUrl: signatureDownloadUrl,
      packages: packagesWithPhotoUrls,
      status: normalizeStatus(list.status),
      syncVisibilityState: getSyncVisibilityState(list),
    })
  } catch (err) { next(err) }
})

// ── POST /api/packing-lists/:id/progress-transitions ─────────────────────────
router.post('/:id/workday-events', async (req, res, next) => {
  try {
    const {
      idempotencyKey,
      deviceId,
      eventType,
      occurredAt,
      observations,
      signatures,
      location,
    } = req.body
    if (!uuidValidate(idempotencyKey || '')) return res.status(400).json({ error: 'idempotencyKey must be a UUID' })
    if (!deviceId) return res.status(400).json({ error: 'deviceId is required' })
    if (!['DAY_START', 'DAY_CLOSE'].includes(eventType)) return res.status(400).json({ error: 'eventType must be DAY_START or DAY_CLOSE' })
    const occurred = new Date(occurredAt)
    if (!occurredAt || Number.isNaN(occurred.getTime())) return res.status(400).json({ error: 'occurredAt must be a valid date-time' })
    if ((observations || '').length > 4000) return res.status(400).json({ error: 'observations must not exceed 4000 characters' })
    if (!signatures?.clientSignatureUrl || !signatures?.crewLeaderSignatureUrl) {
      return res.status(400).json({ error: 'Both clientSignatureUrl and crewLeaderSignatureUrl are required' })
    }
    if (!['ES', 'EN'].includes(signatures?.language || 'ES')) {
      return res.status(400).json({ error: 'signatures.language must be ES or EN' })
    }

    const existing = await getPrisma().packingWorkdayEvent.findUnique({
      where: { idempotencyKey },
      include: { signaturePair: true },
    })
    if (existing) {
      if (existing.packingListId !== req.params.id) return res.status(409).json({ error: 'idempotencyKey belongs to another packing list' })
      return res.json({
        packingListId: existing.packingListId,
        workdayIndex: existing.workdayIndex,
        event: await serializeWorkdayEvent(existing),
      })
    }

    const created = await getPrisma().$transaction(async (tx) => {
      const list = await tx.packingList.findUnique({ where: { id: req.params.id } })
      if (!list || list.deletedAt) throw Object.assign(new Error('Packing list not found'), { status: 404 })
      if (normalizeStatus(list.status) === 'CLOSED') {
        throw Object.assign(new Error('Packing list is completed'), { status: 409 })
      }
      if (list.lockedByDeviceId && list.lockedByDeviceId !== deviceId && list.lockExpiresAt > new Date()) {
        throw Object.assign(new Error('Locked by another device'), { status: 409 })
      }

      const latest = await tx.packingWorkdayEvent.findFirst({
        where: { packingListId: list.id },
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      })

      let workdayIndex = latest?.workdayIndex || 1
      let toProgressStatus = normalizeProgressStatus(list)
      if (eventType === 'DAY_START') {
        if (latest?.eventType === 'DAY_START') {
          throw Object.assign(new Error('A workday is already open; close it before starting a new day'), { status: 409 })
        }
        if (latest?.eventType === 'DAY_CLOSE') {
          workdayIndex = latest.workdayIndex + 1
        }
        if (latest?.eventType === 'FINAL_COMPLETE') {
          throw Object.assign(new Error('Packing list is already completed'), { status: 409 })
        }
        toProgressStatus = 'WORKING'
      }

      if (eventType === 'DAY_CLOSE') {
        if (!latest || latest.eventType !== 'DAY_START') {
          throw Object.assign(new Error('DAY_CLOSE requires an open workday started with DAY_START'), { status: 409 })
        }
        workdayIndex = latest.workdayIndex
        toProgressStatus = 'TRAVELING'
      }

      const confirmedAt = new Date()
      await tx.packingList.update({
        where: { id: list.id },
        data: {
          progressStatus: toProgressStatus,
          lockedByDeviceId: deviceId,
          lockedAt: confirmedAt,
          lockExpiresAt: lockExpiry(),
        },
      })

      const event = await tx.packingWorkdayEvent.create({
        data: {
          packingListId: list.id,
          workdayIndex,
          eventType,
          fromProgressStatus: normalizeProgressStatus(list),
          toProgressStatus,
          occurredAt: occurred,
          confirmedAt,
          actorOid: req.user?.oid || 'unknown',
          actorName: req.user?.name || list.operatorName,
          observations: observations?.trim() || null,
          idempotencyKey,
          syncState: 'CONFIRMED',
          ...(parseStageLocation(location) || {}),
          signaturePair: {
            create: {
              clientSignatureBlobPath: signatures.clientSignatureUrl,
              crewLeaderSignatureBlobPath: signatures.crewLeaderSignatureUrl,
              clientSignerName: signatures.clientSignerName?.trim() || null,
              crewLeaderName: signatures.crewLeaderName?.trim() || null,
              signatureLanguage: signatures.language || 'ES',
              signedAt: confirmedAt,
            },
          },
        },
        include: { signaturePair: true },
      })
      return event
    })

    res.status(201).json({
      packingListId: req.params.id,
      workdayIndex: created.workdayIndex,
      event: await serializeWorkdayEvent(created),
    })
  } catch (err) {
    if (err.code === 'P2002') {
      const existing = await getPrisma().packingWorkdayEvent.findUnique({
        where: { idempotencyKey: req.body.idempotencyKey },
        include: { signaturePair: true },
      })
      if (existing?.packingListId === req.params.id) {
        return res.json({
          packingListId: existing.packingListId,
          workdayIndex: existing.workdayIndex,
          event: await serializeWorkdayEvent(existing),
        })
      }
    }
    if ([404, 409].includes(err.status)) {
      return res.status(err.status).json({ error: err.message })
    }
    next(err)
  }
})

router.post('/:id/progress-transitions', async (req, res, next) => {
  try {
    const { idempotencyKey, deviceId, toStatus, occurredAt, observations, signatureUrl, location } = req.body
    if (!uuidValidate(idempotencyKey || '')) return res.status(400).json({ error: 'idempotencyKey must be a UUID' })
    if (!deviceId) return res.status(400).json({ error: 'deviceId is required' })
    if (!['TRAVELING', 'WORKING'].includes(toStatus)) return res.status(400).json({ error: 'toStatus must be TRAVELING or WORKING' })
    const occurred = new Date(occurredAt)
    if (!occurredAt || Number.isNaN(occurred.getTime())) return res.status(400).json({ error: 'occurredAt must be a valid date-time' })
    if (observations && observations.length > 4000) return res.status(400).json({ error: 'observations must not exceed 4000 characters' })
    if (toStatus === 'WORKING' && !signatureUrl) return res.status(400).json({ error: 'signatureUrl is required for arrival acknowledgement' })

    const existing = await getPrisma().packingProgressTransition.findUnique({ where: { idempotencyKey } })
    if (existing) {
      if (existing.packingListId !== req.params.id) return res.status(409).json({ error: 'idempotencyKey belongs to another packing list' })
      return res.json({
        packingListId: existing.packingListId,
        progressStatus: existing.toStatus,
        transition: await serializeTransition(existing),
      })
    }

    const result = await getPrisma().$transaction(async (tx) => {
      const list = await tx.packingList.findUnique({ where: { id: req.params.id } })
      if (!list || list.deletedAt) throw Object.assign(new Error('Packing list not found'), { status: 404 })
      const currentProgressStatus = normalizeProgressStatus(list)
      if (normalizeStatus(list.status) === 'CLOSED') {
        throw Object.assign(new Error('Packing list is completed'), { status: 409, currentProgressStatus })
      }
      if (list.lockedByDeviceId && list.lockedByDeviceId !== deviceId && list.lockExpiresAt > new Date()) {
        throw Object.assign(new Error('Locked by another device'), {
          status: 409,
          currentProgressStatus,
          lockedByDeviceId: list.lockedByDeviceId,
        })
      }
      const expected = { NOT_STARTED: 'TRAVELING', TRAVELING: 'WORKING' }[currentProgressStatus]
      if (toStatus !== expected) {
        throw Object.assign(new Error('Invalid progress transition'), { status: 409, currentProgressStatus })
      }

      const confirmedAt = new Date()
      const claimed = await tx.packingList.updateMany({
        where: { id: list.id, progressStatus: currentProgressStatus, status: { notIn: ['CLOSED', 'COMPLETE'] } },
        data: {
          progressStatus: toStatus,
          lockedByDeviceId: deviceId,
          lockedAt: confirmedAt,
          lockExpiresAt: lockExpiry(),
        },
      })
      if (claimed.count !== 1) {
        throw Object.assign(new Error('Progress changed on another device'), { status: 409, currentProgressStatus })
      }
      const transition = await tx.packingProgressTransition.create({
        data: {
          packingListId: list.id,
          idempotencyKey,
          fromStatus: currentProgressStatus,
          toStatus,
          deviceId,
          actorOid: req.user?.oid || 'unknown',
          actorName: req.user?.name || list.operatorName,
          observations: observations?.trim() || null,
          signatureUrl: signatureUrl || null,
          occurredAt: occurred,
          confirmedAt,
          ...(parseStageLocation(location) || {}),
        },
      })
      return transition
    })

    res.status(201).json({
      packingListId: req.params.id,
      progressStatus: result.toStatus,
      transition: await serializeTransition(result),
    })
  } catch (err) {
    if (err.code === 'P2002') {
      const existing = await getPrisma().packingProgressTransition.findUnique({ where: { idempotencyKey: req.body.idempotencyKey } })
      if (existing?.packingListId === req.params.id) {
        return res.json({ packingListId: existing.packingListId, progressStatus: existing.toStatus, transition: await serializeTransition(existing) })
      }
    }
    if ([404, 409].includes(err.status)) {
      return res.status(err.status).json({
        error: err.message,
        currentProgressStatus: err.currentProgressStatus || null,
        lockedByDeviceId: err.lockedByDeviceId || null,
      })
    }
    next(err)
  }
})

// ── PUT /api/packing-lists/:id ────────────────────────────────────────────────
router.post('/:id/packages', async (req, res, next) => {
  try {
    const { id, barcode } = req.body
    if (!id) return res.status(400).json({ error: 'id is required' })

    const list = await getPrisma().packingList.findUnique({ where: { id: req.params.id } })
    if (!list || list.deletedAt) return res.status(404).json({ error: 'Packing list not found' })
    if (normalizeStatus(list.status) === 'CLOSED' || list.status === 'COMPLETE_PENDING_SYNC') {
      return res.status(409).json({ error: 'Packing list is not editable in current state' })
    }

    const normalizedBarcode = typeof barcode === 'string' && barcode.trim() ? barcode.trim() : null
    if (normalizedBarcode) {
      const duplicate = await getPrisma().package.findFirst({
        where: { packingListId: req.params.id, barcode: normalizedBarcode },
      })
      if (duplicate) return res.status(409).json({ error: 'Barcode already exists in this packing list' })
    }

    const created = await getPrisma().package.create({
      data: {
        id,
        packingListId: req.params.id,
        barcode: normalizedBarcode,
        barcodeState: normalizedBarcode ? 'ASSIGNED' : 'MISSING',
        barcodeAssignedAt: normalizedBarcode ? new Date() : null,
      },
    })
    res.status(201).json(created)
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Duplicate package id or barcode in list' })
    next(err)
  }
})

router.patch('/:id/packages/:packageId/barcode', async (req, res, next) => {
  try {
    const barcode = String(req.body?.barcode || '').trim()
    if (!barcode) return res.status(400).json({ error: 'barcode is required' })

    const list = await getPrisma().packingList.findUnique({ where: { id: req.params.id } })
    if (!list || list.deletedAt) return res.status(404).json({ error: 'Packing list not found' })
    if (normalizeStatus(list.status) === 'CLOSED' || list.status === 'COMPLETE_PENDING_SYNC') {
      return res.status(409).json({ error: 'Packing list is not editable in current state' })
    }

    const duplicate = await getPrisma().package.findFirst({
      where: {
        packingListId: req.params.id,
        barcode,
        id: { not: req.params.packageId },
      },
      select: { id: true },
    })
    if (duplicate) return res.status(409).json({ error: 'Barcode already exists in this packing list' })

    const updatedCount = await getPrisma().package.updateMany({
      where: { id: req.params.packageId, packingListId: req.params.id },
      data: {
        barcode,
        barcodeState: 'ASSIGNED',
        barcodeAssignedAt: new Date(),
      },
    })
    if (updatedCount.count !== 1) return res.status(404).json({ error: 'Package not found' })
    const updated = await getPrisma().package.findUnique({ where: { id: req.params.packageId } })
    res.json(updated)
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Barcode already exists in this packing list' })
    next(err)
  }
})

router.put('/:id/packages/:packageId/items/:itemId', async (req, res, next) => {
  try {
    const { packingItemTypeId, customName, quantity, note } = req.body
    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ error: 'quantity must be an integer greater than or equal to 1' })
    }
    if (!packingItemTypeId && !String(customName || '').trim()) {
      return res.status(400).json({ error: 'packingItemTypeId or customName is required' })
    }

    const list = await getPrisma().packingList.findUnique({ where: { id: req.params.id } })
    if (!list || list.deletedAt) return res.status(404).json({ error: 'Packing list not found' })
    if (normalizeStatus(list.status) === 'CLOSED' || list.status === 'COMPLETE_PENDING_SYNC') {
      return res.status(409).json({ error: 'Packing list is not editable in current state' })
    }

    const pkg = await getPrisma().package.findFirst({
      where: { id: req.params.packageId, packingListId: req.params.id },
      select: { id: true },
    })
    if (!pkg) return res.status(404).json({ error: 'Package not found' })

    const updatedCount = await getPrisma().packageItem.updateMany({
      where: { id: req.params.itemId, packageId: req.params.packageId },
      data: {
        packingItemTypeId: packingItemTypeId || null,
        customName: packingItemTypeId ? null : (customName?.trim() || null),
        quantity,
        note: note?.trim() || null,
      },
    })
    if (updatedCount.count !== 1) return res.status(404).json({ error: 'Package item not found' })
    const updated = await getPrisma().packageItem.findUnique({ where: { id: req.params.itemId } })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

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

    const payloadPhotoIds = (pkgsPayload || []).flatMap(pkg =>
      (pkg.photos || []).map(photo => photo.id).filter(Boolean)
    )
    const removedPhotos = await getPrisma().packagePhoto.findMany({
      where: {
        package: { packingListId: req.params.id },
        id: { notIn: payloadPhotoIds },
      },
      select: { blobPath: true },
    })

    // Full-replace packages / items / photos in a transaction
    const updated = await getPrisma().$transaction(async (tx) => {
      // Delete packages not in payload
      const payloadPkgIds = (pkgsPayload || []).map(p => p.id).filter(Boolean)
      await tx.package.deleteMany({
        where: { packingListId: req.params.id, id: { notIn: payloadPkgIds } },
      })

      // Upsert packages
      for (const pkg of pkgsPayload || []) {
        const barcode = typeof pkg.barcode === 'string' && pkg.barcode.trim() ? pkg.barcode.trim() : null
        await tx.package.upsert({
          where: { id: pkg.id },
          create: {
            id: pkg.id,
            packingListId: req.params.id,
            barcode,
            barcodeState: barcode ? 'ASSIGNED' : 'MISSING',
            barcodeAssignedAt: barcode ? new Date() : null,
          },
          update: {
            barcode,
            barcodeState: barcode ? 'ASSIGNED' : 'MISSING',
            barcodeAssignedAt: barcode ? new Date() : null,
          },
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

    await Promise.allSettled(removedPhotos.map(photo => deleteFile(photo.blobPath)))

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
    const {
      idempotencyKey, deviceId, occurredAt, signatureUrl, signatureDeclined,
      signatureDeclineNote, reviewLanguage, completionObservations, satisfaction,
      crewLeaderSignatureUrl, crewLeaderName, clientSignerName, location,
    } = req.body
    if (!uuidValidate(idempotencyKey || '')) return res.status(400).json({ error: 'idempotencyKey must be a UUID' })
    if (!deviceId) return res.status(400).json({ error: 'deviceId is required' })
    const occurred = new Date(occurredAt)
    if (!occurredAt || Number.isNaN(occurred.getTime())) return res.status(400).json({ error: 'occurredAt must be a valid date-time' })
    if (!reviewLanguage || !['ES', 'EN'].includes(reviewLanguage)) {
      return res.status(400).json({ error: 'reviewLanguage must be ES or EN' })
    }
    if ((completionObservations || '').length > 4000) return res.status(400).json({ error: 'completionObservations must not exceed 4000 characters' })
    const rating = satisfaction?.answers?.overallRating
    if (satisfaction?.surveyVersion !== 1 || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Version 1 satisfaction requires an integer overallRating from 1 to 5' })
    }
    const submittedAt = new Date(satisfaction.submittedAt)
    if (Number.isNaN(submittedAt.getTime())) return res.status(400).json({ error: 'satisfaction.submittedAt must be a valid date-time' })

    const existingTransition = await getPrisma().packingProgressTransition.findUnique({
      where: { idempotencyKey },
      include: { packingList: { include: { satisfactionResponse: true } } },
    })
    if (existingTransition) {
      if (existingTransition.packingListId !== req.params.id || existingTransition.toStatus !== 'COMPLETED') {
        return res.status(409).json({ error: 'idempotencyKey belongs to another operation' })
      }
      return res.json({
        id: existingTransition.packingList.id,
        status: 'CLOSED',
        progressStatus: 'COMPLETED',
        listNumber: existingTransition.packingList.listNumber,
        transition: await serializeTransition(existingTransition),
        satisfactionResponse: existingTransition.packingList.satisfactionResponse,
      })
    }

    const list = await getPrisma().packingList.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { packages: true } }, movingFile: { include: { client: true, corporateClient: true } } },
    })
    if (!list || list.deletedAt) return res.status(404).json({ error: 'Packing list not found' })
    if (normalizeStatus(list.status) === 'CLOSED') {
      return res.status(409).json({ error: 'Packing list is already completed', currentProgressStatus: 'COMPLETED' })
    }
    if (list.lockedByDeviceId && list.lockedByDeviceId !== deviceId && list.lockExpiresAt > new Date()) {
      return res.status(409).json({ error: 'Locked by another device' })
    }
    if (list._count.packages === 0) {
      return res.status(400).json({ error: 'Cannot complete a packing list with no packages' })
    }
    const missingBarcodeCount = await getMissingBarcodeCountForList(list.id)
    if (missingBarcodeCount > 0) {
      return res.status(409).json({
        error: 'Cannot complete while boxes are missing barcodes',
        completionBlockedReason: 'MISSING_BOX_BARCODES',
        missingBarcodeCount,
      })
    }
    if (normalizeProgressStatus(list) !== 'WORKING') {
      return res.status(409).json({ error: 'Packing list must be WORKING before completion', currentProgressStatus: normalizeProgressStatus(list) })
    }
    if (!signatureDeclined && !signatureUrl) {
      return res.status(400).json({ error: 'signatureUrl is required unless the client declines to sign' })
    }
    if (signatureDeclined && !signatureDeclineNote?.trim()) {
      return res.status(400).json({ error: 'signatureDeclineNote is required when signature is declined' })
    }
    if (!crewLeaderSignatureUrl) {
      return res.status(400).json({ error: 'crewLeaderSignatureUrl is required to complete the packing list' })
    }

    const before = { ...list }
    const completed = await getPrisma().$transaction(async tx => {
      const confirmedAt = new Date()
      const claimed = await tx.packingList.updateMany({
        where: { id: list.id, progressStatus: 'WORKING', status: { notIn: ['CLOSED', 'COMPLETE'] } },
        data: {
          status: 'CLOSED',
          progressStatus: 'COMPLETED',
          reviewLanguage,
          completionRequestedAt: list.completionRequestedAt || occurred,
          completionConfirmedAt: confirmedAt,
          completionLastError: null,
          signatureUrl: signatureUrl || null,
          signatureDeclined: !!signatureDeclined,
          signatureDeclineNote: signatureDeclineNote || null,
          lockedByDeviceId: null,
          lockedAt: null,
          lockExpiresAt: null,
        },
      })
      if (claimed.count !== 1) {
        throw Object.assign(new Error('Progress changed on another device'), { status: 409, currentProgressStatus: 'COMPLETED' })
      }
      const transition = await tx.packingProgressTransition.create({
        data: {
          packingListId: list.id,
          idempotencyKey,
          fromStatus: 'WORKING',
          toStatus: 'COMPLETED',
          deviceId,
          actorOid: req.user?.oid || 'unknown',
          actorName: req.user?.name || list.operatorName,
          observations: completionObservations?.trim() || null,
          signatureUrl: signatureUrl || null,
          occurredAt: occurred,
          confirmedAt,
        },
      })
      const satisfactionResponse = await tx.packingSatisfactionResponse.create({
        data: {
          packingListId: list.id,
          surveyVersion: 1,
          answers: satisfaction.answers,
          capturedByOid: req.user?.oid || 'unknown',
          capturedByName: req.user?.name || list.operatorName,
          submittedAt,
        },
      })
      await tx.packingWorkdayEvent.create({
        data: {
          packingListId: list.id,
          workdayIndex: (await tx.packingWorkdayEvent.findFirst({
            where: { packingListId: list.id },
            orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
            select: { workdayIndex: true },
          }))?.workdayIndex || 1,
          eventType: 'FINAL_COMPLETE',
          fromProgressStatus: 'WORKING',
          toProgressStatus: 'COMPLETED',
          occurredAt: occurred,
          confirmedAt,
          actorOid: req.user?.oid || 'unknown',
          actorName: req.user?.name || list.operatorName,
          observations: completionObservations?.trim() || null,
          idempotencyKey,
          syncState: 'CONFIRMED',
          ...(parseStageLocation(location) || {}),
          signaturePair: {
            create: {
              clientSignatureBlobPath: signatureUrl || null,
              crewLeaderSignatureBlobPath: crewLeaderSignatureUrl,
              clientSignerName: clientSignerName?.trim() || null,
              crewLeaderName: crewLeaderName?.trim() || null,
              signatureLanguage: reviewLanguage,
              signedAt: confirmedAt,
            },
          },
        },
      })
      const updated = await tx.packingList.findUnique({ where: { id: req.params.id } })
      return { updated, transition, satisfactionResponse }
    })
    logAudit(req, 'PackingList', req.params.id, 'UPDATE', before, completed.updated)

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

    res.json({
      id: completed.updated.id,
      status: completed.updated.status,
      progressStatus: completed.updated.progressStatus,
      listNumber: completed.updated.listNumber,
      transition: await serializeTransition(completed.transition),
      satisfactionResponse: completed.satisfactionResponse,
    })
  } catch (err) {
    if (err.code === 'P2002') {
      const existing = await getPrisma().packingProgressTransition.findUnique({
        where: { idempotencyKey: req.body.idempotencyKey },
        include: { packingList: { include: { satisfactionResponse: true } } },
      })
      if (existing?.packingListId === req.params.id && existing.toStatus === 'COMPLETED') {
        return res.json({
          id: existing.packingList.id,
          status: 'CLOSED',
          progressStatus: 'COMPLETED',
          listNumber: existing.packingList.listNumber,
          transition: await serializeTransition(existing),
          satisfactionResponse: existing.packingList.satisfactionResponse,
        })
      }
    }
    if (err.status === 409) {
      return res.status(409).json({ error: err.message, currentProgressStatus: err.currentProgressStatus || null })
    }
    next(err)
  }
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

// ── Packing List Ingress / Egress (box scanning) ─────────────────────────────

const INGRESS_EGRESS_TYPES = ['INGRESS_TRUCK', 'INGRESS_WAREHOUSE', 'EGRESS_WAREHOUSE']
const WAREHOUSE_OPERATION_TYPES = ['INGRESS_WAREHOUSE', 'EGRESS_WAREHOUSE']

async function getOrderedPackagesForList(packingListId) {
  return getPrisma().package.findMany({ where: { packingListId }, orderBy: { createdAt: 'asc' } })
}

async function serializeIngressEgressOperation(operation, orderedPackages) {
  if (!operation) return null
  const packages = orderedPackages || await getOrderedPackagesForList(operation.packingListId)
  const scanByPackageId = new Map((operation.boxScans || []).map(scan => [scan.packageId, scan]))
  const boxes = packages.map((pkg, idx) => {
    const scan = scanByPackageId.get(pkg.id)
    return {
      packageId: pkg.id,
      boxNumber: idx + 1,
      checked: !!scan,
      scanMethod: scan?.scanMethod || null,
      scannedAt: scan?.scannedAt || null,
    }
  })
  let crewLeaderSignatureUrl = null
  let warehouseManagerSignatureUrl = null
  if (operation.crewLeaderSignatureBlobPath) {
    try { crewLeaderSignatureUrl = await getDownloadUrl(operation.crewLeaderSignatureBlobPath) } catch { crewLeaderSignatureUrl = null }
  }
  if (operation.warehouseManagerSignatureBlobPath) {
    try { warehouseManagerSignatureUrl = await getDownloadUrl(operation.warehouseManagerSignatureBlobPath) } catch { warehouseManagerSignatureUrl = null }
  }
  return {
    id: operation.id,
    packingListId: operation.packingListId,
    type: operation.type,
    status: operation.status,
    warehouseLocation: operation.warehouseLocation,
    observations: operation.observations,
    boxes,
    missingBoxNumbers: boxes.filter(b => !b.checked).map(b => b.boxNumber),
    signatures: {
      crewLeader: operation.crewLeaderSignatureBlobPath ? {
        name: operation.crewLeaderName,
        signatureUrl: crewLeaderSignatureUrl,
        signedAt: operation.crewLeaderSignedAt,
      } : null,
      warehouseManager: operation.warehouseManagerSignatureBlobPath ? {
        name: operation.warehouseManagerName,
        signatureUrl: warehouseManagerSignatureUrl,
        signedAt: operation.warehouseManagerSignedAt,
      } : null,
    },
    location: serializeStageLocation(operation),
    completedAt: operation.completedAt,
    createdAt: operation.createdAt,
    updatedAt: operation.updatedAt,
  }
}

// A box code is either found in this list, found in a different list, or not found anywhere.
async function resolvePackageByCode(packingListId, code) {
  const trimmed = String(code || '').trim()
  if (!trimmed) return { error: 'NOT_FOUND' }
  const match = await getPrisma().package.findFirst({ where: { packingListId, barcode: trimmed } })
  if (match) return { package: match }
  const elsewhere = await getPrisma().package.findFirst({ where: { barcode: trimmed, packingListId: { not: packingListId } } })
  if (elsewhere) return { error: 'DIFFERENT_LIST' }
  return { error: 'NOT_FOUND' }
}

// ── POST /api/packing-lists/:id/ingress-egress ───────────────────────────────
// Starts a new operation, or resumes the existing non-complete operation of the same type.
router.post('/:id/ingress-egress', async (req, res, next) => {
  try {
    const { type, deviceId, idempotencyKey, occurredAt } = req.body
    if (!INGRESS_EGRESS_TYPES.includes(type)) return res.status(400).json({ error: `type must be one of ${INGRESS_EGRESS_TYPES.join(', ')}` })
    if (!deviceId) return res.status(400).json({ error: 'deviceId is required' })
    if (!uuidValidate(idempotencyKey || '')) return res.status(400).json({ error: 'idempotencyKey must be a UUID' })
    const occurred = occurredAt ? new Date(occurredAt) : new Date()
    if (Number.isNaN(occurred.getTime())) return res.status(400).json({ error: 'occurredAt must be a valid date-time' })

    const list = await getPrisma().packingList.findUnique({ where: { id: req.params.id } })
    if (!list || list.deletedAt) return res.status(404).json({ error: 'Packing list not found' })
    if (normalizeStatus(list.status) !== 'CLOSED') {
      return res.status(403).json({ error: 'Packing list must be completed before ingress/egress operations are available' })
    }

    const existingOpen = await getPrisma().packingIngressEgressOperation.findFirst({
      where: { packingListId: list.id, type, status: { not: 'COMPLETE' } },
      include: { boxScans: true },
    })
    if (existingOpen) {
      return res.json({ operation: await serializeIngressEgressOperation(existingOpen) })
    }

    // Egress carries over the storage location recorded when the boxes were ingressed into the warehouse.
    let warehouseLocation = null
    if (type === 'EGRESS_WAREHOUSE') {
      const lastIngress = await getPrisma().packingIngressEgressOperation.findFirst({
        where: { packingListId: list.id, type: 'INGRESS_WAREHOUSE', status: 'COMPLETE' },
        orderBy: { completedAt: 'desc' },
      })
      warehouseLocation = lastIngress?.warehouseLocation || null
    }

    const created = await getPrisma().packingIngressEgressOperation.create({
      data: { packingListId: list.id, type, deviceId, idempotencyKey, warehouseLocation },
      include: { boxScans: true },
    })
    res.status(201).json({ operation: await serializeIngressEgressOperation(created) })
  } catch (err) {
    if (err.code === 'P2002') {
      const existing = await getPrisma().packingIngressEgressOperation.findUnique({
        where: { idempotencyKey: req.body.idempotencyKey },
        include: { boxScans: true },
      })
      if (existing?.packingListId === req.params.id) {
        return res.json({ operation: await serializeIngressEgressOperation(existing) })
      }
    }
    next(err)
  }
})

// ── GET /api/packing-lists/:id/ingress-egress ────────────────────────────────
router.get('/:id/ingress-egress', async (req, res, next) => {
  try {
    const list = await getPrisma().packingList.findUnique({ where: { id: req.params.id } })
    if (!list || list.deletedAt) return res.status(404).json({ error: 'Packing list not found' })
    const [operations, orderedPackages] = await Promise.all([
      getPrisma().packingIngressEgressOperation.findMany({
        where: { packingListId: req.params.id },
        include: { boxScans: true },
        orderBy: { createdAt: 'asc' },
      }),
      getOrderedPackagesForList(req.params.id),
    ])
    res.json({ operations: await Promise.all(operations.map(op => serializeIngressEgressOperation(op, orderedPackages))) })
  } catch (err) { next(err) }
})

// ── PATCH /api/packing-lists/:id/ingress-egress/:operationId/details ────────
// Lets the operator record/update the warehouse location and observations while the operation is in progress.
router.patch('/:id/ingress-egress/:operationId/details', async (req, res, next) => {
  try {
    const { warehouseLocation, observations } = req.body
    const operation = await getPrisma().packingIngressEgressOperation.findUnique({ where: { id: req.params.operationId } })
    if (!operation || operation.packingListId !== req.params.id) return res.status(404).json({ error: 'Operation not found' })
    if (operation.status === 'COMPLETE') return res.status(409).json({ error: 'ALREADY_COMPLETE' })
    const isWarehouseType = WAREHOUSE_OPERATION_TYPES.includes(operation.type)
    if (!isWarehouseType && typeof warehouseLocation === 'string' && warehouseLocation.trim()) {
      return res.status(400).json({ error: 'warehouseLocation is not applicable to INGRESS_TRUCK operations' })
    }
    if (operation.type === 'EGRESS_WAREHOUSE' && typeof warehouseLocation === 'string' && warehouseLocation.trim() !== (operation.warehouseLocation || '')) {
      return res.status(400).json({ error: 'warehouseLocation is read-only for egress operations; it is carried over from the warehouse ingress' })
    }
    if ((observations || '').length > 4000) return res.status(400).json({ error: 'observations must not exceed 4000 characters' })

    const data = {}
    if (typeof observations === 'string') data.observations = observations.trim() || null
    if (operation.type === 'INGRESS_WAREHOUSE' && typeof warehouseLocation === 'string') data.warehouseLocation = warehouseLocation.trim() || null

    const updated = await getPrisma().packingIngressEgressOperation.update({
      where: { id: operation.id },
      data,
      include: { boxScans: true },
    })
    res.json({ operation: await serializeIngressEgressOperation(updated) })
  } catch (err) { next(err) }
})

// ── POST /api/packing-lists/:id/ingress-egress/:operationId/scans ───────────
router.post('/:id/ingress-egress/:operationId/scans', async (req, res, next) => {
  try {
    const { code, scanMethod, scannedAt, idempotencyKey } = req.body
    if (!['CAMERA', 'MANUAL'].includes(scanMethod)) return res.status(400).json({ error: 'scanMethod must be CAMERA or MANUAL' })
    if (!uuidValidate(idempotencyKey || '')) return res.status(400).json({ error: 'idempotencyKey must be a UUID' })
    const scanned = scannedAt ? new Date(scannedAt) : new Date()
    if (Number.isNaN(scanned.getTime())) return res.status(400).json({ error: 'scannedAt must be a valid date-time' })

    const existingByKey = await getPrisma().packingIngressEgressBoxScan.findUnique({ where: { idempotencyKey } })
    if (existingByKey) {
      if (existingByKey.operationId !== req.params.operationId) return res.status(409).json({ error: 'idempotencyKey belongs to another operation' })
      return res.json({ box: { packageId: existingByKey.packageId, scanMethod: existingByKey.scanMethod, scannedAt: existingByKey.scannedAt }, alreadyChecked: true })
    }

    const operation = await getPrisma().packingIngressEgressOperation.findUnique({ where: { id: req.params.operationId } })
    if (!operation || operation.packingListId !== req.params.id) return res.status(404).json({ error: 'Operation not found' })
    if (operation.status === 'COMPLETE') return res.status(409).json({ error: 'OPERATION_COMPLETE' })

    const resolved = await resolvePackageByCode(req.params.id, code)
    if (resolved.error === 'NOT_FOUND') return res.status(404).json({ error: 'NOT_FOUND' })
    if (resolved.error === 'DIFFERENT_LIST') return res.status(409).json({ error: 'DIFFERENT_LIST' })

    const existingScan = await getPrisma().packingIngressEgressBoxScan.findUnique({
      where: { operationId_packageId: { operationId: operation.id, packageId: resolved.package.id } },
    })
    if (existingScan) {
      return res.json({ box: { packageId: existingScan.packageId, scanMethod: existingScan.scanMethod, scannedAt: existingScan.scannedAt }, alreadyChecked: true })
    }

    const created = await getPrisma().packingIngressEgressBoxScan.create({
      data: { operationId: operation.id, packageId: resolved.package.id, scanMethod, scannedAt: scanned, idempotencyKey },
    })
    res.status(201).json({ box: { packageId: created.packageId, scanMethod: created.scanMethod, scannedAt: created.scannedAt }, alreadyChecked: false })
  } catch (err) {
    if (err.code === 'P2002') {
      const existing = await getPrisma().packingIngressEgressBoxScan.findUnique({ where: { idempotencyKey: req.body.idempotencyKey } })
      if (existing) return res.json({ box: { packageId: existing.packageId, scanMethod: existing.scanMethod, scannedAt: existing.scannedAt }, alreadyChecked: true })
    }
    next(err)
  }
})

// ── POST /api/packing-lists/:id/ingress-egress/:operationId/reset ───────────
router.post('/:id/ingress-egress/:operationId/reset', async (req, res, next) => {
  try {
    const operation = await getPrisma().packingIngressEgressOperation.findUnique({ where: { id: req.params.operationId } })
    if (!operation || operation.packingListId !== req.params.id) return res.status(404).json({ error: 'Operation not found' })
    if (operation.status === 'COMPLETE') return res.status(409).json({ error: 'OPERATION_COMPLETE' })

    // Egress keeps its read-only warehouse location (carried over from the warehouse ingress) across a reset.
    let warehouseLocation = null
    if (operation.type === 'EGRESS_WAREHOUSE') {
      const lastIngress = await getPrisma().packingIngressEgressOperation.findFirst({
        where: { packingListId: req.params.id, type: 'INGRESS_WAREHOUSE', status: 'COMPLETE' },
        orderBy: { completedAt: 'desc' },
      })
      warehouseLocation = lastIngress?.warehouseLocation || null
    }

    await getPrisma().$transaction(async (tx) => {
      await tx.packingIngressEgressBoxScan.deleteMany({ where: { operationId: operation.id } })
      await tx.packingIngressEgressOperation.update({
        where: { id: operation.id },
        data: {
          status: 'IN_PROGRESS',
          warehouseLocation,
          observations: null,
          crewLeaderName: null,
          crewLeaderSignatureBlobPath: null,
          crewLeaderSignedAt: null,
          warehouseManagerName: null,
          warehouseManagerSignatureBlobPath: null,
          warehouseManagerSignedAt: null,
          latitude: null,
          longitude: null,
          locationAccuracy: null,
          locationCapturedAt: null,
          locationUnavailableReason: null,
          completedAt: null,
        },
      })
    })
    const updated = await getPrisma().packingIngressEgressOperation.findUnique({ where: { id: operation.id }, include: { boxScans: true } })
    res.json({ operation: await serializeIngressEgressOperation(updated) })
  } catch (err) { next(err) }
})

// ── POST /api/packing-lists/:id/ingress-egress/:operationId/sign ────────────
// Captures the crew leader signature and (for warehouse operations) the warehouse manager
// signature together in one call — both are gathered on-screen like other dual-signature
// flows before submitting, rather than sequential server round-trips. The GPS location is
// captured once, at the moment the operation completes.
router.post('/:id/ingress-egress/:operationId/sign', async (req, res, next) => {
  try {
    const {
      crewLeaderSignatureBlobPath, crewLeaderName,
      warehouseManagerSignatureBlobPath, warehouseManagerName,
      warehouseLocation, observations, location,
    } = req.body
    if (!crewLeaderSignatureBlobPath) return res.status(400).json({ error: 'crewLeaderSignatureBlobPath is required' })
    if (!crewLeaderName?.trim()) return res.status(400).json({ error: 'crewLeaderName is required' })
    if ((observations || '').length > 4000) return res.status(400).json({ error: 'observations must not exceed 4000 characters' })

    const operation = await getPrisma().packingIngressEgressOperation.findUnique({
      where: { id: req.params.operationId },
      include: { boxScans: true },
    })
    if (!operation || operation.packingListId !== req.params.id) return res.status(404).json({ error: 'Operation not found' })
    if (operation.status === 'COMPLETE') {
      return res.json({ operation: await serializeIngressEgressOperation(operation) })
    }

    const isWarehouseType = WAREHOUSE_OPERATION_TYPES.includes(operation.type)
    if (!isWarehouseType && typeof warehouseLocation === 'string' && warehouseLocation.trim()) {
      return res.status(400).json({ error: 'warehouseLocation is not applicable to INGRESS_TRUCK operations' })
    }
    if (operation.type === 'EGRESS_WAREHOUSE' && typeof warehouseLocation === 'string' && warehouseLocation.trim() !== (operation.warehouseLocation || '')) {
      return res.status(400).json({ error: 'warehouseLocation is read-only for egress operations; it is carried over from the warehouse ingress' })
    }
    if (isWarehouseType) {
      if (!warehouseManagerSignatureBlobPath) return res.status(400).json({ error: 'warehouseManagerSignatureBlobPath is required for warehouse operations' })
      if (!warehouseManagerName?.trim()) return res.status(400).json({ error: 'warehouseManagerName is required for warehouse operations' })
    }

    const orderedPackages = await getOrderedPackagesForList(req.params.id)
    const missingBoxNumbers = orderedPackages
      .map((pkg, idx) => ({ pkg, boxNumber: idx + 1 }))
      .filter(({ pkg }) => !operation.boxScans.some(scan => scan.packageId === pkg.id))
      .map(({ boxNumber }) => boxNumber)
    if (missingBoxNumbers.length > 0) {
      return res.status(409).json({ error: 'BOXES_MISSING', missingBoxNumbers })
    }

    const data = {
      status: 'COMPLETE',
      completedAt: new Date(),
      crewLeaderName: crewLeaderName.trim(),
      crewLeaderSignatureBlobPath,
      crewLeaderSignedAt: new Date(),
    }
    if (typeof observations === 'string') data.observations = observations.trim() || null
    if (operation.type === 'INGRESS_WAREHOUSE' && typeof warehouseLocation === 'string') data.warehouseLocation = warehouseLocation.trim() || null
    if (isWarehouseType) {
      data.warehouseManagerName = warehouseManagerName.trim()
      data.warehouseManagerSignatureBlobPath = warehouseManagerSignatureBlobPath
      data.warehouseManagerSignedAt = new Date()
    }
    Object.assign(data, parseStageLocation(location) || {})

    const claimed = await getPrisma().packingIngressEgressOperation.updateMany({
      where: { id: operation.id, status: { not: 'COMPLETE' } },
      data,
    })
    const updated = await getPrisma().packingIngressEgressOperation.findUnique({ where: { id: operation.id }, include: { boxScans: true } })
    if (claimed.count !== 1) {
      // Already completed by a concurrent call; return current state instead of erroring.
      return res.json({ operation: await serializeIngressEgressOperation(updated) })
    }
    res.json({ operation: await serializeIngressEgressOperation(updated) })
  } catch (err) { next(err) }
})

module.exports = router
