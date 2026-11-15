'use strict';
/* =========================================================
   Definitions
   ========================================================= */
const ITEMS = {
  wood:    { n: 'Timber',     p: 1 },
  ore:     { n: 'Ore',        p: 1 },
  crystal: { n: 'Crystal',    p: 4 },
  coal:    { n: 'Coal',       p: 3 },
  plank:   { n: 'Planks',     p: 5 },
  ingot:   { n: 'Ingots',     p: 6 },
  lens:    { n: 'Lenses',     p: 20 },
  gear:    { n: 'Gears',      p: 22 },
  engine:  { n: 'Engines',    p: 150 },
  steel:   { n: 'Steel',      p: 40 },
  clock:   { n: 'Clockwork',  p: 110 },
  auto:    { n: 'Automatons', p: 1400 },
};
const EXT = [
  { id: 'camp',  n: 'Lumber Camp',   out: 'wood',    rate: .5, cost: 15 },
  { id: 'mine',  n: 'Ore Mine',      out: 'ore',     rate: .5, cost: 15 },
  { id: 'drill', n: 'Crystal Drill', out: 'crystal', rate: .3, cost: 400 },
  { id: 'pit',   n: 'Coal Pit',      out: 'coal',    rate: .4, cost: 2500 },
];
const SHOPS = [
  { id: 'saw',    n: 'Sawmill',         in: { wood: 2 },                        out: 'plank',  rate: .25, cost: 50 },
  { id: 'smelt',  n: 'Smelter',         in: { ore: 2 },                         out: 'ingot',  rate: .25, cost: 60 },
  // The rates keep the chain's input ratios balanced at equal levels; don't change one without its suppliers.
  // Top-tier build costs were lowered so climbing the chain pays: before, an Automaton Works level earned about a
  // hundredth as much per coin as a Lumber Camp level, so nobody (and no foreman) built it up.
  { id: 'glass',  n: 'Glassworks',      in: { crystal: 2 },                     out: 'lens',   rate: .15, cost: 800 },
  { id: 'mach',   n: 'Machine Shop',    in: { plank: 1, ingot: 1 },             out: 'gear',   rate: .15, cost: 500 },
  { id: 'eng',    n: 'Engine Works',    in: { gear: 2, lens: 1 },               out: 'engine', rate: .05, cost: 2500 },
  { id: 'mill',   n: 'Steel Mill',      in: { ingot: 1, coal: 2 },              out: 'steel',  rate: .12, cost: 4000 },
  { id: 'clockw', n: 'Clockworks',      in: { gear: 1, lens: 1 },               out: 'clock',  rate: .08, cost: 8000 },
  { id: 'autow',  n: 'Automaton Works', in: { engine: 1, clock: 1, steel: 2 },  out: 'auto',   rate: .03, cost: 40000 },
];
const RESEARCH = [
  { id: 'tools',  n: 'Sharper Tools',    d: 'Doubles what each tap gathers.',            cost: 40,  g: 3,   max: 12 },
  { id: 'ledger', n: 'Trading Ledger',   d: 'Unlocks auto-sell switches in the Market.',  cost: 250, g: 1,   max: 1 },
  { id: 'steam',  n: 'Steam Power',      d: '+25% camp, mine, drill and pit output.',    cost: 200, g: 1.8, max: 99 },
  { id: 'lines',  n: 'Assembly Lines',   d: '+25% workshop speed.',                      cost: 300, g: 1.8, max: 99 },
  { id: 'haggle', n: 'Haggling',         d: '+10% sale prices.',                         cost: 500, g: 2,   max: 99 },
  { id: 'guns',   n: 'Gunsmithing',      d: '+15% tower damage, compounding.',           cost: 400, g: 2.2, max: 99 },
  { id: 'bounty', n: 'Bounty Posters',   d: '+20% coins from raiders.',                  cost: 600, g: 2,   max: 99 },
  { id: 'vault',  n: 'Reinforced Vault', d: '+5 vault strength. Every 4 levels shows on the vault.', cost: 300, g: 2, max: 20 },
  { id: 'mason',  n: 'Masonry',          d: '+1 extra vault strength back after every cleared wave.', cost: 800, g: 2.2, max: 4 },
];
const TOWERS = {
  crossbow: { n: 'Crossbow',   coins: 25,   goods: { plank: 5 },             dmg: 4,  rate: 1.25, range: 2.4, d: 'Quick single shots.' },
  cannon:   { n: 'Cannon',     coins: 120,  goods: { ingot: 12 },            dmg: 24, rate: .5,   range: 2.8, splash: 1.1, d: 'Slow, hits a cluster, smashes shields.' },
  frost:    { n: 'Frost Lens', coins: 300,  goods: { lens: 8 },              dmg: 5,  rate: 1,    range: 2.1, slow: 2, d: 'Chills everything in reach.' },
  tesla:    { n: 'Tesla Coil', coins: 1500, goods: { gear: 10, engine: 2 },  dmg: 90, rate: .8,   range: 2.6, chain: 3, d: 'Lightning jumps between raiders.' },
  gatling:  { n: 'Gatling',    coins: 3000, goods: { steel: 10, clock: 4 },  dmg: 60, rate: 6,    range: 2.6, d: 'A hail of bullets.' },
};
/* At level 5 every tower picks one of two paths. */
const BRANCH = {
  crossbow: { a: { n: 'Repeater', d: 'Fires more than twice as fast, for less damage each.', rate: 2.2, dmg: .6 },
              b: { n: 'Sniper', d: 'Huge damage at long reach. Fires slowly.', dmg: 2.6, rate: .55, range: 2.4 } },
  cannon:   { a: { n: 'Mortar', d: 'Much bigger blast and longer reach.', splash: 1.8, range: 1, dmg: 1.2, rate: .85 },
              b: { n: 'Grapeshot', d: 'Sprays a cone of shot, fast. Smashes shields.', cone: 1, rate: 1.7, dmg: .75, range: -.4 } },
  frost:    { a: { n: 'Deep Freeze', d: 'Every third pulse freezes raiders solid.', freeze: 1 },
              b: { n: 'Brittle Ice', d: 'Chilled raiders take 30% more damage from every tower.', brittle: 1 } },
  tesla:    { a: { n: 'Arc Network', d: 'Lightning jumps to six raiders and loses less power.', chain: 6, falloff: .82 },
              b: { n: 'Overload', d: 'Stuns every raider it hits, even war wagons.', stun: 1, dmg: 1.4 } },
  gatling:  { a: { n: 'Twin Barrels', d: 'Fires 80% faster.', rate: 1.8 },
              b: { n: 'Armor Piercing', d: 'Double damage, and bullets go straight through shields.', dmg: 2, pierce: 1 } },
};
const FOES = {
  raider: { n: 'Bandit',       hp: 1,   spd: 1.1,  rw: 1,  leak: 1, c: '#f07067', size: .72 },
  runner: { n: 'Rider',        hp: .55, spd: 2,    rw: 1,  leak: 1, c: '#f5a04a', size: .8 },
  brute:  { n: 'Brute',        hp: 3.2, spd: .7,   rw: 3,  leak: 2, c: '#b06be0', size: .92 },
  shield: { n: 'Shieldbearer', hp: 1.6, spd: .85,  rw: 2,  leak: 1, c: '#9aa7b8', size: .82, shield: 4 },
  sapper: { n: 'Sapper',       hp: .9,  spd: 1.25, rw: 2,  leak: 1, c: '#5fae5a', size: .74, sapper: 1 },
  healer: { n: 'Healer',       hp: 1.1, spd: .95,  rw: 2,  leak: 1, c: '#7fd992', size: .76, heal: 1 },
  thief:  { n: 'Thief',        hp: .7,  spd: 1.8,  rw: 1,  leak: 0, c: '#8a5ac8', size: .7,  thief: 1 },
  boss:   { n: 'War wagon',    hp: 25,  spd: .55,  rw: 20, leak: 5, c: '#ff4f8b', size: 1.25 },
};
const UNLOCK = { raider: 1, runner: 3, thief: 6, brute: 6, shield: 8, sapper: 12, healer: 15 };
const WTYPES = {
  mixed: { n: 'Mixed raid',   from: 1, w: { raider: 4, runner: 2, brute: 1, shield: 1, sapper: 1, healer: 1, thief: 1 }, count: 1,    hp: 1,    gap: 1 },
  rush:  { n: 'Rush',         from: 4, w: { runner: 5, thief: 3, raider: 1 },                                       count: 1.25, hp: .85,  gap: .6 },
  swarm: { n: 'Swarm',        from: 5, w: { raider: 6, runner: 1, sapper: 1 },                                      count: 1.9,  hp: .5,   gap: .45 },
  heavy: { n: 'Heavy column', from: 7, w: { brute: 3, shield: 3, healer: 1, raider: 1 },                            count: .55,  hp: 1.15, gap: 1.4 },
};
/* Weather: one at a time, announced in the Next preview, never on war wagon waves. Lasts for the wave. */
const WEATHER = {
  dust: { n: 'Dust storm',  d: 'Tower reach −25%. Frost and tesla are not bothered.', icon: 'w_dust' },
  rain: { n: 'Rain',        d: 'Raiders 20% slower. Crossbows 15% weaker (wet strings).', icon: 'w_rain' },
  heat: { n: 'Heat wave',   d: 'Workshops 25% faster. Raiders 10% faster.', icon: 'w_heat' },
  moon: { n: 'Clear night', d: 'Every tower does 10% more damage by moonlight.', icon: 'w_moon' },
};
function wx() { return W.active ? W.weather : null; }
function wxSpd() { const w = wx(); return w === 'rain' ? .8 : w === 'heat' ? 1.1 : 1; }
const MAPS = {
  gulch: { n: 'Copper Gulch', d: 'One long road with room to build along it.',
           paths: [[[-.5, 7], [10, 7], [10, 9], [1, 9], [1, 12], [11, 12]]], vault: [11, 12], hp: 1, coin: 1, deed: 0 },
  fork:  { n: 'Forked Canyon', d: 'The road splits in two and is shorter. Raiders pay 50% more, and charters signed here earn an extra deed.',
           paths: [[[-.5, 10], [2, 10], [2, 7], [9, 7], [9, 10], [11, 10]], [[-.5, 10], [2, 10], [2, 13], [9, 13], [9, 10], [11, 10]]], vault: [11, 10], hp: .8, coin: 1.5, deed: 1 },
  bridge: { n: 'Trestle Bridge', d: 'The road crosses a ravine on three trestle bridges. Raiders on a bridge take 25% more damage. Raiders pay double, and charters signed here earn two extra deeds.',
           paths: [[[-.5, 7], [10, 7], [10, 10], [1, 10], [1, 13], [11, 13]]], vault: [11, 13], hp: 1.1, coin: 2, deed: 2, ravine: [5, 6] },
};
const onBridge = f => MAP.ravine && MAP.ravine.includes(Math.round(f.x));
const PERKS = [
  { id: 'start',   n: 'Head Start',     d: 'Each charter starts with the Lumber Camp and Ore Mine at level 5 per rank, and a Sawmill.', max: 3, cost: l => 1 + l },
  { id: 'coffers', n: 'Seed Money',     d: 'Each charter starts with 500 coins, ten times more per extra rank.',                     max: 3, cost: l => 1 + l },
  { id: 'fort',    n: 'Old Fort',       d: 'Each charter starts with one level 3 crossbow per rank, already on the road.',          max: 3, cost: l => 1 + l },
  { id: 'teams',   n: 'Teamsters',      d: 'Workshops work 25% faster per rank, and porters hurry.',                                max: 5, cost: l => 1 + l },
  { id: 'archive', n: 'Archives',       d: 'Keep all research when you sign a new charter.',                                         max: 1, cost: () => 4, req: 'start' },
  { id: 'loot',    n: 'Salvage Rights', d: 'Each rank gives raiders a 10% chance to drop goods.',                                    max: 3, cost: l => 2 + l, req: 'fort' },
  { id: 'trade',   n: 'Trade Charter',  d: 'Contracts pay 25% more per rank, and prices recover twice as fast.',                     max: 3, cost: l => 2 + l, req: 'teams' },
];
const KEEP = 20, COLS = 12, ROWS = 14, YARD = 6, OFFLINE_CAP = 8 * 3600;
/* Yard slots: top-left corner of a 2x2 block, in cells. */
const SLOT = {
  trees: [0, 0], camp: [2, 0], saw: [4, 0], mach: [6, 0], eng: [8, 0], market: [10, 0],
  rocks: [0, 2], mine: [2, 2], smelt: [4, 2], glass: [6, 2], drill: [8, 2], caravan: [10, 2],
  pit: [0, 4], mill: [2, 4], clockw: [4, 4], autow: [6, 4], hall: [8, 4], office: [10, 4],
};
const BUILD = [...EXT.map(def => ({ def, kind: 'ext', g: 1.17 })), ...SHOPS.map(def => ({ def, kind: 'shops', g: 1.19 }))];
const BY_ID = {}; for (const b of BUILD) BY_ID[b.def.id] = b;
const door = id => [SLOT[id][0] + 1, SLOT[id][1] + 1.8];
