import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDir = await mkdtemp(path.join(os.tmpdir(), 'daily-compass-social-test-'));
const portProbe = net.createServer();
await new Promise((resolve, reject) => {
  portProbe.once('error', reject);
  portProbe.listen(0, '127.0.0.1', resolve);
});
const port = portProbe.address().port;
await new Promise((resolve, reject) => portProbe.close(error => error ? reject(error) : resolve()));

const serverFile = fileURLToPath(new URL('../server.mjs', import.meta.url));
const server = spawn(process.execPath, [serverFile], {
  cwd: path.dirname(serverFile),
  env: {
    ...process.env,
    PORT: String(port),
    DAILY_COMPASS_DATA_DIR: dataDir,
    DAILY_COMPASS_MODERATOR_EMAIL: 'moderator@example.test',
    OPENAI_API_KEY: ''
  },
  stdio: 'ignore'
});
const baseUrl = `http://127.0.0.1:${port}`;

try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    if (server.exitCode !== null || server.signalCode !== null) throw new Error('Server exited before becoming ready.');
    try {
      const response = await fetch(`${baseUrl}/api/status`);
      if (response.ok) { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'server should start for the API test');

  async function request(endpoint, { token, body } = {}) {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    return { status: response.status, data: await response.json() };
  }

  async function register(email, name) {
    const { status, data } = await request('/api/register', {
      body: { email, name, age: 30, password: 'test-password-123' }
    });
    assert.equal(status, 201);
    return data;
  }

  const moderator = await register('moderator@example.test', 'Moderator');
  const reporter = await register('member@example.test', 'Member');
  assert.equal((await request('/api/social', {
    token: moderator.token,
    body: { action: 'request', userId: reporter.user.id }
  })).status, 200);
  assert.equal((await request('/api/social', {
    token: reporter.token,
    body: { action: 'accept', userId: moderator.user.id }
  })).status, 200);

  const created = await request('/api/social', {
    token: moderator.token,
    body: { action: 'post', text: 'Community post', acceptGuidelines: true }
  });
  assert.equal(created.status, 200);
  assert.equal(Object.hasOwn(created.data.result, 'reports'), false);
  const postId = created.data.result.id;

  assert.equal((await request('/api/social', {
    token: reporter.token,
    body: { action: 'report', postId, reason: 'Private report reason' }
  })).status, 200);

  const social = await request('/api/social', { token: reporter.token });
  assert.equal(social.status, 200);
  assert.equal(Object.hasOwn(social.data.posts[0], 'reports'), false);
  assert.equal(JSON.stringify(social.data).includes('Private report reason'), false);

  const deniedModeration = await request('/api/moderation', { token: reporter.token });
  assert.equal(deniedModeration.status, 403);
  const moderation = await request('/api/moderation', { token: moderator.token });
  assert.equal(moderation.status, 200);
  assert.equal(moderation.data.reports[0].reason, 'Private report reason');
  assert.equal(moderation.data.reports[0].reportedBy, reporter.user.id);

  console.log('PASS: reports are absent from social responses and visible only to authorized moderation');
} finally {
  if (server.exitCode === null && server.signalCode === null) {
    server.kill();
    await new Promise(resolve => server.once('exit', resolve));
  }
  await rm(dataDir, { recursive: true, force: true });
}