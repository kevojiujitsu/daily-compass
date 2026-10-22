(() => {
  const key = `daily-compass-notifications-v1:${profile?.id || profile?.email || 'local'}`;
  const defaults = { daily: false, dailyTime: '20:00', tasks: false, encouragement: false, encouragementTime: '09:00', announcements: false };
  let settings;
  try { settings = { ...defaults, ...JSON.parse(localStorage.getItem(key) || '{}') }; } catch { settings = { ...defaults }; }
  const native = window.Capacitor?.getPlatform?.() === 'android';
  const local = native ? window.capacitorLocalNotifications?.LocalNotifications : null;
  const push = native ? window.capacitorPushNotifications?.PushNotifications : null;
  const dialog = document.getElementById('notificationsDialog');
  const status = document.getElementById('notificationStatus');
  let queue = Promise.resolve(), pushListeners = false, deviceToken = localStorage.getItem('daily-compass-push-token') || '';
  const tell = message => { status.textContent = message; };
  const persist = () => localStorage.setItem(key, JSON.stringify(settings));
  const fields = ['daily', 'dailyTime', 'tasks', 'encouragement', 'encouragementTime', 'announcements'];
  function renderSettings() {
    fields.forEach(name => { const input = document.getElementById(`notify-${name}`); if (input.type === 'checkbox') input.checked = Boolean(settings[name]); else input.value = settings[name]; });
  }
  async function permission(ask) {
    if (!local) throw new Error('Phone reminders are available in the updated Android app.');
    let result = await local.checkPermissions();
    if (ask && result.display !== 'granted') result = await local.requestPermissions();
    if (result.display !== 'granted') throw new Error('Notifications are blocked. Allow Daily Compass notifications in your phone settings, then try again.');
  }
  async function channels() {
    for (const [id, name] of [['compass-checkins', 'Daily check-ins'], ['compass-tasks', 'Tasks and goals'], ['compass-encouragement', 'Encouragement'], ['compass-announcements', 'App announcements']]) {
      await local.createChannel({ id, name, importance: 3, visibility: 0 });
    }
  }
  function sync() {
    queue = queue.catch(() => {}).then(async () => {
      if (!local) return;
      const pending = await local.getPending();
      const owned = pending.notifications.filter(item => [1001, 1002, 1003].includes(item.id) || item.id >= 10000);
      if (owned.length) await local.cancel({ notifications: owned.map(item => ({ id: item.id })) });
      if (!(settings.daily || settings.tasks || settings.encouragement)) return;
      await permission(false);
      const notifications = CompassNotificationPlan.make(settings, entries);
      if (notifications.length) { await channels(); await local.schedule({ notifications }); }
    });
    return queue;
  }
  async function tokenRequest(method, token) {
    const response = await fetch(apiUrl('/api/notifications/device'), { method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem(AUTH_KEY)}` }, body: JSON.stringify({ token }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not save announcement preferences.');
  }
  async function setupPush() {
    if (!window.DAILY_COMPASS_PUSH_CONFIGURED || !push) throw new Error('App announcements need Firebase setup and a new Android release. Daily reminders work independently.');
    if (!pushListeners) {
      await push.addListener('registration', async ({ value }) => {
        deviceToken = value; localStorage.setItem('daily-compass-push-token', value);
        if (!settings.announcements) return;
        try { await tokenRequest('POST', value); tell('Phone reminders and announcements are enabled according to your choices.'); }
        catch (error) { tell(error.message); }
      });
      await push.addListener('registrationError', () => tell('Could not connect phone announcements. Check the Firebase setup and try again.'));
      await push.addListener('pushNotificationActionPerformed', () => showPage('home'));
      pushListeners = true;
    }
    const permissions = await push.checkPermissions();
    if (permissions.receive !== 'granted') throw new Error('Allow notifications on your phone before enabling announcements.');
    if (deviceToken) await tokenRequest('POST', deviceToken);
    await push.register();
  }
  document.getElementById('notificationsBtn').onclick = async () => {
    renderSettings(); dialog.showModal();
    tell(native ? 'Choose what reaches your phone. Reminder times use your phone’s local time and may be delayed by battery settings.' : 'Phone notifications are available in the Android app.');
    try {
      const response = await fetch(apiUrl('/api/notifications/status'), { headers: { Authorization: `Bearer ${localStorage.getItem(AUTH_KEY)}` } });
      if (response.ok) { const data = await response.json(); document.getElementById('announcementComposer').hidden = !data.canSend; }
    } catch { /* Reminders work without the server. */ }
  };
  document.getElementById('notificationSave').onclick = async event => {
    const button = event.currentTarget; button.disabled = true;
    const next = Object.fromEntries(fields.map(name => { const input = document.getElementById(`notify-${name}`); return [name, input.type === 'checkbox' ? input.checked : input.value]; }));
    try {
      if (next.daily || next.tasks || next.encouragement || next.announcements) await permission(true);
      if (next.announcements && !window.DAILY_COMPASS_PUSH_CONFIGURED) throw new Error('Announcements need Firebase setup first. Turn that option off to save phone reminders now.');
      if (!next.announcements && deviceToken) {
        await tokenRequest('DELETE', deviceToken);
        if (push && window.DAILY_COMPASS_PUSH_CONFIGURED) await push.unregister();
        deviceToken = ''; localStorage.removeItem('daily-compass-push-token');
      }
      const before = settings; settings = next;
      try { await sync(); if (settings.announcements) await setupPush(); }
      catch (error) { settings = before; await sync().catch(() => {}); throw error; }
      persist(); tell('Saved. Your reminders will appear in your phone’s notifications, including when the app is closed.');
    } catch (error) { tell(error.message); } finally { button.disabled = false; }
  };
  document.getElementById('notificationTest').onclick = async () => {
    try { await permission(true); await channels(); await local.schedule({ notifications: [{ id: 1003, title: 'Daily Compass', body: 'Your phone notifications are working.', channelId: 'compass-checkins', smallIcon: 'ic_stat_compass', isExactNotification: false, schedule: { at: new Date(Date.now() + 5000) } }] }); tell('Test scheduled. Check your phone’s notification tray in a few seconds.'); }
    catch (error) { tell(error.message); }
  };
  document.getElementById('announcementSend').onclick = async event => {
    const title = document.getElementById('announcementTitle').value.trim(), body = document.getElementById('announcementBody').value.trim();
    if (!title || !body) { tell('Add an announcement title and message.'); return; }
    if (!confirm(`Send this phone notification to everyone who enabled announcements?\n\n${title}\n${body}`)) return;
    event.currentTarget.disabled = true;
    try {
      const response = await fetch(apiUrl('/api/notifications/announce'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem(AUTH_KEY)}` }, body: JSON.stringify({ title, body, requestId: crypto.randomUUID() }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not send announcement.');
      tell(`Accepted by the notification service for ${data.sent} devices; ${data.failed} failed. Delivery depends on each phone’s settings.`);
    } catch (error) { tell(error.message); } finally { document.getElementById('announcementSend').disabled = false; }
  };
  window.compassNotifications = {
    sync: () => sync().catch(error => tell(error.message)),
    async cleanup(accountDeleted = false) { settings = { ...defaults }; persist(); await sync(); if (deviceToken && !accountDeleted) await tokenRequest('DELETE', deviceToken); localStorage.removeItem('daily-compass-push-token'); if (push && window.DAILY_COMPASS_PUSH_CONFIGURED) await push.unregister(); },
    settings: () => ({ ...settings })
  };
  if (local) {
    local.addListener('localNotificationActionPerformed', event => { if (['home', 'tasks'].includes(event.notification.extra?.page)) showPage(event.notification.extra.page); }).catch(() => {});
    // Never request notification permission just because someone opened the app.
    sync().catch(error => tell(error.message));
    if (settings.announcements) setupPush().catch(error => tell(error.message));
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) window.compassNotifications.sync(); });
})();
