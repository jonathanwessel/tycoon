// node scripts/serve.js [port]  — serves the game folder over http (the 3D view is an ES module, which browsers will
// not load from a file:// page). Also used by the smoke test: require('./serve').start(0) gives { url, close }.
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css' };
function start(port = 0) {
  return new Promise(res => {
    const srv = http.createServer((q, r) => {
      const p = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
      if (!p.startsWith(root)) { r.writeHead(403); return r.end(); }
      fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); r.end(d); });
    }).listen(port, '127.0.0.1', () => res({ url: 'http://127.0.0.1:' + srv.address().port + '/', close: () => srv.close() }));
  });
}
if (require.main === module) start(+process.argv[2] || 5180).then(s => console.log('Copper Gulch at', s.url));
module.exports = { start };
