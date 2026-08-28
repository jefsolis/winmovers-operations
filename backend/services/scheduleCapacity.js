const { getPrisma } = require('../db')

const SETTING_ID = 'default'
const DEFAULT_CAPACITY = 30
const SUGGESTION_SEARCH_WINDOW_DAYS = 60
const MAX_SUGGESTIONS = 3

function pad2(n) { return String(n).padStart(2, '0') }
function toDateOnlyUTC(d) {
  const date = new Date(d)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}
function toDateStr(d) {
  const date = toDateOnlyUTC(d)
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}
function addDays(date, days) {
  const d = toDateOnlyUTC(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

// Returns the list of consecutive calendar days (Date objects, UTC midnight) a job spans.
function spanDays(startDate, days) {
  const count = Math.max(1, parseInt(days, 10) || 1)
  const start = toDateOnlyUTC(startDate)
  const out = []
  for (let i = 0; i < count; i++) out.push(addDays(start, i))
  return out
}

async function getScheduleSetting() {
  const db = getPrisma()
  const existing = await db.scheduleSetting.findUnique({ where: { id: SETTING_ID } })
  if (existing) return existing
  return db.scheduleSetting.upsert({
    where: { id: SETTING_ID },
    update: {},
    create: { id: SETTING_ID, dailyWorkerCapacity: DEFAULT_CAPACITY },
  })
}

async function setScheduleSetting(dailyWorkerCapacity, updatedByStaffId = null) {
  const db = getPrisma()
  return db.scheduleSetting.upsert({
    where: { id: SETTING_ID },
    update: { dailyWorkerCapacity, updatedByStaffId },
    create: { id: SETTING_ID, dailyWorkerCapacity, updatedByStaffId },
  })
}

// Total workers already committed on a given day, optionally excluding one schedule entry (for updates).
async function committedWorkersForDay(day, excludeEntryId = null) {
  const db = getPrisma()
  const dayStr = toDateStr(day)
  const dayStart = new Date(`${dayStr}T00:00:00.000Z`)
  const dayEnd = new Date(`${dayStr}T23:59:59.999Z`)

  const entries = await db.scheduleEntry.findMany({
    where: {
      AND: [
        { OR: [{ startDate: { lte: dayEnd } }, { date: { lte: dayEnd } }] },
        { OR: [{ endDate: { gte: dayStart } }, { date: { gte: dayStart } }] },
      ],
      ...(excludeEntryId ? { id: { not: excludeEntryId } } : {}),
    },
    select: { jobId: true, personalCount: true },
  })

  const jobIds = [...new Set(entries.map(e => e.jobId).filter(Boolean))]
  let total = entries
    .filter(e => !e.jobId)
    .reduce((sum, e) => sum + (e.personalCount || 0), 0)
  if (jobIds.length) {
    const jobs = await db.job.findMany({ where: { id: { in: jobIds } }, select: { personalCount: true } })
    total += jobs.reduce((sum, j) => sum + (j.personalCount || 0), 0)
  }
  return total
}

// Remaining capacity for each day in [startDate, startDate + days - 1].
async function getRemainingCapacityForSpan(startDate, days, excludeEntryId = null) {
  const setting = await getScheduleSetting()
  const daysArr = spanDays(startDate, days)
  const result = []
  for (const day of daysArr) {
    const committed = await committedWorkersForDay(day, excludeEntryId)
    result.push({ date: toDateStr(day), committed, remaining: setting.dailyWorkerCapacity - committed })
  }
  return { capacity: setting.dailyWorkerCapacity, days: result }
}

// Checks whether every day in the span has enough remaining capacity for workersRequired.
async function checkCapacityForSpan(startDate, days, workersRequired, excludeEntryId = null) {
  const { capacity, days: dayResults } = await getRemainingCapacityForSpan(startDate, days, excludeEntryId)
  const fits = dayResults.every(d => d.remaining >= workersRequired)
  return { capacity, days: dayResults, fits }
}

// Searches outward (forward then backward alternating) for the closest span that fits.
async function findClosestAvailableSpan(startDate, days, workersRequired, excludeEntryId = null) {
  const suggestions = []
  for (let offset = 1; offset <= SUGGESTION_SEARCH_WINDOW_DAYS && suggestions.length < MAX_SUGGESTIONS; offset++) {
    for (const dir of [1, -1]) {
      const candidateStart = addDays(startDate, offset * dir)
      const { fits } = await checkCapacityForSpan(candidateStart, days, workersRequired, excludeEntryId)
      if (fits) {
        const candidateEnd = addDays(candidateStart, Math.max(1, parseInt(days, 10) || 1) - 1)
        suggestions.push({ startDate: toDateStr(candidateStart), endDate: toDateStr(candidateEnd) })
        if (suggestions.length >= MAX_SUGGESTIONS) break
      }
    }
  }
  return suggestions
}

module.exports = {
  DEFAULT_CAPACITY,
  getScheduleSetting,
  setScheduleSetting,
  getRemainingCapacityForSpan,
  checkCapacityForSpan,
  findClosestAvailableSpan,
  spanDays,
  toDateStr,
}
