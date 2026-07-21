# Implementation Plan: Origin Warehouse Field for Import Jobs

**Branch**: `001-origin-warehouse-field` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-origin-warehouse-field/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Add an optional free-text "Origin Warehouse" (Spanish: "Almacén de Origen") field
to jobs, displayed and editable immediately after the Origin Address on the job
work-order document, primarily for Import jobs so users know the facility where
the load must be collected. Technically this means: a new nullable `originWarehouse`
column on the `Job` Prisma model, pass-through handling in the jobs create/update
routes, a new input in the origin row of `JobDocument.jsx`, form state wiring in
`JobForm.jsx`, and bilingual (EN/ES) labels in `i18n.jsx`.

## Technical Context

**Language/Version**: Node.js (Express) backend + React 18 (Vite) frontend, JavaScript/JSX

**Primary Dependencies**: Express, Prisma 5, React 18, React Router, MSAL (auth) — all existing; no new dependencies

**Storage**: PostgreSQL via Prisma (`getPrisma()` singleton); new nullable `Job.originWarehouse` column

**Testing**: Manual validation via quickstart (no automated test harness in repo); verify create/edit/persist and empty-save

**Target Platform**: Web app served by Express (local :3001 / container :8080), React SPA

**Project Type**: Web application (backend + frontend in one repo)

**Performance Goals**: No change to existing performance profile; single scalar column, no new queries

**Constraints**: Field is optional/nullable; must not break existing job create/update; must follow full-object PUT convention

**Scale/Scope**: One new column, one API pass-through field, one new form input, two i18n label entries

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v1.0.0:

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Bilingual by Default (EN/ES) | PASS | New label added to both `en` and `es` maps in `i18n.jsx`; no hardcoded strings. |
| II. Auditability of Material Changes | PASS | Field flows through the existing job create/update path; existing audit behavior is preserved, not bypassed. |
| III. Role-Based Access Control | PASS | No new endpoint or role; reuses existing job routes guarded by `forbidBodegaWrite`. |
| IV. Azure-Native Auth & Storage | PASS | No storage/auth change; scalar DB column only. |
| V. Prisma Singleton Data Access | PASS | Uses existing routes that call `getPrisma()`; schema change followed by `prisma db push` + `prisma generate`. |
| VI. Preserve Domain & Contract Invariants | PASS | Additive nullable field; numbering, route order, full-PUT payload convention all preserved. |
| VII. Incremental, Low-Risk Change | PASS | Smallest additive change; mirrors the existing `originAddress`/`originCity` pattern. |

**Result**: PASS — no violations, no entries required in Complexity Tracking.

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

The change touches existing files only — no new source modules are created.

```text
backend/
├── prisma/
│   └── schema.prisma          # ADD: originWarehouse String? on model Job
└── routes/
    └── jobs.js                # ADD: originWarehouse to POST create + PUT update destructuring/writes

frontend/
└── src/
    ├── i18n.jsx               # ADD: jobFields.originWarehouse label in en + es
    └── pages/Jobs/
        ├── JobForm.jsx        # ADD: originWarehouse to initial state + job/visit load mappings + payload
        └── JobDocument.jsx    # ADD: Origin Warehouse input immediately after Origin Address (Row 6)
```

**Structure Decision**: Web application (single repo with `backend/` Express + Prisma
and `frontend/` React/Vite). This feature is a small additive change to existing
files; the editable origin fields live inside `JobDocument.jsx` (rendered by
`JobForm.jsx` in `editMode`), which is where the new field is placed.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitution violations. This section is intentionally empty.
