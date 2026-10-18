const KEY = 'daily-compass-entries-v1';
const PROFILE_KEY = 'daily-compass-profile-v1';
const UNLOCK_KEY = 'daily-compass-unlocked-v1';
const AUTH_KEY = 'daily-compass-auth-token-v1';
const MOOD_CHECKINS_KEY = 'daily-compass-mood-checkins-v1';
const MOOD_DONE_KEY = 'daily-compass-mood-completed-v1';
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
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(KEY);
  localStorage.removeItem(MOOD_CHECKINS_KEY);
  localStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(UNLOCK_KEY);
  sessionStorage.removeItem(MOOD_DONE_KEY);
  location.replace('welcome.html');
};

function load() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
function loadMoodCheckins() { try { const value = JSON.parse(localStorage.getItem(MOOD_CHECKINS_KEY) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; } }
function save() { localStorage.setItem(KEY, JSON.stringify(entries)); }
function updatePlanCard() {
  const limit = planState.tier === 'plus' ? PLUS_AI_LIMIT : FREE_AI_LIMIT;
  document.getElementById('planName').textContent = planState.tier === 'plus' ? 'Compass Plus' : 'Free plan';
  document.getElementById('planUsage').textContent = `${Math.min(planState.count, limit)} of ${limit} AI reflections used this month`;
}
function today() { return toDateInput(new Date()); }
function toDateInput(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function dateFromInput(value) { return new Date(`${value}T12:00:00`); }
function prettyDate(value) { return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(dateFromInput(value)); }
const moodOptions = ['😊 Happy','✨ Excited','🌿 Calm','🙏 Grateful','💪 Motivated','🎯 Focused','🥰 Loved','🌈 Hopeful','🏆 Proud','😌 Content','😐 Okay','😟 Anxious','😣 Overwhelmed','😢 Sad','😤 Frustrated','🫥 Lonely','😴 Tired','😵‍💫 Restless','😞 Discouraged','🪫 Low energy'];
const moodGlows = ['#ffbf69','#ff9f75','#64d6b0','#f4cb67','#65d9c2','#66aaff','#f18fca','#88d99a','#ffd36a','#a5d998','#9aaac0','#9d91ff','#f28fa2','#86aaff','#ff967e','#b79bf0','#82b3d6','#ffad79','#8f9ad0','#8ab3c0'];
const dailyQuotes = ['Small steps still count as movement.','You can begin again without starting over.','Make room for what gives you energy.','Progress can be quiet and still be real.','A little clarity can change the shape of a day.','You are allowed to move at a human pace.','Notice what is working, then build from there.','Rest can be part of the path forward.'];
function showTodayMood() { const mood = moodCheckins[today()]; document.getElementById('todayMood').textContent = mood ? `Today’s mood · ${mood}` : ''; }
function initMoodGate() {
  const gate = document.getElementById('moodGate'), rail = document.getElementById('moodChoices'), continueButton = document.getElementById('continueMood'), hint = document.getElementById('moodSelectionHint');
  rail.innerHTML = moodOptions.map((mood, index) => { const firstSpace = mood.indexOf(' '); const emoji = mood.slice(0, firstSpace); const name = mood.slice(firstSpace + 1); return `<button class="mood-option" type="button" data-mood="${mood}" aria-label="${mood}" aria-pressed="false" style="--mood-glow:${moodGlows[index]}"><span class="mood-check" aria-hidden="true">✓</span><span class="mood-emoji" aria-hidden="true">${emoji}</span><span class="mood-name">${name}</span></button>`; }).join('');
  const shell = document.querySelector('.shell');
  if (sessionStorage.getItem(MOOD_DONE_KEY) === 'true') { gate.hidden = true; shell.inert = false; showTodayMood(); return; }
  shell.inert = true;
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
  requestAnimationFrame(() => rail.querySelector('.mood-option')?.focus({ preventScroll: true }));
}
document.querySelector('.hero p').textContent = `Hi, ${profile?.name?.split(/\s+/)[0] || 'there'}. Capture what matters. Find your next small step.`;
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
function localReflection(list) {
  const tasks = list.filter(e => e.category === 'Tasks'), health = list.filter(e => e.category === 'Health'), journals = list.filter(e => e.category === 'Journal');
  const summary = list.length ? `You captured ${list.length} ${list.length === 1 ? 'moment' : 'moments'} across ${new Set(list.map(e => e.category)).size} areas on ${prettyDate(selectedDate)}. Notice what took the most energy and what gave some back. Choose one small action that would make the next day feel a little easier.` : `There are no entries for ${prettyDate(selectedDate)} yet. Use the date picker to browse earlier days, or add a note to begin.`;
  const highlights = [];
  if (tasks.length) highlights.push(`${tasks.filter(e => e.completed).length} of ${tasks.length} tasks completed`);
  if (health.length) highlights.push(`Health or habit check-ins: ${health.length}`);
  if (journals.length) highlights.push(`Journal entries: ${journals.length}`);
  const nudge = tasks.some(e => !e.completed) ? 'Choose the one open task that would make the rest of your day easier. Spend just ten minutes getting it started.' : health.length ? 'Pick one small act of care that fits how you feel today, then give yourself credit for following through.' : journals.length ? 'Revisit one thing you wrote and turn it into a small, kind action you can take today.' : 'Write one honest sentence about what is on your mind. That is enough of a place to begin.';
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
    updatePlanCard();
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
        body: JSON.stringify({ date: selectedDate, entries: list.map(e => ({ category: e.category, text: e.text, mood: e.mood, completed: e.completed, dueDate: e.dueDate })), journalHistory: journalHistory() })
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
  document.getElementById('entries').innerHTML = visible.length ? visible.slice().reverse().map(e => `<article class="entry" data-entry-id="${esc(e.id)}"><div class="entry-icon">${icons[e.category] || '✦'}</div><div><div class="entry-title">${esc(e.text)}</div><div class="entry-meta">${esc(e.category)}${e.mood ? ' · ' + esc(e.mood) : ''} · ${esc(e.time || '')}</div>${e.advice ? `<div class="advice">✦ ${esc(e.advice)}</div>` : ''}</div><div class="entry-actions"><button class="icon-btn delete-btn" data-id="${esc(e.id)}" title="Delete entry" aria-label="Delete entry">×</button></div></article>`).join('') : '<div class="empty"><span>☀️</span>No journal or check-in entries for this date.</div>';
  document.querySelectorAll('.delete-btn').forEach(b => b.onclick = () => { entries = entries.filter(e => e.id !== b.dataset.id); save(); render(); });
}
function renderTasks() {
  const tasks = entries.filter(e => e.category === 'Tasks').sort((a, b) => Number(a.completed) - Number(b.completed) || (a.dueDate || a.date).localeCompare(b.dueDate || b.date));
  const openCount = tasks.filter(e => !e.completed).length;
  document.getElementById('taskCount').textContent = `${openCount} open · ${tasks.length} total`;
  document.getElementById('taskList').innerHTML = tasks.length ? tasks.map(e => `<div class="task-item"><input class="task-check" type="checkbox" data-id="${esc(e.id)}" aria-label="Mark task complete" ${e.completed ? 'checked' : ''}><div><div class="task-copy${e.completed ? ' done' : ''}">${esc(e.text)}</div><div class="task-meta">${e.dueDate ? `Due ${esc(prettyDate(e.dueDate))}` : `Added ${esc(prettyDate(e.date))}`}${e.completed ? ' · Complete' : ''}</div></div><button class="icon-btn task-delete" data-id="${esc(e.id)}" title="Delete task" aria-label="Delete task">×</button></div>`).join('') : '<div class="empty"><span>✓</span>Your task list is clear. Add a task above when something comes up.</div>';
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
  document.getElementById('summaryLabel').textContent = isToday ? 'Today + journal history' : 'Selected day + journal history';
  renderEntries(list);
  renderTasks();
  const reflection = await makeReflection(useAi);
  const note = document.getElementById('reflectionNote');
  if (note) note.textContent = reflection.source === 'ai'
    ? 'AI reflection generated from this day’s entries and journal notes from the previous 30 days.'
    : reflection.failure
      ? `${reflection.failure} General local guidance is shown; tap “Refresh my reflection & nudge” to try again.`
      : 'General local guidance is shown. Tap “Refresh my reflection & nudge” to request a personalized AI reflection.';
  document.getElementById('summary').textContent = reflection.summary || 'Your day is taking shape.';
  document.getElementById('nudge').textContent = reflection.nudge || reflection.advice?.[0]?.text || localReflection(list).nudge;
  document.getElementById('highlights').innerHTML = (reflection.highlights || []).map(x => `<li>${esc(x)}</li>`).join('');
  if (reflection.source === 'ai') reflection.advice?.forEach(a => { const e = entries.find(x => x.id === a.id); if (e) e.advice = a.text; });
  if (reflection.source === 'ai' && reflection.advice?.length) {
    save();
    document.querySelectorAll('.entry[data-entry-id]').forEach(node => {
      const item = entries.find(x => x.id === node.dataset.entryId);
      if (item?.advice) { let tip = node.querySelector('.advice'); if (!tip) { tip = document.createElement('div'); tip.className = 'advice'; node.children[1].append(tip); } tip.textContent = `✦ ${item.advice}`; }
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
  entries.push({ id: crypto.randomUUID(), date: selectedDate, time: new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(now), category: selected, text, mood: selected === 'Tasks' ? '' : document.getElementById('mood').value, completed: false, dueDate: selected === 'Tasks' ? document.getElementById('taskDue').value : '', advice: '' });
  save(); field.value = ''; document.getElementById('mood').value = ''; document.getElementById('taskDue').value = ''; render(); toast(selected === 'Tasks' ? 'Task added to your list.' : 'Entry added to your day.');
};
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
const musicTracks = {
  'quiet-piano': { kind: 'piano', notes: [392, 523.25, 659.25, 523.25, 440, 587.33, 698.46, 587.33, 392, 493.88, 587.33, null], wave: 'sine', interval: 920 },
  'blue-hour': { kind: 'pad', chords: [[130.81, 196, 261.63], [110, 164.81, 220], [123.47, 185, 246.94], [98, 146.83, 196]], wave: 'sine', interval: 6200 },
  'ocean-drift': { kind: 'ocean', notes: [659.25, 783.99, 587.33, 880, 783.99, 523.25], wave: 'sine', interval: 4800, filter: 430 },
  'soft-rain': { kind: 'rain', notes: [880, 1046.5, 783.99, 1174.66, 987.77, 1318.5], wave: 'sine', interval: 1050, filter: 3300 }
};
let musicContext, musicMaster, musicTimer, musicNodes = [], musicStep = 0, musicPlaying = false;
function stopSoundscape() {
  clearInterval(musicTimer); musicTimer = undefined;
  musicNodes.forEach(node => { try { node.stop(); } catch {} }); musicNodes = [];
}
function playTone(frequency, track, strength = 1) {
  if (!frequency) return;
  const oscillator = musicContext.createOscillator();
  const envelope = musicContext.createGain();
  const now = musicContext.currentTime;
  oscillator.type = track.wave;
  oscillator.frequency.setValueAtTime(frequency, now);
  envelope.gain.setValueAtTime(0.0001, now);
  const piano = track.kind === 'piano';
  const drop = track.kind === 'rain';
  envelope.gain.exponentialRampToValueAtTime((piano ? 0.15 : drop ? 0.035 : 0.07) * strength, now + (piano ? 0.025 : 0.08));
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + (piano ? 2.7 : drop ? 1.4 : 3.4));
  oscillator.connect(envelope); envelope.connect(musicMaster);
  oscillator.onended = () => { musicNodes = musicNodes.filter(node => node !== oscillator); };
  oscillator.start(now); oscillator.stop(now + (piano ? 2.8 : drop ? 1.5 : 3.5));
  musicNodes.push(oscillator);
}
function playPad(chord, track) {
  chord.forEach((frequency, index) => {
    const oscillator = musicContext.createOscillator();
    const envelope = musicContext.createGain();
    const now = musicContext.currentTime;
    oscillator.type = track.wave;
    oscillator.frequency.value = frequency;
    oscillator.detune.value = (index - 1) * 4;
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(0.055, now + 2.1);
    envelope.gain.setValueAtTime(0.055, now + 3.5);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + track.interval / 1000 + 1.7);
    oscillator.connect(envelope); envelope.connect(musicMaster);
    oscillator.onended = () => { musicNodes = musicNodes.filter(node => node !== oscillator); };
    oscillator.start(now); oscillator.stop(now + track.interval / 1000 + 1.8);
    musicNodes.push(oscillator);
  });
}
function addAmbientBed(track) {
  if (!['ocean', 'rain'].includes(track.kind)) return;
  const sampleRate = musicContext.sampleRate;
  const buffer = musicContext.createBuffer(1, sampleRate * 3, sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * 0.35;
  const source = musicContext.createBufferSource(); source.buffer = buffer; source.loop = true;
  const low = musicContext.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = track.filter;
  const high = musicContext.createBiquadFilter(); high.type = 'highpass'; high.frequency.value = track.kind === 'ocean' ? 70 : 220;
  const bedGain = musicContext.createGain(); bedGain.gain.value = track.kind === 'ocean' ? 0.11 : 0.065;
  source.connect(high); high.connect(low); low.connect(bedGain); bedGain.connect(musicMaster); source.start(); musicNodes.push(source);
  if (track.kind === 'ocean') {
    const swell = musicContext.createOscillator(), depth = musicContext.createGain();
    swell.frequency.value = 0.075; depth.gain.value = 0.065; swell.connect(depth); depth.connect(bedGain.gain); swell.start(); musicNodes.push(swell);
  }
}
async function startSoundscape() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) { toast('Audio playback is not supported in this browser.'); return; }
  musicContext ||= new AudioContextClass();
  await musicContext.resume();
  if (!musicMaster) { musicMaster = musicContext.createGain(); musicMaster.connect(musicContext.destination); }
  musicMaster.gain.value = Number(document.getElementById('musicVolume').value) / 100 * 0.22;
  stopSoundscape();
  const trackName = document.getElementById('musicTrack').value;
  const track = musicTracks[trackName] || musicTracks['quiet-piano'];
  addAmbientBed(track);
  musicStep = 0;
  const playNextSound = () => {
    if (track.kind === 'pad') playPad(track.chords[musicStep % track.chords.length], track);
    else if (track.kind === 'rain') { if (Math.random() > 0.25) playTone(track.notes[Math.floor(Math.random() * track.notes.length)], track, 0.7 + Math.random() * 0.5); }
    else playTone(track.notes[musicStep % track.notes.length], track, track.kind === 'ocean' ? 0.55 : 1);
    musicStep++;
  };
  playNextSound(); musicTimer = setInterval(playNextSound, track.interval);
  musicPlaying = true;
  const button = document.getElementById('musicToggle'); button.textContent = '■ Stop music'; button.classList.add('playing');
}
document.getElementById('musicToggle').onclick = async () => {
  if (musicPlaying) {
    stopSoundscape(); musicPlaying = false;
    const button = document.getElementById('musicToggle'); button.textContent = '▶ Play music'; button.classList.remove('playing');
  } else {
    try { await startSoundscape(); } catch { toast('Could not start music. Please try again.'); }
  }
};
document.getElementById('musicTrack').onchange = () => { if (musicPlaying) startSoundscape(); };
document.getElementById('musicVolume').oninput = event => { if (musicMaster) musicMaster.gain.setTargetAtTime(Number(event.target.value) / 100 * 0.22, musicContext.currentTime, 0.08); };
availability();
loadQuota();
render();
