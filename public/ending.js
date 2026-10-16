// AutumNation — the ending (V20). The plan for the whole thing and for each scene is in ENDING.md.
//
// Loaded before game.js (like the lot files); game.js calls window.ENDING(helpers) once at start and gets back
// { on, start(opts), frame(dt), state() }. While it's on, the yard stands still and this file draws the whole screen
// with its own camera, in the same world units and the same 3/4 view as the yard (the road along the bottom, the
// truck's lane at y = LANE, the curb at y ≈ 5, the building's front wall just behind the gravel verge).
//
// How a scene is written: a scene is a "set" (what stands there: ground, building, machines) plus actors (robots, the
// truck), and a script. Scripts and robot jobs are generator functions run by a tiny runner: `yield 2` waits two
// seconds, `yield () => cond` waits until cond is true, `yield* walk(o, x, y)` walks there. Every robot on a factory or
// bank floor runs its own little job loop the same way, so the floor keeps going whatever the camera does.
//
// Order: the ride out of the yard (game.js, the truck camera) → FACTORY → BANK → STORAGE → back to the yard (game.js).
// Sections below: engine · drawing helpers · shared visit script · FACTORY · BANK · STORAGE · main.
window.ENDING = function(H){
'use strict';
const { rr, ell, clamp, lerp, rand, TAU, mulberry, LANE } = H;
const ease = H.ease, easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3), easeIn = t => t*t*t;

// ═════════════════════════ engine
const E = {
  on: false, t: 0, opts: null, scene: null, set: null, actors: [], parts: [], fx: [], jobs: [],
  cam: { x: 0, y: -120, z: 1 }, camTw: null, follow: null, fade: 1, fadeTw: null, main: null, skip: null,
};
// a coroutine: { it, wait, until }
function co(gen){ return { it: gen, wait: 0, until: null, done: false }; }
function stepCo(k, dt){
  if (k.done) return;
  if (k.wait > 0){ k.wait -= dt; if (k.wait > 0) return; }
  if (k.until){ if (!k.until()) return; k.until = null; }
  for (let g = 0; g < 40; g++){
    const r = k.it.next();
    if (r.done){ k.done = true; return; }
    const v = r.value;
    if (typeof v === 'number'){ if (v > 0){ k.wait = v; return; } continue; }
    if (typeof v === 'function'){ if (!v()){ k.until = v; return; } continue; }
  }
}
const job = gen => { const k = co(gen); E.jobs.push(k); return k; };

// camera: glide to a view, or follow something (the truck)
function camTo(x, y, z, dur){ E.follow = null; E.camTw = { from: Object.assign({}, E.cam), to: { x, y, z }, t: 0, dur: dur || 1.5 }; }
function camFrame(R, dur, o){ const v = frameView(R, o); camTo(v.x, v.y, v.z, dur); return v; }
function followCam(obj, dx, dy, z, snap){ E.camTw = null; E.follow = { obj, dx, dy, z, k: snap ? 1 : 0 }; if (snap){ E.cam.x = obj.x + dx; E.cam.y = (obj.camY != null ? obj.camY : obj.y) + dy; E.cam.z = z; } }
// the zoom that fits a world rectangle on screen; never so far out that the robots get tiny (then the camera pans
// across instead: see pan in the scenes)
const ZMIN = () => Math.min(0.8, H.H/600);
function frameView(R, o){
  const W = H.W, Hh = H.H, pad = (o && o.pad) || 0.94;
  let z = Math.min(W*pad/(R.x1 - R.x0), Hh*pad/(R.y1 - R.y0), (o && o.zmax) || 2.4);
  z = Math.max(z, ZMIN());
  const fits = W*pad/(R.x1 - R.x0) >= z - 1e-6;
  // too narrow to show it all (a phone held upright): centre on what matters (o.focusX), as far as the rectangle goes
  const x = fits || !o || o.focusX == null ? (R.x0 + R.x1)/2 : clamp(o.focusX, R.x0 + W/2/z, R.x1 - W/2/z);
  return { x, y: (R.y0 + R.y1)/2, z, fits };
}
function fadeTo(v, dur){ E.fadeTw = { from: E.fade, to: v, t: 0, dur: dur || 0.8 }; }
function updCam(dt){
  if (E.hold) return;
  if (E.camTw){
    const T = E.camTw; T.t += dt; const k = ease(clamp(T.t/T.dur, 0, 1));
    E.cam.x = lerp(T.from.x, T.to.x, k); E.cam.y = lerp(T.from.y, T.to.y, k); E.cam.z = lerp(T.from.z, T.to.z, k);
    if (T.t >= T.dur) E.camTw = null;
  } else if (E.follow){
    const F = E.follow, o = F.obj, tx = o.x + F.dx, ty = (o.camY != null ? o.camY : o.y) + F.dy, a = 1 - Math.pow(0.004, dt);
    E.cam.x = lerp(E.cam.x, tx, a); E.cam.y = lerp(E.cam.y, ty, a); E.cam.z = lerp(E.cam.z, F.z, 1 - Math.pow(0.12, dt));
  }
  if (E.fadeTw){ const T = E.fadeTw; T.t += dt; E.fade = lerp(T.from, T.to, clamp(T.t/T.dur, 0, 1)); if (T.t >= T.dur) E.fadeTw = null; }
}
const w2s = (x, y) => ({ x: H.W/2 + (x - E.cam.x)*E.cam.z, y: H.H/2 + (y - E.cam.y)*E.cam.z });
const view = () => { const z = E.cam.z, hw = H.W/2/z, hh = H.H/2/z; return { x0: E.cam.x - hw, x1: E.cam.x + hw, y0: E.cam.y - hh, y1: E.cam.y + hh }; };
const panOf = x => clamp((x - E.cam.x)*E.cam.z/(H.W/2), -1, 1)*0.7;

// ── actors: robots (drawn by the yard's own drawRobot) and the truck
let NEXT_ID = 200;
function bot(sty, x, y, o){
  const a = Object.assign({ ak: 'bot', id: NEXT_ID++, sty, cfg: { lv: { speed: 4, carry: 0, study: 0 }, prio: [] }, x, y, face: 1, anim: Math.random()*5, moving: false, st: 'idle',
    blink: 0, blinkT: rand(1, 4), hz: 0, carryL: 0, carryM: 0, carryI: 0, sp: 52, alpha: 1, goal: null, hold: null }, o || {});
  E.actors.push(a); return a;
}
// Tinker (or whoever rides along): the real robot, drawn with its own look, upgrades and number
function rider(i){ const r = bot(undefined, 0, 0, { id: i, sty: undefined, cfg: undefined, sp: 50 }); delete r.sty; delete r.cfg; r.voice = i ? Math.min(13, i + 6) : 0; return r; }
function updBot(o, dt){
  o.anim += dt; o.moving = false;
  o.blinkT -= dt; if (o.blinkT < 0){ o.blink = 0.14; o.blinkT = rand(2, 5); } if (o.blink > 0) o.blink -= dt;
  if (o.hop){
    const h = o.hop, k = clamp((h.t += dt)/h.dur, 0, 1);
    o.x = lerp(h.x0, h.x1, k); o.y = lerp(h.y0, h.y1, k); o.hz = Math.sin(k*Math.PI)*36; o.face = h.x1 >= h.x0 ? 1 : -1; o.moving = true;
    if (k >= 1){ o.hz = 0; o.hop = null; o.moving = false; o.st = h.end; }
    return;
  }
  if (o.goal){
    const g = o.goal, dx = g.x - o.x, dy = g.y - o.y, d = Math.hypot(dx, dy), sp = (g.sp || o.sp)*dt;
    if (Math.abs(dx) > 0.5) o.face = dx > 0 ? 1 : -1;
    if (d <= sp){ o.x = g.x; o.y = g.y; o.goal = g.next.length ? { x: g.next[0].x, y: g.next[0].y, sp: g.sp, next: g.next.slice(1) } : null; }
    else { o.x += dx/d*sp; o.y += dy/d*sp; o.moving = true; }
    if (!o.goal && g.face) o.face = g.face;
  }
}
// walk through points ([x, y] pairs or {x, y}); yield* walk(o, ...) waits until it's there
function go(o, pts, sp, face){
  const P = pts.map(p => Array.isArray(p) ? { x: p[0], y: p[1] } : p);
  o.goal = { x: P[0].x, y: P[0].y, sp, next: P.slice(1), face };
}
// wait until cond is true, but never longer than secs
function within(secs, cond){ const t0 = E.t; return () => cond() || E.t - t0 > secs; }
function* walk(o, pts, sp, face){ go(o, pts, sp, face); yield () => !o.goal; }
function hop(o, x1, y1, end){ o.hop = { t: 0, dur: 0.9, x0: o.x, y0: o.y, x1, y1, end: end || 'idle' }; o.st = 'hop'; }
// a little speech note over a robot ("!", "ooh")
// NO DIALOG TEXT from any robot in the ending, ever (the player doesn't want words, "Welcome!" came back more than once).
// say() is kept only so a call can't crash; it makes the robot's beep and shows nothing.
function say(o, text, dur, mood){ if (mood !== false) beep(o, mood || 'happy'); }
function beep(o, mood){ sfx('beep', o.sty && o.sty.driver ? 3 : (o.voice != null ? o.voice : 2 + (o.id % 6)), mood || 'chat', panOf(o.x), 0.7, true); }

// the truck: the yard's own, drawn at x; its riders stand in the back
const RIDE_Y = LANE - 56;
function makeTruck(x){ const T = { ak: 'truck', x, y: LANE, rot: 0, v: 0, riders: [], cash: 0, camY: LANE - 40 }; E.truck = T; return T; }
function rideSpot(T, o){ const n = T.riders.length, k = Math.max(0, T.riders.indexOf(o)); return { x: T.x + (n > 1 ? [20, 50][k] : 34), y: RIDE_Y }; }
function board(T, o){ if (!T.riders.includes(o)) T.riders.push(o); const p = rideSpot(T, o); o.x = p.x; o.y = p.y; o.st = 'ride'; o.face = -1; }
function* truckArrive(T, xs, dur){
  const x0 = T.x, t0 = E.t;
  sfx('truckIn', panOf(xs), Math.min(3, dur));
  yield () => { const k = clamp((E.t - t0)/dur, 0, 1), nx = lerp(x0, xs, easeOut(k)); T.rot -= (T.x - nx)/10; T.x = nx; return k >= 1; };
}
function updTruck(T, dt){
  if (T.acc) T.v = Math.min(T.vmax || 260, T.v + T.acc*dt);
  if (T.v > 0){ T.x -= T.v*dt; T.rot -= T.v*dt/10; if (Math.random() < dt*8) E.parts.push({ k: 'puff', x: T.x + 74, y: LANE - 10, vx: rand(10, 30), vy: rand(-16, -8), life: rand(.7, 1.2), t: 0, r: rand(2.5, 4.5), col: 'rgba(200,196,190,.55)', out: true }); }
  for (const o of T.riders) if (o.st === 'ride'){ const p = rideSpot(T, o); o.x = p.x; o.y = p.y; }
}

// particles and flying things (cash into the truck, sparks, shreds, steam)
function updParts(dt){
  for (const p of E.parts){
    p.t += dt;
    if (p.k === 'fly'){ continue; }
    p.x += (p.vx || 0)*dt; p.y += (p.vy || 0)*dt; if (p.g) p.vy += p.g*dt;
  }
  E.parts = E.parts.filter(p => p.t < p.life);
  for (const f of E.fx) f.t += dt;
  E.fx = E.fx.filter(f => f.t < f.life);
}
function fly(kind, x0, y0, x1, y1, dur, arc, o){ E.parts.push(Object.assign({ k: 'fly', kind, x0, y0, x1, y1, dur, arc, t: 0, life: dur, rot: rand(0, TAU) }, o || {})); }
function sparks(x, y, n, col){ for (let i = 0; i < n; i++){ const a = rand(-Math.PI, 0), v = rand(30, 110); E.parts.push({ k: 'spark', x, y, vx: Math.cos(a)*v, vy: Math.sin(a)*v, g: 160, life: rand(.3, .7), t: 0, col }); } }
function puff(x, y, col, r){ E.parts.push({ k: 'puff', x, y, vx: rand(-6, 6), vy: rand(-22, -12), life: rand(1, 1.8), t: 0, r: r || rand(3, 6), col }); }

// ═════════════════════════ drawing helpers
const PAL = { grass: '#6f7d3a', grass2: '#7e8c44', verge: '#b9a98a', curb: '#d2c4a8', curb2: '#a99a80', road: '#57504a', road2: '#4c4540' };
const LEAF_TONES = ['#c0432a', '#d9662a', '#e8a033', '#b8452d', '#d98a2b', '#9c3a24', '#e3b54a'];
// the ground: grass behind, the gravel verge, the curb, the road with its dashes, a few fallen leaves
function drawGround(c, V){
  c.fillStyle = PAL.grass; c.fillRect(V.x0, V.y0, V.x1 - V.x0, -30 - V.y0);
  const CS = 160, i0 = Math.floor(V.x0/CS), i1 = Math.ceil(V.x1/CS), j0 = Math.floor(V.y0/CS), j1 = Math.min(0, Math.ceil(-30/CS));
  for (let i = i0; i < i1; i++) for (let j = j0; j < j1; j++){
    const rnd = mulberry((i*73856093) ^ (j*19349663) ^ 77);
    c.fillStyle = 'rgba(126,140,68,.55)'; for (let k = 0; k < 5; k++){ ell(c, (i + rnd())*CS, Math.min(-34, (j + rnd())*CS), 18 + rnd()*26, 7 + rnd()*9); c.fill(); }
    c.strokeStyle = 'rgba(70,84,36,.6)'; c.lineWidth = 1.2; for (let k = 0; k < 10; k++){ const x = (i + rnd())*CS, y = Math.min(-34, (j + rnd())*CS); c.beginPath(); c.moveTo(x, y); c.lineTo(x + rnd()*3 - 1.5, y - 3 - rnd()*4); c.stroke(); }
    for (let k = 0; k < 4; k++){ const x = (i + rnd())*CS, y = Math.min(-34, (j + rnd())*CS); H.stampLeaf(c, x, y, 4.6, rnd()*TAU, Math.floor(rnd()*H.LEAFC.length), rnd() < .5 ? 1 : 0, 1, .72, 1); }
  }
  c.fillStyle = PAL.verge; c.fillRect(V.x0, -30, V.x1 - V.x0, 30);
  for (let i = Math.floor(V.x0/80); i < Math.ceil(V.x1/80); i++){
    const rnd = mulberry(i*9173 + 5);
    for (let k = 0; k < 26; k++){ c.fillStyle = ['#a2937a', '#cdbfa3', '#988a72', '#d8ccb3'][Math.floor(rnd()*4)]; ell(c, (i + rnd())*80, -27 + rnd()*26, 1 + rnd()*1.6, 0.8 + rnd()*1.1); c.fill(); }
  }
  c.fillStyle = PAL.curb; c.fillRect(V.x0, 0, V.x1 - V.x0, 6); c.fillStyle = PAL.curb2; c.fillRect(V.x0, 6, V.x1 - V.x0, 2);
  const g = c.createLinearGradient(0, 8, 0, 160); g.addColorStop(0, PAL.road); g.addColorStop(1, PAL.road2);
  c.fillStyle = g; c.fillRect(V.x0, 8, V.x1 - V.x0, Math.max(0, V.y1 - 8));
  c.fillStyle = 'rgba(232,214,160,.75)'; for (let x = Math.floor(V.x0/54)*54; x < V.x1; x += 54){ rr(c, x, LANE + 18, 28, 3.2, 1.5); c.fill(); }
  for (let i = Math.floor(V.x0/120); i < Math.ceil(V.x1/120); i++){ const rnd = mulberry(i*311 + 9); H.stampLeaf(c, (i + rnd())*120, 14 + rnd()*80, 4.6, rnd()*TAU, Math.floor(rnd()*H.LEAFC.length), 1, 1, .7, .55); }
}
// roadside trees, drawn once into small pictures and stamped
const treeCache = {};
function treeSprite(seed){
  if (treeCache[seed]) return treeCache[seed];
  const rnd = mulberry(seed*977 + 13), R = 34 + rnd()*22, S2 = 2, w = Math.ceil(R*2.6), h = Math.ceil(R*2.9);
  const cv = document.createElement('canvas'); cv.width = w*S2; cv.height = h*S2;
  const g = cv.getContext('2d'); g.scale(S2, S2); g.translate(w/2, h - 6);
  g.fillStyle = 'rgba(30,24,10,.3)'; ell(g, 6, 0, R*0.9, R*0.25); g.fill();
  g.fillStyle = '#5a3b26'; g.beginPath(); g.moveTo(-5, 0); g.lineTo(-3, -R*0.9); g.lineTo(3, -R*0.9); g.lineTo(5, 0); g.closePath(); g.fill();
  const fam = [['#7c2a1a', '#a8361f', '#c9512a', '#e07a3a'], ['#8a4a16', '#b8671f', '#d9912e', '#efbd55'], ['#6e5a1c', '#9a8228', '#c4a838', '#e3cf62'], ['#7a3018', '#b0482a', '#d9682e', '#f0a050']][Math.floor(rnd()*4)];
  const cl = []; for (let k = 0; k < 13; k++){ const a = rnd()*TAU, d = rnd()*R*0.55; cl.push({ x: Math.cos(a)*d*1.15, y: -R*1.25 + Math.sin(a)*d*0.85, r: R*(0.36 + rnd()*0.22) }); }
  cl.sort((a, b) => a.y - b.y);
  g.fillStyle = fam[0]; for (const k of cl){ ell(g, k.x + 2, k.y + 3, k.r + 2, k.r*0.9 + 2); g.fill(); }
  for (const k of cl){ g.fillStyle = fam[1]; ell(g, k.x, k.y, k.r, k.r*0.88); g.fill(); g.fillStyle = fam[2]; ell(g, k.x - k.r*0.22, k.y - k.r*0.24, k.r*0.66, k.r*0.56); g.fill(); g.fillStyle = fam[3]; ell(g, k.x - k.r*0.36, k.y - k.r*0.4, k.r*0.28, k.r*0.22); g.fill(); }
  for (let k = 0; k < 26; k++){ const a = rnd()*TAU, d = rnd()*R*0.9; H.drawLeaf(g, Math.cos(a)*d, -R*1.25 + Math.sin(a)*d*0.8, 3.4, rnd()*TAU, Math.floor(rnd()*H.LEAFC.length), 1, 1, .8, 1, 0); }
  return (treeCache[seed] = { cv, w, h });
}
function drawTree(c, x, y, seed, s){ const T = treeSprite(seed % 9); const k = s || 1; c.drawImage(T.cv, x - T.w/2*k, y - (T.h - 6)*k, T.w*k, T.h*k); }
// roadside things between the buildings: trees, lamp posts, a wooden fence (skipped where a building stands)
function scenery(V, list, skip){
  const SEG = 150;
  for (let i = Math.floor(V.x0/SEG) - 1; i <= Math.ceil(V.x1/SEG) + 1; i++){
    const rnd = mulberry(i*4241 + 101), x = i*SEG + rnd()*60;
    if (skip && skip(x)) continue;
    const kind = rnd();
    if (kind < 0.62){ const y = -46 - rnd()*90, seed = Math.floor(rnd()*9), sc = 0.9 + rnd()*0.3; list.push({ y, f: c => drawTree(c, x, y, seed, sc) }); }
    if (rnd() < 0.35){ const lx = i*SEG + 110; if (!(skip && skip(lx))) list.push({ y: -14, f: c => lampPost(c, lx, -14) }); }
    if (rnd() < 0.5){ const fx = i*SEG + 20; if (!(skip && (skip(fx) || skip(fx + 100)))) list.push({ y: -40, f: c => fence(c, fx, -40, 110) }); }
  }
}
function lampPost(c, x, y){
  c.fillStyle = 'rgba(30,24,12,.3)'; ell(c, x + 3, y + 1, 7, 2.4); c.fill();
  c.fillStyle = '#3d3734'; rr(c, x - 1.6, y - 70, 3.2, 70, 1); c.fill(); rr(c, x - 4, y - 3, 8, 4, 1); c.fill();
  c.strokeStyle = '#3d3734'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(x, y - 68); c.quadraticCurveTo(x + 2, y - 78, x + 12, y - 76); c.stroke();
  c.fillStyle = '#3d3734'; c.beginPath(); c.moveTo(x + 6, y - 76); c.lineTo(x + 18, y - 76); c.lineTo(x + 15, y - 70); c.lineTo(x + 9, y - 70); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,214,140,.85)'; ell(c, x + 12, y - 69.5, 3.4, 1.4); c.fill();
}
function fence(c, x, y, w){
  c.strokeStyle = '#8a6a48'; c.lineWidth = 2.4; for (const yy of [y - 9, y - 16]){ c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy); c.stroke(); }
  c.fillStyle = '#7a5a3c'; for (let k = 0; k <= w; k += 22){ rr(c, x + k - 2, y - 22, 4, 22, 1); c.fill(); }
}
// a heap of fallen leaves (the bank's curb), drawn once into a picture
const heapCache = {};
function leafHeap(seed, w, h){
  const key = seed + ':' + w + ':' + h; if (heapCache[key]) return heapCache[key];
  const S2 = 2.2, cw = Math.ceil(w + 20), ch = Math.ceil(h + 24), cv = document.createElement('canvas'); cv.width = cw*S2; cv.height = ch*S2;
  const g = cv.getContext('2d'); g.scale(S2, S2); g.translate(cw/2, ch - 8);
  g.fillStyle = 'rgba(40,24,10,.35)'; ell(g, 4, 0, w*0.56, 9); g.fill();
  g.fillStyle = '#7c3a1c'; g.beginPath(); g.moveTo(-w/2, 0); g.bezierCurveTo(-w*0.42, -h*0.9, w*0.42, -h*0.9, w/2, 0); g.closePath(); g.fill();
  const rnd = mulberry(seed);
  for (let i = 0; i < w*h/9; i++){
    const u = rnd()*2 - 1, top = -h*0.75*(1 - u*u), y = top*rnd()*0.96;
    H.drawLeaf(g, u*w/2*0.97, y, 4.4 + rnd()*1.6, rnd()*TAU, Math.floor(rnd()*H.LEAFC.length), rnd() < .5 ? 1 : 0, 1, .8, 1, y > top*0.5 ? 0.25 : 0);
  }
  return (heapCache[key] = { cv, cw, ch });
}
function drawHeap(c, x, y, seed, w, h){ const P = leafHeap(seed, w, h); c.drawImage(P.cv, x - P.cw/2, y - P.ch + 8, P.cw, P.ch); }

// ── a building you can look into: the front wall and the roof fade away once you're inside (B.reveal 0 → 1), and a
// low wall with the doorways stays. B: { x0, x1, yb (back), yf (front), h (wall height), doors: [{ x, w, h }], reveal,
// floor(c), back(c) (the inside of the back wall), facade(c) (details on the front wall), roof(c) }
function drawShell(c, B){
  const w = B.x1 - B.x0, a = 1 - B.reveal;
  // side walls (thin, always there), then the low front wall with its doorways
  c.fillStyle = B.side || '#7f7468'; c.fillRect(B.x0 - 8, B.yb - B.h, 8, B.yf - B.yb + B.h); c.fillRect(B.x1, B.yb - B.h, 8, B.yf - B.yb + B.h);
  c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(B.x0 - 8, B.yb - B.h, 8, 2); c.fillRect(B.x1, B.yb - B.h, 8, 2);
  if (a < 1){
    const stub = 9; let x = B.x0 - 8;
    c.fillStyle = B.stub || B.wall;
    for (const d of B.doors.slice().sort((p, q) => p.x - q.x)){ c.fillRect(x, B.yf - stub, d.x - d.w/2 - x, stub + 2); x = d.x + d.w/2; }
    c.fillRect(x, B.yf - stub, B.x1 + 8 - x, stub + 2);
    c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(B.x0 - 8, B.yf - stub, w + 16, 1.5);
  }
  if (a <= 0) return;
  c.save(); c.globalAlpha = a;
  // the front wall: a solid face with open doorways (you see a little way in, in shadow)
  c.fillStyle = B.wall; c.beginPath(); c.rect(B.x0 - 8, B.yf - B.h, w + 16, B.h);
  for (const d of B.doors) c.rect(d.x + d.w/2, B.yf - d.h, -d.w, d.h);   // (the opposite winding cuts the doorway out)
  c.fill('evenodd');
  for (const d of B.doors){ const g = c.createLinearGradient(0, B.yf - d.h, 0, B.yf); g.addColorStop(0, 'rgba(20,14,10,.8)'); g.addColorStop(1, 'rgba(20,14,10,.35)'); c.fillStyle = g; c.fillRect(d.x - d.w/2, B.yf - d.h, d.w, d.h); }
  if (B.facade) B.facade(c, a);
  if (B.roof) B.roof(c, a);
  c.restore();
}

// ═════════════════════════ the robots' looks in the ending (registered on the yard's ROBOT_LOOKS)
// hard hats for the factory crew; a vest, a bow tie and a green eyeshade for the bank's
const LOOKS = H.ROBOT_LOOKS;
LOOKS.hardhat = (part, c, r, g) => {
  if (part === 'body'){
    // a high-vis stripe across the front
    const { bw, bh, top } = g; c.fillStyle = 'rgba(242,170,40,.85)'; c.fillRect(-bw/2, top + bh*0.62, bw, 3); c.fillStyle = 'rgba(255,255,230,.7)'; c.fillRect(-bw/2, top + bh*0.62 + 1, bw, 0.9);
    return;
  }
  if (part !== 'antenna') return;
  const { hx0, hy0, hw, hh } = g;
  c.fillStyle = '#f2c230'; c.beginPath(); c.ellipse(hx0 + hw/2, hy0 + 1, hw/2 + 1.5, hh*0.66, 0, Math.PI, 0); c.closePath(); c.fill();
  c.fillStyle = '#d9a41f'; rr(c, hx0 - 2.5, hy0 - 0.4, hw + 5, 2.4, 1.1); c.fill();
  c.fillStyle = '#e0ad22'; c.fillRect(hx0 + hw/2 - 1, hy0 - hh*0.62, 2, hh*0.6);
  c.fillStyle = 'rgba(255,250,220,.6)'; ell(c, hx0 + hw*0.32, hy0 - hh*0.34, 2.2, 1); c.fill();
  return true;
};
LOOKS.banker = (part, c, r, g) => {
  if (part === 'body'){
    const { bw, bh, top } = g;
    c.fillStyle = '#f4efe2'; c.beginPath(); c.moveTo(-bw*0.18, top); c.lineTo(bw*0.18, top); c.lineTo(0, top + bh*0.55); c.closePath(); c.fill();   // shirt front
    c.fillStyle = r.sty.vest || '#2f5a3a';
    c.beginPath(); c.moveTo(-bw/2, top + 2); c.lineTo(-bw*0.16, top); c.lineTo(0, top + bh*0.58); c.lineTo(bw*0.16, top); c.lineTo(bw/2, top + 2); c.lineTo(bw/2, top + bh); c.lineTo(-bw/2, top + bh); c.closePath(); c.fill();
    c.fillStyle = '#d9b75a'; for (const k of [0.7, 0.86]){ ell(c, bw*0.05, top + bh*k, 0.9, 0.9); c.fill(); }
    c.fillStyle = r.sty.tie || '#a8361d';   // bow tie
    c.beginPath(); c.moveTo(0, top + 1.5); c.lineTo(-3.4, top - 0.6); c.lineTo(-3.4, top + 3.6); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(0, top + 1.5); c.lineTo(3.4, top - 0.6); c.lineTo(3.4, top + 3.6); c.closePath(); c.fill();
    ell(c, 0, top + 1.5, 1.1, 1.1); c.fill();
    return;
  }
  if (part !== 'antenna') return;
  const { ax, ay, hx0, hy0, hw, hh } = g;
  c.strokeStyle = '#4a423b'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(ax - 2, ay - 4, ax - 4, ay - 7); c.stroke();
  c.fillStyle = '#d9b75a'; ell(c, ax - 4, ay - 7.5, 1.8, 1.8); c.fill();
  // the green eyeshade (V21: more like the real thing): a stitched band round the head with a little brass buckle at the
  // back, and a stiff see-through green celluloid brim curving out over the eye, bound at the edge, that tints the face
  // under it green
  const bx0 = hx0 - 0.8, bw2 = hw + 1.6, byy = hy0 + 0.6, bh2 = 3.6;
  { const sh = c.createLinearGradient(0, byy + bh2, 0, byy + bh2 + hh*0.5); sh.addColorStop(0, 'rgba(40,150,90,.32)'); sh.addColorStop(1, 'rgba(40,150,90,0)'); c.fillStyle = sh; c.fillRect(hx0, byy + bh2, hw, hh*0.5); }
  c.fillStyle = '#245a38'; rr(c, bx0, byy, bw2, bh2, 1.2); c.fill();
  c.fillStyle = '#3a7d52'; c.fillRect(bx0 + 0.6, byy + 0.3, bw2 - 1.2, 1);
  c.strokeStyle = 'rgba(200,235,210,.55)'; c.lineWidth = 0.35; c.setLineDash([0.9, 0.9]); c.beginPath(); c.moveTo(bx0 + 1, byy + bh2 - 0.9); c.lineTo(bx0 + bw2 - 1, byy + bh2 - 0.9); c.stroke(); c.setLineDash([]);
  c.fillStyle = '#d9b75a'; rr(c, bx0 + 0.6, byy + 0.5, 2.2, 2.6, 0.5); c.fill(); c.fillStyle = '#245a38'; c.fillRect(bx0 + 1.3, byy + 1.3, 0.8, 1);
  // the brim, seen from the front and a little above: a wide shallow crescent of green celluloid standing out over the
  // eye (a little toward where the robot faces), darker at the band, bound at its edge, with a shine along it
  const sx = 1.2, L0 = hx0 - 3.2 + sx, L1 = hx0 + hw + 3.2 + sx, mid = (L0 + L1)/2, tY = byy + bh2 - 0.6, dip = 4.6 + hw*0.06;
  const brim = () => { c.beginPath(); c.moveTo(L0, tY); c.quadraticCurveTo(mid, tY - 1.4, L1, tY); c.quadraticCurveTo(L1 + 0.6, tY + 1.6, L1 - 1.2, tY + 2.4); c.quadraticCurveTo(mid, tY + dip*1.6, L0 + 1.2, tY + 2.4); c.quadraticCurveTo(L0 - 0.6, tY + 1.6, L0, tY); c.closePath(); };
  const bg = c.createLinearGradient(0, tY - 1, 0, tY + dip + 1); bg.addColorStop(0, 'rgba(26,104,58,.95)'); bg.addColorStop(0.55, 'rgba(56,160,96,.7)'); bg.addColorStop(1, 'rgba(130,220,160,.5)');
  brim(); c.fillStyle = bg; c.fill();
  c.strokeStyle = 'rgba(16,56,32,.95)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(L1 - 1.2, tY + 2.4); c.quadraticCurveTo(mid, tY + dip*1.6, L0 + 1.2, tY + 2.4); c.stroke();
  c.strokeStyle = 'rgba(235,255,240,.8)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(L0 + 3, tY + 2.2); c.quadraticCurveTo(mid - 2, tY + dip*1.15, mid + hw*0.18, tY + dip*0.8); c.stroke();
  return true;
};
LOOKS.twin = (part, c, r, g) => { if (part !== 'antenna') return; const { ax, ay, hw } = g; c.strokeStyle = '#4a423b'; c.lineWidth = 1.2; for (const dx of [0, hw*0.55]){ c.beginPath(); c.moveTo(ax + dx, ay); c.lineTo(ax + dx - 2, ay - 8); c.stroke(); c.fillStyle = r.sty.lamp || '#7fd0c0'; ell(c, ax + dx - 2, ay - 8.6, 1.9, 1.9); c.fill(); } return true; };
LOOKS.dome = (part, c, r, g) => { if (part !== 'antenna') return; const { hx0, hy0, hw } = g; c.fillStyle = 'rgba(200,235,245,.55)'; c.beginPath(); c.ellipse(hx0 + hw/2, hy0 + 1, hw*0.36, 6, 0, Math.PI, 0); c.closePath(); c.fill(); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 0.7; c.beginPath(); c.arc(hx0 + hw*0.42, hy0 - 1, 3.4, 3.6, 4.6); c.stroke(); c.fillStyle = r.sty.lamp || '#ff7a4d'; ell(c, hx0 + hw/2, hy0 - 2, 1.6, 1.6); c.fill(); return true; };
LOOKS.scope = (part, c, r, g) => { if (part !== 'antenna') return; const { ax, ay } = g; c.strokeStyle = '#5a524a'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(ax + 2, ay); c.lineTo(ax + 2, ay - 9); c.lineTo(ax + 7, ay - 9); c.stroke(); c.fillStyle = '#2a2420'; ell(c, ax + 8, ay - 9, 2.2, 2.2); c.fill(); c.fillStyle = r.sty.lamp || '#ffc457'; ell(c, ax + 8.4, ay - 9, 1.2, 1.2); c.fill(); return true; };

