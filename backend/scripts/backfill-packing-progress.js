const { getPrisma } = require('../db')

async function main() {
  const prisma = getPrisma()
  const completed = await prisma.packingList.updateMany({
    where: { status: { in: ['CLOSED', 'COMPLETE'] }, progressStatus: { not: 'COMPLETED' } },
    data: { progressStatus: 'COMPLETED' },
  })
  const notStarted = await prisma.packingList.updateMany({
    where: {
      status: { notIn: ['CLOSED', 'COMPLETE'] },
      progressStatus: { notIn: ['NOT_STARTED', 'TRAVELING', 'WORKING', 'COMPLETED'] },
    },
    data: { progressStatus: 'NOT_STARTED' },
  })

  console.log(`Packing progress backfill complete: ${completed.count} completed, ${notStarted.count} normalized`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await getPrisma().$disconnect()
  })