// node --test — save slots (three empires on a device, the one in play under KEY, the others waiting in slot keys),
// save codes and files (compressed codes, older codes, raw JSON, saves from a newer version refused), the undo copy,
// and the controller helpers that need no browser (src/pad.js).
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('../scripts/sim');

const empire = (g, coins, wave, extra = '') => g.run(`S = fresh(); setMap('gulch'); S.coins = ${coins}; S.life = ${coins}; S.stats.coins = ${coins}; S.wave = ${wave}; S.tut = 'done'; ${extra} save();`);

test('a new game goes into a free slot; the empire in play waits in its own slot and comes back as it was', () => {
  const g = load();
  empire(g, 5e6, 37, `S.deeds = 4; S.opt.music = .3; S.opt.calm = 'calm'; S.seenVersion = 'x'; buildTower('crossbow', PLOTS[0].x, PLOTS[0].y); S.coins = 5e6;`);
  assert.strictEqual(g.run('slotOn()'), 1);
  assert.deepStrictEqual(g.run('JSON.stringify(slotList().map(x => x.empty))'), '[false,true,true]');
  assert.ok(g.run('newEmpire()'));
  assert.strictEqual(g.run('slotOn()'), 2, 'the new empire plays in slot 2');
  assert.ok(g.run('S.coins < 1000 && S.wave === 1 && S.deeds === 0 && !S.towers.length && S.tut === undefined'), 'a bare plot (and the tutorial is offered)');
  assert.ok(g.run(`S.opt.music === .3 && S.opt.calm === 'calm' && S.seenVersion === 'x'`), 'settings stay with the device');
  const s1 = JSON.parse(g.run('JSON.stringify(slotInfo(1))'));
  assert.deepStrictEqual([s1.town, s1.wave, s1.towns, s1.coins, s1.on, s1.empty], ['Copper Gulch', 37, 1, 5e6, false, false]);
  assert.strictEqual(g.run('JSON.parse(localStorage.getItem(KEY)).wave'), 1, 'the new empire is saved as the one in play');
  assert.ok(g.run(`localStorage.getItem(KEY + '-slot') === '2' && !localStorage.getItem(slotKey(2))`), 'slot 2 has no stale copy');
  // play the new one a little, then go back to slot 1
  g.run('S.coins = 777; S.wave = 3; S.opt.music = 1;');
  assert.strictEqual(g.run('playSlot(1)'), 'swap');
  assert.ok(g.run('S.coins === 5e6 && S.wave === 37 && S.deeds === 4 && S.towers.length === 1'), 'slot 1 is back as it was');
  assert.strictEqual(g.run('S.opt.music'), 1, 'with the current settings');
  assert.ok(g.run('Date.now() - S.last < 5000'), 'no time-away earnings for the time it waited');
  assert.strictEqual(g.run('slotInfo(2).wave'), 3, 'and slot 2 waits with its progress');
  assert.strictEqual(g.run('playSlot(1)'), '', 'playing the slot already in play changes nothing');
  assert.strictEqual(g.run('playSlot(3)'), 'new', 'an empty slot starts a new empire');
  assert.deepStrictEqual(g.run('JSON.stringify(slotList().map(x => x.on ? "on" : x.wave))'), '[37,3,"on"]');
});

test('a damaged slot or full storage never loses the empire in play', () => {
  const g = load();
  empire(g, 123456, 12);
  g.run(`localStorage.setItem(slotKey(2), '{not json');`);
  assert.ok(g.run('slotInfo(2).bad'), 'shown as damaged');
  assert.strictEqual(g.run('playSlot(2)'), ''); assert.ok(g.run('S.coins === 123456 && S.wave === 12 && slotOn() === 1'));
  g.run(`localStorage.setItem(slotKey(2), JSON.stringify({ v: 12, res: 5, towers: 'x', towns: 3 }));`);
  assert.strictEqual(g.run('playSlot(2)'), ''); assert.ok(g.run('S.coins === 123456 && S.wave === 12 && slotOn() === 1'), 'not a save: nothing changes');
  g.run(`localStorage.removeItem(slotKey(2)); const set = localStorage.setItem; localStorage.setItem = () => { throw new Error('full'); }; globalThis.__r = [playSlot(2), newEmpire()]; localStorage.setItem = set;`);
  assert.deepStrictEqual(g.run('JSON.stringify(__r)'), '["",false]');
  assert.ok(g.run('S.coins === 123456 && S.wave === 12 && slotOn() === 1'), 'no switch unless the empire in play is safely stored first');
});

