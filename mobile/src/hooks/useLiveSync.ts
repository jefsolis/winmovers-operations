import { useRef, useCallback, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Network from 'expo-network';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import { api, SavePackingListPayload, uploadPhotoToAzure, uploadSourceToAzure } from '../services/api';
import {
  updatePackingListSyncState,
  updatePackingListSignaturePaths,
  updatePackingListCrewSignatureBlob,
  updatePhotoUploadState,
  getPackingList,
  setPackingListClosed,
  getPackagesForList,
  getItemsForPackage,
  getPhotosForPackage,
  ensureCompletionIdempotencyKey,
  deletePackagePhoto, purgeDeletedPackagePhotos, purgePackageItemDeletions,
} from '../db/queries';
import { retryPendingProgressTransitions, retryPendingWorkdayEvents } from '../services/cacheService';
import { stageLocationFromRow } from '../services/location';

const DEBOUNCE_MS = 2500;

/**
 * Builds the PUT payload from local SQLite state for a given packing list.
 */
async function buildSavePayload(localId: string, deviceId: string): Promise<SavePackingListPayload | null> {
  const pl = await getPackingList(localId);
  if (!pl) return null;

  const packages = await getPackagesForList(localId);
  const remotePackages = await Promise.all(
    packages.map(async pkg => {
      const items = await getItemsForPackage(pkg.id);
      const photos = await getPhotosForPackage(pkg.id);
      return {
        id: pkg.server_id ?? pkg.id,
        barcode: pkg.barcode,
        barcodeState: pkg.barcode_state,
        items: items.map(it => ({
          id: it.server_id ?? it.id,
          packingItemTypeId: it.packing_item_type_id,
          customName: it.custom_name,
          quantity: it.quantity,
          note: it.note,
        })),
        photos: photos
          .filter(ph => ph.blob_path !== null)
          .map(ph => ({ id: ph.server_id ?? ph.id, blobPath: ph.blob_path! })),
      };
    })
  );

  return {
    deviceId,
    operatorName: pl.operator_name,
    packages: remotePackages,
  };
}

async function uploadPendingPhotosForList(localId: string, serverId: string): Promise<number> {
  const packages = await getPackagesForList(localId);

  for (const pkg of packages) {
    const photos = await getPhotosForPackage(pkg.id);
    for (const photo of photos) {
      if (photo.blob_path || !photo.local_path) continue;
      const localFile = await FileSystem.getInfoAsync(photo.local_path);
      if (!localFile.exists) {
        await deletePackagePhoto(photo.id);
        continue;
      }
      try {
        await updatePhotoUploadState(photo.id, 'UPLOADING');
        const filename = photo.local_path.split('/').pop() ?? `${photo.id}.jpg`;
        const token = await api.getSasUploadToken(serverId, filename);
        await uploadPhotoToAzure(token.sasUrl, photo.local_path);
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

/**
 * useLiveSync — manages the debounced live-save loop for a packing list.
 *
 * Call `triggerSync()` whenever local state changes.
 * The hook will debounce and flush on AppState background.
 */
export function useLiveSync(localId: string | null, deviceId: string) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSyncingRef = useRef(false);
  const pendingRef = useRef(false);

  const doSync = useCallback(async () => {
    if (!localId || isSyncingRef.current) {
      pendingRef.current = !!localId;
      return;
    }

    const pl = await getPackingList(localId);
    if (!pl) return;
    if (pl.status === 'CLOSED' || pl.status === 'COMPLETE') {
      await updatePackingListSyncState(localId, 'CLOSED', { syncError: null });
      return;
    }
    const effectiveServerId = pl.server_id;
    if (!effectiveServerId) {
      pendingRef.current = true;
      return;
    }

    // Check connectivity before attempting
    const net = await Network.getNetworkStateAsync();
    if (!net.isConnected) {
      return; // Stay LOCAL — will retry when active
    }

    isSyncingRef.current = true;
    pendingRef.current = false;

    try {
      await retryPendingWorkdayEvents(deviceId, localId);
      await retryPendingProgressTransitions(deviceId, localId);
      if (pl.status === 'COMPLETE_PENDING_SYNC') {
        let signatureBlobPath = pl.signature_blob_path;

        if (pl.signature_declined !== 1 && !signatureBlobPath && pl.signature_local_path) {
          try {
            const token = await api.getSasUploadToken(effectiveServerId, `signature-${Date.now()}.png`);
            await uploadSourceToAzure(token.sasUrl, pl.signature_local_path, 'image/png');
            signatureBlobPath = token.blobPath;
            await updatePackingListSignaturePaths(localId, null, signatureBlobPath);
          } catch (err: unknown) {
            await updatePackingListSyncState(localId, 'COMPLETE_PENDING_SYNC', {
              syncError: `Firma: ${normalizeSyncError(err)}`,
            });
            return;
          }
        }

        if (pl.signature_declined !== 1 && !signatureBlobPath) {
          await updatePackingListSyncState(localId, 'COMPLETE_PENDING_SYNC', {
            syncError: 'Firma pendiente de sincronizacion. Se reintentara automaticamente.',
          });
          return;
        }

        await updatePackingListSyncState(localId, 'COMPLETING');
        if (!pl.satisfaction_rating || !pl.satisfaction_submitted_at) {
          await updatePackingListSyncState(localId, 'COMPLETE_PENDING_SYNC', {
            syncError: 'La calificacion del cliente esta pendiente.',
          });
          return;
        }
        const idempotencyKey = await ensureCompletionIdempotencyKey(localId, Crypto.randomUUID());
        let crewSignatureBlobPath = pl.crew_signature_blob_path ?? null;
        if (!crewSignatureBlobPath) {
          if (!pl.crew_signature_local_path) {
            await updatePackingListSyncState(localId, 'COMPLETE_PENDING_SYNC', {
              syncError: 'La firma del jefe de cuadrilla esta pendiente.',
            });
            return;
          }
          try {
            const crewToken = await api.getSasUploadToken(effectiveServerId, `crew-signature-${Date.now()}.png`);
            await uploadSourceToAzure(crewToken.sasUrl, pl.crew_signature_local_path, 'image/png');
            crewSignatureBlobPath = crewToken.blobPath;
            await updatePackingListCrewSignatureBlob(localId, crewSignatureBlobPath);
          } catch (err: unknown) {
            await updatePackingListSyncState(localId, 'COMPLETE_PENDING_SYNC', {
              syncError: `Firma jefe de cuadrilla: ${normalizeSyncError(err)}`,
            });
            return;
          }
        }
        await api.completePackingList(effectiveServerId, {
          idempotencyKey,
          deviceId,
          occurredAt: pl.completion_requested_at || pl.satisfaction_submitted_at,
          reviewLanguage: (pl.review_language === 'EN' ? 'EN' : 'ES'),
          signatureUrl: signatureBlobPath,
          signatureDeclined: pl.signature_declined === 1,
          signatureDeclineNote: pl.signature_decline_note,
          crewLeaderSignatureUrl: crewSignatureBlobPath,
          crewLeaderName: pl.crew_leader_name ?? null,
          location: stageLocationFromRow(pl),
          completionObservations: pl.completion_observations,
          satisfaction: {
            surveyVersion: 1,
            answers: { overallRating: pl.satisfaction_rating },
            submittedAt: pl.satisfaction_submitted_at,
          },
        });
        await setPackingListClosed(localId);
        await updatePackingListSyncState(localId, 'CLOSED', { syncError: null });
      } else {
        const unresolvedPhotos = await uploadPendingPhotosForList(localId, effectiveServerId);
        if (unresolvedPhotos > 0) {
          await updatePackingListSyncState(localId, 'ERROR', {
            syncError: 'Hay fotos pendientes de subida. Se reintentara automaticamente.',
          });
          return;
        }

        await updatePackingListSyncState(localId, 'SAVING');
        const payload = await buildSavePayload(localId, deviceId);
        if (!payload) return;

        const result = await api.savePackingList(effectiveServerId, payload);
        await purgeDeletedPackagePhotos(localId);
        await purgePackageItemDeletions(localId);
        await updatePackingListSyncState(localId, 'SAVED', {
          lockExpiresAt: result.lockExpiresAt,
          lastSyncedAt: result.updatedAt,
          syncError: null,
        });
      }
    } catch (err: unknown) {
      const msg = normalizeSyncError(err);
      if (/not editable in current state/i.test(msg) || /Packing list is not editable/i.test(msg)) {
        await setPackingListClosed(localId);
        return;
      }
      const scopedMessage = pl.status === 'COMPLETE_PENDING_SYNC' ? `Cierre API: ${msg}` : msg;
      await updatePackingListSyncState(localId, pl.status === 'COMPLETE_PENDING_SYNC' ? 'COMPLETE_PENDING_SYNC' : 'ERROR', { syncError: scopedMessage });
    } finally {
      isSyncingRef.current = false;
      if (pendingRef.current) {
        // Another change arrived while we were syncing — schedule again
        timerRef.current = setTimeout(doSync, DEBOUNCE_MS);
      }
    }
  }, [localId, deviceId]);

  const triggerSync = useCallback(() => {
    if (!localId) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(doSync, DEBOUNCE_MS);
  }, [localId, doSync]);

  const flushSync = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await doSync();
  }, [doSync]);

  // Flush immediately when app goes to background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'background') {
        flushSync();
      }
      if (nextState === 'active') {
        doSync();
      }
    });
    return () => subscription.remove();
  }, [flushSync, doSync]);

  useEffect(() => {
    const subscription = Network.addNetworkStateListener((state) => {
      if (state.isConnected) {
        doSync();
      }
    });
    return () => subscription.remove();
  }, [doSync]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { triggerSync, flushSync };
}

function normalizeSyncError(err: unknown): string {
  const raw = err instanceof Error ? err.message : 'Error de sincronizacion';
  if (/Network request failed/i.test(raw)) return 'Sin conexion temporal. Se reintentara automaticamente.';
  if (/Locked by another device/i.test(raw)) return 'Otro dispositivo tomo el control de la lista.';
  return raw;
}
