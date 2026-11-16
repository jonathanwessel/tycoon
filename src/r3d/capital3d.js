/* The Capital as a place: a city square on the board's 12 × 14 cells with the Capitol dome at the head of a stone
   avenue and each institution on its plot either side (an empty lot with survey stakes until it is built). Models are
   built in code with the kit, like the towns' buildings; their fronts face +z, towards the camera. The site layout
   (CAP_SITE) lives in src/capital.js so taps and tests use the same numbers. */
import * as THREE from 'three';
import { Kit, col, rng, part } from './kit.js';
import { PROPS, person } from './units.js';
import { makeBuilding } from './buildings.js';

const lerp = (a, b, t) => a + (b - a) * t, sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x, z) { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz); return lerp(lerp(hash(ix, iz), hash(ix + 1, iz), u), lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), u), v); }
const fbm = (x, z) => noise(x, z) * .6 + noise(x * 2.1 + 5, z * 2.1) * .3 + noise(x * 4.3, z * 4.3 + 9) * .1;
const HALF = Math.PI / 2;
export const FOUNTAIN = [6, 10]; // the round plaza on the avenue
export const AVENUE = [4.9, 7.1]; // its kerbs (x)

/* --- the ground: lawns, the avenue and its plaza, a gravel pad under each plot, hills beyond ------------------------ */
export function buildCapitalWorld(SITE, COLS, ROWS) {
  const world = new THREE.Group(); world.name = 'capital';
  const boardD = (x, z) => Math.max(-1 - x, x - COLS - 1, -1 - z, z - ROWS - 1.6, 0); // the city's edge
  const [fx, fz] = FOUNTAIN;
  const onAvenue = (x, z) => Math.hypot(x - fx, z - fz) < 1.75 || (z > 4.6 && z < 5.5 && x > 2.6 && x < 9.4) || (x > AVENUE[0] && x < AVENUE[1] && z > 4.4);
  const onPath = (x, z) => { for (const id in SITE) { const s = SITE[id]; if (id === 'capitol') continue; if (Math.abs(z - (s.z + .9)) < .3 && (s.x < 6 ? x > s.x + s.r - .2 && x < AVENUE[0] + .1 : x < s.x - s.r + .2 && x > AVENUE[1] - .1)) return true; } return false; };
  const onPad = (x, z) => { for (const id in SITE) { const s = SITE[id], r = s.r - .08; if (Math.abs(x - s.x) < r && Math.abs(z - s.z) < r) return id; } return null; };
  const roadD = (x, z) => z > ROWS ? Math.abs(x - (fx + Math.sin((z - ROWS) * .25) * .6 * sstep(ROWS + 1, ROWS + 4, z))) : 9;
  function height(x, z) { const d = boardD(x, z); if (d <= 0) return 0; const h = sstep(1.5, 7, d) * (fbm(x * .17, z * .17) * 2.8 + (z < 0 ? Math.min(3.4, -z * .25) : 0) + d * .05) * (z > ROWS ? .3 : 1); return roadD(x, z) < 1.4 ? h * sstep(.8, 1.4, roadD(x, z)) : h; }
  function colour(x, z, h) {
    const n = fbm(x * .7, z * .7), c = new THREE.Color(), d = boardD(x, z);
    if (d <= .01 && onAvenue(x, z)) { c.copy(col('#cbbca4')).multiplyScalar(.93 + n * .1); if ((Math.floor(x * 2) + Math.floor(z * 2)) % 2) c.multiplyScalar(.96); }
    else if (d <= .01 && onPath(x, z)) c.copy(col('#c7ae84')).multiplyScalar(.95 + n * .08);
    else if (d <= .01 && onPad(x, z)) c.copy(col(onPad(x, z) === 'capitol' ? '#c9bba0' : '#d3b98c')).multiplyScalar(.94 + n * .1);
    else if (d > .01 && roadD(x, z) < .75) c.copy(col('#a07a52')).multiplyScalar(.95 + n * .1);
    else { c.copy(col('#93a24c')).lerp(col('#7f9442'), n).multiplyScalar(.92 + sstep(.3, .7, fbm(x * .4, z * .4 + 20)) * .14); c.lerp(col('#d0aa76'), sstep(.4, 2.5, d) * .75); c.lerp(col(h > 1.6 ? '#c99560' : h > .7 ? '#d8aa70' : '#e6c08a'), sstep(2, 6, d) * .8); }
    return c;
  }
  const pos = [], cols = [];
  const tri = (a, b, c2, k, sh) => { for (const p of [a, b, c2]) { pos.push(p[0], p[1], p[2]); cols.push(k.r * sh, k.g * sh, k.b * sh); } };
  const grid = (x0, z0, x1, z1, st, skip) => {
    const nx = Math.round((x1 - x0) / st), nz = Math.round((z1 - z0) / st), Vt = [];
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = x0 + i * st, z = z0 + j * st, far = boardD(x, z) > 1.5, jx = far ? (hash(x, z) - .5) * st * .5 : 0, jz = far ? (hash(z, x) - .5) * st * .5 : 0; Vt.push([x + jx, height(x + jx, z + jz), z + jz]); }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = x0 + i * st, z = z0 + j * st; if (skip && skip(x, z, st)) continue;
      const a = Vt[j * (nx + 1) + i], b = Vt[j * (nx + 1) + i + 1], c2 = Vt[(j + 1) * (nx + 1) + i], d = Vt[(j + 1) * (nx + 1) + i + 1];
      const k = colour(x + st / 2, z + st / 2, (a[1] + d[1]) / 2), s1 = 1 + (hash(x * 5, z) - .5) * .04, s2 = 1 + (hash(z, x * 5) - .5) * .04;
      if ((i + j) % 2) { tri(a, c2, b, k, s1); tri(b, c2, d, k, s2); } else { tri(a, c2, d, k, s1); tri(a, d, b, k, s2); }
    }
  };
  grid(-3, -3, COLS + 3, ROWS + 6, .25);
  grid(-30, -26, COLS + 30, ROWS + 24, 1, (x, z, st) => x >= -3 && x + st <= COLS + 3 && z >= -3 && z + st <= ROWS + 6);
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); tg.computeVertexNormals();
  const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .9 })); terrain.receiveShadow = true; world.add(terrain);

  const k = new Kit({ aoH: .6 }), R = rng(41), lamps = [], movers = [];
  // kerbs along the avenue, and the fountain on its plaza
  for (const x of AVENUE) for (let z = 5.5; z < ROWS + 1.5; z += 1) if (Math.hypot(x - fx, z + .5 - fz) > 1.9) k.box(x, 0, z + .5, .08, .05, .98, 'stoneD');
  k.cyl(fx, 0, fz, 1.05, .22, 'stone', { seg: 16, jit: .05 }); k.cyl(fx, .2, fz, .95, .03, 'water', { seg: 16, mat: 'metal', ao: false });
  k.cyl(fx, 0, fz, .16, .62, 'stoneL', { seg: 8 }); k.cyl(fx, .6, fz, .42, .09, 'stone', { r2: .2, seg: 12 }); k.cyl(fx, .69, fz, .36, .02, 'water', { seg: 12, mat: 'metal', ao: false });
  k.cyl(fx, .69, fz, .06, .3, 'stoneL', { seg: 6 }); k.ball(fx, 1.02, fz, .07, 'glowI', { mat: 'glow' });
  // lamp posts down the avenue (they light up at night)
  for (const z of [6.6, 8.4, 11.6, 13.4]) for (const x of [AVENUE[0] - .22, AVENUE[1] + .22]) {
    k.box(x, 0, z, .1, .08, .1, 'iron'); k.cyl(x, .08, z, .03, .78, 'iron', { seg: 6, mat: 'metal' }); k.box(x, .86, z, .14, .16, .14, 'glowW', { mat: 'glow' }); k.cone(x, 1.02, z, .12, .1, 'iron', { seg: 4, ry: .785 });
    lamps.push([x, z]);
  }
  // benches facing the fountain
  for (const a of [.6, 2.5, 3.8, 5.6]) { const x = fx + Math.cos(a) * 1.5, z = fz + Math.sin(a) * 1.5; k.box(x, .12, z, .42, .04, .14, 'woodL', { ry: -a + HALF }); for (const s of [-1, 1]) k.box(x + Math.cos(a + HALF) * .16 * s, 0, z + Math.sin(a + HALF) * .16 * s, .04, .12, .12, 'iron', { ry: -a + HALF }); }
  // flagpoles either side of the Capitol's forecourt
  for (const x of [3.3, 8.7]) { k.box(x, 0, 5.05, .22, .12, .22, 'stoneL'); k.cyl(x, .12, 5.05, .025, 1.9, 'steel', { seg: 6, mat: 'metal' }); k.ball(x, 2.04, 5.05, .045, 'gold', { mat: 'metal' });
    const fl = part(k2 => { k2.box(.2, 0, 0, .4, .24, .015, 'paintB'); k2.box(.1, .06, .01, .16, .1, .012, 'white'); }); fl.position.set(x, 1.74, 5.05); world.add(fl); movers.push({ kind: 'flag', node: fl }); }
  // trees on the lawns: down both edges, behind the Capitol, between the plots
  const trees = [];
  for (let z = 5.2; z < ROWS + 2; z += 1.5) for (const x of [.25, COLS - .25]) trees.push([x + (R() - .5) * .3, z + (R() - .5) * .3, .9 + R() * .4]);
  for (let x = .8; x < COLS; x += 1.3) trees.push([x + (R() - .5) * .3, .35 + R() * .3, 1 + R() * .4]);
  for (const z of [8.5, 11.5]) for (const x of [.6, 4.2, 7.8, 11.4]) trees.push([x, z, .7 + R() * .2]);
  for (const [x, z, s] of trees) { const o = PROPS.tree(s, Math.round(x * 10 + z)); o.position.set(x, 0, z); o.scale.setScalar(s); world.add(o); }
  // hedges around the Capitol's lawn
  for (const x of [1.2, 10.8]) k.box(x, 0, 3.0, .3, .32, 3.4, 'leafD', { jit: .15 });
  // mesas on the horizon
  const mesa = (x, z, r, h) => { const layers = 3 + Math.floor(R() * 2); let y = height(x, z) - .4; const pal = ['#c8653f', '#a94f33', '#d98a55', '#e0a46c']; for (let i = 0; i < layers; i++) { const lh = h / layers, rr = r * (1 - i * .09); k.cyl(x, y, z, rr, lh, pal[i % 4], { r2: rr * .93, seg: 7, ry: R() * 3, jit: .1 }); y += lh; } };
  for (const [x, z, r, h] of [[-7, -9, 4, 4], [4, -13, 5, 5.2], [15, -11, 4.5, 4.6], [21, -4, 3, 3.4], [-12, 0, 3, 3], [25, 7, 3.4, 2.8], [-13, 13, 2.6, 2.4], [27, 17, 3, 2.4]]) mesa(x + (R() - .5) * 2, z + (R() - .5) * 2, r, h);
  const deco = k.build(); world.add(deco);
  world.userData = { lamps, movers, height };
  return world;
}

