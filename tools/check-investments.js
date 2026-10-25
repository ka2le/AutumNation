'use strict';
// Economy invariants and legacy-save/arrival checks. Uses Chromium without touching player saves.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{pathToFileURL}=require('url');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/kallek/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..');
const gameRoot=process.env.GAME_ROOT?path.resolve(process.env.GAME_ROOT):path.join(root,'public');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'}),errors=[];
 const fresh=async lot=>{const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.route(/^https:\/\//,r=>r.abort());await page.addInitScript(()=>window.requestAnimationFrame=()=>0);await page.goto(pathToFileURL(path.join(gameRoot,'index.html')).href+'?fresh'+(lot?'&lot='+lot:''));await page.waitForFunction(()=>window.__leafYard);return page;};
 let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
 try{
  const home=await fresh();
  const data=await home.evaluate(()=>__leafYard.dev(`({tracks:TRACKS,up:UP,tech:TECH,gen:GEN,hiveCost:HIVE_UP_COST,bees:Array.from({length:40},(_,n)=>beeCost(n)),carry:[METAL_CARRY,INGOT_CARRY,COAL_CARRY],tinker:TINKER_GOAL,robotCosts:ROBOT_COST.slice(0,ROBOT_MAX),discount:DISCOUNT,mining:[METAL_SLOT_COST,MINER_COST],times:[BAG_TIME,JAR_TIME,WRAP_TIME,SMELT_TIME]})`));
  eq(data.times,[4,2.5,2.6,13.5]);eq(data.hiveCost,180);eq(data.tinker,750);
  eq(data.robotCosts,[0,8,40,100,220,360,700,1200,2000,3200]);eq(data.discount,.5);
  eq(data.mining,[450,500]);
  eq(await home.evaluate(()=>__leafYard.dev('INGOT_GOAL')),1000);
  eq(data.tracks.speed.vals,[1,1.14,1.28,1.42,1.82,2.22,2.74,3.3]);
  eq(data.tracks.carry.vals,[3,5,7,9,15,21,29,38]);
  eq(data.tracks.pick.vals,[1.3,1.12,.98,.86,.76,.60,.44,.32]);
  eq(data.tracks.grab.vals.slice(0,4),[1,2,3,5]);eq(data.tracks.grab.reach,[20,30,44,64,125]);eq(data.tracks.reach,undefined);
  eq(data.tracks.grab.gens[1].cost,[5.5,17,52,459]);eq(data.tech.claw.cost,13);eq(data.tech.arm,undefined);
  eq(data.tracks.speed.gens[0].cost,[.3,.6,1.2]);eq(data.tracks.carry.gens[0].cost,[.25,.5,1]);eq(data.tracks.pick.gens[0].cost,[.3,.6,1.2]);
  eq(data.tracks.speed.gens[1].cost,[10,26]);eq(data.tracks.carry.gens[1].cost,[13,35]);eq(data.tracks.pick.gens[1].cost,[3.5,17]);
  eq(data.tracks.speed.gens[2].cost,[100,190]);eq(data.tracks.carry.gens[2].cost,[140,300]);eq(data.tracks.pick.gens.slice(2).flatMap(g=>g.cost),[85,250]);
  eq(data.tracks.blow.gens.flatMap(g=>g.cost),[6,56,70]);eq(data.tracks.shake.gens.flatMap(g=>g.cost),[5,9,18,45,160]);
  eq(data.up.bin.costs,[.4,.8,1.5,4,30,100,260,650]);eq(data.up.truck.costs,[2,8,50,140,260,700,1800]);
  eq(data.up.leafPrice.costs,[.8,1.25,2.25,4,6.75,100,220,2200,4000,6000]);eq(data.up.bagPrice.costs,[11,19,28,170,299,507,735,1053]);
  eq(data.up.bagPrice.costs.slice(0,3),[11,19,28]);eq(data.up.bagPrice.vals.at(-1),8.7);
  eq(data.gen.basket.cost,[150]);eq(data.gen.market.cost,[1200,3000,6000]);
  eq(data.up.cleanup.costs,[400,1000,2000]);eq(data.up.cleanup.vals,[0,18,42,140]);eq(data.up.ingotGrade.costs,[360,6000,10000,14000,20000,28000,36000]);
  eq(data.up.ingotGrade.vals,[1.45,1.75,1.95,2.15,2.38,2.62,2.87,3.12]);
  eq(data.up.metalPrice.costs,[300,600,1100,4500,8500,15000]);
  const expected={speed:3.3,carry:38,pick:.32,grab:12,pack:4.6,drill:1.35,magnet:.72,study:10.5,blow:6.4,shake:38,dig:.95,stoke:1,dry:6.5};
  for(const[k,v]of Object.entries(expected))eq(data.tracks[k].vals.at(-1),v);
  for(const t of Object.values(data.tracks)){eq(t.gens.reduce((n,g)=>n+g.n,0),t.vals.length-1);for(const g of t.gens)eq(g.cost.length,g.n);}
  eq(data.carry.map(a=>a.at(-1)),[14,14,28]);eq(data.carry.map(a=>a.length),[8,8,8]);
  const nice=v=>v<1?Math.round(v*20)/20:v<20?Math.round(v*4)/4:Math.round(v);
  eq(data.bees,Array.from({length:40},(_,n)=>nice(4*1.18**Math.min(n,9)*1.05**Math.floor(n/10))));
  const paid=await home.evaluate(()=>{
   const Y=__leafYard,F=Y.fn();Y.dev('simMode=true;S.cash=1e6;S.bag.built=true;S.metalSlot=true;S.story.found=true;for(const k in TECH)S.tech[k]=true;S.robots.push(newRobotCfg());bindIds();syncRobots();');
   let n=0,charged=0;for(const k of Y.dev('TRACK_ORDER'))for(let i=0;i<Y.dev(`trackMax('${k}')`);i++){
    const o=F.offers().find(o=>o.id==='rup'&&o.ri===0&&o.key===k);if(!o)throw Error('Missing actual offer '+k+' '+i);const cash=Y.state().cash;if(!Y.buy(o))throw Error('Rejected real offer');if(Math.abs(cash-Y.state().cash-o.cost)>1e-6)throw Error('Wrong charge');charged+=o.cost;n++;
   }
   Y.state().gen.basket=1;const plan=F.allPlan('carry'),before=Y.state().cash;if(!plan||!Y.buy({id:'rall',key:'carry',obj:'robot1',...plan}))throw Error('Match all failed');
   const copyCost=before-Y.state().cash,matched=Y.state().robots[1].lv.carry,hires=[];
   while(Y.state().robots.length<10){const o=F.offers().find(o=>o.id==='robot');if(!o)throw Error('No next robot offer');const cash=Y.state().cash;if(!Y.buy(o))throw Error('Robot purchase rejected');hires.push(cash-Y.state().cash);}
   if(F.offers().some(o=>o.id==='robot'))throw Error('Robot cap exceeded');
   return {n,charged,copyCost,matched,hires,levels:Y.state().robots[0].lv};
  });
  eq(paid.n,44);eq(paid.matched,7);
  eq(paid.hires,data.robotCosts.slice(2));
  const alloy=await home.evaluate(()=>{
   const Y=__leafYard;Y.dev('S.plant.built=true;S.lv.ingotGrade=0;S.cash=1e6;');
   const costs=[],values=[];
   while(true){const o=Y.fn().offers().find(o=>o.id==='up'&&o.key==='ingotGrade');if(!o)break;
    const before=Y.state().cash;if(!Y.buy(o))throw Error('Alloy purchase rejected');
    costs.push(before-Y.state().cash);values.push(Y.dev("val('ingotGrade')"));
    if(costs.length>7)throw Error('Alloy cap exceeded');
   }
   return {costs,values,level:Y.state().lv.ingotGrade,price:Y.dev('ingotPrice()')};
  });
  eq(alloy.costs,data.up.ingotGrade.costs);eq(alloy.values,data.up.ingotGrade.vals.slice(1));eq(alloy.level,7);eq(Number.isFinite(alloy.price),true);
  eq(Math.round(paid.copyCost*100),4900); // Original components retain their 10% rounding.
  await home.close();
  const hollow=await fresh('hollow');
  const hd=await hollow.evaluate(()=>__leafYard.dev('({gen:GEN,up:UP,hiveCost:HIVE_UP_COST,bees:Array.from({length:40},(_,n)=>beeCost(n)),mining:[METAL_SLOT_COST,MINER_COST],cash:S.cash})'));
  eq(hd.cash,0);eq(hd.hiveCost,180);eq(hd.bees,data.bees);eq(hd.gen.market.cost,[700,1500,2800]);eq(hd.gen.basket.cost,[150]);eq(hd.up.cleanup.costs,[150,700,1500]);eq(hd.up.cleanup.vals,[0,18,42,140]);
  eq(hd.mining,[450,500]);
  for(const k of ['oil','cutting','market','charm']){eq(hd.gen[k].max,data.gen[k].max);eq(hd.gen[k].name,data.gen[k].name);assert(hd.gen[k].cost[0]<data.gen[k].cost[0]);checks++;}
  eq(hd.up.ingotGrade.costs,[240,600,1140]);eq(hd.up.ingotGrade.vals,[1,1.25,1.5,1.8]);eq(hd.up.metalPrice.costs,[300,600,1100]);eq(hd.up.leafPrice.costs.at(-1),6000);await hollow.close();
  const legacy=await fresh();
  const migration=await legacy.evaluate(()=>{
   const Y=__leafYard,old=JSON.parse(JSON.stringify(Y.state()));delete old.flags.investmentV32;delete old.flags.fewerStepsV1;
   Object.assign(old.robots[0].lv,{speed:11,carry:11,pick:12,grab:5,reach:5,pack:11});old.lv.bagPrice=13;old.cash=123;
   Y.dev(`load({S:${JSON.stringify(old)}})`);const first=JSON.parse(JSON.stringify(Y.state()));Y.dev(`load({S:${JSON.stringify(first)}})`);
   return{first,second:Y.state()};
  });
  eq(migration.first.robots[0].lv,{speed:7,carry:7,pick:7,grab:4,drill:0,magnet:0,pack:6,study:0});eq(migration.first.lv.bagPrice,8);eq(migration.first.flags.investmentV32,true);eq(migration.first.flags.fewerStepsV1,true);eq(migration.first.cash,123);eq(migration.first.robots,migration.second.robots);await legacy.close();
  for(const lot of ['', 'hollow']){
   const page=await fresh(lot);
   const rows=await page.evaluate(lot=>{
    const Y=__leafYard,base=JSON.parse(JSON.stringify(Y.state())),rows=[];
    for(const old of [true,false])for(let level=0;level<=(lot?3:old?5:7);level++){
     const save=JSON.parse(JSON.stringify(base));save.lv.ingotGrade=level;save.cash=123;
     if(old)delete save.flags.alloySevenSteps;
     Y.dev(`load({S:${JSON.stringify(save)}})`);const first=JSON.parse(JSON.stringify(Y.state()));
     Y.dev(`load({S:${JSON.stringify(first)}})`);
     rows.push({old,level,mapped:first.lv.ingotGrade,reloaded:Y.state().lv.ingotGrade,cash:Y.state().cash,flag:first.flags.alloySevenSteps});
    }return rows;
   },lot);
   for(const row of rows){const expected=row.old&&!lot?[0,1,3,4,6,7][row.level]:row.level;
    eq([row.mapped,row.reloaded,row.cash,row.flag],[expected,expected,123,true]);
   }await page.close();
  }
  const ending=await fresh();
  const goal=await ending.evaluate(()=>{
   const Y=__leafYard;
   Y.dev('simMode=true;S=freshState();bindIds();S.story.item="ruin";S.story.found=S.story.done=S.flags.ruinKnown=S.plant.built=true;S.totals.ingotsSold=999;updMilestones();');
   const below={reached:Y.state().miles.ingots!=null,posted:Y.state().post.includes('final')};
   Y.dev('S.totals.ingotsSold=1000;updMilestones();updMilestones();');
   const at={reached:Y.state().miles.ingots!=null,letters:Y.state().post.filter(id=>id==='final').length};
   const text=Y.dev('MILESTONES.find(m=>m.id==="ingots").goal'),hud=Y.dev('MILESTONES.find(m=>m.id==="ingots").hud.of'),jump=Y.dev('JUMPS.find(j=>j.id==="final").label');
   // A player already past the reduced goal must retain sold progress and receive the final letter.
   Y.dev('S.totals.ingotsSold=1250;delete S.miles.ingots;S.post=[];S.letters=[];load({S:JSON.parse(JSON.stringify(S))});simMode=true;updMilestones();');
   return{below,at,text,hud,jump,reload:{sold:Y.state().totals.ingotsSold,reached:Y.state().miles.ingots!=null,letters:Y.state().post.filter(id=>id==='final').length}};
  });
  eq(goal.below,{reached:false,posted:false});eq(goal.at,{reached:true,letters:1});eq(goal.text,'Sell 1,000 iron ingots');eq(goal.hud,1000);eq(goal.jump,'First yard: 1,000 ingots sold, the final letter comes');eq(goal.reload,{sold:1250,reached:true,letters:1});await ending.close();
  for(const version of [null,32]){
   const page=await fresh('hollow');const result=await page.evaluate(version=>{
    const Y=__leafYard,lv=version===32?{speed:9,carry:9,pick:8,grab:4,reach:4,pack:7}:{speed:11,carry:11,pick:12,grab:5,reach:5,pack:11};
    const a={from:'home',to:'hollow',skillVersion:version,crew:[{kind:'robot',sty:0,home:0,bot:{lv,prio:[['leaves']],off:[]}}]};Y.dev(`arrive(${JSON.stringify(a)},true)`);return Y.state().robots[0].lv;
   },version);for(const[k,v]of Object.entries({speed:7,carry:7,pick:7,grab:4,pack:6,reach:undefined}))eq(result[k],v);await page.close();
  }
  for(const lot of ['', 'hollow']){
   const page=await fresh(lot);
   const cleanup=await page.evaluate(lot=>{
    const Y=__leafYard;Y.dev('simMode=true;S.cash=10000;S.peak=10000;');
    const costs=[],rewards=[];
    while(true){const o=Y.fn().offers().find(o=>o.id==='up'&&o.key==='cleanup');if(!o)break;
     const before=Y.state().cash;if(!Y.buy(o))throw Error('Cleanup offer rejected');
     costs.push(before-Y.state().cash);rewards.push(Y.dev('cleanupBonus()'));
     if(costs.length>3)throw Error('Cleanup cap exceeded');
    }
    const save=JSON.parse(JSON.stringify(Y.state()));Y.dev(`load({S:${JSON.stringify(save)}});simMode=true;S.cleanN=17;`);
    const before=Y.state().cash,earned=Y.state().totals.cash;
    // A real truck sale: mixed loose/bagged leaves at home; only dried bags in the hollow.
    const leaves=lot?0:30,bags=lot?10:7;
    const expected=Y.dev(`${leaves}*leafPrice()+${bags}*bagPrice()+140`);
    Y.dev(`Object.assign(truck,{st:'load',timer:0,takeL:${leaves},takeB:${bags},takeM:0,takeI:0,takeH:0,takeG:0});step(.05);`);
    return {costs,rewards,level:Y.state().lv.cleanup,bonus:Y.dev('cleanupBonus()'),display:Y.dev('UP.cleanup.show(cleanupBonus())'),
     payout:Y.state().cash-before,earned:Y.state().totals.cash-earned,expected,remainder:Y.state().cleanN};
   },lot);
   eq(cleanup.costs,lot?[150,700,1500]:[400,1000,2000]);eq(cleanup.rewards,[18,42,140]);eq(cleanup.level,3);
   eq(cleanup.bonus,140);eq(cleanup.display,'$140 per 100 leaves');eq(cleanup.remainder,17);
   eq(Math.abs(cleanup.payout-cleanup.expected)<1e-7,true);eq(Math.abs(cleanup.earned-cleanup.expected)<1e-7,true);
   await page.close();
  }
  eq(errors,[]);console.log('Economy checks passed: '+checks+' invariants, real paid skills and cleanup purchases/payouts, hires and bulk matching, legacy save/reload, old/new arrivals, local prices, and unchanged bee/ant population curve.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
