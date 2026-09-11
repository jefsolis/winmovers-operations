# Feature Specification: File Coordinator Filters & Coordination Counts

**Feature Branch**: `011-file-coordinator-filters`

**Created**: 2026-09-10

**Status**: Draft

**Input**: User description: "file coordinator counts - add a filter to all File screens (Import, Export, Local and Warehouse) to filter by Coordinator (assigned to a person or unassigned) so it's easy to see how many files are being coordinated by a specific person or how many don't have coordinator assigned. Currently, local File list don't have the coordinator field in the list view, we need to add it. We also need a dashboard card that shows how many files (of each type) each person has assigned and how many are unassigned (coordinator assigned)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Filter a file list by coordinator (Priority: P1)

An operations manager opens any of the file screens (Export, Import, Local, Warehouse) and narrows the
list to the files coordinated by one specific person, or to the files that currently have no coordinator
assigned. The result count makes the workload of that person — or the size of the unassigned backlog —
immediately visible without exporting data or counting rows manually.

**Why this priority**: This is the core request and delivers value on its own. Being able to isolate one
coordinator's files (or the unassigned pile) is what makes workload rebalancing possible day to day.

**Independent Test**: Open the Export file screen, choose a coordinator in the coordinator filter, and
confirm only that coordinator's files remain listed and the displayed count matches. Repeat with the
"Unassigned" option and confirm only files without a coordinator remain.

**Acceptance Scenarios**:

1. **Given** the Export file screen shows all active files, **When** the user selects the chip for coordinator "Ana", **Then** only files whose coordinator is Ana are listed and the visible result count reflects that subset.
2. **Given** the Import file screen, **When** the user selects the "Unassigned" chip, **Then** only files with no coordinator assigned are listed.
3. **Given** a coordinator filter is active, **When** the user also types in the search box or changes the status / visibility filters, **Then** all filters apply together (logical AND) and the result set respects every active filter.
4. **Given** a coordinator chip is selected, **When** the user selects it again or clears the filter, **Then** the list returns to showing files for every coordinator including unassigned ones.
5. **Given** the Local and Warehouse file screens, **When** the user opens them, **Then** the same coordinator chips are available and behave identically.

---

### User Story 2 - See the coordinator on Local files (Priority: P2)

A user reviewing the Local file list can see, directly in the list, who coordinates each file — the same
way they already can on Export, Import and Warehouse lists.

**Why this priority**: Without the coordinator visible in the Local list, filtering Local files by
coordinator gives results the user cannot verify at a glance. It is required for the Local screen to be
consistent, but the filter itself still delivers value first.

**Independent Test**: Open the Local file screen and confirm a Coordinator column appears with the
assigned person's name, and a clear "unassigned" indicator where no coordinator is set.

**Acceptance Scenarios**:

1. **Given** a Local file with a coordinator assigned, **When** the user views the Local file list, **Then** the coordinator's name is shown in the list row.
2. **Given** a Local file with no coordinator, **When** the user views the Local file list, **Then** the row shows a clear "unassigned" indication rather than a blank cell.
3. **Given** the Local file list, **When** the user compares it to the Export list, **Then** the coordinator information is presented in the same position and format.

---

### User Story 3 - Coordination workload dashboard card (Priority: P3)

A manager opens the dashboard and sees a card summarising, for every coordinator, how many files of each
type (Export, Import, Local, Warehouse) they currently coordinate, plus a row for files with no
coordinator assigned. From the card the manager can jump straight to the matching filtered file list.

**Why this priority**: This is the aggregated overview. It builds on the same coordinator data as the
filters and is most useful once the per-screen filters exist, but it can be delivered and validated on
its own.

**Independent Test**: Open the dashboard with the card enabled and confirm each coordinator appears with
per-type counts and a total, an "Unassigned" row is present, and the sum of all rows per type equals the
number of files of that type counted by the feature.

**Acceptance Scenarios**:

1. **Given** files distributed across coordinators and types, **When** the user views the dashboard card, **Then** each coordinator is listed with a count per file type and a row total.
2. **Given** files with no coordinator, **When** the user views the card, **Then** an "Unassigned" row shows the count of those files per type.
3. **Given** the card is displayed, **When** the user selects a coordinator/type cell, **Then** they are taken to the corresponding file screen with the coordinator filter already applied.
4. **Given** a coordinator with zero files of every type, **When** the card is rendered, **Then** that coordinator is not shown (the card lists only coordinators with at least one file, plus the Unassigned row).
5. **Given** the dashboard card library, **When** the user hides or shows the card, **Then** the preference persists for that user like every other dashboard card.

---

### Edge Cases

- A coordinator is deactivated while still holding files: their files MUST still be attributable. The
  filter chips and the dashboard card MUST continue to show that person as long as they coordinate at
  least one non-excluded file, marked as inactive.
- A file's coordinator is removed: the file MUST immediately fall into the "Unassigned" group in both the
  filter and the dashboard card.
- Coordinator filter selected and then the visibility filter is switched to "Deleted": soft-deleted files
  MUST be filtered by coordinator too, and MUST NOT be included in the dashboard card counts.
- No files match the selected coordinator: the list MUST show the standard empty state, not an error.
- Export files whose coordinator is held on the linked work order rather than the file itself MUST be
  treated consistently by the column, the filter and the card (see FR-004).
