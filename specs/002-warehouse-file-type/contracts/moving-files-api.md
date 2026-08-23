# Moving Files API — Contract Delta: WAREHOUSE category

**Feature**: 002-warehouse-file-type
**Date**: 2026-08-03
**Scope**: Additive change to `backend/routes/movingFiles.js`.
No breaking changes to existing EXPORT/IMPORT/LOCAL behavior.

---

## New accepted `category` value

| Value | Meaning | File number format |
|-------|---------|-------------------|
| `"WAREHOUSE"` | Long-term client storage file | `B-XXXX` (e.g. `B-0001`) |

---

## POST /api/files (create)

**Request body delta** — `category` now accepts `"WAREHOUSE"`:

```jsonc
{
  "category": "WAREHOUSE",      // NEW valid value
  "clientId": "...",            // optional — individual client
  "corporateClientId": "...",   // optional — corporate client
  "coordinatorId": "...",       // optional
  "notes": "...",               // optional
  "fechaEntrega": "2026-09-01", // optional — used as service date for schedule entry
  // ...other existing optional fields unchanged
}
```

**Side effects (new for WAREHOUSE)**:

1. A WAREHOUSE Job is auto-created, linked via `movingFileId`, with
   `jobNumber` = the new file's `B-XXXX` number.
2. `syncJobScheduleEntries(job, req)` is called fire-and-forget. If
   `fechaEntrega` (or `eta`) is set, a schedule entry of type `BODEGAJE`
   is created for the job.

**Response**: Returns the created `MovingFile` object (same shape as existing
categories). The auto-created Job is not included in the response but is
immediately queryable via `GET /api/jobs`.

**Authorization**: Requires valid JWT + `forbidBodegaWrite` middleware (unchanged).

---

## PUT /api/files/:id (update)

No contract change beyond the fact that a WAREHOUSE file can now be updated.
Full-object PUT convention applies (send the full file body on every update).

---

## GET /api/files and GET /api/files/:id (read)

- Returned file objects for WAREHOUSE category include `fileNumber` in `B-XXXX`
  format and `category: "WAREHOUSE"`.
- The list endpoint already supports `?category=WAREHOUSE` filtering via the
  existing query parameter pattern.

---

## Error handling

No new error conditions beyond existing patterns. If WAREHOUSE Job auto-creation
fails, the error is logged and the file creation response still returns 201
(fire-and-forget side effect, consistent with coordinator notification pattern).
