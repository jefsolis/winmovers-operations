# Feature Specification: Schedule History & Job Scheduling Visibility

**Feature Branch**: `010-schedule-history-improvements`

**Created**: 2026-09-09

**Status**: Draft

**Input**: User description: "scuedule history and improvements - we need to have a way to identify the history of the schedule entries from the jobs, for example, when I create a job and it gets automatically scheduled we need to be able to see the history of the schedule entry from the job record, currently job history shows changes to the job record only, now it will also show its schedule history combined, it should show if the change was done to the job record or the schedule record. If the schedule entry gets modified or deleted from the schedule, users should be able to see those changes in the job history tab. This should be the same if a manually schedule entry is linked to a job. Jobs should also show clearly if they have been scheduled (if a valid schedule entry is still available), it's critical to the company workflow that jobs are scheduled, that's the only way warehouse users can know what jobs they are assigned to do each day, one job that is not scheduled can potentially be missed. We should show a calendar icon in the jobs list so users can easily see which jobs have already been scheduled and which are missing a schedule entry. A similar calendar icon should show also in the File list (all files: Import, Export, Local and Warehouse), also the summary of the different files should show this calendar icon, clicking the icon should take user to the schedule day"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Combined job + schedule history in Job History tab (Priority: P1)

A coordinator opens a job's History tab and wants a single, chronological timeline that shows both changes made directly to the job record and changes made to any schedule entry linked to that job (auto-generated at job creation, or manually created/linked later), so they understand the full story of how and when the job was scheduled, rescheduled, or unscheduled.

**Why this priority**: This is the core problem statement — history is currently fragmented and coordinators cannot answer "why isn't this job on the calendar anymore" without cross-referencing two separate systems. This delivers the primary value on its own.

**Independent Test**: Create a job (triggers auto-schedule), edit the resulting schedule entry's date, then delete it. Open the job's History tab and verify all three events (job creation, schedule update, schedule deletion) appear in one combined, time-ordered list, each clearly labeled as a "Job" or "Schedule" change.

**Acceptance Scenarios**:

1. **Given** a newly created job that triggers an automatic schedule entry, **When** the coordinator opens the job's History tab, **Then** they see an entry documenting the schedule entry's creation, labeled as a schedule change, alongside the job creation entry.
2. **Given** a job with a linked schedule entry, **When** a warehouse scheduler edits the schedule entry's date, time, or assigned crew from the Schedule screen, **Then** the job's History tab shows a new entry describing what changed on the schedule entry, labeled as a schedule change, without requiring any edit to the job record itself.
3. **Given** a job with a linked schedule entry, **When** the schedule entry is deleted from the Schedule screen, **Then** the job's History tab shows an entry indicating the schedule entry was removed, and the job is subsequently shown as unscheduled.
4. **Given** a manually created schedule entry (not auto-generated) that a user links to an existing job, **When** the coordinator opens that job's History tab, **Then** the linked schedule entry's creation and any subsequent edits/deletion appear in the same combined history, indistinguishable in treatment from an auto-generated entry.
5. **Given** a job's combined history list, **When** the coordinator looks at any single entry, **Then** they can immediately tell whether the change originated from the job record or from a schedule entry (e.g., a distinct label, icon, or grouping).

---

### User Story 2 - Visual "scheduled" indicator on the Jobs list (Priority: P1)

A coordinator viewing the Jobs list needs to instantly see which jobs currently have a valid (not deleted) schedule entry and which ones don't, using a calendar icon, so that unscheduled jobs — which risk being missed by the warehouse — are caught and corrected immediately.

**Why this priority**: The user explicitly calls this "critical to the company workflow" since an unscheduled job can be missed entirely by warehouse crews. This is a P1 alongside history because it addresses the operational risk, not just visibility after the fact.

**Independent Test**: With a mix of scheduled and unscheduled jobs in the Jobs list, verify the calendar icon renders in a visually distinct "scheduled" state versus "not scheduled" state for the corresponding rows, independent of the history feature.

**Acceptance Scenarios**:

