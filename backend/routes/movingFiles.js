const router = require("express").Router()
const { logAudit } = require('../audit')
const { getPrisma } = require("../db")
const { notifyFileCoordinator, diffFileFields } = require('../services/notifications')
const { syncJobScheduleEntries } = require('../services/scheduleSync')

const CATEGORY_PREFIX = { EXPORT: "E", IMPORT: "DF", LOCAL: "M", WAREHOUSE: "B" }
const WINMOVERS_SENTINEL = 'WINMOVERS'

async function normalizeAgentIdForStorage(rawAgentId) {
  if (rawAgentId === undefined) return undefined
  if (!rawAgentId) return null
  if (rawAgentId !== WINMOVERS_SENTINEL) return rawAgentId

  const existing = await getPrisma().agent.findFirst({
    where: { name: { equals: 'WinMovers', mode: 'insensitive' } },
    select: { id: true },
  })
  if (existing?.id) return existing.id

  const created = await getPrisma().agent.create({
    data: { name: 'WinMovers' },
    select: { id: true },
  })
  return created.id
}

async function generateFileNumber(category) {
  const prefix = CATEGORY_PREFIX[category]
  if (!prefix) throw new Error("Unknown category: " + category)
  const year = new Date().getFullYear()
  const last = await getPrisma().movingFile.findFirst({
    where: { fileNumber: { startsWith: prefix + "-" } },
    orderBy: { createdAt: "desc" },
    select: { fileNumber: true },
  })
  let lastNum = 0
  if (last) {
    // Support both legacy format "E-0001" and new format "E-0001-2026"
    const parts = last.fileNumber.split("-")
    lastNum = parseInt(parts[1], 10)
  }
  const seedKey = `counter.${category}`
  const seed = await getPrisma().systemSetting.findUnique({ where: { key: seedKey } })
  const seedNum = seed ? parseInt(seed.value, 10) - 1 : 0
  const next = Math.max(lastNum, seedNum) + 1
  return prefix + "-" + String(next).padStart(4, "0") + "-" + year
}

async function checkAutoClose(fileId, category, bookerRole = null) {
  const REQUIRED = {
    EXPORT: ["SURVEY_REPORT","QUOTATION","INSURANCE_INVENTORY","SIGNED_QUOTATION","WORK_ORDER","PRE_ADVICE","SHIPPING_INSTRUCTIONS","TRANSPORT_DOCUMENT","INSURANCE_CERTIFICATE","SIGNED_PACKING_LIST","INVOICE","DELIVERY_CONFIRMATION"],
    IMPORT: ["QUOTATION","INSURANCE_INVENTORY","SIGNED_QUOTATION","WORK_ORDER","SHIPPING_INSTRUCTIONS","TRANSPORT_DOCUMENT","INSURANCE_CERTIFICATE","SIGNED_PACKING_LIST","INVOICE","DELIVERY_CONFIRMATION"],
    LOCAL:  ["INVOICE"],
  }
  const baseRequired = REQUIRED[category]
  if (!baseRequired) return
  const required = baseRequired.filter(cat => {
    if (category === 'EXPORT' && cat === 'DELIVERY_CONFIRMATION') return bookerRole === 'BOOKER'
    return true
  })
  const atts = await getPrisma().attachment.findMany({ where: { fileId }, select: { category: true } })
  const attached = new Set(atts.map(a => a.category))
  if (required.every(r => attached.has(r))) {
    await getPrisma().movingFile.update({ where: { id: fileId }, data: { status: "CLOSED" } })
  }
}

// GET /api/files
router.get("/", async (req, res, next) => {
  try {
    const { category, status, notStatus, search, includeDeleted, onlyDeleted } = req.query
    const where = {}
    if (category)  where.category = category
    if (status)    where.status   = status
    if (notStatus) where.status   = { notIn: notStatus.split(',') }
    if (onlyDeleted === 'true') where.deletedAt = { not: null }
    else if (includeDeleted !== 'true') where.deletedAt = null
    if (search)   where.OR = [
      { fileNumber: { contains: search, mode: "insensitive" } },
      { client: { name: { contains: search, mode: "insensitive" } } },
    ]
    const files = await getPrisma().movingFile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        client:          { select: { id: true, name: true, firstName: true, lastName: true, clientType: true, phone: true, address: true } },
        corporateClient: { select: { id: true, name: true, phone: true, address: true } },
        job:    { select: { id: true, jobNumber: true, status: true, type: true, clientPhone: true, clientHomePhone: true, companyPhone: true, originAddress: true, originCity: true, originCountry: true, serviceLatitude: true, serviceLongitude: true, coordinator: { select: { id: true, name: true } } } },
        originAgent: { select: { id: true, name: true } },
        destAgent:   { select: { id: true, name: true } },
        coordinator: { select: { id: true, name: true } },
        _count: { select: { attachments: true } },
      },
    })
    res.json(files)
  } catch (e) { next(e) }
})

