// AutumNation — game logic and rendering.
// Dev URL options: ?fresh (play without loading or saving)  ?speed=4 (fast-forward, 0.25–20)
(() => {
'use strict';
if (window.LOC_LEAVING) return;   // index.html is opening a ?locationN copy instead
// ───────────────────────── utils
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
function mulberry(s){ return function(){ s|=0; s=s+0x6D2B79F5|0; let t=Math.imul(s^s>>>15,1|s); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function cellRnd(i, j, salt){ return mulberry(((i*73856093) ^ (j*19349663) ^ (salt*83492791)) >>> 0); }
function rr(c,x,y,w,h,r){ c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }
function ell(c,x,y,rx,ry){ c.beginPath(); c.ellipse(x,y,Math.max(0,rx),Math.max(0,ry),0,0,TAU); }
function money(v){ if (v < 0.1) return '$' + v.toFixed(3); if (v < 10000) return '$' + v.toFixed(2); return '$' + Math.round(v).toLocaleString('en-US'); }
function cash2(v){ return '$' + (v < 10000 ? v.toFixed(2) : Math.round(v).toLocaleString('en-US')); }
function niceCost(v){ if (v < 1) return Math.round(v*20)/20; if (v < 20) return Math.round(v*4)/4; return Math.round(v); }
function mmss(s){ s = Math.max(0, Math.ceil(s)); return Math.floor(s/60) + ':' + String(s%60).padStart(2,'0'); }
function shade(hex, k){ const n = parseInt(hex.slice(1), 16); const r = clamp(Math.round((n>>16)*k),0,255), g = clamp(Math.round((n>>8&255)*k),0,255), b = clamp(Math.round((n&255)*k),0,255); return 'rgb('+r+','+g+','+b+')'; }
const ease = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2;

const PARAMS = new URLSearchParams(location.search);
const TIME_SCALE = clamp(+PARAMS.get('speed') || 1, 0.25, 20);
const FRESH = PARAMS.has('fresh');
const DBG = (PARAMS.get('dbg') || '').split(',');   // RAINY HOLLOW dev: ?dbg=nopud,norain,nomist,noglow to profile
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ───────────────────────── world layout (world units; the curb is y = 0, your land is y < 0)
const ROAD = 84, LANE = 56, VERGE = 30;
// V6: the road row is spaced out, with room for small work buildings: the bagging table between the pickup sign and the
// bin, and the ingot pallet between the metal tub and the honey crate.
const BIN = { x: 28, y: -12 }, TUB = { x: 86, y: -12 }, SIGN = { x: -110, y: -8 }, SHED = { x: -222, y: -22 }, PARK = 50;
const BAGGER = { x: -48, y: -14 };  // the bagging table (built later) between the pickup sign and the bin
const PALLET = { x: 138, y: -12 };  // the ingot pallet (where haulers drop ingots for the truck), right of the metal tub
const HIVE = { x: 250, y: -20 };   // the robot beehive stands at the right end of the row
const CRATE = { x: 190, y: -12 };  // the honey crate (jars waiting for the truck) sits between the ingot pallet and the hive
// RAINY HOLLOW (location3): the drying shed (this location's smelting plant) stands far out in the meadow, up on the
// left, well away from the road. Dried wood has a long, wet walk down to the woodshed by the road (see WET_RATE).
const PLANT = { x: -470, y: -540 };
// the Twin ant hill yard-wide upgrade adds a second ant hill and mushroom crate on the left of the workshop
const HIVE2 = { x: -410, y: -20 }, CRATE2 = { x: -335, y: -12 };
// V7: land costs more, and the cottage plot runs short sooner (its small trees give shakers fewer leaves, see
// treeYieldMul), so you feel the need for the meadow before you can buy it. Leaves sell for a little more to keep the
// overall pace about where it was.
// RAINY HOLLOW: the same three sizes and the same 10× land prices as the Wildflower prairie
const AREAS = [
  { w: 580,  h: 380,  name: 'Drizzly patch', spawn: 1.0, cap: 60 },
  { w: 1280, h: 720,  name: 'Puddle meadow', spawn: 2.8, cap: 220, cost: 3000 },
  { w: 2000, h: 1150, name: 'Misty woods',   spawn: 5.6, cap: 380, cost: 38000 },
];
// RAINY HOLLOW: wet wood can be sawn from the start, like metal in the first yard (one pile per plot), but the drying
// shed needs the meadow (plantLand)
const MINE_LAND = 0;
const metalOpen = () => S.land >= MINE_LAND;
const PLANT_LAND = 1;
// RAINY HOLLOW: piles of wet wood instead of metal veins, one per plot, in new places
const SPOTS = [
  { x: 150,  y: -150, land: 0, rich: 0.85 },
  { x: 430,  y: -420, land: 1, rich: 1 },
  { x: -860, y: -560, land: 2, rich: 1.2 },
];
const OLD_SPOT_MAP = { 0: 0, 1: 1, 3: 2 };   // old vein index -> new one; old veins 2 and 4 are gone (refunded)
const veinWord = sp => { const v = SPOTS[sp].rich || 1; return v < 0.9 ? 'a small pile' : v > 1.15 ? 'a huge pile' : v > 1.02 ? 'a big pile' : 'a fair pile'; };
// RAINY HOLLOW: trees that have lost about half their leaves, in new places
const TREES = [
  { x: -170, y: -640, r: 120, seed: 11 }, { x: 300, y: -580, r: 135, seed: 23 }, { x: 575, y: -255, r: 92, seed: 37 },
  { x: -770, y: -900, r: 190, seed: 41 }, { x: 800, y: -850, r: 185, seed: 53 }, { x: -60, y: -1000, r: 170, seed: 61 },
  { x: -1130, y: -330, r: 190, seed: 71 }, { x: 1140, y: -1060, r: 200, seed: 83 }, { x: -560, y: -1320, r: 190, seed: 97 },
  { x: 560, y: -1335, r: 180, seed: 101 }, { x: 1150, y: -420, r: 170, seed: 113 }, { x: -1180, y: -1060, r: 190, seed: 127 },
  // three little trees on the first plot
  { x: -40, y: -262, r: 62, seed: 131, fam: ['rust','gold'] }, { x: -256, y: -208, r: 52, seed: 137, fam: ['red','olive'] },
  { x: 228, y: -296, r: 50, seed: 139, fam: ['gold','orange'] },
  // one in the meadow's lower left, between the drying shed and the road
  { x: -560, y: -250, r: 105, seed: 149 },
];
// RAINY HOLLOW: puddles. Their muddy beds are painted into the ground; the water itself is drawn live every frame
// (drawPuddles) so it can reflect the robots, trees and buildings beside it and ripple in the rain. Robots that drive
// through one splash and leave wet tracks. Two lie on the road, where the truck drives through them.
const PUDDLES = [
  { x: -70,  y: -118, rx: 44, ry: 15 }, { x: 62, y: -92, rx: 28, ry: 10 }, { x: -192, y: -150, rx: 34, ry: 12 }, { x: 176, y: -236, rx: 30, ry: 11 },
  { x: -230, y: -330, rx: 58, ry: 19 }, { x: 250, y: -330, rx: 50, ry: 16 }, { x: -20, y: -470, rx: 46, ry: 15 }, { x: -385, y: -175, rx: 40, ry: 13 },
  { x: 520,  y: -560, rx: 40, ry: 13 }, { x: -470, y: -420, rx: 52, ry: 16 },
  { x: -650, y: -760, rx: 60, ry: 20 }, { x: 700, y: -650, rx: 70, ry: 22 }, { x: 200, y: -860, rx: 55, ry: 18 }, { x: -300, y: -960, rx: 50, ry: 16 }, { x: 850, y: -250, rx: 48, ry: 15 },
  { x: -300, y: 50, rx: 72, ry: 11, road: true }, { x: 330, y: 64, rx: 58, ry: 9, road: true },
  // a few out in the wild, beyond the fence
  { x: -720, y: -140, rx: 46, ry: 14 }, { x: 760, y: -110, rx: 40, ry: 13 }, { x: 1180, y: -700, rx: 60, ry: 18 }, { x: -1200, y: -720, rx: 56, ry: 18 },
].map((p, i) => Object.assign(p, { seed: 301 + i*7 }));
// the outline of a puddle: a wobbly ellipse
function puddlePts(p, grow){
  const rnd = mulberry(p.seed), s1 = rnd()*TAU, s2 = rnd()*TAU, s3 = rnd()*TAU, N = 22, out = [];
  for (let k=0;k<N;k++){ const a = k/N*TAU, r = 1 + 0.16*Math.sin(2*a + s1) + 0.09*Math.sin(3*a + s2) + 0.05*Math.sin(5*a + s3); out.push([p.x + Math.cos(a)*(p.rx*r + grow), p.y + Math.sin(a)*(p.ry*r + grow*0.45)]); }
  return out;
}
function puddleTrace(c, p, grow){ const P = puddlePts(p, grow || 0); c.beginPath(); P.forEach(([x, y], i) => { const n = P[(i + 1) % P.length], mx = (x + n[0])/2, my = (y + n[1])/2; i ? c.quadraticCurveTo(x, y, mx, my) : c.moveTo(mx, my); }); const f = P[0], n = P[1]; c.quadraticCurveTo(f[0], f[1], (f[0] + n[0])/2, (f[1] + n[1])/2); c.closePath(); }
const inPuddle = (p, x, y, m = 0) => { const dx = (x - p.x)/(p.rx*0.92 + m), dy = (y - p.y)/(p.ry*0.92 + m*0.45); return dx*dx + dy*dy < 1; };
const puddleAt = (x, y, m) => { for (const p of PUDDLES) if (inPuddle(p, x, y, m)) return p; return null; };
// shrubs on your own land (wild ones beyond the fence are baked into the ground); shakers can shake these too
const BUSHES = [ { x: -150, y: -300, s: 1.05, seed: 7 }, { x: 70, y: -334, s: 0.95, seed: 19 } ];
const trunkBase = t => t.y + t.r*1.16;
const owned = (lvl = S.land) => { const A = AREAS[lvl]; return { x0: -A.w/2, x1: A.w/2, y0: -A.h, y1: -VERGE }; };
const salePos = () => { const A = AREAS[S.land]; return { x: Math.round(A.w*0.18), y: -A.h + 44 }; };

// ───────────────────────── economy
const UP = {
  // the bin starts small: the first few sizes are cheap, after that each one is a real purchase
  bin:        { obj:'bin',  name:'Bigger bin',        max:8,  costs:[0.4, 0.8, 1.5, 4, 15, 60, 190, 520], vals:[15, 22, 32, 48, 72, 110, 180, 320, 600], val:l=>UP.bin.vals[l], show:v=>v+' leaves' },
  // V6: sorting is only a few steps now; after that the bagging table (and the robots working it) takes over
  leafPrice:  { obj:'bin',  name:'Sort leaves',       max:5,  base:0.8, mul:1.7, val:l=>0.13*Math.pow(1.2,l)*pressMul(), show:v=>money(v)+' / leaf' },
  // bags: a tied bag of BAG_SIZE leaves is worth more than the same leaves loose, and better bags are worth more again
  // V8: five more steps after the pumpkin bags (harvest bags with a gold tie, then a sprig on top). V9: priced against what
  // bags actually earn (bagging is limited by leaves and packers), so each step pays for itself within ~5 minutes
  bagPrice:   { obj:'bagger', name:'Better bags', max:10, gaps:[{n:5}], costs:[11, 19, 28, 38, 60, 130, 170, 210, 240, 280], vals:[1.5, 1.8, 2.1, 2.45, 2.8, 3.2, 3.65, 4.15, 4.7, 5.3, 6.0], val:l=>UP.bagPrice.vals[l], show:v=>money(BAG_SIZE*val('leafPrice')*v*sellMul())+' a bag' },
  // metal comes later now: dearer to start and to upgrade, but every chunk is worth a lot more.
  // V6: two grades open the smelting plant. V8: grading goes on after that (four more steps), and since an ingot's
  // price is its metal's grade × the alloy, every grade makes ingots worth more too
  metalPrice: { obj:'bin',  name:'Sort the wood',   max:6, gaps:[{n:2}],  costs:[40, 76, 400, 1800, 3500, 6000], vals:[4.8, 6, 7.5, 9.2, 11.2, 13.6, 16.5], val:l=>UP.metalPrice.vals[l],
                show:v=>money(v)+' / wet wood' + (S.plant.built ? ' · ' + money(ORE_PER_INGOT*v*val('ingotGrade')*sellMul()) + ' / dry bundle' : '') },
  // V7: a bigger tub also makes the ingot pallet beside it bigger (palletCap), the way the bin's bag shelf grows with the bin
  metalBin:   { obj:'bin',  name:'Bigger log crib',  max:8,  costs:[30, 55, 90, 160, 320, 700, 1600, 3500], vals:[8, 12, 18, 27, 40, 60, 90, 135, 200], val:l=>UP.metalBin.vals[l], show:v=>v+' wet wood' },
  // more pickups is a big lever (it makes bin size matter less): V7 makes it dear from the second step on
  truck:      { obj:'sign', name:'Book more pickups', max:7,  costs:[2, 8, 28, 90, 260, 700, 1800], val:l=>[45,38,32,27,23,19,16,14][l], show:v=>'every '+v+'s' },
  // three one-off deals with the truck: a cash bonus for every 100 leaves it takes. With Sort & bag maxed ($0.62),
  // the top deal brings a leaf to about $1.20. Each tier is a big jump that costs a lot at the time you can first afford it.
  cleanup:    { obj:'sign', name:l=>['Join the cleanup program', 'Town cleanup contract', 'County compost deal'][Math.min(l, 2)], max:3, costs:[20, 300, 400],
                vals:[0, 18, 42, 70], val:l=>UP.cleanup.vals[l], show:v=>v ? '$'+v+' per 100 leaves' : 'no bonus yet' },
  // the beehive. V7: more, smaller steps priced against what the honey earns, so the store keeps up with the bees
  hiveTank:   { obj:'hive', name:'Bigger larder', max:4, costs:[60, 190, 520, 1400], vals:[70, 140, 270, 470, 800], val:l=>UP.hiveTank.vals[l], show:v=>v+' mushrooms' },
  hiveStore:  { obj:'hive', name:'More sorting chambers', max:6, costs:[40, 110, 280, 600, 1200, 2400], vals:[6, 12, 20, 32, 50, 80, 120], val:l=>UP.hiveStore.vals[l], show:v=>v+' punnets' },
  // V8: a little more to start with and four more label steps for the late game. V9: the late steps are much cheaper
  // (honey is capped by flowers and packers, so its income can't keep up with ×3 prices)
  honeyPrice: { obj:'hive', name:'Gourmet labels', max:6, costs:[90, 300, 650, 1000, 1800, 2800], vals:[2.9, 3.8, 5, 6.4, 8, 10, 12.5], val:l=>UP.honeyPrice.vals[l], show:v=>money(v)+' / punnet' },
  // V6: once a robot packs honey at the crate, gift jars (cloth top, twine and a tag) sell for more than plain ones.
  // V11: wrapping is its own task and takes almost as long as filling the jar, so a gift jar is worth a lot more (2.6×,
  // about what the old top ribbon gave) and the ribbons are cheaper
  giftPrice:  { obj:'hive', name:'Gift basket ribbons', max:2, costs:[700, 1500], vals:[2.6, 3.1, 3.7], val:l=>UP.giftPrice.vals[l], show:v=>money(val('honeyPrice')*v*sellMul())+' a gift basket' },
  // the smelting plant
  smeltSpeed: { obj:'plant', name:'Hotter stoves',  max:3, costs:[400, 1000, 1500], vals:[1, 1.3, 1.65, 2.1], val:l=>UP.smeltSpeed.vals[l], show:v=>v.toFixed(2)+'× stove heat' },
  // V8: an ingot is worth ORE_PER_INGOT metal at the current grade × the alloy (was a flat $36 → $66), two more steps
  ingotGrade: { obj:'plant', name:'Seasoned bundles',    max:5, costs:[500, 1900, 3200, 6000, 7000], vals:[1.45, 1.75, 2.15, 2.6, 3.1, 3.6], val:l=>UP.ingotGrade.vals[l], show:v=>money(ORE_PER_INGOT*val('metalPrice')*v*sellMul())+' / dry bundle' },
  // V6.3: every ingot takes 4 whole metal; slag recovery adds bonus ingots (a counter fills up, so it's always whole ingots)
  slag:       { obj:'plant', name:'Kindling from offcuts',   max:3, costs:[450, 1100, 2800], vals:[0, 0.11, 0.25, 0.43], val:l=>UP.slag.vals[l], show:v=>v ? '+' + Math.round(v*100) + '% dry bundles' : 'no extra dry bundles' },
  hopper:     { obj:'plant', name:'Bigger wet stack', max:3, costs:[80, 260, 700], vals:[24, 40, 64, 100], val:l=>UP.hopper.vals[l], show:v=>v+' wet wood' },
};
// V7: the ingot pallet no longer has a size of its own (ingots share the metal tub's room); old saves get its price back
const OLD_PALLET_COSTS = [60, 200, 600];
// V6 refinement: buildings and constants
const BAG_SIZE = 10;            // leaves in a bag
const BAGGER_COST = 18;         // the bagging table: a bit more than the next sorting step would have been
const HONEY_PACK_COST = 550;    // Gift wrapping: opens the Wrap task at the crate (V11: was 800)
const PLANT_COST = 500;         // the smelting plant (V7: was 300)
const SHAFT_COST = 350;         // turning a miner into a mine shaft (a copied one costs half)
const RACK_CAP = 10;  // ingots waiting on the plant's rack (the wet stack's size is UP.hopper)
// seconds per bag / honey jar / gift wrap / ingot at packing speed 1 (V7: jars 2.2 → 3, smelting 10 → 13.5; V11: wrapping a
// gift jar is its own step, 2.6 s, was 1.6 s on top of the jar)
const BAG_TIME = 4, JAR_TIME = 3, WRAP_TIME = 2.6, SMELT_TIME = 13.5;
// Per-robot upgrade tracks. Generation 0 needs no research; later generations are unlocked at the workshop.
const TRACKS = {
  speed: { label:'Wheels', gens:[
      { name:'Old wheels', n:3, cost:[0.3, 0.6, 1.2] },
      { tech:'treads', name:'Rubber treads', n:4, cost:[2, 3, 4.5, 6.5] },
      { tech:'hubs', name:'Ball-bearing hubs', n:4, cost:[15, 22, 32, 46] } ],
    vals:[1,1.14,1.28,1.42, 1.62,1.82,2.02,2.22, 2.48,2.74,3.0,3.3], show:v=>v.toFixed(2)+'× speed' },
  carry: { label:'Basket', gens:[
      { name:'Tin basket', n:3, cost:[0.25, 0.5, 1] },
      { tech:'hamper', name:'Wicker hamper', n:4, cost:[1.8, 2.7, 4, 6] },
      { tech:'hopper', name:'Spring hopper', n:4, cost:[14, 20, 30, 44] } ],
    vals:[3,5,7,9, 12,15,18,21, 25,29,33,38], show:v=>v+' leaves' },
  pick: { label:'Pickup', gens:[
      { name:'Creaky servo', n:3, cost:[0.3, 0.6, 1.2] },
      { tech:'servos', name:'Quick servos', n:4, cost:[2.2, 3.3, 5, 7.5] } ],
    vals:[1.3,1.05,0.85,0.7, 0.56,0.46,0.38,0.32], show:v=>v.toFixed(2)+'s a grab' },
  grab: { label:'Claw', gens:[
      { name:'Single pincer', n:0, cost:[] },
      { tech:'claw', name:'Claw rake', n:5, cost:[3, 9, 28, 62, 125] } ],   // small steps first, then big ones worth saving for
    vals:[1,2,3,5,8,12], show:v=>v === 1 ? '1 leaf a grab' : v+' leaves a grab' },
  reach: { label:'Reach', gens:[
      { name:'Stubby arm', n:0, cost:[] },
      { tech:'arm', name:'Telescoping arm', n:5, cost:[2.5, 8, 24, 55, 111] } ],
    vals:[20,30,44,64,92,125], show:v=>v+' cm reach' },
  drill: { label:'Saw', gens:[
      { name:'Hand saw', n:3, cost:[25, 40, 60], needsMetal:true },
      { tech:'diamond', name:'Crosscut saw', n:4, cost:[110, 160, 230, 330] } ],
    vals:[4,3.4,2.9,2.5, 2.1,1.8,1.55,1.35], show:v=>v.toFixed(1)+'s per log' },
  magnet: { label:'Wedge', gens:[
      { name:'Wooden wedge', n:3, cost:[35, 55, 80], needsMetal:true },
      { tech:'horseshoe', name:'Steel wedge', n:4, cost:[120, 170, 240, 330] },
      { tech:'electro', name:'Splitting maul', n:4, cost:[480, 680, 950, 1300] } ],
    vals:[0, .06,.11,.16, .22,.28,.34,.40, .48,.56,.64,.72], show:v=>v ? Math.round(v*100)+'% split in two' : 'no splitting' },
  // helper robots: blowers push far-off leaves toward the bin, shakers shake trees and bushes for extra leaves
  blow: { label:'Blower', gens:[
      { name:'Desk fan', n:3, cost:[6, 11, 19] },
      { tech:'turbine', name:'Leaf turbine', n:4, cost:[60, 95, 150, 230] },
      { tech:'jet', name:'Jet nozzle', n:4, cost:[400, 580, 820, 1150] } ],
    vals:[1, 1.2, 1.4, 1.65, 1.95, 2.3, 2.7, 3.15, 3.7, 4.3, 5, 5.8], show:v=>v.toFixed(2)+'× blow power' },
  shake: { label:'Shake', gens:[
      { name:'Gentle wiggle', n:3, cost:[5.5, 10, 17] },
      { tech:'pincers', name:'Hydraulic pincers', n:4, cost:[55, 85, 135, 200] },
      { tech:'rumble', name:'Rumble claws', n:4, cost:[330, 480, 680, 960] } ],
    vals:[6, 7, 8, 10, 12, 14, 17, 20, 24, 28, 33, 38], show:v=>v+' leaves from a big tree' },
  // shakers with shears can deadhead spent flowers so a fresh bloom pops up for the bees right away
  snip: { label:'Shears', gens:[ { name:'Garden shears', n:1, cost:[40] } ],
    vals:[0, 1], show:v=>v ? 'can trim mushroom patches' : 'trees only' },
  // V6: packing & refining: how fast a robot bags leaves, fills honey jars and smelts ingots.
  // V7: a robot starts clumsier, every level is bought at full price (no copied-level discount), and the last tier is
  // much stronger, so a robot you train up as a packer is worth the money.
  pack: { label:'Packing', gens:[
      { name:'Clumsy hands', n:3, cost:[3, 6, 11], needsPack:true },
      { tech:'jig', name:'Packing jig', n:4, cost:[22, 36, 56, 85] },
      { tech:'precision', name:'Precision tools', n:4, cost:[280, 450, 700, 1100] } ],
    vals:[0.6, 0.72, 0.84, 0.96, 1.12, 1.3, 1.5, 1.75, 2.3, 2.95, 3.7, 4.6], show:v=>v.toFixed(2)+'× packing speed' },
  // V6: blowers at a mine shaft suck up dirt so the robots mining there get on faster. Level 1 teaches it.
  dig: { label:'Dry piles', gens:[
      { name:'Warm-air hose', n:3, cost:[70, 120, 200], needsShaft:true },
      { tech:'cyclone', name:'Heat blower', n:4, cost:[320, 460, 650, 900] } ],
    vals:[0, .25, .35, .45, .58, .7, .82, .95], show:v=>v ? '+' + Math.round(v*100) + '% sawing at a shelter' : 'can’t dry piles yet' },
  // V6.2: blowers can work the bellows at the smelting plant: blowing into the furnace makes every smelter faster
  stoke: { label:'Bellows', gens:[
      { name:'Air hose', n:3, cost:[150, 260, 420], needsPlant:true },
      { tech:'forge', name:'Forge blast', n:4, cost:[600, 850, 1200, 1700] } ],
    vals:[0, .15, .22, .3, .4, .5, .6, .7], show:v=>v ? '+' + Math.round(v*100) + '% drying speed' : 'can’t work the bellows yet' },
  // RAINY HOLLOW: a blower can learn to carry a big wooden umbrella over a robot hauling dry wood, so none of it gets wet
  brolly: { label:'Umbrella', gens:[ { name:'Wood umbrella', n:1, cost:[900], needsPlant:true } ],
    vals:[0, 1], show:v=>v ? 'carries the wood umbrella' : 'no umbrella yet' },
};

const TRACK_ORDER = ['speed','carry','pick','grab','reach','drill','magnet','pack'];
// which tracks each kind of robot has. Wheels are shared by every kind, so copied-level discounts work across all of them.
const BOT_TRACKS = { robot: TRACK_ORDER, blower: ['speed', 'blow', 'dig', 'stoke', 'brolly'], shaker: ['speed', 'shake', 'snip'] };
const TECH = {
  treads:  { name:'Rubber treads',     track:'speed', cost:3,   desc:'Four new wheel upgrades for every robot.' },
  hamper:  { name:'Wicker hamper',     track:'carry', cost:3.5, desc:'Four new basket upgrades.' },
  servos:  { name:'Quick servos',      track:'pick',  cost:4,   desc:'Four faster pickup upgrades.' },
  claw:    { name:'Claw rake',         track:'grab',  cost:6,   desc:'Robots scoop up several leaves in one grab. Five claw upgrades, up to 12 leaves.' },
  arm:     { name:'Telescoping arm',   track:'reach', cost:7,   desc:'Robots grab leaves from further away. Five reach upgrades. Pairs well with the claw rake.' },
  hubs:    { name:'Ball-bearing hubs', track:'speed', cost:45,  needs:'treads', desc:'Wheel upgrades 8 to 11.' },
  hopper:  { name:'Spring hopper',     track:'carry', cost:40,  needs:'hamper', desc:'Basket upgrades 8 to 11.' },
  diamond: { name:'Crosscut saw', track:'drill', cost:350, needsMiner:true, desc:'Four faster saw upgrades.' },
  horseshoe:{ name:'Steel wedge', track:'magnet', cost:260, needsMiner:true, desc:'Wedge upgrades 4 to 7: a better chance a log splits in two.' },
  electro: { name:'Splitting maul',     track:'magnet', cost:1200, needs:'horseshoe', desc:'Wedge upgrades 8 to 11: up to 72% split logs.' },
  turbine: { name:'Leaf turbine',      track:'blow',  cost:70,  needsKind:'blowers', desc:'Four stronger blower upgrades: a wider, stronger breeze.' },
  jet:     { name:'Jet nozzle',        track:'blow',  cost:420, needs:'turbine', desc:'Blower upgrades 8 to 11.' },
  pincers: { name:'Hydraulic pincers', track:'shake', cost:65,  needsKind:'shakers', desc:'Four stronger shake upgrades: more leaves from every tree and bush.' },
  rumble:  { name:'Rumble claws',      track:'shake', cost:360, needs:'pincers', desc:'Shake upgrades 8 to 11.' },
  jig:     { name:'Packing jig',       track:'pack',  cost:40,  needsPack:true, desc:'Four faster packing upgrades: bagging, punnets, gift wrapping and drying.' },
  precision:{ name:'Precision tools',  track:'pack',  cost:700, needs:'jig', desc:'Packing upgrades 8 to 11.' },
  cyclone: { name:'Heat blower',      track:'dig',   cost:450, needsShaft:true, desc:'Four stronger pile-drying upgrades for blowers at a wood shelter.' },
  forge:   { name:'Forge blast',       track:'stoke', cost:900, needsPlantBlower:true, desc:'Four stronger bellows upgrades for blowers at the drying shed.' },
};
// Yard-wide upgrades (workshop, right column). They show up once you have $10. Not every one is a plain boost:
// some change the rules a little, like how much a copied robot upgrade costs.
const GEN = {
  oil:      { name:'Grease every axle',  max:3, cost:[20, 110, 520],  desc:l=>'All robots drive <b>'+(20*(l+1))+'%</b> faster'+(l ? ' (now '+(20*l)+'%)' : '')+'.' },
  basket:   { name:'Shared basket plans', max:1, cost:[35],  desc:()=>'Basket upgrades another robot already has cost <b>10%</b> instead of 50%.' },
  // Parked for now to keep the list short; good ideas to bring back later. Their effects switch off while commented out.
  // servo:    { name:'Oil the servos',     max:2, cost:[45, 240], desc:l=>'Every grab is <b>'+(15*(l+1))+'%</b> quicker'+(l ? ' (now '+(15*l)+'%)' : '')+'.' },
  // bulk:     { name:'Bulk robot parts',   max:1, cost:[60],  desc:()=>'New robots cost <b>25%</b> less.' },
  fingers:  { name:'Wider claw fingers', max:2, cost:[55, 260], needs:()=>S.tech.claw, desc:l=>'Claws spread <b>'+(30*(l+1))+'%</b> wider and pick from a bigger patch.' },
  blueprint:{ name:'Copy the blueprints', max:1, cost:[150], desc:()=>'Any upgrade another robot already has costs <b>30%</b> instead of 50%.' },
  cutting:  { name:'Chain oil',        max:2, cost:[300, 1400], needs:()=>S.miners.length > 0, desc:l=>'All saws run <b>'+(15*(l+1))+'%</b> faster.' },
  market:   { name:'Market stall',       max:3, cost:[140, 600, 2400], desc:l=>'The truck pays <b>'+(10*(l+1))+'%</b> more for everything.' },
  charm:    { name:'Lucky axe',    max:1, cost:[950], needs:()=>S.miners.length > 0, desc:()=>'Every robot gets <b>+8%</b> chance to split a log on top of its wedge.' },
  // RAINY HOLLOW: rain-themed versions of the prairie's flower upgrades, and a second ant hill
  press:    { name:'Leaf mould deal',   max:3, cost:[250, 1200, 4500], desc:l=>'The compost yard pays <b>'+(15*(l+1))+'%</b> more for wet leaves, loose or bagged.' },
  seeding:  { name:'Spore scattering', max:3, cost:[600, 2000, 6000], needs:()=>S.hive.built, desc:l=>'Sow <b>'+(40*(l+1))+'%</b> more mushroom patches for the ants on all your land.' },
  clover:   { name:'Mossy mulch',       max:2, cost:[900, 4000], needs:()=>S.hive.built, desc:l=>'Mushrooms grow back <b>'+(30*(l+1))+'%</b> sooner after an ant cuts them.' },
  twin:     { name:'Twin ant hill',          max:1, cost:[15000], needs:()=>S.hive.built && S.land >= 1, desc:()=>'A second ant hill and mushroom crate on the left of the workshop: <b>twice</b> the ants, larder, sorting chambers and crate, and two more packing spots.' },
};
const pressMul = () => 1 + 0.15*gl('press');
const regrowMul = () => 1 + 0.3*gl('clover');
const SEED_SHARE = 0.4;   // each Wildflower seeding level adds this share of a plot's flowers
const nHives = () => S.hive.built && gl('twin') ? 2 : 1;
const twinBuilt = () => nHives() > 1;
const twinRt = { builtT: -10 };
const GEN_UNLOCK = 10;
const gl = k => (GEN[k] && S.gen && S.gen[k]) || 0;   // parked (commented-out) upgrades count as 0
const genCost = k => GEN[k].cost[gl(k)];
const genAvail = k => gl(k) < GEN[k].max && (!GEN[k].needs || GEN[k].needs()) && seenPrice(genCost(k));
const genVisible = () => S.flags.general || S.cash >= GEN_UNLOCK;
// V6: twelve robots (since V6.1), and each one costs only a little more than the last (there's a lot more for them to do now)
const ROBOT_COST = [0, 6, 12, 30, 70, 140, 240, 380, 560, 800, 1100, 1500];
const ROBOT_MAX = 10;   // V9: ten robots can be built (STYLES and ROBOT_COST still hold the 11th and 12th looks)
const MINER_COST = 100;   // every miner costs the same; far veins are already worth less
const METAL_SLOT_COST = 160;
// helper robots: up to four of each (V7; five in V6.1). The second costs about twice the first, then the steps get bigger.
const HELPER_MAX = 4;
const BLOWER_COST = [9, 18, 140, 700];
const SHAKER_COST = [12, 24, 160, 800];
const OLD_HELPER5 = { blower: 4500, shaker: 5000 };   // what a fifth helper cost before V7 (refunded on load)
const DISCOUNT = 0.5;
const NO_DISCOUNT = ['pack'];   // V7: packing levels are always bought at full price

const STYLES = [
  { name:'Tinker',  blurb:'The original yard bot. Dusty, squeaky, never complains.', body:'#d6c9ab', body2:'#a39376', head:'#e0d4b8', head2:'#b4a586', band:'#5f8f88', bw:24, bh:22, hw:18, hh:13, tw:28, rust:.8, dust:true },
  { name:'Pip',     blurb:'Slim and quick. Rebuilt from a lawnmower and a toaster. Never goes out without its yellow umbrella.', brolly:'#e2b33a', body:'#e8e2d1', body2:'#bcb39d', head:'#efe9d9', head2:'#c5bca6', band:'#d9a43a', bw:18, bh:26, hw:16, hh:14, tw:22, rust:.3, slim:true },
  { name:'Clunk',   blurb:'Built like a mailbox. Heavy treads, steady pace.',        body:'#c9b99b', body2:'#8c7b5f', head:'#d3c5a8', head2:'#a29173', band:'#b8452d', bw:32, bh:21, hw:21, hh:13, tw:38, rust:.6, chunky:true },
  { name:'Rivet',   blurb:'Patched together from three other robots, umbrella included. Rough, but it works.', brolly:'patch', body:'#bbb4a2', body2:'#7d7668', head:'#c7c0ae', head2:'#8b8474', band:'#6f7d3c', bw:25, bh:22, hw:18, hh:13, tw:28, rust:1, patches:true },
  { name:'Juniper', blurb:'Round, polished, and a little proud of its plum umbrella.', brolly:'#8a5aa0',              body:'#f0e5cc', body2:'#c4b08e', head:'#f4ebd7', head2:'#cfbd9c', band:'#7a4d6e', bw:24, bh:21, hw:19, hh:14, tw:26, rust:0, round:true },
  { name:'Sterling', blurb:'Factory fresh and polished to a mirror shine. Wears a monocle, naturally.', body:'#f7f9fa', body2:'#aab6bd', head:'#ffffff', head2:'#bcc7cd', band:'#c9a24a', bw:23, bh:23, hw:19, hh:14, tw:26, rust:0, modern:true },
  // V6.1: the newer robots keep the cream body like the others; the colour sits on the head or on a wide band
  { name:'Bolt',    blurb:'Built for the factory floor. A safety-orange head, a hard hat and a hazard-striped belt.', body:'#ddd0b2', body2:'#a99a7b', head:'#eaae4f', head2:'#b97c29', band:'#2f2a26', bw:26, bh:22, hw:19, hh:13, tw:30, rust:.3, hazard:true },
  { name:'Moss',    blurb:'A garden bot gone a bit wild: moss on its belt, and a big leaf held up against the rain.', brolly:'leaf', body:'#e2dac4', body2:'#b2a78c', head:'#e6dfcb', head2:'#bcb198', band:'#6f8a3a', bandW:7, bw:24, bh:22, hw:18, hh:13, tw:28, rust:.4, sprout:true },
  { name:'Copper',  blurb:'A copper-plated head, green at the seams, kept dry under a teal umbrella.', brolly:'#3f8a7a', body:'#e4d8bf', body2:'#b4a587', head:'#e2a06e', head2:'#a8663b', band:'#5f9c8a', bw:25, bh:21, hw:19, hh:14, tw:28, rust:0, copper:true },
  { name:'Ember',   blurb:'A wide charcoal belt with a warm glow inside it. Never feels the cold.', body:'#d3cab8', body2:'#a19886', head:'#ddd5c4', head2:'#aaa08d', band:'#3a3531', bandW:8, bw:25, bh:23, hw:18, hh:14, tw:28, rust:0, ember:true },
  { name:'Kettle',  blurb:'Round in the middle, with a little steam whistle on its head that toots when it’s pleased.', body:'#e8e0cc', body2:'#b9ae95', head:'#8fb2c2', head2:'#5f8495', band:'#3f6f8f', bw:27, bh:23, hw:18, hh:14, tw:28, rust:.2, kettle:true },
  { name:'Lantern', blurb:'Tall and careful. Carries its own lantern on a hook, for the dark autumn evenings.', body:'#efe7d3', body2:'#c2b79e', head:'#f2ebdb', head2:'#c8bea6', band:'#4f6b3a', bandW:5, bw:18, bh:27, hw:16, hh:14, tw:22, rust:.1, slim:true, lantern:true },
];
// Blowers: yard robots built like a low robot vacuum, with a hose trunk and hinged flaps on the head.
const BLOWER_STYLES = [
  { name:'Puff',   blurb:'A low, wide robot with a hose for a trunk. Blows far-off leaves toward the bin.', body:'#d3cab2', body2:'#a2957a', head:'#ddd4be', head2:'#b2a68b', band:'#4f7c84', bw:30, bh:13, hw:15, hh:12, tw:30, trunk:1,    flap:1,    rust:.6 },
  { name:'Gust',   blurb:'Bigger flaps, bigger fan. Its warning light never quite turns off.',               body:'#c9bd9e', body2:'#8e7f60', head:'#d4c8ab', head2:'#a39373', band:'#6f7d3c', bw:34, bh:14, hw:16, hh:12, tw:34, trunk:0.85, flap:1.2,  light:true },
  { name:'Zephyr', blurb:'Small and patched up, with an extra-long hose.',                                    body:'#e3dccb', body2:'#b8ad95', head:'#ebe5d6', head2:'#c2b8a2', band:'#7a4d6e', bw:27, bh:12, hw:14, hh:11, tw:27, trunk:1.25, flap:0.9,  patches:true },
  { name:'Huff',   blurb:'A red-and-white striped hose, like a barber’s pole. Takes its blowing very seriously.', body:'#ddd3bb', body2:'#aa9d80', head:'#e6ddc8', head2:'#b8ab90', band:'#b8452d', bw:31, bh:13, hw:15, hh:12, tw:31, trunk:1.05, flap:1.05, stripes:true, rust:.3 },
  { name:'Billow', blurb:'Has a little propeller on its head that spins up whenever it blows.',               body:'#d8d0bd', body2:'#a69a82', head:'#e2dbca', head2:'#b2a78f', band:'#5f9c8a', bw:30, bh:14, hw:15, hh:12, tw:30, trunk:0.95, flap:0.95, prop:true },
];
// Shakers: squat yard robots with eye lenses on stalks and two oversized grabber claws.
const SHAKER_STYLES = [
  { name:'Pinch', blurb:'A squat robot with two very big claws. Shakes trees until they let go.',        body:'#d9cdb0', body2:'#a8987a', head2:'#b4a586', band:'#b8452d', bw:30, bh:16, cl:1.25, cr:1.25, rust:.7 },
  { name:'Snip',  blurb:'One claw is much bigger than the other. It is very proud of that one.',           body:'#c5c8c0', body2:'#8e938b', head2:'#9aa09a', band:'#d9a43a', bw:28, bh:15, cl:0.85, cr:1.7 },
  { name:'Clack', blurb:'Round, rattly, and always clicking its claws.',                                   body:'#e8dcc4', body2:'#bba98a', head2:'#c9b896', band:'#5f8f88', bw:33, bh:17, cl:1.15, cr:1.15, patches:true },
  { name:'Nipper', blurb:'Saw-toothed claws and a blinking beacon on a stalk. Means business.',                body:'#d6cdb6', body2:'#a39780', head2:'#b0a48b', band:'#7a4d6e', bw:29, bh:16, cl:1.1, cr:1.1, saw:true, beacon:true },
  { name:'Grabble', blurb:'Its eyes are on very tall stalks, so it always sees the next tree first.',          body:'#dfd6c0', body2:'#ada187', head2:'#bcb096', band:'#6f7d3c', bw:31, bh:16, cl:1.2, cr:1.0, tallEyes:true, rust:.4 },
];

const upCost = k => UP[k].costs ? UP[k].costs[S.lv[k]] : niceCost(UP[k].base * Math.pow(UP[k].mul, S.lv[k]));
const upShown = k => k !== 'metalPrice' && k !== 'metalBin' || S.metalSlot;
const upMaxed = k => S.lv[k] >= UP[k].max;
const upName = k => typeof UP[k].name === 'function' ? UP[k].name(Math.min(S.lv[k], UP[k].max - 1)) : UP[k].name;
const cleanupBonus = () => val('cleanup');
const val = k => UP[k].val(S.lv[k]);
const binCap = () => val('bin');
const metalCap = () => val('metalBin');
const sellMul = () => 1 + 0.1*gl('market');
const leafPrice = () => val('leafPrice')*sellMul();
const metalPrice = () => val('metalPrice')*sellMul();
const bagPrice = () => BAG_SIZE*val('leafPrice')*val('bagPrice')*sellMul();
const ingotPrice = () => ORE_PER_INGOT*val('metalPrice')*val('ingotGrade')*sellMul();
const PLANT_GRADE = 2;   // metal grade that opens the smelting plant (grading goes on after it)
const plantGrade = () => S.lv.metalPrice >= PLANT_GRADE;
const ORE_PER_INGOT = 4;
const metalPerIngot = () => ORE_PER_INGOT;
const hopperCap = () => val('hopper');
const tubRoom = () => S.metalSlot ? Math.max(0, metalCap() - S.binMetal) : 0;
// V7: the ingot pallet by the road grows with the metal tub (like the bags' shelf grows with the bin): dry bundles don't take
// the tub's room, but every bigger crib also means a bigger pallet. The shed's own ingot rack stays a fixed size.
const palletCap = () => Math.max(6, Math.round(metalCap()*0.5));
const palletRoom = () => Math.max(0, palletCap() - S.ingots);
// V6.2: the bin keeps the bags on a shelf of their own beside the loose leaves (room for 80% of the bin's leaves in
// bags), so bags never crowd out the leaves waiting to be bagged, and the bin holds a bit more in all.
const binRoom = () => Math.max(0, binCap() - S.binLeaves);
const bagCap = () => Math.max(3, Math.round(binCap()*0.8/BAG_SIZE));
// the "keep" lines on the bin card: the truck leaves this much behind (loose leaves for bagging, metal for smelting)
const keepLeaves = () => S.bag.built ? Math.round(clamp(S.keep.leaves, 0, 1)*binCap()) : 0;
const keepMetal = () => S.plant.built ? Math.round(clamp(S.keep.metal, 0, 1)*metalCap()) : 0;
// Packing (bagging, filling and wrapping jars, smelting) opens with the first building that needs it
const packOpen = () => !!(S.bag.built || S.hive.built || S.plant.built);
// V11: the truck leaves this many plain jars in the crate so they can be wrapped first
const keepJars = () => S.hive.packing ? Math.round(clamp(S.keep.jars || 0, 0, 1)*crateCap()) : 0;
const truckEvery = () => val('truck');
const rv = (ri, k) => TRACKS[k].vals[S.robots[ri].lv[k]];
const leafCap = ri => rv(ri, 'carry');
const metalCarry = ri => 2 + Math.floor(S.robots[ri].lv.carry/2);

function trackCap(k){
  let n = 0;
  for (const g of TRACKS[k].gens){ if (g.tech && !S.tech[g.tech]) break; if (g.needsMetal && !S.metalSlot) break; if (g.needsPack && !packOpen()) break; if (g.needsShaft && !S.shafts.length) break; if (g.needsPlant && !S.plant.built) break; n += g.n; }
  return n;
}
const trackMax = k => TRACKS[k].vals.length - 1;
function trackVisible(k){ if (k === 'snip') return S.hive.built; if (k === 'pack') return packOpen(); if (k === 'dig') return S.shafts.length > 0; if (k === 'stoke' || k === 'brolly') return S.plant.built; if (k === 'grab') return !!S.tech.claw; if (k === 'reach') return !!S.tech.arm; if (k === 'drill' || k === 'magnet') return S.metalSlot; return true; }
function genAt(k, level){ let acc = 0; const gens = TRACKS[k].gens; for (let gi=0; gi<gens.length; gi++){ const g = gens[gi]; if (level < acc + g.n) return { gi, g, idx: level - acc }; acc += g.n; } return null; }
function genNameAt(k, level){ let acc = 0, name = TRACKS[k].gens[0].name; for (const g of TRACKS[k].gens){ if (g.n > 0 && level > acc) name = g.name; acc += g.n; } return name; }
// robots of every kind: 'robot' (the regular yard bots), 'blower' and 'shaker'
const KIND_LIST = { robot:'robots', blower:'blowers', shaker:'shakers' };
const cfgsOf = kind => S[KIND_LIST[kind]];
// everyone who has track k: Wheels are on every robot of every kind, the rest only on one kind
function peersFor(k){ if (k === 'speed') return [...S.robots, ...S.blowers, ...S.shakers]; if (k === 'blow' || k === 'dig' || k === 'stoke' || k === 'brolly') return S.blowers; if (k === 'shake' || k === 'snip') return S.shakers; return S.robots; }
function botCost(kind, i, k){
  const me = cfgsOf(kind)[i], L = me.lv[k], ge = genAt(k, L);
  if (!ge) return null;
  const full = ge.g.cost[ge.idx];
  const disc = !NO_DISCOUNT.includes(k) && peersFor(k).some(c => c !== me && c.lv[k] > L);
  return { cost: disc ? niceCost(full*discFor(k)) : full, full, disc };
}
const rCost = (ri, k) => botCost('robot', ri, k);
const botCount = () => S.robots.length + S.blowers.length + S.shakers.length;
// what a level another robot already has costs, as a share of the full price
function discFor(k){ let d = DISCOUNT; if (gl('blueprint')) d = 0.3; if (k === 'carry' && gl('basket')) d = 0.1; return d; }
const robotCost = n => niceCost(ROBOT_COST[n]*(gl('bulk') ? 0.75 : 1));
// "Upgrade all" on a track: first it brings every robot up to the best robot's level (all copied, so all discounted);
// once they match, it adds one level to everyone: one at full price, the rest at the copied-level price.
function allPlan(k){
  const peers = peersFor(k), n = peers.length;
  if (n < 2 || !trackVisible(k)) return null;
  const lv = peers.map(r => r.lv[k]), top = Math.max(...lv), cap = trackCap(k);
  const price = (L, disc) => { const ge = genAt(k, L); if (!ge) return null; const f = ge.g.cost[ge.idx]; return disc && !NO_DISCOUNT.includes(k) ? niceCost(f*discFor(k)) : f; };
  let cost = 0, full = 0, target;
  if (lv.some(l => l < top)){
    target = top;
    for (const l of lv) for (let L=l; L<top; L++){ cost += price(L, true); full += price(L, false); }
  } else {
    if (top >= cap || top >= trackMax(k)) return null;
    target = top + 1;
    const f = price(top, false); cost = f + (n - 1)*price(top, true); full = f*n;
  }
  const behind = lv.filter(l => l < target).length;
  return { cost: Math.round(cost*100)/100, full, target, catchUp: target === top, behind };
}
// the first locked tier of a track, if it can be unlocked yet (prerequisites met and its price in sight)
function nextUnlock(k){ for (const g of TRACKS[k].gens){ if (!g.tech) continue; if (!S.tech[g.tech]) return techAvailable(g.tech) ? g.tech : null; } return null; }
// claw and reach rows show up on the robot card once their first unlock is in sight
const rowShown = k => trackVisible(k) || ((k === 'grab' || k === 'reach') && nextUnlock(k));
function techAvailable(id){ const t = TECH[id]; if (S.tech[id]) return false; if (t.needs && !S.tech[t.needs]) return false; if (t.needsMiner && !S.miners.length) return false; if (t.needsKind && !S[t.needsKind].length) return false; if (t.needsPack && !packOpen()) return false; if (t.needsShaft && !(S.shafts.length && S.blowers.length)) return false; if (t.needsPlantBlower && !(S.plant.built && S.blowers.some(b => b.lv.stoke > 0))) return false; return ALWAYS_SHOWN.includes(id) || seenPrice(t.cost); }
// Unlocks stay hidden until you've once held a quarter of their price (S.peak is the most cash you've ever had).
const ALWAYS_SHOWN = ['treads', 'hamper', 'servos'];
const seenPrice = cost => (S.peak || 0) >= cost*0.25;
const metalSlotShown = () => metalOpen() && seenPrice(METAL_SLOT_COST);

// ───────────────────────── tasks (V6)
// Every robot has a priority list of tasks: rows in "Do" (top row first; two tasks side by side share a priority)
// and a "Don't" pile. A robot does the first task that has work, and looks again whenever it finishes a bit of work.
const TASKS = {
  leaves: { name:'Gather leaves', short:'Leaves', col:'#d9652a', kind:'robot' },
  mine:   { name:'Saw wet wood',  short:'Saw',    col:'#6e4a30', kind:'robot' },
  bag:    { name:'Bag leaves',    short:'Bag',    col:'#c9862f', kind:'robot' },
  jar:    { name:'Fill punnets',  short:'Punnet', col:'#c99448', kind:'robot' },
  wrap:   { name:'Wrap gift baskets', short:'Wrap',  col:'#c23b4e', kind:'robot' },
  smelt:  { name:'Dry wood',      short:'Dry',    col:'#b8452d', kind:'robot' },
  haul:   { name:'Haul dry wood',   short:'Haul',   col:'#5f8c87', kind:'robot' },
  blow:   { name:'Blow leaves',   short:'Blow',   col:'#4f7c84', kind:'blower' },
  dig:    { name:'Dry the wood piles', short:'Dry pile', col:'#8a6040', kind:'blower' },
  stoke:  { name:'Work the bellows', short:'Bellows', col:'#b8452d', kind:'blower' },
  brolly: { name:'Carry wood umbrella', short:'Umbrella', col:'#3f6a8a', kind:'blower' },
  shake:  { name:'Shake trees',   short:'Shake',  col:'#6f7d3c', kind:'shaker' },
  snip:   { name:'Trim mushrooms', short:'Trim', col:'#7a4d6e', kind:'shaker' },
};
const KIND_TASKS = { robot:['leaves','mine','bag','jar','wrap','smelt','haul'], blower:['blow','dig','stoke','brolly'], shaker:['shake','snip'] };
// is the task there at all yet (its building bought, the skill learned)?
function taskOpen(t, cfg){
  switch (t){
    case 'mine': return S.metalSlot;
    case 'bag': return S.bag.built;
    case 'jar': return S.hive.built;
    case 'wrap': return S.hive.built && S.hive.packing;
    case 'smelt': case 'haul': return S.plant.built;
    case 'dig': return !!(cfg && cfg.lv.dig > 0) && S.shafts.length > 0;
    case 'stoke': return !!(cfg && cfg.lv.stoke > 0) && S.plant.built;
    case 'brolly': return !!(cfg && cfg.lv.brolly > 0) && S.plant.built;
    case 'snip': return !!(cfg && cfg.lv.snip > 0) && S.hive.built;
  }
  return true;
}
function tasksFix(cfg, kind){
  // every task of this kind appears exactly once, in Do or in Don't; rows hold at most two
  const all = KIND_TASKS[kind], seen = new Set();
  let prio = Array.isArray(cfg.prio) ? cfg.prio : [], off = Array.isArray(cfg.off) ? cfg.off : [];
  prio = prio.map(row => (Array.isArray(row) ? row : [row]).filter(t => all.includes(t) && !seen.has(t) && seen.add(t)).slice(0, 2)).filter(r => r.length);
  off = off.filter(t => all.includes(t) && !seen.has(t) && seen.add(t));
  for (const t of all) if (!seen.has(t)) off.push(t);
  cfg.prio = prio; cfg.off = off;
  return cfg;
}
function taskRemove(cfg, t){ cfg.prio = cfg.prio.map(r => r.filter(x => x !== t)).filter(r => r.length); cfg.off = cfg.off.filter(x => x !== t); }
const taskOn = (cfg, t) => cfg.prio.some(r => r.includes(t));
const taskTop = (cfg, t) => !!cfg.prio.length && cfg.prio[0].includes(t);
function putTop(cfg, t){ taskRemove(cfg, t); cfg.prio.unshift([t]); }
function putOff(cfg, t){ taskRemove(cfg, t); cfg.off.push(t); }
// a newly learned helper skill goes next to the main task (same priority) so the helper mixes the two
// V7: a robot whose list you've changed (anything in its Don't pile) doesn't get newly opened tasks put on its list;
// they go in its Don't pile instead. Robots that still do everything get them, in their usual place.
const kindOfCfg = cfg => S.blowers.includes(cfg) ? 'blower' : S.shakers.includes(cfg) ? 'shaker' : 'robot';
const hasDont = (cfg, kind, fresh) => cfg.off.some(x => !fresh.includes(x) && taskOpen(x, cfg));
function putBeside(cfg, t, main){
  if (taskOn(cfg, t)) return;
  if (hasDont(cfg, kindOfCfg(cfg), [t])){ putOff(cfg, t); return; }
  taskRemove(cfg, t); const row = cfg.prio.find(r => r.includes(main)); if (row && row.length < 2) row.push(t); else cfg.prio.push([t]);
}
// a building just opened tasks `ts` for the regular robots
function openTasks(ts){
  for (const cfg of S.robots){
    if (hasDont(cfg, 'robot', ts)){ for (const t of ts) putOff(cfg, t); continue; }
    for (const t of ts){
      if (taskOn(cfg, t)) continue;
      taskRemove(cfg, t);
      // back in its default row: beside a task from the same default row if there's room, otherwise a row of its own there
      const di = DEFAULT_PRIO.robot.findIndex(r => r.includes(t)), mates = DEFAULT_PRIO.robot[di] || [];
      const row = cfg.prio.find(r => r.length < 2 && r.some(x => mates.includes(x)));
      if (row) row.push(t); else cfg.prio.splice(Math.min(di, cfg.prio.length), 0, [t]);
    }
  }
}

// V6.3: a new robot has every task in Do (tasks that aren't there yet are just skipped), so nothing is left undone if
// you never touch its list: the work stations first, then mining, then leaves, which always have work.
const DEFAULT_PRIO = { robot: [['bag', 'jar'], ['wrap'], ['smelt', 'haul'], ['mine'], ['leaves']], blower: [['dig', 'stoke'], ['brolly'], ['blow']], shaker: [['shake', 'snip']] };
const defPrio = kind => DEFAULT_PRIO[kind].map(r => r.slice());
function newRobotCfg(){ return tasksFix({ prio:defPrio('robot'), off:[], miner:null, lv:{ speed:0, carry:0, pick:0, grab:0, reach:0, drill:0, magnet:0, pack:0 } }, 'robot'); }
function newHelperCfg(kind){ return kind === 'blower' ? tasksFix({ prio:defPrio('blower'), off:[], lv:{ speed:0, blow:0, dig:0, stoke:0, brolly:0 } }, 'blower') : tasksFix({ prio:defPrio('shaker'), off:[], lv:{ speed:0, shake:0, snip:0 } }, 'shaker'); }
const helperCost = kind => (kind === 'blower' ? BLOWER_COST : SHAKER_COST)[cfgsOf(kind).length];
// a helper shows up in the workshop once you've held a quarter of its price (or already own one of that kind)
const helperShown = kind => cfgsOf(kind).length < HELPER_MAX && (cfgsOf(kind).length > 0 || seenPrice(helperCost(kind)));
function freshState(){
  return {
    v:2, t:0, cash:0, peak:0, binLeaves:0, binMetal:0, land:0,
    lv:{ bin:0, leafPrice:0, bagPrice:0, metalPrice:0, metalBin:0, truck:0, cleanup:0, hiveTank:0, hiveStore:0, honeyPrice:0, giftPrice:0, smeltSpeed:0, ingotGrade:0, slag:0, pallet:0, hopper:0 }, cleanN:0,
    hive:{ built:false, bees:0, nectar:0, honey:0, jars:0, packing:false, gift:0, up:{ wings:false, fan:false, nursery:false, third:false, tongue:false, recipe:false } },
    bag:{ built:false, bags:0 }, plant:{ built:false, ore:0, rack:0, slagAcc:0 }, ingots:0, shafts:[], keep:{ leaves:0, metal:0, jars:0 },
    tech:{}, gen:{}, seen:{}, metalSlot:false, robots:[newRobotCfg()], blowers:[], shakers:[], miners:[],
    truckT:28, passive:0,   // WILDFLOWER PRAIRIE: $/s coming in from the first yard (the test slider)
    totals:{ leaves:0, metal:0, cash:0, trucks:0, lucky:0, drops:0, shakes:0, honey:0, nectar:0, bags:0, gifts:0, ingots:0 },
    flags:{ opened:false, finished:false, sentHint:false, saleShown:0, research:false, general:false, tiers5:true, bin9:true, metalTub:true, hiveShown:false, v6:true, v7:true, v9:true, v11:true, bagShown:false, plantShown:false, taskHint:false, hints:{} }
  };
}
let S = freshState();

// ───────────────────────── canvas & camera
const cv = $('c'); let ctx = cv.getContext('2d'); const mainCtx = ctx;   // let: card portraits borrow the robot drawing code for a moment
let W = 0, H = 0, DPR = 1;
const cam = { z:1, ox:0, oy:0 };
let camAnim = null, userCam = false, camMovedT = 0;
let groundCv = null, groundCam = { z:1, ox:0, oy:0, mx:0, my:0, rs:1 }, vignetteCv = null, canopyCvs = [];

function camTarget(level){
  const A = AREAS[level], vw = A.w + (W < 640 ? 16 : 80), vh = A.h + ROAD + 84;   // phones: let the yard use the full width
  const z = Math.min(W/vw, H/vh, 1.9);
  return { z, ox: W/2, oy: H - ROAD*z };
}
const w2s = (x, y) => ({ x: cam.ox + x*cam.z, y: cam.oy + y*cam.z });
const s2w = (x, y) => ({ x: (x - cam.ox)/cam.z, y: (y - cam.oy)/cam.z });
const visRect = (c = cam) => ({ x0: -c.ox/c.z, x1: (W - c.ox)/c.z, y0: -c.oy/c.z, y1: (H - c.oy)/c.z });

function resize(){
  const center = W ? s2w(W/2, H/2) : null, z = cam.z;
  W = innerWidth; H = innerHeight; DPR = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(W*DPR); cv.height = Math.round(H*DPR);
  cv.style.width = W+'px'; cv.style.height = H+'px';
  if (userCam && center){ cam.z = z; cam.ox = W/2 - center.x*z; cam.oy = H/2 - center.y*z; clampCam(); }
  else Object.assign(cam, camTarget(S.land));
  camAnim = null;
  buildGround(cam); buildVignette();
  closeCard();
}
// ── player camera: wheel / pinch zoom, drag to pan, WASD or arrow keys, Home to recenter
// The camera may wander a little past your fence, but never far down the road or off your land.
function camBounds(z = cam.z){
  const A = AREAS[S.land], O = owned();
  const mx = 120 + 0.05*A.w, my = 110 + 0.05*A.h;
  // zoomed in, the road may fill at most about a fifth of the screen
  const y1 = clamp(0.22*H/z - VERGE, 20, ROAD + 6);
  return { x0: O.x0 - mx, x1: O.x1 + mx, y0: O.y0 - my, y1 };
}
function zoomLimits(){ const fit = camTarget(S.land).z; return [fit*0.85, Math.max(2.8, fit*1.7)]; }
function clampCam(){
  const [zmin, zmax] = zoomLimits();
  const c = s2w(W/2, H/2);
  cam.z = clamp(cam.z, zmin, zmax);
  const B = camBounds(), hw = W/2/cam.z, hh = H/2/cam.z;
  // along each axis: keep the view inside the bounds; if the view is bigger than the bounds,
  // centre it sideways, and pin the road to the bottom edge vertically (extra room shows the woods instead)
  const cx = 2*hw >= B.x1 - B.x0 ? (B.x0 + B.x1)/2 : clamp(c.x, B.x0 + hw, B.x1 - hw);
  const cy = 2*hh >= B.y1 - B.y0 ? B.y1 - hh : clamp(c.y, B.y0 + hh, B.y1 - hh);
  cam.ox = W/2 - cx*cam.z; cam.oy = H/2 - cy*cam.z;
}
function zoomAt(sx, sy, f){
  const w = s2w(sx, sy), [zmin, zmax] = zoomLimits();
  const nz = clamp(cam.z*f, zmin, zmax);
  cam.z = nz; cam.ox = sx - w.x*nz; cam.oy = sy - w.y*nz;
  clampCam(); userMoved();
}
function userMoved(){
  userCam = true; camAnim = null; camMovedT = performance.now();
  $('recenter').hidden = false;
  if (cardOpen) placeCard();
}
function recenter(){
  userCam = false; camAnim = null; $('recenter').hidden = true;
  Object.assign(cam, camTarget(S.land)); buildGround(cam);
  if (cardOpen) placeCard();
}
function groundCovers(){
  const G = groundCam; if (Math.abs(cam.z/G.z - 1) > 0.12) return false;
  const V = visRect();
  return V.x0 >= -(G.ox + G.mx)/G.z && V.x1 <= (W + G.mx - G.ox)/G.z && V.y0 >= -(G.oy + G.my)/G.z && V.y1 <= (H + G.my - G.oy)/G.z;
}

// ───────────────────────── leaves
// RAINY HOLLOW: wet autumn leaves, a little darker and glossier than in the first yard (deep reds, rust, burnt orange,
// ochre, a few still green-gold and a lot of brown)
const LEAFC = [
  { c:'#a8321f', v:'#6a1d12', w:.17 },
  { c:'#c24a22', v:'#7a2a12', w:.15 },
  { c:'#d06a24', v:'#874015', w:.2 },
  { c:'#d6922e', v:'#946016', w:.13 },
  { c:'#8c8f38', v:'#545a20', w:.1, sp:true },
  { c:'#8f5428', v:'#58311a', w:.17 },
  { c:'#6e3f22', v:'#432414', w:.08 },
];
function pickColor(){ let r = Math.random(); for (let i=0;i<LEAFC.length;i++){ r -= LEAFC[i].w; if (r <= 0) return i; } return 0; }
const MAPLE = (() => { const h = [[0,-1],[0.12,-0.62],[0.38,-0.8],[0.32,-0.42],[0.74,-0.52],[0.58,-0.2],[0.98,-0.02],[0.62,0.1],[0.7,0.32],[0.3,0.24],[0.08,0.42],[0,0.5]]; const p = h.slice(); for (let i=h.length-2;i>0;i--) p.push([-h[i][0], h[i][1]]); return p; })();
// shapes: 0 oval leaf, 1 maple leaf, 2 cherry petal (notched tip), 3 round petal
function leafPath(c, shape){
  c.beginPath();
  if (shape === 1){ c.moveTo(MAPLE[0][0], MAPLE[0][1]); for (let i=1;i<MAPLE.length;i++) c.lineTo(MAPLE[i][0], MAPLE[i][1]); c.closePath(); }
  else if (shape === 2){
    c.moveTo(0, 0.95); c.bezierCurveTo(0.38, 0.72, 0.86, 0.05, 0.76, -0.55); c.bezierCurveTo(0.68, -0.95, 0.24, -1.02, 0, -0.7);
    c.bezierCurveTo(-0.24, -1.02, -0.68, -0.95, -0.76, -0.55); c.bezierCurveTo(-0.86, 0.05, -0.38, 0.72, 0, 0.95); c.closePath();
  } else if (shape === 3){
    c.moveTo(0, 0.95); c.bezierCurveTo(0.62, 0.66, 1.02, -0.2, 0.72, -0.74); c.quadraticCurveTo(0.36, -1.06, 0, -0.9);
    c.quadraticCurveTo(-0.36, -1.06, -0.72, -0.74); c.bezierCurveTo(-1.02, -0.2, -0.62, 0.66, 0, 0.95); c.closePath();
  }
  else { c.moveTo(0,-1); c.bezierCurveTo(0.62,-0.7,0.6,0.5,0,0.82); c.bezierCurveTo(-0.6,0.5,-0.62,-0.7,0,-1); c.closePath(); }
}
function drawLeaf(c, x, y, s, rot, ci, shape, flipX, squash, alpha, dark){
  const col = LEAFC[ci] || LEAFC[0];
  if (col.petal) shape = 2 + (shape & 1);
  c.save(); c.translate(x, y); if (squash !== 1) c.scale(1, squash); c.rotate(rot); c.scale(s*flipX, s);
  if (alpha !== 1) c.globalAlpha *= alpha;
  leafPath(c, shape);
  c.fillStyle = col.c; c.fill();
  if (col.petal){
    // a soft blush toward the base, a sheen on one side and two faint veins
    const a0 = c.globalAlpha;
    if (dark){ c.fillStyle = 'rgba(90,30,60,'+dark+')'; c.fill(); }
    c.globalAlpha = a0*0.4; c.fillStyle = col.v; ell(c, 0, 0.55, 0.34, 0.42); c.fill();
    c.globalAlpha = a0*0.35; c.fillStyle = '#fff'; ell(c, -0.3, -0.3, 0.2, 0.36); c.fill();
    c.globalAlpha = a0*0.5; c.lineWidth = 0.05; c.strokeStyle = col.v; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 0.85); c.lineTo(0, -0.5); c.moveTo(0, 0.6); c.quadraticCurveTo(0.34, 0.1, 0.42, -0.5); c.moveTo(0, 0.6); c.quadraticCurveTo(-0.34, 0.1, -0.42, -0.5); c.stroke();
    c.restore(); return;
  }
  if (dark){ c.fillStyle = 'rgba(60,20,5,'+dark+')'; c.fill(); }
  c.lineWidth = 0.09; c.strokeStyle = col.v; c.lineCap = 'round';
  c.beginPath(); c.moveTo(0, shape===1?0.45:0.8); c.lineTo(0, 1.12);
  c.moveTo(0, 0.5); c.lineTo(0, -0.78);
  if (shape === 1){ c.moveTo(0,0.3); c.lineTo(0.55,-0.38); c.moveTo(0,0.3); c.lineTo(-0.55,-0.38); c.moveTo(0,0.38); c.lineTo(0.72,0.05); c.moveTo(0,0.38); c.lineTo(-0.72,0.05); }
  else { c.moveTo(0,-0.2); c.lineTo(0.3,-0.45); c.moveTo(0,-0.2); c.lineTo(-0.3,-0.45); c.moveTo(0,0.2); c.lineTo(0.32,0.0); c.moveTo(0,0.2); c.lineTo(-0.32,0.0); }
  c.stroke();
  // RAINY HOLLOW: a wet sheen on every leaf
  { const a0 = c.globalAlpha; c.globalAlpha = a0*0.22; c.fillStyle = '#fff6ea'; ell(c, -0.2, -0.28, 0.16, 0.34); c.fill(); c.globalAlpha = a0; }
  if (col.sp){ c.fillStyle = '#5a6322'; ell(c,0.22,-0.3,0.08,0.08); c.fill(); ell(c,-0.2,0.15,0.07,0.07); c.fill(); ell(c,0.12,0.35,0.06,0.06); c.fill(); c.fillStyle='#c98a35'; ell(c,-0.25,-0.45,0.07,0.07); c.fill(); ell(c,0.3,0.12,0.06,0.06); c.fill(); }
  c.restore();
}

let leaves = [], fgLeaves = [];
let groundN = 0;

function landingOK(x, y){
  const O = owned();
  if (x < O.x0 + 8 || x > O.x1 - 8 || y < O.y0 + 6 || y > O.y1 - 4) return false;
  if (Math.abs(x - SHED.x) < 60 && y > SHED.y - 72) return false;
  if (x > BIN.x - 46 && x < BIN.x + 82 && y > BIN.y - 56) return false;
  if (hiveShown() && Math.abs(x - HIVE.x) < 50 && y > HIVE.y - 165 && y < HIVE.y + 12) return false;
  if (S.hive.built && Math.abs(x - CRATE.x) < 26 && y > CRATE.y - 58 && y < CRATE.y + 8) return false;
  if (twinBuilt() && ((Math.abs(x - HIVE2.x) < 50 && y > HIVE2.y - 165 && y < HIVE2.y + 12) || (Math.abs(x - CRATE2.x) < 26 && y > CRATE2.y - 58 && y < CRATE2.y + 8))) return false;
  if (baggerShown() && Math.abs(x - BAGGER.x) < 34 && y > BAGGER.y - 30 && y < BAGGER.y + 8) return false;
  if (S.plant.built && Math.abs(x - PALLET.x) < 28 && y > PALLET.y - 26 && y < PALLET.y + 8) return false;
  if (plantShown() && x > PLANT.x - 104 && x < PLANT.x + 104 && y > PLANT.y - 66 && y < PLANT.y + 8) return false;
  // not inside a bush or against a trunk, where nobody could see the leaf
  for (const b of BUSHES){ const dx = (x - b.x)/(36*b.s), dy = (y - b.y + 8*b.s)/(18*b.s); if (dx*dx + dy*dy < 1) return false; }
  for (const t of TREES){ const by = trunkBase(t); if (Math.abs(x - t.x) < Math.max(14, t.r*0.15) && y > by - 16 && y < by + 3) return false; }
  return true;
}
function newLeaf(x, y, ly, collect){
  const ci = pickColor();
  return { x, y, ly, s: rand(8, 11)*(LEAFC[ci].petal ? 1.3 : 1), rot: rand(0, TAU), vr: rand(-1.6, 1.6), ci, sh: Math.random() < 0.55 ? 1 : 0,
    st: 'fall', vy: rand(34, 54), ph: rand(0, TAU), phs: rand(1.6, 3.2), sw: rand(9, 20), wf: rand(0.6, 1.2),
    flip: 1, claim: null, collect, a: 1, kx: 0, ky: 0, t: 0 };
}
function spawnCollectable(onGround){
  const O = owned();
  let x, ly;
  for (let k=0;k<10;k++){ x = rand(O.x0 + 10, O.x1 - 10); ly = rand(O.y0 + 8, O.y1 - 6); if (landingOK(x, ly)) break; }
  const fallH = rand(220, 420);
  const l = newLeaf(x, ly - fallH, ly, true);
  if (onGround){ l.y = ly; l.st = 'ground'; }
  else l.x -= wind * l.wf * fallH / l.vy;   // start upwind so it drifts onto its spot
  leaves.push(l);
  return l;
}
// Now and then a big tree over your land lets go of a whole load at once, leaving a thick pile under it.
const treeShake = TREES.map(() => 0);
let dropT = 45;
function treeDropSpots(t){
  // landing spots along the lower edge of the canopy (so the pile isn't hidden under it), denser in the middle
  const out = [];
  for (let k=0;k<60;k++){ const a = rand(0, TAU), d = Math.pow(Math.random(), 0.8); const x = t.x + Math.cos(a)*d*t.r*0.45, y = t.y + t.r*1.12 + Math.sin(a)*d*t.r*0.16; if (landingOK(x, y)) out.push({ x, y }); }
  return out;
}
function treeDrop(force){
  const A = AREAS[S.land];
  const opts = [];
  TREES.forEach((t, i) => { const spots = treeDropSpots(t); if (spots.length >= 12) opts.push({ t, i, spots, w: t.r*spots.length }); });
  if (!opts.length) return false;
  let pick = Math.random()*opts.reduce((a, o) => a + o.w, 0), o = opts[0];
  for (const q of opts){ pick -= q.w; if (pick <= 0){ o = q; break; } }
  const n = Math.round(rand(0.13, 0.2)*A.cap + o.t.r*0.08);
  if (!force && groundN + n > A.cap*1.3) return false;
  for (let k=0;k<n;k++){
    const p = o.spots[Math.floor(Math.random()*o.spots.length)], x = p.x + rand(-6, 6), ly = p.y + rand(-4, 4);
    if (!landingOK(x, ly)) continue;
    const fall = rand(70, 190), l = newLeaf(x, ly - fall, ly, true);
    l.vy = rand(55, 85); l.sw = rand(6, 14);           // a heavy shower: falls faster and straighter
    l.x -= wind*l.wf*fall/l.vy;
    if (simMode){ l.y = ly; l.x = x; l.st = 'ground'; }
    else l.y -= rand(0, 1.4)*l.vy;                     // spread the shower over about a second and a half
    leaves.push(l);
  }
  treeShake[o.i] = 1.6; S.totals.drops = (S.totals.drops || 0) + 1;
  if (!simMode){
    pop(o.t.x, o.t.y - o.t.r*0.55, 'whoosh!', 'note', 20);
    for (let k=0;k<4;k++) spawnFg();
    const a = sndAt(o.t.x, o.t.y); sfx('kick', 14, a.pan);
  }
  return true;
}
function spawnAmbient(){
  const V = visRect();
  let x, y;
  if (Math.random() < 0.7){
    const vis = TREES.filter(t => t.x + t.r > V.x0 && t.x - t.r < V.x1 && t.y + t.r > V.y0 && t.y - t.r < V.y1);
    if (vis.length){ const t = vis[Math.floor(Math.random()*vis.length)]; const a = rand(0, TAU), d = Math.sqrt(Math.random())*t.r*0.85; x = t.x + Math.cos(a)*d; y = t.y + Math.sin(a)*d*0.7; }
  }
  if (x === undefined){ x = rand(V.x0, V.x1); y = V.y0 - 20; }
  const ly = Math.min(y + rand(100, 420), -6);
  if (ly <= y) return;
  leaves.push(newLeaf(x, y, ly, false));
}
function spawnFg(){
  fgLeaves.push({ x: rand(-60, W*0.9), y: -40, s: rand(20, 28), rot: rand(0,TAU), vr: rand(-2,2), ci: pickColor(), sh: Math.random()<.6?1:0, vy: rand(70, 115), ph: rand(0,TAU), phs: rand(1.5,2.6), sw: rand(30,60) });
}

// ───────────────────────── runtime objects
let R = [];
// V7: the sale numbers come one at a time: each sits over its bin for SALE_HOLD seconds, flies into the truck, and only
// then does the next one pop up (SALE_STEP apart), so there's time to read every line.
const SALE_HOLD = 2.0, SALE_FLY = 0.6, SALE_STEP = 2.35;
const truck = { st:'away', x:0, v:0, timer:0, fill:0, rot:0, takeL:0, takeM:0, takeH:0, takeB:0, takeI:0, takeG:0 };
let parts = [], pops = [], bubbles = [];
let wind = 0, gust = 0, gustT = 8;
let spawnAcc = 0, ambAcc = 0, fgAcc = 0;
let bumpBin = 0, cashBumpT = 0, saleAppearT = -10;
const treeAlpha = TREES.map(() => 0.96);
let simMode = false;

function newRobot(i){
  return { id:i, x: SHED.x + rand(-6,6), y: SHED.y + 12, st:'idle', carryL:0, carryM:0, carryI:0, face:1, anim:Math.random()*5, moving:false,
    mineP:0, timer:0, plan:null, fingers:null, blinkT: rand(1,4), blink:0, wx:0, wy:0, full:false, hammer:0, armTo:null,
    task:null, lastTask:null, streak:0, mslot:0, spot:-1, ore:false, workP:0, workDur:1, at:null, look:0 };
}
function syncRobots(){ while (R.length < S.robots.length) R.push(newRobot(R.length)); }

const robotSpeed = ri => 58 * rv(ri, 'speed') * (1 + 0.2*gl('oil'));
const pickTime = ri => rv(ri, 'pick') * (1 - 0.15*gl('servo'));
const drillTime = ri => rv(ri, 'drill') * (1 - 0.15*gl('cutting'));
const doubleChance = ri => Math.min(0.9, rv(ri, 'magnet') + (gl('charm') ? 0.08 : 0));
// how far the claw's fingers spread around the hand: a single pincer only takes the leaf under it
const clawSpread = ri => { const g = rv(ri, 'grab'); return g <= 1 ? 0 : (12 + 5*g)*(1 + 0.3*gl('fingers')); };
// V6 refining: one Packing track speeds up bagging, gift jars and smelting
const packSpeed = ri => rv(ri, 'pack');
const bagTime = ri => BAG_TIME/packSpeed(ri);
const jarTime = ri => JAR_TIME/packSpeed(ri);
const stoker = () => HB.find(h => h.kind === 'blower' && h.st === 'stoke');
// V7: smelting takes packing and drilling skill: a robot that knows the rock (a good drill) smelts it much faster, so an
// old miner moved to the furnace is a real help. Drill bonus = how many times faster its drill is than a hand drill.
const drillSkill = ri => TRACKS.drill.vals[0]/rv(ri, 'drill');
const smeltSkill = ri => packSpeed(ri)*(1 + 0.5*(drillSkill(ri) - 1));
const smeltTime = ri => { const b = stoker(); return SMELT_TIME/smeltSkill(ri)/val('smeltSpeed')/(b ? 1 + hv(b, 'stoke') : 1); };
// the bellows: one blower can stand in front of the plant blowing into the intake grate under the furnaces
const STOKE_SPOT = { x: PLANT.x + 52, y: PLANT.y + 30 }, PLANT_VENT = { x: PLANT.x + 21, y: PLANT.y + 2 };
// V7: ingots ride in the basket too, but each one takes the room of INGOT_SPACE leaves, so bigger baskets haul more
const INGOT_SPACE = 4;
const ingotCarry = ri => Math.max(1, Math.floor(leafCap(ri)/INGOT_SPACE));
// V6.3: the hive makes honey; a robot at the crate fills the jars (and wraps them as gift jars once Gift wrapping is bought).
// The crate holds as many jars as the hive's store.
const crateCap = () => honeyCap();
const crateJars = () => S.hive.jars + S.hive.gift;
const wrapTime = ri => WRAP_TIME/packSpeed(ri);
// V11: jars in robots' hands (being filled, or being wrapped) still need a place in the crate
const crateFull = () => crateJars() + busyIn('jar') + busyIn('wrap') >= crateCap();
// plain jars in the crate that nobody is on the way to wrap
const wrapJars = r => S.hive.jars - R.filter(q => q !== r && q.st === 'toStation' && q.task === 'wrap').length;

function moveTo(r, x, y, sp, dt){
  const dx = x - r.x, dy = y - r.y, d = Math.hypot(dx, dy);
  if (Math.abs(dx) > 1.5) r.face = dx > 0 ? 1 : -1;
  if (d <= sp*dt + 0.5){ r.x = x; r.y = y; return true; }
  r.x += dx/d*sp*dt; r.y += dy/d*sp*dt; r.moving = true; return false;
}
// drop-off spots in front of the bin (two rows once there are lots of robots)
function binSpot(r){ const k = r.id % 5, row = Math.floor(r.id/5); return { x: BIN.x + [-30, -15, 0, 15, 30][k] - 4 + row*7, y: BIN.y + 15 + row*7 + (r.id % 2)*2 }; }
const tubSpot = r => ({ x: TUB.x + 2 + (r.id%3 - 1)*8, y: TUB.y + 15 + (r.id >= 5 ? 6 : 0) });
const palletSpot = r => ({ x: PALLET.x + (r.id%3 - 1)*9, y: PALLET.y + 15 + (r.id >= 5 ? 6 : 0) });
// the smelting plant: ore goes in the hopper on the left, ingots come out on the rack on the right
const HOPPER = { x: PLANT.x - 84, y: PLANT.y + 2 }, RACK = { x: PLANT.x + 84, y: PLANT.y + 2 };
const hopperRoom = () => S.plant.built ? Math.max(0, Math.floor(hopperCap() - S.plant.ore)) : 0;
const metalRoom = () => hopperRoom() + tubRoom();
// mined metal goes to the plant's hopper while it has room, otherwise into the tub; ore fetched from the tub only goes to the hopper
function metalTarget(r){
  if (S.plant.built && (r.ore || hopperRoom() > 0)) return { x: HOPPER.x + 6 + (r.id%3 - 1)*7, y: HOPPER.y + 16, hopper:true };
  return Object.assign(tubSpot(r), { hopper:false });
}
// ── miners: a plain miner has room for one robot, a mine shaft for two
const slotsAt = sp => S.shafts.includes(sp) ? 2 : 1;
const minerWorkers = sp => { const out = []; S.robots.forEach((c, i) => { if (c.miner === sp) out.push(i); }); return out; };
function mineSlotFor(r){
  const cfg = S.robots[r.id];
  if (cfg.miner != null && S.miners.includes(cfg.miner)) return cfg.miner;
  let best = null, bd = 1e18;
  for (const sp of S.miners){
    if (minerWorkers(sp).length >= slotsAt(sp)) continue;
    const p = SPOTS[sp], d = 0.5*Math.hypot(p.x - r.x, p.y - r.y) + Math.hypot(p.x - BIN.x, p.y - BIN.y);
    if (d < bd){ bd = d; best = sp; }
  }
  return best;
}
function claimSlot(r, sp){
  S.robots[r.id].miner = sp;
  const used = R.filter(q => q !== r && S.robots[q.id] && S.robots[q.id].miner === sp).map(q => q.mslot);
  r.mslot = used.includes(0) ? 1 : 0;
}
// after loading (or losing a shaft), make sure no miner has more robots than room, and that they stand apart
function fixSlots(){
  for (const sp of S.miners){ const w = minerWorkers(sp); w.forEach((ri, k) => { if (k >= slotsAt(sp)) S.robots[ri].miner = null; else if (R[ri]) R[ri].mslot = k; }); }
  S.robots.forEach(c => { if (c.miner != null && !S.miners.includes(c.miner)) c.miner = null; });
}
function minerFor(r){
  const cfg = S.robots[r.id];
  if (cfg.miner == null || !S.miners.includes(cfg.miner)) return null;
  const sp = cfg.miner, p = SPOTS[sp];
  if (S.shafts.includes(sp)) return r.mslot ? { sp, x:p.x, y:p.y, wx: p.x - 20, wy: p.y + 24, face:1 } : { sp, x:p.x, y:p.y, wx: p.x - 38, wy: p.y + 6, face:1 };
  return { sp, x:p.x, y:p.y, wx: p.x - 30, wy: p.y + 7, face:1 };
}
// how long one chunk takes at a spot: a shaft is a richer vein, and an excavating blower helps everyone mining there
function drillTimeAt(ri, sp){
  let t = drillTime(ri)/(SPOTS[sp].rich || 1);
  if (S.shafts.includes(sp)){ t *= 0.74; const ex = HB.find(h => h.kind === 'blower' && h.st === 'dig' && h.dig === sp); if (ex) t /= 1 + hv(ex, 'dig'); }
  return t;
}
// ── work stations: two spots at the bagging table, two at the honey crate (V7), three furnace doors at the plant
const STN = { bag: [null, null], jar: [null, null, null, null], smelt: [null, null, null] };
const JAR_SPOTS = [{ x: CRATE.x - 12, y: CRATE.y - 15, face: 1 }, { x: CRATE.x + 14, y: CRATE.y - 15, face: -1 },
                   { x: CRATE2.x - 12, y: CRATE2.y - 15, face: 1 }, { x: CRATE2.x + 14, y: CRATE2.y - 15, face: -1 }];   // the last two need the Twin hive
const crateFor = r => r.spot >= 2 ? CRATE2 : CRATE, hiveFor = r => r.spot >= 2 ? HIVE2 : HIVE;
const BAG_SPOTS = [{ x: BAGGER.x - 13, y: BAGGER.y - 9, face: 1 }, { x: BAGGER.x + 16, y: BAGGER.y - 9, face: -1 }];
// wrapping gift jars uses the honey crate's two spots
const stKey = t => t === 'wrap' ? 'jar' : t;
function stationPos(t, i){
  if (t === 'bag') return BAG_SPOTS[i] || BAG_SPOTS[0];
  if (t === 'jar' || t === 'wrap') return JAR_SPOTS[i] || JAR_SPOTS[0];
  return { x: PLANT.x + (i - 1)*40 - 9, y: PLANT.y + 15, face: 1 };
}
function stationFree(t, r){
  const a = STN[t], mine = a.indexOf(r.id); if (mine >= 0) return mine;
  const lim = t === 'jar' && !twinBuilt() ? 2 : a.length;   // the second crate's spots come with the Twin hive
  for (let i=0;i<lim;i++) if (a[i] === null) return i;
  return -1;
}
function claimStation(t, r){ const a = STN[t], i = stationFree(t, r); if (i >= 0) a[i] = r.id; r.spot = i; return i; }
function releaseStations(r, keep){ for (const t in STN){ if (t === keep) continue; const a = STN[t]; for (let i=0;i<a.length;i++) if (a[i] === r.id) a[i] = null; } }
function resetStations(){ for (const t in STN) STN[t].fill(null); }
const busyIn = st => { let n = 0; for (const q of R) if (q.st === st) n++; return n; };
const claimedRack = r => { let n = 0; for (const q of R) if (q !== r && q.st === 'toRack') n += ingotCarry(q.id); return n; };
const plainJars = () => Math.floor(S.hive.honey + 1e-9);
const bagRoom = () => Math.max(0, bagCap() - S.bag.bags - busyIn('bag'));
// leaves a bagger can get at: its own basket, the loose leaves in the bin, and baskets of robots stuck waiting at a full bin
const donorsFor = r => R.filter(q => q !== r && q.st === 'wait' && q.at !== 'metal' && q.carryL > 0);
const bagLeavesFor = r => r.carryL + S.binLeaves + donorsFor(r).reduce((n, q) => n + q.carryL, 0);
const oreNeed = () => ORE_PER_INGOT;

// is there work of task t for robot r right now?
function taskWork(r, t){
  switch (t){
    case 'leaves': return (binRoom() > 0 || r.carryL < leafCap(r.id)) && hasLeaves();
    case 'mine': return S.metalSlot && mineSlotFor(r) != null && (metalRoom() > 0 || r.carryM < metalCarry(r.id));
    case 'bag': return S.bag.built && stationFree('bag', r) >= 0 && bagRoom() > 0 && bagLeavesFor(r) >= BAG_SIZE;
    case 'jar': return S.hive.built && stationFree('jar', r) >= 0 && plainJars() >= 1 && !crateFull();
    case 'wrap': return S.hive.packing && stationFree('jar', r) >= 0 && wrapJars(r) >= 1;
    case 'smelt':
      if (!S.plant.built || stationFree('smelt', r) < 0 || S.plant.rack + busyIn('smelt') >= RACK_CAP) return false;
      return S.plant.ore + r.carryM >= metalPerIngot() - 1e-9 || (r.carryM > 0 && hopperRoom() > 0) || (S.binMetal > 0 && hopperRoom() > 0);
    case 'haul': return S.plant.built && palletRoom() > 0 && (r.carryI > 0 || S.plant.rack - claimedRack(r) > 0);
  }
  return false;
}
// Walk the priority list: the first row with any work wins. Two tasks side by side in a row share the priority:
// the robot sticks with the one it's on for a few rounds, then swaps if the other has work too.
function chooseTask(who, cfg, work){
  for (const row of cfg.prio){
    let a = null, b = null;
    for (const t of row){ if (!taskOpen(t, cfg) || !work(t)) continue; if (!a) a = t; else b = t; }
    if (!a) continue;
    if (!b) return a;
    const cur = who.lastTask === a ? a : who.lastTask === b ? b : null;
    if (cur && (who.streak || 0) < 3) return cur;
    return cur === a ? b : a;
  }
  return null;
}
function noteTask(who, t){ if (t && t !== who.lastTask){ who.lastTask = t; who.streak = 0; } }
function unitDone(who, t){ if (who.lastTask === t) who.streak = (who.streak || 0) + 1; else { who.lastTask = t; who.streak = 1; } }
// Some things jump the queue for anyone who has the task anywhere in Do: when the bin is full (or its own basket is),
// a robot with Bag leaves bags; when the metal tub is full (or it's holding enough metal and the hopper is full), a
// robot with Smelt ingots smelts. So a robot that gathers and bags bags its own leaves before picking new ones.
function urgentTask(r, cfg){
  if (S.bag.built && taskOn(cfg, 'bag') && (binRoom() <= 0 || r.carryL >= Math.min(BAG_SIZE, leafCap(r.id))) && taskWork(r, 'bag')) return 'bag';
  if (S.hive.built && taskOn(cfg, 'jar') && S.hive.honey >= honeyCap() - 1e-6 && taskWork(r, 'jar')) return 'jar';
  if (S.plant.built && taskOn(cfg, 'smelt') && ((S.metalSlot && tubRoom() <= 0) || (r.carryM >= oreNeed() && hopperRoom() <= 0)) && taskWork(r, 'smelt')) return 'smelt';
  return null;
}
const robotTask = r => { const cfg = S.robots[r.id]; return urgentTask(r, cfg) || chooseTask(r, cfg, t => taskWork(r, t)); };
// Plans a grab: a spot for the hand plus up to `grab` leaves the fingers can reach from it.
// With a claw the robot looks for a patch of leaves, not just the nearest one.
function freeLeaf(l, r){ return l.st === 'ground' && l.collect && (!l.claim || l.claim === r); }
function pickTarget(r){
  const grab = rv(r.id, 'grab'), spread = clawSpread(r.id);
  const cand = [];
  for (const l of leaves){
    if (l.st !== 'ground' || !l.collect || l.claim) continue;
    cand.push([Math.hypot(l.x - r.x, l.y - r.y) + 0.25*Math.hypot(l.x - BIN.x, l.y - BIN.y), l]);
  }
  if (!cand.length) return null;
  if (grab <= 1){ let b = cand[0]; for (const c of cand) if (c[0] < b[0]) b = c; return { ls:[b[1]] }; }
  cand.sort((a, b) => a[0] - b[0]);
  const reach = rv(r.id, 'reach');
  let best = null, bs = 1e18;
  for (let i=0; i<Math.min(16, cand.length); i++){
    const ls = patchAround(cand[i][1], grab, spread, cand);
    const h = centroid(ls);
    const walk = Math.max(0, Math.hypot(h.x - r.x, h.y - r.y) - reach*0.7) + 0.25*Math.hypot(h.x - BIN.x, h.y - BIN.y);
    const sc = walk - 34*(ls.length - 1);
    if (sc < bs){ bs = sc; best = ls; }
  }
  return { ls: best };
}
// the seed leaf plus its nearest neighbours that all fit inside one claw spread
function patchAround(seed, grab, spread, cand){
  const near = [];
  for (const c of cand){ const m = c[1]; if (m === seed) continue; const dx = m.x - seed.x, dy = m.y - seed.y; if (Math.abs(dx) > spread*2 || Math.abs(dy) > spread*2) continue; const d = Math.hypot(dx, dy); if (d <= spread*2) near.push([d, m]); }
  near.sort((a, b) => a[0] - b[0]);
  let ls = [seed];
  for (const [, m] of near){ if (ls.length >= grab) break; ls.push(m); }
  // drop anything the fingers can't reach from the middle of the patch
  for (let k=0; k<2 && ls.length > 1; k++){ const h = centroid(ls); ls = ls.filter(l => l === seed || Math.hypot(l.x - h.x, l.y - h.y) <= spread); }
  return ls;
}
function centroid(ls){ let x = 0, y = 0; for (const l of ls){ x += l.x; y += l.y; } return { x: x/ls.length, y: y/ls.length }; }
function planAlive(r){ if (!r.plan) return null; r.plan = r.plan.filter(l => l.st === 'ground' && l.claim === r); return r.plan.length ? centroid(r.plan) : null; }
const hasLeaves = () => { for (const l of leaves) if (l.st === 'ground' && l.collect && !l.claim) return true; return false; };
function release(r){ if (r.plan) for (const l of r.plan) if (l.claim === r) l.claim = null; r.plan = null; r.fingers = null; }

function idleWander(r){
  const O = owned();
  r.wx = clamp(r.x + rand(-90, 90), O.x0 + 20, O.x1 - 20); r.wy = clamp(r.y + rand(-60, 60), O.y0 + 20, O.y1 + 10); r.st = 'wander'; r.look = 0.3;
}
function decide(r){
  const cfg = S.robots[r.id];
  const t = robotTask(r);
  r.task = t; noteTask(r, t);
  if (t !== 'mine') cfg.miner = null;   // free the miner for someone else
  releaseStations(r, stKey(t));
  // first drop off what it carries, if there's room for it
  if (r.carryI > 0 && (t !== 'haul' || r.carryI >= ingotCarry(r.id) || S.plant.rack <= claimedRack(r)) && palletRoom() > 0){ r.st = 'toPallet'; return; }
  // (leaves it's about to bag, and wet wood it's about to smelt, go straight into the work instead)
  if (r.carryL > 0 && t !== 'bag' && (t !== 'leaves' || r.carryL >= leafCap(r.id)) && binRoom() > 0){ r.st = 'toBin'; r.at = 'bin'; return; }
  if (r.carryM > 0 && !(t === 'smelt' && (r.carryM >= oreNeed() || hopperRoom() <= 0)) && (r.ore || t !== 'mine' || r.carryM >= metalCarry(r.id)) && (r.ore ? hopperRoom() > 0 : metalRoom() > 0)){ r.st = 'toBin'; r.at = 'metal'; return; }
  if (!t){
    // nothing to do: if it's still holding something, go and wait where it goes
    if (r.carryL){ r.st = 'toBin'; r.at = 'bin'; return; }
    if (r.carryM){ r.st = 'toBin'; r.at = 'metal'; return; }
    if (r.carryI){ r.st = 'toPallet'; return; }
    idleWander(r); return;
  }
  startTask(r, t);
}
function startTask(r, t){
  if (t === 'leaves'){
    const p = pickTarget(r);
    if (p){ for (const l of p.ls) l.claim = r; r.plan = p.ls; r.st = 'seek'; return; }
    idleWander(r); return;
  }
  if (t === 'mine'){
    const sp = mineSlotFor(r); if (sp == null){ idleWander(r); return; }
    if (S.robots[r.id].miner !== sp) claimSlot(r, sp);
    r.st = 'toMine'; return;
  }
  if (t === 'bag' || t === 'jar' || t === 'wrap'){ claimStation(stKey(t), r); r.st = 'toStation'; return; }
  if (t === 'smelt'){
    claimStation('smelt', r);
    const need = metalPerIngot() - 1e-9;
    if (r.carryM + S.plant.ore >= need){ r.st = 'toStation'; return; }                       // enough in its basket and the hopper
    if (r.carryM > 0 && hopperRoom() > 0){ r.st = 'toBin'; r.at = 'metal'; return; }         // tip what it has in the hopper
    if (S.binMetal > 0 && hopperRoom() > 0){ r.st = 'toTub'; return; }                       // the hopper is low: fetch ore from the tub
    idleWander(r); return;
  }
  if (t === 'haul'){ r.st = (r.carryI >= ingotCarry(r.id) || S.plant.rack <= claimedRack(r)) ? 'toPallet' : 'toRack'; return; }
  idleWander(r);
}
// a robot arrives at its station and starts on one bag / gift jar / ingot, if the makings are there
function beginWork(r){
  const t = r.task, P = stationPos(t, r.spot);
  r.face = P.face;
  if (t === 'bag'){
    // leaves jump into the bag: its own first, then loose ones from the bin, then from anyone stuck waiting at a full bin
    if (bagRoom() <= 0 || bagLeavesFor(r) < BAG_SIZE) return false;
    const P2 = stationPos('bag', r.spot), bx = P2.x + (r.spot ? -3 : 5), by = BAGGER.y - 40;
    const leafFly = (x, y, n, d) => { for (let i=0;i<Math.min(n, 4);i++) flyTo('leaf', x + rand(-6, 6), y, bx + rand(-3, 3), by, 0.32 + d + i*0.08, 20, { ci: pickColor(), sh: Math.random() < .5 ? 1 : 0, s: 4.5 }); };
    let need = BAG_SIZE;
    const own = Math.min(r.carryL, need); if (own){ r.carryL -= own; need -= own; S.totals.leaves += own; leafFly(r.x, r.y - 36, own, 0); }
    const fromBin = Math.min(S.binLeaves, need); if (fromBin){ S.binLeaves -= fromBin; need -= fromBin; leafFly(BIN.x - 12, BIN.y - 44, fromBin, 0.05); }
    for (const q of donorsFor(r)){ if (need <= 0) break; const k = Math.min(q.carryL, need); q.carryL -= k; need -= k; S.totals.leaves += k; leafFly(q.x, q.y - 36, k, 0.1); if (!q.carryL){ q.st = 'idle'; q.full = false; } }
    r.workDur = bagTime(r.id);
  } else if (t === 'jar'){
    // a jar's worth of honey pours over from the hive into a jar at the crate
    if (plainJars() < 1 || crateFull()) return false;
    S.hive.honey = Math.max(0, S.hive.honey - 1); r.workDur = jarTime(r.id);
    { const hv = hiveFor(r), cr = crateFor(r); for (let i=0;i<3;i++) flyTo('honey', hv.x - 10, hv.y - 40, cr.x - 2, cr.y - 30, 0.45 + i*0.1, 24, {}); }
  } else if (t === 'wrap'){
    // V11: a robot that only wraps takes a plain jar out of the crate, wraps it and puts it back as a gift jar
    if (!S.hive.packing || S.hive.jars < 1) return false;
    S.hive.jars--; r.wrapOwn = false; r.workDur = wrapTime(r.id);
    flyTo('jar', crateFor(r).x + rand(-8, 8), crateFor(r).y - 28, P.x + P.face*9, P.y - 30, 0.3, 14, {});
  } else if (t === 'smelt'){
    // metal in its own basket goes straight in the furnace; the hopper makes up the rest (any spare bit goes in the hopper)
    const need = metalPerIngot(), door = { x: PLANT.x + (r.spot - 1)*40, y: PLANT.y - 22 };
    if (r.carryM + S.plant.ore < need - 1e-9 || S.plant.rack + busyIn('smelt') >= RACK_CAP) return false;
    const own = Math.min(r.carryM, need);
    if (own){ r.carryM -= own; if (!r.ore) S.totals.metal += own; if (!r.carryM) r.ore = false; for (let i=0;i<Math.min(own, 3);i++) flyTo('metal', r.x, r.y - 36, door.x, door.y, 0.35 + i*0.07, 16, {}); }
    const rest = need - own;
    if (rest > 0){ S.plant.ore = Math.max(0, S.plant.ore - rest); flyTo('metal', HOPPER.x + 4, HOPPER.y - 40, door.x, door.y, 0.5, 26, {}); }
    r.workDur = smeltTime(r.id);
  } else return false;
  r.st = t; r.workP = 0; return true;
}
function finishWork(r){
  const t = r.st;
  if (t === 'bag'){
    S.bag.bags++; S.totals.bags = (S.totals.bags || 0) + 1;
    flyTo('bag', BAGGER.x + 9, BAGGER.y - 36, BIN.x + 14 + rand(-4, 8), BIN.y - 50, 0.5, 30, {});
    pop(BAGGER.x + 4, BAGGER.y - 70, '+1 bag', 'bag', 15, 0.35);
    { const a = sndAt(BAGGER.x, BAGGER.y); sfx('dump', 3, a.pan, a.vol*0.8); }
  } else if (t === 'jar'){
    S.totals.jars = (S.totals.jars || 0) + 1;
    // V11: a robot that also has Wrap gift jars in its Do list wraps the jar it just filled straight away
    if (S.hive.packing && taskOn(S.robots[r.id], 'wrap')){
      unitDone(r, 'jar'); r.st = 'wrap'; r.wrapOwn = true; r.workP = 0; r.workDur = wrapTime(r.id); return;
    }
    S.hive.jars++; hiveRt.bump = 0.25;
    { const cr = crateFor(r); pop(cr.x, cr.y - 62, '+1 punnet', 'honey', 14); const a = sndAt(cr.x, cr.y); sfx('clink', 1, a.pan, a.vol*0.7); }
  } else if (t === 'wrap'){
    S.hive.gift++; S.totals.gifts = (S.totals.gifts || 0) + 1; hiveRt.bump = 0.25; r.wrapOwn = false;
    { const cr = crateFor(r); pop(cr.x, cr.y - 62, '+1 gift basket', 'gift', 14); const a = sndAt(cr.x, cr.y); sfx('clink', 1, a.pan, a.vol*0.7); }
  } else if (t === 'smelt'){
    S.plant.rack++; S.totals.ingots = (S.totals.ingots || 0) + 1; plantRt.bump = 0.3;
    // slag recovery: the saved-up scraps make a whole extra ingot now and then
    S.plant.slagAcc = (S.plant.slagAcc || 0) + val('slag');
    if (S.plant.slagAcc >= 1 && S.plant.rack < RACK_CAP){ S.plant.slagAcc -= 1; S.plant.rack++; S.totals.ingots++; pop(PLANT.x + (r.spot - 1)*40, PLANT.y - 88, '+1 from offcuts', 'ingot', 13, 0.4); }
    flyTo('ingot', PLANT.x + (r.spot - 1)*40, PLANT.y - 18, RACK.x - 2 + rand(-6, 6), RACK.y - 30, 0.6, 30, {});
    pop(PLANT.x + (r.spot - 1)*40, PLANT.y - 70, '+1 dry bundle', 'ingot', 15);
    { const a = sndAt(PLANT.x, PLANT.y); sfx('tink', a.pan, a.vol*0.8); }
  }
  unitDone(r, t);
  if (Math.random() < 0.08) robotSays(r, 'happy');
  r.st = 'idle';
}
// Called when the robot reaches its patch: top the plan up with any free leaf the fingers can reach, then aim the claw.
function aimClaw(r, h){
  const take = Math.min(rv(r.id, 'grab'), leafCap(r.id) - r.carryL), spread = clawSpread(r.id);
  if (take > r.plan.length && spread > 0){
    const near = [];
    for (const l of leaves){ if (l.claim || !freeLeaf(l, r)) continue; const dx = l.x - h.x, dy = l.y - h.y; if (Math.abs(dx) > spread || Math.abs(dy) > spread) continue; const d = Math.hypot(dx, dy); if (d <= spread) near.push([d, l]); }
    near.sort((a, b) => a[0] - b[0]);
    for (const [, l] of near){ if (r.plan.length >= take) break; l.claim = r; r.plan.push(l); }
  }
  if (r.plan.length > take){ for (const l of r.plan.slice(take)) l.claim = null; r.plan.length = take; }
  const c = centroid(r.plan);
  r.armTo = { x: c.x, y: c.y };
  r.fingers = r.plan.length > 1 ? r.plan.map(l => ({ x: l.x, y: l.y })) : null;
}
function grabLeaves(r){
  const room = leafCap(r.id) - r.carryL;
  const got = (r.plan || []).filter(l => l.st === 'ground' && l.claim === r).slice(0, Math.max(0, room));
  for (const l of got){
    l.st = 'gone'; l.claim = null; r.carryL++;
    flyTo('leaf', l.x, l.y, r.x - r.face*8, r.y - 38, (r.pickDur || 0.5)*0.45 + 0.08 + Math.random()*0.1, 16, { ci:l.ci, sh:l.sh, s:l.s*0.75 });
  }
  for (const l of r.plan || []) if (l.claim === r) l.claim = null;
  r.plan = null;   // the fingers stay drawn while the arm pulls back
  if (got.length){ const a = sndAt(r.x, r.y); sfx('grab', got.length, a.pan, a.vol); }
  if (got.length >= 2) pop(r.x, r.y - 70, '×' + got.length, 'note', 15);
}

function updRobot(r, dt){
  r.moving = false; r.anim += dt;
  r.blinkT -= dt; if (r.blinkT < 0){ r.blink = 0.14; r.blinkT = rand(2, 5); } if (r.blink > 0) r.blink -= dt;
  const sp = robotSpeed(r.id);
  switch (r.st){
    case 'idle': decide(r); break;
    case 'seek': {
      const l = planAlive(r);
      if (!l){ release(r); r.st = 'idle'; break; }
      const reach = rv(r.id, 'reach');
      const d = Math.hypot(l.x - r.x, l.y - r.y);
      if (d <= Math.max(9, reach*0.8)){ r.st = 'pick'; r.pickDur = pickTime(r.id); r.timer = r.pickDur; r.grabbed = false; r.face = l.x >= r.x ? 1 : -1; aimClaw(r, l); break; }
      const k = (d - reach*0.6) / d;
      moveTo(r, r.x + (l.x - r.x)*k, r.y + (l.y - r.y)*k + 1, sp, dt);
      break;
    }
    case 'pick': {
      // the arm reaches out, grabs at full stretch, then pulls back
      r.timer -= dt;
      if (!r.grabbed && r.timer <= r.pickDur*0.45){ r.grabbed = true; grabLeaves(r); }
      if (r.timer <= 0){ if (!r.grabbed) grabLeaves(r); r.armTo = null; r.fingers = null; r.st = 'idle'; }
      break;
    }
    case 'toBin': {
      const p = r.at === 'metal' ? metalTarget(r) : binSpot(r);
      if (moveTo(r, p.x, p.y, sp, dt)){ r.st = 'dump'; r.timer = 0.32; r.face = 1; }
      break;
    }
    case 'dump':
      r.timer -= dt;
      if (r.timer <= 0){
        deposit(r);
        // leaves are in; metal that belongs in the plant's hopper goes on from here
        if (!r.carryL && !r.carryM) r.st = 'idle';
        else if (r.at === 'bin' && !r.carryL) r.st = 'idle';
        else { r.st = 'wait'; r.timer = 0.5; if (Math.random() < 0.5) robotSays(r, 'hmm'); }
      }
      break;
    case 'wait':
      // the bin (or tub, or hopper) is full: keep trying, but go and do something else if there's other work
      r.timer -= dt;
      if (r.timer <= 0){ deposit(r); r.timer = 0.5; if (!r.carryL && !r.carryM && !r.carryI) r.st = 'idle'; else if (robotTask(r)) r.st = 'idle'; }
      break;
    case 'toMine': {
      const m = minerFor(r); if (!m){ r.st = 'idle'; break; }
      if (moveTo(r, m.wx, m.wy, sp, dt)){ r.st = 'mine'; r.face = m.face; }
      break;
    }
    case 'mine': {
      const m = minerFor(r); if (!m){ r.st = 'idle'; r.mineP = 0; break; }
      r.face = m.face; r.hammer += dt;
      r.mineP += dt / drillTimeAt(r.id, m.sp);
      if (!simMode){
        if (Math.random() < dt*9) parts.push({ k:'speck', saw:true, x: r.x + r.face*16 + rand(-3,3), y: r.y - 14 - rand(0,4), vx: rand(-40,40), vy: rand(-60,-15), g: 160, life: rand(.35,.6), t:0 });   // RAINY HOLLOW: sawdust
        if (Math.random() < dt*2.2) parts.push({ k:'dust', x: m.x + rand(-10,10), y: m.y, vx: rand(-8,8), vy: rand(-14,-6), g:0, life: rand(.8,1.4), t:0, r: rand(4,8) });
      }
      if (r.mineP >= 1){
        // the magnet sometimes catches a second chunk (it may ride along one over the basket limit)
        const lucky = Math.random() < doubleChance(r.id), n = lucky ? 2 : 1;
        r.mineP -= 1; r.carryM += n;
        if (lucky){ S.totals.lucky = (S.totals.lucky || 0) + 1; pop(m.x, m.y - 80, '+2 lucky!', 'metal', 17); }
        else pop(m.x, m.y - 76, '+1', 'metal', 15);
        { const a = sndAt(m.x, m.y); sfx('tink', a.pan, a.vol*0.7); if (lucky && !simMode) setTimeout(() => sfx('tink', a.pan, a.vol*0.8), 110); }
        for (let i=0;i<n;i++) flyTo('metal', m.x + i*6, m.y - 4, r.x - 6, r.y - 38, 0.35 + i*0.08, 20 + i*8, {});
        if (r.carryM >= metalCarry(r.id)){ r.st = 'idle'; r.mineP = 0; }
      }
      break;
    }
    case 'toStation': {
      if (r.spot == null || r.spot < 0 || STN[stKey(r.task)] == null || STN[stKey(r.task)][r.spot] !== r.id){ r.st = 'idle'; break; }
      const p = stationPos(r.task, r.spot);
      if (moveTo(r, p.x, p.y, sp, dt)){ if (!beginWork(r)) r.st = 'idle'; }
      break;
    }
    case 'bag': case 'jar': case 'wrap': case 'smelt': {
      r.workP += dt/r.workDur; r.hammer += dt;
      if (!simMode && r.st === 'smelt'){
        const dx = PLANT.x + (r.spot - 1)*40;
        if (Math.random() < dt*7) parts.push({ k:'spark', x: dx + rand(-7,7), y: PLANT.y - 12 - rand(0,10), vx: rand(-30,30), vy: rand(-60,-20), g: 140, life: rand(.25,.5), t:0 });
      }
      if (r.workP >= 1) finishWork(r);
      break;
    }
    case 'toTub': {
      const p = tubSpot(r);
      if (moveTo(r, p.x, p.y, sp, dt)){
        const n = Math.min(metalCarry(r.id), S.binMetal, hopperRoom());
        if (n > 0){ S.binMetal -= n; r.carryM += n; r.ore = true; r.at = 'metal'; r.st = 'toBin'; for (let i=0;i<Math.min(n,4);i++) flyTo('metal', TUB.x, TUB.y - 28, r.x - 6, r.y - 38, 0.3 + i*0.06, 16, {}); }
        else r.st = 'idle';
      }
      break;
    }
    case 'toRack': {
      if (moveTo(r, RACK.x - 4 + (r.id%2)*8, RACK.y + 16, sp, dt)){
        const n = Math.min(ingotCarry(r.id) - r.carryI, S.plant.rack);
        if (n > 0){ S.plant.rack -= n; r.carryI += n; for (let i=0;i<n;i++) flyTo('ingot', RACK.x, RACK.y - 26, r.x - 6, r.y - 38, 0.35 + i*0.08, 16, {}); }
        r.st = r.carryI ? 'toPallet' : 'idle';
      }
      break;
    }
    case 'toPallet': {
      const p = palletSpot(r);
      if (moveTo(r, p.x, p.y, sp, dt)){
        if (r.wetI > 0){
          // RAINY HOLLOW: soaked bundles can't be sold as dry wood: they go back in the log crib as wet wood (two logs each)
          const w = Math.min(r.wetI, r.carryI), logs = Math.min(w*2, tubRoom());
          r.carryI -= w; r.wetI = 0; S.binMetal += logs; S.totals.soaked = (S.totals.soaked || 0) + w;
          pop(PALLET.x - 6, PALLET.y - 64, w + ' got wet', 'wet', 14);
          if (logs > 0){ pop(TUB.x, TUB.y - 60, '+' + logs, 'metal', 15); for (let i=0;i<Math.min(logs, 4);i++) flyTo('metal', r.x, r.y - 36, TUB.x + rand(-8, 8), TUB.y - 28, 0.3 + i*0.06, 20, {}); }
        }
        const n = Math.min(r.carryI, palletRoom());
        if (n > 0){
          S.ingots += n; r.carryI -= n; unitDone(r, 'haul');
          pop(PALLET.x, PALLET.y - 50, '+' + n, 'ingot', 16);
          for (let i=0;i<n;i++) flyTo('ingot', r.x, r.y - 36, PALLET.x + rand(-10, 10), PALLET.y - 22, 0.3 + i*0.07, 18, {});
          { const a = sndAt(PALLET.x, PALLET.y); sfx('clink', n, a.pan, a.vol); }
        }
        if (r.carryI){ r.st = 'waitI'; r.timer = 0.5; } else r.st = 'idle';
      }
      break;
    }
    case 'waitI':
      r.timer -= dt;
      if (r.timer <= 0){ r.timer = 0.5; if (palletRoom() > 0 || robotTask(r)) r.st = 'idle'; }
      break;
    case 'wander': {
      r.look -= dt;
      if (r.look <= 0){ r.look = 0.3; if (robotTask(r)){ r.st = 'idle'; break; } }
      if (moveTo(r, r.wx, r.wy, sp*0.4, dt)){ r.st = 'rest'; r.timer = rand(1, 2.4); }
      break;
    }
    case 'rest': r.timer -= dt; r.look -= dt; if (r.timer <= 0) r.st = 'idle'; else if (r.look <= 0){ r.look = 0.3; if (robotTask(r)) r.st = 'idle'; } break;
  }
  // RAINY HOLLOW: dry bundles out in the rain get wet, one by one, unless a blower holds the wood umbrella over them
  if (r.carryI > (r.wetI || 0) && r.moving && !underRoof(r) && !umbrellaOver(r)){
    const dry = r.carryI - (r.wetI || 0), k = WET_RATE*dt*(rainLevel(S.t)/0.7);
    for (let i=0;i<dry;i++) if (Math.random() < k){ r.wetI = (r.wetI || 0) + 1; if (!simMode){ pop(r.x, r.y - 72, 'soaked!', 'wet', 13); for (let q=0;q<4;q++) parts.push({ k:'drop', x: r.x - r.face*8 + rand(-5, 5), y: r.y - 34, vx: rand(-20, 20), vy: rand(-20, 10), g: 200, life: rand(.4, .7), t: 0 }); } }
  }
  r.full = (r.st === 'wait' || r.st === 'waitI') && (r.carryL > 0 || r.carryM > 0 || r.carryI > 0);
  if (!simMode && STYLES[r.id].dust && r.moving && Math.random() < dt*2.5) parts.push({ k:'dust', x: r.x - r.face*10, y: r.y - 2, vx: -r.face*rand(4,12), vy: rand(-10,-4), g:0, life: rand(.6,1), t:0, r: rand(2.5,4.5) });
}

function deposit(r){
  if (r.carryL > 0 && r.at !== 'metal'){
    const n = Math.min(r.carryL, Math.floor(binRoom()));
    if (n > 0){
      S.binLeaves += n; r.carryL -= n; S.totals.leaves += n; unitDone(r, 'leaves');
      pop(BIN.x - 8, BIN.y - 74, '+' + n, 'leaf', 19);
      for (let i=0;i<Math.min(n,6);i++) flyTo('leaf', r.x, r.y - 36, BIN.x + rand(-20,20), BIN.y - 46, 0.32 + i*0.05, 26, { ci: pickColor(), sh: Math.random()<.5?1:0, s: 5 });
      bumpBin = 0.25;
      { const a = sndAt(BIN.x, BIN.y); sfx('dump', n, a.pan, a.vol); if (Math.random() < 0.12) robotSays(r, Math.random() < .6 ? 'happy' : 'chat'); }
    }
  }
  if (r.carryM > 0 && S.metalSlot){
    const tgt = metalTarget(r);
    // standing at the bin with leaves, metal only goes in too if the tub (right beside it) is where it belongs
    if (r.at === 'metal' || !tgt.hopper){
      const n = tgt.hopper ? Math.min(r.carryM, hopperRoom()) : r.ore ? 0 : Math.min(r.carryM, tubRoom());
      if (n > 0){
        r.carryM -= n;
        if (!r.ore){ S.totals.metal += n; unitDone(r, 'mine'); }
        if (tgt.hopper){
          S.plant.ore += n; pop(HOPPER.x, HOPPER.y - 66, '+' + n, 'metal', 17);
          for (let i=0;i<Math.min(n,5);i++) flyTo('metal', r.x, r.y - 36, HOPPER.x + rand(-6,6), HOPPER.y - 44, 0.3 + i*0.05, 22, {});
          { const a = sndAt(HOPPER.x, HOPPER.y); sfx('clink', n, a.pan, a.vol); }
        } else {
          S.binMetal += n; pop(TUB.x, TUB.y - 60, '+' + n, 'metal', 19);
          for (let i=0;i<Math.min(n,5);i++) flyTo('metal', r.x, r.y - 36, TUB.x + rand(-8,8), TUB.y - 28, 0.3 + i*0.05, 22, {});
          { const a = sndAt(TUB.x, TUB.y); sfx('clink', n, a.pan, a.vol); }
        }
        if (!r.carryM) r.ore = false;
      }
    }
  }
}

// ───────────────────────── helper robots: blowers and shakers
// Blowers (half robot vacuum, half elephant) look for leaves far from the bin and blow them toward it.
// Shakers (little crabs with big claws) shake trees and bushes on your land so more leaves come down.
// Neither one carries anything, so they never visit the bin.
let HB = [];
const BIN_MOUTH = { x: BIN.x + 18, y: BIN.y - 84 };   // where blowers aim: just above the bin, where leaves can still land
const SHAKE_COOLDOWN = 15;                           // seconds before a shaker can shake the same tree or bush again (hidden)
const shakeCD = { tree: TREES.map(() => 0), bush: BUSHES.map(() => 0), flower: [] };
const bushShake = BUSHES.map(() => 0);
function newHelper(kind, idx){
  return { kind, idx, x: SHED.x + 34 + rand(-6, 6), y: SHED.y + 14, st:'idle', face:1, anim: Math.random()*5, moving:false, timer:0,
    tx:0, ty:0, dir:{ x:0, y:-1 }, blowT:0, quiet:0, target:null, blinkT: rand(1, 4), blink:0, puffT:0, dropped:false,
    task:null, lastTask:null, streak:0, dig:null, digT:0 };
}
function syncHelpers(){
  for (const kind of ['blower', 'shaker']){
    const n = cfgsOf(kind).length;
    for (let i = HB.filter(h => h.kind === kind).length; i < n; i++) HB.push(newHelper(kind, i));
  }
}
const helperCfg = h => cfgsOf(h.kind)[h.idx];
const hv = (h, k) => TRACKS[k].vals[helperCfg(h).lv[k]];
const helperSpeed = h => (h.kind === 'blower' ? 50 : 62) * hv(h, 'speed') * (1 + 0.2*gl('oil'));
const blowPower = h => hv(h, 'blow');
const blowRange = h => 40 + 16*blowPower(h);
// V7: big trees let go of more than small ones (a tree of radius 150 gives the full amount), so the little trees on the
// cottage plot can't keep a big crew busy for ever; bushes give a third
const BUSH_YIELD = 0.33;
const treeYieldMul = t => clamp(t.r/150, 0.3, 1.25);
const shakeYield = (h, bush, tree) => { const v = hv(h, 'shake'); return bush ? Math.max(2, Math.round(v*BUSH_YIELD)) : Math.max(2, Math.round(v*(tree ? treeYieldMul(tree) : 1))); };
const helperStyle = h => (h.kind === 'blower' ? BLOWER_STYLES : SHAKER_STYLES)[h.idx];
function helperSays(h, mood){ const a = sndAt(h.x, h.y); sfx('beep', h.kind === 'blower' ? 5 : 6, mood, a.pan, a.vol*0.8); }
// trees whose trunk stands on your land, and your bushes
function shakeables(){
  const O = owned(), out = [];
  TREES.forEach((t, i) => { const by = trunkBase(t); if (t.x > O.x0 + 12 && t.x < O.x1 - 12 && by > O.y0 + 12 && by < O.y1) out.push({ type:'tree', i, x: t.x, y: by + 7 }); });
  BUSHES.forEach((b, i) => { if (b.x > O.x0 && b.x < O.x1 && b.y > O.y0 && b.y < O.y1) out.push({ type:'bush', i, x: b.x, y: b.y + 10*b.s }); });
  return out;
}
const tooManyLeaves = () => groundN >= AREAS[S.land].cap*1.6;
function helperWander(h, rx, ry){
  const O = owned();
  h.tx = clamp(h.x + rand(-rx, rx), O.x0 + 20, O.x1 - 20); h.ty = clamp(h.y + rand(-ry, ry), O.y0 + 20, O.y1 - 4); h.st = 'wander';
}

// Blowers sweep like a robot vacuum. They drive laps around the outside of your land (a ∩: up one side, across the
// top, down the other), blowing toward the bin the whole way and nudging the leaves right beside them too. Each lap
// turns round and runs one step further in, so the leaves get herded inward lap by lap and nothing is left out in
// the far corners. A lap whose band holds hardly any leaves is skipped; after the innermost lap they start outside again.
const lapStep = h => 24 + 0.6*blowRange(h);
function lapGeo(h, k){
  const O = owned(), m = 22 + k*lapStep(h);
  const xl = O.x0 + m, xr = O.x1 - m, yt = O.y0 + m;
  if (xr - xl < 170 || yt > BIN_MOUTH.y - 60) return null;          // that's the middle: done
  const bottom = xl > -150 ? BIN_MOUTH.y + 6 : O.y1 - 24;            // inner laps stop short of the bin
  return { xl, xr, yt, bottom, m };
}
// how many free leaves lie in a lap's band (distance in from the left, right or top fence)
function lapLeaves(h, k){
  const O = owned(), g = lapGeo(h, k); if (!g) return -1;
  const st = lapStep(h); let n = 0;
  for (const l of leaves){
    if (l.st !== 'ground' || !l.collect) continue;
    const e = Math.min(l.x - O.x0, O.x1 - l.x, l.y - O.y0);
    if (e > g.m - st*0.9 && e < g.m + st*0.6 && l.y < g.bottom + 30) n++;
  }
  return n;
}
// the next lap with leaves in it (inward from the last one, wrapping round to the outside), or null if there's none
function blowLap(h){
  const taken = k => HB.some(q => q !== h && q.kind === 'blower' && q.st === 'lap' && q.lap === k);
  let k = h.lap == null ? h.idx*2 : h.lap + 1, tries = 0, wrapped = h.lap == null;
  for (;;){
    if (tries++ > 40) return null;
    const n = lapLeaves(h, k);
    if (n < 0){ if (wrapped && k === 0) return null; k = 0; wrapped = true; continue; }
    if (n >= 2 && !taken(k)) return k;
    k++;
  }
}
function blowStart(h, k){
  const g = lapGeo(h, k);
  h.lap = k; h.lapDir = h.lapDir ? -h.lapDir : 1;
  const pts = [{ x:g.xl, y:g.bottom }, { x:g.xl, y:g.yt }, { x:g.xr, y:g.yt }, { x:g.xr, y:g.bottom }];
  // start from whichever end is nearer, like a roomba turning round at the end of a row
  const a = Math.hypot(pts[0].x - h.x, pts[0].y - h.y), b = Math.hypot(pts[3].x - h.x, pts[3].y - h.y);
  h.path = a <= b ? pts : pts.reverse(); h.pi = 0; h.st = 'go'; h.tx = h.path[0].x; h.ty = h.path[0].y;
}
// Excavating (V6): a blower parks by a mine shaft where a robot is mining and sucks the loose dirt out of the hole,
// so the robots mining there work faster. One blower per shaft.
const DIG_STINT = 10;
function digTarget(h){
  let best = null, bd = 1e18;
  for (const sp of S.shafts){
    if (!S.miners.includes(sp)) continue;
    if (!R.some(r => S.robots[r.id] && S.robots[r.id].miner === sp && (r.st === 'mine' || r.st === 'toMine'))) continue;
    if (HB.some(q => q !== h && q.kind === 'blower' && q.dig === sp && (q.st === 'dig' || (q.st === 'go' && q.task === 'dig')))) continue;
    const p = SPOTS[sp], d = Math.hypot(p.x - h.x, p.y - h.y);
    if (d < bd){ bd = d; best = sp; }
  }
  return best;
}
const digSpot = sp => ({ x: SPOTS[sp].x + 38, y: SPOTS[sp].y + 18 });
const SHAFT_HOLE = sp => ({ x: SPOTS[sp].x + 4, y: SPOTS[sp].y + 1 });
// pushes leaves toward the bin: a short cone in front of the hose, plus anything right beside the blower
function blowLeaves(h, dt){
  const R0 = blowRange(h), P = blowPower(h), acc = 170*Math.pow(P, 0.8), cap = 40 + 20*P, glideD = 30 + 28*P;
  const ox = h.x, oy = h.y - 4;
  let n = 0;
  for (const l of leaves){
    if (l.st !== 'ground' || !l.collect || l.claim) continue;
    const vx = l.x - ox, vy = l.y - oy;
    if (Math.abs(vx) > R0 + 4 || Math.abs(vy) > R0 + 4) continue;
    const tx = BIN_MOUTH.x - l.x, ty = BIN_MOUTH.y - l.y, td = Math.hypot(tx, ty);
    if (td < 50) continue;   // close enough: the robots take it from here
    const along = vx*h.dir.x + vy*h.dir.y, perp = Math.abs(vx*h.dir.y - vy*h.dir.x), d = Math.hypot(vx, vy);
    const cone = along > -4 && along < R0 && perp < 14 + along*0.7, beside = d < 24 + 6*P;
    if (!cone && !beside) continue;
    const f = acc*dt*(cone ? 1 - 0.4*Math.max(0, along)/R0 : 0.75);
    l.kx += (tx/td*0.7 + h.dir.x*0.3)*f; l.ky += (ty/td*0.7 + h.dir.y*0.3)*f;
    // once blown, the leaf keeps skimming toward the bin for a while even after the blower has driven on
    l.glide = 1; l.glideV = Math.max(l.glideV || 0, cap*0.7); l.glideD = Math.max(l.glideD || 0, glideD);
    const sp = Math.hypot(l.kx, l.ky); if (sp > cap){ l.kx *= cap/sp; l.ky *= cap/sp; }
    if (!l.blown){ l.blown = true; S.totals.blown = (S.totals.blown || 0) + 1; }
    n++;
  }
  return n;
}
function blowAir(h, dt){
  // soft air: faint curling wind lines and a few bits of grass, not a jet
  h.puffT -= dt;
  if (h.puffT > 0) return;
  h.puffT = 0.11;
  const nz = trunkTip(h), j = rand(-0.55, 0.55), c = Math.cos(j), s = Math.sin(j), vx = h.dir.x*c - h.dir.y*s, vy = h.dir.x*s + h.dir.y*c, v = rand(55, 85);
  parts.push({ k:'air', x: nz.x + vx*4, y: nz.y + vy*4, vx: vx*v, vy: vy*v*0.8, g:0, life: rand(.45, .75)*(0.7 + blowRange(h)/150), t:0, curl: rand(-1, 1), len: rand(7, 12) });
  if (Math.random() < 0.35) parts.push({ k:'speck', x: nz.x, y: nz.y, vx: vx*v*1.1 + rand(-10, 10), vy: vy*v*0.9 - rand(4, 14), g: 40, life: rand(.3, .55), t:0 });
}

// Deadheading: snip off a spent flower and a fresh one pops up for the bees right away. Each flower then has the
// same hidden cooldown as a tree before a shaker will cut it again. The most worthwhile flowers are the ones that
// have the longest wait left before they would bloom on their own.
const SNIP_TIME = 0.9;
function snipTarget(h){
  const sp = helperSpeed(h);
  let best = null, bs = 0;
  FLOWERS.forEach((f, i) => {
    if (f.full || !flowerOn(f) || shakeCD.flower[i] > 0) return;
    const left = (f.regrow - f.t)/regrowMul(); if (left < 6) return;
    if (HB.some(q => q !== h && q.target && q.target.type === 'flower' && q.target.i === i)) return;
    const d = Math.hypot(f.x - 16 - h.x, f.y + 3 - h.y), sc = left/(d/sp + SNIP_TIME + 1.5);
    if (sc > bs){ bs = sc; best = { type:'flower', i, x: f.x - 15, y: f.y + 3 }; }
  });
  return best;
}
function shakeTarget(h){
  if (tooManyLeaves()) return null;
  const sp = helperSpeed(h);
  let best = null, bs = -1;
  for (const o of shakeables()){
    if (shakeCD[o.type][o.i] > 0) continue;
    if (HB.some(q => q !== h && q.target && q.target.type === o.type && q.target.i === o.i)) continue;
    const d = Math.hypot(o.x - h.x, o.y - h.y), worth = o.type === 'tree' ? treeYieldMul(TREES[o.i]) : BUSH_YIELD, sc = worth/(d/sp + 2);
    if (sc > bs){ bs = sc; best = o; }
  }
  return best;
}
// RAINY HOLLOW: carrying the wood umbrella. A blower with the task walks beside the hauler carrying the most dry wood
// that nobody else is covering; with nobody hauling it waits by the shelf of dry bundles (-1). Null: no haulers at all.
function brollyTarget(h){
  if (!S.plant.built) return null;
  const taken = id => HB.some(q => q !== h && q.kind === 'blower' && q.st === 'brolly' && q.brolly === id);
  let best = null, bs = -1;
  for (const r of R){
    if (r.carryI <= 0 || (r.st !== 'toPallet' && r.st !== 'toRack' && r.st !== 'waitI') || taken(r.id)) continue;
    const sc = (r.carryI - (r.wetI || 0))*10 - Math.hypot(r.x - h.x, r.y - h.y)*0.01;
    if (sc > bs){ bs = sc; best = r.id; }
  }
  if (best != null) return best;
  return S.robots.some(c => taskOn(c, 'haul')) ? -1 : null;
}
const umbrellaOver = r => HB.some(h => h.kind === 'blower' && h.st === 'brolly' && h.brolly === r.id && Math.hypot(h.x - r.x, h.y - r.y) < 36);
// dry wood stays dry under the shed's roof, and under the woodshed's by the road
const underRoof = r => (Math.abs(r.x - PLANT.x) < 120 && r.y > PLANT.y - 30 && r.y < PLANT.y + 40) || Math.hypot(r.x - PALLET.x, r.y - PALLET.y) < 36;
// how fast a dry bundle gets soaked out in the open (per bundle per second, at an average rain; heavier rain, faster)
const WET_RATE = 0.032;
// helpers follow their own priority list too: blowers pick between blowing and excavating, shakers between shaking and deadheading
function helperWork(h, t){
  if (t === 'blow') return h.kind === 'blower' ? blowLap(h) : null;
  if (t === 'dig') return h.kind === 'blower' ? digTarget(h) : null;
  if (t === 'stoke') return h.kind === 'blower' && S.plant.built && R.some(r => r.st === 'smelt' || (r.st === 'toStation' && r.task === 'smelt')) && !HB.some(q => q !== h && q.kind === 'blower' && (q.st === 'stoke' || (q.st === 'go' && q.task === 'stoke'))) ? 1 : null;
  if (t === 'brolly') return h.kind === 'blower' ? brollyTarget(h) : null;
  if (t === 'shake') return h.kind === 'shaker' ? shakeTarget(h) : null;
  if (t === 'snip') return h.kind === 'shaker' && S.hive.built ? snipTarget(h) : null;
  return null;
}
function helperDecide(h){
  const cfg = helperCfg(h), found = {};
  const t = chooseTask(h, cfg, x => { const w = helperWork(h, x); if (w == null) return false; found[x] = w; return true; });
  h.task = t; noteTask(h, t);
  if (t !== 'dig') h.dig = null;
  if (!t){ h.target = null; h.lap = null; helperWander(h, h.kind === 'blower' ? 60 : 50, h.kind === 'blower' ? 40 : 30); return; }
  if (t === 'blow'){ blowStart(h, found.blow); return; }
  if (t === 'dig'){ const sp = found.dig, p = digSpot(sp); h.dig = sp; h.tx = p.x; h.ty = p.y; h.st = 'go'; return; }
  if (t === 'stoke'){ h.tx = STOKE_SPOT.x; h.ty = STOKE_SPOT.y; h.st = 'go'; return; }
  if (t === 'brolly'){ h.brolly = found.brolly; h.st = 'brolly'; h.timer = 0.4; h.digT = 0; return; }
  h.target = found[t]; h.st = 'go';
}
// the shake itself: a few leaves let go of the tree (or pop out of the bush) and land around it
function shakeDrop(h, o){
  if (tooManyLeaves()) return 0;
  const bush = o.type === 'bush', n = shakeYield(h, bush, bush ? null : TREES[o.i]);
  let made = 0;
  if (!bush){
    const t = TREES[o.i], spots = treeDropSpots(t);
    if (!spots.length) return 0;
    for (let k=0;k<n;k++){
      const p = spots[Math.floor(Math.random()*spots.length)], x = p.x + rand(-5, 5), ly = p.y + rand(-3, 3);
      if (!landingOK(x, ly)) continue;
      const fall = rand(50, 150), l = newLeaf(x, ly - fall, ly, true);
      l.vy = rand(45, 70); l.sw = rand(6, 14); l.x -= wind*l.wf*fall/l.vy;
      if (simMode){ l.x = x; l.y = ly; l.st = 'ground'; } else l.y -= rand(0, 1.1)*l.vy;
      leaves.push(l); made++;
    }
    treeShake[o.i] = Math.max(treeShake[o.i], 1.2);
  } else {
    const b = BUSHES[o.i];
    for (let k=0, tries=0; k<n && tries<n*6; tries++){
      const a = rand(0, TAU), x = b.x + Math.cos(a)*rand(40, 58)*b.s, ly = b.y - 6*b.s + Math.sin(a)*rand(18, 28)*b.s;
      if (!landingOK(x, ly)) continue;
      const fall = rand(22, 40)*b.s, l = newLeaf(x, ly - fall, ly, true);   // shaken out of the bush, landing around it
      l.vy = rand(30, 50); l.sw = rand(4, 10); l.x -= wind*l.wf*fall/l.vy;
      if (simMode){ l.x = x; l.y = ly; l.st = 'ground'; }
      leaves.push(l); made++; k++;
    }
    bushShake[o.i] = 1.1;
  }
  S.totals.shakes = (S.totals.shakes || 0) + 1;
  if (!simMode && made){
    const p = bush ? { x: BUSHES[o.i].x, y: BUSHES[o.i].y - 40 } : { x: TREES[o.i].x, y: TREES[o.i].y - TREES[o.i].r*0.4 };
    pop(p.x, p.y, '+' + made, 'leaf', 15);
    const a = sndAt(p.x, p.y); sfx('kick', bush ? 5 : 9, a.pan);
    if (Math.random() < 0.3) helperSays(h, 'happy');
  }
  return made;
}

function updHelper(h, dt){
  h.moving = false; h.anim += dt;
  h.blinkT -= dt; if (h.blinkT < 0){ h.blink = 0.14; h.blinkT = rand(2, 5); } if (h.blink > 0) h.blink -= dt;
  const sp = helperSpeed(h);
  switch (h.st){
    case 'idle': helperDecide(h); break;
    case 'go': {
      if (h.kind === 'shaker' && h.target && (shakeCD[h.target.type][h.target.i] > 0 || (h.target.type === 'flower' && FLOWERS[h.target.i].full))){ h.target = null; h.st = 'idle'; break; }
      if (h.kind === 'blower' && h.task === 'dig' && (h.dig == null || !S.shafts.includes(h.dig))){ h.st = 'idle'; break; }
      const to = h.kind === 'shaker' ? h.target : { x: h.tx, y: h.ty };
      if (!to){ h.st = 'idle'; break; }
      if (moveTo(h, to.x, to.y, sp, dt)){
        if (h.kind === 'blower' && h.task === 'dig'){ h.st = 'dig'; h.digT = DIG_STINT; h.face = -1; h.puffT = 0; }
        else if (h.kind === 'blower' && h.task === 'stoke'){ h.st = 'stoke'; h.digT = DIG_STINT; h.face = -1; h.puffT = 0; }
        else if (h.kind === 'blower'){ h.st = 'lap'; h.pi = 1; h.puffT = 0; }
        else if (h.target.type === 'flower'){ h.st = 'snip'; h.timer = SNIP_TIME; h.dropped = false; }
        else { h.st = 'shake'; h.timer = h.target.type === 'tree' ? 1.7 : 1.2; h.dropped = false; shakeCD[h.target.type][h.target.i] = SHAKE_COOLDOWN; }
      }
      break;
    }
    case 'lap': {
      // follow the lap, always blowing toward the bin; it drives backwards when it has to, nose to the bin
      const p = h.path[h.pi], dx = BIN_MOUTH.x - h.x, dy = BIN_MOUTH.y - h.y, d = Math.hypot(dx, dy) || 1;
      h.dir = { x: dx/d, y: dy/d };
      const n = blowLeaves(h, dt);
      if (moveTo(h, p.x, p.y, sp*0.85, dt)){ h.pi++; if (h.pi >= h.path.length){ h.st = 'idle'; unitDone(h, 'blow'); } }
      h.face = dx >= 0 ? 1 : -1;
      if (!simMode){ blowAir(h, dt); if (Math.random() < dt*0.8){ const a = sndAt(h.x, h.y); sfx('kick', n ? 2 : 0, a.pan); } }
      break;
    }
    case 'shake': {
      h.timer -= dt;
      const total = h.target.type === 'tree' ? 1.7 : 1.2;
      if (h.target.type === 'tree') treeShake[h.target.i] = Math.max(treeShake[h.target.i], 0.5); else bushShake[h.target.i] = Math.max(bushShake[h.target.i], 0.5);
      if (!h.dropped && h.timer <= total - 0.45){ h.dropped = true; shakeDrop(h, h.target); }
      if (h.timer <= 0){ h.target = null; h.st = 'rest'; h.timer = rand(0.3, 0.8); unitDone(h, 'shake'); }
      break;
    }
    case 'stoke': {
      // blowing into the intake grate under the furnaces: the doors glow brighter and every smelter works faster
      h.digT -= dt; h.face = -1;
      if (!S.plant.built || !R.some(r => r.st === 'smelt' || (r.st === 'toStation' && r.task === 'smelt'))){ h.st = 'idle'; unitDone(h, 'stoke'); break; }
      if (!simMode){
        h.puffT -= dt;
        if (h.puffT <= 0){
          h.puffT = 0.09;
          const tip = trunkTip(h), dx = PLANT_VENT.x - tip.x, dy = PLANT_VENT.y - tip.y, d = Math.hypot(dx, dy) || 1, v = rand(55, 80);
          parts.push({ k:'air', x: tip.x, y: tip.y, vx: dx/d*v, vy: dy/d*v, g:0, life: rand(.3, .45), t:0, curl: rand(-1, 1), len: rand(6, 10) });
          if (Math.random() < 0.3) parts.push({ k:'spark', x: PLANT.x + rand(-40, 40), y: PLANT.y - 10 - rand(0, 8), vx: rand(-30, 30), vy: rand(-70, -30), g: 140, life: rand(.3, .5), t:0 });
        }
        if (Math.random() < dt*0.6){ const a = sndAt(h.x, h.y); sfx('kick', 1, a.pan); }
      }
      if (h.digT <= 0){ h.st = 'idle'; unitDone(h, 'stoke'); }
      break;
    }
    case 'dig': {
      // parked by the shaft with its hose down the hole: dirt and dust fly up the hose, and now and then a bit of metal
      h.digT -= dt; h.face = -1;
      const sp = h.dig;
      if (sp == null || !S.shafts.includes(sp) || !R.some(r => S.robots[r.id] && S.robots[r.id].miner === sp && (r.st === 'mine' || r.st === 'toMine' || r.st === 'toBin' || r.st === 'dump'))){ h.st = 'idle'; h.dig = null; unitDone(h, 'dig'); break; }
      if (!simMode){
        const hole = SHAFT_HOLE(sp), tip = trunkTip(h);
        h.puffT -= dt;
        if (h.puffT <= 0){
          h.puffT = 0.07;
          flyTo('dirt', hole.x + rand(-9, 9), hole.y + rand(-3, 2), tip.x + rand(-1, 1), tip.y + rand(-1, 1), rand(0.25, 0.45), rand(4, 12), { s: rand(1.2, 2.4), col: Math.random() < 0.5 ? '#6b4a2e' : '#8a6a44' });
          if (Math.random() < 0.35) parts.push({ k:'dust', x: hole.x + rand(-10, 10), y: hole.y - 2, vx: rand(-6, 6), vy: rand(-22, -10), g:0, life: rand(.7,1.2), t:0, r: rand(3,6) });
          if (Math.random() < 0.05){ const cart = { x: SPOTS[sp].x + 30, y: SPOTS[sp].y - 18 }; flyTo('metal', hole.x, hole.y - 4, cart.x + rand(-4, 4), cart.y, 0.55, 26, {}); }
        }
        if (Math.random() < dt*0.6){ const a = sndAt(h.x, h.y); sfx('kick', 1, a.pan); }
      }
      if (h.digT <= 0){ h.st = 'idle'; unitDone(h, 'dig'); }
      break;
    }
    case 'snip': {
      h.timer -= dt;
      const f = FLOWERS[h.target.i];
      if (!h.dropped && h.timer <= SNIP_TIME*0.45){
        h.dropped = true;
        if (!f.full){
          f.full = true; f.t = 0; f.bob = 0.5; shakeCD.flower[h.target.i] = SHAKE_COOLDOWN;
          S.totals.snips = (S.totals.snips || 0) + 1;
          if (!simMode){
            const hy = f.y - flowerHead(f);
            for (let k=0;k<5;k++) parts.push({ k:'petal', x: f.x + rand(-3, 3), y: hy + rand(-2, 2), vx: rand(-26, 26), vy: rand(-40, -10), g: 90, life: rand(.6, 1), t: 0, col: '#8a7a4a' });
            if (Math.random() < 0.35) pop(f.x, hy - 16, 'snip!', 'note', 13);
            const a = sndAt(f.x, f.y); sfx('grab', 1, a.pan, a.vol*0.6);
          }
        }
      }
      if (h.timer <= 0){ h.target = null; h.st = 'rest'; h.timer = rand(0.15, 0.4); unitDone(h, 'snip'); }
      break;
    }
    case 'brolly': {
      // RAINY HOLLOW: walking beside a hauler with the big wooden umbrella held over it (and over the dry wood)
      let r = h.brolly >= 0 ? R[h.brolly] : null;
      h.timer -= dt;
      if (r && r.carryI <= 0 && r.st !== 'toRack'){ unitDone(h, 'brolly'); r = null; h.brolly = -1; h.timer = 0; }
      if (h.timer <= 0){
        h.timer = 0.4;
        if (!r){ const w = brollyTarget(h); if (w == null){ h.st = 'idle'; h.brolly = null; break; } h.brolly = w; r = w >= 0 ? R[w] : null; }
        if (!r && (h.digT += 0.4) > 12){ h.st = 'idle'; h.brolly = null; break; }   // nobody hauling for a while: look at the list again
      }
      if (r){
        h.digT = 0;
        const tx = r.x - r.face*15, ty = r.y + 7, spd = Math.max(sp, robotSpeed(r.id)*1.2);
        moveTo(h, tx, ty, spd, dt); if (Math.hypot(tx - h.x, ty - h.y) < 4) h.face = r.face;
      } else { const w = { x: RACK.x + 34, y: RACK.y + 28 }; if (moveTo(h, w.x, w.y, sp, dt)) h.face = -1; }
      break;
    }
    case 'wander': if (moveTo(h, h.tx, h.ty, sp*0.4, dt)){ h.st = 'rest'; h.timer = rand(1.2, 2.6); } break;
    case 'rest': h.timer -= dt; if (h.timer <= 0) h.st = 'idle'; break;
  }
}
function updShakeTimers(dt){
  for (const k of ['tree', 'bush', 'flower']){ const a = shakeCD[k]; for (let i=0;i<a.length;i++) if (a[i] > 0) a[i] -= dt; }
  for (let i=0;i<bushShake.length;i++) if (bushShake[i] > 0) bushShake[i] = Math.max(0, bushShake[i] - dt);
}

// ───────────────────────── truck
function updTruck(dt){
  const T = truck, V = visRect();
  if (T.st === 'away'){
    S.truckT -= dt;
    if (S.truckT <= 0){ T.st = 'arrive'; T.x = Math.max(V.x1 + 110, PARK + 200); T.fill = 0; sfx('truckIn', sndAt(PARK + 30, LANE).pan, 2.6); }
  } else if (T.st === 'arrive'){
    const dx = T.x - PARK, v = Math.max(34, dx*2.1);
    const mv = Math.min(dx, v*dt); T.x -= mv; T.rot -= mv/10;
    puffExhaust(T, dt, 1);
    if (dx <= 0.6){
      T.x = PARK; T.st = 'load'; T.timer = 2.3;
      // the truck leaves behind what's under the keep lines (loose leaves for bagging, metal for smelting)
      T.takeL = Math.max(0, S.binLeaves - keepLeaves()); T.takeM = Math.max(0, S.binMetal - keepMetal()); S.binLeaves -= T.takeL; S.binMetal -= T.takeM;
      T.takeB = S.bag.bags; S.bag.bags = 0; T.takeI = S.ingots; S.ingots = 0;
      T.takeH = Math.max(0, (S.hive.jars | 0) - keepJars()); S.hive.jars -= T.takeH;
      T.takeG = S.hive.gift | 0; S.hive.gift = 0;
      if (T.takeH || T.takeG){ const a = sndAt(CRATE.x, CRATE.y); sfx('clink', T.takeH + T.takeG, a.pan, a.vol); for (let i=0;i<Math.min(T.takeH + T.takeG, 10);i++) flyTo(i < T.takeG ? 'gift' : 'jar', CRATE.x + rand(-12, 12), CRATE.y - 30, T.x + rand(0,58), LANE - 64, 0.7 + i*0.08, 70, {}); }
      for (let i=0;i<Math.min(T.takeB, 8);i++) flyTo('bag', BIN.x + rand(0, 22), BIN.y - 50, T.x + rand(0,58), LANE - 64, 0.55 + i*0.09, 55, {});
      for (let i=0;i<Math.min(T.takeI, 10);i++) flyTo('ingot', PALLET.x + rand(-10, 10), PALLET.y - 20, T.x + rand(0,58), LANE - 64, 0.6 + i*0.08, 55, {});
      { const a = sndAt(PARK + 30, LANE); sfx('horn', a.pan); sfx('pour', T.takeL, T.takeM, sndAt(BIN.x, BIN.y).pan); }
      for (let i=0;i<Math.min(T.takeL, 26);i++) flyTo('leaf', BIN.x + rand(-22,22), BIN.y - 44, T.x + rand(0,58), LANE - 64, 0.5 + i*0.055, 50, { ci: pickColor(), sh: Math.random()<.5?1:0, s: 5.5 });
      for (let i=0;i<Math.min(T.takeM, 10);i++) flyTo('metal', TUB.x, TUB.y - 26, T.x + rand(0,58), LANE - 64, 0.55 + i*0.08, 55, {});
    }
  } else if (T.st === 'load'){
    T.timer -= dt;
    const any = T.takeL + T.takeM + T.takeH + T.takeB + T.takeI + T.takeG;
    T.fill = any > 0 ? clamp((2.3 - T.timer)/1.8, 0, 1) * clamp((T.takeL + T.takeB*BAG_SIZE + T.takeM*3 + T.takeI*8 + (T.takeH + T.takeG)*2)/80, 0.25, 1) : 0;
    puffExhaust(T, dt, 0.25);
    if (T.timer <= 0){
      let amt = T.takeL*leafPrice() + T.takeB*bagPrice() + T.takeM*metalPrice() + T.takeI*ingotPrice() + T.takeH*honeyPrice() + T.takeG*giftJarPrice(), bonus = 0;
      // balance tests (tools/balance-player.js): during a sim, window.__src adds up what each kind of thing sold for
      if (simMode && window.__src){ const W = window.__src; W.leaf += T.takeL*leafPrice(); W.bag += T.takeB*bagPrice(); W.metal += T.takeM*metalPrice(); W.ingot += T.takeI*ingotPrice(); W.jar += T.takeH*honeyPrice(); W.gift += T.takeG*giftJarPrice(); W.nL += T.takeL + T.takeB*BAG_SIZE; W.nM += T.takeM; W.nI += T.takeI; W.nJ += T.takeH + T.takeG; }
      // the cleanup program pays a lump sum for every 100 leaves the truck has taken (bagged ones count too)
      const nL = T.takeL + T.takeB*BAG_SIZE;
      if (S.lv.cleanup && nL){ S.cleanN = (S.cleanN || 0) + nL; while (S.cleanN >= 100){ S.cleanN -= 100; bonus += cleanupBonus(); } amt += bonus; if (simMode && window.__src) window.__src.clean += bonus; }
      if (bonus && !simMode) setTimeout(() => sfx('chime', 'sale'), 500);
      if (any > 0){
        S.totals.trucks++;
        if (simMode){ S.cash += amt; S.totals.cash += amt; T.st = 'leave'; T.v = 10; }
        else {
          // What each thing made pops up over the place it came from (orange leaves at the bin, grey metal at the tub and
          // the pallet, yellow honey at the crate), then the numbers fly into the truck, and only then the total shows.
          const sale = [], plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
          if (T.takeL || T.takeB) sale.push({ res:'leaf', icon: T.takeB && !T.takeL ? 'bag' : 'leaf', v: T.takeL*leafPrice() + T.takeB*bagPrice(), x: BIN.x, y: -96, sub: [T.takeL ? plural(T.takeL, 'leaf', 'leaves') : '', T.takeB ? plural(T.takeB, 'bag', 'bags') : ''].filter(Boolean).join(' + ') });
          if (T.takeM) sale.push({ res:'metal', icon:'metal', v: T.takeM*metalPrice(), x: TUB.x, y: -96, sub: T.takeM + ' wet wood' });
          if (T.takeI) sale.push({ res:'metal', icon:'ingot', v: T.takeI*ingotPrice(), x: PALLET.x, y: -96, sub: plural(T.takeI, 'ingot', 'ingots') });
          if (T.takeH || T.takeG) sale.push({ res:'honey', icon: T.takeG && !T.takeH ? 'gift' : 'jar', v: T.takeH*honeyPrice() + T.takeG*giftJarPrice(), x: CRATE.x, y: -96, sub: [T.takeH ? plural(T.takeH, 'jar', 'jars') : '', T.takeG ? plural(T.takeG, 'gift basket', 'gift baskets') : ''].filter(Boolean).join(' + ') });
          if (bonus) sale.push({ res:'bonus', icon:'bonus', v: bonus, x: SIGN.x, y: SIGN.y - 90, sub: 'cleanup bonus!' });
          sale.sort((a, b) => a.x - b.x);
          const tx = T.x + 26, ty = LANE - 70;
          sale.forEach((q, n) => {
            pops.push({ kind:'sale', x: q.x, y: q.y, oy: 0, tx, ty, text: '+' + cash2(q.v), sub: q.sub, res: q.res, icon: q.icon, size: 19, t: -n*SALE_STEP, life: SALE_HOLD + SALE_FLY });
          });
          T.st = 'pay'; T.timer = (sale.length - 1)*SALE_STEP + SALE_HOLD + SALE_FLY + 0.05; T.payAmt = amt;
        }
      } else { pop(BIN.x, BIN.y - 104, 'nothing to take today', 'note', 16); T.st = 'leave'; T.v = 10; }
      // the clock for the next pickup starts now, so a long payout doesn't push the next truck back
      S.truckT = truckEvery();
      if (T.st === 'leave') sfx('truckOut', sndAt(PARK + 30, LANE).pan);
    }
  } else if (T.st === 'pay'){
    // the numbers are flying into the truck; once they're all in, the total pops up and the money is yours
    T.timer -= dt; S.truckT -= dt; puffExhaust(T, dt, 0.25);
    if (T.timer <= 0){
      const amt = T.payAmt || 0, px = T.x + 26, py = LANE - 92;
      S.cash += amt; S.totals.cash += amt;
      sfx('coins', amt);
      pop(px, py, '+' + cash2(amt), 'cash', 26);
      sparkle(px, py + 16);
      const hc = $('hCash').getBoundingClientRect(), tgt = s2w(hc.left + 18, hc.top + hc.height/2);
      for (let i=0;i<Math.min(12, 3 + Math.floor(amt*2));i++) flyTo('coin', px + rand(-20,20), py + 10, tgt.x, tgt.y, 0.9 + i*0.06, 120, { hud:true });
      T.st = 'leave'; T.v = 10; T.timer = 0;
      sfx('truckOut', sndAt(PARK + 30, LANE).pan);
    }
  } else if (T.st === 'leave'){
    T.v = Math.min(T.v + 240*dt, 360); T.x -= T.v*dt; T.rot -= T.v*dt/10; S.truckT -= dt;
    puffExhaust(T, dt, 1.4);
    if (T.x < Math.min(V.x0 - 140, PARK - 300)){ T.st = 'away'; S.truckT = Math.max(S.truckT, 2); T.fill = 0; }
  }
}
// the pickup sign says "now" only while the truck pulls in and loads; once it's loaded the clock for the next one runs
const truckHere = () => truck.st === 'arrive' || truck.st === 'load';
function puffExhaust(T, dt, k){
  if (!simMode && Math.random() < dt*6*k) parts.push({ k:'dust', x: T.x + 74, y: LANE - 10, vx: rand(10,30), vy: rand(-16,-8), g:0, life: rand(.7,1.2), t:0, r: rand(3,6), gray:true });
}

// ───────────────────────── particles & popups
function flyTo(kind, x0, y0, x1, y1, dur, arc, o){ if (simMode) return; parts.push(Object.assign({ k:'fly', kind, x0, y0, x1, y1, dur, arc, t:0, life:dur, rot: rand(0,TAU) }, o)); }
function pop(x, y, text, kind, size, delay, life){ if (simMode) return; pops.push({ x, y, text, kind, size: size || 18, t: -(delay||0), life: life || (kind === 'cash' ? 3.4 : kind === 'note' ? 2.6 : 1.7) }); }
function sparkle(x, y){ if (simMode) return; for (let i=0;i<14;i++){ const a = rand(0,TAU), v = rand(40,110); parts.push({ k:'star', x, y, vx: Math.cos(a)*v, vy: Math.sin(a)*v - 30, g: 90, life: rand(.5,.9), t:0 }); } }
function updParts(dt){
  for (const p of parts){
    p.t += dt;
    if (p.k === 'fly'){ if (p.t >= p.life && p.hud) cashBumpT = 0.18; continue; }
    p.vy += (p.g||0)*dt; p.x += p.vx*dt; p.y += p.vy*dt;
  }
  parts = parts.filter(p => p.t < p.life);
  for (const p of pops) p.t += dt;
  pops = pops.filter(p => p.t < p.life);
}

// ───────────────────────── sound glue (audio.js makes the sounds; this only says when and where)
const SND = window.LeafSound || null;
// stereo position and loudness for something in the world, from where it sits on screen
function sndAt(x, y){
  const s = w2s(x, y), pan = clamp((s.x / (W || 1))*2 - 1, -1, 1)*0.75;
  const off = s.x < -60 || s.x > W + 60 || s.y < -60 || s.y > H + 60;
  return { pan, vol: (off ? 0.3 : 1) * clamp(0.55 + cam.z*0.35, 0.6, 1) };
}
function sfx(name, ...a){ if (!SND || simMode) return; try { SND[name](...a); } catch(e){} }
const robotVoice = id => id < 5 ? id : id === 5 ? 7 : id + 2;   // 5 and 6 are the blowers' and shakers' voices
function robotSays(r, mood, force){ const a = sndAt(r.x, r.y); sfx('beep', robotVoice(r.id), mood, a.pan, a.vol, force); }
// every so often one of the robots mutters something to itself
let chatT = 10;
function ambientChatter(dt){
  chatT -= dt; if (chatT > 0) return;
  chatT = rand(16, 38);
  if (!R.length) return;
  const r = R[Math.floor(Math.random()*R.length)];
  robotSays(r, (r.st === 'rest' || r.st === 'wander') ? (Math.random() < .5 ? 'sleepy' : 'chat') : r.st === 'mine' ? 'ok' : 'chat');
}

// ───────────────────────── leaf world update
function updLeaves(dt){
  gustT -= dt; if (gustT < 0){ gust = rand(18, 40)*(Math.random()<.5?-1:1); gustT = rand(9, 18); }
  gust *= Math.pow(0.55, dt);
  wind = 12*Math.sin(S.t*0.13) + 7*Math.sin(S.t*0.41 + 1) + gust;
  const A = AREAS[S.land];
  spawnAcc += dt*A.spawn;
  while (spawnAcc >= 1){ spawnAcc -= 1; if (groundN < A.cap) spawnCollectable(false); }
  dropT -= dt;
  if (dropT <= 0){ dropT = treeDrop() ? rand(75, 150) : rand(15, 30); }
  for (let i=0;i<treeShake.length;i++) if (treeShake[i] > 0) treeShake[i] = Math.max(0, treeShake[i] - dt);
  if (!simMode){
    ambAcc += dt*(reduceMotion ? 0.25 : 0.5 + 0.25*S.land);
    while (ambAcc >= 1){ ambAcc -= 1; spawnAmbient(); }
    fgAcc += dt*(reduceMotion ? 0.03 : 0.2);
    while (fgAcc >= 1){ fgAcc -= 1; spawnFg(); }
  }
  let n = 0;
  for (const l of leaves){
    if (l.st === 'fall'){
      l.ph += dt*l.phs; l.y += l.vy*dt; l.x += (wind*l.wf + Math.cos(l.ph)*l.sw)*dt; l.rot += l.vr*dt;
      if (l.y >= l.ly){
        l.y = l.ly;
        if (l.collect && !landingOK(l.x, l.y)){ const O = owned(); l.x = clamp(l.x, O.x0 + 10, O.x1 - 10); if (!landingOK(l.x, l.y)) l.collect = false; }
        l.st = l.collect ? 'ground' : 'fade'; l.flip = Math.cos(l.ph) < 0 ? -1 : 1; l.t = 0;
      }
    } else if (l.st === 'ground'){
      if (l.kx || l.ky){
        const O = owned(), px = l.x, py = l.y;
        l.x += l.kx*dt; l.y += l.ky*dt; l.rot += l.kx*0.04*dt;
        // a blown leaf skims along the grass for a while; it settles once it reaches the bin
        // a blown leaf skims toward the bin at an even pace until its glide runs out, then settles
        let fr = 0.02;
        if (l.glide){
          const tx = BIN_MOUTH.x - l.x, ty = BIN_MOUTH.y - l.y, bd = Math.hypot(tx, ty) || 1;
          if (bd < 48){ l.glide = 0; l.glideD = 0; }
          else if (l.glideD > 0){
            const v = l.glideV*Math.min(1, 0.35 + l.glideD/40), k = 1 - Math.pow(0.02, dt);
            l.kx += (tx/bd*v - l.kx)*k; l.ky += (ty/bd*v - l.ky)*k; fr = 1;
            l.glideD -= Math.hypot(l.kx, l.ky)*dt;
          } else fr = 0.15;
        }
        const d = Math.pow(fr, dt); l.kx *= d; l.ky *= d; if (Math.abs(l.kx)+Math.abs(l.ky) < (l.glide ? 4 : 1) && !(l.glideD > 0)){ l.kx = l.ky = 0; l.glide = 0; l.glideV = 0; }
        l.x = clamp(l.x, O.x0 + 8, O.x1 - 8); l.y = clamp(l.y, O.y0 + 6, O.y1 - 4);
        // a kicked or blown leaf stops at the bin, the shed, a bush or a trunk instead of sliding under it
        if (!landingOK(l.x, l.y) && landingOK(px, py)){ l.x = px; l.y = py; l.kx *= -0.15; l.ky *= -0.15; l.glideD = 0; }
      }
    } else if (l.st === 'fade'){
      l.t += dt; l.a = clamp(1 - (l.t - 2.5)/1.5, 0, 1); if (l.a <= 0) l.st = 'gone';
    }
    if (l.collect && (l.st === 'ground' || l.st === 'fall')) n++;
  }
  groundN = n;
  leaves = leaves.filter(l => l.st !== 'gone');
  for (const f of fgLeaves){ f.ph += dt*f.phs; f.y += f.vy*dt; f.x += (wind*2.4 + Math.cos(f.ph)*f.sw)*dt; f.rot += f.vr*dt; }
  fgLeaves = fgLeaves.filter(f => f.y < H + 60 && f.x < W + 80);
}

// ───────────────────────── flowers, robot bees and the hive
// Autumn flowers grow in little clumps all over the land. Once the hive is built, robot bees fly out, sip nectar from
// two flowers (three with Longer rounds) and bring it home. A sipped flower needs about ten seconds to bloom again,
// so the more bees you keep, the further out they have to fly, and on a small plot some just hang around the hive.
// The hive turns nectar into jars of honey (each floor of the tower is a honey room, and tank or store upgrades add
// floors), keeps the jars until the truck comes, and stops when the store is full.
// new flowers on each piece of land. V7: fewer, most of all on the cottage plot, so honey grows with the yard
const FLOWER_N = [12, 30, 95];
const FLOWER_REGROW = 11;               // seconds for a sipped flower to bloom again (each one a little different)
const BEE_SPEED = 52, SIP_TIME = 2.8, FLOOR_RATE = 2;   // V8: bees sip longer (was 1.8 s), so it takes more bees to work the flowers   // each floor of the hive turns 2 nectar a second into honey
let FLOWERS = [], flowerSpr = [];
let B = [];                                            // bees (runtime)
const hiveRt = { jars: 0, popT: 0, making: 0, builtT: -10, shownT: -10, bump: 0 };

function flowerSpotOK(x, y, lvl){
  const O = owned(lvl);
  if (x < O.x0 + 14 || x > O.x1 - 14 || y < O.y0 + 16 || y > O.y1 - 10) return false;
  if (lvl > 0){ const P = owned(lvl - 1); if (x > P.x0 - 8 && x < P.x1 + 8 && y > P.y0 - 8) return false; }
  if (Math.abs(x - SHED.x) < 72 && y > SHED.y - 112) return false;
  for (const p of PUDDLES) if (inPuddle(p, x, y, 10)) return false;   // RAINY HOLLOW: not in a puddle
  if (x > SHED.x + 40 && x < SHED.x + 96 && y > SHED.y - 24) return false;
  if (x > BIN.x - 58 && x < BIN.x + 92 && y > BIN.y - 74) return false;
  if (Math.abs(x - SIGN.x) < 28 && y > SIGN.y - 34) return false;
  if (Math.abs(x - HIVE.x) < 46 && y > HIVE.y - 175 && y < HIVE.y + 18) return false;
  if (Math.abs(x - CRATE.x) < 32 && y > CRATE.y - 66 && y < CRATE.y + 14) return false;
  if (Math.abs(x - HIVE2.x) < 46 && y > HIVE2.y - 175 && y < HIVE2.y + 18) return false;
  if (Math.abs(x - CRATE2.x) < 32 && y > CRATE2.y - 66 && y < CRATE2.y + 14) return false;
  if (Math.abs(x - BAGGER.x) < 40 && y > BAGGER.y - 60 && y < BAGGER.y + 14) return false;
  if (Math.abs(x - PALLET.x) < 32 && y > PALLET.y - 50 && y < PALLET.y + 14) return false;
  if (x > PLANT.x - 112 && x < PLANT.x + 112 && y > PLANT.y - 90 && y < PLANT.y + 16) return false;
  for (const p of SPOTS) if (Math.abs(x - p.x) < 54 && Math.abs(y - p.y) < 32) return false;
  for (const b of BUSHES){ const dx = (x - b.x)/(48*b.s), dy = (y - b.y + 8*b.s)/(26*b.s); if (dx*dx + dy*dy < 1) return false; }
  // not under a tree crown, where nobody would see them
  for (const t of TREES){ const dx = (x - t.x)/(t.r*1.02), dy = (y - t.y - t.r*0.12)/(t.r*1.14); if (dx*dx + dy*dy < 1) return false; }
  for (let L=0; L<AREAS.length - 1; L++){ const A = AREAS[L], sx = Math.round(A.w*0.18), sy = -A.h + 44; if (Math.abs(x - sx) < 42 && y > sy - 34 && y < sy + 12) return false; }
  return true;
}
// RAINY HOLLOW: mushroom patches instead of flowers. The robot ants (see the ant hill) cut mushrooms from the patches
// and carry them home; a patch then grows back from little pinheads. Seeding upgrades (Spore scattering) open more
// patches (tier 1–3, hidden until scattered). Lots of little mushrooms just for looks (DECO) are painted into the ground.
let DECO = [];
const DECO_N = [45, 150, 320];
function buildFlowers(){
  FLOWERS = []; DECO = [];
  const clash = (list, x, y, dx, dy) => list.some(f => Math.abs(f.x - x) < dx && Math.abs(f.y - y) < dy);
  const place = (L, count, rnd, mk, deco) => {
    const O = owned(L), list = deco ? DECO : FLOWERS;
    let n = 0, tries = 0;
    while (n < count && tries++ < 6000){
      const cx = O.x0 + rnd()*(O.x1 - O.x0), cy = O.y0 + rnd()*(O.y1 - O.y0);
      if (!flowerSpotOK(cx, cy, L)) continue;
      const ty = Math.floor(rnd()*FLOWER_TYPES.length), ty2 = Math.floor(rnd()*FLOWER_TYPES.length);
      const k = deco ? 2 + Math.floor(rnd()*4) : 2 + Math.floor(rnd()*3);
      for (let m=0, t2=0; m<k && n < count && t2 < 30; t2++){
        const a = rnd()*TAU, d = m ? (deco ? 6 + rnd()*16 : 12 + rnd()*22) : 0, x = cx + Math.cos(a)*d, y = cy + Math.sin(a)*d*0.6;
        if (!flowerSpotOK(x, y, L) || clash(FLOWERS, x, y, 13, 8) || (deco && clash(DECO, x, y, 6, 4))) continue;
        list.push(mk(x, y, deco ? Math.floor(rnd()*MUSH_DECO.length) : rnd() < 0.75 ? ty : ty2, rnd));
        m++; n++;
      }
    }
  };
  for (let L=0; L<AREAS.length; L++){
    const rnd = mulberry(900 + L*17);
    for (let tier=0; tier<=GEN.seeding.max; tier++)
      place(L, tier ? Math.round(FLOWER_N[L]*SEED_SHARE) : FLOWER_N[L], rnd, (x, y, ty, r) => ({ x, y, ty, s: 0.95 + r()*0.3, land: L, tier, ph: r()*TAU, full: true, t: 0, regrow: FLOWER_REGROW*(0.85 + r()*0.3), claim: null, bob: 0 }));
    place(L, DECO_N[L], mulberry(1300 + L*29), (x, y, ty, r) => ({ x, y, ty, s: 0.7 + r()*0.45, land: L }), true);
  }
  FLOWERS.sort((a, b) => a.y - b.y);
  DECO.sort((a, b) => a.y - b.y);
  shakeCD.flower = FLOWERS.map(() => 0);
}
function drawDecoFlowers(g, V){
  for (const f of DECO){
    if (f.x < V.x0 || f.x > V.x1 || f.y < V.y0 || f.y > V.y1) continue;
    drawTinyMush(g, f.x, f.y, f.s, MUSH_DECO[f.ty]);
  }
}
const flowerHead = f => FLOWER_TYPES[f.ty].h*f.s;
// a patch the ants can use: on your land, and (for the extra ones Spore scattering opens) already scattered
const flowerOn = f => f.land <= S.land && (f.tier || 0) <= gl('seeding');
// a patch only shows grown mushrooms once it can be cut again; until then little ones push up
const bloomOf = f => f.full ? 1 : clamp((f.t/f.regrow - 0.6)/0.4, 0, 1)*0.45;
function updFlowers(dt){
  for (const f of FLOWERS){
    if (f.bob > 0) f.bob = Math.max(0, f.bob - dt);
    if (f.full) continue;
    f.t += dt*regrowMul();
    if (f.t >= f.regrow){ f.full = true; f.t = 0; }
  }
}

// ── mushroom art. One drawing function for every kind (shape, colours, spots, ring); the patches are small clusters
// of one kind, drawn once into sprites; the little ones in the ground use the same function directly.
// shapes: dome (bun caps), bell (shaggy ink caps), flat (parasols), funnel (chanterelles), ball (puffballs)
const MUSH_SPEC = {
  agaric:  { shape:'dome',   cap:'#c4281c', cap2:'#8e1a12', gill:'#efe6d2', stem:'#efe9dc', dots:true, ring:true, w:7.5, h:4.6, sh:7, sw:1.9 },
  porcini: { shape:'dome',   cap:'#8a5428', cap2:'#5e3518', gill:'#d6c48a', stem:'#e2d6b8', w:7.8, h:5,   sh:5, sw:3.2, fat:true },
  chant:   { shape:'funnel', cap:'#e6a22a', cap2:'#b8761a', gill:'#d68a1e', stem:'#e2a43a', w:4.6, h:3,   sh:4.5, sw:1.6 },
  inky:    { shape:'bell',   cap:'#f1ece2', cap2:'#b6aea0', gill:'#3a3632', stem:'#f4efe6', w:3.6, h:9,   sh:4, sw:1.4, shaggy:true },
  honey:   { shape:'dome',   cap:'#c99448', cap2:'#8a6026', gill:'#ecdcb8', stem:'#d8c49a', w:3.6, h:2.2, sh:5.5, sw:1, spot:'#6a4418' },
  blewit:  { shape:'dome',   cap:'#9a7cb8', cap2:'#6a4e8a', gill:'#c8b6dc', stem:'#c3b0d6', w:6,   h:3.2, sh:4.5, sw:2 },
  puff:    { shape:'ball',   cap:'#f2ede0', cap2:'#c8bfa8', w:4.2, h:4 },
  parasol: { shape:'flat',   cap:'#cfb48c', cap2:'#7a5a36', gill:'#f2ead8', stem:'#d8cbb0', w:9,   h:2.6, sh:12, sw:1.3, scales:true },
  sulphur: { shape:'dome',   cap:'#e8c83a', cap2:'#b8901e', gill:'#9aa03a', stem:'#e6d070', w:3.4, h:2,   sh:4, sw:1, spot:'#c46a1e' },
};
const MUSH_DECO = [MUSH_SPEC.agaric, MUSH_SPEC.honey, MUSH_SPEC.inky, MUSH_SPEC.puff, MUSH_SPEC.sulphur, MUSH_SPEC.chant, MUSH_SPEC.blewit, MUSH_SPEC.porcini];
// one mushroom standing at (x, y) (its foot), scale s; lean tips the stem a little
function drawMush(g, x, y, s, M, lean){
  g.save(); g.translate(x, y); g.scale(s, s); if (lean) g.rotate(lean);
  const w = M.w, h = M.h, sh = M.sh || 0, sw = M.sw || 1;
  if (M.shape === 'ball'){
    const rg = g.createRadialGradient(-w*0.35, -h*0.85, 0.3, 0, -h*0.5, w*1.1); rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.55, M.cap); rg.addColorStop(1, M.cap2);
    g.fillStyle = rg; ell(g, 0, -h*0.5, w*0.6, h*0.55); g.fill();
    g.fillStyle = 'rgba(120,100,70,.35)'; for (let k=0;k<4;k++){ ell(g, (k - 1.5)*w*0.22, -h*(0.55 + (k%2)*0.2), 0.35, 0.3); g.fill(); }
    g.restore(); return;
  }
  // stem
  g.fillStyle = M.stem; g.beginPath();
  if (M.fat){ g.moveTo(-sw*0.55, -sh); g.quadraticCurveTo(-sw*0.95, -sh*0.2, -sw*0.6, 0); g.lineTo(sw*0.6, 0); g.quadraticCurveTo(sw*0.95, -sh*0.2, sw*0.55, -sh); }
  else { g.moveTo(-sw/2, -sh); g.lineTo(-sw*0.6, 0); g.lineTo(sw*0.6, 0); g.lineTo(sw/2, -sh); }
  g.closePath(); g.fill();
  g.fillStyle = 'rgba(60,40,20,.25)'; g.fillRect(sw*0.1, -sh, sw*0.45, sh);
  if (M.ring){ g.fillStyle = '#fbf8f0'; ell(g, 0, -sh*0.62, sw*0.95, 0.7); g.fill(); }
  // cap
  const top = -sh;
  if (M.shape === 'dome'){
    g.fillStyle = M.gill; ell(g, 0, top + 0.2, w/2, h*0.22); g.fill();
    g.fillStyle = M.cap2; g.beginPath(); g.ellipse(0, top, w/2, h, 0, Math.PI, 0); g.closePath(); g.fill();
    g.fillStyle = M.cap; g.beginPath(); g.ellipse(-w*0.04, top - 0.25, w/2 - 0.5, h - 0.45, 0, Math.PI, 0); g.closePath(); g.fill();
    if (M.spot){ g.fillStyle = M.spot; g.beginPath(); g.ellipse(0, top - h*0.75, w*0.18, h*0.22, 0, 0, TAU); g.fill(); }
    if (M.dots){ g.fillStyle = '#fbf6ea'; for (const [dx, dy, r] of [[-0.25, 0.55, 0.6], [0.12, 0.78, 0.55], [0.3, 0.4, 0.5], [-0.05, 0.35, 0.45], [-0.36, 0.25, 0.4]]){ ell(g, dx*w, top - dy*h, r, r*0.8); g.fill(); } }
    g.fillStyle = 'rgba(255,255,255,.4)'; ell(g, -w*0.2, top - h*0.68, w*0.13, h*0.14); g.fill();
  } else if (M.shape === 'bell'){
    g.fillStyle = M.cap2; rr(g, -w/2, top - h, w, h + 0.5, w*0.48); g.fill();
    g.fillStyle = M.cap; rr(g, -w/2 + 0.2, top - h, w - 0.9, h, w*0.45); g.fill();
    if (M.shaggy){ g.strokeStyle = 'rgba(150,140,125,.8)'; g.lineWidth = 0.35; for (let k=0;k<5;k++){ const yy = top - h*0.2 - k*h*0.16; g.beginPath(); g.moveTo(-w*0.38, yy); g.lineTo(-w*0.2, yy + 0.7); g.moveTo(w*0.05, yy - 0.3); g.lineTo(w*0.22, yy + 0.4); g.stroke(); } }
    g.fillStyle = M.gill; g.fillRect(-w/2 + 0.1, top - 0.5, w - 0.2, 0.8);
    g.fillStyle = 'rgba(255,255,255,.45)'; rr(g, -w*0.32, top - h*0.9, w*0.18, h*0.5, 0.4); g.fill();
  } else if (M.shape === 'flat'){
    g.fillStyle = M.gill; ell(g, 0, top + 0.3, w/2, h*0.35); g.fill();
    g.fillStyle = M.cap; g.beginPath(); g.moveTo(-w/2, top); g.quadraticCurveTo(-w*0.3, top - h, 0, top - h*1.15); g.quadraticCurveTo(w*0.3, top - h, w/2, top); g.closePath(); g.fill();
    g.fillStyle = M.cap2; ell(g, 0, top - h*0.95, w*0.12, h*0.28); g.fill();
    if (M.scales){ g.fillStyle = 'rgba(110,80,48,.75)'; for (let k=0;k<7;k++){ ell(g, (k - 3)*w*0.12, top - h*0.45 - (3 - Math.abs(k - 3))*0.18, 0.45, 0.3); g.fill(); } }
  } else if (M.shape === 'funnel'){
    g.fillStyle = M.cap2; g.beginPath(); g.moveTo(-sw*0.5, top + 1); g.lineTo(-w/2, top - h); g.lineTo(w/2, top - h); g.lineTo(sw*0.5, top + 1); g.closePath(); g.fill();
    g.fillStyle = M.cap; g.beginPath(); g.moveTo(-w/2, top - h); g.quadraticCurveTo(-w*0.25, top - h - 0.9, 0, top - h - 0.2); g.quadraticCurveTo(w*0.25, top - h - 1, w/2, top - h); g.quadraticCurveTo(0, top - h + 1.2, -w/2, top - h); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(150,90,20,.6)'; g.lineWidth = 0.3; for (let k=-2;k<=2;k++){ g.beginPath(); g.moveTo(k*0.4, top + 0.6); g.lineTo(k*w*0.18, top - h + 0.4); g.stroke(); }
  }
  // a raindrop sitting on the cap
  g.fillStyle = 'rgba(225,238,248,.8)'; ell(g, w*0.18, top - (M.shape === 'bell' ? h : h*0.75), 0.45, 0.4); g.fill();
  g.restore();
}
function drawTinyMush(g, x, y, s, M){
  g.fillStyle = 'rgba(20,12,6,.3)'; ell(g, x + 0.8*s, y + 0.4*s, (M.w*0.55 + 0.6)*s, 1.1*s); g.fill();
  drawMush(g, x, y, s, M, 0);
}
// the patch kinds the ants cut: each a cluster of [x offset, scale, lean]
const FLOWER_TYPES = [
  { name:'fly agaric', h: 11, m: MUSH_SPEC.agaric,  cl: [[-3.5, 1, -0.08], [4, 0.7, 0.12]] },
  { name:'porcini',    h: 9,  m: MUSH_SPEC.porcini, cl: [[-2.5, 1, -0.05], [4.5, 0.65, 0.1], [0.5, 0.45, 0]] },
  { name:'chanterelle',h: 7,  m: MUSH_SPEC.chant,   cl: [[-5, 0.9, -0.2], [-1, 1.05, -0.05], [3.5, 0.95, 0.12], [6.5, 0.7, 0.25], [1.2, 0.6, 0]] },
  { name:'ink cap',    h: 13, m: MUSH_SPEC.inky,    cl: [[-2.4, 1, -0.06], [2.4, 0.85, 0.08], [5.4, 0.55, 0.15]] },
  { name:'honey fungus', h: 8, m: MUSH_SPEC.honey,  cl: [[-5, 0.8, -0.3], [-2.2, 1, -0.12], [0.8, 1.1, 0], [3.6, 0.9, 0.15], [6, 0.7, 0.3], [1.5, 0.6, 0.05]] },
  { name:'blewit',     h: 8,  m: MUSH_SPEC.blewit,  cl: [[-3, 1, -0.1], [3.2, 0.8, 0.12]] },
  { name:'puffball',   h: 5,  m: MUSH_SPEC.puff,    cl: [[-3.5, 1, 0], [2.5, 0.8, 0], [5.6, 0.55, 0]] },
  { name:'parasol',    h: 15, m: MUSH_SPEC.parasol, cl: [[-1, 1, -0.05], [5, 0.6, 0.15]] },
  { name:'sulphur tuft', h: 6, m: MUSH_SPEC.sulphur, cl: [[-4, 0.9, -0.3], [-1.4, 1.05, -0.1], [1.4, 1.1, 0.08], [4, 0.85, 0.28]] },
];
function buildFlowerSprites(){
  const RES = 3;
  flowerSpr = FLOWER_TYPES.map((T, ti) => {
    const rnd = mulberry(40 + ti);
    // the base: a little mound of moss and leaf litter with pinhead mushrooms; origin at the foot
    const sw = 26, sh = 12, sox = 13, soy = 8;
    const sc = document.createElement('canvas'); sc.width = sw*RES; sc.height = sh*RES;
    const g = sc.getContext('2d'); g.scale(RES, RES); g.translate(sox, soy);
    g.fillStyle = 'rgba(20,12,6,.3)'; ell(g, 1, 1, 10, 2.6); g.fill();
    g.fillStyle = '#3e3222'; ell(g, 0, 0.4, 9, 2.4); g.fill();
    for (let k=0;k<14;k++){ g.fillStyle = ['#4a6526', '#5d7a2e', '#6f8c36'][Math.floor(rnd()*3)]; ell(g, (rnd() - 0.5)*16, (rnd() - 0.5)*3, 1.2 + rnd(), 0.8 + rnd()*0.5); g.fill(); }
    for (let k=0;k<3;k++) leafBlob(g, (rnd() - 0.5)*16, (rnd() - 0.4)*3, 1.6 + rnd(), rnd()*TAU, FOLIAGE.rust[1 + Math.floor(rnd()*3)]);
    for (const [dx] of T.cl){ g.fillStyle = T.m.cap || '#d9c49a'; ell(g, dx, -0.6, 0.8, 0.7); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; ell(g, dx - 0.2, -0.9, 0.3, 0.25); g.fill(); }
    // the grown cluster: origin at the foot (bottom middle)
    const hw = 24, hh = T.h + 8, hc = document.createElement('canvas'); hc.width = hw*RES; hc.height = hh*RES;
    const q = hc.getContext('2d'); q.scale(RES, RES); q.translate(hw/2, hh - 2);
    const order = T.cl.slice().sort((a, b) => b[1] - a[1]);   // big ones at the back
    for (const [dx, k, lean] of order){ q.fillStyle = 'rgba(20,12,6,.28)'; ell(q, dx + 0.8, 0.5, T.m.w*0.5*k + 0.5, 1); q.fill(); drawMush(q, dx, 0, k, T.m, lean); }
    return { stem: sc, sw, sh, sox, soy, head: hc, hw, hh };
  });
}
function drawFlowers(V){
  const c = ctx, active = S.hive.built, sown = gl('seeding');
  for (const f of FLOWERS){
    if (f.tier > sown) continue;   // not scattered yet (Spore scattering)
    if (f.x < V.x0 || f.x > V.x1 || f.y < V.y0 - 20 || f.y > V.y1 + 20) continue;
    const sp = flowerSpr[f.ty]; if (!sp) continue;
    const wild = f.land > S.land, b = wild || !active ? 1 : bloomOf(f);
    const wob = f.bob > 0 ? Math.sin(f.bob*30)*0.06 : 0;
    c.save(); c.translate(f.x, f.y); c.scale(f.s, f.s);
    if (wild) c.globalAlpha = 0.72;
    c.drawImage(sp.stem, -sp.sox, -sp.soy, sp.sw, sp.sh);
    if (b > 0.02){
      const k = 0.3 + 0.7*b;
      c.rotate(wob); c.globalAlpha *= Math.min(1, 0.4 + b*1.2);
      c.drawImage(sp.head, -sp.hw/2*k, -(sp.hh - 2)*k, sp.hw*k, sp.hh*k);
    }
    c.restore();
  }
}

// ── the hive
const HIVE_COST = 120;
const MAX_BEES = 60;   // per hive (WILDFLOWER PRAIRIE: the Twin hive doubles it)
const maxBees = () => MAX_BEES*nHives();
// Six one-off hive upgrades, all at one fixed price, so the order is up to you and buying one never makes the others
// dearer. V7: $180 each (was $80), so it takes a while before you start on them.
const HIVE_UP = {
  wings:   { name:'Springy legs',   bee:true, desc:'Ants walk <b>25%</b> faster.' },
  third:   { name:'Longer rounds',  bee:true, desc:'Each ant visits <b>3 patches</b> a trip instead of 2.' },
  tongue:  { name:'Sharp mandibles', bee:true, desc:'Ants cut <b>5 mushrooms</b> from each patch instead of 4.' },
  fan:     { name:'Faster sorting',           desc:'The ant hill sorts mushrooms <b>50%</b> faster. Worth it when the larder keeps filling up.' },
  recipe:  { name:'Snug punnets',             desc:'A punnet takes <b>20 mushrooms</b> instead of 25.' },
  nursery: { name:'Ant nursery',              desc:'New ants cost <b>30%</b> less.' },
};
const HIVE_UP_COST = 180;
const hiveUpCost = () => HIVE_UP_COST;
const hiveShown = () => S.hive.built || S.flags.hiveShown;
const beeCost = (n = S.hive.bees) => niceCost(4*Math.pow(1.18, n)*(S.hive.up.nursery ? 0.7 : 1));
const tankCap = () => val('hiveTank')*nHives();
const honeyCap = () => val('hiveStore')*nHives();
const honeyPrice = () => val('honeyPrice')*sellMul();
const giftJarPrice = () => val('honeyPrice')*val('giftPrice')*sellMul();
const jarNectar = () => S.hive.up.recipe ? 20 : 25;
const fanRate = () => hiveFloors()*FLOOR_RATE*(S.hive.up.fan ? 1.5 : 1)*nHives();
// every second tank or store upgrade adds a floor (V7: there are more, smaller steps now, and the tower can't grow forever)
const hiveFloors = () => 4 + Math.ceil((S.lv.hiveTank + S.lv.hiveStore)/2);
const HV = { plinth: 12, fh: 8, r: 21, k: 0.32 };   // RAINY HOLLOW: the ant hill's height (a chamber per "floor")
const hiveTopZ = () => HV.plinth + hiveFloors()*HV.fh;
const DOOR = { x: HIVE.x, y: HIVE.y + 0.866*HV.r*HV.k, z: HV.plinth + HV.fh*0.5 };
const DOOR2 = { x: HIVE2.x, y: HIVE2.y + 0.866*HV.r*HV.k, z: DOOR.z };
// with the Twin hive every second bee lives in the new hive
const homeOf = i => twinBuilt() ? i % 2 : 0;
const hiveOf = b => homeOf(b.i) ? HIVE2 : HIVE;
const doorOf = b => homeOf(b.i) ? DOOR2 : DOOR;
// per-bee stats come from the upgrades the bee picked up last time it was home
const beeSpeed = b => BEE_SPEED*(b.up.wings ? 1.25 : 1);
const beeTrip = b => b.up.third ? 3 : 2;
const beeSip = b => b.up.tongue ? 5 : 4;

function newBee(i){
  const H = S.hive.up, D = homeOf(i) ? DOOR2 : DOOR;
  return { i, x: D.x, y: D.y, z: D.z, st:'in', timer: 0.2 + rand(0, 2.5), carry: 0, visits: 0, tgt: null, face: 1, anim: rand(0, 10), ph: rand(0, TAU),
    lx: 0, ly: 0, lz: 0, tx: 0, ty: 0, tz: 0, len: 1, up: { wings: H.wings, third: H.third, tongue: H.tongue } };
}
function syncBees(){ while (B.length < S.hive.bees) B.push(newBee(B.length)); }
function refreshBee(b){
  const H = S.hive.up; let ch = false;
  for (const k of ['wings', 'third', 'tongue']) if (b.up[k] !== H[k]){ b.up[k] = H[k]; ch = true; }
  if (ch && !simMode) parts.push({ k:'star', x: doorOf(b).x + rand(-4, 4), y: doorOf(b).y - doorOf(b).z - 4, vx: rand(-30, 30), vy: rand(-50, -20), g: 60, life: 0.6, t: 0 });
}
function beeLeg(b, tx, ty, tz){ b.lx = b.x; b.ly = b.y; b.lz = b.z; b.tx = tx; b.ty = ty; b.tz = tz; b.len = Math.max(1, Math.hypot(tx - b.x, ty - b.y)); }
function beeMove(b, sp, dt){
  const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
  if (Math.abs(dx) > 0.5) b.face = dx > 0 ? 1 : -1;
  const p = clamp(1 - d/b.len, 0, 1), lift = Math.min(34, b.len*0.14);
  if (d <= sp*dt){ b.x = b.tx; b.y = b.ty; b.z = b.tz; return true; }
  b.x += dx/d*sp*dt; b.y += dy/d*sp*dt;
  b.z = lerp(b.lz, b.tz, p) + Math.sin(p*Math.PI)*lift;
  return false;
}
function findFlower(b){
  let best = null, bs = 1e18;
  for (const f of FLOWERS){
    if (!f.full || f.claim || !flowerOn(f)) continue;
    const hv = hiveOf(b), s = Math.hypot(f.x - b.x, f.y - b.y) + 0.35*Math.hypot(f.x - hv.x, f.y - hv.y);
    if (s < bs){ bs = s; best = f; }
  }
  return best;
}
function goFlower(b, f){ f.claim = b; b.tgt = f; b.st = 'fly'; beeLeg(b, f.x + rand(-1.5, 1.5), f.y + 0.5, flowerHead(f)*1.0 + 1.5); }
// V7: a bee only buzzes about the hive when there's truly nothing for it: as soon as a flower is free it goes, and with
// nothing in bloom it flies out to wait on the flower that will bloom soonest. (Before, bees hung about the hive while
// flowers looked open: a flower showed its open head well before it could be sipped again.)
const BEE_WAIT_MAX = 14;   // a bee only goes to wait on a flower that will bloom within this many seconds
const tankFull = () => S.hive.nectar >= tankCap() - 0.5;
function nextBloom(b){
  const sp = beeSpeed(b);
  let best = null, bs = 1e18;
  for (const f of FLOWERS){
    if (f.full || f.claim || !flowerOn(f)) continue;
    const left = (f.regrow - f.t)/regrowMul(); if (left > BEE_WAIT_MAX) continue;
    const trip = Math.hypot(f.x - b.x, f.y - b.y)/sp, s = Math.max(left, trip) + 0.3*trip;
    if (s < bs){ bs = s; best = f; }
  }
  return best;
}
function goWait(b, f){ f.claim = b; b.tgt = f; b.st = 'toWait'; beeLeg(b, f.x + rand(-3, 3), f.y + 0.5, flowerHead(f) + 7); }
function loiter(b){
  b.st = 'loiter'; b.timer = 0.5; b.tgt = null;
  const hv = hiveOf(b); beeLeg(b, hv.x + rand(-30, 46), hv.y + rand(2, 18), rand(18, hiveTopZ()*0.85));
}
function beeQueue(b){ const D = doorOf(b); b.st = 'queue'; b.timer = 0.6; b.tgt = null; beeLeg(b, D.x + rand(-14, 22), D.y + rand(3, 10), D.z + rand(4, 16)); }
// where a bee goes once it's out and about: a free flower, else one about to bloom, else home
function beeNext(b){
  if (b.carry > 0 && b.visits >= beeTrip(b)){ beeHome(b); return; }
  const f = findFlower(b);
  if (f){ goFlower(b, f); return; }
  const w = nextBloom(b);
  if (w){ goWait(b, w); return; }
  if (b.carry > 0) beeHome(b); else loiter(b);
}
function beeHome(b){ const D = doorOf(b); b.st = 'home'; b.tgt = null; beeLeg(b, D.x, D.y, D.z); }
function unload(b){
  const H = S.hive, n = Math.min(b.carry, Math.max(0, tankCap() - H.nectar));
  if (n > 0){ H.nectar += n; b.carry -= n; S.totals.nectar = (S.totals.nectar || 0) + n; }
  return b.carry <= 1e-6;
}
// leaving the hive (or the loiter): only when there's somewhere to put the nectar it brings back
function beeSetOff(b){
  refreshBee(b);
  if (tankFull()){ beeQueue(b); return; }
  b.visits = 0;
  const f = findFlower(b) || nextBloom(b);
  if (!f){ loiter(b); return; }
  if (f.full) goFlower(b, f); else goWait(b, f);
}
function updBee(b, dt){
  b.anim += dt;
  const sp = beeSpeed(b);
  switch (b.st){
    case 'in': {
      b.timer -= dt; if (b.timer > 0) break;
      { const D = doorOf(b); b.x = D.x; b.y = D.y; b.z = D.z; }
      beeSetOff(b);
      break;
    }
    case 'loiter': {
      // nothing free and nothing about to bloom: buzz about the hive, and look again twice a second
      if (beeMove(b, sp*0.45, dt)){ b.z += Math.sin(b.anim*5 + b.ph)*0.15; if (Math.random() < dt*0.8){ const hv = hiveOf(b); beeLeg(b, hv.x + rand(-30, 46), hv.y + rand(2, 18), rand(18, hiveTopZ()*0.85)); } }
      b.timer -= dt;
      if (b.timer <= 0){ b.timer = 0.5; if (!tankFull() && (FLOWERS.some(f => f.full && !f.claim && flowerOn(f)) || nextBloom(b))) beeSetOff(b); }
      break;
    }
    case 'fly': case 'toWait': {
      const f = b.tgt;
      if (!f || f.claim !== b || (b.st === 'fly' && !f.full)){ if (f && f.claim === b) f.claim = null; b.tgt = null; beeNext(b); break; }
      if (beeMove(b, sp, dt)){
        if (f.full){ b.st = 'sip'; b.timer = SIP_TIME; f.bob = 0.6; b.tz = b.z = flowerHead(f) + 1.5; }
        else { b.st = 'wait'; b.timer = 0; }
      }
      break;
    }
    case 'wait': {
      // hovering over a flower that's about to bloom
      const f = b.tgt;
      if (!f || f.claim !== b){ b.tgt = null; beeNext(b); break; }
      b.timer += dt; b.z = flowerHead(f) + 7 + Math.sin(b.anim*3 + b.ph)*1.5; b.x = f.x + Math.sin(b.anim*1.3 + b.ph)*3;
      if (f.full){ b.st = 'sip'; b.timer = SIP_TIME; f.bob = 0.6; b.x = f.x; b.tz = b.z = flowerHead(f) + 1.5; }
      else if (b.timer > BEE_WAIT_MAX + 4){ f.claim = null; b.tgt = null; beeNext(b); }
      break;
    }
    case 'sip': {
      b.timer -= dt; b.z = b.tz + Math.sin(b.anim*9)*0.3;
      if (b.timer > 0) break;
      const f = b.tgt;
      if (f){ f.full = false; f.t = 0; f.claim = null; f.bob = 0.4; b.mty = f.ty; }
      b.tgt = null; b.carry += beeSip(b); b.visits++;
      if (b.visits < beeTrip(b)){ const g = findFlower(b); if (g){ goFlower(b, g); break; } const w = nextBloom(b); if (w && (w.regrow - w.t)/regrowMul() < 4){ goWait(b, w); break; } }
      beeHome(b);
      break;
    }
    case 'home': {
      if (beeMove(b, sp, dt)){
        refreshBee(b);
        if (unload(b)){ b.st = 'in'; b.timer = 0.4 + rand(0, 0.4); }
        else beeQueue(b);
      }
      break;
    }
    case 'queue': {
      // the nectar tank is full: buzz by the door until there's room
      beeMove(b, sp*0.4, dt);
      b.timer -= dt;
      if (b.timer <= 0){
        b.timer = 0.6;
        const D = doorOf(b);
        if (b.carry > 0 ? unload(b) : !tankFull()){ b.st = 'in'; b.timer = 0.3; b.x = D.x; b.y = D.y; b.z = D.z; }
        else beeLeg(b, D.x + rand(-14, 22), D.y + rand(3, 10), D.z + rand(4, 16));
      }
      break;
    }
  }
}
// the hive turns nectar into honey: every floor helps, faster with Faster fanning
function updHive(dt){
  const H = S.hive;
  if (!H.built){ hiveRt.making = 0; return; }
  const room = honeyCap() - H.honey, before = Math.floor(H.honey + 1e-9);
  let n = 0;
  if (room > 1e-9 && H.nectar > 0) n = Math.min(H.nectar, fanRate()*dt, room*jarNectar());
  H.nectar -= n; H.honey = Math.min(honeyCap(), H.honey + n/jarNectar());
  hiveRt.making = lerp(hiveRt.making, dt > 0 ? n/dt : 0, Math.min(1, dt*2));
  const made = Math.floor(H.honey + 1e-9) - before;
  if (made > 0){ hiveRt.jars += made; S.totals.honey = (S.totals.honey || 0) + made; hiveRt.bump = 0.25; }
  if (hiveRt.bump > 0) hiveRt.bump = Math.max(0, hiveRt.bump - dt);
  hiveRt.popT -= dt;
  if (hiveRt.jars > 0 && hiveRt.popT <= 0){
    pop(HIVE.x + 18, HIVE.y - hiveTopZ() - 6, '+' + hiveRt.jars, 'honey', 15);
    hiveRt.jars = 0; hiveRt.popT = 1.6;
  }
  if (!simMode && n > 0 && Math.random() < dt*3) parts.push({ k:'star', x: HIVE.x + rand(-5, 5), y: HIVE.y - hiveTopZ() - 12, vx: rand(-14, 14), vy: rand(-36, -18), g: 10, life: rand(.5, .9), t: 0 });
}

// ── drawing the hive: a little hexagonal steel tower. Every tank or store upgrade adds a floor.
// Honey shows in the hexagon windows (filling from the bottom), nectar in the glass tube on the side.
function hexFront(r, k){ const d = 0.866*r*k; return [[-r, 0], [-r/2, d], [r/2, d], [r, 0]]; }
function hexPath(c, cx, cy, r, k){ const d = 0.866*r*k, p = [[-r,0],[-r/2,d],[r/2,d],[r,0],[r/2,-d],[-r/2,-d]]; c.beginPath(); p.forEach(([x, y], i) => i ? c.lineTo(cx + x, cy + y) : c.moveTo(cx + x, cy + y)); c.closePath(); }
function prismFace(c, r, k, i, yb, yt){ const v = hexFront(r, k), a = v[i], b = v[i + 1]; c.beginPath(); c.moveTo(a[0], yb + a[1]); c.lineTo(b[0], yb + b[1]); c.lineTo(b[0], yt + b[1]); c.lineTo(a[0], yt + a[1]); c.closePath(); }
function drawPrism(c, r, k, yb, yt, cols){ for (let i=0;i<3;i++){ prismFace(c, r, k, i, yb, yt); c.fillStyle = cols[i]; c.fill(); } hexPath(c, 0, yt, r, k); c.fillStyle = cols[3]; c.fill(); }
function hexCell(c, x, y, r, sx){ c.beginPath(); for (let i=0;i<6;i++){ const a = i/6*TAU + Math.PI/6, px = x + Math.cos(a)*r*sx, py = y + Math.sin(a)*r; i ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath(); }
// ── RAINY HOLLOW: a punnet of mushrooms (this place's "honey jar"): a little woven chip basket heaped with caps
function drawJar(c, x, y, s){
  c.save(); c.translate(x, y); c.scale(s/6, s/6);
  c.fillStyle = 'rgba(20,12,6,.25)'; ell(c, 0.5, 5.2, 4.6, 1); c.fill();
  // caps heaped above the rim
  const caps = [[-2.3, -2.4, '#8a5428'], [2.1, -2.6, '#c99448'], [0, -3.6, '#a8642e'], [-0.6, -1.6, '#e6a22a'], [2.8, -1.4, '#8a5428']];
  for (const [cx, cy, col] of caps){ c.fillStyle = shade(col, 0.7); ell(c, cx, cy + 0.5, 2.1, 1.4); c.fill(); c.fillStyle = col; ell(c, cx - 0.1, cy, 2, 1.3); c.fill(); c.fillStyle = 'rgba(255,240,215,.4)'; ell(c, cx - 0.6, cy - 0.4, 0.7, 0.35); c.fill(); }
  // the punnet: woven wood chip, wider at the top
  c.fillStyle = '#a7783f'; c.beginPath(); c.moveTo(-4.4, -1); c.lineTo(4.4, -1); c.lineTo(3.4, 5); c.lineTo(-3.4, 5); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(90,58,26,.65)'; c.lineWidth = 0.45;
  for (const yy of [0.6, 2.2, 3.8]){ c.beginPath(); c.moveTo(-4.2 + (yy + 1)*0.17, yy); c.lineTo(4.2 - (yy + 1)*0.17, yy); c.stroke(); }
  for (const xx of [-2.2, 0, 2.2]){ c.beginPath(); c.moveTo(xx*1.05, -1); c.lineTo(xx*0.8, 5); c.stroke(); }
  c.fillStyle = '#c99556'; rr(c, -4.7, -1.6, 9.4, 1.4, 0.6); c.fill();
  c.fillStyle = '#f2e3c4'; c.fillRect(-1.8, 1.1, 3.6, 2);
  c.restore();
}
// ── the robotic ant hill: a mound of dark wet earth with brass-rimmed tunnels, portholes that show the sorted mushrooms
// filling up, a glass larder on the side for fresh ones, a copper pipe, a turning vent on top and the antenna mast.
// Every tank or store upgrade adds a chamber (the mound grows taller).
function drawHive(){
  if (!hiveShown()) return;
  const c = ctx, H = S.hive;
  c.save(); c.translate(HIVE.x, HIVE.y);
  c.fillStyle = 'rgba(20,14,8,.32)'; ell(c, 4, 4, 48, 11); c.fill();
  if (!H.built){
    const kk = clamp((S.t - hiveRt.shownT)/0.5, 0, 1), sc = kk < 1 ? 0.4 + 0.6*(1 - Math.pow(1 - kk, 3)) + Math.sin(kk*Math.PI)*0.12 : 1;
    c.fillStyle = '#3e2f20'; ell(c, 0, 0, 30, 8); c.fill();
    ell(c, 0, 0, 24, 6); c.strokeStyle = '#d9a43a'; c.lineWidth = 2; c.setLineDash([4, 3]); c.stroke(); c.setLineDash([]);
    c.save(); c.translate(-14, 4); c.scale(sc, sc);
    c.fillStyle = '#6e4a30'; rr(c, -2, -34, 4, 35, 1.5); c.fill();
    c.rotate(Math.sin(S.t*1.2)*0.015);
    c.fillStyle = '#5a3b26'; rr(c, -25, -50, 50, 20, 4); c.fill();
    c.fillStyle = '#f3e7cf'; rr(c, -23.5, -48.5, 47, 17, 3); c.fill();
    c.save(); c.translate(-14, -40); c.scale(0.9, 0.9); drawAntShape(c, 'worker', 0, 0, 0, 0); c.restore();
    c.font = '800 8px "Baloo 2", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#4a3226'; c.fillText('ant hill', 5, -39.5);
    c.restore();
    c.restore(); return;
  }
  const F = hiveFloors(), top = -hiveTopZ(), Wb = 36 + F*1.4, t = S.t;
  const grow = clamp((S.t - hiveRt.builtT)/1.3, 0, 1);
  if (grow < 1) c.scale(1, ease(grow));
  // the mound, with a lumpy outline
  const rnd = mulberry(77), mound = () => {
    c.beginPath(); c.moveTo(-Wb, 2);
    const N = 14;
    for (let i=1;i<N;i++){ const u = i/N, a = Math.PI*(1 - u), bump = 1 + (rnd() - 0.5)*0.08; c.lineTo(Math.cos(a)*Wb*bump*(0.92 + 0.08*Math.sin(u*Math.PI)), 2 - Math.pow(Math.sin(a), 0.8)*(-top)*bump); }
    c.lineTo(Wb, 2); c.closePath();
  };
  const mg = c.createLinearGradient(-Wb*0.6, top, Wb*0.5, 0); mg.addColorStop(0, '#6e5236'); mg.addColorStop(0.5, '#4f3a26'); mg.addColorStop(1, '#33251a');
  mound(); c.fillStyle = mg; c.fill();
  c.save(); mound(); c.clip();
  // clods, pebbles, twigs and a few leaves in the earth
  const r2 = mulberry(91);
  for (let k=0;k<70;k++){ const x = (r2() - 0.5)*Wb*2, y = top + r2()*(-top + 2); c.fillStyle = r2() < .5 ? 'rgba(130,100,66,.45)' : 'rgba(24,16,10,.4)'; ell(c, x, y, 1 + r2()*2.4, 0.8 + r2()*1.4); c.fill(); }
  for (let k=0;k<5;k++){ c.fillStyle = '#7d776c'; const x = (r2() - 0.5)*Wb*1.5, y = top*0.6*r2() - 3; ell(c, x, y, 1.6, 1.1); c.fill(); c.fillStyle = 'rgba(230,236,242,.5)'; ell(c, x - 0.5, y - 0.4, 0.6, 0.3); c.fill(); }
  for (let k=0;k<4;k++) leafBlob(c, (r2() - 0.5)*Wb*1.4, top*0.8*r2() - 2, 2.2, r2()*TAU, FOLIAGE.rust[1 + Math.floor(r2()*3)]);
  c.fillStyle = '#56702a'; for (let k=0;k<8;k++){ ell(c, (r2() - 0.5)*Wb*1.8, -2 - r2()*8, 2 + r2()*3, 1 + r2()); c.fill(); }
  // a wet sheen on the lit side
  const sh = c.createLinearGradient(-Wb, top, Wb*0.2, top*0.2); sh.addColorStop(0, 'rgba(210,222,232,.22)'); sh.addColorStop(0.5, 'rgba(210,222,232,0)'); c.fillStyle = sh; c.fillRect(-Wb, top, Wb*2, -top + 4);
  c.restore();
  // portholes (one per chamber, in a loose spiral): the sorted mushrooms show through the glass as the store fills
  const hf = clamp(H.honey/honeyCap(), 0, 1)*F;
  for (let f=0; f<F; f++){
    const u = (f + 0.5)/F, hy = -6 - u*(-top - 14), side = f % 2 ? 1 : -1, wHere = Wb*Math.sqrt(Math.max(0.05, 1 - Math.pow((hy)/(top), 2)))*0.62;
    const hx = side*wHere*(0.35 + 0.5*((f*0.37) % 1)), fill = clamp(hf - f, 0, 1), pr = 3.6;
    c.fillStyle = '#21180f'; ell(c, hx, hy, pr, pr*0.9); c.fill();
    if (fill > 0){ c.save(); ell(c, hx, hy, pr - 0.6, pr*0.9 - 0.6); c.clip(); const hh = (pr*2)*fill; c.fillStyle = '#b07a3e'; c.fillRect(hx - pr, hy + pr - hh, pr*2, hh); c.fillStyle = '#d9a660'; for (let k=0;k<3;k++){ ell(c, hx - 2 + k*2, hy + pr - hh + 0.6, 1.2, 0.8); c.fill(); } c.restore(); }
    else { c.fillStyle = 'rgba(255,190,110,' + (0.18 + 0.06*Math.sin(t*2 + f)) + ')'; ell(c, hx, hy, pr - 1, pr*0.9 - 1); c.fill(); }
    c.fillStyle = 'rgba(220,235,240,.3)'; ell(c, hx - 1.2, hy - 1.2, 1, 0.7); c.fill();
    c.strokeStyle = '#c9a24a'; c.lineWidth = 1.1; ell(c, hx, hy, pr, pr*0.9); c.stroke();
    c.fillStyle = '#7a5a1e'; for (let k=0;k<4;k++){ const a = k/4*TAU + 0.4; ell(c, hx + Math.cos(a)*pr, hy + Math.sin(a)*pr*0.9, 0.45, 0.45); c.fill(); }
  }
  // the copper pipe down the right side, steaming a little at the top
  c.strokeStyle = '#8a4f2a'; c.lineWidth = 2.6; c.lineCap = 'round';
  c.beginPath(); c.moveTo(Wb*0.62, -1); c.quadraticCurveTo(Wb*0.78, top*0.45, Wb*0.32, top*0.86); c.stroke();
  c.strokeStyle = '#c98a55'; c.lineWidth = 1; c.beginPath(); c.moveTo(Wb*0.6, -2); c.quadraticCurveTo(Wb*0.75, top*0.45, Wb*0.3, top*0.86 - 0.5); c.stroke();
  // the main tunnel door at the front: brass ring, warm light inside
  c.fillStyle = '#1a120c'; c.beginPath(); c.ellipse(0, -1, 7.5, 8, 0, Math.PI, 0); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,170,80,' + (0.5 + 0.15*Math.sin(t*3)) + ')'; c.beginPath(); c.ellipse(0, -1, 5.4, 6, 0, Math.PI, 0); c.closePath(); c.fill();
  c.strokeStyle = '#c9a24a'; c.lineWidth = 1.8; c.beginPath(); c.ellipse(0, -1, 7.5, 8, 0, Math.PI, 0); c.stroke();
  c.fillStyle = '#7a5a1e'; for (const a of [0.2, 0.9, 1.6, 2.3, 2.95]){ ell(c, -Math.cos(a)*7.5, -1 - Math.sin(a)*8, 0.55, 0.55); c.fill(); }
  // a little plank awning over the door, against the rain
  c.fillStyle = '#6e4a30'; c.beginPath(); c.moveTo(-10, -9.5); c.lineTo(10, -9.5); c.lineTo(8, -12.5); c.lineTo(-8, -12.5); c.closePath(); c.fill();
  c.fillStyle = 'rgba(210,225,236,.35)'; c.fillRect(-9, -12.2, 16, 0.7);
  // the larder: a glass jar on the left with the fresh mushrooms the ants bring in
  const lx = -Wb - 4, lb = -2, lt = Math.max(top*0.62, -40), nf = clamp(H.nectar/tankCap(), 0, 1);
  c.fillStyle = '#4a423b'; rr(c, lx - 5.5, lt - 3.5, 11, 3, 1); c.fill(); rr(c, lx - 6, lb - 2, 12, 3, 1); c.fill();
  c.fillStyle = 'rgba(200,220,228,.32)'; rr(c, lx - 5, lt, 10, lb - lt - 1.5, 2); c.fill();
  if (nf > 0){ const nh = (lb - lt - 2.5)*nf, r3 = mulberry(5); c.save(); rr(c, lx - 4.4, lb - 1.8 - nh, 8.8, nh, 1.6); c.clip(); c.fillStyle = '#5e4028'; c.fillRect(lx - 5, lb - 2 - nh, 10, nh + 1); for (let k=0;k<Math.ceil(nh*0.9);k++){ c.fillStyle = ['#c4281c', '#e6a22a', '#c99448', '#f1ece2', '#9a7cb8'][Math.floor(r3()*5)]; ell(c, lx - 3.4 + r3()*6.8, lb - 2 - r3()*nh, 1.5, 1); c.fill(); } c.restore(); }
  c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(lx - 3.6, lt + 1.5, 1, lb - lt - 5);
  c.strokeStyle = 'rgba(60,70,74,.8)'; c.lineWidth = 0.8; rr(c, lx - 5, lt, 10, lb - lt - 1.5, 2); c.stroke();
  // the vent on top (spins faster with Faster sorting) and the antenna mast
  c.fillStyle = '#6a625a'; rr(c, -5, top - 4, 10, 6, 1.5); c.fill();
  c.fillStyle = '#3d3734'; ell(c, 0, top - 4, 5, 1.6); c.fill();
  c.save(); c.translate(0, top - 4.2); c.scale(1, 0.32); c.rotate(t*(H.up.fan ? 7 : 3)); c.strokeStyle = '#c9a24a'; c.lineWidth = 1.6; for (let k=0;k<3;k++){ c.rotate(TAU/3); c.beginPath(); c.moveTo(0, 0); c.lineTo(4.4, 0); c.stroke(); } c.restore();
  const hubY = top - 9, AL = 13;
  c.strokeStyle = '#4a423b'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(3, top - 3); c.lineTo(4, hubY); c.stroke();
  c.lineCap = 'round';
  for (let i=0; i<6; i++){
    const ring = Math.abs(i - 2.5) - 0.5, a = (i - 2.5)*0.36, L = AL - ring*0.6;
    const tx = 4 + Math.sin(a)*L, ty = hubY - Math.cos(a)*L;
    c.strokeStyle = '#4a423b'; c.lineWidth = 1; c.beginPath(); c.moveTo(4 + Math.sin(a)*1.5, hubY); c.lineTo(tx, ty); c.stroke();
    const on = Math.sin(t*2.6 - ring*1.1) > 0.35;
    c.fillStyle = on ? '#ffb347' : '#8a5a36'; ell(c, tx, ty, 1.7, 1.7); c.fill();
    if (on){ c.fillStyle = 'rgba(255,179,71,.3)'; ell(c, tx, ty, 3.8, 3.8); c.fill(); }
  }
  c.restore();
  if (!simMode && grow >= 1 && Math.random() < 0.03) parts.push({ k:'dust', x: HIVE.x + Wb*0.3 + rand(-1, 1), y: HIVE.y + top*0.86 - 2, vx: rand(-3, 3) + wind*0.2, vy: rand(-18, -10), g: 0, life: rand(1, 1.6), t: 0, r: rand(1.5, 2.5), gray: true });
  if (grow >= 1){
    if (H.honey >= honeyCap() - 1e-6) bubbles.push({ x: HIVE.x, y: HIVE.y + top - 30, t: 'store full' });
    else if (tankFull() && B.some(b => b.st === 'queue')) bubbles.push({ x: HIVE.x, y: HIVE.y + top - 30, t: 'larder full' });
  }
}
// ── the honey crate: a wooden farm crate beside the hive where the finished jars wait for the truck.
// The jars stack up in a little pyramid as the store fills (10 jars drawn at most, so it's a picture, not a count),
// and a chalkboard on the front gives the real number.
const CRATE_ROWS = [[-15, -5, 5, 15], [-10, 0, 10], [-5, 5], [0]];
let crateSide = 0;   // 1 while the Twin hive's crate is being drawn: each crate shows half the jars
function atTwin(f){
  if (!twinBuilt()) return;
  const h = [HIVE.x, HIVE.y], cr = [CRATE.x, CRATE.y], bt = hiveRt.builtT;
  HIVE.x = HIVE2.x; HIVE.y = HIVE2.y; CRATE.x = CRATE2.x; CRATE.y = CRATE2.y; hiveRt.builtT = twinRt.builtT; crateSide = 1;
  try { f(); } finally { HIVE.x = h[0]; HIVE.y = h[1]; CRATE.x = cr[0]; CRATE.y = cr[1]; hiveRt.builtT = bt; crateSide = 0; }
}
function drawHoneyCrate(){
  if (!S.hive.built) return;
  const grow = clamp((S.t - hiveRt.builtT - 0.5)/0.6, 0, 1); if (grow <= 0) return;
  const tw = twinBuilt(), part = v => tw ? (crateSide ? Math.floor(v/2) : Math.ceil(v/2)) : v;
  const c = ctx, cap = part(crateCap()), n = part(S.hive.jars | 0), full = crateJars() >= crateCap();
  const w = 44, h = 21, top = -h;
  const sq = hiveRt.bump > 0 ? 1 + Math.sin(hiveRt.bump/0.25*Math.PI)*0.04 : 1;
  c.save(); c.translate(CRATE.x, CRATE.y); c.scale(sq*ease(grow), ease(grow)/sq);
  c.fillStyle = 'rgba(35,25,10,.3)'; ell(c, 2, 2, 27, 5.5); c.fill();
  // the back board and the dark inside, seen just over the front
  c.fillStyle = '#8e5d33'; rr(c, -w/2 + 1, top - 6, w - 2, 7, 1.5); c.fill();
  c.fillStyle = '#4a2e1a'; c.fillRect(-w/2 + 3, top - 3, w - 6, 4);
  // the jars (with a packing bench, the gift jars stand among them)
  const g = part(S.hive.gift | 0), gc = cap;
  const shown = n <= 0 ? 0 : Math.max(1, Math.round(clamp(n/cap, 0, 1)*10));
  const gShown = g <= 0 ? 0 : Math.max(1, Math.round(clamp(g/cap, 0, 1)*10));
  let k = 0;
  CRATE_ROWS.forEach((row, ri) => row.forEach(x => {
    const idx = k++;
    if (idx >= shown + gShown) return;
    const wob = ri && hiveRt.bump > 0 ? Math.sin(hiveRt.bump*40)*0.3 : 0;
    (idx < shown ? drawJar : drawGiftJar)(c, x + wob, top - 1 - ri*10.5, 7.2);
  }));
  // the front: two pine slats between corner posts, with a few nails
  const slat = ['#c58c50', '#b77f47'];
  for (let i=0;i<2;i++){ c.fillStyle = slat[i]; rr(c, -w/2, top + i*10.8, w, 10, 1.8); c.fill(); c.fillStyle = 'rgba(255,236,200,.18)'; c.fillRect(-w/2 + 2, top + 1 + i*10.8, w - 4, 1.6); }
  c.strokeStyle = 'rgba(110,70,35,.35)'; c.lineWidth = 0.6;
  for (const [x0, y0, x1] of [[-18, top + 4, -10], [9, top + 6.5, 17], [-14, top + 16, -4]]){ c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1)/2, y0 + 1, x1, y0); c.stroke(); }
  c.fillStyle = '#8a5a30'; rr(c, -w/2 - 1, top - 1, 5.5, h + 1, 1.5); c.fill(); rr(c, w/2 - 4.5, top - 1, 5.5, h + 1, 1.5); c.fill();
  c.fillStyle = '#4a2c1a'; for (const yy of [top + 4, top + 15]){ ell(c, -w/2 + 1.8, yy, .8, .8); c.fill(); ell(c, w/2 - 1.8, yy, .8, .8); c.fill(); }
  // the chalkboard sign nailed to the front
  c.fillStyle = '#734428'; rr(c, -19, top + 2.5, 38, 15, 2.5); c.fill();
  c.fillStyle = '#2f3a34'; rr(c, -17.5, top + 4, 35, 12, 2); c.fill();
  c.fillStyle = '#b9a98a'; ell(c, 0, top + 3.1, .8, .8); c.fill();
  drawJar(c, -12.5, top + 10.4, 5);
  const label = (n + g) + '/' + cap; let fs = 12;
  c.font = '700 ' + fs + 'px Caveat, cursive'; const lw = c.measureText(label).width; if (lw > 25) fs = fs*25/lw;
  chalk(c, label, 3.5, top + 10, fs, full ? '#ffb38a' : '#efe8d8');
  if (keepJars() > 0) keepMark(c, -w/2 - 6, -2, top - 32, keepJars()/cap);
  if (S.hive.packing || g > 0){
    // a paper tag on a string from the back right corner counts the gift jars
    const tx0 = 15, ty0 = top - 19;
    c.strokeStyle = '#4a3226'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(w/2 - 2, top - 5); c.lineTo(tx0 + 9, ty0 + 1); c.stroke();
    c.fillStyle = '#f2e3c4'; rr(c, tx0, ty0, 19, 11, 2); c.fill(); c.strokeStyle = 'rgba(110,70,35,.45)'; c.lineWidth = 0.6; c.stroke();
    drawGiftJar(c, tx0 + 4.4, ty0 + 7.2, 4);
    const gl2 = '×' + g; let f2 = 8.5; c.font = '700 ' + f2 + 'px Caveat, cursive'; const w2 = c.measureText(gl2).width; if (w2 > 10) f2 = f2*10/w2;
    chalk(c, gl2, tx0 + 13.2, ty0 + 5.6, f2, '#4a3226');
  }
  c.restore();
}
// RAINY HOLLOW: robot ants instead of bees. Five builds, handed out in turn (worker, tank, strider, soldier, and a
// worker holding a leaf over its head like an umbrella). They all walk the same way along the ground (the bee code
// moves them; its height is ignored), cut mushrooms at the patches and carry the caps home on their backs.
const BEE_MODELS = ['worker', 'tank', 'strider', 'soldier', 'leafy'];
// one ant facing right, feet on y = 0. ph: walk cycle, moving: legs going, n: caps carried, cap: their colour
function drawAntShape(c, m, ph, moving, n, cap){
  const step = moving ? Math.sin(ph) : 0, step2 = moving ? Math.sin(ph + Math.PI) : 0;
  const legs = (xs, len, col, w) => {
    c.strokeStyle = col; c.lineWidth = w || 0.5; c.lineCap = 'round';
    xs.forEach((x, i) => { const s = (i % 2 ? step : step2)*1.4; c.beginPath(); c.moveTo(x, -2.4); c.lineTo(x + s*0.5 + (i - 1)*0.6, -3.6); c.lineTo(x + s + (i - 1)*1.3, 0); c.stroke(); });
  };
  const eye = (x, y, r) => { c.fillStyle = '#1e1a18'; ell(c, x, y, r, r); c.fill(); c.fillStyle = '#ffc457'; ell(c, x + r*0.25, y - r*0.1, r*0.55, r*0.55); c.fill(); };
  const feelers = (x, y, col) => { c.strokeStyle = col; c.lineWidth = 0.4; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 1.2, y - 2.6, x + 2.8, y - 3.2); c.moveTo(x - 0.4, y); c.quadraticCurveTo(x + 0.4, y - 2.8, x + 1.6, y - 3.8); c.stroke(); c.fillStyle = '#ff7a4d'; ell(c, x + 2.8, y - 3.2, 0.45, 0.45); c.fill(); };
  const caps = (x, y) => { for (let k=0;k<Math.min(3, n);k++){ const cx = x + [-0.4, 1.6, 0.4][k], cy = y - k*1.3; c.fillStyle = shade(cap, 0.7); ell(c, cx, cy + 0.4, 1.9, 1); c.fill(); c.fillStyle = cap; c.beginPath(); c.ellipse(cx, cy, 1.9, 1.5, 0, Math.PI, 0); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,255,255,.4)'; ell(c, cx - 0.6, cy - 0.8, 0.55, 0.3); c.fill(); } };
  if (m === 'tank'){
    // a boxy steel ant on two little treads, with big pincers
    c.fillStyle = '#2f2a26'; rr(c, -5, -1.8, 8, 2, 1); c.fill();
    c.fillStyle = '#4a423b'; for (let k=0;k<4;k++){ ell(c, -4 + k*2 + (moving ? (ph*0.4 % 2) : 0), -0.8, 0.4, 0.4); c.fill(); }
    c.fillStyle = '#7d878c'; rr(c, -5.4, -5.4, 6.4, 3.8, 1); c.fill(); c.fillStyle = '#a3abaf'; c.fillRect(-5, -5.2, 5.6, 0.8);
    c.fillStyle = '#d9a43a'; c.fillRect(-4, -5.4, 1, 3.8); c.fillRect(-2, -5.4, 1, 3.8);
    c.fillStyle = '#5c666b'; rr(c, 1, -5.2, 3.2, 3.2, 0.8); c.fill(); eye(3, -4, 0.8);
    c.strokeStyle = '#4a423b'; c.lineWidth = 0.6; const o = moving ? 0 : Math.sin(ph*3)*0.4; c.beginPath(); c.moveTo(4, -3); c.quadraticCurveTo(5.6, -3.4 - o, 5.8, -2.2); c.moveTo(4, -2.4); c.quadraticCurveTo(5.4, -1.6 + o, 5.8, -2.4); c.stroke();
    feelers(2.6, -5.2, '#4a423b'); caps(-2.6, -6.2);
  } else if (m === 'strider'){
    // slim and dark with long legs and an amber-striped tail
    legs([-1.6, 0, 1.6], 0, '#3b3430', 0.45);
    c.strokeStyle = '#3b3430'; c.lineWidth = 0.45; for (const [x, s] of [[-1, step], [1, step2]]){ c.beginPath(); c.moveTo(x, -3); c.lineTo(x + s*0.8, -5.6); c.lineTo(x + s*1.6 + 0.6, 0); c.stroke(); }
    c.fillStyle = '#2f2a26'; ell(c, -3.8, -4, 2.8, 1.8); c.fill();
    c.save(); ell(c, -3.8, -4, 2.8, 1.8); c.clip(); c.fillStyle = '#e0b13a'; c.fillRect(-5.2, -6, 0.8, 4); c.fillRect(-3.6, -6, 0.8, 4); c.restore();
    c.fillStyle = '#4a4440'; ell(c, -0.4, -4.2, 1.4, 1); c.fill();
    c.fillStyle = '#3b3632'; ell(c, 2, -4.8, 1.5, 1.3); c.fill(); eye(2.5, -4.9, 0.7);
    feelers(2.4, -5.8, '#3b3430'); caps(-3.6, -6.2);
  } else if (m === 'soldier'){
    // a big round enamelled head with jaws, a small body
    legs([-2.4, -0.8, 0.8], 0, '#4a3226', 0.55);
    c.fillStyle = '#7a3a24'; ell(c, -3.6, -3.4, 2.2, 1.7); c.fill();
    c.fillStyle = '#5e2c1c'; ell(c, -1.1, -3.4, 1.2, 1); c.fill();
    c.fillStyle = '#a84a2a'; ell(c, 1.8, -4, 2.5, 2.3); c.fill(); c.fillStyle = 'rgba(255,220,190,.35)'; ell(c, 1.2, -5.2, 1, 0.5); c.fill();
    eye(2.6, -4.4, 0.9);
    c.strokeStyle = '#c9a24a'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(3.8, -3); c.lineTo(5.4, -2.4); c.lineTo(4.6, -1.6); c.stroke();
    feelers(2.2, -6, '#4a3226'); caps(-3.6, -5.2);
  } else {
    // the classic: three polished copper segments, six legs, two feelers
    legs([-2, -0.4, 1.2], 0, '#4a3226', 0.5);
    c.fillStyle = '#8a4f2a'; ell(c, -3.4, -3.4, 2.6, 1.9); c.fill(); c.fillStyle = '#b86a38'; ell(c, -3.6, -3.8, 2.2, 1.4); c.fill();
    c.fillStyle = 'rgba(255,220,180,.45)'; ell(c, -4, -4.6, 1, 0.45); c.fill();
    c.fillStyle = '#7a4424'; ell(c, -0.4, -3.6, 1.3, 1.1); c.fill();
    c.fillStyle = '#9a5a30'; ell(c, 1.9, -4, 1.7, 1.5); c.fill(); eye(2.5, -4.1, 0.75);
    feelers(2.2, -5.2, '#4a3226'); caps(-3.4, -5.6);
    if (m === 'leafy'){
      // holding a leaf over its head like an umbrella
      c.strokeStyle = '#5a3a24'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(0.4, -4.4); c.lineTo(0.2, -9); c.stroke();
      c.save(); c.translate(0.2, -9.6); c.rotate(-0.15); c.scale(4.4, 2.2); leafPath(c, 0); c.fillStyle = '#c24a22'; c.fill(); c.lineWidth = 0.08; c.strokeStyle = '#7a2a12'; c.beginPath(); c.moveTo(-0.9, 0); c.lineTo(0.9, 0); c.stroke(); c.restore();
      c.fillStyle = 'rgba(210,228,240,.75)'; ell(c, 4, -8.8, 0.4, 0.6); c.fill();
    }
  }
}
function drawBees(V){
  const c = ctx;
  for (const b of B){
    if (b.st === 'in') continue;
    const x = b.x, y = b.y;
    if (x < V.x0 || x > V.x1 || y < V.y0 || y > V.y1 + 20) continue;
    const moving = b.st === 'fly' || b.st === 'home' || b.st === 'toWait' || b.st === 'queue' || (b.st === 'loiter' && Math.hypot(b.tx - b.x, b.ty - b.y) > 1);
    const tilt = moving ? clamp(Math.atan2(b.ty - b.y, Math.abs(b.tx - b.x) + 0.01)*0.45, -0.4, 0.4) : 0;
    c.fillStyle = 'rgba(20,12,6,.28)'; ell(c, x, y + 0.6, 5, 1.3); c.fill();
    c.save(); c.translate(x, y); c.scale(b.face*1.35, 1.35); c.rotate(tilt);
    if (b.st === 'sip'){ c.rotate(-0.12 + Math.sin(b.anim*14)*0.06); }
    const n = b.carry > 0 ? clamp(Math.ceil(b.carry/(beeSip(b)) - 1e-6), 1, 3) : 0, cap = FLOWER_TYPES[b.mty || 0].m.cap || '#c99448';
    drawAntShape(c, BEE_MODELS[b.i % BEE_MODELS.length], b.anim*14 + b.ph, moving, n, cap);
    c.restore();
    if (b.st === 'sip' && !simMode && Math.random() < 0.08) parts.push({ k:'speck', x: x + b.face*5, y: y - 2, vx: rand(-14, 14), vy: rand(-20, -8), g: 60, life: rand(.3, .5), t: 0 });
  }
}

// ───────────────────────── main step
function step(dt){
  S.t += dt;
  if (S.passive > 0) S.cash += S.passive*dt;   // WILDFLOWER PRAIRIE: income from the first yard
  updLeaves(dt);
  syncRobots(); syncHelpers();
  for (const r of R) updRobot(r, dt);
  updShakeTimers(dt);
  for (const h of HB) updHelper(h, dt);
  updFlowers(dt); syncBees();
  for (const b of B) updBee(b, dt);
  updHive(dt);
  updTruck(dt);
  updParts(dt);
  if (bumpBin > 0) bumpBin -= dt;
  if (S.cash > (S.peak || 0)) S.peak = S.cash;
  if (!S.flags.general && S.cash >= GEN_UNLOCK){
    S.flags.general = true;
    pop(SHED.x, SHED.y - 130, 'Yard-wide upgrades in the workshop', 'note', 18, 0.2); sparkle(SHED.x, SHED.y - 60);
  }
  // the beehive plot shows up once you've held a quarter of its price
  if (!S.flags.hiveShown && seenPrice(HIVE_COST)){
    S.flags.hiveShown = true; hiveRt.shownT = S.t;
    sparkle(HIVE.x, HIVE.y - 30); pop(HIVE.x + 20, HIVE.y - 70, 'New: a robotic ant hill', 'note', 18, 0.3); sfx('chime', 'sale');
  }
  // V6: the bagging table's spot shows up once sorting is maxed, the drying shed's once the metal is fully graded
  if (!S.flags.bagShown && upMaxed('leafPrice')){
    S.flags.bagShown = true; plantRt.bagShownT = S.t;
    sparkle(BAGGER.x, BAGGER.y - 30); pop(BAGGER.x, BAGGER.y - 70, 'New: a bagging table', 'note', 18, 0.3); sfx('chime', 'sale');
  }
  if (!S.flags.plantShown && S.metalSlot && plantGrade() && S.land >= PLANT_LAND && seenPrice(PLANT_COST)){
    S.flags.plantShown = true; plantRt.shownT = S.t;
    sparkle(PLANT.x, PLANT.y - 30); pop(PLANT.x, PLANT.y - 90, 'New: a drying shed', 'note', 18, 0.3); sfx('chime', 'sale');
  }
  if (plantRt.bump > 0) plantRt.bump = Math.max(0, plantRt.bump - dt);
  // the For Sale sign goes up once you have half the price
  const nxt = S.land + 1;
  if (nxt < AREAS.length && S.flags.saleShown < nxt && S.cash >= AREAS[nxt].cost*0.5){
    S.flags.saleShown = nxt; saleAppearT = S.t;
    const p = salePos(); sparkle(p.x, p.y - 30); pop(p.x, p.y - 84, nxt === MINE_LAND ? 'Land for sale next door' : 'Land for sale next door', 'note', 18, 0.3); sfx('chime', 'sale');
  }
  if (!S.flags.finished && S.robots.length >= ROBOT_MAX && S.miners.length >= SPOTS.length && S.plant.built){
    S.flags.finished = true;
    if (!simMode) showToast('The yard hums along nicely.', 'Ten robots, every pile sawn and the stoves roaring.', 9);
  }
}
const saleVisible = () => S.land + 1 < AREAS.length && S.flags.saleShown >= S.land + 1;
const baggerShown = () => S.bag.built || S.flags.bagShown;
const plantShown = () => S.plant.built || S.flags.plantShown;
const packShown = () => S.hive.built && (S.hive.packing || S.lv.honeyPrice >= 2);   // V8: labels go on past 2 steps; gift wrapping still shows after the second
const shaftShown = () => S.miners.length > 0 && seenPrice(SHAFT_COST);
// a mine shaft costs half once you already have one (like copying a robot upgrade)
const shaftCost = () => S.shafts.length ? niceCost(SHAFT_COST*DISCOUNT) : SHAFT_COST;
const plantRt = { bump: 0, shownT: -10, bagShownT: -10, builtT: -10, bagBuiltT: -10, packT: -10 };

// ───────────────────────── offers / buying
function offers(all){
  const o = [];
  const up = k => ({ id:'up', key:k, obj: UP[k].obj, cost: upCost(k), maxed: S.lv[k] >= UP[k].max });
  o.push(up('bin'), up('leafPrice'), up('truck'));
  if (S.lv.cleanup < UP.cleanup.max && (all || seenPrice(upCost('cleanup')))) o.push(up('cleanup'));
  if (!S.metalSlot){ if (metalSlotShown()) o.push({ id:'metalSlot', obj:'bin', cost: METAL_SLOT_COST }); }
  else o.push(up('metalPrice'), up('metalBin'));
  S.robots.forEach((cfg, ri) => {
    for (const k of TRACK_ORDER){
      if (!trackVisible(k) || cfg.lv[k] >= trackCap(k)) continue;
      const c = rCost(ri, k); if (!c) continue;
      o.push({ id:'rup', ri, key:k, obj:'robot'+ri, cost:c.cost });
    }
  });
  for (const kind of ['blower', 'shaker']) cfgsOf(kind).forEach((cfg, i) => {
    for (const k of BOT_TRACKS[kind]){
      if (!trackVisible(k) || cfg.lv[k] >= trackCap(k)) continue;
      const c = botCost(kind, i, k); if (!c) continue;
      o.push({ id:'hup', kind, ri:i, key:k, obj:kind + i, cost:c.cost });
    }
  });
  for (const kind of ['blower', 'shaker']) if (all ? cfgsOf(kind).length < HELPER_MAX : helperShown(kind)) o.push({ id:kind, obj:'shed', cost: helperCost(kind) });
  for (const id in TECH) if (techAvailable(id)){ const tk = TECH[id].track, kind = tk === 'blow' || tk === 'dig' || tk === 'stoke' ? 'blower' : tk === 'shake' ? 'shaker' : 'robot'; o.push({ id:'tech', key:id, obj: kind + '0', cost: TECH[id].cost }); }
  if (genVisible()) for (const k in GEN) if (genAvail(k)) o.push({ id:'gen', key:k, obj:'shed', cost: genCost(k) });
  if (S.robots.length < ROBOT_MAX) o.push({ id:'robot', obj:'shed', cost: robotCost(S.robots.length) });
  if (S.metalSlot) SPOTS.forEach((p, i) => { if (p.land <= S.land && !S.miners.includes(i)) o.push({ id:'miner', arg:i, obj:'spot'+i, cost: MINER_COST }); });
  // V6 refinement
  if (!S.bag.built){ if (all ? upMaxed('leafPrice') : baggerShown()) o.push({ id:'bagger', obj:'bagger', cost: BAGGER_COST }); }
  else o.push(up('bagPrice'));
  if (S.hive.built && S.hive.bees > 0){ if (!S.hive.packing){ if (packShown()) o.push({ id:'honeyPack', obj:'hive', cost: HONEY_PACK_COST }); } else o.push(up('giftPrice')); }
  if (!S.plant.built){ if (all ? S.metalSlot && plantGrade() && S.land >= PLANT_LAND : plantShown()) o.push({ id:'plant', obj:'plant', cost: PLANT_COST }); }
  else o.push(up('smeltSpeed'), up('ingotGrade'), up('slag'), up('hopper'));
  if (all ? S.miners.length : shaftShown()) for (const sp of S.miners) if (!S.shafts.includes(sp)) o.push({ id:'shaft', arg:sp, obj:'spot'+sp, cost: shaftCost() });
  if (S.land + 1 < AREAS.length && (all || saleVisible())) o.push({ id:'land', obj:'sale', cost: AREAS[S.land + 1].cost });
  if (!S.hive.built){ if (all || hiveShown()) o.push({ id:'hive', obj:'hive', cost: HIVE_COST }); }
  else {
    if (S.hive.bees < maxBees()) o.push({ id:'bee', obj:'hive', cost: beeCost() });
    if (S.hive.bees > 0){
      o.push(up('hiveTank'), up('hiveStore'), up('honeyPrice'));
      for (const k in HIVE_UP) if (!S.hive.up[k]) o.push({ id:'hiveUp', key:k, obj:'hive', cost: hiveUpCost() });
    }
  }
  return o.filter(x => !x.maxed);
}
function objPos(obj){
  if (obj === 'bin') return { x: BIN.x, y: BIN.y - 66 };
  if (obj === 'sign') return { x: SIGN.x, y: SIGN.y - 84 };
  if (obj === 'shed') return { x: SHED.x, y: SHED.y - 106 };
  if (obj === 'sale'){ const p = salePos(); return { x: p.x, y: p.y - 86 }; }
  if (obj === 'hive') return { x: HIVE.x, y: HIVE.y - (S.hive.built ? hiveTopZ() + 60 : 58) };
  if (obj === 'bagger') return { x: BAGGER.x, y: BAGGER.y - 64 };
  if (obj === 'plant') return { x: PLANT.x, y: PLANT.y - (S.plant.built ? 150 : 64) };
  if (obj.startsWith('robot')){ const r = R[+obj.slice(5)]; return r ? { x: r.x, y: r.y - 72 } : null; }
  if (obj.startsWith('blower') || obj.startsWith('shaker')){ const kind = obj.slice(0, 6), i = +obj.slice(6), h = HB.find(q => q.kind === kind && q.idx === i); return h ? { x: h.x, y: h.y - (kind === 'blower' ? 52 : 58) } : null; }
  if (obj.startsWith('spot')){ const i = +obj.slice(4), p = SPOTS[i]; return { x: p.x, y: p.y - (S.shafts.includes(i) ? 112 : S.miners.includes(i) ? 86 : 44) }; }
  return null;
}

function buy(o){
  if (o.maxed || S.cash + 1e-9 < o.cost) return false;
  S.cash -= o.cost;
  if (o.id === 'up'){
    S.lv[o.key]++;
    const p = objPos(o.obj); if (p){ pop(p.x, p.y, (o.key === 'cleanup' ? UP.cleanup.name(S.lv.cleanup - 1) : UP[o.key].name) + '!', 'note', 16); sparkle(p.x, p.y + 20); }
    if (o.key === 'truck') S.truckT = Math.min(S.truckT, truckEvery());
  } else if (o.id === 'rall'){
    peersFor(o.key).forEach(c => { const was = c.lv[o.key]; c.lv[o.key] = Math.max(c.lv[o.key], o.target); if (!was && c.lv[o.key]){ if (o.key === 'snip') putBeside(c, 'snip', 'shake'); if (o.key === 'dig') putBeside(c, 'dig', 'blow'); if (o.key === 'stoke') putBeside(c, 'stoke', 'blow'); if (o.key === 'brolly') putBeside(c, 'brolly', 'blow'); } });
    for (const r of R) if (o.key === 'speed' || BOT_TRACKS.robot.includes(o.key)) sparkle(r.x, r.y - 30);
    for (const h of HB) if (BOT_TRACKS[h.kind].includes(o.key)) sparkle(h.x, h.y - 20);
    const p = objPos(o.obj); if (p) pop(p.x, p.y - 4, 'Every robot: ' + TRACKS[o.key].label + ' ' + o.target, 'note', 16);
  } else if (o.id === 'rup'){
    S.robots[o.ri].lv[o.key]++;
    const r = R[o.ri]; if (r){ pop(r.x, r.y - 76, TRACKS[o.key].label + ' upgraded', 'note', 16); sparkle(r.x, r.y - 30); }
  } else if (o.id === 'hup'){
    const hc = cfgsOf(o.kind)[o.ri]; hc.lv[o.key]++;
    if (o.key === 'snip' && hc.lv.snip === 1) putBeside(hc, 'snip', 'shake');
    if (o.key === 'dig' && hc.lv.dig === 1) putBeside(hc, 'dig', 'blow');
    if (o.key === 'stoke' && hc.lv.stoke === 1) putBeside(hc, 'stoke', 'blow');
    if (o.key === 'brolly' && hc.lv.brolly === 1) putBeside(hc, 'brolly', 'blow');
    const h = HB.find(q => q.kind === o.kind && q.idx === o.ri); if (h){ pop(h.x, h.y - 60, TRACKS[o.key].label + ' upgraded', 'note', 16); sparkle(h.x, h.y - 20); }
  } else if (o.id === 'blower' || o.id === 'shaker'){
    const i = cfgsOf(o.id).length;
    cfgsOf(o.id).push(newHelperCfg(o.id)); syncHelpers();
    const st = (o.id === 'blower' ? BLOWER_STYLES : SHAKER_STYLES)[i];
    pop(SHED.x, SHED.y - 112, st.name + ' joins the yard', 'note', 17); sparkle(SHED.x + 34, SHED.y);
  } else if (o.id === 'tech'){
    S.tech[o.key] = true; S.flags.research = true;
    const p = objPos(o.obj) || { x: SHED.x, y: SHED.y - 112 };
    pop(p.x, p.y - 6, TECH[o.key].name + ' unlocked', 'note', 17);
    const tk = TECH[o.key].track;
    for (const r of R) if (BOT_TRACKS.robot.includes(tk)) sparkle(r.x, r.y - 30);
    for (const h of HB) if (BOT_TRACKS[h.kind].includes(tk)) sparkle(h.x, h.y - 20);
  } else if (o.id === 'gen'){
    S.gen[o.key] = gl(o.key) + 1;
    pop(SHED.x, SHED.y - 112, GEN[o.key].name + '!', 'note', 17); sparkle(SHED.x, SHED.y - 60);
    if (o.key === 'twin'){
      twinRt.builtT = S.t;
      pop(HIVE2.x, HIVE2.y - 130, 'A second ant hill!', 'note', 19, 0.6); sparkle(HIVE2.x, HIVE2.y - 60); sparkle(CRATE2.x, CRATE2.y - 20);
      if (!simMode) for (let i=0;i<12;i++) parts.push({ k:'dust', x: HIVE2.x + rand(-30,30), y: HIVE2.y + rand(-2, 6), vx: rand(-24,24), vy: rand(-22,-5), g:0, life: rand(.8,1.4), t:0, r: rand(5,9), gray:true });
    }
    if (o.key === 'seeding'){ let k = 0; for (const f of FLOWERS) if (f.tier === gl('seeding') && f.land <= S.land && k++ % 3 === 0) sparkle(f.x, f.y - 8); }
  } else if (o.id === 'hive'){
    S.hive.built = true; S.flags.hiveShown = true; hiveRt.builtT = S.t; openTasks(['jar']);
    pop(HIVE.x, HIVE.y - 120, 'Robotic ant hill built!', 'note', 19, 0.6); sparkle(HIVE.x, HIVE.y - 60);
    autoAssign('jar', CRATE, 'will fill the punnets');
    if (!simMode) for (let i=0;i<12;i++) parts.push({ k:'dust', x: HIVE.x + rand(-30,30), y: HIVE.y + rand(-2, 6), vx: rand(-24,24), vy: rand(-22,-5), g:0, life: rand(.8,1.4), t:0, r: rand(5,9), gray:true });
  } else if (o.id === 'bee'){
    S.hive.bees++; syncBees();
    const b = B[B.length - 1]; if (b) b.timer = 0.15;
    pop(HIVE.x + 16, HIVE.y - hiveTopZ() - 20, S.hive.bees === 1 ? 'Your first ant!' : 'Ant ' + S.hive.bees + ' joins the ant hill', 'note', 16);
  } else if (o.id === 'hiveUp'){
    S.hive.up[o.key] = true;
    pop(HIVE.x, HIVE.y - hiveTopZ() - 22, HIVE_UP[o.key].name + '!', 'note', 17); sparkle(HIVE.x, HIVE.y - hiveTopZ()*0.6);
  } else if (o.id === 'bagger'){
    S.bag.built = true; S.flags.bagShown = true; plantRt.bagBuiltT = S.t; openTasks(['bag']);
    pop(BAGGER.x, BAGGER.y - 90, 'Bagging table built!', 'note', 19, 0.4); sparkle(BAGGER.x, BAGGER.y - 30);
    autoAssign('bag', BAGGER, 'will bag leaves');
  } else if (o.id === 'honeyPack'){
    S.hive.packing = true; plantRt.packT = S.t; openTasks(['wrap']);
    pop(CRATE.x, CRATE.y - 80, 'Gift wrapping at the crate', 'note', 18, 0.3); sparkle(CRATE.x, CRATE.y - 30);
    autoAssign('wrap', CRATE, 'will wrap gift baskets');
  } else if (o.id === 'plant'){
    S.plant.built = true; S.flags.plantShown = true; plantRt.builtT = S.t; openTasks(['smelt', 'haul']);
    pop(PLANT.x, PLANT.y - 150, 'Drying shed built!', 'note', 20, 0.8); sparkle(PLANT.x, PLANT.y - 60);
    if (!simMode) for (let i=0;i<16;i++) parts.push({ k:'dust', x: PLANT.x + rand(-70,70), y: PLANT.y + rand(-2, 6), vx: rand(-24,24), vy: rand(-22,-5), g:0, life: rand(.8,1.4), t:0, r: rand(5,9), gray:true });
    autoAssign('smelt', PLANT, 'will dry wood and haul it');
  } else if (o.id === 'shaft'){
    S.shafts.push(o.arg); fixSlots();
    const p = SPOTS[o.arg];
    pop(p.x, p.y - 130, 'Wood shelter built!', 'note', 19, 0.3); sparkle(p.x, p.y - 40);
    if (!simMode) for (let i=0;i<14;i++) parts.push({ k:'dust', x:p.x+rand(-24,24), y:p.y, vx:rand(-20,20), vy:rand(-25,-5), g:0, life:rand(.8,1.4), t:0, r:rand(5,9) });
    if (S.shafts.length === 1 && S.blowers.length) pop(p.x, p.y - 108, 'Blowers can learn to dry the pile here', 'note', 15, 1.2);
  } else if (o.id === 'metalSlot'){
    S.metalSlot = true; openTasks(['mine']);
    pop(TUB.x, TUB.y - 72, 'Log crib added', 'note', 17); sparkle(TUB.x, TUB.y - 30);
  } else if (o.id === 'robot'){
    const i = S.robots.length;
    S.robots.push(newRobotCfg()); syncRobots();
    pop(SHED.x, SHED.y - 112, STYLES[i].name + ' joins the yard', 'note', 17); sparkle(SHED.x, SHED.y);
  } else if (o.id === 'miner'){
    S.miners.push(o.arg);
    const p = SPOTS[o.arg];
    const near = (a, b) => Math.hypot(a.x-p.x,a.y-p.y) - Math.hypot(b.x-p.x,b.y-p.y);
    // someone who already wants to mine but has no miner goes first; otherwise the first miner pulls a robot over
    const waiting = R.filter(r => taskTop(S.robots[r.id], 'mine') && S.robots[r.id].miner == null).sort(near);
    // the first miner pulls over the nearest robot that has Mine metal anywhere on its list (never one that has it in Don't)
    const first = S.miners.length === 1 ? R.filter(r => taskOn(S.robots[r.id], 'mine') && S.robots[r.id].miner == null).sort(near)[0] : null;
    const who = waiting[0] || first;
    if (who){ assign(who.id, o.arg); pop(p.x, p.y - 100, STYLES[who.id].name + ' heads over to saw', 'note', 16, 0.3); }
    else pop(p.x, p.y - 100, 'Tap a robot and drag Saw wet wood into its Do list', 'note', 16, 0.3);
    sparkle(p.x, p.y - 20);
    if (!simMode) for (let i=0;i<10;i++) parts.push({ k:'dust', x:p.x+rand(-24,24), y:p.y, vx:rand(-20,20), vy:rand(-25,-5), g:0, life:rand(.8,1.4), t:0, r:rand(5,9) });
  } else if (o.id === 'land'){
    const from = salePos(), old = owned();
    S.land++;
    const A = AREAS[S.land], O = owned();
    for (let i=0, n=0; i<A.cap*3 && n < A.cap*0.45; i++){
      const x = rand(O.x0 + 10, O.x1 - 10), y = rand(O.y0 + 8, O.y1 - 6);
      if (x > old.x0 && x < old.x1 && y > old.y0) continue;
      if (!landingOK(x, y)) continue;
      const l = newLeaf(x, y, y, true); l.st = 'ground'; leaves.push(l); n++;
    }
    if (!simMode){
      sparkle(from.x, from.y - 30);
      pop(from.x, from.y - 60, 'The yard grew!', 'note', 22);
      closeCard();
      const to = camTarget(S.land);
      camAnim = { from: { z: cam.z, ox: cam.ox, oy: cam.oy }, to, t: 0, dur: 2.6 };
      userCam = false; $('recenter').hidden = true;
      buildGround(to);
    }
  }
  // buying things is silent on purpose; only a new robot says hello
  if (o.id === 'robot'){ const r = R[R.length - 1]; if (r && !simMode) setTimeout(() => robotSays(r, 'hello', true), 450); }
  if (o.id === 'blower' || o.id === 'shaker'){ const h = HB[HB.length - 1]; if (h && !simMode) setTimeout(() => { const a = sndAt(h.x, h.y); sfx('beep', h.kind === 'blower' ? 5 : 6, 'hello', a.pan, a.vol, true); }, 450); }
  save();
  return true;
}
// send a robot to a miner: Mine metal goes to the top of its list
function assign(ri, spot){
  const cfg = S.robots[ri], r = R[ri];
  putTop(cfg, 'mine');
  if (spot != null && minerWorkers(spot).length < slotsAt(spot)){ if (r) claimSlot(r, spot); else cfg.miner = spot; }
  if (r){ release(r); if (r.st !== 'dump' && r.st !== 'wait') r.st = 'idle'; }
  S.flags.sentHint = true;
}
// stop a robot mining: Mine metal goes to its Don't pile
function unassign(ri){
  const cfg = S.robots[ri]; putOff(cfg, 'mine'); cfg.miner = null;
  if (!cfg.prio.length){ taskRemove(cfg, 'leaves'); cfg.prio.push(['leaves']); }
  const r = R[ri]; if (r && (r.st === 'mine' || r.st === 'toMine')){ r.st = 'idle'; r.mineP = 0; }
}
// a new work building gets a robot of its own: the nearest one that isn't busy with something special gets the task at the top
// after a new building: say who will work there (the nearest robot with the task on its list), or how to get someone to
function autoAssign(t, at, says){
  const near = (a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y);
  const r = R.filter(q => taskOn(S.robots[q.id], t)).sort(near)[0];
  if (!r){ pop(at.x, at.y - 110, 'Drag ' + TASKS[t].name + ' into a robot’s Do list', 'note', 16, 0.9); return null; }
  if (r.st === 'wander' || r.st === 'rest' || r.st === 'seek'){ release(r); r.st = 'idle'; }
  pop(at.x, at.y - 110, STYLES[r.id].name + ' ' + says, 'note', 16, 0.9);
  return r.id;
}

// ───────────────────────── static art: ground, canopies, vignette
// RAINY HOLLOW: soaked brown ground. Mud and wet earth with only a little tired grass, moss, lots of fallen wet leaves,
// twigs, pebbles and little mushrooms everywhere; muddy beds for the puddles. Beyond the fence: dead bracken, wet tall
// grass, half-bare shrubs, fairy rings and fallen logs with shelf fungus.
const MUD = ['#4a3c2a', '#58472f', '#3f3324', '#66543a', '#514a2e', '#5d5233'];
function buildGround(c){
  const mx = Math.round(W*0.35), my = Math.round(H*0.35);
  const rs = Math.min(DPR, Math.sqrt(9e6/((W + 2*mx)*(H + 2*my))));
  groundCam = { z: c.z, ox: c.ox, oy: c.oy, mx, my, rs };
  groundCv = document.createElement('canvas');
  groundCv.width = Math.ceil((W + 2*mx)*rs); groundCv.height = Math.ceil((H + 2*my)*rs);
  const g = groundCv.getContext('2d');
  g.setTransform(rs*c.z, 0, 0, rs*c.z, rs*(c.ox + mx), rs*(c.oy + my));
  const V = { x0: -(c.ox + mx)/c.z - 30, x1: (W + mx - c.ox)/c.z + 30, y0: -(c.oy + my)/c.z - 30, y1: (H + my - c.oy)/c.z + 30 };
  const O = owned();
  const gr = g.createLinearGradient(0, V.y0, 0, 0);
  gr.addColorStop(0, '#463a29'); gr.addColorStop(0.6, '#54452f'); gr.addColorStop(1, '#5c4c33');
  g.fillStyle = gr; g.fillRect(V.x0, V.y0, V.x1 - V.x0, -V.y0 + 2);
  const CS = 128, i0 = Math.floor(V.x0/CS), i1 = Math.ceil(V.x1/CS), j0 = Math.floor(V.y0/CS), j1 = 1;
  const inOwned = (x, y, m) => x > O.x0 - m && x < O.x1 + m && y > O.y0 - m;
  const glow = (x, y, r, col, a) => { const rg = g.createRadialGradient(x,y,0,x,y,r); rg.addColorStop(0, col + a); rg.addColorStop(1, col + '00'); g.fillStyle = rg; g.fillRect(x-r,y-r,r*2,r*2); };
  // big soft patches: darker mud, olive-brown earth and the odd tired green
  const patch = ['#3a2f21', '#62523a', '#4e5a2e', '#6b5838', '#433726', '#56602f', '#705d3c'];
  for (let i=i0;i<i1;i++) for (let j=j0;j<j1;j++){
    const rnd = cellRnd(i, j, 1);
    for (let k=0;k<2;k++) glow((i + rnd())*CS, (j + rnd())*CS, 50 + rnd()*110, patch[Math.floor(rnd()*patch.length)], '80');
  }
  // damp shade under the trees
  for (const t of TREES){ const x = t.x + t.r*0.15, y = t.y + t.r*0.6, r = t.r*1.05; const rg = g.createRadialGradient(x,y,r*0.2,x,y,r); rg.addColorStop(0,'rgba(25,18,10,.3)'); rg.addColorStop(1,'rgba(25,18,10,0)'); g.fillStyle = rg; g.fillRect(x-r,y-r,r*2,r*2); }
  // the puddles' beds: a dark soaked halo and a slick muddy rim (the water is drawn live on top)
  for (const p of PUDDLES){
    if (p.x + p.rx*2 < V.x0 || p.x - p.rx*2 > V.x1 || p.y + p.ry*3 < V.y0 || p.y - p.ry*3 > V.y1) continue;
    g.save(); g.translate(p.x, p.y); g.scale(1, p.ry/p.rx);
    const hr = p.rx*1.75, rg = g.createRadialGradient(0, 0, p.rx*0.7, 0, 0, hr);
    rg.addColorStop(0, p.road ? 'rgba(15,14,16,.5)' : 'rgba(30,20,12,.55)'); rg.addColorStop(1, 'rgba(30,20,12,0)');
    g.fillStyle = rg; ell(g, 0, 0, hr, hr); g.fill(); g.restore();
    puddleTrace(g, p, p.road ? 3 : 5); g.fillStyle = p.road ? '#2c2a2c' : '#3a2c1d'; g.fill();
    puddleTrace(g, p, p.road ? 1.5 : 2.5); g.fillStyle = p.road ? '#252326' : '#30251a'; g.fill();
    if (!p.road){ const rnd = mulberry(p.seed + 5); for (let k=0;k<10;k++){ const a = rnd()*TAU, x = p.x + Math.cos(a)*(p.rx + 4 + rnd()*5), y = p.y + Math.sin(a)*(p.ry + 2 + rnd()*3); g.fillStyle = rnd() < .5 ? 'rgba(120,98,70,.5)' : 'rgba(22,16,10,.4)'; ell(g, x, y, 1.6 + rnd()*2.2, 0.8 + rnd()); g.fill(); } }
  }
  g.lineCap = 'round';
  for (let i=i0;i<i1;i++) for (let j=j0;j<j1;j++){
    const rnd = cellRnd(i, j, 2);
    // mottled earth: little dark and light flecks of mud
    for (let k=0;k<90;k++){
      const x = (i + rnd())*CS, y = (j + rnd())*CS, r = 0.7 + rnd()*1.6;
      if (y > -VERGE - 1) continue;
      g.fillStyle = rnd() < 0.55 ? 'rgba(28,20,12,.28)' : 'rgba(150,124,88,.16)'; ell(g, x, y, r*1.4, r*0.8); g.fill();
    }
    // tired, flattened grass in sparse tufts
    for (let k=0;k<7;k++){
      const x0 = (i + rnd())*CS, y0 = (j + rnd())*CS, n = 4 + Math.floor(rnd()*6);
      if (y0 > -VERGE - 2) continue;
      for (let m=0;m<n;m++){
        const x = x0 + (rnd() - 0.5)*10, y = y0 + (rnd() - 0.5)*4, h = 3 + rnd()*5, lean = (rnd() - 0.5)*5, tone = rnd();
        g.strokeStyle = tone < 0.4 ? 'rgba(70,84,36,.75)' : tone < 0.75 ? 'rgba(108,112,52,.7)' : 'rgba(140,128,74,.6)';
        g.lineWidth = 1.05; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + lean*0.4, y - h*0.7, x + lean, y - h); g.stroke();
      }
    }
    // moss cushions
    if (rnd() < 0.55){
      const cx = (i + rnd())*CS, cy = (j + rnd())*CS, n = 10 + Math.floor(rnd()*16);
      if (cy < -VERGE - 6) for (let m=0;m<n;m++){
        const x = cx + (rnd() - 0.5)*22, y = cy + (rnd() - 0.5)*9;
        g.fillStyle = ['#4a6526', '#5d7a2e', '#6f8c36', '#3f5520'][Math.floor(rnd()*4)]; ell(g, x, y, 1.6 + rnd()*1.8, 1.1 + rnd()); g.fill();
      }
    }
    // fallen wet leaves: plenty of them, flattened into the mud
    for (let k=0;k<16;k++){
      const x = (i + rnd())*CS, y = (j + rnd())*CS, ci = Math.floor(rnd()*LEAFC.length), s = 3 + rnd()*3.4, rot = rnd()*TAU, sh = rnd() < .5 ? 1 : 0, a = 0.35 + rnd()*0.4;
      if (y > -VERGE - 4) continue;
      g.globalAlpha = a; drawLeaf(g, x, y, s, rot, ci, sh, 1, 0.7, 1, 0.3); g.globalAlpha = 1;
    }
    // twigs
    for (let k=0;k<4;k++){
      const x = (i + rnd())*CS, y = (j + rnd())*CS, a = rnd()*TAU, L = 5 + rnd()*10;
      if (y > -VERGE - 4) continue;
      g.strokeStyle = rnd() < .5 ? 'rgba(54,36,22,.8)' : 'rgba(92,66,44,.75)'; g.lineWidth = 0.9 + rnd()*0.6;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a)*L, y + Math.sin(a)*L*0.5); g.stroke();
      if (rnd() < .6){ const m = 0.4 + rnd()*0.3; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x + Math.cos(a)*L*m, y + Math.sin(a)*L*m*0.5); g.lineTo(x + Math.cos(a + 0.6)*L*m + Math.cos(a)*3, y + Math.sin(a + 0.6)*L*m*0.5 - 1.5); g.stroke(); }
    }
    // pebbles, shiny with rain
    for (let k=0;k<3;k++){
      const x = (i + rnd())*CS, y = (j + rnd())*CS, s = 1.6 + rnd()*2.6;
      if (y > -VERGE - 6) continue;
      g.fillStyle = 'rgba(20,14,8,.3)'; ell(g, x + 0.8, y + 1, s*1.1, s*0.55); g.fill();
      g.fillStyle = ['#7b766c', '#8c867a', '#6a655c'][Math.floor(rnd()*3)]; ell(g, x, y, s, s*0.66); g.fill();
      g.fillStyle = 'rgba(235,240,245,.45)'; ell(g, x - s*0.3, y - s*0.28, s*0.32, s*0.16); g.fill();
    }
  }
  drawDecoFlowers(g, V);
  SPOTS.forEach((p, i) => drawRockBed(g, p.x, p.y, 100 + i));
  // wild land beyond the fence: darker and overgrown
  g.save();
  g.beginPath(); g.rect(V.x0, V.y0, V.x1 - V.x0, -VERGE - V.y0); g.rect(O.x0, O.y0, O.x1 - O.x0, O.y1 - O.y0);
  g.fillStyle = 'rgba(22,18,10,.26)'; g.fill('evenodd');
  g.restore();
  for (let i=i0;i<i1;i++) for (let j=j0;j<j1;j++){
    const rnd = cellRnd(i, j, 3);
    // dead bracken: rust-brown fern fronds
    for (let k=0;k<4;k++){
      const x = (i + rnd())*CS, y = (j + rnd())*CS, s = 0.8 + rnd()*0.6, col = ['#8a4a22', '#9c5a28', '#6e3c1c', '#7a6a30'][Math.floor(rnd()*4)];
      if (y > -VERGE - 8 || inOwned(x, y, 16)) continue;
      for (let f=0;f<5;f++){
        const a = -Math.PI/2 + (f - 2)*0.42 + (rnd() - 0.5)*0.2, L = (16 + rnd()*8)*s;
        const ex = x + Math.cos(a)*L, ey = y + Math.sin(a)*L*0.8;
        g.strokeStyle = shade(col, 0.7); g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a)*L*0.5, y + Math.sin(a)*L*0.5 - 3, ex, ey); g.stroke();
        g.strokeStyle = col; g.lineWidth = 1.5;
        for (let q=1;q<7;q++){ const u = q/7, px = lerp(x, ex, u), py = lerp(y, ey, u) - Math.sin(u*Math.PI)*3, w = (1 - u)*5*s + 1.2; g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a - 1.3)*w, py + Math.sin(a - 1.3)*w); g.moveTo(px, py); g.lineTo(px + Math.cos(a + 1.3)*w, py + Math.sin(a + 1.3)*w); g.stroke(); }
      }
    }
    // wet tall grass, bent over
    for (let k=0;k<5;k++){
      const x = (i + rnd())*CS, y = (j + rnd())*CS, dry = rnd() < .5;
      if (y > -VERGE - 6 || inOwned(x, y, 14)) continue;
      for (let m=0;m<7;m++){ const a = -Math.PI/2 + (m - 3)*0.22 + 0.25, h = 13 + (m%3)*4; g.strokeStyle = dry ? (m%2 ? '#8f8050' : '#74683e') : (m%2 ? '#5d6a30' : '#4a5626'); g.lineWidth = 1.2; g.beginPath(); g.moveTo(x + m*1.3, y); g.quadraticCurveTo(x + m*1.3 + Math.cos(a)*7, y - 8, x + m*1.3 + Math.cos(a)*16, y - h + 3); g.stroke(); }
    }
    // a fairy ring of little mushrooms now and then
    if (rnd() < 0.16){
      const cx = (i + rnd())*CS, cy = (j + rnd())*CS, R0 = 14 + rnd()*14, n = 9 + Math.floor(rnd()*6), ty = Math.floor(rnd()*MUSH_DECO.length);
      if (!(cy > -VERGE - 30 || inOwned(cx, cy, R0 + 20))) for (let m=0;m<n;m++){ const a = m/n*TAU + rnd()*0.3; drawTinyMush(g, cx + Math.cos(a)*R0, cy + Math.sin(a)*R0*0.5, 0.8 + rnd()*0.4, MUSH_DECO[ty]); }
    }
    // a fallen log, mossy, with shelf fungus
    if (rnd() < 0.12){
      const x = (i + rnd())*CS, y = (j + rnd())*CS;
      if (!(y > -VERGE - 24 || inOwned(x, y, 50))) drawFallenLog(g, x, y, 0.8 + rnd()*0.5, rnd);
    }
    if (rnd() < 0.42){
      const x = (i + rnd())*CS, y = (j + rnd())*CS;
      if (!(y > -VERGE - 20 || inOwned(x, y, 30))) drawBush(g, x, y, 0.85 + rnd()*0.5, cellRnd(i, j, 6));
    }
  }
  drawFence(g, O);
  // the verge: wet dark gravel with a fringe of tired grass and a few leaves
  const vy = -VERGE;
  g.fillStyle = '#7c7262'; g.fillRect(V.x0, vy, V.x1 - V.x0, VERGE);
  const vg = g.createLinearGradient(0, vy - 6, 0, vy + 7); vg.addColorStop(0, 'rgba(70,62,38,1)'); vg.addColorStop(1, 'rgba(70,62,38,0)'); g.fillStyle = vg; g.fillRect(V.x0, vy - 6, V.x1 - V.x0, 13);
  for (let i=i0;i<i1;i++){
    const rnd = cellRnd(i, 0, 4);
    for (let k=0;k<110;k++){ const x = (i + rnd())*CS, y = vy + 4 + rnd()*(VERGE - 5), ci = Math.floor(rnd()*4), rx = 1 + rnd()*1.6, ry = 0.8 + rnd()*1.1; g.fillStyle = ['#6a6152','#958a77','#5e564a','#a39883'][ci]; ell(g, x, y, rx, ry); g.fill(); if (rnd() < 0.18){ g.fillStyle = 'rgba(230,236,242,.4)'; ell(g, x - rx*0.3, y - ry*0.4, rx*0.4, ry*0.25); g.fill(); } }
    for (let k=0;k<16;k++){ const x = (i + rnd())*CS, tone = rnd(), dx = (rnd()-.5)*4, h = 2 + rnd()*5; g.strokeStyle = tone < .5 ? '#55602c' : '#6f7438'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(x, vy + 2); g.lineTo(x + dx, vy + 2 + h); g.stroke(); }
    for (let k=0;k<6;k++){ const x = (i + rnd())*CS, y = vy + 3 + rnd()*(VERGE - 6); g.globalAlpha = 0.6; drawLeaf(g, x, y, 3.5 + rnd()*2, rnd()*TAU, Math.floor(rnd()*LEAFC.length), rnd() < .5 ? 1 : 0, 1, 0.7, 1, 0.25); g.globalAlpha = 1; }
  }
  // the road: dark wet asphalt with a soft sheen of the grey sky on it
  g.fillStyle = '#9a917e'; g.fillRect(V.x0, 0, V.x1 - V.x0, 6);
  g.fillStyle = '#6f675a'; g.fillRect(V.x0, 6, V.x1 - V.x0, 2);
  const rg2 = g.createLinearGradient(0, 8, 0, ROAD + 40); rg2.addColorStop(0, '#3b3738'); rg2.addColorStop(0.5, '#423e40'); rg2.addColorStop(1, '#343032');
  g.fillStyle = rg2; g.fillRect(V.x0, 8, V.x1 - V.x0, V.y1 - 8);
  for (let i=i0;i<i1;i++){
    const rnd = cellRnd(i, 1, 5);
    for (let k=0;k<70;k++){ const x = (i + rnd())*CS, y = 9 + rnd()*(ROAD + 10), light = rnd() < .5; g.fillStyle = light ? 'rgba(220,230,240,.05)' : 'rgba(0,0,0,.1)'; g.fillRect(x, y, 1.6, 1.6); }
    // long soft streaks where the sky shows in the wet road
    for (let k=0;k<5;k++){ const x = (i + rnd())*CS, y = 12 + rnd()*(ROAD - 8), w = 20 + rnd()*60; g.fillStyle = 'rgba(170,185,200,' + (0.04 + rnd()*0.05) + ')'; rr(g, x, y, w, 1.2 + rnd()*2.2, 1); g.fill(); }
    for (let k=0;k<4;k++){ const x = (i + rnd())*CS, y = 14 + rnd()*(ROAD - 18), rot = rnd()*TAU, ci = Math.floor(rnd()*LEAFC.length); g.globalAlpha = .6; drawLeaf(g, x, y, 5, rot, ci, 1, 1, .7, 1, .35); g.globalAlpha = 1; }
  }
  g.fillStyle = 'rgba(220,208,170,.62)';
  for (let x = Math.floor(V.x0/54)*54; x < V.x1; x += 54){ rr(g, x, LANE + 18, 28, 3.2, 1.5); g.fill(); g.fillStyle = 'rgba(240,240,235,.18)'; g.fillRect(x + 2, LANE + 18.4, 24, 0.8); g.fillStyle = 'rgba(220,208,170,.62)'; }
}

// RAINY HOLLOW: shrubs that have dropped half their leaves: a tangle of bare twigs with clumps of wet autumn leaves,
// rose hips or rowan berries here and there, and raindrops hanging off the twig tips
const BUSH_FAMS = () => [FOLIAGE.rust, FOLIAGE.red, FOLIAGE.gold, FOLIAGE.olive, FOLIAGE.orange];
function drawBush(g, x, y, s, rnd, noAutumn){
  rnd(); rnd();   // small seeds give a small first number: skip a couple
  const F = BUSH_FAMS(), P = F[Math.floor(rnd()*F.length)], Q = F[Math.floor(rnd()*F.length)], W = 22*s, berries = rnd() < 0.55;
  g.fillStyle = 'rgba(20,14,8,.32)'; ell(g, x + 4*s, y + 3*s, W*1.2, 6.5*s); g.fill();
  // a few fallen leaves under it
  for (let q=0;q<7;q++){ g.globalAlpha = 0.6; leafBlob(g, x + (rnd() - 0.5)*W*2.2, y + 1*s + rnd()*5*s, 1.8*s, rnd()*TAU, P[1 + Math.floor(rnd()*3)]); g.globalAlpha = 1; }
  // twigs fanning up and out from the base
  const tips = [];
  g.lineCap = 'round';
  const twig = (x0, y0, a, L, w, d) => {
    const x1 = x0 + Math.cos(a)*L, y1 = y0 + Math.sin(a)*L*0.85;
    g.strokeStyle = d ? '#4a3426' : '#3a281c'; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1)/2 + (rnd() - 0.5)*4*s, (y0 + y1)/2, x1, y1); g.stroke();
    if (d < 2){ const n = 2 + Math.floor(rnd()*2); for (let k=0;k<n;k++) twig(lerp(x0, x1, 0.45 + rnd()*0.5), lerp(y0, y1, 0.45 + rnd()*0.5), a + (rnd() - 0.5)*1.2, L*(0.45 + rnd()*0.25), w*0.6, d + 1); }
    else tips.push([x1, y1]);
  };
  for (let k=0;k<6;k++) twig(x + (rnd() - 0.5)*6*s, y, -Math.PI/2 + (k - 2.5)*0.36 + (rnd() - 0.5)*0.2, (14 + rnd()*9)*s, 2.2*s, 0);
  // clumps of leaves on about half of the twig ends, thicker toward the middle
  for (const [tx, ty] of tips){
    if (rnd() < 0.42) continue;
    const pal = rnd() < 0.7 ? P : Q;
    for (let q=0;q<5;q++) leafBlob(g, tx + (rnd() - 0.5)*7*s, ty + (rnd() - 0.5)*5*s, (1.9 + rnd()*1.3)*s, rnd()*TAU, pal[1 + Math.floor(rnd()*4)]);
  }
  if (berries){ const bc = rnd() < .5 ? ['#b8261a', '#e0452e'] : ['#d4521e', '#f07a3a']; for (const [tx, ty] of tips){ if (rnd() < 0.55) continue; g.fillStyle = bc[0]; ell(g, tx + 1, ty + 1, 1.5*s, 1.5*s); g.fill(); g.fillStyle = bc[1]; ell(g, tx + 0.6, ty + 0.6, 1*s, 1*s); g.fill(); } }
  // raindrops on the twig tips
  for (const [tx, ty] of tips){ if (rnd() < 0.6) continue; g.fillStyle = 'rgba(210,228,240,.75)'; ell(g, tx, ty + 1.6, 0.8*s, 1.1*s); g.fill(); }
}

// RAINY HOLLOW: an old split-rail fence, grey with rain, moss on the posts and drops hanging under the rails
function drawFence(g, O){
  const post = (x, y) => {
    g.fillStyle = 'rgba(20,14,8,.3)'; ell(g, x + 2, y + 1, 5, 2); g.fill();
    g.fillStyle = '#4a4238'; rr(g, x - 2.8, y - 17, 5.6, 18, 1.2); g.fill();
    g.fillStyle = '#6b6153'; rr(g, x - 2.8, y - 17, 3.4, 18, 1.2); g.fill();
    g.fillStyle = '#5d7a2e'; ell(g, x - 1.6, y - 2, 2.2, 3); g.fill(); ell(g, x - 2, y - 16.5, 2, 1); g.fill();
    g.fillStyle = 'rgba(220,230,240,.45)'; g.fillRect(x - 2, y - 16, 0.8, 12);
  };
  g.lineCap = 'round';
  const rail = (x0, y0, x1, y1) => {
    g.strokeStyle = 'rgba(20,14,8,.45)'; g.lineWidth = 2.8; g.beginPath(); g.moveTo(x0, y0 + 1); g.lineTo(x1, y1 + 1); g.stroke();
    g.strokeStyle = '#5c5246'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.strokeStyle = 'rgba(190,200,210,.25)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x0, y0 - 0.7); g.lineTo(x1, y1 - 0.7); g.stroke();
    // drops hanging under the rail
    const n = Math.floor(Math.hypot(x1 - x0, y1 - y0)/23), rnd = mulberry(Math.round(x0*3 + y0*7));
    g.fillStyle = 'rgba(205,222,236,.7)'; for (let k=0;k<n;k++){ const u = (k + rnd())/n; ell(g, lerp(x0, x1, u), lerp(y0, y1, u) + 1.8, 0.7, 1); g.fill(); }
  };
  rail(O.x0, O.y0 - 11, O.x1, O.y0 - 11); rail(O.x0, O.y0 - 5, O.x1, O.y0 - 5);
  for (const x of [O.x0, O.x1]){ rail(x - 1, O.y0 - 11, x - 1, O.y1 - 10); rail(x + 1, O.y0 - 5, x + 1, O.y1 - 4); }
  const nTop = Math.max(2, Math.round((O.x1 - O.x0)/40));
  for (let k=0;k<=nTop;k++) post(lerp(O.x0, O.x1, k/nTop), O.y0);
  const nSide = Math.max(2, Math.round((O.y1 - O.y0)/40));
  for (let k=1;k<=nSide;k++){ const y = lerp(O.y0, O.y1, k/nSide); post(O.x0, y); post(O.x1, y); }
}

// RAINY HOLLOW: a pile of wet wood (this place's "ore"): dark soaked logs and branches, green with moss, in a muddy
// patch. Painted into the ground; the saw station (drawMiner) stands beside it once built.
function drawRockBed(g, x, y, seed){
  const rnd = mulberry(seed);
  g.save(); g.translate(x, y);
  const rg = g.createRadialGradient(0, 2, 6, 0, 2, 50); rg.addColorStop(0, 'rgba(26,18,10,.6)'); rg.addColorStop(1, 'rgba(26,18,10,0)'); g.fillStyle = rg; ell(g, 0, 2, 54, 24); g.fill();
  // bark chips and sawdust in the mud
  for (let k=0;k<26;k++){ const a = rnd()*TAU, d = 20 + rnd()*26; g.fillStyle = rnd() < .5 ? 'rgba(150,110,66,.55)' : 'rgba(80,54,32,.6)'; ell(g, Math.cos(a)*d, 4 + Math.sin(a)*d*0.45, 1 + rnd()*1.6, 0.6 + rnd()*0.7); g.fill(); }
  // logs, back to front: [x, y, length, radius, angle]
  const logs = [[-12, -14, 44, 6.5, -0.12], [12, -16, 40, 6, 0.1], [0, -22, 36, 5.5, 0.02], [-18, -4, 40, 7, 0.05], [10, -3, 44, 7.5, -0.06], [-4, 6, 46, 7.5, 0.03], [22, 7, 26, 5, 0.25], [-28, 8, 22, 4.5, -0.3]];
  for (const [lx, ly, L, r, a] of logs) drawWetLog(g, lx, ly, L, r, a, rnd);
  // a couple of loose branches poking out
  g.strokeStyle = '#2f2219'; g.lineCap = 'round';
  for (let k=0;k<3;k++){ const sx = (rnd() - 0.5)*40, sy = -10 + rnd()*12, a = -Math.PI/2 + (rnd() - 0.5)*2.2, L = 14 + rnd()*12; g.lineWidth = 1.6; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + Math.cos(a)*L, sy + Math.sin(a)*L*0.7); g.stroke(); g.lineWidth = 0.9; g.beginPath(); g.moveTo(sx + Math.cos(a)*L*0.6, sy + Math.sin(a)*L*0.42); g.lineTo(sx + Math.cos(a + 0.7)*L*0.6 + Math.cos(a)*5, sy + Math.sin(a)*L*0.42 - 4); g.stroke(); }
  // a little cluster of mushrooms growing out of the old wood
  drawTinyMush(g, -26, -4, 0.9, MUSH_DECO[1]); drawTinyMush(g, -22, -2, 0.7, MUSH_DECO[1]); drawTinyMush(g, 27, -10, 0.8, MUSH_DECO[4]);
  g.restore();
}
// one wet log lying on its side: dark bark, a pale cut end with rings, moss on top and a wet shine
function drawWetLog(g, x, y, L, r, a, rnd){
  g.save(); g.translate(x, y); g.rotate(a);
  g.fillStyle = 'rgba(15,10,6,.35)'; ell(g, 2, r*0.75, L*0.55, r*0.5); g.fill();
  g.fillStyle = '#3a2a1e'; rr(g, -L/2, -r, L, r*2, r*0.9); g.fill();
  g.fillStyle = '#4c3828'; rr(g, -L/2, -r, L, r*1.1, r*0.8); g.fill();
  g.strokeStyle = 'rgba(20,12,8,.55)'; g.lineWidth = 0.6;
  for (let k=0;k<5;k++){ const lx = -L/2 + 4 + rnd()*(L - 10); g.beginPath(); g.moveTo(lx, -r*0.8); g.lineTo(lx + 3 + rnd()*5, -r*0.1 + rnd()*r*0.8); g.stroke(); }
  g.fillStyle = '#56702a'; for (let k=0;k<4;k++){ ell(g, -L/2 + 4 + rnd()*(L - 8), -r*0.75, 2 + rnd()*3, 1 + rnd()*0.8); g.fill(); }
  g.fillStyle = 'rgba(200,215,230,.32)'; rr(g, -L/2 + 3, -r*0.72, L - 8, 1.1, 0.5); g.fill();
  // the cut end
  g.fillStyle = '#8e6a44'; ell(g, L/2 - 0.5, 0, r*0.62, r); g.fill();
  g.strokeStyle = 'rgba(70,46,26,.7)'; g.lineWidth = 0.5; ell(g, L/2 - 0.5, 0, r*0.38, r*0.62); g.stroke(); ell(g, L/2 - 0.5, 0, r*0.16, r*0.28); g.stroke();
  g.fillStyle = 'rgba(40,26,16,.5)'; ell(g, L/2 - 0.5, 0, r*0.62, r); g.lineWidth = 0.8; g.strokeStyle = '#2e2016'; g.stroke();
  g.restore();
}
// a fallen tree trunk out in the wild, with moss and shelf fungus
function drawFallenLog(g, x, y, s, rnd){
  g.save(); g.translate(x, y); g.scale(s, s);
  drawWetLog(g, 0, 0, 70, 9, (rnd() - 0.5)*0.5, rnd);
  for (let k=0;k<4;k++){ const fx = -24 + k*13 + rnd()*5; g.fillStyle = '#c99a5a'; g.beginPath(); g.ellipse(fx, -6, 5, 2.4, 0, Math.PI, 0); g.fill(); g.fillStyle = '#e6c58a'; g.fillRect(fx - 5, -6.4, 10, 0.9); g.fillStyle = '#8a6438'; g.beginPath(); g.ellipse(fx, -6, 3, 1.2, 0, Math.PI, 0); g.fill(); }
  g.restore();
}
// RAINY HOLLOW: tree canopies. Late autumn: every tree has lost about half its leaves, so the dark wet branches show
// through, with clumps of leaves left mostly at the top and on the sheltered side, and the odd bare limb. Grey overcast
// light from above instead of the sun; raindrops hang off the twig tips. The tree sways from its trunk base.
const FOLIAGE = {
  red:    ['#4e1a12', '#7a2619', '#a03422', '#c4502e', '#de7a48'],
  orange: ['#5c2a10', '#8a3f16', '#b65c1e', '#d6802e', '#eaa652'],
  gold:   ['#5e4212', '#8a5f19', '#b48424', '#d6a83a', '#ecc866'],
  rust:   ['#4c2014', '#73321c', '#9a4c24', '#bd6e32', '#d99652'],
  olive:  ['#424620', '#62692a', '#878732', '#b09e40', '#d0bc62'],
  brown:  ['#3a2516', '#56371f', '#76502c', '#96693a', '#b5874e'],
};
const TREE_FAMS = [['rust','gold'],['red','orange'],['gold','brown'],['orange','rust'],['olive','gold'],['red','brown'],
                   ['brown','orange'],['gold','red'],['rust','olive'],['orange','gold'],['red','rust'],['olive','brown']];
function scallop(g, x, y, r, rnd){
  const n = 7 + Math.floor(rnd()*3), a0 = rnd()*TAU;
  g.beginPath();
  for (let i=0;i<=n;i++){
    const a = a0 + i/n*TAU, px = x + Math.cos(a)*r*0.8, py = y + Math.sin(a)*r*0.8;
    if (!i) g.moveTo(px, py);
    else { const am = a - Math.PI/n, k = r*(1.08 + rnd()*0.12); g.quadraticCurveTo(x + Math.cos(am)*k, y + Math.sin(am)*k, px, py); }
  }
  g.closePath();
}
function leafBlob(g, x, y, s, rot, col){ g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s); leafPath(g, 1); g.fillStyle = col; g.fill(); g.restore(); }
function buildCanopies(){
  const RES = 2;
  canopyCvs = TREES.map((t, ti) => {
    const R0 = t.r, pad = 34, ox = R0 + pad, oy = R0 + pad, w = 2*(R0 + pad), h = R0 + pad + R0*1.25 + 24;
    const c = document.createElement('canvas'); c.width = Math.ceil(w*RES); c.height = Math.ceil(h*RES);
    const g = c.getContext('2d'); g.scale(RES, RES); g.translate(ox, oy);
    const rnd = mulberry(t.seed);
    const [fa, fb] = t.fam || TREE_FAMS[ti % TREE_FAMS.length], A = FOLIAGE[fa], B = FOLIAGE[fb];
    const base = R0*1.16, tw = Math.max(8, R0*0.075), fy = 0.88;
    // the bare side: the wind has stripped one side more than the other
    const bareSide = rnd() < 0.5 ? -1 : 1;
    g.lineCap = 'round'; g.lineJoin = 'round';
    // trunk and roots: dark wet bark, moss up the sheltered side
    g.fillStyle = 'rgba(20,14,8,.4)'; ell(g, tw*0.5, base + 2, tw*3.2, tw*0.8); g.fill();
    const tg = g.createLinearGradient(-tw*1.6, 0, tw*1.6, 0); tg.addColorStop(0, '#4a3a2e'); tg.addColorStop(0.45, '#33271e'); tg.addColorStop(1, '#211813');
    g.fillStyle = tg; g.beginPath();
    g.moveTo(-tw*0.75, R0*0.2); g.lineTo(-tw, base - tw*1.2); g.quadraticCurveTo(-tw*1.2, base - tw*0.2, -tw*2.4, base + 1);
    g.lineTo(tw*2.6, base + 1); g.quadraticCurveTo(tw*1.2, base - tw*0.2, tw, base - tw*1.2); g.lineTo(tw*0.75, R0*0.2); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(12,8,5,.5)'; g.lineWidth = 1;
    for (let k=0;k<5;k++){ const bx = (rnd() - 0.5)*tw*1.2; g.beginPath(); g.moveTo(bx, R0*0.4 + rnd()*R0*0.2); g.lineTo(bx + (rnd() - 0.5)*3, base - tw*0.8 - rnd()*6); g.stroke(); }
    g.fillStyle = '#56702a'; for (let k=0;k<9;k++){ ell(g, -bareSide*tw*(0.35 + rnd()*0.4), R0*0.45 + rnd()*(base - R0*0.5), 1.6 + rnd()*2.2, 2 + rnd()*2.4); g.fill(); }
    g.fillStyle = 'rgba(190,205,220,.3)'; g.fillRect(bareSide*tw*0.45, R0*0.35, 1.2, base - R0*0.5);
    // branches: a few strong limbs reach up and out from the top of the trunk and split three times into a fine twig
    // haze that fills a rounded crown; leaves cling along the outer twigs
    const tips = [], twigs = [];
    const inCrown = (x, y) => (x/(R0*0.98))**2 + ((y + R0*0.08)/(R0*0.9*fy))**2 < 1;
    const branch = (x0, y0, a, L, wd, d) => {
      let x1 = x0 + Math.cos(a)*L, y1 = y0 + Math.sin(a)*L*fy;
      for (let q=0; q<4 && !inCrown(x1, y1); q++){ L *= 0.8; x1 = x0 + Math.cos(a)*L; y1 = y0 + Math.sin(a)*L*fy; }
      const bend = (rnd() - 0.5)*0.6, cx = (x0 + x1)/2 + Math.cos(a + Math.PI/2)*L*bend*0.25, cy = (y0 + y1)/2 + Math.sin(a + Math.PI/2)*L*bend*0.25 - L*0.06;
      twigs.push({ x0, y0, cx, cy, x1, y1, wd, d });
      if (d < 4){
        const n = d === 0 ? 2 + (rnd() < 0.5 ? 1 : 0) : 2;
        for (let k=0;k<n;k++){
          const u = d === 0 ? 0.55 + rnd()*0.4 : 0.6 + rnd()*0.4, spread = d < 2 ? 0.5 : 0.62;
          branch(lerp(x0, x1, u), lerp(y0, y1, u), a + (k - (n - 1)/2)*spread*2/n*1.4 + (rnd() - 0.5)*0.3 - (a + Math.PI/2)*0.08, L*(0.58 + rnd()*0.16), wd*0.6, d + 1);
        }
      }
      if (d >= 2) tips.push({ x: x1, y: y1, d });
    };
    // the trunk carries on up the middle as a leader, and limbs leave it at different heights, alternating sides:
    // the low ones reach out wide, the high ones more upward
    const ty0 = R0*0.34, lead = -R0*0.42, lw = (rnd() - 0.5)*R0*0.08;
    twigs.push({ x0: 0, y0: ty0 + R0*0.1, cx: lw, cy: (ty0 + lead)/2, x1: lw*0.6, y1: lead, wd: tw*0.75, d: 0 });
    branch(lw*0.6, lead, -Math.PI/2 + (rnd() - 0.5)*0.2, R0*0.32, tw*0.45, 1);
    const limbs = 5 + Math.floor(rnd()*3), side0 = rnd() < 0.5 ? -1 : 1;
    for (let k=0;k<limbs;k++){
      const u = k/(limbs - 1), side = (k % 2 ? -side0 : side0), y0 = lerp(ty0, lead*0.75, u) + (rnd() - 0.5)*R0*0.05;
      const up = 0.12 + 0.5*u + (rnd() - 0.5)*0.12, a = side < 0 ? -Math.PI + up*Math.PI*0.62 : -up*Math.PI*0.62;
      branch(lw*(1 - (ty0 - y0)/(ty0 - lead)) * 0.6, y0, a, R0*(0.62 - 0.26*u + rnd()*0.08), tw*(0.62 - 0.22*u), 1);
    }
    const drawTwig = (b, col) => { g.strokeStyle = col; g.lineWidth = Math.max(0.55, b.wd); g.beginPath(); g.moveTo(b.x0, b.y0); g.quadraticCurveTo(b.cx, b.cy, b.x1, b.y1); g.stroke(); };
    // fine twigs first (a grey haze), then the bigger limbs over them
    for (const b of twigs) if (b.d >= 3) drawTwig(b, 'rgba(46,36,30,.75)');
    for (const b of twigs) if (b.d < 3) drawTwig(b, '#2e221a');
    for (const b of twigs) if (b.d < 2){ g.strokeStyle = 'rgba(160,170,182,.32)'; g.lineWidth = Math.max(0.5, b.wd*0.22); g.beginPath(); g.moveTo(b.x0 - b.wd*0.25, b.y0 - b.wd*0.3); g.quadraticCurveTo(b.cx - b.wd*0.25, b.cy - b.wd*0.3, b.x1, b.y1); g.stroke(); }
    // leaves: only about half the crown keeps them (mostly the top and the sheltered side), in loose little clumps
    const clumps = [];
    const keep = (x, y) => { const nx = x/R0, ny = y/R0; const p = 0.5 - 0.22*ny - 0.42*nx*bareSide; return rnd() < clamp(p, 0.06, 0.85); };
    for (const tp of tips){ if (!keep(tp.x, tp.y)) continue; const nz = Math.sqrt(Math.max(0.05, 1 - (tp.x/R0)**2 - (tp.y/R0)**2)); clumps.push({ x: tp.x + (rnd() - 0.5)*R0*0.06, y: tp.y + (rnd() - 0.5)*R0*0.05, r: R0*(0.07 + rnd()*0.06)*(tp.d >= 4 ? 1 : 1.2), z: nz, pal: rnd() < 0.3 ? B : A }); }
    for (const b of twigs){ if (b.d !== 2 || rnd() < 0.55 || !keep(b.x1, b.y1)) continue; clumps.push({ x: (b.cx + b.x1)/2, y: (b.cy + b.y1)/2, r: R0*(0.06 + rnd()*0.05), z: 0.4, pal: rnd() < 0.3 ? B : A }); }
    clumps.sort((p, q) => (p.z - q.z) || (p.y - q.y));
    for (const k of clumps){
      const P = k.pal, lum = clamp(Math.round(2.2 - k.y/R0*1.6 + (rnd() - 0.5)*1.2), 1, 3);
      scallop(g, k.x + 1.2, k.y + 2, k.r + 1.2, rnd); g.fillStyle = 'rgba(25,14,8,.35)'; g.fill();
      scallop(g, k.x, k.y, k.r*0.85, rnd); g.fillStyle = P[lum - 1]; g.fill();
      for (let m=0;m<7;m++){ const a = rnd()*TAU, d = Math.sqrt(rnd())*k.r, lx = Math.cos(a)*d, ly = Math.sin(a)*d; const up = ly < 0; leafBlob(g, k.x + lx, k.y + ly, 2 + rnd()*2.1, rnd()*TAU, P[clamp(lum + (up ? 1 : 0) + (rnd() < 0.3 ? 1 : 0) - (rnd() < 0.2 ? 1 : 0), 0, 4)]); }
    }
    // single leaves still clinging to the bare twigs
    for (const tp of tips){ if (rnd() < 0.6) continue; const P = rnd() < 0.3 ? B : A; leafBlob(g, tp.x + (rnd() - 0.5)*4, tp.y + rnd()*3, 2.2 + rnd()*1.5, rnd()*TAU, P[1 + Math.floor(rnd()*3)]); }
    // grey light from above: lighter crown top, darker and cooler underneath
    g.globalCompositeOperation = 'source-atop';
    const sky = g.createLinearGradient(0, -R0, 0, R0*0.9);
    sky.addColorStop(0, 'rgba(225,232,240,.16)'); sky.addColorStop(0.5, 'rgba(160,170,180,0)'); sky.addColorStop(1, 'rgba(20,24,34,.32)');
    g.fillStyle = sky; g.fillRect(-ox, -oy, w, R0*0.98 + oy);
    g.globalCompositeOperation = 'source-over';
    // raindrops hanging from the twig tips
    for (const tp of tips){ if (rnd() < 0.85) continue; g.fillStyle = 'rgba(200,218,232,.55)'; ell(g, tp.x, tp.y + 1.5, 0.6, 0.9); g.fill(); }
    return { c, ox, oy, w, h, base };
  });
}

let bushCvs = [];
function buildBushes(){
  const RES = 2;
  bushCvs = BUSHES.map(b => {
    const s = b.s, w = 104*s, h = 70*s, ox = w/2, oy = 54*s;
    const c = document.createElement('canvas'); c.width = Math.ceil(w*RES); c.height = Math.ceil(h*RES);
    const g = c.getContext('2d'); g.scale(RES, RES); drawBush(g, ox, oy, 1.3*s, mulberry(b.seed), true);
    return { c, ox, oy, w, h };
  });
}
function drawBushObj(i){
  const b = BUSHES[i], bc = bushCvs[i], c = ctx; if (!bc) return;
  const sh = bushShake[i], wob = sh > 0 ? Math.sin(sh*30)*0.06*Math.min(1, sh*1.5) : reduceMotion ? 0 : Math.sin(S.t*0.9 + i*2)*0.006 + wind*0.0002;
  c.save(); c.translate(b.x, b.y); c.rotate(wob); if (sh > 0) c.scale(1 + Math.sin(sh*24)*0.03, 1 - Math.sin(sh*24)*0.02);
  c.drawImage(bc.c, -bc.ox, -bc.oy, bc.w, bc.h); c.restore();
}

function buildVignette(){
  // RAINY HOLLOW: a cool grey wash, misty light from the top and dark, blue-grey corners
  vignetteCv = document.createElement('canvas'); vignetteCv.width = cv.width; vignetteCv.height = cv.height;
  const g = vignetteCv.getContext('2d'); g.scale(DPR, DPR);
  g.fillStyle = 'rgba(52,68,92,.13)'; g.fillRect(0, 0, W, H);
  const rg = g.createRadialGradient(W*0.5, H*0.5, Math.min(W,H)*0.3, W*0.5, H*0.5, Math.hypot(W,H)*0.62);
  rg.addColorStop(0, 'rgba(18,24,36,0)'); rg.addColorStop(1, 'rgba(16,22,34,.46)');
  g.fillStyle = rg; g.fillRect(0, 0, W, H);
  const top = g.createLinearGradient(0, 0, 0, H*0.45);
  top.addColorStop(0, 'rgba(196,206,218,.22)'); top.addColorStop(1, 'rgba(196,206,218,0)');
  g.fillStyle = top; g.fillRect(0, 0, W, H);
}

// ───────────────────────── drawing: objects (world units)
function chalk(c, text, x, y, size, color){ c.font = '700 ' + size + 'px Caveat, cursive'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = color; c.fillText(text, x, y); }

function drawBin(){
  const c = ctx, x = BIN.x, y = BIN.y;
  const sq = bumpBin > 0 ? 1 + Math.sin(bumpBin/0.25*Math.PI)*0.04 : 1;
  c.save(); c.translate(x, y); c.scale(sq, 1/sq);
  c.fillStyle = 'rgba(35,25,10,.3)'; ell(c, 2, 2, 46, 8); c.fill();
  c.fillStyle = '#3e2718'; rr(c, -36, -52, 72, 12, 4); c.fill();
  const f = clamp(S.binLeaves / binCap(), 0, 1);
  if (S.binLeaves > 0){
    const h = 3 + f*20;
    c.save(); c.beginPath(); c.moveTo(-35, -44); c.bezierCurveTo(-26, -46 - h*1.2, 26, -46 - h*1.2, 35, -44); c.closePath(); c.clip();
    c.fillStyle = '#b8582a'; c.fillRect(-36, -50 - h*1.3, 72, h*1.4 + 8);
    const rnd = mulberry(5);
    for (let i=0;i<46;i++){ const px = -32 + rnd()*64, py = -44 - rnd()*h*1.1; drawLeaf(c, px, py, 4 + rnd()*2, rnd()*TAU, Math.floor(rnd()*LEAFC.length), rnd()<.5?1:0, 1, 0.8, 1, 0); }
    c.restore();
  }
  drawBinBags(c, false);
  const boards = ['#a86c3e','#9a6037','#a2683b'];
  for (let i=0;i<3;i++){ c.fillStyle = boards[i]; rr(c, -38, -46 + i*15.3, 76, 14.5, 2); c.fill(); c.fillStyle = 'rgba(255,230,190,.12)'; c.fillRect(-36, -45 + i*15.3, 72, 2); }
  c.fillStyle = '#734428'; rr(c, -40, -50, 7, 50, 2); c.fill(); rr(c, 33, -50, 7, 50, 2); c.fill();
  c.fillStyle = '#4a2c1a'; for (const yy of [-41, -26, -10]){ ell(c, -36.5, yy, 1.1, 1.1); c.fill(); ell(c, 36.5, yy, 1.1, 1.1); c.fill(); }
  c.fillStyle = '#734428'; rr(c, -24, -38, 48, 23, 4); c.fill();
  c.fillStyle = '#2f3a34'; rr(c, -21.5, -35.5, 43, 18, 3); c.fill();
  chalk(c, S.binLeaves + '/' + binCap(), 0, -26, binCap() >= 500 ? 12.5 : binCap() >= 100 ? 14 : 16, binRoom() <= 0 ? '#ffb38a' : '#efe8d8');
  drawBinBags(c, true);
  if (keepLeaves() > 0) keepMark(c, -40, -2, -48, keepLeaves()/binCap());
  c.restore();

  if (S.metalSlot){
    // RAINY HOLLOW: the log crib (this place's metal tub): an open wooden crib with a little plank roof; the wet logs
    // inside are stacked end-on, so you can see how full it is
    c.save(); c.translate(TUB.x, TUB.y);
    c.fillStyle = 'rgba(20,14,8,.32)'; ell(c, 1, 2, 22, 5); c.fill();
    c.fillStyle = '#2a1f17'; rr(c, -17, -36, 34, 36, 2); c.fill();
    { const mf = clamp(S.binMetal / metalCap(), 0, 1), n = S.binMetal > 0 ? Math.max(1, Math.round(mf*15)) : 0;
      for (let i=0;i<n;i++){ const row = Math.floor(i/5), k = i % 5; logEnd(c, -12 + k*6 + (row % 2)*1.5, -4.2 - row*6.4, 3.1, true); } }
    c.fillStyle = '#7a5434'; rr(c, -18, -3, 36, 3.4, 1); c.fill(); rr(c, -18, -37, 36, 3, 1); c.fill();
    c.fillStyle = '#5a3b26'; rr(c, -19.5, -38, 4.5, 39, 1.5); c.fill(); rr(c, 15, -38, 4.5, 39, 1.5); c.fill();
    // a little plank roof
    c.fillStyle = '#4a3a30'; c.beginPath(); c.moveTo(-23, -37); c.lineTo(23, -37); c.lineTo(19, -45); c.lineTo(-19, -45); c.closePath(); c.fill();
    c.fillStyle = 'rgba(200,215,228,.3)'; c.fillRect(-19, -44.5, 38, 0.8);
    c.fillStyle = 'rgba(205,222,236,.7)'; for (const dx of [-21, -8, 6, 20]){ const ph = (S.t*0.8 + dx*0.11) % 1; ell(c, dx, -36 + ph*7, 0.6, 0.9); c.fill(); }
    c.fillStyle = '#734428'; rr(c, -14, -15, 28, 13, 2.5); c.fill();
    c.fillStyle = '#2f3a34'; rr(c, -12.8, -13.8, 25.6, 10.6, 2); c.fill();
    { const label = S.binMetal + '/' + metalCap(); let fs = metalCap() >= 100 ? 11 : 12.5; c.font = '700 ' + fs + 'px Caveat, cursive'; const lw = c.measureText(label).width; if (lw > 23) fs = fs*23/lw;
      chalk(c, label, 0, -8.5, fs, tubRoom() <= 0 ? '#ffb38a' : '#efe8d8'); }
    if (keepMetal() > 0) keepMark(c, -19, -2, -36, keepMetal()/metalCap());
    c.restore();
  }
}
// the keep line: a little orange marker on the side of the bin (or tub) at the height of what the truck leaves behind
function keepMark(c, x, y0, y1, f){
  const y = lerp(y0, y1, clamp(f, 0, 1));
  c.fillStyle = '#ff9b3d'; c.beginPath(); c.moveTo(x - 1, y - 3); c.lineTo(x + 4, y); c.lineTo(x - 1, y + 3); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,155,61,.8)'; c.lineWidth = 1; c.setLineDash([2, 2]); c.beginPath(); c.moveTo(x + 4, y); c.lineTo(x + 14, y); c.stroke(); c.setLineDash([]);
}
// a log seen end-on: bark ring, pale wood with growth rings (dark and shiny when wet)
function logEnd(c, x, y, r, wet){
  c.fillStyle = wet ? '#2e2016' : '#5a3b24'; ell(c, x, y, r, r); c.fill();
  c.fillStyle = wet ? '#8a6642' : '#d8b07a'; ell(c, x, y, r*0.78, r*0.78); c.fill();
  c.strokeStyle = wet ? 'rgba(60,40,22,.8)' : 'rgba(150,104,60,.8)'; c.lineWidth = Math.max(0.3, r*0.12); ell(c, x, y, r*0.48, r*0.48); c.stroke(); ell(c, x, y, r*0.2, r*0.2); c.stroke();
  if (wet){ c.fillStyle = 'rgba(220,234,244,.45)'; ell(c, x - r*0.3, y - r*0.35, r*0.25, r*0.14); c.fill(); }
}
function nugget(c, x, y, s, rot){
  // RAINY HOLLOW: a chunk of wet wood: a short dark log with a pale cut end and a wet shine
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s/8, s/8);
  c.fillStyle = '#3a2a1e'; rr(c, -8, -4.6, 15, 9.2, 4); c.fill();
  c.fillStyle = '#56402c'; rr(c, -8, -4.6, 15, 5, 3.5); c.fill();
  c.strokeStyle = 'rgba(20,12,8,.6)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-5, -3); c.lineTo(-1, 1); c.moveTo(1, -3.5); c.lineTo(4, 0); c.stroke();
  c.fillStyle = '#5d7a2e'; ell(c, -3, -3.8, 2.6, 1.1); c.fill();
  c.fillStyle = '#9a7448'; ell(c, 6.5, 0, 3, 4.6); c.fill();
  c.strokeStyle = 'rgba(70,46,26,.8)'; c.lineWidth = 0.6; ell(c, 6.5, 0, 1.8, 2.8); c.stroke(); ell(c, 6.5, 0, 0.7, 1.1); c.stroke();
  c.fillStyle = 'rgba(210,226,238,.45)'; rr(c, -6, -3.6, 9, 1.2, 0.6); c.fill();
  c.restore();
}

function drawSign(){
  const c = ctx; c.save(); c.translate(SIGN.x, SIGN.y);
  c.fillStyle = 'rgba(35,25,10,.28)'; ell(c, 3, 1, 10, 3); c.fill();
  c.fillStyle = '#6e4a30'; rr(c, -2.5, -52, 5, 52, 2); c.fill();
  c.rotate(Math.sin(S.t*1.3)*0.012);
  c.fillStyle = '#6e4a30'; rr(c, -27, -71, 54, 26, 5); c.fill();
  c.fillStyle = '#efe2c6'; rr(c, -25, -69, 50, 22, 4); c.fill();
  c.save(); c.translate(-15, -58); c.scale(0.85, 0.85);
  c.fillStyle = '#5e8a86'; rr(c, -7, -4, 6, 6, 1.5); c.fill(); c.fillStyle = '#7c5a3c'; rr(c, -1, -5, 9, 7, 1); c.fill();
  c.fillStyle = '#2a2624'; ell(c, -4, 3, 1.8, 1.8); c.fill(); ell(c, 5, 3, 1.8, 1.8); c.fill();
  c.restore();
  c.font = '700 14px "Baloo 2", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#4a3226';
  c.fillText(truckHere() ? 'now' : mmss(S.truckT), 8, -57);
  c.restore();
}

function drawSaleSign(){
  if (!saleVisible()) return;
  const p = salePos(), c = ctx, cost = AREAS[S.land + 1].cost;
  const k = clamp((S.t - saleAppearT)/0.5, 0, 1), sc = k < 1 ? 0.4 + 0.6*(1 - Math.pow(1 - k, 3)) + Math.sin(k*Math.PI)*0.12 : 1;
  c.save(); c.translate(p.x, p.y); c.scale(sc, sc);
  c.fillStyle = 'rgba(35,25,10,.3)'; ell(c, 2, 2, 30, 5); c.fill();
  c.fillStyle = '#6e4a30'; rr(c, -24, -44, 5, 45, 2); c.fill(); rr(c, 19, -44, 5, 45, 2); c.fill();
  c.rotate(Math.sin(S.t*1.1)*0.015);
  c.fillStyle = '#5a3b26'; rr(c, -34, -76, 68, 40, 5); c.fill();
  c.fillStyle = '#f3e7cf'; rr(c, -32, -74, 64, 36, 4); c.fill();
  c.fillStyle = '#b8452d'; rr(c, -32, -74, 64, 14, 4); c.fill(); c.fillRect(-32, -66, 64, 6);
  c.font = '800 10px "Baloo 2", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fbefd9';
  c.fillText('FOR SALE', 0, -66.5);
  c.font = '800 14px "Baloo 2", sans-serif'; c.fillStyle = '#4a3226'; c.fillText(money(cost), 0, -50);
  if (S.land + 1 === MINE_LAND){
    // WILDFLOWER PRAIRIE: a plank hung under the board: the next plot has the first metal vein
    c.strokeStyle = '#4a3226'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-26, -36); c.lineTo(-30, -31); c.moveTo(26, -36); c.lineTo(30, -31); c.stroke();
    c.fillStyle = '#5a3b26'; rr(c, -50, -32, 100, 17, 3); c.fill();
    c.fillStyle = '#f6e3a8'; rr(c, -48.5, -30.5, 97, 14, 2.5); c.fill();
    nugget(c, -40, -23.5, 6.5, 0.3);
    const mt = 'Room for a drying shed!'; c.font = '700 11px Caveat, cursive'; const mw = c.measureText(mt).width;
    chalk(c, mt, 5, -23.8, Math.min(11, 11*80/mw), '#4a3226');
  }
  c.restore();
}

function drawShed(){
  const c = ctx; c.save(); c.translate(SHED.x, SHED.y);
  c.fillStyle = 'rgba(35,25,10,.3)'; ell(c, 4, 2, 58, 10); c.fill();
  c.fillStyle = '#9b4e35'; rr(c, -44, -62, 88, 62, 3); c.fill();
  c.strokeStyle = '#7f3c27'; c.lineWidth = 1.2; for (let x=-36; x<44; x+=8){ c.beginPath(); c.moveTo(x, -60); c.lineTo(x, -1); c.stroke(); }
  c.fillStyle = '#ecdfc6'; c.fillRect(-44, -62, 4, 62); c.fillRect(40, -62, 4, 62);
  c.fillStyle = '#ecdfc6'; rr(c, -15, -44, 30, 44, 3); c.fill();
  c.fillStyle = '#6c3523'; rr(c, -12.5, -41.5, 25, 41.5, 2); c.fill();
  c.strokeStyle = '#ecdfc6'; c.lineWidth = 2; c.beginPath(); c.moveTo(-12, -40); c.lineTo(12, -2); c.moveTo(12, -40); c.lineTo(-12, -2); c.stroke();
  c.fillStyle = '#d9b55a'; ell(c, 8, -20, 1.6, 1.6); c.fill();
  c.fillStyle = '#ecdfc6'; rr(c, -38, -52, 19, 16, 2); c.fill();
  const flick = 0.85 + Math.sin(S.t*3.1)*0.05 + Math.sin(S.t*7.3)*0.03;
  c.fillStyle = 'rgba(246,190,96,'+flick+')'; c.fillRect(-36, -50, 15, 12);
  c.fillStyle = '#ecdfc6'; c.fillRect(-29, -50, 1.5, 12); c.fillRect(-36, -44.7, 15, 1.5);
  c.fillStyle = '#4d3a34'; c.beginPath(); c.moveTo(-54, -58); c.lineTo(0, -96); c.lineTo(54, -58); c.closePath(); c.fill();
  c.strokeStyle = '#3c2d28'; c.lineWidth = 1.5;
  for (let i=1;i<5;i++){ const yy = -58 - i*7.6, half = 54 - i*10.8; c.beginPath(); c.moveTo(-half, yy); c.lineTo(half, yy); c.stroke(); }
  for (const [lx, ly, ci] of [[-20,-66,2],[12,-74,0],[30,-62,3],[-6,-84,4]]) drawLeaf(c, lx, ly, 4, lx*0.1, ci, 1, 1, 0.8, 1, 0);
  c.fillStyle = '#2f2420'; c.fillRect(-56, -59, 112, 3);
  // RAINY HOLLOW: moss on the roof, a wet shine along it and drips falling off the eaves
  { const r2 = mulberry(19); c.fillStyle = '#56702a'; for (let k=0;k<9;k++){ const yy = -60 - r2()*30, half = 54 - (-58 - yy)*1.4; ell(c, (r2() - 0.5)*half*1.6, yy, 2 + r2()*3, 1 + r2()); c.fill(); } }
  c.strokeStyle = 'rgba(205,218,230,.3)'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-50, -60); c.lineTo(0, -93); c.stroke();
  c.fillStyle = 'rgba(205,222,236,.8)'; for (let k=0;k<8;k++){ const dx = -54 + k*15.4, ph = (S.t*0.9 + k*0.37) % 1; ell(c, dx, -56 + ph*12, 0.8, 1.1); c.fill(); }
  c.restore();
}

function drawPumpkins(){
  const c = ctx, bx = SHED.x + 60, by = SHED.y + 4;
  for (const [dx, dy, s, col] of [[0, 0, 11, '#d9732a'], [15, 4, 8, '#e48a35'], [-6, 8, 6, '#c9652a']]){
    c.save(); c.translate(bx + dx, by + dy);
    c.fillStyle = 'rgba(35,25,10,.3)'; ell(c, 1, 1, s*1.2, s*0.35); c.fill();
    c.fillStyle = shade(col, 0.82); ell(c, -s*0.45, -s*0.75, s*0.62, s*0.75); c.fill(); ell(c, s*0.45, -s*0.75, s*0.62, s*0.75); c.fill();
    c.fillStyle = col; ell(c, 0, -s*0.78, s*0.6, s*0.8); c.fill();
    c.fillStyle = 'rgba(255,230,180,.25)'; ell(c, -s*0.2, -s*1.1, s*0.18, s*0.28); c.fill();
    c.strokeStyle = '#5b4a26'; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -s*1.5); c.quadraticCurveTo(1, -s*1.8, 3, -s*1.85); c.stroke();
    c.restore();
  }
}

function drawSpotGlints(){
  // RAINY HOLLOW: raindrops glinting on the wet wood piles
  const c = ctx;
  SPOTS.forEach((p, i) => {
    if (S.miners.includes(i) || p.land > S.land) return;
    for (let k=0;k<3;k++){
      const ph = S.t*1.4 + i*2.1 + k*2.3, a = Math.pow(Math.max(0, Math.sin(ph)), 6) * (S.metalSlot ? 0.9 : 0.55);
      if (a < 0.02) continue;
      const gx = p.x + [-18, 4, 18][k], gy = p.y + [-12, -20, -6][k], s = 2.4 + a*3;
      c.save(); c.globalAlpha = a; c.fillStyle = '#eaf4fb'; c.translate(gx, gy);
      c.beginPath(); c.moveTo(0, -s); c.lineTo(s*0.22, -s*0.22); c.lineTo(s, 0); c.lineTo(s*0.22, s*0.22); c.lineTo(0, s); c.lineTo(-s*0.22, s*0.22); c.lineTo(-s, 0); c.lineTo(-s*0.22, -s*0.22); c.closePath(); c.fill();
      c.restore();
    }
  });
}

// RAINY HOLLOW: a saw station beside a wet wood pile (this place's miner): a sawhorse with a log on it, a hand-cranked
// saw frame whose flywheel turns while a robot works, and a little lamp
function drawMiner(i){
  if (S.shafts.includes(i)){ drawShaft(i); return; }
  const p = SPOTS[i], c = ctx;
  const working = minerWorkers(i).some(ri => R[ri] && R[ri].st === 'mine');
  const t = S.t;
  c.save(); c.translate(p.x, p.y);
  // the sawhorse (an X at each end) with a log across it
  c.strokeStyle = '#5a3b26'; c.lineWidth = 2.6; c.lineCap = 'round';
  for (const sx of [-14, 12]){ c.beginPath(); c.moveTo(sx - 6, 4); c.lineTo(sx + 6, -18); c.moveTo(sx + 6, 4); c.lineTo(sx - 6, -18); c.stroke(); }
  drawWetLog(c, -1, -16, 40, 5.5, 0, mulberry(i*7 + 2));
  // the saw frame: a timber A-frame with a blade that rocks up and down over the log
  c.strokeStyle = '#6a4630'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(14, 2); c.lineTo(28, -56); c.lineTo(42, 2); c.stroke();
  c.strokeStyle = '#8a6040'; c.lineWidth = 2; c.beginPath(); c.moveTo(19, -20); c.lineTo(37, -20); c.stroke();
  const saw = working ? Math.sin(t*14)*5 : 0;
  c.save(); c.translate(28, -56); c.rotate(0.38 + (working ? Math.sin(t*14)*0.05 : 0));
  c.strokeStyle = '#4a423b'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 36 + saw*0.2); c.stroke();
  c.restore();
  // the bow saw biting into the log
  c.save(); c.translate(10 + saw, -23);
  c.strokeStyle = '#7a5236'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-10, 0); c.quadraticCurveTo(0, -12, 10, 0); c.stroke();
  c.fillStyle = '#b9c2c6'; c.fillRect(-10, -0.6, 20, 1.6);
  c.fillStyle = '#6c7378'; for (let k=-9;k<10;k+=2){ c.beginPath(); c.moveTo(k, 1); c.lineTo(k + 1, 2.2); c.lineTo(k + 2, 1); c.fill(); }
  c.restore();
  // the flywheel on the frame
  c.save(); c.translate(28, -56); c.rotate(working ? t*6 : 0);
  c.strokeStyle = '#4a423b'; c.lineWidth = 2; ell(c, 0, 0, 7, 7); c.stroke();
  c.lineWidth = 1; for (let k=0;k<5;k++){ c.rotate(TAU/5); c.beginPath(); c.moveTo(0, 0); c.lineTo(6.5, 0); c.stroke(); }
  c.fillStyle = '#c9a24a'; ell(c, 0, 0, 1.8, 1.8); c.fill();
  c.restore();
  // lamp
  c.fillStyle = working ? (Math.sin(t*6) > 0 ? '#ffd36b' : '#f0a640') : '#7d6a4a'; ell(c, 36, -38, 2.4, 2.4); c.fill();
  if (working){ c.fillStyle = 'rgba(255,211,107,.25)'; ell(c, 36, -38, 6, 6); c.fill(); }
  c.restore();
  if (working && !simMode && Math.random() < 0.25) parts.push({ k:'speck', x: p.x + 10 + rand(-4, 4), y: p.y - 22, vx: rand(-30, 30), vy: rand(-30, -5), g: 120, life: rand(.4, .7), t: 0, saw: true });
}

// ───────────────────────── V6 work buildings: bagging table, ingot pallet, smelting plant, mine shafts
// little props shared by the buildings, the truck and the payout lines
function drawLeafBag(c, x, y, s, tier){
  // a tied bag of leaves. Clear plastic at first, orange lawn bags with Better bags, pumpkin-face bags at the top
  tier = tier == null ? S.lv.bagPrice : tier;
  c.save(); c.translate(x, y); c.scale(s/10, s/10);
  c.fillStyle = 'rgba(35,25,10,.25)'; ell(c, 0.6, 0.2, 5, 1.2); c.fill();
  const body = () => { c.beginPath(); c.moveTo(-1.3, -8.2); c.bezierCurveTo(-5.8, -7.6, -6, -1.2, -4.3, -0.3); c.quadraticCurveTo(0, 0.8, 4.3, -0.3); c.bezierCurveTo(6, -1.2, 5.8, -7.6, 1.3, -8.2); c.closePath(); };
  const clear = tier < 2, pumpkin = tier >= 4, harvest = tier >= 7, sprig = tier >= 9;
  body(); c.fillStyle = clear ? '#b8582a' : pumpkin ? '#e47a22' : '#d4672a'; c.fill();
  c.save(); body(); c.clip();
  if (clear){ const rnd = mulberry(17); for (let i=0;i<9;i++){ c.fillStyle = LEAFC[Math.floor(rnd()*LEAFC.length)].c; ell(c, -4 + rnd()*8, -7 + rnd()*7, 1.3, 0.8); c.fill(); } c.fillStyle = 'rgba(235,240,240,.32)'; c.fillRect(-6, -9, 12, 10); }
  else if (pumpkin){
    c.strokeStyle = 'rgba(150,60,10,.55)'; c.lineWidth = 0.5; for (const k of [-2.6, 0, 2.6]){ c.beginPath(); c.moveTo(k*0.6, -8); c.quadraticCurveTo(k*1.5, -4, k*0.7, 0); c.stroke(); }
    c.fillStyle = '#3a2416'; c.beginPath(); c.moveTo(-2.8, -5.2); c.lineTo(-1.4, -5.2); c.lineTo(-2.1, -6.4); c.closePath(); c.fill(); c.beginPath(); c.moveTo(1.4, -5.2); c.lineTo(2.8, -5.2); c.lineTo(2.1, -6.4); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-2.8, -3.4); c.quadraticCurveTo(0, -1.4, 2.8, -3.4); c.quadraticCurveTo(0, -2.4, -2.8, -3.4); c.fill();
  } else { c.fillStyle = 'rgba(120,45,10,.25)'; ell(c, 1.5, -2.5, 3.5, 2.6); c.fill(); }
  c.restore();
  c.fillStyle = 'rgba(255,245,225,.42)'; ell(c, -2.7, -5, 0.8, 2.3); c.fill();
  c.fillStyle = clear ? '#c9b8a0' : harvest ? '#d9a630' : '#b8551c';
  c.beginPath(); c.moveTo(-1.3, -8.2); c.lineTo(-0.5, -9.4); c.lineTo(0.5, -9.4); c.lineTo(1.3, -8.2); c.closePath(); c.fill();
  c.save(); c.translate(-1, -10.1); c.rotate(-0.6); ell(c, 0, 0, 1.3, 0.7); c.fill(); c.restore();
  c.save(); c.translate(1.1, -10.1); c.rotate(0.6); ell(c, 0, 0, 1.3, 0.7); c.fill(); c.restore();
  if (harvest){ c.fillStyle = 'rgba(255,236,160,.8)'; ell(c, -0.9, -10.3, 0.5, 0.25); c.fill(); }
  if (sprig){
    // a little oak sprig tucked under the gold tie
    c.strokeStyle = '#6b4a24'; c.lineWidth = 0.35; c.beginPath(); c.moveTo(0.2, -9.6); c.quadraticCurveTo(1.6, -11.6, 3.2, -12.1); c.stroke();
    c.fillStyle = '#c0432a'; c.save(); c.translate(2.2, -11.6); c.rotate(-0.7); ell(c, 0, 0, 1.25, 0.6); c.fill(); c.restore();
    c.fillStyle = '#e39a2a'; c.save(); c.translate(3.4, -12.1); c.rotate(-0.2); ell(c, 0, 0, 1, 0.5); c.fill(); c.restore();
  }
  c.restore();
}
function drawIngot(c, x, y, s, rot, grade, wet){
  // RAINY HOLLOW: a bundle of dry firewood (this place's "ingot"): split logs tied together. Better bundles get a
  // better tie (twine, red twine, a leather strap, a brass band, a green ribbon, a gold band). A wet one is dark.
  grade = grade == null ? S.lv.ingotGrade : grade;
  const tie = ['#c9b07a', '#b8392a', '#6a4426', '#c9a24a', '#3f8a4a', '#f2c443'][clamp(grade, 0, 5)];
  c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.scale(s/10, s/10);
  const wood = wet ? ['#4a3626', '#5e4430', '#3a2a1e'] : ['#c99a62', '#e2bb84', '#9c7244'];
  c.fillStyle = 'rgba(20,12,6,.25)'; ell(c, 0.5, 0.2, 5.6, 1.1); c.fill();
  // four split pieces, end-on, two on two
  const pieces = [[-2.6, -1.8], [2.6, -1.8], [0, -4.6], [-0.2, -1.4]];
  for (const [px, py] of pieces){
    c.fillStyle = wood[2]; c.beginPath(); c.moveTo(px - 2.6, py + 1.6); c.lineTo(px + 2.6, py + 1.6); c.lineTo(px + 1.4, py - 1.6); c.lineTo(px - 1.6, py - 1.4); c.closePath(); c.fill();
    c.fillStyle = wood[0]; c.beginPath(); c.moveTo(px - 2.2, py + 1.3); c.lineTo(px + 2.2, py + 1.3); c.lineTo(px + 1.1, py - 1.2); c.lineTo(px - 1.3, py - 1.1); c.closePath(); c.fill();
    c.strokeStyle = wood[1]; c.lineWidth = 0.35; c.beginPath(); c.arc(px + 0.4, py + 1.8, 1.6, -2.6, -0.5); c.stroke();
  }
  c.fillStyle = tie; c.fillRect(-0.9, -6.2, 1.8, 8.4);
  c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(-0.9, -6.2, 0.5, 8.4);
  if (grade >= 3){ c.fillStyle = shade(tie, 0.7); ell(c, 0, -6, 1.3, 0.8); c.fill(); }
  if (wet){ c.fillStyle = 'rgba(205,222,236,.7)'; ell(c, -2.2, 0.4, 0.5, 0.8); c.fill(); ell(c, 2.4, 0.7, 0.45, 0.7); c.fill(); }
  c.restore();
}
const BOW_COL = [['#e8eef4', '#aab4bf'], ['#2f6fb5', '#1f4f86'], ['#f2c443', '#b8862a']];
function drawGiftJar(c, x, y, s, k = 1, tier = S.lv.giftPrice | 0){
  // RAINY HOLLOW: a gift basket: the punnet wrapped in a checked cloth, tied with a ribbon and a bow
  drawJar(c, x, y, s);
  if (k < 0.3) return;
  c.save(); c.translate(x, y); c.scale(s/6, s/6);
  c.fillStyle = '#3f6a4a'; c.beginPath(); c.moveTo(-4.9, -1.2); c.quadraticCurveTo(-5.6, -5.4, -2.4, -5.8); c.quadraticCurveTo(0, -4.2, 2.4, -5.8); c.quadraticCurveTo(5.6, -5.4, 4.9, -1.2); c.closePath(); c.fill();
  c.fillStyle = 'rgba(235,240,220,.55)'; for (let i=-4; i<=4; i+=2) for (let j=0;j<2;j++) c.fillRect(i - 0.45 + j, -4.6 + j*1.5, 0.9, 0.9);
  c.fillStyle = '#f2e3c4'; c.save(); c.translate(4.2, 0.4); c.rotate(0.35); rr(c, -0.2, 0, 2.2, 2.8, 0.4); c.fill(); c.restore();
  if (k >= 0.6){
    const [b0, b1] = BOW_COL[clamp(tier, 0, 2)], big = tier >= 1 ? 1.2 : 1;
    c.fillStyle = b0; c.fillRect(-0.75, -3.2, 1.5, 8.2); c.fillStyle = b1; c.fillRect(0.35, -3.2, 0.4, 8.2);
    if (k >= 0.85){
      if (tier >= 1){ c.fillStyle = b1; c.beginPath(); c.moveTo(-0.4, -2.8); c.lineTo(-2.4, 0.8); c.lineTo(-1.5, 1); c.lineTo(0, -2.4); c.lineTo(1.5, 1); c.lineTo(2.4, 0.8); c.lineTo(0.4, -2.8); c.closePath(); c.fill(); }
      c.fillStyle = b0; ell(c, -2*big, -3.2, 2*big, 1.3*big); c.fill(); ell(c, 2*big, -3.2, 2*big, 1.3*big); c.fill();
      c.fillStyle = b1; ell(c, -1.7*big, -3.15, 0.8*big, 0.5*big); c.fill(); ell(c, 1.7*big, -3.15, 0.8*big, 0.5*big); c.fill();
      c.fillStyle = b0; ell(c, 0, -3.1, 1, 1); c.fill();
      if (tier >= 2){ c.fillStyle = 'rgba(255,250,220,.9)'; ell(c, -2.4, -3.6, 0.6, 0.35); c.fill(); ell(c, 0.2, -3.4, 0.35, 0.3); c.fill(); }
    }
  }
  c.restore();
}
// a plot that's ready for a building: dashed outline on the ground and a little wooden sign
function drawPlot(c, w, h, label, appearT, sx){
  const kk = clamp((S.t - appearT)/0.5, 0, 1), sc = kk < 1 ? 0.4 + 0.6*(1 - Math.pow(1 - kk, 3)) + Math.sin(kk*Math.PI)*0.12 : 1;
  c.strokeStyle = '#d9a43a'; c.lineWidth = 2; c.setLineDash([4, 3]); rr(c, -w/2, -h, w, h, 4); c.stroke(); c.setLineDash([]);
  c.save(); c.translate(sx || 0, -h*0.4); c.scale(sc, sc);
  c.font = '800 8px "Baloo 2", sans-serif'; const tw = c.measureText(label).width + 12;
  c.fillStyle = '#6e4a30'; rr(c, -2, -30, 4, 31, 1.5); c.fill();
  c.rotate(Math.sin(S.t*1.2)*0.015);
  c.fillStyle = '#5a3b26'; rr(c, -tw/2 - 1.5, -46, tw + 3, 19, 4); c.fill();
  c.fillStyle = '#f3e7cf'; rr(c, -tw/2, -44.5, tw, 16, 3); c.fill();
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#4a3226'; c.fillText(label, 0, -36);
  c.restore();
}

// ── the bagging table: a workbench between the pickup sign and the bin, with two bag stands, a roll of bags and a stack
// of flat ones. A robot behind each stand fills a bag from the bin, ties it, and it goes in the bin for the truck.
function drawBagger(){
  if (!baggerShown()) return;
  const c = ctx;
  c.save(); c.translate(BAGGER.x, BAGGER.y);
  if (!S.bag.built){ drawPlot(c, 56, 22, 'bagging table', plantRt.bagShownT); c.restore(); return; }
  const grow = clamp((S.t - plantRt.bagBuiltT)/0.8, 0, 1); if (grow < 1) c.scale(1, ease(grow));
  c.fillStyle = 'rgba(35,25,10,.3)'; ell(c, 2, 2, 34, 6); c.fill();
  // legs and a lower shelf
  c.fillStyle = '#6e4a30'; for (const lx of [-26, 22]){ rr(c, lx, -24, 4, 24, 1); c.fill(); }
  c.fillStyle = '#8a6040'; rr(c, -25, -9, 50, 3, 1); c.fill();
  // flat folded bags on the shelf
  for (let i=0;i<3;i++){ c.fillStyle = i % 2 ? '#c9762e' : '#d98a3a'; rr(c, -18 + i*1.2, -12 - i*1.6, 16, 1.8, 0.6); c.fill(); }
  // the top
  c.fillStyle = '#9a6a42'; rr(c, -30, -28, 60, 5, 1.5); c.fill();
  c.fillStyle = 'rgba(255,230,190,.2)'; c.fillRect(-28, -27.6, 56, 1.2);
  // a roll of bags on a little holder at the left end
  c.fillStyle = '#4a423b'; c.fillRect(-28, -36, 1.6, 8); c.fillRect(-19, -36, 1.6, 8);
  c.fillStyle = '#d4672a'; rr(c, -27, -38, 9, 6, 2.5); c.fill(); c.fillStyle = 'rgba(255,240,220,.35)'; c.fillRect(-26, -37, 7, 1);
  c.strokeStyle = '#d4672a'; c.lineWidth = 1; c.beginPath(); c.moveTo(-22.5, -32); c.quadraticCurveTo(-21, -27, -24, -24); c.stroke();
  // two wire bag stands, each holding an open bag that fills while a robot works
  for (let k=0;k<2;k++){
    const bx = k ? 13 : -8, ri = STN.bag[k], r = ri != null ? R[ri] : null, fill = r && r.st === 'bag' ? clamp(r.workP, 0, 1) : 0;
    c.strokeStyle = '#6c7378'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(bx - 6, -28); c.lineTo(bx - 6, -44); c.moveTo(bx + 6, -28); c.lineTo(bx + 6, -44); c.stroke();
    c.beginPath(); c.ellipse(bx, -44, 6.5, 2, 0, 0, TAU); c.stroke();
    // the open bag hanging from the ring
    c.fillStyle = S.lv.bagPrice < 2 ? 'rgba(225,225,215,.55)' : 'rgba(214,103,42,.8)';
    c.beginPath(); c.moveTo(bx - 6.5, -44); c.quadraticCurveTo(bx - 7.5, -30, bx - 4.5, -28.5); c.lineTo(bx + 4.5, -28.5); c.quadraticCurveTo(bx + 7.5, -30, bx + 6.5, -44); c.closePath(); c.fill();
    if (fill > 0){
      const h = 15*fill, rnd = mulberry(30 + k + Math.floor(fill*8));
      c.save(); c.beginPath(); c.rect(bx - 7, -29 - h, 14, h); c.clip();
      for (let i=0;i<10;i++) drawLeaf(c, bx - 5 + rnd()*10, -30 - rnd()*h, 2.6, rnd()*TAU, Math.floor(rnd()*LEAFC.length), rnd() < .5 ? 1 : 0, 1, 0.8, 1, 0);
      c.restore();
    }
    c.fillStyle = 'rgba(255,245,225,.3)'; c.fillRect(bx - 5, -42, 1.2, 11);
  }
  // a small painted sign on the front edge
  c.fillStyle = '#efe2c6'; rr(c, -9, -25.5, 18, 6, 1.5); c.fill();
  c.font = '800 4.6px "Baloo 2", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#7c3a1c'; c.fillText('BAGS', 0, -22.3);
  c.restore();
}
// the bags waiting for the truck sit in the bin with the loose leaves; a tag on the bin's side counts them
function drawBinBags(c, tag){
  const n = S.bag.bags; if (!S.bag.built) return;
  if (!tag){
    const shown = n <= 0 ? 0 : Math.max(1, Math.round(clamp(n/bagCap(), 0, 1)*6));
    const pos = [[16, -44], [27, -45], [21, -51], [9, -48], [31, -51], [26, -56]];
    for (let i=0;i<shown;i++) drawLeafBag(c, pos[i][0], pos[i][1], 13);
    return;
  }
  // a little chalk tag nailed to the bottom left of the bin
  c.fillStyle = '#734428'; rr(c, -37, -15, 26, 13, 2); c.fill();
  c.fillStyle = '#2f3a34'; rr(c, -35.8, -13.8, 23.6, 10.6, 1.6); c.fill();
  drawLeafBag(c, -31.2, -4.6, 8);
  const label = n + '/' + bagCap(); let fs = 9.5; c.font = '700 ' + fs + 'px Caveat, cursive'; const lw = c.measureText(label).width; if (lw > 13) fs = fs*13/lw;
  chalk(c, label, -19.5, -8.6, fs, n >= bagCap() ? '#ffb38a' : '#efe8d8');
}

// ── the ingot pallet beside the metal tub: haulers stack the smelted ingots here and the truck takes them
function drawPallet(){
  // RAINY HOLLOW: the woodshed by the road (this place's ingot pallet): a little roofed rack where haulers stack the
  // dry bundles, out of the rain, until the truck takes them
  if (!S.plant.built) return;
  const c = ctx, n = S.ingots, cap = palletCap();
  const grow = clamp((S.t - plantRt.builtT - 0.4)/0.6, 0, 1); if (grow <= 0) return;
  c.save(); c.translate(PALLET.x, PALLET.y); c.scale(ease(grow), ease(grow));
  c.fillStyle = 'rgba(20,14,8,.32)'; ell(c, 2, 2, 28, 5.5); c.fill();
  // back wall and posts
  c.fillStyle = '#5e4632'; c.fillRect(-23, -42, 46, 40);
  c.strokeStyle = 'rgba(20,12,8,.4)'; c.lineWidth = 0.8; for (let x=-15; x<23; x+=8){ c.beginPath(); c.moveTo(x, -42); c.lineTo(x, -2); c.stroke(); }
  c.fillStyle = '#9a7a52'; rr(c, -24, -4, 48, 4, 1); c.fill();
  // dry bundles: rows of four, three, two, one (a picture, not a count)
  const shown = n <= 0 ? 0 : Math.max(1, Math.round(clamp(n/cap, 0, 1)*10)), rows = [[-15, -5, 5, 15], [-10, 0, 10], [-5, 5], [0]];
  let k = 0;
  rows.forEach((row, ri) => row.forEach(x => { if (k++ < shown) drawIngot(c, x*1.05, -4.5 - ri*8.6, 12); }));
  c.fillStyle = '#5a3b26'; rr(c, -25, -44, 4.5, 44, 1.2); c.fill(); rr(c, 20.5, -44, 4.5, 44, 1.2); c.fill();
  // the roof, slanting back, with drips along the front edge
  c.fillStyle = '#3d332c'; c.beginPath(); c.moveTo(-30, -42); c.lineTo(30, -42); c.lineTo(26, -52); c.lineTo(-26, -52); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(15,10,8,.5)'; c.lineWidth = 0.8; for (let x=-24; x<28; x+=6){ c.beginPath(); c.moveTo(x, -42); c.lineTo(x*0.9, -52); c.stroke(); }
  c.fillStyle = 'rgba(200,215,228,.3)'; c.fillRect(-26, -51.5, 52, 0.8);
  c.fillStyle = 'rgba(205,222,236,.75)'; for (const dx of [-27, -13, 2, 16, 28]){ const ph = (S.t*0.8 + dx*0.13) % 1; ell(c, dx, -41 + ph*8, 0.6, 0.9); c.fill(); }
  // chalk tag on the post
  c.fillStyle = '#734428'; rr(c, 17, -36, 20, 13, 2); c.fill(); c.fillStyle = '#2f3a34'; rr(c, 18.3, -34.7, 17.4, 10.4, 1.6); c.fill();
  const label = n + '/' + cap; let fs = 9.5; c.font = '700 ' + fs + 'px Caveat, cursive'; const lw = c.measureText(label).width; if (lw > 15) fs = fs*15/lw;
  chalk(c, label, 27, -29.3, fs, n >= cap ? '#ffb38a' : '#efe8d8');
  c.restore();
}

// ── the smelting plant: a red-brick Victorian works with tall chimneys, brass portholes and an amber core.
// Three furnace doors along the front (a robot can work at each), the ore hopper on the left and the ingot rack on the right.
function brickWall(c, x0, y0, w, h, base){
  c.fillStyle = base; c.fillRect(x0, y0, w, h);
  c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip();
  const rnd = mulberry(Math.round(x0*7 + w));
  for (let row=0, y=y0 + h; y > y0; row++, y -= 4.4){
    const off = row % 2 ? 0 : 4.5;
    for (let x = x0 - off; x < x0 + w; x += 9){
      c.fillStyle = rnd() < 0.18 ? shade(base, 0.82) : rnd() < 0.15 ? shade(base, 1.12) : base;
      c.fillRect(x + 0.4, y - 4, 8.2, 3.6);
    }
  }
  c.fillStyle = 'rgba(40,20,12,.35)';
  for (let y = y0 + h; y > y0; y -= 4.4) c.fillRect(x0, y - 0.4, w, 0.5);
  c.restore();
}
function drawPlant(){
  // RAINY HOLLOW: the drying shed (this place's smelting plant): an open-fronted timber barn with a mossy shingle roof,
  // three iron stoves with racks of logs steaming above them (a robot works at each), a stone chimney, the wet wood
  // stack under a tarp on the left and the shelf of dry bundles on the right
  if (!plantShown()) return;
  const c = ctx;
  c.save(); c.translate(PLANT.x, PLANT.y);
  if (!S.plant.built){ drawPlot(c, 150, 46, 'drying shed', plantRt.shownT); c.restore(); return; }
  const grow = clamp((S.t - plantRt.builtT)/1.5, 0, 1); if (grow < 1) c.scale(1, ease(grow));
  const busy = [0, 1, 2].map(i => { const ri = STN.smelt[i]; return ri != null && R[ri] && R[ri].st === 'smelt'; });
  const any = busy.some(b => b), t = S.t, st2 = stoker();
  c.lineCap = 'round';
  c.fillStyle = 'rgba(20,14,8,.36)'; ell(c, 6, 3, 108, 13); c.fill();
  // a flagstone floor in front
  c.fillStyle = '#5e5850'; rr(c, -72, -6, 144, 10, 3); c.fill();
  c.strokeStyle = 'rgba(25,20,16,.5)'; c.lineWidth = 0.8; for (let x=-64; x<72; x+=13){ c.beginPath(); c.moveTo(x, -6); c.lineTo(x - 2, 4); c.stroke(); }
  // stone chimney behind the roof
  { const cx = 34, ctop = -138; c.fillStyle = '#6a645c'; c.fillRect(cx - 8, ctop, 16, 60); const r2 = mulberry(31); for (let y=ctop; y<-80; y+=5) for (let x=cx - 8 + ((y/5) % 2 ? 0 : 4); x<cx + 8; x+=8){ c.fillStyle = r2() < .5 ? '#7d776e' : '#5a554e'; rr(c, x + 0.4, y + 0.4, 7.2, 4.2, 1); c.fill(); } c.fillStyle = '#4a4540'; c.fillRect(cx - 10, ctop - 4, 20, 5); c.fillStyle = '#231a16'; ell(c, cx, ctop - 4, 7, 1.6); c.fill(); }
  // back wall (dark inside) with warm light around the stoves
  c.fillStyle = '#2a1e16'; c.fillRect(-64, -74, 128, 70);
  const ig = c.createRadialGradient(0, -20, 6, 0, -24, 90); ig.addColorStop(0, 'rgba(255,160,70,' + (any ? 0.32 : 0.14) + ')'); ig.addColorStop(1, 'rgba(255,160,70,0)'); c.fillStyle = ig; c.fillRect(-64, -74, 128, 70);
  c.strokeStyle = 'rgba(70,50,36,.6)'; c.lineWidth = 1; for (let x=-58; x<64; x+=9){ c.beginPath(); c.moveTo(x, -74); c.lineTo(x, -4); c.stroke(); }
  // three stoves, each with a rack of logs steaming over it
  for (let i=0;i<3;i++){
    const dx = (i - 1)*40, on = busy[i], fl = on ? (st2 ? 0.92 : 0.75) + (st2 ? 0.08 : 0.22)*Math.sin(t*13 + i*2) : 0.22 + 0.05*Math.sin(t*2 + i);
    // the rack: two rails and a row of logs
    c.strokeStyle = '#5a3b26'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(dx - 15, -56); c.lineTo(dx - 15, -36); c.moveTo(dx + 15, -56); c.lineTo(dx + 15, -36); c.stroke();
    c.strokeStyle = '#7a5236'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(dx - 17, -50); c.lineTo(dx + 17, -50); c.stroke();
    for (let k=0;k<4;k++){ const lx = dx - 10.5 + k*7; c.fillStyle = on ? '#8a6642' : '#4e3a28'; ell(c, lx, -53, 3.2, 3.2); c.fill(); c.strokeStyle = 'rgba(60,40,24,.8)'; c.lineWidth = 0.5; ell(c, lx, -53, 1.6, 1.6); c.stroke(); }
    // the stove: a squat iron box on legs with a pipe, its door glowing while someone works
    c.fillStyle = '#26221f'; rr(c, dx - 13, -32, 26, 24, 3); c.fill();
    c.fillStyle = '#3a3532'; rr(c, dx - 13, -32, 26, 4, 2); c.fill();
    c.fillStyle = '#1a1714'; c.fillRect(dx - 11, -8, 3, 5); c.fillRect(dx + 8, -8, 3, 5);
    c.strokeStyle = '#2f2a26'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(dx + 6, -32); c.lineTo(dx + 6, -38); c.stroke();
    const fg = c.createRadialGradient(dx, -18, 1, dx, -18, 10); fg.addColorStop(0, 'rgba(255,236,160,' + fl + ')'); fg.addColorStop(0.5, 'rgba(255,140,40,' + fl*0.9 + ')'); fg.addColorStop(1, 'rgba(120,30,10,' + fl*0.6 + ')');
    c.fillStyle = fg; rr(c, dx - 8, -25, 16, 11, 2.5); c.fill();
    c.strokeStyle = '#141110'; c.lineWidth = 0.9; for (const gx of [-4, 0, 4]){ c.beginPath(); c.moveTo(dx + gx, -25); c.lineTo(dx + gx, -14); c.stroke(); }
    c.fillStyle = '#c9a24a'; ell(c, dx + 9.5, -19.5, 0.9, 0.9); c.fill();
    if (on){ c.fillStyle = 'rgba(255,170,70,.16)'; ell(c, dx, 0, 16, 4); c.fill(); }
  }
  // posts between the bays and the front beam
  c.fillStyle = '#5a3b26'; for (const px of [-66, -20.5, 19.5, 62]){ rr(c, px, -78, 5, 76, 1.2); c.fill(); }
  c.fillStyle = '#6e4a30'; rr(c, -70, -80, 140, 6, 1.5); c.fill();
  c.fillStyle = 'rgba(210,222,232,.18)'; c.fillRect(-68, -79.5, 136, 1);
  // the shingle roof: rows of mossy wooden shingles with a ridge, overhanging the front
  for (let row=0; row<6; row++){
    const y = -80 - row*6.2, half = 78 - row*10.5;
    c.fillStyle = row % 2 ? '#4a3d33' : '#54463a'; c.beginPath(); c.moveTo(-half, y + 2); c.lineTo(half, y + 2); c.lineTo(half - 9, y - 6); c.lineTo(-half + 9, y - 6); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(15,10,8,.45)'; c.lineWidth = 0.7; for (let x=-half + 4 + (row % 2)*3; x<half - 2; x+=7){ c.beginPath(); c.moveTo(x, y + 2); c.lineTo(x, y - 4); c.stroke(); }
  }
  c.fillStyle = '#3a2f27'; rr(c, -18, -118, 36, 4, 1.5); c.fill();
  { const r3 = mulberry(57); c.fillStyle = '#56702a'; for (let k=0;k<16;k++){ ell(c, (r3() - 0.5)*130*(1 - r3()*0.3), -84 - r3()*30, 2 + r3()*4, 1 + r3()*1.2); c.fill(); } }
  c.fillStyle = 'rgba(200,215,228,.25)'; c.fillRect(-60, -113, 120, 0.8);
  // drips off the front of the roof
  c.fillStyle = 'rgba(205,222,236,.8)'; for (let k=0;k<11;k++){ const dx = -76 + k*15.2, ph = (t*0.85 + k*0.29) % 1; ell(c, dx, -78 + ph*16, 0.8, 1.1); c.fill(); }
  // the bellows intake: a small iron grate in the floor, glowing when a blower works it
  { const vx = PLANT_VENT.x - PLANT.x, vy = PLANT_VENT.y - PLANT.y, gl = st2 ? 0.55 + 0.25*Math.sin(t*14) : 0.12;
    c.fillStyle = '#3a3532'; ell(c, vx, vy, 7, 2.8); c.fill(); c.fillStyle = 'rgba(255,150,50,' + gl + ')'; ell(c, vx, vy, 5.6, 2.1); c.fill();
    c.strokeStyle = '#1a1714'; c.lineWidth = 0.9; for (const gx of [-3, 0, 3]){ c.beginPath(); c.moveTo(vx + gx, vy - 1.8); c.lineTo(vx + gx, vy + 1.8); c.stroke(); } }
  // the wet wood stack on the left, under a green tarp
  c.save(); c.translate(HOPPER.x - PLANT.x, HOPPER.y - PLANT.y);
  c.fillStyle = '#4a3426'; c.fillRect(-15, -40, 3, 40); c.fillRect(12, -40, 3, 40);
  c.fillStyle = '#2a1e16'; c.fillRect(-14, -36, 28, 36);
  { const f = clamp(S.plant.ore/hopperCap(), 0, 1), n = Math.ceil(f*12), rnd = mulberry(23); for (let i=0;i<n;i++){ const row = Math.floor(i/3), k = i % 3; nugget(c, -8 + k*8 + (row % 2)*2, -4 - row*6.2, 4.6, (rnd() - 0.5)*0.2); } }
  c.fillStyle = '#3f6a4a'; c.beginPath(); c.moveTo(-20, -38); c.quadraticCurveTo(0, -46, 20, -38); c.lineTo(17, -34); c.quadraticCurveTo(0, -40, -17, -34); c.closePath(); c.fill();
  c.fillStyle = 'rgba(210,228,236,.3)'; c.fillRect(-14, -42.5, 28, 0.8);
  c.fillStyle = '#2f3a34'; rr(c, -11, -34, 22, 10, 2); c.fill();
  chalk(c, Math.floor(S.plant.ore) + '/' + hopperCap(), 0, -28.8, 9, S.plant.ore >= hopperCap() ? '#ffb38a' : '#efe8d8');
  c.restore();
  // the shelf of fresh dry bundles on the right, under the roof's end
  c.save(); c.translate(RACK.x - PLANT.x, RACK.y - PLANT.y);
  c.fillStyle = '#4a3426'; c.fillRect(-15, -40, 3, 40); c.fillRect(12, -40, 3, 40);
  c.fillStyle = '#8a6040'; rr(c, -16, -19, 32, 3, 1); c.fill(); rr(c, -16, -37, 32, 3, 1); c.fill();
  const nr = Math.min(S.plant.rack, RACK_CAP);
  for (let i=0;i<nr;i++){ const shelf = i < 4 ? 0 : 1, k = i % 4; drawIngot(c, -9 + k*6, shelf ? -37 : -19, 7, 0); }
  c.fillStyle = '#3d332c'; c.beginPath(); c.moveTo(-20, -40); c.lineTo(20, -40); c.lineTo(17, -46); c.lineTo(-17, -46); c.closePath(); c.fill();
  if (plantRt.bump > 0){ c.fillStyle = 'rgba(255,200,120,' + plantRt.bump + ')'; ell(c, 0, -26, 18, 10); c.fill(); }
  c.restore();
  c.restore();
  // smoke from the chimney and steam off the drying racks while the shed works
  if (!simMode && grow >= 1){
    const k = any ? 1 : 0.2;
    if (Math.random() < 0.06*k*(reduceMotion ? 0.3 : 1)) parts.push({ k:'smoke', x: PLANT.x + 34 + rand(-2, 2), y: PLANT.y - 144, vx: rand(-4, 4) + wind*0.25, vy: rand(-22, -14), g: 0, life: rand(2.2, 3.4), t: 0, r: rand(4, 6) });
    for (let i=0;i<3;i++) if (busy[i] && Math.random() < 0.08) parts.push({ k:'dust', x: PLANT.x + (i - 1)*40 + rand(-10, 10), y: PLANT.y - 58, vx: rand(-4, 4), vy: rand(-18, -10), g: 0, life: rand(0.8, 1.3), t: 0, r: rand(2, 3.5), gray: true });
  }
  if (grow >= 1){
    if (S.plant.rack >= RACK_CAP) bubbles.push({ x: RACK.x, y: RACK.y - 56, t: 'shelf full' });
    else if (S.plant.ore < metalPerIngot() - 1e-9 && STN.smelt.some(v => v != null) && !S.binMetal && !R.some(r => r.st === 'toBin' && r.at === 'metal')) bubbles.push({ x: HOPPER.x, y: HOPPER.y - 60, t: 'needs wet wood' });
  }
}

// ── a mine shaft: a timber headframe with a turning wheel over a framed hole, and an ore cart beside it
function drawShaft(i){
  // RAINY HOLLOW: a wood shelter (this place's mine shaft): a plank lean-to over the pile so the wood keeps drier, a
  // chopping block with a flywheel-driven splitter, and a cart of logs. Room for two robots.
  const p = SPOTS[i], c = ctx, t = S.t;
  const ws = minerWorkers(i), working = ws.some(ri => R[ri] && R[ri].st === 'mine');
  const dug = HB.some(h => h.kind === 'blower' && h.st === 'dig' && h.dig === i);
  c.save(); c.translate(p.x, p.y);
  c.lineCap = 'round';
  // back posts
  c.fillStyle = '#4a3426'; rr(c, -38, -74, 4, 52, 1); c.fill(); rr(c, 40, -74, 4, 52, 1); c.fill();
  // the cart of logs (right, behind the block)
  c.fillStyle = '#4a423b'; ell(c, 26, -9, 3, 3); c.fill(); ell(c, 40, -9, 3, 3); c.fill();
  c.fillStyle = '#6e4a30'; c.beginPath(); c.moveTo(20, -24); c.lineTo(46, -24); c.lineTo(43, -12); c.lineTo(23, -12); c.closePath(); c.fill();
  c.fillStyle = '#8a6040'; c.fillRect(20, -24, 26, 2);
  const rnd = mulberry(i*13 + 5); for (let k=0;k<4;k++) nugget(c, 25 + rnd()*15, -26 - rnd()*3, 3.2, (rnd() - 0.5)*0.4);
  // the chopping block, with chips around it
  c.fillStyle = 'rgba(200,160,100,.6)'; for (let k=0;k<12;k++){ ell(c, 4 + (rnd() - 0.5)*30, 4 + (rnd() - 0.5)*8, 1.2, 0.6); c.fill(); }
  c.fillStyle = '#4c3828'; rr(c, -7, -10, 22, 13, 3); c.fill();
  c.fillStyle = '#a8845a'; ell(c, 4, -10, 11, 3.4); c.fill();
  c.strokeStyle = 'rgba(80,52,30,.7)'; c.lineWidth = 0.6; ell(c, 4, -10, 6.5, 2); c.stroke(); ell(c, 4, -10, 2.4, 0.8); c.stroke();
  // the splitter: a beam on a pivot, its wedge lifted by a cam on the flywheel and dropped onto the block
  const lift = working ? Math.max(0, Math.sin(t*5)) : 0.3, ang = -0.2 - lift*0.55;
  c.strokeStyle = '#6a4630'; c.lineWidth = 3; c.beginPath(); c.moveTo(26, 2); c.lineTo(28, -44); c.stroke();
  c.save(); c.translate(28, -40); c.rotate(Math.PI + ang);
  c.strokeStyle = '#7a5236'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(0, 0); c.lineTo(26, 0); c.stroke();
  c.fillStyle = '#8f979b'; c.beginPath(); c.moveTo(22, -3); c.lineTo(30, -3); c.lineTo(26, 6); c.closePath(); c.fill();
  c.restore();
  c.save(); c.translate(28, -44); c.rotate(working ? t*5 : 0);
  c.strokeStyle = '#4a423b'; c.lineWidth = 1.8; ell(c, 0, 0, 7, 7); c.stroke();
  c.lineWidth = 1; for (let k=0;k<6;k++){ c.rotate(TAU/6); c.beginPath(); c.moveTo(0, 0); c.lineTo(6.5, 0); c.stroke(); }
  c.fillStyle = '#c9a24a'; ell(c, 0, 0, 1.8, 1.8); c.fill();
  c.restore();
  // the plank roof on its front posts, mossy, dripping along the front edge
  c.fillStyle = '#5a3b26'; rr(c, -42, -58, 4.5, 62, 1.2); c.fill(); rr(c, 44, -58, 4.5, 62, 1.2); c.fill();
  c.fillStyle = '#3d332c'; c.beginPath(); c.moveTo(-48, -56); c.lineTo(52, -56); c.lineTo(48, -78); c.lineTo(-44, -78); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(15,10,8,.5)'; c.lineWidth = 0.9; for (let x=-42; x<50; x+=8){ c.beginPath(); c.moveTo(x, -56); c.lineTo(x - 1.5, -78); c.stroke(); }
  c.fillStyle = '#56702a'; for (let k=0;k<7;k++){ ell(c, -40 + rnd()*86, -70 + rnd()*12, 3 + rnd()*4, 1.2 + rnd()); c.fill(); }
  c.fillStyle = 'rgba(200,215,228,.3)'; c.fillRect(-44, -77.5, 92, 0.9);
  c.fillStyle = 'rgba(205,222,236,.8)'; for (let k=0;k<7;k++){ const dx = -44 + k*15, ph = (t*0.9 + k*0.37) % 1; ell(c, dx, -55 + ph*14, 0.7, 1); c.fill(); }
  // a lamp hanging under the roof
  c.strokeStyle = '#2f2a26'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-20, -56); c.lineTo(-20, -48); c.stroke();
  const on = working || dug;
  c.fillStyle = on ? '#ffd36b' : '#7d6a4a'; ell(c, -20, -46, 2.4, 2.4); c.fill();
  if (on){ c.fillStyle = 'rgba(255,211,107,.25)'; ell(c, -20, -46, 6, 6); c.fill(); }
  c.restore();
  if (working && !simMode && lift > 0.95 && Math.random() < 0.5) for (let k=0;k<3;k++) parts.push({ k:'speck', x: p.x + 4 + rand(-6, 6), y: p.y - 12, vx: rand(-40, 40), vy: rand(-50, -15), g: 140, life: rand(.4, .7), t: 0, saw: true });
  if (dug && !simMode && Math.random() < 0.12) parts.push({ k:'dust', x: p.x + rand(-20, 20), y: p.y - 10, vx: rand(-4, 4), vy: rand(-20, -10), g: 0, life: rand(1, 1.6), t: 0, r: rand(3, 6), gray: true });
}

// which of the three generations of a track a level falls in (levels 0–3, 4–7, 8+), for the look of wheels and baskets
const tierOf = L => L >= 8 ? 2 : L >= 4 ? 1 : 0;
// Wheels look different for each tier, so you can tell at a glance who has what: creaky old wheels with dark hubs,
// chunky rubber treads with lugs and orange hub caps, then bright ball-bearing hubs with brass rims and turning spokes.
function drawWheels(c, tw, th, moving, anim, tier, roll, o){
  o = o || {};
  const md = o.md, off = moving ? (anim*28) % 6 : 0, hub = o.chunky ? 3.6 : 3;
  if (tier === 0){
    c.fillStyle = md ? '#2b3034' : '#3b3430'; rr(c, -tw/2, -th + 1, tw, th, th/2); c.fill();
    c.fillStyle = md ? '#454c51' : '#5a524b'; for (let i=-tw/2 + 2 + off; i<tw/2 - 2; i+=6) c.fillRect(i, -th + 2, 2, th - 2);
    for (const hx of [-tw/2 + 5, tw/2 - 5]){ c.fillStyle = md ? '#6f7b82' : '#26201d'; ell(c, hx, -th/2 + 1, hub, hub); c.fill(); c.fillStyle = md ? '#c9d2d7' : 'rgba(152,82,40,.6)'; ell(c, hx - 0.6, -th/2 + 0.4, hub*0.35, hub*0.35); c.fill(); }
  } else if (tier === 1){
    const h2 = th + 1;
    c.fillStyle = '#2a2522'; rr(c, -tw/2 - 1, -h2 + 1, tw + 2, h2, h2/2); c.fill();
    // chunky lugs around the top and bottom of the tread
    c.fillStyle = '#433b36'; const lo = moving ? (anim*30) % 5 : 0;
    for (let x = -tw/2 + 1 + lo; x < tw/2 - 1; x += 5){ c.beginPath(); c.moveTo(x, -h2 + 1); c.lineTo(x + 2.5, -h2 - 0.8); c.lineTo(x + 3.5, -h2 + 1); c.closePath(); c.fill(); c.fillRect(x, -1.2, 3, 1.6); }
    for (const hx of [-tw/2 + 5.5, tw/2 - 5.5]){ c.fillStyle = '#1e1a18'; ell(c, hx, -h2/2 + 1, hub + 0.8, hub + 0.8); c.fill(); c.fillStyle = md ? '#c9d2d7' : '#d4672a'; ell(c, hx, -h2/2 + 1, hub*0.62, hub*0.62); c.fill(); c.fillStyle = '#3b3430'; ell(c, hx, -h2/2 + 1, 0.8, 0.8); c.fill(); }
  } else {
    c.fillStyle = '#2b2725'; rr(c, -tw/2 - 1, -th + 1, tw + 2, th, th/2); c.fill();
    c.fillStyle = 'rgba(255,255,255,.14)'; rr(c, -tw/2 + 2, -th + 1.6, tw - 4, 1.4, 0.7); c.fill();
    c.fillStyle = '#4a4440'; for (let i=-tw/2 + 1 + off*0.66; i<tw/2 - 1; i+=4) c.fillRect(i, -1.4, 2, 1.4);
    // three bright bearing hubs with brass rims; the spokes turn as the robot rolls
    const ang = roll/3.2;
    for (const hx of [-tw/2 + 5, 0, tw/2 - 5]){
      const hy = -th/2 + 1, R = hub + 0.6;
      c.fillStyle = '#b8902f'; ell(c, hx, hy, R + 0.8, R + 0.8); c.fill();
      const hg = c.createRadialGradient(hx - 1, hy - 1, 0.3, hx, hy, R); hg.addColorStop(0, '#ffffff'); hg.addColorStop(0.55, '#c3cbd0'); hg.addColorStop(1, '#6f7b82');
      c.fillStyle = hg; ell(c, hx, hy, R, R); c.fill();
      c.strokeStyle = '#59636a'; c.lineWidth = 0.7; c.beginPath(); for (let k=0;k<4;k++){ const a = ang + k*Math.PI/2; c.moveTo(hx, hy); c.lineTo(hx + Math.cos(a)*R*0.9, hy + Math.sin(a)*R*0.9); } c.stroke();
      c.fillStyle = '#d9b75a'; ell(c, hx, hy, 0.8, 0.8); c.fill();
    }
  }
}
// the robot's basket: back part (drawn before what's inside it) or front part
function drawBasket(c, tier, x0, y0, W, H, front){
  if (tier === 0){
    // a dented tin pail with a wire handle
    if (!front){ c.fillStyle = '#5f676c'; rr(c, x0 + 0.5, y0 - 2, W - 1, H + 1, 2); c.fill(); c.strokeStyle = '#6c7378'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x0 + 1, y0); c.quadraticCurveTo(x0 + W/2, y0 - 7, x0 + W - 1, y0); c.stroke(); return; }
    c.fillStyle = '#9aa3a8'; c.beginPath(); c.moveTo(x0 - 0.5, y0 + 1); c.lineTo(x0 + W + 0.5, y0 + 1); c.lineTo(x0 + W - 1, y0 + H + 1); c.lineTo(x0 + 1, y0 + H + 1); c.closePath(); c.fill();
    c.fillStyle = '#c3cbce'; c.fillRect(x0 - 0.5, y0 + 1, W + 1, 1.2);
    c.strokeStyle = 'rgba(70,80,84,.55)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(x0 + 1, y0 + 4.2); c.lineTo(x0 + W - 1, y0 + 4.2); c.stroke();
    c.fillStyle = 'rgba(70,80,84,.3)'; ell(c, x0 + W*0.65, y0 + 5.6, 1.6, 1); c.fill();
  } else if (tier === 1){
    if (!front){ c.fillStyle = '#6e4521'; rr(c, x0, y0 - 2, W - 2, H + 2, 3); c.fill(); return; }
    c.fillStyle = '#8b5a2b'; rr(c, x0 - 1, y0 + 1, W, H, 2.5); c.fill();
    c.strokeStyle = '#6e4521'; c.lineWidth = 0.8; for (let i = x0 + 2; i < x0 + W - 1; i += 3){ c.beginPath(); c.moveTo(i, y0 + 1.5); c.lineTo(i + 1.5, y0 + H + 0.5); c.stroke(); }
  } else {
    // a sprung steel hopper on a coil spring, with rivets
    if (!front){ c.fillStyle = '#4e575c'; rr(c, x0, y0 - 2, W, H + 2, 2.5); c.fill(); return; }
    c.strokeStyle = '#8f979b'; c.lineWidth = 1; c.beginPath(); for (let k=0;k<4;k++){ const yy = y0 + H + 1 + k*1.3; c.moveTo(x0 + W*0.4, yy); c.lineTo(x0 + W*0.62, yy + 0.65); } c.stroke();
    const g = c.createLinearGradient(x0, 0, x0 + W, 0); g.addColorStop(0, '#6c767c'); g.addColorStop(0.45, '#b4bec3'); g.addColorStop(1, '#5b6469');
    c.fillStyle = g; c.beginPath(); c.moveTo(x0 - 1.5, y0 + 0.5); c.lineTo(x0 + W + 1.5, y0 + 0.5); c.lineTo(x0 + W - 0.5, y0 + H + 1); c.lineTo(x0 + 0.5, y0 + H + 1); c.closePath(); c.fill();
    c.fillStyle = '#d9b75a'; c.fillRect(x0 - 1.5, y0 + 0.5, W + 3, 1.3);
    c.fillStyle = '#3d4245'; for (let k=0;k<4;k++){ ell(c, x0 + 2 + k*(W - 4)/3, y0 + H - 1, 0.6, 0.6); c.fill(); }
  }
}
function drawRobot(r){
  const c = ctx, st = STYLES[r.id];
  const bw = st.bw, bh = st.bh, hw = st.hw, hh = st.hh, tw = st.tw;
  const top = -8 - bh;
  c.save(); c.translate(r.x, r.y);
  c.fillStyle = 'rgba(35,28,12,.3)'; ell(c, 0, 1, tw*0.55, 4.5); c.fill();
  const bob = r.moving ? -Math.abs(Math.sin(r.anim*(st.chunky ? 8 : st.slim ? 13 : 11)))*(st.chunky ? 1 : 1.6) : Math.sin(r.anim*2 + r.id)*0.3;
  c.scale(r.face, 1);
  // treads: they look different for each wheel tier (old wheels, rubber treads, ball-bearing hubs)
  const th = st.chunky ? 12 : 10, md = st.modern;
  drawWheels(c, tw, th, r.moving, r.anim, tierOf(S.robots[r.id].lv.speed), (r.x + r.y*0.4)*r.face, { md, chunky: st.chunky });
  c.translate(0, bob);
  // body
  const g = c.createLinearGradient(0, top, 0, -8); g.addColorStop(0, st.body); g.addColorStop(1, st.body2);
  c.fillStyle = g;
  if (st.round){ ell(c, 0, top + bh/2, bw/2, bh/2 + 1); c.fill(); }
  else if (md){
    // sleek, very rounded shell with a mirror-like streak of light across it
    rr(c, -bw/2, top, bw, bh, 8); c.fill();
    const sh = c.createLinearGradient(-bw/2, 0, bw/2, 0);
    sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.2, 'rgba(255,255,255,.75)'); sh.addColorStop(0.32, 'rgba(255,255,255,0)');
    sh.addColorStop(0.62, 'rgba(120,140,150,.18)'); sh.addColorStop(0.8, 'rgba(255,255,255,.35)'); sh.addColorStop(1, 'rgba(90,105,115,.25)');
    c.fillStyle = sh; rr(c, -bw/2, top, bw, bh, 8); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-bw/2 + 6, top + 0.8); c.lineTo(bw/2 - 6, top + 0.8); c.stroke();
  }
  else { rr(c, -bw/2, top, bw, bh, st.slim ? 6 : st.chunky ? 4 : 5); c.fill(); }
  c.fillStyle = st.band;
  if (md){
    // a thin gold trim line with a fine seam under it
    const gg = c.createLinearGradient(0, top + bh*0.4, 0, top + bh*0.4 + 2.6); gg.addColorStop(0, '#f6dc8c'); gg.addColorStop(1, '#a8812f');
    c.fillStyle = gg; c.fillRect(-bw/2 + 0.6, top + bh*0.4, bw - 1.2, 2.6);
    c.fillStyle = 'rgba(70,85,95,.35)'; c.fillRect(-bw/2 + 2, top + bh*0.4 + 4.6, bw - 4, 0.6);
  }
  else if (st.round){ c.save(); ell(c, 0, top + bh/2, bw/2, bh/2 + 1); c.clip(); c.fillRect(-bw/2, top + bh*0.38, bw, 4); c.restore(); }
  else if (st.hazard){
    // a wide black and yellow hazard-striped belt
    const by = top + bh*0.34, bH = 6;
    c.save(); c.beginPath(); c.rect(-bw/2, by, bw, bH); c.clip();
    c.fillStyle = '#2f2a26'; c.fillRect(-bw/2, by, bw, bH);
    c.fillStyle = '#f2c230'; for (let x = -bw/2 - 8; x < bw/2 + 8; x += 7){ c.beginPath(); c.moveTo(x, by + bH); c.lineTo(x + 3.5, by + bH); c.lineTo(x + 9.5, by); c.lineTo(x + 6, by); c.closePath(); c.fill(); }
    c.restore();
  }
  else if (st.bandW){
    // a wide band (Moss: green with moss growing on it, Ember: charcoal with glowing vents, Lantern: forest green)
    const by = top + bh*0.33, bH = st.bandW;
    c.fillRect(-bw/2, by, bw, bH);
    c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(-bw/2, by, bw, 1);
    c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(-bw/2, by + bH - 1, bw, 1);
    if (st.sprout){ const rnd = mulberry(r.id*7 + 3); for (let k=0;k<7;k++){ c.fillStyle = k % 2 ? '#93b04a' : '#a9c25a'; ell(c, -bw/2 + 2 + rnd()*(bw - 4), by + rnd()*bH, 1.6 + rnd(), 1 + rnd()*0.6); c.fill(); } c.fillStyle = '#7f9a45'; ell(c, -bw*0.2, by + bH + 1.2, 2.4, 1.3); c.fill(); }
    if (st.ember){
      const hot = (r.st === 'smelt' ? 0.95 : 0.6) + 0.15*Math.sin(r.anim*4 + r.id);
      for (let k=0;k<4;k++){ c.fillStyle = 'rgba(255,' + (110 + k*22) + ',40,' + hot + ')'; rr(c, -bw/2 + 3 + k*5.4, by + bH/2 - 1, 3.6, 2, 1); c.fill(); }
      c.fillStyle = 'rgba(255,140,50,.14)'; ell(c, 0, by + bH/2, bw*0.55, bH*0.9); c.fill();
    }
  }
  else c.fillRect(-bw/2, top + bh*0.38, bw, st.chunky ? 4.5 : 3.5);
  if (st.kettle){
    // a little round pressure gauge on its belly
    c.fillStyle = '#7a5a1e'; ell(c, bw*0.18, top + bh*0.7, 3.2, 3.2); c.fill(); c.fillStyle = '#f2e7cf'; ell(c, bw*0.18, top + bh*0.7, 2.3, 2.3); c.fill();
    const ga = -2.4 + 1.6 + Math.sin(r.anim*1.3 + r.id)*0.5; c.strokeStyle = '#a8361d'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(bw*0.18, top + bh*0.7); c.lineTo(bw*0.18 + Math.cos(ga)*2, top + bh*0.7 + Math.sin(ga)*2); c.stroke();
  }
  if (st.rust){ c.fillStyle = 'rgba(152,82,40,' + (0.85*st.rust) + ')'; ell(c, -bw*0.25, top + bh*0.8, 3.2, 2.1); c.fill(); ell(c, bw*0.3, top + bh*0.15, 2, 1.4); c.fill(); ell(c, -bw*0.38, top + bh*0.22, 1.4, 1.1); c.fill(); }
  if (st.patches){
    c.fillStyle = '#9aa3a6'; c.fillRect(-bw/2 + 2, top + bh*0.55, 9, 7); c.fillStyle = '#a4683f'; c.fillRect(bw/2 - 10, top + 2, 8, 6);
    c.fillStyle = '#4c4840'; for (const [px, py] of [[-bw/2+3,top+bh*0.55+1],[-bw/2+10,top+bh*0.55+1],[-bw/2+3,top+bh*0.55+6],[bw/2-9,top+3],[bw/2-3,top+3]]){ ell(c, px, py, .8, .8); c.fill(); }
    c.strokeStyle = 'rgba(60,50,40,.5)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(2, top + bh*0.6); c.lineTo(6, top + bh*0.75); c.lineTo(4, top + bh*0.9); c.stroke();
  }
  if (st.dust){
    const rnd = mulberry(77);
    c.fillStyle = 'rgba(120,96,64,.38)';
    for (let i=0;i<16;i++){ ell(c, -bw/2 + rnd()*bw, top + rnd()*bh, 0.6 + rnd()*0.9, 0.6 + rnd()*0.7); c.fill(); }
    const dg = c.createLinearGradient(0, top + bh*0.6, 0, -8); dg.addColorStop(0, 'rgba(110,86,54,0)'); dg.addColorStop(1, 'rgba(110,86,54,.35)');
    c.fillStyle = dg; rr(c, -bw/2, top + bh*0.6, bw, bh*0.4, 4); c.fill();
  }
  if (!st.round && !st.patches && !md){ c.fillStyle = shade(st.body2, 0.8); for (const [px, py] of [[-bw/2+3,top+2.5],[bw/2-2.5,-11],[-bw/2+3,-11]]){ ell(c, px, py, .9, .9); c.fill(); } }
  // a robot whose first job is mining gets sooty down its front
  const sooty = S.robots[r.id] && S.robots[r.id].prio.length && S.robots[r.id].prio[0].includes('mine');
  if (sooty){
    const rnd = mulberry(r.id*13 + 1);
    const sg = c.createLinearGradient(bw*0.5, 0, -bw*0.1, 0); sg.addColorStop(0, 'rgba(28,24,22,.62)'); sg.addColorStop(1, 'rgba(28,24,22,0)');
    c.save(); rr(c, -bw/2, top, bw, bh, 5); c.clip(); c.fillStyle = sg; c.fillRect(-bw*0.1, top + bh*0.35, bw*0.6, bh*0.65);
    for (let k=0;k<11;k++){ c.fillStyle = 'rgba(28,24,22,' + (0.4 + rnd()*0.3) + ')'; ell(c, bw*0.02 + rnd()*bw*0.46, top + bh*0.2 + rnd()*bh*0.78, 1.2 + rnd()*2.6, 0.9 + rnd()*1.8); c.fill(); }
    c.restore();
  }
  // number plate
  c.fillStyle = '#efe6d0'; rr(c, bw/2 - 9, -17, 7, 6, 1.2); c.fill();
  c.font = '800 6px "Baloo 2", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#4a3226';
  c.save(); c.translate(bw/2 - 5.5, -13.8); c.scale(r.face, 1); c.fillText(String(r.id + 1), 0, 0.4); c.restore();
  // basket on the back: a tin pail, then a wicker hamper, then a sprung steel hopper, a little bigger with every level
  const cl = S.robots[r.id].lv.carry, bt = tierOf(cl), bs = 1 + 0.06*(cl - bt*4);
  const BW = [12, 16, 20][bt]*bs, BH = [7, 7, 8][bt]*bs, bx1 = -bw/2 + 13, bx0 = bx1 - BW, by0 = top - 5 - (BH - 7)*0.6;
  drawBasket(c, bt, bx0, by0, BW, BH, false);
  const n = Math.min(r.carryL, 9 + bt*3), m = Math.min(r.carryM, 6), q = Math.min(r.carryI, 4);
  if (n || m || q){
    const rnd = mulberry(r.id*31 + n + m*7 + q*13), iw = BW - 4;
    for (let i=0;i<n;i++) drawLeaf(c, bx0 + 2 + rnd()*iw, by0 - 2 - rnd()*(1 + n*0.5), 3.4, rnd()*TAU, Math.floor(rnd()*LEAFC.length), rnd()<.5?1:0, 1, 1, 1, 0);
    for (let i=0;i<m;i++) nugget(c, bx0 + 3 + rnd()*(iw - 2), by0 - 2 - rnd()*(1 + m*0.7), 2.6, rnd()*TAU);
    const wq = Math.min(r.wetI || 0, q);
    for (let i=0;i<q;i++) drawIngot(c, bx0 + BW/2 + (i%2 ? 2 : -1), by0 + 1 - i*2.4, 8, 0, undefined, i >= q - wq);
  }
  drawBasket(c, bt, bx0, by0, BW, BH, true);
  if (st.lantern){
    // a hooked pole on its back with a little lantern swinging from it
    const sw = Math.sin(r.anim*(r.moving ? 7 : 1.6) + r.id)*(r.moving ? 0.35 : 0.12);
    const px = bx0 - 1, py = top - 16;
    c.strokeStyle = '#4a423b'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(bx0 + 3, top + 4); c.lineTo(px, py); c.quadraticCurveTo(px - 5, py - 2, px - 6, py + 2); c.stroke();
    c.save(); c.translate(px - 6, py + 2); c.rotate(sw);
    c.strokeStyle = '#4a423b'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 3); c.stroke();
    const fl = 0.75 + 0.25*Math.sin(r.anim*9 + r.id);
    c.fillStyle = 'rgba(255,190,90,' + (0.28*fl) + ')'; ell(c, 0, 8, 8, 8); c.fill();
    c.fillStyle = '#3d3734'; rr(c, -3, 3, 6, 1.6, 0.6); c.fill(); rr(c, -3, 11, 6, 1.6, 0.6); c.fill();
    c.fillStyle = 'rgba(255,214,120,' + (0.7 + 0.3*fl) + ')'; rr(c, -2.4, 4.4, 4.8, 6.8, 1.2); c.fill();
    c.fillStyle = '#fff2c0'; ell(c, 0, 8, 1.1, 1.8); c.fill();
    c.strokeStyle = '#3d3734'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(0, 4.4); c.lineTo(0, 11.2); c.stroke();
    c.restore();
  }
  // arm (stretches out to the leaf when grabbing)
  const sx = bw/2 - 2, sy = top + bh*0.5, armC = md ? '#7f8b92' : '#4a423b';
  c.strokeStyle = armC; c.lineWidth = 2.4; c.lineCap = 'round';
  if (r.st === 'pick' && r.armTo){
    const k = 1 - clamp(r.timer/r.pickDur, 0, 1), ext = k < 0.55 ? Math.sin(k/0.55*Math.PI/2) : Math.cos((k - 0.55)/0.45*Math.PI/2);
    const lx = (r.armTo.x - r.x)*r.face, ly = r.armTo.y - r.y - bob;
    const hx = sx + (lx - sx)*ext, hy = sy + (ly - sy)*ext;
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(hx, hy); c.stroke();
    if (r.fingers){
      // multi-grab: the hand goes to the middle of the patch and a finger stretches out to each leaf
      const fe = clamp((ext - 0.35)/0.65, 0, 1);
      c.fillStyle = armC; ell(c, hx, hy, 2.6, 2.6); c.fill();
      c.lineWidth = 1.5;
      for (const f of r.fingers){
        const fx = (f.x - r.x)*r.face, fy = f.y - r.y - bob;
        const tx = hx + (fx - hx)*fe, ty = hy + (fy - hy)*fe, mx = (hx + tx)/2, my = (hy + ty)/2 - 3*fe;
        c.strokeStyle = armC; c.beginPath(); c.moveTo(hx, hy); c.quadraticCurveTo(mx, my, tx, ty); c.stroke();
        const a = Math.atan2(ty - my, tx - mx);
        c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx + Math.cos(a + 2.4)*2.6, ty + Math.sin(a + 2.4)*2.6); c.moveTo(tx, ty); c.lineTo(tx + Math.cos(a - 2.4)*2.6, ty + Math.sin(a - 2.4)*2.6); c.stroke();
      }
    } else {
      c.lineWidth = 1.6; c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + 3, hy + 3); c.moveTo(hx, hy); c.lineTo(hx - 2, hy + 4); if (rv(r.id, 'grab') > 1){ c.moveTo(hx, hy); c.lineTo(hx + 4, hy); c.moveTo(hx, hy); c.lineTo(hx + 1, hy + 4.5); } c.stroke();
    }
  } else if (r.st === 'bag' || r.st === 'jar' || r.st === 'wrap' || r.st === 'smelt'){
    // working at a bench or a furnace door: the arm reaches forward and works in quick strokes
    const sp2 = r.st === 'smelt' ? 7 : 11, a = -0.25 + Math.sin(r.hammer*sp2)*0.35, L = r.st === 'smelt' ? 13 : 11;
    c.save(); c.translate(sx, sy); c.rotate(a); c.beginPath(); c.moveTo(0, 0); c.lineTo(L, 0); c.stroke();
    if (r.st === 'smelt'){ c.strokeStyle = '#6b7276'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(L, 0); c.lineTo(L + 7, 2); c.moveTo(L, 0); c.lineTo(L + 7, -2); c.stroke(); }
    else { c.lineWidth = 1.4; c.beginPath(); c.moveTo(L, 0); c.lineTo(L + 3, 2.5); c.moveTo(L, 0); c.lineTo(L + 3, -2); c.stroke(); }
    c.restore();
    // V11: the jar it's filling or wrapping stands on the crate's edge in front of it
    if (r.st === 'wrap') drawGiftJar(c, sx + 14, sy + 4, 6, clamp(r.workP, 0, 1));
    else if (r.st === 'jar') drawJar(c, sx + 14, sy + 4, 6);
  } else if (r.st === 'mine'){
    // RAINY HOLLOW: sawing: the arm pushes a bow saw back and forth through the log
    const k = Math.sin(r.hammer*13), hx = sx + 9 + k*4, hy = sy + 6;
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(hx, hy); c.stroke();
    c.save(); c.translate(hx, hy);
    c.strokeStyle = '#7a5236'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(7, -8, 15, 0); c.stroke();
    c.fillStyle = '#b9c2c6'; c.fillRect(0, -0.5, 15, 1.4);
    c.fillStyle = '#6c7378'; for (let q=1;q<15;q+=2){ c.beginPath(); c.moveTo(q, 0.9); c.lineTo(q + 0.8, 2); c.lineTo(q + 1.6, 0.9); c.fill(); }
    c.restore();
  }
  else { c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + 3.5, sy + 7); c.stroke(); }
  // head
  const hx0 = bw/2 - hw + 3, hy0 = top - 3 - hh;
  c.fillStyle = md ? '#8d999f' : '#4a423b'; c.fillRect(hx0 + hw*0.25, top - 4, 6, 5);
  if (md){ c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(hx0 + hw*0.25 + 1, top - 4, 1.2, 5); }
  const hg = c.createLinearGradient(0, hy0, 0, hy0 + hh); hg.addColorStop(0, st.head); hg.addColorStop(1, st.head2);
  c.fillStyle = hg;
  if (st.round){ c.beginPath(); c.ellipse(hx0 + hw/2, hy0 + hh, hw/2, hh, 0, Math.PI, 0); c.closePath(); c.fill(); }
  else if (md){
    rr(c, hx0, hy0, hw, hh, 6.5); c.fill();
    // glossy highlight on the dome of the head, and a crisp seam line
    c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.ellipse(hx0 + hw*0.32, hy0 + 3, hw*0.22, 1.5, -0.1, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(90,105,115,.35)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(hx0 + 1.5, hy0 + hh - 3); c.lineTo(hx0 + hw - 1.5, hy0 + hh - 3); c.stroke();
  }
  else { rr(c, hx0, hy0, hw, hh, st.slim ? 6 : 5); c.fill(); }
  if (st.dust){ c.fillStyle = 'rgba(120,96,64,.35)'; for (const [px, py] of [[2,3],[5,9],[11,2],[3,10]]){ ell(c, hx0 + px, hy0 + py, .8, .7); c.fill(); } }
  if (st.copper){ c.fillStyle = 'rgba(95,156,138,.65)'; for (const [px, py, pr] of [[2.5, hh - 2.5, 1.8], [hw - 3, 2.5, 1.3], [hw*0.4, hh - 1.6, 1.2], [1.6, 3, 1]]){ ell(c, hx0 + px, hy0 + py, pr, pr*0.7); c.fill(); } c.strokeStyle = 'rgba(255,225,190,.45)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(hx0 + 2, hy0 + 1.5); c.lineTo(hx0 + hw - 4, hy0 + 1.5); c.stroke(); }
  if (sooty){ c.fillStyle = 'rgba(28,24,22,.55)'; ell(c, hx0 + hw*0.78, hy0 + hh - 2, 3.4, 1.8); c.fill(); ell(c, hx0 + hw*0.45, hy0 + hh - 1.2, 2.2, 1.1); c.fill(); ell(c, hx0 + hw - 2, hy0 + 3, 1.4, 1.1); c.fill(); }
  if (st.kettle){
    // the steam whistle: a little brass spout on top of its head that puffs now and then
    const kx = hx0 + hw*0.72, ky = hy0;
    c.fillStyle = '#b8902f'; rr(c, kx - 1.6, ky - 5, 3.2, 5, 0.8); c.fill(); c.fillStyle = '#d9b75a'; rr(c, kx - 2.4, ky - 6.2, 4.8, 1.8, 0.8); c.fill();
    if (!simMode && Math.random() < 0.025){ const wx = r.x + r.face*kx; parts.push({ k:'dust', x: wx, y: r.y + ky - 7, vx: rand(-4, 4), vy: rand(-26, -16), g:0, life: rand(.7, 1.1), t:0, r: rand(1.5, 2.6), gray:true }); }
  }
  if (st.rust > 0.5){ c.fillStyle = 'rgba(152,82,40,.65)'; ell(c, hx0 + 3, hy0 + hh - 3, 1.6, 1.2); c.fill(); }
  const ex = hx0 + hw*0.68, ey = hy0 + hh*0.55;
  c.fillStyle = '#2a2420'; ell(c, ex, ey, 4.4, 4.4); c.fill();
  const bl = r.blink > 0 ? 0.15 : 1;
  c.fillStyle = 'rgba(255,196,87,.28)'; ell(c, ex + .6, ey, 6.5, 6.5*bl); c.fill();
  c.fillStyle = r.full ? '#ff9a6b' : st.ember ? '#ff8a3a' : '#ffc457'; ell(c, ex + .6, ey, 2.6, 2.6*bl); c.fill();
  c.fillStyle = 'rgba(255,255,255,.7)'; ell(c, ex + 1.6, ey - 1.1, .8, .8*bl); c.fill();
  if (st.patches){ c.strokeStyle = '#4c4840'; c.lineWidth = 1; c.beginPath(); c.moveTo(ex - 5, ey - 5.5); c.lineTo(ex + 5, ey - 4.5); c.stroke(); }
  if (md){
    // the monocle: a gold rim round the eye, a glint on the glass, and a fine chain down to the chest
    const mr = 5.6;
    c.strokeStyle = '#8a6a26'; c.lineWidth = 2.2; ell(c, ex + .3, ey, mr, mr); c.stroke();
    c.strokeStyle = '#f2d27a'; c.lineWidth = 1.2; ell(c, ex + .3, ey, mr, mr); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 0.8; c.beginPath(); c.arc(ex + .3, ey, mr - 1.6, -2.6, -1.7); c.stroke();
    const cx0 = ex - 1.5, cy0 = ey + mr, cx1 = hx0 + hw*0.3, cy1 = top + bh*0.34, sw = Math.sin(r.anim*(r.moving ? 9 : 1.5))*1.2;
    c.strokeStyle = '#d9b75a'; c.lineWidth = 0.7; c.setLineDash([1, 0.9]);
    c.beginPath(); c.moveTo(cx0, cy0); c.quadraticCurveTo((cx0 + cx1)/2 + sw - 2, Math.max(cy0, cy1) + 4, cx1, cy1); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#f2d27a'; ell(c, cx1, cy1, 0.9, 0.9); c.fill();
  }
  if (st.hazard){
    // a yellow hard hat with a brim
    c.fillStyle = '#f2c230'; c.beginPath(); c.ellipse(hx0 + hw/2, hy0 + 1, hw/2 + 1, hh*0.62, 0, Math.PI, 0); c.closePath(); c.fill();
    c.fillStyle = '#d9a41f'; rr(c, hx0 - 2, hy0, hw + 4, 2.2, 1); c.fill();
    c.fillStyle = 'rgba(255,250,220,.55)'; ell(c, hx0 + hw*0.35, hy0 - hh*0.32, 2.2, 1); c.fill();
  }
  if (st.sprout){
    // a little seedling growing out of the top of its head
    const sw2 = Math.sin(r.anim*2 + r.id)*0.15;
    c.save(); c.translate(hx0 + hw*0.7, hy0); c.rotate(sw2);
    c.strokeStyle = '#5d7a2c'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(1, -4, 0, -7); c.stroke();
    c.fillStyle = '#7fa23a'; c.save(); c.translate(0, -7); c.rotate(-0.7); ell(c, -2.4, 0, 2.6, 1.2); c.fill(); c.restore();
    c.fillStyle = '#93b84a'; c.save(); c.translate(0, -6); c.rotate(0.6); ell(c, 2.2, 0, 2.3, 1.1); c.fill(); c.restore();
    c.restore();
  }
  // antenna
  const ax = hx0 + 5, ay = st.round ? hy0 + 2 : hy0, ah = st.slim ? 11 : 8;
  if (st.hazard){ /* the hard hat has no antenna */ }
  else if (md){
    // a short, straight chrome mast with a polished ball that glows a cool white now and then
    c.strokeStyle = '#9aa6ac'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax - 3, ay - 9); c.stroke();
    const on = Math.sin(r.anim*2.2 + 1) > 0.5, bg = c.createRadialGradient(ax - 3.6, ay - 10.4, 0.2, ax - 3, ay - 9.8, 2.2);
    bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.6, on ? '#bdf2ff' : '#c8d2d7'); bg.addColorStop(1, on ? '#6cc7e0' : '#7d8a91');
    c.fillStyle = bg; ell(c, ax - 3, ay - 9.8, 2.2, 2.2); c.fill();
    if (on){ c.fillStyle = 'rgba(170,235,255,.3)'; ell(c, ax - 3, ay - 9.8, 4.6, 4.6); c.fill(); }
    // now and then a little sparkle runs across the polish
    const tw2 = (r.anim*0.55 + r.id*0.37) % 1;
    if (tw2 < 0.12){
      const k = Math.sin(tw2/0.12*Math.PI), pts = [[-bw*0.28, top + bh*0.22], [hx0 + hw*0.25, hy0 + 2.5], [bw*0.2, top + bh*0.7]], [px, py] = pts[Math.floor(r.anim*0.55 + r.id) % 3];
      c.fillStyle = 'rgba(255,255,255,' + (0.95*k) + ')'; const z = 3.4*k;
      c.beginPath(); c.moveTo(px, py - z); c.lineTo(px + z*0.22, py - z*0.22); c.lineTo(px + z, py); c.lineTo(px + z*0.22, py + z*0.22); c.lineTo(px, py + z); c.lineTo(px - z*0.22, py + z*0.22); c.lineTo(px - z, py); c.lineTo(px - z*0.22, py - z*0.22); c.closePath(); c.fill();
    }
  } else {
    c.strokeStyle = st.copper ? '#a8653a' : '#4a423b'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(ax - 2, ay - 5, ax - 5, ay - ah); c.stroke();
    if (st.copper){ c.strokeStyle = '#d8925f'; c.lineWidth = 0.8; for (let k=1;k<4;k++){ const yy = ay - k*2; c.beginPath(); c.moveTo(ax - 2.2 - k*0.6, yy); c.lineTo(ax + 0.8 - k*0.6, yy - 0.8); c.stroke(); } }
    const on = Math.sin(r.anim*3 + r.id) > 0.6;
    c.fillStyle = on ? '#ff7a4d' : '#8a4a36'; ell(c, ax - 5, ay - ah - .5, 2.1, 2.1); c.fill();
    if (on){ c.fillStyle = 'rgba(255,122,77,.3)'; ell(c, ax - 5, ay - ah - .5, 4.5, 4.5); c.fill(); }
  }
  // RAINY HOLLOW: some robots wear a tiny umbrella on their head
  if (st.brolly){
    const tilt = (r.moving ? -0.22 : -0.06) + Math.sin(r.anim*(r.moving ? 9 : 1.3) + r.id)*0.04;
    c.save(); c.translate(hx0 + hw*0.45, hy0 + 1); c.rotate(tilt);
    c.strokeStyle = '#3d3734'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -16); c.stroke();
    if (st.brolly === 'leaf'){
      // Moss holds up a big autumn leaf instead
      c.save(); c.translate(0, -16); c.scale(12, 5.5); leafPath(c, 1); c.fillStyle = '#c24a22'; c.fill(); c.lineWidth = 0.06; c.strokeStyle = '#7a2a12'; c.beginPath(); c.moveTo(0, 0.5); c.lineTo(0, -0.9); c.stroke(); c.restore();
    } else {
      const cols = st.brolly === 'patch' ? ['#b8452d', '#5f8f88'] : [st.brolly, shade(st.brolly, 0.78)];
      drawBrolly(c, 0, -10, 11, cols, '#3d3734');
      c.fillStyle = '#3d3734'; ell(c, 0, -17.2, 0.9, 0.9); c.fill();
    }
    c.restore();
    if (!simMode && ctx === mainCtx && Math.random() < 0.05*RAIN.k) parts.push({ k:'drop', x: r.x + r.face*(hx0 + hw*0.45) + rand(-10, 10), y: r.y + hy0 - 14 + bob, vx: rand(-25, 25), vy: rand(-40, -15), g: 260, life: rand(.25, .4), t: 0 });
  }
  c.restore();
  if (r.st === 'mine' || r.st === 'bag' || r.st === 'jar' || r.st === 'wrap' || r.st === 'smelt'){
    const pr = r.st === 'mine' ? r.mineP : r.workP, col = r.st === 'mine' ? '#f2d27a' : r.st === 'smelt' ? '#ff9b3d' : r.st === 'jar' ? '#ffd23f' : r.st === 'wrap' ? '#e0475a' : '#ffb866';
    c.save(); c.translate(r.x, r.y + top - hh - 22); c.lineWidth = 3; c.lineCap = 'round';
    c.strokeStyle = 'rgba(40,25,10,.35)'; c.beginPath(); c.arc(0, 0, 6, 0, TAU); c.stroke();
    c.strokeStyle = col; c.beginPath(); c.arc(0, 0, 6, -Math.PI/2, -Math.PI/2 + TAU*clamp(pr, 0, 1)); c.stroke();
    c.restore();
  }
  if (r.full) bubbles.push({ x: r.x, y: r.y + top - hh - 18, t: r.carryI && r.st === 'waitI' ? 'woodshed full' : r.carryM && !r.carryL ? (r.at === 'metal' && metalTarget(r).hopper ? 'stack full' : 'crib full') : 'bin full' });
}

// ── blower: a yard robot built like a low robot vacuum, with a hose for a trunk and two hinged flaps on its head.
// Same parts as the other robots (treads, painted body, band, amber eye, antenna); the elephant is only a hint.
function blowerGeo(h){
  const st = helperStyle(h), bw = st.bw, bh = st.bh, top = -9 - bh, hw = st.hw, hh = st.hh;
  const hx0 = bw/2 - hw + 1, hy0 = top - 2 - hh;
  const root = { x: hx0 + hw - 1, y: hy0 + hh*0.72 };
  let tip, ctl;
  if (h.st === 'stoke'){
    const wob = Math.sin(h.anim*9)*0.6;
    tip = { x: (PLANT_VENT.x - h.x)*h.face + wob, y: PLANT_VENT.y - h.y };
    ctl = { x: root.x + (tip.x - root.x)*0.7, y: root.y - 4 };
  } else if (h.st === 'dig' && h.dig != null){
    // the hose reaches down into the shaft
    const hole = SHAFT_HOLE(h.dig), wob = Math.sin(h.anim*9)*0.8;
    tip = { x: (hole.x - h.x)*h.face + wob, y: hole.y - h.y + 2 };
    ctl = { x: root.x + (tip.x - root.x)*0.75, y: root.y - 6 };
  } else if (h.st === 'brolly'){
    // RAINY HOLLOW: the hose curls up and holds the handle of the wood umbrella
    tip = { x: root.x + 6, y: hy0 - 9 };
    ctl = { x: root.x + 10, y: root.y - 1 };
  } else if (h.st === 'lap'){
    const L = 15*st.trunk + 8, dx = Math.abs(h.dir.x), dy = h.dir.y;
    tip = { x: root.x + 6 + dx*L, y: Math.min(0, -6 + dy*L*0.6) };
    ctl = { x: root.x + 4 + (tip.x - root.x)*0.4, y: root.y + 2 };
  } else {
    const sw = Math.sin(h.anim*2.2 + h.idx)*1.2;
    tip = { x: root.x + 5 + 4*st.trunk + sw, y: -4 };
    ctl = { x: root.x + 8*st.trunk, y: root.y + 1 };
  }
  return { st, bw, bh, top, hw, hh, hx0, hy0, root, tip, ctl };
}
function trunkTip(h){ const g = blowerGeo(h); return { x: h.x + g.tip.x*h.face, y: h.y + g.tip.y }; }
function drawTreads(c, tw, th, moving, anim, tier, roll){ drawWheels(c, tw, th, moving, anim, tier || 0, roll || 0, {}); }
function robotEye(c, ex, ey, r, blink, warm){
  const bl = blink > 0 ? 0.15 : 1;
  c.fillStyle = '#2a2420'; ell(c, ex, ey, r, r); c.fill();
  c.fillStyle = 'rgba(255,196,87,.28)'; ell(c, ex + .5, ey, r*1.5, r*1.5*bl); c.fill();
  c.fillStyle = warm ? '#ff9a6b' : '#ffc457'; ell(c, ex + .5, ey, r*0.6, r*0.6*bl); c.fill();
  c.fillStyle = 'rgba(255,255,255,.7)'; ell(c, ex + r*0.35, ey - r*0.25, r*0.18, r*0.18*bl); c.fill();
}
function drawBlower(h){
  const c = ctx, G = blowerGeo(h), st = G.st, blowing = h.st === 'lap' || h.st === 'dig' || h.st === 'stoke';
  const bw = G.bw, bh = G.bh, top = G.top, hw = G.hw, hh = G.hh, hx0 = G.hx0, hy0 = G.hy0;
  c.save(); c.translate(h.x, h.y);
  c.fillStyle = 'rgba(35,28,12,.3)'; ell(c, 0, 1, st.tw*0.6, 4.5); c.fill();
  c.scale(h.face, 1);
  drawTreads(c, st.tw, 9, h.moving, h.anim, tierOf(helperCfg(h).lv.speed), (h.x + h.y*0.4)*h.face);
  const bob = h.moving ? -Math.abs(Math.sin(h.anim*10))*1.2 : Math.sin(h.anim*2 + h.idx)*0.3;
  c.translate(blowing ? Math.sin(h.anim*45)*0.35 : 0, bob);
  // body: a low, wide, rounded box (the robot-vacuum part) with a fan grille on top
  const g = c.createLinearGradient(0, top, 0, -8); g.addColorStop(0, st.body); g.addColorStop(1, st.body2);
  c.fillStyle = g; rr(c, -bw/2, top, bw, bh, 7); c.fill();
  c.fillStyle = st.band; c.fillRect(-bw/2 + 1, top + bh*0.55, bw - 2, 3.5);
  c.fillStyle = shade(st.body2, 0.8); for (const [px, py] of [[-bw/2 + 4, top + bh*0.3], [bw/2 - 4, top + bh*0.3], [-bw/2 + 4, -11]]){ ell(c, px, py, .9, .9); c.fill(); }
  c.fillStyle = shade(st.body2, 0.85); ell(c, -bw*0.12, top + 0.5, bw*0.3, 3); c.fill();
  c.strokeStyle = shade(st.body2, 0.6); c.lineWidth = 0.8;
  for (let k=-2;k<=2;k++){ c.beginPath(); c.moveTo(-bw*0.12 + k*bw*0.1 - 1, top - 1.5); c.lineTo(-bw*0.12 + k*bw*0.1 + 1, top + 2.5); c.stroke(); }
  if (st.rust){ c.fillStyle = 'rgba(152,82,40,' + (0.8*st.rust) + ')'; ell(c, -bw*0.3, top + bh*0.85, 3, 1.8); c.fill(); ell(c, bw*0.28, top + bh*0.25, 1.8, 1.2); c.fill(); }
  if (st.patches){ c.fillStyle = '#9aa3a6'; c.fillRect(-bw/2 + 3, top + 2.5, 8, 5); c.fillStyle = '#4c4840'; for (const [px, py] of [[-bw/2 + 4, top + 3.5], [-bw/2 + 10, top + 3.5], [-bw/2 + 4, top + 6.5], [-bw/2 + 10, top + 6.5]]){ ell(c, px, py, .7, .7); c.fill(); } }
  if (st.light){ const on = Math.sin(h.anim*3 + 1) > 0.2; c.fillStyle = '#4a423b'; c.fillRect(-bw/2 + 5, top - 4, 2, 4); c.fillStyle = on ? '#ffb347' : '#8a5a36'; ell(c, -bw/2 + 6, top - 5, 2.4, 2); c.fill(); if (on){ c.fillStyle = 'rgba(255,179,71,.3)'; ell(c, -bw/2 + 6, top - 5, 4.8, 4); c.fill(); } }
  // neck and head (same build as the yard robots), with hinged side flaps that flutter while it blows
  c.fillStyle = '#4a423b'; c.fillRect(hx0 + hw*0.3, top - 3, 6, 4);
  const flap = blowing ? -0.35 + Math.sin(h.anim*26)*0.12 : h.moving ? -0.1 + Math.sin(h.anim*8)*0.1 : Math.sin(h.anim*1.6 + h.idx)*0.05;
  c.save(); c.translate(hx0 + 2, hy0 + 2); c.rotate(-flap*0.5 - 0.15); c.fillStyle = shade(st.head2, 0.8); rr(c, -7*st.flap, -1, 7*st.flap, 10*st.flap, 2.5); c.fill(); c.restore();
  const hg = c.createLinearGradient(0, hy0, 0, hy0 + hh); hg.addColorStop(0, st.head); hg.addColorStop(1, st.head2);
  c.fillStyle = hg; rr(c, hx0, hy0, hw, hh, 5); c.fill();
  c.save(); c.translate(hx0 + 3, hy0 + 2.5); c.rotate(flap);
  c.fillStyle = st.head2; rr(c, -8*st.flap, -1.5, 8.5*st.flap, 11*st.flap, 3); c.fill();
  c.strokeStyle = shade(st.head2, 0.7); c.lineWidth = 0.8; rr(c, -8*st.flap, -1.5, 8.5*st.flap, 11*st.flap, 3); c.stroke();
  c.fillStyle = st.band; c.fillRect(-7*st.flap, 2, 6.5*st.flap, 1.6);
  c.fillStyle = shade(st.head2, 0.6); ell(c, -0.5, 0.5, .9, .9); c.fill(); ell(c, -0.5, 7*st.flap, .9, .9); c.fill();
  c.restore();
  robotEye(c, hx0 + hw*0.62, hy0 + hh*0.45, 3.8, h.blink, false);
  // antenna
  const ax = hx0 + 6, ay = hy0;
  c.strokeStyle = '#4a423b'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(ax - 2, ay - 4, ax - 4, ay - 8); c.stroke();
  const on = Math.sin(h.anim*3 + h.idx*2) > 0.6; c.fillStyle = on ? '#ff7a4d' : '#8a4a36'; ell(c, ax - 4, ay - 8.5, 2, 2); c.fill();
  if (st.prop){
    // a little propeller on a post, spinning hard while it blows
    const px = hx0 + hw - 5, py = hy0 - 6, a = h.anim*(blowing ? 40 : h.moving ? 10 : 2), k = Math.cos(a);
    c.strokeStyle = '#4a423b'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(px, hy0); c.lineTo(px, py); c.stroke();
    c.fillStyle = st.band; c.beginPath(); c.ellipse(px - 3.6*k, py, 3.6*Math.abs(k) + 0.3, 1.1, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(px + 3.6*k, py, 3.6*Math.abs(k) + 0.3, 1.1, 0, 0, TAU); c.fill();
    c.fillStyle = '#d9b75a'; ell(c, px, py, 1, 1); c.fill();
  }
  // the hose: a ribbed flexible pipe from the face, ending in a flared metal nozzle
  const R0 = G.root, T = G.tip, C = G.ctl;
  c.lineCap = 'round';
  c.strokeStyle = '#3b3430'; c.lineWidth = 5.4; c.beginPath(); c.moveTo(R0.x, R0.y); c.quadraticCurveTo(C.x, C.y, T.x, T.y); c.stroke();
  c.strokeStyle = '#5a524b'; c.lineWidth = 3.4; c.beginPath(); c.moveTo(R0.x, R0.y); c.quadraticCurveTo(C.x, C.y, T.x, T.y); c.stroke();
  c.strokeStyle = st.stripes ? '#f3ead8' : '#7a7069'; c.lineWidth = st.stripes ? 2.2 : 1;
  for (let q=0.12; q<0.9; q+=0.13){
    const u = 1 - q, px = u*u*R0.x + 2*u*q*C.x + q*q*T.x, py = u*u*R0.y + 2*u*q*C.y + q*q*T.y;
    const tx = 2*u*(C.x - R0.x) + 2*q*(T.x - C.x), ty = 2*u*(C.y - R0.y) + 2*q*(T.y - C.y), tl = Math.hypot(tx, ty) || 1;
    c.beginPath(); c.moveTo(px - ty/tl*2.4, py + tx/tl*2.4); c.lineTo(px + ty/tl*2.4, py - tx/tl*2.4); c.stroke();
  }
  { const dx = T.x - C.x, dy = T.y - C.y, dl = Math.hypot(dx, dy) || 1, ux = dx/dl, uy = dy/dl, fl = blowing ? 4.4 : 3.4;
    const mg = c.createLinearGradient(T.x - uy*fl, T.y + ux*fl, T.x + uy*fl, T.y - ux*fl); mg.addColorStop(0, '#6c7378'); mg.addColorStop(0.5, '#b4bbbf'); mg.addColorStop(1, '#6c7378');
    c.fillStyle = mg; c.beginPath();
    c.moveTo(T.x - ux*2 - uy*2.3, T.y - uy*2 + ux*2.3); c.lineTo(T.x + ux*4 - uy*fl, T.y + uy*4 + ux*fl);
    c.lineTo(T.x + ux*4 + uy*fl, T.y + uy*4 - ux*fl); c.lineTo(T.x - ux*2 + uy*2.3, T.y - uy*2 - ux*2.3); c.closePath(); c.fill();
    c.fillStyle = st.band; c.fillRect(T.x - ux*2 - 1.2, T.y - uy*2 - 1.2, 2.4, 2.4);
    c.fillStyle = '#2a2420'; c.beginPath(); c.ellipse(T.x + ux*4, T.y + uy*4, fl*0.8, 1.2, Math.atan2(uy, ux) + Math.PI/2, 0, TAU); c.fill(); }
  if (h.st === 'brolly') drawWoodUmbrella(c, T.x, T.y, st.band, h);
  c.restore();
}
// RAINY HOLLOW: the wood umbrella a blower carries over a hauler: a tall wooden pole with a curved handle, wooden ribs
// and a big canopy in the blower's colour, wide enough to cover the robot walking beside it
// an umbrella canopy seen from the side and a little above: a dome with a scalloped hem, striped panels and ribs.
// (cx, rim) is the middle of the hem, R its half-width. cols: panel colours (alternating), rib: rib colour
function drawBrolly(c, cx, rim, R, cols, rib){
  const H0 = R*0.62, apex = rim - H0, N = 6, xs = [];
  for (let k=0;k<=N;k++) xs.push(cx - R + 2*R*k/N);
  const hemY = k => rim + Math.sin(k/N*Math.PI)*R*0.16;          // the hem bows toward us in the middle
  const dome = () => { c.beginPath(); c.moveTo(xs[0], hemY(0)); c.bezierCurveTo(cx - R, apex - H0*0.05, cx - R*0.45, apex, cx, apex); c.bezierCurveTo(cx + R*0.45, apex, cx + R, apex - H0*0.05, xs[N], hemY(N));
    for (let k=N;k>0;k--){ const mx = (xs[k] + xs[k - 1])/2, my = (hemY(k) + hemY(k - 1))/2 - R*0.07; c.quadraticCurveTo(mx, my, xs[k - 1], hemY(k - 1)); } c.closePath(); };
  // the shadowed underside peeking out below the hem
  c.fillStyle = 'rgba(20,14,10,.35)'; c.beginPath(); c.ellipse(cx, rim + R*0.08, R*0.96, R*0.2, 0, 0, Math.PI); c.fill();
  dome(); c.fillStyle = cols[0]; c.fill();
  c.save(); dome(); c.clip();
  const ribPath = k => { c.moveTo(cx, apex); c.quadraticCurveTo(cx + (xs[k] - cx)*0.85, apex + H0*0.25, xs[k], hemY(k)); };
  for (let k=0;k<N;k++){ if (k % 2) continue; c.beginPath(); c.moveTo(cx, apex); c.quadraticCurveTo(cx + (xs[k] - cx)*0.85, apex + H0*0.25, xs[k], hemY(k)); c.lineTo(xs[k + 1], hemY(k + 1)); c.quadraticCurveTo(cx + (xs[k + 1] - cx)*0.85, apex + H0*0.25, cx, apex); c.closePath(); c.fillStyle = cols[1] || shade(cols[0], 0.8); c.fill(); }
  const sh = c.createLinearGradient(cx - R, apex, cx + R*0.4, rim); sh.addColorStop(0, 'rgba(255,255,255,.28)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(10,10,20,.22)');
  c.fillStyle = sh; c.fillRect(cx - R, apex - 2, 2*R, H0 + R*0.3);
  c.strokeStyle = rib; c.lineWidth = Math.max(0.4, R*0.035); c.beginPath(); for (let k=1;k<N;k++) ribPath(k); c.stroke();
  c.restore();
  c.fillStyle = rib; for (let k=0;k<=N;k++){ ell(c, xs[k], hemY(k), Math.max(0.5, R*0.04), Math.max(0.5, R*0.04)); c.fill(); }
  return { apex, xs, hemY };
}
// RAINY HOLLOW: the wood umbrella a blower carries over a hauler: a wooden pole with a curved handle, wooden ribs
// and a big canopy in the blower's colour, wide enough to cover the robot walking beside it
function drawWoodUmbrella(c, hx, hy, col, h){
  const sway = Math.sin(h.anim*(h.moving ? 8 : 1.4) + h.idx)*0.03 + (h.moving ? 0.05 : 0);
  c.save(); c.translate(hx, hy); c.rotate(sway);
  const rim = -38, cx = 9, R1 = 30;
  c.strokeStyle = '#6e4a30'; c.lineWidth = 2; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-3, 5); c.quadraticCurveTo(-5, 1, -2, -1); c.lineTo(cx, rim - R1*0.6); c.stroke();
  c.strokeStyle = '#a07a52'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-1.6, -1.6); c.lineTo(cx + 0.6, rim - R1*0.6); c.stroke();
  const U = drawBrolly(c, cx, rim, R1, [col, shade(col, 0.74)], '#7a5236');
  c.fillStyle = '#5a3b26'; rr(c, cx - 1.2, U.apex - 5, 2.4, 5.5, 1); c.fill();
  // drips off the rib ends
  const t = RAIN.t; c.fillStyle = 'rgba(205,222,236,.85)';
  U.xs.forEach((x, k) => { const ph = (t*1.3 + k*0.31) % 1; ell(c, x, U.hemY(k) + 1.5 + ph*10, 0.7, 1); c.fill(); });
  c.restore();
  if (!simMode && ctx === mainCtx && Math.random() < 0.12*RAIN.k) parts.push({ k:'drop', x: h.x + h.face*(hx + cx + rand(-R1*0.7, R1*0.7)), y: h.y + hy + rim - R1*0.5, vx: rand(-30, 30), vy: rand(-45, -20), g: 260, life: rand(.25, .45), t: 0 });
}

// ── shaker: a squat yard robot seen from the front, on two treads, with eye lenses on stalks and two oversized
// metal grabber claws. Still a robot; the crab is only a hint.
function crabClaw(c, x, y, side, cs, open, ang, st){
  if (st.saw){ c.save(); c.translate(x, y); c.scale(side, 1); c.rotate(ang); c.scale(cs, cs); c.fillStyle = '#4a5054'; for (let k=0;k<4;k++){ c.beginPath(); c.moveTo(4 + k*2, -3.4 - open*1.2*k/4); c.lineTo(5 + k*2, -5.2 - open*1.2*k/4); c.lineTo(6 + k*2, -3.6 - open*1.2*k/4); c.closePath(); c.fill(); } c.restore(); }
  c.save(); c.translate(x, y); c.scale(side, 1); c.rotate(ang); c.scale(cs, cs);
  const g = c.createLinearGradient(0, -6, 0, 6); g.addColorStop(0, '#b9c0c4'); g.addColorStop(1, '#646c71');
  // lower jaw (the moving one), then the claw body and the fixed upper jaw
  c.fillStyle = '#5c6469';
  c.beginPath(); c.moveTo(3, 1.5); c.lineTo(11, 2.5 + open*6); c.lineTo(11.5, 4.5 + open*6); c.lineTo(2, 5); c.closePath(); c.fill();
  c.fillStyle = g; rr(c, -5.5, -4.5, 10, 9, 3); c.fill();
  c.beginPath(); c.moveTo(3, -4.5); c.lineTo(10.5, -3.2 - open*1.2); c.lineTo(12.5, -0.2 - open*1.2); c.lineTo(3, 1.5); c.closePath(); c.fill();
  c.fillStyle = st.band; c.fillRect(-5.5, -1, 8.5, 2);
  c.fillStyle = '#3d4245'; ell(c, 2, 0.8, 1.2, 1.2); c.fill();
  c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-4, -3.6, 6, 1);
  c.restore();
}
function drawShaker(h){
  const c = ctx, st = helperStyle(h), bw = st.bw, bh = st.bh;
  const snipping = h.st === 'snip' && h.target, shaking = h.st === 'shake' && h.target, bush = shaking && h.target.type === 'bush';
  c.save(); c.translate(h.x, h.y);
  c.fillStyle = 'rgba(35,28,12,.3)'; ell(c, 0, 1, bw*0.85, 4.5); c.fill();
  const jig = shaking ? Math.sin(h.anim*38)*1.3 : 0, bob = h.moving ? -Math.abs(Math.sin(h.anim*14))*1 : Math.sin(h.anim*2 + h.idx)*0.3;
  // two treads seen end-on
  for (const s of [-1, 1]){
    const tx = s*bw*0.32;
    c.fillStyle = '#3b3430'; rr(c, tx - 5.5, -11, 11, 11, 4); c.fill();
    c.fillStyle = '#5a524b'; const off = h.moving ? (h.anim*24) % 4 : 0;
    for (let y=-10 + off; y<-1; y+=4) c.fillRect(tx - 4.5, y, 9, 1.5);
    const wt = tierOf(helperCfg(h).lv.speed);
    if (wt === 1){ c.fillStyle = '#1e1a18'; ell(c, tx, -5.5, 3.4, 3.4); c.fill(); c.fillStyle = '#d4672a'; ell(c, tx, -5.5, 2.1, 2.1); c.fill(); }
    else if (wt === 2){ c.fillStyle = '#b8902f'; ell(c, tx, -5.5, 3.8, 3.8); c.fill(); const hg = c.createRadialGradient(tx - 0.8, -6.3, 0.3, tx, -5.5, 3); hg.addColorStop(0, '#fff'); hg.addColorStop(0.6, '#c3cbd0'); hg.addColorStop(1, '#6f7b82'); c.fillStyle = hg; ell(c, tx, -5.5, 3, 3); c.fill(); }
  }
  const top = -9 - bh + bob;
  // arms first (behind the body): dark jointed robot arms out to the claws
  const t = h.anim, arms = [];
  for (const s of [-1, 1]){
    const cs = s < 0 ? st.cl : st.cr;
    let cx, cy, open, ang;
    if (snipping && s > 0){ const f = FLOWERS[h.target.i]; cx = (f.x - h.x)*0.92; cy = f.y - flowerHead(f) - h.y + 1; open = 0.15 + 0.35*Math.abs(Math.sin(t*16)); ang = -0.9; }
    else if (snipping){ cx = -(bw/2 + 6 + 3*cs); cy = top + bh*0.4; open = 0.2; ang = -0.4; }
    else if (shaking){ cx = s*(bush ? bw*0.42 + 4*cs : 6 + 2*cs) + jig; cy = top - (bush ? 4 : 13) - cs*3 + (s > 0 ? Math.sin(t*38) : -Math.sin(t*38))*0.9; open = 0.04; ang = bush ? -1.2 : -1.9; }
    else { cx = s*(bw/2 + 7 + 4*cs); cy = top + bh*0.35 - 2*cs + (h.moving ? Math.sin(t*11 + s)*1.4 : 0); open = h.moving ? 0.3 : 0.25 + 0.3*Math.max(0, Math.sin(t*2.6 + s*1.3 + h.idx))*(Math.sin(t*0.7 + h.idx) > 0.3 ? 1 : 0); ang = -0.35; }
    arms.push({ s, cs, cx, cy, open, ang });
    const sx = s*(bw/2 - 2) + jig, sy = top + bh*0.45, ex = (sx + cx)/2 + s*3, ey = Math.min(sy, cy) - 5;
    c.strokeStyle = '#4a423b'; c.lineWidth = 2.6; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.lineTo(cx, cy); c.stroke();
    c.fillStyle = '#26201d'; ell(c, ex, ey, 1.8, 1.8); c.fill();
  }
  c.save(); c.translate(jig, 0);
  // body: a wide box with a domed lid (the shell hint), band, rivets and a grille
  const g = c.createLinearGradient(0, top - 4, 0, -9); g.addColorStop(0, st.body); g.addColorStop(1, st.body2);
  c.fillStyle = g;
  c.beginPath(); c.moveTo(-bw/2, -9 + bob); c.lineTo(-bw/2, top + 5); c.quadraticCurveTo(-bw/2, top - 4, 0, top - 4); c.quadraticCurveTo(bw/2, top - 4, bw/2, top + 5); c.lineTo(bw/2, -9 + bob); c.closePath(); c.fill();
  c.fillStyle = st.band; c.fillRect(-bw/2, top + bh*0.42, bw, 3.5);
  c.fillStyle = shade(st.body2, 0.8); for (const px of [-bw/2 + 3, bw/2 - 3]){ ell(c, px, top + 4, .9, .9); c.fill(); ell(c, px, -12 + bob, .9, .9); c.fill(); }
  c.fillStyle = '#3d3734'; rr(c, -5, top + bh*0.66, 10, 4.5, 1.5); c.fill();
  c.fillStyle = '#6c625a'; for (let k=-3; k<=3; k+=2) c.fillRect(k - 0.4, top + bh*0.66 + 1, 0.8, 2.5);
  c.fillStyle = 'rgba(255,255,255,.18)'; ell(c, -bw*0.25, top - 1, bw*0.18, 1.8); c.fill();
  if (st.rust){ c.fillStyle = 'rgba(152,82,40,' + (0.8*st.rust) + ')'; ell(c, bw*0.3, top + bh*0.8, 2.6, 1.6); c.fill(); ell(c, -bw*0.32, top + 2, 1.6, 1.1); c.fill(); }
  if (st.patches){ c.fillStyle = '#9aa3a6'; c.fillRect(bw/2 - 10, top + 1, 7, 5); c.fillStyle = '#4c4840'; ell(c, bw/2 - 9, top + 2, .7, .7); c.fill(); ell(c, bw/2 - 4, top + 2, .7, .7); c.fill(); }
  // eye lenses on short metal stalks
  if (st.beacon){ c.strokeStyle = '#4a423b'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, top - 3); c.lineTo(0, top - 15); c.stroke(); const on = Math.sin(t*5 + h.idx) > 0; c.fillStyle = on ? '#ff7a4d' : '#8a4a36'; ell(c, 0, top - 16, 2.2, 2.2); c.fill(); if (on){ c.fillStyle = 'rgba(255,122,77,.3)'; ell(c, 0, top - 16, 5, 5); c.fill(); } }
  for (const s of [-1, 1]){
    const ex = s*5.5 + s*Math.sin(t*1.3 + s)*0.4, ey = top - (st.tallEyes ? 16 : 9);
    c.strokeStyle = '#4a423b'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(s*4, top - 2); c.lineTo(ex, ey + 2); c.stroke();
    c.fillStyle = st.head2; ell(c, ex, ey, 4, 4); c.fill();
    robotEye(c, ex, ey, 2.8, h.blink, false);
  }
  c.restore();
  for (const a of arms) crabClaw(c, a.cx, a.cy, a.s, a.cs, a.open, a.ang, st);
  c.restore();
}

// what the truck pays, in the same colours as the payout numbers: orange for leaves, shiny silver for metal, gold for honey
// RAINY HOLLOW: wet wood pays out in damp bark brown, dry bundles in warm pale wood, mushrooms in their cap colours
const PAY_COL = { leaf: '#ff9b3d', bag: '#ffb866', honey: '#e8b46a', gift: '#ff8f7a', bonus: '#b5e36d' };
function payFill(c, kind, y0, y1){
  if (kind === 'ingot'){ const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#fff0d0'); g.addColorStop(0.5, '#e8c48a'); g.addColorStop(0.52, '#c4965a'); g.addColorStop(1, '#f2d8a8'); return g; }
  if (kind !== 'metal') return PAY_COL[kind] || '#fff4e0';
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#e8d4b4'); g.addColorStop(0.45, '#b8946a'); g.addColorStop(0.55, '#8a6a46'); g.addColorStop(1, '#c4a47a');
  return g;
}
function payIcon(c, kind, x, y, fs){
  if (kind === 'leaf') drawLeaf(c, x, y, fs*0.45, 0.4, 1, 1, 1, 1, 1, 0);
  else if (kind === 'bag') drawLeafBag(c, x, y + fs*0.55, fs*1.05);
  else if (kind === 'metal') nugget(c, x, y, fs*0.42, 0.2);
  else if (kind === 'ingot') drawIngot(c, x, y + fs*0.25, fs*0.95, 0);
  else if (kind === 'gift') drawGiftJar(c, x, y + 0.6, fs*0.55);
  else drawJar(c, x, y + 0.6, fs*0.55);
}
function drawTruckBoard(c, BT){
  const rows = [['leaf', leafPrice(), 'leaf']];
  if (S.bag.built) rows.push(['bag', bagPrice(), 'bag']);
  if (S.metalSlot) rows.push(['metal', metalPrice(), 'metal']);
  if (S.plant.built) rows.push(['ingot', ingotPrice(), 'ingot']);
  if (S.hive.built) rows.push(['honey', honeyPrice(), 'jar']);
  if (S.hive.packing) rows.push(['gift', giftJarPrice(), 'gift']);
  const x0 = -13, x1 = 65, y0 = BT + 4, y1 = -16, bw = x1 - x0, cx = (x0 + x1)/2;
  c.fillStyle = '#e9d6b0'; rr(c, x0 - 1.5, y0 - 1.5, bw + 3, y1 - y0 + 3, 4); c.fill();
  c.fillStyle = '#33271d'; rr(c, x0, y0, bw, y1 - y0, 3); c.fill();
  // header strip
  c.fillStyle = '#b8452d'; rr(c, x0 + 2, y0 + 2, bw - 4, 10, 2); c.fill();
  c.font = '800 8.5px "Baloo 2", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fbefd8';
  c.fillText('WE BUY', cx, y0 + 7.4);
  // more than three things to sell: two columns, with the price only (the icon says what it's for)
  const top = y0 + 14, room = y1 - 2 - top, two = rows.length > 3, per = two ? Math.ceil(rows.length/2) : rows.length, lh = room/per;
  const fs = two ? (per === 2 ? 10.5 : 9) : per === 1 ? 14 : per === 2 ? 12 : 10.5;
  rows.forEach(([kind, price, unit], i) => {
    const col = two ? Math.floor(i/per) : 0, y = top + lh*((two ? i % per : i) + 0.5);
    const cx0 = two ? x0 + col*(bw/2) : x0, cx1 = two ? cx0 + bw/2 : x1;
    const ix = cx0 + (two ? 6.5 : 8);
    payIcon(c, kind, ix, y, fs);
    const pt = money(price);
    if (two) unit = '';
    c.font = '800 ' + fs + 'px "Baloo 2", sans-serif'; c.textAlign = 'left';
    const pw = c.measureText(pt).width;
    c.font = '700 ' + (fs*0.68) + 'px "Baloo 2", sans-serif';
    const uw = unit ? c.measureText(' / ' + unit).width : 0, avail = cx1 - 3 - (ix + 6.5), sc = Math.min(1, avail/(pw + uw));
    c.save(); c.translate(ix + 6.5, y + fs*0.04); c.scale(sc, 1);
    c.font = '800 ' + fs + 'px "Baloo 2", sans-serif'; c.fillStyle = payFill(c, kind, -fs*0.4, fs*0.4); c.fillText(pt, 0, 0);
    if (unit){ c.font = '700 ' + (fs*0.68) + 'px "Baloo 2", sans-serif'; c.fillStyle = '#d8c8a8'; c.fillText(' / ' + unit, pw, fs*0.06); }
    c.restore();
  });
  if (S.lv.cleanup){ c.fillStyle = '#5f7232'; rr(c, x1 - 13, y0 + 0.5, 13, 13, 3); c.fill(); drawLeaf(c, x1 - 7.5, y0 + 6.5, 4, 0.5, 4, 1, 1, 1, 1, 0); c.fillStyle = '#f6ead4'; c.font = '800 6px "Baloo 2", sans-serif'; c.textAlign = 'center'; c.fillText(String(S.lv.cleanup), x1 - 3.5, y0 + 10); }
}
function drawTruck(){
  const T = truck; if (T.st === 'away') return;
  const c = ctx; c.save(); c.translate(T.x, LANE);
  c.fillStyle = 'rgba(20,15,10,.35)'; rr(c, -80, -6, 156, 12, 6); c.fill();
  // a farm truck with tall stake sides, so there's room for a proper price board
  const BT = -64;
  c.fillStyle = '#7c5a3c'; rr(c, -18, BT, 88, 52, 3); c.fill();
  c.strokeStyle = '#664830'; c.lineWidth = 1.4; for (let x=-10; x<70; x+=11){ c.beginPath(); c.moveTo(x, BT + 1); c.lineTo(x, -13); c.stroke(); }
  if (T.fill > 0){
    const h = 4 + T.fill*18, rnd = mulberry(3);
    c.save(); c.beginPath(); c.moveTo(-16, BT); c.bezierCurveTo(-4, BT - h*1.3, 56, BT - h*1.3, 68, BT); c.closePath(); c.clip();
    c.fillStyle = '#b8582a'; c.fillRect(-16, BT - 4 - h*1.4, 84, h*1.5);
    for (let i=0;i<50;i++) drawLeaf(c, -14 + rnd()*80, BT - rnd()*h*1.15, 4.5, rnd()*TAU, Math.floor(rnd()*LEAFC.length), rnd()<.5?1:0, 1, .8, 1, 0);
    if (T.takeM) for (let i=0;i<Math.min(8, T.takeM);i++) nugget(c, 6 + rnd()*44, BT - rnd()*h*0.8, 3.4, rnd()*TAU);
    if (T.takeH) for (let i=0;i<Math.min(7, T.takeH);i++) drawJar(c, 2 + rnd()*52, BT - rnd()*h*0.7, 5);
    if (T.takeG) for (let i=0;i<Math.min(5, T.takeG);i++) drawGiftJar(c, 2 + rnd()*52, BT - rnd()*h*0.7, 5);
    if (T.takeB) for (let i=0;i<Math.min(6, T.takeB);i++) drawLeafBag(c, 2 + rnd()*52, BT + 3 - rnd()*h*0.6, 11);
    if (T.takeI) for (let i=0;i<Math.min(8, T.takeI);i++) drawIngot(c, 6 + rnd()*44, BT + 1 - rnd()*h*0.6, 9, 0);
    c.restore();
  }
  c.fillStyle = '#5d412b'; c.fillRect(-18, BT - 2, 88, 3.5);
  drawTruckBoard(c, BT);
  c.fillStyle = '#4f7774'; rr(c, -84, -32, 16, 20, 4); c.fill();
  c.fillStyle = '#5f8c87'; rr(c, -74, -52, 58, 40, 7); c.fill();
  c.fillStyle = 'rgba(255,255,255,.14)'; rr(c, -72, -50, 54, 5, 3); c.fill();
  c.fillStyle = '#d4e6e2'; rr(c, -67, -47, 23, 16, 4); c.fill();
  c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.moveTo(-62, -47); c.lineTo(-56, -47); c.lineTo(-63, -31); c.lineTo(-67, -31); c.closePath(); c.fill();
  c.strokeStyle = '#46696a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-40, -50); c.lineTo(-40, -14); c.stroke();
  c.fillStyle = '#ffe39b'; ell(c, -83, -24, 2.3, 3); c.fill();
  c.fillStyle = '#3a3633'; rr(c, -86, -15, 154, 6, 2); c.fill();
  for (const wx of [-56, 42]){
    c.save(); c.translate(wx, -6);
    c.fillStyle = '#2a2624'; ell(c, 0, 0, 10.5, 10.5); c.fill();
    c.fillStyle = '#b8ad9c'; ell(c, 0, 0, 5, 5); c.fill();
    c.rotate(T.rot); c.strokeStyle = '#7d7466'; c.lineWidth = 1.5;
    for (let k=0;k<3;k++){ c.rotate(TAU/3); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 4.6); c.stroke(); }
    c.restore();
  }
  c.restore();
}

function drawParts(){
  const c = ctx;
  for (const p of parts){
    const a = clamp(1 - p.t/p.life, 0, 1);
    if (p.k === 'fly'){
      const t = clamp(p.t/p.dur, 0, 1), e = t*t*(3 - 2*t);
      const x = lerp(p.x0, p.x1, e), y = lerp(p.y0, p.y1, e) - Math.sin(t*Math.PI)*p.arc;
      if (p.kind === 'leaf') drawLeaf(c, x, y, p.s || 5, p.rot + t*6, p.ci || 0, p.sh || 0, 1, 1, 1, 0);
      else if (p.kind === 'metal') nugget(c, x, y, 4.5, p.rot + t*5);
      else if (p.kind === 'jar') drawJar(c, x, y, 5.5);
      else if (p.kind === 'gift') drawGiftJar(c, x, y, 5.5);
      else if (p.kind === 'honey'){ c.fillStyle = '#e8dcc4'; c.fillRect(x - 0.6, y - 0.4, 1.2, 2.2); c.fillStyle = '#a8642e'; c.beginPath(); c.ellipse(x, y, 2.4, 1.9, 0, Math.PI, 0); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,240,215,.5)'; ell(c, x - 0.8, y - 1, 0.7, 0.35); c.fill(); }
      else if (p.kind === 'bag') drawLeafBag(c, x, y + 5, 12);
      else if (p.kind === 'ingot') drawIngot(c, x, y + 2, 9, Math.sin(t*6)*0.3);
      else if (p.kind === 'dirt'){ c.fillStyle = p.col || '#6b4a2e'; ell(c, x, y, p.s || 1.6, (p.s || 1.6)*0.8); c.fill(); }
      else if (p.kind === 'coin'){ const k = 1/cam.z, sq = Math.abs(Math.cos(t*12)); c.fillStyle = '#d9a43a'; ell(c, x, y, 6*k, (6*sq + 1)*k); c.fill(); c.fillStyle = '#f2cd66'; ell(c, x, y, 4*k, (4*sq + .6)*k); c.fill(); }
    } else if (p.k === 'spark'){ c.fillStyle = 'rgba(255,214,120,' + a + ')'; c.fillRect(p.x - 1, p.y - 1, 2.2, 2.2); }
    else if (p.k === 'smoke'){ const k = p.t/p.life, r = p.r*(1 + k*2.2); c.fillStyle = 'rgba(70,64,60,' + (0.42*Math.sin(Math.min(1, k*3)*Math.PI/2)*(1 - k)) + ')'; ell(c, p.x, p.y, r, r*0.9); c.fill(); }
    else if (p.k === 'dust'){ const r = p.r*(1 + p.t/p.life*1.4); c.fillStyle = p.gray ? 'rgba(190,180,170,' + a*0.45 + ')' : 'rgba(170,140,100,' + a*0.4 + ')'; ell(c, p.x, p.y, r, r); c.fill(); }
    else if (p.k === 'star'){ c.save(); c.translate(p.x, p.y); c.rotate(p.t*4); c.fillStyle = 'rgba(255,236,170,' + a + ')'; const s = 3.2; c.beginPath(); c.moveTo(0,-s); c.lineTo(s*.3,-s*.3); c.lineTo(s,0); c.lineTo(s*.3,s*.3); c.lineTo(0,s); c.lineTo(-s*.3,s*.3); c.lineTo(-s,0); c.lineTo(-s*.3,-s*.3); c.fill(); c.restore(); }
    else if (p.k === 'air'){ const sp = Math.hypot(p.vx, p.vy) || 1, ux = p.vx/sp, uy = p.vy/sp, k = p.t/p.life, L = p.len*(0.6 + k), cu = p.curl*(3 + 5*k);
      c.strokeStyle = 'rgba(250,246,232,' + (Math.sin(k*Math.PI)*0.32) + ')'; c.lineWidth = 1.1; c.lineCap = 'round';
      c.beginPath(); c.moveTo(p.x - ux*L, p.y - uy*L); c.quadraticCurveTo(p.x - ux*L*0.4 - uy*cu, p.y - uy*L*0.4 + ux*cu, p.x, p.y); c.quadraticCurveTo(p.x + ux*3 + uy*cu*0.6, p.y + uy*3 - ux*cu*0.6, p.x + ux*1.5 + uy*cu, p.y + uy*1.5 - ux*cu); c.stroke(); }
    else if (p.k === 'petal'){ c.save(); c.translate(p.x, p.y); c.rotate(p.t*7); c.globalAlpha = a; c.fillStyle = p.col; ell(c, 0, 0, 1.6, 0.9); c.fill(); c.restore(); }
    else if (p.k === 'drop'){ const sp = Math.hypot(p.vx, p.vy) || 1, L = 1.6 + sp*0.012; c.strokeStyle = 'rgba(212,226,238,' + a*0.85 + ')'; c.lineWidth = 0.9; c.lineCap = 'round'; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx/sp*L, p.y - p.vy/sp*L); c.stroke(); }
    else if (p.k === 'speck'){ c.fillStyle = p.saw ? 'rgba(226,190,130,' + a*0.9 + ')' : 'rgba(120,110,60,' + a*0.7 + ')'; c.fillRect(p.x - 0.8, p.y - 0.8, 1.6, 1.6); }
    else if (p.k === 'gust'){ const sp = Math.hypot(p.vx, p.vy) || 1, L = 6 + 6*a; c.strokeStyle = 'rgba(255,250,235,' + a*0.6 + ')'; c.lineWidth = 1.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(p.x, p.y); c.quadraticCurveTo(p.x - p.vx/sp*L*0.5 + p.vy/sp*2, p.y - p.vy/sp*L*0.5 - p.vx/sp*2, p.x - p.vx/sp*L, p.y - p.vy/sp*L); c.stroke(); }
    else if (p.k === 'ring'){ const r = p.r0 + (p.r1 - p.r0)*(p.t/p.life); c.strokeStyle = 'rgba(255,240,210,' + a*0.6 + ')'; c.lineWidth = 2; ell(c, p.x, p.y, r, r*0.55); c.stroke(); }
  }
}

// ───────────────────────── screen-space overlays (stay readable at any zoom)
const textScale = () => clamp(cam.z, 0.85, 1.3);
function drawPops(){
  const c = ctx;
  for (const p of pops){
    if (p.t < 0) continue;
    if (p.kind === 'sale'){ drawSalePop(c, p); continue; }
    const k = p.t/p.life, a = k < 0.75 ? 1 : 1 - (k - 0.75)/0.25;
    const s = w2s(p.x, p.y);
    const y = s.y + (p.oy || 0)*textScale() - (1 - Math.pow(1 - Math.min(1, p.t/0.9), 3))*30;
    const sc = p.t < 0.12 ? 0.6 + p.t/0.12*0.4 : 1;
    c.save(); c.globalAlpha = a; c.translate(s.x, y); c.scale(sc, sc);
    const size = Math.round(p.size*textScale());
    if (p.kind === 'pay'){ drawPayPop(c, p, size); c.restore(); continue; }
    c.font = (p.kind === 'note' ? '700 ' : '800 ') + size + 'px ' + (p.kind === 'note' ? 'Caveat, cursive' : '"Baloo 2", sans-serif');
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const w = c.measureText(p.text).width;
    const tx = (p.kind === 'leaf' || p.kind === 'metal' || p.kind === 'honey' || p.kind === 'gift' || p.kind === 'bag' || p.kind === 'ingot') ? 9 : 0;
    c.lineJoin = 'round'; c.lineWidth = Math.max(3, size*0.22); c.strokeStyle = 'rgba(55,30,14,.75)'; c.strokeText(p.text, tx, 0);
    c.fillStyle = p.kind === 'cash' ? '#ffd56b' : p.kind === 'wet' ? '#a8d4f2' : p.kind === 'metal' ? '#e6c89a' : p.kind === 'ingot' ? '#f2d8a8' : p.kind === 'leaf' || p.kind === 'bag' ? '#ffd7a8' : p.kind === 'honey' || p.kind === 'gift' ? '#ffe08a' : '#fff4e0';
    c.fillText(p.text, tx, 0);
    if (p.kind === 'leaf') drawLeaf(c, tx - w/2 - 10, 0, 7.5, 0.3, 1, 1, 1, 1, 1, 0);
    if (p.kind === 'metal') nugget(c, tx - w/2 - 10, 0, 7, 0.2);
    if (p.kind === 'honey') drawJar(c, tx - w/2 - 10, 1, 9);
    if (p.kind === 'gift') drawGiftJar(c, tx - w/2 - 10, 1, 9);
    if (p.kind === 'bag') drawLeafBag(c, tx - w/2 - 10, 7, 15);
    if (p.kind === 'ingot') drawIngot(c, tx - w/2 - 10, 3, 13, 0);
    c.restore();
  }
}
// a sale number: pops up over the bin (or tub, pallet, crate) it came from, sits there a moment, then flies into the truck
function drawSalePop(c, p){
  const ts = textScale(), size = Math.round(p.size*ts), src = w2s(p.x, p.y), dst = w2s(p.tx, p.ty);
  let x, y, sc, a = 1;
  if (p.t < SALE_HOLD){
    const k = Math.min(1, p.t/0.45), e = 1 - Math.pow(1 - k, 3);
    x = src.x; y = src.y + p.oy*ts - e*18; sc = p.t < 0.14 ? 0.55 + p.t/0.14*0.45 : 1;
  } else {
    const u = clamp((p.t - SALE_HOLD)/SALE_FLY, 0, 1), e = u*u*(3 - 2*u);
    const x0 = src.x, y0 = src.y + p.oy*ts - 18;
    x = lerp(x0, dst.x, e); y = lerp(y0, dst.y, e) - Math.sin(u*Math.PI)*40*ts; sc = 1 - 0.45*e; a = u > 0.8 ? 1 - (u - 0.8)/0.2*0.7 : 1;
  }
  c.save(); c.globalAlpha = a; c.translate(x, y); c.scale(sc, sc);
  c.textBaseline = 'middle'; c.lineJoin = 'round';
  c.font = '800 ' + size + 'px "Baloo 2", sans-serif'; const w1 = c.measureText(p.text).width, icon = size*1.05, x0 = -(icon + w1)/2;
  if (p.icon === 'bonus') drawLeaf(c, x0 + icon*0.4, 0, size*0.4, 0.5, 4, 1, 1, 1, 1, 0); else payIcon(c, p.icon, x0 + icon*0.4, 0, size);
  c.textAlign = 'left'; c.lineWidth = Math.max(3, size*0.24); c.strokeStyle = 'rgba(45,25,12,.85)'; c.strokeText(p.text, x0 + icon, 0);
  c.fillStyle = p.res === 'honey' ? '#ffe52e' : payFill(c, p.res, -size*0.45, size*0.45); c.fillText(p.text, x0 + icon, 0);
  if (p.res === 'metal'){
    const k = clamp((p.t - 0.2)/0.6, 0, 1);
    if (k > 0 && k < 1){ const gx = x0 + icon + k*w1*1.3 - w1*0.15, g = c.createLinearGradient(gx - 8, 0, gx + 8, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillText(p.text, x0 + icon, 0); }
  }
  if (p.t < SALE_HOLD + 0.1 && p.sub){
    // what it was for, in small letters underneath (gone once it starts to fly)
    const sa = p.t < SALE_HOLD ? 1 : 1 - (p.t - SALE_HOLD)/0.1, ss = Math.round(size*0.72);
    c.globalAlpha = a*clamp(sa, 0, 1); c.font = '700 ' + ss + 'px Caveat, cursive'; c.textAlign = 'center';
    c.lineWidth = Math.max(2.5, ss*0.22); c.strokeStyle = 'rgba(45,25,12,.75)'; c.strokeText(p.sub, 0, size*0.82); c.fillStyle = '#fff4e0'; c.fillText(p.sub, 0, size*0.82);
  }
  c.restore();
}
// one payout line: an icon, the dollar amount in the resource's colour, and what it was for in small letters
function drawPayPop(c, p, size){
  const subSize = Math.round(size*0.78);
  c.textBaseline = 'middle'; c.lineJoin = 'round';
  c.font = '800 ' + size + 'px "Baloo 2", sans-serif'; const w1 = c.measureText(p.text).width;
  c.font = '700 ' + subSize + 'px Caveat, cursive'; const w2 = c.measureText(p.sub).width;
  const icon = size*1.05, gap = size*0.35, tot = icon + w1 + gap + w2, x0 = -tot/2;
  const ic = x0 + icon*0.4;
  if (p.res === 'bonus') drawLeaf(c, ic, 0, size*0.4, 0.5, 4, 1, 1, 1, 1, 0);
  else payIcon(c, p.res, ic, 0, size);
  c.textAlign = 'left';
  c.font = '800 ' + size + 'px "Baloo 2", sans-serif';
  c.lineWidth = Math.max(3, size*0.24); c.strokeStyle = 'rgba(45,25,12,.85)'; c.strokeText(p.text, x0 + icon, 0);
  c.fillStyle = payFill(c, p.res, -size*0.45, size*0.45); c.fillText(p.text, x0 + icon, 0);
  if (p.res === 'metal' || p.res === 'ingot'){
    // a glint that runs across the silver once
    const k = clamp((p.t - 0.15)/0.6, 0, 1);
    if (k > 0 && k < 1){ c.save();
      const gx = x0 + icon + k*w1*1.3 - w1*0.15, g = c.createLinearGradient(gx - 8, 0, gx + 8, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillText(p.text, x0 + icon, 0); c.restore(); }
  }
  c.font = '700 ' + subSize + 'px Caveat, cursive';
  c.lineWidth = Math.max(2.5, subSize*0.22); c.strokeStyle = 'rgba(45,25,12,.75)'; c.strokeText(p.sub, x0 + icon + w1 + gap, 1);
  c.fillStyle = '#fff4e0'; c.fillText(p.sub, x0 + icon + w1 + gap, 1);
}
function drawBubbles(){
  const c = ctx;
  for (const b of bubbles){
    const s = w2s(b.x, b.y), ts = textScale();
    c.save(); c.font = '700 ' + Math.round(15*ts) + 'px Caveat, cursive';
    const w = c.measureText(b.t).width + 14, h = 18*ts;
    c.fillStyle = 'rgba(246,234,212,.95)'; rr(c, s.x - w/2, s.y - h/2, w, h, 8); c.fill();
    c.beginPath(); c.moveTo(s.x - 4, s.y + h/2 - 1); c.lineTo(s.x, s.y + h/2 + 5); c.lineTo(s.x + 4, s.y + h/2 - 1); c.fill();
    c.fillStyle = '#a8361d'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(b.t, s.x, s.y + 1);
    c.restore();
  }
  bubbles = [];
}
// The little arrow only points at something new: an upgrade you can afford that you haven't seen in its card yet.
// Once its card has been open while you could afford it, that upgrade never raises the arrow again.
// V7: robot upgrades share one key per track across every robot (and every kind, for Wheels), so finding Basket
// upgrades on one robot doesn't light up an arrow over each of the others.
function offerKey(o){
  switch (o.id){
    case 'up': case 'gen': case 'tech': case 'hiveUp': return o.id + ':' + o.key;
    case 'rup': case 'hup': return 'trk:' + o.key;
    case 'miner': case 'shaft': return o.id + ':' + o.arg;
    case 'land': return 'land:' + (S.land + 1);
  }
  return o.id;
}
// what an open card shows, besides the things that belong to that object
function cardShows(o){
  const k = cardOpen.kind;
  if (o.obj === cardOpen.obj) return true;
  if (o.id === 'tech'){ const tk = TECH[o.key].track, kind = tk === 'blow' || tk === 'dig' || tk === 'stoke' ? 'blower' : tk === 'shake' ? 'shaker' : 'robot'; return k === kind; }
  if (k === 'bin') return o.id === 'bagger' || o.id === 'plant' || o.id === 'metalSlot';
  if (k === 'spot') return o.id === 'metalSlot';
  if (k === 'shed') return o.id === 'hive';
  return false;
}
let seenT = 0;
function markSeen(){
  if (!cardOpen || cardOpen.kind === 'sound' || (cardOpen.tabsOn && cardTab === 'tasks')) return;
  let n = 0;
  for (const o of offers()){ if (o.cost > S.cash + 1e-9 || !cardShows(o)) continue; const key = offerKey(o); if (!S.seen[key]){ S.seen[key] = 1; n++; } }
  if (n) save();
}
function drawMarkers(){
  const c = ctx, groups = {};
  for (const o of offers()){
    if (o.cost > S.cash + 1e-9 || S.seen[offerKey(o)]) continue;
    groups[o.obj] = true;
  }
  if (cardOpen) groups[cardOpen.obj] = false;
  for (const k in groups){
    if (!groups[k]) continue;
    const p = objPos(k); if (!p) continue;
    const s = w2s(p.x, p.y), ts = textScale();
    const y = s.y - 8 + Math.sin(S.t*3 + p.x)*2.5;
    c.save(); c.translate(s.x, y); c.scale(ts, ts);
    c.fillStyle = 'rgba(255,214,120,.28)'; ell(c, 0, 0, 13, 13); c.fill();
    c.fillStyle = '#f6ead4'; ell(c, 0, 0, 8.5, 8.5); c.fill();
    c.strokeStyle = '#d4672a'; c.lineWidth = 2.3; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(-3.6, 1.6); c.lineTo(0, -2.2); c.lineTo(3.6, 1.6); c.stroke();
    c.restore();
  }
}
// V7: each tip goes away for good once you've done what it asks (opening the right card counts), and the ones that
// float over a robot also fade out on their own after a little while (HINT_SECS on screen), so none of them linger.
const HINT_SECS = { unlock: 9, tasks: 12, miner: 20 };
let hintNow = null, hintT = 0, hintA = 0;
const hintDone = id => !!(S.flags.hints && S.flags.hints[id]);
function dismissHint(id){ if (!S.flags.hints) S.flags.hints = {}; if (!S.flags.hints[id]){ S.flags.hints[id] = 1; save(); } }
function currentHint(){
  if (!S.flags.opened && S.cash >= 0.25) return { id:'tap', x: BIN.x, y: BIN.y - 106, t: 'tap things to upgrade them' };
  if (!S.flags.research && !hintDone('unlock') && S.cash >= 3 && S.robots[0].lv.speed >= 3 && S.robots[0].lv.carry >= 3 && R[0]) return { id:'unlock', x: R[0].x, y: R[0].y - 96, t: 'tap the robot to unlock more' };
  if (S.metalSlot && !S.miners.length && !hintDone('miner') && S.cash >= MINER_COST*0.5){ const p = SPOTS[0]; return { id:'miner', x: p.x, y: p.y - 74, t: 'set up a saw at the wood pile' }; }
  if (S.miners.length && !S.flags.sentHint && !S.flags.taskHint && !hintDone('tasks') && R[0]) return { id:'tasks', x: R[0].x, y: R[0].y - 98, t: 'tap a robot to change its tasks' };
  if (S.hive.built && !S.hive.bees && !hintDone('bees') && S.t - hiveRt.builtT > 1.4) return { id:'bees', x: HIVE.x + 30, y: HIVE.y - hiveTopZ() - 54, t: 'tap the ant hill to add ants' };
  return null;
}
function updHints(dt){
  const h = currentHint();
  if (!h || !hintNow || h.id !== hintNow.id){ hintT = 0; if (!h) hintA = Math.max(0, hintA - dt*3); else hintA = 0; }
  hintNow = h;
  if (!h) return;
  hintT += dt; hintA = Math.min(1, hintA + dt*3);
  const lim = HINT_SECS[h.id];
  if (lim && hintT > lim){ hintA = Math.max(0, 1 - (hintT - lim)/0.8); if (hintA <= 0) dismissHint(h.id); }
}
function drawHints(){
  const h = hintNow; if (!h || hintA <= 0) return;
  const c = ctx, s = w2s(h.x, h.y);
  c.save(); c.globalAlpha = hintA;
  const y = s.y + Math.sin(S.t*2.4)*3;
  c.font = '700 ' + Math.round(21*textScale()) + 'px Caveat, cursive'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.lineWidth = 4; c.strokeStyle = 'rgba(55,30,14,.6)'; c.strokeText(h.t, s.x, y); c.fillStyle = '#fff4e0'; c.fillText(h.t, s.x, y);
  c.restore();
}

// ───────────────────────── RAINY HOLLOW: rain, puddles, splashes and wet tracks
// None of this changes the game; it's all looks. The rain comes and goes slowly (rainLevel). Drops streak down the
// screen in three depths, splash on the ground and ring the puddles. Puddles reflect whatever stands at or behind their
// edge (robots, helpers, trees, buildings, the truck), mirrored about the thing's foot, with a wobble and the overcast
// sky behind. Driving through one throws up spray and a wake, and the wheels leave wet prints for a while after.
const RAIN = { k: 0.7, drops: [], splash: [], ripples: [], tracks: [], mist: [], acc: 0, sacc: 0, t: 0 };
let reflCv = null, reflCtx = null, mistSpr = null, mistCv = null;
const rainLevel = t => clamp(0.6 + 0.24*Math.sin(t/83) + 0.14*Math.sin(t/29 + 1.3), 0.25, 1);
const RAIN_SLANT = () => 0.16 + wind*0.0016;
function rainDrop(rnd0){
  const z = Math.random(), r = rnd0 ? Math.random() : 0;
  return { x: Math.random()*(W + 200) - 100, y: rnd0 ? r*H : -Math.random()*60, z, v: 700 + 700*z, l: 10 + 22*z };
}
function updRain(dt){
  const R0 = RAIN; R0.t += dt;
  R0.k = rainLevel(S.t);
  // screen-space streaks
  const want = Math.round(R0.k*W*H/1500*(reduceMotion ? 0.35 : 1));
  while (R0.drops.length < want) R0.drops.push(rainDrop(R0.drops.length < want*0.9));
  if (R0.drops.length > want + 20) R0.drops.length = want;
  const sl = RAIN_SLANT();
  for (const d of R0.drops){
    d.y += d.v*dt; d.x += d.v*sl*dt;
    if (d.y > H + 20 || d.x > W + 120){ Object.assign(d, rainDrop(false)); d.x -= d.y*sl; }
  }
  // splashes on the ground and rings on the puddles (world units), only in view
  const V = visRect(), area = Math.max(1, (V.x1 - V.x0)*(V.y1 - V.y0));
  R0.sacc += dt*R0.k*Math.min(140, area*0.00016)*(reduceMotion ? 0.3 : 1);
  while (R0.sacc >= 1){
    R0.sacc -= 1;
    const x = rand(V.x0, V.x1), y = rand(V.y0, V.y1);
    if (puddleAt(x, y)) continue;
    R0.splash.push({ x, y, t: 0, life: rand(0.18, 0.3), s: rand(0.8, 1.3)*(y > 8 ? 1.1 : 1) });
  }
  for (const p of PUDDLES){
    if (p.x + p.rx < V.x0 || p.x - p.rx > V.x1 || p.y + p.ry < V.y0 || p.y - p.ry > V.y1) continue;
    p.racc = (p.racc || 0) + dt*R0.k*p.rx*p.ry*0.0042;
    while (p.racc >= 1){ p.racc -= 1; const a = rand(0, TAU), d = Math.sqrt(Math.random())*0.85; R0.ripples.push({ p, x: p.x + Math.cos(a)*p.rx*d, y: p.y + Math.sin(a)*p.ry*d, t: 0, life: rand(0.55, 0.9), r1: rand(3, 6.5), w: rand(0.5, 0.85) }); }
    if (p.agit) p.agit = Math.max(0, p.agit - dt*0.7);
  }
  for (const s of R0.splash) s.t += dt;
  R0.splash = R0.splash.filter(s => s.t < s.life);
  for (const r of R0.ripples) r.t += dt;
  R0.ripples = R0.ripples.filter(r => r.t < r.life);
  if (R0.ripples.length > 700) R0.ripples.splice(0, R0.ripples.length - 700);
  // things driving through puddles
  for (const r of R){
    wade(r, r.moving, STYLES[r.id].tw*0.5, dt);
    // now and then a drop splashes off a robot's head (or its umbrella)
    if (!STYLES[r.id].brolly && Math.random() < dt*0.9*R0.k) parts.push({ k:'drop', x: r.x + rand(-6, 6), y: r.y - 8 - STYLES[r.id].bh - STYLES[r.id].hh - 2, vx: rand(-22, 22), vy: rand(-32, -12), g: 260, life: rand(.2, .35), t: 0 });
  }
  for (const h of HB) wade(h, h.moving, h.kind === 'blower' ? helperStyle(h).tw*0.5 : 14, dt);
  { const T = truck, on = T.st === 'arrive' || T.st === 'leave';
    if (T.st !== 'away'){ for (const k of [0, 1]){ const w = T._w || (T._w = [{ face: -1 }, { face: -1 }]); const o = w[k]; o.x = T.x + (k ? 44 : -52); o.y = LANE + 4; o.face = T.x > (o.px || T.x) ? 1 : -1; o.px = T.x; wade(o, on, 9, dt, 1.8); } } }
  for (const t of R0.tracks) t.t += dt;
  R0.tracks = R0.tracks.filter(t => t.t < 9);
  if (R0.tracks.length > 500) R0.tracks.splice(0, R0.tracks.length - 500);
  // drifting mist
  if (!R0.mist.length) for (let i=0;i<6;i++) R0.mist.push({ x: Math.random(), y: 0.15 + Math.random()*0.8, s: 0.5 + Math.random()*0.7, v: (Math.random() < .5 ? -1 : 1)*(0.004 + Math.random()*0.006), a: 0.05 + Math.random()*0.05 });
  for (const m of R0.mist){ m.x += m.v*dt; if (m.x < -0.6) m.x = 1.6; if (m.x > 1.6) m.x = -0.6; }
}
// a robot, helper or truck wheel crossing a puddle: spray, a wake, and wet prints afterwards
function wade(o, moving, half, dt, big){
  const p = puddleAt(o.x, o.y, 2), was = o._pud;
  o._pud = p;
  if (p && moving){
    p.agit = Math.min(1, (p.agit || 0) + dt*3*(big || 1));
    if (!was){
      // in it goes: a burst of spray and a ring
      for (let k=0;k<(big ? 16 : 10);k++){ const a = rand(-Math.PI, 0), v = rand(30, 70)*(big || 1); parts.push({ k:'drop', x: o.x + rand(-half, half), y: o.y, vx: Math.cos(a)*v, vy: Math.sin(a)*v*1.3 - 20, g: 260, life: rand(0.35, 0.6), t: 0 }); }
      RAIN.ripples.push({ p, x: o.x, y: o.y + 1, t: 0, life: 1.1, r1: 18*(big || 1), w: 1 });
      if (!simMode){ const a = sndAt(o.x, o.y); sfx('grab', 1, a.pan, a.vol*0.35); }
    }
    o._wk = (o._wk || 0) - dt;
    if (o._wk <= 0){
      o._wk = 0.09;
      RAIN.ripples.push({ p, x: o.x - (o.face || 1)*half*0.6, y: o.y + 1, t: 0, life: 0.9, r1: rand(9, 15)*(big || 1), w: 0.9 });
      for (const sx of [-half*0.8, half*0.8]) for (let k=0;k<2;k++) parts.push({ k:'drop', x: o.x + sx, y: o.y - 1, vx: -(o.face || 1)*rand(15, 45)*(big || 1) + rand(-10, 10), vy: rand(-55, -25)*(big || 1), g: 280, life: rand(0.3, 0.5), t: 0 });
    }
    o._wet = big ? 1.4 : 3.2;
  } else if (o._wet > 0 && moving){
    // wet wheels leave prints on the ground for a few metres
    o._wet -= dt;
    const d = Math.hypot(o.x - (o._tx ?? o.x - 99), o.y - (o._ty ?? o.y));
    if (d > 6){ o._tx = o.x; o._ty = o.y; RAIN.tracks.push({ x: o.x, y: o.y, h: half*0.8, t: 0, a: clamp(o._wet/3.2, 0.2, 1) }); }
  }
}
function drawTracks(V){
  const c = ctx;
  for (const t of RAIN.tracks){
    if (t.x < V.x0 || t.x > V.x1 || t.y < V.y0 || t.y > V.y1) continue;
    const a = t.a*(1 - t.t/9)*0.32;
    c.fillStyle = 'rgba(22,15,9,' + a + ')';
    ell(c, t.x - t.h, t.y + 0.5, 3, 1.3); c.fill(); ell(c, t.x + t.h, t.y + 0.5, 3, 1.3); c.fill();
  }
}
function drawSplashes(V){
  const c = ctx;
  c.lineCap = 'round';
  for (const s of RAIN.splash){
    const k = s.t/s.life, a = (1 - k)*0.55, r = 1 + k*3*s.s;
    c.strokeStyle = 'rgba(214,226,236,' + a + ')'; c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(s.x - r*0.5, s.y - r*0.2); c.lineTo(s.x - r, s.y - r*1.1); c.moveTo(s.x + r*0.5, s.y - r*0.2); c.lineTo(s.x + r, s.y - r*1.1); c.moveTo(s.x, s.y - r*0.3); c.lineTo(s.x, s.y - r*1.4); c.stroke();
    c.strokeStyle = 'rgba(214,226,236,' + a*0.6 + ')'; ell(c, s.x, s.y, r*1.2, r*0.45); c.stroke();
  }
}
// what a puddle can reflect: things standing at or behind it (their foot above the puddle's near edge)
function reflectables(p){
  const out = [], pad = 6, near = p.y + p.ry + pad, xs = (x, hw) => Math.abs(x - p.x) < p.rx + hw;
  const rch = (y, h) => y < near && y + h > p.y - p.ry;
  for (const r of R) if (xs(r.x, 26) && rch(r.y, 80)) out.push({ y: r.y, f: () => drawRobot(r) });
  for (const h of HB) if (xs(h.x, 30) && rch(h.y, h.st === 'brolly' ? 95 : 60)) out.push({ y: h.y, f: () => h.kind === 'blower' ? drawBlower(h) : drawShaker(h) });
  const B2 = [[BIN.x, BIN.y, 50, 70, drawBin], [SHED.x, SHED.y, 60, 105, drawShed], [SIGN.x, SIGN.y, 30, 75, drawSign], [BAGGER.x, BAGGER.y, 34, 50, drawBagger],
              [PALLET.x, PALLET.y, 34, 60, drawPallet], [CRATE.x, CRATE.y, 30, 60, drawHoneyCrate], [HIVE.x, HIVE.y, 44, 110, drawHive], [PLANT.x, PLANT.y, 130, 175, drawPlant]];
  for (const [x, y, hw, hh, f] of B2) if (xs(x, hw) && rch(y, hh)) out.push({ y, f });
  for (const i of S.miners){ const sp = SPOTS[i]; if (xs(sp.x, 60) && rch(sp.y, 110)) out.push({ y: sp.y, f: () => drawMiner(i) }); }
  if (p.road && truck.st !== 'away' && xs(truck.x, 90)) out.push({ y: LANE + 5, f: drawTruck });
  out.sort((a, b) => a.y - b.y);
  return out;
}
const REFL_SQ = 0.86;   // reflections are a little shorter than the real thing (we look down at the puddle)
function drawPuddles(V){
  const c = ctx, vis = PUDDLES.filter(p => p.x + p.rx > V.x0 && p.x - p.rx < V.x1 && p.y + p.ry > V.y0 && p.y - p.ry < V.y1);
  if (!vis.length) return;
  if (!reflCv || reflCv.width !== cv.width || reflCv.height !== cv.height){ reflCv = document.createElement('canvas'); reflCv.width = cv.width; reflCv.height = cv.height; reflCtx = reflCv.getContext('2d'); }
  const rc = reflCtx, z = cam.z, t = RAIN.t;
  rc.setTransform(1, 0, 0, 1, 0, 0);
  for (const p of vis){ const x0 = DPR*(cam.ox + (p.x - p.rx*1.4)*z), y0 = DPR*(cam.oy + (p.y - p.ry*1.5)*z); rc.clearRect(x0 - 2, y0 - 2, DPR*z*p.rx*2.8 + 4, DPR*z*p.ry*3 + 4); }
  rc.setTransform(DPR*z, 0, 0, DPR*z, DPR*cam.ox, DPR*cam.oy);
  const keep = ctx, pl = parts.length, bl = bubbles.length;
  for (const p of vis){
    rc.save(); puddleTrace(rc, p, 0); rc.clip();
    // the overcast sky: pale at the far edge of the puddle, deeper toward us, with slow cloud shapes drifting across
    const sg = rc.createLinearGradient(0, p.y - p.ry, 0, p.y + p.ry);
    if (p.road){ sg.addColorStop(0, '#77838f'); sg.addColorStop(1, '#3f4853'); } else { sg.addColorStop(0, '#9aa7b4'); sg.addColorStop(1, '#55626f'); }
    rc.fillStyle = sg; rc.fillRect(p.x - p.rx - 4, p.y - p.ry - 4, p.rx*2 + 8, p.ry*2 + 8);
    for (let k=0;k<3;k++){ const cx = p.x + ((t*4 + k*37 + p.seed*3) % (p.rx*2 + 40)) - p.rx - 20, cy = p.y - p.ry*0.3 + k*p.ry*0.35; rc.fillStyle = 'rgba(205,214,224,.22)'; ell(rc, cx, cy, p.rx*0.45, p.ry*0.28); rc.fill(); }
    // and everything standing behind it, upside down
    ctx = rc;
    try {
      for (const o of reflectables(p)){ rc.save(); rc.translate(0, o.y); rc.scale(1, -REFL_SQ); rc.translate(0, -o.y); o.f(); rc.restore(); }
      for (let i=0;i<TREES.length;i++){
        const tr = TREES[i], cc = canopyCvs[i]; if (!cc) continue;
        const yb = tr.y + cc.base; if (yb > p.y + p.ry + 4 || yb + (cc.oy + cc.base)*REFL_SQ < p.y - p.ry || Math.abs(tr.x - p.x) > tr.r + p.rx + 10) continue;
        rc.save(); rc.translate(tr.x, yb); rc.scale(1, -REFL_SQ); rc.globalAlpha = 0.95; rc.drawImage(cc.c, -cc.ox, -cc.oy - cc.base, cc.w, cc.h); rc.restore();
      }
    } catch(e){}
    ctx = keep;
    rc.restore();
  }
  parts.length = pl; bubbles.length = bl;
  // lay the reflections in, in thin wobbling strips, then the water itself on top
  const hs = Math.max(2, Math.round(2.2*DPR));
  for (const p of vis){
    const ag = p.agit || 0;
    c.save(); puddleTrace(c, p, 0); c.clip();
    c.setTransform(1, 0, 0, 1, 0, 0);
    const x0 = Math.floor(DPR*(cam.ox + (p.x - p.rx*1.3)*z)), x1 = Math.ceil(DPR*(cam.ox + (p.x + p.rx*1.3)*z));
    const y0 = Math.max(0, Math.floor(DPR*(cam.oy + (p.y - p.ry*1.3)*z))), y1 = Math.min(cv.height, Math.ceil(DPR*(cam.oy + (p.y + p.ry*1.3)*z)));
    const amp = DPR*z*(0.45 + 0.35*RAIN.k + 2.6*ag), w = x1 - x0;
    c.globalAlpha = 0.8;
    for (let y = y0; y < y1; y += hs){
      const wy = (y - DPR*cam.oy)/(DPR*z);   // world y of this strip, so the wobble sticks to the puddle
      const off = Math.sin(wy*0.9 + t*3.1 + p.seed)*amp + Math.sin(wy*2.3 - t*5.7)*amp*0.45;
      c.drawImage(reflCv, x0, y, w, hs, x0 + off, y, w, hs);
    }
    c.restore();
    // the water: a cool tint, darker at the rim, a soft sheen near the far edge, rain rings and wakes
    c.save(); puddleTrace(c, p, 0); c.clip();
    c.fillStyle = p.road ? 'rgba(28,34,44,.26)' : 'rgba(44,54,66,.24)'; c.fillRect(p.x - p.rx - 4, p.y - p.ry - 4, p.rx*2 + 8, p.ry*2 + 8);
    c.save(); c.translate(p.x, p.y); c.scale(1, p.ry/p.rx);
    const fr = c.createRadialGradient(0, 0, p.rx*0.55, 0, 0, p.rx*1.05); fr.addColorStop(0, 'rgba(30,24,18,0)'); fr.addColorStop(1, 'rgba(30,24,18,.45)');
    c.fillStyle = fr; ell(c, 0, 0, p.rx*1.1, p.rx*1.1); c.fill(); c.restore();
    c.fillStyle = 'rgba(235,242,248,.16)'; ell(c, p.x - p.rx*0.15, p.y - p.ry*0.55, p.rx*0.55, p.ry*0.12); c.fill();
    c.lineCap = 'round';
    for (const r of RAIN.ripples){
      if (r.p !== p) continue;
      const k = r.t/r.life, e = 1 - Math.pow(1 - k, 2.2), rad = 0.6 + r.r1*e, a = (1 - k)*0.55*r.w;
      c.strokeStyle = 'rgba(225,235,244,' + a + ')'; c.lineWidth = 0.75; ell(c, r.x, r.y, rad, rad*0.42); c.stroke();
      if (r.w > 0.8 && rad > 4){ c.strokeStyle = 'rgba(225,235,244,' + a*0.6 + ')'; ell(c, r.x, r.y, rad*0.62, rad*0.26); c.stroke(); }
      if (k < 0.15){ c.fillStyle = 'rgba(235,242,250,' + (0.6*(1 - k/0.15)) + ')'; ell(c, r.x, r.y - 0.6, 0.6, 0.6); c.fill(); }
    }
    c.restore();
    // a thin dark rim with a wet shine along the far edge
    puddleTrace(c, p, 0); c.strokeStyle = 'rgba(18,12,8,.55)'; c.lineWidth = 1.1; c.stroke();
    c.save(); puddleTrace(c, p, 0); c.clip(); puddleTrace(c, p, 0); c.strokeStyle = 'rgba(220,230,240,.22)'; c.lineWidth = 1.4; c.translate(0, 1.2); c.stroke(); c.restore();
  }
}
// screen-space rain streaks (over everything in the yard, under the cards)
function drawRain(){
  const c = ctx, sl = RAIN_SLANT();
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  c.lineCap = 'round';
  const layers = [[0, 0.35, 'rgba(190,204,220,.2)', 0.8], [0.35, 0.72, 'rgba(200,214,228,.3)', 1], [0.72, 1.01, 'rgba(214,226,238,.42)', 1.3]];
  for (const [z0, z1, col, lw] of layers){
    c.strokeStyle = col; c.lineWidth = lw; c.beginPath();
    for (const d of RAIN.drops){ if (d.z < z0 || d.z >= z1) continue; c.moveTo(d.x, d.y); c.lineTo(d.x - d.l*sl, d.y - d.l); }
    c.stroke();
  }
}
// slow drifting mist and the soft warm lights (screen space, after the cool wash, so they glow)
function drawMist(){
  const c = ctx;
  if (!mistSpr){ mistSpr = document.createElement('canvas'); mistSpr.width = mistSpr.height = 256; const g = mistSpr.getContext('2d'); const rg = g.createRadialGradient(128, 128, 0, 128, 128, 128); rg.addColorStop(0, 'rgba(225,232,240,1)'); rg.addColorStop(0.6, 'rgba(225,232,240,.35)'); rg.addColorStop(1, 'rgba(225,232,240,0)'); g.fillStyle = rg; g.fillRect(0, 0, 256, 256); }
  // the mist is drawn small (a quarter size) and laid over the screen in one go
  const mw = Math.max(1, Math.ceil(W/4)), mh = Math.max(1, Math.ceil(H/4));
  if (!mistCv || mistCv.width !== mw || mistCv.height !== mh){ mistCv = document.createElement('canvas'); mistCv.width = mw; mistCv.height = mh; }
  const g = mistCv.getContext('2d'), sz = Math.max(mw, mh);
  g.clearRect(0, 0, mw, mh);
  for (const m of RAIN.mist){ g.globalAlpha = m.a*(0.6 + 0.5*RAIN.k); const s = sz*m.s; g.drawImage(mistSpr, m.x*mw - s/2, m.y*mh - s*0.25, s, s*0.5); }
  g.globalAlpha = 1;
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  c.drawImage(mistCv, 0, 0, W, H);
}
// warm glows from windows, the drying shed's stove, the ant hill door and the truck's headlights
function drawGlows(){
  const c = ctx, z = cam.z;
  c.setTransform(DPR*z, 0, 0, DPR*z, DPR*cam.ox, DPR*cam.oy);
  c.globalCompositeOperation = 'lighter';
  const glow = (x, y, r, a, col) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(' + (col || '255,170,80') + ',' + a + ')'); g.addColorStop(1, 'rgba(' + (col || '255,170,80') + ',0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r*2, r*2); };
  const fl = 0.85 + Math.sin(RAIN.t*3.1)*0.06 + Math.sin(RAIN.t*7.3)*0.04;
  glow(SHED.x - 28, SHED.y - 44, 46, 0.2*fl); glow(SHED.x - 28, SHED.y + 6, 40, 0.08*fl);
  if (S.hive.built){ glow(HIVE.x, HIVE.y - 8, 30, 0.14*fl); if (twinBuilt()) glow(HIVE2.x, HIVE2.y - 8, 30, 0.14*fl); }
  if (S.plant.built){ const busy = STN.smelt.some(v => v != null && R[v] && R[v].st === 'smelt'); glow(PLANT.x, PLANT.y - 30, 120, (busy ? 0.2 : 0.1)*fl); glow(PLANT.x, PLANT.y + 20, 110, (busy ? 0.12 : 0.06)*fl); }
  for (const r of R) if (STYLES[r.id].lantern) glow(r.x, r.y - 40, 26, 0.18*fl);
  if (truck.st !== 'away'){ const hx = truck.x - 82; glow(hx, LANE - 18, 30, 0.22, '255,230,170'); glow(hx - 60, LANE + 4, 70, 0.1, '255,230,170'); }
  c.globalCompositeOperation = 'source-over';
}

function draw(){
  const c = ctx;
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  c.fillStyle = '#4a3c2a'; c.fillRect(0, 0, W, H);
  const G = groundCam, k = cam.z/G.z;
  c.drawImage(groundCv, cam.ox - (G.ox + G.mx)*k, cam.oy - (G.oy + G.my)*k, (W + 2*G.mx)*k, (H + 2*G.my)*k);
  c.setTransform(DPR*cam.z, 0, 0, DPR*cam.z, DPR*cam.ox, DPR*cam.oy);
  const V = visRect(); V.x0 -= 20; V.x1 += 20; V.y0 -= 20; V.y1 += 20;
  drawTracks(V); if (!DBG.includes('nopud')) drawPuddles(V); drawSplashes(V);   // RAINY HOLLOW
  drawSpotGlints();
  for (const l of leaves){
    if ((l.st === 'ground' || l.st === 'fade') && l.x > V.x0 && l.x < V.x1 && l.y > V.y0 && l.y < V.y1){
      if (l.st === 'ground'){ c.fillStyle = 'rgba(40,30,10,.18)'; ell(c, l.x + 1.5, l.y + 1.5, l.s*0.75, l.s*0.4); c.fill(); }
      drawLeaf(c, l.x, l.y, l.s, l.rot, l.ci, l.sh, l.flip, 0.72, l.a, 0);
    }
  }
  drawFlowers(V);
  const list = [
    { y: BIN.y, f: drawBin }, { y: SIGN.y, f: drawSign }, { y: SHED.y, f: drawShed }, { y: SHED.y + 4, f: drawPumpkins },
    { y: salePos().y, f: drawSaleSign }, { y: HIVE.y, f: drawHive }, { y: CRATE.y, f: drawHoneyCrate }, { y: HIVE2.y, f: () => atTwin(drawHive) }, { y: CRATE2.y, f: () => atTwin(drawHoneyCrate) },
    { y: BAGGER.y, f: drawBagger }, { y: PALLET.y, f: drawPallet }, { y: PLANT.y, f: drawPlant },
  ];
  for (const i of S.miners) list.push({ y: SPOTS[i].y, f: () => drawMiner(i) });
  for (const r of R) list.push({ y: r.y, f: () => drawRobot(r) });
  BUSHES.forEach((b, i) => list.push({ y: b.y, f: () => drawBushObj(i) }));
  // a shaker hugging a trunk is drawn after the tree crowns, so it stays in front of the trunk
  const onTrunk = h => h.kind === 'shaker' && h.st === 'shake' && h.target && h.target.type === 'tree';
  for (const h of HB) if (!onTrunk(h)) list.push({ y: h.y, f: () => h.kind === 'blower' ? drawBlower(h) : drawShaker(h) });
  list.sort((a, b) => a.y - b.y);
  for (const o of list) o.f();
  drawBees(V);   // RAINY HOLLOW: ants walk on the ground, under the tree crowns
  drawTruck();
  for (const l of leaves){ if (l.st === 'fall' && l.x > V.x0 && l.x < V.x1 && l.y > V.y0 && l.y < V.y1){ const fx = Math.cos(l.ph); drawLeaf(c, l.x, l.y, l.s, l.rot, l.ci, l.sh, Math.abs(fx) < 0.15 ? 0.15*Math.sign(fx || 1) : fx, 1, 1, fx < 0 ? 0.18 : 0); } }
  drawParts();
  TREES.forEach((t, i) => {
    const cc = canopyCvs[i]; if (!cc) return;
    if (t.x + t.r < V.x0 || t.x - t.r > V.x1 || t.y + t.r*1.3 < V.y0 || t.y - t.r > V.y1) return;
    const sh = treeShake[i], sway = reduceMotion ? 0 : Math.sin(S.t*0.7 + i*1.7)*0.012 + wind*0.0004 + (sh > 0 ? Math.sin(sh*26)*0.035*Math.min(1, sh) : 0);
    // canopies fade when a robot or miner is underneath, so nothing gets lost under a tree
    let under = R.some(r => Math.hypot(r.x - t.x, r.y - 30 - t.y) < t.r*0.92) || HB.some(h => !onTrunk(h) && Math.hypot(h.x - t.x, h.y - 24 - t.y) < t.r*0.92) || S.miners.some(m => Math.hypot(SPOTS[m].x - t.x, SPOTS[m].y - 30 - t.y) < t.r*0.92);
    if (!under && saleVisible()){ const sp = salePos(); under = Math.hypot(sp.x - t.x, sp.y - 40 - t.y) < t.r*0.95; }
    // the hive stands in front of the little corner tree, so that crown fades when it overlaps the tower
    if (!under && plantShown()){ const px = clamp(t.x, PLANT.x - 100, PLANT.x + 100), py = clamp(t.y, PLANT.y - 150, PLANT.y); under = Math.hypot(px - t.x, py - t.y) < t.r*0.8; }
    if (!under && S.hive.built){ const hx = clamp(t.x, HIVE.x - 22, HIVE.x + 22), hy = clamp(t.y, HIVE.y - hiveTopZ() - 20, HIVE.y - 14); under = Math.hypot(hx - t.x, hy - t.y) < t.r*0.85; }
    treeAlpha[i] = lerp(treeAlpha[i], under ? 0.42 : 0.96, 0.06);
    c.save(); c.translate(t.x, t.y + cc.base); c.rotate(sway); c.translate(0, -cc.base); c.globalAlpha = treeAlpha[i]; c.drawImage(cc.c, -cc.ox, -cc.oy, cc.w, cc.h); c.restore();
  });
  for (const h of HB) if (onTrunk(h)) drawShaker(h);
  if (!DBG.includes('norain')) drawRain();   // RAINY HOLLOW
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  for (const f of fgLeaves){ const fx = Math.cos(f.ph); drawLeaf(c, f.x, f.y, f.s, f.rot, f.ci, f.sh, Math.abs(fx) < 0.15 ? 0.15 : fx, 1, 0.92, fx < 0 ? 0.2 : 0); }
  c.drawImage(vignetteCv, 0, 0, W, H);
  if (!DBG.includes('nomist')) drawMist(); if (!DBG.includes('noglow')) drawGlows(); c.setTransform(DPR, 0, 0, DPR, 0, 0);   // RAINY HOLLOW
  drawBubbles();
  drawMarkers();
  drawHints();
  drawPops();
}

// ───────────────────────── HUD (cash only) + secret test money
let dispCash = 0, lastHud = '';
function updHud(dt){
  dispCash = Math.abs(S.cash - dispCash) < 0.005 ? S.cash : lerp(dispCash, S.cash, 1 - Math.pow(0.002, dt));
  const key = cash2(dispCash);
  if (key !== lastHud){ lastHud = key; $('vCash').textContent = key; }
  $('hCash').classList.toggle('bump', cashBumpT > 0);
  if (cashBumpT > 0) cashBumpT -= dt;
}
// Tap the cash 3 times within 2 seconds: +$1,000. Keep tapping: +$10,000, then +$100,000 per tap.
const cheat = { n: 0, first: 0, last: 0 };
$('hCash').addEventListener('pointerdown', e => {
  e.stopPropagation();
  const now = performance.now();
  if (now - cheat.last > 2000){ cheat.n = 0; cheat.first = now; }
  cheat.n++; cheat.last = now;
  if (cheat.n < 3) return;
  if (cheat.n === 3 && now - cheat.first > 2000){ cheat.n = 1; cheat.first = now; return; }
  const add = cheat.n === 3 ? 1000 : cheat.n === 4 ? 10000 : 100000;
  S.cash += add; cashBumpT = 0.25;
  sfx('coins', add);
  const tgt = s2w(130, 76);
  pop(tgt.x, tgt.y, '+' + cash2(add) + ' (test)', 'cash', 20);
  save();
});

// ───────────────────────── cards
// V10 UI rework: cards say less and show more. Numbers come with little pictures (a leaf, a chunk of metal, a jar),
// stock levels are meters, prices are coin buttons that fill up as you save toward them, and the long explanations
// moved into tooltips. Robots get a live portrait, and their task list sits on a tab of its own.
const card = $('card');
let cardOpen = null, cardSig = '', resetArm = false, cardNote = '', cardTab = 'up', fillT = 0;
// ── little pictures (12×12, centred on 0,0), in the yard's colours
const ICON = {
  // RAINY HOLLOW: icons for wet wood, dry bundles, mushrooms, ants and umbrellas replace the metal, honey and bee ones
  leaf:   '<path d="M0,-5 C3,-3.5 3,2.5 0,4 C-3,2.5 -3,-3.5 0,-5Z" fill="#c24a22"/><path d="M0,-3.6V4.6" stroke="#7a2a12" stroke-width=".8"/><ellipse cx="-1" cy="-1.6" rx=".6" ry="1.4" fill="#fff" opacity=".3"/>',
  seed:   '<rect x="-3.8" y="-5" width="7.6" height="10" rx=".8" fill="#efdfbd" stroke="#a8703a" stroke-width=".6"/><g fill="#8a5428"><circle cx="-1.4" cy="-2.4" r=".7"/><circle cx="1.2" cy="-1.6" r=".6"/><circle cx="-.4" cy=".2" r=".7"/><circle cx="1.6" cy="1.4" r=".5"/><circle cx="-1.6" cy="2.2" r=".6"/></g>',
  clover: '<path d="M-5,3.6 Q0,1.4 5,3.6 V5 H-5Z" fill="#5a3b26"/><g fill="#5d7a2e"><ellipse cx="-2.6" cy="2.6" rx="2" ry="1"/><ellipse cx="1.4" cy="2.2" rx="2.4" ry="1.1"/></g><path d="M-1,2 V-1.6 M2.4,1.8 V-.4" stroke="#efe6d2" stroke-width="1"/><path d="M-3.4,-1.2 A2.4,1.8 0 0 1 1.4,-1.2Z" fill="#c99448"/><path d="M.8,-.2 A1.6,1.3 0 0 1 4,-.2Z" fill="#c4281c"/>',
  press:  '<path d="M-5,4.6 Q-5,.4 0,.4 Q5,.4 5,4.6Z" fill="#4a3424"/><g fill="#c24a22"><ellipse cx="-2" cy="-.8" rx="1.6" ry=".8" transform="rotate(-20 -2 -.8)"/><ellipse cx="1.8" cy="-1.6" rx="1.5" ry=".7" transform="rotate(25 1.8 -1.6)"/></g><ellipse cx="0" cy="-3.4" rx="1.4" ry=".7" fill="#d6922e"/><path d="M-4,3 H4" stroke="#6a4a30" stroke-width=".6"/>',
  twin:   '<g transform="translate(-2.4,.6) scale(.62)"><path d="M-6,4 Q-5,-5 0,-5 Q5,-5 6,4Z" fill="#5a4128"/><path d="M-1.8,4 A1.8,2 0 0 1 1.8,4Z" fill="#ffb347"/></g><g transform="translate(2.6,-.4) scale(.62)"><path d="M-6,4 Q-5,-5 0,-5 Q5,-5 6,4Z" fill="#6e5236"/><path d="M-1.8,4 A1.8,2 0 0 1 1.8,4Z" fill="#ffb347"/></g>',
  ore:    '<rect x="-5" y="-2.6" width="8.6" height="5.4" rx="2.6" fill="#4c3828"/><ellipse cx="3.6" cy=".1" rx="1.8" ry="2.7" fill="#9a7448"/><ellipse cx="3.6" cy=".1" rx=".8" ry="1.3" fill="none" stroke="#5a3b24" stroke-width=".5"/><ellipse cx="-2" cy="-2.2" rx="1.8" ry=".6" fill="#5d7a2e"/><path d="M-4,-1.4 H1" stroke="#cfe0ec" stroke-width=".5" opacity=".6"/>',
  bag:    '<path d="M-1,-3.6 C-4.6,-3 -4.8,3.4 -3.4,4.2 Q0,5 3.4,4.2 C4.8,3.4 4.6,-3 1,-3.6Z" fill="#d4672a"/><ellipse cx="-1" cy="-4.6" rx="1.2" ry=".6" fill="#b8551c"/><ellipse cx="1" cy="-4.6" rx="1.2" ry=".6" fill="#b8551c"/>',
  jar:    '<path d="M-3.4,-3.6 A1.8,1.2 0 0 1 .2,-3.6Z M-.6,-3.8 A2,1.4 0 0 1 3.6,-3.8Z" fill="#a8642e"/><path d="M-4.8,-2.4 H4.8 L3.6,4.8 H-3.6Z" fill="#a7783f"/><path d="M-4.2,0 H4.2 M-3.9,2.4 H3.9 M-1.4,-2.4 V4.8 M1.4,-2.4 V4.8" stroke="#6e4a26" stroke-width=".45"/><rect x="-5" y="-3" width="10" height="1.2" rx=".5" fill="#c99556"/>',
  wrap:   '<path d="M-4.8,-2 H4.8 L3.6,4.8 H-3.6Z" fill="#a7783f"/><path d="M-5,-1.6 Q-5,-5 -2,-5 Q0,-4 2,-5 Q5,-5 5,-1.6Z" fill="#3f6a4a"/><path d="M-.6,-5 V4.8 H.6 V-5Z" fill="#e8eef4"/><ellipse cx="-1.6" cy="-4.4" rx="1.5" ry=".9" fill="#e8eef4"/><ellipse cx="1.6" cy="-4.4" rx="1.5" ry=".9" fill="#e8eef4"/>',
  gift:   '<path d="M-4.8,-2 H4.8 L3.6,4.8 H-3.6Z" fill="#a7783f"/><path d="M-5,-1.6 Q-5,-5 -2,-5 Q0,-4 2,-5 Q5,-5 5,-1.6Z" fill="#3f6a4a"/><path d="M-.6,-5 V4.8 H.6 V-5Z" fill="#2f6fb5"/><ellipse cx="-1.7" cy="-4.4" rx="1.6" ry="1" fill="#2f6fb5"/><ellipse cx="1.7" cy="-4.4" rx="1.6" ry="1" fill="#2f6fb5"/><circle cy="-4.3" r=".7" fill="#1f4f86"/>',
  ingot:  '<g fill="#c99a62"><path d="M-5,4 H-.4 L-1.2,.6 H-4.2Z"/><path d="M.4,4 H5 L4.2,.6 H1.2Z"/><path d="M-2.4,.4 H2.4 L1.6,-3 H-1.6Z"/></g><g fill="#e2bb84"><path d="M-4.4,3.4 H-1 L-1.6,1.2 H-3.8Z"/><path d="M1,3.4 H4.4 L3.8,1.2 H1.6Z"/><path d="M-1.8,-.2 H1.8 L1.2,-2.4 H-1.2Z"/></g><rect x="-.6" y="-3.6" width="1.2" height="7.8" fill="#c9b07a"/>',
  gold:   '<g fill="#c99a62"><path d="M-5,4 H-.4 L-1.2,.6 H-4.2Z"/><path d="M.4,4 H5 L4.2,.6 H1.2Z"/><path d="M-2.4,.4 H2.4 L1.6,-3 H-1.6Z"/></g><g fill="#e2bb84"><path d="M-4.4,3.4 H-1 L-1.6,1.2 H-3.8Z"/><path d="M1,3.4 H4.4 L3.8,1.2 H1.6Z"/><path d="M-1.8,-.2 H1.8 L1.2,-2.4 H-1.2Z"/></g><rect x="-.8" y="-3.6" width="1.6" height="7.8" fill="#f2c443"/><circle cy="-3.4" r=".9" fill="#c9922c"/>',
  basket: '<path d="M-3.4,-1.6 Q0,-6.8 3.4,-1.6" fill="none" stroke="#8a5a2e" stroke-width="1.1"/><path d="M-5,-1.6 H5 L3.8,4.6 H-3.8Z" fill="#c98f4c"/><path d="M-4.6,.6 H4.6 M-4.2,2.6 H4.2" stroke="#9a6532" stroke-width=".7"/><path d="M-1.8,-1.6 L-1.4,4.6 M1.8,-1.6 L1.4,4.6" stroke="#9a6532" stroke-width=".6"/><rect x="-5.5" y="-2.4" width="11" height="1.7" rx=".8" fill="#a8703a"/>',
  bee:    '<path d="M-1.6,1 L-3,4.6 M0,1.2 L0,4.8 M1.6,1 L3,4.6" stroke="#4a3226" stroke-width=".6" fill="none"/><ellipse cx="-2.8" cy="0" rx="2.6" ry="2" fill="#8a4f2a"/><ellipse cx="-3" cy="-.5" rx="2" ry="1.2" fill="#b86a38"/><ellipse cx=".3" cy="-.2" rx="1.2" ry="1" fill="#7a4424"/><ellipse cx="2.8" cy="-.6" rx="1.8" ry="1.6" fill="#9a5a30"/><circle cx="3.3" cy="-.7" r=".7" fill="#ffc457"/><path d="M3.4,-2 Q4.4,-4.4 5.6,-4.6 M2.8,-2.1 Q3.2,-4.6 4.2,-5.4" stroke="#4a3226" stroke-width=".5" fill="none"/>',
  nectar: '<path d="M-1,1 L-1.3,5 H1.3 L1,1Z" fill="#efe9dc"/><path d="M-4.6,1.4 A4.6,4.4 0 0 1 4.6,1.4Z" fill="#c4281c"/><g fill="#fbf6ea"><circle cx="-2" cy="-1.2" r=".7"/><circle cx="1" cy="-2.2" r=".6"/><circle cx="2.4" cy="-.2" r=".5"/></g>',
  honey:  '<g><path d="M-4.2,4.6 A2.6,2 0 0 1 .4,4.6Z" fill="#a8642e"/><path d="M-.4,4.6 A2.4,1.9 0 0 1 4.2,4.6Z" fill="#c99448"/><path d="M-2.6,1.4 A2.6,2 0 0 1 2.4,1.4Z" fill="#8a5428"/><path d="M-1.6,-1.6 A2.2,1.8 0 0 1 2.6,-1.6Z" fill="#e6a22a"/><path d="M-2.6,-4.2 A2,1.6 0 0 1 1.4,-4.2Z" fill="#c4281c"/></g>',
  truck:  '<rect x="-5.8" y="-3.8" width="7" height="5.6" rx=".8" fill="#c98f4c"/><path d="M-5.8,-1.6 H1.2" stroke="#a8703a" stroke-width=".6"/><path d="M1.6,-1.9 H3.9 L5.8,.4 V1.8 H1.6Z" fill="#5f8c87"/><path d="M2.4,-1.1 H3.6 L4.7,.3 H2.4Z" fill="#d6ecea"/><circle cx="-3.2" cy="2.6" r="1.7" fill="#3a2e22"/><circle cx="3.5" cy="2.6" r="1.7" fill="#3a2e22"/><circle cx="-3.2" cy="2.6" r=".6" fill="#c3cbd0"/><circle cx="3.5" cy="2.6" r=".6" fill="#c3cbd0"/>',
  clock:  '<circle r="5" fill="#fbf3e2" stroke="#7c5d47" stroke-width="1.2"/><path d="M0,-3 V0 L2,1.4" stroke="#4a3226" stroke-width="1.1" fill="none" stroke-linecap="round"/>',
  coin:   '<circle r="5.4" fill="#c9922c"/><circle r="4.4" fill="#e8b84e"/><circle r="3" fill="none" stroke="#c9922c" stroke-width=".8"/><path d="M-2.4,-1.9 A3,3 0 0 1 .5,-2.9" stroke="#fbe3a0" stroke-width=".9" fill="none" stroke-linecap="round"/>',
  wheel:  '<circle r="5.3" fill="#3f3730"/><circle r="3.3" fill="#d4672a"/><circle r="1.1" fill="#fbf3e2"/><path d="M0,-5.3 V-4 M0,5.3 V4 M-5.3,0 H-4 M5.3,0 H4 M-3.75,-3.75 L-2.85,-2.85 M3.75,3.75 L2.85,2.85 M3.75,-3.75 L2.85,-2.85 M-3.75,3.75 L-2.85,2.85" stroke="#7a6d62" stroke-width="1"/>',
  pick:   '<path d="M0,5.4 V.6" stroke="#7d868c" stroke-width="1.8" stroke-linecap="round"/><path d="M0,.4 C-3.8,-.2 -4.2,-3.4 -2.4,-5.2 M0,.4 C3.8,-.2 4.2,-3.4 2.4,-5.2" stroke="#d4672a" stroke-width="1.5" fill="none" stroke-linecap="round"/><circle cy=".4" r="1.5" fill="#4a423b"/><path d="M-5.6,3 H-3.6 M-5.6,4.8 H-3" stroke="#a08670" stroke-width=".8" stroke-linecap="round"/>',
  claw:   '<path d="M0,5.6 V-.4" stroke="#8a6040" stroke-width="1.5" stroke-linecap="round"/><path d="M-4.4,-.4 H4.4" stroke="#7d868c" stroke-width="1.5" stroke-linecap="round"/><path d="M-4.4,-.4 C-4.6,-2.6 -4.2,-3.8 -3.6,-4.8 M-1.5,-.4 V-5.2 M1.5,-.4 V-5.2 M4.4,-.4 C4.6,-2.6 4.2,-3.8 3.6,-4.8" stroke="#7d868c" stroke-width="1.1" stroke-linecap="round" fill="none"/>',
  reach:  '<path d="M-5,4.6 L-1.6,1.2" stroke="#6d777d" stroke-width="2.4" stroke-linecap="round"/><path d="M-1.6,1.2 L1.6,-2" stroke="#a8b1b6" stroke-width="1.6" stroke-linecap="round"/><path d="M1,-4.4 L3.6,-1.8 M2.2,-5.4 L4.8,-2.8" stroke="#d4672a" stroke-width="1.2" stroke-linecap="round"/>',
  drill:  '<path d="M-5,2 Q0,-6 5,2" stroke="#7a5236" stroke-width="1.2" fill="none"/><rect x="-5" y="1.4" width="10" height="1.4" fill="#b9c2c6"/><path d="M-4.4,2.8 L-3.8,4 L-3.2,2.8 M-2.2,2.8 L-1.6,4 L-1,2.8 M0,2.8 L.6,4 L1.2,2.8 M2.2,2.8 L2.8,4 L3.4,2.8" stroke="#6c7378" stroke-width=".6" fill="none"/>',
  magnet: '<path d="M-1.6,-5 H1.6 L.6,4.6 H-.6Z" fill="#8f979b"/><path d="M-1.6,-5 H1.6 V-3.4 H-1.6Z" fill="#c3cbd0"/><path d="M-5,4.6 H-1 M1,4.6 H5" stroke="#9a7448" stroke-width="2"/><path d="M-1,-1 L-3.6,-3 M1,-1 L3.6,-3" stroke="#e6c48a" stroke-width=".7"/>',
  pack:   '<rect x="-4.8" y="-3.4" width="9.6" height="8" rx=".8" fill="#c98f4c"/><path d="M-4.8,-.8 H4.8" stroke="#a8703a" stroke-width=".6"/><rect x="-1.1" y="-3.4" width="2.2" height="8" fill="#efdcbc"/><path d="M-3.6,-5.2 L0,-3.4 L3.6,-5.2" stroke="#a8703a" stroke-width=".8" fill="none"/>',
  blow:   '<path d="M-5,-2 Q0,-4.5 3,-2 M-5,1 Q1,-1.5 5,1 M-4,4 Q0,2 3,4" stroke="#4f7c84" stroke-width="1.3" fill="none" stroke-linecap="round"/>',
  shake:  '<circle cx="0" cy="-1.5" r="3.8" fill="#c96a22"/><path d="M0,2.3V5.4" stroke="#6e4a30" stroke-width="1.4"/><path d="M-5.6,-3 l1,1.5 M5.6,-3 l-1,1.5" stroke="#6f7d3c" stroke-width="1" stroke-linecap="round"/>',
  snip:   '<circle cx="-2.6" cy="3.1" r="1.8" fill="none" stroke="#6d777d" stroke-width="1.1"/><circle cx="2.6" cy="3.1" r="1.8" fill="none" stroke="#6d777d" stroke-width="1.1"/><path d="M-1.6,1.6 L2.6,-4.4 M1.6,1.6 L-2.6,-4.4" stroke="#8f979b" stroke-width="1.2"/><path d="M-5,-2 A1.4,1 0 0 1 -2.2,-2Z" fill="#c99448"/>',
  flower: '<path d="M-1,1 L-1.3,5 H1.3 L1,1Z" fill="#efe9dc"/><path d="M-4.6,1.4 A4.6,4.4 0 0 1 4.6,1.4Z" fill="#8a5428"/><ellipse cx="-1.6" cy="-1" rx="1.2" ry=".5" fill="#fff" opacity=".35"/>',
  dig:    '<path d="M-5.2,3.6 Q0,1.4 5.2,3.6" stroke="#4c3828" stroke-width="2.4" fill="none"/><path d="M-3,0 Q-1.6,-2.4 0,-1 Q1.4,.4 2.8,-1.8 M-2,-2.6 Q-.6,-5 1,-3.6 Q2.4,-2.2 3.8,-4.4" stroke="#cfdbe4" stroke-width=".8" fill="none" stroke-linecap="round"/>',
  stoke:  '<path d="M-5,-1 L1,-3.4 L1,1.4 Z" fill="#8a6040"/><rect x="1.4" y="-2" width="4.2" height="6" rx=".8" fill="#2f2a26"/><rect x="2.4" y="-.4" width="2.2" height="2.4" fill="#ff9b3d"/>',
  flame:  '<rect x="-4.2" y="-2.4" width="8.4" height="6.6" rx="1" fill="#2f2a26"/><rect x="-2.6" y="-.8" width="5.2" height="3.6" rx=".8" fill="#ff9b3d"/><path d="M2,-2.4 V-5" stroke="#2f2a26" stroke-width="1.4"/><circle cx="2.6" cy="-5.4" r="1" fill="#9aa4aa" opacity=".6"/>',
  haul:   '<circle cx="-2.8" cy="4" r="1.2" fill="#4a423b"/><circle cx="2.8" cy="4" r="1.2" fill="#4a423b"/><path d="M-5,3 H5 L4,0 H-4Z" fill="#6e4a30"/><g fill="#e2bb84"><rect x="-3.6" y="-2.4" width="2.8" height="2.4" rx=".4"/><rect x="-.2" y="-2.4" width="2.8" height="2.4" rx=".4"/><rect x="-1.9" y="-4.6" width="2.8" height="2.4" rx=".4"/></g>',
  lock:   '<path d="M-2.5,-.6 V-2.2 A2.5,2.5 0 0 1 2.5,-2.2 V-.6" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="-4" y="-.8" width="8" height="6" rx="1.3" fill="currentColor"/><circle cy="1.7" r=".9" fill="#fbf3e2"/>',
  check:  '<path d="M-3.8,.2 L-1.1,2.9 L4,-2.8" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  robot:  '<path d="M0,-3.8 V-5.2" stroke="#4a423b" stroke-width=".8"/><circle cy="-5.5" r=".95" fill="#d4672a"/><rect x="-4.6" y="-4" width="9.2" height="6.8" rx="2" fill="#e0d4b8" stroke="#a39376" stroke-width=".6"/><rect x="-4.6" y="-.3" width="9.2" height="1.5" fill="#5f8f88"/><circle cx="1.4" cy="-2" r="1.3" fill="#3a2e22"/><circle cx="1.6" cy="-2.2" r=".5" fill="#ffb347"/><rect x="-4.2" y="3" width="8.4" height="2.5" rx="1.1" fill="#4a423b"/>',
  tub:    '<path d="M-5.6,-3 H5.6 L4.6,-5 H-4.6Z" fill="#4a3a30"/><rect x="-4.6" y="-3" width="9.2" height="8" fill="#2a1f17"/><g fill="#8a6642"><circle cx="-2.4" cy="3" r="1.4"/><circle cx=".4" cy="3" r="1.4"/><circle cx="3" cy="3" r="1.3"/><circle cx="-1" cy=".4" r="1.4"/><circle cx="1.8" cy=".4" r="1.3"/></g><path d="M-4.8,4.6 H4.8 M-4.8,-2.8 H4.8" stroke="#7a5434" stroke-width="1"/>',
  bin:    '<rect x="-5" y="-2" width="10" height="6.8" rx=".6" fill="#a8703a"/><path d="M-5,.3 H5 M-5,2.6 H5" stroke="#8a5a2e" stroke-width=".6"/><path d="M-4.2,-2 C-3.4,-4.8 -1.2,-4.4 -.2,-2.8 C.8,-5 3.2,-4.6 4.2,-2Z" fill="#d4672a"/>',
  hopper: '<path d="M-5.4,-3 Q0,-6 5.4,-3 L4.6,-2 Q0,-4.6 -4.6,-2Z" fill="#3f6a4a"/><g fill="#5e4430"><circle cx="-2.6" cy="2.6" r="1.6"/><circle cx=".6" cy="2.6" r="1.6"/><circle cx="3.6" cy="2.8" r="1.4"/><circle cx="-1" cy="-.2" r="1.6"/><circle cx="2.2" cy="-.2" r="1.5"/></g><g fill="#2e2016"><circle cx="-2.6" cy="2.6" r=".5"/><circle cx=".6" cy="2.6" r=".5"/><circle cx="-1" cy="-.2" r=".5"/></g>',
  pallet: '<path d="M-6,-2.4 H6 L5,-5 H-5Z" fill="#3d332c"/><rect x="-5" y="-2.4" width="10" height="7" fill="#5e4632"/><g fill="#e2bb84"><rect x="-4" y="1.6" width="2.6" height="2.4" rx=".3"/><rect x="-1.2" y="1.6" width="2.6" height="2.4" rx=".3"/><rect x="1.6" y="1.6" width="2.6" height="2.4" rx=".3"/><rect x="-2.6" y="-1" width="2.6" height="2.4" rx=".3"/></g>',
  fan:    '<g fill="#4f7c84"><path d="M0,0 C-1.2,-3 .8,-5.6 2.6,-4.4 C3.4,-3.2 1.6,-1 0,0Z"/><path d="M0,0 C-1.2,-3 .8,-5.6 2.6,-4.4 C3.4,-3.2 1.6,-1 0,0Z" transform="rotate(120)"/><path d="M0,0 C-1.2,-3 .8,-5.6 2.6,-4.4 C3.4,-3.2 1.6,-1 0,0Z" transform="rotate(240)"/></g><circle r="1.2" fill="#3a2e22"/>',
  wings:  '<path d="M-3,1 L-5,4.6 M-1,1.2 L-1.6,5 M1.2,1.2 L1.8,5" stroke="#4a3226" stroke-width=".8"/><path d="M-3.2,1 L-5.4,-1 M1,1 L3.6,-.2" stroke="#4a3226" stroke-width=".8"/><ellipse cx="-1" cy="-.4" rx="3.2" ry="1.8" fill="#b86a38"/><path d="M2.6,-4.6 H5.4 M3.4,-3 H5.6 M2.8,-1.4 H5" stroke="#4f7c84" stroke-width=".7" stroke-linecap="round"/>',
  three:  '<g fill="#efe9dc"><rect x="-4.3" y="0" width="1" height="3.6"/><rect x="-.5" y="-1.4" width="1" height="4.4"/><rect x="3.3" y="0" width="1" height="3.6"/></g><path d="M-5.8,.4 A2,1.6 0 0 1 -2.2,.4Z" fill="#c4281c"/><path d="M-2,-1 A2,1.7 0 0 1 2,-1Z" fill="#e6a22a"/><path d="M2.2,.4 A2,1.6 0 0 1 5.8,.4Z" fill="#8a5428"/>',
  tongue: '<ellipse cx="-1.4" cy="0" rx="2.6" ry="2.4" fill="#a84a2a"/><circle cx="-.6" cy="-.6" r=".8" fill="#ffc457"/><path d="M1,-1.4 Q4,-2.4 5,-.4 L3.6,0 Q3.2,-1.2 1.2,-.6Z M1,1.4 Q4,2.4 5,.4 L3.6,0 Q3.2,1.2 1.2,.6Z" fill="#c9a24a"/>',
  recipe: '<rect x="-4.6" y="-1" width="9.2" height="5.6" rx="1" fill="#a7783f"/><path d="M-4.6,1.6 H4.6 M-1.6,-1 V4.6 M1.6,-1 V4.6" stroke="#6e4a26" stroke-width=".5"/><path d="M-3.8,-1.2 A1.6,1.2 0 0 1 -.6,-1.2Z" fill="#c99448"/><path d="M.6,-1.2 A1.6,1.2 0 0 1 3.8,-1.2Z" fill="#e6a22a"/><path d="M-2,-3.6 A1.6,1.2 0 0 1 1.2,-3.6Z" fill="#8a5428"/>',
  nursery: '<ellipse cx="-1.8" cy="1.4" rx="2" ry="2.8" fill="#f4ecd8" stroke="#c9b48c" stroke-width=".5"/><ellipse cx="2" cy="1.8" rx="1.8" ry="2.5" fill="#f4ecd8" stroke="#c9b48c" stroke-width=".5"/><ellipse cx=".2" cy="-2.4" rx="1.6" ry="2.2" fill="#f4ecd8" stroke="#c9b48c" stroke-width=".5"/><circle cx="-2.4" cy=".4" r=".6" fill="#ffc457"/>',
  oil:    '<path d="M-4.8,-.8 H1.4 V4.8 H-4.8Z" fill="#c4452f"/><path d="M1.4,.4 L5.2,-3.2" stroke="#7d868c" stroke-width="1.3" stroke-linecap="round"/><path d="M-3.4,-.8 V-2.8 H-.8 V-.8" fill="none" stroke="#7d868c" stroke-width="1"/><path d="M5,-1.8 C5.7,-.8 5.5,.2 4.9,.2 C4.3,.2 4.3,-.8 5,-1.8Z" fill="#c9a13a"/>',
  blueprint:'<rect x="-5" y="-4" width="10" height="8" rx=".6" fill="#3f6f8f"/><path d="M-3.4,-2 H1 M-3.4,0 H3.4 M-3.4,2 H.4" stroke="#cfe3ef" stroke-width=".7"/><circle cx="2.6" cy="-1.8" r="1.2" fill="none" stroke="#cfe3ef" stroke-width=".7"/>',
  drop:   '<path d="M0,-5 C2.6,-1.6 3.8,.6 3.8,2 A3.8,3.8 0 0 1 -3.8,2 C-3.8,.6 -2.6,-1.6 0,-5Z" fill="#6a8a3a"/><path d="M-1.6,1 A1.6,1.6 0 0 0 0,3" stroke="#d6e8b0" stroke-width=".8" fill="none"/>',
  market: '<path d="M-5.2,-1 L-4,-4.8 H4 L5.2,-1Z" fill="#fbf3e2"/><path d="M-2.6,-4.8 L-3.1,-1 M0,-4.8 V-1 M2.6,-4.8 L3.1,-1" stroke="#c4452f" stroke-width="1.5"/><rect x="-4.6" y="-1" width="1" height="5.8" fill="#8a5a2e"/><rect x="3.6" y="-1" width="1" height="5.8" fill="#8a5a2e"/><rect x="-3.6" y="1.4" width="7.2" height="1.8" fill="#a8703a"/>',
  horseshoe: '<path d="M-4,4.6 L2.4,-3.4" stroke="#7a5236" stroke-width="1.4" stroke-linecap="round"/><path d="M.6,-5.4 Q5,-5.6 5.4,-1.2 L2.6,-1.6 Q2.4,-3.4 .4,-3.2Z" fill="#9aa4aa"/><path d="M2.6,-1.6 L5.4,-1.2" stroke="#e6ecef" stroke-width=".5"/><circle cx="-3.6" cy="-2.6" r="1.2" fill="#5d7a2e"/><path d="M-3.6,-3.8 V-1.4 M-4.8,-2.6 H-2.4" stroke="#8ab04a" stroke-width=".5"/>',
  land:   '<path d="M-5.4,-1.6 H5.4 M-5.4,2 H5.4" stroke="#8a5a2e" stroke-width="1.1"/><path d="M-4.6,-4.6 L-3.8,-5.4 L-3,-4.6 V5 H-4.6Z M-.8,-4.6 L0,-5.4 L.8,-4.6 V5 H-.8Z M3,-4.6 L3.8,-5.4 L4.6,-4.6 V5 H3Z" fill="#c98f4c"/>',
  vein:   '<g><rect x="-5.4" y="1" width="8" height="3.6" rx="1.8" fill="#3a2a1e"/><ellipse cx="2.6" cy="2.8" rx="1.2" ry="1.8" fill="#8e6a44"/><rect x="-3.6" y="-2.2" width="7.6" height="3.4" rx="1.7" fill="#4c3828"/><ellipse cx="4" cy="-.5" rx="1.1" ry="1.7" fill="#8e6a44"/><rect x="-4.2" y="-5" width="6" height="3" rx="1.5" fill="#3a2a1e"/><ellipse cx="1.8" cy="-3.5" rx="1" ry="1.5" fill="#8e6a44"/><ellipse cx="-2" cy="-1.8" rx="1.6" ry=".5" fill="#5d7a2e"/></g>',
  shaft:  '<path d="M-6,-2 L5.6,-4.4 L6,-2.8 L-5.6,-.4Z" fill="#3d332c"/><path d="M-4.6,-1 V5 M4.4,-3 V5" stroke="#5a3b26" stroke-width="1.2"/><g fill="#4c3828"><rect x="-3.4" y="2.4" width="6" height="2.4" rx="1.2"/><rect x="-2.6" y=".2" width="5" height="2.2" rx="1.1"/></g><ellipse cx="2.6" cy="3.6" rx=".7" ry="1.1" fill="#8e6a44"/>',
  note:   '<path d="M-1.2,3 V-4 L4,-5 V2" stroke="#4a3226" stroke-width="1.1" fill="none"/><ellipse cx="-2.6" cy="3.2" rx="1.8" ry="1.3" fill="#4a3226"/><ellipse cx="2.6" cy="2.2" rx="1.8" ry="1.3" fill="#4a3226"/>',
  wrench: '<path d="M-4.4,4.4 L1,-1" stroke="#7d868c" stroke-width="2" stroke-linecap="round"/><path d="M1.2,-4.8 A3,3 0 1 0 4.8,-1.2 L3,-.8 L.8,-3Z" fill="#7d868c"/>',
  list:   '<path d="M-1.6,-3.4 H5 M-1.6,0 H5 M-1.6,3.4 H5" stroke="#7c5d47" stroke-width="1.3" stroke-linecap="round"/><circle cx="-4.2" cy="-3.4" r="1.1" fill="#d4672a"/><circle cx="-4.2" cy="0" r="1.1" fill="#d4672a"/><circle cx="-4.2" cy="3.4" r="1.1" fill="#d4672a"/>',
  cleanup:'<circle r="5.2" fill="#6f8a3a"/><circle r="4" fill="none" stroke="#c9dca0" stroke-width=".6" stroke-dasharray="1 1"/><path d="M0,-3 C2,-2 2,1.6 0,2.6 C-2,1.6 -2,-2 0,-3Z" fill="#f6ead4"/>',
  slag:   '<g stroke="#c99a62" stroke-width="1.1" stroke-linecap="round"><path d="M-4.6,4 L-1.4,-2.6"/><path d="M-2,4.4 L.6,-3.4"/><path d="M1,4.4 L2.2,-2.6"/><path d="M3.6,4 L4.4,-1.6"/></g><path d="M-.6,4.2 Q-1,1 0,-1 Q1,1.4 .6,4.2Z" fill="#ff9b3d"/>',
  sound:  '<path d="M-5,-2 H-2.4 L1,-4.8 V4.8 L-2.4,2 H-5Z" fill="#4a3226"/><path d="M3,-2.4 A3.4,3.4 0 0 1 3,2.4" stroke="#4a3226" stroke-width="1.2" fill="none" stroke-linecap="round"/>',
  brolly: '<path d="M0,-1 V3.6 Q0,5 -1.4,5 Q-2.4,5 -2.4,4" stroke="#6e4a30" stroke-width="1" fill="none" stroke-linecap="round"/><path d="M-5.6,-.4 Q-5.4,-5.6 0,-5.6 Q5.4,-5.6 5.6,-.4 Q4.6,-1.4 3.8,-.4 Q2.8,-1.6 1.8,-.4 Q.9,-1.6 0,-.4 Q-.9,-1.6 -1.8,-.4 Q-2.8,-1.6 -3.8,-.4 Q-4.6,-1.4 -5.6,-.4Z" fill="#3f6a8a"/><path d="M0,-5.6 Q-1.6,-3 -1.8,-.4 M0,-5.6 Q1.6,-3 1.8,-.4" stroke="#7a5236" stroke-width=".45" fill="none"/>',
  wet: '<path d="M0,-5 C2.6,-1.6 3.8,.6 3.8,2 A3.8,3.8 0 0 1 -3.8,2 C-3.8,.6 -2.6,-1.6 0,-5Z" fill="#6aa4d0"/><path d="M-1.6,1 A1.6,1.6 0 0 0 0,3" stroke="#e6f2fa" stroke-width=".8" fill="none"/>',
};
ICON.mine = ICON.ore; ICON.leaves = ICON.leaf; ICON.smelt = ICON.flame; ICON.speed = ICON.wheel; ICON.carry = ICON.basket;
ICON.grab = ICON.claw; ICON.metal = ICON.ore; ICON.workshop = ICON.wrench;
const ic = (n, cls) => '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="-6 -6 12 12" aria-hidden="true">' + (ICON[n] || '') + '</svg>';
// an item with a little coin on it: "what this sells for"
const icp = n => '<svg class="ic" viewBox="-6 -6 12 12" aria-hidden="true">' + ICON[n] + '<g transform="translate(3,3.2) scale(.5)">' + ICON.coin + '</g></svg>';
ICON.all = '<g transform="translate(-2.3,1) scale(.72)">' + ICON.robot + '</g><g transform="translate(2.4,-.6) scale(.72)">' + ICON.robot + '</g>';

// ── numbers: short prices on buttons ("1,100", "9.9k"), and money with cents only where cents matter
function pr(v){
  if (v >= 1e6) return (v/1e6).toFixed(v < 1e7 ? 2 : 1).replace(/\.?0+$/, '') + 'M';
  if (v >= 1e4) return (v/1e3).toFixed(v < 1e5 ? 1 : 0).replace(/\.0$/, '') + 'k';
  if (v >= 100) return Math.round(v).toLocaleString('en-US');
  if (Math.abs(v - Math.round(v)) < 0.005) return String(Math.round(v));
  return v.toFixed(2);
}
const cash$ = v => '$' + (v < 100 ? v.toFixed(2) : pr(v));
const num = v => v >= 1e4 ? pr(v) : String(Math.floor(v));
const aff$ = c => S.cash + 1e-9 >= c;
const pfill = c => Math.min(1, Math.max(0, S.cash/c)).toFixed(3);

// ── building blocks
// a coin button; when you can't afford it yet it fills up from the left as you save toward it
const attr = t => String(t).replace(/<[^>]+>/g, '').replace(/"/g, '&quot;');
function coinBtn(act, cost, opts){
  opts = opts || {};
  const a = aff$(cost);
  return '<button class="buy' + (opts.cls ? ' ' + opts.cls : '') + '" data-act="' + act + '" data-cost="' + cost + '" aria-disabled="' + !a + '" style="--p:' + pfill(cost) + '"' +
    (opts.tip ? ' title="' + attr(opts.tip) + '"' : '') + ' aria-label="' + attr(opts.label || 'Buy') + ', ' + cash$(cost) + '">' +
    (opts.pre || '') + ic('coin', 'cn') + '<span>' + pr(cost) + '</span>' + (opts.sticker ? '<i class="stk">' + opts.sticker + '</i>' : '') + '</button>';
}
const stamp = (t, cls) => '<span class="stamp' + (cls ? ' ' + cls : '') + '">' + t + '</span>';
// level pips as little hex nuts, grouped by tier; tiers that aren't unlocked yet are drawn faint
function nuts(l, groups){
  let h = '<span class="pips" aria-label="level ' + l + '">', acc = 0;
  for (const g of groups){ h += '<span class="pg' + (g.lk ? ' lk' : '') + '">'; for (let j=0;j<g.n;j++) h += '<i' + (acc + j < l ? ' class="on"' : '') + '></i>'; h += '</span>'; acc += g.n; }
  return h + '</span>';
}
function upGroups(k){ const u = UP[k]; if (!u.gaps) return [{ n: u.max }]; let left = u.max; const out = []; for (const g of u.gaps){ out.push({ n: g.n }); left -= g.n; } if (left > 0) out.push({ n: left }); return out; }
function trackGroups(k){ const cap = trackCap(k), out = []; let acc = 0; for (const g of TRACKS[k].gens){ if (!g.n) continue; out.push({ n: g.n, lk: acc >= cap }); acc += g.n; } return out; }
// a meter: icon, a little bar, and have/room (turns warm red when full)
function meter(icon, have, cap, tip, cls){
  const f = cap > 0 ? clamp(have/cap, 0, 1) : 0;
  return '<span class="mt' + (f >= 1 ? ' full' : '') + (cls ? ' ' + cls : '') + '"' + (tip ? ' title="' + tip + '"' : '') + '>' + ic(icon) + '<span class="bar"><i style="width:' + (f*100).toFixed(1) + '%"></i></span><span class="mv"><b>' + num(have) + '</b>/' + num(cap) + '</span></span>';
}
// work spots at a station: one light per spot, lit while someone's working there
const slots = (icon, busy, n, tip) => { let h = '<span class="slots" title="' + tip + '">' + ic(icon); for (let j=0;j<n;j++) h += '<i' + (j < busy ? ' class="on"' : '') + '></i>'; return h + '</span>'; };
// one row of a card: picture, name (+ pips), value line, and the buttons on the right
function row(o){
  return '<div class="row' + (o.cls ? ' ' + o.cls : '') + '">' + (o.icon ? '<div class="ri">' + o.icon + '</div>' : '') +
    '<div class="rm"><div class="n"' + (o.tip ? ' title="' + o.tip + '"' : '') + '>' + o.name + (o.pips || '') + (o.unl || '') + '</div>' + (o.val ? '<div class="v">' + o.val + '</div>' : '') + '</div>' +
    '<div class="btn">' + (o.btn || '') + '</div></div>';
}
const arrow = '<span class="to">→</span>';
const fromTo = (a, b, unit, maxed) => maxed ? '<b>' + a + '</b>' + (unit || '') : a + arrow + '<b>' + b + '</b>' + (unit || '');

function visibleTasks(kind, cfg){ return KIND_TASKS[kind].filter(t => taskOpen(t, cfg)); }
// ── yard upgrades (bin, truck, hive, plant): short names, a picture, and the value as number + unit picture
const UP_ICON = { bin:ic('bin'), leafPrice:icp('leaf'), bagPrice:icp('bag'), metalPrice:icp('ore'), metalBin:ic('tub'), truck:ic('truck'), cleanup:ic('cleanup'),
  hiveTank:ic('nectar'), hiveStore:ic('honey'), honeyPrice:icp('jar'), giftPrice:icp('gift'), smeltSpeed:ic('flame'), ingotGrade:icp('gold'), slag:ic('slag'), hopper:ic('hopper') };
const UP_SHORT = { truck:'More pickups', hiveTank:'Larder', hiveStore:'Sorting chambers', honeyPrice:'Gourmet labels', giftPrice:'Gift ribbons', hopper:'Wet stack', metalBin:'Log crib' };
const UP_TIP = {
  bin:'How many loose leaves the bin holds before robots have to wait', leafPrice:'What the truck pays for a loose leaf', bagPrice:'What the truck pays for a bag of ' + BAG_SIZE + ' leaves',
  metalPrice:'What the truck pays for a wet log (a dry bundle is worth 4 logs × its seasoning)', metalBin:'How much wet wood the crib holds. A bigger crib also makes the woodshed by the road bigger',
  truck:'How often the truck comes by', cleanup:'A one-off deal: the truck pays a bonus for every 100 leaves it takes (bagged leaves count too)',
  hiveTank:'Fresh mushrooms the larder can hold. Every second larder or chamber step adds a chamber, and each chamber sorts mushrooms', hiveStore:'Punnets’ worth of sorted mushrooms the ant hill and crate can hold',
  honeyPrice:'What the truck pays for a punnet of mushrooms', giftPrice:'What the truck pays for a gift basket', smeltSpeed:'How hot the stoves burn: every dryer is faster',
  ingotGrade:'What a dry bundle sells for', slag:'Extra bundles from the offcuts', hopper:'Wet wood waiting at the shed for the dryers' };
const UP_VAL = {
  bin: v => [v, ic('leaf')], leafPrice: v => [cash$(v*sellMul()), ''], bagPrice: v => [cash$(BAG_SIZE*val('leafPrice')*v*sellMul()), ''],
  metalPrice: v => [cash$(v*sellMul()), ''], metalBin: v => [v, ic('ore')], truck: v => [v + 's', ''], cleanup: v => [v ? '$' + v : '–', v ? '<small>/100</small>' + ic('leaf') : ''],
  hiveTank: v => [v, ic('nectar')], hiveStore: v => [v, ic('jar')], honeyPrice: v => [cash$(v*sellMul()), ''], giftPrice: v => [cash$(val('honeyPrice')*v*sellMul()), ''],
  smeltSpeed: v => [v.toFixed(2) + '×', ''], ingotGrade: v => [cash$(ORE_PER_INGOT*val('metalPrice')*v*sellMul()), ''], slag: v => [v ? '+' + Math.round(v*100) + '%' : '0%', ic('ingot')], hopper: v => [v, ic('ore')],
};
function upRow(k, extra){
  const u = UP[k], l = S.lv[k], maxed = l >= u.max, cost = maxed ? 0 : upCost(k);
  const a = UP_VAL[k](u.val(l)), b = maxed ? a : UP_VAL[k](u.val(l + 1));
  const val = fromTo(a[0], b[0], a[1], maxed) + (extra || '');
  return { sig: k + l + (maxed ? 'M' : aff$(cost)) + val, html: row({ icon: UP_ICON[k], name: UP_SHORT[k] || upName(k), tip: (typeof u.name === 'function' ? upName(k) + ': ' : '') + UP_TIP[k], pips: nuts(l, upGroups(k)), val,
    btn: maxed ? stamp('max') : coinBtn('up:' + k, cost, { label: upName(k) }) }) };
}
const xt = (h, tip) => ' <span class="xt"' + (tip ? ' title="' + tip + '"' : '') + '>' + h + '</span>';

// ── robot upgrade tracks
const TRACK_ICON = { speed:'wheel', carry:'basket', pick:'pick', grab:'claw', reach:'reach', drill:'drill', magnet:'magnet', pack:'pack', blow:'blow', shake:'shake', snip:'snip', dig:'dig', stoke:'stoke', brolly:'brolly' };
const TRACK_TIP = { speed:'How fast it drives', carry:'How much it carries in one trip', pick:'How long one grab takes', grab:'Leaves in one grab', reach:'How far the arm reaches',
  drill:'Seconds for a log of wet wood', magnet:'Chance a log splits into two', pack:'How fast it bags leaves, fills and wraps punnets, and dries', blow:'How hard it blows (range, push and glide)',
  shake:'Leaves a big tree drops when shaken (a bush gives a third)', snip:'Lets it trim cut mushroom patches so they grow back sooner for the ants', dig:'Faster sawing at a shelter while it dries the pile', stoke:'Faster drying while it works the bellows', brolly:'Lets it hold the big wood umbrella over a robot hauling dry wood, so none of it gets wet on the way' };
const TRACK_VAL = {
  speed: v => [v.toFixed(2) + '×', ''], carry: v => [v, ic('leaf')], pick: v => [v.toFixed(2) + 's', ''], grab: v => [v, ic('leaf')], reach: v => [v, '<small>cm</small>'],
  drill: v => [v.toFixed(1) + 's', '<small>/</small>' + ic('ore')], magnet: v => [Math.round(v*100) + '%', '<small>×2</small>'], pack: v => [v.toFixed(2) + '×', ''],
  blow: v => [v.toFixed(2) + '×', ''], shake: v => [v, ic('leaf')], snip: v => [v ? 'yes' : 'no', ''], dig: v => ['+' + Math.round(v*100) + '%', ''], stoke: v => ['+' + Math.round(v*100) + '%', ''],
  brolly: v => [v ? 'yes' : 'no', ''],
};
function robotRow(ri, k, kind){
  kind = kind || 'robot';
  const T = TRACKS[k], L = cfgsOf(kind)[ri].lv[k], cap = trackCap(k), max = trackMax(k), maxed = L >= max, locked = !maxed && L >= cap;
  const a = TRACK_VAL[k](T.vals[L]), b = maxed || locked ? a : TRACK_VAL[k](T.vals[L + 1]);
  let val = fromTo(a[0], b[0], a[1], maxed || locked), btn = '', sig = '';
  if (k === 'carry' && S.metalSlot){ const m0 = 2 + Math.floor(L/2), m1 = maxed || locked ? m0 : 2 + Math.floor((L + 1)/2); val += xt((m1 !== m0 ? m0 + arrow + '<b>' + m1 + '</b>' : '<b>' + m0 + '</b>') + ic('ore'), 'Wet wood it carries'); }
  // smelting speed comes from Packing and Drill together, so show it on both rows once the plant is up
  if (kind === 'robot' && S.plant.built && (k === 'pack' || k === 'drill')){ val += xt(ic('flame') + smeltSkill(ri).toFixed(1) + '×', 'Drying speed (Packing × Saw)'); sig += smeltSkill(ri).toFixed(2); }
  if (maxed){ btn = stamp('max'); sig += 'max'; }
  else if (locked){ btn = nextUnlock(k) ? '' : '<span class="lk-ic" title="More levels unlock later">' + ic('lock') + '</span>'; sig += 'lock' + L; }
  else {
    const c = botCost(kind, ri, k);
    btn = coinBtn('rup:' + k, c.cost, { label: T.label, sticker: c.disc ? '−' + Math.round((1 - discFor(k))*100) + '%' : '', tip: c.disc ? 'Another robot already has this level, so it’s cheaper (full price ' + cash$(c.full) + ')' : '' });
    sig += L + '' + aff$(c.cost) + c.disc;
  }
  const ap = allPlan(k);
  if (ap){
    const n = peersFor(k).length, nd = NO_DISCOUNT.includes(k);
    const tip = ap.catchUp ? 'Bring ' + (ap.behind === 1 ? 'the robot that is behind' : 'the ' + ap.behind + ' robots that are behind') + ' up to level ' + ap.target + (nd ? ' (full price)' : ' (copied levels, so discounted)')
                           : 'Give all ' + n + ' robots level ' + ap.target + (nd ? ', each at full price' : ': one at full price, the rest at ' + Math.round(discFor(k)*100) + '%');
    btn += coinBtn('rall:' + k, ap.cost, { cls: 'all', tip, label: tip, pre: '<b class="allt">' + (ap.catchUp ? 'match' : 'all') + '</b>' });
    sig += '|a' + ap.target + aff$(ap.cost) + ap.cost;
  }
  // the next tier unlock sits by the level nuts (away from the buy buttons) and unlocks it for every robot that has this track
  let unl = '';
  const tid = nextUnlock(k);
  if (tid && L >= cap){
    const t = TECH[tid], g = T.gens.find(q => q.tech === tid), a2 = aff$(t.cost);
    unl = '<button class="unlock" data-act="tech:' + tid + '" data-cost="' + t.cost + '" aria-disabled="' + !a2 + '" style="--p:' + pfill(t.cost) + '" title="' + t.name + ': ' + g.n + ' more levels, for every robot">' + ic('lock') + '<span>Unlock</span>' + ic('coin', 'cn') + pr(t.cost) + '</button>';
    sig += '|u' + tid + a2;
  }
  return { sig: k + sig + val, html: row({ icon: ic(TRACK_ICON[k]), name: T.label, tip: genNameAt(k, L) + ' · ' + TRACK_TIP[k], pips: nuts(L, trackGroups(k)), val: val + unl, btn }) };
}
// a one-off purchase (a building, a robot, a deal)
function buyRow(name, val, act, cost, done, icon, tip){
  return { sig: act + (done || aff$(cost)) + val, html: row({ icon, name, tip, val, btn: done ? stamp(done === 'done' ? ic('check') : done, 'ok') : coinBtn(act, cost, { label: name }) }) };
}
const pct = (a, b) => '<span class="gain">+' + Math.round((a/b - 1)*100) + '%</span>';
function bagBuildRow(){
  const per = val('leafPrice')*UP.bagPrice.vals[0]*sellMul();
  return buyRow('Bagging table', BAG_SIZE + ic('leaf') + arrow + ic('bag') + '<b>' + cash$(per*BAG_SIZE) + '</b> ' + pct(per, leafPrice()), 'bagger', BAGGER_COST, '', ic('bag'),
    'A robot bags ' + BAG_SIZE + ' loose leaves at a time; bags sell for more and get a shelf of their own in the bin');
}
function plantBuildRow(){
  return buyRow('Drying shed', ORE_PER_INGOT + ic('ore') + arrow + ic('ingot') + '<b>' + cash$(ingotPrice()) + '</b> ' + pct(ingotPrice()/ORE_PER_INGOT, metalPrice()), 'plant', PLANT_COST, '', ic('flame'),
    'Robots dry ' + ORE_PER_INGOT + ' wet logs into a dry bundle worth more. Three stoves, and someone has to haul the dry wood to the road, through the rain');
}
const metalSlotRow = () => buyRow('Log crib', 'Sell ' + ic('ore') + ' at <b>' + cash$(metalPrice()) + '</b>', 'metalSlot', METAL_SLOT_COST, '', ic('tub'),
  'A log crib beside the bin, so the truck buys wet wood too. Then set up saws at the wood piles (' + cash$(MINER_COST) + ' each, a robot works each one)');

// ── robot portraits: the real robot, drawn live into a little canvas
const pcv = document.createElement('canvas');
function drawPortrait(cv2, kind, i, z){
  const o = kind === 'robot' ? R[i] : HB.find(q => q.kind === kind && q.idx === i); if (!o) return false;
  const w = cv2.width, h = cv2.height, pc = cv2.getContext('2d'), s = h*(z || 1)/(kind === 'robot' ? 74 : 60);
  pc.setTransform(1, 0, 0, 1, 0, 0); pc.clearRect(0, 0, w, h);
  pc.setTransform(s, 0, 0, s, w/2 - o.x*s, h*(kind === 'robot' ? 0.94 : 0.88) - o.y*s);
  const keep = ctx, pl = parts.length, bl = bubbles.length;
  ctx = pc;
  try { kind === 'robot' ? drawRobot(o) : kind === 'blower' ? drawBlower(o) : drawShaker(o); } catch(e){}
  ctx = keep; parts.length = pl; bubbles.length = bl;
  return true;
}
// small still pictures of robots for the crew lists (cached for a while; they don't need to move)
const thumbs = {};
function botThumb(ri){
  const c = thumbs[ri]; if (c && S.t - c.t < 20) return c.url;
  pcv.width = pcv.height = 64;
  if (!drawPortrait(pcv, 'robot', ri)) return '';
  const url = pcv.toDataURL(); thumbs[ri] = { url, t: S.t };
  return url;
}
const crewBot = (ri, tag) => '<span class="crew" title="' + STYLES[ri].name + '"><img src="' + botThumb(ri) + '" alt="' + STYLES[ri].name + '">' + (tag ? '<b>' + tag + '</b>' : '') + '</span>';
// "who works here": robots with that task on their list, or a nudge to add it
function crewRow(icon, label, task, tagOf){
  const who = S.robots.map((c, ri) => taskOn(c, task) ? ri : -1).filter(ri => ri >= 0);
  // lots of robots: their faces in a little huddle (with the number once, if they're all the same)
  const tags = who.map(ri => tagOf ? tagOf(ri) : ''), same = tags.every(t => t === tags[0]);
  const body = who.length > 4 ? '<span class="huddle">' + who.map((ri, j) => '<img src="' + botThumb(ri) + '" alt="" title="' + STYLES[ri].name + (tags[j] ? ' · ' + attr(tags[j]) : '') + '">').join('') + '</span>' + (same && tags[0] ? '<b class="each">' + tags[0] + ' <small>each</small></b>' : '')
    : who.length ? who.map(ri => crewBot(ri, tagOf ? tagOf(ri) : '')).join('') : '<span class="none">nobody · add <span class="chip mini" style="--tc:' + TASKS[task].col + '">' + ic(task) + TASKS[task].short + '</span> to a robot’s tasks</span>';
  return { sig: 'crew' + task + who.map(ri => ri + (tagOf ? tagOf(ri) : '')).join(','), html: '<div class="row crewrow"><div class="ri">' + ic(icon) + '</div><div class="rm"><div class="n">' + label + '</div><div class="crews">' + body + '</div></div><div class="btn"></div></div>' };
}

// ── the task list on a robot's card: drag tasks between the rows of "Do" and the "Off" pile
function tasksPanel(kind, i){
  const cfg = cfgsOf(kind)[i], vis = visibleTasks(kind, cfg);
  if (vis.length < 2) return '';
  const chip = t => '<span class="chip" data-task="' + t + '" style="--tc:' + TASKS[t].col + '" title="' + TASKS[t].name + ' · drag to move">' + ic(t) + TASKS[t].short + '</span>';
  const rows = cfg.prio.map(r => r.filter(t => vis.includes(t))).filter(r => r.length), off = cfg.off.filter(t => vis.includes(t));
  let h = '<div class="tasks" data-kind="' + kind + '" data-i="' + i + '"><div class="th"><b>Do</b><span title="Side by side: they take turns">top row first</span></div><div class="tdo">';
  rows.forEach((row, ri) => { h += '<div class="trow" data-row="' + ri + '"><span class="tn">' + (ri + 1) + '</span>' + row.map(chip).join('') + (row.length < 2 ? '<span class="tslot"></span>' : '') + '</div>'; });
  // there's always one empty row at the bottom of Do, so a task can be dropped into a priority of its own below the rest
  h += '<div class="trow tnew" data-row="' + rows.length + '"><span class="tn">' + (rows.length + 1) + '</span><span class="tslot wide">' + (rows.length ? '' : 'drag a task up here') + '</span></div>';
  h += '</div><div class="th off"><b>Off</b>' + (rows.length ? '<button class="toffall" data-act="taskoff" title="Move every task to Off">all off</button>' : '') + '</div><div class="toff">' + off.map(chip).join('') + '</div>' +
    '<div class="thint">Drag to reorder · side by side = take turns</div></div>';
  return h;
}
// the task order in a few small pictures, for the Tasks tab
function tasksPeek(kind, i){
  const cfg = cfgsOf(kind)[i], vis = visibleTasks(kind, cfg);
  return cfg.prio.map(r => r.filter(t => vis.includes(t))).filter(r => r.length).map(r => r.map(t => ic(t)).join('')).join('<i>›</i>');
}
// what a robot is up to, in a word or two (with the picture of the task)
function robotDoing(r){
  const cfg = S.robots[r.id];
  switch (r.st){
    case 'seek': case 'pick': return ['leaves', 'Gathering'];
    case 'toBin': case 'dump': return r.at === 'metal' ? ['mine', metalTarget(r).hopper ? 'To the wet stack' : 'To the crib'] : ['leaves', 'To the bin'];
    case 'wait': return r.at === 'metal' ? ['mine', metalTarget(r).hopper ? 'Stack full' : 'Crib full', 1] : ['leaves', 'Bin full', 1];
    case 'toMine': return ['mine', 'To the pile'];
    case 'mine': return ['mine', 'Sawing'];
    case 'toStation': return r.task === 'bag' ? ['bag', 'To the table'] : r.task === 'jar' ? ['jar', 'To the crate'] : r.task === 'wrap' ? ['wrap', 'To the crate'] : ['smelt', 'To a stove'];
    case 'bag': return ['bag', 'Bagging'];
    case 'jar': return ['jar', 'Filling a punnet'];
    case 'wrap': return ['wrap', 'Wrapping a gift basket'];
    case 'smelt': return ['smelt', 'Drying'];
    case 'toTub': return ['smelt', 'Fetching wet wood'];
    case 'toRack': return ['haul', 'Fetching dry wood'];
    case 'toPallet': return ['haul', 'Hauling'];
    case 'waitI': return ['haul', 'Pallet full', 1];
  }
  if (!cfg.prio.some(row => row.some(t => taskOpen(t, cfg)))) return ['list', 'Nothing on its list', 1];
  return ['list', 'Looking for work'];
}
// a "don't sell below this line" slider on the bin card
function keepRow(k, icon, name, now, tip, v){
  return { sig: 'keep' + k, html: '<div class="row keep"><div class="ri">' + ic(icon) + '</div><div class="rm"><div class="n" title="' + tip + '">' + name + ' <span class="xt" id="keep' + k + 'Lv">' + now + '</span></div>' +
    '<input type="range" class="keepr" id="keep' + k + '" min="0" max="100" step="5" value="' + Math.round(clamp(v, 0, 1)*100) + '" aria-label="' + name + '"></div></div>' };
}

function applyTaskDrop(kind, i, task, tgt){
  const cfg = cfgsOf(kind)[i], vis = visibleTasks(kind, cfg);
  let rows = cfg.prio.map(r => r.filter(t => vis.includes(t))).filter(r => r.length).map(r => r.map(t => t === task ? null : t));
  let off = cfg.off.filter(t => vis.includes(t)).map(t => t === task ? null : t);
  const hidPrio = cfg.prio.flat().filter(t => !vis.includes(t)), hidOff = cfg.off.filter(t => !vis.includes(t));
  if (tgt.type === 'off') off.push(task);
  else if (tgt.type === 'join'){ if (!rows[tgt.row]) rows[tgt.row] = []; if (rows[tgt.row].filter(Boolean).length < 2) rows[tgt.row].push(task); else rows.splice(tgt.row + 1, 0, [task]); }
  else if (tgt.type === 'before') rows.splice(tgt.row, 0, [task]);
  else if (tgt.type === 'after') rows.splice(tgt.row + 1, 0, [task]);
  cfg.prio = rows.map(r => r.filter(Boolean)).filter(r => r.length).concat(hidPrio.map(t => [t]));
  cfg.off = off.filter(Boolean).concat(hidOff);
  tasksFix(cfg, kind);
  if (kind === 'robot') S.flags.taskHint = true;
  taskListChanged(kind, i);
}
// "all to Don't do": every task goes to the Don't pile
function allTasksOff(kind, i){
  const cfg = cfgsOf(kind)[i];
  cfg.off = cfg.off.concat(cfg.prio.flat()); cfg.prio = [];
  tasksFix(cfg, kind);
  if (kind === 'robot') S.flags.taskHint = true;
  taskListChanged(kind, i);
}
function taskListChanged(kind, i){
  const cfg = cfgsOf(kind)[i];
  // let the robot look at its list again straight away (unless it's in the middle of something)
  if (kind === 'robot'){
    const r = R[i];
    if (r && ['wander', 'rest', 'seek', 'toStation', 'toMine', 'toTub', 'toRack', 'wait', 'waitI'].includes(r.st) || (r && r.st === 'mine' && !taskOn(cfg, 'mine'))){ release(r); r.st = 'idle'; r.mineP = 0; }
  } else {
    const h = HB.find(q => q.kind === kind && q.idx === i);
    if (h && (['wander', 'rest', 'go'].includes(h.st) || (h.st === 'lap' && !taskOn(cfg, 'blow')) || (h.st === 'dig' && !taskOn(cfg, 'dig')))){ h.target = null; h.st = 'idle'; }
  }
  save();
}
// pointer-driven drag (works for mouse and touch alike)
let tdrag = null;
function tdragTarget(x, y){
  const box = tdrag.box, el = document.elementFromPoint(x, y);
  if (!el || !box.contains(el)) return null;
  if (el.closest('.toff') || el.closest('.th.off')) return { type:'off', el: box.querySelector('.toff') };
  const row = el.closest('.trow');
  if (!row) return null;
  const ri = +row.dataset.row, b = row.getBoundingClientRect(), f = (y - b.top)/b.height;
  if (row.classList.contains('tnew')) return { type:'join', row: ri, el: row };
  const others = [...row.querySelectorAll('.chip')].filter(c => c.dataset.task !== tdrag.task).length;
  const mine = !!row.querySelector('.chip[data-task="' + tdrag.task + '"]');
  if (f < 0.28) return { type:'before', row: ri, el: row, edge:'top' };
  if (f > 0.72) return { type:'after', row: ri, el: row, edge:'bottom' };
  if (mine && !others) return null;
  return others < 2 ? { type:'join', row: ri, el: row } : { type:'after', row: ri, el: row, edge:'bottom' };
}
function tdragMark(t){
  tdrag.box.querySelectorAll('.drop-join,.drop-top,.drop-bottom,.drop-off').forEach(n => n.classList.remove('drop-join', 'drop-top', 'drop-bottom', 'drop-off'));
  if (!t) return;
  t.el.classList.add(t.type === 'off' ? 'drop-off' : t.type === 'join' ? 'drop-join' : t.edge === 'top' ? 'drop-top' : 'drop-bottom');
}
card.addEventListener('pointerdown', e => {
  const chip = e.target.closest('.chip'); if (!chip) return;
  const box = chip.closest('.tasks'); if (!box) return;
  tdrag = { chip, box, task: chip.dataset.task, kind: box.dataset.kind, i: +box.dataset.i, x0: e.clientX, y0: e.clientY, id: e.pointerId, on: false, ghost: null, tgt: null, dx: 0, dy: 0 };
  try { chip.setPointerCapture(e.pointerId); } catch(_){}
  e.preventDefault();
});
card.addEventListener('pointermove', e => {
  if (!tdrag || e.pointerId !== tdrag.id) return;
  if (!tdrag.on){
    if (Math.hypot(e.clientX - tdrag.x0, e.clientY - tdrag.y0) < 5) return;
    tdrag.on = true;
    const b = tdrag.chip.getBoundingClientRect(); tdrag.dx = tdrag.x0 - b.left; tdrag.dy = tdrag.y0 - b.top;
    const g = tdrag.chip.cloneNode(true); g.classList.add('ghost'); g.style.width = b.width + 'px'; document.body.appendChild(g); tdrag.ghost = g;
    tdrag.chip.classList.add('lifted'); tdrag.box.classList.add('dragging');
  }
  tdrag.ghost.style.left = (e.clientX - tdrag.dx) + 'px'; tdrag.ghost.style.top = (e.clientY - tdrag.dy) + 'px';
  tdrag.tgt = tdragTarget(e.clientX, e.clientY); tdragMark(tdrag.tgt);
});
function tdragEnd(e, cancel){
  if (!tdrag || (e && e.pointerId !== tdrag.id)) return;
  const d = tdrag; tdrag = null;
  if (d.ghost) d.ghost.remove();
  if (d.on && !cancel && d.tgt){ applyTaskDrop(d.kind, d.i, d.task, d.tgt); sfx('paper'); }
  renderCard(true);
}
card.addEventListener('pointerup', e => tdragEnd(e, false));
card.addEventListener('pointercancel', e => tdragEnd(e, true));
let sliding = false;
card.addEventListener('pointerdown', e => { if (e.target.classList && e.target.classList.contains('keepr')) sliding = true; });
addEventListener('pointerup', () => { if (sliding){ sliding = false; save(); } });
card.addEventListener('input', e => {
  const id = e.target.id; if (id !== 'keepL' && id !== 'keepM' && id !== 'keepJ') return;
  const v = clamp(+e.target.value/100, 0, 1);
  if (id === 'keepL'){ S.keep.leaves = v; const l = $('keepLLv'); if (l) l.innerHTML = keepLeaves() + ic('leaf'); }
  else if (id === 'keepJ'){ S.keep.jars = v; const l = $('keepJLv'); if (l) l.innerHTML = keepJars() + ic('jar'); }
  else { S.keep.metal = v; const l = $('keepMLv'); if (l) l.innerHTML = keepMetal() + ic('ore'); }
});
// ── what each card shows
const HIVE_SHORT = { wings:'+25% ant speed', third:'3 patches a trip', tongue:'5 mushrooms a cut', fan:'+50% sorting', recipe:'20 mushrooms a punnet', nursery:'Ants 30% cheaper' };
const HIVE_ICON = { wings:'wings', third:'three', tongue:'tongue', fan:'fan', recipe:'recipe', nursery:'nursery' };
const GEN_ICON = { oil:'oil', basket:'basket', fingers:'claw', blueprint:'blueprint', cutting:'drop', market:'market', charm:'horseshoe', press:'press', seeding:'seed', clover:'clover', twin:'twin' };
const GEN_SHORT = { oil: l => '+' + 20*(l + 1) + '% speed, every robot', basket: () => 'Copied baskets cost 10%', fingers: l => '+' + 30*(l + 1) + '% claw spread',
  blueprint: () => 'Copied levels cost 30%', cutting: l => '+' + 15*(l + 1) + '% saw speed', market: l => '+' + 10*(l + 1) + '% on every sale', charm: () => '+8% split in two',
  press: l => '+' + 15*(l + 1) + '% for leaves', seeding: l => '+' + 40*(l + 1) + '% mushroom patches', clover: l => 'Mushrooms regrow ' + 30*(l + 1) + '% sooner', twin: () => '2 ant hills, 2 crates' };
const HEAD_ICON = { bin:'bin', sign:'truck', shed:'wrench', hive:'bee', bagger:'bag', plant:'flame', sound:'sound', sale:'land' };
function cardModel(){
  const k = cardOpen.kind, rows = [], rows2 = [];
  let title = '', tag = '', live = '', top = '', foot = '', tabs = null, head = HEAD_ICON[k] || '';
  if (k === 'robot' || k === 'blower' || k === 'shaker'){
    const i = cardOpen.i, st = (k === 'robot' ? STYLES : k === 'blower' ? BLOWER_STYLES : SHAKER_STYLES)[i];
    title = st.name; live = k === 'robot' ? 'robot' : 'helper'; head = 'portrait';
    const tp = tasksPanel(k, i);
    if (tp) tabs = { peek: tasksPeek(k, i) };
    if (tp && cardTab === 'tasks') top = tp;
    else if (k === 'robot'){
      // two columns: movement and carrying on the left, grabbing, mining and packing on the right
      for (const t of TRACK_ORDER) if (rowShown(t)) (['speed','carry','pick'].includes(t) ? rows : rows2).push(robotRow(i, t));
      if (!rows2.length && rows.length > 2) rows2.push(rows.pop());
    } else for (const t of BOT_TRACKS[k]) if (trackVisible(t)) rows.push(robotRow(i, t, k));
    // keep the card the same width on both tabs
    tabs && (tabs.wide = k === 'robot' && TRACK_ORDER.filter(rowShown).length > 3);
  } else if (k === 'bin'){
    title = 'Leaf bin'; live = 'bin';
    rows.push(upRow('bin', S.bag.built ? xt('+' + bagCap() + ic('bag'), 'Room for bags, on a shelf of their own') : ''));
    rows.push(upRow('leafPrice'));
    if (!S.bag.built && baggerShown()) rows.push(bagBuildRow());
    if (S.bag.built) rows.push(keepRow('L', 'leaf', 'Keep for bagging', keepLeaves() + ic('leaf'), 'The truck leaves this many loose leaves in the bin so they can be bagged first. At 0 it takes everything.', S.keep.leaves));
    if (!S.metalSlot){
      if (metalSlotShown()) rows.push(metalSlotRow());
      else if (!metalOpen()) rows.push({ sig:'metalsoon', html: row({ icon: ic('tub'), cls:'soon', name:'Log crib', val:'No wet wood on this plot. Sawing opens with the ' + AREAS[MINE_LAND].name.toLowerCase() }) });
    }
    else {
      rows2.push(upRow('metalBin', S.plant.built ? xt(palletCap() + ic('ingot'), 'Room in the woodshed by the road') : '')); rows2.push(upRow('metalPrice', S.plant.built ? xt(ic('ingot') + cash$(ingotPrice()), 'A dry bundle sells for') : ''));
      if (S.plant.built) rows2.push(keepRow('M', 'ore', 'Keep for drying', keepMetal() + ic('ore'), 'The truck leaves this much wet wood in the crib for the drying shed. At 0 it takes everything.', S.keep.metal));
      if (plantGrade() && !S.plant.built) rows2.push(plantShown() ? plantBuildRow() : { sig:'plantsoon', html: row({ icon: ic('flame'), cls:'soon', name:'Drying shed', val:'shows up once you’ve held ' + cash$(PLANT_COST*0.25), tip:'Turns wet wood into dry bundles worth a lot more' }) });
    }
  } else if (k === 'sign'){
    title = 'Pickups'; live = 'truck';
    rows.push(upRow('truck'));
    if (S.lv.cleanup > 0 || seenPrice(upCost('cleanup'))){
      const l = S.lv.cleanup, mx = l >= UP.cleanup.max;
      rows.push(upRow('cleanup', xt('≈ +' + cash$((mx ? cleanupBonus() : UP.cleanup.vals[l + 1])/100) + '/' + ic('leaf'), 'About this much more per leaf')));
    }
  } else if (k === 'shed'){
    title = 'Workshop';
    const n = S.robots.length;
    if (n < ROBOT_MAX) rows.push(buyRow('Build ' + STYLES[n].name, 'you have <b>' + n + '</b>/' + ROBOT_MAX, 'robot', robotCost(n), '', ic('robot'), STYLES[n].blurb));
    else rows.push(buyRow('Robots', 'all <b>' + ROBOT_MAX + '</b> built', 'robot', 0, 'done', ic('robot')));
    for (const kind of ['blower', 'shaker']) if (helperShown(kind)){
      const m = cfgsOf(kind).length, stl = (kind === 'blower' ? BLOWER_STYLES : SHAKER_STYLES)[m];
      rows.push(buyRow('Build ' + stl.name, m ? 'you have <b>' + m + '</b>/' + HELPER_MAX : kind === 'blower' ? 'a blower: pushes leaves to the bin' : 'a shaker: more leaves from trees', kind, helperCost(kind), '', ic(kind === 'blower' ? 'blow' : 'shake'), (kind === 'blower' ? 'A blower: blows far-off leaves toward the bin. ' : 'A shaker: shakes trees and bushes so more leaves come down. ') + stl.blurb));
    } else if (cfgsOf(kind).length >= HELPER_MAX) rows.push(buyRow(kind === 'blower' ? 'Blowers' : 'Shakers', 'all <b>' + HELPER_MAX + '</b> built', kind, 0, 'done', ic(kind === 'blower' ? 'blow' : 'shake')));
    if (!S.hive.built && hiveShown()) rows.push(buyRow('Robotic ant hill', ic('bee') + arrow + ic('nectar') + arrow + ic('jar') + '<b>' + cash$(honeyPrice()) + '</b>', 'hive', HIVE_COST, '', ic('honey'), 'Robot ants cut mushrooms from the patches, the ant hill sorts them, and the truck buys them in punnets'));
    if (genVisible()){
      // WILDFLOWER PRAIRIE: the flower upgrades (and the Twin hive) get a section of their own, always shown when available
      const FLOWERY = ['press', 'seeding', 'clover', 'twin'];
      const ks = Object.keys(GEN).filter(q => genAvail(q) && !FLOWERY.includes(q)).sort((a, b) => genCost(a) - genCost(b));
      const fk = FLOWERY.filter(genAvail);
      const owned = Object.keys(GEN).filter(q => gl(q) >= GEN[q].max);
      const genRow = q => { const g = GEN[q], l = gl(q); const r = buyRow(g.name + (g.max > 1 ? nuts(l, [{ n: g.max }]) : ''), GEN_SHORT[q](l), 'gen:' + q, genCost(q), '', ic(GEN_ICON[q]), g.desc(l).replace(/<[^>]+>/g, '')); r.sig += l; return r; };
      if (fk.length){ rows2.push({ sig:'gfh', html:'<div class="sect">Rain and mushrooms</div>' }); for (const q of fk) rows2.push(genRow(q)); }
      rows2.push({ sig:'gh', html:'<div class="sect">Yard-wide</div>' });
      for (const q of ks.slice(0, 6)) rows2.push(genRow(q));
      if (!ks.length) rows2.push({ sig:'gnone', html:'<div class="none pad">More unlock as the yard grows.</div>' });
      if (owned.length) rows2.push({ sig:'gown' + owned.length, html:'<div class="gdone">' + owned.map(q => '<span class="dchip" title="' + GEN[q].name + '">' + ic(GEN_ICON[q]) + ic('check', 'ck') + '</span>').join('') + '</div>' });
    }
    foot = '<div class="foot">' + (resetArm ? '<button class="link danger" data-act="reset2">Yes, wipe my yard</button>' : '<button class="link" data-act="reset1">Start over</button>') + '</div>';
  } else if (k === 'hive'){
    const H = S.hive;
    title = 'Ant hill';
    if (!H.built){ head = 'honey'; rows.push(buyRow('Robotic ant hill', ic('bee') + arrow + ic('nectar') + arrow + ic('jar') + '<b>' + cash$(honeyPrice()) + '</b>', 'hive', HIVE_COST, '', ic('honey'), 'Robot ants cut mushrooms from the patches, the ant hill sorts them, and the truck buys them in punnets')); }
    else {
      live = 'hive';
      const n = H.bees;
      if (n < maxBees()){
        const cost = beeCost(), spare = n && B.filter(b => b.st === 'loiter').length >= Math.max(2, n*0.3);
        rows.push({ sig:'bee' + n + aff$(cost) + cost + spare, html: row({ icon: ic('bee'), name:'Robot ants', tip:'Each ant cuts from ' + (H.up.third ? 3 : 2) + ' patches a trip. Near patches go first, so more ants walk further out.', val: meter('bee', n, MAX_BEES, 'Ants') + (spare ? xt(ic('flower') + 'all busy', 'Every patch is being cut: more ants won’t help much until there’s more land') : ''), btn: coinBtn('bee', cost, { label:'Another ant' }) }) });
      } else rows.push({ sig:'beefull', html: row({ icon: ic('bee'), name:'Robot ants', val: meter('bee', n, maxBees()), btn: stamp('full') }) });
      const floorNext = (S.lv.hiveTank + S.lv.hiveStore) % 2 === 0 ? xt('+1 chamber', 'This step adds a chamber to the ant hill (more mushrooms sorted a minute)') : '';
      rows.push(upRow('hiveTank', S.lv.hiveTank < UP.hiveTank.max ? floorNext : ''));
      rows.push(upRow('hiveStore', S.lv.hiveStore < UP.hiveStore.max ? floorNext : ''));
      rows.push(upRow('honeyPrice'));
      if (!H.packing){ if (packShown()) rows.push(buyRow('Gift wrapping', ic('jar') + cash$(honeyPrice()) + arrow + ic('gift') + '<b>' + cash$(val('honeyPrice')*UP.giftPrice.vals[0]*sellMul()) + '</b>', 'honeyPack', HONEY_PACK_COST, '', ic('gift'), 'Adds the Wrap task: a robot wraps a punnet in a cloth and ties a ribbon on it so it sells as a gift basket. Wrapping takes almost as long as filling the punnet.')); }
      else {
        rows.push(upRow('giftPrice'));
        rows.push(keepRow('J', 'jar', 'Keep for wrapping', keepJars() + ic('jar'), 'The truck leaves this many plain punnets in the crate so they can be wrapped first. At 0 it takes every punnet.', S.keep.jars || 0));
      }
      rows.push(crewRow('jar', 'Fillers', 'jar', ri => smeltSkillPack(ri)));
      if (H.packing) rows.push(crewRow('wrap', 'Wrappers', 'wrap', ri => smeltSkillPack(ri)));
      rows2.push({ sig:'hh', html:'<div class="sect">Ant hill upgrades <span>any order · same price</span></div>' });
      let tiles = '';
      for (const key in HIVE_UP){
        const u = HIVE_UP[key], have = H.up[key];
        let note = '';
        if (have && u.bee && B.length){ const got = B.filter(b => b.up[key]).length; if (got < B.length) note = '<em>' + got + '/' + B.length + ' ants</em>'; }
        tiles += '<div class="tile' + (have ? ' got' : '') + '" title="' + u.desc.replace(/<[^>]+>/g, '') + '">' + ic(HIVE_ICON[key], 'tic') + '<div class="tn2">' + u.name + '</div><div class="td">' + HIVE_SHORT[key] + note + '</div>' +
          (have ? stamp(ic('check'), 'ok') : coinBtn('hiveUp:' + key, hiveUpCost(), { label: u.name })) + '</div>';
      }
      rows2.push({ sig:'tiles' + tiles.length + Object.keys(H.up).filter(q => H.up[q]).join() + aff$(hiveUpCost()), html:'<div class="tiles">' + tiles + '</div>' });
      if (!n){
        // no bees yet: everything else can be looked at, but not bought
        const lockIt = r => { r.html = r.html.replace(/aria-disabled="(true|false)"/g, 'aria-disabled="true" data-lock="bee"').replace(/class="(row|tiles)/, 'class="$1 locked'); r.sig += 'L'; return r; };
        for (let q=1; q<rows.length; q++) lockIt(rows[q]);
        rows2.forEach(lockIt);
        rows.splice(1, 0, { sig:'needbee', html:'<div class="lockline">' + ic('lock') + 'Get your first ant to start upgrading</div>' });
      }
    }
  } else if (k === 'bagger'){
    title = 'Bagging table';
    if (!S.bag.built) rows.push(bagBuildRow());
    else {
      live = 'bagger';
      rows.push(upRow('bagPrice', xt(cash$(bagPrice()/BAG_SIZE) + '/' + ic('leaf'), 'Per leaf, bagged')));
      rows.push(crewRow('bag', 'Baggers', 'bag', ri => smeltSkillPack(ri)));
    }
  } else if (k === 'plant'){
    title = 'Drying shed';
    if (!S.plant.built) rows.push(plantBuildRow());
    else {
      live = 'plant';
      rows.push(upRow('smeltSpeed')); rows.push(upRow('slag')); rows.push(upRow('ingotGrade', xt(cash$(ingotPrice()*(1 + val('slag'))/ORE_PER_INGOT) + '/' + ic('ore'), 'Per wet log, dried')));
      rows.push(upRow('hopper'));
      rows2.push(crewRow('smelt', 'Dryers', 'smelt', ri => smeltSkill(ri).toFixed(1) + '×'));
      rows2.push(crewRow('haul', 'Haulers', 'haul', ri => ingotCarry(ri) + '<small>/trip</small>'));
      const sk = stoker(), learnt = S.blowers.some(b => b.lv.stoke > 0);
      rows2.push({ sig:'stk' + (sk ? sk.idx + hv(sk, 'stoke') : '-') + learnt + S.blowers.length, html: row({ icon: ic('stoke'), name:'Bellows', cls:'crewrow',
        val: sk ? BLOWER_STYLES[sk.idx].name + ' <span class="gain">+' + Math.round(hv(sk, 'stoke')*100) + '%</span> drying' : '<span class="none">' + (learnt ? 'no blower here · add <span class="chip mini" style="--tc:' + TASKS.stoke.col + '">' + ic('stoke') + 'Bellows</span> to a blower' : S.blowers.length ? 'a blower can learn it (Bellows, on its card)' : 'build a blower to work it') + '</span>',
        tip:'A blower working the bellows makes every dryer faster' }) });
      // RAINY HOLLOW: who's carrying the wood umbrella, and how much dry wood the rain has soaked so far
      const ub = HB.filter(h => h.kind === 'blower' && h.st === 'brolly'), ul = S.blowers.some(b => b.lv.brolly > 0), soaked = S.totals.soaked || 0;
      rows2.push({ sig:'brl' + ub.map(h => h.idx).join(',') + ul + soaked + S.blowers.length, html: row({ icon: ic('brolly'), name:'Wood umbrella', cls:'crewrow',
        val: (ub.length ? ub.map(h => BLOWER_STYLES[h.idx].name).join(', ') + ' <span class="gain">keeps the wood dry</span>' : '<span class="none">' + (ul ? 'nobody carrying it · add <span class="chip mini" style="--tc:' + TASKS.brolly.col + '">' + ic('brolly') + 'Umbrella</span> to a blower' : S.blowers.length ? 'a blower can learn it (Umbrella, on its card)' : 'build a blower to carry it') + '</span>')
          + (soaked ? '<br><small>' + ic('wet') + soaked + ' bundles soaked in the rain so far</small>' : ''),
        tip:'Dry bundles get wet on the long walk to the road. A soaked bundle goes back in the log crib as two wet logs. A blower carrying the wood umbrella beside a hauler keeps its load dry' }) });
    }
  } else if (k === 'sound'){
    const P = SND.prefs;
    title = 'Sounds';
    top = '<div class="seg" role="group" aria-label="Sound"><button data-act="snd:on1" class="' + (P.on ? 'on' : '') + '">On</button><button data-act="snd:on0" class="' + (P.on ? '' : 'on') + '">Off</button></div>';
    rows.push({ sig:'vol', html:'<div class="row vol"><div class="ri">' + ic('sound') + '</div><label class="n" for="sndVol">Volume</label><input type="range" id="sndVol" min="0" max="100" step="1" value="' + Math.round(P.vol*100) + '"></div>' });
    const tog = (key, icon, name, tip) => ({ sig: key + P[key], html: row({ icon: ic(icon), name, tip, btn: '<button class="tog' + (P[key] ? ' on' : '') + '" data-act="snd:' + key + '" aria-pressed="' + P[key] + '">' + (P[key] ? 'On' : 'Off') + '</button>' }) });
    rows.push(tog('amb', 'leaf', 'Leaves &amp; wind', 'Rustling, gusts, the compost truck'));
    rows.push(tog('sfx', 'robot', 'Beeps &amp; chimes', 'Robot chatter, the truck paying'));
    rows.push(tog('music', 'note', 'Music', 'A quiet waltz that comes and goes'));
    foot = '<div class="foot"><span><kbd>M</kbd> mutes</span></div>';
  } else if (k === 'sale'){
    const A = AREAS[S.land + 1], cur = AREAS[S.land], newSpots = SPOTS.filter(p => p.land === S.land + 1).length;
    title = 'For sale';
    rows.push(buyRow('The ' + A.name.toLowerCase(), '<b>' + Math.round(A.w*A.h/(cur.w*cur.h)) + '×</b> room' + (newSpots ? ' · +' + newSpots + ic('vein') : '') + ' · more ' + ic('leaf') + ic('flower'), 'land', A.cost, '', ic('land'), 'More room means more leaves and mushroom patches' + (newSpots ? ' and a wet wood pile' : '') + ', but longer trips to the bin'));
    if (S.land + 1 === MINE_LAND) rows.push({ sig:'mine', html: row({ icon: ic('vein'), name:'Room for a drying shed!', val:'The meadow has a bigger wood pile and room for the drying shed' }) });
  } else if (k === 'spot'){
    const i = cardOpen.i, p = SPOTS[i], vw = veinWord(i).replace(/^an? /, '');
    tag = '<span class="tag" title="Bigger piles give logs faster">' + vw + '</span>';
    head = 'vein';
    if (p.land > S.land){
      title = 'Wood pile';
      rows.push({ sig:'far', html: row({ icon: ic('land'), cls:'soon', name:'Not your land yet', val:'buy it when the For Sale sign goes up' }) });
    } else if (S.miners.includes(i)){
      const shaft = S.shafts.includes(i), room = slotsAt(i);
      title = shaft ? 'Wood shelter' : 'Saw station'; head = shaft ? 'shaft' : 'vein';
      const ws = minerWorkers(i);
      for (const w of ws) rows.push({ sig:'w' + w + drillTimeAt(w, i).toFixed(1) + metalCarry(w) + doubleChance(w), html: '<div class="row crewrow"><div class="ri">' + crewBot(w) + '</div><div class="rm"><div class="n">' + STYLES[w].name + '</div><div class="v">' +
        drillTimeAt(w, i).toFixed(1) + 's<small>/</small>' + ic('ore') + xt(metalCarry(w) + ic('ore') + '<small>a trip</small>') + (doubleChance(w) > 0 ? xt(Math.round(doubleChance(w)*100) + '%<small>×2</small>', 'Chance a log splits in two') : '') + '</div></div>' +
        '<div class="btn"><button class="buy ghost" data-act="release:' + w + '" title="Moves Saw wood to Off on ' + STYLES[w].name + '’s task list">Stop</button></div></div>' });
      if (ws.length < room){
        const any = R.some(r => S.robots[r.id].miner == null);
        rows.push({ sig:'nw' + any + ws.length, html: row({ icon: ic('robot'), cls:'soon', name: ws.length ? 'Room for one more' : 'Nobody sawing', val: any ? 'sends the nearest free robot' : 'every robot is at a saw', btn:'<button class="buy ghost" data-act="send" aria-disabled="' + !any + '">Send one</button>' }) });
      }
      if (!shaft && shaftShown()) rows.push(buyRow('Build a shelter', '<span class="gain">+35%</span> speed · 2' + ic('robot') + (S.shafts.length ? xt('½ price', 'You’ve dug one before') : ''), 'shaft', shaftCost(), '', ic('shaft'), 'A roof over the pile keeps the wood drier: logs come 35% faster and two robots can work it. Blowers can learn to dry the pile.'));
      if (shaft){
        const ex = HB.find(h => h.kind === 'blower' && h.st === 'dig' && h.dig === i), learnt = S.blowers.some(b => b.lv.dig > 0);
        rows.push({ sig:'ex' + (ex ? ex.idx + hv(ex, 'dig') : '-') + learnt + S.blowers.length, html: row({ icon: ic('dig'), cls:'crewrow', name:'Pile dryer', tip:'A blower blowing warm air on the pile makes sawing here faster',
          val: ex ? BLOWER_STYLES[ex.idx].name + ' <span class="gain">+' + Math.round(hv(ex, 'dig')*100) + '%</span> sawing' : '<span class="none">' + (learnt ? 'no blower here · add <span class="chip mini" style="--tc:' + TASKS.dig.col + '">' + ic('dig') + 'Dig</span> to a blower' : S.blowers.length ? 'a blower can learn it (Dry piles, on its card)' : 'build a blower to dig here') + '</span>' }) });
      }
    } else {
      title = 'Wood pile';
      if (!S.metalSlot){
        // the metal slot can be bought right here as well as on the bin
        if (metalSlotShown()) rows.push(metalSlotRow());
        else rows.push({ sig:'locked', html: row({ icon: ic('lock'), cls:'soon', name:'Needs a log crib', val:'on the bin, once you’ve held ' + cash$(METAL_SLOT_COST*0.25) }) });
      }
      else rows.push(buyRow('Set up a saw', ic('ore') + '<b>' + cash$(metalPrice()) + '</b> a log · needs a robot', 'miner', MINER_COST, '', ic('vein'), 'A robot with Saw wet wood on its list works it'));
    }
  }
  return { title, tag, rows, rows2, top, foot, live, tabs, head };
}
// packing speed, for the bagger and packer crews
const smeltSkillPack = ri => rv(ri, 'pack').toFixed(1) + '×';

// ── the live line under the title: what's happening right now, as pictures and meters
function liveHTML(kind){
  if (kind === 'robot'){
    const i = cardOpen.i, r = R[i]; if (!r) return '';
    const [t, label, warn] = robotDoing(r);
    // what's in the basket: "4🍂 3⛏ / 12🧺"
    // the basket's room depends on what's going in it: leaves, metal chunks or ingots
    const mode = r.carryL ? 'leaf' : r.carryM || r.st === 'mine' || r.st === 'toMine' || r.st === 'toTub' || r.st === 'smelt' ? 'ore' : r.carryI || r.st === 'toRack' || r.st === 'toPallet' ? 'ingot' : 'leaf';
    const cap = mode === 'ore' ? metalCarry(i) : mode === 'ingot' ? ingotCarry(i) : leafCap(i);
    let items = '';
    if (r.carryL) items += '<span>' + r.carryL + ic('leaf') + '</span>';
    if (r.carryM) items += '<span>' + r.carryM + ic('ore') + '</span>';
    if (r.carryI) items += '<span>' + r.carryI + ic('ingot') + '</span>';
    if (!items) items = '<span class="dim">0' + ic(mode) + '</span>';
    const n = (r.carryL || 0) + (r.carryM || 0) + (r.carryI || 0);
    return '<span class="st' + (warn ? ' warn' : '') + '">' + ic(t) + label + '</span><span class="bk' + (n >= cap ? ' full' : '') + '" title="In its basket">' + items + '<span class="sl">/</span>' + cap + ic('basket') + '</span>';
  }
  if (kind === 'helper'){
    const h = HB.find(q => q.kind === cardOpen.kind && q.idx === cardOpen.i); if (!h) return '';
    let s;
    if (h.kind === 'blower'){
      s = h.st === 'stoke' ? ['stoke', 'Bellows <b class="gain">+' + Math.round(hv(h, 'stoke')*100) + '%</b>'] : h.st === 'dig' ? ['dig', 'Pile drying <b class="gain">+' + Math.round(hv(h, 'dig')*100) + '%</b>']
        : h.st === 'brolly' ? ['brolly', h.brolly >= 0 && R[h.brolly] ? 'Umbrella over ' + STYLES[h.brolly].name : 'Waiting with the umbrella']
        : h.st === 'go' && h.task === 'stoke' ? ['stoke', 'To the shed'] : h.st === 'go' && h.task === 'dig' ? ['dig', 'To a shelter'] : h.st === 'lap' ? ['blow', h.lap ? 'Blowing · lap ' + (h.lap + 1) : 'Blowing along the fence']
        : h.st === 'go' ? ['blow', 'To the next lap'] : ['clock', 'Waiting for leaves'];
    } else {
      s = h.st === 'snip' ? ['snip', 'Trimming'] : h.st === 'go' && h.target && h.target.type === 'flower' ? ['snip', 'To a patch'] : h.st === 'shake' ? ['shake', h.target.type === 'tree' ? 'Shaking a tree' : 'Shaking a bush']
        : h.st === 'go' ? ['shake', h.target && h.target.type === 'bush' ? 'To a bush' : 'To a tree'] : ['clock', tooManyLeaves() ? 'Plenty down already' : 'Trees refilling'];
    }
    return '<span class="st">' + ic(s[0]) + s[1] + '</span>';
  }
  if (kind === 'hive'){
    const H = S.hive, idle = B.filter(b => b.st === 'loiter').length, q = B.filter(b => b.st === 'queue').length, out = B.length - idle - q - B.filter(b => b.st === 'in').length;
    return '<span class="st" title="Ants out at the patches">' + ic('bee') + out + ' <small>out</small>' + (idle ? '<small>&nbsp;· ' + idle + ' idle</small>' : '') + (q ? ' <b class="warnc">&nbsp;' + q + ' queuing</b>' : '') + '</span>' +
      meter('nectar', H.nectar, tankCap(), 'Fresh mushrooms in the larder') + meter('honey', H.honey, honeyCap(), 'Sorted mushrooms in the ant hill, waiting to be packed') + meter('jar', crateJars(), crateCap(), 'Punnets in the crate' + (H.packing ? ' (' + H.gift + ' gift)' : '')) + (H.packing ? '<span class="st" title="Gift baskets in the crate">' + ic('gift') + H.gift + '</span>' : '');
  }
  if (kind === 'bagger') return meter('leaf', S.binLeaves, binCap(), 'Loose leaves in the bin') + meter('bag', S.bag.bags, bagCap(), 'Bags in the bin') + slots('bag', busyIn('bag'), 2, 'Bagging now');
  if (kind === 'plant') return meter('hopper', Math.floor(S.plant.ore), hopperCap(), 'Wet wood in the stack') + meter('ingot', S.plant.rack, RACK_CAP, 'Dry bundles on the shelf') + meter('pallet', S.ingots, palletCap(), 'Dry bundles in the woodshed by the road') + slots('flame', busyIn('smelt'), 3, 'Stoves working');
  if (kind === 'bin') return meter('leaf', S.binLeaves, binCap(), 'Loose leaves') + (S.bag.built ? meter('bag', S.bag.bags, bagCap(), 'Bags') : '') + (S.metalSlot ? meter('ore', S.binMetal, metalCap(), 'Wet wood in the crib') : '') + (S.plant.built ? meter('ingot', S.ingots, palletCap(), 'Dry bundles in the woodshed') : '');
  if (kind === 'truck'){
    let h = '<span class="st big" title="Next pickup">' + ic('truck') + (truckHere() ? 'here now' : mmss(S.truckT)) + '</span>';
    if (S.lv.cleanup) h += meter('cleanup', S.cleanN | 0, 100, 'Leaves toward the next cleanup bonus', 'green');
    return h;
  }
  return '';
}
function renderCard(force){
  if (!cardOpen) return;
  const m = cardModel();
  const sig = cardOpen.kind + (cardOpen.i ?? '') + cardTab + (m.tabs ? m.tabs.peek : '') + m.title + m.tag + m.rows.map(r => r.sig).join(',') + '|' + m.rows2.map(r => r.sig).join(',') + m.top + m.foot + cardNote;
  if ((sig !== cardSig || force) && !tdrag && !sliding){
    cardSig = sig;
    const two = m.rows2.length > 0, body = m.rows.map(r => r.html).join('');
    cardOpen.tabsOn = !!m.tabs;
    card.classList.toggle('wide', m.tabs ? !!m.tabs.wide : two);
    const medal = m.head === 'portrait' ? '<canvas id="cardPortrait" width="128" height="128"></canvas>' : m.head ? ic(m.head) : '';
    card.innerHTML = '<div class="ch">' + (medal ? '<div class="medal' + (m.head === 'portrait' ? ' pt' : '') + '">' + medal + '</div>' : '') +
      '<div class="hd"><div class="ct">' + m.title + m.tag + '</div>' + (m.live ? '<div class="live" id="cardLive"></div>' : '') + '</div><button class="x" data-act="close" aria-label="Close">' +
      '<svg viewBox="-6 -6 12 12" aria-hidden="true"><path d="M-3,-3 L3,3 M3,-3 L-3,3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button></div>' +
      (m.tabs ? '<div class="tabs" role="tablist"><button role="tab" data-act="tab:up" class="' + (cardTab !== 'tasks' ? 'on' : '') + '">' + ic('wrench') + 'Upgrades</button><button role="tab" data-act="tab:tasks" class="' + (cardTab === 'tasks' ? 'on' : '') + '">' + ic('list') + 'Tasks<span class="peek">' + m.tabs.peek + '</span></button></div>' : '') +
      '<div class="cbody">' + m.top +
      (two ? '<div class="cols"><div class="col">' + body + '</div><div class="col">' + m.rows2.map(r => r.html).join('') + '</div></div>' : body) +
      (cardNote ? '<div class="note">' + cardNote + '</div>' : '') + m.foot + '</div>';
    card.querySelectorAll('.live').forEach(n => { n._t = ''; });
    placeCard();
  }
  const lv = $('cardLive'); if (lv){ const t = liveHTML(m.live); if (lv._t !== t){ lv._t = t; lv.innerHTML = t; } }
  const pc = $('cardPortrait'); if (pc) drawPortrait(pc, cardOpen.kind, cardOpen.i);
  // the "saving up" fill on buttons you can't afford yet
  if (--fillT <= 0){ fillT = 6; for (const b of card.querySelectorAll('[data-cost]')){ const p = pfill(+b.dataset.cost); if (b.style.getPropertyValue('--p') !== p) b.style.setProperty('--p', p); } }
}

// V7: cards sit near the middle of the screen (beside the thing you tapped when there's room), are never taller than
// the visible area (the height comes from the real window size, not CSS 100vh, which is taller on phones and in frames),
// and scroll inside themselves when their content is taller than that.
const CARD_M = 10;
function placeCard(){
  if (!cardOpen) return;
  const maxH = W < 640 ? Math.round(H*0.62) : H - 2*CARD_M;
  if (card.style.maxHeight !== maxH + 'px') card.style.maxHeight = maxH + 'px';
  // narrow screens (phones held upright): the card docks to the bottom edge like a sheet
  if (W < 640){ const cw = card.offsetWidth, ch = card.offsetHeight; card.style.left = Math.round((W - cw)/2) + 'px'; card.style.top = Math.max(CARD_M, H - ch - CARD_M) + 'px'; return; }
  const a = cardAnchor(), cw = card.offsetWidth, ch = Math.min(card.offsetHeight, maxH);
  const midX = (W - cw)/2, midY = (H - ch)/2;
  // sideways: next to the thing you tapped, on the side with more room, then pulled a little toward the middle
  let x = midX;
  if (cw < W*0.6){
    const right = a.x + 40, left = a.x - 40 - cw;
    if (a.x <= W/2 && right + cw <= W - CARD_M) x = right;
    else if (a.x > W/2 && left >= CARD_M) x = left;
    else if (right + cw <= W - CARD_M) x = right;
    else if (left >= CARD_M) x = left;
    x = lerp(x, midX, 0.3);
  }
  // up and down: centred on the screen, nudged a little toward the thing you tapped
  let y = lerp(midY, a.y - ch/2, 0.25);
  x = clamp(x, CARD_M, Math.max(CARD_M, W - cw - CARD_M)); y = clamp(y, CARD_M, Math.max(CARD_M, H - ch - CARD_M));
  card.style.left = Math.round(x) + 'px'; card.style.top = Math.round(y) + 'px';
}
// the card's content can grow or shrink while it's open (a new row, a longer note): keep it on screen
if (window.ResizeObserver) new ResizeObserver(() => { if (cardOpen) placeCard(); }).observe(card);
function cardAnchor(){
  const k = cardOpen.kind;
  let p, below;
  if (k === 'robot' || k === 'blower' || k === 'shaker'){ p = { x: cardOpen.ax, y: cardOpen.ay }; below = k === 'robot' ? 70 : 54; }
  else if (k === 'bin'){ p = { x: BIN.x + 10, y: BIN.y - 62 }; below = 70; }
  else if (k === 'sign'){ p = { x: SIGN.x, y: SIGN.y - 76 }; below = 80; }
  else if (k === 'shed'){ p = { x: SHED.x + 30, y: SHED.y - 100 }; below = 104; }
  else if (k === 'sale'){ const s = salePos(); p = { x: s.x, y: s.y - 78 }; below = 80; }
  else if (k === 'hive'){ const z = S.hive.built ? hiveTopZ() + 24 : 52; p = { x: HIVE.x + 10, y: HIVE.y - z - 20 }; below = z + 30; }
  else if (k === 'spot'){ const s = SPOTS[cardOpen.i]; p = { x: s.x, y: s.y - (S.shafts.includes(cardOpen.i) ? 100 : 74) }; below = 84; }
  else if (k === 'bagger'){ p = { x: BAGGER.x, y: BAGGER.y - 50 }; below = 54; }
  else if (k === 'plant'){ const bt = S.plant.built; p = { x: PLANT.x, y: PLANT.y - (bt ? 100 : 50) }; below = bt ? 110 : 60; }
  else if (k === 'sound'){ const b = sndBtn.getBoundingClientRect(); return { x: b.left + b.width/2 + 120, y: b.top, below: b.height }; }
  else return { x: W/2, y: H/2, below: 0 };
  const s = w2s(p.x, p.y);
  return { x: s.x, y: s.y, below: below*cam.z };
}
function openCard(kind, i){
  const obj = kind === 'robot' || kind === 'spot' || kind === 'blower' || kind === 'shaker' ? kind + i : kind;
  cardOpen = { kind, i, obj };
  if (kind === 'robot'){ const r = R[i]; cardOpen.ax = r.x; cardOpen.ay = r.y - 62; }
  if (kind === 'blower' || kind === 'shaker'){ const h = HB.find(q => q.kind === kind && q.idx === i); cardOpen.ax = h.x; cardOpen.ay = h.y - 46; }
  resetArm = false; cardNote = ''; cardSig = '';
  card.hidden = false; card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
  if (kind !== 'sound') S.flags.opened = true;
  // the first time a robot's tasks are worth a look (the tip says so), its card opens on the Tasks tab
  if (kind === 'robot'){ dismissHint('unlock'); if (tasksPanel('robot', i)){ if (!hintDone('tasks') && !S.flags.taskHint) cardTab = 'tasks'; dismissHint('tasks'); } }
  if (kind === 'hive' && S.hive.built) dismissHint('bees');
  if (kind === 'spot' && S.metalSlot) dismissHint('miner');
  sfx('paper');
  renderCard(true);
}
function closeCard(){ cardOpen = null; card.hidden = true; cardSig = ''; }

card.addEventListener('pointerdown', e => e.stopPropagation());
card.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act;
  if (act === 'close'){ closeCard(); return; }
  if (act.startsWith('tab:')){ cardTab = act.slice(4); sfx('paper'); renderCard(true); return; }
  if (act.startsWith('snd:')){ const k = act.slice(4); if (k === 'on1' || k === 'on0') SND.set('on', k === 'on1'); else SND.toggle(k); renderCard(true); return; }
  if (b.dataset.lock === 'bee'){ cardNote = 'Get your first ant before the ant hill upgrades.'; renderCard(true); }
  if (b.getAttribute('aria-disabled') === 'true'){ sfx('deny'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); return; }
  cardNote = '';
  const i = cardOpen.i;
  if (act.startsWith('up:')){ const k = act.slice(3); buy({ id:'up', key:k, obj:UP[k].obj, cost:upCost(k), maxed:S.lv[k] >= UP[k].max }); }
  else if (act.startsWith('rall:')){ const k = act.slice(5), ap = allPlan(k); if (ap) buy({ id:'rall', key:k, target:ap.target, obj:cardOpen.obj, cost:ap.cost }); }
  else if (act.startsWith('rup:')){
    const k = act.slice(4), kind = cardOpen.kind, c = botCost(kind, i, k);
    if (c && cfgsOf(kind)[i].lv[k] < trackCap(k)) buy(kind === 'robot' ? { id:'rup', ri:i, key:k, obj:'robot'+i, cost:c.cost } : { id:'hup', kind, ri:i, key:k, obj:kind+i, cost:c.cost });
  }
  else if (act.startsWith('tech:')){ const id = act.slice(5); if (techAvailable(id)) buy({ id:'tech', key:id, obj:cardOpen.obj, cost:TECH[id].cost }); }
  else if (act.startsWith('gen:')){ const k = act.slice(4); if (genAvail(k)) buy({ id:'gen', key:k, obj:'shed', cost:genCost(k) }); }
  else if (act === 'metalSlot') buy({ id:'metalSlot', obj:'bin', cost:METAL_SLOT_COST });
  else if (act === 'hive'){ if (!S.hive.built) buy({ id:'hive', obj:'hive', cost:HIVE_COST }); }
  else if (act === 'bee'){ if (S.hive.built && S.hive.bees < maxBees()) buy({ id:'bee', obj:'hive', cost:beeCost() }); }
  else if (act.startsWith('hiveUp:')){ const k = act.slice(7); if (HIVE_UP[k] && !S.hive.up[k]) buy({ id:'hiveUp', key:k, obj:'hive', cost:hiveUpCost() }); }
  else if (act === 'robot') buy({ id:'robot', obj:'shed', cost:robotCost(S.robots.length) });
  else if (act === 'blower' || act === 'shaker'){ if (cfgsOf(act).length < HELPER_MAX) buy({ id:act, obj:'shed', cost:helperCost(act) }); }
  else if (act === 'miner') buy({ id:'miner', arg:i, obj:'spot'+i, cost:MINER_COST });
  else if (act === 'land'){ buy({ id:'land', obj:'sale', cost:AREAS[S.land + 1].cost }); return; }
  else if (act === 'bagger'){ if (!S.bag.built) buy({ id:'bagger', obj:'bagger', cost:BAGGER_COST }); }
  else if (act === 'honeyPack'){ if (S.hive.built && !S.hive.packing) buy({ id:'honeyPack', obj:'hive', cost:HONEY_PACK_COST }); }
  else if (act === 'plant'){ if (!S.plant.built) buy({ id:'plant', obj:'plant', cost:PLANT_COST }); }
  else if (act === 'shaft'){ if (S.miners.includes(i) && !S.shafts.includes(i)) buy({ id:'shaft', arg:i, obj:'spot'+i, cost:shaftCost() }); }
  else if (act.startsWith('release:')){ const w = +act.slice(8); if (S.robots[w] && S.robots[w].miner === i) unassign(w); }
  else if (act === 'send'){ const p = SPOTS[i]; const cand = R.filter(r => S.robots[r.id].miner == null).sort((a,b) => Math.hypot(a.x-p.x,a.y-p.y) - Math.hypot(b.x-p.x,b.y-p.y))[0]; if (cand) assign(cand.id, i); }
  else if (act === 'taskoff'){ if (cardOpen.kind === 'robot' || cardOpen.kind === 'blower' || cardOpen.kind === 'shaker'){ allTasksOff(cardOpen.kind, i); sfx('paper'); } }
  else if (act === 'reset1') resetArm = true;
  else if (act === 'reset2'){ hardReset(); return; }
  save();
  if (cardOpen) renderCard(true);
});
addEventListener('keydown', e => { if (e.key === 'Escape') closeCard(); });

// ───────────────────────── input
function hit(x, y){
  for (const r of [...R].sort((a,b) => b.y - a.y)){ const st = STYLES[r.id]; if (Math.abs(x - r.x) < st.tw/2 + 8 && y < r.y + 10 && y > r.y - 62) return ['robot', r.id]; }
  if (S.hive.built && Math.abs(x - CRATE.x) < 25 && y > CRATE.y - 62 && y < CRATE.y + 6) return ['hive'];
  if (twinBuilt()){
    if (Math.abs(x - CRATE2.x) < 25 && y > CRATE2.y - 62 && y < CRATE2.y + 6) return ['hive'];
    if (x > HIVE2.x - 48 && x < HIVE2.x + 46 && y > HIVE2.y - hiveTopZ() - 24 && y < HIVE2.y + 8) return ['hive'];
  }
  if (hiveShown()){ const top = S.hive.built ? hiveTopZ() + 24 : 52; if (x > HIVE.x - (S.hive.built ? 48 : 24) && x < HIVE.x + (S.hive.built ? 46 : 48) && y > HIVE.y - top && y < HIVE.y + 8) return ['hive']; }   // RAINY HOLLOW: the ant hill is wider
  if (Math.abs(x - SHED.x) < 58 && y > SHED.y - 98 && y < SHED.y - 44) return ['shed'];   // the shed's walls and roof win over a helper parked in front
  if (plantShown() && x > PLANT.x - 104 && x < PLANT.x + 104 && y > PLANT.y - (S.plant.built ? 120 : 60) && y < PLANT.y + 8) return ['plant'];
  if (S.plant.built && Math.abs(x - PALLET.x) < 28 && y > PALLET.y - 44 && y < PALLET.y + 6) return ['plant'];
  if (baggerShown() && Math.abs(x - BAGGER.x) < 32 && y > BAGGER.y - (S.bag.built ? 48 : 60) && y < BAGGER.y + 6) return ['bagger'];
  for (const h of [...HB].sort((a,b) => b.y - a.y)){ const w = helperStyle(h).bw/2 + (h.kind === 'blower' ? 12 : 20), top = h.kind === 'blower' ? 48 : 50; if (Math.abs(x - h.x) < w && y < h.y + 9 && y > h.y - top) return [h.kind, h.idx]; }
  if (saleVisible()){ const p = salePos(); if (Math.abs(x - p.x) < 38 && y > p.y - 80 && y < p.y + 6) return ['sale']; }
  if (truck.st !== 'away' && x > truck.x - 88 && x < truck.x + 76 && y > LANE - 56 && y < LANE + 8) return ['sign'];
  if (x > BIN.x - 44 && x < BIN.x + (S.metalSlot ? 80 : 44) && y > BIN.y - 64 && y < BIN.y + 8) return ['bin'];
  if (Math.abs(x - SIGN.x) < 30 && y > SIGN.y - 74 && y < SIGN.y + 6) return ['sign'];
  if (Math.abs(x - SHED.x) < 58 && y > SHED.y - 98 && y < SHED.y + 8) return ['shed'];
  for (let i=0;i<SPOTS.length;i++){ const p = SPOTS[i], built = S.miners.includes(i); if (Math.abs(x - p.x) < 44 && y > p.y - (S.shafts.includes(i) ? 104 : built ? 72 : 30) && y < p.y + 22) return ['spot', i]; }
  return null;
}
function tap(sx, sy){
  const w = s2w(sx, sy);
  const h = hit(w.x, w.y);
  if (h){ if (cardOpen && cardOpen.kind === h[0] && cardOpen.i === h[1]) closeCard(); else openCard(h[0], h[1]); return; }
  closeCard();
  parts.push({ k:'ring', x: w.x, y: w.y, r0: 4, r1: 46, life: 0.5, t: 0 });
  let kicked = 0;
  for (const l of leaves){ if (l.st !== 'ground') continue; const dx = l.x - w.x, dy = l.y - w.y, d = Math.hypot(dx, dy); if (d < 60 && d > 0.1){ kicked++; const f = (1 - d/60)*160; l.kx += dx/d*f; l.ky += dy/d*f*0.7; } }
  { const a = sndAt(w.x, w.y); sfx('kick', kicked, a.pan); }
}
const ptrs = new Map(); let drag = null, pinch = null;
cv.addEventListener('pointerdown', e => {
  try { cv.setPointerCapture(e.pointerId); } catch(_){}
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
  if (ptrs.size === 1) drag = { id: e.pointerId, moved: false };
  else if (ptrs.size === 2){ drag = null; const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x)/2, my: (a.y + b.y)/2 }; }
});
cv.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId);
  if (!p){ if (e.pointerType === 'mouse'){ const w = s2w(e.clientX, e.clientY); cv.style.cursor = hit(w.x, w.y) ? 'pointer' : 'grab'; } return; }
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (pinch && ptrs.size >= 2){
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x)/2, my = (a.y + b.y)/2;
    cam.ox += mx - pinch.mx; cam.oy += my - pinch.my;
    zoomAt(mx, my, d/pinch.d);
    pinch.d = d; pinch.mx = mx; pinch.my = my;
    return;
  }
  if (drag && drag.id === e.pointerId){
    if (!drag.moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 6){ drag.moved = true; cv.style.cursor = 'grabbing'; }
    if (drag.moved){ cam.ox += dx; cam.oy += dy; clampCam(); userMoved(); }
  }
});
function endPtr(e){
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  if (drag && drag.id === e.pointerId){ if (!drag.moved && e.type === 'pointerup') tap(e.clientX, e.clientY); drag = null; }
  // lifting one finger after a pinch: keep dragging with the other one (and don't treat it as a tap)
  if (pinch && ptrs.size === 1){ const [id] = ptrs.keys(); drag = { id, moved: true }; }
  if (ptrs.size < 2) pinch = null;
  if (!ptrs.size && e.pointerType === 'mouse') cv.style.cursor = 'grab';
}
cv.addEventListener('pointerup', endPtr);
cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('wheel', e => {
  e.preventDefault();
  const dy = e.deltaMode === 1 ? e.deltaY*30 : e.deltaY;
  zoomAt(e.clientX, e.clientY, Math.exp(-dy*(e.ctrlKey ? 0.01 : 0.0015)));
}, { passive: false });
const keys = new Set();
const PAN_KEYS = ['arrowleft','arrowright','arrowup','arrowdown','a','d','w','s'];
addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (PAN_KEYS.includes(k)){ keys.add(k); e.preventDefault(); }
  else if (k === '+' || k === '='){ zoomAt(W/2, H/2, 1.2); }
  else if (k === '-' || k === '_'){ zoomAt(W/2, H/2, 1/1.2); }
  else if (k === 'home' || k === '0'){ recenter(); }
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
function panKeys(dt){
  if (!keys.size) return;
  let kx = 0, ky = 0;
  if (keys.has('arrowleft') || keys.has('a')) kx += 1;
  if (keys.has('arrowright') || keys.has('d')) kx -= 1;
  if (keys.has('arrowup') || keys.has('w')) ky += 1;
  if (keys.has('arrowdown') || keys.has('s')) ky -= 1;
  if (!kx && !ky) return;
  const sp = 620*dt;
  cam.ox += kx*sp; cam.oy += ky*sp; clampCam(); userMoved();
}
$('recenter').addEventListener('click', recenter);
// stop the browser's own page zoom (iOS Safari) so pinching zooms the yard instead
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });

// ───────────────────────── full screen button (top right); hidden where the browser can't do it (iPhone Safari)
const fsBtn = $('fsBtn');
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
function fsToggle(){
  try {
    if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else { const d = document.documentElement, r = (d.requestFullscreen || d.webkitRequestFullscreen).call(d, { navigationUI: 'hide' }); if (r && r.catch) r.catch(() => {}); }
  } catch(e){}
}
function fsIcon(){ const on = !!fsEl(); fsBtn.classList.toggle('on', on); fsBtn.title = on ? 'Leave full screen (F)' : 'Full screen (F)'; fsBtn.setAttribute('aria-label', on ? 'Leave full screen' : 'Full screen'); }
// the installed app (Add to Home screen) already runs full screen, so it needs no button there
const installedApp = () => matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches && !fsEl();
if (document.fullscreenEnabled || document.webkitFullscreenEnabled){
  fsBtn.hidden = installedApp();
  matchMedia('(display-mode: fullscreen), (display-mode: standalone)').addEventListener?.('change', () => { fsBtn.hidden = installedApp(); });
  fsBtn.addEventListener('click', fsToggle);
  document.addEventListener('fullscreenchange', fsIcon); document.addEventListener('webkitfullscreenchange', fsIcon);
  addEventListener('keydown', e => { if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'f') fsToggle(); });
}

// ───────────────────────── sound button (bottom left) and unlocking audio on the first tap
const sndBtn = $('soundBtn');
function sndIcon(){ const on = !SND || SND.prefs.on; sndBtn.classList.toggle('off', !on); sndBtn.title = on ? 'Sound (M to mute)' : 'Sound is off (M to turn on)'; }
if (SND){
  const unlock = () => SND.unlock();
  addEventListener('pointerdown', unlock, true);
  addEventListener('keydown', unlock, true);
  SND.onChange(sndIcon); sndIcon();
  sndBtn.hidden = false;
  sndBtn.addEventListener('click', () => { SND.unlock(); if (cardOpen && cardOpen.kind === 'sound') closeCard(); else openCard('sound'); });
  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.toLowerCase() !== 'm') return;
    SND.toggle('on'); if (cardOpen && cardOpen.kind === 'sound') renderCard(true);
  });
  card.addEventListener('input', e => { if (e.target.id === 'sndVol') SND.set('vol', e.target.value/100); });
  card.addEventListener('change', e => { if (e.target.id === 'sndVol' && !SND.prefs.on && +e.target.value > 0){ SND.set('on', true); renderCard(true); } });
}

// ───────────────────────── toast
let toastTimer = 0;
function showToast(main, small, secs){ const t = $('toast'); t.innerHTML = main + (small ? '<small>' + small + '</small>' : ''); t.hidden = false; t.style.opacity = 1; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.style.opacity = 0; setTimeout(() => t.hidden = true, 700); }, secs*1000); }

// ───────────────────────── save / load
// a location copy (public/locationN/, see index.html) keeps its own save
const KEY = 'leaf-yard-save-v2' + (window.LOCATION ? '-' + window.LOCATION : '');
function save(){ if (simMode || FRESH) return; try { localStorage.setItem(KEY, JSON.stringify(truck.st === 'pay' ? Object.assign({}, S, { cash: S.cash + (truck.payAmt || 0) }) : S)); } catch(e){} }
function merge(base, src){ for (const k in src){ if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && base[k] && typeof base[k] === 'object') merge(base[k], src[k]); else if (k in base) base[k] = src[k]; } return base; }
function load(data){
  let src = data && data.S;
  if (!src && !FRESH){ try { const raw = localStorage.getItem(KEY); if (raw) src = JSON.parse(raw); } catch(e){} }
  if (src && src.v === 2){
    S = merge(freshState(), src);
    S.tech = Object.assign({}, src.tech || {});
    S.gen = Object.assign({}, src.gen || {});
    S.seen = Object.assign({}, src.seen || {});
    // V7: per-robot arrow keys became one key per track
    for (const k in S.seen){ const m = /^(?:rup:\d+|hup:[a-z]+\d+):(\w+)$/.exec(k); if (m) S.seen['trk:' + m[1]] = 1; }
    if (!src.seen){
      // a save from before the "new upgrade" arrows: anything you've already bought a level of counts as seen
      for (const k in S.lv) if (S.lv[k] > 0) S.seen['up:' + k] = 1;
      for (const k in (src.gen || {})) if (src.gen[k] > 0) S.seen['gen:' + k] = 1;
      (src.robots || []).forEach(r => { for (const k in (r.lv || {})) if (r.lv[k] > 0) S.seen['trk:' + k] = 1; });
      for (const kind of ['blower', 'shaker']) (src[KIND_LIST[kind]] || []).forEach(h => { for (const k in (h.lv || {})) if (h.lv[k] > 0) S.seen['trk:' + k] = 1; });
      if ((src.robots || []).length > 1) S.seen.robot = 1;
      if ((src.blowers || []).length) S.seen.blower = 1;
      if ((src.shakers || []).length) S.seen.shaker = 1;
      if (src.hive && src.hive.bees > 0) S.seen.bee = 1;
    }
    // V9: three veins (was five) and ten robots (was twelve); give back what was paid for miners, shafts and robots that are gone
    let v9back = 0;
    const firstV9 = !(src.flags && src.flags.v9);
    if (firstV9){
      const mv = sp => sp in OLD_SPOT_MAP ? OLD_SPOT_MAP[sp] : null;
      const oldShafts = src.shafts || [];
      for (const sp of (src.miners || [])) if (mv(sp) == null){ v9back += MINER_COST + (oldShafts.includes(sp) ? Math.round(SHAFT_COST*DISCOUNT) : 0); }
      S.miners = (src.miners || []).map(mv).filter(sp => sp != null);
      src.shafts = oldShafts.map(mv).filter(sp => sp != null);
      for (const r of (src.robots || [])) if (r.miner != null) r.miner = mv(r.miner);
      for (let i = ROBOT_MAX; i < (src.robots || []).length; i++) v9back += ROBOT_COST[i] || 0;
    }
    // task lists (V6): older saves had one focus per robot; turn it into the matching priority list
    S.robots = (src.robots || []).slice(0, ROBOT_MAX).map(r => {
      const prio = Array.isArray(r.prio) ? r.prio : r.job === 'mine' ? [['mine'], ['leaves']] : [['leaves']];
      return tasksFix({ prio, off: Array.isArray(r.off) ? r.off : [], miner: r.miner ?? null, lv: Object.assign(newRobotCfg().lv, r.lv || {}) }, 'robot');
    });
    S.flags.hints = Object.assign({}, (src.flags && src.flags.hints) || {});
    let v7back = 0;
    const firstV7 = !(src.flags && src.flags.v7);
    if (firstV7) for (const kind of ['blower', 'shaker']) if ((src[KIND_LIST[kind]] || []).length > HELPER_MAX) v7back += OLD_HELPER5[kind];
    for (const kind of ['blower', 'shaker']) S[KIND_LIST[kind]] = (src[KIND_LIST[kind]] || []).slice(0, HELPER_MAX).map(h => {
      const c = newHelperCfg(kind); Object.assign(c.lv, h.lv || {});
      if (Array.isArray(h.prio)){ c.prio = h.prio; c.off = Array.isArray(h.off) ? h.off : []; }
      else if (kind === 'shaker' && h.job === 'flower') c.prio = [['snip'], ['shake']];
      else if (kind === 'shaker') c.prio = [['shake']];
      else c.prio = [['blow']];
      return tasksFix(c, kind);
    });
    S.shafts = (src.shafts || []).filter(sp => S.miners.includes(sp));
    S.bag.bags = Math.max(0, S.bag.bags | 0); S.hive.gift = Math.max(0, S.hive.gift | 0); S.ingots = Math.max(0, S.ingots | 0);
    S.plant.ore = Math.max(0, Math.floor(+S.plant.ore || 0)); S.plant.rack = clamp(S.plant.rack | 0, 0, RACK_CAP); S.binMetal = Math.max(0, Math.floor(+S.binMetal || 0));
    if (!(src.flags && src.flags.v6)){
      // V6 cut Sort & bag leaves to 5 steps, Grade the metal to 2 and the honey labels to 2: refund the steps that are gone
      let back = 0;
      for (const k of ['leafPrice', 'metalPrice', 'honeyPrice']){ while (S.lv[k] > UP[k].max){ S.lv[k]--; back += upCost(k); } }
      if (back > 0){ S.cash += back; setTimeout(() => showToast('Refined!', 'Some old price upgrades turned into new buildings. You got ' + money(back) + ' back for them.', 9), 1200); }
      S.flags.v6 = true;
    }
    if (!(src.flags && src.flags.metalTub)){
      // the metal tub used to be 40% of the leaf bin; give older saves the tub size closest to what they had
      const old = Math.round(UP.bin.vals[clamp(S.lv.bin | 0, 0, UP.bin.max)]*0.4), nv = UP.metalBin.vals;
      let best = 0; if (S.metalSlot) nv.forEach((v, i) => { if (Math.abs(v - old) < Math.abs(nv[best] - old)) best = i; });
      S.lv.metalBin = best; S.flags.metalTub = true;
    }
    S.lv.leafPrice = clamp(S.lv.leafPrice | 0, 0, UP.leafPrice.max);
    if (!(src.flags && src.flags.bin9)){
      // older saves had a 7-step bin starting at 25: move to the new size closest to what they had
      const old = Math.round(25*Math.pow(1.5, clamp(S.lv.bin | 0, 0, 7))), nv = UP.bin.vals;
      let best = 0; nv.forEach((v, i) => { if (Math.abs(v - old) < Math.abs(nv[best] - old)) best = i; });
      S.lv.bin = best;
    }
    S.flags.bin9 = true;
    if (!(src.flags && src.flags.tiers5)){
      // older saves had 8 claw and 8 reach levels; move each robot to the new level with the closest value it already had
      const OLD = { grab:[1,2,3,4,5,6,8,10,12], reach:[20,32,44,56,68,82,96,110,125] };
      for (const c of S.robots) for (const k in OLD){ const v = OLD[k][clamp(c.lv[k] | 0, 0, 8)], nv = TRACKS[k].vals; let L = 0; while (L + 1 < nv.length && nv[L + 1] <= v) L++; c.lv[k] = L; }
      S.flags.tiers5 = true;
    }
    if (firstV7){
      // V7: the ingot pallet's size upgrades are gone (dry bundles share the log crib), the ant hill's tank and store have new
      // steps, and the hive holds at most MAX_BEES bees: give back whatever was paid for things that no longer exist
      for (let l=0; l<(S.lv.pallet | 0); l++) v7back += OLD_PALLET_COSTS[l] || 0;
      S.lv.pallet = 0;
      const remap = (k, oldVals, oldCosts) => {
        const L = clamp(S.lv[k] | 0, 0, oldVals.length - 1), had = oldVals[L], nv = UP[k].vals;
        let paid = 0; for (let l=0; l<L; l++) paid += oldCosts[l];
        let best = 0; nv.forEach((v, i) => { if (v <= had && i <= UP[k].max) best = i; });
        let now = 0; for (let l=0; l<best; l++) now += UP[k].costs[l];
        S.lv[k] = best; if (paid > now) v7back += paid - now;
      };
      if (S.hive.built){ remap('hiveTank', [60, 180, 520, 1500], [70, 420, 3500]); remap('hiveStore', [6, 20, 60, 180], [60, 450, 3800]); }
      const bees = S.hive.bees | 0; for (let n=MAX_BEES; n<bees; n++) v7back += niceCost(3*Math.pow(1.15, n));
      S.flags.v7 = true;
    }
    if (v7back > 0){ S.cash += v7back; setTimeout(() => showToast('Rebalanced!', 'A few things you owned work differently now. You got ' + money(v7back) + ' back for them.', 9), 1500); }
    S.flags.v9 = true;
    if (!(src.flags && src.flags.v11)){
      // V11: wrapping is its own task. Robots that filled jars with Gift wrapping bought wrapped every jar, so they get
      // Wrap gift jars beside Fill honey jars; Gift wrapping and the ribbons cost less now, so the difference comes back
      let back = 0;
      if (S.hive.packing){
        back += 800 - HONEY_PACK_COST;
        for (const c of S.robots) if (taskOn(c, 'jar') && !taskOn(c, 'wrap')){ taskRemove(c, 'wrap'); const i = c.prio.findIndex(r => r.includes('jar')); if (c.prio[i].length < 2) c.prio[i].push('wrap'); else c.prio.splice(i + 1, 0, ['wrap']); }
      }
      back += [0, 300, 1000][clamp(S.lv.giftPrice | 0, 0, 2)];
      S.flags.v11 = true;
      if (back > 0){ S.cash += back; setTimeout(() => showToast('Gift wrapping', 'Wrapping gift baskets is its own task now, and gift baskets sell for more. You got ' + money(back) + ' back on wrapping and ribbons.', 9), 1700); }
    }
    if (v9back > 0){ S.cash += v9back; setTimeout(() => showToast('Rebalanced!', 'There are fewer piles and robot slots now. You got ' + money(v9back) + ' back for the ones that are gone.', 9), 1600); }
    for (const k in UP) S.lv[k] = clamp(S.lv[k] | 0, 0, UP[k].max);
    S.hive.bees = clamp(S.hive.bees | 0, 0, MAX_BEES*2); S.hive.nectar = Math.max(0, +S.hive.nectar || 0); S.hive.honey = Math.max(0, +S.hive.honey || 0);
    if (src.hive && src.hive.jars === undefined){
      // before V6.3 the hive filled the jars itself: what it held were finished jars, so they go in the crate
      S.hive.jars = Math.floor(S.hive.honey + 1e-9); S.hive.honey = 0;
      if (S.hive.built && !S.robots.some(c => taskOn(c, 'jar'))){ const c = S.robots[S.robots.length - 1]; c.prio.unshift(['jar']); tasksFix(c, 'robot'); }
    }
    S.hive.jars = Math.max(0, S.hive.jars | 0);
    if (!src.peak) S.peak = Math.max(S.cash, 0);
    if (!S.robots.length) S.robots = [newRobotCfg()];
    S.land = clamp(S.land | 0, 0, AREAS.length - 1);
  }
}
function seedLeaves(){ leaves = []; for (let i=0;i<Math.round(AREAS[S.land].cap*0.6);i++) spawnCollectable(true); }
function hardReset(){
  try { localStorage.removeItem(KEY); } catch(e){}
  S = freshState(); R = []; HB = []; B = []; parts = []; pops = []; dispCash = 0; truck.st = 'away'; truck.fill = 0; resetStations();
  for (const f of FLOWERS){ f.full = true; f.t = 0; f.claim = null; }
  closeCard(); syncRobots(); seedLeaves();
  userCam = false; $('recenter').hidden = true;
  Object.assign(cam, camTarget(0)); camAnim = null; buildGround(cam);
}
setInterval(save, 5000);
addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

// ───────────────────────── loop
let last = 0;
function frame(ts){
  const dt = Math.min(0.05, (ts - last)/1000 || 0.016); last = ts;
  const n = Math.ceil(TIME_SCALE);
  for (let i=0;i<n;i++) step(dt*TIME_SCALE/n);
  if (camAnim){
    camAnim.t += dt;
    const e = ease(clamp(camAnim.t/camAnim.dur, 0, 1));
    cam.z = lerp(camAnim.from.z, camAnim.to.z, e); cam.ox = lerp(camAnim.from.ox, camAnim.to.ox, e); cam.oy = lerp(camAnim.from.oy, camAnim.to.oy, e);
    if (camAnim.t >= camAnim.dur) camAnim = null;
    if (cardOpen) placeCard();
  }
  panKeys(dt);
  if (!camAnim && performance.now() - camMovedT > 140 && !groundCovers()) buildGround({ z: cam.z, ox: cam.ox, oy: cam.oy });
  updHud(dt);
  if (SND){ SND.update(dt, wind); if (SND.rain) SND.rain(dt, RAIN.k); ambientChatter(dt); }
  if (cardOpen){ renderCard(false); if ((seenT -= dt) <= 0){ seenT = 0.25; markSeen(); } }
  updHints(dt);
  updRain(dt*TIME_SCALE);   // RAINY HOLLOW
  draw();
  requestAnimationFrame(frame);
}

// ───────────────────────── headless pacing simulation (balancing helper)
// the pacing sim's stand-in for a player sorting out task lists: a share of the robots bag, pack honey, smelt and haul
function simTasks(){
  const n = S.robots.length, want = { bag: S.bag.built ? Math.max(1, Math.round(n*0.3)) : 0, jar: S.hive.built ? (S.hive.bees >= 12 ? 2 : 1) : 0, smelt: S.plant.built ? Math.min(3, Math.max(1, Math.floor(n/3))) : 0, haul: S.plant.built ? 1 : 0 };
  for (const t in want){
    let have = S.robots.filter(c => taskTop(c, t)).length;
    for (let j = n - 1; j >= 0 && have < want[t]; j--){
      const c = S.robots[j];
      if (!c.prio.length || !c.prio[0].includes('leaves') || c.prio[0].length > 1) continue;
      putTop(c, t); have++;
      const r = R[j]; if (r && (r.st === 'wander' || r.st === 'rest' || r.st === 'seek')){ release(r); r.st = 'idle'; }
    }
  }
}
window.__leafYard = {
  sim(seconds, opts){
    opts = opts || {};
    simMode = true;
    const keep = { S, R, HB, B, leaves, parts, pops, tst: truck.st, fl: FLOWERS.map(f => [f.full, f.t, f.claim]), stn: JSON.stringify(STN) };
    S = freshState(); R = []; HB = []; B = []; truck.st = 'away'; parts = []; pops = []; resetStations(); seedLeaves();
    for (const f of FLOWERS){ f.full = true; f.t = 0; f.claim = null; }
    if (opts.setup) opts.setup(S);
    const log = [], dtS = 1/20; let next = 0, nextMark = 60;
    const MILE = opts.mile || ['robot','land','metalSlot','miner','tech','blower','shaker','hive','bagger','honeyPack','plant','shaft'];
    for (let t=0; t<seconds; t+=dtS){
      step(dtS);
      if (opts.probe) opts.probe(HB);
      if (S.t >= next && !opts.noBuy){
        next = S.t + 1;
        let o = offers(true);
        if (opts.priority){
          const pr = o.filter(x => MILE.includes(x.id)).sort((a,b) => a.cost - b.cost);
          if (pr.length) o = o.filter(x => MILE.includes(x.id) ? x === pr[0] : x.cost < pr[0].cost*0.2);
        }
        o = o.filter(x => x.cost <= S.cash).sort((a,b) => a.cost - b.cost);
        if (opts.filter) o = o.filter(opts.filter);   // lets a pacing test hold money back (e.g. saving up for land)
        // keep every miner staffed (but leave at least one robot on leaves once there are three)
        for (const sp of S.miners){ if (minerWorkers(sp).length >= slotsAt(sp)) continue; const leafers = S.robots.map((c, j) => j).filter(j => taskTop(S.robots[j], 'leaves')); if (leafers.length > (S.robots.length > 2 ? 1 : 0)) assign(leafers[leafers.length - 1], sp); }
        if (opts.manage) opts.manage(S, R);
        else if (opts.autoTasks !== false) simTasks();
        if (o.length){ const b = o[0]; buy(b); log.push(Math.round(S.t) + 's ' + b.id + (b.key ? ':' + b.key : '') + (b.ri != null ? '#' + b.ri : '') + (b.id === 'land' ? ':' + S.land : '') + ' $' + b.cost); }
      }
      if (S.t >= nextMark){ nextMark += 60; log.push('@' + Math.round(S.t/60) + 'm leaves=' + S.totals.leaves + ' wet wood=' + S.totals.metal + ' earned=' + S.totals.cash.toFixed(1) + ' ground=' + groundN + ' shakes=' + (S.totals.shakes || 0) + ' $/leaf=' + leafPrice().toFixed(2) + (S.hive.built ? ' ants=' + S.hive.bees + ' mushrooms=' + (S.totals.honey || 0) + ' nectarIn=' + Math.round(S.totals.nectar || 0) + ' tank=' + Math.round(S.hive.nectar) + ' store=' + Math.floor(S.hive.honey) + ' idle=' + B.filter(b => b.st === 'loiter').length + ' q=' + B.filter(b => b.st === 'queue').length : '')); }
    }
    const gl0 = leaves.filter(l => l.st === 'ground' && l.collect), near = gl0.filter(l => Math.hypot(l.x - BIN.x, l.y - BIN.y) < 250).length;
    const out = { blown: S.totals.blown || 0, near, groundAll: gl0.length, avgD: Math.round(gl0.reduce((a, l) => a + Math.hypot(l.x - BIN.x, l.y - BIN.y), 0)/Math.max(1, gl0.length)), log, t:S.t, cash:S.cash, land:S.land, robots:S.robots.map(r => r.lv), extra:{ blowers:S.blowers.map(b => b.lv), shakers:S.shakers.map(b => b.lv), lv:S.lv }, miners:S.miners.length, totals:S.totals, tech:Object.keys(S.tech), jobs:S.robots.map(r => r.prio.map(row => row.join('+')).join(' > ')) };
    S = keep.S; R = keep.R; HB = keep.HB; B = keep.B; leaves = keep.leaves; parts = keep.parts; pops = keep.pops; truck.st = keep.tst; simMode = false;
    { const st = JSON.parse(keep.stn); for (const k in STN) STN[k] = st[k]; }
    FLOWERS.forEach((f, i) => { [f.full, f.t, f.claim] = keep.fl[i]; });
    return out;
  },
  state: () => S,
  peek: f => f({ S, R, HB, B, RAIN, truck }),
  setCam: (x, y, z) => { cam.z = z; cam.ox = W/2 - x*z; cam.oy = H/2 - y*z; userCam = true; camAnim = null; buildGround(cam); },
  open: (kind, i) => openCard(kind, i),
  portrait: (kind, i, cv, z) => drawPortrait(cv, kind, i, z),
  buy: o => buy(o),
  fn: () => ({ UP, GEN, offers, binCap, metalCap, hopperCap, honeyCap, tankCap, palletCap, truckEvery, bagCap, upCost, rCost, allPlan, binRoom, tubRoom, hopperRoom, plainJars, crateCap, crateJars }),   // for balance tests
  stations: () => STN,
  treeDrop: () => treeDrop(true),
  bounds: () => ({ view: visRect(), bounds: camBounds() }),
  cam: () => ({ ...cam }),
  robots: () => R,
  helpers: () => HB,
  bees: () => B,
  flowers: () => FLOWERS,
  leaves: () => leaves,
  w2s,
};

// WILDFLOWER PRAIRIE: the test slider under the cash tag (0–1000 $/s from the first yard)
function initPassive(){
  const el = $('lpRange'), out = $('lpVal'); if (!el) return;
  const show = () => { out.textContent = '$' + Math.round(S.passive || 0).toLocaleString('en-US') + '/s'; };
  el.value = S.passive || 0; show();
  el.addEventListener('input', () => { S.passive = clamp(+el.value || 0, 0, 1000); show(); });
  el.addEventListener('change', save);
  for (const ev of ['pointerdown', 'keydown', 'wheel']) el.parentNode.addEventListener(ev, e => e.stopPropagation());
}
function start(data){
  load(data);
  initPassive();
  W = innerWidth; H = innerHeight;
  buildCanopies(); buildBushes(); buildFlowerSprites(); buildFlowers();
  resize();
  syncRobots(); fixSlots();
  seedLeaves();
  for (let i=0;i<10;i++) spawnAmbient();
  dispCash = S.cash;
  addEventListener('resize', resize);
  if (window.claude && window.claude.hot && window.claude.hot.snapshot){ try { window.claude.hot.snapshot(() => ({ S })); } catch(e){} }
  requestAnimationFrame(ts => { last = ts; requestAnimationFrame(frame); });
}
const go = () => window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
if (document.fonts && document.fonts.load) Promise.race([Promise.all([document.fonts.load('700 16px Caveat'), document.fonts.load('700 14px "Baloo 2"')]), new Promise(r => setTimeout(r, 1500))]).then(go, go);
else go();
})();