// a style for an ending robot: one of the yard's body shapes with new colours (shape: an index into STYLES)
function look(shape, o){
  const base = H.STYLES[shape] || H.STYLES[0], s = {};
  for (const k of ['bw', 'bh', 'hw', 'hh', 'tw', 'slim', 'chunky', 'round', 'bandW']) if (base[k] != null) s[k] = base[k];
  return Object.assign(s, { name: '', rust: 0, noPlate: true }, o);
}

// ── little things the robots carry and the machines make
function itemShell(c, x, y, s){
  c.save(); c.translate(x, y); c.scale(s || 1, s || 1);
  c.fillStyle = 'rgba(30,24,12,.22)'; ell(c, 0.5, 0.5, 7, 1.6); c.fill();
  const g = c.createLinearGradient(0, -12, 0, 0); g.addColorStop(0, '#cfd5d8'); g.addColorStop(1, '#858e93');
  c.fillStyle = g; rr(c, -7, -12, 14, 12, 3.5); c.fill();
  c.fillStyle = '#6b7276'; c.fillRect(-7, -7.5, 14, 2);
  c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(-5, -11, 6, 1);
  c.fillStyle = '#5d6569'; for (const px of [-5, 5]){ ell(c, px, -2.5, 0.7, 0.7); c.fill(); }
  c.restore();
}
function itemTread(c, x, y, s){
  c.save(); c.translate(x, y); c.scale(s || 1, s || 1);
  c.fillStyle = 'rgba(30,24,12,.22)'; ell(c, 0.5, 0.5, 8, 1.6); c.fill();
  c.fillStyle = '#2f2b29'; rr(c, -8, -6, 16, 6, 3); c.fill();
  c.fillStyle = '#b8ad9c'; for (const px of [-4.5, 0, 4.5]){ ell(c, px, -3, 1.6, 1.6); c.fill(); }
  c.fillStyle = '#4a4440'; for (let k = -7; k < 8; k += 2.5) c.fillRect(k, -6.6, 1.1, 1);
  c.restore();
}
function itemCash(c, x, y, s, rot){
  c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.scale(s || 1, s || 1);
  c.fillStyle = 'rgba(20,30,10,.25)'; ell(c, 0.5, 0.6, 7.5, 1.5); c.fill();
  c.fillStyle = '#3f7a35'; rr(c, -7, -5, 14, 5, 1); c.fill();
  c.fillStyle = '#6fae55'; rr(c, -7, -6.2, 14, 4, 1); c.fill();
  c.strokeStyle = 'rgba(230,250,210,.6)'; c.lineWidth = 0.5; rr(c, -6, -5.6, 12, 2.8, 0.6); c.stroke();
  c.fillStyle = 'rgba(230,250,210,.7)'; ell(c, -3.6, -4.2, 0.9, 0.9); c.fill(); ell(c, 3.6, -4.2, 0.9, 0.9); c.fill();
  c.fillStyle = '#f2e7cf'; c.fillRect(-1.4, -6.4, 2.8, 6.4);
  c.restore();
}
function itemBucket(c, x, y, s, fill, col){
  c.save(); c.translate(x, y); c.scale(s || 1, s || 1);
  c.strokeStyle = '#5d6669'; c.lineWidth = 0.8; c.beginPath(); c.arc(0, -7, 4.4, Math.PI, 0); c.stroke();
  c.fillStyle = '#8f999c'; c.beginPath(); c.moveTo(-4.6, -7); c.lineTo(4.6, -7); c.lineTo(3.6, 0); c.lineTo(-3.6, 0); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-3.4, -6, 1.2, 5);
  if (fill){ c.fillStyle = col || '#4f9a3c'; ell(c, 0, -7, 4.2, 1.2); c.fill(); }
  else { c.fillStyle = '#5d6669'; ell(c, 0, -7, 4.2, 1.2); c.fill(); }
  c.restore();
}
function itemJug(c, x, y, s, tilt, col){
  c.save(); c.translate(x, y); c.rotate(tilt || 0); c.scale(s || 1, s || 1);
  c.fillStyle = col || '#9fc4d8'; rr(c, -3.4, -9, 6.8, 9, 2); c.fill();
  c.fillStyle = 'rgba(255,255,255,.45)'; c.fillRect(-2.4, -8, 1, 6);
  c.fillStyle = '#e8e2d1'; rr(c, -1.6, -11.5, 3.2, 3, 0.8); c.fill();
  c.restore();
}
function itemClipboard(c, x, y){ c.fillStyle = '#9a6a3c'; rr(c, x - 4, y - 10, 8, 10, 1); c.fill(); c.fillStyle = '#f4ecd8'; c.fillRect(x - 3, y - 8.5, 6, 7.5); c.fillStyle = '#6a6460'; c.fillRect(x - 1.5, y - 10.6, 3, 1.6); c.strokeStyle = 'rgba(80,70,60,.6)'; c.lineWidth = 0.5; for (const yy of [-6.6, -5, -3.4]){ c.beginPath(); c.moveTo(x - 2.2, y + yy); c.lineTo(x + 2.2, y + yy); c.stroke(); } }
function itemTorch(c, x, y){ c.fillStyle = '#4a4440'; rr(c, x - 1, y - 2, 7, 3, 1); c.fill(); c.fillStyle = '#9aa0a4'; c.fillRect(x + 5, y - 1.2, 3, 1.4); }
function itemWrench(c, x, y){ c.strokeStyle = '#8f999c'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 6, y - 6); c.stroke(); c.lineWidth = 1; c.beginPath(); c.arc(x + 7, y - 7, 1.8, 0.8, 5.4); c.stroke(); }
// a can of mushrooms (as in the Rainy hollow)
function drawCan(c, x, y, s){
  c.save(); c.translate(x, y); c.scale(s/6, s/6);
  const g = c.createLinearGradient(-3.6, 0, 3.6, 0); g.addColorStop(0, '#e2e8ea'); g.addColorStop(0.35, '#b9c2c6'); g.addColorStop(1, '#7d878c');
  c.fillStyle = g; c.fillRect(-3.6, -4.2, 7.2, 8.6); ell(c, 0, 4.4, 3.6, 0.9); c.fill();
  c.fillStyle = '#efe3c4'; c.fillRect(-3.6, -2.4, 7.2, 4.6);
  c.fillStyle = '#efe9dc'; c.fillRect(-0.45, 0, 0.9, 1.4);
  c.fillStyle = '#c4281c'; c.beginPath(); c.ellipse(0, 0.1, 1.9, 1.5, 0, Math.PI, 0); c.closePath(); c.fill();
  c.fillStyle = '#fbf6ea'; ell(c, -0.7, -0.6, 0.35, 0.3); c.fill();
  c.fillStyle = '#9aa4aa'; ell(c, 0, -4.2, 3.6, 1); c.fill(); c.fillStyle = '#d6dde0'; ell(c, 0, -4.3, 3.1, 0.75); c.fill();
  c.restore();
}
// a honey jar like the first yard's (drawn here, so it looks the same wherever the ending runs)
function drawHoney(c, x, y, s){
  c.save(); c.translate(x, y); c.scale(s/6, s/6);
  c.fillStyle = '#c47d1c'; rr(c, -4, -3.5, 8, 8.5, 2.4); c.fill();
  c.fillStyle = '#eba53a'; rr(c, -3.4, -3, 6.8, 7.4, 2); c.fill();
  c.fillStyle = 'rgba(255,240,190,.55)'; rr(c, -2.6, -2.2, 1.4, 5, 0.7); c.fill();
  c.fillStyle = '#f2e3c4'; c.fillRect(-3.4, -0.4, 6.8, 2.6);
  c.fillStyle = '#7c5a3c'; rr(c, -3.6, -5.6, 7.2, 2.6, 1); c.fill();
  c.restore();
}
const holding = f => (c, hx, hy, r) => f(c, hx, hy, r);

// ═════════════════════════ the visit: arrive, get out, walk in, see the inside, walk out, drive on
// (the factory and the bank use it; sc: the scene, see makeFactory for what it has)
const zClose = () => clamp(H.W/(170*2.5), 1.1, 2.6);
// V21: how close the camera goes when it follows the work from one step to the next (the factory's and the bank's tour)
const zTour = () => clamp(Math.min(H.W/300, H.H/190), 1.3, 3.1);
// V21: while the tour is on an earlier step, the steps after it run slower (not stopped: robots keep carrying and
// sweeping), so the next step is still going on when the camera gets there. sc.focus: the step the camera is on.
const tempo = (sc, step) => sc.focus == null || sc.focus >= step ? 1 : 0.6;
function* visit(sc){
  const B = sc.B, T = E.truck, tk = E.tinker, dr = E.driver;
  T.x = sc.stopX + 1100; T.v = 0; T.riders = []; board(T, tk);
  dr.hidden = true; followCam(T, -10, -6, zClose(), true);
  fadeTo(0, 0.9);
  yield* truckArrive(T, sc.stopX, 5);
  sfx('horn', panOf(T.x));
  camFrame(sc.frame, 2.4, { focusX: sc.door.x + 70 });
  yield 1.6;
  // out of the truck: the driver steps out of the cab and walks round its front; the robot hops off the back
  Object.assign(dr, { hidden: false, x: T.x - 92, y: LANE + 4, face: -1 });
  beep(dr, 'hello');
  T.riders = []; hop(tk, T.x + 26, 7, 'idle');
  go(dr, [[T.x - 114, LANE + 4], [T.x - 114, 14], [sc.door.x - 16, B.yf + 14]]);
  yield () => !tk.hop;
  if (sc.greet) yield* sc.greet();   // (V21.2: the bank: one of its robots comes out to meet Tinker and takes the leaves in)
  yield 0.9; go(tk, [[sc.door.x + 14, 8], [sc.door.x + 14, B.yf + 16]]);   // (along the curb, in front of anything on the verge)
  yield () => !dr.goal && !tk.goal;
  dr.face = 1; yield 0.6;
  if (sc.lead){ sc.lead(); yield 0.9; }   // (V21.2: whoever met us goes in first)
  // in through the door, then the front wall and the roof fade away
  go(dr, [[sc.door.x, B.yf + 2], [sc.door.x, B.yf - 18], sc.inside[0]], null, sc.insideFace[0]);
  yield 0.7;
  go(tk, [[sc.door.x, B.yf + 2], [sc.door.x, B.yf - 18], sc.inside[1]], null, sc.insideFace[1]);
  yield () => tk.y < B.yf - 8;
  sc.open = true;   // (from now on the floor may show what it makes: robots out on the belt, cash out of the side door)
  job(revealTo(B, 1, 1.8));
  yield () => !dr.goal && !tk.goal;
  yield* sc.watch();
  // out again: the walls come back as they reach the door
  go(dr, [[sc.door.x, B.yf - 18], [sc.door.x, B.yf + 6], [sc.door.x - 16, B.yf + 16]]);
  yield 0.5; go(tk, [[sc.door.x, B.yf - 18], [sc.door.x, B.yf + 6], [sc.door.x + 14, 8]]);
  yield () => dr.y > B.yf - 14;
  job(revealTo(B, 0, 1.2));
  camFrame(sc.frame, 1.8, { focusX: sc.door.x + 70 });
  yield () => !dr.goal && !tk.goal;
  if (sc.leave) yield* sc.leave();
  // back in the truck
  go(dr, [[T.x - 114, 14], [T.x - 114, LANE + 4], [T.x - 92, LANE + 4]]);
  go(tk, [[T.x + 26, 7]]);
  yield () => !tk.goal;
  hop(tk, rideSpot(T, tk).x, RIDE_Y, 'ride');
  yield () => !tk.hop && !dr.goal;
  board(T, tk); dr.hidden = true;
  yield 0.5;
  // and off, the camera riding along and closing in, then black
  followCam(T, -10, -6, zClose()*1.25);
  T.v = 1; T.acc = 150; sfx('truckOut', panOf(T.x));
  yield 2.2; fadeTo(1, 0.7); yield 0.8;
}
function* revealTo(B, v, dur){ const a = B.reveal, t0 = E.t; yield () => { const k = clamp((E.t - t0)/dur, 0, 1); B.reveal = lerp(a, v, ease(k)); return k >= 1; }; }

