/* ---------------------------------------------------------------
   War Room service worker — an RNE Holdings product

   Makes the installed app work with no network at all. It caches only
   War Room's own files. It never sees a player or a recruit —
   those live in localStorage on the device and are never
   fetched, so they never pass through here.

   IF YOU EDIT ANY APP FILE, BUMP `CACHE` (and APP_BUILD in app.js to match). Otherwise an installed copy
   keeps serving the old version until it happens to revalidate — and it
   will look correct on your own machine, which is what makes it easy to
   miss.
   --------------------------------------------------------------- */

var CACHE = 'warroom-v16';

var ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './ocr.js',
  './voice.js',
  './mp3/worker.js',
  './mp3/lame.min.js',
  './manifest.webmanifest',
  /* If these are missing here the installed app renders in system-ui offline
     forever, on a machine that has them cached and therefore looks fine. */
  './fonts/archivo-latin.woff2',
  './fonts/plexmono-600-latin.woff2',
  './favicon-32.png',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      /* Individually, so one missing optional file cannot fail the whole
         install and leave the app with no offline copy at all. */
      .then(function (c) {
        return Promise.all(ASSETS.map(function (url) {
          return c.add(url).catch(function () { return null; });
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) {
          return k === CACHE ? null : caches.delete(k);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

/* Stale-while-revalidate: the cached copy answers immediately so the app
   opens instantly with no signal, while a fresh copy is
   fetched in the background for next launch. */
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;

  var url;
  try { url = new URL(e.request.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;   /* never touch third parties */

  e.respondWith(
    caches.match(e.request).then(function (hit) {
      var net = fetch(e.request).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () {
        /* Offline. A navigation still needs something to render. */
        return hit || caches.match('./index.html');
      });

      return hit || net;
    })
  );
});
