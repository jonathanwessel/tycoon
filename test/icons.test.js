// node --test — interface icons rendered from the 3D models: every building, tower and path, raider, unit and Capital
// building has a job with a model behind it, names that are not rendered yet fall back on a pixel sprite, and a
// finished picture replaces the old one everywhere it shows.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { load } = require('../scripts/sim');
const src = f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');

test('the job list covers every building, tower path, raider, unit and Capital building once', () => {
  const g = load(), jobs = g.run('iconJobs()');
  const names = jobs.map(j => j.name);
  assert.strictEqual(new Set(names).size, names.length, 'no name twice');
  for (const id of g.run('BUILD_ALL.map(b => b.def.id)')) assert.ok(names.includes(id), 'building ' + id);
  for (const id of ['market', 'hall', 'office', 'vault', 'wagon', 'capitol', 'worker', 'foreman', 'soldier', 'drone']) assert.ok(names.includes(id), id);
  for (const [t, brs] of g.run('Object.keys(TOWERS).map(t => [t, Object.keys(BRANCH[t] || {})])')) {
    assert.ok(names.includes(t), 'tower ' + t);
    for (const br of brs) assert.ok(jobs.some(j => j.name === t + '_' + br && j.id === t && j.br === br), 'path ' + t + '_' + br);
  }
  for (const f of g.run('Object.keys(FOES)')) assert.ok(names.includes(f), 'raider ' + f);
  for (const boss of g.run('Object.values(TOWNS).map(T => T.boss.spr)')) assert.ok(names.includes(boss), 'boss ' + boss);
  for (const id of g.run('Object.keys(INST)')) assert.ok(jobs.some(j => j.name === 'cap_' + id && j.kind === 'site' && j.id === id), 'institution ' + id);
  for (const k of g.run('Object.keys(ITEMS)')) if (!g.run(`BUILD_ALL.some(b => b.def.id === '${k}')`) && !['wheel'].includes(k)) assert.ok(!names.includes(k), 'goods keep their pixel art: ' + k);
});

test('every job has a 3D model of that name', () => {
  const g = load(), jobs = g.run('iconJobs()');
  const bld = src('r3d/buildings.js'), units = src('r3d/units.js'), cap = src('r3d/capital3d.js'), icons = src('r3d/icons.js');
  for (const j of jobs) {
    if (j.kind === 'bld') assert.ok(new RegExp('\\n  ' + j.id + '\\(k').test(bld), 'building model ' + j.id);
    else if (j.kind === 'foe') assert.ok(new RegExp('\\n  ' + j.id + ': \\(\\) =>|\\nFOE\\.' + j.id + ' = ').test(units), 'raider model ' + j.id);
    else if (j.kind === 'site') assert.ok(j.id === 'capitol' || new RegExp('\\n  ' + j.id + '\\(k').test(cap.slice(cap.indexOf('const INST3D'))), 'Capital model ' + j.id);
    else if (j.kind === 'unit') assert.ok(new RegExp(j.id + ':').test(icons), 'unit model ' + j.id);
    else assert.ok(new RegExp("kind === '" + j.kind + "'").test(icons), 'icons.js draws ' + j.kind);
  }
  // the 3D view renders them (a few a frame) and ico() tags each image with its name so it can be swapped
  assert.match(src('r3d/main.js'), /iconsStep\(V\.r\)/);
  assert.match(src('ui/core.js'), /'data-ico': name/);
});

test('names without a sprite of their own fall back on one until rendered', () => {
  const g = load();
  g.run(`for (const n of ['office', 'vault', 'cannon', 'loco', 'market', 'flask', 'chart', 'camp']) SPR[n] = { width: 16, height: 16 };`);
  assert.strictEqual(g.run(`iconBase('capitol')`), 'office');
  assert.strictEqual(g.run(`iconBase('cap_bank')`), 'vault');
  assert.strictEqual(g.run(`iconBase('cap_war')`), 'cannon');
  assert.strictEqual(g.run(`iconBase('cap_transport')`), 'loco');
  assert.strictEqual(g.run(`iconBase('camp')`), 'camp');
  for (const id of g.run('Object.keys(INST)')) assert.ok(g.run(`!!SPR[iconBase('cap_${id}')]`), 'institution ' + id + ' has a fallback');
});

test('a rendered icon replaces the pixel one everywhere it is shown, and from then on', () => {
  const g = load();
  g.run(`var shown = [{ src: 'old' }, { src: 'old' }], asked = ''; document.querySelectorAll = sel => { asked = sel; return shown; };
    URLS.camp = 'pixel'; setIcon3d('camp', 'data:image/png;base64,3d');`);
  assert.strictEqual(g.run('asked'), 'img[data-ico="camp"]');
  assert.deepStrictEqual(JSON.parse(g.run('JSON.stringify(shown.map(i => i.src))')), ['data:image/png;base64,3d', 'data:image/png;base64,3d']);
  assert.strictEqual(g.run(`iconURL('camp')`), 'data:image/png;base64,3d', 'later icons use the new picture');
  assert.ok(g.run('ICON3D.camp'));
  assert.ok(!g.run('ICON3D.coin'), 'others untouched');
});

test('icons do not touch the save', () => {
  const g = load();
  const before = g.run('JSON.stringify(S)');
  g.run(`document.querySelectorAll = () => []; for (const j of iconJobs()) setIcon3d(j.name, 'data:x');`);
  assert.strictEqual(g.run('JSON.stringify(S)'), before);
});
