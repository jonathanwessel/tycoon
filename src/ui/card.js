'use strict';
/* =========================================================
   Interface: the card
   What you tapped on the map: a building, a tower, a plot to build on, or the vault.
   ========================================================= */
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
        list.append(b); cardUps.push(() => b.classList.toggle('ghost', GHOST.type === id)); cardUps.push(() => { const locked = d.from && S.best < d.from, offRoad = d.troops && !besideRoad(c, r); b.disabled = locked || offRoad || S.coins < buildCost(id) || !hasGoods(towerGoods(id)); b.title = locked ? 'Opens once you reach wave ' + d.from : ''; b.querySelector('small').textContent = locked ? 'Opens once you reach wave ' + d.from + '. ' + d.d : offRoad ? 'Must touch the road (beside it or at a corner). ' + d.d : d.d; });
      }
    } else if (sel.t) {
      const t = sel.t, d = TOWERS[t.type], back = Math.ceil(d.coins * .5), stats = h('small');
      const brName = t.br ? BRANCH[t.type][t.br].n : null;
      box.append(h('div', { cls: 'cardhead' }, ico(t.br ? t.type + '_' + t.br : t.type), h('div', { cls: 'grow' }, h('div', { cls: 'name' }, brName ? brName + ' ' + d.n.toLowerCase() : d.n, h('i', null, 'Lv ' + (t.lvl + 1))), stats), close));
      cardUps.push(() => { const st = towerStats(t); stats.textContent = rate(st.dmg) + ' damage · ' + rate(st.rate) + ' shots/s · reach ' + st.range.toFixed(1) + (t.jam > 0 ? ' · jammed ' + Math.ceil(t.jam) + 's' : ''); });
      if (d.troops) { // soldiers: three tracks and sell
        cardUps.push(() => { const ts = troopStats(t); stats.textContent = ts.count + ' soldier' + (ts.count > 1 ? 's' : '') + ' · back in ' + ts.time.toFixed(1) + 's · ' + fmt(ts.hp) + ' health · ' + fmt(ts.dps) + ' damage/s · march ' + ts.reach.toFixed(1) + ' cells'; });
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
        const sb = confirmBtn('Sell +' + fmt(back2), 'Tap again: sell, soldiers' + (d.drone ? ' and drone' : '') + ' too', () => { S.coins += back2; S.towers.splice(S.towers.indexOf(t), 1); sel = null; snd('sell', 500, .1, 'triangle', .04, -200); refresh(); });
        box.append(h('div', { cls: 'bar' }, sb));
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
