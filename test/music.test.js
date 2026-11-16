// node --test — the music (tunes written from a seed, scheduled a little ahead, silent when off) and the title
// screen's save v12 (save slots are tested in saves.test.js).
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('../scripts/sim');

const LEADS = ['whistle', 'harp', 'fiddle'];
const lead = (g, mood, seed, n) => g.run(`musicBar('${mood}', ${seed}, ${n}).ev.filter(e => ${JSON.stringify(LEADS)}.includes(e.i)).map(e => e.at + ':' + e.n + ':' + e.d).join(' ')`);

test('a tune is the same for the same seed, and a new seed writes a new one', () => {
  const g = load();
  for (const m of ['title', 'town', 'boss']) {
    assert.deepStrictEqual(g.run(`JSON.stringify(musicBar('${m}', 42, 9))`), g.run(`JSON.stringify(musicBar('${m}', 42, 9))`));
    let differ = 0; for (let n = 4; n < 16; n++) if (lead(g, m, 42, n) !== lead(g, m, 43, n)) differ++;
    assert.ok(differ >= 4, m + ': another seed gives other melodies (' + differ + ' of 12 bars differ)');
  }
});

test('melodies stay in the scale and range, fit the bar, and phrases end on the chord root', () => {
  const g = load();
  for (const m of ['title', 'town', 'boss']) for (let seed = 1; seed < 30; seed++) {
    const r = g.run(`(() => { const T = TUNES['${m}'], pcs = T.scale.map(s => (T.key + s) % 12), home = T.key + 24, bad = [];
      for (let n = 0; n < 16; n++) { const bar = musicBar('${m}', ${seed}, n), L = bar.ev.filter(e => ${JSON.stringify(LEADS)}.includes(e.i));
        for (const e of bar.ev) if (e.at < 0 || e.at >= 4) bad.push('event outside the bar ' + n);
        for (const e of L) { if (!pcs.includes(e.n % 12)) bad.push('off the scale ' + e.n); if (e.n < home - 5 || e.n > home + 16) bad.push('out of range ' + e.n); }
        if (L.reduce((a, e) => a + e.d, 0) > 4.001) bad.push('too long ' + n);
        if (n % 4 === 3 && L.length) { const c = T[FORM[Math.floor(n / 4) % 4]][3], last = L[L.length - 1]; if (last.n % 12 !== (T.key + c[0]) % 12) bad.push('phrase ' + n + ' ends off the root'); }
      } return JSON.stringify(bad); })()`);
    assert.strictEqual(r, "[]", m + " seed " + seed);
  }
});

test('the form is A A B A: repeated phrases repeat, the B phrase and the next tune differ', () => {
  const g = load();
  for (const m of ['title', 'boss']) {
    for (let b = 0; b < 4; b++) { assert.strictEqual(lead(g, m, 7, b), lead(g, m, 7, 4 + b)); assert.strictEqual(lead(g, m, 7, b), lead(g, m, 7, 12 + b)); }
    let diffB = 0, diffNext = 0; for (let b = 0; b < 4; b++) { if (lead(g, m, 7, b) !== lead(g, m, 7, 8 + b)) diffB++; if (lead(g, m, 7, b) !== lead(g, m, 7, 16 + b)) diffNext++; }
    assert.ok(diffB >= 2 && diffNext >= 2, m + ': B and the next tune are new music');
  }
  // the town tune opens with the band alone for a phrase, then the harmonica comes in
  for (let n = 0; n < 4; n++) assert.strictEqual(lead(g, 'town', 7, n), '');
  assert.notStrictEqual(lead(g, 'town', 7, 4), '');
  assert.ok(g.run(`TUNES.boss.bpm > TUNES.town.bpm && TUNES.town.bpm > TUNES.title.bpm`), 'boss music is the fastest, the title the calmest');
  assert.ok(g.run(`musicBar('boss', 1, 0).ev.some(e => e.i === 'tom') && !musicBar('title', 1, 0).ev.some(e => e.i === 'tom' || e.i === 'block')`), 'drums only where they belong');
});

