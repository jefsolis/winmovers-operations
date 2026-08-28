# Phase 1 Data Model: Packing List Ingress & Egress Box Scanning

## Entity: PackingIngressEgressOperation

One row per started ingress/egress attempt for a packing list. At most one non-`COMPLETE` row may exist per `(packingListId, type)` at a time.

| Field | Type | Notes |
|---|---|---|
| `id` | string (cuid) | Primary key; stable across reset. |
| `packingListId` | string | FK → `PackingList`, cascade delete. |
| `type` | string enum | `INGRESS_TRUCK` \| `INGRESS_WAREHOUSE` \| `EGRESS_WAREHOUSE`. |
| `status` | string enum | `IN_PROGRESS` → `AWAITING_MANAGER_SIGNATURE` (warehouse types only) → `COMPLETE`. |
| `deviceId` | string | Device that started/owns the operation (mirrors packing list device-lock pattern). |
| `idempotencyKey` | string, unique | Client-generated key for the start/resume call. |
| `warehouseLocation` | text, nullable | Free-text; only meaningful/settable for `INGRESS_WAREHOUSE`/`EGRESS_WAREHOUSE`. |
| `observations` | text, nullable | Free-text notes, any type. |
| `crewLeaderName` | string, nullable | Set when crew leader signs. |
| `crewLeaderSignatureBlobPath` | string, nullable | Azure Blob path. |
| `crewLeaderSignedAt` | datetime, nullable | |
| `warehouseManagerName` | string, nullable | Set when warehouse manager signs (warehouse types only). |
| `warehouseManagerSignatureBlobPath` | string, nullable | Azure Blob path. |
| `warehouseManagerSignedAt` | datetime, nullable | |
| `latitude`, `longitude`, `locationAccuracy`, `locationCapturedAt`, `locationUnavailableReason` | as elsewhere | Captured exactly once, on the sign call that finalizes completion. |
| `completedAt` | datetime, nullable | Set when `status` becomes `COMPLETE`. |
| `createdAt`, `updatedAt` | datetime | |

**Relationships**: belongs to one `PackingList`; has many `PackingIngressEgressBoxScan`.

**Validation rules**:
- `type` fixed at creation; cannot change.
- `warehouseLocation` MUST be rejected/ignored when `type = INGRESS_TRUCK` (FR-013b).
- Cannot transition to `COMPLETE`/`AWAITING_MANAGER_SIGNATURE` while any packing-list box lacks a corresponding `PackingIngressEgressBoxScan` row (FR-009).
- `INGRESS_TRUCK` requires only `crewLeaderSignatureBlobPath` to reach `COMPLETE`.
- `INGRESS_WAREHOUSE` / `EGRESS_WAREHOUSE` require both `crewLeaderSignatureBlobPath` and `warehouseManagerSignatureBlobPath` to reach `COMPLETE`.
- Location fields are set once, on whichever sign call transitions the row into `COMPLETE`; never re-captured on a prior/other signature.
- Reset (while not yet `COMPLETE`): deletes all child `PackingIngressEgressBoxScan` rows and clears `warehouseLocation`, `observations`, both signature field-sets, and location fields; sets `status = IN_PROGRESS`.
- Only available for packing lists whose `status`/`progressStatus` is in the existing "completed" state (FR-002) — same gate already used to unlock other post-completion mobile actions.

**State transitions**:

```
IN_PROGRESS ──(all boxes scanned + crew leader signs)──▶ COMPLETE           [INGRESS_TRUCK]
IN_PROGRESS ──(all boxes scanned + crew leader signs)──▶ AWAITING_MANAGER_SIGNATURE   [warehouse types]
AWAITING_MANAGER_SIGNATURE ──(warehouse manager signs)──▶ COMPLETE
(IN_PROGRESS | AWAITING_MANAGER_SIGNATURE) ──(reset)──▶ IN_PROGRESS  (box scans + signatures cleared)
```

## Entity: PackingIngressEgressBoxScan

One row per box confirmed within one operation.

| Field | Type | Notes |
|---|---|---|
| `id` | string (cuid) | Primary key. |
| `operationId` | string | FK → `PackingIngressEgressOperation`, cascade delete. |
| `packageId` | string | FK → `Package` (the box). |
| `scanMethod` | string enum | `CAMERA` \| `MANUAL`. |
| `scannedAt` | datetime | Client-reported scan time. |
| `idempotencyKey` | string, unique | Client-generated key for this specific scan event (offline replay safety). |
| `createdAt` | datetime | Server receipt time. |

**Validation rules**:
- Unique on `(operationId, packageId)` — re-scanning an already-checked box is a no-op confirmation (FR-007), not a new row.
- `packageId` MUST belong to the same `packingListId` as the parent operation; if the resolved package belongs to a different packing list, the API rejects with a distinguishable error and does not create a row (FR-006a).
- If the code matches no `Package` at all, the API rejects with a generic not-found error and does not create a row (FR-006).

## Relationship Summary

```
PackingList 1──N PackingIngressEgressOperation 1──N PackingIngressEgressBoxScan N──1 Package
```

- `PackingList.ingressEgressOperations PackingIngressEgressOperation[]` (new back-relation)
- `Package.ingressEgressScans PackingIngressEgressBoxScan[]` (new back-relation)

## Mobile Local Schema (SQLite mirror)

New tables in `mobile/src/db/schema.ts`, mirroring the server shape with local-first fields consistent with existing tables (`server_id`, `sync_state`, `sync_error`):

- `ingress_egress_operations` — mirrors `PackingIngressEgressOperation`, keyed by local `id` with nullable `server_id` until synced; `sync_state`: `PENDING` → `CONFIRMED`.
- `ingress_egress_box_scans` — mirrors `PackingIngressEgressBoxScan`, same `sync_state` pattern, `UNIQUE(operation_id, package_id)` enforced locally too.

Both tables use `ON DELETE CASCADE` from `packing_lists`/`ingress_egress_operations` respectively, matching the existing convention.
