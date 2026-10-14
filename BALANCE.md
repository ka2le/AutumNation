# AutumNation balance guide

A reference for tuning the economy and for pricing anything new. It covers what we're aiming for, the maths behind
it, how to measure it with the headless tools, the current numbers (V9), and what we've learned the hard way.
`PROJECT_NOTES.md` has the history of every change; this file explains *why* the numbers are what they are and *how*
to check them.

Contents: 1 Goals · 2 Core ideas and formulas · 3 Methods and tools · 4 Pricing something new · 5 Current balance (V9)
· 6 Pitfalls · 7 History of balance passes · 8 Pending balance work

---

## 1. Goals

These are the design rules every balance pass is checked against.

1. **Every part of the yard is the bottleneck at some point**, in roughly this order: robot speed and baskets → bin →
   leaf price → one truck step (repeat) → a second robot instead of more unlocks → claw and reach → bagging table →
   leaves run short → shakers / blowers → bees and a packer → ore mining → land (more leaves, flowers and veins) → more
   robots → smelting, with the furnace's own upgrades as the dear part.
2. **The 5-minute payback rule.** A plain "keep upgrading this path" step (sale prices, bag/label/grade/alloy steps,
   cleanup deals, market stall, slag, furnace heat) must pay for itself within **5 minutes at most**, measured at the
   point where a sensible player with a balanced yard would buy it. Aim for **3–5 minutes**. A step that pays back in
   under ~2 minutes is too cheap for its stage. Raise it a little: cheap multipliers are what make the curve run away.
3. **Milestones are judged as a package.** Land, the bagging table, the hive, the metal slot, the smelting plant, mine
   shafts and gift wrapping don't have to pay back on their own. They have to pay back together with the first couple
   of things they unlock. For example, the plant plus Better alloy 1 plus Slag 1 should earn its keep within a few
   minutes once a smelter is working it.
4. **Truck pickups are exempt** and stay deliberately dear (`UP.truck`). More pickups make bin, tub and store size
   matter less. The truck's timing is what lets storage fill up and become a bottleneck.
5. **The early game is the reference feel.** The first robot upgrades, the first leaf prices, robot 2 at ~11 minutes
   and the hive at $120 (~26 min) all feel right. Don't move them without a reason.
6. **More than one income source should matter.** Ingots will lead late, but honey and leaves should stay worth
   upgrading (V9: honey ~22% of late income, leaves and bags ~3%).
7. **Only change what you mean to change.** A balance pass says up front whether it touches effects (what a step
   gives) or only costs. Mixing the two makes the results impossible to read.

---

## 2. Core ideas and formulas

### 2.1 Where the money comes from

| Kind | Volume (a minute) is set by | Price per unit | Price multipliers |
|---|---|---|---|
| Loose leaves | leaf fall and shaking (land, shakers), robots gathering, bin and truck | `0.13 × 1.2^Sort` | Sort leaves, market |
| Bags | packers' time (Packing), loose leaves in the bin | `10 × leaf price × bag mult` | Sort, Better bags, market |
| Cleanup bonus | all leaves sold, bagged ones included (`nL`) | `$18/42/70 per 100 leaves` | none (market does not apply) |
| Raw metal | miners (veins, drill, magnet, shafts, excavating, cutting oil) | `grade` | Grade the metal, market |
| Ingots | the same ore smelted (4 ore an ingot, plus Slag recovery), smelter time | `4 × grade × alloy` | grade, Better alloy, Slag, market |
| Honey jars | nectar (bees, flowers, hive upgrades, tank) and **packers** filling jars | `label` | labels, market |
| Gift jars | the same jars, wrapped by packers (gift wrapping) | `label × ribbon` | labels, ribbons, market |

The truck pays `Σ volume × price`. The sim records each kind separately (`window.__src`, see 3.2), which every analysis
below builds on.

### 2.2 Gain, payback and save time

For a price step that multiplies one or more kinds of income:

```
gain     = (money a minute from the kinds it multiplies) × (next value / current value − 1)
           cleanup: leaves sold a minute × (next bonus − current bonus) / 100
           slag:    ingot money × ((1 + next) / (1 + current) − 1)
payback  = cost / gain                  (minutes until it has paid for itself)
save     = cost / total income          (minutes of income it takes to afford)
```

A price step doesn't change how much gets sold, so this formula is exact for it. Steps that change *throughput* (furnace
heat, bigger bins and tanks, packing speed, robots, land) only help if they are the bottleneck. For those, measure
with a fork (3.5).

### 2.3 The identity that sets the pace

With `f = gain / total income` (the share of income a step adds):

