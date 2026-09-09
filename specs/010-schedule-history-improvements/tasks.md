---

description: "Task list for Schedule History & Job Scheduling Visibility"
---

# Tasks: Schedule History & Job Scheduling Visibility

**Input**: Design documents from `C:\Workspace\winmovers-operations\specs\010-schedule-history-improvements\`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-changes.md, quickstart.md

**Tests**: Not included — no automated test suite exists in this repo (per plan.md Technical Context) and the spec did not explicitly request tests. Verification is manual via quickstart.md.

**Organization**: Tasks are grouped by user story (US1, US2, US3) matching spec.md priorities. Each story is independently completable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Maps to spec.md user stories US1 (combined history), US2 (Jobs list icon), US3 (Files list/summary icon)

## Path Conventions

Web app split: `backend/` (Express + Prisma) and `frontend/` (React + Vite), per plan.md Project Structure.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No project initialization needed — this feature extends an existing running application. This phase only confirms the touched files exist as expected.

- [X] T001 Confirm existing files to be modified are present and unchanged from plan.md's Project Structure: `backend/routes/audit.js`, `backend/routes/jobs.js`, `backend/routes/movingFiles.js`, `frontend/src/i18n.jsx`, `frontend/src/components/AuditHistory.jsx`, `frontend/src/pages/Jobs/JobsList.jsx`, `frontend/src/pages/Files/FilesList.jsx`, `frontend/src/pages/Dashboard.jsx`, `frontend/src/pages/Schedule/SchedulePage.jsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared i18n keys and a shared calendar-icon helper used by both US2 and US3. Must complete before those stories' UI tasks.

**⚠️ CRITICAL**: US2 and US3 both render the same calendar icon convention — the shared helper in T003 must exist first to avoid duplicated, inconsistent icon logic.

- [X] T002 [P] Add new i18n keys to both `en` and `es` objects in `frontend/src/i18n.jsx`: `audit.sourceJob`, `audit.sourceSchedule`, `jobs.scheduledTooltip`, `jobs.notScheduledTooltip` (reused by Files list/summary per research.md R5)
- [X] T003 [P] Add a `scheduleMeta(scheduled)` helper to `frontend/src/constants.js` returning `{ icon: '📅', color, label }` style metadata for the scheduled/not-scheduled calendar icon states, for shared use by JobsList, FilesList, and Dashboard

