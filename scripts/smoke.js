// Smoke test: node scripts/smoke.js [screenshot-dir]
// Loads the game at phone and desktop widths, plays through a boss wave,
// taps everything, and fails on console errors or sideways scrolling.
const { chromium } = require('playwright');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const shots = process.argv[2];

(async () => {
  const b = await chromium.launch();
  let failed = false;
  for (const [name, vw, vh] of [['phone', 400, 900], ['desk', 1200, 800]]) {
    const p = await b.newPage({ viewport: { width: vw, height: vh } });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await p.goto(URL);
    await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await p.reload();
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => {
      const rect = document.getElementById('cv').getBoundingClientRect();
      const at = (c, r) => ({ clientX: rect.left + (c + .5) * rect.width / COLS, clientY: rect.top + (r + .5) * rect.height / ROWS, bubbles: true });
      window.tap = (c, r) => document.getElementById('cv').dispatchEvent(new MouseEvent('click', at(c, r)));
      const cvEl = document.getElementById('cv');
      cvEl.dispatchEvent(new PointerEvent('pointerdown', at(0, 0))); cvEl.dispatchEvent(new PointerEvent('pointerup', at(0, 0)));
      const tapped = S.res.wood > 0;
      S.coins = 1e9; for (const k in S.res) add(k, 5000);
      for (const b of BUILD) S[b.kind][b.def.id] = 12;
      hire('camp');
      let i = 0;
      for (const t of Object.keys(TOWERS)) { buildTower(t, PLOTS[i].x, PLOTS[i].y); i++; }
      // take every tower through its branch, alternating paths
      S.towers.forEach((t, j) => { for (let k = 0; k < 4; k++) upgradeTower(t); branchTower(t, j % 2 ? 'b' : 'a'); upgradeTower(t); t.tg = ['first', 'strong', 'weak'][j % 3]; });
      tap(PLOTS[i].x, PLOTS[i].y); refresh(); const opt = document.querySelector('.buildopt'); if (opt) opt.click();
      useAbility('ot'); const otOn = S.ot > 0;
      // every raider type, then a boss wave
      for (const w of [8, 12, 15, 20]) { S.wave = w; planWave(); startWave(); for (let j = 0; j < 20 * 70; j++) { combat(.05); econ(.05); } }
      sell('wood', S.res.wood); deliver(0);
      S.wave = 9; planWave(); startWave(); for (let j = 0; j < 20 * 4; j++) combat(.05); spawn('brute'); spawn('brute'); useAbility('dyn'); const bombThrown = bombs.length === 1 || S.cd.dyn > 0;
      return { otOn, bombThrown, towers: S.towers.length, branched: S.towers.filter(t => t.br).length, wave: S.wave, tapped, kills: S.stats.kills, priceAfterSell: +dem('wood').toFixed(3), foremanBought: S.ext.camp };
    });
    if (!r.otOn) errs.push('overtime did not start');
    if (!r.bombThrown) errs.push('dynamite did not fire');
    if (!r.tapped) errs.push('holding the trees gathered nothing');
    if (r.branched < 5) errs.push('expected 5 branched towers, got ' + r.branched);
    if (!(r.priceAfterSell < 1)) errs.push('selling did not move the price');
    if (r.towers < 6) { errs.push('expected 6 towers, got ' + r.towers); }
    await p.waitForTimeout(800);
    // tap a building and a tower to open their cards
    await p.evaluate(() => { tap(4, 0); });
    await p.waitForTimeout(300);
    if (!(await p.evaluate(() => !!sel && !!sel.b))) errs.push('tapping a building did not select it');
    await p.evaluate(() => { tap(S.towers[0].c, S.towers[0].r); });
    await p.waitForTimeout(300);
    const cardOpen = await p.evaluate(() => !document.getElementById('card').hidden);
    if (!cardOpen) errs.push('building card did not open');
    for (const t of await p.$$eval('#tabs button', bs => bs.map(b => b.id))) { await p.click('#' + t); await p.waitForTimeout(200); }
    await p.click('#tab-works');
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.body.scrollHeight > innerHeight + 1);
    const navVisible = await p.evaluate(() => { const r = document.getElementById('tabs').getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.height > 30; });
    if (!navVisible) errs.push('tab bar is off screen');
    if (overflow) errs.push('page scrolls outside the app shell');
    if (shots) await p.screenshot({ path: path.join(shots, name + '.png'), fullPage: true });
    console.log(name, JSON.stringify(r), errs.length ? 'FAIL ' + errs.join(' | ') : 'ok');
    if (errs.length) failed = true;
    await p.close();
  }
  await b.close();
  process.exit(failed ? 1 : 0);
})();
