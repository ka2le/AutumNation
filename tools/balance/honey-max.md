# Honey maxing and final price choices — October 21, 2026

**Retain $180 general hive/ant-hill upgrades.** A properly developed honey engine is competitive at that
price. The previous partial-development buyer understated honey's value. Minimal early investment followed
by a committed, multiplying honey engine is a valid different path from steady leaf development.

The latest requested prices are **home cleanup $400 / $1,000 / $2,000** and **final Sort leaves $6,000 in both
yards**. Hollow cleanup remains $150 / $700 / $1,500. The subsequent [alloy-step revision](alloy-steps.md)
supersedes this report's ingot recommendation. The earlier $140 hive and $200 / $350 / $530 cleanup trials
are historical, not the final selection.

## What the stronger test does

Start from the previous main player's actual earned repair unlock, in home, hollow, or both yards. Buy 40
bees/ants, all five productive general upgrades, maximum honey/mushroom labels and gift/seal upgrades, and
train **two honey packers to level 7**. The full variant additionally requires maximum tank and store; the
production/value variant buys storage as part of its strategy but does not require the final buffer tiers.
Nursery is omitted where the checkpoint population makes its remaining purchase discount unprofitable.

Spare workers keep producing leaves or ore/logs. The selected route uses raw-material support and one flower
tender. After reaching the target it adds industry while retaining its two trained honey packers. This is a
paid investment strategy with productive spare labor, not free max upgrades or an artificial honey-only crew.
Packing skills travel home with Tinker, so some later gains are shared-worker development, not honey cash alone.

Six candidates per yard were screened on seed 1, with the best full-storage and production/value candidate
per yard checked on seeds 2–3. Configurations were frozen before seeds 901–903 and normal-gameplay seed 1001.
The price comparison changes only $140 versus $180 general upgrades, keeping cleanup and alloy identical.

## Paired results before the final cleanup/Sort leaves revision

| Paid route | $180 hive upgrades | $140 trial |
|---|---:|---:|
| Previous main player, limited home honey | 136.22 min | 136.22 min |
| Max home hive including buffers | 134.73 min | 133.89 min |
| Max home production/value, flexible buffers | 133.20 min | 133.32 min |
| Max hollow engine including buffers | 136.13 min | 135.97 min |
| Max hollow production/value, flexible buffers | 134.19 min | 134.01 min |
| Max both yards including buffers | 136.15 min | 135.21 min |
| **Max both production/value engines** | **133.25 min** | **132.91 min** |

The selected two-yard route beats the previous main player on **all three seeds at $180**, about **2.2%**
faster on average. Reducing the price saves only **0.35 minutes** on average for this route. The normal-gameplay
check at the retained $180 price confirms the direction: **133.95 versus 139.49 minutes**. These are small
samples and a finite policy search, not proof of a unique optimum; home-only honey maxing was faster than
two-yard maxing in the one normal-gameplay seed tested at $140.

A separate control uses the same two-packer staffing, permits further honey investment, and hands purchase
decisions immediately back to the ordinary buyer. It averages 147.66 minutes on the simulation seeds and
145.55 in the normal-gameplay seed. Merely assigning more packers does not reproduce the committed strategy's
benefit. This control is not claimed to be the optimal mixed strategy.

For the selected $180 route, honey provides roughly 30% of home income from repair unlock through completion;
industrial sales still supply most of the rest. The ant engine provides roughly 77% of hollow income during
that route's late phase. These are **paid route income shares**, not whole-game shares or maximum-output
fixtures. The hollow specialization is strong in that phase, but the overall completion gain is modest and
leaves, raw materials and processing remain part of the route. The evidence supports retaining $180 rather
than treating weak partial investment as a reason to discount the entire engine.

`npm run balance` now uses the two-yard production/value route. The previous main remains `smart-skip`, and
`npm run balance:check` includes it alongside the earlier balanced and legacy buyers. Initial home honey is
still kept minimal; this changes the later investment decision at repair unlocks. It does not prescribe buying
every honey upgrade immediately after the first honey milestone.

## Earlier ingot recommendation (superseded by the alloy-step revision)

The recommendation before the request for more, smaller steps used these values:

| Late alloy purchase | New multiplier | Gain over previous level | Price | Marginal payback at developed output |
|---|---:|---:|---:|---:|
| Second | 2.07× | +18.3% | $6,000 | 0.81 min |
| Third | 2.43× | +17.4% | $14,000 | 1.68 min |
| Fourth | 2.83× | +16.5% | $23,000 | 2.48 min |
| Fifth | 3.23× | +14.1% | $36,000 | 3.88 min |

The base remains 1.45× and the first $360 upgrade gives 1.75×. Maximum alloy value is 10.3% below the old
3.60×, without slowing physical smelting. Paybacks use the prior three-seed fully developed physical ingot
rate and maximum metal grade: these are optimistic mature-engine returns, not early purchase guarantees.

The final metal grade still has about a one-minute mature-output payback. It multiplies ingot value as well
as raw-metal sales; further concerns about excessive industrial value should distinguish that interaction
from alloy alone. The fast route often finishes without buying the final alloy tiers, so their maximum-output
strength is not the same as a dominant completion shortcut. The subsequent [alloy-step test](alloy-steps.md)
implements the longer ladder and higher later metal-grade prices requested after this comparison.

The chosen home cleanup ladder has approximately 5.84 / 10.94 / 18.76-minute marginal paybacks at the prior
developed mixed leaf rate; it intentionally replaces the earlier five-minute final-tier target. Reducing the
last Sort leaves price to $6,000 reduces its marginal payback by 20%, including for bags and hollow dry leaves.

## Validation and evidence

[Versioned evidence](honey-max-2026-10-21.json) contains 100 audited paid campaigns including training,
comparisons, controls, nine replay runs and verification of the promoted default and final requested leaf
prices. No new capacity grants are used. The simulator checks legal charged offers, cash conservation,
travel saves, ending completion and actual attainment of the advertised honey/packer targets. The final
prices also pass 159 economy/save/arrival invariants and the terminal-boundary regression check.

The first training pilot exposed a tester bug: custom staffing did not assign the travelling Blower to board.
It was fixed, the full training was repeated, and the pilot was excluded. An exploratory staffing control
that still prohibited home honey purchases was also excluded in favor of the open-investment control.
The published comparisons preserve both game and tester hashes; subsequent optional control flags do not
change the maxing strategy's exact traces. Promotion reproduces the independently tested routes exactly.

Use `honey-max.cjs` and [the runner instructions](README.md) for future comparisons;
`selected-honey-max.json` preserves the full and production/value challengers. Rebuild the report with
`node tools/balance/honey-max-report.cjs` after its explicitly named suites complete. Historical reports use
their frozen sources, so later prices cannot silently rewrite their evidence.
