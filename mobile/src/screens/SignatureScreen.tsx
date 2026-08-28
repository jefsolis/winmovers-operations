import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  Alert, ActivityIndicator, Switch, TextInput, ScrollView, Image, Modal,
} from 'react-native';
import SignatureCanvas from 'react-native-signature-canvas';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Network from 'expo-network';
import * as Crypto from 'expo-crypto';

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
  getMissingBarcodeCount,
  setStageLocation,
} from '../db/queries';
import StarRating from '../components/StarRating';
import { captureStageLocation } from '../services/location';

type Props = NativeStackScreenProps<RootStackParamList, 'Signature'>;

const COPY = {
  ES: {
    title: 'Revision y firma del cliente', language: 'Idioma de revision', review: 'Revision de contenido',
    loading: 'Cargando contenido...', empty: 'No hay bultos registrados en esta lista.', box: 'Bulto', noItems: 'Sin articulos en este bulto.',
    photos: 'Fotos', uploaded: 'Foto subida', signature: 'Firma del cliente', signHint: 'La firma es el ultimo paso y enviara el trabajo completado.',
    captured: 'Firma capturada', pending: 'Firma pendiente', resign: 'Volver a firmar', openSign: 'Abrir panel de firma', declined: 'El cliente declino firmar',
    declinePlaceholder: 'Motivo de rechazo...', observations: 'Observaciones de finalizacion', observationsPlaceholder: 'Observaciones sobre el servicio completado',
    satisfaction: 'Satisfaccion general', ratingRequired: 'Selecciona una calificacion de 1 a 5 estrellas.', complete: 'Completar trabajo',
    noteTitle: 'Nota requerida', noteMessage: 'Indica por que el cliente declino firmar.', closedTitle: 'Lista cerrada', closedMessage: 'La lista se completo y quedo cerrada.',
    pendingTitle: 'Pendiente de cierre', pendingMessage: 'La lista se cerrara automaticamente al sincronizar.', error: 'Error', modalTitle: 'Panel de firma', close: 'Cerrar', clear: 'Limpiar firma', useSignature: 'Usar esta firma',
    crewSignature: 'Firma del jefe de cuadrilla', crewSignHint: 'El jefe de cuadrilla debe firmar antes de completar el trabajo.',
    crewLeaderName: 'Nombre del jefe de cuadrilla (opcional)', crewLeaderNamePlaceholder: 'Nombre del jefe de cuadrilla',
    crewRequired: 'La firma del jefe de cuadrilla es obligatoria para completar el trabajo.',
    clientRequired: 'La firma del cliente es obligatoria para completar el trabajo.',
    barcodeBlockedTitle: 'Bultos sin codigo de barras',
    barcodeBlockedMessage: (count: number) => `Hay ${count} bulto(s) sin codigo de barras. Asigna los codigos pendientes antes de completar el trabajo.`,
  },
  EN: {
    title: 'Client review and signature', language: 'Review language', review: 'Content review',
    loading: 'Loading content...', empty: 'There are no packages in this packing list.', box: 'Package', noItems: 'No items in this package.',
    photos: 'Photos', uploaded: 'Uploaded photo', signature: 'Client signature', signHint: 'Signing is the final step and will submit the completed work.',
    captured: 'Signature captured', pending: 'Signature pending', resign: 'Sign again', openSign: 'Open signature panel', declined: 'The client declined to sign',
    declinePlaceholder: 'Reason for declining...', observations: 'Completion observations', observationsPlaceholder: 'Observations about the completed service',
    satisfaction: 'Overall satisfaction', ratingRequired: 'Select a rating from 1 to 5 stars.', complete: 'Complete work',
    noteTitle: 'Note required', noteMessage: 'Enter why the client declined to sign.', closedTitle: 'Packing list closed', closedMessage: 'The packing list was completed and closed.',
    pendingTitle: 'Completion pending', pendingMessage: 'The packing list will close automatically after synchronization.', error: 'Error', modalTitle: 'Signature panel', close: 'Close', clear: 'Clear signature', useSignature: 'Use this signature',
    crewSignature: 'Crew leader signature', crewSignHint: 'The crew leader must sign before the work can be completed.',
    crewLeaderName: 'Crew leader name (optional)', crewLeaderNamePlaceholder: 'Crew leader name',
    crewRequired: 'The crew leader signature is required to complete the work.',
    clientRequired: 'The client signature is required to complete the work.',
    barcodeBlockedTitle: 'Boxes without barcode',
    barcodeBlockedMessage: (count: number) => `There are ${count} box(es) without a barcode. Assign the pending barcodes before completing the work.`,
  },
} as const;

