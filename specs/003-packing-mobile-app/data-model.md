# Data Model: WinMovers Packing Mobile App

**Feature**: `003-packing-mobile-app` | **Date**: 2026-08-03

---

## Backend — Prisma Schema Additions

New models are added to `backend/prisma/schema.prisma`. All existing models are unchanged.

---

### PackingList

Top-level document representing a single on-site packing session.

```prisma
model PackingList {
  id            String    @id @default(cuid())
  listNumber    String    @unique          // auto-assigned: PL-0001, PL-0002, …
  movingFileId  String
  movingFile    MovingFile @relation(fields: [movingFileId], references: [id])
  operatorName  String
  status        String    @default("ACTIVE")
  // status values:
  //   ACTIVE    — in progress (live-saving or offline-local)
  //   COMPLETE  — operator has formally signed off; email sent
  //   ERROR     — final completion failed; needs retry

  // Client sign-off
  signatureUrl  String?   // Azure Blob path (null until uploaded)
  signatureDeclined Boolean @default(false)
  signatureDeclineNote String?

  // Edit lock (cross-device take-over)
  lockedByDeviceId String?
  lockedAt         DateTime?
  lockExpiresAt    DateTime?

  packages      Package[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([movingFileId])
  @@index([status])
  @@index([lockedByDeviceId])
}
```

**Numbering**: Sequential `PL-NNNN` auto-assigned by the backend on first creation (same pattern as `V-`, `Q-`, `E-` numbers).

**Status transitions**:
```
ACTIVE → COMPLETE   (operator marks complete; backend sends email)
ACTIVE → ERROR      (final completion call failed; retry available)
ERROR  → COMPLETE   (retry succeeds)
```

**Relation to MovingFile**: A MovingFile can have multiple PackingLists (e.g., multiple packing sessions). The relation is `MovingFile.packingLists` (back-relation added to MovingFile).

---

### Package

A single physical box within a PackingList, identified by its scanned barcode.

```prisma
model Package {
  id            String      @id @default(cuid())
  packingListId String
  packingList   PackingList @relation(fields: [packingListId], references: [id], onDelete: Cascade)
  barcode       String
  items         PackageItem[]
  photos        PackagePhoto[]
  createdAt     DateTime    @default(now())

  @@unique([packingListId, barcode])   // barcode unique within a packing list
  @@index([packingListId])
}
```

---

### PackageItem

An item assigned to a Package, drawn from the PackingItemType catalog or entered as a custom name.

```prisma
model PackageItem {
  id                String           @id @default(cuid())
  packageId         String
  package           Package          @relation(fields: [packageId], references: [id], onDelete: Cascade)
  packingItemTypeId String?          // null for custom items
  packingItemType   PackingItemType? @relation(fields: [packingItemTypeId], references: [id])
  customName        String?          // populated only when packingItemTypeId is null
  quantity          Int              @default(1)
  note              String?
  createdAt         DateTime         @default(now())

  @@index([packageId])
}
```

**Validation**: Either `packingItemTypeId` or `customName` must be non-null (enforced in route handler, not schema constraint).

---

### PackagePhoto

A photo taken of a Package's contents.

```prisma
model PackagePhoto {
  id         String   @id @default(cuid())
  packageId  String
  package    Package  @relation(fields: [packageId], references: [id], onDelete: Cascade)
  blobPath   String   // Azure Blob Storage path (set after upload)
  uploadedAt DateTime @default(now())

  @@index([packageId])
}
```

**Note**: The mobile app uploads the photo directly to Azure Blob Storage via a SAS URL before submitting the packing list PUT. The backend record is created only once `blobPath` is known; the mobile app holds the local file path in SQLite until upload completes.

---

### Back-relation on MovingFile

Add to the existing `MovingFile` model (additive change only):

```prisma
// in MovingFile model — add this line:
packingLists  PackingList[]
```

---

### Back-relation on PackingItemType

Add to the existing `PackingItemType` model (additive change only):

```prisma
// in PackingItemType model — add this line:
packageItems  PackageItem[]
```

---

## Mobile — SQLite Schema (expo-sqlite)

The mobile app maintains a local SQLite database (`packing.db`) with the following tables. The schema mirrors the server models closely, with additional fields for offline state.

---

### `packing_lists`

