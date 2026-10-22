import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { generateKeyPairSync } from 'node:crypto';
import { handleNotifications, sendAnnouncement } from '../push-service.mjs';
await import('../notification-plan.js');
const make = globalThis.CompassNotificationPlan.make;
const now = new Date('2026-10-21T12:00:00'), base = { daily: true, dailyTime: '20:30', encouragement: true, encouragementTime: '09:15', tasks: true };
const entry = { id: 'task-a', category: 'Tasks', text: 'PRIVATE task text', reminderAt: '2026-10-22T10:00', notificationId: 10001 };
const plan = make(base, [entry, { ...entry, notificationId: 10002, completed: true }, { ...entry, notificationId: 10003, reminderAt: '2026-10-20T10:00' }], now);
assert.equal(plan.length, 3); assert.deepEqual(plan[0].schedule.on, { hour: 20, minute: 30 });
assert.equal(plan[2].id, 10001); assert.ok(plan[2].schedule.at instanceof Date);
assert.ok(plan.every(item => item.isExactNotification === false));
assert.ok(!JSON.stringify(plan).includes('PRIVATE'));
assert.deepEqual(make({ ...base, daily: false, encouragement: false, tasks: false }, [entry], now), []);
assert.equal(make({ ...base, dailyTime: '25:00', encouragementTime: 'bad' }, [], now).length, 0);
assert.equal(make({ ...base, daily: false, encouragement: false }, Array.from({ length: 70 }, (_, i) => ({ ...entry, notificationId: 10000 + i })), now).length, 50);
console.log('PASS: local schedule selection, time validation, privacy, cancellation settings, and queue cap');

const tokenA = 'a'.repeat(40), tokenB = 'b'.repeat(40), database = { users: [{ id: 'owner', email: 'owner@example.test', pushDevices: [{ token: tokenA }] }, { id: 'member', email: 'member@example.test', pushDevices: [] }] };
process.env.DAILY_COMPASS_ANNOUNCEMENT_EMAIL = 'owner@example.test';
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: 'test-project', client_email: 'test@example.test', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) });
const calls = []; globalThis.fetch = async (url, options) => {
  calls.push({ url, options });
  if (url.includes('oauth2')) return { ok: true, json: async () => ({ access_token: 'fake-bearer', expires_in: 3600 }) };
  const message = JSON.parse(options.body).message;
  return { ok: message.token !== tokenB, json: async () => message.token === tokenB ? { error: { details: [{ errorCode: 'UNREGISTERED' }] } } : { name: 'accepted' } };
};
async function route(user, method, endpoint, body = {}) {
  let output;
  await handleNotifications({ req: { method }, res: {}, url: new URL(endpoint, 'http://localhost'), auth: { user }, database,
    mutateDatabase: async operation => operation(database), sendJson: (_, status, data) => { output = { status, data }; },
    readJson: async () => body, cors: {}, allowRequest: () => true });
  return output;
}
assert.equal((await route(database.users[1], 'POST', '/api/notifications/announce', { title: 'hello', body: 'world' })).status, 403);
assert.equal((await route(database.users[0], 'POST', '/api/notifications/device', { token: tokenB })).status, 200);
assert.equal((await route(database.users[1], 'POST', '/api/notifications/device', { token: tokenA })).status, 200);
assert.equal(database.users[0].pushDevices.some(device => device.token === tokenA), false);
assert.equal((await route(database.users[1], 'DELETE', '/api/notifications/device', { token: tokenA })).status, 200);
assert.equal(database.users[1].pushDevices.length, 0);
assert.equal((await route(database.users[0], 'POST', '/api/notifications/device', { token: 'bad' })).status, 400);
const body = { title: 'News', body: 'New features available', requestId: '12345678-1234-1234-1234-123456789abc' };
const result = await route(database.users[0], 'POST', '/api/notifications/announce', body);
assert.equal(result.status, 200); assert.equal(result.data.failed, 1);
assert.equal(database.users[0].pushDevices.length, 0);
assert.equal((await route(database.users[0], 'POST', '/api/notifications/announce', body)).status, 409);
const delivery = await sendAnnouncement([tokenA], 'Title', 'Body'); assert.equal(delivery.sent, 1);
assert.equal(JSON.parse(calls.at(-1).options.body).message.android.notification.channel_id, 'compass-announcements');
assert.equal(JSON.parse(calls.at(-1).options.body).message.notification.title, 'Title');
delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
assert.equal((await route(database.users[0], 'POST', '/api/notifications/device', { token: tokenA })).status, 503);
console.log('PASS: owner authorization, device ownership, opt-out, token validation, duplicate prevention, unregistered-token cleanup, and FCM payload');

// Exercise the UI controller with a fake native plugin; no real device or push service is contacted.
const storage = new Map(), elements = new Map();
const names = ['daily', 'dailyTime', 'tasks', 'encouragement', 'encouragementTime', 'announcements'];
const get = id => { if (!elements.has(id)) elements.set(id, { type: names.some(name => id === `notify-${name}` && !name.endsWith('Time')) ? 'checkbox' : 'text', value: '', checked: false, hidden: false, showModal() {} }); return elements.get(id); };
const scheduled = [], cancelled = []; let requested = 0, allowed = false, pending = [];
const local = { checkPermissions: async () => ({ display: allowed ? 'granted' : 'prompt' }), requestPermissions: async () => { requested++; allowed = true; return { display: 'granted' }; }, createChannel: async () => {}, getPending: async () => ({ notifications: pending }), cancel: async value => { cancelled.push(...value.notifications); pending = []; }, schedule: async value => { scheduled.push(...value.notifications); pending.push(...value.notifications); }, addListener: async () => {} };
const context = vm.createContext({ profile: { id: 'test-user' }, entries: [entry], CompassNotificationPlan: globalThis.CompassNotificationPlan, console, Date, crypto: { randomUUID: () => body.requestId }, confirm: () => true,
  document: { getElementById: get, addEventListener() {} }, localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
  apiUrl: path => path, AUTH_KEY: 'auth', showPage() {}, fetch: async () => ({ ok: true, json: async () => ({ canSend: false }) }),
  window: { Capacitor: { getPlatform: () => 'android' }, capacitorLocalNotifications: { LocalNotifications: local }, DAILY_COMPASS_PUSH_CONFIGURED: false } });
vm.runInContext(await readFile(new URL('../notifications.js', import.meta.url), 'utf8'), context);
await context.window.compassNotifications.sync(); assert.equal(requested, 0);
await get('notificationsBtn').onclick(); get('notify-daily').checked = true; get('notify-dailyTime').value = '19:00';
await get('notificationSave').onclick({ currentTarget: get('notificationSave') });
assert.equal(requested, 1); assert.equal(scheduled.at(-1).id, 1001);
get('notify-daily').checked = false;
await get('notificationSave').onclick({ currentTarget: get('notificationSave') });
assert.ok(cancelled.some(item => item.id === 1001)); assert.equal(context.window.compassNotifications.settings().daily, false);
get('notify-announcements').checked = true;
await get('notificationSave').onclick({ currentTarget: get('notificationSave') });
assert.match(get('notificationStatus').textContent, /Firebase/);
assert.equal(context.window.compassNotifications.settings().announcements, false);
console.log('PASS: no startup permission prompt, opt-in scheduling, opt-out cancellation, and Firebase setup guard');
