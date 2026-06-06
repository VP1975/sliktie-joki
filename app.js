'use strict';

// ── Kategoriju saraksts (identisks Android v2.3) ─────────────────────────
const CATEGORIES = [
  "Absurdie joki","Attiecības","Bērni","Blondīnes","Citāti","Daba","Dakteri",
  "Geji","Kas kopīgs?","Laikmetīgie...","Matemātika","Nacisms",
  "Nederīgās lietas","Nekrofīli","Nezināmais Čaks","Nezināmie fakti",
  "Pedofīli","Politika","Priesteri","Rasisms","Ratiņkrēsli","Runā ka...",
  "Sekss","Senlatviešu dievības","Sievietes","Tautas gudrības",
  "Vārdu spēles","Vecums","Veģetārieši"
];

// ── Skaņas (5 skaņas identiskas Android v2.3: emoji chip + toggle) ────────
// Android: soundIndex 1=sparkle,2=rimshot,3=chime,4=drum,5=whoosh
const SOUND_FILES = [
  'sounds/sound_1_sparkle.mp3',
  'sounds/sound_2_rimshot.mp3',
  'sounds/sound_3_chime.mp3',
  'sounds/sound_4_drum.mp3',
  'sounds/sound_5_whoosh.mp3',
];
const SOUND_LABELS = ['✨', '🥁', '🔔', '🎵', '💨'];
const SOUND_NAV = 'sounds/joke_reveal.mp3';

// ── State ─────────────────────────────────────────────────────────────────
const state = {
  allJokes:     [],
  filteredJokes:[],
  shownIds:     new Set(),
  favoriteIds:  new Set(),
  currentJoke:  null,
  history:      [],   // id masīvs
  historyPos:   -1,   // pozīcija vēsturē
  mode:         'MAIN',
  fontSize:     22,   // Android noklusējums 22sp
  soundEnabled: true,
  soundIndex:   0,    // 0-4 (atbilst SOUND_FILES indeksam)
  searchQuery:  '',
  selectedCat:  '',
};

// ── DOM refs ──────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const el = {
  headerBrand:         $('header-brand'),
  btnDonate:           $('btn-donate'),
  fontMinus:           $('font-minus'),
  fontPlus:            $('font-plus'),
  searchInput:         $('search-input'),
  searchClear:         $('search-clear'),
  statusText:          $('status-text'),
  jokeCard:            $('joke-card'),
  jokeNumber:          $('joke-number'),
  jokeScroll:          $('joke-scroll'),
  jokeText:            $('joke-text'),
  btnFavorite:         $('btn-favorite'),
  btnShare:            $('btn-share'),
  btnResetSearch:      $('btn-reset-search'),
  primaryBar:          $('primary-bar'),
  btnPrev:             $('btn-prev'),
  btnRandom:           $('btn-random'),
  btnStar:             $('btn-star'),
  navBar:              $('nav-bar'),
  btnResults:          $('btn-results'),
  btnNavFavorites:     $('btn-nav-favorites'),
  btnResetShown:       $('btn-reset-shown'),
  btnSettings:         $('btn-settings'),
  btnBack:             $('btn-back'),
  listContainer:       $('list-container'),
  listTitle:           $('list-title'),
  catFilterWrap:       $('cat-filter-wrap'),
  catSelect:           $('cat-select'),
  btnClearFavsInline:  $('btn-clear-favs-inline'),
  listEmpty:           $('list-empty'),
  listScroll:          $('list-scroll'),
  settingsContainer:   $('settings-container'),
  fontSizeLabel:       $('font-size-label'),
  fontMinusSettings:   $('font-minus-settings'),
  fontPlusSettings:    $('font-plus-settings'),
  btnSoundToggle:      $('btn-sound-toggle'),
  soundChips:          $('sound-chips'),
  btnClearFavorites:   $('btn-clear-favorites'),
  btnClearShown:       $('btn-clear-shown'),
  btnClearAll:         $('btn-clear-all'),
  btnContact:          $('btn-contact'),
  donateModal:         $('donate-modal'),
  btnBmc:              $('btn-bmc'),
  btnRevolut:          $('btn-revolut'),
  btnPaypal:           $('btn-paypal'),
  btnDonateCancel:     $('btn-donate-cancel'),
  contactModal:        $('contact-modal'),
  contactInput:        $('contact-input'),
  contactCounter:      $('contact-counter'),
  btnContactSend:      $('btn-contact-send'),
  btnContactCancel:    $('btn-contact-cancel'),
  iosHint:             $('ios-hint'),
  iosHintClose:        $('ios-hint-close'),
  toast:               $('toast'),
};

