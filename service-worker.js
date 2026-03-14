// service-worker.js
// VERSION: bump this number every deployment to force Safari to refresh
const VERSION = '4';
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

// Install: cache all assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  // Activate immediately, don't wait for old SW to die
  self.skipWaiting();
});

// Activate: delete ALL old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: NETWORK-FIRST strategy
// Always try the network first. Only fall back to cache if offline.
// This ensures Safari always gets the latest deployed version.
self.addEventListener('fetch', e => {
  // Skip non-GET and API calls entirely (no caching)
  if (e.request.method !== 'GET') return;
  if (
    e.request.url.includes('googleapis.com') ||
    e.request.url.includes('anthropic.com')
  ) return;

  e.respondWith(
    fetch(e.request)
      .then(networkResponse => {
        // Got a fresh response — update the cache silently
        if (networkResponse && networkResponse.status === 200) {
          const cloned = networkResponse.clone();
          caches.open(CACHE).then(c => c.put(e.request, cloned));
        }
        return networkResponse;
      })
      .catch(() => {
        // Offline fallback — serve from cache
        return caches.match(e.request);
      })
  );
});
