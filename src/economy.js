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
function econStep(dt) {
  const ot = S.ot > 0 ? 3 : 1, pm = prodMult() * ot, cm = craftMult() * ot * powerUse().f, ease = Math.min(1, dt * 3);
  S.ot = Math.max(0, S.ot - dt); for (const k in S.cd) S.cd[k] = Math.max(0, S.cd[k] - dt);
  for (const e of EXT) { const l = S.ext[e.id] || 0; if (l && e.out) add(e.out, l * e.rate * pm * bMult(e.id) * dt); }
  // deliveries arrive first; what shipping routes will send this step is held back from this town's own workshops
  const resv = routeHold(dt);
  for (const s of SHOPS) {
    const l = S.shops[s.id] || 0; if (!l) continue;
    const cap = l * s.rate * cm * bMult(s.id) * dt; let n = S.off[s.id] ? 0 : cap, miss = null;
    for (const k in s.in) { const m = Math.max(0, S.res[k] - (resv[k] || 0)) / s.in[k]; if (m < n) { n = m; miss = k; } }
    if (n > 0) { for (const k in s.in) S.res[k] -= n * s.in[k]; add(s.out, n); S.stats.made += n; PHASE[s.id] = ((PHASE[s.id] || 0) + n / l / bMult(s.id)) % 1; }
    ACT[s.id] = (ACT[s.id] || 0) + (n / cap - (ACT[s.id] || 0)) * ease; STARVE[s.id] = miss;
  }
  const rec = 1 - Math.exp(-(perk('trade') ? .04 : .02) * dt);
  for (const k in S.demand) { S.demand[k] += (1 - S.demand[k]) * rec; if (S.demand[k] > .999) delete S.demand[k]; }
  shipGoods(dt); // shipments leave before auto-sell
  if (lv('ledger')) for (const k in ITEMS) if (S.auto[k] && S.res[k] > KEEP && dem(k) >= S.sellAbove) sell(k, S.res[k] - KEEP);
  foremenWork();
}
function econ(dt) { while (dt > 0) { const s = Math.min(dt, 5); econStep(s); dt -= s; } }

/* Steady income: coins per second this town makes once production settles, if surplus goods are sold at full price.
   Workshops are limited by their inputs, taken upstream first (SHOPS is listed in chain order), so a workshop short of
   inputs adds nothing and the camp that would feed it shows its real worth. extraId counts one more level of that
   building, which is how foremen value an upgrade. mode 'top' sells only goods no built workshop uses. */
function steadyIncome(extra, mode) {
  const ex = typeof extra === 'string' ? { [extra]: 1 } : extra || {}, pm = prodMult(), cm = craftMult() * powerUse(ex).f, have = {}, used = {};
  for (const k in ITEMS) have[k] = 0;
  const lvl = id => blv(id) + (ex[id] || 0);
  for (const e of EXT) { const l = lvl(e.id); if (l && e.out) have[e.out] += l * e.rate * pm * Math.pow(2, MS(l)); }
  for (const s of SHOPS) {
    const l = lvl(s.id); if (!l || S.off[s.id]) continue;
    let n = l * s.rate * cm * Math.pow(2, MS(l)); for (const k in s.in) { used[k] = 1; n = Math.min(n, have[k] / s.in[k]); }
    if (n > 0) { for (const k in s.in) have[k] -= n * s.in[k]; have[s.out] += n; }
  }
  let v = 0; for (const k in ITEMS) if (mode !== 'top' || !used[k]) v += Math.max(0, have[k]) * ITEMS[k].p * sellMult();
  return v;
}
/* Foremen. They are paid a share of what you earn (Works tab: 25, 50, 75 or 100 percent), saved in a purse, and never
   take you below your reserve (none, or 1 or 5 minutes of income). The rest of your income is yours to keep, so savings
   always grow. From the purse they buy the upgrade that pays for itself fastest (cost ÷ extra steady income): that
   favours levels reaching a ×2 milestone, values the top of the chain properly, and skips workshops short of inputs. */