// GET /api/files/:id
router.get("/:id", async (req, res, next) => {
  try {
    const includeDeleted = req.query.includeDeleted === 'true'
    const file = await getPrisma().movingFile.findUnique({
      where: { id: req.params.id },
      include: {
        client:          true,
        corporateClient: { select: { id: true, name: true } },
        job:         { select: { id: true, jobNumber: true, status: true, type: true, shipmentMode: true, volumeCbm: true, weightKg: true, serviceDate: true, originAddress: true, originCity: true, originCountry: true, serviceLatitude: true, serviceLongitude: true, destAddress: true, destCity: true, destCountry: true, companyName: true, clientPhone: true, clientHomePhone: true, coordinator: { select: { id: true, name: true } }, quote: { select: { id: true, quoteNumber: true, status: true } }, visit: { select: { id: true, visitNumber: true } } } },
        originAgent: { select: { id: true, name: true } },
        destAgent:   { select: { id: true, name: true } },
        coordinator: { select: { id: true, name: true } },
        attachments: { orderBy: { uploadedAt: "desc" } },
        quotes:      { orderBy: { createdAt: 'desc' }, select: { id: true, quoteNumber: true, status: true, totalAmount: true, currency: true, language: true, createdAt: true } },
      },
    })
    if (!file) return res.status(404).json({ error: "Not found" })
    if (file.deletedAt && !includeDeleted) return res.status(404).json({ error: "Not found" })

    // Fallback: if job has no direct visitId, resolve visit through quote→visit chain
    if (file.job && !file.job.visit && file.job.quote?.id) {
      const q = await getPrisma().quote.findUnique({
        where: { id: file.job.quote.id },
        select: { visit: { select: { id: true, visitNumber: true } } },
      })
      if (q?.visit) file.job.visit = q.visit
    }

    res.json(file)
  } catch (e) { next(e) }
})

