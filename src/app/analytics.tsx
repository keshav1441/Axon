import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ModuleTopBar } from '@/components/module-top-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModuleColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listTransactions } from '@/features/money/api';
import { listTasksWithSubtasks } from '@/features/tasks/api';
import { listFocusSessions } from '@/features/focus/api';
import { FOCUS_MODE_SESSION_PACKAGE } from '@/features/focus/focus-mode';
import { formatRupees } from '@/features/money/format';

const MONTHS_BACK = 6;

type MonthBucket = {
  key: string;
  label: string;
  spend: number;
  income: number;
  tasksCreated: number;
  tasksDone: number;
  focusMinutes: number;
};

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function buildMonths(): MonthBucket[] {
  const now = new Date();
  const months: MonthBucket[] = [];
  for (let i = MONTHS_BACK - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: monthKey(d),
      label: d.toLocaleDateString('en-US', { month: 'short' }),
      spend: 0,
      income: 0,
      tasksCreated: 0,
      tasksDone: 0,
      focusMinutes: 0,
    });
  }
  return months;
}

function BarRow({
  label,
  value,
  max,
  color,
  formatValue,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  formatValue: (v: number) => string;
}) {
  const theme = useTheme();
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 4 : 0) : 0;
  return (
    <View style={styles.barRow}>
      <ThemedText type="micro" themeColor="textSecondary" style={styles.barLabel}>
        {label}
      </ThemedText>
      <View style={[styles.barTrack, { backgroundColor: theme.border }]}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <ThemedText type="micro" themeColor="textSecondary" style={styles.barValue}>
        {formatValue(value)}
      </ThemedText>
    </View>
  );
}

export default function AnalyticsScreen() {
  const theme = useTheme();
  const [months, setMonths] = useState<MonthBucket[]>(buildMonths());

  const load = useCallback(async () => {
    const [transactions, tasks, sessions] = await Promise.all([
      listTransactions(),
      listTasksWithSubtasks(),
      listFocusSessions(),
    ]);

    const buckets = buildMonths();
    const byKey = new Map(buckets.map((b) => [b.key, b]));

    for (const tx of transactions) {
      const bucket = byKey.get(monthKey(new Date(tx.occurredAt)));
      if (!bucket) continue;
      if (tx.direction === 'debit') bucket.spend += Number(tx.amount);
      else bucket.income += Number(tx.amount);
    }

    for (const task of tasks) {
      const bucket = byKey.get(monthKey(new Date(task.createdAt)));
      if (!bucket) continue;
      bucket.tasksCreated += 1;
      if (task.done) bucket.tasksDone += 1;
    }

    for (const s of sessions) {
      if (!s.endedAt || s.appPackage !== FOCUS_MODE_SESSION_PACKAGE) continue;
      const bucket = byKey.get(monthKey(new Date(s.startedAt)));
      if (!bucket) continue;
      bucket.focusMinutes += Math.max(
        0,
        Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000),
      );
    }

    setMonths(buckets);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const maxSpend = Math.max(...months.map((m) => m.spend), 1);
  const maxIncome = Math.max(...months.map((m) => m.income), 1);
  const maxTasks = Math.max(...months.map((m) => m.tasksDone), 1);
  const maxFocus = Math.max(...months.map((m) => m.focusMinutes), 1);

  const totals = useMemo(
    () =>
      months.reduce(
        (acc, m) => ({
          spend: acc.spend + m.spend,
          income: acc.income + m.income,
          tasksDone: acc.tasksDone + m.tasksDone,
          focusMinutes: acc.focusMinutes + m.focusMinutes,
        }),
        { spend: 0, income: 0, tasksDone: 0, focusMinutes: 0 },
      ),
    [months],
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ModuleTopBar title="Analytics" accent={ModuleColors.home} subtitle={`Last ${MONTHS_BACK} months`} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.totalsGrid}>
            <ThemedView type="backgroundElement" style={[styles.totalCard, { borderColor: theme.border }]}>
              <Ionicons name="arrow-up-circle-outline" size={18} color="#EF4444" />
              <ThemedText type="heading">{formatRupees(totals.spend)}</ThemedText>
              <ThemedText type="micro" themeColor="textSecondary">
                TOTAL SPENT
              </ThemedText>
            </ThemedView>
            <ThemedView type="backgroundElement" style={[styles.totalCard, { borderColor: theme.border }]}>
              <Ionicons name="arrow-down-circle-outline" size={18} color={ModuleColors.money} />
              <ThemedText type="heading">{formatRupees(totals.income)}</ThemedText>
              <ThemedText type="micro" themeColor="textSecondary">
                TOTAL EARNED
              </ThemedText>
            </ThemedView>
            <ThemedView type="backgroundElement" style={[styles.totalCard, { borderColor: theme.border }]}>
              <Ionicons name="checkmark-done-outline" size={18} color={ModuleColors.tasks} />
              <ThemedText type="heading">{totals.tasksDone}</ThemedText>
              <ThemedText type="micro" themeColor="textSecondary">
                TASKS DONE
              </ThemedText>
            </ThemedView>
            <ThemedView type="backgroundElement" style={[styles.totalCard, { borderColor: theme.border }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color={ModuleColors.focus} />
              <ThemedText type="heading">{Math.round(totals.focusMinutes / 60)}h</ThemedText>
              <ThemedText type="micro" themeColor="textSecondary">
                FOCUS TIME
              </ThemedText>
            </ThemedView>
          </View>

          <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
            <ThemedText type="heading" style={styles.sectionTitle}>
              Spend by month
            </ThemedText>
            {months.map((m) => (
              <BarRow key={m.key} label={m.label} value={m.spend} max={maxSpend} color="#EF4444" formatValue={formatRupees} />
            ))}
          </ThemedView>

          <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
            <ThemedText type="heading" style={styles.sectionTitle}>
              Income by month
            </ThemedText>
            {months.map((m) => (
              <BarRow
                key={m.key}
                label={m.label}
                value={m.income}
                max={maxIncome}
                color={ModuleColors.money}
                formatValue={formatRupees}
              />
            ))}
          </ThemedView>

          <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
            <ThemedText type="heading" style={styles.sectionTitle}>
              Tasks completed by month
            </ThemedText>
            {months.map((m) => (
              <BarRow
                key={m.key}
                label={m.label}
                value={m.tasksDone}
                max={maxTasks}
                color={ModuleColors.tasks}
                formatValue={(v) => `${v}`}
              />
            ))}
          </ThemedView>

          <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
            <ThemedText type="heading" style={styles.sectionTitle}>
              Focus time by month
            </ThemedText>
            {months.map((m) => (
              <BarRow
                key={m.key}
                label={m.label}
                value={m.focusMinutes}
                max={maxFocus}
                color={ModuleColors.focus}
                formatValue={(v) => `${v}m`}
              />
            ))}
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
  totalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  totalCard: {
    flex: 1,
    minWidth: 150,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  card: { borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.three, gap: Spacing.two },
  sectionTitle: { marginBottom: Spacing.one },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  barLabel: { width: 32 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barValue: { width: 64, textAlign: 'right' },
});
