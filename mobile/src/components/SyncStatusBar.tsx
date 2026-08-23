import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SyncState } from '../db/queries';

interface Props {
  syncState: SyncState | string;
  listNumber: string | null | undefined;
}

const STATE_LABELS: Record<string, { label: string; color: string }> = {
  LOCAL: { label: 'Sin sincronizar', color: '#f57c00' },
  SAVING: { label: 'Guardando…', color: '#1a73e8' },
  SAVED: { label: 'Guardado', color: '#34a853' },
  COMPLETING: { label: 'Finalizando…', color: '#1a73e8' },
  COMPLETE_PENDING_SYNC: { label: 'Finalizando…', color: '#1a73e8' },
  CLOSED: { label: 'Cerrada', color: '#34a853' },
  ERROR: { label: 'Error de sincronización', color: '#d32f2f' },
};

export default function SyncStatusBar({ syncState, listNumber }: Props) {
  const meta = STATE_LABELS[syncState] ?? { label: syncState, color: '#888' };
  return (
    <View style={[styles.bar, { backgroundColor: meta.color }]}>
      <Text style={styles.text}>
        {listNumber ? `${listNumber} · ` : ''}{meta.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: 16, paddingVertical: 6 },
  text: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
