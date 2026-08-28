const { getPrisma } = require('../db')
const { logAudit }  = require('../audit')
const { checkCapacityForSpan, findClosestAvailableSpan } = require('./scheduleCapacity')

const SERVICE_TYPE_LABELS = {
  DOOR_TO_PORT: 'Puerta a Puerto',
  DOOR_TO_DOOR: 'Puerta a Puerta',
  PACKING:      'Empaque',
  LOCAL_MOVE:   'Mudanza Local',
  PORT_TO_DOOR: 'Puerto a Puerta',
}

/**
 * Upsert/delete EMPAQUE and MUDANZA schedule entries for a Job.
 * Called after job create or update. Returns { warning } when the job could
 * not be auto-scheduled (missing personalCount or insufficient capacity) —
 * callers should surface this to the user rather than silently skip it.
 * Pass { forceOverride: true, overrideReason } to schedule anyway despite
 * insufficient capacity, flagging the entry as needing attention.
 */
async function syncJobScheduleEntries(job, req = null, { forceOverride = false, overrideReason = null } = {}) {
  const db = getPrisma()

  // Resolve a stable client label from linked records (never from agent/quoteTo text).
  let clientLabel = ''
  try {
    const jobWithClient = await db.job.findUnique({
      where: { id: job.id },
      select: {
        client: {
          select: {
            clientType: true,
            name: true,
            firstName: true,
            lastName: true,
          },
        },
        corporateClient: {
          select: {
            name: true,
          },
        },
      },
    })

    const individualName = jobWithClient?.client
      ? `${jobWithClient.client.firstName || ''} ${jobWithClient.client.lastName || ''}`.trim()
      : ''

    clientLabel =
      (jobWithClient?.client?.clientType === 'INDIVIDUAL' ? (individualName || jobWithClient?.client?.name || '') : '') ||
      jobWithClient?.corporateClient?.name ||
      jobWithClient?.client?.name ||
      job.companyName ||
      ''
  } catch (_) {
    clientLabel = job.companyName || ''
  }

  // Build notes from job details (only written on first create; preserved if user edits later)
  const noteParts = []
  if (clientLabel)           noteParts.push(`Cliente: ${clientLabel}`)
  const typeParts = [job.type, job.shipmentMode].filter(Boolean)
  if (typeParts.length)      noteParts.push(typeParts.join(' · '))
  const origin = [job.originCity, job.originCountry].filter(Boolean).join(', ')
  const dest   = [job.destCity,   job.destCountry  ].filter(Boolean).join(', ')
  if (origin || dest)        noteParts.push([origin && `Origen: ${origin}`, dest && `Destino: ${dest}`].filter(Boolean).join(' → '))
  const measures = []
  if (job.volumeCbm != null) measures.push(`${job.volumeCbm} m³`)
  if (job.weightKg  != null) measures.push(`${job.weightKg} lb`)
  if (job.bultos    != null) measures.push(`${job.bultos} bultos`)
  if (measures.length)       noteParts.push(measures.join(' · '))
  if (job.serviceDetails)    noteParts.push(job.serviceDetails)
  const notes = noteParts.length ? noteParts.join('\n') : null

  const taskType = { EXPORT: 'EMPAQUE', IMPORT: 'DESEMPAQUE', WAREHOUSE: 'ALMACENAJE' }[job.type] || 'MUDANZA'
  const description = clientLabel || 'Sin cliente'

  // Resolve encargado: prefer MovingFile coordinator, fall back to job coordinator
  let resolvedCoordinatorId = job.coordinatorId || null
  if (job.movingFileId) {
    const mf = await db.movingFile.findUnique({
      where: { id: job.movingFileId },
      select: { coordinatorId: true },
    }).catch(() => null)
    if (mf?.coordinatorId) resolvedCoordinatorId = mf.coordinatorId
  }

  const startDateRaw = job.serviceDate || job.moveDate
  const daysToComplete = job.daysToComplete || 1
  const matchWhere = { jobId: job.id, taskType: { in: ['EMPAQUE', 'MUDANZA', 'DESEMPAQUE'] } }

  let warning = null
  let needsAttention = false
  let resolvedOverrideReason = null
  if (startDateRaw) {
    const existing = await db.scheduleEntry.findFirst({ where: matchWhere })
    if (!job.personalCount) {
      warning = {
        code: 'MISSING_WORKERS_REQUIRED',
        message: 'Este trabajo necesita el número de trabajadores requeridos antes de poder agendarse automáticamente.',
      }
    } else {
      const { fits } = await checkCapacityForSpan(startDateRaw, daysToComplete, job.personalCount, existing?.id || null)
      if (fits) {
        needsAttention = false
        resolvedOverrideReason = null
      } else if (forceOverride) {
        if (!overrideReason?.trim()) {
          warning = {
            code: 'OVERRIDE_REASON_REQUIRED',
            message: 'Debes indicar un motivo para agendar este trabajo fuera de la capacidad disponible.',
          }
        } else {
          needsAttention = true
          resolvedOverrideReason = overrideReason.trim()
        }
      } else if (existing?.needsAttention) {
        // Already flagged from a prior override — keep it flagged with its stored reason rather than re-blocking.
        needsAttention = true
        resolvedOverrideReason = existing.overrideReason
      } else {
        const suggestions = await findClosestAvailableSpan(startDateRaw, daysToComplete, job.personalCount, existing?.id || null)
        warning = {
          code: 'NO_CAPACITY',
          message: 'No hay espacio en la Bitácora para este trabajo esa fecha (o fechas).',
          suggestions,
        }
      }
    }
  }

  // Match any existing service entry for this job regardless of old taskType
  if (!warning) {
    await _syncEntry(db, {
      matchWhere,
      date:         startDateRaw,
      days:         daysToComplete,
      time:         job.serviceTime || null,
      taskType,
      description,
      notes,
      jobId:        job.id,
      assignedToId: resolvedCoordinatorId,
      needsAttention,
      overrideReason: resolvedOverrideReason,
      req,
    })
  }

  return { warning }
}

