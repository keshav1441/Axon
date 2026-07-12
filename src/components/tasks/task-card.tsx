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
  setTaskNagSchedule,
  updateSubtaskTitle,
  type TaskWithSubtasks,
} from '@/features/tasks/api';
import { cancelNag, ensureNotificationPermission, scheduleNag } from '@/features/tasks/nagging';

const NAG_PRESETS_MIN = [0, 30, 60, 120];

function SubtaskRow({
  subtask,
  onChanged,
  onToggle,
}: {
  subtask: TaskWithSubtasks['subtasks'][number];
  onChanged: () => void;
  onToggle: (subtaskId: string, done: boolean) => void;
}) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(subtask.title);

  const commitEdit = useCallback(async () => {
    setEditing(false);
    if (text.trim() && text !== subtask.title) {
      await updateSubtaskTitle(subtask.id, text.trim());
      onChanged();
    }
  }, [text, subtask, onChanged]);

  return (
    <View style={styles.subtaskRow}>
      <Pressable onPress={() => onToggle(subtask.id, !subtask.done)} hitSlop={10}>
        <Ionicons
          name={subtask.done ? 'checkmark-circle' : 'ellipse-outline'}
          size={22}
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
            type="body"
            themeColor={subtask.done ? 'textSecondary' : 'text'}
            style={subtask.done ? styles.strikethrough : undefined}>
            {subtask.title}
          </ThemedText>
        </Pressable>
      )}
      <Pressable onPress={() => deleteSubtask(subtask.id).then(onChanged)} hitSlop={10}>
        <Ionicons name="close" size={18} color={theme.textSecondary} />
      </Pressable>
    </View>
  );
}

function AddSubtaskRow({ taskId, onChanged }: { taskId: string; onChanged: () => void }) {
  const theme = useTheme();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const commit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setAdding(false);
      return;
    }
    setSaving(true);
    try {
      await addSubtasks(taskId, [trimmed]);
      setText('');
      setAdding(false);
      await onChanged();
    } finally {
      setSaving(false);
    }
  }, [taskId, text, onChanged]);

  if (!adding) {
    return (
      <Pressable style={styles.addSubtaskToggle} onPress={() => setAdding(true)} hitSlop={8}>
        <Ionicons name="add-circle-outline" size={18} color={ModuleColors.tasks} />
        <ThemedText type="small" style={{ color: ModuleColors.tasks }}>
          Add subtask
        </ThemedText>
      </Pressable>
    );
  }

  return (
    <View style={styles.addSubtaskRow}>
      <TextInput
        value={text}
        onChangeText={setText}
        onSubmitEditing={commit}
        onBlur={commit}
        autoFocus
        placeholder="Subtask title"
        placeholderTextColor={theme.textSecondary}
        style={[styles.subtaskInput, { color: theme.text }]}
        editable={!saving}
      />
    </View>
  );
}

export function TaskCard({
  task,
  onChanged,
  onToggleTask,
  onToggleSubtask,
  variant = 'active',
}: {
  task: TaskWithSubtasks;
  onChanged: () => void;
  onToggleTask: (taskId: string, done: boolean) => void;
  onToggleSubtask: (taskId: string, subtaskId: string, done: boolean) => void;
  variant?: 'active' | 'completed';
}) {
  const theme = useTheme();
  const [nagOpen, setNagOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');
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
      await setTaskNagSchedule(task.id, minutes === 0 ? null : minutes);
      setNagOpen(false);
      onChanged();
    },
    [task, onChanged],
  );

  const submitCustomNag = useCallback(() => {
    const parsed = Number(customMinutes);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      Alert.alert('Invalid', 'Enter a number of minutes greater than 0.');
      return;
    }
    setCustomMinutes('');
    setNag(Math.round(parsed));
  }, [customMinutes, setNag]);

  const subtaskRowHandler = useCallback(
    (subtaskId: string, done: boolean) => onToggleSubtask(task.id, subtaskId, done),
    [task.id, onToggleSubtask],
  );

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => onToggleTask(task.id, !task.done)} hitSlop={10}>
          <Ionicons
            name={task.done ? 'checkmark-circle' : 'ellipse-outline'}
            size={30}
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
        <Pressable onPress={() => deleteTask(task.id).then(onChanged)} hitSlop={10}>
          <Ionicons name="trash-outline" size={19} color={theme.textSecondary} />
        </Pressable>
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
        <SubtaskRow key={s.id} subtask={s} onChanged={onChanged} onToggle={subtaskRowHandler} />
      ))}

      {variant === 'active' && (
        <>
          <AddSubtaskRow taskId={task.id} onChanged={onChanged} />

          <Pressable style={styles.nagToggle} onPress={() => setNagOpen((v) => !v)}>
            <Ionicons name="alarm-outline" size={16} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary">
              {task.nag_interval_minutes ? `Nag every ${task.nag_interval_minutes}m` : 'Set a nag reminder'}
            </ThemedText>
            <Ionicons name={nagOpen ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textSecondary} />
          </Pressable>

          {nagOpen && (
            <View style={styles.nagPanel}>
              <View style={styles.nagRow}>
                {NAG_PRESETS_MIN.map((minutes) => {
                  const active = task.nag_interval_minutes === minutes || (minutes === 0 && !task.nag_interval_minutes);
                  return (
                    <Pressable
                      key={minutes}
                      onPress={() => setNag(minutes)}
                      style={[styles.nagChip, { borderColor: theme.border }, active && styles.nagChipActive]}>
                      <ThemedText type="small" style={active ? styles.nagChipActiveText : undefined}>
                        {minutes === 0 ? 'Off' : `${minutes}m`}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.customNagRow}>
                <TextInput
                  value={customMinutes}
                  onChangeText={setCustomMinutes}
                  placeholder="Custom minutes"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                  style={[styles.customNagInput, { color: theme.text, borderColor: theme.border }]}
                />
                <Pressable style={styles.customNagButton} onPress={submitCustomNag}>
                  <ThemedText type="small" style={styles.nagChipActiveText}>
                    Set
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          )}
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  title: { flex: 1, fontSize: 17 },
  strikethrough: { textDecorationLine: 'line-through' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: Spacing.two,
    paddingVertical: Spacing.half,
  },
  subtaskTitleWrap: { flex: 1 },
  subtaskInput: { flex: 1, fontSize: 15, paddingVertical: Spacing.one },
  addSubtaskToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingLeft: Spacing.two,
    paddingVertical: Spacing.one,
  },
  addSubtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.two,
  },
  nagToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
  },
  nagPanel: { gap: Spacing.two },
  nagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  nagChip: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  nagChipActive: {
    backgroundColor: ModuleColors.tasks,
    borderColor: ModuleColors.tasks,
  },
  nagChipActiveText: { color: '#1A1030', fontWeight: '700' },
  customNagRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  customNagInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
  },
  customNagButton: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    backgroundColor: ModuleColors.tasks,
  },
});
