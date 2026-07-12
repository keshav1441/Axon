import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModuleColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { TaskWithSubtasks } from '@/features/tasks/api';

export function DashboardTab({
  tasks,
  onAddTask,
  onSeeActive,
}: {
  tasks: TaskWithSubtasks[];
  onAddTask: () => void;
  onSeeActive: () => void;
}) {
  const theme = useTheme();

  const { open, done, pct, upNext, reminders } = useMemo(() => {
    const open = tasks.filter((t) => !t.done);
    const done = tasks.filter((t) => t.done);
    const pct = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;
    const reminders = open
      .filter((t) => t.nag_interval_minutes != null)
      .sort((a, b) => a.nag_interval_minutes! - b.nag_interval_minutes!);
    return { open, done, pct, upNext: open.slice(0, 3), reminders };
  }, [tasks]);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <ThemedView type="backgroundElement" style={[styles.heroCard, { borderColor: theme.border }]}>
        <ThemedText type="micro" themeColor="textSecondary">
          COMPLETION
        </ThemedText>
        <ThemedText type="display" style={[styles.heroValue, { color: ModuleColors.tasks }]}>
          {tasks.length === 0 ? '—' : `${pct}%`}
        </ThemedText>

        <View style={[styles.heroDivider, { backgroundColor: theme.border }]} />

        <View style={styles.heroSplitRow}>
          <View style={styles.heroSplitCol}>
            <View style={styles.heroSplitLabel}>
              <Ionicons name="ellipse-outline" size={16} color={theme.textSecondary} />
              <ThemedText type="micro" themeColor="textSecondary">
                OPEN
              </ThemedText>
            </View>
            <ThemedText type="heading">{open.length}</ThemedText>
          </View>
          <View style={[styles.heroSplitDivider, { backgroundColor: theme.border }]} />
          <View style={[styles.heroSplitCol, styles.heroSplitColRight]}>
            <View style={styles.heroSplitLabel}>
              <ThemedText type="micro" themeColor="textSecondary">
                DONE
              </ThemedText>
              <Ionicons name="checkmark-circle-outline" size={16} color={ModuleColors.tasks} />
            </View>
            <ThemedText type="heading" style={{ color: ModuleColors.tasks }}>
              {done.length}
            </ThemedText>
          </View>
        </View>
      </ThemedView>

      <Pressable onPress={onAddTask} style={[styles.addShortcut, { borderColor: theme.border, backgroundColor: 'rgba(167,139,250,0.1)' }]}>
        <Ionicons name="add-circle" size={24} color={ModuleColors.tasks} />
        <ThemedText type="heading" style={{ color: ModuleColors.tasks }}>
          Add a task
        </ThemedText>
      </Pressable>

      <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
        <View style={styles.rowBetween}>
          <ThemedText type="heading">Up next</ThemedText>
          {open.length > 0 && (
            <Pressable onPress={onSeeActive}>
              <ThemedText type="small" style={{ color: ModuleColors.tasks }}>
                See all →
              </ThemedText>
            </Pressable>
          )}
        </View>
        {upNext.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-done-circle-outline" size={28} color={theme.textSecondary} />
            <ThemedText type="body" themeColor="textSecondary">
              Nothing open. You're clear.
            </ThemedText>
          </View>
        ) : (
          upNext.map((t) => (
            <Pressable key={t.id} onPress={onSeeActive} style={styles.upNextRow}>
              <Ionicons name="ellipse-outline" size={16} color={theme.textSecondary} />
              <ThemedText type="body" style={styles.upNextTitle} numberOfLines={1}>
                {t.title}
              </ThemedText>
              {t.subtasks.length > 0 && (
                <ThemedText type="micro" themeColor="textSecondary">
                  {t.subtasks.filter((s) => s.done).length}/{t.subtasks.length}
                </ThemedText>
              )}
            </Pressable>
          ))
        )}
      </ThemedView>

      {reminders.length > 0 && (
        <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
          <ThemedText type="heading">Upcoming reminders</ThemedText>
          {reminders.map((t) => (
            <Pressable key={t.id} onPress={onSeeActive} style={styles.reminderRow}>
              <Ionicons name="alarm-outline" size={16} color={ModuleColors.tasks} />
              <ThemedText type="body" style={styles.upNextTitle} numberOfLines={1}>
                {t.title}
              </ThemedText>
              <ThemedText type="micro" themeColor="textSecondary">
                every {t.nag_interval_minutes}m
              </ThemedText>
            </Pressable>
          ))}
        </ThemedView>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: Spacing.four, gap: Spacing.three },
  card: { borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.three, gap: Spacing.two },
  heroCard: { borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.four, gap: Spacing.two },
  heroValue: { fontSize: 44, lineHeight: 48 },
  heroDivider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.one },
  heroSplitRow: { flexDirection: 'row', alignItems: 'center' },
  heroSplitCol: { flex: 1, gap: Spacing.half },
  heroSplitColRight: { alignItems: 'flex-end' },
  heroSplitLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.half },
  heroSplitDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginHorizontal: Spacing.three },
  addShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.four,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emptyState: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
  upNextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  upNextTitle: { flex: 1 },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
});
