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
  'jinpo-bot-carp-knowledge-data.js','jinpo-bot-conversation.js','jinpo-bot-smalltalk.js',
  'jinpo-bot-carp-knowledge.js','jinpo-bot-carp.js','jinpo-bot-kashin-name.js',
  'jinpo-bot-tool-data.js','jinpo-bot-tool-knowledge.js',
  'jinpo-bot-tairano-data.js','jinpo-bot-tairano-knowledge.js',
  'jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js','jinpo-bot.js'
].forEach(load);
const B=global.JINPO_BOT;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function compactMeta(r){
  const d=r&&r.data||{};
  return {mode:r&&r.mode||'',links:r&&r.links||[],data:{
    siteGuide:!!d.siteGuide,siteItem:String(d.siteItem||''),siteItems:Array.isArray(d.siteItems)?d.siteItems.slice():[],
    siteFeature:String(d.siteFeature||''),siteFeatures:Array.isArray(d.siteFeatures)?d.siteFeatures.slice():[],
    siteCandidates:Array.isArray(d.siteCandidates)?d.siteCandidates.slice():[],siteSourceCandidates:Array.isArray(d.siteSourceCandidates)?d.siteSourceCandidates.slice():[],
    siteComparison:Array.isArray(d.siteComparison)?d.siteComparison.slice():[],selectedSiteItem:String(d.selectedSiteItem||''),
    siteOpenedItems:Array.isArray(d.siteOpenedItems)?d.siteOpenedItems.slice():[],siteExcludedItems:Array.isArray(d.siteExcludedItems)?d.siteExcludedItems.slice():[],
    siteConditions:Array.isArray(d.siteConditions)?d.siteConditions.map(x=>({intent:String(x.intent||''),target:String(x.target||''),positive:x.positive!==false,query:String(x.query||'')})):[],
    siteConditionalFilter:!!d.siteConditionalFilter,siteConditionalOpen:!!d.siteConditionalOpen,needsClarification:!!d.needsClarification
  }};
}
function session(){const history=[];return{history,async ask(q){history.push({role:'user',text:q});const r=await B.handle({message:q,history:history.slice()});history.push({role:'assistant',text:String(r.answer||''),meta:compactMeta(r)});return r;}};}
function guide(r){return !!(r&&r.mode==='サイト総合案内'&&r.data&&r.data.siteGuide);}
function ids(r){return r&&r.data&&Array.isArray(r.data.siteItems)?r.data.siteItems.join(','):'';}
function cands(r){return r&&r.data&&Array.isArray(r.data.siteCandidates)?r.data.siteCandidates.join(','):'';}
function source(r){return r&&r.data&&Array.isArray(r.data.siteSourceCandidates)?r.data.siteSourceCandidates.join(','):'';}
function labels(r){return (r&&r.links||[]).map(x=>String(x.label||''));}
function onlyLinks(r,names){const a=labels(r);return a.length===names.length&&names.every((n,i)=>a[i].includes(n));}
function conds(r){return r&&r.data&&Array.isArray(r.data.siteConditions)?r.data.siteConditions:[];}
(async()=>{
  let s,r;

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');await s.ask('九十九だけ開いて');r=await s.ask('残りは？');
  check('remaining after single selection',guide(r)&&ids(r)==='kishin,mado'&&source(r)==='kishin,tsukumo,mado',r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');await s.ask('魔導を開いて');r=await s.ask('それ以外を開いて');
  check('open all except selected',guide(r)&&ids(r)==='kishin,tsukumo'&&onlyLinks(r,['鬼神石','九十九']),r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');await s.ask('前二つを開いて');r=await s.ask('残りを開いて');
  check('remaining after subset open',guide(r)&&ids(r)==='mado'&&onlyLinks(r,['魔導結晶']),r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');await s.ask('魔導を選ぶ');r=await s.ask('選んでない方は？');
  check('unselected pages after selection',guide(r)&&ids(r)==='kishin,tsukumo',r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');r=await s.ask('鬼神石抜きで');
  check('exclusion only creates reduced set',guide(r)&&ids(r)==='tsukumo,mado'&&r.data.siteExcludedItems.join(',')==='kishin',r);
  r=await s.ask('残った方はどっちも保存できる？');
  check('remaining wording keeps reduced set for feature question',guide(r)&&ids(r)==='tsukumo,mado'&&/九十九/.test(r.answer||'')&&/魔導結晶/.test(r.answer||'')&&!/^残りは/.test(r.answer||''),r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');await s.ask('能力計算に入るのだけ');r=await s.ask('さらに保存できるやつだけ');
  check('conditions accumulate',guide(r)&&conds(r).length===2&&conds(r)[0].intent==='reflect'&&conds(r)[1].intent==='save',r);
  r=await s.ask('やっぱ保存条件はなしで');
  check('remove one condition only',guide(r)&&ids(r)==='tsukumo,mado'&&conds(r).length===1&&conds(r)[0].intent==='reflect',r);
  r=await s.ask('条件全部外して');
  check('remove all conditions restores source',guide(r)&&ids(r)==='kishin,tsukumo,mado'&&conds(r).length===0,r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');await s.ask('能力計算に入るのだけ');r=await s.ask('元の3つに戻して');
  check('restore original candidate set',guide(r)&&ids(r)==='kishin,tsukumo,mado'&&source(r)==='kishin,tsukumo,mado',r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');r=await s.ask('保存できないのだけ、いや保存できるの全部開いて');
  check('same-message correction discards old condition',guide(r)&&r.data.siteConditionalOpen&&ids(r)==='kishin,tsukumo,mado'&&conds(r).length===1&&conds(r)[0].positive===true,r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');r=await s.ask('能力計算に入るの、いや家臣計算に入るのだけ');
  check('same-message target correction keeps last target',guide(r)&&ids(r)==='tsukumo'&&conds(r).length===1&&conds(r)[0].target==='retainer',r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');r=await s.ask('鬼神石抜きで開いて');
  check('exclusion-only open',guide(r)&&ids(r)==='tsukumo,mado'&&onlyLinks(r,['九十九','魔導結晶']),r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');await s.ask('能力計算に入るのだけ');r=await s.ask('それ以外は？');
  check('complement after capability filter',guide(r)&&ids(r)==='kishin',r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');await s.ask('能力計算に入るのだけ');await s.ask('後者は保存も？');r=await s.ask('元の3つに戻して');
  check('source set survives selected feature followup',guide(r)&&ids(r)==='kishin,tsukumo,mado',r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');await s.ask('能力計算に入るのだけ');await s.ask('保存できるのだけ');r=await s.ask('能力計算の条件はなしで');
  check('remove reflect condition leaves save condition',guide(r)&&ids(r)==='kishin,tsukumo,mado'&&conds(r).length===1&&conds(r)[0].intent==='save',r);

  s=session();await s.ask('鬼神石と九十九と魔導って何が違う？');r=await s.ask('2番目以外を開いて');
  check('existing positional exclusion remains',guide(r)&&onlyLinks(r,['鬼神石','魔導結晶']),r);

  r=await session().ask('残りは？');
  check('remainder without candidate context is not hijacked',!guide(r),r);
  r=await session().ask('鬼神石1番の入手は？');
  check('tool data boundary remains',r&&r.mode==='たいらの野望ツール実データ',r);
  r=await session().ask('足利義昭のカウンター見たい');
  check('counter boundary remains',r&&r.mode==='たいらの野望専用知識',r);

  console.log(`SITE GUIDE SET MEMORY: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
