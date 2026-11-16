'use strict';
/* =========================================================
   3D view bridge
   The 3D town is drawn by the three.js renderer in src/r3d/ (an ES module that loads after these scripts and
   registers window.R3D). This bridge owns what the rest of the game talks to: the camera and its controls, turning
   taps back into map cells, projecting world points to the screen, and the flat overlay (levels, health bars,
   floating numbers, the boss bar and banners) drawn on a canvas above the 3D one.
   ========================================================= */
const R3 = { on: false, ok: false, tried: false, yaw: 0, yawT: 0, pitch: .92, dist: 24, distT: 24, dragged: false };
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
  const fitD = Math.max(24, (COLS / 2 + .7) / (th * asp), 8.2 / th), dist = R3.dist * fitD / 24;
  // with a menu sheet open on a phone, look further down the board so the town shows above the sheet
  R3.shift = (R3.shift || 0) + (((typeof SHEET !== 'undefined' && SHEET.open) ? SHEET.h * dist * .38 : 0) - (R3.shift || 0)) * .15;
  const tgt = R3.look ? [R3.look[0], 0, R3.look[1]] : [COLS / 2, 0, ROWS / 2 + .6 + R3.shift]; // R3.look: aim somewhere else (the icon renderer)
  const eye = [tgt[0] + Math.sin(R3.yaw) * Math.cos(R3.pitch) * dist, Math.sin(R3.pitch) * dist, tgt[2] + Math.cos(R3.yaw) * Math.cos(R3.pitch) * dist];
  const V = M4.look(eye, tgt, [0, 1, 0]), Pm = M4.persp(fov, W / H, .5, 200);
  R3.cam = { eye, tgt, fov, asp: W / H, VP: M4.mul(Pm, V) };
  return R3.cam;
}
/* A tap on the canvas, as fractional map cells [x, y] like gridAt() returns: cast a ray to the ground (y = 0). */
function r3Pick(ev) {
  const r = cv.getBoundingClientRect(), nx = ((ev.clientX - r.left - cv.clientLeft) / cv.clientWidth) * 2 - 1, ny = 1 - ((ev.clientY - r.top - cv.clientTop) / cv.clientHeight) * 2;
  const { eye, tgt, fov, asp } = R3.cam || r3Camera(), f = norm([tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]]), rt = norm(cross(f, [0, 1, 0])), up = cross(rt, f), th = Math.tan(fov / 2);
  const d = norm([f[0] + rt[0] * nx * th * asp + up[0] * ny * th, f[1] + rt[1] * nx * th * asp + up[1] * ny * th, f[2] + rt[2] * nx * th * asp + up[2] * ny * th]);
  const t = (.1 - eye[1]) / d[1]; return [eye[0] + d[0] * t, eye[2] + d[2] * t];
}
/* Screen pixel of a world point, for the overlay. */
function r3Project(x, y, z) {
  const m = R3.cam.VP, cx_ = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], w = m[3] * x + m[7] * y + m[11] * z + m[15];
  return [(cx_ / w * .5 + .5) * R3.canvas.width, (1 - (cy / w * .5 + .5)) * R3.canvas.height, w];
}
// camera controls: drag to turn, wheel or pinch to zoom, double-tap to reset; a drag never counts as a tap
(() => {
  let down = null, pts = new Map(), pinch = 0;
  cv.addEventListener('pointerdown', e => { if (!R3.on) return; pts.set(e.pointerId, [e.clientX, e.clientY]); down = { x: e.clientX, y: e.clientY, yaw: R3.yawT, moved: false }; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
  cv.addEventListener('pointermove', e => {
    if (!R3.on || !down || !pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) R3.distT = Math.max(12, Math.min(34, R3.distT * pinch / d)); pinch = d; down.moved = true; return; }
    const dx = e.clientX - down.x; if (Math.abs(dx) > 8) { down.moved = true; stopHold(); }
    if (down.moved) R3.yawT = down.yaw - dx / cv.clientWidth * 3;
  });
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; if (down && down.moved) R3.dragged = true; if (!pts.size) down = null; };
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) cv.addEventListener(ev, up);
  cv.addEventListener('click', e => { if (R3.dragged) { R3.dragged = false; e.stopImmediatePropagation(); } }, true);
  cv.addEventListener('wheel', e => { if (!R3.on) return; e.preventDefault(); R3.distT = Math.max(12, Math.min(34, R3.distT * (1 + Math.sign(e.deltaY) * .1))); }, { passive: false });
  cv.addEventListener('dblclick', () => { if (R3.on) { R3.yawT = 0; R3.distT = 24; } });
})();