test('with every slot in use a new game replaces the empire in play, kept as an undo copy', () => {
  const g = load();
  empire(g, 9e5, 20); g.run('playSlot(2); S.wave = 5; save(); playSlot(3); S.wave = 8; save();');
  assert.strictEqual(g.run('freeSlot()'), 0);
  assert.ok(g.run('newEmpire()'));
  assert.ok(g.run('S.wave === 1 && slotOn() === 3'), 'started over in slot 3');
  assert.deepStrictEqual(g.run('JSON.stringify(slotList().map(x => x.wave))'), '[20,5,1]', 'the other slots are untouched');
  assert.strictEqual(g.run('undoInfo().wave'), 8);
  assert.ok(g.run('undoLoad()')); assert.ok(g.run('S.wave === 8 && slotOn() === 3 && undoInfo() === null'), 'brought back');
  // erasing: a waiting slot is removed, the slot in play starts over (with an undo copy)
  assert.ok(g.run('eraseSlot(1)')); assert.ok(g.run('slotInfo(1).empty'));
  assert.ok(g.run('eraseSlot(3)')); assert.ok(g.run('S.wave === 1 && undoInfo().wave === 8'));
});

test('the one empire put aside by the last version moves into a free slot', () => {
  const g = load();
  empire(g, 1e6, 30); g.run(`const o = fresh(); o.wave = 44; o.town = 'gulch'; localStorage.setItem(ASIDE, JSON.stringify(o));`);
  assert.strictEqual(g.run('slotList()[1].wave'), 44);
  assert.ok(g.run('localStorage.getItem(ASIDE) === null'));
  assert.strictEqual(g.run('playSlot(2)'), 'swap'); assert.strictEqual(g.run('S.wave'), 44);
});

test('save codes: compressed, shorter, and older codes, raw JSON and junk are told apart', async () => {
  const g = load();
  empire(g, 4e7, 33, `for (const k in S.res) S.res[k] = 123.456; buildTower('crossbow', PLOTS[0].x, PLOTS[0].y);`);
  const code = await g.run('saveCode(slotSave(1))');
  assert.ok(code.startsWith('CG1.'), 'a compressed code');
  const plain = g.run('btoa(unescape(encodeURIComponent(JSON.stringify(slotSave(1)))))');
  assert.ok(code.length < plain.length * .6, 'much shorter than the old code (' + code.length + ' vs ' + plain.length + ')');
  g.run(`globalThis.__c = ${JSON.stringify(code)}; globalThis.__p = ${JSON.stringify(plain)};`);
  assert.strictEqual(await g.run(`readSaveCode(__c.replace(/(.{60})/g, '$1\\n')).then(r => r.s.wave + ':' + r.o.towers.length)`), '33:1', 'a code broken over lines still reads');
  assert.strictEqual(await g.run('readSaveCode(__p).then(r => r.s.wave)'), 33, 'an old plain code');
  assert.strictEqual(await g.run('readSaveCode(JSON.stringify(slotSave(1))).then(r => r.s.coins)'), 4e7, 'raw JSON from a save file');
  assert.strictEqual(await g.run(`readSaveCode('hello there').then(r => r.err)`), 'bad');
  assert.strictEqual(await g.run(`readSaveCode('CG1.AAAA').then(r => r.err)`), 'bad');
  assert.strictEqual(await g.run(`readSaveCode('  ').then(r => r.err)`), 'empty');
  assert.strictEqual(await g.run(`readSaveCode(JSON.stringify({ v: 2, x: 1 })).then(r => r.err)`), 'bad', 'JSON that is not a save');
  assert.strictEqual(await g.run(`readSaveCode(JSON.stringify(Object.assign(fresh(), { v: fresh().v + 1 }))).then(r => r.err)`), 'newer');
  assert.match(g.run('saveFileName(slotSave(1))'), /^copper-gulch-copper-gulch-wave-33-\d{4}-\d\d-\d\d\.json$/);
});

