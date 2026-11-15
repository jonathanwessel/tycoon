'use strict';
/* =========================================================
   Interface
   ========================================================= */
const $ = id => document.getElementById(id);
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs || {}) { if (k === 'on') e.addEventListener('click', attrs.on); else if (k === 'cls') e.className = attrs.cls; else e.setAttribute(k, attrs[k]); }
  for (const k of kids) if (k != null) e.append(k);
  return e;
}
const ico = (name, alt) => h('img', { cls: 'px', src: iconURL(name), alt: alt || '' });
let ups = [], cardUps = [], rebuild = true, tab = 'defend', toastT = 0;
function say(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); toastT = Math.min(6, 2.5 + t.length / 30); }
/* A price shown as pictures. coins is a function so it stays live; goods is {item: qty}. */
function costEl(coins, goods, list) {
  const num = h('span'), cs = h('span', null, ico('coin', 'coins'), num), el = h('span', { cls: 'cost' }, cs), gs = [];
  for (const k in goods || {}) { const s = h('span', null, ico(k, ITEMS[k].n), '×' + goods[k]); gs.push([k, s]); el.append(s); }
  list.push(() => { const c = coins(); num.textContent = fmt(c); cs.classList.toggle('short', S.coins < c); for (const [k, s] of gs) s.classList.toggle('short', S.res[k] < goods[k]); });
  return el;
}
function recipe(s) {
  const r = h('span', { cls: 'recipe' });
  for (const k in s.in) for (let i = 0; i < s.in[k]; i++) r.append(ico(k, ITEMS[k].n));
  r.append(h('span', { cls: 'arrow' }, '→'), ico(s.out, ITEMS[s.out].n)); return r;
}
function buyRow(b, list) {
  const def = b.def, kind = b.kind, id = def.id, name = h('div', { cls: 'name' }), info = h('small'), lab = h('span'), msl = h('small');
  const btn = h('button', { cls: 'buy', on: () => buyBuilding(b) }, lab, ' ', costEl(() => buyPlan(b).c, null, list));
  const head = kind === 'shops' ? recipe(def) : h('span', { cls: 'recipe' }, ico(def.out, ITEMS[def.out].n));
  const prog = kind === 'shops' ? h('div', { cls: 'prog' }, h('i')) : null;
  // buy button on top; the run switch and foreman sit small underneath so the row never needs a line of its own
  const mini = h('div', { cls: 'mini' }), acts = h('div', { cls: 'acts' }, btn, mini);
  const row = h('div', { cls: 'row bld' }, ico(id, ''), h('div', { cls: 'grow' }, name, h('div', null, head, info), msl, prog), acts);
  let tog = null;
  if (kind === 'shops') { tog = h('button', { cls: 'small sw', on: () => { S.off[id] = !S.off[id]; } }); mini.append(tog); }
  const mgL = h('span'), mgC = costEl(() => mgrCost(id), null, list);
  const mg = h('button', { cls: 'small fm', on: () => { if (S.mgr[id]) S.mgr[id] = S.mgr[id] === 1 ? 2 : 1; else hire(id); } }, ico('foreman', ''), mgL, mgC);
  mini.append(mg);
  list.push(() => {
    const have = blv(id), p = buyPlan(b), mult = (kind === 'ext' ? prodMult() : craftMult()) * bMult(id), ms = MS(have);
    name.textContent = def.n; name.append(h('i', null, have ? 'Lv ' + have : '')); if (ms) name.append(h('em', null, '★'.repeat(Math.min(ms, 5)) + (ms > 5 ? '+' + (ms - 5) : '')));
    info.textContent = rate(Math.max(1, have) * def.rate * mult) + '/s' + (have ? '' : ' at level 1');
    msl.textContent = have ? 'Output ×2 at level ' + nextMs(have) + (S.mgr[id] === 1 ? ' · foreman working' : S.mgr[id] === 2 ? ' · foreman resting' : '') : '';
    lab.textContent = have ? '+' + p.n : 'Build'; btn.disabled = !p.ok;
    if (tog) { tog.hidden = !have; tog.textContent = S.off[id] ? 'Off' : 'On'; tog.classList.toggle('on', !S.off[id]); tog.title = S.off[id] ? 'Workshop paused. Tap to run it.' : 'Workshop running. Tap to pause it.'; tog.setAttribute('aria-label', tog.title); }
    mg.hidden = !(S.mgr[id] || have >= 1); mgL.textContent = S.mgr[id] ? (S.mgr[id] === 1 ? 'On' : 'Off') : ''; mgL.hidden = !S.mgr[id]; mgC.hidden = !!S.mgr[id];
    mg.title = S.mgr[id] ? (S.mgr[id] === 1 ? 'Foreman working. Tap to rest them.' : 'Foreman resting. Tap to put them to work.') : 'Hire a foreman for ' + fmt(mgrCost(id)) + ' coins'; mg.setAttribute('aria-label', mg.title);
    mg.classList.toggle('on', S.mgr[id] === 1); mg.disabled = !S.mgr[id] && S.coins < mgrCost(id);
    mini.hidden = (!tog || tog.hidden) && mg.hidden;
    if (prog) { const a = have ? ACT[id] || 0 : 0, fast = have * def.rate * mult > 2.5; prog.classList.toggle('idle', a < .08); prog.firstChild.style.width = (a < .08 ? 0 : fast ? 100 : (PHASE[id] || 0) * 100) + '%'; }
  });
  return row;
}
/* Powers the player triggers by hand */
const ABIL = {
  dyn: { n: 'Dynamite', icon: 'dynamite', cd: 40, d: 'Blows up the thickest knot of raiders.' },
  ot:  { n: 'Overtime', icon: 'bell', cd: 120, dur: 20, d: 'Every building works three times as fast for 20 seconds.' },
};
function useAbility(id) {
  if (S.cd[id] > 0) return say(ABIL[id].n + ' is ready in ' + Math.ceil(S.cd[id]) + 's.');
  if (id === 'dyn') {
    let best = null, bv = 0;
    for (const f of foes) { let v = 0; for (const o of foes) if (Math.hypot(o.x - f.x, o.y - f.y) < 1.6) v += o.hp; if (v > bv) { bv = v; best = f; } }
    if (!best) return say('No raiders on the road to blow up.');
    bombs.push({ x: best.x, y: best.y, t: .7, f: best }); S.cd.dyn = ABIL.dyn.cd; snd('fuse', 900, .5, 'sawtooth', .02, -600);
  } else {
    S.ot = ABIL.ot.dur; S.cd.ot = ABIL.ot.cd; say('Overtime! Every building works three times as fast for 20 seconds.'); snd('bell', 880, .5, 'triangle', .07, -200);
    for (const b of BUILD) if (blv(b.def.id)) FXS.gold[b.def.id] = .8;
  }
}
const TOWER_TIPS = 'Tap an empty plot beside the road to build. Tap a tower to upgrade it or change its aim.';
function card() {
  const box = $('card'); box.hidden = !sel; if (!sel) { box._k = box._e = null; return; }
  const key = sel.t ? 't' + S.towers.indexOf(sel.t) + '/' + sel.t.lvl + sel.t.br : sel.b ? 'b' + sel.b.def.id : sel.vault ? 'v' : 'p' + sel.plot.join(',');
  if (box._k !== key) {
    const ent = key.split('/')[0], opening = !box._k, other = box._e !== ent;
    box._k = key; box._e = ent; box.textContent = ''; cardUps = []; $('sheet').scrollTop = 0;
    if (other && box.animate && !REDUCED) box.animate(opening ? [{ opacity: 0, transform: 'translateY(-10px) scale(.97)' }, { opacity: 1, transform: 'none' }] : [{ opacity: .3 }, { opacity: 1 }], { duration: opening ? 280 : 160, easing: 'cubic-bezier(.2,.9,.3,1.15)' });
    const close = h('button', { cls: 'small x', 'aria-label': 'Close', on: () => { sel = null; } }, '✕');
    if (sel.vault) {
      S.stats.vaultSeen = 1;
      const info = h('small'), bar = h('i'), note = h('small'), one = h('button', { cls: 'grow1', on: () => repair(1) }, 'Repair +1 ', costEl(() => repairCost(), null, cardUps));
      const full = h('button', { cls: 'primary grow1', on: () => repair(vaultMax() - S.vaultHp) }, 'Repair to full ', costEl(() => repairCost() * Math.max(1, vaultMax() - S.vaultHp), null, cardUps));
      box.append(h('div', { cls: 'cardhead' }, ico('vault'), h('div', { cls: 'grow' }, h('div', { cls: 'name' }, 'The vault'), info), close),
        h('div', { cls: 'prog vbar' }, bar), note, h('div', { cls: 'bar' }, one, full));
      cardUps.push(() => {
        const hp = Math.max(0, S.vaultHp), mx = vaultMax(), miss = mx - hp;
        info.textContent = 'Strength ' + hp + ' / ' + mx + ' · heals ' + (1 + lv('mason')) + ' per cleared wave';
        bar.style.width = hp / mx * 100 + '%'; bar.style.background = hp / mx > .5 ? 'var(--good)' : hp / mx > .25 ? 'var(--gold)' : 'var(--bad)';
        note.textContent = W.active ? 'Raiders are on the road. Repair between waves.' : miss ? 'Each point costs ' + fmt(repairCost()) + ' coins. A raider that gets through takes 1 or 2 strength and 5% of your coins; a war wagon smashes the vault outright.' : 'The vault is at full strength.';
        one.disabled = W.active || !miss || S.coins < repairCost(); full.disabled = W.active || !miss || S.coins < repairCost() * miss;
      });
    } else if (sel.plot) {
      const [c, r] = sel.plot;
      box.append(h('div', { cls: 'cardhead' }, h('div', { cls: 'grow' }, h('div', { cls: 'name' }, 'Build a tower here'), h('small', null, 'Grey costs mean you are short of coins or goods.')), close));
      for (const id in TOWERS) {
        const d = TOWERS[id], b = h('button', { cls: 'buildopt', on: () => {
          if (!buildTower(id, c, r)) return;
          const t = S.towers[S.towers.length - 1]; t.born = .35; sel = { t }; snd('build', 330, .12, 'triangle', .05, 330);
          for (let i = 0; i < 12; i++) parts.push({ x: c + .5 + (Math.random() - .5) * .8, y: r + .8, vx: (Math.random() - .5) * 2.5, vy: -1 - Math.random() * 2, g: 6, t: .5, c: '#e9d2a8', s: .08 });
        } }, ico(id), h('span', { cls: 'grow' }, h('span', { cls: 'name' }, d.n), h('small', null, d.d)), costEl(() => buildCost(id), d.goods, cardUps));
        box.append(b); cardUps.push(() => { b.disabled = S.coins < buildCost(id) || !hasGoods(d.goods); });
      }
    } else if (sel.t) {
      const t = sel.t, d = TOWERS[t.type], back = Math.ceil(d.coins * .5), stats = h('small');
      const brName = t.br ? BRANCH[t.type][t.br].n : null;
      box.append(h('div', { cls: 'cardhead' }, ico(t.br ? t.type + '_' + t.br : t.type), h('div', { cls: 'grow' }, h('div', { cls: 'name' }, brName ? brName + ' ' + d.n.toLowerCase() : d.n, h('i', null, 'Lv ' + (t.lvl + 1))), stats), close));
      cardUps.push(() => { const st = towerStats(t); stats.textContent = rate(st.dmg) + ' damage · ' + rate(st.rate) + ' shots/s · reach ' + st.range.toFixed(1) + (t.jam > 0 ? ' · jammed ' + Math.ceil(t.jam) + 's' : ''); });
      const seg = h('div', { cls: 'seg' }, h('small', null, 'Aim at'));
      for (const [m, n] of [['first', 'First'], ['strong', 'Strongest'], ['weak', 'Weakest']]) { const b = h('button', { cls: 'small', on: () => { t.tg = m; } }, n); seg.append(b); cardUps.push(() => b.classList.toggle('on', (t.tg || 'first') === m)); }
      box.append(seg);
      const sellB = h('button', { cls: 'small', on: () => { S.coins += back; S.towers.splice(S.towers.indexOf(t), 1); sel = null; snd('sell', 500, .1, 'triangle', .04, -200); } }, 'Sell +' + fmt(back));
      if (needsBranch(t)) {
        const br = h('div', { cls: 'branches' });
        for (const k of ['a', 'b']) { const B = BRANCH[t.type][k], b = h('button', { on: () => branchTower(t, k) }, h('span', { cls: 'name' }, B.n), h('small', null, B.d), costEl(() => branchCost(t), null, cardUps)); br.append(b); cardUps.push(() => { b.disabled = S.coins < branchCost(t); }); }
        box.append(h('small', null, 'Level 5: pick a path for this tower.'), br, h('div', { cls: 'bar' }, sellB));
      } else {
        const up = h('button', { cls: 'primary grow1', on: () => upgradeTower(t) }, 'Upgrade ', costEl(() => upCost(t), null, cardUps));
        cardUps.push(() => { up.disabled = S.coins < upCost(t); });
        box.append(h('div', { cls: 'bar' }, up, sellB));
      }
    } else {
      box.append(h('div', { cls: 'cardhead' }, h('div', { cls: 'grow' }, h('div', { cls: 'name' }, sel.b.def.n)), close), buyRow(sel.b, cardUps));
    }
  }
  for (const f of cardUps) f();
}
/* Map taps */
function gridAt(ev) { const r = cv.getBoundingClientRect(), bw = cv.clientLeft, bt = cv.clientTop; return [(ev.clientX - r.left - bw) / (cv.clientWidth || r.width) * COLS, (ev.clientY - r.top - bt) / (cv.clientHeight || r.height) * ROWS]; }
function slotAt(gx, gy) { if (gy >= YARD) return null; const sx = Math.floor(gx / 2) * 2, sy = Math.floor(gy / 2) * 2; return Object.keys(SLOT).find(k => SLOT[k][0] === sx && SLOT[k][1] === sy); }
let holdT = null;
const stopHold = () => { clearInterval(holdT); holdT = null; };
cv.addEventListener('pointerdown', ev => {
  const [gx, gy] = gridAt(ev), id = slotAt(gx, gy);
  if (id !== 'trees' && id !== 'rocks') return;
  const k = id === 'trees' ? 'wood' : 'ore'; gather(k); stopHold(); holdT = setInterval(() => gather(k), 170);
});
for (const e of ['pointerup', 'pointercancel', 'pointerleave']) cv.addEventListener(e, stopHold);
cv.addEventListener('contextmenu', e => e.preventDefault());
function goTab(id) { tab = id; rebuild = true; $('sheet').scrollTop = 0; refresh(); }
function toggleAuto() {
  S.autoWave = !S.autoWave;
  if (S.autoWave) { W.countdown = Math.max(W.countdown, 10); say('Waves come on their own again.'); }
  else say('Waves on hold. Raiders only come when you call them.');
  refresh();
}
cv.addEventListener('click', ev => {
  const [gx, gy] = gridAt(ev);
  if (gy < YARD) {
    const id = slotAt(gx, gy);
    if (id === 'trees' || id === 'rocks') return;
    if (id === 'market' || id === 'caravan') { sel = null; return goTab('market'); }
    if (id === 'office') { sel = null; return goTab('charter'); }
    if (id === 'hall') { sel = null; goTab('works'); return say('Hire a foreman for any building with the foreman button next to it. They keep upgrading it for you. Each foreman after the first two costs more.'); }
    const b = BY_ID[id]; if (b) sel = sel && sel.b === b ? null : { b }; return;
  }
  const c = Math.floor(gx), rw = Math.floor(gy), t = S.towers.find(t => t.c === c && t.r === rw);
  if (t) { sel = sel && sel.t === t ? null : { t }; return; }
  if (c === VAULT[0] && rw === VAULT[1]) { sel = sel && sel.vault ? null : { vault: 1 }; return; }
  if (onRoad(c, rw)) { sel = null; return say('Towers go beside the road, not on it.'); }
  sel = sel && sel.plot && sel.plot[0] === c && sel.plot[1] === rw ? null : { plot: [c, rw] };
});
cv.addEventListener('click', () => refresh()); // show the card at once instead of on the next UI tick
let hov = null;
cv.addEventListener('pointermove', ev => { if (ev.pointerType === 'mouse') hov = gridAt(ev); });
cv.addEventListener('pointerleave', () => { hov = null; });

