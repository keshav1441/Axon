import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { TaskCard } from '@/components/tasks/task-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModuleColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addSubtasks, createTask, type TaskWithSubtasks } from '@/features/tasks/api';
import { splitTaskIntoSubtasks } from '@/features/tasks/claude';
import { useVoiceCapture } from '@/features/tasks/use-voice-capture';

export type ActiveTabHandle = { focusInput: () => void };

export const ActiveTab = forwardRef<
  ActiveTabHandle,
  {
    tasks: TaskWithSubtasks[];
    onChanged: () => void;
    onToggleTask: (taskId: string, done: boolean) => void;
    onToggleSubtask: (taskId: string, subtaskId: string, done: boolean) => void;
    onRemoveTask: (taskId: string) => void;
    onRemoveSubtask: (taskId: string, subtaskId: string) => void;
    refreshing: boolean;
    onRefresh: () => void;
  }
>(function ActiveTab(
  { tasks, onChanged, onToggleTask, onToggleSubtask, onRemoveTask, onRemoveSubtask, refreshing, onRefresh },
  ref,
) {
    const theme = useTheme();
    const [manualText, setManualText] = useState('');
    const [creating, setCreating] = useState(false);
    const inputRef = useRef<TextInput>(null);

    useImperativeHandle(ref, () => ({ focusInput: () => inputRef.current?.focus() }), []);

    const addTask = useCallback(
      async (title: string) => {
        const trimmed = title.trim();
        if (!trimmed) return;
        setCreating(true);
        try {
          const taskId = await createTask(trimmed);
          try {
            const subtasks = await splitTaskIntoSubtasks(trimmed);
            await addSubtasks(taskId, subtasks);
          } catch (err) {
            Alert.alert('Added without subtasks', String(err));
          }
          setManualText('');
          await onChanged();
        } catch (err) {
          Alert.alert('Could not add task', String(err));
        } finally {
          setCreating(false);
        }
      },
      [onChanged],
    );

    const { listening, start } = useVoiceCapture((text) => addTask(text));

    const open = tasks.filter((t) => !t.done);

    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ModuleColors.tasks} />}>
        <ThemedView type="backgroundElement" style={[styles.addCard, { borderColor: theme.border }]}>
          <TextInput
            ref={inputRef}
            value={manualText}
            onChangeText={setManualText}
            onSubmitEditing={() => addTask(manualText)}
            placeholder="Type a task, or use the mic"
            placeholderTextColor={theme.textSecondary}
            style={[styles.addInput, { color: theme.text }]}
          />
          <Pressable onPress={start} disabled={creating} hitSlop={10}>
            {creating ? (
              <Ionicons name="hourglass-outline" size={26} color={theme.textSecondary} />
            ) : (
              <Ionicons name={listening ? 'mic' : 'mic-outline'} size={26} color={ModuleColors.tasks} />
            )}
          </Pressable>
        </ThemedView>

        {open.length === 0 ? (
          <ThemedView type="backgroundElement" style={[styles.emptyCard, { borderColor: theme.border }]}>
            <Ionicons name="checkmark-done-circle-outline" size={32} color={theme.textSecondary} />
            <ThemedText type="body" themeColor="textSecondary">
              No open tasks. Tap the mic to add one.
            </ThemedText>
          </ThemedView>
        ) : (
          open.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onChanged={onChanged}
              onToggleTask={onToggleTask}
              onToggleSubtask={onToggleSubtask}
              onRemoveTask={onRemoveTask}
              onRemoveSubtask={onRemoveSubtask}
              variant="active"
            />
          ))
        )}
      </ScrollView>
    );
  },
);

const styles = StyleSheet.create({
  scrollContent: { padding: Spacing.four, gap: Spacing.three },
  addCard: {
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  addInput: { flex: 1, fontSize: 17, paddingVertical: Spacing.one },
  emptyCard: {
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
});
