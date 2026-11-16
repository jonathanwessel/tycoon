// Service worker: lets Copper Gulch install as an app and run offline.
// The page and the game's code are fetched from the network first (revalidated, never from a stale browser cache) so a
// new version runs as soon as it is published; the cached copies are only used when offline. Icons come from the cache.
// Bump VERSION with every release (scripts/bump-version.js) so old caches are cleared.
const VERSION = '2026.11.16-4';
const CACHE = 'copper-gulch-' + VERSION;
const SHELL = ["./","./index.html","./manifest.webmanifest","./icons/apple-touch-icon-3d.png","./icons/icon3d-192.png","./icons/icon3d-512.png","./icons/icon3d-maskable-512.png","./src/app.js","./src/art.js","./src/capital.js","./src/combat.js","./src/convention.js","./src/defs.js","./src/economy.js","./src/fx.js","./src/goals.js","./src/map.js","./src/r3d/buildings.js","./src/r3d/capital3d.js","./src/r3d/kit.js","./src/r3d/main.js","./src/r3d/units.js","./src/r3d/world.js","./src/state.js","./src/ui/actions.js","./src/ui/capital.js","./src/ui/card.js","./src/ui/convention.js","./src/ui/core.js","./src/ui/exchange.js","./src/ui/hud.js","./src/ui/input.js","./src/ui/panels.js","./src/ui/settings.js","./src/ui/sheet.js","./src/ui/trees.js","./src/ui/tutorial.js","./src/view.js","./vendor/three/addons/postprocessing/EffectComposer.js","./vendor/three/addons/postprocessing/MaskPass.js","./vendor/three/addons/postprocessing/OutputPass.js","./vendor/three/addons/postprocessing/Pass.js","./vendor/three/addons/postprocessing/RenderPass.js","./vendor/three/addons/postprocessing/ShaderPass.js","./vendor/three/addons/postprocessing/UnrealBloomPass.js","./vendor/three/addons/shaders/CopyShader.js","./vendor/three/addons/shaders/LuminosityHighPassShader.js","./vendor/three/addons/shaders/OutputShader.js","./vendor/three/addons/utils/BufferGeometryUtils.js","./vendor/three/three.module.min.js"];

// Install: download every file fresh. A plain addAll can be answered from the browser's own HTTP cache, which once
// filled a new version's cache with the previous version's code.
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('copper-gulch-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.endsWith('/version.json')) return; // always straight from the network: it is how the page spots new releases
  const page = req.mode === 'navigate' || url.pathname.endsWith('/index.html');
  const code = page || /\.(js|webmanifest|json)$/.test(url.pathname);
  if (code) { // network first, revalidated; keep a copy for offline play
    const key = page ? './index.html' : req;
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); } return res; })
      .catch(() => caches.match(key)));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })));
});
