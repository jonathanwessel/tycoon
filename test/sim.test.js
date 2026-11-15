// node --test   — simulation tests: the real game code, run in Node without a browser (see scripts/sim.js)
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('../scripts/sim');

test('a lumber camp produces timber at its listed rate', () => {
  const g = load();
  g.run(`S = fresh(); setMap('gulch'); S.ext.camp = 4; S.res.wood = 0; econ(10);`);
  assert.ok(Math.abs(g.run('S.res.wood') - 4 * .5 * 10) < 1e-6, 'wood after 10s');
});

test('a workshop short of inputs adds nothing to steady income, and its supplier shows its worth', () => {
  const g = load();
  g.run(`S = fresh(); setMap('gulch'); S.ext.camp = 2; S.shops.saw = 40;`);
  const base = g.run('steadyIncome()'), withSaw = g.run(`steadyIncome('saw')`), withCamp = g.run(`steadyIncome('camp')`);
  assert.ok(Math.abs(withSaw - base) < 1e-9, 'extra sawmill level is worthless when timber is short');
  assert.ok(withCamp > base, 'an extra camp level feeds the starved sawmill');
});

test('foremen are paid from income and keep the reserve', () => {
  const g = load();
  g.run(`S = fresh(); setMap('gulch'); S.coins = 5e4; S.research.ledger = 1; for (const k in ITEMS) { S.seen[k] = 1; S.auto[k] = 1; }
    for (const b of BUILD) S[b.kind][b.def.id] = 5; for (const b of BUILD) S.mgr[b.def.id] = 1; S.fb.share = .5; S.fb.keep = 1;`);
  let low = Infinity;
  for (let m = 0; m < 20; m++) { g.run('for (let i = 0; i < 120; i++) econ(.5);'); low = Math.min(low, g.run('S.coins - 60 * steadyIncome()')); }
  assert.ok(g.run('S.coins') > 5e4, 'cash grows with foremen paid half of income');
  assert.ok(low > -1, 'never below one minute of income');
  assert.ok(g.run('BUILD.reduce((a, b) => a + blv(b.def.id), 0)') > 12 * 5, 'foremen bought upgrades');
});

test('without a ledger nothing is auto-sold; selling lowers the price', () => {
  const g = load();
  g.run(`S = fresh(); setMap('gulch'); S.res.wood = 1000;`);
  const v = g.run(`sell('wood', 500)`);
  assert.ok(v > 0 && g.run(`dem('wood')`) < 1);
});

test('a cleared wave advances, pays and heals the vault by 1 plus Masonry', () => {
  const g = load();
  g.run(`S = fresh(); setMap('gulch'); S.research.mason = 2; S.vaultHp = 10; S.wave = 3; planWave(); startWave(); W.queue = []; foes = []; combat(.05);`);
  assert.strictEqual(g.run('S.wave'), 4);
  assert.strictEqual(g.run('S.vaultHp'), 13);
});

test('a war wagon that reaches the vault smashes it whatever its strength', () => {
  const g = load();
  g.run(`S = fresh(); setMap('gulch'); S.research.vault = 20; S.vaultHp = vaultMax(); S.wave = 20; planWave(); startWave(); W.queue = []; spawn('boss');
    foes[0].d = PATHS[0].len - .01; combat(.05);`);
  assert.strictEqual(g.run('S.wave'), 18, 'back two waves');
  assert.strictEqual(g.run('S.stats.smashed'), 1);
});

test('repairs are refused while a wave is on the road', () => {
  const g = load();
  g.run(`S = fresh(); setMap('gulch'); S.coins = 1e6; S.vaultHp = 5; W.active = true;`);
  assert.strictEqual(g.run('repair(3)'), false);
  g.run('W.active = false');
  assert.strictEqual(g.run('repair(3)'), true);
  assert.strictEqual(g.run('S.vaultHp'), 8);
});

test('a v3 save becomes the first town of a v4 empire, with a backup of the original', () => {
  const g = load();
  const v3 = g.run(`(() => { const o = fresh(); delete o.town; delete o.towns; o.v = 3; o.coins = 12345; o.ext.camp = 17; o.wave = 22; o.deeds = 3; o.towers = [{ c: 0, r: 6, type: 'crossbow', lvl: 2, tg: 'first' }]; return JSON.stringify(o); })()`);
  const h = load({ storage: { 'copper-gulch-save-v1': v3 } });
  h.run('load()');
  assert.strictEqual(h.run('S.v'), 4);
  assert.strictEqual(h.run('S.town'), 'gulch');
  assert.deepStrictEqual(h.run('JSON.stringify([S.coins, S.ext.camp, S.wave, S.deeds, S.towers.length])'), JSON.stringify([12345, 17, 22, 3, 1]));
  assert.strictEqual(h.store.get('copper-gulch-save-v1-v3-backup'), v3, 'original kept');
});

test('towns keep their own buildings; the empire shares coins; background work stays in its town', () => {
  const g = load();
  g.run(`S = fresh(); setMap('gulch'); S.ext.camp = 3; S.towns.test = townFresh('fork'); S.towns.test.ext = { mine: 5 };`);
  g.run(`withTown('test', () => { econ(10); });`);
  assert.ok(g.run('S.towns.test.res.ore') > 0, 'the other town produced ore');
  assert.strictEqual(g.run('S.ext.camp'), 3, 'the active town is untouched');
  assert.strictEqual(g.run('S.res.ore'), 0);
  g.run(`S.coins = 777; switchTown('test');`);
  assert.strictEqual(g.run('S.town'), 'test');
  assert.strictEqual(g.run('S.ext.mine'), 5);
  assert.strictEqual(g.run('S.coins'), 777, 'coins belong to the empire');
  assert.strictEqual(g.run('S.towns.gulch.ext.camp'), 3, 'the town left behind is stored');
  const round = load({ storage: { 'copper-gulch-save-v1': g.run('JSON.stringify(S)') } }); round.run('load()');
  assert.strictEqual(round.run('S.towns.gulch.ext.camp'), 3, 'stored towns survive a save and load');
});

test('a dust storm shortens tower reach except frost and tesla', () => {
  const g = load();
  g.run(`S = fresh(); setMap('gulch'); W.active = false;`);
  const r0 = g.run(`towerStats({ type: 'crossbow', lvl: 0 }).range`), f0 = g.run(`towerStats({ type: 'frost', lvl: 0 }).range`);
  g.run(`W.active = true; W.weather = 'dust';`);
  assert.ok(g.run(`towerStats({ type: 'crossbow', lvl: 0 }).range`) < r0);
  assert.strictEqual(g.run(`towerStats({ type: 'frost', lvl: 0 }).range`), f0);
});
