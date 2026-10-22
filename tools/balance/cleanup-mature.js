/* Hold an earned main-benchmark yard, freezing purchases and its current staffing.
 * No capital, upgrades, resources or progress are granted. Travel is held only
 * during the observation window. Inject after the normal honey strategy. */
(() => {
  const Y=__leafYard,base=window.__policy,O=window.__matureOptions,clone=x=>JSON.parse(JSON.stringify(x));
  let repair=null,start=null,E=null;
  const point=()=>({t:Y.state().t-start,src:clone(window.__src),cash:Y.state().cash,earned:Y.state().totals.cash,cleanN:Y.state().cleanN});
  const hold=()=>{
    for(const [kind,key] of [['robot','robots'],['blower','blowers'],['shaker','shakers']])Y.state()[key].forEach((c,i)=>{
      if(c.prio.some(row=>row.includes('travel'))){c.prio=c.prio.map(row=>row.filter(t=>t!=='travel')).filter(row=>row.length);if(!c.off.includes('travel'))c.off.push('travel');Y.dev(`taskListChanged('${kind}',${i})`);}
    });
  };
  window.__policy=()=>{
    const S=Y.state();if(repair===null&&S.flags.ruinKnown)repair=S.t;
    if(start===null){
      if(repair===null||S.t-repair<O.delay*60||!window.__experiment?.maxed)return base();
      start=S.t;
      E=window.__experiment={options:O,repairDelay:(start-repair)/60,checkpoint:{state:clone(S),src:clone(window.__src),rng:window.__rngState(),runtime:Y.dev('(()=>{const seen=new WeakSet();return JSON.parse(JSON.stringify({R,HB,B,truck,STN,FLOWERS},(k,v)=>{if(v&&typeof v==="object"){if(seen.has(v))return "[reference]";seen.add(v);}return v;}));})()')},points:[],purchaseCount:window.__purchases.length};
      E.points.push(point());
    }
    hold();
    if(S.t-start>=E.points.length*60)E.points.push(point());
    if(S.t-start>=15*60){E.points.push(point());E.end=clone(S);E.finished=true;E.endPurchaseCount=window.__purchases.length;window.__experimentDone=true;}
  };
})();
