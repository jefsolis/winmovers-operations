import { getDb } from './schema';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SyncState = 'LOCAL' | 'SAVING' | 'SAVED' | 'COMPLETING' | 'COMPLETE_PENDING_SYNC' | 'CLOSED' | 'ERROR';
export type UploadState = 'PENDING' | 'UPLOADING' | 'UPLOADED' | 'ERROR' | 'DELETED';
export type ProgressStatus = 'NOT_STARTED' | 'TRAVELING' | 'WORKING' | 'COMPLETED';
export type ProgressTransitionSyncState = 'PENDING' | 'UPLOADING' | 'SUBMITTING' | 'CONFIRMED' | 'ERROR';

export interface PackingListRow {
  id: string;
  server_id: string | null;
  list_number: string | null;
  moving_file_id: string;
  moving_file_ref: string; // JSON string
  operator_name: string;
  status: string;
  progress_status: ProgressStatus;
  pending_progress_status: ProgressStatus | null;
  signature_local_path: string | null;
  signature_blob_path: string | null;
  signature_declined: number;
  signature_decline_note: string | null;
  review_language: string | null;
  completion_requested_at: string | null;
  completion_confirmed_at: string | null;
  completion_idempotency_key: string | null;
  completion_observations: string | null;
  satisfaction_rating: number | null;
  satisfaction_submitted_at: string | null;
  crew_signature_local_path?: string | null;
  crew_signature_blob_path?: string | null;
  crew_leader_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_accuracy?: number | null;
  location_captured_at?: string | null;
  location_unavailable_reason?: string | null;
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
  barcode: string | null;
  barcode_state: 'MISSING' | 'ASSIGNED';
  barcode_assigned_at: string | null;
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
  client_id: string | null;
  phone: string | null;
  address: string | null;
  job_type: string | null;
  service_latitude?: number | null;
  service_longitude?: number | null;
  status: string;
  cached_at: string;
}

export interface PackingProgressTransitionRow {
  id: string;
  server_id: string | null;
  packing_list_id: string;
  from_status: ProgressStatus;
  to_status: ProgressStatus;
  observations: string | null;
  signature_local_path: string | null;
  signature_blob_path: string | null;
  survey_version: number | null;
  survey_answers: string | null;
  occurred_at: string;
  sync_state: ProgressTransitionSyncState;
  sync_error: string | null;
  created_at: string;
  confirmed_at: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_accuracy?: number | null;
  location_captured_at?: string | null;
  location_unavailable_reason?: string | null;
}

