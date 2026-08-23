import * as Network from 'expo-network';
import { api, uploadSourceToAzure } from './api';
import {
  replaceItemTypeCache, replaceMovingFileCache, upsertPackingList,
  upsertPackage, upsertPackageItem, upsertPackagePhoto,
  markMissingServerPackingListsDeleted, getPackingListByServerId, getMovingFileCache,
  getPackingListsPendingCompletionSync, getLatestServerBackedPackingListByFile,
  updatePackingListSignaturePaths, updatePackingListSyncState, setPackingListClosed,
  updatePhotoUploadState, getPackagesForList, getItemsForPackage, getPhotosForPackage,
} from '../db/queries';

function normalizeSyncError(err: unknown): string {
  const raw = err instanceof Error ? err.message : 'Error de sincronizacion';
  if (/Network request failed/i.test(raw)) return 'Sin conexion temporal. Se reintentara automaticamente.';
  if (/Locked by another device/i.test(raw)) return 'Otro dispositivo tomo el control de la lista.';
  return raw;
}

function isServerClosedStatus(status: string | null | undefined): boolean {
  return status === 'CLOSED' || status === 'COMPLETE';
}

async function uploadPendingPhotosForList(localId: string, serverId: string): Promise<number> {
  const packages = await getPackagesForList(localId);

  for (const pkg of packages) {
    const photos = await getPhotosForPackage(pkg.id);
    for (const photo of photos) {
      if (photo.blob_path || !photo.local_path) continue;
      try {
        await updatePhotoUploadState(photo.id, 'UPLOADING');
        const filename = photo.local_path.split('/').pop() ?? `${photo.id}.jpg`;
        const token = await api.getSasUploadToken(serverId, filename);
        await uploadSourceToAzure(token.sasUrl, photo.local_path, 'image/jpeg');
        await updatePhotoUploadState(photo.id, 'UPLOADED', token.blobPath);
      } catch {
        await updatePhotoUploadState(photo.id, 'ERROR');
      }
    }
  }

  let unresolved = 0;
  for (const pkg of packages) {
    const photos = await getPhotosForPackage(pkg.id);
    unresolved += photos.filter((photo) => !photo.blob_path).length;
  }
  return unresolved;
}

async function buildSavePayload(localId: string, deviceId: string) {
  const packages = await getPackagesForList(localId);
  const remotePackages = await Promise.all(
    packages.map(async (pkg) => {
      const items = await getItemsForPackage(pkg.id);
      const photos = await getPhotosForPackage(pkg.id);
      return {
        id: pkg.server_id ?? pkg.id,
        barcode: pkg.barcode,
        items: items.map((it) => ({
          id: it.server_id ?? it.id,
          packingItemTypeId: it.packing_item_type_id,
          customName: it.custom_name,
          quantity: it.quantity,
          note: it.note,
        })),
        photos: photos
          .filter((ph) => ph.blob_path !== null)
          .map((ph) => ({ id: ph.server_id ?? ph.id, blobPath: ph.blob_path! })),
      };
    })
  );

  return {
    deviceId,
    operatorName: '',
    packages: remotePackages,
  };
}

