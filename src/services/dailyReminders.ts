import * as Notifications from 'expo-notifications';

const MORNING_ID = 'phd-log-morning';
const LUNCH_ID = 'phd-log-lunch';
const EVENING_ID = 'phd-log-evening';

async function scheduleDaily(id: string, hour: number, body: string) {
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title: 'PHD', body, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute: 0,
      channelId: 'daily-log',
    },
  });
}

export async function scheduleDailyReminders(petName: string, earnedToday: boolean) {
  const current = await Notifications.getPermissionsAsync();
  const permission = current.status === 'granted' ? current : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return;

  await Notifications.setNotificationChannelAsync('daily-log', {
    name: 'Daily log',
    importance: Notifications.AndroidImportance.DEFAULT,
  });

  await Promise.all([
    Notifications.cancelScheduledNotificationAsync(MORNING_ID).catch(() => undefined),
    Notifications.cancelScheduledNotificationAsync(LUNCH_ID).catch(() => undefined),
    Notifications.cancelScheduledNotificationAsync(EVENING_ID).catch(() => undefined),
  ]);

  const name = petName || 'your pet';
  const evening = earnedToday
    ? `How was ${name}'s day? 🌙 Log their dinner or evening poop.`
    : `How was ${name}'s day? 🌙 Log their dinner or evening poop, and grab your 5 daily Bones! 🦴`;

  await scheduleDaily(MORNING_ID, 8, `Start your day with ${name}! ☀️ Tap to log their morning routine and see today's bio-rhythm timeline.`);
  await scheduleDaily(LUNCH_ID, 12, `${name}'s midday check. 🍖 Log a meal or how they're feeling.`);
  await scheduleDaily(EVENING_ID, 19, evening);
}
