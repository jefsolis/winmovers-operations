# Phase 1 Data Model: Schedule History & Job Scheduling Visibility

No new tables, columns, or migrations are introduced by this feature. It is a read-composition and derived-status feature layered over existing Prisma models.

## Existing entities reused

### AuditLog (unchanged schema)

| Field | Type | Notes |
|---|---|---|
| `entityType` | String | `"Job"` or `"ScheduleEntry"` rows are both relevant to the combined Job history view |
| `entityId` | String | For `ScheduleEntry` rows, this is the schedule entry's id — **not** the job id |
| `action` | String | `CREATE` \| `UPDATE` \| `DELETE` |
| `userId` / `userName` | String? | Null + no `userName` fallback represents a system/automated change (e.g. `scheduleSync.js` running without a `req`) |
| `before` / `after` | Json? | For `ScheduleEntry` rows, contains the full entry snapshot including `jobId`, `date`/`startDate`/`endDate`, `taskType`, `assignedToId`, etc. |
| `changedKeys` | String[] | Already computed for `UPDATE` actions |
| `createdAt` | DateTime | Used for chronological ordering across both sources |

**New derived field (response-only, not persisted)**: `source` — `"Job"` when `entityType === 'Job'`, `"Schedule"` when `entityType === 'ScheduleEntry'`. Computed in the `GET /api/audit` handler when merging, never stored.

### Job (unchanged schema)

Existing relation used: `scheduleEntries: ScheduleEntry[]`.

**New derived field (list-response-only, not persisted)**:
- `scheduled: boolean` — `true` when `job.scheduleEntries.length > 0`.
- `nextScheduleDate: string | null` — the earliest `startDate ?? date` among the job's `scheduleEntries`, used as the calendar icon's link target.

### MovingFile (unchanged schema)

Existing relation used: `job: Job?` (nullable — some file categories/legacy records may have no linked job).

**New derived field (list-response-only, not persisted)**:
- `scheduled: boolean` — `true` when `file.job?.scheduleEntries?.length > 0`; `false` (not scheduled) when the file has no linked job or the linked job has no active schedule entries. This reuses the same underlying signal as the Job entity — no independent schedule-entry-to-file linkage exists or is introduced.
- `nextScheduleDate: string | null` — mirrors the job's `nextScheduleDate`, or `null` if unscheduled/no job.

### ScheduleEntry (unchanged schema)

No changes. Its existing `jobId` field is what both the combined-history join (via JSON snapshot) and the derived `scheduled` flag (via the live relation) key off of.

## State / derivation rules

- **Job Scheduled Status** = `EXISTS(ScheduleEntry WHERE jobId = job.id)`. This is a live relational check (current DB state), independent of audit history. A job that once had a schedule entry deleted is **not** scheduled, even though its history still shows the entry existed.
- **File Scheduled Status** = `job == null ? false : Job Scheduled Status(job)`.
- **Combined Job History** = `AuditLog[entityType='Job', entityId=job.id] ∪ AuditLog[entityType='ScheduleEntry', jobId (from before/after JSON) = job.id]`, sorted by `createdAt DESC`. This is a point-in-time historical view and is **not** filtered by current schedule state — deleted/reassigned schedule entries still appear (that is the whole point of FR-011).

## No migration required

`npx prisma db push` / `npx prisma generate` are **not** needed for this feature since `schema.prisma` is unchanged.
