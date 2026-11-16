'use strict';
/* =========================================================
   Interface: the Stock Exchange
   One card per town's company: its price and how it moved over the last minutes (a flat step chart), the shares you
   hold, what they pay, and buy and sell buttons. The newest headlines run above.
   ========================================================= */
let exQty = 10;
function exChart(cv, hist, up) {
  const g = cv.getContext('2d'), w = cv.width, ht = cv.height; g.clearRect(0, 0, w, ht);
  g.fillStyle = 'rgba(157, 163, 189, .18)'; for (let i = 1; i < 4; i++) g.fillRect(0, Math.round(ht * i / 4), w, 1);
  if (hist.length < 2) return;
  let lo = Infinity, hi = -Infinity; for (const v of hist) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const pad = (hi - lo) * .12 || hi * .05 || 1; lo -= pad; hi += pad;
  const X = i => Math.round(i / (EX_HIST - 1) * (w - 2)), Y = v => Math.round((1 - (v - lo) / (hi - lo)) * (ht - 3)) + 1;
  const off = EX_HIST - hist.length, col = up ? '#7fd992' : '#f07067';
  g.fillStyle = up ? 'rgba(127, 217, 146, .14)' : 'rgba(240, 112, 103, .14)';
  for (let i = 0; i < hist.length; i++) { const x = X(i + off), y = Y(hist[i]), nx = i + 1 < hist.length ? X(i + 1 + off) : x + 2; g.fillRect(x, y, nx - x, ht - y); }
  g.fillStyle = col;
  for (let i = 0; i < hist.length; i++) {
    const x = X(i + off), y = Y(hist[i]), nx = i + 1 < hist.length ? X(i + 1 + off) : x + 2; g.fillRect(x, y - 1, nx - x, 2);
    if (i + 1 < hist.length) { const y2 = Y(hist[i + 1]); g.fillRect(nx - 1, Math.min(y, y2) - 1, 2, Math.abs(y2 - y) + 2); }
  }
  const lx = X(EX_HIST - 1), ly = Y(hist[hist.length - 1]); g.fillStyle = '#ece6d8'; g.fillRect(lx - 2, ly - 2, 4, 4);
}
PANELS.exchange = p => {
  if (!exOpen()) { p.append(h('p', null, 'The Stock Exchange is an institution of the Capital. Build it there first.'), h('button', { cls: 'primary', on: () => goTab('capital') }, 'The Capital')); return; }
  const x = exBook(), news = h('div', { cls: 'news' });
  p.append(h('p', null, 'Each town is a company of 1000 shares. Prices follow the town\'s income, and news moves them. Shares pay dividends; own more than half and that town\'s foremen get 50% more. Buying costs 1% over the price, selling pays 1% under. A charter gives up your shares along with your coins.'), news);
  let seen = '';
  ups.push(() => { const key = x.news.map(n => n.at).join(); if (key === seen) return; seen = key; news.textContent = ''; for (const n of x.news.slice(0, 3)) news.append(h('div', { cls: 'nw ' + (EX_NEWS[n.k].m > 1 ? 'up' : 'down') }, n.s)); news.hidden = !x.news.length; });
  const seg = h('div', { cls: 'seg' }, h('small', null, 'Trade'));
  for (const v of [1, 10, 100, 1000]) { const b = h('button', { cls: 'small', on: () => { exQty = v; refresh(); } }, v === 1000 ? 'Max' : '×' + v); seg.append(b); ups.push(() => b.classList.toggle('on', exQty === v)); }
  p.append(seg);
  for (const id of townIds().filter(townOpen)) {
    const st = exStock(id), price = h('b'), chg = h('span', { cls: 'chg' }), own = h('small'), cv = h('canvas', { cls: 'stkchart', width: '280', height: '64', 'aria-hidden': 'true' });
    const buy = h('button', { cls: 'small primary', on: () => { const n = exBuy(id, exQty); if (n) say('Bought ' + n + ' ' + COMPANY[id] + ' shares.'); refresh(); } }, 'Buy');
    const sell = h('button', { cls: 'small', on: () => { const n = exSell(id, exQty); if (n) say('Sold ' + n + ' ' + COMPANY[id] + ' shares.'); refresh(); } }, 'Sell');
    const maj = h('i', null, 'Majority');
    p.append(h('div', { cls: 'stk' }, h('div', { cls: 'top' }, h('div', { cls: 'grow' }, h('div', { cls: 'name' }, COMPANY[id], ' ', maj), h('small', null, TOWNS[id].n)), h('div', { cls: 'pr' }, price, chg)), cv, h('div', { cls: 'bot' }, own, h('div', { cls: 'acts' }, sell, buy))));
    let drawn = -1;
    ups.push(() => {
      const hs = st.hist, last = hs.length ? hs[hs.length - 1] : st.p, first = hs.length ? hs[Math.max(0, hs.length - 31)] : st.p, d = first ? last / first - 1 : 0;
      price.textContent = fmt(st.p); chg.textContent = (d >= 0 ? '▲ ' : '▼ ') + Math.abs(d * 100).toFixed(1) + '%'; chg.className = 'chg ' + (d >= 0 ? 'up' : 'down');
      const div = ((CAPI.by && CAPI.by[id]) || 0) * exYield() * st.own / EX_SHARES, worth = st.own * exSellPrice(id), gain = worth - (st.cost || 0);
      own.textContent = st.own ? st.own + ' of 1000 shares · worth ' + fmt(worth) + ' (' + (gain >= 0 ? '+' : '−') + fmt(Math.abs(gain)) + ') · pays ' + fmt(div * 60) + ' a minute' : 'You hold none. ' + fmt(exBuyPrice(id)) + ' a share.';
      maj.hidden = !exMajority(id);
      buy.disabled = st.own >= EX_SHARES || S.coins < exBuyPrice(id); sell.disabled = !st.own;
      buy.textContent = 'Buy ' + (exQty >= 1000 ? 'max' : '×' + exQty); sell.textContent = 'Sell ' + (exQty >= 1000 ? 'all' : '×' + exQty);
      const stamp = hs.length * 1e6 + (hs.length ? hs[hs.length - 1] : 0); if (stamp !== drawn) { drawn = stamp; exChart(cv, hs, d >= 0); }
    });
  }
};
