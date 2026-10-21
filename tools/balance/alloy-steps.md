# Smaller alloy steps — October 21, 2026

Better alloy now spreads its late investment over six smaller purchases instead of four. The initial $360
purchase is unchanged. No individual purchase exceeds the previous $36,000 maximum. Total investment rises
from **$79,360 to $114,360 (+44.1%)**, and the final multiplier falls slightly from **3.23× to 3.12× (−3.4%)**.

| Purchase | Price | Resulting multiplier | Increase | Mature-output marginal payback |
|---|---:|---:|---:|---:|
| First | $360 | 1.75× | 20.7% | 0.05 min |
| Second | $6,000 | 1.95× | 11.4% | 1.29 min |
| Third | $10,000 | 2.15× | 10.3% | 2.16 min |
| Fourth | $14,000 | 2.38× | 10.7% | 2.62 min |
| Fifth | $20,000 | 2.62× | 10.1% | 3.59 min |
| Sixth | $28,000 | 2.87× | 9.5% | 4.83 min |
| Seventh | $36,000 | 3.12× | 8.7% | 6.21 min |

Base alloy remains 1.45×. Grade the metal keeps its first three prices ($300 / $600 / $1,100); the final
three become **$4,500 / $8,500 / $15,000**, up from $3,500 / $7,000 / $13,000. Total grade investment rises
from $25,500 to $30,000. Metal-grade effects and physical production are unchanged.

Home cleanup remains the requested $400 / $1,000 / $2,000, and final Sort leaves is $6,000 in both yards.
General hive/ant upgrades stay $180; hollow cleanup and briquettes retain their own ladders.

## Paid campaign checks

The baseline already includes those final leaf prices and the strong honey-maxing main tester. Both arms
use identical frozen policies and paired unseen seeds. Completion is the actual final ending trigger.

| Strategy | Before | After |
|---|---:|---:|
| Main honey-maxing tester, three-seed mean | 128.86 min | 128.86 min |
| Previous main, limited honey investment | 134.75 min | 134.20 min |
| Main tester, normal-gameplay seed | 129.21 min | 129.21 min |
| Limited honey, normal-gameplay seed | 132.46 min | 131.89 min |

The main route retains identical finish times on all four paired seeds, despite changing late purchases.
The limited-honey challenger improves by about 33 seconds on average but remains slower on every pair.
More expensive grades change the buyer's spending decisions; this small improvement is not evidence that
higher prices generate more income. The opening and hollow finish times are unchanged in both strategies.

All **20 paid runs**, including four exact replays, pass legal-purchase, cash conservation, travel, actual
honey-target attainment and completion checks. The game also passes **185 economy/save invariants** and
the campaign terminal-boundary check. Old home alloy levels map to 0 / 1 / 3 / 4 / 6 / 7; reload is idempotent,
old maxed saves stay maxed, cash is unchanged, and hollow briquette indices remain unchanged. Real charged
offers reach all seven new tiers and stop at the cap.

## What this changes, and what it does not establish

This is a modest reduction in industrial cash growth and a longer optional investment path. The last alloy
purchase's estimated marginal payback grows from **3.88 to 6.21 minutes** at the earlier developed mixed
home throughput and maximum metal grade. The final metal grade rises from about **0.99 to 1.18 minutes**:
it remains a strong mature-engine purchase.

Those paybacks analytically reprice the earlier three-seed free-capital capacity fixture. They are optimistic
mature-engine estimates, not earnings attainable immediately at repair unlock. At the same physical output,
total mixed income falls about 3.1%, from $82.45k to $79.90k per minute; ingots still provide roughly **90.6%**.
This change therefore does **not** equalize fully upgraded sources or resolve industrial dominance by itself.

The completion-focused player mostly skips late alloy purchases because too little campaign remains for
them to repay. The new ladder is suitable for continued economic growth, not a requirement for the fastest
ending. These are fixed-policy sensitivity checks with a small seed sample, not a new global strategy search.
Keep testing paid completion separately from unlimited endgame capacity, including strong honey development
and skipping challengers, before making further changes.

## Reproduction

[Versioned evidence](alloy-steps-2026-10-21.json) preserves the selected arrays, game/tester hashes, policies,
paired times, actual price purchases and capacity-repricing observations. Raw runs and frozen sources are
under `runs/alloy-steps/`. Rebuild with `node tools/balance/alloy-steps-report.cjs`.

Use `validate.cjs` with `POLICIES=smart,smart-skip`, `SEEDS=1201,1202,1203`, separate `RESULT_DIR` values and
`GAME_ROOT=runs/alloy-steps/baseline` for the baseline. Normal-path checks use `FIDELITY=live`, seed 1301.
