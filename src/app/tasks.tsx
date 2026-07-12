import { useCallback, useEffect, useRef, useState } from 'react';
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
import {
  deleteSubtask,
  deleteTask,
  listTasksWithSubtasks,
  toggleSubtaskDone,
  toggleTaskDone,
  type TaskWithSubtasks,
} from '@/features/tasks/api';
import { readCache, writeCache } from '@/lib/cache';

const TASKS_CACHE_KEY = 'tasks-list';

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
  const tasksRef = useRef<TaskWithSubtasks[]>([]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const load = useCallback(async () => {
    const fresh = await listTasksWithSubtasks();
    setTasks(fresh);
    writeCache(TASKS_CACHE_KEY, fresh);
  }, []);

  useEffect(() => {
    readCache<TaskWithSubtasks[]>(TASKS_CACHE_KEY).then((cached) => {
      if (cached) setTasks(cached);
    });
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

  /** Optimistic - flips local state immediately so the checkbox never waits on a round-trip; syncs to the server in the background. */
  const toggleTask = useCallback((taskId: string, done: boolean) => {
    const target = tasksRef.current.find((t) => t.id === taskId);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, done, subtasks: done ? t.subtasks.map((s) => ({ ...s, done: true })) : t.subtasks }
          : t,
      ),
    );
    toggleTaskDone(taskId, done).catch(() => {});
    if (done && target) {
      for (const s of target.subtasks) {
        if (!s.done) toggleSubtaskDone(s.id, true).catch(() => {});
      }
    }
  }, []);

  const toggleSubtask = useCallback((taskId: string, subtaskId: string, done: boolean) => {
    const target = tasksRef.current.find((t) => t.id === taskId);
    const allDone = target ? target.subtasks.every((s) => (s.id === subtaskId ? done : s.done)) : false;

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const subtasks = t.subtasks.map((s) => (s.id === subtaskId ? { ...s, done } : s));
        const parentDone = subtasks.length > 0 && subtasks.every((s) => s.done);
        return { ...t, subtasks, done: parentDone ? true : t.done };
      }),
    );

    toggleSubtaskDone(subtaskId, done).catch(() => {});
    if (allDone) toggleTaskDone(taskId, true).catch(() => {});
  }, []);

  const removeTask = useCallback((taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    deleteTask(taskId).catch(() => {});
  }, []);

  const removeSubtask = useCallback((taskId: string, subtaskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) } : t)),
    );
    deleteSubtask(subtaskId).catch(() => {});
  }, []);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ModuleTopBar title="Tasks" accent={ModuleColors.tasks} />

        <View style={styles.content}>
          {tab === 'dashboard' && (
            <DashboardTab tasks={tasks} onAddTask={goToActiveAndFocus} onSeeActive={() => setTab('active')} />
          )}
          {tab === 'active' && (
            <ActiveTab
              ref={activeTabRef}
              tasks={tasks}
              onChanged={load}
              onToggleTask={toggleTask}
              onToggleSubtask={toggleSubtask}
              onRemoveTask={removeTask}
              onRemoveSubtask={removeSubtask}
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          )}
          {tab === 'completed' && (
            <CompletedTab
              tasks={tasks}
              onChanged={load}
              onToggleTask={toggleTask}
              onToggleSubtask={toggleSubtask}
              onRemoveTask={removeTask}
              onRemoveSubtask={removeSubtask}
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
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
                <Ionicons name={t.icon} size={24} color={active ? ModuleColors.tasks : theme.textSecondary} />
                <ThemedText
                  type="small"
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
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderColor: 'rgba(167,139,250,0.35)',
  },
});
