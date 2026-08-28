import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, SafeAreaView,
} from 'react-native';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Crypto from 'expo-crypto';

import { RootStackParamList } from '../navigation/types';
import {
  upsertPackage, getPackagesForList, updatePackingListSyncState,
  updatePackageBarcodeState, getPackingList,
} from '../db/queries';
import { api } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Scan'>;

export default function ScanScreen({ route, navigation }: Props) {
  const { packingListLocalId, assignToPackageId } = route.params;
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [creating, setCreating] = useState(false);

  const createWithoutBarcode = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const now = new Date().toISOString();
      const newId = await generateUUID();
      await upsertPackage({
        id: newId,
        server_id: null,
        packing_list_id: packingListLocalId,
        barcode: null,
        barcode_state: 'MISSING',
        barcode_assigned_at: null,
        created_at: now,
      });
      await updatePackingListSyncState(packingListLocalId, 'LOCAL', { syncError: null });
      navigation.replace('PackageDetail', { packageId: newId, packingListLocalId });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      Alert.alert('No se pudo crear el bulto', message);
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission, requestPermission]);

  const handleBarCodeScanned = async ({ data }: BarcodeScanningResult) => {
    if (scanned) return;
    setScanned(true);

    // Check for duplicate barcode in this list
    const existing = await getPackagesForList(packingListLocalId);
    const isDuplicate = existing.some(pkg => pkg.barcode === data && pkg.id !== assignToPackageId);

    if (isDuplicate) {
      Alert.alert(
        'Código duplicado',
        `El bulto "${data}" ya fue registrado en esta lista.`,
        [{ text: 'OK', onPress: () => setScanned(false) }]
      );
      return;
    }

    const now = new Date().toISOString();

    if (assignToPackageId) {
      await updatePackageBarcodeState(assignToPackageId, data, 'ASSIGNED');
      await updatePackingListSyncState(packingListLocalId, 'LOCAL', { syncError: null });
      const list = await getPackingList(packingListLocalId);
      if (list?.server_id) {
        try {
          await api.assignPackageBarcode(list.server_id, assignToPackageId, { barcode: data });
        } catch {
          // Keep local assignment and let sync resolve it later.
        }
      }
      navigation.goBack();
      return;
    }

    const newId = await generateUUID();
    await upsertPackage({
      id: newId,
      server_id: null,
      packing_list_id: packingListLocalId,
      barcode: data,
      barcode_state: 'ASSIGNED',
      barcode_assigned_at: now,
      created_at: now,
    });
    await updatePackingListSyncState(packingListLocalId, 'LOCAL', { syncError: null });

    navigation.replace('PackageDetail', { packageId: newId, packingListLocalId });
  };

  if (!permission) {
    return <View style={styles.center}><Text>Solicitando permiso de cámara…</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>Se necesita acceso a la cámara para escanear.</Text>
        <TouchableOpacity style={styles.permButton} onPress={requestPermission} accessibilityRole="button">
          <Text style={styles.permButtonText}>Conceder Permiso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'upc_a', 'datamatrix'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.scanFrame} />
        <Text style={styles.hint}>Apunta la cámara hacia el código de barras</Text>
      </View>
      {scanned && (
        <TouchableOpacity style={styles.rescanBtn} onPress={() => setScanned(false)} accessibilityRole="button">
          <Text style={styles.rescanText}>Escanear otro</Text>
        </TouchableOpacity>
      )}
      {!assignToPackageId && (
        <TouchableOpacity
          style={[styles.skipBtn, creating && styles.skipBtnDisabled]}
          onPress={() => void createWithoutBarcode()}
          disabled={creating}
          accessibilityRole="button"
        >
          <Text style={styles.skipText}>{creating ? 'Creando bulto…' : 'Crear bulto sin codigo'}</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

async function generateUUID(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  camera: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  scanFrame: { width: 240, height: 160, borderWidth: 2, borderColor: '#fff', borderRadius: 8, backgroundColor: 'transparent' },
  hint: { color: '#fff', marginTop: 16, fontSize: 13, textAlign: 'center' },
  rescanBtn: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: '#1a73e8', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  rescanText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  skipBtn: { position: 'absolute', bottom: 96, alignSelf: 'center', backgroundColor: '#374151', paddingHorizontal: 22, paddingVertical: 10, borderRadius: 22 },
  skipBtnDisabled: { opacity: 0.6 },
  skipText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  permissionText: { textAlign: 'center', marginBottom: 16, fontSize: 15, color: '#333' },
  permButton: { backgroundColor: '#1a73e8', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 12 },
  permButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
