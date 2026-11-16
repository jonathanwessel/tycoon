/* Raiders, workers, wagons, towers, the vault and scenery props, modelled in code.
   People are three moving parts (body, left leg, right leg) so a walking crowd stays cheap to draw. */
import * as THREE from 'three';
import { Kit, part, rng } from './kit.js';
import { barrel, crate } from './buildings.js';

const G = () => new THREE.Group();
function legs(k, pants, boot, w = .075, h = .3) { k.box(0, -h, 0, w, h, w * 1.1, pants, { ao: false }); k.box(0, -h, .015, w + .01, .07, w * 1.4, boot, { ao: false }); }
/* A person facing +z, feet at y = 0, about .8 tall. o: shirt, pants, hat ('cowboy'|'bowler'|'cap'|'bandana'|'none'), extra(k). */
export function person(o) {
  const root = G(), body = part(k => {
    const s = o.wide || 1, skin = o.skin || 'skin';
    k.box(0, .3, 0, .22 * s, .26, .14, o.shirt, { ao: false });
    if (o.vest) k.box(0, .32, .002, .225 * s, .22, .145, o.vest, { ao: false });
    k.box(0, .3, 0, .23 * s, .04, .15, o.belt || 'bark', { ao: false });
    for (const sx of [-1, 1]) { k.box(sx * (.14 * s), .32, 0, .065, .22, .08, o.shirt, { ao: false, rz: sx * .12 }); k.box(sx * (.15 * s), .29, 0, .06, .05, .06, skin, { ao: false }); }
    k.box(0, .56, 0, .14, .14, .13, skin, { ao: false });
    if (o.mask) k.box(0, .57, .055, .145, .05, .03, o.mask, { ao: false });
    k.box(0, .6, .067, .1, .02, .01, 'ink', { ao: false });
    const hc = o.hatC || 'bark';
    if (o.hat === 'cowboy') { k.cyl(0, .68, 0, .16, .02, hc, { seg: 10, ao: false }); k.cyl(0, .69, 0, .07, .09, hc, { r2: .065, seg: 8, ao: false }); }
    else if (o.hat === 'bowler') { k.cyl(0, .68, 0, .11, .02, hc, { seg: 10, ao: false }); k.ball(0, .72, 0, .075, hc, { det: 1, sy: .8, ao: false }); }
    else if (o.hat === 'cap') { k.box(0, .67, 0, .15, .05, .14, hc, { ao: false }); k.box(0, .67, .08, .12, .02, .08, hc, { ao: false }); }
    else if (o.hat === 'bandana') k.box(0, .64, 0, .15, .05, .14, hc, { ao: false });
    if (o.extra) o.extra(k);
  }, { ao: false });
  const L = part(k => legs(k, o.pants || 'denim', 'bark'), { ao: false }), Rl = part(k => legs(k, o.pants || 'denim', 'bark'), { ao: false });
  L.position.set(-.06 * (o.wide || 1), .3, 0); Rl.position.set(.06 * (o.wide || 1), .3, 0);
  root.add(body, L, Rl); root.userData = { body, legs: [L, Rl] };
  return root;
}
const gun = k => { k.box(.17, .2, .09, .03, .05, .14, 'iron', { ao: false }); };
const FOE = {
  raider: () => person({ shirt: 'paintR', pants: 'cloth', hat: 'cowboy', hatC: 'bark', mask: 'paintR', extra: gun }),
  brute: () => person({ shirt: 'paintP', pants: 'black', hat: 'bandana', hatC: 'ink', wide: 1.35, skin: 'skinD', extra: k => { k.cyl(.22, .1, .1, .04, .4, 'woodD', { r2: .07, rx: .5, seg: 6, ao: false }); } }),
  shield: () => { const p = person({ shirt: 'steel', pants: 'iron', hat: 'cap', hatC: 'ironL' }); const sh = part(k => { k.box(0, .12, .13, .34, .42, .04, 'woodL', { ao: false }); k.box(0, .12, .15, .38, .05, .02, 'steel', { ao: false }); k.box(0, .5, .15, .38, .05, .02, 'steel', { ao: false }); k.ball(0, .33, .16, .05, 'steel', { ao: false }); }, { ao: false }); p.userData.body.add(sh); p.userData.shield = sh; return p; },
  sapper: () => { const p = person({ shirt: 'paintG', pants: 'cloth', hat: 'cap', hatC: 'leafD', extra: k => { for (let i = 0; i < 4; i++) k.cyl(-.06 + i * .04, .3, -.1, .018, .2, 'paintR', { seg: 5, ao: false }); k.box(0, .38, -.1, .18, .03, .05, 'bark', { ao: false }); } }); const sp = part(k => k.ball(0, 0, 0, .03, 'glowO', { mat: 'fire' }), { cast: false }); sp.position.set(.04, .53, -.1); p.userData.body.add(sp); p.userData.spark = sp; return p; },
  healer: () => person({ shirt: 'white', pants: 'denim', hat: 'cap', hatC: 'white', extra: k => { k.box(-.17, .18, .03, .1, .1, .12, 'woodL', { ao: false }); k.box(-.17, .21, .095, .06, .02, .01, 'paintG', { ao: false }); k.box(-.17, .21, .095, .02, .06, .01, 'paintG', { ao: false }); } }),
  thief: () => { const p = person({ shirt: 'paintP', pants: 'black', hat: 'cap', hatC: 'black', mask: 'black', extra: k => { k.ball(.05, .45, -.14, .12, 'cream', { sy: 1.1, ao: false }); } }); p.userData.body.rotation.x = .3; return p; },
};
function horse(k, c = 'woodD') {
  k.box(0, .3, 0, .18, .18, .48, c, { ao: false }); k.box(0, .4, .26, .1, .2, .12, c, { rx: -.5, ao: false }); k.box(0, .52, .36, .09, .08, .18, c, { ao: false });
  k.box(0, .44, .2, .03, .16, .14, 'ink', { rx: -.5, ao: false }); k.box(0, .38, -.26, .04, .2, .04, 'ink', { rx: .5, ao: false });
}
FOE.runner = () => {
  const root = G(), body = part(k => {
    horse(k, 'woodD'); k.box(0, .47, -.02, .2, .05, .18, 'paintR', { ao: false });
    k.box(0, .5, -.04, .2, .24, .13, 'paintY'); k.box(0, .76, -.04, .13, .13, .12, 'skin'); k.cyl(0, .87, -.04, .15, .02, 'bark', { seg: 10 }); k.cyl(0, .88, -.04, .065, .08, 'bark', { seg: 8 });
    for (const sx of [-1, 1]) k.box(sx * .12, .42, 0, .06, .16, .14, 'denim', { ao: false });
  }, { ao: false });
  const legsA = [[-.06, .17], [.06, .17], [-.06, -.17], [.06, -.17]].map(([x, z]) => { const l = part(k => k.box(0, -.3, 0, .05, .3, .05, 'woodD', { ao: false }), { ao: false }); l.position.set(x, .32, z); return l; });
  root.add(body, ...legsA); root.userData = { body, legs: legsA, gallop: 1 }; return root;
};
function wheel(r, c = 'woodD', hub = 'iron') { return part(k => { k.torus(0, 0, 0, r, r * .16, c, { ts: 10 }); for (let i = 0; i < 3; i++) k.box(0, -r, 0, r * .14, r * 2, r * .14, c, { rz: i * 1.05 }); k.cyl(0, 0, -.03, r * .25, .06, hub, { rx: Math.PI / 2, seg: 8 }); }); }
function wheels(root, list, r, c) { const ws = list.map(([x, y, z, ry]) => { const w = wheel(r, c); const h = G(); h.add(w); w.rotation.y = ry || Math.PI / 2; h.position.set(x, y, z); root.add(h); return h; }); root.userData.wheels = ws; }
FOE.boss = () => {
  // the war wagon: an iron-plated wagon with spikes and a cannon, drawn by two armoured horses
  const root = G(); root.userData = {};
  root.add(part(k => {
    k.box(0, .2, -.15, .5, .08, .8, 'woodD'); k.box(0, .28, -.15, .46, .3, .72, 'iron', { mat: 'metal' }); k.box(0, .58, -.15, .5, .05, .76, 'ironL', { mat: 'metal' });
    for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) k.cone(sx * .25, .38, -.45 + i * .2, .03, .1, 'steel', { rz: -sx * Math.PI / 2, mat: 'metal', seg: 5 });
    k.cyl(0, .63, -.2, .09, .1, 'iron'); k.cyl(0, .7, -.05, .05, .4, 'black', { rx: Math.PI / 2 - .2, seg: 8 });
    k.box(0, .6, -.5, .06, .3, .02, 'woodD'); k.box(.08, .78, -.5, .16, .12, .01, 'paintR');
    for (const sx of [-1, 1]) { const off = sx * .12; k.box(off, .3, .5, .14, .16, .36, 'black', { ao: false }); k.box(off, .4, .7, .08, .16, .1, 'black', { rx: -.5, ao: false }); k.box(off, .31, .5, .15, .1, .3, 'steel', { mat: 'metal', ao: false }); }
  }));
  wheels(root, [[-.27, .16, -.4], [.27, .16, -.4], [-.27, .16, .1], [.27, .16, .1]], .16);
  const hl = [[-.12, .36], [.12, .36], [-.12, .64], [.12, .64]].map(([x, z]) => { const l = part(k => k.box(0, -.3, 0, .045, .3, .045, 'black', { ao: false }), { ao: false }); l.position.set(x, .32, z); root.add(l); return l; });
  root.userData.legs = hl; root.userData.gallop = 1; return root;
};
FOE.train = () => {
  // the armoured train: a plated locomotive with a cowcatcher and a tall stack
  const root = G(); root.userData = {};
  root.add(part(k => {
    k.box(0, .12, 0, .42, .08, 1, 'black'); k.cyl(0, .38, -.05, .17, .7, 'iron', { rx: Math.PI / 2, seg: 10, mat: 'metal' }).parts.metal.at(-1).translate(0, 0, -.3);
    k.box(0, .2, -.42, .44, .46, .3, 'paintR'); k.box(0, .66, -.42, .5, .05, .36, 'black'); k.win(0, .46, -.265, .16, .12, { frame: 'black' });
    k.cyl(0, .52, .2, .055, .3, 'black', { r2: .09 }); k.box(0, .4, .05, .38, .2, .02, 'steel', { mat: 'metal' });
    k.box(0, .05, .5, .4, .14, .1, 'steel', { rx: -.6, mat: 'metal' }); k.box(0, .38, .34, .08, .08, .02, 'glowW', { mat: 'fire' });
    for (const z of [-.3, 0, .3]) for (const sx of [-1, 1]) k.box(sx * .19, .3, z - .1, .04, .2, .25, 'ironL', { mat: 'metal' });
  }));
  wheels(root, [[-.22, .12, -.35], [.22, .12, -.35], [-.22, .12, 0], [.22, .12, 0], [-.22, .12, .3], [.22, .12, .3]], .12, 'paintR');
  root.userData.smoke = new THREE.Vector3(0, .9, .2); return root;
};
function hull(k, len, w, c, cap = 'woodL') { k.box(0, 0, 0, w, .14, len, c); k.box(0, .14, 0, w + .03, .03, len + .02, cap); k.cyl(0, 0, len / 2, w / 2, .17, c, { seg: 3 }); k.parts.solid.at(-1).translate(0, 0, .02); }
FOE.boat = () => {
  // river pirates: a rowboat with two pirates and a pair of oars
  const root = G(); root.userData = { boat: 1 };
  root.add(part(k => {
    hull(k, .7, .3, 'wood'); for (const z of [-.15, .15]) { k.box(0, .14, z, .16, .18, .1, z > 0 ? 'paintR' : 'paintB'); k.box(0, .32, z, .1, .1, .1, 'skin'); k.box(0, .41, z, .11, .04, .11, 'black'); }
    k.box(0, .14, -.3, .015, .4, .015, 'woodD'); k.box(.08, .38, -.3, .15, .1, .01, 'black');
  }));
  const oars = [-1, 1].map(sx => { const o = part(k => k.box(sx * .18, -.02, 0, .32, .025, .025, 'woodL', { rz: sx * .4 })); o.position.set(0, .18, 0); root.add(o); return o; });
  root.userData.oars = oars; return root;
};
FOE.steamer = () => {
  // the ironclad steamer: a sloped iron casemate, a stack and a paddle wheel at the stern
  const root = G(); root.userData = { boat: 1 };
  root.add(part(k => {
    hull(k, 1.3, .5, 'iron', 'ironL'); k.box(0, .17, -.05, .4, .2, .8, 'ironL', { mat: 'metal' }); k.box(0, .37, -.05, .3, .04, .7, 'iron', { mat: 'metal' });
    k.cyl(0, .41, .05, .07, .45, 'black', { r2: .08 }); k.box(0, .4, -.28, .14, .1, .14, 'iron'); k.box(0, .5, -.2, .05, .05, .2, 'black', { rx: -.1 });
    for (const z of [-.3, .2]) for (const sx of [-1, 1]) k.box(sx * .205, .24, z, .01, .06, .08, 'black');
  }));
  const pw = wheel(.24, 'paintR'); const h = G(); h.add(pw); pw.rotation.y = Math.PI / 2; h.position.set(0, .2, -.72); root.add(h); root.userData.wheels = [h];
  root.userData.smoke = new THREE.Vector3(0, .9, .05); return root;
};
FOE.zeppelin = () => {
  // the sky pirates' airship: an aluminium envelope with red bands and fins, a wooden gondola of pirates, two propellers
  const root = G(); root.userData = { air: 1 };
  root.add(part(k => {
    k.ball(0, .55, 0, .38, '#c8d0dc', { det: 1, sz: 2.2, mat: 'metal' });
    for (const z of [-.42, .42]) k.torus(0, .55, z, .335, .022, 'paintR', { ts: 14 });
    k.box(0, .3, -.82, .03, .5, .26, 'paintR'); k.box(0, .53, -.82, .5, .03, .26, 'paintR');
    k.box(0, -.04, 0, .26, .16, .6, 'wood'); k.box(0, .12, 0, .28, .03, .62, 'woodD');
    for (const sx of [-1, 1]) { for (const z of [-.15, .05, .2]) k.box(sx * .132, .02, z, .01, .05, .08, 'glowW', { mat: 'glow' }); for (const z of [-.22, .22]) k.box(sx * .1, .14, z, .015, .2, .015, 'black'); }
    for (const z of [.12, -.05]) { k.box(0, .15, z, .08, .08, .08, 'skin'); k.box(0, .23, z, .1, .03, .1, 'black'); }
    k.box(0, .15, -.3, .015, .26, .015, 'woodD'); k.box(0, .3, -.38, .01, .1, .15, 'black');
    for (const sx of [-1, 1]) { k.box(sx * .3, .08, -.2, .1, .1, .22, 'iron', { mat: 'metal' }); k.box(sx * .17, .12, -.2, .16, .02, .03, 'iron'); }
  }));
  root.userData.props = [-1, 1].map(sx => { const p = part(k => { k.box(0, -.16, 0, .04, .32, .015, 'woodL'); k.box(-.16, 0, 0, .32, .04, .015, 'woodL'); }); p.position.set(sx * .3, .13, -.33); root.add(p); return p; });
  root.userData.smoke = new THREE.Vector3(.3, .13, -.4); return root;
};
export function makeFoe(type) { const f = (FOE[type] || FOE.raider)(); f.traverse(o => { if (o.isMesh) { o.castShadow = o.material.type !== 'MeshBasicMaterial'; o.receiveShadow = false; } }); return f; }

