// node --test — the Barracks: soldiers hold a rally point, stop raiders, respawn, and the three tracks.
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('../scripts/sim');

const setup = g => g.run(`S = fresh(); setMap('gulch'); foes = []; troops = []; shots = []; S.coins = 1e12; S.best = 30; S.wave = 15; W.active = true; W.queue = []; for (const k in S.res) S.res[k] = 1e6;
  buildTower('barracks', 3, 8); (() => { const t = S.towers[0]; setRally(t, 3, 7); return t; })()`);
const raider = (g, type, d) => g.run(`spawn('${type}'); (() => { const f = foes[foes.length - 1]; f.d = ${d}; const [x, y] = posAt(f.d, f.p); f.x = x; f.y = y; })()`);

test('the Barracks opens at wave 15 and sends a soldier to its rally point', () => {
  const g = load();
  g.run(`S = fresh(); setMap('gulch'); S.coins = 1e9; S.best = 10; for (const k in S.res) S.res[k] = 1e6;`);
  assert.strictEqual(g.run(`buildTower('barracks', 3, 8)`), false, 'locked before wave 15');
  setup(g);
  g.run('for (let i = 0; i < 60; i++) combat(.05);');
  assert.strictEqual(g.run('troops.length'), 1);
  assert.ok(g.run('Math.hypot(troops[0].x - 3, troops[0].y - 7)') < .2, 'standing at the rally point');
});

test('a soldier stops a raider and they fight', () => {
  const g = load(); setup(g); g.run('for (let i = 0; i < 60; i++) combat(.05);');
  raider(g, 'brute', 2); const d0 = g.run('foes[0].d');
  g.run('for (let i = 0; i < 40; i++) combat(.05);');
  const moved = g.run('foes.length ? foes[0].d - ' + d0 + ' : 99');
  assert.ok(moved < 1.6, 'the brute was held near the soldier, moved ' + moved);
  assert.ok(g.run('troops.length === 0 || troops[0].hp < troops[0].max || !foes.length'), 'blows were traded');
});

test('war wagons walk straight through soldiers', () => {
  const g = load(); setup(g); g.run('for (let i = 0; i < 60; i++) combat(.05);');
  raider(g, 'boss', 2); g.run('foes[0].hp = foes[0].max = 1e12; for (let i = 0; i < 40; i++) combat(.05);');
  assert.ok(g.run('foes[0].d') > 2 + .5 * 2 * .9, 'kept moving');
});

test('a fallen soldier comes back after the spawn time, sooner with Drill', () => {
  const g = load(); setup(g); g.run('for (let i = 0; i < 60; i++) combat(.05);');
  g.run('troops[0].hp = 0; combat(.05);'); assert.strictEqual(g.run('troops.length'), 0);
  g.run('for (let i = 0; i < 200; i++) combat(.05);'); assert.strictEqual(g.run('troops.length'), 0, 'not back after 10 s (12 s spawn)');
  g.run('for (let i = 0; i < 60; i++) combat(.05);'); assert.strictEqual(g.run('troops.length'), 1, 'back after 12 s');
  g.run('for (let i = 0; i < 5; i++) upgradeTrack(S.towers[0], "time");');
  assert.ok(g.run('troopStats(S.towers[0]).time') < 6.5, 'Drill shortens it');
});

test('Recruits add soldiers (up to six) and Arms makes them stronger', () => {
  const g = load(); setup(g);
  const hp0 = g.run('troopStats(S.towers[0]).hp');
  g.run('for (let i = 0; i < 9; i++) upgradeTrack(S.towers[0], "count"); upgradeTrack(S.towers[0], "power");');
  assert.strictEqual(g.run('troopStats(S.towers[0]).count'), 6, 'capped at six');
  assert.ok(g.run('troopStats(S.towers[0]).hp') > hp0 * 1.3);
  g.run('for (let i = 0; i < 200; i++) combat(.05);'); assert.strictEqual(g.run('troops.length'), 6);
});

test('the rally point must be a road cell within reach', () => {
  const g = load(); setup(g);
  assert.strictEqual(g.run('setRally(S.towers[0], 3, 10)'), false, 'not road');
  assert.strictEqual(g.run('setRally(S.towers[0], 9, 7)'), false, 'out of reach');
  assert.strictEqual(g.run('setRally(S.towers[0], 4, 7)'), true);
});
