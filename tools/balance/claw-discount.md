# Combined Claw and Reach; copied-skill discount trials — October 24, 2026

Claw and Reach now share one four-step Claw track. The unlock costs **$13** ($6 + $7), and the levels cost
**$5.50 / $17 / $52 / $459**: the exact sum of each former pair. Each level grants both effects, ending at
12 leaves a grab and 125 cm reach. The complete full-price track still costs $533.50, plus its unlock.
Individual, Match and All purchases use this track; the card shows both effects, including mobile previews.

Old saves and travellers retain the higher of their old Claw/Reach levels and acquire its complementary
effect. Either old unlock grants the combined unlock. The removed Reach level is deleted, and repeat loads
are stable. No cash is refunded. These legacy conveniences do not enter the fresh paid campaign comparisons.

The automatic **50% copied-skill price remains in the shipping game**. Three isolated alternatives were
tested after merging Claw: no automatic discount, or a local Yard upgrade restoring it for $1,500 / $3,000.
Shared basket plans remains a separate 10% copied-basket price in every trial. Shaft pricing is unchanged.
The trials do not change production effects, hire prices, goals or honey prices. Thus “no discount” below
means removing the general copied-skill discount, with the explicit basket exception retained.

All times below are **paid whole-campaign completion**, not departure times or free-capital capacity.
The saved, earned home yard is restored on return. A more developed early yard can leave later and recover
time after returning; departure alone is not a ranking criterion. The current main benchmark keeps initial
home honey modest, then develops both productive honey engines with two fully trained packers and productive
spare workers. Honey-skipping and the older balanced buyer remain challengers. Advertised honey targets
were actually reached and audited; this study does not establish the best early-home development strategy.

Three paired seeds (701–703), frozen policies:

| Game / general copied-skill rule | Main completion player | Honey-skipping challenger | Balanced reference | Main investment |
|---|---:|---:|---:|---:|
| Separate Claw/Reach, automatic 50% | 125.58 min | 128.83 min | 138.03 min | $126,302 |
| Combined Claw, automatic 50% | 129.83 min | 133.93 min | 140.36 min | $125,960 |
| Combined, full skill price | 140.02 min | 148.42 min | 154.52 min | $131,356 |
| Combined, $1,500 Yard discount | 139.81 min | 148.64 min | 154.52 min | $127,893 |
| Combined, $3,000 Yard discount | 140.02 min | 148.47 min | 154.57 min | $136,657 |

For the main player, the phase breakdown is:

| Game / rule | Initial home | Hollow | Home after return | Total |
|---|---:|---:|---:|---:|
| Separate, automatic discount | 46.39 | 47.12 | 32.07 | 125.58 |
| Combined, automatic discount | 50.25 | 47.77 | 31.81 | 129.83 |
| Combined, no general discount | 52.19 | 52.31 | 35.52 | 140.02 |
| Combined, $1,500 discount | 52.19 | 52.31 | 35.31 | 139.81 |
| Combined, $3,000 discount | 52.19 | 52.31 | 35.52 | 140.02 |

The merged upgrade adds 4.25 minutes on average in this sample, with a slightly shorter return-home phase.
Removing the general discount then adds another 10.19 minutes (7.8%). The ordinary buyer purchases the
$1,500 discount only 29.30–31.67 minutes into the final home phase; $3,000 is later. Its small benefit does
not prove the discount intrinsically weak: most useful training is already paid by then.

Deliberate saving strategies were therefore screened on seed 1: buy at three workers, at six workers, or
after repair research; also skip the purchase. These retain the main route's full productive honey targets.
Six-worker and repair timing tied in training. The $1,500 three-worker strategy finished in 167.95 minutes,
versus 148.74 for six-worker timing. Its initial home phase took 74.85 versus 60.72 minutes, Hollow 57.76
versus 51.70, and returning home 35.33 versus 36.33. It recouped one minute after returning, but remained
19.20 minutes slower overall. This is **saving for a discount**, not a deliberately established productive
early-home engine, and cannot reject that different strategy. At $3,000 the visibility/cash gates delayed
all three saving plans to the same purchases. Training's two `smart-skip` rows use the honey-skipping
configuration because of a policy-name collision; they are excluded from main-plan selection. Distinct
names fix this for the following validation.