// POST /api/files
router.post("/", async (req, res, next) => {
  try {
    const { category, clientId, corporateClientId, notes, newClient,
            serviceType, shipmentMode, loadType, volumeCbm, weightKg, bultos,
            bookerRole, originAgentId, destAgentId,
            originAddress, originCity, originCountry,
            destAddress, destCity, destCountry,
            etd, eta, navieraAerolinea, vaporVuelo, guiaObl,
            puertoSalida, puertoLlegada, destPhone,
            puertoEntrada, oblHastaCiudad,
            fechaLlegada, fechaTrasladoBodega, fechaTraslado, fechaEntrega,
            anticipado,
            coordinatorId } = req.body

    // Inline client creation
    let resolvedClientId = clientId || null
    if (newClient && (newClient.firstName || newClient.lastName || newClient.name)) {
      const name = newClient.name || [newClient.firstName, newClient.lastName].filter(Boolean).join(' ')
      const created = await getPrisma().client.create({
        data: {
          clientType: newClient.clientType || 'INDIVIDUAL',
          name,
          firstName: newClient.firstName || null,
          lastName:  newClient.lastName  || null,
          email:     newClient.email     || null,
          phone:     newClient.phone     || null,
        },
      })
      resolvedClientId = created.id
    }

    const resolvedOriginAgentId = await normalizeAgentIdForStorage(originAgentId)
    const resolvedDestAgentId = await normalizeAgentIdForStorage(destAgentId)

    const fileNumber = await generateFileNumber(category)
    const file = await getPrisma().movingFile.create({
      data: {
        fileNumber, category, status: "OPEN",
        clientId: resolvedClientId,
        corporateClientId: corporateClientId || null,
        notes: notes || null,
        serviceType: serviceType || null,
        shipmentMode: shipmentMode || null,
        loadType: loadType || null,
        volumeCbm: volumeCbm ? parseFloat(volumeCbm) : null,
        weightKg:  weightKg  ? parseFloat(weightKg)  : null,
        weightUnit: weightKg ? 'LB' : null,
        bookerRole: bookerRole || null,
        originAgentId: resolvedOriginAgentId,
        destAgentId:   resolvedDestAgentId,
        originAddress: originAddress || null,
        originCity:    originCity    || null,
        originCountry: originCountry || null,
        destAddress:   destAddress   || null,
        destCity:      destCity      || null,
        destCountry:   destCountry   || null,
        etd:              etd              ? new Date(etd)              : null,
        eta:              eta              ? new Date(eta)              : null,
        navieraAerolinea: navieraAerolinea || null,
        vaporVuelo:       vaporVuelo       || null,
        guiaObl:          guiaObl          || null,
        puertoSalida:     puertoSalida     || null,
        puertoLlegada:    puertoLlegada    || null,
        destPhone:        destPhone        || null,
        puertoEntrada:    puertoEntrada    || null,
        oblHastaCiudad:   oblHastaCiudad   || null,
        fechaLlegada:         fechaLlegada         ? new Date(fechaLlegada)         : null,
        fechaTrasladoBodega:  fechaTrasladoBodega  || null,
        anticipado:           anticipado           === true || anticipado === 'true',
        fechaTraslado:        fechaTraslado        ? new Date(fechaTraslado)        : null,
        fechaEntrega:         fechaEntrega         ? new Date(fechaEntrega)         : null,
        bultos:               bultos != null       ? parseInt(bultos, 10)          : null,
        coordinatorId:        coordinatorId        || null,
      },
      include: {
        client:          { select: { id: true, name: true, firstName: true, lastName: true, clientType: true } },
        corporateClient: { select: { id: true, name: true } },
        coordinator:     { select: { id: true, name: true, email: true } },
        originAgent: { select: { id: true, name: true } },
        destAgent:   { select: { id: true, name: true } },
      },
    })
    // Fire-and-forget coordinator notification
    if (coordinatorId) notifyFileCoordinator(file, 'created')
    logAudit(req, 'MovingFile', file.id, 'CREATE', null, file)
    if (category === 'WAREHOUSE') {
      try {
        const warehouseJob = await getPrisma().job.create({
          data: {
            jobNumber:         fileNumber,
            type:              'WAREHOUSE',
            status:            'SURVEY',
            clientId:          resolvedClientId,
            corporateClientId: corporateClientId || null,
            movingFileId:      file.id,
            coordinatorId:     coordinatorId || null,
            serviceDate:       fechaEntrega ? new Date(fechaEntrega) : eta ? new Date(eta) : null,
            language:          'EN',
          },
        })
        logAudit(req, 'Job', warehouseJob.id, 'CREATE', null, warehouseJob)
        syncJobScheduleEntries(warehouseJob, req)
      } catch (jobErr) {
        console.error('Failed to auto-create WAREHOUSE job for file', file.id, jobErr)
      }
    }
    res.status(201).json(file)
  } catch (e) { next(e) }
})

