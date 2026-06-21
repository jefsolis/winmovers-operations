const { getPrisma } = require('../db')

const KG_TO_LB = 2.2046226218
const DEFAULT_CUTOVER = '2026-06-21T00:00:00.000Z'

function parseArg(name) {
  const prefix = `${name}=`
  const hit = process.argv.find(a => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : null
}

function toDateOrNull(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function buildEligibleWhere(cutover) {
  return {
    weightKg: { not: null },
    createdAt: { lt: cutover },
    weightConvertedAt: null,
    OR: [{ weightUnit: null }, { weightUnit: 'KG' }],
  }
}

async function collectStats(modelName, cutover) {
  const prisma = getPrisma()
  const model = prisma[modelName]

  const total = await model.count()
  const nonNullWeight = await model.count({ where: { weightKg: { not: null } } })
  const postCutover = await model.count({ where: { weightKg: { not: null }, createdAt: { gte: cutover } } })
  const alreadyConverted = await model.count({
    where: {
      weightKg: { not: null },
      OR: [{ weightConvertedAt: { not: null } }, { weightUnit: 'LB' }],
    },
  })
  const eligible = await model.count({ where: buildEligibleWhere(cutover) })

  return {
    modelName,
    total,
    nonNullWeight,
    skippedNull: total - nonNullWeight,
    skippedPostCutover: postCutover,
    skippedAlreadyConverted: alreadyConverted,
    eligible,
  }
}

async function processModel(modelName, cutover, apply, batchSize) {
  const prisma = getPrisma()
  const model = prisma[modelName]
  const where = buildEligibleWhere(cutover)

  let cursorId = null
  let converted = 0
  let failed = 0

  while (true) {
    const rows = await model.findMany({
      where,
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      select: { id: true, weightKg: true },
    })

    if (!rows.length) break

    for (const row of rows) {
      const oldWeight = Number(row.weightKg)
      if (!Number.isFinite(oldWeight)) {
        failed += 1
        continue
      }

      const convertedWeight = Number((oldWeight * KG_TO_LB).toFixed(6))

      if (!apply) {
        converted += 1
        continue
      }

      try {
        await model.update({
          where: { id: row.id },
          data: {
            weightKg: convertedWeight,
            weightUnit: 'LB',
            weightConvertedAt: new Date(),
          },
        })
        converted += 1
      } catch (_err) {
        failed += 1
      }
    }

    cursorId = rows[rows.length - 1].id
    if (rows.length < batchSize) break
  }

  return { modelName, converted, failed }
}

async function main() {
  const apply = process.argv.includes('--apply')
  const cutoverRaw = parseArg('--cutover') || DEFAULT_CUTOVER
  const batchSizeRaw = parseArg('--batchSize')
  const batchSize = Number(batchSizeRaw || 500)
  const cutover = toDateOrNull(cutoverRaw)

  if (!cutover) {
    console.error('Invalid --cutover date. Example: --cutover=2026-06-21T00:00:00Z')
    process.exit(1)
  }
  if (!Number.isFinite(batchSize) || batchSize < 1) {
    console.error('Invalid --batchSize. Example: --batchSize=500')
    process.exit(1)
  }

  const mode = apply ? 'APPLY' : 'DRY_RUN'
  console.log(`WT-LB-02 mode=${mode} cutover=${cutover.toISOString()} batchSize=${batchSize}`)

  const models = ['movingFile', 'job']
  const beforeStats = []
  for (const modelName of models) {
    beforeStats.push(await collectStats(modelName, cutover))
  }

  console.log('Pre-run stats:')
  for (const s of beforeStats) {
    console.log(`- ${s.modelName}: total=${s.total}, eligible=${s.eligible}, skippedNull=${s.skippedNull}, skippedPostCutover=${s.skippedPostCutover}, skippedAlreadyConverted=${s.skippedAlreadyConverted}`)
  }

  const runResults = []
  for (const modelName of models) {
    runResults.push(await processModel(modelName, cutover, apply, batchSize))
  }

  const afterStats = []
  for (const modelName of models) {
    afterStats.push(await collectStats(modelName, cutover))
  }

  console.log('Run results:')
  for (const r of runResults) {
    console.log(`- ${r.modelName}: converted=${r.converted}, failed=${r.failed}`)
  }

  console.log('Post-run remaining eligible rows:')
  for (const s of afterStats) {
    console.log(`- ${s.modelName}: eligible=${s.eligible}`)
  }

  const totals = runResults.reduce((acc, r) => {
    acc.converted += r.converted
    acc.failed += r.failed
    return acc
  }, { converted: 0, failed: 0 })

  console.log(`Summary: converted=${totals.converted}, failed=${totals.failed}, mode=${mode}`)
}

main()
  .catch(err => {
    console.error('WT-LB-02 failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    try {
      await getPrisma().$disconnect()
    } catch (_err) {}
  })
