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

test('a v3 save becomes the first town of an empire (current save version), with a backup of the original', () => {
  const g = load();
  const v3 = g.run(`(() => { const o = fresh(); delete o.town; delete o.towns; o.v = 3; o.coins = 12345; o.ext.camp = 17; o.wave = 22; o.deeds = 3; o.towers = [{ c: 0, r: 6, type: 'crossbow', lvl: 2, tg: 'first' }]; return JSON.stringify(o); })()`);
  const h = load({ storage: { 'copper-gulch-save-v1': v3 } });
  h.run('load()');
  assert.strictEqual(h.run('S.v'), h.run('fresh().v'));
  assert.strictEqual(h.run('S.town'), 'gulch');
  assert.deepStrictEqual(h.run('JSON.stringify([S.coins, S.ext.camp, S.wave, S.deeds, S.towers.length])'), JSON.stringify([12345, 17, 22, 3, 1]));
  assert.strictEqual(h.store.get('copper-gulch-save-v1-v3-backup'), v3, 'original kept');
});

test('a save on the retired Forked Canyon moves to Copper Gulch and refunds towers now on the road', () => {
  const g = load();
  const v4 = g.run(`(() => { const o = fresh(); o.v = 4; o.map = 'fork'; o.coins = 1000; o.ext.camp = 12; o.towers = [{ c: 3, r: 7, type: 'cannon', lvl: 2, tg: 'first' }, { c: 0, r: 6, type: 'crossbow', lvl: 0, tg: 'first' }]; return JSON.stringify(o); })()`);
  const h = load({ storage: { 'copper-gulch-save-v1': v4 } }); h.run('load()');
  assert.strictEqual(h.run('S.map'), 'gulch');
  assert.strictEqual(h.run('S.v'), 5);
  assert.strictEqual(h.run('S.ext.camp'), 12, 'buildings kept');
  assert.strictEqual(h.run('S.towers.length'), 1, 'the cannon on the new road is gone');
  assert.ok(h.run('S.coins') > 1000 + 120 * 3, 'and refunded');
  assert.ok(/Forked Canyon and Trestle Bridge are gone/.test(h.run('S.movedNote')));
});

test('a charter restarts only this town and pays its town bonus', () => {
  const g = load();
  g.run(`S = fresh(); setMap('gulch'); S.towns.ridge = townFresh('ridge'); switchTown('ridge'); S.best = 40; S.ext.ironmine = 30; S.towns.gulch.ext.camp = 25;`);
  const offer = g.run('deedsOnOffer()');
  assert.strictEqual(offer, 2 + 1, 'wave 40 gives 2 deeds, plus 1 for Iron Ridge');
  g.run('prestige()');
  assert.strictEqual(g.run('S.deeds'), 3);
  assert.strictEqual(g.run('S.town'), 'ridge');
  assert.strictEqual(g.run('S.ext.ironmine || 0'), 0, 'Ridge starts over');
  assert.strictEqual(g.run('S.towns.gulch.ext.camp'), 25, 'Copper Gulch untouched');
  assert.strictEqual(g.run('S.chMap.ridge'), 1);
});

