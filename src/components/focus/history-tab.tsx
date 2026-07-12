import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModuleColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { FocusApp, FocusSession } from '@/features/focus/api';
import { FOCUS_MODE_SESSION_PACKAGE } from '@/features/focus/focus-mode';

function labelForPackage(appPackage: string, apps: FocusApp[]): string {
  return apps.find((a) => a.package_name === appPackage)?.label ?? appPackage;
}

function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

type AppTotal = { appPackage: string; totalMs: number; sessionCount: number };

export function HistoryTab({
  sessions,
  apps,
  refreshing,
  onRefresh,
}: {
  sessions: FocusSession[];
  apps: FocusApp[];
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const theme = useTheme();

  const focusModeSessions = useMemo(
    () =>
      sessions
        .filter((s) => s.appPackage === FOCUS_MODE_SESSION_PACKAGE && s.endedAt)
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()),
    [sessions],
  );

  const groups = useMemo(() => {
    const byDay = new Map<string, Map<string, AppTotal>>();
    for (const s of sessions) {
      if (!s.endedAt || s.appPackage === FOCUS_MODE_SESSION_PACKAGE) continue;
      const durationMs = Math.max(0, new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime());
      const day = dayKey(s.startedAt);
      const byApp = byDay.get(day) ?? new Map<string, AppTotal>();
      const existing = byApp.get(s.appPackage) ?? { appPackage: s.appPackage, totalMs: 0, sessionCount: 0 };
      existing.totalMs += durationMs;
      existing.sessionCount += 1;
      byApp.set(s.appPackage, existing);
      byDay.set(day, byApp);
    }
    return Array.from(byDay.entries()).map(([day, byApp]) => {
      const appTotals = Array.from(byApp.values()).sort((a, b) => b.totalMs - a.totalMs);
      const dayTotalMs = appTotals.reduce((sum, a) => sum + a.totalMs, 0);
      return { day, appTotals, dayTotalMs };
    });
  }, [sessions]);

  const today = new Date().toDateString();

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ModuleColors.focus} />}>
      {focusModeSessions.length > 0 && (
        <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
          <ThemedText type="heading">Completed Focus Mode sessions</ThemedText>
          {focusModeSessions.map((s) => {
            const startedAt = new Date(s.startedAt);
            const endedAt = new Date(s.endedAt!);
            const minutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);
            return (
              <View key={s.id} style={styles.sessionRow}>
                <Ionicons name="shield-checkmark-outline" size={15} color={ModuleColors.focus} />
                <View style={styles.sessionMain}>
                  <ThemedText type="small">
                    {startedAt.toLocaleDateString()} · {startedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {minutes}m
                </ThemedText>
              </View>
            );
          })}
        </ThemedView>
      )}

      {groups.length === 0 && focusModeSessions.length === 0 ? (
        <ThemedView type="backgroundElement" style={[styles.emptyCard, { borderColor: theme.border }]}>
          <Ionicons name="time-outline" size={32} color={theme.textSecondary} />
          <ThemedText type="body" themeColor="textSecondary">
            No focus sessions recorded yet.
          </ThemedText>
        </ThemedView>
      ) : (
        groups.map(({ day, appTotals, dayTotalMs }) => (
          <ThemedView key={day} type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
            <View style={styles.rowBetween}>
              <ThemedText type="heading">{day === today ? 'Today' : day}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {Math.round(dayTotalMs / 60000)}m total
              </ThemedText>
            </View>
            {appTotals.map((a) => {
              const minutes = Math.round(a.totalMs / 60000);
              const displayTime = minutes > 0 ? `${minutes}m` : '<1m';
              return (
                <View key={a.appPackage} style={styles.sessionRow}>
                  <Ionicons name="phone-portrait-outline" size={15} color={ModuleColors.focus} />
                  <ThemedText type="small" style={styles.sessionApp} numberOfLines={1}>
                    {labelForPackage(a.appPackage, apps)}
                  </ThemedText>
                  {a.sessionCount > 1 && (
                    <ThemedText type="micro" themeColor="textSecondary">
                      {a.sessionCount}×
                    </ThemedText>
                  )}
                  <ThemedText type="small" themeColor="textSecondary">
                    {displayTime}
                  </ThemedText>
                </View>
              );
            })}
          </ThemedView>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: Spacing.four, gap: Spacing.three },
  card: { borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.three, gap: Spacing.two },
  emptyCard: {
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  sessionMain: { flex: 1 },
  sessionApp: { flex: 1 },
});