/* A stand-in AudioContext that counts what is made and started. */
const FAKE = `(() => {
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime(v) { this.target = v; } });
  const node = () => ({ connect() {}, gain: param(), frequency: param(), Q: param(), delayTime: param(), threshold: param(), ratio: param(),
    start() { FA.started++; }, stop() {}, type: '', buffer: null });
  globalThis.FA = { started: 0, made: 0 };
  return class { constructor() { this.state = 'running'; this.currentTime = 10; this.sampleRate = 8000; this.destination = node(); }
    createGain() { FA.made++; return node(); } createOscillator() { FA.made++; return node(); } createBiquadFilter() { return node(); } createDelay() { return node(); }
    createDynamicsCompressor() { return node(); } createBufferSource() { FA.made++; return node(); }
    createBuffer(ch, len) { const d = new Float32Array(len); return { getChannelData: () => d }; }
    resume() { this.state = 'running'; return Promise.resolve(); } suspend() { this.state = 'suspended'; return Promise.resolve(); } };
})()`;

test('the scheduler keeps half a second ahead, follows the mood, and plays nothing when the music is off', () => {
  const g = load();
  g.run(`window.AudioContext = ${FAKE}; document.hidden = false; AC = null; S.opt.music = .6; musicStart();`);
  assert.ok(g.run('!!MUSIC.ctx && AC === MUSIC.ctx'), 'one audio context, shared with the sound effects');
  MUSICT(g, 'title');
  assert.ok(g.run('musicTick()') >= 1 && g.run('FA.started') > 5, 'the title theme is scheduled');
  assert.strictEqual(g.run('MUSIC.mood'), 'title');
  assert.ok(g.run('MUSIC.t > MUSIC.ctx.currentTime + .5'), 'scheduled past the lookahead');
  assert.strictEqual(g.run('musicTick()'), 0, 'nothing more until the clock catches up');
  assert.ok(Math.abs(g.run('MUSIC.out.gain.target') - .3) < 1e-9, 'the volume follows the setting');
  // a boss arrives: the next bar is boss music, from its first bar
  g.run(`MUSIC.want = 'boss'; MUSIC.ctx.currentTime = MUSIC.t;`); g.run('musicTick()');
  assert.strictEqual(g.run('MUSIC.mood'), 'boss'); assert.ok(g.run('MUSIC.n') >= 1 && g.run('MUSIC.n') <= 4);
  // switched off: the volume falls to nothing and no notes are made
  g.run('S.opt.music = 0; FA.started = 0; MUSIC.ctx.currentTime += 30;');
  assert.strictEqual(g.run('musicTick()'), 0); assert.strictEqual(g.run('FA.started'), 0); assert.strictEqual(g.run('MUSIC.out.gain.target'), 0);
  // back on after a long silence: it starts from now, not from where it stopped
  g.run('S.opt.music = 1;'); assert.ok(g.run('musicTick()') >= 1); assert.ok(g.run('MUSIC.t - MUSIC.ctx.currentTime < 4'));
  // a suspended context (the page in the background) schedules nothing
  g.run('musicSleep(true); FA.started = 0; MUSIC.ctx.currentTime += 30;'); assert.strictEqual(g.run('musicTick()'), 0);
  assert.strictEqual(g.run('FA.started'), 0);
});
function MUSICT(g, mood) { g.run(`MUSIC.want = '${mood}';`); }

test('with the music off from the start no audio context is made', () => {
  const g = load();
  g.run(`window.AudioContext = ${FAKE}; AC = null; S.opt.music = 0; musicStart();`);
  assert.ok(g.run('MUSIC.ctx === null && AC === null'));
});

test('save v12 adds the music volume; older saves get the default, a chosen silence is kept', () => {
  const g = load();
  assert.strictEqual(g.run('fresh().v'), 12); assert.strictEqual(g.run('fresh().opt.music'), .6);
  g.run(`WIPE_OFF = true; const o = JSON.parse(JSON.stringify(fresh())); o.v = 11; delete o.opt.music; adopt(o);`);
  assert.strictEqual(g.run('S.v'), 12); assert.strictEqual(g.run('S.opt.music'), .6);
  g.run(`const o2 = JSON.parse(JSON.stringify(fresh())); o2.v = 11; o2.opt.music = 0; adopt(o2);`);
  assert.strictEqual(g.run('S.opt.music'), 0);
});

