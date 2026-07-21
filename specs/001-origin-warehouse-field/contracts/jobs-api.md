# Jobs API — Contract Delta: `originWarehouse`

**Feature**: 001-origin-warehouse-field
**Date**: 2026-07-21
**Scope**: Additive change to the existing Jobs endpoints in
`backend/routes/jobs.js`. No new routes, no breaking changes.

This documents only the delta introduced by this feature. Existing fields and
behavior are unchanged.

## Field

| Name | Type | Required | Notes |
|------|------|----------|-------|
| `originWarehouse` | string \| null | No | Origin collection warehouse name (Almacén de Origen). May be omitted, empty, or null. |

## POST /api/jobs (create)

**Request body (delta)** — add alongside `originAddress`:

```jsonc
{
  // ...existing job fields...
  "originAddress": "123 Industrial Ave",
  "originWarehouse": "Bodega Central",   // NEW — optional, may be "" or omitted
  "originCity": "Panama City",
  "originCountry": "Panama"
}
```

**Behavior**:

- If present, `originWarehouse` is persisted on the new `Job`.
- If omitted/empty/null, the job is created with `originWarehouse = null`.
- Guarded by existing `forbidBodegaWrite` middleware (unchanged).

**Response (delta)**: The returned job object includes `originWarehouse`.

## PUT /api/jobs/:id (update)

**Request body (delta)** — the frontend sends the full job object (full-PUT
convention); include `originWarehouse`:

```jsonc
{
  // ...full existing job object...
  "originAddress": "123 Industrial Ave",
  "originWarehouse": "Bodega Norte",     // NEW — send full value; "" clears it
  "originCity": "Panama City",
  "originCountry": "Panama"
}
```

**Behavior**:

- `originWarehouse` is written to the record on every update (including empty
  string / null to clear it), consistent with the existing full-object PUT
  convention. Omitting it from a partial PUT would null it out — clients MUST
  send the full object.

**Response (delta)**: The updated job object includes `originWarehouse`.

## GET /api/jobs and GET /api/jobs/:id (read)

- Returned job objects include `originWarehouse` (value or `null`).
- No new filters or search over this field are added in this iteration.

## Error Handling

- No new error conditions. The field is optional and free text; invalid/empty
  values are accepted. Existing global error handler behavior (e.g., Prisma
  `P2025` → 404) is unchanged.
