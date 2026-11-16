/* Copper Gulch 3D: the town drawn with three.js. The game's simulation (plain scripts sharing global state: S, foes,
   shots, parts, fx, SLOT...) runs unchanged; each frame this module mirrors that state into a scene of models built
   in code, lights it (sun and moon with soft shadows, sky light, up to 8 lamps and fires), and finishes it with bloom
   and the chosen colour look. The bridge in src/view.js owns the camera, picking and the flat overlay. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { MAT, col } from './kit.js';
import { makeBuilding, BUILDING_IDS } from './buildings.js';
import { makeFoe, makeTower, makeVault, makeWorker, makeForeman, makeWagon, makeSoldier, makeDrone, PROPS } from './units.js';
import { buildWorld, makeSky } from './world.js';

const V = {}; // everything this renderer keeps
const G_DRONE = []; // drone tracers this frame: [x, y, z, length, yaw, pitch]
const v3 = (x, y, z) => new THREE.Vector3(x, y, z), TAU = Math.PI * 2;
const NLIGHTS = 8, PCAP = 900;

/* --- grading: the colour looks (saturation, contrast, tint, lift, vignette, grain) after tone mapping ---------- */
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uSat: { value: 1 }, uCon: { value: .1 }, uTint: { value: v3(1, 1, 1) }, uLift: { value: v3(0, 0, 0) }, uVig: { value: .3 }, uGrain: { value: 0 }, uTime: { value: 0 }, uFlash: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSat, uCon, uVig, uGrain, uTime, uFlash; uniform vec3 uTint, uLift; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float l = dot(c, vec3(.299, .587, .114));
      c = mix(vec3(l), c, uSat); c = (c - .5) * (1. + uCon * .6) + .5; c = c * uTint + uLift;
      vec2 d = vUv - .5; c *= 1. - uVig * smoothstep(.25, .85, length(d * vec2(1., 1.15)));
      c += (h(vUv * 917. + uTime) - .5) * uGrain; c = mix(c, vec3(1., .44, .4), uFlash);
      gl_FragColor = vec4(clamp(c, 0., 1.), 1.); }`,
};

function setup() {
  const c = document.createElement('canvas'); c.id = 'g3'; c.setAttribute('aria-hidden', 'true'); c.hidden = true;
  let r;
  try { r = new THREE.WebGLRenderer({ canvas: c, antialias: false, powerPreference: 'high-performance', stencil: false }); } catch (e) { console.warn('3D view unavailable:', e.message); return null; }
  if (!r.capabilities.isWebGL2) { r.dispose(); return null; }
  r.setPixelRatio(1); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = 1; r.outputColorSpace = THREE.SRGBColorSpace;
  V.r = r; V.canvas = c; V.scene = new THREE.Scene(); V.cam = new THREE.PerspectiveCamera(35, 1, .5, 200);
  V.scene.fog = new THREE.Fog('#cfe2ea', 34, 95);
  V.sky = makeSky(); V.scene.add(V.sky);
  V.hemi = new THREE.HemisphereLight('#cfe6ff', '#b08a5e', 1.1); V.scene.add(V.hemi);
  V.sun = new THREE.DirectionalLight('#fff1d6', 2.4); V.sun.castShadow = true; V.scene.add(V.sun, V.sun.target);
  const sc = V.sun.shadow.camera; sc.left = -11; sc.right = 11; sc.top = 11; sc.bottom = -11; sc.near = 1; sc.far = 70; V.sun.shadow.bias = -.0006; V.sun.shadow.normalBias = .02; V.sun.shadow.radius = 3;
  V.lamps = []; for (let i = 0; i < NLIGHTS; i++) { const l = new THREE.PointLight('#ffb070', 0, 3, 1.6); V.scene.add(l); V.lamps.push(l); }
  V.dyn = new THREE.Group(); V.scene.add(V.dyn);
  // pools
  V.bld = {}; V.towers = new Map(); V.foes = new Map(); V.pool = {}; V.corpses = new Map(); V.workers = new Map(); V.convoys = new Map(); V.smoke = [];
  V.foremen = []; V.zOf = new WeakMap();
  // instanced particles: lit chunks (smoke, dust, debris, coins) and glowing ones (sparks, tracers, bolts, fireflies, rain)
  const ig = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; m.frustumCulled = false; m.setColorAt(0, new THREE.Color()); V.scene.add(m); return m; };
  V.pSolid = ig(new THREE.IcosahedronGeometry(.5, 0), new THREE.MeshStandardMaterial({ flatShading: true, roughness: .9 }), PCAP);
  V.pGlow = ig(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: true }), PCAP);
  V.pCoin = ig(new THREE.CylinderGeometry(.5, .5, .2, 10).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#f2c14a', metalness: .7, roughness: .3, emissive: '#5a3a00', emissiveIntensity: .5 }), 120);
  V.pSolid.castShadow = true; V.pCoin.castShadow = true;
  V.scorch = ig(new THREE.CircleGeometry(.5, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#2a1c18', transparent: true, opacity: .45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), 30);
  // explosions and frost rings
  V.booms = []; V.rings = [];
  V.boomGeo = new THREE.IcosahedronGeometry(1, 1); V.ringGeo = new THREE.TorusGeometry(1, .05, 4, 32).rotateX(Math.PI / 2);
  V.flashM = new THREE.MeshBasicMaterial({ color: '#ffffff' }); V.slowM = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, color: '#9fd8ff', emissive: '#1a4a6a', roughness: .5 }); V.psnM = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, color: '#a8ff7a', emissive: '#1e4a10', roughness: .6 }); V.jamM = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, color: '#777777', roughness: 1 });
  c.addEventListener('webglcontextlost', e => { e.preventDefault(); if (window.R3) { R3.on = false; R3.ok = false; } c.hidden = true; });
  V.quality = -1; V.key = '';
  return c;
}

/* Quality: shadow map size, bloom, antialiasing follow the graphics settings. */
function applyQuality(W, H) {
  const g = GX(), q = [g.shadow, g.bloom, g.preset, W, H].join();
  if (q === V.quality) return; V.quality = q;
  V.sun.castShadow = g.shadow > 0;
  const ms = [0, 1024, 2048, 4096][g.shadow] || 1024; if (V.sun.shadow.mapSize.x !== ms) { V.sun.shadow.mapSize.set(ms, ms); if (V.sun.shadow.map) { V.sun.shadow.map.dispose(); V.sun.shadow.map = null; } }
  V.r.shadowMap.type = g.shadow >= 2 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  if (V.composer) V.composer.dispose();
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: g.preset === 'low' || g.preset === 'med' ? 0 : 4 });
  V.composer = new EffectComposer(V.r, rt); V.composer.setPixelRatio(1); V.composer.setSize(W, H);
  V.composer.addPass(new RenderPass(V.scene, V.cam));
  V.bloom = new UnrealBloomPass(new THREE.Vector2(Math.max(1, W / 2), Math.max(1, H / 2)), .5, .55, .82); V.bloom.enabled = g.bloom > 0; V.composer.addPass(V.bloom);
  V.composer.addPass(new OutputPass());
  V.grade = new ShaderPass(GradeShader); V.composer.addPass(V.grade);
}
function resize(W, H) { if (!V.r) return; V.r.setSize(W, H, false); V.quality = -1; applyQuality(W, H); }

/* --- the world and buildings, rebuilt when the town changes ---------------------------------------------------- */
function rebuildWorld() {
  if (V.world) { V.scene.remove(V.world); disposeTree(V.world); }
  for (const id in V.bld) { V.dyn.remove(V.bld[id].obj); } V.bld = {};
  for (const [, t] of V.towers) V.dyn.remove(t.obj); V.towers.clear();
  for (const [, f] of V.foes) V.dyn.remove(f.obj); V.foes.clear();
  for (const [, f] of V.corpses) V.dyn.remove(f.obj); V.corpses.clear();
  V.world = buildWorld({ COLS, ROWS, YARD, MAP, PATHS, TOWN_ID, TOWN, SLOT, TREES });
  V.scene.add(V.world);
  // tap areas: trees (or the quarry face / sand dunes) and rocks
  V.taps = new THREE.Group(); V.world.add(V.taps);
  const [tx, ty] = SLOT.trees, [rx, ry] = SLOT.rocks, treeKind = TOWN.trees ? 'tree' : TOWN_ID === 'falls' ? 'dune' : 'boulder';
  V.tapTrees = []; V.tapRocks = [];
  for (const [x, y, s] of TREES) { const o = PROPS[treeKind](s, x * 10 + y); o.position.set(tx + x, .22, ty + y + .3); o.scale.setScalar(s * (treeKind === 'tree' ? 1 : .85)); V.taps.add(o); V.tapTrees.push(o); }
  const rk = TOWN_ID === 'ridge' ? 'rockR' : TOWN_ID === 'falls' ? 'rockV' : 'rock';
  for (const [x, y, s] of [[.55, .75, .8], [1.45, .6, .95], [1, 1.4, .85]]) { const o = PROPS[rk](s, x * 7 + y); o.position.set(rx + x, .22, ry + y + .2); o.scale.setScalar(s * 1.3); V.taps.add(o); V.tapRocks.push(o); }
  // cacti and props on plots (hidden under towers)
  V.decor = [];
  for (const [x, y] of CACTI) { const o = PROPS.cactus(1, x * 13 + y); o.position.set(x + .35, 0, y + .45); o.rotation.y = x * 1.3; V.world.add(o); V.decor.push({ o, x, y }); }
  for (const [x, y, kind, r] of DECOR) { const o = PROPS[kind] ? PROPS[kind]() : PROPS.crate(); o.position.set(x + .3 + r * .4, 0, y + .55); o.rotation.y = r * 6; V.world.add(o); V.decor.push({ o, x, y }); }
  V.vault = null; V.vaultBands = -1; V.weeds = new Map();
  V.key = TOWN_ID + MAP.n;
}
function disposeTree(o) { o.traverse(m => { if (m.isMesh && m.geometry && !m.userData.shared) m.geometry.dispose(); }); }
const tierOf = id => { const l = blv(id); return l ? Math.min(4, MS(l)) : -1; };
function syncBuildings(time, dt) {
  const ids = [...BUILD.map(b => b.def.id), 'market', 'hall', 'office', 'caravan'].filter(id => SLOT[id]);
  for (const id of ids) {
    const fixed = id === 'market' || id === 'hall' || id === 'office' || id === 'caravan', tier = fixed ? 0 : tierOf(id), key = tier < 0 ? '_lot' : id + tier;
    let b = V.bld[id];
    if (!b || b.key !== key) {
      if (b) { V.dyn.remove(b.obj); }
      const m = makeBuilding(tier < 0 ? '_lot' : id, Math.max(0, tier)); m.key = key; m.obj.position.set(SLOT[id][0] + 1, .22, SLOT[id][1] + 1); V.dyn.add(m.obj); V.bld[id] = b = m;
      if (V.bldSeen && tier >= 0) b.grow = .5; // a new building rises out of the ground
    }
    const act = (ACT[id] || 0) > .08 || fixed;
    // the build pop and the rise of a new building
    let s = 1; if (FXS.pop[id] > 0) s = 1 + Math.sin((1 - FXS.pop[id] / .45) * Math.PI * 2.5) * FXS.pop[id] * .25;
    if (b.grow > 0) { b.grow = Math.max(0, b.grow - dt); const p = 1 - b.grow / .5; s *= p < 1 ? .3 + .7 * (1 - Math.pow(1 - p, 3)) + Math.sin(p * Math.PI) * .08 : 1; }
    b.obj.scale.set(1 + (s - 1) * .6, s, 1 + (s - 1) * .6);
    for (const m of b.movers) {
      const n = m.node;
      if (m.kind === 'spin') { if (act || m.axis === 'z' && id === 'clockw') n.rotation[m.axis] += m.speed * dt * (act ? 1 : .15); }
      else if (m.kind === 'hot') { n.visible = act; if (act) n.scale.setScalar(.9 + Math.sin(time * 13 + n.id) * .08); }
      else if (m.kind === 'cart') n.position.z = m.node.userData.z0 === undefined ? (m.node.userData.z0 = n.position.z) : m.node.userData.z0 + (act ? Math.sin(time * 1.3) * .22 : 0);
      else if (m.kind === 'swing') n.rotation.y = act ? Math.sin(time * .7) * .9 : n.rotation.y;
      else if (m.kind === 'flag') n.rotation.y = Math.sin(time * 3 + id.length) * .35 + .2;
      else if (m.kind === 'bob') { n.position.y = m.y0 + Math.abs(Math.sin(time * 2.2)) * .03; n.rotation.y = Math.sin(time * .6) * .5; }
      else if (m.kind === 'belt') { for (const c of n.children) c.position.x = act ? ((time * .2) % .16) : 0; }
      else if (m.kind === 'glow') n.scale.setScalar(act ? 1 + Math.sin(time * 4) * .04 : .96);
      else if (m.kind === 'blink') n.visible = Math.floor(time * 1.5) % 2 === 0;
    }
    // chimney smoke while it works
    if (act && !fixed && GX().parts > 0 && !REDUCED) for (const sm of b.smoke) if (Math.random() < dt * 4) puff(b.obj.position.x + sm.x, b.obj.position.y + sm.y * s, b.obj.position.z + sm.z, id === 'smelt' || id === 'mill' || id === 'blast' ? '#5a5466' : '#dcd6c8', .14);
  }
  V.bldSeen = true;
}
function puff(x, y, z, c, s, o = {}) { if (V.smoke.length < 260) V.smoke.push({ x, y, z, vx: .12 + Math.random() * .12 + (o.vx || 0), vy: o.vy || .5, vz: (Math.random() - .5) * .1, t: o.t || 1.6, t0: o.t || 1.6, s, c: col(c) }); }

/* --- towers ------------------------------------------------------------------------------------------------- */
function setMat(obj, mat) { obj.traverse(o => { if (o.isMesh) { if (!o.userData.m0) o.userData.m0 = o.material; o.material = mat || o.userData.m0; } }); }
function syncTowers(time, dt) {
  const seen = new Set();
  for (const t of S.towers) {
    seen.add(t); const key = t.type + (t.br || '') + Math.min(t.lvl, 8) + (t.lvl >= 3) + (t.lvl >= 6);
    let v = V.towers.get(t);
    if (!v || v.key !== key) { if (v) V.dyn.remove(v.obj); const obj = makeTower(t.type, t.br, t.lvl); v = { obj, key, s: obj.scale.x, mat: null }; V.dyn.add(obj); V.towers.set(t, v); }
    const u = v.obj.userData, kick = t.kick > 0 ? t.kick / .12 : 0, born = t.born > 0 ? 1 - t.born / .35 : 1;
    v.obj.position.set(t.c + .5, 0, t.r + .5);
    const bs = born < 1 ? (1 - Math.pow(1 - born, 3)) * (1 + Math.sin(born * Math.PI) * .25) : 1; v.obj.scale.setScalar(v.s * Math.max(.01, bs));
    if (t.type !== 'tesla' && t.type !== 'frost') u.head.rotation.y = -(t.aim || 0);
    u.bar.position.x = -kick * .09;
    if (u.spin) u.spin.rotation.x += dt * (t.cd < .4 || kick > 0 ? 30 : 0);
    if (u.float) { u.bar.position.y = Math.sin(time * 2 + t.c) * .05; u.bar.rotation.y += dt * .8; }
    if (t.type === 'tesla') u.bar.scale.setScalar(1 + kick * .35 + Math.sin(time * 9 + t.r) * .04);
    const want = t.jam > 0 ? V.jamM : null; if (v.mat !== want) { setMat(v.obj, want); v.mat = want; }
  }
  for (const [t, v] of V.towers) if (!seen.has(t)) { V.dyn.remove(v.obj); V.towers.delete(t); }
  for (const d of V.decor) d.o.visible = !S.towers.some(t => t.c === d.x && t.r === d.y);
}

/* --- raiders, corpses, porters, foremen, convoys --------------------------------------------------------------- */
const foeKind = f => f.type === 'boss' ? TOWN.boss.spr : f.type;
function take(kind) { const p = V.pool[kind]; const o = p && p.length ? p.pop() : makeFoe(kind); o.visible = true; V.dyn.add(o); return o; }
function give(kind, o) { V.dyn.remove(o); setMat(o, null); o.rotation.set(0, 0, 0); (V.pool[kind] = V.pool[kind] || []).push(o); }
function ground(x, z) { const h = V.world.userData.height; return Math.max(-.06, h(x, z)); }
function animatePerson(o, phase, speed, still) {
  const u = o.userData, a = still ? 0 : Math.sin(phase) * (u.gallop ? .7 : .55);
  if (u.legs) u.legs.forEach((l, i) => { l.rotation.x = u.gallop ? Math.sin(phase + (i < 2 ? 0 : Math.PI) + (i % 2) * .6) * .7 * (still ? 0 : 1) : (i % 2 ? a : -a); });
  if (u.body && !u.gallop) u.body.position.y = still ? 0 : Math.abs(Math.cos(phase)) * .025;
  if (u.wheels) for (const w of u.wheels) w.rotation.x += speed;
  if (u.oars) u.oars.forEach((oar, i) => { oar.rotation.y = Math.sin(phase * .6) * .5 * (i ? 1 : -1); oar.rotation.x = Math.cos(phase * .6) * .15; });
}
function syncFoes(time, dt) {
  const seen = new Set();
  for (const f of foes) {
    seen.add(f); const kind = foeKind(f), D = FOES[f.type];
    let v = V.foes.get(f);
    if (!v) { v = { obj: take(kind), kind, ph: Math.random() * 6, mat: null, x: f.x, z: f.y }; V.foes.set(f, v); }
    const o = v.obj, [nx, ny] = posAt(f.d + .08, f.p), dx = nx - f.x, dz = ny - f.y, moved = Math.hypot(f.x - v.x, f.y - v.z);
    v.x = f.x; v.z = f.y;
    const boat = o.userData.boat, x = f.x + .5, z = f.y + .5, y = boat ? -.16 + Math.sin(time * 2.4 + v.ph) * .025 : ground(x, z);
    o.position.set(x, y, z);
    if (Math.abs(dx) + Math.abs(dz) > .001) { const want = Math.atan2(dx, dz); let d = want - o.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); o.rotation.y += d * Math.min(1, dt * 10); }
    if (boat) o.rotation.z = Math.sin(time * 1.8 + v.ph) * .05;
    const sc = D.size / (kind === 'boss' || kind === 'train' || kind === 'steamer' ? 1.05 : kind === 'boat' ? .9 : .82); o.scale.setScalar(sc);
    const still = f.stun > 0; v.ph += still ? 0 : moved * (kind === 'runner' ? 9 : 14) / Math.max(.4, sc);
    animatePerson(o, v.ph, still ? 0 : moved / .16, still);
    if (f.type === 'runner' || f.type === 'thief') o.position.y += Math.abs(Math.sin(v.ph)) * .03;
    if (o.userData.shield) o.userData.shield.visible = !(f.sh <= 0);
    if (o.userData.spark) o.userData.spark.visible = Math.floor(time * 12) % 2 === 0;
    const want = f.flash > 0 ? V.flashM : f.slow > 0 || f.frz > 0 || (f.psn && f.psn.t > 0 && f.psn.ice) ? V.slowM : f.psn && f.psn.t > 0 ? V.psnM : null; if (v.mat !== want) { setMat(o, want); v.mat = want; }
    if (o.userData.smoke && Math.random() < dt * (f.rage ? 14 : 5) && GX().parts > 0) { const p = o.userData.smoke.clone().multiplyScalar(sc).applyAxisAngle(v3(0, 1, 0), o.rotation.y).add(o.position); puff(p.x, p.y, p.z, f.rage ? '#4a4450' : '#e8e2d6', .12, { t: 1.2 }); }
  }
  for (const [f, v] of V.foes) if (!seen.has(f)) {
    V.foes.delete(f);
    // the model falls where the raider died, if the game kept a corpse for it
    const k = corpses.find(c => !V.corpses.has(c) && Math.abs(c.x - f.x) < .05 && Math.abs(c.y - f.y) < .05);
    if (k) { setMat(v.obj, null); V.corpses.set(k, v); } else give(v.kind, v.obj);
  }
  for (const [k, v] of V.corpses) {
    if (!corpses.includes(k)) { V.corpses.delete(k); give(v.kind, v.obj); continue; }
    const p = 1 - k.t / .8, o = v.obj; o.rotation.x = Math.min(1.45, p * 4) * (o.userData.boat ? .3 : 1); o.position.y -= dt * (p > .6 ? .5 : 0); animatePerson(o, 0, 0, true);
  }
  // drones over their helipads
  V.drones = V.drones || new Map(); const dn = new Set();
  for (const t of S.towers) if (t.drone && TOWERS[t.type].drone) {
    dn.add(t); let o = V.drones.get(t); if (!o) { o = makeDrone(); V.dyn.add(o); V.drones.set(t, o); }
    const d = t.drone, fly = d.mode === 'fly' || d.mode === 'home'; o.position.set(d.x + .5, (fly ? 1.15 : .22) + (fly ? Math.sin(time * 5 + t.c) * .05 : 0), d.y + .5);
    const f = DRONE_T.get(t); if (f && fly) o.rotation.y = Math.atan2(f.x - d.x, f.y - d.y); o.rotation.x = fly ? .15 : 0;
    for (const pr of o.userData.props) pr.rotation.y += dt * (fly ? 60 : d.mode === 'charge' ? 6 : 20);
    if (d.fire > 0 && f) { const ax = d.x + .5, az = d.y + .5, bx = f.x + .5, bz = f.y + .5, L = Math.hypot(bx - ax, bz - az, .8); G_DRONE.push([(ax + bx) / 2, (o.position.y + .35) / 2, (az + bz) / 2, L, -Math.atan2(bz - az, bx - ax), Math.atan2(o.position.y - .35, Math.hypot(bx - ax, bz - az))]); }
  }
  for (const [t, o] of V.drones) if (!dn.has(t)) { V.dyn.remove(o); V.drones.delete(t); }
  // soldiers from the barracks
  V.troops = V.troops || new Map(); const ts = new Set();
  for (const q of troops) {
    ts.add(q); let v = V.troops.get(q);
    if (!v) { const o = makeSoldier(); o.traverse(m => { if (m.isMesh) m.castShadow = true; }); o.scale.setScalar(.7); V.dyn.add(o); v = { obj: o, ph: Math.random() * 6, x: q.x, z: q.y }; V.troops.set(q, v); }
    const o = v.obj, tx = q.f ? q.f.x - q.x : (q.dir || 1); o.position.set(q.x + .5, ground(q.x + .5, q.y + .5), q.y + .5);
    if (q.f) o.rotation.y = Math.atan2(q.f.x - q.x, q.f.y - q.y); else if (q.walk) o.rotation.y = Math.atan2(tx, 0.0001);
    v.ph += Math.hypot(q.x - v.x, q.y - v.z) * 22 + (q.fight ? dt * 14 : 0); v.x = q.x; v.z = q.y; animatePerson(o, v.ph, 0, !q.walk && !q.fight);
    if (q.fight) o.userData.body.rotation.x = Math.sin(time * 14 + q.slot) * .25; else o.userData.body.rotation.x = 0;
  }
  for (const [q, v] of V.troops) if (!ts.has(q)) { V.dyn.remove(v.obj); V.troops.delete(q); }
  // porters
  const ws = new Set();
  for (const w of workers) {
    ws.add(w); let v = V.workers.get(w);
    if (!v) { const o = makeWorker(ITEM_COL[w.k] || 'woodL'); o.traverse(m => { if (m.isMesh) m.castShadow = true; }); V.dyn.add(o); v = { obj: o, ph: Math.random() * 6, x: w.x, z: w.y }; V.workers.set(w, v); }
    const o = v.obj, dx = w.tx - w.x, dz = w.ty - w.y; o.position.set(w.x, .22, w.y); o.scale.setScalar(.62);
    if (Math.abs(dx) + Math.abs(dz) > .01) o.rotation.y = Math.atan2(dx, dz);
    v.ph += Math.hypot(w.x - v.x, w.y - v.z) * 22; v.x = w.x; v.z = w.y; animatePerson(o, v.ph, 0, false);
  }
  for (const [w, v] of V.workers) if (!ws.has(w)) { V.dyn.remove(v.obj); V.workers.delete(w); }
  // foremen stand by the door of each building they run
  const ids = Object.keys(S.mgr).filter(id => SLOT[id] && blv(id));
  while (V.foremen.length < ids.length) { const o = makeForeman(); o.traverse(m => { if (m.isMesh) m.castShadow = true; }); o.scale.setScalar(.62); V.dyn.add(o); V.foremen.push(o); }
  V.foremen.forEach((o, i) => { const id = ids[i]; o.visible = !!id; if (!id) return; o.position.set(SLOT[id][0] + 1.72, .22, SLOT[id][1] + 1.7); o.rotation.y = Math.sin(time * .5 + i) * .4; o.userData.body.rotation.z = Math.sin(time * 1.4 + i) * .03; });
  // convoys along the yard's back road
  const cs = new Set(), ck = carrier().spr;
  for (const c of FXS.convoys || []) {
    cs.add(c); let v = V.convoys.get(c);
    if (!v || v.kind !== ck) { if (v) V.dyn.remove(v.obj); v = { obj: makeWagon(ck), kind: ck, x: c.x }; V.dyn.add(v.obj); V.convoys.set(c, v); }
    v.obj.position.set(c.x, .22, 3.5); v.obj.rotation.y = c.out ? Math.PI / 2 : -Math.PI / 2; animatePerson(v.obj, 0, Math.abs(c.x - v.x) / .1, false); v.x = c.x;
    if (v.obj.userData.smoke && Math.random() < dt * 6) { const p = v.obj.userData.smoke.clone().applyAxisAngle(v3(0, 1, 0), v.obj.rotation.y).add(v.obj.position); puff(p.x, p.y, p.z, '#e8e2d6', .1); }
  }
  for (const [c, v] of V.convoys) if (!cs.has(c)) { V.dyn.remove(v.obj); V.convoys.delete(c); }
  // tumbleweeds roll across the field
  const wd = new Set();
  for (const w of weeds) { wd.add(w); let o = V.weeds.get(w); if (!o) { o = PROPS.weed(); V.world.add(o); V.weeds.set(w, o); } o.position.set(w.x, ground(w.x, w.y) + Math.abs(Math.sin(w.a * 1.3)) * .12, w.y); o.rotation.z = -w.a; }
  for (const [w, o] of V.weeds) if (!wd.has(w)) { V.world.remove(o); V.weeds.delete(w); }
}
const ITEM_COL = { wood: 'log', ore: 'rockD', crystal: 'crystal', coal: 'coal', plank: 'plank', ingot: 'steel', lens: 'glowT', gear: 'gold', engine: 'iron', steel: 'steel', clock: 'gold', auto: 'steel', iron: 'rockR', stone: 'stoneL', pig: 'ironL', rail: 'steel', boiler: 'ironL', loco: 'black', cu: 'copper', sand: 'sand', copper: 'copper', wire: 'copper', glassp: 'verd', bulb: 'glowW', tele: 'woodD' };

/* --- shots, particles, effects ------------------------------------------------------------------------------ */
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = v3(1, 1, 1), _p = v3(0, 0, 0), _c = new THREE.Color();
function inst(im, i, x, y, z, sx, sy, sz, ry, c, rx = 0) { _p.set(x, y, z); _q.setFromEuler(_e.set(rx, ry, 0)); _s.set(sx, sy, sz); _m.compose(_p, _q, _s); im.setMatrixAt(i, _m); im.setColorAt(i, c); }
function syncFx(time, dt) {
  let ns = 0, ng = 0, nc = 0;
  const S_ = (x, y, z, s, c, ry = 0) => { if (ns < PCAP) inst(V.pSolid, ns++, x, y, z, s, s, s, ry, c); };
  const G_ = (x, y, z, sx, sy, sz, c, ry = 0, rx = 0) => { if (ng < PCAP) inst(V.pGlow, ng++, x, y, z, sx, sy, sz, ry, c, rx); };
  // shots: bolts and bullets fly flat, cannonballs arc
  for (const s of shots) {
    const x = s.x + .5, z = s.y + .5, ry = -(s.ang || 0);
    if (s.kind === 'flask') { const lift = Math.sin((1 - Math.min(1, s.q / s.q0 || 0)) * Math.PI) * .9; G_(x, .5 + lift, z, .1, .14, .1, _c.setRGB(.6, 1.6, .5), time * 9, time * 7); continue; }
    if (s.kind === 'ball') { const lift = Math.sin((1 - Math.min(1, s.q / s.q0 || 0)) * Math.PI) * .7; S_(x, .45 + lift, z, .15, col('black')); }
    else if (s.kind === 'bullet') G_(x, .42, z, .26, .03, .03, _c.setRGB(3, 2.4, 1.2), ry);
    else { G_(x, .55, z, .34, .035, .035, col('woodL'), ry); G_(x + Math.cos(s.ang || 0) * .17, .55, z + Math.sin(s.ang || 0) * .17, .06, .06, .06, _c.setRGB(1.6, 1.6, 1.6), ry); }
  }
  // the game's particles move in map x and y; on screen "up" becomes height, the ground spot stays where it began
  for (const p of parts) {
    let z0 = V.zOf.get(p); if (z0 === undefined) { z0 = p.y; V.zOf.set(p, z0); if (p.smoke && p.y < YARD + .2 && p.vy < -.5) p.skip = 1; }
    if (p.skip) continue;
    const h = Math.max(.03, .25 + (z0 - p.y)), c = p.c && p.c[0] === '#' ? col(p.c) : col('white');
    if (p.smoke) { const sz = p.s * (2.6 - p.t) * 1.2; S_(p.x, h, z0 + (p.t - 1) * .05, sz, c); }
    else if (p.t > 0) { const sz = (p.s || .08) * 1.15; if (/^#f[0-9a-f]/i.test(p.c || '') || p.c === P.yel || p.c === P.yelL || p.c === P.org) G_(p.x, h, z0, sz, sz, sz, _c.copy(c).multiplyScalar(1.6), p.x * 9); else S_(p.x, h, z0, sz, c, p.x * 9); }
  }
  for (const cl of clouds) { const k = Math.min(1, cl.t / .8, (cl.t0 - cl.t) * 4); for (let i = 0; i < 7; i++) { const a = i * .9 + time * .5, rr = cl.r * (.25 + .5 * ((i * 37) % 10) / 10); S_(cl.x + .5 + Math.cos(a) * rr, .2 + (i % 3) * .12 + Math.sin(time * 2 + i) * .04, cl.y + .5 + Math.sin(a) * rr, cl.r * .55 * k, cl.zap > 0 ? col('#d8ff8a') : col(i % 2 ? '#7cc24a' : '#5fae5a'), a); } }
  for (const p of tars) if (p.burn > 0) for (let i = 0; i < 6; i++) { const a = i * 1.05 + time * 3; G_(p.x + .5 + Math.cos(a) * p.r * .5, .12 + Math.abs(Math.sin(time * 9 + i)) * .25, p.y + .5 + Math.sin(a) * p.r * .35, .1, .2 + Math.random() * .15, .1, _c.setRGB(3, 1.3, .3)); }
  for (const [x, y, z, L, ry, rz] of G_DRONE.splice(0)) G_(x, y, z, L, .03, .03, _c.setRGB(3, 2.5, 1.2), ry, 0);
  // chimney smoke grows and fades
  for (const q of V.smoke) { q.t -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vy *= 1 - dt * .3; }
  V.smoke = V.smoke.filter(q => q.t > 0);
  for (const q of V.smoke) { const a = 1 - q.t / q.t0, s = q.s * (.6 + a * 2.2) * (q.t < .3 ? q.t / .3 : 1); S_(q.x, q.y, q.z, s, _c.copy(q.c).multiplyScalar(1 - a * .25), q.x * 3); }
  // coins hop out of fallen raiders
  for (const d of drops) if (nc < 120) inst(V.pCoin, nc++, d.x, .08 + d.z * .6, d.y, .14, .14, .14, time * 6, col('gold'));
  // dynamite thrown at the vault
  for (const b of bombs) { const pr = 1 - b.t / .7, x = VAULT[0] + (b.x - VAULT[0]) * pr + .5, z = VAULT[1] + (b.y - VAULT[1]) * pr + .5, y = .3 + Math.sin(pr * Math.PI) * 2; S_(x, y, z, .14, col('paintR'), pr * 9); G_(x, y + .1, z, .05, .05, .05, _c.setRGB(3, 1.5, .4)); }
  // lightning: bright jagged segments
  for (const e of fx) if (e.k === 'bolt') for (let i = 0; i < e.pts.length - 1; i++) {
    const [x1, y1] = e.pts[i], [x2, y2] = e.pts[i + 1], L = Math.hypot(x2 - x1, y2 - y1), n = Math.max(2, Math.ceil(L * 4)); let px = x1 + .5, py = .9, pz = y1 + .5;
    const cc = e.c === '#ff8fb0' ? _c.setRGB(3, 1.2, 1.8) : _c.setRGB(3, 2.6, 1.2);
    for (let j = 1; j <= n; j++) { const f = j / n, qx = x1 + (x2 - x1) * f + .5 + (j < n ? (Math.random() - .5) * .15 : 0), qy = (j < n ? .55 + Math.random() * .25 : .45), qz = y1 + (y2 - y1) * f + .5 + (j < n ? (Math.random() - .5) * .15 : 0), dl = Math.hypot(qx - px, qz - pz, qy - py);
      G_((px + qx) / 2, (py + qy) / 2, (pz + qz) / 2, dl, .045, .045, cc, -Math.atan2(qz - pz, qx - px), 0); px = qx; py = qy; pz = qz; }
  }
  // fireflies at night, rain and dust in storms
  if (FXS.flies && FXS.night > .05) for (const q of FXS.flies) { const k = FXS.night * (.5 + .5 * Math.sin(time * 3 + q.ph)); G_(q.x, .5 + Math.sin(time * 2 + q.ph) * .2, q.y, .05, .05, .05, _c.setRGB(1.4 * k, 2 * k, .6 * k)); }
  for (const q of FXS.wxp || []) {
    if (q.k === 'rain') G_(q.x, Math.max(0, (q.land - q.y) * .55), q.land, .015, .3, .015, _c.setRGB(.7, .8, 1));
    else if (q.k === 'dust') S_(q.x, .25 + q.l * .3, q.y, .08 + q.l * .08, col('sand'));
    else if (q.k === 'splash') G_(q.x, .02, q.land || q.y, .1, .01, .1, _c.setRGB(.8, .9, 1));
  }
  V.pSolid.count = ns; V.pGlow.count = ng; V.pCoin.count = nc;
  for (const m of [V.pSolid, V.pGlow, V.pCoin]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  // scorch marks
  let nsc = 0; for (const p of tars) if (nsc < 30) inst(V.scorch, nsc++, p.x + .5, ground(p.x + .5, p.y + .5) + .03, p.y + .5, p.r * 2 * Math.min(1, p.t / 1.5), 1, p.r * 1.6 * Math.min(1, p.t / 1.5), 0, col('black'));
  for (const s of FXS.scorch || []) if (nsc < 30) inst(V.scorch, nsc++, s.x + .5, ground(s.x + .5, s.y + .5) + .02, s.y + .5, s.r * 2 * Math.min(1, s.t / 2), 1, s.r * 2 * Math.min(1, s.t / 2), 0, col('black'));
  V.scorch.count = nsc; V.scorch.instanceMatrix.needsUpdate = true;
  // explosions: a fireball that swells and burns out; rings for frost pulses and healing
  let nb = 0, nr = 0;
  for (const e of fx) {
    if (e.k === 'boom') { const b = V.booms[nb] || (V.booms[nb] = mk(V.boomGeo, new THREE.MeshBasicMaterial({ color: '#ffb060', transparent: true, depthWrite: false }))); nb++; const life = e.d || .3, p = 1 - e.t / life; b.visible = true; b.position.set(e.x + .5, .25 + p * .3, e.y + .5); b.scale.setScalar(Math.max(.05, e.r * (.35 + p * .6))); b.material.opacity = Math.max(0, 1 - p) * .9; b.material.color.setRGB(3 - p * 1.6, 1.6 - p * 1.1, .5 - p * .4); }
    else if (e.k === 'ring' || e.k === 'cone') { const r = V.rings[nr] || (V.rings[nr] = mk(V.ringGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }))); nr++; const life = e.k === 'cone' ? .18 : .35, p = 1 - e.t / life; r.visible = true; r.position.set(e.x + .5 + (e.k === 'cone' ? Math.cos(e.a) * .6 : 0), .18, e.y + .5 + (e.k === 'cone' ? Math.sin(e.a) * .6 : 0)); r.scale.setScalar(e.k === 'cone' ? .3 + p * .6 : Math.max(.05, e.r * p)); r.material.opacity = 1 - p; r.material.color.copy(col(e.c && e.c[0] === '#' ? e.c : e.k === 'cone' ? '#ffd27a' : '#8fe8ff')).multiplyScalar(2); }
  }
  for (let i = nb; i < V.booms.length; i++) V.booms[i].visible = false; for (let i = nr; i < V.rings.length; i++) V.rings[i].visible = false;
}
function mk(geo, mat) { const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.userData.shared = 1; V.scene.add(m); return m; }

/* --- light: the day, dusk and night of a wave, the lamps and fires ------------------------------------------- */
const SKY = { day: ['#6fa8d6', '#cfe2ea', '#e8c99a'], dusk: ['#3d4f86', '#e8956a', '#c9805a'], night: ['#0e1430', '#2c3560', '#2a2a40'] };
function light(time) {
  const L = sceneLight(time), n = L.n, dusk = L.dusk, g = GX();
  const mixC = (a, b, t) => _c.copy(col(a)).lerp(col(b), t).clone();
  const sky = i => { const d = mixC(SKY.day[i], SKY.dusk[i], Math.min(1, dusk * 1.4)); return d.lerp(col(SKY.night[i]), Math.max(0, n - .35) / .65); };
  V.sky.material.uniforms.top.value.copy(sky(0)); V.sky.material.uniforms.mid.value.copy(sky(1)); V.sky.material.uniforms.bot.value.copy(sky(2));
  V.scene.fog.color.copy(sky(1)).lerp(sky(2), .4);
  // the sun swings slowly across the sky; at night a cool moon takes over
  const dir = v3(Math.sin(L.az * .8) * .7 + .35, .95 - .5 * n, .62).normalize(), tgt = v3(COLS / 2, 0, ROWS / 2);
  V.sun.position.copy(tgt).addScaledVector(dir, 30); V.sun.target.position.copy(tgt);
  const sunCol = mixC('#fff1d6', '#ffb47a', dusk).lerp(col('#9fb4ff'), Math.max(0, n - .4) / .6);
  V.sun.color.copy(sunCol); V.sun.intensity = 3 * L.sunK + 1.1 * n;
  const amb = L.amb; V.hemi.color.setRGB(amb[0] * .85, amb[1] * .9, amb[2]); V.hemi.groundColor.setRGB(amb[0] * .62, amb[1] * .5, amb[2] * .4); V.hemi.intensity = .95 + 1.1 * n;
  // windows and furnaces glow brighter as night falls
  MAT.glow.color.setScalar(.55 + 1.45 * n);
  // lamps and fires from the 2D lighting engine's list
  const Ls = gatherLights(time);
  V.lamps.forEach((l, i) => { const q = Ls[i]; if (!q) { l.intensity = 0; return; } const [x, y, r, c, k] = q; l.position.set(x, .75, y); l.color.setRGB(c[0], c[1], c[2]); l.distance = r * 1.5; l.intensity = k * 2.2; });
  // the look and bloom
  const lk = LOOKS[g.look] || LOOKS.natural, bk = [0, .45, .75, 1][g.bloom] || 0, gu = V.grade.uniforms;
  V.bloom.enabled = g.bloom > 0; V.bloom.strength = (.22 + .55 * n) * bk; V.bloom.threshold = .86 - .2 * n;
  gu.uSat.value = lk.sat * 1.12 - .05 * n; gu.uCon.value = lk.con; gu.uTint.value.set(...lk.tint); gu.uLift.value.set(...lk.lift); gu.uVig.value = (.2 + .3 * n) * lk.vig; gu.uGrain.value = g.grain ? .05 : 0; gu.uTime.value = time % 10; gu.uFlash.value = Math.min(.5, FXS.flash > 0 ? FXS.flash * 2.5 : 0);
  return L;
}

/* --- the selected plot: a pulsing copper frame, every buildable plot faintly lit, a ghost of the tower ------------- */
function syncSelect(time, dt) {
  if (!V.sel) {
    const k = new THREE.MeshBasicMaterial({ color: '#ffb35a', transparent: true, opacity: .9, depthWrite: false }), g = new THREE.Group();
    for (const [x, z, w, d] of [[0, -.47, 1, .06], [0, .47, 1, .06], [-.47, 0, .06, 1], [.47, 0, .06, 1]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, .05, d), k); m.position.set(x, 0, z); g.add(m); }
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(.94, .94).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffb35a', transparent: true, opacity: .18, depthWrite: false })); fill.position.y = .01; g.add(fill);
    g.userData.mats = [k, fill.material]; V.sel = g; V.scene.add(g);
    V.okMat = new THREE.MeshBasicMaterial({ color: '#fff3c0', transparent: true, opacity: .12, depthWrite: false });
    V.ghostMat = new THREE.MeshBasicMaterial({ color: '#ffd38a', transparent: true, opacity: .45, depthWrite: false });
    const bad = new THREE.MeshBasicMaterial({ color: '#f07067', transparent: true, depthWrite: false }); V.cross = new THREE.Group();
    for (const a of [.785, -.785]) { const m = new THREE.Mesh(new THREE.BoxGeometry(.9, .05, .12), bad); m.rotation.y = a; V.cross.add(m); } V.cross.userData.mat = bad; V.scene.add(V.cross);
  }
  const plot = sel && sel.plot, show = !!plot;
  V.sel.visible = show;
  if (show) { const [c, r] = plot, y = Math.max(0, ground(c + .5, r + .5)) + .03, p = .5 + .5 * Math.sin(time * 6); V.sel.position.set(c + .5, y, r + .5); V.sel.scale.setScalar(1 + p * .06); V.sel.userData.mats[0].opacity = .65 + .35 * p; V.sel.userData.mats[1].opacity = .1 + .14 * p; }
  // every plot a tower could go on, faintly lit while choosing
  if (show && (!V.okTiles || V.okKey !== V.key)) {
    if (V.okTiles) V.scene.remove(V.okTiles);
    V.okTiles = new THREE.InstancedMesh(new THREE.PlaneGeometry(.86, .86).rotateX(-Math.PI / 2), V.okMat, PLOTS.length); V.okKey = V.key;
    PLOTS.forEach((pl, i) => { V.okTiles.setMatrixAt(i, new THREE.Matrix4().makeTranslation(pl.x + .5, Math.max(0, ground(pl.x + .5, pl.y + .5)) + .02, pl.y + .5)); });
    V.scene.add(V.okTiles);
  }
  if (V.okTiles) { V.okTiles.visible = show; if (show) { let n = 0; const m = new THREE.Matrix4(); for (const pl of PLOTS) if (!S.towers.some(t => t.c === pl.x && t.r === pl.y)) { m.makeTranslation(pl.x + .5, Math.max(0, ground(pl.x + .5, pl.y + .5)) + .02, pl.y + .5); V.okTiles.setMatrixAt(n++, m); } V.okTiles.count = n; V.okTiles.instanceMatrix.needsUpdate = true; } }
  // the ghost tower
  const gt = show ? GHOST.type : null;
  if (V.ghost && V.ghost.userData.type !== gt) { V.scene.remove(V.ghost); V.ghost = null; }
  if (gt && !V.ghost) { V.ghost = makeTower(gt, null, 0); V.ghost.userData.type = gt; V.ghost.traverse(o => { if (o.isMesh) { o.material = V.ghostMat; o.castShadow = false; } }); V.scene.add(V.ghost); }
  if (V.ghost) { const [c, r] = plot; V.ghost.position.set(c + .5, Math.max(0, ground(c + .5, r + .5)), r + .5); V.ghostMat.opacity = .3 + .2 * Math.sin(time * 4); }
  // a road cell tapped by mistake: a red cross that fades
  const bc = FXS.badCell; V.cross.visible = !!(bc && bc.t > 0);
  if (V.cross.visible) { bc.t -= dt; V.cross.position.set(bc.x + .5, Math.max(-.04, ground(bc.x + .5, bc.y + .5)) + .03, bc.y + .5); V.cross.userData.mat.opacity = Math.min(1, bc.t * 2); }
}
/* --- the frame ---------------------------------------------------------------------------------------------- */
let lastT = 0;
function render(time, cam) {
  const W = V.canvas.width, H = V.canvas.height; if (!W || !H) return;
  const dt = Math.max(0, Math.min(.1, time - lastT)); lastT = time;
  if (V.key !== TOWN_ID + MAP.n) rebuildWorld();
  applyQuality(W, H);
  // camera from the bridge (so picking and the overlay agree exactly), plus a little screen shake
  const g = GX(), q = FXS.quake > 0 && !REDUCED && g.shake ? FXS.quake * .12 : 0;
  V.cam.position.set(cam.eye[0] + (Math.random() - .5) * q, cam.eye[1] + (Math.random() - .5) * q, cam.eye[2]); V.cam.lookAt(cam.tgt[0], cam.tgt[1], cam.tgt[2]);
  V.cam.fov = cam.fov * 180 / Math.PI; V.cam.aspect = W / H; V.cam.near = .5; V.cam.far = 200; V.cam.updateProjectionMatrix();
  V.sky.position.copy(V.cam.position);
  light(time);
  syncBuildings(time, dt); syncTowers(time, dt); syncFoes(time, dt); syncFx(time, dt); syncSelect(time, dt);
  // taps shake when gathered; the vault shows its reinforcement and shudders when hit
  const ts = FXS.shake.trees > 0 ? Math.sin(time * 70) * .06 : 0, rs = FXS.shake.rocks > 0 ? Math.sin(time * 80) * .04 : 0;
  V.tapTrees.forEach((o, i) => { o.rotation.z = ts * (i % 2 ? 1 : -1); o.rotation.x = Math.sin(time * 1.3 + i) * .015; }); V.tapRocks.forEach(o => { o.position.x += rs * .1; o.rotation.y = rs; });
  const bands = Math.floor(lv('vault') / 4);
  if (bands !== V.vaultBands) { if (V.vault) V.dyn.remove(V.vault); V.vault = makeVault(bands); V.vault.position.set(VAULT[0] + .5, ground(VAULT[0] + .5, VAULT[1] + .5), VAULT[1] + .5); V.dyn.add(V.vault); V.vaultBands = bands; }
  V.vault.scale.setScalar(FXS.flash > 0 ? 1 + Math.sin(time * 90) * .03 : 1);
  const w = V.world.userData.water; if (w) w.material.map.offset.x = -time * .35;
  V.composer.render();
}

/* Build one of everything (for the smoke test): returns how many models were made, and any that failed. */
function prebuild() {
  const bad = []; let n = 0;
  for (const id of BUILDING_IDS) for (const t of [0, 4]) { try { makeBuilding(id, t); n++; } catch (e) { bad.push(id + ': ' + e.message); } }
  for (const k of ['raider', 'runner', 'brute', 'shield', 'sapper', 'healer', 'thief', 'boss', 'train', 'boat', 'steamer']) { try { makeFoe(k); n++; } catch (e) { bad.push(k + ': ' + e.message); } }
  for (const t of Object.keys(TOWERS)) for (const b of [null, 'a', 'b']) { try { makeTower(t, b, b ? 6 : 1); n++; } catch (e) { bad.push(t + b + ': ' + e.message); } }
  for (const k of Object.keys(PROPS)) { try { PROPS[k](1, 1); n++; } catch (e) { bad.push(k + ': ' + e.message); } }
  return { n, bad };
}
function info() { const i = V.r.info; return { calls: i.render.calls, tris: i.render.triangles, geos: i.memory.geometries, err: V.r.getContext().getError(), foes: V.foes.size, towers: V.towers.size }; }

window.R3D = { setup, resize, render, prebuild, info, V };
// the game may already want the 3D view: switch it on now that the engine has loaded
try { if (typeof S !== 'undefined' && S) { applyGfx(); fit(); } } catch (e) { /* the game has not started yet; it will ask when it does */ }
