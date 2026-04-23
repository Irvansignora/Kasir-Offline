// KasirKu PWA Service Worker
// Mendukung: localhost,
const CACHE_VERSION = 'v3';
const CACHE_NAME = 'kasirku-' + CACHE_VERSION;

// File lokal yang di-cache (relative, akan di-resolve otomatis)
const LOCAL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-192.png',
  './icons/icon-384.png',
  './icons/icon-512.png',
];

// CDN resources
const CDN_URLS = [
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
];

// ============================================================
// INSTALL
// ============================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing... cache:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache local files
      for (const url of LOCAL_FILES) {
        try {
          await cache.add(url);
        } catch (e) {
          console.warn('[SW] Skip local:', url, e.message);
        }
      }
      // Cache CDN resources
      for (const url of CDN_URLS) {
        try {
          const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
          if (res.ok) await cache.put(url, res);
          console.log('[SW] CDN cached:', url.substring(0, 50));
        } catch (e) {
          console.warn('[SW] CDN failed (no internet?):', url.substring(0, 50));
        }
      }
      console.log('[SW] Install complete');
    }).then(() => self.skipWaiting())
  );
});

// ============================================================
// ACTIVATE — bersihkan cache lama
// ============================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => {
        console.log('[SW] Deleting old cache:', k);
        return caches.delete(k);
      }))
    ).then(() => self.clients.claim())
  );
});

// ============================================================
// FETCH — Cache First, Network Fallback
// ============================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Serve from cache, update in background
        fetch(request).then((fresh) => {
          if (fresh && fresh.ok) {
            caches.open(CACHE_NAME).then(c => c.put(request, fresh));
          }
        }).catch(() => {});
        return cached;
      }

      // Not cached → fetch network
      return fetch(request).then((response) => {
        if (!response || !response.ok) return response;

        const url = new URL(request.url);
        const cacheable =
          url.origin === self.location.origin ||
          ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com'].includes(url.hostname);

        if (cacheable) {
          caches.open(CACHE_NAME).then(c => c.put(request, response.clone()));
        }
        return response;
      }).catch(() => {
        // Offline fallback
        if (request.destination === 'document') {
          return caches.match('./index.html') || caches.match('./');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

console.log('[SW] KasirKu Service Worker', CACHE_VERSION, 'loaded ✅');
