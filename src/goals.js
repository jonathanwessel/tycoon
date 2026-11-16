'use strict';
/* =========================================================
   Goals
   ========================================================= */
const has = id => blv(id) ? 1 : 0;
const GOALS = [
  { t: 'Build a crossbow beside the road', p: () => [S.towers.length ? 1 : 0, 1], r: 30 },
  { t: 'Build a Lumber Camp', p: () => [has('camp'), 1], r: 25 },
  { t: 'Build an Ore Mine', p: () => [has('mine'), 1], r: 25 },
  { t: 'Build a Sawmill', p: () => [has('saw'), 1], r: 40 },
  { t: 'Sell 30 goods at the market', p: () => [S.stats.sold, 30], r: 60 },
  { t: 'Fill a caravan contract', p: () => [S.stats.contracts, 1], r: 80 },
  { t: 'Survive five waves', p: () => [S.best - 1, 5], r: 100 },
  { t: 'Check on the vault: tap it on the map', p: () => [S.stats.vaultSeen ? 1 : 0, 1], r: 80 },
  { t: 'Build a Smelter', p: () => [has('smelt'), 1], r: 100 },
  { t: 'Build a cannon', p: () => [S.towers.some(t => t.type === 'cannon') ? 1 : 0, 1], r: 150 },
  { t: 'Research the Trading Ledger', p: () => [lv('ledger'), 1], r: 200 },
  { t: 'Raise the Lumber Camp to level 10', p: () => [blv('camp'), 10], r: 300 },
  { t: 'Defeat the wave 10 war wagon', p: () => [S.best - 1, 10], r: 600 },
  { t: 'Raise any tower to level 5 and pick its path', p: () => [S.towers.some(t => t.br) ? 1 : 0, 1], r: 1000 },
  { t: 'Build a Crystal Drill and a Glassworks', p: () => [has('drill') + has('glass'), 2], r: 1500 },
];
/* Badges: long-term goals, kept across charters. */
const BADGES = [
  { id: 'k100',    n: 'Deputy',             d: 'Defeat 100 raiders.',                              icon: 'raider',   ok: () => S.stats.kills >= 100 },
  { id: 'k1k',     n: 'Sheriff',            d: 'Defeat 1,000 raiders.',                            icon: 'shield',   ok: () => S.stats.kills >= 1000 },
  { id: 'k10k',    n: 'Marshal',            d: 'Defeat 10,000 raiders.',                           icon: 'brute',    ok: () => S.stats.kills >= 1e4 },
  { id: 'w10',     n: 'Holding Out',        d: 'Reach wave 10.',                                   icon: 'crossbow', ok: () => S.best >= 10 },
  { id: 'w25',     n: 'Dug In',             d: 'Reach wave 25.',                                   icon: 'cannon',   ok: () => S.best >= 25 },
  { id: 'w50',     n: 'Legend of the Gulch', d: 'Reach wave 50.',                                  icon: 'tesla',    ok: () => S.best >= 50 },
  { id: 'boss1',   n: 'Wagon Wrecker',      d: 'Destroy a war wagon.',                             icon: 'boss',     ok: () => S.stats.bosses >= 1 },
  { id: 'boss10',  n: 'Wheel Breaker',      d: 'Destroy 10 war wagons.',                           icon: 'dynamite', ok: () => S.stats.bosses >= 10 },
  { id: 'clean',   n: 'Clean Sweep',        d: 'Clear a wave with nobody reaching the vault.',     icon: 'vault',    ok: () => S.stats.flawless >= 1 },
  { id: 'clean25', n: 'Iron Gate',          d: 'Clear 25 waves with nobody reaching the vault.',   icon: 'buckler',  ok: () => S.stats.flawless >= 25 },
  { id: 'trade',   n: 'Caravan Master',     d: 'Fill 25 caravan contracts.',                       icon: 'wagon',    ok: () => S.stats.contracts >= 25 },
  { id: 'make',    n: 'Industrialist',      d: 'Make 10,000 goods in workshops.',                  icon: 'gear',     ok: () => S.stats.made >= 1e4 },
  { id: 'auto',    n: 'Clockwork Dream',    d: 'Build an automaton.',                              icon: 'auto',     ok: () => !!S.seen.auto },
  { id: 'arsenal', n: 'Full Arsenal',       d: 'Have every kind of tower on the map at once.',     icon: 'gatling',  ok: () => Object.keys(TOWERS).every(k => S.towers.some(t => t.type === k)) },
  { id: 'weather', n: 'Weathered',          d: 'Clear a wave in each kind of weather.',            icon: 'w_rain',   ok: () => Object.keys(WEATHER).every(k => S.wxSeen[k]) },
  { id: 'charter', n: 'Founder',            d: 'Sign a charter.',                                  icon: 'office',   ok: () => S.charters >= 1 },
  { id: 'chridge', n: 'Railroad Charter',   d: 'Sign a charter in Iron Ridge.',                    icon: 'loco',     ok: () => !!S.chMap.ridge },
  { id: 'ridgeo',  n: 'Iron Horse',         d: 'Open Iron Ridge.',                                 icon: 'loco',     ok: () => townOpen('ridge') },
  { id: 'fallso',  n: 'Bright Lights',      d: 'Open Silver Falls.',                               icon: 'bulb',     ok: () => townOpen('falls') },
  { id: 'wired',   n: 'Wired',              d: 'Make a telegraph.',                                icon: 'tele',     ok: () => townIds().some(id => (id === S.town ? S.seen : S.towns[id].seen || {}).tele) },
  { id: 'chfalls', n: 'Charter of Light',   d: 'Sign a charter in Silver Falls.',                  icon: 'bulb',     ok: () => !!S.chMap.falls },
];
function checkBadges(quiet) {
  for (const b of BADGES) if (!S.badges[b.id] && b.ok()) {
    S.badges[b.id] = 1; if (quiet) continue;
    snd('badge', 784, .35, 'triangle', .06, 392); medal(b);
  }
}
function medal(b) {
  if (document.querySelectorAll('.medal').length >= 3) return; // the rest are still earned and listed in the Charter tab
  const m = h('div', { cls: 'medal', role: 'status' }, ico(b.icon, ''), h('div', null, h('small', null, 'Badge earned'), h('b', null, b.n)));
  m.style.top = 12 + document.querySelectorAll('.medal').length * 66 + 'px'; // several at once stack instead of overlapping
  document.body.append(m); setTimeout(() => m.classList.add('out'), 3000); setTimeout(() => m.remove(), 3500);
}
function genGoal() {
  const opts = [], r = Math.ceil(Math.max(100, S.life * .02));
  const built = BUILD.filter(b => blv(b.def.id)).sort((a, b) => (nextMs(blv(a.def.id)) - blv(a.def.id)) - (nextMs(blv(b.def.id)) - blv(b.def.id)));
  if (built.length) { const b = built[Math.floor(Math.random() * Math.min(3, built.length))], need = nextMs(blv(b.def.id)); opts.push({ k: 'lvl', id: b.def.id, need, t: 'Raise the ' + b.def.n + ' to level ' + need }); }
  opts.push({ k: 'kills', base: S.stats.kills, need: 40 + S.best * 3, t: 'Defeat ' + (40 + S.best * 3) + ' raiders' });
  opts.push({ k: 'wave', need: S.best + 2, t: 'Reach wave ' + (S.best + 2) });
  const sv = Math.ceil(Math.max(200, S.life * .03)); opts.push({ k: 'soldV', base: S.stats.soldV, need: sv, t: 'Earn ' + fmt(sv) + ' coins at the market' });
  opts.push({ k: 'contracts', base: S.stats.contracts, need: 2, t: 'Fill two caravan contracts' });
  const g = opts[Math.floor(Math.random() * opts.length)]; g.r = r; return g;
}
function goalNow() {
  if (S.goal < GOALS.length) { const G = GOALS[S.goal], p = G.p(); return { t: G.t, cur: Math.min(p[0], p[1]), need: p[1], r: G.r, gen: false }; }
  if (!S.gq) S.gq = genGoal();
  const g = S.gq, cur = g.k === 'lvl' ? blv(g.id) : g.k === 'wave' ? S.best : S.stats[g.k] - g.base;
  return { t: g.t, cur: Math.min(cur, g.need), need: g.need, r: g.r, gen: true };
}
function claimGoal() {
  const g = goalNow(); if (g.cur < g.need) return;
  earn(g.r); S.goalsDone++; if (S.goal < GOALS.length) S.goal++; else S.gq = null;
  const from = document.querySelector('.goal img.px'); if (from) for (let i = 0; i < 4; i++) setTimeout(() => flyFrom('coin', from, $('hCoinWrap')), i * 80);
  snd('goal', 523, .25, 'triangle', .06, 523); say('Goal complete: +' + fmt(g.r) + ' coins.');
}
