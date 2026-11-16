'use strict';
/* =========================================================
   The Capital: the empire's government, opened once Silver Falls has held out to wave 15.
   The Capitol sets a global budget: a share of everything every town earns, split between the foremen (building
   upgrades), the War Office (slow automatic tower upgrades) and the Academy (automatic research). It also holds each
   town's auto-wave switch; a town left on auto fights its waves in the background (worked out from its towers'
   strength against the wave's), which loops at its boss gate if the towers are too weak, at the cost of a fallen vault.
   Institutions are bought and levelled with coins and act on every town.
   ========================================================= */
const CAPITAL = { from: 'falls', best: 15, coins: 2e7 };
const INST = {
  market:    { n: 'Market Board',            icon: 'market', cost: 2e6, max: 20, d: lv => 'Every town sells for ' + (5 * lv) + '% more (+5% a level). Also sets how much auto-sell keeps back.' },
  transport: { n: 'Department of Transport', icon: 'loco',   cost: 3e6, max: 20, d: lv => 'Routes carry ' + (25 * lv) + '% more and pay ' + Math.round(100 - 100 * Math.pow(.9, lv)) + '% less in fees.' },
  bank:      { n: 'Central Bank',            icon: 'vault',  cost: 5e6, max: 10, d: lv => 'Pays ' + (.2 * lv).toFixed(1) + '% interest a minute on coins you hold, on up to ' + (10 * lv) + ' minutes of the empire\'s income.' },
  education: { n: 'Department of Education', icon: 'flask',  cost: 4e6, max: 15, d: lv => 'Charters keep up to ' + (2 * lv) + ' levels of every research, and research costs ' + (5 * lv) + '% less.' },
  exchange:  { n: 'Stock Exchange',          icon: 'chart',  cost: 6e6, max: 10, d: lv => 'Buy and sell shares in your towns. Shareholders get ' + Math.round(100 * exYieldAt(lv)) + '% of a town\'s income as dividends; owning a majority pays that town\'s foremen 50% more.' },
  war:       { n: 'War Office',              icon: 'cannon', cost: 4e6, max: 20, d: lv => 'The budget upgrades a tower in each town every ' + Math.round(warEvery(lv)) + ' seconds (faster each level).' },
};
const capOpen = () => !!(S.capital && S.capital.open);
const capLv = id => (S.capital && S.capital.lv && S.capital.lv[id]) || 0;
const capKeep = () => (capOpen() && S.capital.keep) || 1;
const instCost = id => Math.ceil(INST[id].cost * Math.pow(2.6, capLv(id)));
const warEvery = lv => 300 / (1 + .25 * lv) / (1 + .8 * tk('eng')); // Engineering: from 5 minutes towards 1
const resCost = r => Math.ceil(r.cost * Math.pow(r.g, lv(r.id)) * (1 - .05 * capLv('education')) * tf('academy', .9));
const ACADEMY = ['ledger', 'steam', 'lines', 'haggle', 'guns', 'bounty', 'tools', 'vault', 'mason'];
/* Can the Capital be founded now? */
function capitalReady() { return townOpen(CAPITAL.from) && townBest(CAPITAL.from) >= CAPITAL.best; }
function openCapital() {
  if (capOpen() || !capitalReady() || S.coins < CAPITAL.coins) return false;
  S.coins -= CAPITAL.coins; S.capital.open = 1; S.capital.lv = S.capital.lv || {}; snd('badge', 784, .35, 'triangle', .06, 392); return true;
}
function buyInst(id) {
  if (!capOpen() || capLv(id) >= INST[id].max) return false; const c = instCost(id); if (S.coins < c) return false;
  S.coins -= c; S.capital.lv[id] = capLv(id) + 1; snd('build', 520, .15, 'triangle', .05, 330); return true;
}
/* Split weights as fractions that add up to one. */
function capSplit() { const s = S.capital.split, t = (s.foremen + s.war + s.academy) || 1; return { foremen: s.foremen / t, war: s.war / t, academy: s.academy / t }; }

/* The War Office and the Academy, in whichever town is active (econStep runs this for every town). Each town's
   allowance fills from what that town earns; spending takes real coins. */
