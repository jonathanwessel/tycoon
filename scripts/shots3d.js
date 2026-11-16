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
    GLX.noAuto = true; S.coins = 1e9; S.best = 40;
    if (town !== 'gulch') { unlockTown('ridge'); if (town === 'falls') { S.best = 40; withTown('ridge', () => { S.best = 40; }); unlockTown('falls'); } goTown(town); await wait(300); }
    for (const k in S.res) add(k, 5000);
    const L = [12, 30, 60, 120]; BUILD.forEach((b, i) => { S[b.kind][b.def.id] = L[i % 4]; }); for (const b of BUILD.slice(0, 5)) hire(b.def.id);
    let i = 0; for (const t of Object.keys(TOWERS)) { buildTower(t, PLOTS[i].x, PLOTS[i].y); i++; }
    S.towers.forEach((t, j) => { for (let k = 0; k < 4; k++) upgradeTower(t); branchTower(t, j % 2 ? 'b' : 'a'); });
    setGx('preset', 'high'); setGx('view', '3d'); refresh(); await wait(1500);
    return { on: R3.on };
  }, town);
  if (!r.on) { console.log('3D did not start', errs); process.exit(1); }
  const shot = async n => { await p.screenshot({ path: path.join(out, town + (process.env.VIEW ? '-' + process.env.VIEW : '') + '-' + n + '.png') }); };
  await shot('day');
  const t = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    S.wave = 19; planWave(); startWave(); await wait(5000);
    // frame timing over two seconds
    let n = 0, t0 = performance.now(); await new Promise(res => { const f = () => { n++; performance.now() - t0 < 2000 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); });
    const fps = n / ((performance.now() - t0) / 1000), info = R3D.info();
    return { fps: Math.round(fps), info };
  });
  await shot('wave');
  await p.evaluate(async () => { R3.distT = 13; R3.yawT = .5; await new Promise(r => setTimeout(r, 1200)); });
  await shot('close');
  await p.evaluate(async () => { R3.distT = 24; R3.yawT = 0; goTab('works'); await new Promise(r => setTimeout(r, 1200)); });
  await shot('sheet');
  await p.evaluate(async () => { closeSheet(); for (const t of S.towers) if (t.c > 0) { sel = { t }; break; } refresh(); await new Promise(r => setTimeout(r, 800)); });
  await shot('card');
  await p.evaluate(async () => { sel = null; setGx('view', '2d'); refresh(); await new Promise(r => setTimeout(r, 800)); });
  await shot('2d');
  console.log(town, JSON.stringify(t), errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
  await b.close(); srv.close(); process.exit(0);
})();
