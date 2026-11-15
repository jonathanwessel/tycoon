'use strict';
/* =========================================================
   Lighting engine (WebGL, no libraries)
   The pixel art is drawn into two layers: the baked ground and a transparent objects layer.
   The scene pass lights them: ambient light that follows the day, dusk and night; a slowly
   wandering sun whose shadows are cast by anything opaque on the objects layer; drifting cloud
   shadows; up to 48 point lights. A bright pass is blurred into bloom, then the final pass grades
   the colour, adds a vignette and lays the unlit overlay (numbers, banners, boss bar) on top.
   ========================================================= */
const GLX = { on: false, ok: false, tried: false, groundDirty: true, ox: null, ux: null };
const MAXL = 48;
const GLSL = {
  vs: 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}',
  head: '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nvarying vec2 v;\n',
  scene: `uniform sampler2D uG,uO;uniform vec2 uShake,uSun,uGrid;uniform float uSunK,uTime,uCloudK,uNight;uniform vec3 uAmb;uniform int uShN;
uniform vec4 uL[${MAXL}];uniform vec3 uC[${MAXL}];uniform int uN;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
void main(){
  vec2 q=v+uShake;
  vec3 g=texture2D(uG,q).rgb;vec4 o=texture2D(uO,q);
  vec3 alb=mix(g,o.rgb,o.a);
  float occ=0.;
  for(int i=1;i<=12;i++){if(i>uShN)break;float t=float(i)/float(uShN);float a=texture2D(uO,q+uSun*t).a;occ=max(occ,step(.6,a)*(1.1-t));}
  occ*=1.-step(.6,o.a)*.75;
  float sh=1.-clamp(occ,0.,1.)*.45*uSunK;
  vec2 cp=q*uGrid*.22;
  float cl=n(cp+vec2(uTime*.05,uTime*.02))*.65+n(cp*2.3-vec2(uTime*.03,0.))*.35;
  sh*=1.-.22*smoothstep(.5,.78,cl)*uCloudK;
  vec3 li=uAmb*sh;
  vec2 fp=v*uGrid;
  for(int i=0;i<${MAXL};i++){if(i>=uN)break;vec4 L=uL[i];vec2 d=fp-L.xy;float dd=dot(d,d);if(dd<L.z*L.z){float f=1.-sqrt(dd)/L.z;li+=uC[i]*(f*f)*L.w;}}
  vec3 col=alb*li;
  float lum=max(alb.r,max(alb.g,alb.b));
  col+=alb*smoothstep(.82,.98,lum)*uNight*.35*o.a;
  gl_FragColor=vec4(col,1.);
}`,
  bright: 'uniform sampler2D uS;uniform float uT;void main(){vec3 c=texture2D(uS,v).rgb;float l=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*smoothstep(uT,1.,l),1.);}',
  blur: 'uniform sampler2D uS;uniform vec2 uD;void main(){vec3 c=texture2D(uS,v).rgb*.227;c+=(texture2D(uS,v+uD*1.385).rgb+texture2D(uS,v-uD*1.385).rgb)*.316;c+=(texture2D(uS,v+uD*3.231).rgb+texture2D(uS,v-uD*3.231).rgb)*.07;gl_FragColor=vec4(c,1.);}',
  final: `uniform sampler2D uS,uB,uU;uniform float uBloom,uVig,uNight,uSat,uCon,uGrain,uTime;uniform vec3 uTint,uLift;
float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  vec3 c=clamp(texture2D(uS,v).rgb+texture2D(uB,v).rgb*uBloom,0.,1.);
  c=mix(c,c*c*(3.-2.*c),uCon);
  float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,uSat);
  c=clamp(c*uTint+uLift*(1.-c),0.,1.);
  c=mix(c,c*vec3(.92,.97,1.12),uNight*.5);
  vec2 d=v-.5;c*=1.-uVig*dot(d,d)*1.5;
  c+=(h(floor(v*vec2(640.,750.))+fract(uTime*7.31))-.5)*uGrain;
  vec4 u=texture2D(uU,v);c=mix(c,u.rgb,u.a);
  gl_FragColor=vec4(c,1.);
}`,
};
function glSetup() {
  if (GLX.tried) return GLX.ok; GLX.tried = true;
  try {
    const c = document.createElement('canvas'); c.id = 'glv'; c.setAttribute('aria-hidden', 'true'); c.hidden = true; cv.after(c);
    const gl = c.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false, depth: false, stencil: false });
    if (!gl) { c.remove(); return false; }
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = fs => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, GLSL.vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, GLSL.head + fs)); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i), nm = a.name.replace(/\[0\]$/, ''); u[nm] = gl.getUniformLocation(p, a.name); } return { p, u }; };
    GLX.P = { scene: prog(GLSL.scene), bright: prog(GLSL.bright), blur: prog(GLSL.blur), final: prog(GLSL.final) };
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const tex = lin => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); const f = lin ? gl.LINEAR : gl.NEAREST; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
    Object.assign(GLX, { gl, canvas: c, tex, tG: tex(), tO: tex(), tU: tex(), lights: new Float32Array(MAXL * 4), colors: new Float32Array(MAXL * 3) });
    GLX.ox = document.createElement('canvas').getContext('2d'); GLX.ux = document.createElement('canvas').getContext('2d');
    c.addEventListener('webglcontextlost', e => { e.preventDefault(); GLX.on = false; GLX.ok = false; c.hidden = true; });
    GLX.ok = true; glResize();
  } catch (e) { GLX.ok = false; if (GLX.canvas) GLX.canvas.remove(); }
  return GLX.ok;
}
function glResize() {
  if (!GLX.ok) return; const gl = GLX.gl, W = cv.width, H = cv.height; if (!W) return;
  GLX.canvas.width = W; GLX.canvas.height = H; GLX.ox.canvas.width = GLX.ux.canvas.width = W; GLX.ox.canvas.height = GLX.ux.canvas.height = H;
  const target = (w, h, lin) => { const t = GLX.tex(lin); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return { t, f, w, h }; };
  for (const k of ['fS', 'fA', 'fB']) if (GLX[k]) { gl.deleteTexture(GLX[k].t); gl.deleteFramebuffer(GLX[k].f); }
  const bw = Math.max(1, Math.round(W / 4)), bh = Math.max(1, Math.round(H / 4));
  GLX.fS = target(W, H, true); GLX.fA = target(bw, bh, true); GLX.fB = target(bw, bh, true);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); GLX.groundDirty = true;
}
/* Turn lighting on or off from the Graphics setting (falls back to plain drawing without WebGL). */
function applyGfx() {
  const g = GX();
  // the 3D view replaces the 2D map (and its lighting engine) when chosen and WebGL2 is available
  R3.on = g.view === '3d' && r3Setup();
  if (R3.canvas) R3.canvas.hidden = !R3.on;
  GLX.on = !R3.on && !!g.light && glSetup();
  if (GLX.canvas) GLX.canvas.hidden = !GLX.on;
  if (g.view === '3d' && !R3.on && R3.tried) say('This device cannot run the 3D view, so the map stays 2D.');
  cv.style.filter = GLX.on ? '' : (LOOKS[g.look] || LOOKS.natural).css; // simple mode grades the colour with a CSS filter
  const mw = document.querySelector('.mapwrap'); if (mw) mw.classList.toggle('scan', !!g.scan);
  if (cv.width && GLX.res !== g.res) { GLX.res = g.res; fit(); }
  GLX.slow = 0; GLX.frames = 0;
}
/* Pick a preset, or change one detail (which makes the preset "custom"). */
function setGx(k, v) {
  const g = GX();
  if (k === 'preset') { Object.assign(g, GX_PRESETS[v]); g.preset = v; }
  else { g[k] = v; if (k in GX_PRESETS.high) g.preset = Object.keys(GX_PRESETS).find(p => Object.keys(GX_PRESETS[p]).every(q => GX_PRESETS[p][q] === g[q])) || 'custom'; }
  applyGfx(); if (k === 'light' && v && !GLX.on) say('This device cannot run the lighting engine, so lighting stays off.');
}
/* Every light in the scene this frame, strongest first. Positions in cells, y down. */
function gatherLights(time) {
  const L = [], n = FXS.night, add = (x, y, r, col, k) => { if (k > .02) L.push([x, y, r, col, k]); };
  const WARM = [1, .64, .32], LAMP = [1, .78, .48], TEAL = [.35, .95, .9], ICE = [.55, .9, 1], GOLD = [1, .85, .35], PINK = [1, .38, .5], FIRE = [1, .5, .18];
  const lamp = .12 + .88 * n;
  for (const [tx, ty] of [[VAULT[0] - .08, VAULT[1] - .05], [VAULT[0] - .08, VAULT[1] + 1.25]]) add(tx, ty - .35, 2.4, WARM, (.35 + .75 * n) * (.9 + Math.sin(time * 9 + ty) * .1));
  for (const b of BUILD) if (blv(b.def.id)) { const [sx, sy] = SLOT[b.def.id]; add(sx + 1, sy + 1.75, 1.35, LAMP, .5 * lamp * (.92 + Math.sin(time * 3 + sx) * .08)); }
  for (const id of ['market', 'hall', 'office']) add(SLOT[id][0] + 1, SLOT[id][1] + 1.75, 1.35, LAMP, .45 * lamp);
  for (const id of TOWN.forge) if (blv(id) && ACT[id] > .08) add(SLOT[id][0] + 1, SLOT[id][1] + 1.25, 2, FIRE, (.3 + .7 * n) * (.85 + Math.sin(time * 13 + SLOT[id][0]) * .15));
  for (const id of TOWN.glow) if (blv(id)) add(SLOT[id][0] + 1, SLOT[id][1] + 1.5, 1.4, TEAL, .55 * lamp);
  for (const t of S.towers) {
    const x = t.c + .5, y = t.r + .5, kick = t.kick > 0 ? t.kick / .12 : 0;
    if (t.type === 'frost') add(x, y - .25, 1.6, ICE, .3 + .5 * n);
    else if (t.type === 'tesla') add(x, y - .45, 1.8 + kick, t.br === 'b' ? PINK : GOLD, .35 + .55 * n + kick * .8);
    else if (kick > 0) add(x + Math.cos(t.aim || 0) * .55, y + Math.sin(t.aim || 0) * .55 - .15, 1.7, WARM, kick * 1.3);
  }
  for (const s of shots.slice(0, 14)) add(s.x + .5, s.y + .5, .9, s.kind === 'ball' ? FIRE : LAMP, .45 + .3 * n);
  for (const e of fx) {
    if (e.k === 'boom') add(e.x + .5, e.y + .5, e.r * 2.6 + 1, FIRE, 2.2 * Math.min(1, e.t * 4));
    else if (e.k === 'bolt') { const p = e.pts[e.pts.length - 1]; add(p[0] + .5, p[1] + .5, 1.6, e.c === '#ff8fb0' ? PINK : GOLD, 1.4 * e.t / .16); }
    else if (e.k === 'ring') add(e.x + .5, e.y + .5, e.r * 1.1, ICE, .6 * Math.min(1, e.t * 3));
    else if (e.k === 'cone') add(e.x + .5 + Math.cos(e.a) * .8, e.y + .5 + Math.sin(e.a) * .8, 2, WARM, 1.4 * e.t / .18);
  }
  for (const b of bombs) add(b.x + .5, b.y + .2, 1, FIRE, .9);
  for (const f of foes) if (f.rage) add(f.x + .5, f.y + .3, 1.3, FIRE, .7);
  if (FXS.flies && n > .05 && !REDUCED) for (const q of FXS.flies) add(q.x, q.y, .6, [.75, 1, .45], .7 * n * (.5 + .5 * Math.sin(time * 3 + q.ph)));
  L.sort((a, b) => b[4] * b[2] - a[4] * a[2]);
  return L.slice(0, MAXL);
}
/* Light for the time of day and the weather, shared by the 2D lighting engine and the 3D engine.
   n: night 0..1; amb: ambient colour; sunK: sun strength; az: the sun's slow sideways drift. */
