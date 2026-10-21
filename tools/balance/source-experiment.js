/* Browser experiment extension. Paid arms replay the complete earned prefix before
 * changing decisions. Capacity fixtures explicitly grant capital, and never count
 * as campaign completion evidence. No production source is changed. */
(() => {
  const Y=__leafYard,F=Y.fn(),O=window.__experimentOptions;
  const D=Y.dev('({TRACKS,TECH,UP,GEN,DRY_BENCH,ROBOT_MAX,MAX_BEES,SPOTS})');
  const base=window.__policy,baseChoose=window.__choose;
  const clone=x=>JSON.parse(JSON.stringify(x));
  let active=false,start=0,finished=false,assignmentKey='',assignment=[];
  const E=window.__experiment={options:O,checkpoint:null,points:[],fixturePurchases:[],spend:{leaf:0,honey:0,raw:0,industry:0,shared:0}};
  const totals=()=>({t:Y.state().t-start,cash:Y.state().cash,earned:Y.state().totals.cash,src:clone(window.__src),
    lv:clone(Y.state().lv),gen:clone(Y.state().gen),bees:Y.state().hive.bees,crew:Y.state().robots.length,
    plant:Y.state().plant.built,totals:clone(Y.state().totals),jobs:clone(Y.state().robots.map(c=>c.prio))});
  function group(o){
    if(['hive','bee','hiveUp','honeyPack'].includes(o.id)||['hiveTank','hiveStore','honeyPrice','giftPrice','snip','clover','seeding'].includes(o.key))return'honey';
    if(['plant'].includes(o.id)||['smeltSpeed','ingotGrade','slag','hopper','pallet','stoke'].includes(o.key)&&o.id!=='tech')return'industry';
    if(['metalSlot','miner','shaft'].includes(o.id)||['metalPrice','metalBin','dig','cutting','charm'].includes(o.key))return'raw';
    if(['bagger','shaker'].includes(o.id)||['leafPrice','bagPrice','cleanup','bin','pick','grab','reach','blow','shake','dry','press'].includes(o.key))return'leaf';
    if(o.id==='tech')return group({id:'skill',key:D.TECH[o.key].track});
    if(o.id==='rup'&&['drill','magnet','pack'].includes(o.key)){
      const role=assignment[o.ri];return role==='smelt'?'industry':role==='mine'?'raw':role==='honey'?'honey':role==='bag'?'leaf':'shared';
    }
    return'shared';
  }
  function roles(S){
    if(O.roles)return O.roles;
    const n=S.robots.length,kind=O.focus;
    let honey=kind==='leaf'||kind==='skip-honey'||kind==='industry'&&n<8?0:Math.min(O.packers??2,n>=6?2:n>=3?1:0);
    let plant=S.plant.built&&['industry','mixed','skip-honey','skip-leaf'].includes(kind)?Math.min(2,Math.floor(n/3)):0;
    let haul=plant&&n>=6?1:0;
    const slots=S.miners.reduce((n,sp)=>n+(S.shafts.includes(sp)?2:1),0);
    if(plant)honey=Math.min(honey,Math.max(0,n-plant-haul-1));
    let mine=kind==='leaf'?0:Math.min(slots,kind==='honey'?(O.secondary==='raw'?4:0):4,Math.max(0,n-honey-plant-haul-(plant?0:1)));
    let remain=n-honey-plant-haul-mine;
    const bag=!D.DRY_BENCH&&kind!=='skip-leaf'&&remain>=2?1:0;remain-=bag;
    return [...Array(plant).fill('smelt'),...Array(mine).fill('mine'),...Array(haul).fill('haul'),...Array(honey).fill('honey'),...Array(bag).fill('bag'),...Array(remain).fill(kind==='skip-leaf'?'haul':'leaf')];
  }
  function staff(){
    if(O.mode==='paid'&&O.staffing==='main'){
      assignment=Y.state().robots.map(c=>{const row=c.prio.find(row=>!row.includes('research'))||[];return row.includes('mine')?'mine':row.includes('smelt')?'smelt':row.includes('haul')?'haul':row.includes('jar')?'honey':row.includes('bag')?'bag':'leaf';});return;
    }
    const S=Y.state(),n=S.robots.length,rs=roles(S).slice(0,n);
    const key=JSON.stringify([rs,S.robots.map(c=>c.lv)]);
    if(key!==assignmentKey){
      assignmentKey=key;
      // Assign the most specialized jobs first, preserving productive trained workers.
      const available=new Set(Array.from({length:n},(_,i)=>i));assignment=[];
      for(const role of rs){
        const merit=i=>{const c=S.robots[i],v=k=>D.TRACKS[k].vals[c.lv[k]||0];
          return role==='smelt'?v('pack')*(1+.5*(4/v('drill')-1))*(1+.5*v('magnet')):
            role==='mine'?Math.sqrt(v('speed')*v('carry'))/v('drill')*(1+v('magnet')):
            role==='haul'?v('speed')*v('carry'):['honey','bag'].includes(role)?v('pack')*Math.sqrt(v('speed')):
            v('speed')*Math.sqrt(v('carry')*v('grab')*v('reach'))/v('pick');};
        const i=[...available].sort((a,b)=>merit(b)-merit(a)||a-b)[0];assignment[i]=role;available.delete(i);
      }
    }
    const slots=S.miners.flatMap(sp=>S.shafts.includes(sp)?[sp,sp]:[sp]);let slot=0;
    const set=(c,rows,kind,i)=>{const changed=JSON.stringify(c.prio)!==JSON.stringify(rows);c.prio=rows;c.off=(kind==='robot'?['leaves','mine','bag','jar','wrap','smelt','haul','research','refuel','fuel','travel']:kind==='blower'?['bag','blow','dig','stoke','research','travel']:['shake','snip','research','travel']).filter(t=>!rows.flat().includes(t));if(changed)Y.dev(`taskListChanged('${kind}',${i})`);};
    S.robots.forEach(c=>c.miner=null);
    S.robots.forEach((c,i)=>{
      const role=assignment[i];let rows;
      if(role==='mine'&&slot<slots.length){c.miner=slots[slot++];rows=[['mine'],['leaves']];}
      else if(role==='smelt')rows=[['smelt'],['haul'],['leaves']];
      else if(role==='haul')rows=[['haul'],['leaves']];
      else if(role==='honey')rows=[['jar','wrap'],...(!D.DRY_BENCH?[['bag']]:[]),['leaves']];
      else if(role==='bag')rows=[['bag'],['leaves']];
      else rows=[['leaves'],...(!D.DRY_BENCH?[['bag']]:[])];
      if(i===(assignment.indexOf('haul')>=0?assignment.indexOf('haul'):assignment.indexOf('leaf')>=0?assignment.indexOf('leaf'):0))rows.unshift([D.DRY_BENCH?'fuel':'refuel']);
      // Never block a required story gate. Capacity tests intentionally hold travel.
      if(O.mode==='paid'&&S.story.found&&!S.story.done&&i===0)rows.unshift(['research']);
      if(O.mode==='paid'&&S.trip&&i===0)rows.unshift(['travel']);
      set(c,rows,'robot',i);
    });
    const industry=S.plant.built&&assignment.includes('smelt'),mining=assignment.includes('mine');
    S.blowers.forEach((c,i)=>{
      let rows=[['blow']];
      if(industry&&i===0)rows=[['stoke']];
      else if(mining&&O.excavation!==false&&i<(industry?3:2))rows=[['dig'],...(D.DRY_BENCH?[['bag']]:[]),['blow']];
      else if(D.DRY_BENCH)rows=[['bag'],['blow']];
      set(c,rows,'blower',i);
    });
    S.shakers.forEach((c,i)=>set(c,i<(O.snippers??(O.focus==='leaf'?0:1))?[['snip'],['shake']]:[['shake'],['snip']],'shaker',i));
    Y.dev('fixSlots()');
  }
  function fixture(){
    const S=Y.state();E.grantedCapital=10000000;S.cash+=E.grantedCapital;S.peak=Math.max(S.peak,S.cash);
    // Grants are confined to the capacity fixture. Still buy through actual offers
    // so costs, copy discounts, caps and prerequisites are recorded accurately.
    for(let pass=0;pass<2000;pass++){
      const legal=window.__offers().filter(o=>o.id!=='eye'&&o.id!=='land'&&o.key!=='study'&&
        !(o.id==='plant'&&!O.roles.includes('smelt')));
      const o=legal.sort((a,b)=>(a.id==='hiveUp'&&a.key==='nursery'?-1:b.id==='hiveUp'&&b.key==='nursery'?1:a.cost-b.cost))[0];
      if(!o)break;
      if(!window.__buy(o))throw Error('Fixture offer rejected '+JSON.stringify(o));
      E.fixturePurchases.push({...o,group:group(o)});
      if(pass===1999)throw Error('Fixture failed to converge');
    }
    E.fixtureState=clone(S);E.remainingOffers=window.__offers();
    E.priceLadders=Object.fromEntries(Object.entries(F.UP).map(([k,u])=>[k,{costs:u.costs,values:Array.from({length:u.max+1},(_,i)=>u.val(i))}]));
    if(S.robots.length!==O.roles.length)throw Error('Fixture roster differs from requested roles');
    // A marginal-price ablation changes one level in this explicitly artificial fixture.
    if(O.ablate){const [kind,key]=O.ablate.split(':');E.ablation={kind,key,from:S[kind][key]};S[kind][key]--;}
    staff();
  }
  function choose(C,ctx){
    const {S,all,rate:r}=ctx;
    if(O.focus==='main')return baseChoose(C,ctx);
    staff();
    const pool=new Map(C.map(([o,why])=>[[o.id,o.key,o.kind,o.ri,o.arg].join(':'),[o,why]]));
    const add=(o,why)=>{if(o)pool.set([o.id,o.key,o.kind,o.ri,o.arg].join(':'),[o,why]);};
    // The old candidate generator misses excavation and dedicated flower tending.
    for(const o of all){
      if(o.id==='hup'&&o.key==='dig'&&assignment.includes('mine'))add(o,'staffed excavation');
      if(o.id==='hup'&&o.key==='snip'&&assignment.includes('honey'))add(o,'staffed flower tending');
      if(o.id==='tech'&&['cyclone','forge'].includes(o.key)&&assignment.includes(o.key==='cyclone'?'mine':'smelt'))add(o,'unlock staffed helper');
      if(o.id==='rup'&&['pack','drill','magnet','speed','carry'].includes(o.key)){
        const role=assignment[o.ri];
        if(role==='smelt'&&['pack','drill','magnet'].includes(o.key)||role==='honey'&&o.key==='pack'||role==='mine'&&['drill','magnet'].includes(o.key))add(o,'develop specialist');
      }
      if(o.id==='plant'&&['industry','mixed','skip-honey','skip-leaf'].includes(O.focus))add(o,'repair required plant');
      if(o.id==='up'&&['smeltSpeed','slag'].includes(o.key)&&assignment.includes('smelt'))add(o,'physical output');
      if(o.id==='robot'&&S.robots.length<10)add(o,'productive workforce');
    }
    const priceSources={leafPrice:['leaf','bag'],bagPrice:['bag'],honeyPrice:['jar','gift'],giftPrice:['gift'],metalPrice:['metal','ingot'],ingotGrade:['ingot']};
    if(r)for(const o of all){
      let gain=0;
      if(o.id==='up'&&priceSources[o.key]){const u=F.UP[o.key],lv=S.lv[o.key];gain=priceSources[o.key].reduce((n,k)=>n+(r[k]||0),0)*(u.val(lv+1)/u.val(lv)-1);}
      if(o.id==='up'&&o.key==='cleanup')gain=(r.nL||0)*(F.UP.cleanup.val(S.lv.cleanup+1)-F.UP.cleanup.val(S.lv.cleanup))/100;
      if(gain>0&&o.cost/gain<=(O.payback??8))add({...o,payback:o.cost/gain},'measured price return');
    }
    const blocked=g=>O.focus==='skip-honey'&&g==='honey'||O.focus==='skip-leaf'&&g==='leaf'||['leaf','honey','raw'].includes(O.focus)&&g==='industry';
    const candidates=[...pool.values()].filter(([o])=>!blocked(group(o))&&!(o.id==='rup'&&o.key==='study')&&!(o.id==='land')&&
      !(o.id==='rup'&&['drill','magnet'].includes(o.key)&&!['mine','smelt'].includes(assignment[o.ri]))&&
      !(o.id==='rup'&&o.key==='pack'&&!['bag','honey','smelt'].includes(assignment[o.ri])));
    const weights={leaf:1,honey:1,raw:1,industry:1,shared:1.5};
    if(O.focus in weights)weights[O.focus]=O.bias??8;
    if(O.focus==='industry')weights.raw=3;
    if(O.focus==='honey'&&O.secondary==='raw')weights.raw=2;
    const score=([o,why])=>Math.pow(Math.max(.05,o.cost),O.costPower??.85)/weights[group(o)]/
      (o.id==='robot'?(S.robots.length<6?12:4):['repair required plant','start smelting'].includes(why)?5:o.payback?2:1);
    return candidates.sort((a,b)=>score(a)-score(b))[0]||null;
  }
  window.__policy=()=>{
    const S=Y.state();
    if(!active){
      if(!(O.phase===4?S.flags.ruinKnown:S.flags.coalKnown)||S.plant.built)return base();
      active=true;start=S.t;
      E.checkpoint={state:clone(S),src:clone(window.__src),rng:window.__rngState(),runtime:Y.dev('(()=>{const seen=new WeakSet();return JSON.parse(JSON.stringify({R,HB,B,truck,STN,FLOWERS},(k,v)=>{if(v&&typeof v==="object"){if(seen.has(v))return "[reference]";seen.add(v);}return v;}));})()')};
      if(O.mode==='capacity')fixture();
      if(O.mode==='paid'&&O.focus!=='main'&&O.staffing!=='main')window.__assignStaff=()=>{staff();return 10;};
      E.points.push(totals());
    }
    if(finished)return base();
    if(S.t-start>=(O.minutes??20)*60){
      E.points.push(totals());E.end=clone(S);E.finished=true;finished=true;window.__choose=baseChoose;delete window.__assignStaff;
      if(O.mode==='capacity'||O.stop){window.__experimentDone=true;return;}
      return base();
    }
    if(O.mode==='capacity')staff();
    else{
      if(O.focus==='main'){
        const begin=window.__purchases.length;base();
        for(const p of window.__purchases.slice(begin))E.spend[group(p)]+=p.cost;
      }
      else{
        staff();window.__choose=choose;
        const begin=window.__purchases.length;
        // The base manager gathers measured bottlenecks, using __assignStaff so
        // its archived assignments cannot cancel specialized work each second.
        // Refresh after buying in case workforce or skills changed.
        base();staff();
        for(const p of window.__purchases.slice(begin))E.spend[group(p)]+=p.cost;
      }
    }
    if(S.t-start>=E.points.length*60)E.points.push(totals());
  };
})();
