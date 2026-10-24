// Study-only deliberate saving policies. Honey's full productive build retains
// its existing priority while active, then returns to this saved chooser.
(() => {
  const base=window.__choose,Y=__leafYard,plan=window.__config.discountPlan;
  window.__choose=(old,ctx)=>{
    if(plan==='skip')return base(old.filter(([o])=>o.key!=='blueprint'),{...ctx,all:ctx.all.filter(o=>o.key!=='blueprint')});
    const S=ctx.S,o=ctx.all.find(o=>o.id==='gen'&&o.key==='blueprint');
    const ready=plan==='crew3'?S.robots.length>=3:plan==='crew6'?S.robots.length>=6:
      plan==='repair'&&(window.__phase===4&&S.flags.ruinKnown||window.__phase===3&&S.flags.coalKnown);
    if(o&&ready&&!S.trip&&(!S.story.found||S.story.done))return[o,'save for shared skill plans: '+plan];
    return base(old,ctx);
  };
})();
