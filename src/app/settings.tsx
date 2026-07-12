import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ModuleTopBar } from '@/components/module-top-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModuleColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemePreference, type ThemePreference } from '@/hooks/use-theme-preference';

const THEME_OPTIONS: { key: ThemePreference; label: string }[] = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
  { key: 'system', label: 'System' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const { preference, setPreference } = useThemePreference();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ModuleTopBar title="Settings" accent={ModuleColors.home} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="micro" themeColor="textSecondary">
              APPEARANCE
            </ThemedText>
            <View style={styles.themeRow}>
              {THEME_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={() => setPreference(opt.key)}
                  style={[
                    styles.themeChip,
                    { borderColor: theme.border },
                    preference === opt.key && styles.themeChipActive,
                  ]}>
                  <ThemedText type="small" style={preference === opt.key ? { color: ModuleColors.home } : undefined}>
                    {opt.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { padding: Spacing.four, gap: Spacing.three },
  card: { borderRadius: Radius.large, padding: Spacing.three, gap: Spacing.two },
  themeRow: { flexDirection: 'row', gap: Spacing.two },
  themeChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  themeChipActive: {
    backgroundColor: 'rgba(91,141,239,0.16)',
  },
});
