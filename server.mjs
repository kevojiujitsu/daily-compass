import http from 'node:http';
import { networkInterfaces } from 'node:os';
import { randomBytes, randomUUID, scrypt as scryptCallback, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scrypt = promisify(scryptCallback);
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || 'gpt-5-mini';
const dataDir = process.env.DAILY_COMPASS_DATA_DIR || path.join(root, 'data');
const databaseFile = path.join(dataDir, 'accounts.json');
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const MONTHLY_LIMITS = { free: 10, plus: 30 };
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000,capacitor://localhost,https://localhost').split(',').map(value => value.trim()));
const rateLimits = new Map();
const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/app-config.js': ['app-config.js', 'text/javascript; charset=utf-8'],
  '/welcome.html': ['welcome.html', 'text/html; charset=utf-8'],
  '/crypto-js.js': ['crypto-js.js', 'text/javascript; charset=utf-8'],
  '/privacy.html': ['privacy.html', 'text/html; charset=utf-8']
};
let database = { users: [] };
let writeQueue = Promise.resolve();

function allowedOrigin(origin, req) {
  if (!origin) return false;
  const protocol = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  return allowedOrigins.has(origin) || origin === `${protocol}://${req.headers.host}`;
}
function corsHeaders(origin, req) {
  return allowedOrigin(origin, req) ? {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  } : {};
}
function sendJson(res, status, data, cors = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...cors });
  res.end(JSON.stringify(data));
}
async function readJson(req, maximumBytes = 300_000) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > maximumBytes) throw new Error('Request is too large.');
  }
  try { return JSON.parse(raw); } catch { throw new Error('Invalid request.'); }
}
async function saveDatabase() {
  await mkdir(dataDir, { recursive: true });
  const tempFile = `${databaseFile}.${randomUUID()}.tmp`;
  await writeFile(tempFile, JSON.stringify(database), { encoding: 'utf8', mode: 0o600 });
  await rename(tempFile, databaseFile);
}
function mutateDatabase(operation) {
  const pending = writeQueue.then(async () => {
    const result = await operation(database);
    await saveDatabase();
    return result;
  });
  writeQueue = pending.catch(() => {});
  return pending;
}
async function initializeDatabase() {
  await mkdir(dataDir, { recursive: true });
  try {
    const parsed = JSON.parse(await readFile(databaseFile, 'utf8'));
    if (!Array.isArray(parsed.users)) throw new Error('Invalid account database.');
    database = parsed;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    database = { users: [] };
    await saveDatabase();
  }
}
function monthKey() { return new Date().toISOString().slice(0, 7); }
function publicUser(user) { return { id: user.id, email: user.email, name: user.name, age: user.age, createdAt: user.createdAt }; }
function currentPlan(user) {
  // Plus can only be enabled later by a verified Google Play purchase entitlement.
  const tier = user.plan?.tier === 'plus' && Number(user.plan.expiresAt) > Date.now() ? 'plus' : 'free';
  const month = monthKey();
  return { tier, month, count: Number(user.usage?.[month] || 0), limit: MONTHLY_LIMITS[tier] };
}
function emailIsValid(email) { return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function getClientAddress(req) { return req.socket.remoteAddress || 'unknown'; }
function allowRequest(key, limit, windowMs) {
  const now = Date.now();
  const timestamps = (rateLimits.get(key) || []).filter(time => now - time < windowMs);
  if (timestamps.length >= limit) return false;
  timestamps.push(now);
  rateLimits.set(key, timestamps);
  return true;
}
function tokenDigest(token) { return createHash('sha256').update(token).digest('hex'); }
async function passwordDigest(password, saltHex) {
  return (await scrypt(password, Buffer.from(saltHex, 'hex'), 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })).toString('hex');
}
function verifyDigest(actualHex, expectedHex) {
  const actual = Buffer.from(actualHex, 'hex'), expected = Buffer.from(expectedHex || '', 'hex');
  return actual.length === expected.length && actual.length > 0 && timingSafeEqual(actual, expected);
}
function findBearer(req) {
  const match = /^Bearer\s+([A-Za-z0-9_-]{32,})$/i.exec(req.headers.authorization || '');
  return match?.[1] || '';
}
async function authenticate(req) {
  const token = findBearer(req);
  if (!token) return null;
  await writeQueue;
  const digest = tokenDigest(token), now = Date.now();
  for (const user of database.users) {
    const session = user.sessions?.find(item => item.tokenHash === digest && item.expiresAt > now);
    if (session) return { user, session, token };
  }
  return null;
}
function safeInsights(result, entryCount) {
  if (!result || typeof result.summary !== 'string') throw new Error('Invalid AI response');
  return {
    summary: result.summary.slice(0, 2400),
    nudge: typeof result.nudge === 'string' ? result.nudge.slice(0, 500) : '',
    highlights: Array.isArray(result.highlights) ? result.highlights.filter(x => typeof x === 'string').slice(0, 6).map(x => x.slice(0, 260)) : [],
    advice: Array.isArray(result.advice) ? result.advice.filter(x => Number.isInteger(x?.entryIndex) && x.entryIndex >= 0 && x.entryIndex < entryCount && typeof x.text === 'string').slice(0, entryCount).map(x => ({ entryIndex: x.entryIndex, text: x.text.slice(0, 700) })) : []
  };
}
function issueSession(user) {
  const token = randomBytes(32).toString('base64url');
  user.sessions = (user.sessions || []).filter(item => item.expiresAt > Date.now());
  user.sessions.push({ tokenHash: tokenDigest(token), expiresAt: Date.now() + SESSION_MS });
  return token;
}
function safeAccountResponse(user, token) {
  return { token, user: publicUser(user), quota: currentPlan(user) };
}

