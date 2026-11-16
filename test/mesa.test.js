// node --test — Thunder Mesa, the fourth town: opening it from the Capital, its oil, rubber and aluminium chain, the sky
// lane, and the airship boss that only Tesla coils and drones can reach.
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('../scripts/sim');

const empire = g => g.run(`S = fresh(); setMap('gulch'); S.coins = 1e12; S.best = 40; unlockTown('ridge'); S.towns.ridge.best = 30; unlockTown('falls'); S.towns.falls.best = 20; S.coins = 1e12;`);
// play Thunder Mesa with a wave in progress
const inMesa = g => { empire(g); g.run(`openCapital(); S.capital.lv.transport = 5; unlockTown('mesa'); switchTown('mesa'); wipeField(); S.coins = 1e12;`); };

test('Thunder Mesa opens from the Capital once the Department of Transport reaches level 5, for its price', () => {
  const g = load(); empire(g);
  assert.strictEqual(g.run(`unlockTown('mesa')`), false, 'no Capital yet');
  g.run('openCapital(); S.capital.lv.transport = 4;');
  assert.strictEqual(g.run(`unlockTown('mesa')`), false, 'Transport only level 4');
  g.run('S.capital.lv.transport = 5; S.coins = 5e7;');
  assert.strictEqual(g.run(`unlockTown('mesa')`), false, 'not enough coins');
  g.run('S.coins = 2e8;');
  assert.strictEqual(g.run(`unlockTown('mesa')`), true);
  assert.strictEqual(g.run('S.coins'), 1e8);
  assert.strictEqual(g.run('S.towns.mesa.map'), 'mesa');
  assert.strictEqual(g.run('S.towns.mesa.res.alu'), 20, 'starting aluminium for the first crossbows');
  assert.strictEqual(g.run('S.towns.mesa.autoWave'), false, 'its waves wait until it has been defended');
});

test('the Mesa chain runs from oil, rubber and bauxite up to airships, with wire shipped in', () => {
  const g = load(); inMesa(g);
  g.run(`S.ext.well = 10; S.ext.rubberf = 10; S.ext.bauxmine = 10; S.shops.oilref = 10; S.shops.tirew = 10; S.shops.alusm = 10; S.shops.motorw = 10; S.shops.hangar = 10;
    for (const k in S.res) S.res[k] = 0; S.res.wire = 1e4;
    for (let i = 0; i < 600; i++) econ(1);`);
  const r = JSON.parse(g.run('JSON.stringify(S.res)'));
  for (const k of ['fuel', 'tire', 'alu']) assert.ok(r[k] > 0 || g.run(`S.stats.made`) > 0, k + ' made');
  assert.ok(g.run('S.seen.motor') && g.run('S.seen.airship'), 'motors and airships made');
  assert.ok(r.wire < 1e4, 'the Engine Plant used shipped wire');
  // at equal levels no stage starves the next: every Mesa workshop is busy
  const f = JSON.parse(g.run('JSON.stringify(chainFlow())'));
  assert.ok(f, 'chain flow computed');
});

test('the sky lane blocks no plots, and towers can stand under it', () => {
  const g = load(); g.run(`setMap('mesa');`);
  assert.strictEqual(g.run('MAP.air'), 1);
  // a cell on the sky lane but off the road is buildable
  assert.strictEqual(g.run('onRoad(4, 7)'), false);
  assert.ok(g.run('PLOTS.some(p => p.x === 4 && p.y === 7)'));
  assert.strictEqual(g.run('onRoad(3, 10)'), true, 'the road still blocks its cells');
  assert.deepStrictEqual(JSON.parse(g.run('JSON.stringify(roadPaths())')), [0], 'the sky lane is not a road');
});

test('the airship flies the sky lane; only Tesla coils and drones can hit it', () => {
  const g = load(); inMesa(g);
  g.run(`S.wave = 10; S.best = 10; spawn('boss');`);
  assert.strictEqual(g.run('foes[0].p'), 1, 'on the sky lane');
  assert.strictEqual(g.run('foes[0].air'), 1);
  // a ground tower right under it never targets it; a Tesla coil does
  g.run(`foes[0].d = 6; const [x, y] = posAt(6, 1); foes[0].x = x; foes[0].y = y;
    S.towers = [{ c: 4, r: 7, type: 'cannon', lvl: 3, tg: 'first' }, { c: 5, r: 7, type: 'tesla', lvl: 3, tg: 'first' }];`);
  assert.strictEqual(g.run('pickTarget(S.towers[0], towerStats(S.towers[0]))'), null, 'cannon cannot reach the sky');
  assert.ok(g.run('pickTarget(S.towers[1], towerStats(S.towers[1])) === foes[0]'), 'Tesla can');
  // frost, poison clouds, tar and dynamite pass beneath it
  g.run(`clouds.push({ x: foes[0].x, y: foes[0].y, r: 2, t: 5, t0: 5, dps: 1e6 }); tars.push({ x: foes[0].x, y: foes[0].y, r: 2, t: 5, dps: 1e6, burn: 5 });
    bombs.push({ x: foes[0].x, y: foes[0].y, t: 0 }); S.towers = [{ c: 4, r: 7, type: 'frost', lvl: 3, tg: 'first' }]; W.active = true; W.queue = [];
    const hp0 = foes[0].hp; combat(.05); globalThis.__d = hp0 - foes[0].hp;`);
  assert.strictEqual(g.run('__d'), 0, 'no ground damage reaches it');
  assert.strictEqual(g.run('foes[0].slow'), 0, 'frost does not chill it');
  // a drone does
  g.run(`clouds = []; tars = []; S.towers = [{ c: 4, r: 7, type: 'helipad', lvl: 0, tg: 'first', up: {}, dr: { battery: 0, range: 0, attack: 0 } }];
    const hp1 = foes[0].hp; for (let i = 0; i < 40; i++) { foes[0].d = 6; combat(.05); } globalThis.__d = hp1 - foes[0].hp;`);
  assert.ok(g.run('__d') > 0, 'the drone strafes it');
});

