// node scripts/shots3d.js <out-dir> [town]  — screenshots of the 3D view at phone size (2× pixel ratio): a busy town by
// day, mid-wave at dusk, and close up; prints frame timing and draw calls. For reviewing the graphics before a release.
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('./cdp'); } })();
const path = require('path'), fs = require('fs');
const out = process.argv[2] || '.', town = process.argv[3] || 'gulch';
(async () => {
  const srv = await require('./serve').start(0), b = await chromium.launch();
  const [vw, vh] = (process.env.VIEW || '400x860').split('x').map(Number); // e.g. VIEW=860x400 for a phone on its side
  const p = await b.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: vw > 1000 ? 1 : 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await p.goto(srv.url); await p.waitForTimeout(1500);
  const r = await p.evaluate(async town => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    PERF.noAuto = true; S.tut = 'done'; closeTitle('continue'); document.getElementById('modal').hidden = true; S.coins = 1e9; S.best = 40;
    if (town !== 'gulch') { unlockTown('ridge'); if (town === 'falls' || town === 'mesa') { S.best = 40; withTown('ridge', () => { S.best = 40; }); unlockTown('falls'); }
      if (town === 'mesa') { S.coins = 1e12; withTown('falls', () => { S.best = 40; }); openCapital(); S.capital.lv.transport = 5; unlockTown('mesa'); S.coins = 1e9; }
      goTown(town); await wait(300); }
    for (const k in S.res) add(k, 5000);
    const L = [12, 30, 60, 120]; BUILD.forEach((b, i) => { S[b.kind][b.def.id] = L[i % 4]; }); for (const b of BUILD.slice(0, 5)) hire(b.def.id);
    let i = 0; for (const t of Object.keys(TOWERS)) { buildTower(t, PLOTS[i].x, PLOTS[i].y); i++; }
    const bk = S.towers.find(t => t.type === 'barracks'); if (bk) { for (const k of ['time', 'count', 'power']) for (let i = 0; i < 5; i++) upgradeTrack(bk, k); rebuildHelipad(bk); }
    S.towers.forEach((t, j) => { for (let k = 0; k < 4; k++) upgradeTower(t); branchTower(t, j % 2 ? 'b' : 'a'); });
    setGx('preset', 'high'); for (let i = 0; i < 60 && !R3.on; i++) await wait(100); refresh(); await wait(1500);
    return { on: R3.on };
  }, town);
  if (!r.on) { console.log('3D did not start', errs); process.exit(1); }
  const shot = async n => { await p.screenshot({ path: path.join(out, town + (process.env.VIEW ? '-' + process.env.VIEW : '') + '-' + n + '.png') }); };
  await shot('day');
  // the title screen over the busy town, at two moments of the flyover
  await p.evaluate(async () => { S.opt.calm = 'full'; applyMotion(); showTitle(null); await new Promise(r => setTimeout(r, 2600)); });
  await shot('title');
  await p.evaluate(async () => { TITLE.t = 40; await new Promise(r => setTimeout(r, 300)); });
  await shot('title2');
  await p.evaluate(async () => { closeTitle('continue'); await new Promise(r => setTimeout(r, 2000)); });
  await p.evaluate(async () => { const b = BUILD[3], id = b.def.id; S[b.kind][id] = 0; refresh(); await new Promise(r => setTimeout(r, 400)); buyBuilding(b); BUILD.slice(4, 7).forEach(q => { upgradeTower(S.towers[0]); }); await new Promise(r => setTimeout(r, 420)); });
  await shot('build');
  const t = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    S.wave = 19; planWave(); startWave(); await wait(5000); S.best = Math.max(S.best, 10); S.cd.tar = 0; useAbility('tar'); await wait(600);
    // frame timing over two seconds
    let n = 0, t0 = performance.now(); await new Promise(res => { const f = () => { n++; performance.now() - t0 < 2000 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); });
    const fps = n / ((performance.now() - t0) / 1000), info = R3D.info();
    return { fps: Math.round(fps), info };
  });
  await shot('wave');
  await p.evaluate(async () => { const st = S.towers.find(t => t.type === 'still'); if (st) { R3.focus = st; } R3.distT = 13; R3.yawT = .5; await new Promise(r => setTimeout(r, 1200)); });
  await shot('close');
  await p.evaluate(async () => { R3.distT = 24; R3.yawT = 0; goTab('works'); await new Promise(r => setTimeout(r, 1200)); });
  await shot('sheet');
  await p.evaluate(async () => { document.getElementById('bMis').click(); await new Promise(r => setTimeout(r, 1000)); });
  await shot('missions');
  await p.evaluate(async () => { closeSheet(); for (const t of S.towers) if (t.c > 0) { sel = { t }; break; } refresh(); await new Promise(r => setTimeout(r, 800)); });
  await shot('card');
  await p.evaluate(async () => { sel = null; S.wave = 20; foes = []; W.queue = []; W.active = false; planWave(); startWave(); goTab('works'); await new Promise(r => setTimeout(r, 4000)); });
  await shot('works');
  await p.evaluate(async () => { closeSheet(); const pl = PLOTS.find(q => !S.towers.some(t => t.c === q.x && t.r === q.y)); sel = { plot: [pl.x, pl.y] }; GHOST.type = 'cannon'; refresh(); await new Promise(r => setTimeout(r, 800)); });
  await shot('select');
  await p.evaluate(async () => { sel = null; refresh(); foes = []; W.queue = []; W.active = false; S.wave = 30; planWave(); startWave(); for (let i = 0; i < 60 && !foes.some(f => f.type === 'boss'); i++) await new Promise(r => setTimeout(r, 250)); await new Promise(r => setTimeout(r, 1500)); });
  await shot('boss');
  await p.evaluate(async () => { foes = []; W.active = false; W.queue = []; sel = null; S.tut = undefined; tutStart(); S.stats.taps = 0; await new Promise(r => setTimeout(r, 900)); });
  await shot('tutorial');
  await p.evaluate(async () => { tutEnd(true); S.coins = 1e12; S.best = 40; if (!townOpen('ridge')) unlockTown('ridge'); if (S.towns.ridge) S.towns.ridge.best = 30; if (!townOpen('falls')) unlockTown('falls'); if (S.towns.falls) S.towns.falls.best = 20; S.coins = 1e12; openCapital(); buyInst('market'); buyInst('war'); goTab('capital'); setSheetH(.9); await new Promise(r => setTimeout(r, 900)); });
  await shot('capital');
  await p.evaluate(async () => { closeSheet(); S.capital.lv.market = 12; S.capital.lv.transport = 20; S.capital.lv.education = 3; S.capital.lv.bank = 1; visitCapital(); await new Promise(r => setTimeout(r, 1500)); });
  await shot('city');
  await p.evaluate(async () => { sel = { site: 'exchange' }; refresh(); await new Promise(r => setTimeout(r, 1000)); });
  await shot('citycard');
  await p.evaluate(async () => { sel = { site: 'capitol' }; refresh(); R3.distT = 14; R3.yawT = -.5; await new Promise(r => setTimeout(r, 1400)); });
  await shot('capitol');
  await p.evaluate(async () => { sel = null; R3.distT = 24; R3.yawT = 0; leaveCapital(); await new Promise(r => setTimeout(r, 400)); });
  await p.evaluate(async () => { S.capital.inf = 500; buyTech('industry'); buyTech('industry'); buyTech('arms'); goTab('tech'); await new Promise(r => setTimeout(r, 900)); });
  await shot('tech');
  await p.evaluate(async () => { buyInst('exchange'); for (let i = 0; i < 40; i++) econTowns(10); exNews('boss'); exBuy('gulch', 600); exBuy('ridge', 120); for (let i = 0; i < 20; i++) econTowns(10); goTab('exchange'); await new Promise(r => setTimeout(r, 900)); });
  await shot('exchange');
  await p.evaluate(async () => { setPolicy('econ', 'planned'); setPolicy('army', 'militia'); goTab('capital'); await new Promise(r => setTimeout(r, 500)); const h = [...document.querySelectorAll('#panel h2')].find(e => /policies/.test(e.textContent)); if (h) h.scrollIntoView(); await new Promise(r => setTimeout(r, 400)); });
  await shot('policies');
  await p.evaluate(async () => { S.stats.coins = 4e11; S.deeds = 12; S.legacy.pts = 3; goTab('convention'); await new Promise(r => setTimeout(r, 900)); });
  await shot('convention');
  // save slots: Settings, Saves with a save waiting to be loaded, and the title screen listing the other slot
  await p.evaluate(async () => { if (SHEET.open) closeSheet(); const o = Object.assign(fresh(), { town: 'gulch', wave: 23, last: Date.now() - 3 * 86400e3 }); o.stats.coins = 4.2e7; loadInto(2, o);
    SAVES.pend = { o, s: saveSummary(o) }; openSettings('saves'); await new Promise(r => setTimeout(r, 400)); });
  await shot('saves');
  await p.evaluate(async () => { closeSettings(); SAVES.pend = null; showTitle(null); await new Promise(r => setTimeout(r, 1200)); });
  await shot('titleslots');
  // a controller: the cursor on the board, then a tower card with the focus ring on a button
  await p.evaluate(async () => { closeTitle('continue'); await new Promise(r => setTimeout(r, 1600)); const B = () => Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
    let t = performance.now(); const fr = k => { const pad = { axes: [0, 0, 0, 0], buttons: B() }; if (k) pad.buttons[PAD_BTN[k]] = { pressed: true, value: 1 }; t += 16; padFrame(pad, t); };
    fr('a'); fr(); PAD.cur = [PLOTS[3].x, PLOTS[3].y]; fr(); await new Promise(r => setTimeout(r, 500)); window.__fr = fr; });
  await shot('pad');
  await p.evaluate(async () => { const t = S.towers[0]; PAD.cur = [t.c, t.r]; __fr('a'); __fr(); await new Promise(r => setTimeout(r, 300)); __fr(); __fr('right'); __fr(); await new Promise(r => setTimeout(r, 500)); });
  await shot('padcard');
  console.log(town, JSON.stringify(t), errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
  await b.close(); srv.close(); process.exit(0);
})();
