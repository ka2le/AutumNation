'use strict';
// Rebuild the committed evidence from explicitly named suites, never a directory glob.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {audit}=require('./validate.cjs');
const root=path.resolve(__dirname,'../..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const mean=a=>a.reduce((n,x)=>n+x,0)/a.length;
const stat=a=>({mean:mean(a),min:Math.min(...a),max:Math.max(...a),n:a.length});
const groups=rows=>Object.fromEntries([...new Set(rows.map(r=>r.options.phase+':'+r.options.focus))].map(key=>{
 const a=rows.filter(r=>r.options.phase+':'+r.options.focus===key),[phase,focus]=key.split(':');
 return[key,{phase:+phase,focus,n:a.length,afterCheckpoint:stat(a.map(r=>r.afterCheckpointMinutes)),
  window:stat(a.map(r=>r.windowMinutes)),earned:stat(a.map(r=>r.earned)),cashChange:stat(a.map(r=>r.cashChange)),
  income:Object.fromEntries(Object.keys(a[0].rate).map(k=>[k,stat(a.map(r=>r.rate[k]))])),
  spend:Object.fromEntries(Object.keys(a[0].spend).map(k=>[k,mean(a.map(r=>r.spend[k]))])),
  localGoal:stat(a.map(r=>r.events.find(e=>e.id===(+phase===4?'ingotsGoal':'coal100'))?.minutes).filter(Number.isFinite))}];
}));
const streams=r=>({leaf:r.leaf+r.bag+r.clean,honey:r.jar+r.gift,raw:r.metal,finished:r.ingot});
function campaignSuite(dir){
 const s=read(dir+'/summary.json'),rows=s.results.map(r=>{const raw=read(dir+'/'+r.file);audit(raw);return r;});
 return{manifest:s.manifest,rows,groups:Object.fromEntries([...new Set(rows.map(r=>r.name))].map(name=>{const a=rows.filter(r=>r.name===name);return[name,{total:stat(a.map(r=>r.totalMinutes)),stages:[0,1,2].map(i=>stat(a.map(r=>r.stageMinutes[i])))}];}))};
}
function main(){
 const paid=read('runs/source-paid-final/summary.json');assert.equal(paid.results.length,48);
 const capDirs=['runs/source-capacity','runs/source-capacity-refined'];
 const capacity=capDirs.flatMap(dir=>read(dir+'/summary.json').results.map(r=>({...r,dir})));
 assert.equal(capacity.length,60);
 for(const row of paid.results)audit(read('runs/source-paid-final/'+row.file));
 const checkpointSets={};for(const row of paid.results){const k=row.seed+':'+row.options.phase;(checkpointSets[k]??=new Set()).add(row.checkpointHash);}
 assert(Object.values(checkpointSets).every(s=>s.size===1),'Checkpoint pairing failed');
 const priceRows=[];
 for(const phase of [4,3]){
  const rows=capacity.filter(r=>r.options.phase===phase&&r.options.focus==='mixed-four-miners');
  for(const row of rows){
   const raw=read(row.dir+'/'+row.file),e=raw.stages.find(s=>s.phase===phase).experiment,L=e.priceLadders,r=row.rate;
   const revenue={leafPrice:r.leaf+r.bag,bagPrice:r.bag,honeyPrice:r.jar+r.gift,giftPrice:r.gift,metalPrice:r.metal+r.ingot,ingotGrade:r.ingot};
   for(const [key,value] of Object.entries(revenue)){
    const u=L[key],level=u.values.length-1,gain=value*(u.values[level]-u.values[level-1])/u.values[level];
    priceRows.push({phase,seed:row.seed,key,cost:u.costs.at(-1),ladderCost:u.costs.reduce((a,b)=>a+b,0),gainPerMinute:gain,paybackMinutes:u.costs.at(-1)/gain});
   }
   const u=L.cleanup,gain=r.nL*(u.values.at(-1)-u.values.at(-2))/100;
   priceRows.push({phase,seed:row.seed,key:'cleanup',cost:u.costs.at(-1),ladderCost:u.costs.reduce((a,b)=>a+b,0),gainPerMinute:gain,paybackMinutes:u.costs.at(-1)/gain});
  }
 }
 const compact=r=>({file:r.file,seed:r.seed,options:r.options,checkpointHash:r.checkpointHash,checkpointMinute:r.checkpointMinute,
  complete:r.complete,totalMinutes:r.totalMinutes,afterCheckpointMinutes:r.afterCheckpointMinutes,experimentFinished:r.experimentFinished,
  windowMinutes:r.windowMinutes,earned:r.earned,cashChange:r.cashChange,rate:r.rate,spend:r.spend,finalWindow:r.finalWindow,events:r.events});
 const out={date:'2026-10-21',game:paid.manifest.sources,method:{
  paid:'48 full paid campaigns, three paired seeds, two real repair unlocks, eight priorities. Source focus lasts 20 minutes then the frozen reference finishes. No injected progress or capital.',
  capacity:'60 fixtures, three seeds, two yards, ten staffed layouts. Same earned prefix and owned land; explicitly granted capital, real capped upgrades; 5 minute settling, 10 minute sales measurement. Capacity is not paid progression.',
  payback:'Exact last-tier price gain at observed fixed physical sales volume, other prices fully upgraded. Excludes setup cost and assumes this volume persists; not a causal throughput test.',
  limits:'Finite policy/layout search, not proven optimal. Three paired seeds per source comparison. Future random streams diverge after decisions. Main campaign shortcuts additionally checked on normal gameplay branches. No rendering, UI timers or cinematic.'},
  sourceTraining:read('runs/source-search-final/search.json'),selected:read('tools/balance/selected-source-policies.json'),
  paid:{manifest:paid.manifest,rows:paid.results.map(compact),groups:groups(paid.results)},
  capacity:{manifests:capDirs.map(dir=>read(dir+'/summary.json').manifest),rows:capacity.map(compact),groups:groups(capacity)},
  prices:priceRows,
  honeyDiscovery:campaignSuite('runs/source-route-ablations'),honeyConfirmation:campaignSuite('runs/source-honey-confirm'),honeyLive:campaignSuite('runs/source-honey-live'),
  excavationConfirmation:campaignSuite('runs/source-excavation-confirm'),excavationLive:campaignSuite('runs/source-excavation-live'),
  supportingFixtures:['runs/source-capacity-snip0','runs/source-capacity-layout-search','runs/source-no-excavation'].map(dir=>({dir,...read(dir+'/summary.json')}))};
 // Every published result used the same actual game source.
 for(const s of [out.honeyDiscovery,out.honeyConfirmation,out.honeyLive,out.excavationConfirmation,out.excavationLive])assert.deepEqual(s.manifest.sources,out.game);
 fs.writeFileSync(path.join(__dirname,'source-benchmark-2026-10-21.json'),JSON.stringify(out,null,2)+'\n');
 for(const phase of [4,3]){
  console.log('\nYard',phase,'paid');
  for(const g of Object.values(out.paid.groups).filter(g=>g.phase===phase))console.log(g.focus,g.afterCheckpoint.mean.toFixed(2),'goal',g.localGoal.mean.toFixed(2),'earned',g.earned.mean.toFixed(0));
  console.log('capacity');
  for(const g of Object.values(out.capacity.groups).filter(g=>g.phase===phase)){const r=Object.fromEntries(Object.entries(g.income).map(([k,s])=>[k,s.mean]));console.log(g.focus,streams(r));}
  console.log('last-tier payback');for(const key of [...new Set(priceRows.map(r=>r.key))]){const a=priceRows.filter(r=>r.phase===phase&&r.key===key);console.log(key,a[0].cost,mean(a.map(r=>r.paybackMinutes)).toFixed(2));}
 }
}
if(require.main===module)main();
