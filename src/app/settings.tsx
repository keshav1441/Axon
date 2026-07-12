import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ModuleTopBar } from '@/components/module-top-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModuleColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemePreference, type ThemePreference } from '@/hooks/use-theme-preference';
import { getCurrentUser, logout } from '@/features/auth/api';
import { clearData, type ClearDataScope } from '@/features/data/api';
import type { StoredUser } from '@/api/tokens';

const THEME_OPTIONS: { key: ThemePreference; label: string }[] = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
  { key: 'system', label: 'System' },
];

const CLEAR_OPTIONS: {
  scope: ClearDataScope;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { scope: 'money', label: 'Clear expenses', description: 'Deletes all transactions and learned categories.', icon: 'wallet-outline' },
  { scope: 'tasks', label: 'Clear tasks', description: 'Deletes all tasks and subtasks.', icon: 'checkmark-done-outline' },
  { scope: 'focus', label: 'Clear focus history', description: 'Deletes all recorded focus sessions.', icon: 'time-outline' },
  { scope: 'all', label: 'Clear everything', description: 'Deletes all expenses, tasks, and focus history.', icon: 'trash-outline' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const { preference, setPreference } = useThemePreference();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [clearing, setClearing] = useState<ClearDataScope | null>(null);

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

  const confirmClear = useCallback((opt: (typeof CLEAR_OPTIONS)[number]) => {
    Alert.alert(opt.label, `${opt.description} This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          setClearing(opt.scope);
          try {
            await clearData(opt.scope);
            Alert.alert('Done', `${opt.label} completed.`);
          } catch (err) {
            Alert.alert('Could not clear data', String(err));
          } finally {
            setClearing(null);
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
          <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
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

          <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
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

          <ThemedView type="backgroundElement" style={[styles.card, styles.dangerCard, { borderColor: 'rgba(239,68,68,0.35)' }]}>
            <ThemedText type="micro" style={{ color: theme.danger }}>
              CLEAR DATA
            </ThemedText>
            {CLEAR_OPTIONS.map((opt, i) => (
              <Pressable
                key={opt.scope}
                onPress={() => confirmClear(opt)}
                disabled={clearing !== null}
                style={[styles.clearRow, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <Ionicons name={opt.icon} size={18} color={theme.danger} />
                <View style={styles.clearMain}>
                  <ThemedText type="body">{opt.label}</ThemedText>
                  <ThemedText type="micro" themeColor="textSecondary">
                    {opt.description}
                  </ThemedText>
                </View>
                {clearing === opt.scope ? (
                  <ActivityIndicator size="small" color={theme.danger} />
                ) : (
                  <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                )}
              </Pressable>
            ))}
          </ThemedView>

          <ThemedText type="micro" themeColor="textSecondary" style={styles.footer}>
            Axon v1.0.0
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { padding: Spacing.four, gap: Spacing.three },
  card: { borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.three, gap: Spacing.two },
  dangerCard: { gap: Spacing.one },
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
  clearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  clearMain: { flex: 1, gap: Spacing.half },
  footer: { textAlign: 'center', marginTop: Spacing.two },
});
