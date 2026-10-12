// AutumNation: parked robot looks (not loaded by the game; kept for later use).
//
// In V14.2 five looks were tried for Tinker so the first robot is easy to pick out in a crowd. Option 3, the bucket hat,
// became Tinker's look (ROBOT_LOOKS.bucket in game.js). The other four are kept here as they were drawn then:
//   1 Scrap heap: a rusty primer head, a welded seam, rust drips, a missing panel with wires, a bent taped antenna
//   2 Scarf and tarp: a long orange knitted scarf flying out behind, a blue tarp lashed round its middle
//   4 Pennant and cracked lamp: a cracked headlamp eye held on with tape, a tall whip antenna with a red pennant
//   5 Smoky old-timer: oil stains, a droopy squinting eyelid, an exhaust pipe that sputters smoke
//
// To use one again: paste TINKER_LOOKS / tinkerLook / bh0 into game.js next to ROBOT_LOOKS, add an entry such as
//   scarf: (part, c, r, g) => tinkerLook(2, part, c, r, g)
// to ROBOT_LOOKS, and give the robot's STYLES entry look:'scarf' (plus the colours in TINKER_LOOKS[2].st).
// tinkerLook is called with part 'body', 'back' (after the basket), 'face' (after the eye) and 'antenna' (return true to
// replace the usual antenna); g holds the drawing geometry from drawRobot (bw, bh, top, hx0, hy0, hw, hh, ex, ey, ...).
// It uses game.js helpers (ell, rr, simMode, parts, rand, PARAMS) and expects to live inside game.js.

