// AutumNation service worker: lets the installed app start and play offline.
// Network first, so a new version is picked up as soon as you're online; the cache is the fallback.
// Bump VERSION when files are added or removed (changed files refresh on their own).
const CACHE_PREFIX = 'autumnation-v';
const VERSION = `${CACHE_PREFIX}3`;
const SHELL = [
  './', 'index.html', 'style.css', 'audio.js', 'game.js', 'lots/prairie.js', 'manifest.webmanifest',
  'favicon.svg', 'favicon.ico', 'icons/icon-192.png', 'icons/icon-512.png',
  'icons/icon-maskable-192.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.endsWith('/__reload')) return;            // the local dev server's live reload
  const font = FONT_HOSTS.includes(url.hostname);
  if (url.origin !== self.location.origin && !font) return;
  if (!font && !url.href.startsWith(self.registration.scope)) return;
  if (font){
    // fonts never change: cache first
    e.respondWith(caches.open(VERSION).then(c => c.match(req)).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res;
    })));
    return;
  }
  e.respondWith(fetch(req).then(res => {
    if (res.ok){ const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.open(VERSION).then(c => c.match(req, { ignoreSearch: true })
    .then(hit => hit || (req.mode === 'navigate' ? c.match('index.html') : Response.error())))));
});
