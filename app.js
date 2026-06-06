'use strict';

// ── Kategoriju saraksts ───────────────────────────────────────────────────
var CATEGORIES = [
  "Absurdie joki","Attiecības","Bērni","Blondīnes","Citāti","Daba","Dakteri",
  "Geji","Kas kopīgs?","Laikmetīgie...","Matemātika","Nacisms",
  "Nederīgās lietas","Nekrofīli","Nezināmais Čaks","Nezināmie fakti",
  "Pedofīli","Politika","Priesteri","Rasisms","Ratiņkrēsli","Runā ka...",
  "Sekss","Senlatviešu dievības","Sievietes","Tautas gudrības",
  "Vārdu spēles","Vecums","Veģetārieši"
];

// ── Skaņas — 5 identiskas Android v2.3 ──────────────────────────────────
// Index 0=sparkle, 1=rimshot, 2=chime, 3=drum, 4=whoosh
var SOUND_FILES = [
  'sounds/sound_1_sparkle.mp3',
  'sounds/sound_2_rimshot.mp3',
  'sounds/sound_3_chime.mp3',
  'sounds/sound_4_drum.mp3',
  'sounds/sound_5_whoosh.mp3'
];
var SOUND_LABELS = ['✨', '🥁', '🔔', '🎵', '💨'];
var SOUND_NAV = 'sounds/joke_reveal.mp3';

// ── Skaņu dzinējs: AudioContext + new Audio() fallback ───────────────────
// Stratēģija: mēģina AudioContext (Web Audio API) — darbojas visur.
// Ja AudioContext nav (ļoti vecs pārlūks), izmanto new Audio() fallback.
// Skaņas ielādē pēc PIRMĀ user gesture — tas ir obligāts nosacījums
// visos mobilajos pārlūkos (autoplay policy).
var audioCtx = null;
var soundBuffers = {};
var audioUnlocked = false;
var useAudioCtx = !!(window.AudioContext || window.webkitAudioContext);

function getAudioCtx() {
  if (!audioCtx) {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    } catch (e) { useAudioCtx = false; }
  }
  return audioCtx;
}

function resumeCtx(ctx) {
  if (ctx && ctx.state === 'suspended') {
    try { ctx.resume(); } catch (e) {}
  }
}

function loadBuffer(url, callback) {
  if (soundBuffers[url]) { if (callback) callback(soundBuffers[url]); return; }
  var ctx = getAudioCtx();
  if (!ctx) { if (callback) callback(null); return; }
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.responseType = 'arraybuffer';
  xhr.onload = function() {
    try {
      ctx.decodeAudioData(xhr.response,
        function(buf) { soundBuffers[url] = buf; if (callback) callback(buf); },
        function() { soundBuffers[url] = null; if (callback) callback(null); }
      );
    } catch (e) { if (callback) callback(null); }
  };
  xhr.onerror = function() { if (callback) callback(null); };
  try { xhr.send(); } catch (e) { if (callback) callback(null); }
}

// Preloādē visas skaņas pēc pirmā user gesture
function preloadSounds() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  if (!useAudioCtx) return; // fallback — ielādē lazily
  var ctx = getAudioCtx();
  resumeCtx(ctx);
  var allFiles = SOUND_FILES.concat([SOUND_NAV]);
  for (var i = 0; i < allFiles.length; i++) {
    loadBuffer(allFiles[i]);
  }
}

// Atskaņo ar AudioContext
function playViaCtx(buf, ctx) {
  try {
    resumeCtx(ctx);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var gain = ctx.createGain();
    gain.gain.value = 0.7;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(0);
  } catch (e) {}
}

// Fallback: new Audio() — ielādē svaigi katru reizi (veciem pārlūkiem)
function playViaAudio(url) {
  try {
    var a = new Audio(url);
    a.volume = 0.7;
    // Android 8: load() pirms play() palīdz
    a.load();
    var p = a.play();
    if (p && p['catch']) p['catch'](function() {});
  } catch (e) {}
}

