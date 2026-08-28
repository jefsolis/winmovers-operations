# Feature Specification: Schedule Worker Capacity Limits

**Feature Branch**: `009-schedule-worker-limits`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "schedule limits - we need to limit the number of jobs that can be scheduled in any given day, currently all jobs that have a date are scheduled automatically, also, users can manually schedule jobs in the schedule module. We need to add limits because it's not possible to complete an unlimited amount of jobs. We need to add a configuration to the number of workers available to be assigned to jobs, the default value will be 30 but it can be configured somewhere inside the schedule screen. We also need to assign the number of workers needed for a job (for now this will be a manual field, but we could add some formula to calculate it based on the number of punds for that job). We also need a new field in the jobs for the number of days the job will take to complete (1 by default but could be calculated later), this will also affect the schedule so a multiple day job will be scheduled multiple days in a row. When a job is being scheduled workers is a required field to automatically schedule a job, if that value is not available we should warn users the job cannot be added to the schedule. If workers available for that day (or days for a multiple day job) is less than the required workers for the job then the job cannot be scheduled. The application should show a clear message to the user stating there is no room in the schedule for that job that day (or days) and suggest the closest date that is possible for that job to be scheduled. Users can use any of the suggested dates if they're ok with it. The application should allow users to override this rule when the job must be completed that day, in that case they should provide a reason (this reason will be stored to show and use later) and the job will be scheduled but with a satus that makes it clear in the schedule screen the job is overlapping or needs attention. If a job needs attention, the scheduling manager (this should be a new type of role or permission) must accomodate that day by removing workers from other jobs to make room to the overlapping job, or moving other jobs to a different date. The reason entered by the user before should be clearly visible here so the manager knows why this is so important. We also need a new card in the dashboard to show jobs that need schedule attention, all the jobs that have been scheduled but need attention (are overlapping) need to be shown in that card so users can take action and ask schedule manager to move things around."

## Clarifications

### Session 2026-08-27

- Q: Who should be allowed to configure the daily worker capacity value? → A: Only users holding the Scheduling Manager role/permission; general schedule access is not sufficient.
- Q: Should scheduling managers get a clear, attention-driving indicator (beyond the dashboard card) when one or more days need attention? → A: Yes — the Schedule screen must show a prominent, persistent indicator to scheduling managers whenever any day currently has unresolved needs-attention jobs, driving them to act (this is part of User Story 4, not a separate story).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure daily worker capacity (Priority: P1)

A user holding the Scheduling Manager role/permission opens the Schedule screen and sets the total number of workers available per day (defaulting to 30), so the system knows how much crew capacity exists to complete jobs.

**Why this priority**: Without a known daily capacity, none of the overbooking checks or suggestions in the rest of the feature can function. This is the foundation the whole feature depends on.

**Independent Test**: Can be fully tested by opening the Schedule screen as a Scheduling Manager, changing the configured worker capacity, saving it, and confirming the new value is used for all subsequent scheduling checks; and confirming a non-manager cannot change it.

**Acceptance Scenarios**:

1. **Given** no capacity has been configured yet, **When** the Schedule screen loads, **Then** the system uses a default capacity of 30 workers per day.
2. **Given** a user holding the Scheduling Manager role/permission, **When** they open the capacity configuration control on the Schedule screen and enter a new value, **Then** the new value is saved and used immediately for future scheduling checks.
3. **Given** a user without the Scheduling Manager role/permission (including users with general schedule access), **When** they view the Schedule screen, **Then** the capacity configuration control is not editable by them (read-only or hidden), and any attempt to change it via the system is rejected.
4. **Given** a user enters an invalid capacity value (zero, negative, or non-numeric), **When** they attempt to save it, **Then** the system rejects the change and explains why.

---

### User Story 2 - Enforce worker capacity when scheduling a job (Priority: P1)

A user schedules a job (automatically via job dates or manually in the Schedule module) that requires a specific number of workers. The system checks whether enough workers are available on the required day(s) before allowing the job onto the schedule, and blocks or warns when there isn't enough room.

**Why this priority**: This is the core rule the feature exists to enforce — preventing more work from being committed to a day than the business can realistically staff.

**Independent Test**: Can be fully tested by creating jobs with known worker requirements against a day with a known remaining capacity, and confirming jobs are accepted only while capacity remains and blocked once it is exhausted.

**Acceptance Scenarios**:

