# Tasks: Warehouse File Type and Packing Item Type Management

**Feature**: `002-warehouse-file-type` | **Branch**: `002-warehouse-file-type`
**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [research.md](./research.md), [quickstart.md](./quickstart.md)

## Format: `[ID] [P?] [Story?] Description — file path`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[US#]**: User story this task belongs to

---

## Phase 1: Foundational (Shared Infrastructure)

**Purpose**: Blocking prerequisites for ALL user stories. Complete before starting
any Phase 2+ work. T001–T003 must be sequential; T004–T006 are parallel with each other.

**⚠️ CRITICAL**: No user story work can begin until T001–T006 are complete.

- [X] T001 Add `WAREHOUSE: "B"` to `CATEGORY_PREFIX` object at the top of `backend/routes/movingFiles.js`
- [X] T002 Add `PackingItemType` model (`id` cuid PK, `nameEs` String, `nameEn` String, `active` Boolean default true, `createdAt`, `updatedAt`) to `backend/prisma/schema.prisma`
- [X] T003 Run `npx prisma db push` then `npx prisma generate` from `backend/` (stop backend process first to release DLL lock) — depends on T002
- [X] T004 [P] Add `WAREHOUSE: 'ALMACENAJE'` entry to the `taskType` map in `backend/services/scheduleSync.js`
- [X] T005 [P] Add `'WAREHOUSE'` to `TYPE_VALUES` array and add `WAREHOUSE` entry to `TYPE_META` color map (amber tones, distinct from DOMESTIC yellow) in `frontend/src/constants.js`
- [X] T006 [P] Add all new i18n keys to both `en` and `es` objects in `frontend/src/i18n.jsx`: `types.WAREHOUSE` ("Warehouse"/"Bodega"), `movingFiles.warehouseTitle` ("Warehouse Files"/"Archivos de Bodega"), and full `packingItemTypes.*` namespace (page title, table headers for nameEs/nameEn, active/inactive labels, create/edit/deactivate button labels, confirmations)

**Checkpoint**: Schema pushed, Prisma client regenerated, shared constants and i18n updated.
User story implementation can begin in parallel after this point.

---

## Phase 2: User Story 1 — Create and manage a Warehouse Moving File (Priority: P1) 🎯 MVP

**Goal**: Staff can create Warehouse Files via the web app, receive a B-XXXX
auto-assigned number, see the file in the Files list, open/edit it, and close it.

**Independent Test**: Create a Warehouse File → confirm B-XXXX number → confirm it
appears in Files list → confirm OPEN status → change to CLOSED and save → confirm CLOSED.

- [X] T007 [US1] In `backend/routes/movingFiles.js` POST handler: confirm WAREHOUSE flows through `generateFileNumber('WAREHOUSE')` correctly using the T001 prefix addition; ensure `status` defaults to `'OPEN'` for WAREHOUSE files; ensure PUT handler allows OPEN/CLOSED status transitions for WAREHOUSE — depends on T001
- [X] T008 [P] [US1] Add `WAREHOUSE` as a selectable category option in the category `<select>` in `frontend/src/pages/Files/FileForm.jsx`; ensure category defaults to `'WAREHOUSE'` when URL param `?category=WAREHOUSE` is present
- [X] T009 [P] [US1] Add WAREHOUSE filter chip/tab to `frontend/src/pages/Files/FilesList.jsx` alongside the existing EXPORT/IMPORT/LOCAL chips; ensure `?category=WAREHOUSE` query string is passed correctly
- [X] T010 [P] [US1] Add a "Warehouse" nav link in `frontend/src/components/Layout.jsx` pointing to `/files?category=WAREHOUSE`
- [X] T011 [US1] Review `frontend/src/pages/Files/FileDetail.jsx` close-guard logic: WAREHOUSE files must NOT require volume/weight validation before closing (that check currently guards IMPORT/EXPORT only — confirm WAREHOUSE is excluded)

**Checkpoint**: Warehouse Files can be fully created, listed, opened, and closed through the web UI with correct B-XXXX numbering.

---

## Phase 3: User Story 2 — Warehouse Job Auto-Creation (Priority: P2)

**Goal**: A WAREHOUSE Job is auto-created and linked when a Warehouse File is saved;
a schedule entry is created if a service date is provided.

**Independent Test**: Create a Warehouse File with a service date → navigate to Jobs →
confirm WAREHOUSE job exists with the same B-XXXX number and a schedule entry.

- [X] T012 [US2] In `backend/routes/movingFiles.js` POST handler, after the Warehouse File is persisted: call `getPrisma().job.create(...)` with `{ jobNumber: fileNumber, type: 'WAREHOUSE', status: 'SURVEY', clientId, corporateClientId, movingFileId: file.id, coordinatorId, serviceDate: fechaEntrega || eta || null, language: 'EN' }`; then call `syncJobScheduleEntries(job, req)` fire-and-forget; wrap in try/catch — job failure must not roll back file creation — depends on T007, T004
- [X] T013 [P] [US2] In `backend/routes/jobs.js`: confirm GET list query and GET /:id query do not filter out WAREHOUSE type; add `'WAREHOUSE'` to any explicit type allowlists in the job creation/update validators if they exist

**Checkpoint**: Creating a Warehouse File in the UI produces a linked WAREHOUSE Job visible in the Jobs list, and a schedule entry on the service date.

---

## Phase 4: User Story 3 — Admin Manages Packing Item Type Catalog (Priority: P3)

**Goal**: Admin users can create, edit, and soft-deactivate Packing Item Types
(each with `nameEs` + `nameEn`) through a dedicated admin page; non-admins are blocked.

