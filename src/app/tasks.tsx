import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { ModuleTopBar } from '@/components/module-top-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModuleColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  addSubtasks,
  createTask,
  deleteSubtask,
  deleteTask,
  listTasksWithSubtasks,
  toggleSubtaskDone,
  toggleTaskDone,
  updateSubtaskTitle,
  type TaskWithSubtasks,
} from '@/features/tasks/api';
import { splitTaskIntoSubtasks } from '@/features/tasks/claude';
import { cancelNag, ensureNotificationPermission, scheduleNag } from '@/features/tasks/nagging';
import { useVoiceCapture } from '@/features/tasks/use-voice-capture';

const NAG_PRESETS_MIN = [0, 30, 60, 120];

function SubtaskRowView({
  subtask,
  onChanged,
}: {
  subtask: TaskWithSubtasks['subtasks'][number];
  onChanged: () => void;
}) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(subtask.title);
  const [splitting, setSplitting] = useState(false);

  const commitEdit = useCallback(async () => {
    setEditing(false);
    if (text.trim() && text !== subtask.title) {
      await updateSubtaskTitle(subtask.id, text.trim());
      onChanged();
    }
  }, [text, subtask, onChanged]);

  const splitFurther = useCallback(async () => {
    setSplitting(true);
    try {
      const more = await splitTaskIntoSubtasks(subtask.title);
      await deleteSubtask(subtask.id);
      await addSubtasks(subtask.task_id, more);
      onChanged();
    } catch (err) {
      Alert.alert('Could not split', String(err));
    } finally {
      setSplitting(false);
    }
  }, [subtask, onChanged]);

  return (
    <View style={styles.subtaskRow}>
      <Pressable onPress={() => toggleSubtaskDone(subtask.id, !subtask.done).then(onChanged)}>
        <ThemedText type="body">{subtask.done ? '☑' : '☐'}</ThemedText>
      </Pressable>
      {editing ? (
        <TextInput
          value={text}
          onChangeText={setText}
          onBlur={commitEdit}
          autoFocus
          style={[styles.subtaskInput, { color: theme.text }]}
        />
      ) : (
        <Pressable style={styles.subtaskTitleWrap} onPress={() => setEditing(true)}>
          <ThemedText
            type="body"
            themeColor={subtask.done ? 'textSecondary' : 'text'}
            style={subtask.done ? styles.strikethrough : undefined}>
            {subtask.title}
          </ThemedText>
        </Pressable>
      )}
      <Pressable onPress={splitFurther} disabled={splitting}>
        <ThemedText type="small" themeColor="textSecondary">
          {splitting ? '…' : '+ split'}
        </ThemedText>
      </Pressable>
      <Pressable onPress={() => deleteSubtask(subtask.id).then(onChanged)}>
        <ThemedText type="small" themeColor="textSecondary">
          ✕
        </ThemedText>
      </Pressable>
    </View>
  );
}

function TaskCardView({ task, onChanged }: { task: TaskWithSubtasks; onChanged: () => void }) {
  const setNag = useCallback(
    async (minutes: number) => {
      if (minutes === 0) {
        await cancelNag(task.id);
      } else {
        const granted = await ensureNotificationPermission();
        if (!granted) return;
        await scheduleNag(task.id, task.title, minutes);
      }
      onChanged();
    },
    [task, onChanged],
  );

  const { listening, start } = useVoiceCapture((text) => {
    if (/\bdone\b/i.test(text)) {
      toggleTaskDone(task.id, true).then(onChanged);
    }
  });

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.taskHeaderRow}>
        <Pressable onPress={() => toggleTaskDone(task.id, !task.done).then(onChanged)}>
          <ThemedText type="body">{task.done ? '☑' : '☐'}</ThemedText>
        </Pressable>
        <ThemedText
          type="heading"
          style={[styles.taskTitle, task.done ? styles.strikethrough : undefined]}
          themeColor={task.done ? 'textSecondary' : 'text'}>
          {task.title}
        </ThemedText>
        <Pressable onPress={start}>
          <ThemedText type="small" themeColor="textSecondary">
            {listening ? '🎙…' : '🎙'}
          </ThemedText>
        </Pressable>
        <Pressable onPress={() => deleteTask(task.id).then(onChanged)}>
          <ThemedText type="small" themeColor="textSecondary">
            ✕
          </ThemedText>
        </Pressable>
      </View>

      {task.subtasks.map((s) => (
        <SubtaskRowView key={s.id} subtask={s} onChanged={onChanged} />
      ))}

      <View style={styles.nagRow}>
        <ThemedText type="micro" themeColor="textSecondary">
          NAG
        </ThemedText>
        {NAG_PRESETS_MIN.map((minutes) => (
          <Pressable
            key={minutes}
            onPress={() => setNag(minutes)}
            style={[
              styles.nagChip,
              task.nag_interval_minutes === minutes && styles.nagChipActive,
            ]}>
            <ThemedText type="micro">{minutes === 0 ? 'off' : `${minutes}m`}</ThemedText>
          </Pressable>
        ))}
      </View>
    </ThemedView>
  );
}

export default function TasksScreen() {
  const theme = useTheme();
  const [tasks, setTasks] = useState<TaskWithSubtasks[]>([]);
  const [manualText, setManualText] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setTasks(await listTasksWithSubtasks());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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
        await load();
      } finally {
        setCreating(false);
      }
    },
    [load],
  );

  const { listening, start } = useVoiceCapture((text) => addTask(text));

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ModuleTopBar title="Tasks" accent={ModuleColors.tasks} subtitle="Speak a task, get subtasks" />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedView type="backgroundElement" style={styles.addCard}>
            <TextInput
              value={manualText}
              onChangeText={setManualText}
              onSubmitEditing={() => addTask(manualText)}
              placeholder="Type a task, or use the mic"
              placeholderTextColor={theme.textSecondary}
              style={[styles.addInput, { color: theme.text }]}
            />
            <Pressable onPress={start} disabled={creating}>
              <ThemedText type="heading" style={{ color: ModuleColors.tasks }}>
                {listening ? '🎙…' : creating ? '…' : '🎙'}
              </ThemedText>
            </Pressable>
          </ThemedView>

          {tasks.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="body" themeColor="textSecondary">
                No tasks yet. Tap the mic to add one.
              </ThemedText>
            </ThemedView>
          ) : (
            tasks.map((task) => <TaskCardView key={task.id} task={task} onChanged={load} />)
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { padding: Spacing.four, gap: Spacing.three },
  card: { borderRadius: Radius.large, padding: Spacing.three, gap: Spacing.two },
  addCard: {
    borderRadius: Radius.large,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  addInput: {
    flex: 1,
    fontSize: 16,
  },
  taskHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  taskTitle: { flex: 1 },
  strikethrough: { textDecorationLine: 'line-through' },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: Spacing.four,
  },
  subtaskTitleWrap: { flex: 1 },
  subtaskInput: {
    flex: 1,
    fontSize: 15,
  },
  nagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  nagChip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  nagChipActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
});
