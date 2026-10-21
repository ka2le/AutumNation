'use strict';
// Train source strategies on seed 1, then score the two best staffing/bias
// candidates per focus on seeds 2 and 3. Holdout seeds belong to sources.cjs.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createRunner}=require('./campaign.cjs'),{audit}=require('./validate.cjs');
async function main(){
 const output=path.resolve(process.env.RESULT_DIR||'runs/source-search'),runner=await createRunner(output);
 const source=fs.readFileSync(path.join(__dirname,'source-experiment.js'),'utf8'),config=JSON.parse(fs.readFileSync(path.join(__dirname,'selected-policy.json'),'utf8'));
 const phase=+(process.env.PHASE||4),focuses=['mixed','leaf','honey','raw','industry','skip-honey','skip-leaf'];
 const candidates=focuses.flatMap(focus=>(process.env.STAFFINGS||'main').split(',').flatMap(staffing=>[4,8,16].map(bias=>({phase,mode:'paid',focus,staffing,bias,costPower:.85,payback:8,minutes:20,secondary:'leaf'}))));
 const results=[],hashes=new Map();
 async function batch(jobs){let i=0;await Promise.all(Array.from({length:3},async()=>{while(i<jobs.length){const job=jobs[i++],r=await runner.run({name:`train-${job.options.focus}-${job.options.staffing}-${job.options.bias}`,seed:job.seed,config,experiment:{source,options:job.options}});audit(r);const e=r.stages.find(s=>s.phase===phase).experiment;assert(e?.checkpoint);const sig=JSON.stringify(e.checkpoint);if(hashes.has(r.seed))assert.equal(sig,hashes.get(r.seed));else hashes.set(r.seed,sig);results.push({options:job.options,seed:r.seed,file:r.file,minutes:r.total/60,spent:e.spend});fs.writeFileSync(path.join(output,'search.json'),JSON.stringify({manifest:runner.manifest,results},null,2));}}));}
 try{
  await batch(candidates.map(options=>({seed:1,options})));
  const finalists=focuses.flatMap(focus=>results.filter(r=>r.options.focus===focus).sort((a,b)=>a.minutes-b.minutes).slice(0,2).map(r=>r.options));
  await batch(finalists.flatMap(options=>[2,3].map(seed=>({seed,options}))));
  const key=o=>JSON.stringify(o),selected={};
  for(const focus of focuses){const rows=finalists.filter(o=>o.focus===focus).map(options=>({options,mean:results.filter(r=>key(r.options)===key(options)).reduce((n,r)=>n+r.minutes,0)/3})).sort((a,b)=>a.mean-b.mean);selected[focus]=rows[0].options;console.log(focus,rows.map(r=>({mean:r.mean,staffing:r.options.staffing,bias:r.options.bias})));}
  fs.writeFileSync(path.join(output,'selected.json'),JSON.stringify({[phase]:selected},null,2));
 }finally{await runner.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