test('a save loaded into a waiting slot is stored; into the slot in play it replaces the empire, with an undo copy', async () => {
  const g = load();
  empire(g, 2e6, 15);
  g.run(`globalThis.__o = Object.assign(fresh(), { wave: 61, coins: 42, v: 9 });`);
  assert.ok(g.run('loadInto(2, __o)')); assert.ok(g.run('slotInfo(2).wave === 61 && S.wave === 15'), 'stored as it is, the empire in play untouched');
  assert.strictEqual(g.run('playSlot(2)'), 'swap'); assert.ok(g.run('S.wave === 61 && S.v === fresh().v'), 'upgraded when played');
  g.run('playSlot(1);');
  assert.ok(g.run('loadInto(1, __o)')); assert.ok(g.run('S.wave === 61 && slotOn() === 1 && undoInfo().wave === 15'));
  assert.strictEqual(g.run('loadInto(1, { res: 3 })'), false, 'not a save');
  assert.ok(g.run('undoLoad() && S.wave === 15'));
});

test('controller: dead zones, held repeat, a cursor that turns with the camera, and the next button in a direction', () => {
  const g = load();
  assert.strictEqual(g.run('padDead(.1)'), 0); assert.strictEqual(g.run('padDead(1)'), 1); assert.ok(Math.abs(g.run('padDead(-.61)') + .5) < .01);
  assert.deepStrictEqual(g.run(`[padStickDir(.2, .1), padStickDir(.9, .2), padStickDir(-.3, -.8), padStickDir(0, .7)].join()`), ',right,up,down');
  assert.deepStrictEqual(g.run(`[padRepeat('k', true, 0), padRepeat('k', true, 200), padRepeat('k', true, 361), padRepeat('k', true, 400), padRepeat('k', true, 472), padRepeat('k', false, 480), padRepeat('k', true, 490)].join()`),
    'true,false,true,false,true,false,true', 'fires on the press, after 0.36 s, then every 0.11 s; letting go resets it');
  assert.deepStrictEqual(g.run(`JSON.stringify([padStep([5, 8], 'right'), padStep([5, 8], 'up'), padStep([0, 0], 'left'), padStep([11, 13], 'down')])`), '[[6,8],[5,7],[0,0],[11,13]]');
  assert.deepStrictEqual(g.run(`JSON.stringify([padStep([5, 8], 'right', Math.PI / 2), padStep([5, 8], 'up', Math.PI / 2), padStep([5, 8], 'right', Math.PI)])`), '[[5,7],[4,8],[4,8]]', 'the camera turned a quarter: screen right is up the board');
  // two rows of buttons: right goes along the row, down to the one below, not to the far end of the row below
  const rs = JSON.stringify([{ x: 0, y: 0, w: 80, h: 30 }, { x: 90, y: 0, w: 80, h: 30 }, { x: 180, y: 0, w: 80, h: 30 }, { x: 0, y: 40, w: 80, h: 30 }, { x: 180, y: 40, w: 80, h: 30 }]);
  assert.deepStrictEqual(g.run(`(() => { const r = ${rs}; return [padNearest(r[0], r, 'right'), padNearest(r[1], r, 'right'), padNearest(r[0], r, 'down'), padNearest(r[2], r, 'down'), padNearest(r[3], r, 'up'), padNearest(r[0], r, 'left'), padNearest(r[1], r, 'down')].join(); })()`),
    '1,2,3,4,0,-1,3');
  g.run('PAD.prev = {};');
  assert.strictEqual(g.run(`JSON.stringify(padEdges([{ pressed: true }, { pressed: false }, null, { value: .9 }]).hit)`).includes('"a":true'), true);
  assert.strictEqual(g.run(`padEdges([{ pressed: true }]).hit.a`), false, 'held is not pressed again');
  assert.strictEqual(g.run(`padEdges([{ pressed: false }, null, null, null, null, null, null, { value: .8 }]).hit.rt`), true);
});
