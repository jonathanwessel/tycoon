'use strict';
/* =========================================================
   Pixel art, painted by code
   ========================================================= */
const SPR = {}, URLS = {};
function mk(name, w, h, fn) {
  const cvs = document.createElement('canvas'); cvs.width = w; cvs.height = h; const g = cvs.getContext('2d');
  const p = (col, x, y, ww = 1, hh = 1) => { if (col) { g.fillStyle = col; g.fillRect(x, y, ww, hh); } else g.clearRect(x, y, ww, hh); };
  p.disc = (col, cx, cy, r) => { for (let y = Math.floor(cy - r); y < cy + r; y++) for (let x = Math.floor(cx - r); x < cx + r; x++) if (Math.hypot(x + .5 - cx, y + .5 - cy) <= r) p(col, x, y); };
  p.img = (n, x = 0, y = 0) => g.drawImage(SPR[n], x, y);
  fn(p);
  const d = g.getImageData(0, 0, w, h), a = d.data, o = new Uint8ClampedArray(a);
  const op = (x, y) => x >= 0 && y >= 0 && x < w && y < h && o[(y * w + x) * 4 + 3] > 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!op(x, y) && (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1))) { const i = (y * w + x) * 4; a[i] = 42; a[i + 1] = 28; a[i + 2] = 34; a[i + 3] = 255; }
  g.putImageData(d, 0, 0);
  SPR[name] = cvs;
}
function iconURL(name) {
  if (!URLS[name]) { const im = SPR[name], c = document.createElement('canvas'); c.width = im.width * 4; c.height = im.height * 4; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(im, 0, 0, c.width, c.height); URLS[name] = c.toDataURL(); }
  return URLS[name];
}
const P = { wood: '#a8703f', woodL: '#d9a066', woodD: '#6e4526', grey: '#8f9bb0', greyL: '#c9d2de', greyD: '#5a6378', teal: '#56d3c6', tealL: '#b5f5ee', tealD: '#2f9c92', cop: '#e38d4e', copD: '#a85a2a', yel: '#f2d04a', yelL: '#fff0a0', red: '#f07067', redD: '#a83a3a', pur: '#b06be0', purD: '#6f3fa0', grn: '#5fae5a', grnD: '#36753f', grnL: '#8fd08a', blue: '#5b8be0', skin: '#f0c090', org: '#f5a04a', white: '#ece6d8', pink: '#ff4f8b', dark: '#3a2a2e', night: '#2a1c22', steel: '#7d8fb0', steelL: '#b8c6e0', steelD: '#4a5a78', brass: '#c8961e', coal: '#2f2a33', coalL: '#6a6372' };
function paintSprites() {
  // goods
  mk('wood', 14, 12, p => { p(P.wood, 1, 3, 10, 6); p(P.woodL, 1, 3, 10, 1); p(P.woodD, 1, 8, 10, 1); p(P.woodD, 4, 5, 3, 1); p(P.woodL, 10, 3, 3, 6); p(P.wood, 11, 5, 1, 2); });
  mk('ore', 12, 12, p => { p.disc(P.grey, 6, 6, 4.6); p(P.greyD, 2, 8, 8, 2); p(P.greyL, 4, 2, 3, 1); p(P.cop, 3, 4, 2, 2); p(P.cop, 7, 6, 2, 2); p(P.org, 6, 3, 1, 1); p(P.org, 4, 7, 1, 1); });
  mk('crystal', 12, 14, p => { p(P.teal, 5, 1, 2, 1); p(P.teal, 4, 2, 4, 2); p(P.teal, 3, 4, 6, 5); p(P.teal, 4, 9, 4, 2); p(P.teal, 5, 11, 2, 2); p(P.tealL, 4, 3, 1, 6); p(P.tealL, 5, 2, 1, 1); p(P.tealD, 7, 4, 2, 5); p(P.tealD, 6, 9, 2, 2); });
  mk('plank', 14, 12, p => { for (const y of [1, 4, 7]) { p(P.woodL, 1, y, 12, 2); p(P.wood, 1, y + 2, 12, 1); p(P.woodD, 2, y, 1, 1); p(P.woodD, 11, y, 1, 1); } p(P.woodD, 1, 10, 12, 1); });
  mk('ingot', 14, 11, p => { p(P.greyL, 4, 2, 7, 1); p(P.greyL, 3, 3, 9, 1); p(P.grey, 2, 4, 11, 3); p(P.greyD, 1, 7, 12, 2); p(P.white, 5, 2, 4, 1); p(P.greyL, 3, 4, 8, 1); });
  mk('lens', 12, 12, p => { p.disc(P.cop, 6, 6, 5.2); p.disc('#8fe8ff', 6, 6, 4); p.disc(P.tealL, 5.5, 5.5, 2.2); p(P.white, 4, 3, 2, 1); p(P.white, 3, 4, 1, 2); });
  mk('gear', 14, 14, p => { p(P.cop, 6, 1, 2, 12); p(P.cop, 1, 6, 12, 2); p(P.cop, 2, 2, 3, 3); p(P.cop, 9, 2, 3, 3); p(P.cop, 2, 9, 3, 3); p(P.cop, 9, 9, 3, 3); p.disc(P.cop, 7, 7, 4.4); p.disc(P.copD, 7, 7, 2.6); p.disc(null, 7, 7, 1.4); p('#f3b27e', 4, 3, 2, 1); p('#f3b27e', 6, 1, 1, 2); });
  mk('engine', 14, 14, p => { p(P.yel, 3, 1, 2, 4); p(P.yel, 8, 1, 2, 4); p(P.yelL, 3, 1, 1, 2); p(P.yelL, 8, 1, 1, 2); p(P.greyD, 2, 5, 10, 7); p(P.grey, 2, 5, 10, 2); p(P.dark, 4, 8, 5, 2); p(P.cop, 1, 7, 1, 3); p(P.cop, 12, 7, 1, 3); p(P.woodD, 1, 12, 12, 1); p(P.red, 10, 9, 1, 1); });
  mk('coin', 12, 12, p => { p.disc('#c8961e', 6, 6, 5.2); p.disc(P.yel, 6, 6, 4.2); p(P.yelL, 4, 3, 2, 1); p(P.yelL, 3, 4, 1, 2); p('#c8961e', 5, 4, 2, 1); p('#c8961e', 6, 5, 1, 3); p('#c8961e', 5, 8, 3, 1); });
  // scenery
  mk('tree', 14, 17, p => { p(P.woodD, 6, 10, 2, 6); p(P.wood, 6, 10, 1, 6); p.disc(P.grnD, 7, 7, 5.6); p.disc(P.grn, 6.5, 6, 4.2); p(P.grnL, 4, 3, 3, 1); p(P.grnL, 3, 4, 1, 2); p(P.grnD, 8, 8, 2, 1); });
  mk('stump', 14, 17, p => { p(P.woodD, 5, 12, 4, 4); p(P.woodL, 5, 12, 4, 1); p(P.wood, 6, 13, 1, 2); });
  mk('rock', 16, 13, p => { p(P.grey, 2, 5, 12, 6); p(P.grey, 4, 2, 7, 3); p(P.greyL, 4, 2, 5, 1); p(P.greyL, 2, 5, 2, 1); p(P.greyD, 2, 9, 12, 2); p(P.greyD, 9, 4, 1, 4); p(P.cop, 5, 6, 2, 1); p(P.cop, 11, 6, 2, 2); p(P.org, 6, 8, 1, 1); p(P.cop, 7, 3, 1, 1); });
  mk('cactus', 12, 14, p => { p(P.grn, 5, 1, 3, 12); p(P.grn, 1, 4, 2, 4); p(P.grn, 3, 7, 2, 1); p(P.grn, 9, 3, 2, 4); p(P.grn, 8, 6, 1, 1); p(P.grnL, 5, 1, 1, 11); p(P.grnL, 1, 4, 1, 3); p(P.grnD, 7, 2, 1, 11); p(P.pink, 6, 0, 1, 1); });
  mk('sign', 12, 14, p => { p(P.woodD, 5, 6, 2, 7); p(P.woodL, 1, 1, 10, 5); p(P.wood, 1, 5, 10, 1); p(P.woodD, 3, 3, 6, 1); });
  // buildings (16x16)
  const hut = (p, wall, wallD, roof, roofD) => { p(roof, 5, 2, 6, 1); p(roof, 4, 3, 8, 1); p(roof, 3, 4, 10, 1); p(roof, 2, 5, 12, 1); p(roofD, 1, 6, 14, 2); p(wall, 2, 8, 12, 6); p(wallD, 2, 13, 12, 1); p(P.dark, 7, 10, 3, 4); };
  mk('camp', 16, 16, p => { hut(p, P.wood, P.woodD, P.grn, P.grnD); p(P.woodL, 2, 8, 12, 1); p(P.woodL, 11, 11, 4, 1); p(P.wood, 10, 12, 5, 2); p(P.woodD, 11, 12, 1, 1); p(P.woodD, 13, 13, 1, 1); });
  mk('mine', 16, 16, p => { p(P.grey, 4, 2, 8, 3); p(P.grey, 2, 5, 12, 9); p(P.greyL, 4, 2, 5, 1); p(P.greyL, 2, 5, 2, 1); p(P.greyD, 11, 4, 3, 2); p(P.greyD, 2, 13, 12, 1); p(P.woodL, 4, 7, 8, 1); p(P.wood, 4, 8, 1, 6); p(P.wood, 11, 8, 1, 6); p(P.night, 5, 8, 6, 6); p(P.cop, 6, 11, 4, 2); p(P.greyD, 6, 13, 1, 1); p(P.greyD, 9, 13, 1, 1); });
  mk('drill', 16, 16, p => { for (let i = 0; i < 6; i++) { p(P.wood, 6 - i, 3 + i * 2, 1, 2); p(P.wood, 9 + i, 3 + i * 2, 1, 2); } p(P.woodD, 4, 7, 8, 1); p(P.woodD, 2, 11, 12, 1); p(P.greyD, 7, 1, 2, 11); p(P.greyL, 7, 1, 1, 11); p(P.teal, 5, 12, 6, 3); p(P.tealL, 6, 12, 1, 2); p(P.tealD, 9, 13, 2, 2); });
  for (const f of [0, 1]) mk(f ? 'saw_b' : 'saw', 16, 16, p => { hut(p, P.woodL, P.wood, P.org, P.copD); p.disc(P.greyL, 12.5, 11.5, 3); p(P.greyD, 12, 11, 1, 1); if (f) { p(P.greyL, 12, 8, 1, 1); p(P.greyL, 15, 11, 1, 1); p(P.greyL, 9, 11, 1, 1); } else { p(P.greyL, 10, 9, 1, 1); p(P.greyL, 14, 9, 1, 1); p(P.greyL, 14, 13, 1, 1); } p(P.wood, 9, 14, 7, 1); });
  mk('smelt', 16, 16, p => { p(P.greyD, 11, 1, 3, 6); p(P.grey, 11, 1, 1, 6); p(P.dark, 11, 2, 3, 1); hut(p, P.grey, P.greyD, P.dark, P.night); p(P.org, 6, 10, 5, 4); p(P.yel, 7, 11, 3, 3); p(P.yelL, 8, 12, 1, 2); });
  mk('glass', 16, 16, p => { hut(p, P.white, P.greyL, P.blue, '#3b5fa8'); p(P.tealL, 3, 9, 3, 3); p(P.teal, 3, 11, 3, 1); p(P.tealL, 11, 9, 2, 3); p(P.teal, 11, 11, 2, 1); p(P.teal, 7, 0, 2, 2); p(P.tealL, 7, 0, 1, 1); });
  mk('mach', 16, 16, p => { hut(p, P.greyL, P.grey, P.cop, P.copD); p(P.cop, 3, 9, 1, 3); p(P.cop, 2, 10, 3, 1); p(P.copD, 3, 10, 1, 1); p(P.cop, 12, 9, 1, 3); p(P.cop, 11, 10, 3, 1); p(P.copD, 12, 10, 1, 1); p(P.greyD, 12, 2, 2, 4); });
  mk('eng', 16, 16, p => { p(P.greyD, 3, 1, 2, 5); p(P.yel, 3, 2, 2, 1); p(P.greyD, 10, 1, 2, 5); p(P.yel, 10, 2, 2, 1); p(P.dark, 1, 5, 14, 2); p(P.grey, 1, 7, 14, 7); p(P.greyD, 1, 13, 14, 1); p(P.yel, 1, 7, 14, 1); p(P.night, 6, 10, 4, 4); p(P.yelL, 2, 9, 2, 2); p(P.yelL, 12, 9, 2, 2); p(P.cop, 5, 9, 1, 5); p(P.cop, 10, 9, 1, 5); });
  mk('market', 16, 16, p => { for (let i = 0; i < 7; i++) { p(i % 2 ? P.white : P.red, 1 + i * 2, 2, 2, 4); } p(P.redD, 1, 6, 14, 1); p(P.woodD, 2, 7, 1, 7); p(P.woodD, 13, 7, 1, 7); p(P.woodL, 2, 10, 12, 1); p(P.wood, 2, 11, 12, 3); p(P.yel, 4, 8, 2, 2); p(P.teal, 7, 8, 2, 2); p(P.cop, 10, 8, 2, 2); });
  mk('vault', 18, 18, p => { p(P.greyD, 1, 1, 16, 3); p(P.grey, 2, 4, 14, 12); p(P.greyL, 2, 4, 14, 1); p(P.greyD, 2, 15, 14, 1); p(P.greyD, 5, 8, 1, 1); p(P.greyD, 13, 12, 1, 1); p.disc(P.copD, 9, 10, 4.6); p.disc(P.cop, 9, 10, 3.6); p(P.yelL, 8, 9, 2, 2); p(P.copD, 9, 6, 1, 2); p(P.copD, 9, 12, 1, 2); p(P.copD, 5, 10, 2, 1); p(P.copD, 11, 10, 2, 1); });
  for (const f of [0, 1]) mk(f ? 'wagon_b' : 'wagon', 20, 15, p => { p(P.white, 4, 1, 10, 2); p(P.white, 3, 3, 12, 5); p(P.greyL, 6, 1, 1, 7); p(P.greyL, 10, 1, 1, 7); p(P.wood, 2, 8, 14, 3); p(P.woodD, 2, 10, 14, 1); p(P.woodD, 16, 9, 3, 1); p.disc(P.dark, 5.5, 11.5, 2.5); p.disc(P.dark, 12.5, 11.5, 2.5); p(P.woodL, f ? 5 : 4, 11, 2, 1); p(P.woodL, f ? 12 : 11, 11, 2, 1); });
  // people and raiders, two walk frames each
  for (const f of [0, 1]) {
    const s = f ? '_b' : '';
    mk('worker' + s, 8, 11, p => { p(P.yel, 2, 1, 4, 1); p(P.skin, 3, 2, 2, 2); p(P.blue, 2, 4, 4, 3); p(P.woodD, f ? 3 : 2, 7, 1, 3); p(P.woodD, f ? 4 : 5, 7, 1, 3); });
    mk('raider' + s, 14, 15, p => { p('#4a3428', 5, 1, 4, 2); p('#4a3428', 3, 3, 8, 1); p(P.skin, 5, 4, 4, 2); p(P.red, 5, 6, 4, 1); p(P.redD, 4, 7, 6, 4); p(P.red, 4, 7, 6, 1); p(P.greyD, 9, 8, 4, 1); p(P.dark, 4, 10, 6, 1); p(P.woodD, f ? 6 : 4, 11, 2, 3); p(P.woodD, f ? 7 : 8, 11, 2, 3); });
    mk('runner' + s, 18, 15, p => { p('#4a3428', 6, 1, 5, 1); p(P.skin, 7, 2, 3, 2); p(P.org, 7, 4, 3, 4); p(P.wood, 3, 7, 10, 4); p(P.woodL, 3, 7, 10, 1); p(P.wood, 12, 4, 3, 4); p(P.wood, 15, 6, 1, 2); p(P.woodD, 13, 3, 1, 1); p(P.dark, 14, 5, 1, 1); p(P.woodD, 1, 7, 2, 1); p(P.woodD, 1, 8, 1, 3); p(P.woodD, f ? 5 : 3, 11, 1, 3); p(P.woodD, f ? 6 : 8, 11, 1, 3); p(P.woodD, f ? 10 : 12, 11, 1, 3); });
    mk('brute' + s, 16, 16, p => { p(P.greyD, 6, 1, 4, 1); p(P.skin, 6, 2, 4, 3); p(P.dark, 7, 3, 1, 1); p(P.dark, 9, 3, 1, 1); p(P.pur, 4, 5, 8, 7); p(P.purD, 4, 10, 8, 2); p(P.dark, 4, 9, 8, 1); p(P.yel, 7, 9, 2, 1); p(P.purD, 2, 5, 2, 6); p(P.purD, 12, 5, 2, 4); p(P.woodD, 13, 2, 2, 7); p(P.wood, 13, 1, 2, 3); p(P.purD, f ? 6 : 5, 12, 2, 3); p(P.purD, f ? 8 : 9, 12, 2, 3); });
    mk('boss' + s, 22, 18, p => { p(P.dark, 5, 1, 1, 6); p(P.pink, 6, 1, 5, 3); p('#4a3428', 2, 7, 15, 6); p(P.greyD, 2, 6, 15, 2); p(P.grey, 2, 6, 15, 1); p(P.greyD, 6, 8, 1, 5); p(P.greyD, 12, 8, 1, 5); p(P.white, 8, 9, 3, 3); p(P.dark, 8, 10, 1, 1); p(P.dark, 10, 10, 1, 1); p(P.greyL, 17, 8, 3, 1); p(P.greyL, 17, 11, 3, 1); p.disc(P.dark, 5.5, 14, 3); p.disc(P.dark, 13.5, 14, 3); p(P.grey, f ? 5 : 4, 13, 2, 2); p(P.grey, f ? 13 : 12, 13, 2, 2); });
  }
  // tower bodies
  mk('crossbow', 16, 16, p => { p(P.woodD, 3, 9, 2, 6); p(P.woodD, 11, 9, 2, 6); p(P.woodD, 4, 12, 8, 1); p(P.wood, 2, 6, 12, 4); p(P.woodL, 2, 6, 12, 1); p(P.woodD, 2, 9, 12, 1); p(P.greyD, 7, 7, 2, 2); });
  mk('cannon', 16, 16, p => { p.disc(P.greyD, 8, 9.5, 6); p.disc(P.grey, 8, 8.5, 5); p.disc(P.greyL, 8, 8, 3.4); p.disc(P.grey, 8, 8.5, 2.4); p(P.greyD, 3, 12, 1, 1); p(P.greyD, 12, 12, 1, 1); });
  mk('frost', 16, 18, p => { p(P.greyD, 3, 13, 10, 4); p(P.grey, 3, 13, 10, 1); p('#8fe8ff', 7, 1, 2, 2); p('#8fe8ff', 6, 3, 4, 4); p('#8fe8ff', 5, 7, 6, 6); p(P.white, 6, 4, 1, 7); p(P.white, 7, 2, 1, 2); p(P.teal, 9, 5, 1, 8); p(P.teal, 10, 8, 1, 5); p('#8fe8ff', 2, 9, 2, 4); p(P.white, 2, 9, 1, 3); p('#8fe8ff', 12, 10, 2, 3); });
  mk('tesla', 16, 18, p => { p(P.woodD, 3, 14, 10, 3); p(P.wood, 3, 14, 10, 1); p(P.greyD, 7, 6, 2, 8); p(P.cop, 5, 7, 6, 1); p(P.cop, 4, 9, 8, 1); p(P.cop, 5, 11, 6, 1); p(P.copD, 4, 13, 8, 1); p.disc(P.yel, 8, 3.5, 2.6); p(P.yelL, 7, 2, 1, 1); });
}
function paintSprites2() {
  const hut = (p, wall, wallD, roof, roofD) => { p(roof, 5, 2, 6, 1); p(roof, 4, 3, 8, 1); p(roof, 3, 4, 10, 1); p(roof, 2, 5, 12, 1); p(roofD, 1, 6, 14, 2); p(wall, 2, 8, 12, 6); p(wallD, 2, 13, 12, 1); p(P.dark, 7, 10, 3, 4); };
  // third-tier goods
  mk('coal', 12, 11, p => { p.disc(P.coal, 4, 6, 3.4); p.disc('#3d3742', 8, 5, 3.2); p.disc(P.coal, 7, 8, 2.6); p(P.coalL, 3, 4, 2, 1); p(P.coalL, 8, 3, 2, 1); p('#8a8396', 7, 3, 1, 1); });
  mk('steel', 14, 11, p => { p(P.steel, 1, 1, 12, 2); p(P.steelL, 1, 1, 12, 1); p('#5d6f90', 5, 3, 4, 5); p(P.steel, 6, 3, 1, 5); p(P.steel, 1, 8, 12, 2); p(P.steelD, 1, 9, 12, 1); });
  mk('clock', 13, 13, p => { p.disc(P.brass, 6.5, 6.5, 6); p.disc(P.yelL, 6.5, 6.5, 4.6); p(P.dark, 6, 3, 1, 4); p(P.dark, 6, 6, 3, 1); p(P.brass, 6, 0, 1, 1); p(P.brass, 0, 6, 1, 1); p(P.brass, 12, 6, 1, 1); p(P.brass, 6, 12, 1, 1); });
  mk('auto', 12, 15, p => { p(P.greyL, 3, 1, 6, 5); p(P.grey, 3, 5, 6, 1); p(P.teal, 4, 3, 1, 1); p(P.teal, 7, 3, 1, 1); p(P.yel, 5, 0, 2, 1); p(P.cop, 2, 6, 8, 5); p(P.copD, 2, 10, 8, 1); p(P.yel, 5, 7, 2, 2); p(P.greyD, 0, 6, 2, 4); p(P.greyD, 10, 6, 2, 4); p(P.greyD, 3, 11, 2, 3); p(P.greyD, 7, 11, 2, 3); });
  mk('star', 9, 9, p => { p(P.yel, 4, 0, 1, 2); p(P.yel, 0, 3, 9, 1); p(P.yel, 1, 4, 7, 1); p(P.yel, 2, 5, 5, 1); p(P.yel, 3, 2, 3, 2); p(P.yel, 2, 6, 2, 2); p(P.yel, 5, 6, 2, 2); p(P.yelL, 4, 2, 1, 2); });
  // third-row buildings
  mk('pit', 16, 16, p => { p('#4a3a30', 1, 9, 14, 5); p('#3a2e26', 3, 7, 10, 2); p(P.night, 5, 9, 6, 4); p(P.woodD, 4, 8, 1, 6); p(P.woodD, 11, 8, 1, 6); p(P.wood, 4, 7, 8, 1); p(P.coal, 9, 12, 5, 2); p(P.greyD, 9, 11, 5, 1); p(P.coal, 10, 10, 3, 1); p.disc(P.dark, 10, 14.5, 1); p.disc(P.dark, 13, 14.5, 1); p(P.coalL, 2, 9, 2, 1); });
  mk('mill', 16, 16, p => { p(P.greyD, 11, 0, 3, 7); p(P.steel, 11, 0, 1, 7); p(P.red, 11, 1, 3, 1); hut(p, P.steel, P.steelD, P.greyD, P.dark); p(P.org, 3, 9, 2, 3); p(P.org, 11, 9, 2, 3); p(P.yel, 3, 10, 1, 1); });
  mk('clockw', 16, 16, p => { hut(p, P.white, P.greyL, P.brass, '#8a6a1a'); p.disc(P.brass, 8, 4.5, 3.2); p.disc(P.yelL, 8, 4.5, 2.2); p(P.dark, 8, 3, 1, 2); p(P.dark, 8, 4, 2, 1); p(P.cop, 3, 9, 2, 2); p(P.cop, 11, 9, 2, 2); });
  mk('autow', 16, 16, p => { for (let i = 0; i < 4; i++) { p(P.teal, 1 + i * 4, 2, 3, 2); p(P.tealD, 1 + i * 4, 3, 1, 1); } p(P.greyD, 1, 4, 14, 10); p(P.grey, 1, 4, 14, 2); p(P.night, 6, 9, 4, 5); p(P.teal, 3, 8, 2, 2); p(P.teal, 11, 8, 2, 2); p(P.yel, 1, 13, 14, 1); p(P.cop, 7, 7, 2, 1); });
  mk('hall', 16, 16, p => { hut(p, P.woodL, P.wood, P.redD, '#6e2a2a'); p(P.woodD, 13, 0, 1, 7); p(P.yel, 10, 0, 3, 2); p(P.white, 3, 9, 3, 2); p(P.white, 10, 9, 3, 2); });
  mk('office', 16, 16, p => { p(P.greyL, 6, 1, 4, 1); p(P.greyL, 4, 2, 8, 1); p(P.greyL, 2, 3, 12, 2); p(P.grey, 1, 5, 14, 1); for (const x of [2, 5, 9, 12]) { p(P.white, x, 6, 2, 7); p(P.greyL, x + 1, 6, 1, 7); } p(P.night, 7, 9, 2, 4); p(P.grey, 1, 13, 14, 2); p(P.yel, 7, 3, 2, 1); });
  // town folk
  for (const f of [0, 1]) mk('foreman' + (f ? '_b' : ''), 9, 12, p => { p(P.org, 2, 0, 5, 2); p(P.org, 1, 1, 7, 1); p(P.skin, 3, 2, 3, 2); p(P.grnD, 2, 4, 5, 4); p(P.white, 6, f ? 4 : 5, 3, 3); p(P.woodD, 6, f ? 4 : 5, 3, 1); p(P.woodD, 2, 8, 2, 3); p(P.woodD, 5, 8, 2, 3); });
  mk('buckler', 8, 11, p => { p(P.steel, 1, 0, 6, 7); p(P.steelL, 1, 0, 6, 1); p(P.steelL, 1, 0, 1, 6); p(P.steel, 2, 7, 4, 2); p(P.steel, 3, 9, 2, 1); p(P.steelD, 3, 2, 2, 4); p(P.yel, 3, 3, 2, 1); });
  // new raiders
  for (const f of [0, 1]) {
    const s = f ? '_b' : '';
    mk('shield' + s, 14, 15, p => { p(P.greyL, 5, 0, 4, 1); p(P.grey, 4, 1, 6, 3); p(P.dark, 5, 2, 4, 1); p(P.skin, 5, 4, 4, 1); p(P.steel, 4, 5, 6, 5); p(P.steelL, 4, 5, 6, 1); p(P.steelD, 4, 9, 6, 1); p(P.woodD, 10, 3, 1, 7); p(P.greyL, 10, 1, 1, 2); p(P.steelD, f ? 5 : 4, 10, 2, 4); p(P.steelD, f ? 7 : 8, 10, 2, 4); });
    mk('sapper' + s, 14, 15, p => { p(P.grnD, 4, 1, 6, 2); p(P.skin, 5, 3, 4, 2); p(P.dark, 6, 3, 2, 1); p(P.grn, 4, 5, 6, 5); p(P.grnD, 4, 9, 6, 1); p.disc(P.coal, 11, 7.5, 2.4); p(P.coalL, 10, 6, 1, 1); p(P.woodL, 12, 4, 1, 2); p(P.org, 12, 3, 1, 1); p(P.woodD, f ? 6 : 4, 10, 2, 4); p(P.woodD, f ? 7 : 8, 10, 2, 4); });
    mk('healer' + s, 14, 15, p => { p(P.white, 4, 0, 6, 3); p(P.skin, 5, 3, 4, 2); p(P.white, 3, 5, 8, 7); p(P.greyL, 3, 11, 8, 1); p(P.grn, 6, 6, 2, 4); p(P.grn, 5, 7, 4, 2); p(P.woodD, 1, 2, 1, 11); p(P.grnL, 0, 1, 3, 2); p(P.greyL, f ? 5 : 4, 12, 2, 2); p(P.greyL, f ? 7 : 8, 12, 2, 2); });
    mk('thief' + s, 14, 14, p => { p(P.purD, 4, 0, 6, 3); p(P.dark, 5, 2, 4, 1); p(P.skin, 5, 3, 4, 1); p(P.purD, 3, 4, 8, 6); p(P.pur, 4, 4, 2, 5); p(P.woodL, 9, 4, 4, 4); p(P.wood, 9, 7, 4, 1); p(P.yel, 10, 5, 1, 1); p(P.dark, f ? 5 : 3, 10, 2, 3); p(P.dark, f ? 7 : 9, 10, 2, 3); });
  }
  // gatling and branch bodies
  mk('gatling', 16, 16, p => { p.disc('#a8865a', 8, 10, 6.4); p.disc('#c9a476', 8, 9.5, 5.4); for (const [x, y] of [[3, 8], [6, 5], [10, 5], [12, 9], [9, 13], [5, 12]]) p('#8a6a48', x, y, 2, 1); p.disc(P.steelD, 8, 9.5, 3.2); p.disc(P.steel, 8, 9, 2.2); });
  const add = (n, base, fn) => mk(n, SPR[base].width, SPR[base].height, p => { p.img(base); fn(p); });
  add('crossbow_a', 'crossbow', p => { p(P.woodL, 1, 10, 4, 3); p(P.woodD, 1, 12, 4, 1); p(P.yel, 2, 11, 1, 1); p(P.yel, 4, 11, 1, 1); });
  add('crossbow_b', 'crossbow', p => { p(P.woodD, 2, 13, 1, 3); p(P.woodD, 13, 13, 1, 3); p(P.red, 13, 0, 2, 2); p(P.woodD, 12, 0, 1, 6); });
  add('cannon_a', 'cannon', p => { for (const [x, y] of [[1, 12], [4, 14], [9, 14], [13, 12]]) p('#c9a476', x, y, 3, 2); });
  add('cannon_b', 'cannon', p => { for (const [x, y] of [[4, 5], [11, 5], [3, 11], [12, 11]]) p(P.yel, x, y, 1, 1); p(P.steelD, 2, 13, 12, 1); });
  add('frost_a', 'frost', p => { p('#5a9ad8', 2, 9, 2, 4); p('#5a9ad8', 12, 10, 2, 3); p(P.white, 7, 0, 2, 1); p('#5a9ad8', 9, 5, 1, 8); });
  add('frost_b', 'frost', p => { p('#c7a0ff', 6, 6, 1, 1); p('#c7a0ff', 7, 7, 1, 2); p('#c7a0ff', 8, 9, 1, 1); p('#c7a0ff', 9, 10, 1, 2); p('#c7a0ff', 12, 10, 2, 1); });
  add('frost_c', 'frost', p => { p('#e8f8ff', 2, 9, 2, 4); p('#e8f8ff', 12, 10, 2, 3); p(P.red, 7, 8, 2, 1); p(P.red, 6, 10, 1, 1); p(P.red, 9, 11, 1, 1); });
  add('tesla_a', 'tesla', p => { p(P.cop, 1, 9, 2, 5); p(P.yel, 1, 8, 2, 1); p(P.cop, 13, 9, 2, 5); p(P.yel, 13, 8, 2, 1); });
  add('tesla_b', 'tesla', p => { p.disc(P.red, 8, 3.5, 2.6); p(P.pink, 7, 2, 1, 1); p(P.redD, 4, 9, 8, 1); });
  // the Barracks: a log fort with a gate and a blue flag; soldiers in blue coats with rifles (two walking frames)
  mk('barracks', 16, 18, p => { for (let x = 2; x < 14; x += 2) { p(P.woodD, x, 6, 2, 10); p(P.wood, x, 6, 1, 9); p(P.woodL, x, 5, 1, 1); } p(P.dark, 6, 10, 4, 6); p(P.woodD, 5, 9, 6, 1); p(P.woodD, 7, 0, 1, 7); p('#5b8bc0', 8, 0, 5, 3); p(P.white, 9, 1, 2, 1); });
  for (const [s, f] of [['', 0], ['_b', 1]]) mk('soldier' + s, 12, 14, p => { p('#2b3a5a', 3, 0, 6, 2); p(P.skin, 4, 2, 4, 3); p(P.dark, 5, 3, 1, 1); p('#5b8bc0', 3, 5, 6, 5); p(P.yel, 5, 6, 1, 1); p(P.yel, 5, 8, 1, 1); p(P.woodD, 9, 3, 1, 7); p(P.greyD, 9, 1, 1, 2); p('#2b3a5a', f ? 3 : 4, 10, 2, 4); p('#2b3a5a', f ? 7 : 6, 10, 2, 4); });
  // the Drone Helipad: a round pad with an H and lights; the drone: four rotors on a dark body
  mk('helipad', 16, 18, p => { p.disc(P.greyD, 8, 12, 7); p.disc(P.grey, 8, 11.5, 6); p(P.yel, 5, 8, 1, 7); p(P.yel, 10, 8, 1, 7); p(P.yel, 6, 11, 4, 1); for (const [x, y] of [[2, 11], [14, 11], [8, 5], [8, 17]]) p(P.red, x - 1, y - 1, 2, 1); p(P.woodD, 1, 2, 1, 6); p('#5b8bc0', 2, 2, 3, 2); });
  mk('drone', 14, 10, p => { for (const [x, y] of [[0, 0], [10, 0], [0, 7], [10, 7]]) { p(P.greyL, x, y, 4, 1); p(P.dark, x + 1, y + 1, 2, 1); } p(P.dark, 3, 1, 8, 1); p(P.dark, 3, 8, 8, 1); p(P.greyD, 4, 3, 6, 4); p(P.red, 6, 4, 2, 1); p(P.tealL, 5, 6, 4, 1); });
  // the Snake Oil Still: a copper pot over a fire, a coiled pipe and a glass jar of green poison
  mk('still', 16, 18, p => { p(P.woodD, 3, 15, 10, 2); p(P.org, 5, 14, 6, 1); p.disc(P.cop, 7, 9.5, 4.4); p(P.copD, 3, 12, 9, 2); p('#f5b07a', 5, 7, 2, 2); p(P.copD, 6, 3, 2, 3); p(P.cop, 6, 2, 5, 1); p(P.greyD, 11, 3, 1, 5); p(P.greyD, 11, 8, 2, 1); p('#5fae5a', 12, 9, 3, 5); p('#9dff7a', 12, 9, 1, 3); p(P.greyD, 12, 14, 3, 1); });
  add('still_a', 'still', p => { p('#8fd14f', 1, 1, 3, 2); p('#8fd14f', 3, 0, 2, 2); p('#5fae5a', 0, 3, 2, 1); });
  add('still_b', 'still', p => { p(P.red, 1, 6, 2, 2); p(P.redD, 1, 8, 2, 1); p(P.white, 1, 6, 1, 1); });
  mk('tar', 14, 12, p => { p.disc('#2a2026', 7, 7, 5.6); p('#4a3a44', 4, 5, 3, 1); p('#4a3a44', 8, 8, 2, 1); p.disc('#5a4a52', 10, 5, 1.2); p(P.org, 6, 1, 2, 2); p(P.yelL, 6, 1, 1, 1); });
  mk('flask', 6, 8, p => { p(P.greyL, 2, 0, 2, 2); p('#5fae5a', 1, 2, 4, 5); p('#9dff7a', 1, 2, 1, 3); });
  add('gatling_a', 'gatling', p => { p(P.yel, 3, 14, 10, 1); });
  add('gatling_b', 'gatling', p => { p.disc(P.dark, 8, 9.5, 3.2); p.disc(P.steelD, 8, 9, 2.2); p(P.red, 7, 8, 2, 1); });
  // powers, tabs and scenery
  mk('dynamite', 12, 14, p => { for (const x of [2, 5, 8]) { p(P.red, x, 5, 3, 8); p('#f59a8f', x, 5, 1, 7); } p(P.redD, 2, 12, 9, 1); p(P.woodD, 2, 8, 9, 1); p(P.dark, 6, 2, 1, 3); p(P.org, 6, 0, 2, 2); p(P.yelL, 7, 0, 1, 1); });
  mk('bell', 13, 14, p => { p(P.woodD, 6, 0, 1, 2); p(P.brass, 5, 2, 3, 1); p(P.yel, 4, 3, 5, 3); p(P.yel, 3, 6, 7, 3); p(P.brass, 2, 9, 9, 2); p(P.yelL, 4, 4, 1, 4); p(P.yelL, 5, 3, 1, 1); p(P.dark, 6, 11, 1, 2); });
  mk('flask', 12, 14, p => { p(P.greyL, 4, 0, 4, 1); p(P.white, 5, 1, 2, 4); p(P.white, 3, 5, 6, 2); p(P.white, 2, 7, 8, 5); p(P.teal, 3, 8, 6, 3); p(P.tealL, 4, 8, 1, 2); p(P.tealD, 6, 10, 2, 1); p(P.white, 3, 12, 6, 1); });
  // props
  mk('barrel', 10, 12, p => { p(P.wood, 1, 1, 8, 10); p(P.woodL, 2, 1, 2, 10); p(P.woodD, 7, 1, 2, 10); p(P.greyD, 1, 3, 8, 1); p(P.greyD, 1, 8, 8, 1); p(P.woodD, 2, 0, 6, 1); p(P.woodL, 3, 0, 4, 1); });
  mk('crate', 11, 10, p => { p(P.woodL, 0, 0, 11, 10); p(P.wood, 1, 1, 9, 8); p(P.woodD, 0, 4, 11, 1); p(P.woodD, 1, 1, 1, 8); p(P.woodD, 9, 1, 1, 8); for (let i = 0; i < 8; i++) p(P.woodL, 1 + i, 8 - i, 1, 1); });
  mk('skull', 13, 8, p => { p(P.white, 4, 1, 5, 5); p(P.white, 5, 6, 3, 2); p(P.white, 1, 1, 3, 1); p(P.white, 0, 0, 1, 1); p(P.white, 9, 1, 3, 1); p(P.white, 12, 0, 1, 1); p(P.dark, 5, 3, 1, 1); p(P.dark, 7, 3, 1, 1); p(P.greyL, 4, 5, 5, 1); });
  mk('wheel', 12, 12, p => { p.disc(P.woodD, 6, 6, 5.6); p.disc(null, 6, 6, 4.4); p.disc(P.wood, 6, 6, 1.6); p(P.wood, 5.5, 1, 1, 10); p(P.wood, 1, 5.5, 10, 1); p(P.woodD, 3, 3, 1, 1); p(P.woodD, 8, 3, 1, 1); p(P.woodD, 3, 8, 1, 1); p(P.woodD, 8, 8, 1, 1); });
  // weather icons
  mk('w_dust', 14, 12, p => { p('#c9a476', 1, 2, 9, 1); p('#d9b886', 3, 5, 10, 1); p('#c9a476', 0, 8, 8, 1); p('#a88a5a', 9, 8, 4, 1); p('#d9b886', 10, 2, 2, 1); p('#a88a5a', 2, 11, 6, 1); });
  mk('w_rain', 13, 14, p => { p.disc(P.greyL, 5, 4, 3.4); p.disc(P.greyL, 8.5, 4.5, 3); p(P.grey, 2, 6, 10, 2); for (const [x, y] of [[3, 9], [6, 10], [9, 9], [4, 12], [8, 12]]) p('#5b8be0', x, y, 1, 2); });
  mk('w_heat', 14, 14, p => { p.disc(P.org, 7, 7, 4); p.disc(P.yel, 7, 7, 3); p(P.yelL, 6, 5, 2, 1); for (const [x, y, w, hh] of [[6, 0, 2, 2], [6, 12, 2, 2], [0, 6, 2, 2], [12, 6, 2, 2], [2, 2, 1, 1], [11, 2, 1, 1], [2, 11, 1, 1], [11, 11, 1, 1]]) p(P.org, x, y, w, hh); });
  mk('w_moon', 13, 13, p => { p.disc('#e8ecf5', 6.5, 6.5, 5.4); p.disc(null, 9, 5, 4.2); p('#c9d2de', 3, 8, 1, 1); p('#c9d2de', 4, 4, 1, 1); p(P.yelL, 11, 1, 1, 1); p(P.yelL, 10, 10, 1, 1); });
  for (const f of [0, 1]) mk('bird' + (f ? '_b' : ''), 13, 7, p => { p(P.dark, 5, 2, 3, 2); p(P.redD, 6, 1, 1, 1); if (f) { p(P.dark, 0, 0, 2, 1); p(P.dark, 2, 1, 3, 1); p(P.dark, 8, 1, 3, 1); p(P.dark, 11, 0, 2, 1); } else { p(P.dark, 0, 4, 2, 1); p(P.dark, 2, 3, 3, 1); p(P.dark, 8, 3, 3, 1); p(P.dark, 11, 4, 2, 1); } });
  mk('tumble', 12, 12, p => { p.disc('#a88a5a', 6, 6, 5.5); p.disc(null, 6, 6, 4); p.disc('#8a6a40', 6, 6, 3.4); p.disc(null, 6, 6, 2); for (const [x, y] of [[2, 3], [9, 2], [3, 9], [8, 8], [5, 5], [6, 1], [1, 6], [10, 6]]) p('#c9a476', x, y, 1, 1); });
}
/* Iron Ridge: goods, buildings, quarry boulders and the armoured train. */
function paintSprites3() {
  const hut = (p, wall, wallD, roof, roofD) => { p(roof, 5, 2, 6, 1); p(roof, 4, 3, 8, 1); p(roof, 3, 4, 10, 1); p(roof, 2, 5, 12, 1); p(roofD, 1, 6, 14, 2); p(wall, 2, 8, 12, 6); p(wallD, 2, 13, 12, 1); p(P.dark, 7, 10, 3, 4); };
  const RUST = '#a85a2a', IRON = '#5e5868', IRONL = '#837c8f', IROND = '#3e3a48';
  // goods
  mk('iron', 12, 12, p => { p.disc(IRON, 6, 6.5, 4.8); p(IROND, 2, 8, 8, 2); p(IRONL, 4, 2, 3, 1); p(RUST, 3, 4, 2, 2); p(RUST, 7, 6, 2, 1); p('#c87a3e', 6, 3, 1, 1); });
  mk('stone', 13, 11, p => { p(P.grey, 1, 3, 11, 7); p(P.greyL, 1, 3, 11, 2); p(P.greyD, 1, 9, 11, 1); p(P.greyD, 6, 3, 1, 7); p(P.greyD, 1, 6, 5, 1); p(P.greyL, 2, 4, 3, 1); });
  mk('pig', 14, 11, p => { p(IRONL, 4, 2, 7, 1); p(IRONL, 3, 3, 9, 1); p(IRON, 2, 4, 11, 3); p(IROND, 1, 7, 12, 2); p(P.white, 5, 2, 3, 1); p(RUST, 9, 5, 2, 1); });
  mk('rail', 14, 12, p => { for (const x of [1, 5, 9]) p(P.woodD, x, 1, 3, 10); p(P.steelL, 0, 3, 14, 1); p(P.steel, 0, 4, 14, 1); p(P.steelL, 0, 7, 14, 1); p(P.steel, 0, 8, 14, 1); });
  mk('boiler', 14, 13, p => { p(P.copD, 2, 2, 10, 9); p(P.cop, 2, 2, 10, 2); p('#f3b27e', 3, 3, 7, 1); p.disc(P.copD, 12, 6.5, 2); for (const [x, y] of [[3, 6], [6, 6], [9, 6], [3, 9], [6, 9], [9, 9]]) p(P.yel, x, y, 1, 1); p(P.dark, 6, 0, 2, 2); p(P.dark, 2, 11, 10, 1); });
  mk('loco', 18, 14, p => { p(P.dark, 2, 2, 3, 4); p(P.greyD, 1, 1, 5, 1); p(P.night, 1, 5, 11, 5); p(IRON, 2, 6, 9, 3); p(P.redD, 11, 3, 6, 7); p(P.red, 11, 3, 6, 2); p(P.yelL, 13, 5, 2, 2); p(P.yel, 0, 8, 2, 1); p.disc(P.dark, 4, 11.5, 2); p.disc(P.dark, 9, 11.5, 2); p.disc(P.dark, 14, 11.5, 2); p(P.grey, 4, 11, 1, 1); p(P.grey, 9, 11, 1, 1); p(P.grey, 14, 11, 1, 1); });
  mk('boulder', 14, 12, p => { p(P.grey, 2, 4, 10, 6); p(P.grey, 4, 2, 6, 2); p(P.greyL, 4, 2, 4, 1); p(P.greyL, 2, 4, 2, 1); p(P.greyD, 2, 9, 10, 2); p(P.greyD, 9, 3, 1, 5); p(P.greyL, 6, 6, 2, 1); });
  // buildings (16x16)
  mk('ironmine', 16, 16, p => { p(IRON, 4, 2, 8, 3); p(IRON, 2, 5, 12, 9); p(IRONL, 4, 2, 5, 1); p(RUST, 5, 4, 2, 1); p(RUST, 11, 6, 2, 2); p(IROND, 2, 13, 12, 1); p(P.woodL, 4, 7, 8, 1); p(P.wood, 4, 8, 1, 6); p(P.wood, 11, 8, 1, 6); p(P.night, 5, 8, 6, 6); p(RUST, 6, 11, 4, 2); p(P.greyD, 6, 13, 1, 1); p(P.greyD, 9, 13, 1, 1); });
  mk('coalseam', 16, 16, p => { p('#3e3742', 1, 9, 14, 5); p('#2c2730', 3, 6, 10, 3); p(P.night, 5, 9, 6, 4); p(P.woodD, 4, 8, 1, 6); p(P.woodD, 11, 8, 1, 6); p(P.wood, 4, 7, 8, 1); p(P.coal, 1, 12, 5, 2); p(P.coalL, 2, 11, 3, 1); p(P.coal, 11, 11, 4, 3); p(P.coalL, 12, 10, 2, 1); });
  mk('quarry', 16, 16, p => { p(P.greyD, 1, 10, 14, 4); p(P.grey, 2, 7, 12, 3); p(P.greyL, 3, 4, 10, 3); p(P.greyL, 3, 4, 10, 1); p(P.grey, 5, 2, 6, 2); for (const [x, y] of [[2, 12], [6, 12], [10, 12]]) { p(P.greyL, x, y, 3, 1); } p(P.wood, 12, 3, 1, 8); p(P.woodD, 9, 3, 4, 1); p(P.greyD, 9, 4, 1, 2); });
  mk('blast', 16, 16, p => { p(P.greyD, 4, 0, 4, 6); p(P.grey, 4, 0, 1, 6); p(P.dark, 4, 1, 4, 1); p(P.grey, 2, 5, 12, 9); p(P.greyL, 2, 5, 12, 1); p(P.greyD, 2, 13, 12, 1); for (const y of [7, 10]) p(P.greyD, 2, y, 12, 1); p(P.org, 6, 9, 5, 4); p(P.yel, 7, 10, 3, 3); p(P.yelL, 8, 11, 1, 2); p(RUST, 11, 3, 3, 2); });
  mk('rolling', 16, 16, p => { hut(p, P.steel, P.steelD, P.greyD, P.dark); p(P.steelL, 1, 12, 14, 1); p(P.steel, 1, 13, 14, 1); for (const x of [3, 7, 11]) p.disc(P.greyD, x + 1, 10, 1.5); p(P.org, 12, 9, 2, 2); });
  mk('boilerw', 16, 16, p => { hut(p, P.woodL, P.wood, P.redD, '#6e2a2a'); p(P.copD, 9, 9, 6, 5); p(P.cop, 9, 9, 6, 1); p(P.yel, 10, 11, 1, 1); p(P.yel, 13, 11, 1, 1); p(P.greyD, 12, 2, 2, 5); });
  mk('locow', 16, 16, p => { p(P.redD, 1, 3, 14, 3); p(P.red, 2, 2, 12, 2); p(P.woodL, 1, 6, 14, 8); p(P.wood, 1, 13, 14, 1); p(P.night, 4, 7, 8, 7); p(P.dark, 5, 8, 6, 5); p(P.yelL, 7, 9, 2, 2); p(P.greyD, 7, 0, 2, 3); p(P.steelL, 0, 14, 16, 1); p(P.steel, 0, 15, 16, 1); });
  // the armoured train (Iron Ridge boss), two frames
  for (const f of [0, 1]) mk('train' + (f ? '_b' : ''), 26, 18, p => {
    p(P.dark, 4, 0, 3, 5); p(P.greyD, 3, 0, 5, 1); p(IROND, 1, 4, 20, 9); p(IRON, 2, 5, 18, 3); p(IRONL, 2, 5, 18, 1);
    for (const x of [4, 8, 12, 16]) p(P.yel, x, 9, 1, 1); p(P.red, 1, 11, 20, 1); p(P.redD, 20, 3, 5, 10); p(P.yelL, 21, 5, 2, 2);
    p(P.greyL, 22, 8, 4, 1); p(P.greyD, 0, 12, 2, 2);
    for (const x of [5, 11, 17]) { p.disc(P.dark, x, 14.5, 2.6); p(P.grey, f ? x : x - 1, 14, 2, 1); }
  });
}
/* Silver Falls: goods, buildings, river pirates and the ironclad steamer. */
function paintSprites4() {
  const hut = (p, wall, wallD, roof, roofD) => { p(roof, 5, 2, 6, 1); p(roof, 4, 3, 8, 1); p(roof, 3, 4, 10, 1); p(roof, 2, 5, 12, 1); p(roofD, 1, 6, 14, 2); p(wall, 2, 8, 12, 6); p(wallD, 2, 13, 12, 1); p(P.dark, 7, 10, 3, 4); };
  const CU = '#c46a3a', CUL = '#e8955e', CUD = '#8a4424', GLS = '#bfe6f2', WATER = '#3d6f8f', WATERL = '#5b9cc0';
  // goods
  mk('cu', 12, 12, p => { p.disc(P.grey, 6, 6.5, 4.8); p(P.greyD, 2, 8, 8, 2); p(CU, 3, 4, 2, 2); p(CU, 7, 5, 2, 2); p('#4fa38a', 5, 7, 2, 1); p(CUL, 4, 4, 1, 1); });
  mk('sand', 13, 10, p => { p('#e2c88e', 2, 5, 9, 4); p('#e2c88e', 4, 3, 5, 2); p('#f2dcaa', 4, 3, 3, 1); p('#c9ab6e', 2, 8, 9, 1); p('#c9ab6e', 8, 5, 2, 1); });
  mk('copper', 14, 11, p => { p(CUL, 4, 2, 7, 1); p(CUL, 3, 3, 9, 1); p(CU, 2, 4, 11, 3); p(CUD, 1, 7, 12, 2); p('#ffd2b0', 5, 2, 3, 1); });
  mk('wire', 13, 13, p => { p.disc(CUD, 6.5, 6.5, 5.5); p.disc(CU, 6.5, 6.5, 4.5); p.disc(CUD, 6.5, 6.5, 3); p.disc(P.woodL, 6.5, 6.5, 2); p(CUL, 3, 4, 1, 3); p(CUL, 9, 3, 1, 2); });
  mk('glassp', 12, 13, p => { p(P.greyL, 1, 1, 10, 11); p(GLS, 2, 2, 8, 9); p(P.white, 3, 3, 2, 4); p(P.white, 5, 3, 1, 1); p('#9cd0e2', 7, 8, 2, 2); });
  mk('bulb', 11, 14, p => { p.disc('#fff6c0', 5.5, 5, 4.3); p.disc(P.yelL, 5.5, 5, 3.2); p(P.white, 3, 3, 2, 2); p(P.greyL, 4, 9, 3, 1); p(P.grey, 4, 10, 3, 1); p(P.greyL, 4, 11, 3, 1); p(P.greyD, 5, 12, 1, 1); p(P.org, 5, 5, 1, 2); });
  mk('tele', 14, 14, p => { p(P.woodD, 1, 9, 12, 4); p(P.wood, 1, 9, 12, 1); p(P.brass, 3, 6, 8, 3); p(P.yel, 3, 6, 8, 1); p.disc(P.greyD, 4, 5, 1.5); p(P.dark, 9, 3, 1, 3); p(P.dark, 6, 2, 5, 1); p(CU, 11, 10, 2, 2); });
  // buildings
  mk('cumine', 16, 16, p => { p(P.grey, 4, 2, 8, 3); p(P.grey, 2, 5, 12, 9); p(P.greyL, 4, 2, 5, 1); p(CU, 5, 4, 2, 1); p(CU, 11, 6, 2, 2); p('#4fa38a', 3, 6, 1, 1); p(P.greyD, 2, 13, 12, 1); p(P.woodL, 4, 7, 8, 1); p(P.wood, 4, 8, 1, 6); p(P.wood, 11, 8, 1, 6); p(P.night, 5, 8, 6, 6); p(CU, 6, 11, 4, 2); });
  mk('sandpit', 16, 16, p => { p('#c9ab6e', 1, 9, 14, 5); p('#e2c88e', 3, 7, 10, 3); p('#f2dcaa', 5, 6, 6, 1); p(P.wood, 11, 3, 1, 8); p(P.woodD, 8, 3, 4, 1); p(P.greyD, 8, 4, 1, 3); p.disc(P.dark, 4, 13.5, 1.2); p(P.wood, 2, 11, 5, 2); });
  mk('wheel', 16, 16, p => { p(WATER, 0, 12, 16, 4); p(WATERL, 1, 13, 4, 1); p(WATERL, 9, 14, 5, 1); p.disc(P.woodD, 8, 8, 7); p.disc(P.wood, 8, 8, 5.6); p.disc(null, 8, 8, 4.4); for (const [x, y] of [[8, 1], [8, 14], [1, 8], [14, 8], [3, 3], [12, 3], [3, 12], [12, 12]]) p(P.woodL, x, y, 1, 1); p(P.woodD, 7, 2, 2, 12); p(P.woodD, 2, 7, 12, 2); p.disc(P.greyD, 8, 8, 1.5); });
  mk('refinery', 16, 16, p => { p(P.greyD, 12, 0, 3, 7); p(CU, 12, 1, 3, 1); hut(p, '#8a6a58', '#6a4e40', CUD, '#5e3018'); p(P.org, 4, 9, 3, 4); p(P.yel, 5, 10, 1, 2); p(CU, 10, 10, 3, 3); });
  mk('wirew', 16, 16, p => { hut(p, P.woodL, P.wood, '#3b5fa8', '#2a4478'); p.disc(CUD, 12, 10.5, 2.5); p.disc(CU, 12, 10.5, 1.6); p.disc(CUD, 4, 10.5, 2.5); p.disc(CU, 4, 10.5, 1.6); p(CU, 6, 10, 4, 1); });
  mk('glassb', 16, 16, p => { hut(p, P.white, P.greyL, P.teal, P.tealD); p(GLS, 3, 9, 3, 3); p(GLS, 11, 9, 2, 3); p(P.org, 6, 11, 3, 3); p(P.yel, 7, 12, 1, 2); p(P.greyD, 7, 0, 2, 3); });
  mk('bulbw', 16, 16, p => { hut(p, '#5a5470', '#3e3a50', P.yel, P.brass); for (const x of [3, 6, 9, 12]) { p(P.yelL, x, 9, 1, 2); p(P.white, x, 9, 1, 1); } p(P.yelL, 7, 3, 2, 2); });
  mk('telw', 16, 16, p => { p(P.redD, 1, 4, 14, 3); p(P.red, 2, 3, 12, 2); p(P.woodL, 1, 7, 14, 7); p(P.wood, 1, 13, 14, 1); p(P.night, 6, 9, 4, 5); p(P.woodD, 12, 0, 1, 7); p(P.dark, 10, 1, 5, 1); p(P.dark, 2, 0, 1, 4); p(P.dark, 0, 1, 5, 1); p(P.yelL, 3, 9, 2, 2); p(P.yelL, 11, 9, 2, 2); });
  // river pirates (rowing boat) and the ironclad steamer (Silver Falls boss), two frames each
  for (const f of [0, 1]) {
    const s = f ? '_b' : '';
    mk('boat' + s, 18, 12, p => { p(P.woodD, 1, 7, 16, 3); p(P.wood, 2, 6, 14, 1); p(P.woodD, 3, 10, 12, 1); p('#4a3428', 6, 1, 4, 2); p(P.skin, 7, 3, 2, 1); p('#5b8be0', 6, 4, 4, 2); p(P.red, 7, 1, 2, 1); p(P.woodL, f ? 2 : 13, f ? 3 : 5, 1, 5); p(P.woodL, f ? 15 : 3, f ? 5 : 3, 1, 5); });
    mk('steamer' + s, 26, 18, p => { p(P.dark, 8, 0, 3, 6); p(P.dark, 14, 1, 3, 5); p(P.red, 8, 1, 3, 1); p(P.red, 14, 2, 3, 1); p(P.greyD, 3, 6, 18, 5); p(P.grey, 3, 6, 18, 2); p(P.greyL, 3, 6, 18, 1); for (const x of [6, 10, 14, 18]) p(P.yel, x, 9, 1, 1); p(P.steelD, 1, 11, 23, 3); p(P.dark, 2, 14, 21, 1); p.disc(P.woodD, 21, 10, 3.5); p(P.woodL, f ? 20 : 22, f ? 7 : 8, 1, 5); p(WATERL, 0, 15, 26, 1); p(P.white, f ? 1 : 3, 15, 4, 1); });
  }
}