export interface PackingWorkdayEventRow {
  id: string;
  server_id: string | null;
  packing_list_id: string;
  workday_index: number;
  event_type: 'DAY_START' | 'DAY_CLOSE' | 'FINAL_COMPLETE';
  from_progress_status: ProgressStatus | null;
  to_progress_status: ProgressStatus | null;
  observations: string | null;
  occurred_at: string;
  confirmed_at: string | null;
  actor_name: string | null;
  signature_client_local_path: string | null;
  signature_client_blob_path: string | null;
  signature_crew_local_path: string | null;
  signature_crew_blob_path: string | null;
  client_signer_name: string | null;
  crew_leader_name: string | null;
  signature_language: 'ES' | 'EN' | null;
  sync_state: 'PENDING' | 'UPLOADING' | 'SUBMITTING' | 'CONFIRMED' | 'ERROR';
  sync_error: string | null;
  created_at: string;
  updated_at: string;
  latitude?: number | null;
  longitude?: number | null;
  location_accuracy?: number | null;
  location_captured_at?: string | null;
  location_unavailable_reason?: string | null;
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
      status, progress_status, pending_progress_status,
      signature_local_path, signature_blob_path, signature_declined,
       signature_decline_note, review_language, completion_requested_at,
       completion_confirmed_at, completion_idempotency_key, completion_observations,
       satisfaction_rating, satisfaction_submitted_at,
       deleted_at, locked_by_device_id, lock_expires_at,
       sync_state, sync_error, last_synced_at, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       server_id=excluded.server_id,
       list_number=excluded.list_number,
       status=excluded.status,
      progress_status=excluded.progress_status,
      pending_progress_status=excluded.pending_progress_status,
       signature_local_path=excluded.signature_local_path,
       signature_blob_path=excluded.signature_blob_path,
       signature_declined=excluded.signature_declined,
       signature_decline_note=excluded.signature_decline_note,
       review_language=excluded.review_language,
       completion_requested_at=excluded.completion_requested_at,
       completion_confirmed_at=excluded.completion_confirmed_at,
      completion_idempotency_key=excluded.completion_idempotency_key,
      completion_observations=excluded.completion_observations,
      satisfaction_rating=excluded.satisfaction_rating,
      satisfaction_submitted_at=excluded.satisfaction_submitted_at,
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
      row.progress_status, row.pending_progress_status,
      row.signature_local_path, row.signature_blob_path,
      row.signature_declined, row.signature_decline_note,
      row.review_language, row.completion_requested_at,
      row.completion_confirmed_at, row.completion_idempotency_key,
      row.completion_observations, row.satisfaction_rating,
      row.satisfaction_submitted_at, row.deleted_at,
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
  opts?: { serverId?: string; listNumber?: string; lockExpiresAt?: string; syncError?: string | null; lastSyncedAt?: string }
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
  idempotencyKey: string,
  reviewLanguage: 'ES' | 'EN',
  signatureLocalPath: string | null,
  signatureBlobPath: string | null,
  signatureDeclined: boolean,
  signatureDeclineNote: string | null,
  completionObservations: string | null,
  satisfactionRating: number,
  satisfactionSubmittedAt: string,
  crewSignatureLocalPath: string | null = null,
  crewSignatureBlobPath: string | null = null,
  crewLeaderName: string | null = null
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE packing_lists SET
       status = 'COMPLETE_PENDING_SYNC', sync_state = 'COMPLETE_PENDING_SYNC',
      progress_status = 'WORKING', pending_progress_status = 'COMPLETED',
       review_language = ?,
       completion_requested_at = ?,
      completion_idempotency_key = ?, completion_observations = ?,
      satisfaction_rating = ?, satisfaction_submitted_at = ?,
       signature_local_path = ?, signature_blob_path = ?, signature_declined = ?,
       signature_decline_note = ?,
       crew_signature_local_path = ?, crew_signature_blob_path = ?, crew_leader_name = ?,
       updated_at = ?
     WHERE id = ?`,
    [reviewLanguage, now, idempotencyKey, completionObservations, satisfactionRating,
      satisfactionSubmittedAt, signatureLocalPath, signatureBlobPath,
      signatureDeclined ? 1 : 0, signatureDeclineNote,
      crewSignatureLocalPath, crewSignatureBlobPath, crewLeaderName, now, id]
  );
}

export async function updatePackingListCrewSignatureBlob(
  id: string,
  crewSignatureBlobPath: string
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE packing_lists SET crew_signature_blob_path = ?, updated_at = ? WHERE id = ?',
    [crewSignatureBlobPath, new Date().toISOString(), id]
  );
}

export async function ensureCompletionIdempotencyKey(id: string, generatedKey: string): Promise<string> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE packing_lists SET completion_idempotency_key = COALESCE(completion_idempotency_key, ?) WHERE id = ?',
    [generatedKey, id]
  );
  const row = await db.getFirstAsync<{ completion_idempotency_key: string }>(
    'SELECT completion_idempotency_key FROM packing_lists WHERE id = ?',
    [id]
  );
  return row?.completion_idempotency_key || generatedKey;
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

export async function setStageLocation(
  table: 'packing_lists' | 'packing_progress_transitions' | 'packing_workday_events',
  rowId: string,
  location: {
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
    capturedAt: string | null;
    unavailableReason: string | null;
  } | null
): Promise<void> {
  if (!location) return;
  const db = await getDb();
  await db.runAsync(
    `UPDATE ${table}
     SET latitude = ?, longitude = ?, location_accuracy = ?,
         location_captured_at = ?, location_unavailable_reason = ?
     WHERE id = ?`,
    [
      location.latitude,
      location.longitude,
      location.accuracy,
      location.capturedAt,
      location.unavailableReason,
      rowId,
    ]
  );
}

export async function markPackingListDeletedLocally(id: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE packing_lists SET deleted_at = ?, updated_at = ? WHERE id = ?',
    [now, now, id]
  );
}

export async function setPackingListClosed(id: string): Promise<void> {  const db = await getDb();
  await db.runAsync(
    `UPDATE packing_lists SET
       status = 'CLOSED', sync_state = 'CLOSED',
       progress_status = 'COMPLETED', pending_progress_status = NULL,
       completion_confirmed_at = ?, sync_error = NULL, updated_at = ?
     WHERE id = ?`,
    [new Date().toISOString(), new Date().toISOString(), id]
  );
}

// ─── Progress Transitions ─────────────────────────────────────────────────────

export async function enqueueProgressTransition(row: PackingProgressTransitionRow): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const existing = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM packing_progress_transitions
       WHERE packing_list_id = ? AND sync_state != 'CONFIRMED' LIMIT 1`,
      [row.packing_list_id]
    );
    if (existing && existing.id !== row.id) {
      throw new Error('Ya existe un cambio de estado pendiente para esta lista.');
    }

    await db.runAsync(
      `INSERT INTO packing_progress_transitions
        (id, server_id, packing_list_id, from_status, to_status, observations,
         signature_local_path, signature_blob_path, survey_version, survey_answers,
         occurred_at, sync_state, sync_error, created_at, confirmed_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         signature_local_path=COALESCE(excluded.signature_local_path, signature_local_path),
         signature_blob_path=COALESCE(excluded.signature_blob_path, signature_blob_path),
         sync_state=excluded.sync_state, sync_error=excluded.sync_error`,
      [
        row.id, row.server_id, row.packing_list_id, row.from_status, row.to_status,
        row.observations, row.signature_local_path, row.signature_blob_path,
        row.survey_version, row.survey_answers, row.occurred_at, row.sync_state,
        row.sync_error, row.created_at, row.confirmed_at,
      ]
    );
    await db.runAsync(
      'UPDATE packing_lists SET pending_progress_status = ?, updated_at = ? WHERE id = ?',
      [row.to_status, new Date().toISOString(), row.packing_list_id]
    );
  });
}

