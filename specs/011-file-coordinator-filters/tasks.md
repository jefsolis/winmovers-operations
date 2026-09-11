---

description: "Task list for File Coordinator Filters & Coordination Counts"
---

# Tasks: File Coordinator Filters & Coordination Counts

**Input**: Design documents from `/specs/011-file-coordinator-filters/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: No automated test tasks are included — this repository has no test suite, and the spec does not request TDD. Verification is manual via [quickstart.md](./quickstart.md), consistent with features 001–010.

**Organization**: Tasks are grouped by user story so each story can be implemented, verified, and shipped independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Web application (per plan.md Structure Decision): backend code in `backend/`, frontend code in `frontend/src/`. No new top-level directories.

⚠️ **Same-file serialization**: most frontend work lands in `frontend/src/pages/Files/FilesList.jsx` and `frontend/src/i18n.jsx`. Tasks touching the same file are **not** marked `[P]` even when logically independent.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the existing baseline this feature builds on — no project initialization or dependency changes are required.

- [X] T001 Verify the required fields already exist and confirm no migration is needed: `MovingFile.coordinatorId` / `coordinator` (relation `"FileCoordinator"`), `Job.coordinatorId` / `coordinator`, and `StaffMember.name` / `isActive` / `canCoordinateFiles` in `backend/prisma/schema.prisma`. Do NOT run `prisma db push` or `prisma generate` for this feature.
- [X] T002 [P] Confirm `GET /api/files` already returns `coordinator {id,name}` and `job.coordinator {id,name}` for every category in `backend/routes/movingFiles.js`, and record that no query-parameter change is made to that endpoint (per research.md Decision 1).
- [ ] T003 [P] Prepare the validation dataset described in the Prerequisites section of `specs/011-file-coordinator-filters/quickstart.md` (open files in all four categories, an EXPORT file whose coordinator comes only from its linked job, unassigned files, an inactive coordinator holding files, one soft-deleted file with a coordinator).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The single "effective coordinator" rule and the shared labels that US1 and US2 both depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Add the `effectiveCoordinator(file)` helper to `frontend/src/constants.js` implementing the FR-004 rule (`file.coordinator` → `file.job?.coordinator` → `null`), applied uniformly to all four categories, with a one-line comment naming `backend/services/coordinators.js` as its backend counterpart.
- [X] T005 Add the shared EN + ES i18n keys used by both list surfaces to `frontend/src/i18n.jsx` under the `movingFiles.*` prefix: the unassigned label and the inactive-coordinator marker. Add each key to **both** the `en` and `es` maps.

**Checkpoint**: The effective-coordinator rule exists in exactly one place on the frontend; US1 and US2 can begin.

---

## Phase 3: User Story 1 - Filter a file list by coordinator (Priority: P1) 🎯 MVP

**Goal**: Every file screen (Export, Import, Local, Warehouse) offers a coordinator filter with "All coordinators", "Unassigned", and per-person options, carried in the URL and combined with all existing filters.

**Independent Test**: Open `/files/export`, select a coordinator, and confirm only that person's files remain and the page subtitle count matches; repeat with "Unassigned"; repeat on `/files/import`, `/files/local`, `/files/warehouse`.

### Implementation for User Story 1

- [X] T006 [US1] Add the coordinator filter i18n keys (row label, "Unassigned" chip, inactive marker) to both `en` and `es` maps under `movingFiles.*` in `frontend/src/i18n.jsx`.
- [X] T007 [US1] In `frontend/src/pages/Files/FilesList.jsx`, fetch eligible coordinators once via `api.get('/staff?canCoordinateFiles=true')` and hold them in component state (used to mark inactive/ineligible coordinators).
- [X] T008 [US1] In `frontend/src/pages/Files/FilesList.jsx`, build the coordinator chip row per FR-003: one chip per effective coordinator holding a file in the current view with its count, sorted by name, plus an "Unassigned" chip; coordinators missing from the eligible list are marked inactive.
- [X] T009 [US1] In `frontend/src/pages/Files/FilesList.jsx`, read and write the filter through `useSearchParams()` using the `coordinator` key (`''` = all, `unassigned`, or a `StaffMember.id`) so the value is derived from the URL rather than mirrored into state — this makes deep links work with no special case (contracts/files-list-view.md).
- [X] T010 [US1] Render the coordinator chip row beneath the status chips in `frontend/src/pages/Files/FilesList.jsx`, with a row label and a neutral chip style distinct from the status chips, for all four categories.
- [X] T011 [US1] In `frontend/src/pages/Files/FilesList.jsx`, apply the coordinator predicate (data-model.md §2) to the `statusFiltered` → `displayed` pipeline so it ANDs with search, visibility, `showClosed` and the status chips, and so the existing `displayed.length` subtitle reports the filtered count (FR-002, FR-007). Each chip row counts the other row's selection.
- [X] T012 [US1] In `frontend/src/pages/Files/FilesList.jsx`, clear the `coordinator` URL parameter when the `category` prop changes, matching the existing reset of search/status/visibility, and confirm an unrecognized `coordinator` value renders the standard empty state rather than an error (data-model.md V7).

**Checkpoint**: User Story 1 is fully functional and independently deliverable — the coordinator filter works on all four screens.

---

## Phase 4: User Story 2 - See the coordinator on Local files (Priority: P2)

**Goal**: The Local file list shows the effective coordinator in the same position and format as the other three lists, with an explicit label when unassigned.

**Independent Test**: Open `/files/local` and confirm a Coordinator column appears with the assigned person's name and an explicit unassigned label where none is set, matching `/files/export`.

### Implementation for User Story 2

- [X] T013 [US2] Add the Local list's Coordinator column header key if one is still missing, reusing the existing `movingFiles.coordinator` key, in `frontend/src/i18n.jsx` (both `en` and `es`).
- [X] T014 [US2] In `frontend/src/pages/Files/FilesList.jsx`, remove the `category !== 'LOCAL'` guard around the Coordinator `<th>` so the header renders for all four categories in the same column position.
- [X] T015 [US2] In `frontend/src/pages/Files/FilesList.jsx`, remove the `category !== 'LOCAL'` guard around the Coordinator `<td>` and replace the inline EXPORT-only expression (`f.coordinator?.name || (category === 'EXPORT' ? f.job?.coordinator?.name : null) || '—'`) with `effectiveCoordinator(f)` from T004, rendering the unassigned label from T005 instead of a dash when the result is `null` (FR-005, FR-006, data-model.md V4).

**Checkpoint**: User Stories 1 and 2 both work; the column, the filter, and the FR-004 rule now share one implementation.

---

## Phase 5: User Story 3 - Coordination workload dashboard card (Priority: P3)

**Goal**: A dashboard card shows, per coordinator and for the unassigned group, how many open non-deleted files of each category they coordinate, with totals and click-through into the matching filtered list.

**Independent Test**: Enable the card on the dashboard, confirm each coordinator row shows per-category counts plus a total, an Unassigned row is present, column/grand totals reconcile, and clicking a cell opens the matching pre-filtered file screen with the same number of rows.

### Implementation for User Story 3

- [X] T016 [P] [US3] Create `backend/services/coordinators.js` exporting `effectiveCoordinator(file)` (the FR-004 rule, mirroring `frontend/src/constants.js`) and `buildCoordinatorWorkload(files)` which groups rows into the shape defined in `specs/011-file-coordinator-filters/contracts/dashboard-coordinator-workload.md`: zero-filled `counts` for all four categories, a computed `total`, coordinator rows emitted only when `total > 0`, the `coordinatorId: null` Unassigned row always emitted last, and coordinator rows sorted by `name`.
- [X] T017 [US3] In `backend/routes/dashboard.js`, add a `p.movingFile.findMany({ where: { status: 'OPEN', deletedAt: null }, select: { category, coordinator: {id,name,isActive}, job: { select: { coordinator: {id,name,isActive} } } } })` query to the existing `Promise.all` batch (using the `getPrisma()` handle already in scope, no raw SQL), destructure its result alongside the existing entries, and return `coordinatorWorkload: buildCoordinatorWorkload(...)` as a new top-level key in the existing `res.json({...})` — leaving every existing key unchanged.
- [X] T018 [P] [US3] Register the card in `frontend/src/dashboardCards.js` as `{ id: 'coordinator_workload', titleKey: 'dashboard.store.cards.coordinatorWorkload.title', descKey: 'dashboard.store.cards.coordinatorWorkload.desc', defaultVisible: false }` (FR-014).
- [X] T019 [US3] Add the card's EN + ES i18n keys to `frontend/src/i18n.jsx`: `dashboard.store.cards.coordinatorWorkload.title`/`.desc`, the four category column headers, the row-total and column-totals labels, the Unassigned row label, and the scope note stating the card counts open, non-deleted files only (FR-012).
- [X] T020 [US3] In `frontend/src/pages/Dashboard.jsx`, destructure `coordinatorWorkload` from the dashboard response (defaulting to `[]` so an older backend renders the empty state rather than failing) and render the card gated by the existing `isVisible('coordinator_workload')` check, as a table with one row per returned entry, the Unassigned row pinned last, one column per category, and a row-total column.
- [X] T021 [US3] In `frontend/src/pages/Dashboard.jsx`, derive the per-category column totals and the grand total on the client from the returned rows (FR-011 — these are not sent by the API) and render them as a footer row.
- [X] T022 [US3] In `frontend/src/pages/Dashboard.jsx`, make each non-zero count cell link to `/files/{export|import|local|warehouse}?coordinator={staffId|unassigned}` so the destination list opens pre-filtered and shows exactly the number of rows in the cell (FR-013, data-model.md V1).

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Reconciliation, language compliance, and non-regression across all three stories.

- [ ] T023 Reconcile card counts against filtered lists per quickstart.md Scenario 4 for at least two coordinators and the Unassigned row across two categories; any mismatch means the frontend and backend copies of the effective-coordinator rule have drifted (SC-003, data-model.md V1/V2).
- [ ] T024 [P] Verify the edge cases in quickstart.md Scenario 5: closing a file drops the count, soft-deleting removes it from the card while keeping it filterable under visibility "Deleted", an inactive coordinator holding files stays visible and marked, removing a coordinator moves the file to Unassigned, and the Unassigned row renders even at zero (data-model.md V5/V6/V8).
- [ ] T025 [P] Verify URL behavior per quickstart.md Scenario 6: deep link opens pre-filtered, back button restores the prior filter, switching category clears the parameter, and an unknown value shows the empty state (FR-008, FR-013, V7).
- [ ] T026 Validate surface language policy: confirm every new web string added in T005, T006, T013 and T019 exists in **both** the `en` and `es` maps of `frontend/src/i18n.jsx`, switch the app to Spanish and confirm no untranslated text and no raw `movingFiles.*` / `dashboard.store.cards.*` keys render; confirm no mobile surface was touched and that `unassigned` remains a language-neutral token in the URL and API (Constitution I, SC-006).
- [ ] T027 Run the non-regression checks in quickstart.md Scenario 8: list status dropdowns still save on Export/Import, Local stays read-only for status, delete/restore still work, schedule icon and attachment counts unchanged, all other dashboard cards still render, and the file detail History tab is untouched.
- [X] T028 Confirm the Constitution gates: `git status` shows no change to `backend/prisma/schema.prisma`, no new route file and no change to route registration order in `backend/index.js`, no `new PrismaClient()` and no raw SQL introduced, and no write path added (Constitution II, V, VI).
- [ ] T029 Run the full `specs/011-file-coordinator-filters/quickstart.md` validation and check off its Definition of Done.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories** (T004 is the rule every surface calls).
- **User Story 1 (Phase 3)**: Depends on Phase 2. No dependency on US2 or US3.
- **User Story 2 (Phase 4)**: Depends on Phase 2. Independent of US1, but shares `FilesList.jsx` — see serialization note.
- **User Story 3 (Phase 5)**: Depends on Phase 2 only for consistency of the rule; its backend half (T016–T017) has no frontend dependency at all. T022's deep links are only *verifiable* once US1 exists.
- **Polish (Phase 6)**: Depends on the user stories being delivered.

### User Story Dependencies

- **US1 (P1)**: Independent — deliverable as the MVP on its own.
- **US2 (P2)**: Independent of US1 in behavior; both edit `FilesList.jsx`, so land them sequentially to avoid conflicts.
- **US3 (P3)**: Independently testable. Its card counts are meaningful alone; the cell deep-links (T022) produce a filtered list only once US1 has shipped — until then they land on an unfiltered screen. Ship US1 before or with US3 for the full experience.

### Within Each User Story

- i18n keys before the components that consume them.
- Data source (T007) before option building (T008) before the control (T010) before the predicate (T011).
- Backend service (T016) before the route wiring (T017); route before the card that consumes the key (T020).

### Parallel Opportunities

- **Phase 1**: T002 and T003 run in parallel.
- **Phase 2**: T004 and T005 touch different files and could be parallelized, but both are tiny and T005's keys are consumed by T004's callers — run them together.
- **Phase 5**: T016 (new backend service) and T018 (card registry) are in different files from each other and from the Dashboard work — genuinely parallel. T017 must follow T016.
- **Cross-story**: US3's backend half (T016–T017) can be built by a second person in parallel with all of US1/US2, since it shares no file with them.
- **Phase 6**: T024 and T025 are independent verification passes.

---

## Parallel Example: User Story 3

```text
# Launch together (different files, no shared dependencies):
T016  Create backend/services/coordinators.js
T018  Register coordinator_workload in frontend/src/dashboardCards.js

