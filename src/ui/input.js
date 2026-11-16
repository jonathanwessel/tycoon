'use strict';
/* =========================================================
   Interface: map taps
   Taps become map cells (gridAt); trees and rocks gather while held; a tap selects a building, tower,
   plot or the vault, or moves a rally point.
   ========================================================= */
/* Map taps */
function gridAt(ev) { return R3.on ? r3Pick(ev) : [-9, -9]; } // a tap as fractional map cells [x, y] (off the map until the 3D view is up)
function slotAt(gx, gy) { if (gy >= YARD) return null; const sx = Math.floor(gx / 2) * 2, sy = Math.floor(gy / 2) * 2; return Object.keys(SLOT).find(k => SLOT[k][0] === sx && SLOT[k][1] === sy); }
let holdT = null;
const stopHold = () => { clearInterval(holdT); holdT = null; };
cv.addEventListener('click', e => { if (SHEET.open && !docked()) { closeSheet(); e.stopImmediatePropagation(); } }, true);
cv.addEventListener('pointerdown', ev => {
  if (SHEET.open && !docked()) return;
  const [gx, gy] = gridAt(ev), id = slotAt(gx, gy);
  if (id !== 'trees' && id !== 'rocks') return;
  gather(id); stopHold(); holdT = setInterval(() => gather(id), 170);
});
for (const e of ['pointerup', 'pointercancel', 'pointerleave']) cv.addEventListener(e, stopHold);
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('click', ev => {
  const [gx, gy] = gridAt(ev);
  if (rallyFor) { const t = rallyFor; rallyFor = null; if (setRally(t, Math.floor(gx), Math.floor(gy))) { say('Rally point moved.'); snd('tab', 660, .05, 'square', .02, 200); } else say('That is not a road cell inside the barracks\' reach.'); return; }
  if (gy < YARD) {
    const id = slotAt(gx, gy);
    if (id === 'trees' || id === 'rocks') return;
    if (id === 'market' || id === 'caravan') { sel = null; return goTab('market'); }
    if (id === 'office') { sel = null; return goTab('charter'); }
    if (id === 'hall') { sel = null; goTab('works'); return say('Hire a foreman for any building with the foreman button next to it. They keep upgrading it for you. Each foreman after the first two costs more.'); }
    const b = BY_ID[id]; if (b) sel = sel && sel.b === b ? null : { b }; return;
  }
  const c = Math.floor(gx), rw = Math.floor(gy), t = S.towers.find(t => t.c === c && t.r === rw);
  if (t) { sel = sel && sel.t === t ? null : { t }; return; }
  if (c === VAULT[0] && rw === VAULT[1]) { sel = sel && sel.vault ? null : { vault: 1 }; return; }
  if (onRoad(c, rw)) { sel = null; FXS.badCell = { x: c, y: rw, t: .9 }; return say('Towers go beside the road, not on it.'); }
  sel = sel && sel.plot && sel.plot[0] === c && sel.plot[1] === rw ? null : { plot: [c, rw] };
});
cv.addEventListener('click', () => refresh()); // show the card at once instead of on the next UI tick
let hov = null;
cv.addEventListener('pointermove', ev => { if (ev.pointerType === 'mouse') hov = gridAt(ev); });
cv.addEventListener('pointerleave', () => { hov = null; });
