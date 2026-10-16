# V34: midgame investment prices

## V34.1 update: 1,000-ingot ending goal

The current final goal is **1,000 sold ingots**, down from 2,000. The V34 price-pass comparisons below retain the
old 2,000 goal and are historical evidence for that pass. Goal text, HUD, final letter and test jumps use the same
`INGOT_GOAL`; existing sold progress is preserved and saves already past 1,000 can reach the new goal.

Twelve paired goal-only campaigns (six seeds, two buyers) have identical earlier stages and purchases up to the
new goal. Return home to ending falls from **31.20 to 25.25 minutes**, total time from **147.77 to 141.82**, and the
last physical furnace purchase-to-goal gap from **7.18 to 1.70**. Savings range from 5.63 to 6.42 minutes.
Physical furnace tracks are all maxed in 11/12 runs; the final alloy step is bought in only 1/12, versus 10/12
before. It is now largely optional. Buyers retain their previous decisions until the final trip; these are not
optimal-player forecasts. The finale animation is excluded from finish time.

Evidence: Git-ignored `runs/v34-ingot-goal/summary.json`, `report.md`, source snapshots and all twelve campaigns.

The target is the cost of adding useful capacity. Cheap training on another robot is intentional: copied levels
remain 50%, Shared basket plans remains $150 and reduces copied baskets to 10%, and Match keeps its existing
behaviour. V34 changes prices, with no additional skill consolidation, capacity changes or output changes.

## Selected prices

| Path | Before V34 | V34 |
|---|---|---|
| Robots 2–10 | 8, 15, 30, 95, 140, 240, 380, 560, 800 | 8, 30, 65, 120, 175, 290, 450, 650, 900 |
| Wheels, first 3 | .30, .60, 1.20 | unchanged |
| Wheels, levels 4–7 | 3, 4.50, 7, 10 | 4, 6, 10, 16 |
| Wheels, final 2 | 77, 163 | 100, 190 |
| Basket, first 3 | .25, .50, 1 | unchanged |
| Basket, levels 4–7 | 3.75, 6.25, 10, 15 | 5, 8, 13, 22 |
| Basket, final 2 | 105, 268 | 140, 300 |
| Pickup, first 3 | .30, .60, 1.20 | unchanged |
| Pickup, levels 4–6 | 2.50, 4.50, 8 | 3.50, 6, 11 |
| Pickup, final 2 | 65, 221 | 85, 250 |
| Later research: hubs / hopper / wrist / fine control | 72 / 40 / 20 / 45 | 90 / 50 / 25 / 55 |
| Bin, levels 5–8 | 15, 60, 190, 520 | 30, 100, 260, 650 |
| Truck, levels 3–4 | 28, 90 | 50, 140 |
| Leaf sorting, levels 6–7 | 70, 160 | 100, 220 |
| Better bags, level 4 | 127 | 170 |
| Later shaking | 32, 50, 65 | 45, 70, 90 |

Early research unlocks, all claw/reach prices, the first four bins, first two truck steps, other leaf-value prices,
all blowing and helper build prices, bees/ants, honey, packing, mining, smelting and charcoal prices/times are
unchanged. Robot entries 11/12 remain unused at the ten-robot cap. Their prices are $1,200/$1,600.

The robot-price premium tapers: robot three doubles and four goes from $30 to $65, while robot ten rises only
12.5%, from $800 to $900. This retains the increase without extending early doubling into industrial staffing.

## Cost of preparing another gatherer

Example: Wheels 7, Basket 7, Pickup 6, with the shared research already unlocked. Effects at those levels are
unchanged. Excludes claw/reach, packing, research unlocks and plans.

| Purchase | Before | V34 |
|---|---:|---:|
| Train a leader to those levels | $80.45 | $110.45 |
| Train a follower at copied-level prices | $40.50 | $55.25 |
| Robot 3 plus that copied training | $55.50 | $85.25 |
| Robot 4 plus that copied training | $70.50 | $120.25 |

The first three levels of all three tracks together still cost $5.95 at full price, or $3.00 when copied. Cheap
basic training therefore remains cheap. Added output is not proportional to these skill values: travel distance,
source availability, bin room, packing and pickup timing still limit the benefit of an extra gatherer.

## Monetary readiness

Tinker's goal rises from $600 to $750 because the same gathering skills are worth more at the new full prices.
It remains a money goal; already attained readiness remains attained. Tier research is excluded as before.
This is a repricing of the V33.1 benchmark, not a claim that the older V31 incoming crew is exactly reproduced.
Actual physical skill endpoints at arrival are checked in the campaign evidence. No save migration is needed.

