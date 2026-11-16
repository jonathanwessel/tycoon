'use strict';
/* =========================================================
   Interface: things the player does
   Powers (Dynamite, Tar Pit, Overtime), travelling to another town, holding the waves.
   ========================================================= */
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
/* Travel to another town of the empire: its map, buildings and waves; the town you leave keeps producing. */
function goTown(id) {
  if (!switchTown(id)) return; wipeField(); FXS.convoys = []; save();
  say('Welcome to ' + TOWN.n + '. ' + (Object.keys(S.towns).length ? 'Your other towns keep working while you are here.' : '') + (S.autoWave ? '' : ' Its waves are held until you tap Hold (or switch them on in the Capitol).'));
  goTab('defend');
}
function toggleAuto() {
  S.autoWave = !S.autoWave;
  if (S.autoWave) { W.countdown = Math.max(W.countdown, 10); say('Waves come on their own again.'); }
  else say('Waves on hold. Raiders only come when you call them.');
  refresh();
}
