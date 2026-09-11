# Quickstart: Validating File Coordinator Filters & Coordination Counts

**Feature**: `011-file-coordinator-filters` | **Phase**: 1

Manual validation guide — this repository has no automated test suite, so these scenarios are the
acceptance gate. Each scenario maps to spec requirements and the invariants in
[data-model.md](./data-model.md#5-validation-rules--invariants).

---

## Prerequisites

- Backend `.env` configured (`DATABASE_URL`, Azure storage vars) and the database reachable.
- **No schema change is needed** — `prisma db push` / `prisma generate` are *not* required for this
  feature. If you ran them for unrelated work, that is fine but not part of this validation.
- Test data in the database:
  - At least two staff members with `canCoordinateFiles = true`, one of whom is `isActive = false` while
    still coordinating at least one open file.
  - Open files in **all four** categories: EXPORT, IMPORT, LOCAL, WAREHOUSE.
  - At least one EXPORT file with **no** `coordinatorId` but a linked job that **has** a coordinator
    (exercises the FR-004 fallback).
  - At least one file per category with no coordinator anywhere (Unassigned group).
  - At least one soft-deleted file with a coordinator (exercises V8).

## Start the app

Start the backend and frontend yourself in separate terminals (the agent should not start them):

```powershell
Set-Location backend
node index.js          # http://localhost:3001
```

```powershell
Set-Location frontend
npm run dev            # http://localhost:5173, proxies /api -> :3001
```

Restart the backend after any change under `backend/` — Express does not hot-reload.

---

## Scenario 1 — Coordinator filter on every file screen (US1, FR-001, FR-002, FR-007)

1. Open `/files/export`. Confirm a coordinator chip row is present beneath the status chips, with a row
   label, one chip per coordinator holding files, an "Unassigned" chip, and a count on each chip.
2. Select a coordinator chip. **Expect**: only that person's files remain; the page subtitle count
   drops to match the visible rows; no full-page reload or spinner (the filter is local).
3. Type part of a file number in the search box. **Expect**: results honour both the search and the
   coordinator selection.
4. Toggle a status chip and the "Show closed" checkbox. **Expect**: all filters combine with AND, and the
   counts on each chip row reflect the other row's selection.
5. Select the "Unassigned" chip. **Expect**: only files with no coordinator shown.
6. Click the active chip again (or the clear button). **Expect**: the unfiltered list is restored.
7. Repeat steps 1–6 on `/files/import`, `/files/local`, and `/files/warehouse`.

## Scenario 2 — Coordinator visible on Local files (US2, FR-005, FR-006)

1. Open `/files/local`. **Expect**: a Coordinator column in the same position as on `/files/export`.
2. Find a Local file with a coordinator. **Expect**: the person's name is rendered.
3. Find a Local file without one. **Expect**: an explicit unassigned label — not an empty cell (V4).
4. Compare the column header and cell styling side by side with `/files/export`. **Expect**: identical.

## Scenario 3 — Effective coordinator fallback (FR-004, V3)

1. Open `/files/export` and locate the file whose coordinator comes only from its linked job.
2. **Expect**: the list shows the job's coordinator, not "unassigned".
3. Filter by that coordinator. **Expect**: the file is included.
4. Filter by "Unassigned". **Expect**: the file is **not** included.

## Scenario 4 — Card ↔ list reconciliation (SC-003, V1, V2, FR-011)

1. Open the dashboard, open the card library, and enable the coordinator workload card. **Expect**: it
   was hidden by default (FR-014).
2. Read a non-zero cell, e.g. Ana × Import = 3.
3. Click that cell. **Expect**: navigation to `/files/import?coordinator=<Ana's id>` with the filter
   already applied and exactly 3 rows (default visibility, closed hidden).
4. Repeat for the Unassigned row in at least two categories.
5. Verify each column total equals the sum of its cells, and that it equals the number of open,
   non-deleted files of that category.
6. Verify the grand total equals the sum of all row totals.

## Scenario 5 — Card scope and edge cases (FR-010, FR-012, V6, V8)

1. Confirm the card displays a note stating it counts open, non-deleted files only.
2. Close a file that appears in the card, reload the dashboard. **Expect**: the count drops by one.
3. Soft-delete a file with a coordinator, reload. **Expect**: the card count drops; the file is still
   reachable on its screen with visibility = "Deleted" **and** still filterable by that coordinator (V8).
4. Confirm the inactive coordinator from the prerequisites still appears in the card and in the chip row,
   marked inactive (V6).
5. Remove a file's coordinator through the file detail screen, reload both surfaces. **Expect**: it moves
   into the Unassigned group in the card and in the filter (V5).
6. Confirm the Unassigned row is rendered even for categories where its count is 0.

## Scenario 6 — URL behavior (FR-008, FR-013, V7)

1. With a coordinator filter active, copy the URL, open it in a new tab. **Expect**: the screen loads
   already filtered with the same rows.
2. Press the browser back button. **Expect**: the previous filter state is restored.
3. Switch to another file category via the navigation. **Expect**: the coordinator parameter is cleared.
4. Manually visit `/files/export?coordinator=does-not-exist`. **Expect**: the standard empty state, no
   error banner and no console exception (V7).

## Scenario 7 — Bilingual coverage (Constitution I, SC-006)

1. In English, note every new label: coordinator chip row label, "Unassigned" (chip, card row, and list
   cell), the Local Coordinator column header, the inactive marker, the card title,
   description, column headers, totals row, and the scope note.
2. Switch the app to Spanish and revisit `/files/local`, `/files/export`, and the dashboard card.
3. **Expect**: every string above is translated — no English fallback, no raw `movingFiles.*` or
   `dashboard.store.cards.*` key rendered on screen.

## Scenario 8 — Non-regression (Constitution II, VI, VII)

1. Confirm the Export/Import status dropdown in the list still saves, and that Local rows remain
   read-only for status, exactly as before.
2. Confirm delete and restore actions still work on a file row.
3. Confirm the schedule icon column and attachment counts are unchanged on all four screens.
4. Confirm every other dashboard card still renders with correct values (the new key is additive).
5. Confirm the file detail screen and its History tab are unchanged — this feature writes nothing.

---

## Definition of done

- [ ] Scenarios 1–8 pass on all four file categories where applicable.
- [ ] Card counts equal filtered list counts for every combination checked (SC-003).
- [ ] No new string is missing from either the `en` or `es` map in `i18n.jsx`.
- [ ] No `prisma db push` was required; `git status` shows no change to `schema.prisma`.
- [ ] No new route registered in `backend/index.js`; route order untouched.
