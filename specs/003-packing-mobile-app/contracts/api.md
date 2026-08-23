# API Contracts: WinMovers Packing Mobile App

**Feature**: `003-packing-mobile-app` | **Date**: 2026-08-03

All endpoints are under the existing Express app. Authentication via `Authorization: Bearer <JWT>` (Azure AD token) is required on every request. All new routes must be explicitly allowed for the `BODEGA` role in `backend/middleware/accessControl.js`.

---

## Existing Endpoints Consumed (no changes)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/packing-item-types` | Fetch active PackingItemType list for local cache |
| `GET` | `/api/files` | Fetch MovingFiles; mobile app filters `category IN (LOCAL, EXPORT, WAREHOUSE)` |

---

## New Endpoints

### 1. List all packing lists for a Moving File

```
GET /api/packing-lists?movingFileId=:id
```

**Query params**: `movingFileId` (required)

**Response 200**:
```json
[
  {
    "id": "clxxx",
    "listNumber": "PL-0001",
    "movingFileId": "clyyy",
    "operatorName": "Juan",
    "status": "ACTIVE",
    "lockedByDeviceId": "device-uuid-abc",
    "lockExpiresAt": "2026-08-03T18:00:00.000Z",
    "packageCount": 12,
    "createdAt": "2026-08-03T14:00:00.000Z",
    "updatedAt": "2026-08-03T14:30:00.000Z"
  }
]
```

**Also used by**: The web app MovingFile detail page to render the read-only PackingListsPanel.

---

### 2. Get full packing list (for cross-device resume)

```
GET /api/packing-lists/:id
```

**Response 200**: Full packing list including all packages, items, and photo blob paths.

```json
{
  "id": "clxxx",
  "listNumber": "PL-0001",
  "movingFileId": "clyyy",
  "operatorName": "Juan",
  "status": "ACTIVE",
  "signatureUrl": null,
  "signatureDeclined": false,
  "signatureDeclineNote": null,
  "lockedByDeviceId": "device-uuid-abc",
  "lockedAt": "2026-08-03T14:00:00.000Z",
  "lockExpiresAt": "2026-08-03T18:00:00.000Z",
  "packages": [
    {
      "id": "clpkg1",
      "barcode": "ABC123",
      "items": [
        {
          "id": "clitem1",
          "packingItemTypeId": "cltype5",
          "customName": null,
          "quantity": 3,
          "note": null
        }
      ],
      "photos": [
        {
          "id": "clphoto1",
          "blobPath": "2026/clxxx/uuid.jpg"
        }
      ]
    }
  ],
  "createdAt": "2026-08-03T14:00:00.000Z",
  "updatedAt": "2026-08-03T14:30:00.000Z"
}
```

**Response 404**: Packing list not found.

---

### 3. Create a new packing list

```
POST /api/packing-lists
```

**Request body**:
```json
{
  "movingFileId": "clyyy",
  "operatorName": "Juan",
  "deviceId": "device-uuid-abc"
}
```

**Response 201**:
```json
{
  "id": "clxxx",
  "listNumber": "PL-0001",
  "lockedByDeviceId": "device-uuid-abc",
  "lockExpiresAt": "2026-08-03T18:00:00.000Z"
}
```

**Notes**: The creating device automatically holds the edit lock. `listNumber` is auto-assigned.

---

### 4. Save packing list state (debounced live-save)

```
PUT /api/packing-lists/:id
```

**Request body** — full current state snapshot:
```json
{
  "deviceId": "device-uuid-abc",
  "operatorName": "Juan",
  "packages": [
    {
      "id": "clpkg1",
      "barcode": "ABC123",
      "items": [
        {
          "id": "clitem1",
          "packingItemTypeId": "cltype5",
          "customName": null,
          "quantity": 3,
          "note": null
        },
        {
          "id": "clitem2",
          "packingItemTypeId": null,
          "customName": "Cuadros de arte",
          "quantity": 1,
          "note": "Frágil"
        }
      ],
      "photos": [
        { "id": "clphoto1", "blobPath": "2026/clxxx/uuid1.jpg" }
      ]
    }
  ]
}
```

**Response 200**:
```json
{
  "id": "clxxx",
  "updatedAt": "2026-08-03T14:35:00.000Z",
  "lockExpiresAt": "2026-08-03T18:35:00.000Z"
}
```

**Behaviour**:
- The backend replaces the packing list's packages/items/photos in full (upsert by `id`; delete records not present in the payload).
- The backend renews `lockExpiresAt` to `now + 4h` on every successful save from the lock holder.
- **Response 409** if `deviceId` does not match `lockedByDeviceId` and the lock is unexpired.
- **Response 404** if packing list does not exist.

---

### 5. Claim edit lock (cross-device take-over)

```
PATCH /api/packing-lists/:id/claim-lock
```

**Request body**:
```json
{
  "deviceId": "device-uuid-new"
}
```

**Response 200** (lock claimed):
```json
{
  "lockedByDeviceId": "device-uuid-new",
  "lockedAt": "2026-08-03T15:00:00.000Z",
  "lockExpiresAt": "2026-08-03T19:00:00.000Z"
}
```

**Response 409** (lock held by another device and not expired):
```json
{
  "error": "Locked by another device",
  "lockedByDeviceId": "device-uuid-abc",
  "lockExpiresAt": "2026-08-03T18:00:00.000Z"
}
```

**Behaviour**: If no lock exists, or if `lockExpiresAt ≤ now`, the lock is granted immediately (force-claim for dead device recovery). Uses `$transaction` for atomic check-and-set.

---

### 6. Mark packing list complete

```
PATCH /api/packing-lists/:id/complete
```

**Request body**:
```json
{
  "deviceId": "device-uuid-abc",
  "signatureUrl": "2026/clxxx/signature.png",
  "signatureDeclined": false,
  "signatureDeclineNote": null
}
```

**Response 200**:
```json
{
  "id": "clxxx",
  "status": "COMPLETE",
  "listNumber": "PL-0001"
}
```

**Behaviour**:
- Sets `status = COMPLETE`, clears the edit lock.
- Triggers email notification (fire-and-forget via existing `notifications.js` pattern).
- **Response 409** if not the lock holder.
- **Response 400** if packing list has no packages.

---

### 7. Get SAS upload URL for a photo or signature

```
POST /api/packing-lists/upload-token
```

**Request body**:
```json
{
  "packingListId": "clxxx",
  "filename": "photo_001.jpg",
  "contentType": "image/jpeg"
}
```

**Response 200**:
```json
{
  "sasUrl": "https://storageaccount.blob.core.windows.net/job-files/2026/clxxx/uuid.jpg?sv=...&sig=...",
  "blobPath": "2026/clxxx/uuid.jpg"
}
```

**Behaviour**: Generates a write-only SAS URL valid for 1 hour. The mobile app uploads the file directly to `sasUrl` (HTTP PUT with `x-ms-blob-type: BlockBlob`). On success, the `blobPath` is stored locally and included in the next packing list PUT.

---

## BODEGA Role Access Control

The following changes are required in `backend/middleware/accessControl.js`:

```js
// Allow BODEGA full access to packing list routes
if (pathMatches(pathname, '/packing-lists')) return next()
```

This covers all methods (GET, POST, PUT, PATCH) on `/api/packing-lists/*`, which is correct — warehouse operators are the primary users of this API.
