/* The modeling kit: low-poly parts built in code (boxes, logs, cones, roofs, gears...), colored per vertex from one
   palette and merged into as few meshes as possible. Every model in the 3D view is assembled from these. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// --- palette: warm desert frontier, chunky and saturated -----------------------------------------------------------
export const PAL = {
  ink: '#2a1c22', wood: '#9a6238', woodL: '#c48a52', woodD: '#6b3f24', log: '#8a5532', bark: '#5e3b22', plank: '#d7a868',
  roofR: '#b8483a', roofRD: '#8e3329', roofG: '#4f7d4a', roofB: '#3f5f86', roofS: '#6e7686', tin: '#9aa4ae', tinD: '#727c88',
  stone: '#a59a8c', stoneL: '#c4b9a8', stoneD: '#7d7266', brick: '#b0563e', brickD: '#8a3f2e', adobe: '#d9a873', adobeL: '#e8c090',
  white: '#efe6d2', cream: '#f3dfb0', paintB: '#5b8bc0', paintG: '#6aa067', paintY: '#e8b84a', paintR: '#c9543f', paintP: '#9a6bc0',
  iron: '#4b5468', ironL: '#6d7890', steel: '#9aa7b8', gold: '#f2c14a', goldD: '#c98f2a', copper: '#c87a48', verd: '#5fae9a',
  rock: '#a08a72', rockD: '#7b6654', rockR: '#a8664a', sand: '#e2c48e', coal: '#3a3438', grass: '#8f9a42', leaf: '#5d8f3e', leafD: '#41703a',
  cactus: '#5f9a4e', cactusD: '#467a3c', water: '#3f7fa8', crystal: '#56e0d0', glowW: '#ffcf7a', glowO: '#ff8a3a', glowT: '#5ff0e0', glowI: '#b8ecff',
  skin: '#e0a57a', skinD: '#b97c58', cloth: '#7a5a3e', denim: '#4f6a92', black: '#2b2830',
};
const COLS = {};
export const col = c => COLS[c] || (COLS[c] = new THREE.Color(PAL[c] || c));

// --- materials (shared by everything; color comes from the vertices) ----------------------------------------------
export const MAT = {
  solid: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .86, metalness: 0 }),
  metal: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .45, metalness: .55 }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true }),      // windows, furnaces, crystals: brighter at night, they bloom
  fire: new THREE.MeshBasicMaterial({ vertexColors: true }),      // always bright: flames, sparks, tracers
};
MAT.glow.color.setScalar(.6); MAT.fire.color.setScalar(2.2);

// --- a small seeded random so repeated buildings differ a little ---------------------------------------------------
export function rng(seed) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
/* A Kit collects parts; build() merges them by material into a Group. Positions are the part's base center (y = bottom). */
export class Kit {
  constructor(opt = {}) { this.parts = { solid: [], metal: [], glow: [], fire: [] }; this.ao = opt.ao !== false; this.aoH = opt.aoH || .9; }
  add(geo, x, y, z, c, o = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo; geo !== g && geo.dispose();
    if (g.attributes.uv) g.deleteAttribute('uv');
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'YXZ'); _q.setFromEuler(_e); _s.set(o.sx || 1, o.sy || 1, o.sz || 1); _p.set(x, y, z);
    _m.compose(_p, _q, _s); g.applyMatrix4(_m);
    const n = g.attributes.position.count, pos = g.attributes.position.array, cols = new Float32Array(n * 3), cc = col(c), mat = o.mat || 'solid';
    const ao = this.ao && o.ao !== false && mat !== 'fire' && mat !== 'glow';
    for (let i = 0; i < n; i++) {
      // ambient occlusion by height: parts darken toward the ground they stand on, which grounds every model
      const k = ao ? .64 + .36 * Math.min(1, Math.max(0, pos[i * 3 + 1] / this.aoH)) : 1, j = o.jit ? 1 + (o.jit * (((i * 7919) % 13) / 13 - .5)) : 1;
      cols[i * 3] = cc.r * k * j; cols[i * 3 + 1] = cc.g * k * j; cols[i * 3 + 2] = cc.b * k * j;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    this.parts[mat].push(g); return this;
  }
  // primitives (base at y)
  box(x, y, z, w, h, d, c, o) { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return this.add(g, x, y, z, c, o); }
  cyl(x, y, z, r, h, c, o = {}) { const g = new THREE.CylinderGeometry(o.r2 === undefined ? r : o.r2, r, h, o.seg || 8, 1, !!o.open); g.translate(0, h / 2, 0); return this.add(g, x, y, z, c, o); }
  cone(x, y, z, r, h, c, o = {}) { const g = new THREE.ConeGeometry(r, h, o.seg || 7); g.translate(0, h / 2, 0); return this.add(g, x, y, z, c, o); }
  ball(x, y, z, r, c, o = {}) { const g = new THREE.IcosahedronGeometry(r, o.det || 0); return this.add(g, x, y, z, c, o); }
  dode(x, y, z, r, c, o = {}) { const g = new THREE.DodecahedronGeometry(r, 0); return this.add(g, x, y, z, c, o); }
  torus(x, y, z, r, t, c, o = {}) { const g = new THREE.TorusGeometry(r, t, o.rs || 4, o.ts || 10); return this.add(g, x, y, z, c, o); }
  // a log lying along x (or rotated with ry)
  log(x, y, z, len, r, c, o = {}) { const g = new THREE.CylinderGeometry(r, r, len, o.seg || 6); g.rotateZ(Math.PI / 2); g.translate(0, r, 0); return this.add(g, x, y, z, c, o); }
  // gable roof: ridge along x, width w (x), depth d (z), height h; overhang included in w/d
  gable(x, y, z, w, d, h, c, o = {}) {
    const s = new THREE.Shape(); s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(0, h); s.lineTo(-d / 2, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false }); g.rotateY(Math.PI / 2); g.translate(-w / 2, 0, 0);
    return this.add(g, x, y, z, c, o);
  }
  // hip roof: a four-sided pyramid frustum
  hip(x, y, z, w, d, h, c, o = {}) { const g = new THREE.CylinderGeometry(Math.SQRT1_2 * (o.top || .25), Math.SQRT1_2, h, 4, 1); g.rotateY(Math.PI / 4); g.scale(w, 1, d); g.translate(0, h / 2, 0); return this.add(g, x, y, z, c, o); }
  // a gear lying in the x-y plane (facing +z), teeth as boxes
  gear(x, y, z, r, th, c, o = {}) {
    const n = o.teeth || 10, parts = [new THREE.CylinderGeometry(r, r, th, n * 2).rotateX(Math.PI / 2)];
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, t = new THREE.BoxGeometry(r * .32, r * .3, th); t.rotateZ(a); t.translate(Math.cos(a + Math.PI / 2) * r, Math.sin(a + Math.PI / 2) * r, 0); parts.push(t); }
    const g = mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p).map(p => { if (p.attributes.uv) p.deleteAttribute('uv'); return p; }));
    return this.add(g, x, y, z, c, o);
  }
  // a windowpane that glows at night, with a frame
  win(x, y, z, w, h, o = {}) {
    const f = o.frame || 'woodD', ry = o.ry || 0, dz = .012, cs = Math.cos(ry), sn = Math.sin(ry);
    this.box(x, y - .03, z, w + .06, h + .06, .03, f, { ry, ao: false });
    return this.box(x + sn * dz, y, z + cs * dz, w, h, .03, o.c || 'glowW', { ry, mat: 'glow' });
  }
  build(opt = {}) {
    const grp = new THREE.Group();
    for (const k in this.parts) {
      if (!this.parts[k].length) continue;
      const g = mergeGeometries(this.parts[k]); this.parts[k].forEach(p => p.dispose());
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, MAT[k]); m.castShadow = opt.cast !== false && k !== 'fire' && k !== 'glow'; m.receiveShadow = opt.receive !== false && k !== 'fire'; grp.add(m);
    }
    this.parts = { solid: [], metal: [], glow: [], fire: [] };
    return grp;
  }
}
/* Build a group from a recipe function f(kit) once, then hand out clones that share the geometry. */
const CACHE = new Map();
export function cached(key, make) { if (!CACHE.has(key)) CACHE.set(key, make()); return CACHE.get(key); }
export function part(make, opt) { const k = new Kit(opt); make(k); return k.build(opt); }