/* Porters carry goods between buildings; foremen stand by their building's door. */
export function makeWorker(good) { return person({ shirt: 'cream', pants: 'cloth', hat: 'cap', hatC: 'woodL', extra: k => k.box(0, .46, .12, .14, .12, .12, good || 'woodL') }); }
export function makeDrone() {
  const root = G(); root.add(part(k => { k.box(0, 0, 0, .2, .07, .2, 'black', { mat: 'metal' }); k.box(0, -.03, .09, .06, .04, .04, 'paintR', { mat: 'fire' }); k.box(0, -.06, 0, .04, .05, .14, 'iron'); for (const a of [.785, 2.356]) k.box(0, .03, 0, .5, .02, .03, 'iron', { ry: a }); }));
  root.userData.props = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([x, z]) => { const pr = part(k => { k.box(0, 0, 0, .2, .006, .025, 'steel', { ao: false }); k.box(0, 0, 0, .025, .006, .2, 'steel', { ao: false }); }, { cast: false }); pr.position.set(x * .17, .06, z * .17); root.add(pr); return pr; });
  root.traverse(o => { if (o.isMesh) o.castShadow = true; }); return root;
}
export function makeSoldier() { return person({ shirt: 'paintB', vest: 'paintB', pants: 'denim', hat: 'cowboy', hatC: 'iron', belt: 'gold', extra: k => { k.box(.17, .12, .05, .03, .5, .03, 'woodD', { rx: -.3, ao: false }); k.box(.17, .5, .14, .02, .12, .02, 'steel', { rx: -.3, ao: false }); } }); }
export function makeForeman() { return person({ shirt: 'white', vest: 'paintR', pants: 'black', hat: 'bowler', hatC: 'black', extra: k => k.box(.16, .3, .08, .08, .1, .02, 'cream') }); }
export function makeWagon(kind) {
  const root = G(); root.userData = {};
  if (kind === 'loco') {
    root.add(part(k => { k.box(0, .1, 0, .3, .06, .7, 'black'); k.cyl(0, .3, -.05, .12, .45, 'iron', { rx: Math.PI / 2, seg: 10, mat: 'metal' }).parts.metal.at(-1).translate(0, 0, -.18); k.box(0, .16, -.28, .3, .34, .2, 'paintG'); k.box(0, .5, -.28, .34, .04, .24, 'black'); k.cyl(0, .4, .12, .04, .2, 'black', { r2: .07 }); k.box(0, .05, .36, .28, .1, .06, 'steel', { rx: -.6 }); }));
    wheels(root, [[-.16, .1, -.2], [.16, .1, -.2], [-.16, .1, .1], [.16, .1, .1]], .1, 'paintR'); root.userData.smoke = new THREE.Vector3(0, .65, .12);
  } else {
    root.add(part(k => { k.box(0, .14, -.1, .3, .14, .5, 'wood'); for (let i = 0; i < 4; i++) k.box(0, .28, -.32 + i * .15, .32, .2, .03, 'woodD'); k.cyl(0, .28, -.35, .16, .5, 'cream', { rx: Math.PI / 2, seg: 8, open: true }); crate(k, 0, -.15, .14, .26); horse(k, 'woodL'); }));
    wheels(root, [[-.17, .12, -.28], [.17, .12, -.28], [-.17, .12, .05], [.17, .12, .05]], .11);
  }
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return root;
}

