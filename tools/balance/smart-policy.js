/* Goal-directed policy family. Parameters are selected by full paid campaign rollouts,
 * not by terminal cash. This is an empirical speed benchmark, not a proof of optimality.
 * The legacy manager supplies measured bottlenecks; this policy expands its choices,
 * handles goal prerequisites, values research across visits, and limits late reinvestment.
 */
(() => {
  const Y=__leafYard, F=Y.fn(), p={
    growth:2, helpers:2, goals:5, research:5, industry:5, prices:1,
    costPower:.85, payback:5, packers:1, researchCrew:2,
    readiness:'all', endHorizon:3, bankIncome:25, finalPolicy:'legacy', skillStaffing:false,
    ...window.__config, ...window.__config.phases?.[window.__phase]
  };
  window.__researchCrew=p.researchCrew;
  window.__staffOptions={pack:p.packers};
  const definitions=Y.dev('({TRACKS,TECH,INGOT_GOAL,TINKER_GOAL,HONEY_CASH,CANNED_CASH,COAL_GOAL,LOGS_GOAL})');
  const D=definitions, key=o=>[o.id,o.key,o.kind,o.ri,o.arg,o.sty].join(':');
  // Validated completion shortcut. Keep this visible as a balance challenger:
  // retaining the starter hive can beat developing it after its first milestone.
  // The balanced reference remains available with this flag false.
  if(p.freezeHomeHoneyAfterGoal&&window.__phase!==3){
    const previous=window.__auditFilter;
    window.__auditFilter=(o,S)=>previous(o,S)&&!(S.totals.honeyCash>=D.HONEY_CASH&&
      (['hive','bee','hiveUp','honeyPack'].includes(o.id)||['hiveTank','hiveStore','honeyPrice','giftPrice','snip','clover','seeding'].includes(o.key)));
  }
  if(p.excavation)window.__blowerRows=(S,i,rows)=>{
    if(window.__phase!==4||!S.plant.built||!S.shafts.length||i===0||rows.flat().some(t=>['research','travel'].includes(t)))return rows;
    return [['dig'],['blow']];
  };
  // Maximum-weight role matching over the current crew (<=10): bitmask dynamic
  // programming, O(n^2*2^n). These skill-based rates are estimates; full rollouts
  // decide whether this assignment mode helps. Cache until crew/skills change.
  let staffingKey='', staffingOrder=null;
  if(p.skillStaffing)window.__jobOrder=(S,{n,pack,plant,slots,wantMine})=>{
    if(!S.plant.built||S.trip||S.story.found&&!S.story.done)return null;
    const signature=JSON.stringify([n,pack,plant,slots,S.robots.map(c=>c.lv)]);
    if(signature===staffingKey)return staffingOrder;
    staffingKey=signature;
    const roles=Array.from({length:n},(_,j)=>j>=n-pack?'pack':j>=n-pack-plant?(plant===3&&j===n-pack-plant?'haul':'smelt'):j>0&&j<=wantMine?'mine':'leaves');
    const merit=(c,role)=>{
      const v=k=>k==='reach'&&!D.TRACKS.reach?D.TRACKS.grab.reach[c.lv.grab||0]:D.TRACKS[k].vals[c.lv[k]||0], speed=v('speed'),carry=v('carry')/3,pack=v('pack')/.6;
      const drill=D.TRACKS.drill.vals[0]/v('drill'), extra=1+v('magnet');
      return Math.log(role==='smelt'?pack*drill*(1+.5*v('magnet')):role==='mine'?Math.sqrt(speed*carry)*drill*extra:
        role==='haul'?speed*carry*Math.sqrt(pack):role==='pack'?pack*Math.sqrt(speed):speed*Math.sqrt(carry*v('grab')*v('reach')/20)*1.3/v('pick'));
    };
    const dp=new Float64Array(1<<n).fill(-Infinity), previous=new Int16Array(1<<n);dp[0]=0;
    for(let mask=0;mask<1<<n;mask++){
      let count=0;for(let v=mask;v;v&=v-1)count++;
      if(count===n)continue;
      for(let i=0;i<n;i++)if(!(mask&(1<<i))){const next=mask|1<<i,value=dp[mask]+merit(S.robots[i],roles[count]);if(value>dp[next]){dp[next]=value;previous[next]=i;}}
    }
    const order=Array(n);let mask=(1<<n)-1;
    for(let j=n-1;j>=0;j--){const i=previous[mask];order[i]=j;mask^=1<<i;}
    const old=staffingOrder&&staffingOrder.length===n?staffingOrder:Array.from({length:n},(_,i)=>i);
    const oldScore=old.reduce((sum,j,i)=>sum+merit(S.robots[i],roles[j]),0);
    staffingOrder=dp[(1<<n)-1]>oldScore+Math.log(1.1)?order:old;
    return staffingOrder;
  };
  const leaf=['speed','carry','pick','grab','reach'];
  const prices=['leafPrice','bagPrice','cleanup','metalPrice','honeyPrice','giftPrice','ingotGrade'];
  const priceSources={leafPrice:['leaf','bag'],bagPrice:['bag'],metalPrice:['metal','ingot'],honeyPrice:['jar','gift'],giftPrice:['gift'],ingotGrade:['ingot']};
  window.__choose=(old,ctx)=>{
    const {S,all,inc,L,rate:r}=ctx, phase=window.__phase;
    const candidates=new Map(), slots=S.miners.reduce((n,sp)=>n+(S.shafts.includes(sp)?2:1),0);
    const ready=phase===0&&S.flags.tinkerGoal&&Y.dev('tinkerWorth()<TINKER_GOAL');
    if(S.trip&&!ready){
      const missing=S.trip.crew?.includes('blower')&&!S.blowers.length&&all.find(o=>o.id==='blower');
      return missing?[missing,'required travelling Blower']:null;
    }
    const remaining=D.INGOT_GOAL-(S.totals.ingotsSold||0);
    const endMinutes=phase===4&&r?.nI>0 ? remaining/r.nI : Infinity;
    const horizon=Math.min(p.payback,endMinutes);
    if(p.excavation&&phase===4&&S.plant.built&&S.shafts.length&&endMinutes>2){
      if(S.blowers.length<Math.min(3,1+S.shafts.length)){
        const helper=all.find(o=>o.id==='blower');if(helper)old.push([helper,'staff excavation']);
      }
      for(const o of all)if(o.id==='hup'&&o.key==='dig'&&o.ri>0||o.id==='tech'&&o.key==='cyclone'&&S.blowers.length>1)
        old.push([o,'staffed excavation']);
    }
    if(phase===4&&p.finalPolicy==='legacy'){
      const value={'need land':3,'start bees':3,'start metal':3,'start smelting':3,bagging:3,price:2,'bin full':1.5,'hive full':1.5,'tub full':1.5,'packer busy':1.5,'feed smelter':1.5};
      return old.filter(([o])=>!(o.payback>horizon)).sort((a,b)=>a[0].cost/(value[a[1]]||1)-b[0].cost/(value[b[1]]||1))[0]||null;
    }
    // The letter accepts $200 HELD as an alternative to $900 lifetime revenue.
    // Once established income can fund it, banking is a real strategic action.
    if(phase===0&&S.story.done&&S.miles.letter==null&&inc>=p.bankIncome)return null;
    function add(o,why,weight=1){
      if(!o||!(weight>0))return;
      const score=Math.pow(Math.max(.05,o.cost),p.costPower)/weight;
      const id=key(o), prev=candidates.get(id);
      if(!prev||score<prev.score)candidates.set(id,{o,why,score});
    }
    const find=(id,k)=>all.find(o=>o.id===id&&(k==null||o.key===k));
    // Keep useful measured-bottleneck options, but remove price steps with no time to repay.
    for(const [o,why] of old){
      if(why==='prepare travelling Tinker')continue;
      let w=1;
      if(['robot','rup'].includes(o.id))w*=p.growth;
      if(['blower','shaker','hup'].includes(o.id))w*=p.helpers;
      if(['bagging','start bees','need land','start metal'].includes(why))w*=p.goals;
      if(why==='research')w*=p.research;
      if(['start smelting','feed smelter','smelters','furnace operation','operator yield','bellows','finished storage'].includes(why))w*=p.industry;
      if(o.id==='up'&&prices.includes(o.key)||o.id==='gen'&&o.key==='market')continue;
      if(phase===0&&!S.flags.hiveKnown&&['metalSlot','miner','shaft'].includes(o.id))continue;
      if(phase===4&&endMinutes<p.endHorizon&&['bee','hiveUp','honeyPack','land','robot'].includes(o.id))continue;
      add(o,why,w);
    }
    // Reprice observed physical sales at today's prices, then rank the actual gain per cost.
    // Market does not multiply cleanup. Slag/heat are throughput, never price multipliers.
    if(r)for(const o of all){
      let gain=0;
      if(o.id==='up'&&prices.includes(o.key)){
        const u=F.UP[o.key],lv=S.lv[o.key]||0;
        gain=o.key==='cleanup'?(r.nL||0)*(u.val(lv+1)-u.val(lv))/100:
          priceSources[o.key].reduce((n,k)=>n+(r[k]||0),0)*(u.val(lv+1)/u.val(lv)-1);
      }else if(o.id==='gen'&&o.key==='market')gain=['leaf','bag','metal','ingot','jar','gift'].reduce((n,k)=>n+(r[k]||0),0)*.1/(1+.1*(S.gen.market||0));
      if(gain>0&&o.cost/gain<=horizon)add(o,'measured price payback '+(o.cost/gain).toFixed(2)+'m',p.prices*2*Math.max(.25,gain/inc*10));
    }
    // Development of a new revenue source must not wait for that source's past revenue.
    if(phase===0){
      if(S.robots.length<2)add(find('robot'),'second productive worker',p.growth*3);
      if(S.robots.length>=2&&!S.shakers.length)add(find('shaker'),'establish leaf supply',p.helpers*3);
      if(!S.bag.built)add(find('bagger'),'unlock book',p.goals*3);
      if(S.flags.hiveKnown&&!S.hive.built)add(find('hive'),'unlock honey goal',p.goals*3);
      if(S.hive.built&&(S.totals.honeyCash||0)<D.HONEY_CASH){
        if(S.hive.bees<10)add(find('bee'),'establish honey production',p.goals);
        add(find('up','honeyPrice'),'earn honey goal faster',p.goals);
      }
      if(S.miles.honeyHome!=null){
        if(!S.blowers.length)add(find('blower'),'required travelling Blower',p.goals*5);
        if(!S.shakers.length)add(find('shaker'),'staff deadheading research',p.goals*5);
        if(S.land<1)add(find('land'),'departure prerequisite: land',p.goals*3);
        if(!S.metalSlot)add(find('metalSlot'),'departure prerequisite: tub',p.goals*3);
        else if(!S.miners.length)add(find('miner'),'departure prerequisite: mine',p.goals*3);
      }
    }
    if(phase===3){
      if(S.flags.dryKnown&&!S.flags.antHill){
        if(!S.hive.built)add(find('hive'),'start ant research chain',p.goals*2);
        if(S.hive.built&&!S.hive.bees&&!S.flags.beeFail)add(find('bee'),'discover rainy hive',p.goals*3);
        if(S.robots.length<p.researchCrew)add(find('robot'),'staff ant research',p.goals*3);
        if(S.blowers.length<2)add(find('blower'),'preserve drying during research',p.goals*2);
      }
      if(S.flags.antHill){
        if((S.totals.honeyCash||0)<D.CANNED_CASH&&S.hive.bees<10)add(find('bee'),'mushroom goal',p.goals);
        if(!S.shakers.length)add(find('shaker'),'fire research prerequisite',p.goals*3);
        if(!S.metalSlot)add(find('metalSlot'),'log goal prerequisite',p.goals*3);
        else if(!S.miners.length)add(find('miner'),'produce goal logs',p.goals*3);
      }
    }
    // Study skills travel with Tinker and are useful at every subsequent research gate.
    if(S.story.found&&!S.story.done){
      for(const o of all)if(o.id==='rup'&&o.key==='study'&&S.robots[o.ri].prio.some(row=>row.includes('research')))
        add(o,'accelerate required research',p.research*(o.ri===0?2:1));
    }
    if(S.plant.built){
      for(const o of all){
        if(o.id==='up'&&['smeltSpeed','slag'].includes(o.key))add(o,'physical goal throughput',p.industry*2);
        if(o.id==='hup'&&o.key==='stoke'||o.id==='tech'&&o.key==='forge')add(o,'physical goal bellows',p.industry*2);
        if(o.id==='rup'){
          const tasks=S.robots[o.ri].prio.flat(), primary=S.robots[o.ri].prio[0]||[];
          if(primary.includes('smelt')&&['pack','drill','magnet'].includes(o.key))add(o,'develop furnace operator',p.industry*2);
          if(primary.includes('haul')&&['speed','carry'].includes(o.key))add(o,'clear finished output',p.industry*2);
          if(primary.includes('mine')&&['speed','carry','drill','magnet'].includes(o.key))add(o,'supply furnace',p.industry);
        }
      }
      for(const k of ['jig','precision','diamond','horseshoe'])add(find('tech',k),'unlock physical production',p.industry);
      if(slots<4){add(find('miner'),'ore supply slots',p.industry);add(find('shaft'),'ore supply slots',p.industry);}
    }else if(phase===4||phase===3&&S.flags.coalKnown)add(find('plant'),'build required plant',p.goals*p.industry);
    // The actual readiness rule counts EVERY personal skill at full price. Include
    // packing, machinery and study, and consider paid unlocks. No state is granted.
    if(ready){
      candidates.clear();
      if(!S.blowers.length)return [find('blower'),'required travelling Blower'];
      for(const o of all){
        const allowed=p.readiness==='all'||leaf.includes(o.key);
        if(o.id==='rup'&&o.ri===0&&allowed){
          const lv=S.robots[0].lv[o.key]||0,t=D.TRACKS[o.key];
          const full=t.gens.flatMap(g=>g.cost)[lv];
          const value=Math.min(full,D.TINKER_GOAL-Y.dev('tinkerWorth()'));
          add(o,'paid readiness: '+o.key,Math.max(.01,value)*(o.key==='study'?1.5:1));
        }
      }
      if(!candidates.size){
        const unlocks=all.filter(o=>o.id==='tech'&&Object.hasOwn(S.robots[0].lv,D.TECH[o.key]?.track)&&
          (p.readiness==='all'||leaf.includes(D.TECH[o.key].track)));
        for(const o of unlocks)add(o,'unlock remaining readiness path',1);
      }
    }
    const sorted=[...candidates.values()].sort((a,b)=>a.score-b.score||key(a.o).localeCompare(key(b.o)));
    const best=sorted[0];
    return best?[best.o,best.why]:null; // Save for the selected investment; never fabricate cash.
  };
})();
