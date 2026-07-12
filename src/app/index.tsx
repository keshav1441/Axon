import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { StatCard } from '@/components/stat-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModuleColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getDashboardSummary, type DashboardSummary } from '@/features/dashboard/summary';
import { readCache, writeCache } from '@/lib/cache';

const SUMMARY_CACHE_KEY = 'home-summary';

function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

const EMPTY_SUMMARY: DashboardSummary = {
  monthSpend: 0,
  monthIncome: 0,
  tasksDone: 0,
  tasksTotal: 0,
  focusMinutesThisMonth: 0,
  focusMinutesThisYear: 0,
};

function formatHours(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

const QUOTES = [
  'Small disciplines repeated with consistency lead to great achievements.',
  'What you do today can improve all your tomorrows.',
  'Focus on being productive instead of busy.',
  "You don't have to see the whole staircase, just take the first step.",
  'Discipline is choosing between what you want now and what you want most.',
];

const LAUNCHERS = [
  { route: '/money', label: 'Expenses', icon: 'wallet', accent: ModuleColors.money },
  { route: '/tasks', label: 'Tasks', icon: 'checkmark-circle', accent: ModuleColors.tasks },
  { route: '/focus', label: 'Focus', icon: 'timer', accent: ModuleColors.focus },
  { route: '/analytics', label: 'Analytics', icon: 'bar-chart', accent: ModuleColors.home },
  { route: '/settings', label: 'Settings', icon: 'settings-outline', accent: ModuleColors.home },
] as const satisfies {
  route: '/money' | '/tasks' | '/focus' | '/analytics' | '/settings';
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
}[];

export default function HomeScreen() {
  const theme = useTheme();
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const quote = useMemo(() => QUOTES[Math.floor(Math.random() * QUOTES.length)], []);

  useEffect(() => {
    readCache<DashboardSummary>(SUMMARY_CACHE_KEY).then((cached) => {
      if (cached) setSummary(cached);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      getDashboardSummary().then((fresh) => {
        setSummary(fresh);
        writeCache(SUMMARY_CACHE_KEY, fresh);
      });
    }, []),
  );

  const taskPercent = summary.tasksTotal === 0 ? null : Math.round((summary.tasksDone / summary.tasksTotal) * 100);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="display">Today</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.quote}>
            "{quote}"
          </ThemedText>

          <View style={styles.grid}>
            <StatCard
              label="Spent this month"
              value={formatRupees(summary.monthSpend)}
              subtitle="debit"
              accent={ModuleColors.money}
            />
            <StatCard
              label="Gained this month"
              value={formatRupees(summary.monthIncome)}
              subtitle="credit"
              accent={ModuleColors.money}
            />
            <StatCard
              label="Tasks"
              value={taskPercent == null ? '—' : `${taskPercent}%`}
              subtitle={taskPercent == null ? 'No tasks yet' : `${summary.tasksDone}/${summary.tasksTotal} done`}
              accent={ModuleColors.tasks}
            />
            <StatCard
              label="Focus time this month"
              value={formatHours(summary.focusMinutesThisMonth)}
              subtitle="in Focus Mode"
              accent={ModuleColors.focus}
            />
            <StatCard
              label="Focus time this year"
              value={formatHours(summary.focusMinutesThisYear)}
              subtitle="in Focus Mode"
              accent={ModuleColors.focus}
            />
          </View>

          <View style={styles.launcherGrid}>
            {LAUNCHERS.map((item) => (
              <Pressable
                key={item.route}
                style={[styles.launcherButton, { borderColor: theme.border }]}
                onPress={() => router.push(item.route)}>
                <Ionicons name={item.icon} size={26} color={item.accent} />
                <ThemedText type="body" style={styles.launcherLabel}>
                  {item.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  quote: { marginTop: -Spacing.two, fontStyle: 'italic' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  launcherGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  launcherButton: {
    flex: 1,
    minWidth: 150,
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  launcherLabel: { fontWeight: '600' },
});
