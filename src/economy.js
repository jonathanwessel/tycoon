'use strict';
/* =========================================================
   Economy
   ========================================================= */
const ACT = {}, STARVE = {}, PHASE = {};
/* Silver Falls power grid: every running workshop level draws 1 unit; Water Wheels supply 4 a level (×2 at milestones).
   When demand outruns supply, every workshop in town slows to the share that is powered. ex adds trial levels (foremen). */
function powerUse(ex) {
  if (!TOWN.power) return { cap: 0, use: 0, f: 1 }; ex = ex || {}; let cap = 0, use = 0;
  for (const e of EXT) if (e.power) { const l = blv(e.id) + (ex[e.id] || 0); cap += l * e.power * Math.pow(2, MS(l)); }
  for (const s of SHOPS) if (!S.off[s.id]) use += blv(s.id) + (ex[s.id] || 0);
  return { cap, use, f: use ? Math.min(1, cap / use) : 1 };
}
let DT_NOW = 0; // the step's length, for the Capitol's War Office timer
function econStep(dt) {
  DT_NOW = dt;
  const ot = S.ot > 0 ? 3 : 1, pm = prodMult() * ot, cm = craftMult() * ot * powerUse().f, ease = Math.min(1, dt * 3);
  S.ot = Math.max(0, S.ot - dt); for (const k in S.cd) S.cd[k] = Math.max(0, S.cd[k] - dt);
  for (const e of EXT) { const l = S.ext[e.id] || 0; if (l && e.out) add(e.out, l * e.rate * pm * bMult(e.id) * dt); }
  // deliveries arrive first; what shipping routes will send this step is held back from this town's own workshops
  const resv = routeHold(dt);
  // workshops that use the same good share it by what each could use at full speed (not first come, first served),
  // so upgrading a workshop wins it a bigger share and the whole chain keeps working
  const want = {}, pool = {}, capOf = s => (S.shops[s.id] || 0) * s.rate * cm * bMult(s.id) * dt;
  for (const s of SHOPS) if (S.shops[s.id] && !S.off[s.id]) { const c = capOf(s); for (const k in s.in) want[k] = (want[k] || 0) + c * s.in[k]; }
  for (const s of SHOPS) {
    const l = S.shops[s.id] || 0; if (!l) continue;
    const cap = capOf(s); let n = S.off[s.id] ? 0 : cap, miss = null;
    for (const k in s.in) { if (pool[k] === undefined) pool[k] = Math.max(0, S.res[k] - (resv[k] || 0)); const m = Math.min(pool[k] * cap / (want[k] || 1), Math.max(0, S.res[k] - (resv[k] || 0))) / s.in[k]; if (m < n) { n = m; miss = k; } }
    if (n > 0) { for (const k in s.in) S.res[k] -= n * s.in[k]; add(s.out, n); S.stats.made += n; PHASE[s.id] = ((PHASE[s.id] || 0) + n / l / bMult(s.id)) % 1; }
    ACT[s.id] = (ACT[s.id] || 0) + (n / cap - (ACT[s.id] || 0)) * ease; STARVE[s.id] = miss;
  }
  const rec = 1 - Math.exp(-(perk('trade') ? .04 : .02) * dt);
  for (const k in S.demand) { S.demand[k] += (1 - S.demand[k]) * rec; if (S.demand[k] > .999) delete S.demand[k]; }
  shipGoods(dt); // shipments leave before auto-sell
  if (lv('ledger')) for (const k in ITEMS) { const keep = keepOf(k); if (S.auto[k] && S.res[k] > keep && dem(k) >= S.sellAbove) sell(k, S.res[k] - keep); }
  foremenWork();
}
/* How much of a good auto-sell leaves in the warehouse: enough to build any tower twice with this town's materials and
   to fill the caravan contracts on offer (never under KEEP). The Market Board in the Capital can raise it. */
