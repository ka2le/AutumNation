'use strict';
// Validate the shipped clock against the frozen 60 Hz study and its 1.2 override.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {runnerFor,files,sha}=require('./pacing-study.cjs'),{audit,replayTrace}=require('./validate.cjs');
const root=path.resolve(__dirname,'../..'),out=path.resolve(process.env.RESULT_DIR||'runs/pacing-integration/campaigns');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const normalize=x=>JSON.parse(JSON.stringify(x,(k,v)=>k==='realT'||k==='runRealT'?undefined:v));
async function main(){
 const config=read(path.join(__dirname,'completion-policy.json')),archiveDir=path.join(root,'runs/pacing-study/fixed-wall-60-sim');
 const archive=fs.existsSync(path.join(archiveDir,'summary.json'))?read(path.join(archiveDir,'summary.json')):null;
 const evidenceFile=path.join(__dirname,'pacing-integration-2026-10-23.json'),evidence=fs.existsSync(evidenceFile)?read(evidenceFile):null;
 const testRoot=path.join(out,'duration-1.2'),runners={},summary={seeds:[1701,1702,1703],pairs:[],sourceHashes:Object.fromEntries(files.map(f=>[f,sha(fs.readFileSync(path.join(root,'public',f)))]))};
 assert(!fs.existsSync(testRoot),'Use a fresh RESULT_DIR');
 for(const f of files){const p=path.join(testRoot,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.copyFileSync(path.join(root,'public',f),p);}
 const game=path.join(testRoot,'game.js'),s=fs.readFileSync(game,'utf8');assert.equal(s.split('let WORLD_DURATION =').length,2);fs.writeFileSync(game,s.replace('let WORLD_DURATION =',"sessionStorage.setItem(DURATION_KEY, '1.2');\nlet WORLD_DURATION ="));
 const {createRunner,adapterHash}=runnerFor('wall',60);summary.adapterHash=adapterHash;
 try{
  process.env.GAME_ROOT=path.join(root,'public');runners.normal=await createRunner(path.join(out,'normal'));
  process.env.GAME_ROOT=testRoot;runners.slow=await createRunner(path.join(out,'slow'));
  const jobs=summary.seeds.flatMap(seed=>['smart','smart-skip','smart-balanced'].map(name=>({seed,name})));let ix=0;
  await Promise.all(Array.from({length:3},async()=>{
   while(ix<jobs.length){const j=jobs[ix++],results={};
    for(const arm of ['normal','slow']){const r=await runners[arm].run({...j,config,maxMinutes:180});audit(r);results[arm]=r;}
    const trace=r=>normalize(r.stages.map(s=>({elapsed:s.elapsed,state:s.state,purchases:s.purchases,events:s.events,source:s.source,samples:s.samples,diagnostics:s.diagnostics})));
    assert.deepEqual(trace(results.normal),trace(results.slow),'Economic trace changed with duration');
    const baselineTraceHash=sha(trace(results.normal));
    if(archive){const reference=archive.rows.find(r=>r.arm==='baseline'&&r.name===j.name&&r.seed===j.seed),before=read(path.join(archiveDir,'baseline',reference.file));assert.deepEqual(trace(results.normal),trace(before),'Normal 60 Hz pace changed from study');}
    else{const expected=evidence?.pairs.find(r=>r.name===j.name&&r.seed===j.seed);assert.equal(baselineTraceHash,expected?.baselineTraceHash,'Normal 60 Hz pace changed from versioned study');}
    const real=r=>r.stages.reduce((n,s)=>n+s.pace.realSeconds,0),ratio=real(results.slow)/real(results.normal);assert(Math.abs(ratio-1.2)<1e-5);
    summary.pairs.push({...j,normalMinutes:real(results.normal)/60,slowMinutes:real(results.slow)/60,spent:results.normal.stages.reduce((n,s)=>n+s.purchases.reduce((m,p)=>m+p.cost,0),0),ratio,baselineTraceHash,economyIdentical:true,normalMatchesFrozenBaseline:true,files:{normal:results.normal.file,slow:results.slow.file}});
    fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2));console.log('INTEGRATION',j.name,j.seed,'unchanged baseline and economy; ratio',ratio);
   }
  }));
  const first=summary.pairs.find(r=>r.name==='smart'&&r.seed===1701),original=read(path.join(out,'slow',first.files.slow)),repeat=await runners.slow.run({name:'replay',seed:1701,config,maxMinutes:180});audit(repeat);assert.equal(replayTrace(original),replayTrace(repeat));summary.exactReplay=true;fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2));console.log('Shipped pacing campaign validation and exact replay passed.');
 }finally{for(const r of Object.values(runners))await r.close();delete process.env.GAME_ROOT;}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
