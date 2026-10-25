# Fewer upgrade steps — tested proposal, October 25, 2026

**Integration update:** The approved proposal is now implemented in the game, with old-save/traveller
migration, developer-kit mappings and preserved cosmetic tiers. See [shipping validation](fewer-steps-shipping.md).
The report below preserves the original isolated experiment and its results.

**Recommendation: this is a useful moderate first pass.** Across six held-out seeds, the capable main player
makes **17.3% fewer upgrade purchases per minute**, and buys about **115 fewer upgrades** over a campaign.
Completion averages **128.69 → 131.43 minutes**, a **2.1% slowdown**. Complete training costs and final effects
stay unchanged. These measurements were made on the isolated proposal before integration.

The reduction is real in fixed observation windows as well as over whole campaigns. It does not completely
smooth out spending: copied-skill catch-up still produces late bursts. A slower campaign is an observed average,
not a guaranteed outcome on every seed or strategy.

## Proposed changes

Counts below are paid skill steps, excluding research unlocks. Costs are complete undiscounted training bills,
also excluding unlocks. Unlock prices stay unchanged. Wheels applies to ordinary robots, shakers and blowers.

| Upgrade | What it improves | Steps before → proposal | Complete training cost, unchanged | Final effect, unchanged |
|---|---|---:|---:|---|
| Wheels | Movement speed | 9 → 7 | $328.10 | 3.30× |
| Basket | Leaves and industrial materials carried per trip | 9 → 7 | $489.75 | 38 leaves; 14 ore/logs; 14 ingots or 28 coal |
| Pickup | Time between leaf grabs | 8 → 7 | $357.60 | 0.32 seconds/grab |
| Load & pack | Bagging, jars/cans, wrapping and furnace/kiln loading | 7 → 6 | $1,994 | 4.60× |
| Operate machinery | Mining/sawing and furnace/kiln operation | 7 → 5 | $955 | 1.35 seconds/chunk; same processing benefit |
| Resource efficiency | Extra raw pieces and processing yield | 6 → 5 | $1,245 | 72% extra-piece chance; +36% processing yield |
| Tree shaking | Leaves released from trees and bushes | 6 → 5 | $237 | 38 leaves from a standard big tree |
| Leaf blowing | Blowing power and its associated range | 4 → 3 | $132 | 6.40× power |
| Leaf drying | Drying-bench speed and the stove's blower bonus | 6 → 5 | $235 | 6.50× drying; same maximum stove bonus |

That removes **12 steps across nine distinct tracks**. An ordinary robot's complete personal training falls
from **53 to 44 steps**; each helper also benefits from shorter Wheels and its applicable specialist track.

The first three Wheels, Basket and Pickup purchases retain their exact prices and effects. The proposal
merges neighbouring later purchases within existing research tiers. Load & pack and Operate machinery each
also lose one basic step. Leaf blowing has no research gates, so its middle two named steps merge.

The proposal leaves all sale-price and sale-value ladders alone: leaf sorting, bags, labels, gift value,
metal grades, alloy, cleanup deals and Market stall. It also retains the existing storage, truck and hive
development ladders. Claw's recently combined four steps, Research's three, excavating's four, bellows' four,
and the single-step shears and umbrella stay unchanged. Several longer paths therefore remain.

### Exact trial ladders

Each merged price is the sum of its original component prices. Effects reach the original endpoint of those
components. This avoids introducing fractional leaf counts or trying to make every jump artificially equal.
Existing decimal multipliers and durations retain their established values.

| Track | Proposed prices, in order | Proposed effects, including starting value |
|---|---|---|
| Wheels | 0.30, 0.60, 1.20 / 10, 26 / 100, 190 | 1, 1.14, 1.28, 1.42 / 1.82, 2.22 / 2.74, 3.30× |
| Basket | 0.25, 0.50, 1 / 13, 35 / 140, 300 | 3, 5, 7, 9 / 15, 21 / 29, 38 leaves |
| Pickup | 0.30, 0.60, 1.20 / 3.50, 17 / 85 / 250 | 1.30, 1.12, 0.98, 0.86 / 0.76, 0.60 / 0.44 / 0.32 seconds |
| Load & pack | 3, 17 / 75, 183 / 416, 1,300 | 0.60, 0.72, 0.96 / 1.30, 1.75 / 2.95, 4.60× |
| Operate machinery | 25, 100 / 110, 160, 560 | 4, 3.40, 2.50 / 2.10, 1.80, 1.35 seconds |
| Resource efficiency | 35, 60, 100 / 150, 900 | 0, 10, 20, 30 / 44, 72% |
| Tree shaking | 5, 9, 18 / 45, 160 | 6, 8, 11, 15 / 21, 38 leaves |
| Leaf blowing | 6, 56, 70 | 1, 1.75, 4.30, 6.40× |
| Leaf drying | 10, 20 / 30, 42 / 133 | 0, 1, 1.60 / 2.45, 3.50 / 6.50× |