**Independent Test**: Log in as ADMIN → navigate to Admin → Packing Item Types → create
an entry with both names → edit names → deactivate → confirm deactivated entry is absent
from `GET /api/packing-item-types` response.

- [X] T014 [P] [US3] Create `backend/routes/packingItemTypes.js` with five endpoints — depends on T003:
  - `GET /` — returns `active: true` only, sorted by `nameEs` asc, requires JWT
  - `GET /all` — returns all entries regardless of active, requires JWT (admin UI)
  - `POST /` — creates new item type (`nameEs`, `nameEn` required, non-empty), guarded by `forbidBodegaWrite`, logs audit entry
  - `PUT /:id` — updates `nameEs` and `nameEn`, guarded by `forbidBodegaWrite`, logs audit entry
  - `PATCH /:id/deactivate` — sets `active = false`, guarded by `forbidBodegaWrite`, logs audit entry
- [X] T015 [US3] Register `/api/packing-item-types` in `backend/index.js` with `app.use('/api/packing-item-types', require('./routes/packingItemTypes'))` — mount it BEFORE the `/api/files/:fileId/attachments` and `/api/files` lines — depends on T014
- [X] T016 [P] [US3] Create `frontend/src/pages/Admin/PackingItemTypes/PackingItemTypesPage.jsx`: shows table of all item types (nameEs, nameEn, active badge); inline form row for creating new item (two inputs: nameEs + nameEn); edit-in-place or edit button per row; deactivate button per active row; uses `GET /api/packing-item-types/all` for the admin view — depends on T006
- [X] T017 [P] [US3] Add `/admin/packing-item-types` route to `frontend/src/App.jsx` inside the existing `<RequireAdmin>` block — depends on T016
- [X] T018 [US3] Add a "Packing Item Types" link/card to `frontend/src/pages/Admin/AdminPage.jsx` pointing to `/admin/packing-item-types` — depends on T017

**Checkpoint**: Admin can fully manage the Packing Item Type catalog. Non-admin users are redirected by RequireAdmin guard.

---

## Phase 5: User Story 4 — Mobile App Fetches Active Item Types (Priority: P4)

**Goal**: `GET /api/packing-item-types` returns only active item types (both `nameEs`
and `nameEn`), sorted by `nameEs` ascending, and requires a valid JWT.

**Independent Test**: Call `GET /api/packing-item-types` with a valid token — confirm
response is an array of active items only, sorted by nameEs, each item has `nameEs`
and `nameEn` fields. Call without token — confirm 401.

- [X] T019 [US4] Verify `GET /` in `backend/routes/packingItemTypes.js` matches the contract in `specs/002-warehouse-file-type/contracts/packing-item-types-api.md`: active-only filter, `orderBy: { nameEs: 'asc' }`, all fields (`id`, `nameEs`, `nameEn`, `active`, `createdAt`, `updatedAt`) included in response, 401 on missing JWT — depends on T014

**Checkpoint**: Mobile app can call `GET /api/packing-item-types`, receive only active item types with both language names, and cache them for offline use.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, audit coverage, and edge-case hardening.

- [X] T020 [P] Confirm `backend/routes/packingItemTypes.js` write endpoints each call `logAudit(...)` (same pattern as other routes) — verify create, update, and deactivate all have audit entries
- [X] T021 [P] Confirm `backend/routes/movingFiles.js` WAREHOUSE POST path wraps the auto-job creation in its own try/catch so that a job creation failure only logs an error and does NOT return a 500 to the client (file is already saved)
- [ ] T022 Walk through all 8 validation scenarios in `specs/002-warehouse-file-type/quickstart.md` manually against the running local dev environment and mark each as pass/fail

---

## Dependencies

```
T001 ──► T007 ──► T012
T002 ──► T003 ──► T014 ──► T015
                  T014 ──► T019
T003 ──► T016 ──► T017 ──► T018
T004 ──► T012
T005 (parallel — no blockers after T001–T003 foundation)
T006 (parallel — no blockers after T001–T003 foundation)
T006 ──► T016
```

**US1 is independent of US3/US4** — File + Job work does not depend on PackingItemType schema.
**US3 and US4 share the same route file** — T014 must complete before T015, T016, T019.

---

## Parallel Execution Examples

### When starting US1 (after Foundational phase):
```
T007 (backend handler), T008 (FileForm), T009 (FilesList), T010 (Layout) — run in parallel
T011 — after T007 completes (depends on backend behavior)
```

### When starting US2 (after US1 backend T007 complete):
```
T012 (auto-job in movingFiles.js), T013 (jobs.js allowlist) — run in parallel
```

### When starting US3 (after T003 schema complete):
```
T014 (backend route), T016 (frontend page) — run in parallel
T015 — after T014
T017 — after T016
T018 — after T017
```

### MVP Scope
**Deliver US1 alone** (T001–T011) for immediate value: Warehouse Files are usable in the
web app with correct numbering and lifecycle. US2–US4 add job linking, scheduling, and
catalog management on top.

---

## Implementation Strategy

1. **Start with Foundational** (T001–T006): one-line and schema changes, no risk.
2. **US1 backend** (T007) before any frontend: validate B-XXXX numbering in the API first.
3. **US1 frontend** (T008–T011) in parallel: all touch different files.
4. **US2** (T012–T013) immediately after US1 backend: the auto-job logic is a small addition to the same POST handler.
5. **US3** (T014–T018): new route file + new page — most isolated work.
6. **US4** (T019): validation only; no new code if T014 is correct.
7. **Polish** (T020–T022): audit coverage and quickstart walkthrough last.
