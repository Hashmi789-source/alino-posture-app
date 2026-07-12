import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export function Button({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{title}</Text></Pressable>;
}

export function StatusPill({ label, tone }: { label: string; tone: 'good' | 'bad' | 'warning' | 'unknown' }) {
  return <Text style={[styles.pill, styles[tone]]}>{label}</Text>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 14, shadowColor: '#102a43', shadowOpacity: 0.08, shadowRadius: 14, elevation: 2 },
  button: { backgroundColor: '#176B87', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', marginTop: 10 },
  disabled: { backgroundColor: '#9fb3bd' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  pill: { alignSelf: 'flex-start', overflow: 'hidden', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, fontWeight: '700' },
  good: { backgroundColor: '#DCFCE7', color: '#15803D' },
  warning: { backgroundColor: '#FFEDD5', color: '#C2410C' },
  bad: { backgroundColor: '#FEE2E2', color: '#B91C1C' },
  unknown: { backgroundColor: '#E5E7EB', color: '#4B5563' },
});
