'use strict';
/* =========================================================
   Voxel 3D engine (WebGL2, no libraries)
   The game's pixel sprites are extruded into voxel models (flat prisms for buildings and people, a lathe for round
   things, crossed planes for plants), meshed with per-vertex ambient occlusion, and lit by a sun with a shadow map,
   hemisphere sky light, up to 8 point lights from gatherLights(), and the existing bloom and colour-grading passes.
   The camera orbits the town; taps are turned back into map cells by casting a ray to the ground.
   Labels, numbers, the boss bar and banners are drawn flat on an overlay, projected from their 3D positions.
   ========================================================= */
const R3 = { on: false, ok: false, tried: false, yaw: 0, yawT: 0, pitch: .92, dist: 24, distT: 24, models: {}, staticKey: '', dragged: false };
const MAXL3 = 8;
// --- small matrix helpers (column-major) ---
const M4 = {
  mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
  persp(fy, asp, n, f) { const t = 1 / Math.tan(fy / 2), o = new Float32Array(16); o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o; },
  ortho(l, r, b, t, n, f) { const o = new Float32Array(16); o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n); o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n); o[15] = 1; return o; },
  look(e, t, u) {
    const z = norm([e[0] - t[0], e[1] - t[1], e[2] - t[2]]), x = norm(cross(u, z)), y = cross(z, x), o = new Float32Array(16);
    o[0] = x[0]; o[4] = x[1]; o[8] = x[2]; o[1] = y[0]; o[5] = y[1]; o[9] = y[2]; o[2] = z[0]; o[6] = z[1]; o[10] = z[2];
    o[12] = -dot(x, e); o[13] = -dot(y, e); o[14] = -dot(z, e); o[15] = 1; return o;
  },
  // translate, rotate about y, scale (uniform)
  trs(x, y, z, yaw, s, tilt) {
    const c = Math.cos(yaw), si = Math.sin(yaw), ct = Math.cos(tilt || 0), st = Math.sin(tilt || 0), o = new Float32Array(16);
    // yaw then tilt about the model's own x axis (used for falling raiders)
    o[0] = c * s; o[1] = 0; o[2] = -si * s; o[4] = si * st * s; o[5] = ct * s; o[6] = c * st * s; o[8] = si * ct * s; o[9] = -st * s; o[10] = c * ct * s;
    o[12] = x; o[13] = y; o[14] = z; o[15] = 1; return o;
  },
};
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

/* --- voxel meshing --------------------------------------------------------------------------------------------
   A grid of coloured voxels becomes triangles (pos 3, normal 3, colour 3, ao 1). Faces only where the neighbour is
   empty; each corner darkens by how many of the three voxels around it outside the face are solid. */
function meshGrid(W, H, D, get, vs, ox, oz, out) {
  const solid = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < W && y < H && z < D && get(x, y, z) >= 0;
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const col = get(x, y, z); if (col < 0) continue;
    const r = (col >> 16 & 255) / 255, g = (col >> 8 & 255) / 255, b = (col & 255) / 255;
    for (let a = 0; a < 3; a++) for (const s of [-1, 1]) {
      const p = [x, y, z], n = [0, 0, 0]; n[a] = s; p[a] += s;
      if (solid(p[0], p[1], p[2])) continue;
      const u = (a + 1) % 3, v = (a + 2) % 3, base = [x, y, z]; base[a] += s > 0 ? 1 : 0;
      const corner = (cu, cv) => {
        const q = [x, y, z]; q[a] += s; const du = cu ? 1 : -1, dv = cv ? 1 : -1;
        const s1 = (() => { const t = q.slice(); t[u] += du; return solid(t[0], t[1], t[2]); })();
        const s2 = (() => { const t = q.slice(); t[v] += dv; return solid(t[0], t[1], t[2]); })();
        const s3 = (() => { const t = q.slice(); t[u] += du; t[v] += dv; return solid(t[0], t[1], t[2]); })();
        const occ = s1 && s2 ? 3 : (s1 ? 1 : 0) + (s2 ? 1 : 0) + (s3 ? 1 : 0);
        const pt = base.slice(); pt[u] += cu; pt[v] += cv;
        return [(pt[0] + ox) * vs, pt[1] * vs, (pt[2] + oz) * vs, 1 - occ * .17];
      };
      const c00 = corner(0, 0), c10 = corner(1, 0), c11 = corner(1, 1), c01 = corner(0, 1);
      for (const q of [c00, c10, c11, c00, c11, c01]) out.push(q[0], q[1], q[2], n[0], n[1], n[2], r, g, b, q[3]);
    }
  }
}
/* Turn sprite `name` into a voxel model `height` world units tall, standing on y = 0, centred on x and z.
   mode 'prism': extruded `depth` pixels; 'lathe': spun round its vertical axis; 'cross': two crossed slabs. */