```
save = payback × f
```

With payback capped at 5 minutes, a step worth 10% of income can only take 0.5 minutes of saving. A step worth 20%
can only take 1 minute. So **the 5-minute rule makes big multipliers quick to buy**, and you can't make a stage last
longer with steeper prices without breaking the rule. Late-game length has to come from *more steps*, *more
content* (land, buildings, sources) or *smaller steps*, not from ×3 prices. That's why V9 finishes every price step
by ~94 minutes.

### 2.4 Capped sources vs compounding ones (the ×3 trap)

- **Capped sources:** leaves (leaf fall per plot, gatherers), honey (flowers per plot, packers) and ore (3 veins). When
  a source's volume levels off, its income grows only by its own price steps, ×1.15–1.3 each. A step's gain then grows
  at that same rate, so its **cost can only grow about as fast as its multiplier**. A ×2.5–3 price ladder on a
  capped source quickly leaves the late steps with 15–250 minute paybacks. Those are dead purchases. Before V9 that was
  14 steps: bags 7–10, cleanup 3, labels 4–6, ribbons, alloy 4–5 and grade 6.
- **Compounding stacks:** ingots multiply grade × alloy × slag × market on top of ore volume (drill × magnet × shafts ×
  excavating × cutting oil). These grow together, so each step's gain grows fast and their prices *can* climb steeply
  (V9: alloy $500 → 7,000, grade $40 → 6,000). It's also where a runaway starts if steps are too cheap. Hold ingot
  steps near 4–5 minute payback, not 1–2.
- **Things that keep growth linear (good):** leaves near the bin go first (trips get longer), each source has its own
  multipliers (upgrading honey does nothing for leaves), robots have to be split between jobs, and there are caps on
  robots (10), helpers (3 + 3 since V16), veins (3) and bees (60).

### 2.5 Price a step against the stage it belongs to

A step has a *natural stage*: the stretch of the game where its source makes enough for it to pay back in ≤ 5 minutes.
Price it so it reaches ~4–5 minutes payback at that stage:

```
cost ≈ 4.5 × (money a minute from its kinds at that stage) × (next / current − 1)
```

Then check that the costs in each track still go up (monotonic). If the formula wants a later step to cost less than an
earlier one, the source has levelled off. Flatten the tail (V9 bags: 60 → 130 → 170 → 210 → 240 → 280) rather than
giving the steps more effect.

Volume often **peaks mid-game and drops later**, because the player moves robots to better jobs. Bags sold peaked at
~20 a minute around minutes 70–80 and fell to ~11 once robots moved to the orchard mines. Price those steps against
the peak stage, when they'll actually be bought, not against the plateau.

### 2.6 Who buys what, and when

- A step shows once your best-ever cash reaches 25% of its price (`seenPrice`). A cheap late step shows early, so
  players may buy it before it's worth it. That's fine; it only costs them efficiency.
- Robot levels another robot already has cost 50% (`DISCOUNT`), or 30% with Copy the blueprints. Packing is never
  discounted (`NO_DISCOUNT`).
- Every robot's job has an opportunity cost. At ~120 min (V8 prices) moving one shaft miner to packing or leaves cost
  ~$1,350–1,500 a minute, while a third packer added ~$60. So late game, robots belong on ore, and the leaf and honey
  economies get one or two robots. Price their steps for *that* volume.

---

## 3. Methods and tools

Everything runs the real game code headless, so the numbers include walking, queues, the truck and every bottleneck.
A 3-hour game takes ~35 s; run several at once.

### 3.1 Setup

```
npm i -D playwright            # once (or a global install; set PLAYWRIGHT_PATH if run.js can't find it)
npx playwright install chromium
python 3 for the report scripts (no packages needed)
```

| File | What it does |
|---|---|
| `tools/balance-player.js` | The test player (3.2). Paste it into the browser console on the game page to play a game in seconds, or drive it with the scripts below. |
| `tools/balance/make_player.py` | Wraps the player so a run records a snapshot every game minute (money and counts per kind, levels, yard) plus the full save every 10 minutes, and the purchase log with paybacks. |
| `tools/balance/run.js` | Runs any page script in headless Chromium on `public/index.html?fresh` and saves the JSON it returns. |
| `tools/balance/income.py` | Income a minute per interval, split by kind, with volumes and the yard (3.3). |
| `tools/balance/buys.py` | When each step was bought, cost vs income, save time, payback at purchase, and steps never bought (3.4). |
| `tools/balance/milestones.py` | Average minute of the big steps; compares sets of runs side by side. |
| `tools/balance/payback.py` | Payback of every remaining price step from a stretch of a run, reading prices straight from `game.js` (3.4). |
| `tools/balance/fork.py` | Counterfactuals: take a recorded save, change something, compare income with shared random seeds (3.5). |
| `tools/balance/fork-variants-example.js` | Example changes for `fork.py`. |

