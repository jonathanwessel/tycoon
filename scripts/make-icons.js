// node scripts/make-icons.js — renders the app icons from the game's own pixel sprites into icons/.
// Uses Playwright if installed, otherwise an installed Edge or Chrome (scripts/cdp.js).
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('./cdp'); } })();
const fs = require('fs');
const path = require('path');
const URL = require('url').pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
const out = path.resolve(__dirname, '..', 'icons');

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 600, height: 800 } });
  await p.goto(URL); await p.waitForTimeout(400);
  const icons = await p.evaluate(() => {
    // a desert dusk square: night sky, a sandy rise, the copper-doored vault flanked by torches, a crossbow and a cactus
    const make = (n, safe) => {
      const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      const u = n / 32, s = safe ? .78 : 1, o = n * (1 - s) / 2, U = u * s;
      g.fillStyle = '#161a2a'; g.fillRect(0, 0, n, n);
      const sky = [['#1d2140', 0], ['#2a2850', 8], ['#4a3358', 14], ['#a8553a', 18]];
      for (const [col, y] of sky) { g.fillStyle = col; g.fillRect(0, o + y * U, n, n); }
      g.fillStyle = '#f2d04a'; for (const [x, y] of [[5, 4], [24, 3], [13, 6], [28, 9], [8, 10]]) g.fillRect(o + x * U, o + y * U, U, U);
      g.fillStyle = '#b97e4a'; g.fillRect(0, o + 21 * U, n, n); g.fillStyle = '#c9a26c'; g.fillRect(0, o + 23 * U, n, n);
      g.fillStyle = '#a8703f'; for (let x = 0; x < 32; x += 3) g.fillRect(o + x * U, o + 26 * U, U * 2, U);
      const spr = (name, x, y, h, flip) => { const im = SPR[name], w = h * im.width / im.height; g.save(); g.translate(o + x * U, o + y * U); if (flip) g.scale(-1, 1); g.drawImage(im, -w * U / 2, -h * U / 2, w * U, h * U); g.restore(); };
      spr('vault', 16, 18.5, 14);
      for (const tx of [6.8, 25.2]) { g.fillStyle = '#6e4526'; g.fillRect(o + (tx - .5) * U, o + 15 * U, U, 8 * U); g.fillStyle = '#f5a04a'; g.fillRect(o + (tx - 1) * U, o + 13 * U, 2 * U, 2 * U); g.fillStyle = '#fff0a0'; g.fillRect(o + (tx - .5) * U, o + 13.5 * U, U, U); }
      spr('cactus', 3.5, 25, 6); spr('crossbow', 27.5, 26, 6, true);
      return c.toDataURL('image/png');
    };
    return { 'icon-192.png': make(192), 'icon-512.png': make(512), 'icon-maskable-512.png': make(512, true), 'apple-touch-icon.png': make(180) };
  });
  for (const [name, url] of Object.entries(icons)) fs.writeFileSync(path.join(out, name), Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', Object.keys(icons).join(', '));
  await b.close();
})();
