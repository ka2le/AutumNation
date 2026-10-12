// AutumNation soundscape. Every sound is synthesized live with the Web Audio API, so there are no audio files.
// Three layers, each with its own switch in the sound card:
//   amb   - wind and rustling leaves (the main bed), robots picking up and dumping leaves, the truck
//   sfx   - mellow robot beeps, little chimes when you buy things, metal clinks
//   music - a slow, quiet waltz that comes and goes, with long leaf-only pauses in between
// The game talks to it through window.LeafSound. Nothing makes a sound until the first tap or key press unlocks audio.
(() => {
'use strict';

// v2: "Leaves & wind" (amb) is off by default. Older v1 prefs carry over, except amb starts off again.
const PREF_KEY = 'leaf-yard-sound-v2', OLD_PREF_KEY = 'leaf-yard-sound-v1';
const prefs = { on: true, vol: 0.7, amb: false, sfx: true, music: true };
try {
  let p = JSON.parse(localStorage.getItem(PREF_KEY) || 'null');
  if (!p){ p = JSON.parse(localStorage.getItem(OLD_PREF_KEY) || 'null'); if (p) p.amb = false; }
  if (p) for (const k in prefs) if (k in p && typeof p[k] === typeof prefs[k]) prefs[k] = p[k];
} catch (e) {}
const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) {} };

const AC = window.AudioContext || window.webkitAudioContext;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

// How loud each layer sits in the mix (before the player's volume).
const BUS_LEVEL = { amb: 2.0, sfx: 0.55, music: 0.24 };

let ctx = null, master = null, wobble = null, noiseBuf = null;
const bus = {};
let rustleBufs = [];
let windLP, windGain, airBP, airGain;
let rainHiss, rainLow, rainBus, rainAcc = 0;   // V14 (the Rainy hollow): the rain bed
const listeners = new Set();
const changed = () => { for (const f of listeners) try { f(prefs); } catch (e) {} };

// ───────────────────────── setup
function filt(type, freq, q){ const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q != null) f.Q.value = q; return f; }
function gainNode(v){ const g = ctx.createGain(); g.gain.value = v; return g; }
function panInto(node, pan, dest){
  if (ctx.createStereoPanner){ const p = ctx.createStereoPanner(); p.pan.value = clamp(pan || 0, -1, 1); node.connect(p); p.connect(dest); return p; }
  node.connect(dest); return null;
}

function makeNoise(sec){
  const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

// A soft room: decaying, darkened noise used as a reverb impulse.
function makeIR(sec){
  const sr = ctx.sampleRate, n = Math.floor(sr * sec), b = ctx.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++){
    const d = b.getChannelData(ch); let lp = 0;
    for (let i = 0; i < n; i++){
      lp += (Math.random() * 2 - 1 - lp) * 0.22;
      d[i] = lp * Math.pow(1 - i / n, 3.2) * Math.min(1, i / (sr * 0.012));
    }
  }
  return b;
}

// One "rustle": a hiss full of tiny clicks, which is what dry leaves sound like up close.
// shape 0 = swell, 1 = quick crunch then trail off, 2 = slow drag
function makeRustle(dur, density, shape){
  const sr = ctx.sampleRate, n = Math.floor(dur * sr), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
  const env = new Float32Array(n);
  for (let t = 0; ;){
    t += Math.max(1, Math.floor(-Math.log(1 - Math.random()) * sr / density));
    if (t >= n) break;
    const p = t / n, busy = shape === 1 ? Math.pow(1 - p, 1.5) : Math.sin(Math.PI * p);
    if (Math.random() > 0.25 + 0.75 * busy) continue;
    const a = Math.pow(Math.random(), 2.3), tau = rnd(0.0007, 0.0045) * sr, len = Math.min(n - t, Math.floor(tau * 6));
    for (let i = 0; i < len; i++) env[t + i] += a * Math.exp(-i / tau);
  }
  let sum = 0;
  for (let i = 0; i < n; i++){
    const p = i / n;
    const sh = shape === 1 ? Math.min(1, p * 25) * Math.pow(1 - p, 1.8) : shape === 2 ? Math.pow(Math.sin(Math.PI * p), 0.6) : Math.pow(Math.sin(Math.PI * p), 1.4);
    d[i] = (Math.random() * 2 - 1) * (0.05 + env[i]) * sh;
    sum += d[i] * d[i];
  }
  const k = 0.2 / (Math.sqrt(sum / n) || 1);
  for (let i = 0; i < n; i++) d[i] = Math.tanh(d[i] * k * 1.2);
  return b;
}