// PUT /api/files/:id
router.put("/:id", async (req, res, next) => {
  try {
    const { clientId, corporateClientId, notes, status,
            serviceType, shipmentMode, loadType, volumeCbm, weightKg, bultos,
            bookerRole, originAgentId, destAgentId,
            originAddress, originCity, originCountry,
            destAddress, destCity, destCountry,
            damageReportData, evaluationData,
            etd, eta, navieraAerolinea, vaporVuelo, guiaObl,
            puertoSalida, puertoLlegada, destPhone,
            puertoEntrada, oblHastaCiudad,
            fechaLlegada, fechaTrasladoBodega, fechaTraslado, fechaEntrega,
            anticipado,
            coordinatorId } = req.body

    // Capture previous state before update (for coordinator notification and audit)
    const prevFile = await getPrisma().movingFile.findUnique({
      where: { id: req.params.id },
      include: { coordinator: { select: { id: true, name: true } } },
    }).catch(() => null)
    if (!prevFile) return res.status(404).json({ error: 'Not found' })
    if (prevFile.deletedAt) return res.status(409).json({ error: 'Cannot modify a deleted file. Restore it first.' })

    // IMP-05: IMPORT/EXPORT files cannot be closed without both Weight and Volume.
    const nextStatus = status !== undefined ? status : prevFile?.status
    const nextVolume = volumeCbm !== undefined ? (volumeCbm ? parseFloat(volumeCbm) : null) : prevFile?.volumeCbm
    const nextWeight = weightKg  !== undefined ? (weightKg  ? parseFloat(weightKg)  : null) : prevFile?.weightKg
    const nextBookerRole = bookerRole !== undefined ? (bookerRole || null) : prevFile?.bookerRole
    const needsWeightVolume = prevFile && (prevFile.category === 'IMPORT' || prevFile.category === 'EXPORT')
    if (nextStatus === 'CLOSED' && needsWeightVolume && (nextVolume == null || nextWeight == null)) {
      return res.status(400).json({ error: 'Cannot close file: Weight (LB) and Volume (CMB) are required for Import and Export files.' })
    }

    if (nextStatus === 'CLOSED' && prevFile?.category === 'EXPORT' && nextBookerRole === 'BOOKER') {
      const hasDeliveryConfirmation = await getPrisma().attachment.findFirst({
        where: { fileId: req.params.id, category: 'DELIVERY_CONFIRMATION' },
        select: { id: true },
      })
      if (!hasDeliveryConfirmation) {
        return res.status(400).json({ error: 'Cannot close file: Delivery Confirmation is required for Export files when Booker role is BOOKER.' })
      }
    }

    const resolvedOriginAgentId = await normalizeAgentIdForStorage(originAgentId)
    const resolvedDestAgentId = await normalizeAgentIdForStorage(destAgentId)

    const file = await getPrisma().movingFile.update({
      where: { id: req.params.id },
      data: {
        clientId:          clientId          !== undefined ? (clientId          || null) : undefined,
        corporateClientId: corporateClientId !== undefined ? (corporateClientId || null) : undefined,
        notes:             notes             !== undefined ? (notes             || null) : undefined,
        status:       status       !== undefined ? status                 : undefined,
        serviceType:  serviceType  !== undefined ? (serviceType  || null) : undefined,
        shipmentMode: shipmentMode !== undefined ? (shipmentMode || null) : undefined,
        loadType:     loadType     !== undefined ? (loadType     || null) : undefined,
        volumeCbm:    volumeCbm    !== undefined ? (volumeCbm    ? parseFloat(volumeCbm) : null) : undefined,
        weightKg:     weightKg     !== undefined ? (weightKg     ? parseFloat(weightKg)  : null) : undefined,
        weightUnit:   weightKg     !== undefined ? (weightKg     ? 'LB' : null) : undefined,
        bookerRole:   bookerRole   !== undefined ? (bookerRole   || null) : undefined,
        originAgentId: resolvedOriginAgentId,
        destAgentId:   resolvedDestAgentId,
        originAddress: originAddress !== undefined ? (originAddress || null) : undefined,
        originCity:    originCity    !== undefined ? (originCity    || null) : undefined,
        originCountry: originCountry !== undefined ? (originCountry || null) : undefined,
        destAddress:   destAddress   !== undefined ? (destAddress   || null) : undefined,
        destCity:      destCity      !== undefined ? (destCity      || null) : undefined,
        destCountry:   destCountry   !== undefined ? (destCountry   || null) : undefined,
        damageReportData:     damageReportData     !== undefined ? (damageReportData     || null) : undefined,
        evaluationData:       evaluationData       !== undefined ? (evaluationData       || null) : undefined,
        etd:                  etd                  !== undefined ? (etd                  ? new Date(etd)  : null) : undefined,
        eta:                  eta                  !== undefined ? (eta                  ? new Date(eta)  : null) : undefined,
        navieraAerolinea:     navieraAerolinea     !== undefined ? (navieraAerolinea     || null) : undefined,
        vaporVuelo:           vaporVuelo           !== undefined ? (vaporVuelo           || null) : undefined,
        guiaObl:              guiaObl              !== undefined ? (guiaObl              || null) : undefined,
        puertoSalida:         puertoSalida         !== undefined ? (puertoSalida         || null) : undefined,
        puertoLlegada:        puertoLlegada        !== undefined ? (puertoLlegada        || null) : undefined,
        destPhone:            destPhone            !== undefined ? (destPhone            || null) : undefined,
        puertoEntrada:        puertoEntrada        !== undefined ? (puertoEntrada        || null) : undefined,
        oblHastaCiudad:       oblHastaCiudad       !== undefined ? (oblHastaCiudad       || null) : undefined,
        fechaLlegada:         fechaLlegada         !== undefined ? (fechaLlegada         ? new Date(fechaLlegada)         : null) : undefined,
        fechaTrasladoBodega:  fechaTrasladoBodega  !== undefined ? (fechaTrasladoBodega  || null) : undefined,
        anticipado:           anticipado           !== undefined ? (anticipado === true || anticipado === 'true') : undefined,
        fechaTraslado:        fechaTraslado        !== undefined ? (fechaTraslado        ? new Date(fechaTraslado)        : null) : undefined,
        fechaEntrega:         fechaEntrega         !== undefined ? (fechaEntrega         ? new Date(fechaEntrega)         : null) : undefined,
        bultos:               bultos               !== undefined ? (bultos != null ? parseInt(bultos, 10) : null) : undefined,
        coordinatorId:        coordinatorId        !== undefined ? (coordinatorId        || null) : undefined,
      },
      include: {
        client:          { select: { id: true, name: true, firstName: true, lastName: true, clientType: true } },
        corporateClient: { select: { id: true, name: true } },
        coordinator:     { select: { id: true, name: true, email: true } },
        originAgent: { select: { id: true, name: true } },
        destAgent:   { select: { id: true, name: true } },
      },
    })
    // Notify coordinator on every update as long as one is assigned
    // (includes self-assignment and any field change, not just coordinator reassignment)
    if (file.coordinator?.email) {
      const isNewAssignment = coordinatorId !== undefined && coordinatorId && coordinatorId !== (prevFile?.coordinatorId ?? null)
      const action = isNewAssignment ? 'assigned' : 'updated'
      const changes = action === 'updated' ? diffFileFields(prevFile, file) : []
      notifyFileCoordinator(file, action, changes)
    }
    // Sync coordinator to the linked Job (if any) so both records stay consistent
    if (coordinatorId !== undefined && coordinatorId !== (prevFile?.coordinatorId ?? null)) {
      const linkedJob = await getPrisma().job.findFirst({ where: { movingFileId: req.params.id }, select: { id: true } })
      if (linkedJob) {
        await getPrisma().job.update({ where: { id: linkedJob.id }, data: { coordinatorId: coordinatorId || null } })
      }
    }
    logAudit(req, 'MovingFile', req.params.id, 'UPDATE', prevFile, file)
    res.json(file)
  } catch (e) { next(e) }
})

