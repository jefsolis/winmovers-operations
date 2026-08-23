# Mobile SQLite Contract: WinMovers Packing Mobile App

**Feature**: `003-packing-mobile-app` | **Date**: 2026-08-03

This document defines the mobile app's local database contract: what the app writes to and reads from `expo-sqlite`. For the full table DDL see [data-model.md](../data-model.md).

---

## Database Name

`packing.db` — opened at app startup via `SQLite.openDatabaseAsync('packing.db')`.

WAL mode enabled:
```sql
PRAGMA journal_mode = WAL;
```

---

## Key Read Patterns

### Home screen — all packing lists

```sql
SELECT id, server_id, list_number, moving_file_ref, operator_name,
       status, sync_state, sync_error, created_at, updated_at
FROM packing_lists
ORDER BY updated_at DESC;
```

### Open a packing list for editing

```sql
SELECT * FROM packing_lists WHERE id = ?;
SELECT * FROM packages WHERE packing_list_id = ?;
SELECT * FROM package_items WHERE package_id IN (SELECT id FROM packages WHERE packing_list_id = ?);
SELECT * FROM package_photos WHERE package_id IN (SELECT id FROM packages WHERE packing_list_id = ?);
```

### Item type picker

```sql
SELECT id, name_es, name_en FROM item_type_cache WHERE active = 1 ORDER BY name_es;
```

### Moving file picker (new packing list creation)

```sql
SELECT id, file_number, category, client_name, status
FROM moving_file_cache
WHERE status = 'OPEN'
ORDER BY file_number;
```

### Photos pending upload

```sql
SELECT pp.*, p.packing_list_id
FROM package_photos pp
JOIN packages p ON p.id = pp.package_id
WHERE pp.upload_state = 'PENDING' OR pp.upload_state = 'ERROR';
```

---

## Key Write Patterns

### Create new packing list (offline)

```sql
INSERT INTO packing_lists (id, moving_file_id, moving_file_ref, operator_name,
  status, sync_state, created_at, updated_at)
VALUES (?, ?, ?, ?, 'ACTIVE', 'LOCAL', ?, ?);
```

### Add package (barcode scan)

```sql
INSERT INTO packages (id, packing_list_id, barcode, created_at)
VALUES (?, ?, ?, ?);
-- Then update packing list timestamp:
UPDATE packing_lists SET updated_at = ?, sync_state = 'LOCAL' WHERE id = ?;
```

### Mark photo uploaded

```sql
UPDATE package_photos
SET blob_path = ?, upload_state = 'UPLOADED'
WHERE id = ?;
```

### Update sync state after successful server PUT

```sql
UPDATE packing_lists
SET server_id = ?, list_number = ?, sync_state = 'SAVED', last_synced_at = ?
WHERE id = ?;
```

### Mark packing list complete (local)

```sql
UPDATE packing_lists
SET status = 'COMPLETE', sync_state = 'COMPLETING', updated_at = ?
WHERE id = ?;
```

---

## Cache Refresh Contract

### Item type cache refresh

Triggered on app foreground when online. Full replace:
```sql
DELETE FROM item_type_cache;
INSERT INTO item_type_cache (id, name_es, name_en, active, cached_at) VALUES ...;
```

### Moving file cache refresh

Triggered on app foreground when online. Full replace:
```sql
DELETE FROM moving_file_cache;
INSERT INTO moving_file_cache (id, file_number, category, client_name, status, cached_at) VALUES ...;
```

### Server packing list fetch (cross-device resume)

When online at launch, fetch all non-COMPLETE packing lists from the server for this operator's moving files and upsert into local `packing_lists`:
```sql
INSERT OR REPLACE INTO packing_lists (...) VALUES (...);
```
Packages, items, and photos from the server are upserted into their respective tables. Local-only records (offline-created, not yet synced) are preserved as-is.

---

## Device ID

A stable per-device UUID is generated on first launch and stored in `expo-secure-store` under the key `deviceId`. It is used as the `deviceId` field in all API requests for lock management.
