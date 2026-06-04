const CACHE = 'sliktie-joki-v3';
const BASE = '/sliktie-joki';
const ASSETS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/style.css',
  BASE + '/app.js',
  BASE + '/jokes-data.js',
  BASE + '/sounds/joke_reveal.mp3',
  BASE + '/sounds/sound_1_sparkle.mp3',
  BASE + '/sounds/sound_2_click.mp3',
  BASE + '/sounds/sound_2_rimshot.mp3',
  BASE + '/sounds/sound_2_typewriter.mp3',
  BASE + '/sounds/sound_3_boing.mp3',
  BASE + '/sounds/sound_3_chime.mp3',
  BASE + '/sounds/sound_3_laser.mp3',
  BASE + '/sounds/sound_3_rise.mp3',
  BASE + '/sounds/sound_4_ding.mp3',
  BASE + '/sounds/sound_4_drum.mp3',
  BASE + '/sounds/sound_4_pop.mp3',
  BASE + '/sounds/sound_5_whoosh.mp3'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => cached))
  );
});
