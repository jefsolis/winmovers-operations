import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert, ActivityIndicator, Modal, TextInput,
} from 'react-native';
import SignatureCanvas from 'react-native-signature-canvas';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import { RootStackParamList } from '../navigation/types';
import { getDeviceId } from '../auth/deviceId';
import { retryPendingIngressEgress } from '../services/cacheService';
import {
  getIngressEgressOperation, updateIngressEgressOperationFields, getPackingList,
  IngressEgressOperationRow,
} from '../db/queries';
import { captureStageLocation } from '../services/location';

type Props = NativeStackScreenProps<RootStackParamList, 'IngressEgressSignature'>;

const TITLES: Record<string, string> = {
  INGRESS_TRUCK: 'Firma - Ingreso a Camion',
  INGRESS_WAREHOUSE: 'Firma - Ingreso a Bodega',
  EGRESS_WAREHOUSE: 'Firma - Egreso de Bodega',
};

type ActiveSigner = 'CREW' | 'MANAGER' | null;

export default function IngressEgressSignatureScreen({ route, navigation }: Props) {
  const { packingListLocalId, operationLocalId } = route.params;
  const signatureRef = useRef<React.ElementRef<typeof SignatureCanvas>>(null);

  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState<IngressEgressOperationRow | null>(null);
  const [operatorName, setOperatorName] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [activeSigner, setActiveSigner] = useState<ActiveSigner>(null);
  const [hasStroke, setHasStroke] = useState(false);
  const [crewSignature, setCrewSignature] = useState<string | null>(null);
  const [managerSignature, setManagerSignature] = useState<string | null>(null);
  const [managerName, setManagerName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [op, list] = await Promise.all([
        getIngressEgressOperation(operationLocalId),
        getPackingList(packingListLocalId),
      ]);
      setOperation(op);
      setOperatorName(list?.operator_name || '');
      setCrewSignature(op?.crew_leader_signature_local_path || null);
      setManagerSignature(op?.warehouse_manager_signature_local_path || null);
      setManagerName(op?.warehouse_manager_name || '');
      if (op) navigation.setOptions({ title: TITLES[op.type] || 'Firma' });
    } finally {
      setLoading(false);
    }
  }, [operationLocalId, packingListLocalId, navigation]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading || !operation) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1a73e8" /></View>;
  }

  const isWarehouseType = operation.type === 'INGRESS_WAREHOUSE' || operation.type === 'EGRESS_WAREHOUSE';
  // Only hide the signing UI once the server has actually confirmed completion — a locally
  // "complete" operation that failed to sync (e.g. a missing required field) must stay editable
  // so the operator can fix it and retry, instead of getting stuck with no visible action.
  const isSynced = operation.status === 'COMPLETE' && operation.sync_state === 'CONFIRMED';
  const isComplete = isSynced;
  const needsRetry = operation.status === 'COMPLETE' && operation.sync_state !== 'CONFIRMED';
  const canComplete = !!crewSignature && (!isWarehouseType || (!!managerSignature && !!managerName.trim()));

  const openSignaturePanel = (signer: 'CREW' | 'MANAGER') => {
    setActiveSigner(signer);
    setHasStroke(false);
    setShowModal(true);
  };

  const onSignatureRead = (signature: string) => {
    if (activeSigner === 'CREW') setCrewSignature(signature);
    else if (activeSigner === 'MANAGER') setManagerSignature(signature);
    setShowModal(false);
  };

  const handleComplete = async () => {
    if (!crewSignature) {
      Alert.alert('Firma requerida', 'Falta la firma del jefe de cuadrilla.');
      return;
    }
    if (isWarehouseType && !managerSignature) {
      Alert.alert('Firma requerida', 'Falta la firma del encargado de bodega.');
      return;
    }
    if (isWarehouseType && !managerName.trim()) {
      Alert.alert('Nombre requerido', 'Ingresa el nombre del encargado de bodega.');
      return;
    }

    setSubmitting(true);
    try {
      const location = await captureStageLocation();

      // Mark complete locally first (single source of truth), then delegate all server
      // syncing (starting the operation if needed, scans, signature upload, sign call) to
      // the shared retry routine — the same one background sync relies on — so completion
      // is attempted immediately instead of depending on the operator revisiting this list.
      await updateIngressEgressOperationFields(operation.id, {
        crew_leader_name: operatorName || null,
        crew_leader_signature_local_path: crewSignature,
        warehouse_manager_name: isWarehouseType ? managerName.trim() : null,
        warehouse_manager_signature_local_path: managerSignature,
        status: 'COMPLETE',
        completed_at: new Date().toISOString(),
        latitude: location.latitude,
        longitude: location.longitude,
        location_accuracy: location.accuracy,
        location_captured_at: location.capturedAt,
        location_unavailable_reason: location.unavailableReason,
        sync_state: 'PENDING',
      });

      const deviceId = await getDeviceId();
      await retryPendingIngressEgress(deviceId, packingListLocalId);

      const refreshed = await getIngressEgressOperation(operation.id);
      if (refreshed?.sync_state === 'CONFIRMED') {
        Alert.alert('Operacion completada', 'La operacion se registro correctamente.');
      } else if (refreshed?.sync_error) {
        Alert.alert(
          'No se pudo sincronizar',
          `La operacion se guardo en el dispositivo pero no se pudo confirmar con el servidor: ${refreshed.sync_error}. Se reintentara automaticamente.`
        );
      } else {
        Alert.alert(
          'Guardado sin conexion',
          'La operacion se guardo en el dispositivo y se sincronizara automaticamente cuando haya conexion.'
        );
      }
      navigation.popToTop();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Firmas requeridas</Text>
        <Text style={styles.hint}>
          {isComplete
            ? 'Esta operacion ya fue completada.'
            : needsRetry
              ? 'La operacion no se pudo sincronizar todavia. Revisa los datos y vuelve a completar.'
              : 'Ambas firmas se capturan aqui y se envian juntas al completar.'}
        </Text>
        {needsRetry && operation.sync_error ? (
          <Text style={styles.retryErrorText}>{operation.sync_error}</Text>
        ) : null}

        <View style={styles.signatureRow}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>Jefe de cuadrilla</Text>
            <Text style={crewSignature ? styles.signedLine : styles.pendingLine}>
              {crewSignature ? 'Firmado' : 'Pendiente'}
            </Text>
            {!isComplete && (
              <TouchableOpacity style={styles.signBtn} onPress={() => openSignaturePanel('CREW')} accessibilityRole="button">
                <Text style={styles.signBtnText}>{crewSignature ? 'Volver a firmar' : 'Abrir panel de firma'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {isWarehouseType && (
            <View style={styles.signatureBlock}>
              <Text style={styles.signatureLabel}>Encargado de bodega</Text>
              {!isComplete ? (
                <TextInput
                  style={styles.nameInput}
                  value={managerName}
                  onChangeText={setManagerName}
                  placeholder="Nombre del encargado de bodega"
                />
              ) : (
                <Text style={styles.signatureLabel}>{operation.warehouse_manager_name}</Text>
              )}
              <Text style={managerSignature ? styles.signedLine : styles.pendingLine}>
                {managerSignature ? 'Firmado' : 'Pendiente'}
              </Text>
              {!isComplete && (
                <TouchableOpacity style={styles.signBtn} onPress={() => openSignaturePanel('MANAGER')} accessibilityRole="button">
                  <Text style={styles.signBtnText}>{managerSignature ? 'Volver a firmar' : 'Abrir panel de firma'}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {!isComplete && (
          <TouchableOpacity
            style={[styles.completeBtn, (!canComplete || submitting) && styles.completeBtnDisabled]}
            onPress={() => void handleComplete()}
            disabled={!canComplete || submitting}
            accessibilityRole="button"
          >
            <Text style={styles.completeBtnText}>
              {submitting ? 'Guardando...' : needsRetry ? 'Reintentar sincronizacion' : 'Completar operacion'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={showModal} animationType="slide" onRequestClose={() => setShowModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <SignatureCanvas
            ref={signatureRef}
            onOK={onSignatureRead}
            onBegin={() => setHasStroke(true)}
            descriptionText=""
            webStyle=".m-signature-pad--footer {display: none;}"
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowModal(false)} accessibilityRole="button">
              <Text style={styles.modalCancelText}>Cerrar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalClear} onPress={() => { signatureRef.current?.clearSignature(); setHasStroke(false); }} accessibilityRole="button">
              <Text style={styles.modalCancelText}>Limpiar firma</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalConfirm, !hasStroke && styles.modalConfirmDisabled]}
              onPress={() => signatureRef.current?.readSignature()}
              disabled={!hasStroke}
              accessibilityRole="button"
            >
              <Text style={styles.modalConfirmText}>Usar esta firma</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20 },
  title: { fontSize: 17, fontWeight: '700', color: '#333', marginBottom: 6 },
  hint: { fontSize: 13, color: '#666', marginBottom: 16 },
  retryErrorText: { fontSize: 12, color: '#c5221f', marginBottom: 12 },
  signatureRow: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  signatureBlock: { flexGrow: 1, minWidth: 150, backgroundColor: '#f7f8fa', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#e5e7eb' },
  signatureLabel: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 6 },
  nameInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, marginBottom: 8, backgroundColor: '#fff' },
  signedLine: { color: '#1e8e3e', fontWeight: '700', fontSize: 13, marginBottom: 8 },
  pendingLine: { color: '#8a6d1f', fontWeight: '700', fontSize: 13, marginBottom: 8 },
  signBtn: { backgroundColor: '#1a73e8', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  signBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  completeBtn: { backgroundColor: '#1a73e8', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 20 },
  completeBtnDisabled: { opacity: 0.5 },
  completeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  modalContainer: { flex: 1 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-around', padding: 16 },
  modalCancel: { paddingVertical: 10, paddingHorizontal: 14 },
  modalClear: { paddingVertical: 10, paddingHorizontal: 14 },
  modalCancelText: { color: '#666', fontWeight: '600' },
  modalConfirm: { backgroundColor: '#1a73e8', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8 },
  modalConfirmDisabled: { opacity: 0.5 },
  modalConfirmText: { color: '#fff', fontWeight: '700' },
});
