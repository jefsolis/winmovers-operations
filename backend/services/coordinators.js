const CATEGORIES = ['EXPORT', 'IMPORT', 'LOCAL', 'WAREHOUSE']

// Effective coordinator of a file: its own coordinator, else the linked job's, else unassigned.
// Frontend counterpart: frontend/src/constants.js — keep both in sync.
function effectiveCoordinator(file) {
  return file?.coordinator || file?.job?.coordinator || null
}

function emptyCounts() {
  return CATEGORIES.reduce((acc, c) => ({ ...acc, [c]: 0 }), {})
}

/**
 * Groups files by effective coordinator into per-category counts.
 * Callers must pass only in-scope files (open, not deleted).
 */
function buildCoordinatorWorkload(files) {
  const byCoordinator = new Map()
  const unassigned = { coordinatorId: null, name: null, isActive: null, counts: emptyCounts(), total: 0 }

  for (const file of files) {
    const coord = effectiveCoordinator(file)
    let row = unassigned
    if (coord) {
      if (!byCoordinator.has(coord.id)) {
        byCoordinator.set(coord.id, { coordinatorId: coord.id, name: coord.name, isActive: coord.isActive, counts: emptyCounts(), total: 0 })
      }
      row = byCoordinator.get(coord.id)
    }
    if (!CATEGORIES.includes(file.category)) continue
    row.counts[file.category]++
    row.total++
  }

  const rows = [...byCoordinator.values()]
    .filter(r => r.total > 0)
    .sort((a, b) => a.name.localeCompare(b.name))

  return [...rows, unassigned]
}

module.exports = { CATEGORIES, effectiveCoordinator, buildCoordinatorWorkload }
