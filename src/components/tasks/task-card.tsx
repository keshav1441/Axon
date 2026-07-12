import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModuleColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  addSubtasks,
  deleteSubtask,
  deleteTask,
  toggleSubtaskDone,
  toggleTaskDone,
  updateSubtaskTitle,
  type TaskWithSubtasks,
} from '@/features/tasks/api';
import { splitTaskIntoSubtasks } from '@/features/tasks/claude';
import { cancelNag, ensureNotificationPermission, scheduleNag } from '@/features/tasks/nagging';
import { useVoiceCapture } from '@/features/tasks/use-voice-capture';

const NAG_PRESETS_MIN = [0, 30, 60, 120];

function SubtaskRow({ subtask, onChanged }: { subtask: TaskWithSubtasks['subtasks'][number]; onChanged: () => void }) {
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
      <Pressable onPress={() => toggleSubtaskDone(subtask.id, !subtask.done).then(onChanged)} hitSlop={6}>
        <Ionicons
          name={subtask.done ? 'checkmark-circle' : 'ellipse-outline'}
          size={18}
          color={subtask.done ? ModuleColors.tasks : theme.textSecondary}
        />
      </Pressable>
      {editing ? (
        <TextInput
          value={text}
          onChangeText={setText}
          onBlur={commitEdit}
          onSubmitEditing={commitEdit}
          autoFocus
          style={[styles.subtaskInput, { color: theme.text }]}
        />
      ) : (
        <Pressable style={styles.subtaskTitleWrap} onPress={() => setEditing(true)}>
          <ThemedText
            type="small"
            themeColor={subtask.done ? 'textSecondary' : 'text'}
            style={subtask.done ? styles.strikethrough : undefined}>
            {subtask.title}
          </ThemedText>
        </Pressable>
      )}
      <Pressable onPress={splitFurther} disabled={splitting} hitSlop={6}>
        <Ionicons name="sparkles-outline" size={15} color={splitting ? theme.border : theme.textSecondary} />
      </Pressable>
      <Pressable onPress={() => deleteSubtask(subtask.id).then(onChanged)} hitSlop={6}>
        <Ionicons name="close" size={16} color={theme.textSecondary} />
      </Pressable>
    </View>
  );
}

export function TaskCard({
  task,
  onChanged,
  variant = 'active',
}: {
  task: TaskWithSubtasks;
  onChanged: () => void;
  variant?: 'active' | 'completed';
}) {
  const theme = useTheme();
  const doneSubtasks = task.subtasks.filter((s) => s.done).length;
  const totalSubtasks = task.subtasks.length;
  const progress = totalSubtasks > 0 ? doneSubtasks / totalSubtasks : 0;

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
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => toggleTaskDone(task.id, !task.done).then(onChanged)} hitSlop={6}>
          <Ionicons
            name={task.done ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={task.done ? ModuleColors.tasks : theme.textSecondary}
          />
        </Pressable>
        <ThemedText
          type="body"
          style={[styles.title, task.done ? styles.strikethrough : undefined]}
          themeColor={task.done ? 'textSecondary' : 'text'}
          numberOfLines={2}>
          {task.title}
        </ThemedText>
        {variant === 'active' ? (
          <>
            <Pressable onPress={start} hitSlop={6}>
              <Ionicons name={listening ? 'mic' : 'mic-outline'} size={18} color={listening ? ModuleColors.tasks : theme.textSecondary} />
            </Pressable>
            <Pressable onPress={() => deleteTask(task.id).then(onChanged)} hitSlop={6}>
              <Ionicons name="trash-outline" size={17} color={theme.textSecondary} />
            </Pressable>
          </>
        ) : (
          <Pressable onPress={() => deleteTask(task.id).then(onChanged)} hitSlop={6}>
            <Ionicons name="trash-outline" size={17} color={theme.textSecondary} />
          </Pressable>
        )}
      </View>

      {totalSubtasks > 0 && (
        <View style={styles.progressRow}>
          <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
            <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: ModuleColors.tasks }]} />
          </View>
          <ThemedText type="micro" themeColor="textSecondary">
            {doneSubtasks}/{totalSubtasks}
          </ThemedText>
        </View>
      )}

      {task.subtasks.map((s) => (
        <SubtaskRow key={s.id} subtask={s} onChanged={onChanged} />
      ))}

      {variant === 'active' && (
        <View style={styles.nagRow}>
          <Ionicons name="alarm-outline" size={14} color={theme.textSecondary} />
          {NAG_PRESETS_MIN.map((minutes) => (
            <Pressable
              key={minutes}
              onPress={() => setNag(minutes)}
              style={[
                styles.nagChip,
                { borderColor: theme.border },
                task.nag_interval_minutes === minutes && styles.nagChipActive,
              ]}>
              <ThemedText type="micro" style={task.nag_interval_minutes === minutes ? { color: ModuleColors.tasks } : undefined}>
                {minutes === 0 ? 'off' : `${minutes}m`}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: { flex: 1 },
  strikethrough: { textDecorationLine: 'line-through' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  progressTrack: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: Spacing.four,
  },
  subtaskTitleWrap: { flex: 1 },
  subtaskInput: { flex: 1, fontSize: 14 },
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
    borderWidth: StyleSheet.hairlineWidth,
  },
  nagChipActive: {
    backgroundColor: 'rgba(167,139,250,0.14)',
    borderColor: 'rgba(167,139,250,0.4)',
  },
});
