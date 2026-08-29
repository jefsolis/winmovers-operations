const router = require("express").Router()
const { getPrisma } = require("../db")
const { logAudit } = require("../audit")
const { generateFileNumber } = require("./movingFiles")
const { notifyFileCoordinator } = require('../services/notifications')
const { syncJobScheduleEntries } = require('../services/scheduleSync')
const { requireScheduleManager } = require('../middleware/schedulePermissions')

async function forbidBodegaWrite(req, res, next) {
  try {
    const oid = req.user?.oid
    if (!oid) return next()
    const staff = await getPrisma().staffMember.findUnique({
      where: { azureOid: oid },
      select: { role: true },
    })
    if (staff?.role === 'BODEGA') {
      return res.status(403).json({ error: 'Bodega role has read-only access to Jobs.' })
    }
    next()
  } catch (err) { next(err) }
}

function toDate(val) {
  if (!val) return null
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

// Returns { latitude, longitude } or { error } — both values must be supplied together.
function resolveServiceCoordinates(rawLatitude, rawLongitude) {
  const hasLatitude = rawLatitude !== undefined && rawLatitude !== null && rawLatitude !== ''
  const hasLongitude = rawLongitude !== undefined && rawLongitude !== null && rawLongitude !== ''
  if (!hasLatitude && !hasLongitude) return { latitude: null, longitude: null }
  if (hasLatitude !== hasLongitude) {
    return { error: 'serviceLatitude and serviceLongitude must be provided together' }
  }

  const latitude = Number(rawLatitude)
  const longitude = Number(rawLongitude)
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { error: 'serviceLatitude must be a number between -90 and 90' }
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { error: 'serviceLongitude must be a number between -180 and 180' }
  }
  return { latitude, longitude }
}

async function generateImportJobNumber() {
  const year = new Date().getFullYear()
  const last = await getPrisma().job.findFirst({
    where: { jobNumber: { startsWith: 'D-' } },
    orderBy: { createdAt: 'desc' },
    select: { jobNumber: true },
  })
  let lastNum = 0
  if (last) {
    const parts = last.jobNumber.split('-')
    lastNum = parseInt(parts[1], 10) || 0
  }
  const seed = await getPrisma().systemSetting.findUnique({ where: { key: 'counter.IMPORT_JOB' } })
  const seedNum = seed ? parseInt(seed.value, 10) - 1 : 0
  const next = Math.max(lastNum, seedNum) + 1
  return 'D-' + String(next).padStart(4, '0') + '-' + year
}

// GET all
router.get("/", async (req, res, next) => {
  try {
    const { status, type, search } = req.query
    const where = {}
    if (status) where.status = status
    if (type)   where.type   = type
    if (search) where.OR = [
      { jobNumber:     { contains: search, mode: "insensitive" } },
      { originCity:    { contains: search, mode: "insensitive" } },
      { destCity:      { contains: search, mode: "insensitive" } },
      { originCountry: { contains: search, mode: "insensitive" } },
      { destCountry:   { contains: search, mode: "insensitive" } },
      { client:  { name:      { contains: search, mode: "insensitive" } } },
    ]
    const jobs = await getPrisma().job.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        client:      { select: { id: true, name: true } },
        originAgent: { select: { id: true, name: true } },
        destAgent:   { select: { id: true, name: true } },
        customsAgent:{ select: { id: true, name: true } },
        coordinator: { select: { id: true, name: true } },
        movingFile:  { select: { id: true, fileNumber: true, status: true, category: true } },
      },
    })
    res.json(jobs)
  } catch (err) { next(err) }
})