Dev hooks they rely on (in `game.js`): `__leafYard.sim(seconds, opts)`, `.state()`, `.robots()`, `.bees()`,
`.buy(offer)`, `.fn()` (now including `UP` and `GEN`), and `window.__src`. When a test sets `window.__src`, the truck
adds up money and counts per kind during a sim: `leaf, bag, metal, ingot, jar, gift, clean, nL, nM, nI, nJ`. It does
nothing in the real game.

### 3.2 The test player and its biases

`tools/balance-player.js` checks each second what's holding each part of the yard back: the bin full on recent pickups,
leaf robots idle (leaves scarce), packers always busy, bees out of flowers or the tank full, the tub full, smelters
starved. It lists the thing that would help in each part and buys the best one. Big new steps (land, a new building,
a new kind of income) count as worth 3×. It saves up when it can't afford something.

Price upgrades (since V9) are bought only once they **pay back within `window.PAYBACK` minutes** (default 5). It works
that out from the last 3 minutes of income per kind, with the formulas in 2.2. Hotter furnace's gain is scaled down by
how idle the smelters are. Set `PAYBACK = 999` for an impatient player who buys whatever is affordable.

Its fixed habits, which you should keep in mind when reading results:
- Robot 0 always gathers leaves. Other robots get roles in this order: packer(s) (1, or 2 once there are 14 bees and 6
  robots, one honey-first and one bags-first), miners (one per vein, two per shaft), then smelt, smelt, haul, smelt.
  With 10 robots and 3 shafts that's 1 leaf robot, 2 packers, 6 miners and 1 smelter.
- It buys land once leaves have been short for 2 minutes, the bees run out of flowers, or every vein here is mined.
- It never sets the keep-for-bagging and keep-for-smelting sliders.
- It doesn't overthink robot upgrades: cheapest leaf track for leaf robots, drill and magnet for miners, packing for
  packers and smelters.

A real player is slower in the first minutes (reading, exploring) and may be smarter about roles. Treat the player as a
**decently optimized** run: good for comparing before and after, not an exact prediction.

### 3.3 Recipe: the income curve

```
python tools/balance/make_player.py 10800 runs/p.js            # 3-hour game, payback 5
for i in 1 2 3 4 5 6; do node tools/balance/run.js runs/p.js runs/now/r$i.json & done; wait
python tools/balance/income.py "runs/now/r*.json" 10
python tools/balance/milestones.py "runs/before/r*.json" "runs/now/r*.json"
```

