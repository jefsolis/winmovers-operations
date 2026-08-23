import { getDb } from './schema';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SyncState = 'LOCAL' | 'SAVING' | 'SAVED' | 'COMPLETING' | 'COMPLETE_PENDING_SYNC' | 'CLOSED' | 'ERROR';
export type UploadState = 'PENDING' | 'UPLOADING' | 'UPLOADED' | 'ERROR';

export interface PackingListRow {
  id: string;
  server_id: string | null;
  list_number: string | null;
  moving_file_id: string;
  moving_file_ref: string; // JSON string
  operator_name: string;
  status: string;
  signature_local_path: string | null;
  signature_blob_path: string | null;
  signature_declined: number;
  signature_decline_note: string | null;
  review_language: string | null;
  completion_requested_at: string | null;
  completion_confirmed_at: string | null;
  deleted_at: string | null;
  locked_by_device_id: string | null;
  lock_expires_at: string | null;
  sync_state: SyncState;
  sync_error: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PackageRow {
  id: string;
  server_id: string | null;
  packing_list_id: string;
  barcode: string;
  created_at: string;
}

export interface PackageItemRow {
  id: string;
  server_id: string | null;
  package_id: string;
  packing_item_type_id: string | null;
  custom_name: string | null;
  quantity: number;
  note: string | null;
}

export interface PackagePhotoRow {
  id: string;
  server_id: string | null;
  package_id: string;
  local_path: string | null;
  blob_path: string | null;
  upload_state: UploadState;
}

export interface ItemTypeCacheRow {
  id: string;
  name_es: string;
  name_en: string;
  active: number;
  cached_at: string;
}

export interface MovingFileCacheRow {
  id: string;
  file_number: string;
  category: string;
  client_name: string | null;
  status: string;
  cached_at: string;
}

// ─── App Settings ─────────────────────────────────────────────────────────────

export async function getAppSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string | null }>(
    'SELECT value FROM app_settings WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`,
    [key, value, new Date().toISOString()]
  );
}

// ─── Packing Lists ────────────────────────────────────────────────────────────

