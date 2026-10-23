# Pacing experiment: 1 second becomes 1.2 seconds — October 23, 2026

**The 1.2 duration setting can preserve the tested economy without changing prices, capacities, upgrade effects or goals.** A fixed simulation step made the full economic and worker traces identical at equal progression. A simple smaller delta per rendered frame was less predictable. This remains an isolated experiment; every main-game source hash is unchanged.

## What was tested

The frozen current game is under `runs/pacing-study/`. `baseline` / `candidate` use the existing variable-step approach with a shared pacing entry point. `fixed-baseline` / `fixed-candidate` use 1/60-second simulation steps and an accumulator. `review-candidate` additionally includes the discovered UI and scripted-sequence corrections. It defines a single `WORLD_DURATION = 1.2`; developer speed remains relative to that normal tempo.

All campaign drivers call the candidate's actual `advanceWorld` function, which is also called by its real frame loop. They do not merely multiply an existing result by 1.2. Deterministic frame driving simulates elapsed time quickly; separate real requestAnimationFrame checks cover actual elapsed time and rendering.

1. **Matched-step control:** 9 paired paid campaigns (three seeds, three policies) plus an exact replay. The same simulation slices consume 20% more input time, with identical purchase, milestone, state, production-sample and worker-diagnostic traces.
2. **Variable-step 60 Hz trial:** 9 paired paid campaigns. All complete, but equal seeds no longer follow equal economic trajectories. Actual duration changes range from **+16.72% to +31.87%**, rather than exactly +20%. This combines a changed update size, discrete state transitions and changed random-number consumption; it does not by itself prove a systematic advantage for a source.
3. **Fixed-step 60 Hz trial:** 9 paired paid campaigns. Every economic trace, sampled stock level, production contribution and worker diagnostic matches exactly. Input time increases by 20%, with sub-frame finishing differences. The normal-speed fixed control also matches the original 60 Hz control exactly across all nine runs.
4. **Normal-gameplay branches:** 3 further paired paid campaigns through the final ending trigger, plus an exact final-candidate replay. All traces match at equal world time. These runs include presentation branches but still disable rendering/browser timers, as documented in the standard harness.
5. **Build challengers:** 4 paired capacity fixtures and 3 paired paid detours. All experiment/state/production/staffing traces match. Capacity grants are explicitly separate from paid results.
6. **Browser and regression checks:** 15 timing/UI/subsystem checks, 203 economy/save invariants, the travel/ending decision-boundary check, and existing ending replay, goal dismissal and reset regressions pass.

## Paid campaign result

Three unseen seeds, unchanged frozen policies; times are the deterministic driver's normal-play-equivalent elapsed minutes, excluding the final cinematic. Spending is identical before/after.

| Strategy | Normal duration | 1.2 duration | Mean legal spending |
|---|---:|---:|---:|
| smart | 124.00 min | 148.80 min | $123,682 |
| smart-skip | 126.76 min | 152.12 min | $76,973 |
| smart-balanced | 132.87 min | 159.44 min | $97,107 |

`smart` retains minimal initial home honey, then reaches its advertised full productive honey/ant engines with two trained packers at repair unlocks. `smart-skip` keeps the source-skipping challenger; `smart-balanced` retains the earlier mixed reference. The main strategy remains fastest on every pair. No buyer was forced into a desired income mix.

The paid specialist detours deliberately prioritize leaves, raw materials or processing for 20 world minutes after the earned home repair unlock, then resume completion. Their finish times are 138.44 / 133.27 / 135.35 normal minutes respectively, with identical purchases and spending at 1.2. These are defined delayed-development strategies, not proofs of the best possible leaf/raw/industrial build.

## Capacity and bottleneck result

The capacity fixtures use 10 Robots, upgraded helpers and productive upgrades purchased with explicitly granted capital. They settle for 5 world minutes, then measure 10. They are output ceilings, not affordable repair-checkpoint builds.

The tested layouts are concentrated leaves (2 baggers, 8 gatherers), developed honey plus leaves (2 honey workers, 2 baggers, 6 gatherers), raw materials plus leaves (4 miners with productive support), and industrial mixed staffing (4 miners, 2 smelters, 1 hauler, 1 leaf worker, 1 bagger, 1 honey worker). Leaf and raw layouts intentionally skip the plant. Whole-engine honey is represented rather than a partial-investment proxy.

All before/after world-time output, buffer occupancy, worker activity and recipe/sales contributions are identical. Per real minute their production falls to 1/1.2, while the interval between corresponding events rises by 1.2. No storage enlargement or packer compensation is indicated by these tests. These fixtures compare **preservation under a time transformation**, not the relative fairness of the existing sources.

