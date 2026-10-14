# Balance change implementation brief

Decisions accepted on 14 October 2026. This is an implementation specification; the changes have not been applied. Evidence and experiment limitations are in [the audit notes](BALANCE_IMPLEMENTATION_NOTES.md).

## 1. Improve bee and ant conversion and startup affordability

- Set all six beehive/anthill one-off upgrade prices to **$120 each**.
- Change nursery to **40% cheaper new workers**.
- Bees: use **18 nectar per jar**, reduced to **12** with Better recipe.
- Ants: use **12 mushrooms per can**, reduced to **6** with Better recipe.
- Reduce filling time from **3 to 2.5 seconds** before the robot's Load & pack multiplier.
- Update costs/effects shown in descriptions, short labels, tooltips and lot-specific wording.

Purpose: reward an investment in roughly ten workers and useful gathering/conversion upgrades. Later, population and packing should alternate as worthwhile investments. A developed source with sufficient packers should slightly exceed comparable leaf income without eliminating leaf investment.

Verify:

1. Compare ten, twenty and forty workers with one and two packers, using identical gathering patches, upgrades, transport and seeds. Measure income over at least ten minutes after settling.
2. Expect mature two-packer bee income near $4.5–4.6k/min and ant income near $5.65k/min in the audited configurations, versus roughly $4.2k/$4.7k from their comparable leaf crews. These are reference configurations, not universal income targets.
3. Confirm that increasing population eventually stops helping one packer, while a second becomes worthwhile. A sustained service deficit may fill storage.
4. Run equal-budget startup purchase comparisons; show when the hive/anthill package pays back against continuing leaf investment. Mature output alone is insufficient evidence for startup timing.
5. Nursery's remaining-population savings should be about $240 when bought at ten workers, $165 at twenty and $87.50 at thirty if every remaining worker is bought. Do not describe the discount as ongoing production.

## 2. Extend late leaf sorting

Append three sorting upgrades after the current seven:

| New level | Multiplier over previous level | Incremental cost |
|---|---:|---:|
| 8 | 1.25 | $2,200 |
| 9 | 1.30 | $4,000 |
| 10 | 1.35 | $7,500 |

Apply the extra value to loose leaves and leaf bags. Update progression limits, value displays and upgrade descriptions.

Purpose: let leaf investment fall behind temporarily, then become worthwhile as the regular economy develops. Leaves should remain meaningful late without overtaking a developed smelting operation.

Verify:

1. In the audited developed ten-robot allocation (three leaf workers, one honey packer, four miners, two operators), the incremental gains are approximately $693/$1,039/$1,577 per minute, with paybacks of 3.17/3.85/4.76 minutes.
2. All three together should approximately double eligible leaf/bag value: cumulative multiplier **2.19375**. Cleanup is excluded from that multiplier.
3. Reference total leaf/bag/cleanup income rises from about $3,241 to $6,550/min, while the ingot stream remains around $29,302/min before other proposed changes.
4. Compare purchasing each step at realistic affordability against robot training, additional workers and other productive sources. Factory-heavy allocations with little leaf production should not receive equally fast payback.

## 3. Change coal to larger, more valuable units

In the Rainy hollow, change the kiln from **2 logs → 3 coal** to **4 logs → 3 coal**, and double its base batch duration from **13.5 to 27 seconds** before packing, machinery, kiln heat and bellows multipliers. Double the sale value of each coal unit at every wood-grade, briquette and market combination.

Purpose: preserve base revenue per log and base revenue per processing second while halving finished-unit throughput. Each carried coal unit represents twice as much value, reducing hauling pressure and making specialist operators and bellows more useful. This is not a yield buff to 2 logs → 4 coal.

Use the uncut wood grade for charcoal pricing, then apply the new 2× coal-unit value. The separate raw-log reduction must not reduce charcoal value.

