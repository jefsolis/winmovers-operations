import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, StyleSheet,
  SafeAreaView, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Crypto from 'expo-crypto';
import * as Network from 'expo-network';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/types';
import {
  getPhotosForPackage, getPackingList, upsertPackagePhoto, updatePackingListSyncState,
  reconcilePackagePhotos, markPackagePhotoDeleted, PackagePhotoRow,
} from '../db/queries';
import { api, uploadPhotoToAzure } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Photo'>;

export default function PhotoScreen({ route }: Props) {
  const { packageId, packingListLocalId } = route.params;
  const [photos, setPhotos] = useState<PackagePhotoRow[]>([]);
  const [remoteUrlsById, setRemoteUrlsById] = useState<Record<string, string>>({});
  const [isReadOnly, setIsReadOnly] = useState(false);

  const loadPhotos = useCallback(async () => {
    try {
      const pl = await getPackingList(packingListLocalId);
      const closedLike =
        pl?.status === 'CLOSED' ||
        pl?.status === 'COMPLETE' ||
        pl?.status === 'COMPLETE_PENDING_SYNC' ||
        pl?.sync_state === 'CLOSED' ||
        pl?.sync_state === 'COMPLETING' ||
        pl?.sync_state === 'COMPLETE_PENDING_SYNC';
      setIsReadOnly(!!closedLike);
      if (!pl?.server_id) {
        setRemoteUrlsById({});
        setPhotos(await getPhotosForPackage(packageId));
        return;
      }

      const detail = await api.getPackingList(pl.server_id);
      const map: Record<string, string> = {};
      for (const pkg of detail.packages) {
        if (pkg.id === packageId) await reconcilePackagePhotos(pkg.id, pkg.photos);
        for (const photo of pkg.photos) {
          if (photo.downloadUrl) {
            map[photo.id] = photo.downloadUrl;
            map[photo.blobPath] = photo.downloadUrl;
          }
        }
      }
      setRemoteUrlsById(map);
      setPhotos(await getPhotosForPackage(packageId));
    } catch {
      setRemoteUrlsById({});
      setPhotos(await getPhotosForPackage(packageId));
    }
  }, [packageId, packingListLocalId]);

  useEffect(() => { loadPhotos(); }, [loadPhotos]);

  const takeOrPickPhoto = async (useCamera: boolean) => {
    if (isReadOnly) {
      Alert.alert('Lista no editable', 'Esta lista ya fue completada o esta en proceso de cierre.');
      return;
    }
    // T055: Storage guard — check free space before launching camera
    if (useCamera) {
      const freeDiskStorage = await FileSystem.getFreeDiskStorageAsync();
      const minRequired = 100 * 1024 * 1024; // 100 MB
      if (freeDiskStorage < minRequired) {
        Alert.alert(
          'Almacenamiento insuficiente',
          'Se necesitan al menos 100 MB de espacio libre para tomar fotos. Libera espacio en tu dispositivo e intenta de nuevo.'
        );
        return;
      }
    }

    let result;
    if (useCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permiso denegado', 'Se necesita acceso a la cámara.');
        return;
      }
      result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsMultipleSelection: false });
    }

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    const id = await generateUUID();
    const row: PackagePhotoRow = {
      id,
      server_id: null,
      package_id: packageId,
      local_path: asset.uri,
      blob_path: null,
      upload_state: 'PENDING',
    };
    await upsertPackagePhoto(row);
    await updatePackingListSyncState(packingListLocalId, 'LOCAL', { syncError: null });
    await loadPhotos();

    // Attempt immediate upload if online
    tryUploadPhoto(id, asset.uri);
  };

  const tryUploadPhoto = async (photoId: string, localUri: string) => {
    const net = await Network.getNetworkStateAsync();
    if (!net.isConnected) return;

    try {
      // We need the server_id of the packing list — pass packingListLocalId
      // and resolve the server_id from the DB
      const { getPackingList } = await import('../db/queries');
      const pl = await getPackingList(packingListLocalId);
      if (!pl?.server_id) return;

      const filename = localUri.split('/').pop() ?? `${photoId}.jpg`;
      const { sasUrl, blobPath } = await api.getSasUploadToken(pl.server_id, filename);

      await uploadPhotoToAzure(sasUrl, localUri);

      const { updatePhotoUploadState } = await import('../db/queries');
      await updatePhotoUploadState(photoId, 'UPLOADED', blobPath);
      await updatePackingListSyncState(packingListLocalId, 'LOCAL', { syncError: null });
      await loadPhotos();
    } catch {
      const { updatePhotoUploadState } = await import('../db/queries');
      await updatePhotoUploadState(photoId, 'ERROR');
      await updatePackingListSyncState(packingListLocalId, 'ERROR', {
        syncError: 'No se pudo subir una foto. Se reintentara automaticamente.',
      });
    }
  };

  const handleDeletePhoto = (photo: PackagePhotoRow) => {
    if (isReadOnly) return;
    Alert.alert(
      'Eliminar foto',
      'La foto se eliminara de este bulto y del servidor en la proxima sincronizacion.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await markPackagePhotoDeleted(photo.id);
            await updatePackingListSyncState(packingListLocalId, 'LOCAL', { syncError: null });
            await loadPhotos();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.btn, isReadOnly && styles.disabledBtn]}
          onPress={() => takeOrPickPhoto(true)}
          disabled={isReadOnly}
          accessibilityRole="button"
        >
          <Text style={styles.btnText}>📷 Cámara</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.galleryBtn, isReadOnly && styles.disabledBtn]}
          onPress={() => takeOrPickPhoto(false)}
          disabled={isReadOnly}
          accessibilityRole="button"
        >
          <Text style={[styles.btnText, styles.galleryBtnText]}>🖼 Galería</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={photos}
        numColumns={2}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 8 }}
        renderItem={({ item }) => {
          const photoUri = (item.server_id ? remoteUrlsById[item.server_id] : null)
            || (item.blob_path ? remoteUrlsById[item.blob_path] : null)
            || remoteUrlsById[item.id]
            || item.local_path;
          return (
          <View style={styles.photoCard}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photo} />
            ) : (
              <View style={styles.photoUnavailable}>
                <Ionicons name="image-outline" size={30} color="#8b949e" />
                <Text style={styles.photoUnavailableText}>Imagen no disponible</Text>
              </View>
            )}
            <View style={[styles.badge, item.upload_state === 'UPLOADED' ? styles.uploaded : item.upload_state === 'ERROR' ? styles.errored : styles.pending]}>
              <Text style={styles.badgeText}>
                {item.upload_state === 'UPLOADED' ? '✓' : item.upload_state === 'ERROR' ? '✗' : '⏳'}
              </Text>
            </View>
            {!isReadOnly && (
              <TouchableOpacity
                style={styles.deletePhotoBtn}
                onPress={() => handleDeletePhoto(item)}
                accessibilityRole="button"
                accessibilityLabel="Eliminar foto"
              >
                <Ionicons name="trash-outline" size={18} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>{isReadOnly ? 'Este bulto no tiene fotos.' : 'Sin fotos aún. Usa la cámara o la galería.'}</Text>}
      />
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
  toolbar: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  btn: { flex: 1, backgroundColor: '#1a73e8', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  galleryBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#1a73e8' },
  galleryBtnText: { color: '#1a73e8' },
  disabledBtn: { opacity: 0.45 },
  photoCard: { flex: 1, margin: 4, backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden', aspectRatio: 1 },
  photo: { width: '100%', height: '100%' },
  photoUnavailable: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12 },
  photoUnavailableText: { color: '#8b949e', fontSize: 11, textAlign: 'center' },
  deletePhotoBtn: { position: 'absolute', left: 6, bottom: 6, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(176, 34, 34, 0.92)', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 4, right: 4, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  uploaded: { backgroundColor: '#34a853' },
  errored: { backgroundColor: '#d32f2f' },
  pending: { backgroundColor: '#f57c00' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  empty: { textAlign: 'center', color: '#aaa', marginTop: 48, fontSize: 15 },
});
