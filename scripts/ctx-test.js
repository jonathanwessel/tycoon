// node scripts/ctx-test.js [out.png]  — the device takes the 3D view's graphics context away: the game must save, reload straight back in
// (no title screen) and show the 3D view again with the same save. Prints ok or FAIL.
process.chdir(require('path').join(__dirname, '..'));
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('./cdp'); } })();
(async () => {
  const srv = await require('./serve').start(0), b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await p.addInitScript(() => { try { if (!sessionStorage.x) { localStorage.clear(); sessionStorage.x = 1; } } catch (e) {} });
  await p.goto(srv.url); await p.waitForTimeout(3000);
  await p.evaluate(() => { closeTitle('continue'); document.getElementById('modal').hidden = true; S.tut = 'done'; S.coins = 12345678; buildTower('crossbow', PLOTS[0].x, PLOTS[0].y); save(); });
  await p.waitForTimeout(1500);
  const before = await p.evaluate(() => ({ on: R3.on, mark: (window.__mark = 'old') }));
  // lose it, as a phone would, and keep it lost (no restore): the timeout path
  await p.evaluate(() => { const c = document.getElementById('g3'); window.__ext = c.getContext('webgl2').getExtension('WEBGL_lose_context'); window.__ext.loseContext(); });
  await p.waitForTimeout(800);
  const lost = await p.evaluate(() => ({ on: R3.on, loading: !document.getElementById('loading3d').hidden, mark: window.__mark }));
  await p.waitForTimeout(6000);
  const after = await p.evaluate(() => ({ on: R3.on, mark: window.__mark || 'reloaded', title: typeof TITLE !== 'undefined' && !!TITLE.on, coins: Math.round(S.coins), towers: S.towers.length, loading: !document.getElementById('loading3d').hidden }));
  if (process.argv[2]) await p.screenshot({ path: process.argv[2] });
  const ok = before.on && !lost.on && after.on && after.mark === 'reloaded' && !after.title && after.coins > 12e6 && after.towers === 1 && !after.loading && !errs.length;
  console.log(ok ? 'ok' : 'FAIL', JSON.stringify({ before, lost, after }), errs.join(' | '));
  await b.close(); srv.close(); process.exit(ok ? 0 : 1);
})();
