'use strict';
// Browser integration checks for the isolated pacing candidate, including real RAF.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const {out,sha}=require('./pacing-study.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/kallek/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const checks=[],errors=[];
const variant=process.env.VARIANT||'';
function close(a,b,tol=1e-7){assert(Math.abs(a-b)<tol,`${a} != ${b}`);}
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'});
 async function page(arm,lot='',live=false){
  const context=await browser.newContext({viewport:{width:1280,height:800}}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.route(/^https:\/\//,r=>r.abort());
  await p.addInitScript(({live})=>{let a=1939;Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};if(!live)window.requestAnimationFrame=()=>0;},{live});
  const dir=variant&&arm!=='naive'?variant+'-'+arm:arm;
  await p.goto(pathToFileURL(path.join(out,dir,'index.html')).href+'?fresh'+(lot?'&lot='+lot:''));await p.waitForFunction(()=>window.__leafYard);return {p,context};
 }
 const dev=(p,s)=>p.evaluate(s=>__leafYard.dev(s),s);
 try{
  // Exact production parameters remain identical; only their time display changes.
  for(const lot of ['','hollow']){
   const all={};for(const arm of ['baseline','naive','candidate']){
    const {p,context}=await page(arm,lot);
    all[arm]=await dev(p,`({duration:WORLD_DURATION,ui:{timer:mmss(30),truck:UP_VAL.truck(60)[0],pick:TRACK_VAL.pick(1.3)[0],drill:TRACK_VAL.drill(2)[0],study:TRACK_VAL.study(1)[0],fan:HIVE_SHORT.fan,desc:TECH.fineWrist.desc},economy:{TRACKS,UP,GEN,prices:[BAG_TIME,JAR_TIME,WRAP_TIME,SMELT_TIME,LOG_BURN],truck:truckEvery(),capacities:[binCap(),metalCap(),tankCap(),honeyCap()]}})`);
    await context.close();
   }
   assert.deepEqual(all.baseline.economy,all.candidate.economy);assert.deepEqual(all.baseline.ui,all.naive.ui);
   assert.equal(all.candidate.ui.timer,'0:36');assert.equal(all.candidate.ui.truck,'72s');assert.equal(all.candidate.ui.pick,'1.56s');assert.equal(all.candidate.ui.drill,'2.4s');close(all.candidate.ui.study,3.33,.001);
   checks.push({test:'economy-and-ui',lot:lot||'home',economicHash:sha(all.baseline.economy),naiveUIWrong:true,ui:all.candidate.ui});
  }
  {
   const {p,context}=await page('candidate');
   const data=await dev(p,`(()=>{simMode=false;resetProduction();S.t+=12;PROD.extra.picked=120;sampleProduction();return{raw:productionRate('picked'),shown:displayedProductionRate('picked')};})()`);
   close(data.raw,10);close(data.shown,10/1.2);checks.push({test:'measured-production-rate',...data});await context.close();
  }
  // Actual frame(), including normal HUD/tutorial/camera dispatch. Rendering work is
  // disabled for deterministic time injection; separate real RAF checks below render.
  for(const arm of ['baseline','candidate'])for(const lot of ['','hollow']){
   const {p,context}=await page(arm,lot);
   const data=await dev(p,`(()=>{draw=()=>{};updGround=()=>{};last=0;WORLD.runT=0;const start=S.t,rt=WORLD.runT;for(let i=1;i<=120;i++)frame(i*1000/60);const game=S.t-start,run=(WORLD.runT||0)-rt;setPaused(true);const frozen=S.t;for(let i=121;i<=180;i++)frame(i*1000/60);const paused=S.t===frozen;setPaused(false);setSpeed(2);for(let i=181;i<=240;i++)frame(i*1000/60);return{game,run,paused,fast:S.t-frozen,speedReal};})()`);
   const d=arm==='baseline'?1:1.2;close(data.game,2/d);close(data.run,2/d);close(data.fast,2/d);assert(data.paused);assert(data.speedReal>1.85&&data.speedReal<2.05);
   checks.push({test:'frame-pause-fast-forward',arm,lot:lot||'home',...data});await context.close();
  }
  // Payment starts the next clock. Both the payout display and driving away spend
  // that already-running countdown; departure does not start a fresh interval.
  {
   const {p,context}=await page('candidate');
   const data=await dev(p,`(()=>{simMode=false;S.binLeaves=20;S.keep.leaves=0;Object.assign(truck,{st:'arrive',x:PARK,dropOnly:false,riders:[],arriving:false});updTruck(.01);truck.timer=0;updTruck(.01);const paid={cash:S.cash,timer:S.truckT,state:truck.st};truck.timer=100;updTruck(.5);const payout=S.truckT;truck.st='leave';truck.x=PARK;truck.v=10;updTruck(.5);return{paid,payout,departing:S.truckT,every:truckEvery()};})()`);
   assert(data.paid.cash>0);assert.equal(data.paid.state,'pay');close(data.paid.timer,data.every);close(data.payout,data.every-.5);close(data.departing,data.every-1);checks.push({test:'truck-countdown-starts-at-payment',...data});await context.close();
  }
  // Mechanism probes include continuous rates, worker movement/action timers,
  // natural replenishment, research and adverse resource consumption.
  for(const lot of ['','hollow']){
   const results={};for(const arm of ['baseline','candidate']){
    const {p,context}=await page(arm,lot);
    results[arm]=await dev(p,`(()=>{simMode=true;applyKit(${lot?"'hollowKiln'":"'homeSmelt'"});syncRobots();syncHelpers();syncBees();S.post=[];S.letters=[];S.trip=null;S.hive.built=true;S.hive.nectar=100;S.hive.honey=0;S.plant.coal=10;S.truckT=100;truck.st='away';for(const f of FLOWERS){f.full=false;f.t=0;}const before=JSON.parse(JSON.stringify(S));const n=240;for(let i=0;i<n;i++)advanceWorld(.05*WORLD_DURATION);return{state:S,workers:R.map(r=>({x:r.x,y:r.y,st:r.st,timer:r.timer,workP:r.workP,mineP:r.mineP,carryL:r.carryL,carryI:r.carryI})),helpers:HB.map(h=>({x:h.x,y:h.y,st:h.st,timer:h.timer})),flowers:FLOWERS.map(f=>({full:f.full,t:f.t})),before,realSeconds:n*.05*WORLD_DURATION};})()`);
    await context.close();
   }
   const a=results.baseline,b=results.candidate;assert.deepEqual(a.state,b.state);assert.deepEqual(a.workers,b.workers);assert.deepEqual(a.helpers,b.helpers);assert.deepEqual(a.flowers,b.flowers);close(b.realSeconds/a.realSeconds,1.2);
   checks.push({test:'active-subsystems-matched',lot:lot||'home',stateHash:sha(a.state),gameSeconds:a.state.t-a.before.t,realSeconds:b.realSeconds,workers:a.workers.length,helpers:a.helpers.length,coalUsed:a.before.plant.coal-a.state.plant.coal});
  }
  // Deliberately activate fuel consumption and weather decay; merely loading a
  // furnace fixture does not establish that a worker was actually smelting.
  for(const lot of ['','hollow']){
   const results={};for(const arm of ['baseline','candidate']){
    const {p,context}=await page(arm,lot);
    results[arm]=await dev(p,`(()=>{simMode=true;S.plant.built=true;S.plant.coal=10;S.truckT=1000;truck.st='away';S.hive.built=true;S.hive.nectar=100;S.hive.honey=0;R[0].st='smelt';R[0].workP=0;R[0].workDur=100;R[0].hammer=0;shakeCD.tree[0]=10;for(const f of FLOWERS){f.full=false;f.t=0;f.regrow=100;}if(FIRE_STORY){S.bench.fire=true;S.bench.logs=3;S.bench.burn=0;S.bench.first=2;S.fire.L=.8;S.fire.struck=true;}for(let i=0;i<60*WORLD_DURATION;i++)advanceWorld(1/60);return{progress:R[0].workP,coalUsed:10-S.plant.coal,coalRate:COAL_BURN,plantCoal:PLANT_COAL,fire:FIRE_STORY?S.fire.L:null,burn:S.bench.burn,honey:S.hive.honey,cooldown:shakeCD.tree[0],flower:FLOWERS[0].t};})()`);
    await context.close();
   }
   assert.deepEqual(results.baseline,results.candidate);const d=results.candidate;close(d.progress,.01);close(d.cooldown,9);assert(d.honey>0);assert(d.flower>0);if(d.plantCoal){close(d.coalUsed,d.coalRate);assert(d.coalUsed>0);}if(lot==='hollow'){close(d.burn,1/45);close(d.fire,.794);}
   checks.push({test:'active-fuel-weather-and-cooldowns',lot:lot||'home',...d});
  }
  if(variant==='review'){
   const {p,context}=await page('candidate','hollow');
   const data=await dev(p,`(()=>{simMode=false;S.flags.dryKnown=false;S.flags.dryLab=false;const native=setTimeout,delays=[];window.setTimeout=(fn,ms)=>{delays.push(ms);return 0;};openDryLab();window.setTimeout=native;return{delays,desc:TECH.fineWrist.desc,camera:!!camFollow};})()`);
   assert(data.delays.some(v=>Math.abs(v-5640)<1e-7));assert(data.delays.some(v=>Math.abs(v-7440)<1e-7));assert(data.desc.includes('0.384 seconds'));assert(data.camera);checks.push({test:'scripted-delay-and-hardcoded-time',...data});await context.close();
  }
  // Real wall time and real requestAnimationFrame, with normal rendering enabled.
  // Keep contexts sequential to avoid manufacturing low FPS by overloading the GPU.
  for(const arm of ['baseline','candidate']){
   const {p,context}=await page(arm,'',true);
   await new Promise(r=>setTimeout(r,3000));
   const start=await dev(p,'({t:S.t,real:performance.now()})');
   await new Promise(r=>setTimeout(r,2400));
   const end=await dev(p,'({t:S.t,real:performance.now()})');
   const elapsed=(end.real-start.real)/1000,rate=(end.t-start.t)/elapsed,want=arm==='baseline'?1:1/1.2;
   assert(Math.abs(rate-want)<.055,'Real RAF timing outside tolerance: '+rate);checks.push({test:'real-rendered-raf',arm,realSeconds:elapsed,gameSeconds:end.t-start.t,rate,expected:want});
   if(arm==='candidate'){await p.screenshot({path:path.join(out,'candidate-browser.png')});}
   await context.close();
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,(variant?variant+'-':'')+'browser-checks.json'),JSON.stringify({checks,errors},null,2));console.log('Passed',checks.length,'browser timing/UI/subsystem checks.');
 }finally{fs.writeFileSync(path.join(out,(variant?variant+'-':'')+'browser-checks-partial.json'),JSON.stringify({checks,errors},null,2));await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
