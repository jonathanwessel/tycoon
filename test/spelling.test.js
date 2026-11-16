// node --test — the game is written in American English. This flags British spellings in the source, the page,
// the manifest and the README so they do not creep back in (the owner asked for US English everywhere).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const BRITISH = /defence|offence|colour|favour|flavour|harbour|labour|rumour|vapour|honour|armour|behaviour|neighbour|centre|metre|litre|theatre|sabre|fibre|aluminium|storey|licence|\bgrey|kerb|tyre|plough|mould|jewellery|catalogue|travell|levell|modell|cancell|fuell|signall|\btowards\b|\bmaths\b|\b(realis|organis|recognis|prioritis|optimis|summaris|normalis|initialis|finalis|randomis|minimis|maximis|customis|stabilis|visualis|utilis|specialis|apologis|categoris|emphasis|penalis|harmonis|capitalis|standardis|criticis|analys|paralys)(e|ed|es|ing|ation)\b/i;

test('no British spellings in the game, the page or the README', () => {
  const root = path.join(__dirname, '..'), files = [];
  const walk = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (f.name.endsWith('.js')) files.push(p); } };
  walk(path.join(root, 'src'));
  files.push(...['index.html', 'manifest.webmanifest', 'README.md'].map(f => path.join(root, f)));
  const bad = [];
  for (const f of files) fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
    const m = line.match(BRITISH); if (m) bad.push(path.relative(root, f) + ':' + (i + 1) + ': ' + m[0]);
  });
  assert.deepStrictEqual(bad, []);
});

test('player-facing names use American spelling', () => {
  const g = require('../scripts/sim.js').load();
  assert.strictEqual(g.run('ITEMS.alu.n'), 'Aluminum');
  assert.strictEqual(g.run("SHOPS_ALL.find(s => s.id === 'alusm').n"), 'Aluminum Smelter');
  assert.strictEqual(g.run('TECH.war.n'), 'Defense');
});
