// node --test — market depth: booms and busts, caravan orders with deadlines and reputation, auto-sell modes.
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('../scripts/sim');
const near = (a, b, msg, e = 1e-6) => assert.ok(Math.abs(a - b) <= e * Math.max(1, Math.abs(b)), msg + ': ' + a + ' vs ' + b);
const town = g => g.run(`S = fresh(); setMap('gulch'); useTown('gulch'); S.research.ledger = 1; S.seen.plank = 1;`);

test('a boom or bust changes what a sale pays now, not the steady income foremen plan with', () => {
  const g = load(); town(g);
  const p0 = g.run(`price('plank')`), v0 = g.run(`sellValue('plank', 50)`), s0 = g.run(`steadyPrice('plank', 1)`);
  g.run(`S.mkt.ev.plank = { m: 1.6, t: 100, T: 100 }`);
  near(g.run(`price('plank')`), p0 * 1.6, 'boom price'); near(g.run(`sellValue('plank', 50)`), v0 * 1.6, 'boom sale');
  near(g.run(`steadyPrice('plank', 1)`), s0, 'steady price untouched');
  g.run(`S.mkt.ev.plank.m = .5`); near(g.run(`price('plank')`), p0 * .5, 'bust price');
});

test('booms and busts come every few minutes on goods the town has seen, at most two, and pass', () => {
  const g = load(); town(g);
  g.run(`S.seen = { wood: 1, ore: 1, plank: 1 }; S.mkt = { ev: {}, next: 240 }`);
  g.run('mktTick(239)'); assert.strictEqual(g.run('Object.keys(S.mkt.ev).length'), 0, 'nothing before the first delay');
  g.run('mktTick(2)'); assert.strictEqual(g.run('Object.keys(S.mkt.ev).length'), 1, 'one starts');
  const k = g.run('Object.keys(S.mkt.ev)[0]'); assert.ok(['wood', 'ore', 'plank'].includes(k), 'a seen good: ' + k);
  const e = g.run(`S.mkt.ev[${JSON.stringify(k)}]`); assert.ok(e.m >= 1.4 && e.m <= 1.8 || e.m >= .5 && e.m <= .65, 'a boom or a bust: ' + e.m);
  assert.ok(e.T >= 180 && e.T <= 360, 'three to six minutes: ' + e.T);
  // force more to start: never more than two at once
  for (let i = 0; i < 5; i++) g.run('S.mkt.next = 0; mktTick(.01)');
  assert.ok(g.run('Object.keys(S.mkt.ev).length') <= 2, 'at most two');
  g.run('S.mkt.next = 1e9; mktTick(400)'); assert.strictEqual(g.run('Object.keys(S.mkt.ev).length'), 0, 'they pass');
  // over many hours booms and busts both happen and the average multiplier stays near even
  g.run(`Math.random = (() => { let x = 7; return () => (x = (x * 16807) % 2147483647) / 2147483647; })(); S.mkt = { ev: {}, next: 0 };
    var up = 0, down = 0, acc = 0, n = 0; for (let i = 0; i < 36000; i++) { mktTick(1); for (const k of ['wood', 'ore', 'plank']) { const m = mktMult(k); if (m > 1) up++; if (m < 1) down++; acc += m; n++; } }`);
  assert.ok(g.run('up') > 0 && g.run('down') > 0, 'both kinds');
  const avg = g.run('acc / n'); assert.ok(avg > .95 && avg < 1.15, 'averages out: ' + avg);
});

test('econTowns runs the market for the whole empire', () => {
  const g = load(); town(g); g.run('S.mkt = { ev: {}, next: 3 }; econTowns(1); econTowns(1); econTowns(1.5)');
  assert.strictEqual(g.run('Object.keys(S.mkt.ev).length'), 1);
});

