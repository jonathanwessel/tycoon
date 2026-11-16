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
  // Iron Ridge
  iron:    { n: 'Iron ore',   p: 2 },
  stone:   { n: 'Stone',      p: 2 },
  pig:     { n: 'Pig iron',   p: 11 },
  rail:    { n: 'Rails',      p: 34 },
  boiler:  { n: 'Boilers',    p: 80 },
  loco:    { n: 'Locomotives', p: 900 },
  // Silver Falls
  cu:      { n: 'Copper ore', p: 3 },
  sand:    { n: 'Sand',       p: 1 },
  copper:  { n: 'Copper',     p: 9 },
  wire:    { n: 'Wire',       p: 14 },
  glassp:  { n: 'Glass',      p: 7 },
  bulb:    { n: 'Light bulbs', p: 50 },
  tele:    { n: 'Telegraphs', p: 700 },
};
const EXT_ALL = [
  { id: 'camp',  n: 'Lumber Camp',   out: 'wood',    rate: .5, cost: 15 },
  { id: 'mine',  n: 'Ore Mine',      out: 'ore',     rate: .5, cost: 15 },
  { id: 'drill', n: 'Crystal Drill', out: 'crystal', rate: .3, cost: 400 },
  { id: 'pit',   n: 'Coal Pit',      out: 'coal',    rate: .4, cost: 2500 },
  { id: 'ironmine', n: 'Iron Mine',  out: 'iron',    rate: .5, cost: 30 },
  { id: 'coalseam', n: 'Coal Seam',  out: 'coal',    rate: .4, cost: 80 },
  { id: 'quarry',   n: 'Stone Quarry', out: 'stone', rate: .5, cost: 40 },
  { id: 'cumine',   n: 'Copper Mine',  out: 'cu',    rate: .5, cost: 60 },
  { id: 'sandpit',  n: 'Sand Pit',     out: 'sand',  rate: .6, cost: 50 },
  // Silver Falls power: a Water Wheel makes no goods; each level powers 4 workshop levels (×2 at its milestones)
  { id: 'wheel',    n: 'Water Wheel',  out: null,    rate: 0,  cost: 200, power: 4 },
];
const SHOPS_ALL = [
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
  // Iron Ridge: balanced at equal levels like the Gulch chain. Boilers need planks and locomotives need gears,
  // both shipped in from Copper Gulch.
  { id: 'blast',   n: 'Blast Furnace',     in: { iron: 2, coal: 1 },             out: 'pig',    rate: .25, cost: 150 },
  { id: 'rolling', n: 'Rolling Mill',      in: { pig: 2 },                       out: 'rail',   rate: .1,  cost: 900 },
  { id: 'boilerw', n: 'Boiler Shop',       in: { pig: 1, plank: 2 },             out: 'boiler', rate: .05, cost: 3000 },
  { id: 'locow',   n: 'Locomotive Works',  in: { boiler: 1, rail: 2, gear: 2 },  out: 'loco',   rate: .03, cost: 20000 },
  // Silver Falls: every workshop level here draws one unit of power from the Water Wheels; telegraphs need rails from Iron Ridge
  { id: 'refinery', n: 'Copper Works',      in: { cu: 2 },                        out: 'copper', rate: .25, cost: 300 },
  { id: 'wirew',    n: 'Wire Works',        in: { copper: 1 },                    out: 'wire',   rate: .25, cost: 900 },
  { id: 'glassb',   n: 'Glassblower',       in: { sand: 2 },                      out: 'glassp', rate: .2,  cost: 600 },
  { id: 'bulbw',    n: 'Bulb Works',        in: { wire: 1, glassp: 1 },           out: 'bulb',   rate: .1,  cost: 4000 },
  { id: 'telw',     n: 'Telegraph Works',   in: { wire: 2, bulb: 1, rail: 1 },    out: 'tele',   rate: .03, cost: 30000 },
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
  boat:   { n: 'River pirates', hp: 1.5, spd: 1.15, rw: 2,  leak: 2, c: '#5b8be0', size: .9 },
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
  ridge: { n: 'Iron Ridge', d: 'A switchback road climbs the ridge to the vault. Raiders are tougher and pay more; charters here earn an extra deed.',
           paths: [[[-.5, 13], [9, 13], [9, 11], [2, 11], [2, 9], [9, 9], [9, 7], [11, 7]]], vault: [11, 7], hp: 1.2, coin: 1.6, deed: 1,
           pal: { yard: '#9c8a74', a: '#b4a28a', b: '#ab987e', road: ['#5e5048', '#7a6a5c', '#6a5a4e', '#7a6a5c'] } },
  // Silver Falls: path 0 is the road, path 1 the river; boats and the ironclad come up the river
  falls: { n: 'Silver Falls', d: 'A road and a river both lead to the vault: raiders ride in, river pirates row in, and the boss is an ironclad steamer. Raiders pay more; charters here earn two extra deeds.',
           paths: [[[-.5, 7], [8, 7], [8, 10], [11, 10]], [[-.5, 12], [5, 12], [5, 13], [11, 13], [11, 11]]], vault: [11, 10], hp: 1.3, coin: 2.2, deed: 2, river: 1,
           pal: { yard: '#8c9a6a', a: '#a3b07a', b: '#9aa872', road: ['#6e5a40', '#8e7550', '#7e6646', '#8e7550'] } },
};
/* Towns of the empire. Each has its own map(s), buildings, yard layout, gathering taps, boss and tower materials.
   Only the active town's buildings are in EXT / SHOPS / BUILD / BY_ID / SLOT at any moment (see useTown). */
