// AutumNation: the Rainy hollow, the third lot (V14).
// Once the first yard has a beehive, a bigger yard, a mine and a well-trained Tinker (V28; was $1,000 in hand), the truck
// driver writes about a soggy hollow down the road. Tinker and a blower ride over in the back of the truck and start again
// here from $0 (V28; they used to bring the $1,000),
// keeping only their own upgrades and the robot tier unlocks (V27: the truck schedule, cleanup program and yard-wide upgrades start over).
//
// It rains here (all looks: rain, puddles that reflect what stands beside them, mist, warm lights; game.js draws those,
// LOT.rain), robot ants cut mushrooms instead of bees sipping flowers, and the metal side is wood: wood piles, saws and a
// log crib. V17 (LOT.fireStory): lightning sets the tree in the middle on fire; once the robots have worked out the fire
// the drying bench burns logs, the logs leave charcoal, and the coal opens a coal stand by the road (the ingot pallet's
// place) and a charcoal kiln in the top left corner (the smelting plant's place; it was a drying shed making dry bundles,
// with a wood umbrella to keep them dry on the way to the road: both gone).
// This started life as public/location3 (a test copy of the whole game); the art here comes from it, minus the test
// slider. The yard starts bigger than the first one's cottage plot and never grows (no For Sale sign).
//
// A lot file only describes what's different about a place (see lots/prairie.js). game.js calls LOTS.hollow(H) once at
// startup; nothing in here may touch H until one of these functions is actually called (by then H holds the game's
// helpers, and its live state as getters: H.S, H.ctx, H.R, ...). The art functions read those at the top:
// const { S, ctx: c, ... } = H.
(function(){
'use strict';
const LOTS = window.LOTS = window.LOTS || {};

LOTS.hollow = H => {
  // ── the land: one yard, between the first yard's cottage plot and its meadow in size, that doesn't grow. (The other
  // two sizes stay in AREAS for what lies beyond the fence; landForSale: false keeps the sign from going up.)
  const AREAS = [
    { w: 650,  h: 400,  name: 'Drizzly hollow', spawn: 1.9, cap: 130 },   // (V15: was 930 × 550; V17: a bit more falls, was 1.6 / 115; V21: 650 × 400, was 700 × 440)
    { w: 1280, h: 720,  name: 'Puddle meadow',  spawn: 2.8, cap: 220, cost: 3000 },
    { w: 2000, h: 1150, name: 'Misty woods',    spawn: 5.6, cap: 380, cost: 38000 },
  ];
  // piles of wet wood instead of metal veins: two in the yard (sawing works from the start), one far out in the woods
  const SPOTS = [
    { x: 150,  y: -150, land: 0, rich: 0.85 },
    { x: 50,   y: -258, land: 0, rich: 1 },
    { x: -860, y: -560, land: 2, rich: 1.2 },
  ];
  // V17: the charcoal kiln (this place's smelting plant, once the robots know coal) stands in the top left corner of the
  // yard, its work spots just above the puddle there (was the drying shed, at -170, -290)
  const PLANT = { x: -214, y: -346 };   // (V21: down and in with the smaller yard, was -228, -384)
  // V15: the road row, spread out across the (narrower) yard so the drying bench fits beside the bin
  // (V21: squeezed a little for the smaller yard; was -268 / -166 / -78 / 8 / 66 / 122 / 182 / 262)
  const ROW = { SHED: { x: -256, y: -22 }, SIGN: { x: -156, y: -8 }, BAGGER: { x: -72, y: -14 }, BIN: { x: 6, y: -12 },
    TUB: { x: 64, y: -12 }, PALLET: { x: 117, y: -12 }, CRATE: { x: 173, y: -12 }, HIVE: { x: 250, y: -20 } };
  // trees that have lost about half their leaves
  const TREES = [
    { x: -150, y: -660, r: 120, seed: 11 }, { x: 300, y: -580, r: 135, seed: 23 }, { x: 575, y: -255, r: 92, seed: 37 },
    { x: -770, y: -900, r: 190, seed: 41 }, { x: 800, y: -850, r: 185, seed: 53 }, { x: -60, y: -1000, r: 170, seed: 61 },
    { x: -1130, y: -330, r: 190, seed: 71 }, { x: 1140, y: -1060, r: 200, seed: 83 }, { x: -560, y: -1320, r: 190, seed: 97 },
    { x: 560, y: -1335, r: 180, seed: 101 }, { x: 1150, y: -420, r: 170, seed: 113 }, { x: -1180, y: -1060, r: 190, seed: 127 },
    // three little trees in the yard
    { x: -40, y: -262, r: 62, seed: 131, fam: ['rust','gold'] }, { x: -256, y: -208, r: 52, seed: 137, fam: ['red','olive'] },
    { x: 228, y: -296, r: 50, seed: 139, fam: ['gold','orange'] },
    // one just outside the fence on the left
    { x: -560, y: -250, r: 105, seed: 149 },
    // (index 12 above, the one in the middle, is the tree the lightning hits: fireTree)
    // V15: pines, dark and wet, the wind blowing needles off them (game.js: no leaves from these, only needles for looks).
    // Two in the yard, the rest round the edge
    { x: 296, y: -205, r: 58, seed: 151, pine: true }, { x: 112, y: -398, r: 54, seed: 157, pine: true },
    { x: 610, y: -380, r: 96, seed: 163, pine: true }, { x: -640, y: -470, r: 104, seed: 167, pine: true }, { x: 130, y: -690, r: 92, seed: 173, pine: true },
    { x: -330, y: -760, r: 110, seed: 179, pine: true },
    // V17: two more at the top edge of the yard, their trunks just inside the fence, for the shakers
    { x: 284, y: -434, r: 62, seed: 191, fam: ['red','orange'] }, { x: -62, y: -460, r: 68, seed: 193, fam: ['gold','rust'] },   // (V21: 40 lower with the fence)
  ];
  const BUSHES = [ { x: -312, y: -166, s: 1.0, seed: 7 }, { x: 40, y: -350, s: 0.95, seed: 19 } ];   // (V17: the left one moved down, out of the kiln's way)
  // puddles: their muddy beds are painted into the ground; game.js draws the water live (reflections, rings, wakes)
  const PUDDLES = [
    // the first plot
    { x: -70,  y: -118, rx: 58, ry: 19 }, { x: 64, y: -94, rx: 38, ry: 13 }, { x: -195, y: -152, rx: 46, ry: 15 }, { x: 172, y: -238, rx: 40, ry: 14 },
    { x: 246, y: -108, rx: 34, ry: 12 }, { x: -40, y: -350, rx: 42, ry: 14 },
    // the meadow
    { x: -262, y: -282, rx: 58, ry: 19 },   // (V21: was -278, -314, 70 × 22: lower again, below the kiln that moved down)   // (V17: a little lower, so the kiln's robots stand just above it) { x: 290, y: -400, rx: 66, ry: 21 }, { x: -20, y: -472, rx: 62, ry: 20 }, { x: -385, y: -178, rx: 54, ry: 17 },
    { x: 520,  y: -565, rx: 52, ry: 17 }, { x: -470, y: -418, rx: 70, ry: 21 }, { x: -560, y: -110, rx: 50, ry: 16 }, { x: 455, y: -125, rx: 56, ry: 18 },
    { x: 120,  y: -640, rx: 58, ry: 18 }, { x: 560, y: -690, rx: 46, ry: 15 }, { x: -430, y: -295, rx: 40, ry: 13 }, { x: 590, y: -470, rx: 36, ry: 12 },
    // the misty woods
    { x: -700, y: -665, rx: 72, ry: 23 }, { x: 700, y: -650, rx: 90, ry: 28 }, { x: 200, y: -860, rx: 72, ry: 23 }, { x: -300, y: -960, rx: 66, ry: 21 }, { x: 850, y: -250, rx: 64, ry: 20 },
    { x: -440, y: -1110, rx: 60, ry: 19 }, { x: 430, y: -1060, rx: 66, ry: 21 }, { x: -20, y: -770, rx: 54, ry: 17 }, { x: -930, y: -300, rx: 58, ry: 18 }, { x: 930, y: -480, rx: 56, ry: 18 },
    // on the road, where the truck drives through
    { x: -300, y: 50, rx: 86, ry: 13, road: true }, { x: 330, y: 64, rx: 70, ry: 11, road: true }, { x: -60, y: 70, rx: 62, ry: 10, road: true },
    // a few out in the wild, beyond the fence
    { x: -720, y: -140, rx: 60, ry: 18 }, { x: 760, y: -110, rx: 52, ry: 17 }, { x: 1180, y: -700, rx: 78, ry: 24 }, { x: -1200, y: -720, rx: 72, ry: 23 }, { x: 1185, y: -180, rx: 60, ry: 19 }, { x: -1000, y: -1190, rx: 66, ry: 21 },
  ].map((p, i) => Object.assign(p, { seed: 301 + i*7 }));
  // wet autumn leaves, a little darker and glossier than in the first yard (deep reds, rust, burnt orange, ochre, a few
  // still green-gold and a lot of brown)
  const LEAFC = [
    { c:'#a8321f', v:'#6a1d12', w:.17 },
    { c:'#c24a22', v:'#7a2a12', w:.15 },
    { c:'#d06a24', v:'#874015', w:.2 },
    { c:'#d6922e', v:'#946016', w:.13 },
    { c:'#8c8f38', v:'#545a20', w:.1, sp:true },
    { c:'#8f5428', v:'#58311a', w:.17 },
    { c:'#6e3f22', v:'#432414', w:.08 },
  ];
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

  // ── the ground: soaked brown earth in two layers (G.g: flat earth with the puddles' beds, under the water; G.gTop:
  // everything standing up out of it, drawn over the water)
  function* paintGround(G){
    const { LANE, ROAD, TAU, VERGE, cellRnd, drawDecoFlowers, drawLeaf, ell, lerp, mulberry, puddleAt, puddleTrace, rr, shade } = H;
    let g = G.g; const gBase = G.g, gTop = G.gTop, { V, O, CS, i0, i1, j0, j1, inOwned } = G;
    const gr = g.createLinearGradient(0, V.y0, 0, 0);
    gr.addColorStop(0, '#463a29'); gr.addColorStop(0.6, '#54452f'); gr.addColorStop(1, '#5c4c33');
    g.fillStyle = gr; g.fillRect(V.x0, V.y0, V.x1 - V.x0, -V.y0 + 2);
    const glow = (x, y, r, col, a) => { const rg = g.createRadialGradient(x,y,0,x,y,r); rg.addColorStop(0, col + a); rg.addColorStop(1, col + '00'); g.fillStyle = rg; g.fillRect(x-r,y-r,r*2,r*2); };
    // big soft patches: darker mud, olive-brown earth and the odd tired green
    const patch = ['#3a2f21', '#62523a', '#4e5a2e', '#6b5838', '#433726', '#56602f', '#705d3c'];
    for (let i=i0;i<i1;i++) for (let j=j0;j<j1;j++){ yield;
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
    for (let i=i0;i<i1;i++) for (let j=j0;j<j1;j++){ yield;
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
    // wild land beyond the fence: darker and overgrown
    g.save();
    g.beginPath(); g.rect(V.x0, V.y0, V.x1 - V.x0, -VERGE - V.y0); g.rect(O.x0, O.y0, O.x1 - O.x0, O.y1 - O.y0);
    g.fillStyle = 'rgba(22,18,10,.26)'; g.fill('evenodd');
    g.restore();
    g = gTop;
    drawDecoFlowers(g, V);
    SPOTS.forEach((p, i) => drawRockBed(g, p.x, p.y, 100 + i));
    for (let i=i0;i<i1;i++) for (let j=j0;j<j1;j++){ yield;
      const rnd = cellRnd(i, j, 3);
      // dead bracken: rust-brown fern fronds
      for (let k=0;k<4;k++){
        const x = (i + rnd())*CS, y = (j + rnd())*CS, s = 0.8 + rnd()*0.6, col = ['#8a4a22', '#9c5a28', '#6e3c1c', '#7a6a30'][Math.floor(rnd()*4)];
        if (y > -VERGE - 8 || inOwned(x, y, 16) || puddleAt(x, y, 14)) continue;
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
        if (y > -VERGE - 6 || inOwned(x, y, 14) || puddleAt(x + 4, y, 10)) continue;
        for (let m=0;m<7;m++){ const a = -Math.PI/2 + (m - 3)*0.22 + 0.25, h = 13 + (m%3)*4; g.strokeStyle = dry ? (m%2 ? '#8f8050' : '#74683e') : (m%2 ? '#5d6a30' : '#4a5626'); g.lineWidth = 1.2; g.beginPath(); g.moveTo(x + m*1.3, y); g.quadraticCurveTo(x + m*1.3 + Math.cos(a)*7, y - 8, x + m*1.3 + Math.cos(a)*16, y - h + 3); g.stroke(); }
      }
      // a fairy ring of little mushrooms now and then
      if (rnd() < 0.16){
        const cx = (i + rnd())*CS, cy = (j + rnd())*CS, R0 = 14 + rnd()*14, n = 9 + Math.floor(rnd()*6), ty = Math.floor(rnd()*MUSH_DECO.length);
        if (!(cy > -VERGE - 30 || inOwned(cx, cy, R0 + 20) || puddleAt(cx, cy, R0 + 10))) for (let m=0;m<n;m++){ const a = m/n*TAU + rnd()*0.3; drawTinyMush(g, cx + Math.cos(a)*R0, cy + Math.sin(a)*R0*0.5, 0.8 + rnd()*0.4, MUSH_DECO[ty]); }
      }
      // a fallen log, mossy, with shelf fungus
      if (rnd() < 0.12){
        const x = (i + rnd())*CS, y = (j + rnd())*CS;
        if (!(y > -VERGE - 24 || inOwned(x, y, 50) || puddleAt(x, y, 40))) drawFallenLog(g, x, y, 0.8 + rnd()*0.5, rnd);
      }
      if (rnd() < 0.42){
        const x = (i + rnd())*CS, y = (j + rnd())*CS;
        if (!(y > -VERGE - 20 || inOwned(x, y, 30) || puddleAt(x, y, 24))) drawBush(g, x, y, 0.85 + rnd()*0.5, cellRnd(i, j, 6));
      }
    }
    drawFence(g, O);
    g = gBase;
    // the verge: wet dark gravel with a fringe of tired grass and a few leaves
    const vy = -VERGE;
    g.fillStyle = '#7c7262'; g.fillRect(V.x0, vy, V.x1 - V.x0, VERGE);
    const vg = g.createLinearGradient(0, vy - 6, 0, vy + 7); vg.addColorStop(0, 'rgba(70,62,38,1)'); vg.addColorStop(1, 'rgba(70,62,38,0)'); g.fillStyle = vg; g.fillRect(V.x0, vy - 6, V.x1 - V.x0, 13);
    for (let i=i0;i<i1;i++){ yield;
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
    for (let i=i0;i<i1;i++){ yield;
      const rnd = cellRnd(i, 1, 5);
      for (let k=0;k<70;k++){ const x = (i + rnd())*CS, y = 9 + rnd()*(ROAD + 10), light = rnd() < .5; g.fillStyle = light ? 'rgba(220,230,240,.05)' : 'rgba(0,0,0,.1)'; g.fillRect(x, y, 1.6, 1.6); }
      // long soft streaks where the sky shows in the wet road
      for (let k=0;k<5;k++){ const x = (i + rnd())*CS, y = 12 + rnd()*(ROAD - 8), w = 20 + rnd()*60; g.fillStyle = 'rgba(170,185,200,' + (0.04 + rnd()*0.05) + ')'; rr(g, x, y, w, 1.2 + rnd()*2.2, 1); g.fill(); }
      for (let k=0;k<4;k++){ const x = (i + rnd())*CS, y = 14 + rnd()*(ROAD - 18), rot = rnd()*TAU, ci = Math.floor(rnd()*LEAFC.length); g.globalAlpha = .6; drawLeaf(g, x, y, 5, rot, ci, 1, 1, .7, 1, .35); g.globalAlpha = 1; }
    }
    g.fillStyle = 'rgba(220,208,170,.62)';
    for (let x = Math.floor(V.x0/54)*54; x < V.x1; x += 54){ rr(g, x, LANE + 18, 28, 3.2, 1.5); g.fill(); g.fillStyle = 'rgba(240,240,235,.18)'; g.fillRect(x + 2, LANE + 18.4, 24, 0.8); g.fillStyle = 'rgba(220,208,170,.62)'; }
  }

  const BUSH_FAMS = () => { const { FOLIAGE } = H; return [FOLIAGE.rust, FOLIAGE.red, FOLIAGE.gold, FOLIAGE.olive, FOLIAGE.orange]; };
  function drawBush(g, x, y, s, rnd, noAutumn){
    const { TAU, ell, leafBlob, lerp } = H;
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

  function drawFence(g, O){
    const { ell, lerp, mulberry, rr } = H;
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

  function drawRockBed(g, x, y, seed){
    const { TAU, ell, mulberry } = H;
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

  function drawWetLog(g, x, y, L, r, a, rnd){
    const { ell, rr } = H;
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

  function drawFallenLog(g, x, y, s, rnd){
    g.save(); g.translate(x, y); g.scale(s, s);
    drawWetLog(g, 0, 0, 70, 9, (rnd() - 0.5)*0.5, rnd);
    for (let k=0;k<4;k++){ const fx = -24 + k*13 + rnd()*5; g.fillStyle = '#c99a5a'; g.beginPath(); g.ellipse(fx, -6, 5, 2.4, 0, Math.PI, 0); g.fill(); g.fillStyle = '#e6c58a'; g.fillRect(fx - 5, -6.4, 10, 0.9); g.fillStyle = '#8a6438'; g.beginPath(); g.ellipse(fx, -6, 3, 1.2, 0, Math.PI, 0); g.fill(); }
    g.restore();
  }

  // ── tree crowns: late autumn, half bare
  // V15: a pine: a straight dark trunk and tiers of drooping, wet, dark green branches, narrower toward the spire
  function paintPine(g, t, P){
    const { TAU, clamp, ell, lerp, mulberry } = H;
    const { R0, rnd, ox, oy, w } = P, base = R0*1.16, top = -R0*1.02, tw = Math.max(4.5, R0*0.075);
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.fillStyle = 'rgba(20,14,8,.42)'; ell(g, tw*0.6, base + 2, R0*0.42, tw*1.1); g.fill();
    // needles on the ground under it
    for (let k=0;k<40;k++){ const a = rnd()*TAU, d = Math.sqrt(rnd())*R0*0.5, x = Math.cos(a)*d, y = base + Math.sin(a)*d*0.25; g.strokeStyle = ['#7a4a26', '#8f5a2c', '#6a3e20'][k % 3]; g.lineWidth = 0.6; g.beginPath(); g.moveTo(x - 1.6, y); g.lineTo(x + 1.6, y + (rnd() - 0.5)*1.4); g.stroke(); }
    const tg = g.createLinearGradient(-tw, 0, tw, 0); tg.addColorStop(0, '#4a3828'); tg.addColorStop(0.5, '#33261c'); tg.addColorStop(1, '#1e1610');
    g.fillStyle = tg; g.beginPath(); g.moveTo(-tw*0.35, top + R0*0.3); g.lineTo(-tw, base - tw); g.quadraticCurveTo(-tw*1.3, base, -tw*2, base + 1); g.lineTo(tw*2.2, base + 1); g.quadraticCurveTo(tw*1.3, base, tw, base - tw); g.lineTo(tw*0.35, top + R0*0.3); g.closePath(); g.fill();
    // the tiers, bottom first: each a drooping skirt of branches, dark inside, its edge and hem made of little fans of
    // needles (lighter on the top left, where the grey light comes from), so the outline is ragged, not a zigzag
    const N = 7 + Math.floor(rnd()*3), cols = ['#17291e', '#1f3426', '#29412f', '#34503a', '#456548', '#5b7a56'];
    const spray = (x, y, a, L, col) => { g.strokeStyle = col; g.lineWidth = 0.5; g.beginPath(); for (let q=-3;q<=3;q++){ const b = a + q*0.13; g.moveTo(x, y); g.lineTo(x + Math.cos(b)*L*(1 - Math.abs(q)*0.08), y + Math.sin(b)*L*(1 - Math.abs(q)*0.08)); } g.stroke(); };
    for (let i=0;i<N;i++){
      const u = i/(N - 1), yb = lerp(base - R0*0.36, top + R0*0.3, u), hw = R0*(0.66*(1 - u) + 0.1)*(0.9 + rnd()*0.2), hh = R0*(0.36 - 0.1*u), lean = (rnd() - 0.5)*R0*0.05;
      const lx = -hw*(0.94 + rnd()*0.1), rx = hw*(0.94 + rnd()*0.1);
      const skirt = () => { g.beginPath(); g.moveTo(lx, yb + hh*0.1); g.quadraticCurveTo(-hw*0.45, yb - hh*0.5, lean, yb - hh); g.quadraticCurveTo(hw*0.45, yb - hh*0.5, rx, yb + hh*0.1); g.quadraticCurveTo(0, yb + hh*0.32, lx, yb + hh*0.1); g.closePath(); };
      g.fillStyle = 'rgba(8,12,8,.3)'; g.save(); g.translate(1.5, 3); skirt(); g.fill(); g.restore();
      skirt(); g.fillStyle = cols[1]; g.fill();
      // fans of needles over the skirt, hanging off its edge and hem
      const nS = Math.round(hw*1.3 + 8);
      for (let k=0;k<nS;k++){
        const e = rnd(), side = e*2 - 1, edge = rnd() < 0.55;
        let x, y;
        if (edge){ x = lerp(lx, rx, e); y = yb + hh*0.1 + Math.sin(e*Math.PI)*hh*0.22 - rnd()*hh*0.25; }
        else { x = side*hw*0.85*rnd(); y = yb - hh*(0.15 + rnd()*0.7)*(1 - Math.abs(x)/hw*0.6); }
        const lit = clamp(0.55 - x/hw*0.3 - (edge ? 0.15 : 0) + (rnd() - 0.5)*0.45, 0, 0.99);
        spray(x, y, Math.PI*0.5 + side*0.75 + (rnd() - 0.5)*0.4, 5 + rnd()*4.5, cols[1 + Math.floor(lit*(cols.length - 1))]);
      }
      // the top of each tier catches a little light
      g.strokeStyle = 'rgba(150,175,150,.22)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-hw*0.5, yb - hh*0.62); g.quadraticCurveTo(-hw*0.2, yb - hh*0.95, lean, yb - hh); g.stroke();
      // raindrops hanging from the hem
      for (let q=0;q<3;q++) if (rnd() < 0.6){ g.fillStyle = 'rgba(200,218,232,.55)'; ell(g, (rnd()*2 - 1)*hw*0.9, yb + hh*0.22, 0.6, 0.9); g.fill(); }
    }
    // the spire
    g.fillStyle = cols[3]; g.beginPath(); g.moveTo(-R0*0.06, top + R0*0.32); g.quadraticCurveTo(0, top + R0*0.05, R0*0.01, top - R0*0.02); g.quadraticCurveTo(R0*0.02, top + R0*0.05, R0*0.07, top + R0*0.32); g.closePath(); g.fill();
    // grey light from above
    g.globalCompositeOperation = 'source-atop';
    const sky = g.createLinearGradient(0, top, 0, base); sky.addColorStop(0, 'rgba(220,230,238,.14)'); sky.addColorStop(0.6, 'rgba(160,170,180,0)'); sky.addColorStop(1, 'rgba(15,20,28,.28)');
    g.fillStyle = sky; g.fillRect(-ox, -oy, w, base + oy + 4);
    g.globalCompositeOperation = 'source-over';
    return base;
  }
  function paintCanopy(g, t, ti, P){
    if (t.pine) return paintPine(g, t, P);
    const { TAU, clamp, ell, leafBlob, lerp, scallop } = H;
    const { R0, ox, oy, w, rnd } = P;
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
    // (V17.1: each twig remembers the one it grows from, p, and where along it, u, so the fire can spread along them)
    const branch = (x0, y0, a, L, wd, d, p, pu) => {
      let x1 = x0 + Math.cos(a)*L, y1 = y0 + Math.sin(a)*L*fy;
      for (let q=0; q<4 && !inCrown(x1, y1); q++){ L *= 0.8; x1 = x0 + Math.cos(a)*L; y1 = y0 + Math.sin(a)*L*fy; }
      const bend = (rnd() - 0.5)*0.6, cx = (x0 + x1)/2 + Math.cos(a + Math.PI/2)*L*bend*0.25, cy = (y0 + y1)/2 + Math.sin(a + Math.PI/2)*L*bend*0.25 - L*0.06;
      const me = twigs.length;
      twigs.push({ x0, y0, cx, cy, x1, y1, wd, d, p: p == null ? 0 : p, u: pu == null ? 1 : pu });
      if (d < 4){
        const n = d === 0 ? 2 + (rnd() < 0.5 ? 1 : 0) : 2;
        for (let k=0;k<n;k++){
          const u = d === 0 ? 0.55 + rnd()*0.4 : 0.6 + rnd()*0.4, spread = d < 2 ? 0.5 : 0.62;
          branch(lerp(x0, x1, u), lerp(y0, y1, u), a + (k - (n - 1)/2)*spread*2/n*1.4 + (rnd() - 0.5)*0.3 - (a + Math.PI/2)*0.08, L*(0.58 + rnd()*0.16), wd*0.6, d + 1, me, u);
        }
      }
      if (d >= 2) tips.push({ x: x1, y: y1, d });
    };
    // the trunk carries on up the middle as a leader, and limbs leave it at different heights, alternating sides:
    // the low ones reach out wide, the high ones more upward
    const ty0 = R0*0.34, lead = -R0*0.42, lw = (rnd() - 0.5)*R0*0.08;
    twigs.push({ x0: 0, y0: ty0 + R0*0.1, cx: lw, cy: (ty0 + lead)/2, x1: lw*0.6, y1: lead, wd: tw*0.75, d: 0, p: -1, u: 0 });
    branch(lw*0.6, lead, -Math.PI/2 + (rnd() - 0.5)*0.2, R0*0.32, tw*0.45, 1, 0, 1);
    const limbs = 5 + Math.floor(rnd()*3), side0 = rnd() < 0.5 ? -1 : 1;
    for (let k=0;k<limbs;k++){
      const u = k/(limbs - 1), side = (k % 2 ? -side0 : side0), y0 = lerp(ty0, lead*0.75, u) + (rnd() - 0.5)*R0*0.05;
      const up = 0.12 + 0.5*u + (rnd() - 0.5)*0.12, a = side < 0 ? -Math.PI + up*Math.PI*0.62 : -up*Math.PI*0.62;
      branch(lw*(1 - (ty0 - y0)/(ty0 - lead)) * 0.6, y0, a, R0*(0.62 - 0.26*u + rnd()*0.08), tw*(0.62 - 0.22*u), 1, 0, clamp((y0 - (ty0 + R0*0.1))/(lead - ty0 - R0*0.1), 0, 1));
    }
    P.twigs = twigs; P.trunk = { tw, base, top: ty0 + R0*0.1 };
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
    return base;
  }

  // ── a cool grey wash, misty light from the top and dark, blue-grey corners (screen space)
  function paintVignette(g, W, Hh){
    g.fillStyle = 'rgba(52,68,92,.13)'; g.fillRect(0, 0, W, Hh);
    const rg = g.createRadialGradient(W*0.5, Hh*0.5, Math.min(W,Hh)*0.3, W*0.5, Hh*0.5, Math.hypot(W,Hh)*0.62);
    rg.addColorStop(0, 'rgba(18,24,36,0)'); rg.addColorStop(1, 'rgba(16,22,34,.46)');
    g.fillStyle = rg; g.fillRect(0, 0, W, Hh);
    const top = g.createLinearGradient(0, 0, 0, Hh*0.45);
    top.addColorStop(0, 'rgba(196,206,218,.22)'); top.addColorStop(1, 'rgba(196,206,218,0)');
    g.fillStyle = top; g.fillRect(0, 0, W, Hh);
  }

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

  function drawMush(g, x, y, s, M, lean){
    const { TAU, ell, rr } = H;
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
    const { ell } = H;
    g.fillStyle = 'rgba(20,12,6,.3)'; ell(g, x + 0.8*s, y + 0.4*s, (M.w*0.55 + 0.6)*s, 1.1*s); g.fill();
    drawMush(g, x, y, s, M, 0);
  }

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

  function flowerSprite(T, ti){
    const { TAU, ell, leafBlob, mulberry } = H;
    const RES = 3;
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
  }

  function drawFlower(c, f, sp, b, wild){
    const wob = f.bob > 0 ? Math.sin(f.bob*30)*0.06 : 0;
    c.save(); c.translate(f.x, f.y); c.scale(f.s, f.s);
    if (wild) c.globalAlpha = 0.72;
    else if (H.gl('clover')) mossUnder(c, f, H.gl('clover'));   // V37: Mossy mulch
    c.drawImage(sp.stem, -sp.sox, -sp.soy, sp.sw, sp.sh);
    if (b > 0.02){
      const k = 0.3 + 0.7*b;
      c.rotate(wob); c.globalAlpha *= Math.min(1, 0.4 + b*1.2);
      c.drawImage(sp.head, -sp.hw/2*k, -(sp.hh - 2)*k, sp.hw*k, sp.hh*k);
    }
    c.restore();
  }
  // V37: the hollow's own yard-wide upgrades show in the yard too. Mossy mulch: a cushion of moss under every mushroom on
  // your land (bigger and with bits of bark at the second step). Leaf mould deal: a slatted compost bay left of the
  // drying bench, its heap of leaf mould growing with each step and steaming a little. Spore scattering: an open sack of
  // spores by the ant hill, a puff of pale spores rising from it now and then.
  function mossUnder(c, f, L){
    const { ell } = H, k = L >= 2 ? 1.25 : 1, sd = Math.abs(Math.round(f.x*7 + f.y*13));
    c.fillStyle = 'rgba(20,28,10,.35)'; ell(c, 0.4, 0.9, 6.6*k, 2.3*k); c.fill();
    c.fillStyle = '#3f5a26'; ell(c, 0, 0.5, 6.2*k, 2.1*k); c.fill();
    c.fillStyle = '#5f7f32';
    for (let i=0;i<5;i++){ const a = (sd % 97)*0.3 + i*1.31, r = (0.35 + ((sd >> i) % 5)*0.12)*5.2*k; ell(c, Math.cos(a)*r, 0.5 + Math.sin(a)*r*0.32, 1.1, 0.55); c.fill(); }
    if (L >= 2){ c.fillStyle = '#6a4a2e'; for (let i=0;i<3;i++){ const a = (sd % 53)*0.2 + i*2.1; c.fillRect(Math.cos(a)*6.4*k - 0.8, 0.5 + Math.sin(a)*2*k - 0.3, 1.6, 0.6); } }
  }
  function drawCompostBay(){
    const { S, ctx: c, ell, rr, gl, mulberry, reduceMotion, BAGGER } = H;
    const L = gl('press'); if (!L) return;
    c.save(); c.translate(BAGGER.x - 49, BAGGER.y + 6);
    c.fillStyle = 'rgba(20,14,8,.34)'; ell(c, 0, 0.8, 15, 2.6); c.fill();
    // back wall of slats
    c.fillStyle = '#4e3524'; rr(c, -12, -15, 24, 13, 1); c.fill();
    c.strokeStyle = '#3a2618'; c.lineWidth = 0.6; for (let y = -12.5; y < -2; y += 3){ c.beginPath(); c.moveTo(-11.5, y); c.lineTo(11.5, y); c.stroke(); }
    // the heap of leaf mould: dark, crumbly, a few leaves not yet rotted on top; bigger with every step
    const hh = 4 + L*2.6, rnd = mulberry(77);
    c.fillStyle = '#2e2117'; c.beginPath(); c.moveTo(-11, -2); c.quadraticCurveTo(-8, -2 - hh*1.2, 0, -2 - hh); c.quadraticCurveTo(8, -2 - hh*1.15, 11, -2); c.closePath(); c.fill();
    c.fillStyle = '#4a3423'; for (let i=0;i<9 + L*3;i++){ const x = (rnd() - 0.5)*18, top = -2 - hh*(1 - (x/12)*(x/12)); ell(c, x, top + rnd()*hh*0.8 + 0.6, 1 + rnd(), 0.6 + rnd()*0.4); c.fill(); }
    for (let i=0;i<2 + L;i++){ const x = (rnd() - 0.5)*14; H.stampLeaf(c, x, -2 - hh*(1 - (x/12)*(x/12)) + 0.8, 2.6, rnd()*6, Math.floor(rnd()*4), 0, 1, 0.7, 0.9); }
    // two corner posts and a low front board
    c.fillStyle = '#5e4028'; rr(c, -13, -17, 2.6, 17, 0.8); c.fill(); rr(c, 10.4, -17, 2.6, 17, 0.8); c.fill();
    c.fillStyle = '#7a5434'; rr(c, -12.5, -4.6, 25, 4.2, 0.8); c.fill();
    c.fillStyle = 'rgba(255,230,190,.14)'; c.fillRect(-12, -4.3, 24, 0.9);
    // a little steam from the warm heap
    if (!reduceMotion) for (let k=0;k<2;k++){
      const ph = (S.t*0.35 + k*0.5) % 1, a = Math.sin(ph*Math.PI)*0.28;
      c.strokeStyle = 'rgba(230,226,214,' + a.toFixed(3) + ')'; c.lineWidth = 1.2; c.lineCap = 'round';
      const x0 = -3 + k*6, y0 = -3 - hh - ph*10;
      c.beginPath(); c.moveTo(x0, y0 + 4); c.quadraticCurveTo(x0 + 2.4*Math.sin(S.t + k), y0 + 2, x0, y0); c.quadraticCurveTo(x0 - 2*Math.sin(S.t*1.3 + k), y0 - 2, x0 + 0.6, y0 - 4); c.stroke();
    }
    c.restore();
  }
  function drawSporeSack(){
    const { S, ctx: c, ell, rr, gl, reduceMotion, HIVE } = H;
    if (!gl('seeding')) return;
    c.save(); c.translate(HIVE.x + 52, HIVE.y + 12);
    c.fillStyle = 'rgba(20,14,8,.34)'; ell(c, 0, 0.8, 9, 2); c.fill();
    // a burlap sack, rolled open at the top, full of spore dust
    c.fillStyle = '#9c8458'; c.beginPath(); c.moveTo(-6.5, 0); c.quadraticCurveTo(-8.4, -7, -5.6, -12); c.lineTo(5.6, -12); c.quadraticCurveTo(8.4, -7, 6.5, 0); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(70,52,30,.4)'; c.lineWidth = 0.4; for (let x = -5; x <= 5; x += 1.6){ c.beginPath(); c.moveTo(x, -11.5); c.lineTo(x*1.1, -0.5); c.stroke(); }
    c.fillStyle = '#b39a6a'; rr(c, -6.4, -13.6, 12.8, 2.6, 1.2); c.fill();
    c.fillStyle = '#e6dcc4'; ell(c, 0, -13.4, 5.4, 1.4); c.fill();
    // a red mushroom stamped on the front
    c.fillStyle = '#efe3c4'; c.fillRect(-0.7, -6, 1.4, 3);
    c.fillStyle = '#b8452d'; c.beginPath(); c.moveTo(-3.2, -5.6); c.quadraticCurveTo(0, -10, 3.2, -5.6); c.closePath(); c.fill();
    c.fillStyle = '#efe3c4'; ell(c, -1.2, -7.2, 0.5, 0.4); c.fill(); ell(c, 1, -6.6, 0.45, 0.35); c.fill();
    // a puff of spores rises now and then
    if (!reduceMotion){
      const ph = (S.t*0.28) % 1;
      if (ph < 0.6){ const k = ph/0.6; for (let i=0;i<7;i++){ const a = (1 - k)*0.7; c.fillStyle = 'rgba(240,234,214,' + a.toFixed(3) + ')'; ell(c, Math.sin(i*2.1 + k*3)*(1.5 + k*5), -14 - k*(10 + i*1.6), 0.7 + k*0.5, 0.7 + k*0.5); c.fill(); } }
    }
    c.restore();
  }
  function genProps(list){
    const { S, gl, hiveGrounded, BAGGER, HIVE } = H;
    if (gl('press')) list.push({ y: BAGGER.y + 6, f: drawCompostBay });
    if (gl('seeding') && S.hive.built && !hiveGrounded()) list.push({ y: HIVE.y + 12, f: drawSporeSack });
  }
  const drawDeco = (g, f) => drawTinyMush(g, f.x, f.y, f.s, MUSH_DECO[f.ty]);
  const bloomOf = f => f.full ? 1 : H.clamp((f.t/f.regrow - 0.6)/0.4, 0, 1)*0.45;

  // V15: canned mushrooms (were punnets): a tin can with a cream label and a red mushroom on it
  function drawJar(c, x, y, s){
    const { ell, rr } = H;
    c.save(); c.translate(x, y); c.scale(s/6, s/6);
    c.fillStyle = 'rgba(20,12,6,.25)'; ell(c, 0.5, 4.9, 4.4, 1); c.fill();
    const g = c.createLinearGradient(-3.6, 0, 3.6, 0); g.addColorStop(0, '#e2e8ea'); g.addColorStop(0.35, '#b9c2c6'); g.addColorStop(1, '#7d878c');
    c.fillStyle = g; c.fillRect(-3.6, -4.2, 7.2, 8.6); ell(c, 0, 4.4, 3.6, 0.9); c.fill();
    c.fillStyle = '#efe3c4'; c.fillRect(-3.6, -2.4, 7.2, 4.6);
    c.fillStyle = 'rgba(120,80,40,.25)'; c.fillRect(1.6, -2.4, 2, 4.6);
    c.fillStyle = '#efe9dc'; c.fillRect(-0.45, 0, 0.9, 1.4);
    c.fillStyle = '#c4281c'; c.beginPath(); c.ellipse(0, 0.1, 1.9, 1.5, 0, Math.PI, 0); c.closePath(); c.fill();
    c.fillStyle = '#fbf6ea'; ell(c, -0.7, -0.6, 0.35, 0.3); c.fill(); ell(c, 0.6, -0.4, 0.3, 0.25); c.fill();
    c.fillStyle = '#9aa4aa'; ell(c, 0, -4.2, 3.6, 1); c.fill(); c.fillStyle = '#d6dde0'; ell(c, 0, -4.3, 3.1, 0.75); c.fill();
    c.strokeStyle = 'rgba(80,90,96,.5)'; c.lineWidth = 0.35; for (const yy of [-3.3, 3.2]){ c.beginPath(); c.moveTo(-3.6, yy); c.lineTo(3.6, yy); c.stroke(); }
    c.restore();
  }

  function drawHive(){
    const { B, HIVE, S, TAU, bubbles, clamp, ctx, ease, ell, hiveFloors, hiveRt, hiveShown, hiveTopZ, honeyCap, leafBlob, mulberry, parts, rand, rr, simMode, tankCap, tankFull, wind } = H;
    if (!hiveShown()) return;
    const c = ctx, HS = S.hive;
    c.save(); c.translate(HIVE.x, HIVE.y);
    c.fillStyle = 'rgba(20,14,8,.32)'; ell(c, 4, 4, 48, 11); c.fill();
    if (!HS.built){
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
    // V15: the ant hill sits on the old beehive's base: the hazard-striped plinth shows under the mound's overhang
    const LIFT = H.HV_LIFT, F = hiveFloors(), top = -(hiveTopZ() - LIFT), Wb = 36 + F*1.4, t = S.t;
    const grow = clamp((S.t - hiveRt.builtT)/1.3, 0, 1);
    if (grow < 1) c.scale(1, ease(grow));
    drawBeehiveBase(c);
    c.translate(0, -LIFT);
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
    const hf = clamp(HS.honey/honeyCap(), 0, 1)*F;
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
    // V15: a plank ramp from the ground up to the door, over the old beehive's plinth, and pine needles all over the mound
    c.fillStyle = '#7a5434'; c.beginPath(); c.moveTo(-3.6, -1); c.lineTo(3.6, -1); c.lineTo(5, LIFT + 6); c.lineTo(-5, LIFT + 6); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(40,25,14,.6)'; c.lineWidth = 0.5; for (let q=1;q<5;q++){ const yy = -1 + q*(LIFT + 7)/5; c.beginPath(); c.moveTo(-3.8 - q*0.3, yy); c.lineTo(3.8 + q*0.3, yy); c.stroke(); }
    needleCoat(c, Wb, top, 1, 170);
    // the larder: a glass jar on the left with the fresh mushrooms the ants bring in
    const lx = -Wb - 4, lb = -2, lt = Math.max(top*0.62, -40), nf = clamp(HS.nectar/tankCap(), 0, 1);
    c.fillStyle = '#4a423b'; rr(c, lx - 5.5, lt - 3.5, 11, 3, 1); c.fill(); rr(c, lx - 6, lb - 2, 12, 3, 1); c.fill();
    c.fillStyle = 'rgba(200,220,228,.32)'; rr(c, lx - 5, lt, 10, lb - lt - 1.5, 2); c.fill();
    if (nf > 0){ const nh = (lb - lt - 2.5)*nf, r3 = mulberry(5); c.save(); rr(c, lx - 4.4, lb - 1.8 - nh, 8.8, nh, 1.6); c.clip(); c.fillStyle = '#5e4028'; c.fillRect(lx - 5, lb - 2 - nh, 10, nh + 1); for (let k=0;k<Math.ceil(nh*0.9);k++){ c.fillStyle = ['#c4281c', '#e6a22a', '#c99448', '#f1ece2', '#9a7cb8'][Math.floor(r3()*5)]; ell(c, lx - 3.4 + r3()*6.8, lb - 2 - r3()*nh, 1.5, 1); c.fill(); } c.restore(); }
    c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(lx - 3.6, lt + 1.5, 1, lb - lt - 5);
    c.strokeStyle = 'rgba(60,70,74,.8)'; c.lineWidth = 0.8; rr(c, lx - 5, lt, 10, lb - lt - 1.5, 2); c.stroke();
    // the vent on top (spins faster with Faster sorting) and the antenna mast
    c.fillStyle = '#6a625a'; rr(c, -5, top - 4, 10, 6, 1.5); c.fill();
    c.fillStyle = '#3d3734'; ell(c, 0, top - 4, 5, 1.6); c.fill();
    c.save(); c.translate(0, top - 4.2); c.scale(1, 0.32); c.rotate(t*(HS.up.fan ? 7 : 3)); c.strokeStyle = '#c9a24a'; c.lineWidth = 1.6; for (let k=0;k<3;k++){ c.rotate(TAU/3); c.beginPath(); c.moveTo(0, 0); c.lineTo(4.4, 0); c.stroke(); } c.restore();
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
      if (HS.honey >= honeyCap() - 1e-6) bubbles.push({ x: HIVE.x, y: HIVE.y + top - 30, t: 'store full' });
      else if (tankFull() && B.some(b => b.st === 'queue')) bubbles.push({ x: HIVE.x, y: HIVE.y + top - 30, t: 'larder full' });
    }
  }

  // ── V15: the hive story. The ant hill stands on the old beehive's base (the plinth); while the robots research the
  // hive, an umbrella goes over it, the blower blows pine needles onto it and portholes go in (drawHiveLab), and the
  // bees of the show turn into ants (drawLabBee).
  function drawBeehiveBase(c){
    const { HV_BEE, drawPrism, prismFace, hexPath, ell } = H, pz = HV_BEE.plinth, k = HV_BEE.k;
    drawPrism(c, 27, k, 0, -pz, ['#625f57', '#55524b', '#423f3a', '#77746b']);
    for (const i of [0, 1, 2]){
      c.save(); prismFace(c, 27, k, i, -3, -pz + 3); c.clip();
      c.fillStyle = '#2f2a26'; c.fillRect(-28, -pz, 56, pz);
      c.fillStyle = '#e0b13a'; for (let x=-40; x<40; x+=6){ c.beginPath(); c.moveTo(x, 4); c.lineTo(x + 3, 4); c.lineTo(x + 3 + pz, -pz - 4); c.lineTo(x + pz, -pz - 4); c.closePath(); c.fill(); }
      c.restore();
    }
    hexPath(c, 0, -pz, 27, k); c.fillStyle = '#8a877e'; c.fill();
    // the stub of the steel tower, and the mound's shadow on it
    drawPrism(c, 21, k, -pz, -pz - 4, ['#b5bec2', '#97a1a6', '#6f797e', '#d3d9db']);
    c.fillStyle = 'rgba(20,14,8,.45)'; ell(c, 0, -pz + 2, 30, 6); c.fill();
  }
  // pine needles lying on a dome (the ant hill's mound, or the umbrella while it's being covered): n of them, all in place
  // at cover 1 (fewer before), seeded so they stay put
  function needleCoat(c, W, top, cover, n){
    const { mulberry, NEEDLE_COL } = H, rnd = mulberry(913), m = Math.floor(n*cover);
    c.lineCap = 'round';
    for (let i=0;i<n;i++){
      const u = rnd()*2 - 1, v = Math.pow(rnd(), 0.75), a = rnd()*Math.PI, col = NEEDLE_COL[Math.floor(rnd()*NEEDLE_COL.length)], L = 2.6 + rnd()*2.6, pair = rnd() < 0.45;
      if (i >= m) continue;
      const hg = -top*Math.pow(Math.max(0, 1 - u*u), 0.7), x = u*W*0.94, y = 1 - v*hg*0.97, dx = Math.cos(a)*L/2, dy = Math.sin(a)*L/2*0.6;
      c.strokeStyle = col; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x - dx, y - dy); c.lineTo(x + dx, y + dy); if (pair){ c.moveTo(x - dx, y - dy); c.lineTo(x + dx*0.7 + 1, y + dy*0.7 + 1.2); } c.stroke();
    }
  }
  const LABV = { umbT: null, win: [], doorT: null };
  function drawHiveLab(k, info){
    const { HIVE, S, TAU, clamp, ctx: c, ell, ease, rr, parts, rand, simMode, LAB_DOME, mulberry } = H;
    if (k < 0.03 && !LABV.umbT){ return; }
    const t = S.t;
    if (LABV.umbT == null) LABV.umbT = k > 0.05 ? -99 : t;
    if (!LABV.seen) setTimeout(() => { LABV.seen = true; }, 0);   // (portholes already in when the page loads don't pop in again)
    const drop = clamp((t - LABV.umbT)/0.8, 0, 1), dy = (1 - ease(drop))*-34 + (drop < 1 ? Math.sin(drop*Math.PI)*3 : 0);
    const cover = clamp((k - 0.08)/0.84, 0, 1), cv = cover*cover*(3 - 2*cover);
    const rim = -LAB_DOME.rim, h = LAB_DOME.h, W = LAB_DOME.w, apex = rim - h, N = 8, xs = [];
    for (let q=0;q<=N;q++) xs.push(-W + 2*W*q/N);
    const hemY = q => rim + Math.sin(q/N*Math.PI)*3.2;
    const dome = () => { c.beginPath(); c.moveTo(xs[0], hemY(0)); c.bezierCurveTo(-W, rim - h*0.72, -W*0.52, apex, 0, apex); c.bezierCurveTo(W*0.52, apex, W, rim - h*0.72, xs[N], hemY(N));
      for (let q=N;q>0;q--){ const mx = (xs[q] + xs[q - 1])/2, my = (hemY(q) + hemY(q - 1))/2 - 2.2; c.quadraticCurveTo(mx, my, xs[q - 1], hemY(q - 1)); } c.closePath(); };
    c.save(); c.translate(HIVE.x, HIVE.y + dy);
    // the shadowed underside under the hem, then the canopy: faded teal and cream panels
    c.fillStyle = 'rgba(15,12,10,.5)'; c.beginPath(); c.ellipse(0, rim + 1.5, W*0.97, 6.5, 0, 0, Math.PI); c.fill();
    dome(); c.fillStyle = '#e2d6bc'; c.fill();
    c.save(); dome(); c.clip();
    for (let q=0;q<N;q+=2){ c.beginPath(); c.moveTo(0, apex); c.quadraticCurveTo(xs[q]*0.86, apex + h*0.28, xs[q], hemY(q)); c.lineTo(xs[q + 1], hemY(q + 1)); c.quadraticCurveTo(xs[q + 1]*0.86, apex + h*0.28, 0, apex); c.closePath(); c.fillStyle = '#4f7c84'; c.fill(); }
    const sh = c.createLinearGradient(-W, apex, W*0.5, rim); sh.addColorStop(0, 'rgba(255,255,255,.25)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(10,12,20,.3)');
    c.fillStyle = sh; c.fillRect(-W, apex - 2, 2*W, h + 8);
    c.strokeStyle = '#3a3330'; c.lineWidth = 0.7; c.beginPath(); for (let q=1;q<N;q++){ c.moveTo(0, apex); c.quadraticCurveTo(xs[q]*0.86, apex + h*0.28, xs[q], hemY(q)); } c.stroke();
    // rain beads on the canopy (fewer once the needles cover it)
    const rb = mulberry(57); c.fillStyle = 'rgba(225,236,244,' + (0.55*(1 - cv)) + ')'; for (let q=0;q<26;q++){ const u = rb()*2 - 1, v = rb(); ell(c, u*W*0.8, rim - v*h*Math.sqrt(1 - u*u*0.8)*0.9, 0.7, 0.9); c.fill(); }
    // the needles: first a brown wash as they pile up, then the needles themselves
    if (cv > 0){
      const mg = c.createLinearGradient(-W*0.6, apex, W*0.5, rim); mg.addColorStop(0, '#7a5232'); mg.addColorStop(0.5, '#5e4028'); mg.addColorStop(1, '#3c2a1a');
      c.globalAlpha = clamp(cv*1.15 - 0.1, 0, 0.95); dome(); c.fillStyle = mg; c.fill(); c.globalAlpha = 1;
      c.save(); c.translate(0, rim); needleCoat(c, W, -h, cv, 300); c.restore();
    }
    c.restore();
    c.fillStyle = '#3a3330'; for (let q=0;q<=N;q++){ ell(c, xs[q], hemY(q), 0.8, 0.8); c.fill(); }
    // needles hanging off the hem
    if (cv > 0.2){ const rh = mulberry(31); c.strokeStyle = '#7a4a26'; c.lineWidth = 0.7; for (let q=0;q<Math.floor(24*cv);q++){ const x = (rh()*2 - 1)*W*0.95, y = rim + 1 + rh()*2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rh() - 0.5)*2, y + 2 + rh()*2); c.stroke(); } }
    // the finial on top (the beehive's antennas poke out above it)
    c.fillStyle = '#c9a24a'; ell(c, 0, apex - 1.5, 2.2, 2.2); c.fill();
    // portholes, one after another, the brass kind the ant hill has: a robot leans in and fits each one (game.js)
    const nw = info.wins | 0, LAB_WIN = H.LAB_WIN;
    for (let i=0;i<nw;i++){
      if (LABV.win[i] == null) LABV.win[i] = LABV.seen ? t : -99;
      const g = clamp((t - LABV.win[i])/0.4, 0, 1), s = g < 1 ? ease(g)*1.15 - Math.sin(g*Math.PI)*0.05 : 1, [wx, wy] = LAB_WIN[i], pr = 3.6*s;
      if (g < 1 && g > 0 && !simMode && Math.random() < 0.3) parts.push({ k:'star', x: HIVE.x + wx + rand(-3, 3), y: HIVE.y + wy + rand(-3, 3), vx: rand(-20, 20), vy: rand(-30, -10), g: 40, life: 0.5, t: 0 });
      c.fillStyle = '#21180f'; ell(c, wx, wy, pr, pr*0.9); c.fill();
      c.fillStyle = 'rgba(255,190,110,' + (0.22 + 0.06*Math.sin(t*2 + i)) + ')'; ell(c, wx, wy, pr - 1, pr*0.9 - 1); c.fill();
      c.fillStyle = 'rgba(220,235,240,.3)'; ell(c, wx - 1.2*s, wy - 1.2*s, 1*s, 0.7*s); c.fill();
      c.strokeStyle = '#c9a24a'; c.lineWidth = 1.1; ell(c, wx, wy, pr, pr*0.9); c.stroke();
    }
    // the door: a brass ring round the beehive's own door, under the hem; then the copper pipe and the vent
    if (k >= 0.9){
      if (LABV.doorT == null) LABV.doorT = k > 0.92 ? -99 : t;
      const g = clamp((t - LABV.doorT)/0.4, 0, 1);
      c.strokeStyle = '#c9a24a'; c.lineWidth = 1.8*g; c.beginPath(); c.ellipse(0, -12, 7.5*g, 7*g, 0, Math.PI, 0); c.stroke();
    }
    if (k >= 0.95){
      c.strokeStyle = '#8a4f2a'; c.lineWidth = 2.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(W*0.62, rim + 2); c.quadraticCurveTo(W*0.8, rim - h*0.45, W*0.3, apex + h*0.18); c.stroke();
      c.strokeStyle = '#c98a55'; c.lineWidth = 1; c.beginPath(); c.moveTo(W*0.6, rim + 1); c.quadraticCurveTo(W*0.77, rim - h*0.45, W*0.28, apex + h*0.18 - 0.5); c.stroke();
    }
    c.restore();
    if (!simMode && drop >= 1 && Math.random() < (info.blower ? 0.25 : 0.4)){
      const u = rand(-0.8, 0.8), x = HIVE.x + u*W, y = HIVE.y + apex + h*0.25*u*u + 4;
      parts.push({ k:'drop', x, y, vx: info.blower ? rand(-90, -50) : rand(-25, 25), vy: info.blower ? rand(-50, -25) : rand(-40, -15), g: 200, life: rand(.3, .5), t: 0 });
    }
  }
  // the bees and ants of the show: a bee under a tiny umbrella flying, tumbling, on its back, or walking; walking ones
  // turn into ants as the research goes on (b.m: 0 a bee, 1 an ant)
  const LAB_BROLLY = [['#c4502e', '#e2d6bc'], ['#4f7c84', '#e2d6bc'], ['#e2b33a', '#8a5a36'], ['#8a5aa0', '#e2d6bc']];
  function miniBrolly(c, x, y, R, cols){ drawBrolly(c, x, y, R, cols, '#3a3330'); c.strokeStyle = '#3a3330'; c.lineWidth = 0.45; c.beginPath(); c.moveTo(x, y - R*0.6); c.lineTo(x, y + R*0.9); c.stroke(); }
  function drawBeeAnt(c, ph, moving){
    // half bee, half ant: an ant's legs and waist, a bee's striped tail, little stub wings
    const { ell } = H;
    c.strokeStyle = '#3b3430'; c.lineWidth = 0.5; c.lineCap = 'round';
    for (let i=0;i<3;i++){ const q = ph + (i % 2 ? Math.PI : 0), s = moving ? Math.sin(q)*1.7 : 0, lift = moving ? Math.max(0, Math.cos(q))*1 : 0, x = -1.8 + i*1.6; c.beginPath(); c.moveTo(x, -2.4); c.lineTo(x + (i - 1)*0.4, -4 - lift); c.lineTo(x + s + (i - 1)*1.4, -lift); c.stroke(); }
    c.fillStyle = '#c9952e'; ell(c, -3.6, -3.6, 2.8, 2); c.fill();
    c.save(); ell(c, -3.6, -3.6, 2.8, 2); c.clip(); c.fillStyle = '#2e2b2a'; c.fillRect(-5, -6, 0.9, 5); c.fillRect(-3.2, -6, 0.9, 5); c.restore();
    c.fillStyle = 'rgba(214,232,240,.6)'; ell(c, -1.6, -6.2, 1.8, 0.9); c.fill();
    c.fillStyle = '#6a4a2a'; ell(c, -0.6, -3.7, 1.2, 1); c.fill();
    c.fillStyle = '#7d878c'; ell(c, 1.7, -4, 1.6, 1.4); c.fill();
    c.fillStyle = '#1e1a18'; ell(c, 2.3, -4.1, 0.75, 0.75); c.fill(); c.fillStyle = '#ffc457'; ell(c, 2.5, -4.2, 0.4, 0.4); c.fill();
    c.strokeStyle = '#3b3430'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(2.2, -5.2); c.quadraticCurveTo(3.2, -7, 4.2, -7.2); c.stroke();
  }
  function drawLabBee(c, b, x, y){
    const { ell, drawBeeBrass, clamp } = H;
    const ground = b.walker || b.st === 'crawl' || b.st === 'walk' || b.st === 'pause' || b.st === 'walkHome';
    if (b.st !== 'held'){ c.fillStyle = 'rgba(20,12,6,' + (b.z > 1 ? 0.16 : 0.28) + ')'; ell(c, b.x, b.y + 0.6, b.z > 1 ? 3 : 4.2, 1.1); c.fill(); }
    if (b.ci == null) b.ci = Math.floor(Math.random()*LAB_BROLLY.length);   // each bee keeps one umbrella (it used to follow b.x, so walkers flickered between colours)
    const cols = LAB_BROLLY[b.ci];
    if (ground){
      const moving = b.st !== 'pause', bob = moving ? -Math.abs(Math.sin((b.gait || 0)*0.9))*0.35 : 0, m = b.m || 0;
      const sc = 1.35*(b.big || 1);
      c.save(); c.translate(x, y + bob); c.scale((b.face || 1)*sc, sc);
      if (m >= 0.67) drawAntShape(c, 'worker', (b.gait || 0)*0.75, moving, 0, '#c99448');
      else if (m >= 0.34) drawBeeAnt(c, (b.gait || 0)*0.75, moving);
      else { c.save(); c.translate(0, -3); drawBeeBrass(c, b, 0.15, 0); c.restore(); c.strokeStyle = '#2e2b2a'; c.lineWidth = 0.45; const ph = (b.gait || 0)*0.8; for (let i=0;i<3;i++){ const s = moving ? Math.sin(ph + i*2)*1.2 : 0; c.beginPath(); c.moveTo(-2.4 + i*1.6, -1.4); c.lineTo(-2.6 + i*1.6 + s, 0); c.stroke(); } }
      if (b.brolly) miniBrolly(c, 0.4, -9.5, 4.2, cols);
      if (b.wet > 0.05){ c.fillStyle = 'rgba(200,225,240,' + (0.85*clamp(b.wet, 0, 1)) + ')'; for (const [dx, dy] of [[-3, -5], [1, -6], [3, -3]]){ ell(c, dx, dy, 0.5, 0.7); c.fill(); } }
      c.restore();
      return;
    }
    // flying, tumbling, on its back, or held
    const fl = b.st === 'fly' || b.st === 'tumble' || b.st === 'out' || b.st === 'climb' || b.st === 'fall' ? Math.abs(Math.sin(b.anim*60)) : 0.15;
    if (b.st === 'down' && b.brolly){ c.save(); c.translate(x + 7, y - 1); c.rotate(1.9); miniBrolly(c, 0, 0, 4.2, cols); c.restore(); }   // its umbrella lies beside it
    const sc = 1.35*(b.big || 1);
    c.save(); c.translate(x, y); c.scale((b.face || 1)*sc, sc); c.rotate(b.rot || 0);
    drawBeeBrass(c, b, fl, 0);
    if (b.brolly && b.st !== 'down') miniBrolly(c, 0, -6.5, 4.2, cols);
    if (b.st === 'down'){ c.strokeStyle = '#2e2b2a'; c.lineWidth = 0.45; for (let i=0;i<3;i++){ const w = Math.sin(b.anim*9 + i*1.7)*0.6; c.beginPath(); c.moveTo(-2 + i*1.6, -1.6); c.lineTo(-2.4 + i*1.6 + w, -3.6); c.stroke(); } }
    if (b.wet > 0.05){ c.fillStyle = 'rgba(200,225,240,' + (0.9*clamp(b.wet, 0, 1)) + ')'; for (const [dx, dy] of [[-3, -2.4], [1, -2.8], [-0.6, 1.6], [2.6, 0.4]]){ ell(c, dx, dy, 0.55, 0.75); c.fill(); } }
    c.restore();
  }

  const BEE_MODELS = ['worker', 'tank', 'strider', 'soldier', 'leafy'];


  function drawAntShape(c, m, ph, moving, n, cap){
    const { ell, leafPath, rr, shade } = H;
    const step = moving ? Math.sin(ph) : 0, step2 = moving ? Math.sin(ph + Math.PI) : 0;
    // V14.1: six legs in a tripod walk: the near three and the far three (fainter, behind) swing in turns, each foot
    // lifting as it swings forward, so the walking shows
    const legs = (xs, len, col, w) => {
      c.strokeStyle = col; c.lineWidth = (w || 0.5)*1.15; c.lineCap = 'round'; c.lineJoin = 'round';
      for (const far of [1, 0]){
        c.globalAlpha = far ? 0.5 : 1;
        xs.forEach((x, i) => {
          const q = ph + (i % 2 ? Math.PI : 0) + (far ? Math.PI : 0), s = moving ? Math.sin(q)*1.9 : 0, lift = moving ? Math.max(0, Math.cos(q))*1.1 : 0;
          const fx = x + s + (i - 1)*1.5 + (far ? 0.5 : 0), fy = (far ? -0.5 : 0) - lift;
          c.beginPath(); c.moveTo(x, -2.4); c.lineTo((x + fx)/2 + (i - 1)*0.3, -4 - lift*0.8); c.lineTo(fx, fy); c.stroke();
        });
      }
      c.globalAlpha = 1;
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

  // V16.1 (speed): an ant takes 40-odd canvas calls to draw, and there can be 60 of them, so each look an ant can have
  // (build, caps carried, cap colour, walking or not, and the step it's at, in 12 steps a stride) is drawn once into a
  // small picture at about the size it shows on screen, and stamped from then on. A few new ones are made a frame (after
  // a zoom); the rest are drawn as before until their turn comes.
  const ANT_SPR = new Map(), ANT_BOX = { x: -9, y: -15, w: 18, h: 19 }, ANT_STEPS = 12;
  const antSpr = { lvl: 0, made: 0, frame: -1 };
  function antSprite(m, ph, moving, n, cap, px){
    const { TAU } = H;
    // sizes in steps of √2, at least as big as needed
    const lvl = Math.ceil(Math.log2(Math.max(0.25, px))*2), res = Math.pow(2, lvl/2);
    const step = ((Math.round(ph/TAU*ANT_STEPS) % ANT_STEPS) + ANT_STEPS) % ANT_STEPS;
    const key = lvl + '|' + m + '|' + n + '|' + (n ? cap : '') + '|' + (moving ? 1 : 0) + '|' + step;
    let cv = ANT_SPR.get(key);
    if (cv){ ANT_SPR.delete(key); ANT_SPR.set(key, cv); return cv; }   // (most recently used last)
    const f = H.S.t; if (antSpr.frame !== f){ antSpr.frame = f; antSpr.made = 0; }
    if (antSpr.made >= 24) return null;
    antSpr.made++;
    cv = document.createElement('canvas');
    cv.width = Math.ceil(ANT_BOX.w*res); cv.height = Math.ceil(ANT_BOX.h*res);
    const g = cv.getContext('2d');
    g.setTransform(cv.width/ANT_BOX.w, 0, 0, cv.height/ANT_BOX.h, -ANT_BOX.x*cv.width/ANT_BOX.w, -ANT_BOX.y*cv.height/ANT_BOX.h);
    drawAntShape(g, m, step/ANT_STEPS*TAU, moving, n, cap);
    ANT_SPR.set(key, cv);
    if (ANT_SPR.size > 900) ANT_SPR.delete(ANT_SPR.keys().next().value);
    return cv;
  }
  // one ant (V15: game.js draws them one by one in depth order, so the ant hill hides the ones behind it)
  function drawAnt(c, b){
    const { beeSip, clamp, ell, parts, rand, simMode } = H;
    const x = b.x, y = b.y;
    // V14.1: they walk now (game.js antMove): b.walk says it moved this frame, b.gait how far it has walked, b.hx/hy its heading
    const moving = b.walk != null ? b.walk : b.st === 'fly' || b.st === 'home' || b.st === 'toWait' || b.st === 'queue';
    const tilt = moving && b.hx != null ? clamp(Math.atan2(b.hy, Math.abs(b.hx) + 0.01)*0.4, -0.45, 0.45) : 0;
    const bob = moving ? -Math.abs(Math.sin((b.gait || 0)*0.9))*0.35 : 0;
    c.fillStyle = 'rgba(20,12,6,.28)'; ell(c, x, y + 0.6, 5, 1.3); c.fill();
    c.save(); c.translate(x, y + bob); c.scale(b.face*1.35, 1.35); c.rotate(tilt);
    if (b.st === 'sip'){ c.rotate(-0.12 + Math.sin(b.anim*14)*0.06); }
    const n = b.carry > 0 ? clamp(Math.ceil(b.carry/(beeSip(b)) - 1e-6), 1, 3) : 0, cap = FLOWER_TYPES[b.mty || 0].m.cap || '#c99448';
    const m = BEE_MODELS[b.i % BEE_MODELS.length], ph = (b.gait != null ? b.gait*0.75 : b.anim*14) + b.ph;
    const spr = c === H.mainCtx ? antSprite(m, ph, moving, n, cap, H.px*1.35) : null;
    if (spr) c.drawImage(spr, ANT_BOX.x, ANT_BOX.y, ANT_BOX.w, ANT_BOX.h);
    else drawAntShape(c, m, ph, moving, n, cap);
    c.restore();
    if (b.st === 'sip' && !simMode && Math.random() < 0.08) parts.push({ k:'speck', x: x + b.face*5, y: y - 2, vx: rand(-14, 14), vy: rand(-20, -8), g: 60, life: rand(.3, .5), t: 0 });
  }
  function drawBees(V){
    const { B, ctx: c } = H;
    for (const b of B){ if (b.st === 'in' || b.inside || b.x < V.x0 || b.x > V.x1 || b.y < V.y0 || b.y > V.y1 + 20) continue; drawAnt(c, b); }
  }

  const BOW_COL = [['#e8eef4', '#aab4bf'], ['#2f6fb5', '#1f4f86'], ['#f2c443', '#b8862a']];
  function drawGiftJar(c, x, y, s, k = 1, tier = H.S.lv.giftPrice | 0){
    const { clamp, ell } = H;
    // V15: a D.O.P. can (protected designation of origin): the can gets a ribbon band and a wax seal, red, then blue, then
    // gold with the Gold D.O.P. seals upgrades
    drawJar(c, x, y, s);
    if (k < 0.3) return;
    c.save(); c.translate(x, y); c.scale(s/6, s/6);
    const [b0, b1] = [['#b8392a', '#7a2018'], ['#2f6fb5', '#1f4f86'], ['#e2b13a', '#a87a1c']][clamp(tier, 0, 2)];
    c.fillStyle = b0; c.fillRect(-3.6, 2.4, 7.2, 1.1); c.fillStyle = b1; c.fillRect(-3.6, 3.2, 7.2, 0.3);
    if (k >= 0.6){
      // the seal on the label, with two little tails
      c.fillStyle = b1; c.beginPath(); c.moveTo(1.6, 0.8); c.lineTo(1.1, 3.6); c.lineTo(1.9, 3); c.lineTo(2.5, 3.8); c.lineTo(2.9, 0.8); c.closePath(); c.fill();
      c.fillStyle = b0; ell(c, 2.2, 0.4, 1.7, 1.7); c.fill(); c.strokeStyle = b1; c.lineWidth = 0.35; ell(c, 2.2, 0.4, 1.25, 1.25); c.stroke();
      if (k >= 0.85){ c.strokeStyle = 'rgba(255,250,225,.9)'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(1.6, 0.4); c.lineTo(2.1, 0.9); c.lineTo(2.9, -0.2); c.stroke(); }
    }
    c.restore();
  }


  function logEnd(c, x, y, r, wet){
    const { ell } = H;
    c.fillStyle = wet ? '#2e2016' : '#5a3b24'; ell(c, x, y, r, r); c.fill();
    c.fillStyle = wet ? '#8a6642' : '#d8b07a'; ell(c, x, y, r*0.78, r*0.78); c.fill();
    c.strokeStyle = wet ? 'rgba(60,40,22,.8)' : 'rgba(150,104,60,.8)'; c.lineWidth = Math.max(0.3, r*0.12); ell(c, x, y, r*0.48, r*0.48); c.stroke(); ell(c, x, y, r*0.2, r*0.2); c.stroke();
    if (wet){ c.fillStyle = 'rgba(220,234,244,.45)'; ell(c, x - r*0.3, y - r*0.35, r*0.25, r*0.14); c.fill(); }
  }

  function nugget(c, x, y, s, rot){
    const { ell, rr } = H;
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

  function drawSpotGlints(){
    const { S, ctx } = H;
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

  function drawMiner(i){
    const { R, S, TAU, ctx, ell, minerWorkers, mulberry, parts, rand, simMode } = H;
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

  function drawIngot(c, x, y, s, rot, grade, wet){
    const { S, clamp, ell, rr } = H;
    // V17 (RAINY HOLLOW): coal (this place's "ingot"): a little burlap sack, its top folded open over black lumps of
    // charcoal. Briquettes make the lumps neat pressed blocks and the sack gets a tag (red, then blue, then gold).
    grade = grade == null ? S.lv.ingotGrade : grade;
    c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.scale(s/10, s/10);
    c.fillStyle = 'rgba(20,12,6,.25)'; ell(c, 0.4, 0.2, 5.2, 1.1); c.fill();
    // the sack
    c.fillStyle = '#9c7a4c'; c.beginPath(); c.moveTo(-4.4, -5); c.lineTo(4.4, -5); c.lineTo(4.9, -0.4); c.quadraticCurveTo(0, 0.6, -4.9, -0.4); c.closePath(); c.fill();
    c.fillStyle = '#b48e5c'; c.beginPath(); c.moveTo(-4.4, -5); c.lineTo(0.4, -5); c.lineTo(0.6, 0.1); c.quadraticCurveTo(-2, 0.3, -4.9, -0.4); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(90,64,34,.45)'; c.lineWidth = 0.3; for (const yy of [-3.8, -2.4, -1]){ c.beginPath(); c.moveTo(-4.6, yy); c.lineTo(4.6, yy); c.stroke(); }
    // the coal heaped up in the open top
    if (grade >= 1){
      c.fillStyle = '#1f1c1b'; for (const [bx, by] of [[-3.2, -6.4], [-0.4, -6.6], [2.4, -6.4], [-1.8, -8.2], [1, -8.3]]){ rr(c, bx - 1.3, by - 1, 2.6, 1.9, 0.4); c.fill(); }
      c.fillStyle = 'rgba(160,170,175,.4)'; for (const [bx, by] of [[-3.2, -6.4], [-0.4, -6.6], [2.4, -6.4], [-1.8, -8.2], [1, -8.3]]){ c.fillRect(bx - 1.1, by - 0.9, 2, 0.35); }
    } else {
      c.fillStyle = '#1a1716'; ell(c, 0, -5.4, 4.4, 1.6); c.fill();
      for (const [lx, ly, r] of [[-2.6, -6.4, 1.5], [0.2, -7.2, 1.7], [2.6, -6.2, 1.3], [-0.8, -5.6, 1.4], [1.6, -5.4, 1.1]]){ c.fillStyle = '#242020'; ell(c, lx, ly, r, r*0.8); c.fill(); c.fillStyle = 'rgba(170,180,185,.35)'; ell(c, lx - r*0.3, ly - r*0.35, r*0.4, r*0.2); c.fill(); }
    }
    // the folded rim of the sack
    c.fillStyle = '#86663e'; rr(c, -4.7, -5.4, 9.4, 1.3, 0.6); c.fill();
    if (grade >= 1){ const tag = ['#b8392a', '#2f6fb5', '#2f6fb5', '#e2b13a'][clamp(grade - 1, 0, 3)]; c.fillStyle = tag; rr(c, 1.4, -3.6, 2.8, 2, 0.4); c.fill(); c.strokeStyle = '#6a4a26'; c.lineWidth = 0.3; c.beginPath(); c.moveTo(1.4, -2.6); c.lineTo(0.2, -4.6); c.stroke(); }
    if (grade >= 3){ c.fillStyle = 'rgba(255,250,220,.6)'; c.fillRect(1.7, -3.3, 1.2, 0.4); }
    c.restore();
  }

  function drawPallet(){
    const { PALLET, S, chalk, clamp, ctx, ell, palletCap, palletShown, rr } = H;
    // V17 (RAINY HOLLOW): the coal stand by the road (this place's ingot pallet): a little roofed stall with a slate sign,
    // where haulers stack the sacks of coal until the truck takes them. It's there once the robots know what coal is.
    if (!palletShown()) return;
    const c = ctx, n = S.ingots, cap = palletCap();
    c.save(); c.translate(PALLET.x, PALLET.y);
    c.fillStyle = 'rgba(20,14,8,.32)'; ell(c, 2, 2, 28, 5.5); c.fill();
    // back boards, blackened with coal dust
    c.fillStyle = '#3e332c'; c.fillRect(-23, -40, 46, 38);
    c.strokeStyle = 'rgba(10,8,6,.45)'; c.lineWidth = 0.8; for (let x=-15; x<23; x+=8){ c.beginPath(); c.moveTo(x, -40); c.lineTo(x, -2); c.stroke(); }
    c.fillStyle = 'rgba(20,18,16,.35)'; ell(c, 0, -4, 22, 4); c.fill();
    c.fillStyle = '#6a5440'; rr(c, -24, -4, 48, 4, 1); c.fill();
    // sacks of coal: rows of four, three, two, one (a picture, not a count)
    const shown = n <= 0 ? 0 : Math.max(1, Math.round(clamp(n/cap, 0, 1)*10)), rows = [[-15, -5, 5, 15], [-10, 0, 10], [-5, 5], [0]];
    let k = 0;
    rows.forEach((row, ri) => row.forEach(x => { if (k++ < shown) drawIngot(c, x*1.05, -4.5 - ri*7.6, 11.5); }));
    c.fillStyle = '#4a3426'; rr(c, -25, -44, 4.5, 44, 1.2); c.fill(); rr(c, 20.5, -44, 4.5, 44, 1.2); c.fill();
    // the roof, and a slate sign hung under it
    c.fillStyle = '#2f2a28'; c.beginPath(); c.moveTo(-30, -42); c.lineTo(30, -42); c.lineTo(26, -52); c.lineTo(-26, -52); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(10,8,8,.5)'; c.lineWidth = 0.8; for (let x=-24; x<28; x+=6){ c.beginPath(); c.moveTo(x, -42); c.lineTo(x*0.9, -52); c.stroke(); }
    c.fillStyle = 'rgba(200,215,228,.3)'; c.fillRect(-26, -51.5, 52, 0.8);
    c.fillStyle = 'rgba(205,222,236,.75)'; for (const dx of [-27, -13, 2, 16, 28]){ const ph = (S.t*0.8 + dx*0.13) % 1; ell(c, dx, -41 + ph*8, 0.6, 0.9); c.fill(); }
    c.fillStyle = '#2a3330'; rr(c, -12, -60, 24, 9, 1.5); c.fill(); c.strokeStyle = '#7a5434'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-8, -60); c.lineTo(-6, -52); c.moveTo(8, -60); c.lineTo(6, -52); c.stroke();
    c.font = '700 7.5px Caveat, cursive'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#efe8d8'; c.fillText('COAL', 0, -55.4);
    // chalk count on the post
    c.fillStyle = '#734428'; rr(c, 17, -36, 20, 13, 2); c.fill(); c.fillStyle = '#2f3a34'; rr(c, 18.3, -34.7, 17.4, 10.4, 1.6); c.fill();
    const label = n + '/' + cap; let fs = 9.5; c.font = '700 ' + fs + 'px Caveat, cursive'; const lw = c.measureText(label).width; if (lw > 15) fs = fs*15/lw;
    chalk(c, label, 27, -29.3, fs, n >= cap ? '#ffb38a' : '#efe8d8');
    c.restore();
  }

  function drawPlant(){
    const { HOPPER, PLANT_VENT, R, RACK, RACK_CAP, S, STN, bubbles, chalk, clamp, ctx, drawPlot, ease, ell, flameAt, hopperCap, metalPerIngot, mulberry, parts, plantRt, plantShown, rand, reduceMotion, rr, simMode, stoker, wind } = H;
    // V17 (RAINY HOLLOW): the charcoal kiln (this place's smelting plant): three brick beehive kilns in a row on a brick
    // apron, each with an arched iron door a robot loads and tends, a tall chimney behind, the log stack under a plank roof
    // on the left and a shelf of coal sacks on the right. Smoke curls off the domes while they burn.
    if (!plantShown()) return;
    const c = ctx, t = S.t;
    c.save(); c.translate(PLANT.x, PLANT.y);
    if (!S.plant.built){ drawPlot(c, 150, 46, 'charcoal kiln', plantRt.shownT); c.restore(); return; }
    const grow = clamp((S.t - plantRt.builtT)/1.5, 0, 1); if (grow < 1) c.scale(1, ease(grow));
    const { SMELT_N } = H;
    const busy = [0, 1, 2].map(i => { if (i >= SMELT_N) return !!stoker(); const ri = STN.smelt[i]; return ri != null && R[ri] && R[ri].st === 'smelt'; });   // (V21: the right kiln is the bellows')
    const any = busy.some(b => b), st2 = stoker();
    c.lineCap = 'round';
    c.fillStyle = 'rgba(20,14,8,.36)'; ell(c, 4, 3, 104, 12); c.fill();
    // the brick apron in front
    c.fillStyle = '#6a4a3a'; rr(c, -70, -6, 140, 10, 3); c.fill();
    c.strokeStyle = 'rgba(30,18,12,.5)'; c.lineWidth = 0.7; for (let x=-66; x<70; x+=8){ c.beginPath(); c.moveTo(x, -6); c.lineTo(x - 1.5, 4); c.stroke(); } c.beginPath(); c.moveTo(-70, -1); c.lineTo(70, -1); c.stroke();
    // the chimney behind, sooty at the top
    { const cx = 0, ctop = -150; c.fillStyle = '#7a4a36'; c.fillRect(cx - 9, ctop, 18, 100); const r2 = mulberry(41);
      for (let y=ctop; y<-52; y+=5) for (let x=cx - 9 + ((y/5) % 2 ? 0 : 4.5); x<cx + 9; x+=9){ c.fillStyle = r2() < .5 ? '#8a5640' : '#6e4232'; rr(c, x + 0.4, y + 0.4, 8.2, 4.2, 0.8); c.fill(); }
      const sg = c.createLinearGradient(0, ctop, 0, ctop + 30); sg.addColorStop(0, 'rgba(20,16,14,.85)'); sg.addColorStop(1, 'rgba(20,16,14,0)'); c.fillStyle = sg; c.fillRect(cx - 9, ctop, 18, 30);
      c.fillStyle = '#3a2a24'; c.fillRect(cx - 11, ctop - 4, 22, 5); c.fillStyle = '#1a1210'; ell(c, cx, ctop - 4, 8, 1.8); c.fill(); }
    // three brick domes, side by side (V21: two for robots, the right one for the blower on the bellows)
    for (let i=0;i<3;i++){
      const dx = (i - 1)*40, on = busy[i], fl = on ? (st2 ? 0.95 : 0.78) + (st2 ? 0.05 : 0.2)*Math.sin(t*12 + i*2) : 0.16 + 0.05*Math.sin(t*2 + i);
      const dome = () => { c.beginPath(); c.moveTo(dx - 22, -4); c.bezierCurveTo(dx - 24, -38, dx - 12, -54, dx, -54); c.bezierCurveTo(dx + 12, -54, dx + 24, -38, dx + 22, -4); c.closePath(); };
      dome(); const dg = c.createLinearGradient(dx - 22, 0, dx + 22, 0); dg.addColorStop(0, '#a8644a'); dg.addColorStop(0.5, '#8e5240'); dg.addColorStop(1, '#5e3428'); c.fillStyle = dg; c.fill();
      c.save(); dome(); c.clip(); const r3 = mulberry(70 + i);
      c.strokeStyle = 'rgba(40,20,14,.45)'; c.lineWidth = 0.6;
      for (let row=0, y=-50; y<-2; y+=4.2, row++){ c.beginPath(); c.moveTo(dx - 26, y); c.lineTo(dx + 26, y); c.stroke(); const off = row % 2 ? 0 : 3.5; for (let x=dx - 24 + off; x<dx + 24; x+=7){ c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 4.2); c.stroke(); } }
      for (let k=0;k<10;k++){ c.fillStyle = r3() < 0.5 ? 'rgba(30,20,16,.25)' : 'rgba(255,200,160,.08)'; ell(c, dx + (r3() - 0.5)*36, -8 - r3()*40, 2 + r3()*3, 1.4 + r3()*1.6); c.fill(); }
      // soot above the door, and a warm glow through the bricks while it burns
      const so = c.createRadialGradient(dx, -24, 2, dx, -30, 20); so.addColorStop(0, 'rgba(20,14,12,' + (0.35 + 0.25*fl) + ')'); so.addColorStop(1, 'rgba(20,14,12,0)'); c.fillStyle = so; c.fillRect(dx - 24, -56, 48, 52);
      if (on){ const gw = c.createRadialGradient(dx, -16, 2, dx, -16, 26); gw.addColorStop(0, 'rgba(255,140,50,' + 0.22*fl + ')'); gw.addColorStop(1, 'rgba(255,140,50,0)'); c.fillStyle = gw; c.fillRect(dx - 24, -50, 48, 46); }
      c.restore();
      // the vent at the top, and the arched iron door
      c.fillStyle = '#4a2c22'; rr(c, dx - 4, -57, 8, 4, 1); c.fill();
      c.fillStyle = '#26201d'; c.beginPath(); c.moveTo(dx - 9, -4); c.lineTo(dx - 9, -18); c.quadraticCurveTo(dx, -28, dx + 9, -18); c.lineTo(dx + 9, -4); c.closePath(); c.fill();
      const fg = c.createRadialGradient(dx, -10, 1, dx, -10, 10); fg.addColorStop(0, 'rgba(255,236,160,' + fl + ')'); fg.addColorStop(0.5, 'rgba(255,130,40,' + fl*0.9 + ')'); fg.addColorStop(1, 'rgba(110,26,10,' + fl*0.6 + ')');
      c.fillStyle = fg; c.beginPath(); c.moveTo(dx - 6.5, -5.5); c.lineTo(dx - 6.5, -16.5); c.quadraticCurveTo(dx, -24, dx + 6.5, -16.5); c.lineTo(dx + 6.5, -5.5); c.closePath(); c.fill();
      c.strokeStyle = '#141110'; c.lineWidth = 0.9; for (const gx of [-3, 0, 3]){ c.beginPath(); c.moveTo(dx + gx, -6); c.lineTo(dx + gx, gx ? -18 : -20); c.stroke(); }
      c.strokeStyle = '#3a3532'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(dx - 9, -4); c.lineTo(dx - 9, -18); c.quadraticCurveTo(dx, -28, dx + 9, -18); c.lineTo(dx + 9, -4); c.stroke();
      c.fillStyle = '#c9a24a'; ell(c, dx + 7, -11, 0.9, 0.9); c.fill();
      if (on){ c.fillStyle = 'rgba(255,170,70,.16)'; ell(c, dx, 0, 16, 4); c.fill(); }
    }
    // drips off the domes
    c.fillStyle = 'rgba(205,222,236,.7)'; for (let k=0;k<6;k++){ const dx = -58 + k*23, ph = (t*0.85 + k*0.29) % 1; ell(c, dx, -30 + ph*24, 0.7, 1); c.fill(); }
    // the bellows intake: a small iron grate in the apron, glowing when a blower works it
    { const vx = PLANT_VENT.x - PLANT.x, vy = PLANT_VENT.y - PLANT.y, gl = st2 ? 0.55 + 0.25*Math.sin(t*14) : 0.12;
      c.fillStyle = '#3a3532'; ell(c, vx, vy, 7, 2.8); c.fill(); c.fillStyle = 'rgba(255,150,50,' + gl + ')'; ell(c, vx, vy, 5.6, 2.1); c.fill();
      c.strokeStyle = '#1a1714'; c.lineWidth = 0.9; for (const gx of [-3, 0, 3]){ c.beginPath(); c.moveTo(vx + gx, vy - 1.8); c.lineTo(vx + gx, vy + 1.8); c.stroke(); } }
    // the log stack on the left, under a little plank roof
    c.save(); c.translate(HOPPER.x - PLANT.x, HOPPER.y - PLANT.y);
    c.fillStyle = '#4a3426'; c.fillRect(-15, -40, 3, 40); c.fillRect(12, -40, 3, 40);
    c.fillStyle = '#2a1e16'; c.fillRect(-14, -36, 28, 36);
    { const f = clamp(S.plant.ore/hopperCap(), 0, 1), n = Math.ceil(f*12); for (let i=0;i<n;i++){ const row = Math.floor(i/3), k = i % 3; logEnd(c, -8 + k*8 + (row % 2)*2, -4 - row*6.2, 3.2, false); } }
    c.fillStyle = '#3d332c'; c.beginPath(); c.moveTo(-20, -38); c.lineTo(20, -38); c.lineTo(17, -46); c.lineTo(-17, -46); c.closePath(); c.fill();
    c.fillStyle = 'rgba(210,228,236,.3)'; c.fillRect(-14, -45.5, 28, 0.8);
    c.fillStyle = '#2f3a34'; rr(c, -11, -34, 22, 10, 2); c.fill();
    chalk(c, Math.floor(S.plant.ore) + '/' + hopperCap(), 0, -28.8, 9, S.plant.ore >= hopperCap() ? '#ffb38a' : '#efe8d8');
    c.restore();
    // the shelf of coal sacks on the right
    c.save(); c.translate(RACK.x - PLANT.x, RACK.y - PLANT.y);
    c.fillStyle = '#4a3426'; c.fillRect(-15, -40, 3, 40); c.fillRect(12, -40, 3, 40);
    c.fillStyle = '#6a4a30'; rr(c, -16, -19, 32, 3, 1); c.fill(); rr(c, -16, -37, 32, 3, 1); c.fill();
    const nr = Math.min(8, Math.ceil(S.plant.rack/RACK_CAP*8));
    for (let i=0;i<nr;i++){ const shelf = i < 4 ? 0 : 1, k = i % 4; drawIngot(c, -9 + k*6, shelf ? -37 : -19, 7, 0); }
    c.fillStyle = '#2f2a28'; c.beginPath(); c.moveTo(-20, -40); c.lineTo(20, -40); c.lineTo(17, -46); c.lineTo(-17, -46); c.closePath(); c.fill();
    if (plantRt.bump > 0){ c.fillStyle = 'rgba(255,200,120,' + plantRt.bump + ')'; ell(c, 0, -26, 18, 10); c.fill(); }
    c.restore();
    c.restore();
    // smoke off the busy domes' vents and the chimney
    if (!simMode && grow >= 1){
      if (Math.random() < 0.05*(any ? 1 : 0.25)*(reduceMotion ? 0.3 : 1)) parts.push({ k:'smoke', x: PLANT.x + rand(-2, 2), y: PLANT.y - 156, vx: rand(-4, 4) + wind*0.25, vy: rand(-22, -14), g: 0, life: rand(2.2, 3.4), t: 0, r: rand(4, 6) });
      for (let i=0;i<3;i++) if (busy[i] && Math.random() < 0.07) parts.push({ k:'smoke', x: PLANT.x + (i - 1)*40 + rand(-2, 2), y: PLANT.y - 58, vx: rand(-3, 3) + wind*0.2, vy: rand(-18, -10), g: 0, life: rand(1.4, 2.2), t: 0, r: rand(2.5, 4) });
    }
    if (grow >= 1){
      if (S.plant.rack >= RACK_CAP) bubbles.push({ x: RACK.x, y: RACK.y - 56, t: 'shelf full' });
      else if (S.plant.ore < metalPerIngot() - 1e-9 && STN.smelt.some(v => v != null) && !S.binMetal && !R.some(r => r.st === 'toBin' && r.at === 'metal')) bubbles.push({ x: HOPPER.x, y: HOPPER.y - 60, t: 'needs logs' });
    }
  }

  function drawShaft(i){
    const { HB, R, S, TAU, ctx, ell, minerWorkers, mulberry, parts, rand, rr, simMode } = H;
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

  function drawBrolly(c, cx, rim, R, cols, rib){
    const { ell, shade } = H;
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

  function drawWoodUmbrella(c, hx, hy, col, h){
    const { RAIN, ctx, ell, mainCtx, parts, rand, rr, shade, simMode } = H;
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

  const PAY_COL = { leaf: '#ff9b3d', bag: '#ffb866', honey: '#e8b46a', gift: '#ff8f7a', bonus: '#b5e36d' };

  function payFill(c, kind, y0, y1){
    if (kind === 'ingot'){ const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#fff0d0'); g.addColorStop(0.5, '#e8c48a'); g.addColorStop(0.52, '#c4965a'); g.addColorStop(1, '#f2d8a8'); return g; }
    if (kind !== 'metal') return PAY_COL[kind] || '#fff4e0';
    const g = c.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, '#e8d4b4'); g.addColorStop(0.45, '#b8946a'); g.addColorStop(0.55, '#8a6a46'); g.addColorStop(1, '#c4a47a');
    return g;
  }

  // ── the log crib (this place's metal tub): an open wooden crib with a little plank roof; the wet logs inside are stacked
  // end-on, so you can see how full it is
  function drawTub(c){
    const { S, TUB, chalk, clamp, ell, keepMark, keepMetal, metalCap, rr, tubRoom } = H;
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

  // ── moss on the workshop roof, a wet shine along it and drips falling off the eaves (inside the shed's transform)
  function shedExtra(c){
    const { S, ell, mulberry } = H;
    // RAINY HOLLOW: moss on the roof, a wet shine along it and drips falling off the eaves
    { const r2 = mulberry(19); c.fillStyle = '#56702a'; for (let k=0;k<9;k++){ const yy = -60 - r2()*30, half = 54 - (-58 - yy)*1.4; ell(c, (r2() - 0.5)*half*1.6, yy, 2 + r2()*3, 1 + r2()); c.fill(); } }
    c.strokeStyle = 'rgba(205,218,230,.3)'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-50, -60); c.lineTo(0, -93); c.stroke();
    c.fillStyle = 'rgba(205,222,236,.8)'; for (let k=0;k<8;k++){ const dx = -54 + k*15.4, ph = (S.t*0.9 + k*0.37) % 1; ell(c, dx, -56 + ph*12, 0.8, 1.1); c.fill(); }
  }

  // ── robots saw here instead of drilling: the arm pushes a bow saw back and forth through the log (robot space)
  function sawArm(c, r, sx, sy){
    const k = Math.sin(r.hammer*13), hx = sx + 9 + k*4, hy = sy + 6;
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(hx, hy); c.stroke();
    c.save(); c.translate(hx, hy);
    c.strokeStyle = '#7a5236'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(7, -8, 15, 0); c.stroke();
    c.fillStyle = '#b9c2c6'; c.fillRect(0, -0.5, 15, 1.4);
    c.fillStyle = '#6c7378'; for (let q=1;q<15;q+=2){ c.beginPath(); c.moveTo(q, 0.9); c.lineTo(q + 0.8, 2); c.lineTo(q + 1.6, 0.9); c.fill(); }
    c.restore();
  }
  // ── some robots wear a tiny umbrella on their head (STYLES[].brolly, see styles below); drawn in the head's space
  function robotBrolly(c, r, st, hx0, hy0, hw, bob){
    const { ell, shade, leafPath, rand, simMode, ctx, mainCtx, RAIN, parts } = H;
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
  // a piece of mushroom flying from the ant hill to the crate (this place's "honey" bit)
  // ── V15: the drying bench (the bagging table's place): a slatted bench with a wire-mesh tray, a little iron stove
  // underneath, and blowers behind it blowing warm air across the leaves. Wet leaves go dark and glossy on the tray and
  // turn crisp and pale as they dry; the dry ones go in kraft paper sacks (drawLeafBag below).
  const mixHex = (a, b, k) => { const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16), f = (s) => [s >> 16, s >> 8 & 255, s & 255];
    const A = f(p), B = f(q); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v)*k)).join(',') + ')'; };
  const DRY_COL = ['#e2a24a', '#d9822e', '#e8b85c', '#c97a34', '#d6a050', '#b8742e', '#edc77a'];
  function drawBagger(){
    const { BAGGER, S, TAU, benchLit, clamp, ctx: c, dryTrays, ell, flameAt, leafBlob, mulberry, parts, rand, rr, simMode, wind } = H;
    const t = S.t, trays = dryTrays(), lit = benchLit(), on = trays.some(p => p >= 0) || lit;   // (V17: lit: logs burning in the stove)
    c.save(); c.translate(BAGGER.x, BAGGER.y);
    c.fillStyle = 'rgba(20,14,8,.34)'; ell(c, 2, 2, 36, 6.5); c.fill();
    // the stove pipe up the back left, smoking while anyone is drying
    c.fillStyle = '#2b2522'; rr(c, -27, -66, 5, 44, 1.5); c.fill(); c.fillStyle = '#4a423b'; c.fillRect(-26, -66, 1.2, 44);
    c.fillStyle = '#1f1a17'; rr(c, -28.5, -69, 8, 4, 1); c.fill();
    if (on && !simMode && Math.random() < (lit ? 0.14 : 0.08)) parts.push({ k:'smoke', x: BAGGER.x - 24.5 + rand(-1, 1), y: BAGGER.y - 70, vx: rand(-3, 3) + wind*0.25, vy: rand(-16, -9), g: 0, life: rand(1.4, 2.2), t: 0, r: rand(2.5, 4) });
    // legs and a lower shelf with folded paper sacks
    c.fillStyle = '#4e3524'; for (const lx of [-29, 25]){ rr(c, lx, -24, 4, 24, 1); c.fill(); }
    c.fillStyle = '#6a4a30'; rr(c, -28, -8, 56, 3, 1); c.fill();
    for (let i=0;i<3;i++){ c.fillStyle = i % 2 ? '#b98a56' : '#caa06a'; rr(c, 7 + i*1.1, -11 - i*1.5, 15, 1.8, 0.5); c.fill(); }
    // V17: logs waiting by the stove, and coal in the ash pan under it
    if (S.bench && S.bench.fire){
      for (let i=0;i<Math.min(S.bench.logs, 3);i++){ const lx = -20 + (i % 2)*5, ly = -2 - Math.floor(i/2)*4.2; c.fillStyle = '#56402c'; rr(c, lx - 5, ly - 3.6, 9, 3.8, 1.8); c.fill(); logEnd(c, lx + 4, ly - 1.7, 2, false); }
      c.fillStyle = '#2a2420'; rr(c, -12, -6.5, 20, 3, 1); c.fill();
      for (let i=0;i<Math.min(S.bench.coal, 6);i++){ c.fillStyle = i % 2 ? '#1a1716' : '#2a2624'; ell(c, -9 + i*3, -6.8 - (i % 2)*0.6, 1.7, 1.2); c.fill(); }
    }
    // the little iron stove under the middle: a warm glow through its grate
    const fl = lit ? 0.85 + 0.15*Math.sin(t*11) : on ? 0.65 + 0.35*Math.sin(t*9) * Math.sin(t*3.3) : 0.25;
    c.fillStyle = '#2f2a26'; rr(c, -11, -21, 18, 15, 2); c.fill();
    c.fillStyle = '#4a423b'; c.fillRect(-11, -21, 18, 2.2);
    c.fillStyle = 'rgba(255,' + Math.round(140 + 50*fl) + ',60,' + (0.35 + 0.55*fl) + ')'; rr(c, -7.5, -16, 11, 6, 1.2); c.fill();
    c.strokeStyle = '#1f1a17'; c.lineWidth = 0.8; for (let k=0;k<4;k++){ c.beginPath(); c.moveTo(-6 + k*2.8, -16); c.lineTo(-6 + k*2.8, -10); c.stroke(); }
    if (on){ c.fillStyle = 'rgba(255,160,70,' + (0.12*fl) + ')'; ell(c, -2, -13, 14, 8); c.fill(); }
    if (lit){ c.fillStyle = 'rgba(255,170,70,.22)'; ell(c, -2, -10, 22, 9); c.fill(); for (const [dx, k] of [[-5, 0.8], [-1, 1], [3, 0.7]]) flameAt(c, dx, -16, 2.2*k, t, 40 + dx); }
    // the bench top: a wooden frame round a wire-mesh tray, seen a little from above
    c.fillStyle = '#7a5434'; rr(c, -32, -27, 64, 5, 1.5); c.fill();
    c.fillStyle = 'rgba(255,230,190,.16)'; c.fillRect(-30, -26.6, 60, 1);
    c.fillStyle = '#5e4028'; c.beginPath(); c.moveTo(-31, -27); c.lineTo(31, -27); c.lineTo(28, -35); c.lineTo(-28, -35); c.closePath(); c.fill();
    c.fillStyle = '#3a3330'; c.beginPath(); c.moveTo(-28, -28); c.lineTo(28, -28); c.lineTo(25.6, -34); c.lineTo(-25.6, -34); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(170,176,180,.55)'; c.lineWidth = 0.4;
    for (let k=-24; k<=24; k+=3){ c.beginPath(); c.moveTo(k*1.07, -28); c.lineTo(k, -34); c.stroke(); }
    for (let y=-33; y<=-29; y+=1.5){ c.beginPath(); c.moveTo(-27.5 + (-y - 28)*0.4, y); c.lineTo(27.5 - (-y - 28)*0.4, y); c.stroke(); }
    c.strokeStyle = '#8a6242'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -28); c.lineTo(0, -34); c.stroke();   // the divider between the two trays
    // leaves on each tray: dark, glossy and wet when they land, crisp and pale when they're done
    for (let k=0;k<2;k++){
      const p = trays[k], cx = k ? 13 : -13, rnd = mulberry(400 + k*17 + (p >= 0 ? 0 : 7));
      if (p < 0){
        // a few crumbs of dry leaf left from the last tray
        for (let i=0;i<4;i++) leafBlob(c, cx + (rnd() - 0.5)*18, -31 + (rnd() - 0.5)*4, 2.4, rnd()*TAU, DRY_COL[Math.floor(rnd()*DRY_COL.length)]);
        continue;
      }
      const LC = H.LEAFC;
      for (let i=0;i<12;i++){
        const lc = LC[Math.floor(rnd()*LC.length)], dc = DRY_COL[Math.floor(rnd()*DRY_COL.length)], own = clamp(p*1.25 - rnd()*0.25, 0, 1);
        const x = cx + (rnd() - 0.5)*19, y = -31 + (rnd() - 0.5)*4.2, rot = rnd()*TAU + (p > 0 ? Math.sin(t*14 + i)*0.08*(1 - own) : 0);
        leafBlob(c, x, y, 3.6 - own*0.4, rot, mixHex(lc.c, dc, own));
        if (own < 0.5){ c.fillStyle = 'rgba(220,235,245,' + (0.35*(1 - own*2)) + ')'; ell(c, x - 0.6, y - 0.6, 0.7, 0.35); c.fill(); }   // the wet sheen goes as they dry
        else if (own > 0.85){ c.strokeStyle = 'rgba(120,70,30,.5)'; c.lineWidth = 0.3; c.beginPath(); c.moveTo(x - 1.4, y + 0.5); c.lineTo(x + 1.4, y - 0.4); c.stroke(); }   // a curled, crisp edge
      }
    }
    // a plank sign on the front
    c.fillStyle = '#d9c6a2'; rr(c, -10, -25.5, 20, 6, 1.4); c.fill();
    c.font = '800 4.4px "Baloo 2", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#6a3a1c'; c.fillText('DRYING', 0, -22.4);
    c.restore();
  }
  // a kraft paper sack of crisp dry leaves, its top rolled over, leaves poking out. Better sacks: a twine tie, then an
  // orange band with a leaf stamp, then a gold label and an oak sprig
  function drawLeafBag(c, x, y, s, tier){
    const { ell, rr } = H;
    c.save(); c.translate(x, y); c.scale(s/10, s/10);
    c.fillStyle = 'rgba(20,14,8,.25)'; ell(c, 0.6, 0.2, 5, 1.2); c.fill();
    // leaves poking out of the top
    for (const [lx, ly, a, col] of [[-2.2, -8.6, -0.6, '#e2a24a'], [1.8, -9, 0.5, '#c97a34'], [0, -9.8, 0.1, '#edc77a'], [3, -8.2, 1, '#d9822e']]){
      c.save(); c.translate(lx, ly); c.rotate(a); c.scale(1.6, 1); c.fillStyle = col; c.beginPath(); c.moveTo(0, -1.4); c.quadraticCurveTo(1.2, 0, 0, 1.4); c.quadraticCurveTo(-1.2, 0, 0, -1.4); c.fill(); c.restore();
    }
    // the sack
    c.fillStyle = '#b58a56'; c.beginPath(); c.moveTo(-4.2, -7.6); c.lineTo(4.2, -7.6); c.lineTo(4.8, -0.4); c.quadraticCurveTo(0, 0.5, -4.8, -0.4); c.closePath(); c.fill();
    c.fillStyle = '#c99d66'; c.beginPath(); c.moveTo(-4.2, -7.6); c.lineTo(0.6, -7.6); c.lineTo(0.9, -0.1); c.quadraticCurveTo(-2, 0.2, -4.8, -0.4); c.closePath(); c.fill();
    // the rolled-over top
    c.fillStyle = '#a77a48'; rr(c, -4.6, -8.6, 9.2, 2, 0.8); c.fill();
    c.fillStyle = 'rgba(255,240,215,.35)'; c.fillRect(-4.2, -8.4, 8.4, 0.5);
    c.strokeStyle = 'rgba(90,60,30,.35)'; c.lineWidth = 0.3; c.beginPath(); c.moveTo(-2.6, -6.4); c.lineTo(-3, -1); c.moveTo(2.8, -6.2); c.lineTo(3.2, -1.2); c.stroke();
    if (tier >= 2){ c.strokeStyle = '#d9c08a'; c.lineWidth = 0.55; c.beginPath(); c.moveTo(-4.5, -6.6); c.lineTo(4.5, -6.6); c.stroke(); c.fillStyle = '#d9c08a'; ell(c, 1.2, -6.6, 0.8, 0.5); c.fill(); }
    if (tier >= 4){ c.fillStyle = '#d6672a'; c.fillRect(-4.5, -4.6, 9.2, 2); c.fillStyle = '#f2e3c4'; c.beginPath(); c.moveTo(0, -4.4); c.quadraticCurveTo(0.9, -3.6, 0, -2.8); c.quadraticCurveTo(-0.9, -3.6, 0, -4.4); c.fill(); }
    if (tier >= 7){ c.fillStyle = '#e2b13a'; rr(c, -2, -2.6, 4, 2, 0.4); c.fill(); c.fillStyle = 'rgba(255,250,220,.6)'; c.fillRect(-1.6, -2.4, 2, 0.4); }
    if (tier >= 9){ c.strokeStyle = '#6b4a24'; c.lineWidth = 0.35; c.beginPath(); c.moveTo(3, -8.4); c.quadraticCurveTo(4.4, -10.4, 5.4, -10.6); c.stroke(); c.fillStyle = '#c0432a'; ell(c, 4.6, -10.2, 1, 0.5); c.fill(); }
    c.restore();
  }

  function flyHoney(c, x, y){
 const { ell } = H; c.fillStyle = '#e8dcc4'; c.fillRect(x - 0.6, y - 0.4, 1.2, 2.2); c.fillStyle = '#a8642e'; c.beginPath(); c.ellipse(x, y, 2.4, 1.9, 0, Math.PI, 0); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,240,215,.5)'; ell(c, x - 0.8, y - 1, 0.7, 0.35); c.fill(); }

  // ── what you call things here (game.js runs card text, pops, toasts, tips and bubbles through these; code names still
  // say metal, ingot, hive, bee). Earlier entries win over later ones at the same spot, so the specific ones come first.
  const PHRASES = [
    // the metal side: logs, sawn at wood piles; V17: burnt to coal in the charcoal kiln (the smelting plant's place) and
    // sold at the coal stand by the road (the ingot pallet's). (Was the drying shed and dry bundles; and V17: the logs
    // aren't called wet logs any more, just logs.)
    // V15: the bagging table is a drying bench, and what it makes are sacks of dry leaves
    ['[Bb]agging table', m => m[0] === 'B' ? 'Drying bench' : 'drying bench'], ['Better bags', 'Better sacks'], ['Bag leaves', 'Dry leaves'], ['Baggers', 'Dryers'], ['Bagging', 'Drying'],
    ['Room for bags, on a shelf of their own', 'Room for sacks of dry leaves, on a shelf of their own'], ['\\bbags\\b', 'sacks'], ['\\bbag\\b', 'sack'], ['\\bBags\\b', 'Sacks'], ['\\bBag\\b', 'Sack'],
    ['Grade the metal', 'Sort the logs'], ['Bigger metal tub', 'Bigger log crib'], ['[Mm]etal slot', m => m[0] === 'M' ? 'Log crib' : 'log crib'],
    ['[Mm]etal tub', m => m[0] === 'M' ? 'Log crib' : 'log crib'], ['metal full', 'crib full'], ['\\btub\\b', 'crib'], ['\\bTub\\b', 'Crib'],
    ['Seconds for a chunk of metal', 'Seconds for a log'], ['a chunk of metal', 'a log'], ['[Cc]hunk of metal', m => m[0] === 'C' ? 'Log' : 'log'],
    ['\\bchunks\\b', 'logs'], ['\\bchunk\\b', 'log'],
    ['\\bdrills\\b', 'saws'], ['\\bdrill\\b', 'saw'], ['\\bDrill\\b', 'Saw'],
    ['Lucky horseshoe', 'Lucky axe'], ['Mining tools', 'Logging tools'],   // (V37: was Cutting oil → Chain oil)
    ['sucking the dirt out', 'blowing warm air on the pile'], ['every vein worked', 'every pile sawn'], ['will smelt and haul', 'will burn coal and haul it'], ['Extra ingots from the same metal', 'Extra coal from the same logs'], ['haul the ingots to the road', 'haul the coal to the stand by the road'], [' metal into an ingot', ' logs into coal'], ['\\(ingots are worth', '(coal is worth'], ['Excavate shafts', 'Dry the wood piles'], ['Excavator', 'Woodpile dryer'], ['Excavating', 'Woodpile drying'], ['excavating upgrades for Blowers at a mine shaft', 'woodpile drying upgrades for Blowers at a wood shelter'],
    ['excavate a shaft', 'dry the woodpile'], ['excavate here', 'dry the woodpile here'], ['\\bExcavate\\b', 'Dry woodpile'], ['\\bexcavate\\b', 'dry the woodpile'],
    ['Dirt hose', 'Warm-air hose'], ['Grit cyclone', 'Heat Blower'],
    ['A deeper, richer vein: chunks come', 'A roof over the pile keeps the wood drier: logs come'],
    ['Dig a shaft', 'Build a shelter'], ['\\bDig\\b', 'Dry woodpile'], ['Mine shaft dug!', 'Wood shelter built!'], ['You’ve dug one before', 'You’ve built one before'],
    ['[Mm]ine shafts', m => m[0] === 'M' ? 'Wood shelters' : 'wood shelters'], ['[Mm]ine shaft', m => m[0] === 'M' ? 'Wood shelter' : 'wood shelter'],
    ['\\bshafts\\b', 'shelters'], ['\\bshaft\\b', 'shelter'],
    ['Mine metal', 'Saw logs'], ['To the mine', 'To the pile'], ['heads over to mine', 'heads over to saw'], ['at a mine\\b', 'at a saw'],
    ['Build a miner', 'Set up a saw'], ['build a miner on the rocks', 'set up a saw at the wood pile'], ['build miners on the rocks', 'set up saws at the wood piles'],
    ['on the rocks', 'at the wood pile'], ['\\bMiners\\b', 'Saw stations'], ['\\bMiner\\b', 'Saw station'], ['\\bminers\\b', 'saws'], ['\\bminer\\b', 'saw'],
    ['\\bMining\\b', 'Sawing'], ['\\bmining\\b', 'sawing'], ['\\bMine\\b', 'Saw'], ['\\bmine\\b', 'saw'],
    ['Richer veins give chunks faster', 'Bigger piles give logs faster'], ['thin vein', 'small pile'], ['rich vein', 'huge pile'], ['good vein', 'big pile'], ['fair vein', 'fair pile'],
    ['[Mm]etal veins?', m => (m[0] === 'M' ? 'Wood pile' : 'wood pile') + (m.endsWith('s') ? 's' : '')], ['\\bveins\\b', 'piles'], ['\\bvein\\b', 'pile'],
    // V17: the charcoal kiln and the coal stand
    ['Smelting plant', 'Charcoal kiln'], ['smelting plant', 'charcoal kiln'], ['Smelt ingots', 'Burn charcoal'], ['\\bSmelters\\b', 'Burners'], ['\\bsmelters\\b', 'burners'], ['\\bsmelter\\b', 'burner'],
    ['\\bSmelting\\b', 'Burning'], ['\\bsmelting\\b', 'burning'], ['\\bsmelted\\b', 'burnt'], ['\\bsmelts\\b', 'burns'], ['\\bSmelt\\b', 'Burn'], ['\\bsmelt\\b', 'burn'],
    ['Robots melt ', 'Robots burn '], ['To the plant', 'To the kiln'], ['at the plant', 'at the kiln'], ['the plant\\b', 'the kiln'], ['To a furnace', 'To the kiln'],
    ['Hotter furnace', 'Hotter kiln'], ['\\bFurnaces\\b', 'Kiln doors'], ['\\bfurnaces\\b', 'kiln doors'], ['\\bfurnace\\b', 'kiln'],
    ['Better alloy', 'Briquettes'], ['the alloy', 'the briquettes'], ['Slag recovery', 'Tight stacking'], ['from slag', 'from tight stacking'],
    ['Bigger ore hopper', 'Bigger log stack'], ['[Oo]re hopper', m => m[0] === 'O' ? 'Log stack' : 'log stack'], ['[Hh]opper full', m => m[0] === 'H' ? 'Stack full' : 'stack full'],
    ['(?<!Spring )\\bhopper\\b', 'log stack'], ['To the hopper', 'To the log stack'],
    ['Ore in the hopper', 'Logs in the stack'], ['needs ore', 'needs logs'], ['Fetching ore', 'Fetching logs'], ['\\bore\\b', 'logs'], ['\\bOre\\b', 'Logs'],
    ['Room on the ingot pallet', 'Room at the coal stand by the road'], ['ingot pallet', 'coal stand by the road'], ['[Pp]allet full', m => m[0] === 'P' ? 'Coal stand full' : 'coal stand full'], ['on the pallet', 'at the coal stand'], ['\\bpallet\\b', 'coal stand'],
    ['Ingots on the rack', 'Coal on the shelf'], ['rack full', 'shelf full'], ['\\brack\\b', 'shelf'],
    ['Haul ingots', 'Haul coal'], ['Fetching ingots', 'Fetching coal'], ['An ingot sells for', 'Coal sells for'], ['\\bAn ingot\\b', 'A lump of coal'], ['\\ban ingot\\b', 'a lump of coal'],
    ['\\bIngots\\b', 'Coal'], ['\\bingots\\b', 'coal'], ['\\bingot\\b', 'coal'], ['\\bIngot\\b', 'Coal'],
    [' / metal', ' / log'], ['\\b1 metal\\b', '1 log'], ['\\bmetal\\b', 'logs'], ['\\bMetal\\b', 'Logs'],
  ];
  // V15: the honey side only once the beehive has become the ant hill (robot ants cut mushrooms, the ant hill sorts them,
  // robots can them; gift wrapping is D.O.P. certifying); game.js applies these first
  const ANT_PHRASES = [
    // the honey side: robot ants cut mushrooms, the ant hill sorts them, robots can them
    ['nectar a sip', 'mushrooms a cut'], ['% flowers', '% mushroom patches'], ['honey crate', 'mushroom crate'],
    ['[Rr]obot beehive', m => m[0] === 'R' ? 'Robotic ant hill' : 'robotic ant hill'], ['\\bbeehive\\b', 'ant hill'], ['\\bBeehive\\b', 'Ant hill'],
    ['Bigger nectar tank', 'Bigger larder'], ['Nectar in the tank', 'Fresh mushrooms in the larder'], ['[Nn]ectar tank', m => m[0] === 'N' ? 'Larder' : 'larder'], ['nectar full', 'larder full'],
    ['tank or store step', 'larder or chamber step'], ['adds a hive floor, and each floor makes honey', 'adds a chamber, and each chamber sorts mushrooms'],
    ['Nectar the hive can hold', 'Fresh mushrooms the larder can hold'], ['adds a hive floor \\(more honey a minute\\)', 'adds a chamber to the ant hill (more mushrooms sorted a minute)'],
    ['\\+1 floor', '+1 chamber'], ['Bigger honey store', 'More sorting chambers'], ['[Hh]oney store', m => m[0] === 'H' ? 'Sorting chambers' : 'sorting chambers'], ['honey full', 'store full'],
    ['\\btank\\b', 'larder'], ['Fancy honey labels', 'Gourmet labels'], ['Honey labels', 'Gourmet labels'],
    // V15: canned mushrooms, and D.O.P. certification instead of gift wrapping
    ['Adds the Wrap task: a Robot ties a cloth top and a ribbon on a jar so it sells as a gift jar. Wrapping takes almost as long as filling the jar.', 'Adds the Certify task: a Robot checks a can of mushrooms and seals it as D.O.P. (protected designation of origin), so it sells for a lot more. Certifying takes almost as long as canning.'],
    ['Gift ribbons', 'D.O.P. seals'], ['Gift wrapping at the crate', 'D.O.P. certifying at the crate'], ['Gift wrapping', 'D.O.P. certification'], ['Wrap gift jars', 'Certify D.O.P. cans'], ['Wrapping a gift jar', 'Certifying a can'], ['Wrapping gift jars', 'Certifying cans'],
    ['will wrap gift jars', 'will certify the cans'], ['Keep for wrapping', 'Keep for certifying'], ['so they can be wrapped first', 'so they can be certified first'], ['fills and wraps jars', 'cans and certifies mushrooms'],
    ['gift wrapping', 'D.O.P. certifying'], ['\\bWrappers\\b', 'Certifiers'], ['\\bWrap\\b', 'Certify'], ['\\bwrapping\\b', 'certifying'], ['\\bwrap\\b', 'certify'],
    ['Gift jar ribbons', 'Gold D.O.P. seals'], ['[Gg]ift jars', m => m[0] === 'G' ? 'D.O.P. cans' : 'D.O.P. cans'], ['[Gg]ift jar', m => m[0] === 'G' ? 'D.O.P. can' : 'D.O.P. can'],
    ['Fill honey jars', 'Can mushrooms'], ['Jars of honey the hive and crate can hold', 'Cans’ worth of sorted mushrooms the ant hill and crate can hold'],
    ['A jar of honey', 'A can of mushrooms'], ['a jar of honey', 'a can of mushrooms'], ['honey jars', 'cans'], ['ties a cloth top and a ribbon on a jar', 'seals a can as D.O.P.'], ['Fillers', 'Canners'], ['[Ff]illing', m => m[0] === 'F' ? 'Canning' : 'canning'],
    ['Honey in the hive, waiting to be jarred', 'Sorted mushrooms in the ant hill, waiting to be packed'], ['honey making', 'sorting'], ['turns nectar into honey', 'sorts mushrooms'],
    ['\\bJars\\b', 'Cans'], ['\\bjars\\b', 'cans'], ['\\bjar\\b', 'can'], ['\\bJar\\b', 'Can'], ['\\bHoney\\b', 'Can'], ['\\bhoney\\b', 'mushrooms'],
    ['honey crate', 'mushroom crate'], ['\\bnectar\\b', 'mushrooms'], ['\\bNectar\\b', 'Mushrooms'],
    ['Quicker wings', 'Springy legs'], ['Long tongues', 'Sharp mandibles'], ['Faster fanning', 'Faster sorting'], ['Better recipe', 'Tight packing'],
    ['Bees fly', 'Ants walk'], ['so more bees fly further out', 'so more ants walk further out'], ['Bees take <b>5 nectar</b> from each flower', 'Ants cut <b>5 mushrooms</b> from each patch'],
    ['Each bee sips from', 'Each ant cuts from'], ['a bee sips them', 'an ant cuts them'], ['Every flower is being sipped', 'Every patch is being cut'], ['nectar a sip', 'mushrooms a cut'],
    ['bring nectar from the flowers, the hive makes honey, and the truck buys the jars', 'cut mushrooms from the patches, the ant hill sorts them, Robots can them, and the truck buys the cans'],
    ['\\bBees\\b', 'Ants'], ['\\bbees\\b', 'ants'], ['\\bBee\\b', 'Ant'], ['\\bbee\\b', 'ant'], ['\\ba ant\\b', 'an ant'], ['\\bA ant\\b', 'An ant'],
    ['\\bhives\\b', 'ant hills'], ['\\bhive\\b', 'ant hill'], ['\\bHive\\b', 'Ant hill'],
    ['[Dd]eadhead spent flowers', m => m[0] === 'D' ? 'Trim cut mushroom patches' : 'trim cut mushroom patches'], ['can deadhead flowers', 'can trim mushroom patches'],
    ['Deadhead flowers', 'Trim mushrooms'], ['Deadheading', 'Trimming'], ['Deadheads', 'Trims'], ['deadhead', 'trim'], ['\\bSnip\\b', 'Trim'],
    ['Flowers bloom again', 'Mushrooms grow back'], ['\\bbloom again\\b', 'grow back'], ['more flowers for the bees', 'more mushroom patches for the ants'], ['leaves and flowers', 'leaves and mushroom patches'],
    ['\\bFlowers\\b', 'Mushrooms'], ['\\bflowers\\b', 'patches'], ['\\bflower\\b', 'patch'], ['\\bsipped\\b', 'cut'],
  ];

  // ── a few robots here keep an umbrella on their heads (their looks are otherwise the same everywhere)
  const styles = {
    1: { brolly:'#e2b33a', blurb:'Slim and quick. Rebuilt from a lawnmower and a toaster. Never goes out without its yellow umbrella.' },
    3: { brolly:'patch',   blurb:'Patched together from three other Robots, umbrella included. Rough, but it works.' },
    4: { brolly:'#8a5aa0', blurb:'Round, polished, and a little proud of its plum umbrella.' },
    7: { brolly:'leaf',    blurb:'A garden bot gone a bit wild: moss on its belt, and a big leaf held up against the rain.' },
    8: { brolly:'#3f8a7a', blurb:'A copper-plated head, green at the seams, kept dry under a teal umbrella.' },
  };
  const taskCols = { mine:'#6e4a30', jar:'#c99448' };

  // ── rain-themed versions of the prairie's flower upgrades (a "Rain and mushrooms" section in the workshop)
  const GEN = {
    // V32: a short local economy cannot repay the home yard's long-term prices. Basket plans stays cheap in both.
    oil:      { cost:[700] },
    cutting:  { cost:[900] },
    market:   { cost:[700, 1500, 2800] },
    charm:    { cost:[1500] },
    press:    { name:'Leaf mould deal',  max:3, cost:[250, 700, 1500], desc:l=>'The compost yard pays <b>'+(15*(l+1))+'%</b> more for dry leaves.' },
    // V19.3: one step that sows two tiers of extra patches (+80%; was 3 steps of +40%)
    seeding:  { name:'Spore scattering', max:1, tiers:2, cost:[1200], needs:()=>H.S.hive.built && !H.hiveGrounded(), desc:()=>'Sow <b>80%</b> more mushroom patches for the ants on all your land.' },
    clover:   { name:'Mossy mulch',      max:2, cost:[900, 4000], needs:()=>H.S.hive.built && !H.hiveGrounded(), desc:l=>'Mushrooms grow back <b>'+(30*(l+1))+'%</b> sooner after an ant cuts them.' },
  };
  const GEN_ICON = { press:'press', seeding:'seed', clover:'clover' };
  const GEN_SHORT = { press: l => '+' + 15*(l + 1) + '% for leaves', seeding: () => '+80% mushroom patches', clover: l => 'Mushrooms regrow ' + 30*(l + 1) + '% sooner' };

  // ── icons for wet wood, dry bundles, mushrooms, ants and umbrellas instead of the metal, honey and bee ones
  const ICON = {
    bag: '<path d="M-3.4,-2 L-2.6,-4.6 L-.4,-3.2 L.8,-5 L2.2,-3.4 L3.4,-4.2 L3.6,-2Z" fill="#d9822e"/><path d="M-3.8,-2.6 H3.8 L4.4,4.6 Q0,5.4 -4.4,4.6Z" fill="#b58a56"/><path d="M-3.8,-2.6 H.4 L.6,5 Q-2,5.2 -4.4,4.6Z" fill="#c99d66"/><rect x="-4.2" y="-3.4" width="8.4" height="1.8" rx=".7" fill="#a77a48"/><path d="M-4.3,.4 H4.3" stroke="#d9c08a" stroke-width=".7"/>',
    leaf:
 '<path d="M0,-5 C3,-3.5 3,2.5 0,4 C-3,2.5 -3,-3.5 0,-5Z" fill="#c24a22"/><path d="M0,-3.6V4.6" stroke="#7a2a12" stroke-width=".8"/><ellipse cx="-1" cy="-1.6" rx=".6" ry="1.4" fill="#fff" opacity=".3"/>',
    seed: '<rect x="-3.8" y="-5" width="7.6" height="10" rx=".8" fill="#efdfbd" stroke="#a8703a" stroke-width=".6"/><g fill="#8a5428"><circle cx="-1.4" cy="-2.4" r=".7"/><circle cx="1.2" cy="-1.6" r=".6"/><circle cx="-.4" cy=".2" r=".7"/><circle cx="1.6" cy="1.4" r=".5"/><circle cx="-1.6" cy="2.2" r=".6"/></g>',
    clover: '<path d="M-5,3.6 Q0,1.4 5,3.6 V5 H-5Z" fill="#5a3b26"/><g fill="#5d7a2e"><ellipse cx="-2.6" cy="2.6" rx="2" ry="1"/><ellipse cx="1.4" cy="2.2" rx="2.4" ry="1.1"/></g><path d="M-1,2 V-1.6 M2.4,1.8 V-.4" stroke="#efe6d2" stroke-width="1"/><path d="M-3.4,-1.2 A2.4,1.8 0 0 1 1.4,-1.2Z" fill="#c99448"/><path d="M.8,-.2 A1.6,1.3 0 0 1 4,-.2Z" fill="#c4281c"/>',
    press: '<path d="M-5,4.6 Q-5,.4 0,.4 Q5,.4 5,4.6Z" fill="#4a3424"/><g fill="#c24a22"><ellipse cx="-2" cy="-.8" rx="1.6" ry=".8" transform="rotate(-20 -2 -.8)"/><ellipse cx="1.8" cy="-1.6" rx="1.5" ry=".7" transform="rotate(25 1.8 -1.6)"/></g><ellipse cx="0" cy="-3.4" rx="1.4" ry=".7" fill="#d6922e"/><path d="M-4,3 H4" stroke="#6a4a30" stroke-width=".6"/>',
    twin: '<g transform="translate(-2.4,.6) scale(.62)"><path d="M-6,4 Q-5,-5 0,-5 Q5,-5 6,4Z" fill="#5a4128"/><path d="M-1.8,4 A1.8,2 0 0 1 1.8,4Z" fill="#ffb347"/></g><g transform="translate(2.6,-.4) scale(.62)"><path d="M-6,4 Q-5,-5 0,-5 Q5,-5 6,4Z" fill="#6e5236"/><path d="M-1.8,4 A1.8,2 0 0 1 1.8,4Z" fill="#ffb347"/></g>',
    ore: '<rect x="-5" y="-2.6" width="8.6" height="5.4" rx="2.6" fill="#4c3828"/><ellipse cx="3.6" cy=".1" rx="1.8" ry="2.7" fill="#9a7448"/><ellipse cx="3.6" cy=".1" rx=".8" ry="1.3" fill="none" stroke="#5a3b24" stroke-width=".5"/><ellipse cx="-2" cy="-2.2" rx="1.8" ry=".6" fill="#5d7a2e"/><path d="M-4,-1.4 H1" stroke="#cfe0ec" stroke-width=".5" opacity=".6"/>',
    ingot: '<path d="M-4.4,-1.6 H4.4 L4.9,4.4 Q0,5.4 -4.9,4.4Z" fill="#9c7a4c"/><path d="M-4.4,-1.6 H.4 L.6,4.9 Q-2,5.2 -4.9,4.4Z" fill="#b48e5c"/><ellipse cy="-2" rx="4.4" ry="1.6" fill="#1a1716"/><g fill="#2a2624"><circle cx="-2.4" cy="-3" r="1.5"/><circle cx=".4" cy="-3.8" r="1.7"/><circle cx="2.6" cy="-2.8" r="1.3"/></g><circle cx="-.2" cy="-4.4" r=".5" fill="#b9c2c6" opacity=".6"/><rect x="-4.7" y="-2.4" width="9.4" height="1.2" rx=".5" fill="#86663e"/>',
    gold: '<path d="M-4.4,-1.6 H4.4 L4.9,4.4 Q0,5.4 -4.9,4.4Z" fill="#9c7a4c"/><path d="M-4.4,-1.6 H.4 L.6,4.9 Q-2,5.2 -4.9,4.4Z" fill="#b48e5c"/><g fill="#1f1c1b"><rect x="-4" y="-4.4" width="2.6" height="2" rx=".4"/><rect x="-1.2" y="-4.6" width="2.6" height="2" rx=".4"/><rect x="1.6" y="-4.4" width="2.6" height="2" rx=".4"/></g><rect x="-4.7" y="-2.4" width="9.4" height="1.2" rx=".5" fill="#86663e"/><rect x="1.2" y=".2" width="2.8" height="2" rx=".4" fill="#e2b13a"/>',
    drill: '<path d="M-5,2 Q0,-6 5,2" stroke="#7a5236" stroke-width="1.2" fill="none"/><rect x="-5" y="1.4" width="10" height="1.4" fill="#b9c2c6"/><path d="M-4.4,2.8 L-3.8,4 L-3.2,2.8 M-2.2,2.8 L-1.6,4 L-1,2.8 M0,2.8 L.6,4 L1.2,2.8 M2.2,2.8 L2.8,4 L3.4,2.8" stroke="#6c7378" stroke-width=".6" fill="none"/>',
    magnet: '<path d="M-1.6,-5 H1.6 L.6,4.6 H-.6Z" fill="#8f979b"/><path d="M-1.6,-5 H1.6 V-3.4 H-1.6Z" fill="#c3cbd0"/><path d="M-5,4.6 H-1 M1,4.6 H5" stroke="#9a7448" stroke-width="2"/><path d="M-1,-1 L-3.6,-3 M1,-1 L3.6,-3" stroke="#e6c48a" stroke-width=".7"/>',
    dig: '<path d="M-5.2,3.6 Q0,1.4 5.2,3.6" stroke="#4c3828" stroke-width="2.4" fill="none"/><path d="M-3,0 Q-1.6,-2.4 0,-1 Q1.4,.4 2.8,-1.8 M-2,-2.6 Q-.6,-5 1,-3.6 Q2.4,-2.2 3.8,-4.4" stroke="#cfdbe4" stroke-width=".8" fill="none" stroke-linecap="round"/>',
    stoke: '<path d="M-5,-1 L1,-3.4 L1,1.4 Z" fill="#8a6040"/><rect x="1.4" y="-2" width="4.2" height="6" rx=".8" fill="#2f2a26"/><rect x="2.4" y="-.4" width="2.2" height="2.4" fill="#ff9b3d"/>',
    flame: '<rect x="-4.2" y="-2.4" width="8.4" height="6.6" rx="1" fill="#2f2a26"/><rect x="-2.6" y="-.8" width="5.2" height="3.6" rx=".8" fill="#ff9b3d"/><path d="M2,-2.4 V-5" stroke="#2f2a26" stroke-width="1.4"/><circle cx="2.6" cy="-5.4" r="1" fill="#9aa4aa" opacity=".6"/>',
    haul: '<circle cx="-2.8" cy="4" r="1.2" fill="#4a423b"/><circle cx="2.8" cy="4" r="1.2" fill="#4a423b"/><path d="M-5,3 H5 L4,0 H-4Z" fill="#6e4a30"/><g fill="#e2bb84"><rect x="-3.6" y="-2.4" width="2.8" height="2.4" rx=".4"/><rect x="-.2" y="-2.4" width="2.8" height="2.4" rx=".4"/><rect x="-1.9" y="-4.6" width="2.8" height="2.4" rx=".4"/></g>',
    tub: '<path d="M-5.6,-3 H5.6 L4.6,-5 H-4.6Z" fill="#4a3a30"/><rect x="-4.6" y="-3" width="9.2" height="8" fill="#2a1f17"/><g fill="#8a6642"><circle cx="-2.4" cy="3" r="1.4"/><circle cx=".4" cy="3" r="1.4"/><circle cx="3" cy="3" r="1.3"/><circle cx="-1" cy=".4" r="1.4"/><circle cx="1.8" cy=".4" r="1.3"/></g><path d="M-4.8,4.6 H4.8 M-4.8,-2.8 H4.8" stroke="#7a5434" stroke-width="1"/>',
    hopper: '<path d="M-5.4,-3 L5.4,-3 L4.6,-4.6 L-4.6,-4.6Z" fill="#3d332c"/><g fill="#5e4430"><circle cx="-2.6" cy="2.6" r="1.6"/><circle cx=".6" cy="2.6" r="1.6"/><circle cx="3.6" cy="2.8" r="1.4"/><circle cx="-1" cy="-.2" r="1.6"/><circle cx="2.2" cy="-.2" r="1.5"/></g><g fill="#c99a62"><circle cx="-2.6" cy="2.6" r=".9"/><circle cx=".6" cy="2.6" r=".9"/><circle cx="-1" cy="-.2" r=".9"/><circle cx="2.2" cy="-.2" r=".8"/></g>',
    pallet: '<path d="M-6,-2.4 H6 L5,-5 H-5Z" fill="#2f2a28"/><rect x="-5" y="-2.4" width="10" height="7" fill="#3e332c"/><g fill="#9c7a4c"><rect x="-4.2" y="1.4" width="2.6" height="3" rx=".6"/><rect x="-1.3" y="1.4" width="2.6" height="3" rx=".6"/><rect x="1.6" y="1.4" width="2.6" height="3" rx=".6"/></g><g fill="#1a1716"><circle cx="-2.9" cy="1.4" r=".9"/><circle cx="0" cy="1.4" r=".9"/><circle cx="2.9" cy="1.4" r=".9"/></g><rect x="-2.6" y="-1.8" width="5.2" height="2" rx=".4" fill="#2a3330"/>',
    drop: '<path d="M0,-5 C2.6,-1.6 3.8,.6 3.8,2 A3.8,3.8 0 0 1 -3.8,2 C-3.8,.6 -2.6,-1.6 0,-5Z" fill="#6a8a3a"/><path d="M-1.6,1 A1.6,1.6 0 0 0 0,3" stroke="#d6e8b0" stroke-width=".8" fill="none"/>',
    horseshoe: '<path d="M-4,4.6 L2.4,-3.4" stroke="#7a5236" stroke-width="1.4" stroke-linecap="round"/><path d="M.6,-5.4 Q5,-5.6 5.4,-1.2 L2.6,-1.6 Q2.4,-3.4 .4,-3.2Z" fill="#9aa4aa"/><path d="M2.6,-1.6 L5.4,-1.2" stroke="#e6ecef" stroke-width=".5"/><circle cx="-3.6" cy="-2.6" r="1.2" fill="#5d7a2e"/><path d="M-3.6,-3.8 V-1.4 M-4.8,-2.6 H-2.4" stroke="#8ab04a" stroke-width=".5"/>',
    vein: '<g><rect x="-5.4" y="1" width="8" height="3.6" rx="1.8" fill="#3a2a1e"/><ellipse cx="2.6" cy="2.8" rx="1.2" ry="1.8" fill="#8e6a44"/><rect x="-3.6" y="-2.2" width="7.6" height="3.4" rx="1.7" fill="#4c3828"/><ellipse cx="4" cy="-.5" rx="1.1" ry="1.7" fill="#8e6a44"/><rect x="-4.2" y="-5" width="6" height="3" rx="1.5" fill="#3a2a1e"/><ellipse cx="1.8" cy="-3.5" rx="1" ry="1.5" fill="#8e6a44"/><ellipse cx="-2" cy="-1.8" rx="1.6" ry=".5" fill="#5d7a2e"/></g>',
    shaft: '<path d="M-6,-2 L5.6,-4.4 L6,-2.8 L-5.6,-.4Z" fill="#3d332c"/><path d="M-4.6,-1 V5 M4.4,-3 V5" stroke="#5a3b26" stroke-width="1.2"/><g fill="#4c3828"><rect x="-3.4" y="2.4" width="6" height="2.4" rx="1.2"/><rect x="-2.6" y=".2" width="5" height="2.2" rx="1.1"/></g><ellipse cx="2.6" cy="3.6" rx=".7" ry="1.1" fill="#8e6a44"/>',
    slag: '<g fill="#1f1c1b"><rect x="-5" y="1.6" width="3.2" height="2.6" rx=".4"/><rect x="-1.6" y="1.6" width="3.2" height="2.6" rx=".4"/><rect x="1.8" y="1.6" width="3.2" height="2.6" rx=".4"/><rect x="-3.3" y="-1.2" width="3.2" height="2.6" rx=".4"/><rect x=".1" y="-1.2" width="3.2" height="2.6" rx=".4"/><rect x="-1.6" y="-4" width="3.2" height="2.6" rx=".4"/></g><path d="M3.6,-5 V-2.2 M2.2,-3.6 H5" stroke="#5f8c3a" stroke-width="1"/>',
    brolly: '<path d="M0,-1 V3.6 Q0,5 -1.4,5 Q-2.4,5 -2.4,4" stroke="#6e4a30" stroke-width="1" fill="none" stroke-linecap="round"/><path d="M-5.6,-.4 Q-5.4,-5.6 0,-5.6 Q5.4,-5.6 5.6,-.4 Q4.6,-1.4 3.8,-.4 Q2.8,-1.6 1.8,-.4 Q.9,-1.6 0,-.4 Q-.9,-1.6 -1.8,-.4 Q-2.8,-1.6 -3.8,-.4 Q-4.6,-1.4 -5.6,-.4Z" fill="#3f6a8a"/><path d="M0,-5.6 Q-1.6,-3 -1.8,-.4 M0,-5.6 Q1.6,-3 1.8,-.4" stroke="#7a5236" stroke-width=".45" fill="none"/>',
    wet: '<path d="M0,-5 C2.6,-1.6 3.8,.6 3.8,2 A3.8,3.8 0 0 1 -3.8,2 C-3.8,.6 -2.6,-1.6 0,-5Z" fill="#6aa4d0"/><path d="M-1.6,1 A1.6,1.6 0 0 0 0,3" stroke="#e6f2fa" stroke-width=".8" fill="none"/>',
  };
  // V15: the bee and honey icons turn into ant and mushroom ones once the beehive has become the ant hill (game.js applyLotIcons)
  const ANT_ICON = {
    jar: '<path d="M-3.6,-3.8 H3.6 V4 A3.6,1 0 0 1 -3.6,4Z" fill="#aab4b9"/><ellipse cy="-3.8" rx="3.6" ry="1.1" fill="#d6dde0"/><rect x="-3.6" y="-2" width="7.2" height="4.4" fill="#efe3c4"/><path d="M-1.9,1 A1.9,1.6 0 0 1 1.9,1Z" fill="#c4281c"/><rect x="-.4" y="1" width=".8" height="1.1" fill="#efe9dc"/>',
    wrap: '<path d="M-1.6,1.4 L-2.8,5 L-1,4 L0,5.4 L.4,1.6Z M1.6,1.4 L2.8,5 L1,4 L0,5.4 L-.4,1.6Z" fill="#7a2018"/><circle r="3.6" cy="-.6" fill="#b8392a"/><circle r="2.6" cy="-.6" fill="none" stroke="#f2d8a8" stroke-width=".5"/><path d="M-1.2,-.6 L-.3,.4 L1.4,-1.6" stroke="#fff6e0" stroke-width=".8" fill="none" stroke-linecap="round"/>',
    gift: '<path d="M-3.6,-3.8 H3.6 V4 A3.6,1 0 0 1 -3.6,4Z" fill="#aab4b9"/><ellipse cy="-3.8" rx="3.6" ry="1.1" fill="#d6dde0"/><rect x="-3.6" y="-2" width="7.2" height="4.4" fill="#efe3c4"/><path d="M-1.9,1 A1.9,1.6 0 0 1 1.9,1Z" fill="#c4281c"/><rect x="-.4" y="1" width=".8" height="1.1" fill="#efe9dc"/><rect x="-3.6" y="2.6" width="7.2" height="1.1" fill="#b8392a"/><circle cx="2.4" cy=".2" r="1.9" fill="#e2b13a" stroke="#a87a1c" stroke-width=".4"/>',
    bee: '<path d="M-1.6,1 L-3,4.6 M0,1.2 L0,4.8 M1.6,1 L3,4.6" stroke="#4a3226" stroke-width=".6" fill="none"/><ellipse cx="-2.8" cy="0" rx="2.6" ry="2" fill="#8a4f2a"/><ellipse cx="-3" cy="-.5" rx="2" ry="1.2" fill="#b86a38"/><ellipse cx=".3" cy="-.2" rx="1.2" ry="1" fill="#7a4424"/><ellipse cx="2.8" cy="-.6" rx="1.8" ry="1.6" fill="#9a5a30"/><circle cx="3.3" cy="-.7" r=".7" fill="#ffc457"/><path d="M3.4,-2 Q4.4,-4.4 5.6,-4.6 M2.8,-2.1 Q3.2,-4.6 4.2,-5.4" stroke="#4a3226" stroke-width=".5" fill="none"/>',
    nectar: '<path d="M-1,1 L-1.3,5 H1.3 L1,1Z" fill="#efe9dc"/><path d="M-4.6,1.4 A4.6,4.4 0 0 1 4.6,1.4Z" fill="#c4281c"/><g fill="#fbf6ea"><circle cx="-2" cy="-1.2" r=".7"/><circle cx="1" cy="-2.2" r=".6"/><circle cx="2.4" cy="-.2" r=".5"/></g>',
    honey: '<g><path d="M-4.2,4.6 A2.6,2 0 0 1 .4,4.6Z" fill="#a8642e"/><path d="M-.4,4.6 A2.4,1.9 0 0 1 4.2,4.6Z" fill="#c99448"/><path d="M-2.6,1.4 A2.6,2 0 0 1 2.4,1.4Z" fill="#8a5428"/><path d="M-1.6,-1.6 A2.2,1.8 0 0 1 2.6,-1.6Z" fill="#e6a22a"/><path d="M-2.6,-4.2 A2,1.6 0 0 1 1.4,-4.2Z" fill="#c4281c"/></g>',
    snip: '<circle cx="-2.6" cy="3.1" r="1.8" fill="none" stroke="#6d777d" stroke-width="1.1"/><circle cx="2.6" cy="3.1" r="1.8" fill="none" stroke="#6d777d" stroke-width="1.1"/><path d="M-1.6,1.6 L2.6,-4.4 M1.6,1.6 L-2.6,-4.4" stroke="#8f979b" stroke-width="1.2"/><path d="M-5,-2 A1.4,1 0 0 1 -2.2,-2Z" fill="#c99448"/>',
    flower: '<path d="M-1,1 L-1.3,5 H1.3 L1,1Z" fill="#efe9dc"/><path d="M-4.6,1.4 A4.6,4.4 0 0 1 4.6,1.4Z" fill="#8a5428"/><ellipse cx="-1.6" cy="-1" rx="1.2" ry=".5" fill="#fff" opacity=".35"/>',
    wings: '<path d="M-3,1 L-5,4.6 M-1,1.2 L-1.6,5 M1.2,1.2 L1.8,5" stroke="#4a3226" stroke-width=".8"/><path d="M-3.2,1 L-5.4,-1 M1,1 L3.6,-.2" stroke="#4a3226" stroke-width=".8"/><ellipse cx="-1" cy="-.4" rx="3.2" ry="1.8" fill="#b86a38"/><path d="M2.6,-4.6 H5.4 M3.4,-3 H5.6 M2.8,-1.4 H5" stroke="#4f7c84" stroke-width=".7" stroke-linecap="round"/>',
    three: '<g fill="#efe9dc"><rect x="-4.3" y="0" width="1" height="3.6"/><rect x="-.5" y="-1.4" width="1" height="4.4"/><rect x="3.3" y="0" width="1" height="3.6"/></g><path d="M-5.8,.4 A2,1.6 0 0 1 -2.2,.4Z" fill="#c4281c"/><path d="M-2,-1 A2,1.7 0 0 1 2,-1Z" fill="#e6a22a"/><path d="M2.2,.4 A2,1.6 0 0 1 5.8,.4Z" fill="#8a5428"/>',
    tongue: '<ellipse cx="-1.4" cy="0" rx="2.6" ry="2.4" fill="#a84a2a"/><circle cx="-.6" cy="-.6" r=".8" fill="#ffc457"/><path d="M1,-1.4 Q4,-2.4 5,-.4 L3.6,0 Q3.2,-1.2 1.2,-.6Z M1,1.4 Q4,2.4 5,.4 L3.6,0 Q3.2,1.2 1.2,.6Z" fill="#c9a24a"/>',
    recipe: '<rect x="-4.6" y="-1" width="9.2" height="5.6" rx="1" fill="#a7783f"/><path d="M-4.6,1.6 H4.6 M-1.6,-1 V4.6 M1.6,-1 V4.6" stroke="#6e4a26" stroke-width=".5"/><path d="M-3.8,-1.2 A1.6,1.2 0 0 1 -.6,-1.2Z" fill="#c99448"/><path d="M.6,-1.2 A1.6,1.2 0 0 1 3.8,-1.2Z" fill="#e6a22a"/><path d="M-2,-3.6 A1.6,1.2 0 0 1 1.2,-3.6Z" fill="#8a5428"/>',
    nursery: '<ellipse cx="-1.8" cy="1.4" rx="2" ry="2.8" fill="#f4ecd8" stroke="#c9b48c" stroke-width=".5"/><ellipse cx="2" cy="1.8" rx="1.8" ry="2.5" fill="#f4ecd8" stroke="#c9b48c" stroke-width=".5"/><ellipse cx=".2" cy="-2.4" rx="1.6" ry="2.2" fill="#f4ecd8" stroke="#c9b48c" stroke-width=".5"/><circle cx="-2.4" cy=".4" r=".6" fill="#ffc457"/>',
  };

  return {
    id: 'hollow', name: 'Rainy hollow', phrases: PHRASES,
    AREAS, SPOTS, TREES, BUSHES, PLANT, PUDDLES, ROW,
    MINE_LAND: 0, PLANT_LAND: 0,
    landForSale: false,   // the yard never grows
    // V17: no drying shed any more: the charcoal kiln takes its place once the robots know coal (the fire story, game.js
    // FIRE_STORY), so dry bundles (and the wood umbrella that kept them dry) are gone too
    plantOpen: false,
    rain: true,           // rain, puddles, mist and warm lights (game.js)
    wetWood: false,
    fireStory: true, fireTree: 12, plantCost: 1200,   // V32.1: was 400
    dryBench: true,       // V15: the leaves are too wet to sell: the bagging table is a drying bench (from the start), worked by blowers
    LEAFC, FOLIAGE, TREE_FAMS, leafSheen: true, leafFall: { vy: [34, 54], sw: [9, 20] },
    FLOWER_TYPES, FLOWER_N: [22, 30, 95], decoN: [110, 150, 320], decoTypes: MUSH_DECO.length,
    flowerPlace: { k: [2, 3], kDeco: [2, 4], d: [12, 22], dDeco: [6, 16], clash: [13, 8], s: [0.95, 0.3], sDeco: [0.7, 0.45] },
    paintGround, drawBush, drawFence, drawRockBed, paintCanopy, paintVignette,
    bg: '#4a3c2a',
    HV: { plinth: 12, fh: 11, r: 21, k: 0.32, lift: 12 },   // the ant hill's height (a chamber per "floor"; V15: it sits on the old beehive's base, lift)
    hiveWide: true,                              // the ant hill is wider than the beehive tower (hit box, falling leaves)
    antsOnGround: true,
    antSpeed: 0.7,                               // V14.1: ants walk at 70% of a bee's speed (and round things, on their trails)                          // the ants walk under the tree crowns, not over them
    hiveKnown: true,                             // the beehive can be built from the start
    hiveStory: true,                             // V15: it's a plain beehive whose bees can't fly in the rain, until the robots research it into the ant hill
    art: { genProps, flowerSprite, drawFlower, drawDeco, bloomOf, drawJar, drawGiftJar, drawHive, drawBees, drawTub, logEnd, nugget, drawIngot, drawPallet, drawPlant,
      drawShaft, drawMiner, drawSpotGlints, shedExtra, sawArm, robotBrolly, woodUmbrella: drawWoodUmbrella, PAY_COL, payFill, flyHoney, drawBagger, drawLeafBag, drawHiveLab, drawLabBee, drawAnt,
      popCol: { metal: '#e6c89a', ingot: '#f2d8a8' } },
    styles, taskCols,
    // V19: what every task is called here, on its chip and in its tooltip (said in full, not run through PHRASES' guesses)
    tasks: {
      leaves: { name: 'Gather wet leaves into the bin', short: 'Gather leaves' },
      mine:   { name: 'Saw logs at the wood pile', short: 'Saw logs' },
      bag:    { name: 'Dry leaves at the drying bench', short: 'Dry leaves' },
      jar:    { name: 'Can mushrooms at the crate', short: 'Can mushrooms' },
      wrap:   { name: 'Certify cans as D.O.P.', short: 'Certify D.O.P. cans' },
      smelt:  { name: 'Burn logs into charcoal at the kiln', short: 'Burn charcoal' },
      fuel:   { name: 'Fuel the leaf dryer with logs from the crib', short: 'Fuel the leaf dryer' },
      haul:   { name: 'Haul finished charcoal to the coal stand by the road', short: 'Haul finished charcoal' },
      blow:   { name: 'Blow leaves toward the bin', short: 'Blow leaves' },
      dig:    { name: 'Dry the woodpile at a shelter (faster sawing)', short: 'Dry woodpile' },
      stoke:  { name: 'Work the charcoal kiln bellows (faster burning)', short: 'Charcoal kiln bellows' },
      shake:  { name: 'Shake trees and bushes for leaves', short: 'Shake trees' },
      snip:   { name: 'Trim cut mushroom patches so they grow back sooner', short: 'Trim mushrooms' },
    },
    trackLabels: { dig: 'Woodpile drying', stoke: 'Kiln bellows' },
    trackTips: { dig: 'Faster sawing at a shelter while it dries the woodpile there', stoke: 'Faster charcoal burning while it works the kiln bellows' },
    GEN, GEN_ICON, GEN_SHORT, genSection: { title: 'Rain and mushrooms', keys: ['press', 'seeding', 'clover'] },
    ICON, antICON: ANT_ICON, antPhrases: ANT_PHRASES,
    // story: the crew rides home without a cash bonus
    tripHome: { earned: 0 },
    // V16: making mushrooms worth more shouldn't explode in price: Gourmet labels climb slowly to ~$900 (were $90 … 2,800,
    // the first yard's honey labels, which keep their prices), and the D.O.P. seals stay under that too (were $700 / 1,500)
    // V17: the charcoal kiln has fewer, cheaper upgrades than the smelting plant: a hotter kiln, briquettes (coal worth more),
    // tight stacking (more coal from the same logs) and a bigger log stack
    // V19: Sort the logs has 3 bigger steps for much less (was the first yard's 6 steps to $16.50 for $40 … 6,000): a log goes
    // $4.80 → 6.50 → 9 → 12 for $50 / 250 / 1,000, so $9 costs $300 (was ~$520 for $9.20) and the top is lower
    UP: { cleanup: { costs: [150, 700, 1500] },
      pallet: { name: 'Bigger coal pallets', max: 4, costs: [480, 660, 900, 1200], vals: [32, 56, 92, 140, 200], show: v => v + ' coal per pallet' },
      honeyPrice: { costs: [80, 130, 190, 270, 420, 650] }, giftPrice: { costs: [400, 800] },
      metalPrice: { max: 3, gaps: [], costs: [300, 600, 1100], vals: [4.8, 6.5, 9, 12] },
      smeltSpeed: { name: 'Hotter kiln', max: 2, costs: [300, 840], vals: [1, 1.35, 1.8] },
      ingotGrade: { name: 'Briquettes', max: 3, costs: [240, 600, 1140], vals: [1, 1.25, 1.5, 1.8] },
      slag: { name: 'Tight stacking', max: 2, costs: [360, 960], vals: [0, 0.2, 0.4] },
      hopper: { name: 'Bigger log stack', max: 2, costs: [60, 180], vals: [16, 30, 50] } },
    // V15: the leaves here are too wet to sell; the blower that came along can learn to dry them at the bench
    // (V28: a fresh start with nothing; the first truck saying no to the wet leaves opens the drying research)
    arrive: { title: 'The Rainy hollow', text: (name, names) => (names && names.length > 1 ? name + ' and ' + names[1] : name) + ' made it. Pick up leaves and get this yard up and running.' },
  };
};
LOTS.hollow.title = 'the Rainy hollow';   // what the game calls it before it's loaded ("Off to the Rainy hollow…")
})();