/* --- towers: a base, and a head that turns to aim (barrel along +x) --------------------------------------------- */
export function makeTower(type, br, lvl) {
  const root = G(), head = G(), bar = G(); root.add(head); head.add(bar); root.userData = { head, bar };
  const gold = lvl >= 3, R2 = rng(type.length * 7 + (br || '').length);
  const base = part(k => {
    if (type === 'crossbow') { for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(sx * .26, 0, sz * .26, .07, .5, .07, 'wood', { rz: -sx * .06, rx: sz * .06 }); k.box(0, .2, 0, .58, .04, .04, 'woodD', { rz: .4 }); k.box(0, .5, 0, .66, .07, .66, 'woodL'); for (let i = 0; i < 6; i++) k.box(-.28 + i * .112, .57, .3, .05, .12, .05, 'woodD'); }
    else if (type === 'cannon') { k.cyl(0, 0, 0, .36, .3, 'stone', { r2: .32, seg: 10, jit: .1 }); for (let i = 0; i < 8; i++) k.box(Math.cos(i * .785) * .3, .3, Math.sin(i * .785) * .3, .12, .1, .12, 'stoneL', { ry: -i * .785 }); }
    else if (type === 'frost') { k.cyl(0, 0, 0, .3, .12, 'stoneL', { seg: 6 }); k.cyl(0, .12, 0, .14, .42, 'stone', { r2: .1, seg: 6 }); k.cyl(0, .54, 0, .2, .05, 'glowI', { seg: 6, mat: 'glow' }); }
    else if (type === 'helipad') {
      for (let i = 0; i < 5; i++) for (const [x, z] of [[-.33 + i * .165, -.33], [-.33, -.33 + i * .165]]) k.cyl(x, 0, z, .045, .4, 'log', { seg: 6 });
      k.cyl(.05, 0, .05, .3, .1, 'stone', { seg: 10 }); k.cyl(.05, .1, .05, .27, .02, 'iron', { seg: 10, mat: 'metal' });
      for (const [x, z, w, d2] of [[-.06, .05, .03, .22], [.16, .05, .03, .22], [.05, .05, .2, .03]]) k.box(x, .12, z, w, .01, d2, 'gold', { ao: false });
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; k.ball(.05 + Math.cos(a) * .27, .12, .05 + Math.sin(a) * .27, .025, 'paintR', { mat: 'fire' }); }
      k.box(-.3, 0, .3, .025, .8, .025, 'woodD'); k.box(-.2, .65, .3, .2, .12, .012, 'paintB');
    }
    else if (type === 'barracks') {
      // a square log palisade with a gate, a tent inside and a blue flag
      for (let i = 0; i < 7; i++) for (const [x, z, ry] of [[-.33 + i * .11, -.33, 0], [-.33 + i * .11, .33, 0], [-.33, -.33 + i * .11, 0], [.33, -.33 + i * .11, 0]]) { if (z === .33 && Math.abs(x) < .1) continue; k.cyl(x, 0, z, .05, .42 + (i % 2) * .05, i % 2 ? 'log' : 'woodL', { seg: 6 }); k.cone(x, .42 + (i % 2) * .05, z, .05, .07, 'woodD', { seg: 6 }); }
      k.box(0, .3, .33, .26, .05, .06, 'woodD'); k.cone(0, 0, -.05, .2, .3, 'cream', { seg: 4, ry: Math.PI / 4 });
      k.box(.25, 0, -.25, .025, .85, .025, 'woodD'); k.box(.36, .7, -.25, .2, .12, .012, 'paintB');
    }
    else if (type === 'still') { k.cyl(0, 0, 0, .32, .1, 'stoneD', { seg: 8 }); for (let i = 0; i < 5; i++) k.log(Math.cos(i * 1.26) * .12, .1, Math.sin(i * 1.26) * .12, .22, .03, 'log', { ry: i * 1.26 }); k.ball(0, .14, 0, .07, 'glowO', { mat: 'fire' });
      k.ball(0, .36, 0, .24, 'copper', { det: 1, sy: .9, mat: 'metal' }); k.cyl(0, .55, 0, .06, .22, 'copper', { r2: .03, mat: 'metal' }); k.cyl(.12, .75, 0, .025, .3, 'copper', { rz: -1.2, mat: 'metal' });
      for (let i = 0; i < 4; i++) k.torus(.32, .3 + i * .07, 0, .07, .015, 'copper', { rx: Math.PI / 2, mat: 'metal', ts: 8 }); k.cyl(.32, 0, .18, .09, .26, 'glowT', { seg: 8, mat: 'glow' }); k.cyl(.32, .26, .18, .05, .05, 'woodD', { seg: 6 });
      if (br === 'a') for (let i = 0; i < 3; i++) k.ball(-.2 + i * .12, .75 + i * .05, -.1, .06 + i * .02, 'verd', { mat: 'glow' });
      if (br === 'b') { k.cyl(-.3, 0, .2, .08, .2, 'paintR', { seg: 8 }); k.box(-.3, .2, .2, .06, .06, .06, 'white'); } }
    else if (type === 'tesla') { k.cyl(0, 0, 0, .3, .14, 'iron', { seg: 8, mat: 'metal' }); k.cyl(0, .14, 0, .1, .7, 'copper', { r2: .06, seg: 8, mat: 'metal' }); for (let i = 0; i < 5; i++) k.torus(0, .25 + i * .12, 0, .14 - i * .015, .025, 'copper', { mat: 'metal', ts: 10, rx: Math.PI / 2 }); }
    else { for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; k.ball(Math.cos(a) * .3, .07 + (i % 2) * .02, Math.sin(a) * .3, .1, 'sand', { sy: .6, ry: a }); } k.cyl(0, 0, 0, .06, .4, 'iron', { seg: 6 }); for (const a of [0, 2.1, 4.2]) k.box(Math.cos(a) * .12, 0, Math.sin(a) * .12, .03, .3, .03, 'iron', { rz: Math.cos(a) * .4, rx: -Math.sin(a) * .4 }); }
    if (gold) k.cyl(0, .02, 0, type === 'crossbow' ? .4 : .38, .04, 'gold', { seg: 10, mat: 'metal' });
    if (lvl >= 6) for (let i = 0; i < 3; i++) k.box(-.2 + i * .2, 0, .42, .06, .06, .06, 'gold', { mat: 'metal' });
  });
  root.add(base);
  const hy = type === 'still' ? .9 : type === 'crossbow' ? .62 : type === 'cannon' ? .4 : type === 'frost' ? .85 : type === 'tesla' ? .95 : .42;
  head.position.y = hy;
  if (type === 'crossbow') bar.add(part(k => {
    k.box(.05, 0, 0, .5, .06, .07, 'woodL'); k.box(.27, -.02, 0, .04, .05, .52, 'woodD', { ry: 0 });
    for (const sz of [-1, 1]) k.box(.24, -.01, sz * .27, .05, .04, .05, 'woodD');
    k.box(.08, .03, 0, .44, .015, .015, 'ink');
    if (br === 'a') k.box(.02, .06, 0, .16, .12, .1, 'iron'); if (br === 'b') { k.box(-.12, 0, 0, .3, .05, .06, 'woodD'); k.cyl(.05, .07, 0, .025, .22, 'black', { rz: Math.PI / 2, seg: 6 }); }
  }));
  else if (type === 'cannon') bar.add(part(k => {
    k.box(0, -.12, 0, .3, .1, .26, 'woodD'); for (const sz of [-1, 1]) k.cyl(-.05, -.12, sz * .14, .08, .03, 'woodD', { rx: Math.PI / 2, seg: 8 });
    if (br === 'a') { k.cyl(0, -.04, 0, .14, .3, 'black', { rz: -.6, seg: 10, mat: 'metal' }); }
    else { k.cyl(-.08, 0, 0, .1, .5, 'black', { rz: -Math.PI / 2, r2: br === 'b' ? .13 : .07, seg: 10, mat: 'metal' }); k.ball(-.12, 0, 0, .1, 'black', { mat: 'metal' }); }
    if (gold) k.cyl(.2, 0, 0, .085, .03, 'gold', { rz: -Math.PI / 2, seg: 10, mat: 'metal' });
  }));
  else if (type === 'frost') {
    const cr = part(k => { k.cone(0, 0, 0, .14, .28, br === 'b' ? 'paintP' : 'glowI', { seg: 5, mat: 'glow' }); k.cone(0, 0, 0, .14, .16, br === 'b' ? 'paintP' : 'glowI', { seg: 5, mat: 'glow', rx: Math.PI }); if (br === 'a') for (let i = 0; i < 3; i++) k.cone(Math.cos(i * 2.1) * .2, -.05, Math.sin(i * 2.1) * .2, .05, .14, 'glowI', { seg: 4, mat: 'glow' }); }, { cast: false });
    bar.add(cr); root.userData.float = 1;
  }
  else if (type === 'helipad') bar.add(part(k => k.ball(0, 0, 0, .001, 'woodD')));
  else if (type === 'barracks') bar.add(part(k => k.ball(0, 0, 0, .001, 'woodD')));
  else if (type === 'still') bar.add(part(k => k.ball(0, 0, 0, .001, 'copper')));
  else if (type === 'tesla') bar.add(part(k => { k.ball(0, 0, 0, .14, br === 'b' ? '#ff8fb0' : 'glowW', { mat: 'fire', det: 1 }); k.torus(0, 0, 0, .19, .02, 'copper', { mat: 'metal', ts: 10, rx: Math.PI / 2 }); }, { cast: false }));
  else {
    const spin = G(); bar.add(spin); root.userData.spin = spin;
    const n = br === 'a' ? 2 : 1;
    for (let j = 0; j < n; j++) spin.add(part(k => { const oz = n > 1 ? (j ? .1 : -.1) : 0; for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; k.cyl(-.1, Math.cos(a) * .05, oz + Math.sin(a) * .05, .018, .48, br === 'b' && i % 2 ? 'gold' : 'steel', { rz: -Math.PI / 2, seg: 5, mat: 'metal' }); } k.cyl(-.12, 0, oz, .07, .14, 'iron', { rz: -Math.PI / 2, seg: 8, mat: 'metal' }); }));
    bar.add(part(k => { k.box(-.2, -.05, 0, .16, .12, .14, 'ironL', { mat: 'metal' }); k.box(-.28, -.02, .1, .06, .06, .1, 'gold', { mat: 'metal' }); }));
  }
  const s = 1 + Math.min(lvl, 8) * .03; root.scale.setScalar(s);
  root.traverse(o => { if (o.isMesh) { o.castShadow = o.material.type !== 'MeshBasicMaterial'; o.receiveShadow = true; } });
  return root;
}

