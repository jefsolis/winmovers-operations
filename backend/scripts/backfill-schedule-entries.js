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

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN — no DB writes ===' : '=== LIVE RUN ===')

  let created = 0

  // ── Jobs ───────────────────────────────────────────────────────────────────
  const jobs = await prisma.job.findMany({
    where: { OR: [{ serviceDate: { not: null } }, { packDate: { not: null } }, { moveDate: { not: null } }] },
    select: {
      id: true,
      jobNumber: true,
      type: true,
      serviceDate: true,
      packDate: true,
      moveDate: true,
      companyName: true,
      coordinatorId: true,
      client: { select: { clientType: true, name: true, firstName: true, lastName: true } },
      corporateClient: { select: { name: true } },
    },
  })
  console.log(`\nJobs with pack/move dates: ${jobs.length}`)

  for (const job of jobs) {
    const individualName = job.client
      ? `${job.client.firstName || ''} ${job.client.lastName || ''}`.trim()
      : ''
    const clientLabel =
      (job.client?.clientType === 'INDIVIDUAL' ? (individualName || job.client?.name || '') : '') ||
      job.corporateClient?.name ||
      job.client?.name ||
      job.companyName ||
      ''

    const serviceTaskType = { EXPORT: 'EMPAQUE', IMPORT: 'DESEMPAQUE' }[job.type] || 'MUDANZA'
    const serviceDate = job.serviceDate || job.moveDate || job.packDate
    for (const [taskType, date] of [[serviceTaskType, serviceDate]]) {
      if (!date) continue
      const exists = await prisma.scheduleEntry.findFirst({ where: { jobId: job.id, taskType } })
      if (exists) {
        const nextDescription = clientLabel || 'Sin cliente'
        if (exists.description !== nextDescription) {
          console.log(`  UPDATE ${taskType} ${date.toISOString().slice(0,10)} — Job ${job.jobNumber} — ${nextDescription}`)
          if (!DRY_RUN) {
            await prisma.scheduleEntry.update({
              where: { id: exists.id },
              data: {
                description: nextDescription,
                date,
                startDate: date,
                endDate: date,
                assignedToId: job.coordinatorId || null,
              },
            })
          }
        } else {
          console.log(`  SKIP  ${taskType} for Job ${job.jobNumber} (already up to date)`)
        }
        continue
      }
      const data = {
        date,
        startDate: date,
        endDate: date,
        taskType,
        description: clientLabel || 'Sin cliente',
        jobId: job.id,
        assignedToId: job.coordinatorId || null,
      }
      console.log(`  CREATE ${taskType} ${date.toISOString().slice(0,10)} — Job ${job.jobNumber} — ${clientLabel || 'Sin cliente'}`)
      if (!DRY_RUN) { await prisma.scheduleEntry.create({ data }); created++ }
    }
  }

  // NOTE: Visit sync is intentionally omitted here because ScheduleEntry no longer
  // stores a visitId relation in the current schema.
  console.log(`\n${DRY_RUN ? 'Would create/update (max)' : 'Created/updated'}: ${DRY_RUN ? jobs.length : created} job-linked entries (some may be skipped)`)
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
