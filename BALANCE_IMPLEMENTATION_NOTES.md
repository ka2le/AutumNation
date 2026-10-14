# AutumNation balance implementation notes

Pending balance pass discussed on 14 October 2026. Live economy values have not been changed. The initial evidence is in [the balance audit](runs/audit/balance-analysis-2026-10-14.html); targeted experiments and their frozen game source are in `runs/audit/followup/`.

Latest user decisions: accept the bee/ant and extra leaf-value proposals; apply operator Extra yield to both kiln and furnace production at **half strength**; reduce raw-log value by **10%**; do not adopt the 2 → 4 coal yield buff. The selected kiln solution is **4 logs → 3 double-value coal**, double batch duration, **200-unit maximum stand** (half the revised 400-old-unit capacity), and stronger bellows at each level. Test a dedicated bellows-only blower; do not add persistent-attendance behavior. Cheap mature price multipliers are acceptable pending their ordinary purchase timing. Other storage-size proposals are not selected. Full implementation instructions are in [BALANCE_CHANGE_BRIEF.md](BALANCE_CHANGE_BRIEF.md).

## Current shortlist

These are proposed implementation values, not applied changes:

| Change | Candidate | Status |
|---|---|---|
| Hive/anthill one-off upgrades | $120 each, down from $180 | User direction; six-upgrade package falls from $1,080 to $720 |
| Nursery | 40% worker discount, up from 30% | Useful while enough population remains to buy |
| Bee conversion | 18 nectar per jar; improved recipe 12 | Supported by mature production tests |
| Ant conversion | 12 mushrooms per can; improved recipe 6 | Ants need the larger conversion improvement |
| Filling | 2.5 seconds, down from 3 | Particularly useful for the improved ant economy |
| Labels and wrapping prices/time | Keep current values initially | Lower label prices undo the desired honey/mushroom contribution |
| Factory Extra yield | Multiply finished yield by `1 + 0.5 × extra-yield chance` | Selected; correct batch reservations and retained recovery required |
| Raw logs | 10% lower sale value, without lowering charcoal's grade reference | Selected gentler shift toward processing |
| Kiln units | 4 logs → 3 double-value coal; double processing duration | Selected denomination/handling change; no 2 → 4 yield buff |
| Additional leaf sorting | +25% for $2,200; then +30% for $4,000; then +35% for $7,500 | Measured paybacks below |
| Truck prices | Retain pending combined economy validation | Blanket nerf not supported |
| Bellows | Bonuses 20%, 40%, 65%, 100%; dedicated bellows-only assignment | Selected; gains remain allocation-dependent |

Production tests isolate effects with purchases disabled. They establish viable output and staffing relationships; they do not establish the optimal startup purchase order or full-campaign completion time under the combined proposal.

## Design targets

- Preserve the strong first shaker after roughly two slightly trained regular robots. Its strength is welcome.
- Keep the changing value of robot depth, copied skills, more robots, helpers, storage and additional income sources. Avoid a purchase policy that wins every stage.
- Roughly eight robots should support early factory work. Ten fully trained robots should earn more than eight. The confirmed endgame difference was about 10%, with two different ten-robot allocations effectively tied.
- Bees and ants should repay a deliberate startup package around ten workers and useful upgrades, then contribute somewhat more than leaves without invalidating leaf investment.
- Mining should provide an attractive initial boost, followed by investment in enough skill, supply and sale value to rival leaves or honey separately.
- Kilns and smelting plants should require an upfront commitment and become the leading income source late. Two trained operators and a blower should eventually outperform one operator plus another productive use of the second robot.

## Storage and production ceilings

Size terminal storage from measured peaks between actual pickups, with approximately 15–25% headroom as an initial target. Countdown, driving and loading all contribute to the time between sales. Test source-focused crews as well as balanced crews, across truck schedules.

The terminal tier should remove the storage bottleneck in adequately staffed, attainable high-production configurations. The previous tier should still bind in a relevant configuration; otherwise remove or reshape redundant tail tiers. Recompute ceilings after production buffs.

