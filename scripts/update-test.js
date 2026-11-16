// node scripts/update-test.js — serves a copy of the game with GitHub Pages-style 10-minute cache headers, lets it install
// its service worker, publishes a newer version into the copy, and checks the open game shows Update ready and lands on
// the new version after one tap. Uses an installed Edge or Chrome (scripts/cdp.js).
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const repo = process.argv[2] || path.resolve(__dirname, '..');
const site = fs.mkdtempSync(path.join(os.tmpdir(), 'gulch-site-'));
for (const f of ['index.html', 'sw.js', 'manifest.webmanifest', 'version.json']) fs.copyFileSync(path.join(repo, f), path.join(site, f));
fs.mkdirSync(path.join(site, 'src')); for (const f of fs.readdirSync(path.join(repo, 'src'))) fs.copyFileSync(path.join(repo, 'src', f), path.join(site, 'src', f));
fs.mkdirSync(path.join(site, 'icons')); for (const f of fs.readdirSync(path.join(repo, 'icons'))) fs.copyFileSync(path.join(repo, 'icons', f), path.join(site, 'icons', f));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const srv = http.createServer((q, r) => {
  let f = decodeURIComponent(q.url.split('?')[0]); if (f.endsWith('/')) f += 'index.html';
  const p = path.join(site, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream', 'cache-control': 'max-age=600' }); fs.createReadStream(p).pipe(r);
}).listen(0, '127.0.0.1', async () => {
  const port = srv.address().port, { chromium } = require(path.join(repo, 'scripts', 'cdp.js')), sleep = ms => new Promise(r => setTimeout(r, ms));
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 400, height: 860 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(`http://127.0.0.1:${port}/`); await sleep(2500);
  await pg.reload(); await sleep(2000); // second load runs under the service worker, like an installed app
  const before = await pg.evaluate(() => ({ v: GAME_VERSION, controlled: !!navigator.serviceWorker.controller }));
  // publish a newer version into the served copy (Pages-style 10-minute cache headers on everything)
  const NEW = '2099.01.01-1';
  for (const f of ['src/app.js', 'sw.js']) { const p = path.join(site, f); fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/(GAME_VERSION|VERSION) = '[^']+'/, `$1 = '${NEW}'`)); }
  fs.writeFileSync(path.join(site, 'version.json'), JSON.stringify({ version: NEW, notes: 'test release' }));
  await pg.evaluate(() => checkUpdates(true)); await sleep(3000);
  const mid = await pg.evaluate(() => ({ bar: !!document.getElementById('updateBar'), waiting: !!APP.waiting, status: APP.status }));
  await pg.evaluate(() => document.getElementById('updateBar').click()); await sleep(3500);
  const after = await pg.evaluate(async () => ({ v: GAME_VERSION, caches: await caches.keys(), controlled: !!navigator.serviceWorker.controller }));
  const ok = mid.bar && after.v === NEW && !errs.length; console.log(ok ? 'ok' : 'FAIL', JSON.stringify({ before, mid, after }), errs); process.exitCode = ok ? 0 : 1;
  await b.close(); srv.close(); fs.rmSync(site, { recursive: true, force: true });
});