async function handleApi(req, res, url, cors) {
  if (req.method === 'GET' && url.pathname === '/api/status') {
    sendJson(res, 200, { aiReady: Boolean(apiKey), accountAuthReady: true }, cors);
    return true;
  }
  const ip = getClientAddress(req);
  if (req.method === 'POST' && url.pathname === '/api/register') {
    if (!allowRequest(`register:${ip}`, 5, 60 * 60 * 1000)) { sendJson(res, 429, { error: 'Too many account attempts. Please try again later.' }, cors); return true; }
    try {
      const body = await readJson(req, 12_000);
      const email = String(body.email || '').trim().toLowerCase();
      const name = String(body.name || '').trim();
      const age = Number(body.age);
      const password = String(body.password || '');
      if (!emailIsValid(email)) { sendJson(res, 400, { error: 'Enter a valid email address.' }, cors); return true; }
      if (!name || name.length > 60 || !Number.isInteger(age) || age < 18 || age > 120) { sendJson(res, 400, { error: 'Enter a name and an age from 18 to 120.' }, cors); return true; }
      if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 256) { sendJson(res, 400, { error: 'Use a password with at least 8 characters.' }, cors); return true; }
      const salt = randomBytes(16).toString('hex');
      const passwordHash = await passwordDigest(password, salt);
      const user = { id: randomUUID(), email, name, age, passwordSalt: salt, passwordHash, createdAt: new Date().toISOString(), sessions: [], usage: {} };
      const token = issueSession(user);
      const created = await mutateDatabase(db => {
        if (db.users.some(item => item.email === email)) return false;
        db.users.push(user);
        return true;
      });
      if (!created) { sendJson(res, 409, { error: 'An account with this email already exists. Please log in.' }, cors); return true; }
      sendJson(res, 201, safeAccountResponse(user, token), cors);
    } catch (error) {
      sendJson(res, 400, { error: error.message === 'Request is too large.' ? error.message : 'Could not create the account. Please try again.' }, cors);
    }
    return true;
  }
  if (req.method === 'POST' && url.pathname === '/api/login') {
    if (!allowRequest(`login:${ip}`, 10, 15 * 60 * 1000)) { sendJson(res, 429, { error: 'Too many sign-in attempts. Please try again later.' }, cors); return true; }
    try {
      const body = await readJson(req, 12_000);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (!emailIsValid(email) || !password || Buffer.byteLength(password, 'utf8') > 256) { sendJson(res, 401, { error: 'Email or password is incorrect.' }, cors); return true; }
      await writeQueue;
      const user = database.users.find(item => item.email === email);
      const salt = user?.passwordSalt || '00000000000000000000000000000000';
      const expected = user?.passwordHash || '00'.repeat(64);
      const actual = await passwordDigest(password, salt);
      if (!user || !verifyDigest(actual, expected)) { sendJson(res, 401, { error: 'Email or password is incorrect.' }, cors); return true; }
      const token = await mutateDatabase(db => {
        const current = db.users.find(item => item.id === user.id);
        if (!current) return null;
        return issueSession(current);
      });
      if (!token) { sendJson(res, 401, { error: 'Email or password is incorrect.' }, cors); return true; }
      sendJson(res, 200, safeAccountResponse(user, token), cors);
    } catch {
      sendJson(res, 400, { error: 'Could not sign in. Please try again.' }, cors);
    }
    return true;
  }

  if (url.pathname.startsWith('/api/')) {
    const auth = await authenticate(req);
    if (!auth) { sendJson(res, 401, { error: 'Please sign in to continue.' }, cors); return true; }
    if (req.method === 'GET' && url.pathname === '/api/quota') {
      sendJson(res, 200, { quota: currentPlan(auth.user) }, cors);
      return true;
    }
    if (req.method === 'POST' && url.pathname === '/api/logout') {
      await mutateDatabase(db => {
        const user = db.users.find(item => item.id === auth.user.id);
        if (user) user.sessions = (user.sessions || []).filter(item => item.tokenHash !== tokenDigest(auth.token));
      });
      sendJson(res, 200, { ok: true }, cors);
      return true;
    }
    if (req.method === 'DELETE' && url.pathname === '/api/account') {
      if (!allowRequest(`delete:${ip}`, 5, 60 * 60 * 1000)) { sendJson(res, 429, { error: 'Too many requests. Please try again later.' }, cors); return true; }
      try {
        const body = await readJson(req, 12_000);
        const actual = await passwordDigest(String(body.password || ''), auth.user.passwordSalt);
        if (!verifyDigest(actual, auth.user.passwordHash)) { sendJson(res, 401, { error: 'The password did not match. Account deletion was cancelled.' }, cors); return true; }
        await mutateDatabase(db => { db.users = db.users.filter(item => item.id !== auth.user.id); });
        sendJson(res, 200, { ok: true }, cors);
      } catch {
        sendJson(res, 400, { error: 'Could not delete the account. Please try again.' }, cors);
      }
      return true;
    }
    if (req.method === 'POST' && url.pathname === '/api/insights') {
      if (!apiKey) { sendJson(res, 503, { error: 'Online AI is not configured on this server.' }, cors); return true; }
      if (!allowRequest(`insights:${ip}`, 10, 60_000)) { sendJson(res, 429, { error: 'Please wait before requesting another reflection.' }, cors); return true; }
      let body;
      try {
        body = await readJson(req);
        if (!Array.isArray(body.entries) || body.entries.length > 100) throw new Error('Please send up to 100 entries.');
        if (body.journalHistory !== undefined && (!Array.isArray(body.journalHistory) || body.journalHistory.length > 60)) throw new Error('Please send up to 60 previous journal entries.');
      } catch (error) {
        sendJson(res, 400, { error: error.message === 'Request is too large.' ? error.message : error.message || 'Invalid request.' }, cors);
        return true;
      }
      const reservation = await mutateDatabase(db => {
        const user = db.users.find(item => item.id === auth.user.id);
        if (!user) return null;
        const quota = currentPlan(user);
        if (quota.count >= quota.limit) return { blocked: true, quota };
        user.usage ||= {};
        user.usage[quota.month] = quota.count + 1;
        return { blocked: false, quota: { ...quota, count: quota.count + 1 } };
      });
      if (!reservation) { sendJson(res, 401, { error: 'Please sign in to continue.' }, cors); return true; }
      if (reservation.blocked) { sendJson(res, 429, { code: 'MONTHLY_LIMIT_REACHED', error: 'You have used this month’s AI reflections.', quota: reservation.quota }, cors); return true; }
      try {
        const entries = body.entries.map(entry => ({
          category: ['Journal', 'Tasks', 'Health'].includes(entry.category) ? entry.category : 'Journal',
          text: String(entry.text || '').slice(0, 1500),
          mood: String(entry.mood || '').slice(0, 40),
          completed: Boolean(entry.completed),
          date: String(entry.date || '').slice(0, 10),
          dueDate: String(entry.dueDate || '').slice(0, 10)
        }));
        const journalHistory = (body.journalHistory || []).map(entry => ({
          date: String(entry.date || '').slice(0, 10),
          text: String(entry.text || '').slice(0, 1500),
          mood: String(entry.mood || '').slice(0, 40)
        }));
        const response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model, store: false,
            instructions: 'You are Daily Compass, a warm and thoughtful reflection assistant. Treat all personal notes as sensitive. Use previousJournalEntries to notice recurring themes, changes in mood, ongoing concerns, and progress across time; do not overstate patterns from sparse notes. Connect those patterns to the selected day when useful. Return valid JSON with summary (a detailed, warm reflection of 3 to 5 sentences, about 100 to 180 words, grounded in the notes), nudge (one separate, encouraging, practical next step in 1 or 2 sentences, specific to the person’s notes and not a repetition of the summary), highlights (3 to 6 specific short observations), and advice (one object per selected-day entry with entryIndex as a zero-based integer and text as 2 to 4 helpful sentences, around 40 to 80 words, specific to that entry and including a practical next step). Address tasks in a realistic, prioritised way; health advice must stay general and never diagnose. Do not invent facts or shame the user. If there are no selected-day entries, acknowledge journal history if available and invite the user to add a note.',
            input: JSON.stringify({ date: String(body.date || '').slice(0, 10), entries, previousJournalEntries: journalHistory }),
            max_output_tokens: 2600,
            text: { format: { type: 'json_object' } }
          })
        });
        const result = await response.json();
        if (!response.ok) throw new Error('The AI service could not create a reflection.');
        const text = result.output?.flatMap(item => item.content || []).find(part => part.type === 'output_text')?.text;
        if (!text) throw new Error('The AI service could not create a reflection.');
        sendJson(res, 200, { ...safeInsights(JSON.parse(text), entries.length), quota: reservation.quota }, cors);
      } catch {
        await mutateDatabase(db => {
          const user = db.users.find(item => item.id === auth.user.id);
          if (user && user.usage?.[reservation.quota.month] === reservation.quota.count) user.usage[reservation.quota.month] -= 1;
        });
        sendJson(res, 502, { error: 'The AI service could not create a reflection. Please try again.' }, cors);
      }
      return true;
    }
    sendJson(res, 404, { error: 'Not found.' }, cors);
    return true;
  }
  return false;
}

