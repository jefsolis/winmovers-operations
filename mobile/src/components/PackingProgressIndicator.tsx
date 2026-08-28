import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ProgressStatus } from '../db/queries';

export const PACKING_PROGRESS_STAGES: Array<{ value: ProgressStatus; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = [
  { value: 'NOT_STARTED', label: 'No iniciado', icon: 'time-outline' },
  { value: 'TRAVELING', label: 'En camino', icon: 'car-outline' },
  { value: 'WORKING', label: 'Trabajando', icon: 'cube-outline' },
  { value: 'COMPLETED', label: 'Completado', icon: 'checkmark-circle-outline' },
];

export function getPackingProgressStage(status: ProgressStatus) {
  return PACKING_PROGRESS_STAGES.find(stage => stage.value === status) ?? PACKING_PROGRESS_STAGES[0];
}

type Props = {
  current: ProgressStatus;
  pending?: ProgressStatus | null;
};

export default function PackingProgressIndicator({ current, pending }: Props) {
  const currentIndex = PACKING_PROGRESS_STAGES.findIndex((stage) => stage.value === current);
  const effective = pending ?? current;

  return (
    <View style={styles.container} accessibilityRole="summary">
      <View style={styles.row}>
        {PACKING_PROGRESS_STAGES.map((stage, index) => {
          const completed = index < currentIndex;
          const active = stage.value === effective;
          return (
            <View key={stage.value} style={styles.stage}>
              <View style={[styles.iconCircle, completed && styles.completed, active && styles.active]}>
                <Ionicons name={stage.icon} size={19} color={completed || active ? '#fff' : '#6b7280'} />
              </View>
              <Text style={[styles.label, active && styles.activeLabel]} numberOfLines={2}>
                {stage.label}
              </Text>
            </View>
          );
        })}
      </View>
      {pending ? <Text style={styles.pending}>Cambio pendiente de sincronizacion</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  stage: { width: '24%', alignItems: 'center', gap: 5 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef0f3', borderWidth: 1, borderColor: '#d1d5db' },
  completed: { backgroundColor: '#238636', borderColor: '#238636' },
  active: { backgroundColor: '#1769aa', borderColor: '#1769aa' },
  label: { minHeight: 30, textAlign: 'center', color: '#6b7280', fontSize: 11, lineHeight: 14 },
  activeLabel: { color: '#111827', fontWeight: '700' },
  pending: { marginTop: 8, color: '#8a5a00', fontSize: 12, textAlign: 'center' },
});