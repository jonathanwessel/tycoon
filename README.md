# Copper Gulch

A tycoon, tower defence and incremental game in one page. Gather timber and ore, build a chain of workshops up to clockwork automatons, sell goods or fill caravan contracts, and spend it all on towers that keep raiders away from the vault.

**Play it: https://jonathanwessel.github.io/tycoon/**

No ads, no purchases, no tracking. The page makes no requests to any other site, and your game is saved only in your own browser.

<p>
  <img src="docs/phone.png" alt="The gulch on a phone: workshops, towers by the road and raiders in the rain" width="300">
  <img src="docs/desktop.png" alt="Silver Falls at night on a computer: river pirates row in while the ironclad steamer comes up the river" width="640">
</p>

## What is in it

- Twelve buildings and twelve goods, with output doubling at milestone levels and foremen who upgrade buildings for you.
- Five towers, each with two upgrade paths and a choice of target, against seven kinds of raider and a war wagon every tenth wave.
- Weather that changes the fight: dust storms, rain, heat waves and clear nights.
- Moving market prices, caravan contracts, research, goals and badges.
- An empire of towns that all keep working: Copper Gulch, Iron Ridge, a steam-and-rail town with its own goods chain up to locomotives, and Silver Falls, an electric river town with a power grid, river pirates and an ironclad steamer. Ship goods between towns by wagon and later by train, and see coins per second for every town and the whole empire.
- Charters to start a town over for deeds, which make every town stronger and buy perks; later towns pay more deeds.
- Pixel art lit by a small hand-written WebGL engine: a moving sun with cast shadows, drifting clouds, lamps, forges, muzzle flashes and explosions that light the ground, and dusk falling as raiders arrive. A voxel 3D view (preview) turns the same town into a diorama you can rotate and zoom, with real sun shadows. Graphics settings (gear button on the map) offer Low to Ultra presets, separate controls for shadows, glow, resolution, effects, weather, shake and frame rate, and five colour looks with optional film grain and scanlines.
- Install it as an app from your browser (Install app / Add to Home Screen). It works offline and updates itself when a new version is published.
- Works on phones and computers, keeps working for up to 8 hours while you are away, and can hold waves or pause completely.

## Running it locally

Open `index.html` in a browser. There is no build step and nothing to install.

## Code

`index.html` holds the page and its styles; the game's code is in `src/` as plain scripts loaded in order (no build step): definitions, map, pixel art (the interface icons), state and saves, economy, goals, combat, effects, the view (layout, graphics settings, camera and taps), the interface (`src/ui/`: building blocks, actions, the card, map taps, the menu sheet, panels, the fixed parts, settings), and the app (loop, install, updates). The 3D town is drawn by `src/r3d/`, ES modules on three.js (vendored in `vendor/three`, MIT). Serve the folder over http to play locally (`node scripts/serve.js`); modules do not load from file:// pages.

## Checks

- `node scripts/update-test.js` checks that a published update reaches an open (or installed) copy of the game.
- `node --test` runs the simulation tests: the game's own economy, combat and save code loaded into Node (`scripts/sim.js`), no browser needed.
- `node scripts/balance.js [minutes] [runs]` lets a bot play the real game logic in Node and reports how long each milestone takes (a 90-minute game in a few seconds).

The browser checks need Node 22 or newer. They use Playwright if it is installed, and otherwise drive an installed Edge or Chrome directly (`scripts/cdp.js`); set `CHROME_PATH` to pick a browser.

- `node scripts/smoke.js [screenshot-dir]` plays through every tower, raider, power and screen at phone and desktop sizes and fails on errors or broken layout.
`PLAN.md` describes how the code is laid out and what is planned next.
