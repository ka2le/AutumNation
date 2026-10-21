# Completion-oriented balance audit — 21 October 2026

The improved tester finishes **9.3% sooner** than the previous balanced campaign buyer on six unseen seeds:
**142.5 versus 157.0 simulated minutes**, winning all six comparisons. Its advantage ranges from 5.3 to 27.9
minutes. Three additional paired runs through the normal gameplay branches finish in **139.1 versus 156.9
minutes**, an 11.3% improvement, again winning every comparison.

This establishes a stronger tested strategy, not a global optimum or a forecast of typical human play.
No game prices, effects, goal quantities, or production code were changed.

## What changes the interpretation of balance

| Stage, mean minutes | Previous balanced buyer | Selected tester | Difference |
|---|---:|---:|---:|
| First yard → hollow | 69.8 | 52.0 | −17.8 |
| Rainy hollow → return | 54.2 | 42.6 | −11.6 |
| Return → ending begins | 33.0 | 47.9 | +14.9 |
| **Entire campaign** | **157.0** | **142.5** | **−14.5** |

The two other archived buyers are slower on those same six seeds: **170.8 minutes** for goal-first and **164.1**
for factory-focused. The archived bank-letter wrapper was also checked on the pilot seed; its saving condition
never helped that opening, and it matched the factory-focused route.

The faster route leaves the first yard with less development. When it returns, plant construction takes
**29.4 minutes**, versus **14.3** for the old balanced route. Once the plant is built, reaching 1,000 sold ingots
takes almost the same time: **17.8 versus 18.0 minutes**. The additional ending time is largely the funded
development path before repair, rather than a newly demonstrated problem with the ingot quantity.

The old buyer spends an average **$95,750 on price upgrades in the final five minutes before the ingot goal**.
The selected tester spends **$20,995**. Cash earned or upgrades exhausted would therefore reward substantial
spending that is poorly aligned with finishing. This does not prove every avoided upgrade is unhelpful; the
whole-campaign comparison is the objective, and the price-payback estimates remain approximate.

The last furnace/storage/bellows purchase precedes the unit goal by **2.4 minutes** with the selected route,
versus **1.7** with the old buyer. This measure includes heat, recovery, hopper, pallet and bellows purchases;
it excludes personal skills and price upgrades. These runs do not support cutting the final goal again simply
to remove a long period after all physical plant purchases.

In the selected route's final five-minute samples, ingots supply about **79.6% of revenue**, honey gifts **18.6%**,
and leaves/bags **1.8%**. Honey remains useful. Leaves are small at the finish under this allocation, but these
runs do not establish that leaf investment is weak at earlier stages or in a different allocation.

## Buyer problems found

- **Wrong objective.** The old candidate ranking largely uses weighted purchase cost. Its five-minute price
  payback threshold remains in force near completion. Cheap purchases and total revenue are not completion time.
- **The first letter has two routes:** earn $900 or hold $200 after the book. Constant reinvestment can delay
  the cheaper held-cash route. The new policy can deliberately bank money after establishing income. The letter
  is read at minute **29.1 versus 35.3** on the unseen simulation seeds.
- **Required investments can lose to optional purchases.** Land and a mine are departure prerequisites, yet
  repeated small upgrades can postpone them. The new buyer considers those prerequisites explicitly.
- **Readiness is broader than its wording.** `tinkerWorth()` counts every personal skill at full listed value,
  including packing, machinery and resource efficiency. The old readiness buyer only trains gathering skills.
  The new one considers actual legal offers across personal tracks, including copied-level discounts. One
  validation run finished readiness with resource efficiency and cheap packing levels. Decide whether that
  matches “ready for even more leaf-picking” before changing the readiness price.
- **Staffing ignored existing skills.** The optional new assignment solver matches current workers to productive
  roles, with a threshold to avoid gratuitous reshuffling. It optimizes estimated skill multipliers for the
  existing role counts, not the complete production network. Its modest training benefit should not be
  interpreted as proof of optimal staffing.
- **The old public tester is a single-yard tool.** It does not establish campaign completion. The newer local
  experiment runners used frozen historical sources; some of their metrics still referred to the 2,000-ingot
  goal. The default buyer also missed the current required deadheading assignment. Both new and archived buyers
  receive the same real Shaker assignment in this comparison; no research progress is granted.

## What to do with balance now

1. Use full-campaign completion and stage times together. A faster departure can create a slower return; neither
   stage on its own is a sufficient balancing target.
2. Treat the earlier slow-opening forecasts as policy-dependent. The current economy supports substantially
   earlier progression than the old balanced buyer demonstrated.
3. Investigate the return-yard funding/repair path next, especially the competition between optional purchases,
   crew development and saving for the plant. Avoid changing the ingot goal on the assumption that the entire
   return phase is passive unit grinding.
4. Resolve whether all-skill readiness is intentional. The tester follows the rule the game actually implements.
5. Keep checking honey, leaves and industry at their relevant stages. End-of-game revenue shares cannot justify
   a blanket buff or nerf to an entire source.

## Method and checks

The first search evaluated 24 parameter candidates and tested five finalists on two additional training seeds
(34 campaigns). A second search tested 17 stage-policy combinations, including skill-based staffing, and five
finalists on two additional seeds (27 campaigns). Selection uses **total campaign time**, penalizing incomplete
runs instead of dropping them. One first-search candidate stalled on readiness; the missing unlock fallback was
fixed before the second search. The selected parameters were frozen before unseen seeds 101–106 and normal-path
seeds 201–203. A stale mine reservation during worker reassignment was subsequently corrected without retuning
the parameters; the final benchmark reruns the corrected buyer.

Every run starts from a fresh isolated browser context, uses actual game steps at 20 Hz, makes at most one
purchase decision per second, reads delivered letters, boards the truck and carries real saved skills between
yards. Purchases must match a currently available offer and the exact cash charge. The hollow begins with $0;
the first yard's money waits unchanged during the visit. Completion is the actual `beginEnding()` trigger after
the sold-ingot goal, letter and boarding. The final cinematic is excluded.

The simulation uses the game's existing `simMode` shortcuts. Normal-path checks turn `simMode` off, exercising
leaf flight, the failed bee flight, research presentations, payout and goal animation logic while manually
stepping the game. Drawing, UI/sound timers and human interaction delays are omitted in both modes. These checks
are not rendered end-to-end playthroughs, and the two modes consume randomness differently. Seeded comparisons
share starting seeds, not identical future random events after their decisions diverge.

All final campaigns passed goal, paid-purchase, cash-conservation, zero-cash hollow, skill-transfer and frozen-yard
checks. Maximum cash-accounting error was below $0.000001. Replaying an unseen seed in each mode produced exactly
the same event, purchase and final-state trace. Existing goal-dismissal, ending-replay and 156 economy checks also
passed.

## Evidence and reproduction

- [Commands and tool design](README.md)
- [Selected policy parameters](selected-policy.json)
- [Committed numerical evidence, source hashes and individual seed results](benchmark-2026-10-21.json)
- Detailed local traces and frozen inputs: `runs/smart-search-v1/`, `runs/smart-search-v2/`,
  `runs/smart-validation-final/`, `runs/smart-validation-live/` and `runs/smart-validation/` (additional old buyers).

The committed evidence is a benchmark of the current V46 workspace. Historical V9/V34 balance tables and their
completion forecasts describe different sources and should not be mixed with these numbers.
