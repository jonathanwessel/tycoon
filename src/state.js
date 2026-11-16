'use strict';
/* =========================================================
   State and saving
   ========================================================= */
/* Graphics options. A preset fills in the detail settings; changing any detail makes the preset "custom".
   shadow 0-3; bloom (glow) 0-3; res: render scale; parts: particle budget 0-3;
   weather: rain/dust/heat particles; shake: screen shake; fps: frame cap. Look, grain, scanlines are style, not quality. */
const GX_PRESETS = {
  low:   { shadow: 0, bloom: 0, res: .6, parts: 0, weather: 1, shake: 1, fps: 30 },
  med:   { shadow: 1, bloom: 1, res: .75, parts: 1, weather: 1, shake: 1, fps: 60 },
  high:  { shadow: 2, bloom: 2, res: 1,   parts: 2, weather: 1, shake: 1, fps: 60 },
  ultra: { shadow: 3, bloom: 3, res: 1.5, parts: 3, weather: 1, shake: 1, fps: 60 },
};
/* Colour looks: graded in the lighting engine's final pass, or with a CSS filter in simple mode. */
const LOOKS = {
  natural: { n: 'Natural',        sat: 1.04, con: .16, tint: [1, 1, 1],         lift: [0, 0, 0],          vig: 1,   css: '' },
  western: { n: 'Western film',   sat: .8,   con: .28, tint: [1.08, .97, .8],   lift: [.035, .018, 0],    vig: 1.35, css: 'sepia(.28) saturate(.85) contrast(1.08)' },
  vivid:   { n: 'Vivid',          sat: 1.32, con: .24, tint: [1, 1, 1.02],      lift: [0, 0, 0],          vig: .9,  css: 'saturate(1.35) contrast(1.06)' },
  cool:    { n: 'Cool dusk',      sat: .9,   con: .2,  tint: [.9, .98, 1.12],   lift: [0, .01, .035],     vig: 1.15, css: 'saturate(.9) hue-rotate(-8deg) brightness(.97)' },
  photo:   { n: 'Old photograph', sat: .12,  con: .32, tint: [1.12, .98, .76],  lift: [.06, .035, .012],  vig: 1.7, css: 'sepia(.85) contrast(1.12) brightness(.96)' },
};
const PCAP = [70, 180, 320, 520];
function fresh() {
  const res = {}; for (const k in ITEMS) res[k] = 0; res.plank = 10;
  return {
    v: 8, town: 'gulch', eg: 0, capital: { open: 0, lv: {}, share: .5, split: { foremen: 6, war: 2, academy: 2 }, keep: 1, inf: 0, tech: {} }, towns: {}, routes: [], inbox: {}, railOpen: 0, coins: 60, life: 0, res, seen: { wood: 1, ore: 1, plank: 1 }, ext: {}, shops: {}, off: {}, auto: {}, research: {}, towers: [],
    wave: 1, best: 1, vaultHp: 20, deeds: 0, perks: {}, charters: 0, map: 'gulch', maps: { gulch: 1 },
    contracts: [], demand: {}, sellAbove: 0, mgr: {}, goal: 0, gq: null, goalsDone: 0,
    stats: { sold: 0, soldV: 0, kills: 0, contracts: 0, taps: 0, bosses: 0, flawless: 0, made: 0, coins: 0, played: 0, repairs: 0, vaultSeen: 0 }, cd: { dyn: 0, ot: 0, tar: 0 }, ot: 0,
    badges: {}, bestMap: {}, chMap: {}, wxSeen: {}, fb: { share: .5, keep: 0, purse: 0 }, opt: { vol: 1, calm: 'auto', nums: true, autoPause: false, gx: Object.assign({ preset: 'high', look: 'natural', grain: 0, scan: 0, fpsShow: 0, view: '2d' }, GX_PRESETS.high) },
    autoWave: true, speed: 1, sound: false, last: Date.now(),
  };
}
let S = fresh();
/* Towns (save v4). The empire owns coins, deeds, perks, badges, stats, goals and settings. Everything in TOWN_KEYS
   belongs to one town. The town you are playing keeps its fields at the top of S (so the rest of the code reads S as
   before); every other town is kept in S.towns[id] and swapped in while it works in the background or when you
   switch to it. */
