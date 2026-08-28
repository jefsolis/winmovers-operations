import * as Network from 'expo-network';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import axios from 'axios';
import { api, uploadSourceToAzure } from './api';
import { stageLocationFromRow } from './location';
import {
  replaceItemTypeCache, replaceMovingFileCache, upsertPackingList,
  upsertPackage,
  markMissingServerPackingListsDeleted, getPackingListByServerId, getMovingFileCache,
  getPackingListsPendingCompletionSync, getLatestServerBackedPackingListByFile,
  updatePackingListSignaturePaths, updatePackingListSyncState, setPackingListClosed,
  updatePackingListCrewSignatureBlob,
  updatePhotoUploadState, getPackagesForList, getItemsForPackage, getPhotosForPackage,
  getPendingProgressTransitions, updateProgressTransitionSyncState,
  confirmProgressTransition, getPackingList,
  reconcilePackingListProgress,
  ensureCompletionIdempotencyKey, reconcilePackagePhotos, deletePackagePhoto,
  reconcilePackageItems,
  purgeDeletedPackagePhotos, purgePackageItemDeletions, replaceWorkdayEventsForList,
  getPendingWorkdayEvents, updateWorkdayEventSyncState,
  applyConfirmedWorkdayEvent,
  ProgressStatus,
  getPendingIngressEgressOperations, getIngressEgressOperationsForList,
  getBoxScansForOperation, updateIngressEgressOperationFields,
  markIngressEgressBoxScanConfirmed, markIngressEgressBoxScanError,
  applyServerIngressEgressOperation, getPackageById,
} from '../db/queries';

function normalizeSyncError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const serverError = err.response?.data?.error;
    if (typeof serverError === 'string' && serverError) return serverError;
  }
  const raw = err instanceof Error ? err.message : 'Error de sincronizacion';
  if (/Network request failed/i.test(raw)) return 'Sin conexion temporal. Se reintentara automaticamente.';
  if (/Locked by another device/i.test(raw)) return 'Otro dispositivo tomo el control de la lista.';
  return raw;
}

function isServerClosedStatus(status: string | null | undefined): boolean {
  return status === 'CLOSED' || status === 'COMPLETE';
}

export async function retryPendingProgressTransitions(deviceId: string, packingListId?: string): Promise<void> {
  const net = await Network.getNetworkStateAsync();
  if (!net.isConnected) return;

  const transitions = await getPendingProgressTransitions(packingListId);
  for (const transition of transitions) {
    if (transition.to_status === 'COMPLETED') continue;
    const packingList = await getPackingList(transition.packing_list_id);
    if (!packingList?.server_id) continue;

    let signatureBlobPath = transition.signature_blob_path;
    try {
      if (transition.to_status === 'WORKING' && !signatureBlobPath) {
        if (!transition.signature_local_path) {
          throw new Error('La firma de llegada esta pendiente.');
        }
        await updateProgressTransitionSyncState(transition.id, 'UPLOADING');
        const token = await api.getSasUploadToken(packingList.server_id, `arrival-${transition.id}.png`);
        await uploadSourceToAzure(token.sasUrl, transition.signature_local_path, 'image/png');
        signatureBlobPath = token.blobPath;
        await updateProgressTransitionSyncState(transition.id, 'SUBMITTING', {
          signatureBlobPath,
          syncError: null,
        });
      } else {
        await updateProgressTransitionSyncState(transition.id, 'SUBMITTING', { syncError: null });
      }

      const result = await api.createProgressTransition(packingList.server_id, {
        idempotencyKey: transition.id,
        deviceId,
        toStatus: transition.to_status as 'TRAVELING' | 'WORKING',
        occurredAt: transition.occurred_at,
        observations: transition.observations,
        signatureUrl: signatureBlobPath,
        location: stageLocationFromRow(transition),
      });
      await confirmProgressTransition(
        transition.id,
        result.transition.id,
        result.transition.confirmedAt,
        result.progressStatus
      );
    } catch (error: unknown) {
      const message = normalizeSyncError(error);
      try {
        const detail = await api.getPackingList(packingList.server_id);
        if (detail.progressStatus === transition.to_status) {
          const confirmed = detail.progressTransitions.find((item) => item.idempotencyKey === transition.id);
          if (confirmed) {
            await confirmProgressTransition(transition.id, confirmed.id, confirmed.confirmedAt, detail.progressStatus);
            continue;
          }
        }
      } catch {
        // Keep the original transition available for the next retry.
      }
      await updateProgressTransitionSyncState(transition.id, 'ERROR', { syncError: message });
    }
  }
}

