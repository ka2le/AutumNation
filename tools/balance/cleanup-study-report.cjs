'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {audit,replayTrace}=require('./validate.cjs');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'runs/cleanup-study');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),mean=a=>a.reduce((n,x)=>n+x,0)/a.length;
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const names=['capacity','capacity-reserve','capacity-half-reserve','mature','mature-late','paid','paid-double','live','double-capacity-check'];
const suites=Object.fromEntries(names.map(n=>[n,read(path.join(base,n,'summary.json'))]));
const training=Object.fromEntries(['training','training-tail','training-reserve','training-half-reserve'].map(n=>[n,read(path.join(base,n,'summary.json'))]));
for(const n of names.filter(n=>n!=='paid-double'&&n!=='double-capacity-check'))assert.equal(suites[n].manifest.sources['game.js'],hash(path.join(base,'capacity/sources/game.js')),'Frozen baseline differs from experiment');
for(const n of ['paid','paid-double']){
  assert.equal(suites[n].results.length,18);assert(read(path.join(base,n,'replay.json')).identical);
  for(const r of suites[n].results)audit(read(path.join(base,n,r.file)));
}
assert(read(path.join(base,'capacity/replay.json')).identical);
const paidPairs=suites.paid.results.map(a=>{
  const b=suites['paid-double'].results.find(b=>b.name===a.name&&b.seed===a.seed);assert(b);
  assert.equal(replayTrace(read(path.join(base,'paid',a.file))),replayTrace(read(path.join(base,'paid-double',b.file))));
  return {name:a.name,seed:a.seed,before:a.minutes,after:b.minutes};
});
for(const name of ['cleanup-leaf-2-bag','cleanup-requested']){
  const a=suites['capacity-reserve'].results.find(r=>r.name===name&&r.seed===1401),b=suites['double-capacity-check'].results.find(r=>r.name===name);
  assert.equal(a.checkpointHash,b.checkpointHash);
  for(const key of Object.keys(a.rate).filter(k=>k!=='clean'))assert.equal(a.rate[key],b.rate[key]);
  assert.equal(b.rate.clean,2*a.rate.clean);
}
function aggregate(suite,name,expected=6){
  const rows=suites[suite].results.filter(r=>r.name===name);assert.equal(rows.length,expected);
  const rate=Object.fromEntries(Object.keys(rows[0].rate).map(k=>[k,mean(rows.map(r=>r.rate[k]))]));
  const total=mean(rows.map(r=>r.total)),physical=[];
  for(const row of rows){
    const e=read(path.join(base,suite,row.file)).stages.at(-1).experiment,w=e.points.find(p=>p.t>=300),z=e.points.at(-1),minutes=(z.t-w.t)/60;
    physical.push({seed:row.seed,ore:w.totals?(z.totals.metal-w.totals.metal)/minutes:null,
      smeltingFraction:e.activity?(e.activity.smelterBlocked.busy||0)/(2*e.activity.seconds):null,
      crew:row.fixture.robots?.length??row.fixture.robots,cleanupLevel:row.fixture.lv.cleanup,
      repairDelay:row.repairDelay??null});
  }
  return {suite,name,total,range:[Math.min(...rows.map(r=>r.total)),Math.max(...rows.map(r=>r.total))],rate,physical,
    leaves:rate.leaf+rate.bag+rate.clean,honey:rate.jar+rate.gift,
    payback:[400/(rate.nL*.18),1000/(rate.nL*.24),2000/(rate.nL*.28)],
    packagePayback:3400/(rate.nL*.7),
    rewards:[70,98,140,210,350,700].map(reward=>({reward,cleanupIncome:rate.nL*reward/100,
      total:total+(reward-70)*rate.nL/100,finalPayback:2000/(rate.nL*(reward-42)/100)}))};
}
const layouts={
  leaves:aggregate('capacity-half-reserve','cleanup-leaf-2-bag'),
  leavesNoReserve:aggregate('capacity','cleanup-leaf-10-bag'),
  requested:aggregate('capacity','cleanup-requested'),
  requestedReserve:aggregate('capacity-reserve','cleanup-requested'),
  requestedSplit:aggregate('capacity','cleanup-requested-split'),
  industrialMixed:aggregate('capacity','cleanup-mixed-four-miners'),
  industryHoney:aggregate('capacity','cleanup-industry-honey'),
  honeyLeaves:aggregate('capacity','cleanup-honey-leaves')
};
const mature=[aggregate('mature','mature-15'),aggregate('mature','mature-25'),aggregate('mature-late','mature-30')];
for(const r of mature){
  assert(r.physical.every(p=>p.cleanupLevel===0));
  // Mature yards own no home cleanup: these are hypothetical value-only returns.
  r.hypotheticalCleanup70=r.rate.nL*.7;r.hypotheticalCleanup140=r.rate.nL*1.4;
  delete r.rewards;
}
const paid=Object.fromEntries(['smart','smart-skip','smart-balanced'].map(name=>[name,{
  minutes:mean(paidPairs.filter(r=>r.name===name).map(r=>r.before)),
  homeCleanupPurchases:suites.paid.results.filter(r=>r.name===name).flatMap(r=>r.stages.filter(s=>s.phase!==3).flatMap(s=>s.cleanupPurchases)).length,
  spend:mean(suites.paid.results.filter(r=>r.name===name).map(r=>read(path.join(base,'paid',r.file)).stages.reduce((n,s)=>n+s.purchases.reduce((n,p)=>n+p.cost,0),0)))
}]));
const implementation=read(path.join(base,'implementation-smoke/summary.json'));
assert(implementation.replayIdentical);
assert.equal(implementation.manifest.sources['game.js'],hash(path.join(root,'public/game.js')));
for(const row of implementation.results){
  const applied=read(path.join(base,'implementation-smoke',row.file));audit(applied);
  const tested=suites['paid-double'].results.find(r=>r.name===row.name&&r.seed===row.seed);assert(tested);
  assert.equal(replayTrace(applied),replayTrace(read(path.join(base,'paid-double',tested.file))));
}
const evidence={date:'2026-10-22',method:'Current actual game at 20 Hz; current honey-maxing completion prefix; six held-out seeds 1401-1406. Capacity grants buy all available land and production upgrades, 5 min settle + 15 min measure. Mature forks freeze earned upgrades and staffing, 5 min settle + 10 min measure. Normal-game branches use seeds 1501-1503. Price-only paybacks are calculated at observed mean physical sales, with per-100 payout rounding excluded from marginal formula. No production files changed.',
  manifests:Object.fromEntries(names.map(n=>[n,suites[n].manifest])),policy:suites.capacity.config,
  hashes:Object.fromEntries(['cleanup-study.cjs','cleanup-mature.js','cleanup-study-report.cjs','source-experiment.js'].map(f=>[f,hash(path.join(__dirname,f))])),
  layouts,mature,paid,paidPairs,checks:{paidExactTracesIdentical:true,paidReplay:true,capacityReplay:true,doubleCapacityPhysicalOutputIdentical:true},
  implementation,training,observations:Object.fromEntries(names.map(n=>[n,suites[n].results]))};
