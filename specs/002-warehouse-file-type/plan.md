# Implementation Plan: Warehouse File Type and Packing Item Type Management

**Branch**: `002-warehouse-file-type` | **Date**: 2026-08-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-warehouse-file-type/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Three additive changes to the existing web application:

1. **WAREHOUSE category** on `MovingFile` — adds `B-` auto-numbering, appears in the
   Files section alongside Export/Import/Local, supports OPEN/CLOSED lifecycle.
2. **WAREHOUSE job type** — auto-created and linked when a Warehouse File is saved,
   with schedule entry creation following the same `syncJobScheduleEntries` pattern.
3. **PackingItemType catalog** — new Prisma model, ADMIN-only CRUD web UI, and a
   read-only `GET /api/packing-item-types` endpoint for the forthcoming mobile app.

All three are additive string-value extensions to existing string-typed fields
(no Prisma enums to migrate) plus one new table. Approach mirrors existing patterns
exactly: `CATEGORY_PREFIX` map, `generateFileNumber()`, `syncJobScheduleEntries`,
`RequireAdmin`, and the `en`/`es` i18n maps.

## Technical Context

**Language/Version**: Node.js (Express) backend + React 18 (Vite) frontend, JavaScript/JSX

**Primary Dependencies**: Express, Prisma 5, React 18, React Router — all existing;
`@azure/storage-blob` for attachments (unchanged); no new dependencies

**Storage**: PostgreSQL via Prisma (`getPrisma()` singleton); one new table
(`PackingItemType`); two string-field additions on existing tables (no migration
beyond `prisma db push`)

**Testing**: Manual validation via quickstart; no automated test harness in repo

**Target Platform**: Web app (Express :3001 / container :8080, React SPA :5173)

**Project Type**: Web application (backend + frontend monorepo)

**Performance Goals**: No change to existing profile; all additions are scalar
columns or a small catalog table

**Constraints**: Additive only — no changes to existing EXPORT/IMPORT/LOCAL logic;
full-PUT convention on all update handlers; `forbidBodegaWrite` middleware must
guard all write endpoints for the new catalog

**Scale/Scope**: ~5 backend route changes/additions, 1 new route file, ~4 frontend
pages/components modified or created, ~20 new i18n keys, 1 new Prisma model

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v1.0.0:

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Bilingual by Default (EN/ES) | PASS | New WAREHOUSE labels and all PackingItemType UI text added to both `en` and `es` maps in `i18n.jsx`; no hardcoded strings. |
| II. Auditability of Material Changes | PASS | File and job creation flow through existing `logAudit`; PackingItemType writes will include audit calls. |
| III. Role-Based Access Control | PASS | PackingItemType mutation endpoints guarded by `forbidBodegaWrite`; admin UI wrapped in `<RequireAdmin>`. |
| IV. Azure-Native Auth & Storage | PASS | No auth or storage changes; attachments on Warehouse Files use the same Azure Blob path as other files. |
| V. Prisma Singleton Data Access | PASS | All DB access via `getPrisma()`; schema change followed by `prisma db push` + `prisma generate`. |
| VI. Preserve Domain & Contract Invariants | PASS | EXPORT/IMPORT/LOCAL numbering, route ordering, and job auto-creation rules are untouched; WAREHOUSE is purely additive. |
| VII. Incremental, Low-Risk Change | PASS | Mirrors existing patterns exactly; no rewrites. |

**Result**: PASS — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

Touches existing files only except for one new backend route file and two new frontend pages.

```text
backend/
├── prisma/
│   └── schema.prisma              # ADD: PackingItemType model
└── routes/
    ├── movingFiles.js             # MODIFY: add WAREHOUSE to CATEGORY_PREFIX + generateFileNumber; POST handler; i18n label
    ├── jobs.js                    # MODIFY: add WAREHOUSE to job type handling + scheduleSync call
    └── packingItemTypes.js        # NEW: GET /api/packing-item-types, POST, PUT /:id, PATCH /:id/deactivate
    (register in backend/index.js before /api/files)

frontend/
└── src/
    ├── i18n.jsx                   # ADD: WAREHOUSE labels (movingFiles + types), PackingItemType UI keys (en + es)
    ├── constants.js               # ADD: WAREHOUSE to TYPE_META / FILE_CATEGORY type badge colours
    ├── App.jsx                    # ADD: /admin/packing-item-types route (wrapped in RequireAdmin)
    └── pages/
        ├── Files/
        │   ├── FilesList.jsx      # MODIFY: add WAREHOUSE filter option; add nav entry
        │   ├── FileDetail.jsx     # MODIFY: allow WAREHOUSE category (status chips, tabs)
        │   └── FileForm.jsx       # MODIFY: add WAREHOUSE as selectable category
        └── Admin/
            ├── AdminPage.jsx      # MODIFY: add link to Packing Item Types management
            └── PackingItemTypes/  # NEW
                └── PackingItemTypesPage.jsx  # NEW: list + inline create/edit/deactivate
```

**Structure Decision**: Web application (single repo, `backend/` Express + Prisma,
`frontend/` React/Vite). All changes are additive to existing files plus one new
route module and one new admin page.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitution violations. This section is intentionally empty.
