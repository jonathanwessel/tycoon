# Copper Gulch: plan

## Roadmap (current; the scheduled task works through this list top to bottom)

How to use it: take the first unchecked item, build it as one release, run the release checklist below, publish, tick it here in the same commit. One item per run. Notes from each run go under the item ("Notes:"). Never skip ahead, never redo a ticked item unless a check below fails.

### Shipped
- [x] Economy that scales itself: foremen value routes, milestones and research; workshops share inputs; Auto routes; trains grow with the Locomotive Works (2026.11.15-18).
- [x] Full-screen town with slide-up menu sheets; side buttons (Missions, Capital, Pause, Hide interface, Settings) (-19, -21).
- [x] Poison (Snake Oil Still), Frostbite, Tesla research (Conductive Fog, Superconducting Ice), Tar Pit, raiders +15% health after wave 12 (-20).
- [x] Per-town missions and an empire chain; livelier interface; 3D app icon (-21).
- [x] Barracks and Drone Helipad (-22, -23).
- [x] Release A: drag to pan, two-tap selling, boss bar, clear plot selection with a ghost tower, tidy Works tab (-24).
- [x] Release B: 3D only (src/view.js), src/ui/ split, dead code removed, the controlled fresh start mechanism (-25).
- [x] Release C+D (one big update with a fresh start to save v7, 10 bonus deeds): tutorial; the Capital with the Capitol budget (foremen, War Office auto tower upgrades, Academy research), per-town auto waves fought in the background, institutions; Barracks beside the road with soldiers marching back up it, late-game price; auto-sell keeps enough for towers; brighter look (-26).
- [x] Barracks may touch the road at a corner; Foreman Agency perk (8 deeds: hires foremen automatically in every town) (-27).