1. **Given** a job with at least one active (non-deleted) schedule entry, **When** the coordinator views the Jobs list, **Then** the job's row shows a calendar icon in a "scheduled" visual state.
2. **Given** a job with no schedule entries, or whose only schedule entries have all been deleted, **When** the coordinator views the Jobs list, **Then** the job's row shows the calendar icon in a "not scheduled" visual state, visually distinguishable from the scheduled state.
3. **Given** a job shown as scheduled, **When** its last remaining schedule entry is deleted, **Then** the Jobs list icon updates to the "not scheduled" state (on next load/refresh).
4. **Given** a coordinator clicks the calendar icon on a scheduled job's row, **When** the click is registered, **Then** they are taken to the schedule day view for the date of that job's (most relevant) schedule entry.

---

### User Story 3 - Scheduled indicator on Files lists and summaries (Priority: P2)

A back-office user viewing any Files list (Export, Import, Local, Warehouse) or a files summary/dashboard view wants the same calendar icon convention used on jobs, reflecting whether the file's associated job (or the file itself, for file types without a distinct job) has a valid schedule entry, so scheduling gaps are visible everywhere files are reviewed, not just on the Jobs screen.

**Why this priority**: Extends the same capability to a secondary, already-existing set of screens. It depends on the underlying "is this scheduled" capability built for User Story 2, so it is sequenced after it, but is still valuable independently once that capability exists.

**Independent Test**: With a mix of scheduled/unscheduled files across each of the four file categories, verify the calendar icon appears correctly in each list and in the corresponding summary view, and that clicking it navigates to the schedule day.

**Acceptance Scenarios**:

1. **Given** any file list (Export, Import, Local, Warehouse), **When** a user views the list, **Then** each row shows a calendar icon reflecting the scheduled/not-scheduled state of the file's linked job (or of the file's own linked schedule entries, for file categories without a job).
2. **Given** a files summary/dashboard view that aggregates counts by category, **When** a user views the summary, **Then** the same calendar icon convention is shown to indicate scheduling status at the appropriate level of aggregation (e.g., per row/category shown in the summary).
3. **Given** a user clicks the calendar icon in a file list row, **When** the click is registered, **Then** they are taken to the schedule day view for the relevant schedule entry's date.

---

### Edge Cases

- What happens when a job has multiple active schedule entries with different dates (e.g., a multi-day job with EMPAQUE and MUDANZA tasks on different days)? The "scheduled" indicator should treat the job as scheduled if any active entry exists; the icon's click target uses the most relevant entry's date (see Assumptions).
- What happens when a schedule entry is deleted and later a new one is created for the same job? Both the deletion and the new creation must appear as separate, correctly ordered events in the job's combined history — history is never overwritten or merged.
- What happens for LOCAL moving files or file categories that have no associated Job record at all? The scheduled indicator must be derived from schedule entries linked directly to that file's association point rather than through a job.
- What happens when a schedule entry is reassigned to a different job (`jobId` changed)? Both the losing job and the gaining job's histories should reflect the change (entry removed from one, added to the other).
- How does the system handle a schedule entry that is soft-deleted vs. hard-deleted? For the purposes of this feature, "deleted" means no longer an active/current schedule entry, regardless of deletion mechanism.
- What happens if a job has no coordinator/user context available at the time of an automatic schedule sync? History entries must still be recorded, attributing the change to the system process when no specific user performed the action.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST record a history entry whenever a schedule entry linked to a job is created, updated, or deleted, capturing what changed (e.g., date, time, task type, assigned crew, notes).
- **FR-002**: System MUST display, on the Job History tab, a single combined timeline that includes both job-record change history and schedule-entry change history for that job, ordered chronologically.
- **FR-003**: Each entry in the combined job history timeline MUST clearly indicate its origin — whether the change was made to the job record or to a schedule entry — through a distinct label, icon, or grouping.
- **FR-004**: The combined history MUST include schedule entries regardless of how they were created (automatically generated at job creation/date-sync, or manually created and subsequently linked to the job).
- **FR-005**: System MUST determine, for any job, whether it currently has at least one active (not deleted) schedule entry, and expose this "scheduled" status for display.
- **FR-006**: The Jobs list MUST display a calendar icon per job row reflecting the job's current scheduled status, with a visually distinct state for "scheduled" versus "not scheduled."
- **FR-007**: Clicking the calendar icon on a scheduled job MUST navigate the user to the schedule day view for the date associated with that job's relevant schedule entry.
- **FR-008**: The Files lists (Export, Import, Local, Warehouse) MUST display the same calendar icon convention per row, reflecting the scheduled status of the file's associated job, or of schedule entries linked directly to the file when no job exists for that file category.
- **FR-009**: Files summary/dashboard views MUST also surface the calendar icon convention to indicate scheduling status.
- **FR-010**: Clicking the calendar icon in a file list row or summary MUST navigate the user to the schedule day view for the relevant date.
- **FR-011**: When a schedule entry is deleted or reassigned away from a job, the job's scheduled status and calendar icon state MUST update to reflect the loss, and this change MUST also appear in the job's combined history.
- **FR-012**: History entries for schedule changes MUST record who made the change when available (a staff member), and MUST indicate an automated/system origin when the change resulted from an automatic process (e.g., date-sync) with no specific acting user.
- **FR-013**: The combined job history MUST NOT lose or overwrite prior entries when new schedule or job changes occur — all history entries are append-only and permanently retained.

