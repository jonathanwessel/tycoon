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
  const b = $('bFull'), ph = !docked(); b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', ph ? (on ? 'Show the interface' : 'Hide the interface') : on ? 'Leave full-screen map' : 'Full-screen map'); b.title = ph ? (on ? 'Show the interface (F)' : 'Hide the interface for a clear view (F)') : on ? 'Leave full screen (F or Esc)' : 'Full-screen map (F)';
  if (on && SHEET.open) closeSheet();
  const de = document.documentElement;
  if (on && !document.fullscreenElement && de.requestFullscreen) { de.requestFullscreen({ navigationUI: 'hide' }).then(() => { FULL.asked = true; }).catch(() => {}); }
  if (!on && document.fullscreenElement && FULL.asked) { FULL.asked = false; document.exitFullscreen().catch(() => {}); }
  requestAnimationFrame(() => { fit(); refresh(); });
}
/* Sizes of the floating interface on a phone (header, stock strip, tab bar, wave controls), for the map to fit between. */
function layoutVars() {
  if (docked()) return;
  const r = document.documentElement.style, hd = document.querySelector('header'), st = $('stock'), nv = $('tabs'), ct = document.querySelector('.controls');
  const H = hd ? hd.offsetHeight : 38, S_ = st ? st.offsetHeight : 40, N = nv ? nv.offsetHeight : 66, C = ct ? ct.offsetHeight : 46;
  r.setProperty('--hh', H + 'px'); r.setProperty('--top', (H + S_) + 'px'); r.setProperty('--navh', N + 'px'); r.setProperty('--bot', (N + C + 18) + 'px');
  if (SHEET.open) setSheetH(SHEET.h);
}
/* A full stop: production, raiders, timers and animations all wait. Not saved, so a reload always resumes. */
function setPaused(on) {
  if (paused === on) return; paused = on; stopHold();
  $('pauseCover').hidden = !on; $('bPause').hidden = on;
  if (on) $('pauseCover').focus(); else $('bPause').focus({ preventScroll: true });
  snd(on ? 'pause' : 'go', on ? 330 : 440, .08, 'triangle', .04, on ? -110 : 220);
}
/* Every frame: the coin counter rolls toward the real total and the wave button fills as raiders fall. */
/* The boss bar and the banners, every frame. */
let banShown = null;
function bossHud() {
  const boss = foes.find(f => f.type === 'boss' && f.hp > 0), bar = $('bossbar');
  bar.hidden = !boss;
  if (boss) {
    $('bossName').textContent = bossName(); $('bossNote').textContent = boss.air ? (boss.rage ? 'full throttle' : 'Tesla and drones only') : boss.rage ? 'full steam' : boss.ph1 ? 'crew off' : 'stop it before the vault';
    $('bossHp').textContent = fmt(Math.max(0, boss.hp)); $('bossFill').style.width = Math.max(0, boss.hp / boss.max) * 100 + '%';
    if (boss.flash > 0 && !bar.classList.contains('hit')) { bar.classList.add('hit'); setTimeout(() => bar.classList.remove('hit'), 180); }
  }
  const b = FXS.banner, el = $('banner');
  if (b && !paused && b !== banShown) { banShown = b; el.className = 'banner' + (b.gold ? ' gold' : '') + (b.boss || b.enter || (S.wave % 10 === 0 && !b.gold) ? ' boss' : '') + (b.enter ? ' enter' : ''); $('banA').textContent = b.a; $('banB').textContent = b.b || ''; $('banB').hidden = !b.b; el.hidden = false; }
  if (b && b.t < .35 && !el.classList.contains('out')) el.classList.add('out');
  if (!b && !el.hidden) { el.hidden = true; banShown = null; }
}
function tickHud(dt) {
  bossHud(); tutTick();
  document.body.classList.toggle('cine', FXS.bossCam > .35 && !REDUCED && !paused && !CAPV.on); // cinema bars while the boss rides in
  if (shownCoins === null || REDUCED || !isFinite(shownCoins)) shownCoins = S.coins;
  shownCoins += (S.coins - shownCoins) * Math.min(1, dt * 9); if (Math.abs(S.coins - shownCoins) < .5) shownCoins = S.coins;
  const t = fmt(shownCoins); if (t !== coinTxt) { coinTxt = t; $('hCoins').textContent = t; }
  const p = W.active && W.total ? Math.round(100 * Math.max(0, 1 - (W.queue.length + foes.length) / W.total)) + '%' : '0%';
  if (p !== waveP) { waveP = p; $('bWave').style.setProperty('--p', p); }
}
function frame(now) {
  const dt = Math.min(OFFLINE_CAP, Math.max(0, (now - prev) / 1000)); prev = now;
  if (!paused) {
    econTowns(dt); // every town produces; only this one has waves (and they wait while the title is up)
    if (TITLE.on) TITLE.t += Math.min(dt, .1);
    else { let cdt = Math.min(dt, .1) * S.speed; while (cdt > 0) { const s = Math.min(cdt, .05); combat(s); cdt -= s; } S.stats.played += Math.min(dt, 1); }
    playT += Math.min(dt, .1); cosmetics(Math.min(dt, .1), playT); sampleIncome(Math.min(dt, 1));
    if (S.bestRate === undefined || INC.samples.length > 30) S.bestRate = Math.max(S.bestRate || 0, liveIncome());
  }
  // the 30 fps setting keeps the simulation running every frame but draws every other one or so (saves battery)
  const cap = GX().fps === 30 ? 1 / 31 : 0; drawAcc += dt;
  if (drawAcc >= cap) { if (R3.on) r3Render(playT); drawAcc = cap ? drawAcc % cap : 0; fpsN++; }
  tickHud(Math.min(dt, .1));
  MUSIC.want = TITLE.on ? 'title' : foes.some(f => f.type === 'boss' && f.hp > 0) ? 'boss' : 'town'; try { musicTick(); } catch (e) {}
  fpsT += dt; if (fpsT >= .5) { const el = $('fpsMeter'); if (el) { el.hidden = !GX().fpsShow; el.textContent = Math.round(fpsN / fpsT) + ' fps'; } fpsT = 0; fpsN = 0; }
  // if lighting makes a device struggle (well under 30 frames a second for several seconds), drop to simple graphics
  // a device that struggles (well under 30 frames a second for several seconds) gets a lower graphics preset
  if (R3.on && !PERF.noAuto && !document.hidden && dt > 0 && dt < .5) {
    PERF.frames++; if (dt > 1 / 24) PERF.slow++;
    if (PERF.frames >= 240) { if (PERF.slow > 170 && GX().preset !== 'low') { setGx('preset', GX().preset === 'ultra' || GX().preset === 'high' ? 'med' : 'low'); say('Lowered the graphics quality to keep the game smooth. Change it any time with the gear button.'); } PERF.frames = PERF.slow = 0; }
  }
  uiT -= dt; if (uiT <= 0) { uiT = .2; refresh(); }
  if (toastT > 0 && (toastT -= dt) <= 0) $('toast').classList.remove('show');
  saveT += dt; if (saveT > 10) { saveT = 0; save(); }
  requestAnimationFrame(frame);
}
function start(data) {
  paintSprites(); paintSprites2(); paintSprites3(); paintSprites4(); paintSprites5(); setMap('gulch');
  if (!(data && data.S && adopt(data.S))) load();
  checkBadges(true); applyMotion(); protectSave();
  const away = Math.min(OFFLINE_CAP, Math.max(0, (Date.now() - S.last) / 1000));
  buildFixed(); fit(); applyGfx(); window.addEventListener('resize', fit);
  if (window.ResizeObserver) new ResizeObserver(() => { if (Math.abs(cv.clientWidth * renderScale() - cv.width) > 2 || (R3.on && Math.abs(cv.clientHeight * renderScale() - cv.height) > 2)) fit(); }).observe(cv);
  let gains = null, earned = 0;
  if (away > 60) {
    const before = S.life, r0 = Object.assign({}, S.res); econTowns(away);
    gains = {}; for (const k in ITEMS) gains[k] = S.res[k] - r0[k]; earned = S.life - before;
  }
  // what follows the title screen: the news, the tutorial, the welcome back (only for the empire it was earned in)
  const later = kind => {
    announceVersion();
    if (kind === 'new') { setTimeout(tutOffer, 700); return; }
    if (kind === 'swap') { say(slotSwapNote()); return; }
    if (S.tut === undefined && !S.towers.length && !S.charters && !Object.keys(S.towns).length) setTimeout(tutOffer, 900); else if (S.tut === undefined) S.tut = 'done'; // a brand-new game is offered the tutorial
    else if (typeof S.tut === 'number') setTimeout(tutShow, 900);
    if (S.movedNote) { const n = S.movedNote; delete S.movedNote; setTimeout(() => say(n), 1500); }
    if (gains) welcome(away, earned, gains);
    else if (!S.life && !S.towers.length) say('Tap a plot beside the road to build a crossbow. Hold the trees and rocks to gather. Raiders arrive in 30 seconds.');
  };
  if (data && data.S) later('continue'); else showTitle(later); // a live reload while developing skips the title
  for (const ev of ['pointerdown', 'keydown', 'touchend', 'click']) document.addEventListener(ev, musicStart, { capture: true, passive: true }); // sound may only start after a tap
  document.addEventListener('visibilitychange', () => { musicSleep(document.hidden); if (document.hidden) { if (S.opt.autoPause) setPaused(true); save(); } });
  window.addEventListener('pagehide', save);
  if (document.fonts && document.fonts.load) document.fonts.load('20px Rye').catch(() => {});
  prev = performance.now(); refresh(); requestAnimationFrame(frame);
}
/* =========================================================
   Installing as an app, updates and keeping the save safe
   ========================================================= */
const GAME_VERSION = '2026.11.16-8'; // set by scripts/bump-version.js, together with sw.js and version.json
const GAME_NEWS = 'American spelling throughout: Defense, Aluminum, Armored train, Color grading';
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
      // reload when an update takes over; the very first install taking control of a new visitor's page is not an update
      const hadController = !!navigator.serviceWorker.controller; let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading || !hadController) return; reloading = true; location.reload(); });
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
const hot = window.claude && window.claude.hot;
if (hot && hot.snapshot) hot.snapshot(() => { save(); return { S }; });
if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
