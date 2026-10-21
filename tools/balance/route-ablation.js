/* Main-policy counterfactuals: stop investing in a home source after earning the
 * first honey milestone, while preserving all paid assets and useful work. */
(() => {
 const O=window.__experimentOptions,Y=__leafYard,old=window.__auditFilter;
 window.__experiment={options:O,rule:'Freeze new home source investment after the first honey milestone; retain productive assets and assignments.'};
 window.__auditFilter=(o,S)=>{
  if(!old(o,S))return false;
  if(Y.dev('LOT_ID')!=='home'||S.totals.honeyCash<Y.dev('HONEY_CASH'))return true;
  if(O.freeze==='honey'&&(['hive','bee','hiveUp','honeyPack'].includes(o.id)||['hiveTank','hiveStore','honeyPrice','giftPrice','snip','clover','seeding'].includes(o.key)))return false;
  if(O.freeze==='leaf'&&(['bagger'].includes(o.id)||['leafPrice','bagPrice','cleanup','bin','pick','grab','reach','blow','shake','press'].includes(o.key)||o.id==='tech'&&['servos','wrist','fineWrist','claw','arm','pincers'].includes(o.key)))return false;
  return true;
 };
})();
