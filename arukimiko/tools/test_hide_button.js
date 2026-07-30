#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'jinpo-ai-chat.js'),'utf8');
const match=src.match(/  function hideAll\(\)\{([\s\S]*?)\n  \}\n  function showLauncher/);
if(!match){console.error('FAIL: hideAll function not found');process.exit(1);}
const fn='function hideAll(){'+match[1]+'\n}';
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function classList(initial){
  const set=new Set(initial||[]);
  return {add:x=>set.add(x),remove:x=>set.delete(x),contains:x=>set.has(x),values:()=>Array.from(set)};
}
function run(withAux){
  const saved=[];
  const context={
    window:{},
    win:{classList:classList(['isOpen','isMinimized'])},
    launcher:{attrs:{},setAttribute(k,v){this.attrs[k]=String(v);}},
    root:{classList:classList([])},
    restoreBtn:{hidden:true},
    syncCount:0,
    positionCount:0
  };
  context.syncMinimizeButton=function(){context.syncCount++;};
  context.scheduleRestorePosition=function(){context.positionCount++;};
  context.saveUi=function(v){saved.push(v);};
  if(withAux)context.window.hideAiInfo=function(){context.auxCount=(context.auxCount||0)+1;};
  vm.createContext(context);
  vm.runInContext(fn+'\nhideAll();',context,{filename:'hideAll-test.js'});
  return {context,saved};
}

for(const withAux of [false,true]){
  let r;
  try{r=run(withAux);check('no exception '+withAux,true);}catch(e){check('no exception '+withAux,false,e);continue;}
  const c=r.context;
  check('root hidden '+withAux,c.root.classList.contains('isBotHidden'),c.root.classList.values());
  check('window closed '+withAux,!c.win.classList.contains('isOpen'),c.win.classList.values());
  check('minimize cleared '+withAux,!c.win.classList.contains('isMinimized'),c.win.classList.values());
  check('launcher collapsed '+withAux,c.launcher.attrs['aria-expanded']==='false',c.launcher.attrs);
  check('restore shown '+withAux,c.restoreBtn.hidden===false,c.restoreBtn.hidden);
  check('state saved '+withAux,r.saved.length===1&&r.saved[0].open===false&&r.saved[0].hidden===true&&r.saved[0].minimized===false,r.saved);
  if(withAux)check('auxiliary hide called',c.auxCount===1,c.auxCount);
}
check('unsafe bare call removed',!/\n\s*hideAiInfo\(\);/.test(match[0]),match[0]);
console.log(`HIDE BUTTON: ${pass} / ${pass+fail} PASS`);
if(fail)process.exit(1);