Slashes separate the existing research tiers. The final drying-tier unlock still exists, now followed by
one larger step. Basket's ore, ingot and coal capacity tables follow the retained leaf-capacity endpoints.

Copied training also preserves its complete bill. Rounding 10% of a merged $13 Basket step would normally
charge $1.25; the original $5 and $8 steps charge $0.50 + $0.80. The trial preserves **$1.30** by rounding
the original components separately. Single purchases, Match and All use the same calculation. The automatic
50% copied-skill discount and Shared basket plans' separate 10% rule remain intact.

## Main result: capable-player purchases per minute

The main tester is the current completion-focused route: modest initial home honey, then complete productive
honey/ant engines with two fully trained packers at the repair unlocks, followed by industry. It retains
productive spare workers. The honey-skipping route and earlier balanced smart buyer remain challengers.
These are frozen capable heuristics, not a proof of global optimal play; they meet the requested meaning of
an effective upgrade strategy. No new policy search was used to manufacture a favourable purchase rate.

An **upgrade purchase** is a personal/helper skill, Match/All action, yard upgrade, research-tier unlock or
hive upgrade. Hires, bees, new buildings, land, mining machines and shafts are excluded. **All purchases**
includes those too. **Personal training** includes just personal/helper skill actions. The campaign players
use individual purchases, so a long training catch-up contributes multiple actions.

Rates divide purchases by active campaign minutes, including saving, research, story waits and boarding.
Offline home time during Hollow and the final cinematic are excluded. They are means of per-seed rates.
The tester can buy once per decision second; its one-second gaps are automated purchase clusters, not a
prediction of a human's reaction time or literal click count when using Match/All.

Six paired seeds, **1801–1806**, frozen before evaluation:

| Main-player measure | Current game | Proposal | Change |
|---|---:|---:|---:|
| Completion | 128.69 min | 131.43 min | +2.73 min / +2.1% |
| Upgrade purchases | 742.7 | 627.8 | −15.5% |
| Upgrades/minute | 5.78 | 4.78 | **−17.3%** |
| Personal/helper training purchases | 606.3 | 492.8 | −18.7% |
| Personal/helper purchases/minute | 4.72 | 3.75 | −20.5% |
| All purchases/minute | 6.71 | 5.69 | −15.2% |
| Paid campaign investment | $127,161 | $125,254 | Route-dependent spending |

The campaign investment differs because the buyer chooses a different set and timing of optional purchases;
complete track prices have not fallen. All six pairs make fewer upgrade purchases and have a lower upgrade
rate. Completion is slower in four pairs and faster in two; paired changes range from **−1.57 to +9.37 minutes**.

| Phase, main player | Minutes, current → proposal | Upgrades/minute, current → proposal | First 30 minutes' upgrades/minute |
|---|---:|---:|---:|
| Initial home | 49.82 → 50.58 | 1.80 → 1.46 | 2.67 → 2.20 |
| Hollow | 47.26 → 48.59 | 6.37 → 5.31 | 3.21 → 2.52 |
| Home after return | 31.61 → 32.25 | 11.18 → 9.21 | 11.41 → 9.54 |

The fixed first-30-minute comparisons show that the result is not simply more empty time at the end.
Initial home's median gap between upgrades rises from **2 to 6.7 seconds** when averaged across runs.
Hollow and returning home's median remains one decision second: batches of copied training still dominate.
Their 90th-percentile minute contains **19.0 → 14.7** and **32.5 → 27.3** upgrade purchases respectively.
Across the campaign, gaps of at most five seconds fall from **83.3% to 80.1%**. This proposal reduces the
number and size of bursts more reliably than it spaces every individual late purchase apart.

## Strategy and normal-gameplay checks

The held-out challengers retain their intended priorities, rather than being forced to buy a particular mix.
The skipping buyer stops further home honey development after its first milestone; the main player delays
the committed productive engine until repair. Both main honey targets are actually reached in every run.

| Six-seed strategy | Finish minutes, current → proposal | Upgrades/minute | Investment, current → proposal |
|---|---:|---:|---:|
| Main, delayed productive honey | 128.69 → 131.43 | 5.78 → 4.78 | $127,161 → $125,254 |
| Honey-skipping challenger | 131.65 → 133.74 | 4.48 → 3.68 | $75,765 → $76,670 |
| Earlier balanced reference | 139.31 → 142.16 | 4.02 → 3.31 | $99,029 → $98,663 |

Two additional paired seeds, **1901–1902**, compare deliberate home-repair forks. State, actors and RNG
match across challengers **within each variant**. Changed earlier progression means the baseline and
candidate do not arrive with identical assets. These are paid full campaigns, not free-capital output fixtures.
Their common prefix uses the capable honey-skipping route. Focused leaf, raw and industrial investment
lasts 20 minutes, then the common buyer resumes. Specialist staffing concentrates useful workers on the
chosen source, with productive fallback roles; the mixed arm splits the crew across sources.