export async function getPendingProgressTransitions(packingListId?: string): Promise<PackingProgressTransitionRow[]> {
  const db = await getDb();
  if (packingListId) {
    return db.getAllAsync<PackingProgressTransitionRow>(
      `SELECT * FROM packing_progress_transitions
       WHERE packing_list_id = ? AND sync_state != 'CONFIRMED' ORDER BY created_at ASC`,
      [packingListId]
    );
  }
  return db.getAllAsync<PackingProgressTransitionRow>(
    `SELECT * FROM packing_progress_transitions
     WHERE sync_state != 'CONFIRMED' ORDER BY created_at ASC`
  );
}

export async function getProgressTransitionsForList(packingListId: string): Promise<PackingProgressTransitionRow[]> {
  const db = await getDb();
  return db.getAllAsync<PackingProgressTransitionRow>(
    'SELECT * FROM packing_progress_transitions WHERE packing_list_id = ? ORDER BY occurred_at ASC',
    [packingListId]
  );
}

export async function updateProgressTransitionSyncState(
  id: string,
  syncState: ProgressTransitionSyncState,
  options?: { serverId?: string; signatureBlobPath?: string; syncError?: string | null; confirmedAt?: string }
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE packing_progress_transitions SET
       sync_state = ?, server_id = COALESCE(?, server_id),
       signature_blob_path = COALESCE(?, signature_blob_path),
       sync_error = ?, confirmed_at = COALESCE(?, confirmed_at)
     WHERE id = ?`,
    [syncState, options?.serverId ?? null, options?.signatureBlobPath ?? null,
      options?.syncError ?? null, options?.confirmedAt ?? null, id]
  );
}

export async function confirmProgressTransition(
  id: string,
  serverId: string,
  confirmedAt: string,
  progressStatus: ProgressStatus
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const transition = await db.getFirstAsync<PackingProgressTransitionRow>(
      'SELECT * FROM packing_progress_transitions WHERE id = ?',
      [id]
    );
    if (!transition) return;
    await db.runAsync(
      `UPDATE packing_progress_transitions SET server_id = ?, sync_state = 'CONFIRMED',
       sync_error = NULL, confirmed_at = ? WHERE id = ?`,
      [serverId, confirmedAt, id]
    );
    await db.runAsync(
      `UPDATE packing_lists SET progress_status = ?, pending_progress_status = NULL,
       sync_error = NULL, updated_at = ? WHERE id = ?`,
      [progressStatus, new Date().toISOString(), transition.packing_list_id]
    );
  });
}

export async function reconcilePackingListProgress(
  packingListId: string,
  progressStatus: ProgressStatus
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE packing_lists SET progress_status = ?,
     pending_progress_status = CASE WHEN pending_progress_status = ? THEN NULL ELSE pending_progress_status END,
     updated_at = ? WHERE id = ?`,
    [progressStatus, progressStatus, new Date().toISOString(), packingListId]
  );
}

// ─── Packages ─────────────────────────────────────────────────────────────────

export async function upsertPackage(row: PackageRow): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO packages (id, server_id, packing_list_id, barcode, barcode_state, barcode_assigned_at, created_at)
     VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       server_id=excluded.server_id,
       barcode=excluded.barcode,
       barcode_state=excluded.barcode_state,
       barcode_assigned_at=excluded.barcode_assigned_at`,
    [
      row.id,
      row.server_id,
      row.packing_list_id,
      row.barcode,
      row.barcode_state,
      row.barcode_assigned_at,
      row.created_at,
    ]
  );
}

export async function updatePackageBarcodeState(
  packageId: string,
  barcode: string | null,
  barcodeState: 'MISSING' | 'ASSIGNED'
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE packages
     SET barcode = ?,
         barcode_state = ?,
         barcode_assigned_at = CASE WHEN ? = 'ASSIGNED' THEN ? ELSE NULL END
     WHERE id = ?`,
    [barcode, barcodeState, barcodeState, new Date().toISOString(), packageId]
  );
}

