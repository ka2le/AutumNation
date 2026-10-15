# AutumNation balance plan — questionnaire decisions (15 October 2026)

Implemented as trial values in V29 (see BALANCE.md "V29" for what was picked where the plan left a choice open). The
validation below has not been run yet.

## Primary target

Core industrial crew and factory upgrades should finish approximately within one minute of reaching the ingot goal. An
industry-focused campaign may leave optional leaf and specialist yard investments unbought. Preserve the large benefits
of trained operators, miners, haulers and industrial blowers.

Keep 2,000 sold ingots provisionally. Measure fully maxed, goal-focused throughput and paid campaign progression before
deciding the final count. Do not fit prices around a target count that has not yet been checked.

## Selected trial changes

1. **Load & pack, final tier.** Precision tools unlock $700 → $600. Skills $100/$170/$290/$500 → $120/$200/$370/$630
   (total $1,060 → $1,320). Unlock plus one full-price tier $1,760 → $1,920 (+$160). Effects unchanged.
2. **Remove Copy the blueprints.** Keep the standard 50% copied-skill discount and Shared basket plans. Evaluate new crews
   with the standard discount.
3. **Better alloy, home.** $300/$1,050/$2,000/$3,600/$5,200 → $300/$3,000/$6,500/$9,500/$14,000. Multipliers and the
   accessible first step preserved. The main early-to-late monetary brake on the industrial income ramp.
4. **Other home industrial prices.** Moderately increase the later metal-grade steps and final furnace heat, slag
   recovery, ore hopper and ingot pallet steps. Keep effects and early entry costs. Target roughly 3–5 minute marginal
   payback at a sensible purchase stage. Exact prices to be measured and selected. No blanket multiplier across
   throughput, price and storage. *(V29 trial: grade 4–6 $2,000/3,800/6,500; furnace 3 $2,400; slag 3 $3,500; hopper 3
   $900; pallet 4 $1,500.)*
5. **Basket effects and prices.** Every level of the final two tiers must improve industrial carrying. Maximum
   capacities: raw ore/logs 7 → 14, ingots 9 → 14, coal 19 → 28. Leaf capacities unchanged. Avoid another zero-benefit
   final miner step. Wicker hamper $1.80/$2.70/$4/$6 → $3/$5/$8/$12; Spring hopper $14/$20/$30/$44 → $25/$40/$65/$100.
   Shared basket plans stays $150 at 10%. Basket unlock prices unchanged.
6. **Pickup progression.** 3 basic + unlock + 3 + unlock + 2. Final unlock about $20; final two skills about $16/$28.
   Maximum grab time stays 0.32 s. *(V29 trial: Quick servos $2.50/4.50/8 at 0.57/0.48/0.41 s; Gyro wrist 0.36/0.32 s.)*
7. **Leaf drying after the stove.** Trained drying gives a modest benefit to the fueled stove. A bounded coupling; decide
   whether it needs an attending Blower and how several interact; no free stacking global bonus. *(V29 trial: the best
   Blower drying at the bench right now, up to +30% at the top level, no stacking.)*
8. **Storage and conversion floors.** Keep the tank/store link to floors and explain the benefit clearly: it depends on
   the paired track's level; not every storage purchase adds a floor. Reprice only steps shown to be weak.
9. **First cleanup contract.** Compare $30 and $35 against $20. Later cleanup prices unchanged. *(V29 trial: $30.)*

## Kept as they are

Bellows and excavating (rewards for training helpers); late leaf sorting and Leaf mould; hollow-specific log grade,
briquettes, labels and certification; Nursery's discount role and price; Shared basket plans' rules and $150 price;
mulch, clover and seeding; Market stall, Cutting oil and Lucky horseshoe (initially, to isolate the alloy/factory/basket
changes); research prices and effects.

## Scope note

The industrial repricing applies to home. Shared robot skills, discounts, basket effects, pickup progression and the
first cleanup deal also exist in the hollow and need regression checks there. The drying-to-stove change is a deliberate
hollow-side effect change.

## Calculations that frame the tests

Alloy five-minute thresholds (ingot income before each step, sold quantities fixed):

| Level | Trial cost | Relative value gain | Required ingot income/min |
|---|---|---|---|
| 1 | $300 | 20.69% | $290 |
| 2 | $3,000 | 22.86% | $2,625 |
| 3 | $6,500 | 20.93% | $6,211 |
| 4 | $9,500 | 19.23% | $9,880 |
| 5 | $14,000 | 16.13% | $17,360 |

New full-price basket training $259.75 (was $124.25), unlocks excluded. Shared basket plans saves $104.35 per fresh full
copied track, $92.50 over the final tier. New final packing tier with standard copying: first specialist $1,920, second
$660, both $2,580. Archived mature crews sold ~135–140 ingots/min (~14–15 min for 2,000 from zero); not proof of the
maxed ceiling.

## Planned validation order

1. Current-code ceiling: fully maxed goal-focused crews; compare miner/operator/hauler/blower allocations; units sold a
   minute, cold-start time, remaining-goal time at full development.
2. Isolate basket logistics and the blueprint removal before combining the price curves.
3. Run the alloy ladder with moderate factory price candidates in paid campaigns, realistic incoming crews and a
   zero-cash hollow arrival; keep research/story gates.
4. Measure each price step from eligible sold quantities; throughput and storage with paired forks; no total truck
   revenue as incremental gain; exclude cleanup from Market's affected sales.
5. Check industry upgrades stay useful, choices change with bottlenecks, and the final core upgrade is within about a
   minute of the milestone.
6. Then keep or revise the ingot goal, and recheck upgrade timing against it.
7. Compare first cleanup at $30/$35, the pickup progression, the drying coupling and the storage text; check home's early
   feel and the hollow.

At least six seeds for quoted timing results, paired seeds for counterfactuals, long enough income windows; report
failing cases as well as averages.
