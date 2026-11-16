// node --test — policies, the Constitutional Convention and Legacy.
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('../scripts/sim');
const empire = g => g.run(`S = fresh(); setMap('gulch'); S.coins = 1e12; S.best = 40; unlockTown('ridge'); S.towns.ridge.best = 30; unlockTown('falls'); S.towns.falls.best = 20; S.coins = 1e12; openCapital();
  S.ext.camp = 40; S.ext.mine = 40; S.shops.saw = 30; S.shops.smelt = 30; S.research.ledger = 1; for (const k in ITEMS) S.auto[k] = 1;`);
const near = (a, b, what) => assert.ok(Math.abs(a / b - 1) < 1e-9, what + ': ' + a + ' vs ' + b);

test('a policy is one side of a pair, needs the Capital, and holds until the Convention', () => {
  const g = load(); g.run(`S = fresh(); setMap('gulch');`);
  assert.strictEqual(g.run(`setPolicy('econ', 'free')`), false, 'not without the Capital');
  empire(g);
  assert.strictEqual(g.run(`setPolicy('econ', 'nonsense')`), false);
  assert.strictEqual(g.run(`setPolicy('econ', 'free')`), true);
  assert.strictEqual(g.run(`setPolicy('econ', 'planned')`), false, 'locked once chosen');
  assert.strictEqual(g.run(`pol('econ')`), 'free');
  g.run('S.best = 60; S.wave = 60; prestige();'); assert.strictEqual(g.run(`pol('econ')`), 'free', 'a charter keeps it');
});

test('each policy does what it says', () => {
  const g = load(); empire(g);
  const sell0 = g.run('sellMult()'), depth0 = g.run(`depth('plank')`), fee0 = g.run('carrier().fee'), max0 = g.run('carrier().max'), prod0 = g.run('prodMult()');
  g.run(`setPolicy('econ', 'free')`); near(g.run('sellMult()'), sell0 * 1.15, 'Free Market prices'); near(g.run(`depth('plank')`), depth0 * .5, 'Free Market swings');
  const h = load(); empire(h); h.run(`setPolicy('econ', 'planned')`); near(h.run(`depth('plank')`), depth0 * 2, 'Planned Economy holds prices');
  g.run(`setPolicy('trade', 'open')`); near(g.run('carrier().fee'), fee0 * .5, 'Open Borders fees'); assert.ok(Math.abs(g.run('carrier().max') - max0 * 1.5) <= 1, 'Open Borders capacity');
  h.run(`setPolicy('trade', 'protect')`); near(h.run('carrier().fee'), fee0 * 2.5, 'Protectionism fees'); near(h.run('prodMult()'), prod0 * 1.2, 'Protectionism production');
  near(h.run(`withTown('ridge', () => craftMult())`) / g.run(`withTown('ridge', () => craftMult())`), 1.2, 'in background towns too');
  // the army: Militia makes Barracks cheaper and bigger; a Standing Army hits harder and costs upkeep
  const m = load(); empire(m); m.run(`S.towers.push({ c: 0, r: 8, type: 'barracks', lvl: 0, up: {} }, { c: 2, r: 8, type: 'crossbow', lvl: 0 });`);
  const b0 = m.run(`buildCost('barracks')`), t0 = m.run(`trackCost(S.towers[0], 'count')`), n0 = m.run('troopStats(S.towers[0]).count'), x0 = m.run(`buildCost('crossbow')`), d0 = m.run('towerStats(S.towers[1]).dmg');
  m.run(`setPolicy('army', 'militia')`);
  assert.ok(m.run(`buildCost('barracks')`) <= Math.ceil(b0 * .6) && m.run(`trackCost(S.towers[0], 'count')`) <= Math.ceil(t0 * .6), 'Militia: 40% less');
  assert.strictEqual(m.run('troopStats(S.towers[0]).count'), n0 + 1, 'Militia: one more soldier'); assert.strictEqual(m.run(`buildCost('crossbow')`), x0, 'other towers as before');
  const s = load(); empire(s); s.run(`S.towers.push({ c: 0, r: 8, type: 'barracks', lvl: 0, up: {} }, { c: 2, r: 8, type: 'crossbow', lvl: 0 }); setPolicy('army', 'standing');`);
  near(s.run('towerStats(S.towers[1]).dmg'), d0 * 1.25, 'Standing Army damage');
  // upkeep: the same town, with and without it, over the same minute
  const u = load(); empire(u); u.run('for (let i = 0; i < 30; i++) econTowns(1);'); s.run('for (let i = 0; i < 30; i++) econTowns(1);');
  u.run('S.coins = 1e9; for (let i = 0; i < 60; i++) econTowns(1);'); s.run('S.coins = 1e9; for (let i = 0; i < 60; i++) econTowns(1);');
  assert.ok(s.run('S.coins') < u.run('S.coins'), 'upkeep costs coins: ' + s.run('S.coins') + ' vs ' + u.run('S.coins'));
});

test('Legacy on offer counts this life: income, the deepest wave and deeds at their worth', () => {
  const g = load(); empire(g);
  assert.strictEqual(g.run('conventionReady()'), true, 'wave 40 is worth 2 Legacy');
  g.run('S.stats.coins = 1e12; S.deeds = 10;');
  const L = g.run('legacyParts()');
  assert.strictEqual(L.inc, 8, 'a trillion coins: 8'); assert.strictEqual(L.wave, 2, 'wave 40: 2'); assert.strictEqual(L.deeds, 5, '10 deeds (x3): 5');
  assert.ok(Math.abs(Math.pow(1.25, L.deeds) / 3 - 1) < .05, 'deeds convert at about their worth');
  const k = load(); k.run(`S = fresh(); setMap('gulch'); S.stats.coins = 1e12; S.best = 60;`); assert.strictEqual(k.run('conventionReady()'), false, 'needs the Capital');
  const d = load(); empire(d); d.run('S.best = 20; S.towns.ridge.best = 1; S.towns.falls.best = 1; S.bestMap = {}; S.stats.coins = 5e8; S.deeds = 30;');
  assert.strictEqual(d.run('conventionReady()'), false, 'deeds alone are not enough');
});

