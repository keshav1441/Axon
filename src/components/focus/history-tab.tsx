import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModuleColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { FocusSession } from '@/features/focus/api';
import { FOCUS_MODE_SESSION_PACKAGE } from '@/features/focus/focus-mode';

function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

export function HistoryTab({
  sessions,
  refreshing,
  onRefresh,
}: {
  sessions: FocusSession[];
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const theme = useTheme();

  const groups = useMemo(() => {
    const byDay = new Map<string, FocusSession[]>();
    for (const s of sessions) {
      if (s.appPackage !== FOCUS_MODE_SESSION_PACKAGE || !s.endedAt) continue;
      const day = dayKey(s.startedAt);
      const list = byDay.get(day) ?? [];
      list.push(s);
      byDay.set(day, list);
    }
    return Array.from(byDay.entries())
      .map(([day, daySessions]) => ({
        day,
        sessions: daySessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()),
      }))
      .sort((a, b) => new Date(b.sessions[0].startedAt).getTime() - new Date(a.sessions[0].startedAt).getTime());
  }, [sessions]);

  const today = new Date().toDateString();

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ModuleColors.focus} />}>
      {groups.length === 0 ? (
        <ThemedView type="backgroundElement" style={[styles.emptyCard, { borderColor: theme.border }]}>
          <Ionicons name="shield-checkmark-outline" size={32} color={theme.textSecondary} />
          <ThemedText type="body" themeColor="textSecondary">
            No completed Focus Mode sessions yet.
          </ThemedText>
        </ThemedView>
      ) : (
        groups.map(({ day, sessions: daySessions }) => {
          const dayTotalMinutes = daySessions.reduce(
            (sum, s) => sum + Math.round((new Date(s.endedAt!).getTime() - new Date(s.startedAt).getTime()) / 60000),
            0,
          );
          return (
            <ThemedView key={day} type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
              <View style={styles.rowBetween}>
                <ThemedText type="heading">{day === today ? 'Today' : day}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {dayTotalMinutes}m total
                </ThemedText>
              </View>
              {daySessions.map((s) => {
                const startedAt = new Date(s.startedAt);
                const minutes = Math.round((new Date(s.endedAt!).getTime() - startedAt.getTime()) / 60000);
                return (
                  <View key={s.id} style={styles.sessionRow}>
                    <Ionicons name="shield-checkmark" size={16} color={ModuleColors.focus} />
                    <ThemedText type="small" style={styles.sessionMain}>
                      Started {startedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {minutes}m
                    </ThemedText>
                    <ThemedText type="micro" style={{ color: ModuleColors.focus }}>
                      Successful
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
  sessionMain: { flex: 1 },
});
