/**
 * Backfill script — creates ScheduleEntry records from existing Jobs and Visits.
 *
 * Usage:
 *   node backend/scripts/backfill-schedule-entries.js          # live run
 *   node backend/scripts/backfill-schedule-entries.js --dry-run # preview only
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const DRY_RUN = process.argv.includes('--dry-run')

const SERVICE_TYPE_LABELS = {
  DOOR_TO_PORT: 'Puerta a Puerto',
  DOOR_TO_DOOR: 'Puerta a Puerta',
  PACKING:      'Empaque',
  LOCAL_MOVE:   'Mudanza Local',
  PORT_TO_DOOR: 'Puerto a Puerta',
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN — no DB writes ===' : '=== LIVE RUN ===')

  let created = 0

  // ── Jobs ───────────────────────────────────────────────────────────────────
  const jobs = await prisma.job.findMany({
    where: { OR: [{ packDate: { not: null } }, { moveDate: { not: null } }] },
    select: { id: true, jobNumber: true, packDate: true, moveDate: true, quoteTo: true, companyName: true, coordinatorId: true },
  })
  console.log(`\nJobs with pack/move dates: ${jobs.length}`)

  for (const job of jobs) {
    const label = job.quoteTo || job.companyName || ''
    const suffix = label ? ` — ${label}` : ''

    for (const [taskType, date] of [['EMPAQUE', job.packDate], ['MUDANZA', job.moveDate]]) {
      if (!date) continue
      const exists = await prisma.scheduleEntry.findFirst({ where: { jobId: job.id, taskType } })
      if (exists) {
        console.log(`  SKIP  ${taskType} for Job ${job.jobNumber} (already exists)`)
        continue
      }
      const data = { date, taskType, description: `${taskType === 'EMPAQUE' ? 'Empaque' : 'Mudanza'}${suffix}`, jobId: job.id, assignedToId: job.coordinatorId || null }
      console.log(`  CREATE ${taskType} ${date.toISOString().slice(0,10)} — Job ${job.jobNumber}${suffix}`)
      if (!DRY_RUN) { await prisma.scheduleEntry.create({ data }); created++ }
    }
  }

  // ── Visits ─────────────────────────────────────────────────────────────────
  const visits = await prisma.visit.findMany({
    where: { scheduledDate: { not: null } },
    select: {
      id: true, visitNumber: true, scheduledDate: true, serviceType: true,
      assignedToId: true, prospectName: true,
      client: { select: { name: true, firstName: true, lastName: true } },
    },
  })
  console.log(`\nVisits with scheduled dates: ${visits.length}`)

  for (const visit of visits) {
    const exists = await prisma.scheduleEntry.findFirst({ where: { visitId: visit.id, taskType: 'VISITA' } })
    if (exists) {
      console.log(`  SKIP  VISITA for Visit ${visit.visitNumber} (already exists)`)
      continue
    }
    const clientLabel = visit.client?.name
      || (visit.client ? `${visit.client.firstName || ''} ${visit.client.lastName || ''}`.trim() : '')
      || visit.prospectName || ''
    const serviceLabel = SERVICE_TYPE_LABELS[visit.serviceType] || visit.serviceType || ''
    const description = [clientLabel, serviceLabel].filter(Boolean).join(' — ') || 'Visita'

    console.log(`  CREATE VISITA ${visit.scheduledDate.toISOString().slice(0,10)} — ${description}`)
    if (!DRY_RUN) {
      await prisma.scheduleEntry.create({
        data: { date: visit.scheduledDate, taskType: 'VISITA', description, visitId: visit.id, assignedToId: visit.assignedToId || null },
      })
      created++
    }
  }

  console.log(`\n${DRY_RUN ? 'Would create' : 'Created'}: ${DRY_RUN ? (jobs.length * 2) + visits.length + ' (max, some may be skipped)' : created} entries`)
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
