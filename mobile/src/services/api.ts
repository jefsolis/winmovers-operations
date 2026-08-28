import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import * as FileSystem from 'expo-file-system';
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

export type ProgressStatus = 'NOT_STARTED' | 'TRAVELING' | 'WORKING' | 'COMPLETED';
export type WorkdayEventType = 'DAY_START' | 'DAY_CLOSE' | 'FINAL_COMPLETE';

export interface StageLocationPayload {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  capturedAt: string | null;
  unavailableReason: string | null;
}

export interface ServiceContext {
  clientId: string | null;
  clientName: string | null;
  phone: string | null;
  address: string | null;
  serviceLatitude?: number | null;
  serviceLongitude?: number | null;
  jobType: string;
  fileNumber: string;
  category: string;
}

export interface ProgressTransition {
  id: string;
  idempotencyKey: string;
  fromStatus: ProgressStatus;
  toStatus: ProgressStatus;
  actorName: string;
  observations: string | null;
  signatureUrl: string | null;
  occurredAt: string;
  confirmedAt: string;
  location?: StageLocationPayload | null;
}

export interface SatisfactionResponse {
  surveyVersion: 1;
  answers: { overallRating: number };
  submittedAt: string;
}

export interface WorkdaySignaturePair {
  clientSignatureUrl: string;
  crewLeaderSignatureUrl: string;
  language: 'ES' | 'EN';
  clientSignerName?: string | null;
  crewLeaderName?: string | null;
}

export interface WorkdayEvent {
  id: string;
  workdayIndex: number;
  eventType: WorkdayEventType;
  fromProgressStatus: ProgressStatus | null;
  toProgressStatus: ProgressStatus | null;
  occurredAt: string;
  confirmedAt: string;
  actorName: string;
  observations: string | null;
  signatures: WorkdaySignaturePair | null;
  location?: StageLocationPayload | null;
}

export interface PackingListSummary {
  id: string;
  listNumber: string;
  movingFileId: string;
  operatorName: string;
  status: string;
  progressStatus: ProgressStatus;
  pendingProgressStatus?: ProgressStatus | null;
  serviceContext: ServiceContext;
  latestTransition?: ProgressTransition | null;
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
  progressStatus: ProgressStatus;
  serviceContext: ServiceContext;
  progressTransitions: ProgressTransition[];
  workdayHistory: WorkdayEvent[];
  completionBlockedReason: 'MISSING_BOX_BARCODES' | null;
  satisfactionResponse: SatisfactionResponse | null;
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
  barcode: string | null;
  barcodeState: 'MISSING' | 'ASSIGNED';
  barcodeAssignedAt?: string | null;
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
  downloadUrl?: string | null;
}

export interface CreatePackingListPayload {
  movingFileId: string;
  operatorName: string;
  deviceId: string;
  location?: StageLocationPayload | null;
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
    barcode: string | null;
    barcodeState?: 'MISSING' | 'ASSIGNED';
    items: { id: string; packingItemTypeId: string | null; customName: string | null; quantity: number; note: string | null }[];
    photos: { id: string; blobPath: string }[];
  }[];
}

export interface CreatePackagePayload {
  id: string;
  barcode: string | null;
}

export interface AssignBarcodePayload {
  barcode: string;
}

export interface UpdatePackageItemPayload {
  packingItemTypeId: string | null;
  customName: string | null;
  quantity: number;
  note: string | null;
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
  idempotencyKey?: string;
  deviceId: string;
  occurredAt?: string;
  reviewLanguage: 'ES' | 'EN';
  signatureUrl: string | null;
  signatureDeclined: boolean;
  signatureDeclineNote: string | null;
  crewLeaderSignatureUrl: string;
  crewLeaderName?: string | null;
  clientSignerName?: string | null;
  completionObservations?: string | null;
  satisfaction?: SatisfactionResponse;
  location?: StageLocationPayload | null;
}

export interface CreateProgressTransitionPayload {
  idempotencyKey: string;
  deviceId: string;
  toStatus: 'TRAVELING' | 'WORKING';
  occurredAt: string;
  observations?: string | null;
  signatureUrl?: string | null;
  location?: StageLocationPayload | null;
}