function spark(canvas, k) {
  const g = canvas.getContext('2d'), w = canvas.width, hh = canvas.height, d = HIST[k] || [];
  const yy = v => hh - 2 - (v - .3) / .7 * (hh - 4);
  g.clearRect(0, 0, w, hh); g.fillStyle = 'rgba(157,163,189,.35)'; g.fillRect(0, yy(1), w, 1);
  if (d.length < 2) return;
  g.beginPath(); d.forEach((v, i) => { const x = i / 44 * w; i ? g.lineTo(x, yy(v)) : g.moveTo(x, yy(v)); });
  g.lineTo((d.length - 1) / 44 * w, hh); g.lineTo(0, hh); g.closePath(); g.fillStyle = 'rgba(227,141,78,.25)'; g.fill();
  g.beginPath(); d.forEach((v, i) => { const x = i / 44 * w; i ? g.lineTo(x, yy(v)) : g.moveTo(x, yy(v)); }); g.strokeStyle = '#e38d4e'; g.lineWidth = 2; g.stroke();
  const lx = (d.length - 1) / 44 * w, ly = yy(d[d.length - 1]); g.fillStyle = '#ece6d8'; g.beginPath(); g.arc(lx, ly, 2.5, 0, 7); g.fill();
}
const FOE_TIPS = {
  raider: 'Plain gunmen.', runner: 'Fast riders.', brute: 'Slow and tough. Takes 2 off the vault.',
  shield: 'Blocks four hits. Cannons smash the shield in one.', sapper: 'Jams a tower it walks past unless it dies quickly.',
  healer: 'Mends raiders around it. Kill it first.', thief: 'Steals goods instead of hitting the vault.', boss: 'Every tenth wave. If it reaches the vault, the vault falls however strong it is: destroy it to move on.',
};
const PANELS = {
  defend(p) {
    const gt = h('span'), gn = h('small'), bar = h('i'), claim = h('button', { cls: 'small', on: claimGoal }, 'Claim'), swap = h('button', { cls: 'small', on: () => { S.gq = null; } }, 'Swap');
    const goal = h('div', { cls: 'goal' }, ico('star'), h('div', { cls: 'grow' }, h('div', { cls: 'gt' }, gt, gn), h('div', { cls: 'prog' }, bar)), h('div', { cls: 'bar' }, swap, claim));
    p.append(goal);
    ups.push(() => {
      const g = goalNow(), done = g.cur >= g.need;
      gt.textContent = g.t; gn.textContent = (g.need > 1 ? fmt(g.cur) + ' / ' + fmt(g.need) + ' · ' : '') + 'reward ' + fmt(g.r) + ' coins';
      bar.style.width = Math.min(100, g.cur / g.need * 100) + '%'; goal.classList.toggle('done', done);
      claim.disabled = !done; claim.classList.toggle('primary', done); swap.hidden = !g.gen || done;
    });
    const nxT = h('h2'), nx = h('div', { cls: 'next' }), wxl = h('div', { cls: 'wxline' }); let sig = null;
    const bw = h('div', { cls: 'wxline warn' }, ico('boss', ''), h('span', null, h('b', null, 'War wagon wave. '), 'If the wagon reaches the vault, the vault falls however strong it is. Destroy it to move on.'));
    p.append(nxT, nx, bw, wxl);
    ups.push(() => {
      bw.hidden = S.wave % 10 !== 0;
      const q = W.active ? W.queue : W.next || [], wk = W.active ? W.weather : W.nweather, s = (W.active ? 'a' : 'n') + S.wave + ':' + q.length + W.ntype + wk;
      nxT.textContent = W.active ? 'Still to come' : 'Next: ' + (S.wave % 10 === 0 ? 'war wagon' : WTYPES[W.ntype].n.toLowerCase());
      if (s === sig) return; sig = s; nx.textContent = ''; const n = {}; for (const t of q) n[t] = (n[t] || 0) + 1;
      for (const t in FOES) if (n[t]) nx.append(h('span', { title: FOES[t].n }, ico(t, FOES[t].n), '×' + n[t]));
      if (!q.length) nx.append(h('small', null, 'The road is clear.'));
      wxl.textContent = ''; wxl.hidden = !wk;
      if (wk) wxl.append(ico(WEATHER[wk].icon, ''), h('span', null, h('b', null, WEATHER[wk].n + (W.active ? ' now' : ' coming') + '. '), WEATHER[wk].d));
    });
    p.append(h('h2', null, 'Powers'));
    for (const id in ABIL) {
      const A = ABIL[id], b = h('button', { cls: 'small', on: () => useAbility(id) }, 'Use');
      p.append(h('div', { cls: 'row' }, ico(A.icon), h('div', { cls: 'grow' }, h('div', { cls: 'name' }, A.n), h('small', null, A.d + ' Recharges in ' + A.cd + 's.')), h('div', { cls: 'acts' }, b)));
      ups.push(() => { b.disabled = S.cd[id] > 0; b.textContent = S.cd[id] > 0 ? Math.ceil(S.cd[id]) + 's' : 'Use'; });
    }
    p.append(h('h2', null, 'Towers'), h('p', null, TOWER_TIPS));
    for (const id in TOWERS) {
      const d = TOWERS[id];
      p.append(h('div', { cls: 'row' }, ico(id), h('div', { cls: 'grow' }, h('div', { cls: 'name' }, d.n), h('small', null, d.d + ' Paths at level 5: ' + BRANCH[id].a.n + ' or ' + BRANCH[id].b.n + '.')), costEl(() => buildCost(id), d.goods, ups)));
    }
    p.append(h('h2', null, 'Raiders seen so far'));
    for (const k in FOES) if (k === 'boss' ? S.best >= 10 : S.best >= UNLOCK[k]) p.append(h('div', { cls: 'row' }, ico(k), h('div', { cls: 'grow' }, h('div', { cls: 'name' }, FOES[k].n), h('small', null, FOE_TIPS[k]))));
    p.append(h('p', null, 'Settings are at the bottom of the Charter tab.'));
  },
  works(p) {
    const chopN = h('span'), digN = h('span');
    ups.push(() => { chopN.textContent = 'Chop +' + fmt(tapYield()); digN.textContent = 'Dig +' + fmt(tapYield()); });
    const modes = h('div', { cls: 'seg' }, h('small', null, 'Buy'));
    for (const m of [1, 10, 'ms', 'max']) { const b = h('button', { cls: 'small', on: () => { buyMode = m; } }, m === 'max' ? 'Max' : m === 'ms' ? 'To next ★' : '×' + m); modes.append(b); ups.push(() => b.classList.toggle('on', buyMode === m)); }
    p.append(h('div', { cls: 'taps' }, h('button', { on: () => gather('wood') }, ico('wood'), chopN), h('button', { on: () => gather('ore') }, ico('ore'), digN)),
      h('p', null, 'Hold the trees or rocks on the map to keep gathering. Every building doubles its output at levels 10, 25, 50 and each 100.'), modes);
    // foreman budget: their share of income, and a reserve they never touch
    const fbInfo = h('small'), fbBox = h('div', { cls: 'panelin' }, h('div', { cls: 'name' }, 'Foremen'), fbInfo);
    const fseg = (label, opts, key) => { const s = h('div', { cls: 'seg' }, h('small', null, label)); for (const [v, n] of opts) { const b = h('button', { cls: 'small', on: () => { S.fb[key] = v; refresh(); } }, n); s.append(b); ups.push(() => b.classList.toggle('on', S.fb[key] === v)); } fbBox.append(s); };
    fseg('Pay them', [[.25, '25%'], [.5, '50%'], [.75, '75%'], [1, 'All']], 'share');
    fseg('Keep', [[0, 'No reserve'], [1, '1 min'], [5, '5 min']], 'keep');
    p.append(fbBox, h('h2', null, 'Gathering'));
    ups.push(() => {
      const n = Object.keys(S.mgr).filter(id => S.mgr[id] === 1).length;
      fbInfo.textContent = n ? n + ' at work. They get ' + pct(S.fb.share) + ' of what you earn and save up for the upgrade that pays back fastest' + (S.fb.goal && BY_ID[S.fb.goal] ? ' (now: ' + BY_ID[S.fb.goal].def.n + ' level ' + (blv(S.fb.goal) + 1) + ', ' + fmt(bCost(BY_ID[S.fb.goal], blv(S.fb.goal))) + ')' : '') + '. Purse: ' + fmt(S.fb.purse || 0) + (S.fb.keep ? '. They never take you below ' + S.fb.keep + ' minute' + (S.fb.keep > 1 ? 's' : '') + ' of income.' : '.')
        : 'Hire a foreman with the button next to any building. They get a share of what you earn and keep upgrading for you.';
    });
    for (const b of BUILD) { if (b.def === SHOPS[0]) p.append(h('h2', null, 'Workshops')); p.append(buyRow(b, ups)); }
  },
  market(p) {
    const thr = h('button', { cls: 'small', on: () => { const o = [0, .6, .8, 1]; S.sellAbove = o[(o.indexOf(S.sellAbove) + 1) % o.length]; } });
    p.append(h('h2', null, 'Caravan contracts'), h('p', null, 'Caravans pay two and a half times the full price, whatever the market is doing.'));
    S.contracts.forEach((c, i) => {
      const info = h('small'), pay = h('span'), go = h('button', { cls: 'primary', on: () => deliver(i) }, 'Deliver ', h('span', { cls: 'cost' }, h('span', null, ico('coin', 'coins'), pay)));
      const skip = h('button', { cls: 'small', on: () => { S.contracts[i] = newContract(); rebuild = true; } }, 'Swap');
      p.append(h('div', { cls: 'row' }, ico(c.k), h('div', { cls: 'grow' }, h('div', { cls: 'name' }, fmt(c.qty) + ' ' + ITEMS[c.k].n.toLowerCase()), info), h('div', { cls: 'acts' }, skip, go)));
      ups.push(() => { info.textContent = 'You have ' + fmt(S.res[c.k]); pay.textContent = fmt(contractPay(c)); go.disabled = S.res[c.k] < c.qty; });
    });
    // selling strategy: the two sensible auto-sell setups, with what each earns here
    const sAll = h('b'), sTop = h('b'), sNow = h('small');
    const setAuto = top => { const used = {}; for (const s of SHOPS) if (blv(s.id)) for (const k in s.in) used[k] = 1; for (const k in ITEMS) if (S.seen[k]) S.auto[k] = top ? !used[k] : true; refresh(); say(top ? 'Auto-selling only goods no workshop needs.' : 'Auto-selling every surplus good.'); };
    const bAll = h('button', { cls: 'small', on: () => setAuto(false) }, 'Sell all surplus'), bTop = h('button', { cls: 'small', on: () => setAuto(true) }, 'Top products only');
    p.append(h('h2', null, 'Selling strategy'), h('div', { cls: 'strat' }, h('div', null, h('span', null, 'Every surplus good sold'), sAll), h('div', null, h('span', null, 'Only goods no workshop needs'), sTop)), sNow, h('div', { cls: 'bar' }, bAll, bTop));
    ups.push(() => {
      const a = steadyIncome(null), t = steadyIncome(null, 'top'); sAll.textContent = '+' + rate(a) + '/s'; sTop.textContent = '+' + rate(t) + '/s';
      bAll.disabled = bTop.disabled = !lv('ledger');
      sNow.textContent = !lv('ledger') ? 'Research the Trading Ledger to sell automatically.' : a > t * 1.02 ? 'Selling every surplus earns more: workshops take what they need first and 20 of each good are kept back, so nothing starves. Set "only above 80% price" below so dumping does not crash prices.' : 'Both earn the same here.';
    });
    p.append(h('h2', null, 'Sell goods'), h('p', null, 'Selling a lot at once pushes the price down. Prices recover over a minute or two.'));
    for (const k in ITEMS) {
      if (!S.seen[k]) continue;
      const info = h('small'), val = h('span'), sc = h('canvas', { cls: 'spark', width: 128, height: 48, 'aria-hidden': 'true' });
      const sellB = h('button', { on: () => { const n = Math.floor(S.res[k]); if (!n) return; sell(k, n); for (let i = 0; i < 3; i++) setTimeout(() => fly('coin', 11, 1, $('hCoinWrap')), i * 90); snd('coin', 880, .08, 'square', .04, 440); } }, 'Sell ', h('span', { cls: 'cost' }, h('span', null, ico('coin', 'coins'), val)));
      const auto = h('button', { cls: 'small', on: () => { S.auto[k] = !S.auto[k]; } }, 'Auto');
      p.append(h('div', { cls: 'row' }, ico(k), h('div', { cls: 'grow' }, h('div', { cls: 'name' }, ITEMS[k].n), info), sc, h('div', { cls: 'acts' }, auto, sellB)));
      ups.push(() => {
        const n = Math.floor(S.res[k]), d = dem(k); info.textContent = fmt(n) + ' in stock · ' + rate(price(k)) + ' each · price ' + pct(d);
        info.style.color = d < .6 ? 'var(--bad)' : d > .95 ? '' : 'var(--gold)';
        val.textContent = fmt(sellValue(k, n)); sellB.disabled = n < 1; auto.hidden = !lv('ledger'); auto.classList.toggle('on', !!S.auto[k]); spark(sc, k);
      });
    }
    const note = h('p'); p.append(note, h('div', { cls: 'bar' }, thr));
    ups.push(() => {
      thr.hidden = !lv('ledger'); thr.textContent = S.sellAbove ? 'Auto-sell only above ' + pct(S.sellAbove) + ' price' : 'Auto-sell at any price';
      note.textContent = lv('ledger') ? 'Auto-sell keeps ' + KEEP + ' of each good back for towers and contracts.' : 'Research the Trading Ledger to sell goods automatically.';
    });
  },
  research(p) {
    p.append(h('h2', null, 'Research'));
    for (const r of RESEARCH) {
      const cost = () => Math.ceil(r.cost * Math.pow(r.g, lv(r.id)));
      const name = h('div', { cls: 'name' }), ce = costEl(cost, null, ups), done = h('span', null, 'Done'), btn = h('button', { on: () => { const c = cost(); if (S.coins < c || lv(r.id) >= r.max) return; S.coins -= c; S.research[r.id] = lv(r.id) + 1; if (r.id === 'vault') S.vaultHp += 5; snd('build', 500, .15, 'triangle', .05, 500); } }, ce, done);
      p.append(h('div', { cls: 'row' }, h('div', { cls: 'grow' }, name, h('small', null, r.d)), h('div', { cls: 'acts' }, btn)));
      ups.push(() => { const l = lv(r.id), fin = l >= r.max; name.textContent = r.n; if (r.max > 1) name.append(h('i', null, l ? 'Lv ' + l : '')); ce.hidden = fin; done.hidden = !fin; btn.disabled = fin || S.coins < cost(); });
    }
  },
  charter(p) {
    const held = h('b'), freeL = h('small'), offer = h('p'), signs = h('div', { cls: 'bar' });
    p.append(h('h2', null, 'Deeds'), h('div', { cls: 'deeds' }, held, freeL),
      h('p', null, 'Every deed you hold adds 20% to gathering, workshop speed and tower damage for good. Spend deeds on perks below; spending does not lose the bonus.'),
      h('h2', null, 'New charter'), h('p', null, 'Sell the gulch and start a new one. You lose coins, stock, buildings, research and towers. You keep deeds, perks and goals.'), offer, signs);
    for (const id in MAPS) {
      const M = MAPS[id], b = h('button', { cls: 'primary', on: () => prestige(id) }, 'Sign for ' + M.n);
      signs.append(b); ups.push(() => { b.disabled = !deedsOnOffer(); b.hidden = id === 'bridge' ? !S.maps.bridge : id !== 'gulch' && !S.maps[id] && !deedsOnOffer(); });
    }
    ups.push(() => {
      held.textContent = S.deeds; freeL.textContent = freeDeeds() + ' to spend';
      const g = deedsOnOffer();
      offer.innerHTML = g ? 'Signing now earns <strong>' + g + ' deed' + (g > 1 ? 's' : '') + '</strong>' + (MAP.deed ? ', including the ' + MAP.n + ' bonus' : '') + '. Forked Canyon has two roads; raiders there pay 50% more and each charter signed there earns an extra deed.'
          + (S.maps.bridge ? ' Trestle Bridge crosses a ravine: raiders on its bridges take 25% more damage, pay double, and charters there earn two extra deeds.' : ' Sign a charter on Forked Canyon to open a third map.')
        : 'Reach <strong>wave 35</strong> to earn your first deed. Best so far: wave ' + S.best + '. You are on ' + MAP.n + '.';
    });
    p.append(h('h2', null, 'Perks'));
    for (const pk of PERKS) {
      const name = h('div', { cls: 'name' }), d = h('small', null, pk.d), lab = h('span'), b = h('button', { on: () => buyPerk(pk.id) }, lab);
      p.append(h('div', { cls: 'row' }, ico('star'), h('div', { cls: 'grow' }, name, d), h('div', { cls: 'acts' }, b)));
      ups.push(() => {
        const l = perk(pk.id), locked = pk.req && !perk(pk.req), fin = l >= pk.max;
        name.textContent = pk.n; name.append(h('i', null, l ? 'Rank ' + l + '/' + pk.max : ''));
        lab.textContent = fin ? 'Done' : locked ? 'Needs ' + PERKS.find(q => q.id === pk.req).n : 'Buy · ' + pk.cost(l) + ' deed' + (pk.cost(l) > 1 ? 's' : '');
        b.disabled = fin || locked || freeDeeds() < pk.cost(l);
      });
    }
    // badges and lifetime records
    const got = h('small'); p.append(h('h2', null, 'Badges ', got));
    const grid = h('div', { cls: 'badges' }); p.append(grid);
    for (const b of BADGES) { const tile = h('div', { cls: 'badge', title: b.d }, ico(b.icon, ''), h('b', null, b.n), h('small', null, b.d)); grid.append(tile); ups.push(() => tile.classList.toggle('got', !!S.badges[b.id])); }
    ups.push(() => { got.textContent = Object.keys(S.badges).length + ' of ' + BADGES.length; });
    const recs = h('div', { cls: 'records' }); p.append(h('h2', null, 'Records'), recs);
    const hm = s => { s = Math.floor(s); const hh = Math.floor(s / 3600), mm = Math.floor(s / 60) % 60; return hh ? hh + 'h ' + mm + 'm' : mm + 'm'; };
    for (const [n, f] of [['Coins per second now', () => '+' + rate(liveIncome())], ['Potential coins per second (all surplus sold)', () => '+' + rate(steadyIncome())], ['Best coins per second', () => '+' + rate(S.bestRate || 0)], ['Coins earned', () => fmt(S.stats.coins)], ['Raiders defeated', () => fmt(S.stats.kills)], ['War wagons destroyed', () => fmt(S.stats.bosses)],
      ['Waves with no leaks', () => fmt(S.stats.flawless)], ['Goods made', () => fmt(S.stats.made)], ['Contracts filled', () => fmt(S.stats.contracts)],
      ['Charters signed', () => S.charters], ...Object.keys(MAPS).map(id => ['Best wave · ' + MAPS[id].n, () => S.bestMap[id] ? S.bestMap[id] : '—']), ['Time played', () => hm(S.stats.played)]]) {
      const v = h('b'); recs.append(h('div', null, h('span', null, n), v)); ups.push(() => { v.textContent = f(); });
    }
    // settings live in their own panel (gear button on the map)
    p.append(h('h2', null, 'Settings'), h('div', { cls: 'bar' }, h('button', { on: () => openSettings('gfx') }, 'Graphics'), h('button', { on: () => openSettings('sound') }, 'Sound'), h('button', { on: () => openSettings('game') }, 'Game')));
    const ta = h('textarea', { id: 'saveBox', 'aria-label': 'Save code', placeholder: 'Save code appears here. Paste one to load it.' });
    let armed = false; const wipe = h('button', { cls: 'danger small', on: () => { if (!armed) { armed = true; wipe.textContent = 'Tap again to erase everything'; return; } S = fresh(); setMap(S.map); bakeGround(); wipeField(); save(); say('Started over.'); } }, 'Erase save');
    p.append(h('h2', null, 'Save'), h('p', null, 'The game saves in this browser every few seconds and keeps working for up to 8 hours while you are away. Copy a save code to move to another device.'), ta,
      h('div', { cls: 'bar' },
        h('button', { cls: 'small', on: () => { save(); ta.value = btoa(unescape(encodeURIComponent(JSON.stringify(S)))); ta.select(); say('Save code ready. Copy it from the box.'); } }, 'Make save code'),
        h('button', { cls: 'small', on: () => { try { if (!adopt(JSON.parse(decodeURIComponent(escape(atob(ta.value.trim())))))) throw 0; bakeGround(); wipeField(); W.countdown = 15; save(); say('Save loaded.'); } catch (e) { say('That save code is not valid. Paste the whole code and try again.'); } } }, 'Load save code'),
        h('button', { cls: 'small', on: saveFile }, 'Save to file'), h('button', { cls: 'small', on: loadFile }, 'Load from file'), wipe));
    // the app: install, storage protection, version
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !APP.installed;
    const appNote = h('p'), inst = h('button', { cls: 'primary', on: installApp }, 'Install Copper Gulch'), ver = h('p');
    const chk = h('button', { cls: 'small', on: () => checkUpdates(true) }, 'Check for updates');
    p.append(h('h2', null, 'App'), appNote, h('div', { cls: 'bar' }, inst, chk), ver, h('p', null, 'No ads. No purchases. Nothing leaves this page.'));
    ups.push(() => { ver.textContent = 'Version ' + GAME_VERSION + (APP.status ? ' · ' + APP.status : '') + (GAME_NEWS ? ' What is new: ' + GAME_NEWS : ''); chk.hidden = !APP.reg; });
    ups.push(() => {
      inst.hidden = !APP.prompt;
      appNote.textContent = (APP.installed ? 'Installed as an app. ' : APP.prompt ? 'Install it to play full screen from your home screen, even offline. ' : ios ? 'To install on iPhone or iPad: tap Share, then Add to Home Screen. ' : 'To install, open your browser menu and choose Install app or Add to Home screen. ')
        + (APP.persisted === true ? 'Your save is protected: the browser will not clear it to free up space.' : APP.persisted === false ? 'The browser may clear saves if the device runs low on space, so keep a save file now and then.' : '')
        + ' New versions download by themselves; you will see "Update ready" when one arrives.';
    });
  },
};
const TABS = [['defend', 'Defend', 'crossbow'], ['works', 'Works', 'camp'], ['market', 'Market', 'market'], ['research', 'Research', 'flask'], ['charter', 'Charter', 'office']];
const fixedUps = [];
function buildFixed() {
  $('hCoinIcon').src = iconURL('coin'); $('hWaveIcon').src = iconURL('raider'); $('hVaultIcon').src = iconURL('vault'); $('hDeedIcon').src = iconURL('star');
  const tabs = $('tabs'), dots = {};
  for (const [id, n, icon] of TABS) {
    dots[id] = h('i', { cls: 'dot', hidden: '' });
    const b = h('button', { role: 'tab', id: 'tab-' + id, 'aria-controls': 'panel', on: () => goTab(id) }, ico(icon), h('span', null, n), dots[id]); tabs.append(b);
    fixedUps.push(() => b.setAttribute('aria-selected', String(tab === id)));
  }
  $('bWave').addEventListener('click', startWave);
  $('bPause').addEventListener('click', () => setPaused(true));
  $('bFull').addEventListener('click', () => setMapFull(!document.body.classList.contains('mapfull')));
  $('bSet').addEventListener('click', () => openSettings());
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && FULL.asked) { FULL.asked = false; setMapFull(false); } });
  $('pauseCover').addEventListener('click', () => setPaused(false));
  document.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('textarea, input')) return;
    const md = $('modal'); if (e.key === 'Escape' && !md.hidden && md.classList.contains('sheetm')) { md.hidden = true; md.className = 'modal'; md.onclick = null; save(); return; }
    if (e.key === 'p' || e.key === 'P' || (e.key === 'Escape' && paused)) { e.preventDefault(); setPaused(!paused); }
    else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); setMapFull(!document.body.classList.contains('mapfull')); }
    else if (e.key === 'Escape' && document.body.classList.contains('mapfull')) setMapFull(false);
  });
  const hold = $('bHold'); hold.addEventListener('click', toggleAuto);
  const hv = $('hVaultWrap'), openVault = () => { sel = { vault: 1 }; $('sheet').scrollTop = 0; refresh(); };
  hv.addEventListener('click', openVault); hv.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openVault(); } });
  fixedUps.push(() => hv.classList.toggle('low', S.vaultHp < vaultMax() / 2));
  fixedUps.push(() => { hold.classList.toggle('held', !S.autoWave); hold.setAttribute('aria-pressed', String(!S.autoWave)); hold.lastChild.textContent = S.autoWave ? 'Hold' : 'Held'; });
  // speed: tap cycles 1×/2×/3×; hold (or right-click) opens a menu that also offers pause
  const spB = $('bSpeed'); let lpT = null, lpFired = false;
  const menu = h('div', { cls: 'speedmenu', role: 'menu', hidden: '' });
  for (const [v, n] of [[1, '1×'], [2, '2×'], [3, '3×'], [0, 'Pause']]) menu.append(h('button', { cls: 'small', role: 'menuitem', on: e => { e.stopPropagation(); menu.hidden = true; if (v) { S.speed = v; setPaused(false); } else setPaused(true); refresh(); } }, n));
  spB.parentNode.append(menu);
  const openMenu = () => { menu.hidden = false; menu.firstChild.focus(); };
  spB.addEventListener('pointerdown', () => { lpFired = false; clearTimeout(lpT); lpT = setTimeout(() => { lpFired = true; openMenu(); }, 450); });
  for (const e of ['pointerup', 'pointerleave', 'pointercancel']) spB.addEventListener(e, () => clearTimeout(lpT));
  spB.addEventListener('contextmenu', e => { e.preventDefault(); openMenu(); });
  spB.addEventListener('click', () => { if (lpFired) { lpFired = false; return; } S.speed = S.speed % 3 + 1; });
  document.addEventListener('pointerdown', e => { if (!menu.hidden && !menu.contains(e.target) && e.target !== spB) menu.hidden = true; });
  spB.title = 'Game speed. Hold for more.';
  for (const id in ABIL) {
    const b = $('ab-' + id), A = ABIL[id], shade = h('i', { cls: 'cd' }), num = h('b', { cls: 'cdn' });
    b.append(ico(A.icon, A.n), shade, num); b.setAttribute('aria-label', A.n + ': ' + A.d); b.addEventListener('click', () => useAbility(id));
    fixedUps.push(() => { const f = Math.max(0, S.cd[id]) / A.cd; shade.style.transform = 'scaleY(' + f + ')'; num.textContent = S.cd[id] > 0 ? Math.ceil(S.cd[id]) : ''; b.classList.toggle('ready', !(S.cd[id] > 0)); b.classList.toggle('active', id === 'ot' && S.ot > 0); });
  }
  fixedUps.push(() => {
    $('hWave').textContent = S.wave; $('hVault').textContent = Math.max(0, S.vaultHp); $('hVault').append(h('span', { cls: 'mx' }, '/' + vaultMax()));
    $('hDeedsWrap').hidden = !S.deeds; $('hDeeds').textContent = S.deeds;
    const bw = $('bWave'); bw.disabled = W.active;
    bw.textContent = W.active ? 'Wave ' + S.wave + ' · ' + (W.queue.length + foes.length) + ' left' : 'Call wave ' + S.wave + (S.autoWave ? ' · ' + Math.ceil(W.countdown) + 's' : ' · held');
    bw.classList.toggle('live', W.active); bw.classList.toggle('held', !W.active && !S.autoWave); bw.classList.toggle('soon', !W.active && S.autoWave && W.countdown <= 5);
    $('bSpeed').textContent = S.speed + '×'; $('bSpeed').setAttribute('aria-label', 'Game speed ' + S.speed + ' times');
    const g = goalNow(); dots.defend.hidden = g.cur < g.need;
    dots.market.hidden = !S.contracts.some(c => S.res[c.k] >= c.qty);
    dots.charter.hidden = !(deedsOnOffer() || freeDeeds() > 0 && PERKS.some(p => perk(p.id) < p.max && !(p.req && !perk(p.req)) && freeDeeds() >= p.cost(perk(p.id))));
  });
}
function buildDynamic() {
  ups = []; rebuild = false;
  while (S.contracts.length < 3) S.contracts.push(newContract());
  const st = $('stock'); st.textContent = '';
  // income first: what the town earns per second now, and what it would with every surplus sold
  { const v = h('div', { cls: 'v' }), r = h('div', { cls: 'r' }); st.append(h('div', { cls: 'chip income', title: 'Coins per second: earned over the last minute, and what this town makes with every surplus good sold at full price' }, ico('coin', 'Income'), h('div', null, v, r)));
    ups.push(() => { v.textContent = '+' + rate(liveIncome()) + '/s'; r.textContent = 'potential ' + rate(steadyIncome()) + '/s'; }); }
  for (const k in ITEMS) {
    if (!S.seen[k]) continue; const v = h('div', { cls: 'v' }), r = h('div', { cls: 'r' });
    CHIP[k] = h('div', { cls: 'chip', title: ITEMS[k].n }, ico(k, ITEMS[k].n), h('div', null, v, r)); st.append(CHIP[k]);
    ups.push(() => { v.textContent = fmt(S.res[k]); const x = RATE[k] || 0, show = Math.abs(x) >= .05; r.textContent = show ? (x > 0 ? '▲ ' : '▼ ') + rate(Math.abs(x)) + '/s' : ITEMS[k].n; r.className = 'r' + (show ? x > 0 ? ' up' : ' down' : ''); });
  }
  const p = $('panel'); p.textContent = ''; p.setAttribute('aria-labelledby', 'tab-' + tab); PANELS[tab](p);
  if (shownTab && shownTab !== tab && p.animate && !REDUCED) {
    const order = TABS.map(t => t[0]), dir = order.indexOf(tab) > order.indexOf(shownTab) ? 1 : -1;
    p.animate([{ opacity: 0, transform: 'translateX(' + dir * 28 + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
  shownTab = tab;
}
let shownTab = null;
function refresh() { checkBadges(); if (rebuild) buildDynamic(); for (const f of fixedUps) f(); for (const f of ups) f(); card(); }
/* Settings panel: slides up over the bottom of the screen (from the side on wide screens) so the map stays
   in view and every graphics change shows at once. */
let setTab = 'gfx', setUps = [];
function openSettings(t) {
  if (t) setTab = t;
  const m = $('modal'); m.textContent = ''; m.className = 'modal sheetm'; setUps = [];
  const close = () => { m.hidden = true; m.className = 'modal'; m.onclick = null; setUps = []; save(); };
  m.onclick = e => { if (e.target === m) close(); };
  const tabs = h('div', { cls: 'seg settabs', role: 'tablist' });
  for (const [k, n] of [['gfx', 'Graphics'], ['sound', 'Sound'], ['game', 'Game']]) { const b = h('button', { cls: 'small' + (setTab === k ? ' on' : ''), role: 'tab', 'aria-selected': String(setTab === k), on: () => openSettings(k) }, n); tabs.append(b); }
  const body = h('div', { cls: 'setbody' }), xb = h('button', { cls: 'small x', 'aria-label': 'Close settings', on: close }, '✕');
  m.append(h('div', { cls: 'box wide', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'setH' }, h('div', { cls: 'cardhead' }, h('h3', { id: 'setH', cls: 'grow' }, 'Settings'), xb), tabs, body));
  const run = () => { for (const f of setUps) f(); };
  const row = (label, hint, opts, get, put, off) => {
    const seg = h('div', { cls: 'seg' }), hn = h('small', null, hint || '');
    for (const [v, n] of opts) { const b = h('button', { cls: 'small', on: () => { put(v); run(); refresh(); } }, n); seg.append(b); setUps.push(() => { b.classList.toggle('on', get() === v); b.disabled = !!(off && off()); }); }
    body.append(h('div', { cls: 'row setrow' }, h('div', { cls: 'grow' }, h('div', { cls: 'name' }, label), hn), seg));
    return hn;
  };
  const litOff = () => !GX().light || !GLX.ok && GLX.tried;
  if (setTab === 'gfx') {
    const qh = row('Quality', '', [['low', 'Low'], ['med', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']], () => GX().preset, v => setGx('preset', v));
    setUps.push(() => { qh.textContent = GX().preset === 'custom' ? 'Custom mix. Pick a preset to reset the details below.' : { low: 'Fastest: no lighting, 30 fps, fewer effects.', med: 'Lighting with soft shadows at a lower resolution.', high: 'Full lighting, shadows and glow.', ultra: 'Sharper than your screen, long shadows, strong glow, every effect.' }[GX().preset]; });
    body.append(h('h2', null, 'Detail'));
    row('Lighting', 'Lights, shadows, glow and day-night. Off is fastest.', [[1, 'On'], [0, 'Off']], () => GX().light ? 1 : 0, v => setGx('light', v));
    row('Shadows', 'Cast by buildings, towers and raiders as the sun moves.', [[0, 'Off'], [1, 'Soft'], [2, 'Full'], [3, 'Long']], () => GX().shadow, v => setGx('shadow', v), litOff);
    row('Glow', 'Light bleeding from fires, lamps and blasts.', [[0, 'Off'], [1, 'Low'], [2, 'Normal'], [3, 'Strong']], () => GX().bloom, v => setGx('bloom', v), litOff);
    row('Resolution', 'Lower is faster and blockier; 150% is extra sharp.', [[.5, '50%'], [.75, '75%'], [1, '100%'], [1.5, '150%']], () => GX().res, v => setGx('res', v));
    row('Effects', 'Dust, sparks, smoke and debris.', [[0, 'Few'], [1, 'Some'], [2, 'Lots'], [3, 'Max']], () => GX().parts, v => setGx('parts', v));
    row('Weather effects', 'Rain, dust and heat haze. Weather still changes the fight when hidden.', [[1, 'Show'], [0, 'Hide']], () => GX().weather ? 1 : 0, v => setGx('weather', v));
    row('Screen shake', '', [[1, 'On'], [0, 'Off']], () => GX().shake ? 1 : 0, v => setGx('shake', v));
    row('Frame rate', '30 saves battery; the game itself runs the same.', [[60, 'Smooth 60'], [30, 'Battery 30']], () => GX().fps, v => setGx('fps', v));
    body.append(h('h2', null, 'Style'));
    row('Look', 'Colour grading for the whole map.', Object.keys(LOOKS).map(k => [k, LOOKS[k].n]), () => GX().look, v => setGx('look', v));
    row('Film grain', 'A fine moving grain, like old film. Needs lighting.', [[1, 'On'], [0, 'Off']], () => GX().grain ? 1 : 0, v => setGx('grain', v), litOff);
    row('Scanlines', 'Lines like an old arcade screen.', [[1, 'On'], [0, 'Off']], () => GX().scan ? 1 : 0, v => setGx('scan', v));
    row('Show frame rate', 'A small counter in the corner of the map.', [[1, 'On'], [0, 'Off']], () => GX().fpsShow ? 1 : 0, v => setGx('fpsShow', v));
    if (GLX.tried && !GLX.ok) body.append(h('p', null, 'This device cannot run the lighting engine, so lighting, shadows, glow and grain are off. Looks still apply.'));
  } else if (setTab === 'sound') {
    row('Sound', '', [[true, 'On'], [false, 'Off']], () => !!S.sound, v => { S.sound = v; snd('coin', 880, .08, 'square', .04, 440); });
    row('Volume', '', [[.25, 'Low'], [.6, 'Medium'], [1, 'High']], () => S.opt.vol, v => { S.opt.vol = v; S.sound = true; snd('coin', 880, .08, 'square', .04, 440); });
  } else {
    row('Waves', 'Held waves only come when you call them.', [[true, 'Come on their own'], [false, 'Held']], () => !!S.autoWave, v => { if (S.autoWave !== v) toggleAuto(); });
    row('Motion', 'Calm turns off sliding, shaking and pop-in.', [['auto', 'Like my device'], ['calm', 'Calm'], ['full', 'Full']], () => S.opt.calm, v => { S.opt.calm = v; applyMotion(); });
    row('Damage numbers', '', [[true, 'Show'], [false, 'Hide']], () => S.opt.nums !== false, v => { S.opt.nums = v; });
    row('When I switch away', '', [[false, 'Keep running'], [true, 'Pause']], () => !!S.opt.autoPause, v => { S.opt.autoPause = v; });
  }
  run(); m.hidden = false; xb.focus({ preventScroll: true });
}
function welcome(away, coins, gains) {
  const m = $('modal'), m_ = Math.round(away / 60), dur = m_ >= 60 ? Math.floor(m_ / 60) + 'h ' + m_ % 60 + 'm' : m_ + ' minutes';
  const list = h('div', { cls: 'away' });
  for (const k in gains) if (gains[k] >= 1) list.append(h('div', null, ico(k, ITEMS[k].n), '+' + fmt(gains[k])));
  const ok = h('button', { cls: 'primary', on: () => { m.hidden = true; for (let i = 0; i < 5; i++) setTimeout(() => flyFrom('coin', ok, $('hCoinWrap')), i * 80); } }, 'Back to work');
  m.textContent = '';
  m.append(h('div', { cls: 'box', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'mh' }, h('h3', { id: 'mh' }, 'Welcome back'),
    h('p', null, 'Your works ran for ' + dur + ' while you were away.' + (coins >= 1 ? ' Auto-sell and foremen earned you ' + fmt(coins) + ' coins.' : '')),
    list.childNodes.length ? list : h('p', null, 'Build some gathering camps and they will keep working while you are away.'), ok));
  m.hidden = false; ok.focus();
}
