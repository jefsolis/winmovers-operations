const { getPrisma } = require('./db')

// Keys excluded from the diff (always change on every write)
const SKIP_DIFF_KEYS = new Set(['updatedAt', 'createdAt'])

function computeChangedKeys(before, after) {
  if (!before || !after) return []
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...keys].filter(k => {
    if (SKIP_DIFF_KEYS.has(k)) return false
    return JSON.stringify(before[k]) !== JSON.stringify(after[k])
  })
}

/**
 * Fire-and-forget audit logger. Never throws — errors are logged to console only.
 * @param {Request} req         Express request (provides req.user)
 * @param {string}  entityType  e.g. 'Job', 'Visit', 'Client'
 * @param {string}  entityId    Primary key of the affected record
 * @param {string}  action      'CREATE' | 'UPDATE' | 'DELETE'
 * @param {object|null} before  Snapshot before change  (null for CREATE)
 * @param {object|null} after   Snapshot after change   (null for DELETE)
 */
async function logAudit(req, entityType, entityId, action, before = null, after = null) {
  try {
    let userId = null
    let userName = req.user?.name || null
    const oid = req.user?.oid
    if (oid) {
      const staff = await getPrisma().staffMember.findUnique({
        where: { azureOid: oid },
        select: { id: true, name: true },
      })
      if (staff) {
        userId   = staff.id
        userName = staff.name
      }
    }
    const changedKeys = action === 'UPDATE' ? computeChangedKeys(before, after) : []
    await getPrisma().auditLog.create({
      data: {
        entityType,
        entityId,
        action,
        userId,
        userName,
        before: before ?? undefined,
        after:  after  ?? undefined,
        changedKeys,
      },
    })
  } catch (err) {
    console.error('[audit] logAudit error:', err.message)
  }
}

module.exports = { logAudit }