export async function retryPendingPackingListCompletions(deviceId: string): Promise<void> {
  const net = await Network.getNetworkStateAsync();
  if (!net.isConnected) return;

  const pendingLists = await getPackingListsPendingCompletionSync();

  for (const pl of pendingLists) {
    let serverId = pl.server_id;
    if (!serverId) {
      const candidate = await getLatestServerBackedPackingListByFile(pl.moving_file_id);
      if (candidate?.server_id) {
        serverId = candidate.server_id;
        await updatePackingListSyncState(pl.id, 'COMPLETE_PENDING_SYNC', {
          serverId,
          syncError: 'Reintentando cierre en segundo plano.',
        });
      }
    }

    if (!serverId) {
      await updatePackingListSyncState(pl.id, 'COMPLETE_PENDING_SYNC', {
        syncError: 'No se encontró ID de servidor para completar esta lista.',
      });
      continue;
    }

    // Reconcile first: if server already shows closed, close locally and stop retrying.
    try {
      const detail = await api.getPackingList(serverId);
      if (isServerClosedStatus(detail.status)) {
        await setPackingListClosed(pl.id);
        await updatePackingListSyncState(pl.id, 'CLOSED', { syncError: null });
        continue;
      }
    } catch {
      // Ignore pre-check failures and proceed with retry attempt.
    }

    let signatureBlobPath = pl.signature_blob_path;

    const unresolvedPhotos = await uploadPendingPhotosForList(pl.id, serverId);
    if (unresolvedPhotos > 0) {
      await updatePackingListSyncState(pl.id, 'COMPLETE_PENDING_SYNC', {
        syncError: 'Fotos pendientes de subida antes del cierre.',
      });
      continue;
    }

    try {
      const payload = await buildSavePayload(pl.id, deviceId);
      await api.savePackingList(serverId, {
        ...payload,
        operatorName: pl.operator_name,
      });
    } catch (err: unknown) {
      await updatePackingListSyncState(pl.id, 'COMPLETE_PENDING_SYNC', {
        syncError: `Guardado previo: ${normalizeSyncError(err)}`,
      });
      continue;
    }

    if (pl.signature_declined !== 1 && !signatureBlobPath) {
      if (!pl.signature_local_path) {
        await updatePackingListSyncState(pl.id, 'COMPLETE_PENDING_SYNC', {
          syncError: 'Firma pendiente de sincronizacion. Se reintentara automaticamente.',
        });
        continue;
      }

      try {
        const token = await api.getSasUploadToken(serverId, `signature-${Date.now()}.png`);
        await uploadSourceToAzure(token.sasUrl, pl.signature_local_path, 'image/png');

        signatureBlobPath = token.blobPath;
        await updatePackingListSignaturePaths(pl.id, null, signatureBlobPath);
      } catch (err: unknown) {
        await updatePackingListSyncState(pl.id, 'COMPLETE_PENDING_SYNC', {
          syncError: `Firma: ${normalizeSyncError(err)}`,
        });
        continue;
      }
    }

    try {
      await updatePackingListSyncState(pl.id, 'COMPLETING');
      await api.completePackingList(serverId, {
        deviceId,
        reviewLanguage: pl.review_language === 'EN' ? 'EN' : 'ES',
        signatureUrl: signatureBlobPath,
        signatureDeclined: pl.signature_declined === 1,
        signatureDeclineNote: pl.signature_decline_note,
      });
      await setPackingListClosed(pl.id);
      await updatePackingListSyncState(pl.id, 'CLOSED', { syncError: null });
    } catch (err: unknown) {
      const msg = normalizeSyncError(err);
      if (/not editable in current state/i.test(msg) || /Packing list is not editable/i.test(msg)) {
        await setPackingListClosed(pl.id);
        await updatePackingListSyncState(pl.id, 'CLOSED', { syncError: null });
        continue;
      }

      // If completion request failed due transient network, verify server state once more
      // before keeping this list pending.
      if (/Sin conexion temporal/i.test(msg)) {
        try {
          const detail = await api.getPackingList(serverId);
          if (isServerClosedStatus(detail.status)) {
            await setPackingListClosed(pl.id);
            await updatePackingListSyncState(pl.id, 'CLOSED', { syncError: null });
            continue;
          }
        } catch {
          // Keep pending below.
        }
      }

      await updatePackingListSyncState(pl.id, 'COMPLETE_PENDING_SYNC', { syncError: `Cierre API: ${msg}` });
    }
  }
}

/**
 * Refreshes the item type cache from the server.
 * No-op if offline.
 */
export async function refreshItemTypeCache(): Promise<void> {
  const net = await Network.getNetworkStateAsync();
  if (!net.isConnected) return;

  const types = await api.getItemTypes();
  const now = new Date().toISOString();
  await replaceItemTypeCache(
    types.map(t => ({
      id: t.id,
      name_es: t.nameEs,
      name_en: t.nameEn,
      active: t.active ? 1 : 0,
      cached_at: now,
    }))
  );
}

/**
 * Refreshes the moving file cache from the server.
 * Filters to OPEN files in LOCAL, EXPORT, WAREHOUSE categories.
 * No-op if offline.
 */
export async function refreshMovingFileCache(): Promise<void> {
  const net = await Network.getNetworkStateAsync();
  if (!net.isConnected) return;

  const files = await api.getMovingFiles();
  const eligible = files.filter(
    (f) => f.status === 'OPEN' && ['EXPORT', 'LOCAL', 'WAREHOUSE'].includes(f.category)
  );
  const now = new Date().toISOString();
  await replaceMovingFileCache(
    eligible.map(f => ({
      id: f.id,
      file_number: f.fileNumber,
      category: f.category,
      client_name: f.client?.name ?? f.corporateClient?.companyName ?? null,
      status: f.status,
      cached_at: now,
    }))
  );
}

/**
 * Pulls server packing lists for a given moving file and upserts into local SQLite.
 * Used for cross-device continuity — any device can resume any active list.
 */
