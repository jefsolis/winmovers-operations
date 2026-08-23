import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';

const DEVICE_ID_KEY = 'winmovers_device_id';

let cachedDeviceId: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  let stored = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!stored) {
    // Generate a stable UUID for this device
    const random = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${Platform.OS}-${Date.now()}-${Math.random()}`
    );
    stored = `${random.substring(0, 8)}-${random.substring(8, 12)}-${random.substring(12, 16)}-${random.substring(16, 20)}-${random.substring(20, 32)}`;
    await SecureStore.setItemAsync(DEVICE_ID_KEY, stored);
  }

  cachedDeviceId = stored;
  return stored;
}