# Then, in order:
T017  Wire the aggregate into backend/routes/dashboard.js   (needs T016)
T019  Add card i18n keys to frontend/src/i18n.jsx
T020 → T021 → T022  Render the card in frontend/src/pages/Dashboard.jsx  (same file, serial)
```

---

## Implementation Strategy

### MVP (recommended first delivery)

**Phase 1 → Phase 2 → Phase 3 (US1)**, i.e. T001–T012. This delivers the actual request — being able to
isolate one coordinator's files or the unassigned backlog on any file screen — with no backend change
whatsoever and therefore no deployment risk beyond a frontend build.

### Incremental delivery

1. **US1** — coordinator filter on all four screens. Ship and validate.
2. **US2** — Local coordinator column (3 small tasks; makes the Local filter results verifiable at a glance).
3. **US3** — dashboard card (the only backend change in the feature: one additive response key).
4. **Polish** — reconciliation, bilingual check, non-regression.

Each step is independently shippable and independently revertible.

### Risk notes

- The one real risk is the effective-coordinator rule existing in two runtimes (`frontend/src/constants.js` and `backend/services/coordinators.js`). T023 is the task that catches drift — do not skip it.
- No `prisma db push` / `prisma generate` is part of this feature (T001, T028). If either becomes necessary, stop: the design has changed and plan.md needs revisiting.