### Language Surface Requirements *(mandatory for user-facing features)*

- **Web**: All new text (history entry labels such as "Job" vs. "Schedule" origin tags, scheduled/not-scheduled tooltips, calendar icon tooltips) must be added to both the English and Spanish objects in the central i18n system (`frontend/src/i18n.jsx`) and referenced via `useLanguage()` / `t(...)` — no hardcoded strings.
- **Operator-facing mobile**: Not applicable — this feature is scoped to the web Jobs/Files/History screens; no mobile packing-app UI changes are included.
- **Client-facing mobile**: Not applicable.
- **Backend/domain values**: The origin of a history entry (job vs. schedule) and the action type (create/update/delete) must be stored as language-neutral values; human-readable labels are generated only at the presentation layer.

### Key Entities *(include if feature involves data)*

- **Job History Entry**: A single point-in-time record of a change relevant to a job, combining both job-record changes and schedule-entry changes for display. Key attributes: source (Job or Schedule), action (create/update/delete), what changed, who made the change (or automated/system), when it happened.
- **Schedule Entry**: An existing record representing a scheduled task tied to a job (or, for some file categories, tied directly to a file) on a given date/date-range; changes to it (creation, edits, deletion, reassignment to a different job) are the new source of "Schedule" history entries.
- **Job Scheduled Status**: A derived indicator (scheduled / not scheduled) for a job, true when at least one active schedule entry currently references that job.
- **File Scheduled Status**: A derived indicator (scheduled / not scheduled) for a moving file, based on its associated job's scheduled status, or on schedule entries linked directly to the file when no job exists.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Coordinators can determine, without leaving the Job History tab, whether a job's current lack of schedule is due to a schedule entry being deleted, reassigned, or never created, 100% of the time for any job created after this feature ships.
- **SC-002**: Users can identify a job's scheduled/not-scheduled status at a glance from the Jobs list, without opening the job record, in under 2 seconds per row.
- **SC-003**: The number of jobs that reach their service date without ever having had a valid schedule entry drops to near zero, as this condition becomes immediately visible on the Jobs list.
- **SC-004**: Users can navigate from any calendar icon (Jobs list, Files lists, Files summary) to the correct schedule day in a single click, 100% of the time.
- **SC-005**: 100% of schedule entry creations, edits, and deletions linked to a job produce a corresponding, correctly labeled entry in that job's combined history.

## Assumptions

- "Valid schedule entry" means an active (not deleted) `ScheduleEntry` record; soft-deleted or reassigned-away entries do not count toward a job's scheduled status.
- When a job has multiple active schedule entries (e.g., multi-day jobs with separate EMPAQUE/MUDANZA/DESEMPAQUE tasks), the calendar icon click target uses the earliest upcoming (or otherwise most relevant, e.g. earliest) active entry's date; exact tie-breaking is a presentation-layer decision left to implementation, since no single date is specified by the business for multi-entry jobs.
- The "Files summary" refers to the existing dashboard/summary views that show counts of Export/Import/Local/Warehouse files; the calendar icon there indicates aggregate or representative scheduling status rather than opening a specific record.
- File categories without a directly associated Job record (e.g., LOCAL files, if applicable) derive their scheduled status from schedule entries linked to the file itself rather than through a job; this reuses the same underlying mechanism as job-based status.
- Existing schedule entries and job history created before this feature ships are not retroactively backfilled with combined history entries; the combined view applies going forward, showing whatever history already exists for the job record and treating pre-existing schedule entries as simply present (scheduled) or absent (not scheduled) without a synthetic "created" event.
- History display in the UI remains scoped to the existing Job History tab; no new dedicated schedule-history screen is required by this feature.