/* The vault: a riveted safe on a stone plinth; more steel bands as it is reinforced. */
export function makeVault(bands) {
  return part(k => {
    k.box(0, 0, 0, .9, .14, .9, 'stoneL', { jit: .1 }); k.box(0, .14, 0, .74, .62, .7, 'iron', { mat: 'metal' }); k.box(0, .76, 0, .8, .06, .76, 'ironL', { mat: 'metal' });
    // the round door faces the road coming in (-x)
    k.cyl(-.37, .45, 0, .24, .04, 'steel', { rz: Math.PI / 2, seg: 12, mat: 'metal' }); k.torus(-.39, .45, 0, .24, .025, 'gold', { ry: Math.PI / 2, ts: 14, mat: 'metal' });
    k.torus(-.41, .45, 0, .08, .015, 'gold', { ry: Math.PI / 2, ts: 10, mat: 'metal' }); for (let i = 0; i < 3; i++) k.box(-.41, .45 - .1, 0, .015, .2, .015, 'gold', { rx: i * 1.05, mat: 'metal' });
    for (let i = 0; i < Math.min(5, bands); i++) k.box(0, .22 + i * .11, 0, .76, .025, .72, 'goldD', { mat: 'metal' });
    for (const sy of [.2, .7]) for (const sz of [-.3, .3]) k.ball(-.372, sy, sz, .02, 'steel');
    k.box(0, .82, 0, .3, .05, .3, 'gold', { mat: 'metal' });
  });
}