// GET one
router.get("/:id", async (req, res, next) => {
  try {
    const job = await getPrisma().job.findUnique({
      where: { id: req.params.id },
      include: {
        client: true,
        corporateClient: { select: { id: true, name: true, phone: true } },
        originAgent: true, destAgent: true, customsAgent: true,
        coordinator: { select: { id: true, name: true } },
        quote: { select: { id: true, quoteNumber: true, visit: { select: { id: true, visitNumber: true, serviceType: true, scheduledDate: true } } } },
        visit: { select: { id: true, visitNumber: true, serviceType: true, scheduledDate: true } },
        movingFile: {
          select: {
            id: true, fileNumber: true, status: true, category: true,
            damageReportData: true, evaluationData: true,
            originAgent: { select: { id: true, name: true } },
            destAgent:   { select: { id: true, name: true } },
          },
        },
      },
    })
    if (!job) return res.status(404).json({ error: "Not found" })
    res.json(job)
  } catch (err) { next(err) }
})

// POST create  auto-creates MovingFile for EXPORT jobs (detected via visit serviceType)
router.post("/", forbidBodegaWrite, async (req, res, next) => {
  try {
    const {
      type, status, clientId,
      originAgentId, destAgentId, customsAgentId,
      originAddress, originWarehouse, originCity, originCountry,
      destAddress, destCity, destCountry,
      serviceLatitude, serviceLongitude,
      callDate, surveyDate, packDate, moveDate, deliveryDate,
      volumeCbm, weightKg, shipmentMode, notes, quoteId,
      serviceDate, serviceTime, clientPhone, clientHomePhone,
      companyName, companyPhone, serviceDetails, materials, quoteTo, creatorName, language,
      contacto, bultos, personalCount, transbordo,
      daysToComplete,
      forceScheduleOverride, scheduleOverrideReason,
      movingFileId: manualMovingFileId,
      coordinatorId,
      visitId,
      corporateClientId,
    } = req.body

    // Detect Export: visit serviceType DOOR_TO_PORT or DOOR_TO_DOOR
    const EXPORT_SERVICE_TYPES = ["DOOR_TO_PORT", "DOOR_TO_DOOR"]
    const coordinates = resolveServiceCoordinates(serviceLatitude, serviceLongitude)
    if (coordinates.error) return res.status(400).json({ error: coordinates.error })
    let isExport = type === "EXPORT"
    let visitBookerRole = null

    // Resolve bookerRole from the linked visit (direct visitId or via quote→visit)
    if (visitId) {
      const v = await getPrisma().visit.findUnique({ where: { id: visitId }, select: { serviceType: true, bookerRole: true } })
      visitBookerRole = v?.bookerRole || null
      if (!isExport) isExport = EXPORT_SERVICE_TYPES.includes(v?.serviceType)
    } else if (quoteId) {
      const quote = await getPrisma().quote.findUnique({
        where: { id: quoteId },
        select: { visit: { select: { serviceType: true, bookerRole: true } } },
      })
      visitBookerRole = quote?.visit?.bookerRole || null
      if (!isExport) isExport = EXPORT_SERVICE_TYPES.includes(quote?.visit?.serviceType)
    }

    let jobNumber
    let movingFileId = null

    if (isExport) {
      // Export: Job number = File number (E-####-YYYY), file auto-created
      const fileNumber = await generateFileNumber("EXPORT")
      const mf = await getPrisma().movingFile.create({
        data: { fileNumber, category: "EXPORT", status: "OPEN", clientId: clientId || null,
                corporateClientId: corporateClientId || null,
                volumeCbm: volumeCbm ? parseFloat(volumeCbm) : null,
                weightKg:  weightKg  ? parseFloat(weightKg)  : null,
                weightUnit: weightKg ? 'LB' : null,
                bookerRole: visitBookerRole,
                coordinatorId: coordinatorId || null },
      })
      jobNumber    = fileNumber
      movingFileId = mf.id
    } else if (type === "DOMESTIC") {
      // Domestic/Local: Job number = File number (M-####-YYYY), LOCAL file auto-created
      const fileNumber = await generateFileNumber("LOCAL")
      const mf = await getPrisma().movingFile.create({
        data: { fileNumber, category: "LOCAL", status: "OPEN", clientId: clientId || null,
                corporateClientId: corporateClientId || null,
                volumeCbm: volumeCbm ? parseFloat(volumeCbm) : null,
                weightKg:  weightKg  ? parseFloat(weightKg)  : null,
                weightUnit: weightKg ? 'LB' : null,
                bookerRole: visitBookerRole,
                coordinatorId: coordinatorId || null },
      })
      jobNumber    = fileNumber
      movingFileId = mf.id
    } else if (type === "IMPORT" && manualMovingFileId) {
      // Import job linked to existing file: independent number (OT-YYYY-####)
      jobNumber    = await generateImportJobNumber()
      movingFileId = manualMovingFileId
    } else if (type === "IMPORT") {
      // Import standalone: own counter
      jobNumber    = await generateImportJobNumber()
      movingFileId = null
    } else {
      throw new Error(`Unsupported job type: ${type}`)
    }

    const data = {
      jobNumber, type,
      status:        status        || "SURVEY",
      clientId:      clientId      || null,
      originAgentId: originAgentId || null,
      destAgentId:   destAgentId   || null,
      customsAgentId:customsAgentId|| null,
      originAddress, originWarehouse, originCity, originCountry,
      destAddress,   destCity,   destCountry,
      serviceLatitude:  coordinates.latitude,
      serviceLongitude: coordinates.longitude,
      callDate:    toDate(callDate),
      surveyDate:  toDate(surveyDate),
      packDate:    toDate(packDate),
      moveDate:    toDate(moveDate),
      deliveryDate:toDate(deliveryDate),
      volumeCbm:   volumeCbm ? parseFloat(volumeCbm) : null,
      weightKg:    weightKg  ? parseFloat(weightKg)  : null,
      weightUnit:  weightKg  ? 'LB' : null,
      shipmentMode, notes,
      serviceDate:    serviceDate    ? new Date(serviceDate)   : null,
      serviceTime:    serviceTime    || null,
      clientPhone:    clientPhone    || null,
      clientHomePhone:clientHomePhone|| null,
      companyName:    companyName    || null,
      companyPhone:   companyPhone   || null,
      serviceDetails: serviceDetails || null,
      materials:      materials      || null,
      quoteTo:        quoteTo        || null,
      creatorName:    creatorName    || null,
      language:       language       || "EN",
      contacto:       contacto       || null,
      bultos:         bultos         != null ? parseInt(bultos)        : null,
      personalCount:  personalCount  != null ? parseInt(personalCount) : null,
      transbordo:     transbordo     !== undefined ? transbordo        : null,
      daysToComplete:  daysToComplete  != null && daysToComplete  !== '' ? parseInt(daysToComplete)  : null,
      quoteId:        quoteId        || null,
      movingFileId,
      visitId:        visitId        || null,
      coordinatorId:  coordinatorId   || null,
      corporateClientId: corporateClientId || null,    }

    const job = await getPrisma().job.create({ data })
    logAudit(req, 'Job', job.id, 'CREATE', null, job)

    // Sync schedule entries — awaited so scheduling problems can be surfaced to the caller
    const { warning: scheduleWarning } = await syncJobScheduleEntries(job, req, {
      forceOverride: Boolean(forceScheduleOverride),
      overrideReason: scheduleOverrideReason,
    }).catch(() => ({ warning: null }))

    // Notify coordinator on creation (fire-and-forget)
    if (movingFileId && coordinatorId) {
      try {
        const fileForNotification = await getPrisma().movingFile.findUnique({
          where: { id: movingFileId },
          include: {
            client: { select: { id: true, name: true, firstName: true, lastName: true, clientType: true } },
            corporateClient: { select: { id: true, name: true } },
            coordinator: { select: { id: true, name: true, email: true } },
          },
        })
        if (fileForNotification?.coordinator?.email) {
          notifyFileCoordinator(fileForNotification, 'assigned')
        }
      } catch (notifyErr) {
        console.error('[jobs] POST notify error:', notifyErr.message)
      }
    }

    res.status(201).json({ ...job, scheduleWarning: scheduleWarning || null })
  } catch (err) { next(err) }
})

