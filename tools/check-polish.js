'use strict';
// V42 regressions: isolated saves, actual pickups, rolling production and resource cards.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/kallek/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../public');
(async()=>{
 const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');const file=path.join(root,u.pathname==='/'?'index.html':u.pathname);try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'}),errors=[];
 const base=`http://127.0.0.1:${server.address().port}/`;let checks=0;
 const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},ok=v=>{assert(v);checks++;},near=(a,b)=>{assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);checks++;};
 async function page(lot='home',mobile=false){const p=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:800},hasTouch:mobile,isMobile:mobile,serviceWorkers:'block',reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));await p.route(/^https:\/\//,r=>r.abort());await p.addInitScript(()=>window.requestAnimationFrame=()=>0);await p.goto(base+'?fresh'+(lot==='home'?'':'&lot='+lot));await p.waitForFunction(()=>window.__leafYard,null,{polling:50});await p.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'});return p;}
 const dev=(p,s)=>p.evaluate(s=>__leafYard.dev(s),s);
 const mature=`S.metalSlot=true;S.land=1;S.bag.built=true;S.plant.built=true;S.flags.ruinKnown=true;S.story.done=true;S.flags.snipKnown=true;S.hive.built=true;S.hive.bees=4;S.hive.packing=true;S.cash=S.peak=100000;S.eye.built=true;for(const k in TECH)S.tech[k]=true;S.miners=SPOTS.map((_,i)=>i).slice(0,2);S.flags.antHill=true;S.flags.coalKnown=true;bindIds();syncRobots();syncBees();`;
 try{
  let p=await page();
  const mine=await dev(p,`(()=>{S.metalSlot=true;S.land=1;S.miners=[0,1];S.robots.push(newRobotCfg());bindIds();syncRobots();assign(0,0);assign(1,1);openCard('spot',1);const before=JSON.stringify(S.robots[0]);assignTo('robot',0,'mine');const blocked=before===JSON.stringify(S.robots[0]);const note=cardNote;const info=assignmentInfo('robot',0,'mine');S.shafts.push(1);assignTo('robot',0,'mine');return{blocked,note,info,after:S.robots.map(c=>c.miner),slots:R.map(r=>r.mslot)}})()`);
  ok(mine.blocked);ok(mine.note.includes('full'));ok(mine.info.blocked);eq(mine.after,[1,1]);eq([...mine.slots].sort(),[0,1]);
  const reset=await dev(p,`(()=>{S.t=600;EYE.full.metalBin=600;EYE.acc.robot0={mine:100};EYE.idleAcc.robot0=25;overviewReturn={owner:S};recordSale({takeL:1},0,0,leafPrice());hardReset();return{full:EYE.full,acc:EYE.acc,idle:EYE.idleAcc,score:EYE.score,back:overviewReturn,sales:S.sales,future:eyeFullLately('metalBin'),rates:productionRate('picked')}})()`);
  eq(reset,{full:{},acc:{},idle:{},score:0,back:null,sales:[],future:false,rates:0});
  const rack=await dev(p,`(()=>{${mature}S.plant.rack=rackCap();S.ingots=0;eyeScan();return{full:eyeFullLately('pallet'),suggested:EYE.lo.some(o=>o.key==='bu:pallet'),tracks:EYE_TRACKS.robot}})()`);
  ok(rack.full);ok(rack.suggested);ok(rack.tracks.smelt.includes('magnet'));ok(rack.tracks.mine.includes('speed'));
  const demand=await dev(p,`(()=>{S.shakers=[newHelperCfg('shaker')];S.shakers[0].prio=[['shake']];S.shakers[0].off=['snip'];bindIds();syncHelpers();FLOWERS.forEach(f=>{f.full=true;f.t=0;f.claim=null});S.t=100;eyeScan();S.t=130;eyeScan();const fresh=EYE.issues.some(o=>o.key==='snip');const f=FLOWERS.find(f=>flowerOn(f));f.full=false;f.t=0;S.t=131;eyeScan();S.t=160;eyeScan();return{fresh,spent:EYE.issues.some(o=>o.key==='snip')}})()`);
  eq(demand,{fresh:false,spent:true});
  const crew=await dev(p,`(()=>{S.robots.push(newRobotCfg());S.robots[1].away='hollow';putTop(S.robots[0],'bag');putTop(S.robots[1],'bag');bindIds();syncRobots();const d=document.createElement('div');d.innerHTML=crewRow('bag','Baggers','bag').html;return{portraits:[...d.querySelectorAll('img')].map(i=>i.alt),text:d.textContent,html:assignPicker([['robot','bag']])}})()`);
  eq(crew.portraits,['Tinker']);ok(crew.text.includes('1 assigned'));ok(crew.html.includes('candidate'));await p.close();

  p=await page();
  const rates=await dev(p,`(()=>{resetProduction();for(let i=0;i<40;i++){S.t++;productionAdd('picked',i<10?20:2);productionAdd('converted',6);productionAdd('made',.5);S.totals.bags++;sampleProduction()}const out={picked:productionRate('picked'),bags:productionRate('bags'),converted:productionRate('converted'),made:productionRate('made'),samples:PROD.samples.length};for(let i=0;i<30;i++){S.t++;sampleProduction()}out.stopped=productionRate('picked');out.honeyStopped=productionRate('made');S=freshState();out.newState=productionRate('picked');return out})()`);
  near(rates.picked,2);near(rates.bags,1);near(rates.converted,6);near(rates.made,.5);near(rates.stopped,0);near(rates.honeyStopped,0);near(rates.newState,0);ok(rates.samples<=32);
  const work=await dev(p,`(()=>{resetProduction();S.hive.built=true;S.hive.nectar=100;S.t=1;updHive(1);sampleProduction();const converted=productionRate('converted'),made=productionRate('made');const r=R[0],l=newLeaf(0,0,0,true);l.st='ground';l.claim=r;r.plan=[l];grabLeaves(r);return{converted,made,picked:productionRate('picked'),expected:fanRate(),recipe:jarNectar()}})()`);near(work.converted,work.expected);near(work.made,work.expected/work.recipe);near(work.picked,1);await p.close();

  for(const lot of ['home','hollow']){
   p=await page(lot);
   const receipt=await dev(p,`(()=>{${mature}simMode=true;S.lv.cleanup=1;S.cleanN=95;S.coalCredit=COAL?.5:0;const before=S.cash;Object.assign(truck,{st:'load',timer:0,takeL:DRY_BENCH?0:7,takeB:2,takeM:3,takeI:4,takeH:5,takeG:2});updTruck(.1);simMode=false;const sale=S.sales[0];const original=JSON.stringify(sale);S.lv.leafPrice++;S.lv.honeyPrice++;S.lv.metalPrice++;openCard('sign');const text=card.textContent;const leaf=receiptPanel('leaf').html,honey=receiptPanel('honey').html;const saved=JSON.parse(JSON.stringify(S));load({S:saved});return{sale,paid:S.cash-before,sum:sale.items.reduce((n,q)=>n+q.amount,0)+sale.bonus,unchanged:original===JSON.stringify(S.sales[0]),text,leaf,honey}})()`);
   near(receipt.sale.total,receipt.paid);near(receipt.sale.total,receipt.sum);ok(receipt.unchanged);eq(receipt.sale.items.map(q=>q.n),[lot==='hollow'?0:7,2,3,4,5,2]);ok(receipt.sale.bonus>0);ok(receipt.text.includes('Total paid'));ok(receipt.text.includes('Recent production'));ok(!receipt.leaf.includes('Honey jars'));ok(!receipt.honey.includes('Raw metal'));if(lot==='hollow'){ok(receipt.text.includes('Canned mushrooms'));ok(receipt.text.includes('Raw logs'));ok(receipt.text.includes('Charcoal'));ok(receipt.sale.credit>0);}
   const empty=await dev(p,`(()=>{for(let i=0;i<7;i++)recordSale({takeL:0,takeB:0,takeM:0,takeI:0,takeH:0,takeG:0},0,0,0);return{length:S.sales.length,total:S.sales[0].total,html:receiptPanel().html}})()`);eq(empty.length,5);eq(empty.total,0);ok(empty.html.includes('Nothing sold'));await p.close();
  }

  fs.mkdirSync(path.resolve(__dirname,'../runs/v42-ui'),{recursive:true});
  for(const lot of ['home','hollow','prairie'])for(const mobile of [false,true]){
   p=await page(lot,mobile);await dev(p,`${mature}resetProduction();S.t+=30;productionAdd('picked',78);productionAdd('converted',90);productionAdd('made',5);S.totals.bags=4;S.totals.nectar=120;S.totals.jars=3;sampleProduction();recordSale({takeL:DRY_BENCH?0:17,takeB:5,takeM:8,takeI:6,takeH:8,takeG:2},18,0,17*leafPrice()+5*bagPrice()+8*metalPrice()+6*ingotPrice()+8*honeyPrice()+2*giftJarPrice()+18);`);
   for(const card of ['sign','bin','hive','plant','spot','robot','shed','eye']){
    await dev(p,`openCard('${card}',0);updHud(.1);draw();`);
    const bounds=await p.evaluate(()=>{const c=document.getElementById('card'),b=c.getBoundingClientRect();return{overflow:c.scrollWidth>c.clientWidth+2,x:b.x,right:b.right,w:innerWidth,text:c.textContent};});
    ok(!bounds.overflow);ok(bounds.x>=-1&&bounds.right<=bounds.w+1);if(card==='plant')ok(bounds.text.includes('Keep for'));if(card==='hive'){ok(bounds.text.includes('Processing:'));ok(bounds.text.includes('Recent production'));}if(['sign','hive'].includes(card))await p.screenshot({path:path.resolve(__dirname,`../runs/v42-ui/${lot}-${mobile?'mobile':'desktop'}-${card}.png`)});
   }
   await dev(p,`EYE.issues=[{key:'test',what:'Test',why:'Test',go:['bin'],at:BIN,w:20}];openCard('eye');card.querySelector('.cbody').scrollTop=100;eyeGo('test');`);
   await p.waitForFunction(()=>document.querySelector('[data-act="eyeback"]'),null,{polling:50});
   const backTab=await dev(p,'overviewReturn.tab');await dev(p,"cardTab=cardTab==='tasks'?'up':'tasks';renderCard(true);");
   await p.locator('[data-act="eyeback"]').evaluate(e=>e.click());eq(await dev(p,'cardOpen.kind'),'eye');eq(await dev(p,'cardTab'),backTab);
   await p.close();
  }
  eq(errors,[]);console.log(`${checks} polish checks passed; desktop/mobile previews in runs/v42-ui/`);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