// ── Persistence ───────────────────────────────────────────────────────────
const LS = {
  get: key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};

function loadPrefs() {
  state.shownIds    = new Set(LS.get('shownIds')    || []);
  state.favoriteIds = new Set(LS.get('favoriteIds') || []);
  state.fontSize    = LS.get('font_size_sp') ?? 22;
  state.soundEnabled= LS.get('sound_enabled') !== false; // default true
  state.soundIndex  = (LS.get('sound_index') ?? 1) - 1; // Android saves 1-based
  if (state.soundIndex < 0 || state.soundIndex > 4) state.soundIndex = 0;
  return LS.get('lastJokeId');
}
function saveShown()      { LS.set('shownIds', [...state.shownIds]); }
function saveFavorites()  { LS.set('favoriteIds', [...state.favoriteIds]); }
function saveLastJoke()   { if (state.currentJoke) LS.set('lastJokeId', state.currentJoke.id); }
function saveFontSize()   { LS.set('font_size_sp', state.fontSize); }
function saveSoundEnabled(){ LS.set('sound_enabled', state.soundEnabled); }
function saveSoundIndex() { LS.set('sound_index', state.soundIndex + 1); } // Android saves 1-based

// ── Latvian search (identisks Android TextSearchUtils) ────────────────────
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
  if (!query) return true;
  // Atbalsta | (VAI) kā Android
  const parts = query.split('|').map(p => p.trim()).filter(Boolean);
  if (!parts.length) return true;
  return parts.some(part => {
    const qs = normalizeLv(part).split(' ').map(w => stem(w)).filter(w => w.length >= 2);
    if (!qs.length) return true;
    const norm = normalizeLv(jokeText);
    return qs.every(s => norm.includes(s));
  });
}

// ── Audio ──────────────────────────────────────────────────────────────────
function playSound(overrideFile) {
  if (!state.soundEnabled && !overrideFile) return;
  const src = overrideFile || SOUND_FILES[state.soundIndex];
  if (!src) return;
  try {
    const a = new Audio(src);
    a.volume = 0.7;
    a.play().catch(() => {});
  } catch {}
}
function playSoundNav() { playSound(SOUND_NAV); }

// ── Haptic ────────────────────────────────────────────────────────────────
function haptic(duration) { try { navigator.vibrate?.(duration || 12); } catch {} }

// ── Toast ──────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2200);
}

