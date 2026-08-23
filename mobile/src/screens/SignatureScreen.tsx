import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  Alert, ActivityIndicator, Switch, TextInput, ScrollView, Image, Modal,
} from 'react-native';
import SignatureCanvas from 'react-native-signature-canvas';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Network from 'expo-network';

import { RootStackParamList } from '../navigation/types';
import { getDeviceId } from '../auth/deviceId';
import { api, uploadSourceToAzure } from '../services/api';
import {
  getPackagesForList,
  getItemsForPackage,
  getPhotosForPackage,
  getItemTypeCache,
  PackageRow,
  PackageItemRow,
  PackagePhotoRow,
  ItemTypeCacheRow,
  setPackingListComplete,
  setPackingListClosed,
  updatePackingListSyncState,
} from '../db/queries';

type Props = NativeStackScreenProps<RootStackParamList, 'Signature'>;

export default function SignatureScreen({ route, navigation }: Props) {
  const { packingListLocalId, serverId } = route.params;
  const signatureRef = useRef<SignatureCanvas>(null);

  const [declined, setDeclined] = useState(false);
  const [declineNote, setDeclineNote] = useState('');
  const [hasSignature, setHasSignature] = useState(false);
  const [reviewLanguage, setReviewLanguage] = useState<'ES' | 'EN'>('ES');
  const [submitting, setSubmitting] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
  const [loadingReview, setLoadingReview] = useState(true);
  const [reviewPackages, setReviewPackages] = useState<Array<{
    pkg: PackageRow;
    items: PackageItemRow[];
    photos: PackagePhotoRow[];
  }>>([]);
  const [itemTypes, setItemTypes] = useState<ItemTypeCacheRow[]>([]);

  const loadReviewData = useCallback(async () => {
    setLoadingReview(true);
    try {
      const [packages, types] = await Promise.all([
        getPackagesForList(packingListLocalId),
        getItemTypeCache(),
      ]);

      const packageData = await Promise.all(
        packages.map(async (pkg) => {
          const [items, photos] = await Promise.all([
            getItemsForPackage(pkg.id),
            getPhotosForPackage(pkg.id),
          ]);
          return { pkg, items, photos };
        })
      );

      setItemTypes(types);
      setReviewPackages(packageData);
    } finally {
      setLoadingReview(false);
    }
  }, [packingListLocalId]);

  useEffect(() => {
    loadReviewData();
  }, [loadReviewData]);

  const resolveItemName = (item: PackageItemRow) => {
    if (item.custom_name) return item.custom_name;
    if (!item.packing_item_type_id) return '—';
    const type = itemTypes.find((t) => t.id === item.packing_item_type_id);
    if (!type) return item.packing_item_type_id;
    return reviewLanguage === 'EN' ? type.name_en : type.name_es;
  };

  const handleSubmit = async () => {
    if (!declined) {
      if (!hasSignature) {
        setShowSignatureModal(true);
        return;
      }
      setSubmitting(true);
      signatureRef.current?.readSignature();
      return;
    }

    if (declined && !declineNote.trim()) {
      Alert.alert('Nota requerida', 'Indica por qué el cliente declinó firmar.');
      return;
    }

    setSubmitting(true);
    try {
      const deviceId = await getDeviceId();
      const result = await completeWithSignature(
        reviewLanguage,
        null,
        null,
        true,
        declineNote.trim(),
        deviceId,
        serverId,
        packingListLocalId
      );
      if (result.closed) {
        Alert.alert('Lista cerrada', 'La lista se completó y quedó cerrada.');
      } else {
        Alert.alert('Pendiente de cierre', 'La lista quedó pendiente. Se cerrará automáticamente al sincronizar.');
      }
      navigation.goBack();
    } catch (err: unknown) {
      const msg = normalizeSyncError(err);
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const onSignatureRead = async (signature: string) => {
    const deviceId = await getDeviceId();
    setSubmitting(true);
    try {
      let blobPath: string | null = null;
      const net = await Network.getNetworkStateAsync();
      if (net.isConnected) {
        try {
          const token = await api.getSasUploadToken(serverId, `signature-${Date.now()}.png`);
          await uploadSourceToAzure(token.sasUrl, signature, 'image/png');
          blobPath = token.blobPath;
        } catch {
          blobPath = null;
        }
      }

      setShowSignatureModal(false);

      const result = await completeWithSignature(
        reviewLanguage,
        signature,
        blobPath,
        false,
        null,
        deviceId,
        serverId,
        packingListLocalId
      );
      if (result.closed) {
        Alert.alert('Lista cerrada', 'La lista se completó y quedó cerrada.');
      } else {
        Alert.alert('Pendiente de cierre', 'La lista quedó pendiente. Se cerrará automáticamente al sincronizar.');
      }
      navigation.goBack();
    } catch (err: unknown) {
      const msg = normalizeSyncError(err);
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = () => {
    signatureRef.current?.clearSignature();
    setHasSignature(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Firma del Cliente</Text>

        <View style={styles.languageRow}>
          <Text style={styles.declinedLabel}>Idioma de revision</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={[styles.langBtn, reviewLanguage === 'ES' && styles.langBtnActive]}
              onPress={() => setReviewLanguage('ES')}
              accessibilityRole="button"
            >
              <Text style={[styles.langBtnText, reviewLanguage === 'ES' && styles.langBtnTextActive]}>ES</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langBtn, reviewLanguage === 'EN' && styles.langBtnActive]}
              onPress={() => setReviewLanguage('EN')}
              accessibilityRole="button"
            >
              <Text style={[styles.langBtnText, reviewLanguage === 'EN' && styles.langBtnTextActive]}>EN</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.reviewContainer}>
          <Text style={styles.reviewTitle}>Revision de contenido</Text>
          {loadingReview ? (
            <View style={styles.reviewLoading}>
              <ActivityIndicator size="small" color="#1a73e8" />
              <Text style={styles.reviewLoadingText}>Cargando contenido…</Text>
            </View>
          ) : reviewPackages.length === 0 ? (
            <Text style={styles.reviewEmpty}>No hay bultos registrados en esta lista.</Text>
          ) : (
            reviewPackages.map(({ pkg, items, photos }, pkgIndex) => (
              <View key={pkg.id} style={styles.packageCard}>
                <View style={styles.packageHeader}>
                  <Text style={styles.packageTitle}>Bulto {pkgIndex + 1}</Text>
                  <Text style={styles.packageBarcode}>{pkg.barcode}</Text>
                </View>

                {items.length > 0 ? (
                  items.map((item) => (
                    <View key={item.id} style={styles.itemRow}>
                      <Text style={styles.itemText}>
                        {resolveItemName(item)} ×{item.quantity}
                      </Text>
                      {item.note ? <Text style={styles.itemNote}>({item.note})</Text> : null}
                    </View>
                  ))
                ) : (
                  <Text style={styles.noItemsText}>Sin articulos en este bulto.</Text>
                )}

                {photos.length > 0 && (
                  <View style={styles.photosSection}>
                    <Text style={styles.photosTitle}>Fotos ({photos.length})</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
                      {photos.map((photo) => (
                        <View key={photo.id} style={styles.photoBox}>
                          {photo.local_path ? (
                            <TouchableOpacity onPress={() => setSelectedPhotoUri(photo.local_path)} accessibilityRole="button">
                              <Image source={{ uri: photo.local_path }} style={styles.photoThumb} />
                            </TouchableOpacity>
                          ) : (
                            <View style={styles.uploadedPhotoPlaceholder}>
                              <Text style={styles.uploadedPhotoText}>Foto subida</Text>
                            </View>
                          )}
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        {!declined && (
          <View style={styles.signPanelCard}>
            <Text style={styles.signPanelTitle}>Firma del cliente</Text>
            <Text style={styles.signPanelHint}>Usa el panel dedicado para firmar sin interferencia del scroll.</Text>
            <View style={styles.signPanelRow}>
              <Text style={[styles.signState, hasSignature ? styles.signStateOk : styles.signStateMissing]}>
                {hasSignature ? 'Firma capturada' : 'Firma pendiente'}
              </Text>
              <TouchableOpacity
                style={styles.openSignPanelBtn}
                onPress={() => setShowSignatureModal(true)}
                accessibilityRole="button"
              >
                <Text style={styles.openSignPanelBtnText}>{hasSignature ? 'Volver a firmar' : 'Abrir panel de firma'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.declinedRow}>
          <Text style={styles.declinedLabel}>El cliente declinó firmar</Text>
          <Switch value={declined} onValueChange={setDeclined} trackColor={{ true: '#1a73e8' }} />
        </View>

        {declined && (
          <TextInput
            style={styles.noteInput}
            value={declineNote}
            onChangeText={setDeclineNote}
            placeholder="Motivo de rechazo…"
            multiline
          />
        )}

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          accessibilityRole="button"
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Completar Lista</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showSignatureModal} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={styles.signatureModalContainer}>
          <View style={styles.signatureModalHeader}>
            <Text style={styles.signatureModalTitle}>Panel de Firma</Text>
            <TouchableOpacity onPress={() => setShowSignatureModal(false)} accessibilityRole="button">
              <Text style={styles.signatureModalClose}>Cerrar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.signatureModalBody}>
            <SignatureCanvas
              ref={signatureRef}
              onOK={onSignatureRead}
              onBegin={() => setHasSignature(true)}
              descriptionText=""
              clearText="Limpiar"
              confirmText="Confirmar"
              webStyle={canvasStyle}
            />
          </View>

          <View style={styles.signatureModalFooter}>
            <TouchableOpacity style={styles.clearBtn} onPress={handleClear} accessibilityRole="button">
              <Text style={styles.clearBtnText}>Limpiar Firma</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.captureBtn, submitting && styles.submitBtnDisabled]}
              onPress={() => {
                setSubmitting(true);
                signatureRef.current?.readSignature();
              }}
              disabled={submitting}
              accessibilityRole="button"
            >
              <Text style={styles.captureBtnText}>Usar esta firma</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal visible={!!selectedPhotoUri} transparent animationType="fade" onRequestClose={() => setSelectedPhotoUri(null)}>
        <View style={styles.photoModalBackdrop}>
          <TouchableOpacity style={styles.photoModalCloseArea} onPress={() => setSelectedPhotoUri(null)} accessibilityRole="button" />
          {selectedPhotoUri && (
            <View style={styles.photoModalCard}>
              <Image source={{ uri: selectedPhotoUri }} style={styles.photoModalImage} resizeMode="contain" />
              <TouchableOpacity style={styles.photoModalCloseBtn} onPress={() => setSelectedPhotoUri(null)} accessibilityRole="button">
                <Text style={styles.photoModalCloseText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

async function completeWithSignature(
  reviewLanguage: 'ES' | 'EN',
  signatureLocalPath: string | null,
  signatureBlobPath: string | null,
  signatureDeclined: boolean,
  signatureDeclineNote: string | null,
  deviceId: string,
  serverId: string,
  localId: string
): Promise<{ closed: boolean; pendingReason?: string }> {
  await updatePackingListSyncState(localId, 'COMPLETING');
  await setPackingListComplete(localId, reviewLanguage, signatureLocalPath, signatureBlobPath, signatureDeclined, signatureDeclineNote);

  if (!signatureDeclined && !signatureBlobPath) {
    const pendingReason = 'Firma pendiente de sincronizacion. Se reintentara automaticamente.';
    await updatePackingListSyncState(localId, 'COMPLETE_PENDING_SYNC', {
      syncError: pendingReason,
    });
    return { closed: false, pendingReason };
  }

  try {
    await api.completePackingList(serverId, {
      deviceId,
      reviewLanguage,
      signatureUrl: signatureBlobPath,
      signatureDeclined,
      signatureDeclineNote,
    });
    await setPackingListClosed(localId);
    return { closed: true };
  } catch (err: unknown) {
    const message = normalizeSyncError(err);
    if (/Otro dispositivo tomo el control/i.test(message)) {
      throw new Error(message);
    }
    await updatePackingListSyncState(localId, 'COMPLETE_PENDING_SYNC', {
      syncError: message,
    });
    return { closed: false, pendingReason: message };
  }
}

function normalizeSyncError(err: unknown): string {
  const raw = err instanceof Error ? err.message : 'Error de red';
  if (/Network request failed/i.test(raw)) {
    return 'No se pudo confirmar el cierre por conectividad. Se reintentara automaticamente.';
  }
  if (/Locked by another device/i.test(raw)) {
    return 'Otro dispositivo tomo el control de esta lista.';
  }
  return raw;
}

const canvasStyle = `
  .m-signature-pad { box-shadow: none; border: 1px solid #e0e0e0; border-radius: 8px; }
  .m-signature-pad--body { border: none; }
  .m-signature-pad--footer { display: none; }
  body { background-color: #fff; }
`;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 16 },
  languageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 8, marginBottom: 12 },
  reviewContainer: { backgroundColor: '#fff', borderRadius: 8, padding: 14, marginBottom: 12 },
  reviewTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 10 },
  reviewLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  reviewLoadingText: { color: '#666', fontSize: 13 },
  reviewEmpty: { color: '#888', fontSize: 13 },
  packageCard: { borderWidth: 1, borderColor: '#e6e6e6', borderRadius: 8, padding: 10, marginBottom: 10, backgroundColor: '#fafafa' },
  packageHeader: { marginBottom: 6 },
  packageTitle: { fontSize: 14, fontWeight: '700', color: '#1a73e8' },
  packageBarcode: { fontSize: 12, color: '#555', fontFamily: 'monospace' },
  itemRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 2 },
  itemText: { fontSize: 13, color: '#333' },
  itemNote: { fontSize: 12, color: '#777', fontStyle: 'italic' },
  noItemsText: { fontSize: 12, color: '#888', fontStyle: 'italic' },
  photosSection: { marginTop: 8 },
  photosTitle: { fontSize: 12, fontWeight: '700', color: '#444', marginBottom: 6 },
  photoRow: { gap: 8, paddingRight: 4 },
  photoBox: { width: 74, height: 74, borderRadius: 6, overflow: 'hidden', backgroundColor: '#eef1f4', borderWidth: 1, borderColor: '#d7dde3' },
  photoThumb: { width: '100%', height: '100%' },
  uploadedPhotoPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 4 },
  uploadedPhotoText: { fontSize: 10, color: '#5f6368', textAlign: 'center' },
  signPanelCard: { backgroundColor: '#fff', borderRadius: 8, padding: 14, marginBottom: 12 },
  signPanelTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 4 },
  signPanelHint: { fontSize: 12, color: '#666', marginBottom: 10 },
  signPanelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  signState: { fontSize: 12, fontWeight: '700' },
  signStateOk: { color: '#1e8e3e' },
  signStateMissing: { color: '#b06000' },
  openSignPanelBtn: { backgroundColor: '#1a73e8', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  openSignPanelBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  langBtn: { borderWidth: 1, borderColor: '#cfd8dc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#fff' },
  langBtnActive: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  langBtnText: { fontWeight: '700', color: '#1a73e8', fontSize: 12 },
  langBtnTextActive: { color: '#fff' },
  canvasContainer: { backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden', marginBottom: 16, height: 300 },
  clearBtn: { padding: 10, alignItems: 'center', backgroundColor: '#f5f5f5' },
  clearBtnText: { color: '#888', fontSize: 13 },
  signatureModalContainer: { flex: 1, backgroundColor: '#fff' },
  signatureModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e6e6e6' },
  signatureModalTitle: { fontSize: 17, fontWeight: '700', color: '#222' },
  signatureModalClose: { fontSize: 14, color: '#1a73e8', fontWeight: '700' },
  signatureModalBody: { flex: 1, padding: 16 },
  signatureModalFooter: { padding: 16, borderTopWidth: 1, borderTopColor: '#e6e6e6', gap: 10 },
  captureBtn: { backgroundColor: '#1a73e8', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  captureBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  photoModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  photoModalCloseArea: { position: 'absolute', width: '100%', height: '100%' },
  photoModalCard: { width: '92%', maxHeight: '85%', backgroundColor: '#111', borderRadius: 10, overflow: 'hidden' },
  photoModalImage: { width: '100%', height: 420, backgroundColor: '#111' },
  photoModalCloseBtn: { paddingVertical: 12, alignItems: 'center', backgroundColor: '#1f1f1f' },
  photoModalCloseText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  declinedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 8, marginBottom: 12 },
  declinedLabel: { fontSize: 15, color: '#333' },
  noteInput: { backgroundColor: '#fff', borderRadius: 8, padding: 12, fontSize: 15, height: 100, textAlignVertical: 'top', marginBottom: 16, borderWidth: 1, borderColor: '#e0e0e0' },
  submitBtn: { backgroundColor: '#34a853', borderRadius: 8, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
