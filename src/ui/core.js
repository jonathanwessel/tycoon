'use strict';
/* =========================================================
   Interface: the building blocks
   Element helpers, icons, toasts, prices drawn as pictures, and the buy row every building uses.
   ========================================================= */
const $ = id => document.getElementById(id);
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs || {}) { if (k === 'on') e.addEventListener('click', attrs.on); else if (k === 'cls') e.className = attrs.cls; else e.setAttribute(k, attrs[k]); }
  for (const k of kids) if (k != null) e.append(k);
  return e;
}
document.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && e.target.closest && e.target.closest('button') && S && S.opt && S.opt.buzz !== false && navigator.vibrate) try { navigator.vibrate(6); } catch (er) {} }, { passive: true });
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
  const head = kind === 'shops' ? recipe(def) : def.power ? h('span', { cls: 'recipe' }, ico('bulb', 'power')) : h('span', { cls: 'recipe' }, ico(def.out, ITEMS[def.out].n));
  const prog = kind === 'shops' ? h('div', { cls: 'prog' }, h('i')) : null;
  // buy button on top; the run switch and foreman sit small underneath so the row never needs a line of its own
  btn.addEventListener('click', () => { if (!btn.disabled) sparks(btn); });
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
    info.textContent = def.power ? 'Powers ' + fmt(Math.max(1, have) * def.power * Math.pow(2, MS(have))) + ' workshop levels' + (have ? '' : ' at level 1') : rate(Math.max(1, have) * def.rate * mult) + '/s' + (have ? '' : ' at level 1');
    msl.textContent = have ? 'Output ×2 at level ' + nextMs(have) + (S.mgr[id] === 1 ? ' · foreman working' : S.mgr[id] === 2 ? ' · foreman resting' : '') : '';
    // a workshop that is not running says which input it is waiting for, and where that input comes from
    const miss = kind === 'shops' && have && !S.off[id] && (ACT[id] || 0) < .08 && STARVE[id];
    if (miss) { const local = BUILD.some(o => o.def.out === miss); msl.textContent = 'Waiting for ' + ITEMS[miss].n.toLowerCase() + (local ? '' : ': none are made here, ship them in from the Empire tab'); }
    msl.classList.toggle('warn', !!miss);
    lab.textContent = have ? '+' + p.n : 'Build'; if (btn.disabled && p.ok && btn._seen) { btn.classList.remove('afford'); void btn.offsetWidth; btn.classList.add('afford'); } btn.disabled = !p.ok; btn._seen = 1;
    if (row._ms !== undefined && ms > row._ms) { row.classList.remove('msflash'); void row.offsetWidth; row.classList.add('msflash'); } row._ms = ms;
    if (tog) { tog.hidden = !have; tog.textContent = S.off[id] ? 'Off' : 'On'; tog.classList.toggle('on', !S.off[id]); tog.title = S.off[id] ? 'Workshop paused. Tap to run it.' : 'Workshop running. Tap to pause it.'; tog.setAttribute('aria-label', tog.title); }
    mg.hidden = !(S.mgr[id] || have >= 1); mgL.textContent = S.mgr[id] ? (S.mgr[id] === 1 ? 'On' : 'Off') : ''; mgL.hidden = !S.mgr[id]; mgC.hidden = !!S.mgr[id];
    mg.title = S.mgr[id] ? (S.mgr[id] === 1 ? 'Foreman working. Tap to rest them.' : 'Foreman resting. Tap to put them to work.') : 'Hire a foreman for ' + fmt(mgrCost(id)) + ' coins'; mg.setAttribute('aria-label', mg.title);
    mg.classList.toggle('on', S.mgr[id] === 1); mg.disabled = !S.mgr[id] && S.coins < mgrCost(id);
    mini.hidden = (!tog || tog.hidden) && mg.hidden;
    if (prog) { const a = have ? ACT[id] || 0 : 0, fast = have * def.rate * mult > 2.5; prog.classList.toggle('idle', a < .08); prog.firstChild.style.width = (a < .08 ? 0 : fast ? 100 : (PHASE[id] || 0) * 100) + '%'; }
  });
  return row;
}
