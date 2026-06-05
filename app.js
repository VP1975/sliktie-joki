'use strict';

// ── Kategoriju saraksts ───────────────────────────────────────────────────
const CATEGORIES = [
  "Absurdie joki","Attiecības","Bērni","Blondīnes","Citāti","Daba","Dakteri",
  "Geji","Kas atšķirīgs?","Kas kopīgs?","Laikmetīgie...","Matemātika","Nacisms",
  "Nederīgās lietas","Nekrofīli","Nezināmais Čaks","Nezināmie fakti","Paradoksi",
  "Pedofīli","Politika","Priesteri","Rasisms","Ratiņkrēsli","Runā ka...","Sekss",
  "Senlatviešu dievības","Sievietes","Tautas gudrības","Vārdu spēles","Vecums","Veģetārieši"
];

// ── State ─────────────────────────────────────────────────────────────────
const state = {
  allJokes: [],
  filteredJokes: [],
  shownIds: new Set(),
  favoriteIds: new Set(),
  currentJoke: null,
  history: [],          // skatīto joku vēsture (random režīmā)
  historyPos: -1,       // pašreizējā pozīcija vēsturē (-1 = jauns joks)
  mode: 'MAIN',
  fontSize: 20,
  selectedSound: 'sparkle',
  searchQuery: '',
  selectedCat: '',      // aktīvā kategorija filtrā ('') = visi
};

// ── DOM refs ──────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const el = {
  jokeCard:          $('joke-card'),
  statusText:        $('status-text'),
  jokeNumber:        $('joke-number'),
  jokeText:          $('joke-text'),
  btnFavorite:       $('btn-favorite'),
  btnResetSearch:    $('btn-reset-search'),
  btnRandom:         $('btn-random'),
  btnBack:           $('btn-back'),
  btnPrev:           $('btn-prev'),
  btnStar:           $('btn-star'),
  navBar:            $('nav-bar'),
  btnResults:        $('btn-results'),
  btnResetShown:     $('btn-reset-shown'),
  btnSettings:       $('btn-settings'),
  btnNavBack:        $('btn-nav-back'),
  listContainer:     $('list-container'),
  listTitle:         $('list-title'),
  listScroll:        $('list-scroll'),
  catFilterWrap:     $('cat-filter-wrap'),
  catChips:          $('cat-chips'),
  settingsContainer: $('settings-container'),
  searchInput:       $('search-input'),
  searchClear:       $('search-clear'),
  fontMinus:         $('font-minus'),
  fontPlus:          $('font-plus'),
  btnDonate:         $('btn-donate'),
  toast:             $('toast'),
  donateModal:       $('donate-modal'),
  btnBmc:            $('btn-bmc'),
  btnRevolut:        $('btn-revolut'),
  btnPaypal:         $('btn-paypal'),
  btnDonateCancel:   $('btn-donate-cancel'),
  contactModal:      $('contact-modal'),
  contactInput:      $('contact-input'),
  contactCounter:    $('contact-counter'),
  btnContactSend:    $('btn-contact-send'),
  btnContactCancel:  $('btn-contact-cancel'),
  iosHint:           $('ios-hint'),
  iosHintClose:      $('ios-hint-close'),
};

// ── Persistence ───────────────────────────────────────────────────────────
const LS = {
  get: key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};

function loadPrefs() {
  state.shownIds    = new Set(LS.get('shownIds') || []);
  state.favoriteIds = new Set(LS.get('favoriteIds') || []);
  state.fontSize    = LS.get('fontSize') || 20;
  state.selectedSound = LS.get('selectedSound') || 'sparkle';
  return LS.get('lastJokeId');
}
function saveShown()     { LS.set('shownIds', [...state.shownIds]); }
function saveFavorites() { LS.set('favoriteIds', [...state.favoriteIds]); }
function saveLastJoke()  { if (state.currentJoke) LS.set('lastJokeId', state.currentJoke.id); }
function saveFontSize()  { LS.set('fontSize', state.fontSize); }
function saveSound()     { LS.set('selectedSound', state.selectedSound); }