// ── External link ─────────────────────────────────────────────────────────
function openLink(url) {
  const a = document.createElement('a');
  a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// ── HTML escape ───────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Filter ────────────────────────────────────────────────────────────────
function applyFilter(query, cat) {
  if (query !== undefined) state.searchQuery = query;
  if (cat   !== undefined) state.selectedCat = cat;

  state.filteredJokes = state.allJokes.filter(j => {
    const catOk = !state.selectedCat || j.cat === state.selectedCat;
    const txtOk = matchesQuery(j.text, state.searchQuery);
    return catOk && txtOk;
  });

  el.searchClear.classList.toggle('visible', state.searchQuery.length > 0);
  el.btnResetSearch.classList.toggle(
    'visible',
    state.searchQuery.length > 0 || state.selectedCat !== ''
  );

  if (!state.filteredJokes.length) {
    el.jokeNumber.textContent = '';
    el.jokeText.textContent = 'Pēc šī vaicājuma nekas neuzpeldēja. Pamēģini īsāku sakni vai | starp vārdiem.';
  } else if (!state.filteredJokes.find(j => j.id === state.currentJoke?.id)) {
    state.currentJoke = state.filteredJokes[0];
    renderJoke(state.currentJoke, false);
    saveLastJoke();
  }

  if (state.mode === 'RESULTS' || state.mode === 'FAVORITES') refreshList();
  updateStatus();
}

// ── Render joke ───────────────────────────────────────────────────────────
function renderJoke(joke, animate) {
  if (!joke) return;
  // "Joks #ID · kategorija" — identisks Android txt_joke_number_cat
  const numText = joke.cat
    ? `Joks #${joke.id} · ${joke.cat}`
    : `Joks #${joke.id}`;
  el.jokeNumber.textContent = numText;
  el.jokeText.textContent = joke.text;
  el.jokeText.style.fontSize = state.fontSize + 'px';
  renderFavState();
  renderPrevBtn();
  if (animate) {
    el.jokeCard.classList.remove('animate-in');
    void el.jokeCard.offsetWidth;
    el.jokeCard.classList.add('animate-in');
  }
  // Scroll karte uz sākumu
  el.jokeScroll.scrollTop = 0;
}

function renderFavState() {
  if (state.currentJoke && state.favoriteIds.has(state.currentJoke.id)) {
    el.btnFavorite.textContent = '★ Saglabāts';
  } else {
    el.btnFavorite.textContent = '☆ Saglabāt';
  }
}

function renderPrevBtn() {
  const hasPrev = state.history.length > 0 && state.historyPos > 0;
  el.btnPrev.disabled = !hasPrev;
  el.btnPrev.style.opacity = hasPrev ? '1' : '0.35';
}

function updateStatus() {
  const shown = state.shownIds.size;
  const total = state.allJokes.length;
  el.statusText.textContent = `Redzēti: ${shown} / ${total}`;
}

// ── Sound chips (5 emoji identisks Android) ───────────────────────────────
function buildSoundChips() {
  el.soundChips.innerHTML = '';
  SOUND_LABELS.forEach((label, idx) => {
    const btn = document.createElement('button');
    btn.className = 'sound-chip' + (state.soundIndex === idx ? ' selected' : '');
    btn.textContent = label;
    btn.setAttribute('aria-label', label);
    btn.addEventListener('click', () => {
      state.soundIndex = idx;
      saveSoundIndex();
      el.soundChips.querySelectorAll('.sound-chip')
        .forEach((c, i) => c.classList.toggle('selected', i === idx));
      if (state.soundEnabled) playSound(SOUND_FILES[idx]);
      haptic();
    });
    el.soundChips.appendChild(btn);
  });
}

function renderSoundToggle() {
  el.btnSoundToggle.textContent = state.soundEnabled
    ? '🔊 Skaņa: ieslēgta'
    : '🔇 Skaņa: izslēgta';
}

function renderFontLabel() {
  el.fontSizeLabel.textContent = `Fonta izmērs: ${state.fontSize} sp`;
}

// ── Mode switching ────────────────────────────────────────────────────────
function switchMode(mode) {
  state.mode = mode;
  const isMain     = mode === 'MAIN';
  const isResults  = mode === 'RESULTS';
  const isFavorites= mode === 'FAVORITES';
  const isList     = isResults || isFavorites;
  const isSettings = mode === 'SETTINGS';

  // Joke card + primary bar
  el.jokeCard.style.display        = isMain ? 'flex' : 'none';
  el.primaryBar.style.display      = isMain ? 'flex' : 'none';

  // List container
  el.listContainer.classList.toggle('visible', isList);

  // Settings
  el.settingsContainer.classList.toggle('visible', isSettings);

  // Back button (redzams sarakstā un iestatījumos)
  el.btnBack.classList.toggle('visible', !isMain);

  // Kategoriju dropdown — tikai RESULTS skatā, zem list title
  el.catFilterWrap.classList.toggle('visible', isResults);

  // "Notīrīt favorītus" inline — tikai FAVORITES skatā
  el.btnClearFavsInline.classList.toggle('visible', isFavorites);

  // Nav pogu aktīvie stāvokļi
  el.btnResults.classList.toggle('active', isResults);
  el.btnNavFavorites.classList.toggle('active', isFavorites);
  el.btnSettings.classList.toggle('active', isSettings);
  el.btnStar.classList.toggle('active', isFavorites);

  if (isList) {
    buildCatSelect();
    refreshList();
  }
  if (isSettings) {
    buildSoundChips();
    renderSoundToggle();
    renderFontLabel();
  }
  updateStatus();
}

// ── Category select ───────────────────────────────────────────────────────
function buildCatSelect() {
  const sel = el.catSelect;
  sel.innerHTML = '';

  const allOpt = document.createElement('option');
  allOpt.value = '';
  allOpt.textContent = 'Visas kategorijas';
  sel.appendChild(allOpt);

  const sourceJokes = state.mode === 'FAVORITES'
    ? state.allJokes.filter(j => state.favoriteIds.has(j.id))
    : state.allJokes;
  const available = new Set(sourceJokes.map(j => j.cat).filter(Boolean));

  CATEGORIES.forEach(cat => {
    if (!available.has(cat)) return;
    const count = sourceJokes.filter(j => j.cat === cat).length;
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = `${cat} (${count})`;
    sel.appendChild(opt);
  });

  sel.value = state.selectedCat;
}

// ── List refresh ──────────────────────────────────────────────────────────
function refreshList() {
  let items = [];
  if (state.mode === 'RESULTS') {
    items = state.filteredJokes;
    el.listTitle.textContent = state.selectedCat || 'Visi joki';
  } else {
    let favs = state.allJokes.filter(j => state.favoriteIds.has(j.id));
    if (state.selectedCat)      favs = favs.filter(j => j.cat === state.selectedCat);
    if (state.searchQuery.trim()) favs = favs.filter(j => matchesQuery(j.text, state.searchQuery));
    items = favs;
    el.listTitle.textContent = 'Saglabātie joki';
  }

  el.listScroll.innerHTML = '';

  if (!items.length) {
    el.listEmpty.classList.add('visible');
    el.listEmpty.textContent = state.mode === 'FAVORITES'
      ? '☆ Nav saglabātu favorītu. Piespiedi ☆ pie joka, lai to pievienotu šeit.'
      : 'Šajā kategorijā nekas neuzpeldēja.';
    return;
  }
  el.listEmpty.classList.remove('visible');

  const frag = document.createDocumentFragment();
  items.forEach(joke => {
    const div = document.createElement('div');
    div.className = 'joke-item' + (state.favoriteIds.has(joke.id) ? ' fav' : '');
    const catSpan = joke.cat ? ` · <span class="joke-item-cat">${escHtml(joke.cat)}</span>` : '';
    div.innerHTML =
      `<div class="joke-item-num">Joks #${joke.id}${catSpan}</div>` +
      `<div class="joke-item-text">${escHtml(joke.text)}</div>`;
    div.addEventListener('click', () => {
      state.currentJoke = joke;
      renderJoke(joke, true);
      saveLastJoke();
      state.selectedCat = '';
      applyFilter(undefined, '');
      switchMode('MAIN');
      playSoundNav();
      haptic();
    });
    frag.appendChild(div);
  });
  el.listScroll.appendChild(frag);
}

// ── Random (ar vēsturi) ───────────────────────────────────────────────────
function showRandom() {
  const pool = state.filteredJokes.filter(j => !state.shownIds.has(j.id));
  if (!pool.length) {
    el.jokeText.textContent = 'Izsmēlis visu krājumu. Nospied "Atjaunot" un sāc no jauna.';
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
  if (state.mode !== 'MAIN') switchMode('MAIN');
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
  playSoundNav();
  haptic();
  updateStatus();
}

// ── Favorite ──────────────────────────────────────────────────────────────
function toggleFavorite() {
  if (!state.currentJoke) return;
  const id = state.currentJoke.id;
  if (state.favoriteIds.has(id)) {
    state.favoriteIds.delete(id);
    showToast('Izņemts no favorītiem');
  } else {
    state.favoriteIds.add(id);
    showToast('Pievienots favorītiem ★');
  }
  saveFavorites();
  haptic();
  renderFavState();
  updateStatus();
  if (state.mode === 'FAVORITES') refreshList();
}

// ── Share ─────────────────────────────────────────────────────────────────
function shareJoke() {
  if (!state.currentJoke) return;
  const text = `Joks #${state.currentJoke.id}\n${state.currentJoke.text}\n\n— Sliktie joki 30+`;
  if (navigator.share) {
    navigator.share({ title: 'Sliktais joks', text }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(text).then(() => showToast('Nokopēts!'));
  }
  haptic();
}

// ── Font size ─────────────────────────────────────────────────────────────
function changeFontSize(delta) {
  state.fontSize = Math.max(14, Math.min(32, state.fontSize + delta));
  el.jokeText.style.fontSize = state.fontSize + 'px';
  saveFontSize();
  renderFontLabel();
  haptic();
}

// ── Modal ─────────────────────────────────────────────────────────────────
function openModal(id)  {
  $(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  $(id).classList.remove('open');
  document.body.style.overflow = '';
}

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

// ── iOS hint ──────────────────────────────────────────────────────────────
function maybeShowIosHint() {
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/chrome|chromium|crios/i.test(ua);
  if (isIos && isSafari && !window.navigator.standalone && !LS.get('iosHintDismissed')) {
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

  switchMode('MAIN');
  updateStatus();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  maybeShowIosHint();

  // ── Events ──────────────────────────────────────────────────────────────

  // Header brand → MAIN (v2.3 jaunums)
  el.headerBrand.addEventListener('click', () => {
    if (state.mode !== 'MAIN') {
      state.selectedCat = '';
      applyFilter(undefined, '');
      switchMode('MAIN');
      playSoundNav();
      haptic();
    }
  });

  // Fonta pogas headerā
  el.fontMinus.addEventListener('click', () => changeFontSize(-2));
  el.fontPlus.addEventListener('click',  () => changeFontSize(+2));

  // Search
  el.searchInput.addEventListener('input', e => applyFilter(e.target.value));
  el.searchClear.addEventListener('click', () => {
    el.searchInput.value = '';
    applyFilter('');
  });
  el.btnResetSearch.addEventListener('click', () => {
    el.searchInput.value = '';
    state.selectedCat = '';
    applyFilter('', '');
    switchMode('MAIN');
  });

  // Joke card actions
  el.btnFavorite.addEventListener('click', toggleFavorite);
  el.btnShare.addEventListener('click', shareJoke);

  // Primary bar
  el.btnRandom.addEventListener('click', showRandom);
  el.btnPrev.addEventListener('click', showPrev);
  el.btnStar.addEventListener('click', () => {
    state.selectedCat = '';
    switchMode('FAVORITES');
    playSoundNav();
    haptic();
  });

  // Nav bar
  el.btnResults.addEventListener('click', () => {
    state.selectedCat = '';
    applyFilter(undefined, '');
    switchMode('RESULTS');
    playSoundNav();
    haptic();
  });
  el.btnNavFavorites.addEventListener('click', () => {
    state.selectedCat = '';
    switchMode('FAVORITES');
    playSoundNav();
    haptic();
  });
  el.btnResetShown.addEventListener('click', () => {
    state.shownIds.clear();
    saveShown();
    haptic();
    updateStatus();
    showToast('Redzēto saraksts notīrīts');
  });
  el.btnSettings.addEventListener('click', () => {
    switchMode('SETTINGS');
    playSoundNav();
    haptic();
  });

  // Atpakaļ poga
  el.btnBack.addEventListener('click', () => {
    state.selectedCat = '';
    applyFilter(undefined, '');
    switchMode('MAIN');
    playSoundNav();
    haptic();
  });

  // Kategoriju dropdown
  el.catSelect.addEventListener('change', () => {
    applyFilter(undefined, el.catSelect.value);
    haptic();
  });

  // Notīrīt favorītus inline (FAVORĪTI skatā)
  el.btnClearFavsInline.addEventListener('click', () => {
    if (!confirm('Dzēst visus favorītus?')) return;
    state.favoriteIds.clear();
    saveFavorites();
    haptic();
    updateStatus();
    refreshList();
    showToast('Favorīti notīrīti');
  });

  // Settings
  el.fontMinusSettings.addEventListener('click', () => changeFontSize(-2));
  el.fontPlusSettings.addEventListener('click',  () => changeFontSize(+2));

  el.btnSoundToggle.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    saveSoundEnabled();
    renderSoundToggle();
    haptic();
    if (state.soundEnabled) playSound();
  });

  el.btnClearFavorites.addEventListener('click', () => {
    if (!confirm('Dzēst visus favorītus?')) return;
    state.favoriteIds.clear();
    saveFavorites();
    haptic();
    updateStatus();
    showToast('Favorīti notīrīti');
  });
  el.btnClearShown.addEventListener('click', () => {
    if (!confirm('Aizmirst visus redzētos jokus?')) return;
    state.shownIds.clear();
    saveShown();
    haptic();
    updateStatus();
    showToast('Redzēto saraksts notīrīts');
  });
  el.btnClearAll.addEventListener('click', () => {
    if (!confirm('Notīrīt visu saglabāto (redzēti + favorīti)?')) return;
    state.shownIds.clear();
    state.favoriteIds.clear();
    saveShown();
    saveFavorites();
    state.history = [];
    state.historyPos = -1;
    if (state.allJokes.length) {
      state.currentJoke = state.allJokes[0];
      state.history = [state.allJokes[0].id];
      state.historyPos = 0;
      renderJoke(state.currentJoke, false);
      saveLastJoke();
    }
    haptic();
    switchMode('MAIN');
    updateStatus();
    showToast('Viss notīrīts');
  });

  // Kontakts
  el.btnContact.addEventListener('click', () => {
    el.contactInput.value = '';
    el.contactCounter.textContent = '0 / 500';
    openModal('contact-modal');
    setTimeout(() => el.contactInput.focus(), 300);
  });
  el.btnContactCancel.addEventListener('click', () => closeModal('contact-modal'));
  el.contactModal.addEventListener('click', e => {
    if (e.target === el.contactModal) closeModal('contact-modal');
  });
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
      closeModal('contact-modal');
      showToast('Ziņa nosūtīta! ✓');
    } catch {
      showToast('Kļūda! Mēģini vēlreiz.');
    } finally {
      el.btnContactSend.textContent = 'Nosūtīt ziņu';
      el.btnContactSend.disabled = false;
    }
  });

  // Donate
  el.btnDonate.addEventListener('click', () => openModal('donate-modal'));
  el.btnDonateCancel.addEventListener('click', () => closeModal('donate-modal'));
  el.donateModal.addEventListener('click', e => {
    if (e.target === el.donateModal) closeModal('donate-modal');
  });
  el.btnBmc.addEventListener('click', () => {
    closeModal('donate-modal');
    openLink('https://buymeacoffee.com/ingmarsv');
  });
  el.btnRevolut.addEventListener('click', () => {
    closeModal('donate-modal');
    openLink('https://revolut.me/ingmars2v72');
  });
  el.btnPaypal.addEventListener('click', () => {
    closeModal('donate-modal');
    openLink('https://paypal.me/IngmarsVigners');
  });

  // iOS hint
  el.iosHintClose.addEventListener('click', () => {
    el.iosHint.classList.remove('show');
    LS.set('iosHintDismissed', true);
  });
}

document.addEventListener('DOMContentLoaded', init);
