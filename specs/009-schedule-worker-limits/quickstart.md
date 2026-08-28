# Quickstart: Schedule Worker Capacity Limits

Validates the feature end-to-end after implementation. Assumes local dev setup per [.github/copilot-instructions.md](../../.github/copilot-instructions.md) (`backend` on :3001, `frontend` on :5173).

## Prerequisites

1. Schema migrated:
   ```powershell
   Set-Location backend
   npx prisma db push
   npx prisma generate
   ```
2. At least one `StaffMember` with `canManageSchedule: true` (or `role: 'ADMIN'`) exists — set directly via Prisma Studio (`npx prisma studio`) if no UI exists yet for granting the permission.
3. Backend and frontend dev servers running.

## Scenario 1 — Configure daily capacity (User Story 1)

1. Log in as a user **without** `canManageSchedule` → open Schedule screen → confirm the capacity control is read-only/hidden.
2. Log in as a user **with** `canManageSchedule` → open Schedule screen → change capacity to `25` → save.
3. Confirm `GET /api/schedule/settings` returns `dailyWorkerCapacity: 25`.
4. Attempt to save `0`, `-5`, and `"abc"` → confirm each is rejected with a clear message.

## Scenario 2 — Enforce capacity on scheduling (User Story 2)

1. With capacity at `25`, create/edit jobs with a service date of `2026-09-01` until the sum of `workersRequired` across jobs that day reaches `25`.
2. Create a job with `workersRequired: 5`, no service date conflicts, `daysToComplete: 1`, service date `2026-09-01` → expect a `scheduleWarning` (`NO_CAPACITY`) and the job NOT auto-scheduled; suggested alternate date(s) are returned.
3. Create a job with `workersRequired` left blank and a service date set → expect `scheduleWarning` (`MISSING_WORKERS_REQUIRED`) and no auto-scheduling.
4. Create a job with `daysToComplete: 3` and confirm capacity is checked/reserved across all 3 consecutive days (test by exhausting capacity on only the 2nd day and confirming the job is still blocked).
5. From the Schedule screen, manually schedule an entry that would exceed capacity for its day → expect a 409 with suggestions, not a silent success.

## Scenario 3 — Override with reason (User Story 3)

1. Repeat step 2 of Scenario 2, but choose "override" without entering a reason → confirm blocked with a validation message.
2. Repeat, entering a reason → confirm the job is scheduled, appears on the Schedule screen visually flagged as needing attention, and the reason is visible on hover/detail view.

## Scenario 4 — Scheduling manager resolves overbooking (User Story 4)

1. Log in as a user **without** `canManageSchedule` → view the overbooked day → confirm the override reason is visible but no controls exist to reassign/move other jobs.
2. Log in as a user **with** `canManageSchedule` → confirm a persistent attention indicator appears on the Schedule screen (since a needs-attention entry exists from Scenario 3).
3. As the scheduling manager, reduce `workersRequired` on another job scheduled that same day (or move it to a different date) until the day's total no longer exceeds capacity.
4. Call/trigger `PUT /api/schedule/:id/resolve` (or the equivalent UI action) → confirm the flag clears and the attention indicator disappears once no needs-attention entries remain.

## Scenario 5 — Dashboard visibility (User Story 5)

1. With at least one needs-attention job present, open the Dashboard → confirm the new card lists it with job number/client, date(s), and reason.
2. Resolve the overbooking (Scenario 4) → refresh the Dashboard → confirm the job no longer appears in the card.
3. With zero needs-attention jobs, confirm the card shows an empty/positive state (or is hidden per existing dashboard card conventions).

## Language check

- Toggle the web app language switch between English and Spanish → confirm all new strings (capacity control, warnings, override dialog, needs-attention badge/label, dashboard card) render correctly in both languages with no missing keys.
