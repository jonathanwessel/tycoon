'use strict';
/* =========================================================
   Combat
   ========================================================= */
let foes = [], shots = [], fx = [], parts = [], floats = [], workers = [], bombs = [], corpses = [], weeds = [], drops = [], sel = null;
const FXS = { shake: {}, gold: {}, pop: {}, scorch: [], quake: 0, night: 0, banner: null, flash: 0, car: 9, lastCoin: 0, flow: {} };
const W = { active: false, queue: [], next: null, ntype: 'mixed', type: 'mixed', shown: null, spawnT: 0, gap: .7, countdown: 30, spawned: 0, hpm: 1 };
const foeHp = w => 10 * Math.pow(1.25, w - 1) * (1 + w * .05);
const foeCoins = w => 2 * Math.pow(1.12, w - 1) * (1 + .2 * lv('bounty'));
function planWave() {
  const w = S.wave; let type = 'mixed';
  if (w >= 4 && w % 10 !== 0) { const o = Object.keys(WTYPES).filter(k => k !== W.type && w >= WTYPES[k].from); type = o[Math.floor(Math.random() * o.length)]; }
  const T = WTYPES[type], n = Math.max(4, Math.round(Math.min(8 + Math.floor(w * 1.1), 36) * T.count)), pool = [];
  for (const k in T.w) if (w >= UNLOCK[k]) for (let i = 0; i < T.w[k]; i++) pool.push(k);
  if (!pool.length) pool.push('raider');
  const q = []; for (let i = 0; i < n; i++) q.push(pool[Math.floor(Math.random() * pool.length)]);
  if (w % 10 === 0) q.push('boss');
  W.next = q; W.nextFor = w; W.ntype = type;
  const wk = Object.keys(WEATHER); W.nweather = w >= 6 && w % 10 !== 0 && Math.random() < .35 ? wk[Math.floor(Math.random() * wk.length)] : null;
}
function startWave() {
  if (W.active) return;
  if (W.countdown > 0 && S.autoWave) { const b = Math.ceil(foeCoins(S.wave) * W.countdown / 4); earn(b); say('Called early: +' + fmt(b) + ' coins.'); }
  if (!W.next || W.nextFor !== S.wave) planWave();
  const T = WTYPES[W.ntype];
  W.queue = W.next; W.next = null; W.type = W.ntype; W.hpm = T.hp; W.active = true; W.spawnT = 0; W.spawned = 0; W.total = W.queue.length;
  W.weather = W.nweather || null; W.nweather = null; W.leaks = 0;
  W.gap = Math.max(.25, .75 - S.wave * .01) * T.gap;
  FXS.banner = { t: 2.4, a: 'Wave ' + S.wave, b: (S.wave % 10 === 0 ? 'War wagon: stop it or lose the vault' : T.n) + (W.weather ? ' · ' + WEATHER[W.weather].n : '') };
  snd('wave', 220, .25, 'sawtooth', .04, 220);
}
function spawn(type) {
  const p = W.spawned++ % PATHS.length, hp = foeHp(S.wave) * FOES[type].hp * (type === 'boss' ? 1 : W.hpm) * MAP.hp, [x, y] = posAt(0, p);
  foes.push({ type, p, d: 0, hp, max: hp, slow: 0, stun: 0, brit: 0, sh: FOES[type].shield || 0, x, y, dir: 1, flash: 0, num: 0, ht: 1.5 });
  // every raider kicks up a puff of dust as it rides in; the war wagon shakes the ground
  for (let i = 0; i < (type === 'boss' ? 22 : 5); i++) parts.push({ x: x + .4 + Math.random() * .4, y: y + .5 + (Math.random() - .5) * .6, vx: Math.random() * 1.2, vy: -.3 - Math.random() * .5, g: 0, t: .7, c: '#dcc59c', s: .09, smoke: 1 });
  if (type === 'boss') { FXS.quake = Math.max(FXS.quake, .9); FXS.bossIn = 2.5; snd('rumble', 55, .7, 'sawtooth', .08, -15); floats.push({ x: x + 1.2, y: y - .3, t: 1.6, s: 'War wagon!', c: '#ff8fb0', z: .45 }); }
}
function spawnAt(type, from, back) {
  const hp = foeHp(S.wave) * FOES[type].hp * W.hpm * MAP.hp, d = Math.max(0, from.d - back), [x, y] = posAt(d, from.p);
  foes.push({ type, p: from.p, d, hp, max: hp, slow: 0, stun: 0, brit: 0, sh: FOES[type].shield || 0, x, y, dir: from.dir, flash: 0, num: 0, ht: 1.5 });
}
function hurt(f, dmg, o) {
  if (f.hp <= 0) return;
  if (f.sh > 0 && !(o && o.pierce)) {
    if (o && o.splash) { f.sh = 0; } else { f.sh--; f.flash = .05; }
    for (let i = 0; i < 4; i++) parts.push({ x: f.x + .5 + f.dir * .2, y: f.y + .4, vx: (Math.random() - .5) * 3, vy: -1 - Math.random() * 2, g: 8, t: .3, c: P.steelL, s: .06 });
    if (f.sh <= 0) { floats.push({ x: f.x + .5, y: f.y, t: .8, s: 'Shield broken', c: P.steelL, z: .26 }); snd('clang', 1500, .06, 'square', .03, -900); }
    if (!(o && o.splash)) return;
  }
  if (f.brit > 0) dmg *= 1.3;
  if (onBridge(f)) dmg *= 1.25;
  f.hp -= dmg; f.flash = .09;
  if (f.num <= 0 && floats.length < 40 && S.opt.nums !== false) { f.num = .35; floats.push({ x: f.x + .5, y: f.y, t: .6, s: fmt(Math.max(1, dmg)), c: '#fff', z: .26 }); }
  if (f.hp <= 0) {
    const D = FOES[f.type], c = foeCoins(S.wave) * D.rw * MAP.coin; earn(c); S.stats.kills++;
    if (f.type === 'boss') {
      const bonus = Math.ceil(foeCoins(S.wave) * 15 * MAP.coin); earn(bonus); S.stats.bosses = (S.stats.bosses || 0) + 1;
      fx.push({ k: 'boom', x: f.x, y: f.y, r: 2.2, t: .6, d: .6 }); FXS.quake = 1; FXS.flash = .15; snd('kaboom', 60, .7, 'sawtooth', .1, -30);
      FXS.banner = { t: 2.8, a: 'War wagon destroyed', b: '+' + fmt(bonus) + ' bonus coins', gold: 1, boss: 1 };
      for (let i = 0; i < 40; i++) parts.push({ x: f.x + .5, y: f.y + .5, vx: (Math.random() - .5) * 9, vy: -2 - Math.random() * 6, g: 9, t: 1 + Math.random() * .6, c: [P.yel, P.yelL, '#8a6a48', P.steelL, P.org][i % 5], s: .1 + Math.random() * .06 });
      for (let i = 0; i < 10; i++) setTimeout(() => fly('coin', f.x + .5 + (Math.random() - .5), f.y + .5, $('hCoinWrap')), i * 70);
    }
    if (!REDUCED) for (let i = 0; i < (f.type === 'boss' ? 6 : 1 + (Math.random() < .4)); i++) drops.push({ x: f.x + .5, y: f.y + .55, z: 0, vz: 3 + Math.random() * 2, vx: (Math.random() - .5) * 1.6, t: 1.1 });
    if (corpses.length < 40) corpses.push({ type: f.type, x: f.x, y: f.y, dir: f.dir, t: .8 });
    for (let i = 0; i < 7; i++) parts.push({ x: f.x + .5, y: f.y + .5, vx: (Math.random() - .5) * 4, vy: -1 - Math.random() * 3, g: 9, t: .5, c: i % 2 ? D.c : P.white, s: .08 });
    floats.push({ x: f.x + .5, y: f.y + .2, t: .9, s: '+' + fmt(Math.max(1, c)), c: P.yel, z: .34 });
    const now = performance.now(); if (now - FXS.lastCoin > 90) { FXS.lastCoin = now; fly('coin', f.x + .5, f.y + .5, $('hCoinWrap')); snd('coin', 880, .06, 'square', .03, 440); }
    if (perk('loot') && Math.random() < .1 * perk('loot')) {
      const pool = Object.keys(ITEMS).filter(k => S.seen[k]), k = pool[Math.floor(Math.random() * pool.length)], n = Math.ceil((1 + S.wave / 4) * 8 / ITEMS[k].p);
      add(k, n); fly(k, f.x + .5, f.y + .5, CHIP[k]); floats.push({ x: f.x + .5, y: f.y - .2, t: .9, s: '+' + n + ' ' + ITEMS[k].n.toLowerCase(), c: P.tealL, z: .28 });
    }
  }
}
function towerStats(t) {
  const d = TOWERS[t.type], b = t.br ? BRANCH[t.type][t.br] : {}, w = wx();
  const wr = w === 'dust' && t.type !== 'frost' && t.type !== 'tesla' ? .75 : 1, wd = (w === 'rain' && t.type === 'crossbow' ? .85 : 1) * (w === 'moon' ? 1.1 : 1);
  return {
    dmg: d.dmg * (b.dmg || 1) * Math.pow(1.45, t.lvl) * dmgMult() * wd, range: (d.range + (b.range || 0) + Math.min(1, t.lvl * .06)) * wr, rate: d.rate * (b.rate || 1),
    splash: b.splash || d.splash || 0, chain: b.chain || d.chain || 0, falloff: b.falloff || .7, slow: d.slow || 0,
    cone: b.cone, freeze: b.freeze, brittle: b.brittle, stun: b.stun, pierce: b.pierce,
  };
}
const towerCount = type => S.towers.filter(t => t.type === type).length;
const buildCost = type => Math.ceil(TOWERS[type].coins * Math.pow(1.2, towerCount(type)));
const upCost = t => Math.ceil(TOWERS[t.type].coins * .8 * Math.pow(1.75, t.lvl));
const needsBranch = t => t.lvl >= 4 && !t.br;
const branchCost = t => upCost(t) * 2;
function upgradeTower(t) { if (needsBranch(t)) return false; const c = upCost(t); if (S.coins < c) return false; S.coins -= c; t.lvl++; snd('build', 440, .12, 'triangle', .05, 440); return true; }
function branchTower(t, b) { if (!needsBranch(t)) return false; const c = branchCost(t); if (S.coins < c) return false; S.coins -= c; t.br = b; t.lvl++; snd('ms', 660, .25, 'triangle', .06, 440); for (let i = 0; i < 14; i++) parts.push({ x: t.c + .5, y: t.r + .5, vx: Math.cos(i) * 2, vy: Math.sin(i) * 2 - 1, g: 2, t: .7, c: P.yel, s: .08 }); return true; }
function buildTower(type, c, r) {
  const d = TOWERS[type], cost = buildCost(type);
  if (S.coins < cost || !hasGoods(d.goods)) return false;
  S.coins -= cost; for (const k in d.goods) S.res[k] -= d.goods[k];
  S.towers.push({ c, r, type, lvl: 0, tg: 'first' }); return true;
}
function pickTarget(t, st) {
  let best = null, bv = 0; const mode = t.tg || 'first';
  for (const f of foes) {
    if (f.hp <= 0 || Math.hypot(f.x - t.c, f.y - t.r) > st.range) continue;
    const v = mode === 'strong' ? f.hp : mode === 'weak' ? -f.hp : f.d / PATHS[f.p].len;
    if (!best || v > bv) { best = f; bv = v; }
  }
  return best;
}
/* Vault repairs: coins for strength, only while the road is clear. */
const repairCost = () => Math.ceil(foeCoins(S.wave) * 4 * MAP.coin);
function repair(n) {
  if (W.active) { say('Repair the vault between waves.'); return false; }
  n = Math.min(n, vaultMax() - S.vaultHp); if (n <= 0) return false;
  const c = repairCost() * n; if (S.coins < c) return false;
  S.coins -= c; S.vaultHp += n; S.stats.repairs = (S.stats.repairs || 0) + n; FXS.mend = 1.4;
  floats.push({ x: VAULT[0] + .5, y: VAULT[1] - .3, t: 1.3, s: '+' + n + ' strength', c: P.grnL, z: .34 });
  snd('build', 520, .12, 'triangle', .05, 260); return true;
}
function leak(f) {
  const D = FOES[f.type]; f.hp = 0;
  if (D.thief) {
    const ks = Object.keys(ITEMS).filter(k => S.res[k] >= 1).sort((a, b) => S.res[b] * ITEMS[b].p - S.res[a] * ITEMS[a].p);
    if (ks.length) { const k = ks[0], n = Math.max(1, Math.floor(S.res[k] * .1)); S.res[k] -= n; floats.push({ x: VAULT[0] + .2, y: VAULT[1] - .2, t: 1.2, s: '-' + fmt(n) + ' ' + ITEMS[k].n.toLowerCase(), c: P.red, z: .32 }); }
    FXS.flash = .12; snd('steal', 300, .15, 'triangle', .05, -150); return;
  }
  // a war wagon that reaches the vault smashes it, however strong it is: it has to be destroyed to get past its wave
  if (f.type === 'boss') {
    S.vaultHp = 0; W.smashed = 1; W.leaks = (W.leaks || 0) + 1; FXS.quake = 1.2; FXS.flash = .5;
    fx.push({ k: 'boom', x: VAULT[0], y: VAULT[1], r: 1.8, t: .6, d: .6 }); snd('kaboom', 50, .8, 'sawtooth', .1, -25);
    return;
  }
  S.vaultHp -= D.leak; W.leaks = (W.leaks || 0) + 1;
  const stolen = Math.min(S.coins * .05, foeCoins(S.wave) * 10); S.coins -= stolen;
  FXS.quake = .35; FXS.flash = .3; snd('hit', 110, .2, 'sawtooth', .07, -60);
  if (stolen >= 1) floats.push({ x: VAULT[0] + .5, y: VAULT[1], t: 1, s: '-' + fmt(stolen), c: P.red, z: .36 });
}
function combat(dt) {
  if (!W.active) {
    if (!W.next || W.nextFor !== S.wave) planWave();
    if (S.autoWave) { W.countdown -= dt; if (W.countdown <= 0) { W.countdown = 0; startWave(); } }
  } else {
    W.spawnT -= dt;
    if (W.queue.length && W.spawnT <= 0) { spawn(W.queue.shift()); W.spawnT = W.gap; }
  }
  for (const f of foes) {
    const D = FOES[f.type];
    f.slow = Math.max(0, f.slow - dt); f.stun = Math.max(0, f.stun - dt); f.brit = Math.max(0, f.brit - dt); f.flash -= dt; f.num -= dt;
    if (f.stun <= 0) f.d += D.spd * (f.slow > 0 ? .55 : 1) * (f.rage ? 1.6 : 1) * wxSpd() * dt;
    if (f.type === 'boss' && f.hp > 0) {
      if (!f.ph1 && f.hp <= f.max * .5) {
        f.ph1 = 1; spawnAt('brute', f, .5); spawnAt('brute', f, 1); FXS.quake = Math.max(FXS.quake, .4);
        floats.push({ x: f.x + .5, y: f.y - .4, t: 1.4, s: 'Brutes jump off!', c: '#d7a8ff', z: .36 }); snd('thud', 90, .2, 'square', .06, -40);
      }
      if (!f.rage && f.hp <= f.max * .25) { f.rage = 1; floats.push({ x: f.x + .5, y: f.y - .4, t: 1.4, s: 'Full steam!', c: P.org, z: .36 }); snd('steam', 400, .3, 'sawtooth', .04, -250); }
    }
    const [nx, ny] = posAt(f.d, f.p); if (Math.abs(nx - f.x) > .001) f.dir = nx > f.x ? 1 : -1; f.x = nx; f.y = ny;
    if (D.heal && (f.ht -= dt) <= 0) {
      f.ht = 2.5; let any = false;
      for (const o of foes) if (o !== f && o.hp > 0 && o.hp < o.max && Math.hypot(o.x - f.x, o.y - f.y) < 1.6) { o.hp = Math.min(o.max, o.hp + o.max * .15); any = true; parts.push({ x: o.x + .5, y: o.y + .1, vx: 0, vy: -1, g: 0, t: .6, c: P.grnL, s: .1, plus: 1 }); }
      if (any) fx.push({ k: 'ring', x: f.x, y: f.y, r: 1.6, t: .35, c: P.grnL });
    }
    if (D.sapper) {
      if (f.fuse === undefined) { for (const t of S.towers) if (!(t.jam > 0) && Math.hypot(t.c - f.x, t.r - f.y) < .95) { f.fuse = 1.6; f.tgt = t; break; } }
      else if (f.fuse > 0 && (f.fuse -= dt) <= 0) {
        const t = f.tgt; f.fuse = -1;
        if (S.towers.includes(t)) { t.jam = 8; fx.push({ k: 'boom', x: t.c, y: t.r, r: .8, t: .3 }); FXS.quake = Math.max(FXS.quake, .2); floats.push({ x: t.c + .5, y: t.r, t: 1.1, s: 'Jammed', c: P.red, z: .3 }); snd('boom', 120, .2, 'square', .06, -60); }
      }
    }
    if (f.d >= PATHS[f.p].len && f.hp > 0) leak(f);
  }
  for (const t of S.towers) {
    t.cd = (t.cd || 0) - dt; t.kick = Math.max(0, (t.kick || 0) - dt);
    if (t.jam > 0) { t.jam -= dt; continue; }
    if (t.cd > 0) continue;
    const st = towerStats(t), best = pickTarget(t, st); if (!best) continue;
    t.cd = 1 / st.rate; t.aim = Math.atan2(best.y - t.r, best.x - t.c); t.kick = .12;
    if (st.slow) {
      t.pulse = (t.pulse || 0) + 1; const frz = st.freeze && t.pulse % 3 === 0;
      for (const f of foes) if (f.hp > 0 && Math.hypot(f.x - t.c, f.y - t.r) <= st.range) { f.slow = st.slow; if (st.brittle) f.brit = st.slow + .5; if (frz) { f.stun = f.type === 'boss' ? .4 : 1.1; f.ice = 1; } hurt(f, st.dmg); }
      fx.push({ k: 'ring', x: t.c, y: t.r, r: st.range, t: .35, c: frz ? '#ffffff' : st.brittle ? '#c7a0ff' : '#8fe8ff' });
      for (let i = 0; i < (frz ? 16 : 8); i++) { const a = Math.random() * 7, r = Math.random() * st.range; parts.push({ x: t.c + .5 + Math.cos(a) * r, y: t.r + .5 + Math.sin(a) * r, vx: 0, vy: .5, g: 0, t: .6, c: '#fff', s: .05 }); }
      snd('frost', frz ? 1600 : 1200, .08, 'sine', .03, -500);
    } else if (st.chain) {
      let cur = best, dm = st.dmg, px = t.c, py = t.r - .3; const hit = new Set();
      for (let j = 0; j <= st.chain && cur; j++) {
        hit.add(cur); const pts = [[px, py]]; for (let i = 1; i < 4; i++) pts.push([px + (cur.x - px) * i / 4 + (Math.random() - .5) * .3, py + (cur.y - py) * i / 4 + (Math.random() - .5) * .3]); pts.push([cur.x, cur.y]);
        fx.push({ k: 'bolt', pts, t: .16, c: st.stun ? '#ff8fb0' : '#f2d04a' }); hurt(cur, dm);
        if (st.stun && cur.hp > 0) { cur.stun = Math.max(cur.stun, cur.type === 'boss' ? .5 : 1); cur.ice = 0; }
        dm *= st.falloff; px = cur.x; py = cur.y;
        let nx = null, nd = 1.7;
        for (const f of foes) if (f.hp > 0 && !hit.has(f)) { const q = Math.hypot(f.x - px, f.y - py); if (q < nd) { nd = q; nx = f; } }
        cur = nx;
      }
      snd('zap', 900, .1, 'sawtooth', .03, -700);
    } else if (st.cone) {
      for (const f of foes) {
        if (f.hp <= 0) continue; const dx = f.x - t.c, dy = f.y - t.r; if (Math.hypot(dx, dy) > st.range) continue;
        let da = Math.abs(Math.atan2(dy, dx) - t.aim); if (da > Math.PI) da = 2 * Math.PI - da; if (da < .5) hurt(f, st.dmg, { splash: 1 });
      }
      fx.push({ k: 'cone', x: t.c, y: t.r, a: t.aim, r: st.range, t: .18 }); snd('boom', 200, .08, 'square', .05, -100);
    } else {
      const q0 = Math.hypot(best.x - t.c, best.y - t.r) || 1;
      const kind = t.type === 'gatling' ? 'bullet' : st.splash ? 'ball' : 'bolt';
      shots.push({ x: t.c + Math.cos(t.aim) * .35, y: t.r + Math.sin(t.aim) * .35 - .1, f: best, dmg: st.dmg, splash: st.splash, pierce: st.pierce, q0, ang: t.aim, kind, spd: kind === 'ball' ? 7 : kind === 'bullet' ? 18 : t.br === 'b' ? 20 : 11 });
      kind === 'ball' ? snd('boom', 140, .12, 'square', .05, -80) : kind === 'bullet' ? snd('rat', 300, .03, 'square', .025, -120) : snd('twang', 700, .04, 'triangle', .04, -300);
    }
  }
  for (const s of shots) {
    const dx = s.f.x - s.x, dy = s.f.y - s.y, q = Math.hypot(dx, dy), step = s.spd * dt; s.q = q;
    if (q <= step) {
      s.done = true;
      if (s.splash) {
        for (const f of foes) if (Math.hypot(f.x - s.f.x, f.y - s.f.y) <= s.splash) hurt(f, s.dmg, { splash: 1 });
        fx.push({ k: 'boom', x: s.f.x, y: s.f.y, r: s.splash, t: .3 });
        for (let i = 0; i < 10; i++) parts.push({ x: s.f.x + .5, y: s.f.y + .5, vx: (Math.random() - .5) * 5, vy: -Math.random() * 4, g: 8, t: .5, c: i % 3 ? '#8a6a48' : P.org, s: .09 });
      } else { hurt(s.f, s.dmg, { pierce: s.pierce }); if (GX().parts) for (let i = 0; i < 3; i++) parts.push({ x: s.f.x + .5, y: s.f.y + .35, vx: (Math.random() - .5) * 3, vy: -Math.random() * 2, g: 6, t: .22, c: s.kind === 'bullet' ? P.yelL : '#fff', s: .05 }); }
    } else { s.x += dx / q * step; s.y += dy / q * step; s.ang = Math.atan2(dy, dx); }
  }
  for (const b of bombs) {
    if (b.f && b.f.hp > 0) { b.x = b.f.x; b.y = b.f.y; }
    if ((b.t -= dt) > 0) continue; b.done = true;
    const dmg = foeHp(S.wave) * 3 * MAP.hp;
    for (const f of foes) if (Math.hypot(f.x - b.x, f.y - b.y) <= 1.6) hurt(f, dmg, { splash: 1 });
    fx.push({ k: 'boom', x: b.x, y: b.y, r: 1.6, t: .45, d: .45 }); FXS.quake = Math.max(FXS.quake, .5); snd('kaboom', 70, .5, 'sawtooth', .09, -40);
    for (let i = 0; i < 26; i++) parts.push({ x: b.x + .5, y: b.y + .5, vx: (Math.random() - .5) * 8, vy: -Math.random() * 6, g: 9, t: .7, c: i % 3 ? '#8a6a48' : i % 2 ? P.org : P.yelL, s: .11 });
  }
  bombs = bombs.filter(b => !b.done);
  shots = shots.filter(s => !s.done); foes = foes.filter(f => f.hp > 0);
  for (const e of fx) e.t -= dt; fx = fx.filter(e => e.t > 0);
  if (S.vaultHp <= 0) {
    const lost = S.coins * .1; S.coins -= lost; foes = []; shots = []; W.queue = []; W.active = false; W.countdown = 15;
    S.wave = Math.max(1, S.wave - 2); S.vaultHp = vaultMax(); FXS.quake = .8; W.weather = null;
    if (W.smashed) {
      W.smashed = 0; S.stats.smashed = (S.stats.smashed || 0) + 1;
      FXS.banner = { t: 3.2, a: 'Vault smashed', b: 'The war wagon got through · back to wave ' + S.wave };
      say('The war wagon smashed the vault and took ' + fmt(lost) + ' coins. Back to wave ' + S.wave + '. Destroy the war wagon to get past its wave.');
    } else {
      FXS.banner = { t: 2.6, a: 'Vault breached', b: 'Back to wave ' + S.wave };
      say('Vault breached! Raiders took ' + fmt(lost) + ' coins. Falling back to wave ' + S.wave + '.');
    }
  } else if (W.active && !W.queue.length && !foes.length) {
    W.active = false; W.countdown = 20; const b = Math.ceil(foeCoins(S.wave) * 5 * MAP.coin); earn(b);
    say('Wave ' + S.wave + ' cleared: +' + fmt(b) + ' coins.'); snd('clear', 520, .2, 'triangle', .05, 520);
    if (!(FXS.banner && FXS.banner.boss)) FXS.banner = { t: 2.2, a: 'Wave ' + S.wave + ' cleared', b: '+' + fmt(b) + ' coins', gold: 1 };
    if (!W.leaks) S.stats.flawless = (S.stats.flawless || 0) + 1;
    if (W.weather) S.wxSeen[W.weather] = 1;
    W.weather = null;
    for (let i = 0; i < 28; i++) parts.push({ x: VAULT[0] + .5, y: VAULT[1] + .3, vx: (Math.random() - .5) * 6, vy: -2 - Math.random() * 4, g: 7, t: .9 + Math.random() * .5, c: [P.yel, P.yelL, '#56d3c6', '#ff8fb0'][i % 4], s: .09 });
    floats.push({ x: VAULT[0] + .2, y: VAULT[1] - .2, t: 1.4, s: '+' + fmt(b), c: P.yel, z: .4 });
    S.wave++; S.best = Math.max(S.best, S.wave); S.bestMap[S.map] = Math.max(S.bestMap[S.map] || 1, S.wave); S.vaultHp = Math.min(vaultMax(), S.vaultHp + 1 + lv('mason'));
  }
}

