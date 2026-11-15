# Copper Gulch: next-phase plan

**Status (all four phases built):** test scripts in `scripts/`, balance tuned with the bot (first deed now at wave 35), goals, milestones, deed perks, tower paths and targeting, four new raiders and named wave types, Forked Canyon, moving prices, coal/steel/clockwork/automatons with the Gatling tower, foremen, and hold-to-gather. Saves from the first version migrate automatically.

Written for whoever executes next. Read "Where things stand" first, then do the phases in order. Each phase is shippable on its own; stop after any of them.

## Where things stand

- The whole game is `index.html` (one file, no build, no dependencies). All work lives on `main`; there are no other branches.
- Published with GitHub Pages from `main` (root folder) at https://jonathanwessel.github.io/tycoon/. Pushing to `main` publishes; Pages rebuilds in about a minute.
- Hard rules from the user: no ads, no purchases, nothing that phones home. That includes web fonts and CDNs: the page must make no request to any other host. They like tycoon, tower defence and incremental games, and found the first text-heavy version "too basic". Anything new should be visible on the map, not just a new row in a list.
- Code map inside the `<script>`:
  - Definitions: `ITEMS`, `EXT`, `SHOPS`, `RESEARCH`, `TOWERS`, `FOES`, `WAY` (road), `SLOT` (yard layout).
  - Art: `paintSprites()` draws every sprite with `mk(name, w, h, p => ...)`; outlines and white hit-flash copies are generated automatically.
  - Sim: `econStep`, `combat`, `planWave`/`startWave`, `hurt`, `towerStats`, `prestige`.
  - Looks only: `cosmetics` (particles, porters, smoke, rates), `draw`, `bake` (static terrain), `fly` (icons flying to the HUD).
  - UI: `PANELS.{works,market,research,charter}`, `buyRow`, `costEl`, `card`, `refresh` (5 times a second).
  - Save: `fresh()` is the save schema, `adopt()` merges old saves, key `copper-gulch-save-v1`.
- Not verified: balance past roughly wave 15, sound by ear, real-device touch feel.

## Phase 1: Safety net and balance (do this first)

Everything later changes numbers, so measure before adding content.

1. **Commit the test scripts.** The smoke test lives only in an ephemeral scratch folder. Recreate it as `scripts/smoke.js` (Playwright, pre-installed; do not install it): load `index.html` at 400px and 1200px, place each tower type, run through a boss wave, tap-gather, open every tab, tap a building; fail on console errors or sideways scroll.
2. **Write a balance bot**, `scripts/balance.js`. It drives the real page by calling `econ()` and `combat()` in a loop with a simple policy: buy the cheapest production upgrade that pays back fastest, keep stock for towers, build or upgrade the tower with the best damage per coin, deliver contracts when possible. Log game-time to reach waves 5, 10, 20, 30, 50 and the first deed, and how often the vault is breached.
3. **Tune to these targets** (edit the numbers in the definition tables only):
   - First tower placed within 1 minute; waves 1 to 3 cannot breach a player who placed one crossbow.
   - Wave 10 boss at 10 to 15 minutes; first deed (wave 20) at 45 to 75 minutes.
   - No stretch longer than about 3 minutes where nothing is affordable.
   - Every tower type is the best buy at some point; every workshop is worth building before wave 25.
4. **Fix known rough edges**:
   - Slowed raiders get a translucent blue disc drawn over them; replace it with a pale-blue tinted copy of the sprite (generate it in `mk` like the white copy).
   - Porters to the market are skipped when the source is the trees or rocks; fine, but the condition in `cosmetics` is convoluted. Simplify it.
   - Add a `v` field to the save and a migration step in `adopt()` before any schema changes below.

## Phase 2: Give the player goals

Incremental games need a "next thing" on screen at all times.

1. **Objectives strip** above the tower buttons: one current goal with a progress bar and a coin or goods reward. Start with a scripted chain that teaches the loop (place a crossbow, build a lumber camp, build a sawmill, sell 20 planks, fill a contract, survive wave 5, build a cannon, research the ledger, beat the wave 10 wagon), then switch to generated goals.
2. **Milestones**: at building levels 10, 25, 50, 100 that building's output doubles. Show a star on the building sprite and a gold flash when it lands.
3. **Deeds shop**: replace the flat +20% per deed with a small tree bought with deeds (start with a level-3 camp and mine, keep research after a charter, +1 starting tower slot, raiders drop goods, faster porters). Keep a base bonus per deed so old saves lose nothing.

## Phase 3: More to defend against

1. **Tower branches**: at level 5 a tower picks one of two paths, with a new sprite each. Crossbow: rapid repeater or long-range sniper. Cannon: mortar (bigger splash) or grapeshot (cone). Frost: deep freeze (brief stun) or brittle (chilled raiders take +30% damage). Tesla: longer chains or overload (stuns bosses).
2. **Targeting choice** per tower: first, strongest, weakest. Three small buttons on the tower card.
3. **New raiders**, each with a sprite and a counter: shielded (ignores the first few hits, so cannons beat it), sapper (damages a tower it passes unless killed fast), healer (mends neighbours), thief (runs for the market and steals goods instead of coins).
4. **Wave variety**: named wave types shown in the "Next" preview (rush, heavy, swarm, mixed) instead of one random mix.
5. **Second map** unlocked by the first charter: a longer road with a fork. Move `WAY` and the cactus list into a `MAPS` table; `bake` and `posAt` already work from waypoints.

## Phase 4: More tycoon

1. **Moving prices**: each good has a demand level that drops as you sell and recovers over time, with a small price chart per good in the Market tab. Auto-sell gets a "only sell above" threshold.
2. **Third tier of goods** to extend the chain: coal (new mine type), steel (ingot + coal), clockwork (gear + lens), automaton (engine + clockwork + steel). Add yard slots by making the yard scroll or adding a second yard row.
3. **Managers**: hire one per building to auto-upgrade it when affordable, shown as a foreman sprite by the door.
4. **Hold to gather**: holding a finger on the trees or rocks gathers repeatedly.

## Working rules

- Keep it one self-contained file with no outside requests.
- Keep confirmations in the page rather than `alert`/`confirm`/`prompt`.
- Must work at 400px wide with no sideways scroll; touch targets at least 30px.
- Respect `prefers-reduced-motion` (the `REDUCED` flag) for any new animation.
- After each change: run `scripts/smoke.js`, look at one phone screenshot mid-wave, commit, push to `main`. No pull request unless asked.
