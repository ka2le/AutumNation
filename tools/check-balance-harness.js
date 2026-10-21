'use strict';
const assert=require('node:assert/strict'),setup=require('./balance/campaign-setup.js');
// A departure can occur exactly on a decision tick. The travel save has already
// been written: another purchase would disappear on reload and fake a refund.
for(const flag of ['__departed','__finished']){
 const S={t:0};global.window={};
 global.__leafYard={state:()=>S,dev:()=>{window.__campaign={LOT_ID:'home',step:dt=>{S.t+=dt;window[flag]=true;}};}};
 setup({phase:0,profile:'balanced',crew:3});
 window.__purchases=[];window.__policy=()=>{throw Error('Decision after terminal step');};
 const result=window.__advance(1);
 assert.equal(result.elapsed,.05);assert.equal(result.purchases.length,0);
 assert.equal(flag==='__departed'?result.departed:result.finished,true);
}
delete global.window;delete global.__leafYard;
console.log('Campaign harness stops before a purchase after travel-save or ending.');
