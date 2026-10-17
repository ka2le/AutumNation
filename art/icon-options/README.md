# Tinker icon options (2026-10-17)

Seven redraws of Tinker for the favicon and app icon, all on white, without the dirt and rust so they read at small sizes.
Open `tinker-icon-options.html` to compare them at 512, 64, 32 and 16 px, in a browser tab and on a phone home screen.

| # | File | What it is |
|---|------|------------|
| 1 | `1-head.svg` | Clean head: bucket hat, antenna light, big amber eye |
| 2 | `2-head-shoulders.svg` | Head plus neck, shell and teal band |
| 3 | `3-basket-leaf.svg` | Bust with the wicker basket and one orange maple leaf |
| 4 | `4-whole-tinker.svg` | Whole robot with treads and a basket of leaves (app icon only; mush at 16 px) |
| 5 | `5-minimal-head.svg` | Four flat colours; a leaf replaces the antenna light |
| 6 | `6-minimal-bold.svg` | **In use.** Four flat colours, cropped close: big eye, bucket, leaf tucked in the band |
| 7 | `7-minimal-basket.svg` | Four flat colours, bust with basket and leaf |

Minimal palette: metal gray `#a8b2b6`, dark metal gray `#4c565a`, eye yellow `#ffc21a`, leaf orange `#ef7a1f`, on white.

`0-previous-icon-master.png` is the old dark-background icon (V14.3), kept in case we go back.

## Switching to another option

The shipped files are all rendered from one SVG (`art/icon-master.svg` is option 6, fitted with a 26 px margin):

- `public/favicon.ico` (16, 32, 48) and `public/icons/favicon-32.png`: 26 px margin
- `public/icons/icon-192.png`, `icon-512.png`: 26 px margin, white full-bleed
- `public/icons/apple-touch-icon.png` (180): 54 px margin, so iOS's rounded corners don't clip the bucket
- `public/icons/icon-maskable-192.png`, `icon-maskable-512.png`: 104 px margin, inside the maskable safe circle

Render the chosen SVG at 1024 px in a browser, downscale with Lanczos to each size, then bump the `?v=` on the icon links
in `public/index.html`, `public/location*/index.html` and `public/manifest.webmanifest`, and `VERSION` in `public/sw.js`.