Intermediate buffers require downstream workers who can keep up. If input permanently exceeds processing, any finite store eventually fills. Storage cannot solve that mismatch.

Preserve or deliberately separate these current dependencies before pruning tiers:

- Bigger bin increases the bag shelf, including the hollow's drying shelf. An empty loose-leaf bin does not prove the upgrade is useless.
- Bigger metal tub increases the ingot pallet; in the hollow it increases the coal stand by four times the tub size.
- Honey store sets the finished-goods crate capacity.
- Tank/store upgrade levels increase hive floors and therefore conversion speed. Removing a storage tier can also remove productive capacity.
- Hopper and rack are separate buffers. Both batch reservations and hauling affect the rack.

### Measured limits

Measured maxima across paired runs, not theoretical hard bounds. Focused configurations use ten fully trained regular robots; hive tests use forty bees/ants and two trained packers. The proposed hive conversion/filling values are included in the hive storage tests.

| Buffer | Measured peak | Implication |
|---|---|---|
| Loose leaves, leaf-focused yard | 788 with 45-second truck countdown; 519 at 27 seconds; 425 at 19 seconds; 332 at 14 seconds | The existing 600 maximum is useful. Previous 320 still binds even at the fastest truck. 600 has ~16% headroom over the 27-second case, but cannot remove the slowest-truck bottleneck |
| Raw metal, four-miner source-focused yard | 360 at 45 seconds; 230 at 27; 202 at 23; 175 at 19; 145 at 14 | Existing 200 is not redundant against previous 135. It is insufficient for slower pickup schedules in this configuration |
| Coal stand, improved kiln | 270 at 27 seconds; 227 at 23; 204 at 19; 168 at 14 | Current 800, and previous 540, are oversized for these schedules. Candidate terminal ~320–340, previous ~200–250; separate it from the raw-log tub before pruning |
| Nectar, resized hive floors | About 81 at later schedules; 88.4 at the slowest schedule | 800 is excessive under these conditions. Candidate final 110, previous 70. Preserve conversion capacity when tiers disappear |
| Honey/mushroom buffer, improved two-packer hive | Up to 59 with 27-second pickup countdown | A final 50 is insufficient in this case, even with two packers |
| Finished-goods crate | Up to 62 plain cans at 27-second countdown; up to 51 wrapped cans; 90 plain / 80 wrapped at the slowest schedule | Terminal 80, previous 50 is viable with later pickups. For coverage of every truck schedule, candidate terminal 110, previous 80 |

Direct tests of terminal **110 nectar / 80 honey-and-crate**, with fewer hive floors, showed no full buffers in the measured wrapped cases at 14- and 27-second countdowns. The previous **70 / 50** filled in the slower ant case and earned about $318/min less from canned mushrooms. This is the intended useful final tier. Plain ant cans also fill a 50-capacity crate at the 27-second countdown.

The slowest-truck confirmation found peaks of **90 plain cans / 80 wrapped cans**, and **88.4 nectar** in the bee yard. A shared 80 store fills under that schedule. If “terminal storage never fills” must cover even the initial 45-second truck countdown, use approximately **110 nectar / 110 honey-and-crate**, with a previous crate tier of 80. That gives about 22–24% headroom over these measured peaks. The corresponding leaf/raw-metal targets would be around **950 leaves / 450 raw metal** rather than today's 600/200. Alternatively, size terminal storage for an intended late pickup schedule and make that assumption explicit. Do not silently claim 80 covers all trucks. The combined final economy still needs confirmation against the selected boundary.

With only one packer, improved production can fill even the existing 800 tank and 120 honey store. This is a staffing deficit, not evidence for giant storage. Likewise, an unconstrained hollow hopper accumulated over 1,100 logs: upstream production exceeded service. Size buffers after fixing sustained service deficits.

Do not discard bin/tub tiers simply because factory-focused mixed crews leave them mostly empty. Their source-focused uses still justify them. Conversely, retaining the full raw-log tub does not justify a coal stand four times its size.

## Kiln and furnace changes