Use **6 runs** for anything you'll quote; 2–3 are enough to explore. Keep a `before` set from the same player with the
old prices, so the only difference is the change. (The `runs/` folder is scratch; don't commit it.)

What to look at:
- **$/min at each 10 minutes.** Compare with section 5. Early numbers (≤ 50 min) should barely move unless the early
  game was the point.
- **The shape.** A healthy curve grows fast but not explosively (about ×2.5 per 10 minutes from 60 to 90 min), then
  levels off when everything is bought. A long flat stretch *with steps still unbought* means dead purchases (use 3.4).
- **Source split.** Is one kind of income starving the others?
- **Volumes** (nL, nI, nJ). These are what price steps multiply. When they level off, the prices of that source's steps
  have to flatten.

### 3.4 Recipe: is a price ladder right?

```
python tools/balance/buys.py "runs/now/r*.json"
python tools/balance/payback.py "runs/now/r*.json" 110 170     # on the plateau
python tools/balance/payback.py "runs/now/r*.json" 60 70       # at a stage
```

- In `buys.py`, every price step should show `pb@buy` around 3–5 and none should be **never**. `save` (cost ÷ income)
  is how long a player waits for it. `pb@buy` well under 2 means the step is too cheap.
- `payback.py` on the plateau tells you, for any step still unbought, what it would cost to make it worth buying
  (cost × 4.5 / payback). It is exact for price steps. For Hotter furnace it overstates the gain unless the smelters are
  busy.

### 3.5 Recipe: throughput steps, milestones and robot roles (forks)

When a change alters how much gets made, not its price, measure it:

```
python tools/balance/fork.py runs/now/r1.json 80 my-variants.js runs/f.js 3
node tools/balance/run.js runs/f.js runs/f.json
python tools/balance/fork.py --show runs/f.json
```

`fork.py` takes the save the run had at that minute (states are kept every 10 minutes). It runs each variant for
2 minutes to settle and 6 minutes to measure, with the same random seeds per repeat, and shows income and the split
for each. Payback = cost ÷ the difference from `base`. Good uses: furnace heat, tank and store sizes, gift wrapping, a
new building, moving a robot to another job, more bees.

Noise: forks still wander by about **±3–5% of income** between variants with no real effect (bigger bins sometimes
show −2%). Don't trust a difference smaller than that. Use the formula in 2.2 for small price steps and more repeats
for anything borderline.

### 3.6 Recipe: a repricing pass

1. Run a **before** set (3.3) and keep it.
2. List the steps: `buys.py` for never-bought steps and `pb@buy`, and `payback.py` on the plateau and at the stage
   each step belongs to.
3. For each step out of the 3–5 band, set `cost ≈ 4.5 × gain at its natural stage` (2.5). Keep each track rising.
4. Rerun and recheck. Price changes move *when* things are bought, which moves the volumes, so expect 1–2 rounds.
5. Accept it when: no price step is never bought, `pb@buy` is about 3–5 everywhere, early milestones haven't moved
   (robot 2, bagging table, hive, metal), and the curve has no long flat stretch with steps still left.
6. Write it up in `PROJECT_NOTES.md` (old → new prices, before → after income table, milestones) and update section 5
   here.

### 3.7 Quick sanity checks after any change

- `node -e "new Function(require('fs').readFileSync('public/game.js','utf8'))"`: it still parses.
- A 1-hour run (`make_player.py 3600`): no `pageerror`, milestones in the usual place.
- If you change slots, indices or caps, test an **old save** with a crafted state (see the V9 migration). The refund
  should arrive once, and the new flag should be in `freshState()` so new games aren't migrated.
- Open the game (`/?fresh&speed=10`) and look at the cards that changed.

---

## 4. Pricing something new

### A new step on an existing track
1. Its gain at the stage you want it bought: `money a minute from its kinds × (new value / old value − 1)`. Take the
   money from `income.py` at that stage.
2. `cost ≈ 4.5 × gain`. It must cost more than the step before it. If it can't, the multiplier is too small for its
   stage: make it bigger or move it to a stage where the source is bigger.
3. Add it to the `max`, `costs` and `vals` arrays (`vals` has max + 1 entries), and to `MAXL` in `tools/balance/buys.py`
   if the track's length changed.

*Example:* an 11th bag step at ×6.8 (from ×6.0), at the late plateau where bags make ~$330 a minute, gains
330 × (6.8/6.0 − 1) ≈ $44 a minute, so it should cost about $200. That's less than step 10's $280, so it would need a
bigger jump (×7.5 → $82/min → ~$370) or a reason to sell more bags.

### A new building or milestone
- Decide what it unlocks and price the **package**: building + the first 1–2 upgrades should pay back within a few
  minutes of being worked. The building alone can be roughly break-even (the plant alone is only +45%: an ingot is
  4 metal × grade × 1.45).
- Check what it does to robot roles: a new job needs a robot, and its opportunity cost is what that robot earned before
  (2.6).
- Teach the test player: an offer id it recognises, a `VALUE` weight (3 for a big new step), the role it needs in
  `setTasks`, and a limiter if it can become a bottleneck.

### A new kind of income
- Add it to the truck's sale and to the `window.__src` bookkeeping (money and a count) in `updTruck`, to `PRICE_SRC`
  and `PRICE_KEYS` in the player, to `SRC` in `payback.py`, and to `income.py`.
- Work out its volume cap (what limits it late) first. That decides how steep its price ladder can be (2.4).

### A new throughput or capacity upgrade
- It is only worth anything while it's the bottleneck. Measure it with a fork at the stages where it binds, and price
  it for ~3–5 minutes payback *there*.
- Make sure the player buys it when it binds (a limiter in `balance-player.js`), or the runs won't show its value.

### Changing effects instead of costs
Re-measure everything that stacks with it. A multiplier on a compounding source (ingots) moves the whole late game.

---

## 5. Current balance (V9, Oct 11)

Measured with the payback player, 6 runs, 10 robots, 4 + 4 helpers, 3 veins.

### Income a minute

| min | $/min | leaf | bag | clean | metal | ingot | jar | gift | leaves sold | ingots | jars |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 10 | 8 | 8 | | | | | | | 31 | | |
| 20 | 39 | 6 | 28 | 4 | | | | | 64 | | |
| 30 | 80 | 14 | 43 | 17 | | | 5 | | 95 | | 2 |
| 40 | 128 | 14 | 48 | 18 | 23 | | 24 | | 102 | | 8 |
| 50 | 246 | 22 | 59 | 24 | 118 | | 23 | | 132 | | 8 |
| 60 | 720 | 57 | 176 | 114 | 166 | 124 | 83 | | 305 | 3 | 21 |
| 70 | 1,970 | 46 | 249 | 197 | 511 | 795 | 172 | | 286 | 11 | 37 |
| 80 | 2,860 | 46 | 458 | 232 | | 1,828 | 131 | 164 | 331 | 22 | 39 |
| 90 | 7,273 | 29 | 346 | 150 | | 5,741 | | 1,007 | 215 | 31 | 53 |
| 100 | 13,553 | 30 | 345 | 145 | | 10,359 | | 2,674 | 208 | 34 | 60 |
| 110+ | ~13,800 | ~30 | ~320 | ~140 | | ~10,300 | | ~3,000 | ~200 | ~33 | ~63 |

(V8 prices with the same player levelled off at ~7.3k a minute with 14 steps never bought.)

**V11 (gift wrapping as its own task), 4 runs, same player** (its packers fill *and* wrap): 80 min 3,650 (was 2,866),
90 min 10.1k (7.1k), 100 min 13.9k (13.4k), then flat at ~13.9k. Late honey is ~52 gift jars a minute ≈ $3.1k (was ~64
jars ≈ $3.0k): wrapping costs packer time, so fewer jars get made with two packers, and bags drop from ~$320 to ~$200
because the packers spend more of their time on honey. Earned by 150 min ~$1.0M (was ~$0.96M). Milestones unchanged;
the last price step is bought at ~89 min (was ~98).

### Stages (for "how long would I wait for X")

| Stage | Around | Income | What's happening |
|---|---|---|---|
| Early | 10–20 min | $8–40/min | robot upgrades, bin, Sort leaves, robot 2, bagging table |
| Cottage full | 25–45 min | $70–130/min | helpers, hive, metal slot and first miner, bags 3–4 |
| Meadow + plant | 50–60 min | $250–720/min | Meadow ~49, plant ~54, bags 5–7, cleanup 2–3, labels 1 |
| Smelting running | 65–80 min | $1.5k–2.9k/min | alloy 1–2, slag, furnace heat, grade 3–4, shafts, Old orchard ~79 |
| Late | 85–95 min | $5k–13k/min | the top grade, alloy, label and ribbon steps |
| Plateau | 95+ min | ~$13.8k/min | everything bought |

Milestones: robot 2 ~11 min, bagging table ~10, hive ~26, metal ~36, Meadow ~49, plant ~54, robot 10 ~73,
Old orchard ~79, last price step ~94.

### Price ladders (V9) and when they're bought

| Track | Costs | Bought (min) | Payback when bought |
|---|---|---|---|
| Sort leaves | 0.80 / 1.25 / 2.25 / 4 / 6.75 (0.8 × 1.7ⁿ, rounded) | 1–7 | 2–4 |
| Better bags | 11 / 19 / 28 / 38 / 60 / 130 / 170 / 210 / 240 / 280 | 13–74 | 3.2–4.9 |
| Cleanup deals | 20 / 300 / 400 | 15, 53, 59 | 1.4, 3.1, 4.7 |
| Grade the metal | 40 / 76 / 400 / 1,800 / 3,500 / 6,000 | 39–87 | 3.9–4.9 |
| Better alloy | 500 / 1,900 / 3,200 / 6,000 / 7,000 | 67–90 | 4.2–4.9 |
| Slag recovery | 450 / 1,100 / 2,800 | 68–84 | 3.9–4.7 |
| Hotter furnace | 400 / 1,000 / 1,500 | 65, 69, 94 | 3.3–4.8 (only while smelters are busy) |
| Market stall | 140 / 600 / 2,400 | 49, 63, 85 | 4.4–4.8 |
| Fancy honey labels | 90 / 300 / 650 / 1,000 / 1,800 / 2,800 | 54–92 | 4.7–4.9 |
| Gift jar ribbons (V11: 2.6× → 3.1× → 3.7× a jar) | 700 / 1,500 | 74, 82 | 4.7–4.8 |
| Gift wrapping (milestone, opens the Wrap task) | 550 | 69 | — |
| Hive upgrades | flat 180 each | ~58 | not measured; mostly packer-limited before ~60 min |
| Truck pickups (exempt) | 2 / 8 / 28 / 90 / 260 / 700 / 1,800 | — | — |

### Ceilings (what caps each source late)
- Leaves: ~200–330 sold a minute (orchard leaf fall, one leaf robot plus helpers). Bags are limited by packer time.
- Honey: ~60–65 jars a minute with 2 packers (flowers allow a bit more). Before V9's split packers it was ~45.
- Ore: 3 veins with shafts → ~33 ingots a minute fully upgraded.

### V13: the hive moved into the story
The first yard no longer offers the beehive: it comes after the trip to the Wildflower prairie (see `PROJECT_NOTES.md`,
V13). The test player plays a single page, so it never makes the trip, never gets honey in the first yard, and the numbers
above (which include honey) are now only a reference for that part. Without the hive the test player reaches metal ~30,
Meadow ~42 and the plant ~47 min. The letter about the new lot comes at $900 earned (~27 min). On the prairie, the dead
bee turns up at 320 petals (~5 min with the robot you bring) and takes 2,000 research units (one plain robot: ~8 min; up
to three robots can work on it).

### V15: the Rainy hollow's drying bench and hive research
In the hollow loose leaves don't sell: only dry ones (a sack of 10 sells as a bag: Sort leaves × Better sacks, $1.95 at
the start). A blower with Warm air dries a tray of 10 in 6 s ÷ Drying (1× → 3.5×), so one fresh blower dries ~100 a
minute if the bin keeps up; the bin's sack shelf there is 1.5 × bin ÷ 10 (at least 4). The second blower costs $18 there,
since the first came along. The hive research: 6,000 units; a blower (required) adds 2/s, robots count half their usual
4 (lead) / 1 (helper) × Research level. Blower alone 50 min, plain Tinker + blower 25, Tinker with glasses 17 (14 with
two plain helpers), three at Speed reading 7, three at Photographic memory 2 min. Not tuned against the hollow's income
yet; `FINDS.hive` (`need`, `blower`, `robotMul`) and `DRY_TIME` / `TRACKS.dry` are the knobs.

