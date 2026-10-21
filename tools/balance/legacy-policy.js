window.__researchReady=S=>!(window.AUDIT_DRY&&S.story.item==='hive')||(S.robots.length>=window.__researchCrew&&S.totals.drySold>0);window.__researchBlower=S=>S.blowers.length>=2?1:0;
(()=>{const Y=__leafYard;window.__offers=()=>Y.fn().offers().map(o=>o.id==='copy'?{...o,id:o.kind,_actual:o}:o);window.__buy=o=>{const S=Y.state(),cash=S.cash;const ok=Y.buy(o._actual||o);if(ok&&Math.abs(cash-S.cash-o.cost)>1e-6)throw Error('Wrong purchase charge');return ok;};window.__homeQuests=S=>window.__phase===2||(window.__arm==='after'&&window.__phase===0&&S.miles.honeyHome!=null);})();
(()=>{window.__purchases=[];window.MARK=600;window.PAYBACK=5;window.__lastBuy=0;
 window.__src={leaf:0,bag:0,metal:0,ingot:0,jar:0,gift:0,clean:0,nL:0,nM:0,nI:0,nJ:0,nLoose:0,nBags:0,nPlain:0,nGift:0};
 const profile=window.__profile;
 window.AUDIT_DRY=__leafYard.dev('DRY_BENCH');
 window.__auditFilter=(o,S)=>!(profile==='eight'&&o.id==='robot'&&S.robots.length>=8) && !(o.id==='hiveUp'&&o.key==='nursery'&&S.hive.bees>=25) && !(profile==='goalFocus'&&window.__phase===4&&(['bee','hiveUp','honeyPack'].includes(o.id)||['honeyPrice','giftPrice','hiveStore','hiveTank'].includes(o.key)));
 window.__auditWeight=(o,S)=>profile==='wide'&&o.id==='robot'?4:profile==='helperRush'&&['blower','shaker','hup'].includes(o.id)?4:1;
 const Y = __leafYard, F = Y.fn();

const log = [], marks = [];
let fills = [], maxBin = 0, lastTrucks = 0, hist = [], incomeHist = [], nextBuy = 0, nextMark = 0, lim = {}, scarceT = 0, waitFor = null;
const LEAF_TRACKS = ['speed', 'carry', 'pick', 'grab', 'reach'];
// what each kind of thing has earned a minute lately (needs window.__src, which the game fills in during a sim)
if (!window.__src) window.__src = { leaf:0, bag:0, metal:0, ingot:0, jar:0, gift:0, clean:0, nL:0, nM:0, nI:0, nJ:0 };
const srcH = [], PAYBACK = +(window.PAYBACK || 5);
const PRICE_KEYS = ['press','leafPrice', 'bagPrice', 'cleanup', 'metalPrice', 'honeyPrice', 'ingotGrade', 'giftPrice', 'slag', 'smeltSpeed'];
const PRICE_SRC = { leafPrice:['leaf','bag'], bagPrice:['bag'], metalPrice:['metal','ingot'], honeyPrice:['jar','gift'], giftPrice:['gift'], ingotGrade:['ingot'], slag:['ingot'], smeltSpeed:['ingot'], market:['leaf','bag','metal','ingot','jar','gift'] };
function srcRate(){
  if (srcH.length < 2) return null;
  const a = srcH[0], b = srcH[srcH.length - 1], dt = Math.max(1, b[0] - a[0])/60, o = {};
  for (const k in b[1]) o[k] = (b[1][k] - a[1][k])/dt;
  return window.__reprice(o);
}
// extra money a minute from buying price upgrade x now
function gainOf(S, x, smeltIdle){
  const r = srcRate(); if (!r) return 0;
  if (x.id === 'gen' && x.key === 'press'){const L=S.gen.press||0;return (r.leaf+r.bag)*0.15/(1+0.15*L);}
  if (x.id === 'gen'){ const L = S.gen.market || 0; return PRICE_SRC.market.reduce((a, k) => a + r[k], 0)*(0.1/(1 + 0.1*L)); }
  const U = F.UP[x.key], L = S.lv[x.key] | 0, v0 = U.val(L), v1 = U.val(L + 1);
  if (x.key === 'cleanup') return r.nL*(v1 - v0)/100;
  const ratio = x.key === 'slag' ? (1 + v1)/(1 + v0) : v1/v0;
  let g = PRICE_SRC[x.key].reduce((a, k) => a + r[k], 0)*(ratio - 1);
  if (x.key === 'smeltSpeed') g *= Math.max(0, 1 - smeltIdle*1.5);   // only helps while the smelters are busy
  return g;
}
const isPacker = c => c.prio[0].includes('bag') || c.prio[0].includes('jar') || c.prio[0].includes('wrap');
const avg = k => hist.length ? hist.reduce((a, h) => a + h[k], 0)/hist.length : 0;
function income(){
  if (incomeHist.length < 2) return 1;
  const a = incomeHist[0], b = incomeHist[incomeHist.length - 1];
  return Math.max(0.5, (b[1] - a[1])/Math.max(1, b[0] - a[0])*60);
}
// task lists: a packer once there's packing to do and 3+ robots, miners for every mine slot, smelters and a hauler
function setTasks(S){
  const n=S.robots.length, active=[];
  const plant=S.plant.built?Math.min(window.__staffOptions?.plant ?? 3,Math.max(1,Math.floor(n/3))):0;
  let pack=(S.bag.built && !window.AUDIT_DRY || S.hive.built && (!window.AUDIT_DRY || S.flags.antHill)) && n>=3 ? 1:0;
  if(S.hive.bees>=14 && n>=6)pack=window.__profile==='goalFocus'&&window.__phase===4?1:2;
  if(window.__staffOptions?.pack!=null && pack)pack=Math.min(pack,window.__staffOptions.pack);
  let free=Math.max(0,n-1-pack-plant), slots=[];
  for(const sp of S.miners){slots.push(sp);if(S.shafts.includes(sp))slots.push(sp);}
  const wantMine=Math.min(free,slots.length);
  const order=window.__jobOrder?.(S,{n,pack,plant,slots,wantMine});
  // A reassigned specialist must release its old mine reservation before the new
  // roster claims slots. Leave the archived fixed-order baseline untouched.
  if(order)S.robots.forEach(c=>{c.miner=null;});
  for(let j=0;j<n;j++){
    const roleJ=order?order[j]:j;
    let rows=!window.AUDIT_DRY&&S.bag.built&&!pack ? [['leaves','bag']] : [['leaves'],...(!window.AUDIT_DRY && S.bag.built ? [['bag']] : [])];
    if(roleJ>=n-pack)rows=pack===2&&roleJ===n-1?[['jar','wrap'],...(!window.AUDIT_DRY?[['bag']]:[]),['leaves']]:[...(!window.AUDIT_DRY?[['bag']]:[]),['jar','wrap'],['leaves']];
    else if(roleJ>=n-pack-plant)rows=plant===3 && roleJ===n-pack-plant ? [['haul'],['smelt'],['leaves']] : [['smelt'],['haul'],['leaves']];
    else if(roleJ>0&&roleJ<=wantMine){rows=[['mine'],['leaves']];S.robots[j].miner=slots[roleJ-1];}
    else S.robots[j].miner=null;
    if(roleJ===0 && window.AUDIT_DRY && S.bench.fire)rows.unshift(['fuel']);
    if(roleJ===0 && !window.AUDIT_DRY && S.plant.built)rows.unshift(['refuel']);
    if(j===1&&n>=3&&window.__researchReady(S)&&S.story.found&&!S.story.done&&['hive','bee'].includes(S.story.item))rows.unshift(['research']);
    if(j===0&&window.__researchReady(S)&&S.story.found&&!S.story.done)rows.unshift(['research']);
    if(j===1&&S.story.found&&!S.story.done&&S.story.item==='fire')rows.unshift(['research']);
    if(S.trip&&j===0)rows.unshift(['travel']);
    const cfg=S.robots[j];const changed=JSON.stringify(cfg.prio)!==JSON.stringify(rows);cfg.prio=rows;cfg.off=['leaves','mine','bag','jar','wrap','smelt','haul','research','refuel','fuel','travel'].filter(t=>!rows.flat().includes(t));if(changed)Y.dev("taskListChanged('robot',"+j+")");
  }
  if(window.AUDIT_DRY){
    S.shakers.forEach((c,i)=>{const rows=[['shake'],['snip']];if(i===0&&S.story.found&&!S.story.done&&S.story.item==='fire')rows.unshift(['research']);c.prio=rows;c.off=['shake','snip','research','travel'].filter(t=>!rows.flat().includes(t));});
  }
  S.blowers.forEach((c,i)=>{
    let rows=window.AUDIT_DRY && c.lv.dry>0?[['bag'],['blow']]:[['blow']];
    if(S.plant.built&&i===0)rows=[['stoke']];
    if(i===window.__researchBlower(S)&&window.__researchReady(S)&&S.story.found&&!S.story.done&&['hive','fire'].includes(S.story.item))rows.unshift(['research']);
    if(window.AUDIT_DRY&&S.flags.dryLab&&!S.flags.dryKnown&&i===0)rows.unshift(['research']);
    if(S.trip?.crew?.includes('blower')&&i===0)rows.unshift(['travel']);
    const changed=JSON.stringify(c.prio)!==JSON.stringify(rows);c.prio=rows;c.off=['bag','blow','dig','stoke','research','travel'].filter(t=>!rows.flat().includes(t));
    if(changed)Y.dev("taskListChanged('blower',"+i+")");
  });
  Y.dev('fixSlots()');
  return Math.min(10,1+pack+slots.length+plant);
}

 window.__policy=()=>{
  const S = Y.state(), R = Y.robots(), B = Y.bees();

  maxBin = Math.max(maxBin, S.binLeaves); if (S.totals.trucks !== lastTrucks){ lastTrucks = S.totals.trucks; fills.push(maxBin/F.binCap()); maxBin = 0; }
  const leafers = R.filter(r => S.robots[r.id].prio.find(row => row[0] !== 'research')?.[0] === 'leaves');
  const idle = leafers.filter(r => r.st === 'wander' || r.st === 'rest').length/Math.max(1, leafers.length);
  const waitBin = R.filter(r => r.st === 'wait' && r.at !== 'metal').length/Math.max(1, R.length);
  const loiter = B.length ? B.filter(b => b.st === 'loiter').length/B.length : 0;
  const queue = B.length ? B.filter(b => b.st === 'queue').length/B.length : 0;
  const tubFull = S.metalSlot && S.miners.length && F.tubRoom() <= 0 ? 1 : 0;
  const packers = R.filter(r => isPacker(S.robots[r.id]));
  const packBusy = packers.length ? packers.filter(r => r.st === 'bag' || r.st === 'jar' || r.st === 'wrap' || r.st === 'toStation').length/packers.length : 0;
  const smelters = R.filter(r => S.robots[r.id].prio[0][0] === 'smelt');
  const smeltIdle = smelters.length ? smelters.filter(r => r.st !== 'smelt').length/smelters.length : 0;
  hist.push({ t: S.t, idle, waitBin, loiter, queue, tubFull, packBusy, smeltIdle }); while (hist.length && hist[0].t < S.t - 60) hist.shift();
  if (S.t < nextBuy) return;
  nextBuy = S.t + 1;
  if (window.__src){ srcH.push([S.t, Object.assign({}, window.__src)]); while (srcH.length && srcH[0][0] < S.t - 180) srcH.shift(); }
  incomeHist.push([S.t, S.totals.cash]); while (incomeHist.length && incomeHist[0][0] < S.t - 120) incomeHist.shift();
  const staff = setTasks(S);
  const inc = income(), all = window.__offers().filter(o=>window.__auditFilter(o,S));
  const recentFill = fills.slice(-2), binLimited = recentFill.length && recentFill.reduce((a, v) => a + v, 0)/recentFill.length > 0.95 && avg('waitBin') > 0.02;
  const scarce = scarceT > 0 ? avg('idle') > 0.04 : avg('idle') > 0.08; scarceT = scarce ? scarceT + 1 : 0;
  const L = { bin: binLimited, leaves: scarce, flowers: avg('loiter') > 0.3, tank: avg('queue') > 0.2, tub: avg('tubFull') > 0.3, smelt: smelters.length && avg('smeltIdle') > 0.5, pack: packers.length && avg('packBusy') > 0.85 };
  if (S.t >= nextMark){ nextMark += +(window.MARK || 300); const fr = fills.splice(0).map(v => v.toFixed(1)).join(','); marks.push((S.t/60).toFixed(0) + 'm $/min ' + inc.toFixed(0) + ' robots ' + S.robots.length + ' land ' + S.land + ' fills[' + fr.slice(-24) + '] bin ' + F.binCap() + ' wait ' + avg('waitBin').toFixed(2) + ' idle ' + avg('idle').toFixed(2) + (packers.length ? ' packBusy ' + avg('packBusy').toFixed(2) : '') + (S.hive.built ? ' bees ' + S.hive.bees + ' loiter ' + avg('loiter').toFixed(2) + ' q ' + avg('queue').toFixed(2) : '') + (S.metalSlot ? ' tubFull ' + avg('tubFull').toFixed(2) : '') + (S.plant.built ? ' smeltIdle ' + avg('smeltIdle').toFixed(2) : '')); }
  const top = L.bin ? 'bin' : L.leaves ? 'leaves' : 'robots'; lim[top] = (lim[top] || 0) + 1;
  const cheapest = list => list.slice().sort((a, b) => a.cost - b.cost)[0];
  const C = [];   // [offer, why]
  const add = (o, why, maxMin) => { if (o && (maxMin == null || o.cost <= inc*maxMin)) C.push([o, why]); };
  // pure value: price upgrades that pay back within a couple of minutes
  // price upgrades: a sensible player buys one once it pays for itself within PAYBACK minutes (from what each kind of
  // thing has earned over the last few minutes), cheapest payback first
  for (const x of all.filter(x => (x.id === 'up' && PRICE_KEYS.includes(x.key)) || (x.id === 'gen' && ['market','press'].includes(x.key)))){
    const g = gainOf(S, x, smelters.length ? avg('smeltIdle') : 1);
    if (g > 0 && x.cost/g <= PAYBACK){ x.payback = x.cost/g; add(x, 'price', 5); }
  }
  add(all.find(x => x.id === 'bagger'), 'bagging');
  if(S.plant.built||S.flags.coalKnown){const cap=F.rackCap?F.rackCap():10;if(S.ingots>=F.palletCap()*.7||S.plant.rack>=cap*.7)add(all.find(x=>x.id==='up'&&x.key==='pallet'),'finished storage',3);}
  // leaves
  if (L.bin){
    const bin = all.find(x => x.id === 'up' && x.key === 'bin'), tr = all.find(x => x.id === 'up' && x.key === 'truck');
    add(!bin ? tr : !tr ? bin : (bin.cost <= tr.cost*1.6 ? bin : tr), 'bin full');
    if (S.bag.built) add(cheapest(all.filter(x => (x.id === 'rup' && x.key === 'pack' && isPacker(S.robots[x.ri])) || (x.id === 'tech' && x.key === 'jig'))), 'bin full: pack', 3);
  } else if (L.leaves){
    add(cheapest(all.filter(x => x.id === 'shaker' || x.id === 'blower' || (x.id === 'hup' && ['shake', 'blow'].includes(x.key)) || (x.id === 'tech' && ['pincers', 'turbine', 'jet'].includes(x.key)))), 'leaves scarce', 4);
  } else {
    const leafRobots = S.robots.map((c, j) => j).filter(j => S.robots[j].prio[0][0] === 'leaves');
    add(cheapest(all.filter(x => (x.id === 'rup' && LEAF_TRACKS.includes(x.key) && leafRobots.includes(x.ri)) || (x.id === 'tech' && ['treads', 'hamper', 'servos', 'wrist', 'fineWrist', 'claw', 'arm', 'hubs', 'hopper'].includes(x.key)) || x.id === 'robot')), 'robots', 4);
  }
  // packing
  if (L.pack) add(cheapest(all.filter(x => (x.id === 'rup' && x.key === 'pack' && isPacker(S.robots[x.ri])) || (x.id === 'tech' && ['jig', 'precision'].includes(x.key)))), 'packer busy', 3);
  // bees
  if (!S.hive.built) add(all.find(x => x.id === 'hive'), 'start bees', 5);
  else {
    if (L.tank || S.hive.honey >= F.honeyCap() - 0.01) add(cheapest(all.filter(x => x.id === 'up' && (x.key === 'hiveStore' || x.key === 'hiveTank'))), 'hive full', 4);
    if (!L.flowers) add(all.find(x => x.id === 'bee'), 'bees', 2);
    add(cheapest(all.filter(x => x.id === 'hiveUp')), 'hive upgrade', 3);
    add(all.find(x => x.id === 'honeyPack'), 'gift wrap', 4);
  }
  // metal
  if (!S.metalSlot) add(all.find(x => x.id === 'metalSlot'), 'start metal', 6);
  else {
    if (L.tub) add(all.find(x => x.id === 'up' && x.key === 'metalBin'), 'tub full', 4);
    else add(cheapest(all.filter(x => x.id === 'miner' || x.id === 'shaft')), !S.miners.length ? 'start metal' : S.plant.built ? 'feed smelter' : 'more ore', S.plant.built && L.smelt ? 5 : 3);
    add(cheapest(all.filter(x => (x.id === 'rup' && ['drill', 'magnet'].includes(x.key) && S.robots[x.ri].prio[0][0] === 'mine') || (x.id === 'tech' && ['diamond', 'horseshoe'].includes(x.key)))), 'miners', 2);
    if (!S.plant.built) add(all.find(x => x.id === 'plant'), 'start smelting', 6);
    else { add(all.find(x => x.id === 'up' && x.key === 'hopper'), 'hopper', 2); add(cheapest(all.filter(x => x.id === 'rup' && x.key === 'pack' && S.robots[x.ri].prio[0][0] === 'smelt')), 'smelters', 2); }
  }
  if(window.AUDIT_DRY){
    add(cheapest(all.filter(x=>x.id==='hup'&&x.key==='dry'||x.id==='tech'&&['kiln','tunnel'].includes(x.key))),'drying',3);
    if(S.story.found&&!S.story.done){add(cheapest(all.filter(x=>x.id==='rup'&&x.key==='study'&&S.robots[x.ri].prio[0]?.includes('research'))),'research',3);if(S.story.item==='fire'){add(all.find(x=>x.id==='robot'),'fire crew',2);add(all.find(x=>x.id==='shaker'),'fire crew',2);}}
    if(S.miners.length<2 && S.metalSlot)add(all.find(x=>x.id==='miner'),'second saw',2);
  }
  add(all.find(x=>x.id==='gen'&&x.key==='oil'),'grease', S.robots.length>=5?3:0);
  add(all.find(x=>x.id==='gen'&&x.key==='basket'),'copy basket',S.robots.length>=6?3:0);
  add(all.find(x=>x.id==='gen'&&x.key==='blueprint'),'copy skills',S.robots.length>=6?1:0);
  add(all.find(x=>x.id==='gen'&&x.key==='cutting'),'cutting oil',S.miners.length>=2?3:0);
  if(S.hive.built){add(all.find(x=>x.id==='hup'&&x.key==='snip'),'flowers',L.flowers?3:0);}
  add(cheapest(all.filter(x=>x.id==='rup' && ['speed','carry'].includes(x.key) && S.robots[x.ri].prio.some(row=>row.includes('mine')||row.includes('smelt')||row.includes('haul')))),'logistics',2);
  add(cheapest(all.filter(x=>x.id==='rup' && x.key==='speed' && isPacker(S.robots[x.ri]))),'packing travel',1);
  if(S.plant.built){
    add(cheapest(all.filter(x=>x.id==='rup' && x.key==='drill' && S.robots[x.ri].prio[0]?.[0]==='smelt')),'furnace operation',2);
    if(avg('smeltIdle')<0.5)add(cheapest(all.filter(x=>x.id==='hup'&&x.key==='stoke'||x.id==='tech'&&x.key==='forge')),'bellows',2);
  }
  if(L.flowers)add(cheapest(all.filter(x=>x.id==='gen' && ['clover','seeding'].includes(x.key))),'flowers',3);
  if(S.story.found&&!S.story.done)add(cheapest(all.filter(x=>x.id==='rup'&&x.key==='study'&&S.robots[x.ri].prio[0]?.includes('research'))),'research',3);
  if(S.plant.built)add(cheapest(all.filter(x=>x.id==='rup'&&x.key==='magnet'&&S.robots[x.ri].prio[0]?.[0]==='smelt')),'operator yield',2);
  if(S.hive.built && S.hive.bees>=10 && S.hive.bees<20)add(all.find(x=>x.id==='hiveUp'&&x.key==='nursery'),'early nursery',3);
  if (S.robots.length < staff) add(all.find(x => x.id === 'robot'), 'staff', 4);
  // land: once the plot has been short of leaves for a while, or the bees run out of flowers, or every vein here is mined
  if(window.__phase===0 && S.story.done && (window.__profile==='save200' || window.__profile==='save200crew'&&S.robots.length>=2&&S.shakers.length>=1)){window.__saving=true;return;}
  if(window.__homeQuests(S) && S.land<1)add(all.find(x=>x.id==='land'),'need land');

  window.__saving=!!S.trip;
  if(!window.__choose && S.trip && !(window.__phase===0 && S.trip.tinker && Y.dev("tinkerWorth()<TINKER_GOAL")))return;
  const land = all.find(x => x.id === 'land');
  if (land && (scarceT > 120 || L.flowers || (S.metalSlot && SPOTS_HERE(S) <= 0))) add(land, 'need land');

  if(window.AUDIT_DRY&&!S.flags.antHill&&S.flags.dryKnown&&S.totals.drySold>0){
    if(S.robots.length<window.__researchCrew)add(all.find(o=>o.id==='robot'),'leaf income crew before hive research');
    else if(S.blowers.length<2)add(all.find(o=>o.id==='blower'),'keep drying during hive research');
  }
  if(window.__phase===0 && S.flags.tinkerGoal && Y.dev('tinkerWorth()<TINKER_GOAL')){
    const train=cheapest(all.filter(o=>o.id==='rup'&&o.ri===0&&LEAF_TRACKS.includes(o.key)||o.id==='tech'&&['treads','hamper','servos','wrist','fineWrist','claw','arm','hubs','hopper'].includes(o.key)));
    if(train){C.length=0;add(train,'prepare travelling Tinker');}
  }
  if(window.__choose){const choice=window.__choose(C,{S,all,inc,L,staff,rate:srcRate(),smeltIdle:avg("smeltIdle")});if(choice&&choice[0].cost<=S.cash+1e-9&&window.__buy(choice[0]))window.__purchases.push({t:S.t,...choice[0],why:choice[1]});return;}
  if (!C.length) return;
  // a player sees big new steps (land, a new building, a new kind of income) as worth more than one more small upgrade
  const VALUE = { 'need land': 3, 'start bees': 3, 'start metal': 3, 'start smelting': 3, bagging: 3, price: 2, 'bin full': 1.5, 'hive full': 1.5, 'tub full': 1.5, 'packer busy': 1.5, 'feed smelter': 1.5 };
  const score = c => c[0].cost/(VALUE[c[1]] || 1)/window.__auditWeight(c[0],S)/(c[1]==='leaf income crew before hive research'||c[1]==='keep drying during hive research'?6:1);
  const [o, why] = C.sort((a, b) => score(a) - score(b))[0];
  if (o.cost > S.cash + 1e-9){ waitFor = why; return; }   // save up for it
  waitFor = null;
  if(window.__buy(o)) window.__purchases.push({t:S.t,...o,why,wait:S.t-window.__lastBuy});window.__lastBuy=S.t; log.push((S.t/60).toFixed(1) + 'm ' + o.id + (o.key ? ':' + o.key : '') + (o.ri != null ? '#' + o.ri : '') + ' $' + o.cost + ' [' + why + (o.payback ? ' ' + o.payback.toFixed(1) + 'm' : '') + ']');};
 function SPOTS_HERE(S){return [0,1,2].filter(i=>i<=S.land&&!S.miners.includes(i)).length;}
})();
if(window.__profile==='ingotFirst'){
(()=>{
 const Y=window.__leafYard,F=Y.fn(),base=window.__policy;
 let next=0,recent=[],activity=[],previous=null;
 const miners=[1,4,5,6],operators=[0,3],haulers=[2,7];
 const set=(c,rows,kind,i)=>{const changed=JSON.stringify(c.prio)!==JSON.stringify(rows);c.prio=rows;c.off=(kind==='robot'?['leaves','mine','bag','jar','wrap','smelt','haul','research','refuel','fuel','travel']:['bag','blow','dig','stoke','research','travel']).filter(t=>!rows.flat().includes(t));if(changed)Y.dev(`taskListChanged('${kind}',${i})`);};
 function staff(S){
  const slots=S.miners.flatMap(sp=>S.shafts.includes(sp)?[sp,sp]:[sp]);
  const assigned=miners.filter(i=>i<S.robots.length).slice(0,slots.length);
  S.robots.forEach((c,i)=>{
   let rows=[['leaves'],['bag']];c.miner=null;
   if(assigned.includes(i)){rows=[['mine']];c.miner=slots[assigned.indexOf(i)];}
   else if(S.plant.built&&operators.includes(i))rows=[['smelt']];
   else if(S.plant.built&&haulers.includes(i))rows=i===2?[['refuel'],['haul']]:[['haul']];
   else if(i===9)rows=[['jar','wrap'],['bag'],['leaves']];
   if(i===0&&S.story.found&&!S.story.done)rows.unshift(['research']);
   if(S.trip&&i===0)rows.unshift(['travel']);
   set(c,rows,'robot',i);
  });
  S.blowers.forEach((c,i)=>set(c,S.plant.built&&i===0?[['stoke']]:[['blow']],'blower',i));
  Y.dev('fixSlots()');return assigned;
 }
 function rate(){if(recent.length<2)return 0;const a=recent[0],b=recent.at(-1);return(b.cash-a.cash)/((b.t-a.t)/60);}
 function purchase(o,why,S){if(!o)return false;if(o.cost>S.cash+1e-9)return false;const before=S.cash;if(window.__buy(o)){window.__purchases.push({t:S.t,...o,why,charged:before-S.cash});return true;}return false;}
 window.__policy=()=>{
  if(window.__phase!==4)return base();
  const S=Y.state();
  if(S.t<next)return;next=S.t+1;
  const assigned=staff(S);
  if(S.trip)return;
  recent.push({t:S.t,cash:S.totals.cash});while(recent.length&&recent[0].t<S.t-180)recent.shift();
  const R=Y.robots(),active=operators.filter(i=>i<S.robots.length),opR=R.filter(r=>active.includes(r.id));
  activity.push({t:S.t,starved:S.plant.built&&S.plant.ore<4?1:0,rack:S.plant.rack>=7?1:0,pallet:S.ingots>=F.palletCap()*.8?1:0});while(activity.length&&activity[0].t<S.t-60)activity.shift();
  const avg=k=>activity.length?activity.reduce((n,x)=>n+x[k],0)/activity.length:0;
  if(S.t>=window.__nextIndustrialSample||window.__nextIndustrialSample==null){window.__nextIndustrialSample=S.t+10;(window.__industrial??=[]).push({t:S.t-window.__stageStart,miners:assigned.length,operators:opR.map(r=>({id:r.id,st:r.st,task:r.task})),haulers:R.filter(r=>haulers.includes(r.id)).map(r=>({id:r.id,st:r.st,task:r.task})),ore:S.plant.ore,rack:S.plant.rack,rackCap:F.rackCap?F.rackCap():10,ingots:S.ingots,palletCap:F.palletCap(),hopperCap:F.hopperCap(),coal:S.plant.coal,coalStand:S.coalStand,src:{...window.__src},totals:{...S.totals},cash:S.cash,skills:S.robots.map(c=>({...c.lv})),lv:{...S.lv},bellows:Y.helpers().filter(h=>h.kind==='blower').map(h=>h.st),rackBlocked:Y.dev('R.filter(r=>S.robots[r.id].prio[0]?.includes("smelt")&&!rackHasRoom(r)).length'),jobs:S.robots.map(c=>c.prio)});}
  const all=window.__offers();
  const find=(id,key)=>all.find(o=>o.id===id&&(key==null||o.key===key));
  if(!S.flags.ruinKnown){
   const study=all.filter(o=>o.id==='rup'&&o.ri===0&&o.key==='study').sort((a,b)=>a.cost-b.cost)[0];purchase(study,'research old works',S);return;
  }
  if(!S.plant.built){purchase(find('plant'),'repair plant first',S);return;}
  const C=[],add=(o,why,weight)=>{if(o)C.push({o,why,score:o.cost/weight});};
  const cheapest=list=>list.sort((a,b)=>a.cost-b.cost)[0];
  // All four ore slots, two processing-only operators, two transport workers; remaining crew funds growth.
  if(S.robots.length<10)add(find('robot'),'industrial crew',S.robots.length<7?8:4);
  if(S.miners.length<2)add(find('miner'),'second ore vein',12);
  if(S.shafts.length<2)add(find('shaft'),'four miner slots',9);
  // Throughput purchases are eligible regardless of sampled operator idle fraction.
  add(find('up','smeltSpeed'),'furnace heat',9);
  add(find('up','slag'),'extra physical ingots',6);
  add(find('up','hopper'),'ore buffer',avg('starved')>.3?7:2);
  if(F.UP.pallet)add(find('up','pallet'),'max ingot pallet and rack',avg('pallet')>.2?14:4);
  add(find('up','metalBin'),F.UP.pallet?'raw ore buffer':'max ingot pallet',F.UP.pallet?1:avg('pallet')>.2?14:2);
  add(find('up','truck'),'frequent ingot sales',avg('pallet')>.2?14:3);
  add(find('tech','jig'),'operator packing unlock',9);add(find('tech','precision'),'operator packing unlock',8);
  add(find('tech','diamond'),'machinery unlock',9);add(find('tech','horseshoe'),'yield unlock',6);
  add(find('tech','forge'),'bellows unlock',10);
  add(cheapest(all.filter(o=>o.id==='hup'&&o.ri===0&&o.key==='stoke')),'max bellows',12);
  for(const o of all.filter(o=>o.id==='rup')){
   if(operators.includes(o.ri)){
    if(o.key==='pack')add(o,'processing-only operator packing',10);
    if(o.key==='drill')add(o,'operator machinery',9);
    if(o.key==='magnet')add(o,'operator extra ingots',5);
   }
   if(assigned.includes(o.ri)){
    if(o.key==='drill')add(o,'miner extraction',avg('starved')>.3?12:7);
    if(o.key==='magnet')add(o,'miner extra ore',avg('starved')>.3?9:5);
    if(['speed','carry'].includes(o.key))add(o,'miner transport',6);
   }
   if(haulers.includes(o.ri)&&['speed','carry'].includes(o.key))add(o,'dedicated hauling',avg('rack')>.2?12:8);
  }
  for(const k of ['treads','hubs','hamper','hopper'])add(find('tech',k),'transport unlock',6);
  add(find('gen','oil'),'crew movement',8);add(find('gen','cutting'),'all machinery',8);
  add(find('gen','charm'),'all extra yield',5);
  if(S.robots.length>=6){add(find('gen','basket'),'copy baskets',7);add(find('gen','blueprint'),'copy industrial skills',7);}
  // Price investments fund the output ramp, with a lower priority than capacity/throughput.
  add(find('up','ingotGrade'),'fund ramp: alloy',2);add(find('up','metalPrice'),'fund ramp: grade',2);add(find('gen','market'),'fund ramp: market',2);
  const best=C.sort((a,b)=>a.score-b.score)[0];if(best)purchase(best.o,best.why,S);
 };
})();

}
;(()=>{const Y=__leafYard,F=Y.fn(),base=window.__policy,oldWeight=window.__auditWeight;let next=0;
 if(window.__route==='goalFirst')window.__auditWeight=(o,S)=>o.id==='robot'&&window.__phase===0?4:oldWeight(o,S);
 window.__policy=()=>{const S=Y.state();
  if(window.__route!=='goalFirst'||window.__phase!==3||S.trip)return base();
  if(S.t<next)return;next=S.t+1;
  const all=F.offers(),find=(id,key)=>all.find(o=>o.id===id&&(key==null||o.key===key));let o,why;
  if(S.flags.dryKnown&&S.totals.drySold>0&&!S.flags.antHill){
   if(S.lv.leafPrice<3){o=find('up','leafPrice');why='starter leaf value';}
   else if(S.lv.bin<3){o=find('up','bin');why='starter bin';}
   else if(S.lv.truck<2){o=find('up','truck');why='starter pickups';}
   else if(S.robots.length<window.__researchCrew){o=find('robot');why='leaf income crew';}
   else if(S.blowers.length<2){o=find('blower');why='keep drying during research';}
   else if(!S.hive.built){o=find('hive');why='hive before expensive buffers';}
   else if(!S.hive.bees&&!S.flags.beeFail){o=find('bee');why='trigger rainy hive research';}
   else if(S.story.item==='hive'&&!S.story.done){
    o=all.filter(o=>o.id==='rup'&&o.key==='study'&&S.robots[o.ri].prio[0]?.includes('research')).sort((a,b)=>a.cost-b.cost)[0];why='finish hive research';
   }
  }
  // Keep assignment management running, but make the selected goal purchase the only eligible buy this second.
  if(o){const filter=window.__auditFilter;window.__auditFilter=()=>false;base();window.__auditFilter=filter;if(o.cost<=S.cash+1e-9&&window.__buy(o))window.__purchases.push({t:S.t,...o,why});return;}
  base();
 };
})();