// ═════════════════════════ FACTORY — "the robot factory"
// Iron ingots in, new robots out. Robots in yellow hard hats carry ingots (two to each machine, side by side) from two
// pallets to the press (body shells) and the wheel lathe (treads); runners take shells and treads to two assembly bays,
// where a welder puts a robot together. The new robot wakes up, queues for the paint booth, and comes out as a new
// model that hops onto the conveyor, which runs out through the right-hand wall to somewhere we never see. Nobody and
// nothing leaves the building until we've been inside (sc.open): the finished robots wait at the wall till then.
// Round the edges: a sweeper, a robot fixing something at the workbench, one moving crates from one stack to the other,
// tools on the wall, lockers, oil drums, a trash can, a hand truck: things a factory has, never explained.
// To change it: the layout is P, the machines are M (their stock and timers), the crew and their jobs are in build(),
// the models off the line in MODELS, the props in props().
function makeFactory(){
  const B = { x0: -420, x1: 420, yb: -350, yf: -38, h: 104, reveal: 0, doors: [{ x: -300, w: 34, h: 54 }], wall: '#8f9ea6', stub: '#7a8890', side: '#6f7c83' };
  const P = {
    palA: { x: -368, y: -282 }, palB: { x: -368, y: -158 }, press: { x: -200, y: -282 }, lathe: { x: -200, y: -158 },
    bays: [{ x: 44, y: -282 }, { x: 44, y: -158 }], booth: { x: 244, y: -196 }, belt: { y: -108, x0: 272, x1: 610 },
    bench: { x: -120, y: -334 }, cratesA: { x: 300, y: -330 }, cratesB: { x: 384, y: -262 },
  };
  const M = { press: { in: 2, out: 2, busy: 0, cyc: 2.4 }, lathe: { in: 2, out: 2, busy: 0, cyc: 2.2 },
    bays: [{ shell: 1, tread: 1, k: 1.5 }, { shell: 1, tread: 0, k: -1 }], booth: { busy: 0, cur: null, q: [] }, crates: [5, 2] };
  const RAW = { body: '#b2b9bd', body2: '#7c858a', head: '#c0c7cb', head2: '#8a9398', band: '#6b7276', noBasket: true };
  // the new models: some brand new, some very like the robots in your yard (no hard hats for them)
  const MODELS = [
    look(1, { body: '#d2eadf', body2: '#8fb9a8', head: '#e2f2ea', head2: '#9cc4b4', band: '#e0705a', look: 'twin', lamp: '#ff9a6b' }),
    look(2, { body: '#8ea3c2', body2: '#56698a', head: '#a8bad6', head2: '#6f82a4', band: '#d9b75a', look: 'dome', lamp: '#ffd36b' }),
    look(0, { body: '#dcd1b8', body2: '#a89c80', head: '#e6dcc6', head2: '#b7ab92', band: '#3f8f86' }),
    look(4, { body: '#e2d8ee', body2: '#aa9cc2', head: '#ece4f4', head2: '#b8aacb', band: '#6a4f8a', round: true, look: 'scope', lamp: '#7fd0ff' }),
    look(10, { body: '#e8e0cc', body2: '#b9ae95', head: '#e98a4a', head2: '#b05f2a', band: '#3f6f8f', kettle: true }),
    look(7, { body: '#e2dac4', body2: '#b2a78c', head: '#e6dfcb', head2: '#bcb198', band: '#8fb04a', bandW: 7, sprout: true }),
    look(5, { body: '#f3e9e4', body2: '#c2aaa0', head: '#fbf3ee', head2: '#cdb5aa', band: '#c97a4a', modern: true }),
    look(11, { body: '#d6e6f2', body2: '#9ab4c8', head: '#e4eef6', head2: '#a8c0d2', band: '#2f5f86', bandW: 5, slim: true, lantern: true }),
    look(3, { body: '#c9c4b2', body2: '#8d8878', head: '#d3cebd', head2: '#99947f', band: '#b8452d', patches: true }),
    look(9, { body: '#d3cab8', body2: '#a19886', head: '#ddd5c4', head2: '#aaa08d', band: '#3a3531', bandW: 8, ember: true }),
  ];
  let mi = Math.floor(Math.random()*MODELS.length);
  const sc = { id: 'factory', B, P, M, stopX: -214, door: { x: -300 }, inside: [[-334, -78], [-286, -84]], insideFace: [1, 1], belt: [], open: false,
    frame: { x0: B.x0 - 50, x1: P.belt.x1 - 10, y0: B.yb - B.h - 30, y1: LANE + 46 } };
  const BAND = ['#b8452d', '#5f8f88', '#7a4d6e', '#6f7d3c', '#d9a43a', '#3f6f8f', '#8a5a36'];
  let bi = 0;
  const crew = (shape, o) => bot(look(shape, Object.assign({ body: '#d8cdb2', body2: '#a59878', head: '#e2d8c0', head2: '#b2a68a', band: BAND[bi++ % BAND.length], look: 'hardhat', noBasket: true }, o || {})), 0, 0, { sp: 46 + Math.random()*8 });

  // ── the crew and their jobs
  function* carrier(w, pick, drop, item, take, give, delay){
    if (delay) yield delay;
    for (;;){
      yield* walk(w, [pick]); w.face = -1;
      yield take; yield 0.3; w.hold = item; yield 0.25;
      yield* walk(w, [drop]); w.face = 1;
      yield give; w.hold = null; yield 0.35;
    }
  }
  const ingot = holding((c, x, y) => H.drawIngot(c, x + 2, y + 1, 10, 0, 1));
  const shell = holding((c, x, y) => itemShell(c, x + 3, y + 4, 0.75));
  const tread = holding((c, x, y) => itemTread(c, x + 3, y + 2, 0.75));
  const crate = holding((c, x, y) => itemCrate(c, x + 4, y + 7, 0.8));
  const at = (o, x, y, face) => Object.assign(o, { x, y, face: face || 1 });
  function build(){
    // two ingot carriers to each machine, side by side (one lane a little behind the other)
    for (const [k, m, pal] of [[0, 'press', P.palA], [1, 'lathe', P.palB]]) for (const lane of [0, 1]){
      const w = at(crew(lane ? 2 : 0), -300 + lane*30, pal.y + 6 - lane*14), ln = lane ? -14 : 8, mm = M[m], mp = P[m];
      if (k === 0 && lane === 0) sc.pc = w;   // (V21: the one the tour follows)
      job(carrier(w, [pal.x + 42, pal.y + ln], [mp.x - 52, mp.y + ln], ingot, () => true, () => mm.in < 4 && ++mm.in, lane*1.3 + k*0.4));
    }
    // runners: shells and treads to both assembly bays
    P.bays.forEach((b, i) => {
      const bay = M.bays[i];
      const w1 = at(crew(1), -110, b.y - 10), w2 = at(crew(4, { round: true }), -80, b.y + 20);
      if (!i) sc.runner = w1;
      job(carrier(w1, [P.press.x + 58, P.press.y + 8 + i*12], [b.x - 54, b.y - 8], shell, () => M.press.out > 0 && M.press.out--, () => bay.shell < 2 && ++bay.shell, i*1.1));
      job(carrier(w2, [P.lathe.x + 58, P.lathe.y + 8 - i*12], [b.x - 54, b.y + 20], tread, () => M.lathe.out > 0 && M.lathe.out--, () => bay.tread < 2 && ++bay.tread, 0.6 + i*0.9));
      // a welder at each bay (torch up while it welds)
      const wd = at(crew(2, { chunky: true, ember: true, bandW: 6 }), b.x + 52, b.y + 12, -1);
      job((function*(){ for (;;){ wd.hold = holding(itemTorch); wd.holdUp = bay.k > 0.6 && bay.k < 4.6; yield 0.1; } })());
    });
    // the press operator works the lever (wrench up while it presses)
    const op = at(crew(3), P.press.x + 8, P.press.y + 36);
    job((function*(){ for (;;){ op.hold = holding(itemWrench); op.holdUp = M.press.busy > 0 && Math.sin(E.t*5) > 0; yield 0.1; } })());
    // the inspector at the start of the belt
    const ins = at(crew(11, { lantern: false }), P.belt.x0 + 44, P.belt.y + 36, -1);
    ins.hold = holding(itemClipboard); sc.inspector = ins;
    // and round the edges: a sweeper going up and down the front walkway, someone at the workbench, someone moving crates
    const sw = at(crew(1, { slim: true }), -200, -76);
    sw.hold = (c, hx, hy, r) => { const a = Math.sin(r.anim*7)*(r.moving ? 2.5 : 0.6); c.strokeStyle = '#8a6040'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(hx - 2, hy - 2); c.lineTo(hx + 8 + a, hy + 26); c.stroke(); c.fillStyle = '#c9a24a'; rr(c, hx + 2 + a, hy + 24, 13, 4, 1.5); c.fill(); };
    job((function*(){ for (;;){ yield* walk(sw, [[200, -74]], 26); yield 1.2; yield* walk(sw, [[-200, -76]], 26); yield 1.2; } })());
    const fx = at(crew(2, { chunky: true }), P.bench.x + 4, P.bench.y + 30, 1);
    job((function*(){ for (;;){ fx.hold = holding(itemWrench); fx.holdUp = Math.sin(E.t*6) > 0; if (Math.random() < 0.08) sfx('tink', panOf(fx.x), 0.12); yield 0.25; } })());
    const cr = at(crew(4), P.cratesA.x, P.cratesA.y + 24);
    job((function*(){ for (;;){
      yield* walk(cr, [[P.cratesA.x - 34, P.cratesA.y + 18]]); cr.face = 1; yield () => M.crates[0] > 0; M.crates[0]--; cr.hold = crate; yield 0.4;
      yield* walk(cr, [[P.cratesB.x - 32, P.cratesB.y + 10]]); cr.face = 1; M.crates[1]++; cr.hold = null; yield 0.6;
      if (M.crates[0] === 0){ // all moved: move them back again
        for (;;){ yield* walk(cr, [[P.cratesB.x - 32, P.cratesB.y + 10]]); cr.face = 1; if (!M.crates[1]) break; M.crates[1]--; cr.hold = crate; yield 0.4; yield* walk(cr, [[P.cratesA.x - 34, P.cratesA.y + 18]]); cr.face = 1; M.crates[0]++; cr.hold = null; yield 0.6; }
      }
    } })());
    // a few new robots are already on the belt, waiting at the wall
    for (let k = 0; k < 3; k++) onBelt(B.x1 - 24 - k*46, MODELS[(mi + 5 + k) % MODELS.length]);
  }
  function onBelt(x, sty){ const r = bot(sty, x, P.belt.y, { cfg: { lv: { speed: Math.floor(Math.random()*11), carry: Math.floor(Math.random()*6), study: 0 }, prio: [] }, face: 1 }); r.belt = true; sc.belt.push(r); return r; }
  // a freshly built robot wakes up, queues for the paint booth, goes in and comes out a new model onto the belt
  function* newRobot(r, b){
    r.anim = 0; yield 0.4;   // (V21: no "!" bubble)
    const Q = M.booth.q; Q.push(r);
    yield* walk(r, [[b.x + 40, b.y + 28]]);
    for (;;){
      const k = Q.indexOf(r); if (k === 0 && !M.booth.cur) break;
      const sx = P.booth.x - 60 - k*30, sy = P.booth.y + 6 + (k % 2)*8;
      if (!r.goal && Math.hypot(r.x - sx, r.y - sy) > 1) go(r, [[sx, sy]], 40, 1);
      yield 0.2;
    }
    Q.shift(); M.booth.cur = r; yield* walk(r, [[P.booth.x - 20, P.booth.y + 4]]); r.hidden = true;
    M.booth.busy = 2.6; yield () => M.booth.busy <= 0;
    yield () => !sc.belt.some(q => q.x < P.belt.x0 + 50);   // room on the belt
    r.sty = MODELS[mi++ % MODELS.length]; r.x = P.booth.x + 36; r.y = P.booth.y + 6; r.hidden = false; r.face = 1;
    M.booth.cur = null;
    hop(r, P.belt.x0 + 8, P.belt.y, 'idle'); yield () => !r.hop;
    r.belt = true; sc.belt.push(r);
    // (V21: the inspector no longer says "ok!")
  }
  function update(dt){
    // the press and the lathe: one ingot → one shell / one set of treads
    for (const [k, p] of [['press', P.press], ['lathe', P.lathe]]){
      const m = M[k];
      if (m.busy <= 0 && m.in > 0 && m.out < 6){ m.in--; m.busy = m.cyc; m.hit = false; }
      if (m.busy > 0){
        m.busy -= dt*tempo(sc, 0);
        if (k === 'press' && !m.hit && m.busy < m.cyc*0.5){ m.hit = true; sparks(p.x, p.y - 22, 8, '#ffd27a'); sfx('tink', panOf(p.x), 0.25); }
        if (k === 'lathe' && Math.random() < dt*10) sparks(p.x - 8, p.y - 46, 1, '#ffe2a0');
        if (m.busy <= 0) m.out++;
      }
    }
    // the assembly bays: a shell and a set of treads → a robot, welded together over 5 s (not while the booth queue is long)
    P.bays.forEach((b, i) => {
      const a = M.bays[i];
      if (a.k < 0 && a.shell > 0 && a.tread > 0 && M.booth.q.length < 3){ a.shell--; a.tread--; a.k = 0; }
      if (a.k < 0) return;
      a.k += dt*tempo(sc, 2);
      if (a.k > 0.6 && a.k < 4.6 && Math.random() < dt*14){ sparks(b.x + 8, b.y - 22 + rand(-6, 6), 2, '#bfe6ff'); if (Math.random() < 0.15) sfx('tink', panOf(b.x), 0.15); }
      if (a.k >= 5.2){
        a.k = -1;
        const r = bot(Object.assign(look(Math.floor(Math.random()*5)), RAW), b.x, b.y + 14, { sp: 44, face: 1, cfg: { lv: { speed: Math.floor(Math.random()*11), carry: 0, study: 0 }, prio: [] } });
        r.bay = i; sc.fresh = r; sc.made = (sc.made || 0) + 1;
        job(newRobot(r, b));
      }
    });
    // the paint booth puffs colour while a robot is inside
    if (M.booth.busy > 0){ M.booth.busy -= dt; if (Math.random() < dt*12) puff(P.booth.x + rand(-16, 16), P.booth.y - 66, MODELS[mi % MODELS.length].band, rand(3, 5)); }
    // the conveyor: before we've been inside, the robots on it wait at the wall (each one keeps a gap to the next)
    const lim = sc.open ? Infinity : B.x1 - 22;
    let ahead = Infinity;
    for (const r of sc.belt.slice().sort((p, q) => q.x - p.x)){ const nx = Math.min(r.x + 34*dt, lim, ahead - 44); if (nx > r.x) r.x = nx; ahead = r.x; r.face = 1; }
    for (const r of sc.belt) if (r.x > P.belt.x1 - 16) r.gone = true;
    sc.belt = sc.belt.filter(r => !r.gone); E.actors = E.actors.filter(o => !o.gone);
  }
  // ── drawing
  function under(c){
    // concrete floor with seams, oil stains and painted walkways
    c.fillStyle = '#bab3a6'; c.fillRect(B.x0, B.yb, B.x1 - B.x0, B.yf - B.yb);
    c.strokeStyle = 'rgba(70,60,50,.1)'; c.lineWidth = 1;
    for (let x = B.x0; x < B.x1; x += 48){ c.beginPath(); c.moveTo(x, B.yb); c.lineTo(x, B.yf); c.stroke(); }
    for (let y = B.yb; y < B.yf; y += 40){ c.beginPath(); c.moveTo(B.x0, y); c.lineTo(B.x1, y); c.stroke(); }
    const rnd = mulberry(5); c.fillStyle = 'rgba(60,52,44,.12)'; for (let k = 0; k < 16; k++){ ell(c, B.x0 + rnd()*(B.x1 - B.x0), B.yb + 10 + rnd()*(B.yf - B.yb - 20), 8 + rnd()*14, 3 + rnd()*5); c.fill(); }
    c.fillStyle = '#e8b93a'; c.fillRect(B.x0 + 6, -94, B.x1 - B.x0 - 12, 3); c.fillRect(B.x0 + 6, -56, B.x1 - B.x0 - 12, 3);
    c.save(); c.beginPath(); c.rect(P.belt.x0 - 20, P.belt.y - 30, B.x1 - P.belt.x0 + 20, 40); c.clip();
    for (let x = P.belt.x0 - 40; x < B.x1; x += 12){ c.fillStyle = (x/12) % 2 ? '#2f2a26' : '#e8b93a'; c.beginPath(); c.moveTo(x, P.belt.y + 10); c.lineTo(x + 6, P.belt.y + 10); c.lineTo(x + 12, P.belt.y + 4); c.lineTo(x + 6, P.belt.y + 4); c.closePath(); c.fill(); }
    c.restore();
    // the back wall: ribbed steel, high windows with warm light, a pipe, a painted gear, a clock, and a pegboard of tools
    const by = B.yb - B.h;
    c.fillStyle = '#9aa8ae'; c.fillRect(B.x0 - 8, by, B.x1 - B.x0 + 16, B.h);
    c.strokeStyle = 'rgba(60,72,78,.25)'; for (let x = B.x0; x < B.x1; x += 12){ c.beginPath(); c.moveTo(x, by); c.lineTo(x, B.yb); c.stroke(); }
    for (let x = B.x0 + 30; x < B.x1 - 40; x += 90){ c.fillStyle = '#5d6a70'; rr(c, x, by + 10, 60, 22, 2); c.fill(); const g = c.createLinearGradient(0, by + 12, 0, by + 30); g.addColorStop(0, '#ffe2a0'); g.addColorStop(1, '#f0b860'); c.fillStyle = g; rr(c, x + 3, by + 12, 54, 18, 1.5); c.fill(); c.fillStyle = '#5d6a70'; c.fillRect(x + 29, by + 12, 2, 18); }
    c.fillStyle = '#a8553a'; c.fillRect(B.x0 - 8, B.yb - 26, B.x1 - B.x0 + 16, 5); c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(B.x0 - 8, B.yb - 26, B.x1 - B.x0 + 16, 1.4);
    pegboard(c, -186, B.yb - 66, 120, 36);
    gear(c, 10, B.yb - 52, 15, 'rgba(232,185,58,.75)', E.t*0.3);
    c.fillStyle = '#f4ecd8'; ell(c, 330, B.yb - 52, 11, 11); c.fill(); c.strokeStyle = '#4a3a2e'; c.lineWidth = 1.6; ell(c, 330, B.yb - 52, 11, 11); c.stroke();
    c.lineWidth = 1.2; c.beginPath(); c.moveTo(330, B.yb - 52); c.lineTo(330, B.yb - 60); c.moveTo(330, B.yb - 52); c.lineTo(330 + Math.cos(E.t*0.5)*7, B.yb - 52 + Math.sin(E.t*0.5)*7); c.stroke();
    // a fire extinguisher and a first-aid box by the door, hung on the side wall
    c.fillStyle = '#c4281c'; rr(c, B.x0 + 4, -132, 7, 18, 3); c.fill(); c.fillStyle = '#2f2a26'; c.fillRect(B.x0 + 5.5, -136, 4, 4);
    // side walls
    c.fillStyle = B.side; c.fillRect(B.x0 - 8, by, 8, B.yf - by); c.fillRect(B.x1, by, 8, P.belt.y - 14 - by); c.fillRect(B.x1, P.belt.y + 6, 8, B.yf - P.belt.y - 6);
    c.fillStyle = 'rgba(30,24,12,.25)'; c.fillRect(B.x1 + 8, P.belt.y + 4, P.belt.x1 - B.x1 + 30, 6);
  }
  // tools hung on a pegboard: spanners, a hammer, a saw, pliers, a coil of cable
  function pegboard(c, x, y, w, h){
    c.fillStyle = '#c9a476'; rr(c, x, y, w, h, 2); c.fill(); c.fillStyle = 'rgba(90,60,30,.35)';
    for (let i = x + 5; i < x + w; i += 7) for (let j = y + 5; j < y + h; j += 7){ ell(c, i, j, 0.7, 0.7); c.fill(); }
    c.strokeStyle = '#6b7276'; c.lineWidth = 2; c.lineCap = 'round';
    for (const [dx, len] of [[10, 18], [17, 15], [24, 12]]){ c.beginPath(); c.moveTo(x + dx, y + 6); c.lineTo(x + dx, y + 6 + len); c.stroke(); c.lineWidth = 1; c.beginPath(); c.arc(x + dx, y + 5, 2.4, 0.6, 5.6); c.stroke(); c.lineWidth = 2; }
    c.strokeStyle = '#8a6040'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(x + 40, y + 28); c.lineTo(x + 40, y + 10); c.stroke(); c.fillStyle = '#4a4440'; rr(c, x + 34, y + 6, 12, 5, 1); c.fill();
    c.fillStyle = '#9aa0a4'; c.beginPath(); c.moveTo(x + 54, y + 8); c.lineTo(x + 78, y + 8); c.lineTo(x + 78, y + 14); c.lineTo(x + 58, y + 18); c.closePath(); c.fill(); c.fillStyle = '#8a4e35'; rr(c, x + 50, y + 6, 8, 12, 2); c.fill();
    c.strokeStyle = '#c4281c'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x + 88, y + 8); c.lineTo(x + 92, y + 26); c.moveTo(x + 96, y + 8); c.lineTo(x + 92, y + 26); c.stroke();
    c.strokeStyle = '#2f2a26'; c.lineWidth = 1.4; for (let k = 0; k < 3; k++){ ell(c, x + 108, y + 17, 7 - k*1.2, 7 - k*1.2); c.stroke(); }
  }
  function gear(c, x, y, r, col, a){ c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = col; for (let k = 0; k < 8; k++){ c.rotate(TAU/8); c.fillRect(-r*0.18, -r*1.25, r*0.36, r*0.4); } ell(c, 0, 0, r, r); c.fill(); c.fillStyle = '#9aa8ae'; ell(c, 0, 0, r*0.4, r*0.4); c.fill(); c.restore(); }
  function pallet(c, x, y){
    c.fillStyle = 'rgba(30,24,12,.3)'; ell(c, x + 2, y + 1, 34, 6); c.fill();
    c.fillStyle = '#9b7348'; c.fillRect(x - 30, y - 6, 60, 6); c.fillStyle = '#7d5a36'; for (const k of [-28, -2, 24]) c.fillRect(x + k, y - 6, 4, 6);
    for (let row = 0; row < 4; row++) for (let k = 0; k < 5 - row; k++) H.drawIngot(c, x - 22 + row*5.5 + k*11, y - 6 - row*4.2, 11, 0, 1);
  }
  // a pyramid of loose ingots (n at the bottom)
  function ingotPyramid(c, x, y, n){
    c.fillStyle = 'rgba(30,24,12,.28)'; ell(c, x + 1, y + 1, n*6.4, 5); c.fill();
    for (let row = 0; row < n; row++) for (let k = 0; k < n - row; k++) H.drawIngot(c, x - (n - 1)*5.5 + row*5.5 + k*11, y - row*4.4, 11, 0, 1);
  }
  // bars lying about on the verge, a few at a time
  let scat = null;
  function scatterIngots(c){
    if (!scat){ const rnd = H.mulberry(31); scat = []; for (let i = 0; i < 34; i++) scat.push({ x: -400 + rnd()*800, y: -30 + rnd()*28, r: (rnd() - .5)*0.9, g: rnd() < .3 ? 2 : 1 }); }
    for (const q of scat) H.drawIngot(c, q.x, q.y, 10, q.r, 1);
  }
  function press(c){
    const p = P.press, m = M.press, k = m.busy > 0 ? 1 - m.busy/m.cyc : 0, ram = Math.sin(k*Math.PI)*16;
    c.save(); c.translate(p.x, p.y);
    c.fillStyle = 'rgba(30,24,12,.3)'; ell(c, 4, 2, 52, 10); c.fill();
    c.fillStyle = '#5f7a8a'; rr(c, -44, -12, 88, 14, 3); c.fill();
    c.fillStyle = '#4e6572'; c.fillRect(-40, -86, 12, 76); c.fillRect(28, -86, 12, 76);
    c.fillStyle = '#6f8c9c'; rr(c, -46, -98, 92, 16, 3); c.fill(); c.fillStyle = '#e8b93a'; c.fillRect(-46, -86, 92, 3);
    c.fillStyle = '#8c9aa2'; c.fillRect(-6, -84, 12, 12 + ram); c.fillStyle = '#3d4a52'; rr(c, -22, -72 + ram, 44, 10, 2); c.fill();
    c.fillStyle = '#3a3633'; rr(c, -24, -14, 48, 6, 1.5); c.fill();
    if (m.busy > 0 && k < 0.5) H.drawIngot(c, 0, -14, 11, 0, 1); else if (m.busy > 0) itemShell(c, 0, -14, 0.8);
    c.fillStyle = '#7d8b92'; c.fillRect(-64, -12, 20, 4); for (let i = 0; i < m.in; i++) H.drawIngot(c, -54, -13 - i*3.6, 10, 0, 1);
    c.fillStyle = '#7d8b92'; c.fillRect(46, -10, 26, 4); for (let i = 0; i < m.out; i++) itemShell(c, 59, -10 - i*5, 0.7);
    c.fillStyle = m.busy > 0 ? '#ff7a4d' : '#8a4a36'; ell(c, 34, -92, 2.4, 2.4); c.fill();
    c.restore();
  }
  function lathe(c){
    const p = P.lathe, m = M.lathe, on = m.busy > 0;
    c.save(); c.translate(p.x, p.y);
    c.fillStyle = 'rgba(30,24,12,.3)'; ell(c, 4, 2, 50, 9); c.fill();
    c.fillStyle = '#6e8a5a'; rr(c, -42, -34, 84, 34, 4); c.fill(); c.fillStyle = '#5c7549'; c.fillRect(-42, -10, 84, 10);
    c.fillStyle = '#86a26f'; rr(c, -42, -40, 84, 10, 3); c.fill();
    c.save(); c.translate(-8, -46); c.rotate(on ? E.t*14 : 0); c.fillStyle = '#9aa0a4'; for (let k = 0; k < 3; k++){ c.rotate(TAU/3); c.fillRect(-2, -10, 4, 9); } ell(c, 0, 0, 5, 5); c.fill(); c.restore();
    c.fillStyle = '#3d3734'; rr(c, 14, -58, 18, 18, 3); c.fill(); c.fillStyle = on ? '#9fe08a' : '#4f6b3a'; ell(c, 23, -49, 3, 3); c.fill();
    c.fillStyle = '#7d8b92'; c.fillRect(-64, -10, 20, 4); for (let i = 0; i < m.in; i++) H.drawIngot(c, -54, -11 - i*3.6, 10, 0, 1);
    c.fillStyle = '#7d8b92'; c.fillRect(44, -8, 26, 4); for (let i = 0; i < m.out; i++) itemTread(c, 57, -8 - i*3.6, 0.75);
    c.restore();
  }
  function assembly(c, i){
    const p = P.bays[i], a = M.bays[i], k = a.k;
    c.save(); c.translate(p.x, p.y);
    c.fillStyle = 'rgba(30,24,12,.28)'; ell(c, 4, 2, 64, 12); c.fill();
    c.fillStyle = '#c9c1b0'; rr(c, -46, -6, 92, 10, 3); c.fill(); c.strokeStyle = '#e8b93a'; c.lineWidth = 2; c.setLineDash([5, 4]); rr(c, -42, -4, 84, 6, 2); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#4e6572'; c.fillRect(-48, -96, 8, 92); c.fillRect(40, -96, 8, 92); c.fillStyle = '#6f8c9c'; rr(c, -50, -104, 100, 12, 3); c.fill();
    const ax = Math.sin(E.t*1.7 + i*2)*16*(k >= 0 ? 1 : 0.2);
    c.strokeStyle = '#3d4a52'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(ax, -92); c.lineTo(ax + 6, -66); c.lineTo(ax*0.4 + 4, -48); c.stroke();
    c.fillStyle = '#e8b93a'; ell(c, ax + 6, -66, 3.2, 3.2); c.fill();
    if (k >= 0){
      itemTread(c, 0, -2, 1.1);
      if (k > 1.4) itemShell(c, 0, -8, 1.25 + 0.1*Math.min(1, k - 1.4));
      if (k > 3){ c.fillStyle = '#c0c7cb'; rr(c, -6, -42, 18, 13, 4); c.fill(); c.fillStyle = '#2a2420'; ell(c, 6, -35, 3.6, 3.6); c.fill(); if (k > 4.8){ c.fillStyle = '#ffc457'; ell(c, 6.4, -35, 2, 2); c.fill(); } }
    }
    c.fillStyle = '#7d8b92'; c.fillRect(-82, -20, 26, 4); for (let j = 0; j < a.shell; j++) itemShell(c, -69, -20 - j*5, 0.7);
    c.fillStyle = '#7d8b92'; c.fillRect(-82, 8, 26, 4); for (let j = 0; j < a.tread; j++) itemTread(c, -69, 8 - j*3.6, 0.75);
    c.restore();
  }
  function booth(c){
    const p = P.booth, on = M.booth.busy > 0, col = MODELS[mi % MODELS.length].band;
    c.save(); c.translate(p.x, p.y);
    c.fillStyle = 'rgba(30,24,12,.3)'; ell(c, 4, 2, 50, 10); c.fill();
    c.fillStyle = '#d9cfbd'; rr(c, -38, -70, 76, 72, 4); c.fill();
    c.fillStyle = '#c4b9a5'; c.fillRect(-38, -14, 76, 16);
    const rnd = mulberry(11); for (let k = 0; k < 14; k++){ c.fillStyle = MODELS[k % MODELS.length].band + '88'; ell(c, -32 + rnd()*64, -64 + rnd()*48, 2 + rnd()*4, 1.5 + rnd()*3); c.fill(); }
    for (const sx of [-38, 26]){ for (let k = 0; k < 4; k++){ c.fillStyle = k % 2 ? '#3f6f8f' : '#e8e2d1'; c.fillRect(sx + k*3, -54, 3, 52 + Math.sin(E.t*3 + k)*1.5); } }
    c.fillStyle = '#6b7276'; rr(c, -42, -78, 84, 10, 3); c.fill();
    for (const vx of [-16, 0, 16]){ c.fillStyle = '#4a4440'; rr(c, vx - 4, -84, 8, 7, 2); c.fill(); }
    c.fillStyle = on ? col : '#8a8078'; ell(c, 0, -40, 6, 6); c.fill();
    if (on){ c.fillStyle = 'rgba(255,255,255,.35)'; ell(c, -1.5, -42, 2, 2); c.fill(); }
    c.restore();
  }
  function beltDraw(c){
    const p = P.belt, y = p.y, moving = sc.open || sc.belt.some(r => r.x < B.x1 - 23);
    c.fillStyle = '#4a4440'; for (let x = p.x0 + 10; x < p.x1; x += 46){ c.fillRect(x, y, 4, 12); }
    c.fillStyle = '#3a3633'; rr(c, p.x0, y - 8, p.x1 - p.x0, 10, 4); c.fill();
    c.fillStyle = '#5a534c'; rr(c, p.x0, y - 9, p.x1 - p.x0, 5, 2.5); c.fill();
    if (moving) sc.beltOff = (E.t*34) % 10;
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1; const off = sc.beltOff || 0;
    for (let x = p.x0 + off; x < p.x1; x += 10){ c.beginPath(); c.moveTo(x, y - 9); c.lineTo(x, y - 4); c.stroke(); }
  }
  function chute(c){
    const x = P.belt.x1 - 10, y = P.belt.y;
    c.fillStyle = 'rgba(30,24,12,.3)'; ell(c, x + 30, y + 6, 46, 8); c.fill();
    c.fillStyle = '#6f7c83'; rr(c, x - 6, y - 50, 70, 54, 4); c.fill();
    c.fillStyle = '#1e1a17'; rr(c, x - 2, y - 40, 30, 38, 3); c.fill();
    for (let k = 0; k < 5; k++){ c.fillStyle = 'rgba(40,36,34,.85)'; c.fillRect(x - 2 + k*6, y - 40, 5, 34 + Math.sin(E.t*2 + k)*2); }
    c.fillStyle = '#596469'; rr(c, x - 10, y - 58, 78, 10, 3); c.fill();
  }
  function flap(c){ const x = B.x1 + 2, y = P.belt.y; for (let k = 0; k < 4; k++){ c.fillStyle = 'rgba(40,36,34,.8)'; c.fillRect(x, y - 40 + k*0.5, 6, 32); } }
  // ── props: things a factory has, never explained
  function props(list){
    // a workbench with a vice and a lamp
    const bx = P.bench.x, by2 = P.bench.y;
    list.push({ y: by2, f: c => { c.fillStyle = 'rgba(30,24,12,.25)'; ell(c, bx + 2, by2 + 2, 44, 7); c.fill(); c.fillStyle = '#7a5a3c'; for (const dx of [-36, 32]) c.fillRect(bx + dx, by2 - 22, 4, 22); c.fillStyle = '#9b7348'; rr(c, bx - 40, by2 - 28, 80, 7, 2); c.fill(); c.fillStyle = '#4e6572'; rr(c, bx + 14, by2 - 36, 14, 8, 2); c.fill(); c.fillStyle = '#6b7276'; c.fillRect(bx + 26, by2 - 33, 8, 2); c.strokeStyle = '#3d3734'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(bx - 30, by2 - 28); c.lineTo(bx - 26, by2 - 48); c.lineTo(bx - 14, by2 - 44); c.stroke(); c.fillStyle = '#e8b93a'; c.beginPath(); c.moveTo(bx - 18, by2 - 46); c.lineTo(bx - 8, by2 - 42); c.lineTo(bx - 14, by2 - 38); c.closePath(); c.fill(); itemShell(c, bx - 6, by2 - 28, 0.6); } });
    // lockers along the back wall
    list.push({ y: B.yb + 4, f: c => { for (let k = 0; k < 5; k++){ const x = 120 + k*18; c.fillStyle = k % 2 ? '#6f8c9c' : '#5f7a8a'; rr(c, x, B.yb - 40, 17, 44, 1.5); c.fill(); c.fillStyle = 'rgba(30,40,46,.5)'; for (const yy of [-34, -31, -28]) c.fillRect(x + 4, B.yb + yy, 9, 1.2); c.fillStyle = '#d9b75a'; c.fillRect(x + 13, B.yb - 16, 2, 5); } } });
    // crate stacks (one robot moves them from one to the other, and back)
    for (const [i, p] of [[0, P.cratesA], [1, P.cratesB]]) list.push({ y: p.y, f: c => { c.fillStyle = 'rgba(30,24,12,.25)'; ell(c, p.x + 2, p.y + 2, 24, 5); c.fill(); for (let k = 0; k < M.crates[i]; k++) itemCrate(c, p.x + (k % 2)*4 - 2, p.y - k*11, 1.4); } });
    // oil drums
    for (const [x, y, col] of [[392, -186, '#3f6f8f'], [372, -176, '#b8452d'], [398, -164, '#3f6f8f']]) list.push({ y, f: c => drum(c, x, y, col) });
    // a trash can by the door, a hand truck, a traffic cone
    list.push({ y: -64, f: c => trashCan(c, -252, -64) });
    list.push({ y: -70, f: c => { const x = -140, y = -70; c.strokeStyle = '#c4281c'; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y - 30); c.lineTo(x + 2, y - 2); c.lineTo(x + 14, y - 2); c.stroke(); c.fillStyle = '#2f2a26'; ell(c, x + 4, y - 1, 3.5, 3.5); c.fill(); } });
    list.push({ y: -98, f: c => { const x = 250, y = -98; c.fillStyle = '#e86a2a'; c.beginPath(); c.moveTo(x - 5, y); c.lineTo(x, y - 14); c.lineTo(x + 5, y); c.closePath(); c.fill(); c.fillStyle = '#f4ecd8'; c.fillRect(x - 3, y - 8, 6, 2); c.fillStyle = '#2f2a26'; c.fillRect(x - 7, y - 1, 14, 2); } });
  }
  // V21: more detail outside: corrugated steel with panel seams, steel columns with bolts, a concrete plinth, factory
  // windows with glazing bars (one pane tipped open), the roller door's guides and header, hazard stripes, lamps, a
  // louvred vent, a red hose box, a downpipe and a ladder up to the roof
  function facade(c){
    const by = B.yf - B.h, X0 = B.x0 - 8, X1 = B.x1 + 8, dX = -300, RD = { x0: 60, x1: 200 };
    const skip = x => Math.abs(x - dX) < 22 || (x > RD.x0 - 2 && x < RD.x1 + 2);
    // corrugations: a light and a dark line every 6 units
    for (let x = X0 + 2; x < X1; x += 6){ if (skip(x)) continue; c.fillStyle = 'rgba(255,255,255,.13)'; c.fillRect(x, by + 6, 1.6, B.h - 18); c.fillStyle = 'rgba(40,52,58,.22)'; c.fillRect(x + 2.6, by + 6, 1.2, B.h - 18); }
    c.fillStyle = 'rgba(40,52,58,.3)'; for (const y of [by + 40, by + 74]) c.fillRect(X0, y, X1 - X0, 1.4);
    // flashing at the top, a concrete plinth at the bottom
    c.fillStyle = '#8f9ba1'; c.fillRect(X0, by, X1 - X0, 6); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(X0, by, X1 - X0, 1.5);
    c.fillStyle = '#a49e94'; c.fillRect(X0, B.yf - 12, X1 - X0, 12); c.fillStyle = 'rgba(60,54,48,.35)'; for (let x = X0 + 30; x < X1; x += 60) c.fillRect(x, B.yf - 12, 1, 12); c.fillRect(X0, B.yf - 12, X1 - X0, 1.2);
    c.fillStyle = 'rgba(40,36,30,.18)'; for (let x = X0 + 8; x < X1; x += 37){ ell(c, x, B.yf - 5, 6, 2); c.fill(); }
    // steel columns with bolt heads
    for (const x of [-360, -240, -60, 240, 400]){
      c.fillStyle = '#56636a'; c.fillRect(x - 5, by + 4, 10, B.h - 14); c.fillStyle = '#6b7980'; c.fillRect(x - 3, by + 4, 6, B.h - 14); c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x - 3, by + 4, 1.4, B.h - 14);
      c.fillStyle = '#3f4a50'; for (let y = by + 12; y < B.yf - 14; y += 14){ ell(c, x - 3.5, y, 1, 1); c.fill(); ell(c, x + 3.5, y, 1, 1); c.fill(); }
    }
    // factory windows: steel frames, a grid of glazing bars, a sill; one pane tipped open
    for (const [i, x] of [-210, -120, 300, 360].entries()){
      const wt = by + 16, wh = 30, ww = 50;
      c.fillStyle = '#3f4a50'; rr(c, x - ww/2 - 3, wt - 3, ww + 6, wh + 6, 1.5); c.fill();
      const g = c.createLinearGradient(0, wt, 0, wt + wh); g.addColorStop(0, '#ffe6a8'); g.addColorStop(1, '#e9b866'); c.fillStyle = g; c.fillRect(x - ww/2, wt, ww, wh);
      c.fillStyle = 'rgba(120,80,40,.16)'; c.fillRect(x - ww/2, wt + wh*0.6, ww, wh*0.4);
      c.strokeStyle = '#3f4a50'; c.lineWidth = 1.2; c.beginPath(); for (let k = 1; k < 4; k++){ c.moveTo(x - ww/2 + k*ww/4, wt); c.lineTo(x - ww/2 + k*ww/4, wt + wh); } c.moveTo(x - ww/2, wt + wh/2); c.lineTo(x + ww/2, wt + wh/2); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.moveTo(x - ww/2 + 2, wt + wh/2 - 2); c.lineTo(x - ww/2 + 8, wt + 2); c.lineTo(x - ww/2 + 11, wt + 2); c.lineTo(x - ww/2 + 5, wt + wh/2 - 2); c.closePath(); c.fill();
      if (i === 1){ const px = x + ww/4, py = wt; c.fillStyle = '#4f5b61'; c.beginPath(); c.moveTo(px, py + wh/2); c.lineTo(px + ww/4, py + wh/2); c.lineTo(px + ww/4 + 3, py + 2); c.lineTo(px + 3, py + 2); c.closePath(); c.fill(); c.fillStyle = 'rgba(200,225,235,.45)'; c.beginPath(); c.moveTo(px + 1.5, py + wh/2 - 1.5); c.lineTo(px + ww/4 - 1.5, py + wh/2 - 1.5); c.lineTo(px + ww/4 + 1.2, py + 3.5); c.lineTo(px + 4, py + 3.5); c.closePath(); c.fill(); }
      c.fillStyle = '#7d878c'; c.fillRect(x - ww/2 - 5, wt + wh + 3, ww + 10, 3); c.fillStyle = 'rgba(30,36,40,.25)'; c.fillRect(x - ww/2 - 5, wt + wh + 6, ww + 10, 1.5);
      // a gooseneck lamp over it
      c.strokeStyle = '#3f4a50'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x, wt - 3); c.lineTo(x, wt - 9); c.quadraticCurveTo(x, wt - 13, x + 6, wt - 13); c.stroke();
      c.fillStyle = '#2f6a42'; c.beginPath(); c.moveTo(x + 2, wt - 13); c.lineTo(x + 11, wt - 13); c.lineTo(x + 9, wt - 9); c.lineTo(x + 4, wt - 9); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,224,150,.95)'; ell(c, x + 6.5, wt - 8.6, 2.6, 1); c.fill();
    }
    // the roller door: guide rails, a header box, slats, a handle, hazard stripes either side, a lamp
    c.fillStyle = '#56636a'; c.fillRect(RD.x0 - 6, B.yf - 84, RD.x1 - RD.x0 + 12, 12); c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(RD.x0 - 6, B.yf - 84, RD.x1 - RD.x0 + 12, 2);
    c.fillStyle = '#6b7980'; rr(c, RD.x0, B.yf - 74, RD.x1 - RD.x0, 74, 2); c.fill();
    c.fillStyle = '#7d8b92'; for (let y = B.yf - 72; y < B.yf; y += 7) c.fillRect(RD.x0 + 2, y, RD.x1 - RD.x0 - 4, 4);
    c.fillStyle = 'rgba(255,255,255,.18)'; for (let y = B.yf - 72; y < B.yf; y += 7) c.fillRect(RD.x0 + 2, y, RD.x1 - RD.x0 - 4, 1);
    c.fillStyle = '#3f4a50'; c.fillRect(RD.x0 - 5, B.yf - 74, 5, 74); c.fillRect(RD.x1, B.yf - 74, 5, 74);
    c.fillStyle = '#2f2a26'; rr(c, (RD.x0 + RD.x1)/2 - 9, B.yf - 12, 18, 3, 1); c.fill();
    c.fillStyle = '#e8b93a'; c.fillRect(RD.x0, B.yf - 4, RD.x1 - RD.x0, 4);
    for (const x of [RD.x0 - 14, RD.x1 + 6]){ c.save(); c.beginPath(); c.rect(x, B.yf - 40, 8, 28); c.clip(); c.fillStyle = '#e8b93a'; c.fillRect(x, B.yf - 40, 8, 28); c.fillStyle = '#2f2a26'; for (let k = -2; k < 8; k++){ c.beginPath(); c.moveTo(x, B.yf - 40 + k*7); c.lineTo(x + 8, B.yf - 48 + k*7); c.lineTo(x + 8, B.yf - 44 + k*7); c.lineTo(x, B.yf - 36 + k*7); c.closePath(); c.fill(); } c.restore(); }
    c.fillStyle = '#3d3734'; rr(c, (RD.x0 + RD.x1)/2 - 6, B.yf - 92, 12, 6, 2); c.fill(); c.fillStyle = 'rgba(255,224,150,.95)'; ell(c, (RD.x0 + RD.x1)/2, B.yf - 86, 4.5, 1.4); c.fill();
    // a louvred vent box and a red hose reel box
    { const x = -160, y = by + 22; c.fillStyle = '#56636a'; rr(c, x - 14, y, 28, 22, 2); c.fill(); c.fillStyle = '#3f4a50'; for (let k = 0; k < 5; k++) c.fillRect(x - 11, y + 3 + k*3.8, 22, 1.8); }
    { const x = 228, y = B.yf - 46; c.fillStyle = '#b8452d'; rr(c, x - 9, y, 18, 20, 2); c.fill(); c.fillStyle = '#f4ecd8'; ell(c, x, y + 10, 5, 5); c.fill(); c.fillStyle = '#b8452d'; ell(c, x, y + 10, 2, 2); c.fill(); }
    // the man door: a little canopy over it, a lamp; the plaque with a robot head over it
    c.fillStyle = '#56636a'; c.beginPath(); c.moveTo(dX - 26, B.yf - 60); c.lineTo(dX + 26, B.yf - 60); c.lineTo(dX + 22, B.yf - 54); c.lineTo(dX - 22, B.yf - 54); c.closePath(); c.fill();
    c.fillStyle = 'rgba(30,36,40,.25)'; c.fillRect(dX - 22, B.yf - 54, 44, 2);
    c.fillStyle = '#f4ecd8'; ell(c, dX, by + 18, 13, 13); c.fill(); c.strokeStyle = '#4a3a2e'; c.lineWidth = 1.5; ell(c, dX, by + 18, 13, 13); c.stroke();
    c.fillStyle = '#4a423b'; rr(c, dX - 7, by + 13, 14, 11, 3); c.fill(); c.fillStyle = '#ffc457'; ell(c, dX + 2, by + 18, 2.4, 2.4); c.fill(); c.fillStyle = '#f2c230'; c.beginPath(); c.ellipse(dX, by + 13, 8, 5, 0, Math.PI, 0); c.closePath(); c.fill();
    c.fillStyle = '#d9b75a'; for (let k = 0; k < 8; k++){ const a = k*TAU/8; ell(c, dX + Math.cos(a)*11, by + 18 + Math.sin(a)*11, 0.8, 0.8); c.fill(); }
    c.fillStyle = '#3d3734'; c.fillRect(dX + 24, B.yf - 64, 8, 3); c.fillStyle = 'rgba(255,214,140,.9)'; ell(c, dX + 28, B.yf - 60, 3, 2); c.fill();
    // a downpipe at the left corner, and a ladder up to the roof at the right
    c.fillStyle = '#7d878c'; c.fillRect(B.x0 + 4, by, 4, B.h - 12); c.fillStyle = '#5d6669'; for (let y = by + 16; y < B.yf; y += 28) c.fillRect(B.x0 + 3, y, 6, 2); c.fillStyle = '#7d878c'; c.beginPath(); c.moveTo(B.x0 + 4, B.yf - 12); c.lineTo(B.x0 + 14, B.yf - 6); c.lineTo(B.x0 + 14, B.yf - 3); c.lineTo(B.x0 + 4, B.yf - 8); c.closePath(); c.fill();
    { const x = 384; c.strokeStyle = '#4f5b61'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, by - 10); c.lineTo(x, B.yf - 22); c.moveTo(x + 10, by - 10); c.lineTo(x + 10, B.yf - 22); for (let y = by - 4; y < B.yf - 22; y += 7){ c.moveTo(x, y); c.lineTo(x + 10, y); } c.stroke(); }
  }
  function roof(c){
    // a sawtooth roof: rows of north-light skylights with glazing bars and a gutter each, turning roof fans in housings,
    // a big extractor duct, a water tank on its stand, and a banded chimney puffing away
    const y0 = B.yb - B.h, y1 = B.yf - B.h, w = B.x1 - B.x0;
    c.fillStyle = '#6d7478'; c.fillRect(B.x0 - 12, y0 - 6, w + 24, y1 - y0 + 6);
    let row = 0;
    for (let y = y0 + 16; y < y1 - 30; y += 64, row++){
      // the sloping steel face (with standing seams), then the glass
      c.fillStyle = '#5b6266'; c.fillRect(B.x0, y + 30, w, 18);
      c.fillStyle = 'rgba(255,255,255,.08)'; for (let x = B.x0 + 4; x < B.x1; x += 10) c.fillRect(x, y + 30, 1.2, 18);
      const g = c.createLinearGradient(0, y, 0, y + 30); g.addColorStop(0, '#c9dee8'); g.addColorStop(0.6, '#93b2c0'); g.addColorStop(1, '#6f8e9c'); c.fillStyle = g; c.fillRect(B.x0, y, w, 30);
      c.fillStyle = 'rgba(255,224,160,.18)'; c.fillRect(B.x0, y + 18, w, 12);   // the lit hall shows through
      c.strokeStyle = 'rgba(60,72,78,.7)'; c.lineWidth = 1.2; for (let x = B.x0 + 20; x < B.x1; x += 28){ c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 30); c.stroke(); }
      c.lineWidth = 0.8; c.beginPath(); c.moveTo(B.x0, y + 15); c.lineTo(B.x1, y + 15); c.stroke();
      // reflections drifting along the glass
      c.fillStyle = 'rgba(255,255,255,.22)'; for (let x = B.x0 + ((row*90 + E.t*6) % 180); x < B.x1 - 20; x += 180){ c.beginPath(); c.moveTo(x, y + 28); c.lineTo(x + 10, y + 2); c.lineTo(x + 18, y + 2); c.lineTo(x + 8, y + 28); c.closePath(); c.fill(); }
      c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(B.x0, y, w, 2.4);
      c.fillStyle = '#4f5659'; c.fillRect(B.x0, y + 48, w, 4);
      c.fillStyle = '#7d878c'; c.fillRect(B.x0, y + 46, w, 2.4); c.fillStyle = '#3f4a50'; for (let x = B.x0 + 30; x < B.x1; x += 60) c.fillRect(x, y + 46, 2, 5);   // gutter and its brackets
    }
    c.fillStyle = '#4f5659'; c.fillRect(B.x0 - 12, y1 - 4, w + 24, 6); c.fillStyle = '#8f9ba1'; c.fillRect(B.x0 - 12, y1 - 6, w + 24, 2);
    // roof fans in round housings
    for (const fx of [-240, -40, 160]){
      const fy = y1 - 22;
      c.fillStyle = 'rgba(20,24,26,.3)'; ell(c, fx + 4, fy + 4, 17, 7); c.fill();
      c.fillStyle = '#6b7276'; c.fillRect(fx - 15, fy - 6, 30, 6); ell(c, fx, fy, 15, 6.4); c.fill();
      c.fillStyle = '#9aa3a8'; ell(c, fx, fy - 6, 15, 6.4); c.fill(); c.fillStyle = '#2f3438'; ell(c, fx, fy - 6, 12.5, 5); c.fill();
      c.save(); c.translate(fx, fy - 6); c.scale(1, 0.42); c.rotate(E.t*4 + fx); c.fillStyle = '#8a9398'; for (let k = 0; k < 5; k++){ c.rotate(TAU/5); c.beginPath(); c.ellipse(0, -6, 3, 6.5, 0.3, 0, TAU); c.fill(); } c.fillStyle = '#5d6569'; ell(c, 0, 0, 2.5, 2.5); c.fill(); c.restore();
      c.strokeStyle = 'rgba(50,56,60,.6)'; c.lineWidth = 0.7; for (let k = -10; k <= 10; k += 5){ c.beginPath(); c.moveTo(fx + k, fy - 6 - Math.sqrt(Math.max(0, 1 - (k/12.5)**2))*5); c.lineTo(fx + k, fy - 6 + Math.sqrt(Math.max(0, 1 - (k/12.5)**2))*5); c.stroke(); }
    }
    // a big extractor duct from the roof, bent over at the top
    { const x = 60, y = y0 + 40; c.fillStyle = 'rgba(20,24,26,.3)'; ell(c, x + 6, y + 4, 14, 5); c.fill(); const dg = c.createLinearGradient(x - 10, 0, x + 10, 0); dg.addColorStop(0, '#b6bec2'); dg.addColorStop(1, '#6b7276'); c.fillStyle = dg; c.fillRect(x - 10, y - 46, 20, 48); c.beginPath(); c.ellipse(x + 10, y - 46, 20, 12, 0, Math.PI, Math.PI*1.5); c.lineTo(x + 30, y - 58); c.lineTo(x + 30, y - 46); c.ellipse(x + 10, y - 46, 0.01, 0.01, 0, 0, 0); c.closePath(); c.fill(); c.fillStyle = '#2f3438'; ell(c, x + 30, y - 52, 2.5, 6); c.fill(); c.fillStyle = 'rgba(40,46,50,.4)'; for (const yy of [y - 30, y - 14]) c.fillRect(x - 10, yy, 20, 2); }
    const tx = -330, ty = y0 + 60;
    c.fillStyle = 'rgba(20,24,26,.3)'; ell(c, tx + 6, ty + 2, 26, 7); c.fill();
    c.strokeStyle = '#5a4030'; c.lineWidth = 3; for (const dx of [-14, 14]){ c.beginPath(); c.moveTo(tx + dx, ty); c.lineTo(tx + dx*0.6, ty - 26); c.stroke(); }
    c.lineWidth = 1.4; c.beginPath(); c.moveTo(tx - 13, ty - 4); c.lineTo(tx + 8, ty - 22); c.moveTo(tx + 13, ty - 4); c.lineTo(tx - 8, ty - 22); c.stroke();
    c.fillStyle = '#8a5a36'; rr(c, tx - 20, ty - 60, 40, 36, 4); c.fill(); c.fillStyle = '#6e4428'; for (let x = tx - 16; x < tx + 20; x += 6) c.fillRect(x, ty - 59, 1, 34);
    c.fillStyle = '#3f4a50'; for (const yy of [ty - 54, ty - 42, ty - 30]) c.fillRect(tx - 20, yy, 40, 2);
    c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(tx - 18, ty - 60, 4, 36);
    c.fillStyle = '#5a4030'; c.beginPath(); c.moveTo(tx - 23, ty - 60); c.lineTo(tx, ty - 74); c.lineTo(tx + 23, ty - 60); c.closePath(); c.fill();
    c.fillStyle = '#7a5a40'; c.beginPath(); c.moveTo(tx, ty - 74); c.lineTo(tx + 23, ty - 60); c.lineTo(tx + 17, ty - 60); c.closePath(); c.fill();
    const cx = 330, cy = y0 + 70;
    c.fillStyle = 'rgba(20,24,26,.3)'; ell(c, cx + 8, cy + 2, 18, 6); c.fill();
    c.fillStyle = '#8a4e35'; rr(c, cx - 12, cy - 90, 24, 92, 2); c.fill();
    c.fillStyle = 'rgba(60,24,14,.3)'; for (let y = cy - 86, r = 0; y < cy; y += 5, r++){ c.fillRect(cx - 12, y, 24, 0.8); for (let x = cx - 12 + (r % 2)*4; x < cx + 12; x += 8) c.fillRect(x, y - 5, 0.8, 5); }
    c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(cx + 5, cy - 90, 7, 92);
    c.fillStyle = '#3f4a50'; for (const yy of [cy - 70, cy - 40]) c.fillRect(cx - 13, yy, 26, 3);
    c.fillStyle = '#6e3c28'; c.fillRect(cx - 14, cy - 92, 28, 7); c.fillStyle = '#231a16'; ell(c, cx, cy - 92, 10, 2.4); c.fill();
    c.fillStyle = 'rgba(20,16,14,.6)'; c.fillRect(cx - 12, cy - 85, 24, 6);
    if (Math.random() < 0.08){ puff(cx + rand(-4, 4), cy - 96, 'rgba(210,205,200,.6)', rand(5, 9)); E.parts[E.parts.length - 1].out = true; }
  }
  B.facade = facade; B.roof = roof;
  function items(list){
    list.push({ y: P.palA.y, f: c => pallet(c, P.palA.x, P.palA.y) }, { y: P.palB.y, f: c => pallet(c, P.palB.x, P.palB.y) });
    list.push({ y: P.press.y, f: press }, { y: P.lathe.y, f: lathe }, { y: P.booth.y, f: booth });
    P.bays.forEach((b, i) => list.push({ y: b.y, f: c => assembly(c, i) }));
    list.push({ y: P.belt.y - 1, f: beltDraw }, { y: P.belt.y + 0.5, f: flap }, { y: P.belt.y + 20, f: chute });
    props(list);
    // outside on the verge: a delivery of ingots waiting to go in, and a trash can
    list.push({ y: -10, f: c => pallet(c, -40, -10) }, { y: -12, f: c => pallet(c, 30, -12) }, { y: -14, f: c => trashCan(c, 230, -14) });
    // (V21.3: a lot more ingots out here: more pallets, pyramids of loose ingots and bars scattered about)
    for (const [x, y] of [[-190, -8], [-130, -14], [96, -8], [160, -15], [355, -12], [-40, -24], [30, -27], [128, -28]]) list.push({ y, f: c => pallet(c, x, y) });
    for (const [x, y, n] of [[-82, -3, 6], [292, -5, 7], [-236, -20, 4], [210, -22, 5], [390, -26, 4]]) list.push({ y, f: c => ingotPyramid(c, x, y, n) });
    list.push({ y: -33, f: scatterIngots });
    list.push({ y: B.yf, f: c => drawShell(c, B) });
  }
  // what the camera does while we watch (V21: closer, and step by step in the order things are made): the whole floor;
  // an ingot carried from the pallet to the press; the press stamping it into a body shell; a runner taking a shell to
  // an assembly bay; the robot welded together there; the new robot queuing for the paint booth and coming out
  // coloured; out along the belt; then wide again. Steps after the one we're on run slower meanwhile (tempo).
  function* watch(){
    const dr = E.driver, zc = zTour();
    const wide = frameView({ x0: B.x0 - 30, x1: P.belt.x1 + 10, y0: B.yb - B.h - 20, y1: B.yf + 30 });
    if (wide.fits) camTo(wide.x, wide.y, wide.z, 2.2);
    else camTo(B.x0 + H.W/2/wide.z - 20, wide.y, wide.z, 2.2);
    yield 2.6;
    // 1. an ingot, from the pallet to the press
    sc.focus = 0;
    const w = sc.pc;
    camFrame({ x0: P.palA.x - 40, x1: P.press.x + 20, y0: P.palA.y - 70, y1: P.palA.y + 50 }, 1.6, { zmax: zc });
    if (w.hold !== ingot){ yield within(5, () => w.hold == null && !w.goal && w.x < P.palA.x + 60); yield within(2, () => w.hold === ingot); }   // picked up at the pallet
    followCam(w, 24, -30, zc);
    yield within(8, () => w.hold == null);   // put down by the press
    yield 0.4;
    // 2. the press stamps it into a body shell
    camFrame({ x0: P.press.x - 80, x1: P.press.x + 90, y0: P.press.y - 96, y1: P.press.y + 46 }, 1.2, { zmax: zc });
    { const o0 = M.press.out; yield within(4, () => M.press.out > o0); }
    yield 1.2;
    // 3. a runner takes a shell over to an assembly bay
    sc.focus = 1;
    const rn = sc.runner;
    followCam(rn, 0, -30, zc*0.95);
    yield within(6, () => rn.hold === shell);
    yield within(9, () => rn.hold == null);
    yield 0.6;
    // 4. the bay welds a robot together: treads, body, head, then its eye lights up
    sc.focus = 2; beep(dr, 'chat');
    const bi = M.bays[0].k >= 0 || M.bays[1].k < 0 ? 0 : 1, b = P.bays[bi], n0 = sc.made || 0;
    camFrame({ x0: b.x - 90, x1: b.x + 90, y0: b.y - 100, y1: b.y + 50 }, 1.2, { zmax: zc });
    yield within(10, () => (sc.made || 0) > n0);
    yield 1.2;
    // 5. off to the paint booth: in it goes, out it comes in its own colours
    sc.focus = 3;
    const nb = M.booth.cur || M.booth.q[0] || sc.fresh;   // (the next one in for paint)
    if (nb){
      followCam(nb, 20, -30, zc*0.95);
      yield within(10, () => M.booth.cur === nb && nb.hidden);
      camFrame({ x0: P.booth.x - 80, x1: P.booth.x + 110, y0: P.booth.y - 100, y1: P.booth.y + 46 }, 1, { zmax: zc });
      yield within(9, () => nb.belt);
      // 6. and out along the belt
      sc.focus = 4;
      followCam(nb, -20, -34, zc*0.85);
      yield 3.6;
    }
    sc.focus = null;
    camTo(wide.x, wide.y, wide.z, 2.4); yield 2.2;
  }
  return Object.assign(sc, { build, update, under, items, watch });
}
// a wooden crate, an oil drum, a trash can (props)
function itemCrate(c, x, y, s){
  c.save(); c.translate(x, y); c.scale(s || 1, s || 1);
  c.fillStyle = '#b88a52'; c.fillRect(-7, -8, 14, 8); c.strokeStyle = '#7d5a36'; c.lineWidth = 0.8; c.strokeRect(-7, -8, 14, 8);
  c.beginPath(); c.moveTo(-7, -8); c.lineTo(7, 0); c.moveTo(-7, -4); c.lineTo(7, -4); c.stroke();
  c.restore();
}
function drum(c, x, y, col){
  c.fillStyle = 'rgba(30,24,12,.25)'; ell(c, x + 2, y + 1, 10, 3); c.fill();
  c.fillStyle = col; c.fillRect(x - 8, y - 26, 16, 26); ell(c, x, y, 8, 2.6); c.fill();
  c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(x - 8, y - 18, 16, 2); c.fillRect(x - 8, y - 9, 16, 2);
  c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x - 6, y - 25, 2.4, 24);
  c.fillStyle = shadeHex(col, 0.75); ell(c, x, y - 26, 8, 2.6); c.fill(); c.fillStyle = '#2f2a26'; ell(c, x + 3, y - 26, 1.4, 0.6); c.fill();
}
function trashCan(c, x, y){
  c.fillStyle = 'rgba(30,24,12,.25)'; ell(c, x + 2, y + 1, 9, 3); c.fill();
  c.fillStyle = '#7d878c'; c.beginPath(); c.moveTo(x - 7, y - 20); c.lineTo(x + 7, y - 20); c.lineTo(x + 6, y); c.lineTo(x - 6, y); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(40,46,50,.4)'; c.lineWidth = 0.8; for (const dx of [-3, 0, 3]){ c.beginPath(); c.moveTo(x + dx, y - 18); c.lineTo(x + dx*0.9, y - 2); c.stroke(); }
  c.fillStyle = '#5d6669'; ell(c, x, y - 21, 8, 2.4); c.fill(); c.fillStyle = '#4a4440'; rr(c, x - 2, y - 25, 4, 3, 1); c.fill();
  H.drawLeaf(c, x + 5, y - 23, 3.4, 0.6, 1, 0, 1, 1, 1, 0);
}
function shadeHex(h, k){ return mix(h, '#000000', 1 - k); }

