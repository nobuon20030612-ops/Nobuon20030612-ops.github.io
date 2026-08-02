#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..'),store={};
global.window=global;
global.localStorage={getItem:k=>store['l:'+k]||null,setItem:(k,v)=>store['l:'+k]=String(v),removeItem:k=>delete store['l:'+k]};
global.sessionStorage={getItem:k=>store['s:'+k]||null,setItem:(k,v)=>store['s:'+k]=String(v),removeItem:k=>delete store['s:'+k]};
global.document={readyState:'complete',addEventListener:()=>{},title:'',location:{},querySelector:()=>null};
global.addEventListener=()=>{};
global.location={href:'https://example.test/index.html',pathname:'/index.html',origin:'https://example.test'};
global.fetch=async()=>({ok:false,status:503,text:async()=>''});
global.JINPO_BOT_PAGE_MODE='top';
function load(name){vm.runInThisContext(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});}
[
  'jinpo-bot-carp-knowledge-data.js','jinpo-bot-conversation.js','jinpo-bot-context.js','jinpo-bot-dialog.js','jinpo-bot-page-context.js',
  'jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js','jinpo-bot-memory.js','jinpo-bot-arukimiko.js','jinpo-bot-smalltalk.js',
  'jinpo-bot-carp-knowledge.js','jinpo-bot-carp.js','jinpo-bot-kashin-name.js','jinpo-bot-tool-data.js','jinpo-bot-tool-knowledge.js',
  'jinpo-bot-tairano-data.js','jinpo-bot-tairano-knowledge.js','jinpo-bot-hero-data.js','jinpo-bot-hero-knowledge.js','jinpo-bot.js'
].forEach(load);
const B=global.JINPO_BOT;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function compactMeta(r){const d=r&&r.data||{};return {links:r&&r.links||[],mode:r&&r.mode||'',data:{siteGuide:!!d.siteGuide,siteItem:String(d.siteItem||''),siteFeature:String(d.siteFeature||''),knownTermGuidance:!!d.knownTermGuidance,termKey:String(d.termKey||''),normalizedTerm:String(d.normalizedTerm||''),approximateTerm:!!d.approximateTerm}};}
async function pair(first,second){const h=[{role:'user',text:first}];const a=await B.handle({message:first,history:h.slice()});h.push({role:'assistant',text:String(a.answer||''),meta:compactMeta(a)});h.push({role:'user',text:second});const b=await B.handle({message:second,history:h.slice()});return {first:a,second:b,history:h};}
async function triplet(first,second,third){const x=await pair(first,second),h=x.history.slice();h.push({role:'assistant',text:String(x.second.answer||''),meta:compactMeta(x.second)});h.push({role:'user',text:third});const c=await B.handle({message:third,history:h.slice()});return {first:x.first,second:x.second,third:c};}
function guide(r,id,feature){const d=r&&r.data||{};return !!(r&&r.mode==='サイト総合案内'&&d.siteItem===id&&(!feature||d.siteFeature===feature));}
(async()=>{
  let x=await pair('鎮魂符','何を設定する？');
  check('chinkon setting question reaches inputs',guide(x.second,'chinkon','inputs')&&/メイン選択と2枠目選択/.test(x.second.answer||''),x.second);
  x=await pair('鎮魂符','頭');
  check('chinkon bare body part stays in page',guide(x.second,'chinkon','inputs')&&/「頭」の枠/.test(x.second.answer||''),x.second);
  let y=await triplet('鎮魂符','頭','頭じゃなくて腰');
  check('chinkon correction selects latest body part',guide(y.third,'chinkon','inputs')&&/「腰」の枠/.test(y.third.answer||''),y.third);
  y=await triplet('鎮魂符','頭','やっぱり足');
  check('chinkon short reselection uses latest page context',guide(y.third,'chinkon','inputs')&&/「足」の枠/.test(y.third.answer||''),y.third);

  x=await pair('星海の荒石','文曲');
  check('seikai bunkyoku stays stone selection',guide(x.second,'seikai','inputs')&&/「文曲」のボタン/.test(x.second.answer||''),x.second);
  check('seikai bunkyoku never becomes jinpo operation',x.second&&x.second.data&&x.second.data.siteItem!=='jinpo'&&!/陣法検索/.test(x.second.answer||''),x.second);
  x=await pair('星海の荒石','武曲を見たい');
  check('seikai named stone selects image',guide(x.second,'seikai','inputs')&&/「武曲」のボタン/.test(x.second.answer||''),x.second);
  y=await triplet('星海の荒石','文曲','文曲じゃなくて貪狼');
  check('seikai explicit correction selects replacement stone',guide(y.third,'seikai','inputs')&&/「貪狼」のボタン/.test(y.third.answer||''),y.third);
  y=await triplet('星海の荒石','文曲','やっぱり武曲');
  check('seikai short reselection uses latest page context',guide(y.third,'seikai','inputs')&&/「武曲」のボタン/.test(y.third.answer||''),y.third);

  x=await pair('天下武技大会','天の表の見方');
  check('tournament ten table help selects ten child',guide(x.second,'ten_mode')&&/天下武技大会・天/.test(x.second.answer||''),x.second);
  x=await pair('天下武技大会','地の表の見方');
  check('tournament chi table help selects chi child',guide(x.second,'chi_mode')&&/天下武技大会・地/.test(x.second.answer||''),x.second);

  x=await pair('トップページの動画再生','再生方法');
  check('video playback method uses page help',guide(x.second,'video')&&/全画面再生/.test(x.second.answer||''),x.second);

  const direct=await B.handle({message:'家臣ステータス',history:[{role:'user',text:'家臣ステータス'}]});
  check('retainer alias wins over hero name matching',guide(direct,'retainer')&&direct.mode!=='英傑マスター確認',direct);

  console.log(`KNOWN TERM PAGE INTERNAL: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