- No coordinators exist yet, or every file is unassigned: the dashboard card MUST render with only the
  Unassigned row rather than an empty/broken card.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every file screen (Export, Import, Local, Warehouse) MUST offer a coordinator filter presented as selectable chips showing each coordinator's file count, including an "unassigned" chip. Selecting a chip filters to that coordinator; selecting it again clears the filter (the unfiltered list is the default).
- **FR-002**: The coordinator filter MUST combine with the existing search, status, closed-record and visibility filters so that all active filters apply together.
- **FR-003**: The coordinator chips MUST cover every effective coordinator holding at least one file in the current view, plus the unassigned group, ordered by name. Counts on each chip MUST reflect the other active filters, and a coordinator who is no longer active or eligible MUST still be shown, marked as inactive, while they hold files.
- **FR-004**: The system MUST define a single "effective coordinator" for a file and apply it identically in the list column, the filter and the dashboard card: the coordinator assigned on the file, or, when the file has none and is linked to a work order that has one, the work order's coordinator; otherwise the file is unassigned.
- **FR-005**: The Local file list MUST display the effective coordinator for each file, in the same position and format used by the Export, Import and Warehouse lists.
- **FR-006**: Any file list row with no effective coordinator MUST display an explicit "unassigned" label rather than an empty value.
- **FR-007**: Each file screen MUST display the number of records currently matching the active filters so the user can read a coordinator's file count directly.
- **FR-008**: The selected coordinator filter MUST be reflected in the screen's address so the view can be linked to, bookmarked and returned to; navigating to such a link MUST open the screen with the filter already applied.
- **FR-009**: A dashboard card MUST present, per coordinator, the count of files they coordinate broken down by file type (Export, Import, Local, Warehouse) with a per-coordinator total.
- **FR-010**: The dashboard card MUST include an "Unassigned" row with the same per-type breakdown and total.
- **FR-011**: The dashboard card MUST include per-type column totals and a grand total so the numbers can be reconciled.
- **FR-012**: The dashboard card MUST count every file that is not closed or void and not deleted — including files in any intermediate working status, not only those in the initial "open" status — and MUST state this scope in the card so the numbers are not misread.
- **FR-013**: Selecting a coordinator/type cell in the dashboard card MUST navigate to the corresponding file screen with that coordinator filter applied, showing a list consistent with the count.
- **FR-014**: The dashboard card MUST be registered in the existing dashboard card library so users can show or hide it, with the preference persisted per user, and MUST default to hidden.
- **FR-015**: Coordinator counts and filtered results MUST respect existing access rules; the feature MUST NOT expose files or staff information to users who cannot already see them.
- **FR-016**: The feature MUST NOT change how a coordinator is assigned to a file; it only reads, filters and aggregates existing coordinator assignments.

### Language Surface Requirements *(mandatory for user-facing features)*

- **Web**: All new web text — coordinator filter label, "All coordinators" option, "Unassigned" option and row label, Local list coordinator column header, inactive-coordinator marker, result count label, dashboard card title/description, card column headers, totals row label, and card scope note — MUST be defined in both English and Spanish through the central i18n system. No display label may be hardcoded.
- **Operator-facing mobile**: Not applicable — this feature adds no mobile screens.
- **Client-facing mobile**: Not applicable — no client-facing interaction is introduced.
- **Backend/domain values**: File categories and statuses remain language-neutral values; coordinator identity is represented by the staff record, never by a localized label. The "unassigned" grouping MUST be represented by a language-neutral marker and translated only at display time.

### Key Entities *(include if data involved)*

- **Moving File**: The record being filtered and counted. Relevant attributes: file type (Export, Import, Local, Warehouse), open/closed status, deleted state, assigned coordinator, and the linked work order that may carry a coordinator.
- **Staff Member (Coordinator)**: The person a file is coordinated by. Relevant attributes: name, active state, and eligibility to coordinate files.
- **Coordination Summary**: A derived, per-coordinator view combining coordinator identity (or the Unassigned group) with counts of files by type and a total.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can determine how many files a specific coordinator handles on any single file screen in under 10 seconds and no more than two interactions.
- **SC-002**: A user can determine the number of unassigned files across all four file types from the dashboard in a single view, with no manual counting.
- **SC-003**: The counts shown in the dashboard card match the number of rows returned by the equivalent filtered file screen for 100% of coordinator/type combinations.
- **SC-004**: 100% of file screens (Export, Import, Local, Warehouse) expose the coordinator filter and display the effective coordinator for every row.
- **SC-005**: Filtered file lists and the dashboard card render within the same perceived responsiveness as the current unfiltered lists and existing dashboard cards — users see results immediately, with no visible extra wait.
- **SC-006**: 100% of newly introduced web labels are available in both English and Spanish, verified by switching languages with no untranslated or missing text.

## Assumptions

- Coordinator assignment already exists on files and work orders; this feature only reads it. No new assignment workflow, bulk reassignment, or coordinator management is in scope.
- The dashboard card counts files that are not closed/void and not deleted, because the purpose is current workload. "Not closed" covers every intermediate working status, not just the initial one. File screens keep their existing status/visibility filters, which continue to govern what the lists show.
- The coordinator filter is a per-session view preference expressed in the screen address; it is not stored as a persisted per-user default.
- The dashboard card defaults to hidden, consistent with other non-core cards, so existing users' dashboards are not changed without their action.
- Files of a type the user cannot access are excluded from both the filtered lists and the card counts.
- Reporting, exporting the coordination summary, and historical trends of coordinator workload are out of scope for this feature.
- The existing dashboard date range controls do not apply to this card, since it reports the current open workload rather than activity over a period.
