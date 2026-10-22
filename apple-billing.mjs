import { readFileSync } from 'node:fs';
import { SignedDataVerifier, Environment } from '@apple/app-store-server-library';

export const APPLE_PRODUCT_ID = 'compass_plus_monthly';
const bundleId = 'com.kevthedev.dailycompass.mobile';
const roots = ['AppleRootCA-G3.cer', 'AppleRootCA-G2.cer'].map(name => readFileSync(new URL(`./apple-certificates/${name}`, import.meta.url)));
const verifiers = [Environment.PRODUCTION, Environment.SANDBOX].map(environment => ({ environment, verifier: new SignedDataVerifier(roots, true, environment, bundleId, 6825649471) }));
export function appleBillingReady() { return process.env.APPLE_BILLING_ENABLED === 'true'; }
export function appleSandboxAllowed(user) { return (process.env.APPLE_SANDBOX_EMAILS || '').toLowerCase().split(',').map(x => x.trim()).includes(user.email.toLowerCase()); }
export async function verifyAppleSignedData(signed, notification = false) {
  if (typeof signed !== 'string' || signed.length > 40_000 || signed.split('.').length !== 3) throw new Error('Apple did not provide a valid signed purchase.');
  for (const { environment, verifier } of verifiers) {
    try { return { payload: await (notification ? verifier.verifyAndDecodeNotification(signed) : verifier.verifyAndDecodeTransaction(signed)), environment }; } catch { /* Try the other Apple environment; neither permits unsigned data. */ }
  }
  throw new Error('Apple purchase signature could not be verified. Try restoring purchases again.');
}
export function applyAppleTransaction(db, user, transaction, environment, now = Date.now()) {
  if (transaction.bundleId !== bundleId || transaction.productId !== APPLE_PRODUCT_ID || transaction.type !== 'Auto-Renewable Subscription' || !transaction.originalTransactionId || !transaction.transactionId || !Number.isFinite(transaction.expiresDate) || !Number.isFinite(transaction.purchaseDate) || !Number.isFinite(transaction.signedDate)) throw new Error('This is not a valid Compass Plus subscription.');
  if (String(transaction.appAccountToken || '').toLowerCase() !== user.id.toLowerCase()) throw new Error('This Apple subscription belongs to a different Daily Compass account. Sign in to the account used to subscribe.');
  if (environment === Environment.SANDBOX && !appleSandboxAllowed(user)) throw new Error('Sandbox purchases are limited to authorized test accounts.');
  if (db.users.some(other => other.id !== user.id && other.applePlan?.originalTransactionId === transaction.originalTransactionId)) throw new Error('This Apple subscription is already linked to another account.');
  const prior = user.applePlan || {};
  const revokedIds = new Set(prior.revokedIds || []);
  if (transaction.revocationDate) revokedIds.add(transaction.transactionId);
  // A delayed notification or replay cannot overwrite a newer renewal.
  if (Number(prior.purchaseDate || 0) > transaction.purchaseDate || (prior.transactionId === transaction.transactionId && Number(prior.signedDate || 0) > transaction.signedDate)) {
    if (revokedIds.has(prior.transactionId)) prior.expiresAt = 0;
    prior.revokedIds = [...revokedIds];
    return prior;
  }
  const revoked = revokedIds.has(transaction.transactionId) || Boolean(transaction.isUpgraded);
  user.applePlan = { tier: 'plus', source: 'apple', productId: APPLE_PRODUCT_ID, environment, originalTransactionId: transaction.originalTransactionId, transactionId: transaction.transactionId, purchaseDate: transaction.purchaseDate, signedDate: transaction.signedDate, expiresAt: revoked ? 0 : transaction.expiresDate, revokedIds: [...revokedIds] };
  return user.applePlan;
}
export async function verifyApplePurchase(db, user, signed) {
  if (!appleBillingReady()) throw new Error('Apple purchase verification is not available yet. No purchase has been enabled.');
  const { payload, environment } = await verifyAppleSignedData(signed);
  const plan = applyAppleTransaction(db, user, payload, environment);
  return plan;
}
export async function receiveAppleNotification(db, signed) {
  const { payload: event, environment } = await verifyAppleSignedData(signed, true);
  if (event.notificationType === 'TEST') return { accepted: true };
  if (!event.data?.signedTransactionInfo) return { accepted: true };
  const verified = await verifyAppleSignedData(event.data.signedTransactionInfo);
  if (verified.environment !== environment) throw new Error('Apple notification environment does not match its transaction.');
  const transaction = verified.payload;
  const user = db.users.find(item => item.id.toLowerCase() === String(transaction.appAccountToken || '').toLowerCase());
  if (!user || transaction.productId !== APPLE_PRODUCT_ID) return { accepted: true };
  applyAppleTransaction(db, user, transaction, environment);
  return { accepted: true };
}
