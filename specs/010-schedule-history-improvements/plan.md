# Implementation Plan: Schedule History & Job Scheduling Visibility

**Branch**: `010-schedule-history-improvements` | **Date**: 2026-09-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-schedule-history-improvements/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Combine the existing `AuditLog` history for a `Job` with the `AuditLog` history of any `ScheduleEntry` linked to that job (by `jobId` inside the stored `before`/`after` JSON snapshots) into one chronological, source-labeled timeline on the Job History tab. Separately, derive a lightweight "scheduled" boolean (does the job/file currently have at least one active `ScheduleEntry`?) and surface it as a calendar icon on the Jobs list, Files lists, and Files summary — clicking the icon deep-links into the Schedule page for the relevant date. No new tables are required: `AuditLog` already records `ScheduleEntry` CREATE/UPDATE/DELETE (including from `scheduleSync.js` auto-generation) with the job linkage preserved in the JSON snapshots, and `Job`/`MovingFile` already relate to `ScheduleEntry` via `scheduleEntries`/`job.scheduleEntries`.

## Technical Context

**Language/Version**: Node.js (CommonJS) backend on Express; React 18 (JSX, Vite) frontend — matches existing stack, no new runtime.

**Primary Dependencies**: Express + Prisma 5 (`getPrisma()` singleton) on the backend; React Router (`react-router-dom`), the central `api.js` axios instance, and the existing `AuditHistory.jsx` component pattern on the frontend.

**Storage**: PostgreSQL via Prisma. No schema migration needed — reuses `AuditLog` (`entityType`, `entityId`, JSON `before`/`after`) and the existing `Job.scheduleEntries` / `MovingFile.job` relations.

**Testing**: No automated test suite exists in this repo; verification is manual via the `quickstart.md` scenarios (matches existing project convention).

**Target Platform**: Existing web application (Azure App Service container), same deployment pipeline — no new platform surface.

**Project Type**: Web application (frontend + backend), extending existing routes/components — Option 2 (Web application) structure below.

**Performance Goals**: Jobs/Files list pages must remain single-request, no per-row follow-up calls; "scheduled" status must be computed from data already included in the existing list queries (add a lightweight `scheduleEntries` selection, not a second round-trip).

**Constraints**: Must preserve Constitution invariants — audit history is append-only and never overwritten (Principle II), full-object PUT semantics on any updated route (Principle VI), i18n strings added to both EN/ES maps (Principle I), route registration order preserved (Principle VI), Prisma singleton access only (Principle V).

**Scale/Scope**: Touches `backend/routes/audit.js` (combined query), `backend/routes/jobs.js` and `backend/routes/movingFiles.js` (list `scheduled` flag), `frontend/src/components/AuditHistory.jsx` (or a thin wrapper) for the combined timeline, `frontend/src/pages/Jobs/JobsList.jsx`, `frontend/src/pages/Files/FilesList.jsx`, the files summary/dashboard view, and `frontend/src/pages/Schedule/SchedulePage.jsx` to accept a deep-link date param. No new backend models.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Surface-Specific Language Policy** — PASS. All new UI text (origin labels, tooltips) is web-only and will be added to both `en`/`es` maps in `i18n.jsx`; no mobile surfaces touched.
- **II. Auditability of Material Changes** — PASS (by design). This feature is additive read-composition over the existing `AuditLog`; it introduces no new writes to history and does not alter existing audit-write call sites. No entries are dropped, weakened, or bypassed.
- **III. Role-Based Access Control** — PASS. The combined history read uses the same `/api/audit` endpoint already available to any authenticated user for a record's History tab; no new role gate is introduced. The Jobs/Files list scheduled-status field is read-only additive data on existing role-gated list endpoints — no access change.
- **IV. Azure-Native Auth & Storage** — PASS. No file storage or auth flow changes.
- **V. Prisma Singleton Data Access** — PASS. All new queries go through `getPrisma()`; JSON-path filtering on `AuditLog.before`/`after` uses Prisma's native JSON filter support (no raw SQL).
- **VI. Preserve Domain & Contract Invariants** — PASS. No numbering, weight-field, or PUT-payload semantics change. Route registration order in `backend/index.js` is unaffected (no new route files).
- **VII. Incremental, Low-Risk Change** — PASS. Reuses existing `AuditLog` rows and existing `ScheduleEntry`/`Job` relations; no rewrite of `AuditHistory.jsx`, `scheduleSync.js`, or list endpoints beyond additive fields/query params.

No violations — Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/010-schedule-history-improvements/
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
├── routes/
│   ├── audit.js          # extend GET / to merge linked ScheduleEntry logs when entityType=Job
│   ├── jobs.js            # extend GET / (list) to include scheduleEntries for the scheduled flag
│   └── movingFiles.js     # extend GET / (list) to include job.scheduleEntries for the scheduled flag
└── prisma/
    └── schema.prisma      # no changes expected (reuses AuditLog + ScheduleEntry relations)

frontend/
├── src/
│   ├── i18n.jsx                        # new EN/ES keys: origin labels, scheduled/not-scheduled tooltips
│   ├── constants.js                    # optional: scheduled-icon style/meta helper
│   ├── components/
│   │   └── AuditHistory.jsx            # render a "source" badge (Job vs Schedule) per entry
│   └── pages/
│       ├── Jobs/JobsList.jsx           # calendar icon column + click-through to Schedule day
│       ├── Files/FilesList.jsx         # calendar icon column + click-through to Schedule day
│       ├── Dashboard.jsx               # files summary calendar icon
│       └── Schedule/SchedulePage.jsx   # accept a deep-link date (e.g. ?date=YYYY-MM-DD) to open that day
```

**Structure Decision**: Option 2 (Web application: existing `backend/` + `frontend/` split). This feature is purely additive within the existing route/component files listed above — no new backend models, no new top-level directories.

## Complexity Tracking

*No Constitution Check violations — this section is intentionally left empty.*
