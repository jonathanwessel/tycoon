/* Buildings of every town, modelled in code. Each sits on its 2×2 yard plot (local x and z from -0.9 to 0.9, the front
   faces +z, towards the camera). A model is static parts merged by material, plus named moving parts:
   spin (turns while the building works), hot (furnace glow, shown while it works) and smoke sockets. */
import * as THREE from 'three';
import { Kit, part, rng } from './kit.js';

// --- shared pieces ---------------------------------------------------------------------------------------------------
function shed(k, x, z, w, d, h, wall, roof, o = {}) {
  const y = o.y || 0;
  k.box(x, y, z, w, h, d, wall, { jit: .08 });
  // corner posts and a sill: the trims that make a box read as a building
  const tc = o.trim || 'woodD';
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(x + sx * (w / 2 - .02), y, z + sz * (d / 2 - .02), .07, h, .07, tc);
  k.box(x, y + h - .04, z + d / 2, w + .04, .06, .04, tc);
  const rh = o.rh === undefined ? .34 : o.rh;
  if (o.flat) { k.box(x, y + h, z, w + .08, .06, d + .08, roof); }
  else if (o.hip) k.hip(x, y + h, z, w + .14, d + .14, rh, roof);
  else k.gable(x, y + h, z, w + .14, d + .16, rh, roof, { jit: .05 });
  return y + h + (o.flat ? .06 : rh);
}
// a Western false front: a tall flat board facing +z, with a stepped top and a sign board
function falseFront(k, x, z, w, h, c, sign) {
  k.box(x, 0, z, w, h, .07, c, { jit: .06 });
  k.box(x, h, z, w * .55, .14, .07, c);
  k.box(x, h - .04, z + .02, w + .06, .05, .09, 'woodD');
  k.box(x, h * .62, z + .045, w * .78, h * .2, .03, sign || 'cream');
  return h + .14;
}
function door(k, x, z, o = {}) { const w = o.w || .26, h = o.h || .42; k.box(x, 0, z, w + .06, h + .04, .03, 'woodD'); k.box(x, 0, z + .012, w, h, .03, o.c || 'bark'); k.box(x - w * .3, 0, z + .035, .12, .05, .14, 'stoneD'); }
function windows(k, xs, y, z, w = .16, h = .18, o) { for (const x of xs) k.win(x, y, z, w, h, o); }
function chimney(k, x, y, z, h, c = 'brick', r = .09) { k.box(x, y, z, r * 2, h, r * 2, c, { jit: .1 }); k.box(x, y + h - .05, z, r * 2 + .05, .07, r * 2 + .05, 'stoneD'); return new THREE.Vector3(x, y + h + .04, z); }
function stack(k, x, y, z, h, r = .07, c = 'iron') { k.cyl(x, y, z, r, h, c, { r2: r * .85, seg: 8 }); k.cyl(x, y + h - .06, z, r * 1.25, .06, 'black', { seg: 8 }); return new THREE.Vector3(x, y + h + .04, z); }
export function barrel(k, x, z, y = 0, c = 'wood') { k.cyl(x, y, z, .085, .22, c, { r2: .075, seg: 8 }); k.cyl(x, y + .045, z, .089, .022, 'iron', { seg: 8, ao: false }); k.cyl(x, y + .155, z, .087, .022, 'iron', { seg: 8, ao: false }); }
export function crate(k, x, z, s = .2, y = 0, ry = 0) { k.box(x, y, z, s, s, s, 'woodL', { ry }); k.box(x, y + s * .45, z, s + .012, s * .12, s + .012, 'woodD', { ry, ao: false }); }
function sacks(k, x, z) { for (const [dx, dz, y] of [[0, 0, 0], [.13, .02, 0], [.065, .01, .1]]) k.ball(x + dx, y + .06, z + dz, .075, 'cream', { sy: .75 }); }
function logpile(k, x, z, n = 3, len = .6, ry = 0) { const c = Math.cos(ry), s = Math.sin(ry); for (let row = 0; row < n; row++) for (let i = 0; i < n - row; i++) { const off = (i - (n - row - 1) / 2) * .13; k.log(x - s * off, row * .11, z + c * off, len, .065, i % 2 ? 'log' : 'woodL', { ry: ry + Math.PI / 2 * 0, seg: 6 }); } }
function planks(k, x, z, n = 4) { for (let i = 0; i < n; i++) k.box(x, i * .045, z, .5, .04, .2, i % 2 ? 'plank' : 'woodL'); }
function ingots(k, x, z, c = 'steel') { for (let row = 0; row < 3; row++) for (let i = 0; i < 3 - row; i++) k.box(x + (i - (2 - row) / 2) * .1, row * .05, z, .08, .05, .16, c, { mat: 'metal' }); }
function rocks(k, x, z, c1, c2, n, r, seed) { const R = rng(seed); for (let i = 0; i < n; i++) { const a = R() * 6.28, d = R() * r; k.dode(x + Math.cos(a) * d, .05 + R() * .1, z + Math.sin(a) * d * .7, .14 + R() * .18, R() < .5 ? c1 : c2, { ry: R() * 3, sy: .7 + R() * .4 }); } }
function lantern(k, x, z, h = .62) { k.box(x, 0, z, .04, h, .04, 'woodD'); k.box(x + .06, h - .02, z, .14, .03, .03, 'woodD'); k.box(x + .12, h - .16, z, .07, .1, .07, 'glowW', { mat: 'glow' }); k.box(x + .12, h - .07, z, .09, .03, .09, 'iron'); }
function flag(k, x, y, z, c = 'paintR') { k.box(x, y, z, .025, .5, .025, 'woodD'); k.box(x + .13, y + .34, z, .24, .14, .015, c); }
function rails(k, x, z, len, ry = 0) { const c = Math.cos(ry), s = Math.sin(ry); for (const o of [-.07, .07]) k.box(x + c * o, 0, z - s * o, .025, .025, len, 'steel', { ry, mat: 'metal' }); for (let i = -len / 2 + .05; i < len / 2; i += .12) k.box(x + s * i, 0, z + c * i, .22, .015, .04, 'woodD', { ry }); }
function cart(k, y = 0, load = 'rock', x = 0, z = 0) { k.box(x, y + .05, z, .2, .12, .26, 'iron', { mat: 'metal' }); for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(x + sx * .1, y + .04, z + sz * .08, .04, .02, 'black', { rz: Math.PI / 2, seg: 8 }); k.dode(x, y + .17, z, .09, load, { sy: .6 }); }
const lights = (k, xs, z) => { for (const x of xs) lantern(k, x, z); };

