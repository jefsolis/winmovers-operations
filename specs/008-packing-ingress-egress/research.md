# Phase 0 Research: Packing List Ingress & Egress Box Scanning

All items below were resolvable from the existing codebase (packing list lifecycle: `PackingWorkdayEvent`, `PackingProgressTransition`, `PackingDailySignaturePair`, mobile `db/queries.ts` + `services/cacheService.ts` + `services/location.ts`, backend `routes/packingLists.js`). No `[NEEDS CLARIFICATION]` markers remain in the spec, so research focuses on confirming the right implementation pattern to reuse rather than resolving open unknowns.

## 1. Modeling an operation with a variable-size checklist

- **Decision**: Two new Prisma models — `PackingIngressEgressOperation` (one row per started ingress/egress attempt) and `PackingIngressEgressBoxScan` (one row per box checked within that operation, unique on `(operationId, packageId)`).
- **Rationale**: Boxes are already modeled as `Package` rows; a child table lets the checklist grow/shrink with the packing list's actual box count without denormalizing box identity into the operation row. It mirrors the existing `PackingWorkdayEvent` (event) + `PackingDailySignaturePair` (1:1 detail) split, just with a 1:N detail instead of 1:1.
- **Alternatives considered**: Storing checked package IDs as a JSON array on the operation row — rejected because it can't enforce a unique per-box scan record, can't cheaply record scan method/timestamp per box, and doesn't index well for the "which boxes are missing" query.

## 2. Resumable / resettable in-progress operations

- **Decision**: At most one non-complete operation per `(packingListId, type)` at a time. Starting an operation for a type that already has an in-progress row returns/resumes that same row (idempotent "start" call keyed by `(packingListId, type)` server-side, in addition to a client idempotency key). "Reset" is an explicit endpoint that deletes the operation's `PackingIngressEgressBoxScan` rows and clears its signature/location/observations/warehouseLocation fields, keeping the same operation `id` and setting `status` back to `IN_PROGRESS`.
- **Rationale**: Matches FR-008/FR-008a and User Story 1 scenario 6. Keeping the same row (rather than deleting and recreating) keeps a single stable id for the mobile client to reference offline, and avoids orphaned local rows if a reset happens while offline.
- **Alternatives considered**: Soft-delete-and-recreate on reset — rejected as unnecessary complexity for a working-state reset that has no completed data yet (nothing audit-relevant exists to preserve until the operation reaches `COMPLETE`).

## 3. Offline-first sync strategy

- **Decision**: Reuse the exact pattern already used for `PackingWorkdayEvent` / `PackingProgressTransition`: every mutating action (start, scan, reset, sign) carries a client-generated `idempotencyKey`; local SQLite tables mirror the server shape with a `sync_state` column (`PENDING` → `CONFIRMED`); `cacheService.ts`'s existing retry loop is extended to also flush pending ingress/egress rows on connectivity regain.
- **Rationale**: This is a proven, already-audited pattern in this codebase (constitution Principle VII: prefer the smallest change that satisfies the requirement); introducing a different offline strategy would add risk without benefit.
- **Alternatives considered**: A generic "outbox" table for all mobile mutations — rejected as a larger refactor than this feature requires; out of scope per Incremental, Low-Risk Change principle.

## 4. Cross-list box scan rejection

- **Decision**: The scan endpoint resolves the scanned/typed code against `Package.barcode` scoped first to the current packing list; if not found there, it checks whether the code exists on a package belonging to a different packing list and returns a distinct `DIFFERENT_LIST` error code (vs. `NOT_FOUND`) so the mobile client can show the specific warning required by FR-006a.
- **Rationale**: `Package.barcode` is already unique per `(packingListId, barcode)`, not globally unique, so a lookup without the list scope could match a different list's box coincidentally reusing... actually barcodes are assigned per box (often sequential codes), so a global lookup is the correct way to detect "belongs to a different list."
- **Alternatives considered**: Only returning a generic "not found" for any non-matching code — rejected because it does not satisfy FR-006a's explicit requirement for a distinguishable warning.

## 5. Signature storage & single completion location

- **Decision**: Reuse the existing SAS-upload-then-reference pattern: mobile requests a SAS URL via the existing `/api/packing-lists/upload-token` endpoint, uploads the signature PNG directly to Blob Storage, then sends the resulting `blobPath` to the sign endpoint. GPS location is captured client-side with the existing `captureStageLocation()` helper only once, on whichever sign call finalizes the operation (crew leader's call for truck ingress; warehouse manager's call for warehouse ingress/egress), and is stored directly on the operation row.
- **Rationale**: Matches FR-012a (single location, shared by all signatures) and reuses an already-hardened upload path.
- **Alternatives considered**: A separate `OperationSignature` table with its own location columns — rejected per the clarification that signatures do not carry independent locations; a flat pair of nullable signature field-sets on the operation row is simpler and matches the "at most 2 signers" bound.

## 6. Warehouse location & observations fields

- **Decision**: Two plain nullable `@db.Text` columns on the operation row (`warehouseLocation`, `observations`); `warehouseLocation` is only populated/exposed in the UI for `INGRESS_WAREHOUSE`/`EGRESS_WAREHOUSE` types, enforced at the API validation layer (reject/ignore the field for `INGRESS_TRUCK`).
- **Rationale**: Directly satisfies FR-013a/FR-013b; consistent with how `PackingWorkdayEvent.observations` is already modeled.

## 7. Web history display

- **Decision**: Add an "Ingress/Egress History" section to the existing `PackingListsPanel.jsx` (same place other lifecycle history — workday events, transitions — is already rendered), reusing its existing `LocationIndicator` component for the completion location and its existing signature-image-link pattern for each signature.
- **Rationale**: Keeps all packing list history in one place for office staff (FR-015); avoids introducing a new page/route for a single list of records.
