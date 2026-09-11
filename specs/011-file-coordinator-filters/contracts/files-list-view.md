# Contract: File screen coordinator filter (URL + view)

**Feature**: `011-file-coordinator-filters` | **Phase**: 1 | **Change type**: additive (frontend view contract)

This contract covers the user-facing interface of the four file screens. The backend list endpoint
`GET /api/files` is **unchanged** — see [research.md](../research.md) Decision 1.

## Routes

| Screen | Route |
|---|---|
| Export files | `/files/export` |
| Import files | `/files/import` |
| Local files | `/files/local` |
| Warehouse files | `/files/warehouse` |

All four render the same `FilesList` component with a different `category` prop.

## Query parameter

`?coordinator=<value>`

| Value | Meaning |
|---|---|
| *(absent)* | All coordinators (default) |
| `unassigned` | Only files with no effective coordinator |
| `<StaffMember.id>` | Only files whose effective coordinator is that staff member |

Rules:

- The value is language-neutral: `unassigned` is a fixed token, never a translated label.
- The parameter is the single source of truth for the filter — the control reads from and writes to the
  URL, so a deep link opens the screen already filtered (FR-008, FR-013).
- Changing the filter replaces the current history entry's parameter; the browser back button returns to
  the previous filter state.
- The parameter is cleared when the user switches to a different file category, matching the existing
  reset of search/status/visibility on category change.
- An unrecognized value (e.g. a deleted staff id) produces the standard empty state — never an error
  (data-model V7).
- It composes by logical AND with the existing `search`, visibility (`active` / `deleted` / `all`),
  `showClosed`, and status-chip filters (FR-002).

## Filter control

- Rendered as a labelled chip row beneath the status chips, on all four screens.
- One chip per effective coordinator holding at least one file in the current view, sorted by name, plus
  an "Unassigned" chip. Each chip shows the matching file count.
- Chip counts reflect the other active filters (search, visibility, closed, status chips) but not the
  coordinator selection itself, so the row never contradicts the status row.
- Chips are single-select: clicking the active chip clears the filter. A clear button appears while a
  filter is active.
- Chips use a neutral style distinct from the status chips so the two rows are not confused.
- A coordinator absent from `GET /api/staff?canCoordinateFiles=true` (inactive or no longer eligible) is
  still shown while holding files, marked with the inactive label (FR-003).
- The row label and all sentinel labels come from `i18n.jsx` in both EN and ES.

## List columns

| Column | EXPORT | IMPORT | LOCAL | WAREHOUSE |
|---|---|---|---|---|
| Coordinator | shown | shown | **shown (new)** | shown |

- The cell renders `effectiveCoordinator(file)?.name`.
- When there is no effective coordinator the cell renders the localized unassigned label — not a blank
  cell and not a bare dash (FR-006).
- Position and formatting are identical across all four categories (FR-005).

## Result count

The existing page subtitle reports the number of rows currently displayed after all active filters,
satisfying FR-007 with no new element.

## Deep links produced by the dashboard card

Each non-zero count cell on the coordinator workload card links to:

```text
/files/{export|import|local|warehouse}?coordinator={staffId|unassigned}
```

The destination list, viewed with the default visibility (`active`) and closed files hidden, must contain
exactly the number of rows shown in the originating cell (data-model V1).