export async function getMissingBarcodeCount(packingListId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM packages
     WHERE packing_list_id = ?
       AND (barcode_state = 'MISSING' OR barcode IS NULL OR TRIM(barcode) = '')`,
    [packingListId]
  );
  return row?.count ?? 0;
}

export async function getPackagesForList(packingListId: string): Promise<PackageRow[]> {
  const db = await getDb();
  return db.getAllAsync<PackageRow>(
    'SELECT * FROM packages WHERE packing_list_id = ? ORDER BY created_at ASC',
    [packingListId]
  );
}

export async function getPackageById(id: string): Promise<PackageRow | null> {
  const db = await getDb();
  return db.getFirstAsync<PackageRow>('SELECT * FROM packages WHERE id = ?', [id]);
}

export async function deletePackage(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM packages WHERE id = ?', [id]);
}

// ─── Package Items ─────────────────────────────────────────────────────────────

export async function upsertPackageItem(row: PackageItemRow): Promise<void> {
  const db = await getDb();
  const pendingDeletion = await db.getFirstAsync<{ item_id: string }>(
    'SELECT item_id FROM package_item_deletions WHERE item_id = ?',
    [row.id]
  );
  if (pendingDeletion) return;
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
  await db.withTransactionAsync(async () => {
    const item = await db.getFirstAsync<Pick<PackageItemRow, 'id' | 'package_id'>>(
      'SELECT id, package_id FROM package_items WHERE id = ?',
      [id]
    );
    if (!item) return;
    await db.runAsync(
      `INSERT INTO package_item_deletions (item_id, package_id, deleted_at)
       VALUES (?,?,?)
       ON CONFLICT(item_id) DO UPDATE SET deleted_at=excluded.deleted_at`,
      [item.id, item.package_id, new Date().toISOString()]
    );
    await db.runAsync('DELETE FROM package_items WHERE id = ?', [id]);
  });
}

export async function editPackageItem(
  id: string,
  payload: { packing_item_type_id: string | null; custom_name: string | null; quantity: number; note: string | null }
): Promise<void> {
  const db = await getDb();
  if (!Number.isInteger(payload.quantity) || payload.quantity < 1) {
    throw new Error('La cantidad debe ser un numero entero mayor o igual a 1.');
  }
  if (!payload.packing_item_type_id && !payload.custom_name?.trim()) {
    throw new Error('Debe seleccionar un tipo de articulo o indicar un nombre personalizado.');
  }
  await db.runAsync(
    `UPDATE package_items
     SET packing_item_type_id = ?,
         custom_name = ?,
         quantity = ?,
         note = ?
     WHERE id = ?`,
    [
      payload.packing_item_type_id,
      payload.packing_item_type_id ? null : (payload.custom_name?.trim() || null),
      payload.quantity,
      payload.note?.trim() || null,
      id,
    ]
  );
}

export async function reconcilePackageItems(
  packageId: string,
  remoteItems: Array<{
    id: string;
    packingItemTypeId: string | null;
    customName: string | null;
    quantity: number;
    note: string | null;
  }>
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const remoteIds = new Set(remoteItems.map((item) => item.id));

    for (const item of remoteItems) {
      await upsertPackageItem({
        id: item.id,
        server_id: item.id,
        package_id: packageId,
        packing_item_type_id: item.packingItemTypeId,
        custom_name: item.customName,
        quantity: item.quantity,
        note: item.note,
      });
    }

    const localRows = await db.getAllAsync<Pick<PackageItemRow, 'id' | 'server_id'>>(
      'SELECT id, server_id FROM package_items WHERE package_id = ?',
      [packageId]
    );

    for (const localRow of localRows) {
      // Remove stale items that were previously synced but no longer exist remotely.
      if (!localRow.server_id) continue;
      const remoteKey = localRow.server_id || localRow.id;
      if (!remoteIds.has(remoteKey)) {
        await db.runAsync('DELETE FROM package_items WHERE id = ?', [localRow.id]);
      }
    }
  });
}

// ─── Workday Events ─────────────────────────────────────────────────────────

export async function enqueueWorkdayEvent(row: PackingWorkdayEventRow): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO packing_workday_events
      (id, server_id, packing_list_id, workday_index, event_type, from_progress_status,
       to_progress_status, observations, occurred_at, confirmed_at, actor_name,
       signature_client_local_path, signature_client_blob_path,
       signature_crew_local_path, signature_crew_blob_path,
       client_signer_name, crew_leader_name, signature_language,
       sync_state, sync_error, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       server_id=COALESCE(excluded.server_id, server_id),
       confirmed_at=COALESCE(excluded.confirmed_at, confirmed_at),
       actor_name=COALESCE(excluded.actor_name, actor_name),
       signature_client_blob_path=COALESCE(excluded.signature_client_blob_path, signature_client_blob_path),
       signature_crew_blob_path=COALESCE(excluded.signature_crew_blob_path, signature_crew_blob_path),
       sync_state=excluded.sync_state,
       sync_error=excluded.sync_error,
       updated_at=excluded.updated_at`,
    [
      row.id,
      row.server_id,
      row.packing_list_id,
      row.workday_index,
      row.event_type,
      row.from_progress_status,
      row.to_progress_status,
      row.observations,
      row.occurred_at,
      row.confirmed_at,
      row.actor_name,
      row.signature_client_local_path,
      row.signature_client_blob_path,
      row.signature_crew_local_path,
      row.signature_crew_blob_path,
      row.client_signer_name,
      row.crew_leader_name,
      row.signature_language,
      row.sync_state,
      row.sync_error,
      row.created_at,
      row.updated_at,
    ]
  );
}

