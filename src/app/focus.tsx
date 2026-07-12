import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AppsTab } from '@/components/focus/apps-tab';
import { DashboardTab } from '@/components/focus/dashboard-tab';
import { HistoryTab } from '@/components/focus/history-tab';
import { ModuleTopBar } from '@/components/module-top-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModuleColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listFocusSessions, recordFocusSession, type FocusApp, type FocusSession } from '@/features/focus/api';
import { pushFocusConfigToNative } from '@/features/focus/config';
import {
  clearPersistedFocusModeState,
  getPersistedFocusModeState,
  setPersistedFocusModeState,
  FOCUS_MODE_SESSION_PACKAGE,
} from '@/features/focus/focus-mode';
import { AxonNative, usePermissionStatus } from '@/native/axon-native';
import { readCache, writeCache } from '@/lib/cache';

const FOCUS_CACHE_KEY = 'focus-data';
type FocusCache = { apps: FocusApp[]; sessions: FocusSession[] };

type FocusTab = 'dashboard' | 'apps' | 'history';

const TABS: { key: FocusTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'bar-chart-outline' },
  { key: 'apps', label: 'Apps', icon: 'apps-outline' },
  { key: 'history', label: 'History', icon: 'time-outline' },
];

function monthMinutesTotal(sessions: FocusSession[], monthsAgo: 'month' | 'year'): number {
  const now = new Date();
  const start = monthsAgo === 'month' ? new Date(now.getFullYear(), now.getMonth(), 1) : new Date(now.getFullYear(), 0, 1);
  let total = 0;
  for (const s of sessions) {
    if (s.appPackage !== FOCUS_MODE_SESSION_PACKAGE || !s.endedAt) continue;
    const startedAt = new Date(s.startedAt);
    if (startedAt < start) continue;
    total += (new Date(s.endedAt).getTime() - startedAt.getTime()) / 60_000;
  }
  return Math.round(total);
}

export default function FocusScreen() {
  const theme = useTheme();
  const [tab, setTab] = useState<FocusTab>('dashboard');
  const [apps, setApps] = useState<FocusApp[]>([]);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [focusModeActiveUntil, setFocusModeActiveUntil] = useState<number | null>(null);
  const [focusModeStartedAt, setFocusModeStartedAt] = useState<number | null>(null);
  const overlayPermission = usePermissionStatus('overlay');

  const load = useCallback(async () => {
    const [freshApps, freshSessions] = await Promise.all([pushFocusConfigToNative(), listFocusSessions()]);
    setApps(freshApps);
    setSessions(freshSessions);
    writeCache<FocusCache>(FOCUS_CACHE_KEY, { apps: freshApps, sessions: freshSessions });
  }, []);

  useEffect(() => {
    readCache<FocusCache>(FOCUS_CACHE_KEY).then((cached) => {
      if (!cached) return;
      setApps(cached.apps);
      setSessions(cached.sessions);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Restore Focus Mode's "still active" UI on mount/remount - the native
  // overlay keeps running regardless of this screen's lifecycle, only the
  // JS-side end-time needs recovering from persisted storage.
  useEffect(() => {
    getPersistedFocusModeState().then((persisted) => {
      if (persisted && persisted.until > Date.now()) {
        setFocusModeStartedAt(persisted.startedAt);
        setFocusModeActiveUntil(persisted.until);
      } else if (persisted) {
        // Expired while the app/screen was away - record what actually ran and clean up.
        recordFocusSession(FOCUS_MODE_SESSION_PACKAGE, persisted.startedAt, persisted.until).catch(() => {});
        clearPersistedFocusModeState();
        AxonNative.stopFocusMode();
      }
    });
  }, []);

  // Focus Mode always runs to completion - there is no early stop, so every
  // recorded session is a successful one by definition.
  useEffect(() => {
    if (!focusModeActiveUntil || !focusModeStartedAt) return;
    const remaining = focusModeActiveUntil - Date.now();
    const finish = () => {
      AxonNative.stopFocusMode();
      recordFocusSession(FOCUS_MODE_SESSION_PACKAGE, focusModeStartedAt, focusModeActiveUntil).catch(() => {});
      clearPersistedFocusModeState();
      setFocusModeActiveUntil(null);
      setFocusModeStartedAt(null);
      load();
    };
    if (remaining <= 0) {
      finish();
      return;
    }
    const timer = setTimeout(finish, remaining);
    return () => clearTimeout(timer);
  }, [focusModeActiveUntil, focusModeStartedAt, load]);

  const startFocusMode = useCallback(
    (minutes: number) => {
      if (!overlayPermission.granted) {
        overlayPermission.request();
        return;
      }
      AxonNative.startFocusMode();
      const startedAt = Date.now();
      const until = startedAt + minutes * 60_000;
      setPersistedFocusModeState({ startedAt, until, plannedMinutes: minutes });
      setFocusModeStartedAt(startedAt);
      setFocusModeActiveUntil(until);
    },
    [overlayPermission],
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const monthMinutes = useMemo(() => monthMinutesTotal(sessions, 'month'), [sessions]);
  const yearMinutes = useMemo(() => monthMinutesTotal(sessions, 'year'), [sessions]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ModuleTopBar title="Focus" accent={ModuleColors.focus} />

        <View style={styles.content}>
          {tab === 'dashboard' && (
            <DashboardTab
              monthMinutes={monthMinutes}
              yearMinutes={yearMinutes}
              focusModeActiveUntil={focusModeActiveUntil}
              onStartFocusMode={startFocusMode}
            />
          )}
          {tab === 'apps' && <AppsTab apps={apps} onChanged={load} />}
          {tab === 'history' && (
            <HistoryTab sessions={sessions} refreshing={refreshing} onRefresh={onRefresh} />
          )}
        </View>

        <View style={[styles.bottomBar, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[styles.bottomBarItem, { borderColor: theme.border }, active && styles.bottomBarItemActive]}>
                <Ionicons name={t.icon} size={24} color={active ? ModuleColors.focus : theme.textSecondary} />
                <ThemedText
                  type="small"
                  style={active ? { color: ModuleColors.focus, fontWeight: '600' } : { color: theme.textSecondary }}>
                  {t.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: { flex: 1 },
  bottomBar: {
    flexDirection: 'row',
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
  },
  bottomBarItem: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bottomBarItemActive: {
    backgroundColor: 'rgba(245,185,66,0.14)',
    borderColor: 'rgba(245,185,66,0.4)',
  },
});
