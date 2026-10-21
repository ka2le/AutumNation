// Campaign driver derived from the V27/V34 harness; no economy or progress injection.
function setup({phase,profile,crew}){
 window.__arm='after';window.__phase=phase;window.__route=profile;window.__profile=['goalFirst','parallel','bankLetter'].includes(profile)?'ingotFirst':profile;window.__researchCrew=crew;
 window.__events=[];window.__seen=new Set();window.__samples=[];window.__nextSample=0;window.__diagnostics={seconds:0,noCashPurchaseSeconds:0,researchZeroRateSeconds:0,smelterIdle:{ore:0,coal:0,rack:0,ready:0},workers:{},gates:{}};
 __leafYard.dev('simMode=true;window.__campaign={step,readLetter,LOT_ID,INGOT_GOAL,tripCashOK,GOAL_DONE_HOLD,researchRate,researchNeed,dryAfterFire,leavesForGoal,rackHasRoom,smeltReserve,metalPerIngot,taskWork,stationFree,PLANT_COAL,truck:()=>truck};');
 const Y=__leafYard,C=window.__campaign;window.__decisionTicks=20;window.__stageStart=Y.state().t;window.__initial=JSON.parse(JSON.stringify(Y.state()));
 const snapshot=()=>{const S=Y.state();return{cash:S.cash,earned:S.totals.cash,robots:S.robots.length,blowers:S.blowers.length,shakers:S.shakers.length,bees:S.hive.bees,story:{item:S.story.item,prog:S.story.prog,need:C.researchNeed(),rate:C.researchRate()},totals:{...S.totals},lv:{...S.lv},gen:{...S.gen},land:S.land,miners:S.miners.length,study:S.robots.map(c=>c.lv.study),researchers:Y.robots().filter(r=>['study','assist','fireDo'].includes(r.st)).length};};
 window.__mark=(id,ok)=>{if(ok&&!window.__seen.has(id)){window.__seen.add(id);window.__events.push({id,t:Y.state().t-window.__stageStart,...snapshot()});}};
 window.__advance=seconds=>{
  for(let q=0;q<seconds*20&&!window.__departed&&!window.__finished;q++){
   C.step(.05);if(q%window.__decisionTicks!==0)continue;let S=Y.state(),m=window.__mark;
   for(let i=0;i<S.letters.length;i++)if(!S.letters[i].read){m('letter:'+S.letters[i].id,true);C.readLetter(i);m('read:'+S.letters[i].id,true);}
   window.__policy();window.__maintain();S=Y.state();
   const atHome=phase===0,atRain=phase===3,atFinal=phase===4,story=S.story;
   m('robot2',S.robots.length>=2);m('robot3',S.robots.length>=3);m('blower2',S.blowers.length>=2);
   m('bagger',atHome&&S.bag.built);m('bookFound',atHome&&story.item==='book'&&story.found);m('bookDone',atHome&&story.item==='book'&&story.done);
   m('leavesGoal',atHome&&S.miles.moreLeaves!=null);m('beeFound',atHome&&story.item==='bee'&&story.found);m('beeDone',atHome&&S.flags.hiveKnown);
   m('hiveBuilt',(atHome||atRain)&&S.hive.built);m('firstHoneySale',atHome&&S.totals.honeyCash>0);m('honeyGoal',atHome&&S.totals.honeyCash>=100);
   m('quests',atHome&&S.miles.honeyHome!=null&&S.t-S.miles.honeyHome>=C.GOAL_DONE_HOLD);m('land',atHome&&S.land>=1);m('mine',atHome&&S.miners.length>0);m('tinkerReady',atHome&&S.miles.qTinker!=null);m('deadheading',atHome&&S.flags.snipKnown);
   m('dryLabOpen',atRain&&S.flags.dryLab);m('dryLabDone',atRain&&S.flags.dryKnown);m('firstDrySale',atRain&&S.totals.drySold>0);m('dry500',atRain&&S.totals.drySold>=500);
   m('hiveResearchFound',atRain&&story.item==='hive'&&story.found);m('hiveResearchStart',atRain&&story.item==='hive'&&!story.done&&C.researchRate()>0);
   m('ants',atRain&&S.flags.antHill);m('firstAntSale',atRain&&S.flags.antHill&&S.totals.honeyCash>0);m('canned200',atRain&&S.totals.honeyCash>=200);
   m('logCrib',atRain&&S.metalSlot);m('saw',atRain&&S.miners.length>0);m('logs100',atRain&&S.totals.logsSold>=100);m('shaker',atRain&&S.shakers.length>0);
   m('strike',atRain&&S.fire.struck);m('fireResearchStart',atRain&&story.item==='fire'&&!story.done&&C.researchRate()>0);m('fireDone',atRain&&S.flags.fireDone);
   m('dryAfterFire300',atRain&&S.flags.fireDone&&C.dryAfterFire()>=300);m('coalFound',atRain&&story.item==='coal'&&story.found);m('coalDone',atRain&&S.flags.coalKnown);
   m('kilnBuilt',atRain&&S.plant.built);m('coal100',atRain&&S.totals.kilnSold>=100);m('returnTrip',atRain&&S.trip?.fire);
   m('ruinFound',atFinal&&story.item==='ruin'&&story.found);m('ruinDone',atFinal&&S.flags.ruinKnown);m('plantBuilt',atFinal&&S.plant.built);
   m('firstIngot',atFinal&&S.totals.ingots>0);m('firstIngotSale',atFinal&&S.totals.ingotsSold>0);m('ingotsGoal',atFinal&&S.totals.ingotsSold>=C.INGOT_GOAL);m('endingTrip',atFinal&&S.flags.ending>=1);
   const D=window.__diagnostics;D.seconds++;
   if(story.found&&!story.done&&C.researchRate()<=0)D.researchZeroRateSeconds++;
   for(const r of Y.robots()){
    const k=r.id+':'+r.st;D.workers[k]=(D.workers[k]||0)+1;
    if(S.plant.built&&S.robots[r.id].prio[0]?.includes('smelt')&&r.st!=='smelt'){
     const k=S.plant.coal!=null&&S.plant.coal<=0?'coal':!C.rackHasRoom(r)?'rack':S.plant.ore<C.metalPerIngot()?'ore':'ready';D.smelterIdle[k]++;
    }
    if(phase===4&&S.t-window.__stageStart>=900&&S.plant.built&&S.robots[r.id].prio[0]?.includes('smelt')){
     const A=D.lateAvailability||(D.lateAvailability={busy:0,workAvailable:0,station:0,rack:0,coal:0,input:0});
     const k=r.st==='smelt'?'busy':C.taskWork(r,'smelt')?'workAvailable':C.PLANT_COAL&&S.plant.coal<=0?'coal':C.stationFree('smelt',r)<0?'station':!C.rackHasRoom(r)?'rack':'input';A[k]++;
    }
   }
   const g=atHome?(!S.miles.letter?'beforeLetter':!S.miles.moreLeaves?'leafGoal':!S.flags.hiveKnown?'beeResearch':S.totals.honeyCash<100?'honeyGoal':'departureQuests'):atRain?(!S.flags.antHill?'hiveAndDrying':!S.fire.struck?'lightningGoals':!S.flags.fireDone?'fireResearch':!S.flags.coalKnown?'coalBridge':S.totals.kilnSold<100?'coalSales':'returnTrip'):!S.flags.ruinKnown?'ruinResearch':!S.plant.built?'repair':S.totals.ingotsSold<C.INGOT_GOAL?'ingots':'endingTrip';D.gates[g]=(D.gates[g]||0)+1;
   if(S.t>=window.__nextSample){window.__nextSample=S.t+10;window.__samples.push({t:S.t-window.__stageStart,...snapshot(),bin:S.binLeaves,binCap:Y.fn().binCap(),bags:S.bag.bags,bagCap:Y.fn().bagCap(),ore:S.plant.ore,rack:S.plant.rack,rackCap:Y.fn().rackCap(),pallet:S.ingots,palletCap:Y.fn().palletCap(),honey:S.hive.honey,nectar:S.hive.nectar,flags:{dryKnown:S.flags.dryKnown,antHill:S.flags.antHill,fireDone:S.flags.fireDone,coalKnown:S.flags.coalKnown},runtime:Y.robots().map(r=>({id:r.id,st:r.st,at:r.at,carryL:r.carryL,carryI:r.carryI})),helpers:Y.helpers().map(h=>({kind:h.kind,idx:h.idx,st:h.st,task:h.task})),jobs:S.robots.map(c=>c.prio),helperJobs:S.blowers.map(c=>c.prio),skills:S.robots.map(c=>({...c.lv})),src:{...window.__src}});}
  }
  const S=Y.state();return{phase,lot:C.LOT_ID,initial:window.__initial,elapsed:S.t-window.__stageStart,departed:!!window.__departed,finished:!!window.__finished,events:window.__events,samples:window.__samples,industrial:window.__industrial||[],diagnostics:window.__diagnostics,purchases:window.__purchases.map(p=>({...p,t:p.t-window.__stageStart})),state:S};
 };
}
if(typeof module!=='undefined')module.exports=setup;