function voxelize(name, mode, depth) {
  const im = SPR[name]; if (!im) return null;
  const w = im.width, h = im.height, px = im.getContext('2d').getImageData(0, 0, w, h).data;
  // the sprites' 1-pixel dark outline would become black roof tops in 3D, so it is dropped (dark pixels inside a shape, like doorways, stay)
  const raw = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return -1; const i = ((h - 1 - y) * w + x) * 4; return px[i + 3] > 20 ? (px[i] << 16) | (px[i + 1] << 8) | px[i + 2] : -1; };
  const pix = (x, y) => { const c = raw(x, y); if (c !== 0x2a1c22) return c; return raw(x - 1, y) < 0 || raw(x + 1, y) < 0 || raw(x, y - 1) < 0 || raw(x, y + 1) < 0 ? -1 : c; };
  let D = mode === 'prism' ? depth || 4 : w, get;
  if (mode === 'prism') get = (x, y) => pix(x, y);
  else if (mode === 'cross') { // the sprite as a slab along x, and the same sprite as a slab along z
    const t = Math.max(1, depth || 2), lo = Math.floor(w / 2 - t / 2), hi = lo + t;
    get = (x, y, z) => { if (z >= lo && z < hi) { const c = pix(x, y); if (c >= 0) return c; } return x >= lo && x < hi ? pix(z, y) : -1; };
  }
  else { // lathe: each row's outermost opaque pixel sets the radius; colours come from the right half of the sprite
    const cx = w / 2, rad = []; for (let y = 0; y < h; y++) { let r = -1; for (let x = 0; x < w; x++) if (pix(x, y) >= 0) r = Math.max(r, Math.abs(x + .5 - cx)); rad[y] = r; }
    get = (x, y, z) => { const d = Math.hypot(x + .5 - cx, z + .5 - cx); if (rad[y] < 0 || d > rad[y] + .25) return -1; const sx = Math.min(w - 1, Math.floor(cx + d)); let c = pix(sx, y); if (c < 0) c = pix(Math.max(0, Math.floor(cx + d - 1)), y); return c < 0 ? pix(Math.floor(cx), y) : c; };
  }
  const out = []; meshGrid(w, h, D, get, 1, -w / 2, -D / 2, out);
  return { data: new Float32Array(out), h };
}

/* --- set-up ------------------------------------------------------------------------------------------------- */
function r3Setup() {
  if (R3.tried) return R3.ok; R3.tried = true;
  try {
    const c = document.createElement('canvas'); c.id = 'g3'; c.setAttribute('aria-hidden', 'true'); c.hidden = true; cv.after(c);
    const gl = c.getContext('webgl2', { alpha: false, antialias: true, depth: true, premultipliedAlpha: false });
    if (!gl) { c.remove(); return false; }
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = (vs, fs, attrs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); (attrs || []).forEach((a, i) => gl.bindAttribLocation(p, i, a)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, a.name); } return { p, u }; };
    const VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec3 aC; layout(location=3) in float aA;
uniform mat4 uVP, uM, uL; uniform vec4 uTint;
out vec3 vW; out vec3 vN; out vec3 vC; out float vA; out vec4 vS;
void main(){ vec4 w = uM * vec4(aP, 1.); vW = w.xyz; vN = normalize(mat3(uM) * aN); vC = aC * uTint.rgb; vA = aA; vS = uL * w; gl_Position = uVP * w; }`;
    const FS = `#version 300 es
precision highp float; precision highp sampler2DShadow;
in vec3 vW; in vec3 vN; in vec3 vC; in float vA; in vec4 vS;
uniform sampler2DShadow uSh; uniform vec3 uSun, uSunC, uSky, uGnd, uEye, uFog; uniform float uNight, uFogK, uShOn, uAlpha, uEmit;
uniform vec4 uLP[${MAXL3}]; uniform vec4 uLC[${MAXL3}]; uniform int uLN;
out vec4 o;
void main(){
  vec3 n = normalize(vN), alb = vC * vA;
  float sh = 1.;
  if (uShOn > .5) { vec3 p = vS.xyz / vS.w * .5 + .5; sh = 0.; for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) sh += texture(uSh, vec3(p.xy + vec2(i, j) / 2048., p.z - .0025)); sh /= 9.; if (p.x < 0. || p.x > 1. || p.y < 0. || p.y > 1.) sh = 1.; }
  vec3 li = mix(uGnd, uSky, n.y * .5 + .5) + uSunC * max(dot(n, uSun), 0.) * sh;
  for (int i = 0; i < ${MAXL3}; i++) { if (i >= uLN) break; vec3 d = uLP[i].xyz - vW; float l = length(d); if (l < uLP[i].w) { float f = 1. - l / uLP[i].w; li += uLC[i].rgb * uLC[i].a * f * f * (.35 + .65 * max(dot(n, d / l), 0.)); } }
  vec3 col = alb * li;
  float lum = max(alb.r, max(alb.g, alb.b)); col += alb * smoothstep(.82, .98, lum) * uNight * .5 + alb * uEmit;
  float fd = length(vW - uEye); col = mix(col, uFog, clamp((fd - 14.) * uFogK, 0., .6));
  o = vec4(col, uAlpha);
}`;
    const SVS = `#version 300 es
layout(location=0) in vec3 aP; uniform mat4 uL, uM; void main(){ gl_Position = uL * uM * vec4(aP, 1.); }`;
    const SFS = `#version 300 es
