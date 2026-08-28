import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  value: number | null;
  onChange: (value: number) => void;
  label: string;
  requiredMessage?: string;
};

export default function StarRating({ value, onChange, label, requiredMessage }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.stars} accessibilityRole="radiogroup">
        {[1, 2, 3, 4, 5].map(star => (
          <TouchableOpacity
            key={star}
            style={styles.button}
            onPress={() => onChange(star)}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === star }}
            accessibilityLabel={`${star} / 5`}
          >
            <Ionicons name={value && star <= value ? 'star' : 'star-outline'} size={34} color="#c47b00" />
          </TouchableOpacity>
        ))}
      </View>
      {!value && requiredMessage ? <Text style={styles.required}>{requiredMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', borderRadius: 8, padding: 14, marginBottom: 12 },
  label: { color: '#1f2937', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  stars: { flexDirection: 'row', justifyContent: 'space-between' },
  button: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  required: { color: '#a33a00', fontSize: 12, marginTop: 5 },
});