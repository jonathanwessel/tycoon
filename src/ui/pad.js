'use strict';
/* =========================================================
   Interface: playing with a controller (the Gamepad API, read every frame while one is connected)
   On the map the left stick or the D-pad moves a cursor over the cells and A picks what is under it (hold A on the
   trees or rocks to gather). Wherever buttons are showing (a card, the menu sheet, Settings, the title screen) the
   D-pad moves between them and A presses one; B goes back. X calls the wave, Y opens or closes the menu, LB and RB
   change tab, Start pauses, Back/View opens Settings, the right stick pans, the triggers zoom, pressing the right
   stick visits the Capital and the left stick resets the camera. Touch or a mouse hides the cursor again.
   ========================================================= */
const PAD_HELP = 'Stick or D-pad moves, A picks, B goes back, X calls the wave, Y opens the menu, LB and RB change tab, Start pauses.';
function padNote() { return (PAD.id ? 'Connected: ' + PAD.id.replace(/\s*\(.*$/, '').slice(0, 40) + '. ' : 'Plug in or pair a controller and press a button. ') + PAD_HELP; }
const PAD_FOCUS = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
function padItems(root) {
  return [...root.querySelectorAll(PAD_FOCUS)].filter(e => { if (e.disabled || e.closest('[hidden]')) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; });
}
function padFocus(el) { if (!el) return; el.focus({ preventScroll: true }); try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {} }
function padFirst(root) { const it = padItems(root); return it.find(e => e.classList.contains('primary')) || it[0]; }
function padMoveFocus(root, dir) {
  const it = padItems(root); if (!it.length) return; const a = document.activeElement, i0 = it.indexOf(a);
  if (i0 < 0) return padFocus(it[Math.min(PAD.fi || 0, it.length - 1)] || padFirst(root));
  const rs = it.map(e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const i = padNearest(rs[i0], rs, dir); if (i >= 0) { padFocus(it[i]); PAD.fi = i; snd('tab', 620, .02, 'square', .008, 120); }
}
/* What the controller is working on: the topmost layer showing buttons, or the map. */
function padLayer() {
  if (TITLE.on) return { id: 'title', root: $('title') };
  const md = $('modal'); if (!md.hidden) return { id: 'modal', root: md };
  if (paused) return { id: 'pause', root: null };
  if (docked() ? PAD.inSheet : SHEET.open) return { id: 'sheet', root: $('sheet') };
  if (sel && !$('card').hidden) return { id: 'card', root: $('card') };
  return { id: 'map', root: null };
}
function padBack(L) {
  if (L.id === 'title') { if (TITLE.ask) { TITLE.ask = false; titleDraw(); PAD.want = true; } return; }
  if (L.id === 'modal') { const md = $('modal'); if (md.classList.contains('sheetm')) closeSettings(); else { const x = md.querySelector('button.x'); if (x) x.click(); } return; }
  if (L.id === 'sheet') { if (docked()) { PAD.inSheet = false; if (document.activeElement) document.activeElement.blur(); } else closeSheet(); return; }
  if (L.id === 'card') { sel = null; refresh(); }
}
function padCursor(dir) { PAD.cur = padStep(PAD.cur, dir, R3.yaw || 0); snd('tab', 440, .02, 'square', .006, 60); }
function padTap() {
  const [c, r] = PAD.cur;
  if (CAPV.on) { capTap(capSiteAt(c + .5, r + .5)); refresh(); return; }
  const id = r < YARD ? slotAt(c + .5, r + .5) : null;
  if (id === 'trees' || id === 'rocks') { gather(id); PAD.gather = id; PAD.gT = performance.now(); return; }
  tapAt(c + .5, r + .5); refresh();
}
/* The cursor keeps on screen: when it nears an edge the camera slides toward it. */
function padKeepInView() {
  if (!R3.on || !R3.cam || (PAD.layer !== 'map' && PAD.layer !== 'card')) return;
  const [px, py, w] = r3Project(PAD.cur[0] + .5, 0, PAD.cur[1] + .5), W = R3.canvas.width, H = R3.canvas.height;
  if (w > 0 && px > W * .12 && px < W * .88 && py > H * .14 && py < H * .8) return;
  R3.panXT += (PAD.cur[0] + .5 - COLS / 2 - R3.panXT) * .06; R3.panZT += (PAD.cur[1] + .5 - ROWS / 2 - .6 - R3.panZT) * .06;
  R3.panXT = Math.max(-COLS * .55, Math.min(COLS * .55, R3.panXT)); R3.panZT = Math.max(-ROWS * .6, Math.min(ROWS * .6, R3.panZT));
}
/* One frame of a controller p (a Gamepad, or anything shaped like one). */
function padFrame(p, now) {
  const { down, hit } = padEdges(p.buttons), ax = p.axes || [], b = p.buttons || [];
  const lx = padDead(ax[0]), ly = padDead(ax[1]), rx = padDead(ax[2]), ry = padDead(ax[3]);
  const lt = (b[6] && +b[6].value) || 0, rt = (b[7] && +b[7].value) || 0;
  if (Object.keys(down).some(k => down[k]) || lx || ly || rx || ry) {
    if (!PAD.show) { PAD.show = true; document.body.classList.add('pad'); PAD.want = true; PAD.layer = ''; if (!PAD.on) { PAD.on = true; say('Controller ready. ' + PAD_HELP); } return; } // the first press only wakes the cursor
  }
  if (!PAD.show) return;
  const L = padLayer(); if (L.id !== PAD.layer) { PAD.layer = L.id; PAD.want = !!L.root; PAD.fi = 0; }
  const dpad = down.up ? 'up' : down.down ? 'down' : down.left ? 'left' : down.right ? 'right' : '', stick = padStickDir(lx, ly);
  if (L.root) {
    // keep the focus inside the layer (a card or panel that rebuilt itself drops it): back to the same place in it
    const a = document.activeElement; if (!a || a === document.body || !L.root.contains(a)) PAD.want = true;
    if (PAD.want) { const it = padItems(L.root), f = it[Math.min(PAD.fi || 0, it.length - 1)]; if (f) { padFocus(PAD.fi ? f : padFirst(L.root)); PAD.want = false; } }
    const dir = dpad || (L.id === 'card' ? '' : stick);
    if (padRepeat('nav', !!dir, now) && dir) padMoveFocus(L.root, dir);
    if (L.id === 'card') { if (padRepeat('cur', !!stick, now) && stick) { sel = null; padCursor(stick); refresh(); } } // the stick leaves the card for the next cell
    if (hit.a) { const f = document.activeElement; if (f && f !== L.root && L.root.contains(f)) f.click(); else padFocus(padFirst(L.root)); }
    if (hit.b) padBack(L);
  } else if (L.id === 'pause') { if (hit.a || hit.b) setPaused(false); }
  else {
    const dir = dpad || stick; if (padRepeat('cur', !!dir, now) && dir) padCursor(dir);
    if (hit.a) padTap();
    if (!down.a) PAD.gather = null; else if (PAD.gather && now - PAD.gT > 170) { PAD.gT = now; gather(PAD.gather); } // held on the trees or rocks
    if (hit.b) { if (sel) { sel = null; refresh(); } else if (CAPV.on) leaveCapital(); }
  }
  if (TITLE.on) { if (hit.start) { const g = $('tGo'); if (g && !TITLE.ask) g.click(); } return; }
  padKeepInView();
  if (hit.start) setPaused(!paused);
  const md = $('modal');
  if (hit.back) { if (!md.hidden && md.classList.contains('sheetm')) closeSettings(); else if (md.hidden) openSettings(); }
  if (paused || !md.hidden) return;
  if (hit.x && !CAPV.on) { const w = $('bWave'); if (w && !w.disabled && w.offsetParent) w.click(); }
  if (hit.y) { if (docked()) { PAD.inSheet = !PAD.inSheet; PAD.want = PAD.inSheet; if (!PAD.inSheet && document.activeElement) document.activeElement.blur(); } else if (SHEET.open) closeSheet(); else goTab(tab); }
  if (hit.lb || hit.rb) { const ids = TABS.map(t => t[0]), i = Math.max(0, ids.indexOf(tab)), n = ids.length; goTab(ids[(i + (hit.rb ? 1 : n - 1)) % n]); if (docked()) PAD.inSheet = true; PAD.want = true; PAD.fi = 0; }
  if (hit.rs) { const c = $('bCap'); if (c && !c.hidden) c.click(); }
  if (hit.ls) { R3.yawT = 0; R3.distT = 24; R3.panXT = R3.panZT = 0; }
  if ((rx || ry) && R3.panBy) { R3.panBy(-rx * 14, -ry * 14); FXS.bossCam = 0; }
  if (lt > .1 || rt > .1) { R3.distT = Math.max(9, Math.min(36, R3.distT * (1 + (lt - rt) * .03))); FXS.bossCam = 0; }
}
(function padWire() {
  if (!navigator.getGamepads) return;
  let raf = 0;
  const first = () => { try { return [...navigator.getGamepads()].find(g => g && g.connected) || null; } catch (e) { return null; } };
  const loop = now => { raf = 0; const p = first(); if (!p) { PAD.id = ''; PAD.show = false; document.body.classList.remove('pad'); return; } PAD.id = p.id; padFrame(p, now); raf = requestAnimationFrame(loop); };
  addEventListener('gamepadconnected', e => { PAD.id = (e.gamepad && e.gamepad.id) || 'controller'; if (!raf) raf = requestAnimationFrame(loop); });
  // touch or a mouse takes over again: the cursor and the focus ring hide until the controller is used
  addEventListener('pointerdown', () => { if (PAD.show) { PAD.show = false; document.body.classList.remove('pad'); } }, { capture: true, passive: true });
})();