### Open questions and weak spots
- **The late game is short.** Everything is bought ~15 minutes after the Old orchard. If we want a longer late game, it
  needs content (2.3), not dearer prices.
- **Leaves matter little late** (~3% of income) because miners earn ~20× what a leaf robot does. Fixing that is an
  effect change (bag multipliers, leaf volume, or a reason to keep robots on leaves).
- **Hotter furnace** is worth something only while one smelter can't keep up with the ore. That's around 65–80 min.
- **Hive upgrades** ($180 each) showed almost no gain in forks at 30–60 min, because the single packer was the limit.
  They should be re-measured with two packers.
- **Hive tank and store, bin 8 and tub 6–8** are capacity steps the player buys only when they're full. Their value
  hasn't been measured beyond that.

### What streamlining means here (V19.1)
The problem isn't the number of steps or clicks, it's steps whose reward is too small for what they cost: a long ladder
of tiny steps that ends in very expensive ones, each nudging one stat that may not even be the bottleneck. So:
- **Keep as they are:** Wheels and Basket (the per-robot ladders feel good), Claw + Reach (satisfying to get one, then the
  other, and watch them scale together), the capacity upgrades, and the per-resource price ladders (their shape).
- **Make a step clearly worth it:** fewer, bigger steps where one stat creeps up (helper skills, Extra yield, the hollow's
  Sort the logs), and longer ladders where a source should matter later (Sort leaves 7, Better bags 13).
