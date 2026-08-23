# Phase 0 Research: Warehouse File Type and Packing Item Type Management

**Feature**: 002-warehouse-file-type
**Date**: 2026-08-03

All `NEEDS CLARIFICATION` items resolved through codebase exploration. Decisions
below are grounded in the actual patterns found in the codebase.

---

## Decision 1: WAREHOUSE auto-numbering — extend `CATEGORY_PREFIX` map

- **Decision**: Add `WAREHOUSE: "B"` to the existing `CATEGORY_PREFIX` object at
  the top of `backend/routes/movingFiles.js`. The shared `generateFileNumber(category)`
  function already handles any prefix: it finds the last file with that prefix, reads
  an optional `systemSetting` seed, and returns `<prefix>-<zero-padded-4-digits>`.
  The WAREHOUSE variant is `B-0001`, `B-0002`, etc.
- **Rationale**: The numbering function is already category-generic; adding WAREHOUSE
  is a one-line change that requires no new function.
- **Alternatives considered**: A dedicated `generateWarehouseFileNumber()` — rejected;
  that would duplicate logic the shared function already handles.

---

## Decision 2: WAREHOUSE file creation — standalone POST, no auto-job trigger in movingFiles route

- **Decision**: The `POST /api/files` handler creates the Warehouse File. The
  auto-created WAREHOUSE Job is created **inside the movingFiles POST handler** as a
  side effect (same pattern as how Export files trigger job auto-creation in `jobs.js`
  in reverse). Specifically: after the Warehouse File is persisted, the handler calls
  `getPrisma().job.create(...)` for a WAREHOUSE job, links it via `movingFileId`,
  then calls `syncJobScheduleEntries` fire-and-forget.
- **Rationale**: Export/Local job auto-creation currently lives in `jobs.js` (jobs
  create the file). For Warehouse the inverse is true (the file creates the job),
  so the side effect belongs in `movingFiles.js` POST. This keeps each route
  responsible for the records it initiates.
- **Job number for WAREHOUSE**: Uses a new `generateWarehouseJobNumber()` function
  following the same pattern as `generateImportJobNumber()` — queries for the last
  job number starting with `"B-"` and increments. (Import uses `"D-"`, Local
  auto-creates files whose number becomes the job number — WAREHOUSE follows the
  Import-style standalone job number since the file already has the `B-` number.)
  Actually, the job number for a WAREHOUSE job will reuse the same file number
  (same as EXPORT pattern where `jobNumber = fileNumber`). Confirmed consistent
  with constitution Principle VI (existing numbering convention: job and file share
  the same `B-XXXX` number).
- **Alternatives considered**: Triggering job creation from the frontend with two
  API calls — rejected; would leave orphaned files if the second call fails.

---

## Decision 3: Schedule entry for WAREHOUSE jobs — reuse `syncJobScheduleEntries`

- **Decision**: Call `syncJobScheduleEntries(job, req)` fire-and-forget after the
  WAREHOUSE job is created, identical to how it's called after every other job
  create/update. The `taskType` mapping in `scheduleSync.js` currently maps
  `EXPORT→EMPAQUE, IMPORT→DESEMPAQUE, other→MUDANZA`. WAREHOUSE jobs will fall
  into the `other` → `MUDANZA` bucket unless we add a dedicated mapping.
  Adding `WAREHOUSE: 'ALMACENAJE'` (or similar) is desirable but is noted as
  optional in this iteration — the spec only requires schedule entry creation on
  the service date, not a new task type label.
- **Rationale**: Zero new infrastructure; one optional string addition to the
  `taskType` map.

---

## Decision 4: WAREHOUSE job type — add to `TYPE_META` and `TYPE_VALUES` in constants.js

- **Decision**: Add `WAREHOUSE` to `TYPE_VALUES` array and `TYPE_META` object in
  `frontend/src/constants.js` with a distinct colour pair (e.g. amber/brown tones,
  distinct from DOMESTIC which is yellow). Add i18n keys `types.WAREHOUSE` in both
  `en` ("Warehouse") and `es` ("Bodega").
- **Rationale**: All existing job type filters, badges, and dropdowns are driven
  by these two structures; adding WAREHOUSE there automatically propagates it to
  every job list, filter chip, and type badge.

---

## Decision 5: PackingItemType — new Prisma model, separate route file

- **Decision**: New `PackingItemType` model with `id` (cuid), `nameEs` (String),
  `nameEn` (String), `active` (Boolean, default true), `createdAt`, `updatedAt`.
  Both name fields are required: `nameEs` is used in Spanish-language packing list
  PDFs and UI; `nameEn` is used in English-language PDFs and UI. New route file
  `backend/routes/packingItemTypes.js` mounted at `/api/packing-item-types` in
  `backend/index.js`. Endpoints: `GET /` (public to authenticated users, returns
  active only, sorted by nameEs), `POST /` (admin write, create), `PUT /:id` (admin
  write, update names), `PATCH /:id/deactivate` (admin write, set active=false).
  All write endpoints guarded by `forbidBodegaWrite` middleware.
- **Rationale**: Packing list PDFs can be sent in either EN or ES (see feature spec).
  Storing both names in the catalog avoids any translation step at render time — the
  PDF renderer simply picks `nameEn` or `nameEs` based on the job's `language` field.
- **Alternatives considered**:
  - Single `name` field (Spanish only) — rejected; would require translation at PDF
    generation time with no reliable mechanism.
  - i18n key reference stored in DB — rejected; overly complex for a simple catalog.

---

## Decision 6: Admin UI — new `PackingItemTypesPage.jsx` under Admin section

- **Decision**: New page at `frontend/src/pages/Admin/PackingItemTypes/PackingItemTypesPage.jsx`,
  registered in `App.jsx` at `/admin/packing-item-types` wrapped in `<RequireAdmin>`.
  Linked from `AdminPage.jsx` navigation. Inline create/edit (no separate form page
  since item types have only one field — name).
- **Rationale**: Follows the exact pattern of `AuditLogPage.jsx` and `FidiReport`
  which are also admin-only routes wrapped in `<RequireAdmin>`.

---

## Decision 7: FilesList / FileForm — WAREHOUSE as a fourth category option

- **Decision**: `FileForm.jsx` category selector gains WAREHOUSE as an option.
  `FilesList.jsx` gains a WAREHOUSE filter chip. The Files navigation in `Layout.jsx`
  currently has separate links for Export, Import, Local — a Warehouse link is added.
  `FileDetail.jsx` needs no structural change since it reads category dynamically.
- **Rationale**: The category is already a string field; the list/form/detail
  components are all driven by the category value.

---

## Open Questions

None. All items resolved.