function init(given){
  ctx = given || new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.3;
  const tone = filt('lowpass', 8500, 0.5);                // nothing harsh up top
  master = gainNode(0);
  master.connect(tone); tone.connect(comp); comp.connect(ctx.destination);

  const verb = ctx.createConvolver(); verb.buffer = makeIR(2.8);
  const verbOut = gainNode(0.55); verb.connect(verbOut); verbOut.connect(master);
  // a soft echo for the beeps
  const dl = ctx.createDelay(1); dl.delayTime.value = 0.31;
  const fb = gainNode(0.26), elp = filt('lowpass', 1500, 0.4), echoOut = gainNode(0.7);
  dl.connect(elp); elp.connect(fb); fb.connect(dl); elp.connect(echoOut); echoOut.connect(master);

  const WET = { amb: 0.12, sfx: 0.32, music: 0.5 };
  for (const k of ['amb', 'sfx', 'music']){
    const g = gainNode(prefs[k] ? BUS_LEVEL[k] : 0);
    g.connect(master);
    const w = gainNode(WET[k]); g.connect(w); w.connect(verb);
    if (k === 'sfx'){ const e = gainNode(0.22); g.connect(e); e.connect(dl); }
    bus[k] = g;
  }

  // slow, tiny pitch drift on the music, like an old tape
  wobble = gainNode(5);
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.37; lfo.connect(wobble); lfo.start();

  noiseBuf = makeNoise(3);
  rustleBufs = [];
  for (let i = 0; i < 10; i++) rustleBufs.push(makeRustle(rnd(0.35, 1.5), rnd(50, 260), i % 3));

  // the wind bed: looped noise, darker when calm, a little brighter in gusts
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  windLP = filt('lowpass', 300, 0.3); windGain = gainNode(0);
  airBP = filt('bandpass', 1400, 0.45); airGain = gainNode(0);
  src.connect(windLP); windLP.connect(windGain); windGain.connect(bus.amb);
  src.connect(airBP); airBP.connect(airGain); airGain.connect(bus.amb);
  src.start();

  // V14 (the Rainy hollow): the rain. A soft broadband hiss, a low patter underneath, and single drops ticking here and there
  // (rainStep). It goes straight to the master (not the "Leaves & wind" bus, which is off by default): it's the sound
  // of this place. It follows the game's rain level.
  rainBus = gainNode(0); rainBus.connect(master);
  const rw = gainNode(0.18); rainBus.connect(rw); rw.connect(verb);
  const rs = ctx.createBufferSource(); rs.buffer = makeNoise(4); rs.loop = true; rs.playbackRate.value = 0.93;
  const hp = filt('highpass', 650, 0.4), lp = filt('lowpass', 5200, 0.3); rainHiss = gainNode(0.05);
  rs.connect(hp); hp.connect(lp); lp.connect(rainHiss); rainHiss.connect(rainBus);
  const lp2 = filt('lowpass', 520, 0.5); rainLow = gainNode(0.06);
  rs.connect(lp2); lp2.connect(rainLow); rainLow.connect(rainBus);
  rs.start();

  mus.t = 0; mus.plan = []; mus.idx = 0; mus.cycle = 0;
}

let pumpTimer = 0;
function unlock(){
  if (!AC) return;
  if (!ctx){
    try { init(); } catch (e) { console.warn('[sound] could not start audio', e); ctx = null; return; }
    // fade in gently instead of starting at full volume
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.setTargetAtTime(level(), ctx.currentTime + 0.1, 0.9);
    pumpTimer = setInterval(() => { if (ctx && ctx.state === 'running' && prefs.on) musicPump(1.4); }, 200);
    // prime iOS with a silent blip inside the gesture
    try { const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate); s.connect(ctx.destination); s.start(); } catch (e) {}
    changed();
  }
  if (prefs.on && ctx.state !== 'running' && !document.hidden) ctx.resume().catch(() => {});
}