test('soldiers ignore the airship; its brutes drop onto the road', () => {
  const g = load(); inMesa(g);
  g.run(`S.wave = 10; spawn('boss'); const f = foes[0]; f.d = 8; f.hp = f.max * .4; W.active = true; W.queue = []; combat(.01);`);
  const brutes = JSON.parse(g.run(`JSON.stringify(foes.filter(f => f.type === 'brute').map(f => f.p))`));
  assert.strictEqual(brutes.length, 2, 'two brutes dropped');
  assert.ok(brutes.every(p => p === 0), 'on the road, not in the sky');
  assert.ok(g.run('foes.filter(f => f.type === "brute").every(f => !f.air)'));
});

test('bringing the airship down counts, and its bounty is paid', () => {
  const g = load(); inMesa(g);
  g.run(`S.wave = 10; spawn('boss'); const c0 = S.coins; hurt(foes[0], 1e12); globalThis.__c = S.coins - c0;`);
  assert.strictEqual(g.run('S.stats.airships'), 1);
  assert.ok(g.run('__c') > 0);
  assert.strictEqual(g.run('S.badges.skies || 0'), 0, 'badge waits for checkBadges');
  g.run('checkBadges(true)'); assert.strictEqual(g.run('S.badges.skies'), 1);
});

test('in the background, a Mesa boss wave needs towers that reach the sky', () => {
  const g = load(); inMesa(g);
  g.run(`switchTown('gulch'); withTown('mesa', () => { S.wave = 10; S.autoWave = true; S.abT = 0; S.vaultHp = 20;
    S.towers = []; for (let i = 0; i < 6; i++) S.towers.push({ c: PLOTS[i].x, r: PLOTS[i].y, type: 'gatling', lvl: 12, tg: 'first' }); });`);
  g.run(`withTown('mesa', () => { globalThis.__w = [winsWave(9), winsWave(10)]; });`);
  assert.strictEqual(g.run('JSON.stringify(__w)'), '[true,false]', 'gatlings beat the riders but not the airship');
  g.run(`withTown('mesa', () => { S.towers.push({ c: PLOTS[7].x, r: PLOTS[7].y, type: 'tesla', lvl: 14, tg: 'first' }, { c: PLOTS[8].x, r: PLOTS[8].y, type: 'tesla', lvl: 14, tg: 'first' }); globalThis.__w = winsWave(10); });`);
  assert.strictEqual(g.run('__w'), true, 'with Tesla coils it falls');
  g.run(`withTown('mesa', () => autoBattle(1));`);
  assert.strictEqual(g.run('S.towns.mesa.wave'), 11);
  assert.strictEqual(g.run('S.stats.airships'), 1);
  // other towns are unchanged by the sky rule
  g.run(`withTown('falls', () => { S.towers = []; for (let i = 0; i < 6; i++) S.towers.push({ c: PLOTS[i].x, r: PLOTS[i].y, type: 'gatling', lvl: 12, tg: 'first' }); globalThis.__w = winsWave(10) === (townDps() * wayLen(MAPS.falls.paths[0]) / 1.1 * .6 >= waveHp(10)); });`);
  assert.strictEqual(g.run('__w'), true);
  // a background town uses its own map's toughness, not the one on screen
  assert.strictEqual(g.run(`withTown('mesa', () => waveHp(9)) / withTown('falls', () => waveHp(9))`).toFixed(4), (1.4 / 1.3).toFixed(4));
});

test('a charter in Thunder Mesa keeps its map and the Head Start perk builds its first gatherers', () => {
  const g = load(); inMesa(g);
  g.run('S.perks.start = 1; S.best = 45; S.life = 1e9; prestige();');
  assert.strictEqual(g.run('S.town'), 'mesa'); assert.strictEqual(g.run('S.map'), 'mesa');
  assert.strictEqual(g.run('S.ext.well'), 5); assert.strictEqual(g.run('S.ext.rubberf'), 5); assert.strictEqual(g.run('S.shops.oilref'), 1);
  assert.ok(g.run('S.chMap.mesa') >= 1);
});

test('the Oil Strike Legacy perk opens Thunder Mesa at a Convention; v10 saves migrate', () => {
  const g = load(); empire(g);
  g.run(`openCapital(); S.legacy.perks = { ridge: 1, falls: 1, mesa: 1 }; S.stats.coins = 1e12; S.legacy.from = 0; convene();`);
  assert.ok(g.run(`townOpen('mesa')`), 'open from the start');
  const h = load(); empire(h);
  h.run(`const o = JSON.parse(JSON.stringify(S)); o.v = 10; delete o.stats.airships; for (const k of ['oil', 'alu', 'airship']) delete o.res[k]; adopt(o);`);
  assert.strictEqual(h.run('S.v'), h.run('fresh().v'));
  assert.strictEqual(h.run('S.stats.airships'), 0);
  assert.strictEqual(h.run('S.res.alu'), 0);
});
