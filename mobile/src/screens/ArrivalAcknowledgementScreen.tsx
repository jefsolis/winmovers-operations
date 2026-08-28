import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, SafeAreaView, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import SignatureCanvas from 'react-native-signature-canvas';
import * as Crypto from 'expo-crypto';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { enqueueWorkdayEvent, getNextWorkdayIndex, getPackingList, setStageLocation } from '../db/queries';
import { getDeviceId } from '../auth/deviceId';
import { retryPendingWorkdayEvents } from '../services/cacheService';
import { captureStageLocation } from '../services/location';

type Props = NativeStackScreenProps<RootStackParamList, 'ArrivalAcknowledgement'>;
type Language = 'ES' | 'EN';

const COPY = {
  ES: {
    title: 'Confirmacion de llegada', intro: 'El equipo de WinMovers ha llegado al lugar del servicio.',
    closeTitle: 'Cierre de jornada', closeIntro: 'El equipo de WinMovers ha finalizado la jornada de trabajo de hoy.',
    observations: 'Observaciones de llegada', placeholder: 'Observaciones opcionales sobre la llegada',
    closeObservations: 'Observaciones de la jornada', closePlaceholder: 'Observaciones opcionales sobre la jornada',
    signature: 'Firma del cliente', signHint: 'Abre el panel dedicado para firmar sin interferencia del desplazamiento.',
    captured: 'Firma capturada', pending: 'Firma pendiente', openSign: 'Abrir panel de firma', resign: 'Volver a firmar',
    modalTitle: 'Panel de firma', close: 'Cerrar', clear: 'Borrar firma', useSignature: 'Usar esta firma', confirm: 'Confirmar llegada',
    confirmClose: 'Cerrar jornada',
    clientName: 'Nombre del cliente (opcional)', clientNamePlaceholder: 'Nombre del cliente',
    crewLeaderName: 'Nombre del jefe de cuadrilla (opcional)', crewLeaderNamePlaceholder: 'Nombre del jefe de cuadrilla',
    crewSignature: 'Firma del jefe de cuadrilla',
    missing: 'Se requieren la firma del cliente y la del jefe de cuadrilla.', errorTitle: 'Firma requerida',
    stateChangedTitle: 'Estado actualizado', stateChangedMessage: 'La lista ya no esta en el estado requerido para esta accion.',
  },
  EN: {
    title: 'Arrival acknowledgement', intro: 'The WinMovers team has arrived at the service location.',
    closeTitle: 'Workday close', closeIntro: 'The WinMovers team has finished today\u2019s workday.',
    observations: 'Arrival observations', placeholder: 'Optional observations about the arrival',
    closeObservations: 'Workday observations', closePlaceholder: 'Optional observations about the workday',
    signature: 'Client signature', signHint: 'Open the dedicated panel to sign without scrolling interference.',
    captured: 'Signature captured', pending: 'Signature pending', openSign: 'Open signature panel', resign: 'Sign again',
    modalTitle: 'Signature panel', close: 'Close', clear: 'Clear signature', useSignature: 'Use this signature', confirm: 'Confirm arrival',
    confirmClose: 'Close workday',
    clientName: 'Client name (optional)', clientNamePlaceholder: 'Client name',
    crewLeaderName: 'Crew leader name (optional)', crewLeaderNamePlaceholder: 'Crew leader name',
    crewSignature: 'Crew leader signature',
    missing: 'Both the client signature and the crew leader signature are required.', errorTitle: 'Signature required',
    stateChangedTitle: 'Status updated', stateChangedMessage: 'This packing list is no longer in the state required for this action.',
  },
} as const;