### Next
- [x] **E. Tech trees with Influence.** (2026.11.15-28) A new empire currency, Influence: earned slowly from empire income (about the square root of the empire's coins per second, per minute) and from every town charter signed. Two trees in the Capital, drawn as a scrollable node tree in a sheet (new `src/ui/trees.js`, nodes with pixel icons from `src/art.js`; locked nodes show what they need).
  - Economy tree (Department of Education): Industry (gathering, workshop speed), Commerce (sale prices, contracts), Logistics (route capacity and fees, porter speed), Administration (foremen efficiency, hire costs), Academy automation (how fast and how wisely the Capitol's Academy researches).
  - Defence tree (War Office): Arms (tower damage), Engineering (War Office auto-upgrade speed, from one upgrade per town every 5 minutes towards one a minute, and cheaper tower upgrades), Garrison (Barracks soldiers and drones), Fortification (vault strength and repairs).
  - Nodes multiply within their branch, survive town charters, and reset only at the Constitutional Convention (G). Save: `S.capital.inf`, `S.capital.tree`. Tests: Influence accrual, node effects in background towns, charter keeps nodes.
- [x] **F. Stock Exchange** (a Capital institution): shares in each town (Copper Gulch Mining Co., Iron Ridge Rail, Silver Falls Electric, later Thunder Mesa Oil). Price follows the town's income trend with noise and news events (a boss beaten, a x2 milestone, a fallen vault); buy and sell with coins; dividends from town income; holding a majority boosts that town's foremen. A price chart per share. Coins only, never real money. Tests: price follows income, dividends, majority bonus, no exploit loop (buy-sell spread).
  - Notes: shipped as save v9. Institution "Stock Exchange" (src/capital.js, ui in src/ui/exchange.js): 1000 shares per town, fair price 3 s of the town income, drift with a 2 minute catch-up, noise every 10 s, news mood (boss +12%, works x2 +4%, vault -15%, fades over 4 min). Dividends 5-14% of town income by level. Majority: that town foremen paid 50% more (exBoost). 1% spread each way. A charter gives up all shares (otherwise shares would carry coins through it). scripts/cdp.js now kills its headless browser on exit (167 were left running).
- [x] **G. Policies and the Constitutional Convention (global prestige).** (2026.11.16-2)
  - Policies in the Capitol, in pairs, locked until the next convention: Free Market (prices float wider, bank interest up) vs Planned Economy (steady prices, foremen +50%, calmer stock prices); Militia (cheaper, more soldiers) vs Standing Army (stronger towers, upkeep); Open Borders (cheap, fast routes) vs Protectionism (home production up, routes dearer).
  - The Convention resets every town, the Capital, Influence, the trees and the Stock Exchange. It keeps badges, lifetime stats, deed perks (including the Foreman Agency, which makes a second run much faster) and pays **Legacy** from lifetime empire income and the deepest wave: x1.25 income and damage per Legacy, plus Legacy-only perks (towns open from the start, the Capitol built at level 1, a starting Influence pot). Deeds themselves convert into Legacy.
  - It must be clearly worth it: extend `scripts/idle.js` to run two lives and prove the second reaches the first life's peak income in under 40% of the time.
  - The owner pre-approved a forced fresh start here only if the save can't be migrated (WIPE_V, 10 bonus deeds); prefer a migration.
  - Notes: shipped as save v10 with a migration (no fresh start; the first life counts every coin earned so far). Logic in src/convention.js, interface in src/ui/convention.js (policies in the Capitol, a Convention sheet from the Capital bar). Policies are free, adopted with two taps, locked until the Convention: Free Market +15% sale prices, half the market depth, double bank interest, share noise x1.6; Planned Economy double market depth, foremen paid 50% more, share noise x0.4 and half the news swing; Militia Barracks and Helipads 40% cheaper to build and drill, one more soldier; Standing Army towers +25% damage, upkeep 2% of each town income; Open Borders routes +50% capacity, half fees; Protectionism +20% gathering and workshops, fees x2.5. Legacy compounds (x1.25 a point, like the spec says per Legacy), so it is earned slowly: 2 per tenfold of coins earned this life past 100 million (3 tried first, toned down), 1 per 10 waves past wave 20 (deepest town), and deeds convert at equal worth (round(log(1 + 0.2 deeds) / log 1.25)). Needs the Capital and one point beyond the deeds. Kept: badges, lifetime stats, deed perks (S.paidDeeds keeps them paid for), Legacy, settings, empire missions and charter counts; best waves per map reset. Legacy perks: Iron Ridge open (2), Silver Falls open (4), the Capital founded with every institution at level 1 (6), 100 Influence a rank (3 ranks). Head Start, Seed Money and Old Fort apply to Copper Gulch after a Convention. idle.js 12 now runs two lives: 5 Legacy (x3.05) after 12 h, and the second life reaches the first life peak income in 40 min (6%). Balance unchanged (wave 10 at 7.0 min, first deed 32.7, best 49). New badge: Founding Delegate.
- [x] **H. Thunder Mesa, the fourth town** (2026.11.16-3) (oil and flight): oil wells, rubber, aluminium; refinery, tire works, aluminium smelter, engine plant, airship hangar; an airship boss on its own air path (drones and Tesla can hit it, troops can't); unlocked from the Capital (Department of Transport level 5); its own missions (`GOALS_BY_TOWN`), its own share, 3D models with the modelling kit (`src/r3d/kit.js`), its own map palette and backdrop.
  - Notes: shipped as save v11 (the migration only adds the airship count; the new goods start at zero everywhere). Opens from the Empire tab once the Department of Transport is level 5, for 100M coins (`unlock.cap` in `TOWNS.mesa`, `unlockReady` in state.js). Chain: Oil Well, Rubber Farm, Bauxite Mine; Oil Refinery (fuel), Tire Works, Aluminium Smelter; Engine Plant (fuel, aluminium and wire shipped from Silver Falls); Airship Hangar (motors, tires, aluminium), balanced at equal levels. Raiders x1.4 health, x2.8 coins, charters +3 deeds. The map has a sky lane (`MAP.air`, path 1) drawn as faint chevrons; it blocks no plots. Every tenth wave the sky pirate airship flies it with 60% of a war wagon's health; only Tesla coils and drones hit it (frost, poison, tar, cannon blasts, dynamite and soldiers pass beneath); at half health it drops two brutes onto the road. Background waves need sky-reaching towers to beat it (`winsWave` in capital.js). Tower goods are Mesa goods (Tesla: aluminium and fuel, so it can be built early). 11 missions, two empire missions, four badges, a Legacy perk (Oil Strike, 5 Legacy). The Stock Exchange already listed Thunder Mesa Oil. Fixed on the way: background towns fought on the home town's map (its health, coins and road length); Head Start now builds the first two gatherers and the first workshop of whichever town signs (Iron Ridge gets a Coal Seam instead of a Quarry). Found, not changed: the road texture strips in `src/r3d/world.js` face downwards and never draw (roads show only the carved ground colour). Tests in test/mesa.test.js. Balance unchanged (wave 10 at 6.7 min, first deed 30.0, best 50); idle.js PASS.

### Then, polish (one per run, in this order)
- [x] **I1. A walkable 3D Capital.** (2026.11.16-4) Today the Capital is a panel. Make it a place: visiting it shows a capital city scene (no road, no waves) with the Capitol dome and each institution as a 3D building on plots; tapping one opens its card. Reuse `src/r3d/buildings.js` patterns and the town-switch machinery, or a separate scene in `src/r3d/main.js`.
  - Notes: no save change (the visit is not saved; a reload starts in your town). Once the Capital is founded the dome button (key C) and the Empire tab visit it, and founding it takes you there; the same button, a Back to <town> bar in place of the wave controls, or Escape bring you home. The town you left plays on meanwhile (the bar says when a wave is under way there); travelling to a town or holding the Convention leaves the Capital. The layout (`CAP_SITE` in src/capital.js) uses the town board (12 x 14) so the camera, pan and zoom work unchanged; taps cast a ray against each building as a box (`capRay`), so a roof in front wins over the plot behind it. The scene (src/r3d/capital3d.js, drawn by `syncCapital` in main.js instead of the town): a domed Capitol at the head of a paved avenue, a fountain plaza, lamp posts lit at night, benches, flagpoles, lawns, trees and hedges, townsfolk strolling, a dirt road out into the desert. Six institution models (Market Board hall with a price board, a station with a clock tower, a columned bank with a vault door, a schoolhouse with a bell tower, the Stock Exchange with a ticker and a golden bull, a stockade War Office); unbuilt ones are surveyed lots; lanterns at level 5, gold trim at 10, a gold flag at the top level; a first build rises, a new level pops. Signs show each name with its level, or build (gold when affordable). Cards: the Capitol (Budget and waves, Tech trees, Convention) and each institution (build or upgrade, plus Trade shares, Economy tree, Defence tree or Auto-sell rule). Tests in test/capitalcity.test.js; smoke.js visits, taps a roof, builds from the card and leaves; shots3d.js adds city, citycard and capitol shots. Balance unchanged (wave 10 at 6.9 min, first deed 30.4, best 50); idle.js PASS.
- [ ] **I2. Juice:** build animation (scaffold, then pop with dust), upgrade sparkle, a cinematic boss entrance (camera eases toward the boss, banner), coin bursts flying to the counter.
- [ ] **I3. Title screen and music:** a slow flyover of the town behind the title and Continue/New buttons; procedural Western music (WebAudio, no files) with a volume setting.
- [ ] **I4. Save slots and export/import polish;** gamepad support (move a cursor over cells, buttons for the main actions).
- [ ] **I5. Market depth:** booms and busts per good, orders with deadlines and reputation, per-good auto-sell modes.
- [ ] **I6. Interface icons rendered from the 3D models** (a render-to-texture pass) so menus match the world.

## Rules from the owner
- Free forever: no ads, no purchases, no tracking, no outside requests at runtime, no new downloads or CDNs.
- No personal details (names, emails, LAN addresses, family stories) in code, commits or docs: the repo is public.
- Look: crisp flat pixel UI, no glossy gradients or glass; modern motion is welcome. Phone first (sheet slides up, side buttons top right), then landscape and desktop.
- Keep saves: bump `v` in `fresh()` and migrate in `adopt()`; a forced fresh start only as agreed above.
- Publish working releases often; the owner plays the installed app between sessions.

## Release checklist (every release; stop and fix on any failure)
1. `node --test test/*.test.js` (tests for every new mechanic, using `scripts/sim.js`).
2. `node scripts/idle.js 12` prints PASS; `node scripts/balance.js 120 1`: wave 10 at about 6-7 minutes, first deed about 30, best wave about 50.
3. `node scripts/smoke.js` ends with phone, land and desk ` ok` (extend it for new screens; `TRACE=1` names each step).
4. Screenshots: `node scripts/shots3d.js <dir> gulch|ridge|falls`; look at them.
5. `node scripts/bump-version.js "note, no apostrophes"`, then `node scripts/update-test.js` (must print ok), commit, push `main`, wait for the Pages build, confirm the live `version.json`.

## How the code is laid out
Plain classic scripts sharing one global scope, loaded in order by `index.html`: `src/defs.js` (goods, buildings, towers, foes, towns), `map.js`, `art.js` (pixel icons), `state.js` (save, towns, routes, migrations), `economy.js` (production, foremen, valuation), `goals.js` (missions, badges), `combat.js` (waves, towers, troops, drone), `fx.js`, `capital.js` (Capitol budget, background waves, institutions, tech trees, Stock Exchange), `convention.js` (policies, the Constitutional Convention, Legacy), `view.js` (layout, graphics settings, lights, camera, taps, overlay), `src/ui/*.js` (interface), `app.js` (loop, install, updates). The 3D town: ES modules in `src/r3d/` on three.js (`vendor/three`). Per-town state is `TOWN_KEYS`; `withTown(id, fn)` swaps a background town in (never nest it).

## History (earlier plans, all done or folded into the roadmap above)

### Copper Gulch 2.0 roadmap (current direction)

The user's goals: a game good enough that people would pay for it (it stays free: no ads, no purchases, no outside requests), a **voxel 3D** engine, **several towns that all run at once** with goods **shipped between them**, coins per second for each town, and real depth. Ship every stage as its own published update, and migrate saves.

| Stage | What ships | Status |
|---|---|---|
| 1. Quick wins | Coins per second (live and potential); foremen paid a share of income, with a reserve; payback-ranked and chain-aware upgrades; selling-strategy panel; cheaper top tier | **Done** (see below) |
| 2. Foundations | Code split into `src/*.js` (plain scripts sharing one scope, loaded in order: no rewiring, identical behaviour); `scripts/sim.js` loads the simulation files into Node; `node --test` (test/sim.test.js); the balance bot runs in Node (90 minutes in about 4 s); save v4: `S.town` plus `S.towns` (other towns' `TOWN_KEYS` fields, swapped in by `withTown` / `switchTown`), automatic `-v3-backup` before migrating; `bump-version.js` writes the service worker's file list | **Done** |
| 3. Empire | Empire tab (town cards with live and potential coins/s, totals, unlock, travel), background towns (`econTowns`: every town's economy each frame, waves only where you are), shipping routes (`S.routes`, `shipGoods` before auto-sell, inbox per town, wagon 120/min at 5% → train 1200/min at 2% once a Locomotive Works stands), suggested routes for goods a town cannot make, convoys drawn past the market, **Iron Ridge** (`TOWNS.ridge`: iron, coal, stone → pig iron → rails, boilers (needs planks) → locomotives (needs gears); towers paid in Ridge goods; armoured-train boss; switchback map; opens after wave 20 in the Gulch for 100K). Town data: `TOWNS`, `useTown` (swaps EXT/SHOPS/BUILD/BY_ID/SLOT), `towerGoods`, `bossName` | **Done** |
| 4. Voxel engine v1 | **Done as a preview** (Settings → View → 3D). Written directly in WebGL2 instead of vendoring three.js (no download, small, full control): `src/render3d.js` voxelizes every `mk()` sprite (prism / lathe / cross, outline pixels dropped, per-vertex ambient occlusion), terrain from the map grid, a 2048 sun shadow map with PCF, hemisphere light, 8 point lights from `gatherLights()`, fog, the 2D engine's bloom and colour-grading shaders reused, orbit and zoom camera (drag, pinch, wheel, double-tap), `r3Pick` ray-to-ground picking behind `gridAt`, labels and `drawHUD()` projected onto an overlay. Planned originally: three.js vendored and pinned (served from the repo), `voxelize()` that extrudes the existing `mk()` sprites with depth profiles, greedy meshing and vertex ambient occlusion, heightfield terrain, sun shadow map, up to 8 dynamic lights picked by `gatherLights()`, bloom, orbit/zoom camera, raycast picking. Copper Gulch in 3D behind a "3D (preview)" setting | |
| 5. 3D by default (next) | All models, animation and effects in 3D, weather particles, water, boss cameras; Low preset = today's 2D as the fallback | |
| 6. Silver Falls | **Done** (before Stage 5, which waits for a phone check of 3D): `TOWNS.falls`, copper and sand → copper, wire, glass → light bulbs → telegraphs (needs rails from Iron Ridge); a power grid (`powerUse`: Water Wheels supply 4 per level, each workshop level uses 1, workshops slow to the powered share); a river path (`MAP.river`) for river pirates (`boat`) and the ironclad steamer boss; opens after wave 15 in Iron Ridge for 1M. Still to do from the original row: research tree interface. Original row: | Electric era: power grid, river raids by boat, barges, research tree interface | |
| 7. Thunder Mesa and polish | Aether era with air waves and airships; title screen flyover, procedural Western music, tutorial, gamepad, save slots, final balance | |

Depth to fold in along the way: per-good auto-sell modes, market booms and busts, orders with deadlines and reputation, townsfolk (workers and happiness), a branching research tree per era, tower veterancy and third-tier paths, terrain height giving tower range, player road tools (barricades, caltrops, flares), an era boss per town, an empire-wide perk tree, re-charter one town at a time, empire level and cosmetics, about 60 badges.

**Stage 1 results** (simulation: 40 minutes, every building starting at level 5, auto-sell everything):

| | Coins earned | Cash at the end | Engine / Steel / Clock / Automaton Works |
|---|---|---|---|
| Old foremen (25% of coins per step) | 1.62M | 107K | 11 / 8 / 5 / 5 |
| New, paid 50% of income (default) | 1.36M | 714K | 15 / 7 / 5 / 6 |
| New, paid all income | 1.66M | 23K | 17 / 10 / 8 / 10 |
| No foremen | 574K | 594K | 5 / 5 / 5 / 5 |

Two lessons for later stages:
- **Keep the chain ratios together.** Raising only the top-tier rates starved the Clockworks of gears and cut no-foreman income to a third. The top tier was made cheaper (Engine Works 2.5K, Steel Mill 4K, Clockworks 8K, Automaton Works 40K) instead.
- **The balance bot after Stage 1:** wave 10 at about 6.6 minutes, wave 30 at about 21.5, first deed at about 35 (the bot now invests in the chain before pushing waves), best wave about 50 (was about 46), lifetime coins about 2e7 (was about 1.1e7), Tesla Coil at about 14 minutes (was 28).

Economy code: `steadyIncome(extra, mode)` (coins per second with workshops limited by their inputs, upstream first), `foremenWork()` (purse = share of income; save up for the best payback; chain upgrades value a starved workshop together with its bottleneck supplier), `liveIncome()` / `sampleIncome()` (the last minute's real income).

### Where things stand

- The whole game is `index.html` (one file, no build, no dependencies). All work lives on `main`; there are no other branches.
- Published with GitHub Pages from `main` (root folder) at https://jonathanwessel.github.io/tycoon/. Pushing to `main` publishes; Pages rebuilds in about a minute.
- Hard rules from the user: no ads, no purchases, nothing that phones home. That includes web fonts and CDNs: the page must make no request to any other host. They like tycoon, tower defence and incremental games, and found the first text-heavy version "too basic". Anything new should be visible on the map, not just a new row in a list.
- One map per town (user decision, 2026-11-15): Forked Canyon and Trestle Bridge were removed, saves on them moved to Copper Gulch (save v5, towers on the new road refunded). A charter restarts only the town you are in; deeds come from that town's best wave and coins plus its bonus (`MAPS[].deed`: Iron Ridge +1, Silver Falls +2) and their +20% applies to every town. New places only come from the Empire tab.
- Already built: goals, building milestones, deed perks, tower paths and targeting, seven raider types with named wave mixes, Forked Canyon, moving prices, a third tier of goods with the Gatling tower, foremen, hold-to-gather, Dynamite and Overtime powers, a phone app layout, Hold waves, a full-game pause, and the visual pass (terrain detail, sunset into night, fireflies, scorch marks, trails, sliding banners, tab and card transitions).
- Phases 5 to 10 below are built: vault card and repairs, Masonry, visible reinforcement; the smoke test and balance bot now run without Playwright; README; war wagon entrance, health bar, phases and payout; weather; badges and records; Trestle Bridge; settings in the Charter tab and a hold-for-menu speed button. The second visual pass added a framed map, glossy buttons, a starry page background, road ruts and edge stones, props (barrels, crates, skulls, wheels), stone tower footings, coin drops, vultures, lit windows at night and impact sparks.
- Balance as measured by the bot (a near-perfect player) after phases 5 to 10: wave 10 at about 6.6 minutes, wave 20 at about 13.5, wave 30 at about 20, first deed at about 25, breaches from about wave 38, longest wait between buys about 2 to 3.5 minutes. This matched the version before those phases, so nothing was retuned. The bot is faster than the old targets (wave 10 at 10 to 15 minutes) because it plays perfectly; whether people find the early game too quick is a call for the user after playing.
- Code map inside the `<script>`:
  - Definitions: `ITEMS`, `EXT`, `SHOPS`, `RESEARCH`, `TOWERS`, `BRANCH`, `FOES`, `UNLOCK`, `WTYPES`, `MAPS`, `PERKS`, `ABIL`, `GOALS`, `SLOT` (yard layout).
  - Art: `paintSprites()` / `paintSprites2()` draw every sprite with `mk(name, w, h, p => ...)`; outlines plus white (`_w`) and ice (`_i`) copies are generated automatically.
  - Sim: `econ`, `combat`, `planWave`/`startWave`, `spawn`, `hurt`, `leak`, `towerStats`, `prestige`.
  - Looks only: `cosmetics` (particles, porters, smoke, dust, scorch marks, fireflies), `draw`, `bake` (static terrain), `fly` (icons flying to the HUD), `FXS` (shake, gold flash, building pop, banner, night).
  - UI: `PANELS.{defend,works,market,research,charter}`, `buyRow`, `costEl`, `card`, `refresh` (5 times a second), `tickHud` (every frame), `toggleAuto`, `setPaused`.
  - Save: `fresh()` is the save schema (v3), `adopt()` merges old saves, key `copper-gulch-save-v1`. `paused` is deliberately not saved. Settings live in `S.opt`; badges, best waves per map and charters per map survive a charter.
  - Lighting engine (`GLX`, `glSetup`, `glRender`, `gatherLights`): hand-written WebGL. In lit mode `draw` paints sprites onto a transparent objects layer (`GLX.ox`) and labels, numbers and banners onto an unlit overlay (`GLX.ux`); the baked `ground` canvas is the third input. The scene shader lights them (ambient by day/dusk/night and weather, a wandering sun with cast shadows from anything opaque on the objects layer, cloud shadows, up to 48 point lights), then bloom, colour grade and vignette. Never do full-screen fills on the objects layer in lit mode: they become shadow casters. Simple mode (`S.opt.gfx`, or no WebGL, or the auto fallback when frames stay slow) draws everything straight to `cv` as before.
  - Graphics options: `S.opt.gx` (`GX()`), presets in `GX_PRESETS` (low/med/high/ultra), colour looks in `LOOKS`, changed through `setGx` and applied by `applyGfx`; the gear button on the map opens `openSettings` (Graphics / Sound / Game). `renderScale()` is the single source for the canvas resolution: `fit` and the resize watcher both use it, and the smoke test checks the render matches the map on screen.
  - App: `manifest.webmanifest`, `sw.js` (network-first page, cached for offline), icons from `scripts/make-icons.js`. Before every push run `node scripts/bump-version.js "one-line release note"`: it stamps the same version into index.html, sw.js and version.json so installed copies show "Update ready" (via the new service worker, and via version.json as a backup) and then a one-time "Updated to…" note.
  - Look: crisp, flat pixel interface (2px borders, hard pixel bevels and drop shadows). No gradients, gloss or soft glows in the interface; the user found that "AI-looking".
  - Added with phases 5 to 10: `repair`/`repairCost` (vault), `spawnAt` and the boss block in `combat` (war wagon phases), `WEATHER`/`wx()`/`wxSpd()` (weather hooks in `towerStats`, `craftMult` and raider speed), `BADGES`/`checkBadges`/`medal`, `MAPS.bridge` with `ravine` and `onBridge`, `DECOR` props, `drops` (coins bouncing out of raiders), `applyMotion` (the Motion setting sets `REDUCED`).
- Vault today: strength starts at 20, max `20 + 5 × Reinforced Vault level`. It heals 1 per cleared wave and 5 per research level. A breach refills it but costs 10% of coins and drops 2 waves. There is no way to repair it for coins.
- Not verified: sound by ear, real-device touch feel, the speed button's hold menu on a real phone.
- Checks: `node scripts/smoke.js` and `node scripts/balance.js` use Playwright if installed, otherwise the installed Edge or Chrome via `scripts/cdp.js` (Node 22+). Run the smoke test after every change.

### Phase 5: Look after the vault

The vault is the player's health bar, and right now the only fast way to heal it is research. Make it something you can see, tap and manage.

1. **Vault card.** Tapping the vault on the map (the vault cell and the torch cells next to it; today the click falls through to "Towers go beside the road") opens a card like a building card: a strength bar, the current and maximum strength, and what raiders take when they get through.
2. **Repair for coins.** The card has "Repair +1" and "Repair to full" buttons.
   - Price per point: `ceil(foeCoins(S.wave) * 4 * MAP.coin)`, so one point costs a little under one wave-clear bonus. "To full" is that times the missing points, shown up front.
   - Only while no wave is on the road. During a wave the buttons are disabled and say "Repair between waves". This keeps defence meaningful.
   - On the map: masons with a hammer animation at the vault for a second, stone-dust particles, and the cracks drawn in `draw` closing up.
3. **HUD shortcut.** When the vault is below half strength, the vault number in the header turns red and pulses; tapping it opens the vault card.
4. **Masonry research.** Add to `RESEARCH`: `+1 extra vault strength per cleared wave`, max 4, cost 800 with growth 2.2.
5. **Visible reinforcement.** Each 4 levels of Reinforced Vault adds something to the vault sprite (iron bands, then sandbags, then a stone wall, then a flag), so upgrades show on the map.
6. **Goal.** Add "Repair the vault" to the scripted goal chain right after the first breach-capable wave, so players learn the card exists.

Done when: a hurt vault can be repaired between waves, repairs are refused during a wave, the HUD warns at low strength, and the balance bot (below) shows breach counts no worse than before up to wave 30.

### Phase 6: Safety net that runs here

1. **Smoke test without Playwright.** Keep `scripts/smoke.js` as it is, and add `scripts/cdp.js`: a tiny DevTools-protocol driver (Node 18+ has `fetch` and `WebSocket` built in) that launches the installed Edge or Chrome headless on a free port with its own temporary profile, and closes it when done. Port the smoke checks onto it as `scripts/smoke-cdp.js`. Same checks: phone and desktop widths, every tower and branch, a boss wave, tap-gather, every tab, a building card, pause and resume, Hold waves, the vault card, console errors, sideways scroll.
2. **Balance run.** Run `scripts/balance.js` through the same driver to wave 50 and record time to waves 10, 20, 30, 50, the first deed, and breach count. Tune only the definition tables if anything misses these targets: first tower within 1 minute; waves 1 to 3 cannot breach a player with one crossbow; wave 10 boss at 10 to 15 minutes; no stretch over about 3 minutes with nothing affordable; every tower type is the best buy at some point.
3. **README.md** for the public repo: one line on what the game is, the play link, two screenshots, "No ads, no purchases, no tracking", and how to run the checks. No personal details, no machine-specific setup.

### Phase 7: Make the war wagon an event

Every tenth wave is the boss, and it should feel like one.

1. **Entrance.** The road shakes, the banner turns red, and the wagon rolls in slowly with dust behind it.
2. **Boss bar.** A wide health bar across the top of the map with the wagon's name, instead of the small bar over the sprite.
3. **Phases.** At 50% health the wagon drops two brutes off the back; at 25% it speeds up and smokes.
4. **Payout.** When it falls: a big explosion, coins raining into the HUD, and a reward card listing the bonus.

Done when: a boss wave is clearly different from a normal wave on a phone screen, and the smoke test still passes through a boss wave.

### Phase 8: Weather

Short events that change tactics and are drawn on the map. One at a time, announced by the "Next" preview so the player can prepare, never on boss waves.

- **Dust storm:** blowing sand across the map, tower reach −25%. Frost and tesla are unaffected.
- **Rain:** rain streaks and puddles on the road, raiders −20% speed, crossbow damage −15% (wet strings).
- **Heat wave:** shimmer over the yard, workshops +25% speed, raiders +10% speed.
- **Clear night:** a full moon, every tower +10% damage.

Implementation: a `WEATHER` table, the chosen weather on `W` (not saved mid-wave), hooks in `towerStats` and the raider speed line in `combat`, drawing in `draw` after the night overlay. Respect `REDUCED`: no moving streaks, just a tint and an icon.

### Phase 9: Longer-term goals

1. **Badges.** A Badges section in the Charter tab: kill counts, waves reached, contracts filled, goods made, bosses beaten, a whole wave without a leak, a charter on each map. Each badge has a pixel icon, and earning one shows a banner. `S.stats` already tracks kills, contracts, taps and sales; add bosses, flawless waves and goods made.
2. **Stats page.** Lifetime numbers in the same tab: coins earned, raiders defeated, best wave per map, time played.
3. **Third map, unlocked by a charter on Forked Canyon.** Suggested: "Trestle Bridge", where the road crosses a ravine on a bridge. Raiders on the bridge cannot be blocked but take +25% damage. Needs its own `MAPS` entry, cactus list and `bake` details (ravine, bridge planks).

### Phase 10: Settings and comfort

1. **Settings section** (bottom of the Charter tab, moved out of Defend): sound on/off and volume, reduce motion (overrides the system setting), show damage numbers on/off, auto-pause when the page is hidden.
2. **Speed options:** keep 1×/2×/3× on the button and add a long-press menu.

### Working rules

- Keep it one self-contained file with no outside requests.
- Keep confirmations in the page rather than `alert`/`confirm`/`prompt`.
- Must work at 400px wide with no sideways scroll; touch targets at least 30px.
- Respect `prefers-reduced-motion` (the `REDUCED` flag) for any new animation.
- Add a `v` bump and an `adopt()` migration before any save-schema change.
- After each change: run the smoke test, look at one phone screenshot mid-wave, commit, push to `main`. No pull request unless asked.

### Graphics 2.0: stylized low-poly 3D (in progress)

The 3D view is rebuilt on three.js (vendored in vendor/three, MIT licence) with every model built in code (src/r3d/): buildings for all three towns with moving parts and milestone growth, jointed raiders, towers that aim and recoil, wagons, boats and trains, a carved terrain with mesas, roads with ruts, flowing water, soft sun and moon shadows, lamps and fires, bloom and the colour looks.

- [x] G1 three.js foundation (renderer, camera bridge, picking, overlay, quality presets)
- [x] G2 Copper Gulch modelled, terrain and backdrop (first pass)
- [x] G3 people and vehicles (first pass)
- [x] G4 towers and combat effects (first pass)
- [x] G5 Iron Ridge and Silver Falls buildings (first pass)
- [-] Polish pass from phone feedback: lighting, scale, camera framing
- [-] G6 build animations, icons from the models, 3D as the default after a phone check

Preview locally with `node scripts/serve.js` (modules do not load from file://). `node scripts/shots3d.js <dir> [town]` takes phone-size screenshots and prints frame timing.

### Economy that scales on its own (foremen + auto-sell)

`node scripts/idle.js [hours]` runs all three towns with every foreman on, auto-sell on and the suggested routes, untouched, and checks that income rises every hour, no workshop stands idle and foremen keep buying.

| After 6 idle hours | Before | After |
|---|---|---|
| Copper Gulch income | 3.3K/s | 49K/s |
| Iron Ridge income | 1.8K/s | 26K/s |
| Silver Falls income | 1.5K/s | 23K/s |
| Boiler Shop / Locomotive Works / Telegraph Works | 1 / 1 / 1 | grow to 40 / 45 / 43 by 12 hours |

What changed:
- Foremen count goods arriving by route (and those shipped away).
- They price sales at the level steady selling settles at.
- They save toward x2 milestones, and give a starved workshop's supplier enough levels.
- They may buy Steam Power, Assembly Lines and Haggling (Works tab, Research switch).
- They weigh saving time as well as payback.
- Each town's purse fills from that town's own earnings.
- Workshops that use the same good now share it by capacity instead of the first in the chain taking it all.
- Routes have an Auto rate.
- Every Locomotive Works level adds 10% train capacity.

Early pacing is unchanged (balance bot: wave 10 at about 6 min, first deed at 29-34 min, best wave about 50).

### Poison, tar and Tesla combos

- [x] Snake Oil Still (700 coins): lobs flasks that leave poison clouds; poison gets past shields; healers cure it. Paths: Plague Cloud (clouds twice as wide and long) or Spreading Fever (poison jumps to neighbours when a raider dies).
- [x] Frost Lens third path, Frostbite: chilled raiders take damage over time.
- [x] Tesla research: Conductive Fog (lightning arcs through a poison cloud) and Superconducting Ice (twice the reach, no power loss and two extra jumps across chilled raiders).
- [x] Tar Pit power (from wave 8, 50 s cooldown): tar ahead of the thickest group slows raiders to 40% for 12 s; an explosion sets it alight.
- [x] Raiders +1% health per wave from wave 13, capped at +15%. The balance bot still reaches wave 50, with the first deed at about 32 minutes.

### Next roadmap (Barracks to Thunder Mesa)

1. [x] Missions per town and an empire chain, with a Missions side button; a livelier interface; a 3D app icon.
2. [x] Barracks (from wave 15): soldiers hold a rally point on the road and fight raiders. Three tracks: Drill (spawn time), Recruits (up to 6 soldiers), Arms (strength).
3. [x] Drone Helipad: a Barracks transformation; its attack drone flies within the tower's range. Tracks: battery, range, attack.
4. [-] The Capital (after Silver Falls): Foremen Guild, Market Board, Department of Transport, Central Bank, Department of Education, War Office.
5. [-] Economy and Defence tech trees, bought with Influence; slow tower auto-upgrade in the Defence tree.
6. [-] Stock Exchange: shares in your towns.
7. [-] Policies and the Constitutional Convention (global prestige, paying Legacy).
8. [-] Thunder Mesa, the fourth town: oil and airships.

### Revised roadmap (after the Barracks)

- [x] Release A: drag to pan (pinch, twist), two-tap selling, boss bar and banners in the interface, clear plot selection with a ghost tower, a tidy Works tab.
- [x] Release B: 3D only. `src/render2d.js`, `src/gl.js` and `src/render3d.js` became `src/view.js`; `src/ui.js` was split into `src/ui/`; dead 2D code was removed; presets are 3D presets; a controlled fresh start (`WIPE_V`, 10 bonus deeds) is ready but switched off.
- [x] Release C: tutorial (offered on a new game, ten spotlight steps, replay from Settings).
- [x] Release D: the Capital (after Silver Falls reaches wave 15): the Capitol budget for foremen, the War Office (a tower upgrade every 5 minutes per town, faster with levels) and the Academy (research); auto waves per town, fought in the background from tower strength; Market Board, Department of Transport, Central Bank, Department of Education, War Office. Shipped with the fresh start (v7, 10 bonus deeds), the Barracks rework (beside the road only, soldiers march back up the road, late-game price, wave-scaled strength), auto-sell keeping enough for towers, a brighter look and snappier menus.
- [-] Release E: Economy and Defence tech trees (Influence).
- [-] Release F: Stock Exchange.
- [-] Release G: policies and the Constitutional Convention (Legacy).
- [-] Release H: Thunder Mesa.
