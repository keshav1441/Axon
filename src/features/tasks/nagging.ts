import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/** Identifier is the task ID itself, so re-scheduling naturally replaces any prior nag for that task. */
export async function scheduleNag(taskId: string, taskTitle: string, intervalMinutes: number): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(taskId);
  await Notifications.scheduleNotificationAsync({
    identifier: taskId,
    content: {
      title: 'Axon',
      body: `Update on "${taskTitle}"?`,
      data: { taskId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(60, Math.round(intervalMinutes * 60)),
      repeats: true,
    },
  });
}

export async function cancelNag(taskId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(taskId);
}
