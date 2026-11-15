'use strict';
/* =========================================================
   Loop
   ========================================================= */
let drawAcc = 0, fpsT = 0, fpsN = 0;
let prev = 0, uiT = 0, saveT = 0, shownCoins = null, coinTxt = '', waveP = '', paused = false, playT = 0;
/* Full-screen map. The page layout does the work; the browser's own full screen is asked for on top
   (hides the address bar on phones) where it is allowed, and leaving it also leaves the full-screen map. */
const FULL = { asked: false };
function setMapFull(on) {
  document.body.classList.toggle('mapfull', on);
  const b = $('bFull'); b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? 'Leave full-screen map' : 'Full-screen map'); b.title = on ? 'Leave full screen (F or Esc)' : 'Full-screen map (F)';
  const de = document.documentElement;
  if (on && !document.fullscreenElement && de.requestFullscreen) { de.requestFullscreen({ navigationUI: 'hide' }).then(() => { FULL.asked = true; }).catch(() => {}); }
  if (!on && document.fullscreenElement && FULL.asked) { FULL.asked = false; document.exitFullscreen().catch(() => {}); }
  requestAnimationFrame(() => { fit(); refresh(); });
}
/* A full stop: production, raiders, timers and animations all wait. Not saved, so a reload always resumes. */
function setPaused(on) {
  if (paused === on) return; paused = on; stopHold();
  $('pauseCover').hidden = !on; $('bPause').hidden = on;
  if (on) $('pauseCover').focus(); else $('bPause').focus({ preventScroll: true });
  snd(on ? 'pause' : 'go', on ? 330 : 440, .08, 'triangle', .04, on ? -110 : 220);
}
/* Every frame: the coin counter rolls towards the real total and the wave button fills as raiders fall. */
function tickHud(dt) {
  if (shownCoins === null || REDUCED || !isFinite(shownCoins)) shownCoins = S.coins;
  shownCoins += (S.coins - shownCoins) * Math.min(1, dt * 9); if (Math.abs(S.coins - shownCoins) < .5) shownCoins = S.coins;
  const t = fmt(shownCoins); if (t !== coinTxt) { coinTxt = t; $('hCoins').textContent = t; }
  const p = W.active && W.total ? Math.round(100 * Math.max(0, 1 - (W.queue.length + foes.length) / W.total)) + '%' : '0%';
  if (p !== waveP) { waveP = p; $('bWave').style.setProperty('--p', p); }
}
function frame(now) {
  const dt = Math.min(OFFLINE_CAP, Math.max(0, (now - prev) / 1000)); prev = now;
  if (!paused) {
    econTowns(dt); // every town produces; only this one has waves
    let cdt = Math.min(dt, .1) * S.speed; while (cdt > 0) { const s = Math.min(cdt, .05); combat(s); cdt -= s; }
    playT += Math.min(dt, .1); cosmetics(Math.min(dt, .1), playT); S.stats.played += Math.min(dt, 1); sampleIncome(Math.min(dt, 1));
    if (S.bestRate === undefined || INC.samples.length > 30) S.bestRate = Math.max(S.bestRate || 0, liveIncome());
  }
  // the 30 fps setting keeps the simulation running every frame but draws every other one or so (saves battery)
  const cap = GX().fps === 30 ? 1 / 31 : 0; drawAcc += dt;
  if (drawAcc >= cap) { draw(playT); drawAcc = cap ? drawAcc % cap : 0; fpsN++; }
  tickHud(Math.min(dt, .1));
  fpsT += dt; if (fpsT >= .5) { const el = $('fpsMeter'); if (el) { el.hidden = !GX().fpsShow; el.textContent = Math.round(fpsN / fpsT) + ' fps' + (GLX.on ? ' · ' + (GLX.nLights || 0) + ' lights' : ''); } fpsT = 0; fpsN = 0; }
  // if lighting makes a device struggle (well under 30 frames a second for several seconds), drop to simple graphics
  if (GLX.on && !GLX.noAuto && !document.hidden && dt > 0 && dt < .5) {
    GLX.frames++; if (dt > 1 / 24) GLX.slow++;
    if (GLX.frames >= 240) { if (GLX.slow > 170) { setGx('preset', GX().preset === 'ultra' || GX().preset === 'high' ? 'med' : 'low'); say('Lowered the graphics quality to keep the game smooth. Change it any time with the gear button on the map.'); } GLX.frames = GLX.slow = 0; }
  }
  uiT -= dt; if (uiT <= 0) { uiT = .2; refresh(); }
  if (toastT > 0 && (toastT -= dt) <= 0) $('toast').classList.remove('show');
  saveT += dt; if (saveT > 10) { saveT = 0; save(); }
  requestAnimationFrame(frame);
}
function start(data) {
  paintSprites(); paintSprites2(); paintSprites3(); setMap('gulch');
  if (!(data && data.S && adopt(data.S))) load();
  checkBadges(true); applyMotion(); protectSave(); announceVersion();
  const away = Math.min(OFFLINE_CAP, Math.max(0, (Date.now() - S.last) / 1000));
  buildFixed(); fit(); applyGfx(); window.addEventListener('resize', fit);
  if (window.ResizeObserver) new ResizeObserver(() => { if (Math.abs(cv.clientWidth * renderScale() - cv.width) > 2) fit(); }).observe(cv);
  if (away > 60) {
    const before = S.life, r0 = Object.assign({}, S.res); econTowns(away);
    const gains = {}; for (const k in ITEMS) gains[k] = S.res[k] - r0[k];
    welcome(away, S.life - before, gains);
  } else if (!S.life && !S.towers.length) say('Tap a plot beside the road to build a crossbow. Hold the trees and rocks to gather. Raiders arrive in 30 seconds.');
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (S.opt.autoPause) setPaused(true); save(); } });
  window.addEventListener('pagehide', save);
  if (document.fonts && document.fonts.load) document.fonts.load('20px Rye').catch(() => {});
  prev = performance.now(); refresh(); requestAnimationFrame(frame);
}
/* =========================================================
   Installing as an app, updates and keeping the save safe
   ========================================================= */
