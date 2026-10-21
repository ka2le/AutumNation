'use strict';
// Rebuild the October 21 tuning evidence from explicitly named suites.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {audit,replayTrace,compact}=require('./validate.cjs');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'runs/economy-tuning');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const mean=a=>a.reduce((n,v)=>n+v,0)/a.length;
function suite(label,variant,capacity=false){
  const dir=path.join(base,label,variant),s=read(path.join(dir,'summary.json'));
  for(const row of s.results){
    const raw=read(path.join(dir,row.file));
    if(!capacity)audit(raw);
    else assert(raw.errors.length===0&&raw.stages.some(s=>s.experiment?.finished),'Unfinished capacity fixture');
    if(!row.options){
      row.config=raw.config;
      row.purchaseGroups=raw.stages.map(s=>Object.fromEntries(['cleanup','ingotGrade','hiveUp'].map(key=>{
        const buys=s.purchases.filter(p=>p.key===key||p.id===key);
        return[key,{count:buys.length,cost:buys.reduce((n,p)=>n+p.cost,0)}];
      })));
    }
  }
  if(s.results[0].options){
    const checkpoints=new Map();
    for(const r of s.results){const k=r.seed+':'+r.options.phase;if(checkpoints.has(k))assert.equal(checkpoints.get(k),r.checkpointHash);else checkpoints.set(k,r.checkpointHash);}
  }
  return s;
}
const out={date:'2026-10-21',selected:'combined140',
  changes:{homeCleanup:{before:[400,2200,4000],after:[200,350,530]},alloy:{before:[1.45,1.75,2.15,2.6,3.1,3.6],after:[1.45,1.75,2.07,2.43,2.83,3.23],costs:[360,6000,14000,23000,36000]},hiveUp:{before:180,after:140}},
  method:'Paid actual-game campaigns. Skip and develop share excavation and all settings except the home honey freeze. Candidate and staffing training seeds 1-3 precede selection; held-out campaign seeds 701-703 and normal-path seed 801. Paid repair-window priorities use held-out seed 701. Explicit free-capital capacity fixtures are separate. Frozen combined source differs from delivered game only in comments/whitespace.',
  limitations:'Finite quick comparison, not a global optimizer. Paid source and capacity comparisons use one seed each; no claim of precise population effects. Cheaper purchases can alter heuristic decisions, so a worse run does not mean the cheaper offer is intrinsically worse. Five-minute cleanup target uses the previous three-seed developed leaf rate, not early-game throughput.',
  training:{},validation:{},live:{},paid:{},capacity:{},cleanupPayback:[]};
