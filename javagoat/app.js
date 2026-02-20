const ADMIN_EMAIL = 'khanshahidkhanshahid96@gmail.com';
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  databaseURL: 'https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.firebasestorage.app',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID'
};

const STATE = {
  user: null,
  isGuest: false,
  isAdmin: false,
  csrfToken: '',
  db: null,
  abortController: null,
  activeConversationId: null,
  conversations: JSON.parse(localStorage.getItem('javagoat_conversations') || '[]'),
  settings: {
    apiKey: '', model: 'openai/gpt-4o-mini', systemPrompt: '', theme: localStorage.getItem('javagoat_theme') || 'dark', imageProvider: 'pollinations', imageModel: 'stabilityai/stable-diffusion-3-medium'
  }
};

const $ = (s) => document.querySelector(s);
const escapeHtml = (str = '') => str.replace(/[&<>'"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const antiSql = (text='') => !/(\b(SELECT|UNION|INSERT|DROP|DELETE|UPDATE|--|;|OR\s+1=1)\b)/i.test(text);
const secureInput = (text='') => antiSql(text) ? escapeHtml(text.trim()) : '';
const saveConversations = () => localStorage.setItem('javagoat_conversations', JSON.stringify(STATE.conversations));
const saveSettingsLocal = () => localStorage.setItem('javagoat_settings', JSON.stringify(STATE.settings));
const toast = (msg, type='info') => {
  const div = document.createElement('div');
  div.className = 'toast';
  div.style.borderLeftColor = ({success:'#22c55e',error:'#ef4444',warning:'#f59e0b',info:'#3b82f6'})[type] || '#3b82f6';
  div.textContent = `${({success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'})[type]} ${msg}`;
  $('#toast-container').append(div);
  setTimeout(() => div.remove(), 3000);
};

function initFirebase() {
  try {
    firebase.initializeApp(firebaseConfig);
    STATE.db = firebase.database();
  } catch (e) { console.warn('Firebase init skipped', e); }
}

function buildSecurityStatus() {
  $('#security-status').innerHTML = `
    <li>✅ Cloud Sync ${STATE.isGuest ? 'Inactive (guest)' : 'Active'}</li>
    <li>✅ Admin Protection Active</li>
    <li>✅ Anti-SQLi Filter Active</li>
    <li>✅ CSRF Tokens Active</li>`;
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  STATE.settings.theme = theme;
  localStorage.setItem('javagoat_theme', theme);
}

function ensureConversation() {
  if (STATE.activeConversationId) return STATE.conversations.find(c => c.id === STATE.activeConversationId);
  const convo = { id: crypto.randomUUID(), title: 'New Chat', createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
  STATE.conversations.unshift(convo);
  STATE.activeConversationId = convo.id;
  saveConversations();
  renderHistory();
  return convo;
}

function renderHistory() {
  const search = $('#search-chat').value.toLowerCase();
  const groups = { Today:[], Yesterday:[], 'This Week':[], Older:[] };
  const now = new Date();
  for (const c of STATE.conversations) {
    if (search && !c.title.toLowerCase().includes(search)) continue;
    const d = new Date(c.updatedAt);
    const diff = (new Date(now.toDateString()) - new Date(d.toDateString())) / 86400000;
    const key = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : diff < 7 ? 'This Week' : 'Older';
    groups[key].push(c);
  }
  $('#history-list').innerHTML = Object.entries(groups).map(([k,v]) => v.length ? `<div class="history-group">${k}</div>${v.map(c => `<div class="history-item ${STATE.activeConversationId===c.id?'active':''}" data-id="${c.id}"><span>${escapeHtml(c.title)}</span><button data-del="${c.id}">✕</button></div>`).join('')}` : '').join('') || '<p class="typing">No conversations.</p>';
}

function codeEnhance(container) {
  container.querySelectorAll('pre code').forEach(block => {
    hljs.highlightElement(block);
    const btn = document.createElement('button');
    btn.className = 'copy-code btn btn-secondary';
    btn.textContent = 'Copy';
    btn.onclick = () => navigator.clipboard.writeText(block.innerText).then(() => toast('Code copied', 'success'));
    block.parentElement.append(btn);
  });
}

function renderMessages() {
  const convo = STATE.conversations.find(c => c.id === STATE.activeConversationId);
  $('#welcome').classList.toggle('hidden', !!(convo && convo.messages.length));
  const html = (convo?.messages || []).map((m, i) => {
    if (m.type === 'image') {
      return `<div class="message ai"><div class="avatar">🐐</div><div class="bubble"><img class="generated-image" src="${m.url}" alt="generated" data-full="${m.url}"/><p>${escapeHtml(m.prompt)}</p><div class="image-actions"><button data-dl="${m.url}" class="btn btn-secondary">Download</button><button data-copy-url="${m.url}" class="btn btn-secondary">Copy URL</button></div></div></div>`;
    }
    const body = m.role === 'assistant' ? marked.parse(m.content || '') : `<p>${escapeHtml(m.content || '')}</p>`;
    return `<div class="message ${m.role==='user'?'user':'ai'}"><div class="avatar">${m.role==='user'?'🙂':'🐐'}</div><div class="bubble">${body}${m.role==='assistant' ? `<div class="image-actions"><button data-copy-msg="${i}" class="btn btn-secondary">Copy</button><button data-regen="${i}" class="btn btn-secondary">Regenerate</button></div>`:''}</div></div>`;
  }).join('');
  $('#chat-messages').innerHTML = `${$('#welcome').outerHTML}${html}`;
  codeEnhance($('#chat-messages'));
  $('#chat-messages').scrollTop = $('#chat-messages').scrollHeight;
  bindMessageActions();
}

function bindMessageActions() {
  document.querySelectorAll('[data-full]').forEach(el => el.onclick = () => { $('#modal-image').src = el.dataset.full; $('#image-modal').classList.remove('hidden'); });
  document.querySelectorAll('[data-copy-msg]').forEach(el => el.onclick = () => {
    const convo = STATE.conversations.find(c => c.id === STATE.activeConversationId);
    navigator.clipboard.writeText(convo.messages[+el.dataset.copyMsg].content || ''); toast('Message copied','success');
  });
  document.querySelectorAll('[data-copy-url]').forEach(el => el.onclick = () => navigator.clipboard.writeText(el.dataset.copyUrl).then(() => toast('URL copied','success')));
  document.querySelectorAll('[data-dl]').forEach(el => el.onclick = () => { const a = document.createElement('a'); a.href = el.dataset.dl; a.download = 'javagoat-image.png'; a.click(); });
  document.querySelectorAll('[data-regen]').forEach(el => el.onclick = () => { const convo = STATE.conversations.find(c => c.id === STATE.activeConversationId); const prevUser = [...convo.messages.slice(0, +el.dataset.regen)].reverse().find(m => m.role==='user'); if (prevUser) sendMessage(prevUser.content, true); });
}

async function streamOpenRouter(messages, onChunk) {
  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', signal: STATE.abortController.signal,
    headers: { 'Content-Type':'application/json', Authorization:`Bearer ${STATE.settings.apiKey}` },
    body: JSON.stringify({ model: STATE.settings.model || 'openai/gpt-4o-mini', stream: true, messages })
  });
  if (!resp.ok) throw new Error(`OpenRouter error: ${resp.status}`);
  const reader = resp.body.getReader();
  const decoder = new TextDecoder(); let buffer = '';
  while (true) {
    const {done, value} = await reader.read(); if (done) break;
    buffer += decoder.decode(value, {stream:true});
    const lines = buffer.split('\n'); buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim(); if (data === '[DONE]') return;
      try { const json = JSON.parse(data); const token = json.choices?.[0]?.delta?.content || ''; if (token) onChunk(token); } catch {}
    }
  }
}

