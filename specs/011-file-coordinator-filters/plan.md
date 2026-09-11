# Implementation Plan: File Coordinator Filters & Coordination Counts

**Branch**: `011-file-coordinator-filters` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-file-coordinator-filters/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Add a coordinator filter to the shared `FilesList` component (which already serves all four categories — EXPORT, IMPORT, LOCAL, WAREHOUSE), show the coordinator column on LOCAL files, and add a dashboard card that aggregates open, non-deleted files by effective coordinator × category.

No schema change is required: `MovingFile.coordinatorId → StaffMember("FileCoordinator")` already exists, and `GET /api/files` already returns both `coordinator` and `job.coordinator` for every category. The "effective coordinator" rule (FR-004) — file coordinator, else linked job coordinator, else unassigned — is today an inline expression in the FilesList EXPORT cell; this feature promotes it to one explicit helper per layer (`frontend/src/constants.js` and `backend/services/coordinators.js`) so the list column, the filter, and the dashboard counts cannot drift apart.

Filtering is done client-side in `FilesList` (the list endpoint already returns the full, unpaginated category set with the coordinator data attached), and the selection is carried in the URL as `?coordinator=<staffId>|unassigned` so the dashboard card can deep-link into an already-filtered list. The only backend change is one additional aggregate (`coordinatorWorkload`) on the existing `GET /api/dashboard` response.

## Technical Context

**Language/Version**: Node.js (CommonJS) + Express backend; React 18 (JSX) + Vite frontend — existing stack, no new runtime or dependency.

**Primary Dependencies**: Prisma 5 via the `getPrisma()` singleton; `react-router-dom` (`useSearchParams` for the URL-borne filter, `useNavigate` for card deep-links); the central `api.js` axios instance; the existing `useDashboardLayout()` card-visibility hook and `DASHBOARD_CARDS` registry.

**Storage**: PostgreSQL via Prisma. **No migration** — reuses `MovingFile.coordinatorId`, `Job.coordinatorId`, and `StaffMember` (`name`, `isActive`, `canCoordinateFiles`).

**Testing**: No automated test suite exists in this repo; verification is manual through [quickstart.md](./quickstart.md), consistent with features 001–010.

**Target Platform**: Existing web application only (Azure App Service container). No mobile surface is touched.

**Project Type**: Web application (`backend/` + `frontend/`) — Option 2 structure below.

**Performance Goals**: Zero additional round-trips on the file screens — the coordinator filter reuses the list payload already fetched, so changing the filter is instantaneous with no request. The dashboard gains exactly one extra query, added to the existing `Promise.all` batch so total dashboard latency is unchanged (SC-005).

**Constraints**: Constitution invariants — new EN/ES i18n keys for every label (I), no audit behavior changed since this is read-only (II), no access loosening (III), `getPrisma()` only and no raw SQL (V), no route-order or PUT-payload changes (VI), smallest viable change with logic centralized in helpers rather than duplicated (VII).

**Scale/Scope**: Touches `backend/routes/dashboard.js` (one query + one response key), a new `backend/services/coordinators.js` helper, `frontend/src/constants.js` (effective-coordinator helper), `frontend/src/i18n.jsx` (EN/ES keys), `frontend/src/dashboardCards.js` (one registry entry), `frontend/src/pages/Dashboard.jsx` (one card), and `frontend/src/pages/Files/FilesList.jsx` (filter control + LOCAL coordinator column). No new backend route files, no new models.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Surface-Specific Language Policy** — PASS. All new strings (filter label, "All coordinators", "Unassigned", LOCAL column header, inactive marker, card title/description/headers/totals/scope note) are web-only and go into both `en` and `es` maps in `i18n.jsx`. The unassigned group is carried as the language-neutral token `unassigned` in the URL and API, translated only at render time. No mobile surface is involved.
- **II. Auditability of Material Changes** — PASS. The feature is strictly read-only: no create, update, or delete path is added or modified, so no audit behavior can be weakened.
- **III. Role-Based Access Control** — PASS. No new role gate is introduced. The filter operates entirely on data the caller already received from `GET /api/files`, and the dashboard aggregate is served from the existing, already-authenticated `GET /api/dashboard` handler with the same visibility every dashboard consumer already has. The staff list used to populate the dropdown reuses the existing `GET /api/staff?canCoordinateFiles=true` endpoint. Nothing is loosened.
- **IV. Azure-Native Auth & Storage** — PASS. No attachment, blob, or auth flow is touched.
- **V. Prisma Singleton Data Access** — PASS. The single new aggregate query uses `getPrisma()` inside the existing dashboard handler. No raw SQL: the effective-coordinator fallback spans two relations and is resolved in JavaScript after one `findMany` with a narrow `select`.
- **VI. Preserve Domain & Contract Invariants** — PASS. `GET /api/dashboard` gains one additive response key (`coordinatorWorkload`); no existing key changes shape. `GET /api/files` is unchanged. No numbering, weight-field, or full-object-PUT semantics are affected. `backend/index.js` route registration order is untouched (no new route file).
- **VII. Incremental, Low-Risk Change** — PASS. Client-side filtering avoids new query parameters and new `where` construction on a heavily used list endpoint; the LOCAL coordinator column removes an existing `category !== 'LOCAL'` guard rather than adding a new column; the effective-coordinator rule is centralized in one helper per layer instead of being repeated at each call site.

No violations — the Complexity Tracking table is intentionally empty.

**Post-Phase 1 re-check**: PASS, unchanged. The Phase 1 design confirmed zero schema changes, zero new
routes, one additive response key, and read-only data access. The only item worth flagging is the
unavoidable two-runtime duplication of the effective-coordinator rule; it is confined to one helper per
layer and reconciled by quickstart Scenario 4 (see research.md Decision 2 and the Open Risks table).

## Project Structure

### Documentation (this feature)

```text
specs/011-file-coordinator-filters/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── dashboard-coordinator-workload.md
│   └── files-list-view.md
├── checklists/
│   └── requirements.md  # /speckit.specify output
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── routes/
│   └── dashboard.js              # + coordinatorWorkload query in the existing Promise.all + response key
├── services/
│   └── coordinators.js           # NEW: effectiveCoordinator(file) + buildCoordinatorWorkload(files)
└── prisma/
    └── schema.prisma             # NO CHANGE (MovingFile.coordinatorId / Job.coordinatorId already exist)

frontend/
└── src/
    ├── i18n.jsx                  # + EN/ES keys: movingFiles.coordinatorFilter*, dashboard.store.cards.coordinatorWorkload.*
    ├── constants.js              # + effectiveCoordinator(file) helper (single source for the FR-004 rule)
    ├── dashboardCards.js         # + { id: 'coordinator_workload', defaultVisible: false }
    └── pages/
        ├── Dashboard.jsx         # + coordinator workload card (matrix table, cells deep-link to file screens)
        └── Files/
            └── FilesList.jsx     # + coordinator chip row bound to ?coordinator= URL param
                                  # + coordinator column shown for LOCAL (drop the category !== 'LOCAL' guard)
                                  # + coordinator applied to the displayed/count pipeline alongside status chips
```

**Structure Decision**: Option 2 (web application: existing `backend/` + `frontend/` split). `FilesList.jsx` is already the single shared component for all four categories, so one edit there satisfies FR-001 and FR-005 for every file screen. The new `backend/services/coordinators.js` follows the existing `backend/services/` pattern (`scheduleStatus.js`, `scheduleCapacity.js`) and avoids a route-to-route import, which Principle V forbids.

## Complexity Tracking

*No Constitution Check violations — this section is intentionally left empty.*
