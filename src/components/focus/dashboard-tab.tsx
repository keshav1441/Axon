import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModuleColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePermissionStatus } from '@/native/axon-native';

const FOCUS_MODE_PRESETS_MIN = [25, 60, 120];

function formatHours(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

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
  monthMinutes,
  yearMinutes,
  focusModeActiveUntil,
  onStartFocusMode,
}: {
  monthMinutes: number;
  yearMinutes: number;
  focusModeActiveUntil: number | null;
  onStartFocusMode: (minutes: number) => void;
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

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <ThemedView type="backgroundElement" style={[styles.heroCard, { borderColor: theme.border }]}>
        <ThemedText type="micro" themeColor="textSecondary">
          FOCUS TIME
        </ThemedText>
        <View style={styles.heroSplitRow}>
          <View style={styles.heroSplitCol}>
            <ThemedText type="display" style={[styles.heroValue, { color: ModuleColors.focus }]}>
              {formatHours(monthMinutes)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              this month
            </ThemedText>
          </View>
          <View style={[styles.heroDivider, { backgroundColor: theme.border }]} />
          <View style={[styles.heroSplitCol, styles.heroSplitColRight]}>
            <ThemedText type="display" style={[styles.heroValue, { color: ModuleColors.focus }]}>
              {formatHours(yearMinutes)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              this year
            </ThemedText>
          </View>
        </View>
      </ThemedView>

      <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
        <ThemedText type="heading">Focus Mode</ThemedText>
        {focusModeActiveUntil ? (
          <View style={styles.activeRow}>
            <Ionicons name="shield-checkmark" size={18} color={ModuleColors.focus} />
            <ThemedText type="body" themeColor="textSecondary">
              Blocking distraction apps until{' '}
              {new Date(focusModeActiveUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </ThemedText>
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

            <ThemedText type="micro" themeColor="textSecondary">
              Once started, Focus Mode runs the full duration - distraction apps stay blocked until it ends.
            </ThemedText>
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
    gap: Spacing.two,
  },
  heroSplitRow: { flexDirection: 'row', alignItems: 'center' },
  heroSplitCol: { flex: 1, gap: Spacing.half },
  heroSplitColRight: { alignItems: 'flex-end' },
  heroDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginHorizontal: Spacing.three },
  heroValue: { fontSize: 36, lineHeight: 40 },
  gap2: { gap: Spacing.two },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
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