- **No exploding tops:** incomes level off (workers per task, longer walks, plot caps), so price ladders should climb
  roughly evenly at the end, not ×2–4 a step. V19.1 flattened the tops of the metal, alloy, slag, label and market ones.
- **Bees/ants:** one at a time, at most 40, nearly flat price after the first ten.

---

## 6. Pitfalls (learned the hard way)

- **`vals` are indexed by level, and level 0 is the starting value.** Better alloy's level 0 is already ×1.45, so the
  first step is 1.45 → 1.75 (+21%), not 1 → 1.45. Always use `UP[k].val(level)`.
- **A greedy test player hides bad prices.** If it buys whatever is affordable, payback at purchase only reflects the
  source's share of income, not the price, and dead steps get bought anyway. Use the payback player (`PAYBACK = 5`) to
  find dead steps, and `PAYBACK = 999` to see an impatient player.
- **One run is not a measurement.** Between 60 and 100 minutes runs differ by 10–25% (timing of land and shafts). The
  plateau is steady to ~3%.
- **Forks have ~±3–5% noise** even with shared seeds. Effects smaller than that need the formula in 2.2 or many repeats.
- **Throughput steps depend on the bottleneck.** The same furnace step is worth $370 a minute at one minute and $0 ten
  minutes later. Measure it where it binds.