export async function syncPackingListsFromServer(movingFileId: string): Promise<void> {
  const net = await Network.getNetworkStateAsync();
  if (!net.isConnected) return;

  const lists = await api.getPackingLists(movingFileId);
  const now = new Date().toISOString();
  const fileCache = await getMovingFileCache();
  const fileById = new Map(fileCache.map((f) => [f.id, f]));

  for (const summary of lists) {
    // Pull full detail to get packages/items/photos
    const detail = await api.getPackingList(summary.id);
    const normalizedStatus = detail.status === 'COMPLETE' ? 'CLOSED' : detail.status;
    const existingLocal = await getPackingListByServerId(detail.id);
    const localId = existingLocal?.id ?? detail.id;
    const localPendingClose = !!existingLocal && (
      existingLocal.status === 'COMPLETE_PENDING_SYNC' ||
      existingLocal.sync_state === 'COMPLETE_PENDING_SYNC' ||
      existingLocal.sync_state === 'COMPLETING'
    );
    const localClosed = !!existingLocal && (
      existingLocal.status === 'CLOSED' ||
      existingLocal.status === 'COMPLETE' ||
      existingLocal.sync_state === 'CLOSED'
    );
    const serverClosed = normalizedStatus === 'CLOSED';
    const effectiveStatus = serverClosed
      ? 'CLOSED'
      : (localClosed ? 'CLOSED' : (localPendingClose ? 'COMPLETE_PENDING_SYNC' : normalizedStatus));
    const effectiveSyncState = serverClosed
      ? 'CLOSED'
      : (localClosed ? 'CLOSED' : (localPendingClose ? (existingLocal?.sync_state === 'COMPLETING' ? 'COMPLETING' : 'COMPLETE_PENDING_SYNC') : 'SAVED'));
    const effectiveSyncError = (serverClosed || localClosed)
      ? null
      : (localPendingClose ? (existingLocal?.sync_error ?? null) : null);
    const movingFile = fileById.get(detail.movingFileId);
    const movingFileRef = {
      id: detail.movingFileId,
      fileNumber: movingFile?.file_number ?? '',
      category: movingFile?.category ?? '',
      clientName: movingFile?.client_name ?? null,
    };
    await upsertPackingList({
      id: localId,
      server_id: detail.id,
      list_number: detail.listNumber,
      moving_file_id: detail.movingFileId,
      moving_file_ref: JSON.stringify(movingFileRef),
      operator_name: detail.operatorName,
      status: effectiveStatus,
      signature_local_path: localPendingClose ? (existingLocal?.signature_local_path ?? null) : null,
      signature_blob_path: localPendingClose ? (existingLocal?.signature_blob_path ?? detail.signatureUrl) : detail.signatureUrl,
      signature_declined: detail.signatureDeclined ? 1 : 0,
      signature_decline_note: detail.signatureDeclineNote,
      review_language: localPendingClose ? (existingLocal?.review_language ?? detail.reviewLanguage ?? null) : (detail.reviewLanguage ?? null),
      completion_requested_at: localPendingClose ? (existingLocal?.completion_requested_at ?? null) : null,
      completion_confirmed_at: effectiveStatus === 'CLOSED' ? (existingLocal?.completion_confirmed_at ?? now) : (existingLocal?.completion_confirmed_at ?? null),
      deleted_at: null,
      locked_by_device_id: detail.lockedByDeviceId,
      lock_expires_at: detail.lockExpiresAt,
      sync_state: effectiveSyncState,
      sync_error: effectiveSyncError,
      last_synced_at: now,
      created_at: detail.createdAt,
      updated_at: detail.updatedAt,
    });

    for (const pkg of detail.packages) {
      await upsertPackage({
        id: pkg.id,
        server_id: pkg.id,
        packing_list_id: localId,
        barcode: pkg.barcode,
        created_at: now,
      });

      for (const item of pkg.items) {
        await upsertPackageItem({
          id: item.id,
          server_id: item.id,
          package_id: pkg.id,
          packing_item_type_id: item.packingItemTypeId,
          custom_name: item.customName,
          quantity: item.quantity,
          note: item.note,
        });
      }

      for (const photo of pkg.photos) {
        await upsertPackagePhoto({
          id: photo.id,
          server_id: photo.id,
          package_id: pkg.id,
          local_path: null,
          blob_path: photo.blobPath,
          upload_state: 'UPLOADED',
        });
      }
    }
  }
}

/**
 * Pulls all non-deleted packing lists available to this user and reconciles local cache.
 * Local lists with a server_id that no longer exists on the server are soft-hidden locally.
 */