// ═════════════════════════ BANK — "where the money comes from"
// Leaves in, money out. Massive heaps of leaves on the curb outside. Inside, robots in green eyeshades, vests and bow
// ties carry bags of leaves from the pile to the shredder; the shreds fly into one of two big pots; a chemist pours
// something in, a stirrer stirs it to a sludge, then the green colouring goes in. When we arrive one pot is already
// green and bucket robots are carrying it, bucket after bucket, to the roller mill, which rolls it out into one long
// green sheet; the sheet runs into the cutter, which chops it into notes; a robot stacks the notes into bundles, and a
// runner takes them out of the side door to a big container on the curb (only once we've been inside: sc.open). When
// we leave, the cash in the container flies into the truck, the way the leaves fly in back at the yard.
// Each pot runs in batches (pot.st: fill → mix → dye → ready → fill). Round the edges: a clerk stamping papers at a desk,
// a robot polishing the vault door, plants, a water cooler, filing cabinets, a coat stand, rope barriers, a trash can.
// V39: the bank's security cameras: the yard's Efficiency Overview camera (game.js drawEye) in the bank's colours. The same
// foot, swivel collar, lower tube, hinge knuckle, telescoping sleeve with a chrome inner tube and the yoke round a ball
// head, but steel and graphite with a brass band instead of cream and teal, a deep sun-shield hood, a glossy black dome
// eye with a small red iris that shows where it's looking, and a blinking red recording light. Never explained: one over
// the front door watches Tinker arrive, one inside on the back wall by the vault watches the floor.
// cam: { x, y (its foot), k (how big), yaw, pitch, swing (the hinge), ext (the inner tube), zoom, t }
function secCamNew(x, y, k, dir){ return { x, y, k, yaw: 0.3*dir, pitch: 0.4, swing: 0.25*dir, ext: 2, zoom: 0, t: rand(0, 9), glance: null, glT: rand(3, 6) }; }
function secCamGeo(cm){
  const fx = cm.x, fy = cm.y, cx = fx, cy = fy - 3.2, hx = cx - 0.8, hy = cy - 15;
  const a = cm.swing, sl = Math.sin(a), cl = Math.cos(a), sleeve = 7.5, out = sleeve + Math.max(0, cm.ext) + 1.5;
  return { fx, fy, cx, cy, hx, hy, a, sl, cl, sx: hx + sl*sleeve, sy: hy - cl*sleeve, tx: hx + sl*out, ty: hy - cl*out, ex: hx + sl*(out + 10), ey: hy - cl*(out + 10) };
}
// turn toward (tx, ty) in world units: yaw and pitch on the head, the hinge leaning that way, the arm reaching a little
// further for things far off, and now and then a zoom (the iris tightens)
function secCamAim(cm, tx, ty, dt){
  cm.t += dt;
  const G = secCamGeo(cm), wx = cm.x + (G.ex - cm.x)*cm.k, wy = cm.y + (G.ey - cm.y)*cm.k*(cm.hang ? -1 : 1), dx = tx - wx, dy = ty - wy, a = 1 - Math.pow(0.05, dt);
  cm.yaw += (clamp(dx/110, -1, 1)*0.95 - cm.yaw)*a;
  cm.pitch += (clamp(dy/150, -0.6, 1) - cm.pitch)*a;
  cm.swing += (clamp(dx/260, -1, 1)*0.55 - cm.swing)*a*0.5;
  cm.ext = 2 + Math.sin(cm.t*0.7)*1.3 + clamp(Math.hypot(dx, dy)/320, 0, 1)*2.2;
  cm.zoom = Math.pow(Math.max(0, Math.sin(cm.t*0.45)), 6);
}
const secTube = (c, x0, y0, x1, y1, w, dark, mid, lite) => {
  c.lineCap = 'round';
  c.strokeStyle = dark; c.lineWidth = w + 1.2; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  c.strokeStyle = mid; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1, ox = -dy/d*w*0.22, oy = dx/d*w*0.22;
  c.strokeStyle = lite; c.lineWidth = w*0.28; c.beginPath(); c.moveTo(x0 - ox, y0 - oy); c.lineTo(x1 - ox, y1 - oy); c.stroke();
};
// mount: 'shelf' (a little brass shelf on a wall bracket under it), or cm.hang: bolted under a ledge and hanging upside
// down (the arm is drawn mirrored; the head stays upright, the yoke holding it from above)
function drawSecCam(c, cm, mount){
  const G = secCamGeo(cm);
  if (mount === 'shelf'){
    const x = cm.x, y = cm.y;
    c.fillStyle = 'rgba(40,26,14,.25)'; c.fillRect(x - 10, y + 2, 22, 3);
    c.fillStyle = '#8a6a2c'; c.beginPath(); c.moveTo(x - 6, y + 1); c.lineTo(x + 6, y + 1); c.lineTo(x - 4, y + 13); c.lineTo(x - 6, y + 13); c.closePath(); c.fill();
    c.fillStyle = '#b8862a'; rr(c, x - 11, y - 0.6, 22, 3, 1); c.fill(); c.fillStyle = 'rgba(255,236,170,.6)'; c.fillRect(x - 10, y - 0.6, 20, 0.8);
    c.fillStyle = '#6e5222'; ell(c, x - 5, y + 11, 0.9, 0.9); c.fill();
  }
  c.save(); c.translate(G.fx, G.fy); c.scale(cm.k, cm.hang ? -cm.k : cm.k); c.translate(-G.fx, -G.fy);
  // the foot: a plate bolted down
  c.fillStyle = 'rgba(20,12,8,.35)'; rr(c, G.fx - 8, G.fy - 0.4, 16, 3, 1.2); c.fill();
  c.fillStyle = '#34373a'; rr(c, G.fx - 7.5, G.fy - 2.6, 15, 3.4, 1.2); c.fill();
  c.fillStyle = '#c9a24a'; for (const bx of [-5.2, 5.2]){ ell(c, G.fx + bx, G.fy - 0.9, 0.85, 0.85); c.fill(); }
  // the swivel collar
  c.fillStyle = '#26282a'; ell(c, G.cx, G.cy + 1.2, 4.3, 1.9); c.fill();
  c.fillStyle = '#4c5054'; rr(c, G.cx - 3.4, G.cy - 2.2, 6.8, 3.4, 1); c.fill();
  c.fillStyle = '#767c80'; ell(c, G.cx, G.cy - 2.2, 3.4, 1.3); c.fill();
  // its cable, sagging down to the foot
  c.strokeStyle = '#1c1d1f'; c.lineWidth = 0.8; c.lineCap = 'round';
  c.beginPath(); c.moveTo(G.tx + G.cl*2.2, G.ty + G.sl*2.2); c.quadraticCurveTo(G.hx + 4.2 + G.sl*3, G.hy + 1 - G.cl*2, G.hx + 2.6, G.hy + 3.5); c.quadraticCurveTo(G.cx + 3.2, (G.hy + G.cy)/2 + 2, G.cx + 3.6, G.cy + 0.5); c.stroke();
  // the lower tube (steel), the chrome inner tube, the sleeve (graphite with a brass ring) and the brass hinge knuckle
  secTube(c, G.cx, G.cy - 1.5, G.hx, G.hy, 3.2, '#4a4f53', '#a9b1b5', 'rgba(255,255,255,.55)');
  secTube(c, G.tx, G.ty, G.sx, G.sy, 2.1, '#5c6468', '#c9d2d6', 'rgba(255,255,255,.75)');
  secTube(c, G.sx, G.sy, G.hx + G.sl*1.2, G.hy - G.cl*1.2, 3.5, '#1e2022', '#3c4044', 'rgba(220,230,235,.35)');
  c.strokeStyle = '#b8862a'; c.lineWidth = 3.9; c.lineCap = 'butt'; c.beginPath(); c.moveTo(G.sx + G.sl*0.2, G.sy - G.cl*0.2); c.lineTo(G.sx + G.sl*1.4, G.sy - G.cl*1.4); c.stroke();
  c.fillStyle = '#3d3632'; ell(c, G.hx, G.hy, 3.5, 3.5); c.fill();
  c.fillStyle = '#b8862a'; ell(c, G.hx, G.hy, 2.5, 2.5); c.fill();
  c.fillStyle = '#f0d98a'; ell(c, G.hx - 0.4, G.hy - 0.4, 0.9, 0.9); c.fill();
  // the yoke round the bottom of the head
  c.save(); c.translate(G.ex, G.ey); c.rotate(G.a*0.45);
  c.strokeStyle = '#1e2022'; c.lineWidth = 2.6; c.lineCap = 'round'; c.beginPath(); c.arc(0, 0.6, 10.6, 0.08*Math.PI, 0.92*Math.PI); c.stroke();
  c.strokeStyle = '#5a5f63'; c.lineWidth = 1.1; c.beginPath(); c.arc(0, 0.6, 10.6, 0.15*Math.PI, 0.6*Math.PI); c.stroke();
  for (const sx of [-1, 1]){ c.fillStyle = '#1e2022'; ell(c, sx*10.3, 2.2, 1.9, 1.9); c.fill(); c.fillStyle = '#c9a24a'; ell(c, sx*10.3, 2.2, 0.8, 0.8); c.fill(); }
  c.restore();
  if (cm.hang){ c.restore(); c.save(); c.translate(G.fx, G.fy); c.scale(cm.k, cm.k); c.translate(-G.fx, -G.fy); secCamHead(c, cm, G.ex, 2*G.fy - G.ey, -G.a*0.45); }
  else secCamHead(c, cm, G.ex, G.ey, G.a*0.45);
  c.restore();
}
function secCamHead(c, cm, x, y, tilt){
  const yaw = cm.yaw, pitch = cm.pitch, ay = Math.abs(yaw);
  c.save(); c.translate(x, y); c.rotate(tilt);
  // the shell: brushed steel, like the vault door, with a brass band that turns with it
  const sh = c.createRadialGradient(-3, -4, 1, 0, 0, 10.5);
  sh.addColorStop(0, '#f1f4f5'); sh.addColorStop(0.55, '#aab2b6'); sh.addColorStop(1, '#646b6f');
  c.fillStyle = 'rgba(20,14,10,.28)'; ell(c, 0.8, 1.2, 9.6, 9.2); c.fill();
  c.fillStyle = sh; ell(c, 0, 0, 9.4, 9); c.fill();
  c.strokeStyle = '#41474b'; c.lineWidth = 0.7; ell(c, 0, 0, 9.4, 9); c.stroke();
  c.save(); ell(c, 0, 0, 9.4, 9); c.clip();
  const bw = 9.4*(0.35 + 0.65*(1 - ay*0.4));
  c.strokeStyle = '#b8862a'; c.lineWidth = 2.2; c.beginPath(); c.ellipse(-yaw*6.5, 0.5, bw, 9.6, 0, -Math.PI/2, Math.PI/2, yaw > 0); c.stroke();
  c.strokeStyle = 'rgba(255,236,170,.55)'; c.lineWidth = 0.6; c.beginPath(); c.ellipse(-yaw*6.5 - 0.6, 0.5, bw, 9.6, 0, -Math.PI/2, Math.PI/2, yaw > 0); c.stroke();
  c.restore();
  // the faceplate turns toward where it looks: a brass bezel round black glass
  const fx = yaw*3.4, fy = pitch*1.3, fk = 1 - ay*0.3, fr = 6.9;
  c.fillStyle = '#9a7024'; ell(c, fx, fy, fr*fk, fr); c.fill();
  c.fillStyle = '#d9b75a'; c.beginPath(); c.ellipse(fx, fy, fr*fk, fr, 0, Math.PI*1.05, Math.PI*1.7); c.ellipse(fx, fy, (fr - 1)*fk, fr - 1, 0, Math.PI*1.7, Math.PI*1.05, true); c.closePath(); c.fill();
  c.fillStyle = '#0b0c0d'; ell(c, fx, fy, (fr - 1)*fk, fr - 1); c.fill();
  // the eye: a glossy black dome, a small red iris in it where it's looking (it tightens when it zooms in), and the
  // window light caught on the glass
  const lx = fx + yaw*1.1, ly = fy + pitch*0.9, lr = 5.1, lk = fk;
  const dg = c.createRadialGradient(lx - 1.8*lk, ly - 2, 0.3, lx, ly, lr);
  dg.addColorStop(0, '#59626b'); dg.addColorStop(0.35, '#1c2024'); dg.addColorStop(1, '#020304');
  c.fillStyle = dg; ell(c, lx, ly, lr*lk, lr); c.fill();
  c.save(); ell(c, lx, ly, lr*lk, lr); c.clip();
  const ix = lx + yaw*1.9*lk, iy = ly + pitch*1.7, ir = 1.7*(1 - cm.zoom*0.45);
  c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(230,60,40,.22)'; ell(c, ix, iy, ir*2.4*lk, ir*2.4); c.fill(); c.globalCompositeOperation = 'source-over';
  c.strokeStyle = 'rgba(214,58,40,.95)'; c.lineWidth = 0.8; ell(c, ix, iy, ir*lk, ir); c.stroke();
  c.fillStyle = '#ff7a52'; ell(c, ix, iy, 0.55*lk, 0.55); c.fill();
  c.restore();
  c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 0.9; c.lineCap = 'round'; c.beginPath(); c.ellipse(lx, ly, (lr - 1.3)*lk, lr - 1.3, 0, Math.PI*1.12, Math.PI*1.45); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.9)'; ell(c, lx - 2.6*lk, ly - 0.6, 0.55, 0.55); c.fill();
  c.fillStyle = 'rgba(255,255,255,.28)'; ell(c, lx + 2.4*lk, ly + 2.6, 0.9, 0.45); c.fill();
  // the sun-shield hood: a deep graphite peak over the faceplate, wider than the shell
  c.save(); c.translate(fx*0.8, -6.1 + fy*0.35); c.rotate(yaw*0.15);
  c.fillStyle = 'rgba(10,10,12,.3)'; c.beginPath(); c.moveTo(-8.4*fk, 1.6); c.quadraticCurveTo(0, 3.4, 8.4*fk, 1.6); c.lineTo(8.4*fk, 0.6); c.lineTo(-8.4*fk, 0.6); c.closePath(); c.fill();
  c.fillStyle = '#26292c'; c.beginPath(); c.moveTo(-10.2*fk, 1.4); c.quadraticCurveTo(-9.6*fk, -4.6, 0, -5); c.quadraticCurveTo(9.6*fk, -4.6, 10.2*fk, 1.4); c.quadraticCurveTo(0, 0, -10.2*fk, 1.4); c.fill();
  c.strokeStyle = 'rgba(200,210,215,.45)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-9*fk, -1.6); c.quadraticCurveTo(0, -5.6, 9*fk, -1.6); c.stroke();
  c.strokeStyle = '#4a4f53'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(-10.2*fk, 1.4); c.quadraticCurveTo(0, 0, 10.2*fk, 1.4); c.stroke();
  c.restore();
  // the recording light: red, blinking
  const on = (cm.t % 1.3) < 0.75, Lx = -6.4 - yaw*1.5, Ly = 4.6;
  c.fillStyle = on ? '#ff3a24' : '#4a2a26'; ell(c, Lx, Ly, 0.95, 0.95); c.fill();
  if (on){ c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,60,36,.4)'; ell(c, Lx, Ly, 2.6, 2.6); c.fill(); c.globalCompositeOperation = 'source-over'; }
  c.restore();
}

