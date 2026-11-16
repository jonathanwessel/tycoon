'use strict';
/* =========================================================
   Market depth: booms and busts, caravan orders with deadlines and reputation, auto-sell modes
   ========================================================= */
/* --- Booms and busts ----------------------------------------------------------------------------------------------
   Every few minutes one good the town you play has seen booms (buyers pay 40-80% more) or busts (35-50% less) for
   three to six minutes, across the whole empire (every town sells at that price). At most two at a time. They change
   what a sale pays now, never the steady income that foremen and the potential figure look at (in the long run they
   average out). S.mkt = { ev: { good: { m, t, T } }, next: seconds to the next one }. */
const MKT = { first: 240, gap: [150, 300], len: [180, 360], max: 2, boom: [1.4, 1.8], bust: [.5, .65] };
const between = (r, x) => r[0] + (r[1] - r[0]) * x;
const mktEv = k => (S.mkt && S.mkt.ev && S.mkt.ev[k]) || null;
const mktMult = k => { const e = mktEv(k); return e ? e.m : 1; };
function mktStart(k, boom) {
  const M = S.mkt, T = Math.round(between(MKT.len, Math.random())), m = Math.round(between(boom ? MKT.boom : MKT.bust, Math.random()) * 20) / 20;
  M.ev[k] = { m, t: T, T }; const mins = Math.round(T / 60);
  say(boom ? ITEMS[k].n + ' boom: buyers pay ' + pct(m - 1) + ' more for ' + mins + ' minutes.' : ITEMS[k].n + ' bust: prices are down ' + pct(1 - m) + ' for ' + mins + ' minutes.');
  return M.ev[k];
}
function mktTick(dt) {
  const M = S.mkt || (S.mkt = { ev: {}, next: MKT.first }); M.ev = M.ev || {};
  for (const k in M.ev) { M.ev[k].t -= dt; if (!(M.ev[k].t > 0) || !ITEMS[k]) delete M.ev[k]; }
  M.next = (M.next === undefined ? MKT.first : M.next) - dt; if (M.next > 0) return;
  M.next = Math.round(between(MKT.gap, Math.random()));
  const pool = Object.keys(ITEMS).filter(k => S.seen[k] && !M.ev[k]);
  if (pool.length && Object.keys(M.ev).length < MKT.max) mktStart(pool[Math.floor(Math.random() * pool.length)], Math.random() < .55);
}
const clock = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

/* --- Reputation and caravan orders --------------------------------------------------------------------------------
   The empire's name with the caravan companies, 0 to 100 (50 to begin with). Orders pay x0.7 at 0, x1 at 50, x1.3 at
   100. Delivering raises it (3, a rush order 5); an order left to run out lowers it (4), and so does swapping one (1).
   It drifts slowly back toward 50 (half an hour), so a good name needs keeping up. From 60 rush orders turn up (60%
   more pay, half the time); from 80 caravans bring a fourth order. Orders only count down in the town you are playing,
   and only while you are playing (never on the title, while paused or while away). It survives charters; the
   Convention starts it again at 50. */
const REP0 = 50, REP_DONE = 3, REP_RUSH = 5, REP_LATE = 4, REP_SWAP = 1, REP_DRIFT = 1800;
const repOf = () => S.rep === undefined ? REP0 : S.rep;
const repMult = () => .7 + .006 * repOf();
const repTier = (r = repOf()) => r >= 80 ? 'Renowned' : r >= 60 ? 'Trusted' : r >= 30 ? 'Known' : 'Doubted';
const orderSlots = () => repOf() >= 80 ? 4 : 3;
function repAdd(n) { S.rep = Math.max(0, Math.min(100, repOf() + n)); }
const orderTime = rush => Math.round(rush ? 150 + Math.random() * 90 : 300 + Math.random() * 300);
/* An order finished (delivered, run out or swapped): a new one takes its place, unless there are more than the slots. */
function orderNext(i) { if (S.contracts.length > orderSlots()) S.contracts.splice(i, 1); else S.contracts[i] = newContract(); rebuild = true; }
function ordersFill() { while (S.contracts.length < orderSlots()) S.contracts.push(newContract()); }
function ordersTick(dt) {
  ordersFill();
  for (let i = S.contracts.length - 1; i >= 0; i--) {
    const c = S.contracts[i]; if (c.t === undefined) c.t = c.T = orderTime(c.rush);
    c.t -= dt; if (c.t > 0) continue;
    repAdd(-REP_LATE); say('The caravan for ' + fmt(c.qty) + ' ' + ITEMS[c.k].n.toLowerCase() + ' left without it: reputation -' + REP_LATE + '.'); orderNext(i);
  }
  S.rep = repOf() + (REP0 - repOf()) * (1 - Math.exp(-dt / REP_DRIFT));
}
function swapOrder(i) { if (!S.contracts[i]) return false; repAdd(-REP_SWAP); orderNext(i); return true; }

/* --- Auto-sell modes ----------------------------------------------------------------------------------------------
   Per good (S.auto[k]): off; 'all' (true in older saves: sell the surplus whenever the price is above the town's
   threshold); 'bust' (the same, but hold it while the good is in a bust, then sell the backlog); 'boom' (keep it all
   and sell only while the good booms). Every mode keeps what keepOf asks for (towers and orders). */
const AUTO_MODES = ['off', 'all', 'bust', 'boom'];
const AUTO_N = { off: 'Auto off', all: 'Auto: always', bust: 'Auto: skip busts', boom: 'Auto: booms only' };
const autoMode = k => { const a = S.auto[k]; return a === 'bust' || a === 'boom' ? a : a ? 'all' : 'off'; };
function autoNext(k) { const m = AUTO_MODES[(AUTO_MODES.indexOf(autoMode(k)) + 1) % AUTO_MODES.length]; S.auto[k] = m === 'off' ? false : m === 'all' ? true : m; return m; }
function autoSell() {
  for (const k in ITEMS) {
    const m = autoMode(k); if (m === 'off') continue;
    const extra = S.res[k] - keepOf(k), mm = mktMult(k); if (!(extra > 0)) continue;
    if (m === 'boom' ? mm > 1 : (m !== 'bust' || mm >= 1) && dem(k) * mm >= S.sellAbove) sell(k, extra);
  }
}