const level = () => prefs.on ? prefs.vol * prefs.vol * 1.5 : 0;
function applyMaster(tau){
  if (!ctx) return;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(level(), ctx.currentTime, tau == null ? 0.08 : tau);
}
let suspendTimer = 0;
function setPref(k, v){
  if (!(k in prefs)) return;
  prefs[k] = v; savePrefs();
  if (ctx){
    if (k === 'on' || k === 'vol') applyMaster();
    if (k === 'on'){
      clearTimeout(suspendTimer);
      if (v) ctx.resume().catch(() => {});
      else suspendTimer = setTimeout(() => { if (!prefs.on && ctx) ctx.suspend().catch(() => {}); }, 500);
    }
    if (k in bus) bus[k].gain.setTargetAtTime(v ? BUS_LEVEL[k] : 0, ctx.currentTime, 0.25);
    if (k === 'music' && v) mus.t = 0;   // start again from where the scheduler is now
  }
  changed();
}

document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend().catch(() => {});
  else if (prefs.on) ctx.resume().catch(() => {});
});

const live = () => ctx && ctx.state === 'running' && prefs.on;
const gates = {};
function gate(key, gap){ const n = ctx.currentTime; if (n - (gates[key] ?? -99) < gap) return false; gates[key] = n; return true; }

// ───────────────────────── V14 (the Rainy hollow): rain
function rainDrop(t, pan, vol, big){
  // one drop: a tiny filtered click, or now and then a fat "plip" off a roof or a leaf
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = rnd(0.8, 1.4);
  const bp = filt('bandpass', big ? rnd(900, 1500) : rnd(2400, 6000), big ? 6 : 1.4), g = gainNode(0);
  src.connect(bp); bp.connect(g); panInto(g, pan, rainBus);
  const len = big ? 0.05 : rnd(0.008, 0.02);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0005, t + len);
  src.start(t, rnd(0, 2.5), len + 0.03);
  if (big){
    const o = ctx.createOscillator(), og = gainNode(0); o.type = 'sine';
    o.frequency.setValueAtTime(rnd(900, 1400), t); o.frequency.exponentialRampToValueAtTime(rnd(380, 520), t + 0.06);
    o.connect(og); panInto(og, pan, rainBus);
    og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(vol*0.5, t + 0.004); og.gain.exponentialRampToValueAtTime(0.0005, t + 0.09);
    o.start(t); o.stop(t + 0.12);
  }
}
function rainStep(dt, k, t){
  rainBus.gain.setTargetAtTime(0.55, t, 1.2);
  rainHiss.gain.setTargetAtTime(0.025 + 0.075*k*k, t, 1.5);
  rainLow.gain.setTargetAtTime(0.03 + 0.06*k, t, 1.5);
  rainAcc += dt*(6 + 26*k);
  let n = 0;
  while (rainAcc >= 1 && n < 8){ rainAcc -= 1; n++; rainDrop(t + rnd(0, 0.05), rnd(-0.9, 0.9), rnd(0.02, 0.07), Math.random() < 0.06); }
  if (rainAcc > 4) rainAcc = 0;
}

// ───────────────────────── leaves & wind
function rustle(o, t){
  const src = ctx.createBufferSource(); src.buffer = o.buf || pick(rustleBufs);
  src.playbackRate.value = o.rate || rnd(0.75, 1.2);
  const hp = filt('highpass', o.hp || rnd(550, 1100), 0.5);
  const lp = filt('lowpass', o.bright || rnd(2800, 5200), 0.4);
  const g = gainNode(o.vol);
  src.connect(hp); hp.connect(lp); lp.connect(g);
  panInto(g, o.pan, bus[o.bus || 'amb']);
  src.start(t + (o.delay || 0));
}

