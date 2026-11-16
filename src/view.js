'use strict';
/* =========================================================
   The view: the 3D town and everything the rest of the game asks of it.
   The town is drawn by the three.js renderer in src/r3d/ (an ES module that loads after these scripts and registers
   window.R3D). This file owns the map element (#cv, a transparent layer that takes the taps and gestures), the
   layout size and render scale, the graphics settings, the lights the scene uses (sun, sky, lamps and fires), the
   camera and its controls, turning taps into map cells, projecting world points to the screen, and the overlay
   (levels, health bars, floating numbers) drawn on a canvas above the 3D one.
   ========================================================= */
const cv = document.getElementById('cv'); let cell = 30;
const renderScale = () => { const rs = GX().res || 1; return Math.max(.5, Math.min((window.devicePixelRatio || 1) * rs, rs > 1 ? 3 : 2)); };
const TREES = [[.5, .75, 1.15], [1.45, .65, 1.25], [.95, 1.45, 1.2]]; // the tap area's trees (or boulders): x, y, size within its plot
/* Frame-time watch: a device that struggles for several seconds gets a lower graphics preset. */
const PERF = { frames: 0, slow: 0, noAuto: false, res: null };
const MAXL = 48; // at most this many lamps and fires are gathered each frame (the renderer lights the strongest)
/* Size the map layer (and the 3D canvases) to the screen. */
function fit() {
  if (typeof layoutVars === 'function') layoutVars();
  const dpr = renderScale(); cv.width = Math.round((cv.clientWidth || 360) * dpr); cv.height = Math.round((cv.clientHeight || 420) * dpr);
  cell = Math.min(cv.width / COLS, cv.height / ROWS); // the overlay's text and bars size from this
  r3Resize();
}
/* A phone can take the 3D view's graphics memory away at any time (the app sent to the background, or short of
   memory), which leaves an empty screen behind the menus. The sure way to rebuild every model, texture and render
   target is to save and reload, straight back into the game (no title screen). That happens when the browser hands
   the context back, or 3 seconds after the page is visible again if it does not. Three reloads within two minutes
   mean something is wrong with the device: then say so, with a button to try again, instead of looping. */
