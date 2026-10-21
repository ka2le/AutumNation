# Campaign balance testing

Follow the [standing balance-testing standard](../../BALANCE.md#standing-standard-for-future-balance-work)
when evaluating or changing the economy. It defines the main benchmark, challengers and evidence requirements.
The latest benchmark and retained $180 hive/ant price are in [the honey-maxing report](honey-max.md).
The final seven-step alloy ladder and later metal-grade prices are tested in [the alloy report](alloy-steps.md).
The [economy tuning report](economy-tuning.md) records the preceding cleanup/alloy changes and $140 trial.

Use the paid full-campaign runner for pacing and completion comparisons. It runs the **current `public/` game**,
freezes its inputs, and preserves the earned home → hollow → home route. The old browser `__leafYard.sim()` and
`tools/balance-player.js` remain available for historical single-yard checks.

## Run

```powershell
npm run balance
```

This runs the **main completion tester** on seed 1. Results go to
`runs/smart-tester/`. It uses installed Playwright and Chrome; if necessary, set `PLAYWRIGHT_PATH` to the installed
Playwright package directory and `CHROME_PATH` to a browser executable. It does not install packages or use your
normal browser profile. On platforms without the Windows Chrome path it uses Playwright's Chromium.

```powershell
# Six paired seeds; archived, balanced smart, honey-skipping and current honey-maxing players; exact replay.
npm run balance:check

# Normal gameplay branches, including the presentations skipped by simMode.
$env:FIDELITY='live'
$env:SEEDS='201,202,203'
$env:POLICIES='legacy,smart'
$env:RESULT_DIR='runs/my-live-validation'
npm run balance:check

# Rebuild numerical summaries from a completed validation.
node tools/balance/report.cjs runs/my-live-validation
```

Environment variables persist in your terminal. Remove the overrides before changing experiments:
`Remove-Item Env:FIDELITY, Env:SEEDS, Env:POLICIES, Env:RESULT_DIR -ErrorAction SilentlyContinue`.

Supported overrides:

| Variable | Meaning |
|---|---|
| `POLICIES` | Comma-separated `smart` (main honey-maxing route), `smart-skip` (previous main), `smart-balanced` (earlier reference), `legacy`, `legacy-goal`, `legacy-industrial`, `legacy-bank` |
| `SEEDS` | Explicit comma-separated seed numbers, **not a count** |
| `CONFIG` | JSON policy configuration; defaults to `completion-policy.json` |
| `RESULT_DIR` | Output directory; use a new directory for each experiment |
| `GAME_ROOT` | Alternate complete game directory for a controlled balance comparison |
| `FIDELITY` | `sim` (default) or `live` (normal game branches, without rendering) |
| `MAX_MINUTES` | Per-stage timeout for `campaign.cjs`; default 150 |

The runner reports incomplete campaigns and exits unsuccessfully. The validation suite additionally requires
completion, checks conservation and travel, and repeats the selected policy's first seed exactly.

## Search

```powershell
$env:RESULT_DIR='runs/my-policy-search'
$env:CANDIDATES='24'
npm run balance:search

# Recombine promising stage policies, but evaluate each combination as a full campaign.
$env:CROSSOVER_FROM='runs/my-policy-search/search.json'
$env:RESULT_DIR='runs/my-policy-crossovers'
npm run balance:search
```

Search screens candidates on seed 1, then evaluates the best five on seeds 2 and 3. It writes `selected.json`.
Set `CONFIG` to that file for an independent validation. Do not tune on the validation seeds or select the best
seed after seeing results. The shipped selected policy was chosen from 61 training campaigns; it is a stronger
empirical benchmark, not a mathematical optimum. Re-running the search after a policy fix may select a different
candidate; historical inputs and hashes are retained with the evidence.

## How the tester works

- `campaign.cjs` serves frozen inputs in isolated browser contexts. Its guarded in-memory adapter enables real
  letters/boarding in sim mode, captures departure instead of reloading automatically, and observes the ending.
  The production files are never patched. It records sales quantities and rejects stale or invented offers.
- `campaign-setup.js` steps the game, records milestones, production, workforce and purchase traces, and reloads
  through actual travel saves. It derives the final ingot threshold from the game.
- `legacy-policy.js` preserves the V34 campaign buyer and its older variants. Optional hooks allow the new buyer
  to reuse its bottleneck observations and task management. Hooks are inactive in the baseline.
- `smart-policy.js` expands goal-related purchase choices, saves for the held-cash letter route, develops research
  and goal prerequisites, considers all legal personal skills for readiness, and limits price reinvestment by
  estimated remaining completion time. Price estimates use quantities repriced at current values and exclude
  cleanup from the market multiplier. Optional bitmask assignment matches workers to roles using skill estimates.
  It still uses heuristic role counts and does not look ahead through every possible action.
- `search.cjs` optimizes full-campaign time. Incomplete runs receive a large penalty. Its deterministic parameter
  sampling and staged crossovers make the experiment reproducible.
- `validate.cjs` checks complete routes, cash, purchase charges, travel skill retention, the absence of cash grants and
  deterministic replay. `report.cjs` reads the exact runs in a validation summary, avoiding stale output files.

The seed resets on each yard visit. Changed decisions consume different random streams; pairing reduces initial
variation but does not hold every future random event fixed. The normal-path mode also consumes presentation
randomness. Rendering, browser UI timers, human reaction time and the final cinematic are excluded. Compare
policies within the same mode and source snapshot.

See [the current audit](smart-tester.md) for results, balance implications and remaining limits.

## Source balance and completion shortcuts

See [the source balance assessment](source-balance.md) and [numerical evidence](source-benchmark-2026-10-21.json).
The main tester retains the starter home hive initially, then deliberately maxes productive honey/ant upgrades
at each repair unlock before developing industry, keeping two trained honey packers. It also staffs shaft
excavation. The old honey-skipping route remains `smart-skip`; a competent full honey strategy beats it in the
held-out checks even with $180 general upgrades. `selected-policy.json` preserves the earlier smart reference;
`completion-policy.json` defines the current main tester. Its optional `honeyMax` maps phase-specific paid
interventions; explicit experiments override it. No progress or money is granted.

For dedicated honey comparisons, `honey-max.cjs` trains on seeds 1–3 by default. Set `MODE=validate` to load
`selected-honey-max.json`, with `SEEDS`, `GAME_ROOT`, `FIDELITY` and a fresh `RESULT_DIR`. Set `COMBINED=1` to
test maxing both yards; `ARMS` optionally limits named strategies (for example `smart,honey-productive-both`).
Its `smart` control deliberately omits the new intervention so it remains the historical skipping benchmark.
`full` requires maximum storage too; `productive` requires population, production/value upgrades and two
maximum-pack workers but leaves storage to the purchasing strategy. Both preserve productive spare workers.
All maxing runs are checked for actually reaching their advertised target. See [the results](honey-max.md).

```powershell
# Paid source-priority experiments, earned repair-unlock checkpoints, then real completion.
$env:EXPERIMENT_CONFIG='tools/balance/selected-source-policies.json'
$env:RESULT_DIR='runs/my-paid-source-test'
npm run balance:sources

# Fully upgraded production fixtures. Capital is granted ONLY in this mode.
$env:MODE='capacity'
$env:RESULT_DIR='runs/my-capacity-test'
npm run balance:sources

# Full-campaign counterfactual: no further home honey/leaf investment after the honey goal.
Remove-Item Env:MODE, Env:EXPERIMENT_CONFIG -ErrorAction SilentlyContinue
$env:RESULT_DIR='runs/my-source-ablations'
npm run balance:ablations
```

Source experiments deliberately keep the frozen **earlier smart reference** as their common earned prefix;
they do not silently change checkpoints when the main completion benchmark improves. `sources.cjs` defaults
to seeds 401–403 and both repair unlocks (phase 4 home, phase 3 hollow). `SEEDS`, `PHASES`, `ARMS`, `MINUTES`,
`STAFFING`, `BIAS`, `PAYBACK`, `EXPERIMENT_CONFIG`, `FIDELITY` and `RESULT_DIR` select an experiment. The default
paid run loads `selected-source-policies.json`; use `EXPERIMENT_CONFIG=none` to apply manual priority settings. Capacity
mode also accepts `SNIPPERS` and `EXCAVATION=0`. `STOP=1` ends at the observation horizon instead of finishing.
Use separate result directories; overrides persist in PowerShell.

Each arm replays the real prefix in a fresh browser. Saved state, actor state and RNG at the checkpoint must
match. Paid strategies prioritize their source for 20 minutes, then hand back to the common completion policy;
leaf/honey/raw focus postpones plant investment during that period. These are defined development detours,
not proofs of the best possible switch time. A hollow run can finish its local goal before 20 minutes: do not
compare its shortened revenue window directly with a full 20-minute arm. Use goal time and total completion.

Capacity fixtures buy all available production upgrades on the currently owned land with explicitly granted
cash, then hold travel and make no further purchases. They use 5 minutes to settle and measure the next 10.
They compare output ceilings and staffing opportunity costs, **not equal-budget development or campaign pace**.
Every unused worker has productive fallback tasks. The artificial full-factory bill includes unused skills;
do not treat it as a minimum build cost or calculate return on investment from it.

`balance:source-search` screens three priority weights per source on seed 1 and tests two finalists on seeds
2–3. It defaults to the main staff manager. `STAFFINGS=main,specialist` also explores explicit role assignment;
the assignment hook avoids canceling work by alternating two managers every second. Freeze the result before
evaluating new seeds. The shipped source policy was selected before seeds 401–403 were evaluated.

The campaign driver stops immediately after a travel save or ending trigger. A regression on seed 2 exposed
that a same-tick decision could otherwise buy an item after the save, making its charge disappear on return.
`node tools/check-balance-harness.js` covers this boundary; campaign validation checks actual cash conservation,
travel saves, goal completion, legal charged purchases and exact replay.