// PUT update
router.put("/:id", forbidBodegaWrite, async (req, res, next) => {
  try {
    const {
      type, status, clientId,
      originAgentId, destAgentId, customsAgentId,
      originAddress, originWarehouse, originCity, originCountry,
      destAddress, destCity, destCountry,
      serviceLatitude, serviceLongitude,
      callDate, surveyDate, packDate, moveDate, deliveryDate,
      volumeCbm, weightKg, shipmentMode, notes, quoteId,
      serviceDate, serviceTime, clientPhone, clientHomePhone,
      companyName, companyPhone, serviceDetails, materials, quoteTo, creatorName, language,
      contacto, bultos, personalCount, transbordo,
      daysToComplete,
      forceScheduleOverride, scheduleOverrideReason,
      movingFileId,
      coordinatorId,
      visitId,
      corporateClientId,
    } = req.body

    const before = await getPrisma().job.findUnique({ where: { id: req.params.id } })

    const coordinates = resolveServiceCoordinates(serviceLatitude, serviceLongitude)
    if (coordinates.error) return res.status(400).json({ error: coordinates.error })

    const job = await getPrisma().job.update({
      where: { id: req.params.id },
      data: {
        type, status,
        clientId:      clientId      || null,
        originAgentId: originAgentId || null,
        destAgentId:   destAgentId   || null,
        customsAgentId:customsAgentId|| null,
        originAddress, originWarehouse, originCity, originCountry,
        destAddress,   destCity,   destCountry,
        serviceLatitude:  coordinates.latitude,
        serviceLongitude: coordinates.longitude,
        callDate:    toDate(callDate),
        surveyDate:  toDate(surveyDate),
        packDate:    toDate(packDate),
        moveDate:    toDate(moveDate),
        deliveryDate:toDate(deliveryDate),
        volumeCbm:   volumeCbm ? parseFloat(volumeCbm) : null,
        weightKg:    weightKg  ? parseFloat(weightKg)  : null,
        weightUnit:  weightKg  ? 'LB' : null,
        shipmentMode, notes,
        serviceDate:    serviceDate     !== undefined ? (serviceDate     ? new Date(serviceDate) : null) : undefined,
        serviceTime:    serviceTime     !== undefined ? (serviceTime     || null) : undefined,
        clientPhone:    clientPhone     !== undefined ? (clientPhone     || null) : undefined,
        clientHomePhone:clientHomePhone !== undefined ? (clientHomePhone || null) : undefined,
        companyName:    companyName     !== undefined ? (companyName     || null) : undefined,
        companyPhone:   companyPhone    !== undefined ? (companyPhone    || null) : undefined,
        serviceDetails: serviceDetails  !== undefined ? (serviceDetails  || null) : undefined,
        materials:      materials       !== undefined ? (materials       || null) : undefined,
        quoteTo:        quoteTo         !== undefined ? (quoteTo         || null) : undefined,
        creatorName:    creatorName     !== undefined ? (creatorName     || null)                                        : undefined,
        language:       language        !== undefined ? (language        || "EN")                                        : undefined,
        contacto:       contacto        !== undefined ? (contacto        || null)                                        : undefined,
        bultos:         bultos          !== undefined ? (bultos != null ? parseInt(bultos) : null)                        : undefined,
        personalCount:  personalCount   !== undefined ? (personalCount != null ? parseInt(personalCount) : null)          : undefined,
        transbordo:     transbordo      !== undefined ? transbordo                                                        : undefined,
        daysToComplete:  daysToComplete  !== undefined ? (daysToComplete  != null && daysToComplete  !== '' ? parseInt(daysToComplete)  : null) : undefined,
        quoteId:        quoteId         !== undefined ? (quoteId         || null)                                        : undefined,
        movingFileId:         movingFileId         !== undefined ? (movingFileId         || null) : undefined,
        coordinatorId:        coordinatorId        !== undefined ? (coordinatorId        || null) : undefined,
        visitId:              visitId              !== undefined ? (visitId              || null) : undefined,
        corporateClientId:    corporateClientId    !== undefined ? (corporateClientId    || null) : undefined,
      },
    })
    // Determine the coordinator that is currently active after this update
    const coordinatorChanged = coordinatorId !== undefined && coordinatorId !== (before?.coordinatorId ?? null)
    const linkedFileId = job.movingFileId ?? before?.movingFileId ?? null
    const activeCoordinatorId = coordinatorId !== undefined ? (coordinatorId || null) : (before?.coordinatorId ?? null)

    // Sync coordinator to the linked MovingFile only when it actually changes
    if (coordinatorChanged && linkedFileId) {
      await getPrisma().movingFile.update({
        where: { id: linkedFileId },
        data:  { coordinatorId: coordinatorId || null },
      })
    }

    // Notify coordinator on every update (not just on change) — fire-and-forget
    if (activeCoordinatorId && linkedFileId) {
      const fileForNotification = await getPrisma().movingFile.findUnique({
        where: { id: linkedFileId },
        include: {
          client:          { select: { id: true, name: true, firstName: true, lastName: true, clientType: true } },
          corporateClient: { select: { id: true, name: true } },
          coordinator:     { select: { id: true, name: true, email: true } },
        },
      })
      if (fileForNotification?.coordinator?.email) {
        notifyFileCoordinator(fileForNotification, coordinatorChanged ? 'assigned' : 'updated')
      }
    }

    logAudit(req, 'Job', req.params.id, 'UPDATE', before, job)
    // Sync schedule entries — awaited so scheduling problems can be surfaced to the caller
    const { warning: scheduleWarning } = await syncJobScheduleEntries(job, req, {
      forceOverride: Boolean(forceScheduleOverride),
      overrideReason: scheduleOverrideReason,
    }).catch(() => ({ warning: null }))
    res.json({ ...job, scheduleWarning: scheduleWarning || null })
  } catch (err) { next(err) }
})