/* --- the Capitol: a white domed statehouse, wings either side of a columned portico -------------------------------- */
function capitol(k, add) {
  k.box(0, 0, -.3, 4.6, .18, 2.7, 'stoneL', { jit: .04 }); k.box(0, .18, -.3, 4.4, .12, 2.5, 'stone');
  for (let i = 0; i < 4; i++) k.box(0, 0, 1.06 + i * .11, 2.2, .3 - i * .075, .11, 'stoneL');
  // the wings
  for (const sx of [-1, 1]) {
    const x = sx * 1.45; k.box(x, .3, -.35, 1.3, 1.0, 1.8, 'white', { jit: .04 }); k.box(x, 1.3, -.35, 1.42, .08, 1.92, 'stoneL'); k.box(x, 1.38, -.35, 1.2, .12, 1.6, 'white');
    for (const wx of [-.36, 0, .36]) { k.win(x + wx, .5, .56, .16, .26, { frame: 'stoneL' }); k.win(x + wx, .95, .56, .16, .22, { frame: 'stoneL' }); }
    k.box(x, .3, .56, 1.3, .05, .04, 'stoneL'); k.box(x, .86, .56, 1.3, .04, .04, 'stoneL');
  }
  // the central block and its portico
  k.box(0, .3, -.4, 1.75, 1.35, 1.9, 'white', { jit: .03 });
  for (let i = 0; i < 6; i++) k.cyl(-.75 + i * .3, .3, .82, .075, 1.08, 'white', { seg: 8 });
  k.box(0, 1.38, .72, 1.95, .14, .42, 'stoneL'); k.gable(0, 1.52, .72, .44, 2.0, .4, 'white', { ry: HALF }); k.box(0, 1.52, .95, .5, .1, .02, 'goldD', { mat: 'metal' });
  k.box(0, .3, .56, .42, .62, .04, 'woodD'); k.box(0, .3, .58, .34, .56, .03, 'paintB'); k.win(-.45, .5, .57, .16, .3, { frame: 'stoneL' }); k.win(.45, .5, .57, .16, .3, { frame: 'stoneL' });
  // the drum, ringed with columns, and the copper dome gone green
  k.box(0, 1.65, -.4, 1.5, .18, 1.5, 'stoneL');
  k.cyl(0, 1.83, -.4, .74, .6, 'white', { seg: 16 });
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; k.cyl(Math.cos(a) * .8, 1.83, -.4 + Math.sin(a) * .8, .045, .6, 'white', { seg: 6 }); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + .2; k.win(Math.cos(a) * .745, 2.05, -.4 + Math.sin(a) * .745, .12, .22, { ry: HALF - a, frame: 'white' }); }
  k.cyl(0, 2.43, -.4, .88, .08, 'stoneL', { seg: 16 });
  k.add(new THREE.SphereGeometry(.76, 16, 7, 0, Math.PI * 2, 0, HALF), 0, 2.5, -.4, 'verd', { mat: 'metal', jit: .06 });
  // the lantern on top
  k.cyl(0, 3.24, -.4, .16, .28, 'white', { seg: 8 }); k.cyl(0, 3.3, -.4, .165, .12, 'glowW', { seg: 8, mat: 'glow' }); k.cone(0, 3.52, -.4, .2, .3, 'gold', { mat: 'metal', seg: 8 }); k.box(0, 3.82, -.4, .025, .5, .025, 'steel', { mat: 'metal' });
  const fl = part(k2 => { k2.box(.22, 0, 0, .44, .26, .015, 'paintR'); k2.box(.22, .1, .01, .44, .06, .012, 'white'); k2.box(.1, .03, .012, .18, .14, .01, 'paintB'); });
  add('flag', fl, new THREE.Vector3(0, 4.05, -.4));
  // urns and lamps at the steps
  for (const sx of [-1.25, 1.25]) { k.box(sx, 0, 1.3, .2, .3, .2, 'stoneL'); k.cyl(sx, .3, 1.3, .08, .16, 'verd', { r2: .1, seg: 8, mat: 'metal' }); }
  return 4.2;
}

