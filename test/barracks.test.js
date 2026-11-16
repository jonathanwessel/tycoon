// node --test — the Barracks (built beside the road; soldiers march back along it to meet raiders) and the Helipad.
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('../scripts/sim');

// Copper Gulch: the road runs along row 7 from the west; (3, 8) is a plot right beside it, (11, 10) is not
const setup = g => g.run(`S = fresh(); setMap('gulch'); foes = []; troops = []; shots = []; S.coins = 1e15; S.best = 40; S.wave = 30; W.active = true; W.queue = []; for (const k in S.res) S.res[k] = 1e6;
  buildTower('barracks', 3, 8)`);
const raider = (g, type, d) => g.run(`spawn('${type}'); (() => { const f = foes[foes.length - 1]; f.d = ${d}; const [x, y] = posAt(f.d, f.p); f.x = x; f.y = y; })()`);

test('the Barracks is late game (wave 25) and only stands right beside the road', () => {
  const g = load();
  g.run(`S = fresh(); setMap('gulch'); S.coins = 1e15; S.best = 20; for (const k in S.res) S.res[k] = 1e6;`);
  assert.strictEqual(g.run(`buildTower('barracks', 3, 8)`), false, 'locked before wave 25');
  g.run('S.best = 30;');
  assert.strictEqual(g.run(`buildTower('barracks', 11, 10)`), false, 'not beside the road');
  assert.strictEqual(g.run(`buildTower('barracks', 3, 8)`), true, 'beside the road');
  assert.ok(g.run('TOWERS.barracks.coins') >= 50000, 'priced for late game');
});

test('soldiers step onto the road and march back up it, holding at their reach when nobody comes', () => {
  const g = load(); assert.strictEqual(setup(g), true);
  g.run('for (let i = 0; i < 200; i++) combat(.05);');
  assert.strictEqual(g.run('troops.length'), 1);
  const door = g.run('S.towers[0].door.d'), d = g.run('troops[0].d'), reach = g.run('troopStats(S.towers[0]).reach');
  assert.ok(Math.abs(d - Math.max(0, door - reach)) < .1, 'held ' + reach + ' cells up the road (door ' + door + ', at ' + d + ')');
  assert.ok(g.run('onRoad(Math.round(troops[0].x), Math.round(troops[0].y))'), 'standing on the road');
});

test('a soldier meets a raider coming down the road and stops it', () => {
  const g = load(); setup(g); g.run('for (let i = 0; i < 200; i++) combat(.05);');
  raider(g, 'brute', 0); g.run('foes[0].hp = foes[0].max = 1e9;');
  g.run('for (let i = 0; i < 100; i++) combat(.05);');
  const fd = g.run('foes[0].d'), td = g.run('troops.length ? troops[0].d : -1');
  assert.ok(fd < g.run('S.towers[0].door.d'), 'the brute never got past the barracks door');
  assert.ok(td < 0 || Math.abs(fd - td) < .6, 'they are fighting');
});

test('war wagons walk straight through soldiers', () => {
  const g = load(); setup(g); g.run('for (let i = 0; i < 200; i++) combat(.05);');
  raider(g, 'boss', 0); g.run('foes[0].hp = foes[0].max = 1e15; for (let i = 0; i < 60; i++) combat(.05);');
  assert.ok(g.run('foes[0].d') > 1.2, 'kept moving');
});

test('a fallen soldier comes back after the spawn time, sooner with Drill; Recruits and Arms', () => {
  const g = load(); setup(g); g.run('for (let i = 0; i < 200; i++) combat(.05);');
  g.run('troops[0].hp = 0; combat(.05);'); assert.strictEqual(g.run('troops.length'), 0);
  g.run('for (let i = 0; i < 240; i++) combat(.05);'); assert.strictEqual(g.run('troops.length'), 0, 'not back after 12 s (14 s spawn)');
  g.run('for (let i = 0; i < 60; i++) combat(.05);'); assert.strictEqual(g.run('troops.length'), 1, 'back after 14 s');
  g.run('for (let i = 0; i < 5; i++) upgradeTrack(S.towers[0], "time");'); assert.ok(g.run('troopStats(S.towers[0]).time') < 7.5);
  const hp0 = g.run('troopStats(S.towers[0]).hp');
  g.run('for (let i = 0; i < 9; i++) upgradeTrack(S.towers[0], "count"); upgradeTrack(S.towers[0], "power");');
  assert.strictEqual(g.run('troopStats(S.towers[0]).count'), 6, 'capped at six');
  assert.ok(g.run('troopStats(S.towers[0]).hp') > hp0 * 1.25);
});

test('a Barracks with Drill, Recruits and Arms at 5 rebuilds as a Drone Helipad; it cannot be built directly', () => {
  const g = load(); setup(g);
  assert.strictEqual(g.run(`buildTower('helipad', 5, 8)`), false, 'not in the build list');
  assert.strictEqual(g.run('rebuildHelipad(S.towers[0])'), false, 'tracks not at 5 yet');
  g.run('for (const k of ["time", "count", "power"]) for (let i = 0; i < 5; i++) upgradeTrack(S.towers[0], k);');
  assert.strictEqual(g.run('rebuildHelipad(S.towers[0])'), true);
  assert.strictEqual(g.run('S.towers[0].type'), 'helipad');
});

test('the drone stays inside its circle, hits even a war wagon, and lands to recharge', () => {
  const g = load(); setup(g);
  g.run('for (const k of ["time", "count", "power"]) for (let i = 0; i < 5; i++) upgradeTrack(S.towers[0], k); rebuildHelipad(S.towers[0]); troops = [];');
  raider(g, 'boss', 1); g.run('foes[0].hp = foes[0].max = 1e15;');
  let far = 0;
  for (let i = 0; i < 400; i++) { g.run('combat(.05);'); far = Math.max(far, g.run('Math.hypot(S.towers[0].drone.x - S.towers[0].c, S.towers[0].drone.y - S.towers[0].r)')); }
  assert.ok(far <= g.run('droneStats(S.towers[0]).range') + 1e-6, 'never beyond reach, max ' + far);
  assert.ok(g.run('foes.length ? foes[0].hp < foes[0].max : true'), 'the war wagon was hit');
  g.run('S.towers[0].drone.bat = 0.01; for (let i = 0; i < 60; i++) combat(.05);');
  assert.ok(['charge', 'pad'].includes(g.run('S.towers[0].drone.mode')), 'landed to recharge');
});

test('auto-sell keeps enough of a good to build towers with it', () => {
  const g = load();
  g.run(`S = fresh(); setMap('gulch'); useTown('ridge'); S.research.ledger = 1; S.auto.stone = 1; S.res.stone = 500; econStep(1);`);
  assert.ok(g.run('S.res.stone') >= g.run('towerGoods("crossbow").stone * 2'), 'kept ' + g.run('S.res.stone') + ' stone for crossbows');
});