function playSoundFile(url) {
  if (!useAudioCtx) {
    playViaAudio(url);
    return;
  }
  var ctx = getAudioCtx();
  if (!ctx) { playViaAudio(url); return; }
  resumeCtx(ctx);

  var buf = soundBuffers[url];
  if (buf === null) {
    // decodeAudioData neizdevās — fallback
    playViaAudio(url);
    return;
  }
  if (buf) {
    playViaCtx(buf, ctx);
    return;
  }
  // Vēl nav ielādēts — ielādē un atskaņo
  loadBuffer(url, function(b) {
    if (b) { playViaCtx(b, ctx); }
    else   { playViaAudio(url); }
  });
}

function playSound(overrideFile) {
  if (!state.soundEnabled && !overrideFile) return;
  var file = overrideFile || SOUND_FILES[state.soundIndex];
  if (!file) return;
  playSoundFile(file);
}

function playSoundNav() {
  playSoundFile(SOUND_NAV);
}

// ── State ─────────────────────────────────────────────────────────────────
var state = {
  allJokes:      [],
  filteredJokes: [],
  shownIds:      {},   // id->true (Set aizstāts ar objektu saderībai)
  favoriteIds:   {},
  currentJoke:   null,
  history:       [],
  historyPos:    -1,
  mode:          'MAIN',
  fontSize:      22,
  soundEnabled:  true,
  soundIndex:    0,
  searchQuery:   '',
  selectedCat:   ''
};

// ── DOM refs ──────────────────────────────────────────────────────────────
function $$(id) { return document.getElementById(id); }
var el = {};
function initEl() {
  el.headerBrand        = $$('header-brand');
  el.btnDonate          = $$('btn-donate');
  el.fontMinus          = $$('font-minus');
  el.fontPlus           = $$('font-plus');
  el.searchInput        = $$('search-input');
  el.searchClear        = $$('search-clear');
  el.statusText         = $$('status-text');
  el.jokeCard           = $$('joke-card');
  el.jokeNumber         = $$('joke-number');
  el.jokeScroll         = $$('joke-scroll');
  el.jokeText           = $$('joke-text');
  el.btnFavorite        = $$('btn-favorite');
  el.btnShare           = $$('btn-share');
  el.btnResetSearch     = $$('btn-reset-search');
  el.primaryBar         = $$('primary-bar');
  el.btnPrev            = $$('btn-prev');
  el.btnRandom          = $$('btn-random');
  el.btnStar            = $$('btn-star');
  el.btnResults         = $$('btn-results');
  el.btnNavFavorites    = $$('btn-nav-favorites');
  el.btnResetShown      = $$('btn-reset-shown');
  el.btnSettings        = $$('btn-settings');
  el.btnBack            = $$('btn-back');
  el.listContainer      = $$('list-container');
  el.listTitle          = $$('list-title');
  el.catFilterWrap      = $$('cat-filter-wrap');
  el.catSelect          = $$('cat-select');
  el.btnClearFavsInline = $$('btn-clear-favs-inline');
  el.listEmpty          = $$('list-empty');
  el.listScroll         = $$('list-scroll');
  el.settingsContainer  = $$('settings-container');
  el.fontSizeLabel      = $$('font-size-label');
  el.fontMinusSettings  = $$('font-minus-settings');
  el.fontPlusSettings   = $$('font-plus-settings');
  el.btnSoundToggle     = $$('btn-sound-toggle');
  el.soundChips         = $$('sound-chips');
  el.btnClearFavorites  = $$('btn-clear-favorites');
  el.btnClearShown      = $$('btn-clear-shown');
  el.btnClearAll        = $$('btn-clear-all');
  el.btnContact         = $$('btn-contact');
  el.donateModal        = $$('donate-modal');
  el.btnBmc             = $$('btn-bmc');
  el.btnRevolut         = $$('btn-revolut');
  el.btnPaypal          = $$('btn-paypal');
  el.btnDonateCancel    = $$('btn-donate-cancel');
  el.contactModal       = $$('contact-modal');
  el.contactInput       = $$('contact-input');
  el.contactCounter     = $$('contact-counter');
  el.btnContactSend     = $$('btn-contact-send');
  el.btnContactCancel   = $$('btn-contact-cancel');
  el.iosHint            = $$('ios-hint');
  el.iosHintClose       = $$('ios-hint-close');
  el.toast              = $$('toast');
}

