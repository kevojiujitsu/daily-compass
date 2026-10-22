import { createSign } from 'node:crypto';

export function pushConfigured() {
  try { const value = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || 'null'); return Boolean(value?.project_id && value?.client_email && value?.private_key); } catch { return false; }
}
let cachedToken;
async function accessToken() {
  if (cachedToken?.until > Date.now() + 60000) return cachedToken.value;
  const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1000), encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: credentials.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const signer = createSign('RSA-SHA256'); signer.update(unsigned); signer.end();
  const assertion = `${unsigned}.${signer.sign(credentials.private_key, 'base64url')}`;
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error('Firebase authentication failed. Check the server configuration.');
  cachedToken = { value: data.access_token, until: Date.now() + Number(data.expires_in || 3600) * 1000 };
  return cachedToken.value;
}

export async function sendAnnouncement(tokens, title, body) {
  const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const bearer = await accessToken();
  const invalid = [], results = [];
  // Limit concurrent connections. Send a notification payload so Android displays it with the app closed.
  for (let start = 0; start < tokens.length; start += 10) {
    results.push(...await Promise.all(tokens.slice(start, start + 10).map(async token => {
      try {
        const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(credentials.project_id)}/messages:send`, {
          method: 'POST', signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: { token, notification: { title, body }, android: { ttl: '86400s', notification: { channel_id: 'compass-announcements', icon: 'ic_stat_compass', visibility: 'PRIVATE' } } } })
        });
        const result = await response.json();
        if (result.error?.details?.some(detail => detail.errorCode === 'UNREGISTERED')) invalid.push(token);
        return response.ok;
      } catch { return false; }
    })));
  }
  return { sent: results.filter(Boolean).length, failed: results.filter(value => !value).length, invalid };
}

export async function handleNotifications({ req, res, url, auth, database, mutateDatabase, sendJson, readJson, cors, allowRequest }) {
  if (!url.pathname.startsWith('/api/notifications/')) return false;
  const adminEmail = String(process.env.DAILY_COMPASS_ANNOUNCEMENT_EMAIL || '').trim().toLowerCase();
  const canSend = Boolean(adminEmail && auth.user.email === adminEmail);
  if (req.method === 'GET' && url.pathname === '/api/notifications/status') {
    sendJson(res, 200, { configured: pushConfigured(), canSend }, cors); return true;
  }
  if (url.pathname === '/api/notifications/device' && ['POST', 'DELETE'].includes(req.method)) {
    try {
      if (req.method === 'POST' && !pushConfigured()) { sendJson(res, 503, { error: 'Phone announcements have not been configured on the server yet.' }, cors); return true; }
      const { token } = await readJson(req, 6000);
      if (typeof token !== 'string' || token.length < 20 || token.length > 4096 || !/^[\w:\-]+$/.test(token)) { sendJson(res, 400, { error: 'Invalid device registration.' }, cors); return true; }
      await mutateDatabase(db => {
        // A device belongs to only one signed-in account at a time.
        if (req.method === 'POST') for (const user of db.users) user.pushDevices = (user.pushDevices || []).filter(device => device.token !== token);
        const user = db.users.find(user => user.id === auth.user.id);
        user.pushDevices = (user.pushDevices || []).filter(device => device.token !== token);
        if (req.method === 'POST') user.pushDevices = [...user.pushDevices, { token, registeredAt: new Date().toISOString() }].slice(-10);
      });
      sendJson(res, 200, { ok: true }, cors);
    } catch { sendJson(res, 400, { error: 'Could not save announcement preferences.' }, cors); }
    return true;
  }
  if (req.method === 'POST' && url.pathname === '/api/notifications/announce') {
    if (!canSend) { sendJson(res, 403, { error: 'Only the configured app owner can send announcements.' }, cors); return true; }
    if (!pushConfigured()) { sendJson(res, 503, { error: 'Configure Firebase on the server before sending announcements.' }, cors); return true; }
    if (!allowRequest(`announcement:${auth.user.id}`, 5, 3600000)) { sendJson(res, 429, { error: 'Announcement limit reached. Try again later.' }, cors); return true; }
    try {
      const input = await readJson(req, 6000), title = String(input.title || '').trim(), body = String(input.body || '').trim();
      if (!title || title.length > 80 || !body || body.length > 300 || !/^[a-f0-9-]{36}$/i.test(input.requestId || '')) { sendJson(res, 400, { error: 'Use a title of 1–80 characters and a message of 1–300 characters.' }, cors); return true; }
      const reserved = await mutateDatabase(db => {
        db.announcements ||= [];
        if (db.announcements.some(item => item.requestId === input.requestId)) return false;
        db.announcements = [...db.announcements, { requestId: input.requestId, sender: auth.user.id, title, body, createdAt: new Date().toISOString(), status: 'sending' }].slice(-100);
        return true;
      });
      if (!reserved) { sendJson(res, 409, { error: 'This announcement was already submitted. Check its result before sending again.' }, cors); return true; }
      const tokens = [...new Set(database.users.flatMap(user => (user.pushDevices || []).map(device => device.token)))];
      const result = await sendAnnouncement(tokens, title, body);
      await mutateDatabase(db => {
        for (const user of db.users) user.pushDevices = (user.pushDevices || []).filter(device => !result.invalid.includes(device.token));
        const record = db.announcements.find(item => item.requestId === input.requestId);
        if (record) Object.assign(record, { status: 'finished', sent: result.sent, failed: result.failed });
      });
      sendJson(res, 200, { sent: result.sent, failed: result.failed }, cors);
    } catch { sendJson(res, 502, { error: 'The announcement could not be completed. Check Firebase configuration before retrying.' }, cors); }
    return true;
  }
  sendJson(res, 405, { error: 'Method not allowed.' }, cors); return true;
}