function capitalWork(dt, inc) {
  if (!capOpen()) return;
  const sp = capSplit(), cp = S.cpurse || (S.cpurse = { war: 0, acad: 0, last: S.life || 0, t: 30 });
  if (cp.last === undefined || cp.last > (S.life || 0)) cp.last = S.life || 0;
  const earned = (S.life || 0) - cp.last, cap = Math.max(1e3, inc * 1800); cp.last = S.life || 0;
  cp.war = Math.min(cap, cp.war + earned * S.capital.share * sp.war); cp.acad = Math.min(cap, cp.acad + earned * S.capital.share * sp.academy * tf('academy', 1.15));
  // the Academy: the cheapest research still to do, as soon as the allowance holds it
  let best = null; for (const id of ACADEMY) { const r = RESEARCH.find(q => q.id === id); if (!r || lv(id) >= r.max) continue; const c = resCost(r); if (!best || c < best.c) best = { r, c }; }
  if (best && best.c <= cp.acad && S.coins >= best.c) { cp.acad -= best.c; S.coins -= best.c; S.research[best.r.id] = lv(best.r.id) + 1; if (best.r.id === 'vault') S.vaultHp += 5; }
  // the War Office: one tower upgrade every few minutes, the cheapest useful one (paths at level 5 are yours to pick)
  cp.t -= dt; if (cp.t > 0 || !S.towers.length) return;
  let up = null;
  for (const t of S.towers) {
    const d = TOWERS[t.type];
    if (d.drone) for (const k in DRONE) { if (((t.dr && t.dr[k]) || 0) < DRONE[k].max) { const c = droneCost(t, k); if (!up || c < up.c) up = { c, go: () => upgradeDrone(t, k) }; } }
    if (d.troops) { for (const k in TRACKS) if (((t.up && t.up[k]) || 0) < TRACKS[k].max) { const c = trackCost(t, k); if (!up || c < up.c) up = { c, go: () => upgradeTrack(t, k) }; } continue; }
    if (needsBranch(t)) continue; const c = upCost(t); if (!up || c < up.c) up = { c, go: () => upgradeTower(t) };
  }
  if (up && up.c <= cp.war && S.coins >= up.c && up.go()) { cp.war -= up.c; cp.t = warEvery(capLv('war')); } else cp.t = 15; // not enough yet: look again soon
}

/* --- waves in towns you are not looking at ------------------------------------------------------------------------
   A background town on auto fights a wave every 45 seconds: its towers' strength against the wave's health decides it.
   Cleared: the wave's bounty, the next wave. Lost: the vault weakens; when it falls the town loses 10% of its coins'
   share and drops back two waves, so a town too weak for its boss loops at the boss gate. */
const towerEff = st => st.splash || st.cone ? 2.2 : st.chain ? 1 + st.chain * .5 : st.slow ? 3 : st.poison ? 2 : 1;
/* Strength against a wave; with air set, only what reaches the sky (Tesla coils on one target, and drones). */
function townDps(air) {
  let d = 0;
  for (const t of S.towers) {
    if (TOWERS[t.type].troops) { const ts = troopStats(t); if (!air) d += ts.dps * ts.count * .7; if (TOWERS[t.type].drone) { const ds = droneStats(t); d += ds.dmg * ds.rate * .6; } continue; }
    if (air && !reachesAir(t)) continue;
    const st = towerStats(t); d += st.dmg * st.rate * (air ? 1 : towerEff(st));
  }
  return d;
}
/* The map of the town being worked (withTown swaps the town's fields but not the drawn map), and a path's length on it. */
const townMap = () => MAPS[S.map] || MAP;
const wayLen = way => way.reduce((a, p, i) => i ? a + Math.abs(p[0] - way[i - 1][0]) + Math.abs(p[1] - way[i - 1][1]) : 0, 0);
const bossHp = w => foeHp(w) * 25 * townMap().hp * (TOWN.boss.hp || 1);
const waveHp = w => Math.min(8 + Math.floor(w * 1.1), 36) * foeHp(w) * 1.25 * townMap().hp + (w % 10 === 0 ? bossHp(w) : 0);
/* Does this town's defence win wave w? An airship (Thunder Mesa) must also be beaten by what reaches the sky alone. */
function winsWave(w) {
  const M = townMap(), fight = wayLen(M.paths[0]) / 1.1 * .6;
  if (w % 10 !== 0 || M.air === undefined) return townDps() * fight >= waveHp(w);
  const flight = wayLen(M.paths[M.air]) / FOES.boss.spd * .5;
  return townDps() * fight >= waveHp(w) - bossHp(w) && townDps(true) * flight >= bossHp(w);
}
function autoBattle(dt) {
  if (!S.autoWave || !S.towers.length) return; // a town with no towers waits for you
  S.abT = (S.abT === undefined ? 45 : S.abT) - dt; if (S.abT > 0) return; S.abT = 45;
  const w = S.wave, n = Math.min(8 + Math.floor(w * 1.1), 36), M = townMap();
  if (winsWave(w)) {
    earn(n * foeCoins(w) * 1.5 * M.coin + (w % 10 === 0 ? foeCoins(w) * 15 * M.coin : 0)); S.stats.kills += n; if (w % 10 === 0) { exNews('boss'); if (M.air !== undefined) S.stats.airships = (S.stats.airships || 0) + 1; }
    S.wave++; S.best = Math.max(S.best, S.wave); S.vaultHp = Math.min(vaultMax(), S.vaultHp + 1 + lv('mason'));
  } else {
    S.vaultHp -= w % 10 === 0 ? S.vaultHp : Math.ceil(n * .4);
    if (S.vaultHp <= 0) { exNews('vault'); const lost = S.coins * .1; S.coins -= lost; S.wave = Math.max(1, w - 2); S.vaultHp = vaultMax(); }
  }
}
/* --- tech trees -------------------------------------------------------------------------------------------------
   Influence, the government's own currency, builds up while the Capital stands: about the square root of the empire's
   coins per second, each minute, plus 5 for every deed a charter earns. Each branch has five ranks bought in order;
   their effects compound within the branch. Nodes survive charters; only the Constitutional Convention resets them. */
