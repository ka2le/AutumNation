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
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ───────────────────────── lots, and the trips between them (V13)
// The game can be played in more than one place (a "lot"). Each lot keeps its own save; WORLD remembers which one
// you're on, and hands things over when a robot rides the truck to another lot (see travel() and arrive()). Going
// somewhere reloads the page: a lot's layout and look (land, trees, veins, flowers, colours) are fixed when the page
// starts. 'home' is the first yard and is described right here in game.js; every other lot has a file of its own in
// public/lots/ (loaded before game.js) that says what's different about it.
const WORLD_KEY = 'leaf-yard-world-v1', HOP_KEY = 'leaf-yard-hop';
const BASE_KEY = 'leaf-yard-save-v2' + (window.LOCATION ? '-' + window.LOCATION : '');
const lotKey = id => BASE_KEY + (id && id !== 'home' ? '-' + id : '');
// ?fresh never saves; a trip in a ?fresh game hands everything to the next page once, through sessionStorage
const HOP = (() => {
  if (!FRESH) return null;
  try { const h = sessionStorage.getItem(HOP_KEY); sessionStorage.removeItem(HOP_KEY); return h ? JSON.parse(h) : null; } catch(e){ return null; }
})();
const WORLD = (() => {
  let w = null;
  if (HOP) w = HOP.world;
  else if (!FRESH){ try { w = JSON.parse(localStorage.getItem(WORLD_KEY) || 'null'); } catch(e){} }
  if (!w || typeof w !== 'object') w = {};
  if (FRESH && !HOP && PARAMS.get('lot')) w.cur = PARAMS.get('lot');   // dev: ?fresh&lot=prairie starts a new game on another lot
  if (!w.cur || (w.cur !== 'home' && !(window.LOTS && window.LOTS[w.cur]))) w.cur = 'home';
  return w;
})();
const LOT_ID = WORLD.cur;
// the game's helpers for lot files (filled in just before the game starts; V14: live state like S and ctx are getters,
// so a lot's drawing code reads them as const { S, ctx } = H). Asking for one that isn't there warns in the console.
let LH_READY = false;
const LH = new Proxy({}, { get(t, k){ if (LH_READY && typeof k === 'string' && !(k in t)) console.warn('lot helper missing: ' + k); return t[k]; } });
const LOT = LOT_ID === 'home' ? { id: 'home', name: 'Cottage yard' } : window.LOTS[LOT_ID](LH);
const FRESH_SAVES = (HOP && HOP.saves) || {};   // ?fresh: the other lots' states, carried from page to page
// a lot's saved state (parsed), or null
function readLot(id){
  try { const raw = FRESH ? FRESH_SAVES[lotKey(id)] : localStorage.getItem(lotKey(id)); return raw ? JSON.parse(raw) : null; } catch(e){ return null; }
}
function saveWorld(){ if (FRESH) return; try { localStorage.setItem(WORLD_KEY, JSON.stringify(WORLD)); } catch(e){} }
// the words a lot uses for things (the prairie's "leaves" are petals): applied to card text, pops and toasts
const WORDS = LOT.words || null;
const wordT = WORDS ? s => String(s).replace(/\b(leaf|leaves|Leaf|Leaves|LEAVES)\b/g, w => WORDS[w] || w) : s => s;
// V14: a lot can also swap whole phrases (the Rainy hollow: metal is wet wood, bees are ants, ...): LOT.phrases is an
// ordered list of [regex source, replacement or function]; at any spot the first that matches wins
function makePhrases(list){
  const re = new RegExp(list.map(p => '(' + p[0].replace(/(?<!\\)\((?!\?)/g, '(?:') + ')').join('|'), 'g');
  return s => String(s).replace(re, (m, ...g) => { const i = g.findIndex((x, k) => k < list.length && x !== undefined); const r = list[i][1]; return typeof r === 'function' ? r(m) : r; });
}
const PHRASE = LOT.phrases ? makePhrases(LOT.phrases) : null;
const sayT = PHRASE ? s => PHRASE(wordT(s)) : wordT;
const sayH = WORDS || PHRASE ? h => String(h).replace(/(<[^>]*>)|([^<]+)/g, (m, tag, txt) => tag ? tag.replace(/(title|aria-label)="([^"]*)"/g, (a, k, v) => k + '="' + sayT(v) + '"') : sayT(txt)) : h => h;

// ───────────────────────── world layout (world units; the curb is y = 0, your land is y < 0)
const ROAD = 84, LANE = 56, VERGE = 30;
// V6: the road row is spaced out, with room for small work buildings: the bagging table between the pickup sign and the
// bin, and the ingot pallet between the metal tub and the honey crate.
const BIN = { x: 28, y: -12 }, TUB = { x: 86, y: -12 }, SIGN = { x: -110, y: -8 }, SHED = { x: -222, y: -22 }, PARK = 50;
const BAGGER = { x: -48, y: -14 };  // the bagging table (built later) between the pickup sign and the bin
const PALLET = { x: 138, y: -12 };  // the ingot pallet (where haulers drop ingots for the truck), right of the metal tub
const HIVE = { x: 250, y: -20 };   // the robot beehive stands at the right end of the row
const CRATE = { x: 190, y: -12 };  // the honey crate (jars waiting for the truck) sits between the ingot pallet and the hive
const PLANT = LOT.PLANT || { x: 190, y: -240 }; // the smelting plant, up in the right half of the cottage plot
// V7: land costs more, and the cottage plot runs short sooner (its small trees give shakers fewer leaves, see
// treeYieldMul), so you feel the need for the meadow before you can buy it. Leaves sell for a little more to keep the
// overall pace about where it was.
const AREAS = LOT.AREAS || [
  { w: 580,  h: 380,  name: 'Cottage plot', spawn: 1.0, cap: 60 },
  { w: 1280, h: 720,  name: 'Meadow',       spawn: 2.8, cap: 220, cost: 300 },
  { w: 2000, h: 1150, name: 'Old orchard',  spawn: 5.6, cap: 380, cost: 3800 },
];
// Metal veins: one very close to the bin, one fairly close, the rest a long walk away.
// V7: veins differ in richness (chunks come that much faster): the one on the cottage plot is thin, so the meadow's
// veins are worth having, and the far orchard veins pay for the long walk.
// V9: one vein per plot (three in all). Saves from before V9 had five; `OLD_SPOT_MAP` moves their miners over.
const SPOTS = LOT.SPOTS || [
  { x: 128,  y: -118, land: 0, rich: 0.85 },
  { x: 425,  y: -175, land: 1, rich: 1 },
  { x: -870, y: -430, land: 2, rich: 1.2 },
];
// V13: a lot can keep its metal for later land (the prairie's only vein is in the meadow)
const MINE_LAND = LOT.MINE_LAND || 0;
const metalOpen = () => S.land >= MINE_LAND;
// V14: a lot's own art (drawing functions that replace the first yard's: lots/hollow.js), and two things only some lots
// have: rain and puddles (RAINY), and wood that gets wet on the way to the road, with a blower's umbrella (WET_WOOD)
const ART = LOT.art || {};
const RAINY = !!LOT.rain, WET_WOOD = !!LOT.wetWood;
const DBG = (PARAMS.get('dbg') || '').split(',');   // dev: ?dbg=nopud,norain,nomist,noglow to profile the rain
const PUDDLES = LOT.PUDDLES || [];
// the outline of a puddle: a wobbly ellipse
function puddlePts(p, grow){
  const rnd = mulberry(p.seed), s1 = rnd()*TAU, s2 = rnd()*TAU, s3 = rnd()*TAU, N = 22, out = [];
  for (let k=0;k<N;k++){ const a = k/N*TAU, r = 1 + 0.16*Math.sin(2*a + s1) + 0.09*Math.sin(3*a + s2) + 0.05*Math.sin(5*a + s3); out.push([p.x + Math.cos(a)*(p.rx*r + grow), p.y + Math.sin(a)*(p.ry*r + grow*0.45)]); }
  return out;
}
function puddleTrace(c, p, grow){ const P = puddlePts(p, grow || 0); c.beginPath(); P.forEach(([x, y], i) => { const n = P[(i + 1) % P.length], mx = (x + n[0])/2, my = (y + n[1])/2; i ? c.quadraticCurveTo(x, y, mx, my) : c.moveTo(mx, my); }); const f = P[0], n = P[1]; c.quadraticCurveTo(f[0], f[1], (f[0] + n[0])/2, (f[1] + n[1])/2); c.closePath(); }
const inPuddle = (p, x, y, m = 0) => { const dx = (x - p.x)/(p.rx*0.92 + m), dy = (y - p.y)/(p.ry*0.92 + m*0.45); return dx*dx + dy*dy < 1; };
const puddleAt = (x, y, m) => { for (const p of PUDDLES) if (inPuddle(p, x, y, m)) return p; return null; };
// a lot can switch its land sale off (the prairie: no For Sale sign, so no bigger yard there). Its AREAS stay as they
// are, so setting landForSale back to true (or removing it) brings the sign back.
const LAND_SALE = LOT.landForSale !== false;
const landForSale = () => LAND_SALE && S.land + 1 < AREAS.length;
const OLD_SPOT_MAP = { 0: 0, 1: 1, 3: 2 };   // old vein index -> new one; old veins 2 and 4 are gone (refunded)
const veinWord = sp => { const v = SPOTS[sp].rich || 1; return v < 0.9 ? 'a thin vein' : v > 1.15 ? 'a rich vein' : v > 1.02 ? 'a good vein' : 'a fair vein'; };
const TREES = LOT.TREES || [
  { x: -300, y: -440, r: 135, seed: 11 }, { x: 352, y: -472, r: 150, seed: 23 }, { x: 30, y: -565, r: 125, seed: 37 },
  { x: -770, y: -820, r: 190, seed: 41 }, { x: 770, y: -770, r: 185, seed: 53 }, { x: -90, y: -905, r: 170, seed: 61 },
  { x: -1130, y: -330, r: 190, seed: 71 }, { x: 1140, y: -1060, r: 200, seed: 83 }, { x: -560, y: -1310, r: 190, seed: 97 },
  { x: 560, y: -1335, r: 180, seed: 101 }, { x: 1150, y: -330, r: 170, seed: 113 }, { x: -1180, y: -1060, r: 190, seed: 127 },
  // two smaller trees inside the cottage plot: one in the middle, one beside the workshop (V6: moved from the right
  // corner to make room for the hive and the smelting plant)
  { x: -30, y: -255, r: 62, seed: 131, fam: ['gold','orange'] }, { x: -256, y: -208, r: 52, seed: 137, fam: ['red','rust'] },
];
// shrubs on your own land (wild ones beyond the fence are baked into the ground); shakers can shake these too
const BUSHES = LOT.BUSHES || [ { x: -168, y: -268, s: 1.05, seed: 7 }, { x: -122, y: -340, s: 0.95, seed: 19 } ];
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
  metalPrice: { obj:'bin',  name:'Grade the metal',   max:6, gaps:[{n:2}],  costs:[40, 76, 400, 1800, 3500, 6000], vals:[4.8, 6, 7.5, 9.2, 11.2, 13.6, 16.5], val:l=>UP.metalPrice.vals[l],
                show:v=>money(v)+' / metal' + (S.plant.built ? ' · ' + money(ORE_PER_INGOT*v*val('ingotGrade')*sellMul()) + ' / ingot' : '') },
  // V7: a bigger tub also makes the ingot pallet beside it bigger (palletCap), the way the bin's bag shelf grows with the bin
  metalBin:   { obj:'bin',  name:'Bigger metal tub',  max:8,  costs:[30, 55, 90, 160, 320, 700, 1600, 3500], vals:[8, 12, 18, 27, 40, 60, 90, 135, 200], val:l=>UP.metalBin.vals[l], show:v=>v+' metal' },
  // more pickups is a big lever (it makes bin size matter less): V7 makes it dear from the second step on
  truck:      { obj:'sign', name:'Book more pickups', max:7,  costs:[2, 8, 28, 90, 260, 700, 1800], val:l=>[45,38,32,27,23,19,16,14][l], show:v=>'every '+v+'s' },
  // three one-off deals with the truck: a cash bonus for every 100 leaves it takes. With Sort & bag maxed ($0.62),
  // the top deal brings a leaf to about $1.20. Each tier is a big jump that costs a lot at the time you can first afford it.
  cleanup:    { obj:'sign', name:l=>['Join the cleanup program', 'Town cleanup contract', 'County compost deal'][Math.min(l, 2)], max:3, costs:[20, 300, 400],
                vals:[0, 18, 42, 70], val:l=>UP.cleanup.vals[l], show:v=>v ? '$'+v+' per 100 leaves' : 'no bonus yet' },
  // the beehive. V7: more, smaller steps priced against what the honey earns, so the store keeps up with the bees
  hiveTank:   { obj:'hive', name:'Bigger nectar tank', max:4, costs:[60, 190, 520, 1400], vals:[70, 140, 270, 470, 800], val:l=>UP.hiveTank.vals[l], show:v=>v+' nectar' },
  hiveStore:  { obj:'hive', name:'Bigger honey store', max:6, costs:[40, 110, 280, 600, 1200, 2400], vals:[6, 12, 20, 32, 50, 80, 120], val:l=>UP.hiveStore.vals[l], show:v=>v+' jars' },
  // V8: a little more to start with and four more label steps for the late game. V9: the late steps are much cheaper
  // (honey is capped by flowers and packers, so its income can't keep up with ×3 prices)
  honeyPrice: { obj:'hive', name:'Fancy honey labels', max:6, costs:[90, 300, 650, 1000, 1800, 2800], vals:[2.9, 3.8, 5, 6.4, 8, 10, 12.5], val:l=>UP.honeyPrice.vals[l], show:v=>money(v)+' / jar' },
  // V6: once a robot packs honey at the crate, gift jars (cloth top, twine and a tag) sell for more than plain ones.
  // V11: wrapping is its own task and takes almost as long as filling the jar, so a gift jar is worth a lot more (2.6×,
  // about what the old top ribbon gave) and the ribbons are cheaper
  giftPrice:  { obj:'hive', name:'Gift jar ribbons', max:2, costs:[700, 1500], vals:[2.6, 3.1, 3.7], val:l=>UP.giftPrice.vals[l], show:v=>money(val('honeyPrice')*v*sellMul())+' a gift jar' },
  // the smelting plant
  smeltSpeed: { obj:'plant', name:'Hotter furnace',  max:3, costs:[400, 1000, 1500], vals:[1, 1.3, 1.65, 2.1], val:l=>UP.smeltSpeed.vals[l], show:v=>v.toFixed(2)+'× furnace heat' },
  // V8: an ingot is worth ORE_PER_INGOT metal at the current grade × the alloy (was a flat $36 → $66), two more steps
  ingotGrade: { obj:'plant', name:'Better alloy',    max:5, costs:[500, 1900, 3200, 6000, 7000], vals:[1.45, 1.75, 2.15, 2.6, 3.1, 3.6], val:l=>UP.ingotGrade.vals[l], show:v=>money(ORE_PER_INGOT*val('metalPrice')*v*sellMul())+' / ingot' },
  // V6.3: every ingot takes 4 whole metal; slag recovery adds bonus ingots (a counter fills up, so it's always whole ingots)
  slag:       { obj:'plant', name:'Slag recovery',   max:3, costs:[450, 1100, 2800], vals:[0, 0.11, 0.25, 0.43], val:l=>UP.slag.vals[l], show:v=>v ? '+' + Math.round(v*100) + '% ingots' : 'no extra ingots' },
  hopper:     { obj:'plant', name:'Bigger ore hopper', max:3, costs:[80, 260, 700], vals:[24, 40, 64, 100], val:l=>UP.hopper.vals[l], show:v=>v+' ore' },
};
// V7: the ingot pallet no longer has a size of its own (ingots share the metal tub's room); old saves get its price back
const OLD_PALLET_COSTS = [60, 200, 600];
// V6 refinement: buildings and constants
const BAG_SIZE = 10;            // leaves in a bag
const BAGGER_COST = 18;         // the bagging table: a bit more than the next sorting step would have been
const HONEY_PACK_COST = 550;    // Gift wrapping: opens the Wrap task at the crate (V11: was 800)
const PLANT_COST = 500;         // the smelting plant (V7: was 300)
const SHAFT_COST = 350;         // turning a miner into a mine shaft (a copied one costs half)
const RACK_CAP = 10;  // ingots waiting on the plant's rack (the ore hopper's size is UP.hopper)
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
  drill: { label:'Drill', gens:[
      { name:'Hand drill', n:3, cost:[25, 40, 60], needsMetal:true },
      { tech:'diamond', name:'Diamond bit', n:4, cost:[110, 160, 230, 330] } ],
    vals:[4,3.4,2.9,2.5, 2.1,1.8,1.55,1.35], show:v=>v.toFixed(1)+'s per chunk' },
  magnet: { label:'Magnet', gens:[
      { name:'Fridge magnet', n:3, cost:[35, 55, 80], needsMetal:true },
      { tech:'horseshoe', name:'Horseshoe magnet', n:4, cost:[120, 170, 240, 330] },
      { tech:'electro', name:'Electromagnet', n:4, cost:[480, 680, 950, 1300] } ],
    vals:[0, .06,.11,.16, .22,.28,.34,.40, .48,.56,.64,.72], show:v=>v ? Math.round(v*100)+'% double metal' : 'no double metal' },
  // helper robots: blowers push far-off leaves toward the bin, shakers shake trees and bushes for extra leaves
  // V13.7: 8 levels instead of 11 (2 + 3 + 3) over the same range, and a gentler price climb (~75× first to last, was ~190×)
  blow: { label:'Blower', gens:[
      { name:'Desk fan', n:2, cost:[8, 15] },
      { tech:'turbine', name:'Leaf turbine', n:3, cost:[60, 95, 140] },
      { tech:'jet', name:'Jet nozzle', n:3, cost:[300, 420, 600] } ],
    vals:[1, 1.35, 1.75, 2.2, 2.75, 3.4, 4.1, 4.9, 5.8], show:v=>v.toFixed(2)+'× blow power' },
  shake: { label:'Shake', gens:[
      { name:'Gentle wiggle', n:2, cost:[7, 13] },
      { tech:'pincers', name:'Hydraulic pincers', n:3, cost:[50, 80, 120] },
      { tech:'rumble', name:'Rumble claws', n:3, cost:[260, 360, 520] } ],
    vals:[6, 8, 10, 13, 16, 20, 25, 31, 38], show:v=>v+' leaves from a big tree' },
  // shakers with shears can deadhead spent flowers so a fresh bloom pops up for the bees right away
  snip: { label:'Shears', gens:[ { name:'Garden shears', n:1, cost:[40] } ],
    vals:[0, 1], show:v=>v ? 'can deadhead flowers' : 'trees only' },
  // V6: packing & refining: how fast a robot bags leaves, fills honey jars and smelts ingots.
  // V7: a robot starts clumsier, every level is bought at full price (no copied-level discount), and the last tier is
  // much stronger, so a robot you train up as a packer is worth the money.
  pack: { label:'Packing', gens:[
      { name:'Clumsy hands', n:3, cost:[3, 6, 11], needsPack:true },
      { tech:'jig', name:'Packing jig', n:4, cost:[22, 36, 56, 85] },
      { tech:'precision', name:'Precision tools', n:4, cost:[280, 450, 700, 1100] } ],
    vals:[0.6, 0.72, 0.84, 0.96, 1.12, 1.3, 1.5, 1.75, 2.3, 2.95, 3.7, 4.6], show:v=>v.toFixed(2)+'× packing speed' },
  // V12: how quickly a robot works through the old picture book (the Research task). The robot holding the book does
  // RESEARCH_MAIN units a second, each robot helping RESEARCH_HELP; every level doubles that robot's share.
  study: { label:'Research', gens:[
      { name:'Squinting at pictures', n:0, cost:[], needsBook:true },
      { name:'Reading glasses', n:1, cost:[5] },
      { name:'Speed reading', n:1, cost:[80] },
      { name:'Photographic memory', n:1, cost:[200] } ],   // V13.1: up to 16 × 4 = 64 research a second for the reader
    vals:[1, 2, 4, 16], show:v=>v+'× research' },
  // V6: blowers at a mine shaft suck up dirt so the robots mining there get on faster. Level 1 teaches it.
  dig: { label:'Excavate', gens:[
      { name:'Dirt hose', n:3, cost:[70, 120, 200], needsShaft:true },
      { tech:'cyclone', name:'Grit cyclone', n:4, cost:[320, 460, 650, 900] } ],
    vals:[0, .25, .35, .45, .58, .7, .82, .95], show:v=>v ? '+' + Math.round(v*100) + '% mining at a shaft' : 'can’t excavate yet' },
  // V6.2: blowers can work the bellows at the smelting plant: blowing into the furnace makes every smelter faster
  stoke: { label:'Bellows', gens:[
      { name:'Air hose', n:3, cost:[150, 260, 420], needsPlant:true },
      { tech:'forge', name:'Forge blast', n:4, cost:[600, 850, 1200, 1700] } ],
    vals:[0, .15, .22, .3, .4, .5, .6, .7], show:v=>v ? '+' + Math.round(v*100) + '% smelting speed' : 'can’t work the bellows yet' },
  // V14 (the Rainy hollow, WET_WOOD): a blower can learn to carry a big wooden umbrella over a robot hauling dry wood
  brolly: { label:'Umbrella', gens:[ { name:'Wood umbrella', n:1, cost:[900], needsPlant:true } ],
    vals:[0, 1], show:v=>v ? 'carries the wood umbrella' : 'no umbrella yet' },
};

const TRACK_ORDER = ['speed','carry','pick','grab','reach','drill','magnet','pack','study'];
// which tracks each kind of robot has. Wheels are shared by every kind, so copied-level discounts work across all of them.
const BOT_TRACKS = { robot: TRACK_ORDER, blower: ['speed', 'blow', 'dig', 'stoke', ...(WET_WOOD ? ['brolly'] : [])], shaker: ['speed', 'shake', 'snip'] };
const TECH = {
  treads:  { name:'Rubber treads',     track:'speed', cost:3,   desc:'Four new wheel upgrades for every robot.' },
  hamper:  { name:'Wicker hamper',     track:'carry', cost:3.5, desc:'Four new basket upgrades.' },
  servos:  { name:'Quick servos',      track:'pick',  cost:4,   desc:'Four faster pickup upgrades.' },
  claw:    { name:'Claw rake',         track:'grab',  cost:6,   desc:'Robots scoop up several leaves in one grab. Five claw upgrades, up to 12 leaves.' },
  arm:     { name:'Telescoping arm',   track:'reach', cost:7,   desc:'Robots grab leaves from further away. Five reach upgrades. Pairs well with the claw rake.' },
  hubs:    { name:'Ball-bearing hubs', track:'speed', cost:45,  needs:'treads', desc:'Wheel upgrades 8 to 11.' },
  hopper:  { name:'Spring hopper',     track:'carry', cost:40,  needs:'hamper', desc:'Basket upgrades 8 to 11.' },
  diamond: { name:'Diamond drill bit', track:'drill', cost:350, needsMiner:true, desc:'Four faster drill upgrades.' },
  horseshoe:{ name:'Horseshoe magnet', track:'magnet', cost:260, needsMiner:true, desc:'Magnet upgrades 4 to 7: a better chance of double metal.' },
  electro: { name:'Electromagnet',     track:'magnet', cost:1200, needs:'horseshoe', desc:'Magnet upgrades 8 to 11: up to 72% double metal.' },
  turbine: { name:'Leaf turbine',      track:'blow',  cost:70,  needsKind:'blowers', desc:'Three stronger blower upgrades: a wider, stronger breeze.' },
  jet:     { name:'Jet nozzle',        track:'blow',  cost:420, needs:'turbine', desc:'Blower upgrades 6 to 8.' },
  pincers: { name:'Hydraulic pincers', track:'shake', cost:65,  needsKind:'shakers', desc:'Three stronger shake upgrades: more leaves from every tree and bush.' },
  rumble:  { name:'Rumble claws',      track:'shake', cost:360, needs:'pincers', desc:'Shake upgrades 6 to 8.' },
  jig:     { name:'Packing jig',       track:'pack',  cost:40,  needsPack:true, desc:'Four faster packing upgrades: bagging, honey jars, gift wrapping and smelting.' },
  precision:{ name:'Precision tools',  track:'pack',  cost:700, needs:'jig', desc:'Packing upgrades 8 to 11.' },
  cyclone: { name:'Grit cyclone',      track:'dig',   cost:450, needsShaft:true, desc:'Four stronger excavating upgrades for blowers at a mine shaft.' },
  forge:   { name:'Forge blast',       track:'stoke', cost:900, needsPlantBlower:true, desc:'Four stronger bellows upgrades for blowers at the smelting plant.' },
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
  cutting:  { name:'Cutting oil',        max:2, cost:[300, 1400], needs:()=>S.miners.length > 0, desc:l=>'All drills run <b>'+(15*(l+1))+'%</b> faster.' },
  market:   { name:'Market stall',       max:3, cost:[140, 600, 2400], desc:l=>'The truck pays <b>'+(10*(l+1))+'%</b> more for everything.' },
  charm:    { name:'Lucky horseshoe',    max:1, cost:[950], needs:()=>S.miners.length > 0, desc:()=>'Every robot gets <b>+8%</b> double-metal chance on top of its magnet.' },
};
if (LOT.GEN) Object.assign(GEN, LOT.GEN);   // a lot's own yard-wide upgrades (the prairie's flower upgrades)
const GEN_UNLOCK = 10;
const gl = k => (GEN[k] && S.gen && S.gen[k]) || 0;   // parked (commented-out) upgrades count as 0
// the prairie's flower upgrades (0 everywhere else): Petal press, and Sweet clover for faster regrowing flowers
const pressMul = () => 1 + 0.15*gl('press');
const regrowMul = () => 1 + 0.3*gl('clover');
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
  { name:'Pip',     blurb:'Slim and quick. Rebuilt from a lawnmower and a toaster.', body:'#e8e2d1', body2:'#bcb39d', head:'#efe9d9', head2:'#c5bca6', band:'#d9a43a', bw:18, bh:26, hw:16, hh:14, tw:22, rust:.3, slim:true },
  { name:'Clunk',   blurb:'Built like a mailbox. Heavy treads, steady pace.',        body:'#c9b99b', body2:'#8c7b5f', head:'#d3c5a8', head2:'#a29173', band:'#b8452d', bw:32, bh:21, hw:21, hh:13, tw:38, rust:.6, chunky:true },
  { name:'Rivet',   blurb:'Patched together from three other robots. Rough, but it works.', body:'#bbb4a2', body2:'#7d7668', head:'#c7c0ae', head2:'#8b8474', band:'#6f7d3c', bw:25, bh:22, hw:18, hh:13, tw:28, rust:1, patches:true },
  { name:'Juniper', blurb:'Round, polished, and a little proud of it.',              body:'#f0e5cc', body2:'#c4b08e', head:'#f4ebd7', head2:'#cfbd9c', band:'#7a4d6e', bw:24, bh:21, hw:19, hh:14, tw:26, rust:0, round:true },
  { name:'Sterling', blurb:'Factory fresh and polished to a mirror shine. Wears a monocle, naturally.', body:'#f7f9fa', body2:'#aab6bd', head:'#ffffff', head2:'#bcc7cd', band:'#c9a24a', bw:23, bh:23, hw:19, hh:14, tw:26, rust:0, modern:true },
  // V6.1: the newer robots keep the cream body like the others; the colour sits on the head or on a wide band
  { name:'Bolt',    blurb:'Built for the factory floor. A safety-orange head, a hard hat and a hazard-striped belt.', body:'#ddd0b2', body2:'#a99a7b', head:'#eaae4f', head2:'#b97c29', band:'#2f2a26', bw:26, bh:22, hw:19, hh:13, tw:30, rust:.3, hazard:true },
  { name:'Moss',    blurb:'A garden bot gone a bit wild: moss on its belt and something growing on its head.', body:'#e2dac4', body2:'#b2a78c', head:'#e6dfcb', head2:'#bcb198', band:'#6f8a3a', bandW:7, bw:24, bh:22, hw:18, hh:13, tw:28, rust:.4, sprout:true },
  { name:'Copper',  blurb:'A copper-plated head, green at the seams. Hums a little when it works.', body:'#e4d8bf', body2:'#b4a587', head:'#e2a06e', head2:'#a8663b', band:'#5f9c8a', bw:25, bh:21, hw:19, hh:14, tw:28, rust:0, copper:true },
  { name:'Ember',   blurb:'A wide charcoal belt with a warm glow inside it. Never feels the cold.', body:'#d3cab8', body2:'#a19886', head:'#ddd5c4', head2:'#aaa08d', band:'#3a3531', bandW:8, bw:25, bh:23, hw:18, hh:14, tw:28, rust:0, ember:true },
  { name:'Kettle',  blurb:'Round in the middle, with a little steam whistle on its head that toots when it’s pleased.', body:'#e8e0cc', body2:'#b9ae95', head:'#8fb2c2', head2:'#5f8495', band:'#3f6f8f', bw:27, bh:23, hw:18, hh:14, tw:28, rust:.2, kettle:true },
  { name:'Lantern', blurb:'Tall and careful. Carries its own lantern on a hook, for the dark autumn evenings.', body:'#efe7d3', body2:'#c2b79e', head:'#f2ebdb', head2:'#c8bea6', band:'#4f6b3a', bandW:5, bw:18, bh:27, hw:16, hh:14, tw:22, rust:.1, slim:true, lantern:true },
];
// V13: a robot keeps its look wherever it goes (cfg.sty, when it isn't simply its place in the list); robots built on
// another lot take the looks that are still free there
const styleIdx = ri => { const c = S.robots[ri]; return c && c.sty != null ? c.sty : ri; };
const styleOf = ri => STYLES[styleIdx(ri)] || STYLES[0];
function nextStyle(){ const used = new Set(S.robots.map((c, i) => c.sty != null ? c.sty : i)); for (let k=0;k<STYLES.length;k++) if (!used.has(k)) return k; return S.robots.length % STYLES.length; }
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
// V14: the smelting plant is out of the regular progression: it can only be built on a lot that has it (LOT.plantOpen, the
// Rainy hollow's drying shed), or once a later story beat teaches it (S.flags.smeltKnown). Its code is all still here, and a
// save that already has one keeps it. PLANT_LAND: a lot can keep it for later land.
const PLANT_LAND = LOT.PLANT_LAND || 0;
const plantOpen = () => (!!LOT.plantOpen || !!S.flags.smeltKnown) && S.land >= PLANT_LAND;
const plantGrade = () => plantOpen() && S.lv.metalPrice >= PLANT_GRADE;
const ORE_PER_INGOT = 4;
const metalPerIngot = () => ORE_PER_INGOT;
const hopperCap = () => val('hopper');
const tubRoom = () => S.metalSlot ? Math.max(0, metalCap() - S.binMetal) : 0;
// V7: the ingot pallet by the road grows with the metal tub (like the bags' shelf grows with the bin): ingots don't take
// the tub's room, but every bigger tub also means a bigger pallet. The plant's own ingot rack stays a fixed size.
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
  for (const g of TRACKS[k].gens){ if (g.tech && !S.tech[g.tech]) break; if (g.needsMetal && !S.metalSlot) break; if (g.needsPack && !packOpen()) break; if (g.needsBook && !S.story.found) break; if (g.needsShaft && !S.shafts.length) break; if (g.needsPlant && !S.plant.built) break; n += g.n; }
  return n;
}
const trackMax = k => TRACKS[k].vals.length - 1;
function trackVisible(k){ if (k === 'study') return researchOpen(); if (k === 'snip') return S.hive.built; if (k === 'pack') return packOpen(); if (k === 'dig') return S.shafts.length > 0; if (k === 'stoke') return S.plant.built; if (k === 'brolly') return WET_WOOD && S.plant.built; if (k === 'grab') return !!S.tech.claw; if (k === 'reach') return !!S.tech.arm; if (k === 'drill' || k === 'magnet') return S.metalSlot; return true; }
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
  mine:   { name:'Mine metal',    short:'Mine',   col:'#7d868c', kind:'robot' },
  bag:    { name:'Bag leaves',    short:'Bag',    col:'#c9862f', kind:'robot' },
  jar:    { name:'Fill honey jars', short:'Honey', col:'#e0a12e', kind:'robot' },
  wrap:   { name:'Wrap gift jars', short:'Wrap',  col:'#c23b4e', kind:'robot' },
  smelt:  { name:'Smelt ingots',  short:'Smelt',  col:'#b8452d', kind:'robot' },
  haul:   { name:'Haul ingots',   short:'Haul',   col:'#5f8c87', kind:'robot' },
  blow:   { name:'Blow leaves',   short:'Blow',   col:'#4f7c84', kind:'blower' },
  dig:    { name:'Excavate shafts', short:'Dig',  col:'#8a6040', kind:'blower' },
  stoke:  { name:'Work the bellows', short:'Bellows', col:'#b8452d', kind:'blower' },
  brolly: { name:'Carry wood umbrella', short:'Umbrella', col:'#3f6a8a', kind:'blower' },   // V14 (WET_WOOD)
  shake:  { name:'Shake trees',   short:'Shake',  col:'#6f7d3c', kind:'shaker' },
  snip:   { name:'Deadhead flowers', short:'Snip', col:'#7a4d6e', kind:'shaker' },
  // V12: studying whatever the robots have found (for now, the old picture book). When there's nothing to research the
  // task stays on the list under another name, so it can sit at the top of a robot's list without getting in the way.
  research: { get name(){ return researchOpen() ? 'Research' : 'Research - unavailable'; }, get short(){ return researchOpen() ? 'Research' : 'Research - unavailable'; }, col:'#4d6a9c', kind:'robot' },
  // V13: riding the truck to another lot. Only there while a letter has opened a trip, and only one robot can take it.
  travel: { get name(){ return S.trip && S.trip.to === 'home' ? 'Go back to original lot' : 'Go to new lot'; }, get short(){ return S.trip && S.trip.to === 'home' ? 'Go back' : 'New lot'; }, col:'#2f6f8f', kind:'robot' },
};
const KIND_TASKS = { robot:['leaves','mine','bag','jar','wrap','smelt','haul','research','travel'], blower:['blow','dig','stoke', ...(WET_WOOD ? ['brolly'] : []), 'travel'], shaker:['shake','snip'] };
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
    case 'brolly': return WET_WOOD && !!(cfg && cfg.lv.brolly > 0) && S.plant.built;
    case 'snip': return !!(cfg && cfg.lv.snip > 0) && S.hive.built;
    case 'research': return S.story.found;
    case 'travel': { if (!tripFor(cfg)) return false; const h = tripHolder(kindOfCfg(cfg)); return !h || h === cfg; }
  }
  return true;
}
// V13: a trip is open (a letter said so). Going back home is only for the robot that came from there; while one robot
// has the trip in its Do list, it's gone from everybody else's.
// V14: a trip can take a crew (S.trip.crew: which kinds go, one of each, e.g. ['robot', 'blower'] for the Rainy hollow),
// may be for one robot only (S.trip.who: its place in the list; Tinker for the hollow), and may need travel money
// (S.trip.cash): the crew only heads for the curb while you hold it, and it comes out of the cash when they climb in.
const tripKinds = () => (S.trip && S.trip.crew) || ['robot'];
function tripFor(cfg){
  if (!S.trip || !cfg || cfg.away) return false;
  const kind = kindOfCfg(cfg);
  if (!tripKinds().includes(kind)) return false;
  if (S.trip.to === 'home') return cfg.home != null;
  return !(kind === 'robot' && S.trip.who != null && S.robots.indexOf(cfg) !== S.trip.who);
}
const tripHolder = (kind = 'robot') => (cfgsOf(kind) || []).find(c => tripFor(c) && taskOn(c, 'travel')) || null;
const tripCashOK = () => !S.trip || !S.trip.cash || !!S.trip.paid || S.cash >= S.trip.cash;
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
// (Research starts in everyone's Off pile, so it doesn't count as a change the player made)
const hasDont = (cfg, kind, fresh) => cfg.off.some(x => x !== 'research' && x !== 'travel' && !fresh.includes(x) && taskOpen(x, cfg));
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
const DEFAULT_PRIO = { robot: [['bag', 'jar'], ['wrap'], ['smelt', 'haul'], ['mine'], ['leaves']], blower: WET_WOOD ? [['dig', 'stoke'], ['brolly'], ['blow']] : [['dig', 'stoke'], ['blow']], shaker: [['shake', 'snip']] };
const defPrio = kind => DEFAULT_PRIO[kind].map(r => r.slice());
function newRobotCfg(){ return tasksFix({ prio:defPrio('robot'), off:[], miner:null, lv:{ speed:0, carry:0, pick:0, grab:0, reach:0, drill:0, magnet:0, pack:0, study:0 } }, 'robot'); }
function newHelperCfg(kind){ return kind === 'blower' ? tasksFix({ prio:defPrio('blower'), off:[], lv:{ speed:0, blow:0, dig:0, stoke:0, brolly:0 } }, 'blower') : tasksFix({ prio:defPrio('shaker'), off:[], lv:{ speed:0, shake:0, snip:0 } }, 'shaker'); }
const helperCost = kind => (kind === 'blower' ? BLOWER_COST : SHAKER_COST)[cfgsOf(kind).length];
// a helper shows up in the workshop once you've held a quarter of its price (or already own one of that kind)
// V12: and only once the robots have worked out the old picture book (an elephant that blows, a crab that shakes)
// (V13: a robot that rode to another lot brings what it knows: S.flags.helpers)
const helpersKnown = () => (S.story.done && (S.story.item || 'book') === 'book') || S.flags.helpers || S.blowers.length > 0 || S.shakers.length > 0;
const helperShown = kind => helpersKnown() && cfgsOf(kind).length < HELPER_MAX && (cfgsOf(kind).length > 0 || seenPrice(helperCost(kind)));
function freshState(){
  return {
    v:2, t:0, cash:0, peak:0, binLeaves:0, binMetal:0, land:0,
    lv:{ bin:0, leafPrice:0, bagPrice:0, metalPrice:0, metalBin:0, truck:0, cleanup:0, hiveTank:0, hiveStore:0, honeyPrice:0, giftPrice:0, smeltSpeed:0, ingotGrade:0, slag:0, pallet:0, hopper:0 }, cleanN:0,
    hive:{ built:false, bees:0, nectar:0, honey:0, jars:0, packing:false, gift:0, up:{ wings:false, fan:false, nursery:false, third:false, tongue:false, recipe:false } },
    bag:{ built:false, bags:0 }, plant:{ built:false, ore:0, rack:0, slagAcc:0 }, ingots:0, shafts:[], keep:{ leaves:0, metal:0, jars:0 },
    tech:{}, gen:{}, seen:{}, metalSlot:false, robots:[newRobotCfg()], blowers:[], shakers:[], miners:[],
    truckT:28,
    totals:{ leaves:0, metal:0, cash:0, trucks:0, lucky:0, drops:0, shakes:0, honey:0, honeyCash:0, nectar:0, bags:0, gifts:0, ingots:0, jars:0, snips:0, blown:0, soaked:0 },
    // V12: hidden milestones (id -> game second it was reached) and the story of what the robots find (V13: item says
    // what it is: the old picture book in the first yard, a dead bee on the prairie)
    miles:{},
    story:{ item: LOT.find || 'book', armed:false, found:false, x:0, y:0, prog:0, done:false, opened:false, foundT:-1, doneT:-1, cam:false },
    // V13: letters waiting for the truck (ids), letters lying in the yard ({ id, x, y, read }), and an open trip
    post:[], letters:[], trip:null,
    flags:{ opened:false, finished:false, sentHint:false, saleShown:0, research:false, general:false, tiers5:true, bin9:true, metalTub:true, hiveShown:false, v6:true, v7:true, v9:true, v11:true, v12:true, bagShown:false, plantShown:false, taskHint:false, hints:{},
      hiveKnown:false, hiveDeal:false, guestBee:false, helpers:false,
      // (V14: listed here so they're kept on load: merge() only keeps keys the fresh state has)
      fare:0, fareOpen:false, hollowLetter:false, hollowGone:false, smeltKnown:false }
  };
}
let S = freshState();

// ───────────────────────── canvas & camera
const cv = $('c'); let ctx = cv.getContext('2d');   // let: card portraits borrow the robot drawing code for a moment
let W = 0, H = 0, DPR = 1;
const cam = { z:1, ox:0, oy:0 };
let camAnim = null, userCam = false, camMovedT = 0;
let camFollow = null;   // V12.1: the story camera (zooms in on a robot and follows it, then goes back)
let groundTopCv = null;   // V14 (rain): what stands up out of the ground, drawn over the puddle water
const mainCtx = ctx;      // (the screen's own context: card portraits and puddle reflections borrow ctx for a moment)
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
  camAnim = null; camFollow = null;
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
  userCam = true; camAnim = null; camFollow = null; camMovedT = performance.now();
  $('recenter').hidden = false;
  if (cardOpen) placeCard();
}
function recenter(){
  userCam = false; camAnim = null; camFollow = null; $('recenter').hidden = true;
  Object.assign(cam, camTarget(S.land)); buildGround(cam);
  if (cardOpen) placeCard();
}
function groundCovers(){
  const G = groundCam; if (Math.abs(cam.z/G.z - 1) > 0.12) return false;
  const V = visRect();
  return V.x0 >= -(G.ox + G.mx)/G.z && V.x1 <= (W + G.mx - G.ox)/G.z && V.y0 >= -(G.oy + G.my)/G.z && V.y1 <= (H + G.my - G.oy)/G.z;
}

// ───────────────────────── leaves
// (V13: a lot can bring its own: the prairie's are mostly flower petals, marked petal:true)
const LEAFC = LOT.LEAFC || [
  { c:'#c0392b', v:'#7f2318', w:.2 },
  { c:'#d4532a', v:'#8c3215', w:.14 },
  { c:'#e07b2e', v:'#9a4d17', w:.24 },
  { c:'#eaa23a', v:'#a8691b', w:.15 },
  { c:'#9aa53f', v:'#5d6524', w:.17, sp:true },
  { c:'#b0662f', v:'#6e3c18', w:.10 },
];
function pickColor(){ let r = Math.random(); for (let i=0;i<LEAFC.length;i++){ r -= LEAFC[i].w; if (r <= 0) return i; } return 0; }
const MAPLE = (() => { const h = [[0,-1],[0.12,-0.62],[0.38,-0.8],[0.32,-0.42],[0.74,-0.52],[0.58,-0.2],[0.98,-0.02],[0.62,0.1],[0.7,0.32],[0.3,0.24],[0.08,0.42],[0,0.5]]; const p = h.slice(); for (let i=h.length-2;i>0;i--) p.push([-h[i][0], h[i][1]]); return p; })();
function leafPath(c, shape){
  c.beginPath();
  if (shape === 1){ c.moveTo(MAPLE[0][0], MAPLE[0][1]); for (let i=1;i<MAPLE.length;i++) c.lineTo(MAPLE[i][0], MAPLE[i][1]); c.closePath(); }
  else if (shape === 2){
    // V13 (petals): a cherry petal with a notched tip
    c.moveTo(0, 0.95); c.bezierCurveTo(0.38, 0.72, 0.86, 0.05, 0.76, -0.55); c.bezierCurveTo(0.68, -0.95, 0.24, -1.02, 0, -0.7);
    c.bezierCurveTo(-0.24, -1.02, -0.68, -0.95, -0.76, -0.55); c.bezierCurveTo(-0.86, 0.05, -0.38, 0.72, 0, 0.95); c.closePath();
  } else if (shape === 3){
    // a round petal
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
  if (LOT.leafSheen){ const a0 = c.globalAlpha; c.globalAlpha = a0*0.22; c.fillStyle = '#fff6ea'; ell(c, -0.2, -0.28, 0.16, 0.34); c.fill(); c.globalAlpha = a0; }   // V14: wet leaves shine
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
  if (hiveShown() && Math.abs(x - HIVE.x) < (LOT.hiveWide ? 50 : 36) && y > HIVE.y - 165 && y < HIVE.y + 12) return false;
  if (S.hive.built && Math.abs(x - CRATE.x) < 26 && y > CRATE.y - 58 && y < CRATE.y + 8) return false;
  if (baggerShown() && Math.abs(x - BAGGER.x) < 34 && y > BAGGER.y - 30 && y < BAGGER.y + 8) return false;
  if (S.plant.built && Math.abs(x - PALLET.x) < 28 && y > PALLET.y - 26 && y < PALLET.y + 8) return false;
  if (plantShown() && x > PLANT.x - 104 && x < PLANT.x + 104 && y > PLANT.y - 66 && y < PLANT.y + 8) return false;
  // not inside a bush or against a trunk, where nobody could see the leaf
  for (const b of BUSHES){ const dx = (x - b.x)/(36*b.s), dy = (y - b.y + 8*b.s)/(18*b.s); if (dx*dx + dy*dy < 1) return false; }
  for (const t of TREES){ const by = trunkBase(t); if (Math.abs(x - t.x) < Math.max(14, t.r*0.15) && y > by - 16 && y < by + 3) return false; }
  return true;
}
const LF = LOT.leafFall || { vy: [26, 44], sw: [14, 30] };   // how fast leaves fall and sway (V14: wet ones fall faster)
function newLeaf(x, y, ly, collect){
  const ci = pickColor();   // (petals are bigger than leaves)
  return { x, y, ly, s: rand(8, 11)*(LEAFC[ci].petal ? 1.3 : 1), rot: rand(0, TAU), vr: rand(-1.6, 1.6), ci, sh: Math.random() < 0.55 ? 1 : 0,
    st: 'fall', vy: rand(LF.vy[0], LF.vy[1]), ph: rand(0, TAU), phs: rand(1.6, 3.2), sw: rand(LF.sw[0], LF.sw[1]), wf: rand(0.6, 1.2),
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
const truck = { riders:[], st:'away', x:0, v:0, timer:0, fill:0, rot:0, takeL:0, takeM:0, takeH:0, takeB:0, takeI:0, takeG:0 };
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
function syncRobots(){ while (R.length < S.robots.length){ const r = newRobot(R.length); if (S.robots[r.id].away) r.st = 'gone'; R.push(r); } }

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

// V12.1: robots (and helpers) walk around the workshop and the bin (with the metal tub beside it) instead of through
// them. Each is a box on the ground, already widened by about half a robot, so a robot standing on its edge looks right.
// If the straight line to where it's going crosses a box, the robot goes round the corners (a tiny shortest-path search
// over the boxes' corners), and the route is kept until the target moves.
let obstCache = null, obstKey = '';
function obstacles(){
  const key = S.metalSlot ? 'm' : '-';
  if (key !== obstKey || !obstCache){
    obstKey = key;
    obstCache = [
      { x0: SHED.x - 58, x1: SHED.x + 58, y0: SHED.y - 40, y1: SHED.y + 4 },                       // the workshop
      { x0: BIN.x - 52, x1: S.metalSlot ? TUB.x + 28 : BIN.x + 52, y0: BIN.y - 20, y1: BIN.y + 5 },   // the bin (and the metal tub)
    ];
  }
  return obstCache;
}
const inBox = (x, y, o) => x > o.x0 && x < o.x1 && y > o.y0 && y < o.y1;
const inObstacle = (x, y) => obstacles().some(o => inBox(x, y, o));
// does the segment a→b pass through the inside of box o? (Liang–Barsky; running along an edge doesn't count)
function segHits(ax, ay, bx, by, o){
  const x0 = o.x0 + 0.5, x1 = o.x1 - 0.5, y0 = o.y0 + 0.5, y1 = o.y1 - 0.5, dx = bx - ax, dy = by - ay;
  const P = [-dx, dx, -dy, dy], Q = [ax - x0, x1 - ax, ay - y0, y1 - ay];
  let t0 = 0, t1 = 1;
  for (let i=0;i<4;i++){
    if (P[i] === 0){ if (Q[i] < 0) return false; continue; }
    const t = Q[i]/P[i];
    if (P[i] < 0){ if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return t0 < t1;
}
const clearPath = (ax, ay, bx, by, O) => !O.some(o => segHits(ax, ay, bx, by, o));
// shortest way from a to b round the boxes' corners (Dijkstra over a handful of points)
function planRoute(ax, ay, bx, by, O){
  const pts = [{ x: ax, y: ay }];
  for (const o of O) for (const [x, y] of [[o.x0 - 1, o.y0 - 1], [o.x1 + 1, o.y0 - 1], [o.x1 + 1, o.y1 + 1], [o.x0 - 1, o.y1 + 1]]) if (!inObstacle(x, y)) pts.push({ x, y });
  pts.push({ x: bx, y: by });
  const n = pts.length, dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false);
  dist[0] = 0;
  for (;;){
    let u = -1; for (let i=0;i<n;i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || u === n - 1) break;
    done[u] = true;
    for (let v=0; v<n; v++){
      if (done[v] || v === u) continue;
      if (!clearPath(pts[u].x, pts[u].y, pts[v].x, pts[v].y, O)) continue;
      const d = dist[u] + Math.hypot(pts[v].x - pts[u].x, pts[v].y - pts[u].y);
      if (d < dist[v]){ dist[v] = d; prev[v] = u; }
    }
  }
  if (prev[n - 1] < 0) return [];
  const out = []; for (let v = prev[n - 1]; v > 0; v = prev[v]) out.unshift(pts[v]);
  return out;
}
// the next point to head for on the way to (x, y)
function waypoint(r, x, y){
  const O = obstacles();
  // somehow inside a box (it was just built round it): step out the nearest side
  for (const o of O) if (inBox(r.x, r.y, o)){
    const opts = [[o.x0 - 1, r.y, r.x - o.x0], [o.x1 + 1, r.y, o.x1 - r.x], [r.x, o.y0 - 1, r.y - o.y0], [r.x, o.y1 + 1, o.y1 - r.y]].sort((a, b) => a[2] - b[2]);
    r.route = null; return { x: opts[0][0], y: opts[0][1], via: true };
  }
  if (inObstacle(x, y) || clearPath(r.x, r.y, x, y, O)){ r.route = null; return { x, y }; }
  let rt = r.route;
  if (!rt || Math.abs(rt.tx - x) > 4 || Math.abs(rt.ty - y) > 4 || rt.key !== obstKey){ rt = r.route = { tx: x, ty: y, key: obstKey, pts: planRoute(r.x, r.y, x, y, O) }; }
  while (rt.pts.length && Math.hypot(rt.pts[0].x - r.x, rt.pts[0].y - r.y) < 0.6) rt.pts.shift();
  if (!rt.pts.length){ r.route = null; return { x, y }; }
  return { x: rt.pts[0].x, y: rt.pts[0].y, via: true };
}
// a target inside a box (a blower's lap that runs down past the workshop) moves to the nearest spot just outside it
function outsideBoxes(x, y){
  for (const o of obstacles()) if (inBox(x, y, o)){
    const c = [[x, o.y0 - 1], [x, o.y1 + 1], [o.x0 - 1, y], [o.x1 + 1, y]].filter(q => !inObstacle(q[0], q[1]));
    c.sort((a, b) => Math.hypot(a[0] - x, a[1] - y) - Math.hypot(b[0] - x, b[1] - y));
    if (c.length) return { x: c[0][0], y: c[0][1] };
  }
  return null;
}
function moveTo(r, x, y, sp, dt){
  const out = outsideBoxes(x, y); if (out){ x = out.x; y = out.y; }
  let step = sp*dt;
  for (let k=0; k<3; k++){
    const p = waypoint(r, x, y), dx = p.x - r.x, dy = p.y - r.y, d = Math.hypot(dx, dy);
    if (Math.abs(dx) > 1.5) r.face = dx > 0 ? 1 : -1;
    if (d <= step + 0.5){
      r.x = p.x; r.y = p.y;
      if (!p.via) return true;
      step -= d; r.moving = true; if (step <= 0.01) return false;   // round a corner without losing speed
      continue;
    }
    r.x += dx/d*step; r.y += dy/d*step; r.moving = true; return false;
  }
  return false;
}
// drop-off spots in front of the bin (two rows once there are lots of robots)
// V12.1: a robot coming from the yard side stands just behind the bin and tips its leaves in over the back
const fromBehind = (r, o) => r.y < o.y - 20;
function binSpot(r){ const k = r.id % 5, row = Math.floor(r.id/5), x = BIN.x + [-30, -15, 0, 15, 30][k] - 4 + row*7; return fromBehind(r, BIN) ? { x, y: BIN.y - 25 - row*6 - (r.id % 2)*2 } : { x, y: BIN.y + 15 + row*7 + (r.id % 2)*2 }; }
const tubSpot = r => fromBehind(r, TUB) ? { x: TUB.x + 2 + (r.id%3 - 1)*8, y: TUB.y - 25 - (r.id >= 5 ? 6 : 0) } : { x: TUB.x + 2 + (r.id%3 - 1)*8, y: TUB.y + 15 + (r.id >= 5 ? 6 : 0) };
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
const STN = { bag: [null, null], jar: [null, null], smelt: [null, null, null] };
const JAR_SPOTS = [{ x: CRATE.x - 12, y: CRATE.y - 15, face: 1 }, { x: CRATE.x + 14, y: CRATE.y - 15, face: -1 }];
const BAG_SPOTS = [{ x: BAGGER.x - 13, y: BAGGER.y - 9, face: 1 }, { x: BAGGER.x + 16, y: BAGGER.y - 9, face: -1 }];
// wrapping gift jars uses the honey crate's two spots
const stKey = t => t === 'wrap' ? 'jar' : t;
function stationPos(t, i){
  if (t === 'bag') return BAG_SPOTS[i] || BAG_SPOTS[0];
  if (t === 'jar' || t === 'wrap') return JAR_SPOTS[i] || JAR_SPOTS[0];
  return { x: PLANT.x + (i - 1)*40 - 9, y: PLANT.y + 15, face: 1 };
}
function stationFree(t, r){ const a = STN[t], mine = a.indexOf(r.id); return mine >= 0 ? mine : a.indexOf(null); }
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
    case 'research': return researchOpen() && researchRoom(r);
    case 'travel': return tripFor(S.robots[r.id]) && tripCashOK();
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
  if (S.trip && taskOn(cfg, 'travel') && taskOpen('travel', cfg) && tripCashOK()) return 'travel';   // V13: in Do at all means: go (V14: once the money is there)
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
  for (let k=0; k<8; k++){ r.wx = clamp(r.x + rand(-90, 90), O.x0 + 20, O.x1 - 20); r.wy = clamp(r.y + rand(-60, 60), O.y0 + 20, O.y1 + 10); if (!inObstacle(r.wx, r.wy)) break; }
  r.st = 'wander'; r.look = 0.3;
}
function decide(r){
  const cfg = S.robots[r.id];
  const t = robotTask(r);
  r.task = t; noteTask(r, t);
  if (t !== 'research') leaveResearch(r);   // puts the book down if it had it
  if (t !== 'mine') cfg.miner = null;   // free the miner for someone else
  releaseStations(r, stKey(t));
  // first drop off what it carries, if there's room for it
  if (r.carryI > 0 && (t !== 'haul' || r.carryI >= ingotCarry(r.id) || S.plant.rack <= claimedRack(r)) && palletRoom() > 0){ r.st = 'toPallet'; return; }
  // (leaves it's about to bag, and metal it's about to smelt, go straight into the work instead)
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
  if (t === 'research'){ startResearch(r); return; }
  if (t === 'travel'){ r.st = 'toCurb'; return; }
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
    for (let i=0;i<3;i++) flyTo('honey', HIVE.x - 10, HIVE.y - 40, CRATE.x - 2, CRATE.y - 30, 0.45 + i*0.1, 24, {});
  } else if (t === 'wrap'){
    // V11: a robot that only wraps takes a plain jar out of the crate, wraps it and puts it back as a gift jar
    if (!S.hive.packing || S.hive.jars < 1) return false;
    S.hive.jars--; r.wrapOwn = false; r.workDur = wrapTime(r.id);
    flyTo('jar', CRATE.x + rand(-8, 8), CRATE.y - 28, P.x + P.face*9, P.y - 30, 0.3, 14, {});
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
    pop(CRATE.x, CRATE.y - 62, '+1 jar', 'honey', 14);
    { const a = sndAt(CRATE.x, CRATE.y); sfx('clink', 1, a.pan, a.vol*0.7); }
  } else if (t === 'wrap'){
    S.hive.gift++; S.totals.gifts = (S.totals.gifts || 0) + 1; hiveRt.bump = 0.25; r.wrapOwn = false;
    pop(CRATE.x, CRATE.y - 62, '+1 gift jar', 'gift', 14);
    { const a = sndAt(CRATE.x, CRATE.y); sfx('clink', 1, a.pan, a.vol*0.7); }
  } else if (t === 'smelt'){
    S.plant.rack++; S.totals.ingots = (S.totals.ingots || 0) + 1; plantRt.bump = 0.3;
    // slag recovery: the saved-up scraps make a whole extra ingot now and then
    S.plant.slagAcc = (S.plant.slagAcc || 0) + val('slag');
    if (S.plant.slagAcc >= 1 && S.plant.rack < RACK_CAP){ S.plant.slagAcc -= 1; S.plant.rack++; S.totals.ingots++; pop(PLANT.x + (r.spot - 1)*40, PLANT.y - 88, '+1 from slag', 'ingot', 13, 0.4); }
    flyTo('ingot', PLANT.x + (r.spot - 1)*40, PLANT.y - 18, RACK.x - 2 + rand(-6, 6), RACK.y - 30, 0.6, 30, {});
    pop(PLANT.x + (r.spot - 1)*40, PLANT.y - 70, '+1 ingot', 'ingot', 15);
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
  // V13.1: the find is only under a leaf above the workshop's roofline, further from the road where it's easy to see
  if (got.length && S.story.armed && !S.story.found){ const fl = got.find(l => l.y < FIND_ABOVE); if (fl) findBook(r, fl); }
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
    // V13: off to another lot: wait at the curb, hop into the back of the truck at the next pickup, ride along
    case 'toCurb': { const q = curbSpot(r); if (moveTo(r, q.x, q.y, sp, dt)){ r.st = 'curb'; r.face = 1; r.look = 0.5; } break; }
    case 'curb':   // (it climbs in with the rest of the crew at the next pickup: see updBoarding)
      r.look -= dt; if (r.look <= 0){ r.look = 0.5; if (robotTask(r) !== 'travel') r.st = 'idle'; else if (Math.random() < 0.08) robotSays(r, 'hmm'); }
      break;
    case 'hopIn': case 'hopOut': updHop(r, dt); break;
    case 'ride': { const q = rideSpot(r); r.x = q.x; r.y = q.y; r.hz = 0; break; }
    case 'gone': break;   // away on another lot
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
        if (Math.random() < dt*9) parts.push(ART.sawArm ? { k:'speck', saw:true, x: r.x + r.face*16 + rand(-3,3), y: r.y - 14 - rand(0,4), vx: rand(-40,40), vy: rand(-60,-15), g: 160, life: rand(.35,.6), t:0 }   // (V14: sawdust)
          : { k:'spark', x: m.x + rand(-6,6), y: m.y - rand(0,6), vx: rand(-40,40), vy: rand(-70,-20), g: 160, life: rand(.25,.45), t:0 });
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
          // V14 (WET_WOOD): soaked bundles can't be sold as dry wood: they go back in the log crib as wet wood (two logs each)
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
    case 'toBook': case 'pickBook': case 'toStudy': case 'study': case 'toAssist': case 'assist': updResearchBot(r, dt, sp); break;
  }
  // V14 (WET_WOOD): dry bundles out in the rain get wet, one by one, unless a blower holds the wood umbrella over them
  if (WET_WOOD && r.carryI > (r.wetI || 0) && r.moving && !underRoof(r) && !umbrellaOver(r)){
    const dry = r.carryI - (r.wetI || 0), k = WET_RATE*dt*(rainLevel(S.t)/0.7);
    for (let i=0;i<dry;i++) if (Math.random() < k){ r.wetI = (r.wetI || 0) + 1; if (!simMode){ pop(r.x, r.y - 72, 'soaked!', 'wet', 13); for (let q=0;q<4;q++) parts.push({ k:'drop', x: r.x - r.face*8 + rand(-5, 5), y: r.y - 34, vx: rand(-20, 20), vy: rand(-20, 10), g: 200, life: rand(.4, .7), t: 0 }); } }
  }
  r.full = (r.st === 'wait' || r.st === 'waitI') && (r.carryL > 0 || r.carryM > 0 || r.carryI > 0);
  if (!simMode && styleOf(r.id).dust && r.moving && Math.random() < dt*2.5) parts.push({ k:'dust', x: r.x - r.face*10, y: r.y - 2, vx: -r.face*rand(4,12), vy: rand(-10,-4), g:0, life: rand(.6,1), t:0, r: rand(2.5,4.5) });
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

// ───────────────────────── milestones (V12)
// Hidden for now: each one is a point the yard reaches (S.miles[id] = the game second it happened). They lay the
// groundwork for achievements / goals the player can work toward later; for now they only start story beats.
// prog() is how far along it is (1 = reached), so a later goal list can show progress bars.
// V13: each one belongs to a lot (lot: 'home', 'prairie'), so every place has its own story.
const LETTER_EARNED = 900;   // the truck driver writes about a new lot once the first yard has earned this much in all,
const LETTER_HELD = 200;     // or once you've held this much at one time (S.peak), whichever comes first
// (V13.1: and only once the robots have worked out the old picture book)
const FIND_ABOVE = -122;     // finds (the book, the bee) only turn up under leaves higher up than the workshop's roof
const LOT_START_CASH = 10;   // what you have when your robot first arrives on a new lot (V13.5: only if no travel money came along)
const TRIP_CASH = 100;       // V13.5: after the first letter, the first yard has to hold this much; it's packed for the trip and is
                             // what the robot starts the prairie with
const BEE_LEAVES = 300;      // petals gathered on the prairie before the dead bee turns up (about 5 minutes for the robot you bring)
const HONEY_CASH = 100;      // V13.4: dollars the truck pays for the prairie's honey (jars and gift jars) before the driver offers a ride back (was 30 jars)
const HOLLOW_CASH = 1000;    // V14: the third beat: hold this much (with a bigger yard and a mine) and the driver writes about the Rainy hollow
const MILESTONES = [
  // the old picture book turns up under a leaf once you've earned $20 in all (or once you hold $12, if that's sooner)
  { id:'book', lot:'home', hidden:true, name:'A curious find', goal:'Earn $20', prog: () => Math.max((S.totals.cash || 0)/20, S.cash/12), on: () => { S.story.armed = true; } },
  // V13: word gets around: the truck driver brings a letter about another lot that needs cleaning up
  // V14: the travel money is a live goal: it's reached while you hold $100 and not any more if you spend it, and it only
  // comes out of the cash when the robot climbs into the truck (S.trip.cash, see board()). Until then the robot only
  // goes to the curb while the money is there.
  { id:'fare', lot:'home', live:true, name:'Travel money', goal:'Have $' + TRIP_CASH + ' to bring to the new yard', prog: () => S.cash/TRIP_CASH,
    hud:{ icon:'coin', cash:true, val: () => S.cash, of: TRIP_CASH, show: () => !!(S.trip && S.trip.to === 'prairie' && S.trip.cash && !S.trip.paid) } },
  { id:'letter', lot:'home', hidden:true, name:'Word gets around', goal:'Earn $' + LETTER_EARNED + ' or hold $' + LETTER_HELD, prog: () => (S.story.item || 'book') === 'book' && S.story.done ? Math.max((S.totals.cash || 0)/LETTER_EARNED, (S.peak || 0)/LETTER_HELD) : 0, on: () => postLetter('newLot') },
  // on the prairie: a dead bee under a petal, and once the new hive is going, a ride back home for the robot and a bee
  // V13.4: these two show as a goal pill under the cash (hud: what it shows; show: when it may show up)
  { id:'bee', lot:'prairie', name:'A small find', goal:'Gather ' + BEE_LEAVES + ' petals', prog: () => (S.totals.leaves || 0)/BEE_LEAVES, on: () => { S.story.armed = true; },
    hud:{ icon:'petal', val: () => S.totals.leaves || 0, of: BEE_LEAVES, show: () => true } },
  { id:'honey', lot:'prairie', name:'Sweet success', goal:'Earn $' + HONEY_CASH + ' selling honey', prog: () => honeyEarned()/HONEY_CASH, on: () => postLetter('goHome'),
    hud:{ icon:'jar', cash:true, val: () => honeyEarned(), of: HONEY_CASH, show: () => S.miles.bee != null && hiveKnown() } },
  // V14: once the beehive is built in the first yard, three quests show up together (group 'hollow'). The first two stay
  // done once done (and may be done already); the money is live. All three at the same time bring the next letter.
  { id:'qYard', lot:'home', group:'hollow', name:'More room', goal:'Buy a bigger yard', prog: () => S.land >= 1 ? 1 : 0, hud:{ icon:'land', bool:true } },
  { id:'qMine', lot:'home', group:'hollow', name:'Dig in', goal:'Build a mine', prog: () => S.miners.length ? 1 : 0, hud:{ icon:'vein', bool:true } },
  { id:'qCash', lot:'home', group:'hollow', live:true, name:'Savings', get goal(){ return S.trip && S.trip.to === 'hollow' ? 'Have $1,000 for the trip' : 'Save up $1,000'; },
    prog: () => S.cash/HOLLOW_CASH, hud:{ icon:'coin', cash:true, val: () => S.cash, of: HOLLOW_CASH } },
];
// a group of quests shows all at once while its show() is true; done(): what happens when every one is reached together
const GOAL_GROUPS = {
  hollow: { show: () => LOT_ID === 'home' && S.hive.built && !S.flags.hollowGone,
    done: () => { if (!S.flags.hollowLetter){ S.flags.hollowLetter = true; postLetter('hollow'); } } },
};
const reached = m => m.live ? m.prog() >= 1 : S.miles[m.id] != null;
function updMilestones(){
  for (const m of MILESTONES){
    if ((m.lot || 'home') !== LOT_ID || S.miles[m.id] != null || m.prog() < 1) continue;
    S.miles[m.id] = Math.round(S.t);   // (for a live goal: the first time it was reached)
    if (m.hud && !m.group && !m.live && !simMode){ goalRt.doneId = m.id; goalRt.doneT = S.t; goalRt.bumpT = 0.3; }
    if (m.on) m.on();
  }
  for (const g in GOAL_GROUPS){
    const G = GOAL_GROUPS[g]; if (!G.show()) continue;
    const ms = MILESTONES.filter(m => m.group === g && (m.lot || 'home') === LOT_ID);
    if (ms.length && ms.every(reached)) G.done();
  }
}
// V13.4: the goal pills under the cash. Honey money counts once the number flying up from the sale reaches the pill
// (goalRt.pending is what's still in the air), so the pill and the milestone tick over together.
const goalRt = { pending: 0, doneId: null, doneT: -99, bumpT: 0, tip: null, tipT: 0, els: {} };
const GOAL_DONE_HOLD = 6;   // seconds a reached goal stays up (with a tick) before the next one, or none, shows
const honeyEarned = () => Math.max(0, (S.totals.honeyCash || 0) - goalRt.pending);
// what shows right now, top first: [{ m, done }]. A group shows every member (done ones with a tick); a live goal shows
// while its show() is true, ticked while it's reached; otherwise one goal at a time, ticked for a moment once reached.
function goalList(){
  const out = [];
  for (const g in GOAL_GROUPS) if (GOAL_GROUPS[g].show()) for (const m of MILESTONES) if (m.group === g && (m.lot || 'home') === LOT_ID) out.push({ m, done: reached(m) });
  for (const m of MILESTONES) if (m.live && !m.group && m.hud && (m.lot || 'home') === LOT_ID && m.hud.show()) out.push({ m, done: reached(m) });
  if (goalRt.doneId && S.t - goalRt.doneT < GOAL_DONE_HOLD){ const m = MILESTONES.find(q => q.id === goalRt.doneId); if (m){ out.push({ m, done: true }); return out; } }
  const one = MILESTONES.find(m => m.hud && !m.group && !m.live && (m.lot || 'home') === LOT_ID && S.miles[m.id] == null && m.hud.show());
  if (one) out.push({ m: one, done: false });
  return out;
}
const goalShowing = id => goalList().some(g => !g.done && g.m.id === id);

// ───────────────────────── the old picture book and the Research task (V12)
// Once the 'book' milestone is reached, the next leaf a robot picks up has a battered children's book under it. Only two
// pages are left: an elephant and a crab. Research opens as a task (in everyone's Off pile). A robot with Research in Do
// walks over, picks the book up, carries it to just in front of the workshop and studies it there; others with Research
// stand beside it and help. When it's done, blowers (the elephant) and shakers (the crab) can be built in the workshop.
const RESEARCH_NEED = 600;                  // research units in the book
// V13: what can be found and researched. crew: how many robots can work on it at once (0: any number)
const FINDS = {
  book: { need: RESEARCH_NEED, crew: 0, title: 'Old picture book', story: 'Two pages salvaged from a wet children’s book. Maybe it can be useful.',
    found: ['Something was hiding under that leaf…', 'A soggy old picture book. New task available: Research'], holding: 'the book' },
  bee:  { need: 2000, crew: 3, title: 'A dead bee', story: 'A dead bee. Maybe it can be useful.',
    found: ['Something was hiding under that petal…', 'A little dead bee. New task available: Research'], holding: 'the bee' },
};
const FIND = () => FINDS[S.story.item] || FINDS.book;
const researchNeed = () => FIND().need;
// is there room for robot r on the research? (the bee only has room for three around it)
const researchRoom = r => !FIND().crew || RESEARCH_STATES.includes(r.st) || researchers().length < FIND().crew;
const RESEARCH_MAIN = 4, RESEARCH_HELP = 1; // units a second: the robot holding the book, and each robot helping (× its Research level)
// (V13.2: the dead bee is studied where the beehive will go instead, facing the plot)
const STUDY = { get x(){ return S.story.item === 'bee' ? HIVE.x - 34 : SHED.x - 12; }, get y(){ return S.story.item === 'bee' ? HIVE.y + 14 : SHED.y + 16; } };
// where helpers stand around the reader (it faces right): beside it, then over its shoulder, then in a ring
const ASSIST_SPOTS = [[-27, 2, 1], [50, 3, -1], [-50, -4, 1], [70, -5, -1], [-18, 13, 1], [38, 14, -1], [-72, 4, 1], [88, 3, -1], [-40, 15, 1]];
const RESEARCH_STATES = ['toBook', 'pickBook', 'toStudy', 'study', 'toAssist', 'assist'];
const researchOpen = () => !!(S.story.found && !S.story.done);
const studyMul = ri => rv(ri, 'study');
// runtime only: who has the book (a robot id or null), whether it's in their hands, and when a dropped book lands
const bookRt = { by: null, held: false, landT: 0 };
// (a holder between two jobs is 'idle' for a moment: it still has the book until it decides what to do next)
const bookHolder = () => bookRt.by != null && R[bookRt.by] && (RESEARCH_STATES.includes(R[bookRt.by].st) || R[bookRt.by].st === 'idle') ? R[bookRt.by] : null;
// research units a second right now: only while the holder is standing studying
function researchRate(){
  const h = bookHolder(); if (!h || h.st !== 'study') return 0;
  let v = RESEARCH_MAIN*studyMul(h.id);
  for (const q of R) if (q !== h && q.st === 'assist') v += RESEARCH_HELP*studyMul(q.id);
  return v;
}
const researchLeft = () => Math.max(0, researchNeed() - S.story.prog);
// time left at the current pace; while nobody is studying it shows what one robot on its own would take
const researchETA = () => { const v = researchRate(); return researchLeft()/(v > 0 ? v : RESEARCH_MAIN); };
const researchers = () => R.filter(q => RESEARCH_STATES.includes(q.st));
// where the book is in the world while a robot holds it (matches drawRobot's hands)
function bookHand(r){
  const st = styleOf(r.id), top = -8 - st.bh;
  const lx = r.st === 'study' ? st.bw/2 + 9 : st.bw/2 + 6, ly = r.st === 'study' ? top + st.bh*0.15 : top + st.bh*0.5 - 1;
  return { x: r.x + r.face*lx, y: r.y + ly };
}
// where the book is (in hands or on the ground), for the card and taps
const bookPos = () => { const h = bookRt.held ? bookHolder() : null; return h ? bookHand(h) : { x: S.story.x, y: S.story.y - 3 }; };
function assistPos(r){
  const k = r.aspot | 0;
  if (k < ASSIST_SPOTS.length){ const a = ASSIST_SPOTS[k]; return { x: STUDY.x + a[0], y: STUDY.y + a[1], face: a[2] }; }
  const a = (k - ASSIST_SPOTS.length)*0.7 + 0.4, side = k % 2 ? -1 : 1;
  return { x: STUDY.x + side*(70 + 6*Math.cos(a)), y: STUDY.y - 10 + 8*Math.sin(a), face: -side };
}
function claimAssist(r){
  const used = new Set(R.filter(q => q !== r && (q.st === 'toAssist' || q.st === 'assist')).map(q => q.aspot));
  let k = 0; while (used.has(k)) k++;
  r.aspot = k;
}
// The very first leaf picked up after the milestone has the book (or the bee) under it
function findBook(r, l){
  const O = owned();
  S.story.found = true; S.story.foundT = S.t;
  S.story.x = clamp(l.x, O.x0 + 14, O.x1 - 14); S.story.y = clamp(l.y, O.y0 + 10, -4);
  bookRt.by = null; bookRt.held = false; bookRt.landT = S.t + 0.55;
  for (const c of S.robots) if (!taskOn(c, 'research')) putOff(c, 'research');   // the new task starts in everyone's Off pile
  if (!simMode){
    flyTo('book', S.story.x, S.story.y - 2, S.story.x, S.story.y, 0.55, 26, { rot: 0 });
    sparkle(S.story.x, S.story.y - 8);
    pop(r.x, r.y - 78, '!', 'note', 30);
    pop(S.story.x, S.story.y - 46, 'New task available: Research', 'note', 18, 0.9, 4);
    robotSays(r, 'hmm', true); sfx('chime', 'sale');
    startFindCam(S.story.x, S.story.y);   // the camera zooms in on the find as it turns up (V13.2 the bee, V13.6 the book too)
    const F = FIND(); setTimeout(() => showToast(F.found[0], F.found[1], 9), 700);
  }
  save();
}
// A robot that stops researching puts the book down where it stands (progress is kept in the book)
function dropBook(r){
  const O = owned(), from = bookHand(r);
  S.story.x = clamp(r.x + r.face*15, O.x0 + 14, O.x1 - 14); S.story.y = clamp(r.y + 3, O.y0 + 10, 2);
  bookRt.held = false; bookRt.landT = S.t + 0.3;
  flyTo('book', from.x, from.y, S.story.x, S.story.y - 1, 0.3, 8, { rot: 0 });
}
function leaveResearch(r){
  if (bookRt.by === r.id){ if (bookRt.held) dropBook(r); bookRt.by = null; bookRt.held = false; }
  r.aspot = -1;
}
function startResearch(r){
  const h = bookHolder();
  if (!h || h === r){
    bookRt.by = r.id; r.aspot = -1;
    if (bookRt.held) r.st = 'toStudy';
    else { r.st = 'toBook'; }
    return;
  }
  claimAssist(r); r.st = 'toAssist';
}
// the robot states while researching (called from updRobot)
function updResearchBot(r, dt, sp){
  if (!researchOpen()){ leaveResearch(r); r.st = 'idle'; return; }
  switch (r.st){
    case 'toBook': {
      if (bookRt.by !== r.id){ r.st = 'idle'; break; }
      const side = r.x < S.story.x ? -1 : 1;
      if (moveTo(r, S.story.x + side*15, S.story.y + 2, sp, dt)){ r.face = -side; r.st = 'pickBook'; r.timer = 1.15; }
      break;
    }
    case 'pickBook':
      // it bends down, picks the book up in both hands and has a first look at it
      // (the first time research starts, the camera zooms in and follows it to the workshop)
      if (!S.story.cam && !simMode){ S.story.cam = true; startFollow(r); }
      r.timer -= dt;
      if (!bookRt.held && r.timer < 0.6){ bookRt.held = true; const a = sndAt(r.x, r.y); sfx('grab', 1, a.pan, a.vol); }
      if (r.timer <= 0) r.st = 'toStudy';
      break;
    case 'toStudy':
      if (bookRt.by !== r.id){ r.st = 'idle'; break; }
      if (moveTo(r, STUDY.x, STUDY.y, sp*0.75, dt)){ r.st = 'study'; r.face = 1; r.look = 1.5; r.flipT = rand(1.2, 2.5); r.flipP = 1; r.unitT = 0; }
      break;
    case 'toAssist': {
      if (!bookHolder()){ r.st = 'idle'; break; }
      const p = assistPos(r);
      if (moveTo(r, p.x, p.y, sp, dt)){ r.st = 'assist'; r.face = p.face; r.look = 1.5; }
      break;
    }
    case 'study': case 'assist': {
      r.hammer += dt;
      if (r.st === 'study'){
        // turning the pages (there aren't many left)
        r.flipT -= dt; if (r.flipT <= 0){ r.flipT = rand(2.2, 4.6); r.flipP = 0; if (Math.random() < 0.5){ const a = sndAt(r.x, r.y); sfx('paper'); } }
        if (r.flipP < 1) r.flipP = Math.min(1, r.flipP + dt/0.6);
        // a stint of studying counts as a bit of work, so a row shared with another task still takes turns
        r.unitT = (r.unitT || 0) + dt; if (r.unitT >= 15){ r.unitT = 0; unitDone(r, 'research'); }
        if (Math.random() < dt*0.05) robotSays(r, Math.random() < .5 ? 'hmm' : 'chat');
      } else {
        const h = bookHolder();
        if (!h || bookRt.by === r.id){ r.st = 'idle'; break; }
        r.face = h.x >= r.x ? 1 : -1;
        // the best reader holds the book: a helper that reads better than the holder takes it over
        if (h.st === 'study' && studyMul(r.id) > studyMul(h.id) + 1e-9){
          const from = bookHand(h);
          bookRt.by = r.id; bookRt.held = true;
          h.aspot = r.aspot; h.st = 'toAssist'; r.aspot = -1; r.st = 'toStudy';
          flyTo('book', from.x, from.y, r.x + r.face*14, r.y - 26, 0.45, 14, { rot: 0 });
          pop(r.x, r.y - 80, 'let me see!', 'note', 15);
          break;
        }
        if (Math.random() < dt*0.04) robotSays(r, 'chat');
      }
      r.look -= dt;
      if (r.look <= 0){ r.look = 1.5; if (robotTask(r) !== 'research'){ leaveResearch(r); r.st = 'idle'; } }
      break;
    }
  }
}
// V12.1: the story camera. Zooms in on the robot that picked up the book, follows it to the workshop, lets it open the
// book, then glides back to where the camera was. Any drag, pinch or zoom by the player hands the camera back at once.
function startFollow(r){
  camAnim = null; closeCard();   // (V13.2: an open card would hide what the story camera is showing)
  // (if the camera is still on the find, it carries on from there and still goes back to where you had it)
  const prev = camFollow;
  camFollow = { id: r.id, from: prev ? prev.from : { z: cam.z, ox: cam.ox, oy: cam.oy }, z0: cam.z, c0: s2w(W/2, H/2), t: 0, hold: 0 };
}
// V13.2: zoom in on a spot (the dead bee popping out from under a petal), hold a moment, then go back
function startFindCam(x, y){
  if (simMode || camFollow) return;
  camAnim = null; closeCard();
  camFollow = { spot: { x, y }, from: { z: cam.z, ox: cam.ox, oy: cam.oy }, z0: cam.z, c0: s2w(W/2, H/2), t: 0, hold: 0 };
}
function updCamFollow(dt){
  const F = camFollow; if (!F) return;
  const back = dur => { camAnim = { from: { z: cam.z, ox: cam.ox, oy: cam.oy }, to: F.from, t: 0, dur }; camFollow = null; camMovedT = performance.now(); };
  if (F.spot){
    F.t += dt; if (F.t > 4.6){ back(1.8); return; }
    const zIn = Math.min(zoomLimits()[1], Math.max(F.from.z*1.9, 1.5)), k = ease(clamp(F.t/1.3, 0, 1)), z = lerp(F.z0, zIn, k);
    const cx = lerp(F.c0.x, F.spot.x, k), cy = lerp(F.c0.y, F.spot.y - 24, k);
    cam.z = z; cam.ox = W/2 - cx*z; cam.oy = H/2 - cy*z;
    if (F.t < 1.4) camMovedT = performance.now();
    if (cardOpen) placeCard();
    return;
  }
  const r = R[F.id];
  if (!r || !(['pickBook', 'toStudy', 'study', 'idle'].includes(r.st)) || bookRt.by !== r.id){ back(1.2); return; }
  F.t += dt;
  if (r.st === 'study'){ F.hold += dt; if (F.hold > 2.6){ back(1.8); return; } }
  if (F.t > 40){ back(1.5); return; }   // never gets stuck following
  const zIn = Math.min(zoomLimits()[1], Math.max(F.from.z*1.9, 1.5)), k = ease(clamp(F.t/1.3, 0, 1));
  const z = lerp(F.z0 != null ? F.z0 : F.from.z, zIn, k), tx = r.x + r.face*6, ty = r.y - 32;
  // the centre glides from where the view was onto the robot, then stays on it (smoothed, so it doesn't jitter)
  F.cx = F.cx == null ? tx : lerp(F.cx, tx, 1 - Math.pow(0.02, dt)); F.cy = F.cy == null ? ty : lerp(F.cy, ty, 1 - Math.pow(0.02, dt));
  const cx = lerp(F.c0.x, F.cx, k), cy = lerp(F.c0.y, F.cy, k);
  cam.z = z; cam.ox = W/2 - cx*z; cam.oy = H/2 - cy*z;
  if (F.t < 1.4) camMovedT = performance.now();   // don't rebuild the ground mid-zoom; once zoomed in it rebuilds as needed
  if (cardOpen) placeCard();
}
function finishResearch(){
  S.story.prog = researchNeed(); S.story.done = true; S.story.doneT = S.t;
  const h = bookHolder(), from = h && bookRt.held ? bookHand(h) : { x: S.story.x, y: S.story.y - 3 };
  bookRt.by = null; bookRt.held = false;
  if (cardOpen && cardOpen.kind === 'book') closeCard();
  for (const q of R) if (RESEARCH_STATES.includes(q.st)){ q.st = 'idle'; q.aspot = -1; unitDone(q, 'research'); }
  if (S.story.item === 'bee'){ finishBee(from); save(); return; }
  if (!simMode){
    // the book goes up on the workshop shelf; blowers and shakers can be built now
    flyTo('book', from.x, from.y, SHED.x - 28, SHED.y - 46, 1.0, 46, { rot: 0 });
    setTimeout(() => sparkle(SHED.x - 28, SHED.y - 46), 1000);
    sparkle(SHED.x, SHED.y - 70);
    pop(SHED.x, SHED.y - 122, 'New: blowers and shakers', 'note', 19, 1.0, 4);
    sfx('chime', 'sale');
    for (const q of R) if (Math.hypot(q.x - STUDY.x, q.y - STUDY.y) < 120){ pop(q.x, q.y - 76, '!', 'note', 24, rand(0, 0.3)); robotSays(q, 'happy', true); }
    setTimeout(() => showToast('An elephant that blows, a crab that shakes!', 'The robots worked out the old picture book. Blowers and shakers can now be built in the Workshop.', 11), 600);
  }
  save();
}
// V13: the robots work out the dead bee: a robot beehive can be built here now
function finishBee(from){
  S.flags.hiveKnown = true; S.flags.hiveShown = true; hiveRt.shownT = S.t;
  if (simMode) return;
  flyTo('book', from.x, from.y, HIVE.x - 6, HIVE.y - 30, 1.1, 60, { rot: 0 });
  setTimeout(() => sparkle(HIVE.x, HIVE.y - 30), 1100);
  pop(HIVE.x + 10, HIVE.y - 84, 'New: a robot beehive', 'note', 19, 1.1, 4);
  sfx('chime', 'sale');
  for (const q of R) if (Math.hypot(q.x - STUDY.x, q.y - STUDY.y) < 120){ pop(q.x, q.y - 76, '!', 'note', 24, rand(0, 0.3)); robotSays(q, 'happy', true); }
  setTimeout(() => showToast('A tiny flying worker!', 'The robots worked out how the bee works. A robot beehive can now be built.', 11), 600);
}
function updResearch(dt){
  if (!researchOpen()) return;
  const v = researchRate();
  if (v > 0){ S.story.prog = Math.min(researchNeed(), S.story.prog + v*dt); if (S.story.prog >= researchNeed() - 1e-9) finishResearch(); }
  // while someone holds the book, the save keeps it where they are (a reload finds it on the ground there)
  const h = bookRt.held ? bookHolder() : null;
  if (h){ S.story.x = h.x + h.face*15; S.story.y = Math.min(h.y + 3, 2); }
  else if (bookRt.held || (bookRt.by != null && !bookHolder())){ bookRt.held = false; bookRt.by = null; }
}

// ───────────────────────── story beats: letters from the truck driver, and trips to other lots (V13)
// A beat starts with a hidden milestone (MILESTONES). The truck driver brings a letter on the next pickup (S.post holds
// the ones waiting for the truck): it steps out of the cab, puts the letter down in the yard (S.letters) and drives on.
// Reading a letter can open a trip: the travel task ("Go to new lot"), which starts in everyone's Off pile and only one
// robot can take. That robot waits at the curb, hops into the back of the truck at the next pickup and rides away; the
// game carries on in the other lot (travel(), then arrive() on the next page). For a new beat: a milestone, a LETTERS
// entry and, for a new place, a lot file in public/lots/.
const LETTERS = {
  // (V13.1: the first letter is put down where the beehive will go, so it stands out)
  // V14: reading it opens the trip straight away; the $100 is a live goal and only comes out of the cash at the truck
  newLot: { at: () => ({ x: HIVE.x, y: HIVE.y - 4 }), title: 'A letter', sign: 'Trucker',
    text: 'We found another spot that could use some cleanup, send your best cleanup robot. Bring $' + TRIP_CASH + ' to get started there.',
    // V13.5: what carries over, in small print
    note: () => 'Only truck upgrades, robot unlocks and ' + tripRobotName() + '’s skills stay across yards.',
    open: () => openTrip({ to: 'prairie', cash: TRIP_CASH }) },
  goHome: { at: () => ({ x: HIVE.x - 8, y: HIVE.y + 16 }), title: 'Another letter', sign: 'Trucker',
    text: 'Let me know when you and a bee want to go back.', open: () => openTrip({ to: 'home', bee: true }) },
  // V14: the third beat. Once the quests are done (a bigger yard, a mine and $1,000 in hand), the driver writes about a
  // rainy hollow down the road: Tinker and a blower go, with the $1,000
  hollow: { at: () => ({ x: SIGN.x - 46, y: SIGN.y - 30 }), title: 'A soggy letter', sign: 'Trucker',
    text: 'There’s a rainy old hollow down the road, knee-deep in wet leaves. They need help badly. Bring Tinker and your best blower robot, and $' + HOLLOW_CASH.toLocaleString('en-US') + ' to get started there.',
    note: () => 'Only truck upgrades, robot unlocks and the skills of the two robots that go stay across yards.',
    open: () => openTrip({ to: 'hollow', cash: HOLLOW_CASH, crew: ['robot', 'blower'], who: 0 }) },
};
const lotTitle = id => id === 'home' ? 'your first yard' : (window.LOTS && window.LOTS[id] && window.LOTS[id].title) || 'a new lot';
// the truck driver: a robot like yours, with a brown band and a brown cap, and no basket
const DRIVER = { name:'Driver', body:'#dcd1b8', body2:'#a89c80', head:'#e6dcc6', head2:'#b7ab92', band:'#7a5232', bandW:5, bw:23, bh:22, hw:18, hh:13, tw:26, rust:0, driver:true };
const DRIVER_CFG = { lv:{ speed:4, carry:0, study:0 }, prio:[] };
const CURB = { x: PARK + 26, y: 5 };      // where a robot waits for the truck
const CURB2 = { x: PARK + 60, y: 7 };     // V14: and where a blower coming along waits, beside it
const curbSpot = o => o.kind ? CURB2 : CURB;
const RIDE = { dx: 34, y: LANE - 56 };    // where it stands in the back of the truck (x is from the truck; its treads are below the sides)
// V14: with two aboard, the robot stands at the front of the bed and the blower behind it
function rideSpot(o){ const rs = truck.riders, n = rs.length, k = Math.max(0, rs.indexOf(o)); return { x: truck.x + (n > 1 ? [20, 50][k] || 50 : RIDE.dx), y: RIDE.y + (o.kind ? 2 : 0) }; }
const HOME_EARNED = 200;                  // what the first yard made while you were away (on the prairie)
const HOLLOW_HOME_EARNED = 2000;          // V14: and while Tinker and the blower were at the Rainy hollow
// dev (?fresh&lot=prairie): about what the robot you'd send has when the letter comes ($900 earned in the first yard)
const DEV_TRAVELLER = { lv:{ speed:7, carry:10, pick:7, grab:3, reach:3 }, tech:['treads', 'hamper', 'servos', 'claw', 'arm', 'hopper'], truck:1, cleanup:1 };
const HIVE_DEAL = 60;                     // the beehive back home, once a bee has come along
// the robot that goes (or would go) to the new lot: the one with the trip in Do, else the first robot (Tinker)
const tripRobotName = () => { const h = typeof tripHolder === 'function' ? tripHolder() : null, i = h ? S.robots.indexOf(h) : 0; return S.robots[i] ? styleOf(i).name : 'your robot'; };
function postLetter(id){ if (!S.post.includes(id) && !S.letters.some(l => l.id === id)) S.post.push(id); }
// runtime: the driver while it's out of the cab, the bee riding along, and whether we're on our way somewhere
let driver = null, travelling = false;
const guest = { on: false, mode: 'hover', x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, anim: 0, ph: 0, face: 1, carry: 0, i: 0, st: 'fly', up: {} };
function startDriver(){
  const id = S.post.shift(), L = LETTERS[id]; if (!L) return;
  const p = L.at();
  if (simMode){ S.letters.push({ id, x: p.x, y: p.y, read: false }); return; }
  const sx = truck.x - 92, side = sx < p.x ? -1 : 1;
  driver = { id: -1, driver: true, sty: DRIVER, cfg: DRIVER_CFG, x: sx, y: LANE + 4, face: -1, anim: 0, moving: false, st: 'out', letter: id,
    tx: p.x, ty: p.y, sx: p.x + side*14, sy: p.y + 1, side, timer: 0, blink: 0, blinkT: 1.5, hz: 0, carryL: 0, carryM: 0, carryI: 0 };
  robotSays(driver, 'hello', true);
}
function updDriver(dt){
  const d = driver; if (!d) return;
  d.moving = false; d.anim += dt;
  d.blinkT -= dt; if (d.blinkT < 0){ d.blink = 0.14; d.blinkT = rand(2, 5); } if (d.blink > 0) d.blink -= dt;
  if (d.st === 'out'){ if (moveTo(d, d.sx, d.sy, 52, dt)){ d.st = 'drop'; d.timer = 0.8; d.face = -d.side; } }
  else if (d.st === 'drop'){
    d.timer -= dt;
    if (d.letter && d.timer < 0.45){
      S.letters.push({ id: d.letter, x: d.tx, y: d.ty, read: false });
      flyTo('letter', d.x + d.face*8, d.y - 26, d.tx, d.ty - 2, 0.35, 8, {});
      pop(d.tx, d.ty - 40, 'A letter!', 'note', 18, 0.35); robotSays(d, 'chat', true);
      d.letter = null; save();
    }
    if (d.timer <= 0) d.st = 'back';
  } else if (moveTo(d, truck.x - 92, LANE + 4, 58, dt)) driver = null;
}
// a letter is read for the first time: whatever it starts, starts
function readLetter(i){ const l = S.letters[i]; if (!l || l.read) return; l.read = true; const L = LETTERS[l.id]; if (L && L.open) L.open(); save(); }
// a trip opens: the travel task goes in the Off pile of every robot (and helper) that could take it
// t: { to, bee, cash (travel money, taken at the truck), crew (kinds that go), who (only this robot), earned (the bonus back home) }
function openTrip(t, quiet){
  S.trip = { to: t.to, bee: !!t.bee };
  for (const k of ['cash', 'crew', 'who', 'earned']) if (t[k] != null) S.trip[k] = t[k];
  for (const kind of tripKinds()) for (const c of cfgsOf(kind)) if (tripFor(c) && !taskOn(c, 'travel')){ taskRemove(c, 'travel'); c.off.push('travel'); }
  if (simMode || quiet) return;
  const who = S.robots.findIndex(tripFor), name = who >= 0 ? styleOf(who).name : 'a robot', crew = tripKinds().length > 1;
  const money = t.cash ? ' The ' + cash2(t.cash).replace('.00', '') + ' only comes out of your cash when they climb into the truck.' : '';
  if (t.to === 'home') setTimeout(() => showToast('A ride home', 'New task: Go back to original lot. Drag it into ' + name + '’s Do list: it waits at the curb and rides back with the next pickup, and a bee comes along.', 12), 400);
  else if (crew) setTimeout(() => showToast('A new lot!', 'New task: Go to new lot. Drag it into ' + name + '’s Do list and into one blower’s: they wait at the curb and ride along with the next pickup.' + money, 13), 400);
  else setTimeout(() => showToast('A new lot!', 'New task: Go to new lot. Drag it into your best robot’s Do list: it waits at the curb and rides along with the next pickup.' + money, 12), 400);
}
// the runtime robot or helper of a config
const runtimeOf = (kind, c) => kind === 'robot' ? R[S.robots.indexOf(c)] : HB.find(h => h.kind === kind && helperCfg(h) === c);
// V14: the whole crew at the curb (one of each kind the trip takes), or null
function crewAtCurb(){
  if (!S.trip) return null;
  const out = [];
  for (const kind of tripKinds()){ const c = tripHolder(kind), o = c && runtimeOf(kind, c); if (!o || o.st !== 'curb') return null; out.push(o); }
  return out;
}
// at a pickup, once everyone who goes is waiting at the curb (and the travel money is there), they all climb in; the
// money comes out of the cash right then
function updBoarding(){
  const T = truck;
  if (simMode || T.st !== 'load' || T.riders.length || driver || !S.trip) return;
  const crew = crewAtCurb(); if (!crew || !tripCashOK()) return;
  if (S.trip.cash && !S.trip.paid){
    S.cash -= S.trip.cash; S.trip.paid = S.trip.cash;
    const hc = $('hCash').getBoundingClientRect(), p = s2w(hc.left + 150, hc.bottom + 75); pop(p.x, p.y, cash2(S.trip.cash).replace('.00', '') + ' packed for the trip', 'note', 18, 0, 3);
  }
  for (const o of crew) startHop(o, 'in');
}
// hopping into (dir 'in') or out of (dir 'out') the back of the truck (a robot or, V14, a helper)
function startHop(o, dir){
  if (!o.kind){ release(o); leaveResearch(o); releaseStations(o); } else { o.target = null; o.lap = null; o.dig = null; o.brolly = null; }
  o.hop = { t: 0, dur: 0.9, dir, x0: o.x, y0: o.y }; o.st = dir === 'in' ? 'hopIn' : 'hopOut';
  if (dir === 'in' && !truck.riders.includes(o)) truck.riders.push(o);
  if (o.kind) helperSays(o, 'happy'); else robotSays(o, 'happy', true);
}
function updHop(o, dt){
  const h = o.hop, k = clamp((h.t += dt)/h.dur, 0, 1), inT = rideSpot(o);
  const a = h.dir === 'in' ? { x: h.x0, y: h.y0 } : inT, b = h.dir === 'in' ? inT : curbSpot(o);
  o.x = lerp(a.x, b.x, k); o.y = lerp(a.y, b.y, k); o.hz = Math.sin(k*Math.PI)*36; o.face = b.x >= a.x ? 1 : -1; o.moving = true;
  if (k < 1) return;
  o.hz = 0; o.hop = null; o.moving = false;
  if (h.dir === 'in'){
    o.st = 'ride'; o.face = -1;
    if (truck.riders.every(q => q.st === 'ride')){ pop(truck.x + 34, RIDE.y - 70, 'All aboard!', 'note', 17); sparkle(o.x, RIDE.y - 30); if (S.trip && S.trip.bee && !guest.on) beeAboard(); }
  } else {
    o.st = 'idle'; truck.riders = truck.riders.filter(q => q !== o); sparkle(o.x, o.y - 20);
    if (!truck.riders.length && guest.on && guest.mode === 'ride') guestLeaves();
  }
}
// the truck waits while the driver is out, while someone hops in or out, or while the crew at the curb is about to
const truckBusy = () => !!driver || R.some(q => q.st === 'hopIn' || q.st === 'hopOut') || HB.some(q => q.st === 'hopIn' || q.st === 'hopOut') ||
  (!truck.riders.length && !!crewAtCurb() && tripCashOK()) || (guest.on && guest.mode === 'toTruck');
// a bee from the hive comes along for the ride home (one bee less in this hive, if it has more than one)
function beeAboard(){
  let from = { x: HIVE.x, y: HIVE.y, z: 30 };
  if (S.hive.built && S.hive.bees > 1){ const b = B.pop(); S.hive.bees--; if (b){ if (b.tgt && b.tgt.claim === b) b.tgt.claim = null; from = { x: b.x, y: b.y, z: b.z }; } }
  Object.assign(guest, { on: true, mode: 'toTruck', x: from.x, y: from.y, z: from.z });
  if (!simMode) pop(from.x, from.y - from.z - 20, 'bzz!', 'note', 15);
}
// back home: the bee flies off the truck to where the hive will be (or straight in, if there's a hive already)
function guestLeaves(){ guest.mode = S.hive.built ? 'join' : 'toHive'; }
const GUEST_SPOT = () => ({ x: HIVE.x + 30, y: HIVE.y + 4, z: 26 });
function updGuest(dt){
  const g = guest; if (!g.on) return;
  g.anim += dt;
  const fly = (tx, ty, tz, sp) => { const dx = tx - g.x, dy = ty - g.y, dz = tz - g.z, d = Math.hypot(dx, dy, dz); if (Math.abs(dx) > 0.5) g.face = dx > 0 ? 1 : -1; if (d < sp*dt + 0.5){ g.x = tx; g.y = ty; g.z = tz; return true; } g.x += dx/d*sp*dt; g.y += dy/d*sp*dt; g.z += dz/d*sp*dt; return false; };
  if (g.mode === 'ride'){ g.x = truck.x + RIDE.dx + 16 + Math.sin(g.anim*1.7)*5; g.y = RIDE.y + 2; g.z = 44 + Math.sin(g.anim*2.6)*3; g.face = -1; }
  else if (g.mode === 'toTruck'){ if (fly(truck.x + RIDE.dx + 16, RIDE.y + 2, 44, 90)) g.mode = 'ride'; }
  else if (g.mode === 'toHive'){ const p = GUEST_SPOT(); if (fly(p.x, p.y, p.z, 70)) g.mode = 'hover'; }
  else if (g.mode === 'hover'){
    const p = GUEST_SPOT();
    g.x = lerp(g.x, p.x + Math.sin(g.anim*0.9)*14, 1 - Math.pow(0.1, dt)); g.y = lerp(g.y, p.y + Math.sin(g.anim*1.3)*5, 1 - Math.pow(0.1, dt)); g.z = p.z + Math.sin(g.anim*2.2)*4;
    g.face = Math.cos(g.anim*0.9) > 0 ? 1 : -1;
    if (S.hive.built) g.mode = 'join';
  } else if (g.mode === 'join'){ if (fly(DOOR.x, DOOR.y, DOOR.z, 70)){ g.on = false; if (!simMode) sparkle(DOOR.x, DOOR.y - DOOR.z); } }
}
// leaving: everything this lot hands on goes into WORLD.arrive, this lot is saved as it is, and the page reloads into
// the other lot (it stays paused until you come back)
function travel(){
  const T = truck, trip = S.trip || { to: 'prairie' };
  const crew = T.riders.map(o => { const kind = o.kind || 'robot', i = kind === 'robot' ? o.id : o.idx; return { kind, i, cfg: cfgsOf(kind)[i] }; }).filter(q => q.cfg);
  if (!crew.length){ T.riders = []; return; }
  travelling = true;
  const carry = { from: LOT_ID, to: trip.to, bee: !!trip.bee, earned: trip.earned || 0,
    crew: crew.map(q => ({ kind: q.kind, bot: JSON.parse(JSON.stringify(q.cfg)), sty: q.kind === 'robot' ? styleIdx(q.i) : helperStyleIdx(q.kind, q.i), home: q.cfg.home != null ? q.cfg.home : q.i })),
    tech: Object.assign({}, S.tech), truck: S.lv.truck, cleanup: S.lv.cleanup, helpers: helpersKnown(), seen: Object.assign({}, S.seen),
    fare: trip.to !== 'home' ? (trip.paid || S.flags.fare || 0) : 0, hints: Object.assign({}, S.flags.hints), know: { opened: S.flags.opened, research: S.flags.research, taskHint: S.flags.taskHint, sentHint: S.flags.sentHint }, at: Date.now() };
  for (const q of crew){ q.cfg.away = trip.to; if (q.kind === 'robot') q.cfg.miner = null; taskRemove(q.cfg, 'travel'); q.cfg.off.push('travel'); }
  if (trip.to === 'hollow') S.flags.hollowGone = true;   // the quests are done with
  S.trip = null; S.letters = S.letters.filter(l => !l.read);
  if (trip.to !== 'home') S.flags.fare = 0;   // V13.5: the travel money went with the robot
  T.riders = []; T.st = 'away'; T.fill = 0; S.truckT = Math.max(S.truckT, 2);
  WORLD.cur = trip.to; WORLD.arrive = carry;
  const json = JSON.stringify(S);
  if (FRESH){ FRESH_SAVES[KEY] = json; try { sessionStorage.setItem(HOP_KEY, JSON.stringify({ world: WORLD, saves: FRESH_SAVES })); } catch(e){} }
  else { try { localStorage.setItem(KEY, json); } catch(e){} saveWorld(); }
  closeCard();
  lotFade(true, 'Off to ' + lotTitle(trip.to) + '…');
  setTimeout(() => location.reload(), 1300);
}
// a full-screen curtain while the truck drives between lots
function lotFade(on, text, instant){
  let el = $('lotFade');
  if (!el){ el = document.createElement('div'); el.id = 'lotFade'; el.innerHTML = '<div class="lf"></div>'; document.body.appendChild(el); }
  if (text != null) el.firstChild.textContent = sayT(text);
  if (on && instant){ el.style.transition = 'none'; el.classList.add('show', 'on'); void el.offsetWidth; el.style.transition = ''; }
  else if (on){ el.classList.add('show'); void el.offsetWidth; el.classList.add('on'); }
  else { el.classList.remove('on'); setTimeout(() => el.classList.remove('show'), 1000); }
}
// arriving (on the new page): what came along from the other lot. Returns what the start of the game should set up.
function arrive(a, wasNew){
  const home = LOT_ID === 'home';
  for (const k in (a.tech || {})) S.tech[k] = true;
  S.lv.truck = Math.max(S.lv.truck | 0, a.truck | 0); S.lv.cleanup = Math.max(S.lv.cleanup | 0, a.cleanup | 0);
  if (a.helpers) S.flags.helpers = true;
  S.seen = Object.assign({}, a.seen || {}, S.seen);
  S.flags.hints = Object.assign({}, a.hints || {}, S.flags.hints || {});
  for (const k in (a.know || {})) if (a.know[k]) S.flags[k] = true;   // tips you've already had
  if (wasNew && !home){ S.robots = []; S.blowers = []; S.shakers = []; S.cash = S.peak = a.fare > 0 ? a.fare : LOT_START_CASH; }
  // the robots that came along (V14: a robot and maybe a blower) keep their looks, their upgrades and their task lists
  const crew = a.crew || [{ kind: 'robot', bot: a.bot, sty: a.sty, home: a.home }], out = [];
  for (const q of crew){
    const kind = q.kind || 'robot', list = cfgsOf(kind), fresh = () => kind === 'robot' ? newRobotCfg() : newHelperCfg(kind);
    let i = home ? q.home : list.findIndex(c => c.home === q.home);
    if (!(i >= 0 && list[i])){ i = list.length; list.push(fresh()); }
    const b = q.bot || {}, cfg = list[i];
    cfg.lv = Object.assign(fresh().lv, b.lv || {});
    cfg.prio = (b.prio || []).map(row => row.slice()); cfg.off = (b.off || []).slice(); if (kind === 'robot') cfg.miner = null;
    delete cfg.away; delete cfg.sty; delete cfg.home;
    if (q.sty != null && q.sty !== i) cfg.sty = q.sty;
    if (!home) cfg.home = q.home;
    taskRemove(cfg, 'travel'); cfg.off.push('travel'); tasksFix(cfg, kind);
    out.push({ kind, i });
  }
  const earned = a.earned || HOME_EARNED;
  if (home){
    S.cash += earned; S.totals.cash += earned;
    if (a.bee){
      S.flags.hiveKnown = true; S.flags.hiveShown = true;
      if (S.hive.built) S.hive.bees = Math.min(MAX_BEES, S.hive.bees + 1); else { S.flags.hiveDeal = true; S.flags.guestBee = true; }
    }
  } else if (LOT.tripHome && !S.trip){
    // V14: a lot can let the crew ride home whenever you like (the Rainy hollow, for now)
    openTrip({ to: 'home', crew: out.map(q => q.kind).filter((k, j, A) => A.indexOf(k) === j), earned: LOT.tripHome.earned }, true);
  }
  return { crew: out, bee: !!a.bee, home, earned };
}
// the truck pulls in with the robots (and maybe a bee) in the back; they hop off at the curb
function arriveScene(A){
  syncHelpers();
  const os = A.crew.map(q => q.kind === 'robot' ? R[q.i] : HB.find(h => h.kind === q.kind && h.idx === q.i)).filter(Boolean);
  if (!os.length) return;
  truck.riders = os; truck.arriving = true; truck.st = 'arrive'; truck.fill = 0;
  truck.x = Math.max(visRect().x1 + 110, PARK + 200);
  for (const o of os){ o.st = 'ride'; const p = rideSpot(o); o.x = p.x; o.y = p.y; o.face = -1; }
  if (A.bee){ Object.assign(guest, { on: true, mode: 'ride' }); }
  sfx('truckIn', sndAt(PARK + 30, LANE).pan, 2.6);
  const names = A.crew.map(q => q.kind === 'robot' ? styleOf(q.i).name : helperStyleOf(q.kind, q.i).name);
  if (A.home){
    setTimeout(() => {
      pop(BIN.x, BIN.y - 110, '+' + cash2(A.earned) + ' earned while you were away', 'cash', 20, 0, 4);
      showToast('Back home!', 'The yard kept going without you and made ' + money(A.earned) + '.' + (A.bee ? ' The bee is looking for a home: build it a beehive.' : ''), 11);
    }, 1800);
  } else if (LOT.arrive) setTimeout(() => showToast(LOT.arrive.title, LOT.arrive.text(names[0], names), 12), 1500);
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
    for (let i = HB.filter(h => h.kind === kind).length; i < n; i++){ const h = newHelper(kind, i); if (cfgsOf(kind)[i].away) h.st = 'gone'; HB.push(h); }
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
// V14: helpers keep their look too when they travel (cfg.sty, when it isn't their place in the list); new ones take a free look
const HELPER_LOOKS = kind => kind === 'blower' ? BLOWER_STYLES : SHAKER_STYLES;
const helperStyleIdx = (kind, i) => { const c = cfgsOf(kind)[i]; return c && c.sty != null ? c.sty : i; };
const helperStyleOf = (kind, i) => HELPER_LOOKS(kind)[helperStyleIdx(kind, i)] || HELPER_LOOKS(kind)[0];
const helperStyle = h => helperStyleOf(h.kind, h.idx);
function nextHelperStyle(kind){ const used = new Set(cfgsOf(kind).map((c, i) => c.sty != null ? c.sty : i)); for (let k=0;k<HELPER_LOOKS(kind).length;k++) if (!used.has(k)) return k; return cfgsOf(kind).length % HELPER_LOOKS(kind).length; }
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
// V14 (WET_WOOD, from the Rainy hollow test copy): carrying the wood umbrella. A blower with the task walks beside the
// hauler carrying the most dry wood that nobody else is covering; with nobody hauling it waits by the shelf of dry
// bundles (-1). Null: no haulers at all.
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
  if (t === 'shake') return h.kind === 'shaker' ? shakeTarget(h) : null;
  if (t === 'snip') return h.kind === 'shaker' && S.hive.built ? snipTarget(h) : null;
  if (t === 'brolly') return h.kind === 'blower' && WET_WOOD ? brollyTarget(h) : null;
  if (t === 'travel') return tripFor(helperCfg(h)) && tripCashOK() ? 1 : null;   // V14: a blower going along on a trip
  return null;
}
function helperDecide(h){
  const cfg = helperCfg(h), found = {};
  // (V14: a trip in Do at all comes first, like for the robots)
  const t = S.trip && taskOn(cfg, 'travel') && taskOpen('travel', cfg) && helperWork(h, 'travel') != null ? 'travel'
    : chooseTask(h, cfg, x => { const w = helperWork(h, x); if (w == null) return false; found[x] = w; return true; });
  h.task = t; noteTask(h, t);
  if (t === 'travel'){ h.target = null; h.lap = null; h.dig = null; h.st = 'toCurb'; return; }
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
  // V14: a trip in its Do list (with the money there) pulls it off whatever it's doing
  if (S.trip && ['lap', 'dig', 'stoke', 'brolly', 'wander', 'rest', 'go'].includes(h.st) && (h.tlook = (h.tlook || 0) - dt) <= 0){
    h.tlook = 0.5; const c = helperCfg(h);
    if (c && taskOn(c, 'travel') && taskOpen('travel', c) && helperWork(h, 'travel') != null){ h.target = null; h.lap = null; h.st = 'idle'; }
  }
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
    case 'wander': if (moveTo(h, h.tx, h.ty, sp*0.4, dt)){ h.st = 'rest'; h.timer = rand(1.2, 2.6); } break;
    case 'rest': h.timer -= dt; if (h.timer <= 0) h.st = 'idle'; break;
    case 'brolly': {
      // V14 (WET_WOOD): walking beside a hauler with the big wooden umbrella held over it (and over the dry wood)
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
    // V14: going along on a trip: wait at the curb beside the robot, hop in with it, ride along
    case 'toCurb': { const q = curbSpot(h); if (moveTo(h, q.x, q.y, sp, dt)){ h.st = 'curb'; h.face = 1; h.timer = 0.5; } break; }
    case 'curb': { h.timer -= dt; if (h.timer <= 0){ h.timer = 0.5; const c = helperCfg(h); if (!(S.trip && taskOn(c, 'travel') && taskOpen('travel', c) && helperWork(h, 'travel') != null)) h.st = 'idle'; else if (Math.random() < 0.06) helperSays(h, 'hmm'); } break; }
    case 'hopIn': case 'hopOut': updHop(h, dt); break;
    case 'ride': { const q = rideSpot(h); h.x = q.x; h.y = q.y; h.hz = 0; break; }
    case 'gone': break;   // away on another lot
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
      // V13: someone arriving hops off; the driver brings any letters
      if (T.arriving) for (const o of T.riders.slice()) if (o.st === 'ride') startHop(o, 'out');
      T.arriving = false;
      if (S.post.length) startDriver();
    }
  } else if (T.st === 'load'){
    T.timer -= dt;
    if (T.timer <= 0 && truckBusy()) T.timer = 0.001;   // V13: the truck waits for the driver and anyone hopping on or off
    const any = T.takeL + T.takeM + T.takeH + T.takeB + T.takeI + T.takeG;
    T.fill = any > 0 ? clamp((2.3 - T.timer)/1.8, 0, 1) * clamp((T.takeL + T.takeB*BAG_SIZE + T.takeM*3 + T.takeI*8 + (T.takeH + T.takeG)*2)/80, 0.25, 1) : 0;
    puffExhaust(T, dt, 0.25);
    if (T.timer <= 0){
      let amt = T.takeL*leafPrice() + T.takeB*bagPrice() + T.takeM*metalPrice() + T.takeI*ingotPrice() + T.takeH*honeyPrice() + T.takeG*giftJarPrice(), bonus = 0;
      // V13.4: what the honey made, for the prairie's honey goal (checked before it's counted, so the number can fly up to the pill)
      const honeyAmt = T.takeH*honeyPrice() + T.takeG*giftJarPrice(), honeyFly = !simMode && honeyAmt > 0 && goalShowing('honey');
      S.totals.honeyCash = (S.totals.honeyCash || 0) + honeyAmt;
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
          if (T.takeM) sale.push({ res:'metal', icon:'metal', v: T.takeM*metalPrice(), x: TUB.x, y: -96, sub: T.takeM + ' metal' });
          if (T.takeI) sale.push({ res:'metal', icon:'ingot', v: T.takeI*ingotPrice(), x: PALLET.x, y: -96, sub: plural(T.takeI, 'ingot', 'ingots') });
          if (T.takeH || T.takeG) sale.push({ res:'honey', icon: T.takeG && !T.takeH ? 'gift' : 'jar', v: T.takeH*honeyPrice() + T.takeG*giftJarPrice(), x: CRATE.x, y: -96, sub: [T.takeH ? plural(T.takeH, 'jar', 'jars') : '', T.takeG ? plural(T.takeG, 'gift jar', 'gift jars') : ''].filter(Boolean).join(' + ') });
          if (bonus) sale.push({ res:'bonus', icon:'bonus', v: bonus, x: SIGN.x, y: SIGN.y - 90, sub: 'cleanup bonus!' });
          sale.sort((a, b) => a.x - b.x);
          const tx = T.x + 26, ty = LANE - 70;
          sale.forEach((q, n) => {
            pops.push({ kind:'sale', x: q.x, y: q.y, oy: 0, tx, ty, text: '+' + cash2(q.v), sub: sayT(q.sub), res: q.res, icon: q.icon, size: 19, t: -n*SALE_STEP, life: SALE_HOLD + SALE_FLY });
            // V13.4: the honey number splits as it leaves the crate: one copy into the truck, one up to the honey goal
            if (q.res === 'honey' && honeyFly){ goalRt.pending += q.v; pops.push({ kind:'sale', toHud: true, v: q.v, x: q.x, y: q.y, oy: 0, tx, ty, text: '+' + cash2(q.v), res: q.res, icon: q.icon, size: 19, t: -n*SALE_STEP, life: SALE_HOLD + SALE_FLY*1.4 }); }
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
    if (T.x < Math.min(V.x0 - 140, PARK - 300)){
      T.st = 'away'; S.truckT = Math.max(S.truckT, 2); T.fill = 0;
      if (T.riders.length && T.riders.every(o => o.st === 'ride') && !simMode) travel();   // V13: off to the other lot
    }
  }
}
// the pickup sign says "now" only while the truck pulls in and loads; once it's loaded the clock for the next one runs
const truckHere = () => truck.st === 'arrive' || truck.st === 'load';
function puffExhaust(T, dt, k){
  if (!simMode && Math.random() < dt*6*k) parts.push({ k:'dust', x: T.x + 74, y: LANE - 10, vx: rand(10,30), vy: rand(-16,-8), g:0, life: rand(.7,1.2), t:0, r: rand(3,6), gray:true });
}

// ───────────────────────── particles & popups
function flyTo(kind, x0, y0, x1, y1, dur, arc, o){ if (simMode) return; parts.push(Object.assign({ k:'fly', kind, x0, y0, x1, y1, dur, arc, t:0, life:dur, rot: rand(0,TAU) }, o)); }
function pop(x, y, text, kind, size, delay, life){ if (simMode) return; pops.push({ x, y, text: sayT(text), kind, size: size || 18, t: -(delay||0), life: life || (kind === 'cash' ? 3.4 : kind === 'note' ? 2.6 : 1.7) }); }
function sparkle(x, y){ if (simMode) return; for (let i=0;i<14;i++){ const a = rand(0,TAU), v = rand(40,110); parts.push({ k:'star', x, y, vx: Math.cos(a)*v, vy: Math.sin(a)*v - 30, g: 90, life: rand(.5,.9), t:0 }); } }
function updParts(dt){
  for (const p of parts){
    p.t += dt;
    if (p.k === 'fly'){ if (p.t >= p.life && p.hud) cashBumpT = 0.18; continue; }
    p.vy += (p.g||0)*dt; p.x += p.vx*dt; p.y += p.vy*dt;
  }
  parts = parts.filter(p => p.t < p.life);
  for (const p of pops){
    p.t += dt;
    if (p.toHud && !p.got && p.t >= p.life){ p.got = true; goalRt.pending = Math.max(0, goalRt.pending - p.v); goalRt.bumpT = 0.22; sfx('chime', 'sale'); }
  }
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
const robotVoice = sty => sty < 5 ? sty : sty === 5 ? 7 : sty + 2;   // 5 and 6 are the blowers' and shakers' voices (V13: by look, so a robot keeps its voice on another lot)
function robotSays(r, mood, force){ const a = sndAt(r.x, r.y); sfx('beep', r.driver ? 3 : robotVoice(r.sty ? 0 : styleIdx(r.id)), mood, a.pan, a.vol, force); }
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
const FLOWER_N = LOT.FLOWER_N || [12, 30, 95];
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
  if (x > SHED.x + 40 && x < SHED.x + 96 && y > SHED.y - 24) return false;
  if (x > BIN.x - 58 && x < BIN.x + 92 && y > BIN.y - 74) return false;
  if (Math.abs(x - SIGN.x) < 28 && y > SIGN.y - 34) return false;
  if (Math.abs(x - HIVE.x) < 46 && y > HIVE.y - 175 && y < HIVE.y + 18) return false;
  if (Math.abs(x - CRATE.x) < 32 && y > CRATE.y - 66 && y < CRATE.y + 14) return false;
  if (Math.abs(x - BAGGER.x) < 40 && y > BAGGER.y - 60 && y < BAGGER.y + 14) return false;
  if (Math.abs(x - PALLET.x) < 32 && y > PALLET.y - 50 && y < PALLET.y + 14) return false;
  if (x > PLANT.x - 112 && x < PLANT.x + 112 && y > PLANT.y - 90 && y < PLANT.y + 16) return false;
  for (const p of SPOTS) if (Math.abs(x - p.x) < 54 && Math.abs(y - p.y) < 32) return false;
  for (const p of PUDDLES) if (inPuddle(p, x, y, 10)) return false;   // V14: not in a puddle
  for (const b of BUSHES){ const dx = (x - b.x)/(48*b.s), dy = (y - b.y + 8*b.s)/(26*b.s); if (dx*dx + dy*dy < 1) return false; }
  // not under a tree crown, where nobody would see them
  for (const t of TREES){ const dx = (x - t.x)/(t.r*1.02), dy = (y - t.y - t.r*0.12)/(t.r*1.14); if (dx*dx + dy*dy < 1) return false; }
  for (let L=0; L<AREAS.length - 1; L++){ const A = AREAS[L], sx = Math.round(A.w*0.18), sy = -A.h + 44; if (Math.abs(x - sx) < 42 && y > sy - 34 && y < sy + 12) return false; }
  return true;
}
// V13 (from the prairie): a lot can also have flowers that Wildflower seeding sows (tier 1–3, hidden until sown), and
// lots of flowers just for looks (DECO), painted into the ground so they cost nothing to draw
let DECO = [];
function buildFlowers(){
  FLOWERS = []; DECO = [];
  const clash = (list, x, y, dx, dy) => list.some(f => Math.abs(f.x - x) < dx && Math.abs(f.y - y) < dy);
  // V14: how the clumps are laid out (a lot can space its own differently: the hollow's mushroom patches)
  const FP = Object.assign({ k: [2, 4], kDeco: [3, 6], d: [8, 22], dDeco: [6, 18], clash: [9, 6], s: [1.1, 0.4], sDeco: [0.75, 0.4] }, LOT.flowerPlace || {});
  const place = (L, count, rnd, mk, deco) => {
    const O = owned(L), list = deco ? DECO : FLOWERS;
    let n = 0, tries = 0;
    while (n < count && tries++ < (deco ? 6000 : 4000)){
      const cx = O.x0 + rnd()*(O.x1 - O.x0), cy = O.y0 + rnd()*(O.y1 - O.y0);
      if (!flowerSpotOK(cx, cy, L)) continue;
      const ty = Math.floor(rnd()*FLOWER_TYPES.length), ty2 = Math.floor(rnd()*FLOWER_TYPES.length);
      const k = deco ? FP.kDeco[0] + Math.floor(rnd()*FP.kDeco[1]) : FP.k[0] + Math.floor(rnd()*FP.k[1]);
      for (let m=0, t2=0; m<k && n < count && t2 < 30; t2++){
        const a = rnd()*TAU, d = m ? (deco ? FP.dDeco[0] + rnd()*FP.dDeco[1] : FP.d[0] + rnd()*FP.d[1]) : 0, x = cx + Math.cos(a)*d, y = cy + Math.sin(a)*d*0.6;
        if (!flowerSpotOK(x, y, L) || clash(FLOWERS, x, y, FP.clash[0], FP.clash[1]) || (deco && clash(DECO, x, y, 6, 4))) continue;
        list.push(mk(x, y, deco && LOT.decoTypes ? Math.floor(rnd()*LOT.decoTypes) : rnd() < 0.75 ? ty : ty2, rnd));
        m++; n++;
      }
    }
  };
  const tiers = GEN.seeding ? GEN.seeding.max : 0, share = LOT.seedShare || 0.4;
  for (let L=0; L<AREAS.length; L++){
    const rnd = mulberry(900 + L*17);
    for (let tier=0; tier<=tiers; tier++)
      place(L, tier ? Math.round(FLOWER_N[L]*share) : FLOWER_N[L], rnd, (x, y, ty, r) => { const s = FP.s[0] + r()*FP.s[1]; return { x, y, ty, s, land: L, tier, ph: r()*TAU, full: true, t: 0, regrow: FLOWER_REGROW*(0.85 + r()*0.3), claim: null, bob: 0 }; });
    if (LOT.decoN) place(L, LOT.decoN[L], mulberry(1300 + L*29), (x, y, ty, r) => ({ x, y, ty, s: FP.sDeco[0] + r()*FP.sDeco[1], land: L }), true);
  }
  FLOWERS.sort((a, b) => a.y - b.y);
  DECO.sort((a, b) => a.y - b.y);
  shakeCD.flower = FLOWERS.map(() => 0);
}
function drawDecoFlowers(g, V){
  for (const f of DECO){
    if (f.x < V.x0 || f.x > V.x1 || f.y < V.y0 || f.y > V.y1) continue;
    if (ART.drawDeco){ ART.drawDeco(g, f); continue; }
    const sp = flowerSpr[f.ty], T = FLOWER_TYPES[f.ty]; if (!sp) continue;
    g.drawImage(sp.stem, f.x - sp.sox*f.s, f.y - sp.soy*f.s, sp.sw*f.s, sp.sh*f.s);
    const hs = sp.hw*f.s; g.drawImage(sp.head, f.x - hs/2, f.y - T.h*f.s - hs/2, hs, hs);
  }
}
// a flower bees can use: on your land, and (for the extra ones Wildflower seeding sows) already sown
const flowerOn = f => f.land <= S.land && (f.tier || 0) <= gl('seeding');
const flowerHead = f => FLOWER_TYPES[f.ty].h*f.s;
// a flower only opens its head when a bee can sip it again; until then the bud swells (V7: it used to look open too early)
const bloomOf = ART.bloomOf || (f => f.full ? 1 : clamp((f.t/f.regrow - 0.75)/0.25, 0, 1)*0.3);
function updFlowers(dt){
  for (const f of FLOWERS){
    if (f.bob > 0) f.bob = Math.max(0, f.bob - dt);
    if (f.full) continue;
    f.t += dt*regrowMul();
    if (f.t >= f.regrow){ f.full = true; f.t = 0; }
  }
}

// ── flower art: one sprite for the stem and leaves (with a closed bud on top) and one for the open head
const FLOWER_TYPES = LOT.FLOWER_TYPES || [
  { name:'aster',     h: 12 },
  { name:'goldenrod', h: 14 },
  { name:'sedum',     h: 9  },
  { name:'anemone',   h: 13 },
  { name:'mum',       h: 10, cols:['#a8481e','#d9652a','#ec8a3a','#f6b25c'] },
  { name:'mum',       h: 10, cols:['#7a2418','#a8361d','#c9553a','#e07a5a'] },
];
function buildFlowerSprites(){
  const RES = 3;
  flowerSpr = FLOWER_TYPES.map((T, ti) => {
    if (ART.flowerSprite) return ART.flowerSprite(T, ti);   // V14: the hollow's mushroom patches
    const rnd = mulberry(40 + ti);
    // stem + leaves + bud: origin at the foot of the stem
    const sw = 22, sh = T.h + 10, sox = 11, soy = T.h + 6;
    const sc = document.createElement('canvas'); sc.width = sw*RES; sc.height = sh*RES;
    const g = sc.getContext('2d'); g.scale(RES, RES); g.translate(sox, soy);
    const FS = LOT.flowerStem;   // V13: a lot's own stem colours (the prairie's are fresher, with a coloured bud)
    g.fillStyle = FS ? FS.shadow : 'rgba(30,25,10,.22)'; ell(g, 1.5, 0.5, 4, 1.3); g.fill();
    g.strokeStyle = FS ? FS.stem : '#56652c'; g.lineWidth = 1.1; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(1.2, -T.h*0.5, 0, -T.h); g.stroke();
    for (const [ly, side] of [[-T.h*0.3, -1], [-T.h*0.55, 1]]){
      g.save(); g.translate(0.4, ly); g.rotate(side*0.9); g.fillStyle = FS ? FS.leaf[side < 0 ? 0 : 1] : side < 0 ? '#6c7a37' : '#7e8a43'; ell(g, side*3, 0, FS ? FS.leafW(T) : 3.2, 1.2); g.fill(); g.restore();
    }
    if (FS){ g.save(); g.translate(0, -T.h); g.rotate(0.35); g.fillStyle = FS.bud; ell(g, 0, -1.2, 1.5, 2.3); g.fill(); g.fillStyle = T.bud; g.globalAlpha = 0.75; ell(g, 0, -2.4, 1, 1.1); g.fill(); g.restore(); }
    else { g.save(); g.translate(0, -T.h); g.rotate(0.35); g.fillStyle = '#7d7a3e'; ell(g, 0, -1.2, 1.5, 2.3); g.fill(); g.fillStyle = 'rgba(150,100,60,.6)'; ell(g, 0, -2.4, 0.9, 0.9); g.fill(); g.restore(); }
    // open head: origin at its centre
    const hw = 18, hc = document.createElement('canvas'); hc.width = hw*RES; hc.height = hw*RES;
    const q = hc.getContext('2d'); q.scale(RES, RES); q.translate(hw/2, hw/2);
    if (LOT.drawFlowerHead) LOT.drawFlowerHead(q, T, rnd);
    else if (T.name === 'aster'){
      for (let k=0;k<13;k++){ q.save(); q.rotate(k/13*TAU); q.fillStyle = k%2 ? '#7d5bb0' : '#9e7ad0'; ell(q, 0, -3.3, 1.1, 2.6); q.fill(); q.restore(); }
      q.fillStyle = '#f2c14e'; ell(q, 0, 0, 2, 2); q.fill(); q.fillStyle = '#c98a2a'; ell(q, 0.5, 0.5, 0.9, 0.9); q.fill();
    } else if (T.name === 'goldenrod'){
      for (let k=0;k<20;k++){ const u = k/19, px = -2 + u*5 + Math.sin(u*3)*1.5, py = 4 - u*9; q.fillStyle = ['#d39a26','#e9b93a','#f6d35f'][Math.floor(rnd()*3)]; ell(q, px + (rnd()-0.5)*2.6, py, 1.2 + (1 - u)*0.7, 1.2 + (1 - u)*0.7); q.fill(); }
    } else if (T.name === 'sedum'){
      q.fillStyle = '#8f3f50'; ell(q, 0, 0.6, 5.4, 3.4); q.fill();
      for (let k=0;k<26;k++){ const a = rnd()*TAU, d = Math.sqrt(rnd()); q.fillStyle = ['#c25a6e','#d9798a','#e39aa5'][Math.floor(rnd()*3)]; ell(q, Math.cos(a)*d*4.6, Math.sin(a)*d*2.8 - 0.3, 1, 1); q.fill(); }
    } else if (T.name === 'anemone'){
      for (let k=0;k<5;k++){ q.save(); q.rotate(k/5*TAU + 0.3); q.fillStyle = '#d9cfc0'; ell(q, 0, -3.2, 2.6, 3.2); q.fill(); q.fillStyle = '#f6f0e4'; ell(q, -0.2, -3.4, 2.2, 2.8); q.fill(); q.restore(); }
      q.fillStyle = '#e8c860'; ell(q, 0, 0, 2.1, 2.1); q.fill(); q.fillStyle = '#3a3426'; ell(q, 0, 0, 1.4, 1.4); q.fill();
    } else {
      const C = T.cols;
      for (let ring=0; ring<3; ring++){ const rr0 = 4.6 - ring*1.5, n = 12 - ring*3; for (let k=0;k<n;k++){ q.save(); q.rotate(k/n*TAU + ring*0.4); q.fillStyle = C[ring]; ell(q, 0, -rr0*0.7, 1.2, rr0*0.55); q.fill(); q.restore(); } }
      q.fillStyle = C[3]; ell(q, -0.3, -0.4, 1.4, 1.4); q.fill();
    }
    return { stem: sc, sw, sh, sox, soy, head: hc, hw };
  });
}
function drawFlowers(V){
  const c = ctx, active = S.hive.built, sown = gl('seeding');
  for (const f of FLOWERS){
    if ((f.tier || 0) > sown) continue;   // not sown yet (Wildflower seeding)
    if (f.x < V.x0 || f.x > V.x1 || f.y < V.y0 - 20 || f.y > V.y1 + 20) continue;
    const sp = flowerSpr[f.ty]; if (!sp) continue;
    const wild = f.land > S.land, b = wild || !active ? 1 : bloomOf(f);
    if (ART.drawFlower){ ART.drawFlower(c, f, sp, b, wild); continue; }
    const sway = reduceMotion ? 0 : Math.sin(S.t*1.3 + f.ph)*0.05 + wind*0.0015 + (f.bob > 0 ? Math.sin(f.bob*30)*0.06 : 0);
    c.save(); c.translate(f.x, f.y); c.rotate(sway); c.scale(f.s, f.s);
    if (wild) c.globalAlpha = 0.72;
    c.drawImage(sp.stem, -sp.sox, -sp.soy, sp.sw, sp.sh);
    if (b > 0.02){
      const T = FLOWER_TYPES[f.ty], k = 0.35 + 0.65*b, hs = sp.hw*k;
      c.globalAlpha *= Math.min(1, b*1.6);
      c.drawImage(sp.head, -hs/2, -T.h - hs/2, hs, hs);
    }
    c.restore();
  }
}

// ── the hive
const HIVE_COST = 120;
const MAX_BEES = 60;
// Six one-off hive upgrades, all at one fixed price, so the order is up to you and buying one never makes the others
// dearer. V7: $180 each (was $80), so it takes a while before you start on them.
const HIVE_UP = {
  wings:   { name:'Quicker wings',  bee:true, desc:'Bees fly <b>25%</b> faster.' },
  third:   { name:'Longer rounds',  bee:true, desc:'Each bee visits <b>3 flowers</b> a trip instead of 2.' },
  tongue:  { name:'Long tongues',   bee:true, desc:'Bees take <b>5 nectar</b> from each flower instead of 4.' },
  fan:     { name:'Faster fanning',           desc:'The hive turns nectar into honey <b>50%</b> faster. Worth it when the nectar tank keeps filling up.' },
  recipe:  { name:'Better recipe',            desc:'A jar of honey takes <b>20 nectar</b> instead of 25.' },
  nursery: { name:'Bee nursery',              desc:'New bees cost <b>30%</b> less.' },
};
const HIVE_UP_COST = 180;
const hiveUpCost = () => HIVE_UP_COST;
// V13: the hive isn't something you can just buy any more: the robots have to know about bees first (the dead bee on the
// prairie, or a bee brought home from there). After a bee has come home, the first yard's hive costs less.
const hiveKnown = () => S.hive.built || !!S.flags.hiveKnown || !!LOT.hiveKnown;   // (V14: the Rainy hollow's ant hill is known from the start)
const hiveShown = () => S.hive.built || (hiveKnown() && !!S.flags.hiveShown);
const hiveCost = () => S.flags.hiveDeal ? HIVE_DEAL : HIVE_COST;
const beeCost = (n = S.hive.bees) => niceCost(4*Math.pow(1.18, n)*(S.hive.up.nursery ? 0.7 : 1));
const tankCap = () => val('hiveTank');
const honeyCap = () => val('hiveStore');
const honeyPrice = () => val('honeyPrice')*sellMul();
const giftJarPrice = () => val('honeyPrice')*val('giftPrice')*sellMul();
const jarNectar = () => S.hive.up.recipe ? 20 : 25;
const fanRate = () => hiveFloors()*FLOOR_RATE*(S.hive.up.fan ? 1.5 : 1);
// every second tank or store upgrade adds a floor (V7: there are more, smaller steps now, and the tower can't grow forever)
const hiveFloors = () => 4 + Math.ceil((S.lv.hiveTank + S.lv.hiveStore)/2);
const HV = LOT.HV || { plinth: 14, fh: 12, r: 21, k: 0.32 };
const hiveTopZ = () => HV.plinth + hiveFloors()*HV.fh;
const DOOR = { x: HIVE.x, y: HIVE.y + 0.866*HV.r*HV.k, z: HV.plinth + HV.fh*0.5 };
// per-bee stats come from the upgrades the bee picked up last time it was home
const beeSpeed = b => BEE_SPEED*(b.up.wings ? 1.25 : 1);
const beeTrip = b => b.up.third ? 3 : 2;
const beeSip = b => b.up.tongue ? 5 : 4;

function newBee(i){
  const H = S.hive.up;
  return { i, x: DOOR.x, y: DOOR.y, z: DOOR.z, st:'in', timer: 0.2 + rand(0, 2.5), carry: 0, visits: 0, tgt: null, face: 1, anim: rand(0, 10), ph: rand(0, TAU),
    lx: 0, ly: 0, lz: 0, tx: 0, ty: 0, tz: 0, len: 1, up: { wings: H.wings, third: H.third, tongue: H.tongue } };
}
function syncBees(){ while (B.length < S.hive.bees) B.push(newBee(B.length)); }
function refreshBee(b){
  const H = S.hive.up; let ch = false;
  for (const k of ['wings', 'third', 'tongue']) if (b.up[k] !== H[k]){ b.up[k] = H[k]; ch = true; }
  if (ch && !simMode) parts.push({ k:'star', x: DOOR.x + rand(-4, 4), y: DOOR.y - DOOR.z - 4, vx: rand(-30, 30), vy: rand(-50, -20), g: 60, life: 0.6, t: 0 });
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
    const s = Math.hypot(f.x - b.x, f.y - b.y) + 0.35*Math.hypot(f.x - HIVE.x, f.y - HIVE.y);
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
  beeLeg(b, HIVE.x + rand(-30, 46), HIVE.y + rand(2, 18), rand(18, hiveTopZ()*0.85));
}
function beeQueue(b){ b.st = 'queue'; b.timer = 0.6; b.tgt = null; beeLeg(b, DOOR.x + rand(-14, 22), DOOR.y + rand(3, 10), DOOR.z + rand(4, 16)); }
// where a bee goes once it's out and about: a free flower, else one about to bloom, else home
function beeNext(b){
  if (b.carry > 0 && b.visits >= beeTrip(b)){ beeHome(b); return; }
  const f = findFlower(b);
  if (f){ goFlower(b, f); return; }
  const w = nextBloom(b);
  if (w){ goWait(b, w); return; }
  if (b.carry > 0) beeHome(b); else loiter(b);
}
function beeHome(b){ b.st = 'home'; b.tgt = null; beeLeg(b, DOOR.x, DOOR.y, DOOR.z); }
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
      b.x = DOOR.x; b.y = DOOR.y; b.z = DOOR.z;
      beeSetOff(b);
      break;
    }
    case 'loiter': {
      // nothing free and nothing about to bloom: buzz about the hive, and look again twice a second
      if (beeMove(b, sp*0.45, dt)){ b.z += Math.sin(b.anim*5 + b.ph)*0.15; if (Math.random() < dt*0.8) beeLeg(b, HIVE.x + rand(-30, 46), HIVE.y + rand(2, 18), rand(18, hiveTopZ()*0.85)); }
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
      if (f){ f.full = false; f.t = 0; f.claim = null; f.bob = 0.4; b.mty = f.ty; }   // (mty: what it carries, for the hollow's ants)
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
        if (b.carry > 0 ? unload(b) : !tankFull()){ b.st = 'in'; b.timer = 0.3; b.x = DOOR.x; b.y = DOOR.y; b.z = DOOR.z; }
        else beeLeg(b, DOOR.x + rand(-14, 22), DOOR.y + rand(3, 10), DOOR.z + rand(4, 16));
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
function drawJar(c, x, y, s){
  if (ART.drawJar) return ART.drawJar(c, x, y, s);
  c.save(); c.translate(x, y); c.scale(s/6, s/6);
  c.fillStyle = '#c47d1c'; rr(c, -4, -3.5, 8, 8.5, 2.4); c.fill();
  c.fillStyle = '#eba53a'; rr(c, -3.4, -3, 6.8, 7.4, 2); c.fill();
  c.fillStyle = 'rgba(255,240,190,.55)'; rr(c, -2.6, -2.2, 1.4, 5, 0.7); c.fill();
  c.fillStyle = '#f2e3c4'; c.fillRect(-3.4, -0.4, 6.8, 2.6);
  c.fillStyle = '#7c5a3c'; rr(c, -3.6, -5.6, 7.2, 2.6, 1); c.fill();
  c.restore();
}
function drawHive(){
  if (ART.drawHive) return ART.drawHive();
  if (!hiveShown()) return;
  const c = ctx, H = S.hive, r = HV.r, k = HV.k, d = 0.866*r*k;
  c.save(); c.translate(HIVE.x, HIVE.y);
  // concrete pad with a painted hexagon
  c.fillStyle = 'rgba(35,25,10,.28)'; ell(c, 8, 4, 40, 10); c.fill();
  hexPath(c, 0, 2, 34, 0.32); c.fillStyle = '#b9ad96'; c.fill(); c.strokeStyle = '#978b75'; c.lineWidth = 1.5; c.stroke();
  if (!H.built){
    const kk = clamp((S.t - hiveRt.shownT)/0.5, 0, 1), sc = kk < 1 ? 0.4 + 0.6*(1 - Math.pow(1 - kk, 3)) + Math.sin(kk*Math.PI)*0.12 : 1;
    hexPath(c, 0, 2, 22, 0.32); c.strokeStyle = '#d9a43a'; c.lineWidth = 2; c.setLineDash([4, 3]); c.stroke(); c.setLineDash([]);
    c.save(); c.translate(-14, 4); c.scale(sc, sc);
    c.fillStyle = '#6e4a30'; rr(c, -2, -34, 4, 35, 1.5); c.fill();
    c.rotate(Math.sin(S.t*1.2)*0.015);
    c.fillStyle = '#5a3b26'; rr(c, -25, -50, 50, 20, 4); c.fill();
    c.fillStyle = '#f3e7cf'; rr(c, -23.5, -48.5, 47, 17, 3); c.fill();
    hexCell(c, -15.5, -40, 4.2, 1); c.fillStyle = '#eba53a'; c.fill(); c.strokeStyle = '#a86d1c'; c.lineWidth = 1; c.stroke();
    c.font = '800 8px "Baloo 2", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#4a3226'; c.fillText('beehive', 4, -39.5);
    c.restore();
    c.restore(); return;
  }
  const F = hiveFloors(), fh = HV.fh, pz = HV.plinth, top = -pz - F*fh;
  const grow = clamp((S.t - hiveRt.builtT)/1.3, 0, 1);
  if (grow < 1) c.scale(1, ease(grow));
  // plinth with hazard stripes (the honey count is on the crate beside the hive)
  drawPrism(c, 27, k, 0, -pz, ['#625f57', '#55524b', '#423f3a', '#77746b']);
  for (const i of [0, 1, 2]){
    c.save(); prismFace(c, 27, k, i, -3, -pz + 3); c.clip();
    c.fillStyle = '#2f2a26'; c.fillRect(-28, -pz, 56, pz);
    c.fillStyle = '#e0b13a'; for (let x=-40; x<40; x+=6){ c.beginPath(); c.moveTo(x, 4); c.lineTo(x + 3, 4); c.lineTo(x + 3 + pz, -pz - 4); c.lineTo(x + pz, -pz - 4); c.closePath(); c.fill(); }
    c.restore();
  }
  hexPath(c, 0, -pz, 27, k); c.fillStyle = '#8a877e'; c.fill();
  // the tower
  drawPrism(c, r, k, -pz, top, ['#b5bec2', '#97a1a6', '#6f797e', '#d3d9db']);
  c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(-19, top + 2, 3, F*fh - 2);
  const hf = clamp(H.honey/honeyCap(), 0, 1)*F;
  const v = hexFront(r, k);
  for (let f=0; f<F; f++){
    const yb = -pz - f*fh, ym = yb - fh/2, fill = clamp(hf - f, 0, 1);
    // three windows per floor (the middle one on the ground floor is the door)
    const wins = [[-r*0.75, d*0.5, 0.55], [0, d, 1], [r*0.75, d*0.5, 0.55]];
    wins.forEach(([wx, wy, sx], wi) => {
      if (f === 0 && wi === 1) return;
      const cy = ym + wy, cr = 3.7;
      hexCell(c, wx, cy, cr, sx); c.fillStyle = wi === 2 ? '#1f2925' : '#2a3631'; c.fill();
      if (fill > 0){
        c.save(); hexCell(c, wx, cy, cr, sx); c.clip();
        const hh = cr*2*fill; c.fillStyle = wi === 2 ? '#b8741c' : '#e59a2a'; c.fillRect(wx - cr, cy + cr - hh, cr*2, hh);
        c.fillStyle = 'rgba(255,214,120,.55)'; c.fillRect(wx - cr, cy + cr - hh, cr*2, Math.min(1, hh));
        c.restore();
      } else { c.fillStyle = 'rgba(160,210,200,.18)'; c.fillRect(wx - cr*sx*0.6, cy - cr*0.6, 1.2, cr*0.9); }
      hexCell(c, wx, cy, cr, sx); c.strokeStyle = '#c9a24a'; c.lineWidth = 0.9; c.stroke();
    });
    // brass band at the top of each floor
    const yt = yb - fh;
    c.strokeStyle = 'rgba(40,30,20,.35)'; c.lineWidth = 0.8; c.beginPath(); v.forEach(([x, y], i) => i ? c.lineTo(x, yt + y + 1.6) : c.moveTo(x, yt + y + 1.6)); c.stroke();
    c.strokeStyle = '#c9a24a'; c.lineWidth = 1.4; c.beginPath(); v.forEach(([x, y], i) => i ? c.lineTo(x, yt + y) : c.moveTo(x, yt + y)); c.stroke();
  }
  // door with a landing lip, glowing warm inside
  const dy = -pz - fh*0.5 + d;
  c.fillStyle = '#2a2420'; rr(c, -5, dy - 4.5, 10, 8, 3); c.fill();
  c.fillStyle = 'rgba(255,179,71,' + (0.45 + 0.15*Math.sin(S.t*3)) + ')'; rr(c, -3.6, dy - 2.6, 7.2, 5.6, 2.2); c.fill();
  c.fillStyle = '#c9a24a'; rr(c, -7, dy + 3.2, 14, 2.2, 1); c.fill();
  // nectar tube on the left side
  const tx = -r - 3.4, tb = -pz - 3, tt = top + 6, nf = clamp(H.nectar/tankCap(), 0, 1);
  c.fillStyle = '#4a423b'; for (const yy of [tb - 2, tt + 3, (tb + tt)/2]) c.fillRect(tx, yy, 3.6, 1.6);
  c.fillStyle = 'rgba(220,235,235,.45)'; rr(c, tx - 2, tt, 4, tb - tt, 2); c.fill();
  if (nf > 0){ const nh = (tb - tt - 1)*nf; c.fillStyle = 'rgba(250,214,110,.9)'; rr(c, tx - 1.4, tb - nh, 2.8, nh, 1.3); c.fill(); }
  c.strokeStyle = 'rgba(70,80,84,.8)'; c.lineWidth = 0.8; rr(c, tx - 2, tt, 4, tb - tt, 2); c.stroke();
  // crown, vent and antenna
  drawPrism(c, 13, k, top, top - 7, ['#a3acb0', '#8a9499', '#646e73', '#c8cfd2']);
  c.fillStyle = '#2f3a34'; rr(c, -4, top - 4 + 0.866*13*k, 8, 2.6, 1); c.fill();
  // six antennas fanned out from one hub like a wifi signal; their lights ripple outward from the middle pair
  const hubY = top - 8.5, AL = 15;
  c.fillStyle = '#4a423b'; c.beginPath(); c.ellipse(0, top - 6.5, 4.2, 2.6, 0, Math.PI, 0); c.closePath(); c.fill();
  c.fillStyle = '#6a625a'; ell(c, 0, hubY + 0.6, 2, 1.4); c.fill();
  c.lineCap = 'round';
  const tips = [];
  for (let i=0; i<6; i++){
    const ring = Math.abs(i - 2.5) - 0.5, a = (i - 2.5)*0.36, L = AL - ring*0.6;   // about ±10°, ±31°, ±52° from straight up
    const tx = Math.sin(a)*L, ty = hubY - Math.cos(a)*L;
    c.strokeStyle = '#4a423b'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(Math.sin(a)*1.5, hubY); c.lineTo(tx, ty); c.stroke();
    tips.push([tx, ty, ring]);
  }
  for (const [tx, ty, ring] of tips){
    const on = Math.sin(S.t*2.6 - ring*1.1) > 0.35;
    c.fillStyle = on ? '#ffb347' : '#8a5a36'; ell(c, tx, ty, 2, 2); c.fill();
    if (on){ c.fillStyle = 'rgba(255,179,71,.3)'; ell(c, tx, ty, 4.2, 4.2); c.fill(); }
  }
  c.restore();
  if (grow >= 1){
    if (H.honey >= honeyCap() - 1e-6) bubbles.push({ x: HIVE.x, y: HIVE.y + top - 34, t: 'honey full' });
    else if (tankFull() && B.some(b => b.st === 'queue')) bubbles.push({ x: HIVE.x, y: HIVE.y + top - 34, t: 'nectar full' });
  }
}
// ── the honey crate: a wooden farm crate beside the hive where the finished jars wait for the truck.
// The jars stack up in a little pyramid as the store fills (10 jars drawn at most, so it's a picture, not a count),
// and a chalkboard on the front gives the real number.
const CRATE_ROWS = [[-15, -5, 5, 15], [-10, 0, 10], [-5, 5], [0]];
function drawHoneyCrate(){
  if (!S.hive.built) return;
  const grow = clamp((S.t - hiveRt.builtT - 0.5)/0.6, 0, 1); if (grow <= 0) return;
  const c = ctx, cap = crateCap(), n = S.hive.jars | 0, full = crateJars() >= cap;
  const w = 44, h = 21, top = -h;
  const sq = hiveRt.bump > 0 ? 1 + Math.sin(hiveRt.bump/0.25*Math.PI)*0.04 : 1;
  c.save(); c.translate(CRATE.x, CRATE.y); c.scale(sq*ease(grow), ease(grow)/sq);
  c.fillStyle = 'rgba(35,25,10,.3)'; ell(c, 2, 2, 27, 5.5); c.fill();
  // the back board and the dark inside, seen just over the front
  c.fillStyle = '#8e5d33'; rr(c, -w/2 + 1, top - 6, w - 2, 7, 1.5); c.fill();
  c.fillStyle = '#4a2e1a'; c.fillRect(-w/2 + 3, top - 3, w - 6, 4);
  // the jars (with a packing bench, the gift jars stand among them)
  const g = S.hive.gift | 0, gc = cap;
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
  const label = crateJars() + '/' + cap; let fs = 12;
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
// Three bee models, handed out in turn as you buy bees (1st brass, 2nd boxy, 3rd drone, 4th brass again...).
// They all fly the same; only the build differs. The amber light on each one glows brighter the more nectar it carries.
const BEE_MODELS = ['brass', 'boxy', 'drone'];
function beeWingMetal(c, x, y, rot, len, w){
  c.save(); c.translate(x, y); c.rotate(rot);
  c.fillStyle = 'rgba(214,232,240,.5)'; ell(c, -len*0.55, 0, len*0.6, w); c.fill();
  c.strokeStyle = 'rgba(120,134,140,.9)'; c.lineWidth = 0.32; ell(c, -len*0.55, 0, len*0.6, w); c.stroke();
  c.beginPath(); c.moveTo(0, 0); c.lineTo(-len*1.05, -w*0.15); c.moveTo(-len*0.35, 0); c.lineTo(-len*0.8, w*0.6); c.stroke();
  c.restore();
}
// 1. brass: the classic bee shape, but polished brass and steel, with ribbed metal wings, rivets and a steel stinger
function drawBeeBrass(c, b, fl, glow){
  beeWingMetal(c, -0.2, -2.3, -0.6, 3.8, 1.8*(0.3 + 0.7*fl));
  c.fillStyle = '#5c6469'; c.beginPath(); c.moveTo(-4.7, 0); c.lineTo(-6.4, 0.7); c.lineTo(-4.6, 1.2); c.closePath(); c.fill();
  c.fillStyle = '#9a6f1e'; ell(c, -1.8, 0.3, 3.3, 2.35); c.fill();
  c.fillStyle = '#d7a43a'; ell(c, -1.9, 0, 3.1, 2.05); c.fill();
  c.fillStyle = 'rgba(255,236,170,.75)'; ell(c, -2.3, -1, 2, 0.6); c.fill();
  c.save(); ell(c, -1.8, 0.3, 3.3, 2.35); c.clip(); c.fillStyle = '#2e2b2a'; c.fillRect(-3.5, -3, 0.85, 6); c.fillRect(-1.5, -3, 0.85, 6);
  c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(-3.5, -2.2, 0.85, 0.5); c.fillRect(-1.5, -2.2, 0.85, 0.5); c.restore();
  c.fillStyle = '#7a5a1e'; ell(c, -4.1, 0.2, 0.3, 0.3); c.fill(); ell(c, -0.3, 1.6, 0.3, 0.3); c.fill();
  if (glow > 0){ c.fillStyle = 'rgba(255,207,90,' + (0.35 + 0.65*glow) + ')'; ell(c, -2.5, 1, 0.8, 0.8); c.fill(); }
  beeWingMetal(c, 0.2, -2.5, -0.22, 3.4, 1.6*(0.3 + 0.7*(1 - fl)));
  c.fillStyle = '#5c666b'; ell(c, 1.7, -0.1, 1.9, 1.9); c.fill();
  c.fillStyle = '#aab3b7'; ell(c, 1.4, -0.6, 1.45, 1.3); c.fill();
  c.fillStyle = 'rgba(255,255,255,.75)'; ell(c, 0.9, -1.3, 0.6, 0.35); c.fill();
  c.fillStyle = '#26201d'; rr(c, 2, -0.9, 1.9, 1.2, 0.5); c.fill();
  c.fillStyle = '#ffc457'; ell(c, 3.1, -0.3, 0.5, 0.5); c.fill();
  c.strokeStyle = '#4a423b'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(2.1, -2); c.lineTo(2.7, -3); c.lineTo(3.6, -3.6); c.stroke();
  c.fillStyle = '#c9a24a'; ell(c, 3.6, -3.6, 0.45, 0.45); c.fill();
}
// 2. boxy: built from little boxes — a striped crate for a body, a square head with one square eye, flat panel wings
function drawBeeBoxy(c, b, fl, glow){
  const flap = 0.3 + 0.7*fl;
  c.fillStyle = 'rgba(214,232,240,.5)'; c.strokeStyle = '#7d878c'; c.lineWidth = 0.35;
  c.save(); c.translate(-0.6, -2); c.rotate(-0.35); c.scale(1, flap); rr(c, -3.6, -1.6, 3.6, 1.8, 0.4); c.fill(); c.stroke(); c.restore();
  c.strokeStyle = '#3b3430'; c.lineWidth = 0.45; c.beginPath(); for (const lx of [-2.6, -0.8, 0.8]){ c.moveTo(lx, 1.6); c.lineTo(lx - 0.5, 2.9); } c.stroke();
  c.fillStyle = '#a8801e'; rr(c, -5.4, -1.8, 5.2, 4, 1); c.fill();
  c.fillStyle = '#e0b13a'; rr(c, -5.4, -2.1, 5.2, 3.7, 1); c.fill();
  c.fillStyle = '#2f2a26'; c.fillRect(-4.1, -2.1, 0.9, 3.7); c.fillRect(-2.2, -2.1, 0.9, 3.7);
  c.fillStyle = 'rgba(255,240,190,.55)'; c.fillRect(-5, -1.8, 4.4, 0.5);
  c.fillStyle = glow > 0 ? 'rgba(255,207,90,' + (0.4 + 0.6*glow) + ')' : '#5a4a2a'; c.fillRect(-5.8, -0.6, 0.6, 1.4);
  c.fillStyle = '#5c666b'; rr(c, -0.5, -1.7, 2.3, 3.2, 0.5); c.fill();
  c.fillStyle = '#9aa3a8'; rr(c, 1.5, -2.4, 3, 3.2, 0.7); c.fill();
  c.fillStyle = '#c3cbce'; c.fillRect(1.8, -2.1, 2.3, 0.6);
  c.fillStyle = '#26201d'; c.fillRect(3, -1.2, 1.2, 1.2);
  c.fillStyle = '#ffc457'; c.fillRect(3.25, -0.95, 0.7, 0.7);
  c.fillStyle = 'rgba(214,232,240,.6)'; c.strokeStyle = '#7d878c'; c.lineWidth = 0.35;
  c.save(); c.translate(0.2, -2.1); c.rotate(-0.1); c.scale(1, 1.3 - flap*0.6); rr(c, -3.2, -1.7, 3.4, 1.7, 0.4); c.fill(); c.stroke(); c.restore();
  c.strokeStyle = '#4a423b'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(2.4, -2.4); c.lineTo(2.4, -3.6); c.lineTo(3.6, -3.6); c.stroke();
  c.fillStyle = '#ff7a4d'; c.fillRect(3.4, -3.9, 0.6, 0.6);
}
// 3. drone: a tiny quadcopter pod with bee stripes, two spinning rotors, little skids and feelers
function drawBeeDrone(c, b, fl, glow){
  const flying = b.st !== 'sip';
  c.rotate(flying ? 0.12 : 0);
  const spin = b.anim*55;
  c.strokeStyle = '#3b3430'; c.lineWidth = 0.4;
  c.beginPath(); c.moveTo(-1.6, 1.6); c.lineTo(-2.2, 2.8); c.moveTo(1.4, 1.6); c.lineTo(2, 2.8); c.moveTo(-2.9, 2.8); c.lineTo(2.7, 2.8); c.stroke();
  c.strokeStyle = '#5c666b'; c.lineWidth = 0.7;
  c.beginPath(); c.moveTo(-1.2, -1); c.lineTo(-3.8, -2.2); c.moveTo(1.2, -1); c.lineTo(3.8, -2.2); c.stroke();
  for (const rx of [-3.8, 3.8]){
    c.fillStyle = '#3b3430'; rr(c, rx - 0.5, -2.8, 1, 0.9, 0.3); c.fill();
    c.fillStyle = 'rgba(220,236,242,.45)'; ell(c, rx, -3, 2.5, 0.5); c.fill();
    const k = Math.cos(spin + rx); c.strokeStyle = 'rgba(70,80,84,.8)'; c.lineWidth = 0.35;
    c.beginPath(); c.moveTo(rx - 2.4*k, -3); c.lineTo(rx + 2.4*k, -3); c.stroke();
  }
  c.fillStyle = '#a8801e'; ell(c, 0, 0.2, 2.8, 2.1); c.fill();
  c.fillStyle = '#e0b13a'; ell(c, -0.1, 0, 2.6, 1.9); c.fill();
  c.save(); ell(c, 0, 0.2, 2.8, 2.1); c.clip(); c.fillStyle = '#2f2a26'; c.fillRect(-1.9, -3, 0.8, 6); c.fillRect(-0.3, -3, 0.8, 6); c.restore();
  c.fillStyle = 'rgba(190,225,235,.55)'; ell(c, 0.6, -1.3, 1.6, 0.9); c.fill();
  c.fillStyle = 'rgba(255,255,255,.7)'; ell(c, 0.2, -1.6, 0.6, 0.3); c.fill();
  c.fillStyle = '#26201d'; ell(c, 2.4, 0, 0.8, 0.8); c.fill();
  c.fillStyle = '#ffc457'; ell(c, 2.55, 0, 0.45, 0.45); c.fill();
  c.strokeStyle = '#4a423b'; c.lineWidth = 0.35; c.beginPath(); c.moveTo(1.8, -1.6); c.quadraticCurveTo(2.6, -2.9, 3.4, -2.4); c.stroke();
  if (glow > 0){ c.fillStyle = 'rgba(255,207,90,' + (0.4 + 0.6*glow) + ')'; ell(c, 0, 2.1, 0.8, 0.5); c.fill(); }
}
function drawBees(V){
  if (ART.drawBees) return ART.drawBees(V);
  const c = ctx;
  if (guest.on){
    // V13: the bee that comes along with your robot (a brass one, like the hive's first bee)
    const g = guest, y = g.y - g.z;
    if (g.mode !== 'ride' && g.mode !== 'toTruck'){ c.fillStyle = 'rgba(30,22,8,.18)'; ell(c, g.x, g.y + 1, 2.6, 1.1); c.fill(); }
    c.save(); c.translate(g.x, y); c.scale(g.face*1.3, 1.3); drawBeeBrass(c, g, Math.abs(Math.sin(g.anim*60)), 0); c.restore();
  }
  for (const b of B){
    if (b.st === 'in') continue;
    const wob = (b.st === 'fly' || b.st === 'home' || b.st === 'toWait') ? Math.sin(b.anim*7 + b.ph)*2.2 : Math.sin(b.anim*3 + b.ph)*1.2;
    const x = b.x, y = b.y - b.z + wob*0.4, gx = x + wob*0.3;
    if (gx < V.x0 || gx > V.x1 || y < V.y0 || y > V.y1 + 40) continue;
    if (b.z > 1.5){ c.fillStyle = 'rgba(30,22,8,' + (0.2*clamp(1 - b.z/90, 0.3, 1)) + ')'; ell(c, x, b.y + 1, 2.6, 1.1); c.fill(); }
    c.save(); c.translate(gx, y); c.scale(b.face*1.2, 1.2);
    const fl = Math.abs(Math.sin(b.anim*(b.st === 'sip' ? 30 : 60))), glow = b.carry/(beeTrip(b)*beeSip(b));
    const m = BEE_MODELS[b.i % BEE_MODELS.length];
    if (m === 'brass') drawBeeBrass(c, b, fl, glow); else if (m === 'boxy') drawBeeBoxy(c, b, fl, glow); else drawBeeDrone(c, b, fl, glow);
    if (b.carry > 0){
      // little drops of nectar hanging under a bee that has been sipping: one per flower it has visited this trip
      const nd = clamp(Math.ceil(glow*beeTrip(b) - 1e-6), 1, 3), wig = Math.sin(b.anim*6 + b.ph)*0.25;
      for (let k=0;k<nd;k++){
        const dx = [-1.4, 1.2, -4][k], dy = 3 + (k === 1 ? 0.5 : 0);
        c.fillStyle = '#e88a12'; c.beginPath(); c.moveTo(dx + wig, dy - 1.3); c.quadraticCurveTo(dx + 1.35 + wig, dy + 0.7, dx + wig, dy + 1.8); c.quadraticCurveTo(dx - 1.35 + wig, dy + 0.7, dx + wig, dy - 1.3); c.fill();
        c.fillStyle = 'rgba(255,244,190,.9)'; ell(c, dx - 0.35 + wig, dy + 0.3, 0.4, 0.4); c.fill();
      }
    }
    c.restore();
  }
}

// ───────────────────────── main step
function step(dt){
  S.t += dt;
  updLeaves(dt);
  syncRobots(); syncHelpers();
  for (const r of R) updRobot(r, dt);
  updShakeTimers(dt);
  for (const h of HB) updHelper(h, dt);
  updFlowers(dt); syncBees();
  for (const b of B) updBee(b, dt);
  updHive(dt);
  updResearch(dt);
  updTruck(dt);
  updDriver(dt); updGuest(dt); updBoarding();
  updParts(dt);
  updMilestones();
  if (bumpBin > 0) bumpBin -= dt;
  if (S.cash > (S.peak || 0)) S.peak = S.cash;
  if (!S.flags.general && S.cash >= GEN_UNLOCK){
    S.flags.general = true;
    pop(SHED.x, SHED.y - 130, 'Yard-wide upgrades in the workshop', 'note', 18, 0.2); sparkle(SHED.x, SHED.y - 60);
  }
  // the beehive plot shows up once you've held a quarter of its price
  if (!S.flags.hiveShown && hiveKnown() && seenPrice(hiveCost())){
    S.flags.hiveShown = true; hiveRt.shownT = S.t;
    sparkle(HIVE.x, HIVE.y - 30); pop(HIVE.x + 20, HIVE.y - 70, 'New: a robot beehive', 'note', 18, 0.3); sfx('chime', 'sale');
  }
  // V6: the bagging table's spot shows up once sorting is maxed, the smelting plant's once the metal is fully graded
  if (!S.flags.bagShown && upMaxed('leafPrice')){
    S.flags.bagShown = true; plantRt.bagShownT = S.t;
    sparkle(BAGGER.x, BAGGER.y - 30); pop(BAGGER.x, BAGGER.y - 70, 'New: a bagging table', 'note', 18, 0.3); sfx('chime', 'sale');
  }
  if (!S.flags.plantShown && S.metalSlot && plantGrade() && seenPrice(PLANT_COST)){
    S.flags.plantShown = true; plantRt.shownT = S.t;
    sparkle(PLANT.x, PLANT.y - 30); pop(PLANT.x, PLANT.y - 90, 'New: a smelting plant', 'note', 18, 0.3); sfx('chime', 'sale');
  }
  if (plantRt.bump > 0) plantRt.bump = Math.max(0, plantRt.bump - dt);
  // the For Sale sign goes up once you have half the price
  const nxt = S.land + 1;
  if (landForSale() && S.flags.saleShown < nxt && S.cash >= AREAS[nxt].cost*0.5){
    S.flags.saleShown = nxt; saleAppearT = S.t;
    const p = salePos(); sparkle(p.x, p.y - 30); pop(p.x, p.y - 84, MINE_LAND && nxt === MINE_LAND ? 'Land for sale: finally a chance to mine!' : 'Land for sale next door', 'note', 18, 0.3); sfx('chime', 'sale');
  }
  if (!S.flags.finished && S.robots.length >= ROBOT_MAX && S.miners.length >= SPOTS.length && (S.plant.built || !plantOpen())){
    S.flags.finished = true;
    if (!simMode) showToast('The yard hums along nicely.', 'Ten robots, every vein worked' + (S.plant.built ? ' and the furnaces roaring.' : ' and the truck full every time.'), 9);
  }
}
const saleVisible = () => landForSale() && S.flags.saleShown >= S.land + 1;
const baggerShown = () => S.bag.built || S.flags.bagShown;
const plantShown = () => S.plant.built || (!!S.flags.plantShown && plantOpen());
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
    if (cfg.away) return;
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
  for (const kind of ['blower', 'shaker']) if (all ? helpersKnown() && cfgsOf(kind).length < HELPER_MAX : helperShown(kind)) o.push({ id:kind, obj:'shed', cost: helperCost(kind) });
  for (const id in TECH) if (techAvailable(id)){ const tk = TECH[id].track, kind = tk === 'blow' || tk === 'dig' || tk === 'stoke' ? 'blower' : tk === 'shake' ? 'shaker' : 'robot'; o.push({ id:'tech', key:id, obj: kind + '0', cost: TECH[id].cost }); }
  if (genVisible()) for (const k in GEN) if (genAvail(k)) o.push({ id:'gen', key:k, obj:'shed', cost: genCost(k) });
  if (S.robots.length < ROBOT_MAX) o.push({ id:'robot', obj:'shed', cost: robotCost(S.robots.length) });
  if (S.metalSlot) SPOTS.forEach((p, i) => { if (p.land <= S.land && !S.miners.includes(i)) o.push({ id:'miner', arg:i, obj:'spot'+i, cost: MINER_COST }); });
  // V6 refinement
  if (!S.bag.built){ if (all ? upMaxed('leafPrice') : baggerShown()) o.push({ id:'bagger', obj:'bagger', cost: BAGGER_COST }); }
  else o.push(up('bagPrice'));
  if (S.hive.built && S.hive.bees > 0){ if (!S.hive.packing){ if (packShown()) o.push({ id:'honeyPack', obj:'hive', cost: HONEY_PACK_COST }); } else o.push(up('giftPrice')); }
  if (!S.plant.built){ if (all ? S.metalSlot && plantGrade() : plantShown()) o.push({ id:'plant', obj:'plant', cost: PLANT_COST }); }
  else o.push(up('smeltSpeed'), up('ingotGrade'), up('slag'), up('hopper'));
  if (all ? S.miners.length : shaftShown()) for (const sp of S.miners) if (!S.shafts.includes(sp)) o.push({ id:'shaft', arg:sp, obj:'spot'+sp, cost: shaftCost() });
  if (landForSale() && (all || saleVisible())) o.push({ id:'land', obj:'sale', cost: AREAS[S.land + 1].cost });
  if (!S.hive.built){ if (all ? hiveKnown() : hiveShown()) o.push({ id:'hive', obj:'hive', cost: hiveCost() }); }
  else {
    if (S.hive.bees < MAX_BEES) o.push({ id:'bee', obj:'hive', cost: beeCost() });
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
  if (obj === 'book'){ const b = bookPos(); return { x: b.x, y: b.y - 26 }; }
  if (obj.startsWith('letter')){ const l = S.letters[+obj.slice(6)]; return l ? { x: l.x, y: l.y - 24 } : null; }
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
    const i = cfgsOf(o.id).length, cfg = newHelperCfg(o.id), sty = nextHelperStyle(o.id);
    if (sty !== i) cfg.sty = sty;
    cfgsOf(o.id).push(cfg); syncHelpers();
    const st = helperStyleOf(o.id, i);
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
    if (o.key === 'seeding'){ let k = 0; for (const f of FLOWERS) if (f.tier === gl('seeding') && f.land <= S.land && k++ % 3 === 0) sparkle(f.x, f.y - 8); }
  } else if (o.id === 'hive'){
    S.hive.built = true; S.flags.hiveShown = true; hiveRt.builtT = S.t; openTasks(['jar']);
    // V13: the bee that came home with your robot moves in
    if (S.flags.guestBee){ S.flags.guestBee = false; S.flags.hiveDeal = false; S.hive.bees = Math.max(1, S.hive.bees + 1); syncBees(); if (B[0]) B[0].timer = 3; }
    pop(HIVE.x, HIVE.y - 120, 'Robot beehive built!', 'note', 19, 0.6); sparkle(HIVE.x, HIVE.y - 60);
    autoAssign('jar', CRATE, 'will fill the honey jars');
    if (!simMode) for (let i=0;i<12;i++) parts.push({ k:'dust', x: HIVE.x + rand(-30,30), y: HIVE.y + rand(-2, 6), vx: rand(-24,24), vy: rand(-22,-5), g:0, life: rand(.8,1.4), t:0, r: rand(5,9), gray:true });
  } else if (o.id === 'bee'){
    S.hive.bees++; syncBees();
    const b = B[B.length - 1]; if (b) b.timer = 0.15;
    pop(HIVE.x + 16, HIVE.y - hiveTopZ() - 20, S.hive.bees === 1 ? 'Your first bee!' : 'Bee ' + S.hive.bees + ' joins the hive', 'note', 16);
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
    autoAssign('wrap', CRATE, 'will wrap gift jars');
  } else if (o.id === 'plant'){
    S.plant.built = true; S.flags.plantShown = true; plantRt.builtT = S.t; openTasks(['smelt', 'haul']);
    pop(PLANT.x, PLANT.y - 150, 'Smelting plant built!', 'note', 20, 0.8); sparkle(PLANT.x, PLANT.y - 60);
    if (!simMode) for (let i=0;i<16;i++) parts.push({ k:'dust', x: PLANT.x + rand(-70,70), y: PLANT.y + rand(-2, 6), vx: rand(-24,24), vy: rand(-22,-5), g:0, life: rand(.8,1.4), t:0, r: rand(5,9), gray:true });
    autoAssign('smelt', PLANT, 'will smelt and haul');
  } else if (o.id === 'shaft'){
    S.shafts.push(o.arg); fixSlots();
    const p = SPOTS[o.arg];
    pop(p.x, p.y - 130, 'Mine shaft dug!', 'note', 19, 0.3); sparkle(p.x, p.y - 40);
    if (!simMode) for (let i=0;i<14;i++) parts.push({ k:'dust', x:p.x+rand(-24,24), y:p.y, vx:rand(-20,20), vy:rand(-25,-5), g:0, life:rand(.8,1.4), t:0, r:rand(5,9) });
    if (S.shafts.length === 1 && S.blowers.length) pop(p.x, p.y - 108, 'Blowers can learn to excavate here', 'note', 15, 1.2);
  } else if (o.id === 'metalSlot'){
    S.metalSlot = true; openTasks(['mine']);
    pop(TUB.x, TUB.y - 72, 'Metal slot added', 'note', 17); sparkle(TUB.x, TUB.y - 30);
  } else if (o.id === 'robot'){
    const i = S.robots.length, cfg = newRobotCfg(), k = nextStyle();
    if (k !== i) cfg.sty = k;
    S.robots.push(cfg); syncRobots();
    pop(SHED.x, SHED.y - 112, styleOf(i).name + ' joins the yard', 'note', 17); sparkle(SHED.x, SHED.y);
  } else if (o.id === 'miner'){
    S.miners.push(o.arg);
    const p = SPOTS[o.arg];
    const near = (a, b) => Math.hypot(a.x-p.x,a.y-p.y) - Math.hypot(b.x-p.x,b.y-p.y);
    // someone who already wants to mine but has no miner goes first; otherwise the first miner pulls a robot over
    const waiting = R.filter(r => taskTop(S.robots[r.id], 'mine') && S.robots[r.id].miner == null).sort(near);
    // the first miner pulls over the nearest robot that has Mine metal anywhere on its list (never one that has it in Don't)
    const first = S.miners.length === 1 ? R.filter(r => taskOn(S.robots[r.id], 'mine') && S.robots[r.id].miner == null).sort(near)[0] : null;
    const who = waiting[0] || first;
    if (who){ assign(who.id, o.arg); pop(p.x, p.y - 100, styleOf(who.id).name + ' heads over to mine', 'note', 16, 0.3); }
    else pop(p.x, p.y - 100, 'Tap a robot and drag Mine metal into its Do list', 'note', 16, 0.3);
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
      camFollow = null; camAnim = { from: { z: cam.z, ox: cam.ox, oy: cam.oy }, to, t: 0, dur: 2.6 };
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
  pop(at.x, at.y - 110, styleOf(r.id).name + ' ' + says, 'note', 16, 0.9);
  return r.id;
}

// ───────────────────────── static art: ground, canopies, vignette
function buildGround(c){
  const mx = Math.round(W*0.35), my = Math.round(H*0.35);
  const rs = Math.min(DPR, Math.sqrt(9e6/((W + 2*mx)*(H + 2*my))));
  groundCam = { z: c.z, ox: c.ox, oy: c.oy, mx, my, rs };
  groundCv = document.createElement('canvas');
  groundCv.width = Math.ceil((W + 2*mx)*rs); groundCv.height = Math.ceil((H + 2*my)*rs);
  const g = groundCv.getContext('2d');
  g.setTransform(rs*c.z, 0, 0, rs*c.z, rs*(c.ox + mx), rs*(c.oy + my));
  // V14: on a lot with puddles the ground comes in two layers: the flat earth (with the puddles' beds) under the water,
  // and everything standing up out of it (fence, wood piles, bracken...) on top of the water (G.gTop)
  let gTop = g; groundTopCv = null;
  if (RAINY){ groundTopCv = document.createElement('canvas'); groundTopCv.width = groundCv.width; groundTopCv.height = groundCv.height; gTop = groundTopCv.getContext('2d'); gTop.setTransform(rs*c.z, 0, 0, rs*c.z, rs*(c.ox + mx), rs*(c.oy + my)); }
  const V = { x0: -(c.ox + mx)/c.z - 30, x1: (W + mx - c.ox)/c.z + 30, y0: -(c.oy + my)/c.z - 30, y1: (H + my - c.oy)/c.z + 30 };
  const O = owned();
  const CS = 128, i0 = Math.floor(V.x0/CS), i1 = Math.ceil(V.x1/CS), j0 = Math.floor(V.y0/CS), j1 = 1;
  const inOwned = (x, y, m) => x > O.x0 - m && x < O.x1 + m && y > O.y0 - m;
  // V13: each lot paints its own ground (the prairie's is in public/lots/prairie.js)
  (LOT.paintGround || paintGroundHome)({ g, gTop, V, O, CS, i0, i1, j0, j1, inOwned });
}
// the first yard: autumn grass, fallen leaves, toadstools; dark, overgrown land beyond the fence; a gravel verge
function paintGroundHome(G){
  const { g, V, O, CS, i0, i1, j0, j1, inOwned } = G;
  const gr = g.createLinearGradient(0, V.y0, 0, 0);
  gr.addColorStop(0, '#66753a'); gr.addColorStop(0.6, '#74823e'); gr.addColorStop(1, '#7e8a43');
  g.fillStyle = gr; g.fillRect(V.x0, V.y0, V.x1 - V.x0, -V.y0 + 2);
  const patch = ['#86924a','#62713a','#8f8a46','#707f3c','#94914c','#5d6b36'];
  for (let i=i0;i<i1;i++) for (let j=j0;j<j1;j++){
    const rnd = cellRnd(i, j, 1);
    const x = (i + rnd())*CS, y = (j + rnd())*CS, r = 60 + rnd()*120, col = patch[Math.floor(rnd()*patch.length)];
    const rg = g.createRadialGradient(x,y,0,x,y,r); rg.addColorStop(0, col+'88'); rg.addColorStop(1, col+'00'); g.fillStyle = rg; g.fillRect(x-r,y-r,r*2,r*2);
  }
  for (const t of TREES){ const x = t.x + t.r*0.22, y = t.y + t.r*0.5, r = t.r*1.12; const rg = g.createRadialGradient(x,y,r*0.2,x,y,r); rg.addColorStop(0,'rgba(30,35,10,.32)'); rg.addColorStop(1,'rgba(30,35,10,0)'); g.fillStyle = rg; g.fillRect(x-r,y-r,r*2,r*2); }
  g.lineCap = 'round';
  for (let i=i0;i<i1;i++) for (let j=j0;j<j1;j++){
    const rnd = cellRnd(i, j, 2);
    for (let k=0;k<62;k++){
      const x = (i + rnd())*CS, y = (j + rnd())*CS, h = 3 + rnd()*5, lean = (rnd()-0.5)*3, tone = rnd();
      if (y > -VERGE) continue;
      g.strokeStyle = tone < 0.5 ? 'rgba(52,66,24,.45)' : 'rgba(150,160,80,.38)';
      g.lineWidth = 1.1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + lean, y - h); g.stroke();
    }
    for (let k=0;k<3;k++){
      const x = (i + rnd())*CS, y = (j + rnd())*CS, ci = Math.floor(rnd()*LEAFC.length), s = 3 + rnd()*3, rot = rnd()*TAU, sh = rnd() < .5 ? 1 : 0, a = 0.16 + rnd()*0.16;
      if (y > -VERGE - 4) continue;
      g.globalAlpha = a; drawLeaf(g, x, y, s, rot, ci, sh, 1, 0.7, 1, 0.25); g.globalAlpha = 1;
    }
    if (rnd() < 0.35){ const x = (i + rnd())*CS, y = (j + rnd())*CS, r = 20 + rnd()*60; if (y < -VERGE){ const rg = g.createRadialGradient(x,y,0,x,y,r); rg.addColorStop(0,'rgba(255,226,150,.16)'); rg.addColorStop(1,'rgba(255,226,150,0)'); g.fillStyle = rg; g.fillRect(x-r,y-r,r*2,r*2); } }
    if (rnd() < 0.22){
      const x = (i + rnd())*CS, y = (j + rnd())*CS, kind = rnd(), s = 0.9 + rnd()*0.5, red = rnd() < .5;
      if (y < -VERGE - 10){
        if (kind < 0.55){ g.fillStyle = 'rgba(40,30,15,.25)'; ell(g, x+1, y+2, 5, 2.4); g.fill(); g.fillStyle = '#a49c8c'; ell(g, x, y, 4.5, 3); g.fill(); g.fillStyle = '#c4bcab'; ell(g, x-1, y-1, 2.4, 1.4); g.fill(); }
        else { g.fillStyle = '#e8dcc2'; g.fillRect(x - 1.2*s, y - 5*s, 2.4*s, 5*s); g.fillStyle = red ? '#b5452d' : '#c88b4a'; g.beginPath(); g.ellipse(x, y - 5*s, 5*s, 3.4*s, 0, Math.PI, 0); g.fill(); g.fillStyle = '#f4ead5'; ell(g, x - 2*s, y - 6.5*s, .9*s, .9*s); g.fill(); }
      }
    }
  }
  SPOTS.forEach((p, i) => drawRockBed(g, p.x, p.y, 100 + i));
  // wild land beyond the fence: darker, overgrown
  g.save();
  g.beginPath(); g.rect(V.x0, V.y0, V.x1 - V.x0, -VERGE - V.y0); g.rect(O.x0, O.y0, O.x1 - O.x0, O.y1 - O.y0);
  g.fillStyle = 'rgba(40,42,14,.26)'; g.fill('evenodd');
  g.restore();
  for (let i=i0;i<i1;i++) for (let j=j0;j<j1;j++){
    const rnd = cellRnd(i, j, 3);
    for (let k=0;k<5;k++){
      const x = (i + rnd())*CS, y = (j + rnd())*CS, tone = rnd() < .5 ? '#56622c' : '#8a8a46';
      if (y > -VERGE - 6 || inOwned(x, y, 14)) continue;
      g.strokeStyle = tone; g.lineWidth = 1.5;
      for (let m=0;m<6;m++){ const a = -Math.PI/2 + (m - 2.5)*0.22; g.beginPath(); g.moveTo(x + m*1.4, y); g.quadraticCurveTo(x + m*1.4 + Math.cos(a)*6, y - 7, x + m*1.4 + Math.cos(a)*12, y - 14 - (m%2)*3); g.stroke(); }
    }
    if (rnd() < 0.42){
      const x = (i + rnd())*CS, y = (j + rnd())*CS;
      if (!(y > -VERGE - 20 || inOwned(x, y, 30))) drawBush(g, x, y, 0.85 + rnd()*0.5, cellRnd(i, j, 6));
    }
  }
  drawFence(g, O);
  // gravel verge
  const vy = -VERGE;
  g.fillStyle = '#b9a98a'; g.fillRect(V.x0, vy, V.x1 - V.x0, VERGE);
  const vg = g.createLinearGradient(0, vy - 6, 0, vy + 6); vg.addColorStop(0, 'rgba(118,132,63,1)'); vg.addColorStop(1, 'rgba(118,132,63,0)'); g.fillStyle = vg; g.fillRect(V.x0, vy - 6, V.x1 - V.x0, 12);
  for (let i=i0;i<i1;i++){
    const rnd = cellRnd(i, 0, 4);
    for (let k=0;k<120;k++){ const x = (i + rnd())*CS, y = vy + 3 + rnd()*(VERGE - 4), ci = Math.floor(rnd()*4), rx = 1 + rnd()*1.6, ry = 0.8 + rnd()*1.1; g.fillStyle = ['#a2937a','#cdbfa3','#988a72','#d8ccb3'][ci]; ell(g, x, y, rx, ry); g.fill(); }
    for (let k=0;k<14;k++){ const x = (i + rnd())*CS, tone = rnd(), dx = (rnd()-.5)*4, h = 2 + rnd()*5; g.strokeStyle = tone < .5 ? '#5f6e33' : '#7b8a45'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(x, vy + 2); g.lineTo(x + dx, vy + 2 + h); g.stroke(); }
  }
  // road
  g.fillStyle = '#d2c4a8'; g.fillRect(V.x0, 0, V.x1 - V.x0, 6);
  g.fillStyle = '#a99a80'; g.fillRect(V.x0, 6, V.x1 - V.x0, 2);
  const rg2 = g.createLinearGradient(0, 8, 0, ROAD + 40); rg2.addColorStop(0, '#5d5550'); rg2.addColorStop(1, '#4f4742');
  g.fillStyle = rg2; g.fillRect(V.x0, 8, V.x1 - V.x0, V.y1 - 8);
  for (let i=i0;i<i1;i++){
    const rnd = cellRnd(i, 1, 5);
    for (let k=0;k<70;k++){ const x = (i + rnd())*CS, y = 9 + rnd()*(ROAD + 10), light = rnd() < .5; g.fillStyle = light ? 'rgba(255,240,220,.05)' : 'rgba(0,0,0,.08)'; g.fillRect(x, y, 1.6, 1.6); }
    for (let k=0;k<2;k++){ const x = (i + rnd())*CS, y = 14 + rnd()*(ROAD - 18), rot = rnd()*TAU, ci = Math.floor(rnd()*LEAFC.length); g.globalAlpha = .5; drawLeaf(g, x, y, 5, rot, ci, 1, 1, .7, 1, .35); g.globalAlpha = 1; }
  }
  g.fillStyle = 'rgba(232,214,160,.75)';
  for (let x = Math.floor(V.x0/54)*54; x < V.x1; x += 54){ rr(g, x, LANE + 18, 28, 3.2, 1.5); g.fill(); }
}

// A rounded autumn shrub: one colour family, clumps piled into a mound, lit from the top left.
const bushFams = () => [FOLIAGE.olive, FOLIAGE.rust, FOLIAGE.red, ['#3e4a1c','#56632a','#6f7d34','#8e9a45','#b3b862'], FOLIAGE.orange];
// V13: a lot can have its own shrubs and fence (own: one of your bushes, drawn live, rather than a wild one)
function drawBush(g, x, y, s, rnd, own){ if (LOT.drawBush) LOT.drawBush(g, x, y, s, rnd, own); else drawBushHome(g, x, y, s, rnd); }
function drawFence(g, O){ if (LOT.drawFence) LOT.drawFence(g, O); else drawFenceHome(g, O); }
function drawBushHome(g, x, y, s, rnd){
  const F = bushFams(), P = F[Math.floor(rnd()*F.length)], W = 22*s;
  g.fillStyle = 'rgba(25,22,8,.32)'; ell(g, x + 5*s, y + 3*s, W*1.25, 7*s); g.fill();
  const cl = [];
  for (let m=0;m<8;m++){ const bx = (rnd() - 0.5)*2*W*0.8, hump = 1 - Math.abs(bx)/W; cl.push({ x: bx, y: -hump*12*s - rnd()*6*s, r: (6 + hump*6 + rnd()*4)*s }); }
  cl.sort((a, b) => a.y - b.y);
  g.fillStyle = P[0]; for (const k of cl){ ell(g, x + k.x + 1, y + k.y + 2, k.r + 2, k.r*0.86 + 2); g.fill(); }
  for (const k of cl){
    const lit = clamp(Math.round(2 - k.x/W - (k.y/(14*s)) * 0.6 + (rnd() - 0.5)), 1, 3);
    g.fillStyle = P[lit - 1]; ell(g, x + k.x + k.r*0.1, y + k.y + k.r*0.12, k.r, k.r*0.86); g.fill();
    g.fillStyle = P[lit]; ell(g, x + k.x - k.r*0.08, y + k.y - k.r*0.08, k.r*0.86, k.r*0.74); g.fill();
    g.globalAlpha = 0.7; g.fillStyle = P[lit + 1]; ell(g, x + k.x - k.r*0.32, y + k.y - k.r*0.32, k.r*0.38, k.r*0.3); g.fill(); g.globalAlpha = 1;
    for (let q=0;q<2;q++) leafBlob(g, x + k.x + (rnd() - 0.5)*k.r*1.2, y + k.y + (rnd() - 0.5)*k.r, 1.8 + rnd()*1.4, rnd()*TAU, P[clamp(lit + (rnd() < .5 ? 1 : -1), 0, 4)]);
  }
  if (rnd() < 0.3){ g.fillStyle = '#c23a2a'; for (let q=0;q<6;q++){ ell(g, x + (rnd() - 0.5)*W*1.3, y - rnd()*16*s, 1.6*s, 1.6*s); g.fill(); } }
}

function drawFenceHome(g, O){
  const post = (x, y) => {
    g.fillStyle = 'rgba(30,22,10,.28)'; ell(g, x + 2, y + 1, 5, 2); g.fill();
    g.fillStyle = '#6e4a30'; rr(g, x - 2.5, y - 15, 5, 16, 1.5); g.fill();
    g.fillStyle = '#8f6845'; g.fillRect(x - 2.5, y - 15, 5, 2.5);
  };
  g.lineCap = 'round';
  g.strokeStyle = '#8a6040'; g.lineWidth = 2.4;
  g.beginPath(); g.moveTo(O.x0, O.y0 - 11); g.lineTo(O.x1, O.y0 - 11); g.moveTo(O.x0, O.y0 - 5); g.lineTo(O.x1, O.y0 - 5); g.stroke();
  for (const x of [O.x0, O.x1]){ g.beginPath(); g.moveTo(x - 1, O.y0 - 11); g.lineTo(x - 1, O.y1 - 10); g.moveTo(x + 1, O.y0 - 5); g.lineTo(x + 1, O.y1 - 4); g.stroke(); }
  const nTop = Math.max(2, Math.round((O.x1 - O.x0)/40));
  for (let k=0;k<=nTop;k++) post(lerp(O.x0, O.x1, k/nTop), O.y0);
  const nSide = Math.max(2, Math.round((O.y1 - O.y0)/40));
  for (let k=1;k<=nSide;k++){ const y = lerp(O.y0, O.y1, k/nSide); post(O.x0, y); post(O.x1, y); }
}

function drawRockBed(g, x, y, seed){
  const rnd = mulberry(seed);
  g.save(); g.translate(x, y);
  const rg = g.createRadialGradient(0, 0, 4, 0, 0, 44); rg.addColorStop(0, 'rgba(92,78,58,.55)'); rg.addColorStop(1, 'rgba(92,78,58,0)'); g.fillStyle = rg; ell(g, 0, 0, 46, 22); g.fill();
  const rocks = [[-20,-2,13],[3,-9,15],[19,1,11],[-6,7,10],[12,10,8],[-25,10,6]];
  for (const [rx, ry, rs] of rocks){
    g.fillStyle = 'rgba(30,25,15,.3)'; ell(g, rx + 2, ry + rs*0.45, rs*1.05, rs*0.42); g.fill();
    g.beginPath();
    for (let k=0;k<8;k++){ const a = k/8*TAU, d = rs*(0.82 + rnd()*0.3); const px = rx + Math.cos(a)*d, py = ry + Math.sin(a)*d*0.72 - rs*0.18; k ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.closePath();
    const gg = g.createLinearGradient(rx, ry - rs, rx, ry + rs*0.6); gg.addColorStop(0, '#a4a49f'); gg.addColorStop(1, '#666861');
    g.fillStyle = gg; g.fill();
    g.fillStyle = 'rgba(255,255,240,.18)'; ell(g, rx - rs*0.25, ry - rs*0.45, rs*0.45, rs*0.2); g.fill();
    for (let k=0;k<3;k++){ g.fillStyle = rnd() < .5 ? '#d9bf72' : '#c5ccd1'; const sx = rx + (rnd()-.5)*rs*1.1, sy = ry - rs*0.2 + (rnd()-.5)*rs*0.6; g.beginPath(); g.moveTo(sx, sy - 1.6); g.lineTo(sx + 1.4, sy); g.lineTo(sx, sy + 1.6); g.lineTo(sx - 1.4, sy); g.fill(); }
  }
  g.restore();
}

// Tree canopies: each tree has its own autumn colour family, built from leafy clumps on a dome that is lit from the
// top left (where the sun is). A short trunk shows below the crown; the tree sways from its base.
const FOLIAGE = {
  red:    ['#5e1d14','#8a2a1c','#b23b25','#d65a33','#ef8a52'],
  orange: ['#6b2f12','#9c4718','#cc6a22','#ea9134','#f8bd5c'],
  gold:   ['#6d4a14','#9c6c1c','#c99428','#e8bd42','#f8de7a'],
  rust:   ['#5a2516','#83391f','#ab5728','#cf7e38','#eaa95a'],
  olive:  ['#4d5220','#717a2c','#9c9a36','#c9b346','#ecd570'],
};
if (LOT.FOLIAGE) Object.assign(FOLIAGE, LOT.FOLIAGE);
// V13: families in BLOSSOM (the prairie's cherries) are crowns of blossom: dark branches through flatter clumps
const BLOSSOM = LOT.BLOSSOM || {};
const TREE_FAMS = LOT.TREE_FAMS || [['orange','gold'],['red','orange'],['gold','olive'],['rust','red'],['orange','red'],['gold','orange'],
                   ['red','rust'],['olive','gold'],['orange','rust'],['rust','gold'],['gold','red'],['red','orange']];
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
// a five-petalled blossom (cherry crowns)
function blossomDot(g, x, y, r, col, eye){
  g.fillStyle = col;
  for (let p=0;p<5;p++){ const a = p/5*TAU + x; ell(g, x + Math.cos(a)*r*0.55, y + Math.sin(a)*r*0.5, r*0.52, r*0.48); g.fill(); }
  g.fillStyle = eye; ell(g, x, y, r*0.26, r*0.24); g.fill();
}
function leafBlob(g, x, y, s, rot, col){ g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s); leafPath(g, 1); g.fillStyle = col; g.fill(); g.restore(); }
function buildCanopies(){
  const RES = 2;
  canopyCvs = TREES.map((t, ti) => {
    const R0 = t.r, pad = 34, ox = R0 + pad, oy = R0 + pad, w = 2*(R0 + pad), h = R0 + pad + R0*1.25 + 24;
    const c = document.createElement('canvas'); c.width = Math.ceil(w*RES); c.height = Math.ceil(h*RES);
    const g = c.getContext('2d'); g.scale(RES, RES); g.translate(ox, oy);
    const rnd = mulberry(t.seed);
    if (LOT.paintCanopy){ const base = LOT.paintCanopy(g, t, ti, { R0, ox, oy, w, rnd }); return { c, ox, oy, w, h, base }; }   // V14: the hollow's half-bare trees
    const [fa, fb] = t.fam || TREE_FAMS[ti % TREE_FAMS.length], A = FOLIAGE[fa], B = FOLIAGE[fb];
    const bloom = !!BLOSSOM[fa];
    // trunk and roots, mostly hidden by the crown (cherry bark: dark red-brown with pale bands)
    const base = R0*1.16, tw = Math.max(9, R0*0.075);
    g.fillStyle = 'rgba(30,22,10,.35)'; ell(g, tw*0.6, base + 2, tw*3.2, tw*0.8); g.fill();
    const tg = g.createLinearGradient(-tw*1.6, 0, tw*1.6, 0);
    if (bloom){ tg.addColorStop(0, '#76504a'); tg.addColorStop(0.45, '#56362f'); tg.addColorStop(1, '#341f1c'); }
    else { tg.addColorStop(0, '#7a5236'); tg.addColorStop(0.45, '#5c3b26'); tg.addColorStop(1, '#3a2418'); }
    g.fillStyle = tg; g.beginPath();
    g.moveTo(-tw*0.8, R0*0.45); g.lineTo(-tw, base - tw*1.2); g.quadraticCurveTo(-tw*1.2, base - tw*0.2, -tw*2.4, base + 1);
    g.lineTo(tw*2.6, base + 1); g.quadraticCurveTo(tw*1.2, base - tw*0.2, tw, base - tw*1.2); g.lineTo(tw*0.8, R0*0.45); g.closePath(); g.fill();
    g.strokeStyle = bloom ? 'rgba(230,200,190,.35)' : 'rgba(30,18,10,.45)'; g.lineWidth = bloom ? 1.1 : 1.2; g.lineCap = 'round';
    if (bloom) for (let k=0;k<6;k++){ const by = R0*0.62 + k*(base - R0*0.7)/6; g.beginPath(); g.moveTo(-tw*0.7, by); g.lineTo(-tw*0.1, by + 0.6); g.moveTo(tw*0.2, by + 2); g.lineTo(tw*0.7, by + 2.4); g.stroke(); }
    else for (let k=0;k<4;k++){ const bx = (rnd()-0.5)*tw*1.2; g.beginPath(); g.moveTo(bx, R0*0.62 + rnd()*R0*0.1); g.lineTo(bx + (rnd()-0.5)*3, base - tw*0.8 - rnd()*6); g.stroke(); }
    // crown: clumps on a dome (a cherry's is wide and a little flat, with dark branches showing through the gaps)
    const fy = bloom ? 0.8 : 0.9, L = [-0.5, -0.68, 0.54], clumps = [];
    if (bloom){
      g.strokeStyle = '#3e2622';
      for (let k=0;k<7;k++){
        const a = -Math.PI*0.92 + k/6*Math.PI*0.84 + (rnd() - 0.5)*0.2, ex = Math.cos(a)*R0*0.86, ey = Math.sin(a)*R0*0.86*fy;
        g.lineWidth = tw*0.55; g.beginPath(); g.moveTo((rnd() - 0.5)*tw*0.6, R0*0.5); g.quadraticCurveTo(ex*0.35, R0*0.2 + ey*0.2, ex, ey); g.stroke();
        g.lineWidth = tw*0.22; g.beginPath(); g.moveTo(ex*0.6, ey*0.6 + R0*0.08); g.quadraticCurveTo(ex*0.8 + (rnd() - 0.5)*20, ey*0.9, ex*0.95 + (rnd() - 0.5)*R0*0.3, ey + (rnd() - 0.6)*R0*0.25); g.stroke();
      }
    }
    const add = (cx, cy, cr) => {
      const nx = cx/R0, ny = cy/R0, nz = Math.sqrt(Math.max(0.05, 1 - nx*nx - ny*ny));
      const lum = nx*L[0] + ny*L[1] + nz*L[2] + (rnd() - 0.5)*0.35;
      clumps.push({ x: cx, y: cy, r: cr, z: nz, tone: clamp(Math.round((lum + 0.15)*3.1), 0, 4), pal: rnd() < 0.22 ? B : A });
    };
    const ring = bloom ? 14 : 16;
    for (let k=0;k<ring;k++){ const a = k/ring*TAU + rnd()*0.25, d = R0*(0.7 + rnd()*0.1); add(Math.cos(a)*d, Math.sin(a)*d*fy, R0*(0.21 + rnd()*0.07)*(bloom ? 0.95 : 1)); }
    const n = Math.round(Math.max(R0*0.2, 26)*(bloom ? 0.72 : 1));   // small trees need extra clumps or the middle looks hollow
    for (let k=0;k<n;k++){ const a = rnd()*TAU, d = R0*0.62*Math.sqrt(rnd()); add(Math.cos(a)*d, Math.sin(a)*d*fy - R0*0.05, R0*(0.2 + rnd()*0.1)*(1 - d/R0*0.3)*(bloom ? 0.92 : 1)); }
    clumps.sort((p, q) => (p.z - q.z) || (p.y - q.y));
    // dark outline first, so the crown edge reads against the grass
    g.fillStyle = A[0];
    for (const k of clumps) if (k.z < 0.75){ scallop(g, k.x + 2, k.y + 3, k.r + 3, rnd); g.fill(); }
    for (const k of clumps){
      const P = k.pal, tn = k.tone, lo = P[Math.max(0, tn - 1)], hi = P[Math.min(4, tn + 1)];
      // a lumpy, cauliflower-edged clump shaded across from light to dark, then textured with little leaves
      scallop(g, k.x + k.r*0.08, k.y + k.r*0.12, k.r, rnd); g.fillStyle = P[Math.max(0, tn - 2)]; g.fill();
      const gr = g.createLinearGradient(k.x - k.r*0.7, k.y - k.r*0.8, k.x + k.r*0.6, k.y + k.r*0.7);
      gr.addColorStop(0, hi); gr.addColorStop(0.45, P[tn]); gr.addColorStop(1, lo);
      scallop(g, k.x, k.y, k.r*0.93, rnd); g.fillStyle = gr; g.fill();
      const flowery = bloom && BLOSSOM[P === A ? fa : fb];
      for (let m=0;m<(flowery ? 10 : 11);m++){
        const a = rnd()*TAU, d = Math.sqrt(rnd())*k.r*0.85, lx = Math.cos(a)*d, ly = Math.sin(a)*d;
        const side = (lx*L[0] + ly*L[1])/k.r;   // leaves on the sunny side are lighter
        const col = side > 0.15 ? hi : side < -0.25 ? lo : (rnd() < 0.5 ? P[tn] : hi);
        if (flowery) blossomDot(g, k.x + lx, k.y + ly, 2.6 + rnd()*1.8, rnd() < 0.18 ? '#ffffff' : col, rnd() < .5 ? '#c2477a' : '#e07a9a');
        else leafBlob(g, k.x + lx, k.y + ly, 2.4 + rnd()*2.4, rnd()*TAU, col);
      }
      if (flowery && rnd() < 0.5) for (let m=0;m<2;m++){ const a = rnd()*TAU, d = rnd()*k.r*0.7; leafBlob(g, k.x + Math.cos(a)*d, k.y + Math.sin(a)*d, 1.8 + rnd(), rnd()*TAU, rnd() < .5 ? '#7da344' : '#98b752'); }
    }
    // soft sun from the top left, shade toward the bottom right
    g.globalCompositeOperation = 'source-atop';
    const sun = g.createRadialGradient(-R0*0.45, -R0*0.55, R0*0.05, -R0*0.3, -R0*0.35, R0*1.25);
    if (bloom){ sun.addColorStop(0, 'rgba(255,246,236,.34)'); sun.addColorStop(0.5, 'rgba(255,230,230,.06)'); sun.addColorStop(1, 'rgba(80,25,55,.26)'); }
    else { sun.addColorStop(0, 'rgba(255,236,170,.30)'); sun.addColorStop(0.5, 'rgba(255,220,150,.06)'); sun.addColorStop(1, 'rgba(60,20,8,.30)'); }
    g.fillStyle = sun; g.fillRect(-ox, -oy, w, R0*0.98 + oy);   // stops above the trunk
    g.globalCompositeOperation = 'source-over';
    // a few loose leaves (or petals) around the edge of the crown
    for (let k=0;k<46;k++){
      const a = rnd()*TAU, d = R0*(0.9 + rnd()*0.12), P = rnd() < 0.3 ? B : A, px = Math.cos(a)*d, py = Math.sin(a)*d*0.94*fy;
      if (bloom){ g.save(); g.translate(px, py); g.rotate(a + Math.PI/2 + (rnd()-0.5)); g.scale(2.6 + rnd()*1.6, 2.6 + rnd()*1.6); leafPath(g, 2); g.fillStyle = P[2 + Math.floor(rnd()*3)]; g.fill(); g.restore(); }
      else leafBlob(g, px, py, 3 + rnd()*2.4, a + Math.PI/2 + (rnd()-0.5), P[1 + Math.floor(rnd()*3)]);
    }
    return { c, ox, oy, w, h, base };
  });
}

// your own bushes are drawn live (not baked into the ground) so a shaker can shake them
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
  vignetteCv = document.createElement('canvas'); vignetteCv.width = cv.width; vignetteCv.height = cv.height;
  const g = vignetteCv.getContext('2d'); g.scale(DPR, DPR);
  if (LOT.paintVignette){ LOT.paintVignette(g, W, H); return; }
  const rg = g.createRadialGradient(W*0.5, H*0.48, Math.min(W,H)*0.35, W*0.5, H*0.5, Math.hypot(W,H)*0.62);
  const VG = LOT.vignette || { edge: ['rgba(60,25,5,0)', 'rgba(50,20,5,.42)'], sun: ['rgba(255,205,120,.22)', 'rgba(255,205,120,0)'] };
  rg.addColorStop(0, VG.edge[0]); rg.addColorStop(1, VG.edge[1]);
  g.fillStyle = rg; g.fillRect(0, 0, W, H);
  const sun = g.createRadialGradient(W*0.08, -H*0.1, 10, W*0.08, -H*0.1, Math.hypot(W,H)*0.75);
  sun.addColorStop(0, VG.sun[0]); sun.addColorStop(1, VG.sun[1]);
  g.fillStyle = sun; g.fillRect(0, 0, W, H);
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

  if (S.metalSlot && ART.drawTub) ART.drawTub(c);
  else if (S.metalSlot){
    c.save(); c.translate(TUB.x, TUB.y);
    c.fillStyle = 'rgba(35,25,10,.3)'; ell(c, 1, 2, 20, 5); c.fill();
    const g = c.createLinearGradient(-17, 0, 17, 0); g.addColorStop(0, '#5b6368'); g.addColorStop(.45, '#8c959a'); g.addColorStop(1, '#565e63');
    c.fillStyle = g; rr(c, -17, -32, 34, 32, 5); c.fill();
    c.fillStyle = '#2a2d2f'; ell(c, 0, -32, 16, 4.5); c.fill();
    if (S.binMetal > 0){
      const mf = clamp(S.binMetal / metalCap(), 0, 1), rnd = mulberry(9);
      c.save(); ell(c, 0, -32, 16, 4.5); c.rect(-16, -46, 32, 14); c.clip();
      for (let i=0;i<Math.ceil(4 + mf*14);i++){ nugget(c, -12 + rnd()*24, -32 - rnd()*mf*10, 3 + rnd()*1.5, rnd()*TAU); }
      c.restore();
    }
    c.strokeStyle = '#a3abaf'; c.lineWidth = 2; c.beginPath(); c.ellipse(0, -32, 16, 4.5, 0, 0, Math.PI); c.stroke();
    c.fillStyle = '#3d4245'; for (const yy of [-24, -6]){ ell(c, -13, yy, 1, 1); c.fill(); ell(c, 13, yy, 1, 1); c.fill(); }
    c.fillStyle = '#2f3a34'; rr(c, -14, -22, 28, 13, 2.5); c.fill();
    { const label = S.binMetal + '/' + metalCap(); let fs = metalCap() >= 100 ? 11 : 12.5; c.font = '700 ' + fs + 'px Caveat, cursive'; const lw = c.measureText(label).width; if (lw > 24) fs = fs*24/lw;
      chalk(c, label, 0, -15.5, fs, tubRoom() <= 0 ? '#ffb38a' : '#efe8d8'); }
    if (keepMetal() > 0) keepMark(c, -17, -2, -32, keepMetal()/metalCap());
    c.restore();
  }
}
// the keep line: a little orange marker on the side of the bin (or tub) at the height of what the truck leaves behind
function keepMark(c, x, y0, y1, f){
  const y = lerp(y0, y1, clamp(f, 0, 1));
  c.fillStyle = '#ff9b3d'; c.beginPath(); c.moveTo(x - 1, y - 3); c.lineTo(x + 4, y); c.lineTo(x - 1, y + 3); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,155,61,.8)'; c.lineWidth = 1; c.setLineDash([2, 2]); c.beginPath(); c.moveTo(x + 4, y); c.lineTo(x + 14, y); c.stroke(); c.setLineDash([]);
}
function nugget(c, x, y, s, rot){
  if (ART.nugget) return ART.nugget(c, x, y, s, rot);
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s/8, s/8);
  c.fillStyle = '#7d868c'; c.beginPath(); c.moveTo(-8,3); c.lineTo(-5,-6); c.lineTo(3,-8); c.lineTo(9,-2); c.lineTo(7,6); c.lineTo(-2,8); c.closePath(); c.fill();
  c.fillStyle = '#aeb6bb'; c.beginPath(); c.moveTo(-5,-6); c.lineTo(3,-8); c.lineTo(1,-1); c.closePath(); c.fill();
  c.fillStyle = '#5c6469'; c.beginPath(); c.moveTo(1,-1); c.lineTo(9,-2); c.lineTo(7,6); c.closePath(); c.fill();
  c.fillStyle = '#e2c77d'; ell(c, -2, 2, 1.7, 1.7); c.fill();
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
  if (MINE_LAND && S.land + 1 === MINE_LAND){
    // V13 (from the prairie): a plank hung under the board: the next plot has the first metal vein
    c.strokeStyle = '#4a3226'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-26, -36); c.lineTo(-30, -31); c.moveTo(26, -36); c.lineTo(30, -31); c.stroke();
    c.fillStyle = '#5a3b26'; rr(c, -50, -32, 100, 17, 3); c.fill();
    c.fillStyle = '#f6e3a8'; rr(c, -48.5, -30.5, 97, 14, 2.5); c.fill();
    nugget(c, -40, -23.5, 6.5, 0.3);
    const mt = 'Finally a chance to mine!'; c.font = '700 11px Caveat, cursive'; const mw = c.measureText(mt).width;
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
  if (ART.shedExtra) ART.shedExtra(c);   // V14: moss and drips in the rain
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
  if (ART.drawSpotGlints) return ART.drawSpotGlints();
  const c = ctx;
  SPOTS.forEach((p, i) => {
    if (S.miners.includes(i) || p.land > S.land) return;
    for (let k=0;k<3;k++){
      const ph = S.t*1.4 + i*2.1 + k*2.3, a = Math.pow(Math.max(0, Math.sin(ph)), 6) * (S.metalSlot ? 1 : 0.6);
      if (a < 0.02) continue;
      const gx = p.x + [-18, 4, 18][k], gy = p.y + [-8, -14, -3][k], s = 3 + a*4;
      c.save(); c.globalAlpha = a; c.fillStyle = '#fff6d8'; c.translate(gx, gy);
      c.beginPath(); c.moveTo(0, -s); c.lineTo(s*0.25, -s*0.25); c.lineTo(s, 0); c.lineTo(s*0.25, s*0.25); c.lineTo(0, s); c.lineTo(-s*0.25, s*0.25); c.lineTo(-s, 0); c.lineTo(-s*0.25, -s*0.25); c.closePath(); c.fill();
      c.restore();
    }
  });
}

function drawMiner(i){
  if (ART.drawMiner) return ART.drawMiner(i);
  if (S.shafts.includes(i)){ drawShaft(i); return; }
  const p = SPOTS[i], c = ctx;
  const working = minerWorkers(i).some(ri => R[ri] && R[ri].st === 'mine');
  const t = S.t;
  c.save(); c.translate(p.x, p.y);
  c.strokeStyle = '#6a4630'; c.lineWidth = 4; c.lineCap = 'round';
  c.beginPath(); c.moveTo(0, -66); c.lineTo(4, -2); c.stroke();
  const bob = working ? Math.sin(t*16)*2.2 : 0;
  c.fillStyle = '#9aa0a4'; c.fillRect(-2.2, -34 + bob, 4.4, 30);
  c.fillStyle = '#6c7378'; c.beginPath(); c.moveTo(-4, -6 + bob); c.lineTo(4, -6 + bob); c.lineTo(0, 3 + bob); c.closePath(); c.fill();
  c.fillStyle = '#4e7672'; rr(c, -16, -56, 32, 22, 4); c.fill();
  c.fillStyle = '#5f8c87'; rr(c, -16, -56, 32, 9, 4); c.fill();
  c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(-13, -54, 12, 2);
  c.save(); c.translate(-8, -42); c.rotate(working ? t*5 : 0); c.fillStyle = '#d1a54a';
  for (let k=0;k<8;k++){ c.rotate(TAU/8); c.fillRect(-1.3, -6.2, 2.6, 3); }
  ell(c, 0, 0, 4.6, 4.6); c.fill(); c.fillStyle = '#7a5a1e'; ell(c, 0, 0, 1.6, 1.6); c.fill(); c.restore();
  c.fillStyle = working ? (Math.sin(t*6) > 0 ? '#ffd36b' : '#f0a640') : '#7d6a4a'; ell(c, 8, -44, 2.6, 2.6); c.fill();
  if (working){ c.fillStyle = 'rgba(255,211,107,.25)'; ell(c, 8, -44, 6, 6); c.fill(); }
  c.fillStyle = '#3d3734'; rr(c, 6, -66, 6, 11, 1.5); c.fill();
  c.strokeStyle = '#7a5236'; c.lineWidth = 4.5;
  c.beginPath(); c.moveTo(0, -66); c.lineTo(-24, 6); c.moveTo(0, -66); c.lineTo(24, 6); c.stroke();
  c.strokeStyle = '#8a6040'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-14, -22); c.lineTo(14, -22); c.stroke();
  c.fillStyle = '#5a3b26'; ell(c, 0, -66, 3.5, 3.5); c.fill();
  c.restore();
  if (working && !simMode && Math.random() < 0.06) parts.push({ k:'dust', x: p.x + 9, y: p.y - 66, vx: rand(4,14), vy: rand(-22,-12), g:0, life: rand(1,1.6), t:0, r: rand(3,5), gray:true });
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
  if (ART.drawIngot) return ART.drawIngot(c, x, y, s, rot, grade, wet);
  // a cast bar seen from the front and a little above; better alloys are brighter
  grade = grade == null ? S.lv.ingotGrade : grade;
  const G = [['#5f666a','#8f979b','#40464a'], ['#6d777d','#a9b2b7','#495155'], ['#7f8a90','#c3ccd1','#555e63'], ['#93a0a7','#e3e9ec','#606b71'], ['#a39a7c','#ece2bc','#6e6650'], ['#b8933c','#f7dc8a','#7c5e1e']][clamp(grade, 0, 5)];
  c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.scale(s/10, s/10);
  c.fillStyle = G[2]; c.beginPath(); c.moveTo(-5.2, 0); c.lineTo(5.2, 0); c.lineTo(4, -2.8); c.lineTo(-4, -2.8); c.closePath(); c.fill();
  c.fillStyle = G[0]; c.beginPath(); c.moveTo(-4.6, -0.3); c.lineTo(4.6, -0.3); c.lineTo(3.8, -2.6); c.lineTo(-3.8, -2.6); c.closePath(); c.fill();
  c.fillStyle = G[1]; c.beginPath(); c.moveTo(-4, -2.8); c.lineTo(4, -2.8); c.lineTo(3.2, -4.4); c.lineTo(-3.2, -4.4); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.75)'; c.fillRect(-2.6, -4.05, 3.4, 0.45);
  c.restore();
}
const BOW_COL = [['#e8eef4', '#aab4bf'], ['#2f6fb5', '#1f4f86'], ['#f2c443', '#b8862a']];
function drawGiftJar(c, x, y, s, k = 1, tier = S.lv.giftPrice | 0){
  if (ART.drawGiftJar) return ART.drawGiftJar(c, x, y, s, k, tier);
  drawJar(c, x, y, s);
  if (k < 0.3) return;
  c.save(); c.translate(x, y); c.scale(s/6, s/6);
  // a red gingham cloth over the lid, tied with twine, and a little paper tag (V11: and a ribbon bow on the front)
  c.fillStyle = '#b8392a'; c.beginPath(); c.moveTo(-4.7, -3.6); c.quadraticCurveTo(-5.4, -7, -3, -6.8); c.lineTo(3, -6.8); c.quadraticCurveTo(5.4, -7, 4.7, -3.6); c.lineTo(3.4, -2.9); c.lineTo(-3.4, -2.9); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,240,225,.6)'; for (let i=-3; i<=3; i+=2) for (let j=0;j<2;j++) c.fillRect(i - 0.5 + j, -6.4 + j*1.4, 0.9, 0.9);
  c.strokeStyle = '#d9c08a'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-3.6, -3.9); c.lineTo(3.6, -3.9); c.stroke();
  c.fillStyle = '#f2e3c4'; c.save(); c.translate(3.9, -2.4); c.rotate(0.35); rr(c, -0.2, 0, 2.2, 2.8, 0.4); c.fill(); c.restore();
  if (k >= 0.6){
    // a ribbon down the front of the jar, over the label, with a bow at the neck (gold once the ribbons are maxed)
    const [b0, b1] = BOW_COL[clamp(tier, 0, 2)], big = tier >= 1 ? 1.2 : 1;
    c.fillStyle = b0; c.fillRect(-0.75, -2.9, 1.5, 7.6); c.fillStyle = b1; c.fillRect(0.35, -2.9, 0.4, 7.6);
    if (k >= 0.85){
      if (tier >= 1){ c.fillStyle = b1; c.beginPath(); c.moveTo(-0.4, -2.4); c.lineTo(-2.4, 1.2); c.lineTo(-1.5, 1.4); c.lineTo(0, -2); c.lineTo(1.5, 1.4); c.lineTo(2.4, 1.2); c.lineTo(0.4, -2.4); c.closePath(); c.fill(); }
      c.fillStyle = b0; ell(c, -2*big, -2.6, 2*big, 1.3*big); c.fill(); ell(c, 2*big, -2.6, 2*big, 1.3*big); c.fill();
      c.fillStyle = b1; ell(c, -1.7*big, -2.55, 0.8*big, 0.5*big); c.fill(); ell(c, 1.7*big, -2.55, 0.8*big, 0.5*big); c.fill();
      c.fillStyle = b0; ell(c, 0, -2.5, 1, 1); c.fill();
      if (tier >= 2){ c.fillStyle = 'rgba(255,250,220,.9)'; ell(c, -2.4, -3, 0.6, 0.35); c.fill(); ell(c, 0.2, -2.8, 0.35, 0.3); c.fill(); }
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
  if (ART.drawPallet) return ART.drawPallet();
  if (!S.plant.built) return;
  const c = ctx, n = S.ingots, cap = palletCap();
  const grow = clamp((S.t - plantRt.builtT - 0.4)/0.6, 0, 1); if (grow <= 0) return;
  c.save(); c.translate(PALLET.x, PALLET.y); c.scale(ease(grow), ease(grow));
  c.fillStyle = 'rgba(35,25,10,.3)'; ell(c, 2, 2, 26, 5); c.fill();
  // the pallet: three blocks and slats
  c.fillStyle = '#7c5a3c'; for (const bx of [-20, -2, 16]) { c.fillRect(bx, -5, 5, 5); }
  c.fillStyle = '#b38455'; rr(c, -23, -8, 46, 3.5, 1); c.fill();
  c.fillStyle = '#a3774b'; for (const sx of [-21, -11, -1, 9, 19]) c.fillRect(sx - 3, -8, 1, 3.5);
  // ingots: rows of four, three, two, one (a picture, not a count)
  const shown = n <= 0 ? 0 : Math.max(1, Math.round(clamp(n/cap, 0, 1)*10)), rows = [[-15, -5, 5, 15], [-10, 0, 10], [-5, 5], [0]];
  let k = 0;
  rows.forEach((row, ri) => row.forEach(x => { if (k++ < shown) drawIngot(c, x, -8.5 - ri*4.3, 10); }));
  // chalk tag on a stake
  c.fillStyle = '#6e4a30'; rr(c, 23, -30, 3, 30, 1); c.fill();
  c.fillStyle = '#734428'; rr(c, 17, -42, 20, 13, 2); c.fill(); c.fillStyle = '#2f3a34'; rr(c, 18.3, -40.7, 17.4, 10.4, 1.6); c.fill();
  const label = n + '/' + cap; let fs = 9.5; c.font = '700 ' + fs + 'px Caveat, cursive'; const lw = c.measureText(label).width; if (lw > 15) fs = fs*15/lw;
  chalk(c, label, 27, -35.3, fs, n >= cap ? '#ffb38a' : '#efe8d8');
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
  if (ART.drawPlant) return ART.drawPlant();
  if (!plantShown()) return;
  const c = ctx;
  c.save(); c.translate(PLANT.x, PLANT.y);
  if (!S.plant.built){ drawPlot(c, 150, 46, 'smelting plant', plantRt.shownT); c.restore(); return; }
  const grow = clamp((S.t - plantRt.builtT)/1.5, 0, 1); if (grow < 1) c.scale(1, ease(grow));
  const busy = [0, 1, 2].map(i => { const ri = STN.smelt[i]; return ri != null && R[ri] && R[ri].st === 'smelt'; });
  const any = busy.some(b => b), t = S.t;
  // ground shadow and a stone apron
  c.fillStyle = 'rgba(30,22,10,.32)'; ell(c, 6, 3, 104, 12); c.fill();
  c.fillStyle = '#8f877a'; rr(c, -70, -4, 140, 8, 3); c.fill();
  // chimneys (behind the roof line): two brick stacks and one riveted steel one
  const stacks = [[-46, 12, -150, 'brick'], [-26, 10, -128, 'brick'], [44, 9, -116, 'steel']];
  for (const [sx, sw, top, kind] of stacks){
    if (kind === 'brick'){ brickWall(c, sx - sw/2, top, sw, -60 - top, '#8a3f2a'); c.fillStyle = '#a85a3a'; c.fillRect(sx - sw/2 - 1.5, top - 3, sw + 3, 5); c.fillStyle = '#5a2a1c'; c.fillRect(sx - sw/2 - 1.5, top + 6, sw + 3, 1.5); c.fillStyle = '#231a16'; ell(c, sx, top - 3, sw/2, 1.4); c.fill(); }
    else {
      const g = c.createLinearGradient(sx - sw/2, 0, sx + sw/2, 0); g.addColorStop(0, '#5b6368'); g.addColorStop(0.45, '#9aa3a8'); g.addColorStop(1, '#4e5559');
      c.fillStyle = g; c.fillRect(sx - sw/2, top, sw, -60 - top);
      c.fillStyle = '#c9a24a'; for (const by of [top + 4, top + 22, top + 40]) c.fillRect(sx - sw/2 - 0.8, by, sw + 1.6, 2);
      c.fillStyle = '#231a16'; ell(c, sx, top, sw/2, 1.3); c.fill();
    }
  }
  // the main hall
  brickWall(c, -62, -64, 124, 64, '#93432c');
  // stone plinth and the sawtooth roof with glowing skylights
  c.fillStyle = '#6a625a'; c.fillRect(-63, -6, 126, 6);
  for (let k=0;k<3;k++){
    const x0 = -64 + k*43, x1 = x0 + 43;
    c.fillStyle = '#3d3836'; c.beginPath(); c.moveTo(x0, -64); c.lineTo(x1, -64); c.lineTo(x1, -80); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,190,90,' + (0.55 + (any ? 0.2 + 0.08*Math.sin(t*5 + k) : 0)) + ')'; c.fillRect(x1 - 3.4, -79, 2.6, 14);
    c.fillStyle = '#2b2725'; c.fillRect(x1 - 0.8, -81, 1.6, 17);
  }
  c.fillStyle = '#2b2725'; c.fillRect(-64, -65, 128, 2);
  // a nameplate along the top of the wall
  c.fillStyle = '#2f2a26'; rr(c, -30, -61, 60, 8, 1.5); c.fill();
  c.strokeStyle = '#c9a24a'; c.lineWidth = 0.8; rr(c, -28.5, -59.5, 57, 5, 1); c.stroke();
  c.fillStyle = '#c9a24a'; for (const bx of [-26, 26]){ ell(c, bx, -57, 0.8, 0.8); c.fill(); }
  // a copper steam pipe along the facade, with joints
  c.strokeStyle = '#a8653a'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-62, -48); c.lineTo(62, -48); c.stroke();
  c.fillStyle = '#c98a55'; for (const jx of [-52, -20, 20, 52]){ c.fillRect(jx - 1.6, -50.2, 3.2, 4.4); }
  // the amber core: a big brass porthole over the middle door with a slowly turning ring inside
  c.save(); c.translate(0, -36);
  c.fillStyle = '#7a5a1e'; ell(c, 0, 0, 11.5, 11.5); c.fill();
  c.fillStyle = '#d9b75a'; ell(c, 0, 0, 10, 10); c.fill();
  const core = c.createRadialGradient(0, 0, 1, 0, 0, 8); core.addColorStop(0, any ? '#fff2c0' : '#f2c46a'); core.addColorStop(0.6, any ? '#ffb347' : '#c97a2a'); core.addColorStop(1, '#7a3a14');
  c.fillStyle = core; ell(c, 0, 0, 8, 8); c.fill();
  c.rotate(t*(any ? 1.6 : 0.3)); c.strokeStyle = 'rgba(90,40,10,.6)'; c.lineWidth = 1;
  for (let k=0;k<6;k++){ c.rotate(TAU/6); c.beginPath(); c.moveTo(2.4, 0); c.lineTo(7.4, 0); c.stroke(); }
  c.restore();
  c.fillStyle = '#4a3a26'; for (let k=0;k<8;k++){ const a = k/8*TAU; ell(c, Math.cos(a)*10.8, -36 + Math.sin(a)*10.8, .7, .7); c.fill(); }
  // two pressure gauges with twitchy needles
  for (const [gx, ph] of [[-40, 0], [40, 2]]){
    c.fillStyle = '#7a5a1e'; ell(c, gx, -36, 6, 6); c.fill(); c.fillStyle = '#f2e7cf'; ell(c, gx, -36, 4.6, 4.6); c.fill();
    const a = -2.3 + (any ? 2.6 + Math.sin(t*7 + ph)*0.25 : 0.6);
    c.strokeStyle = '#a8361d'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(gx, -36); c.lineTo(gx + Math.cos(a)*3.8, -36 + Math.sin(a)*3.8); c.stroke();
  }
  // three furnace doors, glowing hotter where a robot is working
  for (let i=0;i<3;i++){
    const dx = (i - 1)*40, on = busy[i], fl = on ? (stoker() ? 0.92 : 0.75) + (stoker() ? 0.08 : 0.25)*Math.sin(t*13 + i*2) : 0.25 + 0.05*Math.sin(t*2 + i);
    c.fillStyle = '#2b2724'; c.beginPath(); c.moveTo(dx - 12, -1); c.lineTo(dx - 12, -18); c.arc(dx, -18, 12, Math.PI, 0); c.lineTo(dx + 12, -1); c.closePath(); c.fill();
    const fg = c.createRadialGradient(dx, -8, 1, dx, -10, 14); fg.addColorStop(0, 'rgba(255,236,160,' + fl + ')'); fg.addColorStop(0.5, 'rgba(255,140,40,' + fl*0.9 + ')'); fg.addColorStop(1, 'rgba(120,30,10,' + fl*0.6 + ')');
    c.fillStyle = fg; c.beginPath(); c.moveTo(dx - 9, -2); c.lineTo(dx - 9, -18); c.arc(dx, -18, 9, Math.PI, 0); c.lineTo(dx + 9, -2); c.closePath(); c.fill();
    c.strokeStyle = '#1e1a18'; c.lineWidth = 1; for (const gx of [-5, 0, 5]){ c.beginPath(); c.moveTo(dx + gx, -2); c.lineTo(dx + gx, -14); c.stroke(); }
    c.fillStyle = '#c9a24a'; for (const ry of [-6, -14]){ ell(c, dx - 11, ry, .8, .8); c.fill(); ell(c, dx + 11, ry, .8, .8); c.fill(); }
    if (on){ c.fillStyle = 'rgba(255,170,70,.18)'; ell(c, dx, 2, 16, 4); c.fill(); }
  }
  // the bellows intake: a round iron grate in the apron, glowing when a blower works it
  { const vx = PLANT_VENT.x - PLANT.x, vy = PLANT_VENT.y - PLANT.y, st2 = stoker(), gl = st2 ? 0.55 + 0.25*Math.sin(t*14) : 0.12;
    c.fillStyle = '#7a5a1e'; ell(c, vx, vy, 7, 2.8); c.fill(); c.fillStyle = 'rgba(255,150,50,' + gl + ')'; ell(c, vx, vy, 5.6, 2.1); c.fill();
    c.strokeStyle = '#2b2724'; c.lineWidth = 0.9; for (const gx of [-3, 0, 3]){ c.beginPath(); c.moveTo(vx + gx, vy - 1.8); c.lineTo(vx + gx, vy + 1.8); c.stroke(); } }
  // little indicator lamps
  for (let k=0;k<4;k++){ const on = Math.sin(t*2.4 + k*1.3) > 0.4; c.fillStyle = on ? '#ffb347' : '#6a4a2a'; ell(c, -56 + k*4, -44, 1.2, 1.2); c.fill(); }
  // the ore hopper on the left: a steel funnel on legs, feeding a chute into the wall
  c.save(); c.translate(HOPPER.x - PLANT.x, HOPPER.y - PLANT.y);
  c.strokeStyle = '#4a4f52'; c.lineWidth = 2; c.beginPath(); c.moveTo(-9, 0); c.lineTo(-6, -24); c.moveTo(9, 0); c.lineTo(6, -24); c.stroke();
  c.strokeStyle = '#6c7378'; c.lineWidth = 3; c.beginPath(); c.moveTo(4, -28); c.lineTo(22, -34); c.stroke();
  const hg = c.createLinearGradient(-15, 0, 15, 0); hg.addColorStop(0, '#5b6368'); hg.addColorStop(0.5, '#a3abaf'); hg.addColorStop(1, '#4e5559');
  c.fillStyle = hg; c.beginPath(); c.moveTo(-16, -48); c.lineTo(16, -48); c.lineTo(6, -24); c.lineTo(-6, -24); c.closePath(); c.fill();
  c.fillStyle = '#2a2d2f'; ell(c, 0, -48, 16, 3.6); c.fill();
  if (S.plant.ore > 0){ const f = clamp(S.plant.ore/hopperCap(), 0, 1), rnd = mulberry(23); c.save(); ell(c, 0, -48, 15.5, 3.4); c.rect(-16, -60, 32, 12); c.clip(); for (let i=0;i<Math.ceil(3 + f*12);i++) nugget(c, -11 + rnd()*22, -48 - rnd()*f*8, 2.8 + rnd()*1.2, rnd()*TAU); c.restore(); }
  c.strokeStyle = '#c3cbce'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(0, -48, 16, 3.6, 0, 0, Math.PI); c.stroke();
  c.fillStyle = '#2f3a34'; rr(c, -11, -42, 22, 10, 2); c.fill();
  chalk(c, Math.floor(S.plant.ore) + '/' + hopperCap(), 0, -36.8, 9, S.plant.ore >= hopperCap() ? '#ffb38a' : '#efe8d8');
  c.restore();
  // the ingot rack on the right: two shelves of fresh ingots
  c.save(); c.translate(RACK.x - PLANT.x, RACK.y - PLANT.y);
  c.fillStyle = '#5a3b26'; c.fillRect(-15, -36, 3, 36); c.fillRect(12, -36, 3, 36);
  c.fillStyle = '#8a6040'; rr(c, -16, -19, 32, 3, 1); c.fill(); rr(c, -16, -37, 32, 3, 1); c.fill();
  const nr = Math.min(S.plant.rack, RACK_CAP);
  for (let i=0;i<nr;i++){ const shelf = i < 4 ? 0 : 1, k = i % 4; drawIngot(c, -9 + k*6, shelf ? -37 : -19, 7, 0); }
  if (plantRt.bump > 0){ c.fillStyle = 'rgba(255,200,120,' + plantRt.bump + ')'; ell(c, 0, -26, 18, 10); c.fill(); }
  c.restore();
  c.restore();
  // smoke from the chimneys while the plant works
  if (!simMode && grow >= 1){
    const k = any ? 1 : 0.18;
    for (const [sx, , top] of stacks){ if (Math.random() < 0.05*k*(reduceMotion ? 0.3 : 1)) parts.push({ k:'smoke', x: PLANT.x + sx + rand(-2, 2), y: PLANT.y + top - 4, vx: rand(-4, 4) + wind*0.25, vy: rand(-22, -14), g: 0, life: rand(2.2, 3.4), t: 0, r: rand(4, 6) }); }
  }
  if (grow >= 1){
    if (S.plant.rack >= RACK_CAP) bubbles.push({ x: RACK.x, y: RACK.y - 50, t: 'rack full' });
    else if (S.plant.ore < metalPerIngot() - 1e-9 && STN.smelt.some(v => v != null) && !S.binMetal && !R.some(r => r.st === 'toBin' && r.at === 'metal')) bubbles.push({ x: HOPPER.x, y: HOPPER.y - 68, t: 'needs ore' });
  }
}

// ── a mine shaft: a timber headframe with a turning wheel over a framed hole, and an ore cart beside it
function drawShaft(i){
  if (ART.drawShaft) return ART.drawShaft(i);
  const p = SPOTS[i], c = ctx, t = S.t;
  const ws = minerWorkers(i), working = ws.some(ri => R[ri] && R[ri].st === 'mine');
  const dug = HB.some(h => h.kind === 'blower' && h.st === 'dig' && h.dig === i);
  c.save(); c.translate(p.x, p.y);
  // the ore cart on two short rails (behind the headframe)
  c.strokeStyle = '#5a4a3a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(18, -12); c.lineTo(46, -12); c.moveTo(18, -9); c.lineTo(46, -9); c.stroke();
  c.fillStyle = '#4a423b'; ell(c, 25, -11, 2.6, 2.6); c.fill(); ell(c, 37, -11, 2.6, 2.6); c.fill();
  c.fillStyle = '#6c7378'; c.beginPath(); c.moveTo(19, -24); c.lineTo(43, -24); c.lineTo(40, -13); c.lineTo(22, -13); c.closePath(); c.fill();
  c.fillStyle = '#8f979b'; c.fillRect(19, -24, 24, 2);
  const rnd = mulberry(i*13 + 5); for (let k=0;k<5;k++) nugget(c, 23 + rnd()*16, -25 - rnd()*3, 2.6, rnd()*TAU);
  // the hole with a timber collar, seen from a little above
  c.fillStyle = '#5a3b26'; rr(c, -15, -6, 38, 15, 2); c.fill();
  c.fillStyle = '#141110'; rr(c, -11, -3.5, 30, 10, 1.5); c.fill();
  const hg = c.createLinearGradient(0, -3, 0, 6); hg.addColorStop(0, 'rgba(70,50,30,.6)'); hg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = hg; c.fillRect(-11, -3.5, 30, 6);
  c.fillStyle = '#7a5236'; c.fillRect(-15, -6, 38, 2.4); c.fillRect(-15, 6.6, 38, 2.4);
  c.fillStyle = '#4a2c1a'; for (const nx of [-12, 20]) for (const ny of [-4.8, 7.8]){ ell(c, nx, ny, .7, .7); c.fill(); }
  // the headframe: two splayed legs, cross braces and a platform, with the sheave wheel on top
  c.strokeStyle = '#6a4630'; c.lineWidth = 3.4; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-13, -4); c.lineTo(0, -92); c.moveTo(21, -4); c.lineTo(8, -92); c.stroke();
  c.strokeStyle = '#8a6040'; c.lineWidth = 2;
  c.beginPath(); for (const [y, w] of [[-30, 15], [-58, 11]]){ c.moveTo(4 - w, y); c.lineTo(4 + w, y); } c.moveTo(-9, -30); c.lineTo(15, -58); c.moveTo(17, -30); c.lineTo(-7, -58); c.stroke();
  c.fillStyle = '#5a3b26'; rr(c, -6, -94, 20, 4, 1); c.fill();
  // cable down into the hole, and the wheel (turning while someone works)
  c.strokeStyle = '#2f2a26'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(10, -98); c.lineTo(10, -2); c.stroke();
  c.save(); c.translate(4, -100); c.rotate(working ? t*4 : 0);
  c.strokeStyle = '#4a423b'; c.lineWidth = 2; ell(c, 0, 0, 7.5, 7.5); c.stroke();
  c.lineWidth = 1; for (let k=0;k<6;k++){ c.rotate(TAU/6); c.beginPath(); c.moveTo(0, 0); c.lineTo(7, 0); c.stroke(); }
  c.fillStyle = '#c9a24a'; ell(c, 0, 0, 1.8, 1.8); c.fill();
  c.restore();
  // a lamp on the frame
  const on = working ? Math.sin(t*6) > 0 : false;
  c.fillStyle = on ? '#ffd36b' : '#7d6a4a'; ell(c, 15, -64, 2.2, 2.2); c.fill();
  if (on){ c.fillStyle = 'rgba(255,211,107,.25)'; ell(c, 15, -64, 5.5, 5.5); c.fill(); }
  // dust from the hole, more of it while a blower excavates
  if (working && !simMode && Math.random() < (dug ? 0.12 : 0.05)) parts.push({ k:'dust', x: p.x + 4 + rand(-8, 8), y: p.y, vx: rand(-6, 6), vy: rand(-20, -8), g:0, life: rand(.8, 1.4), t:0, r: rand(3, 6) });
  c.restore();
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
// ── V12: the old picture book. A faded teal cover with a sun on it, a torn corner and water stains; inside, only two
// pages are left: an elephant (left) and a crab (right).
const BOOK = { cover:'#4f7f86', cover2:'#3b6268', spine:'#2f4f54', page:'#f3e6c8', page2:'#dccaa4', sun:'#e9b94a' };
// closed and upright, cover to the viewer (as a robot carries it, or flying through the air)
function drawBookClosed(c, x, y, s, rot){
  c.save(); c.translate(x, y); c.rotate(rot || 0); c.scale(s, s);
  c.fillStyle = BOOK.page2; rr(c, -4, -5.6, 9.2, 11.2, 1); c.fill();                 // the page block, peeking out
  c.fillStyle = BOOK.cover; rr(c, -5, -6, 9.2, 11.6, 1.2); c.fill();
  c.fillStyle = BOOK.spine; c.fillRect(-5, -6, 2, 11.6);
  c.fillStyle = BOOK.sun; ell(c, 0.8, -1.4, 1.9, 1.9); c.fill();
  c.strokeStyle = BOOK.sun; c.lineWidth = 0.5; c.beginPath(); for (let k=0;k<8;k++){ const a = k*TAU/8; c.moveTo(0.8 + Math.cos(a)*2.5, -1.4 + Math.sin(a)*2.5); c.lineTo(0.8 + Math.cos(a)*3.3, -1.4 + Math.sin(a)*3.3); } c.stroke();
  c.fillStyle = 'rgba(243,230,200,.75)'; c.fillRect(-1.6, 2.4, 5, 0.8); c.fillRect(-1, 3.8, 3.6, 0.6);   // the title, mostly worn off
  c.fillStyle = BOOK.page; c.beginPath(); c.moveTo(4.2, 5.6); c.lineTo(4.2, 2.2); c.lineTo(3.2, 3.4); c.lineTo(2.6, 4.4); c.lineTo(1.4, 5.6); c.closePath(); c.fill();   // torn corner
  c.fillStyle = 'rgba(40,60,60,.22)'; ell(c, -1.4, 3.4, 2, 1.4); c.fill();      // water stain
  c.restore();
}
function bookElephant(c, x, y, k){
  c.save(); c.translate(x, y); c.scale(k, k);
  c.fillStyle = '#9aa3ab'; ell(c, 0.8, 0.6, 2.6, 1.8); c.fill();
  c.fillStyle = '#a9b2b9'; ell(c, -1.6, -0.6, 1.5, 1.5); c.fill();
  c.fillStyle = '#d9a3a6'; ell(c, -0.9, -0.6, 0.8, 1.1); c.fill();
  c.strokeStyle = '#a9b2b9'; c.lineWidth = 0.9; c.lineCap = 'round'; c.beginPath(); c.moveTo(-2.8, -0.2); c.quadraticCurveTo(-4, -0.6, -3.8, -2.4); c.stroke();
  c.strokeStyle = 'rgba(79,124,132,.7)'; c.lineWidth = 0.45; c.beginPath(); c.moveTo(-4.4, -3); c.quadraticCurveTo(-5, -3.8, -4.4, -4.4); c.moveTo(-3.4, -3.2); c.quadraticCurveTo(-3.6, -4.4, -2.8, -4.8); c.stroke();   // a puff of air
  c.strokeStyle = '#8a939b'; c.lineWidth = 0.7; c.beginPath(); for (const lx of [-0.8, 0.4, 1.8, 2.8]){ c.moveTo(lx, 1.8); c.lineTo(lx, 2.9); } c.stroke();
  c.restore();
}
function bookCrab(c, x, y, k){
  c.save(); c.translate(x, y); c.scale(k, k);
  c.strokeStyle = '#c4452f'; c.lineWidth = 0.55; c.lineCap = 'round';
  c.beginPath(); for (const sd of [-1, 1]) for (let j=0;j<3;j++){ c.moveTo(sd*1.6, 0.8 + j*0.5); c.lineTo(sd*(2.8 + j*0.2), 1.8 + j*0.6); } c.stroke();
  c.beginPath(); c.moveTo(-1.6, -0.2); c.lineTo(-2.6, -1.6); c.moveTo(1.6, -0.2); c.lineTo(2.6, -1.6); c.stroke();
  c.fillStyle = '#e2702a'; ell(c, 0, 0.6, 2.4, 1.5); c.fill();
  for (const sd of [-1, 1]){ c.fillStyle = '#e2702a'; ell(c, sd*2.9, -2.4, 1.2, 1.3); c.fill(); c.fillStyle = BOOK.page; c.beginPath(); c.moveTo(sd*2.9, -2.6); c.lineTo(sd*3.6, -3.8); c.lineTo(sd*2.3, -3.6); c.closePath(); c.fill(); }
  c.fillStyle = '#3a2e22'; ell(c, -0.6, -1.3, 0.35, 0.35); c.fill(); ell(c, 0.6, -1.3, 0.35, 0.35); c.fill();
  c.restore();
}
// open, the spread toward the viewer: elephant on the left page, crab on the right. flip (0..1) turns a loose page over.
function drawBookOpen(c, x, y, s, flip){
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = BOOK.cover2; c.beginPath(); c.moveTo(0, -5.6); c.lineTo(-10, -7); c.lineTo(-10, 5); c.lineTo(0, 6.4); c.lineTo(10, 5); c.lineTo(10, -7); c.closePath(); c.fill();
  c.fillStyle = BOOK.page; c.beginPath(); c.moveTo(0, -5); c.lineTo(-9.2, -6.3); c.lineTo(-9.2, 4.4); c.lineTo(0, 5.7); c.closePath(); c.fill();
  c.fillStyle = '#efe0bd'; c.beginPath(); c.moveTo(0, -5); c.lineTo(9.2, -6.3); c.lineTo(9.2, 1.6); c.lineTo(8, 2.6); c.lineTo(8.6, 3.6); c.lineTo(7.2, 4.6); c.lineTo(0, 5.7); c.closePath(); c.fill();   // the right page is torn at the corner
  const sg = c.createLinearGradient(-2, 0, 2, 0); sg.addColorStop(0, 'rgba(120,90,50,0)'); sg.addColorStop(0.5, 'rgba(120,90,50,.35)'); sg.addColorStop(1, 'rgba(120,90,50,0)');
  c.fillStyle = sg; c.fillRect(-2, -5.4, 4, 11);
  bookElephant(c, -4.6, 0.2, 1);
  bookCrab(c, 4.6, 0.3, 1);
  c.fillStyle = 'rgba(120,90,50,.18)'; ell(c, -7, 3, 1.6, 1); c.fill();
  if (flip != null && flip >= 0 && flip < 1){
    // a loose, torn page swings over from right to left
    const ex = 9*Math.cos(flip*Math.PI), lift = Math.sin(flip*Math.PI)*2.2;
    c.fillStyle = flip < 0.5 ? '#f7ecd2' : '#e6d4ae'; c.strokeStyle = 'rgba(120,90,50,.35)'; c.lineWidth = 0.35;
    c.beginPath(); c.moveTo(0, -5); c.lineTo(ex, -6.3 + (ex < 0 ? 0 : 0) - lift); c.lineTo(ex*0.92, 1.2 - lift); c.lineTo(ex*0.7, 2.2 - lift*0.6); c.lineTo(0, 3.2); c.closePath(); c.fill(); c.stroke();
  }
  c.restore();
}
// lying on the ground (seen from above at an angle), with a leaf still stuck to it
function drawGroundBook(){
  const c = ctx, x = S.story.x, y = S.story.y;
  if (S.story.item === 'bee'){
    // V13: the dead bee, with a petal half over it
    c.fillStyle = 'rgba(35,28,12,.28)'; ell(c, x + 1, y + 1, 7, 2.2); c.fill();
    drawDeadBee(c, x, y - 2.5, 1.35, 0.15);
    drawLeaf(c, x - 5, y - 1, 4.5, 2.2, 0, 1, 1, 0.8, 1, 0);
    if (S.story.prog > 0) timers.push({ x, y: y - 30, t: mmss(researchETA()), k: S.story.prog/researchNeed(), on: false });
    return;
  }
  c.save(); c.translate(x, y);
  c.fillStyle = 'rgba(35,28,12,.3)'; ell(c, 1, 1.5, 12, 3.6); c.fill();
  c.rotate(-0.1);
  c.fillStyle = BOOK.page2; c.beginPath(); c.moveTo(-10, -2); c.lineTo(10, -2); c.lineTo(10, 0.6); c.lineTo(-10, 0.6); c.closePath(); c.fill();   // page edges
  c.strokeStyle = 'rgba(120,90,50,.4)'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(-9, -1); c.lineTo(9, -1); c.stroke();
  c.fillStyle = BOOK.cover; c.beginPath(); c.moveTo(-11, -2.4); c.lineTo(10.6, -2.4); c.lineTo(9.4, -10.6); c.lineTo(-10, -10.6); c.closePath(); c.fill();
  c.fillStyle = BOOK.spine; c.beginPath(); c.moveTo(-11, -2.4); c.lineTo(-8.4, -2.4); c.lineTo(-7.6, -10.6); c.lineTo(-10, -10.6); c.closePath(); c.fill();
  c.fillStyle = BOOK.sun; ell(c, 1.2, -6.8, 2.4, 1.5); c.fill();
  c.fillStyle = BOOK.page; c.beginPath(); c.moveTo(10.6, -2.4); c.lineTo(10.2, -5.2); c.lineTo(8.6, -4); c.lineTo(7.4, -2.4); c.closePath(); c.fill();
  c.fillStyle = 'rgba(40,60,60,.22)'; ell(c, -3, -4.6, 3, 1.4); c.fill();
  c.restore();
  drawLeaf(c, x + 6, y - 9, 5.5, 0.6, 1, 1, 1, 0.8, 1, 0);
  if (S.story.prog > 0) timers.push({ x, y: y - 30, t: mmss(researchETA()), k: S.story.prog/researchNeed(), on: false });
}
// ── V13: the dead bee from the prairie: a real one, small and fuzzy, lying on its side with its legs folded
function drawDeadBee(c, x, y, s, rot){
  c.save(); c.translate(x, y); c.rotate(rot || 0); c.scale(s, s);
  // crumpled see-through wings
  c.fillStyle = 'rgba(228,238,242,.7)'; c.strokeStyle = 'rgba(105,115,120,.75)'; c.lineWidth = 0.25;
  c.save(); c.translate(-0.2, -1.3); c.rotate(-0.95); ell(c, -1.7, 0, 2.5, 1.1); c.fill(); c.stroke(); c.restore();
  c.save(); c.translate(0.5, -1.4); c.rotate(-0.3); ell(c, -1.2, 0, 1.9, 0.9); c.fill(); c.stroke(); c.restore();
  // fuzzy striped abdomen
  c.fillStyle = '#6b4a1a'; ell(c, -2, 0.25, 2.8, 2); c.fill();
  c.fillStyle = '#e2a83a'; ell(c, -2.1, 0, 2.6, 1.8); c.fill();
  c.save(); ell(c, -2, 0.25, 2.8, 2); c.clip(); c.fillStyle = '#3a2614'; c.fillRect(-3.7, -2.5, 0.8, 5); c.fillRect(-2.1, -2.5, 0.8, 5); c.fillRect(-0.6, -2.5, 0.7, 5); c.restore();
  c.fillStyle = 'rgba(255,238,175,.6)'; ell(c, -2.5, -1, 1.6, 0.5); c.fill();
  c.fillStyle = '#2a1e14'; c.beginPath(); c.moveTo(-4.7, 0.3); c.lineTo(-5.5, 0.6); c.lineTo(-4.6, 0.9); c.closePath(); c.fill();
  // fuzzy thorax and a dark head
  c.fillStyle = '#4a3218'; ell(c, 1.2, -0.05, 1.6, 1.5); c.fill();
  c.fillStyle = '#c99434'; ell(c, 1.1, -0.5, 1.1, 0.8); c.fill();
  c.fillStyle = '#2a1e14'; ell(c, 3, 0.1, 1.1, 1.05); c.fill();
  c.fillStyle = 'rgba(255,255,255,.45)'; ell(c, 3.25, -0.3, 0.35, 0.3); c.fill();
  // feelers and folded legs
  c.strokeStyle = '#2a1e14'; c.lineWidth = 0.3; c.lineCap = 'round';
  c.beginPath(); c.moveTo(3.4, -0.6); c.quadraticCurveTo(4.2, -1.8, 4.8, -1.4); c.moveTo(3.2, -0.7); c.quadraticCurveTo(3.6, -2, 4.3, -2.2); c.stroke();
  c.beginPath(); for (const lx of [0.3, 1.1, 1.9]){ c.moveTo(lx, 1.1); c.lineTo(lx - 0.5, 1.9); c.lineTo(lx + 0.2, 2.4); } c.stroke();
  c.restore();
}
// what the robots found, carried (closed book / the bee) and studied (open book / the bee under a magnifying glass)
function drawFindClosed(c, x, y, s, rot){ if (S.story.item === 'bee') drawDeadBee(c, x, y + 1, s*0.95, rot); else drawBookClosed(c, x, y, s, rot); }
function drawFindOpen(c, x, y, s, flip, r){
  if (S.story.item !== 'bee'){ drawBookOpen(c, x, y, s, flip); return; }
  c.save(); c.translate(x, y); c.scale(s, s);
  drawDeadBee(c, 0, 1, 1.25, -0.08);
  // a magnifying glass drifting over the bee
  const t = r ? r.anim : 0, lx = Math.sin(t*0.9)*2.2 - 0.6, ly = Math.cos(t*1.3)*1.2 - 1.6;
  c.strokeStyle = '#6e4a30'; c.lineWidth = 1.3; c.lineCap = 'round'; c.beginPath(); c.moveTo(lx + 3.4, ly + 3.4); c.lineTo(lx + 7, ly + 7.6); c.stroke();
  c.fillStyle = 'rgba(220,240,255,.28)'; ell(c, lx, ly, 4.4, 4.4); c.fill();
  c.strokeStyle = '#b8902f'; c.lineWidth = 0.9; ell(c, lx, ly, 4.4, 4.4); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 0.6; c.beginPath(); c.arc(lx, ly, 3.2, -2.7, -1.9); c.stroke();
  c.restore();
}
// ── V13: a letter from the truck driver: a cream envelope with a red wax seal
function drawEnvelope(c, x, y, s, rot){
  c.save(); c.translate(x, y); c.rotate(rot || 0); c.scale(s, s);
  c.fillStyle = 'rgba(60,40,20,.25)'; rr(c, -5.6, -3.4, 12, 8, 1); c.fill();
  c.fillStyle = '#f4e9cf'; rr(c, -6, -4, 12, 8, 1); c.fill();
  c.strokeStyle = '#c9b38a'; c.lineWidth = 0.55; c.beginPath(); c.moveTo(-6, -4); c.lineTo(0, 0.6); c.lineTo(6, -4); c.moveTo(-6, 4); c.lineTo(-1.6, -0.6); c.moveTo(6, 4); c.lineTo(1.6, -0.6); c.stroke();
  c.fillStyle = '#b8452d'; ell(c, 0, 0.5, 1.6, 1.5); c.fill(); c.fillStyle = '#d9663f'; ell(c, -0.4, 0.1, 0.6, 0.5); c.fill();
  c.restore();
}
function drawGroundLetter(l){
  const c = ctx;
  c.save(); c.translate(l.x, l.y);
  c.fillStyle = 'rgba(35,28,12,.28)'; ell(c, 1, 1, 11, 3.2); c.fill();
  c.scale(1, 0.62); c.rotate(-0.12);
  drawEnvelope(c, 0, -4, 1.55, 0);
  c.restore();
}
// a researcher's head: tipped down toward the book, and every so often a curious tilt one way or the other
function headTilt(r){
  if (r.st !== 'study' && r.st !== 'assist' && r.st !== 'pickBook') return 0;
  if (r.st === 'pickBook') return 0.22*Math.sin(clamp(1 - r.timer/1.15, 0, 1)*Math.PI);
  const rate = r.st === 'assist' ? 0.26 : 0.18, u = r.anim*rate + r.id*0.37, ph = u % 1, n = Math.floor(u);
  const cur = ph < 0.22 ? Math.sin(ph/0.22*Math.PI)*((n + r.id) % 2 ? -0.34 : 0.28) : 0;
  return (r.st === 'study' ? 0.2 : 0.05) + cur;
}
let timers = [];
// little paper tags with the time left over the reader (and over the book while it waits on the ground)
function drawTimers(){
  const c = ctx, ts = textScale();
  for (const t of timers){
    const s = w2s(t.x, t.y);
    c.save(); c.translate(s.x, s.y); c.scale(ts, ts); c.globalAlpha = t.on ? 1 : 0.8;
    c.font = '800 13px "Baloo 2", sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle';
    const w = c.measureText(t.t).width + 26, h = 19;
    c.fillStyle = 'rgba(60,30,10,.25)'; rr(c, -w/2, -h/2 + 2, w, h, 9); c.fill();
    c.fillStyle = t.on ? '#f6ead4' : '#e4dccb'; rr(c, -w/2, -h/2, w, h, 9); c.fill();
    c.strokeStyle = t.on ? '#4d6a9c' : '#a39a88'; c.lineWidth = 1.4; rr(c, -w/2, -h/2, w, h, 9); c.stroke();
    // a clock face whose hand goes round while the research runs
    const cx = -w/2 + 10;
    c.fillStyle = '#fbf3e2'; ell(c, cx, 0, 5.4, 5.4); c.fill(); c.strokeStyle = '#7c5d47'; c.lineWidth = 1.1; ell(c, cx, 0, 5.4, 5.4); c.stroke();
    const a = t.on ? S.t*2 : -0.6;
    c.strokeStyle = '#4a3226'; c.lineWidth = 1.1; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx, 0); c.lineTo(cx, -3.2); c.moveTo(cx, 0); c.lineTo(cx + Math.cos(a)*3.6, Math.sin(a)*3.6); c.stroke();
    c.fillStyle = t.on ? '#4a3226' : '#7c6f5f'; c.fillText(t.t, cx + 8, 0.6);
    // progress along the bottom edge
    c.fillStyle = 'rgba(77,106,156,.25)'; rr(c, -w/2 + 6, h/2 - 3.2, w - 12, 2.2, 1); c.fill();
    c.fillStyle = t.on ? '#4d6a9c' : '#8f8a7e'; rr(c, -w/2 + 6, h/2 - 3.2, (w - 12)*clamp(t.k, 0, 1), 2.2, 1); c.fill();
    c.restore();
  }
  timers = [];
}
function drawRobot(r){
  // V13: r.sty / r.cfg let the truck driver (who isn't one of your robots) use the same drawing; r.hz lifts a robot
  // off the ground while it hops in or out of the truck
  const c = ctx, st = r.sty || styleOf(r.id), cfg = r.cfg || S.robots[r.id], hz = r.hz || 0;
  const bw = st.bw, bh = st.bh, hw = st.hw, hh = st.hh, tw = st.tw;
  const top = -8 - bh;
  c.save(); c.translate(r.x, r.y - hz);
  c.fillStyle = 'rgba(35,28,12,' + (hz ? 0.18 : 0.3) + ')'; ell(c, 0, 1 + hz, tw*(hz ? 0.42 : 0.55), hz ? 3.4 : 4.5); c.fill();
  const bob = r.moving ? -Math.abs(Math.sin(r.anim*(st.chunky ? 8 : st.slim ? 13 : 11)))*(st.chunky ? 1 : 1.6) : Math.sin(r.anim*2 + r.id)*0.3;
  c.scale(r.face, 1);
  // treads: they look different for each wheel tier (old wheels, rubber treads, ball-bearing hubs)
  const th = st.chunky ? 12 : 10, md = st.modern;
  drawWheels(c, tw, th, r.moving, r.anim, tierOf(cfg.lv.speed), (r.x + r.y*0.4)*r.face, { md, chunky: st.chunky });
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
  const sooty = cfg && cfg.prio.length && cfg.prio[0].includes('mine');
  if (sooty){
    const rnd = mulberry(r.id*13 + 1);
    const sg = c.createLinearGradient(bw*0.5, 0, -bw*0.1, 0); sg.addColorStop(0, 'rgba(28,24,22,.62)'); sg.addColorStop(1, 'rgba(28,24,22,0)');
    c.save(); rr(c, -bw/2, top, bw, bh, 5); c.clip(); c.fillStyle = sg; c.fillRect(-bw*0.1, top + bh*0.35, bw*0.6, bh*0.65);
    for (let k=0;k<11;k++){ c.fillStyle = 'rgba(28,24,22,' + (0.4 + rnd()*0.3) + ')'; ell(c, bw*0.02 + rnd()*bw*0.46, top + bh*0.2 + rnd()*bh*0.78, 1.2 + rnd()*2.6, 0.9 + rnd()*1.8); c.fill(); }
    c.restore();
  }
  // number plate (the truck driver has a little brown mail badge instead)
  if (st.driver){ c.fillStyle = '#7a5232'; rr(c, bw/2 - 9, -17, 7, 5, 1.2); c.fill(); c.fillStyle = '#f3e7cf'; c.fillRect(bw/2 - 8, -16, 5, 3); c.strokeStyle = '#7a5232'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(bw/2 - 8, -16); c.lineTo(bw/2 - 5.5, -14.4); c.lineTo(bw/2 - 3, -16); c.stroke(); }
  else {
    c.fillStyle = '#efe6d0'; rr(c, bw/2 - 9, -17, 7, 6, 1.2); c.fill();
    c.font = '800 6px "Baloo 2", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#4a3226';
    c.save(); c.translate(bw/2 - 5.5, -13.8); c.scale(r.face, 1); c.fillText(String(r.id + 1), 0, 0.4); c.restore();
  }
  // basket on the back: a tin pail, then a wicker hamper, then a sprung steel hopper, a little bigger with every level
  const cl = cfg.lv.carry, bt = tierOf(cl), bs = 1 + 0.06*(cl - bt*4);
  const BW = [12, 16, 20][bt]*bs, BH = [7, 7, 8][bt]*bs, bx1 = -bw/2 + 13, bx0 = bx1 - BW, by0 = top - 5 - (BH - 7)*0.6;
  if (!st.driver){
  drawBasket(c, bt, bx0, by0, BW, BH, false);
  const n = Math.min(r.carryL, 9 + bt*3), m = Math.min(r.carryM, 6), q = Math.min(r.carryI, 4);
  if (n || m || q){
    const rnd = mulberry(r.id*31 + n + m*7 + q*13), iw = BW - 4;
    for (let i=0;i<n;i++) drawLeaf(c, bx0 + 2 + rnd()*iw, by0 - 2 - rnd()*(1 + n*0.5), 3.4, rnd()*TAU, Math.floor(rnd()*LEAFC.length), rnd()<.5?1:0, 1, 1, 1, 0);
    for (let i=0;i<m;i++) nugget(c, bx0 + 3 + rnd()*(iw - 2), by0 - 2 - rnd()*(1 + m*0.7), 2.6, rnd()*TAU);
    const wq = Math.min(r.wetI || 0, q);   // V14: soaked bundles are drawn dark
    for (let i=0;i<q;i++) drawIngot(c, bx0 + BW/2 + (i%2 ? 2 : -1), by0 + 1 - i*2.4, 8, 0, undefined, i >= q - wq);
  }
  drawBasket(c, bt, bx0, by0, BW, BH, true);
  }
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
  } else if (r.st === 'pickBook'){
    // V12: it reaches down to the book, then lifts it up into its hands
    const k = clamp(1 - r.timer/1.15, 0, 1), ext = k < 0.48 ? Math.sin(k/0.48*Math.PI/2) : Math.max(0, Math.cos((k - 0.48)/0.42*Math.PI/2));
    const lx = (S.story.x - r.x)*r.face, ly = S.story.y - r.y - bob - 4, cx2 = bw/2 + 6, cy2 = top + bh*0.5 - 1;
    const hx = bookRt.held ? lerp(cx2, lx, ext) : sx + (lx - sx)*ext, hy = bookRt.held ? lerp(cy2, ly, ext) : sy + (ly - sy)*ext;
    if (bookRt.held) drawFindClosed(c, hx + 1, hy - 3, 0.9, 0.3*ext);
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(hx, hy); c.stroke();
    c.lineWidth = 1.5; c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + 3, hy + 2.5); c.moveTo(hx, hy); c.lineTo(hx - 1.5, hy + 3.5); c.stroke();
  } else if (r.st === 'toStudy' && bookRt.held && bookRt.by === r.id){
    // carrying the book in its hands, out in front (not in the basket)
    const bx = bw/2 + 6, by = top + bh*0.5 - 1 + (r.moving ? Math.sin(r.anim*10)*0.5 : 0);
    c.save(); c.strokeStyle = shade(md ? '#7f8b92' : '#4a423b', 0.75); c.beginPath(); c.moveTo(sx - 6, sy - 1); c.lineTo(bx - 4, by + 3); c.stroke(); c.restore();
    drawFindClosed(c, bx, by, 0.95, 0.06);
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(bx + 1, by + 4); c.stroke();
    c.fillStyle = armC; ell(c, bx + 1, by + 4, 1.7, 1.5); c.fill(); ell(c, bx - 4, by + 3.5, 1.5, 1.3); c.fill();
  } else if (r.st === 'study' && bookRt.held && bookRt.by === r.id){
    // holding the book open in front of its face, a page turning now and then
    const bx = bw/2 + 9, by = top + bh*0.15 + Math.sin(r.anim*1.3 + r.id)*0.5;
    c.save(); c.strokeStyle = shade(md ? '#7f8b92' : '#4a423b', 0.75); c.beginPath(); c.moveTo(sx - 6, sy - 1); c.lineTo(bx - 6, by + 4.6); c.stroke(); c.restore();
    c.save(); c.translate(bx, by); c.rotate(-0.12); drawFindOpen(c, 0, 0, 0.75, r.flipP, r); c.restore();
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(bx + 5, by + 4.4); c.stroke();
    c.fillStyle = armC; ell(c, bx + 5.4, by + 4.2, 1.7, 1.5); c.fill(); ell(c, bx - 6, by + 4.8, 1.5, 1.3); c.fill();
  } else if (r.st === 'assist'){
    // helping: every so often it points at something in the book
    const h = bookHolder(), u = r.anim*0.21 + r.id*0.29, ph = u % 1, pt = ph > 0.48 && ph < 0.8 ? Math.sin((ph - 0.48)/0.32*Math.PI) : 0;
    if (h && h.st === 'study' && pt > 0.02){
      const b = bookHand(h), tx = (b.x - r.x)*r.face, ty = b.y - r.y - bob, k = 0.78*Math.min(1, pt*1.6);
      const hx = sx + (tx - sx)*k, hy = sy + (ty - sy)*k + Math.sin(r.anim*9)*0.6*pt;
      c.beginPath(); c.moveTo(sx, sy); c.lineTo(hx, hy); c.stroke();
      const a = Math.atan2(ty - sy, tx - sx);
      c.lineWidth = 1.3; c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + Math.cos(a)*4.5, hy + Math.sin(a)*4.5); c.stroke();
      c.fillStyle = armC; ell(c, hx, hy, 1.7, 1.7); c.fill();
    } else { c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + 3, sy + 7); c.stroke(); }
  } else if (r.letter){
    // V13: the truck driver carrying a letter out in front of it
    const bx = bw/2 + 6, by = top + bh*0.5 - 2 + (r.moving ? Math.sin(r.anim*10)*0.5 : 0);
    drawEnvelope(c, bx, by, 0.85, 0.1);
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(bx, by + 3); c.stroke();
    c.fillStyle = armC; ell(c, bx, by + 3, 1.6, 1.4); c.fill();
  } else if (r.st === 'mine' && ART.sawArm) ART.sawArm(c, r, sx, sy);
  else if (r.st === 'mine'){ const a = Math.sin(r.hammer*16)*0.5; c.save(); c.translate(sx, sy); c.rotate(-0.6 + a); c.beginPath(); c.moveTo(0, 0); c.lineTo(12, 0); c.stroke(); c.fillStyle = '#6b7276'; c.fillRect(10, -4, 4, 8); c.restore(); }
  else { c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + 3.5, sy + 7); c.stroke(); }
  // head (V12: researchers tip it toward the book, and tilt it now and then, curious)
  const hx0 = bw/2 - hw + 3, hy0 = top - 3 - hh;
  const tilt = headTilt(r);
  c.save();
  if (tilt){ const px = hx0 + hw*0.45, py = top - 1; c.translate(px, py); c.rotate(tilt); c.translate(-px, -py); }
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
  // V12: a robot with Research upgrades puts on reading glasses while it studies (gold rims once it's a speed reader)
  const sL = cfg.lv.study || 0;
  if (sL && !md && (r.st === 'study' || r.st === 'assist')){
    c.strokeStyle = sL >= 2 ? '#c9a24a' : '#3a2e22'; c.lineWidth = 1; ell(c, ex + .4, ey, 4.4, 4); c.stroke();
    c.fillStyle = 'rgba(220,240,255,.18)'; ell(c, ex + .4, ey, 4, 3.6); c.fill();
    c.beginPath(); c.moveTo(ex - 4, ey - 1); c.lineTo(hx0 + 1, ey - 2); c.stroke();
  }
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
  if (st.driver){
    // V13: the truck driver's flat brown cap, with its peak pointing forward
    c.fillStyle = '#6e4a30'; c.beginPath(); c.ellipse(hx0 + hw/2, hy0 + 1.5, hw/2 + 1.5, hh*0.55, 0, Math.PI, 0); c.closePath(); c.fill();
    c.fillStyle = '#8a6040'; c.beginPath(); c.ellipse(hx0 + hw/2 - 1, hy0 - 1.5, hw/2 - 1, hh*0.32, 0, Math.PI, 0); c.closePath(); c.fill();
    c.fillStyle = '#4f3422'; rr(c, hx0 + hw*0.45, hy0 + 0.2, hw*0.75, 2.4, 1.2); c.fill();
    c.fillStyle = '#d9a43a'; ell(c, hx0 + hw*0.5, hy0 - 0.6, 1.1, 1.1); c.fill();
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
  if (st.hazard || st.driver){ /* the hard hat and the driver's cap have no antenna */ }
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
  if (st.brolly && ART.robotBrolly) ART.robotBrolly(c, r, st, hx0, hy0, hw, bob);   // V14: an umbrella on its head (the hollow)
  c.restore();   // the head's tilt
  c.restore();
  if (r.st === 'study' && bookRt.by === r.id) timers.push({ x: r.x, y: r.y - 98, t: mmss(researchETA()), k: S.story.prog/researchNeed(), on: researchRate() > 0 });
  if (r.st === 'mine' || r.st === 'bag' || r.st === 'jar' || r.st === 'wrap' || r.st === 'smelt'){
    const pr = r.st === 'mine' ? r.mineP : r.workP, col = r.st === 'mine' ? '#f2d27a' : r.st === 'smelt' ? '#ff9b3d' : r.st === 'jar' ? '#ffd23f' : r.st === 'wrap' ? '#e0475a' : '#ffb866';
    c.save(); c.translate(r.x, r.y + top - hh - 22); c.lineWidth = 3; c.lineCap = 'round';
    c.strokeStyle = 'rgba(40,25,10,.35)'; c.beginPath(); c.arc(0, 0, 6, 0, TAU); c.stroke();
    c.strokeStyle = col; c.beginPath(); c.arc(0, 0, 6, -Math.PI/2, -Math.PI/2 + TAU*clamp(pr, 0, 1)); c.stroke();
    c.restore();
  }
  if (r.full) bubbles.push({ x: r.x, y: r.y + top - hh - 18, t: r.carryI && r.st === 'waitI' ? 'pallet full' : r.carryM && !r.carryL ? (r.at === 'metal' && metalTarget(r).hopper ? 'hopper full' : 'metal full') : 'bin full' });
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
    // V14: the hose curls up and holds the handle of the wood umbrella
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
  const bw = G.bw, bh = G.bh, top = G.top, hw = G.hw, hh = G.hh, hx0 = G.hx0, hy0 = G.hy0, hz = h.hz || 0;
  c.save(); c.translate(h.x, h.y - hz);
  c.fillStyle = 'rgba(35,28,12,' + (hz ? 0.18 : 0.3) + ')'; ell(c, 0, 1 + hz, st.tw*0.6, 4.5); c.fill();
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
  if (h.st === 'brolly' && ART.woodUmbrella) ART.woodUmbrella(c, T.x, T.y, st.band, h);
  c.restore();
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
const PAY_COL = { leaf: '#ff9b3d', bag: '#ffb866', honey: '#ffd23f', gift: '#ff8f7a', bonus: '#b5e36d' };
if (ART.PAY_COL) Object.assign(PAY_COL, ART.PAY_COL);
function payFill(c, kind, y0, y1){
  if (ART.payFill) return ART.payFill(c, kind, y0, y1);
  if (kind === 'ingot'){ const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#f4f7f8'); g.addColorStop(0.5, '#b9c4ca'); g.addColorStop(0.52, '#7d8a91'); g.addColorStop(1, '#c9d3d8'); return g; }
  if (kind !== 'metal') return PAY_COL[kind] || '#fff4e0';
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#d5dde1'); g.addColorStop(0.55, '#97a3aa'); g.addColorStop(1, '#e6ecef');
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
  // V13: a robot riding along stands in the back, in front of the load, cut off by the stake sides
  // (V14: a robot and a blower, the robot at the front)
  for (const rd of T.riders) if (rd.st === 'ride'){ c.save(); c.beginPath(); c.rect(-200, BT - 200, 400, 200); c.clip(); c.translate(-T.x, -LANE); if (rd.kind) drawBlower(rd); else drawRobot(rd); c.restore(); }
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
      else if (p.kind === 'honey' && ART.flyHoney) ART.flyHoney(c, x, y);
      else if (p.kind === 'honey'){ c.fillStyle = '#e8931c'; ell(c, x, y, 2.6, 2.2); c.fill(); c.fillStyle = 'rgba(255,236,160,.85)'; ell(c, x - 0.7, y - 0.6, 0.8, 0.7); c.fill(); }
      else if (p.kind === 'bag') drawLeafBag(c, x, y + 5, 12);
      else if (p.kind === 'ingot') drawIngot(c, x, y + 2, 9, Math.sin(t*6)*0.3);
      else if (p.kind === 'book') drawFindClosed(c, x, y - 4, 0.95, Math.sin(t*Math.PI)*0.5);
      else if (p.kind === 'letter') drawEnvelope(c, x, y - 2, 0.9, Math.sin(t*Math.PI)*0.4);
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
    else if (p.k === 'drop'){ const sp = Math.hypot(p.vx, p.vy) || 1, L = 1.6 + sp*0.012; c.strokeStyle = 'rgba(212,226,238,' + a*0.85 + ')'; c.lineWidth = 0.9; c.lineCap = 'round'; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx/sp*L, p.y - p.vy/sp*L); c.stroke(); }   // V14: rain spray
    else if (p.k === 'speck'){ c.fillStyle = p.saw ? 'rgba(226,190,130,' + a*0.9 + ')' : 'rgba(120,110,60,' + a*0.7 + ')'; c.fillRect(p.x - 0.8, p.y - 0.8, 1.6, 1.6); }   // (saw: sawdust)
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
    const PC = ART.popCol || {};
    c.fillStyle = p.kind === 'cash' ? '#ffd56b' : p.kind === 'wet' ? '#a8d4f2' : p.kind === 'metal' ? PC.metal || '#dfe6ea' : p.kind === 'ingot' ? PC.ingot || '#dfe6ea' : p.kind === 'leaf' || p.kind === 'bag' ? '#ffd7a8' : p.kind === 'honey' || p.kind === 'gift' ? '#ffe08a' : '#fff4e0';
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
  if (p.toHud && p.t < SALE_HOLD) return;   // the copy for the goal pill only shows once it leaves the crate
  const ts = textScale(), size = Math.round(p.size*ts), src = w2s(p.x, p.y), dst = p.toHud ? goalPt('honey') : w2s(p.tx, p.ty);
  let x, y, sc, a = 1;
  if (p.toHud){
    const u = clamp((p.t - SALE_HOLD)/(p.life - SALE_HOLD), 0, 1), e = u*u*(3 - 2*u);
    x = lerp(src.x, dst.x, e); y = lerp(src.y + p.oy*ts - 18, dst.y, e) - Math.sin(u*Math.PI)*30*ts; sc = 1 - 0.3*e; a = u > 0.85 ? 1 - (u - 0.85)/0.15*0.8 : 1;
  } else if (p.t < SALE_HOLD){
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
    const t = sayT(b.t), w = c.measureText(t).width + 14, h = 18*ts;
    c.fillStyle = 'rgba(246,234,212,.95)'; rr(c, s.x - w/2, s.y - h/2, w, h, 8); c.fill();
    c.beginPath(); c.moveTo(s.x - 4, s.y + h/2 - 1); c.lineTo(s.x, s.y + h/2 + 5); c.lineTo(s.x + 4, s.y + h/2 - 1); c.fill();
    c.fillStyle = '#a8361d'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, s.x, s.y + 1);
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
  if (researchOpen() && !S.story.opened && !bookRt.held && S.t >= bookRt.landT) groups.book = true;
  S.letters.forEach((l, i) => { if (!l.read) groups['letter' + i] = true; });
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
  if (S.metalSlot && !S.miners.length && !hintDone('miner') && S.cash >= MINER_COST*0.5){ const p = SPOTS[0]; return { id:'miner', x: p.x, y: p.y - 74, t: 'build a miner on the rocks' }; }
  if (S.miners.length && !S.flags.sentHint && !S.flags.taskHint && !hintDone('tasks') && R[0]) return { id:'tasks', x: R[0].x, y: R[0].y - 98, t: 'tap a robot to change its tasks' };
  if (S.hive.built && !S.hive.bees && !hintDone('bees') && S.t - hiveRt.builtT > 1.4) return { id:'bees', x: HIVE.x + 30, y: HIVE.y - hiveTopZ() - 54, t: 'tap the hive to add bees' };
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
  c.lineJoin = 'round'; c.lineWidth = 4; c.strokeStyle = 'rgba(55,30,14,.6)'; c.strokeText(sayT(h.t), s.x, y); c.fillStyle = '#fff4e0'; c.fillText(sayT(h.t), s.x, y);
  c.restore();
}

// ───────────────────────── V14 (from the Rainy hollow test copy): rain, puddles, splashes and wet tracks (LOT.rain)
// None of this changes the game; it's all looks. The rain comes and goes slowly (rainLevel). Drops streak down the
// screen in three depths, splash on the ground and ring the puddles. Puddles reflect whatever stands at or behind their
// edge (robots, helpers, trees, buildings, the truck), mirrored about the thing's foot, with a wobble and the overcast
// sky behind. Driving through one throws up spray and a wake, and the wheels leave wet prints for a while after.
// ?dbg=nopud,norain,nomist,noglow switches layers off for profiling.
const RAIN = { k: RAINY ? 0.7 : 0, drops: [], splash: [], ripples: [], tracks: [], mist: [], acc: 0, sacc: 0, t: 0 };
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
    if (r.st === 'gone' || r.st === 'ride') continue;
    wade(r, r.moving, styleOf(r.id).tw*0.5, dt);
    // now and then a drop splashes off a robot's head (or its umbrella)
    if (!styleOf(r.id).brolly && Math.random() < dt*0.9*R0.k) parts.push({ k:'drop', x: r.x + rand(-6, 6), y: r.y - 8 - styleOf(r.id).bh - styleOf(r.id).hh - 2, vx: rand(-22, 22), vy: rand(-32, -12), g: 260, life: rand(.2, .35), t: 0 });
  }
  for (const h of HB) if (h.st !== 'gone' && h.st !== 'ride') wade(h, h.moving, h.kind === 'blower' ? helperStyle(h).tw*0.5 : 14, dt);
  { const T = truck, on = T.st === 'arrive' || T.st === 'leave';
    if (T.st !== 'away'){ for (const k of [0, 1]){ const w = T._w || (T._w = [{ face: -1 }, { face: -1 }]); const o = w[k]; o.x = T.x + (k ? 44 : -52); o.y = LANE + 4; o.face = T.x > (o.px || T.x) ? 1 : -1; o.px = T.x; wade(o, on, 9, dt, 1.8); } } }
  for (const t of R0.tracks) t.t += dt;
  R0.tracks = R0.tracks.filter(t => t.t < 9);
  if (R0.tracks.length > 500) R0.tracks.splice(0, R0.tracks.length - 500);
  // drifting mist
  if (!R0.mist.length) for (let i=0;i<6;i++) R0.mist.push({ x: Math.random(), y: 0.15 + Math.random()*0.8, s: 0.5 + Math.random()*0.7, v: (Math.random() < .5 ? -1 : 1)*(0.004 + Math.random()*0.006), a: 0.05 + Math.random()*0.05 });
  for (const m of R0.mist){ m.x += m.v*dt; if (m.x < -0.6) m.x = 1.6; if (m.x > 1.6) m.x = -0.6; }
}
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
function reflectables(p){
  const out = [], pad = 6, near = p.y + p.ry + pad, xs = (x, hw) => Math.abs(x - p.x) < p.rx + hw;
  const rch = (y, h) => y < near && y + h > p.y - p.ry;
  for (const r of R) if (r.st !== 'gone' && r.st !== 'ride' && xs(r.x, 26) && rch(r.y, 80)) out.push({ y: r.y, f: () => drawRobot(r) });
  for (const h of HB) if (h.st !== 'gone' && h.st !== 'ride' && xs(h.x, 30) && rch(h.y, h.st === 'brolly' ? 95 : 60)) out.push({ y: h.y, f: () => h.kind === 'blower' ? drawBlower(h) : drawShaker(h) });
  const B2 = [[BIN.x, BIN.y, 50, 70, drawBin], [SHED.x, SHED.y, 60, 105, drawShed], [SIGN.x, SIGN.y, 30, 75, drawSign], [BAGGER.x, BAGGER.y, 34, 50, drawBagger],
              [PALLET.x, PALLET.y, 34, 60, drawPallet], [CRATE.x, CRATE.y, 30, 60, drawHoneyCrate], [HIVE.x, HIVE.y, 44, 110, drawHive], [PLANT.x, PLANT.y, 130, 175, drawPlant]];
  for (const [x, y, hw, hh, f] of B2) if (xs(x, hw) && rch(y, hh)) out.push({ y, f });
  for (const i of S.miners){ const sp = SPOTS[i]; if (xs(sp.x, 60) && rch(sp.y, 110)) out.push({ y: sp.y, f: () => drawMiner(i) }); }
  if (p.road && truck.st !== 'away' && xs(truck.x, 90)) out.push({ y: LANE + 5, f: drawTruck });
  out.sort((a, b) => a.y - b.y);
  return out;
}
const REFL_SQ = 0.86;
function drawPuddles(V){
  const c = ctx, vis = PUDDLES.filter(p => p.x + p.rx > V.x0 && p.x - p.rx < V.x1 && p.y + p.ry > V.y0 && p.y - p.ry < V.y1);
  if (!vis.length) return;
  if (!reflCv || reflCv.width !== cv.width || reflCv.height !== cv.height){ reflCv = document.createElement('canvas'); reflCv.width = cv.width; reflCv.height = cv.height; reflCtx = reflCv.getContext('2d'); }
  const rc = reflCtx, z = cam.z, t = RAIN.t;
  rc.setTransform(1, 0, 0, 1, 0, 0);
  for (const p of vis){ const x0 = DPR*(cam.ox + (p.x - p.rx*1.4)*z), y0 = DPR*(cam.oy + (p.y - p.ry*1.5)*z); rc.clearRect(x0 - 2, y0 - 2, DPR*z*p.rx*2.8 + 4, DPR*z*p.ry*3 + 4); }
  rc.setTransform(DPR*z, 0, 0, DPR*z, DPR*cam.ox, DPR*cam.oy);
  const keep = ctx, pl = parts.length, bl = bubbles.length, tl = timers.length;
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
  parts.length = pl; bubbles.length = bl; timers.length = tl;
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
    // out in the wild the ground is drawn a little darker, and so is the water there
    if (!p.road){ const O = owned(); if (!(p.x > O.x0 && p.x < O.x1 && p.y > O.y0 && p.y < -VERGE)){ c.fillStyle = 'rgba(22,18,10,.26)'; c.fillRect(p.x - p.rx - 4, p.y - p.ry - 4, p.rx*2 + 8, p.ry*2 + 8); } }
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
function drawGlows(){
  const c = ctx, z = cam.z;
  c.setTransform(DPR*z, 0, 0, DPR*z, DPR*cam.ox, DPR*cam.oy);
  c.globalCompositeOperation = 'lighter';
  const glow = (x, y, r, a, col) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(' + (col || '255,170,80') + ',' + a + ')'); g.addColorStop(1, 'rgba(' + (col || '255,170,80') + ',0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r*2, r*2); };
  const fl = 0.85 + Math.sin(RAIN.t*3.1)*0.06 + Math.sin(RAIN.t*7.3)*0.04;
  glow(SHED.x - 28, SHED.y - 44, 46, 0.2*fl); glow(SHED.x - 28, SHED.y + 6, 40, 0.08*fl);
  if (S.hive.built) glow(HIVE.x, HIVE.y - 8, 30, 0.14*fl);
  if (S.plant.built){ const busy = STN.smelt.some(v => v != null && R[v] && R[v].st === 'smelt'); glow(PLANT.x, PLANT.y - 30, 120, (busy ? 0.2 : 0.1)*fl); glow(PLANT.x, PLANT.y + 20, 110, (busy ? 0.12 : 0.06)*fl); }
  for (const r of R) if (r.st !== 'gone' && styleOf(r.id).lantern) glow(r.x, r.y - 40, 26, 0.18*fl);
  if (truck.st !== 'away'){ const hx = truck.x - 82; glow(hx, LANE - 18, 30, 0.22, '255,230,170'); glow(hx - 60, LANE + 4, 70, 0.1, '255,230,170'); }
  c.globalCompositeOperation = 'source-over';
}

function draw(){
  const c = ctx;
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  c.fillStyle = LOT.bg || '#5f6d33'; c.fillRect(0, 0, W, H);
  const G = groundCam, k = cam.z/G.z;
  c.drawImage(groundCv, cam.ox - (G.ox + G.mx)*k, cam.oy - (G.oy + G.my)*k, (W + 2*G.mx)*k, (H + 2*G.my)*k);
  c.setTransform(DPR*cam.z, 0, 0, DPR*cam.z, DPR*cam.ox, DPR*cam.oy);
  const V = visRect(); V.x0 -= 20; V.x1 += 20; V.y0 -= 20; V.y1 += 20;
  if (RAINY){
    // V14: wet tracks and the puddles' water (with their reflections), then what stands up out of the ground over it
    drawTracks(V); if (!DBG.includes('nopud')) drawPuddles(V);
    if (groundTopCv){ c.setTransform(DPR, 0, 0, DPR, 0, 0); c.drawImage(groundTopCv, cam.ox - (G.ox + G.mx)*k, cam.oy - (G.oy + G.my)*k, (W + 2*G.mx)*k, (H + 2*G.my)*k); c.setTransform(DPR*cam.z, 0, 0, DPR*cam.z, DPR*cam.ox, DPR*cam.oy); }
    drawSplashes(V);
  }
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
    { y: salePos().y, f: drawSaleSign }, { y: HIVE.y, f: drawHive }, { y: CRATE.y, f: drawHoneyCrate },
    { y: BAGGER.y, f: drawBagger }, { y: PALLET.y, f: drawPallet }, { y: PLANT.y, f: drawPlant },
  ];
  for (const i of S.miners) list.push({ y: SPOTS[i].y, f: () => drawMiner(i) });
  for (const r of R) if (r.st !== 'ride' && r.st !== 'gone') list.push({ y: r.y, f: () => drawRobot(r) });
  if (researchOpen() && !bookRt.held && S.t >= bookRt.landT) list.push({ y: S.story.y, f: drawGroundBook });
  for (const l of S.letters) list.push({ y: l.y, f: () => drawGroundLetter(l) });
  if (driver && driver.y < LANE - 26) list.push({ y: driver.y, f: () => drawRobot(driver) });
  BUSHES.forEach((b, i) => list.push({ y: b.y, f: () => drawBushObj(i) }));
  // a shaker hugging a trunk is drawn after the tree crowns, so it stays in front of the trunk
  const onTrunk = h => h.kind === 'shaker' && h.st === 'shake' && h.target && h.target.type === 'tree';
  for (const h of HB) if (!onTrunk(h) && h.st !== 'ride' && h.st !== 'gone') list.push({ y: h.y, f: () => h.kind === 'blower' ? drawBlower(h) : drawShaker(h) });
  list.sort((a, b) => a.y - b.y);
  for (const o of list) o.f();
  if (LOT.antsOnGround) drawBees(V);   // V14: the hollow's ants walk on the ground, under the tree crowns
  drawTruck();
  if (driver && driver.y >= LANE - 26) drawRobot(driver);   // the driver on the road side of the truck
  for (const l of leaves){ if (l.st === 'fall' && l.x > V.x0 && l.x < V.x1 && l.y > V.y0 && l.y < V.y1){ const fx = Math.cos(l.ph); drawLeaf(c, l.x, l.y, l.s, l.rot, l.ci, l.sh, Math.abs(fx) < 0.15 ? 0.15*Math.sign(fx || 1) : fx, 1, 1, fx < 0 ? 0.18 : 0); } }
  drawParts();
  TREES.forEach((t, i) => {
    const cc = canopyCvs[i]; if (!cc) return;
    if (t.x + t.r < V.x0 || t.x - t.r > V.x1 || t.y + t.r*1.3 < V.y0 || t.y - t.r > V.y1) return;
    const sh = treeShake[i], sway = reduceMotion ? 0 : Math.sin(S.t*0.7 + i*1.7)*0.012 + wind*0.0004 + (sh > 0 ? Math.sin(sh*26)*0.035*Math.min(1, sh) : 0);
    // canopies fade when a robot or miner is underneath, so nothing gets lost under a tree
    let under = R.some(r => Math.hypot(r.x - t.x, r.y - 30 - t.y) < t.r*0.92) || HB.some(h => !onTrunk(h) && h.st !== 'gone' && Math.hypot(h.x - t.x, h.y - 24 - t.y) < t.r*0.92) || S.miners.some(m => Math.hypot(SPOTS[m].x - t.x, SPOTS[m].y - 30 - t.y) < t.r*0.92);
    if (!under && saleVisible()){ const sp = salePos(); under = Math.hypot(sp.x - t.x, sp.y - 40 - t.y) < t.r*0.95; }
    // the hive stands in front of the little corner tree, so that crown fades when it overlaps the tower
    if (!under && plantShown()){ const px = clamp(t.x, PLANT.x - 100, PLANT.x + 100), py = clamp(t.y, PLANT.y - 150, PLANT.y); under = Math.hypot(px - t.x, py - t.y) < t.r*0.8; }
    if (!under && S.hive.built){ const hx = clamp(t.x, HIVE.x - 22, HIVE.x + 22), hy = clamp(t.y, HIVE.y - hiveTopZ() - 20, HIVE.y - 14); under = Math.hypot(hx - t.x, hy - t.y) < t.r*0.85; }
    treeAlpha[i] = lerp(treeAlpha[i], under ? 0.42 : 0.96, 0.06);
    c.save(); c.translate(t.x, t.y + cc.base); c.rotate(sway); c.translate(0, -cc.base); c.globalAlpha = treeAlpha[i]; c.drawImage(cc.c, -cc.ox, -cc.oy, cc.w, cc.h); c.restore();
  });
  for (const h of HB) if (onTrunk(h)) drawShaker(h);
  if (!LOT.antsOnGround) drawBees(V);
  if (RAINY && !DBG.includes('norain')) drawRain();
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  for (const f of fgLeaves){ const fx = Math.cos(f.ph); drawLeaf(c, f.x, f.y, f.s, f.rot, f.ci, f.sh, Math.abs(fx) < 0.15 ? 0.15 : fx, 1, 0.92, fx < 0 ? 0.2 : 0); }
  c.drawImage(vignetteCv, 0, 0, W, H);
  if (RAINY){ if (!DBG.includes('nomist')) drawMist(); if (!DBG.includes('noglow')) drawGlows(); c.setTransform(DPR, 0, 0, DPR, 0, 0); }
  drawBubbles();
  drawTimers();
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
  updGoalHud(dt);
  updTestPanel();
}
// V13.4: a goal pill: an icon, how far along (12 / 300, or $12 / $100), a thin progress bar, and the goal itself on
// hover or tap. Once reached it turns green with a tick. V14: there can be several at once, stacked (#hGoals); quests
// in a group say what they are right on the pill ("Buy a bigger yard"), and a yes/no quest has no numbers.
function updGoalHud(dt){
  if (goalRt.pending > 0 && !pops.some(p => p.toHud && !p.got)) goalRt.pending = 0;   // nothing in the air any more (a reset or a reload)
  if (goalRt.bumpT > 0) goalRt.bumpT -= dt;
  if (goalRt.tipT > 0) goalRt.tipT -= dt; else goalRt.tip = null;
  const box = $('hGoals'), list = goalList(), want = new Set(list.map(g => g.m.id));
  for (const id in goalRt.els) if (!want.has(id)){ goalRt.els[id].remove(); delete goalRt.els[id]; }
  list.forEach((g, i) => {
    const m = g.m, h = m.hud, id = m.id;
    let el = goalRt.els[id];
    if (!el){
      el = goalRt.els[id] = document.createElement('div'); el.className = 'stat goal'; el.setAttribute('role', 'button'); el.dataset.id = id;
      el.addEventListener('pointerdown', e => { e.stopPropagation(); if (goalRt.tip === id && goalRt.tipT > 0){ goalRt.tip = null; goalRt.tipT = 0; } else { goalRt.tip = id; goalRt.tipT = 3.5; } });
    }
    if (box.children[i] !== el) box.insertBefore(el, box.children[i] || null);
    const v = h.bool ? (g.done ? 1 : 0) : Math.min(h.of, h.val()), k = g.done ? 1 : h.bool ? 0 : clamp(v/h.of, 0, 1);
    const num = h.bool ? '' : g.done && !m.live ? (h.cash ? '$' + h.of.toLocaleString('en-US') : h.of) + ' / ' + (h.cash ? '$' + h.of.toLocaleString('en-US') : h.of)
      : h.cash ? '$' + Math.floor(v).toLocaleString('en-US') + ' / $' + h.of.toLocaleString('en-US') : Math.floor(v) + ' / ' + h.of;
    const goal = sayT(m.goal), named = !!m.group, txt = named ? goal + (num ? ' · ' + num : '') : num;
    const sig = id + '|' + g.done + '|' + goal;
    if (el._sig !== sig){
      el._sig = sig; el._txt = '';
      el.innerHTML = '<span class="gi">' + ic(h.icon) + '</span><span class="gv"></span>' + (g.done ? '<span class="gok">' + ic('tick') + '</span>' : '') +
        '<i class="gbar"><b></b></i><span class="gtip">' + (named ? 'Quest: ' : 'Goal: ') + goal + '</span>';
      el.classList.toggle('done', g.done); el.classList.toggle('named', named); el.classList.toggle('nobar', !!h.bool);
    }
    if (txt !== el._txt){
      el._txt = txt; el.querySelector('.gv').textContent = txt; el.querySelector('.gbar b').style.width = (k*100).toFixed(1) + '%';
      el.setAttribute('aria-label', (named ? 'Quest: ' : 'Goal: ') + goal + (num ? ', ' + num : '') + (g.done ? ', done' : ''));
    }
    el.classList.toggle('bump', goalRt.bumpT > 0 && (id === 'honey' || id === goalRt.doneId));
    el.classList.toggle('open', goalRt.tip === id && goalRt.tipT > 0);
  });
}
// where the number flying up to a goal pill lands (on its icon), in canvas pixels
function goalPt(id){ const el = goalRt.els[id || 'honey'], r = el && el.getBoundingClientRect(); return r && r.width ? { x: r.left + 18, y: r.top + r.height/2 } : { x: 30, y: 70 }; }
// V13.8: tap the cash 3 times within 2 seconds to open the test panel: add money, or trigger the next story step.
const cheat = { n: 0, first: 0, last: 0 };
$('hCash').addEventListener('pointerdown', e => {
  e.stopPropagation();
  const now = performance.now();
  if (now - cheat.last > 2000){ cheat.n = 0; cheat.first = now; }
  cheat.n++; cheat.last = now;
  if (cheat.n >= 3 && now - cheat.first <= 2000){ cheat.n = 0; toggleTestPanel(); }
});
const TEST_AMOUNTS = [10, 100, 500, 1000, 10000, 100000];
function testCash(add){
  S.cash += add; S.peak = Math.max(S.peak || 0, S.cash); cashBumpT = 0.25;
  sfx('coins', add);
  const tgt = s2w(130, 76);
  pop(tgt.x, tgt.y, '+' + cash2(add) + ' (test)', 'cash', 20);
  save();
}
// the next story beat on this lot, as { label, run }, or null when there's nothing left to push along
function nextStep(){
  const st = S.story, callTruck = () => { if (truck.st === 'away') S.truckT = Math.min(S.truckT, 0.3); };
  const li = S.letters.findIndex(l => !l.read);
  if (li >= 0) return { label: 'Read the letter', run: () => readLetter(li) };
  if (S.post.length || driver) return { label: 'Bring the letter now', run: callTruck };
  if (S.trip){
    // V14: everyone who goes in Do, the money in hand, then the truck
    const send = [];
    for (const kind of tripKinds()){ if (tripHolder(kind)) continue; const i = cfgsOf(kind).findIndex(tripFor); if (i < 0) return kind === 'blower' ? { label: 'Build a blower for the trip', run: () => { S.cash += helperCost('blower'); S.peak = Math.max(S.peak, S.cash); buy({ id:'blower', obj:'shed', cost: helperCost('blower') }); } } : null; send.push([kind, i]); }
    if (send.length){
      const names = send.map(([kind, i]) => kind === 'robot' ? styleOf(i).name : helperStyleOf(kind, i).name);
      return { label: 'Send ' + names.join(' and ') + ' on the trip', run: () => { for (const [kind, i] of send){ const c = cfgsOf(kind)[i]; taskRemove(c, 'travel'); c.prio.unshift(['travel']); taskListChanged(kind, i); } callTruck(); } };
    }
    if (!tripCashOK()) return { label: 'Get the travel money', run: () => { S.cash = Math.max(S.cash, S.trip.cash); S.peak = Math.max(S.peak, S.cash); } };
    return { label: 'Call the truck', run: callTruck };
  }
  if (LOT_ID === 'home' && hiveKnown() && !S.hive.built) return { label: 'Build the beehive', run: () => { S.cash += hiveCost(); S.peak = Math.max(S.peak, S.cash); S.flags.hiveShown = true; buy({ id:'hive', obj:'hive', cost: hiveCost() }); } };
  if (GOAL_GROUPS.hollow.show() && !S.flags.hollowLetter) return { label: 'Finish the quests', run: () => {
    if (S.miles.qYard == null) S.miles.qYard = Math.round(S.t); if (S.miles.qMine == null) S.miles.qMine = Math.round(S.t);
    S.cash = Math.max(S.cash, HOLLOW_CASH); S.peak = Math.max(S.peak, S.cash); } };
  const item = st.item || 'book', what = item === 'bee' ? 'the dead bee' : 'the book';
  if (!st.found){
    const mile = MILESTONES.find(m => m.on && (m.lot || 'home') === LOT_ID && m.goal && S.miles[m.id] == null && (m.id === 'book' || m.id === 'bee'));
    if (mile || st.armed) return { label: 'Find ' + what, run: () => {
      if (mile){ S.miles[mile.id] = Math.round(S.t); if (mile.id === 'bee') S.totals.leaves = Math.max(S.totals.leaves || 0, BEE_LEAVES); }
      st.armed = true;
      const r = R.find(q => !q.away && S.robots[q.id] && !S.robots[q.id].away) || R[0]; if (!r) return;
      const O = owned(); findBook(r, { x: clamp(r.x, O.x0 + 40, O.x1 - 40), y: Math.min(FIND_ABOVE - 40, Math.max(O.y0 + 30, r.y)) });
    } };
  }
  if (st.found && !st.done) return { label: 'Finish researching ' + what, run: finishResearch };
  if (LOT_ID === 'home' && S.miles.letter == null) return { label: 'Earn enough for the letter', run: () => { S.totals.cash = Math.max(S.totals.cash || 0, LETTER_EARNED); } };
  if (LOT_ID === 'prairie' && S.miles.honey == null) return { label: 'Earn $' + HONEY_CASH + ' from honey', run: () => { S.totals.honeyCash = Math.max(S.totals.honeyCash || 0, HONEY_CASH); } };
  return null;
}
let testSig = '';
function toggleTestPanel(force){
  let el = $('testPanel');
  if (!el){
    el = document.createElement('div'); el.id = 'testPanel'; el.hidden = true;
    el.innerHTML = '<div class="tph"><b>Test</b><button class="tpx" data-t="close" aria-label="Close">×</button></div><div class="tpm">' +
      TEST_AMOUNTS.map(a => '<button data-t="cash:' + a + '">+' + (a >= 1000 ? (a/1000).toLocaleString('en-US') + 'k' : a) + '</button>').join('') +
      '</div><button class="tpn" data-t="next"></button>';
    el.addEventListener('pointerdown', e => e.stopPropagation());
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const t = b.dataset.t;
      if (t === 'close') toggleTestPanel(false);
      else if (t.startsWith('cash:')) testCash(+t.slice(5));
      else if (t === 'next'){ const n = nextStep(); if (n){ n.run(); showToast('Test', n.label, 3); save(); } testSig = ''; updTestPanel(); }
    });
    document.body.appendChild(el);
  }
  el.hidden = force != null ? !force : !el.hidden;
  testSig = ''; updTestPanel();
}
function updTestPanel(){
  const el = $('testPanel'); if (!el || el.hidden) return;
  const top = Math.round($('hud').getBoundingClientRect().bottom + 10) + 'px'; if (el.style.top !== top) el.style.top = top;   // stays under the cash and goal pill
  const n = nextStep(), sig = n ? n.label : '-';
  if (sig === testSig) return; testSig = sig;
  const b = el.querySelector('.tpn'); b.disabled = !n; b.textContent = n ? 'Next step: ' + n.label : 'No story step left here';
}

// ───────────────────────── cards
// V10 UI rework: cards say less and show more. Numbers come with little pictures (a leaf, a chunk of metal, a jar),
// stock levels are meters, prices are coin buttons that fill up as you save toward them, and the long explanations
// moved into tooltips. Robots get a live portrait, and their task list sits on a tab of its own.
const card = $('card');
let cardOpen = null, cardSig = '', resetArm = false, cardNote = '', cardTab = 'up', fillT = 0;
// ── little pictures (12×12, centred on 0,0), in the yard's colours
const ICON = {
  petal:  '<path d="M0,5 C-4.6,1.6 -4.4,-3.4 -1.6,-5 C-.6,-4.2 .6,-4.2 1.6,-5 C4.4,-3.4 4.6,1.6 0,5Z" fill="#f4a6bf"/><path d="M0,3.6 V-1.6" stroke="#d27f9b" stroke-width=".7" stroke-linecap="round"/>',
  info:   '<circle r="5.2" fill="none" stroke="currentColor" stroke-width="1"/><circle cy="-2.6" r=".8" fill="currentColor"/><path d="M0,-.8 V3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
  tick:   '<path d="M-3.6,0.2 L-1,2.8 L3.8,-2.6" fill="none" stroke="#4f7a2c" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
  leaf:   '<path d="M0,-5 C3,-3.5 3,2.5 0,4 C-3,2.5 -3,-3.5 0,-5Z" fill="#d4672a"/><path d="M0,-3.6V4.6" stroke="#8c3215" stroke-width=".8"/>',
  ore:    '<path d="M-4.5,-1.5 L-1.5,-4.5 L3.5,-3 L4.5,1.5 L1,4.5 L-3.5,3Z" fill="#8f979b"/><path d="M-1.5,-4.5 L3.5,-3 L1,0Z" fill="#c3cbd0"/>',
  bag:    '<path d="M-1,-3.6 C-4.6,-3 -4.8,3.4 -3.4,4.2 Q0,5 3.4,4.2 C4.8,3.4 4.6,-3 1,-3.6Z" fill="#d4672a"/><ellipse cx="-1" cy="-4.6" rx="1.2" ry=".6" fill="#b8551c"/><ellipse cx="1" cy="-4.6" rx="1.2" ry=".6" fill="#b8551c"/>',
  jar:    '<rect x="-3.6" y="-2.6" width="7.2" height="7.6" rx="2" fill="#eba53a"/><path d="M-4.2,-2.2 Q-4.6,-5.4 -2.6,-5.2 H2.6 Q4.6,-5.4 4.2,-2.2Z" fill="#b8392a"/><rect x="-2" y="-.2" width="4" height="2.6" rx=".5" fill="#fff3d9" opacity=".8"/>',
  wrap:   '<rect x="-3.6" y="-1.6" width="7.2" height="6.6" rx="1.8" fill="#eba53a"/><path d="M-4.8,-1.2 L-3.4,-4.8 H3.4 L4.8,-1.2Z" fill="#b8392a"/><rect x="-.7" y="-1.4" width="1.4" height="6.4" fill="#2f6fb5"/><ellipse cx="-2.1" cy="-1.5" rx="2.1" ry="1.3" fill="#2f6fb5"/><ellipse cx="2.1" cy="-1.5" rx="2.1" ry="1.3" fill="#2f6fb5"/><circle cy="-1.4" r=".9" fill="#1f4f86"/>',
  gift:   '<rect x="-3.6" y="-1.6" width="7.2" height="6.6" rx="1.8" fill="#eba53a"/><path d="M-4.8,-1.2 L-3.4,-4.8 H3.4 L4.8,-1.2Z" fill="#efdcbc"/><path d="M-3.4,-4.8 L-1.7,-1.2 M0,-4.8 V-1.2 M3.4,-4.8 L1.7,-1.2" stroke="#c96f4a" stroke-width=".6"/><path d="M-4.2,-1.4 H4.2" stroke="#7a5230" stroke-width=".9"/><path d="M3.6,-1.4 L5,1.6" stroke="#7a5230" stroke-width=".6"/><rect x="-1.7" y=".9" width="3.4" height="2.3" rx=".4" fill="#fff3d9"/>',
  ingot:  '<path d="M-5.2,3.4 H5.2 L3.6,-1.4 H-3.6Z" fill="#9aa4aa"/><path d="M-3.6,-1.4 H3.6 L2.6,-3.4 H-2.6Z" fill="#dfe5e8"/><path d="M-4.4,3 L-3.1,-.8" stroke="#fff" stroke-opacity=".55" stroke-width=".7"/>',
  gold:   '<path d="M-5.2,3.4 H5.2 L3.6,-1.4 H-3.6Z" fill="#d4a23a"/><path d="M-3.6,-1.4 H3.6 L2.6,-3.4 H-2.6Z" fill="#f6dc8c"/><path d="M-4.4,3 L-3.1,-.8" stroke="#fff" stroke-opacity=".6" stroke-width=".7"/>',
  basket: '<path d="M-3.4,-1.6 Q0,-6.8 3.4,-1.6" fill="none" stroke="#8a5a2e" stroke-width="1.1"/><path d="M-5,-1.6 H5 L3.8,4.6 H-3.8Z" fill="#c98f4c"/><path d="M-4.6,.6 H4.6 M-4.2,2.6 H4.2" stroke="#9a6532" stroke-width=".7"/><path d="M-1.8,-1.6 L-1.4,4.6 M1.8,-1.6 L1.4,4.6" stroke="#9a6532" stroke-width=".6"/><rect x="-5.5" y="-2.4" width="11" height="1.7" rx=".8" fill="#a8703a"/>',
  bee:    '<path d="M-1.2,-1.6 C-3.6,-6 -6.4,-3.4 -2.6,-.6Z M1.2,-1.6 C3.6,-6 6.4,-3.4 2.6,-.6Z" fill="#d9eef4" stroke="#7fa6b2" stroke-width=".5"/><ellipse cx="0" cy="1.4" rx="3.3" ry="3.8" fill="#f2c230"/><path d="M-3.1,.4 H3.1 M-2.6,2.8 H2.6" stroke="#3a2e22" stroke-width="1.1"/><circle cx="0" cy="-2.6" r="1.6" fill="#3a2e22"/>',
  nectar: '<path d="M0,-5 C2.6,-1.6 3.8,.6 3.8,2 A3.8,3.8 0 0 1 -3.8,2 C-3.8,.6 -2.6,-1.6 0,-5Z" fill="#f0b43c"/><path d="M-1.9,1.4 A1.9,1.9 0 0 0 0,3.5" stroke="#fff4c8" stroke-width=".9" fill="none" stroke-linecap="round"/>',
  honey:  '<path d="M0,-5.2 L4.5,-2.6 V2.6 L0,5.2 L-4.5,2.6 V-2.6Z" fill="#e8a83a"/><path d="M0,-2.5 L2.2,-1.25 V1.25 L0,2.5 L-2.2,1.25 V-1.25Z" fill="#c67d1e"/>',
  truck:  '<rect x="-5.8" y="-3.8" width="7" height="5.6" rx=".8" fill="#c98f4c"/><path d="M-5.8,-1.6 H1.2" stroke="#a8703a" stroke-width=".6"/><path d="M1.6,-1.9 H3.9 L5.8,.4 V1.8 H1.6Z" fill="#5f8c87"/><path d="M2.4,-1.1 H3.6 L4.7,.3 H2.4Z" fill="#d6ecea"/><circle cx="-3.2" cy="2.6" r="1.7" fill="#3a2e22"/><circle cx="3.5" cy="2.6" r="1.7" fill="#3a2e22"/><circle cx="-3.2" cy="2.6" r=".6" fill="#c3cbd0"/><circle cx="3.5" cy="2.6" r=".6" fill="#c3cbd0"/>',
  clock:  '<circle r="5" fill="#fbf3e2" stroke="#7c5d47" stroke-width="1.2"/><path d="M0,-3 V0 L2,1.4" stroke="#4a3226" stroke-width="1.1" fill="none" stroke-linecap="round"/>',
  coin:   '<circle r="5.4" fill="#c9922c"/><circle r="4.4" fill="#e8b84e"/><circle r="3" fill="none" stroke="#c9922c" stroke-width=".8"/><path d="M-2.4,-1.9 A3,3 0 0 1 .5,-2.9" stroke="#fbe3a0" stroke-width=".9" fill="none" stroke-linecap="round"/>',
  wheel:  '<circle r="5.3" fill="#3f3730"/><circle r="3.3" fill="#d4672a"/><circle r="1.1" fill="#fbf3e2"/><path d="M0,-5.3 V-4 M0,5.3 V4 M-5.3,0 H-4 M5.3,0 H4 M-3.75,-3.75 L-2.85,-2.85 M3.75,3.75 L2.85,2.85 M3.75,-3.75 L2.85,-2.85 M-3.75,3.75 L-2.85,2.85" stroke="#7a6d62" stroke-width="1"/>',
  pick:   '<path d="M0,5.4 V.6" stroke="#7d868c" stroke-width="1.8" stroke-linecap="round"/><path d="M0,.4 C-3.8,-.2 -4.2,-3.4 -2.4,-5.2 M0,.4 C3.8,-.2 4.2,-3.4 2.4,-5.2" stroke="#d4672a" stroke-width="1.5" fill="none" stroke-linecap="round"/><circle cy=".4" r="1.5" fill="#4a423b"/><path d="M-5.6,3 H-3.6 M-5.6,4.8 H-3" stroke="#a08670" stroke-width=".8" stroke-linecap="round"/>',
  claw:   '<path d="M0,5.6 V-.4" stroke="#8a6040" stroke-width="1.5" stroke-linecap="round"/><path d="M-4.4,-.4 H4.4" stroke="#7d868c" stroke-width="1.5" stroke-linecap="round"/><path d="M-4.4,-.4 C-4.6,-2.6 -4.2,-3.8 -3.6,-4.8 M-1.5,-.4 V-5.2 M1.5,-.4 V-5.2 M4.4,-.4 C4.6,-2.6 4.2,-3.8 3.6,-4.8" stroke="#7d868c" stroke-width="1.1" stroke-linecap="round" fill="none"/>',
  reach:  '<path d="M-5,4.6 L-1.6,1.2" stroke="#6d777d" stroke-width="2.4" stroke-linecap="round"/><path d="M-1.6,1.2 L1.6,-2" stroke="#a8b1b6" stroke-width="1.6" stroke-linecap="round"/><path d="M1,-4.4 L3.6,-1.8 M2.2,-5.4 L4.8,-2.8" stroke="#d4672a" stroke-width="1.2" stroke-linecap="round"/>',
  drill:  '<rect x="-1.8" y="-5.4" width="3.6" height="3.4" rx=".6" fill="#d4672a"/><path d="M-2,-2 H2 L0,5.4Z" fill="#9aa4aa"/><path d="M-1.6,-.4 L1.4,.4 M-1.1,1.5 L1,2.1 M-.6,3.2 L.5,3.6" stroke="#5b6469" stroke-width=".6"/>',
  magnet: '<path d="M-3.8,4.6 V-.4 A3.8,3.8 0 0 1 3.8,-.4 V4.6 H1.4 V-.4 A1.4,1.4 0 0 0 -1.4,-.4 V4.6Z" fill="#c4452f"/><rect x="-3.8" y="2.8" width="2.4" height="1.8" fill="#dfe5e8"/><rect x="1.4" y="2.8" width="2.4" height="1.8" fill="#dfe5e8"/>',
  pack:   '<rect x="-4.8" y="-3.4" width="9.6" height="8" rx=".8" fill="#c98f4c"/><path d="M-4.8,-.8 H4.8" stroke="#a8703a" stroke-width=".6"/><rect x="-1.1" y="-3.4" width="2.2" height="8" fill="#efdcbc"/><path d="M-3.6,-5.2 L0,-3.4 L3.6,-5.2" stroke="#a8703a" stroke-width=".8" fill="none"/>',
  blow:   '<path d="M-5,-2 Q0,-4.5 3,-2 M-5,1 Q1,-1.5 5,1 M-4,4 Q0,2 3,4" stroke="#4f7c84" stroke-width="1.3" fill="none" stroke-linecap="round"/>',
  shake:  '<circle cx="0" cy="-1.5" r="3.8" fill="#c96a22"/><path d="M0,2.3V5.4" stroke="#6e4a30" stroke-width="1.4"/><path d="M-5.6,-3 l1,1.5 M5.6,-3 l-1,1.5" stroke="#6f7d3c" stroke-width="1" stroke-linecap="round"/>',
  snip:   '<circle cx="-2.6" cy="3.1" r="1.8" fill="none" stroke="#c4452f" stroke-width="1.2"/><circle cx="2.6" cy="3.1" r="1.8" fill="none" stroke="#c4452f" stroke-width="1.2"/><path d="M-1.6,1.7 L2.4,-5 M1.6,1.7 L-2.4,-5" stroke="#9aa4aa" stroke-width="1.3" stroke-linecap="round"/>',
  flower: '<circle cx="0" cy="-1.5" r="1.6" fill="#f2c14e"/><g fill="#9e7ad0"><circle cx="0" cy="-4.4" r="1.4"/><circle cx="2.8" cy="-1.5" r="1.4"/><circle cx="-2.8" cy="-1.5" r="1.4"/><circle cx="0" cy="1.4" r="1.4"/></g><path d="M0,3V5.6" stroke="#56652c" stroke-width="1"/>',
  dig:    '<rect x="-4.6" y="1" width="9.2" height="3.6" rx="1" fill="#3a2a1e"/><path d="M-2,-5 L-2,1 M2,-5 L2,1" stroke="#8a6040" stroke-width="1.2"/><circle cx="0" cy="-4" r="2" fill="none" stroke="#4a423b" stroke-width="1"/>',
  stoke:  '<path d="M-5,-1 L1,-3.4 L1,1.4 Z" fill="#8a6040"/><path d="M1,-1 H5" stroke="#4a423b" stroke-width="1.2"/><path d="M3.4,2.4 C4.8,3.6 4,5.2 3,5.2 C2,5.2 1.6,3.8 3.4,2.4Z" fill="#e2702a"/>',
  flame:  '<path d="M0,-5.4 C2.6,-2.4 3.8,0 3.2,2 C2.6,4.4 -2.6,4.4 -3.2,2 C-3.8,0 -1.6,-1.4 0,-5.4Z" fill="#e2702a"/><path d="M0,-1 C1.4,.6 1.6,2 1,3 C.4,3.8 -1,3.6 -1.2,2.6 C-1.4,1.4 -.4,.6 0,-1Z" fill="#ffd36b"/>',
  haul:   '<path d="M-5,2.6 H5 L3.8,-.4 H-3.8Z" fill="#6d777d"/><path d="M-3.8,-.4 H3.8 L3,-2 H-3Z" fill="#c3cbd0"/><path d="M-4,4.6 H4" stroke="#5f8c87" stroke-width="1.2" stroke-linecap="round"/>',
  lock:   '<path d="M-2.5,-.6 V-2.2 A2.5,2.5 0 0 1 2.5,-2.2 V-.6" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="-4" y="-.8" width="8" height="6" rx="1.3" fill="currentColor"/><circle cy="1.7" r=".9" fill="#fbf3e2"/>',
  check:  '<path d="M-3.8,.2 L-1.1,2.9 L4,-2.8" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  robot:  '<path d="M0,-3.8 V-5.2" stroke="#4a423b" stroke-width=".8"/><circle cy="-5.5" r=".95" fill="#d4672a"/><rect x="-4.6" y="-4" width="9.2" height="6.8" rx="2" fill="#e0d4b8" stroke="#a39376" stroke-width=".6"/><rect x="-4.6" y="-.3" width="9.2" height="1.5" fill="#5f8f88"/><circle cx="1.4" cy="-2" r="1.3" fill="#3a2e22"/><circle cx="1.6" cy="-2.2" r=".5" fill="#ffb347"/><rect x="-4.2" y="3" width="8.4" height="2.5" rx="1.1" fill="#4a423b"/>',
  tub:    '<path d="M-5,-2 H5 L4,4.6 H-4Z" fill="#9aa4aa"/><ellipse cy="-2" rx="5" ry="1.4" fill="#c3cbd0"/><path d="M-4.5,1.2 H4.5" stroke="#6d777d" stroke-width=".7"/><path d="M-2.8,-2.4 L-1.2,-4 L1,-3.4 L2.6,-2.2Z" fill="#7d868c"/>',
  bin:    '<rect x="-5" y="-2" width="10" height="6.8" rx=".6" fill="#a8703a"/><path d="M-5,.3 H5 M-5,2.6 H5" stroke="#8a5a2e" stroke-width=".6"/><path d="M-4.2,-2 C-3.4,-4.8 -1.2,-4.4 -.2,-2.8 C.8,-5 3.2,-4.6 4.2,-2Z" fill="#d4672a"/>',
  hopper: '<path d="M-5,-4.4 H5 L1.4,.8 V4.8 H-1.4 V.8Z" fill="#7d868c"/><path d="M-3.4,-3.8 L-1.6,-5 L.4,-4.3 L2.6,-4.8 L3.6,-3.8Z" fill="#c3cbd0"/>',
  pallet: '<rect x="-5.4" y="2" width="10.8" height="1.4" fill="#a8703a"/><rect x="-5" y="3.4" width="1.6" height="1.8" fill="#8a5a2e"/><rect x="-.8" y="3.4" width="1.6" height="1.8" fill="#8a5a2e"/><rect x="3.4" y="3.4" width="1.6" height="1.8" fill="#8a5a2e"/><path d="M-4.6,2 H-.2 L-.9,-.4 H-3.9Z M.2,2 H4.6 L3.9,-.4 H.9Z M-2.2,-.4 H2.2 L1.5,-2.8 H-1.5Z" fill="#b9c2c7"/>',
  fan:    '<g fill="#4f7c84"><path d="M0,0 C-1.2,-3 .8,-5.6 2.6,-4.4 C3.4,-3.2 1.6,-1 0,0Z"/><path d="M0,0 C-1.2,-3 .8,-5.6 2.6,-4.4 C3.4,-3.2 1.6,-1 0,0Z" transform="rotate(120)"/><path d="M0,0 C-1.2,-3 .8,-5.6 2.6,-4.4 C3.4,-3.2 1.6,-1 0,0Z" transform="rotate(240)"/></g><circle r="1.2" fill="#3a2e22"/>',
  wings:  '<path d="M0,1 C-3,-4.4 -6.2,-2.2 -4.8,1.4 C-3.8,3.6 -1,2.8 0,1Z M0,1 C3,-4.4 6.2,-2.2 4.8,1.4 C3.8,3.6 1,2.8 0,1Z" fill="#d9eef4" stroke="#6f9aa8" stroke-width=".6"/><path d="M0,-1.2 V4.4" stroke="#3a2e22" stroke-width="1.5" stroke-linecap="round"/>',
  three:  '<circle cx="-3" cy="2" r="2.1" fill="#9e7ad0"/><circle cx="3" cy="2" r="2.1" fill="#e07a9a"/><circle cx="0" cy="-2.8" r="2.1" fill="#e2702a"/><circle cx="-3" cy="2" r=".8" fill="#f2c14e"/><circle cx="3" cy="2" r=".8" fill="#f2c14e"/><circle cx="0" cy="-2.8" r=".8" fill="#f2c14e"/>',
  tongue: '<path d="M-1,-4.6 C1.4,-1.6 2.6,.4 2.6,1.8 A3.6,3.6 0 0 1 -4.6,1.8 C-4.6,.4 -3.4,-1.6 -1,-4.6Z" fill="#f0b43c"/><path d="M3.8,-5 V-1.4 M2,-3.2 H5.6" stroke="#6f8a3a" stroke-width="1.3" stroke-linecap="round"/>',
  recipe: '<rect x="-4" y="-5" width="8" height="10" rx="1" fill="#fbf3e2" stroke="#a8703a" stroke-width=".7"/><path d="M-2.4,-2.6 H2.4 M-2.4,-.6 H2.4 M-2.4,1.4 H.6" stroke="#a8703a" stroke-width=".7"/><circle cx="2" cy="3" r="1.4" fill="#eba53a"/>',
  nursery:'<path d="M0,-5.2 L4.5,-2.6 V2.6 L0,5.2 L-4.5,2.6 V-2.6Z" fill="#f4d9a0" stroke="#c67d1e" stroke-width=".8"/><path d="M0,2.6 C-3.2,.4 -2.8,-2.4 -1.1,-2.1 C-.5,-2 0,-1.4 0,-.9 C0,-1.4 .5,-2 1.1,-2.1 C2.8,-2.4 3.2,.4 0,2.6Z" fill="#e0705a"/>',
  oil:    '<path d="M-4.8,-.8 H1.4 V4.8 H-4.8Z" fill="#c4452f"/><path d="M1.4,.4 L5.2,-3.2" stroke="#7d868c" stroke-width="1.3" stroke-linecap="round"/><path d="M-3.4,-.8 V-2.8 H-.8 V-.8" fill="none" stroke="#7d868c" stroke-width="1"/><path d="M5,-1.8 C5.7,-.8 5.5,.2 4.9,.2 C4.3,.2 4.3,-.8 5,-1.8Z" fill="#c9a13a"/>',
  blueprint:'<rect x="-5" y="-4" width="10" height="8" rx=".6" fill="#3f6f8f"/><path d="M-3.4,-2 H1 M-3.4,0 H3.4 M-3.4,2 H.4" stroke="#cfe3ef" stroke-width=".7"/><circle cx="2.6" cy="-1.8" r="1.2" fill="none" stroke="#cfe3ef" stroke-width=".7"/>',
  drop:   '<path d="M0,-5 C2.6,-1.6 3.8,.6 3.8,2 A3.8,3.8 0 0 1 -3.8,2 C-3.8,.6 -2.6,-1.6 0,-5Z" fill="#6b5a2a"/><path d="M-1.9,1.4 A1.9,1.9 0 0 0 0,3.5" stroke="#c9b27a" stroke-width=".9" fill="none" stroke-linecap="round"/>',
  market: '<path d="M-5.2,-1 L-4,-4.8 H4 L5.2,-1Z" fill="#fbf3e2"/><path d="M-2.6,-4.8 L-3.1,-1 M0,-4.8 V-1 M2.6,-4.8 L3.1,-1" stroke="#c4452f" stroke-width="1.5"/><rect x="-4.6" y="-1" width="1" height="5.8" fill="#8a5a2e"/><rect x="3.6" y="-1" width="1" height="5.8" fill="#8a5a2e"/><rect x="-3.6" y="1.4" width="7.2" height="1.8" fill="#a8703a"/>',
  horseshoe:'<path d="M-3.8,-4.6 V.4 A3.8,3.8 0 0 0 3.8,.4 V-4.6 H1.6 V.4 A1.6,1.6 0 0 1 -1.6,.4 V-4.6Z" fill="#d4a23a"/><circle cx="-2.7" cy="-2.6" r=".45" fill="#7a5a1e"/><circle cx="2.7" cy="-2.6" r=".45" fill="#7a5a1e"/><circle cx="-2.4" cy="1.6" r=".45" fill="#7a5a1e"/><circle cx="2.4" cy="1.6" r=".45" fill="#7a5a1e"/>',
  land:   '<path d="M-5.4,-1.6 H5.4 M-5.4,2 H5.4" stroke="#8a5a2e" stroke-width="1.1"/><path d="M-4.6,-4.6 L-3.8,-5.4 L-3,-4.6 V5 H-4.6Z M-.8,-4.6 L0,-5.4 L.8,-4.6 V5 H-.8Z M3,-4.6 L3.8,-5.4 L4.6,-4.6 V5 H3Z" fill="#c98f4c"/>',
  vein:   '<path d="M-4.5,-.5 L-1.5,-3.5 L3.5,-2 L4.5,2.5 L1,5 L-3.5,4Z" fill="#8f979b"/><path d="M-1.5,-3.5 L3.5,-2 L1,1Z" fill="#c3cbd0"/><path d="M-3.6,-5.6 V-2.4 M-5.2,-4 H-2" stroke="#f2c230" stroke-width=".9" stroke-linecap="round"/>',
  shaft:  '<path d="M-4,5 L0,-3.6 L4,5" stroke="#6e4a30" stroke-width="1.1" fill="none"/><path d="M-2.6,2 H2.6" stroke="#6e4a30" stroke-width=".8"/><circle cy="-3.4" r="2" fill="#fbf3e2" stroke="#4a423b" stroke-width="1"/><rect x="-5.2" y="3.8" width="10.4" height="1.6" rx=".4" fill="#3a2a1e"/>',
  note:   '<path d="M-1.2,3 V-4 L4,-5 V2" stroke="#4a3226" stroke-width="1.1" fill="none"/><ellipse cx="-2.6" cy="3.2" rx="1.8" ry="1.3" fill="#4a3226"/><ellipse cx="2.6" cy="2.2" rx="1.8" ry="1.3" fill="#4a3226"/>',
  wrench: '<path d="M-4.4,4.4 L1,-1" stroke="#7d868c" stroke-width="2" stroke-linecap="round"/><path d="M1.2,-4.8 A3,3 0 1 0 4.8,-1.2 L3,-.8 L.8,-3Z" fill="#7d868c"/>',
  list:   '<path d="M-1.6,-3.4 H5 M-1.6,0 H5 M-1.6,3.4 H5" stroke="#7c5d47" stroke-width="1.3" stroke-linecap="round"/><circle cx="-4.2" cy="-3.4" r="1.1" fill="#d4672a"/><circle cx="-4.2" cy="0" r="1.1" fill="#d4672a"/><circle cx="-4.2" cy="3.4" r="1.1" fill="#d4672a"/>',
  cleanup:'<circle r="5.2" fill="#6f8a3a"/><circle r="4" fill="none" stroke="#c9dca0" stroke-width=".6" stroke-dasharray="1 1"/><path d="M0,-3 C2,-2 2,1.6 0,2.6 C-2,1.6 -2,-2 0,-3Z" fill="#f6ead4"/>',
  slag:   '<path d="M-5.2,4 H3.4 L2,0 H-3.8Z" fill="#9aa4aa"/><path d="M-3.8,0 H2 L1.2,-1.6 H-3Z" fill="#dfe5e8"/><path d="M4,-5 V-1.4 M2.2,-3.2 H5.8" stroke="#6f8a3a" stroke-width="1.3" stroke-linecap="round"/>',
  sound:  '<path d="M-5,-2 H-2.4 L1,-4.8 V4.8 L-2.4,2 H-5Z" fill="#4a3226"/><path d="M3,-2.4 A3.4,3.4 0 0 1 3,2.4" stroke="#4a3226" stroke-width="1.2" fill="none" stroke-linecap="round"/>',
};
// V12: the old picture book, and the workshop's blower (an elephant) and shaker (a crab)
ICON.book = '<path d="M0,-3.4 L-5.4,-4.6 V3.8 L0,5 L5.4,3.8 V-4.6Z" fill="#3b6268"/><path d="M0,-2.8 L-4.7,-3.9 V3.2 L0,4.3Z" fill="#f3e6c8"/><path d="M0,-2.8 L4.7,-3.9 V1 L3.9,1.6 L4.4,2.4 L3.3,3.5 L0,4.3Z" fill="#efe0bd"/><path d="M0,-2.9 V4.4" stroke="#8a6a46" stroke-width=".5"/>' +
  '<ellipse cx="-2.4" cy=".6" rx="1.5" ry="1.1" fill="#9aa3ab"/><circle cx="-3.6" cy="-.2" r=".8" fill="#a9b2b9"/><ellipse cx="2.4" cy="1" rx="1.3" ry=".8" fill="#e2702a"/><circle cx="1.3" cy="-.3" r=".55" fill="#e2702a"/><circle cx="3.5" cy="-.3" r=".55" fill="#e2702a"/>';
ICON.research = ICON.book;
// V13: letters from the truck driver, the trip to another lot, and the dead bee
ICON.letter = '<rect x="-5.4" y="-3.8" width="10.8" height="7.6" rx=".8" fill="#f4e9cf" stroke="#a8875a" stroke-width=".6"/><path d="M-5.2,-3.5 L0,.6 L5.2,-3.5" stroke="#a8875a" stroke-width=".6" fill="none"/><circle cy=".7" r="1.4" fill="#b8452d"/>';
ICON.travel = ICON.truck;
ICON.deadbee = '<g transform="rotate(-10)"><ellipse cx="-1.6" cy=".4" rx="3.2" ry="2.3" fill="#e2a83a"/><path d="M-3.4,-1.8 v4.4 M-1.6,-1.9 v4.6 M.1,-1.6 v4" stroke="#3a2614" stroke-width=".9"/><ellipse cx="2.3" cy="0" rx="1.7" ry="1.6" fill="#4a3218"/><circle cx="4.3" cy=".2" r="1.2" fill="#2a1e14"/><ellipse cx="-.6" cy="-2.6" rx="2.4" ry="1.2" fill="#e4eef2" stroke="#7d878c" stroke-width=".35" transform="rotate(-25 -.6 -2.6)"/><path d="M1.2,1.6 l-.6,1.3 M2.4,1.6 l-.4,1.4" stroke="#2a1e14" stroke-width=".45"/></g>';
if (LOT.ICON) Object.assign(ICON, LOT.ICON);
ICON.elephant = '<path d="M-1.8,-1.6 C-1,-4.6 3.6,-4.8 4.8,-1.6 C5.8,1 5,3.4 4.2,4.6 H3 V3.2 H.6 V4.6 H-.6 V2.6 C-1.4,2.2 -1.8,1.2 -1.8,.4Z" fill="#9aa3ab"/>' +
  '<circle cx="-2.4" cy="-1.4" r="2.6" fill="#a9b2b9"/><path d="M-4.6,-.6 C-5.6,.8 -5.6,2.6 -4.6,3.6 C-4.2,4 -3.6,3.8 -3.8,3.2 C-4.3,2.4 -4.2,1.2 -3.6,.2" fill="#a9b2b9"/>' +
  '<ellipse cx="-1.2" cy="-1.2" rx="1.5" ry="2.1" fill="#8a939b"/><ellipse cx="-1.1" cy="-1.1" rx=".8" ry="1.3" fill="#d9a3a6"/><circle cx="-3.4" cy="-2.1" r=".5" fill="#3a2e22"/>' +
  '<path d="M-5.6,5.2 Q-5.2,4.5 -4.4,4.8 M-5.9,3.3 Q-6.2,2.6 -5.6,2.1" stroke="#4f7c84" stroke-width=".7" fill="none" stroke-linecap="round"/>';
ICON.crab = '<path d="M-2.6,1.6 L-5,2.6 M-2.4,2.6 L-4.4,4.4 M2.6,1.6 L5,2.6 M2.4,2.6 L4.4,4.4 M-2.2,-.2 L-3.8,-2.2 M2.2,-.2 L3.8,-2.2" stroke="#c4452f" stroke-width=".9" stroke-linecap="round"/>' +
  '<ellipse cy="1.2" rx="3.7" ry="2.5" fill="#e2702a"/><ellipse cx="-.9" cy=".4" rx="1.4" ry=".7" fill="#f09a5a" opacity=".7"/>' +
  '<path d="M-4.2,-1.4 C-6.4,-2.2 -6.2,-5.4 -4,-5.4 L-3.6,-3.6 L-2.6,-4.6 C-2.2,-2.8 -2.8,-1.4 -4.2,-1.4Z M4.2,-1.4 C6.4,-2.2 6.2,-5.4 4,-5.4 L3.6,-3.6 L2.6,-4.6 C2.2,-2.8 2.8,-1.4 4.2,-1.4Z" fill="#e2702a"/>' +
  '<path d="M-.9,-.9 V-2.6 M.9,-.9 V-2.6" stroke="#c4452f" stroke-width=".6"/><circle cx="-.9" cy="-2.8" r=".75" fill="#3a2e22"/><circle cx=".9" cy="-2.8" r=".75" fill="#3a2e22"/><circle cx="-.7" cy="-3" r=".25" fill="#fff"/><circle cx="1.1" cy="-3" r=".25" fill="#fff"/>';
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
const UP_SHORT = { truck:'More pickups', hiveTank:'Nectar tank', hiveStore:'Honey store', honeyPrice:'Honey labels', giftPrice:'Gift ribbons', hopper:'Ore hopper', metalBin:'Metal tub' };
const UP_TIP = {
  bin:'How many loose leaves the bin holds before robots have to wait', leafPrice:'What the truck pays for a loose leaf', bagPrice:'What the truck pays for a bag of ' + BAG_SIZE + ' leaves',
  metalPrice:'What the truck pays for a chunk of metal (ingots are worth 4 chunks × the alloy)', metalBin:'How much metal the tub holds. A bigger tub also makes the ingot pallet bigger',
  truck:'How often the truck comes by', cleanup:'A one-off deal: the truck pays a bonus for every 100 leaves it takes (bagged leaves count too)',
  hiveTank:'Nectar the hive can hold. Every second tank or store step adds a hive floor, and each floor makes honey', hiveStore:'Jars of honey the hive and crate can hold',
  honeyPrice:'What the truck pays for a jar of honey', giftPrice:'What the truck pays for a gift jar', smeltSpeed:'How hot the furnaces burn: every smelter is faster',
  ingotGrade:'What an ingot sells for', slag:'Extra ingots from the same metal', hopper:'Ore waiting at the plant for the smelters' };
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
const TRACK_ICON = { study:'book', speed:'wheel', carry:'basket', pick:'pick', grab:'claw', reach:'reach', drill:'drill', magnet:'magnet', pack:'pack', blow:'blow', shake:'shake', snip:'snip', dig:'dig', stoke:'stoke', brolly:'brolly' };
const TRACK_TIP = { speed:'How fast it drives', carry:'How much it carries in one trip', pick:'How long one grab takes', grab:'Leaves in one grab', reach:'How far the arm reaches',
  drill:'Seconds for a chunk of metal', magnet:'Chance a chunk of metal comes out as two', pack:'How fast it bags leaves, fills and wraps jars, and smelts', blow:'How hard it blows (range, push and glide)',
  study:'Research a second while it holds the book (a robot helping does a quarter of that)', shake:'Leaves a big tree drops when shaken (a bush gives a third)', snip:'Lets it deadhead spent flowers so they bloom again sooner: more nectar for the bees. Only with a beehive.', dig:'Faster mining at a shaft while it excavates', stoke:'Faster smelting while it works the bellows',
  brolly:'Lets it hold the big wood umbrella over a robot hauling dry wood, so none of it gets wet on the way' };
const TRACK_VAL = {
  speed: v => [v.toFixed(2) + '×', ''], carry: v => [v, ic('leaf')], pick: v => [v.toFixed(2) + 's', ''], grab: v => [v, ic('leaf')], reach: v => [v, '<small>cm</small>'],
  drill: v => [v.toFixed(1) + 's', '<small>/</small>' + ic('ore')], magnet: v => [Math.round(v*100) + '%', '<small>×2</small>'], pack: v => [v.toFixed(2) + '×', ''],
  study: v => [RESEARCH_MAIN*v, '<small>/s</small>'], blow: v => [v.toFixed(2) + '×', ''], shake: v => [v, ic('leaf')], snip: v => [v ? 'yes' : 'no', ''], dig: v => ['+' + Math.round(v*100) + '%', ''], stoke: v => ['+' + Math.round(v*100) + '%', ''],
  brolly: v => [v ? 'yes' : 'no', ''],
};
function robotRow(ri, k, kind){
  kind = kind || 'robot';
  const T = TRACKS[k], L = cfgsOf(kind)[ri].lv[k], cap = trackCap(k), max = trackMax(k), maxed = L >= max, locked = !maxed && L >= cap;
  const a = TRACK_VAL[k](T.vals[L]), b = maxed || locked ? a : TRACK_VAL[k](T.vals[L + 1]);
  let val = fromTo(a[0], b[0], a[1], maxed || locked), btn = '', sig = '';
  if (k === 'carry' && S.metalSlot){ const m0 = 2 + Math.floor(L/2), m1 = maxed || locked ? m0 : 2 + Math.floor((L + 1)/2); val += xt((m1 !== m0 ? m0 + arrow + '<b>' + m1 + '</b>' : '<b>' + m0 + '</b>') + ic('ore'), 'Metal it carries'); }
  // smelting speed comes from Packing and Drill together, so show it on both rows once the plant is up
  if (kind === 'robot' && S.plant.built && (k === 'pack' || k === 'drill')){ val += xt(ic('flame') + smeltSkill(ri).toFixed(1) + '×', 'Smelting speed (Packing × Drill)'); sig += smeltSkill(ri).toFixed(2); }
  if (k === 'snip') val = L ? 'Deadheads spent flowers' : 'Deadhead spent flowers: they bloom again sooner, so more nectar for the bees';   // V13.7
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
  return buyRow('Smelting plant', ORE_PER_INGOT + ic('ore') + arrow + ic('ingot') + '<b>' + cash$(ingotPrice()) + '</b> ' + pct(ingotPrice()/ORE_PER_INGOT, metalPrice()), 'plant', PLANT_COST, '', ic('flame'),
    'Robots melt ' + ORE_PER_INGOT + ' metal into an ingot worth more. Three furnaces, and someone has to haul the ingots to the road');
}
const metalSlotRow = () => buyRow('Metal slot', 'Sell ' + ic('ore') + ' at <b>' + cash$(metalPrice()) + '</b>', 'metalSlot', METAL_SLOT_COST, '', ic('tub'),
  'A metal tub beside the bin, so the truck buys metal too. Then build miners on the rocks (' + cash$(MINER_COST) + ' each, a robot works each one)');

// ── robot portraits: the real robot, drawn live into a little canvas
const pcv = document.createElement('canvas');
function drawPortrait(cv2, kind, i, z){
  const o = kind === 'robot' ? R[i] : HB.find(q => q.kind === kind && q.idx === i); if (!o) return false;
  const w = cv2.width, h = cv2.height, pc = cv2.getContext('2d'), s = h*(z || 1)/(kind === 'robot' ? 74 : 60);
  pc.setTransform(1, 0, 0, 1, 0, 0); pc.clearRect(0, 0, w, h);
  pc.setTransform(s, 0, 0, s, w/2 - o.x*s, h*(kind === 'robot' ? 0.94 : 0.88) - o.y*s);
  const keep = ctx, pl = parts.length, bl = bubbles.length, tl = timers.length;
  ctx = pc;
  try { kind === 'robot' ? drawRobot(o) : kind === 'blower' ? drawBlower(o) : drawShaker(o); } catch(e){}
  ctx = keep; parts.length = pl; bubbles.length = bl; timers.length = tl;
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
const crewBot = (ri, tag) => '<span class="crew" title="' + styleOf(ri).name + '"><img src="' + botThumb(ri) + '" alt="' + styleOf(ri).name + '">' + (tag ? '<b>' + tag + '</b>' : '') + '</span>';
// "who works here": robots with that task on their list, or a nudge to add it
function crewRow(icon, label, task, tagOf){
  const who = S.robots.map((c, ri) => taskOn(c, task) ? ri : -1).filter(ri => ri >= 0);
  // lots of robots: their faces in a little huddle (with the number once, if they're all the same)
  const tags = who.map(ri => tagOf ? tagOf(ri) : ''), same = tags.every(t => t === tags[0]);
  const body = who.length > 4 ? '<span class="huddle">' + who.map((ri, j) => '<img src="' + botThumb(ri) + '" alt="" title="' + styleOf(ri).name + (tags[j] ? ' · ' + attr(tags[j]) : '') + '">').join('') + '</span>' + (same && tags[0] ? '<b class="each">' + tags[0] + ' <small>each</small></b>' : '')
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
    case 'toBin': case 'dump': return r.at === 'metal' ? ['mine', metalTarget(r).hopper ? 'To the hopper' : 'To the tub'] : ['leaves', 'To the bin'];
    case 'wait': return r.at === 'metal' ? ['mine', metalTarget(r).hopper ? 'Hopper full' : 'Tub full', 1] : ['leaves', 'Bin full', 1];
    case 'toMine': return ['mine', 'To the mine'];
    case 'mine': return ['mine', 'Mining'];
    case 'toStation': return r.task === 'bag' ? ['bag', 'To the table'] : r.task === 'jar' ? ['jar', 'To the crate'] : r.task === 'wrap' ? ['wrap', 'To the crate'] : ['smelt', 'To a furnace'];
    case 'bag': return ['bag', 'Bagging'];
    case 'jar': return ['jar', 'Filling a jar'];
    case 'wrap': return ['wrap', 'Wrapping a gift jar'];
    case 'smelt': return ['smelt', 'Smelting'];
    case 'toTub': return ['smelt', 'Fetching ore'];
    case 'toRack': return ['haul', 'Fetching ingots'];
    case 'toPallet': return ['haul', 'Hauling'];
    case 'waitI': return ['haul', 'Pallet full', 1];
    case 'toBook': return ['research', 'To the book'];
    case 'pickBook': return ['research', 'Picking up the book'];
    case 'toStudy': return ['research', 'Carrying the book'];
    case 'study': return ['research', 'Studying the book'];
    case 'toAssist': return ['research', 'Going to help'];
    case 'assist': return ['research', 'Helping with research'];
    case 'toCurb': return ['travel', 'To the curb'];
    case 'curb': return ['travel', 'Waiting for the truck'];
    case 'hopIn': case 'hopOut': case 'ride': return ['travel', 'Riding the truck'];
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
    if (r && ['wander', 'rest', 'seek', 'toStation', 'toMine', 'toTub', 'toRack', 'wait', 'waitI', 'toCurb', 'curb', ...RESEARCH_STATES].includes(r.st) || (r && r.st === 'mine' && !taskOn(cfg, 'mine'))){ release(r); r.st = 'idle'; r.mineP = 0; }
  } else {
    const h = HB.find(q => q.kind === kind && q.idx === i);
    if (h && (['wander', 'rest', 'go', 'toCurb', 'curb'].includes(h.st) || (taskOn(cfg, 'travel') && ['lap', 'dig', 'stoke', 'brolly'].includes(h.st)) || (h.st === 'lap' && !taskOn(cfg, 'blow')) || (h.st === 'dig' && !taskOn(cfg, 'dig')))){ h.target = null; h.st = 'idle'; }
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
const HIVE_SHORT = { wings:'+25% bee speed', third:'3 flowers a trip', tongue:'5 nectar a sip', fan:'+50% honey making', recipe:'20 nectar a jar', nursery:'Bees 30% cheaper' };
const HIVE_ICON = { wings:'wings', third:'three', tongue:'tongue', fan:'fan', recipe:'recipe', nursery:'nursery' };
const GEN_ICON = { oil:'oil', basket:'basket', fingers:'claw', blueprint:'blueprint', cutting:'drop', market:'market', charm:'horseshoe' };
const GEN_SHORT = { oil: l => '+' + 20*(l + 1) + '% speed, every robot', basket: () => 'Copied baskets cost 10%', fingers: l => '+' + 30*(l + 1) + '% claw spread',
  blueprint: () => 'Copied levels cost 30%', cutting: l => '+' + 15*(l + 1) + '% drill speed', market: l => '+' + 10*(l + 1) + '% on every sale', charm: () => '+8% double metal' };
if (LOT.GEN_ICON) Object.assign(GEN_ICON, LOT.GEN_ICON);
if (LOT.GEN_SHORT) Object.assign(GEN_SHORT, LOT.GEN_SHORT);
const HEAD_ICON = { letter:'letter', book:'book', bin:'bin', sign:'truck', shed:'wrench', hive:'bee', bagger:'bag', plant:'flame', sound:'sound', sale:'land' };
function cardModel(){
  const k = cardOpen.kind, rows = [], rows2 = [];
  let title = '', tag = '', live = '', top = '', foot = '', tabs = null, head = HEAD_ICON[k] || '';
  if (k === 'robot' || k === 'blower' || k === 'shaker'){
    const i = cardOpen.i, st = k === 'robot' ? styleOf(i) : helperStyleOf(k, i);
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
      else if (!metalOpen()) rows.push({ sig:'metalsoon', html: row({ icon: ic('tub'), cls:'soon', name:'Metal slot', val:'No metal on this plot. Mining opens with the ' + AREAS[MINE_LAND].name.toLowerCase() }) });
    }
    else {
      rows2.push(upRow('metalBin', S.plant.built ? xt(palletCap() + ic('ingot'), 'Room on the ingot pallet') : '')); rows2.push(upRow('metalPrice', S.plant.built ? xt(ic('ingot') + cash$(ingotPrice()), 'An ingot sells for') : ''));
      if (S.plant.built) rows2.push(keepRow('M', 'ore', 'Keep for smelting', keepMetal() + ic('ore'), 'The truck leaves this much metal in the tub for the smelting plant. At 0 it takes everything.', S.keep.metal));
      if (plantGrade() && !S.plant.built) rows2.push(plantShown() ? plantBuildRow() : { sig:'plantsoon', html: row({ icon: ic('flame'), cls:'soon', name:'Smelting plant', val:'shows up once you’ve held ' + cash$(PLANT_COST*0.25), tip:'Turns metal into ingots worth a lot more' }) });
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
    if (n < ROBOT_MAX){ const ns = STYLES[nextStyle()]; rows.push(buyRow('Build ' + ns.name, 'you have <b>' + n + '</b>/' + ROBOT_MAX, 'robot', robotCost(n), '', ic('robot'), ns.blurb)); }
    else rows.push(buyRow('Robots', 'all <b>' + ROBOT_MAX + '</b> built', 'robot', 0, 'done', ic('robot')));
    for (const kind of ['blower', 'shaker']) if (helperShown(kind)){
      const m = cfgsOf(kind).length, stl = HELPER_LOOKS(kind)[nextHelperStyle(kind)];
      rows.push(buyRow('Build ' + stl.name, m ? 'you have <b>' + m + '</b>/' + HELPER_MAX : kind === 'blower' ? 'a blower: pushes leaves to the bin' : 'a shaker: more leaves from trees', kind, helperCost(kind), '', ic(kind === 'blower' ? 'elephant' : 'crab'), (kind === 'blower' ? 'A blower: blows far-off leaves toward the bin. ' : 'A shaker: shakes trees and bushes so more leaves come down. ') + stl.blurb));
    } else if (cfgsOf(kind).length >= HELPER_MAX) rows.push(buyRow(kind === 'blower' ? 'Blowers' : 'Shakers', 'all <b>' + HELPER_MAX + '</b> built', kind, 0, 'done', ic(kind === 'blower' ? 'elephant' : 'crab')));
    if (!S.hive.built && hiveShown()) rows.push(buyRow('Robot beehive', ic('bee') + arrow + ic('nectar') + arrow + ic('jar') + '<b>' + cash$(honeyPrice()) + '</b>', 'hive', hiveCost(), '', ic('honey'), 'Robot bees bring nectar from the flowers, the hive makes honey, and the truck buys the jars'));
    if (genVisible()){
      // V13: a lot's own upgrades (the prairie's flower upgrades) get a section of their own, always shown when available
      const own = (LOT.genSection && LOT.genSection.keys) || [];
      const ks = Object.keys(GEN).filter(q => genAvail(q) && !own.includes(q)).sort((a, b) => genCost(a) - genCost(b));
      const owned = Object.keys(GEN).filter(q => gl(q) >= GEN[q].max);
      const genRow = q => { const g = GEN[q], l = gl(q); const r = buyRow(g.name + (g.max > 1 ? nuts(l, [{ n: g.max }]) : ''), GEN_SHORT[q](l), 'gen:' + q, genCost(q), '', ic(GEN_ICON[q]), g.desc(l).replace(/<[^>]+>/g, '')); r.sig += l; return r; };
      const ok = own.filter(genAvail);
      if (ok.length){ rows2.push({ sig:'gfh', html:'<div class="sect">' + LOT.genSection.title + '</div>' }); for (const q of ok) rows2.push(genRow(q)); }
      rows2.push({ sig:'gh', html:'<div class="sect">Yard-wide</div>' });
      for (const q of ks.slice(0, 6)) rows2.push(genRow(q));
      if (!ks.length) rows2.push({ sig:'gnone', html:'<div class="none pad">More unlock as the yard grows.</div>' });
      if (owned.length) rows2.push({ sig:'gown' + owned.length, html:'<div class="gdone">' + owned.map(q => '<span class="dchip" title="' + GEN[q].name + '">' + ic(GEN_ICON[q]) + ic('check', 'ck') + '</span>').join('') + '</div>' });
    }
    foot = '<div class="foot">' + (resetArm ? '<button class="link danger" data-act="reset2">Yes, wipe my yard</button>' : '<button class="link" data-act="reset1">Start over</button>') + '</div>';
  } else if (k === 'hive'){
    const H = S.hive;
    title = 'Beehive';
    if (!H.built){ head = 'honey'; rows.push(buyRow('Robot beehive', ic('bee') + arrow + ic('nectar') + arrow + ic('jar') + '<b>' + cash$(honeyPrice()) + '</b>', 'hive', hiveCost(), '', ic('honey'), 'Robot bees bring nectar from the flowers, the hive makes honey, and the truck buys the jars')); }
    else {
      live = 'hive';
      const n = H.bees;
      if (n < MAX_BEES){
        const cost = beeCost(), spare = n && B.filter(b => b.st === 'loiter').length >= Math.max(2, n*0.3);
        rows.push({ sig:'bee' + n + aff$(cost) + cost + spare, html: row({ icon: ic('bee'), name:'Robot bees', tip:'Each bee sips from ' + (H.up.third ? 3 : 2) + ' flowers a trip. Near flowers go first, so more bees fly further out.', val: meter('bee', n, MAX_BEES, 'Bees') + (spare ? xt(ic('flower') + 'all busy', 'Every flower is being sipped: more bees won’t help much until there’s more land') : ''), btn: coinBtn('bee', cost, { label:'Another bee' }) }) });
      } else rows.push({ sig:'beefull', html: row({ icon: ic('bee'), name:'Robot bees', val: meter('bee', n, MAX_BEES), btn: stamp('full') }) });
      const floorNext = (S.lv.hiveTank + S.lv.hiveStore) % 2 === 0 ? xt('+1 floor', 'This step adds a hive floor (more honey a minute)') : '';
      rows.push(upRow('hiveTank', S.lv.hiveTank < UP.hiveTank.max ? floorNext : ''));
      rows.push(upRow('hiveStore', S.lv.hiveStore < UP.hiveStore.max ? floorNext : ''));
      rows.push(upRow('honeyPrice'));
      if (!H.packing){ if (packShown()) rows.push(buyRow('Gift wrapping', ic('jar') + cash$(honeyPrice()) + arrow + ic('gift') + '<b>' + cash$(val('honeyPrice')*UP.giftPrice.vals[0]*sellMul()) + '</b>', 'honeyPack', HONEY_PACK_COST, '', ic('gift'), 'Adds the Wrap task: a robot ties a cloth top and a ribbon on a jar so it sells as a gift jar. Wrapping takes almost as long as filling the jar.')); }
      else {
        rows.push(upRow('giftPrice'));
        rows.push(keepRow('J', 'jar', 'Keep for wrapping', keepJars() + ic('jar'), 'The truck leaves this many plain jars in the crate so they can be wrapped first. At 0 it takes every jar.', S.keep.jars || 0));
      }
      rows.push(crewRow('jar', 'Fillers', 'jar', ri => smeltSkillPack(ri)));
      if (H.packing) rows.push(crewRow('wrap', 'Wrappers', 'wrap', ri => smeltSkillPack(ri)));
      rows2.push({ sig:'hh', html:'<div class="sect">Hive upgrades <span>any order · same price</span></div>' });
      let tiles = '';
      for (const key in HIVE_UP){
        const u = HIVE_UP[key], have = H.up[key];
        let note = '';
        if (have && u.bee && B.length){ const got = B.filter(b => b.up[key]).length; if (got < B.length) note = '<em>' + got + '/' + B.length + ' bees</em>'; }
        tiles += '<div class="tile' + (have ? ' got' : '') + '" title="' + u.desc.replace(/<[^>]+>/g, '') + '">' + ic(HIVE_ICON[key], 'tic') + '<div class="tn2">' + u.name + '</div><div class="td">' + HIVE_SHORT[key] + note + '</div>' +
          (have ? stamp(ic('check'), 'ok') : coinBtn('hiveUp:' + key, hiveUpCost(), { label: u.name })) + '</div>';
      }
      rows2.push({ sig:'tiles' + tiles.length + Object.keys(H.up).filter(q => H.up[q]).join() + aff$(hiveUpCost()), html:'<div class="tiles">' + tiles + '</div>' });
      if (!n){
        // no bees yet: everything else can be looked at, but not bought
        const lockIt = r => { r.html = r.html.replace(/aria-disabled="(true|false)"/g, 'aria-disabled="true" data-lock="bee"').replace(/class="(row|tiles)/, 'class="$1 locked'); r.sig += 'L'; return r; };
        for (let q=1; q<rows.length; q++) lockIt(rows[q]);
        rows2.forEach(lockIt);
        rows.splice(1, 0, { sig:'needbee', html:'<div class="lockline">' + ic('lock') + 'Get your first bee to start upgrading</div>' });
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
    title = 'Smelting plant';
    if (!S.plant.built) rows.push(plantBuildRow());
    else {
      live = 'plant';
      rows.push(upRow('smeltSpeed')); rows.push(upRow('slag')); rows.push(upRow('ingotGrade', xt(cash$(ingotPrice()*(1 + val('slag'))/ORE_PER_INGOT) + '/' + ic('ore'), 'Per chunk of metal, smelted')));
      rows.push(upRow('hopper'));
      rows2.push(crewRow('smelt', 'Smelters', 'smelt', ri => smeltSkill(ri).toFixed(1) + '×'));
      rows2.push(crewRow('haul', 'Haulers', 'haul', ri => ingotCarry(ri) + '<small>/trip</small>'));
      const sk = stoker(), learnt = S.blowers.some(b => b.lv.stoke > 0);
      rows2.push({ sig:'stk' + (sk ? sk.idx + hv(sk, 'stoke') : '-') + learnt + S.blowers.length, html: row({ icon: ic('stoke'), name:'Bellows', cls:'crewrow',
        val: sk ? helperStyle(sk).name + ' <span class="gain">+' + Math.round(hv(sk, 'stoke')*100) + '%</span> smelting' : '<span class="none">' + (learnt ? 'no blower here · add <span class="chip mini" style="--tc:' + TASKS.stoke.col + '">' + ic('stoke') + 'Bellows</span> to a blower' : S.blowers.length ? 'a blower can learn it (Bellows, on its card)' : 'build a blower to work it') + '</span>',
        tip:'A blower working the bellows makes every smelter faster' }) });
      if (WET_WOOD){
        // V14: who's carrying the wood umbrella, and how much dry wood the rain has soaked so far
        const ub = HB.filter(h => h.kind === 'blower' && h.st === 'brolly'), ul = S.blowers.some(b => b.lv.brolly > 0), soaked = S.totals.soaked || 0;
        rows2.push({ sig:'brl' + ub.map(h => h.idx).join(',') + ul + soaked + S.blowers.length, html: row({ icon: ic('brolly'), name:'Wood umbrella', cls:'crewrow',
          val: (ub.length ? ub.map(h => helperStyle(h).name).join(', ') + ' <span class="gain">keeps the wood dry</span>' : '<span class="none">' + (ul ? 'nobody carrying it · add <span class="chip mini" style="--tc:' + TASKS.brolly.col + '">' + ic('brolly') + 'Umbrella</span> to a blower' : S.blowers.length ? 'a blower can learn it (Umbrella, on its card)' : 'build a blower to carry it') + '</span>')
            + (soaked ? '<br><small>' + ic('wet') + soaked + ' bundles soaked in the rain so far</small>' : ''),
          tip:'Dry bundles get wet on the long walk to the road. A soaked bundle goes back in the log crib as two wet logs. A blower carrying the wood umbrella beside a hauler keeps its load dry' }) });
      }
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
  } else if (k === 'book'){
    // V12: the old picture book: its two pages, what the robots make of it, and the research timer once it's started
    const F = FIND(), bee = S.story.item === 'bee';
    title = F.title; live = 'book'; if (bee) head = 'deadbee';
    const who = researchers(), going = who.length > 0 || S.story.prog > 0;
    top = '<div class="bookart' + (bee ? ' beeart' : '') + '">' + (bee ? BEE_SVG : BOOK_SVG) + '</div><p class="story">' + F.story + '</p>';
    const chip = '<span class="chip mini" style="--tc:' + TASKS.research.col + '">' + ic('research') + 'Research</span>';
    const names = who.map(q => styleOf(q.id).name);
    rows.push({ sig:'rw' + names.join(), html: row({ icon: ic('research'), name:'Research', tip:'The robot holding ' + F.holding + ' does ' + RESEARCH_MAIN + ' research a second, each robot helping ' + RESEARCH_HELP + ' (more with Research upgrades). Progress is kept if they stop.',
      val: names.length ? names.join(', ') + (names.length > 1 ? ' are on it' : ' is on it') : '<span class="none">nobody yet · add ' + chip + ' to a robot’s Do list</span>' }) });
    if (going) rows.push({ sig:'two', html:'<div class="lockline tip2">' + ic('robot') + (F.crew ? 'Up to ' + F.crew + ' robots can research this together.' : '2 robots can research this for faster progress.') + '</div>' });
  } else if (k === 'letter'){
    // V13: a letter from the truck driver
    const l = S.letters[cardOpen.i], L = l && LETTERS[l.id];
    title = L ? L.title : 'A letter'; head = 'letter';
    if (L) top = '<div class="letter"><p>' + L.text + '</p><p class="sig">— ' + L.sign + '</p></div>' + (L.note ? '<div class="lnote">' + ic('info') + '<span>' + L.note() + '</span></div>' : '');
    if (S.trip){
      // V14: one row for each one who goes (a robot, and maybe a blower), and one for the travel money
      const chip = '<span class="chip mini" style="--tc:' + TASKS.travel.col + '">' + ic('travel') + TASKS.travel.short + '</span>';
      for (const kind of tripKinds()){
        const h = tripHolder(kind), list = cfgsOf(kind), hi = h ? list.indexOf(h) : -1, cand = list.findIndex(tripFor), o = h && runtimeOf(kind, h);
        const nm = i => kind === 'robot' ? styleOf(i).name : helperStyleOf(kind, i).name;
        const whose = cand < 0 ? null : (S.trip.to === 'home' || (kind === 'robot' && S.trip.who != null)) ? nm(cand) + '’s' : kind === 'blower' ? 'a blower’s' : 'a robot’s';
        const st = o && o.st, val = hi >= 0 ? nm(hi) + (st === 'curb' ? ' is waiting at the curb' : st === 'toCurb' ? ' is on its way to the curb' : !tripCashOK() ? ' goes once the money is there' : ' will go with the next pickup')
          : whose ? '<span class="none">add ' + chip + ' to ' + whose + ' Do list</span>' : '<span class="none">' + (kind === 'blower' ? 'build a blower in the workshop first' : 'no robot can go') + '</span>';
        rows.push({ sig:'trip' + kind + hi + st + tripCashOK(), html: row({ icon: ic(kind === 'blower' ? 'blow' : 'travel'), name: TASKS.travel.name + (tripKinds().length > 1 ? (kind === 'blower' ? ' · blower' : ' · robot') : ''),
          tip:'Waits at the curb and hops into the back of the truck at the next pickup' + (tripKinds().length > 1 ? ', once both are there' : '') + (S.trip.bee ? ', and a bee comes along' : ''), val }) });
      }
      if (S.trip.cash && !S.trip.paid) rows.push({ sig:'fare' + Math.floor(S.cash) + tripCashOK(), html: row({ icon: ic('coin'), name:'Travel money', cls: tripCashOK() ? '' : 'soon',
        tip:'The robots only head for the curb while you hold ' + cash2(S.trip.cash).replace('.00', '') + '. It comes out of your cash when they climb into the truck, and the new yard starts with it.',
        val: (tripCashOK() ? '<b>' + cash2(S.trip.cash).replace('.00', '') + '</b> ready' : cash2(S.cash) + ' of ' + cash2(S.trip.cash).replace('.00', '')) }) });
    }
  } else if (k === 'sale'){
    const A = AREAS[S.land + 1], cur = AREAS[S.land], newSpots = SPOTS.filter(p => p.land === S.land + 1).length;
    title = 'For sale';
    rows.push(buyRow('The ' + A.name.toLowerCase(), '<b>' + Math.round(A.w*A.h/(cur.w*cur.h)) + '×</b> room' + (newSpots ? ' · +' + newSpots + ic('vein') : '') + ' · more ' + ic('leaf') + ic('flower'), 'land', A.cost, '', ic('land'), 'More room means more leaves and flowers' + (newSpots ? ' and a metal vein' : '') + ', but longer trips to the bin'));
    if (MINE_LAND && S.land + 1 === MINE_LAND) rows.push({ sig:'mine', html: row({ icon: ic('vein'), name:'Finally a chance to mine!', val:'The ' + A.name.toLowerCase() + ' has the only metal vein: the metal slot, miners and the smelting plant all open there' }) });
  } else if (k === 'spot'){
    const i = cardOpen.i, p = SPOTS[i], vw = veinWord(i).replace(/^an? /, '');
    tag = '<span class="tag" title="Richer veins give chunks faster">' + vw + '</span>';
    head = 'vein';
    if (p.land > S.land){
      title = 'Metal vein';
      rows.push({ sig:'far', html: row({ icon: ic('land'), cls:'soon', name:'Not your land yet', val: LAND_SALE ? 'buy it when the For Sale sign goes up' : 'it lies beyond the fence' }) });
    } else if (S.miners.includes(i)){
      const shaft = S.shafts.includes(i), room = slotsAt(i);
      title = shaft ? 'Mine shaft' : 'Miner'; head = shaft ? 'shaft' : 'vein';
      const ws = minerWorkers(i);
      for (const w of ws) rows.push({ sig:'w' + w + drillTimeAt(w, i).toFixed(1) + metalCarry(w) + doubleChance(w), html: '<div class="row crewrow"><div class="ri">' + crewBot(w) + '</div><div class="rm"><div class="n">' + styleOf(w).name + '</div><div class="v">' +
        drillTimeAt(w, i).toFixed(1) + 's<small>/</small>' + ic('ore') + xt(metalCarry(w) + ic('ore') + '<small>a trip</small>') + (doubleChance(w) > 0 ? xt(Math.round(doubleChance(w)*100) + '%<small>×2</small>', 'Chance of double metal') : '') + '</div></div>' +
        '<div class="btn"><button class="buy ghost" data-act="release:' + w + '" title="Moves Mine metal to Off on ' + styleOf(w).name + '’s task list">Stop</button></div></div>' });
      if (ws.length < room){
        const any = R.some(r => S.robots[r.id].miner == null);
        rows.push({ sig:'nw' + any + ws.length, html: row({ icon: ic('robot'), cls:'soon', name: ws.length ? 'Room for one more' : 'Nobody mining', val: any ? 'sends the nearest free robot' : 'every robot is at a mine', btn:'<button class="buy ghost" data-act="send" aria-disabled="' + !any + '">Send one</button>' }) });
      }
      if (!shaft && shaftShown()) rows.push(buyRow('Dig a shaft', '<span class="gain">+35%</span> speed · 2' + ic('robot') + (S.shafts.length ? xt('½ price', 'You’ve dug one before') : ''), 'shaft', shaftCost(), '', ic('shaft'), 'A deeper, richer vein: chunks come 35% faster and two robots can work it. Blowers can learn to excavate a shaft.'));
      if (shaft){
        const ex = HB.find(h => h.kind === 'blower' && h.st === 'dig' && h.dig === i), learnt = S.blowers.some(b => b.lv.dig > 0);
        rows.push({ sig:'ex' + (ex ? ex.idx + hv(ex, 'dig') : '-') + learnt + S.blowers.length, html: row({ icon: ic('dig'), cls:'crewrow', name:'Excavator', tip:'A blower sucking the dirt out makes mining here faster',
          val: ex ? helperStyle(ex).name + ' <span class="gain">+' + Math.round(hv(ex, 'dig')*100) + '%</span> mining' : '<span class="none">' + (learnt ? 'no blower here · add <span class="chip mini" style="--tc:' + TASKS.dig.col + '">' + ic('dig') + 'Dig</span> to a blower' : S.blowers.length ? 'a blower can learn it (Excavate, on its card)' : 'build a blower to dig here') + '</span>' }) });
      }
    } else {
      title = 'Metal vein';
      if (!S.metalSlot){
        // the metal slot can be bought right here as well as on the bin
        if (metalSlotShown()) rows.push(metalSlotRow());
        else rows.push({ sig:'locked', html: row({ icon: ic('lock'), cls:'soon', name:'Needs a metal slot', val:'on the bin, once you’ve held ' + cash$(METAL_SLOT_COST*0.25) }) });
      }
      else rows.push(buyRow('Build a miner', ic('ore') + '<b>' + cash$(metalPrice()) + '</b> a chunk · needs a robot', 'miner', MINER_COST, '', ic('vein'), 'A robot with Mine metal on its list works it'));
    }
  }
  return { title, tag, rows, rows2, top, foot, live, tabs, head };
}
// V12: the picture book's two pages, as the card shows them: an alphabet book with everything but E and C torn out
const BOOK_SVG = '<svg viewBox="0 0 300 172" role="img" aria-label="An old picture book open on two pages: an elephant and a crab">' +
  '<defs><linearGradient id="bkSp" x1="0" x2="1"><stop offset="0" stop-color="#7a5a3a" stop-opacity="0"/><stop offset=".5" stop-color="#7a5a3a" stop-opacity=".32"/><stop offset="1" stop-color="#7a5a3a" stop-opacity="0"/></linearGradient></defs>' +
  // the cover behind, then the two pages (the left one torn at the top corner, the right one at the bottom)
  '<path d="M150,14 Q80,2 8,12 V160 Q80,152 150,166 Q220,152 292,160 V12 Q220,2 150,14Z" fill="#3b6268"/>' +
  '<path d="M150,18 Q82,8 30,14 L24,24 L32,30 L18,36 L14,44 V154 Q82,146 150,160Z" fill="#f3e6c8"/>' +
  '<path d="M150,18 Q218,8 286,16 V120 L278,128 L284,136 L270,142 L266,152 L250,150 Q200,148 150,160Z" fill="#efe0bd"/>' +
  '<rect x="138" y="14" width="24" height="148" fill="url(#bkSp)"/>' +
  '<ellipse cx="236" cy="132" rx="26" ry="10" fill="#7a5a3a" opacity=".1"/><ellipse cx="58" cy="128" rx="18" ry="8" fill="#7a5a3a" opacity=".09"/>' +
  // E is for Elephant: puffing a breeze out of its trunk, a couple of leaves riding on it
  '<text x="86" y="40" text-anchor="middle" font-family="Caveat, cursive" font-weight="700" font-size="17" fill="#4f7c84">E is for Elephant</text>' +
  '<ellipse cx="94" cy="104" rx="34" ry="24" fill="#9aa3ab"/><rect x="70" y="116" width="11" height="22" rx="4" fill="#8a939b"/><rect x="88" y="118" width="11" height="20" rx="4" fill="#8a939b"/><rect x="106" y="116" width="11" height="22" rx="4" fill="#8a939b"/>' +
  '<path d="M127,98 q8,4 6,14" stroke="#8a939b" stroke-width="3" fill="none" stroke-linecap="round"/>' +
  '<circle cx="62" cy="86" r="19" fill="#a9b2b9"/><ellipse cx="76" cy="88" rx="13" ry="17" fill="#8a939b"/><ellipse cx="77" cy="89" rx="7.5" ry="11" fill="#d9a3a6"/>' +
  '<path d="M48,92 C40,100 34,96 32,84 C31,76 34,68 38,66" stroke="#a9b2b9" stroke-width="9" fill="none" stroke-linecap="round"/><circle cx="55" cy="80" r="2.4" fill="#3a2e22"/>' +
  '<path d="M30,62 q-8,-4 -6,-12 M28,72 q-12,0 -12,-8 M36,58 q-2,-8 4,-10" stroke="#4f7c84" stroke-width="2" fill="none" stroke-linecap="round" opacity=".75"/>' +
  '<path d="M18,84 c4,-3 8,0 6,4 c-3,3 -8,1 -6,-4z" fill="#d4672a"/><path d="M24,100 c4,-2 7,2 4,5 c-3,2 -7,0 -4,-5z" fill="#e2a03a"/>' +
  // C is for Crab: claws up, at the foot of a little tree with leaves coming down
  '<text x="214" y="40" text-anchor="middle" font-family="Caveat, cursive" font-weight="700" font-size="17" fill="#b8452d">C is for Crab</text>' +
  '<path d="M262,128 V74" stroke="#6e4a30" stroke-width="6"/><circle cx="262" cy="64" r="18" fill="#d9732a"/><circle cx="250" cy="72" r="10" fill="#c9652a"/><circle cx="273" cy="70" r="10" fill="#e48a35"/>' +
  '<path d="M236,92 c3,-2 6,1 4,4 c-3,2 -6,-1 -4,-4z" fill="#d4672a"/><path d="M276,98 c3,-1 5,2 3,4 c-2,2 -5,0 -3,-4z" fill="#e2a03a"/>' +
  '<g stroke="#c4452f" stroke-width="3" stroke-linecap="round"><path d="M186,118 l-16,8 M188,124 l-12,12 M192,128 l-6,14 M228,118 l16,8 M226,124 l12,12 M222,128 l6,14"/></g>' +
  '<path d="M192,108 Q178,104 172,84 M222,108 Q236,104 242,84" stroke="#e2702a" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M184,104 l-4,-4 M230,104 l4,-4" stroke="#c4452f" stroke-width="1.6" stroke-linecap="round"/>' +
  '<g>' +
  '<ellipse cx="207" cy="114" rx="27" ry="17" fill="#e2702a"/><ellipse cx="199" cy="108" rx="10" ry="5" fill="#f09a5a" opacity=".7"/>' +
  '<path d="M170,88 C156,82 158,58 174,58 L176,70 L184,62 C188,76 182,88 170,88Z M244,88 C258,82 256,58 240,58 L238,70 L230,62 C226,76 232,88 244,88Z" fill="#e2702a"/></g>' +
  '<path d="M200,100 V88 M214,100 V88" stroke="#c4452f" stroke-width="2.4"/><circle cx="200" cy="86" r="4" fill="#3a2e22"/><circle cx="214" cy="86" r="4" fill="#3a2e22"/><circle cx="201" cy="85" r="1.2" fill="#fff"/><circle cx="215" cy="85" r="1.2" fill="#fff"/>' +
  '<path d="M200,120 q7,5 14,0" stroke="#a8361d" stroke-width="1.8" fill="none" stroke-linecap="round"/>' +
  // a dried leaf stuck to the page
  '<path d="M126,140 c8,-8 20,-6 22,2 c-6,8 -18,8 -22,-2z" fill="#c96a22" opacity=".9"/><path d="M128,141 l18,1" stroke="#8c3215" stroke-width="1"/>' +
  '</svg>';
// V13: the dead bee from the prairie, as its card shows it: lying on a big pink petal, legs folded, wings crumpled
const BEE_SVG = '<svg viewBox="0 0 300 172" role="img" aria-label="A small dead bee lying on its side on a pink petal">' +
  '<defs><radialGradient id="bePt" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#fde6ec"/><stop offset=".7" stop-color="#f4b3c6"/><stop offset="1" stop-color="#e58fac"/></radialGradient>' +
  '<radialGradient id="beAb" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#f6cf6a"/><stop offset="1" stop-color="#c98a26"/></radialGradient></defs>' +
  '<path d="M150,160 C70,156 22,112 30,64 C38,24 96,8 132,30 C142,12 168,6 180,24 C222,6 282,30 276,80 C270,128 224,158 150,160Z" fill="url(#bePt)"/>' +
  '<path d="M150,150 C146,112 140,80 136,40 M150,150 C176,118 196,92 212,58 M150,150 C122,128 96,110 70,92" stroke="#d27f9b" stroke-width="2" fill="none" opacity=".45"/>' +
  '<ellipse cx="150" cy="128" rx="88" ry="12" fill="#7d3550" opacity=".12"/>' +
  // wings, crumpled and see-through
  '<g fill="#eef6f8" fill-opacity=".72" stroke="#7d878c" stroke-width="1.4"><path d="M150,72 C126,40 92,34 84,52 C78,68 110,80 150,80Z"/><path d="M160,70 C160,40 182,28 196,38 C208,48 190,70 164,78Z"/></g>' +
  '<path d="M146,76 C122,58 104,52 96,56 M162,72 C170,52 182,42 190,44" stroke="#7d878c" stroke-width="1" fill="none" opacity=".7"/>' +
  // abdomen with fuzzy stripes and a sting
  '<ellipse cx="120" cy="104" rx="44" ry="30" fill="url(#beAb)"/>' +
  '<g fill="#3a2614"><path d="M96,78 q-8,26 2,52 l10,-2 q-8,-24 0,-48z"/><path d="M118,74 q-8,30 2,60 l11,-1 q-8,-28 0,-58z"/><path d="M140,76 q-6,28 2,56 l9,-4 q-6,-24 0,-50z"/></g>' +
  '<path d="M77,108 l-14,4 l14,4z" fill="#3a2614"/>' +
  '<ellipse cx="110" cy="88" rx="22" ry="6" fill="#fff4c8" opacity=".45"/>' +
  // fuzzy thorax and head
  '<circle cx="176" cy="98" r="22" fill="#4a3218"/><ellipse cx="172" cy="90" rx="14" ry="9" fill="#c99434" opacity=".85"/>' +
  '<g stroke="#c99434" stroke-width="1.2" opacity=".6"><path d="M160,82 l-3,-4 M168,78 l-1,-5 M178,77 l1,-5 M188,80 l3,-4"/></g>' +
  '<circle cx="208" cy="104" r="15" fill="#2a1e14"/><ellipse cx="213" cy="98" rx="5" ry="4" fill="#fff" opacity=".35"/>' +
  '<path d="M216,92 C228,72 240,70 246,78 M212,90 C216,70 226,62 234,64" stroke="#2a1e14" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
  // legs folded up
  '<g stroke="#2a1e14" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M164,118 l-8,14 l10,8"/><path d="M178,120 l-2,16 l11,5"/><path d="M190,116 l6,14 l10,2"/></g>' +
  // a dot of pollen still on it
  '<circle cx="186" cy="132" r="4" fill="#f7d56a"/><circle cx="183" cy="130" r="1.4" fill="#fff6c8"/>' +
  '</svg>';
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
    const trav = { toCurb: 'To the curb', curb: 'Waiting for the truck', hopIn: 'Riding the truck', hopOut: 'Riding the truck', ride: 'Riding the truck' }[h.st];
    if (trav) s = ['travel', trav];
    else if (h.kind === 'blower'){
      s = h.st === 'stoke' ? ['stoke', 'Bellows <b class="gain">+' + Math.round(hv(h, 'stoke')*100) + '%</b>'] : h.st === 'dig' ? ['dig', 'Excavating <b class="gain">+' + Math.round(hv(h, 'dig')*100) + '%</b>']
        : h.st === 'brolly' ? ['brolly', h.brolly >= 0 && R[h.brolly] ? 'Umbrella over ' + styleOf(h.brolly).name : 'Waiting with the umbrella']
        : h.st === 'go' && h.task === 'stoke' ? ['stoke', 'To the plant'] : h.st === 'go' && h.task === 'dig' ? ['dig', 'To a shaft'] : h.st === 'lap' ? ['blow', h.lap ? 'Blowing · lap ' + (h.lap + 1) : 'Blowing along the fence']
        : h.st === 'go' ? ['blow', 'To the next lap'] : ['clock', 'Waiting for leaves'];
    } else {
      s = h.st === 'snip' ? ['snip', 'Deadheading'] : h.st === 'go' && h.target && h.target.type === 'flower' ? ['snip', 'To a flower'] : h.st === 'shake' ? ['shake', h.target.type === 'tree' ? 'Shaking a tree' : 'Shaking a bush']
        : h.st === 'go' ? ['shake', h.target && h.target.type === 'bush' ? 'To a bush' : 'To a tree'] : ['clock', tooManyLeaves() ? 'Plenty down already' : 'Trees refilling'];
    }
    return '<span class="st">' + ic(s[0]) + s[1] + '</span>';
  }
  if (kind === 'hive'){
    const H = S.hive, idle = B.filter(b => b.st === 'loiter').length, q = B.filter(b => b.st === 'queue').length, out = B.length - idle - q - B.filter(b => b.st === 'in').length;
    return '<span class="st" title="Bees out on the flowers">' + ic('bee') + out + ' <small>out</small>' + (idle ? '<small>&nbsp;· ' + idle + ' idle</small>' : '') + (q ? ' <b class="warnc">&nbsp;' + q + ' queuing</b>' : '') + '</span>' +
      meter('nectar', H.nectar, tankCap(), 'Nectar in the tank') + meter('honey', H.honey, honeyCap(), 'Honey in the hive, waiting to be jarred') + meter('jar', crateJars(), crateCap(), 'Jars in the crate' + (H.packing ? ' (' + H.gift + ' gift)' : '')) + (H.packing ? '<span class="st" title="Gift jars in the crate">' + ic('gift') + H.gift + '</span>' : '');
  }
  if (kind === 'book'){
    const v = researchRate();
    return '<span class="st big" title="' + (v > 0 ? 'Time left at this pace' : 'Time left for one robot on its own') + '">' + ic('clock') + mmss(researchETA()) + '</span>' +
      meter('research', Math.floor(S.story.prog), researchNeed(), 'Research done', 'blue') + (v > 0 ? '<span class="st" title="Research a second">' + ic('research') + v + '<small>/s</small></span>' : S.story.prog > 0 ? '<span class="st"><small>paused</small></span>' : '');
  }
  if (kind === 'bagger') return meter('leaf', S.binLeaves, binCap(), 'Loose leaves in the bin') + meter('bag', S.bag.bags, bagCap(), 'Bags in the bin') + slots('bag', busyIn('bag'), 2, 'Bagging now');
  if (kind === 'plant') return meter('hopper', Math.floor(S.plant.ore), hopperCap(), 'Ore in the hopper') + meter('ingot', S.plant.rack, RACK_CAP, 'Ingots on the rack') + meter('pallet', S.ingots, palletCap(), 'Ingots on the pallet by the road') + slots('flame', busyIn('smelt'), 3, 'Furnaces working');
  if (kind === 'bin') return meter('leaf', S.binLeaves, binCap(), 'Loose leaves') + (S.bag.built ? meter('bag', S.bag.bags, bagCap(), 'Bags') : '') + (S.metalSlot ? meter('ore', S.binMetal, metalCap(), 'Metal in the tub') : '') + (S.plant.built ? meter('ingot', S.ingots, palletCap(), 'Ingots on the pallet') : '');
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
    card.innerHTML = sayH('<div class="ch">' + (medal ? '<div class="medal' + (m.head === 'portrait' ? ' pt' : '') + '">' + medal + '</div>' : '') +
      '<div class="hd"><div class="ct">' + m.title + m.tag + '</div>' + (m.live ? '<div class="live" id="cardLive"></div>' : '') + '</div><button class="x" data-act="close" aria-label="Close">' +
      '<svg viewBox="-6 -6 12 12" aria-hidden="true"><path d="M-3,-3 L3,3 M3,-3 L-3,3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button></div>' +
      (m.tabs ? '<div class="tabs" role="tablist"><button role="tab" data-act="tab:up" class="' + (cardTab !== 'tasks' ? 'on' : '') + '">' + ic('wrench') + 'Upgrades</button><button role="tab" data-act="tab:tasks" class="' + (cardTab === 'tasks' ? 'on' : '') + '">' + ic('list') + 'Tasks<span class="peek">' + m.tabs.peek + '</span></button></div>' : '') +
      '<div class="cbody">' + m.top +
      (two ? '<div class="cols"><div class="col">' + body + '</div><div class="col">' + m.rows2.map(r => r.html).join('') + '</div></div>' : body) +
      (cardNote ? '<div class="note">' + cardNote + '</div>' : '') + m.foot + '</div>');
    card.querySelectorAll('.live').forEach(n => { n._t = ''; });
    placeCard();
  }
  const lv = $('cardLive'); if (lv){ const t = liveHTML(m.live); if (lv._t !== t){ lv._t = t; lv.innerHTML = sayH(t); } }
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
  else if (k === 'book'){ const b = bookPos(); p = { x: b.x, y: b.y - 10 }; below = 20; }
  else if (k === 'letter'){ const l = S.letters[cardOpen.i]; if (!l) return { x: W/2, y: H/2, below: 0 }; p = { x: l.x, y: l.y - 8 }; below = 16; }
  else if (k === 'sound'){ const b = sndBtn.getBoundingClientRect(); return { x: b.left + b.width/2 + 120, y: b.top, below: b.height }; }
  else return { x: W/2, y: H/2, below: 0 };
  const s = w2s(p.x, p.y);
  return { x: s.x, y: s.y, below: below*cam.z };
}
function openCard(kind, i){
  const obj = kind === 'robot' || kind === 'spot' || kind === 'blower' || kind === 'shaker' || kind === 'letter' ? kind + i : kind;
  cardOpen = { kind, i, obj };
  if (kind === 'robot'){ const r = R[i]; cardOpen.ax = r.x; cardOpen.ay = r.y - 62; }
  if (kind === 'blower' || kind === 'shaker'){ const h = HB.find(q => q.kind === kind && q.idx === i); cardOpen.ax = h.x; cardOpen.ay = h.y - 46; }
  resetArm = false; cardNote = ''; cardSig = '';
  card.hidden = false; card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
  if (kind !== 'sound') S.flags.opened = true;
  // the first time a robot's tasks are worth a look (the tip says so), its card opens on the Tasks tab
  if (kind === 'robot'){ dismissHint('unlock'); if (tasksPanel('robot', i)){ if (!hintDone('tasks') && !S.flags.taskHint) cardTab = 'tasks'; dismissHint('tasks'); if (researchOpen() && S.story.opened && !S.story.prog && !S.robots.some(c => taskOn(c, 'research'))) cardTab = 'tasks'; } }
  if (kind === 'book') S.story.opened = true;
  if (kind === 'letter') readLetter(i);
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
  if (b.dataset.lock === 'bee'){ cardNote = 'Get your first bee before the hive upgrades.'; renderCard(true); }
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
  else if (act === 'hive'){ if (!S.hive.built && hiveShown()) buy({ id:'hive', obj:'hive', cost:hiveCost() }); }
  else if (act === 'bee'){ if (S.hive.built && S.hive.bees < MAX_BEES) buy({ id:'bee', obj:'hive', cost:beeCost() }); }
  else if (act.startsWith('hiveUp:')){ const k = act.slice(7); if (HIVE_UP[k] && !S.hive.up[k]) buy({ id:'hiveUp', key:k, obj:'hive', cost:hiveUpCost() }); }
  else if (act === 'robot') buy({ id:'robot', obj:'shed', cost:robotCost(S.robots.length) });
  else if (act === 'blower' || act === 'shaker'){ if (cfgsOf(act).length < HELPER_MAX) buy({ id:act, obj:'shed', cost:helperCost(act) }); }
  else if (act === 'miner') buy({ id:'miner', arg:i, obj:'spot'+i, cost:MINER_COST });
  else if (act === 'land'){ if (landForSale()) buy({ id:'land', obj:'sale', cost:AREAS[S.land + 1].cost }); return; }
  else if (act === 'bagger'){ if (!S.bag.built) buy({ id:'bagger', obj:'bagger', cost:BAGGER_COST }); }
  else if (act === 'honeyPack'){ if (S.hive.built && !S.hive.packing) buy({ id:'honeyPack', obj:'hive', cost:HONEY_PACK_COST }); }
  else if (act === 'plant'){ if (!S.plant.built && plantShown()) buy({ id:'plant', obj:'plant', cost:PLANT_COST }); }
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
// the front faces of the bin and the workshop: a robot standing behind one can't be tapped through it
const FRONTS = () => [{ x0: BIN.x - 40, x1: S.metalSlot ? TUB.x + 17 : BIN.x + 40, y0: BIN.y - 54, y1: BIN.y }, { x0: SHED.x - 54, x1: SHED.x + 54, y0: SHED.y - 96, y1: SHED.y }];
const hiddenBehind = (r, x, y) => FRONTS().some(f => r.y < f.y1 && x > f.x0 && x < f.x1 && y > f.y0 && y < f.y1);
function hit(x, y){
  for (let i = S.letters.length - 1; i >= 0; i--){ const l = S.letters[i]; if (Math.abs(x - l.x) < 13 && y > l.y - 14 && y < l.y + 6) return ['letter', i]; }
  if (researchOpen()){
    const h = bookRt.held ? bookHolder() : null, b = bookPos();
    if (Math.abs(x - b.x) < (h ? 11 : 15) && y > b.y - (h ? 10 : 13) && y < b.y + (h ? 8 : 8)) return ['book'];
    if (h && h.st === 'study'){ const ty = h.y - 98; if (Math.abs(x - h.x) < 26 && Math.abs(y - ty) < 11) return ['book']; }
    if (!h && S.story.prog > 0 && Math.abs(x - S.story.x) < 26 && Math.abs(y - (S.story.y - 30)) < 11) return ['book'];
  }
  for (const r of [...R].sort((a,b) => b.y - a.y)){ if (r.st === 'gone') continue; const st = styleOf(r.id); if (Math.abs(x - r.x) < st.tw/2 + 8 && y < r.y + 10 && y > r.y - 62 && !hiddenBehind(r, x, y)) return ['robot', r.id]; }
  if (S.hive.built && Math.abs(x - CRATE.x) < 25 && y > CRATE.y - 62 && y < CRATE.y + 6) return ['hive'];
  if (hiveShown()){ const top = S.hive.built ? hiveTopZ() + 24 : 52; if (x > HIVE.x - (S.hive.built && LOT.hiveWide ? 48 : 24) && x < HIVE.x + (S.hive.built ? (LOT.hiveWide ? 46 : 30) : 48) && y > HIVE.y - top && y < HIVE.y + 8) return ['hive']; }
  if (Math.abs(x - SHED.x) < 58 && y > SHED.y - 98 && y < SHED.y - 44) return ['shed'];   // the shed's walls and roof win over a helper parked in front
  if (plantShown() && x > PLANT.x - 104 && x < PLANT.x + 104 && y > PLANT.y - (S.plant.built ? 120 : 60) && y < PLANT.y + 8) return ['plant'];
  if (S.plant.built && Math.abs(x - PALLET.x) < 28 && y > PALLET.y - 44 && y < PALLET.y + 6) return ['plant'];
  if (baggerShown() && Math.abs(x - BAGGER.x) < 32 && y > BAGGER.y - (S.bag.built ? 48 : 60) && y < BAGGER.y + 6) return ['bagger'];
  for (const h of [...HB].filter(q => q.st !== 'gone' && q.st !== 'ride').sort((a,b) => b.y - a.y)){ const w = helperStyle(h).bw/2 + (h.kind === 'blower' ? 12 : 20), top = h.kind === 'blower' ? 48 : 50; if (Math.abs(x - h.x) < w && y < h.y + 9 && y > h.y - top) return [h.kind, h.idx]; }
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
function showToast(main, small, secs){ const t = $('toast'); t.innerHTML = sayH(main + (small ? '<small>' + small + '</small>' : '')); t.hidden = false; t.style.opacity = 1; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.style.opacity = 0; setTimeout(() => t.hidden = true, 700); }, secs*1000); }

// ───────────────────────── save / load
// a location copy (public/locationN/, see index.html) keeps its own save, and so does every lot (V13)
const KEY = lotKey(LOT_ID);
let lotWasNew = false;   // this lot had no save yet (a fresh game, or the first time a robot rides here)
function save(){ if (simMode || FRESH || travelling) return; try { localStorage.setItem(KEY, JSON.stringify(truck.st === 'pay' ? Object.assign({}, S, { cash: S.cash + (truck.payAmt || 0) }) : S)); } catch(e){} }
function merge(base, src){ for (const k in src){ if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && base[k] && typeof base[k] === 'object') merge(base[k], src[k]); else if (k in base) base[k] = src[k]; } return base; }
function load(data){
  let src = data && data.S;
  if (!src) src = readLot(LOT_ID);
  lotWasNew = !(src && src.v === 2);
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
      const cfg = tasksFix({ prio, off: Array.isArray(r.off) ? r.off : [], miner: r.miner ?? null, lv: Object.assign(newRobotCfg().lv, r.lv || {}) }, 'robot');
      // V13: its look (when it isn't its place in the list), the lot it came from, and whether it's away on another lot
      if (r.sty != null) cfg.sty = r.sty; if (r.home != null) cfg.home = r.home; if (r.away) cfg.away = r.away;
      return cfg;
    });
    S.post = Array.isArray(src.post) ? src.post.filter(id => LETTERS[id]) : [];
    S.letters = Array.isArray(src.letters) ? src.letters.filter(l => l && LETTERS[l.id]) : [];
    S.flags.hints = Object.assign({}, (src.flags && src.flags.hints) || {});
    S.miles = Object.assign({}, src.miles || {});
    if (!(src.flags && src.flags.v12)){
      // V12: blowers and shakers now come from the old picture book. A yard that already has some knows them already:
      // the book counts as read (Research shows up as unavailable). Everyone else finds the book once they've earned $20.
      if ((src.blowers || []).length || (src.shakers || []).length){ Object.assign(S.story, { armed: true, found: true, done: true, opened: true, prog: RESEARCH_NEED }); if (S.miles.book == null) S.miles.book = 0; }
    }
    S.story.prog = clamp(+S.story.prog || 0, 0, researchNeed());
    let v7back = 0;
    const firstV7 = !(src.flags && src.flags.v7);
    if (firstV7) for (const kind of ['blower', 'shaker']) if ((src[KIND_LIST[kind]] || []).length > HELPER_MAX) v7back += OLD_HELPER5[kind];
    for (const kind of ['blower', 'shaker']) S[KIND_LIST[kind]] = (src[KIND_LIST[kind]] || []).slice(0, HELPER_MAX).map(h => {
      const c = newHelperCfg(kind); Object.assign(c.lv, h.lv || {});
      for (const k in c.lv) if (TRACKS[k]) c.lv[k] = clamp(c.lv[k] | 0, 0, TRACKS[k].vals.length - 1);   // V13.7: blow/shake have fewer levels now
      if (Array.isArray(h.prio)){ c.prio = h.prio; c.off = Array.isArray(h.off) ? h.off : []; }
      else if (kind === 'shaker' && h.job === 'flower') c.prio = [['snip'], ['shake']];
      else if (kind === 'shaker') c.prio = [['shake']];
      else c.prio = [['blow']];
      if (h.sty != null) c.sty = h.sty; if (h.home != null) c.home = h.home; if (h.away) c.away = h.away;   // V14: helpers travel too
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
      // V7: the ingot pallet's size upgrades are gone (ingots share the metal tub), the hive's tank and store have new
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
      if (back > 0){ S.cash += back; setTimeout(() => showToast('Gift wrapping', 'Wrapping gift jars is its own task now, and gift jars sell for more. You got ' + money(back) + ' back on wrapping and ribbons.', 9), 1700); }
    }
    if (v9back > 0){ S.cash += v9back; setTimeout(() => showToast('Rebalanced!', 'There are fewer veins and robot slots now. You got ' + money(v9back) + ' back for the ones that are gone.', 9), 1600); }
    for (const k in UP) S.lv[k] = clamp(S.lv[k] | 0, 0, UP[k].max);
    S.hive.bees = clamp(S.hive.bees | 0, 0, MAX_BEES); S.hive.nectar = Math.max(0, +S.hive.nectar || 0); S.hive.honey = Math.max(0, +S.hive.honey || 0);
    if (src.hive && src.hive.jars === undefined){
      // before V6.3 the hive filled the jars itself: what it held were finished jars, so they go in the crate
      S.hive.jars = Math.floor(S.hive.honey + 1e-9); S.hive.honey = 0;
      if (S.hive.built && !S.robots.some(c => taskOn(c, 'jar'))){ const c = S.robots[S.robots.length - 1]; c.prio.unshift(['jar']); tasksFix(c, 'robot'); }
    }
    S.hive.jars = Math.max(0, S.hive.jars | 0);
    if (!src.peak) S.peak = Math.max(S.cash, 0);
    if (!S.robots.length) S.robots = [newRobotCfg()];
    S.land = clamp(S.land | 0, 0, AREAS.length - 1);
    // V14: the travel money no longer comes out when it's first reached: a save that was still saving up for the prairie
    // gets the trip opened now, with the $100 to be taken at the truck
    if (S.flags.fareOpen && !S.trip && S.miles.fare == null && !S.flags.fare && LOT_ID === 'home' && !S.robots.some(c => c.away)) openTrip({ to: 'prairie', cash: TRIP_CASH }, true);
    if (S.trip && S.trip.crew) S.trip.crew = S.trip.crew.filter(k => KIND_LIST[k]);
  }
}
function seedLeaves(){ leaves = []; for (let i=0;i<Math.round(AREAS[S.land].cap*0.6);i++) spawnCollectable(true); }
function hardReset(){
  // V13: starting over wipes every lot and goes back to the first yard
  try { for (const id of ['home', ...Object.keys(window.LOTS || {})]) localStorage.removeItem(lotKey(id)); localStorage.removeItem(WORLD_KEY); } catch(e){}
  if (LOT_ID !== 'home'){ travelling = true; if (FRESH) location.search = '?fresh'; else location.reload(); return; }
  delete WORLD.arrive; driver = null; guest.on = false; truck.riders = []; truck.arriving = false;
  S = freshState(); R = []; HB = []; B = []; parts = []; pops = []; dispCash = 0; truck.st = 'away'; truck.fill = 0; resetStations();
  camFollow = null; bookRt.by = null; bookRt.held = false; bookRt.landT = 0;
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
  if (!travelling) for (let i=0;i<n;i++) step(dt*TIME_SCALE/n);   // (V13: everything stops while the page moves to another lot)
  if (camAnim){
    camAnim.t += dt;
    const e = ease(clamp(camAnim.t/camAnim.dur, 0, 1));
    cam.z = lerp(camAnim.from.z, camAnim.to.z, e); cam.ox = lerp(camAnim.from.ox, camAnim.to.ox, e); cam.oy = lerp(camAnim.from.oy, camAnim.to.oy, e);
    if (camAnim.t >= camAnim.dur) camAnim = null;
    if (cardOpen) placeCard();
  }
  panKeys(dt);
  updCamFollow(dt);
  if (!camAnim && performance.now() - camMovedT > 140 && !groundCovers()) buildGround({ z: cam.z, ox: cam.ox, oy: cam.oy });
  updHud(dt);
  if (SND){ SND.update(dt, wind); if (RAINY && SND.rain) SND.rain(dt, RAIN.k); ambientChatter(dt); }
  if (cardOpen){ renderCard(false); if ((seenT -= dt) <= 0){ seenT = 0.25; markSeen(); } }
  updHints(dt);
  if (RAINY) updRain(dt*TIME_SCALE);
  draw();
  requestAnimationFrame(frame);
}

// ───────────────────────── headless pacing simulation (balancing helper)
// the pacing sim's stand-in for a player sorting out task lists: a share of the robots bag, pack honey, smelt and haul
function simTasks(){
  // V12: the first robot reads the book while there's research, then goes back to what it did
  const c0 = S.robots[0];
  if (researchOpen() && !S.robots.some(c => taskTop(c, 'research'))){ putTop(c0, 'research'); const r = R[0]; if (r && (r.st === 'wander' || r.st === 'rest' || r.st === 'seek')){ release(r); r.st = 'idle'; } }
  else if (!researchOpen() && taskTop(c0, 'research')) putOff(c0, 'research');
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
    const keep = { S, R, HB, B, leaves, parts, pops, tst: truck.st, fl: FLOWERS.map(f => [f.full, f.t, f.claim]), stn: JSON.stringify(STN), bk: Object.assign({}, bookRt),
      drv: driver, gst: Object.assign({}, guest), riders: truck.riders, arr: truck.arriving };
    S = freshState(); R = []; HB = []; B = []; truck.st = 'away'; parts = []; pops = []; resetStations(); seedLeaves();
    driver = null; guest.on = false; truck.riders = []; truck.arriving = false;
    bookRt.by = null; bookRt.held = false; bookRt.landT = 0;
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
      if (S.t >= nextMark){ nextMark += 60; log.push('@' + Math.round(S.t/60) + 'm leaves=' + S.totals.leaves + ' metal=' + S.totals.metal + ' earned=' + S.totals.cash.toFixed(1) + ' ground=' + groundN + ' shakes=' + (S.totals.shakes || 0) + ' $/leaf=' + leafPrice().toFixed(2) + (S.hive.built ? ' bees=' + S.hive.bees + ' honey=' + (S.totals.honey || 0) + ' nectarIn=' + Math.round(S.totals.nectar || 0) + ' tank=' + Math.round(S.hive.nectar) + ' store=' + Math.floor(S.hive.honey) + ' idle=' + B.filter(b => b.st === 'loiter').length + ' q=' + B.filter(b => b.st === 'queue').length : '')); }
    }
    const gl0 = leaves.filter(l => l.st === 'ground' && l.collect), near = gl0.filter(l => Math.hypot(l.x - BIN.x, l.y - BIN.y) < 250).length;
    const out = { blown: S.totals.blown || 0, near, groundAll: gl0.length, avgD: Math.round(gl0.reduce((a, l) => a + Math.hypot(l.x - BIN.x, l.y - BIN.y), 0)/Math.max(1, gl0.length)), log, t:S.t, cash:S.cash, land:S.land, robots:S.robots.map(r => r.lv), extra:{ blowers:S.blowers.map(b => b.lv), shakers:S.shakers.map(b => b.lv), lv:S.lv }, miners:S.miners.length, totals:S.totals, miles:S.miles, story:S.story, tech:Object.keys(S.tech), jobs:S.robots.map(r => r.prio.map(row => row.join('+')).join(' > ')) };
    S = keep.S; R = keep.R; HB = keep.HB; B = keep.B; leaves = keep.leaves; parts = keep.parts; pops = keep.pops; truck.st = keep.tst; simMode = false;
    Object.assign(bookRt, keep.bk);
    driver = keep.drv; Object.assign(guest, keep.gst); truck.riders = keep.riders; truck.arriving = keep.arr;
    { const st = JSON.parse(keep.stn); for (const k in STN) STN[k] = st[k]; }
    FLOWERS.forEach((f, i) => { [f.full, f.t, f.claim] = keep.fl[i]; });
    return out;
  },
  state: () => S,
  open: (kind, i) => openCard(kind, i),
  portrait: (kind, i, cv, z) => drawPortrait(cv, kind, i, z),
  buy: o => buy(o),
  fn: () => ({ UP, GEN, offers, binCap, metalCap, hopperCap, honeyCap, tankCap, palletCap, truckEvery, bagCap, upCost, rCost, allPlan, binRoom, tubRoom, hopperRoom, plainJars, crateCap, crateJars }),   // for balance tests
  stations: () => STN,
  treeDrop: () => treeDrop(true),
  bounds: () => ({ view: visRect(), bounds: camBounds() }),
  cam: () => ({ ...cam }),
  setCam: (x, y, z) => { camAnim = null; camFollow = null; userCam = true; cam.z = z; cam.ox = W/2 - x*z; cam.oy = H/2 - y*z; buildGround(cam); },   // V13: for screenshots
  world: () => WORLD,
  robots: () => R,
  helpers: () => HB,
  bees: () => B,
  flowers: () => FLOWERS,
  leaves: () => leaves,
  w2s,
};

// dev (?fresh&lot=prairie): a new lot with nobody arriving gets a robot like one that has worked the first yard to $900
function devTraveller(){
  const c = S.robots[0] || (S.robots[0] = newRobotCfg());
  c.home = 0; Object.assign(c.lv, DEV_TRAVELLER.lv);
  for (const k of DEV_TRAVELLER.tech) S.tech[k] = true;
  S.cash = S.peak = TRIP_CASH;
  S.lv.truck = DEV_TRAVELLER.truck; S.lv.cleanup = DEV_TRAVELLER.cleanup; S.flags.helpers = true; S.flags.research = true;
  if (LOT.tripHome){
    // V14 (?fresh&lot=hollow): Tinker and a blower, like a crew sent from a first yard with a hive, a meadow and a mine
    Object.assign(c.lv, { speed: 9, carry: 11, pick: 7, grab: 4, reach: 4, drill: 3, magnet: 2 }); for (const k of ['hubs', 'diamond', 'horseshoe', 'turbine']) S.tech[k] = true;
    const b = newHelperCfg('blower'); b.home = 0; Object.assign(b.lv, { speed: 6, blow: 4 }); S.blowers = [b];
    S.cash = S.peak = HOLLOW_CASH; S.lv.truck = 3;
    openTrip({ to: 'home', crew: ['robot', 'blower'], earned: LOT.tripHome.earned }, true);
  }
}
function start(data){
  // V14: a lot can change a few robots' looks (the hollow's umbrellas) and task colours
  if (LOT.styles) for (const k in LOT.styles) Object.assign(STYLES[k], LOT.styles[k]);
  if (LOT.taskCols) for (const k in LOT.taskCols) if (TASKS[k]) TASKS[k].col = LOT.taskCols[k];
  // the helpers lot files use (see public/lots/); they only call them once the game is running
  Object.assign(LH, { ell, rr, TAU, clamp, lerp, ease, rand, mulberry, cellRnd, shade, leafPath, leafBlob, scallop, drawLeaf, chalk, keepMark, drawPlot,
    LEAFC, FOLIAGE, TREES, SPOTS, VERGE, ROAD, LANE, HIVE, TUB, PALLET, PLANT_VENT, HOPPER, RACK, RACK_CAP, mainCtx, reduceMotion,
    drawRockBed, drawBush, drawFence, FLOWER_TYPES, drawDecoFlowers, puddleTrace, puddleAt, gl, flowerSpr: () => flowerSpr,
    hiveShown, hiveFloors, hiveTopZ, honeyCap, tankCap, tankFull, beeSip, hiveRt, plantRt, STN, stoker, minerWorkers, palletCap, plantShown,
    hopperCap, metalPerIngot, metalCap, tubRoom, keepMetal });
  for (const [k, f] of Object.entries({ S: () => S, ctx: () => ctx, R: () => R, HB: () => HB, B: () => B, simMode: () => simMode, wind: () => wind,
    parts: () => parts, bubbles: () => bubbles, RAIN: () => RAIN, truck: () => truck })) Object.defineProperty(LH, k, { get: f, enumerable: true });
  LH_READY = true;
  load(data);
  // V13: arriving from another lot (or, for testing, a new lot with nobody arriving)
  let A = null;
  if (WORLD.arrive && WORLD.arrive.to === LOT_ID){ A = arrive(WORLD.arrive, lotWasNew); delete WORLD.arrive; saveWorld(); }
  else if (LOT_ID !== 'home' && lotWasNew) devTraveller();
  if (A) lotFade(true, 'Arriving at ' + lotTitle(LOT_ID) + '…', true);
  W = innerWidth; H = innerHeight;
  buildCanopies(); buildBushes(); buildFlowerSprites(); buildFlowers();
  resize();
  syncRobots(); fixSlots();
  seedLeaves();
  for (let i=0;i<10;i++) spawnAmbient();
  dispCash = S.cash;
  if (S.flags.guestBee && !S.hive.built) Object.assign(guest, { on: true, mode: 'hover' }, GUEST_SPOT());
  if (A){ arriveScene(A); save(); setTimeout(() => lotFade(false), 700); }
  addEventListener('resize', resize);
  if (window.claude && window.claude.hot && window.claude.hot.snapshot){ try { window.claude.hot.snapshot(() => ({ S })); } catch(e){} }
  requestAnimationFrame(ts => { last = ts; requestAnimationFrame(frame); });
}
const go = () => window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
if (document.fonts && document.fonts.load) Promise.race([Promise.all([document.fonts.load('700 16px Caveat'), document.fonts.load('700 14px "Baloo 2"')]), new Promise(r => setTimeout(r, 1500))]).then(go, go);
else go();
})();