// ── Search / Stem ─────────────────────────────────────────────────────────
function normalizeLv(s) {
  if (!s) return '';
  return s.toLowerCase()
    .replace(/ā/g,'a').replace(/č/g,'c').replace(/ē/g,'e')
    .replace(/ģ/g,'g').replace(/ī/g,'i').replace(/ķ/g,'k')
    .replace(/ļ/g,'l').replace(/ņ/g,'n').replace(/š/g,'s')
    .replace(/ū/g,'u').replace(/ž/g,'z')
    .replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}
const SUFFIXES = ['ajiem','ajam','ajai','ajās','ajus','ajām','iem','ajos','ajā',
  'ām','am','em','im','us','as','es','os','is','ai','ei','ie','u','a','i','e','s'];
function stem(word) {
  const w = normalizeLv(word);
  for (const s of SUFFIXES) {
    if (w.length > s.length + 2 && w.endsWith(s)) return w.slice(0, w.length - s.length);
  }
  return w;
}
function matchesQuery(jokeText, query) {
  if (!query.trim()) return true;
  const qs = normalizeLv(query).split(' ').map(w => stem(w)).filter(w => w.length >= 2);
  if (!qs.length) return true;
  const norm = normalizeLv(jokeText);
  return qs.every(s => norm.includes(s));
}

// ── Audio ─────────────────────────────────────────────────────────────────
const SOUNDS = {
  'sparkle':    'sound_1_sparkle.mp3',
  'click':      'sound_2_click.mp3',
  'rimshot':    'sound_2_rimshot.mp3',
  'typewriter': 'sound_2_typewriter.mp3',
  'boing':      'sound_3_boing.mp3',
  'chime':      'sound_3_chime.mp3',
  'laser':      'sound_3_laser.mp3',
  'rise':       'sound_3_rise.mp3',
  'ding':       'sound_4_ding.mp3',
  'drum':       'sound_4_drum.mp3',
  'pop':        'sound_4_pop.mp3',
  'whoosh':     'sound_5_whoosh.mp3',
  'nav':        'joke_reveal.mp3',
  'off':        null,
};
function playSound(key) {
  const src = SOUNDS[key !== undefined ? key : state.selectedSound];
  if (!src) return;
  try { const a = new Audio(src); a.volume = 0.7; a.play().catch(() => {}); } catch {}
}

// ── Haptic ────────────────────────────────────────────────────────────────
function haptic() { try { navigator.vibrate?.(12); } catch {} }

// ── Toast ─────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2200);
}

