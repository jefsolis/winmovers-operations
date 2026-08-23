import { useCallback } from 'react';
import * as Network from 'expo-network';
import { api, uploadPhotoToAzure } from '../services/api';
import { updatePhotoUploadState, getPendingPhotos } from '../db/queries';

/**
 * usePhotoUpload — handles uploading pending photos to Azure Blob Storage.
 * Called after adding a photo or when coming back online.
 */
export function usePhotoUpload(packingListServerId: string | null) {
  const uploadPendingPhotos = useCallback(async () => {
    if (!packingListServerId) return;

    const net = await Network.getNetworkStateAsync();
    if (!net.isConnected) return;

    const pending = await getPendingPhotos();
    for (const photo of pending) {
      if (!photo.local_path) continue;
      try {
        await updatePhotoUploadState(photo.id, 'UPLOADING');

        // Get a SAS URL from the backend
        const filename = photo.local_path.split('/').pop() ?? `${photo.id}.jpg`;
        const { sasUrl, blobPath } = await api.getSasUploadToken(packingListServerId, filename);

        // Upload directly to Azure
        await uploadPhotoToAzure(sasUrl, photo.local_path);

        await updatePhotoUploadState(photo.id, 'UPLOADED', blobPath);
      } catch {
        await updatePhotoUploadState(photo.id, 'ERROR');
      }
    }
  }, [packingListServerId]);

  return { uploadPendingPhotos };
}