const SLOT_GULCH = {
  trees: [0, 0], camp: [2, 0], saw: [4, 0], mach: [6, 0], eng: [8, 0], market: [10, 0],
  rocks: [0, 2], mine: [2, 2], smelt: [4, 2], glass: [6, 2], drill: [8, 2], caravan: [10, 2],
  pit: [0, 4], mill: [2, 4], clockw: [4, 4], autow: [6, 4], hall: [8, 4], office: [10, 4],
};
const SLOT_RIDGE = {
  trees: [0, 0], ironmine: [2, 0], blast: [4, 0], rolling: [6, 0], market: [10, 0],
  rocks: [0, 2], coalseam: [2, 2], quarry: [4, 2], boilerw: [6, 2], locow: [8, 2], caravan: [10, 2],
  hall: [8, 4], office: [10, 4],
};
const SLOT_FALLS = {
  trees: [0, 0], cumine: [2, 0], refinery: [4, 0], wirew: [6, 0], market: [10, 0],
  rocks: [0, 2], sandpit: [2, 2], glassb: [4, 2], bulbw: [6, 2], telw: [8, 2], caravan: [10, 2],
  wheel: [0, 4], hall: [8, 4], office: [10, 4],
};
const TOWNS = {
  gulch: { n: 'Copper Gulch', era: 'Frontier', ext: ['camp', 'mine', 'drill', 'pit'], shops: ['saw', 'smelt', 'glass', 'mach', 'eng', 'mill', 'clockw', 'autow'],
           slot: SLOT_GULCH, tap: { trees: 'wood', rocks: 'ore' }, tapN: { trees: 'Chop', rocks: 'Dig' }, trees: true, maps: ['gulch', 'fork', 'bridge'],
           boss: { n: 'War wagon', spr: 'boss' }, goods: {}, start: { res: { plank: 10 }, seen: ['wood', 'ore', 'plank'] }, forge: ['smelt', 'mill'], glow: ['drill', 'glass'] },
  ridge: { n: 'Iron Ridge', era: 'Steam and rail', ext: ['ironmine', 'coalseam', 'quarry'], shops: ['blast', 'rolling', 'boilerw', 'locow'],
           slot: SLOT_RIDGE, tap: { trees: 'stone', rocks: 'iron' }, tapN: { trees: 'Quarry', rocks: 'Dig' }, trees: false, maps: ['ridge'],
           boss: { n: 'Armoured train', spr: 'train' },
           goods: { crossbow: { stone: 6 }, cannon: { pig: 10 }, frost: { rail: 4 }, tesla: { boiler: 2, rail: 6 }, gatling: { boiler: 3, loco: 1 } },
           start: { res: { stone: 30 }, seen: ['iron', 'stone', 'coal'] }, forge: ['blast', 'boilerw'], glow: [],
           unlock: { from: 'gulch', best: 20, coins: 1e5 } },
  falls: { n: 'Silver Falls', era: 'Electricity', ext: ['cumine', 'sandpit', 'wheel'], shops: ['refinery', 'wirew', 'glassb', 'bulbw', 'telw'],
           slot: SLOT_FALLS, tap: { trees: 'sand', rocks: 'cu' }, tapN: { trees: 'Dig sand', rocks: 'Mine' }, trees: false, maps: ['falls'], power: true,
           boss: { n: 'Ironclad steamer', spr: 'steamer' },
           goods: { crossbow: { copper: 4 }, cannon: { copper: 10 }, frost: { glassp: 8 }, tesla: { wire: 10, bulb: 2 }, gatling: { tele: 1, wire: 12 } },
           start: { res: { copper: 20 }, seen: ['cu', 'sand', 'copper'] }, forge: ['refinery'], glow: ['bulbw', 'telw'],
           unlock: { from: 'ridge', best: 15, coins: 1e6 } },
};
const townOfMap = m => Object.keys(TOWNS).find(t => TOWNS[t].maps.includes(m)) || 'gulch';
const towerGoods = type => TOWN.goods[type] || TOWERS[type].goods;
const bossName = () => TOWN.boss.n;
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
/* Every building in every town; the active town's are picked out by useTown. Yard slots: top-left of a 2x2 block. */
const BUILD_ALL = [...EXT_ALL.map(def => ({ def, kind: 'ext', g: 1.17 })), ...SHOPS_ALL.map(def => ({ def, kind: 'shops', g: 1.19 }))];
const BY_ALL = {}; for (const b of BUILD_ALL) BY_ALL[b.def.id] = b;
let TOWN, TOWN_ID, EXT, SHOPS, BUILD, BY_ID, SLOT;
function useTown(id) {
  TOWN_ID = TOWNS[id] ? id : 'gulch'; TOWN = TOWNS[TOWN_ID];
  EXT = EXT_ALL.filter(e => TOWN.ext.includes(e.id)); SHOPS = SHOPS_ALL.filter(s => TOWN.shops.includes(s.id));
  BUILD = BUILD_ALL.filter(b => TOWN.ext.includes(b.def.id) || TOWN.shops.includes(b.def.id));
  BY_ID = {}; for (const b of BUILD) BY_ID[b.def.id] = b; SLOT = TOWN.slot;
}
useTown('gulch');
const door = id => [SLOT[id][0] + 1, SLOT[id][1] + 1.8];
