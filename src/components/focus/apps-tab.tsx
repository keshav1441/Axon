import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModuleColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { removeFocusApp, upsertFocusApp, type FocusApp } from '@/features/focus/api';
import { pushFocusConfigToNative } from '@/features/focus/config';
import { AxonNative } from '@/native/axon-native';

function AppRow({ app, usageMinutes, onChanged }: { app: FocusApp; usageMinutes: number; onChanged: () => void }) {
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
    <View style={[styles.appRow, { borderColor: theme.border }]}>
      <View style={[styles.appIcon, { backgroundColor: overBudget ? 'rgba(239,68,68,0.12)' : 'rgba(245,185,66,0.12)' }]}>
        <Ionicons name="phone-portrait-outline" size={18} color={overBudget ? theme.danger : ModuleColors.focus} />
      </View>
      <View style={styles.appRowMain}>
        <ThemedText type="body" numberOfLines={1}>
          {app.label}
        </ThemedText>
        <ThemedText type="small" themeColor={overBudget ? undefined : 'textSecondary'} style={overBudget ? { color: theme.danger } : undefined}>
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
        style={[styles.budgetInput, { color: theme.text, borderColor: theme.border }]}
      />
      <Pressable
        hitSlop={6}
        onPress={async () => {
          await removeFocusApp(app.package_name);
          await pushFocusConfigToNative();
          onChanged();
        }}>
        <Ionicons name="trash-outline" size={17} color={theme.textSecondary} />
      </Pressable>
    </View>
  );
}

function AddAppPicker({ onAdded }: { onAdded: () => void }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [apps, setApps] = useState<{ packageName: string; label: string }[]>([]);

  const toggleOpen = useCallback(() => {
    if (!open) setApps(AxonNative.listInstalledApps());
    setOpen((v) => !v);
  }, [open]);

  return (
    <View>
      <Pressable onPress={toggleOpen} style={styles.addAppButton}>
        <Ionicons name={open ? 'close-circle-outline' : 'add-circle-outline'} size={18} color={ModuleColors.focus} />
        <ThemedText type="body" style={{ color: ModuleColors.focus }}>
          {open ? 'Close' : 'Add distraction app'}
        </ThemedText>
      </Pressable>
      {open && (
        <ScrollView style={styles.appPickerList} nestedScrollEnabled>
          {apps.map((app) => (
            <Pressable
              key={app.packageName}
              style={[styles.appPickerRow, { borderTopColor: theme.border }]}
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

export function AppsTab({
  apps,
  usage,
  onChanged,
}: {
  apps: FocusApp[];
  usage: Record<string, number>;
  onChanged: () => void;
}) {
  const theme = useTheme();
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
        <ThemedText type="heading" style={styles.sectionTitle}>
          Distraction apps
        </ThemedText>
        {apps.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="apps-outline" size={28} color={theme.textSecondary} />
            <ThemedText type="body" themeColor="textSecondary">
              No distraction apps configured yet.
            </ThemedText>
          </View>
        ) : (
          apps.map((app) => (
            <AppRow key={app.package_name} app={app} usageMinutes={usage[app.package_name] ?? 0} onChanged={onChanged} />
          ))
        )}
        <AddAppPicker onAdded={onChanged} />
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: Spacing.four, gap: Spacing.three },
  card: { borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.three, gap: Spacing.two },
  sectionTitle: { marginBottom: Spacing.one },
  emptyState: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  appIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appRowMain: { flex: 1, gap: Spacing.half },
  budgetInput: {
    width: 72,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    textAlign: 'center',
  },
  addAppButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  appPickerList: { maxHeight: 220 },
  appPickerRow: {
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
