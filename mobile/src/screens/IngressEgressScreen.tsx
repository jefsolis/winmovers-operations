import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView,
  Alert, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import * as Network from 'expo-network';

import { RootStackParamList } from '../navigation/types';
import { getDeviceId } from '../auth/deviceId';
import { api } from '../services/api';
import {
  getPackagesForList,
  getOpenIngressEgressOperation, upsertIngressEgressOperation,
  updateIngressEgressOperationFields,
  getBoxScansForOperation, upsertIngressEgressBoxScan,
  resetIngressEgressOperationLocal, getIngressEgressOperationsForList,
  PackageRow, IngressEgressOperationRow, IngressEgressBoxScanRow,
} from '../db/queries';

type Props = NativeStackScreenProps<RootStackParamList, 'IngressEgress'>;

const TITLES: Record<string, string> = {
  INGRESS_TRUCK: 'Ingreso a Camion',
  INGRESS_WAREHOUSE: 'Ingreso a Bodega',
  EGRESS_WAREHOUSE: 'Egreso de Bodega',
};

async function generateUUID(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

type PackageLocation = 'AT_CLIENT' | 'AT_TRUCK' | 'AT_WAREHOUSE';

function computeCurrentLocation(ops: IngressEgressOperationRow[]): { location: PackageLocation; since: string | null } {
  const completed = ops
    .filter(o => o.status === 'COMPLETE' && o.completed_at)
    .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''));
  const latest = completed[0];
  if (!latest) return { location: 'AT_CLIENT', since: null };
  return { location: latest.type === 'INGRESS_WAREHOUSE' ? 'AT_WAREHOUSE' : 'AT_TRUCK', since: latest.completed_at };
}

const LOCATION_LABELS: Record<PackageLocation, string> = {
  AT_CLIENT: 'con el cliente',
  AT_TRUCK: 'en camion',
  AT_WAREHOUSE: 'en bodega',
};

function formatLocationDate(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return ` desde el ${date.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}`;
}

// Returns true if the operator confirms proceeding despite the boxes' current known location.
function confirmLocationMismatch(
  operationType: 'INGRESS_TRUCK' | 'INGRESS_WAREHOUSE' | 'EGRESS_WAREHOUSE',
  current: { location: PackageLocation; since: string | null }
): Promise<boolean> {
  return new Promise(resolve => {
    const currentText = `Los bultos estan registrados actualmente ${LOCATION_LABELS[current.location]}${formatLocationDate(current.since)}.`;
    const message = operationType === 'EGRESS_WAREHOUSE'
      ? `${currentText}\n\nEsta operacion es un egreso de bodega, pero los bultos no estan registrados en bodega. Deseas continuar de todas formas?`
      : operationType === 'INGRESS_WAREHOUSE'
        ? `${currentText}\n\nLos bultos ya estan registrados en bodega. Deseas registrar un nuevo ingreso de todas formas?`
        : `${currentText}\n\nLos bultos ya estan registrados en camion. Deseas registrar un nuevo ingreso a camion de todas formas?`;
    Alert.alert('Confirmar ubicacion de los bultos', message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Continuar', onPress: () => resolve(true) },
    ]);
  });
}