// ── TINKER PREVIEW (?tinker=1..5): five looks to choose from, so the first robot is easy to pick out in a crowd. Each
// keeps the family look (cream shell, band, basket, amber eye, antenna) and makes Tinker the roughest robot of the lot.
const bh0 = g => 4;   // (the exhaust sits a little below the top of the shell)
const TINKER_LOOKS = {
  1: { name: 'Scrap heap', st: { head: '#b06b43', head2: '#6f3c22', body: '#cdbd98', body2: '#8d7a58', rust: 1 } },
  2: { name: 'Scarf and tarp', st: { body: '#d0c2a2', body2: '#998868' } },
  3: { name: 'Bucket hat', st: { body: '#cfc09f', body2: '#94825f', rust: 1 } },
  4: { name: 'Pennant and cracked lamp', st: { body: '#d0c2a3', body2: '#9a8a6a' } },
  5: { name: 'Smoky old-timer', st: { body: '#b9a98a', body2: '#76684f', head: '#c4b597', head2: '#857659', rust: 1 } },
};
function tinkerLook(tk, part, c, r, g){
  const t = r.anim, mv = r.moving;
  if (tk === 1){
    if (part === 'body'){
      // rust running down from the seams, a dent, and a missing panel with the wiring showing
      const { bw, bh, top } = g;
      c.fillStyle = 'rgba(138,66,30,.55)';
      for (const [x, y, l] of [[-bw*0.32, top + 2, 9], [bw*0.18, top + 3, 13], [-bw*0.05, top + bh*0.5, 8], [bw*0.38, top + bh*0.45, 7]]){ c.fillRect(x, y, 1.2, l); ell(c, x + 0.6, y + l, 1.1, 1.3); c.fill(); }
      const wx = -bw/2 + 1.5, wy = top + bh*0.5;
      c.fillStyle = '#2c2420'; rr(c, wx, wy, 8, 7, 1); c.fill();
      c.lineWidth = 0.9; c.lineCap = 'round';
      for (const [col, k] of [['#d24a2a', 0], ['#e8b13a', 1], ['#3f7fb0', 2]]){ c.strokeStyle = col; c.beginPath(); c.moveTo(wx + 1.3 + k*2.4, wy + 1); c.quadraticCurveTo(wx + 2.6 + k*1.8, wy + 8 + k*0.6, wx + 0.8 + k*2.8, wy + 9.5); c.stroke(); }
      c.strokeStyle = 'rgba(60,40,25,.55)'; c.lineWidth = 0.8; c.beginPath(); c.arc(bw*0.25, top + bh*0.72, 3.2, 3.6, 5.6); c.stroke();
      return;
    }
    if (part === 'face'){
      // a rusty primer head that doesn't match the body, a welded seam across it, rust drips
      const { hx0, hy0, hw, hh } = g;
      c.strokeStyle = '#4a3020'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(hx0 + 0.5, hy0 + hh*0.3); c.lineTo(hx0 + hw - 0.5, hy0 + hh*0.38); c.stroke();
      c.fillStyle = '#e2b892'; for (let k=0;k<6;k++){ ell(c, hx0 + 1.5 + k*hw/6.2, hy0 + hh*0.3 + k*0.13, 0.55, 0.55); c.fill(); }
      c.fillStyle = 'rgba(70,32,14,.6)'; for (const x of [2.5, 6.5]){ c.fillRect(hx0 + x, hy0 + hh*0.38, 1, hh*0.45); }
      return;
    }
    if (part === 'antenna'){
      // bent at a sharp angle, wrapped in tape, with a big cracked bulb that flickers
      const { ax, ay } = g;
      c.strokeStyle = '#4a423b'; c.lineWidth = 1.4; c.lineJoin = 'round'; c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax - 1, ay - 7); c.lineTo(ax - 8, ay - 10); c.stroke();
      c.strokeStyle = '#e9e1cf'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(ax - 0.4, ay - 3.4); c.lineTo(ax - 0.8, ay - 5.4); c.stroke();
      const on = Math.sin(t*3 + 1) > 0.2 && Math.sin(t*23) > -0.6;
      c.fillStyle = on ? '#ff7a4d' : '#7a4030'; ell(c, ax - 9.5, ay - 10.5, 2.8, 2.8); c.fill();
      if (on){ c.fillStyle = 'rgba(255,122,77,.32)'; ell(c, ax - 9.5, ay - 10.5, 6, 6); c.fill(); }
      c.strokeStyle = 'rgba(40,20,10,.6)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(ax - 11, ay - 12); c.lineTo(ax - 9.4, ay - 10.4); c.lineTo(ax - 10, ay - 8.6); c.stroke();
      return true;
    }
  }
  if (tk === 2){
    if (part === 'body'){
      // a faded blue tarp lashed round its middle with twine
      const { bw, bh, top } = g;
      c.fillStyle = '#5d86a8'; c.beginPath(); c.moveTo(-bw/2 - 0.5, top + bh*0.5); c.lineTo(bw*0.15, top + bh*0.44); c.lineTo(bw*0.05, -8.5); c.lineTo(-bw/2 - 0.5, -8.5); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.moveTo(-bw/2, top + bh*0.52); c.lineTo(bw*0.1, top + bh*0.47); c.lineTo(bw*0.02, top + bh*0.62); c.closePath(); c.fill();
      c.fillStyle = '#c9b06a'; for (const [x, y] of [[-bw/2 + 2, top + bh*0.52], [bw*0.12, top + bh*0.46]]){ ell(c, x, y, 1, 1); c.fill(); }
      c.strokeStyle = '#a4844a'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-bw/2, top + bh*0.82); c.lineTo(bw/2, top + bh*0.62); c.moveTo(-bw/2, top + bh*0.6); c.lineTo(bw*0.1, -8); c.stroke();
      return;
    }
    if (part === 'back'){
      // a long knitted orange scarf round its neck, the ends flying out behind
      const { bw, top } = g, nx = 2, ny = top - 1.5, fl = mv ? 1 : 0.35;
      c.fillStyle = '#d8562a'; rr(c, -bw*0.25, ny - 2.2, bw*0.62, 4.4, 2); c.fill();
      c.fillStyle = '#f2e3c2'; for (let k=0;k<4;k++) c.fillRect(-bw*0.25 + 2.5 + k*3.6, ny - 2.2, 1.3, 4.4);
      for (let e = 0; e < 2; e++){
        const L = 13 + e*3, ph = t*(mv ? 9 : 2) + e*1.3;
        c.save(); c.translate(-bw*0.2, ny + e*1.4);
        c.fillStyle = e ? '#c2481f' : '#d8562a';
        c.beginPath(); c.moveTo(0, -1.6);
        for (let k=0;k<=6;k++){ const x = -k*L/6, y = -1.6 + k*(1.2 - fl*0.8) + Math.sin(ph - k*0.9)*k*0.35*(0.5 + fl); c.lineTo(x, y); }
        for (let k=6;k>=0;k--){ const x = -k*L/6, y = 1.6 + k*(1.2 - fl*0.8) + Math.sin(ph - k*0.9)*k*0.35*(0.5 + fl); c.lineTo(x, y); }
        c.closePath(); c.fill();
        c.fillStyle = '#f2e3c2'; c.fillRect(-L*0.55, -1.8 + 3.3*(1.2 - fl*0.8) + Math.sin(ph - 3.3)*0.6, 1.3, 3.6);
        c.strokeStyle = '#f2e3c2'; c.lineWidth = 0.6; const ty = 6*(1.2 - fl*0.8) + Math.sin(ph - 5.4)*2.1*(0.5 + fl);
        c.beginPath(); for (let k=-1;k<=1;k++){ c.moveTo(-L, ty + k*1.2); c.lineTo(-L - 2.4, ty + k*1.6 + 0.6); } c.stroke();
        c.restore();
      }
      return;
    }
    if (part === 'face'){
      // a strip of grey tape across the top of its head
      const { hx0, hy0, hw } = g;
      c.fillStyle = 'rgba(190,192,186,.95)'; c.save(); c.translate(hx0 + hw*0.35, hy0 + 2.2); c.rotate(-0.25); c.fillRect(-5, -1.4, 10, 2.8); c.restore();
      return;
    }
  }
  if (tk === 3){
    if (part === 'body'){
      const { bw, bh, top } = g;
      c.fillStyle = 'rgba(138,66,30,.5)'; for (const [x, y] of [[-bw*0.3, top + bh*0.45], [bw*0.12, top + bh*0.85], [bw*0.36, top + bh*0.6]]){ ell(c, x, y, 2.4, 1.6); c.fill(); }
      return;
    }
    if (part === 'antenna'){
      // an old dented tin bucket upside down on its head, the antenna poking out through a hole in the bottom
      const { hx0, hy0, hw } = g, cx = hx0 + hw*0.48, by = hy0 + 3.5, w0 = hw + 3, w1 = hw*0.62, H = 11;
      c.save(); c.translate(cx, by); c.rotate(-0.16);
      const bg = c.createLinearGradient(-w0/2, 0, w0/2, 0); bg.addColorStop(0, '#7f8a8d'); bg.addColorStop(0.35, '#c4cbcc'); bg.addColorStop(0.6, '#98a2a5'); bg.addColorStop(1, '#6a7376');
      c.fillStyle = bg; c.beginPath(); c.moveTo(-w0/2, 0); c.lineTo(w0/2, 0); c.lineTo(w1/2, -H); c.lineTo(-w1/2, -H); c.closePath(); c.fill();
      c.fillStyle = '#5d6669'; rr(c, -w0/2 - 1, -1.2, w0 + 2, 2.4, 1.1); c.fill();
      c.strokeStyle = 'rgba(60,66,68,.6)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-w0*0.42, -H*0.35); c.lineTo(w0*0.42, -H*0.4); c.moveTo(-w0*0.32, -H*0.72); c.lineTo(w0*0.3, -H*0.75); c.stroke();
      c.fillStyle = 'rgba(70,74,76,.45)'; ell(c, w0*0.15, -H*0.5, 2.6, 1.8); c.fill();   // a dent
      c.fillStyle = 'rgba(150,76,34,.7)'; for (const [x, y, rx] of [[-w0*0.3, -2.5, 1.8], [w0*0.25, -H*0.85, 1.3], [-w0*0.05, -H*0.6, 1]]){ ell(c, x, y, rx, rx*0.7); c.fill(); }
      // the handle hangs down the side, swinging as it drives
      const sw = Math.sin(t*(mv ? 10 : 1.5))*(mv ? 0.25 : 0.06);
      c.save(); c.translate(-w0/2 + 1, -2); c.rotate(sw); c.strokeStyle = '#4c5355'; c.lineWidth = 0.9; c.beginPath(); c.arc(4, 0, 4.6, 0.2, 2.9); c.stroke(); c.restore();
      c.strokeStyle = '#4a423b'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(-1, -H); c.quadraticCurveTo(-2.5, -H - 4, -5, -H - 7); c.stroke();
      const on = Math.sin(t*3 + r.id) > 0.6;
      c.fillStyle = on ? '#ff7a4d' : '#8a4a36'; ell(c, -5, -H - 7.5, 2.1, 2.1); c.fill();
      if (on){ c.fillStyle = 'rgba(255,122,77,.3)'; ell(c, -5, -H - 7.5, 4.5, 4.5); c.fill(); }
      c.restore();
      return true;
    }
  }
  if (tk === 4){
    if (part === 'body'){
      const { bw, bh, top } = g;
      c.strokeStyle = 'rgba(70,52,36,.5)'; c.lineWidth = 0.7;
      c.beginPath(); c.moveTo(-bw*0.35, top + bh*0.15); c.lineTo(-bw*0.1, top + bh*0.28); c.moveTo(bw*0.05, top + bh*0.7); c.lineTo(bw*0.35, top + bh*0.62); c.moveTo(bw*0.1, top + bh*0.76); c.lineTo(bw*0.32, top + bh*0.72); c.stroke();
      c.fillStyle = 'rgba(150,76,34,.55)'; ell(c, -bw*0.3, top + bh*0.72, 2.6, 1.8); c.fill();
      return;
    }
    if (part === 'face'){
      // its eye is an old headlamp: a big rim, a cracked lens, held on with a cross of tape
      const { ex, ey } = g;
      c.strokeStyle = '#6b6156'; c.lineWidth = 2; ell(c, ex + 0.3, ey, 5.6, 5.6); c.stroke();
      c.strokeStyle = '#a89e8f'; c.lineWidth = 0.8; ell(c, ex + 0.3, ey, 5.6, 5.6); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 0.55; c.beginPath(); c.moveTo(ex - 2.6, ey - 3.2); c.lineTo(ex - 0.4, ey - 0.6); c.lineTo(ex + 0.6, ey + 1.6); c.moveTo(ex - 0.4, ey - 0.6); c.lineTo(ex + 2.8, ey - 1.6); c.stroke();
      c.fillStyle = 'rgba(214,214,204,.95)';
      c.save(); c.translate(ex + 4.6, ey + 3.8); c.rotate(0.7); c.fillRect(-3.6, -1.1, 7.2, 2.2); c.rotate(-1.4); c.fillRect(-3.6, -1.1, 7.2, 2.2); c.restore();
      return;
    }
    if (part === 'antenna'){
      // a tall, bent whip antenna with a faded red pennant fluttering from it
      const { ax, ay } = g, top2 = ay - 19, tx = ax - 7;
      c.strokeStyle = '#4a423b'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(ax - 1, ay - 10, tx, top2); c.stroke();
      const ph = t*(mv ? 12 : 3), L = mv ? 11 : 9;
      c.fillStyle = '#c4452e'; c.beginPath(); c.moveTo(tx + 0.3, top2 + 0.5);
      for (let k=1;k<=5;k++) c.lineTo(tx - k*L/5, top2 + 0.5 + k*0.55 + Math.sin(ph - k*0.8)*k*0.32);
      for (let k=5;k>=0;k--) c.lineTo(tx - k*L/5 + (k ? 0 : 0.6), top2 + 6 - k*0.45 + Math.sin(ph - k*0.8)*k*0.32);
      c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,240,215,.75)'; ell(c, tx - L*0.4, top2 + 3.2 + Math.sin(ph - 1.6)*0.6, 1.3, 1); c.fill();
      const on = Math.sin(t*3 + r.id) > 0.6;
      c.fillStyle = on ? '#ff7a4d' : '#8a4a36'; ell(c, tx, top2 - 0.6, 1.8, 1.8); c.fill();
      return true;
    }
  }
  if (tk === 5){
    if (part === 'body'){
      // oil stains and drips all down its front
      const { bw, bh, top } = g;
      c.fillStyle = 'rgba(30,24,18,.45)';
      ell(c, bw*0.15, top + bh*0.3, 4.5, 3); c.fill(); ell(c, -bw*0.28, top + bh*0.75, 3.6, 2.4); c.fill();
      for (const [x, y, l] of [[bw*0.12, top + bh*0.3, 9], [bw*0.22, top + bh*0.32, 6], [-bw*0.3, top + bh*0.75, 4]]){ c.fillRect(x, y, 1.1, l); ell(c, x + 0.55, y + l, 1, 1.2); c.fill(); }
      return;
    }
    if (part === 'back'){
      // a crooked exhaust pipe on its back that sputters dark smoke (more when it's driving)
      const { bw, top } = g, px = -bw/2 + 1, py = top + bh0(g);
      c.strokeStyle = '#3e3a36'; c.lineWidth = 2.8; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(px + 3, py + 6); c.lineTo(px - 2.5, py + 3); c.lineTo(px - 3, py - 9); c.stroke();
      c.fillStyle = '#2a2622'; rr(c, px - 5, py - 11.5, 4, 2.4, 0.8); c.fill();
      // a little cloud always hangs over the pipe, puffing in and out
      for (let k=0;k<3;k++){ const ph = (t*(mv ? 1.6 : 0.7) + k/3) % 1, rr2 = 1.8 + ph*3.4; c.fillStyle = 'rgba(62,58,54,' + (0.5*(1 - ph)) + ')'; ell(c, px - 3 - ph*(mv ? 9 : 3) + Math.sin(k*2.1 + t)*1, py - 13 - ph*10, rr2, rr2*0.85); c.fill(); }
      if (!simMode && Math.random() < (mv ? 0.12 : 0.03)){ const wx = r.x + r.face*(px - 3); parts.push({ k:'smoke', x: wx, y: r.y + py - 14, vx: rand(-5, 5) - r.face*(mv ? 14 : 0), vy: rand(-22, -12), g:0, life: rand(1.1, 1.7), t:0, r: rand(1.8, 2.8) }); }
      return;
    }
    if (part === 'face'){
      // a heavy, droopy eyelid: it squints at everything, and soot round the eye
      const { ex, ey, hx0, hy0, hw } = g;
      c.fillStyle = '#6f6248'; c.beginPath(); c.moveTo(ex - 5.2, ey - 0.6); c.quadraticCurveTo(ex, ey - 6.2, ex + 5.4, ey - 1.8); c.lineTo(ex + 5.6, ey - 5.6); c.lineTo(ex - 5.4, ey - 5.6); c.closePath(); c.fill();
      c.strokeStyle = '#3a3128'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(ex - 5.2, ey - 0.6); c.quadraticCurveTo(ex, ey - 2.4, ex + 5.4, ey - 1.8); c.stroke();
      c.fillStyle = 'rgba(28,24,22,.45)'; ell(c, hx0 + hw - 2, hy0 + 2.5, 2.2, 1.4); c.fill();
      return;
    }
  }
}