function makeBank(){
  const B = { x0: -400, x1: 400, yb: -340, yf: -38, h: 104, reveal: 0, doors: [{ x: -262, w: 40, h: 62 }, { x: 312, w: 34, h: 52 }], wall: '#e4d8bd', stub: '#cdbf9f', side: '#bfae8c' };
  const P = { bags: { x: -350, y: -258 }, bags2: { x: -352, y: -170 }, shred: { x: -226, y: -214 }, mill: { x: 94, y: -262 }, cut: { x: 262, y: -262 },
    stack: { x: 344, y: -222 }, box: { x: 356, y: -10 }, desk: { x: -40, y: -92 }, vault: { x: 330 } };
  const POTS = [
    { x: -86, y: -282, st: 'ready', L: 1, mix: 1, green: 1, added: true, dyed: true },
    { x: -86, y: -168, st: 'fill', L: 0, mix: 0, green: 0, added: false, dyed: false },
  ];
  const M = { shred: { bags: 1, busy: 0, to: 1, pile: 14 }, spill: [], piles: [11, 8], mill: { ink: 1.5, run: 0, roll: 0 }, sheet: 0, cut: { t: 0, tray: 6, down: 0 }, table: 2, box: 5 };
  const SLUDGE = ['#8a5a2c', '#6f6a4a', '#4f9a3c'];
  const HEAPS = [[-360, -8, 120, 78, 3], [20, -10, 170, 112, 11], [158, -12, 110, 80, 5], [236, -4, 56, 38, 9],
    [-385, -27, 96, 76, 13], [66, -28, 170, 138, 17], [190, -29, 150, 110, 19], [250, -24, 90, 80, 23], [-12, -4, 70, 46, 29], [118, -3, 64, 42, 31]];   // (V21.3: more of them, a second row behind and small ones in front)   // the leaf heaps on the curb: x, y, w, h, seed (V21.2: none just behind where the truck stops, so the greeter and the load stand out)
  const potCol = p => mix(mix(SLUDGE[0], SLUDGE[1], p.mix), SLUDGE[2], p.green);
  const sc = { id: 'bank', B, P, POTS, M, stopX: -150, door: { x: -262 }, inside: [[-296, -80], [-246, -86]], insideFace: [1, 1], open: false,
    frame: { x0: B.x0 - 40, x1: B.x1 + 50, y0: B.yb - B.h - 30, y1: LANE + 46 } };
  Object.defineProperty(sc, 'POT', { get: () => POTS[1] });
  // V39: the security cameras: one hanging upside down under the frieze right of the portico, over the front door; one on a
  // little brass shelf on the back wall, right of the vault
  const CAMS = sc.cams = { out: Object.assign(secCamNew(-205, B.yf - B.h + 12, 1.15, 1), { hang: true }), in: secCamNew(386, B.yb - B.h + 58, 1.05, -1) };   // (endingState shows the cycling pot)
  const VESTS = ['#2f5a3a', '#6e2f2f', '#3f4f7a', '#5a4a2a'], TIES = ['#a8361d', '#d9b75a', '#2f5f86'];
  let vi = 0;
  const banker = (shape, o) => { const k = vi++; return bot(look(shape, Object.assign({ body: '#e4dcc6', body2: '#b3a78b', head: '#ece5d2', head2: '#c0b498', band: VESTS[k % 4], vest: VESTS[k % 4], tie: TIES[k % 3], look: 'banker', noBasket: true }, o || {})), 0, 0, { sp: 44 + Math.random()*8 }); };
  const at = (o, x, y, face) => Object.assign(o, { x, y, face: face || 1 });
  const bag = holding((c, x, y) => H.drawLeafBag(c, x + 3, y + 8, 11, 3));
  // V21: the step a carrier stands on to reach over the hopper, where the bag is held while it pours, and its mouth
  const STEP = { x: P.shred.x - 46, y: P.shred.y + 4 };
  const BAGAT = { x: P.shred.x - 20, y: P.shred.y - 84 };
  // V21.2: the end of the spout on top of the shredder (it swings toward the pot that's filling: M.spout)
  const spoutTip = () => { const a = M.spout || 0; return { x: P.shred.x + 46 + Math.cos(a)*20, y: P.shred.y - 98 + Math.sin(a)*12 }; };
  const pourMouth = () => { const a = 0.4 + (M.pour ? M.pour.tip : 0)*2.2; return { x: BAGAT.x + Math.sin(a)*12, y: BAGAT.y - Math.cos(a)*12 + 2 }; };
  function drawPour(c){
    const P2 = M.pour; if (!P2) return; const w = P2.w, a = 0.4 + P2.tip*2.2;
    // both arms up to the bag
    c.strokeStyle = '#4a423b'; c.lineWidth = 2.2; c.lineCap = 'round';
    for (const d of [-4, 4]){ c.beginPath(); c.moveTo(w.x + 2 + d, w.y - 24 - w.hz); c.quadraticCurveTo(w.x + 14 + d, w.y - 50 - w.hz, BAGAT.x - 5 + d*0.6, BAGAT.y + 7); c.stroke(); c.fillStyle = '#4a423b'; ell(c, BAGAT.x - 5 + d*0.6, BAGAT.y + 7, 2, 2); c.fill(); }
    c.save(); c.translate(BAGAT.x, BAGAT.y); c.rotate(a); H.drawLeafBag(c, 0, 9, 14, 3); c.restore();
  }
  // V21: one leaf out of a bag (or a dustpan): into the hopper, or missing it onto the floor beside the shredder
  const LEAFN = H.LEAFC.length;
  function pourLeaf(x, y, miss){
    const ci = Math.floor(rand(0, LEAFN)), sz = rand(4.6, 6.4);
    if (miss){
      const tx = P.shred.x + rand(-50, 36), ty = P.shred.y + rand(6, 26);
      M.missing = (M.missing || 0) + 1;
      fly('leaf', x, y, tx, ty, rand(0.6, 0.85), rand(10, 22), { ci, s: sz, spin: rand(4, 9), onEnd: () => { M.missing--; M.spill.push({ x: tx, y: ty, ci, s: sz, rot: rand(0, TAU) }); } });
    } else fly('leaf', x + rand(-2, 2), y, P.shred.x - 2 + rand(-16, 16), P.shred.y - 60 + rand(-2, 3), rand(0.3, 0.42), rand(-2, 6), { ci, s: sz, spin: rand(3, 8), onEnd: () => { M.shred.pile = Math.min(60, M.shred.pile + 1); } });
  }
  const cash = holding((c, x, y) => itemCash(c, x + 3, y + 3, 0.8));
  const fillPot = () => POTS.filter(p => p.st === 'fill').sort((a, b) => b.L - a.L)[0];
  function build(){
    // three bag carriers to the shredder, from two piles of bags
    // (V21: they take the bags the baggers outside have brought in: M.piles counts what's on each pile)
    [[0, P.bags, 0], [1, P.bags, 0], [2, P.bags2, 1]].forEach(([i, pile, pi]) => {
      const w = at(banker(i % 3), -300 + i*20, pile.y + 10);
      if (!i) sc.carrier = w;
      job((function*(){ yield i*1.4; for (;;){
        yield* walk(w, [[pile.x + 46, pile.y + 6 + (i === 1 ? 14 : 0)]]); w.face = -1;
        yield () => M.piles[pi] > 0 || M.piles[1 - pi] > 2; if (M.piles[pi] > 0) M.piles[pi]--; else M.piles[1 - pi]--;
        yield 0.35; w.hold = bag; yield 0.3;
        // V21: they queue for the step beside the shredder, climb up, lift the bag high over the hopper and tip it: the
        // leaves pour out in a stream; now and then one misses and lands on the floor (the sweeper picks those up)
        yield* walk(w, [[P.shred.x - 78, P.shred.y + 12 + (i - 1)*16]]); w.face = 1;
        yield () => M.shred.bags < (M.hold ? 6 : 2) && !M.step;   // (V21.2: while the shredder waits, the hopper just heaps up)
        M.step = w;
        yield* walk(w, [[STEP.x, STEP.y]]); w.face = 1;
        for (let k = 1; k <= 4; k++){ w.hz = 13*k/4; yield 0.03; }
        w.hold = null; w.holdUp = true; M.pour = { w, t: 0, tip: 0 }; M.pours = (M.pours || 0) + 1;
        for (let k = 1; k <= 6; k++){ M.pour.tip = k/6; yield 0.035; }
        for (let k = 0; k < 30; k++){ for (let j = 0; j < 2; j++){ const o = pourMouth(); pourLeaf(o.x + rand(-2, 2), o.y, M.spill.length + (M.missing || 0) < (M.hold ? 9 : 5) && Math.random() < (M.hold ? 0.1 : 0.05)); } yield 0.035; }   // (V21: a thick stream, ~60 leaves a bag)
        M.shred.bags++; yield 0.1;
        for (let k = 5; k >= 0; k--){ M.pour.tip = k/6; yield 0.03; }
        M.pour = null; w.holdUp = false;
        yield* walk(w, [[STEP.x - 10, STEP.y + 14]]); w.hz = 0; M.step = null; yield 0.2;
      } })());
    });
    // the chemist: something into a pot that's mixing, the green colouring into one that's ready for it
    const ch = at(banker(4, { round: true }), -160, -226);
    sc.chemist = ch;
    job((function*(){ for (;;){
      const need = () => POTS.find(p => (p.st === 'mix' && !p.added) || (p.st === 'dye' && !p.dyed));
      yield need; const p = need(), dye = p.st === 'dye', col = dye ? '#3fb24a' : '#9fc4d8';
      ch.hold = holding((c, x, y) => itemJug(c, x + 2, y + 2, 0.9, ch.holdUp ? 1.6 : 0, col));
      yield* walk(ch, [[p.x - 62, p.y + 14]]); ch.face = 1; yield 0.3; ch.holdUp = true;
      for (let k = 0; k < 14; k++){ E.parts.push({ k: 'drop', x: ch.x + 20, y: ch.y - 46, vx: rand(18, 34), vy: rand(-6, 6), g: 120, life: 0.55, t: 0, col }); yield 0.1; }
      if (dye) p.dyed = true; else p.added = true;
      ch.holdUp = false; yield 0.3; ch.hold = null; yield 0.5;
    } })());
    // a stirrer at each pot: a long paddle that reaches up over the rim and goes round and round
    POTS.forEach((p, i) => {
      const st = at(banker(1, { slim: true }), p.x + 62, p.y + 10, -1);
      st.hold = (c, hx, hy, r) => { const on = p.L > 0.15, a = on ? Math.sin(E.t*3 + i) : 0, b = on ? Math.cos(E.t*3 + i) : 0; c.strokeStyle = '#8a6040'; c.lineWidth = 2.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(hx - 4, hy + 6); c.lineTo(hx + 34 + a*9, hy - 44 + b*3); c.stroke(); c.fillStyle = '#7a5232'; ell(c, hx + 34 + a*9, hy - 44 + b*3, 4, 1.8); c.fill(); };
    });
    // four bucket robots: green sludge from whichever pot is ready, to the roller mill
    for (let i = 0; i < 4; i++){
      const w = at(banker(i % 2 ? 3 : 0, { patches: false }), 0 + i*16, -230 + i*10);
      (sc.buckets || (sc.buckets = [])).push(w);
      job((function*(){ yield i*1.2; for (;;){
        w.hold = holding((c, x, y) => itemBucket(c, x + 2, y + 8, 1, false)); w.holdUp = false;
        const ready = () => POTS.filter(p => p.st === 'ready' && p.L > 0.04).sort((a, b) => b.L - a.L)[0];
        yield ready; const p = ready();
        yield* walk(w, [[p.x + 24 + (i % 3)*16, p.y + 40 + (i % 2)*6]]); w.face = -1;   // (V21.2: on the right, out of the shredder spout's stream)
        if (!(p.st === 'ready' && p.L > 0.04)) continue;
        yield 0.5; p.L = Math.max(0, p.L - 0.035); const col = potCol(p);
        w.hold = holding((c, x, y) => itemBucket(c, x + 2, y + 8, 1, true, col)); w.full = true;
        if (p.L < 0.04){ Object.assign(p, { st: 'fill', mix: 0, green: 0, added: false, dyed: false }); }
        yield 0.3;
        yield* walk(w, [[P.mill.x - 56, P.mill.y + 8 + (i % 2)*16]]); w.face = 1; w.holdUp = true; yield 0.5;
        for (let k = 0; k < 6; k++) E.parts.push({ k: 'drop', x: w.x + 16, y: w.y - 44, vx: rand(10, 24), vy: rand(-20, -8), g: 140, life: 0.5, t: 0, col });
        M.mill.ink = Math.min(4, M.mill.ink + 0.35); w.full = false; yield 0.4;
      } })());
    }
    // the stacker takes notes off the cutter's tray and stacks them into bundles on its table
    const sk = at(banker(2, { chunky: true }), P.cut.x + 46, P.cut.y + 40, -1);
    job((function*(){ for (;;){
      yield* walk(sk, [[P.cut.x + 22, P.cut.y + 34]]); sk.face = -1;
      yield () => M.cut.tray >= 4; M.cut.tray -= 4; sk.hold = holding((c, x, y) => itemCash(c, x + 3, y + 3, 0.75)); yield 0.4;
      yield* walk(sk, [[P.stack.x - 26, P.stack.y + 14]]); sk.face = 1; yield () => M.table < 8; yield 0.3; sk.hold = null; M.table++; yield 0.3;
    } })());
    // the runner takes bundles out of the side door to the container (not before we've seen inside)
    const rn = at(banker(1, { slim: true }), P.stack.x + 10, P.stack.y + 40);
    sc.runner = rn;
    job((function*(){ for (;;){
      yield* walk(rn, [[P.stack.x + 8, P.stack.y + 30]]); rn.face = -1;
      yield () => M.table > 0; M.table--; yield 0.3; rn.hold = cash;
      yield () => sc.open;
      yield* walk(rn, [[312, -76], [312, -26], [P.box.x - 36, -4]]); rn.face = 1; rn.holdUp = true; yield 0.3;
      fly('cash', rn.x + 14, rn.y - 40, P.box.x, P.box.y - 36, 0.5, 18, {}); rn.hold = null; rn.holdUp = false;
      yield 0.5; M.box++; yield 0.2;
      yield* walk(rn, [[312, -26], [312, -76]]);
    } })());
    // round the edges: a clerk stamping papers at a desk, and a robot polishing the vault door
    const cl = at(banker(0), P.desk.x - 4, P.desk.y - 12, 1);
    job((function*(){ for (;;){ cl.hold = holding((c, x, y) => { c.fillStyle = '#5a3f28'; rr(c, x - 1, y - 3, 3, 6, 1); c.fill(); c.fillStyle = '#a8361d'; c.fillRect(x - 3, y + 3, 7, 2); }); cl.holdUp = !cl.holdUp; if (!cl.holdUp && Math.random() < 0.5) sfx('tink', panOf(cl.x), 0.1); yield rand(0.3, 0.7); } })());
    const pol = at(banker(3), P.vault.x - 30, B.yb + 18, 1);
    pol.hold = (c, hx, hy, r) => { const a = Math.sin(E.t*4); c.fillStyle = '#f4ecd8'; ell(c, hx + 3 + a*3, hy - 14 + Math.cos(E.t*4)*3, 4, 3); c.fill(); };
    pol.holdUp = true;
    // V21: a sweeper picks up the leaves that missed the hopper, one by one into a dustpan, and tips them back in
    const sw = at(banker(2, { round: true }), P.shred.x + 62, P.shred.y + 56, -1);
    sw.sp = 66; sc.sweeper = sw; sw.trips = 0;
    let pan = 0;
    sw.hold = holding((c, x, y) => {
      c.save(); c.translate(x + 2, y + 6); c.rotate(sw.holdUp ? -0.9 : 0.15);
      c.fillStyle = '#5d6669'; c.beginPath(); c.moveTo(-2, -4); c.lineTo(11, -5); c.lineTo(12, 2); c.lineTo(-2, 2); c.closePath(); c.fill(); c.fillStyle = '#7d878c'; c.fillRect(-2, -4.5, 1.6, 6.5);
      for (let k = 0; k < Math.min(pan, 7); k++) H.drawLeaf(c, 2 + (k % 4)*2.4, -1.6 - Math.floor(k/4)*1.6, 3.1, k*1.7, k % LEAFN, 0, 1, 1, 1, 0);
      c.strokeStyle = '#8a6040'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-2, -2); c.lineTo(-7, -9); c.stroke();
      c.restore();
    });
    job((function*(){ yield 2; for (;;){
      yield () => M.spill.length >= 2 || (M.spill.length && Math.random() < 0.01);
      while (M.spill.length && pan < 4){   // (V21.2: four at a time, so a round is short enough to watch)
        const l = M.spill.slice().sort((a, b) => Math.hypot(a.x - sw.x, a.y - sw.y) - Math.hypot(b.x - sw.x, b.y - sw.y))[0];
        const side = l.x > sw.x ? -1 : 1;
        yield* walk(sw, [[l.x + side*13, l.y + 3]]); sw.face = -side;
        yield 0.22; const i = M.spill.indexOf(l); if (i >= 0){ M.spill.splice(i, 1); pan++; } yield 0.15;
      }
      yield* walk(sw, [[P.shred.x + 40, P.shred.y + 14]]); sw.face = -1; sw.holdUp = true; yield 0.35;
      for (; pan > 0; pan--){ pourLeaf(sw.x - 14, sw.y - 52, false); yield 0.09; }
      yield 0.3; sw.holdUp = false; sw.trips++;
      yield* walk(sw, [[P.shred.x + 62, P.shred.y + 56]]); sw.face = -1;
    } })());
    // V21.2: the greeter: waits just inside the front door; when the truck pulls up it comes out to meet Tinker, takes
    // the truck's load of leaves into a big sack, leads the way in and puts the sack on a pile by the shredder
    // (sc.greet / sc.lead, called from visit()); then it stays by the door like a doorman
    const gr = at(banker(3, { chunky: true }), sc.door.x + 30, B.yf - 26, -1);
    sc.greeter = gr; gr.fill = 0; gr.st2 = 'wait'; gr.sp = 66;
    E.truck.leaves = E.truck.leaves0 = 48;
    // out it comes as the truck pulls up (only once the floor has warmed up and the truck is on its way in)
    job((function*(){
      yield () => E.truck.x < sc.stopX + 160 && !E.quiet;
      yield* walk(gr, [[sc.door.x, B.yf - 18], [sc.door.x, B.yf + 6], [sc.stopX + 2, 6]]); gr.face = 1; gr.st2 = 'out';
    })());
  }
  function* greet(){
    const g = sc.greeter, T = E.truck, tk = E.tinker;
    camFrame({ x0: sc.door.x - 40, x1: T.x + 110, y0: B.yf - 90, y1: LANE + 24 }, 1.2);
    yield within(4, () => g.st2 === 'out'); g.face = 1; yield 0.7;
    beep(g, 'hello');   // (no words: robots in the ending never show dialog text)
    tk.face = -1; yield 0.6;
    // the load jumps off the bed into the sack, a handful at a time, and the sack swells
    g.hold = holding((c, x, y) => H.drawLeafBag(c, x + 3, y + 8, 7 + g.fill*6, 3)); g.st2 = 'fill';
    const n0 = T.leaves;
    for (let k = 0; k < 24; k++){
      for (let j = 0; j < 2; j++){ if (T.leaves <= 0) break; T.leaves--; fly('leaf', T.x + rand(-8, 60), LANE - 70 - rand(0, 14), g.x + g.face*12 + rand(-3, 3), g.y - 34, rand(0.35, 0.5), rand(16, 30), { ci: Math.floor(rand(0, LEAFN)), s: rand(5, 6.4), spin: rand(4, 9), out: true }); }
      g.holdUp = k % 6 < 3; g.fill = 1 - T.leaves/n0; yield 0.07;
    }
    g.holdUp = false; g.fill = 1; T.leaves = 0; g.st2 = 'carry'; yield 0.3;
    // to the door, where it waits for the others
    go(g, [[sc.door.x + 36, B.yf + 20]], null, -1);
  }
  function lead(){
    const g = sc.greeter;
    job((function*(){
      yield () => !g.goal;
      yield* walk(g, [[sc.door.x, B.yf + 4], [sc.door.x, B.yf - 18], [-300, -120], [P.bags.x + 50, P.bags.y + 24]]); g.face = -1;
      g.st2 = 'drop'; yield 0.3; g.hold = null;
      fly('bag', g.x - 12, g.y - 34, P.bags.x + rand(-10, 10), P.bags.y - 24, 0.5, 16, { onEnd: () => { M.piles[0] = Math.min(15, M.piles[0] + 1); g.st2 = 'dropped'; } });
      yield 1.2;
      yield* walk(g, [[-300, -112], [sc.door.x - 26, B.yf - 26]]); g.face = 1;
    })());
  }
  function update(dt){
    aimCams(dt);
    // V21.2: the moment we step inside (the walls still up), the floor is set for the tour: the back pot full of green for
    // the buckets, the front pot nearly empty, and the shredder holding its heap until the tour gets to it (M.hold)
    if (sc.open && !M.set){
      M.set = true; M.hold = true;
      Object.assign(POTS[0], { st: 'ready', L: 1, mix: 1, green: 1, added: true, dyed: true });
      Object.assign(POTS[1], { st: 'fill', L: 0.1, mix: 0, green: 0, added: false, dyed: false });
      Object.assign(M.shred, { bags: 0, busy: 0, pile: 22 });
      const ch = sc.chemist; if (!ch.goal && !ch.hold) Object.assign(ch, { x: POTS[1].x - 64, y: POTS[1].y + 16, face: 1 });   // (out of sight: ready by the front pot)
    }
    // the shredder chews a bag at a time while a pot is filling, and the spout on top blows the shreds into it
    const s = M.shred, fp = fillPot(), fast = sc.focus === 2 ? 3 : 1;
    if (s.busy <= 0 && s.bags > 0 && fp && !M.hold){ s.bags--; s.busy = 2; }
    // the spout swings round to the pot that's filling
    { const tp = fp || POTS[1], a = Math.atan2(tp.y - 70 - (P.shred.y - 92), tp.x - (P.shred.x + 46)); M.spout = M.spout == null ? a : M.spout + (a - M.spout)*Math.min(1, dt*3); }
    if (s.busy > 0 && fp){   // (V21.2: it only runs while a pot is filling, so the spout never pours into one that's mixing)
      s.busy -= dt; s.pile = Math.max(0, s.pile - dt*24);
      if (Math.random() < dt*6) E.parts.push({ k: 'puff', x: P.shred.x + rand(-14, 10), y: P.shred.y - 58, vx: rand(-8, 8), vy: rand(-26, -14), life: rand(0.4, 0.7), t: 0, r: rand(1.4, 2.4), col: H.LEAFC[Math.floor(rand(0, LEAFN))].c });   // bits flying up out of the blades
      const p = fp || POTS[1];
      if (fp) p.L = Math.min(1, p.L + dt*0.07*fast*(fast > 1 ? 2 : 1));   // (V21.2: much faster while the camera's on it)   // (V21: a bit more a bag, since the bags now go in one at a time from the step)
      // V21.2: a thick stream of shredded leaf out of the spout, arcing down into the pot (with a few bigger bits)
      const tip = spoutTip();
      for (let k = Math.floor(dt*75 + Math.random()); k > 0; k--){
        const tx = p.x + rand(-24, 24), ty = p.y - 68 + rand(-4, 4), ci = Math.floor(rand(0, LEAFN));
        if (Math.random() < 0.35) fly('leaf', tip.x, tip.y, tx, ty, rand(0.5, 0.62), rand(14, 22), { ci, s: rand(3, 4.2), spin: rand(8, 14) });
        else fly('shred', tip.x + rand(-2, 2), tip.y + rand(-2, 2), tx, ty, rand(0.45, 0.6), rand(12, 24), { col: H.LEAFC[ci].c, big: true });
      }
      if (Math.random() < dt*3) puff(p.x + rand(-20, 20), p.y - 72, 'rgba(150,110,60,.4)', rand(3, 5));   // (a little dust where it lands)
    }
    for (const p of POTS){
      if (p.st === 'fill' && p.L >= 0.99) p.st = 'mix';
      if (p.st === 'mix' && p.added){ p.mix = Math.min(1, p.mix + dt*tempo(sc, 2)*fast/3.5); if (p.mix >= 1) p.st = 'dye'; }
      if (p.st === 'dye' && p.dyed){ p.green = Math.min(1, p.green + dt*tempo(sc, 2)*fast/2.2); if (p.green >= 1) p.st = 'ready'; }
      if (p.L > 0.1 && Math.random() < dt*1.5) puff(p.x + rand(-24, 24), p.y - 70, 'rgba(240,240,230,.35)', rand(4, 7));
    }
    // the roller mill rolls the green out into one long sheet while it has sludge; the cutter chops the sheet into notes
    const m = M.mill, cu = M.cut, run = m.ink > 0.02 && cu.tray < 16;
    m.run = run ? Math.min(1, m.run + dt*2) : Math.max(0, m.run - dt*2);
    const tm = tempo(sc, 3);
    if (run){ m.ink = Math.max(0, m.ink - dt*0.09*tm); m.roll += dt*m.run*tm; M.sheet += dt*18*m.run*tm; }
    cu.down = Math.max(0, cu.down - dt*4);
    if (run){ cu.t += dt*tm; if (cu.t > 0.9){ cu.t = 0; cu.down = 1; cu.tray++; sfx('tink', panOf(P.cut.x), 0.12); } }
  }
  // V39: where the cameras look. Over the door: Tinker whenever it's out on the curb, else the truck while it's near,
  // else a slow sweep along the curb. Inside: Tinker while it's in, with a glance at one of the bankers now and then,
  // else a slow sweep over the floor.
  function aimCams(dt){
    const tk = E.tinker, T = E.truck, co = CAMS.out, ci = CAMS.in, inside = tk && !tk.hidden && tk.st !== 'ride' && tk.y < B.yf - 8;
    if (tk && !tk.hidden && tk.st !== 'ride' && tk.y >= B.yf - 8) secCamAim(co, tk.x, tk.y - 22, dt);
    else if (T && Math.abs(T.x - sc.stopX) < 700) secCamAim(co, T.x + 30, LANE - 46, dt);
    else secCamAim(co, sc.door.x + 60 + Math.sin(E.t*0.35)*240, 6, dt);
    if ((ci.glT -= dt) <= 0){
      const pool = E.actors.filter(o => o.sty && o.sty.look === 'banker' && o.y < B.yf - 10 && o.x > B.x0 && o.x < B.x1);
      ci.glance = pool.length ? { o: pool[Math.floor(rand(0, pool.length))], t: rand(1.6, 2.6) } : null; ci.glT = rand(5, 9);
    }
    if (ci.glance && (ci.glance.t -= dt) <= 0) ci.glance = null;
    const gl = ci.glance && ci.glance.o;
    if (gl) secCamAim(ci, gl.x, gl.y - 22, dt);
    else if (inside) secCamAim(ci, tk.x, tk.y - 22, dt);
    else secCamAim(ci, Math.sin(E.t*0.3)*300, -200, dt);
  }
  function under(c){
    // a checkered marble floor with a long red carpet from the door
    c.fillStyle = '#efe6d2'; c.fillRect(B.x0, B.yb, B.x1 - B.x0, B.yf - B.yb);
    const T2 = 32; c.fillStyle = '#d8ccb2';
    for (let x = B.x0, i = 0; x < B.x1; x += T2, i++) for (let y = B.yb, j = 0; y < B.yf; y += T2, j++) if ((i + j) % 2) c.fillRect(x, y, Math.min(T2, B.x1 - x), Math.min(T2, B.yf - y));
    c.fillStyle = 'rgba(255,255,255,.25)'; for (let k = 0; k < 9; k++){ const rnd = mulberry(k + 40); ell(c, B.x0 + rnd()*(B.x1 - B.x0), B.yb + rnd()*(B.yf - B.yb), 20, 3); c.fill(); }
    c.fillStyle = '#9c3b2e'; c.fillRect(-282, -126, 40, B.yf + 126); c.fillRect(-282, -126, 590, 26); c.fillStyle = '#d9b75a'; c.fillRect(-282, -126, 590, 2); c.fillRect(-282, -102, 590, 2);
    // the back wall: wood panels below, cream above, a painting of a golden leaf, a clock, and the big round vault door
    const by = B.yb - B.h;
    c.fillStyle = '#efe4c8'; c.fillRect(B.x0 - 8, by, B.x1 - B.x0 + 16, B.h);
    c.fillStyle = '#8a5a36'; c.fillRect(B.x0 - 8, B.yb - 40, B.x1 - B.x0 + 16, 40); c.fillStyle = '#6e4428'; for (let x = B.x0; x < B.x1; x += 40) c.fillRect(x, B.yb - 40, 2, 40);
    c.fillStyle = '#d9b75a'; c.fillRect(B.x0 - 8, B.yb - 42, B.x1 - B.x0 + 16, 3);
    c.fillStyle = '#b8862a'; rr(c, -250, by + 14, 56, 40, 2); c.fill(); c.fillStyle = '#f4ead2'; c.fillRect(-246, by + 18, 48, 32); H.drawLeaf(c, -222, by + 34, 11, -0.5, 2, 0, 1, 1, 1, 0);
    c.fillStyle = '#b8862a'; rr(c, 150, by + 18, 40, 30, 2); c.fill(); c.fillStyle = '#e9dcc0'; c.fillRect(153, by + 21, 34, 24); c.fillStyle = '#9fc4d8'; c.fillRect(153, by + 21, 34, 14); c.fillStyle = '#7d8c45'; c.beginPath(); c.moveTo(153, by + 45); c.lineTo(165, by + 31); c.lineTo(175, by + 39); c.lineTo(187, by + 29); c.lineTo(187, by + 45); c.closePath(); c.fill();
    c.fillStyle = '#f4ecd8'; ell(c, 40, by + 30, 11, 11); c.fill(); c.strokeStyle = '#6e4428'; c.lineWidth = 1.6; ell(c, 40, by + 30, 11, 11); c.stroke(); c.lineWidth = 1.2; c.beginPath(); c.moveTo(40, by + 30); c.lineTo(40, by + 22); c.moveTo(40, by + 30); c.lineTo(40 + Math.cos(E.t*0.5)*7, by + 30 + Math.sin(E.t*0.5)*7); c.stroke();
    const vx = P.vault.x, vy = B.yb - 52;
    c.fillStyle = '#6b7276'; ell(c, vx, vy, 34, 34); c.fill(); c.fillStyle = '#9aa3a8'; ell(c, vx, vy, 29, 29); c.fill(); c.strokeStyle = '#6b7276'; c.lineWidth = 2; ell(c, vx, vy, 21, 21); c.stroke();
    c.save(); c.translate(vx, vy); c.rotate(E.t*0.2); c.strokeStyle = '#d9b75a'; c.lineWidth = 2.4; for (let k = 0; k < 3; k++){ c.rotate(TAU/3); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 15); c.stroke(); } c.fillStyle = '#d9b75a'; ell(c, 0, 0, 4, 4); c.fill(); c.restore();
    for (let k = 0; k < 8; k++){ const a = k*TAU/8; c.fillStyle = '#5d6569'; ell(c, vx + Math.cos(a)*31, vy + Math.sin(a)*31, 1.6, 1.6); c.fill(); }
    for (const x of [-150, -20, 230]){ c.fillStyle = '#e9dfc6'; c.fillRect(x - 7, by, 14, B.h); c.fillStyle = 'rgba(160,140,100,.3)'; for (const dx of [-4, 0, 4]) c.fillRect(x + dx - 0.5, by + 6, 1, B.h - 12); c.fillStyle = '#d6c8a8'; c.fillRect(x - 9, by, 18, 5); c.fillRect(x - 9, B.yb - 5, 18, 5); }
    c.fillStyle = B.side; c.fillRect(B.x0 - 8, by, 8, B.yf - by); c.fillRect(B.x1, by, 8, B.yf - by);
    // V21: leaves that missed the hopper, lying on the marble till the sweeper gets them
    for (const l of M.spill){ c.fillStyle = 'rgba(40,30,10,.18)'; ell(c, l.x + 1, l.y + 1, l.s*0.7, l.s*0.35); c.fill(); H.stampLeaf(c, l.x, l.y, l.s, l.rot, l.ci, 1, 1, .72, 1); }
    drawSecCam(c, CAMS.in, 'shelf');   // (V39: on the back wall, right of the vault)
  }
  // V21: a pile of bags, as many as are on it (rows of five, four, three...)
  function bagPile(c, p, n){
    const rnd = mulberry(23 + Math.round(p.y));
    c.fillStyle = 'rgba(30,24,12,.3)'; ell(c, p.x + 4, p.y + 4, 46, 10); c.fill();
    let k = 0; for (let row = 0; row < 5 && k < n; row++) for (let j = 0; j < 5 - row && k < n; j++, k++) H.drawLeafBag(c, p.x - 28 + row*7 + j*14 + rnd()*3, p.y + 4 - row*10, 13, Math.floor(rnd()*6));
  }
  // V21: lower than it was, with a wide hopper you can see the leaves going into, and a wooden step beside it
  function shredder(c){
    const p = P.shred, on = M.shred.busy > 0 && !!fillPot(), j = on ? Math.sin(E.t*40)*0.8 : 0;
    // the step (drawn with the shredder, so whoever stands on it is in front)
    { const sx = STEP.x - p.x, sy = STEP.y - p.y; c.save(); c.translate(p.x, p.y);
      c.fillStyle = 'rgba(30,24,12,.3)'; ell(c, sx + 2, sy + 3, 20, 5); c.fill();
      c.fillStyle = '#7a5232'; c.fillRect(sx - 17, sy - 13, 34, 13); c.fillStyle = '#9b7348'; c.fillRect(sx - 17, sy - 16, 34, 4); c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(sx - 17, sy - 16, 34, 1.2);
      c.fillStyle = '#5e3c22'; c.fillRect(sx - 17, sy - 7, 34, 1.2); c.fillRect(sx - 15, sy - 12, 3, 12); c.fillRect(sx + 12, sy - 12, 3, 12);
      c.restore(); }
    c.save(); c.translate(p.x + j, p.y);
    c.fillStyle = 'rgba(30,24,12,.3)'; ell(c, 4, 2, 46, 9); c.fill();
    c.fillStyle = '#3f6a4a'; rr(c, -36, -40, 72, 40, 4); c.fill(); c.fillStyle = '#4f7d5a'; c.fillRect(-36, -40, 72, 7);
    c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(-34, -33, 3, 31);
    c.fillStyle = '#d9b75a'; c.fillRect(-36, -12, 72, 2.5);
    c.fillStyle = '#2f5a3a'; for (const bx of [-31, 31]){ ell(c, bx, -36, 1.2, 1.2); c.fill(); ell(c, bx, -5, 1.2, 1.2); c.fill(); }
    // the blades, behind a window in the front
    c.fillStyle = '#1e1a17'; rr(c, -18, -30, 36, 15, 3); c.fill();
    c.save(); c.beginPath(); c.rect(-18, -30, 36, 15); c.clip(); c.fillStyle = '#9aa0a4';
    for (let k = 0; k < 5; k++){ c.save(); c.translate(-12 + k*6, -22.5); c.rotate((on ? E.t*20 : 0) + k); c.fillRect(-1, -7, 2, 14); c.restore(); }
    if (on) for (let k = 0; k < 6; k++){ const rnd = mulberry(Math.floor(E.t*12) + k); c.fillStyle = H.LEAFC[Math.floor(rnd()*H.LEAFC.length)].c; c.fillRect(-16 + rnd()*32, -29 + rnd()*13, 2, 1.2); }
    c.restore();
    c.strokeStyle = '#6b7276'; c.lineWidth = 1.4; rr(c, -18, -30, 36, 15, 3); c.stroke();
    // the hopper: a wide steel funnel, open at the top, with a rolled rim
    c.fillStyle = '#7d878c'; c.beginPath(); c.moveTo(-40, -58); c.lineTo(40, -58); c.lineTo(28, -40); c.lineTo(-28, -40); c.closePath(); c.fill();
    c.fillStyle = 'rgba(0,0,0,.15)'; c.beginPath(); c.moveTo(14, -58); c.lineTo(40, -58); c.lineTo(28, -40); c.lineTo(10, -40); c.closePath(); c.fill();
    c.fillStyle = '#2a2624'; ell(c, 0, -58, 39, 5); c.fill();
    // a heap of leaves in the hopper that grows as bags are poured in and sinks, churning, as the blades chew
    { const n = Math.min(60, Math.round(M.shred.pile)), hgt = Math.min(20, n*0.36);
      for (let k = 0; k < n; k++){ const rnd = mulberry(k*7 + 3), u = rnd()*2 - 1, top = hgt*(1 - u*u)*rnd(), jx = on ? Math.sin(E.t*30 + k)*0.7 : 0; H.stampLeaf(c, u*30 + jx, -58 - top + (1 - Math.abs(u))*1.5, 4.8, rnd()*TAU + (on ? E.t*(k % 3 - 1) : 0), Math.floor(rnd()*H.LEAFC.length), 1, 1, .85, 1); } }
    c.strokeStyle = '#9aa3a8'; c.lineWidth = 2; ell(c, 0, -58, 40, 5.4); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1; c.beginPath(); c.ellipse(0, -58, 40, 5.4, 0, Math.PI*1.05, Math.PI*1.5); c.stroke();
    // V21.2: the spout: a copper pipe up out of the shredder's right side with a hood on a swivel, aimed at the pot
    // that's filling; the shreds blow out of it in a stream (update)
    c.strokeStyle = '#8a4e2a'; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(30, -26); c.quadraticCurveTo(48, -40, 46, -86); c.stroke();
    c.strokeStyle = '#c47a3e'; c.lineWidth = 4; c.beginPath(); c.moveTo(28, -27); c.quadraticCurveTo(45, -40, 43, -84); c.stroke();
    c.strokeStyle = 'rgba(255,220,170,.5)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(27, -28); c.quadraticCurveTo(43, -41, 41.5, -82); c.stroke();
    c.fillStyle = '#6e3c22'; for (const yy of [-50, -70]){ c.fillRect(39, yy, 14, 3); }
    { const t = spoutTip(), tx = t.x - p.x - j, ty = t.y - p.y, d = Math.hypot(tx - 46, ty + 90) || 1, ux = (tx - 46)/d, uy = (ty + 90)/d;
      // a gooseneck: up out of the pipe and bent over toward the pot, a flared mouth at the end
      c.lineCap = 'round';
      c.strokeStyle = '#8a4e2a'; c.lineWidth = 9; c.beginPath(); c.moveTo(46, -84); c.quadraticCurveTo(46, -100, tx, ty); c.stroke();
      c.strokeStyle = '#c47a3e'; c.lineWidth = 4; c.beginPath(); c.moveTo(44, -84); c.quadraticCurveTo(44, -101, tx - uy*1.5, ty - 1.5); c.stroke();
      c.save(); c.translate(tx, ty); c.rotate(Math.atan2(uy, ux));
      c.fillStyle = '#7a4424'; c.beginPath(); c.moveTo(-4, -5); c.lineTo(3, -7.5); c.lineTo(3, 7.5); c.lineTo(-4, 5); c.closePath(); c.fill();
      c.fillStyle = '#2a1a10'; ell(c, 3, 0, 2.2, 7.2); c.fill(); c.strokeStyle = '#d9b75a'; c.lineWidth = 1.2; ell(c, 3, 0, 2.4, 7.5); c.stroke();
      c.restore();
      c.fillStyle = '#d9b75a'; c.fillRect(39, -86, 14, 3); }
    c.fillStyle = on ? '#9fe08a' : '#2f4f38'; ell(c, -26, -20, 3, 3); c.fill();
    c.restore();
  }
  function pot(c, P2){
    const col = potCol(P2), lvl = P2.L;
    c.save(); c.translate(P2.x, P2.y);
    c.fillStyle = 'rgba(30,24,12,.3)'; ell(c, 4, 4, 56, 12); c.fill();
    c.fillStyle = '#8a4e35'; rr(c, -44, -18, 88, 20, 3); c.fill(); c.fillStyle = '#6e3c28'; for (let x = -40; x < 44; x += 14) c.fillRect(x, -18, 1.5, 20);
    c.fillStyle = 'rgba(255,150,60,' + (0.6 + Math.sin(E.t*7 + P2.x)*0.15) + ')'; rr(c, -14, -12, 28, 10, 3); c.fill();
    const g = c.createLinearGradient(-46, 0, 46, 0); g.addColorStop(0, '#8a4a22'); g.addColorStop(0.35, '#d08a4a'); g.addColorStop(1, '#7a3e1c');
    c.fillStyle = g; c.beginPath(); c.moveTo(-46, -66); c.bezierCurveTo(-48, -20, -30, -14, 0, -14); c.bezierCurveTo(30, -14, 48, -20, 46, -66); c.closePath(); c.fill();
    c.fillStyle = '#5a2e14'; ell(c, 0, -66, 46, 11); c.fill();
    // (V21.2: the level shows: a low pot's surface sits deeper inside the rim, clipped by it)
    if (lvl > 0.02){ const dy = (1 - lvl)*15; c.save(); ell(c, 0, -66, 45, 10.5); c.clip();
      c.fillStyle = col; ell(c, 0, -66 + dy, 42*(0.8 + lvl*0.2), 9*(0.8 + lvl*0.2)); c.fill();
      c.fillStyle = 'rgba(255,255,255,.18)'; ell(c, -10 + Math.sin(E.t*3)*8, -68 + dy, 9, 2.4); c.fill();
      if (P2.st !== 'fill' || lvl > 0.3){ c.fillStyle = 'rgba(0,0,0,.12)'; for (let k = 0; k < 3; k++){ const a = E.t*2 + k*2.1; ell(c, Math.cos(a)*24, -66 + dy + Math.sin(a)*4, 4, 1.4); c.fill(); } }
      c.restore(); }
    c.strokeStyle = '#e9a85e'; c.lineWidth = 2; ell(c, 0, -66, 46, 11); c.stroke();
    c.restore();
  }
  // the roller mill: a hopper of green sludge on top, a big drum that rolls it out, and the sheet coming out at the right
  function mill(c){
    const p = P.mill, m = M.mill;
    c.save(); c.translate(p.x, p.y);
    c.fillStyle = 'rgba(30,24,12,.3)'; ell(c, 6, 3, 58, 11); c.fill();
    c.fillStyle = '#4a5d6e'; rr(c, -46, -40, 92, 40, 4); c.fill(); c.fillStyle = '#5c7186'; c.fillRect(-46, -40, 92, 7); c.fillStyle = '#d9b75a'; c.fillRect(-46, -16, 92, 3);
    for (const sx of [-42, 34]){ c.fillStyle = '#3d4d5c'; rr(c, sx, -78, 8, 40, 2); c.fill(); }
    // the drum
    c.fillStyle = '#7d8b92'; rr(c, -36, -74, 72, 30, 14); c.fill();
    c.save(); c.beginPath(); rr(c, -36, -74, 72, 30, 14); c.clip(); c.fillStyle = 'rgba(40,50,56,.4)'; for (let k = 0; k < 8; k++){ const y = -74 + ((k*8 + m.roll*40) % 64) - 8; c.fillRect(-36, y, 72, 2); } c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(-36, -70, 72, 4); c.restore();
    c.fillStyle = '#d9b75a'; ell(c, -38, -59, 4, 4); c.fill(); ell(c, 38, -59, 4, 4); c.fill();
    // the hopper of sludge (filled by the buckets)
    c.fillStyle = '#9aa3a8'; c.beginPath(); c.moveTo(-60, -96); c.lineTo(-24, -96); c.lineTo(-30, -74); c.lineTo(-54, -74); c.closePath(); c.fill();
    const lv = clamp(m.ink/3, 0, 1); if (lv > 0.02){ c.fillStyle = SLUDGE[2]; ell(c, -42, -94 + (1 - lv)*14, 17 - (1 - lv)*3, 3); c.fill(); }
    c.fillStyle = m.run > 0.5 ? '#9fe08a' : '#2f4f38'; ell(c, 30, -28, 3, 3); c.fill();
    c.restore();
  }
  // the sheet runs along a table from the mill to the cutter
  function sheetTable(c){
    const x0 = P.mill.x + 44, x1 = P.cut.x - 30, y = P.mill.y - 2;
    c.fillStyle = 'rgba(30,24,12,.25)'; c.fillRect(x0, y + 1, x1 - x0, 5);
    c.fillStyle = '#6e4428'; for (let x = x0 + 4; x < x1; x += 40) c.fillRect(x, y - 30, 3, 30);
    c.fillStyle = '#8a5a36'; rr(c, x0, y - 34, x1 - x0, 6, 2); c.fill();
    c.fillStyle = '#4f9a3c'; c.fillRect(x0 - 4, y - 38, x1 - x0 + 14, 5);
    c.fillStyle = 'rgba(230,250,210,.5)'; const off = M.sheet % 16; for (let x = x0 - 4 + off; x < x1 + 10; x += 16){ ell(c, x, y - 35.5, 1.6, 1.1); c.fill(); }
    c.fillStyle = 'rgba(30,70,24,.35)'; c.fillRect(x0 - 4, y - 34, x1 - x0 + 14, 1.2);
  }
  // the cutter: a guillotine that drops onto the sheet, and the notes on its tray
  function cutter(c){
    const p = P.cut, cu = M.cut;
    c.save(); c.translate(p.x, p.y);
    c.fillStyle = 'rgba(30,24,12,.3)'; ell(c, 4, 3, 44, 10); c.fill();
    c.fillStyle = '#6e2f2f'; rr(c, -30, -36, 60, 36, 4); c.fill(); c.fillStyle = '#d9b75a'; c.fillRect(-30, -20, 60, 3);
    c.fillStyle = '#5a2626'; c.fillRect(-28, -96, 8, 62); c.fillRect(20, -96, 8, 62); c.fillStyle = '#7a3a3a'; rr(c, -32, -104, 64, 10, 3); c.fill();
    const by = -86 + cu.down*44; c.fillStyle = '#c9d4d8'; c.beginPath(); c.moveTo(-20, by); c.lineTo(20, by); c.lineTo(20, by + 8); c.lineTo(-20, by + 13); c.closePath(); c.fill(); c.fillStyle = '#5d6569'; c.fillRect(-20, by - 4, 40, 4);
    c.fillStyle = '#4f9a3c'; c.fillRect(-30, -40, 30, 4);
    // the tray of notes in front
    c.fillStyle = '#7d8b92'; c.fillRect(-18, -2, 40, 4);
    for (let i = 0; i < Math.min(cu.tray, 16); i++) itemCash(c, -8 + (i % 3)*10, -2 - Math.floor(i/3)*2.2, 0.7);
    c.restore();
  }
  function stackTable(c){
    const p = P.stack;
    c.fillStyle = 'rgba(30,24,12,.25)'; ell(c, p.x + 2, p.y + 2, 30, 6); c.fill();
    c.fillStyle = '#6e4428'; for (const dx of [-24, 22]) c.fillRect(p.x + dx, p.y - 22, 3, 22); c.fillStyle = '#8a5a36'; rr(c, p.x - 28, p.y - 26, 56, 6, 2); c.fill();
    for (let i = 0; i < M.table; i++) itemCash(c, p.x - 14 + (i % 3)*13, p.y - 26 - Math.floor(i/3)*4.6, 0.85);
  }
  function cashBox(c){
    const p = P.box, n = Math.min(M.box, 26);
    c.save(); c.translate(p.x, p.y);
    c.fillStyle = 'rgba(30,24,12,.35)'; ell(c, 4, 3, 50, 9); c.fill();
    c.fillStyle = '#2f6a42'; c.beginPath(); c.moveTo(-40, -40); c.lineTo(40, -40); c.lineTo(34, 0); c.lineTo(-34, 0); c.closePath(); c.fill();
    c.fillStyle = '#3f8a56'; c.fillRect(-42, -44, 84, 6); c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(-36, -36, 4, 32);
    c.fillStyle = '#d9b75a'; ell(c, 0, -20, 9, 9); c.fill(); c.fillStyle = '#b8862a'; ell(c, 0, -20, 6, 6); c.fill(); c.fillStyle = '#d9b75a'; ell(c, -1, -21, 3.5, 3.5); c.fill();
    const rnd = mulberry(91); for (let i = 0; i < n; i++) itemCash(c, -30 + rnd()*60, -42 - Math.floor(i/6)*3.4 - rnd()*2, 0.9, rnd()*0.6 - 0.3);
    c.restore();
  }
  // ── props: things a bank has, never explained
  function props(list){
    const d = P.desk;
    list.push({ y: d.y, f: c => { c.fillStyle = 'rgba(30,24,12,.25)'; ell(c, d.x + 2, d.y + 2, 34, 6); c.fill(); c.fillStyle = '#6e4428'; rr(c, d.x - 30, d.y - 22, 60, 22, 2); c.fill(); c.fillStyle = '#8a5a36'; rr(c, d.x - 32, d.y - 26, 64, 6, 2); c.fill(); c.fillStyle = '#f4ecd8'; c.fillRect(d.x - 14, d.y - 29, 12, 3); c.fillRect(d.x - 12, d.y - 31, 12, 2); c.fillStyle = '#2f5a3a'; c.fillRect(d.x + 8, d.y - 30, 3, 4); c.fillStyle = '#2f6a42'; c.beginPath(); c.moveTo(d.x + 4, d.y - 36); c.lineTo(d.x + 15, d.y - 36); c.lineTo(d.x + 12, d.y - 31); c.lineTo(d.x + 7, d.y - 31); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,220,140,.35)'; ell(c, d.x + 10, d.y - 28, 8, 2.4); c.fill(); } });
    for (const [x, y] of [[-380, -84], [228, -76]]) list.push({ y, f: c => plant(c, x, y) });
    list.push({ y: -300, f: c => { const x = 384, y = -300; c.fillStyle = 'rgba(30,24,12,.25)'; ell(c, x + 2, y + 1, 9, 3); c.fill(); c.fillStyle = '#e9e4da'; rr(c, x - 7, y - 26, 14, 26, 2); c.fill(); c.fillStyle = 'rgba(160,210,235,.8)'; rr(c, x - 6, y - 42, 12, 16, 4); c.fill(); c.fillStyle = '#5d6669'; c.fillRect(x - 1, y - 20, 4, 2); } });
    list.push({ y: B.yb + 4, f: c => { for (let k = 0; k < 3; k++){ const x = 160 + k*22; c.fillStyle = '#7d878c'; rr(c, x, B.yb - 34, 20, 38, 1.5); c.fill(); c.fillStyle = 'rgba(30,40,46,.45)'; for (const yy of [-28, -16, -4]){ c.fillRect(x + 3, B.yb + yy, 14, 9); } c.fillStyle = '#d9b75a'; for (const yy of [-24, -12, 0]) c.fillRect(x + 8, B.yb + yy, 4, 1.4); } } });
    list.push({ y: -70, f: c => { const x = 372, y = -70; c.strokeStyle = '#5a3f28'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 46); c.stroke(); c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x + 6, y); c.stroke(); c.fillStyle = '#2f2a26'; c.beginPath(); c.ellipse(x - 5, y - 44, 6, 4, 0, Math.PI, 0); c.closePath(); c.fill(); c.fillRect(x - 12, y - 44, 14, 1.6); c.fillStyle = '#2f5a3a'; rr(c, x + 1, y - 40, 7, 16, 2); c.fill(); } });
    // rope barriers along the carpet, and a trash can by the door
    list.push({ y: -98, f: c => { for (let x = -200; x <= 200; x += 80){ c.fillStyle = '#d9b75a'; c.fillRect(x - 1.5, -98 - 22, 3, 22); ell(c, x, -98 - 23, 3, 3); c.fill(); ell(c, x, -98, 5, 1.6); c.fill(); if (x < 200){ c.strokeStyle = '#9c3b2e'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, -118); c.quadraticCurveTo(x + 40, -108, x + 80, -118); c.stroke(); } } } });
    list.push({ y: -60, f: c => trashCan(c, -228, -60) });
  }
  function plant(c, x, y){
    c.fillStyle = 'rgba(30,24,12,.25)'; ell(c, x + 2, y + 1, 11, 3); c.fill();
    c.fillStyle = '#b8652a'; c.beginPath(); c.moveTo(x - 8, y - 14); c.lineTo(x + 8, y - 14); c.lineTo(x + 6, y); c.lineTo(x - 6, y); c.closePath(); c.fill();
    const rnd = mulberry(Math.round(x)); for (let k = 0; k < 9; k++){ const a = -Math.PI/2 + (rnd() - 0.5)*2.2, l = 14 + rnd()*14; c.fillStyle = k % 2 ? '#5f7d3a' : '#7d9a45'; c.save(); c.translate(x + Math.cos(a)*l*0.5, y - 14 + Math.sin(a)*l*0.8); c.rotate(a); ell(c, 0, 0, 7, 3); c.fill(); c.restore(); }
  }
  // V21: more detail outside: a rusticated base, pilasters between arched windows with keystones and glazing bars, a
  // frieze of gold coins under a dentil cornice, the portico with fluted columns and steps
  function facade(c){
    const by = B.yf - B.h, dx = -262, X0 = B.x0 - 8, X1 = B.x1 + 8;
    // ashlar courses, and a heavier rusticated base with deep joints
    c.fillStyle = 'rgba(160,140,100,.22)'; for (let y = by + 12; y < B.yf - 18; y += 12) c.fillRect(X0, y, X1 - X0, 1);
    { let r = 0; for (let y = by + 12; y < B.yf - 18; y += 12, r++) for (let x = X0 + (r % 2)*24; x < X1; x += 48) c.fillRect(x, y, 1, 12); }
    c.fillStyle = '#d3c6a6'; c.fillRect(X0, B.yf - 18, X1 - X0, 18);
    c.fillStyle = 'rgba(120,100,70,.45)'; c.fillRect(X0, B.yf - 18, X1 - X0, 1.5); c.fillRect(X0, B.yf - 9.5, X1 - X0, 1.2);
    for (let x = X0 + 6, r = 0; x < X1; x += 30, r++){ c.fillRect(x, B.yf - 18, 1.2, 8.5); c.fillRect(x + 15, B.yf - 9.5, 1.2, 9.5); }
    c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(X0, B.yf - 20, X1 - X0, 2);
    // the frieze under the cornice: a band with little gold coins, and a row of dentils
    c.fillStyle = '#ece2c8'; c.fillRect(X0, by, X1 - X0, 11);
    c.fillStyle = 'rgba(150,130,90,.5)'; c.fillRect(X0, by + 11, X1 - X0, 1.2);
    for (let x = X0 + 4; x < X1 - 3; x += 7){ c.fillStyle = '#dccfb0'; c.fillRect(x, by + 1, 4, 4); c.fillStyle = 'rgba(120,100,70,.35)'; c.fillRect(x + 3, by + 1, 1, 4); }
    for (let x = -200; x <= 360; x += 56){ c.fillStyle = '#b8862a'; ell(c, x, by + 8, 2.6, 2.6); c.fill(); c.fillStyle = '#e8c96a'; ell(c, x - 0.4, by + 7.6, 1.6, 1.6); c.fill(); }
    // tall arched windows between pilasters
    const WX = [-150, -60, 30, 120, 210, 290];
    for (const x of [-195, -105, -15, 75, 165, 250, 330]){
      c.fillStyle = '#efe6d0'; c.fillRect(x - 6, by + 14, 12, B.h - 32); c.fillStyle = 'rgba(150,130,90,.35)'; c.fillRect(x + 4, by + 14, 2, B.h - 32);
      c.fillStyle = '#e4d8bc'; c.fillRect(x - 8, by + 14, 16, 4); c.fillRect(x - 8, B.yf - 22, 16, 4);
    }
    for (const x of WX){
      if (x === 290) continue;
      const wt = by + 22, wb = B.yf - 30;
      c.fillStyle = '#cfc2a2'; c.beginPath(); c.moveTo(x - 18, wb + 3); c.lineTo(x - 18, wt + 15); c.arc(x, wt + 15, 18, Math.PI, 0); c.lineTo(x + 18, wb + 3); c.closePath(); c.fill();
      const g = c.createLinearGradient(0, wt, 0, wb); g.addColorStop(0, '#fff0bf'); g.addColorStop(0.55, '#f2c878'); g.addColorStop(1, '#d9a050'); c.fillStyle = g;
      c.beginPath(); c.moveTo(x - 14, wb); c.lineTo(x - 14, wt + 15); c.arc(x, wt + 15, 14, Math.PI, 0); c.lineTo(x + 14, wb); c.closePath(); c.fill();
      // a glimpse of the hall through the glass: the tops of the green pots' steam, a lamp
      c.fillStyle = 'rgba(120,80,40,.18)'; c.fillRect(x - 14, wb - 12, 28, 12);
      c.strokeStyle = '#8a7a5c'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(x, wt + 1); c.lineTo(x, wb); c.moveTo(x - 14, wt + 26); c.lineTo(x + 14, wt + 26); c.moveTo(x - 14, wt + 40); c.lineTo(x + 14, wt + 40); c.stroke();
      c.beginPath(); c.arc(x, wt + 15, 7, Math.PI, 0); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.moveTo(x - 11, wt + 18); c.lineTo(x - 6, wt + 6); c.lineTo(x - 3, wt + 6); c.lineTo(x - 8, wt + 18); c.closePath(); c.fill();
      c.fillStyle = '#efe6d0'; c.beginPath(); c.moveTo(x - 4, wt - 3); c.lineTo(x + 4, wt - 3); c.lineTo(x + 3, wt + 4); c.lineTo(x - 3, wt + 4); c.closePath(); c.fill();   // keystone
      c.fillStyle = '#d6c8a8'; c.fillRect(x - 20, wb, 40, 4); c.fillStyle = 'rgba(120,100,70,.35)'; c.fillRect(x - 20, wb + 4, 40, 1.2);   // sill
    }
    // the portico: fluted columns with capitals, a pediment with a gold coin, steps up to the door
    for (const x of [dx - 34, dx + 34]){
      c.fillStyle = 'rgba(80,60,30,.18)'; c.fillRect(x + 7, by + 12, 4, B.h - 14);
      c.fillStyle = '#f4ecd8'; c.fillRect(x - 7, by + 10, 14, B.h - 12); c.fillStyle = 'rgba(160,140,100,.4)'; for (const k of [-4, -1, 2, 5]) c.fillRect(x + k - 0.5, by + 16, 1, B.h - 22);
      c.fillStyle = '#e2d4b2'; c.fillRect(x - 10, by + 7, 20, 5); c.fillStyle = '#d6c8a8'; ell(c, x - 7, by + 12.5, 2.4, 2.2); c.fill(); ell(c, x + 7, by + 12.5, 2.4, 2.2); c.fill();
      c.fillStyle = '#d6c8a8'; c.fillRect(x - 10, B.yf - 6, 20, 4);
    }
    // the doors: heavy panelled doors folded back inside the opening, brass handles
    for (const sx of [-1, 1]){ c.fillStyle = '#5a3a24'; c.fillRect(dx + sx*20 - (sx > 0 ? 6 : 0), B.yf - 62, 6, 62); c.fillStyle = '#d9b75a'; c.fillRect(dx + sx*20 - (sx > 0 ? 4 : -2), B.yf - 32, 2, 4); }
    c.fillStyle = '#efe6d0'; c.beginPath(); c.arc(dx, B.yf - 62, 20, Math.PI, 0); c.lineTo(dx + 20, B.yf - 62); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,214,140,.55)'; c.beginPath(); c.arc(dx, B.yf - 62, 15, Math.PI, 0); c.closePath(); c.fill();
    c.strokeStyle = '#b8862a'; c.lineWidth = 0.9; for (let k = 1; k < 6; k++){ const a = Math.PI + k*Math.PI/6; c.beginPath(); c.moveTo(dx, B.yf - 62); c.lineTo(dx + Math.cos(a)*15, B.yf - 62 + Math.sin(a)*15); c.stroke(); }
    // the lanterns either side of the door
    for (const x of [dx - 26, dx + 26]){ c.strokeStyle = '#3d3734'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, B.yf - 54); c.lineTo(x, B.yf - 58); c.stroke(); c.fillStyle = '#3d3734'; rr(c, x - 3.5, B.yf - 51, 7, 11, 1.5); c.fill(); c.fillStyle = 'rgba(255,214,140,.95)'; rr(c, x - 2.2, B.yf - 49.5, 4.4, 8, 1); c.fill(); c.fillStyle = '#3d3734'; c.beginPath(); c.moveTo(x - 4.5, B.yf - 51); c.lineTo(x, B.yf - 55); c.lineTo(x + 4.5, B.yf - 51); c.closePath(); c.fill(); }
    // steps
    c.fillStyle = '#c9b996'; c.fillRect(dx - 34, B.yf - 3, 68, 3); c.fillStyle = '#ddd0b2'; c.fillRect(dx - 30, B.yf - 6, 60, 3);
    // the side door: a plain service door with a little hood and a lamp
    { const d = B.doors[1]; c.fillStyle = '#cfc2a2'; c.fillRect(d.x - d.w/2 - 4, B.yf - d.h - 6, d.w + 8, 6); c.fillStyle = '#3d3734'; rr(c, d.x + d.w/2 + 3, B.yf - d.h + 4, 5, 8, 1.2); c.fill(); c.fillStyle = 'rgba(255,214,140,.9)'; rr(c, d.x + d.w/2 + 4, B.yf - d.h + 5.5, 3, 5, 1); c.fill(); }
    // a copper downpipe at each corner, gone green
    drawSecCam(c, CAMS.out);   // (V39: hanging under the frieze right of the portico, over the front door)
    for (const x of [B.x0 - 2, B.x1 + 1]){ c.fillStyle = '#5f9c8a'; c.fillRect(x - 1.5, by - 2, 3, B.h + 2); c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(x - 1.5, by - 2, 1, B.h + 2); for (let y = by + 14; y < B.yf; y += 26){ c.fillStyle = '#4a7d6e'; c.fillRect(x - 2.5, y, 5, 2); } }
  }
  // V21: the roof in more detail (slates with a little shading, a green copper ridge with cresting, dormers, chimneys
  // with pots and a wisp of smoke, a dentil cornice) and a proper dome: a stone drum with pilasters and lit arched
  // windows, a glass dome with lead ribs and rings and a shine, a gold band, and a little lantern with the gold coin
  function roof(c){
    const y0 = B.yb - B.h, y1 = B.yf - B.h, w = B.x1 - B.x0, X0 = B.x0 - 14, X1 = B.x1 + 14;
    const sg = c.createLinearGradient(0, y0, 0, y1); sg.addColorStop(0, '#4d4644'); sg.addColorStop(1, '#615856'); c.fillStyle = sg; c.fillRect(X0, y0 - 6, X1 - X0, y1 - y0 + 6);
    // slates: rows with staggered joints, a few lighter and darker ones
    const rnd = mulberry(77);
    for (let y = y0, r = 0; y < y1; y += 9, r++){
      c.fillStyle = 'rgba(25,20,18,.38)'; c.fillRect(X0, y, X1 - X0, 1);
      for (let x = X0 + (r % 2)*11; x < X1; x += 22){ c.fillStyle = 'rgba(25,20,18,.22)'; c.fillRect(x, y, 1, 9); const v = rnd(); if (v < 0.12){ c.fillStyle = 'rgba(255,255,255,.035)'; c.fillRect(x + 1, y + 1, 21, 8); } else if (v > 0.9){ c.fillStyle = 'rgba(0,0,0,.06)'; c.fillRect(x + 1, y + 1, 21, 8); } }
    }
    const ry = (y0 + y1)/2;
    // the ridge: green copper with little iron finials
    c.fillStyle = '#5f9c8a'; c.fillRect(X0, ry - 4, X1 - X0, 8); c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(X0, ry - 4, X1 - X0, 2); c.fillStyle = 'rgba(20,50,40,.3)'; c.fillRect(X0, ry + 3, X1 - X0, 1.2);
    c.fillStyle = '#3d3734'; for (let x = X0 + 10; x < X1; x += 16){ if (Math.abs(x) < 96) continue; c.fillRect(x - 0.6, ry - 9, 1.2, 5); ell(c, x, ry - 9.5, 1.4, 1.4); c.fill(); }
    // chimneys with pots, smoking a little
    for (const x of [-300, 300]){
      const y = y0 + 52;
      c.fillStyle = 'rgba(20,14,10,.25)'; c.fillRect(x + 12, y - 2, 10, 8);
      c.fillStyle = '#9a5a40'; c.fillRect(x - 14, y - 50, 28, 52);
      c.fillStyle = 'rgba(60,24,14,.35)'; for (let yy = y - 46, r = 0; yy < y; yy += 5, r++){ c.fillRect(x - 14, yy, 28, 0.8); for (let xx = x - 14 + (r % 2)*5; xx < x + 14; xx += 10) c.fillRect(xx, yy - 5, 0.8, 5); }
      c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(x + 6, y - 50, 8, 52);
      c.fillStyle = '#7a4430'; c.fillRect(x - 16, y - 54, 32, 6); c.fillStyle = '#d6c8a8'; c.fillRect(x - 16, y - 55, 32, 1.5);
      for (const px of [x - 7, x + 7]){ c.fillStyle = '#b86a42'; rr(c, px - 3.5, y - 63, 7, 10, 1.5); c.fill(); c.fillStyle = '#2a1e18'; ell(c, px, y - 63, 3, 1.1); c.fill(); }
      if (Math.random() < 0.05 && !E.quiet){ puff(x + rand(-7, 7), y - 66, 'rgba(225,220,214,.5)', rand(3, 5)); E.parts[E.parts.length - 1].out = true; }
    }
    // dormers along the front of the roof
    for (const x of [-220, -130, 130, 220]){
      const yb2 = y1 - 10;
      c.fillStyle = 'rgba(20,14,10,.25)'; c.fillRect(x - 13, yb2 - 1, 30, 5);
      c.fillStyle = '#ece2c8'; c.fillRect(x - 13, yb2 - 26, 26, 26);
      c.fillStyle = '#4d4644'; c.beginPath(); c.moveTo(x - 17, yb2 - 24); c.lineTo(x, yb2 - 38); c.lineTo(x + 17, yb2 - 24); c.closePath(); c.fill();
      c.fillStyle = '#5f9c8a'; c.beginPath(); c.moveTo(x - 17, yb2 - 24); c.lineTo(x, yb2 - 38); c.lineTo(x + 17, yb2 - 24); c.lineTo(x + 17, yb2 - 22); c.lineTo(x, yb2 - 36); c.lineTo(x - 17, yb2 - 22); c.closePath(); c.fill();
      const g = c.createLinearGradient(0, yb2 - 22, 0, yb2 - 3); g.addColorStop(0, '#fff0bf'); g.addColorStop(1, '#e2ac58'); c.fillStyle = g;
      c.beginPath(); c.moveTo(x - 8, yb2 - 3); c.lineTo(x - 8, yb2 - 15); c.arc(x, yb2 - 15, 8, Math.PI, 0); c.lineTo(x + 8, yb2 - 3); c.closePath(); c.fill();
      c.strokeStyle = '#8a7a5c'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(x, yb2 - 23); c.lineTo(x, yb2 - 3); c.moveTo(x - 8, yb2 - 12); c.lineTo(x + 8, yb2 - 12); c.stroke();
      c.fillStyle = '#d6c8a8'; c.fillRect(x - 10, yb2 - 3, 20, 3);
    }
    // the cornice along the front edge: a moulding over a row of dentils
    c.fillStyle = '#d6c8a8'; c.fillRect(B.x0 - 16, y1 - 6, w + 32, 8);
    c.fillStyle = '#ece2c8'; c.fillRect(B.x0 - 18, y1 - 8, w + 36, 3);
    c.fillStyle = 'rgba(120,100,70,.4)'; for (let x = B.x0 - 14; x < B.x1 + 14; x += 6) c.fillRect(x, y1 - 2, 3, 2.5);
    c.fillStyle = 'rgba(20,14,10,.2)'; c.fillRect(B.x0 - 16, y1 + 2, w + 32, 2);
    drawDome(c, 0, ry + 10, 66);
    pediment(c);
  }
  // the portico's pediment stands up in front of the roof's edge (drawn after the roof)
  function pediment(c){
    const by = B.yf - B.h, dx = -262;
    c.fillStyle = '#efe6d0'; c.beginPath(); c.moveTo(dx - 52, by + 8); c.lineTo(dx, by - 24); c.lineTo(dx + 52, by + 8); c.closePath(); c.fill();
    c.fillStyle = '#e2d6b8'; c.beginPath(); c.moveTo(dx - 42, by + 4); c.lineTo(dx, by - 17); c.lineTo(dx + 42, by + 4); c.closePath(); c.fill();
    c.strokeStyle = '#cdbf9f'; c.lineWidth = 2; c.beginPath(); c.moveTo(dx - 52, by + 8); c.lineTo(dx, by - 24); c.lineTo(dx + 52, by + 8); c.closePath(); c.stroke();
    c.fillStyle = '#d6c8a8'; c.fillRect(dx - 54, by + 7, 108, 4);
    c.fillStyle = '#d9b75a'; ell(c, dx, by - 3, 8, 8); c.fill(); c.fillStyle = '#b8862a'; ell(c, dx, by - 3, 5.5, 5.5); c.fill(); c.fillStyle = '#e8c96a'; ell(c, dx - 1, by - 4, 2.6, 2.6); c.fill();
    goldGlint(c, dx + 3, by - 6);
  }
  // the dome, seen from the front and above: base ring, drum, glass dome, lantern. (cx, base y of the drum, radius)
  function drawDome(c, cx, by, R){
    const KE = 0.38, Hd = 30, Rd = R, top = by - Hd, KH = 0.9;
    const P2 = (b, f) => ({ x: cx + Rd*Math.cos(b)*Math.cos(f), y: top - KH*Rd*Math.sin(b) + KE*Rd*Math.cos(b)*Math.sin(f) });
    // its shadow on the slates, and a stone platform
    c.fillStyle = 'rgba(20,14,10,.3)'; ell(c, cx + 10, by + 8, R + 18, (R + 18)*KE); c.fill();
    c.fillStyle = '#cfc2a2'; ell(c, cx, by + 4, R + 14, (R + 14)*KE); c.fill();
    c.fillStyle = '#e4d8bc'; ell(c, cx, by + 1, R + 12, (R + 12)*KE); c.fill();
    c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.ellipse(cx, by + 1, R + 12, (R + 12)*KE, 0, Math.PI*1.05, Math.PI*1.6); c.lineTo(cx, by + 1); c.closePath(); c.fill();
    // the drum: a stone cylinder, lit from the left
    const dg = c.createLinearGradient(cx - Rd, 0, cx + Rd, 0); dg.addColorStop(0, '#f6efdc'); dg.addColorStop(0.55, '#e2d5b6'); dg.addColorStop(1, '#b9a985');
    c.fillStyle = dg; c.beginPath(); c.moveTo(cx - Rd, top); c.lineTo(cx - Rd, by); c.ellipse(cx, by, Rd, Rd*KE, 0, Math.PI, 0, true); c.lineTo(cx + Rd, top); c.ellipse(cx, top, Rd, Rd*KE, 0, 0, Math.PI, false); c.closePath(); c.fill();
    // pilasters round the drum, with lit arched windows between them
    const NP = 12;
    for (let k = 0; k < NP; k++){
      const f0 = (k + 0.5)*Math.PI/NP; if (Math.sin(f0) < 0.15) continue;
      const fw = (k + 1)*Math.PI/NP;
      const xa = cx + Rd*Math.cos(f0), sh = Math.sin(f0), wdt = 7*sh;
      const ya = by + KE*Rd*sh, yt = top + KE*Rd*sh;
      if (k < NP - 1){
        const xw = cx + Rd*Math.cos(fw), sw = Math.sin(fw), ww2 = 4.6*sw, yb2 = by + KE*Rd*sw - 7, yt2 = top + KE*Rd*sw + 9;
        if (sw > 0.2){
          const g = c.createLinearGradient(0, yt2, 0, yb2); g.addColorStop(0, '#fff0bf'); g.addColorStop(1, '#e2ac58'); c.fillStyle = g;
          c.beginPath(); c.moveTo(xw - ww2, yb2); c.lineTo(xw - ww2, yt2 + ww2); c.ellipse(xw, yt2 + ww2, ww2, ww2, 0, Math.PI, 0); c.lineTo(xw + ww2, yb2); c.closePath(); c.fill();
          c.strokeStyle = 'rgba(138,122,92,.8)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(xw, yt2); c.lineTo(xw, yb2); c.stroke();
        }
      }
      c.fillStyle = 'rgba(255,255,255,' + (0.18 + 0.2*Math.max(0, -Math.cos(f0))) + ')'; c.fillRect(xa - wdt/2, yt + 2, wdt, ya - yt - 3);
      c.fillStyle = 'rgba(120,100,70,' + (0.2 + 0.2*Math.max(0, Math.cos(f0))) + ')'; c.fillRect(xa + wdt/2 - 0.8, yt + 2, 0.8, ya - yt - 3);
    }
    // mouldings round the foot and the top of the drum
    c.strokeStyle = '#cfc2a2'; c.lineWidth = 3; c.beginPath(); c.ellipse(cx, by - 2, Rd, Rd*KE, 0, 0, Math.PI); c.stroke();
    c.strokeStyle = '#efe6d0'; c.lineWidth = 4; c.beginPath(); c.ellipse(cx, top + 1, Rd + 1, (Rd + 1)*KE, 0, 0, Math.PI); c.stroke();
    // the glass dome: its outline from the side meridians and the front rim
    const N = 18, path = () => { c.beginPath(); for (let i = 0; i <= N; i++){ const q = P2(i/N*Math.PI/2, 0); i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); } for (let i = N; i >= 0; i--){ const q = P2(i/N*Math.PI/2, Math.PI); c.lineTo(q.x, q.y); } c.ellipse(cx, top, Rd, Rd*KE, 0, Math.PI, 0, true); c.closePath(); };
    const gg = c.createRadialGradient(cx - Rd*0.35, top - Rd*0.75, 3, cx, top - Rd*0.3, Rd*1.25);
    gg.addColorStop(0, '#f2fbfd'); gg.addColorStop(0.35, '#b6d6e0'); gg.addColorStop(0.75, '#6f97a6'); gg.addColorStop(1, '#4d6f7c');
    path(); c.fillStyle = gg; c.fill();
    c.save(); path(); c.clip();
    // warm light from the hall below shows through the lower panes
    const lg = c.createLinearGradient(0, top - Rd*0.4, 0, top + Rd*KE); lg.addColorStop(0, 'rgba(255,214,140,0)'); lg.addColorStop(1, 'rgba(255,214,140,.35)'); c.fillStyle = lg; c.fillRect(cx - Rd, top - Rd, Rd*2, Rd*1.5);
    // every other pane a little darker
    const NM = 16;
    for (let k = 0; k < NM; k++){
      if (k % 2) continue;
      const fa = k*Math.PI/NM, fb = (k + 1)*Math.PI/NM;
      c.beginPath(); for (let i = 0; i <= 10; i++){ const q = P2(i/10*Math.PI/2, fa); i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); } for (let i = 10; i >= 0; i--){ const q = P2(i/10*Math.PI/2, fb); c.lineTo(q.x, q.y); } c.closePath();
      c.fillStyle = 'rgba(40,70,84,.12)'; c.fill();
    }
    // lead ribs (meridians) and rings (latitudes)
    c.strokeStyle = 'rgba(52,66,72,.75)'; c.lineWidth = 1.1;
    for (let k = 1; k < NM; k++){ const f = k*Math.PI/NM; c.beginPath(); for (let i = 0; i <= 14; i++){ const q = P2(i/14*Math.PI/2, f); i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); } c.stroke(); }
    c.lineWidth = 0.9;
    for (const b of [0.28, 0.56, 0.86]){ c.beginPath(); for (let i = 0; i <= 24; i++){ const q = P2(b, i/24*Math.PI); i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); } c.stroke(); }
    // the shine: a soft curved streak up the left, and a glint that drifts across now and then
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); for (let i = 2; i <= 11; i++){ const q = P2(i/14*Math.PI/2, Math.PI*0.78); i > 2 ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); } c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 2; c.beginPath(); for (let i = 1; i <= 8; i++){ const q = P2(i/14*Math.PI/2, Math.PI*0.66); i > 1 ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); } c.stroke();
    { const ph = (E.t*0.12) % 1, f = Math.PI*(0.85 - ph*0.7), q = P2(0.75, f), a = Math.sin(ph*Math.PI)*0.7; c.fillStyle = 'rgba(255,255,255,' + a + ')'; ell(c, q.x, q.y, 3, 1.6); c.fill(); }
    c.restore();
    path(); c.strokeStyle = 'rgba(40,58,66,.9)'; c.lineWidth = 1.4; c.stroke();
    // a gold band where the glass meets the drum
    c.strokeStyle = '#b8862a'; c.lineWidth = 3.2; c.beginPath(); c.ellipse(cx, top, Rd, Rd*KE, 0, 0, Math.PI); c.stroke();
    c.strokeStyle = '#e8c96a'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(cx, top - 1, Rd, Rd*KE, 0, Math.PI*0.25, Math.PI*0.75); c.stroke();
    // the lantern on top: a small ring of columns, a little copper dome, and the gold coin
    const ap = P2(Math.PI/2, 0), lr = 11, lb = ap.y + 3, lt = lb - 13;
    c.fillStyle = '#e4d8bc'; ell(c, cx, lb, lr + 3, (lr + 3)*KE); c.fill();
    c.fillStyle = 'rgba(255,214,140,.85)'; c.fillRect(cx - lr, lt, lr*2, lb - lt);
    c.fillStyle = '#efe6d0'; for (const f of [0.2, 0.5, 0.8].map(v => v*Math.PI)){ const x = cx + lr*Math.cos(f); c.fillRect(x - 1.6, lt, 3.2, lb - lt); }
    c.fillStyle = '#d6c8a8'; ell(c, cx, lt, lr + 2, (lr + 2)*KE); c.fill();
    const cg = c.createLinearGradient(cx - lr, 0, cx + lr, 0); cg.addColorStop(0, '#8ccab6'); cg.addColorStop(1, '#4a8774');
    c.fillStyle = cg; c.beginPath(); c.ellipse(cx, lt - 1, lr, lr*0.85, 0, Math.PI, 0); c.closePath(); c.fill();
    c.fillStyle = '#b8862a'; c.fillRect(cx - 1.2, lt - lr*0.85 - 9, 2.4, 9);
    c.fillStyle = '#d9b75a'; ell(c, cx, lt - lr*0.85 - 13, 6.5, 6.5); c.fill(); c.fillStyle = '#b8862a'; ell(c, cx, lt - lr*0.85 - 13, 4.2, 4.2); c.fill(); c.fillStyle = '#f0d98a'; ell(c, cx - 1.2, lt - lr*0.85 - 14.2, 1.8, 1.8); c.fill();
    goldGlint(c, cx - 2, lt - lr*0.85 - 15);
  }
  function goldGlint(c, x, y){ const a = Math.pow(Math.max(0, Math.sin(E.t*1.3)), 8); if (a < 0.03) return; const z = 2 + a*5; c.fillStyle = 'rgba(255,250,220,' + a + ')'; c.beginPath(); c.moveTo(x, y - z); c.lineTo(x + z*0.25, y - z*0.25); c.lineTo(x + z, y); c.lineTo(x + z*0.25, y + z*0.25); c.lineTo(x, y + z); c.lineTo(x - z*0.25, y + z*0.25); c.lineTo(x - z, y); c.lineTo(x - z*0.25, y - z*0.25); c.closePath(); c.fill(); }
  B.facade = facade; B.roof = roof;
  let lscat = null;
  function scatterLeaves(c){
    if (!lscat){ const rnd = H.mulberry(47); lscat = []; for (let i = 0; i < 160; i++){ const x = -420 + rnd()*840; if (x > -240 && x < -90 && rnd() < .7) continue; lscat.push({ x, y: -32 + rnd()*34, s: 3.4 + rnd()*1.6, r: rnd()*Math.PI*2, ci: Math.floor(rnd()*H.LEAFC.length), sh: rnd() < .5 ? 1 : 0 }); } }
    for (const q of lscat) H.drawLeaf(c, q.x, q.y, q.s, q.r, q.ci, q.sh, 1, .8, 1, 0);
  }
  function items(list){
    list.push({ y: P.bags.y, f: c => bagPile(c, P.bags, M.piles[0]) }, { y: P.bags2.y, f: c => bagPile(c, P.bags2, M.piles[1]) }, { y: P.shred.y, f: shredder });
    if (M.pour) list.push({ y: M.pour.w.y + 0.5, f: drawPour });   // (V21: the bag being poured, in front of the one pouring it)
    for (const p of POTS) list.push({ y: p.y, f: c => pot(c, p) });
    list.push({ y: P.mill.y, f: mill }, { y: P.mill.y - 1, f: sheetTable }, { y: P.cut.y, f: cutter }, { y: P.stack.y, f: stackTable });
    props(list);
    // massive heaps of leaves out on the curb, and the cash container
    for (const [x, y, w, h, sd] of HEAPS) list.push({ y, f: c => drawHeap(c, x, y, sd, w, h) });
    list.push({ y: -33, f: scatterLeaves });   // (V21.3: and loose leaves all along the curb)
    list.push({ y: P.box.y, f: cashBox });
    list.push({ y: B.yf, f: c => drawShell(c, B) });
  }
  // V21.2: the camera follows the money being made, step by step and close. Outside, a greeter has met Tinker and taken
  // the truck's leaves in a sack (greet, lead); inside: 0. the sack goes on the pile by the shredder, where carriers are
  // already pouring bags in; 1. a bag poured into the hopper (the shredder waits, M.hold) and the sweeper cleaning up
  // what missed; 2. the shredder starts: the spout blows the shreds into the front pot, which is mixed and dyed green
  // (sped up while we watch, fast); 3. along the line: buckets to the roller mill, the green sheet, the cutter and the
  // stacks; 4. the runner out to the container. Steps after the one we're on run slower meanwhile (tempo).
  function* watch(){
    const dr = E.driver, zc = zTour(), g = sc.greeter, sw = sc.sweeper;
    const wide = frameView({ x0: B.x0 - 30, x1: B.x1 + 70, y0: B.yb - B.h - 20, y1: B.yf + 40 });
    // 0. the sack onto the pile, the carriers at work round the shredder
    sc.focus = 0;
    camFrame({ x0: P.bags.x - 40, x1: P.shred.x + 90, y0: P.shred.y - 120, y1: P.bags2.y + 40 }, 1.6, { zmax: zc*0.9 });
    yield within(9, () => g.st2 === 'dropped'); yield 0.4;
    // 1. a bag poured in, and the sweeper picking up what missed (the shredder waits)
    sc.focus = 1;
    camFrame({ x0: P.shred.x - 100, x1: P.shred.x + 90, y0: P.shred.y - 120, y1: P.shred.y + 70 }, 1.2, { zmax: zc });
    { const n0 = M.pours || 0; yield within(5, () => M.pour || (M.pours || 0) > n0); } yield within(3.5, () => !M.pour);
    { const t0 = sw.trips; yield within(5.5, () => sw.trips > t0); } yield 0.3;
    // 2. the shredder starts: the shreds blow over into the pot, mixed, then dyed green
    sc.focus = 2; M.hold = false; M.shred.bags = Math.max(M.shred.bags, 2); beep(dr, 'chat');
    camFrame({ x0: P.shred.x - 50, x1: POTS[1].x + 80, y0: POTS[0].y - 100, y1: POTS[1].y + 40 }, 1.3, { zmax: zc*0.9 });
    yield within(9, () => POTS[1].st !== 'fill'); yield within(10, () => POTS[1].green > 0.85); yield 0.5;
    // 3. along the line: a bucket of green into the roller mill, the long sheet, the cutter, the stacks of notes
    sc.focus = 3; M.table = Math.max(M.table, 2);   // (so the runner has a bundle to take out by the time we get there)
    camFrame({ x0: POTS[1].x - 50, x1: P.mill.x + 70, y0: P.mill.y - 110, y1: POTS[1].y + 30 }, 1.4, { zmax: zc*0.85 });
    yield 2.6;
    camFrame({ x0: P.mill.x - 40, x1: P.stack.x + 50, y0: P.cut.y - 120, y1: P.stack.y + 50 }, 2.4, { zmax: zc*0.9 });
    yield 2.8;
    // 4. out of the side door to the container
    sc.focus = 4;
    camFrame({ x0: P.stack.x - 60, x1: P.box.x + 60, y0: P.stack.y - 60, y1: P.box.y + 24 }, 1.4, { zmax: zc*0.85 });
    { const b0 = M.box; yield within(3.5, () => M.box > b0); } yield 0.5;
    sc.focus = null;
    camTo(wide.x, wide.y, wide.z, 1.8); yield 1.4;
  }
  // leaving: the cash in the container flies into the truck
  function* leave(){
    const T = E.truck, n = Math.min(M.box, 22);
    yield 0.4; sfx('horn', panOf(T.x));
    for (let i = 0; i < n; i++){ fly('cash', P.box.x + rand(-26, 26), P.box.y - 46, T.x + rand(-6, 56), LANE - 66, 0.55 + i*0.06, 60, { onEnd: () => { T.cash++; } }); }
    sfx('coins', 500);
    yield 0.2; M.box = 0; yield 0.55 + n*0.06 + 0.6;
  }
  return Object.assign(sc, { build, update, under, items, watch, leave, greet, lead });
}
// mix two #rrggbb colours
function mix(a, b, k){
  const p = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)], A = p(a), B2 = p(b);
  return '#' + A.map((v, i) => Math.round(lerp(v, B2[i], clamp(k, 0, 1))).toString(16).padStart(2, '0')).join('');
}

