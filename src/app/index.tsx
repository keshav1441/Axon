import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { StatCard } from '@/components/stat-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModuleColors, Spacing } from '@/constants/theme';
import { getDashboardSummary, type DashboardSummary } from '@/features/dashboard/summary';

function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

const EMPTY_SUMMARY: DashboardSummary = {
  monthSpend: 0,
  monthIncome: 0,
  tasksDone: 0,
  tasksTotal: 0,
  screenTimeMinutesToday: 0,
  focusStreakDays: 0,
  todayScore: 100,
};

export default function HomeScreen() {
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);

  useFocusEffect(
    useCallback(() => {
      getDashboardSummary().then(setSummary);
    }, []),
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="display">Today</ThemedText>

          <ThemedView type="backgroundElement" style={styles.scoreCard}>
            <ThemedText type="micro" themeColor="textSecondary">
              TODAY'S SCORE
            </ThemedText>
            <ThemedText type="display" style={styles.scoreValue}>
              {summary.todayScore}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Task completion and staying under Focus budgets, blended into one number.
            </ThemedText>
          </ThemedView>

          <View style={styles.grid}>
            <StatCard
              label="Spend this month"
              value={formatRupees(summary.monthSpend)}
              subtitle={summary.monthSpend === 0 ? 'No transactions yet' : `${formatRupees(summary.monthIncome)} in`}
              accent={ModuleColors.money}
            />
            <StatCard
              label="Tasks"
              value={`${summary.tasksDone} / ${summary.tasksTotal}`}
              subtitle={summary.tasksTotal === 0 ? 'Nothing yet' : 'done'}
              accent={ModuleColors.tasks}
            />
            <StatCard
              label="Screen time today"
              value={`${summary.screenTimeMinutesToday}m`}
              subtitle="across distraction apps"
              accent={ModuleColors.focus}
            />
            <StatCard
              label="Focus streak"
              value={`${summary.focusStreakDays} days`}
              subtitle="under budget"
              accent={ModuleColors.focus}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  scoreCard: {
    borderRadius: 24,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  scoreValue: {
    fontSize: 56,
    lineHeight: 60,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
});
