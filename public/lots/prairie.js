// AutumNation: the Wildflower prairie, the second lot (V13).
// The truck driver brings a letter once the first yard has earned $900: "We found another spot that could use some
// cleanup". A robot rides over in the back of the truck and starts again here, keeping its own upgrades, every robot
// unlock, the truck schedule and the cleanup program. Everything else starts over.
//
// A lot file only describes what's different about a place: its layout, its look, its words and a few upgrades of its
// own. game.js calls LOTS.<id>(H) once at startup, before anything else exists, so nothing in here may touch H until
// one of these functions is actually called (by then H holds the game's helpers: ell, rr, drawLeaf, FOLIAGE, ...).
// This started life as public/location2 (a test copy of the whole game); everything here comes from it, minus the test
// slider and the Twin hive.
(function(){
'use strict';
const LOTS = window.LOTS = window.LOTS || {};

LOTS.prairie = H => {
  // ── what you call things here: the "leaves" are mostly flower petals
  const words = { leaf:'petal', leaves:'petals', Leaf:'Petal', Leaves:'Petals', LEAVES:'PETALS' };

  // ── the same three sizes of land, a prairie's worth of names
  const AREAS = [
    { w: 580,  h: 380,  name: 'Prairie patch',     spawn: 1.0, cap: 60 },
    { w: 1280, h: 720,  name: 'Wildflower meadow', spawn: 2.8, cap: 220, cost: 300 },
    { w: 2000, h: 1150, name: 'Blossom hills',     spawn: 5.6, cap: 380, cost: 3800 },
  ];
  // no metal on the first plot: one vein in the whole place, out in the meadow, so mining waits for more land
  const SPOTS = [ { x: 425, y: -175, land: 1, rich: 1 } ];
  // blooming cherries; the meadow's trees moved up and right to make room for the smelting plant, and with no metal on
  // the first plot there's room for a third little tree on the right
  const TREES = [
    { x: -230, y: -530, r: 118, seed: 11 }, { x: 352, y: -472, r: 150, seed: 23 }, { x: 95, y: -590, r: 118, seed: 37 },
    { x: -770, y: -820, r: 190, seed: 41 }, { x: 770, y: -770, r: 185, seed: 53 }, { x: -90, y: -905, r: 170, seed: 61 },
    { x: -1130, y: -330, r: 190, seed: 71 }, { x: 1140, y: -1060, r: 200, seed: 83 }, { x: -560, y: -1310, r: 190, seed: 97 },
    { x: 560, y: -1335, r: 180, seed: 101 }, { x: 1150, y: -330, r: 170, seed: 113 }, { x: -1180, y: -1060, r: 190, seed: 127 },
    { x: -30, y: -255, r: 62, seed: 131, fam: ['sakura','blush'] }, { x: -256, y: -208, r: 52, seed: 137, fam: ['blush','snow'] },
    { x: 168, y: -272, r: 56, seed: 139, fam: ['magenta','sakura'] },
    // V19.3: one more pink cherry outside the fence on the right, to fill the space there
    { x: 590, y: -205, r: 100, seed: 149, fam: ['sakura','blush'] },
  ];

  // ── petals: cherry pink, blush, lavender, buttercup, coral, with a few autumn leaves still drifting in (last three)
  const LEAFC = [
    { c:'#f4b3c6', v:'#d27f9b', w:.22, petal:true },
    { c:'#fde6ec', v:'#e2a9bb', w:.16, petal:true },
    { c:'#e8809f', v:'#b54f73', w:.13, petal:true },
    { c:'#c9b3ea', v:'#957ac4', w:.10, petal:true },
    { c:'#f7d56a', v:'#c99a2a', w:.10, petal:true },
    { c:'#f39a72', v:'#c4623e', w:.07, petal:true },
    { c:'#e07b2e', v:'#9a4d17', w:.12 },
    { c:'#c0392b', v:'#7f2318', w:.05 },
    { c:'#eaa23a', v:'#a8691b', w:.05 },
  ];

  // ── cherry blossom crowns (canopies with BLOSSOM families get branches and flowers instead of leaf texture)
  const FOLIAGE = {
    sakura: ['#7d3550','#b9587a','#e58fac','#f6bccd','#fde6ee'],
    blush:  ['#86506a','#c7849d','#efb8ca','#fbd9e4','#fff3f6'],
    snow:   ['#7f6f7a','#bfa9b5','#e6d6de','#f6eef2','#ffffff'],
    magenta:['#6e1f45','#a3346a','#d05a92','#ec8fba','#fbc3dc'],
    leafy:  ['#3f5a2a','#567a35','#74983f','#98b752','#c1d77a'],
  };
  const BLOSSOM = { sakura: true, blush: true, snow: true, magenta: true };
  // a couple show a little autumn colour, and one far tree has turned
  const TREE_FAMS = [['sakura','blush'],['blush','snow'],['sakura','snow'],['magenta','sakura'],['snow','blush'],['sakura','orange'],
                     ['blush','sakura'],['sakura','gold'],['snow','sakura'],['magenta','blush'],['blush','magenta'],['orange','gold']];

  // ── prairie flowers for the bees (instead of the autumn ones)
  const FLOWER_TYPES = [
    { name:'coneflower', h: 15, bud:'#b4688e' },
    { name:'susan',      h: 13, bud:'#c9a43a' },
    { name:'lupine',     h: 13, spike:true, bud:'#7a68c8', cols:['#4c3c96','#6c5abf','#9886dc','#c4b8f0'] },
    { name:'poppy',      h: 11, bud:'#b8452d' },
    { name:'cornflower', h: 12, bud:'#5a78c0' },
    { name:'daisy',      h: 11, bud:'#d9d3bf' },
    { name:'lupine',     h: 13, spike:true, bud:'#c9649c', cols:['#963a72','#c25a96','#e386b8','#f6bad8'] },
    { name:'paintbrush', h: 12, spike:true, bud:'#d9603a', cols:['#b8391e','#e0552e','#f27d45','#f7a86a'] },
    { name:'clover',     h: 7,  bud:'#c97a9a' },
  ];
  // stem colours: fresher greens, and a hint of the flower's colour in the bud
  const flowerStem = { shadow:'rgba(30,35,10,.2)', stem:'#4c7a2a', leaf:['#5d8a33', '#74a03e'], bud:'#6f9a3a', leafW: T => T.name === 'clover' ? 2.4 : 3.4 };
  function drawFlowerHead(q, T, rnd){
    const { ell, TAU } = H;
    const petals = (n, r0, rx, ry, cols, rot0) => { for (let k=0;k<n;k++){ q.save(); q.rotate(k/n*TAU + (rot0 || 0)); q.fillStyle = cols[k % cols.length]; ell(q, 0, -r0, rx, ry); q.fill(); q.restore(); } };
    if (T.name === 'coneflower'){
      // purple petals that hang down a little around a tall orange-brown cone
      q.save(); q.translate(0, 1.2); q.scale(1, 0.8); petals(12, 4.2, 1.15, 3.1, ['#c45c96', '#dc7fb2', '#b04f88']); q.restore();
      q.fillStyle = '#6e3415'; ell(q, 0, -0.4, 2.7, 2.5); q.fill();
      for (let k=0;k<14;k++){ const a = rnd()*TAU, d = Math.sqrt(rnd())*2.1; q.fillStyle = rnd() < .5 ? '#c0702a' : '#e09a3a'; ell(q, Math.cos(a)*d, -0.6 + Math.sin(a)*d, .45, .45); q.fill(); }
    } else if (T.name === 'susan'){
      petals(13, 3.6, 1.15, 2.7, ['#f2b81e', '#f8cd3e', '#e8a516']);
      q.fillStyle = '#3a2414'; ell(q, 0, 0, 2.2, 2.2); q.fill(); q.fillStyle = '#5c3a1e'; ell(q, -0.5, -0.5, 1, 1); q.fill();
    } else if (T.spike){
      // a spike of little florets, widest at the bottom
      const C = T.cols;
      for (let k=0;k<16;k++){
        const u = k/15, y = 4 - u*12, w = (1 - u)*2.2 + 0.7;
        q.fillStyle = C[Math.min(3, Math.floor(u*3.2 + rnd()*0.6))];
        ell(q, -w*0.6, y, w*0.62, 1.05); q.fill(); ell(q, w*0.6, y - 0.4, w*0.62, 1.05); q.fill();
      }
      q.fillStyle = C[3]; ell(q, 0, -8.6, 0.8, 1.2); q.fill();
    } else if (T.name === 'poppy'){
      petals(4, 2.4, 3.3, 3.2, ['#d93a28', '#ea5034', '#c9301f', '#f0603e'], 0.4);
      q.fillStyle = 'rgba(255,170,140,.35)'; ell(q, -1.4, -1.8, 1.8, 1.1); q.fill();
      q.fillStyle = '#2a1e1a'; ell(q, 0, 0, 1.6, 1.6); q.fill();
      q.strokeStyle = '#2a1e1a'; q.lineWidth = 0.4; for (let k=0;k<8;k++){ const a = k/8*TAU; q.beginPath(); q.moveTo(0, 0); q.lineTo(Math.cos(a)*2.6, Math.sin(a)*2.6); q.stroke(); }
    } else if (T.name === 'cornflower'){
      for (let k=0;k<9;k++){ q.save(); q.rotate(k/9*TAU); q.fillStyle = k % 2 ? '#4f7fd8' : '#6f9be8'; q.beginPath(); q.moveTo(0, -1); q.lineTo(-1.6, -4.6); q.lineTo(-0.8, -4); q.lineTo(0, -5); q.lineTo(0.8, -4); q.lineTo(1.6, -4.6); q.closePath(); q.fill(); q.restore(); }
      q.fillStyle = '#34397e'; ell(q, 0, 0, 1.5, 1.5); q.fill();
    } else if (T.name === 'daisy'){
      petals(16, 3.4, 0.95, 2.6, ['#fdfbf4', '#f1ece0']);
      q.fillStyle = '#f2c33a'; ell(q, 0, 0, 1.7, 1.7); q.fill(); q.fillStyle = '#d99a1e'; ell(q, 0.4, 0.4, 0.8, 0.8); q.fill();
    } else {
      // clover: a round pink-and-white ball of tiny florets
      for (let k=0;k<30;k++){ const a = rnd()*TAU, d = Math.sqrt(rnd())*2.9; q.fillStyle = ['#e6a0bc','#f3c6d8','#c97a9a','#fbe6ee'][Math.floor(rnd()*4)]; ell(q, Math.cos(a)*d, Math.sin(a)*d, 0.9, 0.9); q.fill(); }
    }
  }

  // ── the ground: a fresh green-gold prairie. The "grass" is mostly tiny flowers, with drifts of colour where they grow
  // thickest, clover, and lots of bigger wildflowers (DECO) painted in. Beyond the fence: tall golden grass, flower
  // spikes and flowering shrubs.
  const MICRO = [['#fdfaf1', .2], ['#f7d652', .3], ['#f3a8c4', .2], ['#c9b2ec', .16], ['#9fc4f2', .14]];
  const microCol = r => { for (const [c, w] of MICRO){ r -= w; if (r <= 0) return c; } return MICRO[0][0]; };
  function* paintGround(G){
    const { g, V, O, CS, i0, i1, j0, j1, inOwned } = G;
    const { ell, rr, TAU, cellRnd, drawLeaf, LEAFC, TREES, SPOTS, VERGE, ROAD, LANE, drawRockBed, drawBush, drawFence, FLOWER_TYPES, drawDecoFlowers } = H, flowerSpr = H.flowerSpr();
    const gr = g.createLinearGradient(0, V.y0, 0, 0);
    gr.addColorStop(0, '#68863a'); gr.addColorStop(0.6, '#769543'); gr.addColorStop(1, '#829f49');
    g.fillStyle = gr; g.fillRect(V.x0, V.y0, V.x1 - V.x0, -V.y0 + 2);
    const patch = ['#93ad55','#628a3c','#a9ac58','#7a9d46','#b7b266','#5d8240'];
    const glow = (x, y, r, col, a) => { const rg = g.createRadialGradient(x,y,0,x,y,r); rg.addColorStop(0, col + a); rg.addColorStop(1, col + '00'); g.fillStyle = rg; g.fillRect(x-r,y-r,r*2,r*2); };
    for (let i=i0;i<i1;i++) for (let j=j0;j<j1;j++){ yield;
      const rnd = cellRnd(i, j, 1);
      glow((i + rnd())*CS, (j + rnd())*CS, 60 + rnd()*120, patch[Math.floor(rnd()*patch.length)], '88');
      // drifts of colour where the little flowers grow thickest
      if (rnd() < 0.5){ const x = (i + rnd())*CS, y = (j + rnd())*CS, r = 40 + rnd()*90; if (y < -VERGE) glow(x, y, r, ['#c6a8e4','#f2abc6','#f4d76c','#ffffff','#a9c8f0'][Math.floor(rnd()*5)], '3a'); }
    }
    for (const t of TREES){ const x = t.x + t.r*0.22, y = t.y + t.r*0.5, r = t.r*1.12; const rg = g.createRadialGradient(x,y,r*0.2,x,y,r); rg.addColorStop(0,'rgba(30,40,25,.28)'); rg.addColorStop(1,'rgba(30,40,25,0)'); g.fillStyle = rg; g.fillRect(x-r,y-r,r*2,r*2); }
    g.lineCap = 'round';
    for (let i=i0;i<i1;i++) for (let j=j0;j<j1;j++){ yield;
      const rnd = cellRnd(i, j, 2);
      // a few blades of grass between the flowers
      for (let k=0;k<26;k++){
        const x = (i + rnd())*CS, y = (j + rnd())*CS, h = 3 + rnd()*5, lean = (rnd()-0.5)*3, tone = rnd();
        if (y > -VERGE) continue;
        g.strokeStyle = tone < 0.5 ? 'rgba(50,80,28,.42)' : 'rgba(176,196,96,.4)';
        g.lineWidth = 1.1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + lean, y - h); g.stroke();
      }
      // the tiny flowers: mostly single dots, some with five petals around a yellow eye
      for (let k=0;k<120;k++){
        const x = (i + rnd())*CS, y = (j + rnd())*CS, col = microCol(rnd()), r = 0.6 + rnd()*0.8, big = rnd() < 0.22;
        if (y > -VERGE - 1) continue;
        g.fillStyle = col;
        if (big){ for (let p=0;p<5;p++){ const a = p/5*TAU + r; ell(g, x + Math.cos(a)*r*1.05, y + Math.sin(a)*r*0.8, r*0.62, r*0.55); g.fill(); } g.fillStyle = col === '#f7d652' ? '#c98a2a' : '#f2c33a'; ell(g, x, y, r*0.42, r*0.36); g.fill(); }
        else { ell(g, x, y, r, r*0.8); g.fill(); }
      }
      // clover patches
      if (rnd() < 0.3){
        const cx = (i + rnd())*CS, cy = (j + rnd())*CS;
        if (cy < -VERGE - 8) for (let m=0;m<7;m++){
          const x = cx + (rnd() - 0.5)*26, y = cy + (rnd() - 0.5)*12;
          g.fillStyle = rnd() < .5 ? '#5f8f36' : '#73a243';
          for (let p=0;p<3;p++){ const a = p/3*TAU - Math.PI/2; ell(g, x + Math.cos(a)*1.6, y + Math.sin(a)*1.3, 1.5, 1.3); g.fill(); }
          if (rnd() < 0.35){ g.fillStyle = rnd() < .5 ? '#f3c6d8' : '#fbf6ee'; ell(g, x + 1, y - 3, 1.8, 1.8); g.fill(); }
        }
      }
      // a few fallen petals (and the odd autumn leaf)
      for (let k=0;k<3;k++){
        const x = (i + rnd())*CS, y = (j + rnd())*CS, ci = Math.floor(rnd()*LEAFC.length), s = 3 + rnd()*3, rot = rnd()*TAU, sh = rnd() < .5 ? 1 : 0, a = 0.2 + rnd()*0.2;
        if (y > -VERGE - 4) continue;
        g.globalAlpha = a; drawLeaf(g, x, y, s, rot, ci, sh, 1, 0.7, 1, 0.15); g.globalAlpha = 1;
      }
      if (rnd() < 0.18){
        const x = (i + rnd())*CS, y = (j + rnd())*CS, kind = rnd(), s = 0.9 + rnd()*0.5, red = rnd() < .5;
        if (y < -VERGE - 10){
          if (kind < 0.7){ g.fillStyle = 'rgba(40,30,15,.25)'; ell(g, x+1, y+2, 5, 2.4); g.fill(); g.fillStyle = '#a7a296'; ell(g, x, y, 4.5, 3); g.fill(); g.fillStyle = '#c9c4b5'; ell(g, x-1, y-1, 2.4, 1.4); g.fill(); }
          else { g.fillStyle = '#e8dcc2'; g.fillRect(x - 1.2*s, y - 5*s, 2.4*s, 5*s); g.fillStyle = red ? '#b5452d' : '#c88b4a'; g.beginPath(); g.ellipse(x, y - 5*s, 5*s, 3.4*s, 0, Math.PI, 0); g.fill(); g.fillStyle = '#f4ead5'; ell(g, x - 2*s, y - 6.5*s, .9*s, .9*s); g.fill(); }
        }
      }
    }
    drawDecoFlowers(g, V);
    SPOTS.forEach((p, i) => drawRockBed(g, p.x, p.y, 100 + i));
    // wild land beyond the fence: a little darker and overgrown
    g.save();
    g.beginPath(); g.rect(V.x0, V.y0, V.x1 - V.x0, -VERGE - V.y0); g.rect(O.x0, O.y0, O.x1 - O.x0, O.y1 - O.y0);
    g.fillStyle = 'rgba(40,52,18,.2)'; g.fill('evenodd');
    g.restore();
    for (let i=i0;i<i1;i++) for (let j=j0;j<j1;j++){ yield;
      const rnd = cellRnd(i, j, 3);
      // tall prairie grass, gone golden at the tips
      for (let k=0;k<6;k++){
        const x = (i + rnd())*CS, y = (j + rnd())*CS, gold = rnd() < .55;
        if (y > -VERGE - 6 || inOwned(x, y, 14)) continue;
        for (let m=0;m<7;m++){ const a = -Math.PI/2 + (m - 3)*0.2, h = 15 + (m%3)*4; g.strokeStyle = gold ? (m%2 ? '#c8b36a' : '#a99a52') : (m%2 ? '#6f9440' : '#557a32'); g.lineWidth = 1.3; g.beginPath(); g.moveTo(x + m*1.3, y); g.quadraticCurveTo(x + m*1.3 + Math.cos(a)*7, y - 8, x + m*1.3 + Math.cos(a)*14, y - h); g.stroke(); }
        if (gold && rnd() < .5){ g.fillStyle = '#e2cf8a'; for (let m=0;m<3;m++){ ell(g, x + m*4 + 3*Math.cos(-1.2 + m*0.4), y - 16 - m*2, 1.1, 2.6); g.fill(); } }
      }
      // tall flower spikes (lupines and the like) and loose wildflowers
      for (let k=0;k<4;k++){
        const x = (i + rnd())*CS, y = (j + rnd())*CS, h = 14 + rnd()*12, C = [['#5b4aa6','#8a78d6','#b9aaf0'],['#a83f7e','#d46aa6','#f2a6cc'],['#e8e2d2','#fbf8ef','#ffffff'],['#d9a21e','#f2c43a','#f8dc78']][Math.floor(rnd()*4)];
        if (y > -VERGE - 10 || inOwned(x, y, 16)) continue;
        g.strokeStyle = '#4f7a2c'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1, y - h); g.stroke();
        for (let m=0;m<9;m++){ const u = m/8, yy = y - h*0.45 - u*h*0.6, w = (1 - u)*2 + 0.8; g.fillStyle = C[Math.min(2, Math.floor(u*3))]; ell(g, x + 1 - w*0.7, yy, w*0.7, 1.2); g.fill(); ell(g, x + 1 + w*0.7, yy - 0.5, w*0.7, 1.2); g.fill(); }
      }
      for (let k=0;k<5;k++){
        const x = (i + rnd())*CS, y = (j + rnd())*CS, ty = Math.floor(rnd()*FLOWER_TYPES.length), s = 0.9 + rnd()*0.5, sp = flowerSpr[ty];
        if (!sp || y > -VERGE - 10 || inOwned(x, y, 16)) continue;
        g.drawImage(sp.stem, x - sp.sox*s, y - sp.soy*s, sp.sw*s, sp.sh*s); const hs = sp.hw*s; g.drawImage(sp.head, x - hs/2, y - FLOWER_TYPES[ty].h*s - hs/2, hs, hs);
      }
      if (rnd() < 0.42){
        const x = (i + rnd())*CS, y = (j + rnd())*CS;
        if (!(y > -VERGE - 20 || inOwned(x, y, 30))) drawBush(g, x, y, 0.85 + rnd()*0.5, cellRnd(i, j, 6));
      }
    }
    drawFence(g, O);
    // the verge: pale gravel with a fringe of clover and daisies
    const vy = -VERGE;
    g.fillStyle = '#c7b99b'; g.fillRect(V.x0, vy, V.x1 - V.x0, VERGE);
    const vg = g.createLinearGradient(0, vy - 6, 0, vy + 7); vg.addColorStop(0, 'rgba(118,150,66,1)'); vg.addColorStop(1, 'rgba(118,150,66,0)'); g.fillStyle = vg; g.fillRect(V.x0, vy - 6, V.x1 - V.x0, 13);
    for (let i=i0;i<i1;i++){ yield;
      const rnd = cellRnd(i, 0, 4);
      for (let k=0;k<110;k++){ const x = (i + rnd())*CS, y = vy + 4 + rnd()*(VERGE - 5), ci = Math.floor(rnd()*4), rx = 1 + rnd()*1.6, ry = 0.8 + rnd()*1.1; g.fillStyle = ['#ab9d84','#d8ccb0','#a09380','#e2d7c0'][ci]; ell(g, x, y, rx, ry); g.fill(); }
      for (let k=0;k<16;k++){ const x = (i + rnd())*CS, tone = rnd(), dx = (rnd()-.5)*4, h = 2 + rnd()*5; g.strokeStyle = tone < .5 ? '#5d8a34' : '#7aa046'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(x, vy + 2); g.lineTo(x + dx, vy + 2 + h); g.stroke(); }
      for (let k=0;k<10;k++){ const x = (i + rnd())*CS, y = vy + 1 + rnd()*5, col = rnd() < .6 ? '#fdfaf1' : '#f7d652'; g.fillStyle = col; for (let p=0;p<5;p++){ const a = p/5*TAU; ell(g, x + Math.cos(a)*1.3, y + Math.sin(a), 0.9, 0.75); g.fill(); } g.fillStyle = '#f2b52e'; ell(g, x, y, 0.6, 0.5); g.fill(); }
    }
    // road
    g.fillStyle = '#d8ccb2'; g.fillRect(V.x0, 0, V.x1 - V.x0, 6);
    g.fillStyle = '#aca089'; g.fillRect(V.x0, 6, V.x1 - V.x0, 2);
    const rg2 = g.createLinearGradient(0, 8, 0, ROAD + 40); rg2.addColorStop(0, '#5f5856'); rg2.addColorStop(1, '#514a49');
    g.fillStyle = rg2; g.fillRect(V.x0, 8, V.x1 - V.x0, V.y1 - 8);
    for (let i=i0;i<i1;i++){ yield;
      const rnd = cellRnd(i, 1, 5);
      for (let k=0;k<70;k++){ const x = (i + rnd())*CS, y = 9 + rnd()*(ROAD + 10), light = rnd() < .5; g.fillStyle = light ? 'rgba(255,240,230,.05)' : 'rgba(0,0,0,.08)'; g.fillRect(x, y, 1.6, 1.6); }
      for (let k=0;k<3;k++){ const x = (i + rnd())*CS, y = 14 + rnd()*(ROAD - 18), rot = rnd()*TAU, ci = Math.floor(rnd()*LEAFC.length); g.globalAlpha = .55; drawLeaf(g, x, y, 5.5, rot, ci, 1, 1, .7, 1, .25); g.globalAlpha = 1; }
    }
    g.fillStyle = 'rgba(236,222,180,.75)';
    for (let x = Math.floor(V.x0/54)*54; x < V.x1; x += 54){ rr(g, x, LANE + 18, 28, 3.2, 1.5); g.fill(); }
  }

  // ── flowering shrubs (azalea, hydrangea, lilac, spirea, forsythia) on a green mound; now and then, out in the wild,
  // an autumn one, for old times' sake. Your own bushes always flower.
  const BLOOM_FAMS = [
    ['#7a2347','#b03c6a','#d9628f','#f096b8','#fcc8dc'],   // azalea
    ['#2f4a7a','#4f6fae','#7c97d1','#a9bde6','#dbe4f7'],   // hydrangea
    ['#4c3466','#71519a','#9c7cc6','#c4a9e3','#ebdff8'],   // lilac
    ['#8a8274','#b9b2a2','#e3ded2','#f6f3ec','#ffffff'],   // spirea
    ['#7a5a12','#ad8a1c','#dcb62c','#f2d455','#fbeaa0'],   // forsythia
    ['#8a3a2a','#c4553a','#ec7a55','#f6a37e','#fcd0b6'],   // coral azalea
  ];
  const BUSH_GREEN = ['#2f4a1c','#40632a','#557c34','#6e9a42','#93ba5c'];
  function blossom(g, x, y, r, col, eye){
    const { ell, TAU } = H;
    g.fillStyle = col;
    for (let p=0;p<5;p++){ const a = p/5*TAU + x; ell(g, x + Math.cos(a)*r*0.55, y + Math.sin(a)*r*0.5, r*0.52, r*0.48); g.fill(); }
    g.fillStyle = eye; ell(g, x, y, r*0.26, r*0.24); g.fill();
  }
  function drawBush(g, x, y, s, rnd, own){
    const { ell, TAU, clamp, leafBlob, FOLIAGE } = H;
    rnd(); rnd();   // small seeds give a small first number: skip a couple
    const F = [FOLIAGE.olive, FOLIAGE.rust, FOLIAGE.red, FOLIAGE.orange];
    const autumn = !own && rnd() < 0.12, P = autumn ? F[Math.floor(rnd()*F.length)] : BUSH_GREEN, BL = BLOOM_FAMS[Math.floor(rnd()*BLOOM_FAMS.length)], W = 22*s;
    const ball = !autumn && BL === BLOOM_FAMS[1];
    g.fillStyle = 'rgba(25,30,12,.3)'; ell(g, x + 5*s, y + 3*s, W*1.25, 7*s); g.fill();
    const cl = [];
    for (let m=0;m<8;m++){ const bx = (rnd() - 0.5)*2*W*0.8, hump = 1 - Math.abs(bx)/W; cl.push({ x: bx, y: -hump*12*s - rnd()*6*s, r: (6 + hump*6 + rnd()*4)*s }); }
    cl.sort((a, b) => a.y - b.y);
    g.fillStyle = P[0]; for (const k of cl){ ell(g, x + k.x + 1, y + k.y + 2, k.r + 2, k.r*0.86 + 2); g.fill(); }
    for (const k of cl){
      const lit = clamp(Math.round(2 - k.x/W - (k.y/(14*s)) * 0.6 + (rnd() - 0.5)), 1, 3);
      g.fillStyle = P[lit - 1]; ell(g, x + k.x + k.r*0.1, y + k.y + k.r*0.12, k.r, k.r*0.86); g.fill();
      g.fillStyle = P[lit]; ell(g, x + k.x - k.r*0.08, y + k.y - k.r*0.08, k.r*0.86, k.r*0.74); g.fill();
      if (autumn){
        g.globalAlpha = 0.7; g.fillStyle = P[lit + 1]; ell(g, x + k.x - k.r*0.32, y + k.y - k.r*0.32, k.r*0.38, k.r*0.3); g.fill(); g.globalAlpha = 1;
        for (let q=0;q<2;q++) leafBlob(g, x + k.x + (rnd() - 0.5)*k.r*1.2, y + k.y + (rnd() - 0.5)*k.r, 1.8 + rnd()*1.4, rnd()*TAU, P[clamp(lit + (rnd() < .5 ? 1 : -1), 0, 4)]);
        continue;
      }
      if (ball){
        // hydrangea: round heads of tiny florets
        const hx = x + k.x - k.r*0.15, hy = y + k.y - k.r*0.2, hr = k.r*0.62;
        g.fillStyle = BL[lit]; ell(g, hx, hy, hr, hr*0.88); g.fill();
        for (let q=0;q<14;q++){ const a = rnd()*TAU, d = Math.sqrt(rnd())*hr*0.85; g.fillStyle = BL[clamp(lit + (rnd() < .5 ? 1 : 0) + (a > Math.PI ? 1 : 0), 1, 4)]; ell(g, hx + Math.cos(a)*d, hy + Math.sin(a)*d*0.88, 1.1*s, 1.1*s); g.fill(); }
      } else {
        // blossoms all over the clump, lighter on the sunny side
        for (let q=0;q<6;q++){ const a = rnd()*TAU, d = Math.sqrt(rnd())*k.r*0.8, bx = x + k.x + Math.cos(a)*d, by = y + k.y + Math.sin(a)*d*0.86, sun = (Math.cos(a)*-0.5 + Math.sin(a)*-0.7) > 0;
          blossom(g, bx, by, (2 + rnd()*1.2)*s, BL[clamp(lit + (sun ? 1 : 0) + (rnd() < .3 ? 1 : 0), 1, 4)], BL[0]); }
      }
    }
    if (!autumn && rnd() < 0.5){ for (let q=0;q<5;q++){ g.fillStyle = BL[4]; ell(g, x + (rnd() - 0.5)*W*1.6, y + 2*s + rnd()*4*s, 1.3*s, 0.8*s); g.fill(); } }   // a few fallen petals
    if (autumn && rnd() < 0.3){ g.fillStyle = '#c23a2a'; for (let q=0;q<6;q++){ ell(g, x + (rnd() - 0.5)*W*1.3, y - rnd()*16*s, 1.6*s, 1.6*s); g.fill(); } }
  }

  // ── a whitewashed rail fence
  function drawFence(g, O){
    const { ell, rr, lerp } = H;
    const post = (x, y) => {
      g.fillStyle = 'rgba(30,40,20,.24)'; ell(g, x + 2, y + 1, 5, 2); g.fill();
      g.fillStyle = '#c9c0ac'; rr(g, x - 2.6, y - 16, 5.2, 17, 1.2); g.fill();
      g.fillStyle = '#f1ece0'; rr(g, x - 2.6, y - 16, 3.8, 17, 1.2); g.fill();
      g.fillStyle = '#f1ece0'; g.beginPath(); g.moveTo(x - 2.6, y - 15.5); g.lineTo(x, y - 19); g.lineTo(x + 2.6, y - 15.5); g.closePath(); g.fill();
    };
    g.lineCap = 'round';
    const rail = (x0, y0, x1, y1) => { g.strokeStyle = 'rgba(120,110,90,.55)'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(x0, y0 + 0.8); g.lineTo(x1, y1 + 0.8); g.stroke(); g.strokeStyle = '#ece5d6'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
    rail(O.x0, O.y0 - 11, O.x1, O.y0 - 11); rail(O.x0, O.y0 - 5, O.x1, O.y0 - 5);
    for (const x of [O.x0, O.x1]){ rail(x - 1, O.y0 - 11, x - 1, O.y1 - 10); rail(x + 1, O.y0 - 5, x + 1, O.y1 - 4); }
    const nTop = Math.max(2, Math.round((O.x1 - O.x0)/40));
    for (let k=0;k<=nTop;k++) post(lerp(O.x0, O.x1, k/nTop), O.y0);
    const nSide = Math.max(2, Math.round((O.y1 - O.y0)/40));
    for (let k=1;k<=nSide;k++){ const y = lerp(O.y0, O.y1, k/nSide); post(O.x0, y); post(O.x1, y); }
  }

  // ── flower upgrades of its own (a "Wildflowers" section in the workshop)
  const GEN = {
    press:    { name:'Petal press',        max:3, cost:[250, 700, 1500], desc:l=>'Pressed petals sell for <b>'+(15*(l+1))+'%</b> more, loose or bagged.' },
    seeding:  { name:'Wildflower seeding', max:3, cost:[600, 2000, 6000], needs:()=>H.S.hive.built, desc:l=>'Sow <b>'+(40*(l+1))+'%</b> more flowers for the bees on all your land.' },
    clover:   { name:'Sweet clover',       max:2, cost:[900, 4000], needs:()=>H.S.hive.built, desc:l=>'Flowers bloom again <b>'+(30*(l+1))+'%</b> sooner after a bee sips them.' },
  };
  const GEN_ICON = { press:'press', seeding:'seed', clover:'clover' };
  const GEN_SHORT = { press: l => '+' + 15*(l + 1) + '% for petals', seeding: l => '+' + 40*(l + 1) + '% flowers', clover: l => 'Flowers regrow ' + 30*(l + 1) + '% sooner' };

  // ── icons: the "leaf" picture is a petal here, plus the flower upgrades
  const ICON = {
    leaf:   '<path d="M0,5 C-2,4 -4.6,0 -4,-3 C-3.6,-5 -1.4,-5.4 0,-3.6 C1.4,-5.4 3.6,-5 4,-3 C4.6,0 2,4 0,5Z" fill="#ee9bb6"/><path d="M0,4.2 V-1.6 M0,1.4 L-1.8,-1.4 M0,1.4 L1.8,-1.4" stroke="#c7688a" stroke-width=".6" fill="none"/>',
    seed:   '<rect x="-3.8" y="-5" width="7.6" height="10" rx=".8" fill="#efdfbd" stroke="#a8703a" stroke-width=".6"/><g fill="#d0607f"><circle cy="-2.9" r="1.15"/><circle cx="1.9" cy="-1.3" r="1.15"/><circle cx="-1.9" cy="-1.3" r="1.15"/><circle cx="1.2" cy=".8" r="1.15"/><circle cx="-1.2" cy=".8" r="1.15"/></g><circle cy="-.9" r="1" fill="#f2c14e"/><path d="M-2.6,3.4 H2.6" stroke="#a8703a" stroke-width=".7"/>',
    clover: '<path d="M.4,.6 Q1.6,3 3,5.2" stroke="#4f7a2c" stroke-width="1" fill="none" stroke-linecap="round"/><g fill="#6f9a3a"><circle cx="-2" cy="-2.2" r="2.3"/><circle cx="2" cy="-2.2" r="2.3"/><circle cx="0" cy="1.2" r="2.3"/></g><circle cx="0" cy="-1" r="1.2" fill="#f2a7c3"/>',
    press:  '<rect x="-5.2" y="-1.4" width="10.4" height="2.3" rx=".5" fill="#c98f4c"/><rect x="-5.2" y="2.6" width="10.4" height="2.3" rx=".5" fill="#8a5a2e"/><path d="M-3.6,1.8 Q-1.8,.9 0,1.8 Q1.8,2.7 3.6,1.8" stroke="#e886a6" stroke-width="1.1" fill="none"/><path d="M0,-5.6 V-1.4" stroke="#6d777d" stroke-width="1.3"/><path d="M-2.4,-5.4 H2.4" stroke="#6d777d" stroke-width="1.3" stroke-linecap="round"/>',
  };

  return {
    id: 'prairie', name: 'Wildflower prairie', words,
    AREAS, SPOTS, TREES, PLANT: { x: -470, y: -330 },   // the smelting plant stands out in the meadow: a long walk for the haulers
    MINE_LAND: 1,                                        // mining (the metal slot, miners, smelting) opens with the meadow
    landForSale: false,                                  // no For Sale sign here: the patch is all you get (remove to sell the meadow and hills again)
    LEAFC, FOLIAGE, BLOSSOM, TREE_FAMS,
    FLOWER_TYPES, flowerStem, drawFlowerHead,
    decoN: [90, 300, 650],      // wildflowers just for looks, painted into the ground
    seedShare: 0.4,             // each Wildflower seeding level sows this share of a plot's flowers again
    paintGround, drawBush, drawFence,
    bg: '#62803a',
    vignette: { edge: ['rgba(70,30,50,0)', 'rgba(60,28,48,.34)'], sun: ['rgba(255,226,200,.26)', 'rgba(255,226,200,0)'] },
    GEN, GEN_ICON, GEN_SHORT, genSection: { title: 'Wildflowers', keys: ['press', 'seeding', 'clover'] },
    ICON,
    // story: what the robots find here, and when the driver writes again (see STORY in game.js)
    find: 'bee',
    arrive: { title: 'The Wildflower prairie', text: name => 'Petals everywhere and not a robot in sight. Start by cleaning up 300 petals.' },
  };
};
LOTS.prairie.title = 'the Wildflower prairie';   // what the game calls it before it's loaded ("Off to the Wildflower prairie…")
})();