User direction: improve kilns and modestly reduce raw-log sale value. Make training an operator in both Load & pack and Extra yield worthwhile, particularly with two operators benefiting from one blower.

Current processing speed multiplies Load & pack, Operate machinery, heat and bellows. Extra yield currently helps mining only, with no direct effect on furnace/kiln output.

Experimental operator recovery multiplies existing slag/stacking output by `1 + 0.5 × operator extra-yield chance`. This gives +36% output at the 72% skill maximum, or +40% with Lucky horseshoe. Packing increases batches per minute while Extra yield increases goods per batch.

Compare these changes separately:

1. Operator recovery while retaining the current base conversion.
2. About 15% less money for raw logs. Apply this only to raw-log sales, preserving the uncut grade used to value charcoal.
3. If needed, 2 logs to 4 coal rather than 2 to 3. This is another +33% conversion buff and may be excessive when stacked with recovery.

The naive recovery experiment exposed a rack interaction: output bonuses can be discarded when the rack fills, and larger batches change hauling behavior. Reserve room for finished batches including bonuses and retain any earned recovery owed. Test both operators finishing together. Do not adopt a yield buff that sometimes reduces skilled production through overflow or task behavior.

### Controlled factory results

Same eight regular robots, same full shared upgrades, same trained crew. Operators replace leaf workers; four miners and one honey packer remain. Twelve paired seeds, three minutes settling followed by ten measured minutes. Figures are **total yard income per minute**, including the opportunity cost of changing jobs.

| Economy | Raw selling, no operators | One operator | Two operators |
|---|---:|---:|---:|
| Current hollow | $14,105 | $14,899 | $16,086 |
| Hollow recovery + raw logs −15% | $13,108 | $15,233 | $16,560 |
| Above plus 2 logs → 4 coal | $13,108 | $15,734 | $17,757 |
| Current smelting yard | $14,282 | $22,494 | $32,521 |
| Smelting with recovery/reservation correction | $14,282 | $25,073 | $39,752 |

This refines the initial audit: properly staffed, fully trained kilns already beat raw-log selling by about 14%. The earlier no-kiln strategy win partly reflected the simulated player's allocation and training. However, weak packing reverses the current comparison: two pack-level-3 kiln operators yield $13,831/min, below the raw-selling crew. Buying a plant alone is not sufficient.

Under the stronger hollow proposal, two max-packing operators with no trained Extra yield earn $16,435/min; adding maximum Extra yield lifts that to $17,757. With weak packing, trained Extra yield gives $14,742 instead of $14,056. This establishes the intended interaction. Coal itself contributes $7,568/min, versus about $5,318 leaves/cleanup, $3,194 raw logs and $1,677 mushrooms. Even without the 2 → 4 recipe, recovery and the raw-log cut make charcoal the leading individual stream in this configuration.

The blower result is still unresolved. In the recovery smelting test, two operators with bellows earn $39,752/min versus $34,560 without: a $5,192 gain, with approximate paired 95% interval $4,628–$5,757. In the stronger hollow test, the corresponding difference is −$14/min, interval −$144–$115: effectively no mature benefit. Walking, output handling and batch/rack service become important once the kiln cycle is fast. Increasing heat alone is unlikely to achieve the user's target.

### Follow-up: blower attendance and hauling

Direct activity sampling identified an additional cause, beyond the generic hauling ceiling. The blower can select bellows only while an operator is smelting or approaching a smelting station. It abandons the task immediately when neither condition holds. When both operators leave to haul output, the helper can start an entire leaf-blowing lap before checking bellows again.

In a matched recovery test with two operators and four miners, the current blower actually worked bellows only **7.6% of sampled time in the hollow**, versus **90.1% in the smelting yard**. Input was available in every sampled operator observation in both cases. Operators spent roughly 27% of their time processing, about 34% approaching stations and 28% hauling toward the sale stand; the rest included rack pickup and other transitions. Rack reservations sometimes blocked a new batch even when the shelf was not literally full. These are overlapping diagnostic conditions, not additive idle-cause percentages.

