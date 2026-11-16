// Loads the game's own simulation files (src/*.js, everything except drawing and interface) into a Node sandbox,
// with small stand-ins for the screen, so economy, combat and saves can be tested and balanced without a browser.
//   const { load } = require('./sim'); const g = load(); g.run('S.coins')  // any expression in the game's scope
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SIM_FILES = ['defs.js', 'map.js', 'art.js', 'state.js', 'economy.js', 'goals.js', 'combat.js', 'fx.js', 'capital.js'];

function load(opts = {}) {
  const store = new Map(Object.entries(opts.storage || {}));
  const el = () => ({ getContext: () => null, getBoundingClientRect: () => ({ width: 0, height: 0 }), classList: { add() {}, remove() {}, toggle() {} }, style: {}, append() {}, remove() {}, animate: () => ({}) });
  const sandbox = {
    console, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, performance: { now: () => Date.now() },
    window: {}, navigator: {}, document: { querySelector: () => null, querySelectorAll: () => [], createElement: el, body: el(), documentElement: el(), hidden: true },
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
  };
  const ctx = vm.createContext(sandbox);
  // stand-ins for the parts of the interface and drawing the simulation calls
  vm.runInContext(`var rebuild = false; var cv = { getBoundingClientRect: () => ({ width: 0, height: 0 }) };
    function $() { return null; } function say() {} function refresh() {} function medal() {}`, ctx);
  for (const f of SIM_FILES) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx, { filename: 'src/' + f });
  vm.runInContext(`useTown('gulch'); setMap('gulch');`, ctx);
  return { ctx, store, run: code => vm.runInContext(String(code), ctx), call: (fn, ...args) => vm.runInContext(`(${fn})(...${JSON.stringify(args)})`, ctx) };
}

module.exports = { load, SIM_FILES };
