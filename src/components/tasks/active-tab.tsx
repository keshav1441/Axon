import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
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

export const ActiveTab = forwardRef<ActiveTabHandle, { tasks: TaskWithSubtasks[]; onChanged: () => void }>(
  function ActiveTab({ tasks, onChanged }, ref) {
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
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
          <Pressable onPress={start} disabled={creating} hitSlop={6}>
            {creating ? (
              <Ionicons name="hourglass-outline" size={22} color={theme.textSecondary} />
            ) : (
              <Ionicons name={listening ? 'mic' : 'mic-outline'} size={22} color={ModuleColors.tasks} />
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
          open.map((task) => <TaskCard key={task.id} task={task} onChanged={onChanged} variant="active" />)
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
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  addInput: { flex: 1, fontSize: 16 },
  emptyCard: {
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
});