export async function upsertPackingList(row: PackingListRow): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO packing_lists
      (id, server_id, list_number, moving_file_id, moving_file_ref, operator_name,
       status, signature_local_path, signature_blob_path, signature_declined,
       signature_decline_note, review_language, completion_requested_at,
       completion_confirmed_at, deleted_at, locked_by_device_id, lock_expires_at,
       sync_state, sync_error, last_synced_at, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       server_id=excluded.server_id,
       list_number=excluded.list_number,
       status=excluded.status,
       signature_local_path=excluded.signature_local_path,
       signature_blob_path=excluded.signature_blob_path,
       signature_declined=excluded.signature_declined,
       signature_decline_note=excluded.signature_decline_note,
       review_language=excluded.review_language,
       completion_requested_at=excluded.completion_requested_at,
       completion_confirmed_at=excluded.completion_confirmed_at,
       deleted_at=excluded.deleted_at,
       locked_by_device_id=excluded.locked_by_device_id,
       lock_expires_at=excluded.lock_expires_at,
       sync_state=excluded.sync_state,
       sync_error=excluded.sync_error,
       last_synced_at=excluded.last_synced_at,
       updated_at=excluded.updated_at`,
    [
      row.id, row.server_id, row.list_number, row.moving_file_id,
      row.moving_file_ref, row.operator_name, row.status,
      row.signature_local_path, row.signature_blob_path,
      row.signature_declined, row.signature_decline_note,
      row.review_language, row.completion_requested_at,
      row.completion_confirmed_at, row.deleted_at,
      row.locked_by_device_id, row.lock_expires_at,
      row.sync_state, row.sync_error, row.last_synced_at,
      row.created_at, row.updated_at,
    ]
  );
}

export async function getPackingList(id: string): Promise<PackingListRow | null> {
  const db = await getDb();
  return db.getFirstAsync<PackingListRow>(
    'SELECT * FROM packing_lists WHERE id = ?',
    [id]
  );
}

export async function getPackingListByServerId(serverId: string): Promise<PackingListRow | null> {
  const db = await getDb();
  return db.getFirstAsync<PackingListRow>(
    'SELECT * FROM packing_lists WHERE server_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1',
    [serverId]
  );
}

export async function getPackingListsByFile(movingFileId: string): Promise<PackingListRow[]> {
  const db = await getDb();
  return db.getAllAsync<PackingListRow>(
    'SELECT * FROM packing_lists WHERE moving_file_id = ? AND deleted_at IS NULL ORDER BY created_at DESC',
    [movingFileId]
  );
}

export async function getCurrentPackingLists(): Promise<PackingListRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PackingListRow>(
    "SELECT * FROM packing_lists WHERE deleted_at IS NULL ORDER BY updated_at DESC"
  );

  const dedupedByKey = new Map<string, PackingListRow>();
  const rank = (row: PackingListRow): number => {
    if (row.sync_state === 'CLOSED' || row.status === 'CLOSED' || row.status === 'COMPLETE') return 4;
    if (row.sync_state === 'COMPLETE_PENDING_SYNC' || row.status === 'COMPLETE_PENDING_SYNC') return 3;
    if (row.sync_state === 'COMPLETING') return 2;
    return 1;
  };

  for (const row of rows) {
    const key = row.server_id || row.id;
    const current = dedupedByKey.get(key);
    if (!current) {
      dedupedByKey.set(key, row);
      continue;
    }

    const currentRank = rank(current);
    const nextRank = rank(row);
    if (nextRank > currentRank) {
      dedupedByKey.set(key, row);
      continue;
    }

    if (nextRank === currentRank) {
      const currentUpdatedAt = Date.parse(current.updated_at || '') || 0;
      const rowUpdatedAt = Date.parse(row.updated_at || '') || 0;
      if (rowUpdatedAt > currentUpdatedAt) {
        dedupedByKey.set(key, row);
      }
    }
  }

  const deduped = Array.from(dedupedByKey.values());
  deduped.sort((a, b) => {
    const byRank = rank(b) - rank(a);
    if (byRank !== 0) return byRank;
    return (Date.parse(b.updated_at || '') || 0) - (Date.parse(a.updated_at || '') || 0);
  });
  return deduped;
}

export async function getPackingListsPendingCompletionSync(): Promise<PackingListRow[]> {
  const db = await getDb();
  return db.getAllAsync<PackingListRow>(
    `SELECT *
     FROM packing_lists
     WHERE deleted_at IS NULL
       AND (
         status = 'COMPLETE_PENDING_SYNC'
         OR sync_state = 'COMPLETE_PENDING_SYNC'
         OR sync_state = 'COMPLETING'
       )
     ORDER BY updated_at DESC`
  );
}

export async function getLatestServerBackedPackingListByFile(movingFileId: string): Promise<PackingListRow | null> {
  const db = await getDb();
  return db.getFirstAsync<PackingListRow>(
    `SELECT *
     FROM packing_lists
     WHERE moving_file_id = ?
       AND deleted_at IS NULL
       AND server_id IS NOT NULL
     ORDER BY updated_at DESC
     LIMIT 1`,
    [movingFileId]
  );
}

export async function markMissingServerPackingListsDeleted(serverIds: string[]): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  if (serverIds.length === 0) {
    await db.runAsync(
      `UPDATE packing_lists
       SET deleted_at = ?, updated_at = ?
       WHERE server_id IS NOT NULL AND deleted_at IS NULL`,
      [now, now]
    );
    return;
  }

  const placeholders = serverIds.map(() => '?').join(',');
  await db.runAsync(
    `UPDATE packing_lists
     SET deleted_at = ?, updated_at = ?
     WHERE server_id IS NOT NULL
       AND deleted_at IS NULL
       AND server_id NOT IN (${placeholders})`,
    [now, now, ...serverIds]
  );
}

export async function updatePackingListSyncState(
  id: string,
  syncState: SyncState,
  opts?: { serverId?: string; listNumber?: string; lockExpiresAt?: string; syncError?: string; lastSyncedAt?: string }
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE packing_lists SET
       sync_state = ?,
       server_id = COALESCE(?, server_id),
       list_number = COALESCE(?, list_number),
       lock_expires_at = COALESCE(?, lock_expires_at),
       sync_error = ?,
       last_synced_at = COALESCE(?, last_synced_at),
       updated_at = ?
     WHERE id = ?`,
    [
      syncState,
      opts?.serverId ?? null,
      opts?.listNumber ?? null,
      opts?.lockExpiresAt ?? null,
      opts?.syncError ?? null,
      opts?.lastSyncedAt ?? null,
      new Date().toISOString(),
      id,
    ]
  );
}

export async function setPackingListComplete(
  id: string,
  reviewLanguage: 'ES' | 'EN',
  signatureLocalPath: string | null,
  signatureBlobPath: string | null,
  signatureDeclined: boolean,
  signatureDeclineNote: string | null
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE packing_lists SET
       status = 'COMPLETE_PENDING_SYNC', sync_state = 'COMPLETE_PENDING_SYNC',
       review_language = ?,
       completion_requested_at = ?,
       signature_local_path = ?, signature_blob_path = ?, signature_declined = ?,
       signature_decline_note = ?, updated_at = ?
     WHERE id = ?`,
    [reviewLanguage, now, signatureLocalPath, signatureBlobPath, signatureDeclined ? 1 : 0, signatureDeclineNote, now, id]
  );
}

export async function updatePackingListSignaturePaths(
  id: string,
  signatureLocalPath: string | null,
  signatureBlobPath: string | null
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE packing_lists SET
       signature_local_path = COALESCE(?, signature_local_path),
       signature_blob_path = COALESCE(?, signature_blob_path),
       updated_at = ?
     WHERE id = ?`,
    [signatureLocalPath, signatureBlobPath, new Date().toISOString(), id]
  );
}