A browser-only trial kept the blower at the plant while an assigned, enabled operator had available feedstock. Attendance rose to about 99%. This improved coal income but did **not** reliably improve total yard income without a dedicated hauler: hollow total $16,335 vs $16,590 without bellows; smelting $32,135 vs $34,560. Faster synchronized batches and output handling can still reduce effective throughput, and dedicating the helper has an opportunity cost.

With a ninth regular robot assigned to hauling, the persistent bellows trial earned **$18,837 vs $17,742** in the hollow, and **$39,264 vs $33,710** in the smelting yard. Paired differences across twelve seeds were +$1,095/min (approximate interval $901–$1,289) and +$5,554/min ($4,835–$6,273). The added robot is a diagnostic service change, not proof that this is the best nine-robot allocation or equal-budget purchase.

Conclusion: the especially weak current kiln result includes helper attendance/churn, while both plants can become limited by output handling. Test bounded waiting at the bellows and better hauling/rack scheduling before inventing another speed multiplier. Any selected blower output/handling change must be tested against productive alternative helper work and regular-robot allocations.

### Selected coal handling solution: final comparison

The user selected larger coal units plus stronger bellows, with a blower assigned only to bellows. No persistent-attendance change is selected. Candidate bellows bonuses are 20%/40%/65%/100%.

Matched ten-robot tests included the selected 10% raw-log cut, half-strength operator recovery, improved ant conversion/filling, a 200-unit stand, the 24-unit rack, and double-input/time/value coal. Six paired seeds per arm, three minutes settling and ten measured minutes. Other source upgrades were mature; the newly proposed leaf ladder was not bought in these comparisons.

| Allocation at fastest pickup | Total income/min | Coal income/min | Bellows gain over productive helper fallback |
|---|---:|---:|---:|
| Operators haul their own output; no external hauler | $22,936 | $12,291 | +$157/min |
| One external hauler; operators may also haul | $25,093 | $15,018 | +$1,868/min; interval $1,680–$2,056 |
| One external hauler; operators only process | $26,648 | $17,002 | +$157/min; interval $61–$254 |
| Leaf worker with haul first, leaves as fallback; operators only process | $26,556 | $16,838 | +$62/min; interval −$111 to +$234 |
| Two external haulers; operators only process | $26,926 | $18,159 | −$121/min; interval spans zero |

Specialist operators in this final table retained their movement and basket skills. Earlier trials stripped those skills separately. A leaf worker with haul and leaves in one equal-priority row performed much worse than haul-first/leaf-fallback: too little sustained output service.

Larger coal units improved output handling, but **halving the rack to 12 was counterproductive**. For example, with one external hauler and low-transport specialist operators, double-size coal with a 24-unit rack earned about $26,527/min versus $18,938 with a 12-unit rack under the earlier task arrangement. Keep the roadside stand reduction distinct from the staging buffer.

At the slowest pickup schedule, the selected 200-unit stand **did fill**: it was full approximately 11% of samples with one hauler plus operators also hauling, 16% with one hauler and processing-only operators, and 26% with two haulers. These are allowed inefficient-pickup cases. At the fastest schedule, measured peaks were 88–125 depending on allocation, with no full samples.

The chosen solution gives a meaningful blower benefit in at least one useful mixed allocation, but its benefit remains small in the highest-income specialist allocations tested. Do not claim universal superiority. Verification must compare actual purchases, helper alternatives, intermediate skills, the new leaf ladder and the full campaign. The evidence supports compaction as a hauling improvement; it does not establish the entire proposed pass as balanced before implementation.

A trial increasing operators' log-carry capacity with packing/bellows produced identical results, because miners already feed the hopper directly. Drop that ineffective candidate. A kiln blower change should address a measured active bottleneck and then beat the best alternative use of that helper. Avoid approving an arbitrary additional heat multiplier.

## Bees and ants

User target: reduce all six hive/ant-hill upgrades from **$180 to approximately $120 each**. Test nursery at **40% cheaper workers**, instead of 30%.