const CTX_KEY = 'copper-gulch-ctx';
function ctxRecent() { try { const t = Date.now(); return (JSON.parse(sessionStorage.getItem(CTX_KEY)) || []).filter(x => t - x < 120000); } catch (e) { return []; } }
function ctxReload() {
  if (!document.hidden && CTX.gone) {
    const r = ctxRecent();
    if (r.length >= 3) { $('loading3d').hidden = true; $('no3d').hidden = false; $('no3d').querySelector('b').textContent = 'The 3D view stopped'; $('no3d').querySelector('span').textContent = 'This device keeps taking the graphics memory away. Close other apps, or lower the graphics preset in Settings, then reload.'; return; }
    try { r.push(Date.now()); sessionStorage.setItem(CTX_KEY, JSON.stringify(r)); sessionStorage.setItem(CTX_KEY + '-resume', '1'); } catch (e) {}
    save(); location.reload();
  }
}
const CTX = { gone: false };
window.ctxLost = () => { CTX.gone = true; R3.on = false; R3.ok = false; $('loading3d').hidden = false; clearTimeout(window.ctxLost.t); window.ctxLost.t = setTimeout(ctxWait, 3000); };
window.ctxBack = () => { clearTimeout(window.ctxLost.t); ctxWait(); };
function ctxWait() { if (document.hidden) document.addEventListener('visibilitychange', () => setTimeout(ctxReload, 300), { once: true }); else ctxReload(); }
/* Graphics settings: start the 3D view (or say why it cannot), apply scanlines and the render scale. */
function applyGfx() {
  const g = GX();
  R3.on = r3Setup();
  if (R3.canvas) { R3.canvas.hidden = !R3.on; R3.ux.canvas.hidden = !R3.on; }
  $('loading3d').hidden = R3.on || R3.tried; $('no3d').hidden = R3.on || !R3.tried;
  const mw = document.querySelector('.mapwrap'); if (mw) mw.classList.toggle('scan', !!g.scan);
  if (cv.width && PERF.res !== g.res) { PERF.res = g.res; fit(); }
  PERF.slow = 0; PERF.frames = 0;
}
function setGx(k, v) {
  const g = GX();
  if (k === 'preset') { Object.assign(g, GX_PRESETS[v]); g.preset = v; }
  else { g[k] = v; if (k in GX_PRESETS.high) g.preset = Object.keys(GX_PRESETS).find(p => Object.keys(GX_PRESETS[p]).every(q => GX_PRESETS[p][q] === g[q])) || 'custom'; }
  applyGfx();
}
/* --- light: every lamp and fire this frame (the 3D renderer turns the strongest into point lights) --------------- */
function gatherLights(time) {
  const L = [], n = FXS.night, add = (x, y, r, col, k) => { if (k > .02) L.push([x, y, r, col, k]); };
  const WARM = [1, .64, .32], LAMP = [1, .78, .48], TEAL = [.35, .95, .9], ICE = [.55, .9, 1], GOLD = [1, .85, .35], PINK = [1, .38, .5], FIRE = [1, .5, .18];
  const lamp = .12 + .88 * n;
  for (const [tx, ty] of [[VAULT[0] - .08, VAULT[1] - .05], [VAULT[0] - .08, VAULT[1] + 1.25]]) add(tx, ty - .35, 2.4, WARM, (.35 + .75 * n) * (.9 + Math.sin(time * 9 + ty) * .1));
  for (const b of BUILD) if (blv(b.def.id)) { const [sx, sy] = SLOT[b.def.id]; add(sx + 1, sy + 1.75, 1.35, LAMP, .5 * lamp * (.92 + Math.sin(time * 3 + sx) * .08)); }
  for (const id of ['market', 'hall', 'office']) add(SLOT[id][0] + 1, SLOT[id][1] + 1.75, 1.35, LAMP, .45 * lamp);
  for (const id of TOWN.forge) if (blv(id) && ACT[id] > .08) add(SLOT[id][0] + 1, SLOT[id][1] + 1.25, 2, FIRE, (.3 + .7 * n) * (.85 + Math.sin(time * 13 + SLOT[id][0]) * .15));
  for (const id of TOWN.glow) if (blv(id)) add(SLOT[id][0] + 1, SLOT[id][1] + 1.5, 1.4, TEAL, .55 * lamp);
  for (const t of S.towers) {
    const x = t.c + .5, y = t.r + .5, kick = t.kick > 0 ? t.kick / .12 : 0;
    if (t.type === 'frost') add(x, y - .25, 1.6, ICE, .3 + .5 * n);
    else if (t.type === 'tesla') add(x, y - .45, 1.8 + kick, t.br === 'b' ? PINK : GOLD, .35 + .55 * n + kick * .8);
    else if (kick > 0) add(x + Math.cos(t.aim || 0) * .55, y + Math.sin(t.aim || 0) * .55 - .15, 1.7, WARM, kick * 1.3);
  }
  for (const s of shots.slice(0, 14)) add(s.x + .5, s.y + .5, .9, s.kind === 'ball' ? FIRE : LAMP, .45 + .3 * n);
  for (const e of fx) {
    if (e.k === 'boom') add(e.x + .5, e.y + .5, e.r * 2.6 + 1, FIRE, 2.2 * Math.min(1, e.t * 4));
    else if (e.k === 'bolt') { const p = e.pts[e.pts.length - 1]; add(p[0] + .5, p[1] + .5, 1.6, e.c === '#ff8fb0' ? PINK : GOLD, 1.4 * e.t / .16); }
    else if (e.k === 'ring') add(e.x + .5, e.y + .5, e.r * 1.1, ICE, .6 * Math.min(1, e.t * 3));
    else if (e.k === 'cone') add(e.x + .5 + Math.cos(e.a) * .8, e.y + .5 + Math.sin(e.a) * .8, 2, WARM, 1.4 * e.t / .18);
  }
  for (const b of bombs) add(b.x + .5, b.y + .2, 1, FIRE, .9);
  for (const f of foes) if (f.rage) add(f.x + .5, f.y + .3, 1.3, FIRE, .7);
  if (FXS.flies && n > .05 && !REDUCED) for (const q of FXS.flies) add(q.x, q.y, .6, [.75, 1, .45], .7 * n * (.5 + .5 * Math.sin(time * 3 + q.ph)));
  L.sort((a, b) => b[4] * b[2] - a[4] * a[2]);
  return L.slice(0, MAXL);
}
function sceneLight(time) {
  const n = Math.min(1, FXS.night), dusk = Math.sin(Math.PI * n), wa = FXS.wxA || 0, wk = FXS.wxK;
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  // night stays readable (raiders must be visible on the road); dusk passes through a warm sunset
  let amb = mix([1, .98, .93], [.4, .42, .64], n);
  amb = mix(amb, [1.02, .66, .46], dusk * .55);
  const tint = wk === 'rain' ? [.74, .8, .94] : wk === 'dust' ? [1.06, .9, .72] : wk === 'heat' ? [1.08, .97, .84] : wk === 'moon' ? [1.05, 1.1, 1.3] : [1, 1, 1];
  amb = amb.map((v, i) => v * (1 + (tint[i] - 1) * wa));
  const sunK = (1 - n) * (wk === 'rain' ? 1 - .65 * wa : wk === 'dust' ? 1 - .45 * wa : 1);
  return { n, dusk, wa, wk, amb, sunK, az: Math.sin(time * .012) * .9 };
}
/* --- the 3D bridge ----------------------------------------------------------------------------------------- */
/* Visiting the Capital: the 3D view draws the capital city instead of the town (the town plays on meanwhile). */
const CAPV = { on: false };
const R3 = { on: false, ok: false, tried: false, yaw: 0, yawT: 0, pitch: .92, dist: 24, distT: 24, dragged: false, panX: 0, panZ: 0, panXT: 0, panZT: 0, vx: 0, vy: 0 };
const M4 = {
  mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
  persp(fy, asp, n, f) { const t = 1 / Math.tan(fy / 2), o = new Float32Array(16); o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o; },
  look(e, t, u) {
    const z = norm([e[0] - t[0], e[1] - t[1], e[2] - t[2]]), x = norm(cross(u, z)), y = cross(z, x), o = new Float32Array(16);
    o[0] = x[0]; o[4] = x[1]; o[8] = x[2]; o[1] = y[0]; o[5] = y[1]; o[9] = y[2]; o[2] = z[0]; o[6] = z[1]; o[10] = z[2];
    o[12] = -dot(x, e); o[13] = -dot(y, e); o[14] = -dot(z, e); o[15] = 1; return o;
  },
};
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

