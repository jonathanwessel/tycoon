'use strict';
/* =========================================================
   Music: Western tunes written on the fly with WebAudio (no sound files)
   Three moods: a lonesome theme behind the title, a trotting town tune, and a driving one while a boss rides in.
   musicBar() writes one bar as notes (pure and seeded, so it can be tested); musicTick() schedules bars a little
   ahead of the audio clock; the instruments are small synths (a Karplus-Strong guitar, a whistle, a harmonica,
   a fiddle, a bass and a few drums). The volume is S.opt.music (0 is off; off schedules nothing).
   ========================================================= */
/* Each mood: tempo, key (the bass's MIDI note), lead instrument, the melody's scale (semitones above the key),
   two four-chord phrases (A and B: [semitones above the key, 'M' major or 'm' minor]) and the melody's rhythms. */
const TUNES = {
  title: { bpm: 72, key: 40, lead: 'whistle', scale: [0, 3, 5, 7, 10], swing: 0, rest: .25,
    A: [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M']], B: [[5, 'm'], [0, 'm'], [7, 'M'], [0, 'm']],
    rhythms: [[2, 2], [3, 1], [1.5, .5, 2], [2, 1, 1], [1, 1, 2]] },
  town: { bpm: 100, key: 43, lead: 'harp', scale: [0, 2, 4, 7, 9], swing: .12, rest: .12,
    A: [[0, 'M'], [5, 'M'], [0, 'M'], [7, 'M']], B: [[5, 'M'], [0, 'M'], [2, 'm'], [7, 'M']],
    rhythms: [[1, 1, 1, 1], [1.5, .5, 1, 1], [.5, .5, 1, 2], [1, .5, .5, 2], [2, 1, 1], [1, 1, 2]] },
  boss: { bpm: 132, key: 45, lead: 'fiddle', scale: [0, 2, 3, 5, 7, 8, 11], swing: 0, rest: .05,
    A: [[0, 'm'], [10, 'M'], [8, 'M'], [7, 'M']], B: [[0, 'm'], [5, 'm'], [8, 'M'], [7, 'M']],
    rhythms: [[.5, .5, .5, .5, 1, 1], [1, .5, .5, 1, 1], [.5, .5, 1, .5, .5, 1], [1, 1, .5, .5, 1]] },
};
const FORM = ['A', 'A', 'B', 'A']; // a tune is four phrases of four bars; a new tune (new melodies) follows
const ENDINGS = [[2, 2], [1, 1, 2], [3, 1], [4]];
/* A small seeded random source (mulberry32). */
function mrng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const midiHz = n => 440 * Math.pow(2, (n - 69) / 12);
/* The pitch classes (0-11) of a chord in a tune. */
function chordPcs(T, c) { const r = (T.key + c[0]) % 12; return [r, (r + (c[1] === 'm' ? 3 : 4)) % 12, (r + 7) % 12]; }
/* The melody of one phrase (four bars of notes), the same every time for the same seed and section. */
function phraseMelody(T, seed, sec) {
  const r = mrng(seed * 7919 + (sec === 'B' ? 101 : 13)), chords = T[sec], home = T.key + 24, sc = [];
  for (let o = -1; o <= 1; o++) for (const s of T.scale) sc.push(home + 12 * o + s);
  const lo = sc.findIndex(n => n >= home - 5), hi = sc.length - 1 - [...sc].reverse().findIndex(n => n <= home + 16);
  let i = sc.indexOf(home); const out = [];
  for (let b = 0; b < 4; b++) {
    const last = b === 3, rh = last ? ENDINGS[Math.floor(r() * ENDINGS.length)] : T.rhythms[Math.floor(r() * T.rhythms.length)];
    const pcs = chordPcs(T, chords[b]), bar = []; let at = 0;
    rh.forEach((d, k) => {
      const strong = at % 2 === 0, end = last && k === rh.length - 1;
      if (!strong && !end && r() < T.rest) { at += d; return; } // a breath
      if (end || strong) { // land on a note of the chord (the phrase ends on the root, nearest home)
        const want = end ? [pcs[0]] : pcs; let best = -1, bd = 99;
        for (let j = lo; j <= hi; j++) if (want.includes(sc[j] % 12)) { const dd = Math.abs(j - (end ? sc.indexOf(home) : i)) + r() * .9; if (dd < bd) { bd = dd; best = j; } }
        if (best >= 0) i = best;
      } else {
        let step = r() < .6 ? 1 : 2; if (r() < .5) step = -step;
        if (sc[i] > home + 9) step = -Math.abs(step); else if (sc[i] < home - 2) step = Math.abs(step);
        i = Math.max(lo, Math.min(hi, i + step));
      }
      bar.push({ at, d, n: sc[i], i: T.lead, v: strong ? .3 : .24 }); at += d;
    });
    out.push(bar);
  }
  return out;
}
/* One bar of a mood's tune: { spb (seconds a beat), beats, ev: [{ at, d (beats), n (MIDI note), i (instrument), v }] }.
   n counts bars from the start of the mood; seed picks the melodies (a new tune every 16 bars). */
function musicBar(mood, seed, n) {
  const T = TUNES[mood] || TUNES.town, tune = Math.floor(n / 16), p = Math.floor(n / 4) % 4, sec = FORM[p], b = n % 4, c = T[sec][b];
  const ev = [], bass = T.key + (c[0] > 6 ? c[0] - 12 : c[0]), third = c[1] === 'm' ? 3 : 4;
  const g = 52 + ((T.key + c[0] - 52) % 12 + 12) % 12, strum = [g, g + 7, g + 12, g + 12 + third]; // an open guitar voicing
  const S8 = x => Math.floor(x) + (x % 1 === .5 ? .5 + T.swing : x % 1); // swung off-beats
  const add = (at, d, n_, i, v, s) => ev.push(s ? { at: S8(at), d, n: n_, i, v, s } : { at: S8(at), d, n: n_, i, v });
  if (mood === 'title') {
    add(0, 2, bass, 'bass', .5); add(2, 2, bass + 7, 'bass', .32);
    [0, 2, 1, 2, 3, 2, 1, 2].forEach((k, j) => add(j / 2, 1.5, strum[k], 'pluck', j % 2 ? .16 : .22)); // finger-picked
  } else if (mood === 'boss') {
    for (let j = 0; j < 8; j++) { add(j / 2, .45, bass + (j % 2 ? 12 : 0), 'bass', j % 2 ? .32 : .45); add(j / 2, .1, 0, 'hat', j % 2 ? .05 : .08); }
    for (const at of [1, 3]) { strum.forEach((s, k) => add(at, .3, s, 'strum', .2, k)); add(at, .2, 0, 'snare', .3); }
    add(0, .3, 0, 'tom', .6); add(2, .3, 0, 'tom', .5);
  } else { // town: boom-chick bass and guitar, hooves on the wood block
    add(0, .9, bass, 'bass', .55); add(2, .9, bass - 5, 'bass', .45);
    for (const at of [1, 3]) strum.forEach((s, k) => add(at, .35, s, 'strum', .17, k));
    for (let j = 0; j < 8; j++) add(j / 2, .1, j % 2 ? 1 : 0, 'block', j % 4 === 0 ? .12 : j % 2 ? .06 : .09);
  }
  const intro = mood === 'town' && n < 4; // the town tune starts with the band alone
  if (!intro) for (const e of phraseMelody(T, seed * 31 + tune, sec)[b]) add(e.at, e.d, e.n, e.i, e.v);
  return { spb: 60 / T.bpm, beats: 4, ev };
}

/* --- playing it ------------------------------------------------------------------------------------------- */
const MUSIC = { ctx: null, out: null, lead: null, want: 'title', mood: null, n: 0, seed: 1, t: 0, vol: -1, bufs: {}, noise: null, bars: 0 };
const musicVol = () => { const v = S.opt && S.opt.music; return v === undefined ? .6 : Math.max(0, Math.min(1, +v || 0)); };
/* Create the audio graph (once) and wake it. Browsers only let sound start after a tap or key, so this is called on
   every tap and key as well as when the title shows (an installed app is usually allowed to start at once). */
function musicStart() {
  const c0 = MUSIC.ctx;
  if (c0) { if (c0.state === 'suspended' && !document.hidden) try { c0.resume().catch(() => {}); } catch (e) {} return; }
  if (!musicVol() || typeof window === 'undefined') return;
  const A = window.AudioContext || window.webkitAudioContext; if (!A) return;
  try {
    const c = MUSIC.ctx = (typeof AC !== 'undefined' && AC) || new A(); if (typeof AC !== 'undefined' && !AC) AC = c; // one context, shared with the sound effects
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(c.destination);
    const out = MUSIC.out = c.createGain(); out.gain.value = 0; out.connect(comp);
    // the lead also goes through a canyon echo
    const lead = MUSIC.lead = c.createGain(), dl = c.createDelay(1), fb = c.createGain(), lp = c.createBiquadFilter(), wet = c.createGain();
    dl.delayTime.value = .36; fb.gain.value = .3; lp.type = 'lowpass'; lp.frequency.value = 2400; wet.gain.value = .3;
    lead.connect(out); lead.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(out);
    MUSIC.vol = -1; MUSIC.t = 0;
    if (c.state === 'suspended' && !document.hidden) c.resume().catch(() => {});
  } catch (e) { MUSIC.ctx = null; }
}
/* A plucked string (Karplus-Strong), made once per pitch. */
function musicPluckBuf(c, n) {
  if (MUSIC.bufs[n]) return MUSIC.bufs[n];
  const sr = c.sampleRate, len = Math.floor(sr * 1.6), b = c.createBuffer(1, len, sr), d = b.getChannelData(0), p = Math.max(2, Math.round(sr / midiHz(n))), ring = new Float32Array(p), r = mrng(n);
  for (let i = 0; i < p; i++) ring[i] = r() * 2 - 1;
  for (let i = 0, k = 0; i < len; i++) { const nx = (k + 1) % p, v = ring[k]; d[i] = v * .5; ring[k] = (v + ring[nx]) * .4985; k = nx; }
  return (MUSIC.bufs[n] = b);
}
function musicNoise(c) {
  if (MUSIC.noise) return MUSIC.noise;
  const b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0), r = mrng(7); for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
  return (MUSIC.noise = b);
}
/* One note: an instrument, at time t (seconds on the audio clock), lasting d seconds. */
function musicNote(c, e, t, d) {
  if (e.s) t += e.s * .013; // a strum sounds string by string
  const g = c.createGain(), v = e.v * (.9 + Math.random() * .2), env = g.gain, end = t + d;
  const osc = (type, f) => { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); return o; };
  const vib = (o, rate, depth, delay) => { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = rate; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(depth, t + delay); l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(end + .3); };
  let src = [], tail = .1, dest = MUSIC.out;
  switch (e.i) {
    case 'bass': { const o = osc('triangle', midiHz(e.n)); env.setValueAtTime(0, t); env.linearRampToValueAtTime(v, t + .01); env.exponentialRampToValueAtTime(.001, end); o.connect(g); src = [o]; break; }
    case 'pluck': case 'strum': {
      const s = c.createBufferSource(); s.buffer = musicPluckBuf(c, e.n); env.setValueAtTime(v, t); env.setValueAtTime(v, end); env.exponentialRampToValueAtTime(.001, end + (e.i === 'strum' ? .08 : .4)); s.connect(g); src = [s]; tail = .45;
      break;
    }
    case 'whistle': { const f = midiHz(e.n), o = osc('sine', f); vib(o, 5.2, f * .006, .25); env.setValueAtTime(0, t); env.linearRampToValueAtTime(v * .55, t + .07); env.setValueAtTime(v * .5, Math.max(t + .08, end - .1)); env.linearRampToValueAtTime(0, end + .05); o.connect(g); src = [o]; dest = MUSIC.lead; break; }
    case 'harp': case 'fiddle': {
      const f = midiHz(e.n), a = osc('sawtooth', f), b = osc('sawtooth', f * (e.i === 'harp' ? 1.004 : .997)), lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = e.i === 'harp' ? 1500 : 2300; lp.Q.value = e.i === 'harp' ? 1.5 : 3;
      vib(a, e.i === 'harp' ? 6 : 5.6, f * (e.i === 'harp' ? .004 : .008), e.i === 'harp' ? .15 : .2); vib(b, 5.8, f * .005, .2);
      const k = e.i === 'harp' ? .2 : .16;
      env.setValueAtTime(0, t); env.linearRampToValueAtTime(v * k, t + (e.i === 'harp' ? .03 : .05)); env.setValueAtTime(v * k * .85, Math.max(t + .06, end - .06)); env.linearRampToValueAtTime(0, end + .04);
      a.connect(lp); b.connect(lp); lp.connect(g); src = [a, b]; dest = MUSIC.lead; break;
    }
    case 'block': { const o = osc('triangle', e.n ? 760 : 1050); o.frequency.exponentialRampToValueAtTime(e.n ? 520 : 720, t + .03); env.setValueAtTime(v, t); env.exponentialRampToValueAtTime(.001, t + .06); o.connect(g); src = [o]; tail = .02; break; }
    case 'tom': { const o = osc('sine', 150); o.frequency.exponentialRampToValueAtTime(55, t + .25); env.setValueAtTime(v, t); env.exponentialRampToValueAtTime(.001, t + .32); o.connect(g); src = [o]; tail = .05; break; }
    case 'snare': case 'hat': {
      const s = c.createBufferSource(), f = c.createBiquadFilter(); s.buffer = musicNoise(c); f.type = e.i === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = e.i === 'hat' ? 7000 : 1800;
      env.setValueAtTime(v, t); env.exponentialRampToValueAtTime(.001, t + (e.i === 'hat' ? .04 : .14)); s.connect(f); f.connect(g); src = [s]; tail = .05; break;
    }
    default: return;
  }
  g.connect(dest);
  for (const s of src) { s.start(t); s.stop(end + tail + .05); }
}
/* Every frame: follow the volume, and keep about half a second of music scheduled. A new mood starts on the next bar. */
function musicTick() {
  const c = MUSIC.ctx; if (!c || c.state !== 'running') return 0;
  const vol = musicVol();
  if (vol !== MUSIC.vol) { MUSIC.vol = vol; MUSIC.out.gain.setTargetAtTime(vol * .5, c.currentTime, .15); }
  if (!vol) { MUSIC.t = 0; return 0; }
  if (MUSIC.t < c.currentTime + .03) MUSIC.t = c.currentTime + .1; // just switched on, or the page was asleep
  let made = 0;
  while (MUSIC.t < c.currentTime + .5 && made < 4) {
    if (MUSIC.want !== MUSIC.mood) { MUSIC.mood = MUSIC.want; MUSIC.n = 0; MUSIC.seed = 1 + Math.floor(Math.random() * 1e6); }
    const bar = musicBar(MUSIC.mood, MUSIC.seed, MUSIC.n++), spb = bar.spb, t0 = MUSIC.t;
    for (const e of bar.ev) try { musicNote(c, e, Math.max(c.currentTime, t0 + e.at * spb + (Math.random() - .5) * .008), e.d * spb); } catch (er) {} // a bad note never stops the game
    MUSIC.t = t0 + bar.beats * spb; MUSIC.bars++; made++;
  }
  return made;
}
/* The page going to the background silences everything; coming back wakes it. */
function musicSleep(on) { const c = MUSIC.ctx; if (!c) return; try { (on ? c.suspend() : c.resume()).catch(() => {}); } catch (e) {} }