const GAME_VERSION = '2026.11.15-11'; // set by scripts/bump-version.js, together with sw.js and version.json
const GAME_NEWS = 'Fix: dusk turns warm orange again as raiders arrive.';
const APP = { prompt: null, installed: window.matchMedia && matchMedia('(display-mode: standalone)').matches || navigator.standalone === true, waiting: null, persisted: null };
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); APP.prompt = e; rebuild = true; });
window.addEventListener('appinstalled', () => { APP.prompt = null; APP.installed = true; rebuild = true; say('Copper Gulch is installed. Open it from your home screen or app list.'); });
async function installApp() { if (!APP.prompt) return; APP.prompt.prompt(); try { await APP.prompt.userChoice; } catch (e) {} APP.prompt = null; rebuild = true; }
/* Ask the browser not to clear this save when space runs low. Installed apps are usually granted this. */
async function protectSave() {
  try { if (navigator.storage && navigator.storage.persist) { APP.persisted = await navigator.storage.persisted() || await navigator.storage.persist(); rebuild = true; } } catch (e) {}
}
function showUpdate() {
  if ($('updateBar')) return;
  const bar = h('button', { cls: 'updatebar', id: 'updateBar', on: () => { save(); if (APP.waiting) APP.waiting.postMessage('skip'); else location.reload(); } }, h('b', null, 'Update ready'), h('span', null, 'Tap to load the new version. Your save is kept.'));
  document.body.append(bar);
}
/* Updates, two ways so an installed copy can never get stuck:
   1. the service worker: a new sw.js installs in the background and waits; "Update ready" swaps to it and reloads;
   2. version.json, fetched past every cache: if the published version differs from this page, "Update ready" reloads.
   Both run when the app opens, whenever it comes back to the front, every 15 minutes, and from the Check button. */
APP.status = '';
async function checkUpdates(manual) {
  APP.status = 'Checking…'; rebuild = true;
  try { if (APP.reg) await APP.reg.update(); } catch (e) {}
  try {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    // only a newer published version counts (a CDN briefly serving an older version.json must not nag)
    const newer = (a, b) => { const [ad, an] = a.split('-'), [bd, bn] = b.split('-'); return ad !== bd ? ad > bd : (+an || 0) > (+bn || 0); };
    if (r.ok) { const j = await r.json(); APP.latest = j.version; if (j.version && newer(j.version, GAME_VERSION)) showUpdate(); }
  } catch (e) {}
  APP.status = $('updateBar') ? 'A new version is ready.' : APP.latest ? 'Up to date.' : manual ? 'Could not reach the server. You may be offline.' : '';
  rebuild = true;
}
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', async () => {
    try {
      const reg = APP.reg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
      const watch = w => { if (!w) return; const done = () => { if (w.state === 'installed' && navigator.serviceWorker.controller) { APP.waiting = w; showUpdate(); } }; done(); w.addEventListener('statechange', done); };
      watch(reg.waiting); reg.addEventListener('updatefound', () => watch(reg.installing));
      let reloading = false; navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) return; reloading = true; location.reload(); });
    } catch (e) {}
    checkUpdates();
    setInterval(checkUpdates, 15 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUpdates(); });
  });
}
/* After an update, say once what changed. */
function announceVersion() {
  const seen = S.seenVersion; S.seenVersion = GAME_VERSION;
  if (seen && seen !== GAME_VERSION) setTimeout(() => say('Updated to version ' + GAME_VERSION + '.' + (GAME_NEWS ? ' ' + GAME_NEWS : '')), 1200);
}
function saveFile() {
  save(); const blob = new Blob([JSON.stringify(S)], { type: 'application/json' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'copper-gulch-save-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000); say('Save file downloaded. Keep it somewhere safe.');
}
function loadFile() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = () => { const f = inp.files && inp.files[0]; if (!f) return; f.text().then(t => { if (!adopt(JSON.parse(t))) throw 0; bakeGround(); wipeField(); W.countdown = 15; applyMotion(); applyGfx(); save(); say('Save loaded from file.'); }).catch(() => say('That file is not a Copper Gulch save.')); };
  inp.click();
}
const hot = window.claude && window.claude.hot;
if (hot && hot.snapshot) hot.snapshot(() => { save(); return { S }; });
if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
