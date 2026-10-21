'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createRunner}=require('./campaign.cjs'),{audit,compact,replayTrace}=require('./validate.cjs');
async function main(){
 const output=path.resolve(process.env.RESULT_DIR||'runs/source-route-ablations'),runner=await createRunner(output);
 const source=fs.readFileSync(path.join(__dirname,'route-ablation.js'),'utf8'),config=JSON.parse(fs.readFileSync(path.join(__dirname,'selected-policy.json'),'utf8'));
 const seeds=(process.env.SEEDS||'401,402,403').split(',').map(Number),results=[],jobs=seeds.flatMap(seed=>(process.env.FREEZES||'none,honey,leaf').split(',').map(freeze=>({seed,freeze})));let i=0;
 try{
  await Promise.all(Array.from({length:3},async()=>{while(i<jobs.length){const {seed,freeze}=jobs[i++],r=await runner.run({name:'freeze-'+freeze,seed,config,fidelity:process.env.FIDELITY||'sim',experiment:{source,options:{phases:[0,4],freeze}}});audit(r);results.push(compact(r));fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify({manifest:runner.manifest,results},null,2));}}));
  const repeat=await runner.run({name:'replay',seed:seeds[0],config,fidelity:process.env.FIDELITY||'sim'});audit(repeat);
  const control=JSON.parse(fs.readFileSync(path.join(output,results.find(r=>r.name==='freeze-none'&&r.seed===seeds[0]).file)));
  assert.equal(replayTrace(control),replayTrace(repeat),'Control instrumentation changed the campaign');
  console.log('Paid audits and exact control replay passed.');
 }finally{await runner.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
