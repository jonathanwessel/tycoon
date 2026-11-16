// node --test — Influence and the tech trees.
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('../scripts/sim');
const empire = g => g.run(`S = fresh(); setMap('gulch'); S.coins = 1e12; S.best = 40; unlockTown('ridge'); S.towns.ridge.best = 30; unlockTown('falls'); S.towns.falls.best = 20; S.coins = 1e12; openCapital();
  S.ext.camp = 40; S.ext.mine = 40; S.shops.saw = 30; S.shops.smelt = 30; S.research.ledger = 1; for (const k in ITEMS) S.auto[k] = 1;`);

test('Influence builds up from the empire income once the Capital stands, and charters add to it', () => {
  const g = load(); empire(g);
  g.run('for (let i = 0; i < 120; i++) econTowns(1);');
  const inf = g.run('S.capital.inf'); assert.ok(inf > 0, 'earned ' + inf);
  const h = load(); h.run(`S = fresh(); setMap('gulch'); S.ext.camp = 40; for (let i = 0; i < 60; i++) econTowns(1);`);
  assert.strictEqual(h.run('S.capital.inf'), 0, 'nothing without the Capital');
  g.run('S.best = 60; S.wave = 60;'); const before = g.run('S.capital.inf'), d = g.run('deedsOnOffer()'); g.run('prestige()');
  assert.ok(g.run('S.capital.inf') >= before + 5 * d - 1e-6, 'a charter adds 5 per deed');
});

test('nodes are bought in order with Influence and apply to every town; they survive charters', () => {
  const g = load(); empire(g); g.run('S.capital.inf = 1e6;');
  const d0 = g.run('dmgMult()'), w0 = g.run('warEvery(0)'), p0 = g.run(`withTown('ridge', () => prodMult())`);
  assert.strictEqual(g.run('buyTech("arms")'), true); assert.strictEqual(g.run('buyTech("industry")'), true);
  for (let i = 0; i < 5; i++) g.run('buyTech("eng")');
  assert.ok(Math.abs(g.run('dmgMult()') / d0 - 1.12) < 1e-9, 'Arms +12%');
  assert.ok(Math.abs(g.run(`withTown('ridge', () => prodMult())`) / p0 - 1.15) < 1e-9, 'Industry reaches background towns');
  assert.ok(g.run('warEvery(0)') <= w0 / 4.9, 'Engineering 5: about one upgrade a minute');
  assert.strictEqual(g.run('buyTech("eng")'), false, 'five ranks at most');
  g.run('S.best = 60; S.wave = 60; prestige();'); assert.strictEqual(g.run('tk("arms")'), 1, 'kept through a charter');
  const k = load(); k.run(`S = fresh(); S.capital.inf = 9; buyTech('arms')`); assert.strictEqual(k.run('tk("arms")'), 0, 'not without the Capital');
});
