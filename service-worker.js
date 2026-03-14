// service-worker.js
const CACHE = 'lula-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/css/main.css',
  '/js/app.js',
  '/js/db.js',
  '/js/ui.js',
  '/js/ai/provider.js',
  '/js/ai/gemini.js',
  '/js/views/profile.js',
  '/js/views/library.js',
  '/js/views/pages.js',
  '/js/views/reader.js',
  '/js/views/recorder.js',
  '/js/views/settings.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Network-first for API calls
  if (e.request.url.includes('googleapis.com') || e.request.url.includes('anthropic.com')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