The selected six-worker plan and a genuinely no-purchase plan were frozen before new seeds 721–723:

| Rule / main strategy | Initial home | Hollow | Home after return | Total | Investment |
|---|---:|---:|---:|---:|---:|
| Automatic 50% | 50.47 | 47.79 | 32.20 | 130.46 | $127,028 |
| No general discount | 51.74 | 52.85 | 34.80 | 139.39 | $133,732 |
| $1,500, skip purchase | 51.74 | 52.85 | 34.80 | 139.39 | $133,732 |
| $1,500, deliberate purchase | 51.74 | 53.05 | 34.19 | 138.98 | $135,000 |
| $3,000, deliberate purchase | 51.74 | 53.45 | 34.60 | 139.79 | $132,495 |

The $1,500 plan actually buys in both yards, after the committed honey build, and retains its trained
specialists. It saves only **24 seconds** overall on average versus skipping (two wins, one loss);
$3,000 loses about 24 seconds. The skip plan buys no blueprint and exactly matches no-discount traces.
Even the selected $1,500 strategy remains 8.52 minutes behind automatic discounts in this sample.

Normal-gameplay branches on seeds 711–712 also retain the full round trip. Main mean completion is
132.18 minutes before merging, 142.18 after merging, and 149.75 without the automatic discount or with
the ordinary buyer's $1,500 purchase. The live $1,500 purchase occurs late and does not change completion.
The honey-skipping live comparison is 135.53 before merging and 143.40 after. Variation and changed buyer
decisions explain why these deltas differ from simulation-mode deltas; they are separate paired comparisons.

The evidence supports leaving the discount unchanged while shipping the requested merge. The tested
$1,500/$3,000 gates mostly make training more expensive before offering a late saving. This is provisional
pricing evidence, not a global optimum or a conclusion that an established early home yard cannot pay off.
No new early-home committed engine search, independent concentrated-leaf staffing search, or maximum-capacity
study was performed. Source contributions and physical outputs are preserved in the numerical evidence;
equal source shares were not imposed or used as a success criterion.

Validation includes 83 paid comparison runs plus exact replay checks, actual legal offers/charges, cash
conservation, goals, travel/return skill retention, full honey targets and no campaign grants. The selected
six-worker discount plans also replay exactly. `check-investments.js` passes 203 invariants;
`check-claw.js` covers both yards, all 25 old-level combinations per yard, paid effects, Match/All and
desktop/mobile cards. The isolated discount price checks verify that full price avoids discount-rounding
artifacts, plus single/Match/All prices and the basket exception. The terminal-boundary harness check passes.

An unrelated pre-existing check, `check-card-refresh.js`, fails its production-update assertion on both
the frozen pre-change source and the merged source. Its fixture advances `S.t` while production now uses
`S.realT`; it is not counted as passing and is outside this change.

[Numerical evidence](claw-discount-2026-10-24.json) preserves source/policy/harness hashes, configurations,
per-seed phase/finish times, paid investment, blueprint timing, income and physical contributions. Full
traces, frozen game variants and screenshots are in `runs/claw-discount/` (ignored local output).
`claw-discount-study.cjs` has guarded `prepare`, `checks`, `run`, `report` and `replay-plans` modes.
Use a fresh `RESULT_DIR` for new studies; `prepare` snapshots current `public/` and never edits it.
Set `SEEDS`, `POLICIES`, `ARMS`, `PLANS`, `SUMMARY` and `FIDELITY` to reproduce the documented suites.
The historical separate-track baseline is commit `f70d403`; use that complete `public/` as `GAME_ROOT`
with the regular validation runner before comparing the merged source.