const TOWN_KEYS = ['map', 'life', 'res', 'seen', 'ext', 'shops', 'off', 'auto', 'research', 'towers', 'wave', 'best', 'vaultHp', 'contracts', 'demand', 'sellAbove', 'mgr', 'cd', 'ot', 'fb', 'bestRate', 'goal', 'gq', 'autoWave', 'cpurse', 'abT'];
const NESTED = ['res', 'seen', 'ext', 'shops', 'off', 'auto', 'research', 'demand', 'mgr', 'cd'];
const pickTown = o => { const t = {}; for (const k of TOWN_KEYS) if (o[k] !== undefined) t[k] = o[k]; return t; };
/* A brand-new town on the given map, with that town's starting goods. */
function townFresh(map) {
  const t = pickTown(fresh()), T = TOWNS[townOfMap(map)]; t.map = map;
  t.res = {}; for (const k in ITEMS) t.res[k] = 0; Object.assign(t.res, T.start.res);
  t.seen = {}; for (const k of T.start.seen) t.seen[k] = 1;
  t.autoWave = false; // a newly opened town holds its waves until you have defended it (switch it on there or in the Capitol)
  return t;
}
function fillTown(t) { const f = townFresh(t.map || 'gulch'); const out = Object.assign(f, t); for (const k of NESTED) out[k] = Object.assign(townFresh(out.map)[k], t[k]); return out; }
/* Run fn with town id swapped in as the active one (its fields at the top of S, its buildings in BUILD), then swap back. */
function withTown(id, fn) {
  if (id === S.town) return fn();
  // every per-town field is swapped, including ones a town has not set yet (they must not leak from the other town)
  const mine = pickTown(S), clear = () => { for (const k of TOWN_KEYS) delete S[k]; };
  clear(); Object.assign(S, S.towns[id]); useTown(id);
  try { return fn(); } finally { S.towns[id] = pickTown(S); clear(); Object.assign(S, mine); useTown(S.town); }
}
/* Make another town the one you play. Its map is drawn and its waves start; the town you leave keeps producing. */
function switchTown(id) {
  if (id === S.town || !S.towns[id]) return false;
  S.towns[S.town] = pickTown(S); for (const k of TOWN_KEYS) delete S[k]; Object.assign(S, fillTown(S.towns[id])); delete S.towns[id]; S.town = id;
  useTown(id); setMap(S.map); S.towers = S.towers.filter(t => TOWERS[t.type] && !onRoad(t.c, t.r));
  return true;
}
const townIds = () => [S.town, ...Object.keys(S.towns)];
const townOpen = id => id === S.town || !!S.towns[id];
/* Best wave reached in a town (stored towns keep theirs; charters keep the best per map). */
const townBest = id => !townOpen(id) ? 0 : Math.max(id === S.town ? S.best : S.towns[id].best || 0, S.bestMap[TOWNS[id].maps[0]] || 0);
/* Open a new town (Empire tab). */
function unlockTown(id) {
  const T = TOWNS[id], u = T && T.unlock; if (!u || townOpen(id)) return false;
  if (townBest(u.from) < u.best || S.coins < u.coins) return false;
  S.coins -= u.coins; S.towns[id] = townFresh(T.maps[0]); S.stats.towns = (S.stats.towns || 1) + 1;
  return true;
}
/* Shipping. A route moves one good from one town to another at up to `per` a minute, paying a fee for each load.
   Goods leave before the source town's auto-sell runs and arrive in the destination's inbox, collected on its next tick.
   Wagons carry up to 120 a minute for 5% of the goods' value; once a Locomotive Works stands, trains carry up to
   1200 a minute for 2%. */
/* Goods per minute a route moves: a set rate, or Auto: what the receiving town's workshops can use (plus 10%). */
const routeRate = r => { const cr = carrier(); if (r.per !== 'auto') return Math.min(r.per, cr.max); const n = ROUTE_NEED[r.to] && ROUTE_NEED[r.to][r.k]; return Math.min(cr.max, Math.max(5, (n || 0) * 66)); };
/* Shipping: wagon trains at first; the first Locomotive Works brings trains, and every level of it adds 10% more
   capacity to every route (more locomotives, more trains), so the empire's shipping grows with it. */