// ── Persistence (bez ??, lietots || ) ─────────────────────────────────────
var LS = {
  get: function(key) {
    try { var v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : null; }
    catch (e) { return null; }
  },
  set: function(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
};

// Saglabā shownIds kā masīvu
function shownToArray() {
  var arr = [];
  for (var id in state.shownIds) { if (state.shownIds.hasOwnProperty(id)) arr.push(Number(id)); }
  return arr;
}
function favToArray() {
  var arr = [];
  for (var id in state.favoriteIds) { if (state.favoriteIds.hasOwnProperty(id)) arr.push(Number(id)); }
  return arr;
}

function loadPrefs() {
  var shown = LS.get('shownIds') || [];
  state.shownIds = {};
  for (var i = 0; i < shown.length; i++) state.shownIds[shown[i]] = true;

  var favs = LS.get('favoriteIds') || [];
  state.favoriteIds = {};
  for (var j = 0; j < favs.length; j++) state.favoriteIds[favs[j]] = true;

  var fs = LS.get('font_size_sp');
  state.fontSize = (fs !== null && fs !== undefined) ? fs : 22;

  var se = LS.get('sound_enabled');
  state.soundEnabled = (se === false) ? false : true;

  var si = LS.get('sound_index');
  state.soundIndex = (si !== null && si !== undefined) ? (si - 1) : 0;
  if (state.soundIndex < 0 || state.soundIndex > 4) state.soundIndex = 0;

  return LS.get('lastJokeId');
}

function saveShown()       { LS.set('shownIds', shownToArray()); }
function saveFavorites()   { LS.set('favoriteIds', favToArray()); }
function saveLastJoke()    { if (state.currentJoke) LS.set('lastJokeId', state.currentJoke.id); }
function saveFontSize()    { LS.set('font_size_sp', state.fontSize); }
function saveSoundEnabled(){ LS.set('sound_enabled', state.soundEnabled); }
function saveSoundIndex()  { LS.set('sound_index', state.soundIndex + 1); }

// ── Haptic (bez ?., saderīgs ar visiem) ──────────────────────────────────
function haptic(duration) {
  try {
    if (navigator.vibrate) navigator.vibrate(duration || 12);
  } catch (e) {}
}

// ── Toast ─────────────────────────────────────────────────────────────────
var toastTimer = null;
function showToast(msg) {
  el.toast.textContent = msg;
  el.toast.className = 'show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { el.toast.className = ''; }, 2200);
}

// ── External link ─────────────────────────────────────────────────────────
function openLink(url) {
  // Android 8: window.open() ir uzticamāks nekā a.click() ārpus tiešā click
  try {
    var w = window.open(url, '_blank');
    if (!w || w.closed || typeof w.closed === 'undefined') {
      // Popup bloķēts — atveram pašā logā
      window.location.href = url;
    }
  } catch (e) {
    try { window.location.href = url; } catch (e2) {}
  }
}

// ── HTML escape ───────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Latvian search ────────────────────────────────────────────────────────
function normalizeLv(s) {
  if (!s) return '';
  return s.toLowerCase()
    .replace(/ā/g,'a').replace(/č/g,'c').replace(/ē/g,'e')
    .replace(/ģ/g,'g').replace(/ī/g,'i').replace(/ķ/g,'k')
    .replace(/ļ/g,'l').replace(/ņ/g,'n').replace(/š/g,'s')
    .replace(/ū/g,'u').replace(/ž/g,'z')
    .replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}

var SUFFIXES = ['ajiem','ajam','ajai','ajās','ajus','ajām','iem','ajos','ajā',
  'ām','am','em','im','us','as','es','os','is','ai','ei','ie','u','a','i','e','s'];

function stem(word) {
  var w = normalizeLv(word);
  for (var i = 0; i < SUFFIXES.length; i++) {
    var s = SUFFIXES[i];
    if (w.length > s.length + 2 && w.slice(-s.length) === s) {
      return w.slice(0, w.length - s.length);
    }
  }
  return w;
}

function matchesQuery(jokeText, query) {
  if (!query) return true;
  var parts = query.split('|');
  var filtered = [];
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i].trim();
    if (p) filtered.push(p);
  }
  if (!filtered.length) return true;

  for (var pi = 0; pi < filtered.length; pi++) {
    var words = normalizeLv(filtered[pi]).split(' ');
    var stems = [];
    for (var wi = 0; wi < words.length; wi++) {
      var st = stem(words[wi]);
      if (st.length >= 2) stems.push(st);
    }
    if (!stems.length) return true;
    var norm = normalizeLv(jokeText);
    var allMatch = true;
    for (var si = 0; si < stems.length; si++) {
      if (norm.indexOf(stems[si]) === -1) { allMatch = false; break; }
    }
    if (allMatch) return true;
  }
  return false;
}

