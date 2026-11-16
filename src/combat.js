'use strict';
/* =========================================================
   Combat
   ========================================================= */
let troops = [], clouds = [], tars = [], foes = [], shots = [], fx = [], parts = [], floats = [], workers = [], bombs = [], corpses = [], weeds = [], drops = [], sel = null;
const FXS = { shake: {}, gold: {}, pop: {}, build: {}, sparks: [], scorch: [], quake: 0, night: 0, banner: null, flash: 0, car: 9, lastCoin: 0, flow: {}, bossCam: 0 };
const W = { active: false, queue: [], next: null, ntype: 'mixed', type: 'mixed', shown: null, spawnT: 0, gap: .7, countdown: 30, spawned: 0, hpm: 1 };
const foeHp = w => 10 * Math.pow(1.25, w - 1) * (1 + w * .05) * (1 + Math.min(.15, Math.max(0, w - 12) * .01));
const foeCoins = w => 2 * Math.pow(1.12, w - 1) * (1 + .2 * lv('bounty'));
function planWave() {
  const w = S.wave; let type = 'mixed';
  if (w >= 4 && w % 10 !== 0) { const o = Object.keys(WTYPES).filter(k => k !== W.type && w >= WTYPES[k].from); type = o[Math.floor(Math.random() * o.length)]; }
  const T = WTYPES[type], n = Math.max(4, Math.round(Math.min(8 + Math.floor(w * 1.1), 36) * T.count)), pool = [];
  for (const k in T.w) if (w >= UNLOCK[k]) for (let i = 0; i < T.w[k]; i++) pool.push(k);
  if (!pool.length) pool.push('raider');
  const q = []; for (let i = 0; i < n; i++) q.push(pool[Math.floor(Math.random() * pool.length)]);
  if (MAP.river !== undefined) for (let i = 0; i < q.length; i++) if (Math.random() < .3) q[i] = 'boat'; // river pirates
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
  FXS.banner = { t: 2.4, a: 'Wave ' + S.wave, b: (S.wave % 10 === 0 ? bossName() + (MAP.air !== undefined ? ': only Tesla coils and drones reach it' : ': stop it or lose the vault') : T.n) + (W.weather ? ' · ' + WEATHER[W.weather].n : '') };
  snd('wave', 220, .25, 'sawtooth', .04, 220);
}
/* Thunder Mesa's sky lane: the airship boss flies it. Only Tesla lightning and drones reach something in the air;
   frost, poison, tar, blasts and soldiers pass beneath it. */
