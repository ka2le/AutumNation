# Source balance assessment — October 21, 2026

**The current economy has useful diversification, but it does not yet meet the goal that a fast player should
keep developing every source.** The clearest counterexample is the home hive: retaining its starter production
and stopping new honey investment after the first milestone beats the earlier smart completion route. Leaves
remain useful funding and a productive side business, but ingots dominate the fully developed home economy.
The hollow has a more even division between dry leaves, mushrooms, logs and coal.

No production code, prices, yields or goals were changed. `npm run balance` now runs the main completion tester.
It retains the starter home hive after its first honey milestone and hires/trains spare Blowers for shaft
excavation once the home furnace is operating. `POLICIES=smart-balanced` retains the previous smart reference;
`POLICIES=legacy` retains the old buyer. These faster strategies are challenges for the economy to withstand,
not a declaration that skipping a source is desirable design.

## What was measured

- **49 training campaigns:** three priority weights per source on seed 1, then two finalists on seeds 2–3.
  Selected settings were frozen before the source comparison on seeds 401–403.
- **48 paid comparison campaigns:** eight spending priorities, three paired seeds, separately starting at the
  actual home furnace-repair unlock and hollow kiln-repair unlock. Every arm replays the earned prefix; saved
  state, actors and RNG must match at the checkpoint. No money, research or goals are injected.
- **60 fully developed fixtures:** ten primary-role layouts × two yards × three seeds. Explicitly granted
  capital buys the actual capped upgrades, on the land owned at the earned checkpoint. Five minutes settle
  inventories; the following ten minutes measure sales. These establish output ceilings, not affordable
  progression. Unused workers perform productive fallback tasks.
- **Full-route source-investment removals:** stop new home honey or leaf investment after the first honey goal.
  The honey result was confirmed on three further simulation seeds and three normal-gameplay-path seeds.
  Six additional paired comparisons evaluate excavation, with exact replay and paid-accounting checks.

All runs use the same V46 production source. Browser rendering, UI timers and the ending cinematic are excluded.
There is no proof of global optimality. In particular, the paid source priorities are a defined **20-minute
investment period**, then a return to the common completion policy; leaf/honey/raw priorities defer plant
investment in that period. This tests the cost of a substantial development detour, not the optimal moment to
switch back. In the hollow, a completion-directed player can meet the coal goal much sooner than 20 minutes.

## Paid development at the home repair unlock

These are minutes **from the earned repair unlock to the actual ending**, not whole-game times. All variants
start with exactly the same assets and money for a given seed. They keep other existing sources working.

| Spending priority for the next 20 minutes | Minutes to finish | Difference from smart reference |
|---|---:|---:|
| Earlier smart reference | 47.45 | — |
| Roughly even investment priority | 49.39 | +1.94 |
| Leaves first | 44.52 | −2.93 |
| Honey first | 41.20 | −6.25 |
| Raw ore first | 42.25 | −5.20 |
| Industry first | 48.01 | +0.56 |
| No new honey investment during this period | 51.08 | +3.63 |
| No new leaf investment during this period | 52.56 | +5.11 |

This does **not** support “build the furnace immediately and ignore everything else.” Established income and
the development sequence matter. Honey/ore priorities beat an even spending priority by about 15–17% of the
remaining time. Leaf priority is also competitive. Equal priority is not the same as a well-managed mixed yard.
The earlier reference already chooses purchases by bottlenecks and goals rather than equal spending.

The apparently contradictory honey rows matter: stopping investment after the **first home milestone**, and
stopping it only at the **later repair unlock** under a different buyer, are different strategies. Keeping the
starter hive preserves capital and changes staffing/development before returning home. A honey-first investment
period can also outperform the earlier reference. Neither result proves all honey purchases are bad.

## Can honey be skipped after its first milestone?

Yes, further development can be skipped successfully in the tested completion routes. Existing bees and jars
continue working; the hollow's ant/mushroom chain is not disabled. Shared packing skills can still improve the
starter hive. The test is therefore “leave home honey at the first milestone,” not “delete all honey output.”

| Whole-campaign comparison | Smart reference | Stop new home honey investment | Saving |
|---|---:|---:|---:|
| Initial three paired seeds | 140.40 min | 132.00 min | 8.40 min |
| Three further simulation seeds | 141.24 min | 138.44 min | 2.80 min |
| Three normal-gameplay-path seeds | 137.86 min | 131.51 min | 6.35 min |

The shortcut wins **9/9 paired runs**, although one confirmation win is only 0.18 minutes. On the initial three
seeds it also beats the trained honey-first detour, by about 2.2 minutes on average. This is evidence of a
completion-balance weakness, not proof that a globally optimal player never develops honey.

