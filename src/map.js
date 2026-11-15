'use strict';
/* =========================================================
   Map: roads, plots, scenery
   ========================================================= */
let MAP, PATHS, PATH, PLOTS, CACTI, DECOR = [], VAULT;
function setMap(id) {
  MAP = MAPS[id] || MAPS.gulch; VAULT = MAP.vault; PATH = new Set();
  PATHS = MAP.paths.map(way => {
    const segs = []; let len = 0;
    for (let i = 0; i < way.length - 1; i++) {
      const [x1, y1] = way[i], [x2, y2] = way[i + 1], l = Math.abs(x2 - x1) + Math.abs(y2 - y1);
      segs.push({ x1, y1, x2, y2, len: l, at: len }); len += l;
      for (let t = 0; t <= l; t += .5) PATH.add(Math.round(x1 + (x2 - x1) * t / l) + ',' + Math.round(y1 + (y2 - y1) * t / l));
    }
    return { way, segs, len };
  });
  PLOTS = [];
  for (let y = YARD; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (PATH.has(x + ',' + y) || (MAP.ravine && MAP.ravine.includes(x))) continue;
    let cover = 0;
    for (let p = 0; p < PATHS.length; p++) for (let d = 0; d < PATHS[p].len; d += .25) { const [px, py] = posAt(d, p); if (Math.hypot(px - x, py - y) <= 2.4) cover++; }
    PLOTS.push({ x, y, cover });
  }
  PLOTS.sort((a, b) => b.cover - a.cover);
  let seed = id === 'fork' ? 91 : id === 'bridge' ? 33 : 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const spots = PLOTS.slice(Math.floor(PLOTS.length * .35)); CACTI = [];
  while (CACTI.length < 8 && spots.length) { const i = Math.floor(rnd() * spots.length); CACTI.push([spots[i].x, spots[i].y, rnd()]); spots.splice(i, 1); }
  // props: barrels, crates, skulls and wheels lie about until a tower is built on them
  const kinds = ['barrel', 'crate', 'skull', 'wheel', 'barrel', 'crate']; DECOR = [];
  while (DECOR.length < 6 && spots.length) { const i = Math.floor(rnd() * spots.length); DECOR.push([spots[i].x, spots[i].y, kinds[DECOR.length], rnd()]); spots.splice(i, 1); }
}
function posAt(d, p = 0) {
  const P_ = PATHS[p];
  for (const s of P_.segs) if (d <= s.at + s.len) { const t = Math.max(0, d - s.at) / s.len; return [s.x1 + (s.x2 - s.x1) * t, s.y1 + (s.y2 - s.y1) * t]; }
  return P_.way[P_.way.length - 1];
}
const onRoad = (x, y) => PATH.has(x + ',' + y);
