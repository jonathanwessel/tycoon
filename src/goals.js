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
/* Each town has its own mission chain (counted with that town's own buildings and waves); generated missions follow. */
const route = (to, k) => S.routes.some(r => r.to === to && r.k === k) ? 1 : 0;
const GOALS_BY_TOWN = {
  gulch: GOALS,
  ridge: [
    { t: 'Build an Iron Mine', p: () => [has('ironmine'), 1], r: 300 },
    { t: 'Build a Coal Seam', p: () => [has('coalseam'), 1], r: 400 },
    { t: 'Build a Blast Furnace', p: () => [has('blast'), 1], r: 800 },
    { t: 'Build a crossbow beside the road', p: () => [S.towers.length ? 1 : 0, 1], r: 600 },
    { t: 'Ship planks to Iron Ridge (Empire tab)', p: () => [route('ridge', 'plank'), 1], r: 1200 },
    { t: 'Survive five waves in Iron Ridge', p: () => [S.best - 1, 5], r: 2000 },
    { t: 'Build a Rolling Mill', p: () => [has('rolling'), 1], r: 3000 },
    { t: 'Build a Boiler Shop', p: () => [has('boilerw'), 1], r: 5000 },
    { t: 'Raise the Blast Furnace to level 10', p: () => [blv('blast'), 10], r: 8000 },
    { t: 'Defeat the wave 10 armoured train', p: () => [S.best - 1, 10], r: 15000 },
    { t: 'Build a Locomotive Works: trains for every route', p: () => [has('locow'), 1], r: 30000 },
  ],
  falls: [
    { t: 'Build a Copper Mine', p: () => [has('cumine'), 1], r: 2000 },
    { t: 'Build a Water Wheel to power the workshops', p: () => [has('wheel'), 1], r: 3000 },
    { t: 'Build the Copper Works', p: () => [has('refinery'), 1], r: 4000 },
    { t: 'Build a crossbow beside the road', p: () => [S.towers.length ? 1 : 0, 1], r: 3000 },
    { t: 'Build a Sand Pit and a Glassblower', p: () => [has('sandpit') + has('glassb'), 2], r: 6000 },
    { t: 'Survive five waves in Silver Falls', p: () => [S.best - 1, 5], r: 10000 },
    { t: 'Build the Wire Works', p: () => [has('wirew'), 1], r: 12000 },
    { t: 'Ship rails to Silver Falls (Empire tab)', p: () => [route('falls', 'rail'), 1], r: 15000 },
    { t: 'Build the Bulb Works', p: () => [has('bulbw'), 1], r: 25000 },
    { t: 'Defeat the wave 10 ironclad steamer', p: () => [S.best - 1, 10], r: 50000 },
    { t: 'Build the Telegraph Works', p: () => [has('telw'), 1], r: 100000 },
  ],
};
const goalList = () => GOALS_BY_TOWN[TOWN_ID] || GOALS;
/* Empire missions: one chain for the whole empire, counted across every town. */
const allMgr = () => Object.keys(S.mgr).length + Object.values(S.towns).reduce((a, t) => a + Object.keys(t.mgr || {}).length, 0);
const EMPIRE_GOALS = [
  { t: 'Open Iron Ridge (Empire tab)', p: () => [townOpen('ridge') ? 1 : 0, 1], r: 5000 },
  { t: 'Set a shipping route to Auto', p: () => [S.routes.some(r => r.per === 'auto') ? 1 : 0, 1], r: 4000 },
  { t: 'Have 10 foremen at work across the empire', p: () => [allMgr(), 10], r: 20000 },
  { t: 'Sign a charter in any town', p: () => [S.charters, 1], r: 30000 },
  { t: 'Open Silver Falls', p: () => [townOpen('falls') ? 1 : 0, 1], r: 100000 },
  { t: 'Earn 10 million coins in all', p: () => [S.stats.coins, 1e7], r: 250000 },
  { t: 'Have 25 foremen at work across the empire', p: () => [allMgr(), 25], r: 500000 },
  { t: 'Earn a billion coins in all', p: () => [S.stats.coins, 1e9], r: 5e6 },
];
function empireNow() { const G = EMPIRE_GOALS[S.eg || 0]; if (!G) return null; const p = G.p(); return { t: G.t, cur: Math.min(p[0], p[1]), need: p[1], r: G.r }; }
function claimEmpire() {
  const g = empireNow(); if (!g || g.cur < g.need) return;
  earn(g.r); S.eg = (S.eg || 0) + 1; S.goalsDone++; snd('goal', 523, .25, 'triangle', .06, 523); say('Empire mission complete: +' + fmt(g.r) + ' coins.');
}
/* How many missions are ready to claim (for the badge on the Missions button). */
function missionsReady() { const g = goalNow(), e = empireNow(); return (g.cur >= g.need ? 1 : 0) + (e && e.cur >= e.need ? 1 : 0); }
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
  const L = goalList(); if (S.goal < L.length) { const G = L[S.goal], p = G.p(); return { t: G.t, cur: Math.min(p[0], p[1]), need: p[1], r: G.r, gen: false }; }
  if (!S.gq) S.gq = genGoal();
  const g = S.gq, cur = g.k === 'lvl' ? blv(g.id) : g.k === 'wave' ? S.best : S.stats[g.k] - g.base;
  return { t: g.t, cur: Math.min(cur, g.need), need: g.need, r: g.r, gen: true };
}
function claimGoal() {
  const g = goalNow(); if (g.cur < g.need) return;
  earn(g.r); S.goalsDone++; if (S.goal < goalList().length) S.goal++; else S.gq = null;
  const from = document.querySelector('.goal img.px') || $('bMis'); if (from) for (let i = 0; i < 4; i++) setTimeout(() => flyFrom('coin', from, $('hCoinWrap')), i * 80);
  snd('goal', 523, .25, 'triangle', .06, 523); say('Goal complete: +' + fmt(g.r) + ' coins.');
}
