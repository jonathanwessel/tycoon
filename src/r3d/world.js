/* The world around the town: a low-poly terrain carved by the road (and the river at Silver Falls), the raised yard
   with its fence, dunes and mesas beyond the board, scattered grass, a sky dome and flowing water.
   One map cell is one world unit: map x is world x, map y is world z, and y points up. */
import * as THREE from 'three';
import { Kit, MAT, col, rng } from './kit.js';
import { PROPS } from './units.js';

const lerp = (a, b, t) => a + (b - a) * t, sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x, z) { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz); return lerp(lerp(hash(ix, iz), hash(ix + 1, iz), u), lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), u), v); }
const fbm = (x, z) => noise(x, z) * .6 + noise(x * 2.1 + 5, z * 2.1) * .3 + noise(x * 4.3, z * 4.3 + 9) * .1;
// distance from a point to a polyline, and how far along it (for ruts and the water's flow)
function polyDist(px, pz, pts) { let best = 1e9, along = 0, run = 0, side = 0; for (let i = 0; i < pts.length - 1; i++) { const [x1, z1] = pts[i], [x2, z2] = pts[i + 1], dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz) || 1, t = Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / (L * L))), qx = x1 + dx * t, qz = z1 + dz * t, d = Math.hypot(px - qx, pz - qz); if (d < best) { best = d; along = run + t * L; side = ((px - x1) * dz - (pz - z1) * dx) / L; } run += L; } return { d: best, along, side }; }

export const TOWN_LOOK = {
  gulch: { far: ['#e6c08a', '#d8aa70', '#c99560'], mesa: ['#c8653f', '#a94f33', '#d98a55', '#e0a46c'], grass: '#9aa046', scrub: 'cactus' },
  ridge: { far: ['#a8988a', '#93857a', '#7d7168'], mesa: ['#7e7266', '#6a5f56', '#958775', '#a89880'], grass: '#8a8a5a', scrub: 'rock' },
  falls: { far: ['#9fb07a', '#8aa06a', '#7a9460'], mesa: ['#6e8f5a', '#5c7d4c', '#8aa870', '#a3b78a'], grass: '#6f9a48', scrub: 'tree' },
};