// called every frame with the game's wind (roughly -50..50)
function ambStep(dt, wind, t){
  const w = clamp(Math.abs(wind) / 42, 0, 1);
  windLP.frequency.setTargetAtTime(240 + 650 * w, t, 0.6);
  windGain.gain.setTargetAtTime(0.06 + 0.2 * w * w, t, 0.7);
  airGain.gain.setTargetAtTime(0.006 + 0.035 * w * w, t, 0.9);
  if (!prefs.amb) return;
  // a gentle trickle of rustles, more when the wind picks up
  if (Math.random() < (1.6 + 4 * w * w) * dt) rustle({ vol: rnd(0.05, 0.12) * (0.7 + 0.8 * w), pan: rnd(-0.85, 0.85) }, t);
  // now and then a little pile shifts
  if (Math.random() < 0.04 * (1 + 3 * w) * dt){ const p = rnd(-0.7, 0.7), n = 2 + (Math.random() * 3 | 0); for (let i = 0; i < n; i++) rustle({ delay: rnd(0, 0.6), vol: rnd(0.04, 0.09), pan: p + rnd(-0.15, 0.15) }, t); }
}

// ───────────────────────── small instruments
function pluck(midi, t, vol, len, dest, bright){
  const f = mtof(midi), dec = clamp(0.45 + len * 0.55, 0.45, 2.4);
  const lp = filt('lowpass', bright || 3000, 0.5);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.007); g.gain.setTargetAtTime(0, t + 0.01, dec / 3.5);
  const g2 = ctx.createGain(); g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(vol * 0.28, t + 0.004); g2.gain.setTargetAtTime(0, t + 0.006, dec / 14);
  const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = f;
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 3.01;   // a bright tine on the attack
  o1.connect(g); o2.connect(g2); g.connect(lp); g2.connect(lp); lp.connect(dest);
  wobble.connect(o1.detune); wobble.connect(o2.detune);
  const end = t + dec * 1.7;
  o1.start(t); o2.start(t); o1.stop(end); o2.stop(end);
  o1.onended = () => { try { wobble.disconnect(o1.detune); wobble.disconnect(o2.detune); } catch (e) {} };
}

function pad(notes, t, dur, vol){
  const lp = filt('lowpass', 750, 0.3);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(1, dur * 0.4)); g.gain.setTargetAtTime(0, t + dur, 0.55);
  lp.connect(g); g.connect(bus.music);
  const end = t + dur + 3;
  const oscs = [];
  for (const m of notes) for (const dt of [-7, 7]){
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m); o.detune.value = dt;
    o.connect(lp); o.start(t); o.stop(end); oscs.push(o);
  }
}

function bassNote(midi, t, dur, vol){
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.03); g.gain.setTargetAtTime(vol * 0.5, t + 0.05, 0.4); g.gain.setTargetAtTime(0, t + dur, 0.2);
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(midi);
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = mtof(midi + 12);
  const g2 = gainNode(0.3);
  o.connect(g); o2.connect(g2); g2.connect(g); g.connect(bus.music);
  o.start(t); o2.start(t); o.stop(t + dur + 1.2); o2.stop(t + dur + 1.2);
}

