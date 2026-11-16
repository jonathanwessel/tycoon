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
  war:       { n: 'War Office',              icon: 'cannon', cost: 4e6, max: 20, d: lv => 'The budget upgrades a tower in each town every ' + Math.round(warEvery(lv)) + ' seconds (faster each level).' },
};
const capOpen = () => !!(S.capital && S.capital.open);
const capLv = id => (S.capital && S.capital.lv && S.capital.lv[id]) || 0;
const capKeep = () => (capOpen() && S.capital.keep) || 1;
const instCost = id => Math.ceil(INST[id].cost * Math.pow(2.6, capLv(id)));
const warEvery = lv => 300 / (1 + .25 * lv);
const resCost = r => Math.ceil(r.cost * Math.pow(r.g, lv(r.id)) * (1 - .05 * capLv('education')));
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
  cp.war = Math.min(cap, cp.war + earned * S.capital.share * sp.war); cp.acad = Math.min(cap, cp.acad + earned * S.capital.share * sp.academy);
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
function townDps() {
  let d = 0;
  for (const t of S.towers) {
    if (TOWERS[t.type].troops) { const ts = troopStats(t); d += ts.dps * ts.count * .7; if (TOWERS[t.type].drone) { const ds = droneStats(t); d += ds.dmg * ds.rate * .6; } continue; }
    const st = towerStats(t); d += st.dmg * st.rate * towerEff(st);
  }
  return d;
}
const waveHp = w => Math.min(8 + Math.floor(w * 1.1), 36) * foeHp(w) * 1.25 * MAP.hp + (w % 10 === 0 ? foeHp(w) * 25 * MAP.hp : 0);
function autoBattle(dt) {
  if (!S.autoWave || !S.towers.length) return; // a town with no towers waits for you
  S.abT = (S.abT === undefined ? 45 : S.abT) - dt; if (S.abT > 0) return; S.abT = 45;
  const w = S.wave, fight = (PATHS[0] ? PATHS[0].len : 25) / 1.1 * .6, n = Math.min(8 + Math.floor(w * 1.1), 36);
  if (townDps() * fight >= waveHp(w)) {
    earn(n * foeCoins(w) * 1.5 * MAP.coin + (w % 10 === 0 ? foeCoins(w) * 15 * MAP.coin : 0)); S.stats.kills += n;
    S.wave++; S.best = Math.max(S.best, S.wave); S.vaultHp = Math.min(vaultMax(), S.vaultHp + 1 + lv('mason'));
  } else {
    S.vaultHp -= w % 10 === 0 ? S.vaultHp : Math.ceil(n * .4);
    if (S.vaultHp <= 0) { const lost = S.coins * .1; S.coins -= lost; S.wave = Math.max(1, w - 2); S.vaultHp = vaultMax(); }
  }
}
/* What research survives a charter: the Department of Education keeps up to 2 levels of each per level. */
function eduKeep(r) { const n = 2 * capLv('education'), o = {}; if (n) for (const k in r) o[k] = Math.min(r[k], n); return o; }
/* Interest from the Central Bank, once a tick for the whole empire. */
function bankWork(dt, empireInc) {
  const l = capLv('bank'); if (!capOpen() || !l) return;
  const base = Math.min(S.coins, empireInc * 600 * l); if (base > 0) earn(base * .002 * l / 60 * dt);
}