test('auto-sell modes: always, skip busts and booms only', () => {
  const g = load(); town(g);
  const setup = mode => g.run(`S.demand = {}; S.mkt.ev = {}; S.res.plank = 500; S.auto = { plank: ${JSON.stringify(mode)} }; S.sellAbove = 0;`);
  setup(true); g.run('autoSell()'); assert.strictEqual(g.run('S.res.plank'), g.run(`keepOf('plank')`), 'always: sells down to the keep');
  setup(false); g.run('autoSell()'); assert.strictEqual(g.run('S.res.plank'), 500, 'off: keeps it');
  // skip busts: sells normally, holds while the good is in a bust, sells the backlog once it is over
  setup('bust'); g.run('autoSell()'); assert.strictEqual(g.run('S.res.plank'), g.run(`keepOf('plank')`), 'skip busts sells in a calm market');
  setup('bust'); g.run(`S.mkt.ev.plank = { m: .5, t: 60, T: 60 }; autoSell()`); assert.strictEqual(g.run('S.res.plank'), 500, 'holds in a bust');
  g.run(`delete S.mkt.ev.plank; autoSell()`); assert.strictEqual(g.run('S.res.plank'), g.run(`keepOf('plank')`), 'sells once it passes');
  // booms only: keeps everything until the good booms
  setup('boom'); g.run('autoSell()'); assert.strictEqual(g.run('S.res.plank'), 500, 'booms only holds');
  g.run(`S.mkt.ev.plank = { m: 1.5, t: 60, T: 60 }; autoSell()`); assert.strictEqual(g.run('S.res.plank'), g.run(`keepOf('plank')`), 'sells in a boom');
  // always respects the price threshold, measured on the price with the boom or bust
  setup(true); g.run(`S.sellAbove = .8; S.mkt.ev.plank = { m: .6, t: 60, T: 60 }; autoSell()`); assert.strictEqual(g.run('S.res.plank'), 500, 'a bust under the threshold waits');
  // the mode button cycles through all four and back
  g.run(`S.auto = {}`); const seen = []; for (let i = 0; i < 4; i++) seen.push(g.run(`autoNext('plank')`));
  assert.deepStrictEqual(seen, ['all', 'bust', 'boom', 'off']);
  // econStep uses it (with the Trading Ledger)
  setup('boom'); g.run('econStep(1)'); assert.ok(g.run('S.res.plank') >= 499, 'econStep holds for a boom');
});

test('orders have deadlines; delivering raises reputation and a caravan leaving empty lowers it', () => {
  const g = load(); town(g); g.run(`S.life = 1e4; S.contracts = []; ordersFill();`);
  assert.strictEqual(g.run('S.contracts.length'), 3);
  for (const c of g.run('S.contracts')) assert.ok(c.T >= 150 && c.T <= 600 && c.t === c.T, 'a deadline: ' + c.T);
  const c = g.run('S.contracts[0]'); g.run(`S.res[S.contracts[0].k] = S.contracts[0].qty`);
  const before = g.run('S.coins'), pay = g.run('contractPay(S.contracts[0])');
  assert.ok(g.run('deliver(0)')); near(g.run('S.coins') - before, pay, 'paid'); assert.strictEqual(g.run('S.rep'), 50 + 3);
  assert.notStrictEqual(g.run('S.contracts[0]'), c, 'a new order took its place');
  // one runs out
  g.run('S.contracts[1].t = 1; ordersTick(2)'); assert.ok(Math.abs(g.run('S.rep') - 49) < .01, 'late: -4 (with a little drift)');
  assert.strictEqual(g.run('S.contracts.length'), 3); assert.ok(g.run('S.contracts[1].t') > 100, 'replaced');
  // a swap costs a point
  const r = g.run('S.rep'); g.run('swapOrder(2)'); near(g.run('S.rep'), r - 1, 'swap');
  // reputation drifts back toward 50
  g.run('S.rep = 90; for (let i = 0; i < 1800; i++) { S.contracts.forEach(c => c.t = 999); ordersTick(1); }');
  const r2 = g.run('S.rep'); assert.ok(r2 < 90 && r2 > 60, 'drifts down slowly: ' + r2);
});