// --- the recipes: (kit, add) => top height. add(name, group, x, y, z) registers a moving part --------------------
const R = {
  camp(k, add) {
    // a log cabin with a stone chimney, a log pile and a chopping block
    for (let i = 0; i < 6; i++) { k.log(-.15, i * .085, .26, 1.08, .045, i % 2 ? 'log' : 'woodL'); k.log(-.15, i * .085, -.36, 1.08, .045, i % 2 ? 'woodL' : 'log'); }
    k.box(-.15, 0, -.05, 1.02, .5, .6, 'wood');
    k.gable(-.15, .5, -.05, 1.28, .92, .36, 'woodD', { jit: .08 });
    door(k, -.15, .3, { h: .38 }); windows(k, [-.46, .17], .2, .3, .14, .14);
    const sm = chimney(k, .3, 0, -.25, 1.02, 'stone', .09);
    logpile(k, .58, .45, 3, .55);
    k.cyl(-.62, 0, .55, .1, .14, 'woodL', { seg: 8 }); k.box(-.62, .14, .55, .03, .2, .03, 'woodD', { rz: .4 }); k.box(-.57, .3, .55, .1, .06, .02, 'steel', { mat: 'metal' });
    add('smoke', null, sm);
    return .86;
  },
  mine(k, add, c = { r1: 'rock', r2: 'rockD', ore: 'stoneD' }) {
    rocks(k, 0, -.38, c.r1, c.r2, 9, .65, 3); k.dode(0, .3, -.45, .5, c.r1, { sy: .8, ry: .4 }); k.dode(-.45, .15, -.3, .34, c.r2, { ry: 1 });
    // timbered tunnel mouth
    k.box(0, 0, -.02, .42, .42, .2, 'black'); for (const sx of [-1, 1]) k.box(sx * .22, 0, .08, .07, .48, .07, 'wood'); k.box(0, .46, .08, .55, .08, .09, 'wood');
    rails(k, 0, .45, .8);
    const ct = part(k2 => cart(k2, 0, c.ore)); add('cart', ct, new THREE.Vector3(0, .02, .45));
    k.cone(.55, 0, .45, .2, .2, c.ore, { seg: 6 }); k.box(-.55, 0, .45, .04, .5, .04, 'woodD'); k.box(-.55, .42, .45, .2, .14, .03, 'cream');
    return .85;
  },
  drill(k, add) {
    // a crystal derrick: four leaning legs, braces, a spinning bit and glowing crystals
    k.box(0, 0, 0, 1.1, .08, 1.1, 'woodD');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(sx * .3, .05, sz * .3, .06, 1.42, .06, 'wood', { rz: -sx * .2, rx: sz * .2 });
    for (const y of [.35, .75, 1.1]) { const s = .6 - y * .38; k.box(0, y, s / 1.1 * .55, s * 1.1, .04, .04, 'woodD'); k.box(0, y, -s / 1.1 * .55, s * 1.1, .04, .04, 'woodD'); k.box(s / 1.1 * .55, y, 0, .04, .04, s * 1.1, 'woodD'); k.box(-s / 1.1 * .55, y, 0, .04, .04, s * 1.1, 'woodD'); }
    k.box(0, 1.42, 0, .22, .1, .22, 'iron', { mat: 'metal' });
    const bit = part(k2 => { k2.cyl(0, .12, 0, .035, 1.2, 'steel', { mat: 'metal' }); k2.cone(0, .12, 0, .1, .2, 'steel', { mat: 'metal', rx: Math.PI }); for (let i = 0; i < 4; i++) k2.box(0, .3 + i * .22, 0, .2, .03, .05, 'iron', { ry: i * .8 }); });
    add('spin', bit, new THREE.Vector3(0, -.05, 0), 'y', 6);
    const R2 = rng(8); for (let i = 0; i < 7; i++) { const a = R2() * 6.28, d = .4 + R2() * .2; const h = .14 + R2() * .2; k.cone(Math.cos(a) * d, 0, Math.sin(a) * d * .9 + .05, .05, h, 'glowT', { mat: 'glow', seg: 4, rz: (R2() - .5) * .6 }); }
    k.box(.62, 0, -.5, .3, .26, .3, 'woodL'); k.gable(.62, .26, -.5, .36, .38, .12, 'roofS');
    return 1.5;
  },
  pit(k, add) {
    k.cyl(-.15, 0, -.1, .52, .05, 'stoneD', { seg: 10 }); k.cyl(-.15, 0, -.1, .42, .055, 'black', { seg: 10 });
    // the headframe: two A-legs and the winding wheel on top
    for (const sx of [-1, 1]) { k.box(-.15 + sx * .3, 0, -.1, .07, 1.25, .07, 'wood', { rz: sx * .22 }); k.box(-.15 + sx * .24, 0, .18, .05, 1.1, .05, 'woodD', { rx: -.35, rz: sx * .2 }); }
    k.box(-.15, 1.12, -.1, .4, .06, .1, 'woodD');
    const wh = part(k2 => { k2.torus(0, 0, 0, .2, .025, 'iron', { mat: 'metal', ts: 12 }); for (let i = 0; i < 4; i++) k2.box(0, -.2, 0, .03, .4, .02, 'iron', { rz: i * .785, mat: 'metal' }); });
    add('spin', wh, new THREE.Vector3(-.15, 1.22, -.03), 'z', 3);
    k.cone(.55, 0, .42, .28, .3, 'coal', { seg: 7 }); k.cone(.38, 0, .62, .16, .17, 'coal', { seg: 6 }); k.box(.6, 0, -.45, .32, .34, .32, 'tinD'); k.gable(.6, .34, -.45, .38, .38, .12, 'roofS');
    return 1.4;
  },
  saw(k, add) {
    // an open sawmill shed with a spinning circular saw over the log carriage
    k.box(0, 0, 0, 1.6, .06, 1.1, 'woodD');
    for (const sx of [-.72, 0, .72]) for (const sz of [-.45, .45]) k.box(sx, .06, sz, .07, .62, .07, 'wood');
    k.gable(0, .68, 0, 1.7, 1.24, .32, 'roofR', { jit: .06 }); k.box(-.3, .06, -.45, 1, .5, .05, 'woodL');
    k.box(0, .06, .05, 1.2, .22, .2, 'woodD'); k.log(-.2, .28, .05, .7, .07, 'log');
    const bl = part(k2 => k2.gear(0, 0, 0, .19, .02, 'steel', { teeth: 14, mat: 'metal' }));
    add('spin', bl, new THREE.Vector3(.25, .4, .05), 'z', -14);
    planks(k, .45, .62, 4); logpile(k, -.55, .66, 2, .5); barrel(k, .76, -.3);
    return 1;
  },
  smelt(k, add) {
    const top = shed(k, -.1, -.1, 1.1, .8, .62, 'stone', 'roofS', { trim: 'stoneD' });
    // an arched furnace mouth that glows while it works
    k.box(-.3, 0, .3, .36, .34, .05, 'brickD'); k.box(-.3, .02, .31, .26, .24, .05, 'black');
    const hot = part(k2 => k2.box(0, 0, 0, .24, .22, .03, 'glowO', { mat: 'fire' })); add('hot', hot, new THREE.Vector3(-.3, .03, .335));
    windows(k, [.2], .3, .31, .18, .16, { c: 'glowO' });
    const sm = chimney(k, .4, 0, -.35, 1.42, 'brick', .12);
    ingots(k, .55, .55); cart(k, 0, 'rockR', -.62, .62);
    add('smoke', null, sm);
    return top;
  },
  glass(k, add) {
    shed(k, -.32, -.15, .8, .8, .55, 'adobe', 'roofR');
    door(k, -.32, .25); windows(k, [-.6, -.05], .26, .26, .12, .14);
    // a cone-shaped glass kiln with a glowing mouth
    k.cyl(.45, 0, .1, .32, .25, 'brick', { r2: .3, seg: 10 }); k.cone(.45, .25, .1, .3, .72, 'brick', { seg: 10, jit: .1 }); k.cyl(.45, .95, .1, .07, .12, 'brickD', { seg: 8 });
    const hot = part(k2 => { k2.box(0, 0, 0, .16, .16, .03, 'glowO', { mat: 'fire' }); k2.cyl(0, .9, -.0, .05, .03, 'glowO', { mat: 'fire', seg: 8 }); }); add('hot', hot, new THREE.Vector3(.45, .04, .42));
    for (let i = 0; i < 3; i++) k.cyl(-.55 + i * .2, 0, .58, .06, .02, 'glowT', { mat: 'glow', rx: Math.PI / 2, seg: 10 }).box(-.55 + i * .2, 0, .58, .02, .06, .02, 'woodD');
    add('smoke', null, new THREE.Vector3(.45, 1.1, .1));
    return 1.07;
  },
  mach(k, add) {
    // a brick workshop with a saw-tooth roof of skylights and a big gear on its front
    k.box(0, 0, -.05, 1.5, .62, .95, 'brick', { jit: .08 });
    for (let i = 0; i < 3; i++) { const x = -.5 + i * .5; k.box(x, .62, -.05, .5, .24, .95, 'brickD', { sx: 1 }); k.box(x - .1, .62, -.05, .3, .26, .97, 'roofS', { rz: .5 }); k.box(x + .12, .62, -.05, .04, .28, .9, 'glowW', { mat: 'glow' }); }
    door(k, -.35, .43, { w: .34, h: .46 }); windows(k, [.15, .5], .3, .43, .18, .2);
    const g = part(k2 => { k2.gear(0, 0, 0, .25, .06, 'gold', { teeth: 10, mat: 'metal' }); k2.cyl(0, 0, .03, .07, .04, 'iron', { rx: Math.PI / 2, seg: 8 }); });
    add('spin', g, new THREE.Vector3(.38, .55, .48), 'z', 1.5);
    const sm = stack(k, .6, .6, -.4, .6); add('smoke', null, sm);
    crate(k, -.7, .6); crate(k, -.5, .66, .16);
    return .9;
  },
  eng(k, add) {
    k.box(-.15, 0, -.1, 1.3, .78, .9, 'brickD', { jit: .08 }); k.gable(-.15, .78, -.1, 1.42, 1.04, .3, 'roofS');
    for (let i = 0; i < 3; i++) k.win(-.6 + i * .3, .4, .36, .16, .24, { frame: 'stoneD' });
    const s1 = stack(k, -.55, .78, -.35, .75, .09, 'brick'), s2 = stack(k, .25, .78, -.35, .62, .08, 'brick');
    // the flywheel of a steam engine turns outside
    k.box(.65, 0, .3, .25, .3, .5, 'iron', { mat: 'metal' });
    const fw = part(k2 => { k2.torus(0, 0, 0, .27, .045, 'black', { ts: 14 }); for (let i = 0; i < 3; i++) k2.box(0, -.26, 0, .04, .52, .03, 'iron', { rz: i * 1.05 }); k2.cyl(0, 0, -.04, .06, .08, 'gold', { rx: Math.PI / 2, mat: 'metal', seg: 8 }); });
    fw.rotation.y = Math.PI / 2; const holder = new THREE.Group(); holder.add(fw); add('spin', holder, new THREE.Vector3(.65, .48, .32), 'x', 3);
    add('smoke', null, s1); add('smoke', null, s2);
    return 1.5;
  },
  mill(k, add) {
    // a tall tin steel mill with three stacks and a glowing pour
    k.box(-.1, 0, -.15, 1.4, .95, .8, 'tin', { jit: .1 }); k.gable(-.1, .95, -.15, 1.5, .92, .22, 'tinD');
    for (let i = 0; i < 6; i++) k.box(-.75 + i * .26, 0, .26, .03, .95, .02, 'tinD');
    const ss = [-.55, -.15, .25].map((x, i) => stack(k, x, .95, -.35, .6 + i * .12, .075, 'brick'));
    k.box(.1, 0, .3, .5, .4, .06, 'black');
    const hot = part(k2 => { k2.box(0, 0, 0, .44, .34, .02, 'glowO', { mat: 'fire' }); k2.box(.1, -.03, .2, .08, .03, .4, 'glowO', { mat: 'fire' }); }); add('hot', hot, new THREE.Vector3(.1, .02, .33));
    ingots(k, -.55, .58, 'ironL');
    ss.forEach(s => add('smoke', null, s));
    return 1.8;
  },
  clockw(k, add) {
    const top = shed(k, -.25, 0, .95, .8, .55, 'cream', 'roofB', { trim: 'goldD' });
    door(k, -.25, .41); windows(k, [-.58, .08], .26, .41, .14, .18);
    // the clock tower: a square tower, a clock face with turning hands, a pointed roof
    k.box(.5, 0, -.05, .42, 1.25, .42, 'cream', { jit: .05 }); k.box(.5, 1.25, -.05, .48, .06, .48, 'goldD'); k.hip(.5, 1.31, -.05, .5, .5, .42, 'roofB', { top: .02 });
    k.cyl(.5, .92, .17, .15, .03, 'white', { rx: Math.PI / 2, seg: 12 }); k.torus(.5, .92, .185, .15, .018, 'gold', { ts: 14, mat: 'metal' });
    const hands = part(k2 => { k2.box(0, 0, 0, .02, .12, .01, 'ink'); k2.box(0, 0, .005, .015, .08, .01, 'ink', { rz: 1.8 }); }, { cast: false });
    add('spin', hands, new THREE.Vector3(.5, .92, .2), 'z', -.8);
    k.box(.5, .92, .2, .03, .03, .01, 'glowW', { mat: 'glow' });
    return Math.max(top, 1.73);
  },
  autow(k, add) {
    // a grand works under a copper dome, with an automaton standing on the roof
    k.box(0, 0, -.1, 1.6, .7, .95, 'stoneL', { jit: .06 }); k.box(0, .7, -.1, 1.66, .07, 1.01, 'goldD');
    for (let i = 0; i < 4; i++) k.win(-.6 + i * .4, .34, .385, .18, .26, { frame: 'goldD' });
    k.ball(-.35, .77, -.15, .36, 'verd', { det: 1, sy: .8 }); k.cyl(-.35, 1.03, -.15, .04, .18, 'gold', { mat: 'metal' });
    const bot = part(k2 => { k2.box(0, 0, 0, .1, .2, .08, 'steel', { mat: 'metal' }); k2.box(.07, 0, 0, .05, .2, .06, 'iron'); k2.box(0, .2, 0, .24, .26, .16, 'steel', { mat: 'metal' }); k2.box(0, .46, 0, .14, .13, .13, 'steel', { mat: 'metal' }); for (const s of [-1, 1]) k2.box(s * .16, .22, 0, .07, .24, .07, 'ironL'); k2.box(0, .5, .066, .1, .03, .01, 'glowT', { mat: 'fire' }); k2.box(0, .32, .085, .06, .06, .01, 'glowO', { mat: 'glow' }); });
    add('bob', bot, new THREE.Vector3(.38, .77, -.12));
    const g = part(k2 => k2.gear(0, 0, 0, .2, .05, 'gold', { teeth: 9, mat: 'metal' })); add('spin', g, new THREE.Vector3(-.45, .38, .4), 'z', 1.2);
    const sm = stack(k, .7, .77, -.45, .55); add('smoke', null, sm);
    return 1.3;
  },
  market(k) {
    // a general store: false front, striped awning, crates and barrels of goods
    k.box(0, 0, -.2, 1.3, .62, .8, 'wood', { jit: .08 }); k.gable(0, .62, -.2, 1.4, .92, .28, 'roofRD');
    const top = falseFront(k, 0, .22, 1.34, .92, 'paintB', 'cream');
    k.cyl(0, .66, .27, .1, .02, 'gold', { rx: Math.PI / 2, seg: 10, mat: 'metal' });
    for (let i = 0; i < 7; i++) k.box(-.54 + i * .18, .42, .38, .18, .03, .34, i % 2 ? 'white' : 'paintR', { rx: .32 });
    for (const sx of [-.6, .6]) k.box(sx, 0, .53, .04, .48, .04, 'woodD');
    door(k, 0, .26, { w: .28 }); windows(k, [-.4, .4], .16, .26, .22, .2);
    crate(k, -.5, .72); crate(k, -.32, .78, .15); barrel(k, .5, .74); barrel(k, .66, .66); sacks(k, .28, .8);
    return top;
  },
  hall(k, add) {
    // the foremen's hall: a two-storey saloon with a balcony and a flag
    k.box(0, 0, -.12, 1.3, 1.1, .85, 'paintG', { jit: .07 }); k.box(0, 1.1, -.12, 1.36, .06, .9, 'woodD');
    falseFront(k, 0, .3, 1.32, 1.28, 'paintG', 'cream');
    k.box(0, .52, .45, 1.34, .05, .32, 'woodL'); for (let i = 0; i < 9; i++) k.box(-.62 + i * .155, .57, .6, .025, .16, .025, 'woodD'); k.box(0, .71, .6, 1.3, .03, .03, 'woodD');
    for (const sx of [-.62, .62]) k.box(sx, 0, .6, .05, .52, .05, 'woodD');
    door(k, 0, .34, { w: .3, h: .4, c: 'woodL' }); windows(k, [-.42, .42], .16, .34, .2, .2); windows(k, [-.4, 0, .4], .66, .34, .16, .22);
    const fl = part(k2 => k2.box(.13, 0, 0, .26, .15, .015, 'paintR')); k.box(.55, 1.42, .3, .025, .55, .025, 'woodD'); add('flag', fl, new THREE.Vector3(.56, 1.78, .3));
    return 1.6;
  },
  office(k) {
    // the land office: a white bank front with columns and a pediment
    k.box(0, 0, -.15, 1.25, .82, .8, 'white', { jit: .05 }); k.box(0, 0, .3, 1.36, .07, .42, 'stoneL'); k.box(0, .07, .32, 1.2, .04, .36, 'stoneL');
    for (let i = 0; i < 4; i++) k.cyl(-.45 + i * .3, .11, .42, .06, .66, 'white', { seg: 8 });
    k.box(0, .77, .32, 1.3, .1, .36, 'stoneL'); k.gable(0, .87, .32, 1.32, .38, .26, 'white');
    k.gable(0, .82, -.15, 1.3, .86, .26, 'roofB'); door(k, 0, .26, { w: .3, h: .48, c: 'iron' });
    k.cyl(0, .92, .5, .08, .02, 'gold', { rx: Math.PI / 2, mat: 'metal', seg: 10 }); windows(k, [-.4, .4], .34, .26, .16, .26);
    return 1.13;
  },
  caravan(k) {
    // the trading post: a loading dock, a signpost with arrows and goods waiting
    k.box(0, 0, -.25, 1.4, .18, .7, 'woodD'); k.box(0, .18, -.25, 1.36, .02, .66, 'plank');
    k.box(-.45, 0, .45, .06, .8, .06, 'woodD'); k.box(-.32, .62, .45, .32, .1, .03, 'woodL', { rz: .05 }); k.box(-.58, .48, .45, .3, .1, .03, 'woodL', { rz: -.05 });
    k.box(.2, 0, .55, .8, .04, .04, 'woodD'); for (const sx of [-.15, .55]) k.box(sx, 0, .55, .05, .3, .05, 'woodD'); k.box(.2, .28, .55, .8, .04, .05, 'woodD');
    crate(k, -.4, -.25, .2, .2); crate(k, -.18, -.3, .18, .2, .3); barrel(k, .2, -.3, .2); barrel(k, .4, -.22, .2); sacks(k, .55, -.35);
    return .8;
  },
  // --- Iron Ridge -------------------------------------------------------------------------------------------------
  ironmine(k, add) { return R.mine(k, add, { r1: 'rockR', r2: 'rockD', ore: 'rockR' }); },
  coalseam(k, add) {
    rocks(k, -.2, -.4, 'coal', 'rockD', 8, .6, 5); k.dode(-.2, .25, -.5, .42, 'rockD', { sy: .8 });
    // a tipple on stilts with a chute dropping coal onto a heap
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(.35 + sx * .2, 0, .05 + sz * .18, .05, .72, .05, 'wood');
    k.box(.35, .72, .05, .5, .3, .42, 'woodL'); k.gable(.35, 1.02, .05, .56, .48, .16, 'roofS');
    k.box(.35, .5, .38, .14, .05, .45, 'tinD', { rx: .5 }); k.cone(.35, 0, .62, .25, .22, 'coal', { seg: 7 });
    rails(k, -.4, .45, .7); const ct = part(k2 => cart(k2, 0, 'coal')); add('cart', ct, new THREE.Vector3(-.4, .02, .45));
    return 1.2;
  },
  quarry(k, add) {
    // stepped stone terraces and a swinging crane
    for (let i = 0; i < 3; i++) k.box(-.2 + i * .1, 0, -.45 + i * .22, 1.3 - i * .25, .45 - i * .14, .5, i % 2 ? 'stoneL' : 'stone', { jit: .12 });
    for (let i = 0; i < 4; i++) k.box(-.6 + i * .18, 0, .62, .14, .12, .14, 'stoneL', { ry: i * .3 });
    k.box(.55, 0, .3, .08, .95, .08, 'wood'); k.box(.55, 0, .3, .3, .06, .3, 'woodD');
    const boom = part(k2 => { k2.box(-.3, 0, 0, .7, .05, .05, 'woodD'); k2.box(-.6, -.35, 0, .01, .35, .01, 'ink'); k2.box(-.6, -.47, 0, .14, .12, .14, 'stoneL'); });
    add('swing', boom, new THREE.Vector3(.55, .92, .3));
    return 1;
  },
  blast(k, add) {
    // a tall blast furnace with banded sides, two hot-blast stoves and a glowing throat
    k.cyl(-.15, 0, -.05, .36, .25, 'stoneD', { seg: 10 }); k.cyl(-.15, .25, -.05, .3, 1.05, 'brick', { r2: .22, seg: 10, jit: .1 });
    for (const y of [.45, .75, 1.05]) k.cyl(-.15, y, -.05, .31 - (y - .25) * .075, .04, 'iron', { seg: 10, mat: 'metal' });
    for (const x of [.42, .72]) { k.cyl(x, 0, -.35, .13, .8, 'tin', { seg: 8 }); k.ball(x, .8, -.35, .13, 'tin', { det: 1, sy: .7 }); }
    k.box(.2, .1, .38, .9, .05, .14, 'woodD', { rz: -.6 });
    const hot = part(k2 => { k2.cyl(0, 0, 0, .2, .05, 'glowO', { mat: 'fire', seg: 10 }); k2.box(0, -1.08, .3, .18, .14, .03, 'glowO', { mat: 'fire' }); }); add('hot', hot, new THREE.Vector3(-.15, 1.29, -.05));
    k.box(-.15, 0, .26, .3, .24, .06, 'black');
    add('smoke', null, new THREE.Vector3(-.15, 1.4, -.05));
    return 1.4;
  },
  rolling(k, add) {
    k.box(0, 0, -.3, 1.5, .55, .6, 'tin', { jit: .1 }); k.gable(0, .55, -.3, 1.6, .74, .2, 'roofS');
    for (let i = 0; i < 7; i++) k.box(-.68 + i * .225, 0, .005, .025, .55, .02, 'tinD');
    // rollers turn on a stand in front, rails stacked beside
    k.box(-.15, 0, .3, .9, .18, .28, 'iron', { mat: 'metal' });
    for (const y of [.25, .37]) { const r = part(k2 => k2.cyl(0, -.45, 0, .055, .9, 'steel', { mat: 'metal', seg: 8 })); r.rotation.z = Math.PI / 2; const h = new THREE.Group(); h.add(r); add('spin', h, new THREE.Vector3(-.15, y, .3), 'x', 8); }
    for (let i = 0; i < 4; i++) k.box(.55, i * .04, .5, .45, .035, .05, 'steel', { mat: 'metal', ry: Math.PI / 2 });
    return .75;
  },
  boilerw(k, add) {
    const top = shed(k, -.2, -.25, 1.1, .7, .55, 'brick', 'roofS', { trim: 'brickD' });
    door(k, -.45, .1, { w: .3 }); windows(k, [0, .25], .3, .1, .14, .16);
    // a riveted boiler waiting outside on wooden chocks
    for (const x of [-.25, .25]) k.box(x, 0, .52, .1, .1, .32, 'woodD');
    k.cyl(0, .26, .52, .2, .8, 'ironL', { rz: Math.PI / 2, seg: 10, mat: 'metal' }).parts.metal.at(-1).translate(.4, 0, 0);
    for (const x of [-.3, 0, .3]) k.cyl(x - .02, .26, .52, .205, .03, 'iron', { rz: Math.PI / 2, seg: 10, mat: 'metal' });
    const sm = chimney(k, .2, .55, -.4, .7); add('smoke', null, sm);
    return top;
  },
  locow(k, add) {
    // the locomotive works: a big shed with an arched door and an engine nosing out
    k.box(0, 0, -.2, 1.6, .85, .95, 'brickD', { jit: .08 }); k.gable(0, .85, -.2, 1.7, 1.08, .3, 'roofS');
    k.box(-.3, 0, .28, .55, .62, .02, 'black'); k.cyl(-.3, .62, .28, .275, .02, 'black', { rx: Math.PI / 2, seg: 10 });
    k.cyl(-.3, .22, .2, .14, .7, 'black', { rx: Math.PI / 2, seg: 10, mat: 'metal' }); k.box(-.3, .03, .42, .3, .18, .3, 'paintR'); k.cyl(-.3, .36, .55, .045, .2, 'black'); k.cone(-.3, .22, .62, .1, .1, 'steel', { rx: Math.PI / 2, mat: 'metal' });
    for (const sx of [-1, 1]) for (const z of [.35, .55]) k.cyl(-.3 + sx * .16, .09, z, .09, .03, 'paintR', { rz: Math.PI / 2, seg: 10 });
    k.box(-.3, .2, .69, .05, .05, .02, 'glowW', { mat: 'glow' });
    windows(k, [.35, .6], .4, .28, .16, .2);
    const sm = stack(k, -.55, .85, -.5, .55, .08, 'brick'); add('smoke', null, sm);
    return 1.4;
  },
  // --- Silver Falls -----------------------------------------------------------------------------------------------
  cumine(k, add) { return R.mine(k, add, { r1: 'verd', r2: 'rock', ore: 'copper' }); },
  sandpit(k, add) {
    k.cone(-.3, 0, -.25, .55, .4, 'sand', { seg: 8, jit: .06 }); k.cone(.25, 0, -.4, .4, .3, 'adobeL', { seg: 7 });
    // a sieve frame and a conveyor carrying sand up to a hopper
    k.box(.4, 0, .25, .5, .04, .4, 'woodD'); for (const sx of [-1, 1]) k.box(.4 + sx * .22, 0, .25, .04, .3, .04, 'wood'); k.box(.4, .3, .25, .5, .04, .4, 'steel', { rx: .1 });
    k.box(-.15, .05, .45, .9, .04, .14, 'iron', { rz: .35 }); k.box(-.55, 0, .45, .04, .1, .04, 'woodD'); k.box(.25, 0, .45, .04, .38, .04, 'woodD');
    const belt = part(k2 => { for (let i = 0; i < 5; i++) k2.box(-.32 + i * .16, 0, 0, .06, .02, .13, 'sand'); }, { cast: false }); belt.rotation.z = .35; add('belt', belt, new THREE.Vector3(-.15, .1, .45));
    return .7;
  },
  wheel(k, add) {
    // a mill house, a flume on stilts and the big water wheel that powers the town
    shed(k, -.45, -.2, .7, .7, .5, 'woodL', 'roofG');
    door(k, -.45, .15); windows(k, [-.6], .26, .15, .1, .12);
    for (const z of [-.6, -.1]) k.box(.4, 0, z, .05, .95, .05, 'woodD');
    k.box(.4, .95, -.3, .2, .08, .9, 'wood'); k.box(.4, .99, -.3, .14, .04, .88, 'water', { mat: 'glow' });
    k.box(.4, 0, .3, .5, .08, .6, 'stoneD'); k.box(.4, .03, .3, .4, .06, .5, 'water', { mat: 'glow' });
    const wh = part(k2 => { k2.torus(0, 0, 0, .42, .04, 'wood', { ts: 16 }); k2.torus(0, 0, 0, .25, .03, 'woodD', { ts: 12 }); for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; k2.box(Math.cos(a) * .42, Math.sin(a) * .42 - .04, 0, .12, .08, .14, 'woodL', { rz: a }); } for (let i = 0; i < 4; i++) k2.box(0, -.42, 0, .04, .84, .04, 'woodD', { rz: i * .785 }); });
    wh.rotation.y = Math.PI / 2; const h = new THREE.Group(); h.add(wh); add('spin', h, new THREE.Vector3(.4, .5, .3), 'x', -1.6);
    return 1;
  },
  refinery(k, add) {
    const top = shed(k, -.15, -.15, 1.1, .8, .6, 'brick', 'verd', { trim: 'brickD' });
    k.box(-.35, 0, .26, .32, .32, .05, 'black'); const hot = part(k2 => k2.box(0, 0, 0, .26, .26, .02, 'glowO', { mat: 'fire' })); add('hot', hot, new THREE.Vector3(-.35, .02, .29));
    windows(k, [.15], .3, .26, .16, .16); const sm = chimney(k, .3, .2, -.35, 1.05, 'brick', .1); add('smoke', null, sm);
    ingots(k, .55, .52, 'copper');
    return top;
  },
  wirew(k, add) {
    const top = shed(k, -.1, -.3, 1.4, .6, .55, 'tin', 'roofB', { trim: 'tinD' });
    door(k, -.45, 0, { w: .3 }); windows(k, [0, .3], .3, 0, .14, .16);
    // copper wire spools turn as the wire winds on
    for (const [x, z] of [[-.45, .5], [.05, .5], [.5, .45]]) { k.box(x, 0, z, .08, .2, .32, 'woodD'); const sp = part(k2 => { k2.cyl(0, -.11, 0, .13, .22, 'copper', { seg: 10, mat: 'metal' }); k2.cyl(0, -.13, 0, .17, .03, 'woodL', { seg: 10 }); k2.cyl(0, .1, 0, .17, .03, 'woodL', { seg: 10 }); }); sp.rotation.x = Math.PI / 2; const h = new THREE.Group(); h.add(sp); add('spin', h, new THREE.Vector3(x, .22, z), 'z', 3); }
    return top;
  },
  glassb(k, add) { const t = R.glass(k, add); for (let i = 0; i < 4; i++) k.cyl(-.65 + i * .12, 0, .72, .03, .12, 'verd', { seg: 6, mat: 'glow' }); return t; },
  bulbw(k, add) {
    const top = shed(k, 0, -.15, 1.3, .85, .6, 'cream', 'roofB', { trim: 'iron', flat: true });
    door(k, -.3, .28, { w: .3 }); windows(k, [.15, .45], .3, .28, .16, .2, { c: 'glowW' });
    // a giant light bulb on the roof, glowing
    k.cyl(.25, top, -.15, .1, .12, 'iron', { seg: 8, mat: 'metal' }); k.cyl(.25, top + .12, -.15, .12, .1, 'gold', { r2: .14, seg: 8, mat: 'metal' });
    const bulb = part(k2 => { k2.ball(0, 0, 0, .22, 'glowW', { mat: 'fire', det: 1 }); k2.box(0, -.08, 0, .1, .12, .02, 'gold', { mat: 'fire' }); }, { cast: false }); add('glow', bulb, new THREE.Vector3(.25, top + .42, -.15));
    k.box(-.4, top, -.3, .04, .4, .04, 'iron'); k.ball(-.4, top + .42, -.3, .05, 'glowW', { mat: 'glow' });
    return top + .65;
  },
  telw(k, add) {
    const top = shed(k, -.3, -.1, .95, .8, .55, 'stoneL', 'roofS', { trim: 'stoneD' });
    door(k, -.3, .31); windows(k, [-.6, 0], .3, .31, .14, .16);
    // a lattice telegraph mast with insulators and a beacon
    for (const sx of [-1, 1]) k.box(.55 + sx * .1, 0, -.1, .04, 1.7, .04, 'iron', { rz: -sx * .05, mat: 'metal' });
    for (let i = 0; i < 6; i++) k.box(.55, .2 + i * .26, -.1, .2 - i * .02, .03, .03, 'iron', { rz: i % 2 ? .5 : -.5 });
    for (const y of [1.2, 1.45]) { k.box(.55, y, -.1, .5, .04, .04, 'woodD'); for (const sx of [-1, 1]) k.cyl(.55 + sx * .22, y + .04, -.1, .025, .06, 'paintG', { seg: 6 }); }
    const bc = part(k2 => k2.ball(0, 0, 0, .06, 'paintR', { mat: 'fire' }), { cast: false }); add('blink', bc, new THREE.Vector3(.55, 1.74, -.1));
    return 1.8;
  },
};

