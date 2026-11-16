/* Interface icons rendered from the 3D models, so the menus show the same buildings, towers and raiders as the town.
   Each name in iconJobs() (src/art.js) is built with the same code the town uses, lit by a small scene of its own,
   framed by an orthographic camera fitted to its outline, and rendered offscreen at twice the icon size. The
   picture goes through the town's tone mapping (OutputPass), is read back, folded down to ICON_PX with hard edges
   and given the dark keyline the pixel sprites have, then swapped in with setIcon3d(). A few icons a frame, the
   ones for the town in play first; the models are thrown away after, only the pictures stay. */
import * as THREE from 'three';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeBuilding } from './buildings.js';
import { makeFoe, makeTower, makeVault, makeWorker, makeForeman, makeSoldier, makeDrone, makeWagon } from './units.js';
import { makeSite } from './capital3d.js';

export const ICON_PX = 48; // the icon's own pixels (shown at 16-28 CSS pixels, like the sprites)
const SS = 2; // rendered at twice that and folded down
const KEY = [42, 28, 34]; // the keyline, as in art.js
const VEHICLES = new Set(['runner', 'boss', 'boat', 'train', 'steamer', 'zeppelin']);
// [yaw, pitch] of the camera: a three-quarter view from the front left, a little lower for people
const VIEW = { bld: [-.62, .58], site: [-.62, .55], tower: [-.62, .5], foe: [-.5, .38], unit: [-.5, .38], vault: [-.9, .5], wagon: [-.62, .5] };
const I = { q: null, done: 0, bad: [], t0: 0, ms: 0 };

function model(j) {
  if (j.kind === 'bld') return makeBuilding(j.id, 0).obj; // tier 0: no milestone crates, barrels or lanterns around it
  if (j.kind === 'site') return makeSite(j.id, 1).obj;
  if (j.kind === 'tower') {
    const t = makeTower(j.id, j.br, j.br ? 4 : 1), h = t.userData.head;
    if (h && j.id !== 'tesla' && j.id !== 'frost') h.rotation.y = -2.6; // the barrel turned toward the viewer's left
    return t;
  }
  if (j.kind === 'foe') { const f = makeFoe(j.id); f.rotation.y = VEHICLES.has(j.id) ? -1.25 : -.45; return f; }
  if (j.kind === 'vault') return makeVault(2);
  if (j.kind === 'wagon') { const w = makeWagon('wagon'); w.rotation.y = -1.1; return w; }
  if (j.kind === 'unit') { const u = { worker: () => makeWorker('woodL'), foreman: makeForeman, soldier: makeSoldier, drone: makeDrone }[j.id](); u.rotation.y = -.45; return u; }
  throw new Error('no model for ' + j.kind);
}

function setup() {
  const n = ICON_PX * SS;
  I.scene = new THREE.Scene();
  I.scene.add(new THREE.HemisphereLight('#e6f0ff', '#a07c58', 1.8));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.8); sun.position.set(-5, 9, 6); I.scene.add(sun, sun.target);
  I.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 80);
  I.rtA = new THREE.WebGLRenderTarget(n, n, { type: THREE.HalfFloatType });
  I.rtB = new THREE.WebGLRenderTarget(n, n);
  I.out = new OutputPass();
  I.buf = new Uint8Array(n * n * 4);
  // own copies of the materials: the icon scene's lights (and no fog) would otherwise make the town's shaders recompile
  I.mats = new Map();
}
const mat = m => { let c = I.mats.get(m); if (!c) { c = m.clone(); I.mats.set(m, c); } return c; };

/* Fit the camera to the model's outline seen from the icon's angle (every vertex, so the icon fills its square). */
const _v = new THREE.Vector3(), _c = new THREE.Vector3();
function frame(obj, kind) {
  const [yaw, pitch] = VIEW[kind] || VIEW.bld, box = new THREE.Box3().setFromObject(obj); box.getCenter(_c);
  I.cam.position.set(_c.x + Math.sin(yaw) * Math.cos(pitch) * 30, _c.y + Math.sin(pitch) * 30, _c.z + Math.cos(yaw) * Math.cos(pitch) * 30);
  I.cam.lookAt(_c); I.cam.updateMatrixWorld();
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  obj.traverse(o => {
    if (!o.isMesh || !o.visible) return;
    const p = o.geometry.attributes.position, m = o.matrixWorld;
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i).applyMatrix4(m).applyMatrix4(I.cam.matrixWorldInverse);
      if (_v.x < x0) x0 = _v.x; if (_v.x > x1) x1 = _v.x; if (_v.y < y0) y0 = _v.y; if (_v.y > y1) y1 = _v.y;
    }
  });
  if (!(x1 > x0)) throw new Error('empty model');
  const half = Math.max(x1 - x0, y1 - y0) / 2 * 1.05, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  Object.assign(I.cam, { left: cx - half, right: cx + half, top: cy + half, bottom: cy - half, near: .1, far: 80 });
  I.cam.updateProjectionMatrix();
}

