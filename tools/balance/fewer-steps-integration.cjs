'use strict';
// Prove the shipping implementation retains the tested proposal's paid economy.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createRunner}=require('./campaign.cjs'),{audit,replayTrace,compact}=require('./validate.cjs');
const prior=JSON.parse(fs.readFileSync(path.join(__dirname,'fewer-steps-2026-10-25.json'),'utf8'));
const config=JSON.parse(fs.readFileSync(path.join(__dirname,'completion-policy.json'),'utf8'));
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// Only the newly added save-schema flag is metadata. Everything else, including
// elapsed time, purchases, roles, inventories and production, must match.
const economic=r=>JSON.stringify(r.stages,(k,v)=>k==='fewerStepsV1'?undefined:v);
(async()=>{
  const out=path.resolve(process.env.RESULT_DIR||'runs/fewer-steps-shipping/campaigns'),runner=await createRunner(out);
  const suite=process.env.SUITE||'heldout',fidelity=suite==='live'?'live':'sim';
  const saved=prior.suites['candidate/'+suite],seeds=(process.env.SEEDS||saved.rows.map(r=>r.seed).filter((v,i,a)=>a.indexOf(v)===i).join(',')).split(',').map(Number);
  const names=(process.env.POLICIES||(suite==='live'?'smart,smart-skip':'smart,smart-skip,smart-balanced')).split(',');
  const jobs=seeds.flatMap(seed=>names.map(name=>({name,seed,config,fidelity}))),rows=[];let ix=0;
  try{
    if(process.env.REPLAY_ONLY==='1'){
      const savedSummary=JSON.parse(fs.readFileSync(path.join(out,'summary.json'),'utf8')),first=jobs[0];
      const original=JSON.parse(fs.readFileSync(path.join(out,savedSummary.rows.find(x=>x.name===first.name&&x.seed===first.seed).file),'utf8'));
      const repeated=await runner.run({...first,name:'replay'});audit(repeated);
      assert.equal(replayTrace(original),replayTrace(repeated));
      fs.writeFileSync(path.join(out,'replay.json'),JSON.stringify({identical:true,seed:first.seed}));
      console.log('Independent shipping replay exactly matches the saved campaign.');return;
    }
    await Promise.all(Array.from({length:3},async()=>{while(ix<jobs.length){
      const r=await runner.run(jobs[ix++]);r.audit=audit(r);
      const original=saved.rows.find(x=>x.name===r.name&&x.seed===r.seed);assert(original,'No frozen comparison');
      assert.equal(hash(economic(r)),original.traceHash,'Shipping economic trace differs: '+r.name+' '+r.seed);
      rows.push({...compact(r),economicHash:hash(economic(r)),audit:r.audit});
    }}));
    const first=jobs[0];
    const initial=JSON.parse(fs.readFileSync(path.join(out,rows.find(x=>x.name===first.name&&x.seed===first.seed).file),'utf8'));
    const again=await runner.run({...first,name:'replay'});audit(again);
    assert.equal(replayTrace(initial),replayTrace(again));
    const result={date:'2026-10-25',suite,manifest:runner.manifest,config,replayIdentical:true,economicTracesIdentical:true,rows};
    fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(result,null,2));
    console.log(rows.length+' shipping campaigns match frozen proposal economics; exact replay passed.');
  }finally{await runner.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
