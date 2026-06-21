# WT-LB-02 Production Runbook

This runbook explains exactly how to run the historical weight conversion in production.

**For Azure-specific execution instructions, see [docs/WT_LB_02_AZURE_EXECUTION_GUIDE.md](WT_LB_02_AZURE_EXECUTION_GUIDE.md).**

Scope:
- Converts historical weight values from KG to LB in Job and MovingFile records.
- Uses guarded, idempotent logic (safe to re-run).
- Marks converted rows so they are never converted twice.

Conversion formula:
- LB = KG * 2.2046226218

---

## 1) Pre-requisites

Before you start:
- Confirm you are on the latest main branch in this repository.
- Confirm production app is already running WT-LB-01 code (all UI/API semantics already in LB).
- Confirm production environment has a valid DATABASE_URL.
- Confirm backend dependencies are installed.
- Confirm you have permissions to run Prisma schema update and conversion scripts.

Files involved:
- backend/prisma/schema.prisma
- backend/scripts/convert-weights-kg-to-lb.js
- backend/package.json

---

## 2) Safety First: Backup and Change Window

Use a low-traffic maintenance window.

Minimum recommendation:
1. Take a full PostgreSQL backup immediately before conversion.
2. Announce maintenance period to operations users.
3. Avoid concurrent bulk imports during the conversion.

Example backup approach with pg_dump:
1. Set DATABASE_URL to production value.
2. Run:
   pg_dump --format=custom --file=backup_pre_wt_lb_02.dump "DATABASE_URL"

If your team uses managed snapshots (cloud provider), take a database snapshot as well.

Do not continue unless backup is confirmed and restorable.

---

## 3) Deploy Code and Schema Markers

The conversion relies on these new fields:
- weightUnit
- weightConvertedAt

From backend folder:
1. npx prisma db push
2. npx prisma generate

If Prisma generate fails on Windows with EPERM lock, run:
1. Remove-Item -Recurse -Force node_modules/.prisma/client
2. npx prisma generate

Verify application can still start after schema update.

---

## 4) Dry Run in Production (No Data Changes)

From backend folder:
1. npm run weights:convert:dry

Expected output sections:
- Pre-run stats
- Run results
- Post-run remaining eligible rows
- Summary

What to check:
- failed should be 0
- converted in dry-run is only a simulation count
- eligible values should match your expectation for historical KG rows

If counts look wrong, stop and investigate before apply.

---

## 5) Apply Conversion

From backend folder:
1. npm run weights:convert:apply

Expected outcome:
- converted greater than 0 (if historical rows exist)
- failed equals 0
- post-run eligible equals 0

This sets per converted row:
- weightKg = converted LB value
- weightUnit = LB
- weightConvertedAt = current timestamp

---

## 6) Idempotency Check (Mandatory)

Immediately after apply, run dry-run again:
1. npm run weights:convert:dry

Expected outcome:
- converted = 0
- eligible = 0
- failed = 0

If this is true, the migration is idempotent and complete.

---

## 7) Functional Verification Checklist

After conversion, verify in production UI/API:
1. Create a new file with weight and verify it is treated as LB.
2. Edit an existing file weight and verify it is treated as LB.
3. Open Job detail and File detail pages and confirm unit labels show LB.
4. Check dashboard pound report totals for expected changes.
5. Confirm no errors in server logs related to weight fields.

Optional database spot checks:
- Sample converted rows where weightConvertedAt is not null.
- Confirm weightUnit is LB for converted rows.
- Confirm post-cutover records are not converted unexpectedly.

---

## 8) Rollback Plan

If critical issue is detected:
1. Put app in maintenance mode or block writes.
2. Restore database from pre-conversion backup/snapshot.
3. Redeploy last known-good app version if needed.
4. Validate app health and data consistency.
5. Re-plan conversion with corrected script/cutover settings.

Do not attempt manual partial reverse updates in production unless approved by DB owner.

---

## 9) Script Options Reference

Script:
- backend/scripts/convert-weights-kg-to-lb.js

Supported options:
- --apply
  - Executes updates. Without this flag, script runs in dry mode.
- --cutover=YYYY-MM-DDTHH:mm:ssZ
  - Converts only records created before cutover.
  - Default is 2026-06-21T00:00:00.000Z.
- --batchSize=NUMBER
  - Batch size for processing. Default 500.

Examples:
- Dry run default cutover:
  npm run weights:convert:dry
- Apply default cutover:
  npm run weights:convert:apply
- Custom cutover and batch size:
  node scripts/convert-weights-kg-to-lb.js --apply --cutover=2026-06-21T00:00:00Z --batchSize=250

---

## 10) Sign-off Template

Record this after production run:
- Date/time:
- Operator:
- Backup ID or snapshot ID:
- Dry-run pre-check counts:
- Apply counts (converted, failed):
- Dry-run post-check counts:
- Verification checklist completed by:
- Final status: SUCCESS or ROLLED BACK
