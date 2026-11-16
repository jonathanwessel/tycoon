'use strict';
/* =========================================================
   Interface: save slots, save files and save codes (Settings, Saves)
   Three slots on this device, each with Play, Save file, Copy code and Erase. A save brought in from a file or a
   pasted code is shown first (town, wave, towns, when it was saved), then goes into the slot you pick. Loading over
   the empire in play, or starting over, keeps an undo copy until the next one.
   ========================================================= */
const SAVES = { pend: null, msg: '' };
function ago(t) {
  if (!t) return 'not played yet'; const m = Math.max(0, (Date.now() - t) / 60000);
  return m < 2 ? 'played just now' : m < 60 ? 'played ' + Math.round(m) + ' minutes ago' : m < 1440 ? 'played ' + Math.round(m / 60) + ' hour' + (Math.round(m / 60) > 1 ? 's' : '') + ' ago'
    : m < 2880 ? 'played yesterday' : 'played ' + Math.round(m / 1440) + ' days ago';
}
function slotNote(x) { return (x.towns > 1 ? x.towns + ' towns · ' : '') + fmt(x.coins) + ' coins earned' + (x.legacy ? ' · ' + x.legacy + ' Legacy' : '') + ' · ' + ago(x.last); }
function slotSwapNote() {
  const n = slotList().filter(x => !x.on && !x.empty).length;
  return 'Playing slot ' + slotOn() + ': ' + TOWN.n + '.' + (n ? (n > 1 ? ' The other empires wait in their slots' : ' The other empire waits in its slot') + ', paused until you play them.' : '');
}
/* A slot's empire as a file: the share sheet on phones (Files, Drive, a message to yourself), a download elsewhere. */
async function saveToFile(n) {
  if (n === slotOn()) save();
  const o = slotSave(n); if (!saveSummary(o)) return say('That slot has nothing to save.');
  const name = saveFileName(o), blob = new Blob([JSON.stringify(o)], { type: 'application/json' });
  try {
    const file = new File([blob], name, { type: 'application/json' }), touch = matchMedia('(pointer: coarse)').matches;
    if (touch && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Copper Gulch save' }); return say('Save file sent. Keep it somewhere safe.'); }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000); say('Saved as ' + name + '. Keep it somewhere safe.');
}
/* A slot's empire as a short code (copied when the browser allows it, otherwise shown to copy by hand). */
async function copyCode(n, out) {
  if (n === slotOn()) save();
  const o = slotSave(n); if (!saveSummary(o)) return;
  const code = await saveCode(o); out.value = code; out.hidden = false; let ok = false;
  try { await navigator.clipboard.writeText(code); ok = true; } catch (e) {}
  if (!ok) { out.focus(); out.select(); }
  say(ok ? 'Save code for slot ' + n + ' copied. Paste it on the other device in Settings, Saves.' : 'Save code ready: copy it from the box.');
}
const SAVE_ERR = { bad: 'That is not a Copper Gulch save. Paste the whole code, or pick the .json file, and try again.', empty: 'Paste a save code into the box first.',
  newer: 'That save comes from a newer version of Copper Gulch. Update this one first (Check for updates in the Charter tab), then load it.',
  old: 'This browser cannot read compressed save codes. Use a save file instead.' };
function closeSettings() { const m = $('modal'); m.hidden = true; m.className = 'modal'; m.onclick = null; setUps = []; save(); }
function savesTab(body) {
  const redraw = () => openSettings('saves');
  if (SAVES.msg) { body.append(h('p', { cls: 'svmsg' }, SAVES.msg)); SAVES.msg = ''; }
  body.append(h('h2', null, 'Save slots'), h('p', null, 'Each slot is a whole empire. The one you play is saved every few seconds; the others wait, paused, until you play them. Settings stay with this device.'));
  const out = h('textarea', { cls: 'svcode', 'aria-label': 'Save code', readonly: '', hidden: '' });
  for (const x of slotList()) {
    const bar = h('div', { cls: 'bar' });
    if (!x.on) bar.append(h('button', { cls: 'small' + (x.empty || x.bad ? '' : ' primary'), id: 'svPlay' + x.n, disabled: x.bad ? '' : null, on: () => {
      const k = playSlot(x.n); if (!k) { SAVES.msg = 'Could not switch slots (that save could not be read, or storage is full), so nothing changed.'; return redraw(); }
      closeSettings(); refresh(); if (k === 'new') setTimeout(tutOffer, 700); else say(slotSwapNote()); } }, x.empty ? 'New game here' : 'Play'));
    if (!x.empty && !x.bad) bar.append(h('button', { cls: 'small', id: 'svFile' + x.n, on: () => saveToFile(x.n) }, 'Save file'), h('button', { cls: 'small', id: 'svCode' + x.n, on: () => copyCode(x.n, out) }, 'Copy code'));
    if (!x.empty) { let armed = false; const er = h('button', { cls: 'small danger', id: 'svErase' + x.n, on: () => {
      if (!armed) { armed = true; er.textContent = x.on ? 'Tap again to start over' : 'Tap again to erase'; return; }
      if (!eraseSlot(x.n)) { SAVES.msg = 'Could not keep a copy first (storage is full), so nothing was erased.'; return redraw(); }
      SAVES.msg = x.on ? 'Slot ' + x.n + ' starts over from a bare plot. Changed your mind? Bring it back below.' : 'Slot ' + x.n + ' erased.'; refresh(); redraw(); } }, x.on ? 'Start over' : 'Erase'); bar.append(er); }
    const info = x.empty ? 'Empty' : x.bad ? 'Damaged: this save cannot be read. Load a file into it, or erase it.' : x.town + ', wave ' + x.wave + ' · ' + (x.on ? (x.towns > 1 ? x.towns + ' towns · ' : '') + 'playing now' : slotNote(x));
    body.append(h('div', { cls: 'slotrow' + (x.on ? ' on' : '') }, h('div', { cls: 'name' }, 'Slot ' + x.n + (x.on ? ' · in play' : '')), h('small', null, info), bar));
  }
  body.append(out);
  const u = undoInfo();
  if (u) body.append(h('div', { cls: 'slotrow' }, h('div', { cls: 'name' }, 'Undo'), h('small', null, 'Bring back ' + u.town + ', wave ' + u.wave + ' (replaced by the last load or start over) into slot ' + slotOn() + '. The empire there now is replaced.'),
    h('div', { cls: 'bar' }, h('button', { cls: 'small', id: 'svUndo', on: () => { SAVES.msg = undoLoad() ? 'Brought back ' + TOWN.n + ', wave ' + S.wave + '.' : 'That copy could not be read.'; refresh(); redraw(); } }, 'Bring it back'))));
  // bringing a save in: read it, show what it is, then pick its slot
  body.append(h('h2', null, 'Load a save'), h('p', null, 'From a save file, or a code copied on another device. Nothing changes until you pick a slot for it.'));
  const inp = h('textarea', { id: 'saveIn', 'aria-label': 'Paste a save code', placeholder: 'Paste a save code here' });
  const show = r => { if (r.err) { SAVES.pend = null; SAVES.msg = SAVE_ERR[r.err] || SAVE_ERR.bad; } else { SAVES.pend = r; } redraw(); };
  const pickFile = () => { const f = h('input', { type: 'file', accept: '.json,application/json,text/plain' }); f.onchange = () => { const x = f.files && f.files[0]; if (x) x.text().then(t => readSaveCode(t)).then(show, () => show({ err: 'bad' })); }; f.click(); };
  body.append(inp, h('div', { cls: 'bar' }, h('button', { cls: 'small', id: 'svRead', on: () => readSaveCode(inp.value).then(show) }, 'Read code'), h('button', { cls: 'small', id: 'svOpen', on: pickFile }, 'Open a save file')));
  const p = SAVES.pend; if (!p) return;
  const s = p.s, when = s.last ? new Date(s.last).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const pick = h('div', { cls: 'bar' });
  for (const x of slotList()) { let armed = x.empty; const b = h('button', { cls: 'small' + (x.empty ? ' primary' : ''), id: 'svInto' + x.n, on: () => {
    if (!armed) { armed = true; b.textContent = 'Tap again to replace slot ' + x.n; return; }
    const ok = loadInto(x.n, p.o); SAVES.pend = null;
    SAVES.msg = !ok ? 'Could not store it (storage is full), so nothing changed.' : x.on ? 'Loaded into slot ' + x.n + ': ' + TOWN.n + ', wave ' + S.wave + '. The empire it replaced can be brought back below.' : 'Loaded into slot ' + x.n + '. Play it from here or from the title screen.';
    if (ok && x.on) { W.countdown = 15; refresh(); } redraw(); } }, x.empty ? 'Into slot ' + x.n + ' (empty)' : 'Replace slot ' + x.n + (x.on ? ' (in play)' : ': ' + (x.bad ? 'damaged' : x.town + ', wave ' + x.wave)));
    pick.append(b); }
  body.append(h('div', { cls: 'slotrow svpend', id: 'svPend' }, h('div', { cls: 'name' }, 'Ready to load: ' + s.town + ', wave ' + s.wave),
    h('small', null, (s.towns > 1 ? s.towns + ' towns · ' : '') + fmt(s.coins) + ' coins earned' + (s.legacy ? ' · ' + s.legacy + ' Legacy' : '') + (when ? ' · saved ' + when : '')), pick,
    h('div', { cls: 'bar' }, h('button', { cls: 'small', on: () => { SAVES.pend = null; redraw(); } }, 'Cancel'))));
}
