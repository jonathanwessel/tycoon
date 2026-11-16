// node --test — the Capital as a place: every institution has a plot, plots stay on the board without overlapping,
// and a tap (a ray from the camera) picks the building it lands on, roofs included.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { load } = require('../scripts/sim');

const sites = g => g.run('JSON.stringify(CAP_SITE)'), S_ = g => JSON.parse(sites(g));

test('the Capitol and every institution have a plot on the board, and no two plots overlap', () => {
  const g = load(), s = S_(g), ids = Object.keys(s);
  for (const id of g.run('Object.keys(INST)')) assert.ok(s[id], id + ' has a site');
  assert.ok(s.capitol, 'the Capitol has a site');
  for (const id of ids) { const q = s[id]; assert.ok(q.x - q.r >= 0 && q.x + q.r <= g.run('COLS') && q.z - q.r >= 0 && q.z + q.r <= g.run('ROWS') + .6, id + ' on the board'); assert.ok(q.h > 1 && q.n, id + ' has a height and a sign'); }
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = s[ids[i]], b = s[ids[j]];
    assert.ok(Math.abs(a.x - b.x) >= a.r + b.r - 1e-9 || Math.abs(a.z - b.z) >= a.r + b.r - 1e-9, ids[i] + ' and ' + ids[j] + ' overlap');
  }
});

test('the ground under a point names its plot; the avenue between the plots names none', () => {
  const g = load(), s = S_(g);
  for (const id in s) assert.strictEqual(g.call('(x, z) => capSiteAt(x, z)', s[id].x + .3, s[id].z - .3), id);
  assert.strictEqual(g.call('(x, z) => capSiteAt(x, z)', 6, 10), null, 'the fountain plaza');
  assert.strictEqual(g.call('(x, z) => capSiteAt(x, z)', 6, 13.5), null, 'the avenue');
});

test('a tap picks the building it lands on, even on a roof that stands in front of another plot', () => {
  const g = load(), s = S_(g);
  // the camera of the town view: high above the front of the board, looking down at about 53 degrees
  const eye = [6, 19, 28];
  const toward = (x, y, z) => { const d = [x - eye[0], y - eye[1], z - eye[2]], l = Math.hypot(...d); return d.map(v => v / l); };
  for (const id in s) {
    const q = s[id];
    assert.strictEqual(g.call('(o, d) => capRay(o, d)', eye, toward(q.x, q.h * .5, q.z)), id, 'the middle of ' + id);
    assert.strictEqual(g.call('(o, d) => capRay(o, d)', eye, toward(q.x, q.h * .95, q.z - q.r * .5)), id, 'the roof of ' + id);
  }
  // the Stock Exchange's roof lies, on the ground, over the Central Bank's plot behind it: the roof wins
  const ex = s.exchange, roof = toward(ex.x, ex.h * .95, ex.z - ex.r * .7), t = -eye[1] / roof[1];
  assert.strictEqual(g.call('(x, z) => capSiteAt(x, z)', eye[0] + roof[0] * t, eye[2] + roof[2] * t), 'bank', 'the ground behind the roof is the bank');
  assert.strictEqual(g.call('(o, d) => capRay(o, d)', eye, roof), 'exchange');
  // the avenue and the sky pick nothing
  assert.strictEqual(g.call('(o, d) => capRay(o, d)', eye, toward(6, 0, 12.6)), null);
  assert.strictEqual(g.call('(o, d) => capRay(o, d)', eye, [0, .2, -1]), null);
});

test('every institution has a model in the 3D Capital, and the interface knows each site', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'r3d', 'capital3d.js'), 'utf8');
  const g = load();
  for (const id of g.run('Object.keys(INST)')) assert.match(src, new RegExp('\\n  ' + id + '\\(k, add\\) \\{'), id + ' has a model');
  const card = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui', 'card.js'), 'utf8');
  assert.match(card, /function siteCard\(/);
});