export async function getWorkdayEventsForList(packingListId: string): Promise<PackingWorkdayEventRow[]> {
  const db = await getDb();
  return db.getAllAsync<PackingWorkdayEventRow>(
    `SELECT * FROM packing_workday_events
     WHERE packing_list_id = ?
     ORDER BY occurred_at ASC, created_at ASC`,
    [packingListId]
  );
}

export async function getPendingWorkdayEvents(packingListId?: string): Promise<PackingWorkdayEventRow[]> {
  const db = await getDb();
  if (packingListId) {
    return db.getAllAsync<PackingWorkdayEventRow>(
      `SELECT * FROM packing_workday_events
       WHERE packing_list_id = ? AND sync_state != 'CONFIRMED'
       ORDER BY occurred_at ASC, created_at ASC`,
      [packingListId]
    );
  }
  return db.getAllAsync<PackingWorkdayEventRow>(
    `SELECT * FROM packing_workday_events
     WHERE sync_state != 'CONFIRMED'
     ORDER BY occurred_at ASC, created_at ASC`
  );
}

export async function updateWorkdayEventSyncState(
  id: string,
  syncState: PackingWorkdayEventRow['sync_state'],
  options?: { serverId?: string; signatureClientBlobPath?: string | null; signatureCrewBlobPath?: string | null; syncError?: string | null; confirmedAt?: string | null }
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE packing_workday_events
     SET sync_state = ?,
         server_id = COALESCE(?, server_id),
         signature_client_blob_path = COALESCE(?, signature_client_blob_path),
         signature_crew_blob_path = COALESCE(?, signature_crew_blob_path),
         sync_error = ?,
         confirmed_at = COALESCE(?, confirmed_at),
         updated_at = ?
     WHERE id = ?`,
    [
      syncState,
      options?.serverId ?? null,
      options?.signatureClientBlobPath ?? null,
      options?.signatureCrewBlobPath ?? null,
      options?.syncError ?? null,
      options?.confirmedAt ?? null,
      new Date().toISOString(),
      id,
    ]
  );
}

export async function applyConfirmedWorkdayEvent(
  localEventId: string,
  serverEvent: {
    id: string;
    workdayIndex: number;
    confirmedAt: string;
    actorName: string | null;
    signatures?: {
      clientSignatureUrl?: string | null;
      crewLeaderSignatureUrl?: string | null;
      clientSignerName?: string | null;
      crewLeaderName?: string | null;
    } | null;
  }
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE packing_workday_events
     SET server_id = ?,
         workday_index = ?,
         confirmed_at = ?,
         actor_name = COALESCE(?, actor_name),
         signature_client_blob_path = COALESCE(?, signature_client_blob_path),
         signature_crew_blob_path = COALESCE(?, signature_crew_blob_path),
         client_signer_name = COALESCE(?, client_signer_name),
         crew_leader_name = COALESCE(?, crew_leader_name),
         sync_state = 'CONFIRMED',
         sync_error = NULL,
         updated_at = ?
     WHERE id = ?`,
    [
      serverEvent.id,
      serverEvent.workdayIndex,
      serverEvent.confirmedAt,
      serverEvent.actorName ?? null,
      serverEvent.signatures?.clientSignatureUrl ?? null,
      serverEvent.signatures?.crewLeaderSignatureUrl ?? null,
      serverEvent.signatures?.clientSignerName ?? null,
      serverEvent.signatures?.crewLeaderName ?? null,
      new Date().toISOString(),
      localEventId,
    ]
  );
}

export async function getNextWorkdayIndex(packingListId: string): Promise<number> {
  const db = await getDb();
  const latest = await db.getFirstAsync<{ workday_index: number; event_type: string }>(
    `SELECT workday_index, event_type FROM packing_workday_events
     WHERE packing_list_id = ?
     ORDER BY occurred_at DESC, created_at DESC
     LIMIT 1`,
    [packingListId]
  );
  if (!latest) return 1;
  return latest.event_type === 'DAY_CLOSE' ? latest.workday_index + 1 : latest.workday_index;
}

