'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createRunner}=require('./campaign.cjs');
function audit(r) {
  assert(r.complete,'Campaign did not finish');assert.deepEqual(r.errors,[]);
  assert.deepEqual(r.stages.map(s=>[s.phase,s.lot]),[[0,'home'],[3,'hollow'],[4,'home']]);
  let maxCashError=0;
  for(const s of r.stages){
    const paid=s.purchases.reduce((sum,p)=>sum+p.cost,0);
    const error=Math.abs(s.initial.cash+s.state.totals.cash-s.initial.totals.cash-paid-s.state.cash);
    maxCashError=Math.max(maxCashError,error);assert(error<1e-5,'Cash conservation failed');
    assert(s.elapsed>0);assert(s.state.cash>=-1e-7);
    assert(s.purchases.every(p=>Number.isFinite(p.cost)&&p.cost>0&&p.t>=0&&p.t<=s.elapsed));
    assert(s.events.every(e=>e.t>=0&&e.t<=s.elapsed));
  }
  const [home,hollow,final]=r.stages;
  assert.equal(home.initial.cash,0);assert.equal(home.initial.robots.length,1);
  assert.equal(hollow.initial.cash,0,'Hollow must start with zero money');
  assert.equal(hollow.initial.robots.length,1);assert.equal(hollow.initial.blowers.length,1);
  assert.equal(hollow.initial.totals.cash,0,'Hollow revenue was injected');
  const traveller=home.state.robots.find(c=>c.away==='hollow');assert(traveller);
  assert.deepEqual(hollow.initial.robots[0].lv,traveller.lv,'Lost/gained travelling skills');
  assert(Math.abs(final.initial.cash-home.state.cash)<1e-6,'Returning yard gained unearned cash');
  assert.equal(final.initial.totals.cash,home.state.totals.cash,'Inactive yard earned unmodeled income');
  assert(home.state.flags.snipKnown&&home.state.miles.qTinker!=null&&home.state.miners.length&&home.state.land>=1);
  assert(hollow.state.flags.fireDone&&hollow.state.flags.coalKnown&&hollow.state.miles.coalSold!=null);
  assert(final.state.miles.ingots!=null&&final.state.flags.ending===2,'Completion must be the actual ending trigger');
  return {maxCashError,purchases:r.stages.reduce((n,s)=>n+s.purchases.length,0)};
}
const compact=r=>({file:r.file,name:r.name,seed:r.seed,fidelity:r.fidelity,complete:r.complete,totalMinutes:r.total/60,
  stageMinutes:r.stages.map(s=>s.elapsed/60),events:r.stages.map(s=>s.events.map(e=>({id:e.id,minute:e.t/60}))),
  earned:r.stages.map(s=>s.state.totals.cash-s.initial.totals.cash),spent:r.stages.map(s=>s.purchases.reduce((n,p)=>n+p.cost,0)),
  endCash:r.stages.map(s=>s.state.cash),purchaseCounts:r.stages.map(s=>s.purchases.length)});
const replayTrace=r=>JSON.stringify(r.stages.map(s=>({elapsed:s.elapsed,events:s.events,purchases:s.purchases,state:s.state})));
async function main(){
  const output=path.resolve(process.env.RESULT_DIR||'runs/smart-validation');
  const config=JSON.parse(fs.readFileSync(process.env.CONFIG||path.join(__dirname,'selected-policy.json'),'utf8'));
  const runner=await createRunner(output), results=[], seeds=(process.env.SEEDS||'101,102,103,104,105,106').split(',').map(Number);
  const policies=(process.env.POLICIES||'legacy,legacy-goal,legacy-industrial,smart').split(',');
  assert(policies.includes('smart'),'Validation needs the smart policy for replay');
  const fidelity=process.env.FIDELITY||'sim',jobs=seeds.flatMap(seed=>policies.map(name=>({name,seed,config:name==='smart'?config:{},fidelity})));
  let ix=0;
  try{
    await Promise.all(Array.from({length:Math.min(3,jobs.length)},async()=>{
      while(ix<jobs.length){const r=await runner.run(jobs[ix++]);r.audit=audit(r);results.push(r);}
    }));
    const first=results.find(r=>r.name==='smart'&&r.seed===seeds[0]);
    const repeat=await runner.run({name:'replay',seed:seeds[0],config,fidelity});audit(repeat);
    assert.equal(replayTrace(first),replayTrace(repeat),'Seeded replay diverged');
    const summary={manifest:runner.manifest,config,fidelity,seeds,replayIdentical:true,
      cashConservationMaxError:Math.max(...results.map(r=>r.audit.maxCashError)),results:results.map(compact).sort((a,b)=>a.seed-b.seed||a.name.localeCompare(b.name))};
    fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(summary,null,2));
    for(const name of policies){const rows=results.filter(r=>r.name===name);console.log(name,'mean minutes',rows.reduce((n,r)=>n+r.total/60,0)/rows.length);}
    console.log('All paid campaign, goal, travel, return-save, and exact seeded-replay checks passed.');
  }finally{await runner.close();}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={audit,compact,replayTrace};
