// node --test — poison, Frostbite, the Tesla research, tar pits and raider scaling, on the real game logic.
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('../scripts/sim');

const field = g => g.run(`S = fresh(); setMap('gulch'); foes = []; shots = []; clouds = []; tars = []; fx = []; S.coins = 1e9; S.wave = 20; W.active = true; W.queue = [];`);
const foe = (g, type, d) => g.run(`spawn('${type}'); (() => { const f = foes[foes.length - 1]; f.d = ${d}; const [x, y] = posAt(f.d, f.p); f.x = x; f.y = y; return f.hp; })()`);

test('poison seeps past a shieldbearer\'s shield', () => {
  const g = load(); field(g); foe(g, 'shield', 5);
  g.run('poison(foes[0], 50, 4); for (let i = 0; i < 20; i++) combat(.05);');
  assert.strictEqual(g.run('foes[0].sh'), 4, 'shield untouched');
  assert.ok(g.run('foes[0].hp < foes[0].max'), 'but it took damage');
});

test('the Snake Oil Still throws a flask that leaves a poison cloud', () => {
  const g = load(); field(g); foe(g, 'raider', 4);
  g.run(`const [x, y] = posAt(4.4, 0); S.towers.push({ type: 'still', c: Math.round(x), r: Math.round(y) + 1, lvl: 2, cd: 0 }); for (let i = 0; i < 30; i++) combat(.05);`);
  assert.ok(g.run('clouds.length') > 0 || g.run('foes.length === 0 || foes[0].psn'), 'a cloud formed and the raider is poisoned');
});

test('healers cure poison', () => {
  const g = load(); field(g); foe(g, 'raider', 5); foe(g, 'healer', 5.2);
  g.run('foes[0].hp = foes[0].max * .5; poison(foes[0], .001, 30); foes[1].ht = 0; combat(.05);');
  assert.strictEqual(g.run('foes[0].psn'), null);
});

test('Spreading Fever passes poison on when a poisoned raider dies', () => {
  const g = load(); field(g); foe(g, 'raider', 5); foe(g, 'raider', 5.4);
  g.run('poison(foes[0], 1, 4, { spread: 1 }); hurt(foes[0], 1e9);');
  assert.ok(g.run('foes[1].psn && foes[1].psn.t > 0'), 'the neighbor caught it');
});

test('Frostbite: chilled raiders take damage over time', () => {
  const g = load(); field(g); foe(g, 'shield', 5);
  g.run(`const [x, y] = posAt(5, 0); S.towers.push({ type: 'frost', br: 'c', c: Math.round(x), r: Math.round(y) + 1, lvl: 5, cd: 0 }); combat(.05);`);
  assert.ok(g.run('foes[0].psn && foes[0].psn.ice'), 'frostbitten');
  const hp = g.run('foes[0].hp'); g.run('S.towers = []; for (let i = 0; i < 10; i++) combat(.05);');
  assert.ok(g.run('foes[0].hp') < hp, 'losing health over time');
});

test('Conductive Fog: lightning arcs through everyone in a poison cloud', () => {
  const g = load(); field(g); for (const d of [5, 5.3, 5.6, 5.9]) foe(g, 'raider', d);
  g.run(`const [x, y] = posAt(5.4, 0); clouds.push({ x, y, r: 1.2, t: 5, t0: 5, dps: 0 }); S.research.fog = 1;
    S.towers.push({ type: 'tesla', c: Math.round(x), r: Math.round(y) + 1, lvl: 0, cd: 0 }); combat(.05);`);
  assert.ok(g.run("fx.some(e => e.k === 'bolt' && e.c === '#9dff7a')"), 'the cloud conducted the bolt');
  assert.strictEqual(g.run('foes.filter(f => f.hp < f.max).length'), 4, 'everyone in the cloud was hit');
});

test('Superconducting Ice: bolts jump far across chilled raiders', () => {
  const g = load(); field(g); foe(g, 'raider', 3); foe(g, 'raider', 6);
  g.run(`const [x, y] = posAt(1.2, 0); foes[1].slow = 2; S.towers.push({ type: 'tesla', c: Math.round(x), r: Math.round(y) + 1, lvl: 0, cd: 0 });`);
  g.run('combat(.05);'); const without = g.run('foes[1].hp < foes[1].max');
  const g2 = load(); field(g2); foe(g2, 'raider', 3); foe(g2, 'raider', 6);
  g2.run(`const [x, y] = posAt(1.2, 0); foes[1].slow = 2; S.research.sice = 1; S.towers.push({ type: 'tesla', c: Math.round(x), r: Math.round(y) + 1, lvl: 0, cd: 0 }); combat(.05);`);
  assert.strictEqual(without, false, 'too far without the research');
  assert.ok(g2.run('foes[1].hp < foes[1].max'), 'reached with it');
});

test('tar slows raiders and burns when an explosion reaches it', () => {
  const g = load(); field(g); foe(g, 'raider', 5); foe(g, 'raider', 1);
  g.run(`const [x, y] = posAt(5, 0); tars.push({ x, y, r: 1, t: 12, dps: 100 }); for (let i = 0; i < 10; i++) combat(.05);`);
  const tarred = g.run('foes[0].d - 5'), free = g.run('foes[1].d - 1');
  assert.ok(tarred < free * .5, 'tarred raider moved ' + tarred + ' against ' + free);
  g.run(`fx.push({ k: 'boom', x: tars[0].x, y: tars[0].y, r: 1, t: .3 }); combat(.05);`);
  assert.ok(g.run('tars[0].burn') > 0, 'set alight');
});

test('raiders get slightly tougher only after wave 12', () => {
  const g = load();
  const base = w => 10 * Math.pow(1.25, w - 1) * (1 + w * .05);
  assert.ok(Math.abs(g.run('foeHp(12)') - base(12)) < 1e-6, 'unchanged at wave 12');
  assert.ok(Math.abs(g.run('foeHp(27)') / base(27) - 1.15) < 1e-6, '+15% at wave 27');
  assert.ok(Math.abs(g.run('foeHp(60)') / base(60) - 1.15) < 1e-6, 'capped at +15%');
});