export interface CreateWorkdayEventPayload {
  idempotencyKey: string;
  deviceId: string;
  eventType: 'DAY_START' | 'DAY_CLOSE';
  occurredAt: string;
  isFinalDay?: boolean;
  observations?: string | null;
  signatures: WorkdaySignaturePair;
  location?: StageLocationPayload | null;
}

export interface WorkdayEventResult {
  packingListId: string;
  workdayIndex: number;
  event: WorkdayEvent;
}

export interface ProgressTransitionResult {
  packingListId: string;
  progressStatus: ProgressStatus;
  transition: ProgressTransition;
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
  originAddress?: string | null;
  originCity?: string | null;
  originCountry?: string | null;
  client?: { id?: string; name: string; phone?: string | null; address?: string | null } | null;
  corporateClient?: { id?: string; name?: string; companyName?: string; phone?: string | null; address?: string | null } | null;
  job?: {
    type?: string | null; clientPhone?: string | null; clientHomePhone?: string | null;
    companyPhone?: string | null; originAddress?: string | null; originCity?: string | null;
    originCountry?: string | null;
    serviceLatitude?: number | null; serviceLongitude?: number | null;
  } | null;
}

// ─── Ingress / Egress ───────────────────────────────────────────────────────

export type IngressEgressType = 'INGRESS_TRUCK' | 'INGRESS_WAREHOUSE' | 'EGRESS_WAREHOUSE';
export type IngressEgressStatus = 'IN_PROGRESS' | 'AWAITING_MANAGER_SIGNATURE' | 'COMPLETE';
export type IngressEgressScanMethod = 'CAMERA' | 'MANUAL';

export interface IngressEgressBox {
  packageId: string;
  boxNumber: number;
  checked: boolean;
  scanMethod: IngressEgressScanMethod | null;
  scannedAt: string | null;
}

export interface IngressEgressSignatureInfo {
  name: string | null;
  signatureUrl: string | null;
  signedAt: string | null;
}

export interface IngressEgressOperation {
  id: string;
  packingListId: string;
  type: IngressEgressType;
  status: IngressEgressStatus;
  warehouseLocation: string | null;
  observations: string | null;
  boxes: IngressEgressBox[];
  missingBoxNumbers: number[];
  signatures: { crewLeader: IngressEgressSignatureInfo | null; warehouseManager: IngressEgressSignatureInfo | null };
  location: StageLocationPayload | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StartIngressEgressPayload {
  type: IngressEgressType;
  deviceId: string;
  idempotencyKey: string;
  occurredAt: string;
}

export interface ScanIngressEgressBoxPayload {
  code: string;
  scanMethod: IngressEgressScanMethod;
  scannedAt: string;
  idempotencyKey: string;
}

export interface SignIngressEgressPayload {
  crewLeaderSignatureBlobPath: string;
  crewLeaderName: string;
  warehouseManagerSignatureBlobPath?: string;
  warehouseManagerName?: string;
  warehouseLocation?: string | null;
  observations?: string | null;
  location?: StageLocationPayload | null;
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

  createProgressTransition(id: string, payload: CreateProgressTransitionPayload): Promise<ProgressTransitionResult> {
    return apiClient.post(`/packing-lists/${id}/progress-transitions`, payload).then(r => r.data);
  },

  createWorkdayEvent(id: string, payload: CreateWorkdayEventPayload): Promise<WorkdayEventResult> {
    return apiClient.post(`/packing-lists/${id}/workday-events`, payload).then(r => r.data);
  },

  completePackingList(id: string, payload: CompletePackingListPayload): Promise<{ id: string; status: string; progressStatus: 'COMPLETED'; listNumber: string; transition: ProgressTransition; satisfactionResponse: SatisfactionResponse }> {
    return apiClient.patch(`/packing-lists/${id}/complete`, payload).then(r => r.data);
  },

  softDeletePackingList(id: string): Promise<{ id: string; deletedAt: string }> {
    return apiClient.patch(`/packing-lists/${id}/soft-delete`).then(r => r.data);
  },

