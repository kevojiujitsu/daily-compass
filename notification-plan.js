// Shared by the app and scheduling tests. Notification bodies intentionally omit private entries.
globalThis.CompassNotificationPlan = {
  make(settings, entries, now = new Date()) {
    const notifications = [];
    const daily = (enabled, time, id, title, body, page, channelId) => {
      if (!enabled || !/^\d{2}:\d{2}$/.test(time)) return;
      const [hour, minute] = time.split(':').map(Number);
      if (hour > 23 || minute > 59) return;
      notifications.push({ id, title, body, channelId, smallIcon: 'ic_stat_compass', isExactNotification: false,
        schedule: { on: { hour, minute }, repeats: true }, extra: { page } });
    };
    daily(settings.daily, settings.dailyTime, 1001, 'Your Daily Compass check-in', 'Take a moment to reflect on your day.', 'home', 'compass-checkins');
    daily(settings.encouragement, settings.encouragementTime, 1002, 'A little encouragement', 'One small step is still progress. Make room for something that matters to you today.', 'home', 'compass-encouragement');
    if (settings.tasks) {
      entries.filter(entry => entry.category === 'Tasks' && !entry.completed && entry.reminderAt && Number.isFinite(entry.notificationId))
        .filter(entry => new Date(entry.reminderAt) > now)
        .sort((a, b) => new Date(a.reminderAt) - new Date(b.reminderAt)).slice(0, 50)
        .forEach(entry => notifications.push({ id: entry.notificationId, title: 'Daily Compass reminder',
          body: 'You have a task or goal to check on. Open Daily Compass to see it.', channelId: 'compass-tasks', smallIcon: 'ic_stat_compass',
          isExactNotification: false, schedule: { at: new Date(entry.reminderAt) }, extra: { page: 'tasks' } }));
    }
    return notifications;
  }
};
