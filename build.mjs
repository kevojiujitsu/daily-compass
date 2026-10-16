import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const out = resolve('www');
const apiBase = (process.env.DAILY_COMPASS_API_BASE || '').trim().replace(/\/$/, '');
if (apiBase && !apiBase.startsWith('https://')) throw new Error('DAILY_COMPASS_API_BASE must use HTTPS in a native/store build.');
await mkdir(out, { recursive: true });
await copyFile('app-entry.js', resolve('app.js'));
await copyFile('node_modules/crypto-js/crypto-js.js', resolve('crypto-js.js'));
await copyFile('index.html', resolve(out, 'index.html'));
await writeFile(resolve('app-config.js'), `window.DAILY_COMPASS_API_BASE = ${JSON.stringify(apiBase)};\n`);
await copyFile('app-config.js', resolve(out, 'app-config.js'));
await copyFile('welcome.html', resolve(out, 'welcome.html'));
await copyFile('crypto-js.js', resolve(out, 'crypto-js.js'));
await copyFile('privacy.html', resolve(out, 'privacy.html'));
await copyFile('app.js', resolve(out, 'app.js'));
console.log(`Web and mobile app prepared in ${out}${apiBase ? ` using AI service ${apiBase}` : ' (set DAILY_COMPASS_API_BASE for native AI)'}.`);
