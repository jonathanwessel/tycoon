'use strict';
/* =========================================================
   Gamepad: the parts that need no browser (dead zones, held-button repeat, the map cursor, picking the next button)
   The interface side (reading the pad each frame, what each button does) is src/ui/pad.js.
   ========================================================= */
const PAD = { on: false, show: false, cur: [5, 8], prev: {}, rep: {}, id: '', layer: 'map', want: false, inSheet: false, gT: 0, used: 0 };
// the standard layout (Xbox names; on other pads A is the bottom face button, B the right one)
const PAD_BTN = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, back: 8, start: 9, ls: 10, rs: 11, up: 12, down: 13, left: 14, right: 15 };
/* A stick axis with its dead zone removed, rescaled so just past the dead zone is 0 and full tilt is 1. */
function padDead(v, dz = .22) { const a = Math.abs(+v || 0); return a < dz ? 0 : Math.sign(v) * Math.min(1, (a - dz) / (1 - dz)); }
/* A stick as one of four directions (or '' near the middle). */
function padStickDir(x, y) { if (Math.hypot(x || 0, y || 0) < .5) return ''; return Math.abs(x) >= Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'down' : 'up'); }
/* A held direction fires when pressed, then after 0.36 s every 0.11 s. */
function padRepeat(key, down, now) {
  const r = PAD.rep; if (!down) { delete r[key]; return false; }
  if (r[key] === undefined) { r[key] = now + 360; return true; }
  if (now >= r[key]) { r[key] = now + 110; return true; }
  return false;
}
const PAD_DIR = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
/* The map cursor moves one cell in a screen direction: as the camera turns, "up" stays up the screen. Screen right is
   (cos yaw, -sin yaw) on the board and screen down (sin yaw, cos yaw), the same as dragging the map (view.js). */
function padStep(cur, dir, yaw = 0, cols = COLS, rows = ROWS) {
  const d = PAD_DIR[dir]; if (!d) return cur.slice();
  const c = Math.cos(yaw), s = Math.sin(yaw), wx = d[0] * c + d[1] * s, wz = -d[0] * s + d[1] * c;
  const [mx, mz] = Math.abs(wx) >= Math.abs(wz) ? [Math.sign(wx), 0] : [0, Math.sign(wz)];
  return [Math.max(0, Math.min(cols - 1, cur[0] + mx)), Math.max(0, Math.min(rows - 1, cur[1] + mz))];
}
/* Spatial focus: from rectangle a ({x, y, w, h}), the index of the best rectangle in list that lies in direction dir,
   or -1. Ahead means its centre is past a's centre; the score is the gap ahead plus a heavy cost for being off to the
   side (none while the two overlap on the other axis), so a button in the same row or column wins. */
function padNearest(a, list, dir) {
  const d = PAD_DIR[dir]; if (!d) return -1; const ax = a.x + a.w / 2, ay = a.y + a.h / 2; let best = -1, bs = Infinity;
  list.forEach((b, i) => {
    if (b === a) return; const bx = b.x + b.w / 2, by = b.y + b.h / 2, along = d[0] ? (bx - ax) * d[0] : (by - ay) * d[1];
    if (along < 4) return;
    const gap = d[0] ? Math.max(0, d[0] > 0 ? b.x - (a.x + a.w) : a.x - (b.x + b.w)) : Math.max(0, d[1] > 0 ? b.y - (a.y + a.h) : a.y - (b.y + b.h));
    const side = d[0] ? Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h)) : Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
    const off = d[0] ? Math.abs(by - ay) : Math.abs(bx - ax), sc = gap + side * 4 + off * .2;
    if (sc < bs) { bs = sc; best = i; }
  });
  return best;
}
/* Which buttons were pressed this frame (down now, up last frame), from a gamepad's buttons array. Also keeps the
   held state for the next frame. */
function padEdges(buttons) {
  const down = {}, hit = {};
  for (const k in PAD_BTN) { const x = buttons && buttons[PAD_BTN[k]]; down[k] = !!(x && (x.pressed || x.value > .5)); hit[k] = down[k] && !PAD.prev[k]; }
  PAD.prev = down; return { down, hit };
}
