# Fewer upgrade steps — shipping validation, October 25, 2026

The game now implements the approved [nine-track proposal](fewer-steps.md): twelve fewer skill steps,
with the same complete full-price and copied-training bills, research prices and final effects. Sale-value
ladders, other upgrades and goals are unchanged. The first three gathering purchases stay intact.

The implementation uses explicit current track tables. Copied prices round each original component before
adding the merged bill, consistently across individual purchases, Match, All and the Yard eye's estimates.
Basket's industrial carrying tables follow the retained endpoints. The removed zero-purchase blower tier
from the historical experiment is omitted from the shipping definition.

## Existing progress

- Schema-32 saves map each changed level **up to the next retained endpoint**. An intermediate level may
  gain the remainder of the combined step; no purchased effect is reduced and maximum skills remain maximum.
  This migration neither charges nor refunds cash. The `fewerStepsV1` flag prevents repeated conversion.
- Older saves first pass through the existing pre-32 conversion, then the new mapping. Inactive yards
  migrate when loaded, including robots marked away.
- New travel saves carry skill schema **33**. Pre-32 and schema-32 in-flight crews convert on arrival;
  current travellers retain their levels. Conversion leaves the arrival payload unchanged.
- Developer kits convert their original endpoint definitions through both mappings. Standalone developer
  travellers use current levels. Wheel and basket artwork follows the old effect endpoint, preserving the
  final appearance with fewer numerical levels.

## Validation

**18 paid held-out campaigns**, seeds 1801–1806 with the current completion, honey-skipping and earlier
balanced policies, reproduce the historical candidate's complete economic traces. **Four normal-gameplay
campaigns**, seeds 1811–1812 with completion and honey-skipping, do the same. Purchases, elapsed time,
milestones, initial/final state, staffing, diagnostics and production samples match. Only the new save-schema
flag is excluded. Canonical hashes are read from the committed proposal evidence, so reproduction does not
require the ignored historical raw runs. Exact seeded replays pass, including an independent saved-trace
replay and a final-source campaign/replay pair.

Thus the prior measured results still apply: the main player's upgrade rate is **5.78 → 4.78 purchases/minute**
and mean completion is **128.69 → 131.43 minutes**. This is the same tested economy, not a new tuning pass.
The original strategy, source-contribution and late-burst limitations still apply.

Additional checks pass:

- **3,816 assertions** across both yards cover every affected old/current skill level, all robot kinds,
  pre-32/32/33 arrivals, unchanged arrival payloads, repeat loads, away markers, cash/output retention,
  every developer kit, endpoint effects, complete copied bills and desktop/mobile robot/helper cards.
- **329 assertions** run the original full-price/copied-price comparison against the shipping game,
  including actual purchases, Match/All, unchanged yard/value ladders and all material-capacity tables.
- **203 economy invariants**, actual paid skill/cleanup purchases, hires, legacy saves and arrivals pass.
- **349 control/receipt checks**, the combined-Claw regressions, reset/retraining/revisit checks,
  PWA/cache isolation and the campaign travel-save/ending boundary checks pass.

Fresh test contexts and functional cash fixtures do not touch player saves. Paid campaigns receive no grants
and retain the earned home yard across the complete home → Hollow → home route. Desktop/mobile snapshots
are in `runs/fewer-steps-shipping/`; raw campaigns and replay evidence are in its `campaigns/`, `live/`
and `final-source/` subdirectories.

Run `node tools/check-fewer-steps.js`, `node tools/check-investments.js` and
`node tools/balance/fewer-steps-integration.cjs`. Set `SUITE=live` and a fresh `RESULT_DIR` for the normal
branches. See [runner details](README.md#shipping-integration) and the
[durable shipping evidence](fewer-steps-shipping-2026-10-25.json).