test('reputation sets the pay, rush orders and a fourth caravan', () => {
  const g = load(); town(g); g.run(`S.life = 1e4; S.contracts = [{ k: 'plank', qty: 10, pay: 100, t: 300, T: 300, rush: 0 }]`);
  g.run('S.rep = 50'); const mid = g.run('contractPay(S.contracts[0])');
  g.run('S.rep = 0'); near(g.run('contractPay(S.contracts[0])'), mid * .7, 'x0.7 at 0');
  g.run('S.rep = 100'); near(g.run('contractPay(S.contracts[0])'), mid * 1.3, 'x1.3 at 100');
  assert.strictEqual(g.run(`repTier(85)`), 'Renowned'); assert.strictEqual(g.run(`repTier(10)`), 'Doubted');
  g.run('S.rep = 50; var rushes = 0; for (let i = 0; i < 300; i++) rushes += newContract().rush;'); assert.strictEqual(g.run('rushes'), 0, 'no rush orders at 50');
  g.run('S.rep = 70; rushes = 0; var fast = 1; for (let i = 0; i < 300; i++) { const c = newContract(); rushes += c.rush; if (c.rush && c.T > 240) fast = 0; }');
  assert.ok(g.run('rushes') > 30 && g.run('fast'), 'rush orders at 60+, in half the time');
  g.run('S.rep = 85; S.contracts = []; ordersFill()'); assert.strictEqual(g.run('S.contracts.length'), 4, 'Renowned: four caravans');
  // falling back below 80, the fourth goes once it is done
  g.run(`S.rep = 70; S.res[S.contracts[3].k] = 1e6; deliver(3)`); assert.strictEqual(g.run('S.contracts.length'), 3);
  // Good Name badge
  g.run('S.rep = 85; checkBadges(true)'); assert.ok(g.run('!!S.badges.rep'));
});

test('a charter keeps reputation and the market; the Convention starts them over', () => {
  const g = load();
  g.run(`S = fresh(); setMap('gulch'); S.coins = 1e12; S.best = 40; unlockTown('ridge'); S.towns.ridge.best = 30; unlockTown('falls'); S.towns.falls.best = 20; S.coins = 1e12; openCapital();`);
  g.run(`S.rep = 77; S.mkt.ev.plank = { m: 1.5, t: 100, T: 100 }; S.best = 60; S.wave = 60; prestige();`);
  assert.strictEqual(g.run('S.rep'), 77, 'a charter keeps it'); assert.ok(g.run('!!S.mkt.ev.plank'), 'and the market');
  g.run('S.stats.coins = 1e15; S.legacy.from = 0;'); assert.ok(g.run('convene()') > 0, 'the Convention is held');
  assert.strictEqual(g.run('S.rep'), 50); assert.strictEqual(g.run('Object.keys(S.mkt.ev).length'), 0);
});

test('save v13: older saves get reputation 50 and their orders get deadlines', () => {
  const g = load();
  g.run(`WIPE_OFF = true; const o = JSON.parse(JSON.stringify(fresh())); o.v = 12; delete o.rep; delete o.mkt; o.contracts = [{ k: 'plank', qty: 10, pay: 100 }];
    o.towns = { ridge: Object.assign(townFresh('ridge'), { contracts: [{ k: 'stone', qty: 5, pay: 50 }] }) }; adopt(o);`);
  assert.strictEqual(g.run('S.v'), g.run('fresh().v')); assert.ok(g.run('fresh().v') >= 13);
  assert.strictEqual(g.run('S.rep'), 50); assert.ok(g.run('S.mkt.next') > 0);
  const c = g.run('S.contracts[0]'); assert.ok(c.t >= 300 && c.t <= 600 && c.T === c.t && c.rush === 0, 'deadline added');
  assert.ok(g.run('S.towns.ridge.contracts[0].t') >= 300, 'background towns too');
});
