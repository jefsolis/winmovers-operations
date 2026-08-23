import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Alert, Image, Modal,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as Crypto from 'expo-crypto';
import * as Network from 'expo-network';

import { RootStackParamList } from '../navigation/types';
import { useAuth } from '../auth/useAuth';
import { getDeviceId } from '../auth/deviceId';
import { api } from '../services/api';
import {
  upsertPackingList, getPackingList, getPackagesForList,
  PackingListRow, PackageRow,
} from '../db/queries';
import { useLiveSync } from '../hooks/useLiveSync';
import SyncStatusBar from '../components/SyncStatusBar';
import LockBanner from '../components/LockBanner';

type Props = NativeStackScreenProps<RootStackParamList, 'PackingList'>;

export default function PackingListScreen({ route, navigation }: Props) {
    const isClosedLike = (pl: PackingListRow | null) => {
      if (!pl) return false;
      return (
        pl.status === 'CLOSED' ||
        pl.status === 'COMPLETE' ||
        pl.status === 'COMPLETE_PENDING_SYNC' ||
        pl.sync_state === 'CLOSED' ||
        pl.sync_state === 'COMPLETE_PENDING_SYNC'
      );
    };

  const { localId: initialLocalId, movingFileId, movingFileRef } = route.params;
  const { userName } = useAuth();

  const [localId, setLocalId] = useState<string>(initialLocalId);
  const [packingList, setPackingList] = useState<PackingListRow | null>(null);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [deviceId, setDeviceId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [lockHolder, setLockHolder] = useState<string | null>(null);
  const [signaturePreviewUri, setSignaturePreviewUri] = useState<string | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const creatingServerRef = useRef(false);

  const { triggerSync } = useLiveSync(
    localId || null,
    deviceId
  );

  const createServerListIfNeeded = useCallback(async (pl: PackingListRow, devId: string) => {
    if (pl.server_id || creatingServerRef.current) return pl;
    const net = await Network.getNetworkStateAsync();
    if (!net.isConnected) return pl;

    creatingServerRef.current = true;
    try {
      const result = await api.createPackingList({
        movingFileId,
        operatorName: pl.operator_name,
        deviceId: devId,
      });
      const updated = {
        ...pl,
        server_id: result.id,
        list_number: result.listNumber,
        lock_expires_at: result.lockExpiresAt,
        sync_state: 'SAVED' as const,
        updated_at: new Date().toISOString(),
      };
      await upsertPackingList(updated);
      setPackingList(updated);
      return updated;
    } catch {
      return pl;
    } finally {
      creatingServerRef.current = false;
    }
  }, [movingFileId]);

  // Initialize: create or load packing list
  useEffect(() => {
    (async () => {
      const devId = await getDeviceId();
      setDeviceId(devId);

      if (initialLocalId) {
        // Resume existing
        const pl = await getPackingList(initialLocalId);
        setPackingList(pl);
        if (pl) {
          const pkgs = await getPackagesForList(pl.id);
          setPackages(pkgs);
          // Check lock
          if (pl.locked_by_device_id && pl.locked_by_device_id !== devId) {
            const expiry = pl.lock_expires_at ? new Date(pl.lock_expires_at).getTime() : 0;
            if (expiry > Date.now()) {
              setIsLocked(true);
              setLockHolder(pl.locked_by_device_id);
            }
          }
        }
      } else {
        // Create new packing list locally, then sync to server
        const newId = await generateUUID();
        const now = new Date().toISOString();
        const ref = movingFileRef;

        const newRow: PackingListRow = {
          id: newId,
          server_id: null,
          list_number: null,
          moving_file_id: movingFileId,
          moving_file_ref: ref,
          operator_name: userName ?? 'Operador',
          status: 'ACTIVE',
          signature_local_path: null,
          signature_blob_path: null,
          signature_declined: 0,
          signature_decline_note: null,
          review_language: null,
          completion_requested_at: null,
          completion_confirmed_at: null,
          deleted_at: null,
          locked_by_device_id: devId,
          lock_expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          sync_state: 'LOCAL',
          sync_error: null,
          last_synced_at: null,
          created_at: now,
          updated_at: now,
        };
        await upsertPackingList(newRow);
        setLocalId(newId);
        setPackingList(newRow);
        await createServerListIfNeeded(newRow, devId);
      }
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh packages when screen gains focus; retry server creation if still unsynced
  useFocusEffect(
    useCallback(() => {
      if (!localId) return;
      (async () => {
        const [pkgs, loadedPl] = await Promise.all([
          getPackagesForList(localId),
          getPackingList(localId),
        ]);
        setPackages(pkgs);
        setPackingList(loadedPl);
        let pl = loadedPl;

        // If still no server_id, try creating on server now
        if (pl && !pl.server_id) {
          const devId = deviceId || await getDeviceId();
          pl = await createServerListIfNeeded(pl, devId);
        }

        if (pl && isClosedLike(pl)) {
          const localSignatureUri = pl.signature_local_path || (pl.signature_declined !== 1 ? pl.signature_blob_path : null);
          setSignaturePreviewUri(localSignatureUri);
          if (pl.server_id) {
            try {
              const detail = await api.getPackingList(pl.server_id);
              setSignaturePreviewUri(detail.signatureUrl || localSignatureUri);
            } catch {
              setSignaturePreviewUri(localSignatureUri);
            }
          }
        } else {
          setSignaturePreviewUri(null);
        }

        if (pl?.server_id && !isClosedLike(pl)) {
          triggerSync();
        }
      })();
    }, [localId, deviceId, createServerListIfNeeded, triggerSync])
  );

  const handleClaimLock = async () => {
    if (!packingList?.server_id) return;
    try {
      const result = await api.claimLock(packingList.server_id, deviceId);
      await upsertPackingList({
        ...packingList!,
        locked_by_device_id: deviceId,
        lock_expires_at: result.lockExpiresAt,
        updated_at: new Date().toISOString(),
      });
      setIsLocked(false);
      setLockHolder(null);
      setPackingList(pl => pl ? { ...pl, locked_by_device_id: deviceId, lock_expires_at: result.lockExpiresAt } : pl);
    } catch {
      Alert.alert('No se puede tomar el control', 'El bloqueo aún está activo en otro dispositivo.');
    }
  };

  const handleComplete = () => {
    if (isClosedLike(packingList)) {
      Alert.alert('Lista bloqueada', 'La lista ya se encuentra cerrada o pendiente de cierre final.');
      return;
    }
    if (!packingList?.server_id) {
      Alert.alert('Sin conexión', 'La lista aun no tiene ID de servidor. Guarda cambios y vuelve a intentar al recuperar conexión.');
      return;
    }
    navigation.navigate('Signature', { packingListLocalId: localId, serverId: packingList.server_id });
  };

  const handleAddBox = () => {
    if (isReadOnly) return;
    navigation.navigate('Scan', { packingListLocalId: localId });
  };

  const isReadOnly = isLocked || isClosedLike(packingList);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1a73e8" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      {isLocked && <LockBanner lockHolder={lockHolder} onClaim={handleClaimLock} />}
      <SyncStatusBar syncState={packingList?.sync_state ?? 'LOCAL'} listNumber={packingList?.list_number} />

      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.addButton, isReadOnly && styles.disabledButton]}
          onPress={handleAddBox}
          disabled={isReadOnly}
          accessibilityRole="button"
        >
          <Text style={styles.addButtonText}>+ Escanear Bulto</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.completeButton, (isReadOnly || packages.length === 0) && styles.disabledButton]}
          onPress={handleComplete}
          disabled={isReadOnly || packages.length === 0}
          accessibilityRole="button"
        >
          <Text style={styles.completeButtonText}>Completar</Text>
        </TouchableOpacity>
      </View>

      {isClosedLike(packingList) && (
        <View style={styles.signaturePanel}>
          <Text style={styles.signatureTitle}>Firma del cliente</Text>
          {packingList?.signature_declined === 1 ? (
            <>
              <Text style={styles.signatureStatusMuted}>El cliente no firmó esta lista.</Text>
              {packingList.signature_decline_note ? (
                <Text style={styles.signatureNote}>Motivo: {packingList.signature_decline_note}</Text>
              ) : null}
            </>
          ) : signaturePreviewUri ? (
            <TouchableOpacity onPress={() => setShowSignatureModal(true)} accessibilityRole="button">
              <Image source={{ uri: signaturePreviewUri }} style={styles.signaturePreview} resizeMode="contain" />
              <Text style={styles.signatureHint}>Toca para ampliar la firma</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.signatureStatusMuted}>Firma registrada no disponible en este dispositivo.</Text>
          )}
        </View>
      )}

      <FlatList
        data={packages}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={styles.packageCard}
            onPress={() => navigation.navigate('PackageDetail', { packageId: item.id, packingListLocalId: localId })}
            accessibilityRole="button"
          >
            <Text style={styles.packageIndex}>Bulto {index + 1}</Text>
            <Text style={styles.packageBarcode}>{item.barcode}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Aún no hay bultos. Escanea uno para comenzar.</Text>
        }
      />

      <Modal visible={showSignatureModal} transparent animationType="fade" onRequestClose={() => setShowSignatureModal(false)}>
        <View style={styles.signatureModalBackdrop}>
          <TouchableOpacity style={styles.signatureModalCloseArea} onPress={() => setShowSignatureModal(false)} accessibilityRole="button" />
          {signaturePreviewUri && (
            <View style={styles.signatureModalCard}>
              <Image source={{ uri: signaturePreviewUri }} style={styles.signatureModalImage} resizeMode="contain" />
              <TouchableOpacity style={styles.signatureModalCloseBtn} onPress={() => setShowSignatureModal(false)} accessibilityRole="button">
                <Text style={styles.signatureModalCloseText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

async function generateUUID(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  toolbar: { flexDirection: 'row', padding: 12, gap: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  addButton: { flex: 1, backgroundColor: '#1a73e8', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  completeButton: { flex: 1, backgroundColor: '#34a853', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  completeButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  disabledButton: { opacity: 0.4 },
  signaturePanel: { backgroundColor: '#fff', margin: 12, marginBottom: 0, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#e6e6e6' },
  signatureTitle: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 8 },
  signatureStatusMuted: { fontSize: 13, color: '#666' },
  signatureNote: { fontSize: 12, color: '#666', marginTop: 6 },
  signaturePreview: { width: '100%', height: 120, backgroundColor: '#f7f8fa', borderRadius: 8, borderWidth: 1, borderColor: '#e0e0e0' },
  signatureHint: { fontSize: 12, color: '#1a73e8', marginTop: 8 },
  packageCard: { backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 10, elevation: 1, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 3 },
  packageIndex: { fontSize: 12, color: '#888', marginBottom: 2 },
  packageBarcode: { fontSize: 18, fontWeight: '700', color: '#333', fontFamily: 'monospace' },
  empty: { textAlign: 'center', color: '#aaa', marginTop: 48, fontSize: 15, lineHeight: 22 },
  signatureModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  signatureModalCloseArea: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  signatureModalCard: { width: '100%', maxHeight: '85%', backgroundColor: '#111', borderRadius: 10, overflow: 'hidden' },
  signatureModalImage: { width: '100%', height: 320, backgroundColor: '#fff' },
  signatureModalCloseBtn: { alignSelf: 'flex-end', margin: 12, backgroundColor: '#1a73e8', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  signatureModalCloseText: { color: '#fff', fontWeight: '700' },
});