// ── Open external link (iOS Safari safe) ──────────────────────────────────
function openLink(url) {
  const a = document.createElement('a');
  a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// ── Filter (search + category) ────────────────────────────────────────────
function applyFilter(query, cat) {
  if (query !== undefined) state.searchQuery = query;
  if (cat !== undefined)   state.selectedCat = cat;

  state.filteredJokes = state.allJokes.filter(j => {
    const catOk = !state.selectedCat || j.cat === state.selectedCat;
    const txtOk = matchesQuery(j.text, state.searchQuery);
    return catOk && txtOk;
  });

  el.searchClear.classList.toggle('visible', state.searchQuery.length > 0);
  el.btnResetSearch.classList.toggle('visible', state.searchQuery.length > 0 || state.selectedCat !== '');

  if (!state.filteredJokes.length) {
    el.jokeNumber.textContent = '';
    el.jokeText.textContent = 'Pēc šī vaicājuma nekas neuzpeldēja. Pamēģini citu vārdu vai kategoriju.';
  } else if (!state.filteredJokes.find(j => j.id === state.currentJoke?.id)) {
    state.currentJoke = state.filteredJokes[0];
    renderJoke(state.currentJoke, false);
    saveLastJoke();
  }

  if (state.mode === 'RESULTS' || state.mode === 'FAVORITES') refreshList();
  updateStatus();
}

// ── Render ────────────────────────────────────────────────────────────────
function renderJoke(joke, animate) {
  if (!joke) return;
  el.jokeNumber.textContent = `Joks #${joke.id}  ·  ${joke.cat || ''}`;
  el.jokeText.textContent = joke.text;
  el.jokeText.style.fontSize = state.fontSize + 'px';
  renderFavState();
  renderPrevBtn();
  if (animate) {
    el.jokeCard.classList.remove('animate-in');
    void el.jokeCard.offsetWidth;
    el.jokeCard.classList.add('animate-in');
  }
}

function renderFavState() {
  if (state.currentJoke && state.favoriteIds.has(state.currentJoke.id)) {
    el.btnFavorite.textContent = '★ Saglabāts';
  } else {
    el.btnFavorite.textContent = '☆ Saglabāt';
  }
}

function renderPrevBtn() {
  // Poga ir aktīva ja vēsturē ir iepriekšēji joki
  const hasPrev = state.history.length > 0 && state.historyPos > 0;
  el.btnPrev.disabled = !hasPrev;
  el.btnPrev.style.opacity = hasPrev ? '1' : '0.35';
}

function updateStatus() {
  const shown = state.shownIds.size;
  const total = state.allJokes.length;
  const found = state.filteredJokes.length;
  const favs  = state.favoriteIds.size;
  let text = `Redzēti: ${shown}/${total} • Atrasti: ${found} • Favorīti: ${favs}`;
  if (state.selectedCat) text = `[${state.selectedCat}] • ` + text;
  el.statusText.textContent = text;
}

// ── Mode switching ────────────────────────────────────────────────────────
function switchMode(mode) {
  state.mode = mode;
  const isMain     = mode === 'MAIN';
  const isList     = mode === 'RESULTS' || mode === 'FAVORITES';
  const isSettings = mode === 'SETTINGS';

  el.jokeCard.style.display        = isMain ? 'flex' : 'none';
  $('primary-bar').style.display   = isMain ? 'flex' : 'none';
  el.listContainer.classList.toggle('visible', isList);
  el.settingsContainer.classList.toggle('visible', isSettings);
  el.btnNavBack.classList.toggle('visible', !isMain);

  // Kategoriju filtrs redzams tikai saraksta skatā
  el.catFilterWrap.style.display = isList ? 'block' : 'none';

  if (isList) { buildCatChips(); refreshList(); }
  updateStatus();
}

// ── Category chips ────────────────────────────────────────────────────────
function buildCatChips() {
  el.catChips.innerHTML = '';

  // "Visas" chips
  const all = document.createElement('button');
  all.className = 'cat-chip' + (!state.selectedCat ? ' selected' : '');
  all.textContent = 'Visas';
  all.dataset.cat = '';
  all.addEventListener('click', () => selectCat(''));
  el.catChips.appendChild(all);

  // Kategorijas ar jokiem (tikai tās, kurās ir joki pašreizējā skatā)
  const available = new Set(
    (state.mode === 'FAVORITES'
      ? state.allJokes.filter(j => state.favoriteIds.has(j.id))
      : state.allJokes
    ).map(j => j.cat)
  );

  CATEGORIES.forEach(cat => {
    if (!available.has(cat)) return;
    const btn = document.createElement('button');
    btn.className = 'cat-chip' + (state.selectedCat === cat ? ' selected' : '');
    btn.textContent = cat;
    btn.dataset.cat = cat;
    btn.addEventListener('click', () => selectCat(cat));
    el.catChips.appendChild(btn);
  });
}

function selectCat(cat) {
  applyFilter(undefined, cat);
  // Atjaunojam chip stāvokļus
  el.catChips.querySelectorAll('.cat-chip').forEach(c => {
    c.classList.toggle('selected', c.dataset.cat === cat);
  });
  haptic();
}

// ── List ──────────────────────────────────────────────────────────────────
function refreshList() {
  let items = [];
  if (state.mode === 'RESULTS') {
    items = state.filteredJokes;
    el.listTitle.textContent = state.selectedCat ? state.selectedCat : 'Visi joki';
  } else {
    let favs = state.allJokes.filter(j => state.favoriteIds.has(j.id));
    if (state.selectedCat) favs = favs.filter(j => j.cat === state.selectedCat);
    if (state.searchQuery.trim()) favs = favs.filter(j => matchesQuery(j.text, state.searchQuery));
    items = favs;
    el.listTitle.textContent = 'Saglabātie joki';
  }

  el.listScroll.innerHTML = '';

  if (!items.length) {
    const empty = document.createElement('div');
    empty.id = 'list-empty';
    empty.innerHTML = state.mode === 'FAVORITES'
      ? '<span class="empty-icon">⭐</span>Favorītu vēl nav vai neviena šajā kategorijā.'
      : '<span class="empty-icon">🎤</span>Šajā kategorijā nekas neuzpeldēja.';
    el.listScroll.appendChild(empty);
    return;
  }

  const frag = document.createDocumentFragment();
  items.forEach(joke => {
    const div = document.createElement('div');
    div.className = 'joke-item' + (state.favoriteIds.has(joke.id) ? ' fav' : '');
    div.innerHTML = `<div class="joke-item-num">Joks #${joke.id} · <span class="joke-item-cat">${escHtml(joke.cat||'')}</span></div><div class="joke-item-text">${escHtml(joke.text)}</div>`;
    div.addEventListener('click', () => {
      state.currentJoke = joke;
      renderJoke(joke, true);
      saveLastJoke();
      switchMode('MAIN');
      playSound('nav');
      haptic();
    });
    frag.appendChild(div);
  });
  el.listScroll.appendChild(frag);
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Random (ar vēsturi) ───────────────────────────────────────────────────
function showRandom() {
  const pool = state.filteredJokes.filter(j => !state.shownIds.has(j.id));
  if (!pool.length) {
    el.jokeText.textContent = 'Tu jau esi izsmēlis visu krājumu. Nospied "Notīrīt" un dari to sev atkal.';
    el.jokeNumber.textContent = '';
    el.jokeCard.classList.remove('animate-in');
    void el.jokeCard.offsetWidth;
    el.jokeCard.classList.add('animate-in');
    return;
  }
  const next = pool[Math.floor(Math.random() * pool.length)];
  state.shownIds.add(next.id);
  saveShown();
  state.currentJoke = next;

  // Pievieno vēsturei (nogriež uz priekšu ja bija atgriezušies)
  state.history = state.history.slice(0, state.historyPos + 1);
  state.history.push(next.id);
  if (state.history.length > 200) state.history.shift();
  state.historyPos = state.history.length - 1;

  renderJoke(next, true);
  saveLastJoke();
  switchMode('MAIN');
  playSound();
  haptic();
  updateStatus();
}

// ── Atpakaļ (vēsturē) ─────────────────────────────────────────────────────
function showPrev() {
  if (state.historyPos <= 0) return;
  state.historyPos--;
  const id = state.history[state.historyPos];
  const joke = state.allJokes.find(j => j.id === id);
  if (!joke) return;
  state.currentJoke = joke;
  renderJoke(joke, true);
  saveLastJoke();
  playSound('nav');
  haptic();
  updateStatus();
}

// ── Favorite ──────────────────────────────────────────────────────────────
function toggleFavorite() {
  if (!state.currentJoke) return;
  const id = state.currentJoke.id;
  if (state.favoriteIds.has(id)) {
    state.favoriteIds.delete(id); showToast('Izņemts no favorītiem');
  } else {
    state.favoriteIds.add(id); showToast('Pievienots favorītiem ★');
  }
  saveFavorites(); haptic(); renderFavState(); updateStatus();
  if (state.mode === 'FAVORITES') refreshList();
}

// ── Modal ─────────────────────────────────────────────────────────────────
function openModal(id)  { $(id).classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeModal(id) { $(id).classList.remove('open'); document.body.style.overflow = ''; }

// ── Telegram ──────────────────────────────────────────────────────────────
const BOT_TOKEN = '8779790699:AAFnA4UYn17yCiuKHvV2n0RWvHdxlk97f-U';
const CHAT_ID   = '7575867937';
async function sendTelegram(text) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text }),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
}

