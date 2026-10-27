import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app-entry.js', import.meta.url), 'utf8');
const restore = source.slice(source.indexOf('async function restoreApplePurchases()'), source.indexOf('async function purchaseAppleProduct('));
async function run({ module = true, connected = true, enabled = true } = {}) {
  let refreshes = 0, restores = 0, message = '';
  const button = { disabled: false };
  const context = vm.createContext({
    document: { getElementById: () => button },
    nativePurchases: module ? {
      async restorePurchases() { restores++; },
      async getPurchases() { return { purchases: [] }; }
    } : undefined,
    planState: { appleBillingReady: false }, appleAccountToken: '',
    purchaseType: { SUBS: 'subs' }, APPLE_PRODUCT_ID: 'compass_plus_monthly',
    plusMessage(value) { message = value; },
    async loadQuota() {
      refreshes++;
      context.planState.appleBillingReady = enabled;
      context.appleAccountToken = 'account-id';
      return connected;
    }
  });
  vm.runInContext(restore, context);
  await context.restoreApplePurchases();
  assert.equal(button.disabled, false, 'Restore becomes available again after every result');
  return { refreshes, restores, message };
}
let result = await run();
assert.equal(result.refreshes, 1);
assert.equal(result.restores, 1, 'A stale disabled flag must refresh before deciding whether to restore');
assert.match(result.message, /No active Compass Plus/);
result = await run({ module: false });
assert.equal(result.restores, 0);
assert.match(result.message, /purchase module did not load/);
result = await run({ connected: false });
assert.equal(result.restores, 0);
assert.match(result.message, /Could not refresh your account/);
result = await run({ enabled: false });
assert.equal(result.restores, 0);
assert.match(result.message, /server has not enabled/);
console.log('Apple purchase availability: refresh, module, connection and server checks passed.');
