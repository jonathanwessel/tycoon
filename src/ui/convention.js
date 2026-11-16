'use strict';
/* =========================================================
   Interface: policies and the Constitutional Convention
   Policies are drawn in the Capitol (policyRows, called from the Capital panel). The Convention has its own sheet:
   Legacy held and what it multiplies, what a Convention would pay now and why, what it resets and keeps, the two-tap
   Convene button, and the Legacy perks.
   ========================================================= */
function policyRows(p) {
  p.append(h('h2', null, 'The Capitol: policies'), h('p', null, 'Pick one side of each pair. A policy holds until the next Constitutional Convention, so choose with care; a pair left open changes nothing.'));
  for (const k in POLICY) {
    const P = POLICY[k]; p.append(h('div', { cls: 'polhead' }, P.n));
    for (const v in P.opts) {
      const o = P.opts[v], name = h('div', { cls: 'name' }), state = h('small', { cls: 'polstate' });
      const b = confirmBtn('Adopt', 'Tap again: until the Convention', () => { if (setPolicy(k, v)) { say(o.n + ' is now the law in every town, until the next Convention.'); rebuild = true; } });
      const row = h('div', { cls: 'row pol' }, ico(o.icon), h('div', { cls: 'grow' }, name, h('small', null, o.d)), h('div', { cls: 'acts' }, b, state));
      p.append(row);
      ups.push(() => {
        const cur = pol(k); name.textContent = o.n; b.hidden = !!cur; state.hidden = !cur;
        state.textContent = cur === v ? 'In force' : 'Not chosen'; row.classList.toggle('on', cur === v); row.classList.toggle('off', !!cur && cur !== v);
      });
    }
  }
  p.append(h('div', { cls: 'bar' }, h('button', { on: () => goTab('convention') }, ico('star', ''), ' The Constitutional Convention')));
}

PANELS.convention = p => {
  const pts = h('b'), mult = h('small');
  p.append(h('div', { cls: 'infbar' }, ico('star', ''), h('div', { cls: 'grow' }, h('div', null, 'Legacy ', pts), mult)));
  ups.push(() => { pts.textContent = legacyPts(); mult.textContent = '×' + fmt2(legacyMult()) + ' gathering, workshop speed and tower damage in every town, for good · ' + freeLegacy() + ' to spend on Legacy perks'; });
  p.append(h('h2', null, 'The Constitutional Convention'),
    h('p', null, 'Write a new constitution and found the empire again. Every town starts over, and so do the Capital, Influence, the tech trees, the policies and the Stock Exchange. You keep your badges, lifetime records, settings, deed perks and Legacy. Your deeds become Legacy at the bonus they were worth.'));
  const recs = h('div', { cls: 'records' }), total = h('p'); p.append(h('div', { cls: 'polhead' }, 'A Convention now pays'), recs, total);
  for (const [n, f] of [['Coins earned this life', L => fmt(L.run) + ' → ' + L.inc], ['Deepest wave this life', L => 'wave ' + L.deep + ' → ' + L.wave], ['Deeds held', () => S.deeds + ' (×' + fmt2(deedMult()) + ')'], ['Deeds as Legacy', L => L.deeds]]) {
    const v = h('b'); recs.append(h('div', null, h('span', null, n), v)); ups.push(() => { v.textContent = f(legacyParts()); });
  }
  const go = confirmBtn('Hold the Convention', 'Tap again: every town starts over', () => {
    const n = convene(); if (!n) return; closeSheet(); goTab('defend'); refresh();
    say('The Convention is over: ' + n + ' Legacy. Every town now works ×' + fmt2(legacyMult()) + ' faster and hits as hard. Copper Gulch is yours to build again.');
  });
  go.classList.add('primary'); p.append(h('div', { cls: 'bar' }, go));
  ups.push(() => {
    const L = legacyParts(), ok = conventionReady(); go.disabled = !ok;
    total.innerHTML = !capOpen() ? 'The Convention meets in the Capital: found it first.'
      : ok ? 'In all: <strong>' + L.total + ' Legacy</strong>, taking you to ×' + fmt2(Math.pow(LEG_STEP, legacyPts() + L.total)) + '.'
      : 'Not yet: this life has to earn a point beyond its deeds (a billion coins earned, or wave 30 in any town).';
  });
  p.append(h('p', null, 'Legacy from coins: 2 for every tenfold past 100 million. From waves: 1 for every 10 past wave 20. Each Legacy multiplies by 1.25.'));
  // Legacy perks
  p.append(h('h2', null, 'Legacy perks'), h('p', null, 'Bought with Legacy; spending it does not lose the bonus. They shape how every new empire begins.'));
  const icons = { ridge: 'loco', falls: 'bulb', mesa: 'oil', capitol: 'office', pot: 'star' };
  for (const pk of LEGACY_PERKS) {
    const name = h('div', { cls: 'name' }), lab = h('span'), b = h('button', { on: () => { if (buyLegacy(pk.id)) say(pk.n + ': from the next Convention on.'); } }, lab);
    p.append(h('div', { cls: 'row' }, ico(icons[pk.id] || 'star'), h('div', { cls: 'grow' }, name, h('small', null, pk.d)), h('div', { cls: 'acts' }, b)));
    ups.push(() => {
      const l = lperk(pk.id), locked = pk.req && !lperk(pk.req), fin = l >= pk.max;
      name.textContent = pk.n; name.append(h('i', null, l ? (pk.max > 1 ? 'Rank ' + l + '/' + pk.max : 'Owned') : ''));
      lab.textContent = fin ? 'Done' : locked ? 'Needs ' + LEGACY_PERKS.find(q => q.id === pk.req).n : 'Buy · ' + pk.cost(l) + ' Legacy';
      b.disabled = fin || locked || freeLegacy() < pk.cost(l);
    });
  }
};
const fmt2 = n => n < 100 ? n.toFixed(2) : fmt(n);