/* --- drawing a frame ---------------------------------------------------------------------------------------- */
function r3Render(time) {
  R3.yaw += (R3.yawT - R3.yaw) * .15; R3.dist += (R3.distT - R3.dist) * .15;
  const cam = r3Camera(); R3.ux.canvas.hidden = R3.canvas.hidden;
  R3D.render(time, cam);
  r3Overlay(time);
}
/* Flat things projected from 3D: building levels, raider health, floating numbers; then the shared HUD. */
function r3Overlay(time) {
  const ux = R3.ux, c = cell, W = R3.canvas.width; ux.clearRect(0, 0, W, R3.canvas.height);
  ux.textAlign = 'center'; ux.textBaseline = 'middle'; ux.font = '700 ' + Math.max(9, c * .28) + 'px "Barlow Semi Condensed", sans-serif';
  const tag = (txt, x, y, z, col) => { const [px, py, w] = r3Project(x, y, z); if (w <= 0) return; const tw = ux.measureText(txt).width + c * .14; ux.fillStyle = 'rgba(22,26,42,.85)'; ux.fillRect(px - tw / 2, py - c * .16, tw, c * .32); ux.fillStyle = col || '#ece6d8'; ux.fillText(txt, px, py + 1); };
  for (const b of BUILD) { const l = blv(b.def.id), [sx, sy] = SLOT[b.def.id]; if (l) tag('Lv ' + l, sx + 1, 2.05, sy + 1); }
  if (SLOT.hall) tag('Foremen', SLOT.hall[0] + 1, 2.05, SLOT.hall[1] + 1); if (SLOT.office) tag(S.deeds ? S.deeds + ' deeds' : 'Deeds', SLOT.office[0] + 1, 2.05, SLOT.office[1] + 1, S.deeds ? '#f2d04a' : null);
  // the selected plot or tower, and its reach
  if (sel && (sel.plot || sel.t)) {
    const [pc, pr] = sel.plot || [sel.t.c, sel.t.r], reach = sel.t ? towerStats(sel.t).range : 2.4;
    ux.strokeStyle = 'rgba(255,240,160,.8)'; ux.lineWidth = Math.max(1, c * .05); ux.setLineDash([c * .14, c * .1]); ux.beginPath();
    for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2, [px, py] = r3Project(pc + .5 + Math.cos(a) * reach, .05, pr + .5 + Math.sin(a) * reach); i ? ux.lineTo(px, py) : ux.moveTo(px, py); }
    ux.stroke(); ux.setLineDash([]);
  }
  { const bt = rallyFor || (sel && sel.t && TOWERS[sel.t.type].troops ? sel.t : null); if (bt && bt.rally) { const [px, py, w] = r3Project(bt.rally[0] + .5, 0, bt.rally[1] + .5), [qx, qy] = r3Project(bt.rally[0] + .5, .8, bt.rally[1] + .5); if (w > 0) { ux.fillStyle = '#2a1c22'; ux.fillRect(px - 2, qy, 4, py - qy); ux.fillStyle = '#5b8bc0'; ux.fillRect(px + 2, qy, c * .3, c * .2); } } }
  for (const q of troops) if (q.hp < q.max) { const [px, py, w] = r3Project(q.x + .5, .75, q.y + .5); if (w <= 0) continue; const bw = c * .4; ux.fillStyle = '#2a1c22'; ux.fillRect(px - bw / 2 - 1, py - 1, bw + 2, c * .07 + 2); ux.fillStyle = '#5b8bc0'; ux.fillRect(px - bw / 2, py, bw * Math.max(0, q.hp / q.max), c * .07); }
  for (const f of foes) if (f.hp < f.max && f.type !== 'boss') { const [px, py, w] = r3Project(f.x + .5, FOES[f.type].size + .25, f.y + .5); if (w <= 0) continue; const bw = c * .6; ux.fillStyle = '#2a1c22'; ux.fillRect(px - bw / 2 - 1, py - 1, bw + 2, c * .09 + 2); ux.fillStyle = '#f07067'; ux.fillRect(px - bw / 2, py, bw, c * .09); ux.fillStyle = '#7fd992'; ux.fillRect(px - bw / 2, py, bw * Math.max(0, f.hp / f.max), c * .09); }
  ux.lineJoin = 'round';
  for (const f of floats) { const [px, py, w] = r3Project(f.x, .9 + (1 - Math.min(1, f.t)) * .4, f.y); if (w <= 0) continue; ux.globalAlpha = Math.min(1, f.t * 3); ux.font = '700 ' + Math.max(9, f.z * c * (1 + .55 * Math.max(0, 1 - (f.a || 0) / .16))) + 'px "Barlow Semi Condensed", sans-serif'; ux.lineWidth = Math.max(2, c * .08); ux.strokeStyle = '#2a1c22'; ux.strokeText(f.s, px, py); ux.fillStyle = f.c; ux.fillText(f.s, px, py); }
  ux.globalAlpha = 1;
  const keep = cx; cx = ux; drawHUD(); cx = keep;
}