test('towns keep their own buildings; the empire shares coins; background work stays in its town', () => {
  const g = load();
  g.run(`S = fresh(); setMap('gulch'); S.ext.camp = 3; S.towns.test = townFresh('ridge'); S.towns.test.ext = { mine: 5 };`);
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

test('Iron Ridge opens only after wave 20 in Copper Gulch and costs 100K', () => {
  const g = load();
  g.run(`S = fresh(); setMap('gulch'); S.coins = 2e5; S.best = 12;`);
  assert.strictEqual(g.run(`unlockTown('ridge')`), false, 'too early');
  g.run('S.best = 21;');
  assert.strictEqual(g.run(`unlockTown('ridge')`), true);
  assert.strictEqual(g.run('S.coins'), 1e5);
  assert.strictEqual(g.run('S.towns.ridge.map'), 'ridge');
  assert.strictEqual(g.run('S.towns.ridge.res.stone'), 30, 'starting stone');
});

test('a shipping route gets its goods even when the home town\'s workshops use them all', () => {
  const g = load();
  // Copper Gulch makes planks but its Machine Shop could eat every one; the route to Iron Ridge must still be fed
  g.run(`S = fresh(); setMap('gulch'); S.coins = 1e6; S.best = 25; unlockTown('ridge');
    S.res.plank = 0; S.ext.camp = 20; S.ext.mine = 20; S.shops.saw = 6; S.shops.smelt = 10; S.shops.mach = 60;
    Object.assign(S.towns.ridge.ext, { ironmine: 10, coalseam: 10 }); Object.assign(S.towns.ridge.shops, { blast: 8, boilerw: 4 });
    S.routes.push({ from: 'gulch', to: 'ridge', k: 'plank', per: 60 });`);
  g.run('for (let i = 0; i < 240; i++) econTowns(.5);');
  const sent = g.run('S.routes[0].sent');
  assert.ok(sent > 100, 'planks shipped despite the hungry Machine Shop, got ' + sent);
  assert.ok(g.run('S.towns.ridge.res.boiler') > 0, 'Iron Ridge made boilers');
});

test('Iron Ridge works in the background on its own chain, fed by a shipping route', () => {
  const g = load();
  g.run(`S = fresh(); setMap('gulch'); S.coins = 1e6; S.best = 25; unlockTown('ridge');
    S.res.plank = 500; S.ext.camp = 10;
    Object.assign(S.towns.ridge.ext, { ironmine: 10, coalseam: 10 }); Object.assign(S.towns.ridge.shops, { blast: 8, boilerw: 4 });
    S.routes.push({ from: 'gulch', to: 'ridge', k: 'plank', per: 60 });`);
  const coins0 = g.run('S.coins');
  g.run('for (let i = 0; i < 120; i++) econTowns(.5);');
  assert.ok(g.run('S.towns.ridge.res.pig') > 0 || g.run('S.towns.ridge.res.boiler') > 0, 'ridge made pig iron');
  assert.ok(g.run('S.towns.ridge.res.boiler') > 0, 'boilers made from shipped planks');
  const sent = g.run('S.routes[0].sent');
  assert.ok(sent > 55 && sent <= 60.5, 'about 60 planks a minute shipped, got ' + sent);
  assert.ok(g.run('S.coins') < coins0, 'shipping fees were paid');
  assert.strictEqual(g.run('BUILD.map(b => b.def.id).join()'), 'camp,mine,drill,pit,saw,smelt,glass,mach,eng,mill,clockw,autow', 'back to Gulch buildings');
});

test('a route never ships more than the source has', () => {
  const g = load();
  g.run(`S = fresh(); setMap('gulch'); S.coins = 1e6; S.towns.ridge = townFresh('ridge'); S.res.gear = 3;
    S.routes.push({ from: 'gulch', to: 'ridge', k: 'gear', per: 120 }); for (let i = 0; i < 20; i++) econTowns(.5);`);
  assert.ok(Math.abs(g.run('S.towns.ridge.res.gear') - 3) < 1e-9);
  assert.ok(g.run('S.res.gear') >= 0);
});

test('switching to Iron Ridge brings its buildings, map, taps and boss', () => {
  const g = load();
  g.run(`S = fresh(); setMap('gulch'); S.towns.ridge = townFresh('ridge'); switchTown('ridge');`);
  assert.strictEqual(g.run('TOWN_ID'), 'ridge');
  assert.ok(g.run(`BY_ID.locow && !BY_ID.camp`));
  assert.strictEqual(g.run('MAP.n'), 'Iron Ridge');
  assert.strictEqual(g.run(`TOWN.tap.rocks`), 'iron');
  assert.strictEqual(g.run('bossName()'), 'Armoured train');
  assert.deepStrictEqual(JSON.parse(g.run('JSON.stringify(towerGoods("crossbow"))')), { stone: 6 });
  g.run(`S.res.stone = 6; S.coins = 100; buildTower('crossbow', PLOTS[0].x, PLOTS[0].y);`);
  assert.strictEqual(g.run('S.towers.length'), 1, 'a crossbow built from stone');
});

test('the first Locomotive Works opens rail for every route', () => {
  const g = load();
  g.run(`S = fresh(); setMap('gulch'); S.towns.ridge = townFresh('ridge'); switchTown('ridge'); S.coins = 1e9; S.shops.locow = 0;`);
  assert.strictEqual(g.run('carrier().max'), 120);
  g.run(`buyBuilding(BY_ID.locow);`);
  assert.strictEqual(g.run('carrier().max'), 1200);
});

test('Silver Falls opens after wave 15 in Iron Ridge for 1M', () => {
  const g = load();
  g.run(`S = fresh(); setMap('gulch'); S.coins = 5e6; S.towns.ridge = townFresh('ridge'); S.towns.ridge.best = 10;`);
  assert.strictEqual(g.run(`unlockTown('falls')`), false, 'Ridge not far enough');
  g.run('S.towns.ridge.best = 16;');
  assert.strictEqual(g.run(`unlockTown('falls')`), true);
  assert.strictEqual(g.run('S.towns.falls.map'), 'falls');
});

test('the Silver Falls power grid slows workshops when demand outruns the Water Wheels', () => {
  const g = load();
  g.run(`S = fresh(); setMap('gulch'); S.towns.falls = townFresh('falls'); switchTown('falls');
    S.ext.cumine = 20; S.shops.refinery = 8; S.ext.wheel = 1;`);
  assert.deepStrictEqual(JSON.parse(g.run('JSON.stringify(powerUse())')), { cap: 4, use: 8, f: .5 });
  g.run('S.res.copper = 0; econ(10);'); const slow = g.run('S.res.copper');
  g.run('S.ext.wheel = 2; S.res.copper = 0; econ(10);'); const full = g.run('S.res.copper');
  assert.ok(Math.abs(full - 2 * slow) < 1e-6, 'twice the copper at full power');
  g.run('S.ext.wheel = 1;');
  assert.ok(g.run(`steadyIncome('wheel') > steadyIncome()`), 'foremen see a Water Wheel is worth building');
});

test('in Silver Falls boats and the ironclad come up the river, raiders take the road', () => {
  const g = load();
  g.run(`S = fresh(); setMap('gulch'); S.towns.falls = townFresh('falls'); switchTown('falls'); spawn('boat'); spawn('raider'); spawn('boss');`);
  assert.deepStrictEqual(JSON.parse(g.run('JSON.stringify(foes.map(f => f.p))')), [1, 0, 1]);
  assert.strictEqual(g.run('bossName()'), 'Ironclad steamer');
  g.run(`S.wave = 7; planWave();`);
  assert.ok(g.run(`W.next.length`) > 0);
});

test('a dust storm shortens tower reach except frost and tesla', () => {
  const g = load();
  g.run(`S = fresh(); setMap('gulch'); W.active = false;`);
  const r0 = g.run(`towerStats({ type: 'crossbow', lvl: 0 }).range`), f0 = g.run(`towerStats({ type: 'frost', lvl: 0 }).range`);
  g.run(`W.active = true; W.weather = 'dust';`);
  assert.ok(g.run(`towerStats({ type: 'crossbow', lvl: 0 }).range`) < r0);
  assert.strictEqual(g.run(`towerStats({ type: 'frost', lvl: 0 }).range`), f0);
});
