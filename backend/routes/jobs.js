const router = require("express").Router()
const { getPrisma } = require("../db")
const { generateFileNumber } = require("./movingFiles")

function toDate(val) {
  if (!val) return null
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

async function generateJobNumber() {
  const year = new Date().getFullYear()
  const prefix = "WM-" + year + "-"
  const last = await getPrisma().job.findFirst({
    where: { jobNumber: { startsWith: prefix } },
    orderBy: { jobNumber: "desc" },
    select: { jobNumber: true },
  })
  const next = last ? parseInt(last.jobNumber.slice(prefix.length), 10) + 1 : 1
  return prefix + String(next).padStart(4, "0")
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
router.post("/", async (req, res, next) => {
  try {
    const {
      type, status, clientId,
      originAgentId, destAgentId, customsAgentId,
      originAddress, originCity, originCountry,
      destAddress, destCity, destCountry,
      callDate, surveyDate, packDate, moveDate, deliveryDate,
      volumeCbm, weightKg, shipmentMode, notes, quoteId,
      serviceDate, serviceTime, clientPhone, clientHomePhone,
      companyName, companyPhone, serviceDetails, materials, quoteTo, creatorName, language,
      contacto, bultos, personalCount, transbordo,
      movingFileId: manualMovingFileId,
      coordinatorId,
      visitId,
    } = req.body

    // Detect Export: visit serviceType DOOR_TO_PORT or DOOR_TO_DOOR
    const EXPORT_SERVICE_TYPES = ["DOOR_TO_PORT", "DOOR_TO_DOOR"]
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
                volumeCbm: volumeCbm ? parseFloat(volumeCbm) : null,
                weightKg:  weightKg  ? parseFloat(weightKg)  : null,
                bookerRole: visitBookerRole },
      })
      jobNumber    = fileNumber
      movingFileId = mf.id
    } else if (type === "DOMESTIC") {
      // Domestic/Local: Job number = File number (M-####-YYYY), LOCAL file auto-created
      const fileNumber = await generateFileNumber("LOCAL")
      const mf = await getPrisma().movingFile.create({
        data: { fileNumber, category: "LOCAL", status: "OPEN", clientId: clientId || null,
                volumeCbm: volumeCbm ? parseFloat(volumeCbm) : null,
                weightKg:  weightKg  ? parseFloat(weightKg)  : null,
                bookerRole: visitBookerRole },
      })
      jobNumber    = fileNumber
      movingFileId = mf.id
    } else if (type === "IMPORT" && manualMovingFileId) {
      // Import job linked to existing file: use file's number as job number
      const linkedFile = await getPrisma().movingFile.findUnique({
        where: { id: manualMovingFileId },
        select: { fileNumber: true },
      })
      jobNumber    = linkedFile?.fileNumber || await generateJobNumber()
      movingFileId = manualMovingFileId
    } else {
      // Import standalone or International: standard WM-YYYY-#### number
      jobNumber    = await generateJobNumber()
      movingFileId = manualMovingFileId || null
    }

    const data = {
      jobNumber, type,
      status:        status        || "SURVEY",
      clientId:      clientId      || null,
      originAgentId: originAgentId || null,
      destAgentId:   destAgentId   || null,
      customsAgentId:customsAgentId|| null,
      originAddress, originCity, originCountry,
      destAddress,   destCity,   destCountry,
      callDate:    toDate(callDate),
      surveyDate:  toDate(surveyDate),
      packDate:    toDate(packDate),
      moveDate:    toDate(moveDate),
      deliveryDate:toDate(deliveryDate),
      volumeCbm:   volumeCbm ? parseFloat(volumeCbm) : null,
      weightKg:    weightKg  ? parseFloat(weightKg)  : null,
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
      quoteId:        quoteId        || null,
      movingFileId,
      visitId:        visitId        || null,
      coordinatorId:  coordinatorId   || null,    }

    const job = await getPrisma().job.create({ data })
    res.status(201).json(job)
  } catch (err) { next(err) }
})

// PUT update
router.put("/:id", async (req, res, next) => {
  try {
    const {
      type, status, clientId,
      originAgentId, destAgentId, customsAgentId,
      originAddress, originCity, originCountry,
      destAddress, destCity, destCountry,
      callDate, surveyDate, packDate, moveDate, deliveryDate,
      volumeCbm, weightKg, shipmentMode, notes, quoteId,
      serviceDate, serviceTime, clientPhone, clientHomePhone,
      companyName, companyPhone, serviceDetails, materials, quoteTo, creatorName, language,
      contacto, bultos, personalCount, transbordo,
      movingFileId,
      coordinatorId,
      visitId,
    } = req.body

    const job = await getPrisma().job.update({
      where: { id: req.params.id },
      data: {
        type, status,
        clientId:      clientId      || null,
        originAgentId: originAgentId || null,
        destAgentId:   destAgentId   || null,
        customsAgentId:customsAgentId|| null,
        originAddress, originCity, originCountry,
        destAddress,   destCity,   destCountry,
        callDate:    toDate(callDate),
        surveyDate:  toDate(surveyDate),
        packDate:    toDate(packDate),
        moveDate:    toDate(moveDate),
        deliveryDate:toDate(deliveryDate),
        volumeCbm:   volumeCbm ? parseFloat(volumeCbm) : null,
        weightKg:    weightKg  ? parseFloat(weightKg)  : null,
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
        quoteId:        quoteId         !== undefined ? (quoteId         || null)                                        : undefined,
        movingFileId:   movingFileId    !== undefined ? (movingFileId    || null) : undefined,
        coordinatorId:  coordinatorId   !== undefined ? (coordinatorId   || null) : undefined,
        visitId:        visitId         !== undefined ? (visitId         || null) : undefined,
      },
    })
    res.json(job)
  } catch (err) { next(err) }
})

// PATCH link/unlink moving file
router.patch("/:id/moving-file", async (req, res, next) => {
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
router.patch("/:id/status", async (req, res, next) => {
  try {
    const { status } = req.body
    if (!status) return res.status(400).json({ error: "status is required" })
    const job = await getPrisma().job.update({ where: { id: req.params.id }, data: { status } })
    res.json(job)
  } catch (err) { next(err) }
})

// DELETE
router.delete("/:id", async (req, res, next) => {
  try {
    await getPrisma().job.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) { next(err) }
})

module.exports = router
