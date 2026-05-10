/**
 * One-time migration: fix garbled accented characters in attachment filenames.
 *
 * Root cause: multer reads the Content-Disposition filename as latin1, so
 * UTF-8 multi-byte sequences (ñ, á, é, ü, etc.) get stored as mangled strings.
 *
 * Fix: re-encode the stored string as latin1 bytes, then decode as UTF-8.
 * This is safe to run multiple times — already-correct filenames are skipped.
 *
 * Run from the backend/ directory:
 *   node scripts/fix-attachment-filenames.js [--dry-run]
 */

require('dotenv').config()
const { getPrisma } = require('../db')

const DRY_RUN = process.argv.includes('--dry-run')

/**
 * Attempt to recover a mangled filename.
 * Returns the fixed string, or the original if it was already correct / not fixable.
 */
function tryFix(name) {
  const fixed = Buffer.from(name, 'latin1').toString('utf8')
  // If decoding produced Unicode replacement chars (U+FFFD), the original
  // was already valid UTF-8 — leave it alone.
  if (fixed.includes('\uFFFD')) return name
  // If nothing changed, it's pure ASCII — no fix needed.
  if (fixed === name) return name
  return fixed
}

async function main() {
  const prisma = getPrisma()
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be saved)' : 'LIVE'}`)

  const all = await prisma.attachment.findMany({ select: { id: true, filename: true } })
  console.log(`Total attachments: ${all.length}`)

  let updated = 0
  let skipped = 0

  for (const att of all) {
    const fixed = tryFix(att.filename)
    if (fixed === att.filename) {
      skipped++
      continue
    }

    console.log(`  [FIX] ${att.id}`)
    console.log(`        before: ${att.filename}`)
    console.log(`        after:  ${fixed}`)

    if (!DRY_RUN) {
      await prisma.attachment.update({ where: { id: att.id }, data: { filename: fixed } })
    }
    updated++
  }

  console.log(`\nDone. Fixed: ${updated}, already correct: ${skipped}`)
  if (DRY_RUN && updated > 0) {
    console.log('Re-run without --dry-run to apply changes.')
  }

  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