export default function ArrivalAcknowledgementScreen({ route, navigation }: Props) {
  const { packingListLocalId, eventType = 'DAY_START' } = route.params;
  const signatureRef = useRef<React.ElementRef<typeof SignatureCanvas>>(null);
  const [language, setLanguage] = useState<Language>('ES');
  const [observations, setObservations] = useState('');
  const [clientSignature, setClientSignature] = useState<string | null>(null);
  const [crewSignature, setCrewSignature] = useState<string | null>(null);
  const [clientSignerName, setClientSignerName] = useState('');
  const [crewLeaderName, setCrewLeaderName] = useState('');
  const [activeSigner, setActiveSigner] = useState<'CLIENT' | 'CREW'>('CLIENT');
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [hasSignatureStroke, setHasSignatureStroke] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const copy = COPY[language];
  const isDayClose = eventType === 'DAY_CLOSE';

  const submitArrival = async () => {
    if (!clientSignature || !crewSignature) {
      Alert.alert(copy.errorTitle, copy.missing);
      return;
    }
    setSubmitting(true);
    const packingList = await getPackingList(packingListLocalId);
    if (!packingList || packingList.progress_status !== 'TRAVELING') {
      if (eventType === 'DAY_CLOSE' && packingList?.progress_status === 'WORKING') {
        // valid for day close
      } else {
      setSubmitting(false);
      Alert.alert(copy.stateChangedTitle, copy.stateChangedMessage);
      navigation.goBack();
      return;
      }
    }
    const now = new Date().toISOString();
    const id = Crypto.randomUUID();
    const targetStatus = eventType === 'DAY_CLOSE' ? 'TRAVELING' : 'WORKING';
    const fromStatus = eventType === 'DAY_CLOSE' ? 'WORKING' : 'TRAVELING';
    const workdayIndex = await getNextWorkdayIndex(packingList.id);
    await enqueueWorkdayEvent({
      id,
      server_id: null,
      packing_list_id: packingList.id,
      workday_index: workdayIndex,
      event_type: eventType,
      from_progress_status: fromStatus,
      to_progress_status: targetStatus,
      observations: observations.trim() || null,
      occurred_at: now,
      sync_state: 'PENDING',
      sync_error: null,
      confirmed_at: null,
      actor_name: null,
      signature_client_local_path: clientSignature,
      signature_client_blob_path: null,
      signature_crew_local_path: crewSignature,
      signature_crew_blob_path: null,
      client_signer_name: clientSignerName.trim() || null,
      crew_leader_name: crewLeaderName.trim() || null,
      signature_language: language,
      created_at: now,
      updated_at: now,
    });
    const deviceId = await getDeviceId();
    await setStageLocation('packing_workday_events', id, await captureStageLocation());
    await retryPendingWorkdayEvents(deviceId, packingList.id);
    setSubmitting(false);
    navigation.goBack();
  };

  const captureSignature = () => {
    if (!hasSignatureStroke) {
      Alert.alert(copy.errorTitle, copy.missing);
      return;
    }
    signatureRef.current?.readSignature();
  };

  const handleSignatureRead = (value: string) => {
    if (activeSigner === 'CLIENT') setClientSignature(value);
    if (activeSigner === 'CREW') setCrewSignature(value);
    setShowSignatureModal(false);
  };

  const clearSignature = () => {
    signatureRef.current?.clearSignature();
    setHasSignatureStroke(false);
  };

  const openSignaturePanel = () => {
    setHasSignatureStroke(false);
    setShowSignatureModal(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.languageControl}>
          {(['ES', 'EN'] as Language[]).map(option => (
            <TouchableOpacity key={option} style={[styles.languageButton, language === option && styles.languageButtonActive]} onPress={() => setLanguage(option)} accessibilityRole="button">
              <Text style={[styles.languageText, language === option && styles.languageTextActive]}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.title}>{isDayClose ? copy.closeTitle : copy.title}</Text>
        <Text style={styles.intro}>{isDayClose ? copy.closeIntro : copy.intro}</Text>
        <Text style={styles.label}>{isDayClose ? copy.closeObservations : copy.observations}</Text>
        <TextInput style={styles.input} value={observations} onChangeText={setObservations} placeholder={isDayClose ? copy.closePlaceholder : copy.placeholder} multiline maxLength={4000} />
        <Text style={styles.label}>{copy.clientName}</Text>
        <TextInput style={styles.input} value={clientSignerName} onChangeText={setClientSignerName} placeholder={copy.clientNamePlaceholder} />
        <Text style={styles.label}>{copy.crewLeaderName}</Text>
        <TextInput style={styles.input} value={crewLeaderName} onChangeText={setCrewLeaderName} placeholder={copy.crewLeaderNamePlaceholder} />
        <View style={styles.signatureCard}>
          <Text style={styles.label}>{copy.signature} (Cliente)</Text>
          <Text style={styles.signHint}>{copy.signHint}</Text>
          <View style={styles.signatureRow}>
            <Text style={[styles.signatureState, clientSignature ? styles.signatureCaptured : styles.signaturePending]}>
              {clientSignature ? copy.captured : copy.pending}
            </Text>
            <TouchableOpacity style={styles.openSignButton} onPress={() => { setActiveSigner('CLIENT'); openSignaturePanel(); }} accessibilityRole="button">
              <Text style={styles.openSignButtonText}>{clientSignature ? copy.resign : copy.openSign}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 10 }} />
          <Text style={styles.label}>{copy.crewSignature}</Text>
          <View style={styles.signatureRow}>
            <Text style={[styles.signatureState, crewSignature ? styles.signatureCaptured : styles.signaturePending]}>
              {crewSignature ? copy.captured : copy.pending}
            </Text>
            <TouchableOpacity style={styles.openSignButton} onPress={() => { setActiveSigner('CREW'); openSignaturePanel(); }} accessibilityRole="button">
              <Text style={styles.openSignButtonText}>{crewSignature ? copy.resign : copy.openSign}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity style={[styles.confirmButton, submitting && styles.disabled]} onPress={() => void submitArrival()} disabled={submitting} accessibilityRole="button">
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>{isDayClose ? copy.confirmClose : copy.confirm}</Text>}
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showSignatureModal} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setShowSignatureModal(false)}>
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
              onOK={handleSignatureRead}
              onBegin={() => setHasSignatureStroke(true)}
              descriptionText=""
              clearText=""
              confirmText=""
              webStyle={canvasStyle}
            />
          </View>
          <View style={styles.signatureModalFooter}>
            <TouchableOpacity style={styles.clearButton} onPress={clearSignature} accessibilityRole="button">
              <Text style={styles.clearText}>{copy.clear}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.captureButton} onPress={captureSignature} accessibilityRole="button">
              <Text style={styles.captureButtonText}>{copy.useSignature}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const canvasStyle = `
  .m-signature-pad { box-shadow: none; border: 1px solid #e0e0e0; border-radius: 8px; }
  .m-signature-pad--body { border: none; }
  .m-signature-pad--footer { display: none; }
  body { background-color: #fff; }
`;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 18, paddingBottom: 32 },
  languageControl: { alignSelf: 'center', flexDirection: 'row', borderWidth: 1, borderColor: '#1769aa', borderRadius: 8, overflow: 'hidden', marginBottom: 18 },
  languageButton: { width: 62, minHeight: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  languageButtonActive: { backgroundColor: '#1769aa' },
  languageText: { color: '#1769aa', fontWeight: '700' },
  languageTextActive: { color: '#fff' },
  title: { color: '#111827', fontSize: 23, fontWeight: '700', textAlign: 'center' },
  intro: { color: '#4b5563', fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8, marginBottom: 22 },
  label: { color: '#1f2937', fontSize: 14, fontWeight: '700', marginBottom: 7 },
  input: { minHeight: 90, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff', borderRadius: 8, padding: 12, textAlignVertical: 'top', marginBottom: 20 },
  signatureCard: { backgroundColor: '#fff', borderRadius: 8, padding: 14 },
  signHint: { color: '#6b7280', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  signatureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  signatureState: { fontSize: 12, fontWeight: '700' },
  signatureCaptured: { color: '#1e8e3e' },
  signaturePending: { color: '#b06000' },
  openSignButton: { backgroundColor: '#1769aa', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  openSignButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  signatureModalContainer: { flex: 1, backgroundColor: '#fff' },
  signatureModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  signatureModalTitle: { color: '#111827', fontSize: 17, fontWeight: '700' },
  signatureModalClose: { color: '#1769aa', fontSize: 14, fontWeight: '700' },
  signatureModalBody: { flex: 1, padding: 16 },
  signatureModalFooter: { padding: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb', gap: 10 },
  clearButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', borderRadius: 8 },
  clearText: { color: '#1769aa', fontWeight: '700' },
  captureButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1769aa', borderRadius: 8 },
  captureButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  confirmButton: { minHeight: 50, backgroundColor: '#1769aa', borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  confirmText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.55 },
});