The current nursery barely breaks even even when purchased at ten workers and every remaining worker is bought. At fourteen workers its lifetime savings are below its cost. At the 40-worker cap, a purchase discount has no value. The revised nursery still needs a remaining-population check rather than being treated as an always useful production upgrade.

Prefer making more goods from gathered nectar/mushrooms to increasing their sale price:

| Source | Current base / improved recipe | Moderate candidate | Stronger ant candidate |
|---|---|---|---|
| Bees | 25 / 20 nectar per jar | 18 / 12 | Keep moderate bee values |
| Ants | 25 / 20 mushrooms per can | 12 / 8 | 12 / 6 |

Test filling time of **2.5 seconds**, instead of 3; initially keep wrapping/certification time unchanged. Filling speed only matters when packers limit production.

Compare conversion alone, conversion plus faster filling, and an optional label ladder ending at **10 instead of 12.5**. Do not automatically weaken sale prices: ants may still need the existing ladder after conversion improves. Test ten, twenty and forty workers with one and two packers, including usable patches and travel.

### Measured hive income

Six paired seeds, three minutes settling and ten measured minutes. Six fully trained regular robots, mature hive/price upgrades and useful seeding/clover, no mining. These are **honey/mushroom income alone**, not total yard income or equal-cost startup comparisons.

| Source and production | 10 workers, one packer | 20 workers, one / two packers | 40 workers, one / two packers |
|---|---:|---:|---:|
| Bees, 18 / 12 conversion | $1,909 | $2,607 / $3,193 | $2,608 / $4,585 |
| Ants, 12 / 8 conversion | $1,751 | $2,535 / $2,774 | $2,535 / $4,282 |
| Ants, 12 / 6 conversion | $2,313 | $2,536 / $3,697 | $2,536 / $5,072 |
| Ants, 12 / 6 and 2.5-second filling | $2,323 | $2,842 / $3,698 | $2,840 / $5,647 |

Comparable mature leaf income is roughly $4.2k/min in the bee setup and $4.7k/min in the ant setup. The moderate bee conversion and stronger ant conversion reach the intended neighborhood with two packers. Adding population eventually stops helping one packer, while a second becomes worthwhile: a useful change in the best purchase/job choice.

Current mature bees produce about $2,609/$2,759 with one/two packers; current mature ants about $1,721/$1,722. Thus **bees have the same kind of ceiling issue, but ants are weaker**. The earlier audit's extremely low ant income also reflected omission of useful seeding/clover in the buyer: do not use its $37/min observation as the properly developed ant ceiling.

Faster filling helps improved ants materially at forty workers, lifting two-packer income from $5,072 to $5,647 and keeping honey/nectar buffers under control at the normal fast schedule. It barely helps the two-packer bee ceiling once nectar supply binds. Weakening the label ladder to 10 brought the tested improved bee income to about $3,672/min, below comparable leaves; retain current labels initially.

At the proposed $120 nursery cost and 40% discount, total future savings if all remaining workers are purchased are $240 at population 10, $165 at 20, $87.50 at 30 and $0 at 40. It becomes a useful early investment, still a poor late purchase. These are lifetime savings, not extra production.

## Leaf value progression

The existing final sorting/bag steps finish early in the works-ready stage. Preserve their midgame falloff and add distinct later investments.

Price proposed steps against their extra leaf/bag income, excluding cleanup where it is not multiplied. Aim for 3–5 minute payback at the intended purchase stage, with slower payback when first visible. Expensive steps should become worthwhile as regular income rises.

A fully developed, deliberately allocated crew can earn about $3.4k/min from leaves/bags/cleanup, versus roughly $425/min under a factory-heavy allocation. New leaf steps should reward restoring collection and packing rather than become compulsory cheap multipliers or dead purchases in an unstaffed leaf economy.

### Concrete additional leaf steps

Append three sorting levels after the current seven; leave existing leaf and bag steps unchanged. Multiply loose-leaf and bag values, keeping the current cleanup reward separate.

