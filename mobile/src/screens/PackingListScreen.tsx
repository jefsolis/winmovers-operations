import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Alert, Image, Modal, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as Crypto from 'expo-crypto';
import * as Network from 'expo-network';

import { RootStackParamList } from '../navigation/types';
import { useAuth } from '../auth/useAuth';
import { getDeviceId } from '../auth/deviceId';
import { api, ProgressTransition } from '../services/api';
import {
  upsertPackingList, getPackingList, getPackagesForList,
  getItemsForPackage, getPhotosForPackage, getItemTypeCache,
  getWorkdayEventsForList,
  replaceWorkdayEventsForList,
  getIngressEgressOperationsForList,
  IngressEgressOperationRow,
  reconcilePackagePhotos,
  reconcilePackingListProgress,
  getMissingBarcodeCount,
  setStageLocation,
  PackingListRow, PackageRow, PackageItemRow, PackagePhotoRow, ItemTypeCacheRow,
  enqueueProgressTransition,
} from '../db/queries';
import { retryPendingProgressTransitions, retryPendingWorkdayEvents, retryPendingIngressEgress } from '../services/cacheService';
import { captureStageLocation, stageLocationFromRow } from '../services/location';
import { useLiveSync } from '../hooks/useLiveSync';
import SyncStatusBar from '../components/SyncStatusBar';
import LockBanner from '../components/LockBanner';
import PackingProgressIndicator from '../components/PackingProgressIndicator';

