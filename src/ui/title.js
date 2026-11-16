'use strict';
/* =========================================================
   Interface: the title screen
   Shown when the game opens: the town behind it in a slow flyover (r3Camera in view.js) with its own music, the
   name, Continue, the other save slots and New game. Behind the title the towns keep
   producing but no raiders move. The welcome back, the tutorial and the news wait until it closes.
   ========================================================= */
const TITLE = { on: false, t: 0, after: null, ask: false };
/* Is there an empire worth continuing (anything earned, built or signed)? */
function hasEmpire() { return !!(S.life > 0 || S.towers.length || S.charters || Object.keys(S.towns).length || (S.stats && S.stats.coins > 0) || legacyPts()); }
/* after(kind) runs when the title closes: 'continue', 'new' (a new empire was started) or 'swap' (another slot). */
function showTitle(after) {
  TITLE.on = true; TITLE.t = 0; TITLE.after = after || null; TITLE.ask = false; R3.tk = 1;
  if (typeof SHEET !== 'undefined' && SHEET.open) closeSheet(); sel = null; stopHold();
  document.body.classList.add('titling'); const el = $('title'); el.classList.remove('out'); el.hidden = false;
  titleDraw(); musicStart(); requestAnimationFrame(() => fit());
}
function titleMusicLabel() { const b = $('tMusic'); if (!b) return; const on = musicVol() > 0; b.textContent = on ? '♪ Music on' : '♪ Music off'; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); }
function titleDraw() {
  const box = $('titleBtns'); box.textContent = '';
  const has = hasEmpire(), slots = slotList(), on = slotOn(), towns = 1 + Object.keys(S.towns).length, free = slots.find(x => x.empty);
  titleMusicLabel(); $('tVer').textContent = 'Version ' + GAME_VERSION + ' · free, no ads';
  if (TITLE.ask) { // every slot is in use: starting over replaces this empire (kept as an undo copy), so ask once more
    const yes = h('button', { cls: 'primary', id: 'tYes', on: () => { if (newEmpire()) closeTitle('new'); else { TITLE.ask = false; TITLE.msg = 'Could not keep a copy of this empire (storage is full), so nothing changed.'; titleDraw(); } } }, 'Start over');
    box.append(h('p', { cls: 'tq' }, 'All ' + SLOTS + ' save slots are in use. Start a new empire in slot ' + on + ' instead of ' + TOWN.n + ', wave ' + S.wave + '?'),
      h('p', { cls: 'tq warn' }, 'It is kept as an undo copy only until the next load. Save it to a file first to keep it for good, or erase another slot in Settings, Saves.'),
      yes, h('button', { cls: 'small', on: () => saveToFile(on) }, 'Save it to a file first'), h('button', { on: () => { TITLE.ask = false; titleDraw(); } }, 'Keep my empire'));
    return;
  }
  const go = h('button', { cls: 'primary big', id: 'tGo', on: () => closeTitle('continue') }, h('b', null, has ? 'Continue' : 'New game'));
  if (has) go.append(h('small', null, TOWN.n + ' · wave ' + S.wave + (towns > 1 ? ' · ' + towns + ' towns' : '') + ' · slot ' + on));
  box.append(go);
  if (TITLE.msg) { box.prepend(h('p', { cls: 'tq warn' }, TITLE.msg)); TITLE.msg = ''; } // the toast is hidden behind the title, so it is said here
  // the other slots: play one (the empire in play waits in its own slot), or start a new empire in a free one
  for (const x of slots) if (!x.on && !x.empty) box.append(h('button', { cls: 'small tslot', id: 'tSlot' + x.n, disabled: x.bad ? '' : null,
    on: () => { const k = playSlot(x.n); if (k) closeTitle(k); else { TITLE.msg = 'That save could not be read, so nothing changed.'; titleDraw(); } } },
    h('b', null, 'Slot ' + x.n + ': ' + (x.bad ? 'damaged' : x.town + ', wave ' + x.wave)), h('small', null, x.bad ? 'Load a save file into it in Settings, Saves' : slotNote(x))));
  if (has) box.append(h('button', { id: 'tNew', on: () => { if (free) { const k = playSlot(free.n); if (k) closeTitle(k); else { TITLE.msg = 'Could not put this empire in its slot (storage is full), so nothing changed.'; titleDraw(); } } else { TITLE.ask = true; titleDraw(); } } },
    'New game' + (free ? ' in slot ' + free.n : '')));
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