precision mediump float; void main(){}`;
    R3.P = { scene: prog(VS, FS), shadow: prog(SVS, SFS) };
    // post: the 2D lighting engine's bright / blur / final shaders (GLSL ES 1.0 runs in WebGL2 too)
    const post = fs => prog(GLSL.vs, GLSL.head + fs, ['p']);
    R3.P.bright = post(GLSL.bright); R3.P.blur = post(GLSL.blur); R3.P.final = post(GLSL.final);
    R3.quad = gl.createVertexArray(); gl.bindVertexArray(R3.quad); const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    // shadow map
    R3.shTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, R3.shTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, 2048, 2048);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    R3.shFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, R3.shFbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, R3.shTex, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    R3.gl = gl; R3.canvas = c; R3.ux = document.createElement('canvas').getContext('2d'); R3.tU = gl.createTexture();
    R3.dyn = r3Buffer(new Float32Array(0)); R3.dynCap = 0;
    c.addEventListener('webglcontextlost', e => { e.preventDefault(); R3.on = false; R3.ok = false; c.hidden = true; });
    r3Models(); R3.ok = true; r3Resize();
  } catch (e) { console.warn('3D engine unavailable:', e.message); R3.ok = false; if (R3.canvas) R3.canvas.remove(); }
  return R3.ok;
}
function r3Buffer(data) {
  const gl = R3.gl, vao = gl.createVertexArray(), buf = gl.createBuffer(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  const st = 40; gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, st, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, st, 12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, st, 24); gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, st, 36);
  gl.bindVertexArray(null); return { vao, buf, n: data.length / 10 };
}
/* Which sprites become which shapes. Height is in world units (one map cell = 1). */
const R3_SHAPES = (() => {
  const s = {};
  const house = ['camp', 'mine', 'saw', 'saw_b', 'smelt', 'glass', 'mach', 'eng', 'market', 'mill', 'clockw', 'autow', 'hall', 'office', 'pit', 'drill', 'ironmine', 'coalseam', 'quarry', 'blast', 'rolling', 'boilerw', 'locow', 'cumine', 'sandpit', 'wheel', 'refinery', 'wirew', 'glassb', 'bulbw', 'telw'];
  for (const k of house) s[k] = ['prism', 13, 1.7];
  s.vault = ['prism', 14, 1.05]; s.wagon = s.wagon_b = ['prism', 8, .9]; s.loco = ['prism', 7, .7]; s.sign = ['prism', 2, .8];
  for (const k of ['raider', 'runner', 'brute', 'shield', 'sapper', 'healer', 'thief', 'boss', 'train', 'boat', 'steamer']) { s[k] = ['prism', k === 'boss' || k === 'train' || k === 'steamer' ? 9 : k === 'boat' ? 7 : k === 'runner' ? 5 : 4, 0]; s[k + '_b'] = s[k]; }
  for (const k of ['worker', 'worker_b', 'foreman', 'foreman_b']) s[k] = ['prism', 3, .5];
  s.tree = ['lathe', 0, 1.25]; s.rock = ['lathe', 0, .8]; s.boulder = ['lathe', 0, .9]; s.cactus = ['cross', 2, .55]; s.barrel = ['lathe', 0, .4]; s.crate = ['prism', 10, .36]; s.skull = ['prism', 3, .22]; s.wheel = ['prism', 2, .4];
  s.crossbow = ['prism', 12, .7]; s.frost = ['lathe', 0, .95]; s.tesla = ['lathe', 0, 1]; s.cannon = ['lathe', 0, .6]; s.gatling = ['lathe', 0, .55];
  for (const t of ['crossbow', 'cannon', 'frost', 'tesla', 'gatling']) for (const b of ['a', 'b']) s[t + '_' + b] = s[t];
  s.bird = s.bird_b = ['prism', 2, .3]; s.dynamite = ['prism', 6, .45]; s.coin = ['prism', 2, .22];
  for (const k in ITEMS) if (!s[k]) s[k] = ['prism', 6, .3];
  return s;
})();
function r3Models() {
  for (const k in R3_SHAPES) { const [mode, d] = R3_SHAPES[k], v = voxelize(k, mode, d); if (v && v.data.length) R3.models[k] = Object.assign(r3Buffer(v.data), { h: v.h }); }
}
function r3Resize() {
  if (!R3.ok) return; const gl = R3.gl, W = cv.width, H = cv.height; if (!W) return;
  R3.canvas.width = W; R3.canvas.height = H; R3.ux.canvas.width = W; R3.ux.canvas.height = H;
  const target = (w, h, depth) => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    if (depth) { const rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb); }
    return { t, f, w, h };
  };
  const bw = Math.max(1, Math.round(W / 4)), bh = Math.max(1, Math.round(H / 4));
  R3.fS = target(W, H, true); R3.fA = target(bw, bh); R3.fB = target(bw, bh); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

/* --- the town as geometry ------------------------------------------------------------------------------------ */
const hex = s => { const v = parseInt(s.slice(1), 16); return s.length === 4 ? (((v >> 8 & 15) * 17) << 16) | (((v >> 4 & 15) * 17) << 8) | ((v & 15) * 17) : v; };
/* A coloured box (optionally turned by yaw) appended to a vertex list, with flat ao. */
function box(out, x, y, z, sx, sy, sz, col, yaw, ao) {
  const r = (col >> 16 & 255) / 255, g = (col >> 8 & 255) / 255, b = (col & 255) / 255, c = Math.cos(yaw || 0), s = Math.sin(yaw || 0), a = ao || 1;
  const P = (px, py, pz) => [x + px * c + pz * s, y + py, z - px * s + pz * c];
  const N = (nx, ny, nz) => [nx * c + nz * s, ny, -nx * s + nz * c];
  const hx = sx / 2, hz = sz / 2;
  const faces = [[[1, 0, 0], [[hx, 0, -hz], [hx, sy, -hz], [hx, sy, hz], [hx, 0, hz]]], [[-1, 0, 0], [[-hx, 0, hz], [-hx, sy, hz], [-hx, sy, -hz], [-hx, 0, -hz]]],
    [[0, 1, 0], [[-hx, sy, -hz], [-hx, sy, hz], [hx, sy, hz], [hx, sy, -hz]]], [[0, -1, 0], [[-hx, 0, hz], [-hx, 0, -hz], [hx, 0, -hz], [hx, 0, hz]]],
    [[0, 0, 1], [[hx, 0, hz], [hx, sy, hz], [-hx, sy, hz], [-hx, 0, hz]]], [[0, 0, -1], [[-hx, 0, -hz], [-hx, sy, -hz], [hx, sy, -hz], [hx, 0, -hz]]]];
  for (const [n, q] of faces) { const nn = N(n[0], n[1], n[2]); for (const i of [0, 1, 2, 0, 2, 3]) { const p = P(q[i][0], q[i][1], q[i][2]); out.push(p[0], p[1], p[2], nn[0], nn[1], nn[2], r, g, b, a); } }
}
const onRiver = (x, y) => MAP.river !== undefined && PATHS[MAP.river].segs.some(s => x >= Math.min(s.x1, s.x2) - .01 && x <= Math.max(s.x1, s.x2) + .01 && y >= Math.min(s.y1, s.y2) - .01 && y <= Math.max(s.y1, s.y2) + .01);
const cellH = (x, y) => y < YARD ? .22 : onRiver(x, y) ? -.32 : onRoad(x, y) ? -.06 : 0;
/* Ground, road, river and fence: built once per map. */
function r3Static() {
  const out = [], pal = MAP.pal || { yard: '#b99468', a: '#d0aa76', b: '#c9a26c', road: ['#7a5a3e', '#9b7552', '#8a6645', '#9b7552'] };
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const tint = (col, k) => { const r = Math.min(255, (col >> 16 & 255) * k), g = Math.min(255, (col >> 8 & 255) * k), b = Math.min(255, (col & 255) * k); return (r << 16) | (g << 8) | b; };
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const h = cellH(x, y), road = onRoad(x, y);
    let col = y < YARD ? hex(pal.yard) : road ? hex(pal.road[1]) : (x + y) % 2 ? hex(pal.a) : hex(pal.b);
    if (onRiver(x, y)) col = (x + y) % 2 ? hex('#3d6f8f') : hex('#386886');
    box(out, x + .5, -2, y + .5, 1, 2 + h, 1, tint(col, .94 + rnd() * .1));
    if (road && !onRiver(x, y)) { box(out, x + .3, -.06, y + .5, .05, .005, .9, tint(hex(pal.road[0]), .9)); box(out, x + .7, -.06, y + .5, .05, .005, .9, tint(hex(pal.road[0]), .9)); }
    if (!road && y >= YARD && rnd() < .35) { const gx = x + .2 + rnd() * .6, gz = y + .2 + rnd() * .6; for (let i = 0; i < 3; i++) box(out, gx + (i - 1) * .05, h, gz, .03, .08 + rnd() * .08, .03, i % 2 ? hex('#a9a24a') : hex('#8f8a3c')); }
  }
  // the yard fence
  for (let x = 0; x < COLS; x += .6) box(out, x + .1, .22, YARD - .05, .07, .28, .07, hex('#8a5a34'));
  box(out, COLS / 2, .4, YARD - .05, COLS, .05, .04, hex('#6e4526'));
  R3.static = r3Buffer(new Float32Array(out)); R3.staticKey = TOWN_ID + MAP.n;
}

/* --- per-frame dynamic geometry: shots, particles, coin drops, bolts, tower barrels ---------------------------- */
function r3Dynamic(time) {
  const out = [], col = s => hex(s.length === 7 || s.length === 4 ? s : '#ffffff');
  for (const t of S.towers) if (t.type === 'crossbow' || t.type === 'cannon' || t.type === 'gatling') {
    const k = t.kick > 0 ? t.kick / .12 : 0, a = -(t.aim || 0), x = t.c + .5 - Math.cos(t.aim || 0) * k * .08, z = t.r + .5 - Math.sin(t.aim || 0) * k * .08;
    const y = t.type === 'crossbow' ? .55 : .5, len = t.type === 'cannon' ? .55 : t.type === 'gatling' ? .5 : .45;
    box(out, x + Math.cos(t.aim || 0) * len * .3, y, z + Math.sin(t.aim || 0) * len * .3, len, .12, .12, t.type === 'crossbow' ? hex('#a8703f') : hex('#4b5468'), a);
    if (t.type === 'crossbow') box(out, x + Math.cos(t.aim || 0) * .2, y - .05, z + Math.sin(t.aim || 0) * .2, .06, .1, .6, hex('#6e4526'), a);
  }
  for (const s of shots) {
    const lift = s.kind === 'ball' ? Math.sin((1 - Math.min(1, s.q / s.q0 || 0)) * Math.PI) * .6 : 0;
    box(out, s.x + .5, .45 + lift, s.y + .5, s.kind === 'ball' ? .16 : .26, s.kind === 'ball' ? .16 : .05, s.kind === 'ball' ? .16 : .05, s.kind === 'ball' ? hex('#2a1c22') : s.kind === 'bullet' ? hex('#fff0a0') : hex('#d9a066'), -s.ang);
  }
  // 2D particles move in map x/y; here x/y become ground x/z and height comes from their age (smoke rises, sparks arc and fall)
  for (const p of parts) { const sz = p.s * (p.smoke ? 2.4 - p.t : 1.2); box(out, p.x, p.smoke ? .5 + (1.1 - p.t) * .9 : .25 + Math.max(0, p.t) * .7, p.y, sz, sz, sz, col(p.c)); }
  for (const d of drops) box(out, d.x, .1 + d.z * .6, d.y, .14, .14, .04, hex('#f2d04a'), time * 6);
  for (const e of fx) if (e.k === 'bolt') for (let i = 0; i < e.pts.length - 1; i++) { const [x1, y1] = e.pts[i], [x2, y2] = e.pts[i + 1]; for (let j = 0; j < 4; j++) { const f = j / 4; box(out, x1 + (x2 - x1) * f + .5, .7 + Math.random() * .1, y1 + (y2 - y1) * f + .5, .07, .07, .07, hex('#fff0a0')); } }
  for (const b of bombs) { const pr = 1 - b.t / .7, x = VAULT[0] + (b.x - VAULT[0]) * pr + .5, z = VAULT[1] + (b.y - VAULT[1]) * pr + .5; box(out, x, .3 + Math.sin(pr * Math.PI) * 2, z, .2, .3, .2, hex('#f07067'), pr * 9); }
  if (FXS.flies && FXS.night > .05) for (const q of FXS.flies) box(out, q.x, .6 + Math.sin(time * 2 + q.ph) * .2, q.y, .05, .05, .05, hex('#e8ffb0'));
  for (const q of FXS.wxp || []) if (q.k === 'rain') box(out, q.x, Math.max(0, 3 - (q.y - q.land + 3)), q.land, .02, .35, .02, hex('#c8deff'));
  return new Float32Array(out);
}

/* --- camera ------------------------------------------------------------------------------------------------- */
function r3Camera() {
  const W = R3.canvas.width, H = R3.canvas.height, tgt = [COLS / 2, 0, ROWS / 2 + .6];
  const eye = [tgt[0] + Math.sin(R3.yaw) * Math.cos(R3.pitch) * R3.dist, Math.sin(R3.pitch) * R3.dist, tgt[2] + Math.cos(R3.yaw) * Math.cos(R3.pitch) * R3.dist];
  const fov = .62, V = M4.look(eye, tgt, [0, 1, 0]), Pm = M4.persp(fov, W / H, .5, 80);
  R3.cam = { eye, tgt, fov, asp: W / H, VP: M4.mul(Pm, V) };
  return R3.cam;
}
/* A tap on the canvas, as fractional map cells [x, y] like gridAt() returns: cast a ray to the ground (y = 0). */
function r3Pick(ev) {
  const r = cv.getBoundingClientRect(), nx = ((ev.clientX - r.left - cv.clientLeft) / cv.clientWidth) * 2 - 1, ny = 1 - ((ev.clientY - r.top - cv.clientTop) / cv.clientHeight) * 2;
  const { eye, tgt, fov, asp } = R3.cam || r3Camera(), f = norm([tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]]), rt = norm(cross(f, [0, 1, 0])), up = cross(rt, f), th = Math.tan(fov / 2);
  const d = norm([f[0] + rt[0] * nx * th * asp + up[0] * ny * th, f[1] + rt[1] * nx * th * asp + up[1] * ny * th, f[2] + rt[2] * nx * th * asp + up[2] * ny * th]);
  const t = (.1 - eye[1]) / d[1]; return [eye[0] + d[0] * t, eye[2] + d[2] * t];
}
/* Screen pixel of a world point, for the overlay. */
function r3Project(x, y, z) {
  const m = R3.cam.VP, cx_ = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], w = m[3] * x + m[7] * y + m[11] * z + m[15];
  return [(cx_ / w * .5 + .5) * R3.canvas.width, (1 - (cy / w * .5 + .5)) * R3.canvas.height, w];
}
// camera controls: drag to turn, wheel or pinch to zoom, double-tap to reset; a drag never counts as a tap
(() => {
  let down = null, pts = new Map(), pinch = 0;
  cv.addEventListener('pointerdown', e => { if (!R3.on) return; pts.set(e.pointerId, [e.clientX, e.clientY]); down = { x: e.clientX, y: e.clientY, yaw: R3.yawT, moved: false }; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
  cv.addEventListener('pointermove', e => {
    if (!R3.on || !down || !pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) R3.distT = Math.max(12, Math.min(34, R3.distT * pinch / d)); pinch = d; down.moved = true; return; }
    const dx = e.clientX - down.x; if (Math.abs(dx) > 8) { down.moved = true; stopHold(); }
    if (down.moved) R3.yawT = down.yaw - dx / cv.clientWidth * 3;
  });
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; if (down && down.moved) R3.dragged = true; if (!pts.size) down = null; };
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) cv.addEventListener(ev, up);
  cv.addEventListener('click', e => { if (R3.dragged) { R3.dragged = false; e.stopImmediatePropagation(); } }, true);
  cv.addEventListener('wheel', e => { if (!R3.on) return; e.preventDefault(); R3.distT = Math.max(12, Math.min(34, R3.distT * (1 + Math.sign(e.deltaY) * .1))); }, { passive: false });
  cv.addEventListener('dblclick', () => { if (R3.on) { R3.yawT = 0; R3.distT = 24; } });
})();

/* --- drawing a frame ---------------------------------------------------------------------------------------- */
function r3Render(time) {
  const gl = R3.gl, W = R3.canvas.width, H = R3.canvas.height, P_ = R3.P, g = GX();
  if (R3.staticKey !== TOWN_ID + MAP.n) r3Static();
  R3.yaw += (R3.yawT - R3.yaw) * .15; R3.dist += (R3.distT - R3.dist) * .15;
  const cam = r3Camera(), L = sceneLight(time);
  // the sun swings across the sky; at night the moon gives a cool low light
  const sunDir = norm([Math.sin(L.az * .8) * .7 + .3, .9 - .45 * L.n, .55]), shOn = g.shadow > 0;
  const shake = FXS.quake > 0 && !REDUCED && g.shake ? [(Math.random() - .5) * FXS.quake * .3, (Math.random() - .5) * FXS.quake * .3] : [0, 0];
  const LV = M4.mul(M4.ortho(-11, 11, -11, 11, 1, 60), M4.look([COLS / 2 + sunDir[0] * 25, sunDir[1] * 25, ROWS / 2 + sunDir[2] * 25], [COLS / 2, 0, ROWS / 2], [0, 1, 0]));
  const VP = shake[0] ? M4.mul(new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, shake[0] * .05, shake[1] * .05, 0, 1]), cam.VP) : cam.VP; // screen shake: a small shift after projection
  // things to draw: [model, matrix, tint]
  const items = [], put = (name, x, y, z, yaw, s, tint, tilt) => { const m = R3.models[name]; if (m) items.push([m, M4.trs(x, y, z, yaw, s, tilt), tint || [1, 1, 1, 1]]); };
  const sc = (name, hw) => hw / ((R3.models[name] && R3.models[name].h) || 16);
  for (const b of BUILD) { const id = b.def.id, l = blv(id), [sx, sy] = SLOT[id]; if (!l) continue; const name = id === 'saw' && ACT[id] > .08 && Math.floor(time * 8) % 2 ? 'saw_b' : id, pq = FXS.pop[id] > 0 ? 1 + Math.sin((1 - FXS.pop[id] / .45) * Math.PI * 2.5) * FXS.pop[id] * .2 : 1; put(name, sx + 1, .22, sy + 1, 0, sc(id, 1.7) * pq); }
  for (const id of ['market', 'hall', 'office']) if (SLOT[id]) put(id, SLOT[id][0] + 1, .22, SLOT[id][1] + 1, 0, sc(id, 1.7));
  if (SLOT.caravan) put('sign', SLOT.caravan[0] + 1, .22, SLOT.caravan[1] + 1, 0, sc('sign', .8));
  const tsh = FXS.shake.trees > 0 ? Math.sin(time * 70) * .05 : 0;
  if (TOWN.trees) for (const [x, y, s] of TREES) put('tree', x + tsh, .22, y + .4, 0, sc('tree', s * 1.1)); else for (const [x, y, s] of [[.5, .8, .85], [1.45, .7, 1], [1, 1.45, .95]]) put('boulder', x + tsh, .22, y + .3, 0, sc('boulder', s * .8));
  for (const [x, y, s] of [[.55, 2.75, .8], [1.45, 2.6, .95], [1, 3.4, .85]]) put('rock', x, .22, y + .2, 0, sc('rock', s * .7));
  for (const [x, y] of CACTI) if (!S.towers.some(t => t.c === x && t.r === y)) put('cactus', x + .35, cellH(x, y), y + .45, x * 1.3, sc('cactus', .55));
  for (const [x, y, k, r] of DECOR) if (!S.towers.some(t => t.c === x && t.r === y)) put(k, x + .3 + r * .4, cellH(x, y), y + .55, r * 6, sc(k, R3_SHAPES[k][2]));
  put('vault', VAULT[0] + .5, cellH(VAULT[0], VAULT[1]), VAULT[1] + .5, -Math.PI / 2, sc('vault', 1.05) * (FXS.flash > 0 ? 1 + Math.sin(time * 90) * .02 : 1));
  for (const t of S.towers) { const body = t.br ? t.type + '_' + t.br : t.type, born = t.born > 0 ? 1 - t.born / .35 : 1; put(body, t.c + .5, cellH(t.c, t.r), t.r + .5, 0, sc(body, R3_SHAPES[body][2] * (1 + Math.min(t.lvl, 8) * .03)) * born, t.jam > 0 ? [.6, .6, .6, 1] : null); }
  for (const f of foes) {
    const D = FOES[f.type], spr = f.type === 'boss' ? TOWN.boss.spr : f.type, fr = f.stun > 0 ? '' : Math.floor(time * (f.type === 'runner' ? 10 : 6) + f.d * 2) % 2 ? '_b' : '';
    const [nx, ny] = posAt(f.d + .05, f.p), yaw = Math.atan2(-(ny - f.y), nx - f.x) + 0, hop = f.type === 'runner' || f.type === 'thief' ? Math.abs(Math.sin(time * 14 + f.d)) * .06 : 0;
    put(spr + fr, f.x + .5, cellH(Math.round(f.x), Math.round(f.y)) + hop, f.y + .5, yaw, sc(spr, D.size), f.flash > 0 ? [3, 3, 3, 1] : f.slow > 0 ? [.75, .9, 1.2, 1] : null);
  }
  for (const k of corpses) { const D = FOES[k.type], spr = k.type === 'boss' ? TOWN.boss.spr : k.type; put(spr, k.x + .5, 0, k.y + .5, 0, sc(spr, D.size) * Math.min(1, k.t * 2), null, (1 - k.t / .8) * 1.4); }
  for (const w of workers) put(Math.floor(time * 8 + w.tx) % 2 ? 'worker_b' : 'worker', w.x, .22, w.y, w.dir < 0 ? Math.PI : 0, sc('worker', .5));
  for (const id in S.mgr) if (SLOT[id]) put(Math.floor(time * 2) % 2 ? 'foreman_b' : 'foreman', SLOT[id][0] + 1.78, .22, SLOT[id][1] + 1.6, 0, sc('foreman', .5));
  if (FXS.convoys) for (const v of FXS.convoys) put(carrier().spr, v.x, .22, 3.5, v.out ? 0 : Math.PI, sc(carrier().spr, carrier().spr === 'loco' ? .7 : .9));
  if (false && FXS.birds) for (const b of FXS.birds) put(Math.floor(time * 3 + b.r) % 4 === 0 ? 'bird_b' : 'bird', b.cx + Math.cos(b.a) * b.r, 3.2, b.cy + Math.sin(b.a) * b.r * .6, -b.a, sc('bird', .35));
  // dynamic geometry
  const dyn = r3Dynamic(time); gl.bindBuffer(gl.ARRAY_BUFFER, R3.dyn.buf); gl.bufferData(gl.ARRAY_BUFFER, dyn, gl.DYNAMIC_DRAW); R3.dyn.n = dyn.length / 10;
  const ident = M4.trs(0, 0, 0, 0, 1);
  const drawAll = (u, shadowOnly) => {
    const one = (m, mat, tint) => { gl.uniformMatrix4fv(u.uM, false, mat); if (!shadowOnly) gl.uniform4fv(u.uTint, tint); gl.bindVertexArray(m.vao); gl.drawArrays(gl.TRIANGLES, 0, m.n); };
    one(R3.static, ident, [1, 1, 1, 1]); for (const [m, mat, tint] of items) one(m, mat, tint);
    if (R3.dyn.n) { if (!shadowOnly) gl.uniform1f(u.uEmit, .25); one(R3.dyn, ident, [1, 1, 1, 1]); if (!shadowOnly) gl.uniform1f(u.uEmit, 0); }
  };
  gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
  // 1. shadow map
  if (shOn) { gl.bindFramebuffer(gl.FRAMEBUFFER, R3.shFbo); gl.viewport(0, 0, 2048, 2048); gl.clear(gl.DEPTH_BUFFER_BIT); gl.useProgram(P_.shadow.p); gl.uniformMatrix4fv(P_.shadow.u.uL, false, LV); drawAll(P_.shadow.u, true); }
  // 2. the lit scene
  gl.bindFramebuffer(gl.FRAMEBUFFER, R3.fS.f); gl.viewport(0, 0, W, H);
  const sky = [.09 + .2 * (1 - L.n), .1 + .22 * (1 - L.n), .17 + .2 * (1 - L.n)]; gl.clearColor(sky[0], sky[1], sky[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const u = P_.scene.u; gl.useProgram(P_.scene.p);
  gl.uniformMatrix4fv(u.uVP, false, VP); gl.uniformMatrix4fv(u.uL, false, LV);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, R3.shTex); gl.uniform1i(u.uSh, 0); gl.uniform1f(u.uShOn, shOn ? 1 : 0);
  const sk = L.sunK * (shOn ? 1 : .8); gl.uniform3fv(u.uSun, sunDir); gl.uniform3f(u.uSunC, .78 * sk + .12 * L.n, .72 * sk + .14 * L.n, .62 * sk + .24 * L.n);
  gl.uniform3f(u.uSky, L.amb[0] * .62, L.amb[1] * .64, L.amb[2] * .72); gl.uniform3f(u.uGnd, L.amb[0] * .42, L.amb[1] * .36, L.amb[2] * .3);
  gl.uniform3fv(u.uEye, cam.eye); gl.uniform3fv(u.uFog, sky); gl.uniform1f(u.uFogK, .05); gl.uniform1f(u.uNight, L.n); gl.uniform1f(u.uAlpha, 1); gl.uniform1f(u.uEmit, 0);
  const Ls = gatherLights(time).slice(0, MAXL3), lp = new Float32Array(MAXL3 * 4), lc = new Float32Array(MAXL3 * 4);
  Ls.forEach(([x, y, r, col, k], i) => { lp.set([x, .7, y, r * 1.2], i * 4); lc.set([col[0], col[1], col[2], k * 1.2], i * 4); });
  gl.uniform4fv(u.uLP, lp); gl.uniform4fv(u.uLC, lc); gl.uniform1i(u.uLN, Ls.length); R3.nLights = Ls.length;
  drawAll(u, false);
  gl.bindVertexArray(null); gl.disable(gl.DEPTH_TEST);
  // 3. overlay: labels, numbers, the boss bar and banners
  r3Overlay(time);
  gl.bindTexture(gl.TEXTURE_2D, R3.tU); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, R3.ux.canvas);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]]) gl.texParameteri(gl.TEXTURE_2D, k, v); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  // 4. bloom and grading, shared with the 2D lighting engine
  const pass = (prog, fbo, w, h, texs, set) => { gl.bindFramebuffer(gl.FRAMEBUFFER, fbo ? fbo.f : null); gl.viewport(0, 0, w, h); gl.useProgram(prog.p); gl.bindVertexArray(R3.quad); texs.forEach(([name, t], i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(prog.u[name], i); }); set(prog.u); gl.drawArrays(gl.TRIANGLES, 0, 3); };
  if (g.bloom > 0) {
    pass(P_.bright, R3.fA, R3.fA.w, R3.fA.h, [['uS', R3.fS.t]], u2 => gl.uniform1f(u2.uT, .92 - .32 * L.n));
    for (let k = 0; k < (g.bloom >= 3 ? 2 : 1); k++) { pass(P_.blur, R3.fB, R3.fB.w, R3.fB.h, [['uS', R3.fA.t]], u2 => gl.uniform2f(u2.uD, (1 + k) / R3.fA.w, 0)); pass(P_.blur, R3.fA, R3.fA.w, R3.fA.h, [['uS', R3.fB.t]], u2 => gl.uniform2f(u2.uD, 0, (1 + k) / R3.fA.h)); }
  }
  const lk = LOOKS[g.look] || LOOKS.natural, bk = [0, .55, 1, 1.3][g.bloom] || 0;
  pass(P_.final, null, W, H, [['uS', R3.fS.t], ['uB', R3.fA.t], ['uU', R3.tU]], u2 => {
    gl.uniform1f(u2.uBloom, (.35 + .7 * L.n) * bk); gl.uniform1f(u2.uVig, (.35 + .45 * L.n) * lk.vig); gl.uniform1f(u2.uNight, L.n);
    gl.uniform1f(u2.uSat, lk.sat - .1 * L.n); gl.uniform1f(u2.uCon, lk.con); gl.uniform3f(u2.uTint, lk.tint[0], lk.tint[1], lk.tint[2]); gl.uniform3f(u2.uLift, lk.lift[0], lk.lift[1], lk.lift[2]);
    gl.uniform1f(u2.uGrain, g.grain ? .07 : 0); gl.uniform1f(u2.uTime, time);
  });
  gl.bindVertexArray(null);
}
/* Flat things projected from 3D: building levels, raider health, floating numbers; then the shared HUD. */
function r3Overlay(time) {
  const ux = R3.ux, c = cell, W = R3.canvas.width; ux.clearRect(0, 0, W, R3.canvas.height);
  ux.textAlign = 'center'; ux.textBaseline = 'middle'; ux.font = '700 ' + Math.max(9, c * .28) + 'px "Barlow Semi Condensed", sans-serif';
  const tag = (txt, x, y, z, col) => { const [px, py, w] = r3Project(x, y, z); if (w <= 0) return; const tw = ux.measureText(txt).width + c * .14; ux.fillStyle = 'rgba(22,26,42,.85)'; ux.fillRect(px - tw / 2, py - c * .16, tw, c * .32); ux.fillStyle = col || '#ece6d8'; ux.fillText(txt, px, py + 1); };
  for (const b of BUILD) { const l = blv(b.def.id), [sx, sy] = SLOT[b.def.id]; if (l) tag('Lv ' + l, sx + 1, 2.05, sy + 1); }
  if (SLOT.hall) tag('Foremen', SLOT.hall[0] + 1, 2.05, SLOT.hall[1] + 1); if (SLOT.office) tag(S.deeds ? S.deeds + ' deeds' : 'Deeds', SLOT.office[0] + 1, 2.05, SLOT.office[1] + 1, S.deeds ? '#f2d04a' : null);
  // the selected plot or tower, and its reach
  if (sel && (sel.plot || sel.t)) {
    const [pc, pr] = sel.plot || [sel.t.c, sel.t.r], reach = sel.t ? towerStats(sel.t).range : 2.4;
    ux.strokeStyle = 'rgba(255,240,160,.8)'; ux.lineWidth = Math.max(1, c * .05); ux.setLineDash([c * .14, c * .1]); ux.beginPath();
    for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2, [px, py] = r3Project(pc + .5 + Math.cos(a) * reach, .05, pr + .5 + Math.sin(a) * reach); i ? ux.lineTo(px, py) : ux.moveTo(px, py); }
    ux.stroke(); ux.setLineDash([]);
  }
  for (const f of foes) if (f.hp < f.max && f.type !== 'boss') { const [px, py, w] = r3Project(f.x + .5, FOES[f.type].size + .25, f.y + .5); if (w <= 0) continue; const bw = c * .6; ux.fillStyle = '#2a1c22'; ux.fillRect(px - bw / 2 - 1, py - 1, bw + 2, c * .09 + 2); ux.fillStyle = '#f07067'; ux.fillRect(px - bw / 2, py, bw, c * .09); ux.fillStyle = '#7fd992'; ux.fillRect(px - bw / 2, py, bw * Math.max(0, f.hp / f.max), c * .09); }
  ux.lineJoin = 'round';
  for (const f of floats) { const [px, py, w] = r3Project(f.x, .9 + (1 - Math.min(1, f.t)) * .4, f.y); if (w <= 0) continue; ux.globalAlpha = Math.min(1, f.t * 3); ux.font = '700 ' + Math.max(9, f.z * c * (1 + .55 * Math.max(0, 1 - (f.a || 0) / .16))) + 'px "Barlow Semi Condensed", sans-serif'; ux.lineWidth = Math.max(2, c * .08); ux.strokeStyle = '#2a1c22'; ux.strokeText(f.s, px, py); ux.fillStyle = f.c; ux.fillText(f.s, px, py); }
  ux.globalAlpha = 1;
  if (FXS.flash > 0) { ux.fillStyle = 'rgba(240,112,103,' + FXS.flash + ')'; ux.fillRect(0, 0, W, R3.canvas.height); }
  const keep = cx; cx = ux; drawHUD(); cx = keep;
}
