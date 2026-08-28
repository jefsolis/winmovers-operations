# Implementation Plan: Schedule Worker Capacity Limits

**Branch**: `009-schedule-worker-limits` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-schedule-worker-limits/spec.md`

## Summary

Introduce a configurable daily worker-capacity ceiling (default 30) that gates both automatic (job-date-driven) and manual scheduling in the existing Schedule module. Jobs gain `workersRequired` and `daysToComplete` fields; `ScheduleEntry` gains an override/needs-attention flag and stored reason. Only users holding a new `SCHEDULE_MANAGER` permission can change the daily capacity, reassign workers/move other jobs to resolve overbooking, and see a persistent attention indicator. A new dashboard card surfaces all needs-attention jobs. All new UI text ships in English and Spanish per the web language policy; the needs-attention status and manager permission are language-neutral backend values.

## Technical Context

**Language/Version**: Node.js (Express, CommonJS) backend; React 18 + Vite (JSX, ES modules) frontend — matches existing repo versions.

**Primary Dependencies**: Prisma 5 ORM, PostgreSQL, `@azure/storage-blob` (unaffected by this feature), existing `axios`-based `api.js` client, existing `i18n.jsx` context.

**Storage**: PostgreSQL via Prisma — extends `Job` and `ScheduleEntry` models; adds a new small `ScheduleSetting` table (or singleton row) for the capacity value.

**Testing**: No automated test suite currently exists in this repo (manual verification via `quickstart.md`); this plan does not introduce a new test framework.

**Target Platform**: Existing Docker/Azure App Service deployment (Node 20 Alpine), no infra change.

**Project Type**: Web application (existing `backend/` + `frontend/` split).

**Performance Goals**: Capacity checks must complete within the normal request/response cycle (no batch/async processing needed) — sum queries over `ScheduleEntry` scoped by date range, expected to stay well under 100ms given current data volume.

**Constraints**: Must reuse existing `getPrisma()` singleton, existing route/middleware conventions, existing i18n system, existing `StaffMember.role`/permission-flag pattern (`canAccessSchedule`, etc.) rather than inventing a parallel auth mechanism.

**Scale/Scope**: Single company-wide capacity value; affects the Schedule module, Job create/edit forms, Dashboard, and the schedule-sync service that auto-creates entries from job dates.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Surface-Specific Language Policy**: PASS — all new web text (capacity control, warnings, override dialog, needs-attention badge, dashboard card) goes through `i18n.jsx` in EN/ES; the needs-attention flag and `SCHEDULE_MANAGER` permission are stored as language-neutral booleans/strings, not localized text. No operator or client-facing mobile screens are touched.
- **II. Auditability of Material Changes**: PASS — new writes (capacity change, job workers/days fields, schedule entry override/reason, worker reassignment, job date moves) go through existing route handlers and MUST call `logAudit(...)` exactly as existing `ScheduleEntry`/`Job` mutations do today.
- **III. Role-Based Access Control**: PASS — introduces `canManageSchedule` (Scheduling Manager) as a new permission flag on `StaffMember`, following the exact pattern of `canAccessSchedule`. Both a backend middleware check and a frontend guard will gate capacity edits and override-resolution actions. Existing `canAccessSchedule` users retain read/manual-scheduling access but not manager-only actions.
- **IV. Azure-Native Auth & Storage**: PASS — no new storage or auth mechanism introduced; capacity setting and new fields are plain Prisma-managed data.
- **V. Prisma Singleton Data Access**: PASS — all new queries go through `getPrisma()`; no raw SQL planned (capacity sums use standard Prisma aggregate/groupBy).
- **VI. Preserve Domain & Contract Invariants**: PASS — extends `Job` and `ScheduleEntry` with additive, optional/defaulted columns only; does not rename or remove existing fields; `scheduleSync.js` auto-generation behavior is preserved and extended (not replaced) to add capacity checks; PUT payload conventions (full-object updates) are followed for any new/changed endpoints.
- **VII. Incremental, Low-Risk Change**: PASS — feature is additive: new columns, one new small settings table, capacity-check logic layered into the existing schedule creation/update/sync paths, and one new dashboard card, rather than restructuring the Schedule module.

No violations requiring Complexity Tracking justification.

## Project Structure

### Documentation (this feature)

```text
specs/009-schedule-worker-limits/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── prisma/
│   └── schema.prisma          # Job.workersRequired/daysToComplete, ScheduleEntry.needsAttention/overrideReason,
│                               # new ScheduleSetting model, StaffMember.canManageSchedule
├── routes/
│   ├── schedule.js             # capacity get/put endpoint, needs-attention query params, override/resolve endpoints
│   └── jobs.js                 # workersRequired/daysToComplete on create/update
├── services/
│   └── scheduleSync.js         # capacity check integrated into auto-scheduling from job dates
└── index.js                    # no new route mount needed (reuses /api/schedule and /api/jobs)

frontend/
└── src/
    ├── i18n.jsx                 # new EN/ES keys for capacity control, warnings, override dialog, needs-attention, dashboard card
    ├── constants.js              # needs-attention status metadata (badge color/label)
    ├── dashboardCards.js         # new 'schedule_attention' card entry
    └── pages/
        ├── Schedule/             # capacity control UI, override dialog, needs-attention indicator/badge, manager resolution tools
        ├── Jobs/                 # workersRequired/daysToComplete fields on job form
        └── Dashboard.jsx          # new needs-attention card rendering
```

**Structure Decision**: Existing `backend/` (Express + Prisma) and `frontend/` (React + Vite) split is reused as-is; this feature adds fields/endpoints to existing modules (`schedule`, `jobs`, `dashboard`) rather than creating new top-level modules.

## Complexity Tracking

*No Constitution Check violations — table intentionally omitted.*

