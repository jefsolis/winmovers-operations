const router = require("express").Router()
const { getPrisma } = require("../db")

const CATEGORY_PREFIX = { EXPORT: "E", IMPORT: "D", LOCAL: "M" }

async function generateFileNumber(category) {
  const prefix = CATEGORY_PREFIX[category]
  if (!prefix) throw new Error("Unknown category: " + category)
  const year = new Date().getFullYear()
  const last = await getPrisma().movingFile.findFirst({
    where: { fileNumber: { startsWith: prefix + "-" } },
    orderBy: { createdAt: "desc" },
    select: { fileNumber: true },
  })
  let next = 1
  if (last) {
    // Support both legacy format "E-0001" and new format "E-0001-2026"
    const parts = last.fileNumber.split("-")
    next = parseInt(parts[1], 10) + 1
  }
  return prefix + "-" + String(next).padStart(4, "0") + "-" + year
}

async function checkAutoClose(fileId, category) {
  const REQUIRED = {
    EXPORT: ["SURVEY_REPORT","QUOTATION","INSURANCE_INVENTORY","SIGNED_QUOTATION","WORK_ORDER","PRE_ADVICE","SHIPPING_INSTRUCTIONS","TRANSPORT_DOCUMENT","INSURANCE_CERTIFICATE","SIGNED_PACKING_LIST","INVOICE","DELIVERY_CONFIRMATION"],
    IMPORT: ["QUOTATION","INSURANCE_INVENTORY","SIGNED_QUOTATION","WORK_ORDER","SHIPPING_INSTRUCTIONS","TRANSPORT_DOCUMENT","INSURANCE_CERTIFICATE","SIGNED_PACKING_LIST","INVOICE","DELIVERY_CONFIRMATION"],
    LOCAL:  ["INVOICE"],
  }
  const required = REQUIRED[category]
  if (!required) return
  const atts = await getPrisma().attachment.findMany({ where: { fileId }, select: { category: true } })
  const attached = new Set(atts.map(a => a.category))
  if (required.every(r => attached.has(r))) {
    await getPrisma().movingFile.update({ where: { id: fileId }, data: { status: "CLOSED" } })
  }
}

// GET /api/files
router.get("/", async (req, res, next) => {
  try {
    const { category, status, search } = req.query
    const where = {}
    if (category) where.category = category
    if (status)   where.status   = status
    if (search)   where.OR = [
      { fileNumber: { contains: search, mode: "insensitive" } },
      { client: { name: { contains: search, mode: "insensitive" } } },
    ]
    const files = await getPrisma().movingFile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, name: true, firstName: true, lastName: true, clientType: true } },
        job:    { select: { id: true, jobNumber: true, status: true } },
        originAgent: { select: { id: true, name: true } },
        destAgent:   { select: { id: true, name: true } },
        _count: { select: { attachments: true } },
      },
    })
    res.json(files)
  } catch (e) { next(e) }
})

// GET /api/files/:id
router.get("/:id", async (req, res, next) => {
  try {
    const file = await getPrisma().movingFile.findUnique({
      where: { id: req.params.id },
      include: {
        client:      true,
        job:         { select: { id: true, jobNumber: true, status: true, type: true, shipmentMode: true, volumeCbm: true, weightKg: true, serviceDate: true, originCity: true, originCountry: true, destCity: true, destCountry: true } },
        originAgent: { select: { id: true, name: true } },
        destAgent:   { select: { id: true, name: true } },
        attachments: { orderBy: { uploadedAt: "desc" } },
      },
    })
    if (!file) return res.status(404).json({ error: "Not found" })
    res.json(file)
  } catch (e) { next(e) }
})

// POST /api/files
router.post("/", async (req, res, next) => {
  try {
    const { category, clientId, notes, newClient,
            serviceType, shipmentMode, volumeCbm, weightKg,
            bookerRole, originAgentId, destAgentId } = req.body
    if (!category) return res.status(400).json({ error: "category is required" })

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

    const fileNumber = await generateFileNumber(category)
    const file = await getPrisma().movingFile.create({
      data: {
        fileNumber, category, status: "OPEN",
        clientId: resolvedClientId,
        notes: notes || null,
        serviceType: serviceType || null,
        shipmentMode: shipmentMode || null,
        volumeCbm: volumeCbm ? parseFloat(volumeCbm) : null,
        weightKg:  weightKg  ? parseFloat(weightKg)  : null,
        bookerRole: bookerRole || null,
        originAgentId: originAgentId || null,
        destAgentId:   destAgentId   || null,
      },
      include: {
        client: { select: { id: true, name: true, firstName: true, lastName: true, clientType: true } },
        originAgent: { select: { id: true, name: true } },
        destAgent:   { select: { id: true, name: true } },
      },
    })
    res.status(201).json(file)
  } catch (e) { next(e) }
})

// PUT /api/files/:id
router.put("/:id", async (req, res, next) => {
  try {
    const { clientId, notes, status,
            serviceType, shipmentMode, volumeCbm, weightKg,
            bookerRole, originAgentId, destAgentId } = req.body
    const file = await getPrisma().movingFile.update({
      where: { id: req.params.id },
      data: {
        clientId:     clientId     !== undefined ? (clientId     || null) : undefined,
        notes:        notes        !== undefined ? (notes        || null) : undefined,
        status:       status       !== undefined ? status                 : undefined,
        serviceType:  serviceType  !== undefined ? (serviceType  || null) : undefined,
        shipmentMode: shipmentMode !== undefined ? (shipmentMode || null) : undefined,
        volumeCbm:    volumeCbm    !== undefined ? (volumeCbm    ? parseFloat(volumeCbm) : null) : undefined,
        weightKg:     weightKg     !== undefined ? (weightKg     ? parseFloat(weightKg)  : null) : undefined,
        bookerRole:   bookerRole   !== undefined ? (bookerRole   || null) : undefined,
        originAgentId: originAgentId !== undefined ? (originAgentId || null) : undefined,
        destAgentId:   destAgentId   !== undefined ? (destAgentId   || null) : undefined,
      },
      include: {
        client: { select: { id: true, name: true, firstName: true, lastName: true, clientType: true } },
        originAgent: { select: { id: true, name: true } },
        destAgent:   { select: { id: true, name: true } },
      },
    })
    res.json(file)
  } catch (e) { next(e) }
})

// DELETE /api/files/:id
router.delete("/:id", async (req, res, next) => {
  try {
    await getPrisma().movingFile.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (e) { next(e) }
})

module.exports = router
module.exports.generateFileNumber = generateFileNumber
module.exports.checkAutoClose     = checkAutoClose