export function buildWorld(ctx) {
  const { COLS, ROWS, YARD, MAP, PATHS, TOWN_ID, TOWN, SLOT, TREES } = ctx;
  const look = TOWN_LOOK[TOWN_ID] || TOWN_LOOK.gulch, pal = MAP.pal || { yard: '#b99468', a: '#d0aa76', b: '#c9a26c', road: ['#7a5a3e', '#9b7552', '#8a6645', '#9b7552'] };
  const world = new THREE.Group(); world.name = 'world';
  // road and river as polylines in world units (cell centres), each extended off the board to the west
  const way = p => { const w = PATHS[p].way.map(([x, y]) => [x + .5, y + .5]); return [[-16, w[0][1]], ...w]; };
  const roads = PATHS.map((_, i) => i).filter(i => i !== MAP.river).map(way), river = MAP.river !== undefined ? way(MAP.river) : null;
  const roadAt = (x, z) => { let b = { d: 1e9 }; for (const r of roads) { const q = polyDist(x, z, r); if (q.d < b.d) b = q; } return b; };
  const boardD = (x, z) => Math.max(0 - x, x - COLS, 0 - z, z - ROWS, 0);
  function height(x, z) {
    const inside = x >= 0 && x <= COLS && z >= 0 && z <= ROWS;
    let h = z < YARD ? .22 : 0;
    if (!inside) {
      const d = boardD(x, z), base = lerp(.22, 0, sstep(YARD - .6, YARD + .6, z));
      h = base + sstep(1, 6, d) * (fbm(x * .18, z * .18) * 2.6 + (z < 0 ? Math.min(3, -z * .22) : 0) + d * .05);
    }
    if (z > YARD - .2 || !inside) {
      const r = roadAt(x, z); if (r.d < .62) h = lerp(-.06, h, sstep(.36, .62, r.d));
      if (river) { const q = polyDist(x, z, river); if (q.d < .7) h = lerp(-.34, h, sstep(.34, .7, q.d)); }
    }
    return h;
  }
  function colour(x, z, h) {
    const inside = x >= 0 && x <= COLS && z >= 0 && z <= ROWS, n = fbm(x * .7, z * .7), c = new THREE.Color();
    if (inside && z < YARD) c.copy(col(pal.yard)).multiplyScalar(.94 + n * .12);
    else { c.copy(col(pal.a)).lerp(col(pal.b), n); const pt = fbm(x * .23 + 40, z * .23); c.lerp(col(look.grass), sstep(.55, .8, pt) * .35).multiplyScalar(.9 + sstep(.3, .7, fbm(x * .4, z * .4 + 20)) * .16); }
    if (!inside) { const d = boardD(x, z), far = h > 1.6 ? look.far[2] : h > .7 ? look.far[1] : look.far[0]; c.lerp(col(far), sstep(.5, 4, d) * .85); }
    if (z > YARD - .2 || !inside) {
      const r = roadAt(x, z);
      if (r.d < .55) c.copy(col(pal.road[0]));
      if (river) { const q = polyDist(x, z, river); if (q.d < .58) c.copy(col(q.d < .4 ? '#35566a' : '#7a6a52')); }
    }
    return c;
  }
  // terrain: fine triangles on and next to the board, coarse ones further out (each triangle one flat colour)
  const pos = [], cols = [];
  const tri = (a, b, c2, k, sh) => { for (const p of [a, b, c2]) { pos.push(p[0], p[1], p[2]); cols.push(k.r * sh, k.g * sh, k.b * sh); } };
  const grid = (x0, z0, x1, z1, st, skip) => {
    const nx = Math.round((x1 - x0) / st), nz = Math.round((z1 - z0) / st), V = [];
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = x0 + i * st, z = z0 + j * st, jx = boardD(x, z) > 1.5 ? (hash(x, z) - .5) * st * .5 : 0, jz = boardD(x, z) > 1.5 ? (hash(z, x) - .5) * st * .5 : 0; V.push([x + jx, height(x + jx, z + jz), z + jz]); }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = x0 + i * st, z = z0 + j * st; if (skip && skip(x, z, st)) continue;
      const a = V[j * (nx + 1) + i], b = V[j * (nx + 1) + i + 1], c2 = V[(j + 1) * (nx + 1) + i], d = V[(j + 1) * (nx + 1) + i + 1];
      const k = colour(x + st / 2, z + st / 2, (a[1] + d[1]) / 2), s1 = 1 + (hash(x * 5, z) - .5) * .05, s2 = 1 + (hash(z, x * 5) - .5) * .05;
      if ((i + j) % 2) { tri(a, c2, b, k, s1); tri(b, c2, d, k, s2); } else { tri(a, c2, d, k, s1); tri(a, d, b, k, s2); }
    }
  };
  grid(-2, -2, COLS + 2, ROWS + 2, .25);
  grid(-30, -26, COLS + 30, ROWS + 22, 1, (x, z, st) => x >= -2 && x + st <= COLS + 2 && z >= -2 && z + st <= ROWS + 2);
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); tg.computeVertexNormals();
  const terrain = new THREE.Mesh(tg, MAT.solid); terrain.receiveShadow = true; terrain.name = 'terrain'; world.add(terrain);
  // the yard's front edge: a low stone bank and a rail fence
  const k = new Kit({ aoH: .5 });
  k.box(COLS / 2, -.2, YARD - .04, COLS + 4, .42, .1, 'stoneD', { jit: .15 });
  for (let x = -1.7; x <= COLS + 1.7; x += .75) k.box(x, .22, YARD - .1, .07, .32, .07, 'woodD', { ry: (hash(x, 1) - .5) * .2 });
  for (const y of [.33, .46]) k.box(COLS / 2, .22 + y - .22, YARD - .1, COLS + 3.4, .04, .035, 'wood');
  // a gap in the fence where the road would meet the yard is not needed: the road runs below it
  // mesas and buttes beyond the board: stacked strata, flat tops
  const R = rng(TOWN_ID.length * 13 + 5);
  const mesa = (x, z, r, h) => { const layers = 3 + Math.floor(R() * 3); let y = height(x, z) - .4; for (let i = 0; i < layers; i++) { const lh = h / layers, rr = r * (1 - i * .09); k.cyl(x, y, z, rr, lh, look.mesa[i % look.mesa.length], { r2: rr * .93, seg: 7, ry: R() * 3, jit: .1 }); y += lh; } k.cyl(x, y, z, r * (1 - layers * .09) * .95, .12, look.mesa[3], { seg: 7, r2: r * .6 }); };
  for (const [x, z, r, h] of [[-6, -9, 4, 4.2], [3, -12, 5, 5.5], [13, -10, 4.5, 4.8], [20, -5, 3, 3.6], [-11, -2, 3.2, 3.2], [24, 6, 3.5, 3], [-12, 12, 2.6, 2.4], [26, 16, 3, 2.6], [8, -16, 3, 6]]) mesa(x + (R() - .5) * 2, z + (R() - .5) * 2, r, h);
  // scrub, rocks and boulders around the board
  for (let i = 0; i < 70; i++) {
    const x = -12 + R() * (COLS + 24), z = -8 + R() * (ROWS + 18); if (boardD(x, z) < 1.2) continue;
    if (roadAt(x, z).d < .9 || (river && polyDist(x, z, river).d < 1)) continue;
    const y = height(x, z), t = R();
    if (t < .4) { k.dode(x, y + .08, z, .15 + R() * .35, R() < .5 ? 'rock' : 'rockD', { ry: R() * 3, sy: .7 }); }
    else if (look.scrub === 'cactus' && t < .7) { k.cyl(x, y, z, .08, .55 + R() * .4, 'cactus', { seg: 7 }); k.box(x + .12, y + .25, z, .15, .05, .05, 'cactusD'); k.cyl(x + .17, y + .25, z, .045, .22, 'cactus', { seg: 6 }); }
    else if (look.scrub === 'tree' && t < .75) { k.cyl(x, y, z, .07, .3, 'bark', { seg: 6 }); for (let j = 0; j < 3; j++) k.cone(x, y + .22 + j * .2, z, .4 - j * .1, .38, j % 2 ? 'leaf' : 'leafD', { seg: 7 }); }
    else k.ball(x, y + .08, z, .12 + R() * .1, look.grass, { sy: .6 });
  }
  const deco = k.build(); deco.name = 'deco'; world.add(deco);
  // grass tufts on the field and beyond: one instanced mesh
  const tuft = new THREE.ConeGeometry(.035, .16, 3); tuft.translate(0, .08, 0);
  const tufts = [], RG = rng(TOWN_ID.length * 7 + 1);
  for (let i = 0; i < 900 && tufts.length < 420; i++) {
    const x = -4 + RG() * (COLS + 8), z = YARD + .3 + RG() * (ROWS - YARD + 3), road = roadAt(x, z).d;
    if (road < .62 || (river && polyDist(x, z, river).d < .8) || (x > 0 && x < COLS && z > YARD && z < ROWS && RG() < .55)) continue;
    tufts.push([x, height(x, z), z, .7 + RG() * .8, RG() * 3]);
  }
  const im = new THREE.InstancedMesh(tuft, new THREE.MeshStandardMaterial({ color: look.grass, flatShading: true, roughness: 1 }), tufts.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  tufts.forEach(([x, y, z, s, r], i) => { q.setFromEuler(e.set((hash(x, z) - .5) * .5, r, (hash(z, x) - .5) * .5)); m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s * (.8 + hash(x, z)), s)); im.setMatrixAt(i, m); im.setColorAt(i, new THREE.Color(1, 1, 1).multiplyScalar(.75 + hash(x * 2, z) * .5)); });
  im.receiveShadow = true; world.add(im);
  // the road: smooth strips with wheel ruts, a little above the carved ground
  const strip = (pts, hw, y0) => { const P = [], U = []; let run = 0; for (let i = 0; i < pts.length - 1; i++) { const [x1, z1] = pts[i], [x2, z2] = pts[i + 1], L = Math.hypot(x2 - x1, z2 - z1), nx = -(z2 - z1) / L * hw, nz = (x2 - x1) / L * hw, ex = (x2 - x1) / L * hw, ez = (z2 - z1) / L * hw;
      const a = [x1 - ex + nx, z1 - ez + nz], b = [x1 - ex - nx, z1 - ez - nz], c2 = [x2 + ex + nx, z2 + ez + nz], d = [x2 + ex - nx, z2 + ez - nz], u0 = run - hw, u1 = run + L + hw, y = y0 + i * .0006;
      for (const [p, u, v] of [[a, u0, 0], [b, u0, 1], [c2, u1, 0], [b, u0, 1], [d, u1, 1], [c2, u1, 0]]) { P.push(p[0], y, p[1]); U.push(u, v); } run += L; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.computeVertexNormals(); return g; };
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTexture(pal), color: new THREE.Color(1.3, 1.25, 1.2), roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 });
  for (const r of roads) { const m = new THREE.Mesh(strip(r, .42, -.05), roadMat); m.receiveShadow = true; world.add(m); }
  // flowing water
  let water = null;
  if (river) {
    const wg = strip(river, .44, -.14);
    water = new THREE.Mesh(wg, waterMaterial()); water.receiveShadow = true; water.renderOrder = 1; world.add(water);
  }
  world.userData = { height, water };
  return world;
}