export async function replaceWorkdayEventsForList(
  packingListId: string,
  events: Array<{
    id: string;
    workdayIndex: number;
    eventType: 'DAY_START' | 'DAY_CLOSE' | 'FINAL_COMPLETE';
    fromProgressStatus: ProgressStatus | null;
    toProgressStatus: ProgressStatus | null;
    occurredAt: string;
    confirmedAt: string;
    actorName: string | null;
    observations: string | null;
    signatures?: {
      clientSignatureUrl?: string | null;
      crewLeaderSignatureUrl?: string | null;
      clientSignerName?: string | null;
      crewLeaderName?: string | null;
      language?: 'ES' | 'EN' | null;
    } | null;
  }>
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const pending = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM packing_workday_events
       WHERE packing_list_id = ? AND sync_state != 'CONFIRMED'`,
      [packingListId]
    );
    const pendingIds = new Set(pending.map((row) => row.id));

    await db.runAsync(
      `DELETE FROM packing_workday_events
       WHERE packing_list_id = ? AND sync_state = 'CONFIRMED'`,
      [packingListId]
    );

    for (const event of events) {
      if (pendingIds.has(event.id)) continue;
      const now = new Date().toISOString();
      await enqueueWorkdayEvent({
        id: event.id,
        server_id: event.id,
        packing_list_id: packingListId,
        workday_index: event.workdayIndex,
        event_type: event.eventType,
        from_progress_status: event.fromProgressStatus,
        to_progress_status: event.toProgressStatus,
        observations: event.observations,
        occurred_at: event.occurredAt,
        confirmed_at: event.confirmedAt,
        actor_name: event.actorName,
        signature_client_local_path: null,
        signature_client_blob_path: event.signatures?.clientSignatureUrl ?? null,
        signature_crew_local_path: null,
        signature_crew_blob_path: event.signatures?.crewLeaderSignatureUrl ?? null,
        client_signer_name: event.signatures?.clientSignerName ?? null,
        crew_leader_name: event.signatures?.crewLeaderName ?? null,
        signature_language: event.signatures?.language ?? 'ES',
        sync_state: 'CONFIRMED',
        sync_error: null,
        created_at: now,
        updated_at: now,
      });
    }
  });
}

export async function purgePackageItemDeletions(packingListId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `DELETE FROM package_item_deletions
     WHERE package_id IN (SELECT id FROM packages WHERE packing_list_id = ?)`,
    [packingListId]
  );
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
    "SELECT * FROM package_photos WHERE package_id = ? AND upload_state <> 'DELETED'",
    [packageId]
  );
}

function photoFilename(localPath: string | null): string | null {
  if (!localPath) return null;
  const raw = localPath.split(/[\\/]/).pop()?.split('?')[0];
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function reconcilePackagePhotos(
  packageId: string,
  remotePhotos: Array<{ id: string; blobPath: string }>
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const localPhotos = await db.getAllAsync<PackagePhotoRow>(
      'SELECT * FROM package_photos WHERE package_id = ?',
      [packageId]
    );
    const consumedIds = new Set<string>();

    for (const remote of remotePhotos) {
      const candidates = localPhotos.filter((local) => {
        if (consumedIds.has(local.id)) return false;
        const filename = photoFilename(local.local_path);
        return local.id === remote.id
          || local.server_id === remote.id
          || local.blob_path === remote.blobPath
          || (!!filename && remote.blobPath.endsWith(`-${filename}`));
      });
      const deletedTarget = candidates.find(local => local.upload_state === 'DELETED');
      if (deletedTarget) {
        consumedIds.add(deletedTarget.id);
        for (const duplicate of candidates) {
          if (duplicate.id === deletedTarget.id) continue;
          await db.runAsync('DELETE FROM package_photos WHERE id = ?', [duplicate.id]);
          consumedIds.add(duplicate.id);
        }
        continue;
      }
      const target = candidates.find(local => local.local_path) ?? candidates[0];

      if (target) {
        await db.runAsync(
          `UPDATE package_photos
           SET server_id = ?, package_id = ?, blob_path = ?, upload_state = 'UPLOADED'
           WHERE id = ?`,
          [remote.id, packageId, remote.blobPath, target.id]
        );
        consumedIds.add(target.id);
        for (const duplicate of candidates) {
          if (duplicate.id === target.id) continue;
          await db.runAsync('DELETE FROM package_photos WHERE id = ?', [duplicate.id]);
          consumedIds.add(duplicate.id);
        }
      } else {
        await db.runAsync(
          `INSERT INTO package_photos
            (id, server_id, package_id, local_path, blob_path, upload_state)
           VALUES (?,?,?,?,?,'UPLOADED')
           ON CONFLICT(id) DO UPDATE SET
             server_id=excluded.server_id,
             package_id=excluded.package_id,
             blob_path=excluded.blob_path,
             upload_state='UPLOADED'`,
          [remote.id, remote.id, packageId, null, remote.blobPath]
        );
      }
    }

    await db.runAsync(
      'DELETE FROM package_photos WHERE package_id = ? AND local_path IS NULL AND blob_path IS NULL',
      [packageId]
    );
  });
}

export async function deletePackagePhoto(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM package_photos WHERE id = ?', [id]);
}

export async function markPackagePhotoDeleted(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE package_photos SET upload_state = 'DELETED' WHERE id = ?", [id]);
}

export async function purgeDeletedPackagePhotos(packingListId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `DELETE FROM package_photos
     WHERE upload_state = 'DELETED'
       AND package_id IN (SELECT id FROM packages WHERE packing_list_id = ?)`,
    [packingListId]
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
      `INSERT INTO moving_file_cache
       (id, file_number, category, client_name, client_id, phone, address, job_type,
        service_latitude, service_longitude, status, cached_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [row.id, row.file_number, row.category, row.client_name, row.client_id,
        row.phone, row.address, row.job_type,
        row.service_latitude ?? null, row.service_longitude ?? null,
        row.status, row.cached_at]
    );
  }
}

export async function getMovingFileCache(): Promise<MovingFileCacheRow[]> {
  const db = await getDb();
  return db.getAllAsync<MovingFileCacheRow>(
    "SELECT * FROM moving_file_cache WHERE status = 'OPEN' AND category IN ('EXPORT','LOCAL','WAREHOUSE') ORDER BY file_number ASC"
  );
}

