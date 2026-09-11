# Data Model: File Coordinator Filters & Coordination Counts

**Feature**: `011-file-coordinator-filters` | **Date**: 2026-09-10 | **Phase**: 1

**Schema changes: NONE.** Every field this feature needs already exists. No `prisma db push` /
`prisma generate` is required. This document defines the existing fields consumed and the derived,
in-memory structures the feature introduces.

---

## 1. Existing persisted entities (read-only)

### `MovingFile` — [backend/prisma/schema.prisma](../../backend/prisma/schema.prisma)

| Field | Type | Used for |
|---|---|---|
| `id` | `String` | Row identity, list links |
| `fileNumber` | `String` | List display |
| `category` | `String` | `EXPORT` \| `IMPORT` \| `LOCAL` \| `WAREHOUSE` — screen selection and card columns |
| `status` | `String` | `OPEN` \| `CLOSED` (plus `VOID` treated as terminal in the list) — card scope filter |
| `deletedAt` | `DateTime?` | Card scope filter (`null` only); list visibility filter |
| `coordinatorId` | `String?` | Primary side of the effective-coordinator rule |
| `coordinator` | `StaffMember?` | Relation `"FileCoordinator"` — `{ id, name, isActive }` |
| `jobId` / `job` | `Job?` | Fallback side of the effective-coordinator rule |

### `Job` — relevant subset

| Field | Type | Used for |
|---|---|---|
| `coordinatorId` | `String?` | Fallback coordinator when the file has none |
| `coordinator` | `StaffMember?` | Relation `"JobCoordinator"` — `{ id, name, isActive }` |

### `StaffMember` — relevant subset

| Field | Type | Used for |
|---|---|---|
| `id` | `String` | Filter value in `?coordinator=`, card row key |
| `name` | `String` | Display label, sort key |
| `isActive` | `Boolean` | Inactive marker in the dropdown and the card |
| `canCoordinateFiles` | `Boolean` | Eligibility filter for the dropdown source list |

**No field is written by this feature.** FR-016: coordinator assignment behavior is untouched.

---

## 2. Derived concept: Effective Coordinator

The single rule (FR-004), implemented once per layer
(`frontend/src/constants.js`, `backend/services/coordinators.js`):

```text
effectiveCoordinator(file):
  if file.coordinator        -> file.coordinator          # { id, name, isActive }
  else if file.job?.coordinator -> file.job.coordinator
  else                       -> null                      # the "unassigned" group
```

Properties that must hold everywhere:

- Applied uniformly to **all four categories** (not only EXPORT). For categories where the job fallback
  never fires, the result is identical to reading `file.coordinator` directly.
- `null` is the canonical representation of "unassigned"; the language-neutral token `unassigned` is used
  only where a string is required (URL parameter, API row key). Localized text is produced at render time.
- The same function backs the list column, the filter predicate, and the dashboard aggregation. Any
  divergence is a defect (SC-003).

**Filter predicate** (client-side, over the already-fetched list):

| `?coordinator=` value | Row is included when |
|---|---|
| absent | always (all coordinators) |
| `unassigned` | `effectiveCoordinator(file) === null` |
| `<staffId>` | `effectiveCoordinator(file)?.id === <staffId>` |

The predicate composes with the existing `search`, visibility, `showClosed` and status-chip filters by
logical AND (FR-002); the displayed row count feeds the existing result-count subtitle (FR-007).

---

## 3. Derived structure: Coordinator Filter Option (frontend, in-memory)

Built per screen; not persisted.

| Field | Type | Notes |
|---|---|---|
| `value` | `string` | `''` (all) \| `'unassigned'` \| `StaffMember.id` |
| `label` | `string` | Localized for the two sentinel options; `name` for staff |
| `isActive` | `boolean` | `false` entries get an inactive suffix |
| `eligible` | `boolean` | `false` for entries unioned in from loaded files only |

**Construction** (FR-003): start from `GET /api/staff?canCoordinateFiles=true`; union in every distinct
`effectiveCoordinator(file)` found in the loaded rows that is absent from that list (marked
`eligible: false`, `isActive` from the row data); sort by `name`; prepend the "all" and "unassigned"
sentinels.

---

## 4. Derived structure: Coordinator Workload Row (API, in-memory)

Returned as `coordinatorWorkload` on `GET /api/dashboard`. See
[contracts/dashboard-coordinator-workload.md](./contracts/dashboard-coordinator-workload.md).

| Field | Type | Notes |
|---|---|---|
| `coordinatorId` | `string \| null` | `null` identifies the Unassigned row |
| `name` | `string \| null` | `null` for the Unassigned row; the client renders a localized label |
| `isActive` | `boolean \| null` | `null` for the Unassigned row |
| `counts` | `{ EXPORT: number, IMPORT: number, LOCAL: number, WAREHOUSE: number }` | All four keys always present, zero-filled |
| `total` | `number` | Sum of `counts` |

**Scope**: `status === 'OPEN'` AND `deletedAt === null` (FR-012). **Ordering**: coordinators by `name`;
the Unassigned row is returned last and pinned in the UI. **Inclusion**: a coordinator row appears only
if `total > 0` (FR/edge case); the Unassigned row is always present, even with `total === 0`.

Column totals and the grand total (FR-011) are derived on the client from these rows — not sent — so
there is exactly one source of truth for every number on the card.

---

## 5. Validation rules & invariants

| # | Invariant | Source |
|---|---|---|
| V1 | For any coordinator C and category K, the card's `counts[K]` equals the number of rows on screen K filtered by C with visibility=active and closed files hidden | SC-003, FR-013 |
| V2 | Σ over all rows of `counts[K]` = number of open, non-deleted files of category K | FR-011 |
| V3 | Every file belongs to exactly one row (a coordinator row or Unassigned) — the rule is total and mutually exclusive | FR-004 |
| V4 | A list row with `effectiveCoordinator === null` renders an explicit unassigned label, never an empty cell | FR-006 |
| V5 | Removing a file's coordinator moves it into the Unassigned group on both surfaces with no other action | Edge case |
| V6 | A deactivated staff member holding ≥ 1 in-scope file remains selectable in the dropdown and visible in the card, marked inactive | FR-003, edge case |
| V7 | An unrecognized `?coordinator=` value yields the standard empty state, not an error | Edge case |
| V8 | Soft-deleted files are filterable by coordinator in the list (visibility = deleted/all) but never counted in the card | Edge case, FR-012 |

---

## 6. State transitions

None. This feature is read-only and introduces no new lifecycle. The only transition it observes is an
existing one: when `MovingFile.coordinatorId` (or the linked `Job.coordinatorId`) changes through the
existing edit flows, the file's group membership in both the filter and the card changes on the next
read (V5).