// ═════════════════════════ STORAGE — "where it all ends up"
// No stop here: the truck drives slowly past a very long storehouse, and through window after window we see shelves of
// honey jars and mushroom cans, shelf after shelf. It never ends; the picture just fades out (then the yard comes back).
function makeStorage(){
  const yf = -40, h = 116, WIN = 150, ww = 112, wh = 70;
  const sc = { id: 'storage', yf, h, skipX: () => true };
  // what you see through a window, drawn once per kind (honey, cans, a mix) and reused for every window
  const views = [];
  function windowView(kind){
    if (views[kind]) return views[kind];
    const S2 = 3, cv = document.createElement('canvas'); cv.width = ww*S2; cv.height = wh*S2;
    const g = cv.getContext('2d'); g.scale(S2, S2);
    const bg = g.createLinearGradient(0, 0, 0, wh); bg.addColorStop(0, '#5c4632'); bg.addColorStop(1, '#2e2218'); g.fillStyle = bg; g.fillRect(0, 0, ww, wh);
    const rnd = mulberry(kind*17 + 5);
    const rack = (x0, y0, sc2, dark) => {
      g.save(); g.translate(x0, y0); g.scale(sc2, sc2);
      const RW = ww/sc2 + 20;
      for (let s = 0; s < 3; s++){
        const y = 20 + s*22;
        for (let x = -6; x < RW; x += 9){
          // V21: four honey jars to every mushroom can, in every window (was whole windows of one or the other): kind 0
          // has the cans scattered, kind 1 in pairs, kind 2 in a diagonal
          const n = Math.round((x + 6)/9), can = kind === 0 ? (n + s*2) % 5 === 0 : kind === 1 ? (n + s*3) % 10 < 2 : (n*3 + s) % 5 === 1;
          if (can) drawCan(g, x, y - 5, 7); else drawHoney(g, x, y - 5, 6.6);
        }
        g.fillStyle = '#7a5a3c'; g.fillRect(-10, y, RW + 20, 3); g.fillStyle = '#5a3f28'; g.fillRect(-10, y + 3, RW + 20, 1.5);
      }
      for (let x = -4; x < RW; x += 54){ g.fillStyle = '#5a3f28'; g.fillRect(x, 0, 3, 90); }
      if (dark){ g.fillStyle = 'rgba(30,20,12,' + dark + ')'; g.fillRect(-10, -4, RW + 20, 100); }
      g.restore();
    };
    rack(-4, 4, 0.55, 0.55);   // another aisle behind, and another
    rack(-2, -2, 0.78, 0.3);
    rack(0, -6, 1, 0);
    // a lamp hanging over the aisle, and the glass
    const lg = g.createRadialGradient(ww*0.5, 4, 2, ww*0.5, 4, 60); lg.addColorStop(0, 'rgba(255,220,150,.35)'); lg.addColorStop(1, 'rgba(255,220,150,0)'); g.fillStyle = lg; g.fillRect(0, 0, ww, wh);
    g.fillStyle = 'rgba(220,235,245,.12)'; g.beginPath(); g.moveTo(10, 0); g.lineTo(34, 0); g.lineTo(14, wh); g.lineTo(-10, wh); g.closePath(); g.fill();
    g.fillStyle = 'rgba(220,235,245,.08)'; g.beginPath(); g.moveTo(52, 0); g.lineTo(60, 0); g.lineTo(40, wh); g.lineTo(32, wh); g.closePath(); g.fill();
    return (views[kind] = cv);
  }
  // V21: more detail: the roof with ridged skylights and ventilators, a corbelled brick cornice, stone bands, arched
  // brick lintels with keystones over the windows, wooden frames with glazing bars, sills, downpipes, lamps, and every
  // fourth bay a big wooden loading door instead of a window
  function front(c, V){
    const x0 = V.x0 - 40, x1 = V.x1 + 40, by = yf - h;
    // the roof, stretching back: slates, a row of ridged skylights and round ventilators
    const rg = c.createLinearGradient(0, by - 240, 0, by); rg.addColorStop(0, '#5e473b'); rg.addColorStop(1, '#755a4b'); c.fillStyle = rg; c.fillRect(x0, by - 240, x1 - x0, 240);
    c.strokeStyle = 'rgba(40,28,20,.35)'; c.lineWidth = 1.2; for (let y = by - 236; y < by; y += 10){ c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); }
    c.fillStyle = 'rgba(40,28,20,.18)'; for (let y = by - 236, r = 0; y < by; y += 10, r++) for (let x = Math.floor(x0/24)*24 + (r % 2)*12; x < x1; x += 24) c.fillRect(x, y, 1, 10);
    for (let i = Math.floor(x0/300); i < x1/300; i++){
      const sx = i*300 + 40;
      c.fillStyle = 'rgba(20,14,10,.3)'; c.fillRect(sx + 4, by - 146, 44, 32);
      c.fillStyle = '#4a3a30'; rr(c, sx - 2, by - 152, 48, 34, 3); c.fill();
      const gg = c.createLinearGradient(0, by - 150, 0, by - 120); gg.addColorStop(0, '#c8dbe2'); gg.addColorStop(1, '#7c98a4'); c.fillStyle = gg; c.fillRect(sx + 2, by - 149, 40, 28);
      c.fillStyle = 'rgba(255,224,160,.22)'; c.fillRect(sx + 2, by - 133, 40, 12);
      c.strokeStyle = '#4a3a30'; c.lineWidth = 1; c.beginPath(); for (const k of [12, 22, 32]){ c.moveTo(sx + 2 + k, by - 149); c.lineTo(sx + 2 + k, by - 121); } c.stroke();
      c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(sx + 2, by - 149, 40, 2);
      // a turning ventilator
      const vx = i*300 + 190, vy = by - 120;
      c.fillStyle = '#6a5e56'; c.fillRect(vx - 3, vy - 18, 6, 18); c.fillStyle = '#8a7e74'; ell(c, vx, vy - 22, 9, 7); c.fill();
      c.strokeStyle = 'rgba(40,32,28,.6)'; c.lineWidth = 0.8; for (let k = 0; k < 5; k++){ const a = E.t*3 + k*TAU/5; c.beginPath(); c.moveTo(vx + Math.cos(a)*8, vy - 22 - 5); c.quadraticCurveTo(vx + Math.cos(a + 0.6)*9, vy - 22, vx + Math.cos(a)*8, vy - 22 + 5); c.stroke(); }
      c.fillStyle = '#6a5e56'; ell(c, vx, vy - 29, 2.5, 1.6); c.fill();
    }
    c.fillStyle = '#4a3a30'; c.fillRect(x0, by - 6, x1 - x0, 8);
    // the long brick front
    c.fillStyle = '#a65a3e'; c.fillRect(x0, by, x1 - x0, h);
    // (V21.2: the odd bricks below don't use a random stream any more)
    for (let y = by + 6, r = 0; y < yf; y += 7, r++){
      c.fillStyle = 'rgba(80,36,24,.35)'; c.fillRect(x0, y, x1 - x0, 1);
      for (let x = Math.floor(x0/18)*18 + (r % 2)*9; x < x1; x += 18){ c.fillRect(x, y - 6, 1, 6); }
    }
    // odd-coloured bricks for variety. (V21.2: picked per brick by its place in the wall, so they stay put as the camera
    // moves; they used to be spread across whatever was on screen, so they slid about.)
    for (let y = by + 6, r = 0; y < yf; y += 7, r++){
      const off = (r % 2)*9;
      for (let i = Math.floor((x0 - off)/18); i*18 + off < x1; i++){
        const hsh = (Math.imul(i, 73856093) ^ Math.imul(r + 11, 19349663)) >>> 0;
        if (hsh % 100 >= 7) continue;
        c.fillStyle = (hsh >>> 8) % 2 ? 'rgba(255,200,170,.08)' : 'rgba(60,24,14,.1)'; c.fillRect(i*18 + off + 1, y - 6, 17, 6);
      }
    }
    // a corbelled cornice under the roof, and stone bands
    c.fillStyle = '#93503a'; c.fillRect(x0, by, x1 - x0, 8);
    for (let x = Math.floor(x0/12)*12; x < x1; x += 12){ c.fillStyle = '#8a4a34'; c.fillRect(x + 2, by + 8, 8, 4); c.fillStyle = 'rgba(30,14,8,.3)'; c.fillRect(x + 2, by + 12, 8, 1.2); }
    c.fillStyle = '#d9c9a8'; c.fillRect(x0, by + 14, x1 - x0, 5); c.fillRect(x0, yf - 6, x1 - x0, 6);
    c.fillStyle = 'rgba(120,96,70,.4)'; c.fillRect(x0, by + 19, x1 - x0, 1); c.fillRect(x0, yf - 6, x1 - x0, 1);
    c.fillStyle = '#7a5040'; c.fillRect(x0, yf - 14, x1 - x0, 8); c.fillStyle = 'rgba(30,14,8,.25)'; for (let x = Math.floor(x0/24)*24; x < x1; x += 24) c.fillRect(x, yf - 14, 1, 8);
    for (let i = Math.floor(x0/WIN); i <= x1/WIN; i++){
      const x = i*WIN, kind = ((i % 3) + 3) % 3, wy = by + 28;
      if (((i % 4) + 4) % 4 === 3){
        // a loading door: big plank doors with a cross brace and iron hinges, a hoist beam above
        const dw = 70, dt = by + 30;
        c.fillStyle = '#c9b896'; c.fillRect(x - dw/2 - 6, dt - 6, dw + 12, 6);
        c.fillStyle = '#5e4630'; c.fillRect(x - dw/2, dt, dw, yf - 14 - dt);
        c.fillStyle = 'rgba(30,20,12,.35)'; for (let k = 1; k < 10; k++) c.fillRect(x - dw/2 + k*dw/10, dt, 1, yf - 14 - dt);
        c.strokeStyle = '#7a5a3c'; c.lineWidth = 3; for (const sx of [-1, 1]){ const a = x + sx*dw/4; c.strokeRect(a - dw/4 + 2, dt + 3, dw/2 - 4, yf - 20 - dt); c.beginPath(); c.moveTo(a - dw/4 + 3, dt + 4); c.lineTo(a + dw/4 - 3, yf - 18); c.stroke(); }
        c.fillStyle = '#2f2a26'; for (const hy of [dt + 10, yf - 28]){ c.fillRect(x - dw/2, hy, 12, 2.4); c.fillRect(x + dw/2 - 12, hy, 12, 2.4); }
        c.fillStyle = '#2f2a26'; c.fillRect(x - 2, dt - 16, 4, 10); c.fillRect(x - 2, dt - 16, 22, 3); c.strokeStyle = '#2f2a26'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x + 18, dt - 13); c.lineTo(x + 18, dt + 8); c.stroke(); c.beginPath(); c.arc(x + 18, dt + 10, 2, 0, Math.PI); c.stroke();
        continue;
      }
      // an arched brick lintel with a keystone over the window
      c.fillStyle = '#8a4430'; c.beginPath(); c.ellipse(x, wy - 2, ww/2 + 10, 14, 0, Math.PI, 0); c.lineTo(x + ww/2 + 10, wy + 2); c.lineTo(x - ww/2 - 10, wy + 2); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(40,16,8,.4)'; c.lineWidth = 0.8; for (let k = 1; k < 12; k++){ const a = Math.PI + k*Math.PI/12; c.beginPath(); c.moveTo(x + Math.cos(a)*(ww/2 + 2), wy - 2 + Math.sin(a)*7); c.lineTo(x + Math.cos(a)*(ww/2 + 10), wy - 2 + Math.sin(a)*14); c.stroke(); }
      c.fillStyle = '#d9c9a8'; c.beginPath(); c.moveTo(x - 5, wy - 17); c.lineTo(x + 5, wy - 17); c.lineTo(x + 3.5, wy - 4); c.lineTo(x - 3.5, wy - 4); c.closePath(); c.fill();
      c.fillStyle = '#e9dcc0'; rr(c, x - ww/2 - 5, wy - 5, ww + 10, wh + 10, 2); c.fill();
      c.drawImage(windowView(kind), x - ww/2, wy, ww, wh);
      c.fillStyle = '#e9dcc0'; c.fillRect(x - 1.5, wy, 3, wh); c.fillRect(x - ww/2, wy + wh/2 - 1.5, ww, 3);
      c.fillStyle = 'rgba(233,220,192,.7)'; for (const k of [-0.25, 0.25]) c.fillRect(x + k*ww - 0.6, wy, 1.2, wh);
      c.fillStyle = 'rgba(80,60,40,.35)'; c.fillRect(x - ww/2, wy, ww, 2);
      c.fillStyle = '#c9b896'; c.fillRect(x - ww/2 - 8, wy + wh + 4, ww + 16, 4); c.fillStyle = 'rgba(60,40,24,.3)'; c.fillRect(x - ww/2 - 8, wy + wh + 8, ww + 16, 1.5);
      // a lamp on every third pillar, a downpipe on the others
      const pX = x + WIN/2;
      if (((i % 3) + 3) % 3 === 1){ c.strokeStyle = '#2f2a26'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(pX, wy + 2); c.lineTo(pX, wy - 4); c.stroke(); c.fillStyle = '#3d3734'; rr(c, pX - 4, wy + 2, 8, 13, 2); c.fill(); c.fillStyle = 'rgba(255,214,140,.92)'; rr(c, pX - 2.6, wy + 4, 5.2, 9, 1.5); c.fill(); c.fillStyle = '#3d3734'; c.beginPath(); c.moveTo(pX - 5, wy + 2); c.lineTo(pX, wy - 2); c.lineTo(pX + 5, wy + 2); c.closePath(); c.fill(); }
      else if (((i % 3) + 3) % 3 === 2){ c.fillStyle = '#4f4a46'; c.fillRect(pX - 2, by + 2, 4, h - 16); c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(pX - 2, by + 2, 1.2, h - 16); c.fillStyle = '#3a3532'; for (let y = by + 24; y < yf; y += 26) c.fillRect(pX - 3, y, 6, 2); c.fillStyle = '#4f4a46'; c.beginPath(); c.moveTo(pX - 2, yf - 14); c.lineTo(pX + 6, yf - 8); c.lineTo(pX + 6, yf - 6); c.lineTo(pX - 2, yf - 10); c.closePath(); c.fill(); }
    }
  }
  function items(list, V){ list.push({ y: yf, f: c => front(c, V) }); }
  function under(){}
  return Object.assign(sc, { build(){}, update(){}, items, under });
}
function* storageRide(){
  const T = E.truck, tk = E.tinker, sc = E.scene;
  T.x = 300; board(T, tk); E.driver.hidden = true;
  const z = clamp(H.W/(150*3.4), 0.9, 2.2);
  followCam(T, -40, -96 + (H.H/z < 420 ? 20 : 0), z, true);
  T.v = 46;
  fadeTo(0, 1.2);
  yield 10.5; fadeTo(1, 3.2); yield 3.4;
}

