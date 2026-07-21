# Phase 0 Research: Origin Warehouse Field for Import Jobs

**Feature**: 001-origin-warehouse-field
**Date**: 2026-07-21

The feature is small and the codebase conventions are well established, so
research focused on confirming where the origin fields live and how to add a
new field consistently. No open `NEEDS CLARIFICATION` items remain.

## Decision 1: Data storage — new column on `Job`

- **Decision**: Add `originWarehouse String?` (nullable) to `model Job` in
  `backend/prisma/schema.prisma`, placed next to the existing origin columns
  (`originAddress`, `originCity`, `originCountry`). Apply with
  `npx prisma db push` then `npx prisma generate` from `backend/`.
- **Rationale**: Mirrors the existing origin fields exactly; nullable satisfies
  the "field can be empty" requirement and keeps existing records valid without
  a data migration. Complies with Constitution Principle VI (additive, preserves
  invariants) and V (Prisma singleton + push/generate workflow).
- **Alternatives considered**:
  - Store on `MovingFile` or `Visit` — rejected: the field is a property of the
    job's origin, and the user explicitly asked for it on Import Jobs after the
    Origin Address, which is rendered from the Job record.
  - Reuse `notes` / free-text blob — rejected: not queryable or displayable as a
    discrete labeled field, and contradicts the requirement for a named field.

## Decision 2: API handling — pass-through in existing jobs routes

- **Decision**: Add `originWarehouse` to the destructured request body and to the
  Prisma `create`/`update` data in `backend/routes/jobs.js` (POST `/` and PUT
  `/:id`), alongside `originAddress`.
- **Rationale**: The frontend already sends the full form object on PUT (full-PUT
  convention, Principle VI). Handling the field where sibling origin fields are
  handled keeps the contract consistent and avoids new endpoints (Principle III,
  VII). No change to `forbidBodegaWrite` guarding.
- **Alternatives considered**: A dedicated patch endpoint — rejected as
  unnecessary complexity for one scalar field.

## Decision 3: UI placement — origin row in `JobDocument.jsx`

- **Decision**: Add an "Origin Warehouse" input in `JobDocument.jsx` immediately
  after the Origin Address input in the "Row 6: Origin Address" block, following
  the existing `addrInput(...)`/`fv('originAddress')`/`ch('originAddress')`
  pattern. Wire the field into `JobForm.jsx` initial state, the edit-load mapping
  (`job.originWarehouse`), the quote/visit prefill mappings, and the submit
  payload (already spread via `...form`).
- **Rationale**: The editable Origin Address field is rendered by `JobDocument`
  (used by `JobForm` in `editMode`), not directly in `JobForm`. Placing the new
  field there guarantees it appears "after Origin Address" as requested. Scope to
  Import via the existing `isImport` flag where appropriate.
- **Alternatives considered**: Adding the input directly in `JobForm.jsx` —
  rejected: `JobForm` delegates origin rendering to `JobDocument`, so the field
  would not appear next to Origin Address.

## Decision 4: Bilingual label

- **Decision**: Add a `jobFields.originWarehouse` (or equivalent, matching the
  file's existing key structure) entry to both the `en` (`"Origin Warehouse"`)
  and `es` (`"Almac\u00e9n de Origen"`) maps in `frontend/src/i18n.jsx`.
- **Rationale**: Constitution Principle I (Bilingual by Default) requires both
  languages; the label must not be hardcoded.
- **Alternatives considered**: Hardcoding the Spanish label inline (the origin
  inputs currently pass literal Spanish placeholders like `'Direcci\u00f3n'`) —
  acceptable to match local style if the surrounding inputs are hardcoded, but a
  proper i18n key is preferred and will be used for the visible field label.

## Open Questions

None. All requirements from the spec are resolved by the decisions above.