type Props = NativeStackScreenProps<RootStackParamList, 'PackingList'>;
type PackagePreview = { items: PackageItemRow[]; photos: PackagePhotoRow[] };

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
  const [packagePreviews, setPackagePreviews] = useState<Record<string, PackagePreview>>({});
  const [itemTypes, setItemTypes] = useState<ItemTypeCacheRow[]>([]);
  const [remotePhotoUrls, setRemotePhotoUrls] = useState<Record<string, string>>({});
  const [deviceId, setDeviceId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [lockHolder, setLockHolder] = useState<string | null>(null);
  const [signaturePreviewUri, setSignaturePreviewUri] = useState<string | null>(null);
  const [selectedSignatureUri, setSelectedSignatureUri] = useState<string | null>(null);
  const [progressHistory, setProgressHistory] = useState<ProgressTransition[]>([]);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [isIngressEgressExpanded, setIsIngressEgressExpanded] = useState(false);
  const [ingressEgressOperations, setIngressEgressOperations] = useState<IngressEgressOperationRow[]>([]);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [workdayEvents, setWorkdayEvents] = useState<Array<{
    id: string;
    workday_index: number;
    event_type: 'DAY_START' | 'DAY_CLOSE' | 'FINAL_COMPLETE';
    occurred_at: string;
    actor_name: string | null;
    observations: string | null;
    client_signer_name: string | null;
    crew_leader_name: string | null;
    signature_client_local_path: string | null;
    signature_client_blob_path: string | null;
    signature_crew_local_path: string | null;
    signature_crew_blob_path: string | null;
    sync_state: string;
  }>>([]);
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
      const creationLocation = stageLocationFromRow(pl) ?? await captureStageLocation();
      await setStageLocation('packing_lists', pl.id, creationLocation);
      const result = await api.createPackingList({
        movingFileId,
        operatorName: pl.operator_name,
        deviceId: devId,
        location: creationLocation,
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
        const [types, workdays, previews] = await Promise.all([
          getItemTypeCache(),
          getWorkdayEventsForList(localId),
          Promise.all(pkgs.map(async pkg => ({
            packageId: pkg.id,
            items: await getItemsForPackage(pkg.id),
            photos: await getPhotosForPackage(pkg.id),
          }))),
        ]);
        setItemTypes(types);
        setWorkdayEvents(workdays as any);
        setPackagePreviews(Object.fromEntries(previews.map(preview => [preview.packageId, {
          items: preview.items,
          photos: preview.photos,
        }])));
        setPackingList(loadedPl);
        let pl = loadedPl;

        // If still no server_id, try creating on server now
        if (pl && !pl.server_id) {
          const devId = deviceId || await getDeviceId();
          pl = await createServerListIfNeeded(pl, devId);
        }

        if (pl?.server_id) {
          const devId = deviceId || await getDeviceId();
          await retryPendingWorkdayEvents(devId, pl.id);
          if (pl.pending_progress_status) {
            await retryPendingProgressTransitions(devId, pl.id);
          }
          await retryPendingIngressEgress(devId, pl.id);
          pl = await getPackingList(pl.id);
          setPackingList(pl);
          setWorkdayEvents(await getWorkdayEventsForList(pl!.id) as any);
        }
        if (pl) setIngressEgressOperations(await getIngressEgressOperationsForList(pl.id));

        const localSignatureUri = pl?.signature_local_path || (pl?.signature_declined !== 1 ? pl?.signature_blob_path : null);
        if (pl?.server_id) {
          try {
            const detail = await api.getPackingList(pl.server_id);
            setProgressHistory(detail.progressTransitions);
            const refreshedRef = JSON.stringify({
              ...JSON.parse(pl.moving_file_ref || '{}'),
              address: detail.serviceContext.address,
              phone: detail.serviceContext.phone,
              clientName: detail.serviceContext.clientName,
              jobType: detail.serviceContext.jobType,
              serviceLatitude: detail.serviceContext.serviceLatitude ?? null,
              serviceLongitude: detail.serviceContext.serviceLongitude ?? null,
            });
            if (refreshedRef !== pl.moving_file_ref) {
              await upsertPackingList({ ...pl, moving_file_ref: refreshedRef });
              pl = await getPackingList(pl.id);
              setPackingList(pl);
            }
            await replaceWorkdayEventsForList(pl!.id, detail.workdayHistory || []);
            setWorkdayEvents(await getWorkdayEventsForList(pl!.id) as any);
            if (detail.progressStatus && detail.progressStatus !== pl!.progress_status) {
              await reconcilePackingListProgress(pl!.id, detail.progressStatus);
              pl = await getPackingList(pl!.id);
              setPackingList(pl);
            }
            const photoUrls: Record<string, string> = {};
            for (const pkg of detail.packages) {
              await reconcilePackagePhotos(pkg.id, pkg.photos);
              for (const photo of pkg.photos) {
                if (photo.downloadUrl) {
                  photoUrls[photo.id] = photo.downloadUrl;
                  photoUrls[photo.blobPath] = photo.downloadUrl;
                }
              }
            }
            setRemotePhotoUrls(photoUrls);
            const reconciledPreviews = await Promise.all(pkgs.map(async pkg => ({
              packageId: pkg.id,
              items: await getItemsForPackage(pkg.id),
              photos: await getPhotosForPackage(pkg.id),
            })));
            setPackagePreviews(Object.fromEntries(reconciledPreviews.map(preview => [preview.packageId, {
              items: preview.items,
              photos: preview.photos,
            }])));
            setSignaturePreviewUri(isClosedLike(pl) ? (detail.signatureUrl || localSignatureUri || null) : null);
          } catch {
            setProgressHistory([]);
            setRemotePhotoUrls({});
            setSignaturePreviewUri(isClosedLike(pl) ? (localSignatureUri || null) : null);
          }
        } else {
          setProgressHistory([]);
          setRemotePhotoUrls({});
          setSignaturePreviewUri(isClosedLike(pl) ? (localSignatureUri || null) : null);
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

  const handleComplete = async () => {
    if (isClosedLike(packingList)) {
      Alert.alert('Lista bloqueada', 'La lista ya se encuentra cerrada o pendiente de cierre final.');
      return;
    }
    if (!packingList?.server_id) {
      Alert.alert('Sin conexión', 'La lista aun no tiene ID de servidor. Guarda cambios y vuelve a intentar al recuperar conexión.');
      return;
    }
    const missingBarcodes = await getMissingBarcodeCount(packingList.id);
    if (missingBarcodes > 0) {
      Alert.alert(
        'Bultos sin codigo de barras',
        `Hay ${missingBarcodes} bulto(s) sin codigo de barras. Asigna los codigos pendientes antes de completar el trabajo.`
      );
      return;
    }
    navigation.navigate('Signature', { packingListLocalId: localId, serverId: packingList.server_id });
  };

  const startTravel = async () => {
    if (!packingList || packingList.pending_progress_status) return;
    const id = await generateUUID();
    const now = new Date().toISOString();
    await enqueueProgressTransition({
      id,
      server_id: null,
      packing_list_id: packingList.id,
      from_status: packingList.progress_status,
      to_status: 'TRAVELING',
      observations: null,
      signature_local_path: null,
      signature_blob_path: null,
      survey_version: null,
      survey_answers: null,
      occurred_at: now,
      sync_state: 'PENDING',
      sync_error: null,
      created_at: now,
      confirmed_at: null,
    });
    await setStageLocation('packing_progress_transitions', id, await captureStageLocation());
    setPackingList({ ...packingList, pending_progress_status: 'TRAVELING' });
    await retryPendingProgressTransitions(deviceId, packingList.id);
    setPackingList(await getPackingList(packingList.id));
  };

  const handleProgressAction = () => {
    if (!packingList || isReadOnly) return;
    if (packingList.pending_progress_status) {
      void retryProgressTransition();
      return;
    }
    if (packingList.progress_status === 'NOT_STARTED') {
      Alert.alert('Iniciar viaje', '¿Confirmas que el equipo inicia el viaje?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Iniciar viaje', onPress: () => void startTravel() },
      ]);
      return;
    }
    if (packingList.progress_status === 'TRAVELING') {
      if (!packingList.server_id) {
        Alert.alert('Sin conexion', 'La lista debe sincronizarse antes de confirmar la llegada.');
        return;
      }
      navigation.navigate('ArrivalAcknowledgement', { packingListLocalId: packingList.id, serverId: packingList.server_id });
      return;
    }
    if (packingList.progress_status === 'WORKING') void handleComplete();
  };

  const handleCloseDay = () => {
    if (!packingList?.server_id || isReadOnly) return;
    navigation.navigate('ArrivalAcknowledgement', {
      packingListLocalId: packingList.id,
      serverId: packingList.server_id,
      eventType: 'DAY_CLOSE',
    });
  };

  const retryProgressTransition = async () => {
    if (!packingList?.pending_progress_status) return;
    const devId = deviceId || await getDeviceId();
    await retryPendingProgressTransitions(devId, packingList.id);
    const refreshed = await getPackingList(packingList.id);
    setPackingList(refreshed);
    if (refreshed?.pending_progress_status) {
      Alert.alert(
        'Sincronizacion pendiente',
        'No se pudo confirmar el cambio todavia. Verifica la conexion e intenta nuevamente.'
      );
    }
  };

  const progressActionLabel = packingList?.pending_progress_status
    ? 'Reintentar sincronizacion'
    : packingList?.progress_status === 'NOT_STARTED'
    ? 'Iniciar viaje'
    : packingList?.progress_status === 'TRAVELING'
      ? 'Ya llegamos'
      : packingList?.progress_status === 'WORKING'
        ? 'Completar trabajo'
        : null;

  const handleAddBox = () => {
    if (isReadOnly) return;
    navigation.navigate('Scan', { packingListLocalId: localId });
  };

  const isReadOnly = isLocked || isClosedLike(packingList);

  type TimelineEntry =
    | { kind: 'CREATED'; key: string; time: number }
    | { kind: 'TRANSITION'; key: string; time: number; transition: ProgressTransition }
    | { kind: 'WORKDAY'; key: string; time: number; event: (typeof workdayEvents)[number] };

  const timelineEntries = useMemo<TimelineEntry[]>(() => {
    if (!packingList) return [];
    const parseTime = (value?: string | null) => Date.parse(value || '') || 0;
    const entries: TimelineEntry[] = [
      { kind: 'CREATED', key: 'created', time: parseTime(packingList.created_at) },
      ...progressHistory.map(transition => ({
        kind: 'TRANSITION' as const,
        key: `transition-${transition.id}`,
        time: parseTime(transition.occurredAt),
        transition,
      })),
      ...workdayEvents.map(event => ({
        kind: 'WORKDAY' as const,
        key: `workday-${event.id}`,
        time: parseTime(event.occurred_at),
        event,
      })),
    ];
    return entries.sort((a, b) => a.time - b.time);
  }, [packingList, progressHistory, workdayEvents]);
  const serviceContext = (() => {
    try {
      return JSON.parse(packingList?.moving_file_ref || '{}') as {
        clientName?: string | null; phone?: string | null; address?: string | null;
        serviceLatitude?: number | null; serviceLongitude?: number | null;
        jobType?: string | null; category?: string | null;
      };
    } catch {
      return {};
    }
  })();

  const hasExactCoordinates = serviceContext.serviceLatitude != null && serviceContext.serviceLongitude != null;

  const openPhone = async () => {
    if (!serviceContext.phone) return;
    const url = `tel:${serviceContext.phone.replace(/[^+\d,;]/g, '')}`;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
    else Alert.alert('Llamada no disponible', 'Este dispositivo no puede abrir la aplicacion de telefono.');
  };

  const openNavigation = async () => {
    const destination = hasExactCoordinates
      ? `${serviceContext.serviceLatitude},${serviceContext.serviceLongitude}`
      : (serviceContext.address ? encodeURIComponent(serviceContext.address) : null);
    if (!destination) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
    else Alert.alert('Navegacion no disponible', 'No hay una aplicacion disponible para abrir la direccion.');
  };

  const formatEventTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const formatEventDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const PACKAGE_LOCATION_META: Record<string, { label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
    AT_CLIENT: { label: 'Con el cliente', icon: 'home-outline' },
    AT_TRUCK: { label: 'En camion', icon: 'bus-outline' },
    AT_WAREHOUSE: { label: 'En bodega', icon: 'business-outline' },
  };

  const packageLocationStatus = useMemo(() => {
    const completedOps = ingressEgressOperations
      .filter(op => op.status === 'COMPLETE' && op.completed_at)
      .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''));
    const latest = completedOps[0];
    if (!latest) {
      return { location: 'AT_CLIENT', since: packingList?.completion_confirmed_at || packingList?.created_at || null };
    }
    const location = latest.type === 'INGRESS_WAREHOUSE' ? 'AT_WAREHOUSE' : 'AT_TRUCK';
    return { location, since: latest.completed_at };
  }, [ingressEgressOperations, packingList]);

  const transitionMeta = (status: ProgressTransition['toStatus']) => {
    const map: Record<ProgressTransition['toStatus'], { label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
      NOT_STARTED: { label: 'No iniciado', icon: 'time-outline' },
      TRAVELING: { label: 'Viaje iniciado', icon: 'car-outline' },
      WORKING: { label: 'Llegada confirmada', icon: 'location-outline' },
      COMPLETED: { label: 'Trabajo completado', icon: 'checkmark-circle-outline' },
    };
    return map[status];
  };

  const openSignaturePreview = (uri: string) => {
    setSelectedSignatureUri(uri);
    setShowSignatureModal(true);
  };

  const itemName = (item: PackageItemRow) => {
    if (item.custom_name) return item.custom_name;
    return itemTypes.find(type => type.id === item.packing_item_type_id)?.name_es || 'Articulo';
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1a73e8" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      {isLocked && <LockBanner lockHolder={lockHolder} onClaim={handleClaimLock} />}
      <SyncStatusBar syncState={packingList?.sync_state ?? 'LOCAL'} listNumber={packingList?.list_number} />

      <FlatList
        data={packages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {packingList && (
              <PackingProgressIndicator
                current={packingList.progress_status}
                pending={packingList.pending_progress_status}
              />
            )}

            <View style={styles.clientPanel}>
              <Text style={styles.clientName}>{serviceContext.clientName || 'Cliente no disponible'}</Text>
              <Text style={styles.clientMeta}>{serviceContext.jobType || serviceContext.category || 'Tipo de trabajo no disponible'}</Text>
              <Text style={styles.clientValue}>{serviceContext.phone || 'Telefono no disponible'}</Text>
              <Text style={styles.clientValue}>{serviceContext.address || 'Direccion no disponible'}</Text>
              <Text style={[styles.locationSource, hasExactCoordinates ? styles.locationSourceExact : styles.locationSourceAddress]}>
                {hasExactCoordinates ? 'Ubicacion exacta disponible' : 'Solo direccion de texto'}
              </Text>
              <View style={styles.clientActions}>
                <TouchableOpacity style={[styles.clientAction, !serviceContext.phone && styles.disabledButton]} onPress={openPhone} disabled={!serviceContext.phone} accessibilityRole="button">
                  <Ionicons name="call-outline" size={18} color="#1769aa" />
                  <Text style={styles.clientActionText}>Llamar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.clientAction, !serviceContext.address && !hasExactCoordinates && styles.disabledButton]}
                  onPress={openNavigation}
                  disabled={!serviceContext.address && !hasExactCoordinates}
                  accessibilityRole="button"
                >
                  <Ionicons name="navigate-outline" size={18} color="#1769aa" />
                  <Text style={styles.clientActionText}>Navegar</Text>
                </TouchableOpacity>
              </View>
            </View>

            {packingList && isClosedLike(packingList) && (
              <View style={styles.packageLocationBanner}>
                <Ionicons name={PACKAGE_LOCATION_META[packageLocationStatus.location].icon} size={20} color="#1769aa" />
                <Text style={styles.packageLocationText}>
                  Bultos {PACKAGE_LOCATION_META[packageLocationStatus.location].label}
                  {packageLocationStatus.since ? ` desde el ${formatEventDate(packageLocationStatus.since)}` : ''}
                </Text>
              </View>
            )}

            <View style={styles.toolbar}>
              <TouchableOpacity
                style={[styles.addButton, isReadOnly && styles.disabledButton]}
                onPress={handleAddBox}
                disabled={isReadOnly}
                accessibilityRole="button"
              >
                <Text style={styles.addButtonText}>+ Escanear Bulto</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.optionsButton} onPress={() => setShowOptionsModal(true)} accessibilityRole="button" accessibilityLabel="Opciones">
                <Ionicons name="ellipsis-horizontal" size={22} color="#1769aa" />
              </TouchableOpacity>
            </View>

            {progressActionLabel && (
              <TouchableOpacity
                style={[styles.progressButton, isReadOnly && styles.disabledButton]}
                onPress={handleProgressAction}
                disabled={isReadOnly}
                accessibilityRole="button"
              >
                <Text style={styles.progressButtonText}>{progressActionLabel}</Text>
              </TouchableOpacity>
            )}

            {packingList?.progress_status === 'WORKING' && !isReadOnly && (
              <TouchableOpacity
                style={styles.secondaryProgressButton}
                onPress={handleCloseDay}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryProgressButtonText}>Cerrar jornada</Text>
              </TouchableOpacity>
            )}

            {packingList && (
              <View style={styles.historyPanel}>
                <TouchableOpacity
                  style={[styles.historyTitleRow, isHistoryExpanded && styles.historyTitleRowExpanded]}
                  onPress={() => setIsHistoryExpanded(expanded => !expanded)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isHistoryExpanded }}
                  accessibilityLabel={`Historial de eventos, ${timelineEntries.length} eventos`}
                >
                  <Ionicons name="time-outline" size={17} color="#1769aa" />
                  <Text style={styles.historyTitle}>Historial de eventos</Text>
                  <Text style={styles.historyCount}>{timelineEntries.length}</Text>
                  <Ionicons name={isHistoryExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#1769aa" />
                </TouchableOpacity>
                {isHistoryExpanded && (
                  <>
                    {timelineEntries.map(entry => {
                      if (entry.kind === 'CREATED') {
                        return (
                          <View key={entry.key} style={styles.historyEvent}>
                            <View style={styles.historyIcon}>
                              <Ionicons name="add-circle-outline" size={18} color="#1769aa" />
                            </View>
                            <View style={styles.historyContent}>
                              <Text style={styles.historyEventTitle}>Lista creada</Text>
                              <Text style={styles.historyMeta}>{formatEventTime(packingList.created_at)} · {packingList.operator_name}</Text>
                            </View>
                          </View>
                        );
                      }

                      if (entry.kind === 'TRANSITION') {
                        const transition = entry.transition;
                        const meta = transitionMeta(transition.toStatus);
                        return (
                          <View key={entry.key} style={styles.historyEvent}>
                            <View style={styles.historyIcon}>
                              <Ionicons name={meta.icon} size={18} color="#1769aa" />
                            </View>
                            <View style={styles.historyContent}>
                              <Text style={styles.historyEventTitle}>{meta.label}</Text>
                              <Text style={styles.historyMeta}>{formatEventTime(transition.occurredAt)} · {transition.actorName}</Text>
                              {transition.observations ? <Text style={styles.historyObservations}>{transition.observations}</Text> : null}
                              {transition.toStatus === 'WORKING' && transition.signatureUrl ? (
                                <TouchableOpacity onPress={() => openSignaturePreview(transition.signatureUrl!)} accessibilityRole="button">
                                  <Image source={{ uri: transition.signatureUrl }} style={styles.arrivalSignaturePreview} resizeMode="contain" />
                                  <Text style={styles.signatureHint}>Firma de llegada · Toca para ampliar</Text>
                                </TouchableOpacity>
                              ) : null}
                              {transition.toStatus === 'COMPLETED' && packingList.signature_declined === 1 ? (
                                <View style={styles.completionHistoryDetail}>
                                  <Text style={styles.signatureStatusMuted}>El cliente no firmó esta lista.</Text>
                                  {packingList.signature_decline_note ? (
                                    <Text style={styles.signatureNote}>Motivo: {packingList.signature_decline_note}</Text>
                                  ) : null}
                                </View>
                              ) : null}
                              {transition.toStatus === 'COMPLETED' && packingList.signature_declined !== 1 && signaturePreviewUri ? (
                                <TouchableOpacity onPress={() => openSignaturePreview(signaturePreviewUri)} accessibilityRole="button">
                                  <Image source={{ uri: signaturePreviewUri }} style={styles.arrivalSignaturePreview} resizeMode="contain" />
                                  <Text style={styles.signatureHint}>Firma final · Toca para ampliar</Text>
                                </TouchableOpacity>
                              ) : null}
                              {transition.toStatus === 'COMPLETED' && packingList.satisfaction_rating ? (
                                <View style={styles.satisfactionRow}>
                                  <Ionicons name="star" size={15} color="#b26a00" />
                                  <Text style={styles.satisfactionText}>Satisfaccion: {packingList.satisfaction_rating} / 5</Text>
                                </View>
                              ) : null}
                            </View>
                          </View>
                        );
                      }

                      const event = entry.event;
                      const clientSignatureUri = event.signature_client_blob_path || event.signature_client_local_path;
                      const crewSignatureUri = event.signature_crew_blob_path || event.signature_crew_local_path;
                      const eventLabel = event.event_type === 'DAY_START'
                        ? 'Inicio'
                        : event.event_type === 'DAY_CLOSE' ? 'Cierre' : 'Final';
                      return (
                        <View key={entry.key} style={styles.historyEvent}>
                          <View style={styles.historyIcon}>
                            <Ionicons name="calendar-outline" size={18} color="#1769aa" />
                          </View>
                          <View style={styles.historyContent}>
                            <Text style={styles.historyEventTitle}>
                              Jornada {event.workday_index}: {eventLabel}
                            </Text>
                            <Text style={styles.historyMeta}>{formatEventTime(event.occurred_at)} · {event.actor_name || 'Operador'}</Text>
                            {event.sync_state !== 'CONFIRMED' ? (
                              <Text style={styles.historyPending}>Pendiente de sincronizacion</Text>
                            ) : null}
                            {event.observations ? <Text style={styles.historyObservations}>{event.observations}</Text> : null}
                            {clientSignatureUri ? (
                              <TouchableOpacity onPress={() => openSignaturePreview(clientSignatureUri)} accessibilityRole="button">
                                <Image source={{ uri: clientSignatureUri }} style={styles.arrivalSignaturePreview} resizeMode="contain" />
                                <Text style={styles.signatureHint}>
                                  Firma del cliente{event.client_signer_name ? ` · ${event.client_signer_name}` : ''} · Toca para ampliar
                                </Text>
                              </TouchableOpacity>
                            ) : null}
                            {crewSignatureUri ? (
                              <TouchableOpacity onPress={() => openSignaturePreview(crewSignatureUri)} accessibilityRole="button">
                                <Image source={{ uri: crewSignatureUri }} style={styles.arrivalSignaturePreview} resizeMode="contain" />
                                <Text style={styles.signatureHint}>
                                  Firma jefe de cuadrilla{event.crew_leader_name ? ` · ${event.crew_leader_name}` : ''} · Toca para ampliar
                                </Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                  </>
                )}
              </View>
            )}

            {ingressEgressOperations.length > 0 && (
              <View style={styles.historyPanel}>
                <TouchableOpacity
                  style={[styles.historyTitleRow, isIngressEgressExpanded && styles.historyTitleRowExpanded]}
                  onPress={() => setIsIngressEgressExpanded(expanded => !expanded)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isIngressEgressExpanded }}
                  accessibilityLabel={`Historial de ingreso y egreso, ${ingressEgressOperations.length} operaciones`}
                >
                  <Ionicons name="swap-horizontal-outline" size={17} color="#1769aa" />
                  <Text style={styles.historyTitle}>Historial de ingreso / egreso</Text>
                  <Text style={styles.historyCount}>{ingressEgressOperations.length}</Text>
                  <Ionicons name={isIngressEgressExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#1769aa" />
                </TouchableOpacity>
                {isIngressEgressExpanded && ingressEgressOperations.map(op => {
                  const typeLabel = op.type === 'INGRESS_TRUCK'
                    ? 'Ingreso a camion'
                    : op.type === 'INGRESS_WAREHOUSE' ? 'Ingreso a bodega' : 'Extraccion de bodega';
                  const statusLabel = op.status === 'COMPLETE'
                    ? 'Completado'
                    : op.status === 'AWAITING_MANAGER_SIGNATURE' ? 'Falta firma de bodega' : 'En progreso';
                  const isWarehouseOp = op.type === 'INGRESS_WAREHOUSE' || op.type === 'EGRESS_WAREHOUSE';
                  const crewSigUri = op.crew_leader_signature_local_path || null;
                  const managerSigUri = op.warehouse_manager_signature_local_path || null;
                  return (
                    <View key={op.id} style={styles.historyEvent}>
                      <View style={styles.historyIcon}>
                        <Ionicons name="cube-outline" size={18} color="#1769aa" />
                      </View>
                      <View style={styles.historyContent}>
                        <Text style={styles.historyEventTitle}>{typeLabel} · {statusLabel}</Text>
                        <Text style={styles.historyMeta}>
                          {formatEventTime(op.completed_at || op.created_at)}
                          {op.crew_leader_name ? ` · ${op.crew_leader_name}` : ''}
                        </Text>
                        {op.sync_state !== 'CONFIRMED' ? (
                          <Text style={styles.historyPending}>Pendiente de sincronizacion</Text>
                        ) : null}
                        {op.warehouse_location ? <Text style={styles.historyObservations}>Ubicacion: {op.warehouse_location}</Text> : null}
                        {op.observations ? <Text style={styles.historyObservations}>{op.observations}</Text> : null}
                        {(crewSigUri || managerSigUri) && (
                          <View style={{ marginTop: 8 }}>
                            {crewSigUri ? (
                              <TouchableOpacity onPress={() => openSignaturePreview(crewSigUri)} accessibilityRole="button">
                                <Image source={{ uri: crewSigUri }} style={styles.arrivalSignaturePreview} resizeMode="contain" />
                                <Text style={styles.signatureHint}>
                                  Firma jefe de cuadrilla{op.crew_leader_name ? ` · ${op.crew_leader_name}` : ''} · Toca para ampliar
                                </Text>
                              </TouchableOpacity>
                            ) : op.crew_leader_signature_blob_path ? (
                              <Text style={styles.historyObservations}>Firma jefe de cuadrilla registrada.</Text>
                            ) : null}
                            {isWarehouseOp && managerSigUri ? (
                              <TouchableOpacity onPress={() => openSignaturePreview(managerSigUri)} accessibilityRole="button">
                                <Image source={{ uri: managerSigUri }} style={styles.arrivalSignaturePreview} resizeMode="contain" />
                                <Text style={styles.signatureHint}>
                                  Firma encargado de bodega{op.warehouse_manager_name ? ` · ${op.warehouse_manager_name}` : ''} · Toca para ampliar
                                </Text>
                              </TouchableOpacity>
                            ) : isWarehouseOp && op.warehouse_manager_signature_blob_path ? (
                              <Text style={styles.historyObservations}>Firma encargado de bodega registrada.</Text>
                            ) : null}
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <Text style={styles.packagesTitle}>Bultos ({packages.length})</Text>
          </>
        }
        renderItem={({ item, index }) => {
          const preview = packagePreviews[item.id] || { items: [], photos: [] };
          const visibleItems = preview.items.slice(0, 3);
          const visiblePhotos = preview.photos.slice(0, 3);
          return (
            <TouchableOpacity
              style={styles.packageCard}
              onPress={() => navigation.navigate('PackageDetail', { packageId: item.id, packingListLocalId: localId })}
              accessibilityRole="button"
            >
              <View style={styles.packageHeader}>
                <Text style={styles.packageTitle}>Bulto {index + 1}</Text>
                <Text style={styles.packageBarcode} numberOfLines={1}>{item.barcode || 'SIN CODIGO'}</Text>
              </View>
              {(!item.barcode || item.barcode_state === 'MISSING') && (
                <View style={styles.missingBarcodeTag}>
                  <Text style={styles.missingBarcodeText}>Codigo pendiente</Text>
                </View>
              )}
              <View style={styles.packageSummaryRow}>
                <Ionicons name="list-outline" size={15} color="#6b7280" />
                <Text style={styles.packageSummaryLabel}>Contenido ({preview.items.length})</Text>
              </View>
              {visibleItems.length ? visibleItems.map(content => (
                <View key={content.id} style={styles.contentRow}>
                  <Text style={styles.contentName} numberOfLines={1}>{itemName(content)}</Text>
                  <Text style={styles.contentQuantity}>× {content.quantity}</Text>
                </View>
              )) : <Text style={styles.noContents}>Sin articulos registrados</Text>}
              {preview.items.length > visibleItems.length && (
                <Text style={styles.moreContents}>+{preview.items.length - visibleItems.length} articulos mas</Text>
              )}
              {preview.photos.length > 0 && (
                <View style={styles.photoSummary}>
                  <View style={styles.packageSummaryRow}>
                    <Ionicons name="images-outline" size={15} color="#6b7280" />
                    <Text style={styles.packageSummaryLabel}>Fotos ({preview.photos.length})</Text>
                  </View>
                  <View style={styles.photoStrip}>
                    {visiblePhotos.map(photo => {
                      const uri = (photo.server_id ? remotePhotoUrls[photo.server_id] : null)
                        || (photo.blob_path ? remotePhotoUrls[photo.blob_path] : null)
                        || remotePhotoUrls[photo.id]
                        || photo.local_path;
                      return uri ? (
                        <Image key={photo.id} source={{ uri }} style={styles.photoThumbnail} />
                      ) : (
                        <View key={photo.id} style={styles.photoPlaceholder}>
                          <Ionicons name="image-outline" size={18} color="#6b7280" />
                        </View>
                      );
                    })}
                    {preview.photos.length > visiblePhotos.length && (
                      <View style={styles.photoMore}>
                        <Text style={styles.photoMoreText}>+{preview.photos.length - visiblePhotos.length}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>Aún no hay bultos. Escanea uno para comenzar.</Text>
        }
      />

      <Modal visible={showSignatureModal} transparent animationType="fade" onRequestClose={() => { setShowSignatureModal(false); setSelectedSignatureUri(null); }}>
        <View style={styles.signatureModalBackdrop}>
          <TouchableOpacity style={styles.signatureModalCloseArea} onPress={() => { setShowSignatureModal(false); setSelectedSignatureUri(null); }} accessibilityRole="button" />
          {selectedSignatureUri && (
            <View style={styles.signatureModalCard}>
              <Image source={{ uri: selectedSignatureUri }} style={styles.signatureModalImage} resizeMode="contain" />
              <TouchableOpacity style={styles.signatureModalCloseBtn} onPress={() => { setShowSignatureModal(false); setSelectedSignatureUri(null); }} accessibilityRole="button">
                <Text style={styles.signatureModalCloseText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      <Modal visible={showOptionsModal} transparent animationType="fade" onRequestClose={() => setShowOptionsModal(false)}>
        <View style={styles.optionsBackdrop}>
          <TouchableOpacity style={styles.optionsDismiss} onPress={() => setShowOptionsModal(false)} accessibilityRole="button" />
          <View style={styles.optionsSheet}>
            <Text style={styles.optionsTitle}>Opciones</Text>
            {[
              { label: 'Ingreso a camion', icon: 'bus-outline' as const, operationType: 'INGRESS_TRUCK' as const },
              { label: 'Viaje a bodega', icon: 'trail-sign-outline' as const, operationType: null },
              { label: 'Ingreso a bodega', icon: 'business-outline' as const, operationType: 'INGRESS_WAREHOUSE' as const },
              { label: 'Extraccion de bodega', icon: 'cube-outline' as const, operationType: 'EGRESS_WAREHOUSE' as const },
            ].map(option => {
              const available = option.operationType != null && isClosedLike(packingList) && !!packingList?.server_id;
              return (
                <TouchableOpacity
                  key={option.label}
                  style={styles.optionRow}
                  onPress={() => {
                    setShowOptionsModal(false);
                    if (!option.operationType) {
                      Alert.alert(option.label, 'Proximamente. Esta opcion aun no modifica datos.');
                      return;
                    }
                    if (!available) {
                      Alert.alert(option.label, 'Esta accion solo esta disponible cuando la lista de empaque esta completada.');
                      return;
                    }
                    navigation.navigate('IngressEgress', {
                      packingListLocalId: localId,
                      serverId: packingList!.server_id!,
                      operationType: option.operationType,
                    });
                  }}
                  accessibilityRole="button"
                >
                  <Ionicons name={option.icon} size={21} color="#1769aa" />
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  {!option.operationType && <Text style={styles.optionComingSoon}>Proximamente</Text>}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.optionsClose} onPress={() => setShowOptionsModal(false)} accessibilityRole="button">
              <Text style={styles.optionsCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
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
  listContent: { paddingBottom: 16 },
  toolbar: { flexDirection: 'row', padding: 12, gap: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  clientPanel: { backgroundColor: '#fff', padding: 14, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  clientName: { color: '#111827', fontSize: 16, fontWeight: '700' },
  clientMeta: { color: '#6b7280', fontSize: 12, marginTop: 2, marginBottom: 8 },
  clientValue: { color: '#374151', fontSize: 13, lineHeight: 19 },
  locationSource: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  locationSourceExact: { color: '#1e8e3e' },
  locationSourceAddress: { color: '#8a5a00' },
  clientActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  packageLocationBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#e8f0fe',
    marginHorizontal: 12, marginTop: 8, padding: 10, borderRadius: 8,
  },
  packageLocationText: { fontSize: 13, fontWeight: '700', color: '#1769aa', flexShrink: 1 },
  clientAction: { minHeight: 42, flex: 1, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#b8cbe0', borderRadius: 8 },
  clientActionText: { color: '#1769aa', fontWeight: '700' },
  addButton: { flex: 1, backgroundColor: '#1a73e8', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  optionsButton: { width: 48, minHeight: 44, borderWidth: 1, borderColor: '#b8cbe0', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  progressButton: { margin: 12, marginBottom: 0, minHeight: 48, backgroundColor: '#1769aa', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  progressButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryProgressButton: { marginHorizontal: 12, marginTop: 8, minHeight: 44, backgroundColor: '#374151', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  secondaryProgressButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  disabledButton: { opacity: 0.4 },
  historyPanel: { backgroundColor: '#fff', margin: 12, marginBottom: 0, borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#e5e7eb' },
  historyTitleRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 7 },
  historyTitleRowExpanded: { marginBottom: 6 },
  historyTitle: { flex: 1, color: '#1f2937', fontSize: 14, fontWeight: '700' },
  historyCount: { color: '#1769aa', backgroundColor: '#e8f0fe', borderRadius: 8, minWidth: 24, paddingHorizontal: 6, paddingVertical: 2, textAlign: 'center', fontSize: 11, fontWeight: '700' },
  historyEvent: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#eef0f2' },
  historyIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8f0fe' },
  historyContent: { flex: 1 },
  historyEventTitle: { color: '#1f2937', fontSize: 13, fontWeight: '700' },
  historyMeta: { color: '#6b7280', fontSize: 11, marginTop: 2 },
  historyObservations: { color: '#374151', fontSize: 12, lineHeight: 18, marginTop: 7 },
  historyPending: { color: '#8a5a00', fontSize: 11, fontWeight: '700', marginTop: 4 },
  arrivalSignaturePreview: { width: '100%', height: 100, backgroundColor: '#f7f8fa', borderRadius: 8, borderWidth: 1, borderColor: '#e0e0e0', marginTop: 8 },
  completionHistoryDetail: { marginTop: 8 },
  signatureStatusMuted: { fontSize: 13, color: '#666' },
  signatureNote: { fontSize: 12, color: '#666', marginTop: 6 },
  satisfactionRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 9 },
  satisfactionText: { color: '#374151', fontSize: 12, fontWeight: '600' },
  signatureHint: { fontSize: 12, color: '#1a73e8', marginTop: 8 },
  packagesTitle: { color: '#6b7280', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginHorizontal: 16, marginTop: 18, marginBottom: 8 },
  packageCard: { backgroundColor: '#fff', borderRadius: 8, padding: 14, marginHorizontal: 16, marginBottom: 10, elevation: 1, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 3 },
  packageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  packageTitle: { color: '#1f2937', fontSize: 15, fontWeight: '700' },
  packageBarcode: { flexShrink: 1, maxWidth: '58%', color: '#6b7280', fontSize: 10, fontFamily: 'monospace', textAlign: 'right' },
  missingBarcodeTag: { alignSelf: 'flex-start', marginBottom: 8, backgroundColor: '#fff4e5', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  missingBarcodeText: { fontSize: 11, color: '#b45309', fontWeight: '700' },
  packageSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  packageSummaryLabel: { color: '#6b7280', fontSize: 11, fontWeight: '700' },
  contentRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5, paddingLeft: 20 },
  contentName: { flex: 1, color: '#374151', fontSize: 12 },
  contentQuantity: { color: '#4b5563', fontSize: 12, fontWeight: '700' },
  noContents: { color: '#9ca3af', fontSize: 12, marginTop: 5, paddingLeft: 20 },
  moreContents: { color: '#1769aa', fontSize: 11, fontWeight: '700', marginTop: 5, paddingLeft: 20 },
  photoSummary: { marginTop: 11, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#eef0f2' },
  photoStrip: { flexDirection: 'row', gap: 7, marginTop: 7 },
  photoThumbnail: { width: 48, height: 48, borderRadius: 6, backgroundColor: '#eef0f2' },
  photoPlaceholder: { width: 48, height: 48, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef0f2' },
  photoMore: { width: 48, height: 48, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8f0fe' },
  photoMoreText: { color: '#1769aa', fontSize: 12, fontWeight: '700' },
  empty: { textAlign: 'center', color: '#aaa', marginTop: 48, fontSize: 15, lineHeight: 22 },
  signatureModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  signatureModalCloseArea: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  signatureModalCard: { width: '100%', maxHeight: '85%', backgroundColor: '#111', borderRadius: 10, overflow: 'hidden' },
  signatureModalImage: { width: '100%', height: 320, backgroundColor: '#fff' },
  signatureModalCloseBtn: { alignSelf: 'flex-end', margin: 12, backgroundColor: '#1a73e8', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  signatureModalCloseText: { color: '#fff', fontWeight: '700' },
  optionsBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.38)', justifyContent: 'flex-end' },
  optionsDismiss: { position: 'absolute', inset: 0 },
  optionsSheet: { backgroundColor: '#fff', padding: 18, paddingBottom: 28, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  optionsTitle: { color: '#111827', fontSize: 18, fontWeight: '700', marginBottom: 10 },
  optionRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#eef0f2' },
  optionLabel: { flex: 1, color: '#1f2937', fontSize: 15, fontWeight: '600' },
  optionComingSoon: { color: '#6b7280', fontSize: 12 },
  optionsClose: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  optionsCloseText: { color: '#1769aa', fontWeight: '700' },
});