/* Start the 3D renderer. Until its module has loaded this answers no without giving up, and the module switches the
   view on when it arrives. */
function r3Setup() {
  if (R3.ok) return true;
  if (!window.R3D) return false;
  if (R3.tried) return false; R3.tried = true;
  try {
    const c = R3D.setup(); if (!c) return false;
    cv.after(c); R3.canvas = c;
    const u = document.createElement('canvas'); u.id = 'g3u'; u.setAttribute('aria-hidden', 'true'); c.after(u); R3.ux = u.getContext('2d');
    R3.ok = true; r3Resize();
  } catch (e) { console.warn('3D view unavailable:', e.message); R3.ok = false; }
  return R3.ok;
}
function r3Resize() {
  if (!R3.ok) return; const W = cv.width, H = cv.height; if (!W) return;
  R3.canvas.width = W; R3.canvas.height = H; R3.ux.canvas.width = W; R3.ux.canvas.height = H; R3D.resize(W, H);
}

/* --- camera ------------------------------------------------------------------------------------------------- */
function r3Camera() {
  const W = R3.canvas.width, H = R3.canvas.height, fov = .62, asp = W / H, th = Math.tan(fov / 2);
  // R3.dist is a zoom (24 = the whole board); the real distance makes the board fit this screen's width and height
  // a boss riding in: the camera leans toward it and closes in a little (bossCamK in fx.js), then eases back
  const bk = !R3.look && !(typeof CAPV !== 'undefined' && CAPV.on) && typeof bossCamK === 'function' ? bossCamK() : 0, boss = bk > 0 && foes.find(f => f.type === 'boss' && f.hp > 0);
  R3.bk = (R3.bk || 0) + ((boss ? bk : 0) - (R3.bk || 0)) * .2; if (R3.bk < .001) R3.bk = 0;
  if (boss) { R3.bx = Math.max(1, Math.min(COLS - 1, boss.x + .5)); R3.bz = Math.max(YARD + 1.5, Math.min(ROWS - 1, boss.y + .5)); }
  const fitD = Math.max(24, (COLS / 2 + .7) / (th * asp), 8.2 / th), dist = R3.dist * fitD / 24 * (1 - .3 * R3.bk);
  // with a menu sheet open on a phone, look further down the board so the town shows above the sheet
  R3.shift = (R3.shift || 0) + (((typeof SHEET !== 'undefined' && SHEET.open) ? SHEET.h * dist * .38 : 0) - (R3.shift || 0)) * .15;
  // with a plot or tower selected on a phone, glide so it sits in the upper part of the screen, above its card
  const fc = typeof sel !== 'undefined' && sel && (sel.plot || (sel.t && [sel.t.c, sel.t.r]) || (sel.site && [CAP_SITE[sel.site].x - .5, CAP_SITE[sel.site].z + 1 - dist * .2])), phone = typeof docked === 'function' && !docked();
  R3.fx = (R3.fx || 0) + (((fc && phone) ? fc[0] + .5 - (COLS / 2 + R3.panX) : 0) - (R3.fx || 0)) * .12;
  R3.fz = (R3.fz || 0) + (((fc && phone) ? fc[1] + .5 + dist * .2 - (ROWS / 2 + .6 + R3.panZ) : 0) - (R3.fz || 0)) * .12;
  const tgt = R3.look ? [R3.look[0], 0, R3.look[1]] : [COLS / 2 + R3.panX + R3.fx, 0, ROWS / 2 + .6 + R3.shift + R3.panZ + R3.fz]; // R3.look: aim somewhere else (the icon renderer)
  if (R3.bk) { const k = R3.bk * .75; tgt[0] += (R3.bx - tgt[0]) * k; tgt[2] += (R3.bz - tgt[2]) * k; }
  let eye = [tgt[0] + Math.sin(R3.yaw) * Math.cos(R3.pitch) * dist, Math.sin(R3.pitch) * dist, tgt[2] + Math.cos(R3.yaw) * Math.cos(R3.pitch) * dist];
  // the title screen: a slow, low flyover circling the town; leaving it glides back to the playing view (R3.tk eases in r3Render)
  const tk = R3.tk > .001 && !R3.look ? R3.tk * R3.tk * (3 - 2 * R3.tk) : 0;
  if (tk) {
    const t = typeof TITLE !== 'undefined' ? TITLE.t : 0, mv = REDUCED ? 0 : 1, yaw = .35 + mv * t * .045, pitch = .53 + mv * .06 * Math.sin(t * .11), d = fitD * (.72 + mv * .07 * Math.sin(t * .07));
    const tt = [COLS / 2 + mv * 1.2 * Math.sin(t * .05), .4, ROWS / 2 - .6 + mv * 1.6 * Math.sin(t * .037)];
    const te = [tt[0] + Math.sin(yaw) * Math.cos(pitch) * d, Math.sin(pitch) * d, tt[2] + Math.cos(yaw) * Math.cos(pitch) * d];
    for (let i = 0; i < 3; i++) { eye[i] += (te[i] - eye[i]) * tk; tgt[i] += (tt[i] - tgt[i]) * tk; }
  }
  const V = M4.look(eye, tgt, [0, 1, 0]), Pm = M4.persp(fov, W / H, .5, 200);
  R3.cam = { eye, tgt, fov, asp: W / H, VP: M4.mul(Pm, V) };
  return R3.cam;
}
/* The ray under a tap: the eye and the ray's direction. */
function r3Ray(ev) {
  const r = cv.getBoundingClientRect(), nx = ((ev.clientX - r.left - cv.clientLeft) / cv.clientWidth) * 2 - 1, ny = 1 - ((ev.clientY - r.top - cv.clientTop) / cv.clientHeight) * 2;
  const { eye, tgt, fov, asp } = R3.cam || r3Camera(), f = norm([tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]]), rt = norm(cross(f, [0, 1, 0])), up = cross(rt, f), th = Math.tan(fov / 2);
  const d = norm([f[0] + rt[0] * nx * th * asp + up[0] * ny * th, f[1] + rt[1] * nx * th * asp + up[1] * ny * th, f[2] + rt[2] * nx * th * asp + up[2] * ny * th]);
  return { eye, d };
}
/* A tap on the canvas, as fractional map cells [x, y] like gridAt() returns: cast a ray to the ground (y = 0). */
function r3Pick(ev) { const { eye, d } = r3Ray(ev), t = (.1 - eye[1]) / d[1]; return [eye[0] + d[0] * t, eye[2] + d[2] * t]; }
/* In the Capital: the site (the Capitol or an institution) under a tap, roofs included, or null. */
function capPick(ev) { if (!R3.on) return null; const { eye, d } = r3Ray(ev); return capRay(eye, d); }
/* Screen pixel of a world point, for the overlay. */
function r3Project(x, y, z) {
  const m = R3.cam.VP, cx_ = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], w = m[3] * x + m[7] * y + m[11] * z + m[15];
  return [(cx_ / w * .5 + .5) * R3.canvas.width, (1 - (cy / w * .5 + .5)) * R3.canvas.height, w];
}
// camera controls. Phones: one finger drags the town, two fingers pinch to zoom and twist to turn. Mouse: drag pans,
// right-drag or Shift-drag turns, the wheel zooms. A double tap resets. Panning glides to a stop; the board never leaves
// the screen. A drag never counts as a tap.
(() => {
  let down = null; const pts = new Map(); let two = null;
  const clampPan = () => { R3.panXT = Math.max(-COLS * .55, Math.min(COLS * .55, R3.panXT)); R3.panZT = Math.max(-ROWS * .6, Math.min(ROWS * .6, R3.panZT)); };
  // move the target so the ground under the pointer follows it
  const pan = (dx, dy) => {
    const cam = R3.cam || r3Camera(), H = cv.clientHeight || 600, dist = Math.hypot(cam.eye[0] - cam.tgt[0], cam.eye[1] - cam.tgt[1], cam.eye[2] - cam.tgt[2]);
    const k = 2 * dist * Math.tan(cam.fov / 2) / H, c = Math.cos(R3.yaw), s = Math.sin(R3.yaw), ky = k / Math.max(.4, Math.sin(R3.pitch));
    R3.panXT += -dx * k * c - dy * ky * s; R3.panZT += dx * k * s - dy * ky * c; clampPan();
  };
  R3.panBy = pan; // the controller's right stick
  cv.addEventListener('pointerdown', e => {
    if (!R3.on) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, turn: e.button === 2 || e.shiftKey, vx: 0, vy: 0, t: performance.now() };
    if (pts.size === 2) { const [a, b] = [...pts.values()]; two = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), a: Math.atan2(b[1] - a[1], b[0] - a[0]), mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 }; if (down) down.moved = true; }
    R3.vx = R3.vy = 0;
  });
  cv.addEventListener('pointermove', e => {
    if (!R3.on || !down || !pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2 && two) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      R3.distT = Math.max(9, Math.min(36, R3.distT * two.d / d)); let da = ang - two.a; da = Math.atan2(Math.sin(da), Math.cos(da)); R3.yawT -= da; pan(mx - two.mx, my - two.my);
      two = { d, a: ang, mx, my }; down.moved = true; stopHold(); FXS.bossCam = 0; return;
    }
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8 && !down.moved) { down.moved = true; stopHold(); FXS.bossCam = 0; }
    if (!down.moved) return;
    const dx = e.clientX - down.lx, dy = e.clientY - down.ly, now = performance.now(), dt = Math.max(1, now - down.t);
    if (down.turn) R3.yawT -= dx / cv.clientWidth * 3; else { pan(dx, dy); down.vx = dx / dt; down.vy = dy / dt; }
    down.lx = e.clientX; down.ly = e.clientY; down.t = now;
  });
  const up = e => {
    pts.delete(e.pointerId); if (pts.size < 2) two = null;
    if (down && down.moved) { R3.dragged = true; if (!down.turn && !pts.size) { R3.vx = down.vx; R3.vy = down.vy; R3.glide = pan; } }
    if (!pts.size) down = null;
  };
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) cv.addEventListener(ev, up);
  cv.addEventListener('click', e => { if (R3.dragged) { R3.dragged = false; e.stopImmediatePropagation(); } }, true);
  cv.addEventListener('wheel', e => { if (!R3.on) return; e.preventDefault(); FXS.bossCam = 0; R3.distT = Math.max(9, Math.min(36, R3.distT * (1 + Math.sign(e.deltaY) * .1))); }, { passive: false });
  cv.addEventListener('dblclick', () => { if (R3.on) { R3.yawT = 0; R3.distT = 24; R3.panXT = R3.panZT = 0; } });
})();