// ───────────────────────── robots
// Each robot has its own little voice. Bases are MIDI notes; everything is lowpassed so it stays soft.
const VOICES = [
  { base: 76, type: 'sine',     lp: 2400, gain: 1.0 },                 // Tinker: a squeaky old friend
  { base: 81, type: 'sine',     lp: 2800, gain: 0.85, fast: true },    // Pip: quick and high
  { base: 67, type: 'triangle', lp: 1500, gain: 1.0, slow: true },     // Clunk: low and steady
  { base: 72, type: 'triangle', lp: 1900, gain: 0.95, rough: true },   // Rivet: a bit wonky
  { base: 79, type: 'sine',     lp: 2600, gain: 0.9, vib: true },      // Juniper: round, with a little vibrato
  { base: 62, type: 'triangle', lp: 1300, gain: 1.0, slow: true, vib: true }, // blowers: a low, hoomy trumpet
  { base: 86, type: 'square',   lp: 2200, gain: 0.5, fast: true },     // shakers: tiny clicky crab chirps
  { base: 84, type: 'sine',     lp: 3600, gain: 0.75, vib: true },     // Sterling (robot 6): crisp, clear and a touch posh
  { base: 70, type: 'square',   lp: 1400, gain: 0.45 },                // Bolt (robot 7): a gruff factory buzzer
  { base: 74, type: 'triangle', lp: 2100, gain: 0.95, slow: true },    // Moss (robot 8): soft and unhurried
  { base: 78, type: 'triangle', lp: 2600, gain: 0.85, vib: true },     // Copper (robot 9): a little hum to it
  { base: 65, type: 'sine',     lp: 1700, gain: 1.0, rough: true },    // Ember (robot 10): low and warm
  { base: 83, type: 'triangle', lp: 3000, gain: 0.8, fast: true },    // Kettle (robot 11): a bright little toot
  { base: 69, type: 'sine',     lp: 2000, gain: 0.95, slow: true, vib: true }, // Lantern (robot 12): soft and careful
];
// notes: [semitone, seconds, glide-to semitone?]
const MOODS = {
  chat(){ const n = 2 + (Math.random() < 0.45 ? 1 : 0), out = []; let s = pick([0, 2, 4, 7]); for (let i = 0; i < n; i++){ out.push([s, rnd(0.06, 0.11)]); s = pick([0, 2, 4, 7, 9].filter(x => x !== s)); } if (Math.random() < 0.4) out[out.length - 1][2] = out[out.length - 1][0] + pick([2, -2, 3]); return out; },
  happy: () => [[0, 0.07], [4, 0.07], [7, 0.14, 9]],
  hmm:   () => [[4, 0.13], [0, 0.2, -3]],
  ok:    () => [[7, 0.07], [12, 0.1]],
  sleepy: () => [[2, 0.2, -2]],
  proud: () => [[0, 0.06], [4, 0.06], [7, 0.06], [12, 0.2, 14]],
  hello: () => [[7, 0.09], [4, 0.08], [12, 0.24, 12.6]],
};
function beepAt(ri, mood, pan, vol, t){
  const v = VOICES[((ri | 0) % VOICES.length + VOICES.length) % VOICES.length], notes = (MOODS[mood] || MOODS.chat)();
  const sp = v.fast ? 0.8 : v.slow ? 1.25 : 1;
  const o = ctx.createOscillator(); o.type = v.type;
  const lp = filt('lowpass', v.lp, 0.7), g = ctx.createGain(); g.gain.setValueAtTime(0, t);
  o.connect(lp); lp.connect(g); panInto(g, pan, bus.sfx);
  let vib = null;
  if (v.vib || v.rough){ vib = ctx.createOscillator(); vib.frequency.value = v.vib ? 6.5 : 13; const vg = gainNode(v.vib ? 22 : 14); vib.connect(vg); vg.connect(o.detune); vib.start(t); }
  const peak = 0.1 * (vol == null ? 1 : vol) * v.gain;
  let tt = t;
  o.frequency.setValueAtTime(mtof(v.base + notes[0][0]), t);
  for (const [s, d0, gl] of notes){
    const d = d0 * sp;
    o.frequency.setTargetAtTime(mtof(v.base + s), tt, 0.009);
    if (gl != null) o.frequency.setTargetAtTime(mtof(v.base + gl), tt + d * 0.35, d * 0.45);
    g.gain.setTargetAtTime(peak, tt, 0.007);
    g.gain.setTargetAtTime(0, tt + d, 0.02);
    tt += d + 0.035 * sp;
  }
  o.start(t); o.stop(tt + 0.3); if (vib) vib.stop(tt + 0.3);
}

function tinkAt(pan, vol, t){
  const f = rnd(1750, 2250);
  for (const [k, a, tau] of [[1, 1, 0.07], [2.76, 0.45, 0.035]]){
    const o = ctx.createOscillator(); o.frequency.value = f * k;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045 * vol * a, t + 0.002); g.gain.setTargetAtTime(0, t + 0.003, tau);
    o.connect(g); panInto(g, pan, bus.sfx); o.start(t); o.stop(t + 0.5);
  }
}

