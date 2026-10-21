# Cleanup, alloy and hive tuning — October 21, 2026

**Follow-up:** The $140 hive/ant-hill trial below was reverted to **$180** after a stronger honey-maxing strategy
proved competitive at the original price. Home cleanup was subsequently set to $400 / $1,000 / $2,000 and final
Sort leaves to $6,000 in both yards. Alloy was subsequently spread over [more, smaller steps](alloy-steps.md).
See [the newer honey test](honey-max.md),
which also supersedes the partial-development buyer's conclusions about honey. This report preserves the trial.

Implemented a modest economy adjustment following the [source audit](source-balance.md).
The [numerical evidence](economy-tuning-2026-10-21.json) records configurations, game hashes, all candidate
summaries and held-out comparisons. This supersedes the earlier audit's prices, not its historical results.

## Selected changes

| Upgrade | Previous | Selected |
|---|---|---|
| Home cleanup contracts | $400 / $2,200 / $4,000 | **$200 / $350 / $530** |
| Better alloy values, including base | 1.45 / 1.75 / 2.15 / 2.60 / 3.10 / 3.60 | **1.45 / 1.75 / 2.07 / 2.43 / 2.83 / 3.23** |
| Each general beehive / ant-hill upgrade | $180 | **$140** |

Cleanup's incremental paybacks at the previous three-seed developed mixed crew's observed leaf rate are
**2.92 / 3.83 / 4.97 minutes**, previously 5.84 / 24.07 / 37.51. The first tier also comes down to keep an
ascending price ladder. These are marginal returns at established throughput, not promised early-game paybacks.
The bonus amounts stay $18 / $42 / $70 per 100 leaves, including leaves in bags. Hollow cleanup is unchanged.

The final four **Better alloy** increments are each 20% smaller, reducing maximum ingot sale value by 10.28%.
All alloy prices stay $360 / $6,000 / $14,000 / $23,000 / $36,000. Metal grading, furnace speed, yields,
required ingot count and hollow briquettes are unchanged. This interpretation was stated before testing.

All six general hive/ant upgrades cost $140 each, a 22.2% reduction. Population prices and upgrade effects
stay unchanged, so the maximum honey/mushroom output is not increased. A full six-upgrade set saves $240.

## Selection and validation

Screened each lever independently on seed 1 with both the main honey-skipping player and the same player
allowed to keep developing honey. Both retain productive excavation, so the comparison isolates the honey
restriction. Hive prices $120 / $140 / $160 also received development runs on training seeds 2–3 and paired
honey-priority checkpoint runs on seed 1 in both yards. A two-packer opening candidate was checked on seed 1
against baseline and the $140/$160 combined variants; it did not improve the baseline route.

$140 was selected before held-out tests: its training honey-focused home run improved remaining completion
from 39.19 to 38.51 minutes, and its hollow run from 65.50 to 64.52. $120 improved output but worsened the
home finish; $160 was competitive, especially in the hollow. The training evidence does not establish a
unique optimal price. Cheaper offers can alter the heuristic buyer's sequence; that does not make a cheaper
upgrade intrinsically worse.

| Full paid campaign | Previous | Selected |
|---|---:|---:|
| Main completion player, seeds 701–703 mean | 128.78 min | **128.50 min** |
| Continued home honey development, same seeds | 137.00 min | **135.48 min** |
| Main completion player, normal-gameplay seed 801 | 142.34 min | **140.85 min** |
| Continued honey development, normal-gameplay seed 801 | 147.67 min | **147.96 min** |

All finish. The honey-skipping advantage narrows from 8.22 to 6.98 minutes in the three simulation pairs,
but grows from 5.32 to 7.11 minutes in the normal-gameplay pair. **Continued honey development remains an
unresolved weakness**, not a solved balance target. The main benchmark keeps the stronger shortcut.

At the earned repair checkpoints, held-out seed 701 tests four priorities per yard: mixed, honey, industry
and no further honey. Each priority runs for 20 minutes, then the common reference finishes. Home honey-focused
income rises from $228.57 to $258.32/min (+13.0%); remaining completion improves 41.44 → 40.69 minutes.
Home mixed improves 51.04 → 48.60 minutes and industry 48.74 → 48.13. Hollow honey-focused income rises
slightly, $1,516.16 → $1,536.38/min (+1.3%), but its full remaining route slows 67.64 → 69.22 minutes.
Its local hollow phase is slightly quicker; the later home return explains the overall regression.
Hollow mixed and industry remaining routes improve. These are single-seed directional checks, not confidence
intervals or proof that one development priority always wins. Checkpoints match across arms and variants.

## Separate maximum-output check

Six fixtures per version use granted capital, fully upgraded production and a fixed ten-worker crew, with
five minutes settling and ten minutes measurement. They are not affordable development trajectories.

| Portfolio, seed 1 | Previous income/min | Selected income/min |
|---|---:|---:|
| Home optimized mixed | $91,441 | **$82,841** |
| Home industry | $88,010 | **$79,261** |
| Home honey + leaves | $14,837 | **$14,837** |
| Hollow optimized mixed | $41,285 | **$41,285** |
| Hollow industry | $47,488 | **$47,488** |
| Hollow mushrooms + leaves | $16,837 | **$16,837** |

The home mixed fixture's ingot share falls only from 91.51% to 90.63%. This is a mild cash reduction, not
equalization of sources. No honey output takeover appears. The one-seed hollow industry result is above its
mixed fixture; the earlier multi-seed audit remains relevant to variation, so this check does not establish
a universal staffing ranking. Physical sale quantities match between versions in every capacity pair.

## Checks and reproduction

66 full paid campaigns, including training, controls, held-out comparisons, replay runs and the actual default
command smoke check; 12 separate capacity fixtures. Paid runs pass actual-offer charging, cash conservation,
travel-save, goal and completion audits. Four exact seeded replays pass. The delivered `public/game.js` matches
the frozen selected candidate apart from explanatory comments/whitespace, and `npm run balance` on seed 701
reproduces its full purchase/state trace exactly. The 158 economy invariants, ending replay, goal dismissal
and harness terminal-boundary checks pass.

`tune-economy.cjs --prepare` freezes the pre-change game supplied with `GAME_ROOT`, then generates the named
variants. It intentionally rejects a later source or an existing baseline. The pre-change active game is Git
commit `4e10390`; archived location copies are not the campaign under test. `RESULT_DIR` defaults to
`runs/economy-tuning`. `VARIANTS`, `POLICIES` (`skip`, `develop`, `develop-two`), `SEEDS`, `LABEL`, `FIDELITY` and
`REPLAY=1` select the paired runs. Source fixtures use the existing `sources.cjs` commands and a variant's
frozen game directory as `GAME_ROOT`. `economy-tuning-report.cjs` regenerates the evidence from the explicitly
named completed suites. Normal future tests continue to use `npm run balance` and the standing balance rules.