Change the coal stand to a maximum of **200 new units**, with **125** in the previous tier. Replace the current `4 × raw-log tub capacity` formula with this capacity lookup by tub level:

**[24, 24, 36, 54, 80, 90, 110, 125, 200]**

This is half the revised 400-unit stand ladder. Update the stand capacity description. Size the stand independently of the numerical raw-log tub capacity while continuing to use its upgrade levels.

Keep the kiln's internal output rack at **24 new units**. This deliberately increases the economic size of the staging buffer. The tested 12-unit rack prevented effective batch staging and erased much of the hauling improvement. Do not halve every capacity blindly: the roadside stand and internal rack serve different purposes.

Normalize other hollow coal sources and objectives to the new units:

- Drying-stove ash: each consumed log earns **0.5 new coal**, accumulated until a whole unit is available. Halve the ash-pan capacity from **12 to 6**. Preserve drying speed, log-burn duration and the existing first-ash discovery timing.
- Change the hollow coal-sale target from **200 old units to 100 new units**, including quest text, HUD, jump-to kits and progress handling.
- Update coal price displays, recipe descriptions, batch-duration descriptions and count-based statistics to identify the new units consistently.

Verify:

1. With all skill/plant multipliers disabled, both recipes earn identical revenue per consumed log and per processing second. Equal batch counts are not an equal-input comparison: use equal input and elapsed time.
2. At fixed packing and Extra yield, compare operators hauling their own coal against one external hauler and a leaf worker with hauling first and leaves as fallback, using the same total crew.
3. Check 200-unit stand capacity at slow/fast pickups and record full cases. It should be sufficient in the intended mature crews; inefficient service deficits may still fill buffers.
4. Compare 24- and 12-unit rack controls to confirm the selected staging benefit. Include simultaneous batch completions and pending recovered output.
5. Confirm that double-value stove ash does not accidentally double stove income and that the coal objective does not require twice the former resource investment.

## 4. Apply operator Extra yield to kiln and furnace output

Use the processing operator's Extra yield skill at **half strength** to increase finished coal/ingots per batch, multiplying with Tight stacking/Slag recovery:

`expected finished output = base batch output × (1 + recovery upgrade) × (1 + 0.5 × operator extra-yield chance)`

Packing continues to increase batches per minute. Extra yield increases output per batch, creating a combined payoff for training both skills. Account for Lucky horseshoe through the same chance calculation.

Reserve rack capacity for base output **and** pending bonus output from all active operators. Keep fractional and whole earned recovery owed; do not discard it when the rack temporarily lacks space. Handle simultaneous completions without overflowing or silently losing goods.

Purpose: make trained industrial crews a worthwhile investment and let two trained operators benefit from shared plant improvements. Skill investment must produce extra sold output, not just a larger counter that is later discarded.

Verify:

1. Compare one and two operators, low/high packing, and zero/maximum Extra yield with the same total regular-robot count and meaningful alternative jobs for displaced workers.
2. Test simultaneous completions, nearly full racks, delayed hauling and save/reload of accumulated recovery. Check conservation of input and earned output.
3. For the half-strength formula, maximum 72% Extra yield adds 36% expected output before other bottlenecks; with the 8% horseshoe, 40%. Verify actual sold income rather than assuming these percentages translate directly to yard income.
4. Re-run equal-budget industrial startup and late purchase comparisons after the combined changes. Two trained operators should beat one plus a productive alternative worker in suitable mature configurations.

## 5. Reduce raw-log sale value by 10%

Multiply raw-log sale revenue by **0.9**. Keep charcoal valuation based on the uncut wood-grade value, so this adjustment does not reduce both competing paths together. Update raw-log price displays and descriptions consistently.

Purpose: make processing a more attractive commitment without removing useful raw-log income during the industrial transition.

Verify raw logs sell for exactly 90% of their former value at each grade/market combination, while an otherwise identical charcoal unit keeps its former value before any selected coal-unit conversion. Compare raw selling against one/two trained kiln operators with the same total crew and budget.