// a soft putter for the compost truck: low noise pulsed about eleven times a second
function rumble(t, dur, panFrom, panTo, vol){
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true; src.loopStart = rnd(0, 2);
  const lp = filt('lowpass', 260, 1.1), am = gainNode(0.55), env = ctx.createGain();
  const lfo = ctx.createOscillator(); lfo.frequency.value = rnd(10, 12.5); const lg = gainNode(0.45); lfo.connect(lg); lg.connect(am.gain);
  env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(vol, t + Math.min(0.7, dur * 0.3)); env.gain.setValueAtTime(vol, t + dur * 0.6); env.gain.linearRampToValueAtTime(0, t + dur);
  src.connect(lp); lp.connect(am); am.connect(env);
  const p = panInto(env, panFrom, bus.amb);
  if (p){ p.pan.setValueAtTime(clamp(panFrom, -1, 1), t); p.pan.linearRampToValueAtTime(clamp(panTo, -1, 1), t + dur); }
  src.start(t); lfo.start(t); src.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
}

function hornAt(pan, t){
  for (let i = 0; i < 2; i++){
    const s = t + i * 0.24, g = ctx.createGain(), lp = filt('lowpass', 1100, 0.6);
    g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.06, s + 0.025); g.gain.setValueAtTime(0.06, s + 0.12); g.gain.linearRampToValueAtTime(0, s + 0.17);
    for (const m of [67, 71]){ const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m); o.connect(lp); o.start(s); o.stop(s + 0.2); }
    lp.connect(g); panInto(g, pan, bus.sfx);
  }
}

// ───────────────────────── music: a slow waltz in F that comes and goes
const BEAT = 60 / 78, BAR = BEAT * 3;
const CHORDS = {
  F:  { pad: [53, 57, 60, 64], root: 41 },
  Am: { pad: [57, 60, 64, 67], root: 45 },
  Bb: { pad: [58, 62, 65, 69], root: 46 },
  Dm: { pad: [50, 57, 60, 65], root: 38 },
  Gm: { pad: [55, 58, 62, 65], root: 43 },
  C:  { pad: [48, 55, 58, 64], root: 36 },
};
// [bar, beat, midi, beats]
const TUNE_A = [
  [0, 0, 72, 2], [0, 2, 69, 1],
  [1, 0, 76, 2], [1, 2, 72, 1],
  [2, 0, 74, 1.5], [2, 1.5, 72, 0.5], [2, 2, 70, 1],
  [3, 0, 69, 3],
  [4, 0, 74, 2], [4, 2, 77, 1],
  [5, 0, 74, 1], [5, 1, 72, 1], [5, 2, 70, 1],
  [6, 0, 69, 1.5], [6, 1.5, 70, 0.5], [6, 2, 67, 1],
  [7, 0, 67, 1.5], [7, 1.5, 69, 0.5], [7, 2, 70, 1],
];
const CH_A = ['F', 'Am', 'Bb', 'F', 'Dm', 'Bb', 'Gm', 'C'];
const TUNE_B = [
  [0, 0, 77, 2], [0, 2, 72, 1],
  [1, 0, 76, 1], [1, 1, 74, 1], [1, 2, 72, 1],
  [2, 0, 74, 2], [2, 2, 77, 1],
  [3, 0, 72, 3],
  [4, 0, 69, 1], [4, 1, 74, 1], [4, 2, 77, 1],
  [5, 0, 77, 1.5], [5, 1.5, 76, 0.5], [5, 2, 74, 1],
  [6, 0, 67, 1], [6, 1, 72, 1], [6, 2, 76, 1],
  [7, 0, 77, 3],
];
const CH_B = ['F', 'Am', 'Bb', 'F', 'Dm', 'Bb', 'C', 'F'];

