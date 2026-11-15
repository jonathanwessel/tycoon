// node scripts/bump-version.js "What changed, one short sentence"
// Stamps a new version (YYYY.MM.DD-N) into src/app.js, sw.js and version.json together, with release notes, and
// rewrites the service worker's list of files to cache (index.html, manifest, icons, everything in src/ and vendor/).
// Run it before every push so installed copies see the update and get every file offline.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(root, f), s);
const list = dir => fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir), { recursive: true }).filter(f => /\.(js|png|json)$/.test(f)).map(f => './' + (dir + '/' + f).replace(/\\/g, '/')).sort() : [];

const app = read('src/app.js');
const cur = (app.match(/const GAME_VERSION = '([^']+)'/) || [])[1] || '';
const d = new Date(), today = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
const [cd, cn] = cur.split('-');
const next = today + '-' + (cd === today ? (+cn || 0) + 1 : 1);
const notes = (process.argv[2] || '').replace(/['\\\n]/g, ' ').trim();

write('src/app.js', app.replace(/const GAME_VERSION = '[^']+'/, `const GAME_VERSION = '${next}'`).replace(/const GAME_NEWS = '[^']*'/, `const GAME_NEWS = '${notes}'`));
const shell = ['./', './index.html', './manifest.webmanifest', ...list('icons'), ...list('src'), ...list('vendor')];
write('sw.js', read('sw.js').replace(/const VERSION = '[^']+'/, `const VERSION = '${next}'`).replace(/const SHELL = \[[^\]]*\];/, 'const SHELL = ' + JSON.stringify(shell) + ';'));
write('version.json', JSON.stringify({ version: next, notes }, null, 2) + '\n');
console.log(cur, '->', next, notes ? '(' + notes + ')' : '', '·', shell.length, 'files cached');