// read at the top of each tick (econTowns), where S is the home town; inside another town's step it would be wrong
let LOCO_LV = 0;
const locoLevel = () => LOCO_LV;
const readLoco = () => { LOCO_LV = (S.town === 'ridge' ? S.shops.locow : S.towns.ridge && S.towns.ridge.shops && S.towns.ridge.shops.locow) || 0; };
const carrier = () => { const tl = typeof capLv === 'function' ? capLv('transport') : 0, k = (1 + .25 * tl) * tf('logistics', 1.2), f = Math.pow(.9, tl) * tf('logistics', .9); return S.railOpen ? { n: 'Train', max: Math.round(1200 * (1 + .1 * Math.max(0, locoLevel() - 1)) * k), fee: .02 * f, spr: 'loco' } : { n: 'Wagon train', max: Math.round(120 * k), fee: .05 * f, spr: 'wagon' }; };
/* Collect deliveries for this town, and say how much of each good its routes will take this step (workshops leave it). */
function routeHold(dt) {
  const box = S.inbox[TOWN_ID]; if (box) { for (const k in box) add(k, box[k]); delete S.inbox[TOWN_ID]; }
  const cr = carrier(), hold = {};
  for (const r of S.routes) if (r.from === TOWN_ID && !r.paused && townOpen(r.to)) hold[r.k] = (hold[r.k] || 0) + routeRate(r) * dt / 60;
  return hold;
}
function shipGoods(dt) {
  const box = S.inbox[TOWN_ID]; if (box) { for (const k in box) add(k, box[k]); delete S.inbox[TOWN_ID]; }
  const cr = carrier();
  for (const r of S.routes) {
    if (r.from !== TOWN_ID || r.paused || !townOpen(r.to)) continue;
    const amt = Math.min(S.res[r.k] || 0, routeRate(r) * dt / 60); if (!(amt > 0)) continue;
    const fee = amt * ITEMS[r.k].p * cr.fee; if (S.coins < fee) continue;
    S.res[r.k] -= amt; S.coins -= fee; r.sent = (r.sent || 0) + amt; S.stats.shipped = (S.stats.shipped || 0) + amt;
    (S.inbox[r.to] = S.inbox[r.to] || {})[r.k] = (S.inbox[r.to][r.k] || 0) + amt;
  }
}
/* Every town but the one on screen works in the background (economy only: waves wait until you are there). */
function econTowns(dt) {
  readLoco();
  // what each town makes, so shipping routes (and foremen valuing goods that arrive by route) know what can be sent
  for (const id of townIds()) if (townOpen(id)) { const c = id === S.town ? chainFlow() : withTown(id, () => chainFlow()); ROUTE_OUT[id] = c.made; ROUTE_NEED[id] = c.need; }
  econ(dt); for (const id of Object.keys(S.towns)) withTown(id, () => { econ(dt); autoBattle(dt); });
  // the Central Bank pays interest on the empire's coins (its income is sampled every 10 seconds)
  CAPI.t -= dt; if (CAPI.t <= 0) { CAPI.t = 10; CAPI.inc = townIds().filter(townOpen).reduce((a, id) => a + (id === S.town ? steadyIncome() : withTown(id, () => steadyIncome())), 0); }
  bankWork(dt, CAPI.inc || 0); }