const mus = { t: 0, plan: [], idx: 0, cycle: 0 };
function phrase(chords, tune, o){
  return chords.map((c, i) => ({ chord: c, mel: tune ? tune.filter(n => n[0] === i).map(n => [n[1], n[2], n[3]]) : [], pad: true, bass: o.bass, oom: o.oom, oct: o.oct || 0, vel: o.vel || 1 }));
}
function buildPlan(cycle){
  const bars = [];
  const rest = n => { for (let i = 0; i < n; i++) bars.push({ rest: true }); };
  rest(cycle === 0 ? 4 : 0);
  // a soft way in
  bars.push(...phrase(['F', 'Bb', 'F', 'C'], null, { bass: true, oom: false }));
  const musicBox = cycle > 0 && Math.random() < 0.4;   // sometimes the tune comes back an octave up, sparser
  const o = musicBox ? { bass: false, oom: false, oct: 12, vel: 0.75 } : { bass: true, oom: true };
  bars.push(...phrase(CH_A, TUNE_A, o));
  bars.push(...phrase(CH_B, TUNE_B, o));
  if (Math.random() < 0.5) bars.push(...phrase(CH_B, TUNE_B, { bass: true, oom: false, oct: musicBox ? 0 : 12, vel: 0.7 }));
  // drift out, then a long stretch of just leaves and wind
  bars.push(...phrase(['Bb', 'F'], null, { bass: true, oom: false }));
  rest(Math.round(rnd(20, 50) / BAR));
  return bars;
}
function playBar(b, t){
  if (b.rest) return;
  const c = CHORDS[b.chord];
  if (b.pad) pad(c.pad, t, BAR + 0.15, 0.022);
  if (b.bass) bassNote(c.root, t, BAR * 0.9, 0.07);
  if (b.oom){ const top = c.pad.slice(-2); for (const k of [1, 2]) for (const m of top) pluck(m, t + k * BEAT, 0.03, 0.6, bus.music, 1800); }
  for (const [beat, m, d] of b.mel) pluck(m + b.oct, t + beat * BEAT + rnd(-0.006, 0.012), (0.12 + rnd(-0.015, 0.015)) * b.vel, d * BEAT, bus.music, b.oct ? 3800 : 3000);
}
function musicPump(horizon, now){
  if (!prefs.music) return;
  now = now == null ? ctx.currentTime : now;
  if (mus.t < now) mus.t = now + 0.2;
  while (mus.t < now + horizon){
    if (mus.idx >= mus.plan.length){ mus.plan = buildPlan(mus.cycle++); mus.idx = 0; }
    playBar(mus.plan[mus.idx++], mus.t);
    mus.t += BAR;
  }
}

