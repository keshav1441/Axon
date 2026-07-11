import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export function ModuleHeader({
  title,
  accent,
  subtitle,
}: {
  title: string;
  accent: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.container}>
      <View style={[styles.accentDot, { backgroundColor: accent }]} />
      <View style={styles.textCol}>
        <ThemedText type="display">{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  accentDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  textCol: {
    gap: Spacing.half,
  },
});