const TECH = {
  econ: { n: 'Economy', home: 'Department of Education', branches: {
    industry:  { n: 'Industry',       icon: 'gear',    d: '+15% gathering and workshop speed per rank' },
    commerce:  { n: 'Commerce',       icon: 'coin',    d: '+10% sale prices per rank' },
    logistics: { n: 'Logistics',      icon: 'wagon',   d: '+20% route capacity and 10% lower fees per rank' },
    admin:     { n: 'Administration', icon: 'foreman', d: 'Foremen cost 15% less to hire and are paid 10% more per rank' },
    academy:   { n: 'Academy',        icon: 'flask',   d: 'Research costs 10% less and the Academy gets 15% more per rank' },
  } },
  war: { n: 'Defence', home: 'War Office', branches: {
    arms:      { n: 'Arms',           icon: 'crossbow', d: '+12% tower damage per rank' },
    eng:       { n: 'Engineering',    icon: 'cannon',   d: 'The War Office upgrades towers far more often (5 minutes towards 1) and upgrades cost 8% less per rank' },
    garrison:  { n: 'Garrison',       icon: 'barracks', d: '+15% soldier and drone strength per rank' },
    fort:      { n: 'Fortification',  icon: 'vault',    d: '+5 vault strength and 15% cheaper repairs per rank' },
  } },
};
const TECH_MAX = 5;
const techCost = b => Math.ceil(10 * Math.pow(3, tk(b))); // 10, 30, 90, 270, 810 a branch
const infRate = () => capOpen() ? Math.sqrt(Math.max(0, CAPI.inc || 0)) / 60 : 0; // Influence per second
function buyTech(b) {
  if (!capOpen() || tk(b) >= TECH_MAX) return false; const c = techCost(b); if ((S.capital.inf || 0) < c) return false;
  S.capital.inf -= c; S.capital.tech = S.capital.tech || {}; S.capital.tech[b] = tk(b) + 1; snd('ms', 660, .25, 'triangle', .06, 440); return true;
}
/* --- the Stock Exchange -------------------------------------------------------------------------------------------
   Each town is a company with 1000 shares. A share's fair price is 3 seconds of that town's income; the market price
   drifts towards it (about two minutes to catch up), with noise every 10 seconds and a mood that news moves: a boss
   beaten or a works doubling its output lifts it, a fallen vault sinks it, and the mood fades back over a few minutes.
   Shareholders get a slice of the town's income as dividends. Over half the shares pays the town's foremen 50% more.
   Buying costs 1% over the price and selling pays 1% under, so a quick buy and sell always loses. Coins only. */