function foremenWork() {
  const fb = S.fb || (S.fb = { share: .5, keep: 0, purse: 0, last: S.stats.coins });
  if (fb.last === undefined || fb.last > S.stats.coins) fb.last = S.stats.coins;
  const inc = steadyIncome();
  fb.purse = Math.min((fb.purse || 0) + (S.stats.coins - fb.last) * fb.share, Math.max(1e3, inc * 600)); fb.last = S.stats.coins;
  if (!Object.keys(S.mgr).some(id => S.mgr[id] === 1)) return;
  const reserve = fb.keep * 60 * inc;
  // they save up for the best-value upgrade rather than spending on whatever is cheap right now
  // (anything costing more than the purse can ever hold, about 10 minutes of income, is left for you)
  const cap = Math.max(1e3, inc * 600);
  for (let i = 0; i < 6; i++) {
    const base = steadyIncome(); let best = null, budget = Math.min(fb.purse, S.coins - reserve);
    for (const id in S.mgr) {
      if (S.mgr[id] !== 1) continue; const b = BY_ID[id], c = bCost(b, blv(id)); if (c > cap) continue;
      const gain = steadyIncome(id) - base;
      if (gain > 1e-9) { const sc = c / gain; if (!best || sc < best.sc) best = { b, id, c, sc }; continue; }
      // a workshop short of an input is worth nothing alone; value it together with a level on the building that
      // makes its scarcest input (if a foreman runs that one too), and buy the supplier's level first
      if (b.kind !== 'shops') continue;
      for (const k in b.def.in) {
        const sup = BUILD.find(o => o.def.out === k); if (!sup || S.mgr[sup.def.id] !== 1) continue;
        const sc2 = bCost(sup, blv(sup.def.id)), g2 = steadyIncome({ [id]: 1, [sup.def.id]: 1 }) - base;
        if (!(g2 > 1e-9) || c + sc2 > cap) continue;
        const sc = (c + sc2) / g2; if (!best || sc < best.sc) best = { b: sup, id: sup.def.id, c: sc2, sc };
      }
    }
    fb.goal = best ? best.id : null;
    if (!best || best.c > budget) break;
    const have = blv(best.id); fb.purse -= best.c; S.coins -= best.c; S[best.b.kind][best.id] = have + 1; levelled(best.b, have, have + 1, true);
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
  levelled(b, have, have + p.n); return true;
}
function levelled(b, from, to, quiet) {
  if (b.def.id === 'locow' && to >= 1) S.railOpen = 1; // the first Locomotive Works brings trains to every route
  if (TOWN_ID !== S.town) { if (MS(to) > MS(from)) say(TOWN.n + ': ' + b.def.n + ' reached level ' + to + ', output doubled.'); return; } // a town working in the background: no effects on this map
  const [sx, sy] = SLOT[b.def.id];
  if (!quiet) { FXS.pop[b.def.id] = .45; snd('build', 330, .12, 'triangle', .05, 330); for (let i = 0; i < 10; i++) parts.push({ x: sx + .3 + Math.random() * 1.4, y: sy + 1.6, vx: (Math.random() - .5) * 2, vy: -2 - Math.random() * 2, g: 6, t: .6, c: P.yelL, s: .08 }); }
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
  for (let j = 0; j < 5; j++) setTimeout(() => fly('coin', 11, 3, $('hCoinWrap')), 900 + j * 90);
  snd('coin', 660, .15, 'square', .04, 660); return true;
}
/* Tap the trees or rocks (src is the yard slot); each town decides what they give (Iron Ridge: stone and iron ore). */
function gather(src) {
  const k = TOWN.tap[src]; add(k, tapYield()); S.stats.taps++; FXS.shake[src] = .25;
  const [sx, sy] = SLOT[src]; fly(k, sx + 1, sy + 1, CHIP[k]);
  for (let i = 0; i < 5; i++) parts.push({ x: sx + .6 + Math.random() * .8, y: sy + .8 + Math.random() * .5, vx: (Math.random() - .5) * 2, vy: -1.5 - Math.random(), g: 6, t: .5, c: k === 'wood' ? P.woodL : P.greyL, s: .07 });
  k === 'wood' ? snd('chop', 180, .06, 'square', .05, -90) : snd('dig', 520, .05, 'triangle', .06, -200);
}
/* A foreman costs 100 times the building's base price, and every foreman after the first two costs 60% more again,
   so the Crystal Drill's (40K at the start) is well above the first two (1.5K each for the camp and mine). */
const mgrCost = id => Math.ceil(BY_ID[id].def.cost * 100 * Math.pow(1.6, Math.max(0, Object.keys(S.mgr).length - 2)));
function hire(id) { const c = mgrCost(id); if (S.coins < c || S.mgr[id]) return; S.coins -= c; S.mgr[id] = 1; say('A foreman now runs the ' + BY_ID[id].def.n + '. Foremen pick the upgrades that pay back fastest, within the budget set in the Works tab.'); snd('build', 440, .15, 'triangle', .05, 220); }