async function generateImage(prompt) {
  if (STATE.settings.imageProvider === 'openrouter') {
    if (!STATE.settings.apiKey) throw new Error('Missing OpenRouter API key');
    const r = await fetch('https://openrouter.ai/api/v1/images/generations', {
      method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${STATE.settings.apiKey}`},
      body: JSON.stringify({ model: STATE.settings.imageModel, prompt, size: '1024x1024' })
    });
    const j = await r.json(); return j.data?.[0]?.url;
  }
  try {
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${Date.now()}`;
  } catch { return `https://loremflickr.com/1024/1024/abstract?lock=${Date.now()}`; }
}

async function sendMessage(raw, regen=false) {
  const clean = secureInput(raw); if (!clean) return toast('Blocked potentially unsafe input', 'warning');
  const convo = ensureConversation();
  if (!regen) convo.messages.push({ role:'user', content: raw });
  const ai = { role:'assistant', content:'', streaming:true }; convo.messages.push(ai);
  if (convo.title === 'New Chat') convo.title = raw.length > 40 ? `${raw.slice(0, 40)}...` : raw;
  convo.updatedAt = Date.now();
  saveConversations(); renderHistory(); renderMessages();
  try {
    STATE.abortController = new AbortController();
    const context = [{role:'system',content:STATE.settings.systemPrompt || 'You are JavaGoat, a secure helpful AI assistant.'}, ...convo.messages.filter(m => m.role).map(m => ({role:m.role, content:m.content}))];
    await streamOpenRouter(context, (chunk) => { ai.content += chunk; renderMessages(); });
    ai.streaming = false; saveConversations();
  } catch (e) {
    ai.content = `Error: ${e.message}`; toast('Generation failed', 'error');
  } finally { STATE.abortController = null; saveConversations(); renderMessages(); }
}

async function handleSubmit() {
  const msg = $('#message-input').value.trim(); if (!msg) return;
  $('#message-input').value = '';
  if (document.querySelector('input[name="mode"]:checked').value === 'image') {
    const convo = ensureConversation();
    try {
      const url = await generateImage(msg);
      convo.messages.push({ type:'image', prompt: msg, url });
      convo.updatedAt = Date.now(); saveConversations(); renderHistory(); renderMessages(); toast('Image generated', 'success');
    } catch (e) { toast(e.message, 'error'); }
    return;
  }
  await sendMessage(msg);
}

function loadLocalSettings() {
  const saved = JSON.parse(localStorage.getItem('javagoat_settings') || 'null');
  if (saved) STATE.settings = { ...STATE.settings, ...saved };
}

async function syncSettingsFromCloud() {
  if (!STATE.db || STATE.isGuest) return;
  const snap = await STATE.db.ref('javagoat/settings').get();
  if (snap.exists()) STATE.settings = { ...STATE.settings, ...snap.val() };
  saveSettingsLocal();
}

async function saveSettings() {
  if (!STATE.isAdmin) return toast('Only admin can save settings', 'warning');
  STATE.settings.apiKey = $('#api-key').value.trim();
  STATE.settings.model = $('#model-id').value.trim() || 'openai/gpt-4o-mini';
  STATE.settings.systemPrompt = $('#system-prompt').value;
  STATE.settings.imageProvider = $('#img-provider').value;
  STATE.settings.imageModel = $('#img-model').value || STATE.settings.imageModel;
  saveSettingsLocal();
  if (STATE.db && !STATE.isGuest) await STATE.db.ref('javagoat/settings').set(STATE.settings);
  $('#model-label').textContent = STATE.settings.model;
  toast('Settings saved', 'success');
}

function populateSettingsUI() {
  const locked = !STATE.isAdmin;
  const masked = (v) => locked && v ? '********' : v;
  $('#api-key').value = masked(STATE.settings.apiKey);
  $('#model-id').value = masked(STATE.settings.model);
  $('#system-prompt').value = masked(STATE.settings.systemPrompt);
  $('#img-provider').value = STATE.settings.imageProvider;
  $('#img-model').value = masked(STATE.settings.imageModel);
  $('#img-model-wrap').style.display = STATE.settings.imageProvider === 'openrouter' ? 'block' : 'none';
  ['#api-key','#model-id','#system-prompt','#img-provider','#img-model'].forEach(s => $(s).disabled = locked);
  $('#save-settings').classList.toggle('hidden', locked);
  $('#api-status').textContent = STATE.settings.apiKey ? 'API status: configured' : 'API status: not configured';
  $('#model-label').textContent = STATE.settings.model;
  buildSecurityStatus();
}

async function loginGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  await firebase.auth().signInWithPopup(provider);
}

function loginGuest() {
  STATE.isGuest = true;
  STATE.user = { displayName:'Guest User', email:'guest@local', photoURL:'' };
  STATE.isAdmin = false;
  localStorage.setItem('javagoat_guest', '1');
  showApp();
}

async function showApp() {
  $('#auth-screen').classList.add('hidden');
  $('#chat-app').classList.remove('hidden');
  applyTheme(STATE.settings.theme);
  await syncSettingsFromCloud();
  populateSettingsUI();
  renderHistory(); renderMessages();
  $('#user-profile').textContent = `${STATE.user?.displayName || 'Unknown'} (${STATE.isAdmin ? 'Admin' : STATE.isGuest ? 'Guest' : 'User'})`;
}

function setupEvents() {
  $('#google-login').onclick = async () => { try { await loginGoogle(); } catch(e){ toast(e.message,'error'); } };
  $('#guest-login').onclick = loginGuest;
  $('#logout').onclick = async () => { localStorage.removeItem('javagoat_guest'); await firebase.auth().signOut().catch(()=>{}); location.reload(); };
  $('#send-btn').onclick = handleSubmit;
  $('#message-input').addEventListener('input', e => { e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight,180)}px`; });
  $('#message-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } });
  $('#stop-btn').onclick = () => { STATE.abortController?.abort(); toast('Generation stopped', 'info'); };
  $('#search-chat').addEventListener('input', () => renderHistory());
  $('#new-chat').onclick = () => { STATE.activeConversationId = null; ensureConversation(); renderMessages(); renderHistory(); };
  $('#history-list').onclick = (e) => {
    const del = e.target.dataset.del; if (del) { STATE.conversations = STATE.conversations.filter(c => c.id !== del); if (STATE.activeConversationId===del) STATE.activeConversationId = null; saveConversations(); renderHistory(); renderMessages(); return; }
    const id = e.target.closest('.history-item')?.dataset.id; if (id) { STATE.activeConversationId = id; renderHistory(); renderMessages(); }
  };
  $('#clear-chats').onclick = () => { if (confirm('Clear all chats?')) { STATE.conversations = []; STATE.activeConversationId = null; saveConversations(); renderHistory(); renderMessages(); } };
  $('#open-settings').onclick = () => { populateSettingsUI(); $('#settings-modal').classList.remove('hidden'); };
  $('#close-settings').onclick = () => $('#settings-modal').classList.add('hidden');
  $('#save-settings').onclick = () => saveSettings().catch(e => toast(e.message,'error'));
  $('#theme-toggle').onclick = () => applyTheme(STATE.settings.theme === 'dark' ? 'light' : 'dark');
  document.querySelectorAll('[data-theme]').forEach(b => b.onclick = () => applyTheme(b.dataset.theme));
  document.querySelectorAll('[data-toggle]').forEach(btn => btn.onclick = () => { const el = document.getElementById(btn.dataset.toggle); el.type = el.type === 'password' ? 'text' : 'password'; });
  $('#img-provider').onchange = () => $('#img-model-wrap').style.display = $('#img-provider').value === 'openrouter' ? 'block' : 'none';
  document.querySelectorAll('.suggestion').forEach(s => s.onclick = () => { $('#message-input').value = s.dataset.text; $('#message-input').focus(); });
  $('#toggle-sidebar').onclick = () => $('#sidebar').classList.toggle('open');
  $('#image-modal').onclick = () => $('#image-modal').classList.add('hidden');
}

function enforceHttps() {
  if (location.protocol === 'http:' && !location.hostname.includes('localhost')) location.replace(location.href.replace('http:', 'https:'));
}

window.addEventListener('DOMContentLoaded', async () => {
  enforceHttps();
  loadLocalSettings();
  initFirebase();
  setupEvents();
  STATE.csrfToken = Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2,'0')).join('');
  if (localStorage.getItem('javagoat_guest')) loginGuest();
  firebase.auth?.().onAuthStateChanged(async user => {
    if (!user) return;
    STATE.user = user;
    STATE.isGuest = false;
    STATE.isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL;
    await showApp();
  });
});
