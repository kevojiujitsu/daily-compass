const KEY = 'daily-compass-entries-v1';
const PROFILE_KEY = 'daily-compass-profile-v1';
const UNLOCK_KEY = 'daily-compass-unlocked-v1';
const AUTH_KEY = 'daily-compass-auth-token-v1';
const MOOD_CHECKINS_KEY = 'daily-compass-mood-checkins-v1';
const MOOD_DONE_KEY = 'daily-compass-mood-completed-v1';
const HEALTH_CONNECTED_KEY = 'daily-compass-health-connected-v1';
const CALORIE_LOG_KEY = 'daily-compass-calorie-log-v1';
const HABIT_LIST_KEY = 'daily-compass-habits-v1';
const HABIT_DONE_KEY = 'daily-compass-habits-done-v1';
const FREE_AI_LIMIT = 10;
const PLUS_AI_LIMIT = 30;
let selected = 'Journal';
let selectedDate = today();
let aiReady = false;
let entries = load();
let moodCheckins = loadMoodCheckins();
let selectedMood = '';
let planState = { tier: 'free', count: 0, limit: FREE_AI_LIMIT, month: '' };
const profile = (() => { try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); } catch { return null; } })();
let socialUserId = profile?.id || '';
let communityProfile = profile?.communityProfile || { avatar: '', hobbies: [], spotify: '', age: '', hometown: '', quote: '', relationshipStatus: '' };
let profilePhotoData = communityProfile.avatar || '';
let communityGuidelinesAccepted = false;
if (!profile?.name || !Number.isInteger(profile.age) || profile.age < 18 || !localStorage.getItem(AUTH_KEY) || sessionStorage.getItem(UNLOCK_KEY) !== 'true') location.replace('welcome.html');
document.getElementById('lockBtn').onclick = () => { sessionStorage.removeItem(UNLOCK_KEY); sessionStorage.removeItem(MOOD_DONE_KEY); location.replace('welcome.html'); };
document.getElementById('deleteDataBtn').onclick = async () => {
  const confirmed = window.confirm('Permanently delete your Daily Compass account, monthly AI usage record, profile, and every journal entry, mood, task, and check-in saved on this device? This cannot be undone.');
  if (!confirmed) return;
  const password = window.prompt('Enter your account password to confirm deletion.');
  if (password === null) return;
  try {
    const response = await fetch(apiUrl('/api/account'), { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem(AUTH_KEY)}` }, body: JSON.stringify({ password }) });
    const data = await response.json();
    if (!response.ok) { toast(data.error || 'Could not delete your account.'); return; }
  } catch { toast('Could not reach the server. Your account was not deleted. Try again when online.'); return; }
  await window.compassNotifications?.cleanup(true).catch(() => {});
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(KEY);
  localStorage.removeItem(MOOD_CHECKINS_KEY);
  [CALORIE_LOG_KEY,HABIT_LIST_KEY,HABIT_DONE_KEY,HEALTH_CONNECTED_KEY].forEach(key => localStorage.removeItem(key));
  localStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(UNLOCK_KEY);
  sessionStorage.removeItem(MOOD_DONE_KEY);
  location.replace('welcome.html');
};

function load() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
function loadMoodCheckins() { try { const value = JSON.parse(localStorage.getItem(MOOD_CHECKINS_KEY) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; } }
function save() { localStorage.setItem(KEY, JSON.stringify(entries)); window.compassNotifications?.sync(); }
function updatePlanCard() {
  const limit = planState.tier === 'plus' ? PLUS_AI_LIMIT : FREE_AI_LIMIT;
  document.getElementById('planName').textContent = planState.tier === 'plus' ? 'Compass Plus' : 'Free plan';
  document.getElementById('planUsage').textContent = `${Math.min(planState.count, limit)} of ${limit} AI uses used this month`;
}
const PLAY_PRODUCT_ID = 'compass_plus';
const PLAY_BASE_PLAN_ID = 'monthly';
const nativePurchases = window.capacitorNativePurchases?.NativePurchases;
const purchaseType = window.capacitorNativePurchases?.PURCHASE_TYPE;
let plusStoreProduct = null;
let billingAccountId = '';
function plusMessage(text) { document.getElementById('plusInfo').textContent = text; }
async function loadPlusProduct() {
  const buyButton = document.getElementById('buyPlusBtn');
  document.getElementById('managePlusBtn').hidden = planState.tier !== 'plus';
  document.getElementById('restorePlusBtn').hidden = planState.tier === 'plus';
  if (planState.tier === 'plus') {
    document.getElementById('plusPrice').textContent = 'Your Compass Plus subscription is active.';
    buyButton.hidden = true;
    plusMessage('Enjoy 30 AI uses each month. You can manage or cancel your subscription in Google Play.');
    return;
  }
  buyButton.hidden = false;
  buyButton.disabled = true;
  buyButton.textContent = 'Checking subscription…';
  if (!nativePurchases || window.Capacitor?.getPlatform?.() !== 'android') {
    document.getElementById('plusPrice').textContent = 'Monthly plan';
    plusMessage('Compass Plus subscriptions are available in the Android app through Google Play.');
    buyButton.textContent = 'Available in the Android app';
    return;
  }
  if (!localStorage.getItem(AUTH_KEY)) {
    plusMessage('Sign in to your Daily Compass account to subscribe.');
    buyButton.textContent = 'Sign in to subscribe';
    return;
  }
  if (!planState.billingReady) {
    document.getElementById('plusPrice').textContent = 'Monthly plan';
    plusMessage('Google Play purchase verification is still being connected. Try again later.');
    buyButton.textContent = 'Not available yet';
    return;
  }
  try {
    const support = await nativePurchases.isBillingSupported();
    if (!support.isBillingSupported) throw new Error('Google Play billing is not available on this device.');
    const { products } = await nativePurchases.getProducts({ productIdentifiers: [PLAY_PRODUCT_ID], productType: purchaseType.SUBS });
    plusStoreProduct = products.find(item => item.planIdentifier === PLAY_PRODUCT_ID && item.identifier === PLAY_BASE_PLAN_ID) || null;
    if (!plusStoreProduct) throw new Error('Compass Plus is not available in Google Play yet.');
    document.getElementById('plusPrice').textContent = `${plusStoreProduct.priceString} / month`;
    plusMessage('Billed monthly through Google Play. You can cancel any time in your Google Play subscriptions.');
    buyButton.disabled = false;
    buyButton.textContent = `Subscribe · ${plusStoreProduct.priceString} / month`;
  } catch (error) {
    document.getElementById('plusPrice').textContent = 'Monthly plan';
    plusMessage(error.message || 'Google Play could not load the subscription right now.');
    buyButton.textContent = 'Try again';
  }
}
async function verifyPlayPurchase(transaction) {
  if (!transaction || transaction.productIdentifier !== PLAY_PRODUCT_ID || transaction.purchaseState !== '1' || !transaction.purchaseToken) {
    if (transaction?.purchaseState === '0') throw new Error('Your payment is pending. Compass Plus will turn on after Google Play confirms it.');
    throw new Error('Google Play did not return a completed Compass Plus purchase.');
  }
  const response = await fetch(apiUrl('/api/billing/google-play/verify'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem(AUTH_KEY)}` },
    body: JSON.stringify({ purchaseToken: transaction.purchaseToken })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Google Play could not verify the purchase.');
  if (data.quota) { planState = { ...planState, ...data.quota }; updatePlanCard(); }
  return true;
}
async function restorePlusPurchases() {
  const button = document.getElementById('restorePlusBtn');
  button.disabled = true;
  try {
    if (!nativePurchases || window.Capacitor?.getPlatform?.() !== 'android') throw new Error('Restore purchases in the Android app using Google Play.');
    await nativePurchases.restorePurchases();
    const { purchases } = await nativePurchases.getPurchases({ productType: purchaseType.SUBS });
    const owned = purchases.find(item => item.productIdentifier === PLAY_PRODUCT_ID && item.purchaseState === '1' && item.purchaseToken);
    if (!owned) throw new Error('No Compass Plus subscription was found for this Google Play account.');
    await verifyPlayPurchase(owned);
    await loadQuota();
    toast('Compass Plus restored.');
    await loadPlusProduct();
  } catch (error) { plusMessage(error.message || 'Could not restore purchases.'); }
  finally { button.disabled = false; }
}
async function syncExistingPlusPurchase() {
  if (!nativePurchases || window.Capacitor?.getPlatform?.() !== 'android' || !planState.billingReady || !billingAccountId) return;
  try {
    const { purchases } = await nativePurchases.getPurchases({ productType: purchaseType.SUBS });
    const owned = purchases.find(item => item.productIdentifier === PLAY_PRODUCT_ID && item.purchaseState === '1' && item.purchaseToken);
    if (owned) {
      await verifyPlayPurchase(owned);
      planState.tier = 'plus';
      updatePlanCard();
    }
  } catch (error) { console.warn('Google Play subscription refresh was deferred:', error.message); }
}
function today() { return toDateInput(new Date()); }
function toDateInput(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function dateFromInput(value) { return new Date(`${value}T12:00:00`); }
function prettyDate(value) { return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(dateFromInput(value)); }
const moodOptions = ['😊 Happy','✨ Excited','🌿 Calm','🙏 Grateful','💪 Motivated','🎯 Focused','🥰 Loved','🌈 Hopeful','🏆 Proud','😌 Content','😐 Okay','😟 Anxious','😣 Overwhelmed','😢 Sad','😤 Frustrated','🫥 Lonely','😴 Tired','😵‍💫 Restless','😞 Discouraged','🪫 Low energy'];
const moodGlows = ['#ffbf69','#ff9f75','#64d6b0','#f4cb67','#65d9c2','#66aaff','#f18fca','#88d99a','#ffd36a','#a5d998','#9aaac0','#9d91ff','#f28fa2','#86aaff','#ff967e','#b79bf0','#82b3d6','#ffad79','#8f9ad0','#8ab3c0'];
const dailyQuotes = ['Small steps still count as movement.','You can begin again without starting over.','Make room for what gives you energy.','Progress can be quiet and still be real.','A little clarity can change the shape of a day.','You are allowed to move at a human pace.','Notice what is working, then build from there.','Rest can be part of the path forward.'];
function showTodayMood() { const mood = moodCheckins[today()]; document.getElementById('todayMood').textContent = mood ? `Feeling ${mood}` : 'Your daily mood'; }
function initMoodGate() {
  const gate = document.getElementById('moodGate'), rail = document.getElementById('moodChoices'), continueButton = document.getElementById('continueMood'), hint = document.getElementById('moodSelectionHint');
  rail.innerHTML = moodOptions.map((mood, index) => { const firstSpace = mood.indexOf(' '); const emoji = mood.slice(0, firstSpace); const name = mood.slice(firstSpace + 1); return `<button class="mood-option" type="button" data-mood="${mood}" aria-label="${mood}" aria-pressed="false" style="--mood-glow:${moodGlows[index]}"><span class="mood-check" aria-hidden="true">✓</span><span class="mood-emoji" aria-hidden="true">${emoji}</span><span class="mood-name">${name}</span></button>`; }).join('');
  const shell = document.querySelector('.shell');
  const moodAlreadyDone = sessionStorage.getItem(MOOD_DONE_KEY) === 'true';
  gate.hidden = moodAlreadyDone; shell.inert = !moodAlreadyDone; showTodayMood();
  rail.querySelectorAll('.mood-option').forEach(option => option.addEventListener('click', () => {
    selectedMood = option.dataset.mood;
    rail.querySelectorAll('.mood-option').forEach(button => button.setAttribute('aria-pressed', String(button === option)));
    hint.innerHTML = `You’re feeling <strong>${selectedMood}</strong>`;
    continueButton.disabled = false;
  }));
  const scrollMoods = direction => rail.scrollBy({ left: direction * Math.max(200, rail.clientWidth * 0.78), behavior: 'smooth' });
  document.getElementById('moodPrev').onclick = () => scrollMoods(-1);
  document.getElementById('moodNext').onclick = () => scrollMoods(1);
  rail.addEventListener('keydown', event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); scrollMoods(event.key === 'ArrowLeft' ? -1 : 1); } });
  continueButton.onclick = () => {
    if (!selectedMood) return;
    continueButton.disabled = true;
    moodCheckins[today()] = selectedMood;
    localStorage.setItem(MOOD_CHECKINS_KEY, JSON.stringify(moodCheckins));
    sessionStorage.setItem(MOOD_DONE_KEY, 'true');
    showTodayMood();
    const moodDialog = gate.querySelector('.mood-dialog'), quote = document.getElementById('quoteTransition'), quoteText = document.getElementById('dailyQuoteText'), quoteAuthor = document.getElementById('dailyQuoteAuthor');
    const now = new Date(), dayNumber = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(now.getFullYear(), 0, 0)) / 86_400_000);
    quoteText.textContent = dailyQuotes[(dayNumber + now.getFullYear()) % dailyQuotes.length]; quoteAuthor.textContent = 'A Daily Compass reminder';
    moodDialog.hidden = true; quote.hidden = false; gate.setAttribute('aria-labelledby', 'dailyQuoteText'); gate.removeAttribute('aria-describedby');
    requestAnimationFrame(() => quote.classList.add('visible'));
    setTimeout(() => { quote.classList.add('leaving'); gate.classList.add('leaving'); }, 2500);
    setTimeout(() => { gate.hidden = true; shell.inert = false; shell.classList.add('entering'); document.getElementById('entryText').focus({ preventScroll: true }); setTimeout(() => shell.classList.remove('entering'), 700); }, 3200);
  };
  if (!moodAlreadyDone) requestAnimationFrame(() => rail.querySelector('.mood-option')?.focus({ preventScroll: true }));
}

