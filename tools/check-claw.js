'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/kallek/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'}),errors=[];
  try{
    for(const lot of ['home','hollow']){
      const page=await browser.newPage({viewport:{width:1450,height:1000}});page.on('pageerror',e=>errors.push(e.message));
      await page.route(/^https:\/\//,r=>r.abort());await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
      await page.goto(pathToFileURL(path.join(root,'public/index.html')).href+'?fresh&lot='+lot);await page.waitForFunction(()=>window.__leafYard);
      const result=await page.evaluate(()=>{
        const Y=__leafYard,base=JSON.parse(JSON.stringify(Y.state())),rows=[];
        for(let grab=0;grab<=4;grab++)for(let reach=0;reach<=4;reach++){
          const s=JSON.parse(JSON.stringify(base));s.robots[0].lv.grab=grab;s.robots[0].lv.reach=reach;s.tech={arm:true};s.cash=123;
          Y.dev('IDL={};');Y.dev(`load({S:${JSON.stringify(s)}})`);
          const first=JSON.parse(JSON.stringify(Y.state()));Y.dev(`load({S:${JSON.stringify(first)}})`);
          rows.push({grab,reach,lv:Y.state().robots[0].lv,tech:Y.state().tech,cash:Y.state().cash,same:JSON.stringify(first.robots)===JSON.stringify(Y.state().robots)});
        }
        Y.dev('IDL={};IDW.tech={};S=freshState();S.cash=S.peak=1e6;S.robots.push(newRobotCfg(),newRobotCfg());bindIds();syncRobots();');
        const F=Y.fn(),unlock=F.offers().find(o=>o.id==='tech'&&o.key==='claw');
        if(!unlock||unlock.cost!==13||!Y.buy(unlock))throw Error('Combined unlock missing');
        const paid=[];
        for(let i=0;i<4;i++){
          const o=F.offers().find(o=>o.id==='rup'&&o.ri===0&&o.key==='grab'),before=Y.state().cash;
          if(!o||!Y.buy(o))throw Error('Missing claw level');paid.push({cost:before-Y.state().cash,grab:Y.dev("rv(0,'grab')"),reach:Y.dev("rv(0,'reach')")});
        }
        const match=Y.dev("maxPlan('robot',1,'grab')"),before=Y.state().cash;
        Y.buy({id:'rmax',kind:'robot',ri:1,key:'grab',obj:'robot1',...match});
        const matchPaid=before-Y.state().cash,all=F.allPlan('grab');
        Y.buy({id:'rall',key:'grab',obj:'robot2',...all});
        const forbidden=F.offers().filter(o=>o.key==='reach'||o.id==='tech'&&o.key==='arm');
        const levels=Y.state().robots.map(c=>c.lv.grab),ranges=Y.state().robots.map((_,i)=>Y.dev(`rv(${i},'reach')`));
        Y.dev("simMode=false;openCard('robot',0);renderCard();");
        return {rows,paid,matchPaid,all,forbidden,levels,ranges,html:Y.dev("robotRow(0,'grab').html"),order:Y.dev('TRACK_ORDER')};
      });
      for(const r of result.rows){assert.equal(r.lv.grab,Math.max(r.grab,r.reach));assert(!('reach'in r.lv));assert(r.tech.claw);assert(!('arm'in r.tech));assert.equal(r.cash,123);assert(r.same);}
      assert.deepEqual(result.paid,[{cost:5.5,grab:2,reach:30},{cost:17,grab:3,reach:44},{cost:52,grab:5,reach:64},{cost:459,grab:12,reach:125}]);
      assert.equal(result.matchPaid,267.25);assert.equal(result.all.cost,267.25);assert.deepEqual(result.levels,[4,4,4]);assert.deepEqual(result.ranges,[125,125,125]);assert.deepEqual(result.forbidden,[]);
      assert(!result.order.includes('reach'));assert(result.html.replace(/<[^>]*>/g,'').includes('125 cm'));assert(result.html.includes('12'));
      fs.mkdirSync(path.join(root,'runs/claw-discount'),{recursive:true});await page.screenshot({path:path.join(root,`runs/claw-discount/claw-${lot}.png`)});
      await page.setViewportSize({width:390,height:844});
      await page.evaluate(()=>__leafYard.dev("S.robots.forEach(c=>c.lv.grab=1);openCard('robot',0);renderCard(true);"));
      const mobile=await page.locator('#card').boundingBox();assert(mobile.width<=390);
      await page.screenshot({path:path.join(root,`runs/claw-discount/claw-${lot}-mobile.png`)});await page.close();
    }
    assert.deepEqual(errors,[]);console.log('Combined claw: paid levels, Match/All, both yards, 50 asymmetric save/reload cases and rendered cards passed.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
