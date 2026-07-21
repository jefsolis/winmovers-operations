---
description: "Task list for Origin Warehouse Field for Import Jobs"
---

# Tasks: Origin Warehouse Field for Import Jobs

**Input**: Design documents from `/specs/001-origin-warehouse-field/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/jobs-api.md](./contracts/jobs-api.md)

**Tests**: Not requested in the specification. No automated test tasks are included; validation is manual per [quickstart.md](./quickstart.md).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

## Path Conventions

- Web app: `backend/` (Express + Prisma), `frontend/src/` (React + Vite)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No project initialization needed; this feature modifies an existing app.

- [X] T001 Confirm local dev environment runs (backend `node index.js` on :3001, frontend `npm run dev` on :5173) before making changes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema change that all user stories depend on

**⚠️ CRITICAL**: The persistence layer must exist before either user story can be verified end-to-end.

- [X] T002 Add `originWarehouse String?` to `model Job` in [backend/prisma/schema.prisma](../../backend/prisma/schema.prisma), placed immediately after `originAddress`
- [X] T003 Apply the schema change from `backend/`: run `npx prisma db push` then `npx prisma generate`

**Checkpoint**: `Job.originWarehouse` column exists and the Prisma client is regenerated — user story work can begin.

---

## Phase 3: User Story 1 - Record the origin warehouse for an import job (Priority: P1) 🎯 MVP

**Goal**: Users can enter an Origin Warehouse name on an import job, positioned after Origin Address, and have it persist and display on reload.

**Independent Test**: Open an import job, enter a value in Origin Warehouse, save, reopen, and confirm the value persists.

### Implementation for User Story 1

- [X] T004 [US1] Add `originWarehouse` to the destructured request body and to the Prisma `create` data in the POST `/` handler of [backend/routes/jobs.js](../../backend/routes/jobs.js) (alongside `originAddress`)
- [X] T005 [US1] Add `originWarehouse` to the destructured request body and to the Prisma `update` data in the PUT `/:id` handler of [backend/routes/jobs.js](../../backend/routes/jobs.js)
- [X] T006 [P] [US1] Add bilingual label `originWarehouse` — EN `"Origin Warehouse"`, ES `"Almacén de Origen"` — to both the `en` and `es` job field label maps in [frontend/src/i18n.jsx](../../frontend/src/i18n.jsx)
- [X] T007 [US1] Add `originWarehouse: ''` to the initial form state and include `originWarehouse: job.originWarehouse || ''` in the edit-load mapping in [frontend/src/pages/Jobs/JobForm.jsx](../../frontend/src/pages/Jobs/JobForm.jsx)
- [X] T008 [US1] Add the "Origin Warehouse" input in the "Row 6: Origin Address" block of [frontend/src/pages/Jobs/JobDocument.jsx](../../frontend/src/pages/Jobs/JobDocument.jsx), immediately after the `originAddress` input, using the existing `addrInput`/`fv('originWarehouse')`/`ch('originWarehouse')` pattern and the new i18n label; render the saved value in view mode
- [X] T009 [US1] Verify the submit payload in `handleSubmit` of [frontend/src/pages/Jobs/JobForm.jsx](../../frontend/src/pages/Jobs/JobForm.jsx) sends `originWarehouse` (it is spread via `...form`); no partial-PUT regression
- [X] T010 [US1] Manually validate Scenario 1 & 2 from [quickstart.md](./quickstart.md): field appears after Origin Address in EN/ES, and a value persists across reload

**Checkpoint**: Origin Warehouse can be entered, saved, and displayed on import jobs — MVP complete.

---

## Phase 4: User Story 2 - Leave the origin warehouse empty (Priority: P2)

**Goal**: Users can save an import job with Origin Warehouse blank, and can clear a previously set value.

**Independent Test**: Create/edit an import job leaving Origin Warehouse empty; save succeeds with no error and the field shows blank.

### Implementation for User Story 2

- [X] T011 [US2] Confirm the field is nullable end-to-end: no `required` attribute on the input in [frontend/src/pages/Jobs/JobDocument.jsx](../../frontend/src/pages/Jobs/JobDocument.jsx) and no validation blocking empty save in [backend/routes/jobs.js](../../backend/routes/jobs.js)
- [X] T012 [US2] Ensure an empty value is persisted as empty/null on update (clearing works) — full-object PUT sends `originWarehouse: ''`
- [X] T013 [US2] Manually validate Scenario 3 & 4 from [quickstart.md](./quickstart.md): save with empty field succeeds; editing and clearing persists the latest value

**Checkpoint**: The field is fully optional and clearable without errors.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T014 [P] Verify existing non-import job types are unaffected (origin section unchanged where the field is import-scoped)
- [X] T015 [P] Run Scenario 5 from [quickstart.md](./quickstart.md): `GET /api/jobs/:id` returns `originWarehouse` (value or `null`)
- [X] T016 Re-check Constitution Check items in [plan.md](./plan.md): bilingual label present, full-PUT preserved, `getPrisma()` unchanged, additive/nullable field

---

## Dependencies & Execution Order

- **Phase 1 (T001)** → **Phase 2 (T002 → T003)** must complete before any user story.
- **User Story 1 (Phase 3)** depends only on Phase 2. It is the MVP.
- **User Story 2 (Phase 4)** builds on the same field/inputs from US1; verify after US1.
- **Polish (Phase 5)** runs last.
- Within Phase 3: T004 and T005 (same file, sequential), T006 is independent `[P]`, T007 → T008 (form state before input render), then T009 → T010.

## Parallel Opportunities

- **T006** (i18n labels) can be done in parallel with the backend route edits (T004/T005) — different files.
- **T014** and **T015** in Polish are independent and can run in parallel.

## Implementation Strategy

- **MVP**: Complete Phases 1–3 (through T010). This delivers the core value: entering and persisting the Origin Warehouse on import jobs.
- **Incremental**: Phase 4 hardens the optional/empty behavior; Phase 5 confirms no regressions and constitution compliance.
