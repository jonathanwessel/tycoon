// node --test   — source checks. Twice a `//` comment added at the end of a line swallowed the code after it
// (the canvas size, the dusk tint), which broke the game without any error. This flags comments that end in code.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('no code hidden at the end of a // comment', () => {
  const dir = path.join(__dirname, '..', 'src'), bad = [];
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
    fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/).forEach((line, i) => {
      const at = line.indexOf('// '); if (at < 0 || /['"`]/.test(line.slice(0, at).replace(/\\./g, '').replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '').replace(/[^'"`]/g, ''))) return;
      const c = line.slice(at + 3);
      // an assignment or call ending in ";" inside the comment is almost certainly swallowed code
      if (/[\w$\]\)]\s*(=|\+=|-=)\s*[^=].*;\s*$/.test(c) || /\b[a-zA-Z_$][\w$.]*\([^)]*\);\s*$/.test(c)) bad.push(f + ':' + (i + 1) + ': ' + line.trim());
    });
  }
  assert.deepStrictEqual(bad, []);
});
