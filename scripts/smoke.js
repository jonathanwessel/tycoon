// Smoke test: node scripts/smoke.js [screenshot-dir]
// Loads the game at phone and desktop widths, plays through a boss wave, taps everything, checks the
// vault, weather, pause, hold, badges, settings, the 3D view and the empire, and fails on console errors or
// sideways scrolling. Uses Playwright if it is installed, otherwise an installed Edge or Chrome (scripts/cdp.js).
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('./cdp'); } })();
const path = require('path');
let URL; // served over http: the 3D view is an ES module, which browsers do not load from file:// pages
const shots = process.argv[2];

(async () => {
  const srv = await require('./serve').start(0); URL = srv.url;
  const b = await chromium.launch();
  let failed = false;
  for (const [name, vw, vh] of [['phone', 400, 900], ['land', 860, 400], ['desk', 1200, 800]]) {
    const p = await b.newPage({ viewport: { width: vw, height: vh } });
    { const ev0 = p.evaluate.bind(p); let n = 0; p.evaluate = (...a) => { n++; if (process.env.TRACE) console.log(name, 'step', n, String(a[0]).replace(/s+/g, ' ').slice(0, 90)); return ev0(...a); }; } // TRACE=1 names each step
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await p.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
    await p.goto(URL);
    // the 3D view starts once its module has loaded
    // the title screen comes first: the town flies by behind it, no raiders move, and a new game offers the tutorial
    const title = await p.evaluate(async () => { for (let i = 0; i < 60 && !R3.on; i++) await new Promise(r => setTimeout(r, 100)); PERF.noAuto = true; S.opt.calm = 'full'; applyMotion(); // headless browsers ask for reduced motion, which holds the flyover still
      await new Promise(r => setTimeout(r, 400)); const cd = W.countdown, e0 = R3.cam && R3.cam.eye.slice(); await new Promise(r => setTimeout(r, 900)); const e1 = R3.cam && R3.cam.eye;
      return { shown: TITLE.on && !document.getElementById('title').hidden && document.body.classList.contains('titling'), label: document.getElementById('tGo').textContent,
        flying: !!(e0 && e1 && Math.hypot(e1[0] - e0[0], e1[1] - e0[1], e1[2] - e0[2]) > .05), held: W.countdown === cd, tutWaits: document.getElementById('modal').hidden,
        music: MUSIC.want === 'title', navHidden: getComputedStyle(document.getElementById('tabs')).display === 'none' };
    });
    for (const k in title) if (!title[k]) errs.push('title screen check failed: ' + k + ' ' + JSON.stringify(title));
    if (shots) await p.screenshot({ path: path.join(shots, name + '-title.png') });
    await p.click('#tGo');
    const on3d = await p.evaluate(async () => { await new Promise(r => setTimeout(r, 1000));
      window.__music = { closed: !TITLE.on && document.getElementById('title').hidden !== undefined && !document.body.classList.contains('titling'), want: MUSIC.want === 'town', ctx: !!MUSIC.ctx, running: MUSIC.ctx && MUSIC.ctx.state, bars: MUSIC.bars };
      const offered = !document.getElementById('modal').hidden && /tutorial/i.test(document.getElementById('modal').textContent); if (offered) { document.getElementById('modal').hidden = true; S.tut = 'done'; } window.__offered = offered; return R3.on; });
    if (!(await p.evaluate(() => window.__offered))) errs.push('a new game did not offer the tutorial');
    { const m = await p.evaluate(() => window.__music); if (!m.closed || !m.want || !m.ctx) errs.push('leaving the title: ' + JSON.stringify(m)); else if (m.running === 'running' && !(m.bars > 0)) errs.push('music did not play: ' + JSON.stringify(m)); }
    if (!on3d) { console.log(name, 'FAIL: the 3D view did not start'); failed = true; await p.close(); continue; }
    // the map layer and the 3D canvas match the screen
    if (!(await p.evaluate(() => Math.abs(cv.width - Math.round(cv.clientWidth * renderScale())) <= 2 && Math.abs(cv.height - Math.round(cv.clientHeight * renderScale())) <= 2 && R3.canvas.width === cv.width && cell > 0))) errs.push('map render size does not match the map on screen');
    const r = await p.evaluate(() => {
      // measured on every tap: the layout can still settle after load (landscape phones especially)
      const at = (c, r) => { r3Camera(); const rect = cv.getBoundingClientRect(), [px, py] = r3Project(c + .5, r < YARD ? .22 : 0, r + .5), k = rect.width / R3.canvas.width; return { clientX: rect.left + px * k, clientY: rect.top + py * k, bubbles: true, pointerId: 1 }; };
      window.tap = (c, r) => document.getElementById('cv').dispatchEvent(new MouseEvent('click', at(c, r)));
      const cvEl = document.getElementById('cv');
      cvEl.dispatchEvent(new PointerEvent('pointerdown', at(.6, .8))); cvEl.dispatchEvent(new PointerEvent('pointerup', at(.6, .8)));
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
      foes = []; W.queue = []; clouds = []; tars = []; for (const t of S.towers) t.cd = 1e9; // towers hold fire so the phases can be checked
      spawn('boss'); const boss = foes[foes.length - 1];
      hurt(boss, boss.max * .55); combat(.05); const ph1 = !!boss.ph1 && foes.filter(f => f.type === 'brute').length >= 2;
      hurt(boss, boss.max * .25); combat(.05); const rage = !!boss.rage; const b0 = S.stats.bosses; hurt(boss, boss.max); const bossPaid = S.stats.bosses === b0 + 1; for (const t of S.towers) t.cd = 0;
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
      const sized = () => Math.abs(cv.width - Math.round(cv.clientWidth * renderScale())) <= 2 && R3.canvas.width === cv.width;
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
      // on a phone the same button hides the interface (the town already fills the screen); beside docked menus it grows the map
      const full = docked() ? document.body.classList.contains('mapfull') && fr.width >= mw0 && ctl.bottom <= innerHeight + 1 && ctl.top >= fr.bottom - 1
        : document.body.classList.contains('mapfull') && ctl.height === 0 && $('bFull').getBoundingClientRect().height > 0;
      setMapFull(false); await wait(200);
      return { badges, got, calm, held, frozen, resumed, menu, foreman, full, gfx, coal };
    });
    if (ui.badges < 18) errs.push('expected 18 badges, got ' + ui.badges);
    if (!ui.got) errs.push('no badges earned after a war wagon');
    for (const k of ['calm', 'held', 'frozen', 'resumed', 'menu', 'foreman', 'full', 'gfx', 'coal']) if (!ui[k]) errs.push('settings/controls check failed: ' + k);
    // lights: a wave at dusk gathers lamps and fires, and the 3D frame draws without WebGL errors
    const lit = await p.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms)); setGx('preset', 'high');
      S.wave = 9; planWave(); startWave(); await wait(600); const lights = gatherLights(5).length, err = R3D.info().err; foes = []; W.queue = [];
      return { lights, err };
    });
    if (!(lit.lights > 0)) errs.push('no lights gathered'); if (lit.err) errs.push('WebGL error ' + lit.err);
    // poison and tar: a Still makes clouds, Frostbite chills and hurts, the Tar Pit pours on the road
    const tox = await p.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      S.coins = 1e9; S.best = Math.max(S.best, 10); for (const k in S.res) add(k, 5000);
      S.towers = []; foes = []; W.queue = []; W.active = false;
      buildTower('still', PLOTS[0].x, PLOTS[0].y); buildTower('frost', PLOTS[1].x, PLOTS[1].y);
      const fr = S.towers[1]; for (let k = 0; k < 4; k++) upgradeTower(fr); branchTower(fr, 'c');
      S.wave = 12; planWave(); startWave(); let seen = false; for (let i = 0; i < 60 && !seen; i++) { await wait(200); seen = clouds.length > 0 || foes.some(f => f.psn); }
      useAbility('tar'); await wait(400);
      const r = { cloud: seen, tar: tars.length > 0, frostbite: fr.br === 'c', btn: !document.getElementById('ab-tar').hidden };
      foes = []; W.queue = []; W.active = false; return r;
    });
    for (const k in tox) if (!tox[k]) errs.push('poison/tar check failed: ' + k);
    // selling a tower takes two taps; a boss shows its health bar in the interface
    const sellx = await p.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms)); S.coins = 1e9; for (const k in S.res) add(k, 5000);
      const pl = PLOTS.find(q => !S.towers.some(t => t.c === q.x && t.r === q.y)); buildTower('crossbow', pl.x, pl.y); const t = S.towers[S.towers.length - 1];
      sel = { t }; refresh(); await wait(100); const btn = [...document.querySelectorAll('#card button')].find(b => /^Sell/.test(b.textContent));
      btn.click(); await wait(50); const kept = S.towers.includes(t); btn.click(); await wait(50); const sold = !S.towers.includes(t);
      foes = []; W.queue = []; spawn('boss'); await wait(300); const bar = !document.getElementById('bossbar').hidden && document.getElementById('bossbar').getBoundingClientRect().height > 10;
      // the boss rides in: its own banner, cinema bars and the camera leaning toward it (all off with calm motion)
      const enter = document.getElementById('banA').textContent === bossName() && document.getElementById('banner').classList.contains('enter');
      const cine = REDUCED || document.body.classList.contains('cine'), cam = REDUCED || R3.bk > .05;
      foes = []; await wait(200); const gone = document.getElementById('bossbar').hidden;
      // a first build stands in scaffolding, which comes down again; coins burst out to the counter
      const bb = BUILD.find(b => !blv(b.def.id) && SLOT[b.def.id]); let scaf = true, down = true;
      if (bb && R3.on) { buyBuilding(bb); await wait(250); const o = R3D.V.scaf && R3D.V.scaf[bb.def.id]; scaf = !!(o && o.visible); await wait(1400); down = !(o && o.visible); }
      coinBurst(5, 8, 8, 1000); await wait(120); const burst = REDUCED || !R3.on || document.querySelectorAll('img.fly').length >= 4;
      return { kept, sold, bar, gone, enter, cine, cam, scaf, down, burst };
    });
    for (const k in sellx) if (!sellx[k]) errs.push((k === 'kept' ? 'sell needs two taps' : k === 'sold' ? 'second tap did not sell' : k === 'bar' || k === 'gone' ? 'boss bar: ' + k : 'juice: ' + k) + ' failed');
    // the tutorial: every step can be done and it finishes with its reward; the Capital panel opens once founded
    const tut = await p.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms)), at = []; foes = []; W.queue = []; W.active = false; S.towers = []; sel = null; S.wave = 1; S.ext.camp = 0; S.stats.taps = 0; R3.panXT = R3.panZT = 0; R3.yawT = 0; R3.distT = 24; S.mgr = {}; if (SHEET.open) closeSheet(); tab = 'defend'; // no foremen building things on their own
      tutStart(); await wait(100); const c0 = S.stats.coins; // lifetime earnings: the reward shows there whatever else is spent
      const acts = [() => { S.stats.taps = 5; }, () => { S.ext.camp = 1; }, () => { sel = { plot: [PLOTS[0].x, PLOTS[0].y] }; }, () => { buildTower('crossbow', PLOTS[0].x, PLOTS[0].y); }, () => { startWave(); },
        () => { S.towers[0].lvl = 1; }, () => { goTab('works'); }, () => { S.ext.camp = 2; }, () => { goTab('missions'); }, () => { R3.panXT = 1; }];
      for (const a of acts) { at.push(S.tut); a(); await wait(250); }
      const r = { done: S.tut === 'done', steps: at.join(','), paid: S.stats.coins >= c0 + TUT_REWARD - 1e-6, hidden: document.querySelector('.tut').hidden };
      foes = []; W.queue = []; W.active = false; if (SHEET.open) closeSheet();
      return r;
    });
    if (!tut.done || !tut.paid || !tut.hidden || !tut.steps.split(',').every((v, i, a) => !i || +v >= +a[i - 1])) errs.push('tutorial check failed: ' + JSON.stringify(tut));
    // phone layout: tabs open a sheet over the town; the same tab, a map tap, Back and the close button shut it; a card replaces it
    const lay = await p.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms)), open = () => document.body.classList.contains('sheet-open');
      if (docked()) { goTab('works'); await wait(100); const panel = $('panel').childElementCount > 0; $('bMis').click(); await wait(150); const missions = $('panel').querySelectorAll('.goal').length >= 1; goTab('defend'); return { panel, missions }; }
      const r = {}; goTab('works'); await wait(350); r.opens = open() && $('sheet').getBoundingClientRect().top < innerHeight - 200;
      goTab('works'); await wait(100); r.sameTab = !open();
      goTab('market'); await wait(100); cv.dispatchEvent(new MouseEvent('click', { clientX: innerWidth / 2, clientY: innerHeight / 3, bubbles: true })); await wait(100); r.mapTap = !open() && !sel;
      for (let i = 0; i < 20 && SHEET.backing; i++) await wait(50); goTab('empire'); await wait(150); history.back(); await wait(300); r.back = !open();
      goTab('research'); await wait(100); $('sheetX').click(); await wait(100); r.closeBtn = !open();
      goTab('works'); await wait(100); sel = { vault: 1 }; refresh(); await wait(100); r.card = !open() && !$('card').hidden; sel = null; refresh();
      $('bMis').click(); await wait(200); r.missions = open() && $('sheetTitle').textContent === 'Missions' && $('panel').querySelectorAll('.goal').length >= 1; closeSheet(); await wait(100);
      r.noScroll = document.documentElement.scrollWidth <= innerWidth + 1;
      return r;
    });
    for (const k in lay) if (!lay[k]) errs.push('layout check failed: ' + k);
    // the market: reputation, orders counting down, a boom in the news and on its good, the auto-sell mode button
    const mk = await p.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms)), r = {}, led = S.research.ledger, ev = S.mkt.ev, auto = S.auto.wood, rep = S.rep;
      S.research.ledger = 1; S.mkt.ev = { wood: { m: 1.6, t: 200, T: 200 } }; S.auto.wood = false; goTab('market'); await wait(400);
      const pn = $('panel'), txt = pn.textContent; r.rep = !!pn.querySelector('.rep') && txt.includes('Reputation');
      r.orders = pn.querySelectorAll('.row.order').length === S.contracts.length && S.contracts.length >= 3 && txt.includes('leaves in');
      r.news = txt.includes('Timber boom') && !!pn.querySelector('.mrow .mtag.boom'); r.tag = [...pn.querySelectorAll('.row .name .mtag.boom')].some(t => !t.hidden);
      const t0 = S.contracts[0].t; ordersTick(1); r.ticks = S.contracts[0].t < t0;
      const b = [...pn.querySelectorAll('.amode')].find(x => x.closest('.row').textContent.includes('Timber'));
      b.click(); refresh(); await wait(50); r.mode = S.auto.wood === true && b.textContent === 'Auto: always'; b.click(); refresh(); r.mode2 = S.auto.wood === 'bust' && b.textContent === 'Auto: skip busts';
      const r0 = S.rep; swapOrder(0); r.swap = S.rep === r0 - 1;
      S.research.ledger = led; S.mkt.ev = ev; S.auto.wood = auto; S.rep = rep; if (SHEET.open) closeSheet(); await wait(100);
      return r;
    });
    for (const k in mk) if (!mk[k]) errs.push('market check failed: ' + k + ' ' + JSON.stringify(mk));
    // the 3D view: renders frames without GL errors, and a tap on a projected cell picks that cell
    const v3 = await p.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      for (let i = 0; i < 40 && !window.R3D; i++) await wait(100); // the 3D engine module loads after the game
      if (!R3.on) return { on: false };
      await wait(300); const st = document.querySelector('.stage').getBoundingClientRect(), gr = R3.canvas.getBoundingClientRect(), fills = docked() || (Math.abs(gr.width - st.width) < 2 && Math.abs(gr.height - st.height) < 2);
      S.wave = 9; planWave(); startWave(); await wait(800);
      const err = R3D.info().err, built = R3D.prebuild(), r = cv.getBoundingClientRect(), [px, py] = r3Project(5.5, .1, 10.5), s = cv.clientWidth / R3.canvas.width;
      const g = r3Pick({ clientX: r.left + cv.clientLeft + px * s, clientY: r.top + cv.clientTop + py * s });
      foes = []; W.queue = []; W.active = false;
      return { on: true, err, fills, pick: [Math.floor(g[0]), Math.floor(g[1])], models: built.n, bad: built.bad };
    });
    if (!v3.on) console.log(name, 'warning: no WebGL2 in this browser, 3D view not tested');
    else if (v3.err || v3.pick[0] !== 5 || v3.pick[1] !== 10 || v3.models < 90 || v3.bad.length || !v3.fills) errs.push('3D check failed: ' + JSON.stringify(v3));
    // the empire: open Iron Ridge, play a wave there with its boss, ship goods, look at the Empire tab, come home
    const emp = await p.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      S.coins = 1e9; S.best = Math.max(S.best, 25); const opened = unlockTown('ridge');
      goTab('empire'); await wait(250); const cards = document.querySelectorAll('.town').length, sugg = document.querySelectorAll('.sugs .row').length;
      const shipBtn = document.querySelector('.sugs button'); if (shipBtn) shipBtn.click();
      goTown('ridge'); await wait(300);
      const inRidge = TOWN_ID === 'ridge' && document.querySelector('h1').textContent === 'Iron Ridge';
      for (const k in S.res) add(k, 500); buildTower('crossbow', PLOTS[0].x, PLOTS[0].y); buildTower('cannon', PLOTS[1].x, PLOTS[1].y);
      S.wave = 10; planWave(); startWave(); await wait(800); W.queue = []; spawn('boss'); await wait(800);
      const trainBar = !!foes.find(f => f.type === 'boss'); foes = []; W.queue = []; W.active = false;
      goTab('works'); await wait(200); const ridgeRows = document.querySelectorAll('.row.bld').length;
      // Silver Falls: open from Iron Ridge, boats and the ironclad on the river, the power grid in the Works tab
      S.best = Math.max(S.best, 16); goTown('gulch'); await wait(200); const fallsOpen = unlockTown('falls'); goTown('falls'); await wait(300);
      for (const k in S.res) add(k, 500); buildTower('crossbow', PLOTS[0].x, PLOTS[0].y);
      S.wave = 10; planWave(); startWave(); W.queue = []; spawn('boat'); spawn('boss'); await wait(700);
      const river = foes.length === 2 && foes.every(f => f.p === MAP.river); foes = []; W.active = false;
      goTab('works'); await wait(200); const powerPanel = !!document.querySelector('.power');
      goTown('gulch'); await wait(300);
      return { opened, cards, sugg, routes: S.routes.length, inRidge, trainBar, ridgeRows, fallsOpen, river, powerPanel, home: TOWN_ID === 'gulch' };
    });
    if (!emp.opened || emp.cards < 3 || !emp.inRidge || !emp.trainBar || emp.ridgeRows !== 7 || !emp.fallsOpen || !emp.river || !emp.powerPanel || !emp.home || emp.routes < 1) errs.push('empire check failed: ' + JSON.stringify(emp));
    const cap = await p.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms)); S.coins = 1e12; S.best = Math.max(S.best, 40);
      if (!townOpen('ridge')) unlockTown('ridge'); if (S.towns.ridge) S.towns.ridge.best = Math.max(30, S.towns.ridge.best); if (!townOpen('falls')) unlockTown('falls'); if (S.towns.falls) S.towns.falls.best = Math.max(20, S.towns.falls.best); S.coins = 1e12;
      const r = { capital: openCapital() }; refresh(); goTab('capital'); await wait(200);
      r.panel = document.getElementById('panel').textContent.includes('Capitol'); r.button = !document.getElementById('bCap').hidden; r.inst = buyInst('market'); S.capital.inf = 1e4; goTab('tech'); await wait(200); r.tree = document.getElementById('panel').textContent.includes('Influence') && document.querySelectorAll('.row.tech').length >= 5; r.node = buyTech('arms');
      // the Capital as a place: the side button visits it, a tap on a building (projected from its roof) opens its card, the card builds, the button comes home
      document.getElementById('bCap').click(); await wait(500);
      r.visit = CAPV.on && document.querySelector('h1').textContent === 'The Capital' && getComputedStyle(document.getElementById('bLeave')).display !== 'none' && getComputedStyle(document.getElementById('bWave')).display === 'none';
      const tapSite = id => { r3Camera(); const q = CAP_SITE[id], rect = cv.getBoundingClientRect(), [px, py] = r3Project(q.x, q.h * .8, q.z), k = rect.width / R3.canvas.width; cv.dispatchEvent(new MouseEvent('click', { clientX: rect.left + px * k, clientY: rect.top + py * k, bubbles: true })); };
      tapSite('bank'); await wait(300); r.siteTap = !!(sel && sel.site === 'bank') && /Central Bank/.test(document.getElementById('card').textContent) && !!R3D.V.capB && Object.keys(R3D.V.capB).length === 7;
      const l0 = capLv('bank'), bb = [...document.querySelectorAll('#card button')].find(b => /^(Build|Upgrade)/.test(b.textContent)); if (bb) bb.click(); await wait(300); r.siteBuild = capLv('bank') === l0 + 1;
      tapSite('capitol'); await wait(300); r.capitolCard = /Budget and waves/.test(document.getElementById('card').textContent);
      r.capErr = !R3D.info().err; sel = null; document.getElementById('bLeave').click(); await wait(300); r.leave = !CAPV.on && document.querySelector('h1').textContent === TOWN.n && !document.body.classList.contains('incap');
      r.exch = buyInst('exchange'); for (let i = 0; i < 3; i++) econTowns(10); goTab('exchange'); await wait(200); r.stocks = document.querySelectorAll('.stk canvas').length >= 3; r.trade = exBuy('gulch', 10) === 10 && exSell('gulch', 5) === 5;
      // Thunder Mesa: opened from the Capital (Department of Transport level 5); the airship flies the sky lane
      goTab('empire'); await wait(200); r.mesaCard = document.getElementById('panel').textContent.includes('Department of Transport reaches level 5');
      S.capital.lv.transport = 5; S.coins = 1e12; r.mesaOpen = unlockTown('mesa'); goTown('mesa'); await wait(300);
      r.inMesa = TOWN_ID === 'mesa' && document.querySelector('h1').textContent === 'Thunder Mesa';
      for (const k in S.res) add(k, 500); r.mesaTesla = buildTower('tesla', PLOTS[0].x, PLOTS[0].y);
      S.wave = 10; planWave(); startWave(); W.queue = []; spawn('boss'); await wait(900);
      r.airship = foes.some(f => f.air && f.p === MAP.air) && !!(R3D.V.foes && [...R3D.V.foes.values()].some(v => v.kind === 'zeppelin')); foes = []; W.active = false;
      goTab('works'); await wait(200); r.mesaRows = document.querySelectorAll('.row.bld').length === 8; goTown('gulch'); await wait(300); r.mesaHome = TOWN_ID === 'gulch';
      // policies in the Capitol (two taps adopt one), then the Convention sheet and a Convention held from it
      goTab('capital'); await wait(200); r.policies = document.querySelectorAll('.row.pol').length === 6; const adopt = document.querySelector('.row.pol button'); adopt.click(); adopt.click(); await wait(100); r.policy = pol('econ') === 'free';
      goTab('convention'); await wait(200); r.convSheet = document.getElementById('panel').textContent.includes('Legacy perks');
      S.stats.coins = Math.max(S.stats.coins, 1e12); refresh(); const hold = [...document.querySelectorAll('#panel button')].find(b => b.textContent.includes('Hold the Convention')); r.convReady = !!hold && !hold.disabled;
      if (hold) { hold.click(); hold.click(); } await wait(400); r.convened = legacyPts() > 0 && !capOpen() && townIds().length === 1 && TOWN_ID === 'gulch' && S.stats.conventions === 1;
      S.coins = 1e6; for (let i = 0; i < 3; i++) econTowns(1); refresh(); await wait(300);
      if (SHEET.open) closeSheet(); return r;
    });
    for (const k in cap) if (!cap[k]) errs.push('Capital check failed: ' + k);
    // the title screen again from Settings: a new game goes into a free slot, then slot 1 comes back from the title;
    // Settings, Saves: a code made and read back, loaded into slot 3, then the waiting slots erased
    const tt = await p.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms)), r = {}, leg = legacyPts();
      openSettings('game'); await wait(100); document.getElementById('setTitle').click(); await wait(300);
      r.back = TITLE.on && document.getElementById('tGo').textContent.startsWith('Continue') && !!document.getElementById('tNew');
      document.getElementById('tNew').click(); await wait(1100);
      r.fresh = !TITLE.on && S.wave === 1 && legacyPts() === 0 && slotOn() === 2 && slotInfo(1).legacy === leg; r.tut = !document.getElementById('modal').hidden && /tutorial/i.test(document.getElementById('modal').textContent);
      document.getElementById('modal').hidden = true; S.tut = 'done';
      showTitle(kind => { r.kind = kind; }); await wait(300); r.slotBtn = !!document.getElementById('tSlot1'); document.getElementById('tSlot1').click(); await wait(500);
      r.swapped = r.kind === 'swap' && legacyPts() === leg && leg > 0 && !TITLE.on && slotOn() === 1 && slotInfo(2).wave === 1;
      openSettings('saves'); await wait(150); r.rows = document.querySelectorAll('#modal .slotrow').length === 3;
      document.getElementById('saveIn').value = await saveCode(slotSave(1)); document.getElementById('svRead').click(); await wait(300);
      const pend = document.getElementById('svPend'); r.pend = !!pend && pend.textContent.includes('wave ' + S.wave);
      document.getElementById('svInto3').click(); await wait(200); r.into3 = !slotInfo(3).empty && slotInfo(3).wave === S.wave && slotOn() === 1;
      for (const n of [3, 2]) { const e = document.getElementById('svErase' + n); e.click(); e.click(); await wait(150); } r.erased = slotInfo(2).empty && slotInfo(3).empty && slotOn() === 1;
      closeSettings(); r.music = musicVol() > 0; return r;
    });
    for (const k in tt) if (!tt[k]) errs.push('title round trip failed: ' + k + ' ' + JSON.stringify(tt));
    // a controller (a scripted stand-in for the Gamepad API): wake the cursor, walk it to a plot and pick it, use the
    // card, the menu sheet, pause and Settings, then a touch hides it again
    const pd = await p.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms)), r = {}, B = () => Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
      const pad = { id: 'Test pad', connected: true, axes: [0, 0, 0, 0], buttons: B() }; let t = performance.now();
      const frame = keys => { pad.buttons = B(); for (const k of keys || []) pad.buttons[PAD_BTN[k]] = { pressed: true, value: 1 }; t += 16; padFrame(pad, t); };
      const press = async k => { frame([k]); frame(); await wait(60); };
      if (SHEET.open) closeSheet(); sel = null; R3.yaw = R3.yawT = 0; refresh(); await wait(100);
      await press('a'); r.woke = PAD.show && document.body.classList.contains('pad') && !sel;
      const pl = PLOTS.find(q => !S.towers.some(w => w.c === q.x && w.r === q.y));
      for (let i = 0; i < 40 && (PAD.cur[0] !== pl.x || PAD.cur[1] !== pl.y); i++) await press(PAD.cur[0] < pl.x ? 'right' : PAD.cur[0] > pl.x ? 'left' : PAD.cur[1] < pl.y ? 'down' : 'up');
      r.walked = PAD.cur[0] === pl.x && PAD.cur[1] === pl.y; await wait(100); r.marker = !!(R3D.V.pad && R3D.V.pad.visible);
      await press('a'); await wait(150); frame(); await wait(50);
      r.card = !!(sel && sel.plot) && !document.getElementById('card').hidden && PAD.layer === 'card' && document.getElementById('card').contains(document.activeElement);
      await press('b'); r.unsel = !sel;
      const tab0 = tab; await press('y'); await wait(100); r.sheet = docked() ? PAD.inSheet : SHEET.open;
      await press('rb'); await wait(150); frame(); await wait(50); r.tab = tab !== tab0 && document.getElementById('sheet').contains(document.activeElement);
      await press('b'); await wait(150); r.sheetShut = docked() ? !PAD.inSheet : !SHEET.open;
      await press('start'); r.paused = paused; await press('a'); r.resumed = !paused;
      await press('back'); await wait(100); r.settings = !document.getElementById('modal').hidden; frame(); await press('right');
      r.setFocus = document.getElementById('modal').contains(document.activeElement); await press('b'); await wait(100); r.setShut = document.getElementById('modal').hidden;
      document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await wait(50); r.hid = !PAD.show && !document.body.classList.contains('pad');
      await wait(100); r.markerHid = !R3D.V.pad.visible; return r;
    });
    for (const k in pd) if (!pd[k]) errs.push('controller check failed: ' + k + ' ' + JSON.stringify(pd));
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