// ── Filter ────────────────────────────────────────────────────────────────
function applyFilter(query, cat) {
  if (query !== undefined) state.searchQuery = query;
  if (cat   !== undefined) state.selectedCat = cat;

  var filtered = [];
  for (var i = 0; i < state.allJokes.length; i++) {
    var j = state.allJokes[i];
    var catOk = !state.selectedCat || j.cat === state.selectedCat;
    var txtOk = matchesQuery(j.text, state.searchQuery);
    if (catOk && txtOk) filtered.push(j);
  }
  state.filteredJokes = filtered;

  if (state.searchQuery.length > 0) {
    el.searchClear.className = 'visible';
  } else {
    el.searchClear.className = '';
  }

  var hasFilter = state.searchQuery.length > 0 || state.selectedCat !== '';
  el.btnResetSearch.className = hasFilter ? 'visible' : '';

  var hasCurrentInFiltered = false;
  if (state.currentJoke) {
    for (var k = 0; k < state.filteredJokes.length; k++) {
      if (state.filteredJokes[k].id === state.currentJoke.id) {
        hasCurrentInFiltered = true; break;
      }
    }
  }

  if (!state.filteredJokes.length) {
    el.jokeNumber.textContent = '';
    el.jokeText.textContent = 'Pēc šī vaicājuma nekas neuzpeldēja. Pamēģini īsāku sakni vai | starp vārdiem.';
  } else if (!hasCurrentInFiltered) {
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
  var numText = joke.cat
    ? ('Joks #' + joke.id + ' · ' + joke.cat)
    : ('Joks #' + joke.id);
  el.jokeNumber.textContent = numText;
  el.jokeText.textContent = joke.text;
  el.jokeText.style.fontSize = state.fontSize + 'px';
  renderFavState();
  renderPrevBtn();
  if (animate) {
    el.jokeCard.className = '';
    // reflow
    void el.jokeCard.offsetWidth;
    el.jokeCard.className = 'animate-in';
  }
  el.jokeScroll.scrollTop = 0;
}

function renderFavState() {
  if (state.currentJoke && state.favoriteIds[state.currentJoke.id]) {
    el.btnFavorite.textContent = '★ Saglabāts';
  } else {
    el.btnFavorite.textContent = '☆ Saglabāt';
  }
}

function renderPrevBtn() {
  var hasPrev = state.history.length > 0 && state.historyPos > 0;
  el.btnPrev.disabled = !hasPrev;
  el.btnPrev.style.opacity = hasPrev ? '1' : '0.35';
}

function updateStatus() {
  var shown = 0;
  for (var id in state.shownIds) {
    if (state.shownIds.hasOwnProperty(id)) shown++;
  }
  el.statusText.textContent = 'Redzēti: ' + shown + ' / ' + state.allJokes.length;
}

// ── Sound chips ───────────────────────────────────────────────────────────
function buildSoundChips() {
  el.soundChips.innerHTML = '';
  for (var idx = 0; idx < SOUND_LABELS.length; idx++) {
    (function(i) {
      var btn = document.createElement('button');
      btn.className = 'sound-chip' + (state.soundIndex === i ? ' selected' : '');
      btn.textContent = SOUND_LABELS[i];
      btn.setAttribute('aria-label', SOUND_LABELS[i]);
      btn.addEventListener('click', function() {
        preloadSounds();
        state.soundIndex = i;
        saveSoundIndex();
        var chips = el.soundChips.querySelectorAll('.sound-chip');
        for (var c = 0; c < chips.length; c++) {
          chips[c].className = 'sound-chip' + (c === i ? ' selected' : '');
        }
        if (state.soundEnabled) playSound(SOUND_FILES[i]);
        haptic();
      });
      el.soundChips.appendChild(btn);
    })(idx);
  }
}

function renderSoundToggle() {
  el.btnSoundToggle.textContent = state.soundEnabled
    ? '🔊 Skaņa: ieslēgta'
    : '🔇 Skaņa: izslēgta';
}

function renderFontLabel() {
  el.fontSizeLabel.textContent = 'Fonta izmērs: ' + state.fontSize + ' sp';
}

// ── Mode switching ────────────────────────────────────────────────────────
function setClass(elem, cls, on) {
  if (on) {
    if (elem.className.indexOf(cls) === -1) elem.className += (elem.className ? ' ' : '') + cls;
  } else {
    elem.className = elem.className.replace(new RegExp('\\s*' + cls + '\\b', 'g'), '').trim();
  }
}

function switchMode(mode) {
  state.mode = mode;
  var isMain     = mode === 'MAIN';
  var isResults  = mode === 'RESULTS';
  var isFavorites= mode === 'FAVORITES';
  var isList     = isResults || isFavorites;
  var isSettings = mode === 'SETTINGS';

  el.jokeCard.style.display    = isMain ? 'flex' : 'none';
  el.primaryBar.style.display  = isMain ? 'flex' : 'none';

  setClass(el.listContainer,     'visible', isList);
  setClass(el.settingsContainer, 'visible', isSettings);
  setClass(el.btnBack,           'visible', !isMain);
  setClass(el.catFilterWrap,     'visible', isResults);
  setClass(el.btnClearFavsInline,'visible', isFavorites);

  setClass(el.btnResults,       'active', isResults);
  setClass(el.btnNavFavorites,  'active', isFavorites);
  setClass(el.btnSettings,      'active', isSettings);
  setClass(el.btnStar,          'active', isFavorites);

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
  var sel = el.catSelect;
  sel.innerHTML = '';

  var allOpt = document.createElement('option');
  allOpt.value = '';
  allOpt.textContent = 'Visas kategorijas';
  sel.appendChild(allOpt);

  var sourceJokes = state.mode === 'FAVORITES'
    ? state.allJokes.filter(function(j) { return state.favoriteIds[j.id]; })
    : state.allJokes;

  var available = {};
  for (var i = 0; i < sourceJokes.length; i++) {
    if (sourceJokes[i].cat) available[sourceJokes[i].cat] = true;
  }

  for (var ci = 0; ci < CATEGORIES.length; ci++) {
    var cat = CATEGORIES[ci];
    if (!available[cat]) continue;
    var count = 0;
    for (var ji = 0; ji < sourceJokes.length; ji++) {
      if (sourceJokes[ji].cat === cat) count++;
    }
    var opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat + ' (' + count + ')';
    sel.appendChild(opt);
  }
  sel.value = state.selectedCat;
}

// ── List refresh ──────────────────────────────────────────────────────────
function refreshList() {
  var items = [];
  if (state.mode === 'RESULTS') {
    items = state.filteredJokes;
    el.listTitle.textContent = state.selectedCat || 'Visi joki';
  } else {
    var favs = [];
    for (var i = 0; i < state.allJokes.length; i++) {
      if (state.favoriteIds[state.allJokes[i].id]) favs.push(state.allJokes[i]);
    }
    if (state.selectedCat) {
      var tmp = [];
      for (var fi = 0; fi < favs.length; fi++) {
        if (favs[fi].cat === state.selectedCat) tmp.push(favs[fi]);
      }
      favs = tmp;
    }
    if (state.searchQuery.trim()) {
      var tmp2 = [];
      for (var fj = 0; fj < favs.length; fj++) {
        if (matchesQuery(favs[fj].text, state.searchQuery)) tmp2.push(favs[fj]);
      }
      favs = tmp2;
    }
    items = favs;
    el.listTitle.textContent = 'Saglabātie joki';
  }

  el.listScroll.innerHTML = '';

  if (!items.length) {
    setClass(el.listEmpty, 'visible', true);
    el.listEmpty.textContent = state.mode === 'FAVORITES'
      ? '☆ Nav saglabātu favorītu. Piespiedi ☆ pie joka, lai to pievienotu šeit.'
      : 'Šajā kategorijā nekas neuzpeldēja.';
    return;
  }
  setClass(el.listEmpty, 'visible', false);

  var frag = document.createDocumentFragment();
  for (var li = 0; li < items.length; li++) {
    (function(joke) {
      var div = document.createElement('div');
      div.className = 'joke-item' + (state.favoriteIds[joke.id] ? ' fav' : '');
      var catSpan = joke.cat
        ? ' &middot; <span class="joke-item-cat">' + escHtml(joke.cat) + '</span>'
        : '';
      div.innerHTML =
        '<div class="joke-item-num">Joks #' + joke.id + catSpan + '</div>' +
        '<div class="joke-item-text">' + escHtml(joke.text) + '</div>';
      div.addEventListener('click', function() {
        preloadSounds();
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
    })(items[li]);
  }
  el.listScroll.appendChild(frag);
}

// ── Random ────────────────────────────────────────────────────────────────
function showRandom() {
  preloadSounds();
  var pool = [];
  for (var i = 0; i < state.filteredJokes.length; i++) {
    if (!state.shownIds[state.filteredJokes[i].id]) pool.push(state.filteredJokes[i]);
  }
  if (!pool.length) {
    el.jokeText.textContent = 'Izsmēlis visu krājumu. Nospied "Atjaunot" un sāc no jauna.';
    el.jokeNumber.textContent = '';
    el.jokeCard.className = '';
    void el.jokeCard.offsetWidth;
    el.jokeCard.className = 'animate-in';
    return;
  }
  var next = pool[Math.floor(Math.random() * pool.length)];
  state.shownIds[next.id] = true;
  saveShown();
  state.currentJoke = next;

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

// ── Atpakaļ ───────────────────────────────────────────────────────────────
function showPrev() {
  preloadSounds();
  if (state.historyPos <= 0) return;
  state.historyPos--;
  var id = state.history[state.historyPos];
  var joke = null;
  for (var i = 0; i < state.allJokes.length; i++) {
    if (state.allJokes[i].id === id) { joke = state.allJokes[i]; break; }
  }
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
  var id = state.currentJoke.id;
  if (state.favoriteIds[id]) {
    delete state.favoriteIds[id];
    showToast('Izņemts no favorītiem');
  } else {
    state.favoriteIds[id] = true;
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
  var text = 'Joks #' + state.currentJoke.id + '\n' + state.currentJoke.text + '\n\n— Sliktie joki 30+';
  if (navigator.share) {
    try { navigator.share({ title: 'Sliktais joks', text: text }); } catch (e) {}
  } else if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() { showToast('Nokopēts!'); });
  } else {
    // Fallback vecajiem pārlūkiem
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('Nokopēts!');
    } catch (e) {}
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
function openModal(id) {
  var m = $$(id);
  if (m) { setClass(m, 'open', true); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  var m = $$(id);
  if (m) { setClass(m, 'open', false); document.body.style.overflow = ''; }
}

// ── Telegram ──────────────────────────────────────────────────────────────
var BOT_TOKEN = '8779790699:AAFnA4UYn17yCiuKHvV2n0RWvHdxlk97f-U';
var CHAT_ID   = '7575867937';
function sendTelegram(text, onSuccess, onError) {
  var xhr = new XMLHttpRequest();
  xhr.open('POST', 'https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage', true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onload = function() {
    if (xhr.status >= 200 && xhr.status < 300) { if (onSuccess) onSuccess(); }
    else { if (onError) onError(); }
  };
  xhr.onerror = function() { if (onError) onError(); };
  try { xhr.send(JSON.stringify({ chat_id: CHAT_ID, text: text })); }
  catch (e) { if (onError) onError(); }
}

// ── iOS hint ──────────────────────────────────────────────────────────────
function maybeShowIosHint() {
  try {
    var ua = navigator.userAgent;
    var isIos = /iphone|ipad|ipod/i.test(ua);
    var isSafari = /safari/i.test(ua) && !/chrome|chromium|crios/i.test(ua);
    var standalone = window.navigator.standalone;
    if (isIos && isSafari && !standalone && !LS.get('iosHintDismissed')) {
      setTimeout(function() { setClass(el.iosHint, 'show', true); }, 3000);
    }
  } catch (e) {}
}

// ── addEvent helper ───────────────────────────────────────────────────────
function on(elem, evt, fn) {
  if (elem.addEventListener) elem.addEventListener(evt, fn, false);
  else if (elem.attachEvent) elem.attachEvent('on' + evt, fn);
}

// ── Init ──────────────────────────────────────────────────────────────────
function init() {
  initEl();
  state.allJokes = JOKES_DATA;
  var lastId = loadPrefs();
  state.filteredJokes = state.allJokes.slice();
  el.jokeText.style.fontSize = state.fontSize + 'px';

  var restored = false;
  if (lastId !== null && lastId !== undefined) {
    for (var fi = 0; fi < state.allJokes.length; fi++) {
      if (state.allJokes[fi].id === lastId) {
        state.currentJoke = state.allJokes[fi];
        state.history = [lastId];
        state.historyPos = 0;
        renderJoke(state.currentJoke, false);
        restored = true;
        break;
      }
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
    try { navigator.serviceWorker.register('sw.js'); } catch (e) {}
  }
  maybeShowIosHint();

  // ── Events ────────────────────────────────────────────────────────────

  on(el.headerBrand, 'click', function() {
    preloadSounds();
    if (state.mode !== 'MAIN') {
      state.selectedCat = '';
      applyFilter(undefined, '');
      switchMode('MAIN');
      playSoundNav();
      haptic();
    }
  });

  on(el.fontMinus, 'click', function() { changeFontSize(-2); });
  on(el.fontPlus,  'click', function() { changeFontSize(+2); });

  on(el.searchInput, 'input', function(e) {
    applyFilter(e.target.value);
  });
  on(el.searchClear, 'click', function() {
    el.searchInput.value = '';
    applyFilter('');
  });
  on(el.btnResetSearch, 'click', function() {
    el.searchInput.value = '';
    state.selectedCat = '';
    applyFilter('', '');
    switchMode('MAIN');
  });

  on(el.btnFavorite, 'click', toggleFavorite);
  on(el.btnShare,    'click', shareJoke);

  on(el.btnRandom, 'click', showRandom);
  on(el.btnPrev,   'click', showPrev);
  on(el.btnStar,   'click', function() {
    preloadSounds();
    state.selectedCat = '';
    switchMode('FAVORITES');
    playSoundNav();
    haptic();
  });

  on(el.btnResults, 'click', function() {
    preloadSounds();
    state.selectedCat = '';
    applyFilter(undefined, '');
    switchMode('RESULTS');
    playSoundNav();
    haptic();
  });
  on(el.btnNavFavorites, 'click', function() {
    preloadSounds();
    state.selectedCat = '';
    switchMode('FAVORITES');
    playSoundNav();
    haptic();
  });
  on(el.btnResetShown, 'click', function() {
    preloadSounds();
    state.shownIds = {};
    saveShown();
    haptic();
    updateStatus();
    showToast('Redzēto saraksts notīrīts');
  });
  on(el.btnSettings, 'click', function() {
    preloadSounds();
    switchMode('SETTINGS');
    playSoundNav();
    haptic();
  });

  on(el.btnBack, 'click', function() {
    preloadSounds();
    state.selectedCat = '';
    applyFilter(undefined, '');
    switchMode('MAIN');
    playSoundNav();
    haptic();
  });

  on(el.catSelect, 'change', function() {
    applyFilter(undefined, el.catSelect.value);
    haptic();
  });

  on(el.btnClearFavsInline, 'click', function() {
    if (!confirm('Dzēst visus favorītus?')) return;
    state.favoriteIds = {};
    saveFavorites();
    haptic();
    updateStatus();
    refreshList();
    showToast('Favorīti notīrīti');
  });

  on(el.fontMinusSettings, 'click', function() { changeFontSize(-2); });
  on(el.fontPlusSettings,  'click', function() { changeFontSize(+2); });

  on(el.btnSoundToggle, 'click', function() {
    preloadSounds();
    state.soundEnabled = !state.soundEnabled;
    saveSoundEnabled();
    renderSoundToggle();
    haptic();
    if (state.soundEnabled) playSound();
  });

  on(el.btnClearFavorites, 'click', function() {
    if (!confirm('Dzēst visus favorītus?')) return;
    state.favoriteIds = {};
    saveFavorites();
    haptic();
    updateStatus();
    showToast('Favorīti notīrīti');
  });
  on(el.btnClearShown, 'click', function() {
    if (!confirm('Aizmirst visus redzētos jokus?')) return;
    state.shownIds = {};
    saveShown();
    haptic();
    updateStatus();
    showToast('Redzēto saraksts notīrīts');
  });
  on(el.btnClearAll, 'click', function() {
    if (!confirm('Notīrīt visu saglabāto (redzēti + favorīti)?')) return;
    state.shownIds = {};
    state.favoriteIds = {};
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

  on(el.btnContact, 'click', function() {
    el.contactInput.value = '';
    el.contactCounter.textContent = '0 / 500';
    openModal('contact-modal');
    setTimeout(function() { try { el.contactInput.focus(); } catch (e) {} }, 300);
  });
  on(el.btnContactCancel, 'click', function() { closeModal('contact-modal'); });
  on(el.contactModal, 'click', function(e) {
    if (e.target === el.contactModal) closeModal('contact-modal');
  });
  on(el.contactInput, 'input', function() {
    var len = el.contactInput.value.length;
    el.contactCounter.textContent = len + ' / 500';
    el.contactCounter.style.color = len >= 480 ? '#e53935' : '#888';
    if (len > 500) el.contactInput.value = el.contactInput.value.slice(0, 500);
  });
  on(el.btnContactSend, 'click', function() {
    var msg = el.contactInput.value.trim();
    if (!msg) { showToast('Ziņa ir tukša!'); return; }
    el.btnContactSend.textContent = 'Sūta...';
    el.btnContactSend.disabled = true;
    sendTelegram('[Sliktie joki PWA]\n' + msg,
      function() {
        closeModal('contact-modal');
        showToast('Ziņa nosūtīta! ✓');
        el.btnContactSend.textContent = 'Nosūtīt ziņu';
        el.btnContactSend.disabled = false;
      },
      function() {
        showToast('Kļūda! Mēģini vēlreiz.');
        el.btnContactSend.textContent = 'Nosūtīt ziņu';
        el.btnContactSend.disabled = false;
      }
    );
  });

  on(el.btnDonate, 'click', function() { openModal('donate-modal'); });
  on(el.btnDonateCancel, 'click', function() { closeModal('donate-modal'); });
  on(el.donateModal, 'click', function(e) {
    if (e.target === el.donateModal) closeModal('donate-modal');
  });
  on(el.btnBmc, 'click', function() {
    openLink('https://buymeacoffee.com/ingmarsv');
    closeModal('donate-modal');
  });
  on(el.btnRevolut, 'click', function() {
    openLink('https://revolut.me/ingmars2v72');
    closeModal('donate-modal');
  });
  on(el.btnPaypal, 'click', function() {
    openLink('https://paypal.me/IngmarsVigners');
    closeModal('donate-modal');
  });

  on(el.iosHintClose, 'click', function() {
    setClass(el.iosHint, 'show', false);
    LS.set('iosHintDismissed', true);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