1. **Given** a job does not yet have a number of workers required, **When** the system attempts to automatically add it to the schedule, **Then** it is not scheduled and the user is warned that workers-required is missing before the job can be scheduled.
2. **Given** a job requires a number of workers that is fully covered by remaining capacity on its date(s), **When** it is scheduled (automatically or manually), **Then** it is placed on the schedule and the remaining capacity for that day (or days) is reduced accordingly.
3. **Given** a job requires more workers than are available on its scheduled date, **When** scheduling is attempted, **Then** the job is not scheduled, and the user sees a clear message that there is no room in the schedule for that day (or days).
4. **Given** a job spans multiple days (job duration greater than one day), **When** the system checks capacity, **Then** it verifies and reserves the required workers on every day the job occupies, not just the first day.
5. **Given** a job could not be scheduled due to insufficient capacity, **When** the system reports the failure, **Then** it also suggests the closest upcoming date(s) where the job's full duration has enough available capacity.
6. **Given** the user is shown suggested alternative dates, **When** they select one of the suggestions, **Then** the job is scheduled on the chosen date(s) using the same capacity rules.

---

### User Story 3 - Override capacity with a documented reason (Priority: P2)

A user who must schedule a job on a specific day despite insufficient capacity can override the capacity rule by providing a reason. The job is scheduled but flagged as needing attention so the scheduling manager can resolve the overbooking.

**Why this priority**: The business needs an escape hatch for urgent jobs, but it must not silently create invisible overbooking — this depends on User Story 2 already enforcing the base rule.

**Independent Test**: Can be fully tested by attempting to schedule a job that exceeds capacity, choosing to override, entering a reason, and confirming the job appears on the schedule flagged as needing attention with the reason stored and visible.

**Acceptance Scenarios**:

1. **Given** a job cannot be scheduled on the desired date(s) due to insufficient capacity, **When** the user chooses to override the limit, **Then** the system requires a reason before the override can proceed.
2. **Given** a user provides an override reason and confirms, **When** the job is scheduled, **Then** it is placed on the desired date(s) with a status/flag indicating it needs attention (overlapping capacity), and the reason is stored with that scheduling record.
3. **Given** a job is flagged as needing attention, **When** it is viewed on the Schedule screen, **Then** the overlapping/needs-attention status is visually clear and the stored reason is visible to authorized users.
4. **Given** a user attempts to override without entering a reason, **When** they try to confirm, **Then** the system blocks the override and asks for a reason.

---

### User Story 4 - Scheduling manager resolves overbooked days (Priority: P2)

A user holding the scheduling manager role or permission reviews jobs flagged as needing attention and resolves the overbooking by reassigning workers from other jobs on that day or moving other jobs to a different date.

**Why this priority**: Once overrides can create flagged overbooking (User Story 3), someone must be able to act on them, and this action needs to be restricted to a responsible role.

**Independent Test**: Can be fully tested by granting a user the scheduling manager permission, viewing a day with a flagged/overlapping job, and confirming they can reduce workers on other jobs that day or move other jobs to different dates until the day is no longer overbooked.

**Acceptance Scenarios**:

1. **Given** a user does not have the scheduling manager role/permission, **When** they view a flagged job, **Then** they can see the overlap reason but cannot reassign workers away from other jobs or move other jobs on the manager's behalf.
2. **Given** a user has the scheduling manager role/permission, **When** they view a day containing a needs-attention job, **Then** they can see all jobs scheduled that day along with each job's assigned workers and the stored override reason for the flagged job.
3. **Given** a scheduling manager reduces the workers assigned to another job on the overbooked day, **When** the day's total assigned workers no longer exceeds capacity, **Then** the needs-attention flag for that day's overlap can be cleared by the manager.
4. **Given** a scheduling manager moves another job to a different date, **When** capacity is freed up as a result, **Then** the previously flagged job's overlap situation reflects the freed capacity.
5. **Given** one or more days currently have unresolved needs-attention jobs, **When** a scheduling manager opens or is viewing the Schedule screen, **Then** a prominent, persistent indicator (e.g., banner or badge) draws their attention to those day(s), distinct from the per-job needs-attention flag shown to all users.
6. **Given** no days currently have unresolved needs-attention jobs, **When** a scheduling manager views the Schedule screen, **Then** the attention indicator is not shown.

---

### User Story 5 - Dashboard visibility of jobs needing schedule attention (Priority: P3)

Any user viewing the dashboard sees a card listing jobs currently on the schedule that are flagged as needing attention (overbooking overrides), so they know to follow up with the scheduling manager.

**Why this priority**: This is a visibility/reporting layer on top of the override and resolution mechanisms already delivered in prior stories; valuable but not blocking core enforcement.

**Independent Test**: Can be fully tested by flagging one or more jobs as needing attention and confirming they appear in the new dashboard card, and confirming resolved jobs no longer appear.

**Acceptance Scenarios**:

1. **Given** one or more jobs are flagged as needing schedule attention, **When** a user opens the dashboard, **Then** a card lists those jobs with enough detail to identify them (job number/client, date(s), reason).
2. **Given** no jobs are currently flagged as needing attention, **When** a user opens the dashboard, **Then** the card indicates there is nothing needing attention (or is hidden per existing dashboard card conventions).
3. **Given** a flagged job's overlap is resolved by the scheduling manager, **When** the dashboard is next viewed, **Then** that job no longer appears in the needs-attention card.

---

### Edge Cases

- What happens when the configured daily worker capacity is lowered below the workers already committed on a future day? (Existing schedules on that day are not automatically altered or flagged; only future scheduling attempts are checked against the new capacity, unless it causes that day to now be over capacity, in which case the affected jobs should surface as needing attention.)
- How does the system handle a multi-day job where some days have capacity and others don't? (The job cannot be auto-scheduled unless every day in its span has enough capacity; override logic applies to the whole job if any day is short.)
- How does the system suggest alternate dates for a multi-day job? (It must find the closest span of consecutive days, starting from the originally requested date, where every day in the span has enough capacity, searching forward, then backward, from the requested date.)
- What happens if a job's date, duration, or worker requirement changes after it's already scheduled? (The system re-checks capacity for the new date span; if it introduces overbooking, the same warning/override flow applies.)
- What happens to schedule capacity when a job is cancelled, unscheduled, or deleted? (Its reserved workers are released back to the capacity for the day(s) it occupied.)
- Can a job with zero or missing days-to-complete be scheduled? (No — it defaults to 1 day, so this should not normally occur, but a missing value is treated as 1.)
- What happens when two users attempt to schedule competing jobs into the last remaining slot of a day at nearly the same time? (Only one succeeds in claiming the remaining capacity; the other is informed the slot is no longer available and is offered updated suggestions.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST maintain a single configurable value representing the total number of workers available per day, defaulting to 30 when not explicitly configured.
- **FR-002**: System MUST restrict changing the daily worker capacity to users holding the Scheduling Manager role/permission (general schedule access alone is not sufficient); System MUST allow such users to view and change it from within the Schedule screen, rejecting non-positive or non-numeric values.
- **FR-003**: System MUST provide a field on each job for the number of workers required to complete that job, editable manually by users.
- **FR-004**: System MUST provide a field on each job for the number of days required to complete that job, defaulting to 1 when not specified.
- **FR-005**: System MUST require the workers-required field to be set before a job can be automatically added to the schedule; if missing, the job MUST NOT be scheduled automatically and the user MUST be warned that this value is needed.
- **FR-006**: System MUST calculate, for any given day, the total workers already committed across all jobs scheduled on that day (excluding cancelled/removed schedule entries).
- **FR-007**: System MUST treat a job whose duration is greater than one day as occupying that many consecutive calendar days starting from its scheduled date, and MUST check and reserve worker capacity on every day of that span.
- **FR-008**: System MUST prevent a job (automatic or manual scheduling) from being placed on a date span where any day's remaining capacity (configured capacity minus already-committed workers) is less than the job's required workers, unless the user overrides per FR-010.
- **FR-009**: When a job cannot be scheduled due to insufficient capacity, System MUST present a clear message that there is no room in the schedule for that day (or days) and MUST suggest the closest available date span (searching forward from, then backward from, the originally requested date) where the job's full duration fits within capacity on every day.
- **FR-010**: System MUST allow a user to select and apply one of the suggested alternate date spans, scheduling the job there under the same capacity rules.
- **FR-011**: System MUST allow a user to override the capacity rule for a specific job/date, but only after the user supplies a non-empty reason for the override.
- **FR-012**: System MUST store the override reason together with the schedule entry/job it applies to, and MUST make it visible wherever that job's schedule entry is displayed to authorized users.
- **FR-013**: System MUST mark any job scheduled via override as "needs attention" (overlapping) in the schedule, using a status/flag that is visually distinct from normally scheduled jobs.
- **FR-014**: System MUST introduce a scheduling-manager role or permission, distinct from general schedule access, that controls who may reassign workers between jobs or move jobs to different dates on behalf of resolving an overbooked day.
- **FR-015**: System MUST allow users holding the scheduling-manager permission to reduce the workers assigned to other jobs scheduled on an overbooked day, or move other jobs on that day to a different date, in order to free capacity for a needs-attention job.
- **FR-016**: System MUST show the scheduling manager, for any needs-attention day, all jobs scheduled that day with their assigned workers and the override reason(s) driving the overbooking.
- **FR-017**: System MUST re-evaluate a day's needs-attention status whenever workers or dates change for jobs on that day, clearing the flag once total committed workers no longer exceed capacity.
- **FR-018**: System MUST release a job's reserved worker capacity for all of its occupied days when that job is cancelled, unscheduled, or removed from the schedule.
- **FR-019**: System MUST re-check capacity and re-apply the warning/override flow whenever a scheduled job's date, duration, or worker requirement is changed.
- **FR-020**: System MUST display a prominent, persistent attention indicator on the Schedule screen to users holding the Scheduling Manager role/permission whenever one or more days currently have unresolved needs-attention jobs, and MUST hide/clear that indicator once no such days remain.
- **FR-021**: System MUST provide a dashboard card listing all jobs currently flagged as needing schedule attention, showing enough information to identify each job (job number, client, scheduled date(s), and override reason).
- **FR-022**: System MUST remove a job from the needs-attention dashboard card once its overlap has been resolved (flag cleared).
- **FR-023**: System MUST continue to support existing manual scheduling in the Schedule module and existing automatic scheduling from job dates, applying the same capacity rules to both paths.

### Language Surface Requirements *(mandatory for user-facing features)*

- **Web**: All new text — capacity configuration control, missing-workers warning, no-room message, suggested-dates prompt, override reason prompt, needs-attention status label, scheduling-manager tools, and the new dashboard card — MUST be added to the central i18n system in both English and Spanish.
- **Operator-facing mobile**: Out of scope for this feature; scheduling and capacity management are web-only. If any related status is later surfaced on operator-facing mobile screens, it MUST default to Spanish per existing policy.
- **Client-facing mobile**: Not applicable — this feature does not introduce client-facing mobile screens.
- **Backend/domain values**: The needs-attention/overlap status and the scheduling-manager permission MUST be represented as language-neutral values (e.g., status codes, boolean/role flags), with localized labels applied only at the presentation layer.

### Key Entities

- **Schedule Capacity Setting**: A single configurable number representing total workers available per calendar day; defaults to 30; used as the ceiling for daily worker commitments across all scheduled jobs.
- **Job (extended)**: Existing job record, extended with a required-workers value and a days-to-complete value (defaulting to 1) that together determine how much daily capacity the job consumes and for how many consecutive days.
- **Schedule Entry (extended)**: Existing scheduled occurrence of a job on the calendar, extended with a needs-attention/overlap flag and an associated override reason when the entry was force-scheduled beyond capacity.
- **Scheduling Manager Permission/Role**: A new authorization grant that allows a user to reassign workers between jobs or move jobs to different dates specifically to resolve overbooked/needs-attention days.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can determine, before confirming a schedule change, whether a job fits within the day's remaining worker capacity in a single step (no need to manually total up other jobs' workers).
- **SC-002**: 100% of jobs missing a required-workers value are blocked from automatic scheduling and clearly flagged to the user, with zero jobs silently skipped without explanation.
- **SC-003**: When a job cannot be scheduled on its requested date(s), users receive at least one valid alternative date suggestion (when one exists within a reasonable search window) in the same interaction, without needing to manually search the calendar.
- **SC-004**: 100% of override-scheduled jobs are visibly flagged as needing attention on the schedule and carry a visible reason, with no overbooked job ever appearing indistinguishable from a normally scheduled job.
- **SC-005**: Scheduling managers can identify every job needing attention and its cause (reason + day's other jobs) without leaving the Schedule screen.
- **SC-006**: The dashboard needs-attention card reflects the current set of overbooked jobs with no more than a few seconds of staleness after a resolution action.
- **SC-007**: Daily worker capacity is configurable by users holding the Scheduling Manager role/permission in under a minute, with the change taking effect for the very next scheduling attempt.

## Assumptions

- The daily worker capacity is a single company-wide value (not per-location, per-crew-type, or per-job-type) for this iteration.
- "Workers required" and "days to complete" are manually entered by users for now; any automatic calculation (e.g., from job weight/pounds) is explicitly out of scope and left for a future iteration.
- Multi-day jobs consume the same number of required workers on every day of their span (no partial/day-varying staffing) for this iteration.
- The scheduling-manager permission is granted to a subset of existing staff accounts through the existing staff/permissions management approach; this feature does not introduce a full new user-management workflow beyond adding the permission itself.
- "Closest available date" suggestions search a reasonable forward/backward window from the requested date; an exhaustive unbounded search is not required, and if no suitable date is found nearby the user is informed rather than given no feedback.
- Existing schedule entries created before this feature ships are treated as not overbooked until the capacity/worker rules are applied going forward; no retroactive bulk recalculation of historical schedule data is required.
- Only one active daily capacity value applies at a time; historical changes to the capacity value are not required to be tracked/versioned for this iteration.
