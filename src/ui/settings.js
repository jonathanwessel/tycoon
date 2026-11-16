'use strict';
/* =========================================================
   Interface: settings and the welcome back
   The settings sheet (graphics, sound, game) and the summary shown after time away.
   ========================================================= */
/* Settings panel: slides up over the bottom of the screen (from the side on wide screens) so the map stays
   in view and every graphics change shows at once. */
let setTab = 'gfx', setUps = [];
function openSettings(t) {
  if (t) setTab = t;
  const m = $('modal'); m.textContent = ''; m.className = 'modal sheetm'; setUps = [];
  const close = () => { m.hidden = true; m.className = 'modal'; m.onclick = null; setUps = []; save(); };
  m.onclick = e => { if (e.target === m) close(); };
  const tabs = h('div', { cls: 'seg settabs', role: 'tablist' });
  for (const [k, n] of [['gfx', 'Graphics'], ['sound', 'Sound'], ['game', 'Game'], ['saves', 'Saves']]) { const b = h('button', { cls: 'small' + (setTab === k ? ' on' : ''), role: 'tab', 'aria-selected': String(setTab === k), on: () => openSettings(k) }, n); tabs.append(b); }
  const body = h('div', { cls: 'setbody' }), xb = h('button', { cls: 'small x', 'aria-label': 'Close settings', on: close }, '✕');
  m.append(h('div', { cls: 'box wide', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'setH' }, h('div', { cls: 'cardhead' }, h('h3', { id: 'setH', cls: 'grow' }, 'Settings'), xb), tabs, body));
  const run = () => { for (const f of setUps) f(); };
  const row = (label, hint, opts, get, put, off) => {
    const seg = h('div', { cls: 'seg' }), hn = h('small', null, hint || '');
    for (const [v, n] of opts) { const b = h('button', { cls: 'small', on: () => { put(v); run(); refresh(); } }, n); seg.append(b); setUps.push(() => { b.classList.toggle('on', get() === v); b.disabled = !!(off && off()); }); }
    body.append(h('div', { cls: 'row setrow' }, h('div', { cls: 'grow' }, h('div', { cls: 'name' }, label), hn), seg));
    return hn;
  };
  const litOff = () => false;
  if (setTab === 'gfx') {
    const qh = row('Quality', '', [['low', 'Low'], ['med', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']], () => GX().preset, v => setGx('preset', v));
    setUps.push(() => { qh.textContent = GX().preset === 'custom' ? 'Custom mix. Pick a preset to reset the details below.' : { low: 'Fastest: no lighting, 30 fps, fewer effects.', med: 'Lighting with soft shadows at a lower resolution.', high: 'Full lighting, shadows and glow.', ultra: 'Sharper than your screen, long shadows, strong glow, every effect.' }[GX().preset]; });
    body.append(h('h2', null, 'Detail'));
    row('Shadows', 'Cast by buildings, towers and raiders as the sun moves.', [[0, 'Off'], [1, 'Soft'], [2, 'Full'], [3, 'Long']], () => GX().shadow, v => setGx('shadow', v), litOff);
    row('Glow', 'Light bleeding from fires, lamps and blasts.', [[0, 'Off'], [1, 'Low'], [2, 'Normal'], [3, 'Strong']], () => GX().bloom, v => setGx('bloom', v), litOff);
    row('Resolution', 'Lower is faster and blockier; 150% is extra sharp.', [[.5, '50%'], [.75, '75%'], [1, '100%'], [1.5, '150%']], () => GX().res, v => setGx('res', v));
    row('Effects', 'Dust, sparks, smoke and debris.', [[0, 'Few'], [1, 'Some'], [2, 'Lots'], [3, 'Max']], () => GX().parts, v => setGx('parts', v));
    row('Weather effects', 'Rain, dust and heat haze. Weather still changes the fight when hidden.', [[1, 'Show'], [0, 'Hide']], () => GX().weather ? 1 : 0, v => setGx('weather', v));
    row('Screen shake', '', [[1, 'On'], [0, 'Off']], () => GX().shake ? 1 : 0, v => setGx('shake', v));
    row('Frame rate', '30 saves battery; the game itself runs the same.', [[60, 'Smooth 60'], [30, 'Battery 30']], () => GX().fps, v => setGx('fps', v));
    body.append(h('h2', null, 'Style'));
    row('Look', 'Colour grading for the whole map.', Object.keys(LOOKS).map(k => [k, LOOKS[k].n]), () => GX().look, v => setGx('look', v));
    row('Film grain', 'A fine moving grain, like old film.', [[1, 'On'], [0, 'Off']], () => GX().grain ? 1 : 0, v => setGx('grain', v), litOff);
    row('Scanlines', 'Lines like an old arcade screen.', [[1, 'On'], [0, 'Off']], () => GX().scan ? 1 : 0, v => setGx('scan', v));
    row('Show frame rate', 'A small counter in the corner of the map.', [[1, 'On'], [0, 'Off']], () => GX().fpsShow ? 1 : 0, v => setGx('fpsShow', v));
  } else if (setTab === 'sound') {
    row('Music', 'Western tunes made as you play: a calm one in town, a fast one when a boss rides in.', [[0, 'Off'], [.3, 'Low'], [.6, 'Medium'], [1, 'High']], () => musicVol(), v => { if (v) S.opt.musicWas = v; S.opt.music = v; musicStart(); });
    row('Sound effects', '', [[true, 'On'], [false, 'Off']], () => !!S.sound, v => { S.sound = v; snd('coin', 880, .08, 'square', .04, 440); });
    row('Effects volume', '', [[.25, 'Low'], [.6, 'Medium'], [1, 'High']], () => S.opt.vol, v => { S.opt.vol = v; S.sound = true; snd('coin', 880, .08, 'square', .04, 440); });
  } else if (setTab === 'saves') savesTab(body);
  else {
    row('Waves', 'Held waves only come when you call them.', [[true, 'Come on their own'], [false, 'Held']], () => !!S.autoWave, v => { if (S.autoWave !== v) toggleAuto(); });
    body.append(h('div', { cls: 'row setrow' }, h('div', { cls: 'grow' }, h('b', null, 'Tutorial'), h('small', null, 'A three-minute walk through the basics.')), h('button', { cls: 'small', on: () => { $('modal').hidden = true; $('modal').className = 'modal'; tutStart(); } }, 'Play it')));
    body.append(h('div', { cls: 'row setrow' }, h('div', { cls: 'grow' }, h('b', null, 'Title screen'), h('small', null, 'Continue, play another save slot or start a new empire.')), h('button', { cls: 'small', id: 'setTitle', on: () => { $('modal').hidden = true; $('modal').className = 'modal'; save();
      showTitle(kind => { if (kind === 'new') setTimeout(tutOffer, 700); else if (kind === 'swap') say(slotSwapNote()); }); } }, 'Open')));
    row('Motion', 'Calm turns off sliding, shaking and pop-in.', [['auto', 'Like my device'], ['calm', 'Calm'], ['full', 'Full']], () => S.opt.calm, v => { S.opt.calm = v; applyMotion(); });
    row('Damage numbers', '', [[true, 'Show'], [false, 'Hide']], () => S.opt.nums !== false, v => { S.opt.nums = v; });
    row('Vibration', 'A light buzz when you press a button (phones).', [[true, 'On'], [false, 'Off']], () => S.opt.buzz !== false, v => { S.opt.buzz = v; });
    const pad = h('small'); setUps.push(() => { pad.textContent = padNote(); });
    body.append(h('div', { cls: 'row setrow' }, h('div', { cls: 'grow' }, h('b', null, 'Controller'), pad)));
    row('When I switch away', '', [[false, 'Keep running'], [true, 'Pause']], () => !!S.opt.autoPause, v => { S.opt.autoPause = v; });
  }
  run(); m.hidden = false; xb.focus({ preventScroll: true });
}
function welcome(away, coins, gains) {
  const m = $('modal'), m_ = Math.round(away / 60), dur = m_ >= 60 ? Math.floor(m_ / 60) + 'h ' + m_ % 60 + 'm' : m_ + ' minutes';
  const list = h('div', { cls: 'away' });
  for (const k in gains) if (gains[k] >= 1) list.append(h('div', null, ico(k, ITEMS[k].n), '+' + fmt(gains[k])));
  const ok = h('button', { cls: 'primary', on: () => { m.hidden = true; coinBurstFrom(ok, 9, coins); } }, 'Back to work');
  m.textContent = '';
  m.append(h('div', { cls: 'box', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'mh' }, h('h3', { id: 'mh' }, 'Welcome back'),
    h('p', null, 'Your works ran for ' + dur + ' while you were away.' + (coins >= 1 ? ' Auto-sell and foremen earned you ' + fmt(coins) + ' coins.' : '')),
    list.childNodes.length ? list : h('p', null, 'Build some gathering camps and they will keep working while you are away.'), ok));
  m.hidden = false; ok.focus();
}
