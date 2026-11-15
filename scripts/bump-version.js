// node scripts/bump-version.js "What changed, one short sentence"
// Stamps a new version (YYYY.MM.DD-N) into index.html, sw.js and version.json together, with release notes.
// Run it before every push so installed copies see the update.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(root, f), s);

const html = read('index.html');
const cur = (html.match(/const GAME_VERSION = '([^']+)'/) || [])[1] || '';
const d = new Date(), today = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
const [cd, cn] = cur.split('-');
const next = today + '-' + (cd === today ? (+cn || 0) + 1 : 1);
const notes = (process.argv[2] || '').replace(/['\\\n]/g, ' ').trim();

write('index.html', html.replace(/const GAME_VERSION = '[^']+'/, `const GAME_VERSION = '${next}'`).replace(/const GAME_NEWS = '[^']*'/, `const GAME_NEWS = '${notes}'`));
write('sw.js', read('sw.js').replace(/const VERSION = '[^']+'/, `const VERSION = '${next}'`));
write('version.json', JSON.stringify({ version: next, notes }, null, 2) + '\n');
console.log(cur, '->', next, notes ? '(' + notes + ')' : '');
