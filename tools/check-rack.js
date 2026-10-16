'use strict';
// Real browser checks for separate raw storage and equally sized production/selling pallets.
// Optional: PLAYWRIGHT_PATH and CHROME_PATH. Codex's bundled runtime is detected on Windows.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
function playwright(){
 for(const name of [process.env.PLAYWRIGHT_PATH,'playwright',path.join(process.env.USERPROFILE||'', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean))try{return require(name);}catch{}
 throw new Error('Playwright unavailable; set PLAYWRIGHT_PATH to its installed package.');
}
async function checks(page,lot){
 return page.evaluate(lot=>{
  const Y=window.__leafYard,F=Y.fn(),rows=[];
  const ok=(condition,label)=>{if(!condition)throw Error(label);rows.push(label);};
  const close=(a,b)=>Math.abs(a-b)<1e-7;
  Y.dev('simMode=true;S.plant.built=true;S.cash=S.peak=20000;S.lv.pallet=0');
  let S=Y.state();
  if(lot==='hollow'){
   S.plant.built=false;S.flags.coalKnown=true;
   ok(F.offers().some(o=>o.id==='up'&&o.key==='pallet'),'coal pallet upgrade offered before kiln construction');
   Y.open('plant');ok(Y.dev('cardModel().rows.some(r=>r.sig.startsWith("pallet"))'),'coal upgrade visible before kiln construction');
   S.plant.built=true;
  }
  const pallet=lot==='hollow'?[32,56,92,140,200]:[16,28,46,70,100,200],rack=pallet;
  for(let l=0;l<pallet.length;l++){
   ok(F.palletCap()===pallet[l]&&F.rackCap()===rack[l],'pallet/rack tier '+l);
   const html=Y.dev('upRow("pallet").html');ok(html.includes(lot==='hollow'?'Kiln shelf:':'Furnace rack:')&&html.includes('same number'),'upgrade row explains equal capacity at tier '+l);
   ok(Y.dev('LH.RACK_CAP')===rack[l],'lot renderer sees current capacity at tier '+l);
   if(l<F.UP.pallet.max){const offer=F.offers().find(o=>o.id==='up'&&o.key==='pallet'),before=S.cash;ok(!!offer&&Y.buy(offer),'buy pallet tier '+(l+1));ok(close(before-S.cash,F.UP.pallet.costs[l]),'pallet purchase charge '+(l+1));}
  }
  const hopper=lot==='hollow'?[16,30,50]:[24,40,64,100,200];
  S.lv.hopper=0;
  for(let l=0;l<hopper.length;l++){
   ok(F.hopperCap()===hopper[l],'hopper tier '+l);
   if(l<F.UP.hopper.max){const offer=F.offers().find(o=>o.id==='up'&&o.key==='hopper'),before=S.cash;ok(!!offer&&Y.buy(offer),'buy hopper tier '+(l+1));ok(close(before-S.cash,F.UP.hopper.costs[l]),'hopper purchase charge '+(l+1));}
  }
  ok(!F.offers().some(o=>o.id==='up'&&(o.key==='pallet'||o.key==='hopper')),'storage upgrades stop at final tier');
  if(lot!=='hollow'){ok(F.UP.pallet.costs.at(-1)===2300,'final pallet costs $2300');ok(F.UP.hopper.costs.at(-1)===1200,'final hopper costs $1200');}
  S.metalSlot=true;S.lv.metalBin=0;
  for(let l=0;l<F.UP.metalBin.max;l++){const before=S.cash,offer=F.offers().find(o=>o.id==='up'&&o.key==='metalBin');ok(Y.buy(offer),'buy raw storage tier '+(l+1));ok(close(before-S.cash,F.UP.metalBin.costs[l]),'raw storage purchase charge '+(l+1));ok(F.rackCap()===rack.at(-1)&&F.palletCap()===pallet.at(-1),'raw storage does not change finished capacity '+(l+1));}
  const rawCost=F.UP.metalBin.costs.reduce((n,v)=>n+v,0),finishedCost=F.UP.pallet.costs.reduce((n,v)=>n+v,0);
  const expectedFinished=lot==='hollow'?3240:6140;   // V32.1 prices
  ok(rawCost===3075&&finishedCost===expectedFinished,'raw/finished storage prices match all tiers');
  // Batch reservations must use the new capacity immediately, even with simultaneous operators.
  Y.dev('S.robots=[newRobotCfg(),newRobotCfg()];syncRobots();S.lv.slag=UP.slag.max;S.gen.charm=1;for(const c of S.robots)c.lv.magnet=6;for(const r of R)r.st="idle";');
  for(let l=0;l<pallet.length;l++){
   S.lv.pallet=l;
   const result=Y.dev('(()=>{const a=R[0],b=R[1];a.st="smelt";a.resv=smeltReserve(a.id);b.st="idle";S.plant.slagAcc=.5;S.plant.rack=rackCap()-a.resv-smeltReserve(b.id);const fits=rackHasRoom(b);S.plant.rack++;return {fits,overflow:rackHasRoom(b)};})()');
   ok(result.fits&&!result.overflow,'simultaneous reservations respect rack tier '+l);
  }
  Y.dev('for(const r of R)r.st="idle";S.lv.pallet=0;S.plant.rack=rackCap();S.plant.slagAcc=2.5;');
  Y.dev('settleRecovery()');ok(S.plant.rack===rack[0]&&S.plant.slagAcc===2.5,'full rack retains earned recovery');
  const offer=F.offers().find(o=>o.id==='up'&&o.key==='pallet');ok(Y.buy(offer),'upgrade full rack');Y.dev('settleRecovery()');
  ok(S.plant.rack===rack[0]+2&&close(S.plant.slagAcc,.5),'new room accepts retained recovery');
  // Keep earned over-cap inventory and large upgraded racks on reload.
  for(const [level,stock]of [[0,rack[0]+2],[4,rack[4]-3],[F.UP.pallet.max,rack.at(-1)-3]]){S=Y.state();S.lv.pallet=level;S.plant.rack=stock;const saved=JSON.stringify(S);Y.dev('load({S:'+saved+'})');ok(Y.state().plant.rack===stock,'reload preserves rack stock '+stock);ok(F.rackCap()===rack[level],'reload restores dynamic capacity '+level);ok(F.hopperCap()===hopper.at(-1),'reload restores final hopper capacity');}
  {
   const old=lot==='hollow'?[24,24,36,54,80,90,110,125,200]:[6,6,9,14,20,30,45,68,100];
   for(let l=0;l<old.length;l++){S=Y.state();S.lv.metalBin=l;S.lv.pallet=0;S.ingots=old[l];S.plant.rack=24;const src=JSON.parse(JSON.stringify(S));delete src.flags.palletStorage;Y.dev('load({S:'+JSON.stringify(src)+'})');ok(F.palletCap()>=old[l]&&Y.state().ingots===old[l]&&Y.state().plant.rack===24,'legacy '+lot+' storage preserved at raw tier '+l);const level=Y.state().lv.pallet;Y.dev('load({S:'+JSON.stringify(Y.state())+'})');ok(Y.state().lv.pallet===level,'storage migration is idempotent '+lot+' '+l);}
   S=Y.state();S.lv.metalBin=0;S.lv.pallet=4;const src=JSON.parse(JSON.stringify(S));delete src.flags.palletStorage;Y.dev('load({S:'+JSON.stringify(src)+'})');ok(Y.state().lv.pallet===4,'migration retains already-separated pallet upgrade');
  }
  Y.dev('S.lv.pallet=0;S.plant.built=true;S.cash=S.peak=20000;');Y.open('plant');
  return rows;
 },lot);
}
async function conservation(page){
 return page.evaluate(()=>{
  const Y=window.__leafYard,F=Y.fn(),results=[];
  for(const level of [...new Set([0,1,4,F.UP.pallet.max])]){
   let expected=0,initial=0,final=0,sold=0,batches=0,max=0;
   window.__src={leaf:0,bag:0,metal:0,ingot:0,jar:0,gift:0,clean:0,nL:0,nM:0,nI:0,nJ:0};
   const original=Y.dev('finishWork');
   window.__recordBatch=r=>{if(r.st==='smelt'){expected+=Y.dev('batchOut()*smeltYieldMul('+r.id+')');batches++;}original(r);};
   Y.dev('finishWork=window.__recordBatch');
   try{Y.sim(180,{noBuy:true,setup:S=>{
    S.land=1;S.metalSlot=true;S.miners=[0,1];S.shafts=[0,1];S.lv.pallet=level;S.lv.hopper=F.UP.hopper.max;S.lv.truck=7;S.lv.slag=F.UP.slag.max;S.lv.smeltSpeed=F.UP.smeltSpeed.max;S.lv.metalBin=8;S.gen.charm=1;S.plant.built=true;S.plant.ore=F.UP.hopper.val(F.UP.hopper.max);S.plant.rack=level===4?40:8;S.plant.slagAcc=.25;S.ingots=10;S.coalStand=200;
    S.bench.fire=false;S.fire.bench=false;S.flags.coalKnown=true;S.flags.fireDone=true;
    initial=S.plant.rack+S.plant.slagAcc+S.ingots;
    Y.dev('S.robots=Array.from({length:8},()=>newRobotCfg());');
    S.robots.forEach((c,i)=>{for(const k of ['speed','carry','drill','magnet','pack'])c.lv[k]=Y.dev('trackMax('+JSON.stringify(k)+')');c.prio=i<2?[['smelt']]:i<4?(i===2?[['refuel'],['haul']]:[['haul']]):[['mine']];c.off=[];if(i>=4)c.miner=i<6?0:1;});
   },probe:()=>{
    const S=Y.state();max=Math.max(max,S.plant.rack);sold=window.__src.nI;
    final=S.plant.rack+S.plant.slagAcc+S.ingots+Y.robots().reduce((n,r)=>n+(r.carryI||0),0)+Y.dev('truck.st==="load"?truck.takeI:0');
   }});}finally{window.__restoreWork=original;Y.dev('finishWork=window.__restoreWork');delete window.__restoreWork;delete window.__recordBatch;}
   const error=initial+expected-sold-final;if(Math.abs(error)>1e-7)throw Error('Output conservation at tier '+level+': '+error);if(!batches)throw Error('No real batches processed');
   results.push({level,rackCapacity:F.UP.pallet.val(level),batches,initial,earned:expected,sold,final,error,maxRack:max});
  }
  return results;
 });
}
(async()=>{
 const {chromium}=playwright(),chrome=process.env.CHROME_PATH||path.join(process.env['PROGRAMFILES(X86)']||'', 'Google/Chrome/Application/chrome.exe');
 const server=http.createServer((req,res)=>{const url=req.url.split('?')[0],file=url==='/game.js'&&process.env.GAME_SOURCE?path.resolve(process.env.GAME_SOURCE):path.join(root,'public',url==='/'?'index.html':url);try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,...(fs.existsSync(chrome)?{executablePath:chrome}:{})}),errors=[],result={checks:[],conservation:[]};
 try{for(const lot of ['home','hollow']){
  const p=await browser.newPage({viewport:{width:1280,height:1000}});p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
  await p.goto(`http://127.0.0.1:${server.address().port}/?fresh&lot=${lot}`);await p.waitForFunction(()=>window.__leafYard);result.checks.push(...await checks(p,lot));
  const dir=path.join(root,'runs/rack-scaling');fs.mkdirSync(dir,{recursive:true});
  await p.evaluate(()=>{window.__leafYard.open('plant');window.__leafYard.dev('draw();renderCard(true);placeCard();');});await p.waitForTimeout(350);await p.screenshot({path:path.join(dir,lot+'-upgrade-desktop.png')});
  await p.setViewportSize({width:390,height:844});await p.evaluate(()=>{window.__leafYard.dev('resize();');window.__leafYard.open('plant');window.__leafYard.dev('draw();renderCard(true);placeCard();');});await p.waitForTimeout(350);await p.screenshot({path:path.join(dir,lot+'-upgrade-mobile.png')});
  result.conservation.push(...(await conservation(p)).map(r=>({...r,lot})));
  await p.close();
 }}finally{await browser.close();server.close();}
 assert.deepEqual(errors,[]);result.errors=errors;fs.writeFileSync(path.join(root,'runs/rack-scaling/functional.json'),JSON.stringify(result,null,2));console.log(`${result.checks.length} rack checks and ${result.conservation.length} production-conservation runs passed; zero browser errors.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
