'use strict';
/* =========================================================
   Interface: the Capital
   Founding it, the Capitol's budget (how much of every town's earnings it takes, and how that splits between foremen,
   the War Office and the Academy), each town's waves, and the institutions.
   ========================================================= */
PANELS.capital = p => {
  if (!capOpen()) {
    const ready = capitalReady(), b = h('button', { cls: 'primary', on: () => { if (openCapital()) { rebuild = true; visitCapital(); say('The Capital is founded. Tap the Capitol to set its budget, and the empty lots to build institutions.'); } } }, 'Found the Capital ', costEl(() => CAPITAL.coins, null, ups));
    p.append(h('h2', null, 'The Capital'), h('p', null, 'The seat of your empire\'s government. Its Capitol takes a share of what every town earns and spends it for you: foremen upgrade buildings, the War Office upgrades towers (slowly), and the Academy does research. It also decides which towns fight their waves on their own. Institutions add bonuses for every town.'),
      h('p', null, ready ? 'Silver Falls has held out to wave ' + CAPITAL.best + '. The Capital can be founded.' : 'Opens once Silver Falls has reached wave ' + CAPITAL.best + (townOpen(CAPITAL.from) ? ' (best so far: ' + townBest(CAPITAL.from) + ').' : '. Open Silver Falls from the Empire tab first.')), b);
    ups.push(() => { b.disabled = !ready || S.coins < CAPITAL.coins; });
    return;
  }
  const c = S.capital, inf = h('small');
  const exB = h('button', { on: () => goTab('exchange') }, ico('chart', ''), ' Stock Exchange'), cvB = h('button', { on: () => goTab('convention') }, ico('office', ''), ' Convention');
  p.append(h('div', { cls: 'bar' }, h('button', { cls: 'primary', on: () => goTab('tech') }, ico('star', ''), ' Tech trees'), exB, cvB, inf));
  ups.push(() => cvB.classList.toggle('ready', conventionReady()));
  ups.push(() => { exB.hidden = !exOpen(); });
  ups.push(() => { inf.textContent = fmt(c.inf || 0) + ' influence'; });
  // --- the Capitol: the budget --------------------------------------------------------------------------------------
  p.append(h('h2', null, 'The Capitol: budget'));
  const shareSeg = h('div', { cls: 'seg' }, h('small', null, 'Takes'));
  for (const v of [.25, .5, .75, 1]) { const b = h('button', { cls: 'small', on: () => { c.share = v; refresh(); } }, v === 1 ? 'All' : pct(v)); shareSeg.append(b); ups.push(() => b.classList.toggle('on', c.share === v)); }
  p.append(h('p', null, 'A share of what every town earns goes to the government. The rest is yours to spend.'), shareSeg);
  const funds = [['foremen', 'Foremen', 'foreman', 'Upgrade buildings in every town, the best payback first.'], ['war', 'War Office', 'cannon', 'Upgrades a tower in each town every few minutes (paths at level 5 are yours to pick).'], ['academy', 'Academy', 'flask', 'Buys research in every town, the cheapest first.']];
  for (const [k, n, icon, d] of funds) {
    const val = h('b'), sl = h('input', { type: 'range', min: '0', max: '10', step: '1', 'aria-label': n + ' share' });
    sl.value = c.split[k]; sl.addEventListener('input', () => { c.split[k] = +sl.value; refresh(); });
    p.append(h('div', { cls: 'row fund' }, ico(icon), h('div', { cls: 'grow' }, h('div', { cls: 'name' }, n, ' ', val), h('small', null, d), sl)));
    ups.push(() => { val.textContent = pct(c.share * capSplit()[k]) + ' of income'; });
  }
  policyRows(p);
  // --- waves in every town -------------------------------------------------------------------------------------------
  p.append(h('h2', null, 'Waves'), h('p', null, 'A town on auto fights its waves even while you are elsewhere. If its towers are too weak for its boss it loops at that boss, and each time its vault falls it loses coins.'));
  for (const id of townIds().filter(townOpen)) {
    const info = h('small'), b = h('button', { cls: 'small', on: () => { if (id === S.town) toggleAuto(); else S.towns[id].autoWave = !S.towns[id].autoWave; refresh(); } });
    p.append(h('div', { cls: 'row' }, h('div', { cls: 'grow' }, h('div', { cls: 'name' }, TOWNS[id].n), info), b));
    ups.push(() => { const t = id === S.town ? S : S.towns[id], auto = !!t.autoWave; info.textContent = 'Wave ' + t.wave + ' · best ' + t.best + ' · vault ' + Math.max(0, t.vaultHp) + (id === S.town ? ' · you are here' : ''); b.textContent = auto ? 'Auto' : 'Held'; b.classList.toggle('on', auto); });
  }
  // --- institutions --------------------------------------------------------------------------------------------------
  p.append(h('h2', null, 'Institutions'));
  for (const id in INST) {
    const I = INST[id], name = h('div', { cls: 'name' }), d = h('small'), b = h('button', { cls: 'small', on: () => buyInst(id) }, capLv(id) ? 'Upgrade ' : 'Build ', costEl(() => instCost(id), null, ups));
    p.append(h('div', { cls: 'row' }, ico(I.icon), h('div', { cls: 'grow' }, name, d), h('div', { cls: 'acts' }, b)));
    ups.push(() => { const l = capLv(id); name.textContent = I.n; if (l) name.append(h('i', null, 'Lv ' + l)); d.textContent = I.d(Math.max(1, l)) + (l ? '' : ' (at level 1)'); b.hidden = l >= I.max; b.disabled = S.coins < instCost(id); });
  }
  const keepSeg = h('div', { cls: 'seg' }, h('small', null, 'Auto-sell keeps'));
  for (const [v, n] of [[1, 'Enough for towers'], [2, 'Twice that'], [4, '4×']]) { const b = h('button', { cls: 'small', on: () => { c.keep = v; refresh(); } }, n); keepSeg.append(b); ups.push(() => b.classList.toggle('on', (c.keep || 1) === v)); }
  p.append(h('p', null, 'Market Board rule for every town:'), keepSeg);
};

