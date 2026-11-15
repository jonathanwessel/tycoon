'use strict';
/* =========================================================
   Things that only exist to be looked at
   ========================================================= */
const SYS_REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
let REDUCED = SYS_REDUCED;
/* The motion setting: follow the device, or force calm or full motion. */
const GX = () => S.opt.gx;
function applyMotion() { const m = S.opt.calm; REDUCED = m === 'calm' ? true : m === 'full' ? false : SYS_REDUCED; document.documentElement.classList.toggle('calm', REDUCED); }
const CHIP = {}; let flyN = 0;
function bump(el) { if (el && el.animate && !REDUCED) el.animate([{ transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 180 }); }
function flyPx(icon, x0, y0, target) {
  if (REDUCED || flyN > 20 || !target || document.hidden) return;
  const tr = target.getBoundingClientRect(); if (!tr.width) return;
  const dx = tr.left + Math.min(tr.width / 2, 20) - x0, dy = tr.top + tr.height / 2 - y0;
  const im = document.createElement('img'); im.src = iconURL(icon); im.className = 'fly'; im.alt = ''; im.style.left = x0 - 11 + 'px'; im.style.top = y0 - 11 + 'px';
  document.body.append(im); flyN++;
  const a = im.animate([{ transform: 'translate(0,0) scale(1.2)' }, { transform: `translate(${dx * .35}px,${dy * .35 - 46}px) scale(1.5)`, offset: .4 }, { transform: `translate(${dx}px,${dy}px) scale(.8)` }], { duration: 620, easing: 'ease-in' });
  const end = () => { if (im.isConnected) { im.remove(); flyN--; bump(target); } }; a.onfinish = end; a.oncancel = end;
}
function fly(icon, gx, gy, target) { const r = cv.getBoundingClientRect(); if (r.width) flyPx(icon, r.left + gx / COLS * r.width, r.top + gy / ROWS * r.height, target); }
function flyFrom(icon, from, target) { const r = from.getBoundingClientRect(); if (r.width) flyPx(icon, r.left + r.width / 2, r.top + r.height / 2, target); }
const RATE = {}, lastRes = {}, HIST = {}; let rateT = 0, histT = 0;
function maker(k) {
  const b = BUILD.find(b => b.def.out === k);
  if (b && blv(b.def.id)) return b.def.id;
  return Object.keys(TOWN.tap).find(s => TOWN.tap[s] === k) || (b ? b.def.id : 'market'); // goods shipped in come from the market
}
function cosmetics(dt, time) {
  for (const k in FXS.shake) FXS.shake[k] = Math.max(0, FXS.shake[k] - dt);
  for (const k in FXS.gold) if ((FXS.gold[k] -= dt) <= 0) delete FXS.gold[k];
  for (const k in FXS.pop) if ((FXS.pop[k] -= dt) <= 0) delete FXS.pop[k];
  if (FXS.mend > 0) { FXS.mend -= dt; if (Math.random() < dt * 14) parts.push({ x: VAULT[0] + .5 + (Math.random() - .5) * .9, y: VAULT[1] + .5, vx: (Math.random() - .5) * 1.5, vy: -1 - Math.random(), g: 5, t: .5, c: Math.random() < .5 ? '#c9d2de' : '#a6b0c2', s: .06 }); }
  // explosions leave scorch marks that fade; walking raiders kick up dust; cannonballs trail smoke
  for (const e of fx) if (e.k === 'boom' && !e.sc) { e.sc = 1; if (FXS.scorch.length < 24) FXS.scorch.push({ x: e.x, y: e.y, r: Math.min(1.2, e.r * .55), t: 5 }); }
  for (const s of FXS.scorch) s.t -= dt; FXS.scorch = FXS.scorch.filter(s => s.t > 0);
  if (!REDUCED && GX().parts > 0) {
    for (const f of foes) if (!(f.stun > 0) && Math.random() < dt * (f.type === 'runner' || f.type === 'thief' ? 7 : 3.5) * GX().parts / 2) parts.push({ x: f.x + .5 - f.dir * .18, y: f.y + .78, vx: -f.dir * .35, vy: -.15, g: 0, t: .45, c: '#dcc59c', s: .06, smoke: 1 });
    for (const s of shots) if (s.kind === 'ball' && Math.random() < dt * 30) parts.push({ x: s.x + .5, y: s.y + .3, vx: 0, vy: -.25, g: 0, t: .4, c: '#cfc6b8', s: .05, smoke: 1 });
  }
  for (const f of floats) f.a = (f.a || 0) + dt;
  if (!FXS.flies) FXS.flies = Array.from({ length: 10 }, () => ({ x: Math.random() * COLS, y: YARD + Math.random() * (ROWS - YARD), a: Math.random() * 7, ph: Math.random() * 7 }));
  if (FXS.night > .05) for (const q of FXS.flies) { q.a += (Math.random() - .5) * dt * 4; q.x += Math.cos(q.a) * dt * .5; q.y += Math.sin(q.a) * dt * .5; if (q.x < 0 || q.x > COLS) q.a = Math.PI - q.a; if (q.y < YARD || q.y > ROWS) q.a = -q.a; q.x = Math.max(0, Math.min(COLS, q.x)); q.y = Math.max(YARD, Math.min(ROWS, q.y)); }
  FXS.quake = Math.max(0, FXS.quake - dt); FXS.flash = Math.max(0, FXS.flash - dt); FXS.car += dt;
  for (const k of corpses) k.t -= dt; corpses = corpses.filter(k => k.t > 0);
  for (const t of S.towers) if (t.born > 0) t.born = Math.max(0, t.born - dt);
  if (!REDUCED && weeds.length < 2 && Math.random() < dt / 14) weeds.push({ x: -1, y: YARD + .5 + Math.random() * (ROWS - YARD - 1.5), vx: 1.1 + Math.random() * .9, a: 0, ph: Math.random() * 6 });
  for (const w of weeds) { w.x += w.vx * dt; w.a += w.vx * dt * 2.4; } weeds = weeds.filter(w => w.x < COLS + 1);
  if (!FXS.clouds) FXS.clouds = [0, 1, 2].map(i => ({ x: Math.random() * COLS, y: Math.random() * ROWS, r: 2.2 + Math.random() * 1.6, v: .12 + Math.random() * .1 }));
  for (const cl of FXS.clouds) { cl.x += cl.v * dt; if (cl.x - cl.r > COLS) { cl.x = -cl.r; cl.y = Math.random() * ROWS; } }
  FXS.night += ((W.active ? 1 : 0) - FXS.night) * Math.min(1, dt * 1.2);
  if (FXS.banner && (FXS.banner.t -= dt) <= 0) FXS.banner = null;
  for (const p of parts) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; }
  const pcap = PCAP[GX().parts] || 320; parts = parts.filter(p => p.t > 0); if (parts.length > pcap) parts.splice(0, parts.length - pcap);
  for (const f of floats) { f.t -= dt; f.y -= dt * .9; } floats = floats.filter(f => f.t > 0);
  // smoke from working chimneys and jammed towers
  for (const [id, cxo, cyo] of [['smelt', 1.42, .25], ['eng', .55, .2], ['eng', 1.32, .2], ['mach', 1.5, .3], ['mill', 1.55, .1], ['autow', 1, .3], ['blast', 1.5, .05], ['boilerw', 1.45, .25], ['locow', .5, .2]])
    if (SLOT[id] && blv(id) && ACT[id] > .1 && Math.random() < dt * 5) parts.push({ x: SLOT[id][0] + cxo, y: SLOT[id][1] + cyo, vx: .2 + Math.random() * .3, vy: -.7, g: 0, t: 1.1, c: id === 'smelt' || id === 'mill' ? '#55506a' : '#d8d2c4', s: .11, smoke: 1 });
  for (const t of S.towers) if (t.jam > 0 && Math.random() < dt * 6) parts.push({ x: t.c + .4 + Math.random() * .3, y: t.r + .2, vx: .1, vy: -.6, g: 0, t: .9, c: '#55506a', s: .1, smoke: 1 });
  // porters carry goods along the supply chain
  const flows = [];
  for (const s of SHOPS) if (blv(s.id) && ACT[s.id] > .08) for (const k in s.in) flows.push([maker(k), s.id, k]);
  if (lv('ledger')) for (const k in ITEMS) if (S.auto[k] && S.seen[k]) { const m = maker(k); if (BY_ID[m] && blv(m)) flows.push([m, 'market', k]); }
  const hurry = 1 + .15 * perk('teams');
  for (const [a, b, k] of flows) {
    const key = a + b + k; FXS.flow[key] = (FXS.flow[key] === undefined ? Math.random() * 2 : FXS.flow[key]) - dt;
    if (FXS.flow[key] <= 0 && workers.length < 30) { FXS.flow[key] = 2.4 / hurry; const [x, y] = door(a), [tx, ty] = door(b); workers.push({ x, y, tx, ty, k }); }
  }
  for (const w of workers) { const dx = w.tx - w.x, dy = w.ty - w.y, q = Math.hypot(dx, dy), st = 1.7 * hurry * dt; if (q <= st) w.done = true; else { w.x += dx / q * st; w.y += dy / q * st; w.dir = dx >= 0 ? 1 : -1; } }
  workers = workers.filter(w => !w.done);
  // convoys on shipping routes that touch this town roll in and out past the market
  FXS.convoys = FXS.convoys || [];
  for (const r of S.routes) {
    if (r.paused || (r.from !== S.town && r.to !== S.town) || !townOpen(r.from) || !townOpen(r.to)) continue;
    r.cv = (r.cv === undefined ? Math.random() * 4 : r.cv) - dt;
    if (r.cv <= 0) { r.cv = 7; if (FXS.convoys.length < 6) FXS.convoys.push({ out: r.from === S.town, k: r.k, x: r.from === S.town ? 11.3 : 13.7 }); }
  }
  for (const v of FXS.convoys) v.x += (v.out ? 1 : -1) * 1.2 * dt;
  FXS.convoys = FXS.convoys.filter(v => v.out ? v.x < 13.9 : v.x > 11.1);
  // weather fades in and out with its wave; rain, dust and heat haze are particles
  const tw = wx(); if (tw) FXS.wxK = tw; FXS.wxA = (FXS.wxA || 0) + ((tw ? 1 : 0) - (FXS.wxA || 0)) * Math.min(1, dt * 1.5);
  FXS.wxp = FXS.wxp || [];
  if (!GX().weather) FXS.wxp.length = 0;
  if (!REDUCED && GX().weather && FXS.wxA > .05 && FXS.wxp.length < 150) {
    const k = FXS.wxK, n = k === 'rain' ? 70 : k === 'dust' ? 32 : k === 'heat' ? 4 : 0;
    for (let i = 0; i < n * dt * 4 * FXS.wxA; i++) FXS.wxp.push(k === 'rain' ? { k, x: Math.random() * (COLS + 3) - 1, y: -1, vx: -1.5, vy: 15, t: 2, land: 1 + Math.random() * (ROWS - 1) }
      : k === 'dust' ? { k, x: -1, y: Math.random() * ROWS, vx: 6 + Math.random() * 6, vy: (Math.random() - .5) * .8, t: 3, l: .3 + Math.random() * .7 }
      : { k, x: Math.random() * COLS, y: YARD + 1 + Math.random() * (ROWS - YARD - 1), vx: 0, vy: -.35, t: 2.5, ph: Math.random() * 7 });
  }
  for (const q of FXS.wxp) { q.t -= dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.k === 'rain' && q.y > q.land) { q.t = 0; if (Math.random() < .45) FXS.wxp.push({ k: 'splash', x: q.x, y: q.y, vx: 0, vy: 0, t: .3 }); } }
  FXS.wxp = FXS.wxp.filter(q => q.t > 0 && q.x < COLS + 2);
  // coins bounce out of fallen raiders; vultures circle; idle towers look around; a raging war wagon smokes
  for (const d of drops) { d.t -= dt; d.vz -= 14 * dt; d.z += d.vz * dt; d.x += d.vx * dt; if (d.z < 0) { d.z = 0; d.vz = Math.abs(d.vz) * .45; d.vx *= .6; } }
  drops = drops.filter(d => d.t > 0);
  if (!FXS.birds) FXS.birds = [0, 1].map(i => ({ cx: 3 + Math.random() * 6, cy: YARD + 2 + Math.random() * 4, r: 1.6 + Math.random(), a: Math.random() * 7, v: (.35 + Math.random() * .2) * (i ? -1 : 1) }));
  for (const b of FXS.birds) { b.a += b.v * dt; b.cx += Math.sin(time * .05 + b.r) * dt * .2; }
  for (const t of S.towers) if (t.cd < -1.5 && !(t.jam > 0)) t.aim = (t.aim || 0) + Math.sin(time * .8 + t.c * 1.7) * dt * .7;
  for (const f of foes) if (f.rage && Math.random() < dt * 12) parts.push({ x: f.x + .5 - f.dir * .3, y: f.y + .1, vx: -f.dir * .4, vy: -.8, g: 0, t: .9, c: '#4a4450', s: .12, smoke: 1 });
  rateT += dt; if (rateT >= 1) { for (const k in ITEMS) { const r = (S.res[k] - (lastRes[k] === undefined ? S.res[k] : lastRes[k])) / rateT; RATE[k] = RATE[k] === undefined ? r : RATE[k] * .6 + r * .4; lastRes[k] = S.res[k]; } rateT = 0; }
  histT += dt; if (histT >= 2) { histT = 0; for (const k in ITEMS) { (HIST[k] = HIST[k] || []).push(dem(k)); if (HIST[k].length > 45) HIST[k].shift(); } }
}