// ─── Ingress / Egress ───────────────────────────────────────────────────────────

export type IngressEgressType = 'INGRESS_TRUCK' | 'INGRESS_WAREHOUSE' | 'EGRESS_WAREHOUSE';
export type IngressEgressStatus = 'IN_PROGRESS' | 'AWAITING_MANAGER_SIGNATURE' | 'COMPLETE';
export type IngressEgressScanMethod = 'CAMERA' | 'MANUAL';
export type IngressEgressSyncState = 'PENDING' | 'CONFIRMED' | 'ERROR';

export interface IngressEgressOperationRow {
  id: string;
  server_id: string | null;
  packing_list_id: string;
  type: IngressEgressType;
  status: IngressEgressStatus;
  device_id: string;
  idempotency_key: string;
  warehouse_location: string | null;
  observations: string | null;
  crew_leader_name: string | null;
  crew_leader_signature_local_path: string | null;
  crew_leader_signature_blob_path: string | null;
  crew_leader_signed_at: string | null;
  warehouse_manager_name: string | null;
  warehouse_manager_signature_local_path: string | null;
  warehouse_manager_signature_blob_path: string | null;
  warehouse_manager_signed_at: string | null;
  latitude: number | null;
  longitude: number | null;
  location_accuracy: number | null;
  location_captured_at: string | null;
  location_unavailable_reason: string | null;
  completed_at: string | null;
  sync_state: IngressEgressSyncState;
  sync_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface IngressEgressBoxScanRow {
  id: string;
  server_id: string | null;
  operation_id: string;
  package_id: string;
  scan_method: IngressEgressScanMethod;
  scanned_at: string;
  idempotency_key: string;
  sync_state: IngressEgressSyncState;
  sync_error: string | null;
  created_at: string;
}

export async function upsertIngressEgressOperation(row: IngressEgressOperationRow): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO ingress_egress_operations
     (id, server_id, packing_list_id, type, status, device_id, idempotency_key,
      warehouse_location, observations,
      crew_leader_name, crew_leader_signature_local_path, crew_leader_signature_blob_path, crew_leader_signed_at,
      warehouse_manager_name, warehouse_manager_signature_local_path, warehouse_manager_signature_blob_path, warehouse_manager_signed_at,
      latitude, longitude, location_accuracy, location_captured_at, location_unavailable_reason,
      completed_at, sync_state, sync_error, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       server_id=excluded.server_id, status=excluded.status,
       warehouse_location=excluded.warehouse_location, observations=excluded.observations,
       crew_leader_name=excluded.crew_leader_name,
       crew_leader_signature_local_path=excluded.crew_leader_signature_local_path,
       crew_leader_signature_blob_path=excluded.crew_leader_signature_blob_path,
       crew_leader_signed_at=excluded.crew_leader_signed_at,
       warehouse_manager_name=excluded.warehouse_manager_name,
       warehouse_manager_signature_local_path=excluded.warehouse_manager_signature_local_path,
       warehouse_manager_signature_blob_path=excluded.warehouse_manager_signature_blob_path,
       warehouse_manager_signed_at=excluded.warehouse_manager_signed_at,
       latitude=excluded.latitude, longitude=excluded.longitude,
       location_accuracy=excluded.location_accuracy, location_captured_at=excluded.location_captured_at,
       location_unavailable_reason=excluded.location_unavailable_reason,
       completed_at=excluded.completed_at, sync_state=excluded.sync_state, sync_error=excluded.sync_error,
       updated_at=excluded.updated_at`,
    [
      row.id, row.server_id, row.packing_list_id, row.type, row.status, row.device_id, row.idempotency_key,
      row.warehouse_location, row.observations,
      row.crew_leader_name, row.crew_leader_signature_local_path, row.crew_leader_signature_blob_path, row.crew_leader_signed_at,
      row.warehouse_manager_name, row.warehouse_manager_signature_local_path, row.warehouse_manager_signature_blob_path, row.warehouse_manager_signed_at,
      row.latitude, row.longitude, row.location_accuracy, row.location_captured_at, row.location_unavailable_reason,
      row.completed_at, row.sync_state, row.sync_error, row.created_at, row.updated_at,
    ]
  );
}

export async function getOpenIngressEgressOperation(packingListId: string, type: IngressEgressType): Promise<IngressEgressOperationRow | null> {
  const db = await getDb();
  return db.getFirstAsync<IngressEgressOperationRow>(
    `SELECT * FROM ingress_egress_operations
     WHERE packing_list_id = ? AND type = ? AND status != 'COMPLETE'
     ORDER BY created_at DESC LIMIT 1`,
    [packingListId, type]
  );
}

export async function getIngressEgressOperation(id: string): Promise<IngressEgressOperationRow | null> {
  const db = await getDb();
  return db.getFirstAsync<IngressEgressOperationRow>('SELECT * FROM ingress_egress_operations WHERE id = ?', [id]);
}

export async function getIngressEgressOperationsForList(packingListId: string): Promise<IngressEgressOperationRow[]> {
  const db = await getDb();
  return db.getAllAsync<IngressEgressOperationRow>(
    'SELECT * FROM ingress_egress_operations WHERE packing_list_id = ? ORDER BY created_at ASC',
    [packingListId]
  );
}

export async function getPendingIngressEgressOperations(): Promise<IngressEgressOperationRow[]> {
  const db = await getDb();
  return db.getAllAsync<IngressEgressOperationRow>("SELECT * FROM ingress_egress_operations WHERE sync_state != 'CONFIRMED'");
}

export async function updateIngressEgressOperationFields(id: string, fields: Partial<IngressEgressOperationRow>): Promise<void> {
  const db = await getDb();
  const columns = Object.keys(fields);
  if (columns.length === 0) return;
  const assignments = columns.map(col => `${col} = ?`).join(', ');
  const values = columns.map(col => (fields as Record<string, unknown>)[col]) as (string | number | null)[];
  await db.runAsync(`UPDATE ingress_egress_operations SET ${assignments} WHERE id = ?`, [...values, id]);
}

export async function resetIngressEgressOperationLocal(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM ingress_egress_box_scans WHERE operation_id = ?', [id]);
  await db.runAsync(
    `UPDATE ingress_egress_operations SET
       status = 'IN_PROGRESS', warehouse_location = NULL, observations = NULL,
       crew_leader_name = NULL, crew_leader_signature_local_path = NULL, crew_leader_signature_blob_path = NULL, crew_leader_signed_at = NULL,
       warehouse_manager_name = NULL, warehouse_manager_signature_local_path = NULL, warehouse_manager_signature_blob_path = NULL, warehouse_manager_signed_at = NULL,
       latitude = NULL, longitude = NULL, location_accuracy = NULL, location_captured_at = NULL, location_unavailable_reason = NULL,
       completed_at = NULL, sync_state = 'PENDING', updated_at = ?
     WHERE id = ?`,
    [new Date().toISOString(), id]
  );
}

export async function upsertIngressEgressBoxScan(row: IngressEgressBoxScanRow): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO ingress_egress_box_scans
     (id, server_id, operation_id, package_id, scan_method, scanned_at, idempotency_key, sync_state, sync_error, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(operation_id, package_id) DO NOTHING`,
    [row.id, row.server_id, row.operation_id, row.package_id, row.scan_method, row.scanned_at, row.idempotency_key, row.sync_state, row.sync_error, row.created_at]
  );
}