function keepOf(k) {
  let n = KEEP;
  for (const t in TOWERS) { const g = towerGoods(t); if (g[k]) n = Math.max(n, g[k] * 2); }
  for (const c of S.contracts || []) if (c.k === k) n = Math.max(n, c.qty);
  return Math.ceil(n * (typeof capKeep === 'function' ? capKeep() : 1));
}
function econ(dt) { while (dt > 0) { const s = Math.min(dt, 5); econStep(s); dt -= s; } }

/* Production per second once it settles, as a chain: gatherers first, goods arriving by shipping route, then workshops
   in chain order (SHOPS is listed upstream first), each limited by its inputs. What this town's routes ship out is held
   back from its workshops, as in econStep. ex adds levels ({ id: n }) or research ({ 'r:steam': 1 }) to try them out.
   Returns { have: left over per good, made: produced per good, used: goods a workshop takes, out: shipped away }. */
const ROUTE_OUT = {}, ROUTE_NEED = {}; // per town: goods per second it makes, refreshed by econTowns, so routes know what can be sent
function chainFlow(ex) {
  ex = ex || {}; const bump = {};
  for (const k in ex) if (k.startsWith('r:')) { const id = k.slice(2); bump[id] = S.research[id] || 0; S.research[id] = bump[id] + ex[k]; }
  try {
    const pm = prodMult(), cm = craftMult() * powerUse(ex).f, have = {}, made = {}, used = {}, hold = {}, out = {}, need = {}, cr = carrier();
    for (const k in ITEMS) { have[k] = 0; made[k] = 0; }
    const lvl = id => blv(id) + (ex[id] || 0);
    for (const e of EXT) { const l = lvl(e.id); if (l && e.out) { const n = l * e.rate * pm * Math.pow(2, MS(l)); have[e.out] += n; made[e.out] += n; } }
    const capOf = s => { const l = lvl(s.id); return l && !S.off[s.id] ? l * s.rate * cm * Math.pow(2, MS(l)) : 0; }, pool = {};
    for (const s of SHOPS) { const c = capOf(s); for (const k in s.in) need[k] = (need[k] || 0) + c * s.in[k]; }
    for (const r of S.routes || []) {
      if (r.paused || !townOpen(r.to) || !townOpen(r.from)) continue;
      // an Auto route follows what the workshops here would use (so a tried-out upgrade gets its extra goods)
      const rate = r.per === 'auto' && r.to === TOWN_ID ? Math.min(cr.max / 60, Math.max(5 / 60, (need[r.k] || 0) * 1.1)) : routeRate(r) / 60;
      if (r.to === TOWN_ID) { const src = ROUTE_OUT[r.from], n = src && src[r.k] !== undefined ? Math.min(rate, src[r.k]) : rate; have[r.k] += n; }
      if (r.from === TOWN_ID) hold[r.k] = (hold[r.k] || 0) + rate;
    }
    for (const s of SHOPS) {
      const cap = capOf(s); if (!cap) continue;
      let n = cap; for (const k in s.in) { used[k] = 1; if (pool[k] === undefined) pool[k] = Math.max(0, have[k] - (hold[k] || 0)); n = Math.min(n, pool[k] * cap / (need[k] || 1) / s.in[k]); }
      if (n > 0) { for (const k in s.in) have[k] -= n * s.in[k]; have[s.out] += n; made[s.out] += n; }
    }
    for (const k in hold) { out[k] = Math.min(hold[k], Math.max(0, have[k])); have[k] -= out[k]; }
    return { have, made, used, out, need };
  } finally { for (const id in bump) S.research[id] = bump[id]; }
}
/* What a good sells for when sold steadily at n per second: selling pushes demand down and it recovers (see econStep),
   so a flood of one good settles at a lower price. */
function steadyPrice(k, n) {
  const rec = perk('trade') ? .04 : .02, d = n > 0 ? Math.max(.3, rec / (rec + n / depth(k))) : 1;
  return ITEMS[k].p * sellMult() * d;
}
/* Steady income: coins per second this town makes once production settles, selling the surplus at the price that
   selling it would settle at. mode 'top' sells only goods no built workshop uses. Foremen value an upgrade by it. */
