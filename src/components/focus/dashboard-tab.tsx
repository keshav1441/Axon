import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModuleColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { FocusApp } from '@/features/focus/api';
import { usePermissionStatus } from '@/native/axon-native';

const FOCUS_MODE_PRESETS_MIN = [25, 60, 120];

function PermissionRow({ label, kind }: { label: string; kind: 'overlay' | 'accessibility' | 'usageAccess' }) {
  const { granted, request } = usePermissionStatus(kind);
  if (granted) return null;
  return (
    <Pressable onPress={request} style={styles.permissionRow}>
      <Ionicons name="warning-outline" size={15} color={ModuleColors.focus} />
      <ThemedText type="small" style={styles.permissionLabel}>
        {label}
      </ThemedText>
      <ThemedText type="small" style={{ color: ModuleColors.focus }}>
        Grant →
      </ThemedText>
    </Pressable>
  );
}

export function DashboardTab({
  apps,
  usage,
  streak,
  focusModeActiveUntil,
  onStartFocusMode,
  onStopFocusMode,
}: {
  apps: FocusApp[];
  usage: Record<string, number>;
  streak: number;
  focusModeActiveUntil: number | null;
  onStartFocusMode: (minutes: number) => void;
  onStopFocusMode: () => void;
}) {
  const theme = useTheme();
  const [customOpen, setCustomOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');

  const submitCustomFocusMode = useCallback(() => {
    const parsed = Number(customMinutes);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      Alert.alert('Invalid', 'Enter a number of minutes greater than 0.');
      return;
    }
    setCustomMinutes('');
    setCustomOpen(false);
    onStartFocusMode(Math.round(parsed));
  }, [customMinutes, onStartFocusMode]);

  const { totalUsage, totalBudget } = useMemo(() => {
    let totalUsage = 0;
    let totalBudget = 0;
    for (const app of apps) {
      totalUsage += usage[app.package_name] ?? 0;
      if (app.budget_minutes != null) totalBudget += app.budget_minutes;
    }
    return { totalUsage, totalBudget };
  }, [apps, usage]);

  const budgetPct = totalBudget > 0 ? Math.min(totalUsage / totalBudget, 1) : 0;

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <ThemedView type="backgroundElement" style={[styles.heroCard, { borderColor: theme.border }]}>
        <ThemedText type="micro" themeColor="textSecondary">
          STREAK
        </ThemedText>
        <View style={styles.streakRow}>
          <Ionicons name="flame" size={30} color={ModuleColors.focus} />
          <ThemedText type="display" style={[styles.heroValue, { color: ModuleColors.focus }]}>
            {streak}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {streak === 1 ? 'day under limit' : 'days under limit'}
        </ThemedText>
      </ThemedView>

      {apps.length > 0 && (
        <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
          <View style={styles.rowBetween}>
            <ThemedText type="heading">Today</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {totalUsage}m{totalBudget > 0 ? ` / ${totalBudget}m` : ''}
            </ThemedText>
          </View>
          {totalBudget > 0 && (
            <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${budgetPct * 100}%`, backgroundColor: budgetPct >= 1 ? theme.danger : ModuleColors.focus },
                ]}
              />
            </View>
          )}
        </ThemedView>
      )}

      <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
        <ThemedText type="heading">Focus Mode</ThemedText>
        {focusModeActiveUntil ? (
          <View style={styles.gap2}>
            <View style={styles.activeRow}>
              <Ionicons name="shield-checkmark" size={18} color={ModuleColors.focus} />
              <ThemedText type="body" themeColor="textSecondary">
                Blocking distraction apps until{' '}
                {new Date(focusModeActiveUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </ThemedText>
            </View>
            <Pressable onPress={onStopFocusMode} style={[styles.stopFocusButton, { borderColor: theme.border }]}>
              <ThemedText type="small">Stop early</ThemedText>
            </Pressable>
          </View>
        ) : (
          <View style={styles.gap2}>
            <View style={styles.presetRow}>
              {FOCUS_MODE_PRESETS_MIN.map((minutes) => (
                <Pressable
                  key={minutes}
                  onPress={() => onStartFocusMode(minutes)}
                  style={[styles.presetButton, { borderColor: theme.border }]}>
                  <Ionicons name="timer-outline" size={15} color={ModuleColors.focus} />
                  <ThemedText type="small">{minutes}m</ThemedText>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setCustomOpen((v) => !v)}
                style={[styles.presetButton, { borderColor: theme.border }, customOpen && styles.presetButtonActive]}>
                <Ionicons name="options-outline" size={15} color={ModuleColors.focus} />
                <ThemedText type="small">Custom</ThemedText>
              </Pressable>
            </View>

            {customOpen && (
              <View style={styles.customRow}>
                <TextInput
                  value={customMinutes}
                  onChangeText={setCustomMinutes}
                  placeholder="Minutes"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                  autoFocus
                  style={[styles.customInput, { color: theme.text, borderColor: theme.border }]}
                />
                <Pressable style={styles.customStartButton} onPress={submitCustomFocusMode}>
                  <ThemedText type="small" style={styles.customStartButtonText}>
                    Start
                  </ThemedText>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </ThemedView>

      <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
        <PermissionRow label="Draw over other apps" kind="overlay" />
        <PermissionRow label="Accessibility service" kind="accessibility" />
        <PermissionRow label="Usage access" kind="usageAccess" />
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: Spacing.four, gap: Spacing.three },
  card: { borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.three, gap: Spacing.two },
  heroCard: {
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.one,
    alignItems: 'center',
  },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  heroValue: { fontSize: 44, lineHeight: 48 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  gap2: { gap: Spacing.two },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stopFocusButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  presetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  presetButtonActive: {
    backgroundColor: 'rgba(245,185,66,0.14)',
    borderColor: 'rgba(245,185,66,0.4)',
  },
  customRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  customInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
  },
  customStartButton: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    backgroundColor: ModuleColors.focus,
  },
  customStartButtonText: { color: '#3A2A00', fontWeight: '700' },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  permissionLabel: { flex: 1 },
});
