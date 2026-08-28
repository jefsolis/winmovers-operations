# Data Model: Schedule Worker Capacity Limits

## ScheduleSetting (new)

Singleton configuration row holding the daily worker capacity.

| Field | Type | Notes |
|---|---|---|
| `id` | String (PK) | Fixed value, e.g. `"default"` — always upserted to this id so there is exactly one row. |
| `dailyWorkerCapacity` | Int | Default `30`. Must be a positive integer (validated at the API layer). |
| `updatedByStaffId` | String? | FK to `StaffMember` — who last changed it (for audit context). |
| `updatedAt` | DateTime | `@updatedAt`. |
| `createdAt` | DateTime | `@default(now())`. |

**Validation rules**:
- `dailyWorkerCapacity` MUST be an integer > 0; non-numeric, zero, or negative values are rejected with a clear error (FR-002).
- Only writable by users with `canManageSchedule` (or `ADMIN`) permission (FR-002).

## Job (extended)

Existing model (`backend/prisma/schema.prisma`, `model Job`). Adds:

| Field | Type | Notes |
|---|---|---|
| `daysToComplete` | Int? | Number of consecutive days the job will take. Treated as `1` when null/unset (FR-004). |

> **Note (post-implementation)**: the spec originally called for a new `workersRequired` field, but the codebase already had `Job.personalCount` (Int?, labeled "Cantidad de Personal" on the Import work-order document). Rather than introduce a duplicate concept, `personalCount` was reused as the single worker-count field driving schedule capacity checks (FR-003/FR-005 etc. now read/write `personalCount`).

**Validation rules**:
- `personalCount`, if provided, MUST be a positive integer.
- `daysToComplete`, if provided, MUST be a positive integer; absence defaults to `1` wherever duration is used in scheduling logic.
- Changing either field on an already-scheduled job MUST re-trigger the capacity check/warning flow (FR-019).

## ScheduleEntry (extended)

Existing model. Adds:

| Field | Type | Notes |
|---|---|---|
| `needsAttention` | Boolean | Default `false`. `true` when this entry was force-scheduled beyond available capacity via override (FR-013). |
| `overrideReason` | String? (`@db.Text`) | Required (non-empty) whenever `needsAttention` is set to `true` via an override; stored and displayed wherever the entry appears (FR-011, FR-012). |

**Validation rules**:
- `overrideReason` MUST be non-empty when `needsAttention` is being set `true` by a user override (FR-011).
- `needsAttention` MUST be re-evaluated (cleared) whenever the day's total committed workers no longer exceed capacity, whether due to this entry's change or another entry on the same day being adjusted (FR-017).
- Deleting/cancelling an entry releases its reserved workers (capacity is derived, not stored as a running balance — see "Derived capacity" below) (FR-018).

## StaffMember (extended)

Existing model. Adds:

| Field | Type | Notes |
|---|---|---|
| `canManageSchedule` | Boolean | Default `false`. Grants the Scheduling Manager permission: configure daily capacity, reassign workers/move jobs on overbooked days, see the persistent attention indicator, resolve needs-attention flags (FR-002, FR-014, FR-015, FR-020). Follows the same flag pattern as `canAccessSchedule`. `role === 'ADMIN'` continues to imply full access, consistent with existing `requireScheduleAccess` behavior. |

## Derived concept: Remaining capacity for a day

Not a stored column — computed on demand:

```
committedWorkers(day) = SUM(personalCount of each Job whose ScheduleEntry span [startDate, endDate] includes `day`,
                             counting only entries that are not deleted)
remainingCapacity(day) = ScheduleSetting.dailyWorkerCapacity - committedWorkers(day)
```

A job's span is considered to occupy each calendar day from its scheduled start date through `start + (daysToComplete - 1)` days, inclusive.

## Relationships

```
StaffMember 1---* ScheduleEntry (assignedTo)          [existing]
StaffMember 1---* ScheduleSetting (updatedByStaffId)  [new, optional attribution]
Job 1---* ScheduleEntry (jobId)                       [existing]
Job.personalCount, Job.daysToComplete  → drive ScheduleEntry.needsAttention/overrideReason computation [new usage of an existing field + new field]
```

## State: ScheduleEntry needs-attention lifecycle

```
[not scheduled] --(auto-sync or manual create, capacity OK)--> [scheduled, needsAttention=false]
[not scheduled] --(auto-sync or manual create, capacity insufficient, user overrides + reason)--> [scheduled, needsAttention=true, overrideReason set]
[needsAttention=true] --(scheduling manager frees capacity on the day)--> [needsAttention=false, overrideReason retained for history]
[scheduled] --(job/entry deleted or unscheduled)--> [removed; capacity released]
```