// ── Sound chips ───────────────────────────────────────────────────────────
const SOUND_LABELS = [
  { key: 'sparkle',    label: '✨ Sparkle' },
  { key: 'click',      label: '🖱 Click' },
  { key: 'rimshot',    label: '🥁 Rimshot' },
  { key: 'typewriter', label: '⌨️ Typewriter' },
  { key: 'boing',      label: '🎈 Boing' },
  { key: 'chime',      label: '🔔 Chime' },
  { key: 'laser',      label: '🔫 Laser' },
  { key: 'rise',       label: '📈 Rise' },
  { key: 'ding',       label: '🔔 Ding' },
  { key: 'drum',       label: '🥁 Drum' },
  { key: 'pop',        label: '🎆 Pop' },
  { key: 'whoosh',     label: '💨 Whoosh' },
  { key: 'off',        label: '🔇 Izslēgt' },
];

function buildSoundChips() {
  const wrap = $('sound-chips');
  wrap.innerHTML = '';
  SOUND_LABELS.forEach(({ key, label }) => {
    const btn = document.createElement('button');
    btn.className = 'sound-chip' + (state.selectedSound === key ? ' selected' : '');
    btn.textContent = label;
    btn.dataset.sound = key;
    btn.addEventListener('click', () => {
      state.selectedSound = key; saveSound();
      wrap.querySelectorAll('.sound-chip').forEach(c => c.classList.toggle('selected', c.dataset.sound === key));
      playSound(key); haptic();
    });
    wrap.appendChild(btn);
  });
}

