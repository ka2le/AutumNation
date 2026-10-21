'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {audit,replayTrace}=require('./validate.cjs');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'runs/honey-max');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),mean=a=>a.reduce((n,x)=>n+x,0)/a.length;
const labels=['training-fixed','current-validation','old-price-validation','staff-control-open','live','promoted','promoted-live','restored-180','restored-180-live','final-leaf-prices'];
const out={date:'2026-10-21',selected:read(path.join(__dirname,'selected-honey-max.json')),
  mainPolicy:read(path.join(__dirname,'completion-policy.json')),retainedHivePrice:180,
  finalPriceChoice:{homeCleanup:[400,1000,2000],hollowCleanup:[150,700,1500],finalSortLeavesBothYards:6000},
  method:'Paid full campaigns with interventions at earned home furnace/hollow kiln repair unlocks. Train on 1-3, validate on 901-903; normal gameplay 1001. Compare current $140 with an otherwise identical $180 general-hive price. All workers retain productive fallback work. Maxing ends only after 40 population, five productive general upgrades, maximum labels/ribbons, and two maximum-pack workers; full variant also requires maximum tank/store. Nursery is omitted when no longer worthwhile at checkpoint population. Then add industry while keeping two trained honey packers.',
  limits:'Finite strategy search, three simulation seeds and one normal-gameplay seed. Preserve source hashes: early pilot travel bug excluded. Staffing control is a counterfactual, not a newly optimized mixed strategy. Price discount is isolated; no additional game economy values changed.',
  excluded:['runs/honey-max/training: custom staffing failed to board the travelling Blower; all pilot runs excluded and full training repeated after fix.',
    'runs/honey-max/staff-control: exploratory control still froze new home honey investment; use staff-control-open for the matched staffing comparison.'],suites:{},metrics:{}};
for(const label of labels){
  const dir=path.join(base,label),s=read(path.join(dir,'summary.json'));
  for(const row of s.results){
    const raw=read(path.join(dir,row.file));audit(raw);
    row.config=raw.config;
    row.production=raw.stages.filter(st=>st.experiment?.target).map(st=>{
      const e=st.experiment,q=e.checkpoint.state,earned=st.state.totals.cash-q.totals.cash,honey=st.state.totals.honeyCash-q.totals.honeyCash;
      return {phase:st.phase,maxMinute:e.maxMinute,windowToEndMinutes:(st.state.t-q.t)/60,earned,honey,honeyShare:honey/earned,
        maxLevels:e.maxState.lv,maxPacking:e.maxState.packingLevels,general:e.end.hive.up,checkpointHash:row.maxStages?.find(x=>x.phase===st.phase)?.checkpointHash,
        checkpointPopulation:q.hive.bees,travellerPacking:st.state.robots[0].lv.pack};
    });
  }
  out.suites[label]=s;
  out.metrics[label]=Object.fromEntries([...new Set(s.results.map(r=>r.name))].map(name=>{const rows=s.results.filter(r=>r.name===name);return[name,{n:rows.length,meanMinutes:mean(rows.map(r=>r.totalMinutes)),minMinutes:Math.min(...rows.map(r=>r.totalMinutes)),maxMinutes:Math.max(...rows.map(r=>r.totalMinutes))}];}));
  if(label!=='training-fixed'){
    const replay=s.replayIdentical??read(path.join(dir,'replay.json')).identical;
    assert(replay,'Missing exact replay');
  }
}
for(const label of ['current-validation','old-price-validation'])for(const seed of [901,902,903])for(const phase of [3,4]){
  const rows=out.suites[label].results.filter(r=>r.seed===seed&&r.options?.phase===phase);
  assert.equal(new Set(rows.map(r=>r.checkpointHash)).size,1,'Unequal paired checkpoints');
  const before=out.suites['old-price-validation'].results.find(r=>r.seed===seed&&r.options?.phase===phase);
  assert.equal(rows[0].checkpointHash,before.checkpointHash,'Price comparison starts from different assets');
}
for(const label of ['promoted','promoted-live','restored-180']){
  const comparison=label==='promoted'?'current-validation':label==='restored-180'?'old-price-validation':'live';
  for(const r of out.suites[label].results){
    const name=r.name==='smart'?'honey-productive-both':'smart';
    const other=out.suites[comparison].results.find(x=>x.name===name&&x.seed===r.seed);
    assert.equal(replayTrace(read(path.join(base,label,r.file))),replayTrace(read(path.join(base,comparison,other.file))),'Promotion changed the measured policy');
  }
}
const current=out.suites['current-validation'].results,old=out.suites['old-price-validation'].results;
out.comparison={};
for(const name of ['honey-full-4','honey-productive-4','honey-full-3','honey-productive-3','honey-full-both','honey-productive-both']){
  const rows=current.filter(r=>r.name===name),bench=current.filter(r=>r.name==='smart');
  out.comparison[name]={meanMinutes:mean(rows.map(r=>r.totalMinutes)),baselineMean:mean(bench.map(r=>r.totalMinutes)),
    wins:rows.filter(r=>r.totalMinutes<bench.find(b=>b.seed===r.seed).totalMinutes).length,
    oldPriceMean:mean(old.filter(r=>r.name===name).map(r=>r.totalMinutes)),
    honeyShares:Object.fromEntries([3,4].map(phase=>[phase,mean(rows.flatMap(r=>r.production.filter(p=>p.phase===phase).map(p=>p.honeyShare)))]))};
}
out.runCount=Object.values(out.suites).reduce((n,s)=>n+s.results.length,0)+9;assert.equal(out.runCount,100);
// Read the delivered revision from its frozen snapshot, so later tuning cannot rewrite this evidence.
const delivered=fs.readFileSync(path.join(base,'restored-180/sources/game.js'),'utf8');
const digest=require('node:crypto').createHash('sha256').update(delivered).digest('hex');
assert.equal(digest,out.suites['restored-180'].manifest.sources['game.js']);
const newSource=fs.readFileSync(path.join(base,'current-validation/sources/game.js'),'utf8');
assert.equal(newSource.replace('const HIVE_UP_COST = 140;','const HIVE_UP_COST = 180;'),fs.readFileSync(path.join(base,'old-price-validation/sources/game.js'),'utf8'));
fs.writeFileSync(path.join(__dirname,'honey-max-2026-10-21.json'),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({comparison:out.comparison,live:out.metrics.live,control:out.metrics['staff-control-open'],runs:out.runCount},null,2));