const isAir = f => !!(f && f.air);
const reachesAir = t => t.type === 'tesla';
function spawn(type) {
  // on a map with a river, boats and the boss come up the river (path MAP.river); on a map with a sky lane the boss
  // flies it (MAP.air); everyone else takes the road
  const air = type === 'boss' && MAP.air !== undefined;
  const p = air ? MAP.air : MAP.river !== undefined ? (type === 'boat' || type === 'boss' ? MAP.river : 0) : MAP.air !== undefined ? 0 : W.spawned++ % PATHS.length;
  const hp = foeHp(S.wave) * FOES[type].hp * (type === 'boss' ? (TOWN.boss.hp || 1) : W.hpm) * MAP.hp, [x, y] = posAt(0, p);
  foes.push({ type, p, d: 0, hp, max: hp, slow: 0, stun: 0, brit: 0, sh: FOES[type].shield || 0, x, y, dir: 1, flash: 0, num: 0, ht: 1.5, air: air ? 1 : 0 });
  if (type === 'boss') bossEntrance(air); // the cinematic entrance: camera, banner, letterbox
  if (air) { FXS.quake = Math.max(FXS.quake, .5); FXS.bossIn = 2.5; snd('rumble', 70, .9, 'sawtooth', .07, -20); floats.push({ x: x + 2.2, y: y - .3, t: 1.8, s: 'Airship!', c: '#ff8fb0', z: .45 }); return; }
  // every raider kicks up a puff of dust as it rides in; the war wagon shakes the ground
  for (let i = 0; i < (type === 'boss' ? 22 : 5); i++) parts.push({ x: x + .4 + Math.random() * .4, y: y + .5 + (Math.random() - .5) * .6, vx: Math.random() * 1.2, vy: -.3 - Math.random() * .5, g: 0, t: .7, c: '#dcc59c', s: .09, smoke: 1 });
  if (type === 'boss') { FXS.quake = Math.max(FXS.quake, .9); FXS.bossIn = 2.5; snd('rumble', 55, .7, 'sawtooth', .08, -15); floats.push({ x: x + 1.2, y: y - .3, t: 1.6, s: bossName() + '!', c: '#ff8fb0', z: .45 }); }
}
function spawnAt(type, from, back) {
  const hp = foeHp(S.wave) * FOES[type].hp * W.hpm * MAP.hp, d = Math.max(0, from.d - back), [x, y] = posAt(d, from.p);
  foes.push({ type, p: from.p, d, hp, max: hp, slow: 0, stun: 0, brit: 0, sh: FOES[type].shield || 0, x, y, dir: from.dir, flash: 0, num: 0, ht: 1.5 });
}
function poison(f, dps, t, o = {}) {
  if (f.hp <= 0) return;
  if (!f.psn || f.psn.t <= 0 || dps >= f.psn.dps) f.psn = { dps, t, spread: o.spread || (f.psn && f.psn.spread), ice: o.ice };
  else f.psn.t = Math.max(f.psn.t, t);
}
/* Where a point is: inside a tar pit, or inside a poison cloud. */
const inTar = (x, y) => tars.find(p => Math.hypot(p.x - x, p.y - y) <= p.r);
const inCloud = (x, y) => clouds.find(c => Math.hypot(c.x - x, c.y - y) <= c.r);
function hurt(f, dmg, o) {
  if (f.hp <= 0) return;
  if (o && o.melee && f.sh > 0) dmg *= .5;
  if (f.sh > 0 && !(o && (o.pierce || o.dot || o.melee))) {
    if (o && o.splash) { f.sh = 0; } else { f.sh--; f.flash = .05; }
    for (let i = 0; i < 4; i++) parts.push({ x: f.x + .5 + f.dir * .2, y: f.y + .4, vx: (Math.random() - .5) * 3, vy: -1 - Math.random() * 2, g: 8, t: .3, c: P.steelL, s: .06 });
    if (f.sh <= 0) { floats.push({ x: f.x + .5, y: f.y, t: .8, s: 'Shield broken', c: P.steelL, z: .26 }); snd('clang', 1500, .06, 'square', .03, -900); }
    if (!(o && o.splash)) return;
  }
  if (f.brit > 0) dmg *= 1.3;
  f.hp -= dmg; if (!(o && o.dot)) f.flash = .09;
  if (o && (o.dot || o.melee)) { f.dotN = (f.dotN || 0) + dmg; f.dotC = o.dot ? '#a8ff7a' : '#fff'; dmg = 0; } // damage over time adds up and shows now and then, not every tick
  if (f.dotN > 0 && f.num <= 0 && floats.length < 40 && S.opt.nums !== false) { f.num = .5; floats.push({ x: f.x + .5, y: f.y, t: .6, s: fmt(Math.max(1, f.dotN)), c: f.dotC || '#a8ff7a', z: .24 }); f.dotN = 0; }
  if (dmg > 0 && f.num <= 0 && floats.length < 40 && S.opt.nums !== false) { f.num = .35; floats.push({ x: f.x + .5, y: f.y, t: .6, s: fmt(Math.max(1, dmg)), c: '#fff', z: .26 }); }
  if (f.hp <= 0) {
    const D = FOES[f.type], c = foeCoins(S.wave) * D.rw * MAP.coin; earn(c); S.stats.kills++;
    if (f.psn && f.psn.spread && f.psn.t > 0) for (const o of foes) if (o !== f && o.hp > 0 && Math.hypot(o.x - f.x, o.y - f.y) < 1.3) poison(o, f.psn.dps, 4, { spread: 1 });
    if (f.type === 'boss') {
      const bonus = Math.ceil(foeCoins(S.wave) * 15 * MAP.coin); earn(bonus); S.stats.bosses = (S.stats.bosses || 0) + 1; if (isAir(f)) S.stats.airships = (S.stats.airships || 0) + 1; exNews('boss');
      fx.push({ k: 'boom', x: f.x, y: f.y, r: 2.2, t: .6, d: .6 }); FXS.quake = 1; FXS.flash = .15; snd('kaboom', 60, .7, 'sawtooth', .1, -30);
      FXS.banner = { t: 2.8, a: bossName() + ' destroyed', b: '+' + fmt(bonus) + ' bonus coins', gold: 1, boss: 1 };
      for (let i = 0; i < 40; i++) parts.push({ x: f.x + .5, y: f.y + .5, vx: (Math.random() - .5) * 9, vy: -2 - Math.random() * 6, g: 9, t: 1 + Math.random() * .6, c: [P.yel, P.yelL, '#8a6a48', P.steelL, P.org][i % 5], s: .1 + Math.random() * .06 });
      coinBurst(f.x + .5, f.y + .5, 14, bonus); FXS.bossCam = 0;
    }
    if (!REDUCED) for (let i = 0; i < (f.type === 'boss' ? 6 : 1 + (Math.random() < .4)); i++) drops.push({ x: f.x + .5, y: f.y + .55, z: 0, vz: 3 + Math.random() * 2, vx: (Math.random() - .5) * 1.6, t: 1.1 });
    if (corpses.length < 40) corpses.push({ type: f.type, x: f.x, y: f.y, dir: f.dir, t: .8, air: f.air });
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
  const d = TOWERS[t.type], b = t.br && BRANCH[t.type] ? BRANCH[t.type][t.br] : {}, w = wx();
  const wr = w === 'dust' && t.type !== 'frost' && t.type !== 'tesla' ? .75 : 1, wd = (w === 'rain' && t.type === 'crossbow' ? .85 : 1) * (w === 'moon' ? 1.1 : 1);
  return {
    dmg: d.dmg * (b.dmg || 1) * Math.pow(1.45, t.lvl) * dmgMult() * wd * (polIs('army', 'standing') ? 1.25 : 1), range: (d.range + (b.range || 0) + Math.min(1, t.lvl * .06)) * wr, rate: d.rate * (b.rate || 1),
    splash: b.splash || d.splash || 0, chain: b.chain || d.chain || 0, falloff: b.falloff || .7, slow: d.slow || 0,
    cone: b.cone, freeze: b.freeze, brittle: b.brittle, stun: b.stun, pierce: b.pierce,
    poison: d.poison, cloud: b.cloud || 1, spread: b.spread, frostbite: b.frostbite,
  };
}
/* --- the Barracks -------------------------------------------------------------------------------------------------
   A late-game tower built right beside the road. Its soldiers step onto the road and march back along it, against the
   flow of raiders, until they meet one; a raider that meets a soldier stops and they fight. With nobody coming they
   hold a few cells up the road (their reach). War wagons and boats go straight past; thieves slip by half the time.
   Three tracks, bought separately at any time: Drill (respawn time), Recruits (1 to 6 soldiers), Arms (strength).
   Soldiers are as strong as the waves they meet, so the tower stays useful however far you get. */
const TRACKS = { time: { n: 'Drill', d: 'Soldiers come back sooner', max: 15 }, count: { n: 'Recruits', d: 'One more soldier', max: 5 }, power: { n: 'Arms', d: 'Tougher, harder-hitting soldiers', max: 25 } };
const militia = () => polIs('army', 'militia') ? .6 : 1; // the Militia policy: cheaper Barracks and drills
const trackCost = (t, k) => Math.ceil(TOWERS[t.type].coins * .4 * Math.pow(1.6, (t.up && t.up[k]) || 0) * (k === 'count' ? 2.5 : 1) * militia());
function troopStats(t) {
  const u = t.up || {}, p = Math.pow(1.3, u.power || 0), w = foeHp(Math.max(S.wave, TOWERS.barracks.from)) * MAP.hp;
  return { time: 14 * Math.pow(.86, u.time || 0), count: 1 + Math.min(5, u.count || 0) + (polIs('army', 'militia') ? 1 : 0), hp: w * 2.2 * p * tf('garrison', 1.15), dps: w * .45 * p * dmgMult() * tf('garrison', 1.15), reach: 3 + .25 * (u.power || 0) };
}
function upgradeTrack(t, k) {
  const c = trackCost(t, k); t.up = t.up || {}; if ((t.up[k] || 0) >= TRACKS[k].max || S.coins < c) return false;
  S.coins -= c; t.spent = (t.spent || 0) + c; t.up[k] = (t.up[k] || 0) + 1; snd('build', 440, .12, 'triangle', .05, 440); towerSparkle(t); return true;
}
const roadPaths = () => PATHS.map((_, i) => i).filter(i => i !== MAP.river && i !== MAP.air);
/* Does this plot touch the road (a road cell beside it or at a corner, not the river)? Barracks may only stand there. */
const besideRoad = (c, r) => [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].some(([dx, dy]) => roadPaths().some(p => PATHS[p].segs.some(s => { const x = c + dx, y = r + dy; return x >= Math.min(s.x1, s.x2) - .01 && x <= Math.max(s.x1, s.x2) + .01 && y >= Math.min(s.y1, s.y2) - .01 && y <= Math.max(s.y1, s.y2) + .01; })));
/* The closest point of a road path to a spot (where the barracks' soldiers join the road, where an airship's raiders land). */
function roadNear(cx, cy) {
  let best = { p: 0, d: 0 }, bd = 1e9;
  for (const p of roadPaths()) for (let d = 0; d <= PATHS[p].len; d += .1) { const [x, y] = posAt(d, p), q = Math.hypot(x - cx, y - cy); if (q < bd) { bd = q; best = { p, d }; } }
  return best;
}
const roadDoor = t => roadNear(t.c, t.r);
const AIR_H = 1.9; // how high the airship flies in the 3D view
const foeHit = f => foeHp(S.wave) * FOES[f.type].hp * MAP.hp * .12; // what a raider deals to a soldier, per second
function barracksTick(t, dt) {
  const st = troopStats(t); if (!t.door) t.door = roadDoor(t);
  const mine = troops.filter(q => q.t === t); t.spawnT = (t.spawnT || 0) - dt;
  if (mine.length < st.count && t.spawnT <= 0) {
    const used = new Set(mine.map(q => q.slot)); let slot = 0; while (used.has(slot)) slot++;
    const [x, y] = posAt(t.door.d, t.door.p);
    troops.push({ t, slot, p: t.door.p, d: t.door.d, x, y, hp: st.hp, max: st.hp, f: null }); t.spawnT = mine.length + 1 < st.count && !t.fought ? .8 : st.time;
  }
}
function troopsTick(dt) {
  for (const q of troops) {
    const st = troopStats(q.t);
    if (q.max < st.hp) { q.hp += st.hp - q.max; q.max = st.hp; } // stronger arms (and later waves) reach soldiers already out
    if (q.f && (q.f.hp <= 0 || !foes.includes(q.f) || q.f.p !== q.p || Math.abs(q.f.d - q.d) > .8)) q.f = null;
    // the raider coming up the road toward this soldier (raiders move to larger d, soldiers march to smaller d)
    if (!q.f) { let best = null;
      for (const f of foes) {
        if (f.hp <= 0 || f.p !== q.p || f.type === 'boss' || f.type === 'boat') continue;
        if (f.type === 'thief' && f.slip === undefined) f.slip = Math.random() < .5; if (f.slip) continue;
        if (f.d <= q.d + .2 && f.d > q.d - .5 && (!best || f.d > best.d)) best = f;
      }
      q.f = best; }
    const hold = Math.max(0, q.t.door.d - st.reach) + q.slot * .22; // with no raider in sight, wait this far up the road
    const goal = q.f ? q.d : hold, step = 1.6 * dt;
    q.walk = !q.f && Math.abs(goal - q.d) > .05; if (q.walk) q.d += Math.sign(goal - q.d) * Math.min(step, Math.abs(goal - q.d));
    const [x, y] = posAt(q.d, q.p), off = (q.slot % 2 ? -1 : 1) * Math.ceil(q.slot / 2) * .12; q.dir = goal < q.d ? -1 : 1;
    q.x = x + off * .4; q.y = y + off;
    q.fight = !!q.f && Math.abs(q.f.d - q.d) < .45;
    if (q.fight) { q.f.held = .12; hurt(q.f, st.dps * dt, { melee: 1 }); q.hp -= foeHit(q.f) * dt; q.t.fought = 1; }
  }
  for (const q of troops) if (q.hp <= 0) { q.t.spawnT = Math.max(q.t.spawnT || 0, troopStats(q.t).time); for (let i = 0; i < 5; i++) parts.push({ x: q.x + .5, y: q.y + .5, vx: (Math.random() - .5) * 2, vy: -1 - Math.random(), g: 6, t: .4, c: '#5b8bc0', s: .07 }); }
  troops = troops.filter(q => q.hp > 0 && S.towers.includes(q.t));
}
/* --- the Drone Helipad ------------------------------------------------------------------------------------------
   A Barracks with Drill 5, Recruits 5 and Arms 5 can be rebuilt as a helipad (its soldiers stay). The drone is tied to
   the tower's reach, not the road: it flies to the strongest raider inside the circle (war wagons and boats too),
   strafes it, and when the battery runs low it lands on the pad to recharge. Tracks: battery, range and attack. */
const DRONE = { battery: { n: 'Battery', d: 'Longer flights', max: 15 }, range: { n: 'Range', d: 'A wider patrol circle', max: 12 }, attack: { n: 'Guns', d: 'More damage, faster fire', max: 25 } };
const droneCost = (t, k) => Math.ceil(TOWERS.helipad.coins * .25 * Math.pow(1.5, (t.dr && t.dr[k]) || 0));
function droneStats(t) {
  const u = t.dr || {};
  return { battery: 8 * Math.pow(1.22, u.battery || 0), charge: 6, range: TOWERS.helipad.range + .25 * (u.range || 0), dmg: 45 * Math.pow(1.42, u.attack || 0) * dmgMult() * tf('garrison', 1.15), rate: 4 * (1 + .04 * (u.attack || 0)), spd: 3.6 };
}
const canRebuild = t => t.type === 'barracks' && ['time', 'count', 'power'].every(k => ((t.up && t.up[k]) || 0) >= 5);
const rebuildCost = () => Math.ceil(TOWERS.helipad.coins);
function rebuildHelipad(t) {
  const goods = towerGoods('helipad'); if (!canRebuild(t) || S.coins < rebuildCost() || !hasGoods(goods)) return false;
  S.coins -= rebuildCost(); for (const k in goods) S.res[k] -= goods[k]; t.spent = (t.spent || 0) + rebuildCost();
  t.type = 'helipad'; t.dr = { battery: 0, range: 0, attack: 0 }; t.drone = { x: t.c, y: t.r, bat: droneStats(t).battery, mode: 'pad' }; t.born = .35;
  snd('ms', 660, .3, 'triangle', .06, 440); return true;
}
function upgradeDrone(t, k) {
  const c = droneCost(t, k); t.dr = t.dr || {}; if ((t.dr[k] || 0) >= DRONE[k].max || S.coins < c) return false;
  S.coins -= c; t.spent = (t.spent || 0) + c; t.dr[k] = (t.dr[k] || 0) + 1; snd('build', 520, .12, 'triangle', .05, 440); towerSparkle(t); return true;
}
const DRONE_T = new WeakMap(); // the raider each drone is after (kept out of the save)
function droneTick(t, dt) {
  const st = droneStats(t), d = t.drone || (t.drone = { x: t.c, y: t.r, bat: st.battery, mode: 'pad' }); d.cd = (d.cd || 0) - dt;
  const inCircle = f => f.hp > 0 && Math.hypot(f.x - t.c, f.y - t.r) <= st.range;
  if (d.mode === 'charge') { d.bat = Math.min(st.battery, d.bat + st.battery / st.charge * dt); if (d.bat >= st.battery) d.mode = 'pad'; return; }
  let f = DRONE_T.get(t); if (!f || !inCircle(f)) { f = null; let bv = 0; for (const o of foes) if (inCircle(o) && o.hp > bv) { bv = o.hp; f = o; } DRONE_T.set(t, f); }
  const home = !f || d.bat <= 0 || d.mode === 'home', gx = home ? t.c : f.x, gy = home ? t.r : f.y, dist = Math.hypot(gx - d.x, gy - d.y);
  if (d.mode === 'pad' && !f) return; // waiting on the pad
  if (!home) d.mode = 'fly';
  if (dist > .05) { const s = Math.min(dist, st.spd * dt); d.x += (gx - d.x) / dist * s; d.y += (gy - d.y) / dist * s; }
  // never beyond the tower's reach
  const r = Math.hypot(d.x - t.c, d.y - t.r); if (r > st.range) { d.x = t.c + (d.x - t.c) / r * st.range; d.y = t.r + (d.y - t.r) / r * st.range; }
  if (d.mode === 'fly') { d.bat -= dt; if (d.bat <= 0) d.mode = 'home'; }
  if (!home && dist < .9 && d.cd <= 0) { d.cd = 1 / st.rate; hurt(f, st.dmg, { pierce: 1 }); d.fire = .08; d.aim = Math.atan2(f.y - d.y, f.x - d.x); }
  d.fire = Math.max(0, (d.fire || 0) - dt);
  if (home && dist < .08) { d.x = t.c; d.y = t.r; d.mode = 'charge'; }
}
const towerCount = type => S.towers.filter(t => t.type === type).length;
const buildCost = type => Math.ceil(TOWERS[type].coins * Math.pow(1.2, towerCount(type)) * (TOWERS[type].troops ? militia() : 1));
const upCost = t => Math.ceil(TOWERS[t.type].coins * .8 * Math.pow(1.75, t.lvl) * tf('eng', .92));
const needsBranch = t => t.lvl >= 4 && !t.br && !!BRANCH[t.type];
const branchCost = t => upCost(t) * 2;
function upgradeTower(t) { if (needsBranch(t) || TOWERS[t.type].troops) return false; const c = upCost(t); if (S.coins < c) return false; S.coins -= c; t.lvl++; snd('build', 440, .12, 'triangle', .05, 440); towerSparkle(t); return true; }
function branchTower(t, b) { if (!needsBranch(t)) return false; const c = branchCost(t); if (S.coins < c) return false; S.coins -= c; t.br = b; t.lvl++; snd('ms', 660, .25, 'triangle', .06, 440); towerSparkle(t, 22); for (let i = 0; i < 14; i++) parts.push({ x: t.c + .5, y: t.r + .5, vx: Math.cos(i) * 2, vy: Math.sin(i) * 2 - 1, g: 2, t: .7, c: P.yel, s: .08 }); return true; }
function buildTower(type, c, r) {
  const d = TOWERS[type], cost = buildCost(type);
  const goods = towerGoods(type); if (S.coins < cost || !hasGoods(goods) || (d.from && S.best < d.from) || d.rebuilt || (d.troops && !besideRoad(c, r))) return false;
  S.coins -= cost; for (const k in goods) S.res[k] -= goods[k];
  S.towers.push({ c, r, type, lvl: 0, tg: 'first' }); return true;
}
function pickTarget(t, st) {
  let best = null, bv = 0; const mode = t.tg || 'first';
  for (const f of foes) {
    if (f.hp <= 0 || Math.hypot(f.x - t.c, f.y - t.r) > st.range || (isAir(f) && !reachesAir(t))) continue;
    const v = mode === 'strong' ? f.hp : mode === 'weak' ? -f.hp : f.d / PATHS[f.p].len;
    if (!best || v > bv) { best = f; bv = v; }
  }
  return best;
}
/* Vault repairs: coins for strength, only while the road is clear. */
const repairCost = () => Math.ceil(foeCoins(S.wave) * 4 * MAP.coin * tf('fort', .85));
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
    const tar = !isAir(f) && inTar(f.x, f.y), slowK = Math.max(.25, (f.slow > 0 ? .55 : 1) * (tar && !D.boat && f.type !== 'boat' ? .4 : 1));
    f.held = (f.held || 0) - dt;
    if (f.stun <= 0 && !(f.held > 0)) f.d += D.spd * slowK * (f.rage ? 1.6 : 1) * wxSpd() * dt;
    if (tar && tar.burn > 0) hurt(f, tar.dps * dt, { dot: 1 }); // burning tar
    if (f.psn && f.psn.t > 0) { f.psn.t -= dt; hurt(f, f.psn.dps * dt, { dot: 1 }); }
    if (f.type === 'boss' && f.hp > 0) {
      if (!f.ph1 && f.hp <= f.max * .5) {
        f.ph1 = 1; const from = isAir(f) ? Object.assign(roadNear(f.x, f.y), { dir: 1 }) : f; spawnAt('brute', from, .5); spawnAt('brute', from, 1); FXS.quake = Math.max(FXS.quake, .4);
        floats.push({ x: f.x + .5, y: f.y - .4, t: 1.4, s: isAir(f) ? 'Brutes drop on ropes!' : 'Brutes jump off!', c: '#d7a8ff', z: .36 }); snd('thud', 90, .2, 'square', .06, -40);
      }
      if (!f.rage && f.hp <= f.max * .25) { f.rage = 1; floats.push({ x: f.x + .5, y: f.y - .4, t: 1.4, s: isAir(f) ? 'Full throttle!' : 'Full steam!', c: P.org, z: .36 }); snd('steam', 400, .3, 'sawtooth', .04, -250); }
    }
    const [nx, ny] = posAt(f.d, f.p); if (Math.abs(nx - f.x) > .001) f.dir = nx > f.x ? 1 : -1; f.x = nx; f.y = ny;
    if (D.heal && (f.ht -= dt) <= 0) {
      f.ht = 2.5; let any = false;
      for (const o of foes) if (o !== f && o.hp > 0 && o.hp < o.max && Math.hypot(o.x - f.x, o.y - f.y) < 1.6) { o.hp = Math.min(o.max, o.hp + o.max * .15); o.psn = null; any = true; parts.push({ x: o.x + .5, y: o.y + .1, vx: 0, vy: -1, g: 0, t: .6, c: P.grnL, s: .1, plus: 1 }); }
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
    if (TOWERS[t.type].troops) { barracksTick(t, dt); if (TOWERS[t.type].drone) droneTick(t, dt); continue; }
    if (t.cd > 0) continue;
    const st = towerStats(t), best = pickTarget(t, st); if (!best) continue;
    t.cd = 1 / st.rate; t.aim = Math.atan2(best.y - t.r, best.x - t.c); t.kick = .12;
    if (st.slow) {
      t.pulse = (t.pulse || 0) + 1; const frz = st.freeze && t.pulse % 3 === 0;
      for (const f of foes) if (f.hp > 0 && !isAir(f) && Math.hypot(f.x - t.c, f.y - t.r) <= st.range) { if (st.frostbite) poison(f, st.dmg * 1.4, 2.5, { ice: 1 }); f.slow = st.slow; if (st.brittle) f.brit = st.slow + .5; if (frz) { f.stun = f.type === 'boss' ? .4 : 1.1; f.ice = 1; } hurt(f, st.dmg); }
      fx.push({ k: 'ring', x: t.c, y: t.r, r: st.range, t: .35, c: frz ? '#ffffff' : st.brittle ? '#c7a0ff' : '#8fe8ff' });
      for (let i = 0; i < (frz ? 16 : 8); i++) { const a = Math.random() * 7, r = Math.random() * st.range; parts.push({ x: t.c + .5 + Math.cos(a) * r, y: t.r + .5 + Math.sin(a) * r, vx: 0, vy: .5, g: 0, t: .6, c: '#fff', s: .05 }); }
      snd('frost', frz ? 1600 : 1200, .08, 'sine', .03, -500);
    } else if (st.poison) {
      const q0 = Math.hypot(best.x - t.c, best.y - t.r) || 1;
      shots.push({ x: t.c, y: t.r - .2, f: best, dmg: st.dmg, q0, ang: t.aim, kind: 'flask', spd: 6, cloud: st.cloud, spread: st.spread });
      snd('glug', 320, .1, 'triangle', .04, 120);
    } else if (st.chain) {
      let cur = best, dm = st.dmg, px = t.c, py = t.r - .3, ph = .9; const hit = new Set();
      const extra = lv('sice') ? 2 : 0; let jumps = st.chain + extra;
      for (let j = 0; j <= jumps && cur; j++) {
        hit.add(cur); const pts = [[px, py]]; for (let i = 1; i < 4; i++) pts.push([px + (cur.x - px) * i / 4 + (Math.random() - .5) * .3, py + (cur.y - py) * i / 4 + (Math.random() - .5) * .3]); pts.push([cur.x, cur.y]);
        const ch = isAir(cur) ? AIR_H + .2 : .45; fx.push({ k: 'bolt', pts, t: .16, c: st.stun ? '#ff8fb0' : '#f2d04a', h0: ph, h1: ch }); ph = ch; hurt(cur, dm);
        if (st.stun && cur.hp > 0) { cur.stun = Math.max(cur.stun, cur.type === 'boss' ? .5 : 1); cur.ice = 0; }
        // Conductive Fog: the bolt arcs through everyone in the poison cloud it struck
        const cl = lv('fog') && inCloud(cur.x, cur.y);
        if (cl) { for (const f of foes) if (f.hp > 0 && !hit.has(f) && Math.hypot(f.x - cl.x, f.y - cl.y) <= cl.r) { hit.add(f); fx.push({ k: 'bolt', pts: [[cur.x, cur.y], [(cur.x + f.x) / 2 + (Math.random() - .5) * .3, (cur.y + f.y) / 2 + (Math.random() - .5) * .3], [f.x, f.y]], t: .16, c: '#9dff7a' }); hurt(f, dm * .8); } cl.zap = .25; }
        const iced = f => f.slow > 0 || (f.stun > 0 && f.ice);
        if (!(lv('sice') && iced(cur))) dm *= st.falloff; px = cur.x; py = cur.y;
        let nx = null, nd = 1.7;
        for (const f of foes) if (f.hp > 0 && !hit.has(f)) { const q = Math.hypot(f.x - px, f.y - py), reach = lv('sice') && iced(f) ? 3.4 : 1.7; if (q < reach && (!nx || q < nd)) { nd = q; nx = f; } }
        cur = nx;
      }
      snd('zap', 900, .1, 'sawtooth', .03, -700);
    } else if (st.cone) {
      for (const f of foes) {
        if (f.hp <= 0 || isAir(f)) continue; const dx = f.x - t.c, dy = f.y - t.r; if (Math.hypot(dx, dy) > st.range) continue;
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
  troopsTick(dt);
  for (const s of shots) {
    const dx = s.f.x - s.x, dy = s.f.y - s.y, q = Math.hypot(dx, dy), step = s.spd * dt; s.q = q;
    if (q <= step) {
      s.done = true;
      if (s.kind === 'flask') {
        const r = .9 * (s.cloud || 1); clouds.push({ x: s.f.x, y: s.f.y, r, t: 3 * (s.cloud || 1), t0: 3 * (s.cloud || 1), dps: s.dmg, spread: s.spread });
        poison(s.f, s.dmg, 4, { spread: s.spread });
        for (let i = 0; i < 8; i++) parts.push({ x: s.f.x + .5 + (Math.random() - .5) * r, y: s.f.y + .5, vx: (Math.random() - .5), vy: -.6 - Math.random() * .6, g: 0, t: .8, c: '#8fd14f', s: .1, smoke: 1 });
      } else if (s.splash) {
        for (const f of foes) if (!isAir(f) && Math.hypot(f.x - s.f.x, f.y - s.f.y) <= s.splash) hurt(f, s.dmg, { splash: 1 });
        fx.push({ k: 'boom', x: s.f.x, y: s.f.y, r: s.splash, t: .3 });
        for (let i = 0; i < 10; i++) parts.push({ x: s.f.x + .5, y: s.f.y + .5, vx: (Math.random() - .5) * 5, vy: -Math.random() * 4, g: 8, t: .5, c: i % 3 ? '#8a6a48' : P.org, s: .09 });
      } else { hurt(s.f, s.dmg, { pierce: s.pierce }); if (GX().parts) for (let i = 0; i < 3; i++) parts.push({ x: s.f.x + .5, y: s.f.y + .35, vx: (Math.random() - .5) * 3, vy: -Math.random() * 2, g: 6, t: .22, c: s.kind === 'bullet' ? P.yelL : '#fff', s: .05 }); }
    } else { s.x += dx / q * step; s.y += dy / q * step; s.ang = Math.atan2(dy, dx); }
  }
  for (const b of bombs) {
    if (b.f && b.f.hp > 0) { b.x = b.f.x; b.y = b.f.y; }
    if ((b.t -= dt) > 0) continue; b.done = true;
    const dmg = foeHp(S.wave) * 3 * MAP.hp;
    for (const f of foes) if (!isAir(f) && Math.hypot(f.x - b.x, f.y - b.y) <= 1.6) hurt(f, dmg, { splash: 1 });
    fx.push({ k: 'boom', x: b.x, y: b.y, r: 1.6, t: .45, d: .45 }); FXS.quake = Math.max(FXS.quake, .5); snd('kaboom', 70, .5, 'sawtooth', .09, -40);
    for (let i = 0; i < 26; i++) parts.push({ x: b.x + .5, y: b.y + .5, vx: (Math.random() - .5) * 8, vy: -Math.random() * 6, g: 9, t: .7, c: i % 3 ? '#8a6a48' : i % 2 ? P.org : P.yelL, s: .11 });
  }
  bombs = bombs.filter(b => !b.done);
  // poison clouds poison whoever walks through; tar pits last a while (and burn if an explosion reaches them)
  for (const c of clouds) { c.t -= dt; c.zap = Math.max(0, (c.zap || 0) - dt); for (const f of foes) if (f.hp > 0 && !isAir(f) && Math.hypot(f.x - c.x, f.y - c.y) <= c.r) poison(f, c.dps, 4, { spread: c.spread }); }
  clouds = clouds.filter(c => c.t > 0);
  for (const p of tars) { p.t -= dt; p.burn = Math.max(0, (p.burn || 0) - dt); for (const e of fx) if (e.k === 'boom' && !e.lit && Math.hypot(e.x - p.x, e.y - p.y) <= p.r + (e.r || 1)) { e.lit = 1; if (!p.burn) { p.burn = 4; floats.push({ x: p.x + .5, y: p.y, t: 1, s: 'Tar alight!', c: P.org, z: .3 }); } } }
  tars = tars.filter(p => p.t > 0);
  shots = shots.filter(s => !s.done); foes = foes.filter(f => f.hp > 0);
  for (const e of fx) e.t -= dt; fx = fx.filter(e => e.t > 0);
  if (S.vaultHp <= 0) {
    exNews('vault'); const lost = S.coins * .1; S.coins -= lost; foes = []; shots = []; W.queue = []; W.active = false; W.countdown = 15;
    S.wave = Math.max(1, S.wave - 2); S.vaultHp = vaultMax(); FXS.quake = .8; W.weather = null;
    if (W.smashed) {
      W.smashed = 0; S.stats.smashed = (S.stats.smashed || 0) + 1;
      FXS.banner = { t: 3.2, a: 'Vault smashed', b: 'The ' + bossName().toLowerCase() + ' got through · back to wave ' + S.wave };
      say('The ' + bossName().toLowerCase() + ' smashed the vault and took ' + fmt(lost) + ' coins. Back to wave ' + S.wave + '. Destroy it to get past its wave.');
    } else {
      FXS.banner = { t: 2.6, a: 'Vault breached', b: 'Back to wave ' + S.wave };
      say('Vault breached! Raiders took ' + fmt(lost) + ' coins. Falling back to wave ' + S.wave + '.');
    }
  } else if (W.active && !W.queue.length && !foes.length) {
    W.active = false; W.countdown = 20; const b = Math.ceil(foeCoins(S.wave) * 5 * MAP.coin); earn(b); coinBurst(VAULT[0] + .5, VAULT[1] + .5, 8, b);
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
const freeDeeds = () => S.deeds - spentDeeds() + (S.paidDeeds || 0); // perks kept through a Convention stay paid for
function buyPerk(id) {
  const p = PERKS.find(p => p.id === id), l = perk(id);
  if (l >= p.max || (p.req && !perk(p.req)) || freeDeeds() < p.cost(l)) return;
  S.perks[id] = l + 1; snd('ms', 660, .25, 'triangle', .06, 440); say(p.n + ' is now rank ' + (l + 1) + '.');
}
function wipeField() { troops = []; clouds = []; tars = []; foes = []; shots = []; fx = []; bombs = []; corpses = []; workers = []; drops = []; sel = null; W.active = false; W.queue = []; W.next = null; W.weather = W.nweather = null; W.countdown = 30; FXS.scorch = []; rebuild = true; }
/* Sign a new charter: the town you are in starts over and pays deeds; every other town and the deeds' bonus carry on. */
function prestige() {
  const g = deedsOnOffer(); if (!g) return;
  if (capOpen()) S.capital.inf = (S.capital.inf || 0) + 5 * g; // a charter earns the government Influence
  if (S.capital && S.capital.ex && S.capital.ex.s) for (const id in S.capital.ex.s) { S.capital.ex.s[id].own = 0; S.capital.ex.s[id].cost = 0; } // shares go with the coins, or they would carry coins through
  const keep = { deeds: S.deeds + g, perks: S.perks, charters: S.charters + 1, goal: S.goal, goalsDone: S.goalsDone, stats: S.stats,
    badges: S.badges, bestMap: S.bestMap, chMap: Object.assign(S.chMap, { [S.map]: (S.chMap[S.map] || 0) + 1 }), wxSeen: S.wxSeen, opt: S.opt,
    sound: S.sound, autoWave: S.autoWave, speed: S.speed, sellAbove: S.sellAbove, research: perk('archive') ? S.research : eduKeep(S.research), eg: S.eg, capital: S.capital, tut: S.tut, legacy: S.legacy, paidDeeds: S.paidDeeds, rep: S.rep, mkt: S.mkt, fb: { share: S.fb.share, keep: S.fb.keep, purse: 0 },
    town: S.town, towns: S.towns, routes: S.routes, inbox: S.inbox, railOpen: S.railOpen, seenVersion: S.seenVersion }; // a charter resets this town only; the others carry on
  const map = TOWNS[S.town].maps[0];
  S = fresh(); Object.assign(S, townFresh(map), keep); useTown(S.town); setMap(S.map); headStart();
  wipeField(); save(); say('New charter signed for ' + TOWN.n + '. You hold ' + S.deeds + ' deeds, and every town works faster for them.');
}
/* What the deed perks give a town that starts over (a charter, or Copper Gulch at a Convention). */
function headStart() {
  const st = perk('start'); if (st) { const T = TOWNS[S.town]; S.ext[T.ext[0]] = S.ext[T.ext[1]] = 5 * st; S.shops[T.shops[0]] = 1; }
  const cf = perk('coffers'); if (cf) S.coins += 500 * Math.pow(10, cf - 1);
  for (let i = 0; i < perk('fort'); i++) { const p = PLOTS[i * 2]; if (p) S.towers.push({ c: p.x, r: p.y, type: 'crossbow', lvl: 2, tg: 'first' }); }
}
