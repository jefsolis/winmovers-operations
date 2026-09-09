# Phase 0 Research: Schedule History & Job Scheduling Visibility

## R1. How is history currently captured, and does it already contain schedule data?

**Decision**: Reuse the existing `AuditLog` model as the single source of truth for both job-record and schedule-entry history. No new table.

**Rationale**: `backend/audit.js`'s `logAudit()` is already called for `entityType: 'ScheduleEntry'` on create/update/delete in three places:
- `backend/routes/schedule.js` (manual create/update/resolve/delete via the Schedule screen)
- `backend/services/scheduleSync.js` (automatic create/update/delete when a job's dates change, including the initial auto-generation at job creation)

Every one of these calls stores the full `ScheduleEntry` row (including `jobId`) in the JSON `before`/`after` snapshot. This means the linkage between a schedule entry and its job is already durably recorded in history — even after the entry itself is deleted or reassigned to a different job — because the JSON snapshot preserves `jobId` at the time of that specific change.

**Alternatives considered**:
- *Add a new `jobId` column to `AuditLog`*: rejected — would require a migration and a backfill decision for historical rows, and the JSON snapshot already contains everything needed for querying via Prisma JSON filters.
- *Create a dedicated `ScheduleHistory` table*: rejected — duplicates `AuditLog` responsibility and violates Constitution Principle VII (incremental, low-risk change) by introducing parallel history mechanisms.

## R2. How to query "all history for Job X, including its schedule entries" efficiently?

**Decision**: Extend `GET /api/audit` so that when `entityType=Job`, the handler issues two queries against `AuditLog` — one for `entityType='Job' AND entityId=X` (existing behavior) and one for `entityType='ScheduleEntry'` where the JSON `before` or `after` snapshot's `jobId` equals `X` — then merges and sorts both result sets by `createdAt` descending before returning, tagging each entry with a `source: 'Job' | 'Schedule'` field.

**Rationale**: Prisma supports native JSON filtering on Postgres columns via `path`/`equals`:
```js
where: {
  entityType: 'ScheduleEntry',
  OR: [
    { before: { path: ['jobId'], equals: jobId } },
    { after:  { path: ['jobId'], equals: jobId } },
  ],
}
```
This avoids raw SQL (Constitution Principle V) and reuses the existing `@@index([entityType, entityId])` / `@@index([createdAt])` indexes reasonably well since `entityType='ScheduleEntry'` is still an indexed equality filter; the JSON path filter narrows within that set. Given the audit log's expected volume for a single job (a handful of schedule changes at most), this is a cheap read.

**Alternatives considered**:
- *Client-side merge (frontend fetches both entityType=Job and entityType=ScheduleEntry&jobId=X lists separately and merges)*: rejected — `ScheduleEntry` isn't a queryable `entityId` filter (the entity id of the audit row is the schedule entry's id, not the job's id), so the frontend would need the same JSON-path knowledge; better to centralize in the backend endpoint that already exists for this exact purpose.
- *New `/api/audit/job/:id/combined` endpoint*: rejected — unnecessary new route surface when the existing generic `/api/audit` endpoint can branch on `entityType`.

## R3. How to compute "is this job/file currently scheduled" without extra round-trips?

**Decision**: Add `scheduleEntries: { select: { id: true, startDate: true, endDate: true, date: true } }` to the existing `include` in `GET /api/jobs` (list) and, transitively via `job.scheduleEntries`, to `GET /api/files` (list). Compute `scheduled: entries.length > 0` and `nextScheduleDate` (earliest active entry's date) in the response — either in the route handler (mapping over results) or left as raw `scheduleEntries` for the frontend to derive, matching whichever is simpler to keep consistent between Jobs and Files list rendering.

**Rationale**: Both list endpoints already return the full un-paginated result set in one query (no existing pagination to preserve), so adding a `scheduleEntries` selection is a single additional `include` — no N+1, no second request. "Active" schedule entries are simply the rows that still exist (the delete route performs a hard delete), so "has at least one row" is sufficient — no soft-delete flag exists on `ScheduleEntry` to check.

**Alternatives considered**:
- *Separate `/api/jobs/scheduled-status` batch endpoint*: rejected — adds a second round-trip per list render, unnecessary given the include is essentially free.
- *Computing scheduled status only in the frontend from a fetched schedule range*: rejected — the Jobs/Files lists aren't scoped to a date range, so this would require fetching all schedule entries separately; simpler to include directly on the entity.

## R4. How should the calendar icon navigate to "the schedule day"?

**Decision**: Add an optional query param to the Schedule route, e.g. `/schedule?date=YYYY-MM-DD`, read by `SchedulePage.jsx` on mount to set its `year`/`month` state to that date's month and open the existing day panel (`dayPanel` state) for that specific date, reusing the current calendar/list view rather than building a new "day view" screen.

**Rationale**: `SchedulePage.jsx` already has a `dayPanel` (dateStr) state used when a user clicks a day cell in the calendar view; reusing it avoids building new UI. `useSearchParams` from `react-router-dom` (already a dependency) is the natural way to read the link's `date` param without prop drilling from `App.jsx`.

**Alternatives considered**:
- *Route param `/schedule/:date`*: rejected — Schedule is a single persistent screen with internal month/day state; a path param would require restructuring routing for a single deep-link use case where a query param is simpler and non-breaking.

## R5. i18n additions needed

**Decision**: Add new keys to both `en` and `es` maps in `frontend/src/i18n.jsx`:
- `audit.sourceJob` / `audit.sourceSchedule` (origin badge labels)
- `jobs.scheduledTooltip` / `jobs.notScheduledTooltip` (calendar icon tooltips, reused by Files list/summary)

**Rationale**: Matches Constitution Principle I — every new web string must exist in both language maps and be referenced via `t(...)`.
