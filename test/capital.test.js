// node --test — the Capital: founding it, the Capitol's budget (foremen, War Office, Academy), background waves,
// and the institutions' effects.
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('../scripts/sim');

// an empire with all three towns, Silver Falls held to wave 20, rich enough to found the Capital
const empire = g => g.run(`S = fresh(); setMap('gulch'); S.coins = 1e12; S.best = 40; unlockTown('ridge'); S.towns.ridge.best = 30; unlockTown('falls'); S.towns.falls.best = 20; S.coins = 1e12;`);

test('the Capital opens once Silver Falls reaches wave 15, for its price', () => {
  const g = load();
  g.run(`S = fresh(); setMap('gulch'); S.coins = 1e12;`);
  assert.strictEqual(g.run('openCapital()'), false, 'no Silver Falls yet');
  empire(g);
  assert.strictEqual(g.run('openCapital()'), true);
  assert.ok(g.run('S.coins') <= 1e12 - g.run('CAPITAL.coins'));
  assert.strictEqual(g.run('openCapital()'), false, 'only once');
});

test('the Academy researches and the War Office upgrades towers, in a background town too, slowly', () => {
  const g = load(); empire(g); g.run('openCapital(); S.capital.share = 1; S.capital.split = { foremen: 0, war: 1, academy: 1 };');
  g.run(`withTown('ridge', () => { S.ext.ironmine = 20; S.ext.coalseam = 20; S.shops.blast = 10; S.research.ledger = 1; for (const k in ITEMS) S.auto[k] = 1;
    for (const k in S.res) S.res[k] = 1e6; buildTower('crossbow', PLOTS[0].x, PLOTS[0].y); });`);
  const lv0 = g.run('S.towns.ridge.towers[0].lvl'), r0 = g.run('JSON.stringify(S.towns.ridge.research)');
  g.run('for (let i = 0; i < 400; i++) econTowns(1);'); // 400 seconds
  assert.notStrictEqual(g.run('JSON.stringify(S.towns.ridge.research)'), r0, 'research bought');
  const ups = g.run('S.towns.ridge.towers[0].lvl') - lv0;
  assert.ok(ups >= 1 && ups <= 3, 'tower upgraded, slowly (' + ups + ' in 400 s)');
});

test('foremen are paid from the Capitol budget, not the town setting, once it stands', () => {
  const g = load(); empire(g); g.run('S.fb.share = 1; openCapital(); S.capital.share = .5; S.capital.split = { foremen: 1, war: 0, academy: 0 };');
  g.run('S.ext.camp = 10; S.mgr.camp = 1; S.research.ledger = 1; S.auto.wood = 1; S.fb.purse = 0; S.fb.last = S.life;');
  const life0 = g.run('S.life'); g.run('S.fb.cap = 0; for (let i = 0; i < 30; i++) { econStep(1); }');
  const earned = g.run('S.life') - life0, purse = g.run('S.fb.purse');
  assert.ok(purse <= earned * .5 + 1, 'half of earnings at most, got ' + purse + ' of ' + earned);
});

test('a background town on auto fights its waves; too weak for its boss, it loops at the gate', () => {
  const g = load(); empire(g);
  g.run(`withTown('ridge', () => { S.autoWave = true; S.wave = 3; S.towers = []; for (const k in S.res) S.res[k] = 1e6; for (let i = 0; i < 4; i++) { buildTower('crossbow', PLOTS[i].x, PLOTS[i].y); S.towers[i].lvl = 8; } });`);
  g.run('for (let i = 0; i < 45 * 12; i++) econTowns(1);');
  const w = g.run('S.towns.ridge.wave');
  assert.ok(w > 3, 'cleared waves: now ' + w);
  g.run(`withTown('ridge', () => { S.wave = 40; S.towers.forEach(t => t.lvl = 0); })`); const c0 = g.run('S.coins');
  g.run('for (let i = 0; i < 45 * 3; i++) econTowns(1);');
  assert.ok(g.run('S.towns.ridge.wave') <= 40, 'held at or before the gate');
  g.run(`withTown('ridge', () => { S.autoWave = false; S.wave = 5; })`); g.run('for (let i = 0; i < 45 * 3; i++) econTowns(1);');
  assert.strictEqual(g.run('S.towns.ridge.wave'), 5, 'held towns wait');
});

test('institutions: Market Board, Transport, Education', () => {
  const g = load(); empire(g); g.run('openCapital();');
  const sm = g.run('sellMult()'), cm = g.run('carrier().max');
  g.run('buyInst("market"); buyInst("transport"); buyInst("education");');
  assert.ok(Math.abs(g.run('sellMult()') / sm - 1.05) < 1e-9, 'sell +5%');
  assert.ok(g.run('carrier().max') > cm, 'routes carry more');
  assert.deepStrictEqual(JSON.parse(g.run('JSON.stringify(eduKeep({ steam: 5, lines: 1 }))')), { steam: 2, lines: 1 }, 'charters keep 2 levels');
  assert.ok(g.run('instCost("market")') > g.run('INST.market.cost'), 'next level costs more');
});

test('per-town fields never leak between towns when one is swapped in or visited', () => {
  const g = load(); empire(g);
  g.run(`S.cpurse = { war: 123, acad: 0, last: 0, t: 5 }; S.abT = 7;`);
  assert.strictEqual(g.run(`withTown('ridge', () => S.cpurse === undefined && S.abT === undefined)`), true, 'background swap');
  g.run(`switchTown('ridge')`);
  assert.strictEqual(g.run('S.cpurse === undefined && S.abT === undefined'), true, 'travelling');
  g.run(`switchTown('gulch')`); assert.strictEqual(g.run('S.cpurse.war'), 123, 'Copper Gulch kept its own');
});
