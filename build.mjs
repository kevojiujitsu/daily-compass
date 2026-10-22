import { mkdir, copyFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';

const out = resolve('www');
const apiBase = (process.env.DAILY_COMPASS_API_BASE || 'https://daily-compass-api.onrender.com').trim().replace(/\/$/, '');
if (apiBase && !apiBase.startsWith('https://')) throw new Error('DAILY_COMPASS_API_BASE must use HTTPS in a native/store build.');
await mkdir(out, { recursive: true });
await copyFile('app-entry.js', resolve('app.js'));
await copyFile('node_modules/crypto-js/crypto-js.js', resolve('crypto-js.js'));
await copyFile('node_modules/@capacitor/core/dist/capacitor.js', resolve(out, 'capacitor.js'));
await copyFile('node_modules/@capacitor/health-fitness/dist/plugin.js', resolve(out, 'health-fitness.js'));
await copyFile('node_modules/@capgo/native-purchases/dist/plugin.js', resolve(out, 'native-purchases.js'));
for (const plugin of ['local-notifications', 'push-notifications']) await copyFile(`node_modules/@capacitor/${plugin}/dist/plugin.js`, resolve(out, `${plugin}.js`));
for (const file of ['notification-plan.js', 'notifications.js']) await copyFile(file, resolve(out, file));
let pushConfigured = false;
try { await access('android/app/google-services.json'); pushConfigured = true; } catch {}
await copyFile('index.html', resolve(out, 'index.html'));
await writeFile(resolve('app-config.js'), `window.DAILY_COMPASS_API_BASE = ${JSON.stringify(apiBase)};\nwindow.DAILY_COMPASS_PUSH_CONFIGURED = ${pushConfigured};\n`);
await copyFile('app-config.js', resolve(out, 'app-config.js'));
await copyFile('welcome.html', resolve(out, 'welcome.html'));
await copyFile('crypto-js.js', resolve(out, 'crypto-js.js'));
await copyFile('privacy.html', resolve(out, 'privacy.html'));
await copyFile('support.html', resolve(out, 'support.html'));
await copyFile('delete-account.html', resolve(out, 'delete-account.html'));
await copyFile('app.js', resolve(out, 'app.js'));
console.log(`Web and mobile app prepared in ${out}${apiBase ? ` using AI service ${apiBase}` : ' (set DAILY_COMPASS_API_BASE for native AI)'}.`);