const CAPI = { t: 0, inc: 0 };
const KEY = 'copper-gulch-save-v1';
function save() { S.last = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
function load() {
  try {
    const t = localStorage.getItem(KEY); if (!t) return; const o = JSON.parse(t);
    // before a save is upgraded to a new format, keep a copy of the old one (once)
    if ((o.v || 0) < 4 && !localStorage.getItem(KEY + '-v3-backup')) localStorage.setItem(KEY + '-v3-backup', t);
    adopt(o);
  } catch (e) {}
}
/* A fresh start. When a release changes progress too much to carry saves over fairly, raise WIPE_V to that release's
   save version: older saves then start a new empire. Kept: deeds and perks plus WIPE_GIFT bonus deeds as a head start,
   badges, lifetime stats, charters signed, settings and sound. The old save is copied to a backup key first. */
const WIPE_V = 7, WIPE_GIFT = 10; // v7: the Capital and the reworked economy and Barracks
function freshStart(o) {
  try { localStorage.setItem(KEY + '-before-v' + (o.v || 0), JSON.stringify(o)); } catch (e) {}
  const n = fresh(), gift = WIPE_GIFT;
  n.deeds = (o.deeds || 0) + gift; n.perks = o.perks || {}; n.badges = o.badges || {}; n.charters = o.charters || 0; n.goalsDone = o.goalsDone || 0;
  n.stats = Object.assign(n.stats, o.stats || {}); n.opt = Object.assign(n.opt, o.opt || {}); n.sound = o.sound !== undefined ? o.sound : n.sound; n.tut = o.tut || 'done'; // returning players skip the tutorial (Settings can replay it)
  delete n.opt.gx.view; delete n.opt.gx.light;
  n.movedNote = 'Copper Gulch was rebuilt, so your empire starts fresh. You keep your badges, perks and ' + (o.deeds || 0) + ' deeds, plus ' + gift + ' more as a thank-you: every town works faster for them.';
  return n;
}
let WIPE_OFF = false; // tests of old migrations turn the fresh start off
function adopt(o, wipeV = WIPE_OFF ? 0 : WIPE_V) {
  if (!o || typeof o !== 'object' || !o.res) return false;
  if (wipeV && (o.v || 0) < wipeV) o = freshStart(o);
  if (!o.v) { (o.towers || []).forEach(t => { t.r += 2; }); o.v = 2; } // v1 maps had a two-row yard
  if (o.v < 3) { if (o.goal >= 7) o.goal++; o.v = 3; } // v3 added the vault goal at position 7
  if (o.v < 4) { o.town = 'gulch'; o.towns = {}; o.v = 4; } // v4: the old save becomes the first town of an empire
  if (o.v < 5) { // v5: Forked Canyon and Trestle Bridge were retired; their charters continue on the Copper Gulch map
    const fix = t => { if (t && !MAPS[t.map]) { t.map = 'gulch'; t.moved = 1; } };
    fix(o); for (const id in o.towns || {}) fix(o.towns[id]); o.v = 5;
  }
  if (o.v < 6) { // v6: missions are per town; the old shared chain was Copper Gulch's list, so it stays with Copper Gulch
    if (o.town && o.town !== 'gulch' && o.towns && o.towns.gulch) { o.towns.gulch.goal = o.goal || 0; o.towns.gulch.gq = null; o.goal = 0; o.gq = null; }
    o.eg = 0; o.v = 6;
  }
  if (o.v < 7) o.v = 7; // v7: the Capital (its defaults come from fresh()); saves before v7 normally start fresh (WIPE_V)
  if (o.v < 8) { if (o.capital) { o.capital.inf = o.capital.inf || 0; o.capital.tech = o.capital.tech || {}; } o.v = 8; } // v8: Influence and the tech trees
  if (o.opt && o.opt.gx) { delete o.opt.gx.view; delete o.opt.gx.light; } // 2D settings from before the game went 3D-only
  const f = fresh(); S = Object.assign(f, o);
  S.towns = {}; for (const id in o.towns || {}) S.towns[id] = fillTown(o.towns[id]);
  for (const k of ['res', 'seen', 'ext', 'shops', 'off', 'auto', 'research', 'perks', 'maps', 'demand', 'mgr', 'stats', 'cd', 'badges', 'bestMap', 'chMap', 'wxSeen', 'opt']) S[k] = Object.assign(fresh()[k], o[k]);
  if (!o.stats || o.stats.coins === undefined) S.stats.coins = S.life || 0; // older saves: start the lifetime count from this charter
  if (!S.bestMap[S.map]) S.bestMap[S.map] = S.best;
  // graphics options: fill in anything new, and carry over the old Lit/Simple switch
  const gx0 = fresh().opt.gx, old = o.opt && o.opt.gfx; S.opt.gx = Object.assign(gx0, o.opt && o.opt.gx);
  if (old === 'simple' && !(o.opt && o.opt.gx)) Object.assign(S.opt.gx, GX_PRESETS.low, { preset: 'low' });
  delete S.opt.gfx;
  S.routes = Array.isArray(o.routes) ? o.routes : []; S.inbox = o.inbox || {};
  useTown(S.town); setMap(S.map);
  // towers that no longer fit (on the road after a map change) are sold back for their build price and upgrades
  const fits = t => TOWERS[t.type] && t.r >= YARD && t.r < ROWS && t.c >= 0 && t.c < COLS && !onRoad(t.c, t.r);
  const lost = (S.towers || []).filter(t => !fits(t)), refund = lost.reduce((a, t) => a + (TOWERS[t.type] ? TOWERS[t.type].coins * Math.pow(1.75, t.lvl || 0) : 0), 0);
  S.towers = (S.towers || []).filter(fits); S.coins += refund;
  if (o.moved || S.moved) { delete S.moved; S.movedNote = 'Forked Canyon and Trestle Bridge are gone: every town now has one map, so your charter continues on Copper Gulch.' + (lost.length ? ' ' + lost.length + ' tower' + (lost.length > 1 ? 's' : '') + ' on the new road were refunded ' + fmt(refund) + ' coins.' : ''); }
  return true;
}

/* =========================================================
   Maths
   ========================================================= */
const lv = id => S.research[id] || 0;
/* Tech trees (bought in the Capital with Influence): a branch's rank, and its compounding factor. */
const tk = b => (S.capital && S.capital.tech && S.capital.tech[b]) || 0;
const tf = (b, f) => Math.pow(f, tk(b));
const perk = id => S.perks[id] || 0;
const deedMult = () => 1 + .2 * S.deeds;
const prodMult = () => (1 + .25 * lv('steam')) * deedMult() * tf('industry', 1.15);
const craftMult = () => (1 + .25 * lv('lines')) * (1 + .25 * perk('teams')) * deedMult() * (wx() === 'heat' ? 1.25 : 1) * tf('industry', 1.15);
const sellMult = () => (1 + .1 * lv('haggle')) * (1 + .05 * (typeof capLv === 'function' ? capLv('market') : 0)) * tf('commerce', 1.1);
const dmgMult = () => Math.pow(1.15, lv('guns')) * deedMult() * tf('arms', 1.12);
const tapYield = () => Math.pow(2, lv('tools'));
const vaultMax = () => 20 + 5 * lv('vault') + 5 * tk('fort');
/* Milestones: output doubles at levels 10, 25, 50, then every 100. */
const MS = l => (l >= 10) + (l >= 25) + (l >= 50) + (l >= 100 ? Math.floor(l / 100) : 0);
const nextMs = l => l < 10 ? 10 : l < 25 ? 25 : l < 50 ? 50 : (Math.floor(l / 100) + 1) * 100;
const blv = id => (BY_ALL[id] ? S[BY_ALL[id].kind][id] : 0) || 0; // level of a building in the town swapped in
const bMult = id => Math.pow(2, MS(blv(id)));
const bCost = (b, have) => Math.ceil(b.def.cost * Math.pow(b.g, have));
/* Market: selling pushes a price down; it drifts back up over time. */
const dem = k => S.demand[k] === undefined ? 1 : S.demand[k];
function outRate(k) {
  let r = 0;
  for (const e of EXT) if (e.out === k) r += blv(e.id) * e.rate * prodMult() * bMult(e.id);
  for (const s of SHOPS) if (s.out === k) r += blv(s.id) * s.rate * craftMult() * bMult(s.id);
  return r;
}
const depth = k => 60 + 120 * outRate(k);
const price = k => ITEMS[k].p * sellMult() * dem(k);
const sellValue = (k, n) => { const dp = depth(k); return ITEMS[k].p * sellMult() * dem(k) * dp * (1 - Math.exp(-n / dp)); };
function sell(k, n) {
  n = Math.min(n, S.res[k]); if (!(n > 0)) return 0;
  const v = sellValue(k, n); S.demand[k] = Math.max(.3, dem(k) * Math.exp(-n / depth(k)));
  S.res[k] -= n; earn(v); S.stats.sold += n; S.stats.soldV += v; return v;
}
function fmt(n) {
  if (n < 1000) return String(Math.floor(n));
  const u = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp']; let i = -1;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return n >= 1000 ? n.toExponential(2) : (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.floor(n)) + u[i];
}
const rate = n => n < 10 ? (Math.round(n * 100) / 100).toString() : fmt(n);
const pct = n => Math.round(n * 100) + '%';
function earn(c) { S.coins += c; S.life += c; S.stats.coins += c; }
function add(k, n) { S.res[k] += n; if (!S.seen[k] && S.res[k] > 0) { S.seen[k] = 1; rebuild = true; } }
function goodsText(g) { return Object.keys(g).map(k => g[k] + ' ' + ITEMS[k].n.toLowerCase()).join(' + '); }
function hasGoods(g) { for (const k in g) if (S.res[k] < g[k]) return false; return true; }

/* =========================================================
   Sound (off until switched on)
   ========================================================= */
let AC = null; const lastSnd = {};
function snd(name, f, d = .07, type = 'square', v = .04, slide = 0) {
  if (!S.sound) return; const now = performance.now(); if (now - (lastSnd[name] || 0) < 70) return; lastSnd[name] = now;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    v *= S.opt.vol === undefined ? 1 : S.opt.vol; if (v <= 0) return;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d);
  } catch (e) {}
}
