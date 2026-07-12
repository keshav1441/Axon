import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ActiveTab, type ActiveTabHandle } from '@/components/tasks/active-tab';
import { CompletedTab } from '@/components/tasks/completed-tab';
import { DashboardTab } from '@/components/tasks/dashboard-tab';
import { ModuleTopBar } from '@/components/module-top-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModuleColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listTasksWithSubtasks, type TaskWithSubtasks } from '@/features/tasks/api';

type TasksTab = 'dashboard' | 'active' | 'completed';

const TABS: { key: TasksTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'bar-chart-outline' },
  { key: 'active', label: 'Active', icon: 'list-outline' },
  { key: 'completed', label: 'Completed', icon: 'checkmark-done-outline' },
];

export default function TasksScreen() {
  const theme = useTheme();
  const [tab, setTab] = useState<TasksTab>('dashboard');
  const [tasks, setTasks] = useState<TaskWithSubtasks[]>([]);
  const activeTabRef = useRef<ActiveTabHandle>(null);

  const load = useCallback(async () => {
    setTasks(await listTasksWithSubtasks());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const goToActiveAndFocus = useCallback(() => {
    setTab('active');
    setTimeout(() => activeTabRef.current?.focusInput(), 50);
  }, []);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ModuleTopBar title="Tasks" accent={ModuleColors.tasks} />

        <View style={styles.content}>
          {tab === 'dashboard' && (
            <DashboardTab tasks={tasks} onAddTask={goToActiveAndFocus} onSeeActive={() => setTab('active')} />
          )}
          {tab === 'active' && <ActiveTab ref={activeTabRef} tasks={tasks} onChanged={load} />}
          {tab === 'completed' && <CompletedTab tasks={tasks} onChanged={load} />}
        </View>

        <View style={[styles.bottomBar, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[styles.bottomBarItem, { borderColor: theme.border }, active && styles.bottomBarItemActive]}>
                <Ionicons name={t.icon} size={20} color={active ? ModuleColors.tasks : theme.textSecondary} />
                <ThemedText
                  type="micro"
                  style={active ? { color: ModuleColors.tasks, fontWeight: '600' } : { color: theme.textSecondary }}>
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
    padding: Spacing.two,
  },
  bottomBarItem: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bottomBarItemActive: {
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderColor: 'rgba(167,139,250,0.35)',
  },
});
