# Research: File Coordinator Filters & Coordination Counts

**Feature**: `011-file-coordinator-filters` | **Date**: 2026-09-10 | **Phase**: 0

The spec contains no `[NEEDS CLARIFICATION]` markers. This document records the codebase findings and
the technical decisions that resolve each open design question before Phase 1.

---

## Codebase baseline (verified)

| Fact | Location |
|---|---|
| `FilesList.jsx` is a single shared component driven by a `category` prop for EXPORT / IMPORT / LOCAL / WAREHOUSE | [frontend/src/pages/Files/FilesList.jsx](../../frontend/src/pages/Files/FilesList.jsx) |
| The coordinator column already exists but is wrapped in `category !== 'LOCAL'` guards (header and cell) | [FilesList.jsx](../../frontend/src/pages/Files/FilesList.jsx) |
| The EXPORT fallback rule already exists inline: `f.coordinator?.name \|\| (category === 'EXPORT' ? f.job?.coordinator?.name : null) \|\| '—'` | [FilesList.jsx](../../frontend/src/pages/Files/FilesList.jsx) |
| Status chips + `showClosed` filter client-side; `search` and visibility filter server-side | [FilesList.jsx](../../frontend/src/pages/Files/FilesList.jsx) |
| `GET /api/files` supports `category`, `status`, `notStatus`, `search`, `includeDeleted`, `onlyDeleted` — no pagination | [backend/routes/movingFiles.js](../../backend/routes/movingFiles.js) |
| `GET /api/files` already selects `coordinator {id,name}` **and** `job.coordinator {id,name}` for every category | [backend/routes/movingFiles.js](../../backend/routes/movingFiles.js) |
| `MovingFile.coordinatorId` → `StaffMember` relation `"FileCoordinator"`; `Job.coordinatorId` → relation `"JobCoordinator"` | [backend/prisma/schema.prisma](../../backend/prisma/schema.prisma) |
| `StaffMember` has `name`, `isActive`, `canCoordinateFiles` | [backend/prisma/schema.prisma](../../backend/prisma/schema.prisma) |
| `GET /api/staff?canCoordinateFiles=true` returns eligible coordinators (active only unless `includeInactive=true`) | [backend/routes/staff.js](../../backend/routes/staff.js) |
| Dashboard builds every metric in one handler, batching queries in a single `Promise.all`, then returns one flat JSON object | [backend/routes/dashboard.js](../../backend/routes/dashboard.js) |
| `myCoordinations` already queries `movingFile` with `{ status: 'OPEN', deletedAt: null, coordinator: { azureOid: oid } }` — precedent for the card's scope | [backend/routes/dashboard.js](../../backend/routes/dashboard.js) |
| Dashboard cards are registered in `DASHBOARD_CARDS` with `{ id, titleKey, descKey, defaultVisible }` and gated by `isVisible(cardId)` from `useDashboardLayout()` | [frontend/src/dashboardCards.js](../../frontend/src/dashboardCards.js), [frontend/src/pages/Dashboard.jsx](../../frontend/src/pages/Dashboard.jsx) |
| File i18n keys use the `movingFiles.*` prefix; card keys use `dashboard.store.cards.*` | [frontend/src/i18n.jsx](../../frontend/src/i18n.jsx) |

---

## Decision 1 — Filter client-side in `FilesList`, not via a new API query parameter

**Decision**: Apply the coordinator filter in the browser, over the file array already fetched by
`GET /api/files?category=…`. Do **not** add a `coordinatorId` query parameter to the list endpoint.

**Rationale**:
- The list endpoint is unpaginated and already returns the entire category set, including `coordinator`
  and `job.coordinator` for every row. Everything needed to evaluate FR-004 is already in the payload.
- Filtering locally makes the filter instant with no request (SC-005) and makes it structurally
  impossible for the rendered coordinator column and the filtered result set to disagree.
- It matches the existing behavior of the status chips and `showClosed`, which already filter client-side
  and compute their per-status counts from the same in-memory array — so FR-007's result count comes for
  free from the existing `displayed.length` subtitle.
