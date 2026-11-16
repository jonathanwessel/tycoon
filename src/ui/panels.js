'use strict';
/* =========================================================
   Interface: the panels
   Defend, Works, Market, Research, Empire, Charter, Missions and Foremen, plus their small helpers.
   ========================================================= */
function spark(canvas, k) {
  const g = canvas.getContext('2d'), w = canvas.width, hh = canvas.height, d = HIST[k] || [];
  const yy = v => hh - 2 - (v - .3) / .7 * (hh - 4);
  g.clearRect(0, 0, w, hh); g.fillStyle = 'rgba(157,163,189,.35)'; g.fillRect(0, yy(1), w, 1);
  if (d.length < 2) return;
  g.beginPath(); d.forEach((v, i) => { const x = i / 44 * w; i ? g.lineTo(x, yy(v)) : g.moveTo(x, yy(v)); });
  g.lineTo((d.length - 1) / 44 * w, hh); g.lineTo(0, hh); g.closePath(); g.fillStyle = 'rgba(227,141,78,.25)'; g.fill();
  g.beginPath(); d.forEach((v, i) => { const x = i / 44 * w; i ? g.lineTo(x, yy(v)) : g.moveTo(x, yy(v)); }); g.strokeStyle = '#e38d4e'; g.lineWidth = 2; g.stroke();
  const lx = (d.length - 1) / 44 * w, ly = yy(d[d.length - 1]); g.fillStyle = '#ece6d8'; g.beginPath(); g.arc(lx, ly, 2.5, 0, 7); g.fill();
}
const FOE_TIPS = {
  raider: 'Plain gunmen.', runner: 'Fast riders.', brute: 'Slow and tough. Takes 2 off the vault.',
  shield: 'Blocks four hits. Cannons smash the shield in one.', sapper: 'Jams a tower it walks past unless it dies quickly.',
  healer: 'Mends raiders around it. Kill it first.', thief: 'Steals goods instead of hitting the vault.', boat: 'River pirates: row up the river in Silver Falls. Towers on the banks can reach them.', boss: 'Every tenth wave. If it reaches the vault, the vault falls however strong it is: destroy it to move on.',
};
/* What the foremen are saving for, in words. */
function fbGoal() {
  const g = S.fb && S.fb.goal; if (!g) return '';
  if (g.startsWith('r:')) { const r = RESEARCH.find(q => q.id === g.slice(2)); return r ? ' (now: research ' + r.n + ', ' + fmt(S.fb.goalC) + ')' : ''; }
  const b = BY_ID[g]; if (!b) return ''; const n = S.fb.goalN || 1, l = blv(g);
  return ' (now: ' + b.def.n + (n > 1 ? ' levels ' + (l + 1) + ' to ' + (l + n) : ' level ' + (l + 1)) + ', ' + fmt(S.fb.goalC || bCost(b, l)) + ')';
}
/* The tower previewed on the selected plot (the 3D view draws it as a ghost with its reach). */
const GHOST = { type: null };
/* A button that needs two taps: the first arms it (red, "Tap again to ...") for 3 seconds, the second does it. */
function confirmBtn(label, armed, act) {
  let t = 0; const b = h('button', { cls: 'small' }, label);
  b.addEventListener('click', () => { if (b.classList.contains('arm')) { clearTimeout(t); act(); return; } b.classList.add('arm', 'danger'); b.textContent = armed; snd('tab', 300, .05, 'square', .02, -60); t = setTimeout(() => { b.classList.remove('arm', 'danger'); b.textContent = label; }, 3000); });
  return b;
}
/* A mission card: title, progress bar, reward, Claim (and Swap for generated ones). */
function missionCard(p, now, onClaim, onSwap, icon) {
  const gt = h('span'), gn = h('small'), bar = h('i'), claim = h('button', { cls: 'small', on: onClaim }, 'Claim'), swap = h('button', { cls: 'small', on: onSwap || (() => {}) }, 'Swap');
  const goal = h('div', { cls: 'goal' }, ico(icon || 'star'), h('div', { cls: 'grow' }, h('div', { cls: 'gt' }, gt, gn), h('div', { cls: 'prog' }, bar)), h('div', { cls: 'bar' }, swap, claim));
  p.append(goal);
  ups.push(() => {
    const g = now(); goal.hidden = !g; if (!g) return; const done = g.cur >= g.need;
    gt.textContent = g.t; gn.textContent = (g.need > 1 ? fmt(g.cur) + ' / ' + fmt(g.need) + ' · ' : '') + 'reward ' + fmt(g.r) + ' coins';
    bar.style.width = Math.min(100, g.cur / g.need * 100) + '%'; goal.classList.toggle('done', done);
    claim.disabled = !done; claim.classList.toggle('primary', done); swap.hidden = !onSwap || !g.gen || done;
  });
}
const PANELS = {
  foremen(p) {
    const fbInfo = h('p');
    p.append(fbInfo);
    const fseg = (label, opts, key) => { const s = h('div', { cls: 'seg' }, h('small', null, label)); for (const [v, n] of opts) { const b = h('button', { cls: 'small', on: () => { S.fb[key] = v; refresh(); } }, n); s.append(b); ups.push(() => b.classList.toggle('on', S.fb[key] === v)); } p.append(s); };
    if (capOpen()) p.append(h('p', null, 'The Capitol pays the foremen of every town from its budget, and the Academy does the research.'), h('button', { cls: 'primary', on: () => goTab('capital') }, 'Open the Capitol budget'));
    else {
    fseg('Pay them', [[.25, '25%'], [.5, '50%'], [.75, '75%'], [1, 'All']], 'share');
    fseg('Keep', [[0, 'No reserve'], [1, '1 min'], [5, '5 min']], 'keep');
    fseg('Research', [[1, 'They may buy it'], [0, 'Leave it to me']], 'study');
    }
    p.append(h('p', null, 'Hire a foreman with the button next to any building in Works. Each foreman after the first two costs more. Every building doubles its output at levels 10, 25, 50 and each 100, and foremen save up for those.'), h('button', { on: () => goTab('works') }, '‹ Back to Works'));
    ups.push(() => { const n = Object.keys(S.mgr).filter(id => S.mgr[id] === 1).length; fbInfo.textContent = n ? n + ' at work in ' + TOWN.n + '. They get ' + (capOpen() ? pct(S.capital.share * capSplit().foremen) + ' (the Capitol budget)' : pct(S.fb.share)) + ' of what this town earns and save up for the upgrade that pays back fastest' + fbGoal() + '. Purse: ' + fmt(S.fb.purse || 0) + (S.fb.keep ? '. They never take you below ' + S.fb.keep + ' minute' + (S.fb.keep > 1 ? 's' : '') + ' of income.' : '.') : 'No foremen yet in ' + TOWN.n + '.'; });
  },
  missions(p) {
    p.append(h('h2', null, TOWN.n));
    missionCard(p, goalNow, claimGoal, () => { S.gq = null; });
    p.append(h('p', null, 'Each town has its own missions, counted with that town\'s buildings and waves.'));
    p.append(h('h2', null, 'Empire'));
    missionCard(p, empireNow, claimEmpire, null, 'loco');
    const doneE = h('p', null, 'Every empire mission is complete. More come with the Capital.'); p.append(doneE); ups.push(() => { doneE.hidden = !!empireNow(); });
    p.append(h('p', null, 'Badges, records and deeds are in the Charter tab.'));
  },
  defend(p) {
    const nxT = h('h2'), nx = h('div', { cls: 'next' }), wxl = h('div', { cls: 'wxline' }); let sig = null;
    const bw = h('div', { cls: 'wxline warn' }, ico(TOWN.boss.spr, ''), h('span', null, h('b', null, bossName() + ' wave. '), 'If it reaches the vault, the vault falls however strong it is. Destroy it to move on.'));
    p.append(nxT, nx, bw, wxl);
    ups.push(() => {
      bw.hidden = S.wave % 10 !== 0;
      const q = W.active ? W.queue : W.next || [], wk = W.active ? W.weather : W.nweather, s = (W.active ? 'a' : 'n') + S.wave + ':' + q.length + W.ntype + wk;
      nxT.textContent = W.active ? 'Still to come' : 'Next: ' + (S.wave % 10 === 0 ? bossName().toLowerCase() : WTYPES[W.ntype].n.toLowerCase());
      if (s === sig) return; sig = s; nx.textContent = ''; const n = {}; for (const t of q) n[t] = (n[t] || 0) + 1;
      for (const t in FOES) if (n[t]) nx.append(h('span', { title: FOES[t].n }, ico(t, FOES[t].n), '×' + n[t]));
      if (!q.length) nx.append(h('small', null, 'The road is clear.'));
      wxl.textContent = ''; wxl.hidden = !wk;
      if (wk) wxl.append(ico(WEATHER[wk].icon, ''), h('span', null, h('b', null, WEATHER[wk].n + (W.active ? ' now' : ' coming') + '. '), WEATHER[wk].d));
    });
    p.append(h('h2', null, 'Powers'));
    for (const id in ABIL) {
      const A = ABIL[id], b = h('button', { cls: 'small', on: () => useAbility(id) }, 'Use');
      p.append(h('div', { cls: 'row' }, ico(A.icon), h('div', { cls: 'grow' }, h('div', { cls: 'name' }, A.n), h('small', null, A.d + ' Recharges in ' + A.cd + 's.')), h('div', { cls: 'acts' }, b)));
      ups.push(() => { b.disabled = S.cd[id] > 0; b.textContent = S.cd[id] > 0 ? Math.ceil(S.cd[id]) + 's' : 'Use'; });
    }
    p.append(h('h2', null, 'Towers'), h('p', null, TOWER_TIPS));
    for (const id in TOWERS) {
      if (TOWERS[id].rebuilt) continue;
      const d = TOWERS[id];
      p.append(h('div', { cls: 'row' }, ico(id), h('div', { cls: 'grow' }, h('div', { cls: 'name' }, d.n), h('small', null, d.d + (BRANCH[id] ? ' Paths at level 5: ' + Object.values(BRANCH[id]).map(B => B.n).join(', ').replace(/, ([^,]*)$/, ' or $1') + '.' : '') + (d.from ? ' Opens at wave ' + d.from + '.' : ''))), costEl(() => buildCost(id), towerGoods(id), ups)));
    }
    p.append(h('h2', null, 'Raiders seen so far'));
    for (const k in FOES) if (k === 'boss' ? S.best >= 10 : S.best >= UNLOCK[k]) p.append(h('div', { cls: 'row' }, ico(k), h('div', { cls: 'grow' }, h('div', { cls: 'name' }, FOES[k].n), h('small', null, FOE_TIPS[k]))));
    p.append(h('p', null, 'Settings are at the bottom of the Charter tab.'));
  },
  works(p) {
    const chopN = h('span'), digN = h('span');
    ups.push(() => { chopN.textContent = TOWN.tapN.trees + ' +' + fmt(tapYield()); digN.textContent = TOWN.tapN.rocks + ' +' + fmt(tapYield()); });
    const modes = h('div', { cls: 'seg' }, h('small', null, 'Buy'));
    for (const m of [1, 10, 'ms', 'max']) { const b = h('button', { cls: 'small', on: () => { buyMode = m; } }, m === 'max' ? 'Max' : m === 'ms' ? 'To next ★' : '×' + m); modes.append(b); ups.push(() => b.classList.toggle('on', buyMode === m)); }
    // one compact strip: how many to buy, and the foremen (their settings open in their own panel)
    const fbInfo = h('small'), fbBtn = h('button', { cls: 'small fmbtn', on: () => goTab('foremen') }, ico('foreman', ''), h('span', { cls: 'grow' }, h('b', null, 'Foremen'), fbInfo), h('span', { cls: 'chev' }, '›'));
    p.append(h('div', { cls: 'workbar' }, modes, fbBtn));
    if (TOWN.power) { // the power grid: supply from Water Wheels against demand from workshop levels
      const pw = h('div', { cls: 'power' }), pbar = h('i'), ptxt = h('small');
      pw.append(h('div', { cls: 'name' }, 'Power grid'), h('div', { cls: 'prog vbar' }, pbar), ptxt); p.append(pw);
      ups.push(() => { const g = powerUse(); pbar.style.width = Math.min(100, g.use ? g.cap / g.use * 100 : 100) + '%'; pbar.style.background = g.f >= 1 ? 'var(--good)' : g.f > .6 ? 'var(--gold)' : 'var(--bad)';
        ptxt.textContent = 'Water Wheels supply ' + fmt(g.cap) + ', workshops use ' + fmt(g.use) + (g.f >= 1 ? '. Everything runs at full speed.' : '. Workshops run at ' + pct(g.f) + ' speed: build more Water Wheels.'); });
    }
    p.append(h('div', { cls: 'gathhead' }, h('h2', null, 'Gathering'), h('button', { cls: 'small', on: () => gather('trees'), title: 'Or hold the ' + (TOWN.trees ? 'trees' : 'boulders') + ' on the map' }, ico(TOWN.tap.trees), chopN), h('button', { cls: 'small', on: () => gather('rocks'), title: 'Or hold the rocks on the map' }, ico(TOWN.tap.rocks), digN)));
    ups.push(() => {
      const n = Object.keys(S.mgr).filter(id => S.mgr[id] === 1).length;
      fbInfo.textContent = n ? n + ' at work · purse ' + fmt(S.fb.purse || 0) + (S.fb.goal ? ' · next: ' + fbGoal().replace(/^ \(now: |\)$/g, '') : '') : 'Hire one with the button by any building';
    });
    for (const b of BUILD) { if (b.def === SHOPS[0]) p.append(h('h2', null, 'Workshops')); p.append(buyRow(b, ups)); }
  },
  market(p) {
    const thr = h('button', { cls: 'small', on: () => { const o = [0, .6, .8, 1]; S.sellAbove = o[(o.indexOf(S.sellAbove) + 1) % o.length]; } });
    p.append(h('h2', null, 'Caravan contracts'), h('p', null, 'Caravans pay two and a half times the full price, whatever the market is doing.'));
    S.contracts.forEach((c, i) => {
      const info = h('small'), pay = h('span'), go = h('button', { cls: 'primary', on: () => deliver(i) }, 'Deliver ', h('span', { cls: 'cost' }, h('span', null, ico('coin', 'coins'), pay)));
      const skip = h('button', { cls: 'small', on: () => { S.contracts[i] = newContract(); rebuild = true; } }, 'Swap');
      p.append(h('div', { cls: 'row' }, ico(c.k), h('div', { cls: 'grow' }, h('div', { cls: 'name' }, fmt(c.qty) + ' ' + ITEMS[c.k].n.toLowerCase()), info), h('div', { cls: 'acts' }, skip, go)));
      ups.push(() => { info.textContent = 'You have ' + fmt(S.res[c.k]); pay.textContent = fmt(contractPay(c)); go.disabled = S.res[c.k] < c.qty; });
    });
    // selling strategy: the two sensible auto-sell setups, with what each earns here
    const sAll = h('b'), sTop = h('b'), sNow = h('small');
    const setAuto = top => { const used = {}; for (const s of SHOPS) if (blv(s.id)) for (const k in s.in) used[k] = 1; for (const k in ITEMS) if (S.seen[k]) S.auto[k] = top ? !used[k] : true; refresh(); say(top ? 'Auto-selling only goods no workshop needs.' : 'Auto-selling every surplus good.'); };
    const bAll = h('button', { cls: 'small', on: () => setAuto(false) }, 'Sell all surplus'), bTop = h('button', { cls: 'small', on: () => setAuto(true) }, 'Top products only');
    p.append(h('h2', null, 'Selling strategy'), h('div', { cls: 'strat' }, h('div', null, h('span', null, 'Every surplus good sold'), sAll), h('div', null, h('span', null, 'Only goods no workshop needs'), sTop)), sNow, h('div', { cls: 'bar' }, bAll, bTop));
    ups.push(() => {
      const a = steadyIncome(null), t = steadyIncome(null, 'top'); sAll.textContent = '+' + rate(a) + '/s'; sTop.textContent = '+' + rate(t) + '/s';
      bAll.disabled = bTop.disabled = !lv('ledger');
      sNow.textContent = !lv('ledger') ? 'Research the Trading Ledger to sell automatically.' : a > t * 1.02 ? 'Selling every surplus earns more: workshops take what they need first and 20 of each good are kept back, so nothing starves. Set "only above 80% price" below so dumping does not crash prices.' : 'Both earn the same here.';
    });
    p.append(h('h2', null, 'Sell goods'), h('p', null, 'Selling a lot at once pushes the price down. Prices recover over a minute or two.'));
    for (const k in ITEMS) {
      if (!S.seen[k]) continue;
      const info = h('small'), val = h('span'), sc = h('canvas', { cls: 'spark', width: 128, height: 48, 'aria-hidden': 'true' });
      const sellB = h('button', { on: () => { const n = Math.floor(S.res[k]); if (!n) return; sell(k, n); for (let i = 0; i < 3; i++) setTimeout(() => fly('coin', 11, 1, $('hCoinWrap')), i * 90); snd('coin', 880, .08, 'square', .04, 440); } }, 'Sell ', h('span', { cls: 'cost' }, h('span', null, ico('coin', 'coins'), val)));
      const auto = h('button', { cls: 'small', on: () => { S.auto[k] = !S.auto[k]; } }, 'Auto');
      p.append(h('div', { cls: 'row' }, ico(k), h('div', { cls: 'grow' }, h('div', { cls: 'name' }, ITEMS[k].n), info), sc, h('div', { cls: 'acts' }, auto, sellB)));
      ups.push(() => {
        const n = Math.floor(S.res[k]), d = dem(k); info.textContent = fmt(n) + ' in stock · ' + rate(price(k)) + ' each · price ' + pct(d);
        info.style.color = d < .6 ? 'var(--bad)' : d > .95 ? '' : 'var(--gold)';
        val.textContent = fmt(sellValue(k, n)); sellB.disabled = n < 1; auto.hidden = !lv('ledger'); auto.classList.toggle('on', !!S.auto[k]); spark(sc, k);
      });
    }
    const note = h('p'); p.append(note, h('div', { cls: 'bar' }, thr));
    ups.push(() => {
      thr.hidden = !lv('ledger'); thr.textContent = S.sellAbove ? 'Auto-sell only above ' + pct(S.sellAbove) + ' price' : 'Auto-sell at any price';
      note.textContent = lv('ledger') ? 'Auto-sell keeps enough of each good to build any tower twice and fill the caravan contracts (at least ' + KEEP + ').' : 'Research the Trading Ledger to sell goods automatically.';
    });
  },
  research(p) {
    p.append(h('h2', null, 'Research'));
    for (const r of RESEARCH) {
      const cost = () => resCost(r);
      const name = h('div', { cls: 'name' }), ce = costEl(cost, null, ups), done = h('span', null, 'Done'), btn = h('button', { on: () => { const c = cost(); if (S.coins < c || lv(r.id) >= r.max) return; S.coins -= c; S.research[r.id] = lv(r.id) + 1; if (r.id === 'vault') S.vaultHp += 5; snd('build', 500, .15, 'triangle', .05, 500); } }, ce, done);
      p.append(h('div', { cls: 'row' }, h('div', { cls: 'grow' }, name, h('small', null, r.d)), h('div', { cls: 'acts' }, btn)));
      ups.push(() => { const l = lv(r.id), fin = l >= r.max; name.textContent = r.n; if (r.max > 1) name.append(h('i', null, l ? 'Lv ' + l : '')); ce.hidden = fin; done.hidden = !fin; btn.disabled = fin || S.coins < cost(); });
    }
  },
  empire(p) {
    const tot = h('b'), pot = h('small'), car = h('small');
    p.append(h('h2', null, 'Empire'), h('div', { cls: 'emp' }, h('div', null, h('span', null, 'Coins per second, all towns'), tot), pot, car));
    ups.push(() => {
      tot.textContent = '+' + rate(liveIncome()) + '/s';
      pot.textContent = 'Potential with every surplus sold: +' + rate(townIds().reduce((a, id) => a + townIncome(id), 0)) + '/s';
      const cr = carrier(); car.textContent = 'Shipping by ' + cr.n.toLowerCase() + ': up to ' + cr.max + ' a minute on each route, ' + pct(cr.fee) + ' of the goods\' value per load.' + (S.railOpen ? '' : ' A Locomotive Works in Iron Ridge brings trains.');
    });
    // a card for every town
    for (const id in TOWNS) {
      const T = TOWNS[id], live = h('b'), info = h('small'), act = h('div', { cls: 'bar' });
      const card = h('div', { cls: 'town' }, h('div', { cls: 'cardhead' }, ico({ gulch: 'vault', ridge: 'loco', falls: 'bulb' }[id] || 'vault'), h('div', { cls: 'grow' }, h('div', { cls: 'name' }, T.n, h('i', null, T.era)), info), live), act);
      p.append(card);
      let shown = '';
      ups.push(() => {
        const open = townOpen(id), here = id === S.town;
        card.classList.toggle('here', here); card.classList.toggle('locked', !open);
        if (open) {
          const t = here ? S : S.towns[id], mg = Object.keys(t.mgr || {}).filter(k => t.mgr[k] === 1).length;
          live.textContent = '+' + rate(liveIncome(id)) + '/s';
          info.textContent = 'Potential +' + rate(townIncome(id)) + '/s · wave ' + t.wave + ' (best ' + t.best + ')' + (mg ? ' · ' + mg + ' foremen' : '') + (here ? ' · you are here' : ' · working in the background, waves on hold');
        } else {
          const u = T.unlock, from = TOWNS[u.from];
          live.textContent = ''; info.textContent = townOpen(u.from) ? 'Opens after wave ' + u.best + ' in ' + from.n + ' (best so far ' + townBest(u.from) + ') for ' + fmt(u.coins) + ' coins.' : 'Open ' + from.n + ' first.';
        }
        const key = (open ? 'o' : 'l') + (here ? 'h' : '');
        if (key !== shown) {
          shown = key; act.textContent = '';
          if (!open) { const b = h('button', { cls: 'primary', on: () => { if (unlockTown(id)) { say(T.n + ' is open! It needs goods it cannot make: set up a shipping route below.'); snd('badge', 784, .35, 'triangle', .06, 392); rebuild = true; } } }, 'Open ' + T.n + ' ', costEl(() => T.unlock.coins, null, ups)); act.append(b); ups.push(() => { b.disabled = S.coins < T.unlock.coins || townBest(T.unlock.from) < T.unlock.best; }); }
          else if (!here) act.append(h('button', { cls: 'primary', on: () => goTown(id) }, 'Play ' + T.n));
        }
      });
    }
    p.append(h('h2', null, 'The Capital'), h('div', { cls: 'bar' }, h('button', { cls: capOpen() ? '' : 'primary', on: () => goTab('capital') }, capOpen() ? 'Go to the Capital' : capitalReady() ? 'Found the Capital' : 'About the Capital')));
    // shipping routes
    p.append(h('h2', null, 'Shipping routes'));
    const sug = h('div', { cls: 'sugs' }), list = h('div'), form = h('div', { cls: 'bar routeform' });
    p.append(sug, list, form);
    const made = id => new Set([...TOWNS[id].ext, ...TOWNS[id].shops].map(b => BY_ALL[b].def.out));
    const needs = id => { const m = made(id), n = new Set(); for (const s of TOWNS[id].shops) for (const k in BY_ALL[s].def.in) if (!m.has(k)) n.add(k); for (const ty in TOWNS[id].goods) for (const k in TOWNS[id].goods[ty]) if (!m.has(k)) n.add(k); return [...n]; };
    const addRoute = (from, to, k, per) => { if (from === to) return; S.routes.push({ id: Date.now() + Math.random(), from, to, k, per: per || 'auto', sent: 0 }); rebuild = true; say('Shipping ' + ITEMS[k].n.toLowerCase() + ' from ' + TOWNS[from].n + ' to ' + TOWNS[to].n + '.'); };
    const ids = townIds().filter(townOpen);
    for (const to of ids) for (const k of needs(to)) {
      const from = ids.find(f => f !== to && made(f).has(k)); if (!from || S.routes.some(r => r.to === to && r.k === k)) continue;
      sug.append(h('div', { cls: 'row' }, ico(k), h('div', { cls: 'grow' }, h('div', { cls: 'name' }, TOWNS[to].n + ' needs ' + ITEMS[k].n.toLowerCase()), h('small', null, 'Made in ' + TOWNS[from].n + '.')), h('button', { cls: 'small primary', on: () => addRoute(from, to, k, 'auto') }, 'Ship it')));
    }
    if (!S.routes.length) list.append(h('p', null, ids.length > 1 ? 'No routes yet. Goods leave before auto-sell, so a route takes what the town makes before it is sold.' : 'Open a second town to ship goods between towns.'));
    for (const r of S.routes) {
      const info = h('small'), seg = h('div', { cls: 'seg' });
      const rates = ['auto', ...(S.railOpen ? [30, 120, 300, 1200] : [10, 30, 60, 120])];
      for (const v of rates) { const b = h('button', { cls: 'small', on: () => { r.per = v; refresh(); } }, v === 'auto' ? 'Auto' : v + '/min'); if (v === 'auto') b.title = 'Ship what the other town can use, up to what the carrier can take'; seg.append(b); ups.push(() => b.classList.toggle('on', r.per === v)); }
      const pause = h('button', { cls: 'small', on: () => { r.paused = !r.paused; refresh(); } }), del = h('button', { cls: 'small danger', on: () => { S.routes = S.routes.filter(q => q !== r); rebuild = true; } }, 'Remove');
      list.append(h('div', { cls: 'row' }, ico(r.k), h('div', { cls: 'grow' }, h('div', { cls: 'name' }, ITEMS[r.k].n + ': ' + TOWNS[r.from].n + ' → ' + TOWNS[r.to].n), info), seg, h('div', { cls: 'acts' }, pause, del)));
      ups.push(() => { info.textContent = (r.paused ? 'Paused · ' : r.per === 'auto' ? 'Auto: ' + fmt(routeRate(r)) + '/min · ' : '') + fmt(r.sent || 0) + ' shipped so far'; pause.textContent = r.paused ? 'Resume' : 'Pause'; });
    }
    if (ids.length > 1) {
      const sel = (opts, val) => { const s = h('select'); for (const [v, n] of opts) { const o = h('option', { value: v }, n); if (v === val) o.selected = true; s.append(o); } return s; };
      const fromS = sel(ids.map(i => [i, TOWNS[i].n]), ids[0]), toS = sel(ids.map(i => [i, TOWNS[i].n]), ids[1]);
      const goods = () => Object.keys(ITEMS).filter(k => made(fromS.value).has(k) || k === TOWNS[fromS.value].tap.trees || k === TOWNS[fromS.value].tap.rocks);
      let kS = sel(goods().map(k => [k, ITEMS[k].n]));
      fromS.onchange = () => { const n = sel(goods().map(k => [k, ITEMS[k].n])); kS.replaceWith(n); kS = n; };
      form.append(h('small', null, 'New route'), fromS, h('small', null, 'to'), toS, kS, h('button', { cls: 'small', on: () => addRoute(fromS.value, toS.value, kS.value, 60) }, 'Add'));
    }
  },
  charter(p) {
    const held = h('b'), freeL = h('small'), offer = h('p'), signs = h('div', { cls: 'bar' });
    p.append(h('h2', null, 'Deeds'), h('div', { cls: 'deeds' }, held, freeL),
      h('p', null, 'Every deed you hold adds 20% to gathering, workshop speed and tower damage in every town, for good. Spend deeds on perks below; spending does not lose the bonus.'),
      h('h2', null, 'New charter for ' + TOWN.n), h('p', null, 'Sell ' + TOWN.n + ' and start it over for deeds. This town loses its coins, stock, buildings, research and towers; your other towns, deeds, perks, badges and goals stay.'), offer, signs);
    const sign = h('button', { cls: 'primary', on: () => prestige() }, 'Sign a new charter for ' + TOWN.n); signs.append(sign); ups.push(() => { sign.disabled = !deedsOnOffer(); });
    ups.push(() => {
      held.textContent = S.deeds; freeL.textContent = freeDeeds() + ' to spend';
      const g = deedsOnOffer();
      offer.innerHTML = (g ? 'Signing now earns <strong>' + g + ' deed' + (g > 1 ? 's' : '') + '</strong>' + (MAP.deed ? ', including ' + MAP.deed + ' extra for ' + TOWN.n : '') + '.'
        : 'Reach <strong>wave 35</strong> in ' + TOWN.n + ' to earn deeds here. Best so far: wave ' + S.best + '.')
        + ' Later towns pay more: charters in Iron Ridge earn 1 extra deed, in Silver Falls 2.';
    });
    p.append(h('h2', null, 'Perks'));
    for (const pk of PERKS) {
      const name = h('div', { cls: 'name' }), d = h('small', null, pk.d), lab = h('span'), b = h('button', { on: () => buyPerk(pk.id) }, lab);
      p.append(h('div', { cls: 'row' }, ico('star'), h('div', { cls: 'grow' }, name, d), h('div', { cls: 'acts' }, b)));
      ups.push(() => {
        const l = perk(pk.id), locked = pk.req && !perk(pk.req), fin = l >= pk.max;
        name.textContent = pk.n; name.append(h('i', null, l ? 'Rank ' + l + '/' + pk.max : ''));
        lab.textContent = fin ? 'Done' : locked ? 'Needs ' + PERKS.find(q => q.id === pk.req).n : 'Buy · ' + pk.cost(l) + ' deed' + (pk.cost(l) > 1 ? 's' : '');
        b.disabled = fin || locked || freeDeeds() < pk.cost(l);
      });
    }
    // badges and lifetime records
    const got = h('small'); p.append(h('h2', null, 'Badges ', got));
    const grid = h('div', { cls: 'badges' }); p.append(grid);
    for (const b of BADGES) { const tile = h('div', { cls: 'badge', title: b.d }, ico(b.icon, ''), h('b', null, b.n), h('small', null, b.d)); grid.append(tile); ups.push(() => tile.classList.toggle('got', !!S.badges[b.id])); }
    ups.push(() => { got.textContent = BADGES.filter(b => S.badges[b.id]).length + ' of ' + BADGES.length; });
    const recs = h('div', { cls: 'records' }); p.append(h('h2', null, 'Records'), recs);
    const hm = s => { s = Math.floor(s); const hh = Math.floor(s / 3600), mm = Math.floor(s / 60) % 60; return hh ? hh + 'h ' + mm + 'm' : mm + 'm'; };
    for (const [n, f] of [['Coins per second now', () => '+' + rate(liveIncome())], ['Potential coins per second (all surplus sold)', () => '+' + rate(steadyIncome())], ['Best coins per second', () => '+' + rate(S.bestRate || 0)], ['Coins earned', () => fmt(S.stats.coins)], ['Raiders defeated', () => fmt(S.stats.kills)], ['Bosses destroyed', () => fmt(S.stats.bosses)],
      ['Waves with no leaks', () => fmt(S.stats.flawless)], ['Goods made', () => fmt(S.stats.made)], ['Contracts filled', () => fmt(S.stats.contracts)],
      ['Charters signed', () => S.charters], ...Object.keys(TOWNS).map(id => ['Best wave · ' + TOWNS[id].n, () => townOpen(id) ? townBest(id) : '—']), ['Time played', () => hm(S.stats.played)]]) {
      const v = h('b'); recs.append(h('div', null, h('span', null, n), v)); ups.push(() => { v.textContent = f(); });
    }
    // settings live in their own panel (gear button on the map)
    p.append(h('h2', null, 'Settings'), h('div', { cls: 'bar' }, h('button', { on: () => openSettings('gfx') }, 'Graphics'), h('button', { on: () => openSettings('sound') }, 'Sound'), h('button', { on: () => openSettings('game') }, 'Game')));
    const ta = h('textarea', { id: 'saveBox', 'aria-label': 'Save code', placeholder: 'Save code appears here. Paste one to load it.' });
    let armed = false; const wipe = h('button', { cls: 'danger small', on: () => { if (!armed) { armed = true; wipe.textContent = 'Tap again to erase everything'; return; } S = fresh(); setMap(S.map); wipeField(); save(); say('Started over.'); } }, 'Erase save');
    p.append(h('h2', null, 'Save'), h('p', null, 'The game saves in this browser every few seconds and keeps working for up to 8 hours while you are away. Copy a save code to move to another device.'), ta,
      h('div', { cls: 'bar' },
        h('button', { cls: 'small', on: () => { save(); ta.value = btoa(unescape(encodeURIComponent(JSON.stringify(S)))); ta.select(); say('Save code ready. Copy it from the box.'); } }, 'Make save code'),
        h('button', { cls: 'small', on: () => { try { if (!adopt(JSON.parse(decodeURIComponent(escape(atob(ta.value.trim())))))) throw 0; wipeField(); W.countdown = 15; save(); say('Save loaded.'); } catch (e) { say('That save code is not valid. Paste the whole code and try again.'); } } }, 'Load save code'),
        h('button', { cls: 'small', on: saveFile }, 'Save to file'), h('button', { cls: 'small', on: loadFile }, 'Load from file'), wipe));
    // the app: install, storage protection, version
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !APP.installed;
    const appNote = h('p'), inst = h('button', { cls: 'primary', on: installApp }, 'Install Copper Gulch'), ver = h('p');
    const chk = h('button', { cls: 'small', on: () => checkUpdates(true) }, 'Check for updates');
    p.append(h('h2', null, 'App'), appNote, h('div', { cls: 'bar' }, inst, chk), ver, h('p', null, 'No ads. No purchases. Nothing leaves this page.'));
    ups.push(() => { ver.textContent = 'Version ' + GAME_VERSION + (APP.status ? ' · ' + APP.status : '') + (GAME_NEWS ? ' What is new: ' + GAME_NEWS : ''); chk.hidden = !APP.reg; });
    ups.push(() => {
      inst.hidden = !APP.prompt;
      appNote.textContent = (APP.installed ? 'Installed as an app. ' : APP.prompt ? 'Install it to play full screen from your home screen, even offline. ' : ios ? 'To install on iPhone or iPad: tap Share, then Add to Home Screen. ' : 'To install, open your browser menu and choose Install app or Add to Home screen. ')
        + (APP.persisted === true ? 'Your save is protected: the browser will not clear it to free up space.' : APP.persisted === false ? 'The browser may clear saves if the device runs low on space, so keep a save file now and then.' : '')
        + ' New versions download by themselves; you will see "Update ready" when one arrives.';
    });
  },
};
