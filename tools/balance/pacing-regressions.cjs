'use strict';
// Reuse existing browser regressions against the frozen trial, without changing them.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {out,sha}=require('./pacing-study.cjs'),root=path.resolve(__dirname,'..');
const checks=[];
for(const file of ['check-ending-replay.js','check-goal-dismissal.js','check-reset.js']){
 const input=path.join(root,file),source=fs.readFileSync(input,'utf8'),anchor="path.resolve(__dirname, '../public')";
 if(source.split(anchor).length!==2)throw Error('Regression root adapter drift: '+file);
 const adapted=source.replace(anchor,JSON.stringify(path.join(out,'review-candidate')));
 const loader="const Module=require('node:module');const m=new Module("+JSON.stringify(input)+");m.filename="+JSON.stringify(input)+";m.paths=Module._nodeModulePaths("+JSON.stringify(root)+");m._compile("+JSON.stringify(adapted)+","+JSON.stringify(input)+");";
 const r=spawnSync(process.execPath,['-e',loader],{encoding:'utf8',windowsHide:true});process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');
 checks.push({file,sourceHash:sha(source),adapterHash:sha(adapted),exitCode:r.status,output:r.stdout});
 if(r.status!==0)throw Error(file+' failed');
}
fs.writeFileSync(path.join(out,'regressions.json'),JSON.stringify({checks},null,2));