/**
 * Internal helper — upsert if date is set, delete if date is null/undefined.
 */
async function _syncEntry(db, { matchWhere, date, days = 1, time, taskType, description, notes, jobId, assignedToId, needsAttention = false, overrideReason = null, req = null }) {
  try {
    const existing = await db.scheduleEntry.findFirst({ where: matchWhere })

    if (!date) {
      // Date cleared — remove the entry if it exists
      if (existing) {
        await db.scheduleEntry.delete({ where: { id: existing.id } })
        if (req) logAudit(req, 'ScheduleEntry', existing.id, 'DELETE', existing, null)
      }
      return
    }

    const sourceStart = new Date(new Date(date).toISOString().slice(0, 10) + 'T00:00:00.000Z')
    const sourceEnd = new Date(sourceStart)
    sourceEnd.setUTCDate(sourceEnd.getUTCDate() + Math.max(1, days) - 1)
    const data = {
      date:         sourceStart,
      startDate:    sourceStart,
      endDate:      sourceEnd,
      time:         time         || null,
      taskType,
      description,
      notes:        notes        || null,
      assignedToId: assignedToId || null,
      jobId:        jobId        || null,
      needsAttention,
      overrideReason,
    }

    if (existing) {
      // On re-sync: update structural fields from the job, but preserve a manually adjusted range.
      const nextRange = existing.rangeManuallyAdjusted
        ? { date: existing.startDate || existing.date, startDate: existing.startDate || existing.date, endDate: existing.endDate || existing.date }
        : { date: data.date, startDate: data.startDate, endDate: data.endDate }
      const updated = await db.scheduleEntry.update({
        where: { id: existing.id },
        data: {
          ...nextRange,
          time: data.time,
          taskType: data.taskType,
          description: data.description,
          needsAttention: data.needsAttention,
          overrideReason: data.overrideReason,
        },
      })
      if (req) logAudit(req, 'ScheduleEntry', existing.id, 'UPDATE', existing, updated)
    } else {
      const created = await db.scheduleEntry.create({ data: { ...data, isAutoGenerated: true } })
      if (req) logAudit(req, 'ScheduleEntry', created.id, 'CREATE', null, created)
    }
  } catch (err) {
    console.error('[scheduleSync] error:', err.message)
  }
}

module.exports = { syncJobScheduleEntries }