export async function refreshAllPackingListsFromServer(): Promise<void> {
  const net = await Network.getNetworkStateAsync();
  if (!net.isConnected) return;

  const summaries = await api.getPackingLists();
  const now = new Date().toISOString();
  const serverIds: string[] = [];
  const fileCache = await getMovingFileCache();
  const fileById = new Map(fileCache.map((f) => [f.id, f]));

  for (const summary of summaries) {
    serverIds.push(summary.id);
    const detail = await api.getPackingList(summary.id);
    const normalizedStatus = detail.status === 'COMPLETE' ? 'CLOSED' : detail.status;
    const existingLocal = await getPackingListByServerId(detail.id);
    const localId = existingLocal?.id ?? detail.id;
    const localPendingClose = !!existingLocal && (
      existingLocal.status === 'COMPLETE_PENDING_SYNC' ||
      existingLocal.sync_state === 'COMPLETE_PENDING_SYNC' ||
      existingLocal.sync_state === 'COMPLETING'
    );
    const localClosed = !!existingLocal && (
      existingLocal.status === 'CLOSED' ||
      existingLocal.status === 'COMPLETE' ||
      existingLocal.sync_state === 'CLOSED'
    );
    const serverClosed = normalizedStatus === 'CLOSED';
    const effectiveStatus = serverClosed
      ? 'CLOSED'
      : (localClosed ? 'CLOSED' : (localPendingClose ? 'COMPLETE_PENDING_SYNC' : normalizedStatus));
    const effectiveSyncState = serverClosed
      ? 'CLOSED'
      : (localClosed ? 'CLOSED' : (localPendingClose ? (existingLocal?.sync_state === 'COMPLETING' ? 'COMPLETING' : 'COMPLETE_PENDING_SYNC') : 'SAVED'));
    const effectiveSyncError = (serverClosed || localClosed)
      ? null
      : (localPendingClose ? (existingLocal?.sync_error ?? null) : null);
    const movingFile = fileById.get(detail.movingFileId);
    const movingFileRef = {
      id: detail.movingFileId,
      fileNumber: movingFile?.file_number ?? '',
      category: movingFile?.category ?? '',
      clientName: movingFile?.client_name ?? null,
    };

    await upsertPackingList({
      id: localId,
      server_id: detail.id,
      list_number: detail.listNumber,
      moving_file_id: detail.movingFileId,
      moving_file_ref: JSON.stringify(movingFileRef),
      operator_name: detail.operatorName,
      status: effectiveStatus,
      signature_local_path: localPendingClose ? (existingLocal?.signature_local_path ?? null) : null,
      signature_blob_path: localPendingClose ? (existingLocal?.signature_blob_path ?? detail.signatureUrl) : detail.signatureUrl,
      signature_declined: detail.signatureDeclined ? 1 : 0,
      signature_decline_note: detail.signatureDeclineNote,
      review_language: localPendingClose ? (existingLocal?.review_language ?? detail.reviewLanguage ?? null) : (detail.reviewLanguage ?? null),
      completion_requested_at: localPendingClose ? (existingLocal?.completion_requested_at ?? null) : null,
      completion_confirmed_at: effectiveStatus === 'CLOSED' ? (existingLocal?.completion_confirmed_at ?? now) : (existingLocal?.completion_confirmed_at ?? null),
      deleted_at: null,
      locked_by_device_id: detail.lockedByDeviceId,
      lock_expires_at: detail.lockExpiresAt,
      sync_state: effectiveSyncState,
      sync_error: effectiveSyncError,
      last_synced_at: now,
      created_at: detail.createdAt,
      updated_at: detail.updatedAt,
    });

    for (const pkg of detail.packages) {
      await upsertPackage({
        id: pkg.id,
        server_id: pkg.id,
        packing_list_id: localId,
        barcode: pkg.barcode,
        created_at: now,
      });

      for (const item of pkg.items) {
        await upsertPackageItem({
          id: item.id,
          server_id: item.id,
          package_id: pkg.id,
          packing_item_type_id: item.packingItemTypeId,
          custom_name: item.customName,
          quantity: item.quantity,
          note: item.note,
        });
      }

      for (const photo of pkg.photos) {
        await upsertPackagePhoto({
          id: photo.id,
          server_id: photo.id,
          package_id: pkg.id,
          local_path: null,
          blob_path: photo.blobPath,
          upload_state: 'UPLOADED',
        });
      }
    }
  }

  await markMissingServerPackingListsDeleted(serverIds);
}
