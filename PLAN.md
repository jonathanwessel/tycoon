# Copper Gulch: plan

Written for whoever executes next. Read "Where things stand" first, then do the phases in order. Each phase is shippable on its own; stop after any of them.

## Copper Gulch 2.0 roadmap (current direction)

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

## Where things stand

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

## Phase 5: Look after the vault

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

## Phase 6: Safety net that runs here

1. **Smoke test without Playwright.** Keep `scripts/smoke.js` as it is, and add `scripts/cdp.js`: a tiny DevTools-protocol driver (Node 18+ has `fetch` and `WebSocket` built in) that launches the installed Edge or Chrome headless on a free port with its own temporary profile, and closes it when done. Port the smoke checks onto it as `scripts/smoke-cdp.js`. Same checks: phone and desktop widths, every tower and branch, a boss wave, tap-gather, every tab, a building card, pause and resume, Hold waves, the vault card, console errors, sideways scroll.
2. **Balance run.** Run `scripts/balance.js` through the same driver to wave 50 and record time to waves 10, 20, 30, 50, the first deed, and breach count. Tune only the definition tables if anything misses these targets: first tower within 1 minute; waves 1 to 3 cannot breach a player with one crossbow; wave 10 boss at 10 to 15 minutes; no stretch over about 3 minutes with nothing affordable; every tower type is the best buy at some point.
3. **README.md** for the public repo: one line on what the game is, the play link, two screenshots, "No ads, no purchases, no tracking", and how to run the checks. No personal details, no machine-specific setup.

## Phase 7: Make the war wagon an event

Every tenth wave is the boss, and it should feel like one.

1. **Entrance.** The road shakes, the banner turns red, and the wagon rolls in slowly with dust behind it.
2. **Boss bar.** A wide health bar across the top of the map with the wagon's name, instead of the small bar over the sprite.
3. **Phases.** At 50% health the wagon drops two brutes off the back; at 25% it speeds up and smokes.
4. **Payout.** When it falls: a big explosion, coins raining into the HUD, and a reward card listing the bonus.

Done when: a boss wave is clearly different from a normal wave on a phone screen, and the smoke test still passes through a boss wave.

## Phase 8: Weather

Short events that change tactics and are drawn on the map. One at a time, announced by the "Next" preview so the player can prepare, never on boss waves.

- **Dust storm:** blowing sand across the map, tower reach −25%. Frost and tesla are unaffected.
- **Rain:** rain streaks and puddles on the road, raiders −20% speed, crossbow damage −15% (wet strings).
- **Heat wave:** shimmer over the yard, workshops +25% speed, raiders +10% speed.
- **Clear night:** a full moon, every tower +10% damage.

Implementation: a `WEATHER` table, the chosen weather on `W` (not saved mid-wave), hooks in `towerStats` and the raider speed line in `combat`, drawing in `draw` after the night overlay. Respect `REDUCED`: no moving streaks, just a tint and an icon.

## Phase 9: Longer-term goals

1. **Badges.** A Badges section in the Charter tab: kill counts, waves reached, contracts filled, goods made, bosses beaten, a whole wave without a leak, a charter on each map. Each badge has a pixel icon, and earning one shows a banner. `S.stats` already tracks kills, contracts, taps and sales; add bosses, flawless waves and goods made.
2. **Stats page.** Lifetime numbers in the same tab: coins earned, raiders defeated, best wave per map, time played.
3. **Third map, unlocked by a charter on Forked Canyon.** Suggested: "Trestle Bridge", where the road crosses a ravine on a bridge. Raiders on the bridge cannot be blocked but take +25% damage. Needs its own `MAPS` entry, cactus list and `bake` details (ravine, bridge planks).

## Phase 10: Settings and comfort

1. **Settings section** (bottom of the Charter tab, moved out of Defend): sound on/off and volume, reduce motion (overrides the system setting), show damage numbers on/off, auto-pause when the page is hidden.
2. **Speed options:** keep 1×/2×/3× on the button and add a long-press menu.

## Working rules

- Keep it one self-contained file with no outside requests.
- Keep confirmations in the page rather than `alert`/`confirm`/`prompt`.
- Must work at 400px wide with no sideways scroll; touch targets at least 30px.
- Respect `prefers-reduced-motion` (the `REDUCED` flag) for any new animation.
- Add a `v` bump and an `adopt()` migration before any save-schema change.
- After each change: run the smoke test, look at one phone screenshot mid-wave, commit, push to `main`. No pull request unless asked.