test('the Convention resets the empire, keeps what it should, and pays Legacy', () => {
  const g = load(); empire(g);
  g.run(`S.capital.inf = 500; buyTech('arms'); buyInst('exchange'); for (let i = 0; i < 20; i++) econTowns(1); exBuy('gulch', 100); setPolicy('army', 'standing');
    S.stats.coins = 1e12; S.deeds = 10; S.perks.agency = 1; S.perks.coffers = 1; S.badges.k100 = 1; S.stats.kills = 777; S.charters = 3; S.opt.vol = .4;`);
  const L = g.run('legacyParts().total'), paid = g.run('convene()');
  assert.strictEqual(paid, L); assert.strictEqual(g.run('legacyPts()'), L);
  assert.strictEqual(g.run('townIds().length'), 1, 'only Copper Gulch'); assert.strictEqual(g.run('S.town'), 'gulch');
  assert.strictEqual(g.run('capOpen()'), false, 'the Capital is gone'); assert.strictEqual(g.run('S.capital.inf'), 0); assert.strictEqual(g.run('tk("arms")'), 0, 'the trees reset');
  assert.strictEqual(g.run('exOwn("gulch")'), 0, 'the Stock Exchange resets'); assert.strictEqual(g.run(`pol('army')`), null, 'policies are free to choose again');
  assert.strictEqual(g.run('S.deeds'), 0, 'deeds became Legacy'); assert.strictEqual(g.run('perk("agency")'), 1, 'perks stay'); assert.strictEqual(g.run('freeDeeds()'), 0, 'kept perks stay paid for');
  assert.strictEqual(g.run('S.badges.k100'), 1); assert.strictEqual(g.run('S.stats.kills'), 777); assert.strictEqual(g.run('S.charters'), 3); assert.strictEqual(g.run('S.opt.vol'), .4);
  assert.strictEqual(g.run('S.coins'), 560, 'Seed Money still applies (60 + 500)'); assert.strictEqual(g.run('S.best'), 1); assert.strictEqual(g.run('S.stats.conventions'), 1);
  near(g.run('prodMult()'), Math.pow(1.25, L), 'x1.25 per Legacy'); near(g.run('dmgMult()'), Math.pow(1.25, L), 'damage too');
  // this life starts counting again: a second Convention right away pays nothing
  assert.strictEqual(g.run('conventionReady()'), false); assert.strictEqual(g.run('convene()'), 0);
  // deed perks bought after the Convention cost new deeds; Legacy survives a charter
  g.run('S.deeds = 3;'); assert.strictEqual(g.run('freeDeeds()'), 3); g.run(`buyPerk('start')`); assert.strictEqual(g.run('freeDeeds()'), 2);
  g.run('S.best = 60; S.wave = 60; prestige();'); assert.strictEqual(g.run('legacyPts()'), L, 'a charter keeps Legacy'); assert.strictEqual(g.run('freeDeeds()'), g.run('S.deeds') - 1);
});

test('Legacy perks: towns open, the Capitol standing, an Influence pot', () => {
  const g = load(); g.run(`S = fresh(); setMap('gulch'); S.legacy.pts = 20;`);
  assert.strictEqual(g.run(`buyLegacy('falls')`), false, 'in order');
  for (const id of ['ridge', 'falls', 'capitol', 'pot']) assert.strictEqual(g.run(`buyLegacy('${id}')`), true, id);
  assert.strictEqual(g.run('freeLegacy()'), 20 - 2 - 4 - 6 - 2); assert.strictEqual(g.run('legacyPts()'), 20, 'spending keeps the bonus');
  assert.strictEqual(g.run(`buyLegacy('capitol')`), false, 'one rank');
  empire(g); g.run('S.legacy.pts = 20; S.legacy.perks = { ridge: 1, falls: 1, capitol: 1, pot: 1 };');
  g.run('convene()');
  assert.strictEqual(g.run('townIds().sort().join()'), 'falls,gulch,ridge');
  assert.strictEqual(g.run('capOpen()'), true); assert.strictEqual(g.run(`capLv('bank')`), 1); assert.strictEqual(g.run('S.capital.inf'), 100);
  assert.strictEqual(g.run(`S.towns.ridge.autoWave`), false, 'new towns hold their waves');
});

test('saves from v9 migrate: no policies, no Legacy, the first life counts every coin', () => {
  const g = load(); empire(g);
  g.run(`S.stats.coins = 2e10; const o = JSON.parse(JSON.stringify(S)); o.v = 9; delete o.capital.pol; delete o.legacy; delete o.paidDeeds; adopt(o);`);
  assert.strictEqual(g.run('S.v'), g.run('fresh().v')); assert.strictEqual(g.run('JSON.stringify(S.capital.pol)'), '{}'); assert.strictEqual(g.run('legacyPts()'), 0);
  assert.strictEqual(g.run('legacyParts().inc'), 4, 'twenty billion coins so far'); assert.strictEqual(g.run('capOpen()'), true);
  assert.strictEqual(g.run('freeDeeds()'), g.run('S.deeds - spentDeeds()'));
});