document.querySelectorAll('.nav-tab').forEach(button => button.addEventListener('click', () => showPage(button.dataset.page)));
function showPage(name) {
  document.querySelectorAll('.nav-tab').forEach(button => { const active = button.dataset.page === name; button.classList.toggle('active', active); if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
  document.querySelectorAll('.app-page').forEach(page => page.classList.toggle('active', page.id === `page-${name}`));
  if (name === 'social') loadSocial();
  if (name === 'health') { renderHealth(); if (localStorage.getItem(HEALTH_CONNECTED_KEY) === 'true') refreshHealthData(); }
}
const plusDialog = document.getElementById('plusDialog');
function openPlusDialog() { plusDialog.showModal(); loadPlusProduct(); }
document.getElementById('topPlusBtn').onclick = () => { document.getElementById('profileDialog').close(); openPlusDialog(); };
document.getElementById('profileBtn').onclick = () => { document.getElementById('profileName').textContent = profile?.name || 'Your profile'; document.getElementById('profileEmail').textContent = profile?.email || ''; document.getElementById('profileDialog').showModal(); };
document.getElementById('changeMoodBtn').onclick = () => { const gate = document.getElementById('moodGate'); gate.querySelector('.mood-dialog').hidden = false; const quote = document.getElementById('quoteTransition'); quote.hidden = true; quote.classList.remove('visible','leaving'); gate.classList.remove('leaving'); gate.setAttribute('aria-labelledby','moodGateTitle'); gate.setAttribute('aria-describedby','moodGateIntro'); gate.hidden = false; document.querySelector('.shell').inert = true; selectedMood = ''; document.getElementById('continueMood').disabled = true; document.getElementById('moodSelectionHint').textContent = 'Select a mood to continue.'; document.querySelectorAll('.mood-option').forEach(button => button.setAttribute('aria-pressed','false')); document.querySelector('.mood-option')?.focus(); };
document.getElementById('buyPlusBtn').onclick = async event => {
  const button = event.currentTarget;
  if (!plusStoreProduct || !nativePurchases) { await loadPlusProduct(); return; }
  button.disabled = true; button.textContent = 'Opening Google Play…';
  try {
    const transaction = await nativePurchases.purchaseProduct({ productIdentifier: PLAY_PRODUCT_ID, planIdentifier: PLAY_BASE_PLAN_ID, offerToken: plusStoreProduct.offerToken, productType: purchaseType.SUBS, appAccountToken: billingAccountId, autoAcknowledgePurchases: false });
    await verifyPlayPurchase(transaction);
    await loadQuota();
    toast('Welcome to Compass Plus.');
    await loadPlusProduct();
  } catch (error) { plusMessage(error.message || 'The purchase could not be completed.'); await loadPlusProduct(); }
};
document.getElementById('restorePlusBtn').onclick = restorePlusPurchases;
document.getElementById('managePlusBtn').onclick = async () => {
  try { await nativePurchases?.manageSubscriptions(); }
  catch { plusMessage('Open Google Play → Payments & subscriptions → Subscriptions to manage Compass Plus.'); }
};
const icons = { Journal: '✍️', Tasks: '✓', Health: '☘️' };
document.querySelectorAll('.cat').forEach(b => b.addEventListener('click', () => {
  selected = b.dataset.cat;
  document.querySelectorAll('.cat').forEach(x => x.classList.toggle('active', x === b));
  const taskMode = selected === 'Tasks';
  document.getElementById('taskDueWrap').classList.toggle('visible', taskMode);
  document.getElementById('entryText').placeholder = selected === 'Journal' ? 'What’s on your mind?' : taskMode ? 'What needs to get done?' : 'What did you notice about your health or habits?';
  document.getElementById('addBtn').innerHTML = taskMode ? 'Add task' : 'Add entry <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8h10M8 3l5 5-5 5"/></svg>';
}));
function current() { return entries.filter(e => e.date === selectedDate); }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }
function setStatus(text, ready = false) {
  document.getElementById('aiDot').classList.toggle('ready', ready);
  document.getElementById('aiStatus').textContent = text;
}
const apiBase = (window.DAILY_COMPASS_API_BASE || '').replace(/\/$/, '');
const apiUrl = path => `${apiBase}${path}`;
function showCoachResult(target, result) {
  document.getElementById(`${target}Title`).textContent = result.title || 'Your plan';
  document.getElementById(`${target}Summary`).textContent = result.summary || '';
  document.getElementById(`${target}Items`).innerHTML = (result.items || []).map(item => `<li><strong>${esc(item.title)}</strong><span>${esc(item.detail)}</span></li>`).join('');
  document.getElementById(`${target}Note`).textContent = result.note || '';
  document.getElementById(`${target}Result`).hidden = false;
}
async function coachRequest(kind, button, body) {
  const oldText = button.textContent;
  button.disabled = true; button.setAttribute('aria-busy', 'true'); button.textContent = 'Putting this together…';
  try {
    const response = await fetch(apiUrl('/api/coach'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem(AUTH_KEY)}` }, body: JSON.stringify({ ...body, kind }) });
    const data = await response.json();
    if (data.quota) { planState = data.quota; updatePlanCard(); }
    if (!response.ok) { if (data.code === 'MONTHLY_LIMIT_REACHED') openPlusDialog(); throw new Error(data.error || 'AI advice is not available right now.'); }
    showCoachResult(kind === 'tasks' ? 'taskCoach' : 'healthCoach', data);
  } catch (error) { toast(error.message || 'AI advice could not be generated.'); }
  finally { button.disabled = false; button.removeAttribute('aria-busy'); button.textContent = oldText; }
}
document.getElementById('taskCoachBtn').onclick = event => {
  const tasks = entries.filter(entry => entry.category === 'Tasks').slice(0, 30).map(entry => ({ text: entry.text, dueDate: entry.dueDate || '', completed: Boolean(entry.completed), priority: entry.priority || 'steady' }));
  if (!tasks.some(task => !task.completed)) { toast('Add an open task first, and I can help organize it.'); return; }
  coachRequest('tasks', event.currentTarget, { tasks });
};
document.querySelectorAll('[data-health-plan]').forEach(button => button.onclick = event => {
  const kind = event.currentTarget.dataset.healthPlan;
  coachRequest(kind, event.currentTarget, { goal: document.getElementById('healthPlanGoal').value.trim(), equipment: document.getElementById('healthPlanEquipment').value.trim(), preferences: document.getElementById('foodPreferences').value.trim(), allergies: document.getElementById('foodAllergies').value.trim(), ingredients: document.getElementById('recipeIngredients').value.trim(), minutes: document.getElementById('healthPlanMinutes').value });
});
async function summarizeJournal(days, scope, button) {
  const end = dateFromInput(selectedDate), start = new Date(end); start.setDate(start.getDate() - days + 1);
  const from = toDateInput(start), through = toDateInput(end);
  const periodEntries = entries.filter(entry => entry.category === 'Journal' && entry.date >= from && entry.date <= through).map(entry => ({ category: 'Journal', text: entry.text, mood: entry.mood || '', completed: false, date: entry.date }));
  Object.entries(moodCheckins).filter(([date]) => date >= from && date <= through).forEach(([date, mood]) => periodEntries.push({ category: 'Health', text: 'Daily mood check-in', mood, date }));
  if (!periodEntries.length) { toast(`Add a journal note or mood check-in in the past ${days} days first.`); return; }
  const oldText = button.textContent; button.disabled = true; button.textContent = 'Summarizing…';
  try {
    const response = await fetch(apiUrl('/api/insights'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem(AUTH_KEY)}` }, body: JSON.stringify({ date: through, summaryScope: scope, entries: periodEntries.slice(-100), journalHistory: [] }) });
    const data = await response.json();
    if (data.quota) { planState = data.quota; updatePlanCard(); }
    if (!response.ok) { if (data.code === 'MONTHLY_LIMIT_REACHED') openPlusDialog(); throw new Error(data.error || 'Could not create a summary.'); }
    document.getElementById('summary').textContent = data.summary || 'No summary was returned.';
    document.getElementById('summaryLabel').textContent = scope === 'week' ? 'Past week' : 'Past month';
    document.getElementById('reflectionNote').textContent = 'AI journal summary';
    document.getElementById('highlights').innerHTML = (data.highlights || []).map(value => `<li>${esc(value)}</li>`).join('');
    document.querySelector('.reflection-highlights').open = false;
  } catch (error) { toast(error.message || 'Could not create a summary.'); }
  finally { button.disabled = false; button.textContent = oldText; }
}
document.getElementById('summarizeWeekBtn').onclick = event => summarizeJournal(7, 'week', event.currentTarget);
document.getElementById('summarizeMonthBtn').onclick = event => summarizeJournal(30, 'month', event.currentTarget);
async function socialRequest(body) {
  const response = await fetch(apiUrl('/api/social'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem(AUTH_KEY)}` }, body: JSON.stringify(body) });
  let data; try { data = await response.json(); } catch { throw new Error('The community service returned an unreadable response.'); }
  if (!response.ok) throw new Error(data.error || 'Could not complete that community action.');
  return data.result;
}
async function socialGet() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(apiUrl('/api/social'), { headers: { Authorization: `Bearer ${localStorage.getItem(AUTH_KEY)}` }, signal: controller.signal });
    let data; try { data = await response.json(); } catch { throw new Error('Your community is temporarily unavailable. Please try again.'); }
    if (!response.ok) {
      const error = new Error(response.status === 401 ? 'Please sign in again to open your community.' : data.error || 'Could not load your community. Please try again.');
      error.status = response.status;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('Could not reach your community. Check your connection and try again.');
    throw error;
  } finally { clearTimeout(timeout); }
}
async function loadModeration() {
  const panel = document.getElementById('moderationPanel');
  try { const response = await fetch(apiUrl('/api/moderation'), { headers: { Authorization: `Bearer ${localStorage.getItem(AUTH_KEY)}` } }), data = await response.json(); if (!response.ok) throw new Error(data.error || 'Moderation unavailable.'); panel.hidden = false; const queue = document.getElementById('moderationQueue'); queue.innerHTML = data.reports.length ? data.reports.map(report => `<div class="friend-row"><div class="friend-info"><strong>${esc(report.kind === 'post' ? `Post · ${report.reportedName}` : `${report.reportedName} · member report`)}</strong><small>Reported by ${esc(report.reporterName)}: ${esc(report.reason)}${report.excerpt ? ` · ${esc(report.excerpt)}` : ''}</small></div>${report.kind === 'post' ? `<button class="danger-btn" data-mod-action="hidePost" data-post-id="${esc(report.postId)}">Hide</button><button class="danger-btn" data-mod-action="removePost" data-post-id="${esc(report.postId)}">Remove</button>` : `<button class="secondary-btn" data-mod-action="resolveUserReport" data-reported-by="${esc(report.reportedBy)}" data-reported-user="${esc(report.reportedUserId)}">Resolve</button>`}</div>`).join('') : '<div class="social-empty">No open reports.</div>'; queue.querySelectorAll('[data-mod-action]').forEach(button => button.onclick = async () => { try { const response = await fetch(apiUrl('/api/moderation'), { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem(AUTH_KEY)}`}, body:JSON.stringify({ action:button.dataset.modAction, postId:button.dataset.postId, reportedBy:button.dataset.reportedBy, reportedUserId:button.dataset.reportedUser }) }), result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not update report.'); await loadModeration(); toast('Moderation action saved.'); } catch (error) { toast(error.message); } }); }
  catch { panel.hidden = true; }
}
function initials(name) { return String(name || '?').split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase(); }
const hobbyIcons = { music: '🎵', fitness: '🏋️', nature: '🌿', books: '📚', cooking: '🍳', art: '🎨', gaming: '🎮', travel: '🧭', wrestling: '🤼', jiujitsu: '🥋', martialarts: '🥊', yoga: '🧘', running: '🏃', hiking: '🥾', photography: '📷', writing: '✍️', gardening: '🪴', dance: '💃', movies: '🎬', pets: '🐾', cycling: '🚴', swimming: '🏊', volunteering: '🤝', crafts: '🧶', sports: '⚽' };
function safeSpotify(profileData) { return /^https:\/\/open\.spotify\.com\/track\/[A-Za-z0-9]+\/?(?:\?[^\s]*)?$/.test(profileData?.spotify || '') ? profileData.spotify : ''; }
function socialAvatar(person, className = 'friend-avatar') { const avatar = person.profile?.avatar; return avatar && /^data:image\/(jpeg|png|webp);base64,/.test(avatar) ? `<img class="${className} social-person-avatar" src="${esc(avatar)}" alt="${esc(person.name)}'s profile photo">` : `<span class="${className}">${esc(initials(person.name))}</span>`; }
const relationshipLabels = { single: 'Single', dating: 'Dating', 'in-relationship': 'In a relationship', engaged: 'Engaged', married: 'Married', 'its-complicated': 'It’s complicated', separated: 'Separated', divorced: 'Divorced', widowed: 'Widowed' };
function profileHighlights(profileData) {
  const hobbies = (profileData?.hobbies || []).filter(key => hobbyIcons[key]).map(key => `<span title="${esc(key)}">${hobbyIcons[key]}</span>`).join('');
  const spotify = safeSpotify(profileData), age = Number.isInteger(Number(profileData?.age)) && Number(profileData.age) >= 18 && Number(profileData.age) <= 120 ? Number(profileData.age) : '';
  const details = [age ? `${age}` : '', String(profileData?.hometown || '').trim(), relationshipLabels[profileData?.relationshipStatus] || ''].filter(Boolean);
  const detailLine = details.length ? `<div class="profile-detail-line">${details.map(esc).join(' · ')}</div>` : '';
  const quote = String(profileData?.quote || '').trim();
  return `${detailLine}${quote ? `<p class="profile-quote">“${esc(quote)}”</p>` : ''}${hobbies ? `<div class="profile-hobby-strip" aria-label="Hobbies">${hobbies}</div>` : ''}${spotify ? `<a class="spotify-profile-link" href="${esc(spotify)}" target="_blank" rel="noopener noreferrer">♫ Favorite song on Spotify ↗</a>` : ''}`;
}
function renderCommunityProfile(profileData = communityProfile) {
  const ageValue = Number(profileData?.age);
  communityProfile = { avatar: String(profileData?.avatar || ''), hobbies: Array.isArray(profileData?.hobbies) ? profileData.hobbies.filter(key => hobbyIcons[key]) : [], spotify: String(profileData?.spotify || ''), age: profileData?.age !== '' && profileData?.age != null && Number.isInteger(ageValue) && ageValue >= 18 && ageValue <= 120 ? ageValue : '', hometown: String(profileData?.hometown || '').slice(0, 80), quote: String(profileData?.quote || '').slice(0, 160), relationshipStatus: relationshipLabels[profileData?.relationshipStatus] ? profileData.relationshipStatus : '' };
  profilePhotoData = communityProfile.avatar;
  const preview = document.getElementById('profileAvatarPreview'), fallback = document.getElementById('profileAvatarFallback');
  if (communityProfile.avatar) { preview.src = communityProfile.avatar; preview.hidden = false; fallback.hidden = true; } else { preview.removeAttribute('src'); preview.hidden = true; fallback.hidden = false; }
  document.getElementById('removeProfilePhotoBtn').hidden = !communityProfile.avatar;
  document.querySelectorAll('.hobby-options input[type="checkbox"]').forEach(input => { input.checked = communityProfile.hobbies.includes(input.value); });
  document.getElementById('profileSpotify').value = communityProfile.spotify;
  document.getElementById('profileAge').value = communityProfile.age;
  document.getElementById('profileHometown').value = communityProfile.hometown;
  document.getElementById('profileQuote').value = communityProfile.quote;
  document.getElementById('profileRelationship').value = communityProfile.relationshipStatus;
}
function socialPerson(person, buttonText, action, extraClass = 'secondary-btn') { return `<div class="friend-row">${socialAvatar(person)}<div class="friend-info"><strong>${esc(person.name)}</strong>${profileHighlights(person.profile)}<small>Daily Compass member</small></div><button type="button" class="${extraClass}" data-community-action="${action}" data-user-id="${esc(person.id)}" ${action === 'none' ? 'disabled' : ''}>${esc(buttonText)}</button></div>`; }
async function loadSocial() {
  const feed = document.getElementById('socialFeed');
  feed.innerHTML = '<div class="social-empty">Opening your circle…</div>';
  try {
    const data = await socialGet();
    renderCommunityProfile(data.profile || communityProfile);
    if (profile) { profile.communityProfile = communityProfile; localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); }
    if (data.moderator) loadModeration();
    socialUserId = data.userId || socialUserId; if (socialUserId && profile && !profile.id) { profile.id = socialUserId; localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); }
    communityGuidelinesAccepted = Boolean(data.acceptedGuidelines);
    document.querySelector('.community-guidelines').hidden = communityGuidelinesAccepted;
    document.getElementById('friendCount').textContent = `${data.friends.length} ${data.friends.length === 1 ? 'friend' : 'friends'}`;
    document.getElementById('friendList').innerHTML = data.friends.length ? data.friends.map(p => socialPerson(p, 'Remove', 'removeFriend', 'danger-btn')).join('') : '<div class="social-empty">Your circle is ready when you are. Find a friend using their account email.</div>';
    document.getElementById('friendRequests').innerHTML = data.requests.length ? data.requests.map(p => socialPerson(p, 'Accept', 'accept')).join('') : '<div class="social-empty">No new friend requests.</div>';
    document.getElementById('requestCount').textContent = data.requests.length ? `${data.requests.length} waiting` : '';
    document.getElementById('blockedList').innerHTML = data.blocked.length ? data.blocked.map(p => socialPerson(p, 'Unblock', 'unblock')).join('') : '<div class="social-empty">No one is blocked.</div>';
    feed.innerHTML = data.posts.length ? data.posts.map(post => renderSocialPost(post)).join('') : '<div class="social-empty">When you add friends, their moments will show up here.</div>';
    wireSocialActions();
  } catch (error) {
    feed.innerHTML = `<div class="social-empty" role="status">${esc(error.message)}<br><button id="communityRetryBtn" class="secondary-btn" type="button">${error.status === 401 ? 'Sign in' : 'Try again'}</button></div>`;
    document.getElementById('communityRetryBtn').onclick = error.status === 401 ? () => { sessionStorage.removeItem(UNLOCK_KEY); location.assign('welcome.html'); } : loadSocial;
  }
}
const reactionOptions = ['❤️','👍','😕','😂','😠'];
function renderSocialPost(post) {
  const counts = {}; Object.values(post.reactions || {}).forEach(emoji => counts[emoji] = (counts[emoji] || 0) + 1);
  const comments = (post.comments || []).map(comment => `<div class="comment-row"><strong>${esc(comment.author.name)}</strong> <span class="post-meta">${esc(new Date(comment.createdAt).toLocaleString())}</span><div class="post-body" style="margin:5px 0 0">${esc(comment.text)}</div></div>`).join('');
  const photo = post.photo ? `<img class="post-photo" src="${esc(post.photo)}" alt="Photo shared by ${esc(post.author.name)}">` : '';
  return `<article class="social-post" data-post-id="${esc(post.id)}"><header class="post-head">${socialAvatar(post.author)}<div class="friend-info"><strong>${esc(post.author.name)}</strong><span class="post-meta">${esc(new Date(post.createdAt).toLocaleString())}</span>${profileHighlights(post.author.profile)}</div><div class="post-tools">${post.author.id !== socialUserId ? `<button class="danger-btn" data-report-post="${esc(post.id)}">Report post</button><button class="danger-btn" data-report-member="${esc(post.author.id)}">Report person</button><button class="danger-btn" data-report-user="${esc(post.author.id)}">Block</button>` : `<button class="danger-btn" data-delete-post="${esc(post.id)}">Delete</button>`}</div></header>${post.text ? `<p class="post-body">${esc(post.text)}</p>` : ''}${photo}<div class="post-actions">${reactionOptions.map(emoji => `<button class="reaction-btn${post.reactions?.[socialUserId] === emoji ? ' active' : ''}" data-react="${emoji}" data-post-id="${esc(post.id)}" aria-pressed="${post.reactions?.[socialUserId] === emoji}">${emoji}${counts[emoji] ? ` ${counts[emoji]}` : ''}</button>`).join('')}</div><div class="post-comments">${comments}</div><form class="comment-form" data-comment-post="${esc(post.id)}"><input class="field" maxlength="500" placeholder="Write a kind comment…" aria-label="Comment"><button class="secondary-btn" type="submit">Send</button></form></article>`;
}
function wireSocialActions() {
  document.querySelectorAll('[data-community-action]').forEach(button => button.onclick = async () => { try { await socialRequest({ action: button.dataset.communityAction, userId: button.dataset.userId }); toast('Your community was updated.'); await loadSocial(); } catch (error) { toast(error.message); } });
  document.querySelectorAll('[data-react]').forEach(button => button.onclick = async () => { try { await socialRequest({ action: 'react', postId: button.dataset.postId, emoji: button.dataset.react }); await loadSocial(); } catch (error) { toast(error.message); } });
  document.querySelectorAll('[data-report-post]').forEach(button => button.onclick = async () => { const reason = window.prompt('Why are you reporting this post? (spam, harassment, unsafe content, or other)'); if (!reason) return; try { await socialRequest({ action: 'report', postId: button.dataset.reportPost, reason }); toast('Report sent. Thank you for helping keep the community safe.'); await loadSocial(); } catch (error) { toast(error.message); } });
  document.querySelectorAll('[data-report-member]').forEach(button => button.onclick = async () => { const reason = window.prompt('Why are you reporting this member? (spam, harassment, unsafe content, or other)'); if (!reason) return; try { await socialRequest({ action: 'reportUser', userId: button.dataset.reportMember, reason }); toast('Report sent. Thank you for helping keep the community safe.'); } catch (error) { toast(error.message); } });
  document.querySelectorAll('[data-delete-post]').forEach(button => button.onclick = async () => { if (!window.confirm('Delete this post and its comments?')) return; try { await socialRequest({ action: 'deletePost', postId: button.dataset.deletePost }); toast('Post deleted.'); await loadSocial(); } catch (error) { toast(error.message); } });
  document.querySelectorAll('[data-report-user]').forEach(button => button.onclick = async () => { if (!window.confirm('Block this person? You will no longer see each other’s community content.')) return; try { await socialRequest({ action: 'block', userId: button.dataset.reportUser }); toast('This person is blocked.'); await loadSocial(); } catch (error) { toast(error.message); } });
  document.querySelectorAll('[data-comment-post]').forEach(form => form.onsubmit = async event => { event.preventDefault(); const input = form.querySelector('input'); try { await socialRequest({ action: 'comment', postId: form.dataset.commentPost, text: input.value }); await loadSocial(); } catch (error) { toast(error.message); } });
}
document.getElementById('socialRefresh').onclick = loadSocial;
document.getElementById('moderationRefresh').onclick = loadModeration;
document.getElementById('friendSearchBtn').onclick = async () => { const email = document.getElementById('friendEmail').value.trim(); if (!email) return; const results = document.getElementById('friendSearchResult'); results.innerHTML = '<div class="social-empty">Searching…</div>'; try { const found = await socialRequest({ action: 'find', email }); results.innerHTML = found.friends ? socialPerson(found.user, 'Already friends', 'none') : socialPerson(found.user, 'Send request', 'request'); wireSocialActions(); } catch (error) { results.innerHTML = `<div class="social-empty">${esc(error.message)}</div>`; } };
document.getElementById('socialPostBtn').onclick = async () => {
  const button = document.getElementById('socialPostBtn'), field = document.getElementById('socialText'), file = document.getElementById('socialPhoto').files[0], accept = document.getElementById('communityAccept').checked;
  if (!communityGuidelinesAccepted && !accept) { document.querySelector('.community-guidelines').open = true; document.getElementById('communityAccept').focus(); toast('Please review and accept the Community Guidelines before your first post.'); return; }
  if (file && (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 400_000)) { toast('Choose a JPG, PNG, or WebP photo smaller than 400 KB.'); return; }
  button.disabled = true;
  try { const photo = file ? await resizeSocialPhoto(file) : ''; await socialRequest({ action: 'post', text: field.value, photo, acceptGuidelines: accept }); field.value = ''; document.getElementById('socialPhoto').value = ''; clearPhotoPreview(); toast('Shared with your friends.'); await loadSocial(); }
  catch (error) { toast(error.message); } finally { button.disabled = false; }
};
function resizeSocialPhoto(file) { return new Promise((resolve, reject) => { const image = new Image(), url = URL.createObjectURL(file); image.onload = () => { const ratio = Math.min(1, 1280 / Math.max(image.width, image.height)), canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * ratio); canvas.height = Math.round(image.height * ratio); canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(url); resolve(canvas.toDataURL('image/jpeg', .78)); }; image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That photo could not be opened.')); }; image.src = url; }); }
let photoPreviewUrl = '';
document.getElementById('choosePhotoBtn').onclick = () => document.getElementById('socialPhoto').click();
document.getElementById('socialPhoto').onchange = event => {
  const file = event.target.files[0]; if (!file) return;
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 400_000) { event.target.value = ''; toast('Choose a JPG, PNG, or WebP photo smaller than 400 KB.'); return; }
  clearPhotoPreview(); photoPreviewUrl = URL.createObjectURL(file); document.getElementById('photoPreview').src = photoPreviewUrl; document.getElementById('photoPreviewWrap').hidden = false;
};
function clearPhotoPreview() { if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl); photoPreviewUrl = ''; document.getElementById('photoPreview').removeAttribute('src'); document.getElementById('photoPreviewWrap').hidden = true; }
document.getElementById('removePhotoBtn').onclick = () => { document.getElementById('socialPhoto').value = ''; clearPhotoPreview(); };
document.getElementById('profilePhoto').onchange = async event => {
  const file = event.target.files[0]; if (!file) return;
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 8_000_000) { event.target.value = ''; toast('Choose a JPG, PNG, or WebP profile photo smaller than 8 MB.'); return; }
  try { profilePhotoData = await resizeProfilePhoto(file); const preview = document.getElementById('profileAvatarPreview'); preview.src = profilePhotoData; preview.hidden = false; document.getElementById('profileAvatarFallback').hidden = true; document.getElementById('removeProfilePhotoBtn').hidden = false; } catch { toast('That profile photo could not be opened.'); }
};
document.getElementById('removeProfilePhotoBtn').onclick = () => { profilePhotoData = ''; document.getElementById('profilePhoto').value = ''; const preview = document.getElementById('profileAvatarPreview'); preview.removeAttribute('src'); preview.hidden = true; document.getElementById('profileAvatarFallback').hidden = false; document.getElementById('removeProfilePhotoBtn').hidden = true; };
function resizeProfilePhoto(file) { return new Promise((resolve, reject) => { const image = new Image(), url = URL.createObjectURL(file); image.onload = () => { const side = Math.min(image.width, image.height), x = (image.width - side) / 2, y = (image.height - side) / 2, canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 320; canvas.getContext('2d').drawImage(image, x, y, side, side, 0, 0, 320, 320); URL.revokeObjectURL(url); resolve(canvas.toDataURL('image/jpeg', .76)); }; image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Invalid photo')); }; image.src = url; }); }
document.getElementById('saveProfileBtn').onclick = async event => {
  const button = event.currentTarget, ageField = document.getElementById('profileAge'), ageValue = Number(ageField.value);
  if (ageField.value && (!Number.isInteger(ageValue) || ageValue < 18 || ageValue > 120)) { toast('Enter an age from 18 to 120, or leave it blank.'); ageField.focus(); return; }
  button.disabled = true;
  const submitted = { avatar: profilePhotoData, hobbies: [...document.querySelectorAll('.hobby-options input:checked')].map(input => input.value), spotify: document.getElementById('profileSpotify').value.trim(), age: document.getElementById('profileAge').value, hometown: document.getElementById('profileHometown').value.trim(), quote: document.getElementById('profileQuote').value.trim(), relationshipStatus: document.getElementById('profileRelationship').value };
  try { const result = await socialRequest({ action: 'profile', profile: submitted }); renderCommunityProfile(result.profile); if (profile) { profile.communityProfile = communityProfile; localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } toast('Your profile is saved for your friends.'); }
  catch (error) { toast(error.message || 'Could not save your profile.'); }
  finally { button.disabled = false; }
};
function localReflection(list) {
  const tasks = list.filter(e => e.category === 'Tasks'), health = list.filter(e => e.category === 'Health'), journals = list.filter(e => e.category === 'Journal');
  const checkin = moodCheckins[selectedDate];
  const summary = list.length ? `${list.length} ${list.length === 1 ? 'moment' : 'moments'} logged${checkin ? ` · mood ${checkin}` : ''}.` : checkin ? `Mood check-in: ${checkin}.` : 'No entries yet. Add a note whenever you’re ready.';
  const highlights = [];
  if (checkin) highlights.push(`Mood check-in: ${checkin}`);
  if (tasks.length) highlights.push(`${tasks.filter(e => e.completed).length} of ${tasks.length} tasks completed`);
  if (health.length) highlights.push(`Health or habit check-ins: ${health.length}`);
  if (journals.length) highlights.push(`Journal entries: ${journals.length}`);
  const nudge = tasks.some(e => !e.completed) ? 'Pick one open task and give it ten minutes.' : health.length ? 'Choose one small act of care that fits today.' : journals.length ? 'Turn one thing you wrote into a small next step.' : 'Write one honest sentence to begin.';
  return { summary, nudge, highlights, advice: list.map(e => ({ id: e.id, text: e.category === 'Tasks' ? (e.completed ? 'You finished this task. Take a moment to recognize that progress, then give yourself a little space before adding another commitment.' : 'Make this easier to begin by defining the first action you can complete in about ten minutes. Once that is done, decide on the next step.') : e.category === 'Health' ? 'Treat this check-in as information, not a judgment. Choose one gentle, realistic action and notice how you feel afterward. For health concerns, consult a qualified professional.' : 'Take a moment to name what feels most important in this entry. Identify one part you can influence today, then choose a small response that respects your energy.' })) };
}
async function availability() {
  try {
    const response = await fetch(apiUrl('/api/status'));
    if (!response.ok) throw new Error('AI service unavailable');
    ({ aiReady } = await response.json());
    setStatus(aiReady ? 'Online AI ready' : 'AI service not connected', aiReady);
  } catch { aiReady = false; setStatus('Local guidance · AI offline'); }
}
async function loadQuota() {
  try {
    const response = await fetch(apiUrl('/api/quota'), { headers: { Authorization: `Bearer ${localStorage.getItem(AUTH_KEY)}` } });
    if (response.status === 401) { localStorage.removeItem(AUTH_KEY); sessionStorage.removeItem(UNLOCK_KEY); location.replace('welcome.html'); return false; }
    if (!response.ok) throw new Error('Could not load account usage.');
    const data = await response.json();
    planState = data.quota || planState;
    billingAccountId = data.billingAccountId || '';
    updatePlanCard();
    await syncExistingPlusPurchase();
    return true;
  } catch { document.getElementById('planUsage').textContent = 'Connect to your account to see this month’s AI usage'; return false; }
}
function journalHistory() {
  const end = dateFromInput(selectedDate);
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  const from = toDateInput(start), through = toDateInput(end);
  return entries.filter(e => e.category === 'Journal' && e.date >= from && e.date <= through)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || ''))
    .slice(0, 60)
    .map(e => ({ date: e.date, text: e.text, mood: e.mood }));
}
async function makeReflection(useAi = false) {
  const list = current();
  let failure = '';
  if (useAi && aiReady) {
    try {
      const response = await fetch(apiUrl('/api/insights'), {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem(AUTH_KEY)}` },
      body: JSON.stringify({ date: selectedDate, entries: [...list.map(e => ({ category: e.category, text: e.text, mood: e.mood, completed: e.completed, dueDate: e.dueDate })), ...(moodCheckins[selectedDate] ? [{ category: 'Health', text: 'Daily mood check-in', mood: moodCheckins[selectedDate] }] : [])], journalHistory: journalHistory() })
      });
      const data = await response.json();
      if (data.quota) { planState = data.quota; updatePlanCard(); }
      if (!response.ok && data.code === 'MONTHLY_LIMIT_REACHED') {
        document.getElementById('plusInfo').hidden = false;
        toast('You have used this month’s AI reflections. Your allowance resets next month.');
        return { ...localReflection(list), source: 'local' };
      }
      if (!response.ok) throw new Error(data.error || 'AI could not respond');
      setStatus('AI reflection updated', true);
      return { ...data, source: 'ai', advice: (data.advice || []).map(a => ({ id: list[a.entryIndex]?.id, text: String(a.text || '').slice(0, 700) })).filter(a => a.id && a.text) };
    } catch (error) {
      failure = String(error?.message || 'The AI request did not complete.').slice(0, 220);
      setStatus('AI request failed · local guidance shown');
      toast(`${failure} Showing general local guidance instead.`);
    }
  } else if (useAi) {
    failure = 'Online AI is not connected.';
    setStatus('AI offline · local guidance shown');
    toast('Online AI is not connected yet. Showing local guidance instead.');
  }
  return { ...localReflection(list), source: 'local', failure };
}
function renderEntries(list) {
  const visible = list.filter(e => e.category !== 'Tasks');
  document.getElementById('entries').innerHTML = visible.length ? visible.slice().reverse().map(e => `<article class="entry" data-entry-id="${esc(e.id)}"><div class="entry-icon">${icons[e.category] || '✦'}</div><div><div class="entry-title">${esc(e.text)}</div><div class="entry-meta">${esc(e.category)}${e.mood ? ' · ' + esc(e.mood) : ''} · ${esc(e.time || '')}</div>${e.advice ? `<details class="entry-advice"><summary>AI note</summary><div class="advice">✦ ${esc(e.advice)}</div></details>` : ''}</div><div class="entry-actions"><button class="icon-btn delete-btn" data-id="${esc(e.id)}" title="Delete entry" aria-label="Delete entry">×</button></div></article>`).join('') : '<div class="empty"><span>☀️</span>No entries for this date.</div>';
  document.querySelectorAll('.delete-btn').forEach(b => b.onclick = () => { entries = entries.filter(e => e.id !== b.dataset.id); save(); render(); });
}
function renderTasks() {
  const tasks = entries.filter(e => e.category === 'Tasks').sort((a, b) => Number(a.completed) - Number(b.completed) || ({deep:0,steady:1,gentle:2}[a.priority] ?? 1) - ({deep:0,steady:1,gentle:2}[b.priority] ?? 1) || (a.dueDate || a.date).localeCompare(b.dueDate || b.date));
  const openCount = tasks.filter(e => !e.completed).length;
  document.getElementById('taskCount').textContent = `${openCount} open · ${tasks.length} total`;
  document.getElementById('taskMomentum').textContent = openCount ? `You have ${openCount} open ${openCount === 1 ? 'step' : 'steps'}. Pick one that matches the energy you have today.` : 'You have room to choose something worth doing next.';
  document.getElementById('taskList').innerHTML = tasks.length ? tasks.map(e => `<div class="task-item"><input class="task-check" type="checkbox" data-id="${esc(e.id)}" aria-label="Mark task complete" ${e.completed ? 'checked' : ''}><div><div class="task-copy${e.completed ? ' done' : ''}">${esc(e.text)}</div><div class="task-meta">${e.priority ? `${({gentle:'Gentle start',steady:'Steady focus',deep:'Deep focus'})[e.priority] || ''} · ` : ''}${e.dueDate ? `Due ${esc(prettyDate(e.dueDate))}` : `Added ${esc(prettyDate(e.date))}`}${e.completed ? ' · Complete' : ''}</div>${!e.completed ? `<label class="task-reminder">Phone reminder<input type="datetime-local" data-task-reminder="${esc(e.id)}" aria-label="Reminder date and time" value="${esc(e.reminderAt || '')}"></label>` : ''}</div><button class="icon-btn task-delete" data-id="${esc(e.id)}" title="Delete task" aria-label="Delete task">×</button></div>`).join('') : '<div class="empty"><span>✓</span>Your path is clear. Add a next step whenever one comes to mind.</div>';
  document.querySelectorAll('[data-task-reminder]').forEach(input => input.onchange = () => {
    const task = entries.find(entry => entry.id === input.dataset.taskReminder);
    if (!task) return;
    if (input.value && (!Number.isFinite(new Date(input.value).getTime()) || new Date(input.value) <= new Date())) { toast('Choose a future reminder time.'); input.value = task.reminderAt || ''; return; }
    task.reminderAt = input.value;
    if (input.value && !task.notificationId) task.notificationId = Math.max(10000, ...entries.map(entry => Number(entry.notificationId) || 0)) + 1;
    save();
    toast(window.compassNotifications?.settings().tasks ? 'Task reminder saved.' : 'Time saved. Enable task reminders in Notifications to receive it on your phone.');
  });
  document.querySelectorAll('.task-check').forEach(box => box.onchange = () => { const task = entries.find(e => e.id === box.dataset.id); if (task) { task.completed = box.checked; save(); render(); } });
  document.querySelectorAll('.task-delete').forEach(button => button.onclick = () => { entries = entries.filter(e => e.id !== button.dataset.id); save(); render(); });
}
async function render(useAi = false) {
  const list = current();
  const isToday = selectedDate === today();
  document.getElementById('todayLabel').textContent = prettyDate(selectedDate);
  document.getElementById('entryHeading').textContent = isToday ? 'Today’s entries' : `Entries · ${prettyDate(selectedDate)}`;
  document.getElementById('historyDate').value = selectedDate;
  document.getElementById('nextDay').disabled = selectedDate >= today();
  document.getElementById('entryCount').textContent = `${list.length} ${list.length === 1 ? 'entry' : 'entries'}`;
  document.getElementById('statEntries').textContent = list.length;
  document.getElementById('statCats').textContent = new Set(list.map(e => e.category)).size;
  document.getElementById('statDone').textContent = list.filter(e => e.category === 'Tasks' && e.completed).length;
  document.getElementById('summaryLabel').textContent = isToday ? 'Today' : 'Selected day';
  renderEntries(list);
  renderTasks();
  const reflection = await makeReflection(useAi);
  const note = document.getElementById('reflectionNote');
  if (note) note.textContent = reflection.source === 'ai' ? 'Personalized with AI' : reflection.failure ? 'Local reflection · AI unavailable' : 'Local reflection';
  document.getElementById('summary').textContent = reflection.summary || 'Your day is taking shape.';
  document.getElementById('nudge').textContent = reflection.nudge || reflection.advice?.[0]?.text || localReflection(list).nudge;
  document.getElementById('highlights').innerHTML = (reflection.highlights || []).map(x => `<li>${esc(x)}</li>`).join('');
  if (reflection.source === 'ai') reflection.advice?.forEach(a => { const e = entries.find(x => x.id === a.id); if (e) e.advice = a.text; });
  if (reflection.source === 'ai' && reflection.advice?.length) {
    save();
    document.querySelectorAll('.entry[data-entry-id]').forEach(node => {
      const item = entries.find(x => x.id === node.dataset.entryId);
      if (item?.advice) { let details = node.querySelector('.entry-advice'); if (!details) { details = document.createElement('details'); details.className = 'entry-advice'; details.innerHTML = '<summary>AI note</summary><div class="advice"></div>'; node.children[1].append(details); } details.querySelector('.advice').textContent = `✦ ${item.advice}`; }
    });
  }
  const marked = current().filter(e => e.category === 'Tasks' && e.completed);
  document.getElementById('wins').innerHTML = marked.length ? marked.map(e => `<div class="habit-row"><span><span class="habit-icon">✓</span><span class="habit-name">${esc(e.text.slice(0, 42))}${e.text.length > 42 ? '…' : ''}</span></span><span class="habit-value">Done</span></div>`).join('') : '<div class="empty" style="padding:12px"><span>🌱</span>Your progress will show up here.</div>';
}
function moveDate(days) {
  const next = dateFromInput(selectedDate);
  next.setDate(next.getDate() + days);
  const value = toDateInput(next);
  if (value <= today()) { selectedDate = value; render(); }
}
document.getElementById('prevDay').onclick = () => moveDate(-1);
document.getElementById('nextDay').onclick = () => moveDate(1);
document.getElementById('historyDate').onchange = event => { if (event.target.value && event.target.value <= today()) { selectedDate = event.target.value; render(); } else { event.target.value = selectedDate; } };
document.getElementById('addBtn').onclick = () => {
  const field = document.getElementById('entryText'), text = field.value.trim(); if (!text) { field.focus(); return; }
  const now = new Date();
  entries.push({ id: crypto.randomUUID(), date: selectedDate, time: new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(now), category: selected, text, mood: '', completed: false, dueDate: selected === 'Tasks' ? document.getElementById('taskDue').value : '', advice: '' });
  save(); field.value = ''; document.getElementById('taskDue').value = ''; render(); toast(selected === 'Tasks' ? 'Task added to your list.' : 'Entry added to your day.');
};
document.getElementById('taskComposerAdd').onclick = () => { const field = document.getElementById('taskComposerText'), text = field.value.trim(); if (!text) { field.focus(); return; } entries.push({ id: crypto.randomUUID(), date: today(), time: new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date()), category: 'Tasks', text, completed: false, dueDate: document.getElementById('taskComposerDue').value, priority: document.getElementById('taskPriority').value, advice: '' }); save(); field.value = ''; document.getElementById('taskComposerDue').value = ''; renderTasks(); document.getElementById('statDone').textContent = entries.filter(e => e.date === today() && e.category === 'Tasks' && e.completed).length; toast('Added to your path.'); };
document.getElementById('taskComposerText').addEventListener('keydown', event => { if (event.key === 'Enter') document.getElementById('taskComposerAdd').click(); });
function loadLocal(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value ?? fallback; } catch { return fallback; } }
function renderHealth() {
  const logs = loadLocal(CALORIE_LOG_KEY, []).filter(item => item.date === today());
  document.getElementById('calorieLog').innerHTML = logs.length ? logs.map((item, index) => `<div class="entry"><div class="entry-icon">🍽️</div><div><div class="entry-title">${esc(item.note)}</div><div class="entry-meta">${item.amount} kcal</div></div><button class="icon-btn" data-calorie-delete="${index}" aria-label="Delete calorie entry">×</button></div>`).join('') : '<div class="social-empty">No food notes yet today.</div>';
  document.querySelectorAll('[data-calorie-delete]').forEach(button => button.onclick = () => { const all = loadLocal(CALORIE_LOG_KEY, []), dayEntries = all.filter(item => item.date === today()), remove = dayEntries[Number(button.dataset.calorieDelete)]; localStorage.setItem(CALORIE_LOG_KEY, JSON.stringify(all.filter(item => item !== remove))); renderHealth(); });
  const habits = loadLocal(HABIT_LIST_KEY, []), done = loadLocal(HABIT_DONE_KEY, {}), todayDone = done[today()] || [];
  document.getElementById('habitRows').innerHTML = habits.length ? habits.map((habit, index) => `<label class="habit-row"><span><span class="habit-icon">${todayDone.includes(habit) ? '✓' : '○'}</span><span class="habit-name">${esc(habit)}</span></span><input type="checkbox" data-habit-index="${index}" ${todayDone.includes(habit) ? 'checked' : ''} aria-label="Mark ${esc(habit)} complete"></label>`).join('') : '<div class="social-empty">Add a habit to begin your personal rhythm.</div>';
  document.querySelectorAll('[data-habit-index]').forEach(box => box.onchange = () => { const habit = habits[Number(box.dataset.habitIndex)]; done[today()] ||= []; done[today()] = box.checked ? [...new Set([...done[today()], habit])] : done[today()].filter(item => item !== habit); localStorage.setItem(HABIT_DONE_KEY, JSON.stringify(done)); renderHealth(); });
  document.getElementById('healthEntries').innerHTML = entries.filter(item => item.category === 'Health' && item.date === today()).map(item => `<article class="entry"><div class="entry-icon">☘️</div><div class="entry-title">${esc(item.text)}</div></article>`).join('') || '<div class="social-empty">Your health notes will appear here.</div>';
}
document.getElementById('calorieAdd').onclick = () => { const note = document.getElementById('calorieNote').value.trim(), amount = Number(document.getElementById('calorieAmount').value); if (!note || !Number.isInteger(amount) || amount < 0 || amount > 20000) { toast('Add a short note and a calorie estimate from 0 to 20,000.'); return; } const logs = loadLocal(CALORIE_LOG_KEY, []); logs.push({ note, amount, date: today() }); localStorage.setItem(CALORIE_LOG_KEY, JSON.stringify(logs.slice(-200))); document.getElementById('calorieNote').value = ''; document.getElementById('calorieAmount').value = ''; renderHealth(); };
document.getElementById('habitAdd').onclick = () => { const field = document.getElementById('habitInput'), habit = field.value.trim(); if (!habit) return; const habits = loadLocal(HABIT_LIST_KEY, []); if (habits.length >= 12) { toast('You can keep up to 12 habits here.'); return; } if (habits.some(item => item.toLowerCase() === habit.toLowerCase())) { toast('That habit is already on your list.'); return; } habits.push(habit); localStorage.setItem(HABIT_LIST_KEY, JSON.stringify(habits)); field.value = ''; renderHealth(); };
function parseHealthRows(result) { try { const data = JSON.parse(result?.results || '[]'); return Array.isArray(data) ? data : []; } catch { return []; } }
function firstHealthValue(rows) { for (const row of rows) { if (typeof row === 'number') return row; if (row && typeof row === 'object') for (const [key, value] of Object.entries(row)) { if (/value|sum|total|average|bpm/i.test(key) && Number.isFinite(Number(value))) return Number(value); if (value && typeof value === 'object') { const inner = Object.values(value).find(x => Number.isFinite(Number(x))); if (inner !== undefined) return Number(inner); } } } return null; }
async function refreshHealthData() {
  const health = window.capacitorHealthFitness?.HealthFitness;
  if (!health) { document.getElementById('healthConnectNote').textContent = 'Health Connect syncing is available in the Android app after its native Health Connect module is installed. Your calorie notes and habits still work here.'; return; }
  const todayStart = new Date(); todayStart.setHours(0,0,0,0); const iso = date => date.toISOString().split('.')[0] + 'Z', end = new Date();
  const query = async (variable, operationType = 'SUM') => { const result = await health.getData({ parameters: JSON.stringify({ Variable: variable, StartDate: iso(todayStart), EndDate: iso(end), TimeUnit: 'DAY', OperationType: operationType, TimeUnitLength: 1, AdvancedQueryReturnType: 'ALL_DATA', AdvancedQueryResultType: 'RAW_DATA' }) }); return firstHealthValue(parseHealthRows(result)); };
  try { const [steps, burned, heart] = await Promise.all([query('STEPS'), query('CALORIES_BURNED'), health.getLastRecord({ variable: 'HEART_RATE' }).then(firstHealthValue)]); document.getElementById('stepsValue').textContent = steps === null ? '—' : Math.round(steps).toLocaleString(); document.getElementById('burnedValue').textContent = burned === null ? '—' : `${Math.round(burned)} kcal`; document.getElementById('heartValue').textContent = heart === null ? '—' : `${Math.round(heart)} bpm`; document.getElementById('healthConnectNote').textContent = 'Connected. Today’s Health Connect data is read on your device.'; }
  catch (error) { document.getElementById('healthConnectNote').textContent = `Health Connect did not return data: ${String(error?.message || 'permission may be missing').slice(0,160)}. You can review access in Android Health Connect settings.`; }
}
document.getElementById('connectHealthBtn').onclick = async () => { const health = window.capacitorHealthFitness?.HealthFitness; if (!health) { toast('Health Connect will be ready when the Android build includes its native health module.'); return; } try { await health.requestHealthPermissions({ customPermissions: JSON.stringify([{Variable:'STEPS',AccessType:'READ'},{Variable:'CALORIES_BURNED',AccessType:'READ'},{Variable:'HEART_RATE',AccessType:'READ'}]), allVariables: JSON.stringify({IsActive:false,AccessType:'READ'}), fitnessVariables: JSON.stringify({IsActive:false,AccessType:'READ'}), healthVariables: JSON.stringify({IsActive:false,AccessType:'READ'}), profileVariables: JSON.stringify({IsActive:false,AccessType:'READ'}), workoutVariables: JSON.stringify({IsActive:false,AccessType:'READ'}) }); localStorage.setItem(HEALTH_CONNECTED_KEY, 'true'); await refreshHealthData(); } catch (error) { toast(`Health Connect could not connect: ${String(error?.message || 'request not completed').slice(0,160)}`); } };
document.getElementById('entryText').addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') document.getElementById('addBtn').click(); });
async function refreshReflection() {
  const button = document.getElementById('refreshBtn');
  if (!await loadQuota()) { toast('Could not verify your account allowance. Connect to the server and try again.'); return; }
  if (aiReady && planState.count >= planState.limit) {
    document.getElementById('plusInfo').hidden = false;
    toast('You have used this month’s AI reflections. Your allowance resets next month.');
    return;
  }
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.textContent = 'Reflecting…';
  document.getElementById('nudge').textContent = 'Finding a useful next step for you…';
  try {
    await render(true);
  } catch {
    document.getElementById('nudge').textContent = localReflection(current()).nudge;
    toast('The reflection could not refresh. Please try again.');
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.textContent = 'Refresh my reflection & nudge';
  }
}
document.getElementById('refreshBtn').onclick = refreshReflection;
document.getElementById('refreshBtn').textContent = 'Refresh my reflection & nudge';
updatePlanCard();
initMoodGate();
availability();
renderCommunityProfile();
loadQuota();
render();