// DELETE /api/files/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const before = await getPrisma().movingFile.findUnique({ where: { id: req.params.id } })
    if (!before) return res.status(404).json({ error: 'Not found' })
    if (before.deletedAt) return res.status(204).end()

    const after = await getPrisma().movingFile.update({
      where: { id: req.params.id },
      data: {
        deletedAt: new Date(),
        deletedByOid: req.user?.oid || null,
        deletedByName: req.user?.name || null,
        status: 'VOID',
      },
    })
    logAudit(req, 'MovingFile', req.params.id, 'DELETE', before, after)
    res.status(204).end()
  } catch (e) { next(e) }
})

// POST /api/files/:id/restore
router.post("/:id/restore", async (req, res, next) => {
  try {
    const before = await getPrisma().movingFile.findUnique({ where: { id: req.params.id } })
    if (!before) return res.status(404).json({ error: 'Not found' })
    if (!before.deletedAt) return res.status(400).json({ error: 'File is not deleted.' })

    const after = await getPrisma().movingFile.update({
      where: { id: req.params.id },
      data: {
        deletedAt: null,
        deletedByOid: null,
        deletedByName: null,
        status: before.status === 'VOID' ? 'OPEN' : before.status,
      },
      include: {
        client:          { select: { id: true, name: true, firstName: true, lastName: true, clientType: true } },
        corporateClient: { select: { id: true, name: true } },
        coordinator:     { select: { id: true, name: true, email: true } },
        originAgent: { select: { id: true, name: true } },
        destAgent:   { select: { id: true, name: true } },
      },
    })

    logAudit(req, 'MovingFile', req.params.id, 'UPDATE', before, after)
    res.json(after)
  } catch (e) { next(e) }
})

module.exports = router
module.exports.generateFileNumber = generateFileNumber
module.exports.checkAutoClose     = checkAutoClose