fs.writeFileSync(path.join(__dirname,'cleanup-study-2026-10-22.json'),JSON.stringify(evidence,null,2)+'\n');
const money=x=>'$'+Math.round(x).toLocaleString('en-US'),num=x=>x.toFixed(2),pct=x=>(100*x).toFixed(1)+'%';
const rows=Object.entries(layouts).map(([key,r])=>`| ${key} | ${money(r.total)} | ${money(r.rate.leaf+r.rate.bag)} | ${money(r.rate.clean)} | ${money(r.honey)} | ${money(r.rate.ingot)} |`).join('\n');
const pRows=['leaves','requested','industrialMixed'].map(k=>{const r=layouts[k];return `| ${k} | ${Math.round(r.rate.nL)} | ${r.payback.map(num).join(' / ')} | ${num(r.packagePayback)} | ${num(r.rewards.find(v=>v.reward===140).finalPayback)} |`;}).join('\n');
const mRows=mature.map(r=>`| ${r.name} (${num(mean(r.physical.map(p=>p.repairDelay)))} min after repair) | ${money(r.total)} | ${Math.round(r.rate.nL)} | ${money(r.hypotheticalCleanup70)} | ${r.payback.map(num).join(' / ')} | ${num(2000/(r.rate.nL*.98))} |`).join('\n');
const rewardRows=[70,98,140,210,350,700].map(v=>`| $${v} / 100 | ${['leaves','requested','industrialMixed'].map(k=>{const r=layouts[k].rewards.find(r=>r.reward===v);return `${money(r.total)} (${num(r.finalPayback)} min)`;}).join(' | ')} |`).join('\n');
const r=layouts.requested,b=layouts.industrialMixed,l=layouts.leaves;
const md=`# Cleanup contribution and mature yard staffing — October 22, 2026

**Implemented:** the final reward is now **$140 per 100 leaves in both yards**, with earlier rewards and all prices unchanged. The tables below preserve the $70 baseline and its tested alternatives.

Cleanup repays quickly in a committed leaf yard, more slowly in a developed mixed yard, and very slowly in the earned completion yard after staffing shifts toward industry. Doubling its final total reward improves that purchase but leaves ingots far ahead at maximum capacity. The approved implementation changes only the final cleanup reward.

## Audited baseline and latest evidence

This follows the October 21 honey-maxing and final alloy-step tests. Home cleanup costs **$400 / $1,000 / $2,000** and pays **$18 / $42 / $70 per 100 physical leaves sold**. Bagged leaves count; Sort leaves, Better bags and Market stall do not multiply cleanup. The three marginal gains are $0.18 / $0.24 / $0.28 per leaf. The full ladder costs $3,400; the last step adds $28, not $70, per hundred. Current home alloy ends at 3.12× across seven purchases. Hollow cleanup has separate prices ($150 / $700 / $1,500); this new study concerns the home yard.

For a sale rate L leaves/minute, cleanup income is L × reward / 100 and marginal payback is price / (L × reward increase / 100). Actual payments are rounded to completed batches of 100; the analytical paybacks smooth that small timing effect.

## Fully developed capacity

Six held-out paired seeds; ten Robots, three Blowers and three Shakers with maximum economic skills, 40 bees and every available productive upgrade/land purchase. Five minutes settle, the following fifteen measure actual truck sales. These are explicitly **free-capital capacity fixtures**, not an affordable repair-unlock income or a return on the entire factory's bill. Worker travel, station contention, rest, hauling, refuelling and truck pickups are included.

| Layout | Total $/min | Loose leaves + bags | Cleanup | Honey | Ingots |
|---|---:|---:|---:|---:|---:|
${rows}

The strongest tested leaf setting is two bag-first Robots and eight leaf-first Robots, with the other leaf task available as fallback, all Blowers blowing, all Shakers shaking, and the keep-for-bagging slider at **50%**. Sweeping zero through ten bag-first workers on training seed 1 found a broad plateau once leaves were reserved. All ten bag-first with leaf fallback also performs similarly at 50%. Without reserves, even the best bag-first arrangement loses value to loose sales. The six-seed mean is **${money(l.total)}/min**, range ${l.range.map(money).join('–')}, at ${Math.round(l.rate.nL)} leaves/min and ${num(l.rate.nBags)} bags/min. This is the best measured configuration, not a proof of the global ceiling.

The developed honey-and-leaf alternative keeps two fully trained honey workers, the full hive engine and productive spare workers. It earns ${money(layouts.honeyLeaves.total)}/min. Thus a real honey commitment is represented; it has not been evaluated as an underdeveloped or artificially idle engine.

## The requested mixed yard

The requested layout is **2 smelters, 3 honey/leaf packers, 2 leaf pickers/baggers and 3 miners**. Smelters haul ingots as fallback and one refuels. Packers share jar filling and wrapping, then bag leaves; leaf workers share picking and bagging. There are **1 bellows Blower and 2 excavation Blowers**, with blowing as excavation fallback; **1 deadheading Shaker and 2 tree Shakers**, each with the other task as fallback. No separate hauler is added to the ten-worker budget.

It earns **${money(r.total)}/min**, with ${pct(r.rate.ingot/r.total)} from ingots, ${pct(r.leaves/r.total)} from leaves/bags/cleanup and ${pct(r.honey/r.total)} from honey. Physical output is ${num(r.rate.nI)} ingots, ${num(r.rate.nBags)} bags and ${num(r.rate.nJ)} gift jars per minute. Mining supplies about ${num(mean(r.physical.map(p=>p.ore)))} ore/min. Raw ore sales are zero because the material is processed; its economic contribution is essential.

Reserving leaves lifts the requested yard to **${money(layouts.requestedReserve.total)}/min**; the three-seed normal-gameplay check averages ${money(mean(suites.live.results.filter(r=>r.name==='cleanup-requested').map(r=>r.total)))}/min. Splitting the three packers explicitly into two honey workers and one bagger produces ${money(layouts.requestedSplit.total)}/min, effectively the same within simulation variation. The third packer is useful mainly through bags, not a third independent honey stream.

The stronger industrial mixed comparison uses **4 miners, 2 smelters, 1 hauler, 1 leaf worker, 1 bagger and 1 honey worker** with the same industrial helper split. It earns ${money(b.total)}/min (${pct(b.rate.ingot/b.total)} ingots), about ${num(b.total/r.total)}× the requested yard. It sells ${num(b.rate.nI)} ingots/min versus ${num(r.rate.nI)}, and mines ${num(mean(b.physical.map(p=>p.ore)))} ore/min. Smelters spend about ${pct(mean(r.physical.map(p=>p.smeltingFraction)))} of sampled time actually smelting in the requested layout, versus ${pct(mean(b.physical.map(p=>p.smeltingFraction)))} in the four-miner layout. Their remaining time includes fetching, hauling, refuelling and waiting. The income gap is principally the lost industrial pipeline, not a shortage of cleanup multipliers.

## Cleanup cost versus marginal return

Minutes at each layout's measured mean physical sales; all other development is already present. Package return means $3,400 divided by the whole $70 bonus, assuming starting at cleanup level zero. It excludes the investment required to reach that throughput.

| Yard | Leaves/min | Current tier 1 / 2 / 3 payback | Whole ladder payback | Tier 3 payback if final reward is $140 |
|---|---:|---:|---:|---:|
${pRows}

The last current tier needs **1,429 leaves/min** to repay within five minutes. That exceeds the mean of the best leaf fixture tested here. The first two tiers need 444 and 833 leaves/min respectively. With a $140 final reward the last tier needs only **408 leaves/min** for a five-minute return. Cleanup's current maximum contributes ${pct(l.rate.clean/l.total)} of leaf-only income, ${pct(r.rate.clean/r.total)} of requested-layout income, and ${pct(b.rate.clean/b.total)} of the industrial mixed yard.

## Earned mature yards: a different answer

These forks use the **current paid honey-maxing main benchmark**, freeze its actually earned assets and existing staffing after hive completion and at 25/30 minutes after home repair unlock, then settle five minutes and measure ten. No cash or progress is granted and no purchases occur during observation. The nominal 15-minute fork waits for actual productive honey maxing; its real delay is reported. This isolates price returns at attainable development, rather than granting an industrial ceiling.

| Earned checkpoint | Yard $/min | Leaves/min | Hypothetical cleanup income at $70 | Tier 1 / 2 / 3 payback | Tier 3 if $140 |
|---|---:|---:|---:|---:|---:|
${mRows}

**Every measured paid home yard actually has cleanup level zero**, so its cleanup contribution is currently $0. The hypothetical column shows what all three tiers would earn at the same physical output. The late paid yard's leaf stream is small because labor has moved into industry; its expensive cleanup ladder does not repay within the remaining campaign. These observations do not say what a paid committed leaf builder would earn after a different investment path.

## Doubling the last tier and other examples

“Double reward” here means **final total $70 → $140 per 100**, leaving the second tier at $42 and the last price at $2,000. This changes the last marginal gain from $28 to $98, so its payback becomes **3.5× faster**, not merely twice as fast. Doubling just the final *increment* would mean **$42 + 2×$28 = $98 total**, and would halve that step's payback.

Each cell below is total yard $/min followed by the final tier's marginal payback. Only the final cleanup reward changes; physical throughput and staffing are held fixed.

| Final reward | Leaf-only | Requested mixed | Industrial mixed |
|---|---:|---:|---:|
${rewardRows}

At $140, leaf-only income rises only ${pct((l.rewards[2].total/l.total)-1)}, requested-layout income ${pct((r.rewards[2].total/r.total)-1)}, and industrial mixed income ${pct((b.rewards[2].total/b.total)-1)}. Ingots retain a large lead. Algebraically, holding the developed industrial mixed yard at its current income, the leaf-only yard would need roughly **${money(70+(b.total-l.total)/(l.rate.nL/100))} per 100 leaves** to catch it through cleanup alone. The industrial layout would also benefit if its cleanup were raised, so this is an illustrative lower threshold, not a proposed price or balanced target.

Actual candidate-game fixture checks on seed 1401 reproduce identical physical output and exactly double cleanup receipts for matched leaf-only and requested yards. Reward changes therefore match the value-only calculation, including payout batches.

## Paid completion and limits

The current main route averages **${num(paid.smart.minutes)} minutes**, versus ${num(paid['smart-skip'].minutes)} for the honey-investment skipping challenger and ${num(paid['smart-balanced'].minutes)} for the earlier balanced reference. All six finish in every arm. Average total legal purchase spending is ${money(paid.smart.spend)}, ${money(paid['smart-skip'].spend)} and ${money(paid['smart-balanced'].spend)} respectively. All three finish with their actual advertised normal policies; the main route reaches its full productive honey targets.

Across **18 paired baseline/candidate campaigns (36 runs)** the $140 final reward produces **identical purchase, state, milestone and completion traces**. All these buyers skip home cleanup entirely; raising an unreachable later payoff does not change that fixed behavior. This is not proof that a retuned committed leaf strategy cannot exploit it. No paid leaf-only maxing search or matched funding fork for the entire leaf engine was performed, so this report supports a conditional value assessment rather than recommending a final economy change.

Several strong commitments are allowed: the main fully productive honey route, the honey-stop challenger, explicit leaf-only and honey-plus-leaf capacity builds, and concentrated versus mixed industrial staffing. Equal source shares are not the target. Maximum capacity, paid progression and fastest completion remain separate conclusions. Retuning first/second-tier commitment decisions and validating a paid leaf builder would be needed before claiming a campaign-balance improvement from this reward.

Paid purchase legality, conservation, actual honey targets, travel and ending audits pass; each paid suite and the primary capacity suite pass exact seeded replay. Nine normal-gameplay capacity fixtures confirm the main ordering. The campaign terminal-boundary regression and JavaScript syntax checks pass. Source hashes identify the frozen $70 baseline separately from the $140 candidate.

The applied production change passes **203 economy/save invariants**, including real charged cleanup purchases, the $140 display, mixed loose/bagged sales, payout carryover and existing level-three saves in both yards. A fresh main/skipping campaign pair on seed 1401 and an exact replay pass every audit and reproduce the tested candidate's traces. PWA cache-isolation checks also pass.

## Reproduce

Use [cleanup-study.cjs](cleanup-study.cjs), [cleanup-mature.js](cleanup-mature.js) and [numerical evidence](cleanup-study-2026-10-22.json). Raw runs and frozen sources are under \`runs/cleanup-study/\`. The runner supports \`MODE=capacity|mature|paid|prepare\`, \`ARMS\`, \`SEEDS\`, \`KEEP_LEAVES\`, \`SNIPPERS\`, \`DELAYS\`, \`MINUTES\`, \`FIDELITY\`, \`GAME_ROOT\`, \`RESULT_DIR\` and \`REPLAY=1\`. Defaults are capacity, seed 1 and all layouts. \`MODE=prepare\` freezes a candidate with only $70 → $140 changed and refuses to overwrite it. Use separate directories and clear overrides between experiments. Rebuild this report with \`node tools/balance/cleanup-study-report.cjs\` after the named suites exist.
`;
fs.writeFileSync(path.join(__dirname,'cleanup-study.md'),md);
console.log(JSON.stringify({layouts:Object.fromEntries(Object.entries(layouts).map(([k,r])=>[k,{total:r.total,leafRate:r.rate.nL,payback:r.payback,final140:r.rewards[2].finalPayback}])),paid},null,2));