| New level | Gain over previous level | Incremental cost | Added income in developed mixed crew | Payback |
|---|---:|---:|---:|---:|
| 8 | +25% | $2,200 | $693/min | 3.17 min |
| 9 | +30% | $4,000 | $1,039/min | 3.85 min |
| 10 | +35% | $7,500 | $1,577/min | 4.76 min |

Cumulative value is 1.25×, 1.625× and 2.19375× the present cap. Before market multipliers, loose-leaf value progresses approximately $0.466 → $0.582 → $0.757 → $1.022. The fully upgraded bag is then worth about $115.60 at the current maximum market multiplier.

Six paired seeds per arm. A developed ten-robot crew with three leaf workers, one honey packer, four miners and two operators gains about $3,309/min across all three steps. Total leaf/bag/cleanup income rises from $3,241 to $6,550; ingots remain about $29,302/min. Leaves stay meaningful while industry remains dominant.

The same steps take about 6.2/7.5/9.2 minutes to repay in the measured return-stage allocation, and 19.8/24.0/29.6 minutes in the factory-heavy allocation. They reward productive leaf staffing and become more attractive later. They are not universally cheap income multipliers. These are steady-income paybacks; confirm the combined purchase races before fixing the ladder permanently.

## Trucks and other multipliers

Preserve spaced pickup decisions: one truck step can become excellent when storage binds, but the next should not automatically be another compelling long-saving target.

Targeted confirmation uses 24 paired seeds and 15-minute measurement windows after settling. Compare normal and unconstrained storage to separate additional production from selling existing inventory earlier. Test single and successive truck steps, Lucky horseshoe and exact price multipliers separately.

The first audit found no confirmed five-minute-saving exploit; its two actual five-minute-plus targets both lost to reinvestment. Short industrial forks varied substantially, so a low mean payback was insufficient evidence for repricing.

### Confirmed truck and horseshoe results

Actual saved campaign states, current storage and crew, 24 paired seeds. Three minutes settling, fifteen measured minutes; no additional purchases. Approximate intervals describe the paired income difference, not certainty over every possible seed/policy.

| State | First available truck step | Following step, incremental | Lucky horseshoe for $950 |
|---|---|---|---|
| Hollow, 20 min after preset | $90; −$49/min, interval −$73 to −$25 | Two-step total −$201/min | +$104/min; ~9.2-min payback |
| Hollow, 60 min | $90; +$284/min, interval $254–$313; ~19-second payback | $260; only +$78/min beyond first step; ~3.3-min payback | +$124/min; ~7.7-min payback |
| Smelting, 20 min | $260; −$701/min, interval −$1,465 to +$63 | Two-step total −$116/min, interval spans zero | +$855/min; ~1.1-min payback |
| Smelting, 60 min | $260; +$195/min, interval −$424 to +$815 | Two-step total −$268/min, interval spans zero | +$753/min; ~1.3-min payback |

The hollow's mature first/next-step relationship fits the intended alternating value. The previously spectacular smelting truck gain is not confirmed. Pickup schedule also changes robot routing and packing behavior, so sale interval alone does not predict income. Unlimited-capacity diagnostics likewise change reservations and routing; do not interpret them as an economically neutral free-storage upgrade.

Horseshoe is attractive in the smelting yard and much weaker in the hollow. A shared price increase could worsen the hollow's weak result. Operator recovery would give horseshoe another direct processing benefit; defer repricing until testing that combination.

### Exact late price multiplier accounting

Price-only counterfactuals use the observed sold quantities at maximum price and subtract the previous price. Unlike heat/yield/scheduling forks, these do not require treating a noisy production change as a price effect. Existing upgrade costs, with steady fully developed production; rounded results from the 20-minute states (60-minute results are similar):

| Final price step | Incremental income | Payback |
|---|---:|---:|
| Smelting yard market, $1,800 | $2,291/min | 0.79 min |
| Smelting yard metal grade, $4,200 | $4,695/min | 0.89 min |
| Smelting yard alloy, $6,000 | $3,631/min | 1.65 min |
| Smelting yard honey labels, $2,000 | $527/min | 3.79 min |
| Smelting yard gift ribbons, $1,500 | $427/min | 3.51 min |
| Hollow market, $1,800 | $747/min | 2.41 min |
| Hollow log grade, $1,000 | $2,125/min | 0.47 min |
| Hollow briquettes, $950 | $1,038/min | 0.91 min |

