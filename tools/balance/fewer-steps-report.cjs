'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {audit}=require('./validate.cjs');
const out=path.resolve(process.env.RESULT_DIR||'runs/fewer-steps-v1');
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const upgrade=p=>['rup','hup','rall','rmax','up','tech','gen','hiveUp'].includes(p.id);
const quantile=(xs,p)=>{const a=xs.slice().sort((a,b)=>a-b);return a.length?a[Math.floor((a.length-1)*p)]:null;};
function cadence(purchases,seconds){
  const times=purchases.map(p=>p.t),gaps=times.slice(1).map((t,i)=>t-times[i]);
  const bins=Array.from({length:Math.ceil(seconds/60)},(_,i)=>times.filter(t=>t>=i*60&&t<(i+1)*60).length);
  // Count the first and last partial minute at their actual duration in rates;
  // omit the final partial bin from the frequency distribution.
  const fullBins=bins.slice(0,Math.floor(seconds/60));
  return {count:times.length,perMinute:times.length/(seconds/60),medianGapSeconds:quantile(gaps,.5),
    p25GapSeconds:quantile(gaps,.25),p75GapSeconds:quantile(gaps,.75),p90GapSeconds:quantile(gaps,.9),
    fractionGapsAtMost5:gaps.length?gaps.filter(v=>v<=5).length/gaps.length:0,
    fractionGapsAtMost10:gaps.length?gaps.filter(v=>v<=10).length/gaps.length:0,
    fullMinuteBins:fullBins,emptyMinuteFraction:fullBins.filter(v=>v===0).length/Math.max(1,fullBins.length),
    p90PurchasesInMinute:quantile(fullBins,.9),maxPurchasesInMinute:Math.max(0,...bins),
    fiveMinuteBins:Array.from({length:Math.ceil(seconds/300)},(_,i)=>({startMinute:i*5,count:times.filter(t=>t>=i*300&&t<Math.min(seconds,(i+1)*300)).length}))};
}
function row(r){
  const checked=audit(r),all=r.stages.flatMap(s=>s.purchases.map(p=>({...p,t:p.t+s.offset})));
  const result={name:r.name,seed:r.seed,config:r.config,experiment:r.experiment,fidelity:r.fidelity,complete:r.complete,minutes:r.total/60,
    audit:checked,traceHash:hash(r.stages),all:cadence(all,r.total),upgrades:cadence(all.filter(upgrade),r.total),
    personal:cadence(all.filter(p=>['rup','hup','rall','rmax'].includes(p.id)),r.total),
    spent:all.reduce((n,p)=>n+p.cost,0),stages:r.stages.map(s=>({phase:s.phase,minutes:s.elapsed/60,
      all:cadence(s.purchases,s.elapsed),upgrades:cadence(s.purchases.filter(upgrade),s.elapsed),
      personal:cadence(s.purchases.filter(p=>['rup','hup','rall','rmax'].includes(p.id)),s.elapsed),
      spent:s.purchases.reduce((n,p)=>n+p.cost,0),sources:s.samples.at(-1)?.src,
      physical:Object.fromEntries(Object.entries(s.state.totals).filter(([,v])=>typeof v==='number').map(([k,v])=>[k,v-(s.initial.totals[k]||0)])),
      finalSkills:s.state.robots.map(c=>({lv:c.lv,prio:c.prio})),
      events:s.events.map(e=>({id:e.id,minute:e.t/60})),experiment:s.experiment?{options:s.experiment.options,checkpointHash:s.experiment.checkpoint?hash(s.experiment.checkpoint):null,
        finished:s.experiment.finished,spend:s.experiment.spend,points:s.experiment.points?.filter((p,i,a)=>i===0||i===a.length-1||i%5===0).map(p=>({t:p.t,cash:p.cash,earned:p.earned,src:p.src,totals:p.totals,crew:p.crew,bees:p.bees,plant:p.plant})),
        windowEnd:s.experiment.end?{skills:s.experiment.end.robots.map(c=>({lv:c.lv,prio:c.prio})),bees:s.experiment.end.hive.bees,plant:s.experiment.end.plant.built}:null,
        target:s.experiment.target,reached:s.experiment.maxed,minute:s.experiment.maxMinute,maxState:s.experiment.maxState}:null,
      purchaseIds:s.purchases.reduce((o,p)=>{o[p.id]=(o[p.id]||0)+1;return o;},{})}))};
  return result;
}
const evidence={date:'2026-10-25',status:'Isolated proposal; shipping public/ is unchanged.',
  method:'Paid current-game campaigns; 1x pace. Identical policies and paired seeds; no granted capital. Finite capable heuristics, not a global optimum.',
  definitions:{all:'Every recorded purchase action, including hires, population, buildings and unlocks.',upgrades:'Personal/helper skills, Match/All, yard upgrades, research unlocks and hive upgrades. Excludes hires, bees, new buildings, land, shafts and mining machines.',
    personal:'Personal/helper skill purchase actions including Match/All. The campaign buyers use individual purchases.',
    cadence:'Elapsed game minutes, including research, saving, travel boarding and all mandatory waits; excludes offline yard time and final cinematic. Phase gaps do not cross travel boundaries; whole-campaign gaps concatenate active phases.',
    bins:'Full wall-aligned game-minute bins per phase, without the final partial minute; five-minute bins include the partial tail.'},
  proposal:JSON.parse(fs.readFileSync(path.join(out,'proposal.json'))),
  reproduction:{generatorHash:hash(fs.readFileSync(path.join(__dirname,'fewer-steps.cjs'),'utf8')),reportHash:hash(fs.readFileSync(__filename,'utf8'))},suites:{}};