for(const v of ['baseline','cleanup','alloy','hive120','hive140','hive160'])out.training['screen/'+v]=suite('screen',v);
for(const v of ['hive120','hive140','hive160'])out.training['hive-training/'+v]=suite('hive-training',v);
for(const v of ['baseline','combined140','combined160'])out.training['policy-training/'+v]=suite('policy-training',v);
for(const v of ['baseline','hive120','hive140','hive160'])out.training['honey-priority/'+v]=suite('honey-priority',v);
for(const v of ['baseline','combined140']){
  out.validation[v]=suite('validation',v);out.live[v]=suite('live-validation',v);
  for(const label of ['validation','live-validation'])assert(read(path.join(base,label,v,'replay.json')).identical);
  out.paid[v]=suite('paid-validation',v);out.capacity[v]=suite('capacity',v,true);
}
for(const label of ['paid','capacity'])for(const before of out[label].baseline.results){
  const after=out[label].combined140.results.find(r=>r.seed===before.seed&&r.options.phase===before.options.phase&&r.options.focus===before.options.focus);
  assert(after);assert.equal(after.checkpointHash,before.checkpointHash,'Changed starting checkpoint');
  if(label==='capacity')for(const key of Object.keys(before.rate).filter(k=>k.startsWith('n')))
    assert.equal(after.rate[key],before.rate[key],'Changed physical capacity: '+key);
}
const old=read(path.join(root,'runs/source-capacity-refined/summary.json')).results.filter(r=>r.options.phase===4&&r.options.focus==='mixed-four-miners');
for(let i=0;i<3;i++){
  const delta=[18,24,28][i],a=[400,2200,4000][i],b=[200,350,530][i];
  out.cleanupPayback.push({tier:i+1,oldCost:a,newCost:b,oldMinutes:mean(old.map(r=>a/(r.rate.nL*delta/100))),newMinutes:mean(old.map(r=>b/(r.rate.nL*delta/100))),leafRates:old.map(r=>({seed:r.seed,leavesPerMinute:r.rate.nL}))});
}
const finalSource=fs.readFileSync(path.join(base,'default-smoke/sources/game.js'),'utf8');
out.deliveredGameHash=crypto.createHash('sha256').update(finalSource).digest('hex');
const smoke=read(path.join(base,'default-smoke/smart-701-57dbca7366.json'));audit(smoke);
const frozenRow=out.validation.combined140.results.find(r=>r.seed===701&&r.name==='skip');
assert.equal(replayTrace(smoke),replayTrace(read(path.join(base,'validation/combined140',frozenRow.file))));
assert.equal(smoke.manifest.sources['game.js'],out.deliveredGameHash);
out.defaultSmoke={...compact(smoke),manifest:smoke.manifest,identicalToValidatedCandidate:true};
out.runCounts={paid:Object.values(out.training).reduce((n,s)=>n+s.results.length,0)+Object.values(out.validation).reduce((n,s)=>n+s.results.length,0)+Object.values(out.live).reduce((n,s)=>n+s.results.length,0)+Object.values(out.paid).reduce((n,s)=>n+s.results.length,0)+4+1,capacity:Object.values(out.capacity).reduce((n,s)=>n+s.results.length,0)};
assert.equal(out.runCounts.paid,66);assert.equal(out.runCounts.capacity,12);
// Compare exact sources after removing only full-line comments and the two edited declaration comments.
const canonical=s=>s.replace(/\r\n/g,'\n').replace(/^\s*\/\/[^\n]*\n/gm,'')
  .replace(/^(const HIVE_UP_COST = \d+;)[^\n]*/gm,'$1')
  .replace(/^(\s*cleanup:.*costs:\[[^\]]*\],)[^\n]*/gm,'$1');
assert.equal(canonical(finalSource),canonical(fs.readFileSync(path.join(base,'games/combined140/game.js'),'utf8')),'Delivered game differs from validated candidate');
const vm=require('node:vm');new vm.Script(finalSource);
out.checks={economyInvariants:158,exactReplay:true,legalPaidCampaigns:true,matchedSourceCheckpoints:true};
fs.writeFileSync(path.join(__dirname,'economy-tuning-2026-10-21.json'),JSON.stringify(out,null,2)+'\n');
for(const [label,sets]of Object.entries({validation:out.validation,live:out.live}))for(const[v,s]of Object.entries(sets))for(const p of ['skip','develop']){
  const rows=s.results.filter(r=>r.name===p);console.log(label,v,p,mean(rows.map(r=>r.totalMinutes)).toFixed(2));
}
for(const[v,s]of Object.entries(out.paid))for(const r of s.results)console.log('paid',v,r.options.phase,r.options.focus,'remaining',r.afterCheckpointMinutes.toFixed(2),'honey/min',(r.rate.jar+r.rate.gift).toFixed(2));
for(const[v,s]of Object.entries(out.capacity))for(const r of s.results){const income=r.rate.leaf+r.rate.bag+r.rate.clean+r.rate.jar+r.rate.gift+r.rate.metal+r.rate.ingot;console.log('capacity',v,r.options.phase,r.options.focus,income.toFixed(0),'ingotShare',(r.rate.ingot/income*100).toFixed(2));}
console.log('cleanup',out.cleanupPayback);
