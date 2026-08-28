# Contract: Ingress/Egress Operation API

Base path: `/api/packing-lists/:packingListId/ingress-egress` (mounted alongside the existing packing list routes in `backend/routes/packingLists.js`, registered under the existing `router` for that resource).

All endpoints require the same auth/device-lock context already enforced for other packing-list mobile write endpoints. All mutating endpoints accept an `idempotencyKey` and are safe to retry (replaying a known key returns the existing result rather than erroring or duplicating).

## `POST /` — Start or resume an operation

Request:
```json
{
  "type": "INGRESS_TRUCK | INGRESS_WAREHOUSE | EGRESS_WAREHOUSE",
  "deviceId": "string",
  "actorOid": "string",
  "actorName": "string",
  "idempotencyKey": "string",
  "occurredAt": "ISO-8601 datetime"
}
```
Response `200`:
```json
{
  "operation": {
    "id": "string",
    "packingListId": "string",
    "type": "INGRESS_TRUCK",
    "status": "IN_PROGRESS",
    "warehouseLocation": null,
    "observations": null,
    "boxes": [
      { "packageId": "string", "boxNumber": 1, "checked": false, "scanMethod": null, "scannedAt": null }
    ],
    "signatures": { "crewLeader": null, "warehouseManager": null },
    "location": null,
    "completedAt": null
  }
}
```
- If a non-`COMPLETE` operation of the same `type` already exists for this packing list, it is returned as-is (resume), ignoring the new `idempotencyKey`.
- `403` if the packing list is not in the completed state required by FR-002.
- `403` if `type = INGRESS_WAREHOUSE`/`EGRESS_WAREHOUSE`'s warehouse-manager requirement conflicts with... (n/a — no additional precondition beyond FR-002).

## `GET /` — List operations (history, used by both app and web)

Response `200`:
```json
{
  "operations": [
    {
      "id": "string", "type": "EGRESS_WAREHOUSE", "status": "COMPLETE",
      "warehouseLocation": "Aisle 3, Rack B", "observations": "One box had a torn corner.",
      "boxes": [ { "packageId": "string", "boxNumber": 1, "checked": true, "scanMethod": "CAMERA", "scannedAt": "..." } ],
      "signatures": {
        "crewLeader": { "name": "string", "signatureUrl": "https://...", "signedAt": "..." },
        "warehouseManager": { "name": "string", "signatureUrl": "https://...", "signedAt": "..." }
      },
      "location": { "latitude": 9.9, "longitude": -84.1, "accuracy": 12.0, "capturedAt": "...", "unavailableReason": null },
      "completedAt": "..."
    }
  ]
}
```

## `POST /:operationId/scans` — Record one box scan

Request:
```json
{ "code": "string (scanned or manually entered)", "scanMethod": "CAMERA | MANUAL", "scannedAt": "ISO-8601 datetime", "idempotencyKey": "string" }
```
Response `200`: `{ "box": { "packageId": "string", "boxNumber": 1, "checked": true, "scanMethod": "CAMERA", "scannedAt": "..." }, "alreadyChecked": false }`

Errors:
- `404 { "error": "NOT_FOUND" }` — code does not match any box anywhere.
- `409 { "error": "DIFFERENT_LIST" }` — code matches a box belonging to a different packing list; no row created (FR-006a).
- `409 { "error": "OPERATION_COMPLETE" }` — operation already `COMPLETE`; cannot add scans.

## `POST /:operationId/reset` — Reset checklist to zero

Request: `{ "idempotencyKey": "string" }`

Response `200`: the operation object as in `POST /`, with `status: "IN_PROGRESS"`, empty `boxes` checked state, and `warehouseLocation`/`observations`/`signatures`/`location` cleared.

- `409` if operation is already `COMPLETE` (reset is only valid while in progress).

## `POST /:operationId/sign` — Capture a required signature (and, when it finalizes the operation, the completion GPS location)

Request:
```json
{
  "role": "CREW_LEADER | WAREHOUSE_MANAGER",
  "signerName": "string",
  "signatureBlobPath": "string (from the existing upload-token flow)",
  "warehouseLocation": "string, optional (warehouse types only)",
  "observations": "string, optional",
  "location": {
    "latitude": "number, optional", "longitude": "number, optional",
    "accuracy": "number, optional", "capturedAt": "ISO-8601, optional",
    "unavailableReason": "PERMISSION_DENIED | SERVICES_DISABLED | TIMEOUT | UNSUPPORTED | ERROR, optional"
  },
  "idempotencyKey": "string"
}
```
Response `200`: the operation object, with `status` advanced per the state machine in data-model.md.

Errors:
- `409 { "error": "BOXES_MISSING", "missingBoxNumbers": [3, 7] }` — cannot sign while any box is unchecked (FR-009).
- `409 { "error": "ROLE_NOT_APPLICABLE" }` — e.g., `WAREHOUSE_MANAGER` role submitted for an `INGRESS_TRUCK` operation.
- `409 { "error": "WRONG_ORDER" }` — e.g., warehouse-manager signature submitted before the crew-leader signature exists.
- `409 { "error": "ALREADY_COMPLETE" }`.

- `location` is only persisted (and only expected) on the call that transitions the operation into `COMPLETE`; if provided on a non-finalizing call it is ignored.
- `warehouseLocation` is rejected (ignored, or `400` if non-empty) when the operation `type = INGRESS_TRUCK`.