/* Milestones show on every building: crates at level 10, lanterns at 25, a flag at 50, gold trim at 100+. */
function milestones(k, tier, top, id) {
  if (tier >= 1) { crate(k, .78, .78, .16); barrel(k, -.8, .8); }
  if (tier >= 2) lights(k, [-.88, .7], .88);
  if (tier >= 3 && !['hall'].includes(id)) flag(k, -.7, top - .25, -.6, tier >= 4 ? 'gold' : 'paintR');
  if (tier >= 4) { k.box(0, 0, .92, 1.7, .05, .05, 'goldD'); for (let i = 0; i < 6; i++) k.box(-.75 + i * .3, .05, .92, .06, .08, .06, 'gold', { mat: 'metal' }); }
}
/* A plot not built yet: survey stakes and a little sign. */
function emptyLot(k) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(sx * .72, 0, sz * .72, .05, .18, .05, 'woodL');
  for (const [x, z, w, d] of [[0, .72, 1.44, .012], [0, -.72, 1.44, .012], [.72, 0, .012, 1.44], [-.72, 0, .012, 1.44]]) k.box(x, .14, z, w, .012, d, 'white', { ao: false });
  k.box(.45, 0, .55, .04, .34, .04, 'woodD'); k.box(.45, .26, .57, .26, .14, .02, 'cream');
  rocks(k, -.3, -.2, 'rock', 'rockD', 3, .3, 17);
}

export const BUILDING_IDS = Object.keys(R);
/* Build a building group: { obj, movers: [...], smoke: [Vector3], top }. */
export function makeBuilding(id, tier = 0) {
  const k = new Kit({ aoH: .8 }), movers = [], smoke = [], obj = new THREE.Group();
  const add = (kind, node, pos, axis, speed) => {
    if (kind === 'smoke') { smoke.push(pos.clone()); return; }
    node.position.copy(pos); obj.add(node); movers.push({ kind, node, axis, speed, base: node.rotation.clone(), y0: pos.y });
  };
  let top = 1;
  if (id === '_lot') emptyLot(k); else if (R[id]) { top = R[id](k, add); milestones(k, tier, top, id); } else { shed(k, 0, 0, 1.2, .9, .6, 'wood', 'roofR'); }
  obj.add(k.build());
  obj.traverse(o => { if (o.isMesh) { o.castShadow = o.castShadow !== false && o.material.type !== 'MeshBasicMaterial'; o.receiveShadow = true; } });
  return { obj, movers, smoke, top };
}