export async function retryPendingWorkdayEvents(deviceId: string, packingListId?: string): Promise<void> {
  const net = await Network.getNetworkStateAsync();
  if (!net.isConnected) return;

  const events = await getPendingWorkdayEvents(packingListId);
  for (const event of events) {
    if (event.event_type === 'FINAL_COMPLETE') continue;
    const packingList = await getPackingList(event.packing_list_id);
    if (!packingList?.server_id) continue;

    let clientBlob = event.signature_client_blob_path;
    let crewBlob = event.signature_crew_blob_path;

    try {
      if (!clientBlob) {
        if (!event.signature_client_local_path) throw new Error('La firma del cliente de la jornada esta pendiente.');
        await updateWorkdayEventSyncState(event.id, 'UPLOADING');
        const token = await api.getSasUploadToken(packingList.server_id, `workday-client-${event.id}.png`);
        await uploadSourceToAzure(token.sasUrl, event.signature_client_local_path, 'image/png');
        clientBlob = token.blobPath;
      }
      if (!crewBlob) {
        if (!event.signature_crew_local_path) throw new Error('La firma del jefe de cuadrilla esta pendiente.');
        await updateWorkdayEventSyncState(event.id, 'UPLOADING', {
          signatureClientBlobPath: clientBlob,
        });
        const token = await api.getSasUploadToken(packingList.server_id, `workday-crew-${event.id}.png`);
        await uploadSourceToAzure(token.sasUrl, event.signature_crew_local_path, 'image/png');
        crewBlob = token.blobPath;
      }

      await updateWorkdayEventSyncState(event.id, 'SUBMITTING', {
        signatureClientBlobPath: clientBlob,
        signatureCrewBlobPath: crewBlob,
        syncError: null,
      });

      const result = await api.createWorkdayEvent(packingList.server_id, {
        idempotencyKey: event.id,
        deviceId,
        eventType: event.event_type,
        occurredAt: event.occurred_at,
        observations: event.observations,
        signatures: {
          clientSignatureUrl: clientBlob!,
          crewLeaderSignatureUrl: crewBlob!,
          language: event.signature_language === 'EN' ? 'EN' : 'ES',
          clientSignerName: event.client_signer_name,
          crewLeaderName: event.crew_leader_name,
        },
        location: stageLocationFromRow(event),
      });

      await updateWorkdayEventSyncState(event.id, 'CONFIRMED', {
        serverId: result.event.id,
        signatureClientBlobPath: clientBlob,
        signatureCrewBlobPath: crewBlob,
        confirmedAt: result.event.confirmedAt,
        syncError: null,
      });

      // Server owns the workday numbering and signed signature URLs.
      await applyConfirmedWorkdayEvent(event.id, result.event);

      const confirmedProgress = result.event.toProgressStatus || event.to_progress_status;
      if (confirmedProgress) {
        await reconcilePackingListProgress(packingList.id, confirmedProgress as ProgressStatus);
      }
    } catch (error: unknown) {
      await updateWorkdayEventSyncState(event.id, 'ERROR', {
        signatureClientBlobPath: clientBlob,
        signatureCrewBlobPath: crewBlob,
        syncError: normalizeSyncError(error),
      });
    }
  }
}

