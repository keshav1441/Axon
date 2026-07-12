import { ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { TaskCard } from '@/components/tasks/task-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { TaskWithSubtasks } from '@/features/tasks/api';

export function CompletedTab({
  tasks,
  onChanged,
  onToggleTask,
  onToggleSubtask,
}: {
  tasks: TaskWithSubtasks[];
  onChanged: () => void;
  onToggleTask: (taskId: string, done: boolean) => void;
  onToggleSubtask: (taskId: string, subtaskId: string, done: boolean) => void;
}) {
  const theme = useTheme();
  const done = tasks.filter((t) => t.done);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {done.length === 0 ? (
        <ThemedView type="backgroundElement" style={[styles.emptyCard, { borderColor: theme.border }]}>
          <Ionicons name="trophy-outline" size={32} color={theme.textSecondary} />
          <ThemedText type="body" themeColor="textSecondary">
            Nothing completed yet.
          </ThemedText>
        </ThemedView>
      ) : (
        done.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onChanged={onChanged}
            onToggleTask={onToggleTask}
            onToggleSubtask={onToggleSubtask}
            variant="completed"
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: Spacing.four, gap: Spacing.three },
  emptyCard: {
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
});
