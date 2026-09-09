# Quickstart: Validating Schedule History & Job Scheduling Visibility

## Prerequisites

- Backend running locally: `cd backend; node index.js` (port 3001)
- Frontend running locally: `cd frontend; npm run dev` (port 5173, proxies `/api` → 3001)
- A logged-in user with access to Jobs, Files, and Schedule (ADMIN or equivalent role covers all three)

## Scenario 1 — Combined history shows job + auto-generated schedule events

1. Create a new EXPORT or IMPORT job with a `serviceDate` set (triggers `syncJobScheduleEntries` auto-creation).
2. Open the job's detail page → **History** tab.
3. **Expected**: the timeline shows a "Job" `CREATE` entry and a "Schedule" `CREATE` entry (for the auto-generated schedule entry), both visible in one list, each labeled with its origin (Job vs Schedule).

## Scenario 2 — Schedule edits/deletes surface in Job History without editing the job

1. From the job created in Scenario 1, go to the **Schedule** page, find the auto-generated entry for that job, and change its date or crew assignment.
2. Return to the job's **History** tab.
3. **Expected**: a new "Schedule" `UPDATE` entry appears, showing the changed fields, without any new "Job" entry.
4. Delete the schedule entry from the Schedule page.
5. Return to the job's **History** tab.
6. **Expected**: a new "Schedule" `DELETE` entry appears.

## Scenario 3 — Manually linked schedule entry behaves the same way

1. From the Schedule page, create a new manual entry and link it to an existing job via the job search field.
2. Open that job's **History** tab.
3. **Expected**: a "Schedule" `CREATE` entry appears for the manual entry, indistinguishable in treatment (labeling/format) from an auto-generated one.

## Scenario 4 — Jobs list scheduled/unscheduled calendar icon

1. Open the Jobs list. Identify a job with an active schedule entry (e.g. the job from Scenario 1, before deleting its entry) and one with none (e.g. after Scenario 2's deletion, or a freshly created job with no `serviceDate`).
2. **Expected**: the scheduled job's row shows the calendar icon in its "scheduled" visual state; the unscheduled job's row shows the "not scheduled" state, visually distinct.
3. Click the calendar icon on the scheduled job.
4. **Expected**: navigation to `/schedule?date=<that job's schedule date>`, landing on the Schedule page with that day opened/visible.

## Scenario 5 — Files list & summary show the same icon

1. Open the Files list, filtered to each of Export, Import, Local, and Warehouse categories in turn.
2. **Expected**: each row shows the calendar icon reflecting its linked job's scheduled status (or "not scheduled" if no job/no active entries).
3. Open the Dashboard/files summary view.
4. **Expected**: the same calendar icon convention appears in the summary.
5. Click a calendar icon in a file row.
6. **Expected**: navigation to the Schedule page for the relevant date, same as Scenario 4.

## Validation references

- API response shapes: [contracts/api-changes.md](./contracts/api-changes.md)
- Derived-field rules: [data-model.md](./data-model.md)
- Design rationale: [research.md](./research.md)