/* Packed dirt with two wheel ruts and scattered stones, repeating along the road. */
function roadTexture(pal) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d'), R = rng(9);
  g.fillStyle = pal.road[1]; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 70; i++) { g.fillStyle = R() < .5 ? pal.road[2] : pal.road[3]; g.fillRect(R() * 64, R() * 64, 2 + R() * 5, 2 + R() * 3); }
  g.fillStyle = pal.road[0]; for (const y of [17, 43]) { g.globalAlpha = .75; g.fillRect(0, y, 64, 5); g.globalAlpha = .35; g.fillRect(0, y - 2, 64, 9); } g.globalAlpha = 1;
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, 64, 3); g.fillRect(0, 61, 64, 3);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; return t;
}
/* The river: a moving ripple texture over a deep blue, brighter foam at the banks. */
function waterMaterial() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#4a8fb8'; g.fillRect(0, 0, 64, 64);
  const R = rng(3); for (let i = 0; i < 40; i++) { g.fillStyle = R() < .5 ? 'rgba(200,235,255,.55)' : 'rgba(30,80,120,.35)'; g.fillRect(R() * 64, R() * 64, 6 + R() * 14, 1.5); }
  const fg = g.createLinearGradient(0, 0, 0, 64); fg.addColorStop(0, 'rgba(230,245,255,.8)'); fg.addColorStop(.14, 'rgba(230,245,255,0)'); fg.addColorStop(.86, 'rgba(230,245,255,0)'); fg.addColorStop(1, 'rgba(230,245,255,.8)'); g.fillStyle = fg; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1, 1);
  return new THREE.MeshStandardMaterial({ map: t, roughness: .18, metalness: .1, transparent: true, opacity: .9, emissive: new THREE.Color('#0a2a40'), emissiveIntensity: .6 });
}

/* A sky dome: a gradient from the horizon to the zenith, recoloured with the time of day. */
export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#6fa8d6') }, mid: { value: new THREE.Color('#cfe2ea') }, bot: { value: new THREE.Color('#e8c99a') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'uniform vec3 top, mid, bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0. ? mix(mid, top, smoothstep(0., .55, h)) : mix(mid, bot, smoothstep(0., .25, -h)); gl_FragColor = vec4(c, 1.); }',
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(90, 24, 12), mat); m.frustumCulled = false; m.renderOrder = -1; return m;
}
