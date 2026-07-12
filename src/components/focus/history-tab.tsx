import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModuleColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { FocusApp, FocusSession } from '@/features/focus/api';

function labelForPackage(appPackage: string, apps: FocusApp[]): string {
  return apps.find((a) => a.package_name === appPackage)?.label ?? appPackage;
}

function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

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

  const groups = useMemo(() => {
    const byDay = new Map<string, FocusSession[]>();
    for (const s of sessions) {
      if (!s.endedAt) continue;
      const key = dayKey(s.startedAt);
      const list = byDay.get(key) ?? [];
      list.push(s);
      byDay.set(key, list);
    }
    return Array.from(byDay.entries());
  }, [sessions]);

  const today = new Date().toDateString();

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ModuleColors.focus} />}>
      {groups.length === 0 ? (
        <ThemedView type="backgroundElement" style={[styles.emptyCard, { borderColor: theme.border }]}>
          <Ionicons name="time-outline" size={32} color={theme.textSecondary} />
          <ThemedText type="body" themeColor="textSecondary">
            No focus sessions recorded yet.
          </ThemedText>
        </ThemedView>
      ) : (
        groups.map(([day, daySessions]) => {
          const totalMinutes = daySessions.reduce(
            (sum, s) => sum + Math.round((new Date(s.endedAt!).getTime() - new Date(s.startedAt).getTime()) / 60000),
            0,
          );
          return (
            <ThemedView key={day} type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
              <View style={styles.rowBetween}>
                <ThemedText type="heading">{day === today ? 'Today' : day}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {totalMinutes}m total
                </ThemedText>
              </View>
              {daySessions.map((s) => {
                const minutes = Math.round((new Date(s.endedAt!).getTime() - new Date(s.startedAt).getTime()) / 60000);
                return (
                  <View key={s.id} style={styles.sessionRow}>
                    <Ionicons name="phone-portrait-outline" size={15} color={ModuleColors.focus} />
                    <ThemedText type="small" style={styles.sessionApp} numberOfLines={1}>
                      {labelForPackage(s.appPackage, apps)}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {minutes}m
                    </ThemedText>
                  </View>
                );
              })}
            </ThemedView>
          );
        })
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
  sessionApp: { flex: 1 },
});
