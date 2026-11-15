// Service worker: lets Copper Gulch install as an app and run offline.
// The page is fetched from the network first so new versions arrive as soon as they are published;
// the cached copy is only used when offline. Bump VERSION with every release so old caches are cleared.
const VERSION = '2026.11.15-12';
const CACHE = 'copper-gulch-' + VERSION;
const SHELL = ["./","./index.html","./manifest.webmanifest","./icons/apple-touch-icon.png","./icons/icon-192.png","./icons/icon-512.png","./icons/icon-maskable-512.png","./src/app.js","./src/art.js","./src/combat.js","./src/defs.js","./src/economy.js","./src/fx.js","./src/gl.js","./src/goals.js","./src/map.js","./src/render2d.js","./src/render3d.js","./src/state.js","./src/ui.js"];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('copper-gulch-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (new URL(req.url).pathname.endsWith('/version.json')) return; // always straight from the network: it is how the page spots new releases
  const page = req.mode === 'navigate' || req.url.endsWith('/index.html');
  if (page) {
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); return res; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })));
});
