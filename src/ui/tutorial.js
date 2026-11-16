'use strict';
/* =========================================================
   Interface: the tutorial
   Offered on a brand-new game (and replayable from Settings). Each step dims the screen except a spotlight on what to
   use (a button, or a spot in the 3D town), says one line, and moves on by itself when you have done it.
   S.tut: undefined (not offered yet), a step number, or 'done'.
   ========================================================= */
const TUT_REWARD = 200;
const TUT = [
  { t: 'Hold the trees to chop timber.', at: () => tutCell(SLOT.trees[0] + 1, SLOT.trees[1] + 1, .5), done: () => S.stats.taps >= 4 },
  { t: 'Tap the empty plot next to the trees, then build the Lumber Camp.', at: () => tutCell(SLOT.camp[0] + 1, SLOT.camp[1] + 1, .3), done: () => blv('camp') > 0 },
  { t: 'Raiders come down the road. Tap the glowing plot beside it.', at: () => tutCell(PLOTS[0].x + .5, PLOTS[0].y + .5, 0), done: () => !!(sel && sel.plot) || S.towers.length > 0 },
  { t: 'Build a crossbow there.', at: () => $('card'), done: () => S.towers.length > 0 },
  { t: 'Call the first wave of raiders.', at: () => $('bWave'), done: () => W.active || S.wave > 1 },
  { t: 'Tap your crossbow and upgrade it.', at: () => S.towers[0] ? (sel && sel.t ? $('card') : tutCell(S.towers[0].c + .5, S.towers[0].r + .5, .4)) : null, done: () => S.towers.some(t => t.lvl >= 1) },
  { t: 'Open Works to see every building.', at: () => $('tab-works'), done: () => tab === 'works' && (SHEET.open || docked()) },
  { t: 'Buy a level for the Lumber Camp: more timber every second.', at: () => $('panel'), done: () => blv('camp') >= 2 },
  { t: 'Missions pay coins. Open them here.', at: () => $('bMis'), done: () => tab === 'missions' && (SHEET.open || docked()) },
  { t: 'Last one: drag the town to look around. Pinch to zoom, twist to turn.', at: () => null, done: () => Math.abs(R3.panXT) + Math.abs(R3.panZT) > .6 || Math.abs(R3.yawT) > .25 || Math.abs(R3.distT - 24) > 2 },
];
/* A spot in the 3D town as a screen rectangle. */
function tutCell(x, z, y) {
  if (!R3.on || !R3.cam) return null; const [px, py, w] = r3Project(x, y, z); if (w <= 0) return null;
  const r = R3.canvas.getBoundingClientRect(), k = r.width / R3.canvas.width, rad = Math.max(34, cell * k * 1.1);
  return { left: r.left + px * k - rad, top: r.top + py * k - rad, width: rad * 2, height: rad * 2, round: true };
}
const tutEl = (() => {
  const spot = h('div', { cls: 'tutspot' }), text = h('p'), skip = h('button', { cls: 'small', on: () => tutEnd(true) }, 'Skip tutorial'), step = h('small');
  const bub = h('div', { cls: 'tutbub', role: 'status' }, step, text, skip), root = h('div', { cls: 'tut', hidden: '' }, spot, bub);
  document.body.append(root); return { root, spot, bub, text, step };
})();
function tutStart() { S.tut = 0; sel = null; if (SHEET.open) closeSheet(); tutShow(); }
function tutEnd(skipped) {
  S.tut = 'done'; tutEl.root.hidden = true;
  if (!skipped) { earn(TUT_REWARD); say('Tutorial done: +' + TUT_REWARD + ' coins. Missions (top right) suggest what to do next.'); snd('badge', 784, .35, 'triangle', .06, 392); }
  else say('Tutorial skipped. You can play it any time from Settings, Game.');
}
function tutShow() { const s = TUT[S.tut]; if (!s) return; tutEl.step.textContent = 'Step ' + (S.tut + 1) + ' of ' + TUT.length; tutEl.text.textContent = s.t; tutEl.root.hidden = false; tutEl.bub.classList.remove('pop'); void tutEl.bub.offsetWidth; tutEl.bub.classList.add('pop'); }
/* Every frame: follow the target, and move on when the step is done. */
function tutTick() {
  if (typeof S.tut !== 'number') return; const s = TUT[S.tut]; if (!s) return tutEnd(false);
  if (s.done()) { S.tut++; snd('goal', 660, .12, 'triangle', .04, 330); if (S.tut >= TUT.length) return tutEnd(false); tutShow(); return; }
  let r = s.at(); if (r && r.getBoundingClientRect) { const b = r.getBoundingClientRect(); r = b.width ? { left: b.left - 6, top: b.top - 6, width: b.width + 12, height: b.height + 12 } : null; }
  const sp = tutEl.spot.style; tutEl.spot.hidden = !r;
  if (r) { sp.left = r.left + 'px'; sp.top = r.top + 'px'; sp.width = r.width + 'px'; sp.height = r.height + 'px'; sp.borderRadius = r.round ? '50%' : '10px'; }
  // the bubble sits away from the spotlight
  const below = !r || r.top + r.height / 2 < innerHeight * .45; tutEl.bub.classList.toggle('below', below);
  tutEl.bub.style.top = r ? (below ? Math.min(innerHeight - 160, r.top + r.height + 14) : Math.max(8, r.top - tutEl.bub.offsetHeight - 14)) + 'px' : '30%';
}
/* On a brand-new game: offer it. */
function tutOffer() {
  if (S.tut !== undefined) return;
  const m = $('modal'); m.className = 'modal'; m.textContent = '';
  const go = h('button', { cls: 'primary', on: () => { m.hidden = true; tutStart(); } }, 'Play the tutorial'), no = h('button', { on: () => { m.hidden = true; S.tut = 'done'; say('You can play the tutorial any time from Settings, Game.'); } }, 'Skip');
  m.append(h('div', { cls: 'box', role: 'dialog', 'aria-modal': 'true' }, h('h3', null, 'Welcome to Copper Gulch'), h('p', null, 'Build a frontier town, chain its workshops into an empire, and hold the road against raiders. New here? The tutorial takes about three minutes.'), h('div', { cls: 'bar' }, go, no)));
  m.hidden = false; go.focus();
}