// ── iOS hint ──────────────────────────────────────────────────────────────
function maybeShowIosHint() {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIos && !window.navigator.standalone && !LS.get('iosHintDismissed')) {
    setTimeout(() => el.iosHint.classList.add('show'), 3000);
  }
}

// ── Init ──────────────────────────────────────────────────────────────────
function init() {
  state.allJokes = JOKES_DATA;
  const lastId = loadPrefs();
  state.filteredJokes = [...state.allJokes];
  el.jokeText.style.fontSize = state.fontSize + 'px';

  // Atjauno pēdējo joku
  let restored = false;
  if (lastId != null) {
    const found = state.allJokes.find(j => j.id === lastId);
    if (found) {
      state.currentJoke = found;
      state.history = [found.id];
      state.historyPos = 0;
      renderJoke(found, false);
      restored = true;
    }
  }
  if (!restored && state.allJokes.length) {
    state.currentJoke = state.allJokes[0];
    state.history = [state.allJokes[0].id];
    state.historyPos = 0;
    renderJoke(state.currentJoke, false);
    saveLastJoke();
  }

  buildSoundChips();
  switchMode('MAIN');
  updateStatus();

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  maybeShowIosHint();

  // ── Events ──────────────────────────────────────────────────────────────

  el.btnRandom.addEventListener('click', showRandom);
  el.btnPrev.addEventListener('click', showPrev);
  el.btnFavorite.addEventListener('click', toggleFavorite);
  el.btnStar.addEventListener('click', () => { switchMode('FAVORITES'); playSound('nav'); });

  el.btnResults.addEventListener('click', () => { switchMode('RESULTS'); playSound('nav'); });
  el.btnResetShown.addEventListener('click', () => {
    state.shownIds.clear(); saveShown(); haptic(); updateStatus();
    showToast('Redzēto saraksts notīrīts');
  });
  el.btnSettings.addEventListener('click', () => { switchMode('SETTINGS'); playSound('nav'); });
  el.btnNavBack.addEventListener('click', () => { switchMode('MAIN'); playSound('nav'); });

  el.btnBack.addEventListener('click', () => { switchMode('MAIN'); playSound('nav'); });
  el.btnResetSearch.addEventListener('click', () => {
    el.searchInput.value = ''; applyFilter('', ''); switchMode('MAIN');
  });
  el.searchClear.addEventListener('click', () => { el.searchInput.value = ''; applyFilter(''); });
  el.searchInput.addEventListener('input', e => applyFilter(e.target.value));

  el.fontMinus.addEventListener('click', () => {
    state.fontSize = Math.max(14, state.fontSize - 2);
    el.jokeText.style.fontSize = state.fontSize + 'px'; saveFontSize(); haptic();
  });
  el.fontPlus.addEventListener('click', () => {
    state.fontSize = Math.min(32, state.fontSize + 2);
    el.jokeText.style.fontSize = state.fontSize + 'px'; saveFontSize(); haptic();
  });

  el.btnDonate.addEventListener('click', () => openModal('donate-modal'));
  el.btnDonateCancel.addEventListener('click', () => closeModal('donate-modal'));
  el.donateModal.addEventListener('click', e => { if (e.target === el.donateModal) closeModal('donate-modal'); });
  el.btnBmc.addEventListener('click', () => { closeModal('donate-modal'); openLink('https://buymeacoffee.com/ingmarsv'); });
  el.btnRevolut.addEventListener('click', () => { closeModal('donate-modal'); openLink('https://revolut.me/ingmars2v72'); });
  el.btnPaypal.addEventListener('click', () => { closeModal('donate-modal'); openLink('https://paypal.me/IngmarsVigners'); });

  $('btn-contact').addEventListener('click', () => {
    el.contactInput.value = ''; el.contactCounter.textContent = '0 / 500';
    openModal('contact-modal');
    setTimeout(() => el.contactInput.focus(), 300);
  });
  el.btnContactCancel.addEventListener('click', () => closeModal('contact-modal'));
  el.contactModal.addEventListener('click', e => { if (e.target === el.contactModal) closeModal('contact-modal'); });
  el.contactInput.addEventListener('input', () => {
    const len = el.contactInput.value.length;
    el.contactCounter.textContent = `${len} / 500`;
    el.contactCounter.style.color = len >= 480 ? '#e53935' : '#888';
    if (len > 500) el.contactInput.value = el.contactInput.value.slice(0, 500);
  });
  el.btnContactSend.addEventListener('click', async () => {
    const msg = el.contactInput.value.trim();
    if (!msg) { showToast('Ziņa ir tukša!'); return; }
    el.btnContactSend.textContent = 'Sūta...';
    el.btnContactSend.disabled = true;
    try {
      await sendTelegram(`[Sliktie joki PWA]\n${msg}`);
      closeModal('contact-modal'); showToast('Ziņa nosūtīta! ✓');
    } catch {
      showToast('Kļūda! Mēģini vēlreiz.');
    } finally {
      el.btnContactSend.textContent = 'Nosūtīt ziņu';
      el.btnContactSend.disabled = false;
    }
  });

  $('btn-clear-favorites').addEventListener('click', () => {
    state.favoriteIds.clear(); saveFavorites(); haptic(); updateStatus(); showToast('Favorīti notīrīti');
  });
  $('btn-clear-shown').addEventListener('click', () => {
    state.shownIds.clear(); saveShown(); haptic(); updateStatus(); showToast('Redzēto saraksts notīrīts');
  });
  $('btn-clear-all').addEventListener('click', () => {
    state.shownIds.clear(); state.favoriteIds.clear();
    saveShown(); saveFavorites();
    state.history = []; state.historyPos = -1;
    state.currentJoke = state.allJokes[0];
    renderJoke(state.currentJoke, false); saveLastJoke();
    haptic(); switchMode('MAIN'); updateStatus(); showToast('Viss notīrīts');
  });

  el.iosHintClose.addEventListener('click', () => {
    el.iosHint.classList.remove('show'); LS.set('iosHintDismissed', true);
  });
}

document.addEventListener('DOMContentLoaded', init);
