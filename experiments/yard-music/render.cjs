// Standalone composition study. No game imports, runtime changes or dependencies.
// Run: node experiments/yard-music/render.cjs
const fs = require('node:fs');
const path = require('node:path');
const SR = 44100, TAU = 2 * Math.PI;
const chords = {
  F:[41,53,57,60,64], Am:[45,55,57,60,64], Bb:[46,53,58,62,65],
  Dm:[38,50,57,60,65], Gm:[43,53,55,58,62], C:[36,52,55,58,62],
  Eb:[39,51,55,58,62], A:[45,52,57,61,67],
};
// Each melody bar is [MIDI pitch, duration in quarter notes], with 0 for a rest.
const tracks = [
 {id:'01-petal-waltz', title:'Petal Waltz', yard:'Wildflower prairie', bpm:82, key:'F major', mood:'Closest to the original: a light, lilting tune with little upward turns.',
  a:['F','Am','Bb','F','Dm','Gm','C','F'], b:['Bb','F','Gm','C','Dm','Bb','C','F'],
  ma:[[[69,1],[72,1],[77,1]],[[76,1.5],[72,.5],[69,1]],[[70,1],[74,1],[77,1]],[[76,1],[72,2]],[[74,1.5],[77,.5],[81,1]],[[79,1],[77,1],[74,1]],[[76,1],[74,.5],[72,.5],[70,1]],[[69,2],[0,1]]],
  mb:[[[77,1],[79,.5],[77,.5],[74,1]],[[72,1],[69,1],[65,1]],[[67,1],[70,1],[74,1]],[[76,2],[0,1]],[[77,1],[81,1],[79,1]],[[77,1.5],[74,.5],[70,1]],[[72,1],[76,1],[79,1]],[[77,3]]]},
 {id:'02-clover-and-honey', title:'Clover & Honey', yard:'Wildflower prairie', bpm:76, key:'F major', mood:'A quieter flower-yard option: spacious phrases, delicate high replies, a softer sway.', sparse:true,
  a:['F','Bb','Am','Dm','Gm','C','Bb','F'], b:['Dm','Am','Bb','F','Gm','Bb','C','F'],
  ma:[[[72,1.5],[69,.5],[65,1]],[[70,2],[74,1]],[[72,1],[76,1],[0,1]],[[77,2],[74,1]],[[70,1.5],[67,.5],[65,1]],[[64,1],[67,2]],[[65,1],[70,1],[69,1]],[[65,2],[0,1]]],
  mb:[[[69,1],[74,1],[77,1]],[[76,2],[72,1]],[[74,1.5],[77,.5],[79,1]],[[77,2],[0,1]],[[74,1],[70,1],[67,1]],[[70,2],[74,1]],[[72,1.5],[70,.5],[67,1]],[[69,1],[65,2]]]},
 {id:'03-lanterns-in-the-rain', title:'Lanterns in the Rain', yard:'Rainy hollow', bpm:66, key:'D minor / F major', mood:'Warm shelter in a wet yard: lower plucks, suspended chords and a hopeful major-key middle.', rainy:true,
  a:['Dm','Bb','F','C','Gm','Dm','A','Dm'], b:['Bb','F','Gm','C','Bb','F','A','Dm'],
  ma:[[[69,2],[65,1]],[[62,1.5],[65,.5],[70,1]],[[69,2],[67,1]],[[64,2],[0,1]],[[65,1],[67,1],[70,1]],[[69,1.5],[65,.5],[62,1]],[[64,1],[61,2]],[[62,2],[0,1]]],
  mb:[[[70,1],[74,1],[77,1]],[[76,2],[72,1]],[[74,1.5],[70,.5],[67,1]],[[72,2],[0,1]],[[74,1],[70,1],[65,1]],[[69,2],[72,1]],[[73,1],[69,1],[64,1]],[[65,1],[62,2]]]},
 {id:'04-puddle-postcards', title:'Puddle Postcards', yard:'Rainy hollow', bpm:70, key:'G minor / B-flat major', mood:'A gently curious rain tune: tiny droplet-like answers over mellow, moving harmony.', rainy:true, sparse:true,
  a:['Gm','Eb','Bb','F','Gm','Dm','Eb','Gm'], b:['Bb','F','Eb','Gm','Bb','Eb','F','Gm'],
  ma:[[[74,1.5],[70,.5],[67,1]],[[67,2],[65,1]],[[62,1],[65,1],[70,1]],[[69,2],[0,1]],[[70,1],[74,1],[77,1]],[[77,1.5],[74,.5],[69,1]],[[70,1],[67,1],[65,1]],[[67,2],[0,1]]],
  mb:[[[74,2],[77,1]],[[76,1],[72,1],[69,1]],[[70,1.5],[74,.5],[79,1]],[[77,2],[74,1]],[[77,1],[74,1],[70,1]],[[74,1],[70,1],[67,1]],[[69,1.5],[65,.5],[69,1]],[[70,1],[67,2]]]},
];
function compose(s) {
 const beat=60/s.bpm, events=[];
 const add=(voice,midi,t,dur,amp,pan=0)=>events.push({voice,midi,t,dur,amp,pan});
 const plan=[...s.a.slice(0,2).map(ch=>({ch,section:'intro'}))];
 for(const section of ['A','B','return']) for(let b=0;b<8;b++) plan.push({ch:(section==='B'?s.b:s.a)[b],mel:(section==='B'?s.mb:s.ma)[b],section,b});
 plan.push({ch:s.rainy?s.a[0]:'Bb',section:'outro'},{ch:s.a[0],section:'outro'});
 plan.forEach((bar,i)=>{
  const t=.35+i*beat*3, c=chords[bar.ch], quiet=bar.section==='intro'||bar.section==='outro';
  c.slice(1).forEach((m,j)=>add('pad',m,t,beat*3+.15,.024,(j-1.5)*.19));
  add('bass',c[0],t,beat*2.65,quiet?.08:.105);
  if(!quiet) {
   for(const k of [1,2]) for(const m of c.slice(-2)) add('pluck',m,t+k*beat,.48,.028*(s.sparse?.6:1),-.27);
   let offset=0;
   for(const [m,d] of bar.mel){
    if(m) add('lead',m,t+offset*beat+.005*Math.sin(i*7+offset),d*beat,.15*(bar.section==='return'?.87:1),.12);
    offset+=d;
   }
   // A quiet answering figure in the second phrase and on alternating return bars.
   if((bar.section==='B'||bar.section==='return')&&bar.b%2===1&&bar.b!==7){
    add('bell',c[3]+12,t+1.5*beat,.8,.035,-.45);
    add('bell',c[4]+12,t+2.5*beat,.8,.028,.42);
   }
  } else if(bar.section==='outro') add('lead',c[1]+12,t,beat*3,.065,.08);
 });
 return {events,duration:.35+plan.length*3*beat+5,plan};
}
function render(s) {
 const score=compose(s), n=Math.ceil(score.duration*SR), L=new Float32Array(n), R=new Float32Array(n);
 for(const e of score.events){
  const f=440*2**((e.midi-69)/12), pad=e.voice==='pad', bass=e.voice==='bass';
  const decay=Math.min(2.4,.45+e.dur*.55), span=pad?e.dur+3:bass?e.dur+1.5:decay*2.5;
  const start=Math.round(e.t*SR), len=Math.min(n-start,Math.ceil(span*SR));
  const gl=Math.cos((e.pan+1)*Math.PI/4),gr=Math.sin((e.pan+1)*Math.PI/4);
  let phase=0;
  for(let j=0;j<len;j++){
   const t=j/SR, drift=pad?0:5*Math.sin(TAU*.37*(e.t+t));
   phase+=TAU*f/SR*2**(drift/1200);
   let v;
   if(pad){
    const env=Math.min(1,t/.9)*(t<e.dur?1:Math.exp(-(t-e.dur)/.55));
    v=(Math.sin(TAU*f*2**(-7/1200)*t)+Math.sin(TAU*f*2**(7/1200)*t))*.5*env;
   } else if(bass){
    const env=Math.min(1,t/.03)*(.5+.5*Math.exp(-t/.4))*(t<e.dur?1:Math.exp(-(t-e.dur)/.2));
    v=(Math.sin(phase)+.3*Math.sin(2*phase))*env;
   } else {
    const attack=Math.min(1,t/.007), bright=e.voice==='bell'?.34:s.rainy?.14:.25;
    v=attack*(Math.sin(phase)*Math.exp(-t/(decay/3.5))+bright*Math.sin(phase*3.01)*Math.exp(-t/(decay/14)));
   }
   // Smooth all oscillator endings to avoid a truncation click.
   v*=e.amp*Math.min(1,(len-j)/(SR*.025));
   L[start+j]+=v*gl;R[start+j]+=v*gr;
  }
 }
 // Deterministic diffuse room; darkened cross-channel reflections.
 const wetL=new Float32Array(n),wetR=new Float32Array(n);
 let lpL=0,lpR=0;
 for(let i=0;i<n;i++){lpL+=(L[i]-lpL)*.16;lpR+=(R[i]-lpR)*.16;wetL[i]=lpL;wetR[i]=lpR;}
 const room=s.rainy?.24:.19;
 for(let k=0;k<18;k++){
  const d=Math.round(SR*(.069+k*.079+(k%3)*.011)), gain=room*Math.exp(-k/4.1)/(1+k*.07);
  for(let i=d;i<n;i++){L[i]+=wetR[i-d]*gain;R[i]+=wetL[i-d]*gain;}
 }
 let peak=0, sum=0;
 for(let i=0;i<n;i++){
  const fade=Math.min(1,i/(SR*.08),(n-1-i)/(SR*2));
  L[i]*=fade;R[i]*=fade;peak=Math.max(peak,Math.abs(L[i]),Math.abs(R[i]));sum+=L[i]**2+R[i]**2;
 }
 // Match average loudness between sketches, with at least 3 dB peak headroom.
 const rms=Math.sqrt(sum/(n*2)), scale=Math.min(.105/rms,.70/peak);
 const out=Buffer.alloc(44+n*4);
 out.write('RIFF');out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(2,22);out.writeUInt32LE(SR,24);out.writeUInt32LE(SR*4,28);out.writeUInt16LE(4,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(n*4,40);
 for(let i=0;i<n;i++){out.writeInt16LE(Math.round(L[i]*scale*32767),44+i*4);out.writeInt16LE(Math.round(R[i]*scale*32767),46+i*4);}
 fs.writeFileSync(path.join(__dirname,s.id+'.wav'),out);
 fs.writeFileSync(path.join(__dirname,s.id+'.score.json'),JSON.stringify({...s,...score},null,2));
 return {...s,seconds:+score.duration.toFixed(2),peakDb:+(20*Math.log10(peak*scale)).toFixed(2),rmsDb:+(20*Math.log10(rms*scale)).toFixed(2),events:score.events.length};
}
const results=tracks.map(render);
fs.writeFileSync(path.join(__dirname,'manifest.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify(results.map(({title,seconds,peakDb,rmsDb,events})=>({title,seconds,peakDb,rmsDb,events})),null,2));
