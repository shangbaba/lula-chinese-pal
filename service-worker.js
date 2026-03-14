// service-worker.js
// VERSION: bump this number every deployment to force Safari to refresh
const VERSION = '6';
const CACHE = `lula-v${VERSION}`;

const ASSETS = [
  '/',
  '/index.html',
  '/css/main.css',
  '/css/views.css',
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
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first: always try network, fall back to cache if offline
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (
    e.request.url.includes('googleapis.com') ||
    e.request.url.includes('anthropic.com')
  ) return;

  e.respondWith(
    fetch(e.request)
      .then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const cloned = networkResponse.clone();
          caches.open(CACHE).then(c => c.put(e.request, cloned));
        }
        return networkResponse;
      })
      .catch(() => caches.match(e.request))
  );
});
