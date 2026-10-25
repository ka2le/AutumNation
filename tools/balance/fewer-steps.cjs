'use strict';
// Reviewable experiment only. Never writes public/ or migrates a player's save.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createRunner}=require('./campaign.cjs'),{audit,compact,replayTrace}=require('./validate.cjs');
const root=path.resolve(__dirname,'../..'),out=path.resolve(process.env.RESULT_DIR||'runs/fewer-steps-v1');
const files=['game.js','lots/hollow.js','lots/prairie.js','index.html','style.css','audio.js','ending.js','tips.js'];
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// Retain complete paid endpoints, within each existing research tier.
const endpoints={speed:[0,1,2,3,5,7,8,9],carry:[0,1,2,3,5,7,8,9],pick:[0,1,2,3,4,6,7,8],
  pack:[0,1,3,4,5,6,7],drill:[0,1,3,4,5,7],magnet:[0,1,2,3,4,6],
  shake:[0,1,2,3,4,6],blow:[0,1,3,4],dry:[0,1,2,3,4,6]};
function once(s,a,b){assert.equal(s.split(a).length,2,'Fewer-steps anchor drift: '+a);return s.replace(a,b);}
function candidate(source){
  const patch=`
// Isolated fewer-steps proposal: paid fresh campaigns only. Do not load old saves.
const PROPOSAL_ENDPOINTS = ${JSON.stringify(endpoints)};
const PROPOSAL_PARTS = {};
for (const [key, keep] of Object.entries(PROPOSAL_ENDPOINTS)){
  const t=TRACKS[key], costs=t.gens.flatMap(g=>g.cost), oldVals=t.vals;
  PROPOSAL_PARTS[key]=keep.slice(1).map((end,i)=>costs.slice(keep[i],end));
  let offset=0;
  for (const g of t.gens){
    const end=offset+g.n, selected=keep.slice(1).filter(v=>v>offset&&v<=end);
    g.cost=selected.map(v=>PROPOSAL_PARTS[key][keep.indexOf(v)-1].reduce((n,c)=>n+c,0));
    g.n=selected.length;offset=end;
  }
  t.vals=keep.map(i=>oldVals[i]);
}
// Preserve rounding of EACH original component at 50% / basket-plan 10%.
// Rounding only the merged bill would change the complete copied-track price.
function proposalDiscount(k,L,d){
  const ge=genAt(k,L), parts=PROPOSAL_PARTS[k]?.[L]||[ge.g.cost[ge.idx]];
  return parts.reduce((n,c)=>n+niceCost(c*d),0);
}
`;
  let s=once(source,'const TRACK_ORDER =',patch+'\nconst TRACK_ORDER =');
  const replacements=[
    ['METAL_CARRY = [2, 2, 3, 3, 4, 5, 6, 7, 10, 14]','METAL_CARRY = [2, 2, 3, 3, 5, 7, 10, 14]'],
    ['INGOT_CARRY = [1, 1, 1, 2, 3, 4, 5, 6, 10, 14]','INGOT_CARRY = [1, 1, 1, 2, 4, 6, 10, 14]'],
    ['COAL_CARRY  = [1, 2, 3, 4, 6, 8, 10, 12, 19, 28]','COAL_CARRY  = [1, 2, 3, 4, 8, 12, 19, 28]'],
    ['niceCost(full*discFor(k))','proposalDiscount(k,L,discFor(k))'],
    ['niceCost(f*discFor(k)) : f; };','proposalDiscount(k,L,discFor(k)) : f; };'],
    ['niceCost(f*discFor(k)); }','proposalDiscount(k,l,discFor(k)); }'],
    ['niceCost(f*discFor(k)) : f;','proposalDiscount(k,L,discFor(k)) : f;'],
    ['Four new wheel upgrades for every Robot.','Two new wheel upgrades for every Robot.'],
    ['Four new basket upgrades.','Two new basket upgrades.'],
    ['Three faster pickup upgrades.','Two faster pickup upgrades.'],
    ['Four Operate machinery upgrades:','Three Operate machinery upgrades:'],
    ['Three more Resource efficiency upgrades:','Two more Resource efficiency upgrades:'],
    ['Three stronger tree shaking upgrades:','Two stronger tree shaking upgrades:'],
    ['The last two leaf drying upgrades:','The final leaf drying upgrade:']
  ];
  for(const [a,b]of replacements)s=once(s,a,b);
  return s;
}
function prepare(){
  assert(!fs.existsSync(path.join(out,'baseline','game')),'Use a fresh RESULT_DIR; never replace evidence.');
  for(const arm of ['baseline','candidate'])for(const f of files){
    const dest=path.join(out,arm,'game',f);fs.mkdirSync(path.dirname(dest),{recursive:true});
    const data=fs.readFileSync(path.join(root,'public',f));fs.writeFileSync(dest,arm==='candidate'&&f==='game.js'?candidate(data.toString()):data);
  }
  fs.writeFileSync(path.join(out,'proposal.json'),JSON.stringify({endpoints,source:hash(fs.readFileSync(path.join(out,'baseline/game/game.js'))),script:hash(fs.readFileSync(__filename))},null,2));
}
async function run(){
  const config=JSON.parse(fs.readFileSync(process.env.CONFIG||path.join(__dirname,'completion-policy.json'),'utf8'));
  const seeds=(process.env.SEEDS||'1801,1802,1803,1804,1805,1806').split(',').map(Number);
  const policies=(process.env.POLICIES||'smart,smart-skip,smart-balanced').split(',');
  for(const arm of (process.env.ARMS||'baseline,candidate').split(',')){
    process.env.GAME_ROOT=path.join(out,arm,'game');
    const dir=path.join(out,arm,process.env.SUITE||'campaigns'),runner=await createRunner(dir),rows=[];
    const jobs=seeds.flatMap(seed=>policies.map(name=>({name,seed,config,fidelity:process.env.FIDELITY||'sim'})));let ix=0;
    try{
      await Promise.all(Array.from({length:3},async()=>{while(ix<jobs.length){const r=await runner.run(jobs[ix++]);r.audit=audit(r);rows.push(r);}}));
      const first=rows.find(r=>r.name==='smart'&&r.seed===seeds[0])||rows[0];
      const repeat=await runner.run({...jobs.find(j=>j.name===first.name&&j.seed===first.seed),name:first.name});audit(repeat);
      assert.equal(replayTrace(first),replayTrace(repeat),'Exact replay diverged');
      fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify({manifest:runner.manifest,config,seeds,replayIdentical:true,results:rows.map(compact)},null,2));
    }finally{await runner.close();}
  }
}
async function challengers(){
  const config=JSON.parse(fs.readFileSync(path.join(__dirname,'completion-policy.json'),'utf8'));
  // An explicit source experiment replaces the automatic honey intervention.
  // Every arm therefore shares the capable honey-skipping prefix in its variant.
  delete config.honeyMax;
  const source=fs.readFileSync(path.join(__dirname,'source-experiment.js'),'utf8');
  const selected=JSON.parse(fs.readFileSync(path.join(__dirname,'selected-source-policies.json'),'utf8'));
  const seeds=(process.env.SEEDS||'1901,1902').split(',').map(Number),phase=4;
  const plans=['mixed','leaf','raw','industry','honey-full'];
  for(const arm of (process.env.ARMS||'baseline,candidate').split(',')){
    process.env.GAME_ROOT=path.join(out,arm,'game');
    const dir=path.join(out,arm,'challengers'),runner=await createRunner(dir),rows=[],checkpoints=new Map();
    const jobs=seeds.flatMap(seed=>plans.map(plan=>({name:plan,seed,config,
      experiment:{source,options:plan==='honey-full'?{mode:'paid',phase,focus:'honey',staffing:'specialist',maxHoney:'full',secondary:'raw',snippers:1,packers:2,bias:16,costPower:.85,payback:8,minutes:90}:
        {...selected[phase][plan],staffing:'specialist'}}})));let ix=0;
    try{
      await Promise.all(Array.from({length:3},async()=>{while(ix<jobs.length){
        const r=await runner.run(jobs[ix++]);r.audit=audit(r);
        const e=r.stages.find(s=>s.phase===phase).experiment;assert(e?.checkpoint,'Missing earned checkpoint');
        const signature=hash(JSON.stringify(e.checkpoint));
        if(checkpoints.has(r.seed))assert.equal(signature,checkpoints.get(r.seed),'Unequal matched forks');else checkpoints.set(r.seed,signature);
        assert(!e.grantedCapital&&!e.fixturePurchases.length,'Paid challenger received a grant');rows.push(r);
      }}));
      fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify({manifest:runner.manifest,config,seeds,checkpointHashes:Object.fromEntries(checkpoints),results:rows.map(compact)},null,2));
    }finally{await runner.close();}
  }
}
async function checks(){
  const {pathToFileURL}=require('node:url');
  const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/kallek/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'});
  const results={};let assertions=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);assertions++;};
  try{for(const lot of ['home','hollow']){
    results[lot]={};
    for(const arm of ['baseline','candidate']){
      const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.route(/^https:\/\//,r=>r.abort());await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
      await page.goto(pathToFileURL(path.join(out,arm,'game/index.html')).href+'?fresh&lot='+lot);await page.waitForFunction(()=>window.__leafYard);
      const data=await page.evaluate(()=>{
        const Y=__leafYard;Y.dev('simMode=true;S.cash=S.peak=1e8;S.bag.built=true;S.metalSlot=true;S.plant.built=true;S.story.found=true;S.flags.dryKnown=true;S.shafts=[0];for(const k in TECH)S.tech[k]=true;S.robots.push(newRobotCfg(),newRobotCfg());S.blowers.push(newHelperCfg("blower"));S.shakers.push(newHelperCfg("shaker"));bindIds();syncRobots();syncHelpers();');
        Y.dev('for(const list of [S.robots,S.blowers,S.shakers])for(const c of list)for(const k in c.lv)c.lv[k]=0;');
        const definitions=Y.dev('({tracks:TRACKS,tech:TECH,up:UP,gen:GEN,carry:[METAL_CARRY,INGOT_CARRY,COAL_CARRY]})'),paid={};
        for(const k of Y.dev('Object.keys(TRACKS)')){
          if(!Y.dev(`BOT_TRACKS[trackKind('${k}')].includes('${k}')`))continue;
          const kind=Y.dev(`trackKind('${k}')`),prices=[];
          while(Y.dev(`cfgsOf('${kind}')[0].lv['${k}'] < trackMax('${k}')`)){
            if(prices.length>30)throw Error('Non-advancing paid track '+k+' '+kind);
            const c=Y.dev(`botCost('${kind}',0,'${k}')`),before=Y.state().cash;
            if(!c||!Y.buy({id:kind==='robot'?'rup':'hup',kind,ri:0,key:k,obj:kind+'0',cost:c.cost}))throw Error('Actual purchase rejected '+k);
            prices.push(before-Y.state().cash);
          }
          paid[k]=prices;
        }
        const copies={};
        for(const basket of [false,true]){
          Y.state().gen.basket=basket?1:0;
          for(const k of Y.dev('TRACK_ORDER')){
            Y.state().robots[1].lv[k]=Y.state().robots[2].lv[k]=0;
            const plan=Y.dev(`maxPlan('robot',1,'${k}')`),before=Y.state().cash;
            if(!Y.buy({id:'rmax',kind:'robot',ri:1,key:k,obj:'robot1',...plan}))throw Error('Match rejected');
            const match=before-Y.state().cash;
            let single=0,steps=0;
            while(Y.state().robots[2].lv[k]<Y.state().robots[0].lv[k]){
              if(++steps>30)throw Error('Non-advancing copied track '+k);
              const c=Y.fn().rCost(2,k),cash=Y.state().cash;
              if(!Y.buy({id:'rup',ri:2,key:k,obj:'robot2',cost:c.cost}))throw Error('Copy rejected');single+=cash-Y.state().cash;
            }
            Y.state().robots[1].lv[k]=Y.state().robots[2].lv[k]=0;
            const all=Y.fn().allPlan(k),cash=Y.state().cash;
            if(!Y.buy({id:'rall',key:k,obj:'robot1',...all}))throw Error('All rejected');
            copies[k+':'+basket]={match,single,all:cash-Y.state().cash,level:Y.state().robots[2].lv[k]};
          }
        }
        return{...definitions,paid,copies};
      });
      eq(errors,[]);results[lot][arm]=data;await page.close();
    }
    const a=results[lot].baseline,b=results[lot].candidate;
    eq(a.up,b.up);eq(a.gen,b.gen);
    for(const k of Object.keys(a.tech))eq(a.tech[k].cost,b.tech[k].cost);
    for(const [k,t]of Object.entries(a.tracks)){
      const u=b.tracks[k];eq(u.vals.at(-1),t.vals.at(-1));
      eq(u.gens.reduce((n,g)=>n+g.n,0),u.vals.length-1);
      eq(u.gens.flatMap(g=>g.cost).reduce((n,c)=>n+c,0),t.gens.flatMap(g=>g.cost).reduce((n,c)=>n+c,0));
      if(k!=='blow')for(let i=0;i<t.gens.length;i++)eq(u.gens[i].cost.reduce((n,c)=>n+c,0),t.gens[i].cost.reduce((n,c)=>n+c,0));
      const rounded=x=>Math.round(x*100);
      if(a.paid[k])eq(rounded(a.paid[k].reduce((n,c)=>n+c,0)),rounded(b.paid[k].reduce((n,c)=>n+c,0)));
      for(const basket of [false,true])if(a.copies[k+':'+basket])for(const type of ['match','single','all']){
        eq(rounded(a.copies[k+':'+basket][type]),rounded(b.copies[k+':'+basket][type]),lot+' '+k+' '+basket+' '+type);
      }
    }
    for(let i=0;i<3;i++)eq(b.carry[i],endpoints.carry.map(j=>a.carry[i][j]));
  }}finally{await browser.close();}
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({assertions,results},null,2));
  console.log(assertions+' endpoint, cost, actual purchase, Match/All, copy rounding, yard and capacity assertions passed.');
}
async function boundaries(){
  const {pathToFileURL}=require('node:url');
  const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/kallek/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'}),results={};
  try{for(const arm of ['baseline','candidate']){
    const page=await browser.newPage();await page.route(/^https:\/\//,r=>r.abort());await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
    await page.goto(pathToFileURL(path.join(out,arm,'game/index.html')).href+'?fresh');await page.waitForFunction(()=>window.__leafYard);
    results[arm]=await page.evaluate(()=>{
      const Y=__leafYard;
      Y.dev('simMode=true;S=freshState();bindIds();S.story.item="ruin";S.story.found=S.story.done=S.flags.ruinKnown=S.plant.built=true;S.totals.ingotsSold=999;updMilestones();');
      const below={reached:Y.state().miles.ingots!=null,posted:Y.state().post.includes('final')};
      Y.dev('S.totals.ingotsSold=1000;updMilestones();updMilestones();');
      return{below,at:{reached:Y.state().miles.ingots!=null,letters:Y.state().post.filter(id=>id==='final').length},goal:Y.dev('INGOT_GOAL')};
    });
    assert.deepEqual(results[arm],{below:{reached:false,posted:false},at:{reached:true,letters:1},goal:1000});await page.close();
  }}finally{await browser.close();}
  fs.writeFileSync(path.join(out,'boundaries.json'),JSON.stringify(results,null,2));console.log('999/1000 final-goal boundaries and exactly one final letter passed in both variants.');
}
if(require.main===module){const modes={prepare,run,checks,challengers,boundaries};assert(modes[process.argv[2]],'Mode: prepare | checks | run | challengers | boundaries');Promise.resolve(modes[process.argv[2]]()).catch(e=>{console.error(e);process.exitCode=1;});}
module.exports={endpoints,candidate};
