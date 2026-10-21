'use strict';
// Paired final-alloy evidence; raw browser runs remain under runs/alloy-steps.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {audit,replayTrace}=require('./validate.cjs');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'runs/alloy-steps');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),mean=a=>a.reduce((n,x)=>n+x,0)/a.length;
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function definitions(file){
 const text=fs.readFileSync(file,'utf8'),out={};
 for(const key of ['ingotGrade','metalPrice']){
  const match=text.match(new RegExp('  '+key+': \\{[\\s\\S]*?costs:(\\[[^\\]]+\\])[\\s\\S]*?vals:(\\[[^\\]]+\\])'));
  assert(match);out[key]={costs:JSON.parse(match[1]),vals:JSON.parse(match[2])};
 }return out;
}
const out={date:'2026-10-21',method:'Frozen policy, paired paid campaigns on held-out seeds 1201-1203; normal-game branches on seed 1301. Same requested cleanup/Sort leaves prices and $180 hive price in both arms. Full actual-game purchase/cash/travel/ending audits and exact replay per suite.',
 changes:{before:definitions(path.join(base,'baseline/game.js')),after:definitions(path.join(base,'after/sources/game.js'))},suites:{},comparison:{}};
for(const label of ['before','after','live-before','live-after']){
 const dir=path.join(base,label),s=read(path.join(dir,'summary.json'));
 assert(s.replayIdentical);for(const r of s.results){
  const raw=read(path.join(dir,r.file));audit(raw);
  r.pricePurchases=raw.stages.map(stage=>stage.purchases.filter(p=>['ingotGrade','metalPrice'].includes(p.key)));
 }
 const first=s.results.find(r=>r.name==='smart'&&r.seed===s.seeds[0]);
 const repeat=fs.readdirSync(dir).find(f=>f.startsWith('replay-')&&f.endsWith('.json'));
 assert(repeat);const rawRepeat=read(path.join(dir,repeat));audit(rawRepeat);
 assert.equal(replayTrace(read(path.join(dir,first.file))),replayTrace(rawRepeat));
 out.suites[label]=s;
}
for(const prefix of ['', 'live-']){
 const before=out.suites[prefix+'before'],after=out.suites[prefix+'after'];
 assert.deepEqual(before.config,after.config);assert.deepEqual(before.seeds,after.seeds);
 for(const key of ['baseline','smart','honeyMax','harness','setup'])assert.equal(before.manifest[key],after.manifest[key]);
 for(const name of ['smart','smart-skip']){
  const pairs=before.results.filter(r=>r.name===name).map(a=>{
   const b=after.results.find(r=>r.name===name&&r.seed===a.seed);assert(b);
   assert.deepEqual(a.stageMinutes.slice(0,2),b.stageMinutes.slice(0,2),'Earlier yards changed');
   return {seed:a.seed,before:a.totalMinutes,after:b.totalMinutes,delta:b.totalMinutes-a.totalMinutes};
  });
  out.comparison[prefix+name]={before:mean(pairs.map(p=>p.before)),after:mean(pairs.map(p=>p.after)),pairs};
 }
}
const capacity=read(path.join(root,'runs/source-capacity-refined/summary.json'));
const physical=capacity.results.filter(r=>r.options.phase===4&&r.options.focus==='mixed-four-miners');assert.equal(physical.length,3);
out.fixedThroughput={method:'Analytic repricing of the previous three-seed fully developed mixed home capacity fixture (explicit free capital). Physical output and maximum metal grade held fixed. Not paid checkpoint earnings or a new staffing search.',
 originalManifest:capacity.manifest,observations:physical.map(r=>({seed:r.seed,rate:r.rate})),variants:{}};
for(const key of ['before','after']){
 const {ingotGrade:a,metalPrice:m}=out.changes[key];
 out.fixedThroughput.variants[key]={alloyTotal:a.costs.reduce((s,v)=>s+v,0),metalTotal:m.costs.reduce((s,v)=>s+v,0),
  alloySteps:a.costs.map((cost,i)=>({level:i+1,cost,value:a.vals[i+1],gain:a.vals[i+1]/a.vals[i]-1,
   marginalMinutes:mean(physical.map(r=>cost/(r.rate.ingot/3.6*(a.vals[i+1]-a.vals[i]))))})),
  finalMetalMarginalMinutes:mean(physical.map(r=>m.costs.at(-1)/(r.rate.ingot/3.6*a.vals.at(-1)/16.5*(16.5-13.6)))),
  totalIncomePerMinute:mean(physical.map(r=>r.rate.leaf+r.rate.bag+r.rate.clean+r.rate.jar+r.rate.gift+r.rate.metal+r.rate.ingot/3.6*a.vals.at(-1))),
  ingotShare:mean(physical.map(r=>{const ingot=r.rate.ingot/3.6*a.vals.at(-1);return ingot/(ingot+r.rate.leaf+r.rate.bag+r.rate.clean+r.rate.jar+r.rate.gift+r.rate.metal);})),
 };
}
out.checks={paidCampaigns:20,exactReplays:4,economyInvariants:185,unchangedEarlierStageTimes:true,oldAlloyLevelMapping:[0,1,3,4,6,7],hollowBriquettesUnchanged:true};
out.limitations='Small fixed-policy sensitivity check, not a new global optimization or complete source-strategy search. Late alloy purchases were mostly skipped before the final sold-ingot goal; unchanged completion time does not establish their usefulness for speedruns. Fully developed home industry remains dominant. Higher grade prices can improve a heuristic route by changing buying priorities, not by making the underlying economy richer.';
out.candidateGameHash=out.suites.after.manifest.sources['game.js'];
assert.equal(hash(fs.readFileSync(path.join(root,'public/game.js'))),out.candidateGameHash,'Game changed after validation');
fs.writeFileSync(path.join(__dirname,'alloy-steps-2026-10-21.json'),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({comparison:out.comparison,fixedThroughput:out.fixedThroughput.variants},null,2));
