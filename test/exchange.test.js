// node --test — the Stock Exchange.
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('../scripts/sim');
const empire = g => g.run(`S = fresh(); setMap('gulch'); S.coins = 1e12; S.best = 40; unlockTown('ridge'); S.towns.ridge.best = 30; unlockTown('falls'); S.towns.falls.best = 20; S.coins = 1e12; openCapital(); buyInst('exchange');
  S.ext.camp = 40; S.ext.mine = 40; S.shops.saw = 30; S.shops.smelt = 30; S.research.ledger = 1; for (const k in ITEMS) S.auto[k] = 1;`);

test('a share price follows its town income', () => {
  const g = load(); empire(g);
  g.run('for (let i = 0; i < 60; i++) econTowns(1);');
  const fair = g.run('exFair("gulch")'), p = g.run('exStock("gulch").p');
  assert.ok(fair > 10, 'the town earns: fair ' + fair);
  assert.ok(p > fair / 2 && p < fair * 2, 'starts near fair: ' + p + ' vs ' + fair);
  // the town's income triples: within ten minutes the price has caught up
  g.run('CAPI.by.gulch *= 3; const f = CAPI.by.gulch; for (let i = 0; i < 600; i++) { CAPI.t = 99; CAPI.by.gulch = f; exchangeWork(1); }');
  const p2 = g.run('exStock("gulch").p'), fair2 = g.run('exFair("gulch")');
  assert.ok(p2 > fair2 * .75 && p2 < fair2 * 1.3, 'caught up: ' + p2 + ' vs ' + fair2);
  assert.ok(g.run('exStock("gulch").hist.length') > 10, 'a price history for the chart');
});

test('news moves the mood: a boss lifts a share, a fallen vault sinks it, and it fades', () => {
  const g = load(); empire(g); g.run('for (let i = 0; i < 20; i++) econTowns(1);');
  g.run('exNews("boss")'); assert.ok(g.run('exStock("gulch").mood') > 1.1);
  g.run(`withTown('ridge', () => exNews('vault'))`); assert.ok(g.run('exStock("ridge").mood') < .9, 'news belongs to the town it happened in');
  assert.strictEqual(g.run('exBook().news[0].id'), 'ridge');
  g.run('for (let i = 0; i < 1800; i++) { CAPI.t = 99; exchangeWork(1); }');
  assert.ok(Math.abs(g.run('exStock("gulch").mood') - 1) < .01, 'faded');
});

test('dividends pay shareholders, a majority pays the foremen more, and buying then selling always loses', () => {
  const g = load(); empire(g); g.run('for (let i = 0; i < 30; i++) econTowns(1);');
  const c0 = g.run('S.coins'), n = g.run('exBuy("gulch", 600)');
  assert.strictEqual(n, 600); assert.ok(g.run('S.coins') < c0);
  assert.strictEqual(g.run('exMajority("gulch")'), true);
  assert.strictEqual(g.run('exBoost()'), 1.5); assert.strictEqual(g.run(`withTown('ridge', () => exBoost())`), 1, 'only in that town');
  assert.strictEqual(g.run('exBuy("gulch", 1e6)') <= 400, true, 'no more than 1000 shares');
  g.run('S.coins = 0; exStock("gulch").paid = 0; for (let i = 0; i < 60; i++) { CAPI.t = 99; exchangeWork(1); }');
  const inc = g.run('CAPI.by.gulch'), own = g.run('exOwn("gulch")'), paid = g.run('exStock("gulch").paid');
  assert.ok(Math.abs(paid - inc * g.run('exYield()') * own / 1000 * 60) < paid * 1e-6 + 1e-6, 'dividends: ' + paid);
  // a round trip at one price
  const h = load(); empire(h); h.run('for (let i = 0; i < 30; i++) econTowns(1);');
  const before = h.run('S.coins'); h.run('exBuy("ridge", 500); exSell("ridge", 500);');
  assert.ok(h.run('S.coins') < before, 'the spread costs coins'); assert.strictEqual(h.run('exOwn("ridge")'), 0);
  g.run('S.best = 60; S.wave = 60; prestige();'); assert.strictEqual(g.run('exOwn("gulch")'), 0, 'a charter gives up the shares');
  const k = load(); k.run('S = fresh(); S.coins = 1e12;'); assert.strictEqual(k.run('exBuy("gulch", 10)'), 0, 'not without the Stock Exchange');
});
