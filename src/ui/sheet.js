'use strict';
/* =========================================================
   Interface: the menu sheet
   Docked beside the map on wide screens; on a phone a sheet that slides up over the town.
   ========================================================= */
/* The menus. Side by side with the map on wide screens (docked); on a phone they live in a sheet that slides up over
   the town: a tab opens it (the same tab again, a tap on the map, Back or Escape closes it), its head drags it taller,
   shorter or away. Tapping something on the map closes it and shows that thing's card instead. */
const DOCK = window.matchMedia ? matchMedia('(min-width: 900px), (orientation: landscape) and (min-width: 600px)') : { matches: true };
const docked = () => DOCK.matches;
const SHEET = { open: false, h: .55 };
function setSheetH(f) { SHEET.h = f; document.documentElement.style.setProperty('--sheet-h', Math.round(innerHeight * f) + 'px'); }
function openSheet() {
  if (docked()) return; sel = null;
  if (!SHEET.open) { SHEET.open = true; setSheetH(SHEET.h); document.body.classList.add('sheet-open'); try { history.pushState({ sheet: 1 }, ''); } catch (e) {} }
}
function closeSheet(fromBack) {
  if (!SHEET.open) return; SHEET.open = false; document.body.classList.remove('sheet-open');
  if (!fromBack && history.state && history.state.sheet) try { history.back(); } catch (e) {}
  refresh();
}
window.addEventListener('popstate', () => closeSheet(true));
function goTab(id) {
  if (!docked() && SHEET.open && tab === id) return closeSheet();
  if (tab !== id || !SHEET.open) snd('tab', 520, .03, 'square', .015, 160);
  tab = id; rebuild = true; $('sheet').scrollTop = 0; openSheet(); refresh();
}
