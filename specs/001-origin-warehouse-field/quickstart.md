# Quickstart & Validation: Origin Warehouse Field for Import Jobs

**Feature**: 001-origin-warehouse-field
**Date**: 2026-07-21

This guide validates the feature end-to-end. See [data-model.md](./data-model.md)
for the schema change and [contracts/jobs-api.md](./contracts/jobs-api.md) for
the API delta.

## Prerequisites

- Local dev environment configured (`backend/.env` with `DATABASE_URL`).
- Node.js and dependencies installed in `backend/` and `frontend/`.

## Setup (after implementation)

Apply the schema change and regenerate the Prisma client:

```powershell
Set-Location C:\Workspace\winmovers-operations\backend
npx prisma db push
npx prisma generate
```

Start the services (separate terminals):

```powershell
# Backend
Set-Location C:\Workspace\winmovers-operations\backend
node index.js          # http://localhost:3001

# Frontend
Set-Location C:\Workspace\winmovers-operations\frontend
npm run dev            # http://localhost:5173
```

## Validation Scenarios

### Scenario 1 — Field appears after Origin Address (FR-001, SC-003)

1. Open the app and create/edit an **Import** job.
2. Locate the origin row on the work-order document.
3. **Expected**: An "Origin Warehouse" input appears immediately after the
   Origin Address field. Switching the UI language shows "Origin Warehouse" (EN)
   / "Almacén de Origen" (ES).

### Scenario 2 — Enter and persist a value (FR-003, US1, SC-001)

1. In an Import job, type a warehouse name (e.g., `Bodega Central`) in the
   Origin Warehouse field.
2. Save the job.
3. Reopen the job.
4. **Expected**: The saved value is shown; it survives a page reload.

### Scenario 3 — Save with the field empty (FR-002, US2, SC-002)

1. Create or edit an Import job and leave Origin Warehouse blank.
2. Save.
3. **Expected**: The job saves with no validation error; the field displays as
   empty when reopened.

### Scenario 4 — Edit and clear the value (FR-004)

1. Open a job that has an Origin Warehouse value.
2. Change it to a new value, save, reopen → new value shown.
3. Clear the field, save, reopen → field is empty.
4. **Expected**: Latest value (including empty) is persisted each time.

### Scenario 5 — API check (contracts/jobs-api.md)

1. `GET /api/jobs/:id` for a job with a saved value.
2. **Expected**: The response JSON includes `"originWarehouse": "<value>"`
   (or `null` when empty).

## Success Confirmation

All five scenarios pass, matching Success Criteria SC-001, SC-002, and SC-003 in
[spec.md](./spec.md).
