import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';

export type StatCardProps = {
  label: string;
  value: string;
  subtitle?: string;
  accent: string;
};

export function StatCard({ label, value, subtitle, accent }: StatCardProps) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={[styles.accentBar, { backgroundColor: accent }]} />
      <ThemedText type="micro" themeColor="textSecondary" style={styles.label}>
        {label.toUpperCase()}
      </ThemedText>
      <ThemedText type="heading" style={styles.value}>
        {value}
      </ThemedText>
      {subtitle ? (
        <ThemedText type="small" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 150,
    borderRadius: Radius.large,
    padding: Spacing.three,
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  label: {
    marginBottom: Spacing.one,
  },
  value: {
    marginBottom: Spacing.half,
  },
});
