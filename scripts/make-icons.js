// node scripts/make-icons.js — renders the app icons from the game's own 3D engine into icons/: the vault at dusk with
// its lamps lit, a Tesla Coil and a crossbow guarding it, framed in copper. The maskable icon is the same scene full
// bleed (phones cut it to their own shape). Uses Playwright if installed, otherwise Edge or Chrome (scripts/cdp.js).
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('./cdp'); } })();
const fs = require('fs');
const path = require('path');
const out = path.resolve(__dirname, '..', 'icons');

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const srv = await require('./serve').start(0), b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 2 });
  await p.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await p.goto(srv.url); await p.waitForTimeout(1500);
  const icons = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 40 && !window.R3D; i++) await wait(100);
    // a lived-in town at dusk: buildings up, towers by the vault, lamps lit
    S.coins = 1e9; for (const k in S.res) add(k, 5000); BUILD.forEach((b, i) => { S[b.kind][b.def.id] = [12, 30, 60][i % 3]; });
    const [vx, vy] = VAULT; buildTower('tesla', vx - 1, vy - 2); buildTower('frost', vx + 1, vy - 2);
    for (const t of S.towers) { t.lvl = 6; t.born = 0; t.aim = Math.PI * .8; }
    S.opt.gx.look = 'natural'; setGx('preset', 'high'); for (let i = 0; i < 40 && !R3.on; i++) await wait(100); await wait(400);
    setPaused(true); FXS.night = .92; FXS.flash = 0; FXS.quake = 0; foes = []; floats = []; parts = []; FXS.banner = null;
    R3.look = [vx + .5, vy - .3]; R3.pitch = .58; R3.yaw = R3.yawT = -.35; R3.dist = R3.distT = 6.4;
    const shot = () => { R3.ux.canvas.hidden = true; r3Render(30); return R3.canvas; };
    const make = (n, framed) => {
      const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d');
      const src = shot(), s = Math.min(src.width, src.height), sx = (src.width - s) / 2, sy = (src.height - s) / 2;
      g.imageSmoothingQuality = 'high'; g.drawImage(src, sx, sy, s, s, 0, 0, n, n);
      if (framed) {
        // a chunky copper frame with a dark keyline, like the map's frame in the game
        const w = n * .055; g.lineJoin = 'round';
        g.strokeStyle = '#2a1c22'; g.lineWidth = w * 1.6; g.strokeRect(w * .8, w * .8, n - w * 1.6, n - w * 1.6);
        g.strokeStyle = '#e38d4e'; g.lineWidth = w; g.strokeRect(w * .8, w * .8, n - w * 1.6, n - w * 1.6);
        g.strokeStyle = '#f5b07a'; g.lineWidth = w * .25; g.strokeRect(w * .55, w * .55, n - w * 1.1, n - w * 1.1);
      }
      return c.toDataURL('image/png');
    };
    return { 'icon3d-192.png': make(192, true), 'icon3d-512.png': make(512, true), 'icon3d-maskable-512.png': make(512, false), 'apple-touch-icon-3d.png': make(180, false) };
  });
  for (const [name, url] of Object.entries(icons)) fs.writeFileSync(path.join(out, name), Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', Object.keys(icons).join(', '));
  await b.close(); srv.close(); process.exit(0);
})();
