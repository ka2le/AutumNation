'use strict';
// Reproducible, paid full-campaign runs against the current game, in isolated browsers.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const crypto = require('node:crypto'), assert = require('node:assert/strict');
const setup = require('./campaign-setup.js');
const root = path.resolve(__dirname, '../..');
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
function once(s, a, b) { assert.equal(s.split(a).length, 2, 'Headless adapter drift: ' + a); return s.replace(a, b); }
function headless(source) {
  let s = once(source, "if (simMode || T.st !== 'load'", "if (T.st !== 'load'");
  s = once(s, 'const fireRide = !simMode && S.trip', 'const fireRide = S.trip');
  s = once(s, "T.st === 'away' && !simMode", "T.st === 'away'");
  s = once(s, 'setTimeout(() => location.reload(), quick ? 80 : 1300);', 'window.__departed=true;');
  const letter = s.split('\n').find(l => l.includes('if (simMode){ S.letters.push({ id, x: p.x'));
  assert(letter, 'Missing letter adapter anchor'); s = once(s, letter, '');
  s = once(s, 'function beginEnding(){', 'function beginEnding(){ window.__finished=true;');
  s = once(s, 'const W = window.__src; W.leaf +=', 'const W = window.__src; W.nLoose=(W.nLoose||0)+T.takeL;W.nBags=(W.nBags||0)+T.takeB;W.nPlain=(W.nPlain||0)+T.takeH;W.nGift=(W.nGift||0)+T.takeG; W.leaf +=');
  return s.replaceAll('if (simMode && window.__src)', 'if ((simMode || window.__liveCampaign) && window.__src)');
}
function compatibility() {
  const Y = __leafYard;
  window.__reprice = r => ({ ...r, leaf:r.nLoose*Y.dev('leafPrice()'), bag:r.nBags*Y.dev('bagPrice()'),
    metal:r.nM*Y.dev('metalPrice()'), ingot:r.nI*Y.dev('ingotPrice()'),
    jar:r.nPlain*Y.dev('honeyPrice()'), gift:r.nGift*Y.dev('giftJarPrice()') });
  // Required by the current campaign. Shared by every buyer, including the baseline.
  // It assigns a real Shaker; it never grants research or changes its duration.
  window.__maintain = () => {
    const S = Y.state();
    if (S.flags.snipLab && !S.flags.snipKnown && S.shakers[0]) {
      const c = S.shakers[0];
      if (!c.prio[0]?.includes('research')) {
        c.prio = [['research'], ...c.prio.map(row => row.filter(t => t !== 'research')).filter(row => row.length)];
        c.off = c.off.filter(t => t !== 'research'); Y.dev("taskListChanged('shaker',0)");
      }
    }
    if (!Number.isFinite(S.cash) || S.cash < -1e-7) throw Error('Invalid campaign cash');
  };
  const buy = window.__buy;
  window.__buy = o => {
    const actual = o._actual || o;
    const legal = Y.fn().offers().find(x => ['id','key','ri','kind','arg','sty'].every(k => x[k] === actual[k]));
    if (!legal || Math.abs(legal.cost - o.cost) > 1e-7) throw Error('Stale or unavailable purchase: ' + JSON.stringify(o));
    return buy(o);
  };
}
function legacyBank() {
  // Archived V27 bank-letter strategy, preserved as a stronger comparison.
  const Y=__leafYard,base=window.__policy;
  window.__policy=()=>{
    const S=Y.state();
    if(window.__phase===0&&S.story.item==='book'&&S.story.done&&!S.flags.moreLeaves&&S.robots.length>=2&&S.shakers.length>=1){
      const filter=window.__auditFilter;window.__auditFilter=()=>false;base();window.__auditFilter=filter;return;
    }
    base();
  };
}
async function createRunner(output) {
  const gameRoot = path.resolve(process.env.GAME_ROOT || path.join(root,'public'));
  const sourceFiles = ['game.js','lots/hollow.js','lots/prairie.js','index.html','style.css','audio.js','ending.js','tips.js'];
  const files = Object.fromEntries(sourceFiles.map(f => [f,fs.readFileSync(path.join(gameRoot,f))]));
  const source = files['game.js'].toString(), adapted = headless(source);
  const baseline = fs.readFileSync(path.join(__dirname,'legacy-policy.js'),'utf8');
  const smart = fs.existsSync(path.join(__dirname,'smart-policy.js')) ? fs.readFileSync(path.join(__dirname,'smart-policy.js'),'utf8') : '';
  const honeySource='if(window.__experimentOptions.byPhase)window.__experimentOptions=window.__experimentOptions.byPhase[window.__phase];\n'+fs.readFileSync(path.join(__dirname,'source-experiment.js'),'utf8');
  const manifest = { sources:Object.fromEntries(sourceFiles.map(f => [f,hash(files[f])])),
    baseline:hash(baseline), smart:hash(smart), honeyMax:hash(honeySource), harness:hash(fs.readFileSync(__filename)), setup:hash(setup.toString()),
    method:'20 Hz actual game economy; one-second decisions; actual offers and charges; real research, letters and boarding; home/hollow/return; no grants, jumps or injected progress. Finale begins at finish; cinematic duration excluded. Seed resets each visit. Browser timers/rendering disabled.' };
  fs.mkdirSync(output,{recursive:true});
  const frozen = path.join(output,'sources'); fs.mkdirSync(path.join(frozen,'lots'),{recursive:true});
  for (const [f, data] of Object.entries(files)) fs.writeFileSync(path.join(frozen,f),data);
  fs.writeFileSync(path.join(frozen,'game-headless.js'),adapted);
  fs.writeFileSync(path.join(frozen,'legacy-policy.js'),baseline);fs.writeFileSync(path.join(frozen,'smart-policy.js'),smart);
  for(const f of ['campaign.cjs','campaign-setup.js','search.cjs','validate.cjs'])fs.copyFileSync(path.join(__dirname,f),path.join(frozen,f));
  fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));
  const server = http.createServer((req,res) => {
    const name = decodeURIComponent(req.url.split('?')[0]).replace(/^\//,'') || 'index.html';
    if (!Object.hasOwn(files,name)) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');
    res.end(name==='game.js'?adapted:files[name]);
  });
  await new Promise(r => server.listen(0,'127.0.0.1',r));
  let browser;
  try {
    let playwright;
    for(const name of [process.env.PLAYWRIGHT_PATH,'playwright','C:/Users/kallek/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'].filter(Boolean)){
      try {playwright=require(name);break;}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
    }
    if(!playwright)throw Error('Playwright missing. Set PLAYWRIGHT_PATH to its installed package directory.');
    const chrome=process.env.CHROME_PATH||(process.platform==='win32'&&'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe');
    browser=await playwright.chromium.launch({headless:true,...(chrome?{executablePath:chrome}:{})});
  }catch(e){await new Promise(r=>server.close(r));throw e;}
  async function run({name='smart', seed=1, config={}, maxMinutes=150, phases=[0,3,4], fidelity='sim', experiment=null}) {
    if(name==='smart-balanced')config={...config,freezeHomeHoneyAfterGoal:false,excavation:false,honeyMax:null};
    if(name==='smart-skip')config={...config,honeyMax:null};
    if(config.honeyMax&&!name.startsWith('legacy')&&!experiment)experiment={source:honeySource,options:{phases:Object.keys(config.honeyMax).map(Number),byPhase:config.honeyMax}};
    const context = await browser.newContext({viewport:{width:1280,height:800}}), page = await context.newPage();
    assert(['sim','live'].includes(fidelity),'Unknown fidelity');
    const result = {name,seed,config,fidelity,manifest,experiment:experiment && {options:experiment.options,hash:hash(experiment.source)},stages:[],errors:[],total:0,complete:false};
    if(experiment)fs.writeFileSync(path.join(frozen,`experiment-${hash(experiment.source).slice(0,12)}.js`),experiment.source);
    page.on('pageerror',e => result.errors.push(e.message));
    await page.route(/^https:\/\//,r => r.abort());
    await page.addInitScript(seed => {
      let a=seed*103;
      Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
      window.__rngState=()=>a;
      window.requestAnimationFrame=()=>0;window.setTimeout=()=>0;window.setInterval=()=>0;
    },seed);
    try {
      await page.goto(`http://127.0.0.1:${server.address().port}/?fresh`);
      for (const phase of phases) {
        await page.waitForFunction(()=>window.__leafYard && window.__leafYard.robots().length);
        const profile=({'legacy-bank':'bankLetter','legacy-goal':'goalFirst','legacy-industrial':'ingotFirst'})[name]||'balanced';
        await page.evaluate(setup,{phase,profile,crew:config.researchCrew || 3});
        await page.evaluate(baseline);await page.evaluate(compatibility);
        if(name==='legacy-bank')await page.evaluate(legacyBank);
        if(fidelity==='live')await page.evaluate(()=>{window.__liveCampaign=true;__leafYard.dev('simMode=false;closeCard();');});
        await page.evaluate(config => window.__config=config,config);
        if (!name.startsWith('legacy')) { assert(smart,'Smart policy missing'); await page.evaluate(smart); }
        if(experiment && (experiment.options.phases||[experiment.options.phase]).includes(phase)){
          await page.evaluate(options=>window.__experimentOptions=options,experiment.options);
          await page.evaluate(experiment.source);
        }
        let status;
        for (let chunk=0;chunk<Math.ceil(maxMinutes/2);chunk++) {
          status=await page.evaluate(()=>{const s=window.__advance(120);return {departed:s.departed,finished:s.finished,experimentDone:!!window.__experimentDone};});
          if (status.departed || status.finished || status.experimentDone) break;
        }
        const stage=await page.evaluate(()=>window.__advance(0));
        stage.experiment=await page.evaluate(()=>window.__experiment||null);
        stage.offset=result.total;result.total+=stage.elapsed;result.stages.push(stage);
        console.log(`${name} seed ${seed} stage ${phase}: ${(stage.elapsed/60).toFixed(2)}m ${stage.finished?'finished':stage.departed?'travel':'INCOMPLETE'}`);
        if (stage.finished) { result.complete=true;break; }
        if (!stage.departed) break;
        await page.reload();
      }
    } catch(e) { result.errors.push(e.stack); }
    finally { await context.close(); }
    result.complete &&= !result.errors.length;
    const id=hash(JSON.stringify({name,seed,config,fidelity,experiment:result.experiment})).slice(0,10);
    result.file=`${name}-${seed}-${id}.json`;
    fs.writeFileSync(path.join(output,result.file),JSON.stringify(result));
    return result;
  }
  return {run,manifest,close:async()=>{await browser.close();await new Promise(r=>server.close(r));}};
}
if (require.main===module) (async()=>{
  const output=path.resolve(process.env.RESULT_DIR || 'runs/smart-tester');
  const runner=await createRunner(output);
  try {
    const seeds=(process.env.SEEDS || '1').split(',').map(Number), names=(process.env.POLICIES || 'smart').split(',');
    const configFile=process.env.CONFIG||path.join(__dirname,'completion-policy.json');
    const config=JSON.parse(fs.readFileSync(configFile,'utf8'));
    for(const seed of seeds) for(const name of names) {
      const r=await runner.run({name,seed,config:name.startsWith('legacy')?{}:config,maxMinutes:+(process.env.MAX_MINUTES||150),fidelity:process.env.FIDELITY||'sim'});
      console.log(JSON.stringify({name,seed,minutes:r.total/60,complete:r.complete,errors:r.errors}));
      if(!r.complete)process.exitCode=1;
    }
  } finally {await runner.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={createRunner,headless};