export async function setPackingListClosed(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE packing_lists SET
       status = 'CLOSED', sync_state = 'CLOSED',
       completion_confirmed_at = ?, sync_error = NULL, updated_at = ?
     WHERE id = ?`,
    [new Date().toISOString(), new Date().toISOString(), id]
  );
}

// ─── Packages ─────────────────────────────────────────────────────────────────

export async function upsertPackage(row: PackageRow): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO packages (id, server_id, packing_list_id, barcode, created_at)
     VALUES (?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET server_id=excluded.server_id`,
    [row.id, row.server_id, row.packing_list_id, row.barcode, row.created_at]
  );
}

export async function getPackagesForList(packingListId: string): Promise<PackageRow[]> {
  const db = await getDb();
  return db.getAllAsync<PackageRow>(
    'SELECT * FROM packages WHERE packing_list_id = ? ORDER BY created_at ASC',
    [packingListId]
  );
}

export async function deletePackage(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM packages WHERE id = ?', [id]);
}

// ─── Package Items ─────────────────────────────────────────────────────────────

export async function upsertPackageItem(row: PackageItemRow): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO package_items
      (id, server_id, package_id, packing_item_type_id, custom_name, quantity, note)
     VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       server_id=excluded.server_id,
       packing_item_type_id=excluded.packing_item_type_id,
       custom_name=excluded.custom_name,
       quantity=excluded.quantity,
       note=excluded.note`,
    [row.id, row.server_id, row.package_id, row.packing_item_type_id, row.custom_name, row.quantity, row.note]
  );
}

export async function getItemsForPackage(packageId: string): Promise<PackageItemRow[]> {
  const db = await getDb();
  return db.getAllAsync<PackageItemRow>(
    'SELECT * FROM package_items WHERE package_id = ?',
    [packageId]
  );
}

export async function deletePackageItem(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM package_items WHERE id = ?', [id]);
}

// ─── Package Photos ────────────────────────────────────────────────────────────

export async function upsertPackagePhoto(row: PackagePhotoRow): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO package_photos
      (id, server_id, package_id, local_path, blob_path, upload_state)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       server_id=excluded.server_id,
       local_path=COALESCE(package_photos.local_path, excluded.local_path),
       blob_path=COALESCE(excluded.blob_path, package_photos.blob_path),
       upload_state=excluded.upload_state`,
    [row.id, row.server_id, row.package_id, row.local_path, row.blob_path, row.upload_state]
  );
}

export async function getPhotosForPackage(packageId: string): Promise<PackagePhotoRow[]> {
  const db = await getDb();
  return db.getAllAsync<PackagePhotoRow>(
    'SELECT * FROM package_photos WHERE package_id = ?',
    [packageId]
  );
}

export async function updatePhotoUploadState(
  id: string,
  uploadState: UploadState,
  blobPath?: string
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE package_photos SET upload_state = ?, blob_path = COALESCE(?, blob_path) WHERE id = ?',
    [uploadState, blobPath ?? null, id]
  );
}

export async function getPendingPhotos(): Promise<PackagePhotoRow[]> {
  const db = await getDb();
  return db.getAllAsync<PackagePhotoRow>(
    "SELECT * FROM package_photos WHERE upload_state IN ('PENDING', 'ERROR') AND local_path IS NOT NULL"
  );
}

// ─── Item Type Cache ───────────────────────────────────────────────────────────

export async function replaceItemTypeCache(rows: ItemTypeCacheRow[]): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM item_type_cache');
  for (const row of rows) {
    await db.runAsync(
      'INSERT INTO item_type_cache (id, name_es, name_en, active, cached_at) VALUES (?,?,?,?,?)',
      [row.id, row.name_es, row.name_en, row.active, row.cached_at]
    );
  }
}

export async function getItemTypeCache(): Promise<ItemTypeCacheRow[]> {
  const db = await getDb();
  return db.getAllAsync<ItemTypeCacheRow>(
    'SELECT * FROM item_type_cache WHERE active = 1 ORDER BY name_es ASC'
  );
}

// ─── Moving File Cache ─────────────────────────────────────────────────────────

export async function replaceMovingFileCache(rows: MovingFileCacheRow[]): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM moving_file_cache');
  for (const row of rows) {
    await db.runAsync(
      'INSERT INTO moving_file_cache (id, file_number, category, client_name, status, cached_at) VALUES (?,?,?,?,?,?)',
      [row.id, row.file_number, row.category, row.client_name, row.status, row.cached_at]
    );
  }
}

export async function getMovingFileCache(): Promise<MovingFileCacheRow[]> {
  const db = await getDb();
  return db.getAllAsync<MovingFileCacheRow>(
    "SELECT * FROM moving_file_cache WHERE status = 'OPEN' AND category IN ('EXPORT','LOCAL','WAREHOUSE') ORDER BY file_number ASC"
  );
}