## Paid campaign evidence

Baseline is committed V33.1 (`f1b1aca`); selected V34 is the `tapered` arm in `runs/v34-midgame/`.
Six paired seeds for each of two buying policies, with real 20 Hz movement/production, one-second buying decisions,
paid purchases, a fresh $0 hollow, actual research/story gates and returning saves. Headless presentation patches
allow letters and boarding. These are comparisons of heuristics, not human or optimal-player time predictions.

Minutes, means of six seeds per policy:

| Buyer / version | First home | Hollow | Return to finish | Total |
|---|---:|---:|---:|---:|
| Balanced, before | 56.08 | 45.43 | 27.08 | 128.58 |
| Balanced, V34 | 66.35 | 50.71 | 30.68 | 147.74 |
| Deliberate, before | 57.23 | 44.96 | 29.38 | 131.57 |
| Deliberate, V34 | 65.47 | 50.60 | 31.72 | 147.80 |

Across the two policies, robot three arrives around minute 26.08 rather than 21.76, and robot four around 31.38
rather than 24.93. At purchase, their costs represent about 44 and 93 seconds of rolling income, versus 20 and 34
seconds before. These are affordability measures, not stopwatch measurements of continuous saving. First honey
sales move from 38.83/41.47 to 42.85/45.76 minutes.

An initially stronger curve ($160/$260/.../$1,200 from robot five onward, steeper first-researched skills) was
rejected after three paired seeds per buyer: it pushed home to roughly 69 minutes, hollow to 55, and total to
155–157. A gentler intermediate curve was also tested before selecting the taper. A separate three-seed test per
buyer restored robot-five-and-later prices entirely (`lateControl`): home/hollow/ending were 67.32/50.06/29.46 for
balanced and 66.20/50.86/31.95 for deliberate. Dropping the premium did not consistently improve the overall route
or remove the ending delay, so the smaller continuing premium was retained.

### Limits and remaining risk

- Average time before return rises about 14.7 minutes relative to V33.1. This is additional slowdown on top of V32;
  it should not be described as meeting the original 20–30% target relative to V31.
- The ending is still about 3.6 minutes slower for balanced (+13.3%) and 2.3 slower for deliberate (+8.0%). It is
  approximately 10.5% slower when the two policy means are averaged. Maximum industrial effects and prices are
  preserved, but the earned crew and funding path change. The original ending-time protection is not fully met.
- Bin-full snapshots in minutes 15–35 rise only from about 2% to 4%. The tests show more saving for growth; they do
  not establish that storage becomes a dominant bottleneck or that every new capacity choice is well balanced.
- Aggregate cheap-click counts are not a success criterion. Paid catch-up skills remain cheap by design.
- A factory-focused heuristic is checked separately. It is not an optimal-player benchmark: it commits workers
  heavily to industry and can postpone using honey to fund its ramp. Three paired seeds finished without errors;
  its ending mean rises from 26.74 to 32.71 minutes, a six-minute / 22.3% slowdown. This is additional evidence that
  unchanged industrial prices and maxima do not protect the funded route. Do not claim the ending goal is solved.
- The last physical furnace purchase still precedes the ingot goal by about 7.18 minutes versus 7.42 before,
  averaging the two main buyers. The original physical-development drought is not solved by this price pass.

## Checks and local reproduction

- `node tools/check-investments.js`: protected basic prices/effects; exact new ladders; real paid hires up to the
  cap; skill purchases, Match/discount charges, final endpoints, legacy saves, travel and bee/ant prices.
- `node tools/check-rack.js`: storage/reservations and six physical production-conservation runs.
- `node tools/check-pwa.js`: identity/scope/cache checks.
- Ten first-coal regressions in `runs/v32-review/check-coal.cjs`: no-leaf discovery, burning and legacy recovery.
- `runs/v34-midgame/summary-pilot.json`: all paid campaign metrics and individual rows. `analyze.cjs` rebuilds it.
- `input/`, `frozen/`, `manifest.json`, `pilot/`: exact per-arm sources, hashes and detailed purchase/state logs.
- `industrial-check/`: extra paired factory-focused campaigns.

Detailed runs are local and Git-ignored. `build.cjs`, `refine.cjs`, `taper.cjs` document each candidate construction;
their inputs are frozen copies of production rather than edits to the live game.
