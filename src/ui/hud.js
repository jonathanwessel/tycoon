'use strict';
/* =========================================================
   Interface: the fixed parts
   The tab bar, map buttons, wave controls and stock strip; rebuilding the panel; refresh().
   ========================================================= */
const TABS = [['defend', 'Defend', 'crossbow'], ['works', 'Works', 'camp'], ['market', 'Market', 'market'], ['research', 'Research', 'flask'], ['empire', 'Empire', 'loco'], ['charter', 'Charter', 'office']];
const fixedUps = [];
function buildFixed() {
  $('hCoinIcon').src = iconURL('coin'); $('hWaveIcon').src = iconURL('raider'); $('hVaultIcon').src = iconURL('vault'); $('hDeedIcon').src = iconURL('star');
  const tabs = $('tabs'), dots = {};
  for (const [id, n, icon] of TABS) {
    dots[id] = h('i', { cls: 'dot', hidden: '' });
    const b = h('button', { role: 'tab', id: 'tab-' + id, 'aria-controls': 'panel', on: () => goTab(id) }, ico(icon), h('span', null, n), dots[id]); tabs.append(b);
    fixedUps.push(() => b.setAttribute('aria-selected', String(tab === id && (SHEET.open || docked()))));
  }
  $('bWave').addEventListener('click', startWave);
  $('sheetX').addEventListener('click', () => closeSheet());
  $('bMis').addEventListener('click', () => goTab('missions'));
  { const mc = $('bMis').querySelector('.mcount'); let last = 0;
    fixedUps.push(() => { const n = missionsReady(); mc.hidden = !n; mc.textContent = n; $('bMis').classList.toggle('ready', n > 0); if (n > last) { mc.classList.remove('pop'); void mc.offsetWidth; mc.classList.add('pop'); } last = n; }); }
  // drag the sheet's head: taller, shorter, or flick it down to close
  (() => {
    const hd = $('sheetHead'); let d = null;
    hd.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; d = { y: e.clientY, h: SHEET.h, last: e.clientY, lt: performance.now() }; try { hd.setPointerCapture(e.pointerId); } catch (er) {} document.body.classList.add('sheet-drag'); });
    hd.addEventListener('pointermove', e => { if (!d) return; d.v = (e.clientY - d.last) / Math.max(1, performance.now() - d.lt); d.last = e.clientY; d.lt = performance.now(); setSheetH(Math.max(.15, Math.min(.92, d.h - (e.clientY - d.y) / innerHeight))); });
    const up = () => { if (!d) return; document.body.classList.remove('sheet-drag'); const f = SHEET.h, fling = (d.v || 0) > .8; d = null;
      if (f < .3 || fling) { closeSheet(); setSheetH(.55); } else setSheetH(f > .72 ? .9 : .55); };
    hd.addEventListener('pointerup', up); hd.addEventListener('pointercancel', up);
  })();
  $('bPause').addEventListener('click', () => setPaused(true));
  $('bFull').addEventListener('click', () => setMapFull(!document.body.classList.contains('mapfull')));
  $('bSet').addEventListener('click', () => openSettings());
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && FULL.asked) { FULL.asked = false; setMapFull(false); } });
  $('pauseCover').addEventListener('click', () => setPaused(false));
  document.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('textarea, input')) return;
    const md = $('modal'); if (e.key === 'Escape' && !md.hidden && md.classList.contains('sheetm')) { md.hidden = true; md.className = 'modal'; md.onclick = null; save(); return; }
    if (e.key === 'p' || e.key === 'P' || (e.key === 'Escape' && paused)) { e.preventDefault(); setPaused(!paused); }
    else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); goTab('missions'); }
    else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); setMapFull(!document.body.classList.contains('mapfull')); }
    else if (e.key === 'Escape' && document.body.classList.contains('mapfull')) setMapFull(false);
    else if (e.key === 'Escape' && SHEET.open) closeSheet();
  });
  const hold = $('bHold'); hold.addEventListener('click', toggleAuto);
  const hv = $('hVaultWrap'), openVault = () => { sel = { vault: 1 }; refresh(); };
  hv.addEventListener('click', openVault); hv.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openVault(); } });
  fixedUps.push(() => hv.classList.toggle('low', S.vaultHp < vaultMax() / 2));
  fixedUps.push(() => { hold.classList.toggle('held', !S.autoWave); hold.setAttribute('aria-pressed', String(!S.autoWave)); hold.lastChild.textContent = S.autoWave ? 'Hold' : 'Held'; });
  // speed: tap cycles 1×/2×/3×; hold (or right-click) opens a menu that also offers pause
  const spB = $('bSpeed'); let lpT = null, lpFired = false;
  const menu = h('div', { cls: 'speedmenu', role: 'menu', hidden: '' });
  for (const [v, n] of [[1, '1×'], [2, '2×'], [3, '3×'], [0, 'Pause']]) menu.append(h('button', { cls: 'small', role: 'menuitem', on: e => { e.stopPropagation(); menu.hidden = true; if (v) { S.speed = v; setPaused(false); } else setPaused(true); refresh(); } }, n));
  spB.parentNode.append(menu);
  const openMenu = () => { menu.hidden = false; menu.firstChild.focus(); };
  spB.addEventListener('pointerdown', () => { lpFired = false; clearTimeout(lpT); lpT = setTimeout(() => { lpFired = true; openMenu(); }, 450); });
  for (const e of ['pointerup', 'pointerleave', 'pointercancel']) spB.addEventListener(e, () => clearTimeout(lpT));
  spB.addEventListener('contextmenu', e => { e.preventDefault(); openMenu(); });
  spB.addEventListener('click', () => { if (lpFired) { lpFired = false; return; } S.speed = S.speed % 3 + 1; });
  document.addEventListener('pointerdown', e => { if (!menu.hidden && !menu.contains(e.target) && e.target !== spB) menu.hidden = true; });
  spB.title = 'Game speed. Hold for more.';
  for (const id in ABIL) {
    const b = $('ab-' + id), A = ABIL[id], shade = h('i', { cls: 'cd' }), num = h('b', { cls: 'cdn' });
    b.append(ico(A.icon, A.n), shade, num); b.setAttribute('aria-label', A.n + ': ' + A.d); b.addEventListener('click', () => useAbility(id));
    fixedUps.push(() => { b.hidden = !!(A.from && S.best < A.from); }); // Tar Pit appears once wave 8 has been reached
    fixedUps.push(() => { const f = Math.max(0, S.cd[id] || 0) / A.cd; shade.style.transform = 'scaleY(' + f + ')'; num.textContent = S.cd[id] > 0 ? Math.ceil(S.cd[id]) : ''; b.classList.toggle('ready', !(S.cd[id] > 0)); b.classList.toggle('active', id === 'ot' && S.ot > 0); });
  }
  const h1 = document.querySelector('h1');
  fixedUps.push(() => {
    if (h1.textContent !== TOWN.n) h1.textContent = TOWN.n; // the header names the town you are in
    $('hWave').textContent = S.wave; $('hVault').textContent = Math.max(0, S.vaultHp); $('hVault').append(h('span', { cls: 'mx' }, '/' + vaultMax()));
    $('hDeedsWrap').hidden = !S.deeds; $('hDeeds').textContent = S.deeds;
    const bw = $('bWave'); bw.disabled = W.active;
    bw.textContent = W.active ? 'Wave ' + S.wave + ' · ' + (W.queue.length + foes.length) + ' left' : 'Call wave ' + S.wave + (S.autoWave ? ' · ' + Math.ceil(W.countdown) + 's' : ' · held');
    bw.classList.toggle('live', W.active); bw.classList.toggle('held', !W.active && !S.autoWave); bw.classList.toggle('soon', !W.active && S.autoWave && W.countdown <= 5);
    $('bSpeed').textContent = S.speed + '×'; $('bSpeed').setAttribute('aria-label', 'Game speed ' + S.speed + ' times');
    // missions ready to claim show on the Missions button, not on a tab
    dots.market.hidden = !S.contracts.some(c => S.res[c.k] >= c.qty);
    dots.charter.hidden = !(deedsOnOffer() || freeDeeds() > 0 && PERKS.some(p => perk(p.id) < p.max && !(p.req && !perk(p.req)) && freeDeeds() >= p.cost(perk(p.id))));
  });
}
function buildDynamic() {
  ups = []; rebuild = false;
  while (S.contracts.length < 3) S.contracts.push(newContract());
  const st = $('stock'); st.textContent = '';
  // income first: what the town earns per second now, and what it would with every surplus sold
  { const v = h('div', { cls: 'v' }), r = h('div', { cls: 'r' }); st.append(h('div', { cls: 'chip income', title: 'Coins per second: earned over the last minute, and what this town makes with every surplus good sold at full price' }, ico('coin', 'Income'), h('div', null, v, r)));
    ups.push(() => { v.textContent = '+' + rate(liveIncome()) + '/s'; r.textContent = 'potential ' + rate(steadyIncome()) + '/s'; }); }
  for (const k in ITEMS) {
    if (!S.seen[k]) continue; const v = h('div', { cls: 'v' }), r = h('div', { cls: 'r' });
    CHIP[k] = h('div', { cls: 'chip', title: ITEMS[k].n }, ico(k, ITEMS[k].n), h('div', null, v, r)); st.append(CHIP[k]);
    ups.push(() => { v.textContent = fmt(S.res[k]); const x = RATE[k] || 0, show = Math.abs(x) >= .05; r.textContent = show ? (x > 0 ? '▲ ' : '▼ ') + rate(Math.abs(x)) + '/s' : ITEMS[k].n; r.className = 'r' + (show ? x > 0 ? ' up' : ' down' : ''); });
  }
  const p = $('panel'); p.textContent = ''; p.setAttribute('aria-labelledby', 'tab-' + tab); PANELS[tab](p);
  const tt = TABS.find(t => t[0] === tab); $('sheetTitle').textContent = tt ? tt[1] : tab === 'missions' ? 'Missions' : tab === 'foremen' ? 'Foremen' : tab === 'capital' ? 'Capital' : tab === 'tech' ? 'Tech trees' : '';
  if (shownTab && shownTab !== tab && p.animate && !REDUCED) {
    const order = TABS.map(t => t[0]), dir = order.indexOf(tab) > order.indexOf(shownTab) ? 1 : -1;
    p.animate([{ opacity: 0, transform: 'translateX(' + dir * 28 + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
  if (shownTab !== tab && !REDUCED) { [...p.children].forEach((c, i) => c.style.setProperty('--i', Math.min(i, 12))); p.classList.add('enter'); setTimeout(() => p.classList.remove('enter'), 900); }
  shownTab = tab;
}
/* A little burst of coins from a button you just bought with. */
function sparks(el) {
  if (REDUCED || !el || !el.getBoundingClientRect) return; const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  for (let i = 0; i < 8; i++) { const s = document.createElement('i'); s.className = 'spark'; s.style.left = x - 6 + 'px'; s.style.top = y - 6 + 'px'; document.body.append(s);
    const a = i / 8 * Math.PI * 2 + Math.random() * .4, d = 26 + Math.random() * 22;
    s.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: 'translate(' + Math.cos(a) * d + 'px,' + (Math.sin(a) * d - 10) + 'px) scale(.4)', opacity: 0 }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = () => s.remove(); }
}
let shownTab = null;
function refresh() { checkBadges(); if (rebuild) buildDynamic(); for (const f of fixedUps) f(); for (const f of ups) f(); card(); }
