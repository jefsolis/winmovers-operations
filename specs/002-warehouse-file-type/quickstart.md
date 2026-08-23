# Quickstart & Validation: Warehouse File Type and Packing Item Type Management

**Feature**: 002-warehouse-file-type
**Date**: 2026-08-03

See [data-model.md](./data-model.md) for schema details and
[contracts/](./contracts/) for API shapes.

---

## Prerequisites

- Local dev environment configured (`backend/.env` with `DATABASE_URL`).
- Node.js dependencies installed in `backend/` and `frontend/`.
- Implementation complete (schema pushed, client regenerated).

---

## Setup (after implementation)

```powershell
Set-Location C:\Workspace\winmovers-operations\backend
npx prisma db push
npx prisma generate
node index.js        # http://localhost:3001

# Separate terminal:
Set-Location C:\Workspace\winmovers-operations\frontend
npm run dev          # http://localhost:5173
```

---

## Validation Scenarios

### Scenario 1 — Create a Warehouse File with B-XXXX auto-numbering (FR-001, FR-002, FR-003, SC-001)

1. Log in as a non-Bodega staff member.
2. Navigate to Files → Warehouse (new nav entry).
3. Click "New Warehouse File", fill in a client, and save.
4. **Expected**: File is created and displayed with a `B-0001` number (or next in
   sequence). Status is OPEN.

### Scenario 2 — Warehouse File appears in the list and can be filtered (FR-005)

1. After creating at least one Warehouse File, open the Files list.
2. Apply the WAREHOUSE category filter.
3. **Expected**: Only Warehouse Files are shown. Removing the filter shows all
   categories including WAREHOUSE.

### Scenario 3 — WAREHOUSE Job auto-created and linked (FR-006, FR-007, SC-002)

1. Create a Warehouse File with a service date set.
2. Navigate to Jobs and search for the `B-XXXX` number.
3. **Expected**: A Job of type WAREHOUSE exists with that number, linked to the
   Warehouse File. A schedule entry of type ALMACENAJE (or MUDANZA if not yet
   added) exists for the service date.

### Scenario 4 — Close a Warehouse File (FR-004)

1. Open a WAREHOUSE File with status OPEN.
2. Change status to CLOSED and save.
3. **Expected**: Status updates to CLOSED without error.

### Scenario 5 — Admin manages Packing Item Types (FR-010, SC-003)

1. Log in as an ADMIN user.
2. Navigate to Admin → Packing Item Types.
3. Create a new item type with both names (e.g. Spanish: "Caja", English: "Box").
4. Edit the names (e.g. Spanish: "Caja de Cartón", English: "Cardboard Box").
5. Deactivate the item type.
6. **Expected**: All three operations succeed. Both `nameEs` and `nameEn` are
   persisted and displayed. The deactivated entry is no longer shown in the active
   list (or is visually marked inactive).

### Scenario 6 — Non-admin cannot access item types page (FR-010, SC-005)

1. Log in as a non-admin, non-Bodega staff member.
2. Navigate directly to `/admin/packing-item-types`.
3. **Expected**: Redirected to the dashboard (RequireAdmin guard fires).

### Scenario 7 — API returns only active item types with both names (FR-011, SC-004)

1. With active and deactivated item types in the DB, call:
   ```
   GET /api/packing-item-types
   Authorization: Bearer <token>
   ```
2. **Expected**: Response contains only entries where `active: true`, sorted
   alphabetically by name. Each entry includes both `nameEs` and `nameEn`.
   Deactivated entries are absent.

### Scenario 8 — Bodega user cannot write item types (SC-005)

1. Obtain a JWT for the Bodega role account.
2. Call `POST /api/packing-item-types` with that token.
3. **Expected**: 403 response (forbidBodegaWrite middleware).

---

## Success Confirmation

All eight scenarios pass, satisfying SC-001 through SC-005 in [spec.md](./spec.md).
