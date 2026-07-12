import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ModuleTopBar } from '@/components/module-top-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModuleColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemePreference, type ThemePreference } from '@/hooks/use-theme-preference';
import { getCurrentUser, logout } from '@/features/auth/api';
import type { StoredUser } from '@/api/tokens';

const THEME_OPTIONS: { key: ThemePreference; label: string }[] = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
  { key: 'system', label: 'System' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const { preference, setPreference } = useThemePreference();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  const confirmLogout = useCallback(() => {
    Alert.alert('Log out', 'You can log back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await logout();
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  }, []);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ModuleTopBar title="Settings" accent={ModuleColors.home} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="micro" themeColor="textSecondary">
              PROFILE
            </ThemedText>
            <View style={styles.profileRow}>
              <View style={[styles.avatar, { backgroundColor: 'rgba(91,141,239,0.16)' }]}>
                <ThemedText type="heading" style={{ color: ModuleColors.home }}>
                  {(user?.firstName?.[0] ?? '?').toUpperCase()}
                </ThemedText>
              </View>
              <View style={styles.profileMain}>
                <ThemedText type="body">
                  {user ? `${user.firstName} ${user.lastName}` : 'Loading…'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {user?.email ?? ''}
                </ThemedText>
              </View>
            </View>
            <Pressable onPress={confirmLogout} disabled={loggingOut} style={styles.logoutButton}>
              <Ionicons name="log-out-outline" size={18} color={theme.danger} />
              <ThemedText type="body" style={{ color: theme.danger }}>
                {loggingOut ? 'Logging out…' : 'Log out'}
              </ThemedText>
            </Pressable>
          </ThemedView>

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
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileMain: { flex: 1, gap: Spacing.half },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
});