- **Robot roles change volumes.** If the player moves robots off leaves, bag volume halves. Check `nL`, `nI` and `nJ`
  before blaming prices.
- **Save migrations:** when removing slots or changing indices (veins, robots), add a one-time flag and a refund, and
  put the flag in `freshState()`, or a new game saved and reloaded gets "migrated" too. V9's `flags.v9` /
  `OLD_SPOT_MAP` is the template.
- **The sim pays at once.** In the real game the truck waits for its payout animation, but the next pickup's countdown
  starts after loading, so no pickups are lost. The sim's numbers hold for real play, apart from human reaction time.

---

## 7. History of balance passes

- **V5–V7:** land, metal and the plant made later and dearer; the pacing test (`__leafYard.sim(..., { priority: true })`)
  put the Meadow at ~55 and the plant at ~89 min.
- **Rebalance 1:** the bottleneck order in section 1; the bottleneck-driven test player.
- **V8:** income +20% and longer price ladders for the late game (bags 10, labels 6, grade 6, alloy as a multiplier),
  priced ×2.5–3 per step. Too steep for capped sources (see V9).
- **V9:** caps (10 robots, 4 + 4 helpers, 3 veins). The payback rule, a payback-aware test player, income tracked per
  kind, and the late ladders repriced to 3–5 minute payback. The tools in `tools/balance/` and this guide.
- **V11:** wrapping gift jars became its own robot task (2.6 s at packing 1×, was 1.6 s added to every jar), a gift jar
  is worth 2.6× a plain one (ribbons 3.1×, 3.7×; was 1.6 / 2.1 / 2.9×), Gift wrapping $550 and ribbons $700 / 1,500.
  The test player's packers fill and wrap. Ribbons still pay back in ~4.8 min.
- **V12:** blowers and shakers are locked behind the old picture book (found at ~6–7 min, $20 earned; 600 research =
  2:30 for one plain robot). The test player puts robot 0 on Research, which costs ~2.5 min of the only gatherer's time:
  milestones run ~3 min later (robot 2 ~14, bagging table ~13, hive ~28, metal ~39, Meadow ~52, orchard ~82); the last
  price step is still bought at ~89 min.
- **V12.1:** robots walk round the workshop and bin and drop leaves in from behind the bin, so bin trips are shorter:
  metal ~36, Meadow ~47, plant ~52, orchard ~76, last price step ~86 (the early game is still ~2–3 min later than V11
  because of the research).
- **V13.7:** blower and shaker skill tracks have 8 levels instead of 11 (2 + 3 + 3), same range (blow 1 → 5.8×, shake
  6 → 38 leaves), and a gentler price climb: blow $8 / 15, turbine $60 / 95 / 140, jet $300 / 420 / 600; shake $7 / 13,
  pincers $50 / 80 / 120, rumble $260 / 360 / 520 (unlocks unchanged: $70 / 420, $65 / 360). The full track now costs
  about half what it did. Not re-measured with the test player yet.
- **V16:** at most 3 blowers and 3 shakers on every lot (was 4 + 4). Every helper skill is cheap to the top with a slow
  climb (blow and shake tracks ~$350 each, were ~$2,100; excavate, bellows and umbrella cut by 75–85%). Drying (the
  hollow) has a third tier, Drying tunnel, to 6.5× (11 levels, ~$540, was 7 levels to 3.5×, ~$1,400). The hollow's
  Gourmet labels are $80 → 900 (were $90 → 2,800) and D.O.P. seals $400 / 800, through the new `LOT.UP` price override.
  Not re-measured with the test player; helpers are now a small, quick buy rather than a long ladder.
- **V16.1:** cottage trees moved (red tree to the top-right corner, the big top-left tree's trunk now on your land: three
  shakeable trees, drops along the blowers' edge). First blower $7 / shaker $9 (were 9 / 12), robot 2 $8 / robot 3 $15
  (were 6 / 12), same total. The book needs $30 earned or $18 held (was $20 / $12). The built-in sim finds it at ~9 min.
  Not re-measured with the test player.
- **V17:** the Rainy hollow's charcoal kiln replaces its drying shed: 2 logs → 3 coal, coal sells at a log's price × Briquettes
  (1 → 1.8×), Tight stacking up to +40% coal, Hotter kiln to 1.8×; nine steps, ~$4,000 in all (the drying shed had the plant's
  ~20 steps to ~$7,000 each). Best case per log: 1.5 × 1.4 × 1.8 ≈ 3.8× the log's price (the smelting plant: ~5.1× a metal
  chunk). The fire research is 6,000 units like the hive (blower 1/s + shaker 1/s + robots at half). Not tuned with the
  balance player: a hollow sim with a decent start earns ~$0.9M by 90 min, most of it coal, because the wood volume is large;
  `KILN_LOGS`/`KILN_COAL`, the kiln's `LOT.UP` and the saws are the knobs.