Freezing new leaf investment after the same milestone changes the initial three-seed mean from 140.40 to
142.00 minutes: a small penalty, with one faster run. Existing leaf assets and shared skills remain productive.
That is also a warning about the value of continued development, rather than evidence that leaf production
can be deleted entirely without consequence.

The final main tester additionally staffs excavation: it averages **137.78 minutes** versus 141.24 for the
earlier smart reference on the three confirmation seeds, and **131.05** versus 137.86 on the three normal-path
seeds. Excavation improves every matched run versus the honey-stop policy alone, by 0.66 and 0.46 minutes on
average respectively. Its fully upgraded effect is much larger than its effect on the finite paid campaign.

## Fully upgraded output: compare whole crews, not one product's price

Mean dollars per game minute, with ten upgraded Robots and all available production upgrades on the existing
land. Capital is granted here. These are **ceiling portfolios**, not budgets a new repair-unlock player owns.
“Honey” in the hollow is its mushroom/can equivalent. Primary roles have useful fallback work.

| Workforce emphasis | Home total/min | Hollow total/min |
|---|---:|---:|
| Leaves and bags/drying | $11,771 | $11,952 |
| Two honey packers; remaining crew on leaves/bags | $14,719 | $16,612 |
| Four miners; two honey packers; remaining crew on leaves/bags | $27,241 | $25,582 |
| Industry; spare work on leaves; no dedicated honey packer | $87,495 | $37,099 |
| Industry plus two honey packers | $90,384 | $40,426 |
| Mixed: four miners, two operators, hauler, leaf worker, bagger, honey packer | **$91,029** | **$41,705** |

Honey is not valueless at the ceiling: two upgraded packers produce around **$4,600–4,800/min at home**, or
**$5,700–5,800/min in the hollow**, while the remaining crew works elsewhere. Adding those packers to a leaf
yard raises total revenue by about 25% at home and 39% in the hollow. Putting all ten workers into the leaf
chain wastes some labor once collection, supply and packing saturate.

The mixed layout's revenue is:

| Yard | Leaves, bags/dry leaves and cleanup | Honey/cans | Raw ore/logs | Ingots/coal |
|---|---:|---:|---:|---:|
| Home | $4,595/min | $2,954/min | $0/min | **$83,480/min** |
| Hollow | $11,537/min | $2,922/min | $2,526/min | **$24,720/min** |

The home raw sales of zero mean the ore is being processed; mining is still essential. Raw ore is an input to
ingots, not an independent competing resource that should keep selling equally after the plant opens.

At home, the mixed crew beats the industry-heavy crew by about **4%**, and is within **1%** of industry plus
two honey packers. However, ingots still supply **91.7%** of its income; leaves and honey have become small
supplements. In the hollow, the mixed crew beats the industry-heavy crew by about **12%**, and leaves still
supply **27.7%** of its income. That is much closer to the desired balance.

A weaker “balanced” staffing layout with three miners instead of four produced only about $61,000/min at
home. Treating that as the mixed strategy would have falsely exaggerated the benefit of concentrating on
industry. Staffing and transport constraints must be optimized before comparing sources.

Supporting fixtures also show why the previous helper strategy understated industry. On the training seed,
removing shaft excavation from the four-miner mixed home layout reduces income from about $91,441 to $70,213/min.
The hollow's tradeoff is smaller because spare Blowers can dry leaves. Extra flower tending was not uniformly
better: on the sampled seed, removing the dedicated snipper improved the honey/leaf portfolio. Assign helpers
against actual bottlenecks, not just the presence of an unlocked skill.

## Prices and upgrades worth revisiting

The following is the **last price tier's** cost divided by its exact revenue increase at the observed fully
developed mixed layout's physical sales rate. Other price tiers are already maxed. This isolates the relative
strength of prices; it does not include the cost or time of building the upstream production system.

| Final price upgrade | Home cost | Home marginal payback | Hollow cost | Hollow marginal payback |
|---|---:|---:|---:|---:|
| Sort leaves | $7,500 | 6.71 min | $7,500 | 2.61 min |
| Better bags / dry-leaf value | $1,053 | 1.12 min | $1,053 | 0.44 min |
| Honey/can labels | $2,000 | 3.39 min | $650 | 1.11 min |
| Gift ribbons / seals | $1,500 | 3.13 min | $800 | 1.69 min |
| Metal / wood grade | $13,000 | **0.89 min** | $1,100 | **0.16 min** |
| Alloy / briquettes | $36,000 | 3.10 min | $1,140 | **0.28 min** |
| Cleanup contract | $4,000 | **37.51 min** | $1,500 | **8.10 min** |