/* Visiting the Capital: the 3D view shows the capital city (the Capitol and the institutions, each tappable for its
   card) while the town you left plays on. The camera of the town is kept for the way back. */
function visitCapital() {
  if (!capOpen() || CAPV.on) return false;
  CAPV.on = true; CAPV.cam = { yawT: R3.yawT, distT: R3.distT, panXT: R3.panXT, panZT: R3.panZT };
  R3.yawT = 0; R3.distT = 24; R3.panXT = R3.panZT = 0; R3.vx = R3.vy = 0; sel = null; stopHold();
  if (SHEET.open && !docked()) closeSheet();
  document.body.classList.add('incap'); snd('tab', 392, .2, 'triangle', .04, 196); refresh(); return true;
}
function leaveCapital(quiet) {
  if (!CAPV.on) return false;
  CAPV.on = false; if (CAPV.cam) Object.assign(R3, CAPV.cam); R3.vx = R3.vy = 0; if (sel && sel.site) sel = null; document.body.classList.remove('incap');
  if (!quiet) refresh(); return true;
}
/* The side button for the Capital (a dome), shown once Silver Falls is open: it visits the Capital (or brings you back),
   or before it is founded opens the page about founding it. */
(() => {
  const go = () => { if (!capOpen()) return goTab('capital'); if (CAPV.on) leaveCapital(); else visitCapital(); };
  const b = h('button', { cls: 'mapbtn', id: 'bCap', 'aria-label': 'The Capital', title: 'The Capital (C)', on: go });
  b.innerHTML = '<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M7.5 0h1v2.1A5 5 0 0 1 13 7h1v2H2V7h1a5 5 0 0 1 4.5-4.9zM3 10h2v4H3zm4 0h2v4H7zm4 0h2v4h-2zM1 15h14v1H1z"/></svg>';
  $('bMis').after(b);
  fixedUps.push(() => { if (CAPV.on && !capOpen()) leaveCapital(true); // a Convention dissolves the Capital
    b.hidden = !(capOpen() || townOpen(CAPITAL.from)); b.classList.toggle('ready', !capOpen() && capitalReady() && S.coins >= CAPITAL.coins); b.classList.toggle('on', CAPV.on);
    const t = CAPV.on ? 'Back to ' + TOWN.n + ' (C)' : 'The Capital (C)'; if (b.title !== t) { b.title = t; b.setAttribute('aria-label', t); } });
  document.addEventListener('keydown', e => { if (e.target.closest && e.target.closest('textarea, input')) return;
    if ((e.key === 'c' || e.key === 'C') && !b.hidden) go(); else if (e.key === 'Escape' && CAPV.on && !SHEET.open && !sel && $('modal').hidden) leaveCapital(); });
  // in the Capital the wave controls give way to the way home (with the home town's wave, which plays on)
  const back = $('bLeave'); back.addEventListener('click', () => leaveCapital());
  fixedUps.push(() => { if (!CAPV.on) return; const t = '◀ Back to ' + TOWN.n + (W.active ? ' · wave ' + S.wave + ' under way' : ''); if (back.textContent !== t) back.textContent = t; back.classList.toggle('live', W.active); });
})();
