'use strict';
// Train and validate paid honey-maxing challengers from the main player's earned repair checkpoints.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createRunner}=require('./campaign.cjs'),{audit,compact,replayTrace}=require('./validate.cjs');
const root=path.resolve(__dirname,'../..'),hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const mean=a=>a.reduce((n,x)=>n+x,0)/a.length;
async function main(){
  const output=path.resolve(process.env.RESULT_DIR||'runs/honey-max/training'),mode=process.env.MODE||'train';
  const runner=await createRunner(output),source='if(window.__experimentOptions.byPhase)window.__experimentOptions=window.__experimentOptions.byPhase[window.__phase];\n'+fs.readFileSync(path.join(__dirname,'source-experiment.js'),'utf8');
  const config=JSON.parse(fs.readFileSync(path.join(__dirname,'completion-policy.json'),'utf8'));
  delete config.honeyMax; // Keep the frozen pre-maxing benchmark as the control after promotion.
  const phases=(process.env.PHASES||'4,3').split(',').map(Number),fidelity=process.env.FIDELITY||'sim';
  const results=[],checkpoints=new Map();
  function options(phase,maxHoney,secondary,snippers,bias){return{mode:'paid',phase,focus:'honey',staffing:'specialist',maxHoney,secondary,snippers,bias,packers:2,costPower:.85,payback:8,minutes:90};}
  async function batch(jobs){let ix=0;await Promise.all(Array.from({length:Math.min(3,jobs.length)},async()=>{while(ix<jobs.length){
    const job=jobs[ix++],r=await runner.run({name:job.name,seed:job.seed,config,fidelity,experiment:job.options?{source,options:job.options}:null});
    const issues=[];try{audit(r);}catch(e){issues.push(e.message);}
    const stages=job.options?r.stages.filter(s=>s.experiment?.checkpoint):[],e=stages[0]?.experiment;
    if(job.options){
      assert(e?.checkpoint,'Repair checkpoint not reached');
      if(!job.options.byPhase){const k=r.seed+':'+job.options.phase,sig=hash(e.checkpoint);
        if(checkpoints.has(k))assert.equal(checkpoints.get(k),sig,'Unequal paid checkpoint');else checkpoints.set(k,sig);}
    }
    const requiresMax=!!(job.options?.maxHoney||Object.values(job.options?.byPhase||{}).some(o=>o.maxHoney));
    const row={...compact(r),options:job.options,config,issues,requiresMax,maxed:requiresMax?stages.every(s=>s.experiment.maxed)&&stages.length===(job.options.byPhase?Object.keys(job.options.byPhase).length:1):undefined,
      maxMinute:job.options?.byPhase?Object.fromEntries(stages.map(s=>[s.phase,s.experiment.maxMinute])):e?.maxMinute,
      checkpointHash:e&&hash(e.checkpoint),spend:e?.spend,target:e?.target,maxState:e?.maxState,
      maxStages:stages.map(s=>({phase:s.phase,maxed:s.experiment.maxed,maxMinute:s.experiment.maxMinute,target:s.experiment.target,maxState:s.experiment.maxState,spend:s.experiment.spend,checkpointHash:hash(s.experiment.checkpoint)})),
      afterCheckpoint:e?(r.total-stages[0].offset-e.checkpoint.state.t+stages[0].initial.t)/60:null};
    results.push(row);fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify({mode,manifest:runner.manifest,sourceHash:hash(source),results},null,2));
    console.log(JSON.stringify({name:row.name,seed:row.seed,total:row.totalMinutes,maxed:row.maxed,maxMinute:row.maxMinute,issues}));
  }}));}
  try{
    if(mode==='train'){
      const candidates=phases.flatMap(phase=>[
        options(phase,'full','leaf',0,8),options(phase,'full','leaf',1,16),options(phase,'full','raw',0,8),options(phase,'full','raw',1,16),
        options(phase,'productive','leaf',0,8),options(phase,'productive','raw',1,16)
      ].map((o,i)=>({name:'candidate-'+phase+'-'+i,options:o,seed:1})));
      await batch(candidates);
      const finalists=phases.flatMap(phase=>['full','productive'].map(kind=>results.filter(r=>r.options.phase===phase&&r.options.maxHoney===kind&&r.complete&&r.maxed&&!r.issues.length).sort((a,b)=>a.totalMinutes-b.totalMinutes)[0])).filter(Boolean);
      assert.equal(finalists.length,phases.length*2,'No completing maxed candidate for a yard/target');
      await batch(finalists.flatMap(r=>[2,3].map(seed=>({name:r.name,options:r.options,seed}))));
      for(const r of results)assert(r.complete&&r.maxed&&!r.issues.length,'A training candidate failed; inspect rather than hide it');
      const selected=Object.fromEntries(phases.map(phase=>[phase,Object.fromEntries(['full','productive'].map(kind=>[kind,finalists.find(r=>r.options.phase===phase&&r.options.maxHoney===kind).options]))]));
      fs.writeFileSync(path.join(output,'selected.json'),JSON.stringify(selected,null,2));
      for(const r of finalists)console.log('FINALIST',r.name,mean(results.filter(x=>x.name===r.name).map(x=>x.totalMinutes)));
    }else{
      const selected=JSON.parse(fs.readFileSync(process.env.CONFIG||path.join(__dirname,'selected-honey-max.json'),'utf8'));
      const seeds=(process.env.SEEDS||'901,902,903').split(',').map(Number);
      const combined=process.env.COMBINED==='1';
      const jobs=seeds.flatMap(seed=>[{name:'smart',seed},...phases.flatMap(phase=>['full','productive'].map(kind=>({name:'honey-'+kind+'-'+phase,seed,options:selected[phase][kind]}))),
        ...(combined?['full','productive'].map(kind=>({name:'honey-'+kind+'-both',seed,options:{phases,byPhase:Object.fromEntries(phases.map(phase=>[phase,selected[phase][kind]]))}})):[]),
        {name:'mixed-staff-both',seed,options:{phases,byPhase:Object.fromEntries(phases.map(phase=>[phase,{mode:'paid',phase,focus:'mixed',staffing:'specialist',secondary:'raw',snippers:1,packers:2,keepHoneyStaff:true,minutes:0}]))}}
      ]);
      const arms=process.env.ARMS?.split(',');await batch(arms?jobs.filter(j=>arms.includes(j.name)):jobs);
      for(const r of results)assert(r.complete&&!r.issues.length&&(!r.requiresMax||r.maxed),'Maxing validation failed');
      const first=results.find(r=>r.options&&r.seed===seeds[0]);
      const repeat=await runner.run({name:'replay',seed:first.seed,config,fidelity,experiment:{source,options:first.options}});audit(repeat);
      const original=JSON.parse(fs.readFileSync(path.join(output,first.file),'utf8'));
      assert.equal(replayTrace(original),replayTrace(repeat));
      fs.writeFileSync(path.join(output,'replay.json'),JSON.stringify({identical:true,seed:first.seed,options:first.options}));
    }
  }finally{await runner.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
