import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, SafeAreaView, ActivityIndicator, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Crypto from 'expo-crypto';

import { RootStackParamList } from '../navigation/types';
import { useAuth } from '../auth/useAuth';
import { getDeviceId } from '../auth/deviceId';
import {
  getMovingFileCache,
  getCurrentPackingLists,
  getPackingListsByFile,
  getAppSetting,
  setAppSetting,
  upsertPackingList,
  PackingListRow,
  MovingFileCacheRow,
} from '../db/queries';
import { refreshMovingFileCache } from '../services/cacheService';

type Props = NativeStackScreenProps<RootStackParamList, 'NewPackingList'>;

export default function NewPackingListScreen({ navigation }: Props) {
  const { userName } = useAuth();
  const [files, setFiles] = useState<MovingFileCacheRow[]>([]);
  const [selectedFile, setSelectedFile] = useState<MovingFileCacheRow | null>(null);
  const [operatorName, setOperatorName] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const cachedOperator = await getAppSetting('operator_name');
        setOperatorName(cachedOperator?.trim() || userName?.trim() || '');

        await refreshMovingFileCache().catch(() => {});
        const cached = await getMovingFileCache();
        const currentLists = await getCurrentPackingLists();
        const filesWithPacking = new Set(currentLists.map((l) => l.moving_file_id));
        const eligible = cached.filter(
          (f) => f.status === 'OPEN' && ['EXPORT', 'LOCAL', 'WAREHOUSE'].includes(f.category)
            && !filesWithPacking.has(f.id)
        );
        setFiles(eligible);
      } catch {
        setFiles([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [userName]);

  const formatCategoryEs = (category: string) => {
    if (category === 'WAREHOUSE') return 'Bodegaje';
    if (category === 'EXPORT') return 'Exportación';
    if (category === 'LOCAL') return 'Mudanza';
    return category;
  };

  const handleCreate = async () => {
    if (creating) return;
    if (!selectedFile) {
      Alert.alert('Selecciona un expediente', 'Por favor selecciona el expediente de mudanza.');
      return;
    }
    if (!operatorName.trim()) {
      Alert.alert('Nombre requerido', 'Ingresa el nombre del operador.');
      return;
    }

    const existingForFile = await getPackingListsByFile(selectedFile.id);
    if (existingForFile.length > 0) {
      Alert.alert('Lista existente', 'Este expediente ya tiene una lista de empaque activa o cerrada.');
      return;
    }

    setCreating(true);
    try {
      const devId = await getDeviceId();
      const now = new Date().toISOString();
      const newId = await generateUUID();
      const movingFileRef = JSON.stringify({
        id: selectedFile.id,
        fileNumber: selectedFile.file_number,
        category: selectedFile.category,
        clientId: selectedFile.client_id,
        clientName: selectedFile.client_name ?? null,
        phone: selectedFile.phone,
        address: selectedFile.address,
        serviceLatitude: selectedFile.service_latitude ?? null,
        serviceLongitude: selectedFile.service_longitude ?? null,
        jobType: selectedFile.job_type || selectedFile.category,
      });

      const newRow: PackingListRow = {
        id: newId,
        server_id: null,
        list_number: null,
        moving_file_id: selectedFile.id,
        moving_file_ref: movingFileRef,
        operator_name: operatorName.trim(),
        status: 'ACTIVE',
        progress_status: 'NOT_STARTED',
        pending_progress_status: null,
        signature_local_path: null,
        signature_blob_path: null,
        signature_declined: 0,
        signature_decline_note: null,
        review_language: null,
        completion_requested_at: null,
        completion_confirmed_at: null,
        completion_idempotency_key: null,
        completion_observations: null,
        satisfaction_rating: null,
        satisfaction_submitted_at: null,
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
      await setAppSetting('operator_name', operatorName.trim());

      navigation.replace('PackingList', {
        localId: newId,
        movingFileId: selectedFile.id,
        movingFileRef,
      });
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#1a73e8" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.label}>Operador</Text>
        <TextInput
          style={styles.input}
          value={operatorName}
          onChangeText={setOperatorName}
          placeholder="Nombre del operador"
        />

        <Text style={styles.label}>Expediente de Mudanza</Text>
        {files.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No hay expedientes elegibles. Solo se permiten expedientes abiertos de Exportación, Mudanza o Bodegaje.</Text>
          </View>
        ) : (
          <FlatList
            data={files}
            keyExtractor={item => item.id}
            style={styles.fileList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.fileOption, selectedFile?.id === item.id && styles.fileOptionSelected]}
                onPress={() => setSelectedFile(item)}
                accessibilityRole="button"
              >
                <Text style={[styles.fileNumber, selectedFile?.id === item.id && styles.fileNumberSelected]}>
                  {item.file_number}
                </Text>
                <Text style={styles.fileCategory}>{formatCategoryEs(item.category)}</Text>
                {item.client_name ? <Text style={styles.clientName}>{item.client_name}</Text> : null}
              </TouchableOpacity>
            )}
          />
        )}

        <TouchableOpacity
          style={[styles.createBtn, (!selectedFile || !operatorName.trim() || creating) && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={!selectedFile || !operatorName.trim() || creating}
          accessibilityRole="button"
        >
          <Text style={styles.createBtnText}>{creating ? 'Creando...' : 'Crear Lista de Empaque'}</Text>
        </TouchableOpacity>
      </View>
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
  content: { flex: 1, padding: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginTop: 16, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  input: { backgroundColor: '#fff', borderRadius: 8, padding: 12, fontSize: 15, borderWidth: 1, borderColor: '#e0e0e0', marginBottom: 4 },
  fileList: { flex: 1, marginBottom: 12 },
  fileOption: { backgroundColor: '#fff', borderRadius: 8, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#e0e0e0' },
  fileOptionSelected: { borderColor: '#1a73e8', backgroundColor: '#e8f0fe' },
  fileNumber: { fontSize: 16, fontWeight: '700', color: '#333' },
  fileNumberSelected: { color: '#1a73e8' },
  fileCategory: { fontSize: 12, color: '#888', marginTop: 2 },
  clientName: { fontSize: 13, color: '#555', marginTop: 2 },
  emptyBox: { backgroundColor: '#fff3cd', borderRadius: 8, padding: 16, marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#856404', textAlign: 'center' },
  createBtn: { backgroundColor: '#1a73e8', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  createBtnDisabled: { opacity: 0.4 },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