  createPackage(id: string, payload: CreatePackagePayload): Promise<RemotePackage> {
    return apiClient.post(`/packing-lists/${id}/packages`, payload).then(r => r.data);
  },

  assignPackageBarcode(id: string, packageId: string, payload: AssignBarcodePayload): Promise<RemotePackage> {
    return apiClient.patch(`/packing-lists/${id}/packages/${packageId}/barcode`, payload).then(r => r.data);
  },

  updatePackageItem(id: string, packageId: string, itemId: string, payload: UpdatePackageItemPayload): Promise<RemoteItem> {
    return apiClient.put(`/packing-lists/${id}/packages/${packageId}/items/${itemId}`, payload).then(r => r.data);
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

  startIngressEgressOperation(id: string, payload: StartIngressEgressPayload): Promise<{ operation: IngressEgressOperation }> {
    return apiClient.post(`/packing-lists/${id}/ingress-egress`, payload).then(r => r.data);
  },

  getIngressEgressOperations(id: string): Promise<{ operations: IngressEgressOperation[] }> {
    return apiClient.get(`/packing-lists/${id}/ingress-egress`).then(r => r.data);
  },

  updateIngressEgressDetails(id: string, operationId: string, payload: { warehouseLocation?: string | null; observations?: string | null }): Promise<{ operation: IngressEgressOperation }> {
    return apiClient.patch(`/packing-lists/${id}/ingress-egress/${operationId}/details`, payload).then(r => r.data);
  },

  scanIngressEgressBox(id: string, operationId: string, payload: ScanIngressEgressBoxPayload): Promise<{ box: { packageId: string; scanMethod: IngressEgressScanMethod; scannedAt: string }; alreadyChecked: boolean }> {
    return apiClient.post(`/packing-lists/${id}/ingress-egress/${operationId}/scans`, payload).then(r => r.data);
  },

  resetIngressEgressOperation(id: string, operationId: string): Promise<{ operation: IngressEgressOperation }> {
    return apiClient.post(`/packing-lists/${id}/ingress-egress/${operationId}/reset`).then(r => r.data);
  },

  signIngressEgressOperation(id: string, operationId: string, payload: SignIngressEgressPayload): Promise<{ operation: IngressEgressOperation }> {
    return apiClient.post(`/packing-lists/${id}/ingress-egress/${operationId}/sign`, payload).then(r => r.data);
  },
};

// ─── Direct-to-Azure upload ────────────────────────────────────────────────────

export async function uploadSourceToAzure(sasUrl: string, source: string, fallbackContentType = 'application/octet-stream'): Promise<void> {
  let fileUri = source;
  let contentType = fallbackContentType;
  let temporaryFileUri: string | null = null;

  if (source.startsWith('data:')) {
    const match = source.match(/^data:([^;,]+)?;base64,(.*)$/);
    if (!match || !FileSystem.cacheDirectory) {
      throw new Error('No se pudo interpretar la firma almacenada en el dispositivo.');
    }
    contentType = match[1] || fallbackContentType;
    const extension = contentType === 'image/jpeg' ? 'jpg' : 'png';
    temporaryFileUri = `${FileSystem.cacheDirectory}signature-upload-${Date.now()}.${extension}`;
    await FileSystem.writeAsStringAsync(temporaryFileUri, match[2], {
      encoding: FileSystem.EncodingType.Base64,
    });
    fileUri = temporaryFileUri;
  }

  try {
    const uploadResult = await FileSystem.uploadAsync(sasUrl, fileUri, {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': contentType,
      },
    });
    if (uploadResult.status < 200 || uploadResult.status >= 300) {
      throw new Error(`Azure upload failed: ${uploadResult.status} ${uploadResult.body}`);
    }
  } finally {
    if (temporaryFileUri) {
      await FileSystem.deleteAsync(temporaryFileUri, { idempotent: true });
    }
  }
}

/**
 * Uploads a local file to Azure Blob Storage via a pre-signed SAS URL.
 * The backend issues the SAS URL; the device does the upload directly (no proxy).
 */
export async function uploadPhotoToAzure(sasUrl: string, localUri: string): Promise<void> {
  await uploadSourceToAzure(sasUrl, localUri, 'image/jpeg');
}
