'use strict';
/* =========================================================
   Interface: the title screen
   Shown when the game opens: the town behind it in a slow flyover (r3Camera in view.js) with its own music, the
   name, and Continue / New game (plus a swap back to an empire put aside). Behind the title the towns keep
   producing but no raiders move. The welcome back, the tutorial and the news wait until it closes.
   ========================================================= */
const TITLE = { on: false, t: 0, after: null, ask: false };
/* Is there an empire worth continuing (anything earned, built or signed)? */
function hasEmpire() { return !!(S.life > 0 || S.towers.length || S.charters || Object.keys(S.towns).length || (S.stats && S.stats.coins > 0) || legacyPts()); }
/* after(kind) runs when the title closes: 'continue', 'new' (a new empire was started) or 'swap'. */
function showTitle(after) {
  TITLE.on = true; TITLE.t = 0; TITLE.after = after || null; TITLE.ask = false; R3.tk = 1;
  if (typeof SHEET !== 'undefined' && SHEET.open) closeSheet(); sel = null; stopHold();
  document.body.classList.add('titling'); const el = $('title'); el.classList.remove('out'); el.hidden = false;
  titleDraw(); musicStart(); requestAnimationFrame(() => fit());
}
function titleMusicLabel() { const b = $('tMusic'); if (!b) return; const on = musicVol() > 0; b.textContent = on ? '♪ Music on' : '♪ Music off'; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); }
function titleDraw() {
  const box = $('titleBtns'); box.textContent = '';
  const has = hasEmpire(), aside = asideInfo(), towns = 1 + Object.keys(S.towns).length;
  titleMusicLabel(); $('tVer').textContent = 'Version ' + GAME_VERSION + ' · free, no ads';
  if (TITLE.ask) { // starting over: say what happens, then ask once more
    const yes = h('button', { cls: 'primary', id: 'tYes', on: () => { if (newEmpire()) closeTitle('new'); else { TITLE.ask = false; TITLE.msg = 'Could not put this empire aside (storage is full), so nothing changed.'; titleDraw(); } } }, 'Start over');
    box.append(h('p', { cls: 'tq' }, 'Start a new empire from a bare plot? This one is put aside, and you can swap back to it here.'),
      aside ? h('p', { cls: 'tq warn' }, 'The empire put aside before (' + aside.town + ', wave ' + aside.wave + ') will be gone.') : '',
      yes, h('button', { on: () => { TITLE.ask = false; titleDraw(); } }, 'Keep my empire'));
    return;
  }
  const go = h('button', { cls: 'primary big', id: 'tGo', on: () => closeTitle('continue') }, h('b', null, has ? 'Continue' : 'New game'));
  if (has) go.append(h('small', null, TOWN.n + ' · wave ' + S.wave + (towns > 1 ? ' · ' + towns + ' towns' : '')));
  box.append(go);
  if (TITLE.msg) { box.prepend(h('p', { cls: 'tq warn' }, TITLE.msg)); TITLE.msg = ''; } // the toast is hidden behind the title, so it is said here
  if (has) box.append(h('button', { id: 'tNew', on: () => { TITLE.ask = true; titleDraw(); } }, 'New game'));
  if (aside) box.append(h('button', { cls: 'small', id: 'tSwap', on: () => { if (swapAside()) closeTitle('swap'); else { TITLE.msg = 'That empire could not be read, so nothing changed.'; titleDraw(); } } }, 'Swap to the empire put aside: ' + aside.town + ', wave ' + aside.wave));
}
function closeTitle(kind) {
  if (!TITLE.on) return; TITLE.on = false; musicStart();
  const el = $('title'); el.classList.add('out'); setTimeout(() => { if (!TITLE.on) { el.hidden = true; el.classList.remove('out'); } }, 380);
  document.body.classList.remove('titling'); rebuild = true;
  requestAnimationFrame(() => { fit(); layoutVars(); refresh(); });
  const f = TITLE.after; TITLE.after = null; if (f) f(kind);
}
(function titleWire() {
  $('tMusic').addEventListener('click', () => { const v = musicVol(); if (v > 0) { S.opt.musicWas = v; S.opt.music = 0; } else { S.opt.music = S.opt.musicWas || .6; musicStart(); } titleMusicLabel(); save(); });
  document.addEventListener('keydown', e => { // Enter continues (or confirms), Escape steps back from starting over
    if (!TITLE.on || (e.target.closest && e.target.closest('button'))) return;
    if (e.key === 'Escape' && TITLE.ask) { TITLE.ask = false; titleDraw(); } else if (e.key === 'Enter') { e.preventDefault(); const b = $(TITLE.ask ? 'tYes' : 'tGo'); if (b) b.click(); }
  });
})();
