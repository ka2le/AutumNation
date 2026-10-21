'use strict';
// Small paired balance experiments. Freeze public/ before editing it; every run uses real paid actions.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createRunner}=require('./campaign.cjs');
const {audit,compact,replayTrace}=require('./validate.cjs');
const root=path.resolve(__dirname,'../..'),output=path.resolve(process.env.RESULT_DIR||'runs/economy-tuning');
const files=['game.js','lots/hollow.js','lots/prairie.js','index.html','style.css','audio.js','ending.js','tips.js'];
const variants={baseline:{},cleanup:{cleanup:true},alloy:{alloy:true},hive120:{hive:120},hive140:{hive:140},hive160:{hive:160},
  combined120:{cleanup:true,alloy:true,hive:120},combined140:{cleanup:true,alloy:true,hive:140},combined160:{cleanup:true,alloy:true,hive:160}};
function replaceOnce(s,a,b){assert.equal(s.split(a).length,2,'Balance source drift: '+a);return s.replace(a,b);}
function prepare(){
  const baseline=path.join(output,'games/baseline');
  assert(!fs.existsSync(baseline),'Refusing to overwrite a frozen baseline');
  const sourceRoot=path.resolve(process.env.GAME_ROOT||path.join(root,'public'));
  const original=fs.readFileSync(path.join(sourceRoot,'game.js'),'utf8');
  // These are the October 21 pre-tuning inputs, not assumptions about later game versions.
  for(const anchor of ['costs:[400, 2200, 4000]','vals:[1.45, 1.75, 2.15, 2.6, 3.1, 3.6]','const HIVE_UP_COST = 180;'])
    assert.equal(original.split(anchor).length,2,'Supply the pre-tuning game with GAME_ROOT: '+anchor);
  for(const [name,v]of Object.entries(variants)){
    const dest=path.join(output,'games',name);fs.mkdirSync(path.join(dest,'lots'),{recursive:true});
    for(const f of files)fs.copyFileSync(path.join(sourceRoot,f),path.join(dest,f));
    let s=fs.readFileSync(path.join(dest,'game.js'),'utf8');
    if(v.cleanup)s=replaceOnce(s,'costs:[400, 2200, 4000]','costs:[200, 350, 530]');
    // Reduce each of the last four alloy increments by 20%; keep the first upgrade and every price.
    if(v.alloy)s=replaceOnce(s,'vals:[1.45, 1.75, 2.15, 2.6, 3.1, 3.6]','vals:[1.45, 1.75, 2.07, 2.43, 2.83, 3.23]');
    if(v.hive)s=replaceOnce(s,'const HIVE_UP_COST = 180;','const HIVE_UP_COST = '+v.hive+';');
    fs.writeFileSync(path.join(dest,'game.js'),s);
  }
  fs.writeFileSync(path.join(output,'variants.json'),JSON.stringify(variants,null,2));
}
async function main(){
  if(process.argv.includes('--prepare')){prepare();return;}
  const seeds=(process.env.SEEDS||'1').split(',').map(Number);
  const names=(process.env.VARIANTS||'baseline,cleanup,alloy,hive120,hive140,hive160').split(',');
  const policies=(process.env.POLICIES||'skip,develop').split(',');
  const config=JSON.parse(fs.readFileSync(path.join(__dirname,'completion-policy.json'),'utf8'));
  delete config.honeyMax; // Reproduce this historical price experiment's pre-maxing player.
  const fidelity=process.env.FIDELITY||'sim',label=process.env.LABEL||'screen';
  for(const name of names){
    assert(variants[name],'Unknown frozen variant');process.env.GAME_ROOT=path.join(output,'games',name);
    const dest=path.join(output,label,name),runner=await createRunner(dest),results=[];
    const jobs=seeds.flatMap(seed=>policies.map(policy=>({seed,policy})));let ix=0;
    try{
      await Promise.all(Array.from({length:Math.min(3,jobs.length)},async()=>{while(ix<jobs.length){
        const {seed,policy}=jobs[ix++];assert(['skip','develop','develop-two'].includes(policy));
        const cfg={...config,freezeHomeHoneyAfterGoal:policy==='skip'};
        if(policy==='develop-two')cfg.phases={...cfg.phases,0:{...cfg.phases[0],packers:2}};
        const r=await runner.run({name:policy,seed,config:cfg,fidelity});r.audit=audit(r);results.push(r);
        fs.writeFileSync(path.join(dest,'summary.json'),JSON.stringify({variant:variants[name],manifest:runner.manifest,results:results.map(compact)},null,2));
      }}));
      if(process.env.REPLAY==='1'){
        const first=results.find(r=>r.seed===seeds[0]&&r.name===policies[0]);
        const repeat=await runner.run({name:'replay',seed:first.seed,config:first.config,fidelity});audit(repeat);
        assert.equal(replayTrace(first),replayTrace(repeat),'Seeded replay diverged');
        fs.writeFileSync(path.join(dest,'replay.json'),JSON.stringify({identical:true,seed:first.seed,policy:first.name}));
      }
      for(const policy of policies){const rows=results.filter(r=>r.name===policy);console.log(name,policy,(rows.reduce((n,r)=>n+r.total/60,0)/rows.length).toFixed(2)+'m');}
    }finally{await runner.close();}
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
