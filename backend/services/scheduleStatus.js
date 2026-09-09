// Shared helper: derive "is this job/file currently scheduled" + earliest active date.
// Used by jobs.js, movingFiles.js, and dashboard.js list/summary endpoints.

function toDateStr(d) {
  if (!d) return null
  return new Date(d).toISOString().slice(0, 10)
}

function entryDateStr(entry) {
  return toDateStr(entry.startDate || entry.date)
}

// entries: ScheduleEntry[] (id/date/startDate/endDate selection)
function scheduleStatus(entries) {
  if (!entries || entries.length === 0) return { scheduled: false, nextScheduleDate: null }
  const dates = entries.map(entryDateStr).filter(Boolean).sort()
  return { scheduled: true, nextScheduleDate: dates[0] || null }
}

module.exports = { scheduleStatus }
