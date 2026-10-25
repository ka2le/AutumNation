'use strict';
// Shipping migration, travel, kits, prices and presentation. Isolated contexts only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const {endpoints}=require('./balance/fewer-steps.cjs');
const prior=JSON.parse(fs.readFileSync(path.join(__dirname,'balance/fewer-steps-2026-10-25.json'),'utf8'));
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/kallek/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../public'),out=path.resolve('runs/fewer-steps-shipping');
let checks=0;const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++;};
const map=(key,level)=>endpoints[key]?endpoints[key].findIndex(v=>v>=Math.max(0,Math.min(level,endpoints[key].at(-1)))):level;
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'}),errors=[];
  try{for(const lot of ['home','hollow']){
    const page=await browser.newPage({viewport:{width:1450,height:1000}});
    page.on('pageerror',e=>errors.push(e.message));await page.route(/^https:\/\//,r=>r.abort());
    await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
    await page.goto(pathToFileURL(path.join(root,'index.html')).href+'?fresh&lot='+lot);await page.waitForFunction(()=>window.__leafYard);
    const result=await page.evaluate(({endpoints,old})=>{
      const Y=__leafYard,clone=x=>JSON.parse(JSON.stringify(x));
      Y.dev('simMode=true;IDL={};S=freshState();S.bag.built=true;S.metalSlot=true;S.plant.built=true;S.flags.dryKnown=true;S.flags.coalKnown=true;S.cash=123;S.robots.push(newRobotCfg());S.blowers=[newHelperCfg("blower")];S.shakers=[newHelperCfg("shaker")];for(const k in TECH)S.tech[k]=true;bindIds();syncRobots();syncHelpers();');
      const base=clone(Y.state()),migrations=[],arrivals=[];
      const load=save=>{Y.dev('IDL={};IDW.tech={};R=[];HB=[];');Y.dev(`load({S:${JSON.stringify(save)}});syncRobots();syncHelpers();`);};
      for(const kind of ['robot','blower','shaker'])for(const key of Y.dev(`BOT_TRACKS['${kind}']`)){
        if(!endpoints[key])continue;
        const list={robot:'robots',blower:'blowers',shaker:'shakers'}[kind];
        for(let level=0;level<old.tracks[key].vals.length;level++){
          const save=clone(base);delete save.flags.fewerStepsV1;
          save[list][0].lv[key]=level;save.robots[0].away='hollow';save.totals.leaves=456;
          load(save);const first=clone(Y.state());load(clone(first));
          migrations.push({kind,key,level,mapped:first[list][0].lv[key],same:JSON.stringify(first)===JSON.stringify(Y.state()),cash:first.cash,leaves:first.totals.leaves,away:first.robots[0].away,flag:first.flags.fewerStepsV1});
        }
      }
      for(const version of [null,32,33])for(const kind of ['robot','blower','shaker'])for(const key of Y.dev(`BOT_TRACKS['${kind}']`)){
        if(!endpoints[key])continue;
        const list={robot:'robots',blower:'blowers',shaker:'shakers'}[kind];
        const max=version===33?endpoints[key].length-1:version===32?old.tracks[key].vals.length-1:Y.dev(`INVESTMENT_LEVELS['${key}']?.at(-1) ?? ${old.tracks[key].vals.length-1}`);
        for(let level=0;level<=max;level++){
          load(clone(base));
          const a={from:'home',to:'hollow',skillVersion:version,crew:[{kind,sty:0,home:0,bot:{lv:{[key]:level},prio:[['leaves']],off:[]}}]},before=JSON.stringify(a);
          Y.dev(`arrive(${JSON.stringify(a)},true)`);
          const mapped=Y.state()[list][0].lv[key];
          // The browser call serializes a payload each time; also check the real
          // function does not mutate a reused in-flight object.
          const retry=Y.dev(`(()=>{const a=${JSON.stringify(a)},before=JSON.stringify(a);arrive(a,true);return {same:before===JSON.stringify(a),level:cfgsOf('${kind}')[0].lv['${key}']};})()`);
          arrivals.push({version,kind,key,level,mapped,retry});
        }
      }
      const kits=[];
      for(const name of Y.dev('Object.keys(JUMP_KITS)')){
        load(clone(base));Y.dev(`applyKit('${name}');bindIds();syncRobots();syncHelpers();`);
        kits.push({name,levels:Y.dev('Object.fromEntries(Object.entries(KIND_LIST).map(([kind,list])=>[kind,S[list].map(c=>c.lv)]))'),
          smelters:name==='homeBack'?Y.state().robots.slice(1,3).map(c=>({drill:c.lv.drill,pack:c.lv.pack})):null});
      }
      const parts=Y.dev('({tracks:TRACKS,priceParts:SKILL_PRICE_PARTS,version:SKILL_VERSION,carry:[METAL_CARRY,INGOT_CARRY,COAL_CARRY],art:Object.fromEntries(Object.keys(SKILL_ENDPOINTS).map(k=>[k,TRACKS[k].vals.map((_,i)=>skillArtLevel(k,i))]))})');
      load(clone(base));
      const current=[];
      for(const [key,keep]of Object.entries(endpoints))for(let level=0;level<keep.length;level++){
        const kind=Y.dev(`trackKind('${key}')`),list={robot:'robots',blower:'blowers',shaker:'shakers'}[kind],save=clone(base);
        save[list][0].lv[key]=level;load(save);const first=clone(Y.state());load(first);
        current.push({key,level,mapped:Y.state()[list][0].lv[key]});
      }
      Y.dev('S.cash=S.peak=1e8;S.bag.built=S.plant.built=S.flags.dryKnown=true;S.shafts=[0];for(const kind of ["robot","blower","shaker"])for(const c of cfgsOf(kind))for(const k of BOT_TRACKS[kind])c.lv[k]=trackMax(k);bindIds();syncRobots();syncHelpers();simMode=false;S.flags.taskHint=true;cardTab="up";openCard("robot",0);renderCard(true);draw();');
      const html=Y.dev('TRACK_ORDER.map(k=>robotRow(0,k).html).join(" ")');
      return{migrations,arrivals,kits,current,parts,html};
    },{endpoints,old:prior.checks.results[lot].baseline});
    eq(result.parts.version,33);
    for(const r of result.migrations){eq(r.mapped,map(r.key,r.level),JSON.stringify(r));eq(r.same,true);eq([r.cash,r.leaves,r.away,r.flag],[123,456,'hollow',true]);}
    const oldLevels={speed:[0,1,2,3,4,5,6,7,9,11],carry:[0,1,2,3,4,5,6,7,9,11],pick:[0,1,2,3,4,5,6,9,12],pack:[0,1,2,3,5,7,9,11]};
    for(const r of result.arrivals){let oldLevel=r.level;
      if(r.version===null&&oldLevels[r.key])oldLevel=oldLevels[r.key].filter(v=>v<=r.level).length-1;
      let expected=r.version===33?r.level:map(r.key,oldLevel);
      if(lot==='hollow'&&r.key==='dry')expected=Math.max(1,expected); // Existing free Warm air when drying is known.
      eq(r.mapped,expected,JSON.stringify(r));eq(r.retry,{same:true,level:r.mapped});
    }
    for(const r of result.current)eq(r.mapped,r.level);
    for(const [key,t]of Object.entries(result.parts.tracks)){
      const original=prior.checks.results[lot].baseline.tracks[key],keep=endpoints[key];
      eq(t.vals,keep?keep.map(i=>original.vals[i]):original.vals,key);
      const costs=t.gens.flatMap(g=>g.cost),originalCosts=original.gens.flatMap(g=>g.cost);
      eq(costs.reduce((s,c)=>s+c,0),originalCosts.reduce((s,c)=>s+c,0),key);
      for(const factor of [.5,.1]){
        const nice=v=>v<1?Math.round(v*20)/20:v<20?Math.round(v*4)/4:Math.round(v);
        const bill=costs.reduce((s,c,i)=>s+(result.parts.priceParts[key]?.[i]||[c]).reduce((n,p)=>n+nice(p*factor),0),0);
        eq(Math.round(bill*100),Math.round(originalCosts.reduce((n,c)=>n+nice(c*factor),0)*100),key);
      }
      if(keep)eq(result.parts.art[key],keep);
    }
    for(const kit of result.kits){
      for(const [kind,list]of Object.entries(kit.levels))for(const lv of list)for(const[k,v]of Object.entries(lv))if(result.parts.tracks[k]){
        eq(Number.isInteger(v)&&v>=0&&v<result.parts.tracks[k].vals.length,true,kit.name+' '+kind+' '+k);
      }
      if(kit.smelters)eq(kit.smelters,[{drill:5,pack:6},{drill:5,pack:6}]);
    }
    assert(!/undefined|NaN/.test(result.html));checks++;
    await page.screenshot({path:path.join(out,`robot-${lot}.png`)});
    await page.setViewportSize({width:390,height:844});
    await page.waitForFunction(()=>__leafYard.dev('W===innerWidth && H===innerHeight'),null,{polling:20});
    await page.evaluate(()=>__leafYard.dev('openCard("robot",0);renderCard(true);draw();'));
    const card=await page.locator('#card').boundingBox();eq(card.width<=390,true);
    await page.screenshot({path:path.join(out,`robot-${lot}-mobile.png`)});
    for(const kind of ['blower','shaker'])for(const width of [1450,390]){
      await page.setViewportSize({width,height:width===390?844:1000});
      await page.waitForFunction(()=>__leafYard.dev('W===innerWidth && H===innerHeight'),null,{polling:20});
      const html=await page.evaluate(kind=>__leafYard.dev(`cardTab='up';openCard('${kind}',0);draw();BOT_TRACKS['${kind}'].filter(k=>trackVisible(k)).map(k=>robotRow(0,k,'${kind}').html).join(' ');`),kind);
      eq(/undefined|NaN/.test(html),false);
      const box=await page.locator('#card').boundingBox();eq(!!box&&box.width<=width,true,kind+' '+width+' '+JSON.stringify(box));
      await page.screenshot({path:path.join(out,`${kind}-${lot}-${width}.png`)});
    }
    fs.writeFileSync(path.join(out,`checks-${lot}.json`),JSON.stringify(result));await page.close();
  }
  eq(errors,[]);fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({checks,errors},null,2));
  console.log('Fewer steps: '+checks+' migration, pre-32/32/33 arrival, payload retry, kit, cost, effect and desktop/mobile assertions passed.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
