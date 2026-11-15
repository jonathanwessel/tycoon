// Smoke test: node scripts/smoke.js [screenshot-dir]
// Loads the game at phone and desktop widths, plays through a boss wave, taps everything, checks the
// vault, weather, pause, hold, badges, settings and the bridge map, and fails on console errors or
// sideways scrolling. Uses Playwright if it is installed, otherwise an installed Edge or Chrome (scripts/cdp.js).
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('./cdp'); } })();
const path = require('path');
const URL = require('url').pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
const shots = process.argv[2];

(async () => {
  const b = await chromium.launch();
  let failed = false;
  for (const [name, vw, vh] of [['phone', 400, 900], ['desk', 1200, 800]]) {
    const p = await b.newPage({ viewport: { width: vw, height: vh } });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await p.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
    await p.goto(URL);
    await p.waitForTimeout(500);
    // the map's render must match its size on screen
    if (!(await p.evaluate(() => Math.abs(cv.width - Math.round(cv.clientWidth * renderScale())) <= 2 && cell > 0 && Math.abs(cell * COLS - cv.width) < 1))) errs.push('map render size does not match the map on screen');
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
      // war wagon phases
      foes = []; W.queue = []; spawn('boss'); const boss = foes[foes.length - 1];
      hurt(boss, boss.max * .55); combat(.05); const ph1 = !!boss.ph1 && foes.filter(f => f.type === 'brute').length >= 2;
      hurt(boss, boss.max * .25); combat(.05); const rage = !!boss.rage; const b0 = S.stats.bosses; hurt(boss, boss.max); const bossPaid = S.stats.bosses === b0 + 1;
      foes = []; W.queue = []; combat(.05);
      // a war wagon that reaches the vault smashes it whatever its strength, and the wave is lost
      S.research.vault = 20; S.vaultHp = vaultMax(); S.wave = 20; planWave(); startWave(); W.queue = []; spawn('boss');
      const wag = foes[foes.length - 1]; wag.d = PATHS[wag.p].len - .01; combat(.05);
      const smashed = S.wave === 18 && S.vaultHp === vaultMax() && !W.active && (S.stats.smashed || 0) >= 1;
      foes = []; W.queue = []; S.research.vault = 0; S.vaultHp = vaultMax();
      // weather changes tower reach
      const t0 = S.towers.find(t => t.type === 'crossbow'), r0 = towerStats(t0).range; S.wave = 13; planWave(); W.nweather = 'dust'; startWave();
      const dust = towerStats(t0).range < r0; foes = []; W.queue = []; combat(.05);
      // the vault: repairs only between waves
      S.vaultHp = 3; W.active = true; const refused = !repair(1); W.active = false; foes = []; W.queue = [];
      tap(VAULT[0], VAULT[1]); refresh(); const vaultCard = /The vault/.test(document.getElementById('card').textContent);
      const repaired = repair(2) && S.vaultHp === 5;
      return { otOn, bombThrown, towers: S.towers.length, branched: S.towers.filter(t => t.br).length, wave: S.wave, tapped, kills: S.stats.kills, priceAfterSell: +dem('wood').toFixed(3),
        foremanBought: S.ext.camp, ph1, rage, bossPaid, smashed, dust, refused, vaultCard, repaired };
    });
    const want = { otOn: 'overtime did not start', bombThrown: 'dynamite did not fire', tapped: 'holding the trees gathered nothing', ph1: 'war wagon did not drop brutes at half health',
      rage: 'war wagon did not reach full steam', bossPaid: 'war wagon did not pay out', smashed: 'a war wagon reaching a full 120-strength vault did not smash it', dust: 'dust storm did not shorten tower reach', refused: 'vault repair was allowed during a wave',
      vaultCard: 'tapping the vault did not open its card', repaired: 'vault repair did not add strength' };
    for (const k in want) if (!r[k]) errs.push(want[k]);
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
    // badges, settings, hold, pause, speed menu
    const ui = await p.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      goTab('charter'); const badges = document.querySelectorAll('.badge').length, got = document.querySelectorAll('.badge.got').length;
      openSettings('game');
      const calmBtn = [...document.querySelectorAll('.setrow button')].find(b => b.textContent === 'Calm'); calmBtn.click(); const calm = document.documentElement.classList.contains('calm');
      [...document.querySelectorAll('.setrow button')].find(b => b.textContent === 'Like my device').click();
      // graphics: every preset and every look applies without errors, and the panel buttons drive the settings
      openSettings('gfx'); const btn = t => [...document.querySelectorAll('.setrow button')].find(b => b.textContent === t);
      let gfx = true;
      // each preset must also size the render to the map (catches a map drawn at the wrong scale, which throws no error)
      const sized = () => Math.abs(cv.width - Math.round(cv.clientWidth * renderScale())) <= 2 && (!GLX.on || GLX.canvas.width === cv.width);
      for (const [label, key] of [['Low', 'low'], ['Medium', 'med'], ['Ultra', 'ultra'], ['High', 'high']]) { btn(label).click(); await wait(150); if (GX().preset !== key || !sized()) gfx = false; }
      for (const k in LOOKS) { btn(LOOKS[k].n).click(); await wait(120); if (GX().look !== k) gfx = false; }
      btn('Natural').click(); btn('Soft').click(); if (GX().preset !== 'custom') gfx = false; btn('High').click();
      btn('Battery 30').click(); await wait(200); btn('Smooth 60').click();
      document.getElementById('modal').hidden = true; document.getElementById('modal').className = 'modal';
      // coal pit foreman
      S.ext.pit = Math.max(1, S.ext.pit || 0); delete S.mgr.pit; S.coins = 1e12; hire('pit'); const coal = S.mgr.pit === 1;
      document.getElementById('bHold').click(); const held = !S.autoWave; document.getElementById('bHold').click();
      document.getElementById('bPause').click(); const w0 = S.res.wood; await wait(400); const frozen = paused && S.res.wood === w0; document.getElementById('pauseCover').click(); const resumed = !paused;
      document.getElementById('bSpeed').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); const menu = !document.querySelector('.speedmenu').hidden;
      document.querySelector('.speedmenu button').click();
      goTab('works');
      // foremen: any built building, the third costs more than the first two
      S.ext.drill = 3; const firstTwo = Math.max(mgrCost('camp'), mgrCost('mine')); hire('mine'); const drillCost = mgrCost('drill'); hire('drill');
      const foreman = S.mgr.drill === 1 && drillCost > firstTwo;
      // full-screen map grows the map and keeps the controls
      const mw0 = document.querySelector('.mapwrap').getBoundingClientRect().width; setMapFull(true); await wait(300);
      const fr = document.querySelector('.mapwrap').getBoundingClientRect(), ctl = document.querySelector('.controls').getBoundingClientRect();
      const full = document.body.classList.contains('mapfull') && fr.width >= mw0 && ctl.bottom <= innerHeight + 1 && ctl.top >= fr.bottom - 1;
      setMapFull(false); await wait(200);
      return { badges, got, calm, held, frozen, resumed, menu, foreman, full, gfx, coal };
    });
    if (ui.badges < 18) errs.push('expected 18 badges, got ' + ui.badges);
    if (!ui.got) errs.push('no badges earned after a war wagon');
    for (const k of ['calm', 'held', 'frozen', 'resumed', 'menu', 'foreman', 'full', 'gfx', 'coal']) if (!ui[k]) errs.push('settings/controls check failed: ' + k);
    // the lighting engine: renders frames with lights, and simple mode still works (no WebGL here is a warning, not a failure)
    const lit = await p.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      GLX.noAuto = true; setGx('preset', 'high'); if (!GLX.on) return { on: false };
      S.wave = 9; planWave(); startWave(); await wait(600); const lights = GLX.nLights, glErr = GLX.gl.getError();
      setGx('light', 0); await wait(200); const simpleOk = !GLX.on; setGx('preset', 'high'); foes = []; W.queue = [];
      return { on: true, lights, glErr, simpleOk };
    });
    if (!lit.on) console.log(name, 'warning: no WebGL in this browser, lighting not tested');
    else { if (!(lit.lights > 0)) errs.push('lighting engine gathered no lights'); if (lit.glErr) errs.push('WebGL error ' + lit.glErr); if (!lit.simpleOk) errs.push('simple graphics did not switch off lighting'); }
    // the bridge map draws and keeps the ravine clear of plots
    const br = await p.evaluate(() => { setMap('bridge'); bakeGround(); const ok = !PLOTS.some(q => MAP.ravine.includes(q.x)); setMap(S.map); bakeGround(); return ok; });
    if (!br) errs.push('Trestle Bridge has plots in the ravine');
    await p.click('#tab-works');
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.body.scrollHeight > innerHeight + 1);
    const navVisible = await p.evaluate(() => { const r = document.getElementById('tabs').getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.height > 30; });
    if (!navVisible) errs.push('tab bar is off screen');
    if (overflow) errs.push('page scrolls outside the app shell');
    if (shots) await p.screenshot({ path: path.join(shots, name + '.png'), fullPage: true });
    console.log(name, JSON.stringify(Object.assign(r, ui)), errs.length ? 'FAIL ' + errs.join(' | ') : 'ok');
    if (errs.length) failed = true;
    await p.close();
  }
  await b.close();
  process.exit(failed ? 1 : 0);
})();