## 6. Strengthen the bellows upgrade curve

Change bellows speed bonuses by skill level to:

| Level | New processing-speed bonus |
|---|---:|
| 0 | 0% |
| 1 | +20% |
| 2 | +40% |
| 3 | +65% |
| 4 | +100% |

Apply the curve wherever the shared bellows skill operates, including kiln and smelting. Update skill values, descriptions and displayed active bonus.

Purpose: make every bellows upgrade slightly more effective. The final multiplier becomes 2.0× instead of 1.7×, a 17.6% increase in processing speed while active. More production from two trained operators should make one dedicated blower worth its opportunity cost.

Configure industrial comparison crews and recommended factory assignments with the blower's sole task set to **Bellows**. Use enough feedstock and external hauling for sustained production. No new persistent-attendance rule, output bonus or hauling ability is part of this change.

Verify one and two operators at every bellows level. Compare total income with a dedicated bellows blower against the same helper assigned to its best useful alternative. Measure active bellows time, processing time, rack blocking, hauling trips, units sold and income. Validate both yards because shorter batch times can change scheduling as well as throughput.

## 7. Migrate coal units without losing value

Add a one-time save-version migration for hollow coal stocks, in-progress work and coal counters. Convert old units to new units at **2 old : 1 new**, including the stand, kiln rack, stove ash, carried coal, fractional recovery owed and relevant current-lot production/sales counters.

Preserve odd-unit remainders as conversion credit rather than flooring away their value. Preserve total resale value, earned recovery, completed story milestones and progress toward the new 100-unit objective. A save above a reduced capacity must retain its earned contents and sell/haul down normally.

An in-progress kiln batch must not receive the new recipe's double-value output after paying only the old two-log input. Preserve its old economic entitlement or settle it through migration credits. Preserve stove burn progress and discovery state. Home-yard ingots and furnace fuel use a separate context; convert only inventories/counters that represent hollow charcoal.

Verify new saves, old hollow saves with odd quantities, nearly full buffers, active kiln/stove work, partial recovery and completed/partial coal-sale goals. Repeated loading must not repeat the conversion. Total represented coal value immediately before and after migration must agree.

## 8. Validate the combined balance pass

Implement these changes together, then run the real game simulation with paired seeds, identical starting states and explicit assignments. Use at least twelve seeds for industrial comparisons, a settling period and five-minute or longer income windows; use longer windows when pickup timing materially changes results.

Required comparisons:

- Hive/anthill startup versus continued leaf investment at realistic budgets; ten/twenty/forty workers with one/two packers.
- New leaf steps versus further robot/industrial investment at their first realistic affordability.
- Eight and ten regular robots; one/two trained operators; external hauling by a dedicated worker or a leaf worker with hauling first and leaves as fallback.
- Industrial specialists with strong packing/machinery/Extra yield, testing movement and basket investment separately. Removing hauling does not automatically make movement worthless: operators can still walk or wander while blocked.
- Every bellows level in both kiln and smelting; productive alternative helper assignments.
- Coal stand 125/200 and slow/fast trucks; rack staging and correct accounting of all produced/sold/recovered units.
- Seven-minute equal-budget races where one strategy saves at least five minutes for a major upgrade and another reinvests during the wait. Flag consistent domination across stages rather than a single favorable fork.
- Full-campaign completion with required honey/coal/story gates; record income by source and time to objectives.

Acceptance goal: early training, copied skills, additional robots, useful helpers, storage and new production sources should trade places as the best investment. A developed hive/anthill should slightly exceed comparable leaves; late industry should be the leading individual stream; leaf investments should still repay when their production is staffed. Two trained operators plus adequate hauling and a dedicated blower must have a clear useful configuration without making one purchasing strategy dominate every stage.

Deliver before/after measurements, remaining bottlenecks and any failing acceptance case. Investigate failures before extending scope or adding another multiplier.
