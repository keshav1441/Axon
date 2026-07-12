import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
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
  const [limitText, setLimitText] = useState(String(app.budget_minutes ?? ''));
  const [saving, setSaving] = useState(false);
  const overLimit = app.budget_minutes != null && usageMinutes >= app.budget_minutes;

  const commitLimit = useCallback(async () => {
    setSaving(true);
    try {
      const parsed = Number(limitText);
      await upsertFocusApp({
        ...app,
        budget_minutes: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
      });
      await pushFocusConfigToNative();
      onChanged();
    } finally {
      setSaving(false);
    }
  }, [app, limitText, onChanged]);

  return (
    <View style={[styles.appRow, { borderColor: theme.border }]}>
      <View style={styles.appRowTop}>
        <View style={[styles.appIcon, { backgroundColor: overLimit ? 'rgba(239,68,68,0.12)' : 'rgba(245,185,66,0.12)' }]}>
          <Ionicons name="phone-portrait-outline" size={18} color={overLimit ? theme.danger : ModuleColors.focus} />
        </View>
        <View style={styles.appRowMain}>
          <ThemedText type="body" numberOfLines={1}>
            {app.label}
          </ThemedText>
          <ThemedText type="small" themeColor={overLimit ? undefined : 'textSecondary'} style={overLimit ? { color: theme.danger } : undefined}>
            {usageMinutes}m today{app.budget_minutes != null ? ` / ${app.budget_minutes}m limit` : ' · no limit'}
          </ThemedText>
        </View>
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
      <View style={styles.limitRow}>
        <TextInput
          value={limitText}
          onChangeText={setLimitText}
          placeholder="Daily limit (minutes)"
          placeholderTextColor={theme.textSecondary}
          keyboardType="number-pad"
          style={[styles.limitInput, { color: theme.text, borderColor: theme.border }]}
        />
        <Pressable
          onPress={commitLimit}
          disabled={saving}
          style={[styles.limitSetButton, saving && { opacity: 0.6 }]}>
          <ThemedText type="small" style={styles.limitSetButtonText}>
            {saving ? '…' : 'Set'}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

function AddAppDialog({ visible, onClose, onAdded }: { visible: boolean; onClose: () => void; onAdded: () => void }) {
  const theme = useTheme();
  const [step, setStep] = useState<'pick' | 'limit'>('pick');
  const [apps, setApps] = useState<{ packageName: string; label: string }[]>([]);
  const [selected, setSelected] = useState<{ packageName: string; label: string } | null>(null);
  const [limitText, setLimitText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setStep('pick');
    setSelected(null);
    setLimitText('');
    try {
      setApps(AxonNative.listInstalledApps());
    } catch (err) {
      Alert.alert('Could not list apps', String(err));
    }
  }, [visible]);

  const pickApp = useCallback((app: { packageName: string; label: string }) => {
    setSelected(app);
    setStep('limit');
  }, []);

  const save = useCallback(async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const parsed = Number(limitText);
      await upsertFocusApp({
        package_name: selected.packageName,
        label: selected.label,
        budget_minutes: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
      });
      await pushFocusConfigToNative();
      onAdded();
      onClose();
    } catch (err) {
      Alert.alert('Could not add app', String(err));
    } finally {
      setSaving(false);
    }
  }, [selected, limitText, onAdded, onClose]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <ThemedView type="backgroundElement" style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <ThemedText type="heading" style={styles.modalTitle} numberOfLines={1}>
              {step === 'pick' ? 'Select an app' : selected?.label}
            </ThemedText>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={ModuleColors.focus} />
            </Pressable>
          </View>

          {step === 'pick' ? (
            <ScrollView style={styles.modalList}>
              {apps.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.pickerEmpty}>
                  No apps found on this device.
                </ThemedText>
              ) : (
                apps.map((app) => (
                  <Pressable
                    key={app.packageName}
                    style={[styles.modalRow, { borderTopColor: theme.border }]}
                    onPress={() => pickApp(app)}>
                    <ThemedText type="body">{app.label}</ThemedText>
                    <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                  </Pressable>
                ))
              )}
            </ScrollView>
          ) : (
            <View style={styles.limitStep}>
              <ThemedText type="small" themeColor="textSecondary">
                Optional daily time limit for this app. Leave blank for no limit.
              </ThemedText>
              <TextInput
                value={limitText}
                onChangeText={setLimitText}
                placeholder="Minutes per day (optional)"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                autoFocus
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              />
              <View style={styles.limitStepButtons}>
                <Pressable style={[styles.backButton, { borderColor: theme.border }]} onPress={() => setStep('pick')}>
                  <ThemedText type="body">Back</ThemedText>
                </Pressable>
                <Pressable style={[styles.saveButton, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
                  <ThemedText type="body" style={styles.saveButtonText}>
                    {saving ? 'Adding…' : 'Add app'}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          )}
        </ThemedView>
      </View>
    </Modal>
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
  const [dialogOpen, setDialogOpen] = useState(false);

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
        <Pressable onPress={() => setDialogOpen(true)} style={styles.addAppButton}>
          <Ionicons name="add-circle-outline" size={18} color={ModuleColors.focus} />
          <ThemedText type="body" style={{ color: ModuleColors.focus }}>
            Add distraction app
          </ThemedText>
        </Pressable>
      </ThemedView>

      <AddAppDialog visible={dialogOpen} onClose={() => setDialogOpen(false)} onAdded={onChanged} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: Spacing.four, gap: Spacing.three },
  card: { borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.three, gap: Spacing.two },
  sectionTitle: { marginBottom: Spacing.one },
  emptyState: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
  appRow: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  appRowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  appIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appRowMain: { flex: 1, gap: Spacing.half },
  limitRow: { flexDirection: 'row', gap: Spacing.two, paddingLeft: 40 },
  limitInput: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  limitSetButton: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
    backgroundColor: ModuleColors.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  limitSetButtonText: { color: '#3A2A00', fontWeight: '700' },
  addAppButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    padding: Spacing.four,
    gap: Spacing.two,
    maxHeight: '80%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  modalTitle: { flex: 1 },
  modalList: { maxHeight: 400 },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pickerEmpty: { paddingVertical: Spacing.two },
  limitStep: { gap: Spacing.three },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  limitStepButtons: { flexDirection: 'row', gap: Spacing.two },
  backButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  saveButton: {
    flex: 2,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: ModuleColors.focus,
  },
  saveButtonText: { color: '#3A2A00', fontWeight: '700' },
});
