'use strict';
// Exercise real hollow routes and render the restored gait without touching a player's save.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/kallek/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const root=path.resolve(__dirname,'../public');
 const server=http.createServer((req,res)=>{try{const f=path.join(root,new URL(req.url,'http://localhost').pathname.replace(/^\/$/,'/index.html'));res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(f));}catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'});
 const errors=[];
 try{
  const p=await browser.newPage({viewport:{width:1280,height:800},serviceWorkers:'block'});
  p.on('pageerror',e=>errors.push(e.message));
  await p.route(/^https:\/\//,r=>r.abort());
  await p.addInitScript(()=>window.requestAnimationFrame=()=>0);
  await p.goto(`http://127.0.0.1:${server.address().port}/?fresh&lot=hollow`);
  await p.waitForFunction(()=>window.__leafYard);
  const result=await p.evaluate(()=>__leafYard.dev(`(()=>{
   let checks=0,routes=0;
   const ok=(v,msg)=>{if(!v)throw Error(msg);checks++};
   const make=(i=0)=>({i,x:0,y:0,z:0,tx:100,ty:0,tz:0,face:-1,path:[[100,0]],pi:0});
   // First movement used to assign undefined + delta to hx, poisoning all later headings.
   const fresh=make();antMove(fresh,30,1/60);
   ok(Number.isFinite(fresh.hx)&&Number.isFinite(fresh.hy),'initial heading must be finite');
   ok(fresh.face===1,'first step faces right');
   fresh.path=[[-100,0]];fresh.pi=0;antMove(fresh,30,1/60);
   ok(fresh.face===-1,'a real reversal turns on its first step');
   fresh.hx=NaN;fresh.hy=NaN;antMove(fresh,30,1/60);
   ok(Number.isFinite(fresh.hx)&&Number.isFinite(fresh.hy),'invalid headings recover');
   const vertical=make();vertical.face=-1;vertical.path=[[0,100]];
   for(let i=0;i<60;i++)antMove(vertical,30,1/60);
   ok(vertical.face===-1,'vertical travel retains facing');
   for(let lane=0;lane<7;lane++){
    const raw=Array.from({length:21},(_,i)=>[i*5,0]),b=make(lane);
    b.path=antLanePath(b,raw);const copy=JSON.stringify(b.path);
    let done=false,last=-Infinity;
    for(let n=0;n<1000&&!done;n++){
     done=antMove(b,30,1/60);ok(b.x>=last-1e-8,'straight lane must never double back');last=b.x;
     ok(Number.isFinite(b.hx)&&Number.isFinite(b.hy),'lane heading is finite');
    }
    ok(done&&b.x===100&&b.y===0,'each lane arrives at the exact endpoint');
    ok(copy===JSON.stringify(b.path),'waypoints remain fixed');
    ok(raw[1][1]===0,'lane offsets do not mutate shared trails');
   }
   S.hive.built=true;S.flags.antHill=true;S.flags.beeFail=true;S.story.done=true;S.land=1;
   const flowers=FLOWERS.filter(flowerOn).slice(0,16);
   for(const f of flowers)for(const reverse of [false,true])for(let lane=0;lane<7;lane++){
    const from=reverse?f:DOOR,to=reverse?DOOR:f;
    const run=dt=>{
     const b=make(lane);b.x=from.x;b.y=from.y;beeLeg(b,to.x,to.y,0);
     let done=false,steps=0;
     while(!done&&steps++<20000){
      const x=b.x,y=b.y;done=antMove(b,40,dt);
      ok(Number.isFinite(b.hx)&&Number.isFinite(b.hy),'real route heading is finite');
      const dx=b.x-x,dy=b.y-y,d=Math.hypot(dx,dy);
      if(d>0.001&&Math.abs(dx/d)>.15)ok(b.face*dx>0,'real route faces travel');
     }
     ok(done,'real route must finish');
     ok(Math.hypot(b.x-to.x,b.y-to.y)<1e-8,'real route endpoint');
     return b.gait;
    };
    const a=run(1/30),b=run(1/120);
    ok(Math.abs(a-b)<1e-6,'route distance is independent of frame rate');routes++;
   }
   // A complete foraging cycle must still collect and deliver mushrooms.
   S.hive.bees=8;syncBees();S.hive.nectar=0;S.hive.honey=0;
   FLOWERS.filter(flowerOn).forEach(f=>{f.full=true;f.claim=null});
   for(let i=0;i<2400;i++)for(const b of B)updBee(b,.05);
   ok(S.hive.nectar>0,'ants deliver mushrooms after walking their routes');
   return{checks,routes};
  })()`));
  // Enlarged contact sheet: all five builds, six points in a stride, both directions.
  await p.evaluate(()=>__leafYard.dev(`(()=>{
   const cv=document.createElement('canvas');cv.id='ant-preview';cv.width=1200;cv.height=600;
   const c=cv.getContext('2d');c.fillStyle='#cfbb91';c.fillRect(0,0,1200,600);
   for(let i=0;i<5;i++)for(let j=0;j<12;j++){
    c.save();c.translate(45+j*100,65+i*115);c.scale(5,5);
    ART.drawAnt(c,{i,x:0,y:0,face:j<6?1:-1,walk:true,gait:(j%6)/6*TAU/.75,ph:0,anim:0,st:'home',hx:j<6?1:-1,hy:.2,carry:4,mty:0,up:{}});c.restore();
   }
   document.body.replaceChildren(cv);document.body.style.cssText='margin:0;background:#cfbb91;overflow:auto';
  })()`));
  const out=path.resolve(__dirname,'../runs/ants');fs.mkdirSync(out,{recursive:true});
  await p.locator('#ant-preview').screenshot({path:path.join(out,'gait.png')});
  assert.deepEqual(errors,[]);console.log(JSON.stringify(result));
  console.log('Ant gait preview: runs/ants/gait.png');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