export async function getBoxScansForOperation(operationId: string): Promise<IngressEgressBoxScanRow[]> {
  const db = await getDb();
  return db.getAllAsync<IngressEgressBoxScanRow>('SELECT * FROM ingress_egress_box_scans WHERE operation_id = ?', [operationId]);
}

export async function getPendingIngressEgressBoxScans(): Promise<IngressEgressBoxScanRow[]> {
  const db = await getDb();
  return db.getAllAsync<IngressEgressBoxScanRow>("SELECT * FROM ingress_egress_box_scans WHERE sync_state != 'CONFIRMED'");
}

export async function markIngressEgressBoxScanConfirmed(id: string, serverId: string | null): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "UPDATE ingress_egress_box_scans SET sync_state = 'CONFIRMED', sync_error = NULL, server_id = ? WHERE id = ?",
    [serverId, id]
  );
}

export async function markIngressEgressBoxScanError(id: string, error: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE ingress_egress_box_scans SET sync_state = 'ERROR', sync_error = ? WHERE id = ?", [error, id]);
}

export async function applyServerIngressEgressOperation(
  localId: string,
  server: {
    id: string;
    status: IngressEgressStatus;
    warehouseLocation: string | null;
    observations: string | null;
    signatures: {
      crewLeader: { name: string | null; signedAt: string | null } | null;
      warehouseManager: { name: string | null; signedAt: string | null } | null;
    };
    location: { latitude: number | null; longitude: number | null; accuracy: number | null; capturedAt: string | null; unavailableReason: string | null } | null;
    completedAt: string | null;
  }
): Promise<void> {
  await updateIngressEgressOperationFields(localId, {
    server_id: server.id,
    status: server.status,
    warehouse_location: server.warehouseLocation,
    observations: server.observations,
    crew_leader_name: server.signatures.crewLeader?.name ?? null,
    crew_leader_signed_at: server.signatures.crewLeader?.signedAt ?? null,
    warehouse_manager_name: server.signatures.warehouseManager?.name ?? null,
    warehouse_manager_signed_at: server.signatures.warehouseManager?.signedAt ?? null,
    latitude: server.location?.latitude ?? null,
    longitude: server.location?.longitude ?? null,
    location_accuracy: server.location?.accuracy ?? null,
    location_captured_at: server.location?.capturedAt ?? null,
    location_unavailable_reason: server.location?.unavailableReason ?? null,
    completed_at: server.completedAt,
    sync_state: 'CONFIRMED',
    sync_error: null,
    updated_at: new Date().toISOString(),
  });
}
