# Contracts: Schedule History & Job Scheduling Visibility

These are internal REST API contracts (existing endpoints extended, no new routes). All endpoints remain under the existing Express app and existing auth/role middleware; only response shapes and query parameters gain new optional fields.

## 1. `GET /api/audit` (extended)

**Existing behavior preserved**: when `entityType` + `entityId` are both provided and `entityType !== 'Job'`, behaves exactly as today.

**New behavior**: when `entityType=Job` and `entityId=<jobId>` are provided, the response additionally includes matching `ScheduleEntry` audit rows linked to that job (via `before.jobId` / `after.jobId` in the JSON snapshot), merged and sorted with the job's own rows.

### Request
```
GET /api/audit?entityType=Job&entityId={jobId}&limit=100
```

### Response
```json
{
  "total": 7,
  "entries": [
    {
      "id": "clx...",
      "entityType": "ScheduleEntry",
      "entityId": "clx...",
      "source": "Schedule",
      "action": "DELETE",
      "userId": "clx...",
      "userName": "Jane Doe",
      "before": { "jobId": "clxJOB...", "startDate": "2026-09-10T00:00:00.000Z", "taskType": "MUDANZA", "...": "..." },
      "after": null,
      "changedKeys": [],
      "createdAt": "2026-09-09T14:32:00.000Z"
    },
    {
      "id": "clx...",
      "entityType": "Job",
      "entityId": "clxJOB...",
      "source": "Job",
      "action": "CREATE",
      "userId": null,
      "userName": "System",
      "before": null,
      "after": { "...": "..." },
      "changedKeys": [],
      "createdAt": "2026-09-08T09:00:00.000Z"
    }
  ]
}
```

**New field**: `source` (`"Job"` | `"Schedule"`) — derived from `entityType`, present on every entry in every response (backward compatible — existing non-Job queries just get `source` set to the same value as before, e.g. `"Client"`, `"Visit"`, etc., which callers can ignore).

**Pagination note**: `total`/`page`/`limit` semantics apply to the merged, combined set only for the `entityType=Job` case; existing single-entity queries are unaffected.

## 2. `GET /api/jobs` (extended)

### Response (per job, new fields only)
```json
{
  "id": "clxJOB...",
  "jobNumber": "000123",
  "...": "...",
  "scheduled": true,
  "nextScheduleDate": "2026-09-10"
}
```

- `scheduled`: `boolean`, true when the job has at least one current `ScheduleEntry`.
- `nextScheduleDate`: `string | null` (ISO date, `YYYY-MM-DD`), the earliest active entry's date; used as the calendar icon's link target query param.

## 3. `GET /api/files` (extended)

### Response (per file, new fields only)
```json
{
  "id": "clxFILE...",
  "fileNumber": "E-0042",
  "...": "...",
  "scheduled": true,
  "nextScheduleDate": "2026-09-10"
}
```

Same semantics as the Jobs list, derived from `file.job.scheduleEntries` (or `false`/`null` when the file has no linked job).

## 4. `GET /api/dashboard` (files summary, extended)

The existing per-category file summary arrays (`OPEN`/`LOCAL`/`EXPORT`/`IMPORT` groupings already returned) gain the same `scheduled` / `nextScheduleDate` fields per file row, consistent with #3.

## Frontend navigation contract

- **Jobs list / Files list / Files summary calendar icon click** → `navigate('/schedule?date=' + nextScheduleDate)`.
- **`SchedulePage`** reads `date` from `useSearchParams()` on mount; if present and parseable, sets the visible month to that date and opens the day panel for that date (existing `dayPanel` state), then clears/ignores the param on subsequent internal navigation (no back-button trap).