These confirm some **cheap late multipliers**, especially metal/log grade and the factory-yard market. Grade also increases the finished ingot/charcoal value, not only raw sales. However, the measured income makes them affordable quickly; a short mature payback is not a confirmed five-minute-hoarding strategy. The initial audit's actual long wait for hollow log grade lost to reinvestment. After proposed production changes, repeat purchases at their first realistic affordability and compare against robot/helper/storage/conversion alternatives before selecting new prices.

The user's timing interpretation is consistent with the formulas: the final market step pays back in five minutes at about **$4,320/min of eligible sales before that step**; final metal grade at about **$3,939/min of raw-metal-plus-ingot sales**; final hollow log grade at about **$600/min of raw-log-plus-charcoal sales**. Those production thresholds are far below the mature tested streams. This establishes the earlier five-minute-payback income threshold, not an exact observed campaign timestamp or player purchase choice. No multiplier repricing is currently requested.

## Strategy implications and remaining decisions

- Early: retain the effective first shaker; develop a useful collecting robot, then benefit from copying skills and adding capacity as collection/storage bind. Do not apply late factory conclusions to early robot counts.
- Hive startup: buy useful gathering/conversion upgrades and population together. With the proposal, around ten workers can produce meaningful output; at twenty/forty, packing becomes a reason to diversify. Mature output alone does not prove the exact startup break-even point.
- Industrial transition: transport and packing training matter before assigning many operators. Two weak kiln operators can lose to raw selling. Two trained operators can beat one even after sacrificing productive leaf work.
- Late game: eight appropriately allocated robots should support industry; ten fully trained robots remain more productive. Keep leaf workers and add the new value steps when their contribution warrants it. A dedicated hauler is useful only while it improves service more than the worker's alternative task.
- Poor strategies: expecting a nursery to repay after most population is already bought; adding bees/ants indefinitely without enough packers; buying storage to solve a permanent processing deficit; adding kiln heat when hauling/batching dominates; treating every faster truck as an automatic throughput gain.
- Before final implementation choices: settle the kiln blower's useful late function, choose the storage target pickup schedule, then run a combined equal-budget campaign/purchase comparison. Do not stack the optional 2 → 4 kiln recipe by default or preemptively weaken honey labels.

## Experiment provenance

`runs/audit/followup/targeted.cjs` serves a frozen game source and applies trial changes to browser responses only. It uses the real game tick at 20 ticks/second, fixed starting states, paired random seeds and explicit jobs/skills. `summary.json` aggregates the raw per-seed observations; `summary.txt` is a readable export. No live balance file was edited.

The follow-up contains 4,744 individual simulations, including exploratory/superseded diagnostics, representing about 1,115 hours of accelerated game time. No browser errors were reported. `manifest.json` records the result files and frozen source hash; the initial audit is separate from this count.

The initial unlimited-storage experiments accidentally scaled absolute keep reserves with capacity. Their unconstrained-storage conclusions are superseded by the `-absolute` files and subsequent focused storage tests. Baseline arms without the override remain useful. Exploratory recovery profiles without corrected batch reservations are also superseded by `reserve-exact` profiles. This distinction is necessary when reviewing raw results.

## Findings to preserve during implementation

- Transport skills matter on miners, operators and haulers. The old player neglected them and could produce false stalls.
- Dedicated hauling helps weak transport, but can waste a worker once operators haul efficiently themselves.
- Advancing a honey-specific quest can reduce general income. Skipping required honey/coal story gates is not a valid whole-campaign strategy.
- Nursery/blueprints need future-purchase accounting, not a no-buy throughput fork.
- Hold costs, effects, jobs and population fixed when isolating a change. Distinguish output ceilings from equal-budget races and cheat-kit assumptions.
- Removing tiers requires old-save migration/refund checks and preservation of coupled effects.