/* =========================================================
   Charters and deeds
   ========================================================= */
function deedsOnOffer() { const g = Math.max(0, Math.floor((S.best - 30) / 5)) + Math.floor(Math.sqrt(S.life / 1e7)); return g ? g + MAP.deed : 0; }
const spentDeeds = () => PERKS.reduce((a, p) => { for (let i = 0; i < perk(p.id); i++) a += p.cost(i); return a; }, 0);
const freeDeeds = () => S.deeds - spentDeeds();
function buyPerk(id) {
  const p = PERKS.find(p => p.id === id), l = perk(id);
  if (l >= p.max || (p.req && !perk(p.req)) || freeDeeds() < p.cost(l)) return;
  S.perks[id] = l + 1; snd('ms', 660, .25, 'triangle', .06, 440); say(p.n + ' is now rank ' + (l + 1) + '.');
}
function wipeField() { foes = []; shots = []; fx = []; bombs = []; corpses = []; workers = []; drops = []; sel = null; W.active = false; W.queue = []; W.next = null; W.weather = W.nweather = null; W.countdown = 30; FXS.scorch = []; rebuild = true; }
function prestige(mapId) {
  const g = deedsOnOffer(); if (!g) return;
  const keep = { deeds: S.deeds + g, perks: S.perks, charters: S.charters + 1, maps: Object.assign(S.maps, { fork: 1 }, S.map === 'fork' ? { bridge: 1 } : {}), goal: S.goal, goalsDone: S.goalsDone, stats: S.stats,
    badges: S.badges, bestMap: S.bestMap, chMap: Object.assign(S.chMap, { [S.map]: (S.chMap[S.map] || 0) + 1 }), wxSeen: S.wxSeen, opt: S.opt,
    sound: S.sound, autoWave: S.autoWave, speed: S.speed, sellAbove: S.sellAbove, research: perk('archive') ? S.research : {}, fb: { share: S.fb.share, keep: S.fb.keep, purse: 0 },
    town: S.town, towns: S.towns, seenVersion: S.seenVersion }; // a charter resets this town only; the others carry on
  if (S.map === 'fork' && !S.maps.bridgeSeen) { S.maps.bridgeSeen = 1; setTimeout(() => say('Trestle Bridge is open. Pick it next time you sign a charter.'), 2600); }
  S = fresh(); Object.assign(S, keep); S.map = MAPS[mapId] ? mapId : 'gulch'; setMap(S.map); bakeGround();
  const st = perk('start'); if (st) { S.ext.camp = S.ext.mine = 5 * st; S.shops.saw = 1; }
  const cf = perk('coffers'); if (cf) S.coins += 500 * Math.pow(10, cf - 1);
  for (let i = 0; i < perk('fort'); i++) { const p = PLOTS[i * 2]; if (p) S.towers.push({ c: p.x, r: p.y, type: 'crossbow', lvl: 2, tg: 'first' }); }
  wipeField(); save(); say('New charter signed for ' + MAP.n + '. You hold ' + S.deeds + ' deeds.');
}
