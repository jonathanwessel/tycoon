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
/* Powers the player triggers by hand */
const ABIL = {
  dyn: { n: 'Dynamite', icon: 'dynamite', cd: 40, d: 'Blows up the thickest knot of raiders.' },
  tar: { n: 'Tar Pit', icon: 'tar', cd: 50, from: 8, d: 'Pours tar on the road ahead of the raiders: they crawl through it for 12 seconds. An explosion sets it alight.' },
  ot:  { n: 'Overtime', icon: 'bell', cd: 120, dur: 20, d: 'Every building works three times as fast for 20 seconds.' },
};
function useAbility(id) {
  if (S.cd[id] > 0) return say(ABIL[id].n + ' is ready in ' + Math.ceil(S.cd[id]) + 's.');
  if (ABIL[id].from && S.best < ABIL[id].from) return say(ABIL[id].n + ' opens once you have reached wave ' + ABIL[id].from + '.');
  if (id === 'tar') {
    // ahead of the thickest group of raiders on the road (boats sail past tar)
    const on = foes.filter(f => f.hp > 0 && f.type !== 'boat' && !(MAP.river !== undefined && f.p === MAP.river)); if (!on.length) return say('No raiders on the road to slow down.');
    let best = on[0], bn = -1; for (const f of on) { const n = on.filter(o => Math.abs(o.d - f.d) < 1.5 && o.p === f.p).length; if (n > bn || (n === bn && f.d > best.d)) { bn = n; best = f; } }
    const [x, y] = posAt(Math.min(PATHS[best.p].len - .5, best.d + 1.2), best.p);
    tars.push({ x, y, r: .95, t: 12, dps: foeHp(S.wave) * .4 * MAP.hp }); S.cd.tar = ABIL.tar.cd; snd('glug', 140, .3, 'sine', .06, -40);
    for (let i = 0; i < 12; i++) parts.push({ x: x + .5 + (Math.random() - .5) * 1.4, y: y + .5, vx: (Math.random() - .5), vy: -Math.random() * 1.5, g: 6, t: .5, c: '#2a2026', s: .08 });
    refresh(); return;
  }
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
  if (sel && SHEET.open && !docked()) closeSheet(); // a thing tapped on the map: its card replaces the menu
  const box = $('card'); box.hidden = !sel; if (!sel) { box._k = box._e = null; return; }
  const key = sel.t ? 't' + S.towers.indexOf(sel.t) + '/' + sel.t.lvl + sel.t.br : sel.b ? 'b' + sel.b.def.id : sel.vault ? 'v' : 'p' + sel.plot.join(',');
  if (box._k !== key) {
    const ent = key.split('/')[0], opening = !box._k, other = box._e !== ent;
    box._k = key; box._e = ent; box.textContent = ''; cardUps = []; $('sheet').scrollTop = 0; box.classList.toggle('build', !!sel.plot);
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
        note.textContent = W.active ? 'Raiders are on the road. Repair between waves.' : miss ? 'Each point costs ' + fmt(repairCost()) + ' coins. A raider that gets through takes 1 or 2 strength and 5% of your coins; a ' + bossName().toLowerCase() + ' smashes the vault outright.' : 'The vault is at full strength.';
        one.disabled = W.active || !miss || S.coins < repairCost(); full.disabled = W.active || !miss || S.coins < repairCost() * miss;
      });
    } else if (sel.plot) {
      const [c, r] = sel.plot;
      box.append(h('div', { cls: 'cardhead' }, h('div', { cls: 'grow' }, h('div', { cls: 'name' }, 'Build a tower on the glowing plot'), h('small', null, 'Touch a tower to preview it there. Grey costs mean you are short of coins or goods.')), close));
      if (!GHOST.type) GHOST.type = 'crossbow';
      const list = h('div', { cls: 'buildlist' }); box.append(list);
      for (const id in TOWERS) {
        if (TOWERS[id].rebuilt) continue; // made by rebuilding another tower, not built
        const d = TOWERS[id], b = h('button', { cls: 'buildopt', on: () => {
          GHOST.type = null;
          if (!buildTower(id, c, r)) return;
          const t = S.towers[S.towers.length - 1]; t.born = .35; sel = { t }; snd('build', 330, .12, 'triangle', .05, 330);
          for (let i = 0; i < 12; i++) parts.push({ x: c + .5 + (Math.random() - .5) * .8, y: r + .8, vx: (Math.random() - .5) * 2.5, vy: -1 - Math.random() * 2, g: 6, t: .5, c: '#e9d2a8', s: .08 });
        } }, ico(id), h('span', { cls: 'grow' }, h('span', { cls: 'name' }, d.n), h('small', null, d.d)), costEl(() => buildCost(id), towerGoods(id), cardUps));
        for (const ev of ['pointerenter', 'focus', 'pointerdown']) b.addEventListener(ev, () => { GHOST.type = id; });
        list.append(b); cardUps.push(() => b.classList.toggle('ghost', GHOST.type === id)); cardUps.push(() => { const locked = d.from && S.best < d.from; b.disabled = locked || S.coins < buildCost(id) || !hasGoods(towerGoods(id)); b.title = locked ? 'Opens once you reach wave ' + d.from : ''; if (locked) b.querySelector('small').textContent = 'Opens once you reach wave ' + d.from + '. ' + d.d; });
      }
    } else if (sel.t) {
      const t = sel.t, d = TOWERS[t.type], back = Math.ceil(d.coins * .5), stats = h('small');
      const brName = t.br ? BRANCH[t.type][t.br].n : null;
      box.append(h('div', { cls: 'cardhead' }, ico(t.br ? t.type + '_' + t.br : t.type), h('div', { cls: 'grow' }, h('div', { cls: 'name' }, brName ? brName + ' ' + d.n.toLowerCase() : d.n, h('i', null, 'Lv ' + (t.lvl + 1))), stats), close));
      cardUps.push(() => { const st = towerStats(t); stats.textContent = rate(st.dmg) + ' damage · ' + rate(st.rate) + ' shots/s · reach ' + st.range.toFixed(1) + (t.jam > 0 ? ' · jammed ' + Math.ceil(t.jam) + 's' : ''); });
      if (d.troops) { // soldiers: three tracks, a rally point, and sell
        cardUps.push(() => { const ts = troopStats(t); stats.textContent = ts.count + ' soldier' + (ts.count > 1 ? 's' : '') + ' · back in ' + ts.time.toFixed(1) + 's · ' + fmt(ts.hp) + ' health · ' + fmt(ts.dps) + ' damage/s'; });
        for (const k in TRACKS) {
          const T = TRACKS[k], lab = h('span', { cls: 'grow' }), b = h('button', { cls: 'small', on: () => upgradeTrack(t, k) }, 'Upgrade ', costEl(() => trackCost(t, k), null, cardUps));
          box.append(h('div', { cls: 'row track' }, lab, b));
          cardUps.push(() => { const l = (t.up && t.up[k]) || 0, fin = l >= T.max; lab.textContent = T.n + ' ' + l + '/' + T.max + ' · ' + T.d; b.hidden = fin; b.disabled = S.coins < trackCost(t, k); });
        }
        if (d.drone) {
          cardUps.push(() => { const ds = droneStats(t), dr = t.drone || {}; stats.textContent = ''; stats.append(fmt(troopStats(t).count) + ' soldiers · drone ' + fmt(ds.dmg) + ' damage × ' + ds.rate.toFixed(1) + '/s · battery ' + Math.max(0, dr.bat || 0).toFixed(0) + '/' + ds.battery.toFixed(0) + 's · reach ' + ds.range.toFixed(1)); });
          box.append(h('small', null, 'Drone'));
          for (const k in DRONE) {
            const T = DRONE[k], lab = h('span', { cls: 'grow' }), b = h('button', { cls: 'small', on: () => upgradeDrone(t, k) }, 'Upgrade ', costEl(() => droneCost(t, k), null, cardUps));
            box.append(h('div', { cls: 'row track' }, lab, b));
            cardUps.push(() => { const l = (t.dr && t.dr[k]) || 0; lab.textContent = T.n + ' ' + l + '/' + T.max + ' · ' + T.d; b.hidden = l >= T.max; b.disabled = S.coins < droneCost(t, k); });
          }
        } else {
          const rb = h('button', { cls: 'primary grow1', on: () => rebuildHelipad(t) }, 'Rebuild as Drone Helipad ', costEl(() => rebuildCost(), towerGoods('helipad'), cardUps)), note = h('small', null, 'With Drill, Recruits and Arms all at 5, this Barracks can be rebuilt as a Drone Helipad: an attack drone that flies anywhere within reach. The soldiers stay.');
          box.append(note, h('div', { cls: 'bar' }, rb)); cardUps.push(() => { rb.disabled = !canRebuild(t) || S.coins < rebuildCost() || !hasGoods(towerGoods('helipad')); });
        }
        const back2 = Math.ceil(d.coins * .5 + (t.spent || 0) * .3);
        const mv = h('button', { cls: 'small', on: () => { rallyFor = t; say('Tap a road cell inside the barracks\' reach to move the rally point. Tip: a spot by a bend makes raiders pass twice.'); } }, 'Move rally point');
        const sb = confirmBtn('Sell +' + fmt(back2), 'Tap again: sell, soldiers' + (d.drone ? ' and drone' : '') + ' too', () => { S.coins += back2; S.towers.splice(S.towers.indexOf(t), 1); sel = null; snd('sell', 500, .1, 'triangle', .04, -200); refresh(); });
        box.append(h('div', { cls: 'bar' }, mv, sb));
        for (const f of cardUps) f(); return;
      }
      const seg = h('div', { cls: 'seg' }, h('small', null, 'Aim at'));
      for (const [m, n] of [['first', 'First'], ['strong', 'Strongest'], ['weak', 'Weakest']]) { const b = h('button', { cls: 'small', on: () => { t.tg = m; } }, n); seg.append(b); cardUps.push(() => b.classList.toggle('on', (t.tg || 'first') === m)); }
      box.append(seg);
      const sellB = confirmBtn('Sell +' + fmt(back), 'Tap again to sell', () => { S.coins += back; S.towers.splice(S.towers.indexOf(t), 1); sel = null; snd('sell', 500, .1, 'triangle', .04, -200); refresh(); });
      if (needsBranch(t)) {
        const br = h('div', { cls: 'branches' });
        for (const k of Object.keys(BRANCH[t.type])) { const B = BRANCH[t.type][k], b = h('button', { on: () => branchTower(t, k) }, h('span', { cls: 'name' }, B.n), h('small', null, B.d), costEl(() => branchCost(t), null, cardUps)); br.append(b); cardUps.push(() => { b.disabled = S.coins < branchCost(t); }); }
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
function gridAt(ev) { if (R3.on) return r3Pick(ev); const r = cv.getBoundingClientRect(), bw = cv.clientLeft, bt = cv.clientTop; return [(ev.clientX - r.left - bw) / (cv.clientWidth || r.width) * COLS, (ev.clientY - r.top - bt) / (cv.clientHeight || r.height) * ROWS]; }
function slotAt(gx, gy) { if (gy >= YARD) return null; const sx = Math.floor(gx / 2) * 2, sy = Math.floor(gy / 2) * 2; return Object.keys(SLOT).find(k => SLOT[k][0] === sx && SLOT[k][1] === sy); }
let holdT = null;
const stopHold = () => { clearInterval(holdT); holdT = null; };
cv.addEventListener('click', e => { if (SHEET.open && !docked()) { closeSheet(); e.stopImmediatePropagation(); } }, true);
cv.addEventListener('pointerdown', ev => {
  if (SHEET.open && !docked()) return;
  const [gx, gy] = gridAt(ev), id = slotAt(gx, gy);
  if (id !== 'trees' && id !== 'rocks') return;
  gather(id); stopHold(); holdT = setInterval(() => gather(id), 170);
});
for (const e of ['pointerup', 'pointercancel', 'pointerleave']) cv.addEventListener(e, stopHold);
cv.addEventListener('contextmenu', e => e.preventDefault());
/* The menus. Side by side with the map on wide screens (docked); on a phone they live in a sheet that slides up over
   the town: a tab opens it (the same tab again, a tap on the map, Back or Escape closes it), its head drags it taller,
   shorter or away. Tapping something on the map closes it and shows that thing's card instead. */
const DOCK = window.matchMedia ? matchMedia('(min-width: 900px), (orientation: landscape) and (min-width: 600px)') : { matches: true };
const docked = () => DOCK.matches;
const SHEET = { open: false, h: .55 };
function setSheetH(f) { SHEET.h = f; document.documentElement.style.setProperty('--sheet-h', Math.round(innerHeight * f) + 'px'); }
function openSheet() {
  if (docked()) return; sel = null;
  if (!SHEET.open) { SHEET.open = true; setSheetH(SHEET.h); document.body.classList.add('sheet-open'); try { history.pushState({ sheet: 1 }, ''); } catch (e) {} }
}
function closeSheet(fromBack) {
  if (!SHEET.open) return; SHEET.open = false; document.body.classList.remove('sheet-open');
  if (!fromBack && history.state && history.state.sheet) try { history.back(); } catch (e) {}
  refresh();
}
window.addEventListener('popstate', () => closeSheet(true));
function goTab(id) {
  if (!docked() && SHEET.open && tab === id) return closeSheet();
  if (tab !== id || !SHEET.open) snd('tab', 520, .03, 'square', .015, 160);
  tab = id; rebuild = true; $('sheet').scrollTop = 0; openSheet(); refresh();
}
/* Travel to another town of the empire: its map, buildings and waves; the town you leave keeps producing. */
function goTown(id) {
  if (!switchTown(id)) return; wipeField(); bakeGround(); FXS.convoys = []; save();
  say('Welcome to ' + TOWN.n + '. ' + (Object.keys(S.towns).length ? 'Your other towns keep working while you are here.' : ''));
  goTab('defend');
}
function toggleAuto() {
  S.autoWave = !S.autoWave;
  if (S.autoWave) { W.countdown = Math.max(W.countdown, 10); say('Waves come on their own again.'); }
  else say('Waves on hold. Raiders only come when you call them.');
  refresh();
}
cv.addEventListener('click', ev => {
  const [gx, gy] = gridAt(ev);
  if (rallyFor) { const t = rallyFor; rallyFor = null; if (setRally(t, Math.floor(gx), Math.floor(gy))) { say('Rally point moved.'); snd('tab', 660, .05, 'square', .02, 200); } else say('That is not a road cell inside the barracks\' reach.'); return; }
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
  if (onRoad(c, rw)) { sel = null; FXS.badCell = { x: c, y: rw, t: .9 }; return say('Towers go beside the road, not on it.'); }
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
  healer: 'Mends raiders around it. Kill it first.', thief: 'Steals goods instead of hitting the vault.', boat: 'River pirates: row up the river in Silver Falls. Towers on the banks can reach them.', boss: 'Every tenth wave. If it reaches the vault, the vault falls however strong it is: destroy it to move on.',
};
/* What the foremen are saving for, in words. */
function fbGoal() {
  const g = S.fb && S.fb.goal; if (!g) return '';
  if (g.startsWith('r:')) { const r = RESEARCH.find(q => q.id === g.slice(2)); return r ? ' (now: research ' + r.n + ', ' + fmt(S.fb.goalC) + ')' : ''; }
  const b = BY_ID[g]; if (!b) return ''; const n = S.fb.goalN || 1, l = blv(g);
  return ' (now: ' + b.def.n + (n > 1 ? ' levels ' + (l + 1) + ' to ' + (l + n) : ' level ' + (l + 1)) + ', ' + fmt(S.fb.goalC || bCost(b, l)) + ')';
}
/* The tower previewed on the selected plot (the 3D view draws it as a ghost with its reach). */
const GHOST = { type: null };
/* A button that needs two taps: the first arms it (red, "Tap again to ...") for 3 seconds, the second does it. */
function confirmBtn(label, armed, act) {
  let t = 0; const b = h('button', { cls: 'small' }, label);
  b.addEventListener('click', () => { if (b.classList.contains('arm')) { clearTimeout(t); act(); return; } b.classList.add('arm', 'danger'); b.textContent = armed; snd('tab', 300, .05, 'square', .02, -60); t = setTimeout(() => { b.classList.remove('arm', 'danger'); b.textContent = label; }, 3000); });
  return b;
}
/* A mission card: title, progress bar, reward, Claim (and Swap for generated ones). */
function missionCard(p, now, onClaim, onSwap, icon) {
  const gt = h('span'), gn = h('small'), bar = h('i'), claim = h('button', { cls: 'small', on: onClaim }, 'Claim'), swap = h('button', { cls: 'small', on: onSwap || (() => {}) }, 'Swap');
  const goal = h('div', { cls: 'goal' }, ico(icon || 'star'), h('div', { cls: 'grow' }, h('div', { cls: 'gt' }, gt, gn), h('div', { cls: 'prog' }, bar)), h('div', { cls: 'bar' }, swap, claim));
  p.append(goal);
  ups.push(() => {
    const g = now(); goal.hidden = !g; if (!g) return; const done = g.cur >= g.need;
    gt.textContent = g.t; gn.textContent = (g.need > 1 ? fmt(g.cur) + ' / ' + fmt(g.need) + ' · ' : '') + 'reward ' + fmt(g.r) + ' coins';
    bar.style.width = Math.min(100, g.cur / g.need * 100) + '%'; goal.classList.toggle('done', done);
    claim.disabled = !done; claim.classList.toggle('primary', done); swap.hidden = !onSwap || !g.gen || done;
  });
}
const PANELS = {
  foremen(p) {
    const fbInfo = h('p');
    p.append(fbInfo);
    const fseg = (label, opts, key) => { const s = h('div', { cls: 'seg' }, h('small', null, label)); for (const [v, n] of opts) { const b = h('button', { cls: 'small', on: () => { S.fb[key] = v; refresh(); } }, n); s.append(b); ups.push(() => b.classList.toggle('on', S.fb[key] === v)); } p.append(s); };
    fseg('Pay them', [[.25, '25%'], [.5, '50%'], [.75, '75%'], [1, 'All']], 'share');
    fseg('Keep', [[0, 'No reserve'], [1, '1 min'], [5, '5 min']], 'keep');
    fseg('Research', [[1, 'They may buy it'], [0, 'Leave it to me']], 'study');
    p.append(h('p', null, 'Hire a foreman with the button next to any building in Works. Each foreman after the first two costs more. Every building doubles its output at levels 10, 25, 50 and each 100, and foremen save up for those.'), h('button', { on: () => goTab('works') }, '‹ Back to Works'));
    ups.push(() => { const n = Object.keys(S.mgr).filter(id => S.mgr[id] === 1).length; fbInfo.textContent = n ? n + ' at work in ' + TOWN.n + '. They get ' + pct(S.fb.share) + ' of what this town earns and save up for the upgrade that pays back fastest' + fbGoal() + '. Purse: ' + fmt(S.fb.purse || 0) + (S.fb.keep ? '. They never take you below ' + S.fb.keep + ' minute' + (S.fb.keep > 1 ? 's' : '') + ' of income.' : '.') : 'No foremen yet in ' + TOWN.n + '.'; });
  },
  missions(p) {
    p.append(h('h2', null, TOWN.n));
    missionCard(p, goalNow, claimGoal, () => { S.gq = null; });
    p.append(h('p', null, 'Each town has its own missions, counted with that town\'s buildings and waves.'));
    p.append(h('h2', null, 'Empire'));
    missionCard(p, empireNow, claimEmpire, null, 'loco');
    const doneE = h('p', null, 'Every empire mission is complete. More come with the Capital.'); p.append(doneE); ups.push(() => { doneE.hidden = !!empireNow(); });
    p.append(h('p', null, 'Badges, records and deeds are in the Charter tab.'));
  },
  defend(p) {
    const nxT = h('h2'), nx = h('div', { cls: 'next' }), wxl = h('div', { cls: 'wxline' }); let sig = null;
    const bw = h('div', { cls: 'wxline warn' }, ico(TOWN.boss.spr, ''), h('span', null, h('b', null, bossName() + ' wave. '), 'If it reaches the vault, the vault falls however strong it is. Destroy it to move on.'));
    p.append(nxT, nx, bw, wxl);
    ups.push(() => {
      bw.hidden = S.wave % 10 !== 0;
      const q = W.active ? W.queue : W.next || [], wk = W.active ? W.weather : W.nweather, s = (W.active ? 'a' : 'n') + S.wave + ':' + q.length + W.ntype + wk;
      nxT.textContent = W.active ? 'Still to come' : 'Next: ' + (S.wave % 10 === 0 ? bossName().toLowerCase() : WTYPES[W.ntype].n.toLowerCase());
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
      if (TOWERS[id].rebuilt) continue;
      const d = TOWERS[id];
      p.append(h('div', { cls: 'row' }, ico(id), h('div', { cls: 'grow' }, h('div', { cls: 'name' }, d.n), h('small', null, d.d + (BRANCH[id] ? ' Paths at level 5: ' + Object.values(BRANCH[id]).map(B => B.n).join(', ').replace(/, ([^,]*)$/, ' or $1') + '.' : '') + (d.from ? ' Opens at wave ' + d.from + '.' : ''))), costEl(() => buildCost(id), towerGoods(id), ups)));
    }
    p.append(h('h2', null, 'Raiders seen so far'));
    for (const k in FOES) if (k === 'boss' ? S.best >= 10 : S.best >= UNLOCK[k]) p.append(h('div', { cls: 'row' }, ico(k), h('div', { cls: 'grow' }, h('div', { cls: 'name' }, FOES[k].n), h('small', null, FOE_TIPS[k]))));
    p.append(h('p', null, 'Settings are at the bottom of the Charter tab.'));
  },
  works(p) {
    const chopN = h('span'), digN = h('span');
    ups.push(() => { chopN.textContent = TOWN.tapN.trees + ' +' + fmt(tapYield()); digN.textContent = TOWN.tapN.rocks + ' +' + fmt(tapYield()); });
    const modes = h('div', { cls: 'seg' }, h('small', null, 'Buy'));
    for (const m of [1, 10, 'ms', 'max']) { const b = h('button', { cls: 'small', on: () => { buyMode = m; } }, m === 'max' ? 'Max' : m === 'ms' ? 'To next ★' : '×' + m); modes.append(b); ups.push(() => b.classList.toggle('on', buyMode === m)); }
    // one compact strip: how many to buy, and the foremen (their settings open in their own panel)
    const fbInfo = h('small'), fbBtn = h('button', { cls: 'small fmbtn', on: () => goTab('foremen') }, ico('foreman', ''), h('span', { cls: 'grow' }, h('b', null, 'Foremen'), fbInfo), h('span', { cls: 'chev' }, '›'));
    p.append(h('div', { cls: 'workbar' }, modes, fbBtn));
    if (TOWN.power) { // the power grid: supply from Water Wheels against demand from workshop levels
      const pw = h('div', { cls: 'power' }), pbar = h('i'), ptxt = h('small');
      pw.append(h('div', { cls: 'name' }, 'Power grid'), h('div', { cls: 'prog vbar' }, pbar), ptxt); p.append(pw);
      ups.push(() => { const g = powerUse(); pbar.style.width = Math.min(100, g.use ? g.cap / g.use * 100 : 100) + '%'; pbar.style.background = g.f >= 1 ? 'var(--good)' : g.f > .6 ? 'var(--gold)' : 'var(--bad)';
        ptxt.textContent = 'Water Wheels supply ' + fmt(g.cap) + ', workshops use ' + fmt(g.use) + (g.f >= 1 ? '. Everything runs at full speed.' : '. Workshops run at ' + pct(g.f) + ' speed: build more Water Wheels.'); });
    }
    p.append(h('div', { cls: 'gathhead' }, h('h2', null, 'Gathering'), h('button', { cls: 'small', on: () => gather('trees'), title: 'Or hold the ' + (TOWN.trees ? 'trees' : 'boulders') + ' on the map' }, ico(TOWN.tap.trees), chopN), h('button', { cls: 'small', on: () => gather('rocks'), title: 'Or hold the rocks on the map' }, ico(TOWN.tap.rocks), digN)));
    ups.push(() => {
      const n = Object.keys(S.mgr).filter(id => S.mgr[id] === 1).length;
      fbInfo.textContent = n ? n + ' at work · purse ' + fmt(S.fb.purse || 0) + (S.fb.goal ? ' · next: ' + fbGoal().replace(/^ \(now: |\)$/g, '') : '') : 'Hire one with the button by any building';
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
  empire(p) {
    const tot = h('b'), pot = h('small'), car = h('small');
    p.append(h('h2', null, 'Empire'), h('div', { cls: 'emp' }, h('div', null, h('span', null, 'Coins per second, all towns'), tot), pot, car));
    ups.push(() => {
      tot.textContent = '+' + rate(liveIncome()) + '/s';
      pot.textContent = 'Potential with every surplus sold: +' + rate(townIds().reduce((a, id) => a + townIncome(id), 0)) + '/s';
      const cr = carrier(); car.textContent = 'Shipping by ' + cr.n.toLowerCase() + ': up to ' + cr.max + ' a minute on each route, ' + pct(cr.fee) + ' of the goods\' value per load.' + (S.railOpen ? '' : ' A Locomotive Works in Iron Ridge brings trains.');
    });
    // a card for every town
    for (const id in TOWNS) {
      const T = TOWNS[id], live = h('b'), info = h('small'), act = h('div', { cls: 'bar' });
      const card = h('div', { cls: 'town' }, h('div', { cls: 'cardhead' }, ico({ gulch: 'vault', ridge: 'loco', falls: 'bulb' }[id] || 'vault'), h('div', { cls: 'grow' }, h('div', { cls: 'name' }, T.n, h('i', null, T.era)), info), live), act);
      p.append(card);
      let shown = '';
      ups.push(() => {
        const open = townOpen(id), here = id === S.town;
        card.classList.toggle('here', here); card.classList.toggle('locked', !open);
        if (open) {
          const t = here ? S : S.towns[id], mg = Object.keys(t.mgr || {}).filter(k => t.mgr[k] === 1).length;
          live.textContent = '+' + rate(liveIncome(id)) + '/s';
          info.textContent = 'Potential +' + rate(townIncome(id)) + '/s · wave ' + t.wave + ' (best ' + t.best + ')' + (mg ? ' · ' + mg + ' foremen' : '') + (here ? ' · you are here' : ' · working in the background, waves on hold');
        } else {
          const u = T.unlock, from = TOWNS[u.from];
          live.textContent = ''; info.textContent = townOpen(u.from) ? 'Opens after wave ' + u.best + ' in ' + from.n + ' (best so far ' + townBest(u.from) + ') for ' + fmt(u.coins) + ' coins.' : 'Open ' + from.n + ' first.';
        }
        const key = (open ? 'o' : 'l') + (here ? 'h' : '');
        if (key !== shown) {
          shown = key; act.textContent = '';
          if (!open) { const b = h('button', { cls: 'primary', on: () => { if (unlockTown(id)) { say(T.n + ' is open! It needs goods it cannot make: set up a shipping route below.'); snd('badge', 784, .35, 'triangle', .06, 392); rebuild = true; } } }, 'Open ' + T.n + ' ', costEl(() => T.unlock.coins, null, ups)); act.append(b); ups.push(() => { b.disabled = S.coins < T.unlock.coins || townBest(T.unlock.from) < T.unlock.best; }); }
          else if (!here) act.append(h('button', { cls: 'primary', on: () => goTown(id) }, 'Play ' + T.n));
        }
      });
    }
    // shipping routes
    p.append(h('h2', null, 'Shipping routes'));
    const sug = h('div', { cls: 'sugs' }), list = h('div'), form = h('div', { cls: 'bar routeform' });
    p.append(sug, list, form);
    const made = id => new Set([...TOWNS[id].ext, ...TOWNS[id].shops].map(b => BY_ALL[b].def.out));
    const needs = id => { const m = made(id), n = new Set(); for (const s of TOWNS[id].shops) for (const k in BY_ALL[s].def.in) if (!m.has(k)) n.add(k); for (const ty in TOWNS[id].goods) for (const k in TOWNS[id].goods[ty]) if (!m.has(k)) n.add(k); return [...n]; };
    const addRoute = (from, to, k, per) => { if (from === to) return; S.routes.push({ id: Date.now() + Math.random(), from, to, k, per: per || 'auto', sent: 0 }); rebuild = true; say('Shipping ' + ITEMS[k].n.toLowerCase() + ' from ' + TOWNS[from].n + ' to ' + TOWNS[to].n + '.'); };
    const ids = townIds().filter(townOpen);
    for (const to of ids) for (const k of needs(to)) {
      const from = ids.find(f => f !== to && made(f).has(k)); if (!from || S.routes.some(r => r.to === to && r.k === k)) continue;
      sug.append(h('div', { cls: 'row' }, ico(k), h('div', { cls: 'grow' }, h('div', { cls: 'name' }, TOWNS[to].n + ' needs ' + ITEMS[k].n.toLowerCase()), h('small', null, 'Made in ' + TOWNS[from].n + '.')), h('button', { cls: 'small primary', on: () => addRoute(from, to, k, 'auto') }, 'Ship it')));
    }
    if (!S.routes.length) list.append(h('p', null, ids.length > 1 ? 'No routes yet. Goods leave before auto-sell, so a route takes what the town makes before it is sold.' : 'Open a second town to ship goods between towns.'));
    for (const r of S.routes) {
      const info = h('small'), seg = h('div', { cls: 'seg' });
      const rates = ['auto', ...(S.railOpen ? [30, 120, 300, 1200] : [10, 30, 60, 120])];
      for (const v of rates) { const b = h('button', { cls: 'small', on: () => { r.per = v; refresh(); } }, v === 'auto' ? 'Auto' : v + '/min'); if (v === 'auto') b.title = 'Ship what the other town can use, up to what the carrier can take'; seg.append(b); ups.push(() => b.classList.toggle('on', r.per === v)); }
      const pause = h('button', { cls: 'small', on: () => { r.paused = !r.paused; refresh(); } }), del = h('button', { cls: 'small danger', on: () => { S.routes = S.routes.filter(q => q !== r); rebuild = true; } }, 'Remove');
      list.append(h('div', { cls: 'row' }, ico(r.k), h('div', { cls: 'grow' }, h('div', { cls: 'name' }, ITEMS[r.k].n + ': ' + TOWNS[r.from].n + ' → ' + TOWNS[r.to].n), info), seg, h('div', { cls: 'acts' }, pause, del)));
      ups.push(() => { info.textContent = (r.paused ? 'Paused · ' : r.per === 'auto' ? 'Auto: ' + fmt(routeRate(r)) + '/min · ' : '') + fmt(r.sent || 0) + ' shipped so far'; pause.textContent = r.paused ? 'Resume' : 'Pause'; });
    }
    if (ids.length > 1) {
      const sel = (opts, val) => { const s = h('select'); for (const [v, n] of opts) { const o = h('option', { value: v }, n); if (v === val) o.selected = true; s.append(o); } return s; };
      const fromS = sel(ids.map(i => [i, TOWNS[i].n]), ids[0]), toS = sel(ids.map(i => [i, TOWNS[i].n]), ids[1]);
      const goods = () => Object.keys(ITEMS).filter(k => made(fromS.value).has(k) || k === TOWNS[fromS.value].tap.trees || k === TOWNS[fromS.value].tap.rocks);
      let kS = sel(goods().map(k => [k, ITEMS[k].n]));
      fromS.onchange = () => { const n = sel(goods().map(k => [k, ITEMS[k].n])); kS.replaceWith(n); kS = n; };
      form.append(h('small', null, 'New route'), fromS, h('small', null, 'to'), toS, kS, h('button', { cls: 'small', on: () => addRoute(fromS.value, toS.value, kS.value, 60) }, 'Add'));
    }
  },
  charter(p) {
    const held = h('b'), freeL = h('small'), offer = h('p'), signs = h('div', { cls: 'bar' });
    p.append(h('h2', null, 'Deeds'), h('div', { cls: 'deeds' }, held, freeL),
      h('p', null, 'Every deed you hold adds 20% to gathering, workshop speed and tower damage in every town, for good. Spend deeds on perks below; spending does not lose the bonus.'),
      h('h2', null, 'New charter for ' + TOWN.n), h('p', null, 'Sell ' + TOWN.n + ' and start it over for deeds. This town loses its coins, stock, buildings, research and towers; your other towns, deeds, perks, badges and goals stay.'), offer, signs);
    const sign = h('button', { cls: 'primary', on: () => prestige() }, 'Sign a new charter for ' + TOWN.n); signs.append(sign); ups.push(() => { sign.disabled = !deedsOnOffer(); });
    ups.push(() => {
      held.textContent = S.deeds; freeL.textContent = freeDeeds() + ' to spend';
      const g = deedsOnOffer();
      offer.innerHTML = (g ? 'Signing now earns <strong>' + g + ' deed' + (g > 1 ? 's' : '') + '</strong>' + (MAP.deed ? ', including ' + MAP.deed + ' extra for ' + TOWN.n : '') + '.'
        : 'Reach <strong>wave 35</strong> in ' + TOWN.n + ' to earn deeds here. Best so far: wave ' + S.best + '.')
        + ' Later towns pay more: charters in Iron Ridge earn 1 extra deed, in Silver Falls 2.';
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
    ups.push(() => { got.textContent = BADGES.filter(b => S.badges[b.id]).length + ' of ' + BADGES.length; });
    const recs = h('div', { cls: 'records' }); p.append(h('h2', null, 'Records'), recs);
    const hm = s => { s = Math.floor(s); const hh = Math.floor(s / 3600), mm = Math.floor(s / 60) % 60; return hh ? hh + 'h ' + mm + 'm' : mm + 'm'; };
    for (const [n, f] of [['Coins per second now', () => '+' + rate(liveIncome())], ['Potential coins per second (all surplus sold)', () => '+' + rate(steadyIncome())], ['Best coins per second', () => '+' + rate(S.bestRate || 0)], ['Coins earned', () => fmt(S.stats.coins)], ['Raiders defeated', () => fmt(S.stats.kills)], ['Bosses destroyed', () => fmt(S.stats.bosses)],
      ['Waves with no leaks', () => fmt(S.stats.flawless)], ['Goods made', () => fmt(S.stats.made)], ['Contracts filled', () => fmt(S.stats.contracts)],
      ['Charters signed', () => S.charters], ...Object.keys(TOWNS).map(id => ['Best wave · ' + TOWNS[id].n, () => townOpen(id) ? townBest(id) : '—']), ['Time played', () => hm(S.stats.played)]]) {
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
const TABS = [['defend', 'Defend', 'crossbow'], ['works', 'Works', 'camp'], ['market', 'Market', 'market'], ['research', 'Research', 'flask'], ['empire', 'Empire', 'loco'], ['charter', 'Charter', 'office']];
const fixedUps = [];
function buildFixed() {
  $('hCoinIcon').src = iconURL('coin'); $('hWaveIcon').src = iconURL('raider'); $('hVaultIcon').src = iconURL('vault'); $('hDeedIcon').src = iconURL('star');
  const tabs = $('tabs'), dots = {};
  for (const [id, n, icon] of TABS) {
    dots[id] = h('i', { cls: 'dot', hidden: '' });
    const b = h('button', { role: 'tab', id: 'tab-' + id, 'aria-controls': 'panel', on: () => goTab(id) }, ico(icon), h('span', null, n), dots[id]); tabs.append(b);
    fixedUps.push(() => b.setAttribute('aria-selected', String(tab === id && (SHEET.open || docked()))));
  }
  $('bWave').addEventListener('click', startWave);
  $('sheetX').addEventListener('click', () => closeSheet());
  $('bMis').addEventListener('click', () => goTab('missions'));
  { const mc = $('bMis').querySelector('.mcount'); let last = 0;
    fixedUps.push(() => { const n = missionsReady(); mc.hidden = !n; mc.textContent = n; $('bMis').classList.toggle('ready', n > 0); if (n > last) { mc.classList.remove('pop'); void mc.offsetWidth; mc.classList.add('pop'); } last = n; }); }
  // drag the sheet's head: taller, shorter, or flick it down to close
  (() => {
    const hd = $('sheetHead'); let d = null;
    hd.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; d = { y: e.clientY, h: SHEET.h, last: e.clientY, lt: performance.now() }; try { hd.setPointerCapture(e.pointerId); } catch (er) {} document.body.classList.add('sheet-drag'); });
    hd.addEventListener('pointermove', e => { if (!d) return; d.v = (e.clientY - d.last) / Math.max(1, performance.now() - d.lt); d.last = e.clientY; d.lt = performance.now(); setSheetH(Math.max(.15, Math.min(.92, d.h - (e.clientY - d.y) / innerHeight))); });
    const up = () => { if (!d) return; document.body.classList.remove('sheet-drag'); const f = SHEET.h, fling = (d.v || 0) > .8; d = null;
      if (f < .3 || fling) { closeSheet(); setSheetH(.55); } else setSheetH(f > .72 ? .9 : .55); };
    hd.addEventListener('pointerup', up); hd.addEventListener('pointercancel', up);
  })();
  $('bPause').addEventListener('click', () => setPaused(true));
  $('bFull').addEventListener('click', () => setMapFull(!document.body.classList.contains('mapfull')));
  $('bSet').addEventListener('click', () => openSettings());
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && FULL.asked) { FULL.asked = false; setMapFull(false); } });
  $('pauseCover').addEventListener('click', () => setPaused(false));
  document.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('textarea, input')) return;
    const md = $('modal'); if (e.key === 'Escape' && !md.hidden && md.classList.contains('sheetm')) { md.hidden = true; md.className = 'modal'; md.onclick = null; save(); return; }
    if (e.key === 'p' || e.key === 'P' || (e.key === 'Escape' && paused)) { e.preventDefault(); setPaused(!paused); }
    else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); goTab('missions'); }
    else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); setMapFull(!document.body.classList.contains('mapfull')); }
    else if (e.key === 'Escape' && document.body.classList.contains('mapfull')) setMapFull(false);
    else if (e.key === 'Escape' && SHEET.open) closeSheet();
  });
  const hold = $('bHold'); hold.addEventListener('click', toggleAuto);
  const hv = $('hVaultWrap'), openVault = () => { sel = { vault: 1 }; refresh(); };
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
    fixedUps.push(() => { b.hidden = !!(A.from && S.best < A.from); }); // Tar Pit appears once wave 8 has been reached
    fixedUps.push(() => { const f = Math.max(0, S.cd[id] || 0) / A.cd; shade.style.transform = 'scaleY(' + f + ')'; num.textContent = S.cd[id] > 0 ? Math.ceil(S.cd[id]) : ''; b.classList.toggle('ready', !(S.cd[id] > 0)); b.classList.toggle('active', id === 'ot' && S.ot > 0); });
  }
  const h1 = document.querySelector('h1');
  fixedUps.push(() => {
    if (h1.textContent !== TOWN.n) h1.textContent = TOWN.n; // the header names the town you are in
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
  const tt = TABS.find(t => t[0] === tab); $('sheetTitle').textContent = tt ? tt[1] : tab === 'missions' ? 'Missions' : tab === 'foremen' ? 'Foremen' : '';
  if (shownTab && shownTab !== tab && p.animate && !REDUCED) {
    const order = TABS.map(t => t[0]), dir = order.indexOf(tab) > order.indexOf(shownTab) ? 1 : -1;
    p.animate([{ opacity: 0, transform: 'translateX(' + dir * 28 + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
  if (shownTab !== tab && !REDUCED) { [...p.children].forEach((c, i) => c.style.setProperty('--i', Math.min(i, 12))); p.classList.add('enter'); setTimeout(() => p.classList.remove('enter'), 900); }
  shownTab = tab;
}
/* A little burst of coins from a button you just bought with. */
function sparks(el) {
  if (REDUCED || !el || !el.getBoundingClientRect) return; const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  for (let i = 0; i < 8; i++) { const s = document.createElement('i'); s.className = 'spark'; s.style.left = x - 6 + 'px'; s.style.top = y - 6 + 'px'; document.body.append(s);
    const a = i / 8 * Math.PI * 2 + Math.random() * .4, d = 26 + Math.random() * 22;
    s.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: 'translate(' + Math.cos(a) * d + 'px,' + (Math.sin(a) * d - 10) + 'px) scale(.4)', opacity: 0 }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = () => s.remove(); }
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
    row('View', 'The 3D view is a preview of the new engine: drag to turn the town, pinch or scroll to zoom, double-tap to reset.', [['2d', '2D'], ['3d', '3D (preview)']], () => GX().view || '2d', v => setGx('view', v));
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
