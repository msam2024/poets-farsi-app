// app.js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(console.error);
}

const KEY = 'poetsApp.fa.v1';
const initialData = {
  poets: [
    { id: crypto.randomUUID(), name: 'مولانا', createdAt: Date.now() },
    { id: crypto.randomUUID(), name: 'حافظ', createdAt: Date.now() },
    { id: crypto.randomUUID(), name: 'سعدی', createdAt: Date.now() }
  ],
  lyrics: [
    {
      id: crypto.randomUUID(),
      poetId: null, // will be set to مولانا below
      title: 'بشنو از نی',
      body: `بشنو از نی چون حکایت می‌کند\nوز جدایی‌ها شکایت می‌کند\nکز نیستان تا مرا ببریده‌اند\nدر نفیرم مرد و زن نالیده‌اند`,
      createdAt: Date.now()
    }
  ]
};
// Tie sample lyric to مولانا
initialData.lyrics[0].poetId = initialData.poets[0].id;

const load = () => {
  const raw = localStorage.getItem(KEY);
  if (!raw) { localStorage.setItem(KEY, JSON.stringify(initialData)); return initialData; }
  try { return JSON.parse(raw); } catch { return initialData; }
};
const save = (data) => localStorage.setItem(KEY, JSON.stringify(data));
let db = load();

// DOM refs
const poetsView = document.getElementById('poetsView');
const poetsList = document.getElementById('poetsList');
const addPoetBtn = document.getElementById('addPoetBtn');
const lyricsView = document.getElementById('lyricsView');
const backToPoets = document.getElementById('backToPoets');
const poetTitle = document.getElementById('poetTitle');
const lyricsList = document.getElementById('lyricsList');
const addLyricBtn = document.getElementById('addLyricBtn');
const lyricDetailView = document.getElementById('lyricDetailView');
const backToLyrics = document.getElementById('backToLyrics');
const lyricTitle = document.getElementById('lyricTitle');
const lyricBody = document.getElementById('lyricBody');
const editLyricBtn = document.getElementById('editLyricBtn');
const deleteLyricBtn = document.getElementById('deleteLyricBtn');
const searchInput = document.getElementById('search');
const modal = document.getElementById('modal');
const modalForm = document.getElementById('modalForm');
const modalFields = document.getElementById('modalFields');
const modalTitle = document.getElementById('modalTitle');

let currentPoetId = null;
let currentLyricId = null;

const byCreatedDesc = (a, b) => b.createdAt - a.createdAt;

// Convert western digits to Persian for display
function faDigits(n) {
  const map = {'0':'۰','1':'۱','2':'۲','3':'۳','4':'۴','5':'۵','6':'۶','7':'۷','8':'۸','9':'۹'};
  return String(n).replace(/[0-9]/g, d => map[d]);
}

// Persian normalization for search
function normalizeFa(str = '') {
  return str
    .replace(/[\u064B-\u065F]/g, '')   // diacritics
    .replace(/\u064A/g, '\u06CC')      // Arabic Yeh → Persian Yeh
    .replace(/\u0643/g, '\u06A9')      // Arabic Kaf → Persian Keheh
    .replace(/\u200C/g, ' ')            // ZWNJ → space (optional)
    .toLowerCase();
}
const q = (s) => normalizeFa(s || '');