const EX_SHARES = 1000, EX_SPREAD = .01, EX_HIST = 90;
const COMPANY = { gulch: 'Copper Gulch Mining Co.', ridge: 'Iron Ridge Rail', falls: 'Silver Falls Electric', mesa: 'Thunder Mesa Oil' };
const EX_NEWS = {
  boss:  { m: 1.12, s: ' jumps: its town beat a boss' },
  ms:    { m: 1.04, s: ' rises: a works doubled its output' },
  vault: { m: .85,  s: ' slumps: raiders broke the vault' },
};
const exYieldAt = lv => .04 + .01 * lv;
const exYield = () => exYieldAt(capLv('exchange'));
const exOpen = () => capOpen() && capLv('exchange') > 0;
const exFair = id => Math.max(10, ((CAPI.by && CAPI.by[id]) || 0) * 3);
function exBook() { const c = S.capital; if (!c.ex || !c.ex.s) c.ex = { s: {}, news: [], t: 0 }; return c.ex; }
function exStock(id) { const x = exBook(); return x.s[id] || (x.s[id] = { p: exFair(id), own: 0, cost: 0, mood: 1, hist: [], paid: 0 }); }
const exOwn = id => (S.capital && S.capital.ex && S.capital.ex.s && S.capital.ex.s[id] && S.capital.ex.s[id].own) || 0;
const exMajority = id => exOwn(id) > EX_SHARES / 2;
const exBoost = () => exMajority(TOWN_ID) ? 1.5 : 1; // the foremen of the town being worked
const exBuyPrice = id => exStock(id).p * (1 + EX_SPREAD), exSellPrice = id => exStock(id).p * (1 - EX_SPREAD);
/* News from whichever town is being worked (TOWN_ID): moves its share's mood and goes on the ticker. */
function exNews(kind) {
  if (!exOpen() || !townOpen(TOWN_ID)) return; const N = EX_NEWS[kind], st = exStock(TOWN_ID), x = exBook();
  st.mood = Math.max(.5, Math.min(2, st.mood * Math.pow(N.m, polIs('econ', 'planned') ? .5 : 1)));
  x.news.unshift({ id: TOWN_ID, k: kind, s: COMPANY[TOWN_ID] + N.s, at: Date.now() }); if (x.news.length > 8) x.news.length = 8;
}
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2; // about a standard normal
/* Once a tick for the empire (econTowns): dividends every tick, prices every 10 seconds. */
function exchangeWork(dt) {
  if (!exOpen()) return; const x = exBook();
  x.t = (x.t || 0) - dt; const step = x.t <= 0; if (step) x.t = 10;
  for (const id of townIds().filter(townOpen)) {
    const st = exStock(id), inc = (CAPI.by && CAPI.by[id]) || 0;
    if (st.own > 0 && inc > 0) { const d = inc * exYield() * st.own / EX_SHARES * dt; earn(d); st.paid = (st.paid || 0) + d; }
    if (!step) continue;
    const span = Math.max(10, dt), f = exFair(id) * st.mood;
    if (!st.hist.length || !(st.p > 0)) st.p = f;
    else st.p = Math.exp(Math.log(st.p) + (Math.log(f) - Math.log(st.p)) * (1 - Math.exp(-span / 120)) + gauss() * .025 * (polIs('econ', 'free') ? 1.6 : polIs('econ', 'planned') ? .4 : 1));
    st.mood = 1 + (st.mood - 1) * Math.exp(-span / 240);
    st.hist.push(st.p); if (st.hist.length > EX_HIST) st.hist.splice(0, st.hist.length - EX_HIST);
  }
}
function exBuy(id, n) {
  if (!exOpen() || !townOpen(id)) return 0; const st = exStock(id), pr = exBuyPrice(id);
  n = Math.min(Math.floor(n), EX_SHARES - st.own, Math.floor(S.coins / pr)); if (!(n > 0)) return 0;
  S.coins -= n * pr; st.own += n; st.cost = (st.cost || 0) + n * pr; snd('coin', 880, .08, 'square', .03, 220); return n;
}
function exSell(id, n) {
  if (!exOpen()) return 0; const st = exStock(id); n = Math.min(Math.floor(n), st.own); if (!(n > 0)) return 0;
  const pr = exSellPrice(id); S.coins += n * pr; st.cost = (st.cost || 0) * (st.own - n) / st.own; st.own -= n; snd('coin', 660, .08, 'square', .03, -220); return n;
}
/* What research survives a charter: the Department of Education keeps up to 2 levels of each per level. */
function eduKeep(r) { const n = 2 * capLv('education'), o = {}; if (n) for (const k in r) o[k] = Math.min(r[k], n); return o; }
/* Interest from the Central Bank, once a tick for the whole empire. */
function bankWork(dt, empireInc) {
  if (capOpen()) S.capital.inf = (S.capital.inf || 0) + Math.sqrt(Math.max(0, empireInc)) / 60 * dt; // Influence builds up here too, once a tick
  const l = capLv('bank'); if (!capOpen() || !l) return;
  const base = Math.min(S.coins, empireInc * 600 * l); if (base > 0) earn(base * .002 * l / 60 * dt * (polIs('econ', 'free') ? 2 : 1));
}