// ═════════════════════════ main: the order of things, and the frame loop
const ORDER = ['factory', 'bank', 'storage'];
function setup(id){
  E.actors = []; E.parts = []; E.fx = []; E.jobs = [];
  E.scene = id === 'factory' ? makeFactory() : id === 'bank' ? makeBank() : makeStorage();
  makeTruck(0);
  E.tinker = rider(E.opts.robot | 0);
  E.driver = bot(H.DRIVER, 0, 0, { cfg: { lv: { speed: 4, carry: 0, study: 0 }, prio: [] }, sp: 54, hidden: true });
  const sc = E.scene;
  if (!sc.skipX){ const B = sc.B, x1 = sc.id === 'factory' ? sc.P.belt.x1 + 70 : B.x1 + 60; sc.skipX = x => x > B.x0 - 70 && x < x1; }
  sc.build();
  // let the floor run for a while first, so it's busy when we walk in (quietly)
  E.quiet = true; for (let i = 0; i < 160; i++) stepWorld(1/20); E.quiet = false;
}
function* main(o){
  const list = o.only ? [o.only] : ORDER;
  for (const id of list){
    setup(id);
    if (id === 'storage') yield* storageRide(); else yield* visit(E.scene);
  }
}
function sfx(...a){ if (!E.quiet) H.sfx(...a); }  // (quiet while a floor warms up)
function stepWorld(dt){
  E.t += dt;
  for (const k of E.jobs) stepCo(k, dt);
  E.jobs = E.jobs.filter(k => !k.done);
  for (const o of E.actors) if (o.st !== 'ride') updBot(o, dt);
  if (E.truck) updTruck(E.truck, dt);
  if (E.scene) E.scene.update(dt);
  for (const p of E.parts) if (p.k === 'fly' && p.t + dt >= p.life && p.onEnd && !p.ended){ p.ended = true; p.onEnd(); }
  updParts(dt);
}
function frame(dt){
  if (E.main) stepCo(E.main, dt);
  stepWorld(dt);
  updCam(dt);
  draw();
  if (E.main && E.main.done) finish();
}
function finish(){
  if (!E.on) return;
  E.on = false; E.main = null; E.jobs = []; E.actors = []; E.parts = []; E.fx = [];
  const b = document.getElementById('endSkip'); if (b) b.hidden = true;
  if (E.opts && E.opts.onDone) E.opts.onDone();
}

