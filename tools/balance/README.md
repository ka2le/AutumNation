# Campaign balance testing

Use the paid full-campaign runner for pacing and completion comparisons. It runs the **current `public/` game**,
freezes its inputs, and preserves the earned home → hollow → home route. The old browser `__leafYard.sim()` and
`tools/balance-player.js` remain available for historical single-yard checks.

## Run

```powershell
npm run balance
```

This runs the archived balanced buyer and the selected faster policy on seed 1. Results go to
`runs/smart-tester/`. It uses installed Playwright and Chrome; if necessary, set `PLAYWRIGHT_PATH` to the installed
Playwright package directory and `CHROME_PATH` to a browser executable. It does not install packages or use your
normal browser profile. On platforms without the Windows Chrome path it uses Playwright's Chromium.

```powershell
# Six unseen paired seeds; old balanced, goal-first and industrial buyers; exact replay check.
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
| `POLICIES` | Comma-separated `legacy`, `legacy-goal`, `legacy-industrial`, `legacy-bank`, `smart` |
| `SEEDS` | Explicit comma-separated seed numbers, **not a count** |
| `CONFIG` | JSON policy configuration; defaults to `selected-policy.json` |
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