// PATCH link/unlink moving file
router.patch("/:id/moving-file", forbidBodegaWrite, async (req, res, next) => {
  try {
    const { movingFileId } = req.body
    const job = await getPrisma().job.update({
      where: { id: req.params.id },
      data:  { movingFileId: movingFileId || null },
      include: { movingFile: { select: { id: true, fileNumber: true, status: true, category: true } } },
    })
    res.json(job)
  } catch (err) { next(err) }
})

// PATCH status only
router.patch("/:id/status", forbidBodegaWrite, async (req, res, next) => {
  try {
    const { status } = req.body
    if (!status) return res.status(400).json({ error: "status is required" })
    const job = await getPrisma().job.update({ where: { id: req.params.id }, data: { status } })
    res.json(job)
  } catch (err) { next(err) }
})

// PATCH crew size (personalCount) only — used by the Scheduling Manager from the Schedule screen.
// Restricted to the Scheduling Manager permission (not general job-write access), audited, and
// re-runs the schedule capacity check since it can resolve or create a needs-attention state.
router.patch("/:id/personal-count", requireScheduleManager, async (req, res, next) => {
  try {
    const { personalCount } = req.body
    const value = personalCount != null && personalCount !== '' ? parseInt(personalCount, 10) : null
    if (value != null && (!Number.isInteger(value) || value < 0)) {
      return res.status(400).json({ error: 'El número de trabajadores debe ser un entero válido.' })
    }
    const before = await getPrisma().job.findUnique({ where: { id: req.params.id } })
    if (!before) return res.status(404).json({ error: 'Not found' })
    const job = await getPrisma().job.update({ where: { id: req.params.id }, data: { personalCount: value } })
    logAudit(req, 'Job', job.id, 'UPDATE', before, job)
    const { warning: scheduleWarning } = await syncJobScheduleEntries(job, req).catch(() => ({ warning: null }))
    res.json({ ...job, scheduleWarning: scheduleWarning || null })
  } catch (err) { next(err) }
})

// DELETE
router.delete("/:id", forbidBodegaWrite, async (req, res, next) => {
  try {
    const before = await getPrisma().job.findUnique({ where: { id: req.params.id } })
    await getPrisma().job.delete({ where: { id: req.params.id } })
    logAudit(req, 'Job', req.params.id, 'DELETE', before, null)
    res.status(204).end()
  } catch (err) { next(err) }
})

module.exports = router
