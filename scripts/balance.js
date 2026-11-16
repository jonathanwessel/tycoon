// Balance bot: node scripts/balance.js [minutes=120] [seed runs=1]
// Plays the real game logic with a simple greedy policy, with no drawing,
// and reports how long it takes to reach each milestone.
const MINUTES = +process.argv[2] || 120;
const RUNS = +process.argv[3] || 1;

function bot(MINUTES) {
  const log = [], marks = {}, mark = (k, t) => { if (!(k in marks)) marks[k] = Math.round(t); };
  S.stats.vaultSeen = 1; // a player taps the vault when the goal asks; the bot has no hands
  const free = () => PLOTS.find(p => !S.towers.some(t => t.c === p.x && t.r === p.y));
  let goals = 0, t = 0, lastBuy = 0, longestWait = 0, breaches = 0, lastWave = S.wave, leakedThisWave = false, vaultSeen = S.vaultHp;
  const eff = st => st.splash || st.cone ? 2.2 : st.chain ? 1 + st.chain * .5 : st.slow ? 3 : 1;
  const towerDps = () => S.towers.reduce((a, tw) => { const st = towerStats(tw); return a + (tw.jam > 0 ? 0 : st.dmg * st.rate * eff(st)); }, 0);
  const waveHp = w => { const n = Math.min(8 + Math.floor(w * 1.1), 36); return n * foeHp(w) * 1.25 + (w % 10 === 0 ? foeHp(w) * 25 : 0); };
  const spent = () => { lastBuy = t; };
  const coinOf = k => ITEMS[k].p * sellMult();
  const m2 = l => Math.pow(2, MS(l));
  // analytic flows at current levels
  function flows(extra) {
    const prod = {}, use = {};
    for (const k in ITEMS) { prod[k] = 0; use[k] = 0; }
    for (const e of EXT) { const l = (S.ext[e.id] || 0) + (extra === e.id ? 1 : 0); prod[e.out] += l * e.rate * prodMult() * m2(l); }
    for (const s of SHOPS) { const l = (S.shops[s.id] || 0) + (extra === s.id ? 1 : 0), r = l * s.rate * craftMult() * m2(l); for (const k in s.in) use[k] += r * s.in[k]; prod[s.out] += r; }
    return { prod, use };
  }
  function income(f) { let v = 0; for (const k in ITEMS) v += Math.max(0, f.prod[k] - f.use[k]) * coinOf(k); return v; }
  function econOptions() {
    const base = income(flows()), opts = [];
    for (const b of BUILD) {
      const id = b.def.id, have = S[b.kind][id] || 0, cost = bCost(b, have);
      const f = flows(id); let ok = true;
      if (b.kind === 'shops') for (const k in b.def.in) if (f.prod[k] < f.use[k] * .98) ok = false;
      if (!ok) continue;
      const gain = income(f) - base; if (gain <= 0) continue;
      opts.push({ cost, score: cost / gain, buy: () => { S.coins -= cost; S[b.kind][id] = have + 1; S.seen[b.def.out] = 1; leveled(b, have, have + 1, true); } });
    }
    return opts;
  }
  function researchOptions(inc) {
    const opts = [];
    for (const r of RESEARCH) {
      const l = lv(r.id); if (l >= r.max) continue; const cost = Math.ceil(r.cost * Math.pow(r.g, l));
      let gain = 0;
      if (r.id === 'steam' || r.id === 'lines') gain = inc * .18;
      else if (r.id === 'haggle') gain = inc * .09;
      else if (r.id === 'tools' && t < 900) gain = 2 * tapYield() * 1;
      else if (r.id === 'ledger') gain = inc * .2;
      else continue;
      opts.push({ cost, score: cost / Math.max(gain, 1e-9), buy: () => { S.coins -= cost; S.research[r.id] = l + 1; } });
    }
    return opts;
  }
  function defend() {
    const need = waveHp(S.wave) / 14 * (leakedThisWave ? 1.6 : 1.1);
    if (towerDps() >= need) return false;
    // candidates: new tower of each type, upgrade of each tower, research guns
    let best = null;
    const consider = (cost, dps, buy, goods) => { if (goods && !hasGoods(goods)) return; const sc = cost / dps; if (!best || sc < best.sc) best = { sc, cost, buy }; };
    const p = free();
    for (const id in TOWERS) {
      const d = TOWERS[id]; if (!p) break; const c = buildCost(id);
      const s0 = towerStats({ type: id, lvl: 0 }), dps = s0.dmg * s0.rate * eff(s0);
      const goodsVal = Object.keys(d.goods).reduce((a, k) => a + d.goods[k] * coinOf(k), 0);
      consider(c + goodsVal, dps, () => { buildTower(id, p.x, p.y); mark('tower:' + id, t); }, d.goods);
    }
    for (const tw of S.towers) {
      const st = towerStats(tw), base = st.dmg * st.rate * eff(st);
      if (needsBranch(tw)) { const pref = { crossbow: 'b', cannon: 'a', frost: 'b', tesla: 'a', gatling: 'b' }[tw.type], nt = Object.assign({}, tw, { br: pref, lvl: tw.lvl + 1 }), s2 = towerStats(nt);
        consider(branchCost(tw), Math.max(1e-9, s2.dmg * s2.rate * eff(s2) - base), () => { branchTower(tw, pref); mark('branch', t); }); }
      else consider(upCost(tw), base * .45, () => upgradeTower(tw));
    }
    if (lv('guns') < 99) { const c = Math.ceil(400 * Math.pow(2.2, lv('guns'))); consider(c, towerDps() * .15, () => { S.coins -= c; S.research.guns = lv('guns') + 1; }); }
    if (best && S.coins >= best.cost) { best.buy(); spent(); return true; }
    // want goods for towers: make sure we are not selling them
    return 'saving';
  }
  // reserves of goods kept for towers
  const reserve = { plank: 5, ingot: 12, lens: 8, gear: 10, engine: 2, steel: 10, clock: 4 };
  const DT = .05; let tapAcc = 0, econAcc = 0, decide = 0;
  while (t < MINUTES * 60) {
    combat(DT); econAcc += DT; if (econAcc >= .5) { econ(econAcc); econAcc = 0; } t += DT;
    if (t < 1200) { tapAcc += DT * 2; while (tapAcc >= 1) { tapAcc--; add(Math.random() < .5 ? 'wood' : 'ore', tapYield()); } }
    if (S.vaultHp < vaultSeen) leakedThisWave = true; vaultSeen = S.vaultHp;
    if (S.wave !== lastWave) { if (S.wave < lastWave) { breaches++; log.push('breach at ' + Math.round(t) + 's wave ' + lastWave); } lastWave = S.wave; leakedThisWave = false; mark('wave' + S.wave, t); }
    if (deedsOnOffer() > 0) mark('firstDeed', t);
    decide -= DT; if (decide > 0) continue; decide = 1;
    longestWait = Math.max(longestWait, t - lastBuy);
    // contracts
    while (S.contracts.length < 3) S.contracts.push(newContract());
    S.contracts.forEach((c, i) => { if (S.res[c.k] - (reserve[c.k] || 0) >= c.qty) deliver(i); });
    { const g = goalNow(); if (g.cur >= g.need) { claimGoal(); goals++; } }
    let d = defend();
    // sell surplus
    for (const k in ITEMS) { const keep = (reserve[k] || 0) * (d === 'saving' ? 2 : 1), n = Math.floor(S.res[k] - keep); if (n > 0 && dem(k) > .7) sell(k, n); }
    if (d === true) continue;
    const inc = income(flows());
    const opts = [...econOptions(), ...researchOptions(inc)].sort((a, b) => a.score - b.score);
    const o = opts[0];
    if (o && d === 'saving' && S.towers.length && o.cost > S.coins * .5) continue;
    if (o && S.coins >= o.cost) { o.buy(); spent(); }
  }
  return { marks, goals, coins: S.coins, life: S.life, breaches, longestWait: Math.round(longestWait), wave: S.wave, best: S.best, towers: S.towers.map(t => ({crossbow:'X',cannon:'C',frost:'F',tesla:'T',gatling:'G'})[t.type] + t.lvl + (t.br || '')).join(' '), levels: JSON.stringify(Object.assign({}, S.ext, S.shops)), log: log.slice(0, 6) };
}