## Truck scheduling correction

The next pickup clock starts when the sale credits the money. It continues during both the payout display and departure. The direct browser check observes a 45-second simulation countdown at payment, then 44.5 during payout and 44 during departure. Driving away does not start the next interval. No truck scheduling change is needed for this experiment.

## Support patches found

- **Consistent simulation steps.** The naive factor changes step size and can change a seeded campaign's trajectory. Scheduling constant-size world updates gives the strongest demonstrated preservation. The prototype uses 1/60-second world steps, retaining the existing maximum frame-delta clamp and CPU work budget. This is a structural timing change, not an economy retune.
- **Convert durations and rates at display boundaries.** Truck timers and upgrade seconds, research ETAs/output, pickup and mining durations, hive conversion, fuel-burn text, recent production and elapsed timestamps need conversion. Relative multipliers, capacities, prices and quantities stay unchanged. Examples in the test: 30 world seconds show 36 seconds; 1.3-second pickup shows 1.56 seconds; 10 world units/s show 8.33 units/s.
- **Remove hardcoded absolute-time text.** The final pickup description said 0.32 seconds after the clock changed. The review candidate derives 0.384 seconds from the same value.
- **Synchronize scripted world scenes.** The wet-leaf introduction combines a world-time worker pause with real-time camera/callback scheduling. The review candidate scales its 4.7/6.2-second callbacks to 5.64/7.44 real seconds and keeps scripted camera holds aligned with world actors. Player watch/tutorial cameras and manual controls remain on their normal response timing.
- **Align the post-ending yard sequence.** Its phase timer previously advanced outside the world step. The review candidate applies the base duration to that sequence too. The separate final cinematic and ordinary UI/audio timing stay on their existing presentation clock.
- **Preserve elapsed-time history before integrating.** The prototype converts saved simulation timestamps for display. Multiplying an old run clock by a newly changed setting would relabel the past. A main-game version should accumulate normal-play elapsed deltas or store a time basis with recorded timestamps. This is an identified remaining integration detail; it does not change earned money, inventories or upgrade balance.

## Actual browser clock and controls

The final rendered test measures approximately 0.9968 world seconds per real second for the control and 0.8366 for the trial (target 0.8333). Pause, 2x developer speed, truck payment timing and home/hollow frame dispatch pass. Active fuel consumption, stove-log burn, fire decay, flower growth, honey conversion and shaker cooldown checks match at equal world time.

An initial rendered timing probe was run while multiple campaign browsers were busy and the baseline itself ran below real time. The final probe runs sequentially after ground-render warmup and passes. The game's existing 50 ms frame-delta cap can already discard time under low FPS or background throttling; this experiment does not change that behavior.

## Limits and motion tradeoff

Exact preservation applies to matched simulation inputs and decisions. Rendering and other presentation code share randomness with the world, so literal rendered sessions or human choices need not replay the same seeded trajectory. Human attention has intentionally gained 20% more real time; players can use that time differently.

The 1/60-second fixed-step prototype updates world state on 50 of 60 rendered frames at 1.2 duration. It continues rendering and responding to controls every frame, but some motion repeats a frame. Human comfort and motion smoothness have not been established by automated checks. Rendering interpolation would be a separate refinement if this is noticeable; choosing a different fixed step would require another baseline comparison.

This experiment supports a single pacing value with shared timing/display helpers. It does not establish that 1.2 is the preferred feel for players, and it does not remove pre-existing source strengths or weaknesses.

## Reproduction and evidence

Versioned numerical evidence: [pacing-study-2026-10-23.json](pacing-study-2026-10-23.json). Raw campaigns, hashes and isolated game copies: `runs/pacing-study/`. Production source hashes were checked before and after.

Use a fresh `RESULT_DIR`; the preparers refuse to overwrite frozen game copies. Run `node tools/balance/pacing-study.cjs` with `MODE=prepare`, then `prepare-fixed` and `prepare-review`. `MODE=campaign` accepts `DRIVER=matched|wall`, `HZ`, `VARIANT=fixed|review`, `FIDELITY`, `SEEDS` and `POLICIES`. `MODE=builds` runs the fixed build comparisons; `MODE=replay` repeats the final review candidate. The browser checker uses `VARIANT=review`. `pacing-regressions.cjs` adapts only the existing regression scripts' served root to the trial. The numerical report is rebuilt with `node tools/balance/pacing-study-report.cjs` after all named suites complete.
