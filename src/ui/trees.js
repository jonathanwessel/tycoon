'use strict';
/* =========================================================
   Interface: the tech trees
   Two trees bought with Influence in the Capital: Economy (Department of Education) and Defence (War Office). Each
   branch is a chain of five ranks, drawn as connected pips; the next rank's price is on its button.
   ========================================================= */
let techTab = 'econ';
PANELS.tech = p => {
  if (!capOpen()) { p.append(h('p', null, 'The tech trees live in the Capital. Found it first.'), h('button', { cls: 'primary', on: () => goTab('capital') }, 'The Capital')); return; }
  const inf = h('b'), rate = h('small');
  p.append(h('div', { cls: 'infbar' }, ico('star', ''), h('div', { cls: 'grow' }, h('div', null, 'Influence ', inf), rate)));
  ups.push(() => { inf.textContent = fmt(S.capital.inf || 0); rate.textContent = '+' + fmt(infRate() * 60) + ' a minute from the empire\'s income, +5 for every deed a charter earns. Nodes stay through charters.'; });
  const seg = h('div', { cls: 'seg' });
  for (const k in TECH) { const b = h('button', { cls: 'small', on: () => { techTab = k; rebuild = true; } }, TECH[k].n); seg.append(b); ups.push(() => b.classList.toggle('on', techTab === k)); }
  p.append(seg);
  const T = TECH[techTab]; p.append(h('h2', null, T.n + ' · ' + T.home));
  for (const b in T.branches) {
    const B = T.branches[b], pips = h('div', { cls: 'pips' }), btn = h('button', { cls: 'small', on: () => buyTech(b) }), name = h('div', { cls: 'name' });
    for (let i = 0; i < TECH_MAX; i++) pips.append(h('i'));
    p.append(h('div', { cls: 'row tech' }, ico(B.icon), h('div', { cls: 'grow' }, name, h('small', null, B.d), pips), h('div', { cls: 'acts' }, btn)));
    ups.push(() => {
      const r = tk(b), c = techCost(b); name.textContent = B.n; if (r) name.append(h('i', null, 'Rank ' + r));
      [...pips.children].forEach((e, i) => { e.classList.toggle('on', i < r); e.classList.toggle('next', i === r); });
      btn.hidden = r >= TECH_MAX; btn.textContent = fmt(c) + ' influence'; btn.disabled = (S.capital.inf || 0) < c; btn.classList.toggle('primary', !btn.disabled);
    });
  }
};
