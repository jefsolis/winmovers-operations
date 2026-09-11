# Contract: `coordinatorWorkload` on `GET /api/dashboard`

**Feature**: `011-file-coordinator-filters` | **Phase**: 1 | **Change type**: additive

## Endpoint

`GET /api/dashboard` — existing authenticated endpoint in
[backend/routes/dashboard.js](../../../backend/routes/dashboard.js). No new route, no new registration in
`backend/index.js`, no change to route ordering.

**Request**: unchanged. The existing `from` / `to` range parameters do **not** apply to this key — the
card reports current open workload, not activity over a period.

**Response**: one new top-level key. All existing keys keep their exact shape.

## New response key

```jsonc
{
  // ...all existing dashboard keys unchanged...
  "coordinatorWorkload": [
    {
      "coordinatorId": "clx1a2b3c4d5",
      "name": "Ana Morales",
      "isActive": true,
      "counts": { "EXPORT": 7, "IMPORT": 3, "LOCAL": 0, "WAREHOUSE": 2 },
      "total": 12
    },
    {
      "coordinatorId": "clx9z8y7x6w5",
      "name": "Luis Pérez",
      "isActive": false,
      "counts": { "EXPORT": 1, "IMPORT": 0, "LOCAL": 4, "WAREHOUSE": 0 },
      "total": 5
    },
    {
      "coordinatorId": null,
      "name": null,
      "isActive": null,
      "counts": { "EXPORT": 2, "IMPORT": 6, "LOCAL": 1, "WAREHOUSE": 0 },
      "total": 9
    }
  ]
}
```

## Field rules

| Field | Type | Rule |
|---|---|---|
| `coordinatorId` | `string \| null` | `StaffMember.id`; `null` identifies the single Unassigned row |
| `name` | `string \| null` | `StaffMember.name`; `null` on the Unassigned row — the client supplies the localized label |
| `isActive` | `boolean \| null` | `StaffMember.isActive`; `null` on the Unassigned row |
| `counts` | object | Always contains all four category keys, zero-filled; values are non-negative integers |
| `total` | number | Always equals the sum of `counts` values |

## Aggregation rules

1. **Scope**: only `MovingFile` rows with `status === 'OPEN'` and `deletedAt === null` (FR-012). This
   matches the existing `myCoordinations` scope in the same handler.
2. **Grouping key**: the effective coordinator — `file.coordinator`, else `file.job.coordinator`, else
   the Unassigned group. See [data-model.md](../data-model.md#2-derived-concept-effective-coordinator).
   Implemented in `backend/services/coordinators.js`.
3. **Inclusion**: a coordinator row is emitted only when `total > 0`. The Unassigned row is **always**
   emitted, even when `total === 0`.
4. **Ordering**: coordinator rows sorted by `name` ascending (locale-insensitive, matching existing staff
   ordering); the Unassigned row is always last.
5. **Totals**: column totals and the grand total are **not** sent. The client derives them from the rows
   so every number on the card has one source (FR-011).
6. **Language neutrality**: no localized text is ever returned — category keys are the domain enum values
   and the Unassigned group is expressed as `null`, never as a translated string.

## Access

No new authorization is introduced. The key is returned to any caller already authorized for
`GET /api/dashboard`. Visibility of the card itself is a per-user layout preference handled by the
existing `DASHBOARD_CARDS` registry and `useDashboardLayout()` hook (FR-014), not by this contract.

## Backward compatibility

Clients that ignore `coordinatorWorkload` are unaffected. A client that renders the card but receives a
response without the key (older backend) must treat it as an empty list and render the card's empty
state rather than failing.