/* --- the institutions (on a 2 × 2 local plot, scaled up to their 3 × 3 site) --------------------------------------- */
function flag(k, add, x, y, z, c = 'paintR', h = .55) { k.box(x, y, z, .025, h, .025, 'woodD'); const fl = part(k2 => k2.box(.13, 0, 0, .26, .15, .015, c)); add('flag', fl, new THREE.Vector3(x + .01, y + h - .17, z)); }
function lantern(k, x, z, h = .62) { k.box(x, 0, z, .04, h, .04, 'woodD'); k.box(x + .06, h - .02, z, .14, .03, .03, 'woodD'); k.box(x + .12, h - .16, z, .07, .1, .07, 'glowW', { mat: 'glow' }); k.box(x + .12, h - .07, z, .09, .03, .09, 'iron'); }
function columns(k, n, x0, x1, y, z, h, c = 'white', r = .05) { for (let i = 0; i < n; i++) k.cyl(x0 + (x1 - x0) * i / (n - 1), y, z, r, h, c, { seg: 8 }); }
function crate(k, x, z, s = .18) { k.box(x, 0, z, s, s, s, 'woodL'); k.box(x, s * .45, z, s + .012, s * .12, s + .012, 'woodD', { ao: false }); }
function barrel(k, x, z) { k.cyl(x, 0, z, .085, .22, 'wood', { r2: .075, seg: 8 }); k.cyl(x, .045, z, .089, .022, 'iron', { seg: 8, ao: false }); k.cyl(x, .155, z, .087, .022, 'iron', { seg: 8, ao: false }); }
const INST3D = {
  market(k, add) {
    // the Market Board: an open hall with a great chalk board of prices and an auction bell
    k.box(0, 0, -.05, 1.6, .07, 1.3, 'stoneL');
    k.box(0, .07, -.6, 1.56, .86, .14, 'adobe', { jit: .06 });
    k.box(0, .3, -.52, 1.3, .48, .03, 'black'); k.box(0, .28, -.515, 1.36, .03, .04, 'woodD'); k.box(0, .79, -.515, 1.36, .03, .04, 'woodD');
    for (let i = 0; i < 5; i++) { const y = .36 + i * .085; k.box(-.3, y, -.5, .56, .018, .01, 'white', { ao: false }); k.box(.32, y, -.5, .22, .03, .01, i % 2 ? 'paintR' : 'paintG', { mat: 'glow' }); }
    for (const sx of [-.74, -.25, .25, .74]) k.box(sx, .07, .5, .07, .86, .07, 'woodD');
    k.box(0, .93, .5, 1.6, .06, .08, 'woodD');
    k.gable(0, .93, -.05, 1.7, 1.42, .38, 'roofR', { jit: .05 });
    k.box(0, 1.0, .64, .9, .2, .04, 'cream'); k.box(0, 1.08, .662, .6, .04, .01, 'paintR', { ao: false });
    for (const sx of [-.5, .5]) { k.box(sx, .07, .1, .36, .3, .2, 'woodL'); k.box(sx, .37, .1, .4, .03, .24, 'woodD'); }
    k.box(.62, .07, .7, .04, .5, .04, 'woodD'); k.box(.62, .55, .7, .2, .03, .03, 'woodD'); k.cyl(.7, .4, .7, .06, .12, 'gold', { r2: .03, seg: 8, mat: 'metal' });
    crate(k, -.62, .72); crate(k, -.45, .78, .14); barrel(k, -.78, .5); barrel(k, .78, .3);
    return 1.4;
  },
  transport(k, add) {
    // the Department of Transport: a station with a clock tower, a platform and a locomotive on the line
    k.box(0, 0, .05, 1.76, .12, .7, 'stoneL');
    k.box(-.2, .12, -.42, 1.16, .66, .6, 'paintY', { jit: .06 }); k.hip(-.2, .78, -.42, 1.34, .8, .3, 'roofG');
    for (const x of [-.55, -.2, .15]) k.win(x, .36, -.115, .17, .24);
    k.box(-.2, .12, -.115, .22, .4, .03, 'woodD');
    for (const x of [-.75, -.2, .35]) k.box(x, .12, .32, .05, .56, .05, 'iron', { mat: 'metal' }); k.box(-.2, .68, .12, 1.3, .04, .48, 'roofG', { rx: -.12 });
    k.box(.58, .12, -.42, .36, 1.4, .36, 'brick', { jit: .08 }); k.box(.58, 1.52, -.42, .42, .06, .42, 'stoneL');
    k.cyl(.58, 1.16, -.235, .13, .02, 'cream', { rx: HALF, seg: 12 }); k.box(.58, 1.16, -.22, .015, .1, .01, 'black', { ao: false }); k.box(.6, 1.18, -.22, .06, .012, .01, 'black', { ao: false });
    k.cone(.58, 1.58, -.42, .3, .45, 'roofG', { seg: 4, ry: .785 }); k.box(.58, 2.03, -.42, .02, .18, .02, 'gold');
    for (const z of [.62, .78]) k.box(0, 0, z, 1.9, .025, .025, 'steel', { mat: 'metal' });
    for (let x = -.9; x <= .9; x += .12) k.box(x, 0, .7, .04, .015, .26, 'woodD');
    k.box(-.75, .12, -.05, .18, .1, .1, 'woodL'); crate(k, .2, -.02, .14);
    return 2.05;
  },
  bank(k, add) {
    // the Central Bank: a stone bank with columns, a round vault door and gold stacked inside the railings
    k.box(0, 0, -.12, 1.5, .1, 1.3, 'stoneL'); for (let i = 0; i < 3; i++) k.box(0, 0, .55 + i * .08, 1.0, .1 - i * .03, .08, 'stoneL');
    k.box(0, .1, -.2, 1.36, .92, 1.0, 'stoneL', { jit: .04 });
    columns(k, 4, -.5, .5, .1, .4, .82, 'white', .055);
    k.box(0, .92, .36, 1.4, .12, .2, 'white'); k.gable(0, 1.04, .36, .22, 1.42, .28, 'white', { ry: HALF }); k.box(0, 1.04, -.2, 1.44, .08, 1.06, 'stoneD');
    for (let i = 0; i < 9; i++) k.box(-.64 + i * .16, 1.12, -.72, .04, .1, .04, 'stoneL');
    k.box(0, .98, .47, .5, .05, .01, 'gold', { mat: 'metal', ao: false });
    k.cyl(0, .2, .31, .24, .05, 'iron', { rx: HALF, seg: 14, mat: 'metal' }); k.cyl(0, .2, .34, .16, .02, 'steel', { rx: HALF, seg: 14, mat: 'metal' });
    for (let i = 0; i < 4; i++) k.box(0, .43, .36, .3, .025, .02, 'gold', { rz: i * .785, mat: 'metal' });
    for (const sx of [-.36, .36]) k.win(sx, .55, .31, .14, .24, { frame: 'stoneD' });
    for (let r = 0; r < 3; r++) for (let i = 0; i < 3 - r; i++) k.box(-.7 + (i - (2 - r) / 2) * .1, .1 + r * .05, .6, .08, .05, .14, 'gold', { mat: 'metal' });
    for (let x = .45; x <= .75; x += .1) k.box(x, .1, .62, .025, .22, .025, 'iron');
    return 1.4;
  },
  education(k, add) {
    // the Department of Education: a red-brick schoolhouse with a bell tower, a flag and a little picket fence
    k.box(0, 0, -.15, 1.24, .78, 1.0, 'brick', { jit: .08 }); k.gable(0, .78, -.15, 1.12, 1.36, .48, 'roofS', { ry: HALF, jit: .05 });
    k.box(0, .78, .36, 1.26, .04, .04, 'white');
    for (const sx of [-.38, .38]) { k.win(sx, .28, .36, .16, .32, { frame: 'white' }); k.box(sx, .26, .37, .2, .03, .03, 'white'); }
    k.box(0, 0, .36, .3, .52, .03, 'white'); k.box(0, 0, .375, .24, .46, .03, 'paintB'); k.win(0, 1.0, .36, .16, .16, { frame: 'white', c: 'glowW' });
    k.box(0, 1.14, -.1, .32, .36, .32, 'white'); k.box(0, 1.14, .065, .2, .26, .01, 'black', { ao: false }); k.cyl(0, 1.2, -.1, .07, .1, 'gold', { r2: .04, seg: 8, mat: 'metal' });
    k.cone(0, 1.5, -.1, .27, .42, 'roofS', { seg: 4, ry: .785 }); k.box(0, 1.92, -.1, .02, .16, .02, 'gold');
    for (let x = -.82; x <= .82; x += .1) if (Math.abs(x) > .2) k.box(x, 0, .78, .03, .16, .02, 'white');
    k.box(-.5, .11, .78, .62, .025, .02, 'white'); k.box(.5, .11, .78, .62, .025, .02, 'white');
    flag(k, add, .72, 0, .2, 'paintB', .9);
    return 1.95;
  },
  exchange(k, add) {
    // the Stock Exchange: a grand hall with six columns, a glowing ticker and a golden bull
    k.box(0, 0, -.15, 1.6, .1, 1.32, 'stoneL'); for (let i = 0; i < 3; i++) k.box(0, 0, .52 + i * .08, 1.4, .1 - i * .03, .08, 'stoneL');
    k.box(0, .1, -.3, 1.44, 1.0, .86, 'white', { jit: .04 });
    columns(k, 6, -.62, .62, .1, .38, .86, 'white', .05);
    k.box(0, .96, .3, 1.5, .1, .24, 'stoneL'); k.gable(0, 1.06, .3, .26, 1.52, .32, 'white', { ry: HALF }); k.box(0, 1.1, -.3, 1.48, .06, .9, 'stoneD');
    k.box(0, .82, .135, 1.3, .08, .02, 'black'); for (let i = 0; i < 9; i++) k.box(-.56 + i * .14, .835, .15, .09, .045, .01, i % 3 ? 'glowT' : 'paintR', { mat: 'glow' });
    for (const sx of [-.42, 0, .42]) k.win(sx, .3, .135, .18, .36, { frame: 'stoneD' });
    // the bull
    k.box(-.62, 0, .78, .16, .1, .16, 'stoneD');
    k.box(-.62, .2, .78, .26, .14, .12, 'gold', { mat: 'metal' }); for (const [dx, dz] of [[-.1, -.04], [-.1, .04], [.1, -.04], [.1, .04]]) k.box(-.62 + dx, .1, .78 + dz, .03, .1, .03, 'goldD', { mat: 'metal' });
    k.box(-.47, .25, .78, .1, .1, .1, 'gold', { mat: 'metal' }); for (const s of [-1, 1]) k.box(-.44, .33, .78 + s * .07, .02, .07, .02, 'cream', { rx: s * .5 });
    return 1.38;
  },
  war(k, add) {
    // the War Office: a stockade with a two-storey blockhouse, watchtowers, a cannon at the gate and a tall flag
    const post = (x, z, h = .5) => k.cyl(x, 0, z, .045, h + (hash(x * 3, z * 7) - .5) * .06, 'log', { seg: 6 });
    for (let x = -.84; x <= .84; x += .09) { post(x, -.84); if (Math.abs(x) > .22) post(x, .84); }
    for (let z = -.75; z <= .78; z += .09) { post(-.84, z); post(.84, z); }
    for (const sx of [-.84, .84]) { k.box(sx, 0, -.84, .26, .9, .26, 'woodD'); k.box(sx, .9, -.84, .34, .05, .34, 'wood'); k.hip(sx, .95, -.84, .36, .36, .22, 'roofS'); }
    k.box(0, 0, -.2, .78, .52, .66, 'wood', { jit: .08 }); k.box(0, .52, -.2, .94, .38, .82, 'woodD', { jit: .06 }); k.hip(0, .9, -.2, 1.06, .94, .3, 'roofS');
    for (const sx of [-.25, .25]) k.box(sx, .65, .215, .12, .06, .02, 'black', { ao: false }); k.win(0, .7, .215, .14, .12);
    k.box(0, 0, .14, .22, .36, .03, 'woodL');
    k.cyl(.3, .14, .4, .055, .5, 'iron', { rx: HALF - .25, seg: 10, mat: 'metal' }); for (const s of [-1, 1]) k.cyl(.3 + s * .1, .1, .48, .1, .03, 'woodD', { rz: HALF, seg: 10 });
    for (const [x, z] of [[-.5, .5], [-.38, .56], [-.44, .62]]) k.ball(x, .05, z, .05, 'black');
    flag(k, add, -.5, 0, -.4, 'paintR', 1.3);
    return 1.75;
  },
};
/* Ornaments that come with levels: lanterns at 5, a gold trim at 10, a gold banner at the top level. */
function ornaments(k, add, tier, top) {
  if (tier >= 2) { lantern(k, -.88, .86); lantern(k, .76, .86); }
  if (tier >= 3) { k.box(0, 0, .93, 1.7, .05, .05, 'goldD'); for (let i = 0; i < 6; i++) k.box(-.75 + i * .3, .05, .93, .06, .08, .06, 'gold', { mat: 'metal' }); }
  if (tier >= 4) flag(k, add, .86, top - .3, -.75, 'gold', .5);
}
export const capTier = (lv, max) => !lv ? 0 : lv >= max ? 4 : lv >= 10 ? 3 : lv >= 5 ? 2 : 1;
/* A site's model: { obj, movers }. id 'capitol' or an institution; tier 0 is the empty lot. */
export function makeSite(id, tier) {
  if (id !== 'capitol' && !tier) { const b = makeBuilding('_lot', 0); return { obj: b.obj, movers: b.movers }; }
  const k = new Kit({ aoH: id === 'capitol' ? 1.2 : .8 }), movers = [], obj = new THREE.Group();
  const add = (kind, node, pos) => { node.position.copy(pos); obj.add(node); movers.push({ kind, node }); };
  if (id === 'capitol') capitol(k, add); else { const top = INST3D[id](k, add); ornaments(k, add, tier, top); }
  obj.add(k.build());
  obj.traverse(o => { if (o.isMesh) { o.castShadow = o.material.type !== 'MeshBasicMaterial'; o.receiveShadow = true; } });
  return { obj, movers };
}
export const SITE_IDS = ['capitol', ...Object.keys(INST3D)];