/* --- scenery -------------------------------------------------------------------------------------------------- */
export const PROPS = {
  tree: (s, seed) => part(k => { const R2 = rng(seed); k.cyl(0, 0, 0, .07, .35, 'bark', { r2: .05, seg: 6 }); for (let i = 0; i < 3; i++) k.cone(0, .25 + i * .22, 0, .42 - i * .1, .42, i % 2 ? 'leaf' : 'leafD', { seg: 7, ry: R2() * 3, jit: .12 }); }),
  boulder: (s, seed) => part(k => { const R2 = rng(seed); k.dode(0, .25, 0, .32, 'stone', { ry: R2() * 3, sy: .8 }); k.dode(.25, .12, .1, .2, 'stoneD', { ry: R2() * 3 }); k.dode(-.2, .1, .15, .16, 'stoneL'); }),
  dune: (s, seed) => part(k => { k.cone(0, 0, 0, .55, .38, 'sand', { seg: 7, jit: .06 }); k.cone(.3, 0, .2, .3, .22, 'adobeL', { seg: 6 }); k.box(-.25, 0, .3, .04, .3, .04, 'woodD'); k.box(-.25, .28, .3, .2, .04, .04, 'steel', { rz: .6 }); }),
  rock: (s, seed) => part(k => { const R2 = rng(seed); k.dode(0, .18, 0, .26, 'rock', { ry: R2() * 3, sy: .75 }); k.dode(.2, .1, .12, .14, 'rockD', { ry: R2() * 3 }); }),
  rockR: (s, seed) => part(k => { const R2 = rng(seed); k.dode(0, .18, 0, .26, 'rockR', { ry: R2() * 3, sy: .75 }); k.dode(.2, .1, .12, .14, 'rockD', { ry: R2() * 3 }); }),
  rockM: (s, seed) => part(k => { const R2 = rng(seed); k.dode(0, .18, 0, .26, '#b5533a', { ry: R2() * 3, sy: .75 }); k.dode(.2, .1, .12, .14, '#7e3524', { ry: R2() * 3 }); k.dode(-.16, .08, .1, .09, 'white', { ry: R2() * 3 }); }),
  shrub: (s, seed) => part(k => { const R2 = rng(seed); k.cyl(0, 0, 0, .03, .12, 'bark', { seg: 5 }); for (let i = 0; i < 4; i++) { const a = R2() * 6.28, d = R2() * .14; k.ball(Math.cos(a) * d, .16 + R2() * .08, Math.sin(a) * d, .15 + R2() * .05, i % 2 ? '#8fa36a' : '#6f8452', { jit: .1, sy: .8 }); } for (let i = 0; i < 3; i++) k.ball((R2() - .5) * .3, .32, (R2() - .5) * .3, .025, 'paintY'); }),
  rockV: (s, seed) => part(k => { const R2 = rng(seed); k.dode(0, .18, 0, .26, 'verd', { ry: R2() * 3, sy: .75 }); k.dode(.2, .1, .12, .14, 'rock', { ry: R2() * 3 }); }),
  cactus: (s, seed) => part(k => { const R2 = rng(seed); k.cyl(0, 0, 0, .07, .5, 'cactus', { seg: 7, r2: .06 }); k.ball(0, .5, 0, .06, 'cactus', { sy: .7 }); for (const sx of [-1, 1]) { const y = .16 + R2() * .14; k.box(sx * .1, y, 0, .12, .05, .05, 'cactusD'); k.cyl(sx * .15, y, 0, .04, .16 + R2() * .08, 'cactus', { seg: 6 }); } k.ball(0, .56, 0, .025, 'paintR'); }),
  barrel: () => part(k => barrel(k, 0, 0)),
  crate: () => part(k => crate(k, 0, 0, .22, 0, .3)),
  skull: () => part(k => { k.ball(0, .06, 0, .07, 'white', { sy: .85 }); k.box(.03, .04, .06, .02, .02, .01, 'ink'); k.box(-.03, .04, .06, .02, .02, .01, 'ink'); for (const s of [-1, 1]) k.cone(s * .12, .02, -.05, .02, .14, 'white', { rz: s * 1.3, seg: 4 }); }),
  wheel: () => { const w = part(k => { k.torus(0, 0, 0, .16, .03, 'woodD', { ts: 10 }); for (let i = 0; i < 3; i++) k.box(0, -.16, 0, .02, .32, .02, 'woodD', { rz: i * 1.05 }); }); w.rotation.x = -Math.PI / 2 + .15; w.position.y = .04; const g = G(); g.add(w); return g; },
  weed: () => part(k => { k.ball(0, .12, 0, .12, 'woodL', { det: 0 }); k.ball(0, .12, 0, .1, 'bark', { det: 0, ry: .7 }); }, { cast: true }),
};
