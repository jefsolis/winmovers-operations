# Phase 1 Data Model: Origin Warehouse Field for Import Jobs

**Feature**: 001-origin-warehouse-field
**Date**: 2026-07-21

## Entity: Job (modified)

The existing `Job` model gains one new attribute. No new entities, relations, or
tables are introduced.

### New Field

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `originWarehouse` | `String` | Yes (`String?`) | none (null) | Name of the warehouse / facility at origin where the load must be collected. Free text. |

### Prisma definition (to add near existing origin fields)

```prisma
model Job {
  // ...
  originAddress    String?
  originWarehouse  String?   // NEW: origin collection warehouse name (Almacén de Origen)
  originCity       String?
  originCountry    String?
  // ...
}
```

### Validation Rules

- **Optional**: The field MAY be null or empty; saving a job with no value MUST
  succeed (spec FR-002, SC-002).
- **Length**: Follows the same effective constraints as other origin text fields
  (`originAddress`), i.e., standard nullable text; no special limit enforced.
- **No format constraint**: Free text; no normalization required.

### State & Lifecycle

- Set/updated whenever a job is created or edited through the standard job
  create (POST `/api/jobs`) and update (PUT `/api/jobs/:id`) flows.
- The value is independent of job `status`; it does not participate in any status
  transition or numbering logic.
- Existing jobs read back `originWarehouse` as `null` until a value is entered.

### Relationships

- None. `originWarehouse` is a scalar attribute of `Job`, logically grouped with
  the job's origin information (`originAddress`, `originCity`, `originCountry`).

### Scope Note

- Although stored on all jobs, the field is presented primarily for **Import**
  jobs per the feature request. The origin row that hosts it is shared rendering
  in `JobDocument.jsx`; import scoping is applied at the presentation layer.

## Migration

- Apply with `npx prisma db push` then `npx prisma generate` from `backend/`.
- No data backfill required (nullable, no default).
