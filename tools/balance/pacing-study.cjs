'use strict';
// Isolated timing experiment. Never edits public/ or the normal balance runner.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),Module=require('node:module');
const {audit,replayTrace}=require('./validate.cjs');
const root=path.resolve(__dirname,'../..'),out=path.resolve(process.env.RESULT_DIR||'runs/pacing-study');
const files=['game.js','lots/hollow.js','lots/prairie.js','index.html','style.css','audio.js','ending.js','tips.js'];
const sha=x=>crypto.createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
const read=p=>fs.readFileSync(p,'utf8');
function replace(s,a,b){assert.equal(s.split(a).length,2,'Pacing adapter drift: '+a);return s.replace(a,b);}
function candidate(source,duration,ui=false,fixed=false){
  let s=replace(source,'const PARAMS = new URLSearchParams(location.search);',`// Experimental baseline tempo; developer speed remains relative to normal.\nconst WORLD_DURATION = ${duration};\nconst realDuration = s => s*WORLD_DURATION;\nconst realRate = v => v/WORLD_DURATION;\nconst PARAMS = new URLSearchParams(location.search);`);
  s=replace(s,'let last = 0;',`// Shared entry point used by both the live frame and this study's driver.\nfunction advanceWorld(realDt){\n  const want = realDt*TIME_SCALE/WORLD_DURATION, n = want <= 0.05 ? 1 : Math.ceil(want/0.05 - 1e-9), h = want/n, t0 = performance.now();\n  let done = 0;\n  for(let i=0;i<n;i++){ step(h); done += h; if(n > 1 && performance.now() - t0 > 30) break; }\n  return done;\n}\nlet last = 0;`);
  const block='    const want = dt*TIME_SCALE, n = TIME_SCALE <= 1 ? 1 : Math.ceil(want/0.05 - 1e-9), h = want/n, t0 = performance.now();\n    let done = 0;\n    for (let i=0;i<n;i++){ step(h); done += h; if (n > 1 && performance.now() - t0 > 30) break; }';
  s=replace(s,block,'    const done = advanceWorld(dt);');
  s=replace(s,'(done/dt - speedReal)','(done*WORLD_DURATION/dt - speedReal)');
  if(fixed){
    const begin=s.indexOf('function advanceWorld(realDt){'),end=s.indexOf('\nlet last = 0;',begin);
    assert(begin>=0&&end>begin);
    s=s.slice(0,begin)+`let worldAccumulator = 0;\nconst WORLD_STEP = 1/60;\nfunction advanceWorld(realDt){\n  worldAccumulator += realDt*TIME_SCALE/WORLD_DURATION;\n  const t0 = performance.now();let done = 0;\n  while(worldAccumulator + 1e-10 >= WORLD_STEP){\n    step(WORLD_STEP);done += WORLD_STEP;worldAccumulator = Math.max(0, worldAccumulator-WORLD_STEP);\n    if(performance.now()-t0 > 30)break;\n  }\n  return done;\n}`+s.slice(end);
  }
  if(ui){
    s=replace(s,'function mmss(s){ s = Math.max(0, Math.ceil(s));','function mmss(s){ s = Math.max(0, Math.ceil(realDuration(s)));');
    s=replace(s,"truck: v => [v + 's', '']","truck: v => [+realDuration(v).toFixed(2) + 's', '']");
    s=replace(s,"pick: v => [v.toFixed(2) + 's', '']","pick: v => [realDuration(v).toFixed(2) + 's', '']");
    s=replace(s,"drill: v => [v.toFixed(1) + 's'","drill: v => [realDuration(v).toFixed(1) + 's'");
    s=replace(s,"study: v => [RESEARCH_UNIT*v, '<small>/s</small>']","study: v => [+realRate(RESEARCH_UNIT*v).toFixed(2), '<small>/s</small>']");
    s=replace(s,"drillTimeAt(w, i).toFixed(1) + 's","realDuration(drillTimeAt(w, i)).toFixed(1) + 's");
    s=replace(s,"'A log burns for ' + LOG_BURN + ' seconds","'A log burns for ' + realDuration(LOG_BURN) + ' seconds");
    s=replace(s,'return PROD_DISPLAY.rates[k] || 0;','return realRate(PROD_DISPLAY.rates[k] || 0);');
    // These substitutions change text construction only, never the economic functions.
    for(const name of ['fanRate()','rate','fanRate()/jarNectar()','rate/jarNectar()']){
      const expr=name==='rate'?'rate.toFixed(2)':name.includes('/')?'('+name+').toFixed(2)':name+'.toFixed(2)';
      const replacement='realRate('+name+').toFixed(2)';
      const pos=s.indexOf("extra = '<br><small>' + (floors > hiveFloors()");
      const end=s.indexOf('\n',pos),line=s.slice(pos,end);assert(line.includes(expr));
      s=s.slice(0,pos)+line.replace(expr,replacement)+s.slice(end);
    }
    s=replace(s,"fanRateAt(hiveFloors(), false) + ' → ' + fanRateAt(hiveFloors(), true) + ' nectar/s", "realRate(fanRateAt(hiveFloors(), false)) + ' → ' + realRate(fanRateAt(hiveFloors(), true)) + ' nectar/s");
    // Absolute research output occurs in several explanatory strings.
    s=s.replaceAll("+ RESEARCH_UNIT*F.robotMul + ' research a second", "+ +realRate(RESEARCH_UNIT*F.robotMul).toFixed(2) + ' research a second");
    s=replace(s,"+ RESEARCH_UNIT + ' research a second", "+ +realRate(RESEARCH_UNIT).toFixed(2) + ' research a second");
    for(const name of ['F[kind]','F.blower','F.shaker']){
      s=s.replaceAll("+ "+name+" + '/s", "+ +realRate("+name+").toFixed(2) + '/s");
      s=s.replaceAll("+ "+name+" + ' research a second", "+ +realRate("+name+").toFixed(2) + ' research a second");
    }
    // Keep internal saved simulation clocks intact; convert their displayed elapsed time.
    s=replace(s,"ct = runClockTxt(WORLD.runT || 0)","ct = runClockTxt(realDuration(WORLD.runT || 0))");
    s=replace(s,"desc:'A faster pickup upgrade: 0.44 seconds a grab.'", "desc:'A faster pickup upgrade: ' + +realDuration(0.44).toFixed(3) + ' seconds a grab.'");
    s=replace(s,"desc:'The final pickup upgrade: 0.32 seconds a grab.'", "desc:'The final pickup upgrade: ' + +realDuration(0.32).toFixed(3) + ' seconds a grab.'");
    // Scripted camera beats follow world actors. Player-controlled watch/tutorial
    // cameras, manual panning and ordinary card/tooltip interactions stay responsive.
    s=replace(s,'  updCamFollow(dt);','  updCamFollow(dt/(camFollow && !camFollow.watch && !camFollow.tut ? WORLD_DURATION : 1));');
    s=replace(s,'  updEndReturn(dt);','  updEndReturn(dt/WORLD_DURATION);');
    for(const delay of ['DRY_REFUSE_HOLD + 1.1','DRY_REFUSE_HOLD + 2.6'])s=replace(s,'('+delay+')*1000);','realDuration(('+delay+')*1000));');
    s=replace(s,'runClock(dt); EN.frame(dt);','runClock(dt/WORLD_DURATION); EN.frame(dt);');
  }
  return s;
}
function prepare(){
  fs.mkdirSync(out,{recursive:true});const hashes={};
  for(const f of files)hashes[f]=sha(fs.readFileSync(path.join(root,'public',f)));
  const src=read(path.join(root,'public/game.js')).replace(/\r\n/g,'\n');
  for(const [name,duration,ui] of [['baseline',1,false],['naive',1.2,false],['candidate',1.2,true]]){
    const dest=path.join(out,name);assert(!fs.existsSync(dest),'Use a fresh RESULT_DIR');
    for(const f of files){const p=path.join(dest,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.copyFileSync(path.join(root,'public',f),p);}
    fs.writeFileSync(path.join(dest,'game.js'),candidate(src,duration,ui));
  }
  fs.writeFileSync(path.join(out,'inputs.json'),JSON.stringify({hashes,study:sha(read(__filename)),duration:1.2},null,2));
}
function prepareFixed(){
  const src=read(path.join(root,'public/game.js')).replace(/\r\n/g,'\n');
  for(const [name,duration,ui]of [['fixed-baseline',1,false],['fixed-candidate',1.2,true]]){
    const dest=path.join(out,name);assert(!fs.existsSync(dest),'Refusing to overwrite frozen fixed candidate');
    for(const f of files){const p=path.join(dest,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.copyFileSync(path.join(root,'public',f),p);}
    fs.writeFileSync(path.join(dest,'game.js'),candidate(src,duration,ui,true));
  }
}
function prepareReview(){
  const src=read(path.join(root,'public/game.js')).replace(/\r\n/g,'\n');
  for(const [name,duration,ui]of [['review-baseline',1,false],['review-candidate',1.2,true]]){
    const dest=path.join(out,name);assert(!fs.existsSync(dest),'Refusing to overwrite frozen review candidate');
    for(const f of files){const p=path.join(dest,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.copyFileSync(path.join(root,'public',f),p);}
    fs.writeFileSync(path.join(dest,'game.js'),candidate(src,duration,ui,true));
  }
}
function runnerFor(mode,hz=20){
  let setup=read(path.join(__dirname,'campaign-setup.js'));
  setup=setup.slice(setup.indexOf('function setup('),setup.lastIndexOf("if(typeof module"));
  setup=replace(setup,'window.__decisionTicks=20;',`window.__paceReal=0;window.__paceNext=.05;window.__paceDecisions=0;const pace=Y.dev('({duration:WORLD_DURATION,advance:advanceWorld})');window.__decisionTicks=20;`);
  if(mode==='matched')setup=replace(setup,'C.step(.05);','pace.advance(.05*pace.duration);window.__paceReal+=.05*pace.duration;');
  else{
    setup=replace(setup,'q<seconds*20&&',`q<seconds*${hz}*pace.duration&&`);
    setup=replace(setup,'C.step(.05);',`pace.advance(1/${hz});window.__paceReal+=1/${hz};`);
    setup=replace(setup,'if(q%window.__decisionTicks!==0)continue;', 'if(Y.state().t-window.__stageStart+1e-8<window.__paceNext)continue;window.__paceNext=.05+(++window.__paceDecisions);');
  }
  setup=replace(setup,'return{phase,lot:C.LOT_ID,initial:', 'return{pace:{duration:pace.duration,realSeconds:window.__paceReal,driver:'+JSON.stringify(mode)+',hz:'+hz+'},source:{...window.__src},phase,lot:C.LOT_ID,initial:');
  let code=read(path.join(__dirname,'campaign.cjs'));
  code=replace(code,"const setup = require('./campaign-setup.js');",setup);
  const mod=new Module(path.join(__dirname,'pacing-runner.cjs'),module);mod.filename=path.join(__dirname,'pacing-runner.cjs');mod.paths=module.paths;
  // __filename remains the real runner for its source manifest; adapter hash is stored separately.
  mod._compile(code,path.join(__dirname,'campaign.cjs'));
  return {createRunner:mod.exports.createRunner,adapterHash:sha(code)};
}
async function campaigns(){
  const mode=process.env.DRIVER||'matched',hz=+(process.env.HZ||20),fidelity=process.env.FIDELITY||'sim';
  const seeds=(process.env.SEEDS||'1601,1602,1603').split(',').map(Number),names=(process.env.POLICIES||'smart,smart-skip,smart-balanced').split(',');
  const config=JSON.parse(read(path.join(__dirname,'completion-policy.json'))),runners={};
  const variant=process.env.VARIANT||'',output=path.join(out,`${variant?variant+'-':''}${mode}-${hz}-${fidelity}`);fs.mkdirSync(output,{recursive:true});
  const {createRunner,adapterHash}=runnerFor(mode,hz),summary={mode,hz,fidelity,adapterHash,rows:[],pairs:[]};
  try{
    for(const arm of ['baseline','candidate']){process.env.GAME_ROOT=path.join(out,variant?variant+'-'+arm:arm);runners[arm]=await createRunner(path.join(output,arm));}
    const jobs=seeds.flatMap(seed=>names.map(name=>({seed,name})));let ix=0;
    await Promise.all(Array.from({length:Math.min(3,jobs.length)},async()=>{
      while(ix<jobs.length){const job=jobs[ix++],pair={};
        for(const arm of ['baseline','candidate']){
          const r=await runners[arm].run({...job,config,fidelity,maxMinutes:180});audit(r);pair[arm]=r;
          summary.rows.push({arm,name:job.name,seed:job.seed,file:r.file,complete:r.complete,gameMinutes:r.total/60,realMinutes:r.stages.reduce((n,s)=>n+s.pace.realSeconds,0)/60,spent:r.stages.reduce((n,s)=>n+s.purchases.reduce((m,p)=>m+p.cost,0),0),source:r.stages.map(s=>s.source),stageMinutes:r.stages.map(s=>s.elapsed/60)});
        }
        const b=pair.baseline,c=pair.candidate,equal=replayTrace(b)===replayTrace(c);
        const realRatio=c.stages.reduce((n,s)=>n+s.pace.realSeconds,0)/b.stages.reduce((n,s)=>n+s.pace.realSeconds,0);
        if(mode==='matched'||variant==='fixed'||variant==='review'){assert(equal,'Matched simulation traces changed');assert(Math.abs(realRatio-1.2)<1e-5);}
        summary.pairs.push({name:job.name,seed:job.seed,traceIdentical:equal,realRatio,normalizedRatio:c.total/b.total});
        fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(summary,null,2));
        console.log('PAIR',job.name,job.seed,'game ratio',c.total/b.total,'real ratio',realRatio,'exact',equal);
      }
    }));
    if(mode==='matched'){
      const first=summary.rows.find(r=>r.arm==='candidate'&&r.name==='smart'&&r.seed===seeds[0]);
      if(first){const repeat=await runners.candidate.run({name:'replay',seed:seeds[0],config,fidelity});audit(repeat);const original=JSON.parse(read(path.join(output,'candidate',first.file)));assert.equal(replayTrace(original),replayTrace(repeat));summary.replayIdentical=true;}
    }
    fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(summary,null,2));
  }finally{for(const r of Object.values(runners))await r.close();delete process.env.GAME_ROOT;}
}
async function experiments(){
  const {capacitySource}=require('./cleanup-study.cjs'),{layouts}=require('./sources.cjs');
  const {createRunner,adapterHash}=runnerFor('wall',60),runners={},config=JSON.parse(read(path.join(__dirname,'completion-policy.json')));
  const output=path.join(out,'fixed-builds'),summary={adapterHash,rows:[],pairs:[]};
  const roles={leaf:['bag','bag',...Array(8).fill('leaf')],honey:['honey','honey','bag','bag',...Array(6).fill('leaf')],raw:layouts['raw-leaves'],mixed:layouts['mixed-four-miners']};
  const source=capacitySource(),jobs=Object.entries(roles).map(([name,roles])=>({seed:1801,name:'capacity-'+name,options:{phase:4,phases:[3,4],mode:'capacity',focus:name,roles,minutes:15,snippers:name==='leaf'?0:1,excavation:true}}));
  for(const name of ['leaf','raw','industry'])jobs.push({seed:1802,name:'paid-'+name,options:{phase:4,phases:[3,4],mode:'paid',focus:name,staffing:'specialist',minutes:20,bias:8,payback:8,costPower:.85,secondary:'leaf'}});
  fs.mkdirSync(output,{recursive:true});let ix=0;
  try{
    for(const arm of ['baseline','candidate']){process.env.GAME_ROOT=path.join(out,'fixed-'+arm);runners[arm]=await createRunner(path.join(output,arm));}
    await Promise.all(Array.from({length:3},async()=>{
      while(ix<jobs.length){const j=jobs[ix++],pair={};
        for(const arm of ['baseline','candidate']){
          const r=await runners[arm].run({name:j.name,seed:j.seed,config,experiment:{source,options:j.options},maxMinutes:200});assert.deepEqual(r.errors,[]);pair[arm]=r;
          const e=r.stages.at(-1).experiment;assert(e.finished);
          if(j.options.mode==='paid')audit(r);else assert(e.grantedCapital>0);
          const a=e.points.find(p=>p.t>=300)||e.points[0],z=e.points.at(-1),minutes=(z.t-a.t)/60;
          const rates=Object.fromEntries(Object.keys(z.src).map(k=>[k,(z.src[k]-a.src[k])/minutes]));
          summary.rows.push({arm,name:j.name,mode:j.options.mode,file:r.file,complete:r.complete,gameMinutes:r.total/60,realMinutes:r.stages.reduce((n,s)=>n+s.pace.realSeconds,0)/60,checkpointHash:sha(e.checkpoint),rates,fixtureCost:e.fixturePurchases.reduce((n,p)=>n+p.cost,0),spend:e.spend,fixtureState:e.fixtureState,maxed:e.maxed});
        }
        assert.equal(replayTrace(pair.baseline),replayTrace(pair.candidate));assert.deepEqual(pair.baseline.stages.at(-1).experiment,pair.candidate.stages.at(-1).experiment);
        summary.pairs.push({name:j.name,traceIdentical:true,experimentIdentical:true});fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(summary,null,2));console.log('BUILD',j.name,'identical state, purchases, contribution and staffing traces');
      }
    }));
  }finally{for(const r of Object.values(runners))await r.close();delete process.env.GAME_ROOT;}
}
async function replay(){
  const variant=process.env.VARIANT||'review',mode='wall',hz=60,fidelity=process.env.FIDELITY||'live';
  const dir=path.join(out,`${variant}-${mode}-${hz}-${fidelity}`),summary=JSON.parse(read(path.join(dir,'summary.json')));
  const row=summary.rows.find(r=>r.arm==='candidate'&&r.name==='smart'),original=JSON.parse(read(path.join(dir,'candidate',row.file)));
  process.env.GAME_ROOT=path.join(out,variant+'-candidate');const {createRunner}=runnerFor(mode,hz),runner=await createRunner(path.join(dir,'exact-replay'));
  try{const r=await runner.run({name:'replay',seed:row.seed,config:original.config,fidelity});audit(r);assert.equal(replayTrace(r),replayTrace(original));fs.writeFileSync(path.join(dir,'replay.json'),JSON.stringify({identical:true,seed:row.seed,file:r.file},null,2));console.log('Exact final-candidate seeded replay passed.');}finally{await runner.close();delete process.env.GAME_ROOT;}
}
async function main(){
  const mode=process.env.MODE||'prepare';
  if(mode==='prepare')prepare();else if(mode==='prepare-fixed')prepareFixed();else if(mode==='prepare-review')prepareReview();else if(mode==='campaign')await campaigns();else if(mode==='builds')await experiments();else if(mode==='replay')await replay();else throw Error('Unknown MODE '+mode);
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={candidate,runnerFor,out,files,sha,replace};
