// node --test — the juice: a first build stands in scaffolding and pops out of a ring of dust, upgrades sparkle, the
// boss rides in with a banner and a camera move, and none of it leaks from towns working in the background.
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('../scripts/sim');

const start = g => g.run(`S = fresh(); setMap('gulch'); S.coins = 1e12; for (const k in S.res) S.res[k] = 1e6; FXS.build = {}; FXS.pop = {}; FXS.sparks = []; FXS.bossCam = 0; FXS.banner = null; parts.length = 0;`);
const step = (g, secs) => g.run(`for (let i = 0; i < ${Math.round(secs / .05)}; i++) cosmetics(.05, i * .05);`);

test('a first build stands in scaffolding, then pops out of a ring of dust', () => {
  const g = load(); start(g);
  const id = g.run(`const b = BUILD.find(b => !blv(b.def.id) && SLOT[b.def.id]); buyBuilding(b); b.def.id`);
  assert.ok(g.run(`FXS.build['${id}']`) > 1, 'the scaffold timer starts');
  assert.strictEqual(g.run(`FXS.pop['${id}']`), undefined, 'no pop while the scaffold is up');
  step(g, .3);
  assert.strictEqual(g.run(`FXS.pop['${id}']`), undefined, 'still building');
  const before = g.run('parts.filter(p => p.smoke).length');
  step(g, .6); // past SCAF_T
  assert.ok(g.run(`FXS.pop['${id}'] > 0`), 'the building pops when the scaffold comes down');
  assert.ok(g.run('parts.filter(p => p.smoke).length') >= before + 15, 'a ring of dust');
  assert.ok(g.run('FXS.sparks.length') > 0, 'and a few sparkles');
  step(g, .6);
  assert.strictEqual(g.run(`FXS.build['${id}']`), undefined, 'the timer is cleared at the end');
});

test('a new level of a standing building pops and sparkles without scaffolding', () => {
  const g = load(); start(g);
  const id = g.run(`const b = BUILD.find(b => SLOT[b.def.id]); S[b.kind][b.def.id] = 3; buyBuilding(b); b.def.id`);
  assert.strictEqual(g.run(`FXS.build['${id}']`), undefined);
  assert.ok(g.run(`FXS.pop['${id}'] > 0`));
  const [sx, sy] = g.run(`SLOT['${id}']`);
  assert.ok(g.run('FXS.sparks.length') >= 10, 'sparkles');
  assert.ok(g.run(`FXS.sparks.every(q => Math.abs(q.x - ${sx + 1}) < .01 && Math.abs(q.y - ${sy + 1}) < .01)`), 'centred on the building');
  step(g, 2);
  assert.strictEqual(g.run('FXS.sparks.length'), 0, 'sparkles burn out');
});

test('foremen buying quietly make no scaffolds or sparkles', () => {
  const g = load(); start(g);
  g.run(`const b = BUILD.find(b => SLOT[b.def.id]); levelled(b, 0, 1, true); levelled(b, 1, 2, true);`);
  assert.strictEqual(g.run('Object.keys(FXS.build).length'), 0);
  assert.strictEqual(g.run('FXS.sparks.length'), 0);
});

test('tower upgrades sparkle and pop over the tower', () => {
  const g = load(); start(g);
  g.run(`const pl = PLOTS[0]; buildTower('crossbow', pl.x, pl.y); var T = S.towers[S.towers.length - 1]; upgradeTower(T);`);
  assert.ok(g.run('FXS.sparks.length') >= 10);
  assert.ok(g.run('FXS.sparks.every(q => q.x === T.c + .5 && q.y === T.r + .5)'));
  assert.ok(g.run('TPOP.get(T) > 0'), 'the tower pops');
  step(g, .5);
  assert.strictEqual(g.run('TPOP.has(T)'), false, 'the pop ends');
  g.run('FXS.sparks = []; T.lvl = 4; branchTower(T, "a")');
  assert.ok(g.run('FXS.sparks.length') >= 20, 'a branch sparkles more');
});

