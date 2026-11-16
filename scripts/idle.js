// Idle empire bot: node scripts/idle.js [hours=6]
// Every building in all three towns starts at level 1 with a foreman on it, every good on auto-sell, the suggested
// shipping routes running. Nobody touches anything. Every 10 minutes (game time) it logs, per town: income,
// the share of time any workshop was starved, and how long the foremen have gone without buying. Then it checks that
// the empire grows by itself: income rises every hour, no workshop stands idle, foremen keep buying (a save never longer than 45 min: costs grow 17-19% a level, so late saves get long).
// Then it holds a Constitutional Convention and lives a second life from the same start with the Legacy it paid, and
// checks the Convention is clearly worth it: the second life reaches the first life's peak income in under 40% of the time.
const { load } = require('./sim');
const HOURS = +process.argv[2] || 6;
const g = load();
const out = g.run(`(() => {
  const setup = () => { for (const b of BUILD) { S[b.kind][b.def.id] = Math.max(1, S[b.kind][b.def.id] || 0); S.mgr[b.def.id] = 1; } S.research.ledger = 1; for (const k in ITEMS) S.auto[k] = 1; S.fb = { share: ${+(process.env.SHARE || 1)}, keep: 0, purse: 0, last: S.stats.coins, study: 1 }; };
  const start = () => {
    setMap('gulch'); S.coins = 5e6; S.best = 40;
    setup();
    S.towns.ridge = townFresh('ridge'); S.towns.falls = townFresh('falls');
    for (const id of ['ridge', 'falls']) withTown(id, setup);
    S.railOpen = 1; // as in play: the first Locomotive Works brings trains to every route
    // the routes the Empire tab suggests: every good a town needs, from the first town that makes it
    const made = id => new Set([...TOWNS[id].ext, ...TOWNS[id].shops].map(b => BY_ALL[b].def.out).filter(Boolean));
    for (const to of townIds()) for (const s of TOWNS[to].shops) for (const k in BY_ALL[s].def.in) if (!made(to).has(k)) {
      const from = townIds().find(f => f !== to && made(f).has(k)); if (from && !S.routes.some(r => r.to === to && r.k === k)) S.routes.push({ id: Math.random(), from, to, k, per: ${process.env.FIXED ? 1 : 0} ? 60 : 'auto', sent: 0 });
    }
  };
  const lifeOf = id => id === S.town ? S.life : S.towns[id].life, lvls = id => withTown(id, () => BUILD.reduce((a, b) => a + blv(b.def.id), 0));
  // live for a number of seconds, logging every 10 minutes; stop early once the empire's income reaches stopAt
  const live = (total, stopAt) => {
    const ids = townIds(), starve = {}, lastBuy = {}, lastLv = {}, maxWait = {}, log = [], prevLife = {};
    for (const id of ids) { starve[id] = 0; lastBuy[id] = 0; lastLv[id] = lvls(id); maxWait[id] = 0; prevLife[id] = lifeOf(id); }
    const dt = 1;
    for (let t = 0; t < total; t += dt) {
      econTowns(dt);
      for (const id of ids) {
        withTown(id, () => { if (SHOPS.some(s => blv(s.id) && !S.off[s.id] && (ACT[s.id] || 0) < .08)) starve[id] += dt; }); // a workshop standing still
        const l = lvls(id); if (l !== lastLv[id]) { lastLv[id] = l; lastBuy[id] = t; } maxWait[id] = Math.max(maxWait[id], t - lastBuy[id]);
      }
      if ((t + dt) % 600 === 0) {
        const row = { min: (t + dt) / 60, all: 0 };
        for (const id of ids) { const inc = (lifeOf(id) - prevLife[id]) / 600; prevLife[id] = lifeOf(id); row.all += inc; row[id] = { inc: Math.round(inc), pot: Math.round(townIncome(id)), starved: Math.round(100 * starve[id] / 600) + '%', lv: lvls(id), goal: withTown(id, () => S.fb && S.fb.goal) }; starve[id] = 0; }
        log.push(row); if (stopAt && row.all >= stopAt) break;
      }
    }
    return { log, maxWait };
  };
  S = fresh(); start();
  const total = ${HOURS} * 3600, one = live(total);
  const ships = S.routes.map(r => r.k + ' ' + r.from + '>' + r.to + ' ' + Math.round(r.sent || 0));
  const lv = {}; for (const id of townIds()) lv[id] = withTown(id, () => BUILD.map(b => b.def.id + ':' + blv(b.def.id)).join(' '));
  const dbg = ${process.env.DBG ? 1 : 0} ? withTown('ridge', () => { const base = steadyIncome(), f = chainFlow(); return { base, gains: Object.fromEntries(BUILD.map(b => [b.def.id, [Math.round(steadyIncome(b.def.id) - base), bCost(b, blv(b.def.id)), Math.round((ACT[b.def.id]||0)*100)]])), have: Object.fromEntries(Object.entries(f.have).filter(e => e[1])), need: f.need, inbox: S.routes.map(r => r.k + ':' + Math.round(routeRate(r))) , purse: S.fb.purse, goal: S.fb.goal, coins: S.coins }; }) : null;
  // the second life: the Convention needs the Capital, so it is founded just before (the second life starts without it, as the first did)
  const peak = Math.max(...one.log.map(r => r.all)); S.capital.open = 1;
  const L = legacyParts(), paid = convene(); start();
  const two = paid ? live(total * .4, peak) : { log: [] }, hit = two.log.find(r => r.all >= peak);
  return JSON.stringify({ log: one.log, maxWait: one.maxWait, ships, lv, dbg, second: { L, paid, mult: legacyMult(), peak, reach: hit ? hit.min : null, log: two.log.map(r => [r.min, Math.round(r.all)]) } });
})()`);
const r = JSON.parse(out), ids = Object.keys(r.maxWait); if (r.dbg) console.log(JSON.stringify(r.dbg, null, 1));
console.log('min  ' + ids.map(id => (id + ' income/s  steady  idle  levels').padEnd(48)).join(''));
for (const row of r.log) console.log(String(row.min).padStart(4) + ' ' + ids.map(id => (String(row[id].inc).padStart(9) + String(row[id].pot).padStart(8) + String(row[id].starved).padStart(7) + String(row[id].lv).padStart(7) + '  ' + (row[id].goal || '-')).padEnd(48)).join(''));
console.log('routes:', r.ships.join(' | '));
for (const id of ids) console.log(id + ':', r.lv[id], '· longest wait for a purchase', Math.round(r.maxWait[id] / 60), 'min');
const s = r.second, lifeMin = HOURS * 60, peakAt = (r.log.find(x => x.all >= s.peak) || {}).min;
console.log('Convention: ' + s.paid + ' Legacy (income ' + s.L.inc + ', wave ' + s.L.wave + ', deeds ' + s.L.deeds + ' from ' + Math.round(s.L.run).toExponential(2) + ' coins), x' + s.mult.toFixed(2));
console.log('second life, empire income/s every 10 min:', s.log.map(x => x[1]).join(' '));
console.log('first life peak ' + Math.round(s.peak) + '/s at ' + peakAt + ' min; second life ' + (s.reach ? 'reached it at ' + s.reach + ' min (' + Math.round(100 * s.reach / peakAt) + '%)' : 'did not reach it within ' + Math.round(lifeMin * .4) + ' min'));
// pass/fail
const fails = [];
for (const id of ids) {
  // the economy grows every hour: the steady income the foremen build (booms and busts swing the coins actually earned
  // by up to a third for a few minutes, more than a late hour's growth, so they are left out of this one)
  const hr = (id, j, f) => { let v = 0; for (let k = j - 5; k <= j; k++) v += r.log[k][id][f]; return v / 6; };
  for (let i = 11; i < r.log.length; i += 6) if (!(hr(id, i, 'pot') > hr(id, i - 6, 'pot'))) { fails.push(id + ': income did not rise in the hour to ' + r.log[i].min + ' min'); break; }
  // and the coins really come in: over the last two hours the town earned at least 80% of that steady income
  const tail = r.log.slice(-12), got = tail.reduce((a, x) => a + x[id].inc, 0), pot = tail.reduce((a, x) => a + x[id].pot, 0);
  if (!(got >= .8 * pot)) fails.push(id + ': earned only ' + Math.round(100 * got / pot) + '% of its steady income over the last two hours');
  const late = r.log.slice(3).map(x => parseInt(x[id].starved)); const avg = late.reduce((a, b) => a + b, 0) / Math.max(1, late.length);
  if (avg > 10) fails.push(id + ': a workshop stood idle ' + Math.round(avg) + '% of the time');
  if (r.maxWait[id] > 2700) fails.push(id + ': foremen went ' + Math.round(r.maxWait[id] / 60) + ' min without buying');
}
if (!s.paid) fails.push('the Convention paid no Legacy');
else if (!s.reach || s.reach >= .4 * peakAt) fails.push('the second life took too long to reach the first life\'s peak income');
console.log(fails.length ? 'FAIL\n  ' + fails.join('\n  ') : 'PASS');
process.exit(fails.length ? 1 : 0);
