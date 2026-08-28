---

description: "Task list for Schedule Worker Capacity Limits"
---

# Tasks: Schedule Worker Capacity Limits

**Input**: Design documents from `/specs/009-schedule-worker-limits/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/schedule-capacity-api.md](./contracts/schedule-capacity-api.md), [quickstart.md](./quickstart.md)

**Tests**: Not requested in the feature specification — no automated test tasks are included. Validation is via [quickstart.md](./quickstart.md).

**Organization**: Tasks are grouped by user story (US1–US5, matching spec.md priorities P1/P1/P2/P2/P3) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Paths are relative to the repository root (`backend/`, `frontend/`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema groundwork shared by every user story

- [X] T001 Add `ScheduleSetting` model, `Job.workersRequired`/`Job.daysToComplete`, `ScheduleEntry.needsAttention`/`ScheduleEntry.overrideReason`, and `StaffMember.canManageSchedule` to `backend/prisma/schema.prisma` per [data-model.md](./data-model.md)
- [X] T002 Run `npx prisma db push` and `npx prisma generate` from `backend/` to apply the schema changes

**Checkpoint**: Schema is migrated; no user-facing behavior yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared backend capacity-calculation logic and permission middleware that every user story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Create `backend/services/scheduleCapacity.js` exporting `getScheduleSetting()`, `getRemainingCapacityForSpan(startDate, days)`, `checkCapacityForSpan(startDate, days, workersRequired)`, and `findClosestAvailableSpan(startDate, days, workersRequired)` per [research.md](./research.md) "Where capacity is enforced" and "Closest available date search algorithm" decisions
- [X] T004 Add `requireScheduleManager` middleware to `backend/routes/schedule.js` checking `staff.canManageSchedule || staff.role === 'ADMIN'`, following the existing `requireScheduleAccess` pattern

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Configure daily worker capacity (Priority: P1) 🎯 MVP

**Goal**: Only Scheduling Manager users can view/change the daily worker capacity (default 30) from the Schedule screen.

**Independent Test**: Open the Schedule screen as a Scheduling Manager, change capacity, save, and confirm it's used going forward; confirm a non-manager cannot change it.

### Implementation for User Story 1

- [X] T005 [US1] Add `GET /api/schedule/settings` and `PUT /api/schedule/settings` endpoints in `backend/routes/schedule.js` (default 30 if no row exists, validate positive integer, `requireScheduleManager` on PUT, `logAudit(...)` on PUT) per [contracts/schedule-capacity-api.md](./contracts/schedule-capacity-api.md)
- [X] T006 [US1] Add `capacity.*` EN/ES keys (control label, invalid-value error, permission-denied error) to `frontend/src/i18n.jsx`
- [X] T007 [US1] Add a capacity configuration control to `frontend/src/pages/Schedule/` (component file per existing Schedule page structure) that calls `GET`/`PUT /api/schedule/settings` via `frontend/src/api.js`, shown editable only when the logged-in staff has `canManageSchedule` (or `ADMIN`), read-only/hidden otherwise
- [X] T008 [US1] Add client-side validation (positive integer) and error display for the capacity control in the same Schedule component from T007

**Checkpoint**: User Story 1 fully functional and independently testable (Scenario 1 in quickstart.md).

---

## Phase 4: User Story 2 - Enforce worker capacity when scheduling a job (Priority: P1)

**Goal**: Jobs cannot be auto- or manually scheduled onto day(s) without enough remaining worker capacity; missing `workersRequired` blocks auto-scheduling with a warning; multi-day jobs are checked/reserved across their full span; failures suggest the closest available date(s).

**Independent Test**: Create jobs with known worker requirements against a day with known remaining capacity; confirm acceptance while capacity remains and blocking once exhausted, with suggested alternates offered.

### Implementation for User Story 2

- [X] T009 [P] [US2] Add `workersRequired` and `daysToComplete` fields to job create/update handling in `backend/routes/jobs.js` (accept in POST/PUT body, persist via Prisma)
- [X] T010 [P] [US2] Add `workersRequired`/`daysToComplete` fields to the job form in `frontend/src/pages/Jobs/` (manual numeric inputs, `daysToComplete` defaulting to 1 in the UI)
- [X] T011 [US2] Extend `backend/services/scheduleSync.js` (`syncJobScheduleEntries`/`_syncEntry`) to: skip auto-creating a schedule entry when `job.workersRequired` is missing and return a `MISSING_WORKERS_REQUIRED` warning; compute the job's day span from its service/move date + `daysToComplete`; call `checkCapacityForSpan` from T003 before creating/updating an entry; return a `NO_CAPACITY` warning with suggestions (via `findClosestAvailableSpan`) when insufficient (depends on T001, T003, T009)
- [X] T012 [US2] Surface `scheduleWarning` from `scheduleSync` in the `backend/routes/jobs.js` POST/PUT response per [contracts/schedule-capacity-api.md](./contracts/schedule-capacity-api.md) (depends on T011)
- [X] T013 [US2] Add `GET /api/schedule/capacity` and `GET /api/schedule/capacity/suggestions` endpoints in `backend/routes/schedule.js` using `scheduleCapacity.js` helpers, for manual-scheduling pre-checks (depends on T003)
- [X] T014 [US2] Enforce capacity in manual scheduling: update `POST /api/schedule` and `PUT /api/schedule/:id` in `backend/routes/schedule.js` to call `checkCapacityForSpan` before create/update and respond `409` with suggestions when insufficient and no override is requested (depends on T003, T013)
- [X] T015 [US2] Add `scheduleWarning.*` and `noCapacity.*` EN/ES keys (missing-workers message, no-room message, suggested-dates prompt) to `frontend/src/i18n.jsx`
- [X] T016 [US2] Show the missing-workers warning and no-room/suggested-dates message in the job form (`frontend/src/pages/Jobs/`) when `scheduleWarning` is returned from create/update (depends on T012, T015)
- [X] T017 [US2] Show the no-room/suggested-dates message in the manual scheduling UI (`frontend/src/pages/Schedule/`) when a `409` is returned, letting the user pick a suggested date to resubmit (depends on T014, T015)

**Checkpoint**: User Stories 1 AND 2 both work independently (Scenario 2 in quickstart.md).

---

## Phase 5: User Story 3 - Override capacity with a documented reason (Priority: P2)

**Goal**: Users can force-schedule a job beyond capacity by providing a required reason; the entry is flagged needs-attention and the reason is stored and visible.

**Independent Test**: Attempt to schedule a job that exceeds capacity, override with a reason, and confirm it appears flagged with the reason visible.

### Implementation for User Story 3

- [X] T018 [US3] Accept `forceOverride`/`overrideReason` in `POST /api/schedule` and `PUT /api/schedule/:id` (`backend/routes/schedule.js`): require non-empty `overrideReason` when `forceOverride: true`, set `needsAttention: true` and persist `overrideReason` bypassing the capacity block from T014, call `logAudit(...)` (depends on T014)
- [X] T019 [US3] Extend `backend/services/scheduleSync.js` to accept an override path (e.g. job-level force flag/reason) so auto-scheduled overbooked jobs can also be flagged `needsAttention` with a stored reason (depends on T011, T018)
- [X] T020 [US3] Add `needsAttention` status metadata (label/badge color) to `frontend/src/constants.js` following the existing `statusMeta` helper pattern
- [X] T021 [US3] Add `override.*` EN/ES keys (reason prompt, required-reason error, needs-attention label) to `frontend/src/i18n.jsx`
- [X] T022 [US3] Add an override dialog to `frontend/src/pages/Schedule/` (and job form where applicable) that appears when a capacity block occurs, requires a non-empty reason, and resubmits with `forceOverride`/`overrideReason` (depends on T017, T021)
- [X] T023 [US3] Render the needs-attention badge and visible override reason on schedule entries in `frontend/src/pages/Schedule/` using the metadata from T020 (depends on T020)

**Checkpoint**: User Stories 1, 2, and 3 all work independently (Scenario 3 in quickstart.md).

---

## Phase 6: User Story 4 - Scheduling manager resolves overbooked days (Priority: P2)

**Goal**: Scheduling Manager users see all jobs on an overbooked day plus the override reason, can reduce workers on other jobs or move them to different dates, resolve the flag, and get a persistent attention indicator on the Schedule screen when any day needs attention.

**Independent Test**: Grant a user `canManageSchedule`, view a flagged/overlapping day, reduce workers or move other jobs until no longer overbooked, and confirm the flag/indicator clears.

### Implementation for User Story 4

- [X] T024 [P] [US4] Add `GET /api/schedule/attention` endpoint in `backend/routes/schedule.js` returning all entries with `needsAttention: true` (with job/client/date/reason fields), `requireScheduleAccess` only, per [contracts/schedule-capacity-api.md](./contracts/schedule-capacity-api.md)
- [X] T025 [US4] Add `PUT /api/schedule/:id/resolve` endpoint in `backend/routes/schedule.js`: `requireScheduleManager`, re-check the day's total committed workers via `scheduleCapacity.js`, clear `needsAttention` only if capacity no longer exceeded (else `409`), `logAudit(...)` (depends on T003, T004)
- [X] T026 [US4] Re-evaluate and auto-clear `needsAttention` for affected days whenever `workersRequired`/dates change on any entry in `POST`/`PUT /api/schedule` and job update flows (`backend/routes/schedule.js`, `backend/routes/jobs.js`, `backend/services/scheduleSync.js`) per FR-017 (depends on T011, T018)
- [X] T027 [US4] Add `manager.*` EN/ES keys (day roster panel labels, reassign/move actions, resolve action, persistent attention indicator text) to `frontend/src/i18n.jsx`
- [X] T028 [US4] Add a day-roster panel to `frontend/src/pages/Schedule/` visible to Scheduling Managers showing all jobs scheduled that day with assigned workers and the override reason, calling `GET /api/schedule/attention` (depends on T024, T027)
- [X] T029 [US4] Add UI actions in the day-roster panel (T028) to edit another job's `workersRequired` or move its date, and a "resolve" action calling `PUT /api/schedule/:id/resolve` (depends on T025, T028)
- [X] T030 [US4] Add a persistent attention indicator (banner/badge) in `frontend/src/pages/Schedule/`, visible only to Scheduling Managers, shown whenever `GET /api/schedule/attention` returns one or more entries (depends on T024, T027)
- [X] T031 [US4] Restrict non-manager users to read-only visibility of the override reason (no reassignment/move controls) in the Schedule UI, per FR-014/FR-015 (depends on T028)

**Checkpoint**: User Stories 1–4 all work independently (Scenario 4 in quickstart.md).

---

## Phase 7: User Story 5 - Dashboard visibility of jobs needing schedule attention (Priority: P3)

**Goal**: A dashboard card lists all jobs currently flagged as needing schedule attention (job number/client, date(s), reason), updating as flags are resolved.

**Independent Test**: Flag one or more jobs as needing attention and confirm they appear in the new dashboard card; confirm resolved jobs no longer appear.

### Implementation for User Story 5

- [X] T032 [P] [US5] Add a `schedule_attention` entry to `frontend/src/dashboardCards.js` (title/desc i18n keys, `defaultVisible: true`) following the existing card registry pattern
- [X] T033 [P] [US5] Add `dashboard.store.cards.scheduleAttention.*` EN/ES keys (title, description, empty state) to `frontend/src/i18n.jsx`
- [X] T034 [US5] Render the new dashboard card in `frontend/src/pages/Dashboard.jsx`, fetching `GET /api/schedule/attention` and listing job number/client, date(s), and reason; showing an empty state when none exist (depends on T024, T032, T033)

**Checkpoint**: All user stories (US1–US5) independently functional (Scenario 5 in quickstart.md).

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T035 [P] Add release-capacity handling on job/schedule-entry deletion or unscheduling (`backend/routes/jobs.js`, `backend/routes/schedule.js`) confirming committed-worker sums naturally reduce once the entry is gone (FR-018)
- [X] T036 [P] Add re-check-on-change handling so editing a scheduled job's date, `daysToComplete`, or `workersRequired` re-runs the capacity/override flow (FR-019) in `backend/routes/jobs.js` and `backend/services/scheduleSync.js`
- [X] T037 Validate surface language policy: confirm every new string introduced by T006, T015, T021, T027, T033 exists in both `en` and `es` maps in `frontend/src/i18n.jsx` with no hardcoded labels
- [X] T038 Run [quickstart.md](./quickstart.md) end-to-end (all 5 scenarios + language check) and fix any gaps found

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001/T002) — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational — no dependency on other stories
- **User Story 2 (Phase 4)**: Depends on Foundational; independent of US1 (may run in parallel)
- **User Story 3 (Phase 5)**: Depends on US2 (T011, T014, T017) already enforcing the base capacity rule
- **User Story 4 (Phase 6)**: Depends on US3 (T018) since overrides are what create needs-attention entries to resolve
- **User Story 5 (Phase 7)**: Depends on US4's `GET /api/schedule/attention` (T024) for data, otherwise independent UI work
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### Within Each User Story

- Backend model/endpoint work before frontend consumption
- Shared helper (`scheduleCapacity.js`, T003) before any capacity-checking endpoint
- Story complete and checkpoint-verified before moving to the next priority

### Parallel Opportunities

- T001 and T002 are sequential (schema then migrate); no parallelism within Setup
- T009 and T010 (backend job fields vs. frontend job form) can run in parallel — different files
- T024, T032, T033 can run in parallel — different files
- Once Foundational (Phase 2) completes, US1 and US2 backend work can proceed in parallel by different developers; US3/US4/US5 have sequential story dependencies as noted above

---

## Parallel Example: User Story 2

```bash
# Backend job fields and frontend job form can proceed together:
Task: "Add workersRequired and daysToComplete fields to job create/update handling in backend/routes/jobs.js"
Task: "Add workersRequired/daysToComplete fields to the job form in frontend/src/pages/Jobs/"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (capacity configuration, Scheduling-Manager-gated)
4. **STOP and VALIDATE**: Run quickstart.md Scenario 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add User Story 1 → validate → deploy (MVP: capacity is configurable and gated)
3. Add User Story 2 → validate → deploy (core enforcement is live)
4. Add User Story 3 → validate → deploy (override escape hatch with audit trail)
5. Add User Story 4 → validate → deploy (managers can resolve overbooking)
6. Add User Story 5 → validate → deploy (dashboard visibility)
7. Polish phase → final quickstart run

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No test tasks included — feature spec did not request tests; validate via quickstart.md instead
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Story dependency chain here (US3→US2, US4→US3, US5→US4) reflects genuine functional prerequisites called out in spec.md's "Why this priority" sections, not incidental coupling
