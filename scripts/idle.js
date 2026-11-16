// Idle empire bot: node scripts/idle.js [hours=6]
// Every building in all three towns starts at level 1 with a foreman on it, every good on auto-sell, the suggested
// shipping routes running. Nobody touches anything. Every 10 minutes (game time) it logs, per town: income,
// the share of time any workshop was starved, and how long the foremen have gone without buying. Then it checks that
// the empire grows by itself: income rises every hour, no workshop stands idle, foremen keep buying (a save never longer than 45 min: costs grow 17-19% a level, so late saves get long).
const { load } = require('./sim');
const HOURS = +process.argv[2] || 6;
const g = load();
const out = g.run(`(() => {
  S = fresh(); setMap('gulch'); S.coins = 5e6; S.best = 40;
  const setup = () => { for (const b of BUILD) { S[b.kind][b.def.id] = Math.max(1, S[b.kind][b.def.id] || 0); S.mgr[b.def.id] = 1; } S.research.ledger = 1; for (const k in ITEMS) S.auto[k] = 1; S.fb = { share: ${+(process.env.SHARE || 1)}, keep: 0, purse: 0, last: S.stats.coins, study: 1 }; };
  setup();
  S.towns.ridge = townFresh('ridge'); S.towns.falls = townFresh('falls');
  for (const id of ['ridge', 'falls']) withTown(id, setup);
  S.railOpen = 1; // as in play: the first Locomotive Works brings trains to every route
  // the routes the Empire tab suggests: every good a town needs, from the first town that makes it
  const made = id => new Set([...TOWNS[id].ext, ...TOWNS[id].shops].map(b => BY_ALL[b].def.out).filter(Boolean));
  for (const to of townIds()) for (const s of TOWNS[to].shops) for (const k in BY_ALL[s].def.in) if (!made(to).has(k)) {
    const from = townIds().find(f => f !== to && made(f).has(k)); if (from && !S.routes.some(r => r.to === to && r.k === k)) S.routes.push({ id: Math.random(), from, to, k, per: ${process.env.FIXED ? 1 : 0} ? 60 : 'auto', sent: 0 });
  }
  const ids = townIds(), lifeOf = id => id === S.town ? S.life : S.towns[id].life, lvls = id => withTown(id, () => BUILD.reduce((a, b) => a + blv(b.def.id), 0));
  const starve = {}, lastBuy = {}, lastLv = {}, maxWait = {}, log = [], start = {};
  for (const id of ids) { starve[id] = 0; lastBuy[id] = 0; lastLv[id] = lvls(id); maxWait[id] = 0; start[id] = lifeOf(id); }
  let prevLife = {}; for (const id of ids) prevLife[id] = lifeOf(id);
  const dt = 1, total = ${HOURS} * 3600;
  for (let t = 0; t < total; t += dt) {
    econTowns(dt);
    for (const id of ids) {
      withTown(id, () => { if (SHOPS.some(s => blv(s.id) && !S.off[s.id] && (ACT[s.id] || 0) < .08)) starve[id] += dt; }); // a workshop standing still
      const l = lvls(id); if (l !== lastLv[id]) { lastLv[id] = l; lastBuy[id] = t; } maxWait[id] = Math.max(maxWait[id], t - lastBuy[id]);
    }
    if ((t + dt) % 600 === 0) {
      const row = { min: (t + dt) / 60 };
      for (const id of ids) { const inc = (lifeOf(id) - prevLife[id]) / 600; prevLife[id] = lifeOf(id); row[id] = { inc: Math.round(inc), starved: Math.round(100 * starve[id] / 600) + '%', lv: lvls(id), goal: withTown(id, () => S.fb && S.fb.goal) }; starve[id] = 0; }
      log.push(row);
    }
  }
  const ships = S.routes.map(r => r.k + ' ' + r.from + '>' + r.to + ' ' + Math.round(r.sent || 0));
  const lv = {}; for (const id of ids) lv[id] = withTown(id, () => BUILD.map(b => b.def.id + ':' + blv(b.def.id)).join(' '));
  const dbg = ${process.env.DBG ? 1 : 0} ? withTown('ridge', () => { const base = steadyIncome(), f = chainFlow(); return { base, gains: Object.fromEntries(BUILD.map(b => [b.def.id, [Math.round(steadyIncome(b.def.id) - base), bCost(b, blv(b.def.id)), Math.round((ACT[b.def.id]||0)*100)]])), have: Object.fromEntries(Object.entries(f.have).filter(e => e[1])), need: f.need, inbox: S.routes.map(r => r.k + ':' + Math.round(routeRate(r))) , purse: S.fb.purse, goal: S.fb.goal, coins: S.coins }; }) : null;
  return JSON.stringify({ log, maxWait, ships, lv, dbg });
})()`);
const r = JSON.parse(out), ids = Object.keys(r.maxWait); if (r.dbg) console.log(JSON.stringify(r.dbg, null, 1));
console.log('min  ' + ids.map(id => (id + ' income/s  idle  levels').padEnd(40)).join(''));
for (const row of r.log) console.log(String(row.min).padStart(4) + ' ' + ids.map(id => (String(row[id].inc).padStart(9) + String(row[id].starved).padStart(7) + String(row[id].lv).padStart(7) + '  ' + (row[id].goal || '-')).padEnd(40)).join(''));
console.log('routes:', r.ships.join(' | '));
for (const id of ids) console.log(id + ':', r.lv[id], '· longest wait for a purchase', Math.round(r.maxWait[id] / 60), 'min');
// pass/fail
const fails = [];
for (const id of ids) {
  for (let i = 6; i < r.log.length; i += 6) if (!(r.log[i][id].inc > r.log[i - 6][id].inc)) { fails.push(id + ': income did not rise in the hour to ' + r.log[i].min + ' min'); break; }
  const late = r.log.slice(3).map(x => parseInt(x[id].starved)); const avg = late.reduce((a, b) => a + b, 0) / Math.max(1, late.length);
  if (avg > 10) fails.push(id + ': a workshop stood idle ' + Math.round(avg) + '% of the time');
  if (r.maxWait[id] > 2700) fails.push(id + ': foremen went ' + Math.round(r.maxWait[id] / 60) + ' min without buying');
}
console.log(fails.length ? 'FAIL\n  ' + fails.join('\n  ') : 'PASS');
process.exit(fails.length ? 1 : 0);