// ───────────────────────── public API (positions come in as pan -1..1 and a 0..1 loudness)
const api = {
  prefs,
  get ready(){ return !!ctx; },
  unlock,
  set: setPref,
  toggle(k){ setPref(k, !prefs[k]); },
  onChange(f){ listeners.add(f); },

  update(dt, wind){ if (live()) ambStep(dt, wind, ctx.currentTime); },
  rain(dt, k){ if (live() && rainBus) rainStep(dt, k, ctx.currentTime); },   // V14: only the Rainy hollow calls this

  // a robot's arm closes on some leaves
  grab(n, pan, vol){ if (!live() || !prefs.amb || !gate('grab', 0.08)) return; rustle({ buf: rustleBufs[1 + 3 * (Math.random() * 3 | 0)], rate: rnd(1.1, 1.45), vol: (0.07 + 0.015 * Math.min(n, 6)) * vol, pan, bright: rnd(3500, 5500) }, ctx.currentTime); },
  // leaves tip into the bin
  dump(n, pan, vol){ if (!live() || !prefs.amb || !gate('dump', 0.12)) return; const t = ctx.currentTime; const k = Math.min(3, 1 + Math.floor(n / 4)); for (let i = 0; i < k; i++) rustle({ delay: i * 0.07, rate: rnd(0.8, 1.05), vol: (0.09 + 0.01 * Math.min(n, 8)) * vol, pan: pan + rnd(-0.08, 0.08), bright: rnd(2600, 4200) }, t); },
  // your tap pushes the leaves around
  kick(n, pan){ if (!live() || !prefs.amb || !gate('kick', 0.05)) return; const t = ctx.currentTime; rustle({ rate: rnd(1.0, 1.3), vol: n ? clamp(0.08 + n * 0.012, 0.08, 0.2) : 0.05, pan, bright: n ? rnd(3800, 5600) : 2600 }, t); if (n > 6) rustle({ delay: 0.05, vol: 0.08, pan: pan + 0.1 }, t); },
  // a robot says something
  beep(ri, mood, pan, vol, force){
    if (!live() || !prefs.sfx) return;
    if (!force && !gate('chatter', 7)) return;
    if (force && !gate('beep' + mood + ri, 0.25)) return;
    beepAt(ri, mood, pan || 0, vol, ctx.currentTime + 0.02);
  },
  tink(pan, vol){ if (!live() || !prefs.sfx || !gate('tink', 0.14)) return; tinkAt(pan, vol, ctx.currentTime); },
  clink(n, pan, vol){ if (!live() || !prefs.sfx || !gate('clink', 0.2)) return; for (let i = 0; i < Math.min(n, 4); i++) tinkAt(pan + rnd(-0.1, 0.1), vol * 0.8, ctx.currentTime + i * 0.06); },
  // paper rustle when a card opens
  paper(){ if (!live() || !prefs.sfx || !gate('paper', 0.1)) return; rustle({ buf: rustleBufs[2], rate: rnd(1.4, 1.7), vol: 0.05, pan: 0, bright: 6000, hp: 1500, bus: 'sfx' }, ctx.currentTime); },
  deny(){ if (!live() || !prefs.sfx || !gate('deny', 0.15)) return; beepAt(2, 'hmm', 0, 0.6, ctx.currentTime); },

  truckIn(pan, dur){ if (!live() || !prefs.amb) return; rumble(ctx.currentTime, dur || 2.6, 0.95, pan, 0.5); },
  truckOut(pan){ if (!live() || !prefs.amb) return; rumble(ctx.currentTime, 2.4, pan, -1, 0.5); },
  horn(pan){ if (!live() || !prefs.sfx || !gate('horn', 3)) return; hornAt(pan, ctx.currentTime + 0.05); },
  // the bin is tipped into the truck
  pour(leaves, metal, pan){
    if (!live()) return;
    const t = ctx.currentTime;
    if (prefs.amb && leaves > 0){ const n = clamp(Math.round(2 + leaves / 6), 2, 10); for (let i = 0; i < n; i++) rustle({ delay: 0.45 + i * rnd(0.09, 0.16), rate: rnd(0.75, 1.1), vol: rnd(0.08, 0.13), pan: pan + rnd(-0.15, 0.15), bright: rnd(2500, 4200) }, t); }
    if (prefs.sfx && metal > 0) for (let i = 0; i < Math.min(metal, 6); i++) tinkAt(pan + rnd(-0.1, 0.1), 0.7, t + 0.55 + i * 0.09);
  },
  // the truck pays: a small music-box arpeggio, longer for bigger loads
  coins(amount){
    if (!live() || !prefs.sfx || !gate('coins', 0.4)) return;
    const n = clamp(2 + Math.round(Math.log10(1 + amount)), 3, 6), notes = [77, 81, 84, 86, 89, 93], t = ctx.currentTime + 0.05;
    for (let i = 0; i < n; i++) pluck(notes[i], t + i * 0.085, 0.07, 0.5, bus.sfx, 4200);
  },
  // purchases
  chime(kind){
    if (!live() || !prefs.sfx || !gate('chime', 0.08)) return;
    const t = ctx.currentTime + 0.02;
    if (kind === 'land'){
      pad([53, 60, 64, 67, 69], t, 2.6, 0.03);
      [65, 69, 72, 76, 77, 81].forEach((m, i) => pluck(m, t + 0.2 + i * 0.13, 0.08, 1, bus.sfx, 3800));
    } else if (kind === 'tech'){
      [72, 76, 79, 84, 88].forEach((m, i) => pluck(m, t + i * 0.07, 0.065, 0.6, bus.sfx, 4500));
    } else if (kind === 'sale'){
      pluck(81, t, 0.07, 1, bus.sfx, 4000); pluck(77, t + 0.18, 0.07, 1.4, bus.sfx, 4000);
    } else {
      pluck(79, t, 0.06, 0.5, bus.sfx, 4000); pluck(84, t + 0.08, 0.06, 0.8, bus.sfx, 4000);
    }
  },

  // test hook: render into an OfflineAudioContext
  _test: {
    init(c){ init(c); master.gain.value = level(); },
    ambStep, beepAt, musicPump, tinkAt, rumble, hornAt, pluck,
    api: () => api,
    force(){ return { ctx, bus }; },
  },
};
window.LeafSound = api;
})();
