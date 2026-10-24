'use strict';
// Frozen copies only: shipping public/ keeps the automatic copied-skill discount.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createRunner}=require('./campaign.cjs');
const {audit,replayTrace,compact}=require('./validate.cjs');
const root=path.resolve(__dirname,'../..'),out=path.resolve(process.env.RESULT_DIR||'runs/claw-discount');
const files=['game.js','lots/hollow.js','lots/prairie.js','index.html','style.css','audio.js','ending.js','tips.js'];
function once(s,a,b){assert.equal(s.split(a).length,2,'Discount trial anchor drift: '+a);return s.replace(a,b);}
function trial(source,cost){
  let s=once(source,'let d = DISCOUNT;',`let d = ${cost?"gl('blueprint') ? DISCOUNT : 1":'1'};`);
  // At 100%, charge the actual ladder price; niceCost(1.2) would charge 1.25.
  for(const v of ['full','f'])s=s.replaceAll(`niceCost(${v}*discFor(k))`,`(discFor(k) < 1 ? niceCost(${v}*discFor(k)) : ${v})`);
  if(cost)s=once(s,'const GEN = {',`const GEN = {\n  blueprint:{name:'Shared skill plans',max:1,cost:[${cost}],desc:()=>'Copied skill levels cost 50% instead of full price.'},`);
  // Shared basket plans remains an independent 10% exception in every arm.
  return s;
}
function prepare(){
  const source=fs.readFileSync(path.join(root,'public/game.js'),'utf8');
  for(const [arm,cost]of [['no-discount',0],['yard-1500',1500],['yard-3000',3000]]){
    const dest=path.join(out,arm,'game');assert(!fs.existsSync(dest),'Use a fresh study directory');
    for(const f of files){const p=path.join(dest,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.copyFileSync(path.join(root,'public',f),p);}
    fs.writeFileSync(path.join(dest,'game.js'),trial(source,cost));
  }
}
async function checks(){
  const {pathToFileURL}=require('node:url');
  const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/kallek/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'});
  try{for(const arm of ['no-discount','yard-1500','yard-3000']){
    const page=await browser.newPage();await page.route(/^https:\/\//,r=>r.abort());await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
    await page.goto(pathToFileURL(path.join(out,arm,'game/index.html')).href+'?fresh');await page.waitForFunction(()=>window.__leafYard);
    const r=await page.evaluate(()=>{
      const Y=__leafYard;Y.dev('S.cash=S.peak=1e6;S.flags.general=true;S.robots.push(newRobotCfg());bindIds();syncRobots();');
      const sample=()=>Y.dev(`(()=>{const [a,b]=S.robots;a.lv.pick=2;b.lv.pick=0;const match=maxPlan('robot',1,'pick').cost;a.lv.pick=b.lv.pick=2;const all=allPlan('pick').cost;a.lv.pick=1;b.lv.pick=0;const single=rCost(1,'pick').cost;S.gen.basket=1;a.lv.carry=1;b.lv.carry=0;return {match,all,single,basket:rCost(1,'carry').cost};})()`);
      const before=sample(),offer=Y.fn().offers().find(o=>o.id==='gen'&&o.key==='blueprint');
      if(offer&&!Y.buy(offer))throw Error('Discount unlock rejected');return{before,after:sample(),cost:offer?.cost};
    });
    assert.deepEqual(r.before,{match:.9,all:2.4,single:.3,basket:.05});
    assert.deepEqual(r.after,arm==='no-discount'?r.before:{match:.45,all:1.8,single:.15,basket:.05});
    assert.equal(r.cost,arm==='yard-1500'?1500:arm==='yard-3000'?3000:undefined);await page.close();
  }console.log('Trial prices: single, Match/All, unlock charges and independent basket exception passed.');
  }finally{await browser.close();}
}
async function run(){
  const config=JSON.parse(fs.readFileSync(path.join(__dirname,'completion-policy.json'),'utf8'));
  const seeds=(process.env.SEEDS||'701,702,703').split(',').map(Number);
  const names=(process.env.POLICIES||'smart,smart-skip,smart-balanced').split(',');
  for(const arm of (process.env.ARMS||'no-discount,yard-1500,yard-3000').split(',')){
    process.env.GAME_ROOT=path.join(out,arm,'game');const runner=await createRunner(path.join(out,arm)),rows=[];
    const plans=(process.env.PLANS||'auto').split(',');
    const extension=fs.readFileSync(path.join(__dirname,'discount-policy.js'),'utf8');
    const jobs=seeds.flatMap(seed=>names.flatMap(name=>plans.map(plan=>({name:plan==='auto'?name:name+'-discount-'+plan,seed,config:{...config,...(name==='smart-skip'?{honeyMax:null}:name==='smart-balanced'?{honeyMax:null,freezeHomeHoneyAfterGoal:false,excavation:false}:{}),...(plan==='auto'?{}:{discountPlan:plan})},fidelity:process.env.FIDELITY||'sim',...(plan==='auto'?{}:{policyExtension:extension})}))));let ix=0;
    try{
      await Promise.all(Array.from({length:Math.min(3,jobs.length)},async()=>{while(ix<jobs.length){const r=await runner.run(jobs[ix++]);r.audit=audit(r);rows.push(r);}}));
      const first=rows.find(r=>r.name==='smart'&&r.seed===seeds[0])||rows[0];
      if(first){const job=jobs.find(j=>j.name===first.name&&j.seed===first.seed),repeat=await runner.run({...job,name:'replay'});audit(repeat);assert.equal(replayTrace(first),replayTrace(repeat));}
      fs.writeFileSync(path.join(out,arm,process.env.SUMMARY||'summary.json'),JSON.stringify({manifest:runner.manifest,seeds,config,replayIdentical:!!first,results:rows.map(compact)},null,2));
      console.log(arm,JSON.stringify(rows.map(r=>({policy:r.name,seed:r.seed,minutes:r.total/60}))));
    }finally{await runner.close();}
  }
}
async function replayPlans(){
  const extension=fs.readFileSync(path.join(__dirname,'discount-policy.js'),'utf8');
  for(const arm of ['yard-1500','yard-3000']){
    const dir=path.join(out,arm),file=path.join(dir,'plans-heldout.json'),summary=JSON.parse(fs.readFileSync(file,'utf8'));
    const row=summary.results.find(r=>r.seed===721&&r.name==='smart-discount-crew6'),first=JSON.parse(fs.readFileSync(path.join(dir,row.file),'utf8'));
    process.env.GAME_ROOT=path.join(dir,'game');const runner=await createRunner(path.join(dir,'plan-replay'));
    try{const repeat=await runner.run({name:'replay',seed:first.seed,config:first.config,policyExtension:extension});audit(repeat);assert.equal(replayTrace(first),replayTrace(repeat));summary.replayIdentical=true;fs.writeFileSync(file,JSON.stringify(summary,null,2));}
    finally{await runner.close();}
  }
}
function report(){
  const result={date:'2026-10-24',method:'Paid full campaigns, normal 1x pace; paired seeds. No capacity grants. Shared basket plans stays at 10%.',arms:{},additional:{}};
  function readSuite(dir,file){
    const summary=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
    return {manifest:summary.manifest,replayIdentical:summary.replayIdentical,rows:summary.results.map(row=>{
      const r=JSON.parse(fs.readFileSync(path.join(dir,row.file),'utf8')),checked=audit(r);
      return {...row,config:r.config,policyExtension:r.policyExtension,audit:checked,
        blueprints:r.stages.map(s=>s.purchases.filter(p=>p.id==='gen'&&p.key==='blueprint').map(p=>({minute:p.t/60,cost:p.cost,why:p.why}))),
        skills:r.stages.map(s=>s.purchases.filter(p=>p.id==='rup'||p.id==='hup').reduce((n,p)=>n+p.cost,0)),
        honeyMax:r.stages.map(s=>s.experiment?{maxed:s.experiment.maxed,minute:s.experiment.maxMinute,spend:s.experiment.spend}:null),
        sources:r.stages.map(s=>s.samples.at(-1)?.src??null),
        physical:r.stages.map(s=>Object.fromEntries(Object.entries(s.state.totals).filter(([,v])=>typeof v==='number').map(([k,v])=>[k,v-(s.initial.totals[k]||0)])))};
    })};
  }
  for(const arm of ['baseline','merged','no-discount','yard-1500','yard-3000']){
    const p=path.join(out,arm,'summary.json');if(!fs.existsSync(p))continue;
    result.arms[arm]=readSuite(path.join(out,arm),'summary.json');
  }
  for(const [label,dir,file]of [
    ['baseline-live','baseline-live','summary.json'],['merged-live','merged-live','summary.json'],['merged-heldout','merged-heldout','summary.json'],
    ['no-discount-heldout','no-discount','heldout.json'],['no-discount-live','no-discount','live-summary.json'],
    ...['yard-1500','yard-3000'].flatMap(arm=>[['training',arm,'plans-training.json'],['heldout',arm,'plans-heldout.json'],['live',arm,'live-summary.json']].map(([kind,dir,file])=>[arm+'-'+kind,dir,file]))]){
    if(fs.existsSync(path.join(out,dir,file)))result.additional[label]=readSuite(path.join(out,dir),file);
  }
  fs.writeFileSync(path.join(out,'comparison.json'),JSON.stringify(result,null,2));
  // Small durable evidence; full event traces and frozen sources remain in runs/.
  const evidence=JSON.parse(JSON.stringify(result));
  for(const suites of [evidence.arms,evidence.additional])for(const s of Object.values(suites))for(const row of s.rows)delete row.events;
  fs.writeFileSync(path.join(__dirname,'claw-discount-2026-10-24.json'),JSON.stringify(evidence,null,2));
  for(const [arm,data]of Object.entries(result.arms))for(const name of [...new Set(data.rows.map(r=>r.name))]){
    const rs=data.rows.filter(r=>r.name===name),mean=k=>rs.reduce((n,r)=>n+k(r),0)/rs.length;
    console.log(arm,name,'minutes',mean(r=>r.totalMinutes).toFixed(2),'spent',mean(r=>r.spent.reduce((a,b)=>a+b,0)).toFixed(0),'blueprints',JSON.stringify(rs.map(r=>r.blueprints)));
  }
}
if(require.main===module)(async()=>{const mode=process.env.MODE||'run';if(mode==='prepare')prepare();else if(mode==='report')report();else if(mode==='checks')await checks();else if(mode==='replay-plans')await replayPlans();else await run();})().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={trial};