export async function retryPendingIngressEgress(deviceId: string, packingListId?: string): Promise<void> {
  const net = await Network.getNetworkStateAsync();
  if (!net.isConnected) return;

  const operations = packingListId
    ? await getIngressEgressOperationsForList(packingListId)
    : await getPendingIngressEgressOperations();

  for (const operation of operations) {
    if (operation.sync_state === 'CONFIRMED' && operation.status === 'COMPLETE') continue;
    const packingList = await getPackingList(operation.packing_list_id);
    if (!packingList?.server_id) continue;

    try {
      let serverId = operation.server_id;
      if (!serverId) {
        const started = await api.startIngressEgressOperation(packingList.server_id, {
          type: operation.type,
          deviceId,
          idempotencyKey: operation.id,
          occurredAt: operation.created_at,
        });
        serverId = started.operation.id;
        await updateIngressEgressOperationFields(operation.id, { server_id: serverId });
      }

      const pendingScans = (await getBoxScansForOperation(operation.id)).filter(s => s.sync_state !== 'CONFIRMED');
      for (const scan of pendingScans) {
        const box = await getPackageById(scan.package_id);
        if (!box?.barcode) {
          await markIngressEgressBoxScanError(scan.id, 'El bulto local no tiene codigo de barras asignado.');
          continue;
        }
        try {
          const result = await api.scanIngressEgressBox(packingList.server_id, serverId, {
            code: box.barcode,
            scanMethod: scan.scan_method,
            scannedAt: scan.scanned_at,
            idempotencyKey: scan.id,
          });
          await markIngressEgressBoxScanConfirmed(scan.id, result.box.packageId);
        } catch (error: unknown) {
          await markIngressEgressBoxScanError(scan.id, normalizeSyncError(error));
        }
      }

      if (operation.sync_state !== 'CONFIRMED' && operation.status !== 'COMPLETE') {
        await api.updateIngressEgressDetails(packingList.server_id, serverId, {
          warehouseLocation: operation.warehouse_location,
          observations: operation.observations,
        });
      }

      const isWarehouseType = operation.type === 'INGRESS_WAREHOUSE' || operation.type === 'EGRESS_WAREHOUSE';
      const crewLocallySigned = !!operation.crew_leader_signature_local_path;
      const managerLocallySigned = !isWarehouseType || !!operation.warehouse_manager_signature_local_path;
      const alreadySynced = !!operation.crew_leader_signature_blob_path && (!isWarehouseType || !!operation.warehouse_manager_signature_blob_path);

      if (crewLocallySigned && managerLocallySigned && !alreadySynced) {
        let crewBlob = operation.crew_leader_signature_blob_path;
        if (!crewBlob) {
          const token = await api.getSasUploadToken(packingList.server_id, `ingress-egress-crew-${operation.id}.png`);
          await uploadSourceToAzure(token.sasUrl, operation.crew_leader_signature_local_path!, 'image/png');
          crewBlob = token.blobPath;
          await updateIngressEgressOperationFields(operation.id, { crew_leader_signature_blob_path: crewBlob });
        }

        let managerBlob = operation.warehouse_manager_signature_blob_path || undefined;
        if (isWarehouseType && !managerBlob) {
          const token = await api.getSasUploadToken(packingList.server_id, `ingress-egress-manager-${operation.id}.png`);
          await uploadSourceToAzure(token.sasUrl, operation.warehouse_manager_signature_local_path!, 'image/png');
          managerBlob = token.blobPath;
          await updateIngressEgressOperationFields(operation.id, { warehouse_manager_signature_blob_path: managerBlob });
        }

        const signed = await api.signIngressEgressOperation(packingList.server_id, serverId, {
          crewLeaderSignatureBlobPath: crewBlob,
          crewLeaderName: operation.crew_leader_name || packingList.operator_name,
          warehouseManagerSignatureBlobPath: managerBlob,
          warehouseManagerName: isWarehouseType ? (operation.warehouse_manager_name || '') : undefined,
          warehouseLocation: operation.warehouse_location,
          observations: operation.observations,
          location: stageLocationFromRow(operation),
        });
        await applyServerIngressEgressOperation(operation.id, signed.operation);
      }

      await updateIngressEgressOperationFields(operation.id, { sync_state: 'CONFIRMED', sync_error: null });
    } catch (error: unknown) {
      await updateIngressEgressOperationFields(operation.id, { sync_state: 'ERROR', sync_error: normalizeSyncError(error) });
    }
  }
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
        barcodeState: pkg.barcode_state,
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
      await purgeDeletedPackagePhotos(pl.id);
      await purgePackageItemDeletions(pl.id);
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
      if (!pl.satisfaction_rating || !pl.satisfaction_submitted_at) {
        await updatePackingListSyncState(pl.id, 'COMPLETE_PENDING_SYNC', {
          syncError: 'La calificacion del cliente esta pendiente.',
        });
        continue;
      }
      let crewSignatureBlobPath = pl.crew_signature_blob_path ?? null;
      if (!crewSignatureBlobPath) {
        if (!pl.crew_signature_local_path) {
          await updatePackingListSyncState(pl.id, 'COMPLETE_PENDING_SYNC', {
            syncError: 'La firma del jefe de cuadrilla esta pendiente.',
          });
          continue;
        }
        const crewToken = await api.getSasUploadToken(serverId, `crew-signature-${Date.now()}.png`);
        await uploadSourceToAzure(crewToken.sasUrl, pl.crew_signature_local_path, 'image/png');
        crewSignatureBlobPath = crewToken.blobPath;
        await updatePackingListCrewSignatureBlob(pl.id, crewSignatureBlobPath);
      }
      const idempotencyKey = await ensureCompletionIdempotencyKey(pl.id, Crypto.randomUUID());
      await api.completePackingList(serverId, {
        idempotencyKey,
        deviceId,
        occurredAt: pl.completion_requested_at || pl.satisfaction_submitted_at,
        reviewLanguage: pl.review_language === 'EN' ? 'EN' : 'ES',
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
  const formatAddress = (...parts: Array<string | null | undefined>) => parts.filter(part => part?.trim()).join(', ') || null;
  await replaceMovingFileCache(
    eligible.map(f => {
      const client = f.client || f.corporateClient;
      return ({
      id: f.id,
      file_number: f.fileNumber,
      category: f.category,
      client_name: f.client?.name ?? f.corporateClient?.name ?? f.corporateClient?.companyName ?? null,
      client_id: client?.id ?? null,
      phone: client?.phone ?? f.job?.clientPhone ?? f.job?.clientHomePhone ?? f.job?.companyPhone ?? null,
      address: formatAddress(f.originAddress, f.originCity, f.originCountry)
        ?? formatAddress(f.job?.originAddress, f.job?.originCity, f.job?.originCountry)
        ?? client?.address
        ?? null,
      job_type: f.job?.type ?? f.category,
      service_latitude: f.job?.serviceLatitude ?? null,
      service_longitude: f.job?.serviceLongitude ?? null,
      status: f.status,
      cached_at: now,
    })})
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
      fileNumber: detail.serviceContext.fileNumber || movingFile?.file_number || '',
      category: detail.serviceContext.category || movingFile?.category || '',
      clientId: detail.serviceContext.clientId,
      clientName: detail.serviceContext.clientName || movingFile?.client_name || null,
      phone: detail.serviceContext.phone,
      address: detail.serviceContext.address,
      serviceLatitude: detail.serviceContext.serviceLatitude ?? null,
      serviceLongitude: detail.serviceContext.serviceLongitude ?? null,
      jobType: detail.serviceContext.jobType,
    };
    await upsertPackingList({
      id: localId,
      server_id: detail.id,
      list_number: detail.listNumber,
      moving_file_id: detail.movingFileId,
      moving_file_ref: JSON.stringify(movingFileRef),
      operator_name: detail.operatorName,
      status: effectiveStatus,
      progress_status: serverClosed ? 'COMPLETED' : detail.progressStatus,
      pending_progress_status: existingLocal?.pending_progress_status ?? null,
      signature_local_path: localPendingClose ? (existingLocal?.signature_local_path ?? null) : null,
      signature_blob_path: localPendingClose ? (existingLocal?.signature_blob_path ?? detail.signatureUrl) : detail.signatureUrl,
      signature_declined: detail.signatureDeclined ? 1 : 0,
      signature_decline_note: detail.signatureDeclineNote,
      review_language: localPendingClose ? (existingLocal?.review_language ?? detail.reviewLanguage ?? null) : (detail.reviewLanguage ?? null),
      completion_requested_at: localPendingClose ? (existingLocal?.completion_requested_at ?? null) : null,
      completion_confirmed_at: effectiveStatus === 'CLOSED' ? (existingLocal?.completion_confirmed_at ?? now) : (existingLocal?.completion_confirmed_at ?? null),
      completion_idempotency_key: existingLocal?.completion_idempotency_key ?? null,
      completion_observations: localPendingClose
        ? (existingLocal?.completion_observations ?? null)
        : (detail.progressTransitions.find(item => item.toStatus === 'COMPLETED')?.observations ?? null),
      satisfaction_rating: localPendingClose
        ? (existingLocal?.satisfaction_rating ?? null)
        : (detail.satisfactionResponse?.answers.overallRating ?? null),
      satisfaction_submitted_at: localPendingClose
        ? (existingLocal?.satisfaction_submitted_at ?? null)
        : (detail.satisfactionResponse?.submittedAt ?? null),
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
        barcode_state: pkg.barcodeState,
        barcode_assigned_at: pkg.barcodeAssignedAt ?? null,
        created_at: now,
      });

      await reconcilePackageItems(pkg.id, pkg.items);

      await reconcilePackagePhotos(pkg.id, pkg.photos);
    }
    await replaceWorkdayEventsForList(localId, detail.workdayHistory || []);
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
      fileNumber: detail.serviceContext.fileNumber || movingFile?.file_number || '',
      category: detail.serviceContext.category || movingFile?.category || '',
      clientId: detail.serviceContext.clientId,
      clientName: detail.serviceContext.clientName || movingFile?.client_name || null,
      phone: detail.serviceContext.phone,
      address: detail.serviceContext.address,
      serviceLatitude: detail.serviceContext.serviceLatitude ?? null,
      serviceLongitude: detail.serviceContext.serviceLongitude ?? null,
      jobType: detail.serviceContext.jobType,
    };

    await upsertPackingList({
      id: localId,
      server_id: detail.id,
      list_number: detail.listNumber,
      moving_file_id: detail.movingFileId,
      moving_file_ref: JSON.stringify(movingFileRef),
      operator_name: detail.operatorName,
      status: effectiveStatus,
      progress_status: serverClosed ? 'COMPLETED' : detail.progressStatus,
      pending_progress_status: existingLocal?.pending_progress_status ?? null,
      signature_local_path: localPendingClose ? (existingLocal?.signature_local_path ?? null) : null,
      signature_blob_path: localPendingClose ? (existingLocal?.signature_blob_path ?? detail.signatureUrl) : detail.signatureUrl,
      signature_declined: detail.signatureDeclined ? 1 : 0,
      signature_decline_note: detail.signatureDeclineNote,
      review_language: localPendingClose ? (existingLocal?.review_language ?? detail.reviewLanguage ?? null) : (detail.reviewLanguage ?? null),
      completion_requested_at: localPendingClose ? (existingLocal?.completion_requested_at ?? null) : null,
      completion_confirmed_at: effectiveStatus === 'CLOSED' ? (existingLocal?.completion_confirmed_at ?? now) : (existingLocal?.completion_confirmed_at ?? null),
      completion_idempotency_key: existingLocal?.completion_idempotency_key ?? null,
      completion_observations: localPendingClose
        ? (existingLocal?.completion_observations ?? null)
        : (detail.progressTransitions.find(item => item.toStatus === 'COMPLETED')?.observations ?? null),
      satisfaction_rating: localPendingClose
        ? (existingLocal?.satisfaction_rating ?? null)
        : (detail.satisfactionResponse?.answers.overallRating ?? null),
      satisfaction_submitted_at: localPendingClose
        ? (existingLocal?.satisfaction_submitted_at ?? null)
        : (detail.satisfactionResponse?.submittedAt ?? null),
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
        barcode_state: pkg.barcodeState,
        barcode_assigned_at: pkg.barcodeAssignedAt ?? null,
        created_at: now,
      });

      await reconcilePackageItems(pkg.id, pkg.items);

      await reconcilePackagePhotos(pkg.id, pkg.photos);
    }
    await replaceWorkdayEventsForList(localId, detail.workdayHistory || []);
  }

  await markMissingServerPackingListsDeleted(serverIds);
}