/* Townsfolk strolling up and down the avenue, round the fountain. */
const LOOKS = [['paintB', 'denim', 'cowboy', 'woodL'], ['white', 'black', 'bowler', 'black'], ['paintR', 'cloth', 'cowboy', 'woodD'], ['cream', 'denim', 'cap', 'paintG'], ['paintP', 'black', 'bowler', 'iron'], ['paintG', 'cloth', 'cowboy', 'cream']];
export function makeCitizens(n) {
  const out = [], R = rng(7);
  for (let i = 0; i < n; i++) { const [shirt, pants, hat, hatC] = LOOKS[i % LOOKS.length], o = person({ shirt, pants, hat, hatC, vest: i % 3 === 1 ? 'paintR' : undefined }); o.scale.setScalar(.62); o.traverse(m => { if (m.isMesh) m.castShadow = true; });
    out.push({ obj: o, z: 6 + R() * 9, dir: R() < .5 ? 1 : -1, lane: (R() - .5) * 1.2, speed: .28 + R() * .22, ph: R() * 6 }); }
  return out;
}
/* Where a citizen on the avenue stands: lanes bend round the fountain. */
export function citizenAt(c) { const [fx, fz] = FOUNTAIN, dz = c.z - fz, bend = Math.abs(dz) < 1.9 ? Math.sqrt(Math.max(0, 1.9 * 1.9 - dz * dz)) : 0, side = c.lane < 0 ? -1 : 1; return [fx + side * Math.max(Math.abs(c.lane) * .8 + .15, bend), c.z]; }