- **V19:** a streamlining pass. One name per shared skill in every yard (Operate machinery, Extra yield, Load & pack).
  Extra yield 3 + unlock + 3 (was 3 + 4 + 4 with two unlocks): 0 → 72%, last step still $1,300, ~$3,150 in all (was
  ~$5,900). Helper skills 2 levels a tier with the in-between steps dropped (blow 6 levels, drying 6, excavate 4, bellows
  4; shaking 3 + unlock + 3); same ranges, cheaper in total. The hollow's Sort the logs 3 steps ($4.80 → 12 for
  $50 / 250 / 1,000; was 6 steps to $16.50 for up to $6,000) and a coal stand 4× the crib. Not re-measured with the
  balance player; built-in sims: the first yard about the same, the hollow ~13% less by 60 min (lower top log price).
  See "Streamlining candidates" in section 5 for what's next.
- **V19.1:** Sort leaves 7 steps (+$70, $160), Better bags 13 (to 8.7×, an even $11 → 440), the tops of Grade the metal,
  alloy, slag, labels, market stall, Gourmet labels, Briquettes and the leaf/petal press deals flattened, 40 bees at most
  with a nearly flat price after ten. Balance player (first yard, 3 runs): plateau $1.8k (V18) → $2.3k (V19) → $3.1k a
  minute, bags ~half of it; every leaf/bag step bought at 3–5 min payback; last price step ~48 min (V18 ~62).
- **V19.3:** yard-wide one-steps: Grease every axle +30% speed for $30 (was 3 steps of +20%, $20 / 110 / 520), Cutting oil
  (Chain oil) +25% for $400 (was 2 steps of +15%, $300 / 1,400); Wider claw fingers removed (claw spread is the claw
  level alone). The hollow's Spore scattering is one step, +80% patches for $1,200 (was 3 × 40% for $600 / 2,000 /
  6,000); the prairie's Wildflower seeding is unchanged. The first yard's Meadow is 1080 × 600 (was 1280 × 720) with the
  same leaf fall and cap, nine more own bushes (one on the cottage plot) and a fourth small tree, so shakers have more to
  shake. Not re-measured with the balance player; built-in sims run clean.
- **V21:** shakers each have their own 15 s cooldown per tree or bush plus a shared 5 s (was one shared 15 s), so a second
  and third shaker add leaves instead of queueing for the same trees. Yard-wide upgrades priced for a bigger crew: Grease
  every axle $240 (was $30; forks of a balance-player run: +$21/min with 4 robots at 30 min, +$112/min with 10 at 50 min,
  so ~2 min payback once the crew is big), Shared basket plans $150 (was $35; saves 40% of every copied basket level, so it
  pays once several robots go past the hamper), Copy the blueprints $500 (was $150). The old book needs $60 earned or $36
  held (was $30 / $18). Smelting plant and charcoal kiln: two robot spots (was three). Balance player (3 runs, first yard,
  70 min): Meadow ~42 → 39 min, metal ~35 → 31, robot 10 ~51 → 48, income at 70 min ~$2.9k → $3.1k a minute. The greedy
  built-in sim reacts much more to the shaker change (~+70% earned by 45 min).
- **V21.1:** the first unlock on each basic skill costs twice what it did: Rubber treads $6, Wicker hamper $7, Quick servos $8
  (were $3 / 3.50 / 4); levels and later tiers unchanged, helpers unchanged. Balance player (3 runs): those unlocks are
  bought at ~7 / 13 / 15 min (were ~5 / 6 / 8), the bagging table earlier (~7 min), Meadow ~42, metal ~36, robot 10 ~51.

## 8. Pending balance work

The October 14 audit and the next implementation targets are recorded in
[`BALANCE_IMPLEMENTATION_NOTES.md`](BALANCE_IMPLEMENTATION_NOTES.md). The selected changes, purposes, migration
requirements and acceptance checks are in [`BALANCE_CHANGE_BRIEF.md`](BALANCE_CHANGE_BRIEF.md). Preserve the strong early shaker. Investigate
storage tails against production peaks, kiln/furnace operator synergy, stronger nectar-to-goods conversion, $120
hive upgrades, a more useful nursery, later leaf-value steps, and late truck/multiplier payback. These are pending
targets; live economy values have not been changed. The guide's V9 income tables remain historical references,
not measurements of the current three-yard campaign.