- **Late home cleanup is the clearest weak purchase in this state.** It is paid per physical leaf, while bag
  upgrades multiply the much larger bag revenue. The final contract can be reasonable over a very long idle
  session, but its measured return is far outside the remaining ending window. Do not raise every leaf price
  together: better bags already have a strong return.
- **Metal/wood grades are strong because they also multiply refined output.** At maximum home skills, four
  ore become about two ingots after recovery/yield; alloy then multiplies their cash value again. The final
  home metal grade can repay in under a minute at that throughput. This interaction is a more useful tuning
  target than simply making the repair expensive or slowing every furnace operation.
- **The home honey development package needs attention more than its ultimate output.** In the initial paired
  reference runs, roughly $2,600–2,700 of bee, hive, buffer and label spending occurred before plant repair.
  The hive's full label ladder costs $5,290, plus $2,200 of ribbons and $550 for wrapping. Those investments
  compete with a $1,200 repair and the crew/skills required for the ending. The full-route skip result shows
  that enough of this development is avoidable; it does not identify a single universally wrong hive price.
- **Large storage and helper bonuses are conditional investments.** An unused buffer or an idle extra worker
  provides no throughput gain. A nursery bought after all 40 bees/ants are owned has no remaining purchase
  discount to recover its price. Conversely, active excavation and machinery/packing skills can be powerful
  across the whole industrial chain. Test these at the actual bottleneck before labeling them cheap or dear.

The complete home metal-grade ladder costs $25,500 and alloy costs $79,360. That large development cost is why
the $83k/min ingot ceiling cannot be used as a claim that a player at the repair unlock earns that immediately.
Likewise, a price upgrade with a short theoretical payback can still be pointless if the physical ending goal
will finish first. At the measured maximum, 1,000 home ingots take only roughly 3.7 minutes of steady output.

## The hollow's late goals change the answer

From the earned kiln unlock, the reference meets the 100-coal goal in **9.39 minutes**. Industry-priority takes
10.03; roughly even investment takes 17.58. The 20-minute leaf, mushroom and raw-log detours reach it in about
21.3–21.8 minutes. They earn more during development but finish the whole campaign about 9 minutes later on
average. Some of their newly bought assets stay in the hollow when the player leaves.

That is chiefly an objective/horizon issue. The fully developed hollow portfolio supports several useful
sources, but the current route does not need to develop all of them before leaving. Do not infer that an
upgrade is useful for completing the game merely because its mature hourly revenue is attractive.

## Tuning direction supported by these results

1. Keep both the fast completion benchmark and explicit “stop developing this source” challengers. A tester
   forced to keep buying honey would hide the most relevant failure found here.
2. Test a cheaper or more productive **transition into developed honey**, while preserving its two-worker
   side-business role. Separate population, conversion, storage, wrapping and labels in the next price pass.
3. Reduce the late home **cash advantage** from compounding metal grade and alloy, or give continued leaf/honey
   development a competitive marginal return. Preserve physical ending throughput until completion timing has
   been rechecked; a blanket furnace slowdown would conflate cash balance with the mandatory ingot goal.
4. Reprice or strengthen late cleanup independently. Its payback is much weaker than bags at this stage.
5. Evaluate whole-campaign time and mixed-crew opportunity cost after each candidate change. Do not enforce
   equal dollars from every source: the hollow already demonstrates useful unequal contributions.

The economic changes above are proposals, not implemented changes. The next balance pass should be judged by
whether continued honey/leaf development competes with the now-default speed route, rather than by restoring
the completion times predicted by the older test players.

## Reproducibility and tester corrections

[Commands and environment options](README.md) explain all suites. The committed
[numerical evidence](source-benchmark-2026-10-21.json) contains source hashes, configurations, individual results,
checkpoint hashes, source rates, price calculations and paired campaign results. Raw runs and frozen game
snapshots are under the corresponding `runs/source-*` directories and are intentionally Git-ignored.
`node tools/balance/source-report.cjs` reconstructs the evidence from the named completed suites.

Two pilot issues were caught before accepting final results. Explicit specialist assignments initially
alternated with the archived manager's assignments each second, interrupting work; an assignment hook fixes
that, and those pilot outcomes were excluded. A decision exactly after a travel save could also buy an item
that vanished on reload (seed 2 exposed a $40 apparent refund); the driver now stops before that decision.
The final 49-run source search and 48-run paid comparison use the corrected terminal-step guard. The main
policy passes legal-offer/charge checks, per-stage cash conservation, travel-skill retention, goal completion
and exact seeded replay. Its promoted honey-stop behavior was also replayed against the independent ablation.
