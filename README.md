# AutumNation

A cozy autumn idle game. An old robot rakes falling leaves into a bin, a compost truck buys them, and you grow into more robots and metal miners.

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

On the published site (https), Chrome on Android offers **Install app** / **Add to Home screen** in its menu. The game then opens full screen with its own leaf icon and the name AutumNation, and keeps working offline. Desktop Chrome and Edge show an install button in the address bar. On iPhone, use Safari's **Share → Add to Home Screen**.

- `public/manifest.webmanifest` holds the app name, colours and icons. Its stable ID is `/AutumNation/`, distinct from other apps on `ka2le.github.io`; `start_url` and `scope` resolve relative to the manifest's folder. If hosting at a different path, update the ID before the first install.
- `public/icons/` has the app icons (`icon.svg` and `icon-maskable.svg` are the sources; the PNGs are rendered from them), `public/favicon.svg` / `favicon.ico` the browser tab icon.
- `public/sw.js` is the service worker: it loads everything from the network when online (so a new version shows up on the next start) and falls back to its cache when offline. If you add or remove files, add them to `SHELL` and bump `VERSION`.

The service worker only removes old AutumNation caches and reads offline assets from its own cache, preserving other apps hosted on the same domain. Run `node tools/check-pwa.js` to verify app identity and cache isolation.

## Testing helpers (URL options)

| URL | What it does |
|---|---|
| `http://localhost:8080/?fresh` | Starts a new game without touching your save |
| `http://localhost:8080/?speed=4` | Runs the game 4× faster (0.25 to 20) |
| `?fresh&speed=10` | Both |

Progress saves in the browser's localStorage (key `leaf-yard-save-v2`). The Workshop card has a "Start over" button.

**Camera:** scroll (or pinch) to zoom, drag to look around, WASD or arrow keys to pan, `+`/`-` to zoom, Home or `0` (or the round button bottom right) to go back to the framed yard.

**Test money:** tap the cash counter 3 times within 2 seconds for +$1,000. Keep tapping: the 4th tap gives +$10,000 and every tap after that +$100,000.

### Balance simulation

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
  favicon.svg/.ico      tab icon
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