export default function SignatureScreen({ route, navigation }: Props) {
  const { packingListLocalId, serverId } = route.params;
  const signatureRef = useRef<React.ElementRef<typeof SignatureCanvas>>(null);

  const [declined, setDeclined] = useState(false);
  const [declineNote, setDeclineNote] = useState('');
  const [hasSignature, setHasSignature] = useState(false);
  const [clientSignature, setClientSignature] = useState<string | null>(null);
  const [crewSignature, setCrewSignature] = useState<string | null>(null);
  const [crewLeaderName, setCrewLeaderName] = useState('');
  const [activeSigner, setActiveSigner] = useState<'CLIENT' | 'CREW'>('CLIENT');
  const [reviewLanguage, setReviewLanguage] = useState<'ES' | 'EN'>('ES');
  const [submitting, setSubmitting] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [completionObservations, setCompletionObservations] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
  const [remotePhotoUrls, setRemotePhotoUrls] = useState<Record<string, string>>({});
  const [loadingReview, setLoadingReview] = useState(true);
  const [reviewPackages, setReviewPackages] = useState<Array<{
    pkg: PackageRow;
    items: PackageItemRow[];
    photos: PackagePhotoRow[];
  }>>([]);
  const [itemTypes, setItemTypes] = useState<ItemTypeCacheRow[]>([]);
  const copy = COPY[reviewLanguage];

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

      try {
        const detail = await api.getPackingList(serverId);
        const urls: Record<string, string> = {};
        for (const pkg of detail.packages) {
          for (const photo of pkg.photos) {
            if (photo.downloadUrl) urls[photo.id] = photo.downloadUrl;
          }
        }
        setRemotePhotoUrls(urls);
      } catch {
        setRemotePhotoUrls({});
      }
    } finally {
      setLoadingReview(false);
    }
  }, [packingListLocalId, serverId]);

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
    if (!rating) {
      Alert.alert(copy.satisfaction, copy.ratingRequired);
      return;
    }
    const missingBarcodes = await getMissingBarcodeCount(packingListLocalId);
    if (missingBarcodes > 0) {
      Alert.alert(copy.barcodeBlockedTitle, copy.barcodeBlockedMessage(missingBarcodes));
      return;
    }
    if (!crewSignature) {
      Alert.alert(copy.crewSignature, copy.crewRequired);
      return;
    }
    if (declined && !declineNote.trim()) {
      Alert.alert(copy.noteTitle, copy.noteMessage);
      return;
    }
    if (!declined && !clientSignature) {
      Alert.alert(copy.signature, copy.clientRequired);
      return;
    }

    setSubmitting(true);
    try {
      const deviceId = await getDeviceId();
      let clientBlobPath: string | null = null;
      if (!declined && clientSignature) {
        const net = await Network.getNetworkStateAsync();
        if (net.isConnected) {
          try {
            const token = await api.getSasUploadToken(serverId, `signature-${Date.now()}.png`);
            await uploadSourceToAzure(token.sasUrl, clientSignature, 'image/png');
            clientBlobPath = token.blobPath;
          } catch {
            clientBlobPath = null;
          }
        }
      }

      const result = await completeWithSignature(
        reviewLanguage,
        declined ? null : clientSignature,
        clientBlobPath,
        declined,
        declined ? declineNote.trim() : null,
        deviceId,
        serverId,
        packingListLocalId
        , completionObservations.trim() || null
        , rating
        , crewSignature
        , crewLeaderName.trim() || null
      );
      if (result.closed) {
        Alert.alert(copy.closedTitle, copy.closedMessage);
      } else {
        Alert.alert(copy.pendingTitle, copy.pendingMessage);
      }
      navigation.goBack();
    } catch (err: unknown) {
      const msg = normalizeSyncError(err);
      Alert.alert(copy.error, msg);
    } finally {
      setSubmitting(false);
    }
  };

  const openSignaturePanel = () => {
    if (!rating) {
      Alert.alert(copy.satisfaction, copy.ratingRequired);
      return;
    }
    setActiveSigner('CLIENT');
    setHasSignature(false);
    setShowSignatureModal(true);
  };

  const openCrewSignaturePanel = () => {
    setActiveSigner('CREW');
    setHasSignature(false);
    setShowSignatureModal(true);
  };

  const onSignatureRead = (signature: string) => {
    if (activeSigner === 'CREW') setCrewSignature(signature);
    else setClientSignature(signature);
    setShowSignatureModal(false);
  };

  const handleClear = () => {
    signatureRef.current?.clearSignature();
    setHasSignature(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>{copy.title}</Text>

        <View style={styles.languageRow}>
          <Text style={styles.declinedLabel}>{copy.language}</Text>
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
          <Text style={styles.reviewTitle}>{copy.review}</Text>
          {loadingReview ? (
            <View style={styles.reviewLoading}>
              <ActivityIndicator size="small" color="#1a73e8" />
              <Text style={styles.reviewLoadingText}>{copy.loading}</Text>
            </View>
          ) : reviewPackages.length === 0 ? (
            <Text style={styles.reviewEmpty}>{copy.empty}</Text>
          ) : (
            reviewPackages.map(({ pkg, items, photos }, pkgIndex) => (
              <View key={pkg.id} style={styles.packageCard}>
                <View style={styles.packageHeader}>
                  <Text style={styles.packageTitle}>{copy.box} {pkgIndex + 1}</Text>
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
                  <Text style={styles.noItemsText}>{copy.noItems}</Text>
                )}

                {photos.length > 0 && (
                  <View style={styles.photosSection}>
                    <Text style={styles.photosTitle}>{copy.photos} ({photos.length})</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
                      {photos.map((photo) => {
                        const photoUri = photo.local_path || remotePhotoUrls[photo.id];
                        return (
                          <View key={photo.id} style={styles.photoBox}>
                            {photoUri ? (
                              <TouchableOpacity onPress={() => setSelectedPhotoUri(photoUri)} accessibilityRole="button">
                                <Image source={{ uri: photoUri }} style={styles.photoThumb} />
                              </TouchableOpacity>
                            ) : (
                              <View style={styles.uploadedPhotoPlaceholder}>
                                <Text style={styles.uploadedPhotoText}>{copy.uploaded}</Text>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        <Text style={styles.fieldLabel}>{copy.observations}</Text>
        <TextInput
          style={styles.noteInput}
          value={completionObservations}
          onChangeText={setCompletionObservations}
          placeholder={copy.observationsPlaceholder}
          multiline
          maxLength={4000}
        />

        <StarRating value={rating} onChange={setRating} label={copy.satisfaction} requiredMessage={copy.ratingRequired} />

        <View style={styles.signPanelCard}>
          <Text style={styles.signPanelTitle}>{copy.crewSignature}</Text>
          <Text style={styles.signPanelHint}>{copy.crewSignHint}</Text>
          <Text style={styles.fieldLabel}>{copy.crewLeaderName}</Text>
          <TextInput
            style={styles.crewNameInput}
            value={crewLeaderName}
            onChangeText={setCrewLeaderName}
            placeholder={copy.crewLeaderNamePlaceholder}
          />
          <View style={styles.signPanelRow}>
            <Text style={[styles.signState, crewSignature ? styles.signStateOk : styles.signStateMissing]}>
              {crewSignature ? copy.captured : copy.pending}
            </Text>
            <TouchableOpacity
              style={styles.openSignPanelBtn}
              onPress={openCrewSignaturePanel}
              accessibilityRole="button"
            >
              <Text style={styles.openSignPanelBtnText}>{crewSignature ? copy.resign : copy.openSign}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.declinedRow}>
          <Text style={styles.declinedLabel}>{copy.declined}</Text>
          <Switch value={declined} onValueChange={setDeclined} trackColor={{ true: '#1a73e8' }} />
        </View>

        {declined ? (
          <>
            <TextInput
              style={styles.noteInput}
              value={declineNote}
              onChangeText={setDeclineNote}
              placeholder={copy.declinePlaceholder}
              multiline
            />
            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              accessibilityRole="button"
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>{copy.complete}</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.signPanelCard}>
            <Text style={styles.signPanelTitle}>{copy.signature}</Text>
            <Text style={styles.signPanelHint}>{copy.signHint}</Text>
            <View style={styles.signPanelRow}>
              <Text style={[styles.signState, clientSignature ? styles.signStateOk : styles.signStateMissing]}>
                {clientSignature ? copy.captured : copy.pending}
              </Text>
              <TouchableOpacity
                style={styles.openSignPanelBtn}
                onPress={openSignaturePanel}
                accessibilityRole="button"
              >
                <Text style={styles.openSignPanelBtnText}>{clientSignature ? copy.resign : copy.openSign}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!declined && (
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            accessibilityRole="button"
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>{copy.complete}</Text>}
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal visible={showSignatureModal} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={styles.signatureModalContainer}>
          <View style={styles.signatureModalHeader}>
            <Text style={styles.signatureModalTitle}>{copy.modalTitle}</Text>
            <TouchableOpacity onPress={() => setShowSignatureModal(false)} accessibilityRole="button">
              <Text style={styles.signatureModalClose}>{copy.close}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.signatureModalBody}>
            <SignatureCanvas
              ref={signatureRef}
              onOK={onSignatureRead}
              onBegin={() => setHasSignature(true)}
              onEmpty={() => {
                Alert.alert(copy.signature, copy.pending);
              }}
              descriptionText=""
              clearText="Limpiar"
              confirmText="Confirmar"
              webStyle={canvasStyle}
            />
          </View>

          <View style={styles.signatureModalFooter}>
            <TouchableOpacity style={styles.clearBtn} onPress={handleClear} accessibilityRole="button">
              <Text style={styles.clearBtnText}>{copy.clear}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.captureBtn, submitting && styles.submitBtnDisabled]}
              onPress={() => {
                if (!hasSignature) {
                  Alert.alert(copy.signature, copy.pending);
                  return;
                }
                signatureRef.current?.readSignature();
              }}
              disabled={submitting}
              accessibilityRole="button"
            >
              <Text style={styles.captureBtnText}>{copy.useSignature}</Text>
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
                <Text style={styles.photoModalCloseText}>{copy.close}</Text>
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
  localId: string,
  completionObservations: string | null,
  satisfactionRating: number,
  crewSignatureLocalPath: string,
  crewLeaderName: string | null
): Promise<{ closed: boolean; pendingReason?: string }> {
  const idempotencyKey = Crypto.randomUUID();
  const occurredAt = new Date().toISOString();
  await updatePackingListSyncState(localId, 'COMPLETING');
  const completionLocation = await captureStageLocation();
  await setStageLocation('packing_lists', localId, completionLocation);

  let crewSignatureBlobPath: string | null = null;
  const net = await Network.getNetworkStateAsync();
  if (net.isConnected) {
    try {
      const crewToken = await api.getSasUploadToken(serverId, `crew-signature-${Date.now()}.png`);
      await uploadSourceToAzure(crewToken.sasUrl, crewSignatureLocalPath, 'image/png');
      crewSignatureBlobPath = crewToken.blobPath;
    } catch {
      crewSignatureBlobPath = null;
    }
  }

  await setPackingListComplete(
    localId, idempotencyKey, reviewLanguage, signatureLocalPath, signatureBlobPath,
    signatureDeclined, signatureDeclineNote, completionObservations,
    satisfactionRating, occurredAt,
    crewSignatureLocalPath, crewSignatureBlobPath, crewLeaderName
  );

  if ((!signatureDeclined && !signatureBlobPath) || !crewSignatureBlobPath) {
    const pendingReason = 'Firma pendiente de sincronizacion. Se reintentara automaticamente.';
    await updatePackingListSyncState(localId, 'COMPLETE_PENDING_SYNC', {
      syncError: pendingReason,
    });
    return { closed: false, pendingReason };
  }

  try {
    await api.completePackingList(serverId, {
      idempotencyKey,
      deviceId,
      occurredAt,
      reviewLanguage,
      signatureUrl: signatureBlobPath,
      signatureDeclined,
      signatureDeclineNote,
      crewLeaderSignatureUrl: crewSignatureBlobPath,
      crewLeaderName,
      location: completionLocation,
      completionObservations,
      satisfaction: {
        surveyVersion: 1,
        answers: { overallRating: satisfactionRating },
        submittedAt: occurredAt,
      },
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
  if (/missing barcodes|MISSING_BOX_BARCODES/i.test(raw)) {
    return 'No se puede completar: existen bultos sin codigo de barras. Asigna los codigos pendientes en cada bulto y vuelve a intentar.';
  }
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
  crewNameInput: { backgroundColor: '#fff', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 12, borderWidth: 1, borderColor: '#e0e0e0' },
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
  fieldLabel: { color: '#1f2937', fontSize: 15, fontWeight: '700', marginBottom: 7 },
  submitBtn: { backgroundColor: '#34a853', borderRadius: 8, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
