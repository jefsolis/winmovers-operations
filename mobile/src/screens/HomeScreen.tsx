import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, AppState, AppStateStatus, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as Network from 'expo-network';

import { RootStackParamList } from '../navigation/types';
import { useAuth } from '../auth/useAuth';
import { getDeviceId } from '../auth/deviceId';
import { refreshAllPackingListsFromServer, refreshItemTypeCache, refreshMovingFileCache, retryPendingPackingListCompletions } from '../services/cacheService';
import {
  getCurrentPackingLists,
  markPackingListDeletedLocally,
  PackingListRow,
} from '../db/queries';
import { api } from '../services/api';
import { getPackingProgressStage } from '../components/PackingProgressIndicator';

type MovingFileRefMeta = {
  id?: string;
  fileNumber?: string;
  category?: string;
  clientName?: string | null;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
type ListFilter = 'ACTIVE' | 'COMPLETED';

export default function HomeScreen({ navigation }: Props) {
  const { userName, logout } = useAuth();
  const [packingLists, setPackingLists] = useState<PackingListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [listFilter, setListFilter] = useState<ListFilter>('ACTIVE');

  const loadHomeData = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const net = await Network.getNetworkStateAsync();
      setIsOnline(!!net.isConnected);

      if (net.isConnected) {
        const deviceId = await getDeviceId();

        try {
          await retryPendingPackingListCompletions(deviceId);
        } catch {
          // Keep going — a retry failure should not block list loading.
        }

        try {
          await refreshMovingFileCache();
          await refreshItemTypeCache();
          await refreshAllPackingListsFromServer();
        } catch {
          // Keep local view if refresh fails.
        }

        try {
          await retryPendingPackingListCompletions(deviceId);
          await refreshAllPackingListsFromServer();
        } catch {
          // Keep local view if retry/final refresh fails.
        }
      }

      const lists = await getCurrentPackingLists();
      const sortedLists = [...lists].sort((a, b) => {
        const aClosed = a.status === 'CLOSED' || a.status === 'COMPLETE' || a.sync_state === 'CLOSED';
        const bClosed = b.status === 'CLOSED' || b.status === 'COMPLETE' || b.sync_state === 'CLOSED';
        if (aClosed !== bClosed) return aClosed ? 1 : -1;
        return (Date.parse(b.updated_at || '') || 0) - (Date.parse(a.updated_at || '') || 0);
      });
      setPackingLists(sortedLists);
    } catch {
      setPackingLists([]);
    } finally {
      setLoading(false);
      if (manual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadHomeData();
  }, [loadHomeData]);

  useFocusEffect(
    useCallback(() => {
      loadHomeData();
    }, [loadHomeData])
  );

  // Refresh when coming back online
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') loadHomeData();
    });
    return () => sub.remove();
  }, [loadHomeData]);

  useEffect(() => {
    const sub = Network.addNetworkStateListener((state) => {
      if (state.isConnected) {
        loadHomeData();
      }
    });
    return () => sub.remove();
  }, [loadHomeData]);

  const openPackingList = (item: PackingListRow) => {
    const fallbackRef = JSON.stringify({ id: item.moving_file_id, fileNumber: '', category: '' });
    navigation.navigate('PackingList', {
      localId: item.id,
      movingFileId: item.moving_file_id,
      movingFileRef: item.moving_file_ref || fallbackRef,
    });
  };

  const confirmDeletePackingList = (item: PackingListRow) => {
    Alert.alert(
      'Eliminar lista',
      `Se eliminara la lista ${item.list_number ?? 'sin numero'}. Esta accion tambien la elimina en la web.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              if (item.server_id) await api.softDeletePackingList(item.server_id);
              await markPackingListDeletedLocally(item.id);
              await loadHomeData(true);
            } catch (error: unknown) {
              const message = error instanceof Error ? error.message : 'Error desconocido';
              Alert.alert('No se pudo eliminar', message);
            }
          },
        },
      ]
    );
  };

  const parseMovingFileRef = (raw: string): MovingFileRefMeta => {    try {
      const parsed = JSON.parse(raw) as MovingFileRefMeta;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const formatCategoryEs = (category: string | undefined) => {
    if (category === 'WAREHOUSE') return 'Bodegaje';
    if (category === 'EXPORT') return 'Exportación';
    if (category === 'LOCAL') return 'Mudanza';
    return category || 'Expediente';
  };

  const syncMeta = (state: string) => {
    const map: Record<string, { label: string; color: string; icon: React.ComponentProps<typeof Ionicons>['name']; compact: boolean }> = {
      LOCAL: { label: 'Sin sincronizar', color: '#8a6d1f', icon: 'cloud-offline-outline', compact: false },
      SAVING: { label: 'Guardando', color: '#1a73e8', icon: 'sync-outline', compact: false },
      SAVED: { label: 'Sincronizado', color: '#1e8e3e', icon: 'checkmark-circle', compact: true },
      COMPLETING: { label: 'Finalizando', color: '#1a73e8', icon: 'sync-outline', compact: false },
      COMPLETE_PENDING_SYNC: { label: 'Finalizando', color: '#1a73e8', icon: 'cloud-upload-outline', compact: false },
      CLOSED: { label: 'Sincronizado', color: '#1e8e3e', icon: 'checkmark-circle', compact: true },
      ERROR: { label: 'Error de sincronizacion', color: '#c5221f', icon: 'alert-circle', compact: false },
    };
    return map[state] ?? { label: state, color: '#5f6368', icon: 'help-circle-outline', compact: false };
  };

  const formatStatusEs = (status: string | null | undefined) => {
    if (!status || status === 'ACTIVE' || status === 'COMPLETE_PENDING_SYNC') return null;
    if (status === 'CLOSED' || status === 'COMPLETE') return 'Cerrada';
    return status;
  };

  const syncPercentForState = (state: string) => {
    const map: Record<string, number> = {
      LOCAL: 0,
      SAVING: 45,
      SAVED: 100,
      COMPLETING: 85,
      COMPLETE_PENDING_SYNC: 92,
      CLOSED: 100,
      ERROR: 20,
    };
    return map[state] ?? 0;
  };

  const syncPercent = packingLists.length === 0
    ? 100
    : Math.round(
      packingLists.reduce((sum, pl) => sum + syncPercentForState(pl.sync_state), 0) / packingLists.length
    );

  const isCompleted = (item: PackingListRow) => (
    item.progress_status === 'COMPLETED' ||
    item.status === 'CLOSED' ||
    item.status === 'COMPLETE' ||
    item.sync_state === 'CLOSED'
  );
  const activeCount = packingLists.filter(item => !isCompleted(item)).length;
  const completedCount = packingLists.length - activeCount;
  const visiblePackingLists = packingLists.filter(item => (
    listFilter === 'COMPLETED' ? isCompleted(item) : !isCompleted(item)
  ));

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Sin conexión — modo sin internet</Text>
        </View>
      )}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.welcome}>Hola, {userName ?? 'Usuario'}</Text>
          <TouchableOpacity onPress={logout} accessibilityRole="button">
            <Text style={styles.logoutBtn}>Salir</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerActionsRow}>
          <TouchableOpacity style={styles.newButton} onPress={() => navigation.navigate('NewPackingList')} accessibilityRole="button">
            <Text style={styles.newButtonText}>+ Nueva Lista</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.syncButton} onPress={() => loadHomeData(true)} accessibilityRole="button" disabled={refreshing}>
            <Text style={styles.syncButtonText}>{refreshing ? 'Sincronizando…' : 'Sincronizar'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.syncProgressCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.syncProgressLabel}>Sincronizacion general</Text>
          <Text style={styles.syncProgressValue}>{syncPercent}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${syncPercent}%` }]} />
        </View>
      </View>

      <View style={styles.listHeading}>
        <Text style={styles.sectionTitle}>Listas de Empaque</Text>
        <View style={styles.filterTabs} accessibilityRole="tablist">
          <TouchableOpacity
            style={[styles.filterTab, listFilter === 'ACTIVE' && styles.filterTabActive]}
            onPress={() => setListFilter('ACTIVE')}
            accessibilityRole="tab"
            accessibilityState={{ selected: listFilter === 'ACTIVE' }}
          >
            <Ionicons name="cube-outline" size={15} color={listFilter === 'ACTIVE' ? '#fff' : '#1769aa'} />
            <Text style={[styles.filterTabText, listFilter === 'ACTIVE' && styles.filterTabTextActive]}>Activas {activeCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, listFilter === 'COMPLETED' && styles.filterTabActive]}
            onPress={() => setListFilter('COMPLETED')}
            accessibilityRole="tab"
            accessibilityState={{ selected: listFilter === 'COMPLETED' }}
          >
            <Ionicons name="checkmark-circle-outline" size={15} color={listFilter === 'COMPLETED' ? '#fff' : '#1769aa'} />
            <Text style={[styles.filterTabText, listFilter === 'COMPLETED' && styles.filterTabTextActive]}>Completadas {completedCount}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        data={visiblePackingLists}
        keyExtractor={item => item.id}
        refreshing={refreshing}
        onRefresh={() => loadHomeData(true)}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => {
          const sync = syncMeta(item.sync_state);
          const ref = parseMovingFileRef(item.moving_file_ref);
          const fileOrJob = ref.fileNumber?.trim() || item.moving_file_id;
          const fileCategory = formatCategoryEs(ref.category?.trim());
          const statusLabel = formatStatusEs(item.status);
          const clientName = ref.clientName?.trim();
          const showDebugLine = item.sync_state === 'COMPLETE_PENDING_SYNC' || item.sync_state === 'COMPLETING' || item.sync_state === 'ERROR';
          const debugMessage = item.sync_error?.trim() || 'Sin detalle de error en cache local';
          const serverTag = item.server_id ? 'serverId=OK' : 'serverId=FALTA';
          const effectiveProgress = item.pending_progress_status ?? item.progress_status;
          const progress = getPackingProgressStage(effectiveProgress);
          return (
            <TouchableOpacity style={styles.card} onPress={() => openPackingList(item)} accessibilityRole="button">
              <View style={styles.rowBetween}>
                <Text style={styles.fileNumber}>{fileOrJob}</Text>
                <View
                  style={styles.syncIndicator}
                  accessible
                  accessibilityLabel={sync.label}
                >
                  <Ionicons name={sync.icon} size={16} color={sync.color} />
                  {!sync.compact && <Text style={[styles.syncIndicatorText, { color: sync.color }]}>{sync.label}</Text>}
                </View>
              </View>
              <Text style={styles.fileCategory}>{statusLabel ? `${fileCategory} | ${statusLabel}` : fileCategory}</Text>
              <Text style={styles.clientName}>{clientName || 'Cliente sin nombre'}</Text>
              <View style={styles.progressStatus}>
                <Ionicons name={progress.icon} size={18} color="#1769aa" />
                <Text style={styles.progressStatusText}>{progress.label}</Text>
                {item.pending_progress_status && <Text style={styles.progressPending}>Pendiente</Text>}
              </View>
              <Text style={styles.operatorName}>Operador: {item.operator_name}</Text>
              <Text style={styles.listNumber}>Lista: {item.list_number ?? 'Sin numero'}</Text>
              {showDebugLine ? <Text style={styles.debugSyncText}>Debug sync: {item.sync_state} | {serverTag} | {debugMessage}</Text> : null}
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => confirmDeletePackingList(item)}
                accessibilityRole="button"
                accessibilityLabel={`Eliminar lista ${item.list_number ?? ''}`}
              >
                <Ionicons name="trash-outline" size={16} color="#c5221f" />
                <Text style={styles.deleteBtnText}>Eliminar</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {listFilter === 'ACTIVE' ? 'No hay listas de empaque activas.' : 'No hay listas de empaque completadas.'}
          </Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  offlineBanner: { backgroundColor: '#f57c00', padding: 8, alignItems: 'center' },
  offlineText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  header: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0', gap: 10 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerActionsRow: { flexDirection: 'row', gap: 10 },
  welcome: { fontSize: 16, fontWeight: '600', color: '#333' },
  newButton: { flex: 1, backgroundColor: '#1a73e8', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center' },
  newButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  syncButton: { flex: 1, backgroundColor: '#e8f0fe', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, alignItems: 'center' },
  syncButtonText: { color: '#1a73e8', fontSize: 12, fontWeight: '700' },
  logoutBtn: { color: '#1a73e8', fontSize: 14, fontWeight: '600' },
  syncProgressCard: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e6e6e6' },
  syncProgressLabel: { fontSize: 12, color: '#666', fontWeight: '600' },
  syncProgressValue: { fontSize: 12, color: '#1a73e8', fontWeight: '700' },
  progressTrack: { marginTop: 8, height: 8, borderRadius: 8, backgroundColor: '#edf1f5', overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: '#1a73e8' },
  listHeading: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  filterTabs: { flexDirection: 'row', borderWidth: 1, borderColor: '#b8cbe0', borderRadius: 8, overflow: 'hidden', backgroundColor: '#fff' },
  filterTab: { flex: 1, minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  filterTabActive: { backgroundColor: '#1769aa' },
  filterTabText: { color: '#1769aa', fontSize: 12, fontWeight: '700' },
  filterTabTextActive: { color: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  syncIndicator: { minHeight: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  syncIndicatorText: { fontSize: 10, fontWeight: '700' },
  fileNumber: { fontSize: 18, fontWeight: '700', color: '#1a73e8' },
  fileCategory: { fontSize: 13, color: '#888', marginTop: 2 },
  clientName: { fontSize: 14, color: '#333', marginTop: 4 },
  progressStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, marginBottom: 3 },
  progressStatusText: { color: '#1769aa', fontSize: 13, fontWeight: '700' },
  progressPending: { color: '#8a5a00', backgroundColor: '#fff3cd', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, fontSize: 10, fontWeight: '700' },
  operatorName: { fontSize: 12, color: '#5f6368', marginTop: 2 },
  listNumber: { fontSize: 12, color: '#5f6368', marginTop: 2 },
  debugSyncText: { fontSize: 11, color: '#b3261e', marginTop: 4 },
  deleteBtn: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#f0c2c0', backgroundColor: '#fdf1f0' },
  deleteBtnText: { color: '#c5221f', fontSize: 12, fontWeight: '700' },
  empty: { textAlign: 'center', color: '#aaa', marginTop: 48, fontSize: 15 },
});