```sql
CREATE TABLE IF NOT EXISTS packing_lists (
  id               TEXT PRIMARY KEY,   -- client-generated UUID (used before server assigns listNumber)
  server_id        TEXT,               -- server cuid once created on server (null until first save)
  list_number      TEXT,               -- PL-NNNN from server (null until first save)
  moving_file_id   TEXT NOT NULL,
  moving_file_ref  TEXT NOT NULL,      -- JSON snapshot: { id, fileNumber, category }
  operator_name    TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'ACTIVE',
  signature_local_path TEXT,           -- local file path before upload
  signature_blob_path  TEXT,           -- Azure Blob path after upload
  signature_declined   INTEGER DEFAULT 0,
  signature_decline_note TEXT,
  locked_by_device_id  TEXT,
  lock_expires_at      TEXT,           -- ISO string
  sync_state       TEXT NOT NULL DEFAULT 'LOCAL',
  -- sync_state: LOCAL | SAVING | SAVED | COMPLETING | COMPLETE | ERROR
  sync_error       TEXT,
  last_synced_at   TEXT,               -- ISO string
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
```

---

### `packages`

```sql
CREATE TABLE IF NOT EXISTS packages (
  id              TEXT PRIMARY KEY,    -- client-generated UUID
  server_id       TEXT,               -- server cuid once synced
  packing_list_id TEXT NOT NULL,
  barcode         TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  UNIQUE(packing_list_id, barcode),
  FOREIGN KEY (packing_list_id) REFERENCES packing_lists(id) ON DELETE CASCADE
);
```

---

### `package_items`

```sql
CREATE TABLE IF NOT EXISTS package_items (
  id                   TEXT PRIMARY KEY,
  server_id            TEXT,
  package_id           TEXT NOT NULL,
  packing_item_type_id TEXT,           -- null for custom items
  custom_name          TEXT,
  quantity             INTEGER NOT NULL DEFAULT 1,
  note                 TEXT,
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
);
```

---

### `package_photos`

```sql
CREATE TABLE IF NOT EXISTS package_photos (
  id              TEXT PRIMARY KEY,
  server_id       TEXT,
  package_id      TEXT NOT NULL,
  local_path      TEXT,               -- device file path (before upload)
  blob_path       TEXT,               -- Azure Blob path (after upload)
  upload_state    TEXT NOT NULL DEFAULT 'PENDING',
  -- upload_state: PENDING | UPLOADING | UPLOADED | ERROR
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
);
```

---

### `item_type_cache`

```sql
CREATE TABLE IF NOT EXISTS item_type_cache (
  id         TEXT PRIMARY KEY,
  name_es    TEXT NOT NULL,
  name_en    TEXT NOT NULL,
  active     INTEGER DEFAULT 1,
  cached_at  TEXT NOT NULL
);
```

---

### `moving_file_cache`

```sql
CREATE TABLE IF NOT EXISTS moving_file_cache (
  id          TEXT PRIMARY KEY,
  file_number TEXT NOT NULL,
  category    TEXT NOT NULL,   -- LOCAL | EXPORT | WAREHOUSE
  client_name TEXT,            -- display name for selection UI
  status      TEXT NOT NULL,
  cached_at   TEXT NOT NULL
);
```

---

## State Transitions

### Packing List `sync_state` (mobile-only field)

```
LOCAL       → SAVING      app detects connectivity, debounce fires
SAVING      → SAVED       PUT /api/packing-lists/:id returns 200
SAVING      → ERROR       PUT fails (network drop, server error)
SAVED       → SAVING      new changes arrive (debounce restarts)
SAVED       → COMPLETING  operator marks complete
COMPLETING  → COMPLETE    PATCH /api/packing-lists/:id/complete returns 200
COMPLETING  → ERROR       completion call fails
ERROR       → SAVING      operator taps Retry
```

### Photo `upload_state` (mobile-only field)

```
PENDING   → UPLOADING   connectivity available, SAS URL obtained
UPLOADING → UPLOADED    direct PUT to Azure Blob returns 2xx
UPLOADING → ERROR       upload fails
ERROR     → UPLOADING   retry triggered
```

---

## Validation Rules

| Entity | Rule |
|---|---|
| Package | `barcode` must be unique within its `PackingList` |
| PackageItem | Either `packingItemTypeId` or `customName` must be non-null, not both |
| PackageItem | `quantity` must be integer ≥ 1 |
| PackingList | `signatureDeclined = true` requires `signatureDeclineNote` to be non-empty |
| PackingList | Cannot transition to COMPLETE if no packages exist |
| PackingList | Lock claim rejected if `lockExpiresAt > now()` and `lockedByDeviceId ≠ requestingDeviceId` |