for(const arm of ['baseline','candidate']){
  const dir=path.join(out,arm);if(!fs.existsSync(dir))continue;
  for(const suite of fs.readdirSync(dir)){
    const file=path.join(dir,suite,'summary.json');if(!fs.existsSync(file))continue;
    const summary=JSON.parse(fs.readFileSync(file));
    evidence.suites[arm+'/'+suite]={manifest:summary.manifest,replayIdentical:summary.replayIdentical,
      rows:summary.results.map(x=>row(JSON.parse(fs.readFileSync(path.join(dir,suite,x.file)))))};
  }
}
if(fs.existsSync(path.join(out,'checks.json'))){const checks=JSON.parse(fs.readFileSync(path.join(out,'checks.json')));evidence.checks=checks;}
if(fs.existsSync(path.join(out,'boundaries.json')))evidence.boundaries=JSON.parse(fs.readFileSync(path.join(out,'boundaries.json')));
const dest=process.env.EVIDENCE||path.join(__dirname,'fewer-steps-2026-10-25.json');fs.writeFileSync(dest,JSON.stringify(evidence)+'\n');
for(const [suite,data]of Object.entries(evidence.suites))for(const name of [...new Set(data.rows.map(r=>r.name))]){
  const rs=data.rows.filter(r=>r.name===name),mean=f=>rs.reduce((n,r)=>n+f(r),0)/rs.length;
  console.log(JSON.stringify({suite,name,n:rs.length,minutes:mean(r=>r.minutes),spent:mean(r=>r.spent),allCount:mean(r=>r.all.count),upgrades:mean(r=>r.upgrades.count),personal:mean(r=>r.personal.count),
    allPerMinute:mean(r=>r.all.perMinute),upgradesPerMinute:mean(r=>r.upgrades.perMinute),personalPerMinute:mean(r=>r.personal.perMinute),
    phases:[0,1,2].map(i=>({minutes:mean(r=>r.stages[i].minutes),upgradesPerMinute:mean(r=>r.stages[i].upgrades.perMinute),personalPerMinute:mean(r=>r.stages[i].personal.perMinute)}))}));
}
console.log('Evidence: '+dest);
