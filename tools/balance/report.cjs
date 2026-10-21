'use strict';
const fs=require('node:fs'),path=require('node:path');
const {audit,compact}=require('./validate.cjs');
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const stat=a=>({mean:mean(a),min:Math.min(...a),max:Math.max(...a)});
function metrics(r){
  const final=r.stages[2],goal=final.events.find(e=>e.id==='ingotsGoal')?.t;
  const physical=final.purchases.filter(o=>o.id==='up'&&['smeltSpeed','slag','hopper','pallet'].includes(o.key)||o.id==='hup'&&o.key==='stoke');
  const last=physical.length?physical.at(-1).t:null;
  const price=p=>p.id==='up'&&['leafPrice','bagPrice','cleanup','honeyPrice','giftPrice','metalPrice','ingotGrade'].includes(p.key)||p.id==='gen'&&p.key==='market';
  const tailPrice=final.purchases.filter(p=>p.t>=goal-300&&price(p));
  const snap=final.samples.at(-1),earlier=final.samples.find(s=>s.t>=snap.t-300),dt=(snap.t-earlier.t)/60;
  const income=Object.fromEntries(['leaf','bag','metal','ingot','jar','gift','clean'].map(k=>[k,(snap.src[k]-earlier.src[k])/dt]));
  const plant=final.events.find(e=>e.id==='plantBuilt')?.t;
  return {plantMinutes:plant/60,productionToGoalMinutes:(goal-plant)/60,goalMinutes:goal/60,
    lastPhysicalToGoalMinutes:last==null?null:(goal-last)/60,
    latePriceSpent:tailPrice.reduce((n,p)=>n+p.cost,0),latePricePurchases:tailPrice.length,
    endIncomePerMinute:income,
    readinessPurchases:r.stages[0].purchases.filter(p=>p.why.startsWith('paid readiness')).map(p=>({key:p.key,cost:p.cost})),
    gates:r.stages.map(s=>Object.fromEntries(Object.entries(s.diagnostics.gates).map(([k,v])=>[k,v/60])))};
}
function summarize(dir){
  const summary=JSON.parse(fs.readFileSync(path.join(dir,'summary.json'),'utf8'));
  // Select the runs named by this validation, never unrelated files left in a directory.
  const runs=summary.results.map(row=>{
    if(row.file)return JSON.parse(fs.readFileSync(path.join(dir,row.file),'utf8'));
    // Compatibility with the initial audit files written before filenames were recorded.
    const matches=fs.readdirSync(dir).filter(f=>f.startsWith(`${row.name}-${row.seed}-`)).map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')))
      .filter(r=>r.fidelity===row.fidelity&&r.total/60===row.totalMinutes&&JSON.stringify(r.manifest)===JSON.stringify(summary.manifest));
    if(matches.length!==1)throw Error('Ambiguous or missing validated run: '+row.name+' '+row.seed);
    return matches[0];
  });
  const rows=runs.map(r=>{audit(r);return {...compact(r),metrics:metrics(r)};});
  const policies={};
  for(const name of [...new Set(rows.map(r=>r.name))]){
    const subset=rows.filter(r=>r.name===name);
    policies[name]={count:subset.length,total:stat(subset.map(r=>r.totalMinutes)),stages:[0,1,2].map(i=>stat(subset.map(r=>r.stageMinutes[i]))),
      metrics:Object.fromEntries(['plantMinutes','productionToGoalMinutes','lastPhysicalToGoalMinutes','latePriceSpent','latePricePurchases'].map(k=>[k,stat(subset.map(r=>r.metrics[k]))]))};
  }
  const paired=rows.filter(r=>r.name==='smart').map(r=>{const b=rows.find(b=>b.name==='legacy'&&b.seed===r.seed);return {seed:r.seed,savedMinutes:b.totalMinutes-r.totalMinutes,savedPercent:100*(b.totalMinutes-r.totalMinutes)/b.totalMinutes};});
  return {...summary,results:rows,policies,paired,savedMinutes:stat(paired.map(r=>r.savedMinutes)),wins:paired.filter(r=>r.savedMinutes>0).length};
}
if(require.main===module){
  const dir=path.resolve(process.argv[2]||'runs/smart-validation-final'),report=summarize(dir);
  fs.writeFileSync(path.join(dir,'analysis.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({policies:report.policies,paired:report.paired},null,2));
}
module.exports={summarize,metrics};
