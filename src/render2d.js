'use strict';
/* =========================================================
   Drawing
   ========================================================= */
const cv = document.getElementById('cv'), cx0 = cv.getContext('2d'); let cx = cx0, cell = 30, ground = null;
const renderScale = () => { const rs = GX().res || 1; return Math.max(.5, Math.min((window.devicePixelRatio || 1) * rs, rs > 1 ? 3 : 2)); };
function fit() {
  // the Resolution setting scales the render: below 1 is faster and blockier, above 1 renders sharper than the screen
  const w = cv.clientWidth || 360, dpr = renderScale();
  cv.width = Math.round(w * dpr); cv.height = Math.round(w * dpr * ROWS / COLS); cell = cv.width / COLS;
  bakeGround(); glResize();
}
function bakeGround() { if (!cv.width) return; ground = document.createElement('canvas'); ground.width = cv.width; ground.height = cv.height; bake(ground.getContext('2d'), cell); GLX.groundDirty = true; }
function sp(g, name, x, y, hgt, flip) {
  const im = SPR[name], w = hgt * im.width / im.height;
  if (flip) { g.save(); g.translate(x, y); g.scale(-1, 1); g.drawImage(im, -w / 2, -hgt / 2, w, hgt); g.restore(); } else g.drawImage(im, x - w / 2, y - hgt / 2, w, hgt);
}
function bake(g, c) {
  g.imageSmoothingEnabled = false; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#b99468'; g.fillRect(0, 0, c * COLS, c * YARD);
  for (let y = YARD; y < ROWS; y++) for (let x = 0; x < COLS; x++) { g.fillStyle = (x + y) % 2 ? '#d0aa76' : '#c9a26c'; g.fillRect(x * c, y * c, c + 1, c + 1); }
  // broad patches of lighter and darker earth so the ground does not read as a flat board
  for (let i = 0; i < 14; i++) { const x = rnd() * COLS * c, y = (YARD + rnd() * (ROWS - YARD)) * c, r = (1.2 + rnd() * 2) * c, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, i % 2 ? 'rgba(232,196,140,.35)' : 'rgba(150,104,62,.2)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  for (let i = 0; i < 600; i++) { const x = rnd() * COLS * c, y = rnd() * ROWS * c, s = Math.max(1, c * .05); g.fillStyle = i % 3 ? 'rgba(120,84,48,.28)' : 'rgba(255,236,190,.3)'; g.fillRect(Math.round(x), Math.round(y), s * (1 + (i % 2)), s); }
  const offRoad = (x, y) => y >= YARD && !PATH.has(Math.floor(x) + ',' + Math.floor(y));
  const px = Math.max(1, Math.round(c * .045));
  // dry grass tufts
  for (let i = 0; i < 46; i++) {
    const x = rnd() * COLS, y = YARD + .3 + rnd() * (ROWS - YARD - .3); if (!offRoad(x, y)) continue;
    const bx = Math.round(x * c), by = Math.round(y * c), cols = ['#8f8a3c', '#a9a24a', '#6f6a2c'];
    for (let j = -2; j <= 2; j++) { const hgt = px * (3 + (j === 0 ? 2 : Math.abs(j) === 1 ? 1 : 0)); g.fillStyle = cols[(j + 2) % 3]; g.fillRect(bx + j * px + (j < 0 ? -px * .5 : j > 0 ? px * .5 : 0), by - hgt, px, hgt); }
  }
  // pebbles with a lit top edge
  for (let i = 0; i < 60; i++) {
    const x = rnd() * COLS, y = YARD + rnd() * (ROWS - YARD); if (!offRoad(x, y)) continue;
    const bx = Math.round(x * c), by = Math.round(y * c), w = px * (1 + Math.floor(rnd() * 3)), hh = px * (1 + Math.floor(rnd() * 2));
    g.fillStyle = 'rgba(60,40,28,.35)'; g.fillRect(bx + px * .5, by + px * .5, w, hh);
    g.fillStyle = '#9a8e80'; g.fillRect(bx, by, w, hh); g.fillStyle = '#c9bfb0'; g.fillRect(bx, by, w, px * .6);
  }
  const line = (wd, col) => {
    g.strokeStyle = col; g.lineWidth = wd; g.lineJoin = 'miter'; g.lineCap = 'butt';
    for (const P_ of PATHS) { g.beginPath(); P_.way.forEach(([x, y], i) => { const px = (x + .5) * c, py = (y + .5) * c; i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.lineTo(VAULT[0] * c + c, VAULT[1] * c + c / 2); g.stroke(); }
  };
  // Trestle Bridge: a ravine with a creek at the bottom
  if (MAP.ravine) {
    const x0 = Math.min(...MAP.ravine) * c, x1 = (Math.max(...MAP.ravine) + 1) * c, y0 = YARD * c, y1 = ROWS * c, rg = g.createLinearGradient(x0, 0, x1, 0);
    rg.addColorStop(0, '#6a4630'); rg.addColorStop(.25, '#3a2419'); rg.addColorStop(.5, '#24160f'); rg.addColorStop(.75, '#3a2419'); rg.addColorStop(1, '#6a4630');
    g.fillStyle = rg; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    const mid = (x0 + x1) / 2; g.fillStyle = '#2f5d78'; g.fillRect(mid - c * .16, y0, c * .32, y1 - y0); g.fillStyle = '#5b9cc0';
    for (let y = y0; y < y1; y += c * .45) g.fillRect(mid - c * .1 + (Math.floor(y / c) % 2) * c * .08, y, c * .1, Math.max(1, c * .04));
    for (let y = y0; y < y1; y += px) { const j1 = Math.floor(rnd() * 3), j2 = Math.floor(rnd() * 3); g.fillStyle = '#9a6e4a'; g.fillRect(x0 - j1 * px, y, px * (1 + j1), px); g.fillRect(x1 - px, y, px * (1 + j2), px); g.fillStyle = 'rgba(30,18,12,.35)'; g.fillRect(x0 + px, y, px * 2, px); g.fillRect(x1 - px * 3, y, px * 2, px); }
  }
  line(c * 1.04, 'rgba(70,46,28,.35)'); line(c * .96, '#7a5a3e'); line(c * .84, '#9b7552'); line(c * .44, '#8a6645'); line(c * .34, '#9b7552');
  // wheel ruts and the stones kicked to the road's edge
  for (const P_ of PATHS) for (const s of P_.segs) {
    const hz = s.y1 === s.y2, ax = Math.min(s.x1, s.x2), bx = Math.max(s.x1, s.x2), ay = Math.min(s.y1, s.y2), by = Math.max(s.y1, s.y2);
    g.fillStyle = 'rgba(96,66,42,.5)';
    for (const o of [-.22, .22]) hz ? g.fillRect((ax + .5 - .2) * c, (ay + .5 + o) * c, (bx - ax + .4) * c, Math.max(1, c * .045)) : g.fillRect((ax + .5 + o) * c, (ay + .5 - .2) * c, Math.max(1, c * .045), (by - ay + .4) * c);
    for (let d = 0; d < s.len; d += .3) {
      if (rnd() < .45) continue; const t = d / s.len, x = s.x1 + (s.x2 - s.x1) * t, y = s.y1 + (s.y2 - s.y1) * t, side = rnd() < .5 ? -.5 : .5, j = (rnd() - .5) * .08;
      const sx = (x + .5 + (hz ? 0 : side + j)) * c, sy = (y + .5 + (hz ? side + j : 0)) * c, w = px * (1 + Math.floor(rnd() * 2));
      g.fillStyle = 'rgba(50,32,22,.4)'; g.fillRect(sx + px * .4, sy + px * .4, w, px); g.fillStyle = rnd() < .5 ? '#a89a88' : '#8f8170'; g.fillRect(sx, sy, w, px);
    }
  }
  if (MAP.ravine) for (const key of PATH) {
    const [bx, by] = key.split(',').map(Number); if (!MAP.ravine.includes(bx) || by < YARD) continue;
    const horiz = PATH.has((bx - 1) + ',' + by) || PATH.has((bx + 1) + ',' + by);
    g.fillStyle = '#2a1c22'; g.fillRect(bx * c - 1, by * c + c * .02, c + 2, c * .96);
    for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#a8703f' : '#b98250'; if (horiz) g.fillRect(bx * c + i * c / 6, by * c + c * .08, c / 6 - Math.max(1, px * .6), c * .84); else g.fillRect(bx * c + c * .08, by * c + i * c / 6, c * .84, c / 6 - Math.max(1, px * .6)); }
    g.fillStyle = '#5a3a22'; if (horiz) { g.fillRect(bx * c, by * c + c * .02, c, c * .07); g.fillRect(bx * c, by * c + c * .9, c, c * .07); } else { g.fillRect(bx * c + c * .02, by * c, c * .07, c); g.fillRect(bx * c + c * .9, by * c, c * .07, c); }
  }
  for (let p = 0; p < PATHS.length; p++) for (let i = 0; i < 70; i++) { const [x, y] = posAt(rnd() * PATHS[p].len, p); g.fillStyle = 'rgba(70,48,30,.35)'; g.fillRect((x + .5 + (rnd() - .5) * .7) * c, (y + .5 + (rnd() - .5) * .7) * c, c * .07, c * .05); }
  // worn footpaths between the rows of the yard
  for (const yy of [2, 4]) { g.fillStyle = 'rgba(255,236,190,.13)'; g.fillRect(0, yy * c - c * .12, c * COLS, c * .24); g.fillStyle = 'rgba(110,72,40,.12)'; g.fillRect(0, yy * c + c * .1, c * COLS, Math.max(1, c * .03)); }
  // yard fence and the dividers between yard rows
  g.fillStyle = '#6e4526'; g.fillRect(0, c * YARD - c * .1, c * COLS, c * .05); g.fillRect(0, c * YARD - c * .22, c * COLS, c * .04);
  for (let x = .2; x < COLS; x += .6) { g.fillStyle = '#8a5a34'; g.fillRect(x * c, c * YARD - c * .3, c * .08, c * .32); }
  for (const [x, y, s] of [[.55, 2.75, .8], [1.45, 2.6, .95], [1, 3.4, .85]]) sp(g, 'rock', x * c, y * c, s * c);
  // afternoon sun from the top left, and a soft darker rim
  const W_ = c * COLS, H_ = c * ROWS, sun = g.createLinearGradient(0, 0, W_, H_);
  sun.addColorStop(0, 'rgba(255,226,160,.16)'); sun.addColorStop(.5, 'rgba(255,226,160,0)'); sun.addColorStop(1, 'rgba(70,40,60,.14)');
  g.fillStyle = sun; g.fillRect(0, 0, W_, H_);
  const rim = g.createRadialGradient(W_ / 2, H_ / 2, Math.min(W_, H_) * .42, W_ / 2, H_ / 2, Math.max(W_, H_) * .72);
  rim.addColorStop(0, 'rgba(40,24,20,0)'); rim.addColorStop(1, 'rgba(40,24,20,.28)'); g.fillStyle = rim; g.fillRect(0, 0, W_, H_);
}
const TREES = [[.5, .75, 1.15], [1.45, .65, 1.25], [.95, 1.45, 1.2]];
const TOWER_TALL = { frost: 1, tesla: 1 };
function drawHead(t, x, y, c, k) {
  cx.save(); cx.translate(x, y - c * .16); cx.rotate(t.aim || 0); cx.translate(-k * c * .08, 0);
  const R = (col, a, b, w, h) => { cx.fillStyle = col; cx.fillRect(a * c, b * c, w * c, h * c); };
  if (t.type === 'crossbow') {
    const bow = (oy) => { R('#2a1c22', .16, -.32 + oy, .13, .64); R('#6e4526', .18, -.3 + oy, .09, .6); };
    if (t.br === 'b') { R('#2a1c22', -.2, -.08, .8, .16); R('#d9a066', -.18, -.05, .76, .1); R('#2a1c22', .02, -.2, .2, .1); R('#5b8be0', .04, -.18, .16, .06); bow(0); R('#c9d2de', .5, -.03, .14, .06); }
    else { R('#2a1c22', -.14, -.08, .52, .16); R('#d9a066', -.12, -.05, .48, .1); bow(0); if (t.br === 'a') { bow(.0); R('#2a1c22', .02, -.36, .13, .72); R('#a8703f', .04, -.34, .09, .68); } R('#c9d2de', .3, -.03, .14, .06); }
  } else if (t.type === 'cannon') {
    if (t.br === 'a') { R('#2a1c22', -.18, -.22, .5, .44); R('#4b5468', -.15, -.19, .44, .38); R('#7a8499', -.15, -.19, .44, .1); R('#2a1c22', .24, -.24, .12, .48); }
    else if (t.br === 'b') { R('#2a1c22', -.14, -.14, .5, .28); R('#4b5468', -.11, -.11, .44, .22); R('#2a1c22', .3, -.24, .18, .48); R('#7a8499', .32, -.2, .14, .4); }
    else { R('#2a1c22', -.14, -.16, .62, .32); R('#4b5468', -.11, -.13, .56, .26); R('#7a8499', -.11, -.13, .56, .07); R('#2a1c22', .36, -.17, .1, .34); }
    if (k > .3) { cx.fillStyle = '#fff0a0'; cx.beginPath(); cx.arc(c * .6, 0, c * .2 * k, 0, 7); cx.fill(); }
  } else if (t.type === 'gatling') {
    R('#2a1c22', -.16, -.18, .4, .36); R('#4a5a78', -.13, -.15, .34, .3);
    const n = t.br === 'a' ? 2 : 1;
    for (let j = 0; j < n; j++) { const oy = n === 2 ? (j ? .09 : -.09) : 0; R('#2a1c22', .16, -.1 + oy, .42, .2); R(t.br === 'b' ? '#3a2a2e' : '#7d8fb0', .18, -.07 + oy, .38, .05); R(t.br === 'b' ? '#3a2a2e' : '#b8c6e0', .18, -.01 + oy, .38, .03); }
    if (k > .3) { cx.fillStyle = '#fff0a0'; cx.fillRect(c * .58, -c * .08, c * .16 * k, c * .16); }
  }
  cx.restore();
}
function draw(time) {
  // Lit mode draws sprites onto a transparent objects layer for the lighting engine; plain mode draws straight to the screen.
  const LIT = GLX.on, c = cell, X = x => (x + .5) * c, Y = y => (y + .5) * c;
  cx = LIT ? GLX.ox : cx0; if (LIT) { cx.clearRect(0, 0, cv.width, cv.height); GLX.ux.clearRect(0, 0, cv.width, cv.height); } cx.imageSmoothingEnabled = false;
  cx.save(); if (!LIT && FXS.quake > 0 && !REDUCED && GX().shake) cx.translate((Math.random() - .5) * FXS.quake * c * .5, (Math.random() - .5) * FXS.quake * c * .5);
  if (!LIT) cx.drawImage(ground, 0, 0);
  // town yard
  const tsh = FXS.shake.trees > 0 ? Math.sin(time * 70) * c * .05 : 0, rsh = FXS.shake.rocks > 0 ? Math.sin(time * 80) * c * .04 : 0;
  for (const [x, y, s] of TREES) sp(cx, 'tree', x * c + tsh, y * c, s * c);
  if (rsh) sp(cx, 'rock', 1.45 * c + rsh, 2.6 * c, .95 * c);
  cx.font = '700 ' + Math.max(9, c * .3) + 'px "Barlow Semi Condensed", sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  // name tags are labels, not scenery: in lit mode they go on the unlit overlay so they stay readable and cast no shadow
  const tg = LIT ? GLX.ux : cx; tg.font = cx.font; tg.textAlign = 'center'; tg.textBaseline = 'middle';
  const tag = (txt, x, y, col) => { const tw = tg.measureText(txt).width + c * .16; tg.fillStyle = 'rgba(22,26,42,.85)'; tg.fillRect(x - tw / 2, y - c * .17, tw, c * .34); tg.fillStyle = col || '#ece6d8'; tg.fillText(txt, x, y + 1); };
  for (const b of BUILD) {
    const id = b.def.id, l = blv(id), [sx, sy] = SLOT[id], bx = (sx + 1) * c, by = (sy + .95) * c;
    const on = b.kind === 'ext' || ACT[id] > .08, name = id === 'saw' && on && Math.floor(time * 8) % 2 ? 'saw_b' : id;
    if (sel && sel.b === b) { cx.fillStyle = 'rgba(255,240,160,.35)'; cx.fillRect(sx * c + c * .08, sy * c + c * .08, c * 1.84, c * 1.84); }
    if (FXS.gold[id]) { const a = Math.min(1, FXS.gold[id]); cx.fillStyle = 'rgba(242,208,74,' + .45 * a + ')'; cx.fillRect(sx * c, sy * c, c * 2, c * 2); }
    if (!l) {
      cx.globalAlpha = .3; sp(cx, id, bx, by, c * 1.6); cx.globalAlpha = 1;
      cx.fillStyle = S.coins >= b.def.cost ? '#e38d4e' : '#5a4a44'; cx.beginPath(); cx.arc(bx, by + c * .1, c * .26, 0, 7); cx.fill();
      cx.fillStyle = '#20130a'; cx.fillRect(bx - c * .15, by + c * .06, c * .3, c * .08); cx.fillRect(bx - c * .04, by - c * .05, c * .08, c * .3);
      continue;
    }
    const bob = id === 'drill' || id === 'pit' ? Math.abs(Math.sin(time * 5)) * c * .05 : on && b.kind === 'shops' ? Math.abs(Math.sin(time * 9)) * c * .02 : 0;
    const spd = S.ot > 0 ? 3 : 1, bob2 = bob * (S.ot > 0 ? 1.6 : 1);
    cx.fillStyle = 'rgba(40,24,14,.22)'; cx.beginPath(); cx.ellipse(bx + c * .08, by + c * .74, c * .78, c * .15, 0, 0, 7); cx.fill();
    const pq = FXS.pop[id] > 0 && !REDUCED ? 1 - FXS.pop[id] / .45 : 1;
    if (pq < 1) { const w = Math.sin(pq * Math.PI * 2.5) * (1 - pq) * .16; cx.save(); cx.translate(bx, by + c * .85); cx.scale(1 + w, 1 - w); sp(cx, name, 0, -c * .85 - bob2, c * 1.7); cx.restore(); }
    else sp(cx, name, bx, by - bob2, c * 1.7);
    if (MS(l)) { const m = MS(l), fx_ = (sx + 1.72) * c, fy = (sy + .22) * c, wv = Math.sin(time * 4 * spd + sx) * c * .03; cx.fillStyle = '#2a1c22'; cx.fillRect(fx_, fy, c * .05, c * .42); cx.fillStyle = m >= 4 ? '#f2d04a' : m >= 3 ? '#ff4f8b' : m >= 2 ? '#56d3c6' : '#e38d4e'; cx.beginPath(); cx.moveTo(fx_ + c * .05, fy); cx.lineTo(fx_ + c * .3, fy + c * .08 + wv); cx.lineTo(fx_ + c * .05, fy + c * .17); cx.fill(); }
    tag('Lv ' + l, bx, (sy + 1.88) * c);
    const ms = Math.min(5, MS(l)); for (let i = 0; i < ms; i++) sp(cx, 'star', bx + (i - (ms - 1) / 2) * c * .26, (sy + .2) * c, c * .26);
    if (S.mgr[id]) sp(cx, Math.floor(time * 2 + sx) % 2 ? 'foreman_b' : 'foreman', (sx + 1.78) * c, (sy + 1.45) * c, c * .55, true);
    if (b.kind === 'shops' && !on) {
      const ux = (sx + 1.55) * c, uy = (sy + .42) * c; cx.fillStyle = '#ece6d8'; cx.strokeStyle = '#2a1c22'; cx.lineWidth = Math.max(1, c * .04);
      cx.beginPath(); cx.arc(ux, uy, c * .3, 0, 7); cx.fill(); cx.stroke();
      if (S.off[id]) { cx.fillStyle = '#2a1c22'; cx.fillRect(ux - c * .13, uy - c * .14, c * .09, c * .28); cx.fillRect(ux + c * .04, uy - c * .14, c * .09, c * .28); }
      else if (STARVE[id] && Math.floor(time * 2) % 2 === 0) sp(cx, STARVE[id], ux, uy, c * .4);
      else if (STARVE[id]) { cx.fillStyle = '#f07067'; cx.fillRect(ux - c * .04, uy - c * .17, c * .08, c * .2); cx.fillRect(ux - c * .04, uy + c * .09, c * .08, c * .08); }
    }
  }
  sp(cx, 'market', 11 * c, .95 * c, c * 1.7);
  sp(cx, 'hall', 9 * c, 4.95 * c, c * 1.7); tag('Foremen', 9 * c, 5.88 * c);
  sp(cx, 'office', 11 * c, 4.95 * c, c * 1.7); tag(S.deeds ? S.deeds + ' deeds' : 'Deeds', 11 * c, 5.88 * c, S.deeds ? '#f2d04a' : null);
  const ct = FXS.car, moving = ct < 1 || ct > 2.6, carX = ct < 1 ? 13.2 - 2.2 * ct : ct < 2.6 ? 11 : 11 + (ct - 2.6) * 2.4;
  if (carX < 13.3) sp(cx, Math.floor(time * 8) % 2 && moving ? 'wagon_b' : 'wagon', carX * c, 2.95 * c + (moving ? Math.sin(time * 20) * c * .02 : 0), c * 1.2, ct < 2.6);
  else sp(cx, 'sign', 11 * c, 3.1 * c, c * .9);
  for (const w of workers) { const wy = w.y * c - Math.abs(Math.sin(time * 12 + w.tx)) * c * .04; sp(cx, Math.floor(time * 8 + w.tx) % 2 ? 'worker_b' : 'worker', w.x * c, wy, c * .5, w.dir < 0); sp(cx, w.k, w.x * c, wy - c * .38, c * .34); }
  // cacti, unless a tower stands there
  for (const [x, y] of CACTI) if (!S.towers.some(t => t.c === x && t.r === y)) { cx.fillStyle = 'rgba(40,24,14,.2)'; cx.beginPath(); cx.ellipse((x + .36) * c, (y + .58) * c, c * .2, c * .06, 0, 0, 7); cx.fill(); sp(cx, 'cactus', (x + .3) * c, (y + .34) * c, c * .5); }
  for (const [x, y, k, r] of DECOR) if (!S.towers.some(t => t.c === x && t.r === y) && !(sel && sel.plot && sel.plot[0] === x && sel.plot[1] === y)) {
    const ox = (x + .3 + r * .4) * c, oy = (y + .55) * c, hh = k === 'skull' ? c * .22 : k === 'wheel' ? c * .38 : c * .36;
    cx.fillStyle = 'rgba(40,24,14,.22)'; cx.beginPath(); cx.ellipse(ox, oy + hh * .45, hh * .55, hh * .18, 0, 0, 7); cx.fill();
    sp(cx, k, ox, oy, hh, r > .5);
  }
  // vault
  const vq = FXS.flash > 0 ? Math.sin(time * 90) * c * .04 : 0; sp(cx, 'vault', X(VAULT[0]) - c * .06 + vq, Y(VAULT[1]) - c * .1, c * 1.08);
  const hpF = S.vaultHp / vaultMax(), vx = X(VAULT[0]), vy = Y(VAULT[1]);
  if (hpF < .67) { cx.strokeStyle = '#2a1c22'; cx.lineWidth = Math.max(1, c * .05); cx.beginPath(); cx.moveTo(vx - c * .4, vy - c * .45); cx.lineTo(vx - c * .2, vy - c * .2); cx.lineTo(vx - c * .36, vy + c * .1); if (hpF < .34) { cx.moveTo(vx + c * .36, vy - c * .5); cx.lineTo(vx + c * .2, vy - c * .2); cx.lineTo(vx + c * .34, vy + .2 * c); } cx.stroke(); }
  cx.fillStyle = 'rgba(22,26,42,.8)'; cx.fillRect(vx - c * .45, vy + c * .5, c * .9, c * .12); cx.fillStyle = hpF > .5 ? '#7fd992' : hpF > .25 ? '#f2d04a' : '#f07067'; cx.fillRect(vx - c * .45, vy + c * .5, c * .9 * Math.max(0, hpF), c * .12);
  // reinforcement shows every 4 levels: iron bands, sandbags, stone wall, flag
  const vl = lv('vault'), px_ = Math.max(1, c * .05);
  if (vl >= 4) { cx.fillStyle = '#2a1c22'; for (const oy of [-.3, .18]) cx.fillRect(vx - c * .5, vy + oy * c, c * .92, c * .09); cx.fillStyle = '#6a6372'; for (const oy of [-.3, .18]) { cx.fillRect(vx - c * .48, vy + oy * c + px_ * .4, c * .88, c * .04); for (const ox of [-.4, 0, .34]) { cx.fillStyle = '#c9d2de'; cx.fillRect(vx + ox * c, vy + oy * c + px_ * .3, px_, px_); cx.fillStyle = '#6a6372'; } } }
  if (vl >= 8) for (let i = 0; i < 5; i++) { const bx_ = vx - c * .56 + i * c * .27, by2 = vy + c * .44 + (i % 2) * c * .04; cx.fillStyle = '#2a1c22'; cx.beginPath(); cx.ellipse(bx_, by2, c * .16, c * .1, 0, 0, 7); cx.fill(); cx.fillStyle = i % 2 ? '#c9a476' : '#d9b886'; cx.beginPath(); cx.ellipse(bx_, by2 - px_ * .3, c * .14, c * .08, 0, 0, 7); cx.fill(); }
  if (vl >= 12) for (const sx_ of [-1, 1]) for (let i = 0; i < 3; i++) { const wx_ = vx + sx_ * c * .72 - c * .13, wy = vy - c * .45 + i * c * .3; cx.fillStyle = '#2a1c22'; cx.fillRect(wx_, wy, c * .26, c * .28); cx.fillStyle = i % 2 ? '#8f9bb0' : '#a6b0c2'; cx.fillRect(wx_ + px_ * .5, wy + px_ * .5, c * .26 - px_, c * .28 - px_); cx.fillStyle = '#c9d2de'; cx.fillRect(wx_ + px_ * .5, wy + px_ * .5, c * .26 - px_, px_ * .6); }
  if (vl >= 16) { const fx0 = vx + c * .42, fy0 = vy - c * .95, wv = Math.sin(time * 5) * c * .04; cx.fillStyle = '#2a1c22'; cx.fillRect(fx0, fy0, c * .05, c * .55); cx.fillStyle = '#e38d4e'; cx.beginPath(); cx.moveTo(fx0 + c * .05, fy0); cx.lineTo(fx0 + c * .36, fy0 + c * .08 + wv); cx.lineTo(fx0 + c * .05, fy0 + c * .18); cx.fill(); cx.fillStyle = '#f2d04a'; cx.fillRect(fx0 + c * .1, fy0 + c * .06, c * .06, c * .06); }
  // masons at work after a repair
  if (FXS.mend > 0) for (const sx_ of [-1, 1]) {
    const mx = vx + sx_ * c * .62, my = vy + c * .2, swing = Math.sin(time * 18 + sx_) ;
    sp(cx, Math.floor(time * 8) % 2 ? 'worker_b' : 'worker', mx, my, c * .5, sx_ > 0);
    cx.save(); cx.translate(mx - sx_ * c * .1, my - c * .08); cx.rotate(-sx_ * (.6 + swing * .6)); cx.fillStyle = '#6e4526'; cx.fillRect(-c * .02, -c * .2, c * .04, c * .2); cx.fillStyle = '#8f9bb0'; cx.fillRect(-c * .06, -c * .24, c * .12, c * .06); cx.restore();
  }
  const torches = [[VAULT[0] - .08, VAULT[1] - .05], [VAULT[0] - .08, VAULT[1] + 1.25]];
  for (const [tx, ty] of torches) { cx.fillStyle = '#6e4526'; cx.fillRect(tx * c - c * .04, ty * c - c * .3, c * .08, c * .36); cx.fillStyle = '#f5a04a'; cx.beginPath(); cx.arc(tx * c, ty * c - c * .36, c * (.1 + Math.sin(time * 14 + ty) * .02), 0, 7); cx.fill(); cx.fillStyle = '#fff0a0'; cx.beginPath(); cx.arc(tx * c, ty * c - c * .34, c * .05, 0, 7); cx.fill(); }
  // reach of the selected tower
  if (sel && sel.plot) {
    const [pc, pr] = sel.plot, pu = .5 + Math.sin(time * 6) * .2;
    cx.fillStyle = 'rgba(255,240,160,.1)'; cx.strokeStyle = 'rgba(42,28,34,.55)'; cx.lineWidth = c * .04; cx.setLineDash([c * .16, c * .12]); cx.beginPath(); cx.arc(X(pc), Y(pr), 2.4 * c, 0, 7); cx.fill(); cx.stroke(); cx.setLineDash([]);
    cx.strokeStyle = 'rgba(255,240,160,' + pu + ')'; cx.lineWidth = c * .08; cx.strokeRect(pc * c + c * .08, pr * c + c * .08, c * .84, c * .84);
    cx.fillStyle = 'rgba(255,240,160,' + pu * .4 + ')'; cx.fillRect(pc * c + c * .08, pr * c + c * .08, c * .84, c * .84);
  }
  if (sel && sel.t) { const st = towerStats(sel.t); cx.fillStyle = 'rgba(255,240,160,.12)'; cx.strokeStyle = 'rgba(42,28,34,.7)'; cx.lineWidth = c * .05; cx.setLineDash([c * .16, c * .12]); cx.beginPath(); cx.arc(X(sel.t.c), Y(sel.t.r), st.range * c, 0, 7); cx.fill(); cx.stroke(); cx.setLineDash([]); }
  for (const s of FXS.scorch) { cx.fillStyle = 'rgba(48,30,22,' + .32 * Math.min(1, s.t / 2) + ')'; cx.beginPath(); cx.ellipse(X(s.x), Y(s.y) + c * .1, s.r * c, s.r * c * .55, 0, 0, 7); cx.fill(); }
  // mouse hover: outline whatever a click would pick
  if (hov && !sel) {
    const [hx, hy] = hov; cx.strokeStyle = 'rgba(255,240,160,.55)'; cx.lineWidth = Math.max(1, c * .05);
    if (hy < YARD) { const id = slotAt(hx, hy); if (id && id !== 'trees' && id !== 'rocks') { const [sx, sy] = SLOT[id]; cx.strokeRect(sx * c + c * .1, sy * c + c * .1, c * 1.8, c * 1.8); } }
    else if (!onRoad(Math.floor(hx), Math.floor(hy))) cx.strokeRect(Math.floor(hx) * c + c * .08, Math.floor(hy) * c + c * .08, c * .84, c * .84);
  }
  // fallen raiders and tumbleweeds lie under everything else
  for (const k of corpses) { const D = FOES[k.type], hgt = D.size * c, a = Math.min(1, k.t * 2.5), fall = Math.min(1, (.8 - k.t) * 6); cx.globalAlpha = a; cx.save(); cx.translate(X(k.x), Y(k.y) + hgt * .1 * fall); cx.rotate(k.dir * fall * 1.45); sp(cx, k.type, 0, -hgt * .2, hgt); cx.restore(); }
  cx.globalAlpha = 1;
  for (const d of drops) {
    const a = Math.min(1, d.t * 3), spin = Math.abs(Math.cos(d.t * 12)), s = c * .26;
    cx.globalAlpha = a * .3; cx.fillStyle = '#28180e'; cx.beginPath(); cx.ellipse(d.x * c, d.y * c + s * .35, s * .45, s * .15, 0, 0, 7); cx.fill();
    cx.globalAlpha = a; cx.drawImage(SPR.coin, d.x * c - s * spin / 2, (d.y - d.z) * c - s / 2, Math.max(1, s * spin), s);
  }
  cx.globalAlpha = 1;
  for (const w of weeds) { const bounce = Math.abs(Math.sin(w.a * 1.3 + w.ph)) * c * .22; cx.fillStyle = 'rgba(40,24,14,.2)'; cx.beginPath(); cx.ellipse(w.x * c, (w.y + .3) * c, c * .22, c * .06, 0, 0, 7); cx.fill(); cx.save(); cx.translate(w.x * c, w.y * c - bounce); cx.rotate(w.a); sp(cx, 'tumble', 0, 0, c * .5); cx.restore(); }
  for (const b of bombs) { const pr = 1 - b.t / .7, sx0 = X(VAULT[0]), sy0 = Y(VAULT[1]), bx = sx0 + (X(b.x) - sx0) * pr, by_ = sy0 + (Y(b.y) - sy0) * pr - Math.sin(pr * Math.PI) * c * 2; cx.save(); cx.translate(bx, by_); cx.rotate(pr * 9); sp(cx, 'dynamite', 0, 0, c * .55); cx.restore(); cx.fillStyle = Math.floor(time * 24) % 2 ? '#fff0a0' : '#f5a04a'; cx.beginPath(); cx.arc(bx, by_ - c * .3, c * .07, 0, 7); cx.fill(); }
  // towers and raiders, back to front
  const things = [...S.towers.map(t => ({ y: t.r, t })), ...foes.map(f => ({ y: f.y, f }))].sort((a, b) => a.y - b.y);
  for (const o of things) {
    if (o.t) {
      const t = o.t, x = X(t.c), y = Y(t.r), pop = t.born > 0 ? 1 - t.born / .35 : 1, born = pop < 1 ? .5 + .5 * pop + Math.sin(pop * Math.PI) * .25 : 1, big = (1 + Math.min(t.lvl, 8) * .035) * born, k = t.kick > 0 ? t.kick / .12 : 0;
      cx.fillStyle = 'rgba(40,24,14,.25)'; cx.beginPath(); cx.ellipse(x, y + c * .36, c * .42, c * .14, 0, 0, 7); cx.fill();
      // a stone footing under every tower
      cx.fillStyle = '#4e423e'; cx.beginPath(); cx.ellipse(x, y + c * .3, c * .4 * born, c * .15 * born, 0, 0, 7); cx.fill();
      cx.fillStyle = '#8a7a6e'; cx.beginPath(); cx.ellipse(x, y + c * .27, c * .37 * born, c * .12 * born, 0, 0, 7); cx.fill();
      cx.fillStyle = '#a69686'; for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; cx.fillRect(x + Math.cos(a) * c * .3 * born - c * .03, y + c * .27 + Math.sin(a) * c * .09 * born - c * .015, c * .06, c * .03); }
      const body = t.br ? t.type + '_' + t.br : t.type;
      if (t.jam > 0) cx.globalAlpha = .55;
      sp(cx, body, x, y - (TOWER_TALL[t.type] ? c * .08 : 0), c * .95 * big);
      if (t.type === 'crossbow' || t.type === 'cannon' || t.type === 'gatling') drawHead(t, x, y, c, k);
      cx.globalAlpha = 1;
      if (t.jam > 0) { cx.strokeStyle = '#f07067'; cx.lineWidth = c * .07; cx.beginPath(); cx.moveTo(x - c * .25, y - c * .25); cx.lineTo(x + c * .25, y + c * .25); cx.moveTo(x + c * .25, y - c * .25); cx.lineTo(x - c * .25, y + c * .25); cx.stroke(); }
      if (t.lvl) { const n = Math.min(t.lvl, 5); cx.fillStyle = '#2a1c22'; cx.fillRect(x - n * c * .07 - c * .03, y + c * .34, n * c * .14 + c * .06, c * .14); cx.fillStyle = t.lvl > 5 ? '#ff4f8b' : '#f2d04a'; for (let i = 0; i < n; i++) cx.fillRect(x - n * c * .07 + i * c * .14 + c * .02, y + c * .37, c * .1, c * .08); }
      if (t.br) { cx.fillStyle = '#2a1c22'; cx.fillRect(x + c * .3, y - c * .5, c * .05, c * .32); cx.fillStyle = t.br === 'a' ? '#56d3c6' : '#ff4f8b'; cx.fillRect(x + c * .35, y - c * .5, c * .16, c * .12); }
    } else {
      const f = o.f, D = FOES[f.type], x = X(f.x), hgt = D.size * c, bobY = f.type === 'runner' || f.type === 'thief' ? Math.abs(Math.sin(time * 14 + f.d)) * c * .06 : 0;
      const y = Y(f.y) - hgt * .22 - (f.stun > 0 ? 0 : bobY);
      const fr = f.stun > 0 ? '' : Math.floor(time * (f.type === 'runner' ? 10 : 6) + f.d * 2) % 2 ? '_b' : '';
      cx.fillStyle = 'rgba(40,24,14,.28)'; cx.beginPath(); cx.ellipse(x, Y(f.y) + hgt * .28, hgt * .36, hgt * .1, 0, 0, 7); cx.fill();
      if (D.heal) { cx.fillStyle = 'rgba(127,217,146,' + (.18 + Math.sin(time * 4 + f.d) * .08) + ')'; cx.beginPath(); cx.arc(x, y, hgt * .7, 0, 7); cx.fill(); }
      const tint = f.flash > 0 ? '_w' : f.slow > 0 || (f.stun > 0 && f.ice) ? '_i' : '';
      sp(cx, f.type + fr + tint, x, y, hgt, f.dir < 0);
      if (f.sh > 0) { sp(cx, 'buckler' + (f.flash > 0 ? '_w' : ''), x + f.dir * hgt * .32, y + hgt * .08, hgt * .62, f.dir < 0); }
      if (f.stun > 0 && f.ice) { cx.fillStyle = 'rgba(220,245,255,.4)'; cx.strokeStyle = 'rgba(255,255,255,.8)'; cx.lineWidth = Math.max(1, c * .03); cx.fillRect(x - hgt * .45, y - hgt * .5, hgt * .9, hgt); cx.strokeRect(x - hgt * .45, y - hgt * .5, hgt * .9, hgt); }
      else if (f.stun > 0) { for (let i = 0; i < 3; i++) { const a = time * 6 + i * 2.1; cx.fillStyle = '#f2d04a'; cx.fillRect(x + Math.cos(a) * hgt * .35 - c * .03, y - hgt * .55 + Math.sin(a) * hgt * .1, c * .06, c * .06); } }
      if (f.brit > 0) { cx.strokeStyle = '#c7a0ff'; cx.lineWidth = Math.max(1, c * .025); cx.beginPath(); cx.moveTo(x - hgt * .2, y - hgt * .3); cx.lineTo(x, y - hgt * .05); cx.lineTo(x - hgt * .1, y + hgt * .2); cx.moveTo(x + hgt * .2, y - hgt * .2); cx.lineTo(x + hgt * .05, y); cx.stroke(); }
      if (f.fuse > 0) { const fx_ = x + f.dir * hgt * .3, fy = y - hgt * .45; cx.fillStyle = Math.floor(time * 20) % 2 ? '#fff0a0' : '#f5a04a'; cx.beginPath(); cx.arc(fx_, fy, c * (.06 + Math.random() * .04), 0, 7); cx.fill(); }
      if (f.hp < f.max && f.type !== 'boss') { const bw = Math.max(c * .5, hgt * .8); cx.fillStyle = '#2a1c22'; cx.fillRect(x - bw / 2 - 1, y - hgt * .62 - 1, bw + 2, c * .09 + 2); cx.fillStyle = '#f07067'; cx.fillRect(x - bw / 2, y - hgt * .62, bw, c * .09); cx.fillStyle = '#7fd992'; cx.fillRect(x - bw / 2, y - hgt * .62, bw * Math.max(0, f.hp / f.max), c * .09); }
    }
  }
  for (const s of shots) {
    if (s.kind === 'ball') { const pr = 1 - Math.min(1, s.q / s.q0 || 0), lift = Math.sin(pr * Math.PI) * c * .5; cx.fillStyle = 'rgba(40,24,14,.3)'; cx.beginPath(); cx.ellipse(X(s.x), Y(s.y) + c * .1, c * .1, c * .05, 0, 0, 7); cx.fill(); cx.fillStyle = '#2a1c22'; cx.beginPath(); cx.arc(X(s.x), Y(s.y) - lift, c * .12, 0, 7); cx.fill(); cx.fillStyle = '#7a8499'; cx.beginPath(); cx.arc(X(s.x) - c * .03, Y(s.y) - lift - c * .03, c * .05, 0, 7); cx.fill(); }
    else if (s.kind === 'bullet') { cx.save(); cx.translate(X(s.x), Y(s.y)); cx.rotate(s.ang); const tg = cx.createLinearGradient(-c * .6, 0, 0, 0); tg.addColorStop(0, 'rgba(255,240,160,0)'); tg.addColorStop(1, 'rgba(255,240,160,.55)'); cx.fillStyle = tg; cx.fillRect(-c * .6, -c * .02, c * .6, c * .04); cx.restore(); cx.save(); cx.translate(X(s.x), Y(s.y)); cx.rotate(s.ang); cx.fillStyle = s.pierce ? '#ff8fb0' : '#fff0a0'; cx.fillRect(-c * .14, -c * .025, c * .2, c * .05); cx.restore(); }
    else { cx.save(); cx.translate(X(s.x), Y(s.y)); cx.rotate(s.ang); const tg = cx.createLinearGradient(-c * .8, 0, -c * .2, 0); tg.addColorStop(0, 'rgba(255,255,255,0)'); tg.addColorStop(1, 'rgba(255,255,255,.4)'); cx.fillStyle = tg; cx.fillRect(-c * .8, -c * .025, c * .6, c * .05); cx.fillStyle = '#2a1c22'; cx.fillRect(-c * .24, -c * .04, c * .34, c * .08); cx.fillStyle = '#d9a066'; cx.fillRect(-c * .22, -c * .02, c * .26, c * .04); cx.fillStyle = '#c9d2de'; cx.fillRect(c * .02, -c * .05, c * .1, c * .1); cx.restore(); }
  }
  for (const e of fx) {
    if (e.k === 'ring') { cx.strokeStyle = e.c; cx.globalAlpha = Math.min(1, e.t * 3); cx.lineWidth = c * .08; cx.beginPath(); cx.arc(X(e.x), Y(e.y), e.r * c * (1 - e.t * 1.2), 0, 7); cx.stroke(); cx.fillStyle = e.c; cx.globalAlpha = e.t * .5; cx.fill(); }
    else if (e.k === 'boom') {
      const q = Math.max(0, 1 - e.t / (e.d || .3)); cx.globalAlpha = (1 - q) * .7; cx.strokeStyle = '#fff6d8'; cx.lineWidth = c * .1 * (1 - q) + 1; cx.beginPath(); cx.arc(X(e.x), Y(e.y), e.r * c * (.4 + q * 1.1), 0, 7); cx.stroke();
      cx.globalAlpha = 1 - q; cx.fillStyle = '#c4452f'; cx.beginPath(); cx.arc(X(e.x), Y(e.y), e.r * c * (.36 + q * .72), 0, 7); cx.fill();
      cx.fillStyle = '#f5a04a'; cx.beginPath(); cx.arc(X(e.x), Y(e.y), e.r * c * (.3 + q * .6), 0, 7); cx.fill(); cx.fillStyle = '#fff0a0'; cx.beginPath(); cx.arc(X(e.x), Y(e.y), e.r * c * (.15 + q * .35), 0, 7); cx.fill();
    }
    else if (e.k === 'cone') { cx.globalAlpha = e.t / .18 * .6; cx.fillStyle = '#fff0a0'; cx.beginPath(); cx.moveTo(X(e.x), Y(e.y)); cx.arc(X(e.x), Y(e.y), e.r * c, e.a - .5, e.a + .5); cx.closePath(); cx.fill(); }
    else if (e.k === 'bolt') { for (const [wd, col] of [[c * .16, e.c], [c * .06, '#fff']]) { cx.globalAlpha = wd > c * .1 ? .6 : 1; cx.strokeStyle = col; cx.lineWidth = wd; cx.lineJoin = 'round'; cx.beginPath(); e.pts.forEach(([x, y], i) => i ? cx.lineTo(X(x), Y(y)) : cx.moveTo(X(x), Y(y))); cx.stroke(); } }
    cx.globalAlpha = 1;
  }
  for (const p of parts) {
    cx.globalAlpha = Math.min(1, p.t * 2.5) * (p.smoke ? .7 : 1); cx.fillStyle = p.c; const s = p.s * c * (p.smoke ? 2.2 - p.t : 1);
    if (p.plus) { cx.fillRect(p.x * c - s / 2, p.y * c - s * .15, s, s * .3); cx.fillRect(p.x * c - s * .15, p.y * c - s / 2, s * .3, s); }
    else if (p.smoke) { cx.beginPath(); cx.arc(p.x * c, p.y * c, s * .55, 0, 7); cx.fill(); }
    else cx.fillRect(p.x * c - s / 2, p.y * c - s / 2, s, s);
  }
  cx.globalAlpha = 1;
  // dusk falls while raiders are on the road (passing through a sunset on the way); fires and crystals glow through it
  const dusk = Math.sin(Math.PI * Math.min(1, FXS.night));
  if (!LIT && dusk > .02) { cx.fillStyle = 'rgba(255,118,52,' + .2 * dusk + ')'; cx.fillRect(-c, -c, cv.width + 2 * c, cv.height + 2 * c); }
  if (!LIT && FXS.night > .02) {
    cx.fillStyle = 'rgba(26,22,72,' + (.36 * FXS.night) + ')'; cx.fillRect(-c, -c, cv.width + 2 * c, cv.height + 2 * c);
    cx.globalCompositeOperation = 'lighter';
    const glow = (x, y, r, col) => { const g = cx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); cx.fillStyle = g; cx.fillRect(x - r, y - r, r * 2, r * 2); };
    const a = FXS.night;
    for (const [tx, ty] of torches) glow(tx * c, ty * c - c * .3, c * (1.5 + Math.sin(time * 9 + ty) * .1), 'rgba(245,160,74,' + .5 * a + ')');
    for (const t of S.towers) if (t.type === 'frost') glow(X(t.c), Y(t.r) - c * .2, c * 1.1, 'rgba(143,232,255,' + .4 * a + ')'); else if (t.type === 'tesla') glow(X(t.c), Y(t.r) - c * .4, c * (1 + (t.kick > 0 ? .6 : 0)), (t.br === 'b' ? 'rgba(255,90,120,' : 'rgba(242,208,74,') + .45 * a + ')');
    for (const id of ['smelt', 'mill']) if (blv(id) && ACT[id] > .08) glow((SLOT[id][0] + 1) * c, (SLOT[id][1] + 1.3) * c, c * 1.1, 'rgba(245,160,74,' + .45 * a + ')');
    for (const s of shots) glow(X(s.x), Y(s.y), c * .45, 'rgba(255,220,140,' + .35 * a + ')');
    // lamps come on in every working building
    for (const b of BUILD) if (blv(b.def.id)) { const [sx, sy] = SLOT[b.def.id]; glow((sx + 1) * c, (sy + 1.45) * c, c * .75, 'rgba(255,196,110,' + .32 * a * (.9 + Math.sin(time * 3 + sx) * .1) + ')'); }
    for (const id of ['market', 'hall', 'office']) glow((SLOT[id][0] + 1) * c, (SLOT[id][1] + 1.45) * c, c * .75, 'rgba(255,196,110,' + .3 * a + ')');
    for (const e of fx) if (e.k === 'boom') glow(X(e.x), Y(e.y), e.r * c * 2, 'rgba(255,150,60,' + .6 * a * Math.min(1, e.t * 4) + ')');
    if (FXS.flies && !REDUCED) for (const q of FXS.flies) { const tw = .5 + .5 * Math.sin(time * 3 + q.ph); glow(q.x * c, q.y * c, c * .35, 'rgba(210,255,130,' + .55 * a * tw + ')'); cx.fillStyle = 'rgba(240,255,190,' + a * tw + ')'; cx.fillRect(q.x * c - 1, q.y * c - 1, 2, 2); }
    cx.globalCompositeOperation = 'source-over';
  }
  // weather on top of the light
  if (FXS.wxA > .02 && FXS.wxK) {
    const a = FXS.wxA, k = FXS.wxK;
    if (!LIT) { cx.fillStyle = k === 'dust' ? 'rgba(214,170,110,' + .3 * a + ')' : k === 'rain' ? 'rgba(55,75,115,' + .26 * a + ')' : k === 'heat' ? 'rgba(255,150,60,' + .14 * a + ')' : 'rgba(190,210,255,' + .1 * a + ')'; cx.fillRect(-c, -c, cv.width + 2 * c, cv.height + 2 * c); }
    for (const q of FXS.wxp) {
      if (q.k === 'rain') { cx.strokeStyle = 'rgba(200,222,255,' + .55 * a + ')'; cx.lineWidth = Math.max(1, c * .03); cx.beginPath(); cx.moveTo(q.x * c, q.y * c); cx.lineTo((q.x + .05) * c, (q.y - .45) * c); cx.stroke(); }
      else if (q.k === 'splash') { cx.strokeStyle = 'rgba(200,222,255,' + a * q.t * 2 + ')'; cx.lineWidth = Math.max(1, c * .025); cx.beginPath(); cx.ellipse(q.x * c, q.y * c, c * (.22 - q.t * .4), c * (.08 - q.t * .15), 0, 0, 7); cx.stroke(); }
      else if (q.k === 'dust') { cx.fillStyle = 'rgba(244,222,180,' + .55 * a + ')'; cx.fillRect(q.x * c, q.y * c, q.l * c, Math.max(1, c * .035)); }
      else if (q.k === 'heat') { cx.fillStyle = 'rgba(255,236,200,' + .1 * a * Math.min(1, q.t) + ')'; for (let i = 0; i < 8; i++) cx.fillRect((q.x + i * .18) * c, (q.y + Math.sin(q.ph + i * .9 + time * 4) * .08) * c, c * .18, Math.max(1, c * .05)); }
    }
    if (k === 'moon' && !LIT) {
      const mx = cv.width - c * .9, my = c * .9;
      cx.globalCompositeOperation = 'lighter'; const g = cx.createRadialGradient(mx, my, 0, mx, my, c * 2.2); g.addColorStop(0, 'rgba(220,230,255,' + .35 * a + ')'); g.addColorStop(1, 'rgba(0,0,0,0)'); cx.fillStyle = g; cx.fillRect(mx - c * 2.2, my - c * 2.2, c * 4.4, c * 4.4); cx.globalCompositeOperation = 'source-over';
      cx.globalAlpha = a; sp(cx, 'w_moon', mx, my, c * .9); cx.globalAlpha = 1;
    }
  }
  // drifting cloud shadows, and a darker edge at night
  if (FXS.clouds && !LIT) for (const cl of FXS.clouds) { const g = cx.createRadialGradient(cl.x * c, cl.y * c, 0, cl.x * c, cl.y * c, cl.r * c); g.addColorStop(0, 'rgba(40,30,60,.13)'); g.addColorStop(1, 'rgba(40,30,60,0)'); cx.fillStyle = g; cx.fillRect((cl.x - cl.r) * c, (cl.y - cl.r) * c, cl.r * 2 * c, cl.r * 2 * c); }
  if (!LIT && FXS.night > .02) { const g = cx.createRadialGradient(cv.width / 2, cv.height * .6, cv.width * .35, cv.width / 2, cv.height * .6, cv.width * .85); g.addColorStop(0, 'rgba(10,8,30,0)'); g.addColorStop(1, 'rgba(10,8,30,' + .45 * FXS.night + ')'); cx.fillStyle = g; cx.fillRect(-c, -c, cv.width + 2 * c, cv.height + 2 * c); }
  // vultures circle high over the road, their shadows far below
  if (FXS.birds && !REDUCED) for (const b of FXS.birds) {
    const bx = (b.cx + Math.cos(b.a) * b.r) * c, by = (b.cy + Math.sin(b.a) * b.r * .6) * c, ang = b.a + (b.v > 0 ? Math.PI / 2 : -Math.PI / 2);
    cx.fillStyle = 'rgba(40,24,14,.16)'; cx.beginPath(); cx.ellipse(bx + c * .9, by + c * 1.6, c * .32, c * .1, 0, 0, 7); cx.fill();
    cx.save(); cx.translate(bx, by); cx.rotate(Math.cos(ang) * .3); sp(cx, Math.floor(time * 3 + b.r) % 4 === 0 ? 'bird_b' : 'bird', 0, 0, c * .32, b.v < 0); cx.restore();
  }
  // from here on: things that are not lit (numbers, flashes, banners) go on the overlay layer
  if (LIT) {
    cx.restore(); cx = GLX.ux; cx.imageSmoothingEnabled = false; cx.save();
    if (FXS.night > .05 && FXS.flies && !REDUCED) for (const q of FXS.flies) { const tw = .5 + .5 * Math.sin(time * 3 + q.ph); cx.fillStyle = 'rgba(240,255,190,' + FXS.night * tw + ')'; cx.fillRect(q.x * c - 1, q.y * c - 1, Math.max(2, c * .06), Math.max(2, c * .06)); }
    if (FXS.wxK === 'moon' && FXS.wxA > .02) { cx.globalAlpha = FXS.wxA; sp(cx, 'w_moon', cv.width - c * .9, c * .9, c * .9); cx.globalAlpha = 1; }
  }
  if (FXS.flash > 0) { cx.fillStyle = 'rgba(240,112,103,' + FXS.flash + ')'; cx.fillRect(-c, -c, cv.width + 2 * c, cv.height + 2 * c); }
  cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.lineJoin = 'round';
  for (const f of floats) { cx.globalAlpha = Math.min(1, f.t * 3); cx.font = '700 ' + Math.max(9, f.z * c * (1 + .55 * Math.max(0, 1 - (f.a || 0) / .16))) + 'px "Barlow Semi Condensed", sans-serif'; cx.lineWidth = Math.max(2, c * .08); cx.strokeStyle = '#2a1c22'; const hw = cx.measureText(f.s).width / 2 + 3, fx_ = Math.max(hw, Math.min(cv.width - hw, f.x * c)); cx.strokeText(f.s, fx_, f.y * c); cx.fillStyle = f.c; cx.fillText(f.s, fx_, f.y * c); }
  cx.globalAlpha = 1;
  cx.restore();
  // the war wagon gets a proper health bar across the top of the map
  const boss = foes.find(f => f.type === 'boss' && f.hp > 0);
  if (boss) {
    const bx = c * .45, bw = cv.width - c * .9, by = c * .5, bh = c * .24, fr = Math.max(0, boss.hp / boss.max);
    cx.fillStyle = 'rgba(22,26,42,.88)'; cx.fillRect(bx - c * .12, by - c * .42, bw + c * .24, bh + c * .56);
    cx.textAlign = 'left'; cx.textBaseline = 'middle'; cx.font = '700 ' + Math.max(9, c * .26) + 'px "Barlow Semi Condensed", "Arial Narrow", sans-serif';
    cx.fillStyle = '#ff8fb0'; cx.fillText('WAR WAGON' + (boss.rage ? ' · FULL STEAM' : boss.ph1 ? ' · CREW OFF' : ' · STOP IT BEFORE THE VAULT'), bx, by - c * .2);
    cx.textAlign = 'right'; cx.fillStyle = '#ece6d8'; cx.fillText(fmt(Math.max(0, boss.hp)), bx + bw, by - c * .2); cx.textAlign = 'center';
    cx.fillStyle = '#3a1c26'; cx.fillRect(bx, by, bw, bh);
    const g = cx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#f07067'); g.addColorStop(1, '#ff4f8b'); cx.fillStyle = g; cx.fillRect(bx, by, bw * fr, bh);
    cx.fillStyle = 'rgba(255,255,255,.25)'; cx.fillRect(bx, by, bw * fr, bh * .3);
    cx.fillStyle = 'rgba(236,230,216,.7)'; for (const m of [.5, .25]) cx.fillRect(bx + bw * m - 1, by - c * .04, Math.max(2, c * .04), bh + c * .08);
  }
  if (FXS.banner && !paused) {
    // the band opens from its middle, the words slide in from the left and leave to the right
    const b = FXS.banner; b.T = b.T || b.t;
    const inP = Math.min(1, (b.T - b.t) / .4), outP = Math.min(1, b.t / .35), ease = 1 - Math.pow(1 - inP, 3), back = 1 + 2.2 * Math.pow(inP - 1, 3) + 1.2 * Math.pow(inP - 1, 2);
    const by = (YARD + 3.5) * c, hh = c * (b.b ? 1.7 : 1.3) * (REDUCED ? 1 : ease), top = by - c * .75 + c * (b.b ? 1.7 : 1.3) / 2 - hh / 2;
    const slide = REDUCED ? 0 : (1 - back) * -cv.width * .6 + (1 - outP) * cv.width * .5, accent = b.gold ? '#f2d04a' : S.wave % 10 === 0 && !b.gold ? '#f07067' : '#e38d4e';
    cx.globalAlpha = Math.max(0, Math.min(1, outP * 1.4));
    cx.fillStyle = 'rgba(22,26,42,.84)'; cx.fillRect(0, top, cv.width, hh);
    cx.fillStyle = accent; cx.fillRect(0, top, cv.width, Math.max(1, c * .05)); cx.fillRect(0, top + hh - Math.max(1, c * .05), cv.width, Math.max(1, c * .05));
    if (hh > c * .5) for (const ex of [c * .55, cv.width - c * .55]) for (const ey of [top + c * .3, top + hh - c * .3]) { cx.save(); cx.translate(ex, ey); cx.rotate(Math.PI / 4); cx.fillRect(-c * .08, -c * .08, c * .16, c * .16); cx.restore(); }
    cx.save(); cx.beginPath(); cx.rect(0, top, cv.width, hh); cx.clip(); cx.translate(slide, 0);
    cx.fillStyle = accent; cx.font = c * .8 + 'px Rye, Rockwell, Georgia, serif'; cx.fillText(b.a, cv.width / 2, by - c * .1);
    if (b.b) { cx.fillStyle = '#ece6d8'; cx.font = '600 ' + c * .36 + 'px "Barlow Semi Condensed", "Arial Narrow", sans-serif'; cx.fillText(b.b, cv.width / 2, by + c * .58); }
    cx.restore(); cx.globalAlpha = 1;
  }
  if (LIT) glRender(time);
  cx = cx0;
}
