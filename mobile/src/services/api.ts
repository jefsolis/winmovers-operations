import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { getAccessToken } from '../auth/useAuth';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// Attach auth token to every request
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// ─── API shapes ────────────────────────────────────────────────────────────────

export interface PackingListSummary {
  id: string;
  listNumber: string;
  movingFileId: string;
  operatorName: string;
  status: string;
  reviewLanguage?: 'ES' | 'EN' | null;
  lockedByDeviceId: string | null;
  lockExpiresAt: string | null;
  packageCount: number;
  itemCount?: number;
  photoCount?: number;
  syncVisibilityState?: 'IN_SYNC' | 'SYNC_IN_PROGRESS';
  createdAt: string;
  updatedAt: string;
}

export interface PackingListDetail {
  id: string;
  listNumber: string;
  movingFileId: string;
  operatorName: string;
  status: string;
  reviewLanguage?: 'ES' | 'EN' | null;
  syncVisibilityState?: 'IN_SYNC' | 'SYNC_IN_PROGRESS';
  signatureUrl: string | null;
  signatureDeclined: boolean;
  signatureDeclineNote: string | null;
  lockedByDeviceId: string | null;
  lockedAt: string | null;
  lockExpiresAt: string | null;
  packages: RemotePackage[];
  createdAt: string;
  updatedAt: string;
}

export interface RemotePackage {
  id: string;
  barcode: string;
  items: RemoteItem[];
  photos: RemotePhoto[];
}

export interface RemoteItem {
  id: string;
  packingItemTypeId: string | null;
  customName: string | null;
  quantity: number;
  note: string | null;
}

export interface RemotePhoto {
  id: string;
  blobPath: string;
}

export interface CreatePackingListPayload {
  movingFileId: string;
  operatorName: string;
  deviceId: string;
}

export interface CreatePackingListResponse {
  id: string;
  listNumber: string;
  lockedByDeviceId: string;
  lockExpiresAt: string;
}

export interface SavePackingListPayload {
  deviceId: string;
  operatorName: string;
  packages: {
    id: string;
    barcode: string;
    items: { id: string; packingItemTypeId: string | null; customName: string | null; quantity: number; note: string | null }[];
    photos: { id: string; blobPath: string }[];
  }[];
}

export interface SavePackingListResponse {
  id: string;
  updatedAt: string;
  lockExpiresAt: string;
}

export interface ClaimLockResponse {
  lockedByDeviceId: string;
  lockedAt: string;
  lockExpiresAt: string;
}

export interface CompletePackingListPayload {
  deviceId: string;
  reviewLanguage: 'ES' | 'EN';
  signatureUrl: string | null;
  signatureDeclined: boolean;
  signatureDeclineNote: string | null;
}

export interface SasTokenResponse {
  sasUrl: string;
  blobPath: string;
}

export interface ItemType {
  id: string;
  nameEs: string;
  nameEn: string;
  active: boolean;
}

export interface MovingFileSummary {
  id: string;
  fileNumber: string;
  category: string;
  status: string;
  client?: { name: string } | null;
  corporateClient?: { companyName: string } | null;
}

// ─── API calls ─────────────────────────────────────────────────────────────────

export const api = {
  getPackingLists(movingFileId?: string): Promise<PackingListSummary[]> {
    const params = movingFileId ? { movingFileId } : undefined;
    return apiClient.get('/packing-lists', { params }).then(r => r.data);
  },

  getPackingList(id: string): Promise<PackingListDetail> {
    return apiClient.get(`/packing-lists/${id}`).then(r => r.data);
  },

  createPackingList(payload: CreatePackingListPayload): Promise<CreatePackingListResponse> {
    return apiClient.post('/packing-lists', payload).then(r => r.data);
  },

  savePackingList(id: string, payload: SavePackingListPayload): Promise<SavePackingListResponse> {
    return apiClient.put(`/packing-lists/${id}`, payload).then(r => r.data);
  },

  claimLock(id: string, deviceId: string): Promise<ClaimLockResponse> {
    return apiClient.patch(`/packing-lists/${id}/claim-lock`, { deviceId }).then(r => r.data);
  },

  completePackingList(id: string, payload: CompletePackingListPayload): Promise<{ id: string; status: string; listNumber: string }> {
    return apiClient.patch(`/packing-lists/${id}/complete`, payload).then(r => r.data);
  },

  getSasUploadToken(packingListId: string, filename: string): Promise<SasTokenResponse> {
    return apiClient.post('/packing-lists/upload-token', { packingListId, filename }).then(r => r.data);
  },

  getItemTypes(): Promise<ItemType[]> {
    return apiClient.get('/packing-item-types').then(r => r.data);
  },

  getMovingFiles(): Promise<MovingFileSummary[]> {
    return apiClient.get('/files', { params: { status: 'OPEN' } }).then(r => r.data);
  },
};

// ─── Direct-to-Azure upload ────────────────────────────────────────────────────

function decodeBase64ToUint8Array(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  const clean = base64.replace(/\s/g, '');
  const bytes: number[] = [];

  let index = 0;
  while (index < clean.length) {
    const enc1 = chars.indexOf(clean.charAt(index++));
    const enc2 = chars.indexOf(clean.charAt(index++));
    const enc3 = chars.indexOf(clean.charAt(index++));
    const enc4 = chars.indexOf(clean.charAt(index++));

    if (enc1 < 0 || enc2 < 0) break;

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    bytes.push(chr1);

    if (enc3 !== 64 && enc3 >= 0) {
      const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      bytes.push(chr2);
    }

    if (enc4 !== 64 && enc4 >= 0 && enc3 !== 64 && enc3 >= 0) {
      const chr3 = ((enc3 & 3) << 6) | enc4;
      bytes.push(chr3);
    }
  }

  return Uint8Array.from(bytes);
}

async function readUploadSource(source: string, fallbackContentType: string): Promise<{ body: Blob; contentType: string }> {
  if (source.startsWith('data:')) {
    const match = source.match(/^data:([^;,]+)?;base64,(.*)$/);
    if (!match) {
      throw new Error('No se pudo interpretar la firma almacenada en el dispositivo.');
    }

    const contentType = match[1] || fallbackContentType;
    const bytes = decodeBase64ToUint8Array(match[2]);

    return {
      body: new Blob([bytes], { type: contentType }),
      contentType,
    };
  }

  const response = await fetch(source);
  if (!response.ok) {
    throw new Error('No se pudo leer el archivo local para subirlo.');
  }

  const blob = await response.blob();
  return {
    body: blob,
    contentType: blob.type || fallbackContentType,
  };
}

export async function uploadSourceToAzure(sasUrl: string, source: string, fallbackContentType = 'application/octet-stream'): Promise<void> {
  const { body, contentType } = await readUploadSource(source, fallbackContentType);

  const uploadResponse = await fetch(sasUrl, {
    method: 'PUT',
    headers: {
      'x-ms-blob-type': 'BlockBlob',
      'Content-Type': contentType,
    },
    body,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Azure upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
  }
}

/**
 * Uploads a local file to Azure Blob Storage via a pre-signed SAS URL.
 * The backend issues the SAS URL; the device does the upload directly (no proxy).
 */
export async function uploadPhotoToAzure(sasUrl: string, localUri: string): Promise<void> {
  await uploadSourceToAzure(sasUrl, localUri, 'image/jpeg');
}
