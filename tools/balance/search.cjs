'use strict';
// Whole-campaign policy search. Screening and selection seeds are disjoint from validation.
// Failures are penalized, never silently removed from the objective.
const fs=require('node:fs'),path=require('node:path');
const {createRunner}=require('./campaign.cjs');
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
function candidates(count=24) {
  const out=[{}];let rng=481516;
  const pick=a=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return a[Math.floor(rng/4294967296*a.length)];};
  for(let i=1;i<count;i++)out.push({
    growth:pick([1,2,4,8]), helpers:pick([1,2,4,8]), goals:pick([2,5,10,20]),
    research:pick([2,5,10]), industry:pick([1,3,6]), prices:pick([1,2,4]),
    costPower:pick([.75,1,1.15]), payback:pick([3,5,8]), packers:pick([1,2]),
    researchCrew:pick([2,3]), bankIncome:pick([15,25,40,1e9]),
    readiness:pick(['all','gathering']), finalPolicy:pick(['legacy','legacy','smart']), endHorizon:3,
    freezeHomeHoneyAfterGoal:pick([false,true])
  });
  return out;
}
function crossovers(input) {
  const entries=JSON.parse(fs.readFileSync(input,'utf8')).entries;
  const good=entries.filter(e=>e.runs.every(r=>r.complete));
  const best=phase=>[...good].sort((a,b)=>mean(a.runs.map(r=>r.stages[phase]))-mean(b.runs.map(r=>r.stages[phase]))).slice(0,2);
  const out=[];
  for(const home of best(0))for(const hollow of best(1))for(const final of best(2))for(const skillStaffing of [false,true]){
    out.push({phases:{0:home.config,3:hollow.config,4:{...final.config,skillStaffing}}});
  }
  // Keep the best whole policy as a control against misleading stage-local wins.
  out.unshift(good.sort((a,b)=>mean(a.runs.map(r=>r.total))-mean(b.runs.map(r=>r.total)))[0].config);
  return out;
}
async function main(){
  const output=path.resolve(process.env.RESULT_DIR||'runs/smart-search');
  const configs=process.env.CROSSOVER_FROM?crossovers(process.env.CROSSOVER_FROM):candidates(+(process.env.CANDIDATES||24));
  const runner=await createRunner(output), entries=configs.map((config,i)=>({name:'candidate'+i,config,runs:[]}));
  const record=()=>fs.writeFileSync(path.join(output,'search.json'),JSON.stringify({trainingSeeds:[1,2,3],validationSeeds:[101,102,103,104,105,106],entries},null,2));
  const score=e=>mean(e.runs.map(r=>r.complete?r.total:1e9));
  async function batch(jobs){let ix=0;await Promise.all(Array.from({length:Math.min(3,jobs.length)},async()=>{
    while(ix<jobs.length){const {entry,seed}=jobs[ix++];const r=await runner.run({name:entry.name,config:entry.config,seed});entry.runs.push({seed,total:r.total,complete:r.complete,errors:r.errors,stages:r.stages.map(s=>s.elapsed)});record();}
  }));}
  try{
    await batch(entries.map(entry=>({entry,seed:1})));
    const finalists=entries.filter(e=>e.runs[0].complete).sort((a,b)=>score(a)-score(b)).slice(0,5);
    if(!finalists.length)throw Error('No completing candidate');
    await batch(finalists.flatMap(entry=>[2,3].map(seed=>({entry,seed}))));
    finalists.sort((a,b)=>score(a)-score(b));
    const selected=finalists[0];fs.writeFileSync(path.join(output,'selected.json'),JSON.stringify(selected.config,null,2));
    console.log('SELECTED',selected.name,(score(selected)/60).toFixed(2),JSON.stringify(selected.config));
  }finally{await runner.close();}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={candidates,crossovers};
