import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { ModuleHeader } from '@/components/module-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModuleColors, Radius, Spacing } from '@/constants/theme';
import { getFocusStreakDays, getUsageMinutesByPackage, removeFocusApp, upsertFocusApp, type FocusApp } from '@/db/focus';
import { pushFocusConfigToNative } from '@/features/focus/config';
import { useTheme } from '@/hooks/use-theme';
import { AxonNative, usePermissionStatus } from '@/native/axon-native';

const FOCUS_MODE_PRESETS_MIN = [25, 60, 120];

function PermissionRow({
  label,
  kind,
}: {
  label: string;
  kind: 'overlay' | 'accessibility' | 'usageAccess';
}) {
  const { granted, request } = usePermissionStatus(kind);
  if (granted) return null;
  return (
    <Pressable onPress={request} style={styles.permissionRow}>
      <ThemedText type="small">{label}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Grant →
      </ThemedText>
    </Pressable>
  );
}

function FocusAppRow({
  app,
  usageMinutes,
  onChanged,
}: {
  app: FocusApp;
  usageMinutes: number;
  onChanged: () => void;
}) {
  const theme = useTheme();
  const [budgetText, setBudgetText] = useState(String(app.budget_minutes ?? ''));
  const overBudget = app.budget_minutes != null && usageMinutes >= app.budget_minutes;

  const commitBudget = useCallback(async () => {
    const parsed = Number(budgetText);
    await upsertFocusApp({
      ...app,
      budget_minutes: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
    });
    await pushFocusConfigToNative();
    onChanged();
  }, [app, budgetText, onChanged]);

  return (
    <View style={styles.appRow}>
      <View style={styles.appRowMain}>
        <ThemedText type="body">{app.label}</ThemedText>
        <ThemedText type="small" themeColor={overBudget ? undefined : 'textSecondary'} style={overBudget ? { color: ModuleColors.focus } : undefined}>
          {usageMinutes}m today{app.budget_minutes != null ? ` / ${app.budget_minutes}m budget` : ''}
        </ThemedText>
      </View>
      <TextInput
        value={budgetText}
        onChangeText={setBudgetText}
        onBlur={commitBudget}
        placeholder="mins/day"
        placeholderTextColor={theme.textSecondary}
        keyboardType="number-pad"
        style={[styles.budgetInput, { color: theme.text }]}
      />
      <Pressable
        onPress={async () => {
          await removeFocusApp(app.package_name);
          await pushFocusConfigToNative();
          onChanged();
        }}>
        <ThemedText type="small" themeColor="textSecondary">
          Remove
        </ThemedText>
      </Pressable>
    </View>
  );
}

function AddAppPicker({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [apps, setApps] = useState<{ packageName: string; label: string }[]>([]);

  const toggleOpen = useCallback(() => {
    if (!open) setApps(AxonNative.listInstalledApps());
    setOpen((v) => !v);
  }, [open]);

  return (
    <View>
      <Pressable onPress={toggleOpen} style={styles.addAppButton}>
        <ThemedText type="body" style={{ color: ModuleColors.focus }}>
          {open ? 'Close' : '+ Add distraction app'}
        </ThemedText>
      </Pressable>
      {open && (
        <ScrollView style={styles.appPickerList} nestedScrollEnabled>
          {apps.map((app) => (
            <Pressable
              key={app.packageName}
              style={styles.appPickerRow}
              onPress={async () => {
                await upsertFocusApp({ package_name: app.packageName, label: app.label, budget_minutes: null });
                await pushFocusConfigToNative();
                setOpen(false);
                onAdded();
              }}>
              <ThemedText type="small">{app.label}</ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

export default function FocusScreen() {
  const [apps, setApps] = useState<FocusApp[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [streak, setStreak] = useState(0);
  const [focusModeActiveUntil, setFocusModeActiveUntil] = useState<number | null>(null);
  const overlayPermission = usePermissionStatus('overlay');

  const load = useCallback(async () => {
    const [freshApps, freshUsage, freshStreak] = await Promise.all([
      pushFocusConfigToNative(),
      getUsageMinutesByPackage(0),
      getFocusStreakDays(),
    ]);
    setApps(freshApps);
    setUsage(freshUsage);
    setStreak(freshStreak);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (!focusModeActiveUntil) return;
    const remaining = focusModeActiveUntil - Date.now();
    if (remaining <= 0) {
      AxonNative.stopFocusMode();
      setFocusModeActiveUntil(null);
      return;
    }
    const timer = setTimeout(() => {
      AxonNative.stopFocusMode();
      setFocusModeActiveUntil(null);
    }, remaining);
    return () => clearTimeout(timer);
  }, [focusModeActiveUntil]);

  const startFocusMode = useCallback(
    (minutes: number) => {
      if (!overlayPermission.granted) {
        overlayPermission.request();
        return;
      }
      AxonNative.startFocusMode();
      setFocusModeActiveUntil(Date.now() + minutes * 60_000);
    },
    [overlayPermission],
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ModuleHeader title="Focus" accent={ModuleColors.focus} subtitle="Screen-time nudges and budgets" />

          <ThemedView type="backgroundElement" style={styles.card}>
            <PermissionRow label="Draw over other apps" kind="overlay" />
            <PermissionRow label="Accessibility service" kind="accessibility" />
            <PermissionRow label="Usage access" kind="usageAccess" />
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="micro" themeColor="textSecondary">
              STREAK
            </ThemedText>
            <ThemedText type="display">{streak} days under budget</ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="heading">Focus Mode</ThemedText>
            {focusModeActiveUntil ? (
              <View>
                <ThemedText type="body" themeColor="textSecondary">
                  Blocking distraction apps until{' '}
                  {new Date(focusModeActiveUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </ThemedText>
                <Pressable
                  onPress={() => {
                    AxonNative.stopFocusMode();
                    setFocusModeActiveUntil(null);
                  }}
                  style={styles.stopFocusButton}>
                  <ThemedText type="small">Stop early</ThemedText>
                </Pressable>
              </View>
            ) : (
              <View style={styles.presetRow}>
                {FOCUS_MODE_PRESETS_MIN.map((minutes) => (
                  <Pressable key={minutes} onPress={() => startFocusMode(minutes)} style={styles.presetButton}>
                    <ThemedText type="small">{minutes}m</ThemedText>
                  </Pressable>
                ))}
              </View>
            )}
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="heading" style={styles.sectionTitle}>
              Distraction apps
            </ThemedText>
            {apps.length === 0 ? (
              <ThemedText type="body" themeColor="textSecondary">
                No distraction apps configured yet.
              </ThemedText>
            ) : (
              apps.map((app) => (
                <FocusAppRow
                  key={app.package_name}
                  app={app}
                  usageMinutes={usage[app.package_name] ?? 0}
                  onChanged={load}
                />
              ))
            )}
            <AddAppPicker onAdded={load} />
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
  sectionTitle: { marginBottom: Spacing.one },
  permissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  appRowMain: { flex: 1, gap: Spacing.half },
  budgetInput: {
    width: 72,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.small,
    backgroundColor: 'rgba(255,255,255,0.08)',
    textAlign: 'center',
  },
  addAppButton: {
    paddingVertical: Spacing.two,
  },
  appPickerList: {
    maxHeight: 220,
  },
  appPickerRow: {
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  presetRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  presetButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  stopFocusButton: {
    marginTop: Spacing.two,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