export default function IngressEgressScreen({ route, navigation }: Props) {
  const { packingListLocalId, serverId, operationType } = route.params;

  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState<IngressEgressOperationRow | null>(null);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [scans, setScans] = useState<IngressEgressBoxScanRow[]>([]);
  const [scanning, setScanning] = useState(false);
  const [manualVisible, setManualVisible] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [warehouseLocation, setWarehouseLocation] = useState('');
  const [observations, setObservations] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: TITLES[operationType] || 'Ingreso / Egreso' });
  }, [navigation, operationType]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const deviceId = await getDeviceId();
      let op = await getOpenIngressEgressOperation(packingListLocalId, operationType);
      if (!op) {
        const existingOps = await getIngressEgressOperationsForList(packingListLocalId);

        const currentLocation = computeCurrentLocation(existingOps);
        const mismatch =
          (operationType === 'EGRESS_WAREHOUSE' && currentLocation.location !== 'AT_WAREHOUSE') ||
          (operationType === 'INGRESS_WAREHOUSE' && currentLocation.location === 'AT_WAREHOUSE') ||
          (operationType === 'INGRESS_TRUCK' && currentLocation.location === 'AT_TRUCK');
        if (mismatch) {
          const proceed = await confirmLocationMismatch(operationType, currentLocation);
          if (!proceed) {
            navigation.goBack();
            return;
          }
        }

        const now = new Date().toISOString();
        const newId = await generateUUID();
        // Egress carries over the storage location recorded when the boxes were ingressed into the warehouse.
        let carriedWarehouseLocation: string | null = null;
        if (operationType === 'EGRESS_WAREHOUSE') {
          const priorIngress = existingOps
            .filter(o => o.type === 'INGRESS_WAREHOUSE' && o.status === 'COMPLETE')
            .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))[0];
          carriedWarehouseLocation = priorIngress?.warehouse_location || null;
        }
        op = {
          id: newId, server_id: null, packing_list_id: packingListLocalId, type: operationType,
          status: 'IN_PROGRESS', device_id: deviceId, idempotency_key: newId,
          warehouse_location: carriedWarehouseLocation, observations: null,
          crew_leader_name: null, crew_leader_signature_local_path: null, crew_leader_signature_blob_path: null, crew_leader_signed_at: null,
          warehouse_manager_name: null, warehouse_manager_signature_local_path: null, warehouse_manager_signature_blob_path: null, warehouse_manager_signed_at: null,
          latitude: null, longitude: null, location_accuracy: null, location_captured_at: null, location_unavailable_reason: null,
          completed_at: null, sync_state: 'PENDING', sync_error: null, created_at: now, updated_at: now,
        };
        await upsertIngressEgressOperation(op);

        const net = await Network.getNetworkStateAsync();
        if (net.isConnected) {
          try {
            const started = await api.startIngressEgressOperation(serverId, {
              type: operationType, deviceId, idempotencyKey: newId, occurredAt: now,
            });
            op.server_id = started.operation.id;
            op.status = started.operation.status;
            op.warehouse_location = started.operation.warehouseLocation ?? op.warehouse_location;
            await updateIngressEgressOperationFields(newId, {
              server_id: started.operation.id,
              status: started.operation.status,
              warehouse_location: op.warehouse_location,
            });
          } catch {
            // stays PENDING; cacheService will retry
          }
        }
      }
      const [pkgs, boxScans] = await Promise.all([
        getPackagesForList(packingListLocalId),
        getBoxScansForOperation(op.id),
      ]);
      setOperation(op);
      setPackages(pkgs);
      setScans(boxScans);
      setWarehouseLocation(op.warehouse_location || '');
      setObservations(op.observations || '');
    } finally {
      setLoading(false);
    }
  }, [packingListLocalId, operationType, serverId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission, requestPermission]);

  const checkedPackageIds = new Set(scans.map(s => s.package_id));
  const boxes = packages.map((pkg, idx) => ({
    pkg, boxNumber: idx + 1, checked: checkedPackageIds.has(pkg.id),
    scan: scans.find(s => s.package_id === pkg.id) || null,
  }));
  const missingBoxes = boxes.filter(b => !b.checked);

  const applyScan = async (code: string, scanMethod: 'CAMERA' | 'MANUAL') => {
    if (!operation) return;
    const trimmed = code.trim();
    if (!trimmed) return;

    const localMatch = packages.find(p => p.barcode === trimmed);
    if (localMatch && checkedPackageIds.has(localMatch.id)) {
      const existingBox = boxes.find(b => b.pkg.id === localMatch.id);
      Alert.alert('Ya escaneado', `La caja ${existingBox?.boxNumber ?? ''} ya fue confirmada.`);
      return;
    }

    const net = await Network.getNetworkStateAsync();
    if (net.isConnected && operation.server_id) {
      try {
        const scannedAt = new Date().toISOString();
        const idempotencyKey = await generateUUID();
        const result = await api.scanIngressEgressBox(serverId, operation.server_id, {
          code: trimmed, scanMethod, scannedAt, idempotencyKey,
        });
        const pkg = packages.find(p => p.id === result.box.packageId) || localMatch;
        if (pkg) {
          await upsertIngressEgressBoxScan({
            id: idempotencyKey, server_id: result.box.packageId, operation_id: operation.id,
            package_id: pkg.id, scan_method: scanMethod, scanned_at: scannedAt,
            idempotency_key: idempotencyKey, sync_state: 'CONFIRMED', sync_error: null, created_at: scannedAt,
          });
        }
        await load();
        return;
      } catch (err: unknown) {
        const responseError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        if (responseError === 'DIFFERENT_LIST') {
          Alert.alert('Caja de otra lista', 'Esta caja pertenece a otra lista de empaque y no puede procesarse aqui.');
          return;
        }
        if (responseError === 'NOT_FOUND') {
          Alert.alert('Codigo no reconocido', 'Este codigo no corresponde a ninguna caja de esta lista.');
          return;
        }
        // Network/server hiccup: fall through to offline handling below.
      }
    }

    // Offline (or request failed): only trust locally known boxes for this list.
    if (!localMatch) {
      Alert.alert(
        'Sin conexion',
        'No se pudo verificar el codigo sin conexion. Si la caja no pertenece a esta lista, se detectara al sincronizar.'
      );
      return;
    }
    const scannedAt = new Date().toISOString();
    const idempotencyKey = await generateUUID();
    await upsertIngressEgressBoxScan({
      id: idempotencyKey, server_id: null, operation_id: operation.id,
      package_id: localMatch.id, scan_method: scanMethod, scanned_at: scannedAt,
      idempotency_key: idempotencyKey, sync_state: 'PENDING', sync_error: null, created_at: scannedAt,
    });
    await load();
  };

  const handleBarCodeScanned = ({ data }: BarcodeScanningResult) => {
    if (scanning) return;
    setScanning(true);
    void applyScan(data, 'CAMERA').finally(() => setScanning(false));
  };

  const submitManualCode = async () => {
    await applyScan(manualCode, 'MANUAL');
    setManualCode('');
    setManualVisible(false);
  };

  const saveDetails = async () => {
    if (!operation) return;
    setSavingDetails(true);
    try {
      // Egress location is read-only (carried over from the warehouse ingress); only ingress edits it.
      const nextWarehouseLocation = operationType === 'INGRESS_WAREHOUSE'
        ? (warehouseLocation.trim() || null)
        : operation.warehouse_location;
      const nextObservations = observations.trim() || null;
      await updateIngressEgressOperationFields(operation.id, {
        warehouse_location: nextWarehouseLocation,
        observations: nextObservations,
        sync_state: 'PENDING',
      });
      const net = await Network.getNetworkStateAsync();
      if (net.isConnected && operation.server_id) {
        try {
          await api.updateIngressEgressDetails(serverId, operation.server_id, {
            warehouseLocation: nextWarehouseLocation,
            observations: nextObservations,
          });
        } catch {
          // left PENDING; cacheService retries
        }
      }
    } finally {
      setSavingDetails(false);
    }
  };

  const handleReset = () => {
    if (!operation) return;
    Alert.alert(
      'Reiniciar escaneo',
      'Se borraran todas las cajas confirmadas y los datos capturados en este intento. Desea continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reiniciar', style: 'destructive',
          onPress: async () => {
            await resetIngressEgressOperationLocal(operation.id);
            const net = await Network.getNetworkStateAsync();
            let carriedWarehouseLocation: string | null = null;
            if (operationType === 'EGRESS_WAREHOUSE') {
              const priorIngress = (await getIngressEgressOperationsForList(packingListLocalId))
                .filter(o => o.type === 'INGRESS_WAREHOUSE' && o.status === 'COMPLETE')
                .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))[0];
              carriedWarehouseLocation = priorIngress?.warehouse_location || null;
              await updateIngressEgressOperationFields(operation.id, { warehouse_location: carriedWarehouseLocation });
            }
            if (net.isConnected && operation.server_id) {
              try { await api.resetIngressEgressOperation(serverId, operation.server_id); } catch { /* retried later */ }
            }
            setWarehouseLocation(carriedWarehouseLocation || '');
            setObservations('');
            await load();
          },
        },
      ]
    );
  };

  const handleComplete = async () => {
    if (!operation) return;
    if (missingBoxes.length > 0) {
      const message = operationType === 'INGRESS_TRUCK'
        ? `Faltan por escanear las cajas: ${missingBoxes.map(b => b.boxNumber).join(', ')}. El camion NO debe salir hasta escanear todas las cajas.`
        : `Faltan por escanear las cajas: ${missingBoxes.map(b => b.boxNumber).join(', ')}.`;
      Alert.alert('Cajas pendientes', message);
      return;
    }
    await saveDetails();
    navigation.navigate('IngressEgressSignature', {
      packingListLocalId, serverId, operationLocalId: operation.id,
    });
  };

  if (loading || !operation) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1a73e8" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.cameraWrap}>
        {permission?.granted ? (
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'upc_a', 'datamatrix'] }}
            onBarcodeScanned={scanning ? undefined : handleBarCodeScanned}
          />
        ) : (
          <View style={styles.center}><Text>Se necesita acceso a la camara.</Text></View>
        )}
      </View>

      <TouchableOpacity style={styles.manualBtn} onPress={() => setManualVisible(true)} accessibilityRole="button">
        <Ionicons name="keypad-outline" size={18} color="#fff" />
        <Text style={styles.manualBtnText}>Ingresar codigo manualmente</Text>
      </TouchableOpacity>

      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          {boxes.length - missingBoxes.length} de {boxes.length} cajas confirmadas
        </Text>
        <TouchableOpacity onPress={handleReset} accessibilityRole="button">
          <Text style={styles.resetText}>Reiniciar</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={boxes}
        keyExtractor={item => item.pkg.id}
        style={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.boxRow, item.checked && styles.boxRowChecked]}>
            <Ionicons
              name={item.checked ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={item.checked ? '#1e8e3e' : '#999'}
            />
            <Text style={[styles.boxLabel, item.checked && styles.boxLabelChecked]}>Caja {item.boxNumber}</Text>
            <Text style={styles.boxMethod}>
              {item.checked ? (item.scan?.scan_method === 'MANUAL' ? 'Manual' : 'Camara') : 'Pendiente'}
            </Text>
          </View>
        )}
      />

      {operationType === 'INGRESS_WAREHOUSE' && (
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Ubicacion en bodega (opcional)</Text>
          <TextInput
            style={styles.input}
            value={warehouseLocation}
            onChangeText={setWarehouseLocation}
            onBlur={() => void saveDetails()}
            placeholder="Ej: Pasillo 3, Rack B"
          />
        </View>
      )}
      {operationType === 'EGRESS_WAREHOUSE' && (
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Ubicacion en bodega</Text>
          <Text style={styles.readOnlyValue}>
            {warehouseLocation || 'No se registro una ubicacion en el ingreso a bodega.'}
          </Text>
        </View>
      )}
      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>Observaciones (opcional)</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={observations}
          onChangeText={setObservations}
          onBlur={() => void saveDetails()}
          placeholder="Observaciones sobre esta operacion"
          multiline
        />
      </View>

      <TouchableOpacity
        style={[styles.completeBtn, missingBoxes.length > 0 && styles.completeBtnDisabled]}
        onPress={() => void handleComplete()}
        accessibilityRole="button"
      >
        <Text style={styles.completeBtnText}>
          {savingDetails ? 'Guardando...' : 'Completar'}
        </Text>
      </TouchableOpacity>

      <Modal visible={manualVisible} transparent animationType="fade" onRequestClose={() => setManualVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ingresar codigo de caja</Text>
            <TextInput
              style={styles.input}
              value={manualCode}
              onChangeText={setManualCode}
              placeholder="Codigo de la caja"
              autoCapitalize="characters"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setManualVisible(false)} accessibilityRole="button">
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={() => void submitManualCode()} accessibilityRole="button">
                <Text style={styles.modalConfirmText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cameraWrap: { height: 220, backgroundColor: '#000' },
  camera: { flex: 1 },
  manualBtn: {
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#374151', paddingVertical: 10, marginHorizontal: 16, marginTop: 10, borderRadius: 8,
  },
  manualBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  progressRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
  },
  progressText: { fontSize: 13, fontWeight: '700', color: '#333' },
  resetText: { color: '#c5221f', fontWeight: '700', fontSize: 13 },
  list: { flex: 1, paddingHorizontal: 16 },
  boxRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  boxRowChecked: { opacity: 1 },
  boxLabel: { flex: 1, fontSize: 14, color: '#333' },
  boxLabelChecked: { fontWeight: '700', color: '#1e8e3e' },
  boxMethod: { fontSize: 12, color: '#888' },
  fieldBlock: { paddingHorizontal: 16, paddingTop: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 4 },
  readOnlyValue: { fontSize: 14, color: '#333', backgroundColor: '#f1f3f4', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  inputMultiline: { minHeight: 60, textAlignVertical: 'top' },
  completeBtn: { backgroundColor: '#1a73e8', margin: 16, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  completeBtnDisabled: { backgroundColor: '#93c5fd' },
  completeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  modalCancel: { paddingVertical: 8, paddingHorizontal: 14 },
  modalCancelText: { color: '#666', fontWeight: '600' },
  modalConfirm: { backgroundColor: '#1a73e8', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  modalConfirmText: { color: '#fff', fontWeight: '700' },
});
