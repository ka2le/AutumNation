'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createRunner}=require('./campaign.cjs');
const {audit}=require('./validate.cjs');
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const layouts={
  leaves:['bag','bag',...Array(8).fill('leaf')],
  'honey-leaves':['honey','honey','bag','bag',...Array(6).fill('leaf')],
  'raw-leaves':[...Array(4).fill('mine'),'bag','honey',...Array(4).fill('leaf')],
  'raw-honey':[...Array(4).fill('mine'),'honey','honey','bag','bag','leaf','leaf'],
  industry:[...Array(4).fill('mine'),'smelt','smelt','haul','haul','haul','leaf'],
  'industry-honey':[...Array(4).fill('mine'),'smelt','smelt','haul','haul','honey','honey'],
  'industry-bags':[...Array(4).fill('mine'),'smelt','smelt','haul','haul','bag','honey'],
  'mixed-four-miners':[...Array(4).fill('mine'),'smelt','smelt','haul','leaf','bag','honey'],
  'mixed-one-operator':[...Array(4).fill('mine'),'smelt','haul','leaf','leaf','honey','honey'],
  mixed:['mine','mine','mine','smelt','smelt','haul','leaf','leaf','bag','honey'],
  'mixed-honey':['mine','mine','mine','smelt','smelt','haul','leaf','bag','honey','honey']
};
async function main(){
  const output=path.resolve(process.env.RESULT_DIR||'runs/source-balance');
  const config=JSON.parse(fs.readFileSync(path.join(__dirname,'selected-policy.json'),'utf8'));
  const source=fs.readFileSync(path.join(__dirname,'source-experiment.js'),'utf8');
  const mode=process.env.MODE||'paid',seeds=(process.env.SEEDS||'401,402,403').split(',').map(Number);
  const phases=(process.env.PHASES||'4,3').split(',').map(Number),fidelity=process.env.FIDELITY||'sim';
  const arms=(process.env.ARMS||(mode==='capacity'?Object.keys(layouts).join(','):'main,mixed,leaf,honey,raw,industry,skip-honey,skip-leaf')).split(',');
  const base={mode,minutes:+(process.env.MINUTES||(mode==='capacity'?15:20)),bias:+(process.env.BIAS||8),payback:+(process.env.PAYBACK||8),costPower:+(process.env.COST_POWER||.85),secondary:process.env.SECONDARY||'leaf',staffing:process.env.STAFFING||'specialist'};
  const selected=mode==='paid'&&process.env.EXPERIMENT_CONFIG!=='none'?JSON.parse(fs.readFileSync(process.env.EXPERIMENT_CONFIG||path.join(__dirname,'selected-source-policies.json'),'utf8')):{};
  const jobs=seeds.flatMap(seed=>phases.flatMap(phase=>arms.map(focus=>({seed,options:{...base,phase,focus,
    ...(mode==='capacity'?{roles:layouts[focus],snippers:+(process.env.SNIPPERS||1),excavation:process.env.EXCAVATION!=='0'}:{}),...(process.env.ABLATE?{ablate:process.env.ABLATE}:{}),...selected[phase]?.[focus],stop:process.env.STOP==='1'}}))));
  const runner=await createRunner(output),results=[],checkpoints=new Map();let ix=0;
  try{
    await Promise.all(Array.from({length:Math.min(3,jobs.length)},async()=>{
      while(ix<jobs.length){
        const job=jobs[ix++],r=await runner.run({name:`${mode}-${job.options.focus}`,seed:job.seed,config,fidelity,experiment:{source,options:job.options}});
        assert.deepEqual(r.errors,[],r.errors.join('\n'));
        const stage=r.stages.find(s=>s.phase===job.options.phase),e=stage.experiment;
        assert(e?.checkpoint,'Checkpoint not reached');
        const signature=hash(e.checkpoint),key=`${job.seed}:${job.options.phase}`;
        if(checkpoints.has(key))assert.equal(signature,checkpoints.get(key),'Unequal earned starting state');else checkpoints.set(key,signature);
        if(mode==='paid'&&!job.options.stop)audit(r);
        if(mode==='capacity'||job.options.stop)assert(e.finished,'Experiment window did not complete');
        const points=e.points,first=points[0],last=points.at(-1),warm=points.find(p=>p.t>=300)||first;
        const rate={};for(const k in last.src)rate[k]=(last.src[k]-(mode==='capacity'?warm:first).src[k])/((last.t-(mode==='capacity'?warm:first).t)/60);
        const row={file:r.file,seed:r.seed,options:job.options,checkpointHash:signature,checkpointMinute:(stage.offset+e.checkpoint.state.t-stage.initial.t)/60,
          complete:r.complete,totalMinutes:r.total/60,afterCheckpointMinutes:(r.total-stage.offset-e.checkpoint.state.t+stage.initial.t)/60,
          experimentFinished:!!e.finished,windowMinutes:last.t/60,earned:last.earned-first.earned,cashChange:last.cash-first.cash,rate,spend:e.spend,
          finalWindow:{cash:last.cash,crew:last.crew,bees:last.bees,lv:last.lv,gen:last.gen,plant:last.plant},
          fixtureCost:e.fixturePurchases.reduce((n,p)=>n+p.cost,0),fixtureCostsByKey:e.fixturePurchases.reduce((out,p)=>{const k=p.id+':'+(p.key||'');out[k]=(out[k]||0)+p.cost;return out;},{}),
          events:stage.events.filter(x=>x.t>=e.checkpoint.state.t-stage.initial.t).map(x=>({id:x.id,minutes:(x.t-e.checkpoint.state.t+stage.initial.t)/60}))};
        results.push(row);fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify({manifest:runner.manifest,sourceHash:hash(source),config,results},null,2));
        console.log(JSON.stringify({arm:job.options.focus,phase:job.options.phase,seed:r.seed,after:row.afterCheckpointMinutes,income:row.earned/windowMinutes(row),rate:rate.leaf+rate.bag+rate.clean+rate.jar+rate.gift+rate.metal+rate.ingot}));
      }
    }));
  }finally{await runner.close();}
}
function windowMinutes(row){return row.windowMinutes||1;}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={layouts};