function renderOne(r, j) {
  const obj = model(j);
  obj.traverse(o => { if (o.isMesh) { o.material = mat(o.material); o.castShadow = false; } });
  I.scene.add(obj); obj.updateMatrixWorld(true);
  const prev = r.getRenderTarget(), cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha();
  try {
    frame(obj, j.kind);
    r.setRenderTarget(I.rtA); r.setClearColor(0x000000, 0); r.clear(); r.render(I.scene, I.cam);
    I.out.render(r, I.rtB, I.rtA); // tone mapping and sRGB, as the town gets them
    r.readRenderTargetPixels(I.rtB, 0, 0, ICON_PX * SS, ICON_PX * SS, I.buf);
  } finally {
    r.setRenderTarget(prev); r.setClearColor(cc, ca);
    I.scene.remove(obj); obj.traverse(o => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
  }
  return picture(I.buf);
}

/* Fold the 2x render down to hard-edged pixels (a pixel is solid when most of its samples are), add the keyline,
   and hand back a picture twice the size (so it stays crisp where an image is drawn smoothed). */
function picture(buf) {
  const P = ICON_PX, n = P * SS, c = document.createElement('canvas'); c.width = c.height = P;
  const g = c.getContext('2d'), im = g.createImageData(P, P), a = im.data, solid = new Uint8Array(P * P);
  for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) {
    let r = 0, gg = 0, b = 0, k = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const i = ((n - 1 - (y * SS + sy)) * n + x * SS + sx) * 4; // WebGL rows run bottom up
      if (buf[i + 3] > 127) { r += buf[i]; gg += buf[i + 1]; b += buf[i + 2]; k++; }
    }
    if (k * 2 < SS * SS) continue;
    const o = (y * P + x) * 4; a[o] = r / k; a[o + 1] = gg / k; a[o + 2] = b / k; a[o + 3] = 255; solid[y * P + x] = 1;
  }
  const on = (x, y) => x >= 0 && y >= 0 && x < P && y < P && solid[y * P + x];
  for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) if (!solid[y * P + x] && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) { const o = (y * P + x) * 4; a[o] = KEY[0]; a[o + 1] = KEY[1]; a[o + 2] = KEY[2]; a[o + 3] = 255; }
  g.putImageData(im, 0, 0);
  const big = document.createElement('canvas'); big.width = big.height = P * 2; const bg = big.getContext('2d'); bg.imageSmoothingEnabled = false; bg.drawImage(c, 0, 0, P * 2, P * 2);
  return big.toDataURL('image/png');
}

/* Called every frame by the 3D view: renders icons for up to `budget` milliseconds. */
export function iconsStep(r, budget = 5) {
  if (I.q === null) {
    if (typeof iconJobs !== 'function' || !SPR.coin) return; // the sprites are painted first: they are the fallback
    setup();
    const here = new Set(BUILD.map(b => b.def.id)), rank = j => j.kind === 'bld' && here.has(j.id) ? 0 : j.kind === 'tower' ? 1 : j.kind === 'bld' ? 3 : 2;
    I.q = iconJobs().filter(j => !ICON3D[j.name] && SPR[iconBase(j.name)]).sort((a, b) => rank(a) - rank(b));
    I.t0 = performance.now();
  }
  if (!I.q.length) return;
  const t = performance.now();
  do {
    const j = I.q.shift();
    try { setIcon3d(j.name, renderOne(r, j)); I.done++; } catch (e) { I.bad.push(j.name + ': ' + e.message); }
  } while (I.q.length && performance.now() - t < budget);
  I.ms += performance.now() - t;
  if (!I.q.length) { I.rtA.dispose(); I.rtB.dispose(); I.out.dispose(); for (const m of I.mats.values()) m.dispose(); I.mats.clear(); I.end = performance.now(); }
}
export const iconsInfo = () => ({ done: I.done, left: I.q ? I.q.length : -1, bad: I.bad.slice(), ms: Math.round(I.ms), wall: I.end ? Math.round(I.end - I.t0) : 0 });