function setActive(el) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
}
function truncate(s, n) { return s.length > n ? s.slice(0, n-1) + '…' : s; }
function escapeHTML(s) { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escapeAttr(s) { return escapeHTML(s).replace(/"/g,'&quot;'); }

// Render poets
function renderPoets() {
  setActive(poetsView);
  const query = q(searchInput.value);
  const counts = db.lyrics.reduce((acc, l) => { acc[l.poetId] = (acc[l.poetId] || 0) + 1; return acc; }, {});
  let poets = [...db.poets].sort(byCreatedDesc);

  if (query) {
    const poetMatches = new Set(db.poets.filter(p => q(p.name).includes(query)).map(p => p.id));
    const lyricMatches = new Set(db.lyrics.filter(l => q(l.title).includes(query) || q(l.body).includes(query)).map(l => l.poetId));
    const allMatches = new Set([...poetMatches, ...lyricMatches]);
    poets = poets.filter(p => allMatches.has(p.id));
  }

  poetsList.innerHTML = poets.map(p => `
    <div class="item" data-id="${p.id}" role="button" tabindex="0">
      <div><strong>${escapeHTML(p.name)}</strong></div>
      <small>${faDigits(counts[p.id] || 0)} شعر</small>
    </div>
  `).join('');

  poetsList.querySelectorAll('.item').forEach(el => {
    el.addEventListener('click', () => openPoet(el.dataset.id));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') openPoet(el.dataset.id); });
  });
}

// Render lyrics for a poet
function openPoet(poetId) {
  currentPoetId = poetId;
  const poet = db.poets.find(p => p.id === poetId);
  poetTitle.textContent = poet ? poet.name : '—';
  setActive(lyricsView);

  const query = q(searchInput.value);
  let lyrics = db.lyrics.filter(l => l.poetId === poetId).sort(byCreatedDesc);
  if (query) {
    lyrics = lyrics.filter(l => q(l.title).includes(query) || q(l.body).includes(query));
  }

  lyricsList.innerHTML = lyrics.length ? lyrics.map(l => `
    <div class="item" data-id="${l.id}" role="button" tabindex="0">
      <div><strong>${escapeHTML(l.title)}</strong></div>
      <small>${truncate(escapeHTML(l.body), 80)}</small>
    </div>
  `).join('') : '<div class="item"><small>هنوز شعری افزوده نشده است.</small></div>';

  lyricsList.querySelectorAll('.item[data-id]').forEach(el => {
    el.addEventListener('click', () => openLyric(el.dataset.id));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') openLyric(el.dataset.id); });
  });
}

// Lyric detail
function openLyric(lyricId) {
  currentLyricId = lyricId;
  const lyric = db.lyrics.find(l => l.id === lyricId);
  setActive(lyricDetailView);
  lyricTitle.textContent = lyric.title;
  lyricBody.textContent = lyric.body;
}

// Search
searchInput.addEventListener('input', () => {
  if (currentPoetId) openPoet(currentPoetId); else renderPoets();
});

// Navigation
backToPoets.addEventListener('click', () => {
  currentPoetId = null; currentLyricId = null; renderPoets();
});
backToLyrics.addEventListener('click', () => {
  currentLyricId = null; openPoet(currentPoetId);
});

// Add/Edit Poet
addPoetBtn.addEventListener('click', () => {
  showModal({
    title: 'افزودن شاعر',
    fields: [{ id:'name', label:'نام شاعر', type:'text', required:true, placeholder:'مثلاً حافظ' }],
    onSave: (vals) => {
      db.poets.push({ id: crypto.randomUUID(), name: vals.name.trim(), createdAt: Date.now() });
      save(db); renderPoets();
    }
  });
});

// Add Lyric
addLyricBtn.addEventListener('click', () => {
  const poet = db.poets.find(p => p.id === currentPoetId);
  showModal({
    title: `افزودن شعر — ${poet?.name || ''}`,
    fields: [
      { id:'title', label:'عنوان شعر', type:'text', required:true, placeholder:'عنوان' },
      { id:'body', label:'متن شعر', type:'textarea', required:true, placeholder:'متن شعر را وارد کنید…', rows:8 }
    ],
    onSave: (vals) => {
      db.lyrics.push({ id: crypto.randomUUID(), poetId: currentPoetId, title: vals.title.trim(), body: vals.body.trim(), createdAt: Date.now() });
      save(db); openPoet(currentPoetId);
    }
  });
});

// Edit/Delete Lyric
editLyricBtn.addEventListener('click', () => {
  const l = db.lyrics.find(x => x.id === currentLyricId);
  showModal({
    title: `ویرایش شعر — ${l.title}`,
    fields: [
      { id:'title', label:'عنوان', type:'text', required:true, value:l.title },
      { id:'body', label:'متن', type:'textarea', required:true, value:l.body, rows:8 }
    ],
    onSave: (vals) => { l.title = vals.title.trim(); l.body = vals.body.trim(); save(db); openLyric(currentLyricId); }
  });
});

deleteLyricBtn.addEventListener('click', () => {
  if (!confirm('این شعر حذف شود؟')) return;
  db.lyrics = db.lyrics.filter(x => x.id !== currentLyricId);
  save(db); openPoet(currentPoetId);
});

// Modal helper
function showModal({ title, fields, onSave }) {
  modalTitle.textContent = title;
  modalFields.innerHTML = fields.map(f => {
    const valAttr = f.value ? ` value="${escapeAttr(f.value)}"` : '';
    const reqAttr = f.required ? ' required' : '';
    const phAttr = f.placeholder ? ` placeholder="${escapeAttr(f.placeholder)}"` : '';
    const rowsAttr = f.rows ? ` rows="${f.rows}"` : '';
    if (f.type === 'textarea') {
      return `<label>${f.label}<br><textarea id="${f.id}"${reqAttr}${phAttr}${rowsAttr} dir="rtl">${f.value?escapeHTML(f.value):''}</textarea></label>`;
    }
    return `<label>${f.label}<br><input id="${f.id}" type="${f.type}"${reqAttr}${phAttr}${valAttr} dir="rtl"></label>`;
  }).join('');
  modal.showModal();
  modalForm.onsubmit = (e) => {
    e.preventDefault();
    const vals = Object.fromEntries(fields.map(f => [f.id, document.getElementById(f.id).value]));
    modal.close(); onSave(vals);
  };
}

// Initial render
renderPoets();
