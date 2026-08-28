import * as Location from 'expo-location';

export type LocationUnavailableReason =
  | 'PERMISSION_DENIED'
  | 'SERVICES_DISABLED'
  | 'TIMEOUT'
  | 'UNSUPPORTED'
  | 'ERROR';

export interface StageLocation {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  capturedAt: string | null;
  unavailableReason: LocationUnavailableReason | null;
}

const CAPTURE_TIMEOUT_MS = 5000;

function unavailable(reason: LocationUnavailableReason): StageLocation {
  return { latitude: null, longitude: null, accuracy: null, capturedAt: null, unavailableReason: reason };
}

/**
 * Never rejects: a lifecycle stage must never be blocked or failed by location capture.
 */
export async function captureStageLocation(): Promise<StageLocation> {
  try {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) return unavailable('SERVICES_DISABLED');

    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return unavailable('PERMISSION_DENIED');

    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), CAPTURE_TIMEOUT_MS));
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      timeout,
    ]);
    if (!position) return unavailable('TIMEOUT');

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy ?? null,
      capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
      unavailableReason: null,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (/unavailable|unsupported|not available/i.test(message)) return unavailable('UNSUPPORTED');
    return unavailable('ERROR');
  }
}

export function stageLocationFromRow(row: {
  latitude?: number | null;
  longitude?: number | null;
  location_accuracy?: number | null;
  location_captured_at?: string | null;
  location_unavailable_reason?: string | null;
}): StageLocation | null {
  const hasCoordinates = row.latitude != null && row.longitude != null;
  if (!hasCoordinates && !row.location_unavailable_reason) return null;
  return {
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    accuracy: row.location_accuracy ?? null,
    capturedAt: row.location_captured_at ?? null,
    unavailableReason: (row.location_unavailable_reason as LocationUnavailableReason) ?? null,
  };
}