// ── drawing a frame
function drawPart(c, p){
  const a = clamp(1 - p.t/p.life, 0, 1);
  if (p.k === 'fly'){
    const t = clamp(p.t/p.dur, 0, 1), e = t*t*(3 - 2*t), x = lerp(p.x0, p.x1, e), y = lerp(p.y0, p.y1, e) - Math.sin(t*Math.PI)*p.arc;
    if (p.kind === 'cash') itemCash(c, x, y + 3, 0.9, Math.sin(t*7)*0.5);
    else if (p.kind === 'bag') H.drawLeafBag(c, x, y + 8, 12, 3);
    else if (p.kind === 'leaf') H.drawLeaf(c, x, y, p.s || 5, p.rot + t*(p.spin || 6), p.ci || 0, 0, 1, 1, 1, 0);
    else if (p.kind === 'shred'){ c.fillStyle = p.col || '#c0432a'; c.save(); c.translate(x, y); c.rotate(p.rot + t*9); if (p.big) c.fillRect(-2.4, -1.2, 4.8, 2.4); else c.fillRect(-1.6, -0.8, 3.2, 1.6); c.restore(); }
  } else if (p.k === 'spark'){ c.fillStyle = p.col || '#ffd27a'; c.globalAlpha = a; c.fillRect(p.x - 1, p.y - 1, 2.2, 2.2); c.globalAlpha = 1; }
  else if (p.k === 'puff'){ c.globalAlpha = a*0.7; c.fillStyle = p.col || 'rgba(200,196,190,1)'; ell(c, p.x, p.y, p.r*(1.4 - a*0.4), p.r*(1.4 - a*0.4)); c.fill(); c.globalAlpha = 1; }
  else if (p.k === 'drop'){ c.fillStyle = p.col; ell(c, p.x, p.y, 1.5, 1.8); c.fill(); }
}
function drawSay(c, f){
  const o = f.o, s = w2s(o.x, o.y - 66 - (o.hz || 0)), k = Math.min(1, f.t/0.15, (f.life - f.t)/0.3), z = clamp(E.cam.z, 0.8, 1.4);
  c.save(); c.translate(s.x, s.y - (1 - k)*6); c.globalAlpha = clamp(k, 0, 1); c.scale(z, z);
  c.font = '800 15px "Baloo 2", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = Math.max(22, c.measureText(f.text).width + 14);
  c.fillStyle = 'rgba(60,30,10,.25)'; rr(c, -w/2, -11, w, 22, 10); c.fill();
  c.fillStyle = '#f6ead4'; rr(c, -w/2, -13, w, 22, 10); c.fill();
  c.beginPath(); c.moveTo(-4, 8); c.lineTo(4, 8); c.lineTo(-2, 14); c.closePath(); c.fill();
  c.fillStyle = '#4a3226'; c.fillText(f.text, 0, -1.5);
  c.restore();
}
function draw(){
  const c = H.ctx, D = H.DPR, W = H.W, Hh = H.H, z = E.cam.z;
  c.setTransform(D, 0, 0, D, 0, 0); c.globalAlpha = 1; c.fillStyle = '#5f6d33'; c.fillRect(0, 0, W, Hh);
  c.setTransform(D*z, 0, 0, D*z, D*(W/2 - E.cam.x*z), D*(Hh/2 - E.cam.y*z));
  const V0 = view(), V = { x0: V0.x0 - 30, x1: V0.x1 + 30, y0: V0.y0 - 30, y1: V0.y1 + 30 };
  drawGround(c, V);
  const sc = E.scene;
  if (sc){
    sc.under(c, V);
    const list = [], after = [];
    scenery(V, list, sc.skipX);
    sc.items(list, V);
    for (const o of E.actors){
      if (o.hidden || o.st === 'ride') continue;
      const it = { y: o.y, f: () => { c.save(); c.globalAlpha = o.alpha; H.drawRobot(o); c.restore(); } };
      (o.y >= LANE - 26 ? after : list).push(it);
    }
    list.sort((a, b) => a.y - b.y);
    for (const it of list) it.f(c);
    const T = E.truck;
    if (T){
      H.drawTruckAt(T.x, T.riders.filter(o => o.st === 'ride'), { rot: T.rot, fill: T.leaves > 0 ? 0.25 + 0.75*T.leaves/(T.leaves0 || T.leaves) : 0 });
      // (V21.2: the bank's delivery rides in the back as the yard truck's own load: opts.fill)
      if (T.cash > 0){ const rnd = mulberry(7); for (let i = 0; i < Math.min(T.cash, 22); i++) itemCash(c, T.x - 10 + rnd()*72, LANE - 64 - Math.floor(i/7)*3.4 - rnd()*2, 0.95, rnd()*0.6 - 0.3); }
    }
    for (const it of after) it.f(c);
  }
  // (sparks and steam inside a building only show once you can see in)
  const SB = sc && sc.B, hid = SB && SB.reveal < 0.5 ? p => !p.out && p.x > SB.x0 && p.x < SB.x1 && p.y < SB.yf - 4 : null;
  for (const p of E.parts) if (!(hid && hid(p.k === 'fly' ? { x: p.x1, y: p.y1 } : p))) drawPart(c, p);
  c.setTransform(D, 0, 0, D, 0, 0);
  for (const f of E.fx) if (f.k === 'say') drawSay(c, f);
  // cinema bars, and the fade
  const bar = Math.round(Hh*0.06); c.fillStyle = '#120c08'; c.fillRect(0, 0, W, bar); c.fillRect(0, Hh - bar, W, bar);
  if (E.fade > 0.001){ c.fillStyle = 'rgba(18,12,8,' + clamp(E.fade, 0, 1) + ')'; c.fillRect(0, 0, W, Hh); }
}

// ── the API game.js uses
function skipButton(show){
  let b = document.getElementById('endSkip');
  if (!b){ b = document.createElement('button'); b.id = 'endSkip'; b.type = 'button'; b.textContent = 'Skip ›'; document.body.appendChild(b);
    b.addEventListener('click', e => { e.stopPropagation(); if (!E.on || E.skipping) return; E.skipping = true; fadeTo(1, 0.5); E.main = co((function*(){ yield 0.55; })()); }); }
  b.hidden = !show;
}
return {
  get on(){ return E.on; },
  // o: { robot (which robot rides along), only ('factory' | 'bank' | 'storage': just that scene), onDone }
  start(o){
    Object.assign(E, { on: true, t: 0, opts: o || {}, fade: 1, fadeTw: null, camTw: null, follow: null, skipping: false, scene: null });
    E.main = co(main(E.opts));
    skipButton(true);
  },
  frame(dt){ if (E.on) frame(dt); },
  // for tests: where it's got to, and fast-forwarding without drawing
  dbg(){ const sc = E.scene; return sc && sc.POTS ? { pots: sc.POTS.map(p => p.st + ':' + p.L.toFixed(2) + ':' + p.green.toFixed(2)), hold: sc.M.hold, set: sc.M.set, open: sc.open, bags: sc.M.shred.bags, busy: +sc.M.shred.busy.toFixed(1), spill: sc.M.spill.length, trips: sc.sweeper && sc.sweeper.trips, pours: sc.M.pours, g: sc.greeter && sc.greeter.st2 } : null; },
  state(){ const sc = E.scene; return { on: E.on, scene: sc && sc.id, t: +E.t.toFixed(2), fade: +E.fade.toFixed(2), cam: { x: Math.round(E.cam.x), y: Math.round(E.cam.y), z: +E.cam.z.toFixed(2) }, actors: E.actors.length, focus: sc ? sc.focus : null, reveal: sc && sc.B ? +sc.B.reveal.toFixed(2) : null, pot: sc && sc.POT ? sc.POT.st : null, truck: E.truck ? Math.round(E.truck.x) : null, tinker: E.tinker ? { x: Math.round(E.tinker.x), y: Math.round(E.tinker.y), st: E.tinker.st } : null }; },
  // V21 (tests and screenshots): put the camera somewhere for a moment, and keep it there (hold) until the next call
  peek(x, y, z, hold){ E.camTw = null; E.follow = null; Object.assign(E.cam, { x, y, z }); E.hold = !!hold; },
  ff(seconds){ E.quiet = true; for (let t = 0; t < seconds && E.on; t += 1/30){ if (E.main) stepCo(E.main, 1/30); stepWorld(1/30); updCam(1/30); if (E.main && E.main.done){ finish(); break; } } E.quiet = false; },
};
};
