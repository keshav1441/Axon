import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModuleColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { removeFocusApp, upsertFocusApp, type FocusApp } from '@/features/focus/api';
import { pushFocusConfigToNative } from '@/features/focus/config';
import { AxonNative } from '@/native/axon-native';

/** Common distraction apps offered as one-tap suggestions, matched against what's actually installed. */
const SUGGESTED_PACKAGES = [
  'com.instagram.android',
  'com.whatsapp',
  'com.facebook.katana',
  'com.google.android.youtube',
  'com.zhiliaoapp.musically',
  'com.twitter.android',
  'com.snapchat.android',
];

function AppRow({ app, onChanged }: { app: FocusApp; onChanged: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.appRow, { borderColor: theme.border }]}>
      <View style={styles.appIcon}>
        <Ionicons name="phone-portrait-outline" size={18} color={ModuleColors.focus} />
      </View>
      <ThemedText type="body" style={styles.appRowMain} numberOfLines={1}>
        {app.label}
      </ThemedText>
      <Pressable
        hitSlop={8}
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

function AddAppDialog({
  visible,
  onClose,
  onAdded,
  existingPackages,
}: {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
  existingPackages: Set<string>;
}) {
  const theme = useTheme();
  const [apps, setApps] = useState<{ packageName: string; label: string }[]>([]);
  const [addingPackage, setAddingPackage] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    try {
      setApps(AxonNative.listInstalledApps());
    } catch (err) {
      Alert.alert('Could not list apps', String(err));
    }
  }, [visible]);

  const suggested = useMemo(
    () => apps.filter((a) => SUGGESTED_PACKAGES.includes(a.packageName) && !existingPackages.has(a.packageName)),
    [apps, existingPackages],
  );
  const others = useMemo(
    () => apps.filter((a) => !SUGGESTED_PACKAGES.includes(a.packageName) && !existingPackages.has(a.packageName)),
    [apps, existingPackages],
  );

  const addApp = useCallback(
    async (app: { packageName: string; label: string }) => {
      setAddingPackage(app.packageName);
      try {
        await upsertFocusApp({ package_name: app.packageName, label: app.label, budget_minutes: null });
        await pushFocusConfigToNative();
        onAdded();
      } catch (err) {
        Alert.alert('Could not add app', String(err));
      } finally {
        setAddingPackage(null);
      }
    },
    [onAdded],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <ThemedView type="backgroundElement" style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <ThemedText type="heading">Add distraction app</ThemedText>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={ModuleColors.focus} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalList}>
            {suggested.length > 0 && (
              <>
                <ThemedText type="micro" themeColor="textSecondary" style={styles.modalSectionLabel}>
                  SUGGESTED
                </ThemedText>
                {suggested.map((app) => (
                  <Pressable
                    key={app.packageName}
                    style={[styles.modalRow, { borderTopColor: theme.border }]}
                    disabled={addingPackage !== null}
                    onPress={() => addApp(app)}>
                    <ThemedText type="body">{app.label}</ThemedText>
                    {addingPackage === app.packageName ? (
                      <Ionicons name="hourglass-outline" size={16} color={theme.textSecondary} />
                    ) : (
                      <Ionicons name="add-circle-outline" size={20} color={ModuleColors.focus} />
                    )}
                  </Pressable>
                ))}
              </>
            )}

            {others.length > 0 && (
              <>
                <ThemedText type="micro" themeColor="textSecondary" style={styles.modalSectionLabel}>
                  ALL APPS
                </ThemedText>
                {others.map((app) => (
                  <Pressable
                    key={app.packageName}
                    style={[styles.modalRow, { borderTopColor: theme.border }]}
                    disabled={addingPackage !== null}
                    onPress={() => addApp(app)}>
                    <ThemedText type="body">{app.label}</ThemedText>
                    {addingPackage === app.packageName ? (
                      <Ionicons name="hourglass-outline" size={16} color={theme.textSecondary} />
                    ) : (
                      <Ionicons name="add-circle-outline" size={20} color={ModuleColors.focus} />
                    )}
                  </Pressable>
                ))}
              </>
            )}

            {suggested.length === 0 && others.length === 0 && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.pickerEmpty}>
                No more apps to add.
              </ThemedText>
            )}
          </ScrollView>
        </ThemedView>
      </View>
    </Modal>
  );
}

export function AppsTab({ apps, onChanged }: { apps: FocusApp[]; onChanged: () => void }) {
  const theme = useTheme();
  const [dialogOpen, setDialogOpen] = useState(false);
  const existingPackages = useMemo(() => new Set(apps.map((a) => a.package_name)), [apps]);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
        <ThemedText type="heading" style={styles.sectionTitle}>
          Distraction apps
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.sectionSubtitle}>
          Blocked entirely while Focus Mode is running.
        </ThemedText>
        {apps.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="apps-outline" size={28} color={theme.textSecondary} />
            <ThemedText type="body" themeColor="textSecondary">
              No distraction apps configured yet.
            </ThemedText>
          </View>
        ) : (
          apps.map((app) => <AppRow key={app.package_name} app={app} onChanged={onChanged} />)
        )}
        <Pressable onPress={() => setDialogOpen(true)} style={styles.addAppButton}>
          <Ionicons name="add-circle-outline" size={18} color={ModuleColors.focus} />
          <ThemedText type="body" style={{ color: ModuleColors.focus }}>
            Add distraction app
          </ThemedText>
        </Pressable>
      </ThemedView>

      <AddAppDialog
        visible={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onAdded={onChanged}
        existingPackages={existingPackages}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: Spacing.four, gap: Spacing.three },
  card: { borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.three, gap: Spacing.two },
  sectionTitle: { marginBottom: Spacing.half },
  sectionSubtitle: { marginBottom: Spacing.one },
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
    backgroundColor: 'rgba(245,185,66,0.12)',
  },
  appRowMain: { flex: 1 },
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
  modalList: { maxHeight: 460 },
  modalSectionLabel: { marginTop: Spacing.two, marginBottom: Spacing.half },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pickerEmpty: { paddingVertical: Spacing.two },
});