- Principle VII: no new `where` branch on a heavily used production endpoint.

**Alternatives considered**:
- *Server-side `coordinatorId` parameter*: would require a compound Prisma `where` to express the job
  fallback (`OR: [{coordinatorId: id}, {AND: [{coordinatorId: null}, {job: {coordinatorId: id}}]}]`) and
  an even more awkward negation for "unassigned". More code, more risk, no user-visible benefit while the
  endpoint stays unpaginated. Revisit only if/when the file lists gain server-side pagination.
- *Prisma `groupBy` on `coordinatorId`*: cannot express the job-level fallback in a single grouping.

---

## Decision 2 — One explicit "effective coordinator" helper per layer

**Decision**: Add `effectiveCoordinator(file)` to `frontend/src/constants.js` and an equivalent
`effectiveCoordinator(file)` in a new `backend/services/coordinators.js`. Every consumer — LOCAL/EXPORT/
IMPORT/WAREHOUSE column, the filter predicate, and the dashboard aggregation — calls the helper. The
inline expression currently in the EXPORT cell is replaced by the helper call.

**Rationale**:
- SC-003 requires card counts to equal filtered list rows for 100% of combinations; that only holds if
  both sides evaluate the same rule.
- Principle VII explicitly requires normalization logic to live in explicit helpers rather than be
  duplicated at call sites.
- Two implementations are unavoidable (one per runtime, no shared module between `backend/` and
  `frontend/` in this repo), but reducing it to exactly two, each with a single definition and a
  reciprocal comment, is the minimum achievable drift surface.

**Alternatives considered**:
- *Keep the rule inline at each site*: rejected — it is the direct cause of the current LOCAL/EXPORT
  inconsistency the spec is fixing.
- *Extract a shared package consumed by both builds*: rejected as over-engineering for a three-line rule;
  it would also change the Docker build layout, which Principle VII discourages.

**Fallback scope note**: the rule is applied uniformly to all categories, not just EXPORT. For IMPORT,
LOCAL and WAREHOUSE the file coordinator is normally set directly and the job fallback is simply never
reached, so uniform application is safe and removes a category special-case.

---

## Decision 3 — Carry the selection in the URL as `?coordinator=`

**Decision**: `FilesList` reads and writes the filter through `useSearchParams()` with the key
`coordinator`, whose value is either a `StaffMember.id` or the literal token `unassigned`. Absence of the
key means "all coordinators". The dashboard card links to `/files/{export|import|local|warehouse}?coordinator=…`.

**Rationale**:
- Satisfies FR-008 (linkable, bookmarkable, back-button-safe) and FR-013 (card cell → pre-filtered list)
  with one mechanism instead of two.
- `unassigned` is a language-neutral token, satisfying the constitution's rule that domain/grouping values
  never carry localized text.
- There is precedent in this codebase for URL-driven view state (`/schedule?date=…`,
  `/files/:id?includeDeleted=true`).

**Alternatives considered**:
- *Component state only*: fails FR-008 and FR-013.
- *Persist as a per-user preference*: explicitly out of scope per the spec's assumptions; would also
  surprise users returning to the screen.

**Reset behavior**: `FilesList` already resets `search`/`status`/`visibility` on `category` change. The
coordinator param must be treated the same way — switching category clears it — except when the user
arrives on the screen with the param already present in the URL (the deep-link case). Implementation
note: derive the filter from the URL rather than mirroring it into state, so the deep-link case needs no
special handling.

---

## Decision 4 — Chip row with counts, scoped to coordinators present in the view

**Decision**: Present the filter as a labelled chip row beneath the status chips — one chip per effective
coordinator holding at least one file in the current view (with its count), plus an "Unassigned" chip.
Chips are single-select and toggle off. Coordinators absent from
`GET /api/staff?canCoordinateFiles=true` (inactive or no longer eligible) are still shown, marked inactive.

**Rationale**:
- Matches the established filtering idiom on these screens (status chips), and surfaces the counts the
  user is after without requiring a selection first — the workload is readable at a glance.