(async () => {
  // The bot runs the game's own simulation files in Node (scripts/sim.js): no browser, and much faster.
  for (let run = 0; run < RUNS; run++) {
    const errs = []; let r;
    try { r = require('./sim').load().run('(' + bot + ')(' + MINUTES + ')'); } catch (e) { errs.push(e.stack); r = { marks: {}, log: [] }; }
    const m = r.marks, fmt = s => s == null ? '-' : (s / 60).toFixed(1) + 'm';
    console.log(`run ${run + 1}: first tower ${fmt(m['tower:crossbow'])} | wave5 ${fmt(m.wave5)} | wave10 ${fmt(m.wave10)} | wave11 ${fmt(m.wave11)} | wave20 ${fmt(m.wave20)} | wave30 ${fmt(m.wave30)} | wave50 ${fmt(m.wave50)} | first deed ${fmt(m.firstDeed)}`);
    console.log(`  reached wave ${r.wave} (best ${r.best}), breaches ${r.breaches}, longest gap between buys ${r.longestWait}s, goals ${r.goals}, lifetime coins ${Math.round(r.life).toExponential(2)}, first path pick ${fmt(m.branch)}`);
    console.log('  towers first built:', Object.keys(m).filter(k => k.startsWith('tower:')).map(k => k.slice(6) + ' ' + fmt(m[k])).join(', '));
    console.log('  towers:', r.towers, ' levels:', r.levels);
    if (r.log.length) console.log('  ' + r.log.join('; '));
    if (errs.length) console.log('  ERRORS', errs);
  }
})();
