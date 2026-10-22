'use strict';
// Current-game cleanup/output study. Capacity grants and paid campaigns stay separate.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createRunner}=require('./campaign.cjs');
const {audit,replayTrace}=require('./validate.cjs');
const hash=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const root=path.resolve(__dirname,'../..'),out=path.resolve(process.env.RESULT_DIR||'runs/cleanup-study');
const config=JSON.parse(fs.readFileSync(path.join(__dirname,'completion-policy.json'),'utf8'));
const original=fs.readFileSync(path.join(__dirname,'source-experiment.js'),'utf8');
const layouts={
  ...Object.fromEntries(Array.from({length:11},(_,n)=>['leaf-'+n+'-bag',[...Array(n).fill('bag'),...Array(10-n).fill('leaf')]])),
  'leaf-flex':Array(10).fill('leaf-flex'),
  'requested':['smelt','smelt','pack','pack','pack','leaf-flex','leaf-flex','mine','mine','mine'],
  'requested-split':['smelt','smelt','honey','honey','bag','leaf-flex','leaf-flex','mine','mine','mine'],
  'requested-haul':['smelt','smelt','pack','pack','pack','leaf-flex','leaf-flex','mine-haul','mine','mine'],
  'mixed-four-miners':['mine','mine','mine','mine','smelt','smelt','haul','leaf','bag','honey'],
  'industry-honey':['mine','mine','mine','mine','smelt','smelt','haul','haul','honey','honey'],
  'honey-leaves':['honey','honey','bag','bag',...Array(6).fill('leaf')],
  industry:['mine','mine','mine','mine','smelt','smelt','haul','haul','haul','leaf']
};
function replace(s,a,b){assert.equal(s.split(a).length,2,'Study adapter drift: '+a);return s.replace(a,b);}
function capacitySource(){
  let s=original;
  // Buy every offered land expansion too: a fully maxed yard, rather than checkpoint-owned land.
  s=replace(s,"o.id!=='eye'&&o.id!=='land'&&o.key!=='study'", "o.id!=='eye'&&o.key!=='study'");
  s=replace(s,"const role=assignment[i];let rows;", "const role=assignment[i];let rows;\n      if(role==='mine-haul'){c.miner=slots[slot++];rows=[['mine','haul'],['leaves']];}\n      else if(role==='pack')rows=[['jar','wrap'],['bag'],['leaves']];\n      else if(role==='leaf-flex')rows=[['leaves','bag']];");
  s=replace(s,"if(role==='mine'&&slot<slots.length)","else if(role==='mine'&&slot<slots.length)");
  s=replace(s,"mining=assignment.includes('mine')", "mining=assignment.some(r=>r==='mine'||r==='mine-haul')");
  s=replace(s,"if(O.ablate){", "if(O.reward)F.UP.cleanup.vals[3]=O.reward;\n    if(O.keepLeaves!==undefined)S.keep.leaves=O.keepLeaves;\n    if(O.ablate){");
  s=replace(s,"plant:Y.state().plant.built,totals:","plant:Y.state().plant.built,resources:{bin:Y.state().binLeaves,bags:Y.state().bag.bags,honey:Y.state().hive.honey,jars:Y.state().hive.jars,gift:Y.state().hive.gift,metal:Y.state().binMetal,ore:Y.state().plant.ore,rack:Y.state().plant.rack,ingots:Y.state().ingots,cleanN:Y.state().cleanN},totals:");
  s=replace(s,"if(O.mode==='capacity')staff();",`if(O.mode==='capacity'){
      staff();
      if(S.t-start>=300){
        E.activity ||= {robots:{},helpers:{},smelterBlocked:{},seconds:0};const A=E.activity;A.seconds++;
        for(const r of Y.robots()){const k=assignment[r.id]+':'+r.st;A.robots[k]=(A.robots[k]||0)+1;
          if(assignment[r.id]==='smelt'){const C=window.__campaign;const k=r.st==='smelt'?'busy':C.taskWork(r,'smelt')?'workAvailable':S.plant.coal<=0?'coal':C.stationFree('smelt',r)<0?'station':!C.rackHasRoom(r)?'rack':'input';A.smelterBlocked[k]=(A.smelterBlocked[k]||0)+1;}}
        for(const h of Y.helpers()){const k=h.kind+':'+h.st;A.helpers[k]=(A.helpers[k]||0)+1;}
      }
    }`);
  // Main completion benchmark supplies the earned home/hollow prefix.
  return "if(window.__phase===3){window.__experimentOptions=window.__config.honeyMax[3];\n"+original+"\n}else{\n"+s+"\n}";
}
function row(r){
  const e=r.stages.at(-1).experiment;assert(e?.finished);assert.deepEqual(r.errors,[]);
  const warm=e.points.find(p=>p.t>=300),last=e.points.at(-1),minutes=(last.t-warm.t)/60;
  assert(minutes>=9.9);const rate=Object.fromEntries(Object.keys(last.src).map(k=>[k,(last.src[k]-warm.src[k])/minutes]));
  const total=['leaf','bag','clean','jar','gift','metal','ingot'].reduce((n,k)=>n+rate[k],0);
  assert(Math.abs(total-(last.earned-warm.earned)/minutes)<1e-6);
  const p=e.fixtureState;assert.equal(p.robots.length,10);assert.equal(p.blowers.length,3);assert.equal(p.shakers.length,3);
  assert.equal(e.remainingOffers.filter(o=>o.id==='land').length,0);
  return {name:r.name,seed:r.seed,file:r.file,options:e.options,checkpointHash:hash(e.checkpoint),rate,total,
    cleanupCosts:e.priceLadders.cleanup.costs,cleanupValues:e.priceLadders.cleanup.values,
    fixture:{land:p.land,robots:p.robots.length,blowers:p.blowers.length,shakers:p.shakers.length,bees:p.hive.bees,lv:p.lv,gen:p.gen,keep:p.keep,skills:p.robots.map(c=>c.lv)},
    warmResources:warm.resources,endResources:last.resources,activity:e.activity,fixtureCost:e.fixturePurchases.reduce((n,p)=>n+p.cost,0)};
}
async function main(){
  const mode=process.env.MODE||'capacity',seeds=(process.env.SEEDS||'1').split(',').map(Number),arms=(process.env.ARMS||Object.keys(layouts).join(',')).split(',');
  if(mode==='prepare'){
    const dest=path.join(out,'double-reward');assert(!fs.existsSync(dest),'Refusing to overwrite frozen candidate');
    const sourceRoot=path.resolve(process.env.GAME_ROOT||path.join(root,'public'));
    for(const f of ['game.js','lots/hollow.js','lots/prairie.js','index.html','style.css','audio.js','ending.js','tips.js']){const p=path.join(dest,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.copyFileSync(path.join(sourceRoot,f),p);}
    const p=path.join(dest,'game.js');fs.writeFileSync(p,replace(fs.readFileSync(p,'utf8'),'vals:[0, 18, 42, 70]','vals:[0, 18, 42, 140]'));return;
  }
  fs.mkdirSync(out,{recursive:true});const runner=await createRunner(out),results=[],checkpoints=new Map();
  const source=capacitySource();
  try{
    const jobs=seeds.flatMap(seed=>(mode==='capacity'?arms:mode==='mature'?(process.env.DELAYS||'15,25').split(','):['smart','smart-skip','smart-balanced']).map(name=>({seed,name})));let ix=0;
    await Promise.all(Array.from({length:Math.min(3,jobs.length)},async()=>{
      while(ix<jobs.length){const j=jobs[ix++];let r;
        if(mode==='capacity'){
          assert(layouts[j.name]);
          const options={phase:4,phases:[3,4],mode:'capacity',focus:j.name,roles:layouts[j.name],minutes:+(process.env.MINUTES||20),snippers:+(process.env.SNIPPERS??(j.name.startsWith('leaf-')?0:1)),excavation:true,...(process.env.REWARD?{reward:+process.env.REWARD}:{}),...(process.env.KEEP_LEAVES?{keepLeaves:+process.env.KEEP_LEAVES}:{})};
          r=await runner.run({name:'cleanup-'+j.name,seed:j.seed,config,fidelity:process.env.FIDELITY||'sim',experiment:{source,options}});
          const a=row(r);const key=j.seed+':'+(process.env.FIDELITY||'sim');if(checkpoints.has(key))assert.equal(a.checkpointHash,checkpoints.get(key));else checkpoints.set(key,a.checkpointHash);
          results.push(a);console.log(JSON.stringify({name:j.name,seed:j.seed,total:a.total,leafRate:a.rate.nL,clean:a.rate.clean,ingot:a.rate.ingot}));
        }else if(mode==='mature'){
          const observer=fs.readFileSync(path.join(__dirname,'cleanup-mature.js'),'utf8');
          const matureSource='const matureOptions=window.__experimentOptions;window.__experimentOptions=window.__config.honeyMax[window.__phase];\n'+original+'\nif(window.__phase===4){window.__matureOptions=matureOptions;\n'+observer+'\n}';
          r=await runner.run({name:'mature-'+j.name,seed:j.seed,config,fidelity:process.env.FIDELITY||'sim',experiment:{source:matureSource,options:{phases:[3,4],delay:+j.name}}});
          assert.deepEqual(r.errors,[]);const e=r.stages.at(-1).experiment;assert(e.finished);assert.equal(e.purchaseCount,e.endPurchaseCount);
          for(const s of r.stages){const paid=s.purchases.reduce((n,p)=>n+p.cost,0);assert(Math.abs(s.initial.cash+s.state.totals.cash-s.initial.totals.cash-paid-s.state.cash)<1e-5);}
          const warm=e.points.find(p=>p.t>=300),last=e.points.at(-1),minutes=(last.t-warm.t)/60;
          const rate=Object.fromEntries(Object.keys(last.src).map(k=>[k,(last.src[k]-warm.src[k])/minutes]));
          const total=['leaf','bag','clean','jar','gift','metal','ingot'].reduce((n,k)=>n+rate[k],0);
          results.push({name:r.name,seed:r.seed,file:r.file,checkpointHash:hash(e.checkpoint),repairDelay:e.repairDelay,rate,total,fixture:e.checkpoint.state,cleanN:[warm.cleanN,last.cleanN]});
          console.log(JSON.stringify({name:r.name,seed:r.seed,total,leafRate:rate.nL}));
        }else{
          r=await runner.run({name:j.name,seed:j.seed,config,fidelity:process.env.FIDELITY||'sim'});audit(r);
          results.push({name:j.name,seed:j.seed,file:r.file,minutes:r.total/60,stages:r.stages.map(s=>({phase:s.phase,minutes:s.elapsed/60,earned:s.state.totals.cash-s.initial.totals.cash,cleanupPurchases:s.purchases.filter(p=>p.key==='cleanup')}))});
        }
        fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({manifest:runner.manifest,config,sourceHash:hash(source),mode,seeds,results},null,2));
      }
    }));
    if(process.env.REPLAY==='1'){
      const a=results[0],raw=JSON.parse(fs.readFileSync(path.join(out,a.file),'utf8'));
      const repeat=await runner.run({name:raw.name,seed:raw.seed,config:raw.config,fidelity:raw.fidelity,experiment:mode==='capacity'?{source,options:raw.experiment.options}:null});
      assert.equal(replayTrace(raw),replayTrace(repeat));assert.deepEqual(raw.stages.at(-1).experiment,repeat.stages.at(-1).experiment);
      fs.writeFileSync(path.join(out,'replay.json'),JSON.stringify({identical:true,seed:a.seed,name:a.name}));
    }
  }finally{await runner.close();}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={layouts,capacitySource};
