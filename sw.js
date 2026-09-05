const CACHE_NAME = 'collection-log-v11';
const FONT_CACHE = 'collection-log-fonts-v1';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/db.js',
  './js/image.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Cache each file independently instead of cache.addAll(), which aborts
      // the *entire* install if even one request fails — that would leave
      // the old service worker (and its stale cache) in control forever.
      Promise.all(
        APP_SHELL.map((path) =>
          fetch(path, { cache: 'reload' })
            .then((res) => {
              if (res.ok) return cache.put(path, res);
            })
            .catch((err) => console.error('Precache failed for', path, err))
        )
      ).then(() => self.skipWaiting())
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME && key !== FONT_CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Google Fonts: cache-first, kept indefinitely across app-shell cache bumps
  // so the correct fonts still render on later offline visits.
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.open(FONT_CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          if (cached) return cached;
          return fetch(req).then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // App shell (HTML/CSS/JS/icons): network-first. Always prefer the live,
  // freshly-deployed version when online; the cache only serves as an
  // offline fallback, never a substitute for a reachable network.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
