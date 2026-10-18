'use strict';
// V43: exercise player controls and historical receipts in isolated, fresh browser contexts.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/kallek/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../public');
(async()=>{
 const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),f=path.join(root,u.pathname==='/'?'index.html':u.pathname);res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(f));}catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'}),errors=[];
 const base=`http://127.0.0.1:${server.address().port}/`;let checks=0;
 const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},ok=(a,msg)=>{assert(a,msg);checks++;};
 async function page(lot='home',mobile=false,width=390){const p=await browser.newPage({viewport:mobile?{width,height:844}:{width:1280,height:800},hasTouch:mobile,isMobile:mobile,serviceWorkers:'block',reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));await p.route(/^https:\/\//,r=>r.abort());await p.addInitScript(()=>window.requestAnimationFrame=()=>0);await p.goto(base+'?fresh'+(lot==='home'?'':'&lot='+lot));await p.waitForFunction(()=>window.__leafYard,null,{polling:50});await p.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'});return p;}
 const dev=(p,s)=>p.evaluate(s=>__leafYard.dev(s),s);
 const click=(p,act)=>p.locator(`[data-act="${act}"]`).evaluate(e=>e.click());
 const mature=`S.cash=S.peak=100000;S.land=1;S.metalSlot=true;S.miners=[0,1];S.plant.built=true;S.flags.ruinKnown=true;S.hive.built=true;S.hive.bees=4;S.hive.packing=true;S.bag.built=true;S.story.done=true;S.flags.antHill=true;S.flags.coalKnown=true;S.flags.snipKnown=true;for(const k in TECH)S.tech[k]=true;bindIds();syncRobots();syncBees();`;
 try{
  // New skill highlights clear per purchased row for every button and robot/helper kind.
  for(const kind of ['robot','blower','shaker'])for(const action of ['rup','rmax','rall','allplus','tech']){
   const p=await page();
   await dev(p,`${mature}
    const list=cfgsOf('${kind}');
    if(!list.length)list.push(newHelperCfg('${kind}'));
    const peer='${kind}'==='robot'?newRobotCfg():newHelperCfg('${kind}');peer.sty=1;list.push(peer);
    bindIds();syncRobots();syncHelpers();
    list[0].lv.speed='${action}'==='tech'?3:0;list[1].lv.speed=['rmax','rall'].includes('${action}')?2:list[0].lv.speed;
    if('${action}'==='tech')delete S.tech.treads;
    S.flags.skSeen={};S.flags.taskHint=true;cardTab='up';openCard('${kind}',0);
   `);
   const button=action==='tech'?'tech:treads':(action==='allplus'?'rall':action)+':speed';
   const row=p.locator(`[data-act="${button}"]`).locator('xpath=ancestor::div[contains(@class,"row bot")]');
   ok((await row.getAttribute('class')).includes('fresh'),`${kind} ${action} starts highlighted`);
   const other=await p.locator('.row.bot.fresh').count();ok(other>1);
   // An unaffordable attempt keeps its highlight and levels.
   const levels=await dev(p,`cfgsOf('${kind}').map(c=>c.lv.speed)`);
   await dev(p,'S.cash=0;renderCard(true)');await click(p,button);
   eq(await dev(p,`cfgsOf('${kind}').map(c=>c.lv.speed)`),levels);
   ok(await dev(p,'cardOpen.freshT.has("speed")'));
   await dev(p,'S.cash=100000;renderCard(true)');await click(p,button);
   ok(!await dev(p,'cardOpen.freshT.has("speed")'),`${kind} ${action} acknowledges the skill`);
   eq(await p.locator('.row.bot.fresh').count(),other-1);
   eq(await p.locator('.row.bot .newtag').count(),other-1);
   if(action==='tech')ok(await dev(p,'S.tech.treads'));
   else ok(await dev(p,`cfgsOf('${kind}')[0].lv.speed>${levels[0]}`));
   await dev(p,`closeCard();openCard('${kind}',0)`);
   eq(await p.locator('.row.bot.fresh').count(),0);
   await p.close();
  }
  let p=await page();
  // A robot already studying the book stays checked, even with a shared/lower task row.
  await dev(p,"S.story.found=true;S.story.opened=true;S.robots.push(newRobotCfg());bindIds();syncRobots();S.robots[0].prio=[['research','leaves']];R[0].st='study';bookRt.by=0;bookRt.held=true;openCard('book')");
  for(const prio of [[['research','leaves']],[['leaves'],['research']]]){
   await dev(p,`S.robots[0].prio=${JSON.stringify(prio)};assignOpen='test';card.innerHTML=assignPicker([['robot','research']])`);
   eq(await p.locator('[data-act="asg:robot:0:research"]').getAttribute('aria-selected'),'true');
   eq(await p.locator('[data-act="asg:robot:1:research"]').getAttribute('aria-selected'),'false');
  }
  await dev(p,"S.robots[0].prio=[['research','leaves']];R[0].st='seek'");
  ok(await dev(p,"assignmentInfo('robot',0,'research').on"),'shared first-priority research remains assigned while travelling');
  await p.close();
  for(const lot of ['home','hollow']){
   p=await page(lot);await dev(p,`${mature}S.lv.hiveTank=0;S.lv.hiveStore=0;S.hive.up.fan=false`);
   eq(await dev(p,'fanRate()'),3);
   await dev(p,'S.hive.up.fan=true');eq(await dev(p,'fanRate()'),4.5);
   ok(/4\.50[\s\S]*9\.00/.test(await dev(p,"upRow('hiveTank').html")),'storage preview matches the next floor rate');
   ok((await dev(p,'HIVE_SHORT.fan')).includes('3 → 4.5'));
   ok((await dev(p,'HIVE_SHORT.fan')).includes('+50% conversion speed at every hive size'));
   for(let step=0;step<=10;step++){
    await dev(p,`S.lv.hiveTank=Math.min(${step},UP.hiveTank.max);S.lv.hiveStore=${step}-S.lv.hiveTank`);
    eq(await dev(p,'fanRate()'),(3+Math.ceil(step/2)*3)*1.5);
   }
   eq(await dev(p,'fanRate()'),27);
   await dev(p,'S.hive.up.fan=false');eq(await dev(p,'fanRate()'),18);
   await p.close();
  }
  p=await page();
  await dev(p,`${mature}S.robots[0].prio=[['leaves']];putOff(S.robots[0],'mine');openCard('spot',0);`);
  const before=await dev(p,'assignmentState(S.robots[0])');await click(p,'send');
  eq(await dev(p,'S.robots[0].prio[0]'),['mine']);eq(await dev(p,'S.robots[0].miner'),0);ok(await dev(p,'assignmentUndoValid()'));
  await click(p,'assignmentundo');eq(await dev(p,'assignmentState(S.robots[0])'),before);ok(!await dev(p,'assignmentUndoValid()'));
  await click(p,'send');await dev(p,'simMode=true;for(let i=0;i<1200;i++)step(.05);simMode=false;');ok(await dev(p,'S.totals.metal>0'),'Send one must lead to actual mining');
  await dev(p,`hardReset();${mature}S.robots.push(newRobotCfg());bindIds();syncRobots();putTop(S.robots[0],'mine');assign(0,0);assign(1,1);openCard('spot',1);`);
  const occupied=await dev(p,'S.robots.map(assignmentState)');await dev(p,"assignTo('robot',0,'mine')");eq(await dev(p,'S.robots.map(assignmentState)'),occupied);ok(!await dev(p,'assignmentUndoValid()'));
  await dev(p,`S.shafts=[1];assignTo('robot',0,'mine');R[0].st='mine';R[0].task='mine';undoAssignment();`);eq(await dev(p,'S.robots.map(c=>c.miner)'),[0,1]);eq(await dev(p,'R[0].st'),'idle');
  // A newly occupied old mine blocks Undo without evicting its new worker.
  await dev(p,`openCard('spot',1);assignTo('robot',0,'mine');assign(1,0);undoAssignment();`);eq(await dev(p,'S.robots.map(c=>c.miner)'),[1,0]);ok((await dev(p,'cardNote')).includes('no room'));
  await dev(p,`openCard('hive');assignTo('robot',0,'jar');S.robots[0].lv.pack=3;S.cash+=10;const cashNow=S.cash;undoAssignment();if(S.cash!==cashNow||S.robots[0].lv.pack!==3)throw Error('Undo rewound economy');`);checks++;
  await dev(p,`assignTo('robot',0,'jar');assignmentUndo.until=performance.now()-1;`);ok(!await dev(p,'assignmentUndoValid()'));await dev(p,`assignmentUndo=null;S.trip={to:'ending',who:0,crew:['robot']};putOff(S.robots[0],'travel');assignTo('robot',0,'travel');R[0].st='hopIn';`);ok(!await dev(p,'assignmentUndoValid()'));await dev(p,'hardReset()');eq(await dev(p,'assignmentUndo'),null);await p.close();

  p=await page();await dev(p,`${mature}S.miners=[0];putTop(S.robots[0],'mine');assign(0,0);S.hive.honey=4;openCard('hive');assignTo('robot',0,'jar');R[0].st='idle';updRobot(R[0],.05);`);
  eq(await dev(p,'S.robots[0].miner'),null);ok(await dev(p,'assignmentUndoValid()'),'Normal automatic release of a mine must not remove Undo');await dev(p,'undoAssignment()');eq(await dev(p,'S.robots[0].miner'),0);eq(await dev(p,'S.robots[0].prio[0]'),['mine']);await p.close();

  p=await page();await dev(p,`${mature}S.trip={to:'home',crew:['robot']};S.robots.push(newRobotCfg());bindIds();syncRobots();putTop(S.robots[0],'travel');putOff(S.robots[1],'travel');openCard('letter',0);`);
  // Returning trips allow only their arriving identity; use an unrestricted trip to check changing holders.
  await dev(p,`S.trip={to:'prairie',crew:['robot']};putTop(S.robots[0],'travel');putOff(S.robots[1],'travel');`);
  const tripBefore=await dev(p,'S.robots.map(assignmentState)');await dev(p,"assignTo('robot',1,'travel')");ok(await dev(p,'taskTop(S.robots[1],"travel")'));ok(!await dev(p,'taskOn(S.robots[0],"travel")'));await dev(p,'undoAssignment()');eq(await dev(p,'S.robots.map(assignmentState)'),tripBefore);await p.close();

  for(const lot of ['home','hollow']){
   p=await page(lot,true);await dev(p,`${mature}openCard('hive');`);
   const values=await dev(p,`[...card.querySelectorAll('.row')].filter(r=>r.textContent.includes('Per nectar')||r.textContent.includes('Per mushrooms')).map(r=>r.textContent).join(' ')`);
   ok(values.includes('plain:'));ok(values.includes(lot==='hollow'?'certified:':'gift:'));
   const basis=await dev(p,`(()=>{const n=jarNectar(),a=honeyPrice(),b=giftJarPrice();return{plain:cash$(a/n),gift:cash$(b/n),text:[...card.querySelectorAll('.row')].find(r=>r.textContent.includes('≈')&&r.textContent.includes('plain')).textContent}})()`);
   ok(basis.text.includes(basis.plain+' plain'));ok(basis.text.includes(basis.gift+(lot==='hollow'?' certified':' gift')));
   // Reserve figures belong to loading time, even when work and sliders change before payment.
   const retained=await dev(p,`(()=>{S.keep={leaves:.5,metal:.5,jars:.5};S.binLeaves=12;S.binMetal=6;S.hive.jars=5;S.ingots=4;simMode=true;Object.assign(truck,{st:'arrive',x:PARK,dropOnly:false});updTruck(.05);const kept={...truck.kept};S.keep={leaves:0,metal:0,jars:0};S.binLeaves=S.binMetal=S.hive.jars=0;truck.timer=0;updTruck(.05);simMode=false;const saved=JSON.parse(JSON.stringify(S));load({S:saved});return{kept,sale:S.sales[0],leaf:receiptPanel('leaf').html,metal:receiptPanel('metal').html,honey:receiptPanel('honey').html}})()`);
   eq(retained.sale.kept,retained.kept);eq(retained.kept,{leaf:lot==='home'?8:0,metal:4,jar:3});ok(!retained.metal.includes('rc-notes'));ok(!retained.honey.includes('rc-notes'));if(lot==='home')ok(!retained.leaf.includes('rc-notes'));
   const amounts=await dev(p,`(()=>{recordSale({takeL:0,takeB:0,takeM:0,takeI:10,takeH:0,takeG:0},0,0,10*ingotPrice());openCard('spot',0);return{text:card.querySelector('.resource-summary').textContent,finished:receiptMoney(10*ingotPrice())}})()`);ok(amounts.text.includes('$0.00'));await dev(p,"openCard('plant')");ok((await p.locator('.resource-summary').innerText()).includes(amounts.finished));eq(await dev(p,'cardOpen.kind'),'plant');
   // Old receipts have no reserve snapshot; never invent one from current sliders.
   const old=await dev(p,`delete S.sales[0].kept;S.keep.metal=1;receiptPanel('metal').html`);ok(!old.includes('retained'));
   await dev(p,`S.eye.built=true;EYE.issues=[];EYE.lo=[{key:'test'}];EYE.lvl=2;`);ok((await dev(p,"liveHTML('eye')")).includes('Upgrades available'));ok(!(await dev(p,"liveHTML('eye')")).includes('Some things stuck'));
   await p.close();
  }

  for(const mobile of [false,true]){
   p=await page('home',mobile);await dev(p,`${mature}openCard('plant');`);
   await p.locator('#keepM').focus();await p.keyboard.press('ArrowRight');eq(await dev(p,'S.keep.metal'),.05);eq(await dev(p,'[...keys]'),[]);
   await dev(p,'S.t+=2;sampleProduction();renderCard(true)');eq(await p.evaluate(()=>document.activeElement.id),'keepM');await p.keyboard.press('ArrowRight');eq(await dev(p,'S.keep.metal'),.1);
   await dev(p,`card.querySelector('#keepM').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));card.querySelector('#keepM').dispatchEvent(new PointerEvent('pointercancel',{bubbles:true}));openCard('sign');`);eq(await dev(p,'sliding'),false);eq(await p.locator('.ct').innerText(),'Pickups');
   await dev(p,`openCard('plant');card.querySelector('#keepM').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));dispatchEvent(new Event('blur'));`);eq(await dev(p,'sliding'),false);
   // A robot with many visible tasks and hidden research can be edited without dragging to Off.
   await dev(p,`S.flags.taskHint=true;S.robots[0].prio=[['leaves','bag'],['jar'],['wrap'],['refuel'],['smelt','haul'],['mine']];S.robots[0].off=['research','travel'];tasksFix(S.robots[0],'robot');cardTab='tasks';openCard('robot',0);`);
   const chip=p.locator('.tasks [data-task="mine"]');if(mobile)await chip.tap();else await chip.click();eq(await p.locator('.task-actions').count(),1);
   await p.locator('[data-act="taskmove:first"]').click();eq(await dev(p,'S.robots[0].prio[0]'),['mine']);
   const first=p.locator('.tasks [data-task="mine"]');await first.focus();await p.keyboard.press('Enter');await p.locator('[data-act="taskmove:off"]').click();ok(await dev(p,'S.robots[0].off.includes("mine")'));ok(await dev(p,'S.robots[0].off.includes("research")'));ok(await dev(p,'S.robots[0].prio.some(r=>r.includes("smelt")&&r.includes("haul"))'));
   await p.locator('.tasks [data-task="mine"]').focus();await p.keyboard.press('Space');await p.locator('[data-act="taskmove:first"]').click();eq(await dev(p,'S.robots[0].prio[0]'),['mine']);
   await p.locator('.tasks [data-task="mine"]').focus();await p.keyboard.press('Enter');await p.locator('[data-act="taskmove:down"]').click();eq(await dev(p,'S.robots[0].prio[1]'),['mine']);
   await p.locator('.tasks [data-task="mine"]').focus();await p.keyboard.press('Enter');await p.locator('[data-act="taskmove:up"]').click();eq(await dev(p,'S.robots[0].prio[0]'),['mine']);
   // Drag is still available, including cancelling a partially lifted chip.
   const r=await p.locator('.tasks [data-task="mine"]').boundingBox();await p.mouse.move(r.x+8,r.y+8);await p.mouse.down();await p.mouse.move(r.x+30,r.y+8);ok(await dev(p,'!!tdrag.on'));await dev(p,`card.dispatchEvent(new PointerEvent('pointercancel',{pointerId:tdrag.id,bubbles:true}))`);await p.mouse.up();eq(await dev(p,'tdrag'),null);eq(await p.locator('.ghost.chip').count(),0);eq(await p.locator('.tasks.dragging').count(),0);
   const source=await p.locator('.tasks [data-task="mine"]').boundingBox(),target=await p.locator('.trow[data-row="1"]').boundingBox();await p.mouse.move(source.x+8,source.y+8);await p.mouse.down();await p.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:5});await p.mouse.up();eq(await dev(p,'S.robots[0].prio.findIndex(r=>r.includes("mine"))'),1);
   await p.close();
  }

  fs.mkdirSync(path.resolve(__dirname,'../runs/v43-ui'),{recursive:true});
  for(const lot of ['home','hollow'])for(const mobile of [false,true]){
   p=await page(lot,mobile);await dev(p,`${mature}S.shafts=[0,1];S.shakers=Array.from({length:3},()=>newHelperCfg('shaker'));S.blowers=Array.from({length:3},()=>newHelperCfg('blower'));for(const c of S.shakers){c.lv.snip=1;c.prio=[['snip']]}for(const c of S.blowers){c.lv.dig=1;c.lv.stoke=1;c.prio=[['dig','stoke']]}bindIds();syncHelpers();const ss=HB.filter(h=>h.kind==='shaker'),bb=HB.filter(h=>h.kind==='blower');Object.assign(ss[0],{st:'snip',task:'snip'});Object.assign(ss[1],{st:'go',task:'snip'});Object.assign(ss[2],{st:'idle',task:null});Object.assign(bb[0],{st:'dig',task:'dig',dig:0});Object.assign(bb[1],{st:'go',task:'dig',dig:0});Object.assign(bb[2],{st:'stoke',task:'stoke'});`);
   const crew=await dev(p,"({snip:helperCrew('snip').html,dig:helperCrew('dig',0).html,other:helperCrew('dig',1).html,stoke:helperCrew('stoke').html})");for(const key of ['snip','dig'])ok(crew[key].includes('1 working · 1 on the way · 1 waiting · 3 assigned'));ok(crew.other.includes('0 working'));ok(crew.other.includes('Working at another mine'));ok(crew.stoke.includes('1 working'));
   const helperBefore=await dev(p,'assignmentState(S.blowers[0])');await dev(p,"openCard('plant');assignTo('blower',0,'stoke');renderCard(true)");eq(await p.locator('[data-act="assignmentundo"]').count(),1);await p.screenshot({path:path.resolve(__dirname,`../runs/v43-ui/${lot}-${mobile?'mobile':'desktop'}-undo.png`)});await click(p,'assignmentundo');eq(await dev(p,'assignmentState(S.blowers[0])'),helperBefore);
   for(const kind of ['hive','spot','plant','robot','eye','sign']){
    await dev(p,`openCard('${kind}',0);if('${kind}'==='robot'){cardTab='tasks';taskMenu='mine';renderCard(true)}draw()`);
    const bounds=await p.evaluate(()=>{const c=document.getElementById('card'),b=c.getBoundingClientRect();return{overflow:c.scrollWidth>c.clientWidth+2,left:b.left,right:b.right,w:innerWidth}});ok(!bounds.overflow,kind+' overflows');ok(bounds.left>=-1&&bounds.right<=bounds.w+1);
    if(['hive','robot'].includes(kind))await p.screenshot({path:path.resolve(__dirname,`../runs/v43-ui/${lot}-${mobile?'mobile':'desktop'}-${kind}.png`)});
   }
   // Away helpers cannot reappear in either totals or activity descriptions.
   await dev(p,"S.shakers[0].away='home'");ok((await dev(p,"helperCrew('snip').html")).includes('2 assigned'));await p.close();
  }
  eq(errors,[]);console.log(`${checks} V43 control and receipt checks passed; desktop/mobile previews in runs/v43-ui/`);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