- Scoping chips to coordinators present in the view keeps the row short; a coordinator with zero files in
  the category simply has no chip, which is the same information the count would have conveyed.
- Chip counts are computed before the coordinator filter is applied, so the row stays stable while a chip
  is selected. The status row is likewise counted after the coordinator filter, so the two rows report
  each other's effect and never contradict.
- Still covers the deactivated-coordinator edge case, which a plain staff-list source would not.

**Confusion risk and mitigation**: two chip rows could read as one. Mitigated by a row label, a distinct
neutral chip style (square-ish, slate) versus the status chips' coloured pills, and the reciprocal
counting above.

**Alternatives considered**:
- *Dropdown of all eligible staff* (the original design): compact, and allows selecting a coordinator with
  zero files, but hides the counts behind an interaction — the opposite of the feature's purpose.
- *Deriving chips from the staff list rather than the view*: produces a long row of zero-count chips on
  screens where few people coordinate.

---

## Decision 5 — Dashboard aggregate: one narrow `findMany`, grouped in JavaScript

**Decision**: Add to the dashboard handler's existing `Promise.all` batch:

```js
p.movingFile.findMany({
  where: { status: 'OPEN', deletedAt: null },
  select: {
    category: true,
    coordinator: { select: { id: true, name: true, isActive: true } },
    job: { select: { coordinator: { select: { id: true, name: true, isActive: true } } } },
  },
})
```

then reduce it with `buildCoordinatorWorkload()` from `backend/services/coordinators.js` into the
`coordinatorWorkload` response key. Column totals and the grand total are derived on the frontend from
the returned rows.

**Rationale**:
- `{ status: 'OPEN', deletedAt: null }` is exactly the scope FR-012 requires and matches the existing
  `myCoordinations` precedent, so the two cards cannot tell contradictory stories.
- A single narrow `select` over open files is comparable in cost to the several file queries the handler
  already runs, and joining the batch means no added wall-clock latency (SC-005).
- JavaScript grouping is required anyway because of the job fallback (see Decision 2); `groupBy` cannot
  express it.

**Alternatives considered**:
- *A dedicated `GET /api/dashboard/coordinator-workload` route*: would add a route file and a second
  round-trip on dashboard load for no benefit; the dashboard is already a single-call page.
- *Counting closed/deleted files too*: rejected — the card reports current workload (FR-012), and the
  card must state this scope so the numbers are not misread.

---

## Decision 6 — Card shape: coordinator × category matrix, hidden by default

**Decision**: Register `coordinator_workload` in `DASHBOARD_CARDS` with `defaultVisible: false`, rendered
as a table: one row per coordinator (only those with ≥ 1 file), a pinned "Unassigned" row, one column per
category plus a row-total column, and a footer row of column totals and the grand total. Each non-zero
count cell is a link to the matching file screen with `?coordinator=` applied.

**Rationale**:
- FR-009 through FR-014 map one-to-one onto this layout, and the existing card registry + `isVisible()`
  mechanism already gives persisted show/hide with no new code (FR-014).
- `defaultVisible: false` matches the spec assumption and every other non-core card, so existing
  dashboards are unchanged until a user opts in.
- Rendering the Unassigned row even when empty (FR/edge case: no coordinators yet) avoids a broken card.

**Alternatives considered**:
- *One card per category*: four cards for one question; harder to compare and clutters the card library.
- *Chart instead of a table*: counts must be read exactly and reconciled against the lists (SC-003);
  a table is the precise representation.

---

## Open risks

| Risk | Mitigation |
|---|---|
| Frontend and backend copies of the effective-coordinator rule drift | Single helper per layer, reciprocal comments naming the counterpart file; quickstart scenario 4 reconciles card counts against list counts |
| Card scope (open, non-deleted) misread as "all files" | Scope note rendered in the card (FR-012) and asserted in quickstart |
| Deep-linked coordinator no longer present in the dropdown | The chip row is built before the coordinator filter is applied, so the active selection always has a chip while any file matches; an unknown id yields the standard empty state plus a clear button, not an error |
