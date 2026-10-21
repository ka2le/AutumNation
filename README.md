# AutumNation

A cozy autumn idle game. An old robot rakes falling leaves into a bin, a compost truck buys them, and you grow into more robots and metal miners.

**Working on balance?** Start with the [testing blind spots](BALANCE.md#common-testing-blind-spots--read-before-drawing-balance-conclusions)
and the [main tester commands](tools/balance/README.md). Test committed strategies and intentional skips alongside mixed development.

## Run it

- **Easiest:** double-click `start.bat`. It opens http://localhost:8080 in your browser.
  - With Node.js installed, it uses `server.js`, which reloads the page whenever you save a file in `public/`.
  - Without Node.js, it falls back to `serve.ps1` (built into Windows, no live reload).
- **From a terminal:** `npm start` (or `node server.js --port 3000 --no-open`).

## Publish to GitHub Pages

- **Play:** https://ka2le.github.io/AutumNation/
- **Repository:** https://github.com/ka2le/AutumNation

Everything the website needs is in `public/` (no build step). The active workflow is `.github/workflows/github-pages.yml`. Every push to `main` publishes that folder to GitHub Pages automatically.

To publish local changes:

```sh
git add .
git commit -m "Describe your changes"
git push
```

The repository uses **Settings → Pages → Build and deployment → Source: GitHub Actions**. Check the **Actions** tab for deployment status, or use **Deploy to GitHub Pages → Run workflow** to publish again manually.

All paths are relative, so the game works from `/AutumNation/` as well as from a custom domain. The old `AutumNationV*.html` snapshots and `Claude outputs/` are not published (only `public/` is).

## Install as an app

On the published site (https), Chrome on Android offers **Install app** / **Add to Home screen** in its menu. The game then opens full screen with its own rover icon and the name AutumNation, and keeps working offline. Desktop Chrome and Edge show an install button in the address bar. On iPhone, use Safari's **Share → Add to Home Screen**.

- `public/manifest.webmanifest` holds the app name, colours and icons. Its stable ID is `/AutumNation/app`, distinct from other apps on `ka2le.github.io`; `start_url` and `scope` resolve relative to the manifest's folder. The ID changed from `/AutumNation/` after an Android install became stuck in Chrome as "already installed" but could not open. Chrome treats this as a new app installation; existing installs with the old ID may remain until removed in Android Settings → Apps. Keep the new ID stable for future updates. If hosting at a different path, update the ID before the first install.
- `art/icon-master.png` is the rover artwork used for the app icon, maskable icon, Apple touch icon and cropped favicon. Run `tools/build-icons.ps1` to rebuild the sizes. `public/favicon.ico` contains 16, 32 and 48 px tab icons.
- `public/sw.js` is the service worker: it loads everything from the network when online (so a new version shows up on the next start) and falls back to its cache when offline. If you add or remove files, add them to `SHELL` and bump `VERSION`.

The service worker only removes old AutumNation caches and reads offline assets from its own cache, preserving other apps hosted on the same domain. Run `node tools/check-pwa.js` to verify app identity and cache isolation.

## Testing helpers (URL options)

| URL | What it does |
|---|---|
| `http://localhost:8080/?fresh` | Starts a new game without touching your save |
| `http://localhost:8080/?speed=4` | Runs the game 4× faster (0.25 to 20) |
| `?fresh&speed=10` | Both |
| `?fresh&lot=prairie` | Starts a new game on the Wildflower prairie (the second lot), with a robot like one you'd send there |

Progress saves in the browser's localStorage (key `leaf-yard-save-v2`). The Workshop card has a "Start over" button.

**Camera:** scroll (or pinch) to zoom, drag to look around, WASD or arrow keys to pan, `+`/`-` to zoom, Home or `0` (or the round button bottom right) to go back to the framed yard.

**Test panel:** tap the cash counter 3 times within 2 seconds to open a small test panel. It has buttons to add $10, $100, $500, $1k, $10k or $100k, and a **Next step** button that pushes the story along one beat (find the book or the dead bee, finish the research, earn enough for the letter, bring and read the letter, get the travel money, send the robot on the trip, earn the honey money...). The button says what it will do. Tap the cash 3 times again (or ×) to close it.

### Test locations (`?location2`)

Test copies of the game live in their own folders next to the real one: `public/location2/` and so on. Each folder is a full copy of `index.html`, `style.css`, `audio.js` and `game.js`; nothing in the main game links to them.

- Open one by adding `?location2` (or `?location2/`) to the address, e.g. `https://ka2le.github.io/AutumNation/?location2`. The page jumps to `location2/` and passes other options along (`?location2&fresh&speed=4`). You can also open `/location2/` directly.
- Each location has its own save (`leaf-yard-save-v2-location2`); the main save is never touched.
- **New location:** copy a folder (`public/location2` → `public/location3`) or the four root files into `public/location3/`, then open `?location3`. No edits needed: the code reads the folder name.
- **Remove one:** delete its folder. Nothing else breaks; `?location3` then just opens the normal game.

`location2` is **The Wildflower prairie**: a second plot of land for testing a "start over somewhere new" feature. A slider under the cash tag sets a pretend income from the first yard (0–1000 $/s).

### Balance simulation

For current balance work, run **`npm run balance`** for the main completion-focused, paid home → hollow → home
tester. **`npm run balance:check`** compares it with the earlier buyers across multiple seeds and checks goals,
purchase accounting, travel and deterministic replay. See [the testing guide](tools/balance/README.md) and
[the source balance assessment](tools/balance/source-balance.md). **`npm run balance:sources`** compares paid
source priorities from earned repair unlocks; `MODE=capacity` measures fully upgraded output separately.
Game prices and effects are unchanged by the tester.

The older console helper below is a single-yard sanity check, not a full-campaign completion benchmark.

Open the browser console on the game page and run:

```js
__leafYard.sim(1500, { priority: true })
```

This plays 25 simulated minutes with an auto-buyer and returns a log of what it bought and when. Use `{ priority: false }` for a "buy the cheapest thing" player. Your real save is not affected.

## Sound

All sounds are synthesized live in `public/audio.js` with the Web Audio API (no audio files). Leaf rustling and wind are off by default (switch "Leaves & wind" on in the sound card); robots beep softly now and then, truck payouts get little chimes (buying upgrades is silent), and a slow waltz in F plays with long leaf-only pauses between. Audio starts on the first tap or key press. The speaker button (bottom left) opens volume and per-layer switches; `M` mutes. Sound settings are stored separately under `leaf-yard-sound-v2`, so Start over keeps them.

## Files

```
public/                 the whole website (this is what GitHub Pages publishes)
  index.html            page markup and HUD
  style.css             HUD and upgrade-card styles
  audio.js              synthesized soundscape (leaves, wind, robot beeps, waltz)
  game.js               everything else: world, robots, truck, economy, drawing, cards
  manifest.webmanifest  app name, colours and icons for "Install app"
  sw.js                 service worker (offline play)
  favicon.ico           tab icon (16/32/48 px)
  icons/                app icons
.github/workflows/github-pages.yml active GitHub Pages deployment workflow
tools/balance-player.js headless balance test player
server.js      zero-dependency Node dev server with live reload
serve.ps1      PowerShell fallback server
start.bat      double-click launcher
```

## Where to tune things (game.js)

- `AREAS` holds the three land sizes (size, leaf spawn rate, leaf cap, price). The For Sale sign appears at 50% of the price.
- `SPOTS` are the metal veins and which land each belongs to. `TREES` are the canopies.
- `UP` holds the shared upgrades on the bin and the pickup sign.
- `TRACKS` holds the per-robot upgrade tracks (wheels, basket, pickup speed, claw, reach, drill): each has generations with their own level costs, and `vals` gives the effect per level.
- `TECH` holds the workshop research that unlocks each new generation. `DISCOUNT` is the price for a level another robot already has (as a share of full price); `discFor` applies the yard-wide upgrades that lower it.
- `allPlan` prices the green "Match all" / "All +1" buttons on robot cards (upgrade every robot on one track at once).
- `seenPrice` / `S.peak` hide research, yard-wide upgrades and the metal slot until you've once held 25% of their price.
- `GEN` holds the yard-wide upgrades in the Workshop's second column (shown from $10, `GEN_UNLOCK`).
- `camBounds` sets how far the camera may pan; `treeDrop` and `dropT` control the occasional big leaf drop under trees.
- `ROBOT_COST`, `MINER_COST` (flat, every miner costs the same), `METAL_SLOT_COST` are the unlock prices. `robotSpeed` sets the base walking speed. `STYLES` defines each robot's look and blurb.
