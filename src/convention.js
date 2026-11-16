'use strict';
/* =========================================================
   Policies and the Constitutional Convention
   Policies: three pairs in the Capitol. Pick one side of a pair and it holds until the next Convention (an unpicked
   pair changes nothing). Their effects are read through polIs() where each one acts (state.js, economy.js, combat.js,
   capital.js).
   The Convention is the empire's great reset. Every town, the Capital, Influence, the tech trees, the policies and the
   Stock Exchange start over; badges, lifetime stats, deed perks, Legacy and settings stay. It pays Legacy for what this
   life achieved: its income, its deepest wave, and its deeds (converted at the bonus they were worth). Every point of
   Legacy multiplies gathering, workshops and damage by 1.25, for good; Legacy is also spent on Legacy perks, and as with
   deeds, spending it does not lose the bonus.
   ========================================================= */
const POLICY = {
  econ: { n: 'The economy', opts: {
    free:     { n: 'Free Market',     icon: 'market',   d: 'Goods sell for 15% more, but prices swing twice as far when you sell. The Central Bank pays double interest; share prices move more.' },
    planned:  { n: 'Planned Economy', icon: 'foreman',  d: 'Prices hold steady (selling pushes them half as far). Foremen are paid 50% more; share prices are calmer.' } } },
  army: { n: 'The army', opts: {
    militia:  { n: 'Militia',         icon: 'barracks', d: 'Barracks and Helipads cost 40% less to build and drill, and each musters one more soldier.' },
    standing: { n: 'Standing Army',   icon: 'cannon',   d: 'Towers hit 25% harder. Upkeep: 2% of every town\'s income.' } } },
  trade: { n: 'Trade', opts: {
    open:     { n: 'Open Borders',    icon: 'wagon',    d: 'Routes carry 50% more for half the fees.' },
    protect:  { n: 'Protectionism',   icon: 'gear',     d: 'Every town gathers and makes 20% more. Route fees are two and a half times higher.' } } },
};
const ARMY_UPKEEP = .02;
const pol = k => (S.capital && S.capital.pol && S.capital.pol[k]) || null;
function setPolicy(k, v) {
  if (!capOpen() || !POLICY[k] || !POLICY[k].opts[v] || pol(k)) return false;
  (S.capital.pol = S.capital.pol || {})[k] = v; snd('badge', 587, .3, 'triangle', .06, 294); return true;
}

/* --- Legacy -------------------------------------------------------------------------------------------------------
   From income: 2 for every tenfold of coins earned this life past 100 million (1 billion: 2, 1 trillion: 8).
   From the deepest wave reached in any town: 1 for every 10 waves past 20.
   From deeds: as many as hold the same bonus (10 deeds, x3: 5 Legacy, x3.05).
   The Convention needs the Capital and at least one point beyond the deeds' own. */
const LEG_INC = 2, LEG_STEP = 1.25;
function legacyParts() {
  const run = Math.max(0, (S.stats.coins || 0) - ((S.legacy && S.legacy.from) || 0));
  let deep = S.best || 0; for (const id of townIds()) if (townOpen(id)) deep = Math.max(deep, townBest(id));
  const inc = run >= 1e9 ? Math.floor(LEG_INC * (Math.log10(run) - 8)) : 0;
  const wave = Math.max(0, Math.floor((deep - 20) / 10));
  const deeds = Math.round(Math.log(1 + .2 * (S.deeds || 0)) / Math.log(LEG_STEP));
  return { run, deep, inc, wave, deeds, total: inc + wave + deeds };
}
const conventionReady = () => { if (!capOpen()) return false; const L = legacyParts(); return L.inc + L.wave >= 1; };
const LEGACY_PERKS = [
  { id: 'ridge',   n: 'Railroad Ready',   d: 'Every new empire starts with Iron Ridge open.',                                       max: 1, cost: () => 2 },
  { id: 'falls',   n: 'Lights On',        d: 'Silver Falls is open from the start too.',                                             max: 1, cost: () => 4, req: 'ridge' },
  { id: 'mesa',    n: 'Oil Strike',       d: 'Thunder Mesa is open from the start too.',                                             max: 1, cost: () => 5, req: 'falls' },
  { id: 'capitol', n: 'Standing Capitol', d: 'The Capital is founded from the start, with every institution built at level 1.',      max: 1, cost: () => 6, req: 'falls' },
  { id: 'pot',     n: 'Founders\' Fund',   d: 'Each new empire starts with 100 Influence per rank for the tech trees.',               max: 3, cost: l => 2 + l },
];
const spentLegacy = () => LEGACY_PERKS.reduce((a, p) => { for (let i = 0; i < lperk(p.id); i++) a += p.cost(i); return a; }, 0);
const freeLegacy = () => legacyPts() - spentLegacy();
function buyLegacy(id) {
  const p = LEGACY_PERKS.find(q => q.id === id), l = lperk(id); if (!p) return false;
  if (l >= p.max || (p.req && !lperk(p.req)) || freeLegacy() < p.cost(l)) return false;
  S.legacy.perks[id] = l + 1; snd('ms', 660, .25, 'triangle', .06, 440); return true;
}
/* Hold the Convention. Returns the Legacy it paid, or 0. */
function convene() {
  if (!conventionReady()) return 0;
  const L = legacyParts(), lg = S.legacy || {}, paid = spentDeeds();
  const keep = { perks: S.perks, paidDeeds: paid, badges: S.badges, stats: S.stats, opt: S.opt, sound: S.sound, tut: S.tut, speed: S.speed,
    goalsDone: S.goalsDone, charters: S.charters, chMap: S.chMap, wxSeen: S.wxSeen, eg: S.eg, seenVersion: S.seenVersion,
    legacy: { pts: (lg.pts || 0) + L.total, perks: lg.perks || {}, n: (lg.n || 0) + 1, from: S.stats.coins, best: Math.max(lg.best || 0, L.total), last: L.total, deep: Math.max(lg.deep || 0, L.deep) } };
  keep.stats.conventions = (keep.stats.conventions || 0) + 1;
  S = fresh(); Object.assign(S, keep); useTown('gulch'); setMap(S.map);
  legacyStart(); headStart();
  if (typeof wipeField === 'function') wipeField();
  save(); return L.total;
}
/* What the Legacy perks give a new empire. */
function legacyStart() {
  if (lperk('ridge')) S.towns.ridge = townFresh('ridge');
  if (lperk('falls')) S.towns.falls = townFresh('falls');
  if (lperk('mesa')) S.towns.mesa = townFresh('mesa');
  if (lperk('capitol')) { S.capital.open = 1; for (const id in INST) S.capital.lv[id] = Math.max(1, capLv(id)); }
  if (lperk('pot')) S.capital.inf = (S.capital.inf || 0) + 100 * lperk('pot');
}