async function handleRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const origin = req.headers.origin;
  const cors = corsHeaders(origin, req);
  if (process.env.NODE_ENV === 'production' && url.pathname.startsWith('/api/') && req.headers['x-forwarded-proto'] !== 'https') {
    sendJson(res, 426, { error: 'Secure HTTPS connection required.' });
    return;
  }
  if (origin && !Object.keys(cors).length && url.pathname.startsWith('/api/')) { sendJson(res, 403, { error: 'This app origin is not allowed.' }); return; }
  if (req.method === 'OPTIONS' && url.pathname.startsWith('/api/')) { res.writeHead(204, cors); res.end(); return; }
  if (url.pathname.startsWith('/api/') && await handleApi(req, res, url, cors)) return;
  const file = files[url.pathname];
  if (req.method !== 'GET' || !file) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); return; }
  try {
    const body = await readFile(path.join(root, file[0]));
    res.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(body);
  } catch {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('App files are not built yet. Run npm install, then npm run build.');
  }
}

await initializeDatabase();
const server = http.createServer((req, res) => { handleRequest(req, res).catch(() => { if (!res.headersSent) sendJson(res, 500, { error: 'The server could not complete this request.' }); else res.destroy(); }); });
server.listen(port, '0.0.0.0', () => {
  console.log(`Daily Compass is running at http://localhost:${port}${apiKey ? ' (online AI connected)' : ' (set OPENAI_API_KEY to enable online AI)'}`);
  console.log(`Account records are stored in ${databaseFile}. Keep this directory on a persistent, access-controlled disk in production.`);
  const addresses = Object.values(networkInterfaces()).flat().filter(item => item && (item.family === 'IPv4' || item.family === 4) && !item.internal).map(item => item.address);
  for (const address of [...new Set(addresses)]) console.log(`Phone preview (same Wi-Fi): http://${address}:${port}`);
});