function sceneLight(time) {
  const n = Math.min(1, FXS.night), dusk = Math.sin(Math.PI * n), wa = FXS.wxA || 0, wk = FXS.wxK;
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  // night stays readable (raiders must be visible on the road); dusk passes through a warm sunset
  let amb = mix([1, .98, .93], [.4, .42, .64], n);
  amb = mix(amb, [1.02, .66, .46], dusk * .55);
  const tint = wk === 'rain' ? [.74, .8, .94] : wk === 'dust' ? [1.06, .9, .72] : wk === 'heat' ? [1.08, .97, .84] : wk === 'moon' ? [1.05, 1.1, 1.3] : [1, 1, 1];
  amb = amb.map((v, i) => v * (1 + (tint[i] - 1) * wa));
  const sunK = (1 - n) * (wk === 'rain' ? 1 - .65 * wa : wk === 'dust' ? 1 - .45 * wa : 1);
  return { n, dusk, wa, wk, amb, sunK, az: Math.sin(time * .012) * .9 };
}
function glRender(time) {
  const gl = GLX.gl, W = cv.width, H = cv.height, P_ = GLX.P;
  const up = (t, src) => { gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); };
  if (GLX.groundDirty && ground) { up(GLX.tG, ground); GLX.groundDirty = false; }
  up(GLX.tO, GLX.ox.canvas); up(GLX.tU, GLX.ux.canvas);
  const pass = (prog, fbo, w, h, texs, set) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo ? fbo.f : null); gl.viewport(0, 0, w, h); gl.useProgram(prog.p);
    texs.forEach(([name, t], i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(prog.u[name], i); });
    set(prog.u); gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const { n, wa, wk, amb, sunK, az } = sceneLight(time), len = .62, dl = Math.hypot(az, 1);
  const shake = FXS.quake > 0 && !REDUCED && GX().shake ? [(Math.random() - .5) * FXS.quake * .5 / COLS, (Math.random() - .5) * FXS.quake * .5 / ROWS] : [0, 0];
  const Ls = gatherLights(time); GLX.nLights = Ls.length;
  Ls.forEach(([x, y, r, col, k], i) => { GLX.lights.set([x, ROWS - y, r, k], i * 4); GLX.colors.set(col, i * 3); });
  const g = GX(), shN = [0, 5, 8, 12][g.shadow] || 0, shK = [0, .75, 1, 1.12][g.shadow] || 0, shL = g.shadow >= 3 ? 1.35 : 1;
  pass(P_.scene, GLX.fS, W, H, [['uG', GLX.tG], ['uO', GLX.tO]], u => {
    gl.uniform2f(u.uShake, shake[0], shake[1]); gl.uniform2f(u.uSun, az / dl * len * shL / COLS, 1 / dl * len * shL / ROWS); gl.uniform2f(u.uGrid, COLS, ROWS);
    gl.uniform1i(u.uShN, shN); gl.uniform1f(u.uSunK, sunK * shK); gl.uniform1f(u.uTime, time); gl.uniform1f(u.uCloudK, (1 - n) * (1 + (wk === 'rain' ? .8 : 0) * wa)); gl.uniform1f(u.uNight, n);
    gl.uniform3f(u.uAmb, amb[0], amb[1], amb[2]); gl.uniform4fv(u.uL, GLX.lights); gl.uniform3fv(u.uC, GLX.colors); gl.uniform1i(u.uN, Ls.length);
  });
  // glow: off skips the bloom passes; strong blurs twice for a wider halo
  if (g.bloom > 0) {
    pass(P_.bright, GLX.fA, GLX.fA.w, GLX.fA.h, [['uS', GLX.fS.t]], u => gl.uniform1f(u.uT, .9 - .3 * n));
    for (let k = 0; k < (g.bloom >= 3 ? 2 : 1); k++) {
      pass(P_.blur, GLX.fB, GLX.fB.w, GLX.fB.h, [['uS', GLX.fA.t]], u => gl.uniform2f(u.uD, (1 + k) / GLX.fA.w, 0));
      pass(P_.blur, GLX.fA, GLX.fA.w, GLX.fA.h, [['uS', GLX.fB.t]], u => gl.uniform2f(u.uD, 0, (1 + k) / GLX.fA.h));
    }
  }
  const lk = LOOKS[g.look] || LOOKS.natural, bk = [0, .55, 1, 1.3][g.bloom] || 0;
  pass(P_.final, null, W, H, [['uS', GLX.fS.t], ['uB', GLX.fA.t], ['uU', GLX.tU]], u => {
    gl.uniform1f(u.uBloom, (.3 + .7 * n) * bk); gl.uniform1f(u.uVig, (.3 + .5 * n) * lk.vig); gl.uniform1f(u.uNight, n);
    gl.uniform1f(u.uSat, lk.sat - .12 * n + (wk === 'heat' ? .1 * wa : wk === 'dust' ? -.15 * wa : 0)); gl.uniform1f(u.uCon, lk.con);
    gl.uniform3f(u.uTint, lk.tint[0], lk.tint[1], lk.tint[2]); gl.uniform3f(u.uLift, lk.lift[0], lk.lift[1], lk.lift[2]);
    gl.uniform1f(u.uGrain, g.grain ? .075 : 0); gl.uniform1f(u.uTime, time);
  });
}