test('sparkles are capped so a burst of upgrades cannot flood the scene', () => {
  const g = load(); start(g);
  g.run('for (let i = 0; i < 40; i++) sparkle(3, 5, 14, 1);');
  assert.ok(g.run('FXS.sparks.length') <= 90);
});

test('a background town levelling up or upgrading towers puts no effects on the map you are watching', () => {
  const g = load(); start(g);
  g.run(`S.best = 40; unlockTown('ridge'); S.coins = 1e12;
    withTown('ridge', () => { const b = BUILD.find(b => SLOT[b.def.id]); S.coins = 1e12; for (const k in S.res) S.res[k] = 1e6; buyBuilding(b); buyBuilding(b);
      const pl = PLOTS[0]; buildTower('crossbow', pl.x, pl.y); upgradeTower(S.towers[S.towers.length - 1]); spawn('boss'); });`);
  assert.strictEqual(g.run('Object.keys(FXS.build).length'), 0);
  assert.strictEqual(g.run('FXS.sparks.length'), 0);
  assert.strictEqual(g.run('TPOP.size'), 0);
  assert.strictEqual(g.run('FXS.bossCam'), 0);
});

test('the boss rides in with its own banner and a camera move that eases in and out', () => {
  const g = load(); start(g);
  g.run(`S.wave = 10; planWave(); startWave(); W.queue = []; FXS.banner = null; spawn('raider');`);
  assert.strictEqual(g.run('FXS.bossCam'), 0, 'a raider gets no entrance');
  assert.strictEqual(g.run('FXS.banner'), null);
  g.run(`spawn('boss')`);
  assert.ok(g.run('FXS.bossCam') > 3);
  assert.strictEqual(g.run('FXS.banner.a'), g.run('bossName()'));
  assert.strictEqual(g.run('FXS.banner.enter'), 1);
  assert.strictEqual(g.run('bossCamK()'), 0, 'starts from the player view');
  step(g, 1.2);
  assert.ok(g.run('bossCamK()') > .99, 'fully on the boss after the ease in');
  step(g, 1.5);
  const k = g.run('bossCamK()'); assert.ok(k > 0 && k < 1, 'easing back out: ' + k);
  step(g, 1);
  assert.strictEqual(g.run('bossCamK()'), 0, 'back to the player view');
  g.run(`FXS.bossCam = 2; REDUCED = true;`);
  assert.strictEqual(g.run('bossCamK()'), 0, 'calm motion keeps the camera still');
});

test('the airship of Thunder Mesa rides in too, and destroying a boss ends the camera move', () => {
  const g = load();
  g.run(`S = fresh(); setMap('gulch'); S.coins = 1e12; S.best = 40; unlockTown('ridge'); S.towns.ridge.best = 30; unlockTown('falls'); S.towns.falls.best = 20; S.coins = 1e12;
    openCapital(); S.capital.lv.transport = 5; unlockTown('mesa'); switchTown('mesa'); foes = []; S.wave = 10; planWave(); startWave(); W.queue = []; FXS.bossCam = 0; spawn('boss');`);
  assert.ok(g.run('FXS.bossCam') > 3);
  assert.match(g.run('FXS.banner.b'), /Sky pirates/);
  g.run(`const f = foes.find(f => f.type === 'boss'); hurt(f, f.max * 2, { pierce: 1 }); combat(.05);`);
  assert.strictEqual(g.run('FXS.bossCam'), 0);
});

test('coin bursts are safe without a screen (the simulation and background towns)', () => {
  const g = load(); start(g);
  assert.doesNotThrow(() => g.run('coinBurst(5, 5, 10, 100); coinBurstFrom(null, 5, 10); coinPop(5);'));
  // delivering an order and clearing a wave still pay the same
  g.run(`S.wave = 3; planWave(); startWave(); W.queue = []; foes = []; var c0 = S.coins; combat(.05);`);
  assert.ok(g.run('S.coins > c0'), 'the wave bonus is paid');
});
