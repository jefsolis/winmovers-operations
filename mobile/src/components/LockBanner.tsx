import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  lockHolder: string | null;
  onClaim: () => void;
}

export default function LockBanner({ lockHolder, onClaim }: Props) {
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        Esta lista está bloqueada por otro dispositivo.{'\n'}
        <Text style={styles.small}>{lockHolder}</Text>
      </Text>
      <TouchableOpacity onPress={onClaim} style={styles.claimButton} accessibilityRole="button">
        <Text style={styles.claimText}>Tomar Control</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: '#f57c00', padding: 12, alignItems: 'center' },
  text: { color: '#fff', fontWeight: '600', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  small: { fontWeight: '400', fontSize: 11, opacity: 0.85 },
  claimButton: { backgroundColor: '#fff', borderRadius: 6, paddingHorizontal: 16, paddingVertical: 6 },
  claimText: { color: '#f57c00', fontWeight: '700', fontSize: 13 },
});