| Paid repair strategy | Finish minutes, current → proposal | Upgrades/minute | Investment, current → proposal |
|---|---:|---:|---:|
| Mixed specialist staffing | 141.97 → 144.23 | 4.30 → 3.68 | $79,130 → $79,730 |
| Committed leaf priority | 140.30 → 140.38 | 4.28 → 3.71 | $81,234 → $82,472 |
| Committed raw-material priority | 128.80 → 132.73 | 4.42 → 3.68 | $74,925 → $77,117 |
| Committed processing priority | 134.91 → 137.09 | 4.31 → 3.61 | $71,911 → $71,787 |
| Full honey, including maximum storage | 129.01 → 133.23 | 4.84 → 4.05 | $111,471 → $105,086 |

The full honey arm actually reaches maximum population, all productive general upgrades, both maximum
storage tracks, all value steps, and two maximum-pack workers in both variants. The other arms are
priority builds, not advertised maximum-capacity engines. Their actual worker tasks, levels, investment
and production windows are retained in the evidence. Upgrade rates fall in every named strategy's paired mean.
Two seeds are supplementary evidence, not a new source-balance ranking or proof of the best early-home build.

Normal-gameplay branches, **1811–1812**, retain research, story and travel behaviour excluded by simulation
shortcuts, without rendering. Main completion is **134.67 → 136.51 minutes**, and upgrades/minute fall
**5.56 → 4.70**. Honey-skipping completes **137.64 → 136.51 minutes**, while its rate falls **4.23 → 3.60**.
The main and skipping routes virtually tie in this small candidate sample. This does not establish a
consistent dominant shortcut; it limits confidence in a universal slowdown or an unchanged strategy ordering.

### Source contributions and physical output

Main-player source cash below is the mean at the final ten-second sample of each phase, rounded to dollars.
It can omit receipts in the phase's last ten seconds. Complete earned cash and physical counters are also
preserved separately in the evidence. Sale-value ladders are identical between variants.

| Phase | Leaf-related cash, current → proposal | Honey/ant cash | Raw sales | Processed sales |
|---|---:|---:|---:|---:|
| Initial home | $2,521 → $2,323 | $518 → $543 | $158 → $174 | $0 → $0 |
| Hollow | $8,842 → $8,553 | $26,020 → $26,613 | $1,175 → $1,175 | $2,020 → $2,380 |
| Returning home | $3,789 → $3,593 | $56,000 → $56,259 | $1,746 → $1,492 | $119,480 → $128,821 |

Leaves still fund the opening. Returning home gathers **3,173 → 3,128 ore pieces** on average and **4,625 →
4,711 leaves**. Raw materials remain inputs to processing even when direct-sale cash is small. These totals
cover different paid development durations and purchases; they are not comparable free-capital capacity
rates. Equal income shares were not an objective, and no production source was discounted to enforce a mix.

## Validation and reproduction

- **82 distinct paid campaigns plus six exact replays**, all complete: 18 exploratory training comparisons,
  36 held-out comparisons, eight normal-path comparisons and 20 deliberate paid source comparisons.
- Legal actual offers and charges, cash conservation, goals, earned home restoration, travel skill retention,
  achieved honey targets and no campaign grants are checked by the existing campaign audit.
- **329 functional assertions** cover both yards, tier counts, complete full-price bills, original-component
  discount rounding, actual skill purchases, Match/All, final effects, unchanged price/yard ladders and all
  three Basket material-capacity tables. Functional fixtures grant cash only to check purchase mechanics;
  those fixtures do not contribute completion or income evidence.
- Final-goal checks reject 999 sold ingots, accept 1,000, and post exactly one final letter in both variants.
  `check-balance-harness.js` also passes the travel-save/ending decision boundary check.
- Regenerating the candidate from its frozen baseline reproduces `game.js` exactly. Shipping `public/game.js`
  remains byte-identical to the frozen baseline. Source, policy and harness hashes are preserved.

Use the [runner commands](README.md#isolated-fewer-steps-proposal),
[proposal generator](fewer-steps.cjs), [cadence report generator](fewer-steps-report.cjs), and
[durable numerical evidence](fewer-steps-2026-10-25.json). Full traces and frozen variants are in
`runs/fewer-steps-v1/`. Preparation refuses to overwrite an existing baseline.

The trial intentionally supports fresh campaigns only. Shipping it would also require old-save, traveller
and developer-kit level mappings and a review of level-indexed cosmetic tiers. No such migration or visual
polish is claimed by this proposal. No independent new early-home build search, hollow source-staffing search,
or maximum-capacity income study was performed. The measured purchase reduction is strong across these
capable policies; the exact best strategy and the subjective feel of the remaining bursts remain open.