/* --- drawing a frame ---------------------------------------------------------------------------------------- */
function r3Render(time) {
  const tOn = typeof TITLE !== 'undefined' && TITLE.on; R3.tk = REDUCED ? (tOn ? 1 : 0) : (R3.tk || 0) + ((tOn ? 1 : 0) - (R3.tk || 0)) * (tOn ? .1 : .035); if (R3.tk < .002) R3.tk = 0;
  R3.yaw += (R3.yawT - R3.yaw) * .15; R3.dist += (R3.distT - R3.dist) * .15;
  if (R3.glide && Math.hypot(R3.vx, R3.vy) > .02) { R3.glide(R3.vx * 16, R3.vy * 16); R3.vx *= .9; R3.vy *= .9; } // a flick glides to a stop
  R3.panX += (R3.panXT - R3.panX) * .3; R3.panZ += (R3.panZT - R3.panZ) * .3;
  const cam = r3Camera(); R3.ux.canvas.hidden = R3.canvas.hidden;
  R3D.render(time, cam);
  r3Overlay(time);
}
/* Flat things projected from 3D: building levels, raider health, floating numbers; then the shared HUD. */
function r3Overlay(time) {
  const ux = R3.ux, c = cell, W = R3.canvas.width; ux.clearRect(0, 0, W, R3.canvas.height);
  if (R3.tk > .3) return; // the title flyover shows the town without labels
  ux.textAlign = 'center'; ux.textBaseline = 'middle'; ux.font = '700 ' + Math.max(9, c * .28) + 'px "Barlow Semi Condensed", sans-serif';
  const tag = (txt, x, y, z, col) => { const [px, py, w] = r3Project(x, y, z); if (w <= 0) return; const tw = ux.measureText(txt).width + c * .14; ux.fillStyle = 'rgba(22,26,42,.85)'; ux.fillRect(px - tw / 2, py - c * .16, tw, c * .32); ux.fillStyle = col || '#ece6d8'; ux.fillText(txt, px, py + 1); };
  if (CAPV.on) { // the Capital: a sign over each site, its level or what building it costs
    for (const id in CAP_SITE) { const s = CAP_SITE[id], l = id === 'capitol' ? 0 : capLv(id), ready = id !== 'capitol' && l < INST[id].max && S.coins >= instCost(id);
      tag(s.n + (id === 'capitol' ? '' : l ? ' · Lv ' + l : ' · build'), s.x, s.h * (id === 'capitol' ? 1.02 : .95) + .2, s.z, ready ? '#f2d04a' : l || id === 'capitol' ? null : '#b9b2a4'); }
    return;
  }
  for (const b of BUILD) { const l = blv(b.def.id), [sx, sy] = SLOT[b.def.id]; if (l) tag('Lv ' + l, sx + 1, 2.05, sy + 1); }
  if (SLOT.hall) tag('Foremen', SLOT.hall[0] + 1, 2.05, SLOT.hall[1] + 1); if (SLOT.office) tag(S.deeds ? S.deeds + ' deeds' : 'Deeds', SLOT.office[0] + 1, 2.05, SLOT.office[1] + 1, S.deeds ? '#f2d04a' : null);
  // the selected plot or tower, and its reach
  if (sel && (sel.plot || sel.t)) {
    const [pc, pr] = sel.plot || [sel.t.c, sel.t.r], reach = sel.t ? (TOWERS[sel.t.type].drone ? droneStats(sel.t).range : towerStats(sel.t).range) : TOWERS[GHOST.type || 'crossbow'].range;
    ux.strokeStyle = 'rgba(255,240,160,.8)'; ux.lineWidth = Math.max(1, c * .05); ux.setLineDash([c * .14, c * .1]); ux.beginPath();
    for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2, [px, py] = r3Project(pc + .5 + Math.cos(a) * reach, .05, pr + .5 + Math.sin(a) * reach); i ? ux.lineTo(px, py) : ux.moveTo(px, py); }
    ux.stroke(); ux.setLineDash([]);
  }
  for (const q of troops) if (q.hp < q.max) { const [px, py, w] = r3Project(q.x + .5, .75, q.y + .5); if (w <= 0) continue; const bw = c * .4; ux.fillStyle = '#2a1c22'; ux.fillRect(px - bw / 2 - 1, py - 1, bw + 2, c * .07 + 2); ux.fillStyle = '#5b8bc0'; ux.fillRect(px - bw / 2, py, bw * Math.max(0, q.hp / q.max), c * .07); }
  for (const f of foes) if (f.hp < f.max && f.type !== 'boss') { const [px, py, w] = r3Project(f.x + .5, FOES[f.type].size + .25, f.y + .5); if (w <= 0) continue; const bw = c * .6; ux.fillStyle = '#2a1c22'; ux.fillRect(px - bw / 2 - 1, py - 1, bw + 2, c * .09 + 2); ux.fillStyle = '#f07067'; ux.fillRect(px - bw / 2, py, bw, c * .09); ux.fillStyle = '#7fd992'; ux.fillRect(px - bw / 2, py, bw * Math.max(0, f.hp / f.max), c * .09); }
  ux.lineJoin = 'round';
  for (const f of floats) { const [px, py, w] = r3Project(f.x, .9 + (1 - Math.min(1, f.t)) * .4, f.y); if (w <= 0) continue; ux.globalAlpha = Math.min(1, f.t * 3); ux.font = '700 ' + Math.max(9, f.z * c * (1 + .55 * Math.max(0, 1 - (f.a || 0) / .16))) + 'px "Barlow Semi Condensed", sans-serif'; ux.lineWidth = Math.max(2, c * .08); ux.strokeStyle = '#2a1c22'; ux.strokeText(f.s, px, py); ux.fillStyle = f.c; ux.fillText(f.s, px, py); }
  ux.globalAlpha = 1;
}
