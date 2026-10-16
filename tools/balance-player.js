(() => {
// A bottleneck-driven test player (balance testing only). Paste this whole file into the browser console on the game
// page (or run it headless); it plays a 2-hour game in a few seconds and prints what limited the yard and what it bought.
// window.SIMT = seconds to play (default 7200), window.FULL = 1 to list every purchase, window.MARK = seconds between status lines.
// window.PAYBACK = minutes (default 5): price upgrades are only bought once they pay for themselves that fast (V9).
// Every second it works out what is holding each part of the
// yard back, picks the thing that would help in each part, and buys the cheapest of those (saving up if it can't afford
// it yet). Prints what it bought, why, and a timeline of the limits.
const Y = __leafYard, F = Y.fn();
const SECS = +(window.SIMT || 7200);
const log = [], marks = [];
let fills = [], maxBin = 0, lastTrucks = 0, hist = [], incomeHist = [], nextBuy = 0, nextMark = 0, lim = {}, scarceT = 0, waitFor = null;
const LEAF_TRACKS = ['speed', 'carry', 'pick', 'grab', 'reach'];
// what each kind of thing has earned a minute lately (needs window.__src, which the game fills in during a sim)
if (!window.__src) window.__src = { leaf:0, bag:0, metal:0, ingot:0, jar:0, gift:0, clean:0, nL:0, nM:0, nI:0, nJ:0 };
const srcH = [], PAYBACK = +(window.PAYBACK || 5);
const PRICE_KEYS = ['leafPrice', 'bagPrice', 'cleanup', 'metalPrice', 'honeyPrice', 'ingotGrade', 'giftPrice', 'slag', 'smeltSpeed'];
const PRICE_SRC = { leafPrice:['leaf','bag'], bagPrice:['bag'], metalPrice:['metal','ingot'], honeyPrice:['jar','gift'], giftPrice:['gift'], ingotGrade:['ingot'], slag:['ingot'], smeltSpeed:['ingot'], market:['leaf','bag','metal','ingot','jar','gift','clean'] };
function srcRate(){
  if (srcH.length < 2) return null;
  const a = srcH[0], b = srcH[srcH.length - 1], dt = Math.max(1, b[0] - a[0])/60, o = {};
  for (const k in b[1]) o[k] = (b[1][k] - a[1][k])/dt;
  return o;
}
// extra money a minute from buying price upgrade x now
function gainOf(S, x, smeltIdle){
  const r = srcRate(); if (!r) return 0;
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
  const n = S.robots.length, roles = [];
  let wantMine = 0; for (const sp of S.miners) wantMine += S.shafts.includes(sp) ? 2 : 1;
  const wantPack = (S.bag.built || S.hive.built) && n >= 3 ? 1 + (S.hive.bees >= 14 && n >= 6 ? 1 : 0) : 0;
  for (let k=0;k<wantPack;k++) roles.push('pack');
  for (let k=0;k<wantMine;k++) roles.push('mine');
  if (S.plant.built){ roles.push('smelt', 'smelt', 'haul'); }   // V21: two furnace doors (was three)
  // with two packers, one puts honey first and the other bags first (both do both)
  // (V11: packers who fill jars also wrap them, once Gift wrapping is bought)
  const P = { pack: [['bag', 'jar'], ['wrap'], ['leaves']], pack2: [['jar', 'wrap'], ['bag'], ['leaves']], pack1: [['bag'], ['jar'], ['wrap'], ['leaves']], mine: [['mine'], ['leaves']], smelt: [['smelt'], ['haul'], ['leaves']], haul: [['haul'], ['leaves']] };
  if (wantPack === 2){ roles[0] = 'pack1'; roles[1] = 'pack2'; }
  S.robots.forEach((c, j) => {
    const role = j >= 1 ? roles[n - 1 - j] : null;   // robot 0 always gathers leaves
    // (V24: with the bagging table and no packer yet, the leaf robots bag too, taking turns: the book comes after 5 bags)
    c.prio = (P[role] || (S.bag.built && !wantPack ? [['leaves', 'bag']] : [['leaves']])).map(r => r.slice());
    // V12: robot 0 reads the old picture book while there's research (it unlocks blowers and shakers)
    if (j === 0 && S.story && S.story.found && !S.story.done) c.prio.unshift(['research']);
    c.off = ['leaves','mine','bag','jar','wrap','smelt','haul','research'].filter(t => !c.prio.flat().includes(t));
  });
  return roles.length + 1;
}
const out = Y.sim(SECS, { noBuy: true, probe: () => {
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
  const inc = income(), all = F.offers();
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
  for (const x of all.filter(x => (x.id === 'up' && PRICE_KEYS.includes(x.key)) || (x.id === 'gen' && x.key === 'market'))){
    const g = gainOf(S, x, smelters.length ? avg('smeltIdle') : 1);
    if (g > 0 && x.cost/g <= PAYBACK){ x.payback = x.cost/g; add(x, 'price', 5); }
  }
  add(all.find(x => x.id === 'bagger'), 'bagging');
  // leaves
  if (L.bin){
    const bin = all.find(x => x.id === 'up' && x.key === 'bin'), tr = all.find(x => x.id === 'up' && x.key === 'truck');
    add(!bin ? tr : !tr ? bin : (bin.cost <= tr.cost*1.6 ? bin : tr), 'bin full');
    if (S.bag.built) add(cheapest(all.filter(x => (x.id === 'rup' && x.key === 'pack' && isPacker(S.robots[x.ri])) || (x.id === 'tech' && x.key === 'jig'))), 'bin full: pack', 3);
  } else if (L.leaves){
    add(cheapest(all.filter(x => x.id === 'shaker' || x.id === 'blower' || (x.id === 'hup' && ['shake', 'blow'].includes(x.key)) || (x.id === 'tech' && x.key === 'pincers'))), 'leaves scarce', 4);
  } else {
    const leafRobots = S.robots.map((c, j) => j).filter(j => S.robots[j].prio[0][0] === 'leaves');
    add(cheapest(all.filter(x => (x.id === 'rup' && LEAF_TRACKS.includes(x.key) && leafRobots.includes(x.ri)) || (x.id === 'tech' && ['treads', 'hamper', 'servos', 'claw', 'arm', 'hubs', 'hopper', 'wrist', 'fineWrist'].includes(x.key)) || x.id === 'robot')), 'robots', 4);
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
  if (S.robots.length < staff) add(all.find(x => x.id === 'robot'), 'staff', 4);
  // land: once the plot has been short of leaves for a while, or the bees run out of flowers, or every vein here is mined
  const land = all.find(x => x.id === 'land');
  if (land && (scarceT > 120 || L.flowers || (S.metalSlot && SPOTS_HERE(S) <= 0))) add(land, 'need land');
  if (!C.length) return;
  // a player sees big new steps (land, a new building, a new kind of income) as worth more than one more small upgrade
  const VALUE = { 'need land': 3, 'start bees': 3, 'start metal': 3, 'start smelting': 3, bagging: 3, price: 2, 'bin full': 1.5, 'hive full': 1.5, 'tub full': 1.5, 'packer busy': 1.5, 'feed smelter': 1.5 };
  const score = c => c[0].cost/(VALUE[c[1]] || 1);
  const [o, why] = C.sort((a, b) => score(a) - score(b))[0];
  if (o.cost > S.cash + 1e-9){ waitFor = why; return; }   // save up for it
  waitFor = null;
  Y.buy(o); log.push((S.t/60).toFixed(1) + 'm ' + o.id + (o.key ? ':' + o.key : '') + (o.ri != null ? '#' + o.ri : '') + ' $' + o.cost + ' [' + why + (o.payback ? ' ' + o.payback.toFixed(1) + 'm' : '') + ']');
} });
function SPOTS_HERE(S){ const free = [0, 1, 2].filter(i => i <= S.land && !S.miners.includes(i)); return free.length; }
const firsts = {}; for (const l of log){ const m = / (\w+)(:\w+)?/.exec(l.slice(l.indexOf('m ') + 1)); const k = m[1] + (['tech','up','gen','hiveUp'].includes(m[1]) ? m[2] : ''); if (!firsts[k]) firsts[k] = l; }
return (window.FULL ? log.join('\n') + '\n' : '') + '--- firsts\n' + Object.values(firsts).join('\n') + '\n--- marks\n' + marks.join('\n') + '\n--- limiter seconds ' + JSON.stringify(lim) + '\nearned ' + Math.round(out.totals.cash) + ' leaves ' + out.totals.leaves + ' honey ' + (out.totals.honey || 0) + ' metal ' + out.totals.metal + ' ingots ' + (out.totals.ingots || 0);

})();
