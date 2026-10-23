'use strict';
// Shipped control, fixed steps, changing pace and persistent clock history.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/kallek/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../public'),out=path.resolve('runs/pacing-integration');
let checks=0;const near=(a,b,tol=1e-7)=>{assert(Math.abs(a-b)<tol,`${a} != ${b}`);checks++;},eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
async function main(){
 fs.mkdirSync(out,{recursive:true});const errors=[];
 const server=http.createServer((req,res)=>{const f=path.join(root,new URL(req.url,'http://localhost').pathname.replace(/^\/$/,'/index.html'));try{res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(f));}catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'});
 const dev=(p,s)=>p.evaluate(s=>__leafYard.dev(s),s);
 const context=async(mobile=false)=>{const c=await browser.newContext({viewport:mobile?{width:390,height:740}:{width:1280,height:900},serviceWorkers:'block',reducedMotion:'reduce'});await c.addInitScript(()=>{window.requestAnimationFrame=()=>0;let a=2137;Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};});return c;};
 const open=async(c,url='/?fresh')=>{const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.route(/^https:\/\//,r=>r.abort());await p.goto(base+url);await p.waitForFunction(()=>window.__leafYard&&__leafYard.dev('LH_READY'));return p;};
 try{
  const c=await context(),p=await open(c);eq(await dev(p,'WORLD_DURATION'),1);
  for(let i=0;i<3;i++)await p.locator('#hCash').click();eq(await p.locator('#testPanel').isVisible(),true);
  await p.locator('[data-t="duration:1.2"]').click();eq(await dev(p,'WORLD_DURATION'),1.2);eq(await dev(p,'TIME_SCALE'),1);eq(await p.locator('#speedTag').isHidden(),true);
  eq(await dev(p,'TRACK_VAL.pick(1.3)[0]'),'1.56s');eq(await dev(p,'TECH.fineWrist.desc'),'The final pickup upgrade: 0.384 seconds a grab.');eq(await p.locator('.tpdv').textContent(),'20% longer');
  const input=p.getByRole('spinbutton',{name:'Seconds per game second'});
  for(const [value,want]of [['1.5',1.5],['9',4],['0',4]]){await input.fill(value);await input.press('Enter');eq(await dev(p,'WORLD_DURATION'),want);eq(await input.inputValue(),String(want));}
  await p.locator('.tpd input[type=range]').fill('1.2');eq(await dev(p,'WORLD_DURATION'),1.2);
  await p.reload();await p.waitForFunction(()=>window.__leafYard&&__leafYard.dev('LH_READY'));eq(await dev(p,'WORLD_DURATION'),1.2);
  await p.goto(base+'/?fresh&lot=hollow');await p.waitForFunction(()=>window.__leafYard&&__leafYard.dev('LH_READY'));eq(await dev(p,'WORLD_DURATION'),1.2);eq(await dev(p,'LOT_ID'),'hollow');
  await dev(p,'hardReset()');await p.waitForFunction(()=>window.__leafYard&&__leafYard.dev('LH_READY'));eq(await dev(p,'WORLD_DURATION'),1.2);await c.close();
  const cadence=[];
  for(const duration of [.25,.5,1,1.1,1.2,1.5,2,4])for(const hz of [30,60,120]){
   const c=await context(),p=await open(c);
   const data=await dev(p,`(()=>{simMode=true;setDuration(${duration});const start=S.t;let done=0;for(let i=0;i<${hz}*3;i++)done+=advanceWorld(1/${hz});return{world:S.t-start,real:S.realT,done,acc:worldAccumulator};})()`);
   near(data.world,Math.floor((3/duration+1e-9)*60)/60);near(data.real,data.world*duration);near(data.done,data.world);assert(data.acc>=0&&data.acc<1/60);checks++;cadence.push({duration,hz,...data});await c.close();
  }
  {
   const c=await context(),p=await open(c);
   const data=await dev(p,`(()=>{draw=()=>{};updGround=()=>{};setDuration(1.2);last=0;WORLD.runT=WORLD.runRealT=0;window.fired=0;worldLater(()=>window.fired++,1);for(let i=1;i<=36;i++)frame(i*1000/60);setPaused(true);const before=[S.t,S.realT,WORLD.runRealT];for(let i=37;i<=96;i++)frame(i*1000/60);const paused=[S.t,S.realT,WORLD.runRealT];setPaused(false);setDuration(2);for(let i=97;i<=156;i++)frame(i*1000/60);return{before,paused,fired:window.fired,t:S.t,elapsed:S.realT};})()`);
   eq(data.before,data.paused);eq(data.fired,1);near(data.t,1);near(data.elapsed,1.6);await c.close();
  }
  {
   const c=await context(),p=await open(c);
   const data=await dev(p,`(()=>{WORLD.runT=100;WORLD.runRealT=100;setDuration(1.2);runClock(10);const a=WORLD.runRealT;setDuration(2);const b=WORLD.runRealT;runClock(10);S.t=90;S.realT=125;recordSale({takeL:1,takeB:0,takeM:0,takeI:0,takeH:0,takeG:0},0,0,leafPrice());const receipt=receiptPanel('leaf').html;setDuration(.5);const same=receiptPanel('leaf').html;const old=JSON.parse(JSON.stringify(S));delete old.realT;load({S:old});const migrated=S.realT;old.realT=140;load({S:old});return{a,b,end:WORLD.runRealT,receipt,same,migrated,preserved:S.realT};})()`);
   near(data.a,112);near(data.b,112);near(data.end,132);eq(data.receipt,data.same);assert(data.receipt.includes('2:05'));checks++;near(data.migrated,90);near(data.preserved,140);await c.close();
  }
  {
   const c=await context(),p=await open(c);
   const data=await dev(p,`(()=>{simMode=false;S.robots[0].prio=[];S.robots[0].off=KIND_TASKS.robot.slice();R[0].st='idle';resetProduction();setDuration(1);for(let i=0;i<360;i++){const done=advanceWorld(1/60);productionAdd('picked',done*10);}const first=productionRate('picked');setDuration(2);for(let i=0;i<360;i++){const done=advanceWorld(1/60);productionAdd('picked',done*10);}const mixed=productionRate('picked');setDuration(4);return{first,mixed,unchanged:productionRate('picked'),real:S.realT};})()`);
   near(data.first,10);near(data.mixed,7.5);near(data.unchanged,7.5);near(data.real,12);await c.close();
  }
  const economic=[];
  for(const lot of ['home','hollow']){
   const results=[];for(const duration of [1,1.2]){
    const c=await context(),p=await open(c,'/?fresh'+(lot==='home'?'':'&lot=hollow'));
    results.push(await dev(p,`(()=>{simMode=true;setDuration(${duration});applyKit('${lot==='home'?'homeSmelt':'hollowKiln'}');S.post=[];S.letters=[];S.trip=null;for(let i=0;i<1200;i++)advanceWorld(.05*WORLD_DURATION);const state=JSON.parse(JSON.stringify(S));delete state.realT;for(const sale of state.sales)delete sale.realT;return{state,workers:R.map(r=>({x:r.x,y:r.y,st:r.st,workP:r.workP})),helpers:HB.map(h=>({x:h.x,y:h.y,st:h.st})),flowers:FLOWERS.map(f=>({t:f.t,full:f.full}))};})()`));await c.close();
   }eq(results[0],results[1]);economic.push({lot,identical:true});
  }
  {
   const c=await context(),p=await open(c);
   const data=await dev(p,`(()=>{simMode=true;setSpeed(10000);advanceWorld(.05);setSpeed(1);const backlog=worldAccumulator,from=S.t;advanceWorld(1/60);return{backlog,delta:S.t-from};})()`);
   assert(data.backlog<1/60);checks++;near(data.delta,1/60);await c.close();
  }
  {
   const c=await context(true),p=await open(c);await dev(p,'toggleTestPanel(true)');await p.locator('[data-t="duration:1.2"]').click();const rect=await p.locator('#testPanel').boundingBox();assert(rect.y+rect.height<=740);checks++;await p.screenshot({path:path.join(out,'test-menu-mobile.png')});await c.close();
  }
  eq(errors,[]);fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({checks,cadence,economic,errors},null,2));console.log('Pacing checks passed:',checks,'assertions, 24 cadence/duration combinations, controls, saved history, measured rates, pause, travel and fast-forward backlog.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