**Checkpoint**: Foundation ready — US1, US2, US3 can now proceed (US1 is fully independent of US2/US3; US3 reuses the icon convention built for US2 but does not block on US2's specific file changes)

---

## Phase 3: User Story 1 - Combined job + schedule history in Job History tab (Priority: P1) 🎯 MVP

**Goal**: The Job History tab shows one chronological timeline combining `Job` audit entries and `ScheduleEntry` audit entries linked to that job (by `jobId` in the JSON snapshot), each entry labeled with its origin.

**Independent Test**: Create a job (triggers auto-schedule), edit the resulting schedule entry's date, then delete it. Open the job's History tab and verify all three events appear in one combined, time-ordered list, each labeled "Job" or "Schedule" (quickstart.md Scenarios 1–3).

### Implementation for User Story 1

- [X] T004 [US1] In `backend/routes/audit.js`, extend the `GET /` handler: when `entityType === 'Job'` and `entityId` is provided, additionally query `AuditLog` for `entityType: 'ScheduleEntry'` with `OR: [{ before: { path: ['jobId'], equals: entityId } }, { after: { path: ['jobId'], equals: entityId } }]`, merge both result sets, sort by `createdAt` descending, and recompute `total` as the combined count (per contracts/api-changes.md §1)
- [X] T005 [US1] In the same `backend/routes/audit.js` handler, add a `source` field to every returned entry (`'Job'` when `entityType === 'Job'`, `'Schedule'` when `entityType === 'ScheduleEntry'`, otherwise the raw `entityType`), applied uniformly whether or not the combined-query branch was taken
- [X] T006 [US1] In `frontend/src/components/AuditHistory.jsx`, render a source badge per entry using `entry.source` (label via `t('audit.sourceJob')` / `t('audit.sourceSchedule')`), styled distinctly from the existing action badge, visible only when the component is used for `entityType="Job"` (i.e., when entries can contain more than one source)
- [X] T007 [US1] In `frontend/src/components/AuditHistory.jsx`, ensure entries with `userName` absent and `source === 'Schedule'` display an automated/system attribution (e.g. fall back to a "System" label) instead of blank, matching FR-012

**Checkpoint**: User Story 1 fully functional — verify via quickstart.md Scenarios 1, 2, and 3 independently of US2/US3

---

## Phase 4: User Story 2 - Visual "scheduled" indicator on the Jobs list (Priority: P1)

**Goal**: The Jobs list shows a calendar icon per row reflecting whether the job currently has an active schedule entry, and clicking it navigates to that entry's date on the Schedule page.

**Independent Test**: With a mix of scheduled/unscheduled jobs, verify the icon renders in a visually distinct state per row and clicking a scheduled job's icon navigates to the correct schedule day (quickstart.md Scenario 4).

### Implementation for User Story 2

- [X] T008 [US2] In `backend/routes/jobs.js`, extend the `GET /` list query's `include` to add `scheduleEntries: { select: { id: true, startDate: true, endDate: true, date: true } }`, then map each returned job to add `scheduled: boolean` and `nextScheduleDate: string | null` (earliest `startDate ?? date` among its `scheduleEntries`, formatted `YYYY-MM-DD`) per data-model.md
- [X] T009 [US2] [P] In `frontend/src/pages/Schedule/SchedulePage.jsx`, read an optional `date` query param via `useSearchParams()` on mount; when present and parseable, set `year`/`month` state to that date's month and open the existing `dayPanel` state for that date (per research.md R4)
- [X] T010 [US2] In `frontend/src/pages/Jobs/JobsList.jsx`, add a calendar icon column to the table (using the `scheduleMeta` helper from T003) reflecting `job.scheduled`, with a tooltip from `jobs.scheduledTooltip` / `jobs.notScheduledTooltip`
- [X] T011 [US2] In `frontend/src/pages/Jobs/JobsList.jsx`, make the calendar icon clickable when `job.scheduled` is true, navigating to `/schedule?date=${job.nextScheduleDate}` (per contracts/api-changes.md navigation contract)

**Checkpoint**: User Story 2 fully functional — verify via quickstart.md Scenario 4 independently of US1/US3

---

## Phase 5: User Story 3 - Scheduled indicator on Files lists and summaries (Priority: P2)

**Goal**: The Files lists (Export, Import, Local, Warehouse) and the Files summary/dashboard view show the same calendar icon convention, derived from the file's linked job, with the same click-to-schedule-day navigation.

**Independent Test**: With a mix of scheduled/unscheduled files across each category, verify the icon appears correctly in each list and the summary, and clicking it navigates to the schedule day (quickstart.md Scenario 5).

**Depends on**: T003 (shared icon helper) and T009 (SchedulePage deep-link support) from prior phases.

### Implementation for User Story 3

- [X] T012 [US3] In `backend/routes/movingFiles.js`, extend the `GET /` list query's `job` include to add `scheduleEntries: { select: { id: true, startDate: true, endDate: true, date: true } }`, then map each returned file to add `scheduled: boolean` and `nextScheduleDate: string | null` derived from `file.job?.scheduleEntries` (false/null when no linked job), per data-model.md
- [X] T013 [P] [US3] In `backend/routes/dashboard.js`, extend the existing per-category file summary queries (`movingFile.findMany` calls for OPEN/LOCAL/EXPORT/IMPORT groupings) to include `job: { select: { scheduleEntries: { select: { startDate: true, endDate: true, date: true } } } }` and add the same derived `scheduled`/`nextScheduleDate` fields to each summary row, per contracts/api-changes.md §4
- [X] T014 [US3] In `frontend/src/pages/Files/FilesList.jsx`, add a calendar icon column to the table (reusing the `scheduleMeta` helper from T003) reflecting `file.scheduled`, clickable to `/schedule?date=${file.nextScheduleDate}` when scheduled — applies uniformly to the shared component used by Export/Import/Local/Warehouse categories
- [X] T015 [US3] In `frontend/src/pages/Dashboard.jsx`, add the same calendar icon (reusing `scheduleMeta`) to each file row rendered in the files summary tables, clickable to `/schedule?date=${f.nextScheduleDate}` when scheduled

**Checkpoint**: User Story 3 fully functional — verify via quickstart.md Scenario 5

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all stories

- [X] T016 Run through all 5 quickstart.md scenarios end-to-end in the local dev environment (`backend`: `node index.js`, `frontend`: `npm run dev`) to confirm no regressions to the existing (non-Job) `AuditHistory` usages on Client/Visit/Quote/Agent/Staff detail pages
- [X] T017 Verify no i18n string was hardcoded (grep for the new labels in JSX to confirm they're only referenced via `t(...)`) and that both `en`/`es` maps in `frontend/src/i18n.jsx` contain all new keys added in T002

---

## Dependencies & Execution Order

- **Phase 1 (Setup)** → **Phase 2 (Foundational)** → User story phases → **Phase 6 (Polish)**
- **User Story 1 (Phase 3)**: fully independent — no dependency on Phase 2's T003 (icon helper) since it touches only history rendering, but does depend on T002's `audit.source*` i18n keys.
- **User Story 2 (Phase 4)**: depends on T002 (i18n) and T003 (icon helper) from Phase 2.
- **User Story 3 (Phase 5)**: depends on T003 (icon helper) from Phase 2, and reuses T009 (SchedulePage deep-link support) built during Phase 4 — so Phase 5 should start after T009 completes, even though its backend tasks (T012, T013) can be done in parallel with Phase 4.
- Within each phase, tasks touching different files are marked `[P]` and can run in parallel; tasks touching the same file (e.g. T004 → T005 both in `audit.js`; T010 → T011 both in `JobsList.jsx`) must run sequentially.

## Parallel Execution Examples

**Phase 2 (Foundational)**:
```
T002 (i18n.jsx) and T003 (constants.js) — different files, run in parallel
```

**Phase 4 + Phase 5 backend work** (once Phase 2 is done):
```
T008 (jobs.js) can run in parallel with T012 (movingFiles.js) and T013 (dashboard.js) — all different files
```

**Phase 3 (US1)**:
```
T004 → T005 sequential (same file: audit.js)
T006 → T007 sequential (same file: AuditHistory.jsx)
T004/T005 pair can run in parallel with T006/T007 pair (backend vs frontend, independent until manual verification)
```

## Implementation Strategy

**MVP scope**: User Story 1 (Phase 3) alone delivers the core value described as the primary problem statement — combined history — and is independently shippable. User Story 2 (Phase 4) is equally P1 and addresses the "critical to company workflow" scheduling-gap risk; both P1 stories should ship together as the MVP given the spec's framing, with User Story 3 (Phase 5, P2) following once the icon convention and Schedule deep-link are proven on the Jobs list.

**Incremental delivery**:
1. Phase 1 + Phase 2 (setup/foundational)
2. Phase 3 (US1) → validate → deployable increment
3. Phase 4 (US2) → validate → deployable increment
4. Phase 5 (US3) → validate → deployable increment
5. Phase 6 (polish/full regression pass)