function steadyIncome(extra, mode) {
  const ex = typeof extra === 'string' ? { [extra]: 1 } : extra || {}, f = chainFlow(ex);
  let v = 0; for (const k in ITEMS) if (mode !== 'top' || !f.used[k]) { const n = Math.max(0, f.have[k]); if (n > 0) v += n * steadyPrice(k, n); }
  return v;
}
/* Foremen. They are paid a share of what you earn (Works tab: 25, 50, 75 or 100 percent), saved in a purse, and never
   take you below your reserve (none, or 1 or 5 minutes of income). The rest of your income is yours to keep.
   From the purse they buy whatever pays for itself fastest (cost ÷ extra steady income), looking at:
   - one more level of a building they run;
   - all the levels up to that building's next ×2 milestone, bought together once the purse holds them;
   - for a workshop starved of an input, levels on the building that makes it (as many as the shortage needs);
   - the research that speeds the whole town up (Steam Power, Assembly Lines, Haggling), if you let them.
   They save for up to half an hour of income; dearer things are left to you (or to a new charter). */
const FB_RESEARCH = ['steam', 'lines', 'haggle'];
/* The Foreman Agency perk: hire a foreman for a built building as soon as the coins are there twice over (one a step). */
function agencyHire() {
  if (!perk('agency')) return;
  for (const b of BUILD) { const id = b.def.id; if (S.mgr[id] || !blv(id)) continue; const c = mgrCost(id); if (S.coins >= c * 2) { S.coins -= c; S.mgr[id] = 1; return; } }
}
function foremenWork() {
  agencyHire();
  // each town's purse fills from what that town earns (S.life is per town); coins themselves are shared by the empire
  const fb = S.fb || (S.fb = { share: .5, keep: 0, purse: 0, last: S.life || 0, study: 1 });
  if (fb.study === undefined) fb.study = 1;
  if (!fb.own) { fb.own = 1; fb.last = S.life || 0; } // saves from before purses were per town counted the whole empire
  if (fb.last === undefined || fb.last > (S.life || 0)) fb.last = S.life || 0;
  const inc = steadyIncome(), cap = Math.max(1e3, inc * 1800), cg = capOpen(), share = (cg ? S.capital.share * capSplit().foremen : fb.share) * tf('admin', 1.1) * exBoost() * (polIs('econ', 'planned') ? 1.5 : 1); // the Capitol's budget replaces each town's own settings
  fb.purse = Math.min((fb.purse || 0) + ((S.life || 0) - fb.last) * share, cap); fb.last = S.life || 0;
  capitalWork(DT_NOW, inc);
  if (polIs('army', 'standing')) S.coins = Math.max(0, S.coins - inc * ARMY_UPKEEP * DT_NOW); // the Standing Army's pay, from every town
  const mine = Object.keys(S.mgr).filter(id => S.mgr[id] === 1 && BY_ID[id]); if (!mine.length) { fb.goal = null; return; }
  const reserve = (cg ? 0 : fb.keep) * 60 * inc;
  for (let i = 0; i < 8; i++) {
    const base = steadyIncome(), budget = Math.min(fb.purse, S.coins - reserve); let best = null;
    const earn = Math.max(1e-6, inc * fb.share);
    const offer = (kind, id, n, c, gain) => { if (!(gain > 1e-9) || c > cap) return; const sc = Math.max(0, c - budget) / earn + c / gain; if (!best || sc < best.sc) best = { kind, id, n, c, sc }; };
    const levels = (b, n) => { let c = 0; for (let j = 0; j < n; j++) c += bCost(b, blv(b.def.id) + j); return c; };
    for (const id of mine) {
      const b = BY_ID[id], have = blv(id), toMs = nextMs(have) - have;
      offer('b', id, 1, bCost(b, have), steadyIncome(id) - base);
      if (toMs > 1) offer('b', id, toMs, levels(b, toMs), steadyIncome({ [id]: toMs }) - base);
      // a starved workshop: its supplier's levels count together with it, enough of them to feed it
      if (b.kind !== 'shops' || steadyIncome(id) - base > 1e-9) continue;
      for (const k in b.def.in) {
        const sup = BUILD.find(o => o.def.out === k); if (!sup || S.mgr[sup.def.id] !== 1) continue;
        const sl = blv(sup.def.id), sMs = nextMs(sl) - sl;
        for (const n of [1, 2, 4, 8, sMs]) { if (n > 25) continue; offer('b', sup.def.id, n, levels(sup, n) + bCost(b, have), steadyIncome({ [id]: 1, [sup.def.id]: n }) - base); }
      }
    }
    if (fb.study && !cg) for (const id of FB_RESEARCH) { const r = RESEARCH.find(q => q.id === id); if (!r || lv(id) >= r.max) continue; offer('r', id, 1, resCost(r), steadyIncome({ ['r:' + id]: 1 }) - base); }
    // a bundle is bought one level at a time as soon as the purse holds all of it, so the chain grows in step
    fb.goal = best ? (best.kind === 'r' ? 'r:' : '') + best.id : null; fb.goalN = best ? best.n : 0; fb.goalC = best ? best.c : 0;
    if (!best || best.c > budget) break;
    if (best.kind === 'r') { const r = RESEARCH.find(q => q.id === best.id); fb.purse -= best.c; S.coins -= best.c; S.research[best.id] = lv(best.id) + 1; continue; }
    const b = BY_ID[best.id];
    for (let j = 0; j < best.n; j++) { const have = blv(best.id), c = bCost(b, have); fb.purse -= c; S.coins -= c; S[b.kind][best.id] = have + 1; leveled(b, have, have + 1, true); }
  }
}
/* Income actually earned, averaged over the last minute (every coin source counts). */
/* liveIncome() is the whole empire; liveIncome(id) one town, from that town's lifetime earnings. */
const INC = { t: 0, samples: [], town: {} };
function sampleIncome(dt) {
  INC.t += dt; if (INC.t < 1) return; INC.t = 0; const now = performance.now();
  const push = (arr, v) => { arr.push([now, v]); if (arr.length > 61) arr.shift(); };
  push(INC.samples, S.stats.coins);
  for (const id of townIds()) push(INC.town[id] = INC.town[id] || [], id === S.town ? S.life : S.towns[id].life);
}
function liveIncome(id) {
  const s = id ? INC.town[id] || [] : INC.samples; if (s.length < 3) return 0;
  const [t0, c0] = s[0], [t1, c1] = s[s.length - 1]; return Math.max(0, (c1 - c0) / Math.max(1, (t1 - t0) / 1000));
}
const townIncome = id => withTown(id, () => steadyIncome()); // potential coins per second of any town
let buyMode = 1;
function buyPlan(b) {
  const have = blv(b.def.id);
  if (buyMode !== 'max') {
    const want = buyMode === 'ms' ? Math.max(1, nextMs(have) - have) : buyMode; let c = 0;
    for (let i = 0; i < want; i++) c += bCost(b, have + i);
    return { n: want, c, ok: S.coins >= c };
  }
  let n = 0, c = 0;
  while (n < 1e4) { const next = bCost(b, have + n); if (c + next > S.coins) break; c += next; n++; }
  return n ? { n, c, ok: true } : { n: 1, c: bCost(b, have), ok: false };
}
function buyBuilding(b) {
  const p = buyPlan(b); if (!p.ok) return false;
  const have = blv(b.def.id); S.coins -= p.c; S[b.kind][b.def.id] = have + p.n;
  if (b.def.out && !S.seen[b.def.out]) { S.seen[b.def.out] = 1; rebuild = true; }
  leveled(b, have, have + p.n); return true;
}
function leveled(b, from, to, quiet) {
  if (MS(to) > MS(from) && typeof exNews === 'function') exNews('ms'); // the Stock Exchange hears of it
  if (b.def.id === 'locow' && to >= 1) S.railOpen = 1; // the first Locomotive Works brings trains to every route
  if (TOWN_ID !== S.town) { if (MS(to) > MS(from)) say(TOWN.n + ': ' + b.def.n + ' reached level ' + to + ', output doubled.'); return; } // a town working in the background: no effects on this map
  const [sx, sy] = SLOT[b.def.id];
  // a first build stands in scaffolding, then pops out of a cloud of dust (fx.js); a new level pops and sparkles
  if (!quiet) { snd('build', 330, .12, 'triangle', .05, 330); if (!from) FXS.build[b.def.id] = BUILD_T; else { FXS.pop[b.def.id] = .45; sparkle(sx + 1, sy + 1, 14, 1); } }
  if (MS(to) > MS(from)) {
    FXS.gold[b.def.id] = 1.6; snd('ms', 660, .3, 'triangle', .06, 660);
    floats.push({ x: sx + 1, y: sy + .6, t: 1.8, s: 'Output ×2', c: P.yel, z: .42 });
    for (let i = 0; i < 18; i++) parts.push({ x: sx + 1, y: sy + 1, vx: Math.cos(i / 18 * 6.28) * 2.5, vy: Math.sin(i / 18 * 6.28) * 2.5 - 1, g: 2, t: .9, c: i % 2 ? P.yel : P.yelL, s: .09 });
    say(b.def.n + ' reached level ' + to + ': output doubled.');
  }
}
function newContract() {
  const pool = Object.keys(ITEMS).filter(k => S.seen[k]);
  const k = pool[Math.floor(Math.random() * pool.length)];
  const v = Math.max(40, S.life * .04) * (.6 + Math.random() * .8);
  const qty = Math.max(5, Math.ceil(v / ITEMS[k].p));
  return { k, qty, pay: Math.ceil(qty * ITEMS[k].p * 2.5) };
}
const contractPay = c => c.pay * sellMult() * (1 + .25 * perk('trade'));
function deliver(i) {
  const c = S.contracts[i]; if (!c || S.res[c.k] < c.qty) return false;
  S.res[c.k] -= c.qty; const v = contractPay(c); earn(v); S.stats.contracts++; S.contracts[i] = newContract(); rebuild = true;
  say('Order delivered: +' + fmt(v) + ' coins.'); FXS.car = 0;
  setTimeout(() => coinBurst(11, 3, 7, v), 900);
  snd('coin', 660, .15, 'square', .04, 660); return true;
}
/* Tap the trees or rocks (src is the yard slot); each town decides what they give (Iron Ridge: stone and iron ore). */
function gather(src) {
  const k = TOWN.tap[src]; add(k, tapYield()); S.stats.taps++; FXS.shake[src] = .25;
  const [sx, sy] = SLOT[src]; fly(k, sx + 1, sy + 1, CHIP[k]);
  for (let i = 0; i < 5; i++) parts.push({ x: sx + .6 + Math.random() * .8, y: sy + .8 + Math.random() * .5, vx: (Math.random() - .5) * 2, vy: -1.5 - Math.random(), g: 6, t: .5, c: k === 'wood' ? P.woodL : P.grayL, s: .07 });
  k === 'wood' ? snd('chop', 180, .06, 'square', .05, -90) : snd('dig', 520, .05, 'triangle', .06, -200);
}
/* A foreman costs 100 times the building's base price, and every foreman after the first two costs 60% more again,
   so the Crystal Drill's (40K at the start) is well above the first two (1.5K each for the camp and mine). */
const mgrCost = id => Math.ceil(BY_ID[id].def.cost * 100 * Math.pow(1.6, Math.max(0, Object.keys(S.mgr).length - 2)) * tf('admin', .85));
function hire(id) { const c = mgrCost(id); if (S.coins < c || S.mgr[id]) return; S.coins -= c; S.mgr[id] = 1; say('A foreman now runs the ' + BY_ID[id].def.n + '. Foremen pick the upgrades that pay back fastest, within the budget set in the Works tab.'); snd('build', 440, .15, 'triangle', .05, 220); }
